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
const clone = value => JSON.parse(JSON.stringify(value));
const actor = (id, team, x, y, extra = {}) => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x, y, hp: 12, maxHp: 12, ap: 4, baseAp: 4,
  focus: 4, influence: 0, wounds: 0, stress: 0, tier: 2, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 2, talent: 2, spirit: 3, mind: 2 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {}, ...extra,
});
const fixture = ({ hero = {}, enemy = {}, activeActorId = "h", turnSerial = 1 } = {}) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial, activeActorId, tension: 6,
  spaces: [{ id: "main", width: 9, height: 7 }], actors: [actor("h", "hero", 1, 1, hero), actor("e", "enemy", 5, 1, enemy)],
  objects: [], walls: [], markers: [], topology: { cuts: [] }, log: [], targetIds: [], reminders: [], rollFeed: [], lionwing: {},
});
const event = (actorId, payload, id) => ({ id, type: "lionwing.command", actorId, payload });
const run = (scene, actorId, payload, id) => engine.dispatchMany(scene, [event(actorId, payload, id)]).scene;
const choose = (scene, actorId, choice, id) => {
  const pending = scene.lionwing.choices[0];
  assert.ok(pending, "a LionWing choice is pending");
  return run(scene, actorId, { kind: "choice", id: pending.id, choice }, id);
};

const canonicalDir = new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/", import.meta.url);
const canonicalTechniques = fs.readdirSync(canonicalDir).filter(file => file.endsWith(".json")).flatMap(file => JSON.parse(fs.readFileSync(new URL(file, canonicalDir), "utf8")).techniques);
const sourceDigest = ruleId => {
  const techniqueId = ruleId.replace(/\.\d+$/, ""), levelNumber = Number(ruleId.match(/\.(\d+)$/)[1]);
  const technique = canonicalTechniques.find(item => item.id === techniqueId), level = technique?.levels.find(item => item.n === levelNumber);
  assert.ok(technique && level, `canonical source has ${ruleId}`);
  return crypto.createHash("sha256").update(JSON.stringify({ id: ruleId, archetypeId: technique.archetypeId, techniqueId: technique.id, name: level.name, text: level.text, notes: technique.notes, source: technique.source })).digest("hex");
};
const digests = Object.fromEntries(["disruptor.siren.1", "disruptor.siren.2", "disruptor.siren.3", "ruiner.bombardier.1", "ruiner.bombardier.2", "ruiner.bombardier.3"].map(id => [id, sourceDigest(id)]));
for (const [id, digest] of Object.entries(digests)) assert.equal(adapters.list(actor("catalog", "hero", 1, 1, { knownTechniques: { [id.replace(/\.\d+$/, "")]: Number(id.match(/\.(\d+)$/)[1]) } })).find(rule => rule.id === id)?.sourceDigest, digest, `adapter digest ${id}`);

// Siren I: the canonical Study receipt opens a voluntary Fear choice, and the
// choice is bound to the same studied target and source digest through spend
// and effect receipts.
let scene = fixture({ hero: { knownTechniques: { "disruptor.siren": 1 }, focus: 0 }, enemy: { x: 3 }, activeActorId: null, turnSerial: 0 });
scene = run(scene, "h", { kind: "automation", ruleId: "disruptor.siren.1", enabled: true }, "siren1-enable");
scene = run(scene, "h", { kind: "turn-start" }, "siren1-turn-start");
const study = engine.prepare(scene, { actorId: "h", eventId: "siren1-study", kind: "action", actionId: "action.утилитарные-действия.изучение", targetIds: ["e"] });
assert.equal(study.ok, true, study.errors?.join(" "));
scene = engine.dispatchMany(scene, study.events).scene;
assert.equal(scene.lionwing.choices[0]?.kind, "technique-trigger", "Siren I offers Fear after Study");
assert.deepEqual([...scene.lionwing.choices[0].options], ["skip", "fear"]);
const siren1CauseId = scene.lionwing.choices[0].context.causeEventId;
const siren1ChoiceEvent = event("h", { kind: "choice", id: scene.lionwing.choices[0].id, choice: "fear" }, "siren1-fear");
scene = engine.dispatchMany(scene, [siren1ChoiceEvent]).scene;
assert.equal(scene.actors.find(item => item.id === "h").focus, 5, "Siren I spends exactly one Focus after the scene-start grant");
assert.ok(scene.actors.find(item => item.id === "e").effects.includes("negative.испуган"));
const siren1Effect = scene.log.find(row => row.type === "effect.apply" && row.payload.targetId === "e" && row.payload.effect === "negative.испуган");
assert.equal(siren1Effect.payload.sourceDigest, digests["disruptor.siren.1"]);
assert.equal(siren1Effect.payload.causeEventId, siren1CauseId);
assert.throws(() => engine.dispatchMany(scene, [event("h", { kind: "effect", targetId: "e", effect: "negative.испуган", remove: true, sourceActorId: "h", sourceActionId: "action.утилитарные-действия.изучение", studyTargetId: "e", ruleId: "disruptor.siren.1", sourceDigest: digests["disruptor.siren.1"], causeEventId: siren1CauseId }, "siren1-remove")]), /снимает|Эффект/i, "Siren I cannot turn its apply receipt into effect removal");
const siren1Reload = engine.reload(clone(scene));
assert.deepEqual(engine.dispatchMany(siren1Reload, [siren1ChoiceEvent]).scene, siren1Reload, "replaying the committed Siren I choice is idempotent");

// Siren II: an owner-Turn Fear opens one pull choice. The pull is stepwise;
// starting adjacent or being blocked never invents the Daze consequence.
scene = fixture({ hero: { knownTechniques: { "disruptor.siren": 2 }, focus: 1 } });
scene = run(scene, "h", { kind: "automation", ruleId: "disruptor.siren.2", enabled: true }, "siren2-enable");
scene = run(scene, "h", { kind: "effect", targetId: "e", effect: "negative.испуган" }, "siren2-fear");
assert.equal(scene.lionwing.choices[0]?.kind, "technique-trigger");
scene = choose(scene, "h", "pull", "siren2-pull");
assert.equal(scene.actors.find(item => item.id === "e").x, 2, "Siren II moves exactly until adjacency within three cells");
assert.equal(scene.lionwing.choices[0]?.kind, "technique-trigger", "Daze is a separate choice after actual adjacency");
assert.deepEqual([...scene.lionwing.choices[0].options], ["skip", "daze"]);
scene = choose(scene, "h", "skip", "siren2-skip");
assert.equal(scene.actors.find(item => item.id === "e").effects.includes("negative.ошеломлен"), false);

const dazeScene = fixture({ hero: { knownTechniques: { "disruptor.siren": 2 }, focus: 1 }, enemy: { x: 3 } });
let daze = run(dazeScene, "h", { kind: "automation", ruleId: "disruptor.siren.2", enabled: true }, "siren2-daze-enable");
daze = run(daze, "h", { kind: "effect", targetId: "e", effect: "negative.испуган" }, "siren2-daze-fear");
daze = choose(daze, "h", "pull", "siren2-daze-pull");
assert.equal(daze.actors.find(item => item.id === "e").x, 2);
daze = choose(daze, "h", "daze", "siren2-daze");
assert.ok(daze.actors.find(item => item.id === "e").effects.includes("negative.ошеломлен"));
assert.equal(daze.actors.find(item => item.id === "h").focus, 2, "Daze grants exactly one Focus");
const siren2Spend = daze.log.find(row => row.type === "resource.gain" && row.payload.sourceDigest === digests["disruptor.siren.2"]);
assert.ok(siren2Spend, "Siren II Focus gain keeps source digest");

const blocked = fixture({ hero: { knownTechniques: { "disruptor.siren": 2 } } });
blocked.objects.push({ id: "wall-cell", type: "terrain", space: "main", cells: ["4,1"] });
let blockedScene = run(blocked, "h", { kind: "automation", ruleId: "disruptor.siren.2", enabled: true }, "siren2-blocked-enable");
blockedScene = run(blockedScene, "h", { kind: "effect", targetId: "e", effect: "negative.испуган" }, "siren2-blocked-fear");
blockedScene = choose(blockedScene, "h", "pull", "siren2-blocked-pull");
assert.equal(blockedScene.actors.find(item => item.id === "e").x, 5);
assert.equal(blockedScene.lionwing.choices.length, 0, "blocked movement does not open a false Daze choice");
const offTurn = fixture({ hero: { knownTechniques: { "disruptor.siren": 2 } }, activeActorId: "e" });
let offTurnScene = run(offTurn, "h", { kind: "automation", ruleId: "disruptor.siren.2", enabled: true }, "siren2-offturn-enable");
offTurnScene = run(offTurnScene, "h", { kind: "effect", targetId: "e", effect: "negative.испуган" }, "siren2-offturn-fear");
assert.equal(offTurnScene.lionwing.choices.length, 0, "off-Turn Fear does not open Siren II");
assert.throws(() => engine.dispatchMany(scene, [event("h", { kind: "forced-towards", targetId: "e", sourceActorId: "h", maximum: 3, ruleId: "disruptor.siren.2", sourceDigest: "forged", causeEventId: "siren2-fear" }, "siren2-forged")]), /Источник|digest|канонич/i, "forged Siren II provenance is rejected");

// Bombardier: all levels are Spirit-only, use canonical digests and derive
// targets/empty cells from the area plan. Level I cannot select an empty
// center, while a forged source or attribute never reaches the roll.
const bombBase = fixture({ hero: { knownTechniques: { "ruiner.bombardier": 2 }, lionwing: { automation: { "ruiner.bombardier.1": true, "ruiner.bombardier.2": true } } }, enemy: { x: 3, y: 2 } });
const bomb = engine.prepare(bombBase, { actorId: "h", eventId: "bomb2-valid", kind: "action", actionId: "action.атаки.завершение", attribute: "spirit", techniqueRuleId: "ruiner.bombardier.2", areaCenter: { space: "main", x: 3, y: 2 }, focusSpent: 2 });
assert.equal(bomb.ok, true, bomb.errors?.join(" "));
assert.equal(bomb.events[0].payload.techniqueSourceDigest, digests["ruiner.bombardier.2"]);
assert.equal(bomb.events[0].payload.emptyTargetCount, 8);
const bomb1 = fixture({ hero: { knownTechniques: { "ruiner.bombardier": 1 }, lionwing: { automation: { "ruiner.bombardier.1": true } } }, enemy: { x: 3, y: 2 } });
const bomb1Prepared = engine.prepare(bomb1, { actorId: "h", eventId: "bomb1-valid", kind: "action", actionId: "action.атаки.завершение", attribute: "spirit", techniqueRuleId: "ruiner.bombardier.1", areaCenter: { space: "main", x: 3, y: 2 }, focusSpent: 0 });
assert.equal(bomb1Prepared.ok, true, bomb1Prepared.errors?.join(" "));
assert.equal(bomb1Prepared.events[0].payload.areaPlan.result.shape, "adjacent");
const bomb3 = fixture({ hero: { knownTechniques: { "ruiner.bombardier": 3 }, focus: 4, lionwing: { automation: { "ruiner.bombardier.3": true } } }, enemy: { x: 3, y: 2 } });
const bomb3Prepared = engine.prepare(bomb3, { actorId: "h", eventId: "bomb3-valid", kind: "action", actionId: "action.атаки.завершение", attribute: "spirit", techniqueRuleId: "ruiner.bombardier.3", areaCenter: { space: "main", x: 3, y: 2 }, focusSpent: 4 });
assert.equal(bomb3Prepared.ok, true, bomb3Prepared.errors?.join(" "));
assert.equal(bomb3Prepared.events[0].payload.areaPlan.result.shape, "square5");
const belowFocus = engine.prepare(bombBase, { actorId: "h", eventId: "bomb2-low-focus", kind: "action", actionId: "action.атаки.завершение", attribute: "spirit", techniqueRuleId: "ruiner.bombardier.2", areaCenter: { space: "main", x: 3, y: 2 }, focusSpent: 1 });
assert.equal(belowFocus.ok, false, "Bombardier II enforces its two-Focus threshold");
const wrongAttribute = engine.prepare(bombBase, { actorId: "h", eventId: "bomb2-body", kind: "action", actionId: "action.атаки.завершение", attribute: "body", techniqueRuleId: "ruiner.bombardier.2", areaCenter: { space: "main", x: 3, y: 2 }, focusSpent: 2 });
assert.equal(wrongAttribute.ok, false, "Bombardier rejects non-Spirit Finishers");
const wrongDigest = engine.prepare(bombBase, { actorId: "h", eventId: "bomb2-forged", kind: "action", actionId: "action.атаки.завершение", attribute: "spirit", techniqueRuleId: "ruiner.bombardier.2", techniqueSourceDigest: "forged", areaCenter: { space: "main", x: 3, y: 2 }, focusSpent: 2 });
assert.equal(wrongDigest.ok, false, "Bombardier rejects a forged source digest");
const emptyCenter = fixture({ hero: { knownTechniques: { "ruiner.bombardier": 1 }, lionwing: { automation: { "ruiner.bombardier.1": true } } } });
const emptyCenterPrepared = engine.prepare(emptyCenter, { actorId: "h", eventId: "bomb1-empty-center", kind: "action", actionId: "action.атаки.завершение", attribute: "spirit", techniqueRuleId: "ruiner.bombardier.1", areaCenter: { space: "main", x: 1, y: 1 }, focusSpent: 0 });
assert.equal(emptyCenterPrepared.ok, false, "Bombardier I requires an enemy target in the selected center");

console.log("LionWing Siren/Bombardier audit: canonical digests, Study→Fear, active-Turn and actual-adjacency guards, blocked/off-Turn negatives, Spirit/center/Focus/source checks, derived empty cells, reload and anti-spoofing passed");
