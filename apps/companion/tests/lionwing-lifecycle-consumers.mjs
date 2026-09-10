import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;

const actor = (id, x, knownTechniques = {}, team = "hero") => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  ownerId: id, rulesEdition: "lionwing", team, space: "main", x, y: 1,
  hp: 10, maxHp: 12, ap: 0, baseAp: 3, focus: 0, influence: 0, wounds: 0,
  stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false, knownTechniques, techniques: knownTechniques,
  lionwing: { automation: Object.fromEntries(Object.entries(knownTechniques).flatMap(([id, level]) => Array.from({ length: level }, (_, i) => [`${id}.${i + 1}`, true]))) },
});
const fixture = actors => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0,
  tension: 0, activeActorId: null, spaces: [{ id: "main", width: 8, height: 5 }], actors,
  objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [] });
const run = (scene, actorId, payload, id) => engine.dispatchMany(scene, [{ ...engine.command(actorId, payload), id }]).scene;

// Canonical scene-start resources are composed by the same scheduler. These
// consumers exercise a replacement resource, an ordinary Focus grant and an
// inventory configuration in one real turn-start transition.
let scene = fixture([
  actor("bastard", 1, { "bulwark.absolute-bastard": 1 }),
  actor("gunslinger", 3, { "powerhouse.gunslinger": 1 }),
  actor("gourmand", 5, { "altruist.gourmand": 1 }),
]);
scene = run(scene, "bastard", { kind: "turn-start" }, "consumers-start");
assert.equal(scene.actors.find(item => item.id === "bastard").focus, 5, "Absolute Bastard adds three Focus at Scene start");
const bullets = scene.actors.find(item => item.id === "gunslinger");
assert.equal(bullets.ruleResources.bullets.value, 6, "Gunslinger starts with six Bullets");
const meals = scene.actors.find(item => item.id === "gourmand").lionwing.inventory.records["altruist.gourmand.meals"];
assert.equal(meals.current, 1, "Gourmand receives Mind/2 meals at Scene start");
assert.equal(scene.lionwing.boundaryReceipts.filter(row => row.boundary === "sceneStart").length, 3);

// A resource configured at Scene start can be refreshed at Round start and
// reset at Round end without relying on a client flag or a second engine.
let mundane = fixture([actor("mundane", 1, { "bulwark.mundane": 1 })]);
mundane = run(mundane, "mundane", { kind: "turn-start" }, "mundane-start");
const mundaneActor = () => mundane.actors[0];
assert.equal(mundaneActor().ruleResources.tenacity.value, 4);
mundane = run(mundane, "mundane", { kind: "turn-end" }, "mundane-end");
mundane = run(mundane, null, { kind: "round-end" }, "mundane-round");
assert.equal(mundaneActor().ruleResources.tenacity.value, 4, "Round end restores the configured Tenacity baseline");
assert.equal(mundane.lionwing.boundaryReceipts.filter(row => row.ruleId === "bulwark.mundane.1" && row.boundary === "roundStart").length, 1);

// Empath is an any-Turn consumer: the same owner can react once to each
// adjacent ally Turn, including consecutive extra Turns. The receipts use
// activeTurnInstanceId for this scope, so the first reaction cannot suppress
// the next extra Turn.
let empath = fixture([
  actor("empath", 1, { "altruist.empath": 3 }),
  actor("ally", 2),
]);
empath = run(empath, "empath", { kind: "turn-start" }, "empath-own-start");
empath = run(empath, "empath", { kind: "grant-turn", targetId: "ally", amount: 2 }, "empath-grant");
empath = run(empath, "empath", { kind: "turn-end" }, "empath-own-end");
empath = run(empath, "ally", { kind: "turn-start" }, "ally-extra-one");
empath = run(empath, "ally", { kind: "turn-end" }, "ally-extra-one-end");
empath = run(empath, "ally", { kind: "turn-start" }, "ally-extra-two");
const empathReceipts = empath.lionwing.boundaryReceipts.filter(row => row.ruleId === "altruist.empath.3");
assert.equal(empathReceipts.length, 2, "Empath reacts to both extra ally Turns");
assert.equal(JSON.stringify(empathReceipts.map(row => row.boundary)), JSON.stringify(["anyTurnStart", "anyTurnStart"]));
assert.equal(empath.actors.find(item => item.id === "ally").focus, 8, "Each any-Turn reaction applies its Focus gain once");

// Scene reset advances the Scene identity and clears boundary receipts, so
// Scene-start grants are eligible again after reload/reset.
const reset = run(scene, null, { kind: "scene-reset" }, "consumers-reset");
assert.equal(reset.lionwing.sceneSerial, 2);
assert.equal(reset.lionwing.boundaryReceipts.length, 0, "Scene reset clears private boundary receipts");

console.log("LionWing lifecycle consumers: Scene/Round resources, inventory start, any-Turn extra Turns and Scene reset passed");
