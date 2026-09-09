import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const vmContext = { window: {}, console };
vm.createContext(vmContext);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), vmContext, { filename: file });
const Engine = loadSceneEngine(vmContext), Lionwing = vmContext.window.DAWN_LIONWING_ENGINE;
const Adapters = vmContext.window.DAWN_LIONWING_ADAPTERS;
const actor = (id, team, x, extra = {}) => ({ id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null, rulesEdition: "lionwing", team, space: "main", x, y: 1, hp: 12, maxHp: 12, ap: 3, baseAp: 3, focus: 3, influence: 0, wounds: 0, stress: 0, tier: 2, speed: 4, armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: { automation: {} }, ...extra });
const scene = (extra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor("hero", "hero", 1), actor("enemy", "enemy", 5)], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], ...extra });
const run = (value, id, payload) => { const prepared = Lionwing.prepare(value, { actorId: id, eventId: `scheduler:${Math.random()}`, ...payload }, { random: () => 0.2 }); assert.equal(prepared.ok, true, prepared.errors?.join(" ")); return Lionwing.dispatchMany(value, prepared.events).scene; };

let s = scene({ actors: [actor("hero", "hero", 1, { knownTechniques: { "powerhouse.monastic-sage": 2 }, techniques: { "powerhouse.monastic-sage": 2 }, lionwing: { automation: { "powerhouse.monastic-sage.2": true } } }), actor("enemy", "enemy", 5)] });
s = run(s, "hero", { kind: "turn-start" });
assert.ok(s.actors[0].lionwing.turnInstanceId, "normal Turn receives a stable instance ID");
assert.equal(s.actors[0].ruleClocks?.["powerhouse.monastic-sage.balance"]?.size, 8, "Monastic Warrior II creates its Balance clock at Scene start");
assert.equal(Lionwing.lifecycle(s, { ownerActorId: "hero", boundary: "ownTurnStart" }).extraTurn, false);
s.actors[0].ruleClocks["powerhouse.monastic-sage.balance"].current = 1;
s = run(s, "hero", { kind: "turn-end" });
assert.equal(s.lionwing.boundaryReceipts.filter(row => row.ruleId === "powerhouse.monastic-sage.2").length, 1, "Scene boundary receipt is retained");
const lifecycle = Lionwing.lifecycle(s, { ownerActorId: "hero", boundary: "ownTurnEnd", ruleId: "powerhouse.monastic-sage.2" });
assert.equal(lifecycle.receipt, null, "unfired own Turn boundary has no receipt");

let optional = scene({ activeActorId: null, turnSerial: 1, lionwing: { schema: 2, started: true, lastTeam: "enemy", boundaryReceipts: [], history: [], choices: [], deferred: [], afterEventReceipts: [] }, actors: [actor("hero", "hero", 1, { knownTechniques: { "powerhouse.monastic-sage": 2 }, techniques: { "powerhouse.monastic-sage": 2 }, ruleClocks: { "powerhouse.monastic-sage.balance": { size: 8, max: 8, current: 2, initial: 0, min: 0, resetAt: "scene", lifetime: "scene", ruleId: "powerhouse.monastic-sage.2" }, }, lionwing: { automation: { "powerhouse.monastic-sage.2": true }, ownerTurnSerial: 1 } }), actor("enemy", "enemy", 5)] });
optional = run(optional, "hero", { kind: "turn-start" });
assert.equal(optional.lionwing.choices[0]?.kind, "technique-trigger", "own Turn boundary creates an optional technique choice");
assert.deepEqual(Array.from(optional.lionwing.choices[0].options), ["skip", "strengthen", "hasten"]);
// The public query exposes a stable boundary vocabulary even when the current
// event is not a Turn transition.
assert.equal(Lionwing.lifecycle(optional, { ownerActorId: "hero", boundary: "turnStart" }).boundary, "ownTurnStart");
const publicOptional = Engine.projectScene(optional, { role: "player" });
assert.equal(publicOptional.lionwing.boundaryReceipts, undefined, "boundary receipts stay private in player projection");
assert.equal(publicOptional.lionwing.choices[0]?.title.includes("начале Хода"), true, "pending boundary choice explains its lifecycle reason");
assert.equal(Adapters.lifecycle.first(optional.actors[0], optional, { scope: "scene", ruleId: "missing" }), true, "first/once lifecycle query is available");
assert.equal(Adapters.lifecycle.nth(optional.actors[0], optional, 1, { scope: "scene", ruleId: "missing" }), true, "Nth lifecycle query is one-based");

const opportunist = actor("opportunist", "hero", 1, { focus: 2, knownTechniques: { "vagabond.opportunist": 2 }, techniques: { "vagabond.opportunist": 2 }, lionwing: { automation: { "vagabond.opportunist.2": true } } });
const ally = actor("ally", "hero", 2), enemy = actor("marked-target", "enemy", 3);
const allyAttack = { id: "attack:event", type: "action.resolve", actorId: "ally", payload: { actionId: "action.атаки.стычка", targetIds: [enemy.id], actionInstanceId: "attack:instance" }, execution: { ownerTurnInstanceId: "ally-turn" } };
const opportunistScene = scene({ actors: [opportunist, ally, enemy], lionwing: { schema: 2, sceneSerial: 1, activeTurnInstanceId: "ally-turn", choices: [], deferred: [], history: [], afterEventReceipts: [] } });
assert.equal(Adapters.afterEvent(opportunist, allyAttack, { scene: opportunistScene }).at(0)?.id, "vagabond.opportunist.2", "nearby ally attacks expose Opportunist II choice");
assert.equal(new Set(Adapters.list(opportunist).map(item => item.id)).size, Adapters.list(opportunist).length, "adapter catalog keeps stable unique rule IDs");

const technician = actor("technician", "hero", 1, { tier: 3, knownTechniques: { "powerhouse.technician": 2 }, techniques: { "powerhouse.technician": 2 }, lionwing: { automation: { "powerhouse.technician.1": true, "powerhouse.technician.2": true }, ownerTurnSerial: 2, history: [] } });
const technicianScene = scene({ activeActorId: "technician", turnSerial: 2, lionwing: { schema: 2, sceneSerial: 1, activeTurnInstanceId: "tech-turn", choices: [], deferred: [], history: [], afterEventReceipts: [] }, actors: [technician, actor("target", "enemy", 3)] });
const charge = { id: "charge:event", type: "action.resolve", actorId: "technician", payload: { actionId: "action.утилитарные-действия.зарядка", actionInstanceId: "charge-instance" }, execution: { ownerTurnInstanceId: "tech-turn" } };
const stretch = Adapters.afterEvent(technician, charge, { scene: technicianScene, ownerTurnSerial: 2 }).at(0);
assert.equal(stretch?.id, "powerhouse.technician.1", "Technician I exposes Stretch after Charge");
assert.equal(stretch.operations[0].lifetime.boundary, "endNextOwnerTurn", "Stretch uses an owner-bound lifetime descriptor");
const stretchApplied = Lionwing.dispatchMany(technicianScene, [Lionwing.command("technician", stretch.operations[0])]).scene;
assert.equal(stretchApplied.actors.find(item => item.id === "technician").ruleClocks["powerhouse.technician.stretch"].current, 1, "Stretch clock is written by the engine");
technician.ruleClocks = { "powerhouse.technician.stretch": { current: 1, value: 1 } };
technician.lionwing.history.push({ actionId: "action.атаки.стычка", ownerTurnInstanceId: "tech-turn", turnSerial: 2 });
technician.lionwing.history.push({ actionId: "action.атаки.завершение", ownerTurnInstanceId: "tech-turn", turnSerial: 2 });
const combo = { id: "combo:event", type: "action.resolve", actorId: "technician", payload: { actionId: "action.атаки.завершение", actionInstanceId: "combo-instance" }, execution: { ownerTurnInstanceId: "tech-turn" } };
const comboTriggers = Adapters.afterEvent(technician, combo, { scene: technicianScene, ownerTurnKey: "1:technician:2" });
assert.ok(comboTriggers.some(item => item.id === "powerhouse.technician.1" && item.operations.some(operation => operation.resource === "ap")), "Technician I grants AP after a completed Combo");
assert.ok(comboTriggers.some(item => item.id === "powerhouse.technician.2" && item.operations.some(operation => operation.stat === "armor")), "Technician II grants temporary Armor after a completed Combo");

console.log("LionWing lifecycle scheduler: canonical boundary context, stable receipts, scene Balance setup, and own Turn aliases passed");
