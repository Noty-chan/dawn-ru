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
assert.equal(lw.dispatchMany(first.scene,[event],{expectedVersion:0}).events.length,0,"A retried transaction acknowledges its original receipt even after the version advanced");
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

// Browser contract: every count used by the existing flow renderer is present.
s=fixture();s=run(s,"e",{kind:"attack",targetIds:["h"],amount:5});
assert.deepEqual(Array.from(engine.pendingActionStatus(s).eligibleIds),["h"]);
assert.equal(engine.pendingActionStatus(s).answeredIds.length,0);
s=run(s,"h",{kind:"reaction",choice:"take"});assert.equal(engine.pendingActionStatus(s).answeredIds.length,1);

// Generic resources cannot bypass Wounds, revive actors, or silently accept typos.
s=fixture();throws(s,"h",{kind:"resource",resource:"hp",operation:"spend",amount:16},/операцию|исправление/);
throws(s,"h",{kind:"resource",resource:"ap",operation:"typo",amount:1},/операция/);
throws(s,"h",{kind:"configure-resource",id:"focus",value:2},/ID/);
throws(s,"h",{kind:"configure-resource",id:"custom",value:5,maximum:4},/максимум/);
throws(s,"h",{kind:"correct",resource:"hp",amount:17},/максимум/);
throws(s,"h",{kind:"correct",resource:"knockedOut",amount:2},/значение/);
s=run(s,"h",{kind:"configure-resource",id:"mana",value:5,replaces:"focus"});
s=run(s,"h",{kind:"turn-start"});s=prepare(s,"h",{kind:"action",actionId:ids.breathe});
assert.equal(s.actors[0].ruleResources.mana.value,6);
s=run(s,"e",{kind:"attack",targetIds:["h"],amount:1});s=run(s,"h",{kind:"reaction",choice:"block"});assert.equal(s.actors[0].ruleResources.mana.value,4);

// Removal and expiration affect the entire Compound NPC, including stale lifetimes.
s=fixture();s.actors[1].compoundId="boss";s.actors.push({...s.actors[1],id:"part"});
s=run(s,"h",{kind:"effect",targetId:"e",effect:"negative.помечен"});
s=run(s,"h",{kind:"effect",targetId:"part",effect:"negative.помечен",remove:true});
for(const part of s.actors.slice(1)){assert.equal(part.effects.length,0);assert.equal(part.lionwing.effectLifetimes["negative.помечен"],undefined);}

// Crossing adjacency in the middle of a path offers Punish even if neither end is adjacent.
s=fixture();s.actors[1].x=2;s.actors[1].y=2;
s=run(s,"h",{kind:"move",destination:{x:4,y:1},maximum:4});assert.equal(s.lionwing.opportunities.length,1);

// Snared followers wait for a legal adjacent square after their source moves.
s=fixture();s.actors[1].x=2;s=run(s,"h",{kind:"effect",targetId:"e",effect:"negative.пойман"});
s=run(s,"h",{kind:"move",destination:{x:1,y:3},maximum:2});
assert.equal(s.lionwing.choices[0].actorId,"e");
s=run(s,"e",{kind:"choice",id:s.lionwing.choices[0].id,choice:"place",destination:{x:2,y:3}});assert.equal(s.actors[1].y,3);

// A manual package pauses its tail until all Attack responses have resolved.
s=fixture();s=run(s,"h",{kind:"batch",operations:[{kind:"attack",targetIds:["e"],amount:2},{kind:"resource",resource:"ap",operation:"spend",amount:1}]});
assert.equal(s.actors[0].ap,3);s=run(s,"e",{kind:"reaction",choice:"take"});s=run(s,"h",{kind:"resolve-attack"});assert.equal(s.actors[0].ap,2);

// Reset is reversible through ordinary snapshots and preserves lasting injury, not Vulnerability.
s=fixture();s.actors[0].wounds=2;s.actors[0].lionwing={vulnerable:true};s.actors[0].evasion=5;
const saved=JSON.stringify(s);s=run(s,null,{kind:"scene-reset"});assert.equal(s.actors[0].wounds,2);assert.equal(s.actors[0].lionwing.vulnerable,undefined);assert.equal(s.actors[0].evasion,0);assert.equal(JSON.parse(saved).actors[0].lionwing.vulnerable,true);

// The old runtime and Technique intent protocols cannot bypass the LionWing whitelist.
s=fixture();s.actors[0].ownerId="player";
for(const kind of ["runtime","technique","potion","take-wound","action-plan-start"]){assert.throws(()=>network.materializeIntent(s,context.window.DAWN_DATA,{kind,actorId:"h",key:"hp",value:0},"player"),/LionWing/);}
console.log("LionWing regression: flow contract, strict resources, alternate Focus, Compound Effects, movement, batch deferral, reset and network isolation passed");

// Duel isolates the combatants, waits until the next Turn, records a ruling and returns both.
s=fixture();s.actors.push(hero("h2",0,4),{...s.actors[1],id:"e2",x:6,y:4});s.actors[1].x=2;s.actors[0].influence=5;s=run(s,"h",{kind:"turn-start"});
s=prepare(s,"h",{kind:"action",actionId:"action.атаки.дуэль",targetIds:["e"]});
assert.equal(s.lionwing.choices.length,0);assert.notEqual(s.actors[0].space,"main");
s=run(s,"h",{kind:"turn-end"});s=run(s,"e",{kind:"turn-start"});assert.equal(s.lionwing.choices[0].kind,"duel-outcome");
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"win"});
throws(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"place",destination:{x:3,y:3}},/краю/);
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"place",destination:{x:0,y:0}});
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"place",destination:{x:6,y:6}});
assert.equal(s.spaces.length,1);assert.equal(s.lionwing.duels.length,0);assert.equal(s.actors[1].space,"main");

// Evasion is shared by Parts and consuming it must not silently switch to Armor.
s=fixture();s.actors[1].compoundId="boss";s.actors[1].armor=1;s.actors[1].evasion=3;s.actors.push({...s.actors[1],id:"part"});
s=run(s,"h",{kind:"damage",targetId:"e",amount:3,attack:true});assert.equal(s.actors[1].evasion,0);assert.equal(s.actors[2].evasion,0);
const beforeHp=s.actors[1].hp+s.actors[2].hp;s=run(s,"h",{kind:"damage",targetId:"part",amount:3,attack:true});assert.equal(s.actors[1].hp+s.actors[2].hp,beforeHp-3);

// Unknown operations must fail before damage opens a deferred choice.
s=fixture();s.actors[0].wounds=2;s.actors[0].hp=1;
throws(s,"e",{kind:"batch",operations:[{kind:"damage",targetId:"h",amount:5},{kind:"typo"}]},/операция/);

// PDF p39 / printed p38: without another combatant on either side, resolve immediately.
const startImmediateDuel=()=>{let scene=fixture();scene.actors[1].x=2;scene.actors[0].influence=5;scene=run(scene,"h",{kind:"turn-start"});return prepare(scene,"h",{kind:"action",actionId:"action.атаки.дуэль",targetIds:["e"]});};
s=startImmediateDuel();assert.equal(s.lionwing.choices[0].kind,"duel-outcome");
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"lose"});
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"bail"});
assert.equal(s.actors[0].wounds,0);assert.equal(s.actors[1].hp,20);assert.equal(s.actors[0].influence,1,"Bail does not refund Influence");
s=startImmediateDuel();s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"lose"});
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"double-down"});
assert.equal(s.lionwing.duels[0].tension,2);assert.equal(s.tension,0,"Duel tracks its own Scene Tension");
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"lose"});
assert.equal(s.actors[0].influence,5);assert.equal(s.lionwing.choices[0].kind,"duel-wounds");
s=run(s,"h",{kind:"choice",id:s.lionwing.choices[0].id,choice:"two-wounds"});
assert.equal(s.actors[0].wounds,2);assert.equal(s.lionwing.choices[0].kind,"placement");
console.log("LionWing PDF Duel: immediate resolution, Bail, Double Down, Influence refund, explicit Wound ruling and edge return passed");

// PDF page 64: Punish costs 2 Focus; only its Swift Skirmish has no Cost.
s=fixture();s.actors[1].x=2;
s=run(s,"e",{kind:"move",destination:{x:3,y:1,space:"main"},maximum:1});
const punish=s.lionwing.opportunities.find(o=>o.actorId==="h");assert.ok(punish);
s.actors[0].focus=1;assert.equal(lw.prepare(s,{actorId:"h",kind:"punish",id:punish.id}).ok,false);
s.actors[0].focus=2;s=prepare(s,"h",{kind:"punish",id:punish.id});assert.equal(s.actors[0].focus,0);assert.ok(s.pendingAction);
// Limits do not reset when unrelated uses exceed the visible journal window.
s=fixture();s=run(s,"h",{kind:"usage",ruleId:"limited",scope:"scene",limit:1});
for(let i=0;i<205;i++)s=run(s,"h",{kind:"usage",ruleId:"other",scope:"scene",limit:999});
throws(s,"h",{kind:"usage",ruleId:"limited",scope:"scene",limit:1},/Лимит/);

s=startImmediateDuel();const duelId=s.lionwing.duels[0].id;
s=run(s,"h",{kind:"tension",duelId,amount:4});assert.equal(s.tension,0);assert.equal(s.lionwing.duels[0].tension,4);
s=run(s,"h",{kind:"resource",resource:"focus",operation:"spend",amount:1});assert.equal(s.actors[0].focus,1);assert.equal(s.lionwing.choices[0].kind,"duel-outcome");
s=prepare(s,"e",{kind:"roll",count:5});assert.equal(s.lionwing.choices[0].kind,"duel-outcome");
s.actors[1].hidden=true;s.turnUndo=[{scene:{secret:"private snapshot"}}];
const hiddenDuel=engine.projectScene(s,{role:"player",actorIds:["h"]});
assert.equal(hiddenDuel.turnUndo,undefined);assert.equal(hiddenDuel.lionwing.duels.length,0);assert.equal(hiddenDuel.lionwing.choices.length,0);
assert.equal(hiddenDuel.log.some(row=>row.payload?.targetId==="e"),false);

// Removing an obstacle is a complete Improvise outcome, with no placement request.
s=fixture();s.objects=[{id:"obstacle",type:"terrain",space:"main",cells:["1,2"]}];s=run(s,"h",{kind:"turn-start"});
s=prepare(s,"h",{kind:"action",actionId:ids.improvise,removeObstacleId:"obstacle"});assert.equal(s.objects.length,0);
// Round-end modifiers expire even if no later Turn serial has occurred.
s=fixture();s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"turn-end"});s=run(s,"e",{kind:"turn-start"});s=run(s,"e",{kind:"turn-end"});s=run(s,"h",{kind:"modifier",targetId:"h",stat:"armor",amount:3,duration:"roundEnd"});
s=run(s,null,{kind:"round-end"});assert.equal(s.actors[0].lionwing.modifiers.length,0);
// Steady prevents the compulsory placement, including the initial Snared pull.
s=fixture();s=run(s,"h",{kind:"effect",targetId:"h",effect:"positive.устойчив"});s=run(s,"e",{kind:"effect",targetId:"h",effect:"negative.пойман"});assert.equal(s.lionwing.choices.length,0);

// Spike adds dice only against the chosen Launched target, before clearing it.
s=fixture();s.actors[1].x=2;s.actors.push({...hero("e2",1,2),kind:"enemy",heroId:null,team:"enemy"});
s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"effect",targetId:"e",effect:"negative.подброшен"});
s=prepare(s,"h",{kind:"action",actionId:ids.skirmish,targetIds:["e","e2"],spikeTargetIds:["e"]});
assert.equal(s.pendingAction.targetDamage.e,5);assert.equal(s.pendingAction.targetDamage.e2,4);assert.equal(s.actors[1].effects.includes("negative.подброшен"),false);
// A diagonal Line still uses orthogonal distance for Jump's range.
s=fixture();assert.throws(()=>lw.movement(s,s.actors[0],{x:3,y:3},{line:true,maximum:3,ignoreOpponents:true}),/дальности/);
assert.equal(lw.movement(s,s.actors[0],{x:3,y:3},{line:true,maximum:4,ignoreOpponents:true}).cost,4);

// Manual attack exceptions survive the reaction window and serialization.
s=fixture();s.actors[1].armor=10;s.actors[1].evasion=10;
s=run(s,"h",{kind:"attack",targetIds:["e"],amount:5,ignoreArmor:true,ignoreEvasion:true});
s=run(JSON.parse(JSON.stringify(s)),"e",{kind:"reaction",choice:"take"});s=run(s,"h",{kind:"resolve-attack"});assert.equal(s.actors[1].hp,15);assert.equal(s.actors[1].evasion,10);
// Dodge suppresses forced movement in the same manual attack package.
s=fixture();s=run(s,"h",{kind:"batch",operations:[{kind:"attack",targetIds:["e"],amount:1},{kind:"move",targetId:"e",forced:true,destination:{x:4,y:1},maximum:2}]});
s=run(s,"e",{kind:"reaction",choice:"dodge",destination:{x:3,y:2}});s=run(s,"h",{kind:"resolve-attack"});assert.equal(s.actors[1].x,3);assert.equal(s.actors[1].y,2);assert.ok(s.log.some(e=>e.type==="movement.prevented"));
// A manual modifier can be removed without changing its base statistic.
s=fixture();s=run(s,"h",{kind:"modifier",stat:"armor",amount:3,duration:"manual"});s=run(s,"h",{kind:"modifier",stat:"armor",remove:true});assert.equal(s.actors[0].armor,0);assert.equal(s.actors[0].lionwing.modifiers.length,0);

// Player and Narrator exchange serialized intents; only the authority resumes the tail.
let authority=fixture();authority.actors[0].ownerId="player";authority.actors[0].hp=1;authority.actors[0].wounds=2;
authority=run(authority,"e",{kind:"attack",targetIds:["h"],amount:5,repeat:2});
const replica=()=>JSON.parse(JSON.stringify(engine.projectScene(authority,{role:"player",actorIds:["h"]})));
let playerScene=replica();
const answer=network.intentFromEvents(playerScene,[lw.command("h",{kind:"reaction",choice:"take"})],"Принять");
const authoritativeAnswer=network.materializeIntent(authority,context.window.DAWN_DATA,JSON.parse(JSON.stringify(answer)),"player");
authority=lw.dispatchMany(authority,authoritativeAnswer).scene;
authority=run(authority,"e",{kind:"resolve-attack"});playerScene=replica();
assert.equal(playerScene.lionwing.deferred,undefined);assert.equal(playerScene.lionwing.choices[0].kind,"knockout");
const resistance=network.intentFromEvents(playerScene,[lw.command("h",{kind:"choice",id:playerScene.lionwing.choices[0].id,choice:"resist"})],"Сопротивляться");
assert.throws(()=>network.materializeIntent(authority,context.window.DAWN_DATA,resistance,"other-player"),/владеет/);
const resistanceEvents=network.materializeIntent(authority,context.window.DAWN_DATA,JSON.parse(JSON.stringify(resistance)),"player");
authority=lw.dispatchMany(authority,resistanceEvents).scene;playerScene=replica();
assert.equal(authority.lionwing.deferred.length,0);assert.equal(playerScene.actors[0].hp,11);assert.equal(playerScene.actors[0].wounds,1);assert.equal(playerScene.lionwing.choices.length,0);
console.log("LionWing serialized two-client flow: ownership, reactions, private continuation and Resistance passed");

// A Narrator pauses an Attack, resolves a manual counterattack, then resumes it.
s=fixture();s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"attack",targetIds:["e"],amount:2});const originalAttackId=s.pendingAction.id;
s=run(s,"h",{kind:"pause-chain"});assert.equal(s.pendingAction,null);assert.equal(s.lionwing.pausedChains.length,1);
throws(s,"h",{kind:"turn-end"},/Нельзя/);
s=run(s,"h",{kind:"allow-action",targetId:"e",actionId:ids.charge,cost:0,uses:1,swift:true,reaction:true});
s=prepare(s,"e",{kind:"action",actionId:ids.charge});assert.equal(s.activeActorId,"h");
s=run(s,"e",{kind:"attack",targetIds:["h"],amount:1});throws(s,"h",{kind:"resume-chain"},/вложенное|завершите Атаку/);
s=run(s,"h",{kind:"reaction",choice:"take"});s=run(s,"e",{kind:"resolve-attack"});s=run(JSON.parse(JSON.stringify(s)),"h",{kind:"resume-chain"});assert.equal(s.pendingAction.id,originalAttackId);
// Inverted Focus is generic: payments add and gains reduce, without a named Technique.
s=fixture();s=run(s,"h",{kind:"configure-resource",id:"heat",value:0,replaces:"focus",inverted:true});
assert.equal(lw.canSpend(s.actors[0],"focus",2),true);s=run(s,"h",{kind:"resource",resource:"focus",operation:"spend",amount:2});assert.equal(s.actors[0].ruleResources.heat.value,2);
s=run(s,"h",{kind:"resource",resource:"focus",operation:"gain",amount:4});assert.equal(s.actors[0].ruleResources.heat.value,0);
// Counters keep their lifecycle through serialization; boundaries affect only the owner.
s=fixture();s=run(s,"h",{kind:"configure-resource",id:"pride",value:4,maximum:8,initial:1,resetAt:"startTurn"});
s=run(s,"e",{kind:"clock",id:"watch",value:3,size:6,initial:2,resetAt:"startTurn"});
s=run(JSON.parse(JSON.stringify(s)),"h",{kind:"turn-start"});assert.equal(s.actors[0].ruleResources.pride.value,1);assert.equal(s.actors[1].ruleClocks.watch.value,3);
s=run(s,"h",{kind:"configure-resource",id:"pride",value:5});assert.equal(s.actors[0].ruleResources.pride.maximum,8);assert.equal(s.actors[0].ruleResources.pride.resetAt,"startTurn");
s=run(s,"h",{kind:"clock",id:"style",size:8,value:6,initial:2,resetAt:"endTurn"});
s=run(s,"h",{kind:"clock",id:"round",size:8,value:6,initial:1,resetAt:"roundEnd"});
s=run(s,"h",{kind:"clock",id:"scene",size:8,value:6,initial:3,resetAt:"scene"});
s=run(s,"h",{kind:"turn-end"});assert.equal(s.actors[0].ruleClocks.style.value,2);
s=run(s,"e",{kind:"turn-start"});assert.equal(s.actors[1].ruleClocks.watch.value,2);s=run(s,"e",{kind:"turn-end"});
s=run(s,null,{kind:"round-end"});assert.equal(s.actors[0].ruleClocks.round.value,1);assert.equal(s.actors[0].ruleClocks.scene.value,6);
s=run(s,null,{kind:"scene-reset"});assert.equal(s.actors[0].ruleClocks.scene.value,3);assert.equal(s.actors[0].ruleResources.pride.value,5);
s=run(s,"h",{kind:"counter",type:"resource",operation:"reset",id:"pride"});assert.equal(s.actors[0].ruleResources.pride.value,1);
s=run(s,"h",{kind:"counter",type:"clock",operation:"remove",id:"style"});assert.equal(s.actors[0].ruleClocks.style,undefined);
throws(s,"h",{kind:"clock",id:"bad",size:3,initial:4},/сброса/);throws(s,"h",{kind:"configure-resource",id:"bad",resetAt:"everySecond"},/срок/);
assert.ok(s.log.some(e=>e.type==="rule-clock.reset"));
// Losing one source does not remove Fear from a second, still active source.
s=fixture();s.actors.push({...hero("e2",4,4),kind:"enemy",team:"enemy",heroId:null});
s=run(s,"e",{kind:"effect",targetId:"h",effect:"negative.испуган"});s=run(s,"e2",{kind:"effect",targetId:"h",effect:"negative.испуган"});
s=run(s,"h",{kind:"knockout",targetId:"e"});assert.ok(s.actors[0].effects.includes("negative.испуган"));assert.equal(s.actors[0].effectStates["negative.испуган"].sources.length,1);
s=run(s,"h",{kind:"knockout",targetId:"e2"});assert.ok(!s.actors[0].effects.includes("negative.испуган"));
// Search and automatic expiry each produce exactly one reappearance decision.
s=fixture();s=run(s,"h",{kind:"turn-start"});s=run(s,"e",{kind:"effect",targetId:"e",effect:"positive.исчез"});s=run(s,"h",{kind:"search",targetId:"e"});assert.equal(s.actors[0].ap,1);assert.equal(s.lionwing.choices.length,1);assert.equal(s.lionwing.choices[0].context.reappear,true);
s=fixture();s=run(s,"h",{kind:"effect",targetId:"h",effect:"positive.исчез",duration:"startTurn"});s=run(s,"h",{kind:"turn-start"});assert.equal(s.lionwing.choices.length,1);
// Blighted triggers on a manually composed Attack as well as a basic action.
s=fixture();s=run(s,"h",{kind:"effect",targetId:"h",effect:"negative.порчен"});s=run(s,"h",{kind:"attack",targetIds:["e"],amount:1});s=run(s,"e",{kind:"reaction",choice:"take"});s=run(s,"h",{kind:"resolve-attack"});assert.equal(s.actors[0].hp,15);
console.log("LionWing effects and counters: source removal, reappearance, Blighted, lifecycle, persistence and strict bounds passed");
// The UI's "by the rule" duration must use special canonical lifetimes.
s=fixture();s=run(s,"h",{kind:"effect",targetId:"h",effect:"positive.регенерирует",duration:"default"});s.actors[0].hp=5;
s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"turn-end"});assert.equal(s.actors[0].hp,10);assert.ok(s.actors[0].effects.includes("positive.регенерирует"));
s=fixture();s=run(s,"h",{kind:"effect",targetId:"h",effect:"positive.изгнан",duration:"default"});s=run(s,"h",{kind:"turn-start"});assert.ok(!s.actors[0].effects.includes("positive.изгнан"));
// Banishing one body copies the Effect to every part, without the copies cancelling each other.
s=fixture();s.actors[1].compoundId="boss";s.actors.push({...s.actors[1],id:"part"});
s=run(s,"h",{kind:"effect",targetId:"e",effect:"positive.изгнан"});assert.ok(s.actors.slice(1).every(a=>a.effects.includes("positive.изгнан")));
s=run(s,"h",{kind:"effect",targetId:"h",effect:"positive.изгнан"});assert.ok(s.actors.slice(1).every(a=>!a.effects.includes("positive.изгнан")));
// Launched postpones the immediately following Turn; it does not force every ally to act first.
s=fixture();s.actors.push(hero("ally",0,0),hero("ally2",0,2));s=run(s,"e",{kind:"effect",targetId:"h",effect:"negative.подброшен"});
assert.equal(lw.turnStartStatus(s,"h").available,false);s=run(s,"ally",{kind:"turn-start"});s=run(s,"ally",{kind:"turn-end"});s=run(s,"e",{kind:"turn-start"});s=run(s,"e",{kind:"turn-end"});assert.equal(lw.turnStartStatus(s,"h").available,true);
console.log("LionWing canonical lifetimes: UI default, Compound Banish and immediate Launch delay passed");
// Regeneration heals the shared body only up to the next intact Health Gate.
s=fixture();s.actors[1].compoundId="boss";s.actors.push({...s.actors[1],id:"part"});
s=run(s,"h",{kind:"damage",targetId:"e",amount:25});s=run(s,"h",{kind:"damage",targetId:"e",amount:2});
s=run(s,"h",{kind:"effect",targetId:"e",effect:"positive.регенерирует",duration:"default"});
s=run(s,"h",{kind:"turn-start"});s=run(s,"h",{kind:"turn-end"});s=run(s,"e",{kind:"turn-start"});s=run(s,"e",{kind:"turn-end"});assert.equal(s.actors[1].hp+s.actors[2].hp,20);
