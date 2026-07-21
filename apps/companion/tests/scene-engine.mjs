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

assert.throws(() => Engine.dispatch(scene, { type: "turn.end", actorId: "hero" }, { expectedVersion: 9 }), error => error.code === "SCENE_VERSION_CONFLICT");
const stableEvent = { id: "same-event", type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1 } };
const once = Engine.dispatch(scene, stableEvent).scene;
const twice = Engine.dispatch(once, stableEvent);
assert.equal(twice.duplicate, true);
assert.equal(twice.scene.actors[0].focus, 51, "Duplicate events are idempotent");
assert.throws(() => Engine.dispatch(scene, { type: "resource.gain", actorId: "hero", payload: { resource: "admin", amount: 9999 } }), /ресурса/);
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 99, y: 99 } }), /клетка/);
assert.throws(() => Engine.dispatch(scene, { type: "scene.replace", payload: { state: {} } }), /Неизвестный тип/);

const privateScene = structuredClone(scene);
privateScene.actors[0].privateNotes = "Тайна игрока";
privateScene.actors[1].hidden = true;
privateScene.markers = [{ id: "secret", kind: "hidden", hidden: true }];
privateScene.log = [{ id: "gm-only", visibility: "gm", type: "gm.note", payload: {} }, { id: "public", type: "roll.public", payload: {} }];
const playerProjection = Engine.projectScene(privateScene, { role: "player", actorIds: ["hero"] });
assert.equal(playerProjection.actors.length, 1);
assert.equal(playerProjection.actors[0].privateNotes, "Тайна игрока");
assert.equal(playerProjection.markers.length, 0);
assert.equal(playerProjection.log.length, 1);

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
assert.deepEqual(Array.from(attack.events, event => event.type), ["action.prepare", "resource.spend", "reaction.offer", "attack.pending"]);
const awaiting = Engine.dispatchMany(scene, attack.events).scene;
assert.equal(awaiting.actors[1].hp, 10, "Damage waits for every Reaction response");
assert.equal(awaiting.pendingAction.responses.enemy.choice, "pending");
const passed = Engine.respondReaction(awaiting, data, { actorId: "enemy", choice: "pass" });
const answered = Engine.dispatchMany(awaiting, passed.events).scene;
const resolution = Engine.resolvePendingAction(answered, data);
assert.equal(resolution.ok, true);
const attacked = Engine.dispatchMany(answered, resolution.events).scene;
assert.equal(attacked.actors[0].ap, 2);
assert.equal(attacked.actors[1].hp, 9, "Armor reduces damage, but an Attack still deals at least 1");
assert.equal(attacked.rollFeed[0].successes, 2);
assert.equal(attacked.pendingAction, null);

const dodgingScene = structuredClone(scene);
dodgingScene.actors[1].attrs = { body: 2, talent: 4, spirit: 1, mind: 2 };
const awaitingDodge = Engine.dispatchMany(dodgingScene, attack.events).scene;
const dodge = Engine.respondReaction(awaitingDodge, data, { actorId: "enemy", choice: "Уворот", destination: { x: 3, y: 1 } });
assert.equal(dodge.ok, true);
const afterDodge = Engine.dispatchMany(awaitingDodge, dodge.events).scene;
assert.equal(afterDodge.actors[1].focus, 0);
assert.equal(afterDodge.actors[1].x, 3);
const dodged = Engine.dispatchMany(afterDodge, Engine.resolvePendingAction(afterDodge, data).events).scene;
assert.equal(dodged.actors[1].hp, 10, "Temporary Evasion absorbs post-Armor damage");

const moved = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actions.find(action => action.name === "Шаг").id, destination: { x: 3, y: 1 } });
assert.equal(moved.ok, true);
assert.equal(Engine.dispatchMany(scene, moved.events).scene.actors[0].x, 3);

const woundedScene = structuredClone(scene);
woundedScene.actors[0].hp = 1;
woundedScene.actors[0].guts = 4;
woundedScene.actors[0].wounds = 0;
const wounded = Engine.dispatch(woundedScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 5, ignoreArmor: true } }).scene;
assert.equal(wounded.actors[0].wounds, 1);
assert.equal(wounded.actors[0].hp, 4);
assert.equal(wounded.actors[0].influence, 1);

const lifecycleScene = structuredClone(scene);
lifecycleScene.objects = [{ id: "gas", type: "gas", duration: "nextTurn", ownerActorId: "hero", space: "main", cells: ["2,1"] }];
const entered = Engine.dispatch(lifecycleScene, { type: "actor.enter", actorId: "enemy", payload: {} }).scene;
assert.ok(entered.actors[1].effects.includes("Ослаблен"));
const nextTurn = Engine.dispatch(entered, { type: "turn.start", actorId: "hero", payload: {} }).scene;
assert.equal(nextTurn.objects.length, 0);
const nextRound = Engine.dispatch(nextTurn, { type: "round.end", payload: {} }).scene;
assert.equal(nextRound.round, 2);
assert.equal(nextRound.tension, 3);

const knockedOut = Engine.dispatch(scene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 20, ignoreArmor: true } }).scene;
assert.equal(knockedOut.actors[1].knockedOut, true);
assert.equal(knockedOut.tension, 3);
assert.ok(Engine.availableActions(knockedOut, data, "enemy").every(action => !action.available));

console.log("Scene engine QA passed: public events, actions, damage, movement, unbounded Focus");
