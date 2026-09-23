import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "lionwing-table-data.js", "logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const Engine = loadSceneEngine(context);
const data = context.window.DAWN_DATA;
const clone = value => JSON.parse(JSON.stringify(value));
const actor = (id, team, x, y, extra = {}) => ({
  id, name: id, kind: "enemy", rulesEdition: "lionwing", team, space: "main", x, y,
  hp: 20, maxHp: 20, ap: 4, baseAp: 4, focus: 0, tier: 2, speed: 3, armor: 0, evasion: 0,
  effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, ...extra,
});
const scene = (profileId, extra = {}) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "source", tension: 4,
  spaces: [{ id: "main", name: "Main", width: 6, height: 6 }],
  actors: [actor("source", "heroes", 2, 2, { profileId, ...extra }), actor("friend", "heroes", 3, 2), actor("opponent", "enemies", 4, 2)],
  objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] }, targetIds: [], targetCells: [],
  reminders: [], rollFeed: [], log: [], triggerQueue: [], lionwing: { entities: {}, entityReceipts: {} },
});
let serial = 0;
const prepare = (state, id, cells) => Engine.prepareEnemyRule(state, data, { actorId: "source", ruleId: id, options: { cells } });
const commit = (state, plan) => Engine.dispatchMany(state, plan.events.map((event, index) => ({ ...event, id: `fodder-${serial++}-${index}` })), { expectedVersion: state.version }).scene;
const fodder = state => state.actors.filter(item => item.kind === "crowd" && !item.knockedOut);

for (const profile of ["javelin", "broodmother", "glutton"]) {
  const id = `lionwing.npc.${profile}.call`, initial = scene(`lionwing.npc.${profile}`);
  const available = Engine.availableEnemyRules(initial, data, "source").find(rule => rule.id === id);
  assert.equal(available?.automation, "full", `${profile} Call uses the canonical LionWing handler`);
  assert.equal(available.crowdSummon.count, 3);
  assert.equal(available.crowdSummon.range, 4);
  const firstCells = ["2,2", "3,2", "4,2"];
  assert.equal(prepare(initial, id, firstCells.slice(0, 2)).ok, false, "partial field cancels without payment");
  assert.equal(prepare(initial, id, ["2,2", "3,2", "0,5"]).ok, false, "range checked for each cell");
  const first = prepare(initial, id, firstCells);
  assert.equal(first.ok, true, first.errors?.join(" "));
  assert.equal(initial.actors[0].ap, 4, "prepare does not pay");
  const afterFirst = commit(initial, first);
  assert.equal(afterFirst.actors[0].ap, 3, "Call pays exactly once");
  assert.equal(fodder(afterFirst).length, 3);
  assert.ok(fodder(afterFirst).every(item => item.summonerId === "source" && item.team === "heroes" && item.sourceActionId === id), "created Fodder retains its source and allied side");
  assert.equal(Engine.availableEnemyRules(afterFirst, data, "source").find(rule => rule.id === id).crowdSummon.count, 2, "count drops only after commit");
  const second = prepare(afterFirst, id, ["1,2", "2,1"]);
  assert.equal(second.ok, true, second.errors?.join(" "));
  const afterSecond = commit(afterFirst, second);
  assert.equal(fodder(afterSecond).length, 5);
  assert.equal(afterSecond.actors[0].ap, 2);
  const restored = clone(afterSecond);
  assert.equal(Engine.availableEnemyRules(restored, data, "source").find(rule => rule.id === id).crowdSummon.count, 1, "reload preserves round use count");
  assert.throws(() => commit(afterSecond, first), /.+/, "stale replay cannot reapply an old Call");
}

const swarm = scene("lionwing.npc.swarm");
const swarmId = "lionwing.npc.swarm.call";
const swarmRule = Engine.availableEnemyRules(swarm, data, "source").find(rule => rule.id === swarmId);
assert.equal(swarmRule.automation, "full");
assert.deepEqual(clone(swarmRule.crowdSummon), { count: 3, edge: true, range: null });
assert.equal(prepare(swarm, swarmId, ["1,1", "0,2", "5,2"]).ok, false, "Swarm Call requires board-edge cells");
const swarmAfter = commit(swarm, prepare(swarm, swarmId, ["0,2", "5,2", "0,3"]));
assert.equal(Engine.availableEnemyRules(swarmAfter, data, "source").find(rule => rule.id === swarmId).crowdSummon.count, 2, "Swarm Call diminishes on reuse in one Round");
assert.equal(prepare(swarmAfter, swarmId, ["5,3", "0,4"]).ok, true, "Swarm may call again with the diminished count");

for (const [profile, id, count] of [
  ["bodyguards", "lionwing.npc.bodyguards.reinforcements", 5],
  ["swarm", "lionwing.npc.swarm.reinforcements", 6],
]) {
  const initial = scene(`lionwing.npc.${profile}`);
  const rule = Engine.availableEnemyRules(initial, data, "source").find(item => item.id === id);
  assert.equal(rule.crowdSummon.count, count, `${profile} Ace uses exact PDF count at Tier 2`);
  const cells = ["0,0", "1,0", "2,0", "3,0", "4,0", "5,0"].slice(0, count);
  const plan = prepare(initial, id, cells);
  assert.equal(plan.ok, true, plan.errors?.join(" "));
  assert.ok(plan.events.some(event => event.type === "turn.grant"), "extra Turn is part of the same committed action");
  assert.equal(fodder(commit(initial, plan)).length, count);
}

console.log("LionWing Fodder creators OK");
