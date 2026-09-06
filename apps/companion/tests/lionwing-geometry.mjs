import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const geometry = context.window.DAWN_LIONWING_GEOMETRY;

const actor = (id, x, y, extra = {}) => ({ id, name: id, kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x, y, hp: 10, maxHp: 10, speed: 4, effects: [], effectStates: {}, ...extra });
const fixture = () => ({ rulesEdition: "lionwing", version: 7, spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor("author", 0, 0), actor("mover", 1, 1), actor("body", 4, 4, { team: "enemy", occupiedWidth: 2, occupiedHeight: 2 })], markers: [{ id: "flame", space: "main", x: 5, y: 5, ownerActorId: "author", duration: "scene" }], objects: [], walls: [], topology: { cuts: [{ id: "cut", space: "main", cells: ["2,2"], crossing: "blocked" }] } });
const unchanged = (scene, callback) => { const before = JSON.stringify(scene); const value = callback(); assert.equal(JSON.stringify(scene), before, "geometry queries must not mutate Scene"); return value; };

let scene = fixture();
let status = unchanged(scene, () => geometry.anchorStatus(scene, { sourceActorId: "author", anchor: { kind: "marker", markerId: "flame" } }));
assert.deepEqual(JSON.parse(JSON.stringify(status.anchor)), { kind: "marker", id: "flame", space: "main", x: 5, y: 5 });
assert.equal(status.sourceActorId, "author", "author remains independent from the marker anchor");
assert.equal(geometry.anchorStatus(scene, { sourceActorId: "author", anchor: { kind: "cell", space: "main", x: 2, y: 2 } }).available, false, "a removed cell cannot be an anchor");

status = unchanged(scene, () => geometry.footprintStatus(scene, { actorId: "mover", destination: { space: "main", x: 0, y: 4 }, width: 2, height: 2 }));
assert.equal(status.available, true); assert.equal(status.cells.length, 4);
assert.equal(geometry.footprintStatus(scene, { actorId: "mover", destination: { space: "main", x: 6, y: 6 }, width: 2, height: 2 }).available, false, "a 2x2 body cannot exceed field bounds");
assert.equal(geometry.footprintStatus(scene, { actorId: "mover", destination: { space: "main", x: 3, y: 3 }, width: 2, height: 2 }).available, false, "a body cannot overlap another body");
assert.equal(geometry.footprintStatus(scene, { actorId: "mover", destination: { space: "main", x: 2, y: 2 } }).available, false, "a body cannot occupy a removed cell");

status = unchanged(scene, () => geometry.nearestCandidates(scene, { sourceActorId: "author", anchor: { kind: "marker", markerId: "flame" }, actorId: "mover", candidates: [{ x: 5, y: 6 }, { x: 6, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 5 }] }));
assert.deepEqual(JSON.parse(JSON.stringify(status.candidates.map(candidate => [candidate.x, candidate.y]))), [[6, 5], [5, 6], [3, 5]], "nearest candidates use stable distance, y, x order, reject occupied cells and remove duplicates");

scene = fixture(); scene.walls.push({ id: "wall", space: "main", a: "2,1", b: "3,1" });
let route = unchanged(scene, () => geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "marker", markerId: "flame" }, destination: { x: 4, y: 1 }, maximum: 6 }));
assert.equal(route.available, true, route.reason); assert.ok(route.route.path.some(point => point.y !== 1), "route delegates wall handling to movementPath");
assert.ok(!route.route.path.some(point => point.x === 2 && point.y === 2), "route delegates removed-cell handling to SceneEngine");

scene = fixture();
route = geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "actor", actorId: "author" }, destination: { x: 6, y: 1 }, maximum: 2, allowPartial: true });
assert.equal(route.available, true, route.reason); assert.equal(route.route.partial, true); assert.deepEqual(JSON.parse(JSON.stringify(route.route.stoppedAt)), { space: "main", x: 3, y: 1 }); assert.equal(route.route.remaining, 0);
const reloaded = JSON.parse(JSON.stringify(route.plan));
assert.equal(geometry.revalidatePlan(scene, reloaded).available, true, "JSON-reloaded plans revalidate unchanged geometry");
scene.version += 1;
assert.deepEqual(JSON.parse(JSON.stringify(geometry.revalidatePlan(scene, reloaded))), { available: false, stale: true, reason: "Геометрический план устарел." }, "a Scene version conflict invalidates the saved plan");

scene = fixture(); scene.objects.push({ id: "mud", type: "difficult", space: "main", cells: ["2,1"] });
route = geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "actor", actorId: "author" }, destination: { x: 3, y: 1 }, maximum: 3 });
assert.equal(route.available, true, route.reason); assert.equal(route.route.path.length, 2); assert.equal(route.route.spent, 3, "route spending uses LionWing's weighted Difficult Terrain cost"); assert.equal(route.route.remaining, 0);
assert.equal(geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "actor", actorId: "author" }, destination: { x: 3, y: 1 }, maximum: 2 }).available, false, "weighted cost is enforced as the movement budget");

scene = fixture(); scene.actors.find(item => item.id === "mover").occupiedWidth = 2; scene.actors.find(item => item.id === "mover").occupiedHeight = 2; scene.actors.find(item => item.id === "body").x = 5;
scene.walls.push({ id: "lower-edge", space: "main", a: "2,2", b: "3,2" });
assert.equal(geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "actor", actorId: "author" }, destination: { x: 2, y: 1 }, maximum: 1 }).available, false, "every leading edge of a large body must clear Walls");
assert.equal(geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "actor", actorId: "author" }, destination: { x: 1, y: 1 }, maximum: 0, width: 0 }).available, false, "a zero-length route still validates body dimensions");

scene = fixture();
route = geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "actor", actorId: "author" }, destination: { x: 3, y: 1 }, maximum: 3 });
const invalidTargetPlan = JSON.parse(JSON.stringify(route.plan));
scene.actors.find(item => item.id === "mover").knockedOut = true;
const invalidTarget = geometry.revalidatePlan(scene, invalidTargetPlan);
assert.equal(invalidTarget.available, false, "revalidation rejects a mover that became an invalid target"); assert.match(invalidTarget.reason, /выведен/, "revalidation reports the invalid target instead of masking it as generic staleness");

scene = fixture();
route = geometry.routePlan(scene, { sourceActorId: "author", actorId: "mover", anchor: { kind: "marker", markerId: "flame" }, destination: { x: 3, y: 1 }, maximum: 3 });
const geometryChanged = JSON.parse(JSON.stringify(route.plan));
scene.markers[0].x = 4;
assert.deepEqual(JSON.parse(JSON.stringify(geometry.revalidatePlan(scene, geometryChanged))), { available: false, stale: true, reason: "Геометрический план устарел." }, "geometry changes invalidate a saved plan even before a version bump");

console.log("LionWing geometry: anchors, footprints, weighted routes, large-body edges, partial stops, serialization and revalidation passed");
