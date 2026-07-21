import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
vm.runInNewContext(fs.readFileSync(new URL("../scene-engine.js", import.meta.url), "utf8"), context);
const Engine = context.DAWN_SCENE_ENGINE;
const data = context.DAWN_DATA;
const scene = {
  version: 0, round: 1, tension: 2,
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [
    { id: "hero", name: "Эта", team: "hero", space: "main", x: 1, y: 1, ap: 3, baseAp: 3, focus: 50, hp: 12, attrs: { body: 3, talent: 4, spirit: 4, mind: 2 } },
    { id: "enemy", name: "Ассасин", team: "enemy", space: "main", x: 2, y: 1, ap: 2, baseAp: 2, focus: 2, hp: 10, armor: 1 },
  ], log: [], rollFeed: [],
};

const actions = Engine.availableActions(scene, data, "hero");
assert.equal(actions.length, 15);
assert.equal(actions.find(action => action.name === "Стычка").available, true);

const rest = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actions.find(action => action.name === "Передышка").id });
assert.equal(rest.ok, true);
const rested = Engine.dispatchMany(scene, rest.events, { makeId: (() => { let id = 0; return () => `event-${++id}`; })() }).scene;
assert.equal(rested.actors[0].ap, 2);
assert.equal(rested.actors[0].focus, 51, "Focus gain must remain unbounded");

const attack = Engine.prepareAction(scene, data, {
  actorId: "hero", actionId: actions.find(action => action.name === "Стычка").id, targetIds: ["enemy"],
  roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(attack.ok, true);
assert.deepEqual(Array.from(attack.events, event => event.type), ["action.prepare", "resource.spend", "reaction.offer", "roll.public", "damage.apply", "action.resolve"]);
const attacked = Engine.dispatchMany(scene, attack.events).scene;
assert.equal(attacked.actors[0].ap, 2);
assert.equal(attacked.actors[1].hp, 9, "Armor reduces damage before HP");
assert.equal(attacked.rollFeed[0].successes, 2);
assert.equal(attacked.version, 6);

const moved = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actions.find(action => action.name === "Шаг").id, destination: { x: 3, y: 1 } });
assert.equal(moved.ok, true);
assert.equal(Engine.dispatchMany(scene, moved.events).scene.actors[0].x, 3);

console.log("Scene engine QA passed: public events, actions, damage, movement, unbounded Focus");
