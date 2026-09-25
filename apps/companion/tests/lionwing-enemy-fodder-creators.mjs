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

const alliedHound = scene("lionwing.npc.hound-master");
alliedHound.actors.push(actor("hound-fodder", "heroes", 1, 1, { kind: "crowd", profileId: null, hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0, summonerId: "source" }));
assert.equal(Engine.fodderMoveStatus(alliedHound, "hound-fodder").available, false, "allied Fodder waits for its side's Turn boundary");
const alliedHoundAfterTurn = Engine.dispatchMany(alliedHound, [{ id: "allied-hound-turn-end", type: "turn.end", actorId: "source", payload: {} }]).scene;
assert.equal(Engine.fodderMoveStatus(alliedHoundAfterTurn, "hound-fodder").remaining, 3, "canonical Hound Master grants three movement spaces to allied Fodder");
assert.equal(alliedHoundAfterTurn.pendingPrompt?.kind, "fodder-move-select", "allied Hound Master receives the Fodder movement prompt");
const alliedFodderChoice = Engine.respondRulePrompt(alliedHoundAfterTurn, data, { choice: "finish" });
assert.equal(alliedFodderChoice.ok, true, alliedFodderChoice.errors?.join(" "));
assert.equal(Engine.dispatchMany(alliedHoundAfterTurn, alliedFodderChoice.events).scene.pendingPrompt, null, "LionWing can finish the allied Fodder movement prompt");
const distantFodderScene = scene("lionwing.npc.hound-master");
distantFodderScene.spaces.push({ id: "annex", name: "Annex", width: 6, height: 6 });
distantFodderScene.actors.push(actor("distant-fodder", "heroes", 1, 1, { kind: "crowd", profileId: null, space: "annex", hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0 }));
const distantFodderTurn = Engine.dispatchMany(distantFodderScene, [{ id: "distant-fodder-turn-end", type: "turn.end", actorId: "source", payload: {} }]).scene;
assert.equal(distantFodderTurn.pendingPrompt, undefined, "Fodder in another space does not open a movement prompt");
assert.equal(distantFodderTurn.lionwing.lastActorId, "source", "Fodder in another space does not bypass LionWing Turn bookkeeping");
const distantFodderRoundSource = clone(distantFodderTurn);
distantFodderRoundSource.actors.filter(item => item.kind !== "crowd").forEach(item => { item.acted = true; });
const distantFodderRound = Engine.dispatchMany(distantFodderRoundSource, [{ id: "distant-fodder-round-end", type: "round.end", actorId: null, payload: {} }]).scene;
assert.equal(distantFodderRound.round, 2, "Fodder without an adjacent opponent does not bypass LionWing Round bookkeeping");
assert.equal(distantFodderRound.pendingPrompt, undefined, "Fodder without an adjacent opponent does not open a damage prompt");
const adjacentFodderRoundSource = clone(distantFodderRoundSource);
const adjacentFodder = adjacentFodderRoundSource.actors.find(item => item.id === "distant-fodder");
adjacentFodder.space = "main";
adjacentFodder.x = 4;
adjacentFodder.y = 3;
const adjacentFodderRound = Engine.dispatchMany(adjacentFodderRoundSource, [{ id: "adjacent-fodder-round-end", type: "round.end", actorId: null, payload: {} }]).scene;
assert.equal(adjacentFodderRound.round, 2);
assert.equal(adjacentFodderRound.pendingPrompt?.kind, "fodder-round-batch", "LionWing Round end offers the adjacent Fodder damage choice");
const focusedFodderSource = clone(adjacentFodderRoundSource);
const firstFodder = focusedFodderSource.actors.find(item => item.id === "distant-fodder");
Object.assign(firstFodder, { space: "main", x: 4, y: 3 });
const fragile = focusedFodderSource.actors.find(item => item.id === "opponent");
Object.assign(fragile, { hp: 2, x: 4, y: 2 });
focusedFodderSource.actors.push(actor("second-fodder", "heroes", 3, 2, { kind: "crowd", profileId: null, hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0 }));
focusedFodderSource.actors.push(actor("third-fodder", "heroes", 1, 3, { kind: "crowd", profileId: null, hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0 }));
focusedFodderSource.actors.push(actor("other-target", "enemies", 2, 3, { acted: true }));
const focusedWindow = Engine.dispatchMany(focusedFodderSource, [{ id: "focused-fodder-round", type: "round.end", payload: {} }]).scene;
const focusedChoice = Engine.respondRulePrompt(focusedWindow, data, { choice: "custom", assignments: { "distant-fodder": "opponent", "second-fodder": "opponent", "third-fodder": "other-target" } });
assert.equal(focusedChoice.ok, true, focusedChoice.errors?.join(" "));
const focusedResult = Engine.dispatchMany(focusedWindow, focusedChoice.events).scene;
assert.equal(focusedResult.actors.find(item => item.id === "opponent").knockedOut, true, "first Fodder hit defeats the fragile target");
assert.equal(focusedResult.actors.find(item => item.id === "other-target").hp, 18, "another target still takes damage from the same batch");
assert.ok(focusedResult.log.some(item => item.type === "damage.apply" && item.actorId === "second-fodder" && item.payload?.ignored), "later hit on the defeated target is logged as ignored");

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

const gluttonScene = scene("lionwing.npc.glutton", { hp: 10 });
gluttonScene.actors.push(actor("enemy-fodder", "enemies", 3, 3, { kind: "crowd", profileId: null, hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0 }));
const gluttonAfterKill = Engine.dispatchMany(gluttonScene, [{ id: "glutton-fodder-kill", type: "damage.apply", actorId: "source", payload: { targetId: "enemy-fodder", amount: 1, sourceActionId: "manual-glutton-hit" } }]).scene;
assert.equal(gluttonAfterKill.actors.find(item => item.id === "source").hp, 15, "canonical Glutton heals 3 + Tier after knocking out Fodder");
assert.equal(gluttonAfterKill.actors.find(item => item.id === "source").ruleState.gluttonConsumed, 1, "Glutton tracks passive triggers for Regurgitate");
const regurgitateId = "lionwing.npc.glutton.regurgitate";
const regurgitateRule = Engine.availableEnemyRules(gluttonAfterKill, data, "source").find(item => item.id === regurgitateId);
assert.equal(regurgitateRule.automation, "full");
assert.equal(regurgitateRule.crowdSummon.count, 1);
const regurgitatePlan = prepare(gluttonAfterKill, regurgitateId, ["4,2"]);
assert.equal(regurgitatePlan.ok, true, regurgitatePlan.errors?.join(" "));
const regurgitated = commit(gluttonAfterKill, regurgitatePlan);
assert.equal(fodder(regurgitated).filter(item => item.team === "heroes").length, 1, "Regurgitate creates the tracked number of allied Fodder Zones");
assert.equal(regurgitated.actors.find(item => item.id === "opponent").effects.includes("negative.подброшен"), true, "Regurgitate Launches an occupant under a placed Zone");

const giantSummoner = scene("lionwing.npc.javelin");
giantSummoner.actors[0].x = 0;
giantSummoner.actors[0].y = 0;
giantSummoner.actors[0].occupiedWidth = 2;
giantSummoner.actors[0].occupiedHeight = 2;
assert.equal(Engine.modifierRangeDistance(giantSummoner, giantSummoner.actors[0], { space: "main", x: 5, y: 0 }), 4, "range starts at the nearest occupied cell");
assert.equal(prepare(giantSummoner, "lionwing.npc.javelin.call", ["5,0", "0,2", "1,2"]).ok, true, "a large summoner can place Fodder at range 4 from its footprint");

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

const damagedBroodmotherResult = Engine.dispatchMany(scene("lionwing.npc.broodmother"), [{
  id: "broodmother-damage", type: "damage.apply", actorId: "opponent", payload: { targetId: "source", amount: 1 },
}]);
const damagedBroodmother = damagedBroodmotherResult.scene;
assert.equal(damagedBroodmother.pendingPrompt?.kind, "enemy-broodmother-fodder", "positive damage offers the passive at the permitted Fodder count");
const broodChoice = damagedBroodmother.pendingPrompt.options.find(option => option.startsWith("cell:"));
const broodPlan = Engine.respondRulePrompt(damagedBroodmother, data, { choice: broodChoice, role: "narrator" });
assert.equal(broodPlan.ok, true, broodPlan.errors?.join(" "));
const broodAfter = commit(damagedBroodmother, broodPlan);
assert.equal(fodder(broodAfter).length, 1, "Broodmother creates one allied Fodder without AP cost");
assert.equal(fodder(broodAfter)[0].sourceActionId, "lionwing.npc.broodmother.passive");
assert.throws(() => Engine.dispatchMany(broodAfter, broodPlan.events), /.+/, "a passive response cannot spawn twice");
const forgedBrood = clone(broodAfter);
const fake = clone(broodPlan.events.find(event => event.type === "actor.spawn"));
fake.payload.actor.id = "forged-broodmother-fodder";
fake.payload.actor.x = 5;
fake.payload.actor.y = 5;
assert.throws(() => Engine.dispatchMany(forgedBrood, [fake]), /.+/, "a forged destination cannot reuse a valid damage receipt");
const crowdedBrood = scene("lionwing.npc.broodmother");
for (let index = 0; index < 10; index += 1) crowdedBrood.actors.push(actor(`fodder-${index}`, "heroes", index % 6, Math.floor(index / 6), { kind: "crowd", profileId: null, hp: 1, maxHp: 1 }));
assert.equal(Engine.dispatchMany(crowdedBrood, [{ id: "crowded-brood-damage", type: "damage.apply", actorId: "opponent", payload: { targetId: "source", amount: 1 } }]).scene.pendingPrompt, undefined, "the passive stops above 5 + 2 Tier Fodder Zones");

const necromancer = scene("lionwing.npc.necromancer");
const callDeadId = "lionwing.npc.necromancer.call-the-dead";
const callDead = Engine.availableEnemyRules(necromancer, data, "source").find(rule => rule.id === callDeadId);
assert.equal(callDead?.crowdSummon?.count, 3, "Call The Dead creates 1 + Tier Fodder");
const callDeadPlan = prepare(necromancer, callDeadId, ["1,1", "2,1", "3,1"]);
assert.equal(callDeadPlan.ok, true, callDeadPlan.errors?.join(" "));
assert.throws(() => Engine.dispatchMany(necromancer, [callDeadPlan.events[0], callDeadPlan.events.find(event => event.type === "actor.spawn")]), /оплаченному Призыву/, "a prepared Call cannot create free Corpse Fodder without AP spend");
const calledDead = commit(necromancer, callDeadPlan);
assert.equal(fodder(calledDead).length, 3);
assert.ok(fodder(calledDead).every(item => item.crowdSubtype === "corpse"), "all summoned Fodder retain Corpse provenance");
assert.equal(Engine.availableEnemyRules(calledDead, data, "source").find(rule => rule.id === callDeadId).crowdSummon.count, 2, "Call The Dead diminishes on reuse within the Round");
const enemyKnockout = Engine.dispatchMany(calledDead, [{ id: "necromancer-enemy-knockout", type: "damage.apply", actorId: "source", payload: { targetId: "opponent", amount: 99 } }]).scene;
const corpseMarker = enemyKnockout.markers.find(marker => marker.kind === "corpse" && marker.metadata?.victimActorId === "opponent");
assert.ok(corpseMarker, "an opponent defeated while Necromancer is deployed leaves a Corpse");
assert.equal(`${corpseMarker.x},${corpseMarker.y}`, "4,2", "the Corpse stays at the knockout space");
assert.throws(() => Engine.dispatchMany(enemyKnockout, [{ type: "marker.create", actorId: "source", payload: { id: "forged-corpse", space: "main", x: 0, y: 0, markerKind: "corpse", ruleId: "lionwing.npc.necromancer.passive", sourceActorId: "source", sourceLossPolicy: "detach", ownerActorId: "source", duration: "scene", metadata: { victimActorId: "opponent", knockoutEventId: "necromancer-enemy-knockout" } } }]), /.+/, "a forged Corpse cannot reuse a knockout receipt");

const danseId = "lionwing.npc.necromancer.the-danse-macabre";
const danseCorpses = Engine.availableEnemyRules(enemyKnockout, data, "source").find(rule => rule.id === danseId).corpses;
assert.ok(danseCorpses.some(item => item.corpseId === `marker:${corpseMarker.id}`), "defeated opponent is offered for revival");
const danseChoices = [
  { corpseId: `marker:${corpseMarker.id}`, profileId: "lionwing.npc.bruiser" },
  { corpseId: danseCorpses.find(item => item.corpseId.startsWith("actor:"))?.corpseId, profileId: "lionwing.npc.ranger" },
];
const danse = Engine.prepareEnemyRule(enemyKnockout, data, { actorId: "source", ruleId: danseId, options: { revivals: danseChoices } });
assert.equal(danse.ok, true, danse.errors?.join(" "));
const forgedActionDanse = clone(danse.events[0]); forgedActionDanse.id = "forged-action-danse"; forgedActionDanse.payload.kind = "action";
assert.throws(() => Engine.dispatch(enemyKnockout, forgedActionDanse), /тип действия/, "Danse cannot pretend to be an ordinary Action to avoid Ace limits");
const noTensionDanse = clone(enemyKnockout); noTensionDanse.tension = 1;
assert.throws(() => Engine.dispatch(noTensionDanse, danse.events[0]), /Напряжение/, "Danse requires its canonical Tension threshold at the writer");
const usedTrumpDanse = clone(enemyKnockout); usedTrumpDanse.actors[0].usedTrump = true;
assert.throws(() => Engine.dispatch(usedTrumpDanse, danse.events[0]), /Козырь/, "Danse cannot run after an Ace was spent");
const danced = commit(enemyKnockout, danse);
const revived = danced.actors.filter(item => item.sourceActionId === danseId);
assert.equal(revived.length, 2, "Danse revives exactly two chosen Corpses");
assert.deepEqual(clone(revived.map(item => item.profileId).sort()), ["lionwing.npc.bruiser", "lionwing.npc.ranger"]);
assert.ok(revived.every(item => item.tier === 1 && item.summonerId === "source" && item.team === "heroes"));
assert.equal(danced.markers.some(item => item.id === corpseMarker.id), false, "used Corpse marker is consumed");
assert.equal(danced.actors.some(item => item.id === danseChoices[1].corpseId.slice(6)), false, "used Corpse Fodder is consumed");
assert.equal(danced.actors.find(item => item.id === "source").ap, 1, "Danse pays two AP once");
assert.equal(Engine.prepareEnemyRule(enemyKnockout, data, { actorId: "source", ruleId: danseId, options: { revivals: [danseChoices[0], danseChoices[0]] } }).ok, false, "one Corpse cannot be revived twice");
assert.equal(Engine.prepareEnemyRule(enemyKnockout, data, { actorId: "source", ruleId: danseId, options: { revivals: [{ ...danseChoices[0], profileId: "lionwing.npc.necromancer" }, danseChoices[1]] } }).ok, false, "revival profiles are restricted to the PDF list");
assert.throws(() => commit(danced, danse), /.+/, "Danse cannot replay the same corpses");
const partialDanse = Engine.dispatchMany(enemyKnockout, danse.events.slice(0,3).map((event,index) => ({ ...event, id: `partial-danse-${index}` }))).scene;
const forgedRevival = clone(danse.events.find(event => event.type === "actor.spawn"));
forgedRevival.id = "forged-danse-spawn";
forgedRevival.payload.actor.hp += 1;
assert.throws(() => Engine.dispatchMany(partialDanse, [forgedRevival]), /.+/, "a client cannot inflate a revived profile after paying and consuming a Corpse");
assert.throws(() => Engine.dispatchMany(partialDanse, [danse.events.at(-1)]), /.+/, "an incomplete Danse cannot resolve before both profiles spawn");

const builderArmy = scene("lionwing.npc.builder");
builderArmy.actors[0].team = "enemies";
builderArmy.spaces.push({ id: "annex", name: "Annex", width: 6, height: 6 });
builderArmy.objects.push(
  { id: "terrain-main", type: "terrain", label: "Obstacle", space: "main", cells: ["0,0", "1,0"], hidden: false },
  { id: "difficult-main", type: "difficult", label: "Rubble", space: "main", cells: ["1,0", "2,0"], hidden: true },
  { id: "high-main", type: "high", label: "High Ground", space: "main", cells: ["3,0"], hidden: false },
  { id: "low-annex", type: "low", label: "Low Ground", space: "annex", cells: ["1,1"], hidden: false },
  { id: "wall-ornament", type: "custom", label: "Wall Ornament", space: "main", cells: ["5,5"], hidden: false },
);
builderArmy.actors.push(
  actor("overlapped-character", "heroes", 3, 0, { kind: "hero", profileId: null }),
  actor("existing-allied-fodder", "enemies", 2, 0, { kind: "crowd", profileId: null, hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0, summonerId: "source" }),
);
const armyId = "lionwing.npc.builder.army-of-stone";
const armyAvailable = Engine.availableEnemyRules(builderArmy, data, "source").find(rule => rule.id === armyId);
assert.equal(armyAvailable?.automation, "full", "Army Of Stone is exposed as a full LionWing handler");
assert.equal(armyAvailable?.available, true, "actual Terrain across multiple spaces permits the Trump");
assert.deepEqual(clone(armyAvailable.armyOfStone), { terrainPieceCount: 4, cellCount: 5, fodderCreated: 4, fodderReused: 1 }, "overlapping Terrain is deduplicated by cell and allied Fodder is reused");
const armyPlan = Engine.prepareEnemyRule(builderArmy, data, { actorId: "source", ruleId: armyId });
assert.equal(armyPlan.ok, true, armyPlan.errors?.join(" "));
assert.deepEqual(clone(armyPlan.events.map(item => item.type)), ["enemy.action.prepare", "resource.spend", "terrain.convert-to-fodder", "turn.grant", "enemy.action.resolve"], "the Trump is one ordered transaction");
const armyAfter = commit(builderArmy, armyPlan);
assert.equal(armyAfter.actors.find(item => item.id === "source").ap, 2, "Army Of Stone costs exactly 2 AP");
assert.equal(armyAfter.tension, 4, "the Trump checks its Tension threshold without consuming Tension");
assert.deepEqual(clone(armyAfter.log.filter(item => ["enemy.action.resolve", "turn.grant", "terrain.convert-to-fodder", "resource.spend", "enemy.action.prepare"].includes(item.type)).map(item => item.type)), ["enemy.action.resolve", "turn.grant", "terrain.convert-to-fodder", "resource.spend", "enemy.action.prepare"], "the committed receipt is validated in newest-first scene.log order");
assert.equal(armyAfter.actors.find(item => item.id === "source").extraTurns, 1, "Builder immediately receives one extra Turn");
assert.equal(armyAfter.objects.some(item => ["terrain", "difficult", "high", "low"].includes(item.type)), false, "all Terrain pieces in every space are consumed");
assert.ok(armyAfter.objects.some(item => item.id === "wall-ornament"), "unrelated custom object with wall in its label remains untouched");
assert.equal(armyAfter.actors.find(item => item.id === "overlapped-character").knockedOut, false, "Terrain conversion can overlap ordinary characters");
assert.equal(fodder(armyAfter).filter(item => item.space === "main" && item.x === 2 && item.y === 0).length, 1, "one existing allied Fodder remains exactly one Zone");
const newArmyFodder = fodder(armyAfter).filter(item => item.sourceActionId === armyId);
assert.equal(newArmyFodder.length, 4, "Army creates one Fodder for each remaining unique Terrain cell");
assert.ok(newArmyFodder.every(item => item.team === "enemies" && item.summonerId === "source"), "Army Fodder inherits the Builder's team and source");
assert.ok(newArmyFodder.some(item => item.space === "annex"), "conversion includes terrain on non-active spaces");
assert.equal(Engine.availableEnemyRules(clone(armyAfter), data, "source").find(rule => rule.id === armyId).available, false, "reload retains Trump use and cannot replay Army Of Stone");
assert.throws(() => Engine.dispatchMany(armyAfter, armyPlan.events), /.+/, "a committed Army cannot replay after reload");
assert.throws(() => Engine.dispatchMany(builderArmy, armyPlan.events.filter(item => item.type !== "terrain.convert-to-fodder")), /.+/, "the engine rejects a partial transaction before payment");
const forgedArmy = clone(armyPlan.events).map(item => ({ ...item, payload: { ...item.payload } }));
forgedArmy[2].payload.token = "forged-token";
assert.throws(() => Engine.dispatchMany(builderArmy, forgedArmy), /.+/, "the engine rejects a forged conversion receipt before payment");
assert.throws(() => Engine.dispatchMany(builderArmy, [armyPlan.events[2]]), /.+/, "a converter event alone cannot mint allied Fodder");
const collidingArmy = clone(builderArmy);
const armyToken = armyPlan.events[0].payload.armyOfStone.token;
const collidingId = `as-${armyToken.replace(/[^a-zA-Z0-9_-]/g, "").slice(-48)}-0`;
collidingArmy.actors.push(actor(collidingId, "heroes", 6, 6));
assert.throws(() => Engine.dispatchMany(collidingArmy, armyPlan.events), /идентификатором/, "generated Fodder cannot overwrite an existing actor ID");
assert.equal(collidingArmy.actors.find(item => item.id === "source").ap, 4, "a generated-ID conflict leaves the Builder's AP untouched");
const wallBlockedArmy = clone(builderArmy);
wallBlockedArmy.walls.push({ id: "real-wall", space: "main", a: "0,0", b: "1,0" });
const wallBlockedRule = Engine.availableEnemyRules(wallBlockedArmy, data, "source").find(rule => rule.id === armyId);
assert.equal(wallBlockedRule.available, false, "a real scene wall makes conversion ambiguous and blocks Army Of Stone");
assert.match(wallBlockedRule.reason, /Стены/);
const wallBlockedPlan = Engine.prepareEnemyRule(wallBlockedArmy, data, { actorId: "source", ruleId: armyId });
assert.equal(wallBlockedPlan.ok, false, "wall ambiguity cancels before preparing the action");
assert.deepEqual(clone(wallBlockedPlan.events), []);
assert.equal(wallBlockedArmy.actors.find(item => item.id === "source").ap, 4, "wall block spends no AP");
assert.equal(wallBlockedArmy.tension, 4, "wall block spends no Tension");
const lowTensionArmy = clone(builderArmy);
lowTensionArmy.tension = 1;
const lowTensionRule = Engine.availableEnemyRules(lowTensionArmy, data, "source").find(rule => rule.id === armyId);
assert.equal(lowTensionRule.available, false, "Army Of Stone requires the canonical 2-Tension threshold");
assert.match(lowTensionRule.reason, /Напряжение 2/);
assert.equal(Engine.prepareEnemyRule(lowTensionArmy, data, { actorId: "source", ruleId: armyId }).ok, false, "low Tension rejects Army before preparing a transaction");
assert.equal(lowTensionArmy.actors.find(item => item.id === "source").ap, 4, "low Tension spends no AP");
assert.equal(lowTensionArmy.tension, 1, "low Tension remains unchanged on rejection");
const hostileArmy = clone(builderArmy);
hostileArmy.actors.push(actor("hostile-fodder-on-terrain", "heroes", 1, 1, { kind: "crowd", profileId: null, space: "annex", hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0 }));
hostileArmy.objects.push({ id: "contested-low", type: "low", label: "Contested", space: "annex", cells: ["1,1"], hidden: false });
assert.equal(Engine.prepareEnemyRule(hostileArmy, data, { actorId: "source", ruleId: armyId }).ok, false, "hostile Fodder conflict blocks conversion before payment");
assert.equal(hostileArmy.actors.find(item => item.id === "source").ap, 4, "conflicting Fodder spends no AP");
assert.equal(hostileArmy.tension, 4, "conflicting Fodder spends no Tension");

const staleArmy = clone(builderArmy);
assert.throws(() => Engine.dispatchMany(staleArmy, armyPlan.events.map((event, index) => ({ ...event, id: `stale-army-${index}` })), { expectedVersion: staleArmy.version + 1 }), error => /Конфликт версии Сцены/.test(error.message), "Army rejects a stale scene version before the transaction");
assert.equal(staleArmy.actors.find(item => item.id === "source").ap, 4, "stale Army does not spend AP");
assert.equal(fodder(staleArmy).length, fodder(builderArmy).length, "stale Army does not create or remove Fodder");
assert.equal(staleArmy.objects.filter(item => ["terrain", "difficult", "high", "low"].includes(item.type)).length, 4, "stale Army does not consume Terrain");

const javelinRange = scene("lionwing.npc.javelin");
javelinRange.actors = [
  actor("source", "enemies", 2, 2, { profileId: "lionwing.npc.javelin" }),
  actor("nearby-target", "heroes", 3, 2),
  actor("remote-target", "heroes", 5, 2),
  actor("range-fodder", "enemies", 2, 1, { kind: "crowd", profileId: null, hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0 }),
];
const crushingImpact = "lionwing.npc.javelin.crushing-impact";
const crushingImpactRule = Engine.availableEnemyRules(javelinRange, data, "source").find(rule => rule.id === crushingImpact);
assert.deepEqual(clone(crushingImpactRule.area), [2, 2], "Crushing Impact keeps its canonical 2×2 area");
assert.equal(crushingImpactRule.areaAnchor, "self", "Crushing Impact remains anchored on the Javelin");
const remoteCrushingImpact = Engine.prepareEnemyRule(javelinRange, data, { actorId: "source", ruleId: crushingImpact, targetIds: ["remote-target"], roll: { formula: "5D6", rolls: [6, 5, 4, 1, 1], successes: 3, crits: 1 } });
assert.equal(remoteCrushingImpact.ok, false, "an eligible adjacent Fodder does not turn self-anchored Crushing Impact into a remote Attack");
assert.match(remoteCrushingImpact.errors.join(" "), /области/);
assert.equal(fodder(javelinRange).some(item => item.id === "range-fodder"), true, "the unautomated optional range passive does not consume Fodder as a side effect");
const javelinUi = fs.readFileSync(new URL("../scene-ui.js", import.meta.url), "utf8");
assert.match(javelinUi, /пассив дальности не автоматизирован; зона 2×2 остаётся размещённой на самом NPC/, "the UI discloses Javelin's unautomated passive and canonical area boundary");

console.log("LionWing Fodder creators OK");
