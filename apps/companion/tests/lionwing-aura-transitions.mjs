import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../lionwing-aura-transitions.js", import.meta.url), "utf8"), context);
const Aura = context.window.DAWN_LIONWING_AURA_TRANSITIONS;

const actor = (id, x, y, extra = {}) => ({ id, space: "main", x, y, team: "hero", ...extra });
const aura = { id: "wide", ownerActorId: "owner", sourceEntityId: "owner", ruleId: "test.wide", effectId: "positive.укреплен", shape: { kind: "radius", distance: 1 } };
const scene = {
  actors: [actor("owner", 0, 0, { occupiedWidth: 2, occupiedHeight: 2 }), actor("target", 2, 1, { occupiedWidth: 2 })],
  markers: [],
  lionwing: { auras: [aura] },
};

assert.equal(Aura.footprintDistance(scene.actors[0], scene.actors[1]), 1, "distance is measured between the nearest occupied cells");
assert.equal(Aura.coverage(scene, aura, scene.actors[1]).active, true, "a large source covers a large target at its nearest edge");

const status = (value, definition, target) => Aura.coverage(value, definition, target);
const before = Aura.capture(scene, status);
const moved = JSON.parse(JSON.stringify(scene));
moved.actors.find(item => item.id === "target").x = 4;
const exited = Aura.diff(before, Aura.capture(moved, status));
assert.deepEqual(JSON.parse(JSON.stringify(exited)), [{
  operation: "exit", auraId: "wide", targetId: "target", ownerActorId: "owner", sourceEntityId: "owner",
  ruleId: "test.wide", effectId: "positive.укреплен", position: { space: "main", x: 2, y: 1 },
}]);

const sourceMoved = JSON.parse(JSON.stringify(moved));
sourceMoved.actors.find(item => item.id === "owner").x = 2;
const entered = Aura.diff(Aura.capture(moved, status), Aura.capture(sourceMoved, status));
assert.equal(entered.some(item => item.operation === "enter" && item.targetId === "target"), true, "moving the source produces target transitions too");

const otherSpace = { ...moved.actors[1], space: "other" };
assert.equal(Aura.coverage(moved, aura, otherSpace).active, false);
assert.equal(Aura.coverage(moved, aura, otherSpace).distance, Infinity);

console.log("LionWing aura transitions: large bodies, target/source movement and deterministic enter/exit passed");
