import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context);
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:30,maxHp:30,ap:0,baseAp:0,tier:2,speed:3,armor:0,evasion:team==="enemy"?2:0,effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:7,height:7}],actors:[
  actor("host","enemy",3,3),actor("earthquake","enemy",3,3,{profileId:"lionwing.modifier.earthquake",hp:0,maxHp:0,hidden:true,modifierState:{}}),
  actor("near","hero",3,1),actor("far","hero",3,0),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"host"}});
const commit=(scene,plan,prefix)=>engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();
let plan=engine.prepareModifierConfigure(scene,{actorId:"earthquake",carrierId:"host",mode:"inward"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"earthquake-configure");
assert.equal(engine.effectiveActorStats(scene,"host").evasion.value,17,"Tier 2 adds 15 Evasion");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"earthquake",carrierId:"host",mode:"outward"}).ok,false,"mode cannot be changed early");
scene=engine.dispatchMany(scene,[{id:"earthquake-round-1",type:"round.end",payload:{}}]).scene;
assert.equal(scene.actors.find(item=>item.id==="near").hp,30,"In excludes distance 2");
assert.equal(scene.actors.find(item=>item.id==="far").hp,27,"In includes distance 3");
assert.equal(scene.actors.find(item=>item.id==="earthquake").modifierState.mode,"outward","mode flips automatically");
assert.equal(engine.dispatchMany(scene,[{id:"earthquake-round-1",type:"round.end",payload:{}}]).scene.actors.find(item=>item.id==="earthquake").modifierState.mode,"outward","duplicate boundary does not flip twice");
assert.equal(scene.pendingPrompt==null,true,"mode flip requires no narrator prompt");
scene.actors.filter(item=>item.kind!=="crowd").forEach(item=>{item.acted=true});scene.lionwing.lastTeam="enemy";
scene=engine.dispatchMany(scene,[{id:"earthquake-round-2",type:"round.end",payload:{}}]).scene;
assert.equal(scene.actors.find(item=>item.id==="near").hp,26,"Out includes distance 2 and uses ended Tension 4");
assert.equal(scene.actors.find(item=>item.id==="far").hp,27,"Out excludes distance 3");
assert.equal(scene.actors.find(item=>item.id==="earthquake").modifierState.mode,"inward");
const stopped=structuredClone(scene);stopped.actors.find(item=>item.id==="host").knockedOut=true;
assert.equal(engine.effectiveActorStats(stopped,"host").evasion.value,2,"KO Host loses the modifier bonus");
const stacked=base();stacked.actors.push(actor("contagion","enemy",3,3,{profileId:"lionwing.modifier.contagion",hp:0,maxHp:0,hidden:true,modifierState:{}}));
const firstAttached=commit(stacked,engine.prepareModifierConfigure(stacked,{actorId:"earthquake",carrierId:"host",mode:"inward"}),"earthquake-stack");
const secondAttached=commit(firstAttached,engine.prepareModifierConfigure(firstAttached,{actorId:"contagion",carrierId:"host",targetId:"near"}),"contagion-stack");
assert.equal(engine.effectiveActorStats(secondAttached,"host").evasion.value,17,"same-stat modifier bonuses use the highest value");
const attacked=engine.dispatchMany(secondAttached,[{id:"stacked-evasion-hit",type:"damage.apply",actorId:"near",payload:{targetId:"host",amount:5,attack:true,sourceActionId:"manual.test"}}]).scene;
assert.equal(engine.effectiveActorStats(attacked,"host").evasion.value,12,"consuming the active Evasion bonus cannot reveal a fresh reserve from another modifier");
secondAttached.actors.find(item=>item.id==="earthquake").knockedOut=true;
assert.equal(engine.effectiveActorStats(secondAttached,"host").evasion.value,17,"the remaining source still grants its bonus");
console.log("LionWing Earthquake: Evasion, range boundary, automatic flip and KO source loss passed");
