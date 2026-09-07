import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
const engine = loadSceneEngine(context), sceneEngine = context.window.DAWN_SCENE_ENGINE || engine, lw = context.window.DAWN_LIONWING_ENGINE;
let serial = 0;
const actor = (id, team = "hero") => ({ id, name: id, kind: team === "hero" ? "hero" : "enemy", rulesEdition: "lionwing", team, heroId: team === "hero" ? id : null, space: "main", x: team === "hero" ? 1 : 4, y: 1, hp: 10, maxHp: 10, ap: 3, baseAp: 3, focus: 2, influence: 1, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false });
const fixture = () => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor("h"), actor("e", "enemy")], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [] });
const event = (actorId, payload, id = `counter-${++serial}`) => ({ ...lw.command(actorId, payload), id });
const run = (scene, actorId, payload, id) => lw.dispatchMany(scene, [event(actorId, payload, id)]).scene;
const count = (scene, type) => scene.log.filter(row => row.type === type).length;

let scene = fixture();
scene = run(scene, "h", { kind: "clock", id: "doom", label: "Предел", size: 4, current: 0, initial: 0, scope: "scene", lifetime: "scene", sourceEntityId: "main", ruleId: "test.counter" }, "create-doom");
const definition = scene.actors[0].ruleClocks.doom;
assert.equal(definition.id, "doom");
assert.equal(definition.kind, "clock");
assert.equal(definition.ownerActorId, "h");
assert.equal(definition.sourceActorId, "h");
assert.equal(definition.sourceEntityId, "main");
assert.equal(definition.ruleId, "test.counter");
assert.deepEqual({ min: definition.min, max: definition.max, current: definition.current, initial: definition.initial }, { min: 0, max: 4, current: 0, initial: 0 });

scene = run(scene, "h", { kind: "counter", type: "clock", operation: "add", id: "doom", delta: 4 }, "reach-doom");
assert.equal(count(scene, "counter.threshold"), 1, "the first crossing emits one threshold event");
assert.equal(scene.lionwing.history.filter(fact => fact.type === "counter.threshold").length, 1, "the crossing is also one history fact");
const replay = lw.dispatchMany(scene, [event("h", { kind: "counter", type: "clock", operation: "add", id: "doom", delta: 4 }, "reach-doom")]);
assert.equal(replay.events.length, 0, "a duplicate event id is acknowledged without replaying the command");
assert.equal(count(replay.scene, "counter.threshold"), 1);
scene = run(scene, "h", { kind: "counter", type: "clock", operation: "set", id: "doom", current: 4 }, "same-cap");
assert.equal(count(scene, "counter.threshold"), 1, "setting the already-full value does not repeat the threshold");
scene = run(scene, "h", { kind: "counter", type: "clock", operation: "reset", id: "doom" }, "reset-doom");
scene = run(scene, "h", { kind: "counter", type: "clock", operation: "set", id: "doom", current: 2 }, "below-doom");
scene = run(scene, "h", { kind: "counter", type: "clock", operation: "add", id: "doom", delta: 2 }, "reach-again");
assert.equal(count(scene, "counter.threshold"), 2, "resetting or falling below the threshold arms the next crossing");

const invalidBefore = JSON.stringify(scene);
assert.throws(() => run(scene, "h", { kind: "counter", type: "clock", operation: "set", id: "doom", current: 5 }, "invalid-bounds"), /значение|максимум/i);
assert.equal(JSON.stringify(scene), invalidBefore, "invalid bounds are atomic");
const renamed = run(scene, "h", { kind: "counter", type: "clock", operation: "rename", id: "doom", name: "Новый предел" }, "rename-doom");
assert.equal(renamed.actors[0].ruleClocks.doom.id, "doom");
assert.equal(renamed.actors[0].ruleClocks.doom.name, "Новый предел");
const reloaded = JSON.parse(JSON.stringify(renamed));
assert.equal(JSON.stringify(reloaded.actors[0].ruleClocks.doom), JSON.stringify(renamed.actors[0].ruleClocks.doom), "JSON reload preserves counter metadata");

const appContext = { console, crypto: { randomUUID: () => "normalized-id" }, APP_SCHEMA: 14, contentPreferences: { edition: "ru-v0.9" }, uid: () => "normalized-id", clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)), cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [] };
vm.createContext(appContext);
const appSource = fs.readFileSync(new URL("../app-core.js", import.meta.url), "utf8");
vm.runInContext(appSource.slice(appSource.indexOf("function blankScene()"), appSource.indexOf("function normalizeScene(raw)")), appContext, { filename: "app-core.scene-normalizer.js" });
const normalized = vm.runInContext(`sceneCore(${JSON.stringify(renamed)})`, appContext);
assert.equal(normalized.actors[0].ruleClocks.doom.ownerActorId, "h", "storage normalization keeps the owner");
assert.equal(normalized.actors[0].ruleClocks.doom.current, 4, "storage normalization keeps the current value");
const undoSnapshot = JSON.parse(JSON.stringify(normalized)), undoRestored = vm.runInContext(`sceneCore(${JSON.stringify(undoSnapshot)})`, appContext);
assert.equal(undoRestored.actors[0].ruleClocks.doom.id, "doom", "undo snapshots keep the stable id");
assert.equal(undoRestored.actors[0].ruleClocks.doom.ruleId, "test.counter", "undo snapshots keep rule metadata");

vm.runInContext(fs.readFileSync(new URL("../network-v2.js", import.meta.url), "utf8"), context);
assert.throws(() => context.window.DAWN_NETWORK_V2.materializeIntent(renamed, context.window.DAWN_DATA, { kind: "lionwing", actorId: "e", request: { kind: "counter", type: "clock", operation: "set", id: "doom", current: 1 } }, "player"), /Нарратору|владеет|LionWing/i, "a player cannot forge a foreign counter command");

let sceneClock = fixture();
sceneClock = sceneEngine.dispatchMany(sceneClock, [{ id: "scene-create", type: "session-clock.create", payload: { id: "scene-clock", name: "Угроза", kind: "danger", size: 4, initial: 0, ownerActorId: null, scope: "scene", lifetime: "scene", ruleId: "scene.rule" } }]).scene;
sceneClock = sceneEngine.dispatchMany(sceneClock, [{ id: "scene-add", type: "session-clock.add", actorId: null, payload: { id: "scene-clock", delta: 4 } }]).scene;
assert.equal(sceneClock.sessionClocks[0].ownerActorId, null, "Scene counters are explicitly Scene-owned");
assert.equal(sceneClock.sessionClocks[0].current, 4);
assert.equal(count(sceneClock, "counter.threshold"), 1, "Narrator Scene path emits one threshold event");
sceneClock = sceneEngine.dispatchMany(sceneClock, [{ id: "scene-reset", type: "session-clock.reset", payload: { id: "scene-clock" } }]).scene;
sceneClock = sceneEngine.dispatchMany(sceneClock, [{ id: "scene-add-again", type: "session-clock.add", payload: { id: "scene-clock", delta: 4 } }]).scene;
assert.equal(count(sceneClock, "counter.threshold"), 2, "Scene reset arms a later threshold crossing");

console.log("LionWing counters: strict metadata, atomic bounds, one-shot thresholds, replay, reset, reload, undo storage, ownership and Scene path passed");
