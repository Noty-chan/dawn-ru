import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context),data=context.window.DAWN_DATA;
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:30,maxHp:30,ap:3,baseAp:3,tier:2,speed:4,armor:0,evasion:0,attrs:{body:3,talent:3,spirit:3,mind:3},effects:[],effectStates:{},usedActions:[],acted:false,knockedOut:false,lionwing:{},...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:"host",tension:2,spaces:[{id:"main",width:7,height:7}],actors:[actor("host","enemy",2,2,{profileId:"lionwing.npc.assassin"}),actor("blaze","enemy",0,0,{profileId:"lionwing.modifier.blaze",hp:0,maxHp:0,ap:0,baseAp:0,hidden:true,modifierState:{}}),actor("pc","hero",3,2)],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"hero",lastActorId:"pc"}});
const commit=(scene,events,prefix)=>engine.dispatchMany(scene,events.map((event,index)=>({...event,id:`${prefix}-${index}`}))).scene;
const roll={formula:"4D6",rolls:[6,5,4,1],successes:3,crits:1};
const attack=scene=>engine.prepareEnemyRule(scene,data,{actorId:"host",ruleId:"lionwing.npc.assassin.slice",targetIds:["pc"],roll});
const bare=attack(base());assert.equal(bare.ok,true,bare.errors?.join(" "));
const bareDamage=commit(base(),bare.events,"bare-attack").pendingAction.damageByTarget.pc;
for(const mode of ["burn","freeze","accelerate","toughen"]){
  let scene=base();const config=engine.prepareModifierConfigure(scene,{actorId:"blaze",carrierId:"host",mode});assert.equal(config.ok,true,config.errors?.join(" "));
  scene=commit(scene,config.events,`config-${mode}`);
  assert.equal(engine.effectiveActorSpeed(scene,"host"),6,"Blaze adds two Speed");
  const plan=attack(scene);assert.equal(plan.ok,true,plan.errors?.join(" "));
  scene=commit(scene,plan.events,`attack-${mode}`);
  if(mode==="burn"){assert.equal(scene.pendingAction.damageByTarget.pc,bareDamage+2);assert.equal(scene.pendingAction.postDisplacements.some(item=>item.targetId==="pc"&&item.maximum>=1),true)}
  if(mode==="freeze")assert.equal(scene.actors.find(item=>item.id==="pc").effects.includes("negative.замедлен"),true);
  if(mode==="accelerate")assert.equal(scene.actors.find(item=>item.id==="host").effects.includes("positive.ускорен")&&scene.actors.find(item=>item.id==="host").effects.includes("positive.усилен"),true);
  if(mode==="toughen")assert.equal(scene.actors.find(item=>item.id==="host").effects.includes("positive.укреплен")&&scene.actors.find(item=>item.id==="host").effects.includes("positive.усилен"),true);
}
let noCrit=base();noCrit=commit(noCrit,engine.prepareModifierConfigure(noCrit,{actorId:"blaze",carrierId:"host",mode:"burn"}).events,"no-crit-config");
const noCritAttack=engine.prepareEnemyRule(noCrit,data,{actorId:"host",ruleId:"lionwing.npc.assassin.slice",targetIds:["pc"],roll:{formula:"4D6",rolls:[5,5,4,1],successes:3,crits:0}});
assert.equal(noCritAttack.ok,true,noCritAttack.errors?.join(" "));
noCrit=commit(noCrit,noCritAttack.events,"no-crit-attack");assert.equal(noCrit.pendingAction.damageByTarget.pc,bareDamage,"without Critical Hits Blaze does not trigger");
let frozen=base();frozen.actors.find(item=>item.id==="pc").effects.push("negative.замедлен");frozen=commit(frozen,engine.prepareModifierConfigure(frozen,{actorId:"blaze",carrierId:"host",mode:"freeze"}).events,"frozen-config");
const freezeAttack=attack(frozen);assert.equal(freezeAttack.ok,true,freezeAttack.errors?.join(" "));frozen=commit(frozen,freezeAttack.events,"frozen-attack");
assert.equal(frozen.actors.find(item=>item.id==="pc").effects.includes("negative.обездвижен"),true,"already Slowed target is Immobilized");
console.log("LionWing Blaze: attachment Speed, critical threshold and four effects passed");
