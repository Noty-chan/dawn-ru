import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","logic.js"])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
loadSceneEngine(context);
const Engine=context.window.DAWN_LIONWING_ENGINE;
const actor=(id,team="hero")=>({id,name:id,kind:team==="hero"?"hero":"enemy",heroId:team==="hero"?id:null,rulesEdition:"lionwing",team,space:"main",x:team==="hero"?0:2,y:0,hp:10,maxHp:10,ap:3,baseAp:3,focus:2,influence:2,wounds:0,stress:0,tier:1,speed:4,armor:0,evasion:0,attrs:{body:2,talent:2,spirit:2,mind:2},effects:[],effectStates:{},usedActions:[],acted:false,knockedOut:false});
const fixture=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:0,spaces:[{id:"main",width:5,height:5}],objects:[],walls:[],actors:[actor("target"),actor("reaper-a","enemy"),{...actor("reaper-b","enemy"),x:3}]});
const run=(scene,actorId,payload,id)=>Engine.dispatchMany(scene,[{id,type:"lionwing.command",actorId,payload}]).scene;

let scene=fixture();
scene=run(scene,"reaper-a",{kind:"effect",targetId:"target",effect:"negative.помечен",sourceId:"mark:a",removable:false},"apply-a");
scene=run(scene,"reaper-b",{kind:"effect",targetId:"target",effect:"negative.помечен",sourceId:"mark:b"},"apply-b");
let status=Engine.effectInstanceStatus(scene,"target","negative.помечен");
assert.deepEqual(JSON.parse(JSON.stringify(status.sources.map(source=>source.sourceId))),["mark:a","mark:b"],"same-name sources keep independent identities");

const saved=JSON.parse(JSON.stringify(scene));
scene=run(saved,"reaper-b",{kind:"effect-source",operation:"suppress",targetId:"target",effect:"negative.помечен",sourceId:"mark:a",suppressionId:"banishment"},"suppress-a");
status=Engine.effectInstanceStatus(scene,"target","negative.помечен");
assert.equal(status.activeSources.length,1);assert.ok(scene.actors[0].effects.includes("negative.помечен"),"suppression leaves another source active after reload");
scene=run(scene,"reaper-b",{kind:"effect-source",operation:"remove",targetId:"target",effect:"negative.помечен",sourceId:"mark:b"},"remove-b");
assert.equal(scene.actors[0].effects.includes("negative.помечен"),false,"an effect is inactive when its only remaining source is suppressed");
scene=run(scene,"reaper-b",{kind:"effect-source",operation:"restore",targetId:"target",effect:"negative.помечен",sourceId:"mark:a",suppressionId:"banishment"},"restore-a");
assert.ok(scene.actors[0].effects.includes("negative.помечен"));

const before=JSON.stringify(scene);
assert.throws(()=>run(scene,"reaper-b",{kind:"effect-source",operation:"remove",targetId:"target",effect:"negative.помечен",sourceId:"mark:a"},"illegal-remove"),/нельзя снять вручную/);
assert.equal(JSON.stringify(scene),before,"a rejected manual removal is atomic and leaves the undo source intact");
scene=run(scene,"reaper-b",{kind:"effect-source",operation:"expire",targetId:"target",effect:"negative.помечен",sourceId:"mark:a"},"expire-a");
assert.equal(scene.actors[0].effects.includes("negative.помечен"),false,"expiry may remove an unremovable source");
assert.throws(()=>run(scene,"reaper-b",{kind:"effect-source",operation:"remove",targetId:"target",effect:"negative.помечен",sourceId:"missing"},"missing-source"),/Источник Эффекта не найден/);

scene=fixture();
scene=run(scene,"reaper-a",{kind:"effect",targetId:"target",effect:"negative.помечен",sourceId:"short",duration:"roundEnd"},"short");
scene=run(scene,"reaper-b",{kind:"effect",targetId:"target",effect:"negative.помечен",sourceId:"long",duration:"scene"},"long");
scene=run(scene,"reaper-a",{kind:"effect-source",operation:"suppress",targetId:"target",effect:"negative.помечен",sourceId:"short",suppressionId:"test"},"suppress-short");
scene=run(scene,"target",{kind:"turn-start"},"hero-start");
scene=run(scene,"target",{kind:"turn-end"},"hero-end");
scene=run(scene,"reaper-a",{kind:"turn-start"},"enemy-start");
scene=run(scene,"reaper-a",{kind:"turn-end"},"enemy-end");
scene=run(JSON.parse(JSON.stringify(scene)),"target",{kind:"round-end"},"round-end");
assert.deepEqual(JSON.parse(JSON.stringify(Engine.effectInstanceStatus(scene,"target","negative.помечен").sources.map(x=>x.sourceId))),["long"],"suppressed short source expires independently of long source");
console.log("LionWing effects families: source identity, suppression, protected removal, reload, independent expiry and atomic rejection passed");
