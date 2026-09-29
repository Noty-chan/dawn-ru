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
const actor="00000000-0000-4000-8000-000000000001";
const sceneIds=Array.from({length:9},(_,index)=>`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`);
const rpc="select public.settle_scene_intent_batch($1::uuid,$2::bigint,$3::bigint[],$4::bigint[],$5::jsonb,$6::jsonb,$7::text) as version";
const acceptRpc="select public.accept_scene_command($1::bigint,$2::bigint,$3::jsonb,$4::jsonb,$5::text) as version";
const tick=(sceneId,eventId)=>[sceneId,0,[],[],[{id:eventId,type:"scene.test",payload:{value:eventId}}],{version:1,event:eventId},"network.test.tick"];

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
  console.log("Network PostgreSQL RPCs: old receipt ambiguity and legacy SQL-NULL state corruption reproduced; fixes, exact retry receipt, five isolated scenes, one-winner expected-version race, consistent scene->command lock ordering, and legacy/modern timeout settings passed. Simultaneous multi-connection row-lock contention is not covered by single-session PGlite.");
} finally {
  await db.close();
}
