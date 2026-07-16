begin;

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

create or replace function public.join_train_session(p_code text, p_character_name text)
returns table(session_id uuid, code text, state jsonb, version bigint, station text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target public.train_sessions%rowtype;
  safe_name text := left(trim(coalesce(p_character_name,'')),80);
  assigned_station text;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if safe_name='' then raise exception 'character name required'; end if;
  select * into target from public.train_sessions session
  where session.code=upper(trim(coalesce(p_code,''))) and session.status='open'
  for update;
  if target.id is null then raise exception 'room not found or already closed'; end if;
  if not exists(select 1 from public.train_members member where member.session_id=target.id and member.user_id=current_user_id)
    and (select count(*) from public.train_members member where member.session_id=target.id and member.role='player') >= 7
  then raise exception 'train crew is full'; end if;
  insert into public.train_members(session_id,user_id,role,character_name,station,last_seen)
  values(target.id,current_user_id,'player',safe_name,null,now())
  on conflict on constraint train_members_pkey do update
  set character_name=excluded.character_name,last_seen=now()
  returning public.train_members.station into assigned_station;
  return query select target.id,target.code,target.state,target.version,assigned_station;
end;
$$;

revoke execute on function public.redeem_campaign_invite(text,text) from public,anon;
grant execute on function public.redeem_campaign_invite(text,text) to authenticated;
revoke execute on function public.join_train_session(text,text) from public,anon;
grant execute on function public.join_train_session(text,text) to authenticated;

commit;
