import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {runtime,actor,fixture,clone} from './helpers/scene-contract-harness.mjs';
import {sceneEngineFiles} from './load-scene-engine.mjs';

const current=runtime(),{core,engine,context}=current,baselineRef='2501c8decf6eeaf234a95d96f310c7d4efff829e';
function baselineRuntime(){
  const ctx=vm.createContext({window:{},console});
  for(const file of ['data.js','edition-lionwing.js','lionwing-table-data.js','logic.js',...sceneEngineFiles]){
    const source=file==='lionwing-engine.js'?execFileSync('git',['show',`${baselineRef}:apps/companion/${file}`],{encoding:'utf8'}):fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
    vm.runInContext(source,ctx,{filename:file});
  }return{core:ctx.window.DAWN_LIONWING_ENGINE,engine:ctx.window.DAWN_SCENE_ENGINE};
}
const baseline=baselineRuntime();
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
function table(count=20){const scene=fixture();scene.spaces[0]={id:'main',width:12,height:12};for(let i=2;i<count;i++)scene.actors.push(actor(`actor-${i}`,i%2?'hero':'enemy',i%12,Math.floor(i/12)+3));scene.lionwing.history=Array.from({length:32},(_,i)=>({schema:1,id:`fact-${i}`,type:'apply',actorId:'hero',ownerActorId:'hero',sceneSerial:1,round:1,turnSerial:1,ruleId:'test.history',targetIds:['enemy']}));scene.lionwing.receipts=[{id:'canonical-receipt',fingerprint:'must-remain'}];scene.lionwing.boundaryReceipts=[{id:'boundary',ruleId:'test.rule',ownerActorId:'hero',boundaryKey:'1:hero:1:ownTurnStart'}];scene.log=[{id:'own-turn',type:'turn.start',actorId:'hero',payload:{},at:'2026-10-14T00:00:00.000Z'}];return scene;}
const request=(destination,payload={kind:'action',actionId:engine.ACTION_IDS.step,targetIds:[]},extra={})=>({actorId:'hero',payload,destination,...extra});
const cells=Array.from({length:144},(_,i)=>({space:'main',x:i%12,y:Math.floor(i/12)}));
let checked=0;
function oracle(scene,requests,label){
  const before=clone(scene),query=core.createDestinationQuery(freeze(scene));assert.ok(Object.isFrozen(query));
  for(const value of requests){const expected=clone(baseline.core.destinationStatus(clone(before),value));assert.deepEqual(clone(core.destinationStatus(scene,value)),expected,`${label}: default query retains released validator/reason`);assert.deepEqual(clone(query.status(value)),expected,`${label}: batch retains exact availability/reason`);checked++;}
  query.dispose();assert.deepEqual(clone(query.status({get destination(){throw Error('Disposed must not read requests');}})),{available:false,reason:''});query.dispose();assert.deepEqual(clone(scene),before,`${label}: source ledgers, receipts, actors and geometry stay immutable`);
}
const fixtures=[];
fixtures.push(['plain',table()]);
const terrain=table();terrain.objects=[{id:'terrain',type:'terrain',space:'main',cells:['2,1','2,2']},{id:'difficult',type:'difficult',space:'main',cells:['1,2']},{id:'high',type:'high',space:'main',cells:['3,1']}];terrain.walls=[{id:'wall',space:'main',a:'1,1',b:'1,2'}];terrain.topology={cuts:[{id:'cut',space:'main',cells:['3,2'],crossing:'blocked'}]};fixtures.push(['terrain/walls/topology/elevation',terrain]);
const continuation=table();continuation.actors[0].ap=0;continuation.actors[0].stepRemaining=3;continuation.actors[0].usedActions=[engine.ACTION_IDS.step];fixtures.push(['continuation',continuation]);
for(const effect of ['negative.обездвижен','negative.подброшен','positive.ускорен','positive.изгнан','positive.исчез']){const scene=table();scene.actors[0].effects=[effect];fixtures.push([effect,scene]);}
const swift=table();swift.actors[0].knownTechniques={'vagabond.speed-demon':2};swift.actors[0].techniques=swift.actors[0].knownTechniques;swift.actors[0].lionwing={automation:{'vagabond.speed-demon.2':true},history:[{actionId:engine.ACTION_IDS.breathe,turnSerial:1,ownerTurnInstanceId:'legacy-turn:1'}]};fixtures.push(['beforeAction Speed Demon',swift]);
const aura=table();aura.actors[0].lionwing={ownerTurnSerial:2};aura.lionwing.auras=[{id:'aura',ownerActorId:'hero',sourceEntityId:'hero',effectId:'positive.ускорен',shape:{distance:4},filter:{relation:'ally'},lifetime:{boundary:'endNextOwnerTurn',ownerActorId:'hero',ownerTurnSerial:2}}];fixtures.push(['aura/current owner lifetime',aura]);
const npc=table();Object.assign(npc.actors[0],{kind:'enemy',heroId:null,profileId:'lionwing.npc.assassin',team:'enemy'});fixtures.push(['native NPC Step',npc]);
const wide=table();wide.actors[0].occupiedWidth=2;wide.actors[0].occupiedHeight=2;fixtures.push(['large footprint',wide]);
for(const [label,scene]of fixtures)oracle(scene,cells.map(cell=>request(cell)),label);

// Several command families can use cell pickers. A batch never replaces their
// prepare/commit validators with movement or cached actor/action quotes.
for(const definition of context.window.DAWN_LIONWING_DATA.coreRules.actions.list){const scene=table(2);oracle(scene,[{space:'main',x:2,y:1},{space:'main',x:4,y:1},{space:'main',x:8,y:8}].map(cell=>request(cell,{kind:'action',actionId:definition.id,targetIds:['enemy'],attribute:'spirit'})),`native action ${definition.id}`);}
for(const archetype of context.window.DAWN_LIONWING_DATA.archetypes)for(const technique of archetype.techniques||[])for(const level of [1,2,3]){
  const scene=table(2),owner=scene.actors[0];owner.knownTechniques={[technique.id]:level};owner.techniques=owner.knownTechniques;owner.lionwing.automation=Object.fromEntries(context.window.DAWN_LIONWING_ADAPTERS.list(owner).map(row=>[row.id,true]));
  oracle(scene,[{space:'main',x:2,y:1},{space:'main',x:3,y:2},{space:'main',x:8,y:8}].map(cell=>request(cell)),`Step with ${technique.id}/${level}`);
}
const snared=table(2);snared.actors[0].effects=['negative.пойман'];snared.actors[0].effectStates={'negative.пойман':{sources:[{actorId:'enemy'}]}};oracle(snared,cells.slice(0,30).map(cell=>request(cell)),'source-bound Snared');
const reappearing=table(2);reappearing.actors[0].effects=['positive.исчез'];oracle(reappearing,cells.slice(0,30).map(cell=>request(cell,undefined,{field:'reappearance'})),'reappearance field');
const attackScene=fixture();attackScene.actors[1]=actor('defender','hero',2,1,{team:'enemy'});const attack=core.prepare(attackScene,{kind:'action',actorId:'hero',actionId:engine.ACTION_IDS.skirmish,targetIds:['defender']},{random:()=>0});assert.equal(attack.ok,true,attack.errors?.join(' '));
oracle(attack.scene,cells.slice(0,24).map(cell=>request(cell,{kind:'reaction',choice:'block',attackId:attack.scene.pendingAction.id},{actorId:'defender'})),'pending reaction movement');
const choicePrepared=core.prepare(fixture(),{kind:'effect',actorId:'enemy',targetId:'hero',effect:'negative.пойман'},{random:()=>0});assert.equal(choicePrepared.ok,true,choicePrepared.errors?.join(' '));const choice=choicePrepared.scene.lionwing.choices[0];assert.ok(choice);
oracle(choicePrepared.scene,cells.slice(0,24).map(cell=>request(cell,{kind:'choice',id:choice.id,choice:'place'})),'canonical placement choice');

// Cached metadata is lazy. Earlier field/board/actor/plan failures retain
// precedence even after another request cached a malformed-registry exception.
for(const mutate of [value=>{value.lionwing.compounds=[];},value=>{value.lionwing.diceRolls=[];},value=>{value.lionwing.information={studies:{}};},value=>{value.lionwing.executionCursor=[];},value=>{value.lionwing.meters={tension:{current:-1}};}]){
  const scene=table(2);mutate(scene);const requests=[request({space:'main',x:2,y:1}),request({space:'main',x:0,y:0},undefined,{field:'bad'}),request({space:'main',x:-1,y:0}),request({space:'main',x:0,y:0},undefined,{actorId:'absent'}),request({space:'main',x:0,y:0},{kind:'action',actionId:'absent'}),request({space:'main',x:2,y:1}),request({space:'main',x:0,y:0},{kind:'action',actionId:engine.ACTION_IDS.step,__trusted:true})];oracle(scene,requests,'malformed priority + cached failure');
  const pending=clone(scene);pending.pendingPrompt={id:'unresolved'};oracle(pending,[request({space:'main',x:2,y:1})],'pending work precedes normalization failure');
}
let ignored=0;const poison={toJSON(){ignored++;throw Error('Presentation state is not a query input');}},poisoned=table(2);poisoned.artworks=[poison];poisoned.undo=[poison];poisoned.redo=[poison];poisoned.turnUndo=[poison];for(const participant of poisoned.actors){participant.tokenImage=participant.portraitImage=participant.portraitUrl=poison;}
const clean=table(2),poisonQuery=core.createDestinationQuery(freeze(poisoned));assert.deepEqual(clone(poisonQuery.status(request({space:'main',x:2,y:1}))),clone(core.destinationStatus(clean,request({space:'main',x:2,y:1}))));poisonQuery.dispose();assert.equal(ignored,0);
const cycle=table(2);cycle.canonicalCycle=cycle;const cyclicQuery=core.createDestinationQuery(cycle);for(const value of [request({space:'main',x:0,y:0},undefined,{field:'bad'}),request({space:'main',x:2,y:1})])assert.deepEqual(clone(cyclicQuery.status(value)),clone(core.destinationStatus(cycle,value)),'source serialization errors retain first priority');cyclicQuery.dispose();

// Explicit snapshot lifetime: it stays at capture-time, while ordinary and
// newly created queries immediately observe same-object edits without versions.
const mutable=table(2),value=request({space:'main',x:2,y:1}),captured=core.createDestinationQuery(mutable),old=clone(captured.status(value));mutable.actors[0].ap=0;assert.deepEqual(clone(captured.status(value)),old);assert.equal(core.destinationStatus(mutable,value).available,false);const refreshed=core.createDestinationQuery(mutable);assert.deepEqual(clone(refreshed.status(value)),clone(core.destinationStatus(mutable,value)));captured.dispose();refreshed.dispose();
const resultScene=table(2),detached=core.createDestinationQuery(resultScene),result=detached.status(value);result.available=false;result.reason='forged';assert.deepEqual(clone(detached.status(value)),clone(core.destinationStatus(resultScene,value)),'caller mutations cannot poison the batch');detached.dispose();

// Mutable custom/replaced providers are evaluated through the original fresh
// copy path, including attempted preparation writes and live closure flags.
const originalAdapters=context.window.DAWN_LIONWING_ADAPTERS,originalInformation=context.window.DAWN_LIONWING_INFORMATION_QUERY;
let deny=false;const dynamicScene=table(2),dynamic=core.createDestinationQuery(dynamicScene);context.window.DAWN_LIONWING_ADAPTERS={...originalAdapters,actionStatus(owner){owner.lionwing.customProbe=(owner.lionwing.customProbe||0)+1;return{allowed:!deny,reason:'dynamic deny'};}};
for(const state of [false,true,false]){deny=state;assert.deepEqual(clone(dynamic.status(value)),clone(core.destinationStatus(dynamicScene,value)),'same provider/closure edits remain fresh and isolated');}
context.window.DAWN_LIONWING_ADAPTERS=originalAdapters;
let corrupt=false;context.window.DAWN_LIONWING_INFORMATION_QUERY={...originalInformation,ensureState(source){if(corrupt)throw Error('dynamic normalization');return originalInformation.ensureState(source);}};
for(const state of [false,true,false]){corrupt=state;assert.deepEqual(clone(dynamic.status(value)),clone(core.destinationStatus(dynamicScene,value)),'custom normalizer results and errors are never cached');}
context.window.DAWN_LIONWING_INFORMATION_QUERY=originalInformation;dynamic.dispose();
// Same native object, mutable exported configuration. Normalization cannot
// depend only on the shallow frozen API identity.
const meter=context.window.DAWN_LIONWING_COMBAT_METER,meterMethod=Object.getOwnPropertyDescriptor(meter,'ensureScene'),lowAp=table(2);lowAp.actors[0].ap=0;const meterQuery=core.createDestinationQuery(lowAp);
assert.deepEqual(clone(meterQuery.status(value)),clone(core.destinationStatus(lowAp,value)));
meter.ensureScene=()=>{throw Error('native mutable meter normalization');};
assert.deepEqual(clone(meterQuery.status(value)),clone(core.destinationStatus(lowAp,value)),'changed native normalizer failure precedes the unaffordable price even after metadata was cached');
Object.defineProperty(meter,'ensureScene',{get(){return()=>{throw Error('native meter accessor normalization');};},configurable:true});
assert.deepEqual(clone(meterQuery.status(value)),clone(core.destinationStatus(lowAp,value)),'normalizer accessor is not invoked by cache guards');
Object.defineProperty(meter,'ensureScene',meterMethod);assert.deepEqual(clone(meterQuery.status(value)),clone(core.destinationStatus(lowAp,value)),'native method A/B/accessor/A restoration');meterQuery.dispose();
const midQuery=core.createDestinationQuery(lowAp);midQuery.status(value);
const changesDuringRequest={...value,get field(){meter.ensureScene=()=>{throw Error('normalizer changed during request access');};return 'destination';}};
const midExpected=clone(core.destinationStatus(lowAp,changesDuringRequest));Object.defineProperty(meter,'ensureScene',meterMethod);assert.deepEqual(clone(midQuery.status(changesDuringRequest)),midExpected,'dependency changes after entry preserve the actual lazy gate error priority');Object.defineProperty(meter,'ensureScene',meterMethod);midQuery.dispose();
const inventory=context.window.DAWN_LIONWING_INVENTORY,setsQuery=core.createDestinationQuery(table(2));
for(const set of [inventory.VISIBILITY,inventory.BOUNDARIES]){
  const members=[...set],first=members[0];assert.deepEqual(clone(setsQuery.status(value)),clone(core.destinationStatus(table(2),value)));set.delete(first);set.add('test-mutated-membership');assert.deepEqual(clone(setsQuery.status(value)),clone(core.destinationStatus(table(2),value)),'same frozen API Set members remain live');set.clear();for(const member of members)set.add(member);
  Object.defineProperty(set,'size',{get(){throw Error('cache must not invoke exported Set accessors');},configurable:true});assert.deepEqual(clone(setsQuery.status(value)),clone(core.destinationStatus(table(2),value)),'Set accessors force fresh path without changing reason');delete set.size;
}
setsQuery.dispose();
const nativeNested=core.createDestinationQuery(table(2));assert.deepEqual(clone(nativeNested.status(value)),clone(core.destinationStatus(table(2),value)));
const infoRow=originalInformation.adapters[0],savedInfoRow=clone(infoRow);Object.assign(infoRow,{level:0,label:'changed native public row',sourceDigest:'changed'});originalInformation.adapters.push({id:'test.native-mutable-row',techniqueId:'test.technique',level:0,label:'added'});
assert.deepEqual(clone(nativeNested.status(value)),clone(core.destinationStatus(table(2),value)),'native frozen API mutable public rows remain fresh; they are not metadata normalizer inputs');originalInformation.adapters.pop();Object.assign(infoRow,savedInfoRow);
const restored=context.window.DAWN_LIONWING_RESTORED_TECHNIQUES,definition=restored.defs[0];restored.defs[0]={...definition,label:'changed native definition',sourceDigest:'changed'};assert.deepEqual(clone(nativeNested.status(value)),clone(core.destinationStatus(table(2),value)),'native frozen provider mutable definition-array entries are read by full validators');restored.defs[0]=definition;nativeNested.dispose();
const adapterDescriptor=Object.getOwnPropertyDescriptor(context.window,'DAWN_LIONWING_ADAPTERS'),getterQuery=core.createDestinationQuery(table(2));let providerReads=0;
Object.defineProperty(context.window,'DAWN_LIONWING_ADAPTERS',{get(){providerReads++;return originalAdapters;},configurable:true});providerReads=0;const getterExpected=clone(core.destinationStatus(table(2),value)),expectedReads=providerReads;providerReads=0;assert.deepEqual(clone(getterQuery.status(value)),getterExpected);assert.equal(providerReads,expectedReads,'provider accessor read count/order is not changed by native guards');Object.defineProperty(context.window,'DAWN_LIONWING_ADAPTERS',adapterDescriptor);assert.deepEqual(clone(getterQuery.status(value)),clone(core.destinationStatus(table(2),value)));getterQuery.dispose();
const step=context.window.DAWN_LIONWING_DATA.coreRules.actions.list.find(row=>row.id===engine.ACTION_IDS.step),oldCost=step.cost.amount,liveDefinitions=core.createDestinationQuery(table(2));
for(const amount of [oldCost,999,oldCost]){step.cost.amount=amount;assert.deepEqual(clone(liveDefinitions.status(value)),clone(core.destinationStatus(table(2),value)),'native catalogue values/quotes are read on every request');}step.cost.amount=oldCost;liveDefinitions.dispose();
console.log(`LionWing destination batch: ${checked} released full-validator/reason oracles, frozen sources, lazy malformed priority, actual reaction/choice paths, complete ledgers, detached outputs and dynamic provider fallback passed`);

if(process.argv.includes('--benchmark')){
  const scene=table();scene.artworks=[{id:'art',image:`data:image/png;base64,${'A'.repeat(100000)}`}];for(const participant of scene.actors)participant.tokenImage=`data:image/png;base64,${'B'.repeat(30000)}`;const saved=clone(scene);scene.undo=Array.from({length:20},()=>({state:saved}));scene.turnUndo=Array.from({length:10},()=>({state:saved}));scene.redo=[];const requests=cells.map(cell=>request(cell));
  const run=(mode)=>{if(mode==='baseline')return requests.map(value=>baseline.core.destinationStatus(scene,value));if(mode==='currentSingle')return requests.map(value=>core.destinationStatus(scene,value));const query=core.createDestinationQuery(scene);try{return requests.map(value=>query.status(value));}finally{query.dispose();}};
  const expected=clone(run('baseline')),times={baseline:[],currentSingle:[],batch:[]};for(const mode of Object.keys(times))assert.deepEqual(clone(run(mode)),expected);
  for(let sample=0;sample<7;sample++)for(const mode of sample%2?Object.keys(times).reverse():Object.keys(times)){const start=performance.now(),answers=run(mode);times[mode].push(performance.now()-start);assert.deepEqual(clone(answers),expected);}
  console.log(JSON.stringify({baselineRef,workload:'actual144destinationStatus/prepare/commit;12x12/20actors;32fullcanonical facts+receipts;100KBart+20x30KBportraits/20undo/10turnUndo; batch construction/freezing/disposal included',rows:Object.entries(times).map(([mode,samples])=>{samples.sort((a,b)=>a-b);return{mode,samples:7,medianMs:+samples[3].toFixed(2),maxMs:+samples[6].toFixed(2)};})},null,2));
}
