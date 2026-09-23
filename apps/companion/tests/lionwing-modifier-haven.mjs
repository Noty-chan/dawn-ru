import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context),data=context.window.DAWN_DATA;
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:20,maxHp:20,ap:0,baseAp:0,tier:2,speed:3,armor:0,evasion:0,effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:7,height:7}],actors:[
  actor("foe","enemy",5,5),actor("haven","enemy",5,5,{profileId:"lionwing.modifier.haven",hp:0,maxHp:0,hidden:true,modifierState:{}}),
  actor("inside","hero",1,1),actor("outside","hero",6,0),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"foe"}});
const cells=(left,top)=>Array.from({length:9},(_,i)=>`${left+i%3},${top+Math.floor(i/3)}`);
const commit=(scene,plan,prefix)=>engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"haven",cells:cells(0,0).slice(1)}).ok,false,"Haven requires an exact 3×3 Zone");
let plan=engine.prepareModifierConfigure(scene,{actorId:"haven",cells:cells(0,0)});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"haven-configure");
assert.equal(scene.objects.find(item=>item.metadata?.enemyModifier==="haven")?.cells.length,9);
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"haven",cells:cells(3,3)}).ok,false,"the Zone moves only after Round end");
const foreignPrompt=structuredClone(scene);foreignPrompt.pendingPrompt={kind:"modifier-refresh",sourceActorId:"foe"};
assert.equal(engine.prepareModifierConfigure(foreignPrompt,{actorId:"haven",cells:cells(3,3)}).ok,false,"another actor's prompt cannot authorize a zone move");
scene=engine.dispatchMany(scene,[{id:"haven-round-1",type:"round.end",payload:{}}]).scene;
assert.equal(scene.actors.find(item=>item.id==="inside").hp,20,"the marked Zone is safe");
assert.equal(scene.actors.find(item=>item.id==="outside").hp,17,"outside takes the ended Round's Tension");
assert.equal(scene.pendingPrompt?.kind,"modifier-refresh");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"haven",cells:cells(0,0)}).ok,false,"refresh requires a new Zone");
plan=engine.prepareModifierConfigure(scene,{actorId:"haven",cells:cells(3,3)});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"haven-new-zone");
const answer=engine.respondRulePrompt(scene,data,{choice:"confirm"});
assert.equal(answer.ok,true,answer.errors?.join(" "));
scene=commit(scene,answer,"haven-confirm");
assert.equal(scene.pendingPrompt,null);
assert.equal(scene.objects.find(item=>item.metadata?.enemyModifier==="haven")?.cells.includes("3,3"),true);
const defeated=base();defeated.actors.find(item=>item.id==="foe").knockedOut=true;
const defeatedConfigured=commit(defeated,engine.prepareModifierConfigure(defeated,{actorId:"haven",cells:cells(0,0)}),"haven-defeated");
const defeatedRound=engine.dispatchMany(defeatedConfigured,[{id:"haven-defeated-round",type:"round.end",payload:{}}]).scene;
assert.equal(defeatedRound.actors.find(item=>item.id==="outside").hp,20,"alongside modifier stops when no enemies remain alive");
assert.equal(defeatedRound.pendingPrompt==null,true);
console.log("LionWing Haven: exact Zone, outside damage, Round refresh, and scene lifetime passed");
