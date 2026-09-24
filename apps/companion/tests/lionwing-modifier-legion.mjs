import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context);
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:20,maxHp:20,ap:1,baseAp:1,tier:2,speed:3,armor:0,evasion:0,attrs:{body:2,talent:2,spirit:3,mind:2},effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:8,height:8}],actors:[
  actor("legion","enemy",7,7,{profileId:"lionwing.modifier.legion",hp:0,maxHp:0,ap:0,baseAp:0,hidden:true,modifierState:{}}),
  ...Array.from({length:6},(_,index)=>actor(`foe${index}`,"enemy",index+1,5)),
  actor("p1","hero",1,1),actor("p2","hero",2,1),actor("p3","hero",3,1),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"foe0"}});
const dispatch=(scene,events,prefix)=>engine.dispatchMany(scene,events.map((event,index)=>({...event,id:event.id||`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();
const plan=engine.prepareModifierConfigure(scene,{actorId:"legion"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=dispatch(scene,plan.events,"deploy");
assert.equal(scene.sessionClocks.find(item=>item.ruleId==="lionwing.modifier.legion")?.size,5,"Legion clock counts three PCs and Tier 2");
let corrected=dispatch(scene,[{type:"lionwing.command",actorId:null,payload:{kind:"correct",targetId:"foe0",resource:"knockedOut",amount:1}}],"correct-ko");
assert.equal(corrected.sessionClocks.find(item=>item.ruleId==="lionwing.modifier.legion")?.value,1,"Narrator knockout advances the Legion clock");
assert.ok(corrected.log.some(row=>row.type==="actor.knockout"&&row.payload?.targetId==="foe0"),"Narrator knockout emits its lifecycle event");
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"legion"}).ok,false,"deployment cannot reset the clock");
const clock=()=>scene.sessionClocks.find(item=>item.ruleId==="lionwing.modifier.legion");
for(let index=0;index<5;index++)scene=dispatch(scene,[{type:"actor.knockout",actorId:"p1",payload:{targetId:`foe${index}`,sourceActionId:"manual.test"}}],`ko-${index}`);
assert.equal(clock().value,5);
assert.equal(scene.actors.find(item=>item.id==="foe5").knockedOut,true,"full clock knocks out every remaining ordinary enemy");
assert.equal(scene.actors.find(item=>item.id==="legion").knockedOut,false,"scene modifier is not a combat target");
assert.equal(engine.lionwingLegionRoundStartEvents(scene,{type:"round.end",id:"after-full"}).length,0,"completed Legion does not return enemies");

scene=base();scene=dispatch(scene,engine.prepareModifierConfigure(scene,{actorId:"legion"}).events,"deploy-again");
scene=dispatch(scene,[{type:"actor.knockout",actorId:"p1",payload:{targetId:"foe0",sourceActionId:"manual.test"}},{type:"actor.knockout",actorId:"p1",payload:{targetId:"foe1",sourceActionId:"manual.test"}}],"return-setup");
assert.equal(clock().value,2);
const boundary={type:"round.end",id:"round-boundary"};
const returning=engine.lionwingLegionRoundStartEvents(scene,boundary);
assert.equal(returning.filter(item=>item.type==="actor.knockout"&&item.payload.restore).length,2);
assert.equal(returning.filter(item=>item.type==="actor.spawn").length,3,"remaining live Tension creates Fodder Zones");
const roundResult=context.window.DAWN_LIONWING_ENGINE.dispatchMany(scene,[{...context.window.DAWN_LIONWING_ENGINE.command(null,{kind:"round-end"}),id:"legion-round-end"}]);
scene=roundResult.scene;
for(const id of ["foe0","foe1"]){const target=scene.actors.find(item=>item.id===id);assert.equal(target.knockedOut,false);assert.equal(target.hp,10);assert.equal(target.x===0||target.y===0||target.x===7||target.y===7,true)}
assert.equal(scene.actors.filter(item=>item.kind==="crowd"&&item.source==="lionwing.modifier.legion.return").length,4,"round-start return uses the newly increased Tension");
assert.equal(clock().value,2,"returning Knocked-Out enemies do not advance the Legion clock");
console.log("LionWing Legion: deployment clock, collapse and round-start return passed");
