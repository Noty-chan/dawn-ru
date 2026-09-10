import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;
const ids = context.window.DAWN_SCENE_ENGINE.ACTION_IDS;
const actor = (id, team, x, y, extra = {}) => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x, y, hp: 20, maxHp: 20, ap: 3, baseAp: 3,
  focus: 3, influence: 0, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 4, talent: 3, spirit: 3, mind: 2 }, effects: [], effectStates: {}, usedActions: [],
  acted: false, knockedOut: false, lionwing: { automation: {
    "powerhouse.breacher.1": true, "powerhouse.breacher.2": true, "powerhouse.breacher.3": true,
  } }, knownTechniques: { "powerhouse.breacher": 3 }, ...extra,
});
const fixture = (targetX = 2) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "hero", tension: 0,
  spaces: [{ id: "main", name: "Поле", mode: "standard", width: 8, height: 6 }],
  actors: [actor("hero", "hero", 1, 1), actor("enemy", "enemy", targetX, 1), actor("ally", "hero", 3, 2)],
  objects: [], walls: [], markers: [], areas: [], log: [], targetIds: [], targetCells: [], reminders: [], rollFeed: [],
  lionwing: { entities: {}, entityReceipts: {}, sceneSerial: 1 },
});
const run = (scene, actorId, payload, id, options = {}) => {
  const prepared = engine.prepare(scene, { ...payload, actorId, eventId: id }, options);
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return engine.dispatchMany(scene, prepared.events, options).scene;
};
const resolve = (scene, targetIds, prefix) => {
  for (const targetId of targetIds) scene = run(scene, targetId, { kind: "reaction", choice: "take" }, `${prefix}:reaction:${targetId}`);
  return run(scene, "hero", { kind: "resolve-attack" }, `${prefix}:resolve`);
};

let scene = fixture(5);
scene = run(scene, "hero", { kind: "action", actionId: ids.skirmish, targetIds: ["enemy"], attribute: "body", breacherBuckShot: true }, "buck-range", { random: () => 0.5 });
assert.equal(scene.pendingAction.targetIds.length, 1, "Buck Shot is a single selected target");
assert.equal(scene.actors.find(item => item.id === "enemy").x, 5, "Buck Shot permits range four from the attacker");

scene = fixture(2);
scene.actors.find(item => item.id === "hero").knownTechniques["powerhouse.breacher"] = 2;
scene.actors.find(item => item.id === "hero").lionwing.automation["powerhouse.breacher.3"] = false;
scene = run(scene, "hero", { kind: "action", actionId: ids.skirmish, targetIds: ["enemy"], attribute: "body", breacherBuckShot: true, breacherBothBarrels: true }, "both-barrels", { random: () => 0.5 });
assert.equal(scene.pendingAction.breacherPushMultiplier, 2);
scene = resolve(scene, ["enemy"], "both-barrels");
assert.equal(scene.actors.find(item => item.id === "enemy").x, 4, "Both Barrels doubles the existing push");
assert.ok(scene.actors.find(item => item.id === "hero").effects.includes("negative.ослаблен"), "Both Barrels weakens after the attack resolves");

scene = fixture(3);
scene.actors.find(item => item.id === "hero").effects = ["negative.ослаблен"];
scene.actors.find(item => item.id === "hero").effectStates["negative.ослаблен"] = { present: true, sources: [{ sourceId: "old", actorId: "scene" }] };
const blocked = engine.prepare(scene, { kind: "action", actionId: ids.skirmish, actorId: "hero", eventId: "blocked", targetIds: ["enemy"], attribute: "body", breacherBothBarrels: true }, { random: () => 0.5 });
assert.equal(blocked.ok, false);
assert.match(blocked.errors.join(" "), /Ослаблен/);

scene = fixture(2);
scene = run(scene, "hero", { kind: "action", actionId: ids.skirmish, targetIds: ["enemy"], attribute: "body", breacherBuckShot: true, breacherBothBarrels: true }, "cancel-both", { random: () => 0.5 });
scene = run(scene, "hero", { kind: "cancel-attack" }, "cancel-both:cancel");
assert.equal(scene.pendingAction, null, "Both Barrels cancellation clears the pending attack");
assert.equal(scene.actors.find(item => item.id === "enemy").x, 2, "Both Barrels cancellation does not push");
assert.ok(!scene.actors.find(item => item.id === "hero").effects.includes("negative.ослаблен"), "Both Barrels cancellation does not weaken");

const forgedPush = engine.prepare(fixture(2), {
  kind: "breacher-push", actorId: "hero", sourceActorId: "hero", targetId: "enemy",
  ruleId: "powerhouse.breacher.1", sourceDigest: "forged", initialDistance: 1, maximum: 1, eventId: "forged-push",
});
assert.equal(forgedPush.ok, false, "forged Breacher push provenance is rejected");

scene = fixture(4);
scene = run(scene, "hero", { kind: "action", actionId: ids.finish, targetIds: ["enemy"], attribute: "body" }, "annihilate-range", { random: () => 0.5 });
assert.equal(scene.pendingAction.targetIds.length, 1, "Annihilate keeps one ordinary target when Both Barrels is not chosen");
assert.equal(scene.pendingAction.targetIds[0], "enemy");

scene = fixture(2);
scene = run(scene, "hero", { kind: "action", actionId: ids.skirmish, targetIds: ["enemy"], attribute: "body", breacherBothBarrels: true, areaCenter: { space: "main", x: 2, y: 1 } }, "skirmish-area", { random: () => 0.5 });
assert.deepEqual([...scene.pendingAction.targetIds].sort(), ["ally", "enemy"], "Breacher III expands a Skirmish with Both Barrels to the 2x2 zone");
assert.equal(scene.pendingAction.areaPlan.request.targetAudience, "all");

scene = fixture(2);
scene = run(scene, "hero", { kind: "action", actionId: ids.finish, targetIds: ["enemy"], attribute: "body", breacherBothBarrels: true, areaCenter: { space: "main", x: 2, y: 1 } }, "annihilate", { random: () => 0.5 });
assert.deepEqual([...scene.pendingAction.targetIds].sort(), ["ally", "enemy"], "Annihilate targets all characters in the selected 2x2 zone");
assert.equal(scene.pendingAction.areaPlan.request.shape, "square2");
scene = resolve(scene, ["enemy", "ally"], "annihilate");
assert.ok(scene.log.some(event => event.type === "effect.apply" && event.payload.effect === "negative.ослаблен" && event.payload.targetId === "hero"), "Annihilate inherits Both Barrels self-weakening");

console.log("LionWing Breacher I–III contracts passed");
