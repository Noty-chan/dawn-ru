begin;
-- Only durable metadata is stored. Gestures never enter a database table.
create table public.presentation_colors (
  scene_id uuid not null references public.scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  color_slot integer not null check(color_slot between 0 and 11),
  primary key(scene_id,user_id), unique(scene_id,color_slot)
);
alter table public.presentation_colors enable row level security;
revoke all on public.presentation_colors from anon,authenticated;

create function public.presentation_roster(target_scene_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare campaign uuid; member record; slot integer;
begin
  select s.campaign_id into campaign from public.scenes s where s.id=target_scene_id;
  if campaign is null or not public.is_campaign_member(campaign) then raise exception 'Presentation access denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_scene_id::text,0));
  delete from public.presentation_colors c where c.scene_id=target_scene_id and not exists(select 1 from public.campaign_members m where m.campaign_id=campaign and m.user_id=c.user_id);
  for member in select m.user_id from public.campaign_members m where m.campaign_id=campaign order by m.joined_at,m.user_id loop
    if not exists(select 1 from public.presentation_colors c where c.scene_id=target_scene_id and c.user_id=member.user_id) then
      select n into slot from generate_series(0,11) n where not exists(select 1 from public.presentation_colors c where c.scene_id=target_scene_id and c.color_slot=n) order by n limit 1;
      if slot is null then raise exception 'Presentation participant limit reached'; end if;
      insert into public.presentation_colors(scene_id,user_id,color_slot) values(target_scene_id,member.user_id,slot);
    end if;
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'color_slot',c.color_slot)),'[]'::jsonb) from public.campaign_members m join public.presentation_colors c on c.user_id=m.user_id and c.scene_id=target_scene_id where m.campaign_id=campaign);
end $$;
revoke all on function public.presentation_roster(uuid) from public,anon;
grant execute on function public.presentation_roster(uuid) to authenticated;

create function public.presentation_topic_allowed(topic text,writing boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare sid uuid; author uuid;
begin
  if topic !~ '^dawn-present:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  sid:=split_part(topic,':',2)::uuid; author:=split_part(topic,':',3)::uuid;
  return (not writing or author=auth.uid()) and exists(select 1 from public.scenes s join public.campaign_members m on m.campaign_id=s.campaign_id and m.user_id=author where s.id=sid and public.is_campaign_member(s.campaign_id));
end $$;
revoke all on function public.presentation_topic_allowed(text,boolean) from public,anon;
grant execute on function public.presentation_topic_allowed(text,boolean) to authenticated;
-- Restrictive guards keep future broad permissive policies from bypassing author binding.
create policy presentation_read_guard on realtime.messages as restrictive for select to authenticated using (topic not like 'dawn-present:%' or public.presentation_topic_allowed(topic,false));
create policy presentation_write_guard on realtime.messages as restrictive for insert to authenticated with check (topic not like 'dawn-present:%' or public.presentation_topic_allowed(topic,true));
create policy presentation_read on realtime.messages for select to authenticated using (extension='broadcast' and public.presentation_topic_allowed(topic,false));
create policy presentation_write on realtime.messages for insert to authenticated with check (extension='broadcast' and public.presentation_topic_allowed(topic,true));
commit;
