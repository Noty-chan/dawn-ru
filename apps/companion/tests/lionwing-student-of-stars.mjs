import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context), lionwing = context.window.DAWN_LIONWING_ENGINE, adapters = context.window.DAWN_LIONWING_ADAPTERS;
vm.runInContext(fs.readFileSync(new URL("../technique-foundation-map.js", import.meta.url), "utf8"), context, { filename: "technique-foundation-map.js" });
vm.runInContext(fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8"), context, { filename: "technique-engine.js" });
const techniqueEngine = context.window.DAWN_TECHNIQUE_ENGINE;
const ids = engine.ACTION_IDS;
assert.equal(techniqueEngine.techniqueCoverage(context.window.DAWN_LIONWING_DATA, { "ruiner.student-of-stars": 3 }).find(entry => entry.id === "ruiner.student-of-stars.3")?.automation, "decision", "Moment Of Truth is exposed through the trusted Duel entry choice");
const hero = (extra = {}) => ({ id: "hero", name: "Star Student", kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x: 2, y: 2, hp: 12, maxHp: 12, ap: 3, baseAp: 3, focus: 8, influence: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: { "ruiner.student-of-stars": 2 }, techniques: { "ruiner.student-of-stars": 2 }, lionwing: { automation: { "ruiner.student-of-stars.1": true, "ruiner.student-of-stars.2-line": true, "ruiner.student-of-stars.2-zone": true }, history: [] }, ...extra });
const foe = (extra = {}) => ({ id: "foe", name: "Foe", kind: "enemy", rulesEdition: "lionwing", team: "enemy", space: "main", x: 4, y: 2, hp: 12, maxHp: 12, ap: 0, baseAp: 0, focus: 0, influence: 0, tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {}, ...extra });
const scene = (actor, extra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 2, activeActorId: actor.id, lionwing: { activeTurnInstanceId: "turn:1" }, spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor, foe()], objects: [], walls: [], markers: [], log: [], targetIds: [], ...extra });

let a = hero();
let s = scene(a, { actors: [a, foe({ x: 3, y: 2 })] });
const finish = { scene: s, actionId: ids.finish, targetIds: ["foe"], baseCost: 2, baseResource: "ap" };
let quote = adapters.actionQuote(a, finish);
assert.equal(quote.cost, 2, "without an authoritative Charge the Finisher keeps its base cost");
assert.equal(quote.studentPowerUnleashed, undefined);
a.lionwing.history.push({ actionId: ids.charge, ownerTurnInstanceId: "turn:1", turnSerial: 1, round: 1 });
quote = adapters.actionQuote(a, finish);
assert.equal(quote.cost, 1);
assert.equal(quote.focusCap, 6, "the Focus cap comes from the typed meter and is 3×Tension");
assert.equal(quote.studentPowerUnleashed, true);
quote = adapters.actionQuote(a, { ...finish, tension: 99, studentPowerUnleashed: true });
assert.equal(quote.focusCap, 6, "client tension and flags cannot enlarge the quote");

let prepared = lionwing.prepare(s, { actorId: a.id, kind: "action", actionId: ids.finish, targetIds: ["foe"], focusSpent: 6 }, { random: () => 0.6 });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
let committed = lionwing.dispatchMany(s, prepared.events);
assert.ok(committed.scene, "the prepared Power Unleashed action commits through the engine");
assert.equal(committed.scene.actors.find(x => x.id === a.id).focus, 2, "the engine alone spends the quoted Focus");
assert.equal(committed.scene.log.find(event => event.type === "action.resolve")?.payload.techniqueRuleId, "ruiner.student-of-stars.1");
const reloaded = lionwing.reload(JSON.parse(JSON.stringify(s)));
const reloadedCommit = lionwing.dispatchMany(reloaded, prepared.events);
assert.equal(reloadedCommit.scene.actors.find(x => x.id === a.id).focus, 2, "the action survives JSON reload before execution");
const replay = lionwing.dispatchMany(committed.scene, prepared.events);
assert.equal(replay.scene.version, committed.scene.version, "replaying the same action is idempotent");

a = hero({ focus: 8 });
s = scene(a);
prepared = lionwing.prepare(s, { actorId: a.id, kind: "action", actionId: ids.finish, targetIds: ["hero"], techniqueRuleId: "ruiner.student-of-stars.2-line", areaCenter: { space: "main", x: 3, y: 2 }, studentArea: { shape: "line", orientation: "horizontal" }, focusSpent: 1 }, { random: () => 0.6 });
assert.equal(prepared.ok, false, "an area cannot be claimed without the Charge -> Finisher history");
a.lionwing.history.push({ actionId: ids.charge, ownerTurnInstanceId: "turn:1", turnSerial: 1, round: 1 });
prepared = lionwing.prepare(s, { actorId: a.id, kind: "action", actionId: ids.finish, targetIds: ["foe"], techniqueRuleId: "ruiner.student-of-stars.2-line", areaCenter: { space: "main", x: 3, y: 2 }, studentArea: { shape: "line", orientation: "horizontal" }, focusSpent: 1 }, { random: () => 0.6 });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
const plan = prepared.events[0].payload.areaPlan;
assert.equal(plan.request.ruleId, "ruiner.student-of-stars.2-line");
assert.equal(plan.request.shape, "line");
assert.deepEqual(Array.from(plan.result.targetIds), ["foe"], "targets are derived from the verified line");
s.actors.find(x => x.id === "foe").x = 4;
const zonePrepared = lionwing.prepare(s, { actorId: a.id, kind: "action", actionId: ids.finish, targetIds: ["hero"], techniqueRuleId: "ruiner.student-of-stars.2-zone", areaCenter: { space: "main", x: 3, y: 2 }, studentArea: { shape: "square2" }, focusSpent: 1 }, { random: () => 0.6 });
assert.equal(zonePrepared.ok, true, zonePrepared.errors?.join(" "));
assert.equal(zonePrepared.events[0].payload.areaPlan.request.shape, "square2");
s.actors.find(x => x.id === "foe").x = 5;
assert.throws(() => lionwing.dispatchMany(s, prepared.events), /План области устарел/, "moving a target after preparation makes the area plan stale");

a = hero(); s = scene(a, { actors: [a, foe({ x: 3, y: 2 })] });
prepared = lionwing.prepare(s, { actorId: a.id, kind: "action", actionId: ids.finish, targetIds: ["foe"], focusSpent: 3 }, { random: () => 0.6 });
assert.equal(prepared.ok, false);
assert.match(prepared.errors.join(" "), /Расход Фокуса превышает допустимый предел/, "a Finisher without Power Unleashed cannot spend more Focus than current Tension");

console.log("LionWing Student Of Stars: authoritative Charge -> Finisher gate, typed 3×Tension Focus cap, linked line area revalidation, forged claims, and stale/over-cap rejection passed");
