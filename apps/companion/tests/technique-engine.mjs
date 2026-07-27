import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const source = fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8");
const dataSource = fs.readFileSync(new URL("../data.js", import.meta.url), "utf8");
const context = { console };
context.globalThis = context;
context.window = context;
vm.runInNewContext(dataSource, context);
loadSceneEngine(context);
vm.runInNewContext(source, context);
const Engine = context.DAWN_TECHNIQUE_ENGINE;
const SceneEngine = context.DAWN_SCENE_ENGINE;

const scene = {
  version: 0, round: 1, tension: 5, activeActorId: "hero",
  activeSpace: "main",
  spaces: [{ id: "main", name: "Поле", width: 7, height: 7 }],
  actors: [
    { id: "hero", name: "Искра", team: "hero", space: "main", x: 1, y: 1, ap: 3, focus: 6, attrs: { spirit: 4, mind: 4 }, usedActions: [], techniques: { "ruiner.bombardier": 3, "disruptor.chemist": 1, "disruptor.inner-world": 2, "powerhouse.spellsword": 2 } },
    { id: "enemy-a", name: "Ассасин", team: "enemy", space: "main", x: 3, y: 3 },
    { id: "enemy-b", name: "Ведьма", team: "enemy", space: "main", x: 4, y: 3 },
  ],
  objects: [], markers: [], targetIds: [],
};

assert.ok(Engine.rulesFor(scene.actors[0].techniques).some(rule => rule.id === "ruiner.bombardier.3"));
assert.equal(Engine.RULES.find(rule => rule.id === "ruiner.bombardier.3").automation, "partial");
assert.equal(Engine.RULES.find(rule => rule.id === "disruptor.chemist.1").automation, "full");
const coverage = Engine.techniqueCoverage(context.DAWN_DATA);
assert.equal(coverage.length, 321, "every Technique level must have an automation status");
assert.ok(coverage.every(entry => ["full", "partial", "decision", "manual"].includes(entry.automation)));
assert.ok(coverage.filter(entry => entry.automation !== "manual").length >= 290, "semantic mechanics index assists most canonical levels");
assert.ok(coverage.some(entry => entry.mechanics?.areas?.length));
assert.ok(coverage.some(entry => entry.mechanics?.clocks?.length));
assert.equal(Engine.techniqueCoverage(context.DAWN_DATA, { "ruiner.bombardier": 2 }).length, 2);

const explosion = Engine.preview(scene, {
  actorId: "hero",
  ruleId: "ruiner.bombardier.3",
  anchor: { x: 3, y: 3 },
  options: { focusSpent: 4 },
  roll: { formula: "8D6", rolls: [4, 4, 4, 4, 2, 2, 2, 2], successes: 4, crits: 0 },
});
assert.equal(explosion.ok, true);
assert.equal(explosion.affectedCells.length, 25);
assert.deepEqual([...explosion.affectedActorIds].sort(), ["enemy-a", "enemy-b"].sort());

const tooFar = Engine.preview(scene, {
  actorId: "hero",
  ruleId: "powerhouse.spellsword.2",
  destination: { x: 6, y: 6 },
});
assert.equal(tooFar.ok, false);
assert.match(tooFar.errors.join(" "), /3 клетками/);

const gasScene = structuredClone(scene);
gasScene.objects = [{ id: "terrain", space: "main", type: "terrain", label: "Стена", cells: ["3,3"] }];
const gas = Engine.preview(gasScene, {
  actorId: "hero",
  ruleId: "disruptor.chemist.1",
  anchor: { x: 3, y: 3 },
});
const committedGas = Engine.commit(gasScene, gas, { makeId: prefix => `test-${prefix}` });
assert.equal(gasScene.objects.length, 1, "preview/commit must not mutate the source scene");
assert.equal(committedGas.scene.objects[0].type, "gas");
assert.equal(committedGas.scene.objects[0].duration, "nextTurn");
const gasEvents = Engine.toEvents(gasScene, gas, { makeId: prefix => `event-${prefix}` });
const eventGas = SceneEngine.dispatchMany({ ...gasScene, version: 0, log: [] }, gasEvents).scene;
assert.equal(eventGas.objects[0].type, "gas", "Technique commands share the Scene event stream");
assert.ok(eventGas.log.some(event => event.type === "technique.resolve"));
assert.equal(JSON.stringify(Engine.undo(committedGas.transaction)), JSON.stringify(gasScene));

const innerWorld = Engine.preview(scene, {
  actorId: "hero",
  ruleId: "disruptor.inner-world.2",
  targetIds: ["enemy-a"],
});
const committedSpace = Engine.commit(scene, innerWorld, { makeId: prefix => `test-${prefix}` });
const pocket = committedSpace.scene.spaces.find(space => space.name === "Внутренний мир");
assert.ok(pocket);
assert.equal(committedSpace.scene.actors.find(actor => actor.id === "hero").space, pocket.id);
assert.equal(committedSpace.scene.actors.find(actor => actor.id === "enemy-a").space, pocket.id);
const innerEvents = Engine.toEvents(scene, innerWorld, { makeId: prefix => `event-${prefix}` });
const eventSpace = SceneEngine.dispatchMany({ ...scene, version: 0, log: [] }, innerEvents).scene;
assert.equal(eventSpace.actors.find(actor => actor.id === "hero").space, eventSpace.activeSpace);

const manualEntry = coverage.find(entry => entry.automation === "manual");
const manual = Engine.manualPreview(scene, { actorId: "hero", entry: manualEntry, targetIds: ["enemy-a"], note: "Решение подтверждено Нарратором" });
assert.equal(manual.ok, true);
const committedManual = Engine.commit(scene, manual, { makeId: prefix => `test-${prefix}` });
assert.equal(committedManual.scene.log[0].type, "technique.manual");

const assistedEntry = {
  id: "test.technique.1", techniqueId: "test.technique", techniqueName: "Проверка", level: 1, name: "Безопасный эффект",
  mechanics: { directEffects: ["Помечен"], effects: ["Помечен"], conditional: false },
};
const assisted = Engine.assistedPreview(scene, { actorId: "hero", entry: assistedEntry, targetIds: ["enemy-a"], effectIds: ["negative.помечен"] });
assert.equal(assisted.ok, true);
const assistedEvents = Engine.toEvents(scene, assisted, { makeId: prefix => `event-${prefix}` });
assert.ok(assistedEvents.some(event => event.type === "effect.apply"));
const assistedScene = SceneEngine.dispatchMany({ ...scene, version: 0, log: [] }, assistedEvents).scene;
assert.ok(assistedScene.actors.find(actor => actor.id === "enemy-a").effects.includes("negative.помечен"));

const foundationScene = structuredClone(scene);
foundationScene.actors[0].techniques = {
  "powerhouse.braggart": 1,
  "powerhouse.gunslinger": 1,
  "vagabond.aerial-master": 1,
  "bulwark.servant-s-call": 1,
  "powerhouse.spellsword": 3,
  "powerhouse.improvisational-fighter": 1,
};
foundationScene.actors[0].effects = ["positive.ускорен"];
foundationScene.actors[0].alternateResources = { bullets: 6 };
foundationScene.markers = [{ id: "servant", ownerActorId: "hero", kind: "summon", ruleId: "bulwark.servant-s-call.1" }];
foundationScene.objects = [{ id: "tool", ownerActorId: "hero", space: "main", type: "terrain", hp: 10, cells: ["2,1"], ruleId: "powerhouse.improvisational-fighter.1" }];
foundationScene.log = [
  { id: "spell", type: "action.prepare", actorId: "hero", payload: { actionName: "Заклинание", targetIds: ["enemy-a"] } },
  { id: "turn", type: "turn.start", actorId: "hero", payload: {} },
];
const foundationRequests = [
  ["powerhouse.braggart.1.foundation", {}],
  ["powerhouse.gunslinger.1.foundation", { options: { amount: 2 } }],
  ["vagabond.aerial-master.1.foundation", {}],
  ["bulwark.servant-s-call.1.foundation", {}],
  ["powerhouse.spellsword.3.foundation", { targetIds: ["enemy-a"] }],
  ["powerhouse.improvisational-fighter.1.foundation", { anchor: { x: 2, y: 1 }, options: { objectId: "tool" } }],
];
for (const [ruleId, request] of foundationRequests) {
  const prepared = Engine.preview(foundationScene, { actorId: "hero", ruleId, ...request });
  assert.equal(prepared.ok, true, `${ruleId} foundation preview`);
  assert.ok(prepared.foundation, `${ruleId} exposes canonical foundation state`);
  assert.equal(prepared.rule.automation, "partial", `${ruleId} must not claim full automation`);
}
assert.equal(Engine.preview(foundationScene, { actorId: "hero", ruleId: "powerhouse.spellsword.3.foundation", targetIds: ["enemy-a"] }).foundation.matched, true);

console.log(`Technique engine QA passed: ${Engine.RULES.length} rules`);
