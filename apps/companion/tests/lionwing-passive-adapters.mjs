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
  "bulwark.absolute-bastard.1",
  "disruptor.siren.1",
  "ruiner.spellcrafter.2",
  "bulwark.stalwart-sentry.2",
  "altruist.empath.3",
  "bulwark.iron-bodied.2",
  "bulwark.iron-bodied.1",
  "bulwark.giant-frame.2",
  "bulwark.rising-challenger.3",
  "bulwark.absolute-bastard.3",
  "altruist.chronomancer.2",
  "ruiner.feral-arcana.3",
  "ruiner.cryomancer.2",
  "bulwark.grappler.2",
  "disruptor.bloodletter.2",
  "disruptor.constrictor.3",
  "powerhouse.gunslinger.2",
  "powerhouse.martial-artist.3",
  "vagabond.skirmisher.3",
  "vagabond.knife-juggler.2",
  "ruiner.flame-heart.3",
  "ruiner.sellsword-s-call.1",
  "disruptor.street-fighter.2",
  "powerhouse.lancer.1",
  "ruiner.flame-heart.2",
  "vagabond.assassin.2",
];
const castRules = ["altruist.chronomancer.2", "ruiner.feral-arcana.3", "ruiner.flame-heart.3", "ruiner.cryomancer.2", "ruiner.sellsword-s-call.1"];
const skirmishRules = ["bulwark.grappler.2", "disruptor.bloodletter.2", "disruptor.constrictor.3", "powerhouse.gunslinger.2", "vagabond.skirmisher.3", "vagabond.knife-juggler.2"];
const knownTechniques = passiveRules.reduce((result, id) => {
  const techniqueId = id.replace(/\.\d+$/, ""), level = Number(id.match(/\.(\d+)$/)[1]);
  result[techniqueId] = Math.max(Number(result[techniqueId] || 0), level);
  return result;
}, {});

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
  assert.equal(rule.coverage, ["bulwark.iron-bodied.2", "bulwark.rising-challenger.3", "bulwark.absolute-bastard.3", "altruist.empath.3"].includes(rule.id) ? "full" : "partial", `${rule.id} declares its actual scope`);
}

// No rule applies until the narrator has explicitly enabled it.  Plural
// contributions retain stable source IDs so overlapping passive clauses stack.
let scene = fixture({ knownTechniques });
let hero = scene.actors[0];
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.skirmish, targetId: "e" }), 0);
assert.equal(adapters.statBonus(hero, "armor", { scene }), 0);
scene = enableAll(scene, passiveRules);
hero = scene.actors[0];
assert.deepEqual(copy(adapters.rollBonuses(hero, { scene, kind: "attack", actionId: ids.skirmish, targetId: "e" }).map(item => item.id).sort()), [...skirmishRules, "powerhouse.martial-artist.3"].sort());
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.skirmish, targetId: "e" }), 7, "six Skirmish clauses and the all-Attack clause stack");
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.spell, targetId: "e" }), 7, "five Cast entries and the all-Attack clause stack");
assert.equal(adapters.rollBonus(hero, { scene, kind: "attack", actionId: ids.charge, targetId: "e" }), 0, "passive Advantage does not leak into a different Action");
assert.equal(adapters.rollBonus(hero, { scene, kind: "clash", opponentId: "e" }), 2);
assert.equal(adapters.statBonus(hero, "spirit", { scene, kind: "clash", opponentId: "e" }), 2);
assert.equal(adapters.statBonus(hero, "spirit", { scene, kind: "attack", actionId: ids.skirmish }), 0, "Rising Challenger changes Spirit only in a Clash");
assert.deepEqual(copy(adapters.statBonuses(hero, "armor", { scene }).map(item => item.id)), ["bulwark.iron-bodied.2"]);
assert.equal(adapters.statBonus(hero, "armor", { scene }), 3, "odd Body rounds up for [Body/2] Armor");
assert.equal(adapters.statBonus(hero, "maxHp", { scene }), 5, "Giant Frame adds Body to maximum Health");
assert.equal(adapters.statMinimum(hero, "speed", { scene }), 3, "Iron Bodied supplies a Speed floor instead of a bonus");

// Scene and Turn boundary clauses use one lifecycle hook. Automation survives
// Scene reset, so the narrator does not need to re-enable every technique.
const startRules = ["bulwark.absolute-bastard.1", "disruptor.siren.1", "ruiner.spellcrafter.2", "bulwark.stalwart-sentry.2"];
let starting = enableAll(fixture({ knownTechniques }), startRules);
starting = run(copy(starting), "h", { kind: "turn-start" });
assert.equal(starting.actors[0].focus, 11, "base Focus 3 receives +3, +3 and Mind 2 at Scene start");
assert.equal(starting.actors[0].ruleClocks["bulwark.stalwart-sentry.vigilance"].current, 4);
assert.equal(starting.log.filter(event => event.type === "rule.activated" && event.payload.boundary === "sceneStart").length, 4);
starting = run(starting, null, { kind: "scene-reset" });
assert.equal(Object.keys(starting.actors[0].lionwing.automation).length, 4, "Scene reset preserves narrator automation choices");
starting = run(copy(starting), "h", { kind: "turn-start" });
assert.equal(starting.actors[0].focus, 11, "Scene bonuses apply once again after a real reset");

let empathScene = fixture();
empathScene.actors[0].tier = 2;
empathScene.actors[0].knownTechniques = { "altruist.empath": 3 };
empathScene.actors[1] = actor("ally", "hero", 2, { hp: 8, maxHp: 16 });
empathScene = enable(empathScene, "altruist.empath.3");
empathScene = run(empathScene, "ally", { kind: "turn-start" });
assert.equal(empathScene.actors[1].focus, 6, "an adjacent ally gains 3 Focus at Turn start");
assert.equal(empathScene.actors[1].hp, 10, "the same ally restores the Empath's Tier in Health");

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

// Conditional numeric clauses receive only reviewed semantic context: target
// distance/effects, source effects, action attribute and Technique tags.
let lancerScene = enable(fixture({ knownTechniques: { "powerhouse.lancer": 1 } }), "powerhouse.lancer.1");
lancerScene = run(lancerScene, "h", { kind: "turn-start" });
prepared = prepare(lancerScene, "h", { kind: "action", actionId: ids.skirmish, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 6, "Lancer adds the real target distance");
assert.equal(adapters.rollBonus(lancerScene.actors[0], { kind: "attack", actionId: ids.skirmish, targetDistance: 8 }), 3, "Lancer caps distance Advantage at three");

let streetScene = enable(fixture({ knownTechniques: { "disruptor.street-fighter": 2 } }), "disruptor.street-fighter.2");
streetScene = run(streetScene, "h", { kind: "effect", targetId: "e", effect: "negative.ошеломлен" });
streetScene = run(streetScene, "h", { kind: "effect", targetId: "e", effect: "negative.замедлен" });
streetScene = run(streetScene, "h", { kind: "turn-start" });
prepared = prepare(streetScene, "h", { kind: "action", actionId: ids.skirmish, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 7, "Street Fighter counts distinct active target Effects");
prepared = prepare(streetScene, "h", { kind: "action", actionId: ids.skirmish, targetIds: ["e"], techniqueTags: ["weapon"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 5, "a weapon-tagged Technique blocks the conditional bonus");

const conditionalActor = actor("conditional", "hero", 1, { tier: 2, knownTechniques: { "vagabond.assassin": 2, "ruiner.flame-heart": 2 }, lionwing: { automation: { "vagabond.assassin.2": true, "ruiner.flame-heart.2": true } } });
assert.equal(adapters.rollBonus(conditionalActor, { kind: "attack", actionId: ids.skirmish, sourceEffectIds: ["positive.исчез"] }), 2);
assert.equal(adapters.rollBonus(conditionalActor, { kind: "attack", actionId: ids.spell, sourceEffectIds: ["negative.порчен"], tension: 3 }), 3);

// The action preparation boundary consumes the opt-in contributions and keeps
// their separate pools visible for the real action that invoked them.
scene = enableAll(fixture({ knownTechniques }), skirmishRules);
scene = run(scene, "h", { kind: "turn-start" });
prepared = prepare(scene, "h", { kind: "action", actionId: ids.skirmish, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 11, "Skirmish uses Body 5 plus six enabled Advantages");
scene = enableAll(fixture({ knownTechniques }), castRules);
scene = run(scene, "h", { kind: "turn-start" });
prepared = prepare(scene, "h", { kind: "action", actionId: ids.spell, targetIds: ["e"] });
assert.equal(prepared.events[0].payload.roll.initialCount, 9, "Cast uses Spirit 3 plus six enabled Advantages");

// Static maxima and floors are queried by the same engine paths used by the
// table instead of being baked into imported character data.
let giant = enable(fixture({ maxHp: 16, hp: 10, speed: 1, knownTechniques: { "bulwark.giant-frame": 2, "bulwark.iron-bodied": 1 } }), "bulwark.giant-frame.2");
giant = enable(giant, "bulwark.iron-bodied.1");
assert.equal(lionwing.maxHealth(giant.actors[0]), 21);
assert.equal(lionwing.speed(giant.actors[0]), 3);
giant = run(giant, "h", { kind: "heal", amount: 20 });
assert.equal(giant.actors[0].hp, 21, "healing uses the automated maximum Health");

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
