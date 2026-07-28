begin;

-- PL/pgSQL resolves the local event_item variable and the SQL alias with the
-- same name ambiguously. Use an explicit table alias and value column.
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
  current_event jsonb;
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
    from jsonb_array_elements(p_events) as batch(value)
    where nullif(batch.value->>'id', '') is null
       or char_length(batch.value->>'id') > 120
  ) then raise exception 'every event needs a valid id'; end if;
  if (
    select count(distinct batch.value->>'id')
    from jsonb_array_elements(p_events) as batch(value)
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
      select batch.value->>'id'
      from jsonb_array_elements(p_events) as batch(value)
    );
  if existing_count > 0 then raise exception 'event id already exists'; end if;

  next_version := current_scene.version;
  for current_event in select batch.value from jsonb_array_elements(p_events) as batch(value) loop
    client_id := current_event->>'id';
    safe_type := left(coalesce(nullif(current_event->>'type', ''), 'scene.event'), 80);
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
      case when current_event->'payload'->>'visibility' = 'gm' then 'gm' else 'public' end,
      coalesce(current_event->'payload', '{}'::jsonb),
      coalesce((current_event->>'at')::timestamptz, now())
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
