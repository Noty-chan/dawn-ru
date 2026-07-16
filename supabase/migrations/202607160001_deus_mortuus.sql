begin;

create table if not exists public.train_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  gm_id uuid not null references auth.users(id) on delete restrict,
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.train_members (
  session_id uuid not null references public.train_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('gm','player')),
  character_name text not null check (char_length(character_name) between 1 and 80),
  station text check (station is null or station in ('gm','driver','engineer','warden','roaming')),
  attention boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (session_id,user_id)
);

create index if not exists train_members_user_idx on public.train_members(user_id,session_id);
create index if not exists train_sessions_open_idx on public.train_sessions(status,updated_at desc);

create or replace function public.is_train_member(target_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.train_members member
    where member.session_id=target_session and member.user_id=auth.uid()
  );
$$;

create or replace function public.is_train_gm(target_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.train_members member
    where member.session_id=target_session and member.user_id=auth.uid() and member.role='gm'
  );
$$;

create or replace function public.create_train_session(p_gm_name text, p_initial_state jsonb default '{}'::jsonb)
returns table(session_id uuid, code text, version bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_session uuid;
  generated_code text;
  safe_name text := left(trim(coalesce(p_gm_name,'')),80);
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  attempt integer := 0;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  if safe_name='' then safe_name := 'Смотритель'; end if;
  if octet_length(coalesce(p_initial_state,'{}'::jsonb)::text) > 2097152 then raise exception 'train state is too large'; end if;
  loop
    attempt := attempt + 1;
    generated_code := '';
    for slot_index in 1..6 loop
      generated_code := generated_code || substr(alphabet,1+floor(random()*length(alphabet))::integer,1);
    end loop;
    begin
      insert into public.train_sessions(code,gm_id,state)
      values(generated_code,current_user_id,coalesce(p_initial_state,'{}'::jsonb))
      returning id into created_session;
      exit;
    exception when unique_violation then
      if attempt >= 20 then raise exception 'could not allocate room code'; end if;
    end;
  end loop;
  insert into public.train_members(session_id,user_id,role,character_name,station)
  values(created_session,current_user_id,'gm',safe_name,'gm');
  return query select created_session,generated_code,1::bigint;
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
  select * into target from public.train_sessions
  where public.train_sessions.code=upper(trim(coalesce(p_code,''))) and status='open'
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

create or replace function public.assign_train_station(p_session_id uuid, p_user_id uuid, p_station text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare safe_station text;
begin
  if not public.is_train_gm(p_session_id) then raise exception 'gm role required'; end if;
  safe_station := case when p_station in ('driver','engineer','warden','roaming') then p_station else null end;
  update public.train_members
  set station=safe_station,attention=false,last_seen=now()
  where session_id=p_session_id and user_id=p_user_id and role='player';
  if not found then raise exception 'player not found'; end if;
end;
$$;

create or replace function public.save_train_state(p_session_id uuid, p_expected_version bigint, p_state jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare next_version bigint;
begin
  if not public.is_train_gm(p_session_id) then raise exception 'gm role required'; end if;
  if octet_length(coalesce(p_state,'{}'::jsonb)::text) > 2097152 then raise exception 'train state is too large'; end if;
  update public.train_sessions
  set state=coalesce(p_state,'{}'::jsonb),version=version+1,updated_at=now()
  where id=p_session_id and version=p_expected_version and status='open'
  returning version into next_version;
  if next_version is null then raise exception using errcode='40001',message='train state version conflict'; end if;
  update public.train_members set last_seen=now() where session_id=p_session_id and user_id=auth.uid();
  return next_version;
end;
$$;

create or replace function public.close_train_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_train_gm(p_session_id) then raise exception 'gm role required'; end if;
  update public.train_sessions set status='closed',updated_at=now() where id=p_session_id;
end;
$$;

alter table public.train_sessions enable row level security;
alter table public.train_members enable row level security;

drop policy if exists train_sessions_member_select on public.train_sessions;
create policy train_sessions_member_select on public.train_sessions
for select to authenticated using (public.is_train_member(id));

drop policy if exists train_members_member_select on public.train_members;
create policy train_members_member_select on public.train_members
for select to authenticated using (public.is_train_member(session_id));

revoke all on public.train_sessions from anon,authenticated;
revoke all on public.train_members from anon,authenticated;
grant select on public.train_sessions to authenticated;
grant select on public.train_members to authenticated;

revoke execute on function public.is_train_member(uuid) from public,anon;
revoke execute on function public.is_train_gm(uuid) from public,anon;
revoke execute on function public.create_train_session(text,jsonb) from public,anon;
revoke execute on function public.join_train_session(text,text) from public,anon;
revoke execute on function public.assign_train_station(uuid,uuid,text) from public,anon;
revoke execute on function public.save_train_state(uuid,bigint,jsonb) from public,anon;
revoke execute on function public.close_train_session(uuid) from public,anon;

grant execute on function public.is_train_member(uuid) to authenticated;
grant execute on function public.is_train_gm(uuid) to authenticated;
grant execute on function public.create_train_session(text,jsonb) to authenticated;
grant execute on function public.join_train_session(text,text) to authenticated;
grant execute on function public.assign_train_station(uuid,uuid,text) to authenticated;
grant execute on function public.save_train_state(uuid,bigint,jsonb) to authenticated;
grant execute on function public.close_train_session(uuid) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='train_sessions') then
      execute 'alter publication supabase_realtime add table public.train_sessions';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='train_members') then
      execute 'alter publication supabase_realtime add table public.train_members';
    end if;
  end if;
end;
$$;

commit;
