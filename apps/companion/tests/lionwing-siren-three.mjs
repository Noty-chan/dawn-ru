import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;
const sceneEngine = context.window.DAWN_SCENE_ENGINE;
const data = context.window.DAWN_DATA;
const actor = (id, team, x, y, extra = {}) => ({ id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null, rulesEdition: "lionwing", team, space: "main", x, y, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 2, influence: 0, wounds: 0, stress: 0, tier: 2, speed: 2, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {}, ...extra });
const scene = () => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: "s", spaces: [{ id: "main", width: 8, height: 6 }], actors: [actor("s", "hero", 1, 1, { knownTechniques: { "disruptor.siren": 3 }, techniques: { "disruptor.siren": 3 }, lionwing: { automation: { "disruptor.siren.3": true } } }), actor("target", "enemy", 2, 1), actor("far", "enemy", 4, 3, { speed: 4, effects: ["negative.испуган"], effectStates: { "negative.испуган": { sources: [{ sourceId: "fear", actorId: "s" }] } } }), actor("near", "enemy", 2, 2, { effects: ["negative.испуган"], effectStates: { "negative.испуган": { sources: [{ sourceId: "fear2", actorId: "s" }] } } })], objects: [], walls: [], markers: [], topology: { cuts: [] }, log: [], targetIds: [], reminders: [], rollFeed: [] });
const finish = (value, attribute = "spirit") => engine.prepare(value, { actorId: "s", kind: "action", actionId: "action.атаки.завершение", attribute, targetIds: ["target"], focusSpent: 0 }, { random: () => 0.5 });
let current = scene();
let prepared = finish(current);
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
current = sceneEngine.dispatchMany(current, prepared.events).scene;
assert.equal(current.pendingAction?.sourceActionId, "action.атаки.завершение");
current = engine.dispatchMany(current, [{ type: "lionwing.command", actorId: "target", payload: { kind: "reaction", choice: "take" } }]).scene;
current = engine.dispatchMany(current, [{ type: "lionwing.command", actorId: "s", payload: { kind: "resolve-attack", pendingId: current.pendingAction.id } }]).scene;
assert.equal(current.lionwing.choices[0]?.kind, "technique-trigger");
assert.equal(current.lionwing.choices[0]?.context?.actionInstanceId, prepared.events[0].id);
current = engine.dispatchMany(current, [{ type: "lionwing.command", actorId: "s", payload: { kind: "choice", id: current.lionwing.choices[0].id, choice: "call-help" } }]).scene;
assert.equal(current.pendingAction, null);
assert.equal(current.lionwing.movementGroups?.length, 0, "completed group continuation is cleaned up");
assert.equal(current.actors.find(item => item.id === "far").x, 3);
assert.equal(current.actors.find(item => item.id === "far").y, 1);
assert.equal(current.actors.find(item => item.id === "near").y, 2);
assert.equal(current.actors.find(item => item.id === "target").hp, 13, "each adjacent moved enemy deals Siren Tier damage");
assert.ok(current.log.some(row => row.type === "damage.apply" && row.payload?.sourceActionId === "disruptor.siren.3"));

let mind = scene();
prepared = finish(mind, "mind");
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
mind = sceneEngine.dispatchMany(mind, prepared.events).scene;
mind = engine.dispatchMany(mind, [{ type: "lionwing.command", actorId: "target", payload: { kind: "reaction", choice: "take" } }]).scene;
mind = engine.dispatchMany(mind, [{ type: "lionwing.command", actorId: "s", payload: { kind: "resolve-attack", pendingId: mind.pendingAction.id } }]).scene;
assert.equal(mind.lionwing.choices[0]?.kind, "technique-trigger", "Mind Finisher opens Siren III");

let other = scene();
prepared = engine.prepare(other, { actorId: "s", kind: "action", actionId: "action.атаки.стычка", targetIds: ["target"] }, { random: () => 0.5 });
assert.equal(prepared.ok, true);
other = sceneEngine.dispatchMany(other, prepared.events).scene;
other = engine.dispatchMany(other, [{ type: "lionwing.command", actorId: "target", payload: { kind: "reaction", choice: "take" } }]).scene;
other = engine.dispatchMany(other, [{ type: "lionwing.command", actorId: "s", payload: { kind: "resolve-attack", pendingId: other.pendingAction.id } }]).scene;
assert.notEqual(other.lionwing.choices[0]?.context?.ruleId, "disruptor.siren.3", "other attacks do not trigger Siren III");

let cancelled = scene();
prepared = finish(cancelled);
cancelled = sceneEngine.dispatchMany(cancelled, prepared.events).scene;
cancelled = engine.dispatchMany(cancelled, [{ type: "lionwing.command", actorId: "target", payload: { kind: "reaction", choice: "take" } }]).scene;
cancelled = engine.dispatchMany(cancelled, [{ type: "lionwing.command", actorId: "s", payload: { kind: "resolve-attack", pendingId: cancelled.pendingAction.id } }]).scene;
const cancelChoice = cancelled.lionwing.choices[0];
assert.equal(cancelChoice?.options.includes("skip"), true, "Siren III is explicitly optional");
const siren3CauseId = cancelChoice.context.causeEventId;
const siren3ActionInstanceId = cancelChoice.context.actionInstanceId;
cancelled = engine.dispatchMany(cancelled, [{ type: "lionwing.command", actorId: "s", payload: { kind: "choice", id: cancelChoice.id, choice: "skip" } }]).scene;
assert.equal(cancelled.actors.find(item => item.id === "far").x, 4, "cancelling leaves frightened enemies in place");
assert.equal(cancelled.actors.find(item => item.id === "target").hp, 17, "cancelling applies no Siren damage");
assert.throws(() => engine.dispatchMany(structuredClone(cancelled), [{ type: "lionwing.command", actorId: "s", payload: { kind: "forced-towards-group", sourceActorId: "s", targetId: "target", ruleId: "disruptor.siren.3", sourceDigest: "231b63c69615f78497650a97d3a5225a98f298a882d4adb2eedaebdff16c5b7e", actionInstanceId: siren3ActionInstanceId, causeEventId: siren3CauseId, filter: { team: "opposing", effect: "negative.испуган" } } }]), /авторитетн|сохранён|продолж/i, "Siren III rejects a direct replay with the old cause and canonical digest");

assert.throws(() => engine.dispatchMany(scene(), [{ type: "lionwing.command", actorId: "s", payload: { kind: "forced-towards-group", sourceActorId: "s", targetId: "target", ruleId: "disruptor.siren.3", sourceDigest: "231b63c69615f78497650a97d3a5225a98f298a882d4adb2eedaebdff16c5b7e", actionInstanceId: "forged", filter: { team: "opposing", effect: "negative.испуган" }, actorIds: ["far"] } }]), /вычисляется ядром|не связано/);

console.log("Siren III: Spirit/Mind trigger, frightened-only sequential movement, adjacency damage, cancel and non-Finisher isolation passed");
