import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context),lw=context.window.DAWN_LIONWING_ENGINE;
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:30,maxHp:30,ap:1,baseAp:1,tier:2,speed:3,armor:0,evasion:0,attrs:{body:2,talent:2,spirit:3,mind:2},effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
let scene={rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:7,height:7}],actors:[actor("host","enemy",3,3),actor("vortex","enemy",0,0,{profileId:"lionwing.modifier.vortex",hp:0,maxHp:0,ap:0,baseAp:0,hidden:true,modifierState:{}}),actor("pc1","hero",1,1),actor("pc2","hero",2,1)],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"host"}};
const wrongSide=structuredClone(scene);wrongSide.actors.find(item=>item.id==="vortex").team="hero";
assert.equal(engine.prepareModifierConfigure(wrongSide,{actorId:"vortex",carrierId:"pc1"}).ok,false,"Vortex cannot attach on player side");
const plan=engine.prepareModifierConfigure(scene,{actorId:"vortex",carrierId:"host"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:`vortex-deploy-${index}`}))).scene;
assert.equal(engine.effectiveActorStats(scene,"host").armor.value,3,"Tier 2 Vortex grants three Armor");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"vortex",carrierId:"host"}).ok,false,"cannot attach twice");
scene.objects.push({id:"blocked-edge",type:"terrain",space:"main",cells:["2,0"],hp:10,maxHp:10});
const round=lw.dispatchMany(scene,[{...lw.command(null,{kind:"round-end"}),id:"vortex-round"}]);scene=round.scene;
const zones=scene.actors.filter(item=>item.crowdSubtype==="vortex"&&item.vortexOwnerId==="vortex");
assert.equal(zones.length,5,"LionWing Vortex creates five Zones");
assert.equal(zones.every(item=>item.x===0||item.y===0||item.x===6||item.y===6),true,"Zones spawn on farthest edges");
assert.equal(zones.some(item=>item.x===2&&item.y===0),false,"impassable edge terrain is skipped");
assert.equal(engine.fodderMoveStatus(scene,zones[0].id).available,false,"new Zone waits for allied Turn boundary");
scene=structuredClone(scene);
for(const [index,zone] of zones.slice(0,3).entries()){const target=scene.actors.find(item=>item.id===zone.id);target.x=2;target.y=index+2}
scene=lw.dispatchMany(scene,[{...lw.command("pc1",{kind:"turn-start"}),id:"vortex-pc-start"}]).scene;
scene=lw.dispatchMany(scene,[{...lw.command("pc1",{kind:"turn-end"}),id:"vortex-pc-end"}]).scene;
scene=lw.dispatchMany(scene,[{...lw.command("host",{kind:"turn-start"}),id:"vortex-host-start"}]).scene;
scene=lw.dispatchMany(scene,[{...lw.command("host",{kind:"turn-end"}),id:"vortex-host-end"}]).scene;
const first=zones[1].id,window=engine.fodderMoveStatus(scene,first);
assert.equal(window.available,true);
scene=engine.dispatchMany(scene,[{id:"vortex-touch-1",type:"actor.move",actorId:first,payload:{space:"main",x:3,y:3,placement:true,fodderMove:true,boundaryEventId:window.boundaryEventId}}]).scene;
assert.equal(scene.actors.find(item=>item.id===first).knockedOut,true);
assert.equal(scene.actors.find(item=>item.id==="host").armor,1);
assert.equal(scene.actors.find(item=>item.id==="vortex").modifierState.absorbed,1);
for(const [index,zone] of [zones[0],zones[2]].entries()){
  const status=engine.fodderMoveStatus(scene,zone.id);
  scene=engine.dispatchMany(scene,[{id:`vortex-touch-${index+2}`,type:"actor.move",actorId:zone.id,payload:{space:"main",x:3,y:3,placement:true,fodderMove:true,boundaryEventId:status.boundaryEventId}}]).scene;
}
assert.equal(scene.actors.find(item=>item.id==="vortex").modifierState.absorbed,3);
assert.equal(scene.actors.find(item=>item.id==="host").armor,3);
assert.equal(scene.actors.find(item=>item.id==="pc1").hp,6,"third absorption deals 24 damage to PCs");
assert.equal(scene.actors.find(item=>item.id==="pc2").hp,6);
console.log("LionWing Vortex: Host attachment, Armor and five edge Zones passed");
