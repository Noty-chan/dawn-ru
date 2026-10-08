import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from './load-scene-engine.mjs';
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const context = vm.createContext({window:{},structuredClone, console, uid:()=>"new-id", APP_SCHEMA:14,
 contentPreferences:{edition:"lionwing"}, cleanArray:v=>Array.isArray(v)?v.filter(x=>typeof x==="string"):[],
 clamp:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),
 SceneEngine:{bodyguardsBraceIntact:()=>{throw Error("manual read must not run Brace mechanics");}}});
vm.runInContext(read("scene-table-policy.js"),context);
const source=read("app-core.js");
vm.runInContext(source.slice(source.indexOf("function blankScene()"),source.indexOf("function addEnemyDeploymentPassives")),context);
vm.runInContext(source.slice(source.indexOf("function addEnemyDeploymentPassives"),source.indexOf("function validateTableEdit")),context);
assert.equal(context.addEnemyDeploymentPassives({tablePolicy:{mode:'manual'},actors:[]},{id:'npc'}).length,0,'manual participant creation never calls deployment mechanics');
const plain=v=>JSON.parse(JSON.stringify(v));
assert.equal(context.blankScene().tablePolicy.mode,"manual","new scene opts into manual");
assert.equal(context.sceneCore({}).tablePolicy.mode,"rules","old save remains rules");
const scene=plain(context.blankScene());
assert.deepEqual(scene.eventReceipts,[],'a fresh table has the same empty ledger as its normalized snapshot');
assert.equal(context.window.DAWN_TABLE_POLICY.validateSnapshot(scene,context.sceneCore(scene)),true,'first metadata edit on a fresh manual table is accepted');
const full=plain(scene);full.actors=Array.from({length:120},(_,i)=>({id:`existing-${i}`}));
const tooMany=plain(full);tooMany.actors.push({id:'extra'});
assert.throws(()=>context.window.DAWN_TABLE_POLICY.validateSnapshot(full,tooMany),e=>e.code==='TABLE_CAPACITY','metadata adds must reject before normalization silently drops actors');
const duplicate=plain(scene);duplicate.actors=[{id:'same'},{id:'same'}];
assert.throws(()=>context.window.DAWN_TABLE_POLICY.validateSnapshot(scene,duplicate),e=>e.code==='TABLE_COMMAND_INVALID');
scene.tablePolicy={mode:"manual",processStatuses:true,epoch:4};scene.manualTable={actorId:"a",round:8};
scene.actors=[{id:"a",kind:"enemy",profileId:"lionwing.npc.bodyguards",rulesEdition:"lionwing",space:"main",name:"A",x:1,y:1,hp:0,maxHp:11,focus:7,ap:2,baseAp:3,knockedOut:false,compoundId:"pair",effects:["snare"],manualStatuses:["effect.snare"],manualTechniqueState:{"rule.test":true},manualMovementTrace:{eventId:"move",from:{space:"main",x:0,y:0},to:{space:"main",x:1,y:1}},ruleState:{bodyguardsBrace:{zoneIds:["b"]}}},
{id:"b",kind:"enemy",profileId:"lionwing.npc.viper",rulesEdition:"lionwing",space:"main",name:"B",x:5,y:5,hp:0,maxHp:12,knockedOut:false,compoundId:"pair",effects:[]}];
scene.objects=[{id:"manual-area",space:"main",type:"manual-area",manual:true,ownerActorId:"a",cells:["1,1"],hidden:true,color:"#6fc9d8"}];
scene.sessionClocks=[{id:"manual-clock",name:"Counter",kind:"counter",manual:true,ownerActorId:"a",size:2000,value:7,current:7}];
const once=plain(context.normalizeScene(scene)),twice=plain(context.normalizeScene(once));
const orphan=plain(scene);orphan.actors=[];
const orphanReload=plain(context.normalizeScene(orphan));
assert.equal(orphanReload.sessionClocks[0].ownerActorId,'a','deleted owner does not make a personal clock public');
assert.equal(orphanReload.objects[0].ownerActorId,'a','deleted owner does not make an informational area public');
assert.equal(once.objects[0].type,"manual-area","informational area does not become mechanical terrain");
assert.equal(once.objects[0].manual,true);assert.equal(once.objects[0].ownerActorId,"a");assert.equal(once.objects[0].hidden,true);
assert.equal(once.sessionClocks[0].manual,true,"next clock/set can recognize a reloaded manual clock");
assert.equal(once.sessionClocks[0].ownerActorId,"a","owner permission survives reload");
const longClock=plain(scene);longClock.sessionClocks[0].id='c'.repeat(160);longClock.sessionClocks[0].name='N'.repeat(160);
const longReload=plain(context.normalizeScene(longClock));assert.equal(longReload.sessionClocks[0].id,longClock.sessionClocks[0].id);assert.equal(longReload.sessionClocks[0].name,longClock.sessionClocks[0].name);assert.equal(longReload.sessionClocks[0].manual,true);assert.equal(longReload.sessionClocks[0].ownerActorId,'a');

assert.equal(once.sessionClocks[0].kind,"counter");assert.equal(once.sessionClocks[0].size,2000);assert.equal(once.sessionClocks[0].value,7);
assert.deepEqual(twice,once,"reload is idempotent");assert.deepEqual(once.tablePolicy,scene.tablePolicy);assert.deepEqual(once.manualTable,scene.manualTable);
const frozenPointer=plain(scene);frozenPointer.activeActorId='deleted-combat-actor';assert.equal(context.normalizeScene(frozenPointer).activeActorId,'deleted-combat-actor','manual normalization cannot reset a frozen combat pointer after storage-only deletion');
for(const field of ["manualStatuses","manualTechniqueState","manualMovementTrace","hp","focus","ap","knockedOut","x","y"])assert.deepEqual(once.actors[0][field],scene.actors[0][field],field);
assert.equal(once.actors[0].focus,7,'manual NPC Focus is preserved rather than reset as a rule default');
assert.equal(once.actors[1].x,5,"compound positions stay independent");assert.equal(once.actors[1].knockedOut,false,"HP zero does not derive KO");assert.deepEqual(once.actors[1].effects,[],"compound does not spread status");
assert.deepEqual(once.actors[0].ruleState.bodyguardsBrace,{zoneIds:["b"]});
context.Scene=once;context.S={id:"hero"};context.pendingCoreActorId=null;let writes=0;context.persist=()=>writes++;
once.actors[0].heroId="hero";
vm.runInContext(read("scene-actions-ui.js").split("function coreActionActor()")[0],context);
const before=plain(context.Scene);
assert.equal(context.currentHeroActor(),context.Scene.actors[0]);assert.equal(context.currentHeroActor(),context.Scene.actors[0]);
assert.deepEqual(plain(context.heroActorState({id:"hero",name:"renamed",runtime:{hp:99}},context.Scene.actors[0])),before.actors[0]);
assert.deepEqual(plain(context.Scene),before,"read cannot change actor/runtime");assert.equal(writes,0);
const kernelContext={window:{},console};vm.createContext(kernelContext);
for(const file of ['data.js','edition-lionwing.js','logic.js'])vm.runInContext(read(file),kernelContext);
loadSceneEngine(kernelContext);
const changed=kernelContext.window.DAWN_TABLE_POLICY.dispatchMany(twice,[
  {id:'clock-after-reload',type:'table.command',actorId:'a',payload:{kind:'clock/set',id:'manual-clock',value:8}},
  {id:'area-after-reload',type:'table.command',actorId:'a',payload:{kind:'area/remove',id:'manual-area'}}
]).scene;
assert.equal(changed.sessionClocks[0].value,8,'actual clock command works after reload');
assert.equal(changed.objects.length,0,'actual informational removal works after reload');
assert.equal(changed.actors[0].hp,twice.actors[0].hp,'manual area removal does not execute mechanics');
console.log("manual persistence/read contracts passed");

// Execute the visible manual crowd button against real normalization and guards.
{
const fresh=context.normalizeScene(context.blankScene()),nodes=new Map();let serial=0;
context.Scene=fresh;context.uid=()=>`crowd-${++serial}`;context.$=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)};
context.quickCrowdSettings=()=>({name:'Manual crowd',count:3,styleId:'mob',style:{symbol:'M',color:'#112233'},team:'enemy'});
context.activeSceneSpace=()=>context.Scene.spaces[0];context.toast=()=>null;context.renderScene=()=>{};context.setScenePanel=()=>{};
context.commitSceneEvents=()=>{throw Error('manual crowd must not dispatch actor.spawn mechanics')};
context.commitScene=(label,mutator)=>{const before=context.sceneCore(context.Scene);mutator(context.Scene);context.window.DAWN_TABLE_POLICY.validateSnapshot(before,context.Scene);context.Scene=context.normalizeScene(context.Scene);return {ok:true}};
const events=read('app-scene-events.js'),start=events.indexOf('$("scene-add-crowd-auto").onclick'),end=events.indexOf('$("scene-add-crowd-brush").onclick',start);
vm.runInContext(events.slice(start,end),context);context.$('scene-add-crowd-auto').onclick();
assert.equal(context.Scene.actors.length,3);assert.equal(new Set(context.Scene.actors.map(a=>a.id)).size,3);
assert.ok(context.Scene.actors.every(a=>a.kind==='crowd'&&a.hp===1&&a.maxHp===1&&a.ap===0));
assert.equal(context.Scene.tablePolicy.mode,'manual');assert.equal(context.Scene.turnSerial,0);
}

// Manual modifiers are stored profiles, not automatic rule activations.
{
const nodes=new Map();context.$=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)};
context.$('scene-enemy-tier').value='1';context.$('scene-enemy-team').value='enemy';
context.antagonistTrait=()=>null;context.placeActorsSafely=()=>{};
context.enemyActorFromProfile=profile=>({id:context.uid(),profileId:profile.id,name:profile.name,kind:'enemy',team:'enemy',space:'main',hp:1,maxHp:1,ap:3,baseAp:3,x:0,y:0,effects:[]});
context.SceneEngine.prepareModifierConfigure=()=>{throw Error('manual modifier cannot activate mechanics')};
const notices=[];context.toast=message=>notices.push(message);
const events=read('app-scene-events.js'),start=events.indexOf('$("scene-add-enemy").onclick'),end=events.indexOf('\n',start);
vm.runInContext(events.slice(start,end),context);
for(const id of ['lionwing.modifier.vip','lionwing.modifier.artillery']){
 context.Scene=context.normalizeScene(context.blankScene());context.Scene.tool='select';context.Scene.targetIds=[];
 context.enemyProfile=()=>({id,name:'Manual modifier'});context.$('scene-add-enemy').onclick();
 assert.equal(context.Scene.actors.length,1);assert.equal(context.Scene.tool,'select');assert.deepEqual(Array.from(context.Scene.targetIds),[]);assert.equal(notices.length,0);
}
context.commitScene=()=>null;context.$('scene-add-enemy').onclick();assert.equal(context.Scene.actors.length,1);assert.equal(notices.length,0,'refused write has no activation message');
}

// Real reinforcement route must not report success after a capacity refusal.
{
const library=read('gm-library.js'),start=library.indexOf('function deployEncounter(encounter,'),end=library.indexOf('const deployEncounterBase',start);
vm.runInContext(library.slice(start,end),context);
context.Scene=context.normalizeScene(context.blankScene());
context.Scene.actors=Array.from({length:120},(_,i)=>({id:`full-${i}`,kind:'enemy',space:'main',x:0,y:0}));
context.encounterTemplateActorForReinforcement=()=>null;context.availableEncounterCell=()=>({x:1,y:1});
context.enemyProfile=()=>({id:'lionwing.npc.assassin',name:'A'});
let committed=false;const notices=[];context.toast=message=>notices.push(message);
context.commitScene=(label,mutator)=>{const before=context.sceneCore(context.Scene),candidate=JSON.parse(JSON.stringify(context.Scene));mutator(candidate);try{context.window.DAWN_TABLE_POLICY.validateSnapshot(before,candidate)}catch(error){context.toast(error.message);return null}committed=true;context.Scene=candidate;return {ok:true}};
context.deployEncounter({edition:'lionwing',name:'Reinforcement',enemies:[{profileId:'lionwing.npc.assassin',tier:1}]});
assert.equal(committed,false);assert.equal(context.Scene.actors.length,120);assert.equal(notices.length,1);assert.ok(!notices.some(message=>message.includes('готовы')),'refused reinforcement has no success toast');
const resetStart=library.indexOf('function resetDeployedLionwingTension(');vm.runInContext(library.slice(resetStart,start),context);
context.lwSubmit=()=>{throw Error('manual preset cannot reset a mechanical meter')};context.window.DAWN_LIONWING_ENGINE={isScene:()=>true};context.resetDeployedLionwingTension();
}
