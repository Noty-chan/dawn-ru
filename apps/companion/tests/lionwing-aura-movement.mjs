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
const Engine = context.window.DAWN_LIONWING_ENGINE;

const actor = (id, x, extra = {}) => ({
  id, name: id, kind: "hero", heroId: id, rulesEdition: "lionwing", team: "hero", space: "main", x, y: 1,
  hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0, tier: 1,
  speed: 5, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 },
  effects: [], effectStates: {}, usedActions: [], acted: false, ...extra,
});
const fixture = () => ({
  rulesEdition: "lionwing", version: 4, round: 1, turnSerial: 1, activeActorId: "target",
  spaces: [{ id: "main", width: 9, height: 5 }],
  actors: [actor("owner", 0, { occupiedWidth: 2, occupiedHeight: 2 }), actor("target", 3, { occupiedWidth: 2 })],
  objects: [], walls: [], markers: [], topology: { cuts: [] }, log: [],
});
const command = (scene, actorId, payload, id) => Engine.dispatchMany(scene, [{ id, type: "lionwing.command", actorId, payload }]);
const createAura = scene => command(scene, "owner", {
  kind: "aura", operation: "create", id: "wide", ownerActorId: "owner", sourceEntityId: "owner",
  ruleId: "test.wide", effectId: "positive.укреплен", shape: { kind: "radius", distance: 1 },
  filter: { relation: "ally" }, lifetime: "scene", removable: true,
}, "create-wide").scene;
const move = (scene, actorId, destination, id, maximum = 1) => {
  const prepared = Engine.prepare(scene, { actorId, eventId: id, kind: "geometry-move", targetId: actorId, destination, maximum });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return Engine.dispatchMany(scene, prepared.events);
};

let scene = createAura(fixture());
assert.equal(Engine.auraStatus(scene, scene.lionwing.auras[0], scene.actors[1]).active, false);
let entered = move(scene, "target", { space: "main", x: 2, y: 1 }, "enter-wide");
const enterEvents = entered.events.filter(event => event.type === "aura.enter" && event.payload.targetId === "target");
assert.equal(enterEvents.length, 1, "one segment emits one aura entry");
assert.equal(enterEvents[0].actorId, "target");
assert.equal(enterEvents[0].payload.auraId, "wide");
assert.equal(enterEvents[0].payload.effectId, "positive.укреплен");
assert.equal(entered.events.findIndex(event => event.type === "geometry.segment.enter"), entered.events.findIndex(event => event.type === "aura.enter") - 1, "entry follows the authoritative segment-enter boundary");
assert.equal(Engine.auraStatus(entered.scene, entered.scene.lionwing.auras[0], entered.scene.actors[1]).active, true, "large bodies use their nearest occupied cells");
assert.equal(entered.scene.lionwing.history.filter(fact => fact.type === "aura.enter" && fact.actorId === "target").length, 1, "the transition is available to later technique conditions through history");

const reloaded = JSON.parse(JSON.stringify(entered.scene));
let exited = move(reloaded, "target", { space: "main", x: 3, y: 1 }, "exit-wide");
assert.equal(exited.events.filter(event => event.type === "aura.exit" && event.payload.targetId === "target").length, 1);
assert.equal(Engine.auraStatus(exited.scene, exited.scene.lionwing.auras[0], exited.scene.actors[1]).active, false);
assert.deepEqual(Engine.dispatchMany(exited.scene, Engine.prepare(reloaded, { actorId: "target", eventId: "exit-wide", kind: "geometry-move", targetId: "target", destination: { space: "main", x: 3, y: 1 }, maximum: 1 }).events).scene.actors, exited.scene.actors, "replaying the movement does not emit or apply a second transition");

scene = createAura(fixture());
scene.activeActorId = "owner";
const sourceMoved = move(scene, "owner", { space: "main", x: 1, y: 1 }, "source-step");
assert.equal(sourceMoved.events.filter(event => event.type === "aura.enter" && event.payload.targetId === "target").length, 1, "moving an aura source detects entries for other actors");

scene = createAura(fixture());
scene = command(scene, "owner", { kind: "aura", operation: "suppress", id: "wide", suppressionId: "test.silence" }, "suppress-wide").scene;
const suppressedMove = move(scene, "target", { space: "main", x: 2, y: 1 }, "suppressed-step");
assert.equal(suppressedMove.events.some(event => event.type === "aura.enter" || event.type === "aura.exit"), false, "suppressed auras do not produce spatial transitions");

console.log("LionWing aura movement: segmented enter/exit, source movement, large bodies, suppression, reload and replay passed");
