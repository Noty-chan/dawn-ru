import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migrations=new URL('../../../supabase/migrations/',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,migrations),'utf8');
const db=new PGlite();
try{
  await db.exec('create table public.scenes(id text primary key,version bigint,state jsonb);create table public.scene_public_snapshots(scene_id text primary key,version bigint,state jsonb,updated_at timestamptz);');
  await db.exec(read('202609080001_harden_lionwing_private_state.sql'));
  const state={version:9,actors:[{id:'visible',hidden:false},{id:'secret',hidden:true}],sessionClocks:[{id:'public',manual:true,ownerActorId:null,name:'Public'},{id:'owned',manual:true,ownerActorId:'visible',name:'Visible'},{id:'private-clock',manual:true,ownerActorId:'secret',name:'Hidden ritual plan'},{id:'orphan',manual:true,ownerActorId:'missing',name:'Missing owner'},{id:'legacy',name:'Legacy'}],manualTable:{actorId:'secret',round:2},eventReceipts:[{secret:'receipt'}],log:[{id:'private-event',type:'table.command',payload:{kind:'clock/set',id:'private-clock',value:4}},{id:'public-event',type:'table.command',payload:{kind:'clock/set',id:'public',value:2}}]};
  await db.query('insert into public.scenes values($1,$2,$3::jsonb)',['test',9,JSON.stringify(state)]);
  await db.exec("insert into public.scene_public_snapshots select id,version,public.public_scene_projection(state),now() from public.scenes;");
  const before=(await db.query('select state from public.scene_public_snapshots')).rows[0].state;
  assert.equal(before.sessionClocks.length,5,'baseline reproduces raw public snapshot leak');
  const migration=read('202610080001_manual_table_public_records.sql');
  await db.exec(migration);
  const projected=(await db.query('select state from public.scene_public_snapshots')).rows[0].state;
  assert.deepEqual(projected.sessionClocks.map(c=>c.id),['public','owned','legacy']);
  assert.equal(projected.manualTable.actorId,null);assert.equal(projected.manualTable.round,2);
  assert.equal(projected.eventReceipts,undefined);
  assert.deepEqual(projected.log.map(e=>e.id),['public-event'],'old public event referencing private clock is removed');
  assert.ok(!JSON.stringify(projected).includes('Hidden ritual plan'));
  assert.equal((await db.query('select state from public.scenes')).rows[0].state.sessionClocks.length,5,'authoritative data untouched');
  await db.exec(migration);
  assert.deepEqual((await db.query('select state from public.scene_public_snapshots')).rows[0].state,projected,'repeat migration remains stable');
  console.log('Manual table SQL projection: raw leak reproduced, hidden/orphan clocks filtered, pointer/receipts private, backfill and repeat apply passed');
}finally{await db.close()}
