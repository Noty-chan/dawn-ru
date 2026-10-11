import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {runtime,fixture,clone,exactReplay,rejectedWithoutMutation} from './helpers/scene-contract-harness.mjs';

const {context,engine,core,data}=runtime();
Object.assign(context,{setTimeout,clearTimeout,structuredClone});context.window.crypto=webcrypto;
for(const file of ['scene-table-policy.js','network-v2.js','localization.js','locale-ru.js','locale-en-builder.js'])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context,{filename:file});
context.window.DAWN_TABLE_POLICY.install(engine,core);
const network=context.window.DAWN_NETWORK_V2;
const fresh=(epoch=4)=>{const scene=fixture();scene.version=12;scene.tablePolicy={mode:'rules',epoch};scene.actors[0].ownerId='player';scene.actors[0].focus=2;return scene;};
const request={actorId:'hero',kind:'action',actionId:engine.ACTION_IDS.breathe};
const issued=scene=>{const prepared=core.prepare(scene,request);assert.equal(prepared.ok,true,prepared.errors?.join(' '));return network.intentFromEvents(scene,prepared.events,'Breathe');};
const materialize=(scene,intent)=>network.materializeIntent(scene,data,intent,'player',{sceneEngine:engine});
let scene=fresh();
const intent=issued(scene);assert.equal(intent.policyEpoch,4,'an event-derived rules intention binds its preparation epoch');
network.setConfirmedScene(scene);
const outbox=new network.PlayerOutbox({tickMs:10000,send:async()=>{}});
const direct={kind:'lionwing',actorId:'hero',request:clone(request)},envelope=outbox.enqueue(direct,scene.version);
assert.equal(envelope.intent.policyEpoch,4,'direct intentions bind the confirmed canonical policy at enqueue');
assert.equal(Object.hasOwn(direct,'policyEpoch'),false,'binding does not mutate the caller request');
const encoded=JSON.stringify(envelope);
const sameEpoch=clone(scene);sameEpoch.version++;sameEpoch.actors[1].hp--;
const packet=materialize(sameEpoch,intent),accepted=engine.dispatchMany(sameEpoch,packet).scene;
assert.equal(accepted.actors[0].ap,2,'an unrelated canonical change in the same epoch still permits current mechanical validation');
exactReplay(engine,accepted,packet);

// Change policies through allowed table commands. The live battle is preserved;
// an earlier intention must not be silently rebound to its new policy epoch.
scene=engine.dispatchMany(scene,[{id:'epoch-status-on',type:'table.command',actorId:null,payload:{kind:'policy',mode:'rules',processStatuses:true}}]).scene;
assert.equal(scene.tablePolicy.epoch,5);
scene=engine.dispatchMany(scene,[{id:'epoch-status-off',type:'table.command',actorId:null,payload:{kind:'policy',mode:'rules',processStatuses:false}}]).scene;
assert.equal(scene.tablePolicy.mode,'rules');assert.equal(scene.tablePolicy.epoch,6);
let prepares=0;
context.window.DAWN_LIONWING_ENGINE={...core,prepare(...args){prepares++;return core.prepare(...args);}};
const conflict=error=>error?.code==='TABLE_POLICY_CONFLICT';
for(const stale of [intent,envelope.intent])rejectedWithoutMutation(scene,()=>materialize(scene,stale),conflict);
assert.equal(prepares,0,'policy rejection occurs before rule preparation, resource work or random rolls');
assert.equal(JSON.stringify(envelope),encoded,'scope changes never rewrite the queued exact envelope');
network.setConfirmedScene(scene);
const stillStale=outbox.enqueue(intent,scene.version);assert.equal(stillStale.intent.policyEpoch,4,'enqueue preserves a supplied epoch instead of silently rebinding a stale draft');
rejectedWithoutMutation(scene,()=>materialize(scene,stillStale.intent),conflict);
const newDirect=outbox.enqueue(direct,scene.version);assert.equal(newDirect.intent.policyEpoch,6);
const current=issued(scene);assert.equal(current.policyEpoch,6);assert.equal(materialize(scene,current).length,1,'newly prepared actions use the new epoch');

// Old clients have no epoch field. They remain compatible only with an
// original rules table; their origin cannot be proven after a policy change.
const legacy=clone(intent);delete legacy.policyEpoch;
for(const initial of [fresh(0),(()=>{const value=fresh(0);delete value.tablePolicy;return value;})()])assert.equal(materialize(initial,legacy).length,1);
rejectedWithoutMutation(scene,()=>materialize(scene,legacy),conflict);
for(const invalid of [null,'6',-1,1.5,Number.MAX_SAFE_INTEGER+1,undefined])rejectedWithoutMutation(scene,()=>materialize(scene,{...current,policyEpoch:invalid}),conflict);
assert.equal(core.prepare(scene,request).ok,true,'the policy guard does not change standalone rule mechanics');
// A fresh manual table's real battle-start command also creates a new epoch.
// Resuming a frozen rules battle remains prohibited by the existing kernel.
const manual=fresh(5);manual.tablePolicy.mode='manual';manual.activeActorId=null;manual.turnSerial=0;
const started=engine.dispatchMany(manual,[{id:'fresh-start-rules',type:'table.command',actorId:null,payload:{kind:'start-rules',firstActorId:'hero',expectedVersion:manual.version,policyEpoch:5}}]).scene;
assert.equal(started.tablePolicy.epoch,6);rejectedWithoutMutation(started,()=>materialize(started,intent),conflict);
const startedIntent=network.intentFromEvents(started,[{type:'turn.end',actorId:'hero',payload:{}}],'End Turn');assert.equal(startedIntent.policyEpoch,6);
assert.ok(materialize(started,startedIntent).length,'new commands work after a fresh manual-to-rules start');
outbox.clear();
console.log('Rules policy epoch PASS: actual policy/start reducers, canonical binding, direct/event intentions, no stale rebind, rejection before preparation, unchanged snapshot/resources, exact packet replay and explicit epoch-zero legacy compatibility; no live transport');
