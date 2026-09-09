import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const Engine = context.window.DAWN_LIONWING_ENGINE;

const actor = (id, x, extra = {}) => ({
  id, name: id, kind: "hero", heroId: id, rulesEdition: "lionwing", team: "hero", space: "main", x, y: 1,
  hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0, tier: 1,
  speed: 5, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 },
  effects: [], effectStates: {}, usedActions: [], acted: false, ...extra,
});
const fixture = () => ({
  rulesEdition: "lionwing", version: 7, round: 1, turnSerial: 1, activeActorId: "source",
  spaces: [{ id: "main", width: 9, height: 5 }, { id: "other", width: 6, height: 5 }],
  actors: [actor("source", 0), actor("mover", 1)], objects: [], walls: [],
  markers: [{ id: "aura-cell", kind: "mark", space: "main", x: 2, y: 1 }], topology: { cuts: [] }, log: [],
});
const prepare = (scene, kind, extra, id) => {
  const result = Engine.prepare(scene, { actorId: "source", eventId: id, kind, targetId: "mover", ...extra });
  assert.equal(result.ok, true, result.errors?.join(" "));
  assert.equal(result.events[0].payload.kind, kind);
  assert.equal(result.events[0].payload.geometryRuntime.operation, kind);
  return result.events;
};

let scene = fixture();
let events = prepare(scene, "placement", { destination: { space: "main", x: 3, y: 2 } }, "place-engine");
let result = Engine.dispatchMany(scene, events);
assert.deepEqual([result.scene.actors[1].space, result.scene.actors[1].x, result.scene.actors[1].y], ["main", 3, 2]);
assert.equal(result.events.filter(event => event.type === "geometry.placement.commit").length, 1);
assert.equal(result.events.some(event => event.type === "actor.move"), false, "placement does not create an ordinary movement trail");
const placed = result.scene;
assert.deepEqual(Engine.dispatchMany(placed, events).scene, placed, "the shared command receipt makes placement idempotent");

scene = fixture();
scene = Engine.dispatchMany(scene, [{ id: "aura", type: "lionwing.command", actorId: "source", payload: {
  kind: "aura", operation: "create", id: "cell-aura", ownerActorId: "source", sourceEntityId: "aura-cell",
  ruleId: "test.cell", effectId: "positive.укреплен", shape: { kind: "radius", distance: 0 }, filter: { relation: "ally" }, lifetime: "scene", removable: true,
} }]).scene;
events = prepare(scene, "displacement", { mode: "directed", direction: "east", maximum: 3 }, "push-engine");
result = Engine.dispatchMany(scene, events);
assert.deepEqual([result.scene.actors[1].x, result.scene.actors[1].y], [4, 1]);
assert.equal(result.events.filter(event => event.type === "geometry.segment.enter").length, 3, "forced movement keeps per-cell boundaries");
assert.equal(result.events.filter(event => event.type === "aura.enter" && event.payload.targetId === "mover").length, 1);
assert.equal(result.events.filter(event => event.type === "aura.exit" && event.payload.targetId === "mover").length, 1);
assert.equal(result.events.filter(event => event.type === "geometry.displacement.commit").length, 1);

scene = fixture();
events = prepare(scene, "displacement", { mode: "directed", direction: "east", maximum: 3, segmentChoices: [{ id: "stop-after-one", segmentIndex: 0, options: ["continue", "stop"] }] }, "paused-push");
let paused = Engine.dispatchMany(scene, events).scene;
assert.deepEqual([paused.actors[1].x, paused.actors[1].y], [2, 1]);
assert.equal(paused.lionwing.choices[0]?.kind, "geometry-boundary");
paused = JSON.parse(JSON.stringify(paused));
const stop = Engine.prepare(paused, { actorId: "source", kind: "choice", id: paused.lionwing.choices[0].id, choice: "stop" });
assert.equal(stop.ok, true, stop.errors?.join(" "));
const stopped = Engine.dispatchMany(paused, stop.events);
const stoppedCommit = stopped.events.find(event => event.type === "geometry.displacement.commit");
assert.ok(stoppedCommit, "a stopped continuation retains the typed displacement commit");
assert.equal(stoppedCommit.payload.stopReason, "decision");
assert.equal(stopped.scene.lionwing.deferred.length, 0);

scene = fixture();
events = prepare(scene, "teleport", { destination: { space: "other", x: 2, y: 2 } }, "teleport-engine");
result = Engine.dispatchMany(scene, events);
assert.deepEqual([result.scene.actors[1].space, result.scene.actors[1].x, result.scene.actors[1].y], ["other", 2, 2]);
assert.equal(result.events.some(event => event.type === "actor.move"), false, "teleport has no traversed path");
assert.equal(result.events.filter(event => event.type === "geometry.teleport.commit").length, 1);

scene = fixture();
events = prepare(scene, "placement", { destination: { space: "main", x: 3, y: 2 } }, "stale-place");
const stale = JSON.parse(JSON.stringify(scene));
stale.version += 1;
stale.actors.push(actor("blocker", 3, { y: 2, team: "enemy", kind: "enemy", heroId: null }));
const before = JSON.stringify(stale);
assert.throws(() => Engine.dispatchMany(stale, events), /устар|занят|измен/i);
assert.equal(JSON.stringify(stale), before, "a rejected spatial plan is atomic");

console.log("LionWing spatial engine: placement, teleport, segmented displacement, aura transitions, journal, replay and stale rejection passed");
