import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context),data=context.window.DAWN_DATA;
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:30,maxHp:30,ap:0,baseAp:0,tier:2,speed:3,armor:0,evasion:0,effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:7,height:7}],actors:[
  actor("host","enemy",5,5),actor("isolation","enemy",5,5,{profileId:"lionwing.modifier.isolation",hp:0,maxHp:0,hidden:true,modifierState:{}}),
  actor("anchor","hero",1,1),actor("near","hero",2,1),actor("far","hero",6,0),actor("near2","hero",1,2),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"host"}});
const commit=(scene,plan,prefix)=>engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"isolation",targetId:"anchor"}).ok,false,"Isolation needs a deployed Host");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"isolation",carrierId:"host",targetId:"host"}).ok,false,"the anchor must be a player character");
let plan=engine.prepareModifierConfigure(scene,{actorId:"isolation",carrierId:"host",targetId:"anchor"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"isolation-configure");
assert.equal(scene.actors.find(item=>item.id==="isolation").modifierState.carrierId,"host");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"isolation",carrierId:"host",targetId:"near"}).ok,false,"the anchor cannot change before Round end");
scene=engine.dispatchMany(scene,[{id:"isolation-round-1",type:"round.end",payload:{}}]).scene;
assert.equal(scene.round,2,"LionWing round lifecycle remains authoritative");
assert.equal(scene.actors.find(item=>item.id==="near").hp,22,"Tier 2, four players and two recipients deal 8 each");
assert.equal(scene.actors.find(item=>item.id==="near2").hp,22);
assert.equal(scene.actors.find(item=>item.id==="anchor").hp,30);
assert.equal(scene.actors.find(item=>item.id==="far").hp,30);
assert.equal(scene.pendingPrompt?.kind,"modifier-refresh");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"isolation",carrierId:"host",targetId:"anchor"}).ok,false,"next round requires a different anchor");
plan=engine.prepareModifierConfigure(scene,{actorId:"isolation",carrierId:"host",targetId:"near"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"isolation-refresh");
const answer=engine.respondRulePrompt(scene,data,{choice:"confirm"});
assert.equal(answer.ok,true,answer.errors?.join(" "));
scene=commit(scene,answer,"isolation-confirm");
assert.equal(scene.pendingPrompt,null);
const stopped=structuredClone(scene);stopped.actors.find(item=>item.id==="host").knockedOut=true;
stopped.lionwing.lastTeam="enemy";stopped.actors.filter(item=>item.kind!=="crowd").forEach(item=>{item.acted=true});
const health=stopped.actors.find(item=>item.id==="anchor").hp;
const afterKo=engine.dispatchMany(stopped,[{id:"isolation-round-2",type:"round.end",payload:{}}]).scene;
assert.equal(afterKo.actors.find(item=>item.id==="anchor").hp,health,"a knocked-out Host disables Isolation");
assert.equal(afterKo.pendingPrompt,null,"a disabled Isolation does not ask for a new anchor");
const divided=base();divided.actors.find(item=>item.id==="far").x=2;divided.actors.find(item=>item.id==="far").y=2;
const dividedConfigured=commit(divided,engine.prepareModifierConfigure(divided,{actorId:"isolation",carrierId:"host",targetId:"anchor"}),"isolation-divided");
const dividedRound=engine.dispatchMany(dividedConfigured,[{id:"isolation-divided-round",type:"round.end",payload:{}}]).scene;
assert.equal(dividedRound.actors.find(item=>item.id==="far").hp,24,"16 damage divided among three recipients rounds up to 6 each");
console.log("LionWing Isolation: Host, anchor, damage division, refresh and KO lifecycle passed");
