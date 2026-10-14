import assert from 'node:assert/strict';
import {runtime,fixture,clone,exactReplay} from './helpers/scene-contract-harness.mjs';

const {core,engine}=runtime();
let serial=0;
const event=(actorId,payload)=>({...core.command(actorId,payload),id:`attack-binding-${++serial}`,at:'2026-10-13T00:00:00.000Z'});
const apply=(scene,actorId,payload)=>core.dispatchMany(scene,[event(actorId,payload)]).scene;
function attack(scene){
  const prepared=core.prepare(scene,{kind:'action',actorId:'hero',actionId:engine.ACTION_IDS.skirmish,targetIds:['enemy'],eventId:`binding-skirmish-${++serial}`},{random:()=>.6});
  assert.equal(prepared.ok,true,prepared.errors?.join(' '));
  return core.dispatchMany(scene,prepared.events).scene;
}
let scene=fixture();scene.activeActorId=null;scene.turnSerial=0;
Object.assign(scene.actors[1],{kind:'hero',heroId:'enemy',x:2,focus:6});
scene=apply(scene,'hero',{kind:'turn-start'});scene=attack(scene);
const oldAttackId=scene.pendingAction.id;
scene=apply(scene,'hero',{kind:'cancel-attack',attackId:oldAttackId});
scene=apply(scene,'hero',{kind:'turn-end'});scene=apply(scene,'enemy',{kind:'turn-start'});scene=apply(scene,'enemy',{kind:'turn-end'});scene=apply(scene,null,{kind:'round-end'});scene=apply(scene,'hero',{kind:'turn-start'});scene=attack(scene);
const currentAttackId=scene.pendingAction.id;assert.notEqual(currentAttackId,oldAttackId);
for(const payload of [{kind:'reaction',attackId:oldAttackId,choice:'block',destination:{space:'main',x:2,y:2}},{kind:'resolve-attack',attackId:oldAttackId},{kind:'cancel-attack',attackId:oldAttackId}]){
  const before=clone(scene),actorId=payload.kind==='reaction'?'enemy':'hero';
  assert.throws(()=>core.dispatchMany(scene,[event(actorId,payload)]),/другой Атаке/,'delayed requests stay bound to the attack that presented them');
  assert.deepEqual(clone(scene),before,'rejected old attack identity cannot move, spend, resolve, cancel or append a receipt');
  const preview=core.prepare(scene,{...payload,actorId});assert.equal(preview.ok,false);
}
// Supplied identity is exact; malformed values cannot act like an omitted key.
for(const attackId of [null,42,{},''])assert.throws(()=>core.dispatchMany(scene,[event('enemy',{kind:'reaction',attackId,choice:'take'})]),/другой Атаке/);
const response=event('enemy',{kind:'reaction',attackId:currentAttackId,choice:'block',destination:{space:'main',x:2,y:2}}),beforeFocus=scene.actors[1].focus;
const answered=core.dispatchMany(scene,[response]);assert.equal(answered.scene.actors[1].focus,beforeFocus-2);assert.equal(answered.scene.pendingAction.id,currentAttackId);
exactReplay(core,answered.scene,[response]);
assert.deepEqual(clone(core.dispatchMany(core.reload(JSON.stringify(answered.scene)),[response]).scene),clone(answered.scene),'identity-bound receipt remains exactly replayable after reload');
scene=apply(answered.scene,'hero',{kind:'resolve-attack',attackId:currentAttackId});assert.equal(scene.pendingAction,null);
// Compatibility: old callers without an identity still use canonical gates.
const legacy=fixture();legacy.actors[1].x=2;
const pending=core.prepare(legacy,{kind:'attack',actorId:'hero',targetIds:['enemy'],amount:1});assert.equal(pending.ok,true);
const legacyScene=core.dispatchMany(legacy,pending.events).scene;
const legacyResponse=apply(legacyScene,'enemy',{kind:'reaction',choice:'take'});assert.equal(apply(legacyResponse,'hero',{kind:'resolve-attack'}).pendingAction,null);
console.log('LionWing attack binding: actual two-attack round cycle rejects old reaction/resolve/cancel before side effects; current stamped responses, immutable failures, reload/replay and unstamped compatibility passed');
