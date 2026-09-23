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

// Canonical LionWing turn/round passives enter through the same boundaries
// used by the Scene UI; their state must survive reload and idempotent replay.
let roninTurns = scene([actor("ronin", "enemy", 2, 2, { profileId: "lionwing.npc.ronin", baseAp: 3 })]);
roninTurns.lionwing.started = true;
const roninStart = { id: "ronin-passive-start", type: "turn.start", actorId: "ronin", payload: {} };
roninTurns = engine.dispatchMany(roninTurns, [roninStart], { expectedVersion: roninTurns.version }).scene;
assert.equal(source(roninTurns, "ronin").ap, 4, "Ronin starts a normal Turn with one additional AP");
assert.equal(roninTurns.log.find(item => item.type === "turn.start")?.payload?.passiveAp, 1, "the Turn receipt exposes the passive AP applied");
const reloadedRoninTurns = context.window.DAWN_LIONWING_ENGINE.reload(JSON.stringify(roninTurns));
assert.equal(source(reloadedRoninTurns, "ronin").ap, 4, "Ronin's current AP survives JSON reload");
const replayedRoninStart = engine.dispatchMany(reloadedRoninTurns, [roninStart], { expectedVersion: reloadedRoninTurns.version });
assert.equal(replayedRoninStart.scene.version, reloadedRoninTurns.version, "replaying the same Turn boundary does not grant AP twice");
assert.equal(source(replayedRoninStart.scene, "ronin").ap, 4);
roninTurns = commit(roninTurns, [{ type: "turn.end", actorId: "ronin", payload: {} }]);
const grantExtra = context.window.DAWN_LIONWING_ENGINE.command("ronin", { kind: "grant-turn", targetId: "ronin" });
roninTurns = commit(roninTurns, [grantExtra]);
roninTurns = commit(roninTurns, [{ type: "turn.start", actorId: "ronin", payload: {} }]);
assert.equal(roninTurns.lionwing.activeTurn.kind, "extra", "the second start is the granted extra Turn");
assert.equal(source(roninTurns, "ronin").ap, 4, "Ronin receives the passive AP on an extra Turn too");

let stunnedRonin = scene([actor("ronin", "enemy", 2, 2, { profileId: "lionwing.npc.ronin", baseAp: 3, effects: ["negative.ошеломлен"] })]);
stunnedRonin.lionwing.started = true;
stunnedRonin = commit(stunnedRonin, [{ type: "turn.start", actorId: "ronin", payload: {} }]);
assert.equal(source(stunnedRonin, "ronin").ap, 3, "Ronin's +1 AP and the ordinary Staggered loss both apply");
const knockedOutRonin = scene([actor("ronin", "enemy", 2, 2, { profileId: "lionwing.npc.ronin", knockedOut: true, hp: 0 })]);
knockedOutRonin.lionwing.started = true;
assert.equal(engine.turnStartStatus(knockedOutRonin, "ronin").available, false, "a Knocked Out Ronin cannot start a Turn to gain AP");

let alliedRonin = scene([actor("ronin", "hero", 2, 2, { profileId: "lionwing.npc.ronin", baseAp: 3 }), actor("hero", "hero", 6, 6, { kind: "hero", acted: true })]);
alliedRonin.lionwing.started = true;
alliedRonin.lionwing.lastTeam = "enemy";
alliedRonin = commit(alliedRonin, [{ type: "turn.start", actorId: "ronin", payload: {} }]);
assert.equal(source(alliedRonin, "ronin").ap, 4, "the passive follows the NPC profile when it is allied to heroes");

const martyrScene = scene([
  actor("enemy-martyr", "enemy", 5, 3, { profileId: "lionwing.npc.martyr", tier: 2, hp: 10, maxHp: 24 }),
  actor("allied-martyr", "hero", 4, 3, { profileId: "lionwing.npc.martyr", tier: 1, hp: 20, maxHp: 24 }),
  actor("ko-martyr", "enemy", 5, 4, { profileId: "lionwing.npc.martyr", tier: 3, hp: 0, maxHp: 28, knockedOut: true }),
  actor("legacy-martyr", "enemy", 6, 3, { profileId: "enemy.common.martyr", tier: 2, hp: 10, maxHp: 24 }),
  actor("hero", "hero", 0, 0, { kind: "hero", acted: true }),
]);
martyrScene.lionwing.started = true;
martyrScene.lionwing.lastTeam = "enemy";
const martyrRoundEnd = { id: "martyr-passive-round-end", type: "round.end", actorId: null, payload: {} };
const martyrResult = engine.dispatchMany(martyrScene, [martyrRoundEnd], { expectedVersion: martyrScene.version });
const healedMartyrScene = martyrResult.scene;
assert.equal(source(healedMartyrScene, "enemy-martyr").hp, 17, "a Tier 2 Martyr restores 5 + Tier HP at the Round boundary");
assert.equal(source(healedMartyrScene, "allied-martyr").hp, 24, "an allied Martyr uses the same self-heal and caps at maximum HP");
assert.equal(source(healedMartyrScene, "ko-martyr").hp, 0, "a Knocked Out Martyr is not revived by an unspecified passive");
assert.equal(source(healedMartyrScene, "ko-martyr").knockedOut, true);
assert.equal(source(healedMartyrScene, "legacy-martyr").hp, 10, "the old-edition profile is not treated as a LionWing passive");
const martyrHealEvents = martyrResult.events.filter(item => item.type === "actor.heal");
assert.equal(martyrResult.events.findIndex(item => item.type === "round.end") < martyrResult.events.findIndex(item => item.type === "actor.heal"), true, "the passive heals after the Round boundary event");
assert.equal(martyrHealEvents.length, 2, "each living LionWing Martyr heals once");
assert.equal(martyrHealEvents[0].payload.amount, 7);
assert.equal(martyrHealEvents[0].payload.restored, 7);
assert.equal(martyrHealEvents[0].payload.passiveKey, "lionwing.npc.martyr#passive");
assert.equal(martyrHealEvents[0].payload.boundaryEventId, martyrResult.events.find(item => item.type === "round.end").id);
const reloadedMartyrs = context.window.DAWN_LIONWING_ENGINE.reload(JSON.stringify(healedMartyrScene));
assert.equal(source(reloadedMartyrs, "enemy-martyr").hp, 17, "the Round-end heal survives scene reload");
const replayedMartyrEnd = engine.dispatchMany(reloadedMartyrs, [martyrRoundEnd], { expectedVersion: reloadedMartyrs.version });
assert.equal(replayedMartyrEnd.events.length, 0, "replaying the Round boundary does not heal twice");
assert.equal(source(replayedMartyrEnd.scene, "enemy-martyr").hp, 17);
const noMartyrScene = JSON.parse(JSON.stringify(martyrScene));
noMartyrScene.actors = noMartyrScene.actors.filter(item => item.profileId !== "lionwing.npc.martyr");
const noMartyrResult = engine.dispatchMany(noMartyrScene, [{ id: "martyr-source-removed", type: "round.end", actorId: null, payload: {} }], { expectedVersion: noMartyrScene.version });
assert.equal(noMartyrResult.events.some(item => item.type === "actor.heal"), false, "a removed Martyr has no remaining source to trigger the passive");

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
