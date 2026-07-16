begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Игрок' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','narrator','player')),
  display_name text not null check (char_length(display_name) between 1 and 80),
  joined_at timestamptz not null default now(),
  primary key (campaign_id,user_id)
);

create index campaign_members_user_idx on public.campaign_members(user_id,campaign_id);

create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  token_hash bytea not null unique,
  role text not null default 'player' check (role in ('narrator','player')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 1 check (max_uses between 1 and 50),
  use_count integer not null default 0 check (use_count between 0 and max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Безымянный герой' check (char_length(name) between 1 and 180),
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index characters_campaign_idx on public.characters(campaign_id);
create index characters_owner_idx on public.characters(owner_id);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null default 'Структурированный бой' check (char_length(name) between 1 and 180),
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scenes_campaign_idx on public.scenes(campaign_id);

create table public.scene_commands (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid not null references public.scenes(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  command_type text not null check (command_type in ('move_hero','set_targets','use_technique','update_runtime','request_undo')),
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 32768),
  status text not null default 'pending' check (status in ('pending','applied','rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index scene_commands_scene_idx on public.scene_commands(scene_id,status,created_at);

create table public.event_log (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (char_length(event_type) between 1 and 80),
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 131072),
  created_at timestamptz not null default now()
);

create index event_log_campaign_idx on public.event_log(campaign_id,created_at desc);

create or replace function public.is_campaign_member(target_campaign uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members member
    where member.campaign_id = target_campaign and member.user_id = auth.uid()
  );
$$;

create or replace function public.has_campaign_role(target_campaign uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members member
    where member.campaign_id = target_campaign
      and member.user_id = auth.uid()
      and member.role = any(allowed_roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id,display_name)
  values (new.id,left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'Игрок'),80))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger dawn_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.create_campaign(p_name text, p_display_name text, p_initial_state jsonb default '{}'::jsonb)
returns table(campaign_id uuid, scene_id uuid, role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_campaign uuid;
  created_scene uuid;
  safe_name text := left(trim(coalesce(p_name,'')),120);
  safe_display_name text := left(trim(coalesce(p_display_name,'')),80);
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if safe_name = '' then raise exception 'campaign name required'; end if;
  if safe_display_name = '' then safe_display_name := 'Нарратор'; end if;
  if octet_length(coalesce(p_initial_state,'{}'::jsonb)::text) > 2097152 then raise exception 'scene state is too large'; end if;

  insert into public.profiles(id,display_name) values(current_user_id,safe_display_name)
  on conflict(id) do update set display_name=excluded.display_name,updated_at=now();
  insert into public.campaigns(owner_id,name) values(current_user_id,safe_name) returning id into created_campaign;
  insert into public.campaign_members(campaign_id,user_id,role,display_name)
  values(created_campaign,current_user_id,'owner',safe_display_name);
  insert into public.scenes(campaign_id,name,state,updated_by)
  values(created_campaign,'Структурированный бой',coalesce(p_initial_state,'{}'::jsonb),current_user_id)
  returning id into created_scene;
  insert into public.event_log(campaign_id,scene_id,actor_id,event_type,payload)
  values(created_campaign,created_scene,current_user_id,'campaign.created',jsonb_build_object('name',safe_name));
  return query select created_campaign,created_scene,'owner'::text;
end;
$$;

create or replace function public.create_campaign_invite(p_campaign_id uuid, p_role text default 'player', p_max_uses integer default 8, p_expires_hours integer default 168)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text := translate(encode(extensions.gen_random_bytes(24),'base64'),'+/=','-_');
  safe_role text := case when p_role = 'narrator' then 'narrator' else 'player' end;
begin
  if not public.has_campaign_role(p_campaign_id,array['owner','narrator']) then raise exception 'narrator role required'; end if;
  insert into public.campaign_invites(campaign_id,token_hash,role,created_by,expires_at,max_uses)
  values(p_campaign_id,extensions.digest(raw_token,'sha256'),safe_role,auth.uid(),now()+make_interval(hours=>greatest(1,least(coalesce(p_expires_hours,168),720))),greatest(1,least(coalesce(p_max_uses,8),50)));
  return raw_token;
end;
$$;

create or replace function public.redeem_campaign_invite(p_token text, p_display_name text)
returns table(campaign_id uuid, scene_id uuid, role text, campaign_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invite public.campaign_invites%rowtype;
  inserted_count integer := 0;
  safe_display_name text := left(trim(coalesce(p_display_name,'')),80);
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if safe_display_name = '' then safe_display_name := 'Игрок'; end if;
  select * into invite from public.campaign_invites
  where token_hash=extensions.digest(coalesce(p_token,''),'sha256') for update;
  if invite.id is null or invite.revoked_at is not null or invite.expires_at <= now() or invite.use_count >= invite.max_uses then
    raise exception 'invite is invalid or expired';
  end if;
  insert into public.profiles(id,display_name) values(current_user_id,safe_display_name)
  on conflict(id) do update set display_name=excluded.display_name,updated_at=now();
  insert into public.campaign_members(campaign_id,user_id,role,display_name)
  values(invite.campaign_id,current_user_id,invite.role,safe_display_name)
  on conflict on constraint campaign_members_pkey do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count > 0 then update public.campaign_invites set use_count=use_count+1 where id=invite.id; end if;
  return query
  select campaign.id,scene.id,member.role,campaign.name
  from public.campaigns campaign
  join public.campaign_members member on member.campaign_id=campaign.id and member.user_id=current_user_id
  join lateral (select item.id from public.scenes item where item.campaign_id=campaign.id order by item.created_at limit 1) scene on true
  where campaign.id=invite.campaign_id;
end;
$$;

create or replace function public.save_scene_snapshot(p_scene_id uuid, p_expected_version bigint, p_state jsonb, p_event_type text default 'scene.snapshot')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_scene public.scenes%rowtype;
  next_version bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if octet_length(coalesce(p_state,'{}'::jsonb)::text) > 2097152 then raise exception 'scene state is too large'; end if;
  select * into current_scene from public.scenes where id=p_scene_id for update;
  if current_scene.id is null then raise exception 'scene not found'; end if;
  if not public.has_campaign_role(current_scene.campaign_id,array['owner','narrator']) then raise exception 'narrator role required'; end if;
  if current_scene.version <> p_expected_version then raise exception 'scene version conflict' using errcode='40001'; end if;
  next_version := current_scene.version+1;
  update public.scenes set state=coalesce(p_state,'{}'::jsonb),version=next_version,updated_by=auth.uid(),updated_at=now() where id=p_scene_id;
  insert into public.event_log(campaign_id,scene_id,actor_id,event_type,payload)
  values(current_scene.campaign_id,p_scene_id,auth.uid(),left(coalesce(nullif(p_event_type,''),'scene.snapshot'),80),jsonb_build_object('version',next_version));
  return next_version;
end;
$$;

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_invites enable row level security;
alter table public.characters enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_commands enable row level security;
alter table public.event_log enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy campaigns_member_select on public.campaigns for select to authenticated using (public.is_campaign_member(id));
create policy campaigns_owner_update on public.campaigns for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy members_member_select on public.campaign_members for select to authenticated using (public.is_campaign_member(campaign_id));
create policy members_owner_manage on public.campaign_members for all to authenticated using (public.has_campaign_role(campaign_id,array['owner'])) with check (public.has_campaign_role(campaign_id,array['owner']));
create policy invites_narrator_select on public.campaign_invites for select to authenticated using (public.has_campaign_role(campaign_id,array['owner','narrator']));
create policy invites_narrator_update on public.campaign_invites for update to authenticated using (public.has_campaign_role(campaign_id,array['owner','narrator'])) with check (public.has_campaign_role(campaign_id,array['owner','narrator']));
create policy characters_member_select on public.characters for select to authenticated using (public.is_campaign_member(campaign_id));
create policy characters_owner_insert on public.characters for insert to authenticated with check (public.is_campaign_member(campaign_id) and (owner_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator'])) and updated_by=(select auth.uid()));
create policy characters_owner_update on public.characters for update to authenticated using (owner_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator'])) with check (owner_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator']));
create policy scenes_member_select on public.scenes for select to authenticated using (public.is_campaign_member(campaign_id));
create policy commands_member_select on public.scene_commands for select to authenticated using (public.is_campaign_member(campaign_id));
create policy commands_member_insert on public.scene_commands for insert to authenticated with check (actor_id=(select auth.uid()) and public.is_campaign_member(campaign_id) and exists(select 1 from public.scenes scene where scene.id=scene_id and scene.campaign_id=campaign_id));
create policy commands_narrator_update on public.scene_commands for update to authenticated using (public.has_campaign_role(campaign_id,array['owner','narrator'])) with check (public.has_campaign_role(campaign_id,array['owner','narrator']) and decided_by=(select auth.uid()));
create policy event_log_member_select on public.event_log for select to authenticated using (public.is_campaign_member(campaign_id));

revoke all on public.campaign_invites from anon,authenticated;
grant select,update on public.campaign_invites to authenticated;
grant select,update on public.profiles to authenticated;
grant select,update on public.campaigns to authenticated;
grant select,insert,update,delete on public.campaign_members to authenticated;
grant select,insert,update on public.characters to authenticated;
grant select on public.scenes to authenticated;
grant select,insert,update on public.scene_commands to authenticated;
revoke insert,update,delete on public.event_log from anon,authenticated;
grant select on public.event_log to authenticated;
revoke execute on function public.is_campaign_member(uuid) from public,anon;
revoke execute on function public.has_campaign_role(uuid,text[]) from public,anon;
revoke execute on function public.handle_new_user() from public,anon,authenticated;
revoke execute on function public.create_campaign(text,text,jsonb) from public,anon;
revoke execute on function public.create_campaign_invite(uuid,text,integer,integer) from public,anon;
revoke execute on function public.redeem_campaign_invite(text,text) from public,anon;
revoke execute on function public.save_scene_snapshot(uuid,bigint,jsonb,text) from public,anon;
grant execute on function public.is_campaign_member(uuid) to authenticated;
grant execute on function public.has_campaign_role(uuid,text[]) to authenticated;
grant execute on function public.create_campaign(text,text,jsonb) to authenticated;
grant execute on function public.create_campaign_invite(uuid,text,integer,integer) to authenticated;
grant execute on function public.redeem_campaign_invite(text,text) to authenticated;
grant execute on function public.save_scene_snapshot(uuid,bigint,jsonb,text) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scenes') then execute 'alter publication supabase_realtime add table public.scenes'; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='scene_commands') then execute 'alter publication supabase_realtime add table public.scene_commands'; end if;
  end if;
end;
$$;

commit;
