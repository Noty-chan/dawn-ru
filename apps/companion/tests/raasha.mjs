import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const fixturePath = process.env.DAWN_RAASHA_FIXTURE || "D:/Downloads/Персы Мира Мертвых Богов/DAWN-Рааша-Шаадрин.json";
if (!fs.existsSync(fixturePath)) {
  console.log("Raasha exact-sheet QA skipped: set DAWN_RAASHA_FIXTURE to the exported hero JSON");
  process.exit(0);
}

const exported = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(exported.format, "dawn-ru-hero");
assert.equal(exported.schema, 2);
const hero = exported.hero;
assert.equal(hero.name, "Рааша Шаадрин");
assert.equal(hero.tier, 1);
assert.deepEqual(hero.attrs, { body: 2, talent: 2, spirit: 4, mind: 3 });
assert.deepEqual(hero.outlooks, ["wolf"]);
assert.equal(hero.primaryOutlook, "wolf");
assert.deepEqual([...hero.gifts].sort(), ["wolf.dark-urge", "wolf.outgunned"]);
assert.deepEqual(hero.techniques, {
  "disruptor.siren": 2,
  "vagabond.dim-mak": 2,
  "vagabond.master-at-arms": 1,
});
assert.equal(hero.ability.enabled, true);
assert.equal(hero.ability.rank, 2);
assert.equal(hero.runtime.hp, 6);
assert.equal(hero.runtime.maxHp, 6);

const context = { console, Date };
context.globalThis = context;
context.window = context;
for (const file of ["data.js", "logic.js", "technique-foundation-map.js"]) {
  vm.runInNewContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8"), context, { filename: "technique-engine.js" });

const Engine = context.DAWN_SCENE_ENGINE;
const TechniqueEngine = context.DAWN_TECHNIQUE_ENGINE;
const data = context.DAWN_DATA;
const derivedMaxHp = Number(hero.attrs.body) * 2 + Number(hero.tier) * 2;
const spawnedHealth = context.DAWN_LOGIC.reconcileSceneActorHealth({
  current: hero.runtime.hp,
  previousMax: hero.runtime.maxHp,
  nextMax: derivedMaxHp,
  existing: false,
});
assert.deepEqual(JSON.parse(JSON.stringify(spawnedHealth)), { current: 6, maximum: 6 }, "Рааша должна появляться на новом столе с 6/6 Здоровья");

const raashaActor = {
  id: "raasha",
  heroId: hero.id,
  kind: "hero",
  name: hero.name,
  team: "hero",
  space: "main",
  x: 1,
  y: 1,
  hp: spawnedHealth.current,
  maxHp: spawnedHealth.maximum,
  ap: hero.runtime.ap,
  baseAp: 3,
  focus: hero.runtime.focus,
  stress: hero.runtime.stress,
  attrs: { ...hero.attrs },
  skills: structuredClone(hero.skills),
  ability: structuredClone(hero.ability),
  techniques: { ...hero.techniques },
  primaryOutlook: hero.primaryOutlook,
  outlooks: [...hero.outlooks],
  gifts: [...hero.gifts],
  effects: [...hero.runtime.effects],
  usedActions: [],
  acted: false,
  knockedOut: false,
};
const scene = {
  version: 0,
  round: 1,
  turnSerial: 1,
  tension: 0,
  activeActorId: "raasha",
  activeSpace: "main",
  spaces: [{ id: "main", name: "Поле", width: 7, height: 7 }],
  actors: [
    raashaActor,
    { id: "enemy-a", kind: "enemy", name: "Враг A", team: "enemy", space: "main", x: 3, y: 1, hp: 10, maxHp: 10, ap: 2, baseAp: 2, focus: 0, attrs: { body: 2, talent: 2, spirit: 1, mind: 1 }, effects: [], usedActions: [], acted: false },
    { id: "enemy-b", kind: "enemy", name: "Враг B", team: "enemy", space: "main", x: 5, y: 1, hp: 10, maxHp: 10, ap: 2, baseAp: 2, focus: 0, attrs: { body: 2, talent: 2, spirit: 1, mind: 1 }, effects: [], usedActions: [], acted: false },
  ],
  objects: [],
  markers: [],
  log: [],
  rollFeed: [],
};

const balance = Engine.sideBalanceStatus(scene, "raasha");
assert.deepEqual(
  { enemies: balance.enemies, allies: balance.allies, outnumbered: balance.outnumbered },
  { enemies: 2, allies: 0, outnumbered: true },
  "Рааша не считается собственным союзником для «В меньшинстве»",
);
const dice = Engine.diceHookStatus(scene, "raasha", {
  scope: "challenge",
  baseCount: 2,
  usesAbility: true,
  abilityKey: "ability",
  selectedHookIds: ["wolf.dark-urge"],
  targetIds: ["enemy-a"],
});
assert.equal(dice.count, 8);
assert.deepEqual(Array.from(dice.sources, source => source.ruleId), ["wolf.outgunned", "wolf.dark-urge"]);

const ownedCoverage = TechniqueEngine.techniqueCoverage(data, hero.techniques);
assert.deepEqual(Array.from(ownedCoverage, entry => entry.id), [
  "vagabond.dim-mak.1",
  "vagabond.dim-mak.2",
  "vagabond.master-at-arms.1",
  "disruptor.siren.1",
  "disruptor.siren.2",
]);
assert.equal(ownedCoverage.find(entry => entry.id === "vagabond.master-at-arms.1").automation, "full");
assert.ok(ownedCoverage.filter(entry => entry.id !== "vagabond.master-at-arms.1").every(entry => entry.automation === "decision"));

const studyAction = data.actions.list.find(action => action.name === "Изучение");
const study = Engine.prepareAction(scene, data, { actorId: "raasha", actionId: studyAction.id, targetIds: ["enemy-a"] });
assert.equal(study.ok, true);
let studyFlow = Engine.dispatchMany(scene, study.events).scene;
assert.equal(studyFlow.pendingPrompt?.kind, "siren-study-frighten", "Сначала предлагается более приоритетное решение Сирены");
assert.equal(Engine.triggerQueueStatus(studyFlow).next?.triggerId, "vagabond.dim-mak.1.study", "Дим Мак не теряется и ждёт в очереди");
studyFlow = Engine.dispatchMany(studyFlow, Engine.respondRulePrompt(studyFlow, data, { choice: "pass" }).events).scene;
assert.equal(studyFlow.pendingPrompt?.kind, "dim-mak-weak-point", "После решения Сирены открывается решение Дим Мак");

const chainScene = structuredClone(scene);
chainScene.actors[1].x = 6;
const chainStatus = Engine.masterAtArmsStatus(chainScene, "raasha", { modeId: "chain", targetIds: ["enemy-b"] });
assert.equal(chainStatus.available, true);
const skirmishAction = data.actions.list.find(action => action.name === "Стычка");
const chain = Engine.prepareAction(chainScene, data, {
  actorId: "raasha",
  actionId: skirmishAction.id,
  targetIds: ["enemy-b"],
  armamentMode: "chain",
  roll: { formula: "3D6", rolls: [4, 4, 2], successes: 2, crits: 0 },
});
assert.equal(chain.ok, true);
assert.equal(chain.events.find(event => event.type === "action.prepare")?.payload?.quick, true);
assert.equal(chain.events.some(event => event.type === "resource.spend"), false, "Вооружение делает подходящую Стычку бесплатной");

console.log("Raasha exact-sheet QA passed");
