import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context);
const lionwing = context.window.DAWN_LIONWING_ENGINE;
const adapters = context.window.DAWN_LIONWING_ADAPTERS;
const ids = engine.ACTION_IDS;
const actor = (id, team, x, extra = {}) => ({ id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null, rulesEdition: "lionwing", team, space: "main", x, y: 1, hp: 12, maxHp: 12, ap: 3, baseAp: 3, focus: 3, tier: 2, speed: 4, armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: { automation: {} }, ...extra });
const scene = (extra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "hero", spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor("hero", "hero", 1), actor("enemy", "enemy", 5)], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], lionwing: { schema: 2, sceneSerial: 1, started: true, activeTurnInstanceId: "hero-turn", boundaryReceipts: [], afterEventReceipts: [], history: [], choices: [], deferred: [] }, ...extra });
const enabled = (extra = {}) => actor("hero", "hero", 1, { knownTechniques: { "powerhouse.monastic-sage": 3 }, techniques: { "powerhouse.monastic-sage": 3 }, lionwing: { automation: { "powerhouse.monastic-sage.1": true, "powerhouse.monastic-sage.2": true, "powerhouse.monastic-sage.3": true }, ...extra } });
const event = (actionId, actionInstanceId = "utility-instance", extra = {}) => ({ id: `${actionInstanceId}:${actionId}`, type: "action.resolve", actorId: "hero", payload: { actionId, actionInstanceId, ownerTurnInstanceId: "hero-turn" }, execution: { rootActionId: `${actionInstanceId}:root`, actionInstanceId, ownerTurnInstanceId: "hero-turn" }, ...extra });

const hero = enabled({ history: [
  { actionId: ids.skirmish, actionInstanceId: "attack-1", ownerTurnInstanceId: "hero-turn", turnSerial: 1 },
  { actionId: ids.breathe, actionInstanceId: "utility-1", ownerTurnInstanceId: "hero-turn", turnSerial: 1 },
] });
assert.equal(adapters.statBonus(hero, "armor", { activeEffectIds: ["positive.усилен"] }), 2, "Strengthened grants the canonical Armor bonus");
assert.equal(adapters.statBonus(hero, "armor", { activeEffectIds: [] }), 0, "without Strengthened there is no Armor bonus");
assert.equal(adapters.boundaryOperations(hero, { boundary: "turnEnd", activeActor: hero, activeEffectIds: ["positive.ускорен"] })[0].operations[0].amount, 2, "Hastened grants two Evasion at own Turn end");
const positive = adapters.afterEvent(hero, event(ids.breathe), { scene: scene({ actors: [hero, actor("enemy", "enemy", 5)] }) });
assert.equal(positive.length, 1, "an authoritative Utility after Attack opens Balance fill");
assert.equal(positive[0].id, "powerhouse.monastic-sage.2");
assert.equal(positive[0].operations[0].delta, 1);
assert.equal(positive[0].sourceDigest, "68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60");
assert.equal(adapters.afterEvent(hero, event(ids.skirmish, "attack-2"), { scene: scene({ actors: [hero, actor("enemy", "enemy", 5)] }) }).length, 0, "a repeated Attack does not fill Balance");
assert.equal(adapters.afterEvent(hero, { ...event(ids.breathe, "forged"), execution: undefined }, { scene: scene({ actors: [hero, actor("enemy", "enemy", 5)] }) }).length, 0, "a forged action event without execution provenance is ignored");

const boundaryHero = enabled();
const boundaryScene = scene({ actors: [boundaryHero, actor("enemy", "enemy", 5)] });
const start = adapters.boundaryOperations(boundaryHero, { scene: boundaryScene, boundary: "sceneStart", canonicalBoundary: "sceneStart", activeActor: null });
assert.equal(start[0].operations[0].id, "powerhouse.monastic-sage.balance");
assert.equal(start[0].operations[0].size, 8, "Balance is an eight segment scene clock");
boundaryHero.ruleClocks = { ["powerhouse.monastic-sage.balance"]: { current: 2, max: 8, size: 8 } };
const turnChoice = adapters.boundaryOperations(boundaryHero, { scene: boundaryScene, boundary: "turnStart", canonicalBoundary: "ownTurnStart", activeActor: boundaryHero });
assert.deepEqual(Array.from(turnChoice[0].choices, choice => choice.id), ["strengthen", "hasten"], "start of own Turn offers exactly the two canonical choices");
assert.equal(turnChoice[0].choices[0].operations[0].delta, -1, "the choice spends one Balance segment atomically");
const reloadedBoundary = lionwing.reload(JSON.parse(JSON.stringify(boundaryScene)));
const reloadedHero = reloadedBoundary.actors.find(item => item.id === "hero");
assert.equal(reloadedHero.ruleClocks["powerhouse.monastic-sage.balance"].current, 2, "Balance survives a JSON reload");
assert.deepEqual(Array.from(adapters.boundaryOperations(reloadedHero, { scene: reloadedBoundary, boundary: "turnStart", canonicalBoundary: "ownTurnStart", activeActor: reloadedHero })[0].choices, choice => choice.id), ["strengthen", "hasten"], "reloaded state offers the same owner-turn choices");

const meditateHero = enabled();
meditateHero.ruleClocks = {
  ["powerhouse.monastic-sage.balance"]: { current: 8, max: 8, size: 8 },
  ["powerhouse.monastic-sage.meditated"]: { current: 0, max: 1, size: 1 },
};
const meditateScene = scene({ actors: [meditateHero, actor("enemy", "enemy", 5)] });
const meditate = adapters.afterEvent(meditateHero, event(ids.charge, "charge-1"), { scene: meditateScene });
assert.equal(meditate.length, 1, "Charge opens an optional Meditate decision");
const meditateOption = meditate[0].choices.find(choice => choice.id === "meditate");
assert.equal(meditateOption.context.full, true);
assert.equal(meditateOption.operations.find(operation => operation.kind === "modifier").amount, 8);
assert.equal(meditateOption.operations.find(operation => operation.kind === "clock" && operation.id === "powerhouse.monastic-sage.balance").current, 0);
assert.equal(meditateOption.operations.some(operation => operation.kind === "resource" && operation.resource === "focus" && operation.amount === 3), true, "a full Balance grants Tier plus one Focus");
assert.match(meditateOption.context.manualRemainder, /Teleport/);

const duplicate = adapters.afterEvent(meditateHero, event(ids.charge, "charge-1"), { scene: meditateScene });
assert.equal(duplicate.length, 1, "adapter produces a stable trigger for duplicate receipt handling");
meditateHero.ruleClocks["powerhouse.monastic-sage.meditated"].current = 1;
assert.equal(adapters.afterEvent(meditateHero, event(ids.breathe, "after-meditate"), { scene: meditateScene }).length, 0, "Balance does not fill after Meditate in the same Turn");

const canonical = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/powerhouse.json", import.meta.url), "utf8"));
const canonicalTechnique = canonical.techniques.find(item => item.id === "powerhouse.monastic-sage");
for (const [level, expected] of [[1, "f1ff824c2299d7184c07c4bf6a212d3a2f8c40a914d18948ed0c1987059480cc"], [2, "68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60"], [3, "b12c0e7f1d63dd1217d15f64aa7f2fcb7bbfa649761b476eb5e0840bc36ba994"]]) {
  const levelData = canonicalTechnique.levels.find(item => Number(item.n) === level);
  const payload = JSON.stringify({ id: `powerhouse.monastic-sage.${level}`, archetypeId: canonicalTechnique.archetypeId, techniqueId: canonicalTechnique.id, name: levelData.name, text: levelData.text, notes: canonicalTechnique.notes, source: canonicalTechnique.source });
  assert.equal(crypto.createHash("sha256").update(payload).digest("hex"), expected, `level ${level} digest covers the complete canonical payload`);
}

console.log("Monastic Sage I–III: canonical digests, Balance lifecycle, guarded alternating actions, optional choices, Meditate boundary, duplicate and reload-safe state checks passed");
