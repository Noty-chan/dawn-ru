import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db=new PGlite();
const migrations=new URL("../../../supabase/migrations/",import.meta.url);
const baseline=fs.readFileSync(new URL("202609240001_dawn_intent_batch_receipts.sql",migrations),"utf8");
const fix=fs.readFileSync(new URL("202609290001_fix_intent_batch_receipt_hash_ambiguity.sql",migrations),"utf8");
const legacyTimeouts=fs.readFileSync(new URL("202609290002_stabilize_legacy_command_timeouts.sql",migrations),"utf8");
const legacyAccept=fs.readFileSync(new URL("202607290003_fix_accept_scene_command_event_alias.sql",migrations),"utf8");
const legacyAcceptFix=fs.readFileSync(new URL("202609290003_harden_legacy_command_accept.sql",migrations),"utf8");
const legacyMvp=fs.readFileSync(new URL("202607130001_dawn_multiplayer.sql",migrations),"utf8");
const legacyEvents=fs.readFileSync(new URL("202607230002_fix_append_scene_events.sql",migrations),"utf8");
const snapshotRpcFix=fs.readFileSync(new URL("202609290004_harden_legacy_scene_snapshot_rpcs.sql",migrations),"utf8");
const insertPolicyFix=fs.readFileSync(new URL("202609290005_scope_scene_command_insert_policy.sql",migrations),"utf8");
const actor="00000000-0000-4000-8000-000000000001";
const sceneIds=Array.from({length:11},(_,index)=>`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`);
const rpc="select public.settle_scene_intent_batch($1::uuid,$2::bigint,$3::bigint[],$4::bigint[],$5::jsonb,$6::jsonb,$7::text) as version";
const acceptRpc="select public.accept_scene_command($1::bigint,$2::bigint,$3::jsonb,$4::jsonb,$5::text) as version";
const snapshotRpc="select public.save_scene_snapshot($1::uuid,$2::bigint,$3::jsonb,$4::text) as version";
const appendRpc="select public.append_scene_events($1::uuid,$2::bigint,$3::jsonb,$4::jsonb,$5::text) as version";
const tick=(sceneId,eventId)=>[sceneId,0,[],[],[{id:eventId,type:"scene.test",payload:{value:eventId}}],{version:1,event:eventId},"network.test.tick"];
const extractFunction=(source,name)=>{
  const start=source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start,-1,`migration source contains ${name}`);
  const end=source.indexOf("$$;",start);
  assert.notEqual(end,-1,`${name} has a function terminator`);
  return source.slice(start,end+3);
};

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key);
    create table public.scenes(
      id uuid primary key,campaign_id uuid not null,version bigint not null,state jsonb,
      updated_by uuid,updated_at timestamptz
    );
    create table public.scene_commands(
      id bigint primary key,scene_id uuid,campaign_id uuid,actor_id uuid,command_type text,status text,
      decided_by uuid,decided_at timestamptz
    );
    create table public.scene_events(
      client_event_id text primary key,campaign_id uuid,scene_id uuid,actor_id uuid,
      scene_version bigint,event_type text,visibility text,payload jsonb,created_at timestamptz
    );
    create table public.event_log(
      id bigint generated always as identity primary key,campaign_id uuid,scene_id uuid,
      actor_id uuid,event_type text,payload jsonb
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function public.has_campaign_role(uuid,text[]) returns boolean
      language sql stable as $$ select true $$;
    create function extensions.digest(data text,algorithm text) returns bytea
      language sql immutable as $$ select decode(md5(data)||md5(algorithm||data),'hex') $$;
    create function public.accept_scene_command(bigint,bigint,jsonb,jsonb,text)
      returns bigint language sql as $$ select 1::bigint $$;
    insert into auth.users values ('${actor}');
    insert into public.scenes(id,campaign_id,version,state)
    values ${sceneIds.map((id,index)=>`('${id}','10000000-0000-4000-8000-${String(index+1).padStart(12,"0")}',0,'{"version":0}'::jsonb)`).join(",")};
    select set_config('request.jwt.claim.sub','${actor}',false);
  `);

  await db.exec(baseline);
  await assert.rejects(
    db.query(rpc,tick(sceneIds[0],"before-fix")),
    /column reference "request_hash" is ambiguous/i,
    "the pre-fix RPC must reproduce the deployed ambiguity"
  );

  await db.exec(fix);
  await db.exec(legacyTimeouts);

  // Reproduce a legacy RPC corruption: SQL NULL bypassed the old array and
  // expected-version checks, applying state without an event or version bump.
  await db.exec(legacyAccept);
  const legacyCommandId=9001;
  await db.query(`insert into public.scene_commands(id,scene_id,campaign_id,actor_id,command_type,status)
    values($1,$2,'10000000-0000-4000-8000-000000000009',$3,'move_hero','pending')`,[legacyCommandId,sceneIds[8],actor]);
  const corrupted=await db.query(acceptRpc,[legacyCommandId,null,null,{version:88,corrupted:true},"network.test.legacy"]);
  assert.equal(Number(corrupted.rows[0].version),0,"the old RPC accepted SQL NULL arguments at the current version");
  const beforeFix=await db.query(`select scene.version,scene.state,command.status,
      (select count(*) from public.scene_events where scene_id=scene.id) as events
    from public.scenes scene join public.scene_commands command on command.scene_id=scene.id
    where scene.id=$1`,[sceneIds[8]]);
  assert.deepEqual({...beforeFix.rows[0],version:Number(beforeFix.rows[0].version),events:Number(beforeFix.rows[0].events)},{version:0,state:{version:88,corrupted:true},status:"applied",events:0},
    "the pre-fix RPC demonstrates unversioned state mutation with no event");
  await db.exec(`delete from public.event_log where scene_id='${sceneIds[8]}';
    delete from public.scene_events where scene_id='${sceneIds[8]}';
    update public.scenes set version=0,state='{"version":0}' where id='${sceneIds[8]}';
    update public.scene_commands set status='pending',decided_by=null,decided_at=null where id=${legacyCommandId};`);
  await db.exec(legacyAcceptFix);

  await assert.rejects(db.query(acceptRpc,[legacyCommandId,0,null,{version:1},"network.test.legacy"]),
    /events must be an array/i,"the fixed legacy RPC rejects SQL NULL instead of silently applying state");
  await assert.rejects(db.query(acceptRpc,[legacyCommandId,null,[{id:"legacy-valid",type:"scene.test",payload:{}}],{version:1},"network.test.legacy"]),
    /invalid expected scene version/i,"the fixed legacy RPC rejects a SQL NULL expected version");
  const validLegacy=await db.query(acceptRpc,[legacyCommandId,0,[{id:"legacy-valid",type:"scene.test",payload:{}}],{version:1,event:"legacy-valid"},"network.test.legacy"]);
  assert.equal(Number(validLegacy.rows[0].version),1,"a valid legacy command commits one versioned event");
  const legacyEffects=await db.query(`select scene.version,scene.state,command.status,
      (select count(*) from public.scene_events where scene_id=scene.id) as events
    from public.scenes scene join public.scene_commands command on command.scene_id=scene.id
    where scene.id=$1`,[sceneIds[8]]);
  assert.deepEqual({...legacyEffects.rows[0],version:Number(legacyEffects.rows[0].version),events:Number(legacyEffects.rows[0].events)},{version:1,state:{version:1,event:"legacy-valid"},status:"applied",events:1},
    "the fixed legacy RPC commits state, event, command status, and version together");
  const sceneLockPosition=legacyAcceptFix.indexOf("select * into current_scene");
  const commandLockPosition=legacyAcceptFix.indexOf("select * into current_command");
  assert.ok(sceneLockPosition>=0&&sceneLockPosition<commandLockPosition,
    "legacy command acceptance must lock the scene before locking its command like the v2 RPC");

  // Load the exact prior snapshot/event RPC bodies and reproduce their SQL
  // NULL bypasses before applying the forward hardening migration.
  await db.exec(extractFunction(legacyMvp,"save_scene_snapshot"));
  await db.exec(extractFunction(legacyEvents,"append_scene_events"));
  const unversionedAppend=await db.query(appendRpc,[sceneIds[9],null,null,{version:77,corrupted:true},"network.test.append"]);
  assert.equal(Number(unversionedAppend.rows[0].version),0,"the old append RPC accepted NULL events and version");
  const appendBeforeFix=await db.query(`select scene.version,scene.state,
      (select count(*) from public.scene_events where scene_id=scene.id) as events
    from public.scenes scene where scene.id=$1`,[sceneIds[9]]);
  assert.deepEqual({...appendBeforeFix.rows[0],version:Number(appendBeforeFix.rows[0].version),events:Number(appendBeforeFix.rows[0].events)},
    {version:0,state:{version:77,corrupted:true},events:0},
    "the old append RPC demonstrates an unversioned state overwrite without events");

  await db.exec(`update public.scenes set version=5,state='{"version":0,"original":true}' where id='${sceneIds[10]}';`);
  const staleSnapshot=await db.query(snapshotRpc,[sceneIds[10],null,{version:0,stale:true},"network.test.snapshot"]);
  assert.equal(Number(staleSnapshot.rows[0].version),6,"the old snapshot RPC accepted a NULL expected version over a newer scene");
  const snapshotBeforeFix=await db.query(`select version,state from public.scenes where id=$1`,[sceneIds[10]]);
  assert.deepEqual({...snapshotBeforeFix.rows[0],version:Number(snapshotBeforeFix.rows[0].version)},
    {version:6,state:{version:0,stale:true}},"the old snapshot RPC demonstrates a stale state overwrite");

  await db.exec(`delete from public.event_log where scene_id in ('${sceneIds[9]}','${sceneIds[10]}');
    delete from public.scene_events where scene_id='${sceneIds[9]}';
    update public.scenes set version=0,state='{"version":0}' where id in ('${sceneIds[9]}','${sceneIds[10]}');`);
  await db.exec(snapshotRpcFix);
  await assert.rejects(db.query(appendRpc,[sceneIds[9],0,null,{version:1},"network.test.append"]),
    /events must be an array/i,"the fixed append RPC rejects NULL events");
  await assert.rejects(db.query(appendRpc,[sceneIds[9],null,[{id:"append-null-version",type:"scene.test",payload:{}}],{version:1},"network.test.append"]),
    /invalid expected scene version/i,"the fixed append RPC rejects a NULL expected version");
  const validAppend=await db.query(appendRpc,[sceneIds[9],0,[{id:"append-valid",type:"scene.test",payload:{}}],{version:1,event:"append-valid"},"network.test.append"]);
  assert.equal(Number(validAppend.rows[0].version),1,"a valid append writes one versioned event");
  await assert.rejects(db.query(snapshotRpc,[sceneIds[10],null,{version:0,stale:true},"network.test.snapshot"]),
    /invalid expected scene version/i,"the fixed snapshot RPC rejects a NULL expected version");
  const validSnapshot=await db.query(snapshotRpc,[sceneIds[10],0,{version:0,snapshot:"saved"},"network.test.snapshot"]);
  assert.equal(Number(validSnapshot.rows[0].version),1,"a valid snapshot commits at the next canonical version");

  // Exercise the actual INSERT RLS policy as authenticated, first proving the
  // old unqualified predicate admits a scene/campaign mismatch.
  const campaignA="10000000-0000-4000-8000-000000000001";
  const campaignB="10000000-0000-4000-8000-000000000002";
  await db.exec(`
    create table public.campaign_members(campaign_id uuid not null,user_id uuid not null,primary key(campaign_id,user_id));
    create table public.scene_public_snapshots(scene_id uuid not null,campaign_id uuid not null);
    insert into public.campaign_members values('${campaignA}','${actor}');
    insert into public.scene_public_snapshots values('${sceneIds[0]}','${campaignA}'),('${sceneIds[1]}','${campaignB}');
    create function public.is_campaign_member(target_campaign uuid) returns boolean
      language sql stable security definer set search_path='' as $$
        select exists(select 1 from public.campaign_members member where member.campaign_id=target_campaign and member.user_id=auth.uid())
      $$;
    grant select on public.scene_public_snapshots to authenticated;
    alter table public.scene_commands enable row level security;
    create policy commands_member_insert on public.scene_commands for insert to authenticated with check (
      actor_id=(select auth.uid()) and public.is_campaign_member(campaign_id) and exists(
        select 1 from public.scene_public_snapshots snapshot
        where snapshot.scene_id=scene_id and snapshot.campaign_id=campaign_id
      )
    );
    create policy commands_private_select on public.scene_commands for select to authenticated
      using (actor_id=(select auth.uid()) or public.has_campaign_role(campaign_id,array['owner','narrator']));
    grant select,insert on public.scene_commands to authenticated;
  `);
  const rlsPrivileges=await db.query(`select has_table_privilege('authenticated','public.scene_commands','insert') as insert_ok,
    has_schema_privilege('authenticated','public','usage') as schema_ok`);
  assert.deepEqual(rlsPrivileges.rows[0],{insert_ok:true,schema_ok:true},"authenticated has the base privileges needed to exercise the RLS policy");
  await db.exec("set role authenticated");
  try {
    const oldPolicyInsert=await db.query(`insert into public.scene_commands(id,scene_id,campaign_id,actor_id,command_type,status)
      values(9102,'${sceneIds[1]}','${campaignA}','${actor}','move_hero','pending') returning id`);
    assert.equal(Number(oldPolicyInsert.rows[0].id),9102,"the old RLS policy reproduces the cross-campaign scene insert");
  } finally {
    await db.exec("reset role");
  }
  await db.exec(insertPolicyFix);
  await db.exec("set role authenticated");
  try {
    await assert.rejects(db.query(`insert into public.scene_commands(id,scene_id,campaign_id,actor_id,command_type,status)
      values(9103,'${sceneIds[1]}','${campaignA}','${actor}','move_hero','pending')`),
    /row-level security policy/i,"the fixed policy rejects a target scene from another campaign");
    const validPolicyInsert=await db.query(`insert into public.scene_commands(id,scene_id,campaign_id,actor_id,command_type,status)
      values(9104,'${sceneIds[0]}','${campaignA}','${actor}','move_hero','pending') returning id`);
    assert.equal(Number(validPolicyInsert.rows[0].id),9104,"the fixed policy still allows a scene in the member campaign");
  } finally {
    await db.exec("reset role");
  }

  const functionConfig=(await db.query(`
    select proconfig from pg_proc
    where oid='public.settle_scene_intent_batch(uuid,bigint,bigint[],bigint[],jsonb,jsonb,text)'::regprocedure
  `)).rows[0].proconfig.join(" ");
  assert.match(functionConfig,/lock_timeout=2s/);
  assert.match(functionConfig,/statement_timeout=20s/);
  const legacyConfig=(await db.query(`
    select proconfig from pg_proc
    where oid='public.accept_scene_command(bigint,bigint,jsonb,jsonb,text)'::regprocedure
  `)).rows[0].proconfig.join(" ");
  assert.match(legacyConfig,/lock_timeout=2s/);
  assert.match(legacyConfig,/statement_timeout=20s/);
  const snapshotConfig=(await db.query(`select proconfig from pg_proc where oid='public.save_scene_snapshot(uuid,bigint,jsonb,text)'::regprocedure`)).rows[0].proconfig.join(" ");
  assert.match(snapshotConfig,/lock_timeout=2s/);
  assert.match(snapshotConfig,/statement_timeout=20s/);
  const appendConfig=(await db.query(`select proconfig from pg_proc where oid='public.append_scene_events(uuid,bigint,jsonb,jsonb,text)'::regprocedure`)).rows[0].proconfig.join(" ");
  assert.match(appendConfig,/lock_timeout=2s/);
  assert.match(appendConfig,/statement_timeout=20s/);

  const first=await db.query(rpc,tick(sceneIds[0],"retry-safe"));
  const retry=await db.query(rpc,tick(sceneIds[0],"retry-safe"));
  assert.equal(Number(first.rows[0].version),1,"first tick commits the next version");
  assert.equal(Number(retry.rows[0].version),1,"an exact retry returns its receipt version");

  const independent=await Promise.all(sceneIds.slice(1,6).map((sceneId,index)=>db.query(rpc,tick(sceneId,`independent-${index}`))));
  assert.deepEqual(independent.map(result=>Number(result.rows[0].version)),[1,1,1,1,1],"five independent scenes commit independently");

  const duplicateCalls=await Promise.all(Array.from({length:5},()=>db.query(rpc,tick(sceneIds[6],"same-concurrent-request"))));
  assert.deepEqual(duplicateCalls.map(result=>Number(result.rows[0].version)),[1,1,1,1,1],"duplicate tick requests share one receipt");
  const duplicateEffects=await db.query(`
    select
      (select count(*) from public.scene_events where scene_id=$1::uuid) as events,
      (select count(*) from public.event_log where scene_id=$1::uuid) as logs,
      (select count(*) from public.scene_intent_batch_receipts where scene_id=$1::uuid) as receipts
  `,[sceneIds[6]]);
  assert.deepEqual(Object.values(duplicateEffects.rows[0]).map(Number),[1,1,1],"duplicate retries create exactly one tick's effects");

  // PGlite exposes one SQL session, so it serializes Promise.all calls. This
  // checks optimistic-version outcomes, not PostgreSQL's simultaneous row-lock wait path.
  const raceScene=sceneIds[7];
  const raced=await Promise.allSettled(Array.from({length:5},(_,index)=>db.query(rpc,tick(raceScene,`version-race-${index}`))));
  assert.equal(raced.filter(result=>result.status==="fulfilled").length,1,"only one distinct request can commit at an expected version");
  const conflicts=raced.filter(result=>result.status==="rejected");
  assert.equal(conflicts.length,4,"the other distinct requests must lose the version race");
  for(const conflict of conflicts)assert.equal(conflict.reason.code,"40001","version losers are retryable serialization conflicts");
  console.log("Network PostgreSQL tests: receipt ambiguity and SQL-NULL corruption in legacy RPCs reproduced; fixes, five isolated scenes, one-winner version race, consistent scene->command lock ordering, RLS cross-campaign insert rejection with valid insert preserved, and RPC timeout settings passed. Simultaneous multi-connection row-lock contention is not covered by single-session PGlite.");
} finally {
  await db.close();
}
