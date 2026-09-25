begin;

-- Persist an exact request fingerprint with the original committed result.
-- The RPC signature stays unchanged so deployed clients can continue calling it.
create table public.scene_intent_batch_receipts (
  scene_id uuid not null references public.scenes(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  request_hash bytea not null check (octet_length(request_hash) = 32),
  result_version bigint not null check (result_version > 0),
  created_at timestamptz not null default now(),
  primary key (scene_id, actor_id, request_hash)
);

alter table public.scene_intent_batch_receipts enable row level security;
revoke all on public.scene_intent_batch_receipts from public, anon, authenticated;

create or replace function public.settle_scene_intent_batch(
  p_scene_id uuid,
  p_expected_version bigint,
  p_command_ids bigint[] default '{}'::bigint[],
  p_rejected_command_ids bigint[] default '{}'::bigint[],
  p_events jsonb default '[]'::jsonb,
  p_state jsonb default '{}'::jsonb,
  p_label text default 'network.v2.tick'
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
  expected_commands integer;
  found_commands integer;
  next_version bigint;
  client_id text;
  safe_type text;
  request_hash bytea;
  receipt_version bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_expected_version is null or p_expected_version < 0 then raise exception 'invalid expected scene version'; end if;
  if p_events is null or jsonb_typeof(p_events) is distinct from 'array' then raise exception 'events must be an array'; end if;
  if not exists(select 1 from public.scenes as s where s.id = p_scene_id and public.has_campaign_role(s.campaign_id, array['owner','narrator'])) then
    raise exception 'narrator role required';
  end if;
  if octet_length(p_events::text) > 2097152 then raise exception 'event batch is too large'; end if;
  event_count := jsonb_array_length(p_events);
  if event_count < 0 or event_count > 192 then raise exception 'event batch size must be 0..192'; end if;
  if octet_length(coalesce(p_state, '{}'::jsonb)::text) > 2097152 then raise exception 'scene state is too large'; end if;
  if coalesce(array_length(p_command_ids, 1), 0) > 20
     or coalesce(array_length(p_rejected_command_ids, 1), 0) > 20 then
    raise exception 'too many commands in one tick';
  end if;
  if p_command_ids && p_rejected_command_ids then raise exception 'command cannot be both applied and rejected'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_events) as batch(value)
    where nullif(batch.value->>'id', '') is null
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
  if not public.has_campaign_role(current_scene.campaign_id, array['owner','narrator']) then
    raise exception 'narrator role required';
  end if;
  expected_commands := coalesce(array_length(p_command_ids, 1), 0)
    + coalesce(array_length(p_rejected_command_ids, 1), 0);
  if coalesce(array_length(p_command_ids, 1), 0) > 0 and event_count = 0 then
    raise exception 'applied commands require at least one event';
  end if;
  if event_count = 0 and expected_commands = 0 then
    if current_scene.version <> p_expected_version then raise exception 'scene version conflict' using errcode = '40001'; end if;
    return current_scene.version;
  end if;

  -- jsonb text is canonical for object key order. Include all parameters that
  -- affect the state, event rows, command decisions, or observable event log.
  request_hash := extensions.digest(
    jsonb_build_object(
      'scene_id', p_scene_id,
      'expected_version', p_expected_version,
      'command_ids', p_command_ids,
      'rejected_command_ids', p_rejected_command_ids,
      'events', p_events,
      'state', p_state,
      'label', p_label
    )::text,
    'sha256'
  );

  -- The scene row lock serializes a retry with its original invocation. Only
  -- an exact request fingerprint earns the saved receipt and original version.
  select receipt.result_version into receipt_version
  from public.scene_intent_batch_receipts as receipt
  where receipt.scene_id = current_scene.id
    and receipt.actor_id = auth.uid()
    and receipt.request_hash = request_hash;
  if receipt_version is not null then return receipt_version; end if;

  if current_scene.version <> p_expected_version then
    raise exception 'scene version conflict' using errcode = '40001';
  end if;

  if expected_commands > 0 then
    perform 1
    from public.scene_commands
    where id = any(p_command_ids || p_rejected_command_ids)
    for update;
    select count(*) into found_commands
    from public.scene_commands
    where id = any(p_command_ids || p_rejected_command_ids)
      and scene_id = current_scene.id
      and campaign_id = current_scene.campaign_id
      and command_type = 'intent_v2'
      and status = 'pending';
    if found_commands <> expected_commands then raise exception 'intent command set is stale or invalid'; end if;
  end if;

  if coalesce((p_state->>'version')::bigint, -1) <> p_expected_version + event_count then
    raise exception 'state version does not match event batch';
  end if;
  if event_count > 0 and exists(
    select 1 from public.scene_events
    where scene_id = current_scene.id
      and client_event_id in (
        select batch.value->>'id' from jsonb_array_elements(p_events) as batch(value)
      )
  ) then raise exception 'event id already exists'; end if;

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
      client_id, current_scene.campaign_id, current_scene.id, auth.uid(), next_version,
      safe_type,
      case when current_event->'payload'->>'visibility' = 'gm' then 'gm' else 'public' end,
      coalesce(current_event->'payload', '{}'::jsonb),
      coalesce((current_event->>'at')::timestamptz, now())
    );
  end loop;

  if event_count > 0 then
    update public.scenes
    set state = coalesce(p_state, '{}'::jsonb),
        version = next_version,
        updated_by = auth.uid(),
        updated_at = now()
    where id = current_scene.id;
  end if;

  update public.scene_commands
  set status = 'applied', decided_by = auth.uid(), decided_at = now()
  where id = any(p_command_ids) and status = 'pending';

  update public.scene_commands
  set status = 'rejected', decided_by = auth.uid(), decided_at = now()
  where id = any(p_rejected_command_ids) and status = 'pending';

  insert into public.event_log(campaign_id, scene_id, actor_id, event_type, payload)
  values(
    current_scene.campaign_id, current_scene.id, auth.uid(),
    left(coalesce(nullif(p_label, ''), 'network.v2.tick'), 80),
    jsonb_build_object(
      'protocol', 2,
      'from_version', p_expected_version,
      'to_version', next_version,
      'events', event_count,
      'applied_commands', coalesce(array_length(p_command_ids, 1), 0),
      'rejected_commands', coalesce(array_length(p_rejected_command_ids, 1), 0)
    )
  );

  insert into public.scene_intent_batch_receipts(
    scene_id, actor_id, request_hash, result_version
  ) values (current_scene.id, auth.uid(), request_hash, next_version);

  return next_version;
end;
$$;

revoke execute on function public.settle_scene_intent_batch(uuid,bigint,bigint[],bigint[],jsonb,jsonb,text)
from public, anon;
grant execute on function public.settle_scene_intent_batch(uuid,bigint,bigint[],bigint[],jsonb,jsonb,text)
to authenticated;

commit;
