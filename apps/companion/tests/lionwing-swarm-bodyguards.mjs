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
  hp: 12, maxHp: 12, ap: 3, baseAp: 3, focus: 0, tier: 2, speed: 3, armor: 0, evasion: 0,
  effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, ruleState: {},
  ...extra,
});
const scene = ({ profileId = "lionwing.npc.bodyguards", tier = 2, team = "enemy", ownerCell = [5, 5], actors = [] } = {}) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "owner", tension: 0,
  spaces: [{ id: "main", name: "Main", width: 8, height: 8, mode: "standard" }],
  actors: [actor("owner", team, ...ownerCell, { profileId, tier, hp: 1, maxHp: 1 }), ...actors],
  objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] }, targetIds: [], targetCells: [],
  reminders: [], rollFeed: [], log: [], triggerQueue: [], lionwing: { entities: {}, entityReceipts: {} },
});
let serial = 0;
const stamp = events => events.map((event, index) => ({ ...event, id: event.id || `sw-bg-${serial++}-${index}` }));
const commit = (current, events) => Engine.dispatchMany(current, stamp(events), { expectedVersion: current.version }).scene;
const deploy = current => {
  const owner = current.actors.find(item => item.id === "owner"), prepared = Engine.prepareEnemyDeployment(current, owner);
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  Object.assign(owner, prepared.owner);
  current.actors.push(...prepared.zones);
  return current;
};
const zone = (id, team, x, y, ownerId = null) => actor(id, team, x, y, {
  kind: "crowd", crowdType: "mob", crowdSubtype: null, profileId: null, hp: 1, maxHp: 1, ap: 0, baseAp: 0,
  speed: 0, acted: true, summonerId: ownerId,
});

// Deployment replacement applies to both profiles and both sides, creates 4 + Tier unique Fodder Zones,
// and keeps the original profile actor as an off-board turn owner.
for (const [profileId, team] of [["lionwing.npc.bodyguards", "enemy"], ["lionwing.npc.bodyguards", "hero"], ["lionwing.npc.swarm", "enemy"], ["lionwing.npc.swarm", "hero"]]) {
  const initial = deploy(scene({ profileId, team, tier: 2 })), owner = initial.actors.find(item => item.id === "owner"), zones = initial.actors.filter(item => item.kind === "crowd");
  initial.actors.push(actor("mover", team === "enemy" ? "hero" : "enemy", 0, 0));
  assert.equal(zones.length, 6, `${profileId} replaces deployment with 4 + Tier zones`);
  assert.equal(new Set(zones.map(item => item.id)).size, 6, "deployment zones have unique IDs");
  assert.equal(new Set(zones.map(item => `${item.space}:${item.x},${item.y}`)).size, 6, "deployment zones occupy distinct cells");
  assert.ok(zones.every(item => item.team === team && item.deploymentFodderOwnerId === owner.id && item.summonerId === owner.id), "zones are linked to their owner and side");
  assert.equal(owner.deploymentProxy, true, "profile remains as a turn owner");
  assert.equal(owner.speed, 0, "off-board deployment owner has no movement speed");
  const step = Engine.availableActions(initial, data, owner.id).find(item => item.id === "action.движение.шаг");
  assert.equal(step?.available, false, "off-board deployment owner cannot use its base Step");
  assert.match(step?.reason || "", /не находится на Поле/);
  const preparedStep = Engine.prepareAction(initial, data, { actorId: owner.id, actionId: "action.движение.шаг" });
  assert.equal(preparedStep.ok, false, "the normal preparation route rejects an off-board Step");
  assert.ok(Engine.availableActions(initial, data, owner.id).filter(item => item.id.startsWith("action.атаки.")).every(item => !item.available), "off-board profile cannot use generic base attacks");
  assert.equal(Engine.prepareAction(initial, data, { actorId: owner.id, actionId: "action.атаки.стычка" }).ok, false, "normal preparation also rejects an off-board attack");
  const profileRules = Engine.availableEnemyRules(initial, data, owner.id).map(item => item.id);
  const expectedRules = profileId.endsWith("bodyguards")
    ? ["lionwing.npc.bodyguards.brace", "lionwing.npc.bodyguards.behind-me"]
    : ["lionwing.npc.swarm.call", "lionwing.npc.swarm.tear"];
  for (const ruleId of expectedRules) assert.ok(profileRules.includes(ruleId), `${profileId} retains profile rule ${ruleId}`);
  assert.throws(() => commit(initial, [{ type: "actor.move", actorId: owner.id, payload: { space: owner.space, x: owner.x, y: owner.y } }]), /не находится на Поле/);
  assert.equal(Engine.effectTargetingStatus(initial, "mover", owner.id).available, false, "off-board owner cannot be targeted");
  assert.throws(() => commit(initial, [{ type: "effect.apply", actorId: "mover", payload: { targetId: owner.id, effect: "negative.испуган" } }]), /не находится на поле/);
  assert.throws(() => commit(initial, [{ type: "lionwing.command", actorId: "mover", payload: { kind: "effect", targetId: owner.id, effect: "negative.испуган" } }]), /не находится на поле/);
  assert.throws(() => commit(initial, [{ type: "attack.pending", actorId: "mover", payload: { targetIds: [owner.id] } }]), /не находится на поле/);
  assert.throws(() => commit(initial, [{ type: "lionwing.command", actorId: "mover", payload: { kind: "attack", targetIds: [owner.id] } }]), /не находится на поле/);
  assert.equal(Engine.effectCellOccupancyStatus(initial, "mover", { space: owner.space, x: owner.x, y: owner.y }).available, true, "off-board owner does not block a cell");
  assert.ok(Engine.projectScene(initial, { role: "owner" }).actors.some(item => item.id === owner.id), "proxy remains available in the turn roster snapshot");
}

// Insufficient space reports a manual placement fallback rather than silently deploying an incomplete passive.
const cramped = scene({ profileId: "lionwing.npc.swarm", ownerCell: [0, 0] });
cramped.spaces[0].width = 2; cramped.spaces[0].height = 2;
const noRoom = Engine.prepareEnemyDeployment(cramped, cramped.actors[0]);
assert.equal(noRoom.ok, false);
assert.match(noRoom.errors.join(" "), /разместите зоны вручную/i);

// The owner, Fodder identities, links, and active Brace survive the actual app persistence normalizer and network snapshot path.
const appCore = fs.readFileSync(new URL("../app-core.js", import.meta.url), "utf8");
const persistenceSource = appCore.slice(appCore.indexOf("function blankScene"), appCore.indexOf("function addEnemyDeploymentPassives"));
const persistence = { console, SceneEngine: Engine };
vm.createContext(persistence);
vm.runInContext(`const uid=()=>"test-id";const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));function cleanArray(value){return Array.isArray(value)?value.filter(item=>typeof item==="string"):[]}\n${persistenceSource}`, persistence);
const normalize = raw => vm.runInContext(`normalizeScene(${JSON.stringify(raw)})`, persistence);
const network = { console, Date, setTimeout, clearTimeout, structuredClone };
network.globalThis = network; network.window = network; network.normalizeScene = normalize;
vm.createContext(network);
vm.runInNewContext(fs.readFileSync(new URL("../network-v2.js", import.meta.url), "utf8"), network);

const deployedBodyguards = deploy(scene({ profileId: "lionwing.npc.bodyguards" }));
const sourceIds = deployedBodyguards.actors.filter(item => item.kind === "crowd").map(item => item.id);
deployedBodyguards.actors.push(actor("hero", "hero", 0, 0), zone("friendly-a", "enemy", 1, 1), zone("friendly-b", "enemy", 2, 1), zone("friendly-c", "enemy", 3, 1), zone("opposing-fodder", "hero", 4, 1));
const bracePrompt = Engine.prepareEnemyRule(deployedBodyguards, data, { actorId: "owner", ruleId: "lionwing.npc.bodyguards.brace" });
assert.equal(bracePrompt.ok, true, bracePrompt.errors?.join(" "));
const promptScene = commit(deployedBodyguards, bracePrompt.events);
const chosenLine = promptScene.pendingPrompt.options.find(option => option === "line:friendly-a,friendly-b,friendly-c");
assert.ok(chosenLine, "Bodyguards can Brace a line of Fodder Zones on their own side, regardless of creator");
assert.ok(!promptScene.pendingPrompt.options.some(option => option.includes("opposing-fodder")), "enemy-side Fodder cannot complete or extend the Bodyguards' line");
const response = Engine.respondRulePrompt(promptScene, data, { choice: chosenLine, role: "narrator" });
assert.equal(response.ok, true, response.errors?.join(" "));
let braced = commit(promptScene, response.events);
const bracedOwner = braced.actors.find(item => item.id === "owner"), chosenIds = bracedOwner.ruleState.bodyguardsBrace.zoneIds;
assert.equal(bracedOwner.ap, 2, "Brace costs one Action Point");
assert.ok(chosenIds.every(id => id.startsWith("friendly-")), "the braced line contains only Bodyguards-side Fodder");
assert.equal(Engine.bodyguardsBraceIntact(braced, bracedOwner), true);
assert.equal(Engine.effectCellOccupancyStatus(braced, "owner", { space: "main", x: 2, y: 1 }).available, false, "the allied line becomes impassable");
const saved = normalize(braced);
const restoredOwner = saved.actors.find(item => item.id === "owner");
assert.equal(restoredOwner.deploymentProxy, true, "local reload retains the invisible owner");
assert.deepEqual(clone(restoredOwner.deploymentFodderIds), clone(sourceIds), "local reload retains the passive's unique Fodder links");
assert.deepEqual(clone(restoredOwner.ruleState.bodyguardsBrace.zoneIds), clone(chosenIds), "local reload retains the active Brace line");
assert.ok(saved.actors.some(item => item.id === "friendly-a" && item.team === "enemy"), "local reload retains the allied line zones");
const wire = network.DAWN_NETWORK_V2.networkSceneState(braced), remote = normalize(wire);
assert.equal(remote.actors.find(item => item.id === "owner").deploymentProxy, true, "network snapshot preserves off-board turn owner");
assert.deepEqual(clone(remote.actors.find(item => item.id === "owner").ruleState.bodyguardsBrace.zoneIds), clone(chosenIds), "network snapshot preserves Brace state");

// The line remains braced when it moves together, then automatically clears when one Zone breaks it.
const intactMoved = clone(braced), ids = intactMoved.actors.find(item => item.id === "owner").ruleState.bodyguardsBrace.zoneIds;
for (const id of ids) { const item = intactMoved.actors.find(candidate => candidate.id === id); item.x += 1; }
assert.equal(Engine.bodyguardsBraceIntact(intactMoved, intactMoved.actors.find(item => item.id === "owner")), true, "moving the complete Fodder line together does not break it");
const turnEnded = commit(braced, [{ type: "turn.end", actorId: "owner", payload: {} }]);
assert.equal(turnEnded.pendingPrompt?.kind, "fodder-move-select", "the normal post-turn Fodder movement workflow remains available");
const moverId = "friendly-b", mover = turnEnded.actors.find(item => item.id === moverId);
const assignments = Object.fromEntries(turnEnded.pendingPrompt.context.remainingTargetIds.map(id => {
  const item = turnEnded.actors.find(candidate => candidate.id === id);
  return [id, id === moverId ? `${item.x},${item.y + 2}` : `${item.x},${item.y}`];
}));
const movePlan = Engine.respondRulePrompt(turnEnded, data, { choice: "custom", assignments, role: "narrator" });
assert.equal(movePlan.ok, true, movePlan.errors?.join(" "));
const moved = commit(turnEnded, movePlan.events);
assert.equal(moved.actors.find(item => item.id === "owner").ruleState.bodyguardsBrace, null, "moving a Zone out of the line automatically clears Brace");
assert.equal(Engine.effectCellOccupancyStatus(moved, "owner", { space: "main", x: 2, y: 1 }).available, true, "broken line no longer blocks movement");
const knockoutBreak = commit(braced, [{ type: "damage.apply", actorId: "hero", payload: { targetId: ids[0], amount: 1, sourceActionId: "test" } }]);
assert.equal(knockoutBreak.actors.find(item => item.id === "owner").ruleState.bodyguardsBrace, null, "Knocking Out a line Zone also clears Brace");
assert.equal(knockoutBreak.actors.find(item => item.id === ids[0]).knockedOut, true, "the damage event actually knocks out the Fodder Zone");
const staleOnReload = normalize(knockoutBreak);
assert.equal(staleOnReload.actors.find(item => item.id === "owner").ruleState.bodyguardsBrace, null, "reload does not restore a broken Brace line");
const explicitKnockoutBreak = commit(braced, [{ type: "actor.knockout", actorId: "hero", payload: { targetId: ids[1] } }]);
assert.equal(explicitKnockoutBreak.actors.find(item => item.id === "owner").ruleState.bodyguardsBrace, null, "an explicit Fodder Knockout also clears Brace");

// Event authority rejects forged Brace state and direct attacks on either deployment proxy.
assert.throws(() => commit(braced, [{ type: "actor.knockout", actorId: "hero", payload: { targetId: "owner" } }]), /Некорректное выведение из строя/);
assert.throws(() => commit(braced, [{ type: "damage.apply", actorId: "hero", payload: { targetId: "owner", amount: 1 } }]), /нельзя атаковать до разрешения его Пассивa/);
const forgedBrace = clone(braced);
assert.throws(() => commit(forgedBrace, [{ type: "actor.state", actorId: "owner", payload: { key: "bodyguardsBrace", value: { zoneIds: ["deployment-owner-1", "deployment-owner-2", "deployment-owner-3"] }, sourceActionId: "lionwing.npc.bodyguards.brace" } }]), /Укрепление должно быть подтверждено|Событие actor.state не перенесено в LionWing/);
assert.throws(() => commit(braced, [{ type: "actor.state", actorId: "owner", payload: { key: "bodyguardsBrace", value: null, sourceActionId: "lionwing.npc.bodyguards.brace", automatic: true, boundaryEventId: "forged-boundary" } }]), /Снять Укрепление можно только автоматически|Событие actor.state не перенесено в LionWing/);
const mixedLine = scene({ actors: [zone("friendly-mixed-a", "enemy", 2, 1), zone("friendly-mixed-b", "enemy", 3, 1), zone("enemy-mixed-c", "hero", 4, 1)] });
assert.equal(Engine.bodyguardsBraceLines(mixedLine, mixedLine.actors[0]).length, 0, "a mixed-team line cannot activate Brace even when two Zones are allied");
const noBraceOnMixedLine = Engine.prepareEnemyRule(mixedLine, data, { actorId: "owner", ruleId: "lionwing.npc.bodyguards.brace" });
assert.equal(noBraceOnMixedLine.ok, false, "Bodyguards cannot choose a mixed-team line for Brace");

// Bodyguards waits for all non-Fodder characters on both sides; Swarm waits only for its opponents.
const guard = deploy(scene({ profileId: "lionwing.npc.bodyguards", actors: [actor("hero", "hero", 0, 0), actor("opponent", "enemy", 7, 7)] }));
let afterOpponentKo = commit(guard, [{ type: "actor.knockout", actorId: "owner", payload: { targetId: "opponent" } }]);
assert.equal(afterOpponentKo.actors.find(item => item.id === "owner").hp, 1, "Bodyguards does not take damage while any non-Fodder character on either side remains");
const remainingHero = afterOpponentKo.actors.find(item => item.id === "hero");
afterOpponentKo = commit(afterOpponentKo, [{ type: "actor.knockout", actorId: "owner", payload: { targetId: remainingHero.id } }]);
assert.equal(afterOpponentKo.actors.find(item => item.id === "owner").knockedOut, true, "Bodyguards takes the passive 1 damage after all non-Fodder characters are Knocked Out");

const swarm = deploy(scene({ profileId: "lionwing.npc.swarm", actors: [actor("hero", "hero", 0, 0), actor("enemy-ally", "enemy", 7, 7)] }));
const afterSwarmThreshold = commit(swarm, [{ type: "damage.apply", actorId: "enemy-ally", payload: { targetId: "hero", amount: 12, sourceActionId: "test" } }]);
assert.equal(afterSwarmThreshold.actors.find(item => item.id === "hero").knockedOut, true);
assert.equal(afterSwarmThreshold.actors.find(item => item.id === "owner").knockedOut, true, "Swarm takes its passive damage when all opposing non-Fodder characters are down, even while an allied enemy remains");

const allFodder = deploy(scene({ profileId: "lionwing.npc.bodyguards", actors: [actor("hero", "hero", 0, 0), actor("opponent", "enemy", 7, 7)] }));
for (const fodder of allFodder.actors.filter(item => item.kind === "crowd")) {
  const next = commit(allFodder, [{ type: "damage.apply", actorId: "hero", payload: { targetId: fodder.id, amount: 1, sourceActionId: "test" } }]);
  allFodder.actors = next.actors; allFodder.log = next.log; allFodder.version = next.version; allFodder.triggerQueue = next.triggerQueue;
}
assert.equal(allFodder.actors.find(item => item.id === "owner").knockedOut, true, "Bodyguards takes its passive damage once all its Deployment Zones are Knocked Out");

console.log("LionWing Swarm and Bodyguards: deployment proxies, allied Fodder Brace, persistence/network, lifecycle and event authority passed");
