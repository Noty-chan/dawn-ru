import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;
const adapters = context.window.DAWN_LIONWING_ADAPTERS;

let quote = adapters.composeNumeric(3, [
  { operation: "add", amount: 2 }, { operation: "replace", amount: 4 },
  { operation: "multiply", amount: 2 }, { operation: "min", amount: 10 },
  { operation: "max", amount: 12 },
]);
assert.equal(quote.value, 10);
assert.deepEqual(Array.from(quote.order), ["replace", "multiply", "add", "min", "max"]);
quote = adapters.composeNumeric(3, [{ operation: "replace", amount: 4, id: "one" }, { operation: "replace", amount: 5, id: "two" }]);
assert.equal(quote.ok, false);
assert.match(quote.reason, /Конфликт замен/);
assert.equal(adapters.composeNumeric(3, [{ operation: "multiply", amount: 1.5 }], { roundUp: true }).value, 5);
assert.equal(engine.composeNumeric(8, [{ operation: "max", amount: 6 }]).value, 6);
assert.equal(adapters.numericQuote({ rulesEdition: "lionwing", lionwing: { automation: {} } }, { key: "armor", baseValue: 3 }).value, 3);

const actor = (id, x, armor = 0) => ({ id, name: id, kind: "hero", heroId: id,
  ownerId: id, rulesEdition: "lionwing", team: id === "source" ? "hero" : "enemy",
  space: "main", x, y: 1, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 0,
  influence: 0, wounds: 0, stress: 0, tier: 2, speed: 4, armor, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {},
  knownTechniques: {}, techniques: {}, lionwing: { automation: {} } });
const scene = { rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1,
  tension: 0, activeActorId: "source", lionwing: { activeTurnInstanceId: "turn:1" },
  spaces: [{ id: "main", width: 5, height: 5 }], actors: [actor("source", 1), actor("target", 2, 1)],
  objects: [], walls: [], markers: [], log: [], targetIds: [] };

// Synthetic contributions exercise the combat seams without claiming a Technique.
context.window.DAWN_LIONWING_ADAPTERS = Object.freeze({
  ...adapters,
  statQuote(_owner, key, request) { return adapters.composeNumeric(request.baseValue, key === "armor" ? [{ operation: "add", amount: 2, id: "test.armor" }] : [], { key }); },
  damageQuote(_owner, request) { return adapters.composeNumeric(request.baseValue, request.key === "finalDamage" ? [{ operation: "max", amount: 6, id: "test.cap" }] : [], request); },
});
const prepared = engine.prepare(scene, { actorId: "source", eventId: "numeric:damage", kind: "damage", targetId: "target", amount: 20, attack: true }, { random: () => 0.6 });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
const applied = engine.dispatchMany(scene, prepared.events).scene;
assert.equal(applied.actors.find(item => item.id === "target").hp, 14);

console.log("LionWing numeric composer: deterministic order, conflicts, rounding, manual API and combat integration passed");
