import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "lionwing-table-data.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
const engine = context.window.DAWN_SCENE_ENGINE;
const data = context.window.DAWN_DATA;
const clone = value => JSON.parse(JSON.stringify(value));
const actor = (id, team, x, y, extra = {}) => ({
  id, name: id, kind: "enemy", heroId: null, rulesEdition: "lionwing", team, space: "main", x, y,
  hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 0, influence: 0, wounds: 0, stress: 0,
  tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 },
  effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, lionwing: {}, ...extra,
});
const scene = (profileId, source = {}, others = []) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "other-turn", tension: 1,
  spaces: [{ id: "main", name: "Main", width: 7, height: 7 }],
  actors: [actor("source", "red", 2, 2, { profileId, ...source }), ...others],
  objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] }, targetIds: [], targetCells: [],
  reminders: [], rollFeed: [], log: [], triggerQueue: [], lionwing: { entities: {}, entityReceipts: {} },
});
let serial = 0;
const prepare = (current, ruleId, request = {}) => engine.prepareEnemyRule(current, data, { actorId: "source", ruleId, ...request });
const commit = (current, prepared, label = "simple") => engine.dispatchMany(current, prepared.events.map((event, index) => ({ ...event, id: `${label}-${serial++}-${index}` })), { expectedVersion: current.version }).scene;
const sourceActor = current => current.actors.find(item => item.id === "source");

const ids = {
  focus: "lionwing.npc.executioner.focus",
  aim: "lionwing.npc.cannoneer.aim",
  seethe: "lionwing.npc.berserker.seethe",
  neutralize: "lionwing.npc.assassin.neutralize-target",
  gospel: "lionwing.npc.paladin.gospel",
  discombobulate: "lionwing.npc.spright.discombobulate",
};
for (const [key, id] of Object.entries(ids)) {
  const profileId = id.split(".").slice(0, 3).join(".");
  const status = engine.availableEnemyRules(scene(profileId), data, "source").find(rule => rule.id === id);
  assert.equal(status?.automation, "full", `${key} must use the full LionWing path`);
  assert.equal(status?.apCost, 1, `${key} has canonical NPC Action cost 1 AP`);
}

for (const [profileId, ruleId, expected] of [
  ["lionwing.npc.executioner", ids.focus, ["positive.усилен", "positive.укреплен"]],
  ["lionwing.npc.cannoneer", ids.aim, ["positive.усилен", "positive.устойчив"]],
]) {
  const current = scene(profileId);
  const prepared = prepare(current, ruleId);
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  assert.deepEqual(current, scene(profileId), "preparation does not mutate the Scene");
  const next = commit(current, prepared, ruleId);
  assert.equal(sourceActor(next).ap, 2, "successful action pays exactly 1 AP");
  assert.deepEqual(new Set(sourceActor(next).effects), new Set(expected));
  const alreadyPresent = scene(profileId, { effects: [...expected] });
  const repeated = commit(alreadyPresent, prepare(alreadyPresent, ruleId), `${ruleId}-present`);
  assert.equal(repeated.actors[0].effects.length, expected.length, "already-present effects stay deduplicated");
}

for (const tier of [1, 3]) {
  const amount = 2 + tier * 2;
  const wounded = scene("lionwing.npc.berserker", { tier, hp: 3, maxHp: 30 });
  const healed = commit(wounded, prepare(wounded, ids.seethe), `seethe-${tier}`);
  assert.equal(sourceActor(healed).hp, 3 + amount);
  const nearlyFull = scene("lionwing.npc.berserker", { tier, hp: 29, maxHp: 30 });
  assert.equal(sourceActor(commit(nearlyFull, prepare(nearlyFull, ids.seethe), `seethe-cap-${tier}`)).hp, 30, "healing caps at effective max HP");
}

const gospelScene = scene("lionwing.npc.paladin", { effects: ["positive.регенерирует"] }, [
  actor("regen-ally", "red", 3, 2, { effects: ["positive.регенерирует"] }),
  actor("plain-ally", "red", 4, 2),
  actor("regen-opponent", "blue", 3, 3, { effects: ["positive.регенерирует"] }),
  actor("ko-ally", "red", 1, 2, { effects: ["positive.регенерирует"], knockedOut: true }),
]);
const gospel = commit(gospelScene, prepare(gospelScene, ids.gospel), "gospel");
assert.ok(gospel.actors.find(item => item.id === "regen-ally").effects.includes("positive.укреплен"));
for (const id of ["source", "plain-ally", "regen-opponent", "ko-ally"]) assert.equal(gospel.actors.find(item => item.id === id).effects.includes("positive.укреплен"), false, `Gospel must not Reinforce ${id}`);

for (const [label, armor, evasion, expected] of [
  ["evasion", 1, 3, "negative.замедлен"], ["armor", 3, 1, "negative.разорван"],
  ["neither", 0, 0, "negative.помечен"], ["equal-positive", 2, 2, null],
]) {
  const current = scene("lionwing.npc.spright", {}, [actor("target", "blue", 3, 2, { armor, evasion })]);
  const next = commit(current, prepare(current, ids.discombobulate, { targetIds: ["target"] }), `discombobulate-${label}`);
  const effects = next.actors.find(item => item.id === "target").effects;
  if (expected) assert.ok(effects.includes(expected), label);
  else assert.equal(effects.length, 0, "positive Armor/Evasion equality has no described effect");
}
const distant = scene("lionwing.npc.spright", {}, [actor("target", "blue", 4, 2)]);
assert.equal(prepare(distant, ids.discombobulate, { targetIds: ["target"] }).ok, false, "Discombobulate requires adjacency");
assert.equal(prepare(scene("lionwing.npc.assassin", {}, [actor("a", "red", 3, 2), actor("b", "blue", 4, 2)]), ids.neutralize, { targetIds: ["a", "b"] }).ok, false, "Neutralize Target chooses exactly one character");
const alliedNpc = scene("lionwing.npc.assassin", { team: "heroes" }, [actor("target", "heroes", 3, 2)]);
const markedAlly = commit(alliedNpc, prepare(alliedNpc, ids.neutralize, { targetIds: ["target"] }), "neutralize-ally");
assert.ok(markedAlly.actors[1].effects.includes("negative.помечен"), "an allied NPC can target any character, including an ally");

const offTurn = scene("lionwing.npc.executioner", { ap: 1, acted: true });
assert.equal(prepare(offTurn, ids.focus).ok, true, "Narrator can use an NPC Action outside its Turn");
assert.equal(sourceActor(commit(offTurn, prepare(offTurn, ids.focus), "off-turn")).ap, 0);
for (const [label, state] of [["no AP", { ap: 0 }], ["KO", { knockedOut: true }]]) {
  const current = scene("lionwing.npc.executioner", state), before = clone(current), prepared = prepare(current, ids.focus);
  assert.equal(prepared.ok, false, label);
  assert.deepEqual(current, before, `${label} rejection leaves the whole Scene unchanged`);
}
assert.equal(prepare({ ...scene("lionwing.npc.executioner"), actors: [] }, ids.focus).ok, false, "missing actor is rejected");

const replayBase = scene("lionwing.npc.executioner"), replayPrepared = prepare(replayBase, ids.focus);
const replayEvents = replayPrepared.events.map((event, index) => ({ ...event, id: `replay-${index}` }));
const once = engine.dispatchMany(replayBase, replayEvents, { expectedVersion: 0 }).scene;
assert.deepEqual(engine.dispatchMany(once, replayEvents).scene, once, "event replay is idempotent");
assert.throws(() => engine.dispatchMany({ ...clone(replayBase), version: 1 }, replayEvents, { expectedVersion: 0 }), /ожидалась|устар|Конфликт версии/);

const saved = JSON.stringify(gospel), reloaded = JSON.parse(saved), exported = JSON.stringify({ schema: 1, scene: reloaded }), imported = JSON.parse(exported).scene;
assert.equal(JSON.stringify(imported), JSON.stringify(gospel), "reload and export/import preserve effects, AP, version and journal separately from transient UI state");

const marked = scene("lionwing.npc.assassin", {}, [actor("target", "blue", 3, 2, { effects: ["negative.помечен"], hp: 20 })]);
const assassinHit = engine.dispatchMany(marked, [{ id: "assassin-hit", type: "damage.apply", actorId: "source", payload: { sourceActorId: "source", targetId: "target", amount: 2, attack: true, sourceActionId: "lionwing.npc.assassin.slice" } }]).scene;
assert.equal(assassinHit.actors[1].hp, 17, "Assassin still receives the Mark damage bonus");
assert.ok(assassinHit.actors[1].effects.includes("negative.помечен"), "Assassin attacks do not remove Mark");
const ordinary = scene("lionwing.npc.executioner", {}, [actor("target", "blue", 3, 2, { effects: ["negative.помечен"], hp: 20 })]);
const ordinaryHit = engine.dispatchMany(ordinary, [{ id: "ordinary-hit", type: "damage.apply", actorId: "source", payload: { sourceActorId: "source", targetId: "target", amount: 2, attack: true, sourceActionId: "lionwing.npc.executioner.cleave" } }]).scene;
assert.equal(ordinaryHit.actors[1].effects.includes("negative.помечен"), false, "other attackers still consume Mark");

const forgedBase = scene("lionwing.npc.berserker", { tier: 3, hp: 3, maxHp: 30 });
const forgedHeal = prepare(forgedBase, ids.seethe);
forgedHeal.events.find(event => event.type === "actor.heal").payload.amount = 99;
assert.throws(() => commit(forgedBase, forgedHeal, "forged-heal"), /канон|формул|лечение/i, "writer rejects a forged Seethe amount");
const forgedCost = prepare(forgedBase, ids.seethe);
forgedCost.events.find(event => event.type === "resource.spend").payload.amount = 0;
assert.throws(() => commit(forgedBase, forgedCost, "forged-cost"), /канон|стоим|ОД/i, "writer rejects a forged canonical AP cost");

console.log("LionWing simple enemy Actions: effects, healing, selected/filtered targets, AP, persistence, replay and Assassin Mark passed");
