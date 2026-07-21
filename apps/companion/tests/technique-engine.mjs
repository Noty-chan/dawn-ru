import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8");
const sceneSource = fs.readFileSync(new URL("../scene-engine.js", import.meta.url), "utf8");
const dataSource = fs.readFileSync(new URL("../data.js", import.meta.url), "utf8");
const context = { console };
context.globalThis = context;
context.window = context;
vm.runInNewContext(dataSource, context);
vm.runInNewContext(sceneSource, context);
vm.runInNewContext(source, context);
const Engine = context.DAWN_TECHNIQUE_ENGINE;
const SceneEngine = context.DAWN_SCENE_ENGINE;

const scene = {
  activeSpace: "main",
  spaces: [{ id: "main", name: "Поле", width: 7, height: 7 }],
  actors: [
    { id: "hero", name: "Искра", space: "main", x: 1, y: 1, techniques: { "ruiner.bombardier": 3, "disruptor.chemist": 1, "disruptor.inner-world": 2, "powerhouse.spellsword": 2 } },
    { id: "enemy-a", name: "Ассасин", space: "main", x: 3, y: 3 },
    { id: "enemy-b", name: "Ведьма", space: "main", x: 4, y: 3 },
  ],
  objects: [], markers: [], targetIds: [],
};

assert.ok(Engine.rulesFor(scene.actors[0].techniques).some(rule => rule.id === "ruiner.bombardier.3"));
assert.equal(Engine.RULES.find(rule => rule.id === "ruiner.bombardier.3").automation, "assist");
assert.equal(Engine.RULES.find(rule => rule.id === "disruptor.chemist.1").automation, "full");
const coverage = Engine.techniqueCoverage(context.DAWN_DATA);
assert.equal(coverage.length, 321, "every Technique level must have an automation status");
assert.ok(coverage.every(entry => ["full", "assist", "manual"].includes(entry.automation)));
assert.equal(Engine.techniqueCoverage(context.DAWN_DATA, { "ruiner.bombardier": 2 }).length, 2);

const explosion = Engine.preview(scene, {
  actorId: "hero",
  ruleId: "ruiner.bombardier.3",
  anchor: { x: 3, y: 3 },
  options: { focusSpent: 4 },
});
assert.equal(explosion.ok, true);
assert.equal(explosion.affectedCells.length, 25);
assert.deepEqual([...explosion.affectedActorIds].sort(), ["enemy-a", "enemy-b", "hero"].sort());

const tooFar = Engine.preview(scene, {
  actorId: "hero",
  ruleId: "powerhouse.spellsword.2",
  destination: { x: 6, y: 6 },
});
assert.equal(tooFar.ok, false);
assert.match(tooFar.errors.join(" "), /3 клетками/);

const gas = Engine.preview(scene, {
  actorId: "hero",
  ruleId: "disruptor.chemist.1",
  anchor: { x: 3, y: 3 },
});
const committedGas = Engine.commit(scene, gas, { makeId: prefix => `test-${prefix}` });
assert.equal(scene.objects.length, 0, "preview/commit must not mutate the source scene");
assert.equal(committedGas.scene.objects[0].type, "gas");
assert.equal(committedGas.scene.objects[0].duration, "nextTurn");
const gasEvents = Engine.toEvents(scene, gas, { makeId: prefix => `event-${prefix}` });
const eventGas = SceneEngine.dispatchMany({ ...scene, version: 0, log: [] }, gasEvents).scene;
assert.equal(eventGas.objects[0].type, "gas", "Technique commands share the Scene event stream");
assert.ok(eventGas.log.some(event => event.type === "technique.resolve"));
assert.equal(JSON.stringify(Engine.undo(committedGas.transaction)), JSON.stringify(scene));

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

console.log(`Technique engine QA passed: ${Engine.RULES.length} rules`);
