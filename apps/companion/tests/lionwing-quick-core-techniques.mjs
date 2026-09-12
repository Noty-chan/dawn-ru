import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
const engine = loadSceneEngine(context);
vm.runInContext(fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8"), context, { filename: "technique-engine.js" });
const adapters = context.window.DAWN_LIONWING_ADAPTERS;
const techniqueEngine = context.window.DAWN_TECHNIQUE_ENGINE;
const copy = value => JSON.parse(JSON.stringify(value));

const canonical = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json", import.meta.url), "utf8"));
const canonicalLevel = id => {
  const techniqueId = id.replace(/\.\d+$/, ""), levelNumber = Number(id.split(".").at(-1));
  const archetype = canonical.archetypes.find(item => item.techniques.some(technique => technique.id === techniqueId));
  const technique = archetype?.techniques.find(item => item.id === techniqueId);
  const level = technique?.levels.find(item => Number(item.n) === levelNumber);
  assert.ok(archetype && technique && level, `canonical source contains ${id}`);
  return {
    digest: crypto.createHash("sha256").update(JSON.stringify({
      id, archetypeId: archetype.id, techniqueId, name: level.name, text: level.text,
      notes: technique.notes ?? "", source: technique.source ?? null,
    })).digest("hex"),
    text: level.text,
  };
};

const actor = (id, extra = {}) => ({
  id, name: id, rulesEdition: "lionwing", team: "hero", space: "main", x: 1, y: 1,
  attrs: { body: 3, talent: 4, spirit: 2, mind: 2 }, speed: 3, armor: 0, evasion: 2,
  hp: 15, maxHp: 15, tier: 2, focus: 2, ap: 3, wounds: 0, knockedOut: false,
  effects: [], effectStates: {}, knownTechniques: {}, techniques: {}, lionwing: { automation: {} }, ...extra,
});
const scene = (owner, extra = {}) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: owner.id,
  spaces: [{ id: "main", width: 7, height: 7 }], actors: [owner], objects: [], walls: [],
  markers: [], log: [], targetIds: [], reminders: [], rollFeed: [], ...extra,
});

for (const id of ["vagabond.sniper.1", "vagabond.untouchable.1"]) {
  const source = canonicalLevel(id);
  const coverage = techniqueEngine.techniqueCoverage(context.window.DAWN_LIONWING_DATA).find(row => row.id === id);
  assert.equal(coverage?.automation, "full", `${id} is full in the technique registry`);
  assert.equal(coverage?.rules[0]?.sourceDigest, source.digest, `${id} carries the canonical digest`);
  assert.equal(coverage?.text, source.text, `${id} carries the canonical EN text`);
}

// Sniper I is an unconditional Talent-Finisher range floor.  Ownership and
// the explicit automation opt-in are both required, and the floor composes
// with a larger base range without changing it.
const sniper = actor("sniper", {
  knownTechniques: { "vagabond.sniper": 1 },
  techniques: { "vagabond.sniper": 1 },
  lionwing: { automation: { "vagabond.sniper.1": true } },
});
const sniperScene = scene(sniper);
assert.equal(adapters.rangeQuote(sniper, { scene: sniperScene, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute: "talent", baseValue: 1 }).value, 5);
assert.equal(adapters.rangeQuote(sniper, { scene: sniperScene, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute: "talent", baseValue: 7 }).value, 7);
assert.equal(adapters.rangeQuote(sniper, { scene: sniperScene, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute: "body", baseValue: 1 }).value, 1);
assert.equal(adapters.rangeQuote({ ...sniper, lionwing: { automation: {} } }, { scene: sniperScene, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute: "talent", baseValue: 1 }).value, 1);
assert.equal(adapters.rangeQuote({ ...sniper, rulesEdition: "legacy" }, { scene: sniperScene, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute: "talent", baseValue: 1 }).value, 1);
const sniperReload = copy(sniperScene);
assert.equal(adapters.rangeQuote(sniperReload.actors[0], { scene: sniperReload, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute: "talent", baseValue: 1 }).value, 5, "Sniper survives JSON reload");
assert.equal(adapters.rangeQuote(sniperReload.actors[0], { scene: sniperReload, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute: "talent", baseValue: 1 }).value, 5, "replayed quote is stable");

// Untouchable I is first-Dodge-per-Round state.  A completed Dodge receipt
// closes the current Round, then the same persisted opt-in becomes available
// again at the next Round boundary.
const untouchable = actor("untouchable", {
  knownTechniques: { "vagabond.untouchable": 1 },
  techniques: { "vagabond.untouchable": 1 },
  lionwing: { automation: { "vagabond.untouchable.1": true } },
});
let dodgeScene = scene(untouchable);
const dodgeContext = { scene: dodgeScene, kind: "dodge", key: "dodgeEvasion", baseValue: 2 };
assert.equal(adapters.numericQuote(untouchable, dodgeContext).value, 6, "first Dodge gets +Talent");
dodgeScene.log.push({ type: "reaction.respond", actorId: untouchable.id, payload: { choice: "dodge", round: 1 } });
assert.equal(adapters.numericQuote(untouchable, { ...dodgeContext, scene: dodgeScene }).value, 2, "second Dodge in one Round gets no bonus");
dodgeScene.round = 2;
assert.equal(adapters.numericQuote(untouchable, { ...dodgeContext, scene: dodgeScene }).value, 6, "bonus returns at next Round");
const dodgeReload = copy(dodgeScene);
assert.equal(adapters.numericQuote(dodgeReload.actors[0], { ...dodgeContext, scene: dodgeReload }).value, 6, "Round boundary survives JSON reload");
assert.equal(adapters.numericQuote({ ...dodgeReload.actors[0], lionwing: { automation: {} } }, { ...dodgeContext, scene: dodgeReload }).value, 2, "known but disabled Untouchable gives no bonus");

console.log("LionWing quick core techniques passed: canonical EN digests, ownership/opt-in, range floor, Round gate, negative, boundary, reload and replay");
