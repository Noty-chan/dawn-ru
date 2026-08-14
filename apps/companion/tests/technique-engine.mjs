import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const source = fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8");
const dataSource = fs.readFileSync(new URL("../data.js", import.meta.url), "utf8");
const foundationMapSource = fs.readFileSync(new URL("../technique-foundation-map.js", import.meta.url), "utf8");
const context = { console };
context.globalThis = context;
context.window = context;
vm.runInNewContext(dataSource, context);
vm.runInNewContext(foundationMapSource, context);
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
assert.equal(Engine.RULES.find(rule => rule.id === "ruiner.bombardier.3").automation, "full");
assert.equal(Engine.RULES.find(rule => rule.id === "disruptor.chemist.1").automation, "full");
const coverage = Engine.techniqueCoverage(context.DAWN_DATA);
const canonicalLevelIds = Array.from(context.DAWN_DATA.archetypes.flatMap(archetype =>
  archetype.techniques.flatMap(technique => technique.levels.map(level => `${technique.id}.${level.n}`))
)).sort();
assert.deepEqual(
  Object.keys(context.DAWN_TECHNIQUE_FOUNDATION_MAP.REVIEWED.profiles).sort(),
  canonicalLevelIds,
  "manual REVIEWED profiles must exactly match all canonical Technique levels",
);
assert.equal(coverage.length, 321, "every Technique level must have an automation status");
assert.ok(coverage.every(entry => ["full", "partial", "decision", "manual"].includes(entry.automation)));
assert.ok(coverage.filter(entry => entry.automation !== "manual").length >= 290, "semantic mechanics index assists most canonical levels");
assert.ok(coverage.some(entry => entry.mechanics?.areas?.length));
assert.ok(coverage.some(entry => entry.mechanics?.clocks?.length));
assert.equal(coverage.filter(entry => entry.foundationPlan?.capabilities?.length).length, 321, "every Technique level must have a foundation plan");
assert.ok(coverage.every(entry => ["candidate", "reviewed"].includes(entry.foundationPlan.status)));
assert.equal(coverage.filter(entry => entry.foundationPlan.status === "reviewed").length, 321, "all current Technique levels were manually reviewed");
const clockLevels = coverage.filter(entry => entry.foundationPlan.reviewed.includes("rule-clock"));
assert.equal(clockLevels.length, 19, "manual review identifies exactly nineteen current clock levels");
assert.ok(clockLevels.every(entry => Engine.RULES.some(rule => rule.techniqueId === entry.techniqueId && Number(rule.level) === Number(entry.level))), "every reviewed clock level has an explicit thin adapter and honest automation status");
assert.ok(coverage.find(entry => entry.id === "powerhouse.braggart.1").foundationPlan.reviewed.includes("rule-clock"));
assert.ok(coverage.find(entry => entry.id === "powerhouse.gunslinger.1").foundationPlan.reviewed.includes("alternate-resource"));
assert.ok(coverage.find(entry => entry.id === "altruist.last-hope.3").foundationPlan.reviewed.includes("reaction-window"));
assert.ok(coverage.find(entry => entry.id === "bulwark.mecha-pilot.1").foundationPlan.reviewed.includes("multi-space-actor"));
assert.ok(!coverage.find(entry => entry.id === "powerhouse.technician.1").foundationPlan.reviewed.includes("inventory"), "Charge action is not an inventory charge");
const explicitBigIron = context.DAWN_TECHNIQUE_FOUNDATION_MAP.planForLevel({
  id: "powerhouse.gunslinger.1",
  text: "намеренно неверный текст без механических терминов",
  mechanics: {},
});
assert.deepEqual(
  [...explicitBigIron.reviewed].sort(),
  [...coverage.find(entry => entry.id === "powerhouse.gunslinger.1").foundationPlan.reviewed].sort(),
  "reviewed profiles must not depend on heuristic text classification",
);
assert.equal(
  context.DAWN_TECHNIQUE_FOUNDATION_MAP.planForLevel({ id: "future.technique.1", text: "получите 1 Фокус" }).status,
  "candidate",
  "unlisted future levels must never become reviewed automatically",
);
assert.equal(Engine.techniqueCoverage(context.DAWN_DATA, { "ruiner.bombardier": 2 }).length, 2);

const baseExplosion = Engine.preview(scene, {
  actorId: "hero",
  ruleId: "ruiner.bombardier.1",
  anchor: { x: 3, y: 3 },
  options: { focusSpent: 0 },
  roll: { formula: "8D6", rolls: [4, 4, 4, 4, 2, 2, 2, 2], successes: 4, crits: 0 },
});
assert.equal(baseExplosion.ok, true);
assert.deepEqual([...baseExplosion.affectedCells].sort(), ["2,3", "3,2", "3,3", "3,4", "4,3"]);

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

const empathScene=structuredClone(scene);
empathScene.actors[0].techniques={"altruist.empath":3};
empathScene.actors[0].focus=3;empathScene.actors[0].ap=1;
empathScene.actors[1].team="hero";empathScene.actors[1].tier=2;
const support=Engine.preview(empathScene,{actorId:"hero",ruleId:"altruist.empath.3",targetIds:["enemy-a"]});
assert.equal(support.ok,true);
assert.deepEqual(JSON.parse(JSON.stringify(support.events.filter(event=>event.type==="resource.spend").map(event=>[event.payload.resource,event.payload.amount]))),[["focus",3],["ap",1]]);
assert.equal(support.events.find(event=>event.type==="actor.state").payload.value,2);

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
  ["powerhouse.braggart.1.foundation", {}, "partial"],
  ["powerhouse.gunslinger.1.foundation", { options: { amount: 2 } }, "partial"],
  ["vagabond.aerial-master.1.foundation", {}, "partial"],
  ["bulwark.servant-s-call.1.foundation", {}, "partial"],
  ["powerhouse.spellsword.3.foundation", { targetIds: ["enemy-a"] }, "full"],
  ["powerhouse.improvisational-fighter.1.foundation", { anchor: { x: 2, y: 1 }, options: { objectId: "tool" } }, "partial"],
];
for (const [ruleId, request, automation] of foundationRequests) {
  const prepared = Engine.preview(foundationScene, { actorId: "hero", ruleId, ...request });
  assert.equal(prepared.ok, true, `${ruleId} foundation preview`);
  assert.ok(prepared.foundation, `${ruleId} exposes canonical foundation state`);
  assert.equal(prepared.rule.automation, automation, `${ruleId} exposes its reviewed automation status`);
}
assert.equal(Engine.preview(foundationScene, { actorId: "hero", ruleId: "powerhouse.spellsword.3.foundation", targetIds: ["enemy-a"] }).foundation.matched, true);

const autophageScene = structuredClone(scene);
Object.assign(autophageScene.actors[0], { hp: 6, maxHp: 12, guts: 4, techniques: { "disruptor.autophage": 3 } });
Object.assign(autophageScene.actors[1], { hp: 9, maxHp: 10, effects: [] });
Object.assign(autophageScene.actors[2], { hp: 5, maxHp: 10, effects: [] });
autophageScene.log = [
  { id: "finish-resolve", type: "action.resolve", actorId: "hero", payload: { actionId: "finish", name: "Завершение", attribute: "body", targetIds: ["enemy-a"] } },
  { id: "finish-hit", type: "damage.apply", actorId: "hero", payload: { sourceActionId: "finish", targetId: "enemy-a", dealt: 3 } },
];
const mutableFlesh = Engine.preview(autophageScene, { actorId: "hero", ruleId: "disruptor.autophage.3", rolls: [2, 5] });
assert.equal(mutableFlesh.ok, true);
assert.deepEqual([...mutableFlesh.affectedActorIds], ["enemy-a"], "Autophage III targets every enemy with more current Health");
assert.equal(mutableFlesh.events.filter(event => event.type === "effect.apply").length, 2);
const wrongFinish = structuredClone(autophageScene);
wrongFinish.log[0].payload.attribute = "mind";
assert.equal(Engine.preview(wrongFinish, { actorId: "hero", ruleId: "disruptor.autophage.3", rolls: [2, 5] }).ok, false, "Autophage III rejects a Finish that was not Body or Spirit");
const usedMutableFlesh = structuredClone(autophageScene);
usedMutableFlesh.log.unshift({ id: "used", type: "technique.resolve", actorId: "hero", payload: { ruleId: "disruptor.autophage.3" } });
assert.equal(Engine.preview(usedMutableFlesh, { actorId: "hero", ruleId: "disruptor.autophage.3", rolls: [2, 5] }).ok, false, "Autophage III is once per Scene");

console.log(`Technique engine QA passed: ${Engine.RULES.length} rules`);
