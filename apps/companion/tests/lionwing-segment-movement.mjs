import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const lw = context.window.DAWN_LIONWING_ENGINE;

const actor = (id, x, y, extra = {}) => ({ id, name: id, kind: "hero", heroId: id, rulesEdition: "lionwing", team: "hero", space: "main", x, y, hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0, tier: 1, speed: 5, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {}, usedActions: [], acted: false, ...extra });
const fixture = () => ({ rulesEdition: "lionwing", version: 4, round: 1, turnSerial: 1, activeActorId: "source", spaces: [{ id: "main", width: 8, height: 5 }], actors: [actor("source", 0, 0), actor("mover", 1, 1)], objects: [], walls: [], markers: [], topology: { cuts: [] }, log: [] });
const prepareMove = (scene, extra = {}) => {
  const request = { kind: "geometry-move", targetId: "mover", destination: { space: "main", x: 4, y: 1 }, maximum: 3, ...extra };
  const prepared = lw.prepare(scene, { actorId: "source", ...request });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return prepared.events;
};
const commit = (scene, events) => lw.dispatchMany(scene, events).scene;

// A three-cell route updates the actor one edge at a time and exposes all four
// typed boundary windows. The middle-cell decision leaves only the final edge.
let scene = fixture();
const events = prepareMove(scene, { segmentChoices: [{ id: "middle", segmentIndex: 1, title: "Средняя клетка", options: ["continue", "stop"] }] });
let paused = commit(scene, events);
assert.deepEqual([paused.actors[1].x, paused.actors[1].y], [3, 1], "the route pauses at the middle cell instead of teleporting");
assert.equal(paused.lionwing.choices.length, 1);
assert.equal(paused.lionwing.choices[0].kind, "geometry-boundary");
assert.equal(paused.lionwing.geometryCursor.segmentIndex, 2);
assert.equal(paused.lionwing.geometryCursor.expectedSceneVersion, paused.version, "the continuation expects the version after its own segment");
assert.equal(paused.lionwing.deferred.length, 1, "the remainder is persisted as a serializable operation");
assert.deepEqual([...new Set(paused.log.filter(row => row.type.startsWith("geometry.segment.")).map(row => row.type))].sort(), ["geometry.segment.before-enter", "geometry.segment.before-leave", "geometry.segment.enter", "geometry.segment.leave"].sort());
assert.equal(paused.log.filter(row => row.type === "actor.move" && !row.payload.geometrySummary).length, 2);

const reloaded = JSON.parse(JSON.stringify(paused));
const response = lw.prepare(reloaded, { actorId: "source", kind: "choice", id: reloaded.lionwing.choices[0].id, choice: "continue" });
assert.equal(response.ok, true, response.errors?.join(" "));
const completed = commit(reloaded, response.events);
assert.deepEqual([completed.actors[1].x, completed.actors[1].y], [4, 1], "the saved remainder continues exactly once after reload");
assert.equal(completed.lionwing.choices.length, 0);
assert.equal(completed.lionwing.deferred.length, 0);
assert.equal(completed.lionwing.geometryCursor, undefined);
assert.equal(completed.log.filter(row => row.type === "actor.move" && !row.payload.geometrySummary).length, 3);
assert.deepEqual(JSON.parse(JSON.stringify(completed.log.filter(row => row.type === "actor.move" && !row.payload.geometrySummary).map(row => row.payload.path.length))), [1, 1, 1]);
assert.deepEqual(JSON.parse(JSON.stringify(completed.log.find(row => row.type === "geometry.route.commit").payload.stoppedAt)), { space: "main", x: 4, y: 1 });

// Replaying the same response ID is a receipt lookup and cannot move the last
// segment a second time.
const duplicate = commit(completed, response.events);
assert.deepEqual(duplicate.actors.find(item => item.id === "mover"), completed.actors.find(item => item.id === "mover"));

scene = fixture();
paused = commit(scene, prepareMove(scene, { segmentChoices: [{ id: "middle", segmentIndex: 1, options: ["continue", "stop"] }] }));
const stopResponse = lw.prepare(paused, { actorId: "source", kind: "choice", id: paused.lionwing.choices[0].id, choice: "stop" });
assert.equal(stopResponse.ok, true, stopResponse.errors?.join(" "));
const stopped = commit(paused, stopResponse.events);
assert.deepEqual([stopped.actors[1].x, stopped.actors[1].y], [3, 1]);
assert.equal(stopped.log.find(row => row.type === "geometry.route.commit").payload.stopReason, "decision");
assert.equal(stopped.log.find(row => row.type === "geometry.route.commit").payload.terminal, true);

// A pre-segment geometryPlan remains valid and is upgraded only in the checked
// copy used for execution.
scene = fixture();
const legacyEvents = prepareMove(scene);
const legacyPlan = JSON.parse(JSON.stringify(legacyEvents[0].payload.geometryPlan));
for (const key of ["origin", "width", "height", "segments", "cursor"]) delete legacyPlan.route[key];
legacyEvents[0].payload.geometryPlan = legacyPlan;
const legacyCompleted = commit(scene, legacyEvents);
assert.deepEqual([legacyCompleted.actors[1].x, legacyCompleted.actors[1].y], [4, 1]);

// A new wall created while waiting is checked at the next edge and rejects the
// response atomically before the mover crosses it.
scene = fixture();
paused = commit(scene, prepareMove(scene, { segmentChoices: [{ id: "middle", segmentIndex: 1, options: ["continue", "stop"] }] }));
const blocked = JSON.parse(JSON.stringify(paused));
blocked.walls.push({ id: "new-wall", space: "main", a: "3,1", b: "4,1" });
blocked.version += 1;
const blockedResponse = lw.prepare(blocked, { actorId: "source", kind: "choice", id: blocked.lionwing.choices[0].id, choice: "continue" });
assert.equal(blockedResponse.ok, false, "the next edge is rechecked after an external geometry change");
assert.match(blockedResponse.errors.join(" "), /путь|стен|сегмент|допустим/i);
assert.deepEqual([blocked.actors[1].x, blocked.actors[1].y], [3, 1]);
const blockedBeforeDispatch = JSON.stringify(blocked);
assert.throws(() => lw.dispatchMany(blocked, [{ type: "lionwing.command", id: "blocked-response", actorId: "source", payload: { kind: "choice", id: blocked.lionwing.choices[0].id, choice: "continue" } }]), /путь|стен|сегмент|допустим/i, "a rejected continuation is atomic");
assert.equal(JSON.stringify(blocked), blockedBeforeDispatch, "a failed continuation leaves its source Scene unchanged");

// Occupancy is handled by the same next-edge check.
scene = fixture();
paused = commit(scene, prepareMove(scene, { segmentChoices: [{ id: "middle", segmentIndex: 1, options: ["continue", "stop"] }] }));
const occupied = JSON.parse(JSON.stringify(paused));
occupied.actors.push(actor("blocker", 4, 1, { team: "enemy", kind: "enemy", heroId: null }));
occupied.version += 1;
const occupiedResponse = lw.prepare(occupied, { actorId: "source", kind: "choice", id: occupied.lionwing.choices[0].id, choice: "continue" });
assert.equal(occupiedResponse.ok, false, "an occupied next cell stops the saved remainder");
assert.match(occupiedResponse.errors.join(" "), /занят|маршрут|сегмент|допустим/i);
assert.deepEqual([occupied.actors[1].x, occupied.actors[1].y], [3, 1]);

// A cell that becomes Difficult Terrain while the route is paused remains
// enterable, but the fresh edge check must promote it to a terminal stop.
scene = fixture();
paused = commit(scene, prepareMove(scene, { segmentChoices: [{ id: "middle", segmentIndex: 1, options: ["continue", "stop"] }] }));
const newlyDifficult = JSON.parse(JSON.stringify(paused));
newlyDifficult.objects.push({ id: "new-mud", type: "difficult", space: "main", cells: ["4,1"] });
newlyDifficult.version += 1;
const difficultResponse = lw.prepare(newlyDifficult, { actorId: "source", kind: "choice", id: newlyDifficult.lionwing.choices[0].id, choice: "continue" });
assert.equal(difficultResponse.ok, true, difficultResponse.errors?.join(" "));
const difficultStop = commit(newlyDifficult, difficultResponse.events);
assert.deepEqual([difficultStop.actors[1].x, difficultStop.actors[1].y], [4, 1]);
const difficultCommit = difficultStop.log.find(row => row.type === "geometry.route.commit");
assert.equal(difficultCommit.payload.terminal, true, "fresh Difficult Terrain terminates the saved route");
assert.equal(difficultCommit.payload.stopReason, "difficult-terrain");
assert.equal(difficultCommit.payload.remaining, 0);

// Difficult Terrain is a terminal route result and consumes the remainder.
scene = fixture();
scene.objects.push({ id: "mud", type: "difficult", space: "main", cells: ["2,1"] });
const terminal = commit(scene, prepareMove(scene, { allowPartial: true, straight: true }));
assert.deepEqual([terminal.actors[1].x, terminal.actors[1].y], [2, 1]);
const terminalCommit = terminal.log.find(row => row.type === "geometry.route.commit");
assert.equal(terminalCommit.payload.terminal, true);
assert.equal(terminalCommit.payload.stopReason, "difficult-terrain");
assert.equal(terminalCommit.payload.remaining, 0);

// A snapshot taken while the route is paused is plain JSON, so undo restores
// both the paused coordinates and the exact continuation cursor.
const undoSnapshot = { id: "paused-route", label: "До ответа", state: JSON.parse(JSON.stringify(paused)) };
const restored = JSON.parse(JSON.stringify(undoSnapshot.state));
assert.deepEqual([restored.actors[1].x, restored.actors[1].y], [3, 1]);
assert.equal(restored.lionwing.geometryCursor.segmentIndex, 2);
assert.equal(restored.lionwing.deferred.length, 1);

console.log("LionWing segmented movement: boundaries, reload, one-shot continuation, external blockers, terminal terrain and undo snapshot passed");
