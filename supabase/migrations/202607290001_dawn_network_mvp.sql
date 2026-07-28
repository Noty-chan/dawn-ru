begin;

-- Account-owned character library. Campaign characters remain deliberate
-- snapshots shared with a specific table; this library is private and can be
-- used before a player joins any campaign.
create table if not exists public.user_characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 120),
  name text not null default 'Безымянный герой' check (char_length(name) between 1 and 180),
  state jsonb not null default '{}'::jsonb check (octet_length(state::text) <= 2097152),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, local_id)
);

create index if not exists user_characters_owner_idx
  on public.user_characters(owner_id, updated_at desc);

create or replace function public.bump_user_character_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  new.owner_id := old.owner_id;
  new.local_id := old.local_id;
  return new;
end;
$$;

drop trigger if exists dawn_user_character_version on public.user_characters;
create trigger dawn_user_character_version
before update on public.user_characters
for each row execute function public.bump_user_character_version();

alter table public.user_characters enable row level security;

drop policy if exists user_characters_owner_select on public.user_characters;
create policy user_characters_owner_select
on public.user_characters for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists user_characters_owner_insert on public.user_characters;
create policy user_characters_owner_insert
on public.user_characters for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists user_characters_owner_update on public.user_characters;
create policy user_characters_owner_update
on public.user_characters for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists user_characters_owner_delete on public.user_characters;
create policy user_characters_owner_delete
on public.user_characters for delete to authenticated
using (owner_id = (select auth.uid()));

revoke all on public.user_characters from anon, authenticated;
grant select, insert, update, delete on public.user_characters to authenticated;
revoke execute on function public.bump_user_character_version() from public, anon, authenticated;

-- Apply a player's already revalidated command and close it in the same
-- transaction. This prevents duplicate application when a connection drops
-- between saving the Scene and marking the command as accepted.
create or replace function public.accept_scene_command(
  p_command_id bigint,
  p_expected_version bigint,
  p_events jsonb,
  p_state jsonb,
  p_label text default 'scene.command.accepted'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_command public.scene_commands%rowtype;
  current_scene public.scenes%rowtype;
  event_item jsonb;
  event_count integer;
  existing_count integer;
  next_version bigint;
  client_id text;
  safe_type text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'events must be an array'; end if;
  event_count := jsonb_array_length(p_events);
  if event_count < 1 or event_count > 64 then raise exception 'event batch size must be 1..64'; end if;
  if octet_length(coalesce(p_state, '{}'::jsonb)::text) > 2097152 then raise exception 'scene state is too large'; end if;
  if exists(
    select 1
    from jsonb_array_elements(p_events) as batch(event_item)
    where nullif(event_item->>'id', '') is null
       or char_length(event_item->>'id') > 120
  ) then raise exception 'every event needs a valid id'; end if;
  if (
    select count(distinct event_item->>'id')
    from jsonb_array_elements(p_events) as batch(event_item)
  ) <> event_count then raise exception 'duplicate ids inside event batch'; end if;

  select * into current_command
  from public.scene_commands
  where id = p_command_id
  for update;
  if current_command.id is null then raise exception 'command not found'; end if;
  if not public.has_campaign_role(current_command.campaign_id, array['owner','narrator']) then
    raise exception 'narrator role required';
  end if;

  select * into current_scene
  from public.scenes
  where id = current_command.scene_id
  for update;
  if current_scene.id is null then raise exception 'scene not found'; end if;

  -- A retry after the transaction committed is safe and returns the canonical
  -- version instead of applying the command twice.
  if current_command.status = 'applied' then return current_scene.version; end if;
  if current_command.status <> 'pending' then raise exception 'command is no longer pending'; end if;
  if current_scene.campaign_id <> current_command.campaign_id then raise exception 'command campaign mismatch'; end if;
  if current_scene.version <> p_expected_version then
    raise exception 'scene version conflict' using errcode = '40001';
  end if;
  if coalesce((p_state->>'version')::bigint, -1) <> p_expected_version + event_count then
    raise exception 'state version does not match event batch';
  end if;

  select count(*) into existing_count
  from public.scene_events
  where scene_id = current_scene.id
    and client_event_id in (
      select event_item->>'id'
      from jsonb_array_elements(p_events) as batch(event_item)
    );
  if existing_count > 0 then raise exception 'event id already exists'; end if;

  next_version := current_scene.version;
  for event_item in select value from jsonb_array_elements(p_events) loop
    client_id := event_item->>'id';
    safe_type := left(coalesce(nullif(event_item->>'type', ''), 'scene.event'), 80);
    next_version := next_version + 1;
    insert into public.scene_events(
      client_event_id, campaign_id, scene_id, actor_id, scene_version,
      event_type, visibility, payload, created_at
    )
    values(
      client_id,
      current_scene.campaign_id,
      current_scene.id,
      current_command.actor_id,
      next_version,
      safe_type,
      case when event_item->'payload'->>'visibility' = 'gm' then 'gm' else 'public' end,
      coalesce(event_item->'payload', '{}'::jsonb),
      coalesce((event_item->>'at')::timestamptz, now())
    );
  end loop;

  update public.scenes
  set state = coalesce(p_state, '{}'::jsonb),
      version = next_version,
      updated_by = auth.uid(),
      updated_at = now()
  where id = current_scene.id;

  update public.scene_commands
  set status = 'applied',
      decided_by = auth.uid(),
      decided_at = now()
  where id = current_command.id;

  insert into public.event_log(campaign_id, scene_id, actor_id, event_type, payload)
  values(
    current_scene.campaign_id,
    current_scene.id,
    auth.uid(),
    left(coalesce(nullif(p_label, ''), 'scene.command.accepted'), 80),
    jsonb_build_object(
      'command_id', current_command.id,
      'command_actor_id', current_command.actor_id,
      'command_type', current_command.command_type,
      'from_version', p_expected_version,
      'to_version', next_version,
      'events', event_count
    )
  );

  return next_version;
end;
$$;

revoke execute on function public.accept_scene_command(bigint,bigint,jsonb,jsonb,text)
from public, anon;
grant execute on function public.accept_scene_command(bigint,bigint,jsonb,jsonb,text)
to authenticated;

commit;
