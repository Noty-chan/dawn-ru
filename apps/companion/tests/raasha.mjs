import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const fixturePath = process.env.DAWN_RAASHA_FIXTURE || "D:/Dropzone/Downloads/DAWN-Рааша-Шаадрин (1).json";
if (!fs.existsSync(fixturePath)) {
  console.log("Raasha exact-sheet QA skipped: set DAWN_RAASHA_FIXTURE to the exported hero JSON");
  process.exit(0);
}
const exported=JSON.parse(fs.readFileSync(fixturePath,"utf8")),hero=exported.hero;
assert.equal(exported.format,"dawn-ru-hero");assert.equal(exported.schema,2);
assert.equal(hero.name,"Рааша Шаадрин");assert.equal(hero.rulesEdition,"lionwing");assert.equal(hero.tier,2);
assert.deepEqual(hero.attrs,{body:2,talent:2,spirit:4,mind:3});
assert.deepEqual(hero.outlooks,["wolf","cursed"]);assert.equal(hero.primaryOutlook,"wolf");
assert.deepEqual([...hero.gifts].sort(),["cursed.the-voice","wolf.dark-urge","wolf.outgunned"]);
assert.deepEqual(hero.techniques,{"disruptor.siren":2,"vagabond.master-at-arms":2,"ruiner.spellcrafter":3});
assert.deepEqual(hero.mods.spellcrafterAugments,["fierce","focused","wild"]);

const context={console,Date};context.globalThis=context;context.window=context;
for(const file of ["data.js","edition-lionwing.js","logic.js","technique-foundation-map.js"])
  vm.runInNewContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(new URL("../technique-engine.js",import.meta.url),"utf8"),context,{filename:"technique-engine.js"});
const Engine=context.DAWN_SCENE_ENGINE,TechniqueEngine=context.DAWN_TECHNIQUE_ENGINE,data=context.DAWN_DATA;
const raasha={id:"raasha",heroId:hero.id,kind:"hero",name:hero.name,team:"hero",space:"main",x:1,y:1,hp:hero.runtime.hp,maxHp:hero.runtime.maxHp,ap:hero.runtime.ap,baseAp:3,focus:hero.runtime.focus,influence:hero.runtime.influence,stress:hero.runtime.stress,tier:hero.tier,attrs:{...hero.attrs},skills:structuredClone(hero.skills),ability:{...hero.ability},techniques:{...hero.techniques},primaryOutlook:hero.primaryOutlook,outlooks:[...hero.outlooks],gifts:[...hero.gifts],effects:[],usedActions:[],acted:false,knockedOut:false};
const scene={rulesEdition:"lionwing",version:0,round:1,turnSerial:1,tension:0,activeActorId:"raasha",activeSpace:"main",spaces:[{id:"main",name:"Поле",width:9,height:7}],actors:[raasha,{id:"enemy-a",kind:"enemy",name:"Враг A",team:"enemy",space:"main",x:3,y:1,hp:10,maxHp:10,ap:2,baseAp:2,focus:0,attrs:{body:2,talent:2,spirit:1,mind:1},effects:[],usedActions:[],acted:false,knockedOut:false},{id:"enemy-b",kind:"enemy",name:"Враг B",team:"enemy",space:"main",x:5,y:1,hp:10,maxHp:10,ap:2,baseAp:2,focus:0,attrs:{body:2,talent:2,spirit:1,mind:1},effects:[],usedActions:[],acted:false,knockedOut:false}],objects:[],markers:[],areas:[],walls:[],topology:{cuts:[]},log:[],rollFeed:[],triggerQueue:[],lionwing:{entities:{},entityReceipts:{}}};

const coverage=TechniqueEngine.techniqueCoverage(data,hero.techniques);
assert.deepEqual(new Set(coverage.map(entry=>entry.id)),new Set(["vagabond.master-at-arms.1","vagabond.master-at-arms.2","disruptor.siren.1","disruptor.siren.2","ruiner.spellcrafter.1","ruiner.spellcrafter.2","ruiner.spellcrafter.3"]));
assert.ok(coverage.every(entry=>["full","decision"].includes(entry.automation)),"every learned level must have an executable full/decision adapter");
assert.equal(coverage.some(entry=>["manual","partial","none"].includes(entry.automation)),false,"Raasha must expose no manual Technique level");

const ordinary=Engine.diceHookStatus(scene,"raasha",{scope:"challenge",sceneContext:true,baseCount:2});
assert.equal(ordinary.count,4,"Outgunned is derived automatically from the current table sides");
assert.deepEqual(Array.from(ordinary.sources,source=>source.ruleId),["wolf.outgunned"]);
const abilityActor={...raasha,ability:{enabled:true,name:"Псионика",rank:2}};
const abilityScene={...scene,actors:[abilityActor,...scene.actors.slice(1)]};
const dark=Engine.diceHookStatus(abilityScene,"raasha",{scope:"challenge",sceneContext:true,baseCount:2,usesAbility:true,usesSkill:false,abilityKey:"ability",selectedHookIds:["wolf.dark-urge"]});
assert.equal(dark.count,6);assert.deepEqual(Array.from(dark.sources,source=>source.ruleId),["wolf.outgunned","wolf.dark-urge"]);
const agrees=Engine.diceHookStatus(abilityScene,"raasha",{scope:"challenge",sceneContext:true,baseCount:2,usesAbility:true,usesSkill:false,abilityKey:"ability",selectedHookIds:["cursed.the-voice.agree"]});
assert.equal(agrees.count,6);assert.ok(agrees.sources.some(source=>source.ruleId==="cursed.the-voice"&&source.type==="advantage"));
const disagrees=Engine.diceHookStatus(abilityScene,"raasha",{scope:"challenge",sceneContext:true,baseCount:2,usesAbility:true,usesSkill:false,abilityKey:"ability",selectedHookIds:["cursed.the-voice.disagree"]});
assert.equal(disagrees.count,2);assert.ok(disagrees.sources.some(source=>source.ruleId==="cursed.the-voice"&&source.type==="hindrance"));
const voiceBlockedBySkill=Engine.diceHookStatus(abilityScene,"raasha",{scope:"challenge",sceneContext:true,baseCount:2,usesAbility:true,usesSkill:true,abilityKey:"ability",selectedHookIds:["cursed.the-voice.agree"]});
assert.equal(voiceBlockedBySkill.sources.some(source=>source.ruleId==="cursed.the-voice"),false,"The Voice applies only when the Ability is used without a Skill");
console.log("Raasha exact-sheet QA passed: all 7 Technique Levels and all 3 Outlook Boons are automated");