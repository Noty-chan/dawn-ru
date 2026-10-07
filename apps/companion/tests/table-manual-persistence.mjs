import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const context = vm.createContext({window:{},structuredClone, console, uid:()=>"new-id", APP_SCHEMA:14,
 contentPreferences:{edition:"lionwing"}, cleanArray:v=>Array.isArray(v)?v.filter(x=>typeof x==="string"):[],
 clamp:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),
 SceneEngine:{bodyguardsBraceIntact:()=>{throw Error("manual read must not run Brace mechanics");}}});
vm.runInContext(read("scene-table-policy.js"),context);
const source=read("app-core.js");
vm.runInContext(source.slice(source.indexOf("function blankScene()"),source.indexOf("function addEnemyDeploymentPassives")),context);
const plain=v=>JSON.parse(JSON.stringify(v));
assert.equal(context.blankScene().tablePolicy.mode,"manual","new scene opts into manual");
assert.equal(context.sceneCore({}).tablePolicy.mode,"rules","old save remains rules");
const scene=plain(context.blankScene());
scene.tablePolicy={mode:"manual",processStatuses:true,epoch:4};scene.manualTable={actorId:"a",round:8};
scene.actors=[{id:"a",kind:"enemy",profileId:"lionwing.npc.bodyguards",rulesEdition:"lionwing",space:"main",name:"A",x:1,y:1,hp:0,maxHp:11,focus:7,ap:2,baseAp:3,knockedOut:false,compoundId:"pair",effects:["snare"],manualStatuses:["effect.snare"],manualTechniqueState:{"rule.test":true},manualMovementTrace:{eventId:"move",from:{space:"main",x:0,y:0},to:{space:"main",x:1,y:1}},ruleState:{bodyguardsBrace:{zoneIds:["b"]}}},
{id:"b",kind:"enemy",profileId:"lionwing.npc.viper",rulesEdition:"lionwing",space:"main",name:"B",x:5,y:5,hp:0,maxHp:12,knockedOut:false,compoundId:"pair",effects:[]}];
const once=plain(context.normalizeScene(scene)),twice=plain(context.normalizeScene(once));
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
console.log("manual persistence/read contracts passed");
