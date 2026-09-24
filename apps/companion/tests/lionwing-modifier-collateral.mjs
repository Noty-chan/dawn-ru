import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context);
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:20,maxHp:20,ap:1,baseAp:1,tier:2,speed:3,armor:0,evasion:0,attrs:{body:2,talent:2,spirit:3,mind:2},effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:7,height:7}],actors:[
  actor("foe","enemy",5,5),actor("collateral","enemy",0,0,{profileId:"lionwing.modifier.collateral",hp:7,maxHp:7,ap:0,baseAp:0,hidden:true,modifierState:{}}),
  actor("p1","hero",1,1),actor("p2","hero",2,1),actor("p3","hero",1,2),actor("p4","hero",2,2),
  actor("ally-npc","hero",6,1,{profileId:"lionwing.npc.bruiser"}),actor("token","hero",6,2,{kind:"token"}),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"foe"}});
const cells=["0,4","1,4","2,4","3,4","4,4","6,4"];
const commit=(scene,plan,prefix)=>engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:event.id||`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"collateral",cells:cells.slice(1)}).ok,false,"four PCs require six casualties");
const plan=engine.prepareModifierConfigure(scene,{actorId:"collateral",cells});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"collateral-deploy");
const victims=scene.actors.filter(item=>item.profileId==="lionwing.modifier.collateral");
assert.equal(victims.length,6,"all six casualties are placed");
assert.equal(victims.every(item=>item.hp===7&&item.maxHp===7&&item.ap===0&&!item.hidden),true,"Tier 2 casualties have 7 HP and no Turns");
assert.equal(scene.sessionClocks.find(item=>item.ruleId==="lionwing.modifier.collateral")?.size,4,"clock has one segment per PC");
const protectedScene=structuredClone(scene);protectedScene.actors.find(item=>item.id==="p1").x=4;protectedScene.actors.find(item=>item.id==="p1").y=3;
assert.equal(engine.effectTargetingStatus(protectedScene,"foe",victims[4].id).available,false,"adjacent PC protects a casualty");
protectedScene.actors.find(item=>item.id==="p1").x=1;protectedScene.actors.find(item=>item.id==="p1").y=1;
protectedScene.actors.find(item=>item.id==="ally-npc").x=4;protectedScene.actors.find(item=>item.id==="ally-npc").y=3;
assert.equal(engine.effectTargetingStatus(protectedScene,"foe",victims[4].id).available,true,"unowned allied NPC does not protect casualty");
const rescueScene=structuredClone(scene);rescueScene.actors.find(item=>item.id==="p1").x=0;rescueScene.actors.find(item=>item.id==="p1").y=3;
const roll={formula:"3D6 · Дух",rolls:[4,4,4],successes:3,crits:0};
assert.equal(engine.prepareCollateralRescue(rescueScene,{collateralId:"collateral",rescuerId:"ally-npc",roll}).ok,false,"allied NPC cannot rescue");
assert.equal(engine.prepareCollateralRescue(rescueScene,{collateralId:"collateral",rescuerId:"p1",roll:{...roll,rolls:[4,4],successes:2}}).ok,false,"Spirit determines dice count");
const rescue=engine.prepareCollateralRescue(rescueScene,{collateralId:"collateral",rescuerId:"p1",roll});
assert.equal(rescue.ok,true,rescue.errors?.join(" "));
assert.throws(()=>commit(rescueScene,{events:rescue.events.slice(1)},"rescue-without-ap"),/Спасение Случайной жертвы/);
assert.throws(()=>commit(rescueScene,{events:rescue.events.map(event=>event.type==="roll.public"?{...event,payload:{...event.payload,rolls:[1,1,1],successes:3}}:event)},"rescue-forged-roll"),/Спасение Случайной жертвы/);
const rescued=commit(rescueScene,rescue,"collateral-rescue");
assert.equal(rescued.actors.some(item=>item.id==="collateral"),false,"successful Interact safely removes casualty");
assert.equal(rescued.sessionClocks.find(item=>item.ruleId==="lionwing.modifier.collateral").value,0,"safe removal does not advance Peril");
let casualties=scene;
for(let index=0;index<4;index++)casualties=engine.dispatchMany(casualties,[{id:`collateral-ko-${index}`,type:"actor.knockout",actorId:"foe",payload:{targetId:victims[index].id,sourceActionId:"manual.test"}}]).scene;
assert.equal(casualties.sessionClocks.find(item=>item.ruleId==="lionwing.modifier.collateral").value,4);
assert.equal(casualties.actors.filter(item=>item.kind==="hero"&&!item.profileId).every(item=>item.knockedOut),true,"full Peril clock defeats only PCs");
assert.equal(casualties.actors.find(item=>item.id==="ally-npc").knockedOut,false);
console.log("LionWing Collateral: PC count, deployment HP, Spirit rescue, Peril clock and defeat passed");
