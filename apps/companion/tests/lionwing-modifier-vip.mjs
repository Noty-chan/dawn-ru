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
  actor("foe","enemy",5,5),actor("foe2","enemy",6,5),actor("vip","enemy",5,4,{profileId:"lionwing.modifier.vip",hp:17,maxHp:17,speed:0,modifierState:{}}),
  actor("player","hero",5,3),actor("player2","hero",4,1),actor("ally-npc","hero",3,1,{profileId:"lionwing.npc.bruiser"}),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"foe"}});
const commit=(scene,plan,prefix)=>engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();
const protectedScene=base();
assert.equal(engine.effectTargetingStatus(protectedScene,"foe","vip").available,false,"adjacent PC protects VIP from enemy targeting");
protectedScene.actors.find(item=>item.id==="player").x=1;protectedScene.actors.find(item=>item.id==="player").y=1;
protectedScene.actors.find(item=>item.id==="ally-npc").x=5;protectedScene.actors.find(item=>item.id==="ally-npc").y=3;
assert.equal(engine.effectTargetingStatus(protectedScene,"foe","vip").available,true,"unowned allied NPC is not a player-owned Summon");
const plan=engine.prepareModifierConfigure(scene,{actorId:"vip"});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"vip-configure");
assert.equal(scene.actors.find(item=>item.id==="vip").ap,0);
scene=engine.dispatchMany(scene,[{id:"player-leaves-vip",type:"actor.move",actorId:"player",payload:{space:"main",x:4,y:2,from:{space:"main",x:5,y:3}}}]).scene;
assert.equal(scene.pendingPrompt?.kind,"lionwing-vip-follow","leaving adjacency offers a follow decision");
const follow=engine.respondRulePrompt(scene,data,{choice:"follow"});
assert.equal(follow.ok,true,follow.errors?.join(" "));
scene=commit(scene,follow,"vip-follow");
assert.equal(scene.actors.find(item=>item.id==="vip").x,4);
assert.equal(scene.actors.find(item=>item.id==="vip").y,2,"VIP shares the player's new position");
assert.equal(scene.actors.find(item=>item.id==="vip").modifierState.lastFollowTurnSerial,scene.turnSerial);
scene=engine.dispatchMany(scene,[{id:"player2-leaves-vip",type:"actor.move",actorId:"player2",payload:{space:"main",x:2,y:1,from:{space:"main",x:4,y:1}}}]).scene;
assert.equal(scene.pendingPrompt==null,true,"VIP follows at most once per Turn");
assert.throws(()=>engine.dispatchMany(scene,[{id:"vip-forged-follow",type:"actor.move",actorId:"vip",payload:{space:"main",x:0,y:0,vipFollow:{moverId:"player",moveEventId:"player-leaves-vip",promptId:"fake",turnSerial:scene.turnSerial},sourceActionId:"lionwing.modifier.vip.follow"}}]),/Сопровождение|VIP|перемещ|Некоррект|нельзя/i,"a forged follow cannot teleport VIP");
scene=engine.dispatchMany(scene,[{id:"vip-ko",type:"actor.knockout",actorId:"player",payload:{targetId:"vip",sourceActionId:"test.vip.ko"}}]).scene;
assert.equal(scene.actors.find(item=>item.id==="vip").knockedOut,true);
assert.equal(scene.actors.find(item=>item.id==="player").knockedOut,true,"VIP failure knocks out all PCs");
assert.equal(scene.actors.find(item=>item.id==="player2").knockedOut,true);
assert.equal(scene.actors.find(item=>item.id==="ally-npc").knockedOut,false,"allied NPC is not a PC");
const lethal=commit(base(),engine.prepareModifierConfigure(base(),{actorId:"vip"}),"vip-lethal-configure");
const lethalResult=engine.dispatchMany(lethal,[{id:"vip-lethal-damage",type:"damage.apply",actorId:"player",payload:{targetId:"vip",amount:20,attack:false,ignoreArmor:true,ignoreEvasion:true,sourceActionId:"manual.test"}}]).scene;
assert.equal(lethalResult.actors.find(item=>item.id==="player2").knockedOut,true,"damage-induced VIP KO triggers the same consequence");
console.log("LionWing VIP: configuration and PC-only defeat on KO passed");
