import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
const sceneEngine = loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;
const baseAdapters = context.window.DAWN_LIONWING_ADAPTERS;

const actor = id => ({ id, name: id, kind: "hero", heroId: id, ownerId: id,
  rulesEdition: "lionwing", team: "hero", space: "main", x: 1, y: 1,
  hp: 12, maxHp: 12, ap: 0, baseAp: 3, focus: 0, influence: 0,
  wounds: 0, stress: 0, tier: 2, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 2, mind: 2 }, effects: [],
  effectStates: {}, usedActions: [], acted: false, knockedOut: false,
  knownTechniques: {}, techniques: {}, lionwing: { automation: {} } });
const initial = { rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0,
  tension: 0, activeActorId: null, spaces: [{ id: "main", width: 5, height: 5 }],
  actors: [actor("hero"), actor("other")], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [] };

// A synthetic consumer proves the scheduler without making claims about a Technique.
context.window.DAWN_LIONWING_ADAPTERS = Object.freeze({
  ...baseAdapters,
  boundaryOperations(owner, boundary) {
    if (owner.id !== "hero") return [];
    if (boundary.canonicalBoundary === "sceneStart") return [{
      id: "test.lifecycle.scene-start", label: "Synthetic scene boundary",
      sourceDigest: "test:lifecycle:v1", coverage: "test",
      operations: [{ kind: "resource", targetId: owner.id, resource: "focus", operation: "gain", amount: 1, ruleId: "test.lifecycle.scene-start" }], choices: [] }];
    if (boundary.canonicalBoundary === "ownTurnStart") return [{
      id: "test.lifecycle.own-turn", label: "Synthetic optional boundary",
      sourceDigest: "test:lifecycle:v1", coverage: "test", operations: [],
      choices: [{ id: "accept", label: "Accept", operations: [] }] }];
    if (boundary.canonicalBoundary === "sceneEnd") return [{
      id: "test.lifecycle.scene-end", label: "Synthetic closing boundary",
      sourceDigest: "test:lifecycle:v1", coverage: "test", operations: [],
      choices: [{ id: "accept", label: "Accept", operations: [] }] }];
    return [];
  },
});

const prepared = engine.prepare(initial, { actorId: "hero", eventId: "lifecycle:start", kind: "turn-start" }, { random: () => 0.2 });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
const started = engine.dispatchMany(initial, prepared.events).scene;
assert.equal(started.actors[0].focus, 3, "Scene-start operation follows the initial Focus grant");
assert.equal(started.lionwing.boundaryReceipts.filter(row => row.ruleId === "test.lifecycle.scene-start").length, 1);
assert.equal(started.lionwing.boundaryReceipts.filter(row => row.ruleId === "test.lifecycle.own-turn").length, 1);
assert.deepEqual(Array.from(started.lionwing.choices[0].options), ["skip", "accept"]);

const lifecycle = engine.lifecycle(started, { ownerActorId: "hero", boundary: "turnStart", ruleId: "test.lifecycle.own-turn" });
assert.equal(lifecycle.boundary, "ownTurnStart");
assert.equal(lifecycle.ownerActorId, "hero");
assert.ok(lifecycle.ownerTurnKey && lifecycle.periodKey && lifecycle.receipt);
assert.equal(baseAdapters.lifecycle.first(started.actors[0], started, { scope: "scene", ruleId: "missing" }), true);
assert.equal(baseAdapters.lifecycle.nth(started.actors[0], started, 1, { scope: "scene", ruleId: "missing" }), true);

const projected = sceneEngine.projectScene(started, { role: "player", playerId: "hero" });
assert.equal(projected.lionwing.boundaryReceipts, undefined);
const reloaded = engine.reload(JSON.stringify(started));
assert.equal(reloaded.lionwing.boundaryReceipts.length, started.lionwing.boundaryReceipts.length);
const redelivered = engine.dispatchMany(started, prepared.events).scene;
assert.equal(redelivered.lionwing.boundaryReceipts.length, started.lionwing.boundaryReceipts.length, "duplicate delivery does not fire a boundary twice");

// A foreign active Turn must not change the owner's own-turn window. The
// adapter facade therefore falls back to the owner's serial for ownerTurn,
// while anyTurn continues to use the current global Turn instance.
const choiceId = started.lionwing.choices[0].id;
const afterChoice = engine.dispatchMany(started, [engine.command("hero", { kind: "choice", id: choiceId, choice: "skip" })]).scene;
const used = engine.dispatchMany(afterChoice, [engine.command("hero", { kind: "usage", ruleId: "test.owner", scope: "ownerTurn", limit: 1 })]).scene;
const ended = engine.dispatchMany(used, [engine.command("hero", { kind: "turn-end" })]).scene;
const foreign = engine.dispatchMany(ended, [engine.command("other", { kind: "turn-start" })]).scene;
assert.equal(baseAdapters.lifecycle.count(foreign.actors[0], foreign, { scope: "ownerTurn", ruleId: "test.owner" }), 1, "ownerTurn query remains tied to the owner's serial during a foreign Turn");
assert.equal(baseAdapters.lifecycle.once(foreign.actors[0], foreign, { scope: "ownerTurn", ruleId: "test.missing" }), true);
const foreignEnded = engine.dispatchMany(foreign, [engine.command("other", { kind: "turn-end" })]).scene;
const reset = engine.dispatchMany(foreignEnded, [engine.command(null, { kind: "scene-reset" })]).scene;
assert.equal(reset.lionwing.choices.length, 0, "Scene reset does not carry closing-boundary choices into the next Scene");

console.log("LionWing neutral lifecycle: canonical boundaries, stable private receipts, optional choices, reload and replay passed");
