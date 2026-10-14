import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

// Preserve the released implementation as an independent behavior oracle.
// Query projections JSON-normalize their inputs, so exercise the actual private
// reader separately to cover accessor and numeric-coercion contracts precisely.
const original = a => {
  const rawValues = [a?.lionwing?.ownerTurnSerial, a?.lionwing?.ownTurnSerial, a?.lionwing?.turnCount, a?.lionwing?.turnsStarted, a?.lionwing?.turns]
    .map(value => Number(value)).filter(value => Number.isSafeInteger(value) && value >= 0);
  return rawValues.length ? Math.max(...rawValues) : 0;
};
const source=fs.readFileSync(new URL('../lionwing-engine.js',import.meta.url),'utf8');
const start=source.indexOf('  const readOwnTurnSerial = a => {'),end=source.indexOf('  function normalizeTurnCounters',start);
assert.ok(start>0&&end>start,'read the actual production private query reader');
const reader=vm.runInNewContext(`(()=>{${source.slice(start,end)}return readOwnTurnSerial;})()`,{Number,Math});
const aliases=['ownerTurnSerial','ownTurnSerial','turnCount','turnsStarted','turns'];
const check=(make,label)=>{
  const beforeTrace=[],afterTrace=[];let before,after,beforeError,afterError;
  try{before=original(make(beforeTrace));}catch(error){beforeError=error;}
  try{after=reader(make(afterTrace));}catch(error){afterError=error;}
  assert.deepEqual(afterTrace,beforeTrace,`${label}: accessor/coercion ordering`);
  if(beforeError){assert.ok(afterError,`${label}: retains the original exception`);assert.equal(afterError.name,beforeError.name);assert.equal(afterError.message,beforeError.message);}
  else{assert.equal(afterError,undefined,`${label}: no new exception`);assert.ok(Object.is(after,before),`${label}: exact scalar result including signed zero (${Object.is(before,-0)?'-0':String(before)})`);}
};
const values=[undefined,null,false,true,0,-0,-1,1,7,'','-0','0','5','bad','0x20','1e2',1.5,Infinity,-Infinity,NaN,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1,0n,-1n,5n,BigInt(Number.MAX_SAFE_INTEGER)+1n,Symbol('counter'),[],[2],[1,2],{}];
let samples=0;
for(const value of values)for(let slot=0;slot<5;slot++){
  check(()=>({lionwing:Object.fromEntries(aliases.map((name,index)=>[name,index===slot?value:undefined]))}),`one alias ${slot}/${String(value)}`);samples++;
}
for(let mask=0;mask<32;mask++){
  check(()=>Object.freeze({lionwing:Object.freeze(Object.fromEntries(aliases.map((name,index)=>[name,mask&(1<<index)?0:-0])))}),`signed zero mask ${mask}`);samples++;
}
for(let i=0;i<1500;i++){
  check(()=>({lionwing:Object.fromEntries(aliases.map((name,index)=>[name,values[(i*11+index*7)%values.length]]))}),`mixed aliases ${i}`);samples++;
}
for(const value of [undefined,null,false,true,0,-0,7,'actor',Symbol('actor'),4n,[],Object.freeze({}),{lionwing:null},{lionwing:[]},{lionwing:'state'}])check(()=>value,'null/primitive/frozen/array input');
check(trace=>{
  let reads=0;const states=aliases.map((name,index)=>Object.defineProperty({},name,{get(){trace.push(`get:${name}`);return{valueOf(){trace.push(`coerce:${index}`);return index;}};}}));
  return Object.defineProperty({},'lionwing',{get(){trace.push(`lionwing:${reads}`);return states[reads++];}});
},'different lionwing accessor object for all five raw reads');
check(trace=>{
  const state={};for(const [index,name]of aliases.entries())Object.defineProperty(state,name,{get(){trace.push(`get:${name}`);return{[Symbol.toPrimitive](hint){trace.push(`primitive:${index}:${hint}`);return index===0?9:index;}};}});
  return{lionwing:state};
},'Symbol.toPrimitive coercion hints and order');
check(trace=>{
  const state={ownerTurnSerial:{valueOf(){trace.push('coerce:first');state.ownTurnSerial=999;return 2;}},ownTurnSerial:{valueOf(){trace.push('coerce:captured-second');return 3;}},turnCount:4};
  for(const name of ['turnsStarted','turns'])Object.defineProperty(state,name,{get(){trace.push(`get:${name}`);return undefined;}});
  return{lionwing:state};
},'coercion mutates a later alias after its raw value was captured');
for(let throwingSlot=0;throwingSlot<5;throwingSlot++)for(const stage of ['getter','coercion']){
  check(trace=>{
    const state={};for(const [index,name]of aliases.entries())Object.defineProperty(state,name,{get(){trace.push(`get:${index}`);if(stage==='getter'&&index===throwingSlot)throw new RangeError(`getter:${index}`);return{valueOf(){trace.push(`coerce:${index}`);if(stage==='coercion'&&index===throwingSlot)throw new TypeError(`coercion:${index}`);return index;}};}});
    return{lionwing:state};
  },`${stage} failure at alias ${throwingSlot}`);
}
check(trace=>({lionwing:new Proxy(Object.freeze({ownerTurnSerial:-0,ownTurnSerial:2n}),{get(target,key,receiver){trace.push(String(key));return Reflect.get(target,key,receiver);}})}),'frozen proxy values');

// Canonical/public integration: normalization retains every alias, migrates the
// log, keeps lifetime/denial queries immutable and is current for same-object edits.
const {core,engine,context}=runtime(),scene=fixture();scene.actors[0].lionwing={turns:2,ownerTurnSerial:1};
scene.log=Array.from({length:3},(_,index)=>({id:`turn:${index}`,type:'turn.start',actorId:'hero',payload:{}}));
const saved=clone(scene),normalized=core.reload(scene);
for(const key of aliases)assert.equal(normalized.actors[0].lionwing[key],3,'all legacy/canonical aliases migrate from the event log');
assert.equal(core.turnIdentity(scene,'hero').ownerTurnSerial,3);assert.deepEqual(clone(scene),saved);
scene.actors[0].lionwing.ownerTurnSerial=7;assert.equal(core.turnIdentity(scene,'hero').ownerTurnSerial,7,'same-object changes are read immediately');
scene.actors[0].lionwing.denials=[{id:'denial',actionId:engine.ACTION_IDS.jump,scope:'turn',ownerTurnSerial:7,remaining:1}];
scene.lionwing.auras=[{id:'lifetime',ownerActorId:'hero',sourceEntityId:'hero',effectId:'positive.ускорен',shape:{distance:4},filter:{relation:'ally'},lifetime:{boundary:'startNextOwnerTurn',ownerActorId:'hero',ownerTurnSerial:6}}];
const frozenBefore=clone(scene);const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};freeze(scene);
assert.equal(core.actionGate(scene,'hero',{actionId:engine.ACTION_IDS.jump}).available,false);
assert.equal(context.window.DAWN_LIONWING_EFFECTIVE_EFFECT_ACTIVE(scene,'hero','positive.ускорен'),false);
assert.deepEqual(clone(scene),frozenBefore,'counter-dependent queries never write aliases into the caller');
console.log(`LionWing counter query: ${samples} exact scalar oracle cases, accessor/coercion errors and ordering, signed zero, Symbols/BigInt, frozen/legacy normalization and current immutable gates passed`);
