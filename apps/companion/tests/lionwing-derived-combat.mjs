import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE, adapters = context.window.DAWN_LIONWING_ADAPTERS;
const ids = engine.ACTION_IDS;
const actor = (id, extra = {}) => ({ id, name: id, kind: "hero", heroId: id, ownerId: id, rulesEdition: "lionwing", team: "hero", space: "main", x: 1, y: 1, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 3, influence: 2, tier: 3, speed: 4, armor: 0, evasion: 0, attrs: { body: 5, talent: 3, spirit: 2, mind: 4 }, effects: [], effectStates: {}, knownTechniques: {}, techniques: {}, lionwing: { automation: {} }, ...extra });
const enable = (a, id) => { a.lionwing.automation[id] = true; return a; };

// The public composition contract has one stable order: replacement, multiply,
// additions, minimum floor, maximum cap. Replacements must agree.
let q = adapters.numericQuote(actor("plain"), { key: "value", baseValue: 3 });
assert.equal(q.value, 3); assert.equal(q.operations.length, 0);
const custom = actor("custom");
custom.knownTechniques = { "bulwark.iron-bodied": 3 };
enable(custom, "bulwark.iron-bodied.3");
q = adapters.numericQuote(custom, { key: "finalDamage", baseValue: 12, immobilized: true });
assert.equal(q.value, 6, "Iron Bodied III caps final damage at 4 + ceil(Tier/2)");
assert.equal(q.sources[0].sourceDigest, "7726f5c94cfdfba228b739db1cad6221687af83bf183a7c16bed34afd5a6526f");
assert.equal(q.coverage, "partial"); assert.match(q.reason, /Железное тело/);

// Context is part of the proof: the same enabled rule stays inert for a normal
// damage quote and cannot leak to unrelated actions.
assert.equal(adapters.damageQuote(custom, { baseValue: 12, key: "damage", immobilized: true }).value, 12);
const aerial = enable(actor("aerial", { knownTechniques: { "vagabond.aerial-master": 3 } }), "vagabond.aerial-master.3");
assert.equal(adapters.attackQuote(aerial, { baseValue: 2, flightStance: true, useSpeedAttribute: true }).value, 4);
assert.equal(adapters.attackQuote(aerial, { baseValue: 2, flightStance: false, useSpeedAttribute: true }).value, 2);

const jab = enable(actor("jab", { knownTechniques: { "vagabond.skirmisher": 1 } }), "vagabond.skirmisher.1");
assert.equal(adapters.damageQuote(jab, { baseValue: 99, jab: true, fixedDamage: true }).value, 2);
assert.equal(adapters.damageQuote(jab, { baseValue: 99, jab: false, fixedDamage: true }).value, 99);

const vanguard = enable(actor("angel", { knownTechniques: { "bulwark.vanguard-defender": 2 } }), "bulwark.vanguard-defender.2");
assert.equal(adapters.statQuote(vanguard, "armor", { baseValue: 1, blockingForAlly: true, blockResolved: true, firstBlockThisRound: true }).value, 4);
assert.equal(adapters.statQuote(vanguard, "armor", { baseValue: 1, blockingForAlly: false, blockResolved: true, firstBlockThisRound: true }).value, 1);
const drunk = enable(actor("drunk", { knownTechniques: { "vagabond.drunkard": 2 } }), "vagabond.drunkard.2");
assert.equal(adapters.statQuote(drunk, "evasion", { baseValue: 1, boundary: "turnEnd", slowed: true, negativeEffectCount: 3 }).value, 6);

// Directly exercise operation ordering and replacement conflicts through the
// same pure function used by all adapter quotes.
assert.equal(typeof adapters.composeNumeric, "function");
q = adapters.composeNumeric(3, [{ operation: "add", amount: 2 }, { operation: "replace", amount: 4 }, { operation: "multiply", amount: 2 }, { operation: "min", amount: 10 }, { operation: "max", amount: 12 }]);
assert.equal(q.value, 10, "replace → multiply → add → floor → cap is deterministic");
q = adapters.composeNumeric(3, [{ operation: "replace", amount: 4, id: "one" }, { operation: "replace", amount: 5, id: "two" }]);
assert.equal(q.ok, false); assert.match(q.reason, /Конфликт замен/);
q = adapters.composeNumeric(3, [{ operation: "multiply", amount: 1.5 }], { roundUp: true });
assert.equal(q.value, 5, "LionWing numeric formulas round up");
const base = adapters.numericQuote(actor("base"), { key: "armor", baseValue: 3 });
assert.equal(base.value, 3);

// Engine consumes the same quote for the final damage stage. Iron Bodied III
// therefore survives armor/evasion resolution and does not cap unrelated hits.
const scene = { rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: "attacker", lionwing: { activeTurnInstanceId: "turn:1" }, spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor("attacker", { team: "hero", kind: "hero", knownTechniques: {} }), enable(actor("defender", { x: 2, effects: ["negative.обездвижен"], knownTechniques: { "bulwark.iron-bodied": 3 } }), "bulwark.iron-bodied.3")], objects: [], walls: [], markers: [], log: [], targetIds: [] };
const prepared = engine.prepare(scene, { actorId: "attacker", kind: "damage", targetId: "defender", amount: 20, attack: true }, { random: () => 0.6 });
assert.equal(prepared.ok, true, prepared.errors?.join(" ")); assert.ok(prepared.events);
const applied = engine.dispatchMany(scene, prepared.events);
assert.equal(applied.scene.actors.find(item => item.id === "defender").hp, 14, "final damage quote caps a 20 damage instance to 6");
console.log("LionWing derived combat: deterministic quote composition, context gating, source provenance, rounding/caps, and engine final-damage revalidation passed");

