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
assert.equal(once.sessionClocks[0].kind,"counter");assert.equal(once.sessionClocks[0].size,2000);assert.equal(once.sessionClocks[0].value,7);
assert.deepEqual(twice,once,"reload is idempotent");assert.deepEqual(once.tablePolicy,scene.tablePolicy);assert.deepEqual(once.manualTable,scene.manualTable);
for(const field of ["manualStatuses","manualTechniqueState","manualMovementTrace","hp","focus","ap","knockedOut","x","y"])assert.deepEqual(once.actors[0][field],scene.actors[0][field],field);
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
