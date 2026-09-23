import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context),data=context.window.DAWN_DATA;
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:30,maxHp:30,ap:0,baseAp:0,tier:2,speed:3,armor:0,evasion:team==="enemy"?2:0,effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:7,height:7}],actors:[
  actor("host","enemy",5,5),actor("contagion","enemy",5,5,{profileId:"lionwing.modifier.contagion",hp:0,maxHp:0,hidden:true,modifierState:{}}),
  actor("anchor","hero",1,1),actor("near","hero",3,1),actor("far","hero",6,0),actor("other","hero",1,3),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"host"}});
const commit=(scene,plan,prefix)=>engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();scene.actors.find(item=>item.id==="near").armor=3;scene.actors.push(actor("token","hero",2,1,{kind:"token"}));scene.actors.push(actor("ally-npc","hero",2,2,{profileId:"lionwing.npc.bruiser"}));
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"contagion",carrierId:"host",targetId:"token"}).ok,false,"token cannot be an anchor");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"contagion",carrierId:"host",targetId:"ally-npc"}).ok,false,"allied NPC cannot be an anchor");
let plan=engine.prepareModifierConfigure(scene,{actorId:"contagion",carrierId:"host",targetId:"anchor"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"contagion-configure");
assert.equal(engine.effectiveActorStats(scene,"host").evasion.value,17,"Tier 2 adds 15 Evasion to the Host");
assert.equal(engine.compoundEnemyStatus(scene,"host").active,false,"attachment is not a Compound");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"contagion",carrierId:"host",targetId:"near"}).ok,false,"anchor changes only after Round end");
scene=engine.dispatchMany(scene,[{id:"contagion-round-1",type:"round.end",payload:{}}]).scene;
assert.equal(scene.actors.find(item=>item.id==="near").hp,27,"passive Tension damage bypasses Attack-only Armor");
assert.equal(scene.actors.find(item=>item.id==="other").hp,27,"distance 2 is in range");
assert.equal(scene.actors.find(item=>item.id==="far").hp,30,"distance 5 is out of range");
assert.equal(scene.actors.find(item=>item.id==="anchor").hp,30,"anchor is excluded");
assert.equal(scene.pendingPrompt?.kind,"modifier-refresh");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"contagion",carrierId:"host",targetId:"anchor"}).ok,false,"next anchor must be another player");
plan=engine.prepareModifierConfigure(scene,{actorId:"contagion",carrierId:"host",targetId:"near"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"contagion-refresh");
const answer=engine.respondRulePrompt(scene,data,{choice:"confirm"});
assert.equal(answer.ok,true,answer.errors?.join(" "));
scene=commit(scene,answer,"contagion-confirm");
assert.equal(scene.actors.find(item=>item.id==="host").lionwing.modifiers.filter(item=>item.ruleId==="lionwing.modifier.contagion").length,1,"refresh does not stack Evasion twice");
const evasionScene=base();evasionScene.actors.find(item=>item.id==="near").lionwing={modifiers:[{id:"temporary-evasion",stat:"evasion",amount:5,remaining:5,boundary:"scene"}]};
const evasionConfigured=commit(evasionScene,engine.prepareModifierConfigure(evasionScene,{actorId:"contagion",carrierId:"host",targetId:"anchor"}),"contagion-evasion");
const evasionRound=engine.dispatchMany(evasionConfigured,[{id:"contagion-evasion-round",type:"round.end",payload:{}}]).scene;
assert.equal(evasionRound.actors.find(item=>item.id==="near").hp,30,"passive damage consumes temporary Evasion before Health");
assert.equal(evasionRound.actors.find(item=>item.id==="near").lionwing.modifiers[0].remaining,2);
const stopped=structuredClone(scene);stopped.actors.find(item=>item.id==="contagion").knockedOut=true;
assert.equal(engine.effectiveActorStats(stopped,"host").evasion.value,2,"source loss removes the bonus");
console.log("LionWing Contagion: player anchor, Evasion, damage, refresh and source loss passed");
