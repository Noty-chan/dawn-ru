import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","logic.js"])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
loadSceneEngine(context);
const Engine=context.window.DAWN_LIONWING_ENGINE;
const actor=(id,team="hero",x=0,y=0,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",heroId:team==="hero"?id:null,rulesEdition:"lionwing",team,space:"main",x,y,hp:10,maxHp:10,ap:3,baseAp:3,focus:2,influence:2,wounds:0,stress:0,tier:1,speed:4,armor:0,evasion:0,attrs:{body:2,talent:2,spirit:2,mind:2},effects:[],effectStates:{},usedActions:[],acted:false,knockedOut:false,lionwing:{},...extra});
const fixture=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:0,spaces:[{id:"main",width:7,height:7},{id:"other",width:7,height:7}],objects:[],walls:[],markers:[],log:[],targetIds:[],targetCells:[],actors:[actor("owner","hero",0,0),actor("ally","hero",1,0),actor("enemy","enemy",0,1),actor("edge","hero",4,0),actor("far","hero",4,4)]});
const run=(scene,actorId,payload,id)=>Engine.dispatchMany(scene,[{id,type:"lionwing.command",actorId,payload}]).scene;
const create=(scene,actorId,id,sourceEntityId="m1",extra={})=>run(scene,actorId,{kind:"aura",operation:"create",id,ownerActorId:"owner",sourceEntityId,ruleId:"test.aura",effectId:"positive.укреплен",shape:{kind:"radius",distance:1},filter:{relation:"ally"},lifetime:"scene",...extra},id);

let scene=fixture();
scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"},{id:"m2",space:"main",x:2,y:0,kind:"mark"}];
const objectLifetime=Engine.auraRecord(scene,{id:"aura:object-lifetime",ownerActorId:"owner",sourceEntityId:"m1",ruleId:"test.aura",effectId:"positive.укреплен",shape:{kind:"radius",distance:1},filter:{relation:"ally"},lifetime:{boundary:"scene"}});
assert.equal(objectLifetime.lifetime,"scene","the serializable named lifetime boundary is accepted");
scene=create(scene,"owner","aura:one");
scene=create(scene,"owner","aura:two","m2");
assert.equal(scene.actors.find(item=>item.id==="ally").effects.includes("positive.укреплен"),false,"computed aura never copies into actor.effects");
let status=Engine.effectInstanceStatus(scene,"ally","positive.укреплен");
assert.equal(status.present,true,"an ally on the radius boundary is active");
assert.equal(context.window.DAWN_SCENE_ENGINE.effectDefenseStatus(scene,"ally").armorBonus,1,"shared effect queries include computed aura effects");
assert.equal(JSON.stringify(status.auraSources.map(source=>source.sourceId)),JSON.stringify(["aura:one","aura:two"]),"two identical overlapping auras remain two independent sources");
assert.equal(Engine.effectInstanceStatus(scene,"edge","positive.укреплен").present,false,"a target beyond the radius is inactive");
assert.equal(Engine.effectInstanceStatus(scene,"enemy","positive.укреплен").present,false,"an enemy is excluded by ally filter");
const enemyAura=Engine.auraRecord(scene,{id:"aura:enemy-check",ownerActorId:"owner",sourceEntityId:"m1",ruleId:"test.aura",effectId:"positive.укреплен",shape:{kind:"radius",distance:1},filter:{relation:"enemy"},lifetime:"scene"});
assert.equal(Engine.auraStatus(scene,enemyAura,scene.actors.find(item=>item.id==="enemy")).active,true,"the enemy relation includes an enemy at the radius boundary");
const beforeQuery=JSON.stringify(scene),query=Engine.activeState(scene,"ally","positive.укреплен");
assert.equal(query.present,true);assert.equal(JSON.stringify(scene),beforeQuery,"active-state query does not mutate Scene");
const beforeRejected=JSON.stringify(scene);
assert.throws(()=>run(scene,"owner",{kind:"aura",operation:"update",id:"aura:one",shape:{kind:"square",distance:1}},"invalid-aura-update"),/только shape\.kind=radius/);
assert.throws(()=>Engine.auraRecord(scene,{id:"aura:foreign-lifetime",ownerActorId:"owner",sourceEntityId:"m1",ruleId:"test.aura",effectId:"positive.укреплен",shape:{kind:"radius",distance:1},filter:{relation:"ally"},lifetime:{boundary:"startNextOwnerTurn",ownerActorId:"enemy",ownerTurnSerial:0,sceneSerial:1}}),/Владелец срока ауры/);
assert.equal(JSON.stringify(scene),beforeRejected,"a rejected aura transition is atomic");

scene=Engine.dispatchMany(scene,[{id:"move-marker-one",type:"marker.move",actorId:"owner",payload:{markerId:"m1",space:"main",x:5,y:5}}]).scene;
status=Engine.effectInstanceStatus(scene,"ally","positive.укреплен");
assert.equal(status.present,true,"leaving one aura preserves the second source");
assert.equal(status.activeSources.filter(source=>source.aura).length,1,"only the overlapping aura that still covers the target remains active");
scene=Engine.dispatchMany(scene,[{id:"move-marker-two-other",type:"marker.move",actorId:"owner",payload:{markerId:"m2",space:"other",x:0,y:0}}]).scene;
assert.equal(Engine.effectInstanceStatus(scene,"ally","positive.укреплен").present,false,"a source in another space is inactive");
scene=Engine.dispatchMany(scene,[{id:"move-marker-two-back",type:"marker.move",actorId:"owner",payload:{markerId:"m2",space:"main",x:2,y:0}}]).scene;
assert.equal(Engine.effectInstanceStatus(scene,"ally","positive.укреплен").present,true,"moving the source back recomputes the aura without a reapply");

scene=run(scene,"owner",{kind:"aura",operation:"suppress",id:"aura:two",suppressionId:"shield"},"suppress-aura");
assert.equal(Engine.effectInstanceStatus(scene,"ally","positive.укреплен").present,false,"suppression disables an aura source");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:two"),true,"suppression does not remove the aura");
scene=run(scene,"owner",{kind:"aura",operation:"restore",id:"aura:two",suppressionId:"shield"},"restore-aura");
assert.equal(Engine.effectInstanceStatus(scene,"ally","positive.укреплен").present,true,"restoration reactivates the same aura source");
assert.throws(()=>run(scene,"owner",{kind:"aura",operation:"remove",id:"aura:two"},"remove-protected"),/нельзя снять вручную/,"removable=false is the safe default");
assert.throws(()=>run(scene,"owner",{kind:"aura",operation:"remove",id:"aura:two",force:true},"force-remove-protected"),/нельзя снять вручную/,"a player-owned payload cannot forge the narrator force channel");
assert.throws(()=>run(scene,"owner",{kind:"aura",operation:"expire",id:"aura:two"},"forge-aura-expiry"),/только ядро или Нарратор/,"a player cannot forge a lifecycle expiry");
scene=run(scene,"owner",{kind:"aura",operation:"update",id:"aura:two",shape:{kind:"radius",distance:2},removable:true},"update-aura");
assert.equal(scene.lionwing.auras.find(aura=>aura.id==="aura:two").shape.distance,2,"update changes the validated shape atomically");
scene=run(scene,"owner",{kind:"aura",operation:"remove",id:"aura:two"},"remove-aura");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:two"),false,"a removable aura can be removed by its owner");

scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"}];scene=create(scene,"owner","aura:ko","m1",{sourceLossPolicy:"disable",removable:true});
scene=run(scene,"owner",{kind:"knockout",targetId:"owner"},"ko-source");
status=Engine.effectInstanceStatus(scene,"ally","positive.укреплен");
assert.equal(status.present,false,"KO disables the aura under the explicit conservative policy");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:ko"),true,"disable policy keeps source state for reload/recovery");
assert.throws(()=>create(scene,"owner","missing-source","missing"),/отсутствует/,"creation rejects a missing source entity");
scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"}];scene=create(scene,"owner","aura:remove-on-ko","m1",{sourceLossPolicy:"remove",removable:true});
scene=run(scene,"owner",{kind:"knockout",targetId:"owner"},"ko-remove-source");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:remove-on-ko"),false,"an explicit remove policy deletes on KO");

scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"}];scene=create(scene,"owner","aura:remove-on-correction","m1",{sourceLossPolicy:"remove",removable:true});
scene=run(scene,null,{kind:"correct",targetId:"owner",resource:"knockedOut",amount:1},"correct-ko-source");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:remove-on-correction"),false,"Narrator KO correction applies the aura source-loss policy");

scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"}];scene=create(scene,"owner","aura:remove-on-marker-loss","m1",{sourceLossPolicy:"remove",removable:true});
scene=Engine.dispatchMany(scene,[{id:"remove-aura-marker",type:"marker.remove",actorId:"owner",payload:{markerId:"m1"}}]).scene;
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:remove-on-marker-loss"),false,"an explicit remove policy deletes when a marker source is removed");
scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"}];scene=create(scene,"owner","aura:disable-on-marker-loss","m1",{removable:true});
scene=Engine.dispatchMany(scene,[{id:"remove-disabled-marker",type:"marker.remove",actorId:"owner",payload:{markerId:"m1"}}]).scene;
status=Engine.effectInstanceStatus(scene,"ally","positive.укреплен");
assert.equal(status.present,false,"a missing source makes the default-disable aura inactive");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:disable-on-marker-loss"),true,"the default-disable aura remains serialized after source loss");
assert.match(status.auraSources[0].reason,/отсутствует/,"the active-state query exposes the missing source reason");

scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"hidden",hidden:true,duration:"persistent"}];scene=create(scene,"owner","aura:hidden-source","m1",{lifetime:"persistent",removable:true});
const playerProjection=context.window.DAWN_SCENE_ENGINE.projectScene(scene,{role:"player",actorIds:["ally"]});
assert.equal(playerProjection.markers.some(marker=>marker.id==="m1"),false);
assert.equal(playerProjection.lionwing.auras.some(aura=>aura.id==="aura:hidden-source"),false,"an aura cannot reveal its hidden marker source");

scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark",duration:"scene"}];scene=create(scene,"owner","aura:reset-source-loss","m1",{lifetime:"persistent",sourceLossPolicy:"remove",removable:true});
scene=run(scene,null,{kind:"scene-reset"},"reset-aura-source");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:reset-source-loss"),false,"Scene reset removes a persistent aura when its non-persistent source is lost");

const replayScene=fixture();replayScene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"}];
const replayEvent={id:"replay-aura",type:"lionwing.command",actorId:"owner",payload:{kind:"aura",operation:"create",id:"aura:replay",ownerActorId:"owner",sourceEntityId:"m1",ruleId:"test.aura",effectId:"positive.укреплен",shape:{kind:"radius",distance:1},filter:{relation:"ally"},lifetime:"scene",removable:true}};
const replayed=Engine.dispatchMany(replayScene,[replayEvent]).scene,replayAgain=Engine.dispatchMany(replayed,[replayEvent]).scene;
assert.deepEqual(replayAgain,replayed,"replaying the same aura command is idempotent");
assert.throws(()=>run(replayed,"enemy",{kind:"aura",operation:"update",id:"aura:replay",shape:{kind:"radius",distance:2}},"foreign-aura-update"),/только её владельцу|владельцу/,"a foreign player payload cannot update another actor's aura");
assert.throws(()=>run(replayed,"enemy",{kind:"aura",operation:"update",id:"aura:replay",sourceActorId:"owner",shape:{kind:"radius",distance:2}},"forged-source-aura-update"),/только её владельцу|владельцу/,"a player cannot forge ownership through sourceActorId");

const appContext={console,crypto:{randomUUID:()=>"normalized-id"},APP_SCHEMA:14,contentPreferences:{edition:"ru-v0.9"},uid:()=>"normalized-id",clamp:(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0)),cleanArray:value=>Array.isArray(value)?value.filter(item=>typeof item==="string"):[]};
vm.createContext(appContext);
const appSource=fs.readFileSync(new URL("../app-core.js",import.meta.url),"utf8");
vm.runInContext(appSource.slice(appSource.indexOf("function blankScene()"),appSource.indexOf("function normalizeScene(raw)")),appContext,{filename:"app-core.scene-normalizer.js"});
const normalized=vm.runInContext(`sceneCore(${JSON.stringify(replayed)})`,appContext),undo=vm.runInContext(`sceneCore(${JSON.stringify(normalized)})`,appContext);
assert.equal(normalized.lionwing.auras[0].id,"aura:replay","JSON reload keeps the aura ID and metadata");
assert.deepEqual(undo.lionwing.auras,normalized.lionwing.auras,"undo snapshot keeps the declarative aura unchanged");
const boundaryReload=structuredClone(replayed);
boundaryReload.lionwing.auras[0].lifetime={schema:1,kind:"turn-boundary",boundary:"startNextOwnerTurn",ownerActorId:"owner",ownerTurnSerial:3,ownerTurnKey:"1:owner:3",sceneSerial:1,ownerTurnInstanceId:"owner-turn-3"};
const normalizedBoundary=vm.runInContext(`sceneCore(${JSON.stringify(boundaryReload)})`,appContext);
assert.equal(JSON.stringify(normalizedBoundary.lionwing.auras[0].lifetime),JSON.stringify(boundaryReload.lionwing.auras[0].lifetime),"reload preserves an aura's owner-turn lifetime descriptor instead of flattening it to a name");
const ownerMissing=structuredClone(replayed);ownerMissing.actors=ownerMissing.actors.filter(actor=>actor.id!=="owner");
const normalizedOwnerMissing=vm.runInContext(`sceneCore(${JSON.stringify(ownerMissing)})`,appContext);
assert.equal(normalizedOwnerMissing.lionwing.auras.length,1,"reload preserves an aura whose owner is temporarily missing for the disable policy");

scene=fixture();scene.markers=[{id:"m1",space:"main",x:0,y:0,kind:"mark"}];scene=create(scene,"owner","aura:round","m1",{lifetime:"round",removable:true});scene.actors.forEach(actor=>{actor.acted=true});scene.lionwing.started=true;scene.lionwing.lastTeam="enemy";
scene=run(scene,null,{kind:"round-end"},"round-end-aura");
assert.equal(scene.lionwing.auras.some(aura=>aura.id==="aura:round"),false,"a round aura expires atomically at the round boundary");

vm.runInContext(fs.readFileSync(new URL("../network-v2.js",import.meta.url),"utf8"),context);
assert.throws(()=>context.window.DAWN_NETWORK_V2.materializeIntent(replayed,context.window.DAWN_DATA,{kind:"lionwing",actorId:"enemy",request:{kind:"aura",operation:"remove",id:"aura:replay"}},"player"),/Нарратору|LionWing|владеет/i,"network players cannot forge aura commands");

console.log("LionWing static auras: active-state query, overlap, geometry, relation, suppression, lifecycle, reload, replay and rights passed");
