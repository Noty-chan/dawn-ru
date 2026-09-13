import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "edition-lionwing-ru.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const Engine = loadSceneEngine(context);
const LionWing = context.window.DAWN_LIONWING_ENGINE;
const Logic = context.window.DAWN_LOGIC;
const ids = Engine.ACTION_IDS;

const appCoreSource = fs.readFileSync(path.join(root, "app-core.js"), "utf8");
const apContractStart = appCoreSource.indexOf("function normalizedEncounterApContract");
const apContractEnd = appCoreSource.indexOf("function normalizeGmLibraryEnemy", apContractStart);
assert.ok(apContractStart >= 0 && apContractEnd > apContractStart, "AP contract must stay available to encounter normalization");
const apContext = { clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)) };
vm.createContext(apContext);
vm.runInContext(`${appCoreSource.slice(apContractStart, apContractEnd)};this.normalizedEncounterApContract=normalizedEncounterApContract;`, apContext);
const normalizeAp = (enemy, options) => JSON.parse(JSON.stringify(vm.runInContext(`normalizedEncounterApContract(${JSON.stringify(enemy)},${JSON.stringify(options || {})})`, apContext)));

assert.deepEqual(normalizeAp({ kind: "enemy", profileId: "lionwing.npc.viper" }), { baseAp: 3, ap: 3 }, "A sparse canonical LionWing profile defaults to 3 AP");
assert.deepEqual(normalizeAp({ kind: "crowd", profileId: "" }), { baseAp: 0, ap: 0 }, "Fodder always has zero AP");
assert.deepEqual(normalizeAp({ kind: "enemy", profileId: "enemy.modifier.giant", ap: 3, baseAp: 3 }), { baseAp: 0, ap: 0 }, "Enemy Modifiers cannot acquire ordinary AP");
assert.deepEqual(normalizeAp({ kind: "enemy", profileId: "lionwing.npc.mount", ap: 1, baseAp: 1 }), { baseAp: 1, ap: 1 }, "An explicitly configured special Summon AP value is preserved");
assert.deepEqual(normalizeAp({ kind: "enemy", profileId: "enemy.common.assassin" }), { baseAp: 2, ap: 2 }, "RU-v0.9 keeps its 2 AP default");
assert.deepEqual(normalizeAp({ kind: "enemy", profileId: "legacy-profile", ap: 2, baseAp: 2 }, { edition: "ru-v0.9" }), { baseAp: 2, ap: 2 }, "Existing old encounters retain explicit AP and need no migration");

const derived = Logic.calculateDerivedStatistics({ edition: "lionwing", tier: 1, body: 4, talent: 3, spirit: 2, mind: 2 });
assert.deepEqual(JSON.parse(JSON.stringify(derived)), { hp: 16, guts: null, speed: 4, focus: 2 }, "The stress scene starts from canonical LionWing hero creation");

const actor = (id, kind, team, x, y, extra = {}) => ({
  id,
  name: id,
  kind,
  rulesEdition: "lionwing",
  team,
  heroId: kind === "hero" ? id : null,
  profileId: extra.profileId || null,
  space: "main",
  x,
  y,
  hp: kind === "crowd" ? 1 : extra.hp ?? 20,
  maxHp: kind === "crowd" ? 1 : extra.maxHp ?? 20,
  ap: extra.ap ?? 0,
  baseAp: kind === "crowd" ? 0 : extra.baseAp ?? 3,
  focus: kind === "hero" ? 0 : 0,
  influence: kind === "hero" ? 2 : 0,
  wounds: 0,
  stress: 0,
  tier: kind === "crowd" ? 0 : extra.tier ?? 1,
  speed: kind === "crowd" ? 0 : extra.speed ?? 4,
  armor: extra.armor ?? 0,
  evasion: extra.evasion ?? 0,
  attrs: extra.attrs || { body: 4, talent: 3, spirit: 2, mind: 2 },
  effects: [],
  effectStates: {},
  usedActions: [],
  acted: kind === "crowd",
  knockedOut: false,
  knownTechniques: {},
  techniques: {},
  lionwing: {},
  ...extra,
});

const initialScene = () => ({
  rulesEdition: "lionwing",
  version: 0,
  round: 1,
  turnSerial: 0,
  tension: 0,
  activeActorId: null,
  spaces: [{ id: "main", name: "Alpha stress field", mode: "standard", width: 7, height: 7 }],
  actors: [
    actor("hero", "hero", "hero", 1, 3, { hp: derived.hp, maxHp: derived.hp, speed: derived.speed, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 } }),
    actor("viper", "enemy", "enemy", 2, 3, { profileId: "lionwing.npc.viper" }),
    actor("ronin", "enemy", "enemy", 3, 2, { profileId: "lionwing.npc.ronin" }),
    actor("crowd", "crowd", "enemy", 3, 4, { crowdGroupId: "alpha-crowd" }),
    actor("colossus-bruiser", "enemy", "enemy", 1, 2, { profileId: "lionwing.npc.bruiser", compoundId: "colossus", maxHp: 12, hp: 12 }),
    actor("colossus-behemoth", "enemy", "enemy", 1, 2, { profileId: "lionwing.npc.behemoth", compoundId: "colossus", maxHp: 12, hp: 12 }),
    actor("colossus-giant", "enemy", "enemy", 1, 2, { profileId: "enemy.modifier.giant", compoundId: "colossus", maxHp: 12, hp: 12, baseAp: 0 }),
  ],
  objects: [{ id: "mud", type: "difficult", space: "main", cells: ["2,2"] }],
  walls: [{ id: "wall", space: "main", a: "3,5", b: "4,5", hp: 10, maxHp: 10 }],
  markers: [{ id: "objective", space: "main", x: 5, y: 3, kind: "objective", label: "Alpha objective" }],
  topology: { cuts: [] },
  log: [],
  targetIds: [],
  targetCells: [],
  reminders: [],
  rollFeed: [],
});

let serial = 0;
const dispatch = (scene, actorId, payload) => {
  const event = { ...LionWing.command(actorId, payload), id: `alpha-stress-${++serial}` };
  return LionWing.dispatchMany(scene, [event]).scene;
};
const prepare = (scene, actorId, payload) => {
  const result = LionWing.prepare(scene, { actorId, ...payload }, { random: () => 0.6 });
  assert.equal(result.ok, true, result.errors?.join(" "));
  return LionWing.dispatchMany(scene, result.events).scene;
};
const withReaction = (scene, attackerId, targetId, amount = null) => {
  const action = { kind: "action", actionId: ids.skirmish, targetIds: [targetId] };
  if (amount !== null) action.roll = { initialCount: 4, rolls: [4, 4, 1, 1] };
  let next = prepare(scene, attackerId, action);
  assert.equal(next.pendingAction?.actorId, attackerId, "A base Attack opens its Reaction window");
  next = dispatch(next, targetId, { kind: "reaction", choice: "take" });
  return dispatch(next, attackerId, { kind: "resolve-attack" });
};

let scene = initialScene();
const initialAp = Object.fromEntries(scene.actors.map(item => [item.id, [item.baseAp, item.ap]]));
assert.deepEqual(initialAp, {
  hero: [3, 0],
  viper: [3, 0],
  ronin: [3, 0],
  crowd: [0, 0],
  "colossus-bruiser": [3, 0],
  "colossus-behemoth": [3, 0],
  "colossus-giant": [0, 0],
}, "The minimal scene contains canonical NPC, Fodder, Compound, and Modifier AP contracts");
assert.equal(LionWing.turnStartStatus(scene, "crowd").available, false, "Fodder never enters the ordinary Turn cycle");
assert.equal(LionWing.turnStartStatus(scene, "colossus-giant").available, false, "Enemy Modifiers never enter the ordinary Turn cycle");

scene = dispatch(scene, "hero", { kind: "turn-start" });
assert.equal(scene.actors.find(item => item.id === "hero").ap, 3, "Hero starts with 3 AP");
assert.equal(scene.actors.find(item => item.id === "hero").focus, 2, "Hero Focus initializes from Spirit");
assert.equal(scene.actors.find(item => item.id === "viper").ap, 0, "Inactive enemies do not receive AP before their Turn");

const viperBefore = scene.actors.find(item => item.id === "viper").hp;
scene = withReaction(scene, "hero", "viper");
assert.equal(scene.actors.find(item => item.id === "hero").ap, 2, "Base Skirmish spends one AP");
assert.ok(scene.actors.find(item => item.id === "viper").hp < viperBefore, "The base Attack applies damage after the Reaction");
scene = dispatch(scene, "hero", { kind: "effect", targetId: "viper", effect: "negative.испуган" });
assert.ok(scene.actors.find(item => item.id === "viper").effects.includes("negative.испуган"), "An Effect can be applied during the same battle");
scene = dispatch(scene, "hero", { kind: "turn-end" });

scene = dispatch(scene, "viper", { kind: "turn-start" });
assert.equal(scene.actors.find(item => item.id === "viper").ap, 3, "A canonical NPC starts its Turn with 3 AP");
const heroBeforeEnemyAttack = scene.actors.find(item => item.id === "hero").hp;
scene = withReaction(scene, "viper", "hero");
assert.equal(scene.actors.find(item => item.id === "viper").ap, 2, "An NPC base Attack spends one of its 3 AP");
assert.ok(scene.actors.find(item => item.id === "hero").hp < heroBeforeEnemyAttack, "The Reaction window still resolves NPC base damage");
scene = dispatch(scene, "viper", { kind: "turn-end" });

scene = dispatch(scene, null, { kind: "round-end" });
assert.equal(scene.round, 2, "The first Round resets after both sides finish the exchange");
assert.ok(scene.actors.filter(item => item.kind === "enemy").every(item => item.ap === 0), "Round reset clears spent NPC AP");
assert.ok(scene.actors.filter(item => item.kind === "enemy" && item.profileId !== "enemy.modifier.giant").every(item => item.baseAp === 3), "Round reset retains canonical NPC base AP");
assert.equal(scene.actors.find(item => item.id === "crowd").acted, true, "Fodder remains outside the Turn reset queue");

scene = dispatch(scene, "hero", { kind: "turn-start" });
const compoundBefore = scene.actors.filter(item => item.compoundId === "colossus").reduce((sum, item) => sum + item.hp, 0);
scene = dispatch(scene, "hero", { kind: "damage", targetId: "colossus-bruiser", amount: 4 });
const compoundAfter = scene.actors.filter(item => item.compoundId === "colossus").reduce((sum, item) => sum + item.hp, 0);
assert.equal(compoundAfter, compoundBefore - 4, "Damage to one Compound part reduces the shared Health pool");
assert.equal(new Set(scene.actors.filter(item => item.compoundId === "colossus").map(item => `${item.x},${item.y}`)).size, 1, "Compound parts stay on one shared cell");
scene = dispatch(scene, "hero", { kind: "turn-end" });
scene = dispatch(scene, "colossus-bruiser", { kind: "turn-start" });
assert.equal(scene.actors.find(item => item.id === "colossus-bruiser").ap, 3, "A Compound part receives its own 3 AP Turn");
scene = withReaction(scene, "colossus-bruiser", "hero");
scene = dispatch(scene, "colossus-bruiser", { kind: "turn-end" });
assert.ok(scene.log.some(row => row.type === "attack.pending") && scene.log.some(row => row.type === "reaction.respond"), "The stress path records Attack and Reaction events");
assert.ok(scene.log.some(row => row.type === "damage.apply") && scene.log.some(row => row.type === "effect.apply"), "The stress path records damage and Effect events");

console.log("LionWing alpha stress: hero creation, canonical AP, Fodder, Compound parts, base Attacks, Reactions, damage, Effects, and Round reset passed");
