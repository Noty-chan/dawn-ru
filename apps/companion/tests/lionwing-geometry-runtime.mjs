import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);

const runtime = context.window.DAWN_LIONWING_GEOMETRY_RUNTIME;
const actor = (id, x, y, extra = {}) => ({
  id, name: id, kind: "hero", heroId: id, rulesEdition: "lionwing", team: "hero", space: "main", x, y,
  hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0, tier: 1,
  speed: 5, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {},
  usedActions: [], acted: false, ...extra,
});
const fixture = () => ({
  rulesEdition: "lionwing", version: 10, round: 1, turnSerial: 1, activeActorId: "source",
  spaces: [{ id: "main", width: 8, height: 5 }, { id: "other", width: 6, height: 5 }],
  actors: [actor("source", 0, 0), actor("mover", 1, 1)], objects: [], walls: [], markers: [],
  topology: { cuts: [] }, log: [], lionwing: {},
});
const clone = value => JSON.parse(JSON.stringify(value));
// The production reducer owns this small state transition. The harness only
// projects the typed commit event so the runtime test can check the common
// journal/receipt boundary without introducing a second runtime reducer.
const applyCommit = (scene, committed) => {
  const next = clone(scene), destination = committed.result.stoppedAt;
  const target = next.actors.find(item => item.id === committed.plan.targetId);
  target.space = destination.space; target.x = destination.x; target.y = destination.y;
  next.version = committed.after.sceneVersion;
  next.log = [committed.journal, ...(next.log || [])];
  return next;
};
const applyUndo = (scene, undoEvent) => {
  const next = clone(scene);
  for (const saved of undoEvent.after.actors) {
    const target = next.actors.find(item => item.id === saved.id);
    target.space = saved.space; target.x = saved.x; target.y = saved.y;
  }
  next.version = undoEvent.after.sceneVersion;
  next.log = [{ id: `${undoEvent.id}:journal`, type: undoEvent.type, payload: undoEvent.payload }, ...(next.log || [])];
  return next;
};

let scene = fixture();
const placement = runtime.prepare(scene, { id: "placement-1", operation: "placement", sourceActorId: "source", targetId: "mover", destination: { space: "main", x: 3, y: 2 } });
assert.equal(placement.ok, true, placement.errors?.join(" "));
assert.deepEqual([scene.actors[1].x, scene.actors[1].y], [1, 1], "prepare is read-only");
assert.equal(placement.plan.result.path.length, 0, "placement has no movement trace");
const placementCommit = runtime.commit(scene, placement);
assert.equal(placementCommit.ok, true);
assert.equal(placementCommit.scene, undefined, "the geometry runtime does not own mutable Scene state");
const placed = applyCommit(scene, placementCommit);
assert.deepEqual([placed.actors[1].x, placed.actors[1].y], [3, 2]);
assert.equal(placed.log[0].type, "geometry.placement.commit");
assert.equal(placementCommit.journal.payload.operation, "placement");
assert.equal(typeof placementCommit.fingerprint, "string", "the common receipt store can use the typed fingerprint");

const reloadedPlacement = runtime.reload(JSON.parse(JSON.stringify(placement.plan)));
assert.equal(reloadedPlacement.kind, runtime.kind);
assert.deepEqual(runtime.preview(scene, reloadedPlacement).preview, placement.preview);

scene = fixture();
const teleport = runtime.prepare(scene, { id: "teleport-1", operation: "teleport", sourceActorId: "source", targetId: "mover", destination: { space: "other", x: 2, y: 2 } });
assert.equal(teleport.ok, true, teleport.errors?.join(" "));
assert.equal(teleport.plan.result.teleported, true);
assert.equal(teleport.plan.result.path.length, 0, "teleport does not expose intermediate cells");
const teleportCommit = runtime.commit(scene, teleport);
const teleported = applyCommit(scene, teleportCommit);
assert.deepEqual([teleported.actors[1].space, teleported.actors[1].x, teleported.actors[1].y], ["other", 2, 2]);

scene = fixture();
scene.walls.push({ id: "wall", space: "main", a: "3,1", b: "4,1" });
const displacement = runtime.prepare(scene, { id: "push-1", operation: "displacement", sourceActorId: "source", targetId: "mover", mode: "directed", direction: "east", maximum: 4 });
assert.equal(displacement.ok, true, displacement.errors?.join(" "));
assert.deepEqual(JSON.parse(JSON.stringify(displacement.plan.result.stoppedAt)), { space: "main", x: 3, y: 1 });
assert.equal(displacement.plan.result.terminal, true);
assert.match(displacement.plan.result.stopReason, /стен/i);
const displacementCommit = runtime.commit(scene, displacement);
const pushed = applyCommit(scene, displacementCommit);
assert.deepEqual([pushed.actors[1].x, pushed.actors[1].y], [3, 1]);
assert.equal(pushed.log[0].type, "geometry.displacement.commit");

const stale = clone(displacement.plan);
const staleScene = clone(scene);
staleScene.objects.push({ id: "mud", type: "terrain", space: "main", cells: ["2,1"] });
assert.equal(runtime.preview(staleScene, stale).ok, false, "geometry changes invalidate a prepared operation");
assert.throws(() => runtime.commit(staleScene, stale), /устар|непроходим|занят/i);

const beforeUndoCommit = runtime.commit(fixture(), placement);
const undoEvent = beforeUndoCommit.event;
const beforeUndo = applyCommit(fixture(), beforeUndoCommit);
const undone = runtime.undo(beforeUndo, JSON.parse(JSON.stringify(undoEvent)));
const undoneScene = applyUndo(beforeUndo, undone.event);
assert.deepEqual([undoneScene.actors[1].x, undoneScene.actors[1].y], [1, 1]);
assert.equal(undone.undone, true);
assert.throws(() => runtime.undo(undoneScene, undoEvent), /устар|измен/i);

const replayed = runtime.replay(fixture(), JSON.parse(JSON.stringify(undoEvent)));
assert.deepEqual(JSON.parse(JSON.stringify(replayed.after.actors.find(item => item.id === "mover"))), { id: "mover", space: "main", x: 3, y: 2, width: 1, height: 1, knockedOut: false, compoundId: null });
assert.equal(replayed.replayed, true);

console.log("LionWing geometry runtime: typed placement, teleport, displacement, strict recheck, journal, reload/replay and undo passed");
