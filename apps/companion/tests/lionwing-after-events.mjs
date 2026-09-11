import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;
const adapters = context.window.DAWN_LIONWING_ADAPTERS;
const actor = (id, team = "hero", extra = {}) => ({ id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null, rulesEdition: "lionwing", team, space: "main", x: team === "hero" ? 1 : 3, y: 1, hp: 10, maxHp: 10, ap: 3, baseAp: 3, focus: 2, influence: 0, wounds: 0, stress: 0, tier: 2, speed: 4, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {}, ...extra });
const fixture = (heroExtra = {}, enemyExtra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor("h", "hero", heroExtra), actor("e", "enemy", enemyExtra)], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [] });
let serial = 0;
const event = (actorId, payload, id = `after:${++serial}`) => ({ id, type: "lionwing.command", actorId, payload });
const run = (scene, actorId, payload, id) => engine.dispatchMany(scene, [event(actorId, payload, id)]).scene;
const enable = (scene, ruleId) => run(scene, "h", { kind: "automation", ruleId, enabled: true });
const choose = (scene, actorId, choice, extra = {}) => {
  const pending = scene.lionwing.choices[0];
  assert.ok(pending, "a choice is pending");
  return run(scene, actorId, { kind: "choice", id: pending.id, choice, ...extra });
};

// Adapters expose only the reviewed, canonical source identity and remain
// inactive until the narrator opts them in.
const catalogActor = actor("catalog", "hero", { knownTechniques: { "bulwark.rising-challenger": 1, "powerhouse.berserker": 3, "powerhouse.intimidator": 3, "disruptor.siren": 2, "disruptor.chemist": 2 } });
const canonicalDir = new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/", import.meta.url);
const canonicalTechniques = fs.readdirSync(canonicalDir).filter(file => file.endsWith(".json")).flatMap(file => JSON.parse(fs.readFileSync(new URL(file, canonicalDir), "utf8")).techniques);
const sourceDigest = ruleId => { const techniqueId = ruleId.replace(/\.\d+$/, ""), levelNumber = Number(ruleId.match(/\.(\d+)$/)[1]), technique = canonicalTechniques.find(item => item.id === techniqueId), level = technique?.levels.find(item => item.n === levelNumber); assert.ok(technique && level, `canonical source has ${ruleId}`); return crypto.createHash("sha256").update(JSON.stringify({ id: ruleId, archetypeId: technique.archetypeId, techniqueId: technique.id, name: level.name, text: level.text, notes: technique.notes, source: technique.source })).digest("hex"); };
for (const id of ["bulwark.rising-challenger.1", "powerhouse.berserker.3", "powerhouse.intimidator.3", "disruptor.siren.2", "disruptor.chemist.2"]) { const rule = adapters.list(catalogActor).find(item => item.id === id); assert.ok(rule); assert.equal(rule.sourceDigest, sourceDigest(id)); }
assert.equal(adapters.afterEvent(catalogActor, { id: "x", type: "damage.apply", actorId: "e", payload: { targetId: "catalog", dealt: 2 } }, {}).length, 0);

// Rising Challenger: a successful Clash grants Focus, then leaves optional
// movement as an explicit, persisted choice.  Reload and replay do not repeat it.
let scene = fixture({ knownTechniques: { "bulwark.rising-challenger": 1 } });
scene = enable(scene, "bulwark.rising-challenger.1");
scene = run(scene, "h", { kind: "turn-start" }, "rise-turn");
scene = run(scene, "e", { kind: "attack", targetIds: ["h"], amount: 4 }, "rise-attack");
const prepared = engine.prepare(scene, { actorId: "h", eventId: "rise-clash", kind: "reaction", choice: "clash" }, { random: () => 0.6 });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
let committed = engine.dispatchMany(scene, prepared.events);
scene = committed.scene;
if (scene.lionwing.choices[0]?.kind === "clash-tie") scene = choose(scene, "h", "win");
assert.equal(scene.actors.find(a => a.id === "h").focus, 1, "successful Clash grants one Focus after the Clash cost");
assert.equal(scene.lionwing.choices[0].kind, "technique-trigger", "movement remains an explicit choice");
scene = choose(scene, "h", "skip");
const reloaded = engine.reload(JSON.parse(JSON.stringify(scene)));
const replayed = engine.dispatchMany(reloaded, prepared.events);
assert.deepEqual(replayed.scene, reloaded, "replaying a completed Clash does not repeat the reward");

// Berserker is limited to the first positive damage event in one owner Turn.
scene = fixture({ knownTechniques: { "powerhouse.berserker": 3 }, hp: 10 });
scene = enable(scene, "powerhouse.berserker.3");
scene = run(scene, "h", { kind: "turn-start" }, "berserk-turn");
scene = run(scene, "e", { kind: "damage", targetId: "h", amount: 1, sourceActorId: "e" }, "berserk-damage-1");
assert.equal(scene.actors.find(a => a.id === "h").focus, 3);
scene = run(scene, "e", { kind: "damage", targetId: "h", amount: 1, sourceActorId: "e" }, "berserk-damage-2");
assert.equal(scene.actors.find(a => a.id === "h").focus, 3, "second damage in same Turn gives no second Focus");

// Intimidator receives both resources only for an enemy KO caused by this actor.
scene = fixture({ knownTechniques: { "powerhouse.intimidator": 3 } }, { hp: 1, maxHp: 1 });
scene = enable(scene, "powerhouse.intimidator.3");
scene = run(scene, "h", { kind: "damage", targetId: "e", amount: 3, sourceActorId: "h", irreducible: true }, "intimidator-ko");
assert.equal(scene.actors.find(a => a.id === "h").focus, 4);
assert.equal(scene.actors.find(a => a.id === "h").ap, 4);

// Siren's pull and Chemist's threshold are both optional entry choices.
scene = fixture({ knownTechniques: { "disruptor.siren": 2 } });
scene.activeActorId = "h";
scene.turnSerial = 1;
scene = enable(scene, "disruptor.siren.2");
scene = run(scene, "h", { kind: "effect", targetId: "e", effect: "negative.испуган", sourceId: "fear:h" }, "siren-fear");
assert.equal(scene.lionwing.choices[0].kind, "technique-trigger");
scene = choose(scene, "h", "skip");

scene = fixture({ knownTechniques: { "disruptor.chemist": 2 }, focus: 0 }, { hp: 2, maxHp: 10 });
scene.actors[0].attrs.mind = 2;
scene = enable(scene, "disruptor.chemist.2");
scene = run(scene, "h", { kind: "effect", targetId: "e", effect: "negative.ослаблен", sourceId: "weak:h" }, "chemist-weaken");
assert.equal(scene.lionwing.choices[0].kind, "technique-trigger");
scene = choose(scene, "h", "check-health");
assert.equal(scene.actors.find(a => a.id === "e").knockedOut, true);
assert.equal(scene.actors.find(a => a.id === "h").focus, 2);

// Grim Ascendant II is the new optional Drain Life rule, not the obsolete
// half-damage/Regeneration toggle. The adapter requires the transformed state
// and a real Spirit Finisher with one target.
const grimScene = fixture({ knownTechniques: { "ruiner.grim-ascendant": 2 }, ruleState: { grimTransformed: true } });
const grimActor = grimScene.actors[0]; grimActor.lionwing.automation = { "ruiner.grim-ascendant.2": true };
const grimTrigger = adapters.afterEvent(grimActor, { id: "grim-finisher", type: "action.resolve", actorId: grimActor.id, execution: { actionInstanceId: "grim-action" }, payload: { actionId: "action.атаки.завершение", actionInstanceId: "grim-action", attribute: "spirit", targetIds: ["e"] } }, { scene: grimScene });
assert.equal(grimTrigger.length, 1, "transformed Spirit Finishers open Drain Life");
assert.equal(grimTrigger[0].choices[0].id, "drain");
assert.equal(grimTrigger[0].choices[0].operations.length, 2, "Drain Life applies one linked Immobilize to each participant");
assert.equal(grimTrigger[0].choices[0].operations[0].effect, "negative.обездвижен");

// Meal/Bond identity is deliberately unavailable in the current runtime.
assert.equal(adapters.afterEvent(catalogActor, { id: "meal", type: "meal.eaten", actorId: "catalog", payload: {} }, {}).length, 0);
console.log("LionWing after-event adapters passed: opt-in, Clash reward choice, Turn limit, KO rewards, Fear/Weaken choices, reload/replay and unsupported Meal/Bond exclusion");
