import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const paths = {
  nirash: process.env.DAWN_NIRASH_FIXTURE || "D:/Dropzone/Downloads/DAWN-Нираш.json",
  raasha: process.env.DAWN_RAASHA_FIXTURE || "D:/Dropzone/Downloads/DAWN-Рааша-Шаадрин.json",
  rias: process.env.DAWN_RIAS_FIXTURE || "D:/Dropzone/Downloads/DAWN-Риас-Дориан-Вейс.json",
};
if (Object.values(paths).some(path => !fs.existsSync(path))) {
  console.log("Svetozar battle QA skipped: set DAWN_NIRASH_FIXTURE, DAWN_RAASHA_FIXTURE and DAWN_RIAS_FIXTURE");
  process.exit(0);
}

const heroes = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, JSON.parse(fs.readFileSync(path, "utf8")).hero]));
assert.deepEqual(heroes.nirash.techniques, { "disruptor.mind-breaker": 3, "altruist.replicator": 3, "ruiner.void-soul": 3 });
assert.deepEqual(heroes.raasha.techniques, { "disruptor.siren": 2, "vagabond.dim-mak": 2, "vagabond.master-at-arms": 1 });
assert.deepEqual(heroes.rias.techniques, { "ruiner.rapid-fire-sorcery": 1, "ruiner.ritualist": 1, "ruiner.thunder-blood": 3 });

const context = { console, Date };
context.globalThis = context;
context.window = context;
for (const file of ["data.js", "logic.js", "technique-foundation-map.js"]) vm.runInNewContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const Engine = context.DAWN_SCENE_ENGINE;
const data = context.DAWN_DATA;
const actionNamed = name => data.actions.list.find(action => action.name === name);
const actorFromHero = (id, hero, x, y) => ({ id, heroId: hero.id, kind: "hero", team: "hero", name: hero.name, tier: hero.tier, space: "main", x, y, hp: hero.runtime.hp, maxHp: hero.runtime.maxHp, ap: hero.runtime.ap, baseAp: 3, focus: hero.runtime.focus, stress: hero.runtime.stress, speed: 3, armor: 0, evasion: 0, attrs: { ...hero.attrs }, skills: structuredClone(hero.skills), ability: structuredClone(hero.ability), techniques: { ...hero.techniques }, effects: [...hero.runtime.effects], usedActions: [], acted: false, knockedOut: false });
const enemy = (id, profileId, name, x, y, extra = {}) => ({ id, kind: "enemy", team: "enemy", profileId, name, tier: 1, space: "main", x, y, hp: extra.hp || 13, maxHp: extra.maxHp || 13, ap: 2, baseAp: 2, focus: 0, speed: extra.speed || 3, armor: extra.armor || 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], usedActions: [], usedTrump: false, acted: false, knockedOut: false, ...extra });
const scene = {
  version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: "raasha", activeSpace: "main",
  spaces: [{ id: "main", name: "Поле", mode: "standard", width: 7, height: 7 }],
  actors: [
    actorFromHero("nirash", heroes.nirash, 1, 2), actorFromHero("raasha", heroes.raasha, 1, 3), actorFromHero("rias", heroes.rias, 1, 4),
    enemy("svetozar-ranger", "enemy.common.ranger", "Светозар · Тройной взгляд Сурьи", 5, 3, { compoundId: "svetozar", hp: 13, maxHp: 13, speed: 2 }),
    enemy("svetozar-coordinator", "enemy.common.coordinator", "Светозар · Усилитель Сурьи", 5, 3, { compoundId: "svetozar", hp: 13, maxHp: 13 }),
    enemy("mira", "enemy.common.duelist", "Мира", 5, 1), enemy("tom", "enemy.common.builder", "Том", 4, 2, { hp: 15, maxHp: 15, armor: 1 }),
    enemy("neyra", "enemy.common.witch", "Нейра", 5, 5), enemy("brann", "enemy.common.guardian", "Бранн", 4, 4, { hp: 20, maxHp: 20, armor: 1 }),
  ], objects: [], markers: [], walls: [], log: [], rollFeed: [], triggerQueue: [],
};

for (const actor of scene.actors.filter(actor => actor.team === "enemy")) {
  const turn = structuredClone(scene); turn.activeActorId = actor.id;
  assert.deepEqual(Array.from(Engine.availableActions(turn, data, actor.id), action => action.name), ["Шаг"], `${actor.name}: только канонический общий Шаг`);
  assert.equal(Engine.availableEnemyRules(turn, data, actor.id).length, 3, `${actor.name}: действие, атака и козырь профиля доступны Нарратору`);
}

assert.deepEqual((({ hp, maxHp, gate }) => ({ hp, maxHp, gate }))(Engine.compoundEnemyStatus(scene, "svetozar-ranger")), { hp: 26, maxHp: 26, gate: 13 });
const gated = Engine.dispatch(scene, { type: "damage.apply", actorId: "nirash", payload: { targetId: "svetozar-ranger", amount: 99, ignoreArmor: true, ignoreEvasion: true } }).scene;
assert.equal(Engine.compoundEnemyStatus(gated, "svetozar-ranger").hp, 13, "Одна атака не перескакивает две фазы составного Светозара");
assert.equal(gated.tension, 1, "Переход фазы составного врага повышает Напряжение");

const studyScene = structuredClone(scene); studyScene.actors.find(actor => actor.id === "mira").x = 3; studyScene.actors.find(actor => actor.id === "mira").y = 3;
const study = Engine.prepareAction(studyScene, data, { actorId: "raasha", actionId: actionNamed("Изучение").id, targetIds: ["mira"] });
assert.equal(study.ok, true);
let studied = Engine.dispatchMany(studyScene, study.events).scene;
assert.equal(studied.pendingPrompt?.kind, "siren-study-frighten");
studied = Engine.dispatchMany(studied, Engine.respondRulePrompt(studied, data, { choice: "frighten" }).events).scene;
assert.equal(studied.pendingPrompt?.kind, "dim-mak-weak-point", "Сирена не поглощает следующее решение Дим Мака");

const riasTurn = structuredClone(scene); riasTurn.activeActorId = "rias";
const rest = Engine.prepareAction(riasTurn, data, { actorId: "rias", actionId: actionNamed("Передышка").id });
let staticPrompt = Engine.dispatchMany(riasTurn, rest.events).scene;
assert.equal(staticPrompt.pendingPrompt?.kind, "thunder-rest-static");
staticPrompt = Engine.dispatchMany(staticPrompt, Engine.respondRulePrompt(staticPrompt, data, { choice: "fill" }).events).scene;
assert.equal(Engine.clockStatus(staticPrompt, "rias", "ruiner.thunder-blood.static").value, 4, "Передышка Риаса наполняет Статику до четырёх");

const requested = Engine.dispatch(scene, { type: "challenge.request", payload: { id: "battle-check", actorId: "nirash", target: 3, requestedBy: "Нарратор" } }).scene;
const publicRoll = Engine.dispatch(requested, { type: "roll.public", actorId: "nirash", payload: { formula: "4D6 ≥4", rolls: [6, 4, 2, 1], successes: 2, crits: 1, target: 3, challengeRequestId: "battle-check" } }).scene;
assert.equal(publicRoll.rollFeed[0].actor, heroes.nirash.name);
assert.equal(publicRoll.rollFeed[0].challengeRequestId, "battle-check", "Ответный бросок остаётся связан с запросом в общем журнале");
assert.equal(publicRoll.challengeRequest.result.successes, 2, "После ответа запрос считается выполненным");

console.log("Svetozar battle QA passed: exact heroes, enemy kits, Compound boss, nested prompts, Static and public rolls");
