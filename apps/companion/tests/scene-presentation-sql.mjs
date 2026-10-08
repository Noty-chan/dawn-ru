import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '../../../output/qa-pg/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite(),u=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create table public.scenes(id uuid primary key,campaign_id uuid);create table public.campaign_members(campaign_id uuid,user_id uuid,display_name text,joined_at timestamptz default now());
 create function public.is_campaign_member(id uuid) returns boolean language sql stable security definer as $$select exists(select1 from public.campaign_members where campaign_id=id and user_id=auth.uid())$$;
 create schema realtime;create table realtime.messages(topic text,extension text);alter table realtime.messages enable row level security;grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;`.replace('select1','select 1'));
 await db.exec(fs.readFileSync(new URL('../../../supabase/migrations/202610080002_private_presentations.sql',import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${u(1)}'),('${u(2)}'),('${u(3)}');insert into public.scenes values('${u(101)}','${u(201)}'),('${u(102)}','${u(202)}');insert into public.campaign_members(campaign_id,user_id,display_name) values('${u(201)}','${u(1)}','One'),('${u(201)}','${u(2)}','Two'),('${u(202)}','${u(3)}','Three');set test.uid='${u(1)}';`);
 const roster=async()=>(await db.query(`select public.presentation_roster('${u(101)}') as roster`)).rows[0].roster;
 const first=await roster();assert.equal(first.length,2);assert.equal(new Set(first.map(r=>r.color_slot)).size,2);assert.deepEqual(await roster(),first);
 const allowed=async(topic,write)=>(await db.query('select public.presentation_topic_allowed($1,$2) as ok',[topic,write])).rows[0].ok;
 assert.equal(await allowed(`dawn-present:${u(101)}:${u(1)}`,true),true);assert.equal(await allowed(`dawn-present:${u(101)}:${u(2)}`,true),false);assert.equal(await allowed(`dawn-present:${u(101)}:${u(2)}`,false),true);assert.equal(await allowed(`dawn-present:${u(102)}:${u(3)}`,false),false);assert.equal(await allowed('dawn-present:bad:bad',true),false);
 // Even a broad permissive policy cannot bypass the restrictive author gate.
 await db.exec('create policy broad on realtime.messages for all to authenticated using(true) with check(true);set role authenticated;');
 await db.exec(`insert into realtime.messages values('dawn-present:${u(101)}:${u(1)}','broadcast')`);
 await assert.rejects(db.exec(`insert into realtime.messages values('dawn-present:${u(101)}:${u(2)}','broadcast')`),/row-level security/);
 await db.exec('reset role;');
 await db.exec(`delete from public.campaign_members where user_id='${u(2)}';insert into public.campaign_members(campaign_id,user_id,display_name) values('${u(201)}','${u(3)}','Three');`);
 const next=await roster();assert.equal(next.find(r=>r.user_id===u(1)).color_slot,first.find(r=>r.user_id===u(1)).color_slot);assert.equal(next.find(r=>r.user_id===u(3)).color_slot,first.find(r=>r.user_id===u(2)).color_slot);
 await db.exec(`set test.uid='${u(2)}';`);await assert.rejects(roster(),/access denied/);
 console.log('Presentation SQL PGlite: stable server colors, departed-slot reuse, foreign scene/author denial and restrictive RLS passed; real Realtime not tested');
}finally{await db.close();}
