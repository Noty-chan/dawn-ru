import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const Engine = context.window.DAWN_LIONWING_ENGINE, Geometry = context.window.DAWN_LIONWING_GEOMETRY, Adapters = context.window.DAWN_LIONWING_ADAPTERS;
const actor = (id, x, y, extra = {}) => ({ id, name: id, kind: "hero", heroId: id, rulesEdition: "lionwing", team: "hero", space: "main", x, y, hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0, tier: 1, speed: 5, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {}, usedActions: [], acted: false, ...extra });
const fixture = () => ({ rulesEdition: "lionwing", version: 4, round: 1, turnSerial: 1, activeActorId: "source", spaces: [{ id: "main", width: 8, height: 5 }], actors: [actor("source", 0, 0), actor("mover", 1, 1), actor("enemy", 6, 1, { team: "enemy", kind: "enemy", heroId: null })], objects: [], walls: [], markers: [], topology: { cuts: [] }, log: [] });
const run = (scene, request) => {
  const prepared = Engine.prepare(scene, { actorId: "source", kind: "geometry-move", targetId: "mover", destination: { space: "main", x: 4, y: 1 }, maximum: 3, ...request });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return Engine.dispatchMany(scene, prepared.events).scene;
};

let scene = run(fixture(), {});
const facts = Geometry.movementFacts(scene, { actorId: "mover" });
assert.equal(facts.available, true);
assert.equal(facts.mode, "move");
assert.equal(facts.distance, 3);
assert.equal(facts.firstMovementThisTurn, true);
assert.deepEqual(JSON.parse(JSON.stringify(facts.path)), [{ space: "main", x: 2, y: 1 }, { space: "main", x: 3, y: 1 }, { space: "main", x: 4, y: 1 }]);
assert.equal(Geometry.movementCondition(scene, { actorId: "mover", condition: "crossed", point: { space: "main", x: 3, y: 1 } }).available, true);
assert.equal(Geometry.movementCondition(scene, { actorId: "mover", condition: "ended-adjacent", point: { space: "main", x: 5, y: 1 } }).available, true);
assert.equal(Geometry.movementCondition(scene, { actorId: "mover", condition: "moved-at-least", distance: 4 }).available, false);
assert.equal(Adapters.movementCondition(scene, { actorId: "mover", condition: "crossed", point: { space: "main", x: 3, y: 1 } }).available, true, "technique adapters receive the same journal-backed facts");
assert.deepEqual(JSON.parse(JSON.stringify(scene.log.filter(row => row.type.startsWith("movement.")).map(row => row.type).reverse())), ["movement.prepare", "movement.start", "movement.leave", "movement.segment", "movement.enter", "movement.cross", "movement.leave", "movement.segment", "movement.enter", "movement.cross", "movement.leave", "movement.segment", "movement.enter", "movement.cross", "movement.end"], "a normal route exposes every lifecycle boundary in a stable order");

const reloaded = JSON.parse(JSON.stringify(scene));
assert.deepEqual(JSON.parse(JSON.stringify(Geometry.movementFacts(reloaded, { actorId: "mover" }))), JSON.parse(JSON.stringify(facts)), "facts are JSON reload-safe");

scene = run(fixture(), { mode: "forced", forced: true });
const forced = Geometry.movementFacts(scene, { actorId: "mover" });
assert.equal(forced.forced, true);
assert.equal(Geometry.movementCondition(scene, { actorId: "mover", condition: "forced" }).available, true);
assert.equal(Geometry.movementCondition(scene, { actorId: "mover", condition: "mode", mode: "forced" }).available, true);

scene = fixture();
scene.objects.push({ id: "mud", type: "difficult", space: "main", cells: ["2,1"] });
scene = run(scene, { destination: { space: "main", x: 2, y: 1 }, maximum: 1, straight: true });
const stopped = Geometry.movementFacts(scene, { actorId: "mover" });
assert.equal(stopped.stopped, true);
assert.equal(stopped.stopReason, "difficult-terrain");
assert.equal(stopped.distance, 1);

const operation = Geometry.movementOperation(fixture(), { sourceActorId: "source", actorId: "mover", destination: { x: 3, y: 1 }, maximum: 2, mode: "move", techniqueRuleId: "test.movement", sourceDigest: "test-digest" });
assert.equal(operation.ok, true);
assert.equal(operation.operation.geometryPlan.route.path.length, 2);
assert.equal(Geometry.movementOperation(fixture(), { sourceActorId: "source", actorId: "mover", destination: { x: 7, y: 1 }, maximum: 1, mode: "move" }).ok, false, "factory cannot forge an unreachable endpoint");

console.log("LionWing movement lifecycle: authoritative facts, hooks, forced routes, stop reasons, reload and checked operation factory passed");
