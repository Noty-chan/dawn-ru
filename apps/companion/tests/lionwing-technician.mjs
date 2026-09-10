import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
const Engine = context.window.DAWN_LIONWING_ENGINE;
const SceneEngine = context.window.DAWN_SCENE_ENGINE;
const Adapters = context.window.DAWN_LIONWING_ADAPTERS;
const data = context.window.DAWN_LIONWING_DATA;
const sceneData = { ...data, actions: data.coreRules.actions, effects: data.coreRules.effects };
const IDS = {
  skirmish: "action.атаки.стычка",
  finish: "action.атаки.завершение",
  charge: "action.утилитарные-действия.зарядка",
};
const DIGESTS = {
  "powerhouse.technician.1": "79946bc3df6de994901a8519030345403e62c0fac627a76aaa8bc0ee45edda83",
  "powerhouse.technician.2": "87d635215f2088e683f229d48bc51b0f2bc34d6a88bc1dea707fcea12e4be250",
  "powerhouse.technician.3": "69e9007f8f65def64ef7640b8441616852def68765ad7a717f09587b1039ecfe",
};
const actor = (extra = {}) => ({
  id: "tech", name: "Техник", kind: "hero", heroId: "tech", rulesEdition: "lionwing", team: "hero",
  space: "main", x: 1, y: 1, hp: 10, maxHp: 10, ap: 3, baseAp: 3, focus: 2, influence: 0,
  wounds: 0, stress: 0, tier: 3, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {}, usedActions: [],
  acted: false, knockedOut: false, knownTechniques: { "powerhouse.technician": 3 }, techniques: {},
  lionwing: { automation: { ...Object.fromEntries(Object.keys(DIGESTS).map(id => [id, true])) }, history: [] }, ...extra,
});
const scene = (tech = actor(), overrides = {}) => ({
  rulesEdition: "lionwing", version: 0, round: 1, tension: 0, turnSerial: 1, activeActorId: "tech",
  activeSpace: "main", spaces: [{ id: "main", width: 7, height: 7 }], actors: [tech], objects: [], walls: [],
  markers: [], log: [], targetIds: [], reminders: [], rollFeed: [], lionwing: {
    schema: 2, sceneSerial: 1, activeTurnInstanceId: "turn-1", choices: [], deferred: [], history: [], afterEventReceipts: [], ...overrides.lionwing,
  }, ...overrides,
});
const event = (id, actionId, actionInstanceId, ownerTurnInstanceId = "turn-1") => ({
  id, type: "action.resolve", actorId: "tech", execution: { rootActionId: id, actionInstanceId, ownerTurnInstanceId },
  payload: { actionId, actionInstanceId, ownerTurnInstanceId },
});
const hist = (actionId, actionInstanceId, ownerTurnInstanceId = "turn-1", turnSerial = 1) => ({
  actionId, actionInstanceId, ownerTurnInstanceId, turnSerial, ownerTurnSerial: turnSerial,
});
const adapterTriggers = (s, e) => Adapters.afterEvent(s.actors[0], e, {
  scene: s, ownerTurnSerial: 1, ownerTurnInstanceId: s.lionwing.activeTurnInstanceId,
});

// All three levels are registered, digest-bound, and honestly partial.
for (const [id, digest] of Object.entries(DIGESTS).slice(0, 2)) {
  const rule = Adapters.list(actor()).find(item => item.id === id);
  assert.equal(rule?.sourceDigest, digest, `${id} adapter source digest`);
  assert.equal(rule?.coverage, "partial", `${id} adapter coverage`);
}

// Charge opens the one-use Stretch clock from an authoritative receipt.
let s = scene();
let charge = event("charge", IDS.charge, "charge-1");
let triggers = adapterTriggers(s, charge);
assert.equal(triggers.length, 1);
assert.equal(triggers[0].id, "powerhouse.technician.1");
assert.equal(triggers[0].operations[0].kind, "clock");
assert.equal(JSON.stringify(triggers[0].operations[0].lifetime), JSON.stringify({
  boundary: "endNextOwnerTurn", ownerActorId: "tech", ownerTurnSerial: 1,
  ownerTurnInstanceId: "turn-1", sceneSerial: 1,
}));

// A completed Skirmish → Finisher gives AP and Armor; the request flag alone
// cannot manufacture a combo, and an intervening action breaks the sequence.
s.actors[0].ruleClocks = { "powerhouse.technician.stretch": { current: 1, max: 1 } };
s.actors[0].lionwing.history = [hist(IDS.skirmish, "skirmish-1"), hist(IDS.finish, "finish-1")];
triggers = adapterTriggers(s, event("finish", IDS.finish, "finish-1"));
assert.equal(triggers.length, 2);
assert.equal(triggers[0].id, "powerhouse.technician.1");
assert.equal(triggers[1].id, "powerhouse.technician.2");
assert.equal(triggers[0].operations[0].resource, "ap");
assert.equal(triggers[1].operations[0].amount, 2);

s.actors[0].lionwing.history = [hist(IDS.skirmish, "skirmish-1"), hist("action.движение.шаг", "step-1"), hist(IDS.finish, "finish-1")];
assert.equal(adapterTriggers(s, event("wrong-order", IDS.finish, "finish-1")).length, 0, "an intervening Action breaks the combo");
s.actors[0].lionwing.history = [hist(IDS.skirmish, "skirmish-old", "old-turn", 0), hist(IDS.finish, "finish-old", "old-turn", 0)];
assert.equal(adapterTriggers(s, event("extra-turn", IDS.finish, "finish-old")).length, 0, "another Turn cannot complete this combo");

// Forged action payloads and cosmetic combo flags are rejected without an
// engine receipt and without matching authoritative history.
const forged = { id: "forged", type: "action.resolve", actorId: "tech", payload: { actionId: IDS.charge, actionInstanceId: "fake" } };
assert.equal(adapterTriggers(scene(), forged).length, 0, "Charge needs execution provenance");
const flagged = { id: "flagged", type: "action.resolve", actorId: "tech", payload: { actionId: IDS.finish, actionInstanceId: "fake", combo: true }, execution: { rootActionId: "flagged", actionInstanceId: "fake" } };
assert.equal(adapterTriggers(scene(), flagged).length, 0, "combo boolean is not evidence");
s.actors[0].lionwing.history = [hist(IDS.skirmish, "skirmish-1"), hist(IDS.finish, "other-finish")];
assert.equal(adapterTriggers(s, event("mismatch", IDS.finish, "finish-1")).length, 0, "action instance mismatch is rejected");

// The neutral engine can persist the clock and action history.  The command
// is deliberately a no-roll record, which still receives a generated action
// instance from the engine provenance.
let live = scene(actor({ lionwing: { automation: { "powerhouse.technician.1": true, "powerhouse.technician.2": true, "powerhouse.technician.3": true }, history: [] } }));
live.actors.push({ id: "enemy", name: "Enemy", kind: "enemy", team: "enemy", rulesEdition: "lionwing", space: "main", x: 3, y: 1, hp: 10, maxHp: 10, ap: 0, baseAp: 0, usedActions: [], acted: false, knockedOut: false, lionwing: {} });
const command = (id, payload, actorId = "tech") => ({ id, type: "lionwing.command", actorId, payload });
let result = Engine.dispatchMany(live, [command("live-charge", { kind: "record-action", actionId: IDS.charge })]);
assert.ok(result.scene);
live = result.scene;
assert.equal(live.actors[0].ruleClocks?.["powerhouse.technician.stretch"]?.current, 1, "scheduler applied Stretch clock");
result = Engine.dispatchMany(live, [command("live-skirmish", { kind: "record-action", actionId: IDS.skirmish })]);
assert.ok(result.scene);
live = result.scene;
result = Engine.dispatchMany(live, [command("live-finish", { kind: "record-action", actionId: IDS.finish })]);
assert.ok(result.scene);
live = result.scene;
assert.equal(live.actors[0].ap, 4, "scheduler granted one AP for the completed combo");
assert.equal(live.actors[0].lionwing.modifiers?.some(item => item.ruleId === "powerhouse.technician.2"), true, "scheduler applied Perfect Form");

// Reload and duplicate replay are idempotent; no second AP or modifier is
// created. A fresh owner Turn expires Stretch at the neutral lifecycle edge.
const apAfterCombo = live.actors[0].ap;
const reloaded = Engine.reload(JSON.parse(JSON.stringify(live)));
const replay = Engine.dispatchMany(reloaded, [command("live-finish", { kind: "record-action", actionId: IDS.finish })]);
assert.deepEqual(replay.scene, reloaded, "duplicate completed command is ignored after reload");
assert.equal(reloaded.actors[0].ap, apAfterCombo);
let expired = Engine.dispatchMany(live, [command("end-owner", { kind: "turn-end" })]);
assert.ok(expired.scene);
expired = Engine.dispatchMany(expired.scene, [command("start-enemy", { kind: "turn-start" }, "enemy")]).scene;
expired = Engine.dispatchMany(expired, [command("end-enemy", { kind: "turn-end" }, "enemy")]).scene;
const stretchLifetime = expired.actors.find(item => item.id === "tech").ruleClocks["powerhouse.technician.stretch"].lifetime;
assert.equal(context.window.DAWN_LIONWING_EXECUTION.isLifetimeExpired(stretchLifetime, { phase: "end", ownerActorId: "tech", ownerTurnSerial: 2, sceneSerial: 1 }), true, "Stretch expires at the end of the next owner Turn");

// Technician III uses the existing ActionPlan/finisher pipeline and costs 1 AP.
const comboScene = scene(actor({ ap: 3, lionwing: { automation: { "powerhouse.technician.3": true }, history: [hist(IDS.skirmish, "skirmish-3")] } }));
comboScene.actors.push({ id: "target", name: "Target", kind: "enemy", team: "enemy", rulesEdition: "lionwing", space: "main", x: 2, y: 1, hp: 10, maxHp: 10, ap: 0, usedActions: [], acted: false, knockedOut: false, lionwing: {} });
const comboStatus = SceneEngine.techniqueComboStatus(comboScene, sceneData, "tech", "powerhouse.technician.3");
assert.equal(comboStatus.available, true, comboStatus.reason);
const prepared = SceneEngine.prepareTechniqueCombo(comboScene, sceneData, {
  actorId: "tech", ruleId: "powerhouse.technician.3", targetIds: ["target"], roll: null,
});
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
assert.equal(prepared.rule.sourceDigest, DIGESTS["powerhouse.technician.3"]);
assert.equal(prepared.events.find(item => item.type === "resource.spend")?.payload.amount, 1, "Finisher costs 1 AP");
const cancelled = SceneEngine.cancelPendingAction({ ...comboScene, pendingAction: { id: "pending-combo", actorId: "tech", targetIds: [], allowEmptyTargets: true } }, { actorId: "tech" });
assert.equal(cancelled.ok, true, "pending combo can be cancelled before resolution");
assert.equal(cancelled.events.at(-1).type, "attack.clear");

console.log("LionWing Technician I–III passed: digests, authoritative combo order, forged context, neutral scheduler, reload/duplicate safety, expiry fixture, and cancellable Finisher plan");
