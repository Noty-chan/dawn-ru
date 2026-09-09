import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { sceneEngineFiles } from "./load-scene-engine.mjs";

// This test deliberately loads the dice foundation before the LionWing engine;
// the regular engine regression suite omits it to exercise the legacy path.
const context = { window: {}, console };
vm.createContext(context);
const files = ["data.js", "edition-lionwing.js", "logic.js", ...sceneEngineFiles.slice(0, -1), "lionwing-dice.js", "lionwing-engine.js"];
for (const file of files) vm.runInNewContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = context.window.DAWN_LIONWING_ENGINE;
assert.ok(engine?.diceCreate && engine.diceApply && engine.diceReload && engine.diceOpposed, "the engine exposes the dice adapter");

const hero = (id, kind = "hero") => ({ id, name: id, kind, rulesEdition: "lionwing", team: kind === "hero" ? "hero" : "enemy", heroId: kind === "hero" ? id : null, space: "main", x: kind === "hero" ? 1 : 3, y: 1, hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 3, influence: 3, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false });
const fixture = () => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }], actors: [hero("hero"), hero("enemy", "enemy")], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [] });
const dispatch = (scene, actorId, payload, id, options = {}) => engine.dispatchMany(scene, [{ ...engine.command(actorId, payload), id }], options);
const clone = value => JSON.parse(JSON.stringify(value));

const preparedRoll = engine.prepare(fixture(), { actorId: "hero", kind: "dice-create", pool: 3, rollId: "prepared-roll" });
assert.equal(preparedRoll.ok, true, preparedRoll.errors?.join(" "));
assert.ok(preparedRoll.events[0].payload.roll, "prepared command captures the random result");
const committedRoll = engine.dispatchMany(fixture(), preparedRoll.events, { random: () => { throw new Error("commit must not roll again"); } });
assert.deepEqual(clone(committedRoll.scene.lionwing.diceRolls["prepared-roll"].sourceFaces), clone(preparedRoll.scene.lionwing.diceRolls["prepared-roll"].sourceFaces));

// Ordinary checks and raw D6 share the engine's public roll entry point while
// keeping the raw table free of automatic derived Hits/Crits/explosions.
const ordinary = engine.roll(2, () => 0.5, { rollId: "engine:ordinary" });
assert.equal(ordinary.id, "engine:ordinary");
assert.deepEqual(clone(ordinary.sourceFaces), [4, 4]);
assert.equal(ordinary.successes, 2);
const raw = engine.roll(2, () => 0.99, { rollId: "engine:raw", kind: "raw-d6" });
assert.deepEqual(clone(raw.sourceFaces), [6, 6]);
assert.equal(raw.successes, null);
assert.equal(raw.crits, null);

let scene = fixture();
const createEvent = { ...engine.command("hero", { kind: "dice-create", rollId: "scene:roll", pool: 2, rollKind: "check" }), id: "event:dice-create" };
const created = dispatch(scene, "hero", createEvent.payload, createEvent.id, { random: () => 0.5 });
scene = created.scene;
const savedRoll = scene.lionwing.diceRolls["scene:roll"];
assert.equal(savedRoll.ownerActorId, "hero");
assert.deepEqual(clone(savedRoll.sourceFaces), [4, 4]);
assert.ok(scene.lionwing.diceJournal.some(entry => entry.kind === "create" && entry.rollId === "scene:roll"));

// The same event is a receipt, so replay does not roll again or advance the
// scene. The supplied random callback is intentionally never consulted.
const replay = engine.dispatchMany(scene, [createEvent], { random: () => { throw new Error("replayed event must not use random"); } });
assert.equal(replay.events.length, 0);
assert.equal(replay.scene.version, scene.version);

// A player supplied result may contain forged ready-made Hits; only faces are
// authoritative and the stored result is recalculated by the foundation.
const forged = dispatch(scene, "hero", { kind: "dice-create", roll: { id: "scene:forged", pool: 2, sourceFaces: [4, 1], successes: 99, hits: 99, crits: 99 } }, "event:dice-forged");
assert.equal(forged.scene.lionwing.diceRolls["scene:forged"].successes, 1);
assert.equal(forged.scene.lionwing.diceRolls["scene:forged"].hits, 1);
assert.throws(() => dispatch(scene, "hero", { kind: "dice-create", request: { id: "scene:client-random", pool: 1, random: 0.5 } }, "event:dice-client-random"), /случайност/);
assert.throws(() => dispatch(scene, "hero", { kind: "dice-create", roll: { id: "scene:wrong-owner", pool: 1, sourceFaces: [4], ownerActorId: "enemy" } }, "event:dice-wrong-owner"), /другому участнику/);
assert.throws(() => dispatch(scene, "hero", { kind: "dice-create", sourceActorId: "enemy", roll: { id: "scene:spoofed-source", pool: 1, sourceFaces: [4], ownerActorId: "enemy" } }, "event:dice-spoofed-source"), /другому участнику/);

const firstDieId = savedRoll.dice[0].id;
const applyPayload = { kind: "dice-apply", rollId: "scene:roll", operation: { id: "operation:change", kind: "change", dieId: firstDieId, value: 6 } };
const applied = dispatch(scene, "hero", applyPayload, "event:dice-apply");
scene = applied.scene;
assert.equal(scene.lionwing.diceRolls["scene:roll"].dice[0].value, 6);
assert.equal(scene.lionwing.diceRolls["scene:roll"].crits, 1);
assert.deepEqual(clone(scene.lionwing.diceRolls["scene:roll"].dice.map(die => die.id)), clone(savedRoll.dice.map(die => die.id)), "changing a die keeps its stable ID");
assert.throws(() => dispatch(scene, "enemy", applyPayload, "event:wrong-owner"), /другому участнику/);

// Reusing the operation ID is idempotent even when delivered under another
// event ID; a different payload with that ID remains a conflict.
const duplicateOperation = dispatch(scene, "hero", applyPayload, "event:dice-apply-retry");
assert.deepEqual(duplicateOperation.scene.lionwing.diceRolls["scene:roll"], scene.lionwing.diceRolls["scene:roll"]);
assert.throws(() => dispatch(scene, "hero", { ...applyPayload, operation: { ...applyPayload.operation, value: 1 } }, "event:dice-apply-conflict"), /Повтор операции|другими данными/);

// Reload is an explicit restoration boundary: a valid JSON snapshot can undo
// the later operation, while derived fields are still recomputed.
const restored = dispatch(scene, "hero", { kind: "dice-reload", snapshot: clone(savedRoll) }, "event:dice-reload");
assert.deepEqual(restored.scene.lionwing.diceRolls["scene:roll"], savedRoll);
const restoredAgain = dispatch(restored.scene, "hero", { kind: "dice-reload", snapshot: clone(savedRoll) }, "event:dice-reload-retry");
assert.equal(restoredAgain.scene.lionwing.diceJournal.filter(entry => entry.kind === "reload" && entry.rollId === "scene:roll").length, 1, "a repeated restoration must not duplicate the dice journal");
const reloaded = engine.diceReload(JSON.stringify(savedRoll));
assert.deepEqual(reloaded, savedRoll);

// Opposed checks keep both persisted sides and require an explicit tie policy.
const opposedRequest = { id: "scene:opposed", tieRule: "left", participants: [{ id: "left", pool: 1, sourceFaces: [4] }, { id: "right", pool: 1, sourceFaces: [4] }] };
const opposed = dispatch(fixture(), null, { kind: "dice-opposed", opposed: opposedRequest }, "event:dice-opposed");
assert.equal(opposed.scene.lionwing.diceOpposed["scene:opposed"].status, "tied");
assert.equal(opposed.scene.lionwing.diceOpposed["scene:opposed"].comparison.winnerParticipantId, null);
const resolved = dispatch(opposed.scene, null, { kind: "dice-resolve-tie", opposedId: "scene:opposed", resolution: "left" }, "event:dice-tie");
assert.equal(resolved.scene.lionwing.diceOpposed["scene:opposed"].comparison.winnerParticipantId, "left");
assert.throws(() => dispatch(resolved.scene, null, { kind: "dice-resolve-tie", opposedId: "scene:opposed", resolution: "right" }, "event:dice-tie-conflict"), /нельзя переиграть|правилом/);

// A legacy-shaped public roll now passes through the adapter only when the
// foundation is loaded; the old loader continues to use its legacy reducer.
const legacyShape = engine.dispatchMany(fixture(), [{ id: "event:roll-public", type: "roll.public", actorId: "hero", payload: { formula: "2D6 ≥4", rolls: [4, 1], successes: 99, crits: 99 } }]);
assert.equal(legacyShape.events[0].type, "roll.public");
assert.equal(legacyShape.events[0].payload.successes, 1);
assert.throws(() => engine.dispatchMany(legacyShape.scene, [{ id: "event:roll-public", type: "roll.public", actorId: "hero", payload: { formula: "2D6 ≥4", rolls: [4, 1], successes: 0, crits: 0 } }]), /Конфликт ID события/);
assert.throws(() => engine.dispatchMany(fixture(), [{ id: "event:roll-public-wrong-owner", type: "roll.public", actorId: "hero", payload: { formula: "1D6 ≥4", rolls: [4], successes: 1, crits: 0, ownerActorId: "enemy" } }]), /другому участнику/);
const nestedCritical = engine.dispatchMany(fixture(), [{ id: "event:nested-critical", type: "roll.public", actorId: "hero", payload: { formula: "1D6 ≥4", rolls: [5, 3], successes: 99, crits: 99, dice: { baseCount: 1, count: 1, advantage: 0, hindrance: 0, threshold: 4, criticalAt: 5, selectedHookIds: [], targetIds: [] } } }]);
assert.equal(nestedCritical.events[0].payload.crits, 1, "legacy public rolls must preserve the nested critical threshold");
const challengeScene = fixture();
challengeScene.challengeRequest = { id: "challenge:legacy", actorId: "hero", target: 1, requestedBy: "Нарратор", result: null };
const challengeRoll = engine.dispatchMany(challengeScene, [{ id: "event:challenge-roll", type: "roll.public", actorId: "hero", payload: { formula: "1D6 ≥4", rolls: [4], successes: 99, crits: 99, target: 1, challengeRequestId: "challenge:legacy" } }]);
assert.equal(challengeRoll.scene.challengeRequest.result.rollEventId, "event:challenge-roll", "legacy challenge state must still be updated by a public roll");

const legacyScene = { ...fixture(), rulesEdition: "ru-v0.9", actors: fixture().actors.map(item => ({ ...item, rulesEdition: "ru-v0.9" })) };
const routedLegacy = context.window.DAWN_SCENE_ENGINE.dispatchMany(legacyScene, [{ id: "event:legacy-roll", type: "roll.public", actorId: "hero", payload: { formula: "1D6 ≥4", rolls: [4], successes: 1, crits: 0 } }]);
assert.equal(routedLegacy.scene.rulesEdition, "ru-v0.9");
assert.equal(routedLegacy.scene.lionwing, undefined, "legacy scenes must not acquire LionWing state when the dice module is loaded");
const directLegacy = engine.dispatchMany(legacyScene, [{ id: "event:legacy-direct-roll", type: "roll.public", actorId: "hero", payload: { formula: "1D6 ≥4", rolls: [4], successes: 1, crits: 0 } }]);
assert.equal(directLegacy.scene.rulesEdition, "ru-v0.9");
assert.equal(directLegacy.scene.lionwing, undefined, "the LionWing adapter must delegate direct legacy calls without creating its state");

console.log("LionWing dice engine adapter passed: authoritative create, raw D6, forged-result recalculation, stable IDs, ownership, operation replay/conflict, JSON restore and opposed tie policy");
