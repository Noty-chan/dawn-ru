begin;

-- Qualify the JSON record produced by jsonb_array_elements. The previous name
-- collided with the PL/pgSQL loop variable on PostgreSQL 17.
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

revoke execute on function public.append_scene_events(uuid,bigint,jsonb,jsonb,text) from public,anon;
grant execute on function public.append_scene_events(uuid,bigint,jsonb,jsonb,text) to authenticated;

commit;
