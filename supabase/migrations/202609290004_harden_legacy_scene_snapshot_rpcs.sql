begin;

create or replace function public.save_scene_snapshot(
  p_scene_id uuid,
  p_expected_version bigint,
  p_state jsonb,
  p_event_type text default 'scene.snapshot'
)
returns bigint
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
set statement_timeout = '20s'
as $$
declare
  current_scene public.scenes%rowtype;
  next_version bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'invalid expected scene version';
  end if;
  if p_state is null or jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'scene state must be an object';
  end if;
  if octet_length(p_state::text) > 2097152 then raise exception 'scene state is too large'; end if;

  select * into current_scene
  from public.scenes
  where id = p_scene_id
  for update;
  if current_scene.id is null then raise exception 'scene not found'; end if;
  if not public.has_campaign_role(current_scene.campaign_id, array['owner','narrator']) then
    raise exception 'narrator role required';
  end if;
  if current_scene.version <> p_expected_version then
    raise exception 'scene version conflict' using errcode = '40001';
  end if;

  next_version := current_scene.version + 1;
  update public.scenes
  set state = p_state,
      version = next_version,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_scene_id;
  insert into public.event_log(campaign_id,scene_id,actor_id,event_type,payload)
  values(
    current_scene.campaign_id,
    p_scene_id,
    auth.uid(),
    left(coalesce(nullif(p_event_type,''),'scene.snapshot'),80),
    jsonb_build_object('version',next_version)
  );
  return next_version;
end;
$$;

revoke execute on function public.save_scene_snapshot(uuid,bigint,jsonb,text) from public,anon;
grant execute on function public.save_scene_snapshot(uuid,bigint,jsonb,text) to authenticated;

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
set lock_timeout = '2s'
set statement_timeout = '20s'
as $$
declare
  current_scene public.scenes%rowtype;
  current_event jsonb;
  event_count integer;
  existing_count integer;
  next_version bigint;
  client_id text;
  safe_type text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'invalid expected scene version';
  end if;
  if p_events is null or jsonb_typeof(p_events) is distinct from 'array' then
    raise exception 'events must be an array';
  end if;
  if octet_length(p_events::text) > 2097152 then raise exception 'event batch is too large'; end if;
  event_count := jsonb_array_length(p_events);
  if event_count < 1 or event_count > 64 then raise exception 'event batch size must be 1..64'; end if;
  if p_state is null or jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'scene state must be an object';
  end if;
  if octet_length(p_state::text) > 2097152 then raise exception 'scene state is too large'; end if;
  if exists(
    select 1
    from jsonb_array_elements(p_events) as batch(value)
    where nullif(batch.value->>'id','') is null
       or char_length(batch.value->>'id') > 120
  ) then raise exception 'every event needs a valid id'; end if;
  if (
    select count(distinct batch.value->>'id')
    from jsonb_array_elements(p_events) as batch(value)
  ) <> event_count then raise exception 'duplicate ids inside event batch'; end if;

  select * into current_scene
  from public.scenes
  where id = p_scene_id
  for update;
  if current_scene.id is null then raise exception 'scene not found'; end if;
  if not public.has_campaign_role(current_scene.campaign_id,array['owner','narrator']) then
    raise exception 'narrator role required';
  end if;

  select count(*) into existing_count
  from public.scene_events
  where scene_id = p_scene_id
    and client_event_id in (
      select batch.value->>'id'
      from jsonb_array_elements(p_events) as batch(value)
    );
  if existing_count = event_count then return current_scene.version; end if;
  if existing_count > 0 then raise exception 'partially duplicated event batch'; end if;
  if current_scene.version <> p_expected_version then
    raise exception 'scene version conflict' using errcode = '40001';
  end if;
  if coalesce((p_state->>'version')::bigint,-1) <> p_expected_version + event_count then
    raise exception 'state version does not match event batch';
  end if;

  next_version := current_scene.version;
  for current_event in select batch.value from jsonb_array_elements(p_events) as batch(value) loop
    client_id := current_event->>'id';
    safe_type := left(coalesce(nullif(current_event->>'type',''),'scene.event'),80);
    next_version := next_version + 1;
    insert into public.scene_events(
      client_event_id,campaign_id,scene_id,actor_id,scene_version,
      event_type,visibility,payload,created_at
    ) values(
      client_id,current_scene.campaign_id,p_scene_id,auth.uid(),next_version,
      safe_type,
      case when current_event->'payload'->>'visibility'='gm' then 'gm' else 'public' end,
      coalesce(current_event->'payload','{}'::jsonb),
      coalesce((current_event->>'at')::timestamptz,now())
    );
  end loop;

  update public.scenes
  set state = p_state,
      version = next_version,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_scene_id;
  insert into public.event_log(campaign_id,scene_id,actor_id,event_type,payload)
  values(
    current_scene.campaign_id,p_scene_id,auth.uid(),
    left(coalesce(nullif(p_label,''),'scene.events'),80),
    jsonb_build_object('from_version',p_expected_version,'to_version',next_version,'events',event_count)
  );
  return next_version;
end;
$$;

revoke execute on function public.append_scene_events(uuid,bigint,jsonb,jsonb,text) from public,anon;
grant execute on function public.append_scene_events(uuid,bigint,jsonb,jsonb,text) to authenticated;

commit;
