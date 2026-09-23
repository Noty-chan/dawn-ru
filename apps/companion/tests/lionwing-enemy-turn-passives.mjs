import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "lionwing-table-data.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const engine = context.window.DAWN_SCENE_ENGINE, data = context.window.DAWN_DATA;
const actor = (id, team, x, y, extra = {}) => ({ id, name: id, kind: "enemy", rulesEdition: "lionwing", team, space: "main", x, y, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 0, influence: 0, wounds: 0, stress: 0, tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, lionwing: {}, ...extra });
const scene = actors => ({ rulesEdition: "lionwing", version: 0, round: 2, turnSerial: 0, activeActorId: null, tension: 1, spaces: [{ id: "main", name: "Main", width: 7, height: 7 }], actors, objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] }, targetIds: [], targetCells: [], reminders: [], rollFeed: [], log: [], triggerQueue: [], lionwing: { entities: {}, entityReceipts: {} } });
let sequence = 0;
const commit = (current, events, opts = {}) => engine.dispatchMany(current, events.map(event => ({ ...event, id: event.id || `passive-${sequence++}` })), { expectedVersion: current.version, ...opts }).scene;
const source = (current, id) => current.actors.find(item => item.id === id);
const resolveAttack = (current, prepared, label) => {
  let next = commit(current, prepared.events);
  if (next.pendingAction) {
    const response = engine.respondReaction(next, data, { actorId: next.pendingAction.targetIds[0], choice: "pass" });
    next = commit(next, response.events);
    const resolved = engine.resolvePendingAction(next, data);
    next = commit(next, resolved.events);
  }
  return next;
};

// Ronin's targets are scoped to the current Turn; the real enemy-rule preparer and dispatcher are used.
let current = scene([actor("ronin", "enemy", 2, 2, { profileId: "lionwing.npc.ronin", baseAp: 3 }), actor("target-a", "hero", 2, 1, { kind: "hero" }), actor("target-b", "hero", 3, 2, { kind: "hero" }), actor("previous-hero", "hero", 6, 6, { kind: "hero", acted: true })]);
current.log.push({ id: "previous-hero-turn-end", type: "turn.end", actorId: "previous-hero", at: "2026-09-23T09:59:00.000Z", payload: {} });
current = commit(current, [{ type: "turn.start", actorId: "ronin", payload: {} }]);
assert.equal(current.activeActorId, "ronin");
const roll = { formula: "4D6 · Dissect", rolls: [6, 5, 2, 1], successes: 2, crits: 1 };
const dissect = id => engine.prepareEnemyRule(current, data, { actorId: "ronin", ruleId: "lionwing.npc.ronin.dissect", targetIds: [id], roll });
const first = dissect("target-a");
assert.equal(first.ok, true, first.errors?.join(" "));
current = resolveAttack(current, first, "first");
const repeat = engine.prepareEnemyRule(current, data, { actorId: "ronin", ruleId: "lionwing.npc.ronin.dissect", targetIds: ["target-a"], roll });
assert.equal(repeat.ok, false, "the canonical once-per-Round action gate remains separate from this passive");
const firstAttack = current.log.find(item => item.type === "attack.pending" && item.actorId === "ronin");
assert.deepEqual(Array.from(firstAttack.payload.targetIds), ["target-a"]);
const duplicateTargetAttack = { ...firstAttack, id: "duplicate-target", payload: { ...firstAttack.payload, targetIds: ["target-a", "target-b"] } };
assert.throws(() => engine.validateEvent(current, duplicateTargetAttack, { narratorOverride: true }), /повторно за Ход/);
const differentTargetAttack = { ...firstAttack, id: "different-target", payload: { ...firstAttack.payload, targetIds: ["target-b"] } };
assert.doesNotThrow(() => engine.validateEvent(current, differentTargetAttack, { narratorOverride: true }));
const firstAction = current.log.find(item => item.type === "enemy.action.prepare" && item.actorId === "ronin");
assert.throws(() => engine.dispatchMany(current, [{ ...firstAction, id: "repeat-action-target", payload: { ...firstAction.payload } }]), /повторно за Ход/);
const beforeReplayVersion = current.version, replay = engine.dispatchMany(current, [firstAction], { expectedVersion: current.version });
assert.equal(replay.scene.version, beforeReplayVersion, "replaying the old preparation event id is idempotent");
assert.throws(() => engine.dispatchMany(current, [{ ...firstAction, id: "stale-repeat", payload: { ...firstAction.payload } }], { expectedVersion: current.version - 1 }), /версии|устарел/i);
const restored = context.window.DAWN_LIONWING_ENGINE.reload(JSON.stringify(current));
assert.throws(() => engine.validateEvent(restored, { ...duplicateTargetAttack, id: "duplicate-after-reload" }, { narratorOverride: true }), /повторно за Ход/);
const alliedNpc = JSON.parse(JSON.stringify(current));
source(alliedNpc, "ronin").team = "hero";
assert.throws(() => engine.validateEvent(alliedNpc, { ...duplicateTargetAttack, id: "allied-ronin-repeat" }, { narratorOverride: true }), /повторно за Ход/);
assert.equal(current.log.filter(item => item.type === "attack.pending" && item.actorId === "ronin").length, 1);
current.activeActorId = "ronin"; current.turnSerial += 1;
current.log.unshift({ id: "turn-start-ronin-next", type: "turn.start", actorId: "ronin", at: "2026-09-23T10:01:00.000Z", payload: {} });
const nextTurnRepeat = engine.prepareEnemyRule(current, data, { actorId: "ronin", ruleId: "lionwing.npc.ronin.dissect", targetIds: ["target-a"], roll });
assert.equal(nextTurnRepeat.ok, false, "the canonical once-per-Round action gate remains separate from this passive");
assert.doesNotThrow(() => engine.validateEvent(current, { ...duplicateTargetAttack, id: "fresh-turn-target", payload: { ...duplicateTargetAttack.payload } }, { narratorOverride: true }));

console.log("LionWing Ronin Turn target passive checks passed");
