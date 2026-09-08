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
const lionwing = context.window.DAWN_LIONWING_ENGINE;
const adapters = context.window.DAWN_LIONWING_ADAPTERS;
const ids = engine.ACTION_IDS;
const copy = value => JSON.parse(JSON.stringify(value));

const passiveRules = [
  "bulwark.iron-bodied.2",
  "bulwark.rising-challenger.3",
  "bulwark.absolute-bastard.3",
  "altruist.chronomancer.2",
  "ruiner.feral-arcana.3",
  "ruiner.cryomancer.2",
  "bulwark.grappler.2",
  "disruptor.bloodletter.2",
  "disruptor.constrictor.3",
  "powerhouse.gunslinger.2",
  "vagabond.skirmisher.3",
];
const castRules = ["altruist.chronomancer.2", "ruiner.feral-arcana.3", "ruiner.cryomancer.2"];
const skirmishRules = ["bulwark.grappler.2", "disruptor.bloodletter.2", "disruptor.constrictor.3", "powerhouse.gunslinger.2", "vagabond.skirmisher.3"];
const knownTechniques = Object.fromEntries(passiveRules.map(id => [id.replace(/\.\d+$/, ""), Number(id.match(/\.(\d+)$/)[1])]));

const actor = (id, team, x, extra = {}) => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x, y: 1, hp: team === "hero" ? 16 : 20, maxHp: team === "hero" ? 16 : 20,
  ap: 3, baseAp: 3, focus: 3, influence: 3, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 5, talent: 3, spirit: 3, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false,
  knownTechniques: {}, techniques: {}, lionwing: {}, ...extra,
});
const fixture = (heroExtra = {}) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null,
  spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor("h", "hero", 1, heroExtra), actor("e", "enemy", 2)],
  objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [],
});
let serial = 0;
const run = (scene, actorId, payload) => lionwing.dispatchMany(scene, [{ ...lionwing.command(actorId, payload), id: `passive:${++serial}` }]).scene;
const enable = (scene, ruleId) => run(scene, "h", { kind: "automation", ruleId, enabled: true });
const enableAll = (scene, ruleIds) => ruleIds.reduce((current, ruleId) => enable(current, ruleId), scene);
const prepare = (scene, actorId, payload) => {
  const result = lionwing.prepare(scene, { actorId, eventId: `passive:prepared:${++serial}`, ...payload }, { random: () => 0.6 });
  assert.equal(result.ok, true, result.errors?.join(" "));
  return result;
};

// Every adapter is anchored to the reviewed canonical source.  The partial
// entries deliberately cover only their passive Advantage clause.
const canonicalDir = new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/", import.meta.url);
const canonicalTechniques = fs.readdirSync(canonicalDir)
  .filter(file => file.endsWith(".json"))
  .flatMap(file => JSON.parse(fs.readFileSync(new URL(file, canonicalDir), "utf8")).techniques);
const sourceDigest = ruleId => {
  const techniqueId = ruleId.replace(/\.\d+$/, ""), levelNumber = Number(ruleId.match(/\.(\d+)$/)[1]);
  const technique = canonicalTechniques.find(item => item.id === techniqueId);
  const level = technique?.levels.find(item => item.n === levelNumber);
  assert.ok(technique && level, `canonical source has ${ruleId}`);
  return crypto.createHash("sha256").update(JSON.stringify({ id: ruleId, archetypeId: technique.archetypeId, techniqueId: technique.id, name: level.name, text: level.text, notes: technique.notes, source: technique.source })).digest("hex");
};
const catalogActor = actor("catalog", "hero", 1, { knownTechniques });
const catalog = adapters.list(catalogActor).filter(rule => passiveRules.includes(rule.id));
assert.deepEqual(copy(catalog.map(rule => rule.id).sort()), [...passiveRules].sort());
for (const rule of catalog) {
  assert.equal(rule.sourceDigest, sourceDigest(rule.id), `${rule.id} keeps its canonical source identity`);
  assert.equal(rule.coverage, ["bulwark.iron-bodied.2", "bulwark.rising-challenger.3", "bulwark.absolute-bastard.3"].includes(rule.id) ? "full" : "partial", `${rule.id} declares its actual scope`);
}

// No rule applies until the narrator has explicitly enabled it.  Plural
// contributions retain stable source IDs so overlapping passive clauses stack.
let scene = fixture({ knownTechniques });
let hero = scene.actors[0];
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.skirmish, targetId: "e" }), 0);
assert.equal(adapters.statBonus(hero, "armor", { scene }), 0);
scene = enableAll(scene, passiveRules);
hero = scene.actors[0];
assert.deepEqual(copy(adapters.rollBonuses(hero, { scene, kind: "attack", actionId: ids.skirmish, targetId: "e" }).map(item => item.id)), skirmishRules);
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.skirmish, targetId: "e" }), 5, "five Skirmish clauses stack");
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.spell, targetId: "e" }), 3, "three Cast clauses stack");
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.charge, targetId: "e" }), 0, "passive Advantage does not leak into a different Action");
assert.equal(adapters.rollBonus(hero, { scene, kind: "clash", opponentId: "e" }), 2);
assert.equal(adapters.statBonus(hero, "spirit", { scene, kind: "clash", opponentId: "e" }), 2);
assert.equal(adapters.statBonus(hero, "spirit", { scene, kind: "attack", actionId: ids.skirmish }), 0, "Rising Challenger changes Spirit only in a Clash");
assert.deepEqual(copy(adapters.statBonuses(hero, "armor", { scene }).map(item => item.id)), ["bulwark.iron-bodied.2"]);
assert.equal(adapters.statBonus(hero, "armor", { scene }), 3, "odd Body rounds up for [Body/2] Armor");

// Absolute Bastard is target-specific and checks the source of Taunted rather
// than granting its bonus against every Taunted character on the board.
let tauntScene = fixture({ tier: 3, knownTechniques: { "bulwark.absolute-bastard": 3 } });
tauntScene = enable(tauntScene, "bulwark.absolute-bastard.3");
tauntScene = run(tauntScene, "h", { kind: "effect", targetId: "e", effect: "negative.спровоцирован" });
tauntScene = run(tauntScene, "h", { kind: "turn-start" });
let prepared = prepare(tauntScene, "h", { kind: "action", actionId: ids.skirmish, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 7, "Tier 3 rounds up to two Advantage against your Taunted target");
const foreignTaunt = fixture({ tier: 3, knownTechniques: { "bulwark.absolute-bastard": 3 } });
foreignTaunt.actors.push(actor("other", "hero", 4));
let foreignScene = enable(foreignTaunt, "bulwark.absolute-bastard.3");
foreignScene = run(foreignScene, "other", { kind: "effect", targetId: "e", effect: "negative.спровоцирован" });
foreignScene = run(foreignScene, "h", { kind: "turn-start" });
prepared = prepare(foreignScene, "h", { kind: "action", actionId: ids.skirmish, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 5, "another character's Taunt gives no Advantage");

// The action preparation boundary consumes the opt-in contributions and keeps
// their separate pools visible for the real action that invoked them.
scene = enableAll(fixture({ knownTechniques }), skirmishRules);
scene = run(scene, "h", { kind: "turn-start" });
prepared = prepare(scene, "h", { kind: "action", actionId: ids.skirmish, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 10, "Skirmish uses Body 5 plus five enabled Advantages");
scene = enableAll(fixture({ knownTechniques }), castRules);
scene = run(scene, "h", { kind: "turn-start" });
prepared = prepare(scene, "h", { kind: "action", actionId: ids.spell, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 6, "Cast uses Spirit 3 plus three enabled Advantages");

// Iron Bodied is a normal Armor contribution: it mitigates attacks after
// opt-in, rounds an odd Body upward, and does not persist when disabled.
let armored = enable(fixture({ knownTechniques: { "bulwark.iron-bodied": 2 } }), "bulwark.iron-bodied.2");
armored = run(armored, "e", { kind: "attack", targetIds: ["h"], amount: 5 });
armored = run(armored, "h", { kind: "reaction", choice: "take" });
armored = run(armored, "e", { kind: "resolve-attack" });
assert.equal(armored.actors[0].hp, 14, "5 damage loses 3 Armor and deals 2");
let unarmored = fixture({ knownTechniques: { "bulwark.iron-bodied": 2 } });
unarmored = run(unarmored, "e", { kind: "attack", targetIds: ["h"], amount: 5 });
unarmored = run(unarmored, "h", { kind: "reaction", choice: "take" });
unarmored = run(unarmored, "e", { kind: "resolve-attack" });
assert.equal(unarmored.actors[0].hp, 11, "known but disabled Iron Bodied provides no Armor");

// Rising Challenger changes both sides of the actual Clash contract.  A JSON
// reload retains the enabled rule, and replaying its receipt cannot reroll or
// pay the reduction twice.
let clash = enable(fixture({ knownTechniques: { "bulwark.rising-challenger": 3 } }), "bulwark.rising-challenger.3");
clash = run(clash, "e", { kind: "attack", targetIds: ["h"], amount: 10 });
prepared = prepare(clash, "h", { kind: "reaction", choice: "clash" });
assert.equal(prepared.events[0].payload.roll.initialCount, 6, "Rising Challenger adds two Clash dice");
assert.equal(prepared.events[0].payload.opponentRoll.initialCount, 4, "the attacker gets no borrowed Clash bonus");
const resolvedClash = lionwing.dispatchMany(copy(clash), prepared.events).scene;
assert.equal(resolvedClash.pendingAction.responses.h.reduction, 5, "Clash reduction uses Spirit 3 plus two");
assert.equal(resolvedClash.actors.find(item => item.id === "e").hp, 15, "the winning defender damages the attacker by the same Spirit value");
const replay = lionwing.dispatchMany(copy(resolvedClash), prepared.events);
assert.equal(replay.events.length, 0, "a Clash receipt is idempotent after reload");
assert.deepEqual(copy(replay.scene), copy(resolvedClash));
const afterAttack = run(copy(resolvedClash), "e", { kind: "resolve-attack" });
assert.equal(afterAttack.actors.find(item => item.id === "h").hp, 11, "the same Spirit value reduces the pending Attack");
const inactiveClash = run(fixture({ knownTechniques: { "bulwark.rising-challenger": 3 } }), "e", { kind: "attack", targetIds: ["h"], amount: 10 });
prepared = prepare(inactiveClash, "h", { kind: "reaction", choice: "clash" });
assert.equal(prepared.events[0].payload.roll.initialCount, 4, "known but disabled Rising Challenger leaves the normal Clash pool");

console.log("LionWing passive adapters passed: canonical digests and coverage, opt-in stacking, Cast/Skirmish scope, source-owned Taunt, ceiling Armor, Clash dice/Spirit, reload and replay");
