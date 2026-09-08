import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
}
const engine = loadSceneEngine(context), lw = context.window.DAWN_LIONWING_ENGINE;
const execution = context.window.DAWN_LIONWING_EXECUTION;
const clone = value => JSON.parse(JSON.stringify(value));
let sequence = 0;
const hero = (id, team = "hero") => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x: team === "hero" ? 1 : 4, y: 1,
  hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 4, influence: 2, wounds: 0, stress: 0,
  tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 },
  effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false,
});
const fixture = () => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null,
  spaces: [{ id: "main", width: 7, height: 7 }], actors: [hero("h"), hero("e", "enemy")],
  objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [],
});
const event = (actorId, payload, id = `turn-life-${++sequence}`) => ({ ...lw.command(actorId, payload), id });
const run = (scene, actorId, payload, id) => lw.dispatchMany(scene, [event(actorId, payload, id)]).scene;
const rejected = (scene, actorId, payload, matcher) => {
  const before = JSON.stringify(scene);
  assert.throws(() => run(scene, actorId, payload), matcher);
  assert.equal(JSON.stringify(scene), before, "a rejected transition does not mutate the source snapshot");
};
const actorState = (scene, id) => scene.actors.find(item => item.id === id).lionwing;

// The descriptor is pure, serializable data and expires only on its owner's
// requested boundary. A foreign Turn cannot consume it.
const startNext = execution.lifetimeBoundary("startNextOwnerTurn", { ownerActorId: "h", ownerTurnSerial: 1, sceneSerial: 1 });
const endNext = execution.lifetimeBoundary("end-next-owner-turn", { ownerActorId: "h", ownerTurnSerial: 1, sceneSerial: 1 });
assert.equal(execution.lifetimeExpired(startNext, { ownerActorId: "e", ownerTurnSerial: 1, sceneSerial: 1, phase: "start" }), false);
assert.equal(execution.lifetimeExpired(startNext, { ownerActorId: "h", ownerTurnSerial: 2, sceneSerial: 1, phase: "start" }), true);
assert.equal(execution.lifetimeExpired(startNext, { ownerActorId: "h", ownerTurnSerial: 2, sceneSerial: 1, phase: "end" }), false);
assert.equal(execution.lifetimeExpired(endNext, { ownerActorId: "h", ownerTurnSerial: 2, sceneSerial: 1, phase: "start" }), false);
assert.equal(execution.lifetimeExpired(endNext, { ownerActorId: "h", ownerTurnSerial: 2, sceneSerial: 1, phase: "end" }), true);
assert.equal(JSON.stringify(clone(startNext)), JSON.stringify(startNext), "lifetime boundaries contain JSON only");

// Starting a Turn assigns all compatible own-turn counters once. Two actions
// on that Turn have different instances but share the same owner-turn key.
let scene = fixture();
scene = run(scene, "h", { kind: "turn-start" }, "turn-h-1");
const firstTurn = actorState(scene, "h");
assert.equal(firstTurn.turnCount, 1);
assert.equal(firstTurn.ownerTurnSerial, 1);
assert.equal(firstTurn.turnsStarted, 1);
assert.equal(scene.lionwing.activeTurnInstanceId, "turn-h-1");
assert.equal(scene.lionwing.activeTurn.ownerTurnSerial, 1);
const actionId = "action.утилитарные-действия.передышка";
scene = run(scene, "h", { kind: "record-action", actionId, amount: 0, swift: true }, "action-h-1");
scene = run(scene, "h", { kind: "record-action", actionId, amount: 0, swift: true }, "action-h-2");
const actionFacts = scene.lionwing.history.filter(fact => fact.type === "apply" && fact.details.actionId === actionId);
assert.equal(actionFacts.length, 2);
assert.notEqual(actionFacts[0].actionInstanceId, actionFacts[1].actionInstanceId);
assert.equal(actionFacts[0].ownerTurnKey, actionFacts[1].ownerTurnKey);
assert.equal(actionFacts[0].ownerTurnSerial, 1);
assert.equal(execution.historyCount(actionFacts, { scope: "ownerTurn", ownerTurnKey: actionFacts[0].ownerTurnKey }), 2, "the stable owner-turn key is directly queryable");
let batchedActions = fixture();
batchedActions = run(batchedActions, "h", { kind: "turn-start" }, "batch-turn-h-1");
batchedActions = run(batchedActions, "h", { kind: "batch", operations: [
  { kind: "record-action", actionId, amount: 0, swift: true },
  { kind: "record-action", actionId, amount: 0, swift: true },
] }, "batch-actions-h-1");
const batchedFacts = batchedActions.lionwing.history.filter(fact => fact.type === "apply" && fact.details.actionId === actionId);
assert.equal(new Set(batchedFacts.map(fact => fact.actionInstanceId)).size, 2, "separate actions in one batch receive separate instance IDs");
assert.equal(batchedFacts[0].ownerTurnKey, batchedFacts[1].ownerTurnKey);

// A paused consequence retains the same Turn frame through JSON reload and
// resume; it is not a second Turn start.
scene = run(scene, "h", { kind: "attack", targetIds: ["e"], amount: 1 }, "attack-h-pause");
const pausedInstanceId = scene.lionwing.activeTurnInstanceId, pausedOwnerSerial = actorState(scene, "h").ownerTurnSerial;
scene = run(scene, "h", { kind: "pause-chain" }, "pause-h");
const paused = clone(scene);
scene = run(paused, "h", { kind: "resume-chain" }, "resume-h");
assert.equal(scene.lionwing.activeTurnInstanceId, pausedInstanceId);
assert.equal(actorState(scene, "h").ownerTurnSerial, pausedOwnerSerial);
assert.equal(scene.lionwing.activeTurn.ownerTurnKey, `1:h:${pausedOwnerSerial}`);
scene = run(scene, "h", { kind: "cancel-attack" }, "cancel-h-pause");

// An extra Turn is a genuinely new instance and increments only that actor's
// own serial. Its return path does not perform another normal reset.
scene = run(scene, "h", { kind: "grant-turn", targetId: "h" }, "grant-h-extra");
scene = run(scene, "h", { kind: "turn-end" }, "turn-h-1-end");
scene = run(scene, "h", { kind: "turn-start" }, "turn-h-extra");
assert.equal(actorState(scene, "h").ownerTurnSerial, 2);
assert.equal(scene.lionwing.activeTurn.kind, "extra");
assert.notEqual(scene.lionwing.activeTurnInstanceId, pausedInstanceId);
scene = run(scene, "h", { kind: "turn-end" }, "turn-h-extra-end");

// ownerTurn is tied to the active owner's own key; an action by h during e's
// Turn does not create or consume h's own Turn.
scene = run(scene, "e", { kind: "turn-start" }, "turn-e-1");
const hBeforeForeign = actorState(scene, "h").ownerTurnSerial;
scene = run(scene, "h", { kind: "record-action", actionId, amount: 0, swift: true, reaction: true }, "action-h-foreign");
assert.equal(actorState(scene, "h").ownerTurnSerial, hBeforeForeign);
const foreignFact = scene.lionwing.history.find(fact => fact.details.actionId === actionId && fact.actionInstanceId === "action-h-foreign");
assert.equal(foreignFact.ownerTurnActorId, "e");
assert.equal(foreignFact.ownerTurnSerial, 1);
assert.notEqual(foreignFact.ownerTurnKey, actorState(scene, "h").ownerTurnKey);

// A once-per-owner-Turn limit uses the exact owner key. It resets on h's next
// own Turn, while anyTurn remains scoped to e's current global instance.
rejected(scene, "h", { kind: "usage", ruleId: "test.owner-once", scope: "ownerTurn", limit: 1 }, /собственном Ходу/i);
scene = run(scene, "h", { kind: "usage", ruleId: "test.any-once", scope: "anyTurn", limit: 1 }, "usage-any-e");
rejected(scene, "h", { kind: "usage", ruleId: "test.any-once", scope: "anyTurn", limit: 1 }, /исчерпан/i);
scene = run(scene, "e", { kind: "turn-end" }, "turn-e-1-end");
scene = run(scene, null, { kind: "round-end" }, "round-1-end");
scene = run(scene, "h", { kind: "turn-start" }, "turn-h-3");
assert.equal(actorState(scene, "h").ownerTurnSerial, 3);
scene = run(scene, "h", { kind: "usage", ruleId: "test.owner-once", scope: "ownerTurn", limit: 1 }, "usage-h-3");
rejected(scene, "h", { kind: "usage", ruleId: "test.owner-once", scope: "ownerTurn", limit: 1 }, /исчерпан/i);

// The same source lifetime remains through foreign Turns and expires at the
// requested boundary of the next own Turn.
let startLifetime = fixture();
startLifetime = run(startLifetime, "h", { kind: "turn-start" }, "life-h-1");
startLifetime = run(startLifetime, "h", { kind: "effect", targetId: "h", effect: "negative.ослаблен", duration: "startTurn" }, "life-start-apply");
const startSource = startLifetime.actors[0].effectStates["negative.ослаблен"].sources[0];
assert.equal(startSource.lifetime.boundary, "startNextOwnerTurn");
assert.equal(startSource.lifetime.ownerTurnSerial, 1);
const startReloaded = clone(startLifetime);
assert.equal(startReloaded.actors[0].effectStates["negative.ослаблен"].sources[0].lifetime.ownerTurnSerial, 1);
startLifetime = run(startReloaded, "h", { kind: "turn-end" }, "life-h-1-end");
startLifetime = run(startLifetime, "e", { kind: "turn-start" }, "life-e-1");
assert.ok(startLifetime.actors[0].effects.includes("negative.ослаблен"), "foreign Turn does not expire an owner boundary");
startLifetime = run(startLifetime, "e", { kind: "turn-end" }, "life-e-1-end");
startLifetime = run(startLifetime, null, { kind: "round-end" }, "life-round-1-end");
startLifetime = run(startLifetime, "h", { kind: "turn-start" }, "life-h-2");
assert.ok(!startLifetime.actors[0].effects.includes("negative.ослаблен"), "start-next-owner-turn expires at the next own start");

let endLifetime = fixture();
endLifetime = run(endLifetime, "h", { kind: "turn-start" }, "life-end-h-1");
endLifetime = run(endLifetime, "h", { kind: "effect", targetId: "h", effect: "positive.усилен", duration: "default" }, "life-end-apply");
assert.equal(endLifetime.actors[0].effectStates["positive.усилен"].sources[0].lifetime.boundary, "endNextOwnerTurn");
endLifetime = run(endLifetime, "h", { kind: "turn-end" }, "life-end-h-1-end");
endLifetime = run(endLifetime, "e", { kind: "turn-start" }, "life-end-e-1");
endLifetime = run(endLifetime, "e", { kind: "turn-end" }, "life-end-e-1-end");
endLifetime = run(endLifetime, null, { kind: "round-end" }, "life-end-round-1-end");
endLifetime = run(endLifetime, "h", { kind: "turn-start" }, "life-end-h-2");
assert.ok(endLifetime.actors[0].effects.includes("positive.усилен"), "end-next-owner-turn survives the next own start");
endLifetime = run(endLifetime, "h", { kind: "turn-end" }, "life-end-h-2-end");
assert.ok(!endLifetime.actors[0].effects.includes("positive.усилен"), "end-next-owner-turn expires at the next own end");

// Counter reset lifetimes use the same owner boundary descriptor and are
// re-armed for the following own Turn after the reset.
let counterLifetime = fixture();
counterLifetime = run(counterLifetime, "h", { kind: "turn-start" }, "counter-life-h-1");
counterLifetime = run(counterLifetime, "h", { kind: "clock", id: "turn-clock", size: 3, current: 3, initial: 0, scope: "manual", lifetime: { boundary: "startNextOwnerTurn", ownerActorId: "h", ownerTurnSerial: 1, sceneSerial: 1 }, sourceEntityId: "main", ruleId: "test.turn-clock" }, "counter-life-create");
assert.equal(counterLifetime.actors[0].ruleClocks["turn-clock"].current, 3);
counterLifetime = run(counterLifetime, "h", { kind: "turn-end" }, "counter-life-h-1-end");
counterLifetime = run(counterLifetime, "e", { kind: "turn-start" }, "counter-life-e-1");
counterLifetime = run(counterLifetime, "e", { kind: "turn-end" }, "counter-life-e-1-end");
counterLifetime = run(counterLifetime, null, { kind: "round-end" }, "counter-life-round-1-end");
counterLifetime = run(counterLifetime, "h", { kind: "turn-start" }, "counter-life-h-2");
assert.equal(counterLifetime.actors[0].ruleClocks["turn-clock"].current, 0, "descriptor-backed counters reset at the next own Turn start");
assert.equal(counterLifetime.actors[0].ruleClocks["turn-clock"].lifetime.ownerTurnSerial, 2, "descriptor-backed counter reset re-arms the next boundary");

// Scene-authored damage has a Scene subject and remains target-queryable.
let sceneAuthored = fixture();
sceneAuthored = run(sceneAuthored, null, { kind: "damage", targetId: "h", amount: 2, irreducible: true }, "scene-damage");
const sceneFact = sceneAuthored.lionwing.history.find(fact => fact.type === "damage");
assert.equal(sceneFact.actorId, null);
assert.equal(sceneFact.subjectKind, "scene");
assert.equal(sceneFact.ownerActorId, "scene");
assert.equal(JSON.stringify(sceneFact.targetIds), JSON.stringify(["h"]));
assert.equal(lw.historyStatus(sceneAuthored, { scope: "scene", sceneSerial: 1, type: "damage", actorId: null, targetId: "h" }).count, 1);

let lethalScene = fixture();
lethalScene.actors.find(item => item.id === "e").hp = 1;
lethalScene = run(lethalScene, null, { kind: "damage", targetId: "e", amount: 10, irreducible: true }, "scene-lethal");
assert.equal(lethalScene.log.find(row => row.type === "actor.knockout").actorId, null, "Scene-authored lethal damage keeps the Scene as knockout author");

let mixedSources = fixture();
mixedSources = run(mixedSources, "h", { kind: "turn-start" }, "mixed-turn-1");
mixedSources = run(mixedSources, "h", { kind: "effect", targetId: "h", effect: "positive.усилен", duration: "scene", sourceId: "long-source" }, "mixed-long");
mixedSources = run(mixedSources, "h", { kind: "effect", targetId: "h", effect: "positive.усилен", duration: "default", sourceId: "short-source" }, "mixed-short");
mixedSources = run(mixedSources, "h", { kind: "turn-end" }, "mixed-turn-1-end");
mixedSources = run(mixedSources, "e", { kind: "turn-start" }, "mixed-e-1");
mixedSources = run(mixedSources, "e", { kind: "turn-end" }, "mixed-e-1-end");
mixedSources = run(mixedSources, null, { kind: "round-end" }, "mixed-round-end");
mixedSources = run(mixedSources, "h", { kind: "turn-start" }, "mixed-turn-2");
mixedSources = run(mixedSources, "h", { kind: "turn-end" }, "mixed-turn-2-end");
assert.equal(JSON.stringify(mixedSources.actors[0].effectStates["positive.усилен"].sources.map(source => source.sourceId)), JSON.stringify(["long-source"]), "each effect source expires by its own lifetime");

let resetSources = fixture();
resetSources = run(resetSources, "h", { kind: "effect", targetId: "h", effect: "positive.усилен", duration: "persistent", sourceId: "persistent-source" }, "reset-persistent");
resetSources = run(resetSources, "h", { kind: "effect", targetId: "h", effect: "positive.усилен", duration: "scene", sourceId: "scene-source" }, "reset-scene");
resetSources = run(resetSources, null, { kind: "scene-reset" }, "reset-mixed-sources");
assert.equal(JSON.stringify(resetSources.actors[0].effectStates["positive.усилен"].sources.map(source => source.sourceId)), JSON.stringify(["persistent-source"]), "Scene reset filters sources independently");

let pausedKo = fixture();
pausedKo = run(pausedKo, "h", { kind: "turn-start" }, "paused-ko-turn");
pausedKo = run(pausedKo, "h", { kind: "attack", targetIds: ["e"], amount: 1 }, "paused-ko-attack");
pausedKo = run(pausedKo, "h", { kind: "pause-chain" }, "paused-ko-chain");
pausedKo = run(pausedKo, null, { kind: "correct", targetId: "h", resource: "knockedOut", amount: 1 }, "paused-ko-correct");
rejected(pausedKo, "h", { kind: "resume-chain" }, /выведен из боя/i);

let chapterLifetime = fixture();
chapterLifetime = run(chapterLifetime, "h", { kind: "turn-start" }, "chapter-life-turn-1");
chapterLifetime = run(chapterLifetime, "h", { kind: "effect", targetId: "h", effect: "negative.ослаблен", duration: "startTurn" }, "chapter-life-effect");
chapterLifetime = run(chapterLifetime, null, { kind: "chapter-start" }, "chapter-life-next");
chapterLifetime = run(chapterLifetime, "h", { kind: "turn-end" }, "chapter-life-turn-1-end");
chapterLifetime = run(chapterLifetime, "e", { kind: "turn-start" }, "chapter-life-e-1");
chapterLifetime = run(chapterLifetime, "e", { kind: "turn-end" }, "chapter-life-e-1-end");
chapterLifetime = run(chapterLifetime, null, { kind: "round-end" }, "chapter-life-round");
chapterLifetime = run(chapterLifetime, "h", { kind: "turn-start" }, "chapter-life-turn-2");
assert.equal(chapterLifetime.actors[0].effects.includes("negative.ослаблен"), false, "chapter transition rebases owner-turn descriptors");

let resetCounter = fixture();
resetCounter.actors[0].ruleClocks = { resetClock: { id: "resetClock", size: 4, current: 3, value: 3, initial: 0, resetAt: "manual", lifetime: execution.lifetimeBoundary("startNextOwnerTurn", { ownerActorId: "h", ownerTurnSerial: 0, sceneSerial: 1 }) } };
resetCounter = run(resetCounter, null, { kind: "scene-reset" }, "reset-counter-scene");
resetCounter = run(resetCounter, "h", { kind: "turn-start" }, "reset-counter-turn");
assert.equal(resetCounter.actors[0].ruleClocks.resetClock.current, 0, "Scene reset rebases descriptor-backed counters to the new Scene");

// Storage reload and a duplicate event keep the active Turn instance and its
// serial exactly once. The caller snapshot also serves as an undo snapshot.
let replayScene = fixture();
replayScene = run(replayScene, "h", { kind: "turn-start" }, "replay-turn-h-1");
const activeSnapshot = clone(replayScene);
const duplicate = lw.dispatchMany(activeSnapshot, [event("h", { kind: "turn-start" }, "replay-turn-h-1")]);
assert.equal(duplicate.events.length, 0);
assert.equal(duplicate.scene.lionwing.activeTurnInstanceId, "replay-turn-h-1");
assert.equal(actorState(duplicate.scene, "h").ownerTurnSerial, 1);
assert.equal(duplicate.scene.lionwing.activeTurn.ownerTurnKey, "1:h:1", "reload reconstruction keeps the stable owner-turn key");
assert.equal(actorState(activeSnapshot, "h").ownerTurnSerial, 1, "undo snapshot remains unchanged");

const appContext = {
  console,
  crypto: { randomUUID: () => "normalized-id" },
  APP_SCHEMA: 14,
  contentPreferences: { edition: "ru-v0.9" },
  uid: () => "normalized-id",
  clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
  cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [],
};
vm.createContext(appContext);
const appSource = fs.readFileSync(new URL("../app-core.js", import.meta.url), "utf8");
vm.runInContext(appSource.slice(appSource.indexOf("function blankScene()"), appSource.indexOf("function normalizeScene(raw)")), appContext, { filename: "app-core.scene-normalizer.js" });
const normalized = vm.runInContext(`sceneCore(${JSON.stringify(startReloaded)})`, appContext);
assert.equal(normalized.lionwing.activeTurnInstanceId, "life-h-1");
assert.equal(normalized.actors.find(item => item.id === "h").lionwing.ownerTurnSerial, 1);
assert.equal(normalized.actors.find(item => item.id === "h").effectStates["negative.ослаблен"].sources[0].lifetime.boundary, "startNextOwnerTurn");

console.log("LionWing Turn lifetimes: own serials, stable instances, pause/resume, extra Turns, owner/any scopes, boundary expiry, Scene facts and reload passed");
