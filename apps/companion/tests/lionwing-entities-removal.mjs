import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../lionwing-entities.js", import.meta.url), "utf8"), context, { filename: "lionwing-entities.js" });
const Entities = context.window.DAWN_LIONWING_ENTITIES;
const clone = value => JSON.parse(JSON.stringify(value));
const actor = id => ({ id, kind: "hero", ownerId: id === "owner" ? "player-1" : null, hidden: false, knockedOut: false, space: "main", x: 0, y: 0, effectStates: {} });
const fixture = () => ({ rulesEdition: "lionwing", version: 4, actors: [actor("owner"), actor("source")], markers: [{ id: "marker", kind: "mark" }], objects: [{ id: "object", type: "terrain" }], areas: [], walls: [], log: [], lionwing: { entities: {}, auras: [], subscriptions: [], choices: [], deferred: [], pausedChains: [], afterAttack: [], executionCursor: null } });
const entity = (id = "gone", extra = {}) => ({ id, kind: "summon", ownerActorId: "owner", source: { actorId: "source" }, rule: "test.entity", backing: { markerId: "marker" }, lifetime: "scene", visibility: "public", ...extra });
const removeOptions = { role: "narrator", eventId: "remove-1", purge: true, expectedVersion: 4 };

let scene = Entities.create(fixture(), entity()).scene;
scene.lionwing.auras = [{ id: "aura-remove", sourceEntityId: "gone", sourceLossPolicy: "remove" }, { id: "aura-independent", sourceActorId: "source" }];
scene.lionwing.subscriptions = [{ id: "subscription-remove", entityId: "gone" }];
scene.lionwing.choices = [{ id: "choice-remove", context: { anchorEntityId: "gone" } }];
scene.lionwing.deferred = [{ id: "deferred-remove", sourceEntityId: "gone" }];
scene.lionwing.pausedChains = [{ id: "paused-remove", pendingAction: { targetEntityId: "gone" } }];
scene.lionwing.afterAttack = [{ id: "tail-remove", targetEntityId: "gone" }];
scene.lionwing.executionCursor = { id: "cursor-remove", waitingChoiceId: "choice-remove", context: { entityId: "gone" } };
scene.pendingAction = { id: "attack-remove", targetEntityId: "gone" };
scene.pendingActionPlan = { id: "plan-remove", context: { targetIds: ["gone"] } };
scene.pendingPrompt = { id: "prompt-remove", context: { anchorEntityId: "gone" } };
scene.triggerQueue = [{ key: "trigger-remove", event: { type: "rule.prompt", payload: { sourceEntityId: "gone" } } }];
scene.challengeRequest = { id: "challenge-remove", context: { entityId: "gone" } };
scene.opposedRoll = { id: "opposed-remove", participants: [{ entityId: "gone" }] };
scene.actors[0].effectStates = { "positive.test": { sources: [{ sourceEntityId: "gone" }] } };
scene.actors[0].ruleResources = { own: { value: 2 }, linked: { value: 1, sourceEntityId: "gone" } };
scene.actors[0].ruleClocks = { own: { current: 1 }, linked: { current: 1, sourceEntityId: "gone" } };

const beforePrepare = clone(scene);
const prepared = Entities.prepareDestroy(scene, "gone", removeOptions);
assert.equal(prepared.exists, true);
assert.ok(prepared.cleanup.cleanups.some(item => item.kind === "aura" && item.id === "aura-remove"));
assert.ok(prepared.cleanup.cleanups.some(item => item.kind === "pending-action"));
assert.deepEqual(clone(scene), beforePrepare, "prepare never mutates the caller Scene");
assert.deepEqual(clone(Entities.cancelDestroy(scene, "gone", { role: "narrator" }).scene), beforePrepare, "cancel never mutates the caller Scene");
assert.throws(() => Entities.prepareDestroy(scene, "gone", { role: "player", actorId: "player-1" }), /только Нарратору|Нарратору/i, "players cannot prepare a destructive registry operation");
assert.throws(() => Entities.prepareDestroy(scene, "gone", { role: "narrator", actorId: "player-1" }), /только Нарратору|Нарратору/i, "a player ID cannot be paired with a narrator role");
assert.throws(() => Entities.destroy(scene, "gone", { ...removeOptions, expectedVersion: 3 }), /устарел|изменилась/i, "stale version is rejected before mutation");

const deleted = Entities.destroy(scene, "gone", removeOptions);
assert.equal(deleted.ok, true);
assert.equal(deleted.scene.lionwing.entities.gone, undefined, "the registry row is removed");
assert.equal(deleted.scene.lionwing.auras.some(row => row.id === "aura-remove"), false, "a dependent aura is removed by its descriptor");
assert.equal(deleted.scene.lionwing.auras.some(row => row.id === "aura-independent"), true, "independent aura remains intact");
for (const key of ["subscriptions", "choices", "deferred", "pausedChains", "afterAttack", "triggerQueue"]) assert.equal((deleted.scene.lionwing[key] || []).length, 0, `${key} loses its entity dependency`);
for (const key of ["pendingAction", "pendingActionPlan", "pendingPrompt", "challengeRequest", "opposedRoll"]) assert.equal(deleted.scene[key], null, `${key} is cancelled atomically`);
assert.equal(deleted.scene.lionwing.executionCursor, null, "the saved execution continuation is cancelled");
assert.equal(deleted.scene.actors[0].effectStates["positive.test"].sources[0].disabled, true, "actor runtime dependency is disabled by policy");
assert.equal(deleted.scene.actors[0].disabled, undefined, "disabling a runtime dependency does not disable its actor");
assert.equal(deleted.scene.actors[0].ruleResources.own.value, 2, "independent actor resources remain intact");
assert.equal(deleted.scene.actors[0].ruleResources.linked.disabled, true, "entity-backed actor resources are disabled in place");
assert.equal(deleted.scene.actors[0].ruleClocks.own.current, 1, "independent actor clocks remain intact");
assert.equal(deleted.scene.actors[0].ruleClocks.linked.disabled, true, "entity-backed actor clocks are disabled in place");
assert.equal(deleted.scene.log[0].type, "entity.remove", "the deletion is recorded in the public journal");
assert.ok(deleted.event.cleanupBefore && deleted.event.cleanupAfter, "the event carries undoable cleanup snapshots");

const reloaded = Entities.reload(Entities.serialize(deleted.scene));
const replayed = Entities.replay(reloaded, deleted.event);
assert.equal(replayed.replayed, true, "replay after JSON reload is idempotent");
assert.deepEqual(clone(replayed.scene), clone(reloaded), "replay does not duplicate cleanup or journal rows");
assert.throws(() => Entities.destroy(reloaded, "gone", { ...removeOptions, eventId: "remove-1", purge: false }), /другие данные|Конфликт/i, "a duplicate event ID cannot change the operation");

const undone = Entities.undo(deleted.scene, deleted.event);
assert.ok(undone.scene.lionwing.entities.gone, "undo restores the registry row");
assert.equal(undone.scene.lionwing.auras.some(row => row.id === "aura-remove"), true, "undo restores removed aura dependencies");
assert.equal(undone.scene.lionwing.choices.length, 1, "undo restores pending choices");
assert.equal(undone.scene.log[0].type, "entity.undo", "undo is itself journaled");

const protectedScene = fixture();
const protectedEntity = Entities.create(protectedScene, entity()).scene;
protectedEntity.lionwing.choices = [{ id: "protected-choice", anchorEntityId: "gone", protected: true }];
const protectedBefore = clone(protectedEntity);
assert.throws(() => Entities.destroy(protectedEntity, "gone", { role: "narrator", purge: true, expectedVersion: 4, eventId: "protected-remove" }), /защищённая зависимость/i, "protected dependencies reject the complete transaction");
assert.deepEqual(clone(protectedEntity), protectedBefore, "a rejected cleanup rolls back every part of the Scene");

// The same operation is also a typed runtime event. This verifies that the
// public Scene dispatcher commits the whole Scene atomically rather than only
// copying the registry projection.
const runtimeContext = { window: {}, console };
vm.createContext(runtimeContext);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), runtimeContext);
vm.runInContext(fs.readFileSync(new URL("../lionwing-entities.js", import.meta.url), "utf8"), runtimeContext, { filename: "lionwing-entities.js" });
const runtimeEngine = loadSceneEngine(runtimeContext);
assert.equal(runtimeContext.window.DAWN_LIONWING_ENGINE.effectInstanceStatus(deleted.scene, "owner", "positive.test").activeSources.length, 0, "disabled entity-backed effects are inactive in the runtime query");
let runtimeScene = fixture();
runtimeScene = Entities.create(runtimeScene, entity("runtime-gone"), { role: "narrator" }).scene;
delete runtimeScene.lionwing.executionCursor;
runtimeScene.lionwing.auras = [{ id: "runtime-aura", sourceEntityId: "runtime-gone", sourceLossPolicy: "remove" }];
const runtimeEvent = { id: "runtime-remove", type: "entity.remove", actorId: "narrator", payload: { id: "runtime-gone", purge: true } };
const runtimeResult = runtimeEngine.dispatchMany(runtimeScene, [runtimeEvent], { role: "narrator" });
assert.equal(runtimeResult.scene.lionwing.entities["runtime-gone"], undefined, "runtime entity.remove purges the registry");
assert.equal(runtimeResult.scene.lionwing.auras.length, 0, "runtime entity.remove applies foreign cleanup in one dispatch");
assert.equal(runtimeResult.events[0].type, "entity.remove", "runtime dispatch returns the typed removal event");
const runtimeUndo = Entities.undo(runtimeResult.scene, runtimeResult.events[0]);
assert.ok(runtimeUndo.scene.lionwing.entities["runtime-gone"], "runtime removal event retains an undoable cleanup snapshot");
assert.equal(runtimeUndo.scene.lionwing.auras.length, 1, "runtime undo restores its dependent aura");
const runtimeReplay = runtimeEngine.dispatchMany(runtimeResult.scene, [runtimeEvent], { role: "narrator" });
assert.equal(runtimeReplay.events.length, 0, "a runtime removal event is idempotent after receipt persistence");
assert.throws(() => runtimeEngine.dispatchMany(runtimeResult.scene, [{ ...runtimeEvent, payload: { ...runtimeEvent.payload, purge: false } }], { role: "narrator" }), /Конфликт ID события/i, "a runtime event ID cannot be reused with different cleanup semantics");

const spoofedRuntime = fixture();
spoofedRuntime.lionwing.entities["runtime-gone"] = entity("runtime-gone");
delete spoofedRuntime.lionwing.executionCursor;
assert.throws(() => runtimeEngine.dispatchMany(spoofedRuntime, [{ id: "spoofed-remove", type: "entity.remove", actorId: "player-1", payload: { id: "runtime-gone", role: "narrator", purge: true } }], { role: "narrator" }), /только Нарратору|Нарратору/i, "event payloads cannot elevate a player to Narrator");

console.log("LionWing entity removal: typed prepare/cancel, Narrator authority, cascade cleanup, protected rollback, journal, stale version, JSON reload, idempotent replay and undo passed");
