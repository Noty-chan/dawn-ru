import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;
const baseAdapters = context.window.DAWN_LIONWING_ADAPTERS;
const bridge = context.window.DAWN_LIONWING_FOUNDATION;

const actor = id => ({ id, name: id, kind: "hero", heroId: id, ownerId: id, rulesEdition: "lionwing", team: "hero", space: "main", x: 1, y: 1,
  hp: 12, maxHp: 12, ap: 0, baseAp: 3, focus: 0, influence: 0, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false,
  knownTechniques: {}, techniques: {}, lionwing: { automation: {} } });
const initial = () => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null,
  spaces: [{ id: "main", width: 5, height: 5 }], actors: [actor("hero"), { ...actor("other"), team: "enemy", x: 3, kind: "npc" }], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [] });
const command = (scene, id, actorId, payload) => engine.dispatchMany(scene, [engine.command(actorId, { id, ...payload })]).scene;
const breathe = "action.утилитарные-действия.передышка";

assert.deepEqual(bridge.boundaryDescriptor({ canonicalBoundary: "turnStart", sceneSerial: 2, round: 3, ownerActorId: "hero", ownerTurnSerial: 4 }).periodKey, "2:hero:4:ownTurnStart");
assert.equal(bridge.validateBoundaryDeclaration({ id: "test.bridge", sourceDigest: "en:source", operations: [{ kind: "note", note: "ok" }] }, { id: "hero" }, { boundary: "sceneStart", sceneSerial: 1 }).ok, true);
const rejected = bridge.validateBoundaryDeclaration({ id: "test.bridge", sourceDigest: "en:source", operations: [{ kind: "note", actorState: { focus: 99 } }] }, { id: "hero" }, { boundary: "sceneStart", sceneSerial: 1 });
assert.equal(rejected.ok, false);
assert.equal(rejected.manual, true);
const badTrigger = bridge.validateTriggerDeclaration({ id: "test.trigger", sourceDigest: "en:source", triggerKey: "event:hero", operations: [{ kind: "note", clientFlags: { accepted: true } }] }, { id: "hero" });
assert.equal(badTrigger.ok, false);
assert.equal(badTrigger.manual, true);

let scene = initial();
const start = engine.prepare(scene, { actorId: "hero", eventId: "bridge:start", kind: "turn-start" });
assert.equal(start.ok, true, start.errors?.join(" "));
scene = engine.dispatchMany(scene, start.events).scene;
assert.equal(engine.resourceQuote(scene, "hero", { resource: "ap", operation: "spend", amount: 2 }).available, true);
assert.equal(engine.resourceQuote(scene, "hero", { resource: "ap", operation: "spend", amount: 4 }).available, false);
const forgedSource = engine.previewEvents(scene, [{ id: "bridge:forged-source", type: "lionwing.command", actorId: "hero", payload: { kind: "deny-action", sourceActorId: "other", actionId: breathe } }]);
assert.equal(forgedSource.ok, false);

scene = command(scene, "bridge:deny", "hero", { kind: "deny-action", actionId: breathe, reason: "Тестовое правило", scope: "turn" });
assert.equal(engine.actionGate(scene, "hero", { actionId: breathe }).available, false);
assert.match(engine.actionGate(scene, "hero", { actionId: breathe }).reason, /Тестовое правило/);
const deniedAgain = command(scene, "bridge:deny", "hero", { kind: "deny-action", id: "bridge:deny:fixed", actionId: breathe, reason: "Идемпотентность", scope: "turn" });
const deniedReplay = command(deniedAgain, "bridge:deny", "hero", { kind: "deny-action", id: "bridge:deny:fixed", actionId: breathe, reason: "Идемпотентность", scope: "turn" });
assert.equal(deniedReplay.actors[0].lionwing.denials.length, deniedAgain.actors[0].lionwing.denials.length, "same denial id is idempotent");
scene = command(scene, "bridge:end", "hero", { kind: "turn-end" });
scene = command(scene, "bridge:other-start", "other", { kind: "turn-start" });
scene = command(scene, "bridge:other-end", "other", { kind: "turn-end" });
scene = command(scene, "bridge:round-end", "hero", { kind: "round-end" });
scene = command(scene, "bridge:hero-next", "hero", { kind: "turn-start" });
assert.equal(engine.actionGate(scene, "hero", { actionId: breathe }).available, true, "turn-scoped denial expires at the exact next own Turn boundary");

context.window.DAWN_LIONWING_ADAPTERS = Object.freeze({
  ...baseAdapters,
  boundaryOperations(owner, lifecycle) {
    if (owner.id === "hero" && lifecycle.canonicalBoundary === "sceneStart") return [{ id: "test.bad", sourceDigest: "en:source", operations: [{ kind: "note", actorState: { focus: 99 } }] }];
    return baseAdapters.boundaryOperations(owner, lifecycle);
  },
});
const fallbackStart = engine.prepare(initial(), { actorId: "hero", eventId: "bridge:fallback", kind: "turn-start" });
assert.equal(fallbackStart.ok, true, fallbackStart.errors?.join(" "));
const fallbackScene = engine.dispatchMany(initial(), fallbackStart.events).scene;
assert.ok(fallbackScene.log.some(row => row.type === "rule.manual-fallback" && row.payload.ruleId === "test.bad"));
assert.equal(fallbackScene.log.some(row => row.type === "rule.activated" && row.payload.ruleId === "test.bad"), false);

console.log("LionWing foundation bridge: validated declarations, authoritative resource/action gates, expiry, replay and manual fallback passed");
