import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE, meter = context.window.DAWN_LIONWING_COMBAT_METER;
const hero = { id: "h", name: "Hero", kind: "hero", team: "hero", rulesEdition: "lionwing", heroId: "h", space: "main", x: 1, y: 1, hp: 10, maxHp: 10, ap: 3, baseAp: 3, focus: 2, influence: 1, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, knockedOut: false };
const scene = { rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }], actors: [hero], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [] };
const command = (payload, id) => ({ id, type: "lionwing.command", actorId: "h", payload });

assert.equal(meter.read(scene, "tension").current, 0);
assert.equal(scene.lionwing, undefined, "read is side-effect free");
const cyclicScene = { ...scene };
cyclicScene.self = cyclicScene;
assert.equal(meter.read(cyclicScene, "tension").current, 0, "read does not clone the entire battlefield");
const normalized = engine.reload(scene);
const initial = meter.read(normalized);
assert.deepEqual(JSON.parse(JSON.stringify({ owner: initial.owner, source: initial.source, scope: initial.scope, lifetime: initial.lifetime, min: initial.min, max: initial.max, current: initial.current })), {
  owner: { kind: "scene", id: "scene" }, source: { kind: "engine", id: "lionwing-engine" }, scope: "scene", lifetime: "scene", min: 0, max: 999, current: 0,
});

// Reader consumer: quotes are derived and cannot write the scene.
const quote = meter.quote(normalized, "tension", { operation: "add", delta: 2 });
assert.equal(quote.value, 2);
assert.equal(normalized.tension, 0);

// Writer consumer: every change goes through the engine command and receipt.
let result = engine.dispatchMany(normalized, [command({ kind: "combat-meter", id: "tension", operation: "add", delta: 2 }, "meter-add")]);
assert.equal(result.scene.tension, 2);
assert.equal(meter.read(result.scene).receipts.includes("meter-add:combat-meter"), true);

// Reactive consumer: a typed change row is emitted for subscribers.
assert.equal(result.events.filter(event => event.type === "combat-meter.change").length, 1);
const beforeInvalid = JSON.stringify(result.scene);
assert.throws(() => engine.dispatchMany(result.scene, [command({ kind: "combat-meter", id: "tension", operation: "set", value: 1000 }, "too-high")]), /значение|максимум/i);
assert.equal(JSON.stringify(result.scene), beforeInvalid, "invalid meter updates are atomic");
result = engine.dispatchMany(result.scene, [command({ kind: "combat-meter", id: "tension", operation: "add", delta: 1 }, "meter-add-2")]);
assert.equal(result.scene.tension, 3);
const replay = engine.dispatchMany(result.scene, [command({ kind: "combat-meter", id: "tension", operation: "add", delta: 1 }, "meter-add-2")]);
assert.equal(replay.events.length, 0, "duplicate command receipt is idempotent");
assert.equal(replay.scene.tension, 3);

console.log("LionWing combat meter: typed metadata, read-only quote, engine-only writes, atomic bounds and idempotent receipts passed");
