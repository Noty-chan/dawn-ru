import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const source=fs.readFileSync(new URL("../app-core.js",import.meta.url),"utf8");
const helper=source.slice(source.indexOf("function normalizedEffectStates"),source.indexOf("function sceneCore"));
const context={clamp:(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0))};
vm.createContext(context);
vm.runInContext(`${helper}\nthis.normalizeEffects=normalizedEffectStates;`,context);

const ids=new Set(["target","caster"]),suppressed={
  effects:[],rulesEdition:"lionwing",
  effectStates:{"negative.помечен":{duration:"roundEnd",sources:[
    {sourceId:"mark:a",actorId:"caster",actionId:"cast",actionInstanceId:"cast:7",eventId:"event-a",appliedSerial:4,appliedRound:2,duration:"endTurn",ownerActorId:"caster",removable:false,sourceBound:true,suppressedBy:["shield"]},
    {sourceId:"scene:mark",actorId:"despawned",eventId:"event-b",duration:"roundEnd",removable:true,sourceBound:false,suppressedBy:[]},
  ]}},
};
const restored=JSON.parse(JSON.stringify(context.normalizeEffects(suppressed,{effects:[],rulesEdition:"lionwing"},ids)));
assert.deepEqual(restored["negative.помечен"].sources,[
  {sourceId:"mark:a",actorId:"caster",actionId:"cast",actionInstanceId:"cast:7",eventId:"event-a",appliedSerial:4,appliedRound:2,duration:"endTurn",ownerActorId:"caster",removable:false,sourceBound:true,suppressedBy:["shield"]},
  {sourceId:"scene:mark",actorId:null,actionId:"",actionInstanceId:"",eventId:"event-b",duration:"roundEnd",removable:true,sourceBound:false,suppressedBy:[]},
],"LionWing normalization preserves suppressed, independently expiring and unbound sources after their actor despawns");

const legacy=context.normalizeEffects(suppressed,{effects:[],rulesEdition:"ru-v0.9"},ids);
assert.equal(Object.keys(legacy).length,0,"legacy editions still discard state for inactive effects");

const oldSource={effectStates:{"negative.помечен":{sources:[{actorId:"caster",appliedSerial:null}]}}};
const migrated=context.normalizeEffects(oldSource,{effects:["negative.помечен"],rulesEdition:"lionwing"},ids)["negative.помечен"].sources[0];
assert.equal(Object.hasOwn(migrated,"duration"),false,"old sources keep the lifetime fallback instead of receiving a fabricated default");
assert.equal(Object.hasOwn(migrated,"appliedSerial"),false,"null serials retain the legacy fallback");

context.window={};context.console=console;
for(const file of ["data.js","edition-lionwing.js","logic.js"])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context);
loadSceneEngine(context);
const engine=context.window.DAWN_LIONWING_ENGINE;
const actor=id=>({id,name:id,rulesEdition:"lionwing",kind:"enemy",team:"enemy",space:"main",x:0,y:0,hp:10,maxHp:10,ap:0,effects:[],effectStates:{},lionwing:{},attrs:{}});
let scene={rulesEdition:"lionwing",version:0,turnSerial:5,round:2,activeActorId:"caster",actors:[{...actor("target"),effects:["negative.помечен"],effectStates:restored},actor("caster")],objects:[],walls:[],spaces:[{id:"main",width:5,height:5}]};
scene=engine.dispatchMany(scene,[engine.command("caster",{kind:"turn-end"})]).scene;
assert.deepEqual(Array.from(engine.effectInstanceStatus(scene,"target","negative.помечен").sources,source=>source.sourceId),["scene:mark"],"after normalization, ending the boundary owner's Turn expires only its suppressed source");
scene=engine.dispatchMany(scene,[engine.command("target",{kind:"effect-source",operation:"remove",targetId:"target",effect:"negative.помечен",sourceId:"scene:mark"})]).scene;
assert.equal(scene.actors[0].effects.includes("negative.помечен"),false,"the remaining Scene source can still be removed by its exact ID");

console.log("LionWing effect persistence normalization passed: suppressed, independent and Scene sources survive; legacy behavior is unchanged");
