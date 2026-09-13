import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
const Engine = loadSceneEngine(context);
const data = context.DAWN_DATA;
const ids = data.actions.list.reduce((map, action) => ({ ...map, [action.name]: action.id }), {});

const actor = (id, kind, team, x, y, extra = {}) => ({
  id, kind, name: id, rulesEdition: "lionwing", team, space: "main", x, y,
  hp: 10, maxHp: 10, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0,
  tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 },
  effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, ...extra,
});
const fixture = () => ({
  rulesEdition: "lionwing", version: 7, round: 1, turnSerial: 1, activeActorId: "hero",
  spaces: [{ id: "main", width: 5, height: 5 }, { id: "other", width: 3, height: 3 }],
  actors: [actor("hero", "hero", "hero", 0, 0), actor("enemy", "enemy", "enemy", 1, 0), actor("hidden", "enemy", "enemy", 3, 3, { hidden: true })],
  objects: [
    { id: "mud", type: "terrain", space: "main", cells: ["2,2"], ownerActorId: "hero", hp: 3, maxHp: 3 },
    { id: "rough", type: "difficult", space: "main", cells: ["2,3"], ownerActorId: "hero" },
    { id: "hidden-terrain", type: "terrain", space: "main", cells: ["3,2"], hidden: true },
  ],
  walls: [{ id: "wall", space: "main", a: "2,0", b: "2,1", hp: 4, maxHp: 4 }],
  markers: [{ id: "marker", kind: "token", space: "main", x: 3, y: 3, ownerActorId: "hero" }],
  topology: { cuts: [] }, log: [], rollFeed: [], targetIds: [], targetCells: [],
});
const typed = (kind, fields) => ({ kind, space: "main", ...fields });

let scene = fixture();
assert.equal(typeof Engine.normalizeTypedTarget, "function");
assert.deepEqual(JSON.parse(JSON.stringify(Engine.normalizeTypedTarget(typed("actor", { id: "enemy" })).target)), { kind: "actor", space: "main", id: "enemy" });

for (const target of [
  typed("actor", { id: "enemy" }),
  typed("cell", { cell: { x: 4, y: 4 } }),
  typed("terrain", { id: "mud", owner: "hero" }),
  typed("wall", { id: "wall" }),
  typed("entity", { id: "marker", owner: "hero" }),
]) {
  const status = Engine.typedTargetStatus(scene, target);
  assert.equal(status.available, true, `${target.kind} should resolve from the authoritative Scene`);
  assert.equal(status.normalized.kind, target.kind);
}

assert.equal(Engine.typedTargetStatus(scene, typed("actor", { id: "missing" })).available, false);
assert.equal(Engine.typedTargetStatus(scene, typed("cell", { cell: "5,0" })).reasonCode, "out-of-bounds");
assert.equal(Engine.typedTargetStatus(scene, typed("cell", { cell: "1,0", intent: "placement" })).reasonCode, "occupied-cell");
assert.equal(Engine.typedTargetStatus(scene, typed("terrain", { id: "mud", owner: "enemy" })).reasonCode, "ownership-mismatch");
assert.equal(Engine.typedTargetStatus(scene, typed("wall", { id: "wall", space: "other" })).reasonCode, "space-mismatch");
assert.equal(Engine.typedTargetStatus(scene, typed("entity", { id: "hidden" })).reasonCode, "hidden-entity");
assert.equal(Engine.typedTargetStatus(scene, typed("terrain", { id: "hidden-terrain" })).reasonCode, "hidden-entity");

scene.topology.cuts = [{ id: "cut", space: "main", cells: ["4,4"] }];
assert.equal(Engine.typedTargetStatus(scene, typed("cell", { cell: "4,4" })).reasonCode, "removed-cell");
scene.topology.cuts = [];
scene.objects.push({ id: "broken-terrain", type: "terrain", space: "main", cells: ["99,99"] });
assert.equal(Engine.typedTargetStatus(scene, typed("terrain", { id: "broken-terrain" })).reasonCode, "out-of-bounds");

const forged = Engine.typedTargetStatus(scene, typed("actor", { id: "enemy", snapshot: { x: 4, y: 4 } }));
assert.equal(forged.available, false);
assert.equal(forged.reasonCode, "snapshot-forbidden");
assert.equal(forged.manualFallback, true);
assert.equal(Engine.typedTargetStatus(scene, typed("cell", { cell: { x: 4, y: 4, snapshot: { available: true } } })).reasonCode, "snapshot-forbidden");
assert.equal(Engine.typedTargetStatus(scene, typed("actor", { id: "enemy", owner: "hero" })).reasonCode, "ownership-mismatch");

const oldTarget = Engine.targetStatus(scene, { sourceActorId: "hero", targetIds: ["enemy"], audience: "enemies", range: 2, min: 1, max: 1 });
assert.equal(oldTarget.available, true, "legacy string targetIds remain valid");
const typedTarget = Engine.targetStatus(scene, { sourceActorId: "hero", targets: [typed("actor", { id: "enemy" })], audience: "enemies", range: 2, min: 1, max: 1 });
assert.equal(typedTarget.available, true);
assert.deepEqual(JSON.parse(JSON.stringify(typedTarget.targetIds)), ["enemy"]);
const typedCellTarget = Engine.targetStatus(scene, { sourceActorId: "hero", typedTargets: [typed("cell", { cell: "4,4" })], min: 0, max: 1 });
assert.equal(typedCellTarget.available, true);
assert.deepEqual(JSON.parse(JSON.stringify(typedCellTarget.targetCells)), ["4,4"]);

const shape = Engine.spatialShapeStatus(scene, { typedAnchor: typed("cell", { cell: "2,2" }), shape: "cell" });
assert.equal(shape.available, true);
assert.deepEqual(JSON.parse(JSON.stringify(shape.cells)), ["2,2"]);
assert.equal(Engine.spatialShapeStatus(scene, { typedAnchor: typed("actor", { id: "enemy" }), shape: "cell" }).available, false);
const occupiedPlacement = Engine.effectCellOccupancyStatus(scene, "hero", { destination: typed("cell", { cell: "1,0" }) });
assert.equal(occupiedPlacement.available, false);
const difficultPlacement = Engine.typedTargetStatus(scene, { target: typed("cell", { cell: "2,3" }), intent: "placement" });
assert.equal(difficultPlacement.available, true, "Difficult terrain remains placeable under the existing occupancy rules");
assert.equal(difficultPlacement.blocked, false);
assert.equal(Engine.wallTargetingStatus(scene, "hero", typed("actor", { id: "enemy" })).available, true);

const prepared = Engine.prepareAction(scene, data, {
  actorId: "hero", actionId: ids["Стычка"],
  targets: [typed("actor", { id: "enemy" })],
  roll: { formula: "3D6", attribute: "talent", rolls: [6, 4, 2], successes: 2, crits: 1 },
});
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
assert.deepEqual(JSON.parse(JSON.stringify(prepared.events[0].payload.targetIds)), ["enemy"]);
assert.deepEqual(JSON.parse(JSON.stringify(prepared.events[0].payload.typedTargets)), [{ kind: "actor", space: "main", id: "enemy" }]);

const typedDestination = Engine.prepareAction(scene, data, {
  actorId: "hero", actionId: ids["Шаг"], destination: typed("cell", { cell: "0,1" }),
});
assert.equal(typedDestination.ok, true, typedDestination.errors?.join(" "));
assert.deepEqual(JSON.parse(JSON.stringify(typedDestination.events[0].payload.typedTargets)), [{ kind: "cell", space: "main", cell: "0,1", cells: ["0,1"] }]);
assert.deepEqual(JSON.parse(JSON.stringify(typedDestination.events.find(event => event.type === "actor.move")?.payload?.x)), 0);

const reloaded = JSON.parse(JSON.stringify(scene));
assert.equal(Engine.typedTargetStatus(reloaded, typed("terrain", { id: "mud", owner: "hero" })).available, true);
assert.deepEqual(JSON.parse(JSON.stringify(Engine.typedTargetStatus(reloaded, typed("cell", { cell: "4,4" })).normalized)), { kind: "cell", space: "main", cell: "4,4", cells: ["4,4"] });

const legacyScene = { ...fixture(), rulesEdition: "ru-v0.9", actors: fixture().actors.map(actor => ({ ...actor, rulesEdition: "ru-v0.9" })), lionwing: null };
const legacyTyped = Engine.typedTargetStatus(legacyScene, typed("actor", { id: "enemy" }));
assert.equal(legacyTyped.available, false);
assert.equal(legacyTyped.reasonCode, "unsupported-edition");

console.log("LionWing typed targets: actor/cell/terrain/wall/entity resolution, boundaries, occupancy, reload, legacy compatibility and forged snapshot/ownership checks passed");
