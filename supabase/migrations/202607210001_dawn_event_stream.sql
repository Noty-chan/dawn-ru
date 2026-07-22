begin;

-- Player clients must never receive the narrator snapshot and then merely hide it in UI.
create table if not exists public.scene_public_snapshots (
  scene_id uuid primary key references public.scenes(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.scene_events (
  id bigint generated always as identity primary key,
  client_event_id text not null,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  scene_version bigint not null check (scene_version > 0),
  event_type text not null check (char_length(event_type) between 1 and 80),
  visibility text not null default 'public' check (visibility in ('public','gm')),
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 65536),
  created_at timestamptz not null default now(),
  unique(scene_id,client_event_id),
  unique(scene_id,scene_version)
);

create index if not exists scene_events_scene_idx on public.scene_events(scene_id,scene_version);

create or replace function public.public_scene_projection(source jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select (coalesce(source,'{}'::jsonb) - 'undo' - 'privateNotes' - 'gmNotes') || jsonb_build_object(
    'view','player',
    'actors',coalesce((select jsonb_agg(item - 'notes' - 'privateNotes' - 'ownerId') from jsonb_array_elements(coalesce(source->'actors','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false),'[]'::jsonb),
    'objects',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(source->'objects','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false),'[]'::jsonb),
    'markers',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(source->'markers','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false and coalesce(item->>'kind','')<>'hidden'),'[]'::jsonb),
    'artworks',coalesce((select jsonb_agg(item - 'privateNotes') from jsonb_array_elements(coalesce(source->'artworks','[]'::jsonb)) item where coalesce((item->>'hidden')::boolean,false)=false),'[]'::jsonb),
    'log',coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(source->'log','[]'::jsonb)) item where coalesce(item->>'visibility',item->'payload'->>'visibility','public')<>'gm'),'[]'::jsonb)
  );
$$;

insert into public.scene_public_snapshots(scene_id,campaign_id,state,version)
select scene.id,scene.campaign_id,public.public_scene_projection(scene.state),scene.version
from public.scenes scene
on conflict(scene_id) do update set state=excluded.state,version=excluded.version,updated_at=now();

create or replace function public.ensure_scene_public_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.scene_public_snapshots(scene_id,campaign_id,state,version)
  values(new.id,new.campaign_id,public.public_scene_projection(new.state),new.version)
  on conflict(scene_id) do update set state=excluded.state,version=excluded.version,updated_at=now();
  return new;
end;
$$;

drop trigger if exists dawn_scene_public_snapshot on public.scenes;
create trigger dawn_scene_public_snapshot
after insert or update of state,version on public.scenes
for each row execute function public.ensure_scene_public_snapshot();

create or replace function public.append_scene_events(
  p_scene_id uuid,
  p_expected_version bigint,
  p_events jsonb,
  p_state jsonb,
  p_label text default 'scene.events'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_scene public.scenes%rowtype;
  item jsonb;
  next_version bigint;
  event_count integer;
  existing_count integer;
  client_id text;
  safe_type text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_events)<>'array' then raise exception 'events must be an array'; end if;
  event_count:=jsonb_array_length(p_events);
  if event_count<1 or event_count>64 then raise exception 'event batch size must be 1..64'; end if;
  if exists(select 1 from jsonb_array_elements(p_events) as batch(event_item) where nullif(event_item->>'id','') is null or char_length(event_item->>'id')>120) then raise exception 'every event needs a valid id'; end if;
  if (select count(distinct event_item->>'id') from jsonb_array_elements(p_events) as batch(event_item))<>event_count then raise exception 'duplicate ids inside event batch'; end if;
  if octet_length(coalesce(p_state,'{}'::jsonb)::text)>2097152 then raise exception 'scene state is too large'; end if;
  select * into current_scene from public.scenes where id=p_scene_id for update;
  if current_scene.id is null then raise exception 'scene not found'; end if;
  if not public.has_campaign_role(current_scene.campaign_id,array['owner','narrator']) then raise exception 'narrator role required'; end if;
  select count(*) into existing_count from public.scene_events where scene_id=p_scene_id and client_event_id in (select event_item->>'id' from jsonb_array_elements(p_events) as batch(event_item));
  if existing_count=event_count then return current_scene.version; end if;
  if existing_count>0 then raise exception 'partially duplicated event batch'; end if;
  if current_scene.version<>p_expected_version then raise exception 'scene version conflict' using errcode='40001'; end if;
  if coalesce((p_state->>'version')::bigint,-1)<>p_expected_version+event_count then raise exception 'state version does not match event batch'; end if;
  next_version:=current_scene.version;
  for item in select value from jsonb_array_elements(p_events) loop
    client_id:=item->>'id';
    safe_type:=left(coalesce(nullif(item->>'type',''),'scene.event'),80);
    next_version:=next_version+1;
    insert into public.scene_events(client_event_id,campaign_id,scene_id,actor_id,scene_version,event_type,visibility,payload,created_at)
    values(client_id,current_scene.campaign_id,p_scene_id,auth.uid(),next_version,safe_type,case when item->'payload'->>'visibility'='gm' then 'gm' else 'public' end,coalesce(item->'payload','{}'::jsonb),coalesce((item->>'at')::timestamptz,now()));
  end loop;
  update public.scenes set state=coalesce(p_state,'{}'::jsonb),version=next_version,updated_by=auth.uid(),updated_at=now() where id=p_scene_id;
  insert into public.event_log(campaign_id,scene_id,actor_id,event_type,payload)
  values(current_scene.campaign_id,p_scene_id,auth.uid(),left(coalesce(nullif(p_label,''),'scene.events'),80),jsonb_build_object('from_version',p_expected_version,'to_version',next_version,'events',event_count));
  return next_version;
end;
$$;

alter table public.scene_public_snapshots enable row level security;
alter table public.scene_events enable row level security;

drop policy if exists scenes_member_select on public.scenes;
drop policy if exists scenes_narrator_select on public.scenes;
create policy scenes_narrator_select on public.scenes for select to authenticated using (public.has_campaign_role(campaign_id,array['owner','narrator']));

drop policy if exists scene_public_member_select on public.scene_public_snapshots;
create policy scene_public_member_select on public.scene_public_snapshots for select to authenticated using (public.is_campaign_member(campaign_id));

drop policy if exists scene_events_visible_select on public.scene_events;
create policy scene_events_visible_select on public.scene_events for select to authenticated using (public.is_campaign_member(campaign_id) and (visibility='public' or public.has_campaign_role(campaign_id,array['owner','narrator'])));

drop policy if exists commands_member_select on public.scene_commands;
drop policy if exists commands_private_select on public.scene_commands;
create policy commands_private_select on public.scene_commands for select to authenticated using (actor_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator']));

drop policy if exists commands_member_insert on public.scene_commands;
create policy commands_member_insert on public.scene_commands for insert to authenticated with check (actor_id=(select auth.uid()) and public.is_campaign_member(campaign_id) and exists(select 1 from public.scene_public_snapshots snapshot where snapshot.scene_id=scene_id and snapshot.campaign_id=campaign_id));

drop policy if exists event_log_member_select on public.event_log;
drop policy if exists event_log_narrator_select on public.event_log;
create policy event_log_narrator_select on public.event_log for select to authenticated using (public.has_campaign_role(campaign_id,array['owner','narrator']));

drop policy if exists characters_member_select on public.characters;
drop policy if exists characters_private_select on public.characters;
create policy characters_private_select on public.characters for select to authenticated using (owner_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator']));
drop policy if exists characters_owner_update on public.characters;
create policy characters_owner_update on public.characters for update to authenticated using (owner_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator'])) with check ((owner_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator'])) and updated_by=(select auth.uid()));
alter table public.characters drop constraint if exists characters_state_size_check;
alter table public.characters add constraint characters_state_size_check check (octet_length(state::text)<=2097152);

alter table public.scene_commands drop constraint if exists scene_commands_command_type_check;
alter table public.scene_commands add constraint scene_commands_command_type_check check (command_type in ('join_hero','move_hero','set_targets','use_technique','update_runtime','request_undo','dispatch_events','reaction_response','public_roll'));

revoke all on public.scene_public_snapshots from anon,authenticated;
revoke all on public.scene_events from anon,authenticated;
grant select on public.scene_public_snapshots to authenticated;
grant select on public.scene_events to authenticated;
revoke execute on function public.public_scene_projection(jsonb) from public,anon;
revoke execute on function public.ensure_scene_public_snapshot() from public,anon,authenticated;
revoke execute on function public.append_scene_events(uuid,bigint,jsonb,jsonb,text) from public,anon;
grant execute on function public.public_scene_projection(jsonb) to authenticated;
grant execute on function public.append_scene_events(uuid,bigint,jsonb,jsonb,text) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scene_public_snapshots') then execute 'alter publication supabase_realtime add table public.scene_public_snapshots'; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scene_events') then execute 'alter publication supabase_realtime add table public.scene_events'; end if;
  end if;
end;
$$;

commit;
