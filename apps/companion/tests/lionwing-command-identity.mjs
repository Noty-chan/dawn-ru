import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,fixture,clone,exactReplay,rejectedWithoutMutation} from './helpers/scene-contract-harness.mjs';

const {context,engine,core,data}=runtime();
vm.runInContext(fs.readFileSync(new URL('../scene-table-policy.js',import.meta.url),'utf8'),context);
context.window.DAWN_TABLE_POLICY.install(engine,core);
vm.runInContext(fs.readFileSync(new URL('../network-v2.js',import.meta.url),'utf8'),context);
const network=context.window.DAWN_NETWORK_V2;
const fresh=()=>{const scene=fixture();scene.tablePolicy={mode:'rules',epoch:4};scene.actors[0].ownerId='player';return scene;};
const prepare=(scene,request)=>{
  const before=clone(scene),result=core.prepare(scene,{actorId:'hero',...request});
  assert.deepEqual(clone(scene),before,'preparation never changes the source');
  assert.equal(result.ok,true,result.errors?.join(' '));
  return result.events;
};
let scene=fresh();
const configure=prepare(scene,{kind:'inventory',operation:'configure',id:'ammo',inventoryKind:'stack',label:'Ammo',initial:0,current:3,maximum:3,ruleId:'test.identity',sourceDigest:'a'.repeat(64),resetAt:'scene',lifetime:'scene'});
assert.notEqual(configure[0].id,'ammo','an item ID does not identify its configure invocation');
scene=engine.dispatchMany(scene,configure).scene;
const first=prepare(scene,{kind:'inventory',operation:'spend',id:'ammo',amount:1});
scene=engine.dispatchMany(scene,first).scene;
assert.equal(scene.actors[0].lionwing.inventory.records.ammo.count,2);
const second=prepare(scene,{kind:'inventory',operation:'spend',id:'ammo',amount:1});
assert.notEqual(first[0].id,second[0].id,'separate intentional spends have different invocation IDs');
assert.equal(second[0].payload.id,'ammo','the requested item ID is preserved');
scene=engine.dispatchMany(scene,second).scene;
assert.equal(scene.actors[0].lionwing.inventory.records.ammo.count,1);
assert.equal(scene.log.filter(row=>row.type==='inventory.spend').length,2);
exactReplay(engine,scene,first,{expectedVersion:0});
exactReplay(engine,core.reload(JSON.stringify(scene)),second);

// Both the local UI and the authority materializer use prepare without an
// explicit invocation ID. Neither can substitute the persistent item ID.
let networkScene=engine.dispatchMany(fresh(),configure).scene;
const networkPackets=[];
for(let index=0;index<2;index++){
  const local=prepare(networkScene,{kind:'inventory',operation:'spend',id:'ammo',amount:1});
  const intent=network.intentFromEvents(networkScene,local,'Spend ammo');
  const authoritative=network.materializeIntent(networkScene,data,intent,'player',{sceneEngine:engine});
  networkPackets.push(authoritative);
  networkScene=engine.dispatchMany(networkScene,authoritative).scene;
}
assert.equal(networkScene.actors[0].lionwing.inventory.records.ammo.count,1);
assert.notEqual(networkPackets[0][0].id,networkPackets[1][0].id);
exactReplay(engine,networkScene,networkPackets[0]);
exactReplay(engine,core.reload(JSON.stringify(networkScene)),networkPackets[1]);
rejectedWithoutMutation(networkScene,()=>network.materializeIntent(networkScene,data,{kind:'lionwing',actorId:'enemy',request:{kind:'inventory',operation:'spend',id:'ammo',amount:1}},'player',{sceneEngine:engine}),/владеет/i);
const exhausted=prepare(networkScene,{kind:'inventory',operation:'spend',id:'ammo',amount:1});
networkScene=engine.dispatchMany(networkScene,exhausted).scene;
const denied=core.prepare(networkScene,{actorId:'hero',kind:'inventory',operation:'spend',id:'ammo',amount:1});
assert.equal(denied.ok,false,'a third valid spend exhausts the stack; a fourth is rejected');
assert.equal(networkScene.actors[0].lionwing.inventory.records.ammo.count,0);

let clocks=fresh();
const clockOne=prepare(clocks,{kind:'clock',id:'progress',label:'Progress',size:4,value:1});
clocks=engine.dispatchMany(clocks,clockOne).scene;
const clockTwo=prepare(clocks,{kind:'clock',id:'progress',label:'Progress',size:4,value:2});
clocks=engine.dispatchMany(clocks,clockTwo).scene;
assert.notEqual(clockOne[0].id,clockTwo[0].id);
assert.equal(clocks.actors[0].ruleClocks.progress.value,2);
exactReplay(engine,core.reload(JSON.stringify(clocks)),clockOne);

// Explicit event/command identities still establish exact replay and conflict.
const explicit=prepare(clocks,{kind:'clock',id:'progress',label:'Progress',size:4,value:3,eventId:'clock-command-3'});
assert.equal(explicit[0].id,'clock-command-3');
clocks=engine.dispatchMany(clocks,explicit).scene;
exactReplay(engine,clocks,explicit);
const altered=clone(explicit);altered[0].payload.value=4;
rejectedWithoutMutation(clocks,()=>engine.dispatchMany(clocks,altered),/Конфликт ID/i);
const conflictingPreview=core.prepare(clocks,{actorId:'hero',kind:'clock',id:'progress',label:'Progress',size:4,value:4,eventId:'clock-command-3'});
assert.equal(conflictingPreview.ok,false);
const commandId=prepare(clocks,{kind:'clock',id:'progress',label:'Progress',size:4,value:4,commandId:'clock-command-4'});
assert.equal(commandId[0].id,'clock-command-4');
clocks=engine.dispatchMany(clocks,commandId).scene;
exactReplay(engine,core.reload(JSON.stringify(clocks)),commandId);
console.log('LionWing command identity PASS: independent item/clock operations, local and authority preparation, immutable preview, ownership/resource rejection, explicit IDs, exact lost-ack replay, conflicts and JSON reload; real kernel, no live transport');
