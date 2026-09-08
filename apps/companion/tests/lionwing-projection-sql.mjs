import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Optional local PostgreSQL runtime. No connection to a shared database is made.
// npm install --prefix output/qa-pg --no-audit --no-fund @electric-sql/pglite
const moduleUrl=process.env.DAWN_PGLITE_MODULE?pathToFileURL(process.env.DAWN_PGLITE_MODULE):new URL("../../../output/qa-pg/node_modules/@electric-sql/pglite/dist/index.js",import.meta.url);
const { PGlite }=await import(moduleUrl.href);
const db=new PGlite();
try {
  await db.exec("create table public.scenes(id text primary key,state jsonb,version integer); create table public.scene_public_snapshots(scene_id text,state jsonb,version integer,updated_at timestamptz);");
  const migration=fs.readFileSync(new URL("../../../supabase/migrations/202609080001_harden_lionwing_private_state.sql",import.meta.url),"utf8");
  await db.exec(migration);
  // Applying it twice must leave the same projection contract.
  await db.exec(migration);
  const source={rulesEdition:"lionwing",actors:[{id:"hero",attrs:{body:4},ownerId:"owner"},{id:"hidden",hidden:true}],
    turnUndo:[{secret:"snapshot"}],undo:[{}],redo:[{}],
    lionwing:{schema:1,history:[{details:{secret:"ledger"}}],receipts:[{fingerprint:"secret"}],deferred:[{secret:"tail"}],afterAttack:[{}],executionCursor:{secret:"cursor"},
      entities:{publicMarker:{visibility:"public",backing:{markerId:"visible-marker"}},hidden:{visibility:"hidden",backing:{actorId:"hidden"}}},actionPlans:[{id:"public-plan"}],turnFrames:[{id:"visible-frame"}],
      choices:[{id:"public",actorId:"hero",context:{}},{id:"hidden-choice",actorId:"hero",context:{duelId:"hidden-duel"}}],
      duels:[{id:"hidden-duel",actorId:"hero",targetId:"hidden"}],opportunities:[{actorId:"hero",targetId:"hidden"}]},
    pendingAction:{actorId:"hero",targetIds:["hero","hidden"],targetDamage:{hero:2,hidden:7},responses:{hero:{choice:"take"},hidden:{choice:"pending"}}},
    log:[{id:"visible",actorId:"hero"},{actorId:"hidden",payload:{name:"secret NPC"}},{visibility:"gm",payload:{note:"secret"}}]};
  const project=async value=>(await db.query("select public.public_scene_projection($1::jsonb) as state",[JSON.stringify(value)])).rows[0].state;
  const state=await project(source);
  for(const key of ["undo","redo","turnUndo"])assert.equal(Object.hasOwn(state,key),false);
  for(const key of ["history","receipts","deferred","afterAttack","executionCursor"])assert.equal(Object.hasOwn(state.lionwing,key),false,`${key} must stay private`);
  assert.deepEqual(Object.keys(state.lionwing.entities),["publicMarker"],"public entity gameplay data remains available without hidden entities");
  assert.equal(state.lionwing.actionPlans[0].id,"public-plan","non-private gameplay state is not removed speculatively");
  assert.equal(state.lionwing.turnFrames[0].id,"visible-frame","turn UI state remains available to players");
  assert.deepEqual(state.actors.map(a=>a.id),["hero"]);assert.equal(state.actors[0].attrs,undefined);
  assert.deepEqual(state.lionwing.choices.map(c=>c.id),["public"]);
  assert.deepEqual(state.lionwing.duels,[]);assert.deepEqual(state.lionwing.opportunities,[]);
  assert.deepEqual(state.pendingAction.targetDamage,{hero:2});assert.deepEqual(state.log.map(row=>row.id),["visible"]);
  const legacy=await project({...source,rulesEdition:"legacy",lionwing:undefined});
  assert.equal(legacy.rulesEdition,"legacy");assert.equal(legacy.lionwing,null);
  console.log("LionWing PostgreSQL projection: migration replay, pending responses, hidden Duel references, private history and public entity filtering passed");
} finally { await db.close(); }
