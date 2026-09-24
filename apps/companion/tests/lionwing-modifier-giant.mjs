import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context);
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:30,maxHp:30,ap:3,baseAp:3,tier:2,speed:4,armor:0,evasion:0,attrs:{body:3,talent:3,spirit:3,mind:3},effects:[],effectStates:{},usedActions:[],acted:false,knockedOut:false,lionwing:{},...extra});
let scene={rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:"host",tension:2,spaces:[{id:"main",width:8,height:7}],actors:[actor("host","enemy",1,1),actor("giant","enemy",0,0,{profileId:"lionwing.modifier.giant",hp:0,maxHp:0,ap:0,baseAp:0,hidden:true,modifierState:{}}),actor("pc","hero",3,1)],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"hero",lastActorId:"pc"}};
const commit=(events,prefix)=>{scene=engine.dispatchMany(scene,events.map((event,index)=>({...event,id:`${prefix}-${index}`}))).scene};
const config=engine.prepareModifierConfigure(scene,{actorId:"giant",carrierId:"host"});assert.equal(config.ok,true,config.errors?.join(" "));commit(config.events,"giant-config");
const host=()=>scene.actors.find(item=>item.id==="host"),pc=()=>scene.actors.find(item=>item.id==="pc");
assert.equal(host().occupiedWidth,2);assert.equal(host().occupiedHeight,2);
assert.equal(engine.effectiveActorStats(scene,"host").armor.value,2);assert.equal(engine.effectiveActorSpeed(scene,"host"),5);
const attack=engine.prepareModifierAction(scene,{actorId:"giant",action:"giant-charge",destination:{x:3,y:1}});assert.equal(attack.ok,true,attack.errors?.join(" "));commit(attack.events,"giant-attack");
assert.equal(host().x,3);assert.equal(host().ap,2,"Giant Attack spends one Host AP");
assert.equal(pc().effects.includes("negative.подброшен"),true,"crossed opponent is Launched");
assert.equal(pc().x<3||pc().x>4||pc().y<1||pc().y>2,true,"crossed opponent is pushed outside the new footprint");
const second=engine.prepareModifierAction(scene,{actorId:"giant",action:"giant-charge",destination:{x:4,y:1}});assert.equal(second.ok,true,second.errors?.join(" "));
let trapped={rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:"host",tension:0,spaces:[{id:"main",width:8,height:7}],actors:[actor("host","enemy",1,1),actor("giant","enemy",0,0,{profileId:"lionwing.modifier.giant",hp:0,maxHp:0,ap:0,baseAp:0,hidden:true,modifierState:{}}),actor("pc","hero",3,1)],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[]};
const trapConfig=engine.prepareModifierConfigure(trapped,{actorId:"giant",carrierId:"host"});assert.equal(trapConfig.ok,true);trapped=engine.dispatchMany(trapped,trapConfig.events.map((event,index)=>({...event,id:`trap-config-${index}`}))).scene;
const corridor=new Set(["1,1","2,1","3,1","4,1","1,2","2,2","3,2","4,2"]),sealed=[];for(let y=0;y<7;y++)for(let x=0;x<8;x++)if(!corridor.has(`${x},${y}`))sealed.push(`${x},${y}`);
trapped.objects.push({id:"sealed",space:"main",type:"terrain",cells:sealed,hp:999,maxHp:999});
assert.equal(engine.prepareModifierAction(trapped,{actorId:"giant",action:"giant-charge",destination:{x:3,y:1}}).ok,false,"Giant cannot charge through a target with no legal escape footprint");
console.log("LionWing Giant: footprint, Armor, Speed, charge, push and Launch passed");
