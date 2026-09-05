import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
const engine = loadSceneEngine(context), lw = context.window.DAWN_LIONWING_ENGINE, ids = engine.ACTION_IDS;
let serial = 0;
const hero = (id, x, y) => ({ id, name:id, kind:"hero", rulesEdition:"lionwing", team:"hero", heroId:id, space:"main", x,y,hp:16,maxHp:16,ap:3,baseAp:3,focus:10,influence:3,wounds:0,stress:0,tier:1,speed:4,armor:0,evasion:0,attrs:{body:4,talent:3,spirit:2,mind:2},effects:[],effectStates:{},usedActions:[],acted:false,knockedOut:false });
const fixture = () => ({ rulesEdition:"lionwing",version:0,round:1,turnSerial:0,tension:0,activeActorId:null,spaces:[{id:"main",width:7,height:7}],actors:[hero("h",1,1),{...hero("e",3,1),kind:"enemy",heroId:null,team:"enemy",hp:20,maxHp:20}],objects:[],walls:[],markers:[],log:[],targetIds:[],reminders:[],rollFeed:[] });
const run = (scene, actorId, payload) => lw.dispatchMany(scene,[{...lw.command(actorId,payload),id:`test-${++serial}`}]).scene;
const prepare = (scene,actorId,payload) => { const result=lw.prepare(scene,{actorId,...payload},{random:()=>0.6});assert.equal(result.ok,true,result.errors?.join(" "));return lw.dispatchMany(scene,result.events).scene; };
const throws = (scene,actorId,payload,match) => {const before=JSON.stringify(scene);assert.throws(()=>run(scene,actorId,payload),match);assert.equal(JSON.stringify(scene),before,"rejected transaction must not mutate the caller");};

let s=fixture();
assert.equal(engine.turnStartStatus(s,"e").available,false);
s=run(s,"h",{kind:"turn-start"});assert.equal(s.actors[0].ap,3);assert.equal(s.actors[0].focus,2);
s=prepare(s,"h",{kind:"action",actionId:ids.charge});assert.equal(s.actors[0].ap,1);assert.equal(s.actors[0].focus,4);
throws(s,"h",{kind:"action",actionId:ids.charge},/использовано|Недостаточно/);
s=run(s,"h",{kind:"turn-end"});assert.equal(s.actors[0].ap,0);
throws(s,"h",{kind:"turn-start"},/противников/);
s=run(s,"e",{kind:"turn-start"});assert.equal(s.actors[1].ap,3);
s=run(s,"e",{kind:"turn-end"});s=prepare(s,"h",{kind:"action",actionId:ids.breathe,breakout:true});assert.equal(s.actors[0].influence,2);assert.equal(s.actors[0].ap,0);
s=run(s,null,{kind:"round-end"});assert.equal(s.round,2);assert.equal(s.tension,1);assert.equal(s.actors[0].ap,0);

s=fixture();s.actors[0].hp=1;s.actors[0].armor=4;s.actors[0].evasion=2;
s=run(s,"e",{kind:"damage",targetId:"h",amount:3,attack:true});assert.equal(s.actors[0].hp,1);assert.equal(s.actors[0].evasion,1);
s=run(s,"e",{kind:"damage",targetId:"h",amount:3});assert.equal(s.actors[0].wounds,1);assert.equal(s.actors[0].hp,16);assert.equal(s.actors[0].influence,4);
s=run(s,"h",{kind:"wound",targetId:"h"});assert.equal(s.actors[0].wounds,2);assert.equal(s.actors[0].influence,4);
s=run(s,"e",{kind:"batch",operations:[{kind:"damage",targetId:"h",amount:30},{kind:"damage",targetId:"h",amount:2}]});
assert.equal(s.lionwing.choices[0].kind,"knockout");assert.equal(s.lionwing.deferred.length,1);assert.equal(s.actors[0].hp,16);
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"resist"});assert.equal(s.actors[0].wounds,1);assert.equal(s.actors[0].hp,14);assert.equal(s.actors[0].lionwing.vulnerable,true);assert.equal(s.lionwing.deferred.length,0);

s=fixture();s.actors[0].hp=5;
throws(s,"h",{kind:"batch",operations:[{kind:"heal",targetId:"h",amount:2},{kind:"resource",resource:"ap",operation:"spend",amount:4}]},/Недостаточно/);
s=run(s,"h",{kind:"correct",resource:"hp",amount:0});assert.equal(s.actors[0].hp,0);assert.equal(s.actors[0].wounds,0);assert.equal(s.actors[0].knockedOut,false);

s=fixture();s=run(s,"h",{kind:"turn-start"});s=prepare(s,"h",{kind:"action",actionId:ids.step,destination:{x:2,y:1}});assert.equal(s.actors[0].ap,2);assert.equal(s.actors[0].stepRemaining,3);
s=prepare(s,"h",{kind:"action",actionId:ids.step,destination:{x:2,y:2}});assert.equal(s.actors[0].ap,2);assert.equal(s.actors[0].stepRemaining,2);
throws(s,"h",{kind:"move",destination:{x:3,y:1},maximum:5},/занята/);
s=run(s,"e",{kind:"effect",targetId:"h",effect:"negative.обездвижен"});throws(s,"h",{kind:"move",destination:{x:1,y:2},maximum:3},/запрещает/);

s=fixture();s.actors[1].x=2;s=run(s,"h",{kind:"turn-start"});s=prepare(s,"h",{kind:"action",actionId:ids.skirmish,targetIds:["e"]});assert.ok(s.pendingAction);assert.equal(s.actors[0].ap,2);
throws(s,"h",{kind:"resolve-attack"},/Реакций/);
s=run(s,"e",{kind:"reaction",choice:"take"});s=run(s,"h",{kind:"resolve-attack"});assert.equal(s.pendingAction,null);assert.equal(s.actors[1].hp,16);

s=fixture();s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"effect",effect:"positive.укреплен"});s=run(s,"h",{kind:"turn-end"});assert.ok(s.actors[0].effects.includes("positive.укреплен"));
s=run(s,"e",{kind:"turn-start"});s=run(s,"e",{kind:"turn-end"});s=run(s,null,{kind:"round-end"});s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"turn-end"});assert.ok(!s.actors[0].effects.includes("positive.укреплен"));

s=fixture();const event={...lw.command("h",{kind:"heal",targetId:"h",amount:1}),id:"same"};const first=lw.dispatchMany(s,[event]);const twice=lw.dispatchMany(first.scene,[event]);assert.equal(twice.scene.version,first.scene.version);assert.equal(twice.events.length,0);assert.throws(()=>lw.dispatchMany(first.scene,[{...event,payload:{kind:"heal",targetId:"h",amount:2}}]),/ID/);
const before=JSON.stringify(s),preview=lw.previewEvents(s,[lw.command("e",{kind:"damage",targetId:"h",amount:4})]);assert.equal(preview.ok,true);assert.equal(JSON.stringify(s),before);
assert.throws(()=>lw.dispatchMany(s,[event],{expectedVersion:99}),/версии/);
assert.equal(lw.isScene({...s,rulesEdition:"ru-v0.9"}),false);

// Temporary Evasion is a consumable pool, not a reusable damage reduction.
s=fixture();s=run(s,"h",{kind:"modifier",stat:"evasion",amount:3,duration:"endTurn"});
s=run(s,"e",{kind:"batch",operations:[{kind:"damage",targetId:"h",amount:2},{kind:"damage",targetId:"h",amount:2}]});assert.equal(s.actors[0].hp,15);

// Compound Health Gates discard excess damage and prohibit healing past a gate.
s=fixture();s.actors.push({...s.actors[1],id:"e2",maxHp:20,hp:20,compoundId:"boss"});s.actors[1].compoundId="boss";
s=run(s,"h",{kind:"damage",targetId:"e",amount:25});assert.equal(s.actors[1].hp+s.actors[2].hp,20);assert.equal(s.tension,1);
s=run(s,"h",{kind:"heal",targetId:"e2",amount:20});assert.equal(s.actors[1].hp+s.actors[2].hp,20);

// A failed Clash offers the canonically required damage-for-reroll choice.
const dice=(count,hits)=>({initialCount:count,rolls:Array.from({length:count},(_,i)=>i<hits?4:1)});
s=fixture();s=run(s,"e",{kind:"attack",targetIds:["h"],amount:4});
s=run(s,"h",{kind:"reaction",choice:"clash",roll:dice(4,0),opponentRoll:dice(4,1)});
assert.equal(s.lionwing.choices[0].kind,"clash-loss");assert.equal(s.actors[0].focus,8);
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"reroll",roll:dice(4,2),opponentRoll:dice(4,0)});
assert.equal(s.actors[0].hp,11);assert.equal(s.actors[0].focus,8,"reroll does not charge Focus again");assert.equal(s.pendingAction.responses.h.reduction,2);assert.equal(s.actors[1].hp,18);

s=fixture();s.actors.push(hero("h2",1,2));s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"grant-turn",targetId:"h2"});s=run(s,"h",{kind:"turn-end"});assert.equal(lw.turnStartStatus(s,"e").available,false);s=run(s,"h2",{kind:"turn-start"});s=run(s,"h2",{kind:"turn-end"});assert.equal(lw.turnStartStatus(s,"e").available,true);

// Renderer/client snapshots do not leak authoritative queued operations or receipts.
s=fixture();s.actors[1].hidden=true;s=run(s,"e",{kind:"note",note:"private"});const projected=engine.projectScene(s,{role:"player",actorIds:["h"]});assert.equal(projected.actors.length,1);assert.equal(projected.log.length,0);assert.equal(projected.lionwing.receipts,undefined);

vm.runInContext(fs.readFileSync(new URL("../network-v2.js",import.meta.url),"utf8"),context);
const network=context.window.DAWN_NETWORK_V2;s=fixture();s.actors[0].ownerId="player";s=run(s,"h",{kind:"turn-start"});
assert.throws(()=>network.materializeIntent(s,context.window.DAWN_DATA,{kind:"lionwing",actorId:"h",request:{kind:"correct",resource:"hp",amount:999}},"player"),/Нарратору/);
assert.throws(()=>network.materializeIntent(s,context.window.DAWN_DATA,{kind:"lionwing",actorId:"e",request:{kind:"action",actionId:ids.breathe}},"player"),/не владеет/);
const events=network.materializeIntent(s,context.window.DAWN_DATA,{kind:"lionwing",actorId:"h",request:{kind:"action",actionId:ids.breathe,sourceActorId:"e",cost:0}},"player");s=engine.dispatchMany(s,events).scene;assert.equal(s.actors[0].ap,2);assert.equal(s.actors[0].focus,3);
console.log("LionWing kernel: actions, turns, damage, Wounds, Resistance, deferred hits, movement, effects, atomicity and replay passed");
