import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
loadSceneEngine(context);
const Engine = context.DAWN_SCENE_ENGINE;
const data = context.DAWN_DATA;
const scene = {
  version: 0, round: 1, tension: 2, activeActorId: "hero",
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [
    { id: "hero", kind: "hero", name: "Эта", team: "hero", space: "main", x: 1, y: 1, ap: 3, baseAp: 3, focus: 50, hp: 12, maxHp: 12, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 4, spirit: 4, mind: 2 }, effects: [], usedActions: [], acted: false },
    { id: "enemy", kind: "enemy", name: "Ассасин", team: "enemy", profileId: "enemy.common.assassin", tier: 1, space: "main", x: 2, y: 1, ap: 2, baseAp: 2, focus: 0, hp: 10, maxHp: 10, armor: 1, evasion: 0, attrs: { body: 2, talent: 4, spirit: 1, mind: 2 }, effects: [], usedActions: [], usedTrump: false, acted: false },
  ], objects: [], markers: [], log: [], rollFeed: [],
};
const actionNamed = name => data.actions.list.find(action => action.name === name);
const prepareAttack = (source, actorId, targetId, actionName = "Стычка") => Engine.prepareAction(source, data, {
  actorId, actionId: actionNamed(actionName).id, targetIds: [targetId],
  roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});

const actions = Engine.availableActions(scene, data, "hero");
assert.equal(actions.length, 15);
assert.equal(actions.find(action => action.name === "Стычка").available, true);
assert.ok(actions.filter(action => action.reaction).every(action => !action.available), "Defenses cannot be spent as standalone Turn actions");
const enemyTurnScene = structuredClone(scene);
enemyTurnScene.activeActorId = "enemy";
assert.equal(Engine.availableActions(enemyTurnScene, data, "enemy").find(action => action.name === "Шаг").available, true, "Enemies share the reusable basic-action contract during their Turn");
const outnumberedScene = structuredClone(scene);
outnumberedScene.actors[0].gifts = ["wolf.outgunned"];
outnumberedScene.actors.push({ ...structuredClone(outnumberedScene.actors[1]), id: "enemy-2", x: 3 });
assert.equal(Engine.diceHookStatus(outnumberedScene, "hero", { scope: "challenge", sceneContext: true, baseCount: 3 }).advantage, 2, "Structured rolls may read the tactical side balance");
assert.equal(Engine.diceHookStatus(outnumberedScene, "hero", { scope: "challenge", sceneContext: false, baseCount: 3 }).advantage, 0, "Narrative rolls never infer being outnumbered from the structured board");
const enemyBaseActions = Engine.availableActions(scene, data, "enemy");
assert.deepEqual(Array.from(enemyBaseActions, action => action.name), ["Шаг"], "Enemies expose only their canonical shared Step; hero actions and Reactions stay unavailable");
assert.equal(Engine.prepareAction(scene, data, { actorId: "enemy", actionId: actionNamed("Передышка").id }).ok, false, "The engine rejects hero-only base actions for enemies even when called directly");
const alliedProfileScene = structuredClone(scene);
alliedProfileScene.actors.push({ ...structuredClone(alliedProfileScene.actors[1]), id: "allied-profile", name: "Союзный Ассасин", team: "hero", x: 1, y: 2, acted: false });
alliedProfileScene.activeActorId = "allied-profile";
assert.deepEqual(Array.from(Engine.availableActions(alliedProfileScene, data, "allied-profile"), action => action.name), ["Шаг"], "An allied enemy profile keeps the canonical profile-NPC basic action kit instead of inheriting hero actions");
assert.equal(Engine.availableEnemyRules(alliedProfileScene, data, "allied-profile").length, data.enemies.common.find(profile => profile.id === "enemy.common.assassin").rules.length, "An allied profile keeps all actions from its enemy profile");
assert.ok(Engine.availableEnemyRules(alliedProfileScene, data, "allied-profile").some(rule => rule.available), "An allied profile can actually use its profile actions during its Turn");
assert.equal(Engine.targetStatus(alliedProfileScene, { sourceActorId: "allied-profile", targetIds: ["hero"], audience: "enemies" }).available, false, "Heroes are allies of an allied profile");
assert.equal(Engine.targetStatus(alliedProfileScene, { sourceActorId: "allied-profile", targetIds: ["enemy"], audience: "enemies" }).available, true, "Hostile profiles are valid enemies of an allied profile");
const freshTurnProgress = Engine.turnActionProgressStatus(scene, "hero");
assert.equal(freshTurnProgress.total, 3);
assert.equal(freshTurnProgress.currentAction, 1);
assert.deepEqual(Array.from(freshTurnProgress.labels), ["Ход начат", "Действие 1", "Действие 2", "Действие 3", "Завершить Ход"]);
const afterOneActionPoint = Engine.dispatch(scene, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 1 } }).scene;
assert.equal(Engine.turnActionProgressStatus(afterOneActionPoint, "hero").currentAction, 2);
const afterAllActionPoints = Engine.dispatch(afterOneActionPoint, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 2 } }).scene;
assert.equal(Engine.turnActionProgressStatus(afterAllActionPoints, "hero").readyToEnd, true);
assert.equal(Engine.turnActionProgressStatus(afterAllActionPoints, "hero").used, 3);
const afterQuickAction = Engine.dispatch(scene, { type: "action.prepare", actorId: "hero", payload: { actionId: "qa.quick", name: "Быстрое действие", quick: true } }).scene;
assert.equal(Engine.turnActionProgressStatus(afterQuickAction, "hero").currentAction, 1, "A Quick action does not occupy one of the three Turn action slots");
const idleScene = structuredClone(scene);
idleScene.activeActorId = null;
assert.ok(Engine.availableActions(idleScene, data, "hero").filter(action => !action.reaction).every(action => !action.available), "Ordinary actions require an explicitly started Turn");
assert.ok(Engine.availableEnemyRules(idleScene, data, "enemy").every(rule => !rule.available), "Enemy rules require an explicitly started Turn");
assert.equal(Engine.turnStartStatus(idleScene, "enemy").available, false, "A player begins a Round");
assert.equal(Engine.roundEndStatus(idleScene).available, false, "An untouched Round cannot be ended prematurely");
assert.throws(() => Engine.dispatch(scene, { type: "turn.start", actorId: "enemy", payload: {} }), /завершите текущий Ход/);
assert.throws(() => Engine.dispatch(scene, { type: "action.prepare", actorId: "enemy", payload: { actionId: "x", name: "Чужое действие", targetIds: [] } }), /не Ход/);
const narratorSwitchedTurn = Engine.dispatchMany(scene, [{ type: "turn.end", actorId: "hero", payload: { narratorOverride: true } }, { type: "turn.start", actorId: "enemy", payload: { narratorOverride: true } }], { narratorOverride: true }).scene;
assert.equal(narratorSwitchedTurn.activeActorId, "enemy", "The Narrator may override normal Turn order while retaining canonical Turn lifecycle events");
assert.ok(narratorSwitchedTurn.log.some(event => event.type === "turn.end" && event.actorId === "hero"));
assert.equal(Engine.dispatch(idleScene, { type: "round.end", payload: { narratorOverride: true } }, { narratorOverride: true }).scene.round, 2, "The Narrator may force the Round boundary even when ordinary completion conditions are not met");

assert.throws(() => Engine.dispatch(scene, { type: "turn.end", actorId: "hero" }, { expectedVersion: 9 }), error => error.code === "SCENE_VERSION_CONFLICT");
const stableEvent = { id: "same-event", type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1 } };
const once = Engine.dispatch(scene, stableEvent).scene;
const twice = Engine.dispatch(once, stableEvent);
assert.equal(twice.duplicate, true);
assert.equal(twice.scene.actors[0].focus, 51, "Duplicate events are idempotent");
const staleRetry = Engine.dispatch(once, stableEvent, { expectedVersion: scene.version });
assert.equal(staleRetry.duplicate, true, "An exact idempotent retry wins over its now-stale expected version");
assert.equal(staleRetry.event.payload.resolvedDelta, 1, "A duplicate returns the canonical journal event, including resolved fields");
assert.throws(() => Engine.dispatch(once, { ...stableEvent, payload: { ...stableEvent.payload, amount: 2 } }), error => error.code === "SCENE_EVENT_ID_CONFLICT", "Reusing an event id for different input is rejected");
const duplicateBatch = Engine.dispatchMany(once, [stableEvent], { expectedVersion: scene.version });
assert.equal(duplicateBatch.events.length, 0, "Duplicate events are not republished as newly committed events");
assert.equal(duplicateBatch.duplicates.length, 1);
assert.throws(() => Engine.dispatchMany(once, [stableEvent, { id: "mixed-batch-new", type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1 } }], { expectedVersion: scene.version }), error => error.code === "SCENE_VERSION_CONFLICT", "A leading duplicate cannot let a later new event bypass optimistic concurrency");
assert.equal(once.actors[0].focus, 51, "A rejected mixed-version batch leaves its source Scene unchanged");
assert.throws(() => Engine.dispatch(scene, { type: "resource.gain", actorId: "hero", payload: { resource: "admin", amount: 9999 } }), /ресурса/);
const runtimeSet = Engine.dispatch(scene, { type: "actor.runtime.set", actorId: "hero", payload: { key: "focus", value: 3 } }).scene;
assert.equal(runtimeSet.actors[0].focus, 3, "owned player counter changes have a canonical validated event");
const stressSet = Engine.dispatch(scene, { type: "actor.runtime.set", actorId: "hero", payload: { key: "stress", value: 2 } }).scene;
assert.equal(stressSet.actors[0].stress, 2, "Stress is a canonical hero resource for the shared Tools tracker");
assert.throws(() => Engine.dispatch(scene, { type: "actor.runtime.set", actorId: "hero", payload: { key: "stress", value: 4 } }), /ресурса героя/);
assert.throws(() => Engine.dispatch(scene, { type: "actor.runtime.set", actorId: "hero", payload: { key: "admin", value: 9999 } }), /ресурса героя/);
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 99, y: 99 } }), /клетка/);
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 2, y: 1 } }), /занята/, "The event boundary rejects an occupied movement destination even without UI validation");
const compoundScene = structuredClone(scene);
compoundScene.actors[1].compoundId = "boss-1";
compoundScene.actors[1].speed = 3;
compoundScene.actors.push({ ...structuredClone(compoundScene.actors[1]), id: "enemy-part-2", name: "Вторая часть", x: 2, y: 1, speed: 5, armor: 4 });
assert.equal(Engine.effectCellOccupancyStatus(compoundScene, "enemy", { space: "main", x: 2, y: 1 }).available, true, "Parts of one Compound Enemy may share their mandatory cell");
const movedCompound = Engine.dispatch(compoundScene, { type: "actor.move", actorId: "enemy", payload: { space: "main", x: 3, y: 1 } });
assert.deepEqual(Array.from(movedCompound.scene.actors.filter(actor => actor.compoundId === "boss-1"), actor => [actor.x, actor.y]), [[3, 1], [3, 1]], "Moving any Compound Enemy part moves every part together");
assert.deepEqual(Array.from(movedCompound.event.payload.movedActorIds), ["enemy", "enemy-part-2"], "The journal records every synchronously moved Compound Enemy part");
const compoundStatus = Engine.compoundEnemyStatus(compoundScene, "enemy");
assert.deepEqual({ hp: compoundStatus.hp, maxHp: compoundStatus.maxHp, gate: compoundStatus.gate }, { hp: 20, maxHp: 20, gate: 10 }, "A Compound Enemy exposes one summed Health pool and one gate per part");
assert.deepEqual({ speed: compoundStatus.speed, defenseType: compoundStatus.defenseType, armor: compoundStatus.armor, evasion: compoundStatus.evasion }, { speed: 5, defenseType: "armor", armor: 4, evasion: 0 }, "A tied modal Speed uses the higher value and a Compound Enemy inherits only one best defense");
const evasionCompoundScene = structuredClone(compoundScene);
evasionCompoundScene.actors.filter(actor => actor.compoundId === "boss-1").forEach(actor => { actor.compoundDefense = "evasion"; actor.armor = 7; actor.evasion = 7; });
assert.deepEqual({ defenseType: Engine.compoundEnemyStatus(evasionCompoundScene, "enemy").defenseType, armor: Engine.compoundEnemyStatus(evasionCompoundScene, "enemy").armor, evasion: Engine.compoundEnemyStatus(evasionCompoundScene, "enemy").evasion }, { defenseType: "evasion", armor: 0, evasion: 7 }, "When the best Armor and Evasion are tied, the Narrator's persisted choice applies only one of them");
const heroClosedForCompound = Engine.dispatch(compoundScene, { type: "turn.end", actorId: "hero", payload: {} }).scene;
assert.equal(Engine.turnStartStatus(heroClosedForCompound, "enemy").available, true, "The first Compound Enemy part has its own Turn");
const compoundDamaged = Engine.dispatch(compoundScene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy-part-2", amount: 99, ignoreArmor: true, ignoreEvasion: true } });
assert.equal(Engine.compoundEnemyStatus(compoundDamaged.scene, "enemy").hp, 10, "One hit cannot cross more than one Compound Enemy Health Gate");
assert.equal(compoundDamaged.scene.tension, compoundScene.tension + 1, "Crossing a Compound Enemy Health Gate adds one Tension");
const compoundEffect = Engine.dispatch(compoundScene, { type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.помечен" } });
assert.ok(compoundEffect.scene.actors.filter(actor => actor.compoundId === "boss-1").every(actor => actor.effects.includes("negative.помечен")), "An Effect applied to one Compound Enemy part applies to every part");
assert.equal(Engine.effectExpiryStatus(compoundEffect.scene, "enemy", "negative.помечен", { type: "turn.end", actorId: "enemy" }).expires, false, "End-of-Turn Effects on Compound Enemies last beyond an individual part's Turn");
assert.equal(Engine.effectExpiryStatus(compoundEffect.scene, "enemy", "negative.помечен", { type: "round.end" }).expires, true, "Compound Enemy end-of-Turn Effects clear at Round end");
const compoundAttack = Engine.dispatch(compoundScene, { type: "attack.pending", actorId: "hero", payload: { targetIds: ["enemy", "enemy-part-2"], damage: 1, name: "QA" } });
assert.deepEqual(Array.from(compoundAttack.scene.pendingAction.targetIds), ["enemy"], "All parts of a Compound Enemy are one target and cannot be hit twice by one attack");
const cinematicSpawnScene = structuredClone(scene);
cinematicSpawnScene.spaces[0].mode = "cinematic";
const cinematicSpawn = Engine.dispatch(cinematicSpawnScene, { type: "actor.spawn", actorId: "hero", payload: { actor: { id: "summon-cinematic", kind: "token", team: "hero", name: "Призыв", space: "main", x: 2, y: 1, effects: [] } } }).scene;
assert.ok(cinematicSpawn.actors.some(actor => actor.id === "summon-cinematic"), "Spawning uses the shared occupancy contract and permits stacking on a cinematic field");
const compoundSpawn = Engine.dispatch(compoundScene, { type: "actor.spawn", actorId: "enemy", payload: { actor: { id: "enemy-part-3", kind: "enemy", team: "enemy", name: "Третья часть", compoundId: "boss-1", space: "main", x: 2, y: 1, effects: [] } } }).scene;
assert.equal(compoundSpawn.actors.filter(actor => actor.compoundId === "boss-1").length, 3, "A new part may enter the cell of its Compound Enemy");
assert.throws(() => Engine.dispatch(scene, { type: "actor.spawn", actorId: "hero", payload: { actor: { id: "blocked-summon", kind: "token", team: "hero", name: "Призыв", space: "main", x: 2, y: 1, effects: [] } } }), /занята/, "Ordinary standard-field spawning still rejects an occupied cell");
const fodderActor = { id: "fodder-a-1", kind: "crowd", team: "enemy", crowdGroupId: "fodder-a", name: "Гоблины", tier: 0, space: "main", x: 1, y: 1, hp: 1, maxHp: 1, ap: 0, baseAp: 0, speed: 0, armor: 0, evasion: 0, effects: [], acted: true };
const fodderScene = Engine.dispatch(scene, { type: "actor.spawn", actorId: "hero", payload: { actor: fodderActor } }).scene;
assert.equal(fodderScene.actors.find(actor => actor.id === "fodder-a-1").x, 1, "A Fodder Zone may overlap any character");
assert.equal(Engine.targetStatus(fodderScene, { sourceActorId: "hero", targetIds: ["fodder-a-1"], audience: "enemies", range: 1, min: 1, max: 1 }).available, true, "A Fodder Zone is targetable as an enemy");
assert.equal(Engine.turnStartStatus({ ...fodderScene, activeActorId: null }, "fodder-a-1").available, false, "Fodder Zones never take Turns");
assert.deepEqual(Array.from(Engine.availableActions(fodderScene, data, "fodder-a-1")), [], "Fodder Zones expose no actions");
const fodderDefeated = Engine.dispatch(fodderScene, { type: "damage.apply", actorId: "hero", payload: { targetId: "fodder-a-1", amount: 1, ignoreArmor: true, ignoreEvasion: true } }).scene;
assert.equal(fodderDefeated.actors.find(actor => actor.id === "fodder-a-1").knockedOut, true, "One damage defeats a 1-Health Fodder Zone");
const fodderTerrainScene = structuredClone(scene);
fodderTerrainScene.actors[1].x = 6; fodderTerrainScene.actors[1].y = 6;
fodderTerrainScene.actors.push({ ...fodderActor, x: 1, y: 2 });
const heroEnteredFodder = Engine.dispatchMany(fodderTerrainScene, [{ type: "actor.move", actorId: "hero", payload: { space: "main", x: 1, y: 2, placement: true } }, { type: "actor.enter", actorId: "hero", payload: { space: "main", x: 1, y: 2 } }]).scene;
assert.equal(heroEnteredFodder.actors.find(actor => actor.id === "hero").speedZeroUntilTurnEnd, true, "Hostile Fodder is Difficult Terrain");
const alliedFodderScene = structuredClone(fodderTerrainScene); alliedFodderScene.activeActorId = "enemy"; alliedFodderScene.actors[1].x = 1; alliedFodderScene.actors[1].y = 1;
const enemyEnteredAlliedFodder = Engine.dispatchMany(alliedFodderScene, [{ type: "actor.move", actorId: "enemy", payload: { space: "main", x: 1, y: 2, placement: true } }, { type: "actor.enter", actorId: "enemy", payload: { space: "main", x: 1, y: 2 } }]).scene;
assert.equal(Boolean(enemyEnteredAlliedFodder.actors.find(actor => actor.id === "enemy").speedZeroUntilTurnEnd), false, "Fodder does not hinder its allies");
const fodderWindowSource = structuredClone(fodderTerrainScene); fodderWindowSource.activeActorId = "enemy"; fodderWindowSource.actors[0].acted = true;
const fodderWindow = Engine.dispatch(fodderWindowSource, { id: "enemy-turn-before-fodder", type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(Engine.fodderMoveStatus(fodderWindow, "fodder-a-1").remaining, 2, "Every enemy Turn end opens two spaces of movement for each Fodder Zone");
const fodderBoundary = Engine.fodderMoveStatus(fodderWindow, "fodder-a-1").boundaryEventId;
const fodderMoved = Engine.dispatch(fodderWindow, { type: "actor.move", actorId: "fodder-a-1", payload: { space: "main", x: 2, y: 2, placement: true, fodderMove: true, boundaryEventId: fodderBoundary } }).scene;
assert.equal(Engine.fodderMoveStatus(fodderMoved, "fodder-a-1").remaining, 1, "Fodder movement allowance is journal-derived and decreases by distance");
assert.throws(() => Engine.dispatch(fodderMoved, { type: "actor.move", actorId: "fodder-a-1", payload: { space: "main", x: 4, y: 2, placement: true, fodderMove: true, boundaryEventId: fodderBoundary } }), /перемещ|клетк/i, "A Fodder Zone cannot exceed its remaining movement");
fodderMoved.actors.find(actor => actor.id === "fodder-a-1").x = 1; fodderMoved.actors.find(actor => actor.id === "fodder-a-1").y = 1;
const fodderStrike = Engine.dispatch(fodderMoved, { type: "damage.apply", actorId: "fodder-a-1", payload: { targetId: "hero", amount: 2, sourceActionId: "fodder.round-end" } }).scene;
assert.equal(fodderStrike.actors.find(actor => actor.id === "hero").hp, 10, "At Round end a Fodder Zone may deal exactly 2 damage within one space");
assert.throws(() => Engine.dispatch(fodderStrike, { type: "damage.apply", actorId: "fodder-a-1", payload: { targetId: "hero", amount: 2, sourceActionId: "fodder.round-end" } }), /один раз/, "Each Fodder Zone may deal its Round-end damage only once");
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 1, y: 2, from: { space: "main", x: 0, y: 0 } } }), /устарела/, "A movement event cannot forge its journal origin");
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 1, y: 2, path: ["1,1"] } }), /не совпадает/, "A journaled path must finish at the movement destination");
assert.throws(() => Engine.dispatch(scene, { type: "scene.replace", payload: { state: {} } }), /Неизвестный тип/);
const publicRoll = Engine.dispatch(scene, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, outcome: "Минимальный успех" } }).scene;
assert.equal(publicRoll.rollFeed[0].actor, "Эта");
assert.equal(publicRoll.rollFeed[0].outcome, "Минимальный успех");
const pendingRollScene = Engine.dispatch(scene, { id: "pending-roll-attack", type: "attack.pending", actorId: "hero", payload: { name: "Проверочная Атака", targetIds: ["enemy"], damage: 2, roll: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } } }).scene;
assert.equal(pendingRollScene.rollFeed[0].pending, true, "The rolled attack is published while Reactions are still pending");
assert.equal(pendingRollScene.rollFeed[0].outcome, "Запрос → ожидаются Реакции");
const resolvedPendingRoll = Engine.dispatch(pendingRollScene, { id: "resolved-roll-attack", type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, outcome: "Запрос → Ответ" } }).scene;
assert.equal(resolvedPendingRoll.rollFeed.filter(roll => JSON.stringify(roll.rolls) === JSON.stringify([6, 5, 2, 1])).length, 1, "The canonical response replaces its pending roll preview instead of duplicating it");
assert.equal(resolvedPendingRoll.rollFeed[0].pending, undefined);
const requestedChallenge = Engine.dispatch(scene, { type: "challenge.request", payload: { id: "challenge-1", actorId: "hero", target: 3, requestedBy: "Нарратор" } }).scene;
assert.deepEqual(JSON.parse(JSON.stringify(requestedChallenge.challengeRequest)), { id: "challenge-1", actorId: "hero", target: 3, requestedBy: "Нарратор", at: requestedChallenge.challengeRequest.at, result: null });
const requestedRoll = Engine.dispatch(requestedChallenge, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, target: 3, challengeRequestId: "challenge-1" } }).scene;
assert.equal(requestedRoll.rollFeed[0].challengeRequestId, "challenge-1", "A public roll remains tied to the Narrator request");
assert.equal(requestedRoll.challengeRequest.result.successes, 2, "The active request exposes the accepted result to the Narrator");
assert.throws(() => Engine.dispatch(requestedRoll, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, target: 3, challengeRequestId: "challenge-1" } }), /не соответствует/, "A normal result cannot silently replace an accepted result");
const allInRequestedRoll = Engine.dispatch(requestedRoll, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥3", rolls: [6, 5, 4, 1], successes: 3, crits: 1, outcome: "Минимальный успех", payment: "Влияние", target: 3, challengeRequestId: "challenge-1" } }).scene;
assert.equal(allInRequestedRoll.challengeRequest.result.successes, 3, "All Out explicitly replaces the stored request result");
assert.equal(allInRequestedRoll.challengeRequest.result.payment, "Влияние");
assert.throws(() => Engine.dispatch(requestedChallenge, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, target: 2, challengeRequestId: "challenge-1" } }), /не соответствует/, "A player cannot lower the requested difficulty");
const clearedChallenge = Engine.dispatch(requestedChallenge, { type: "challenge.clear", payload: { requestId: "challenge-1" } }).scene;
assert.equal(clearedChallenge.challengeRequest, null);
assert.throws(() => Engine.dispatch(scene, { type: "challenge.request", payload: { id: "challenge-invalid", actorId: "hero", target: 0, requestedBy: "Нарратор" } }), /запрос испытания/);
const opposedRequested = Engine.dispatch(scene, { type: "opposed.request", payload: { id: "opposed-1", requestedBy: "Нарратор", participants: [
  { id: "side-hero", actorId: "hero", heroId: "sheet-1", name: "Эта", controller: "participant", pool: 4 },
  { id: "side-enemy", actorId: "enemy", name: "Противник", controller: "narrator", pool: 6 },
] } }).scene;
assert.equal(opposedRequested.challengeRequest, null, "An opposed request replaces a plain challenge request");
assert.equal(opposedRequested.opposedRoll.status, "rolling");
const opposedHeroRoll = Engine.dispatch(opposedRequested, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, opposedRequestId: "opposed-1", opposedParticipantId: "side-hero", opposedAttempt: 1 } }).scene;
assert.equal(opposedHeroRoll.opposedRoll.results["side-hero"].successes, 2);
assert.throws(() => Engine.dispatch(opposedHeroRoll, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, opposedRequestId: "opposed-1", opposedParticipantId: "side-hero", opposedAttempt: 1 } }), /не соответствует/, "A side cannot silently replace its result without going All Out");
assert.throws(() => Engine.dispatch(opposedHeroRoll, { type: "roll.public", actorId: "enemy", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, opposedRequestId: "opposed-1", opposedParticipantId: "side-hero", opposedAttempt: 1 } }), /не соответствует/, "An opponent cannot submit the other side's result");
const opposedTie = Engine.dispatch(opposedHeroRoll, { type: "roll.public", actorId: "enemy", payload: { formula: "6D6 ≥4", rolls: [6, 4, 3, 2, 2, 1], successes: 2, crits: 1, opposedRequestId: "opposed-1", opposedParticipantId: "side-enemy", opposedAttempt: 1 } }).scene;
assert.equal(opposedTie.opposedRoll.status, "tied", "Equal Successes produce the canonical tie state");
const bothRewards = Engine.dispatch(opposedTie, { type: "opposed.tie.resolve", payload: { requestId: "opposed-1" } }).scene;
assert.equal(bothRewards.opposedRoll.resolution, "both", "Only an explicit Narrator decision resolves both compatible Rewards");
const opposedReroll = Engine.dispatch(opposedTie, { type: "opposed.reroll", payload: { requestId: "opposed-1" } }).scene;
assert.equal(opposedReroll.opposedRoll.attempt, 2);
assert.deepEqual(JSON.parse(JSON.stringify(opposedReroll.opposedRoll.results)), {});
const rerolledHero = Engine.dispatch(opposedReroll, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 4, 1], successes: 3, crits: 1, opposedRequestId: "opposed-1", opposedParticipantId: "side-hero", opposedAttempt: 2 } }).scene;
const opposedWon = Engine.dispatch(rerolledHero, { type: "roll.public", actorId: "enemy", payload: { formula: "6D6 ≥4", rolls: [4, 3, 3, 2, 2, 1], successes: 1, crits: 0, opposedRequestId: "opposed-1", opposedParticipantId: "side-enemy", opposedAttempt: 2 } }).scene;
assert.equal(opposedWon.opposedRoll.winnerParticipantId, "side-hero");
assert.match(opposedWon.opposedRoll.participants.find(item => item.id === opposedWon.opposedRoll.winnerParticipantId).name, /Эта/);
const clearedOpposed = Engine.dispatch(opposedWon, { type: "opposed.clear", payload: { requestId: "opposed-1" } }).scene;
assert.equal(clearedOpposed.opposedRoll, null);
assert.throws(() => Engine.dispatch(scene, { type: "opposed.request", payload: { id: "opposed-invalid", requestedBy: "Нарратор", participants: [
  { id: "same-a", actorId: "hero", name: "Эта", controller: "participant", pool: 4 },
  { id: "same-b", actorId: "hero", name: "Эта снова", controller: "participant", pool: 4 },
] } }), /встречный бросок/, "A character cannot oppose itself");
const linkedHeroScene = structuredClone(scene);
linkedHeroScene.actors[0].heroId = "sheet-1";
assert.throws(() => Engine.dispatch(linkedHeroScene, { type: "opposed.request", payload: { id: "opposed-mismatched-sheet", requestedBy: "Нарратор", participants: [
  { id: "mismatch-a", actorId: "hero", heroId: "another-sheet", name: "Подмена", controller: "participant", pool: 4 },
  { id: "mismatch-b", actorId: "enemy", name: "Противник", controller: "narrator", pool: 6 },
] } }), /встречный бросок/, "An actor-backed side cannot claim another character sheet");
const raashaDiceScene = structuredClone(scene);
raashaDiceScene.actors[0].name = "Рааша Шаадрин";
raashaDiceScene.actors[0].stress = 0;
raashaDiceScene.actors[0].gifts = ["wolf.dark-urge", "wolf.outgunned"];
raashaDiceScene.actors.push({ ...structuredClone(raashaDiceScene.actors[1]), id: "enemy-2", name: "Вторая цель", x: 3, y: 1 });
const outgunned = Engine.sideBalanceStatus(raashaDiceScene, "hero");
assert.deepEqual({ enemies: outgunned.enemies, allies: outgunned.allies, outnumbered: outgunned.outnumbered }, { enemies: 2, allies: 0, outnumbered: true }, "Рааша herself is not counted as her own ally");
const darkUrgeRequest = { scope: "challenge", baseCount: 2, usesAbility: true, abilityKey: "ability", selectedHookIds: ["wolf.dark-urge"], targetIds: ["enemy"] };
const darkUrgeStatus = Engine.diceHookStatus(raashaDiceScene, "hero", darkUrgeRequest);
assert.equal(darkUrgeStatus.count, 8, "Dark Urge +4 and Outgunned +2 compose through the dice family");
assert.deepEqual(Array.from(darkUrgeStatus.sources, source => source.ruleId), ["wolf.outgunned", "wolf.dark-urge"]);
const darkUrgePrepared = Engine.diceRollPayload(raashaDiceScene, "hero", darkUrgeRequest, { rolls: [4, 1, 1, 1, 1, 1, 1, 1] });
assert.equal(darkUrgePrepared.payload.successes, 1);
assert.throws(() => Engine.dispatch(raashaDiceScene, { id: "tampered-dark-roll", type: "roll.public", actorId: "hero", payload: { ...darkUrgePrepared.payload, successes: 2 } }), /не соответствует активным правилам/, "A client cannot alter a structured roll result");
const darkUrgeRolled = Engine.dispatchMany(raashaDiceScene, [{ id: "dark-roll", type: "roll.public", actorId: "hero", payload: darkUrgePrepared.payload }]).scene;
assert.equal(darkUrgeRolled.pendingPrompt?.kind, "dark-urge-narrator");
assert.equal(darkUrgeRolled.pendingPrompt?.controller, "narrator");
const narratorRedirect = Engine.respondRulePrompt(darkUrgeRolled, data, { choice: "target:enemy-2" });
assert.equal(narratorRedirect.ok, true);
const resistancePromptScene = Engine.dispatchMany(darkUrgeRolled, narratorRedirect.events).scene;
assert.equal(resistancePromptScene.pendingPrompt?.kind, "dark-urge-resist");
assert.deepEqual(Array.from(resistancePromptScene.pendingPrompt.options), ["accept", "resist"]);
const acceptedRedirect = Engine.respondRulePrompt(resistancePromptScene, data, { choice: "accept" });
const redirectedScene = Engine.dispatchMany(resistancePromptScene, acceptedRedirect.events).scene;
assert.equal(redirectedScene.rollFeed.find(roll => roll.id === "dark-roll").successes, 1, "The already rolled result is preserved");
assert.equal(redirectedScene.rollFeed.find(roll => roll.id === "dark-roll").redirectTargetId, "enemy-2");
assert.deepEqual(Array.from(redirectedScene.targetIds), ["enemy-2"]);
const narratorRedirectForResistance = Engine.respondRulePrompt(darkUrgeRolled, data, { choice: "target:enemy-2" });
const resistanceScene = Engine.dispatchMany(darkUrgeRolled, narratorRedirectForResistance.events).scene;
const resisted = Engine.respondRulePrompt(resistanceScene, data, { choice: "resist" });
const resistedScene = Engine.dispatchMany(resistanceScene, resisted.events).scene;
assert.equal(resistedScene.actors.find(actor => actor.id === "hero").stress, 2);
assert.equal(resistedScene.rollFeed.find(roll => roll.id === "dark-roll").redirected, undefined, "Resistance keeps the original target");
const bladeScene = structuredClone(scene);
bladeScene.actors[0].name = "Рааша Шаадрин";
bladeScene.actors[0].techniques = { "vagabond.master-at-arms": 1 };
bladeScene.actors[0].x = 1;
bladeScene.actors[0].y = 1;
bladeScene.actors[1].x = 3;
bladeScene.actors[1].y = 1;
assert.equal(Engine.masterAtArmsStatus(bladeScene, "hero", { modeId: "blade", targetIds: [], requireDestination: false }).available, true, "Blade becomes selectable before targets because its rule moves before choosing them");
assert.equal(Engine.masterAtArmsStatus(bladeScene, "hero", { modeId: "blade", targetIds: [], destination: { x: 2, y: 1 }, requireTargets: false }).available, true, "Blade accepts a valid one-cell movement preview before target selection");
const bladeStatus = Engine.masterAtArmsStatus(bladeScene, "hero", { modeId: "blade", targetIds: ["enemy"], destination: { x: 2, y: 1 } });
assert.equal(bladeStatus.available, true);
const bladePrepared = Engine.prepareAction(bladeScene, data, { actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], armamentMode: "blade", armamentDestination: { x: 2, y: 1 }, roll: { formula: "3D6", rolls: [4, 3, 2], successes: 1, crits: 0 } });
assert.equal(bladePrepared.ok, true);
assert.equal(bladePrepared.action.quick, true);
assert.ok(bladePrepared.events.some(event => event.type === "rule-mode.set" && event.payload.modeId === "blade"));
assert.ok(bladePrepared.events.some(event => event.type === "actor.move" && event.payload.movement.startsWith("Клинок")));
assert.ok(!bladePrepared.events.some(event => event.type === "resource.spend" && event.payload.resource === "ap"), "An Armament Skirmish is Quick");
const bladePending = Engine.dispatchMany(bladeScene, bladePrepared.events).scene;
assert.equal(bladePending.actors.find(actor => actor.id === "hero").ruleModes["vagabond.master-at-arms.armament"].label, "Клинок");
assert.deepEqual({ x: bladePending.actors[0].x, y: bladePending.actors[0].y }, { x: 2, y: 1 });
const bladeResolved = Engine.resolvePendingAction(bladePending, data);
assert.equal(bladeResolved.ok, true);
const bladeFinished = Engine.dispatchMany(bladePending, bladeResolved.events).scene;
assert.ok(bladeFinished.actors[0].effects.includes("positive.усилен"), "Blade applies Empowered after the Skirmish resolves");
assert.equal(Engine.ruleModeStatus(bladeFinished, "hero", { groupId: "vagabond.master-at-arms.armament", modeId: "blade" }).available, false, "Blade cannot be equipped twice in one Turn");
const chainScene = structuredClone(scene);
chainScene.actors[0].techniques = { "vagabond.master-at-arms": 1 };
chainScene.actors[0].x = 1;
chainScene.actors[0].y = 1;
chainScene.actors[1].x = 5;
chainScene.actors[1].y = 1;
const armamentChainPrepared = Engine.prepareAction(chainScene, data, { actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], armamentMode: "chain", roll: { formula: "3D6", rolls: [4, 3, 2], successes: 1, crits: 0 } });
assert.equal(armamentChainPrepared.ok, true);
const armamentChainPending = Engine.dispatchMany(chainScene, armamentChainPrepared.events).scene;
const armamentChainResolved = Engine.resolvePendingAction(armamentChainPending, data);
const armamentChainFinished = Engine.dispatchMany(armamentChainPending, armamentChainResolved.events).scene;
assert.ok(armamentChainFinished.actors[1].effects.includes("negative.разорван"));
assert.ok(armamentChainFinished.actors[1].effects.includes("negative.порчен"), "Chain applies Torn and Corrupted to its range-4 target");
const polearmScene = structuredClone(scene);
polearmScene.actors[0].techniques = { "vagabond.master-at-arms": 1 };
polearmScene.actors[1].x = 2;
polearmScene.actors[1].y = 1;
polearmScene.actors.push({ ...structuredClone(polearmScene.actors[1]), id: "enemy-2", name: "Вторая цель", x: 1, y: 2 });
const polearmPrepared = Engine.prepareAction(polearmScene, data, { actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy", "enemy-2"], armamentMode: "polearm", roll: { formula: "3D6", rolls: [4, 3, 2], successes: 1, crits: 0 } });
assert.equal(polearmPrepared.ok, true);
const polearmPending = Engine.dispatchMany(polearmScene, polearmPrepared.events).scene;
const polearmResolved = Engine.resolvePendingAction(polearmPending, data);
const polearmFinished = Engine.dispatchMany(polearmPending, polearmResolved.events).scene;
for (const targetId of ["enemy", "enemy-2"]) {
  const target = polearmFinished.actors.find(actor => actor.id === targetId);
  assert.ok(target.effects.includes("negative.подброшен"));
  assert.ok(target.effects.includes("negative.замедлен"));
}
const chargeScene = structuredClone(scene);
chargeScene.actors[0].focus = 0;
const chargePrepared = Engine.prepareAction(chargeScene, data, { actorId: "hero", actionId: actionNamed("Зарядка").id, roll: { formula: "4D6 ≥4", attribute: "spirit", rolls: [6, 5, 4, 1], successes: 3, crits: 1 } });
assert.equal(chargePrepared.ok, true);
const charged = Engine.dispatchMany(chargeScene, chargePrepared.events).scene;
assert.equal(charged.actors[0].focus, 3, "Charge grants Focus equal to three rolled successes");
const tracedMove = Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 1, y: 2, movement: "Шаг", path: ["1,2"] } }).scene;
assert.equal(Engine.movementTraceStatus(tracedMove, { space: "main" }).available, true);
const tracesCleared = Engine.dispatch(tracedMove, { type: "movement-traces.clear", payload: { space: "main" } }).scene;
assert.equal(Engine.movementTraceStatus(tracesCleared, { space: "main" }).available, false, "The narrator can clear movement traces without deleting combat history");
const clockCreated = Engine.dispatch(scene, { id: "clock-create", type: "session-clock.create", payload: { id: "scene-clock-threat", name: "Приближение угрозы", kind: "danger", size: 6 } }).scene;
assert.deepEqual(JSON.parse(JSON.stringify(clockCreated.sessionClocks[0])), { id: "scene-clock-threat", name: "Приближение угрозы", kind: "danger", size: 6, value: 0 }, "Session clocks live in the canonical Scene state");
const clockSet = Engine.dispatch(clockCreated, { id: "clock-set", type: "session-clock.set", payload: { id: "scene-clock-threat", value: 4 } }).scene;
assert.equal(clockSet.sessionClocks[0].value, 4, "Session clock progress is event-driven");
const clockRenamed = Engine.dispatch(clockSet, { id: "clock-rename", type: "session-clock.rename", payload: { id: "scene-clock-threat", name: "Ритуал почти завершён" } }).scene;
assert.equal(clockRenamed.sessionClocks[0].name, "Ритуал почти завершён");
const clockReclassified = Engine.dispatch(clockRenamed, { id: "clock-kind", type: "session-clock.kind", payload: { id: "scene-clock-threat", kind: "progress" } }).scene;
assert.equal(clockReclassified.sessionClocks[0].kind, "progress", "Session clocks can move between good and bad groups");
const clockResized = Engine.dispatch(clockReclassified, { id: "clock-size", type: "session-clock.size", payload: { id: "scene-clock-threat", size: 4 } }).scene;
assert.equal(clockResized.sessionClocks[0].size, 4, "Session clocks support the canonical segment sizes");
const clockRemoved = Engine.dispatch(clockResized, { id: "clock-remove", type: "session-clock.remove", payload: { id: "scene-clock-threat" } }).scene;
assert.equal(clockRemoved.sessionClocks.length, 0);
assert.throws(() => Engine.dispatch(scene, { type: "session-clock.create", payload: { id: "bad clock", name: "", size: 5 } }), /часы Сцены/i, "Malformed shared clocks are rejected at the event boundary");
assert.throws(() => Engine.dispatch(scene, { type: "area.create", actorId: "hero", payload: { space: "main", areaType: "danger", label: "Без id", duration: "scene", cells: ["0,0"] } }), /область/, "Persistent entities require a stable id");
const stableArea = Engine.dispatch(scene, { type: "area.create", actorId: "hero", payload: { id: "stable-area", space: "main", areaType: "danger", label: "Опасность", duration: "scene", cells: ["0,0"] } }).scene;
const retimedArea = Engine.dispatch(stableArea, { type: "area.duration", actorId: "hero", payload: { id: "stable-area", duration: "round" } }).scene;
assert.equal(retimedArea.objects[0].duration, "round", "The Narrator can change a persistent area's lifecycle through a typed event");
assert.throws(() => Engine.dispatch(stableArea, { type: "area.create", actorId: "hero", payload: { id: "stable-area", space: "main", areaType: "danger", label: "Другая область", duration: "scene", cells: ["0,1"] } }), /область/, "Two persistent entities cannot share an id");
const weaponMarker = Engine.dispatch(scene, { type: "marker.create", actorId: "hero", payload: { id: "weapon-marker", space: "main", x: 0, y: 0, markerKind: "weapon", label: "Оружие", duration: "scene" } }).scene;
assert.equal(weaponMarker.markers[0].kind, "weapon", "The generic marker contract preserves specialized marker kinds");
assert.deepEqual(
  JSON.parse(JSON.stringify(Engine.eventParticipants(scene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", participantIds: ["hero", "enemy", "missing"] } }))),
  { sourceIds: ["hero"], targetIds: ["enemy"], actorIds: ["hero", "enemy"] },
  "Event participants must be canonical, role-aware, unique, and limited to actors on the Scene",
);
const pendingOverwriteScene = structuredClone(scene);
pendingOverwriteScene.pendingAction = { id: "existing-chain", actorId: "hero", responses: { enemy: { choice: "pending" } } };
assert.throws(() => Engine.dispatch(pendingOverwriteScene, { type: "attack.pending", actorId: "hero", payload: { name: "Вторая атака", targetIds: ["enemy"], damage: 1 } }), /завершите текущую цепочку/, "A second pending attack cannot silently replace an unresolved chain");
const promptLockScene = structuredClone(scene);
promptLockScene.pendingPrompt = { id: "choice", kind: "test", actorId: "hero", sourceActorId: "hero", targetId: "enemy", options: ["yes", "no"] };
assert.throws(() => Engine.dispatch(promptLockScene, { type: "action.prepare", actorId: "hero", payload: { actionId: "x", name: "Обход решения" } }), /ответьте/, "Ordinary actions cannot bypass an unresolved rule prompt");
assert.throws(() => Engine.dispatch(promptLockScene, { type: "rule.respond", actorId: "hero", payload: { promptId: "choice", choice: "invented" } }), /ответа/, "The event boundary rejects an option that was never offered");
assert.throws(() => Engine.dispatch(promptLockScene, { type: "rule.respond", actorId: "enemy", payload: { promptId: "choice", choice: "yes" } }), /Источник/, "Another actor cannot answer somebody else's rule prompt");
assert.equal(promptLockScene.pendingPrompt.id, "choice", "Rejected answers leave the original prompt open");
const rawPlacementScene = structuredClone(promptLockScene);
rawPlacementScene.pendingPrompt = { id: "cell-choice", kind: "untouchable-weave-cell", actorId: "hero", sourceActorId: "hero", targetId: null, options: ["cell", "cancel"] };
assert.throws(() => Engine.dispatch(rawPlacementScene, { type: "rule.respond", actorId: "hero", payload: { promptId: "cell-choice", choice: "cell", destination: { x: 1, y: 2 } } }), /вместе с проверенным перемещением/, "A raw cell answer cannot close a placement prompt without its movement");

const refreshedEffectScene = structuredClone(scene);
refreshedEffectScene.turnSerial = 7;
refreshedEffectScene.actors[1].effects = ["negative.замедлен"];
const refreshedEffect = Engine.dispatch(refreshedEffectScene, { type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.замедлен", sourceActionId: "qa.refresh" } });
assert.equal(refreshedEffect.event.payload.applied, true, "Reapplying an existing Effect still counts as applying it");
assert.equal(refreshedEffect.event.payload.added, false);
assert.equal(refreshedEffect.event.payload.refreshed, true);
assert.equal(Engine.effectStatus(refreshedEffect.scene, "enemy", "negative.замедлен").state.appliedTurnSerial, 7);

const sameTurnEffectScene = structuredClone(scene);
sameTurnEffectScene.turnSerial = 4;
sameTurnEffectScene.actors[0].effects = [];
const appliedThisTurn = Engine.dispatchMany(sameTurnEffectScene, [{ type: "effect.apply", actorId: "enemy", payload: { targetId: "hero", effect: "negative.замедлен" } }]).scene;
const retainedThisTurn = Engine.dispatchMany(appliedThisTurn, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.ok(retainedThisTurn.actors[0].effects.includes("negative.замедлен"), "An Effect cannot expire at the end of the same Turn in which it was applied");
retainedThisTurn.activeActorId = "hero";
retainedThisTurn.turnSerial = 5;
const expiredNextTurn = Engine.dispatchMany(retainedThisTurn, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.ok(!expiredNextTurn.actors[0].effects.includes("negative.замедлен"), "A default Effect expires at the end of the following own Turn");
assert.ok(expiredNextTurn.log.some(event => event.type === "effect.remove" && event.payload?.automatic && event.payload?.boundaryEventId), "Automatic expiry is a journaled event with its boundary");
const extraTurnEffectScene = structuredClone(appliedThisTurn);
extraTurnEffectScene.actors[0].extraTurns = 1;
const startedExtraTurn = Engine.dispatchMany(extraTurnEffectScene, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.ok(startedExtraTurn.actors[0].effects.includes("negative.замедлен"), "The first end boundary still belongs to the Turn of application");
assert.equal(startedExtraTurn.turnSerial, 5, "An immediately granted extra Turn gets its own lifecycle serial");
const expiredAfterExtraTurn = Engine.dispatchMany(startedExtraTurn, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.ok(!expiredAfterExtraTurn.actors[0].effects.includes("negative.замедлен"), "The same Effect can expire at the end of the distinct extra Turn");

const startBoundaryScene = structuredClone(scene);
startBoundaryScene.activeActorId = null;
startBoundaryScene.turnSerial = 3;
startBoundaryScene.actors[0].effects = ["negative.подброшен", "negative.ошеломлен"];
startBoundaryScene.actors[0].effectStates = {
  "negative.подброшен": { duration: "startTurn", appliedTurnSerial: 2, sources: [] },
  "negative.ошеломлен": { duration: "default", appliedTurnSerial: 2, sources: [] },
};
const startBoundary = Engine.dispatchMany(startBoundaryScene, [{ type: "turn.start", actorId: "hero", payload: {} }]).scene;
assert.equal(startBoundary.actors[0].ap, 2, "Stunned reduces AP when the actor starts their Turn");
assert.ok(!startBoundary.actors[0].effects.includes("negative.подброшен"), "Launched expires at the start of its owner's Turn");
assert.ok(startBoundary.actors[0].effects.includes("negative.ошеломлен"));

const disappearedStartScene = structuredClone(scene);
disappearedStartScene.activeActorId = null;
disappearedStartScene.actors[0].effects = ["positive.исчез"];
disappearedStartScene.actors[0].effectStates = { "positive.исчез": { duration: "actionOrStartTurn", appliedTurnSerial: 0, sources: [] } };
const disappearedAtStart = Engine.dispatchMany(disappearedStartScene, [{ type: "turn.start", actorId: "hero", payload: {} }]).scene;
assert.equal(disappearedAtStart.pendingPrompt?.kind, "reappear-cell", "Disappeared opens its required reappearance placement at the start of its owner's Turn");
assert.ok(disappearedAtStart.actors[0].effects.includes("positive.исчез"), "Disappeared remains until its reappearance placement resolves");
const reappearance = Engine.preparePromptPlacement(disappearedAtStart, { destination: { x: 6, y: 6 } });
assert.equal(reappearance.ok, true);
const reappeared = Engine.dispatchMany(disappearedAtStart, reappearance.events).scene;
assert.ok(!reappeared.actors[0].effects.includes("positive.исчез"), "Resolving the required placement removes Disappeared");
assert.deepEqual({ x: reappeared.actors[0].x, y: reappeared.actors[0].y }, { x: 6, y: 6 });
const disappearedActionScene = structuredClone(scene);
disappearedActionScene.actors[0].effects = ["positive.исчез"];
disappearedActionScene.actors[0].effectStates = { "positive.исчез": { duration: "actionOrStartTurn", appliedTurnSerial: 0, sources: [] } };
const disappearedOnAction = Engine.dispatchMany(disappearedActionScene, [{ type: "action.prepare", actorId: "hero", payload: { actionId: "action.test", actionName: "Проверка", name: "Проверка" } }]).scene;
assert.ok(!disappearedOnAction.actors[0].effects.includes("positive.исчез"), "Disappeared expires when its owner begins an Action");
assert.equal(disappearedOnAction.log.filter(event => event.type === "effect.remove" && event.payload?.effect === "positive.исчез").length, 1, "Disappeared produces one removal event per Action boundary");

const persistentEffectScene = structuredClone(scene);
persistentEffectScene.turnSerial = 4;
persistentEffectScene.actors[0].effects = ["positive.регенерирует", "negative.порчен"];
persistentEffectScene.actors[0].effectStates = {
  "positive.регенерирует": { duration: "persistent", appliedTurnSerial: 1, sources: [] },
  "negative.порчен": { duration: "persistent", appliedTurnSerial: 1, sources: [] },
};
persistentEffectScene.actors[0].hp = 8;
const persistentEffectEnd = Engine.dispatchMany(persistentEffectScene, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.equal(persistentEffectEnd.actors[0].hp, 9, "Regenerating resolves before end-of-Turn lifecycle processing");
assert.ok(persistentEffectEnd.actors[0].effects.includes("positive.регенерирует"));
assert.ok(persistentEffectEnd.actors[0].effects.includes("negative.порчен"));

const lockedEffectScene = Engine.dispatch(scene, { type: "effect.apply", actorId: "hero", payload: { targetId: "hero", effect: "positive.укреплен", duration: "scene", removable: false } }).scene;
assert.throws(() => Engine.dispatch(lockedEffectScene, { type: "effect.remove", actorId: "hero", payload: { targetId: "hero", effect: "positive.укреплен" } }), /нельзя снять/, "An Effect explicitly locked until Scene end cannot be manually removed");

const sourcedEffectScene = structuredClone(scene);
sourcedEffectScene.actors.push({ ...structuredClone(scene.actors[0]), id: "ally-source", name: "Второй источник", x: 0, y: 0 });
let sourcedEffect = Engine.dispatchMany(sourcedEffectScene, [
  { type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.спровоцирован" } },
  { type: "effect.apply", actorId: "ally-source", payload: { targetId: "enemy", effect: "negative.спровоцирован" } },
]).scene;
assert.deepEqual(Array.from(Engine.effectStatus(sourcedEffect, "enemy", "negative.спровоцирован").sourceActorIds).sort(), ["ally-source", "hero"]);
sourcedEffect = Engine.dispatchMany(sourcedEffect, [{ type: "actor.knockout", actorId: "enemy", payload: { targetId: "hero" } }]).scene;
assert.ok(sourcedEffect.actors.find(actor => actor.id === "enemy").effects.includes("negative.спровоцирован"), "A source-bound Effect remains while another valid source still applies it");
assert.deepEqual(Array.from(Engine.effectStatus(sourcedEffect, "enemy", "negative.спровоцирован").sourceActorIds), ["ally-source"]);
sourcedEffect = Engine.dispatchMany(sourcedEffect, [{ type: "actor.knockout", actorId: "enemy", payload: { targetId: "ally-source" } }]).scene;
assert.ok(!sourcedEffect.actors.find(actor => actor.id === "enemy").effects.includes("negative.спровоцирован"), "The last source knockout removes its source-bound Effect");
const caughtSourceScene = Engine.dispatchMany(scene, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.пойман" } }]).scene;
const disappearedCatcher = Engine.dispatchMany(caughtSourceScene, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "hero", effect: "positive.исчез" } }]).scene;
assert.ok(!disappearedCatcher.actors[1].effects.includes("negative.пойман"), "Caught ends when its source is no longer on the field");
const banishedSourceScene = Engine.dispatchMany(scene, [
  { type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "positive.изгнан" } },
  { type: "actor.knockout", actorId: "enemy", payload: { targetId: "hero" } },
]).scene;
assert.ok(banishedSourceScene.actors[1].effects.includes("positive.изгнан"), "Banishment tracks its source but does not invent source-knockout expiry");

const reaperEffectScene = structuredClone(scene);
reaperEffectScene.turnSerial = 4;
reaperEffectScene.activeActorId = "enemy";
reaperEffectScene.actors[0].techniques = { "disruptor.reaper": 2 };
reaperEffectScene.actors[1].effects = ["negative.помечен"];
reaperEffectScene.actors[1].effectStates = { "negative.помечен": { duration: "default", appliedTurnSerial: 1, sources: [{ actorId: "hero" }] } };
const reaperRetained = Engine.dispatchMany(reaperEffectScene, [{ type: "turn.end", actorId: "enemy", payload: {} }]).scene;
assert.ok(reaperRetained.actors[1].effects.includes("negative.помечен"), "Reaper II is a thin retention adapter over the shared Effect lifecycle");
reaperRetained.activeActorId = "enemy";
reaperRetained.turnSerial = 5;
reaperRetained.actors[0].x = 6;
reaperRetained.actors[0].y = 6;
const reaperExpired = Engine.dispatchMany(reaperRetained, [{ type: "turn.end", actorId: "enemy", payload: {} }]).scene;
assert.ok(!reaperExpired.actors[1].effects.includes("negative.помечен"));

const invisibleEffectScene = structuredClone(scene);
invisibleEffectScene.actors[0].effects = ["positive.невидим"];
const invisibleLost = Engine.dispatchMany(invisibleEffectScene, [{ type: "effect.remove", actorId: "hero", payload: { targetId: "hero", effect: "positive.невидим" } }]).scene;
assert.equal(invisibleLost.pendingPrompt?.kind, "invisible-on-loss");
const invisibleChoice = Engine.respondRulePrompt(invisibleLost, data, { choice: "disappear" });
assert.equal(invisibleChoice.ok, true);
const disappearedFromInvisible = Engine.dispatchMany(invisibleLost, invisibleChoice.events).scene;
assert.ok(disappearedFromInvisible.actors[0].effects.includes("positive.исчез"), "Losing Invisible exposes its complete Reaction path through the shared choice flow");

const chronomancerEffectScene = structuredClone(scene);
chronomancerEffectScene.actors[0].techniques = { "altruist.chronomancer": 2 };
chronomancerEffectScene.actors[1].effects = ["negative.замедлен"];
const chronomancerLoss = Engine.dispatchMany(chronomancerEffectScene, [{ type: "effect.remove", actorId: "enemy", payload: { targetId: "enemy", effect: "negative.замедлен" } }]).scene;
assert.equal(chronomancerLoss.pendingPrompt?.kind, "chronomancer-reapply-effect");
const chronomancerChoice = Engine.respondRulePrompt(chronomancerLoss, data, { choice: "reapply" });
assert.equal(chronomancerChoice.ok, true);
const chronomancerReapplied = Engine.dispatchMany(chronomancerLoss, chronomancerChoice.events).scene;
assert.equal(chronomancerReapplied.actors[0].focus, 49);
assert.ok(chronomancerReapplied.actors[1].effects.includes("negative.замедлен"));
assert.ok(chronomancerReapplied.log.some(event => event.type === "technique.resolve" && event.payload?.ruleId === "altruist.chronomancer.2"));

const mindBreakerScene = structuredClone(scene);
mindBreakerScene.actors[0].techniques = { "disruptor.mind-breaker": 2 };
const mindBreakerBanished = Engine.dispatchMany(mindBreakerScene, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "positive.изгнан", sourceActionId: "disruptor.mind-breaker.1" } }]).scene;
assert.ok(Engine.effectiveEffects(mindBreakerBanished, "enemy").includes("negative.помечен"), "Mind Breaker II derives Marked from its source-aware Banishment relation");

const banishedPolicyScene = structuredClone(scene);
banishedPolicyScene.actors[1].effects = ["positive.изгнан"];
assert.equal(Engine.effectTargetingStatus(banishedPolicyScene, "hero", "enemy").available, false, "A non-Banished actor cannot target a Banished actor");
assert.equal(Engine.effectCellOccupancyStatus(banishedPolicyScene, "hero", { space: "main", x: 2, y: 1 }).available, true, "Banished and non-Banished actors may share a cell");
banishedPolicyScene.actors[0].effects = ["positive.изгнан"];
assert.equal(Engine.effectTargetingStatus(banishedPolicyScene, "hero", "enemy").available, true, "Banished actors can target one another");
assert.equal(Engine.effectCellOccupancyStatus(banishedPolicyScene, "hero", { space: "main", x: 2, y: 1 }).available, true, "Banished actors may share a cell with one another");
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 2, y: 1 } }), /занята/);

const movementEffectScene = structuredClone(scene);
movementEffectScene.actors[0].effects = ["positive.ускорен"];
assert.equal(Engine.effectMovementStatus(movementEffectScene, "hero", { distance: 4 }).distance, 8, "Accelerated doubles every shared movement allowance");
movementEffectScene.actors[0].effects = ["negative.замедлен"];
assert.equal(Engine.effectMovementStatus(movementEffectScene, "hero", { distance: 5 }).distance, 2, "Slowed halves and rounds down every shared movement allowance");
movementEffectScene.actors[0].effects = ["positive.ускорен", "negative.замедлен"];
assert.equal(Engine.effectMovementStatus(movementEffectScene, "hero", { distance: 4 }).distance, 4, "Accelerated and Slowed cancel rather than one silently winning");

const disappearedPolicyScene = structuredClone(scene);
disappearedPolicyScene.actors[1].effects = ["positive.исчез"];
assert.equal(Engine.effectPresenceStatus(disappearedPolicyScene, "enemy").onField, false);
assert.equal(Engine.effectTargetingStatus(disappearedPolicyScene, "hero", "enemy").available, false, "Disappeared actors are removed from shared targeting");
assert.deepEqual(Array.from(Engine.actorIdsInRange(disappearedPolicyScene, "hero", 5, { audience: "enemies" })), [], "Spatial target queries omit Disappeared actors");

const invisibleFreeScene = structuredClone(scene);
invisibleFreeScene.actors[0].effects = ["positive.невидим"];
const invisibleFree = Engine.prepareInvisibleDisappear(invisibleFreeScene, "hero");
assert.equal(invisibleFree.ok, true);
const invisibleFreeResult = Engine.dispatchMany(invisibleFreeScene, invisibleFree.events).scene;
assert.ok(invisibleFreeResult.actors[0].effects.includes("positive.исчез"));
assert.ok(!invisibleFreeResult.actors[0].effects.includes("positive.невидим"));
assert.ok(!invisibleFreeResult.pendingPrompt, "Freely losing Invisible does not recursively offer the loss Reaction");

const attackEffectScene = structuredClone(scene);
attackEffectScene.actors[0].tier = 2;
attackEffectScene.actors[0].effects = ["positive.усилен", "negative.ослаблен"];
attackEffectScene.actors[1].effects = ["negative.помечен"];
let attackEffects = Engine.dispatch(attackEffectScene, { type: "attack.pending", actorId: "hero", payload: { name: "Проверка Эффектов", targetIds: ["enemy"], damage: 3 } }).scene;
assert.equal(attackEffects.pendingAction.damageByTarget.enemy, 5, "Empowered and Weakened cancel while Marked adds the attacker's Tier");
const empoweredOnlyScene = structuredClone(attackEffectScene);
empoweredOnlyScene.actors[0].effects = ["positive.усилен"];
attackEffects = Engine.dispatch(empoweredOnlyScene, { type: "attack.pending", actorId: "hero", payload: { name: "Проверка Усиления", targetIds: ["enemy"], damage: 3 } }).scene;
assert.equal(attackEffects.pendingAction.damageByTarget.enemy, 7, "Empowered and Marked are applied once in the universal Attack pipeline");
const dividedAttackEffects = Engine.dispatch(empoweredOnlyScene, { type: "attack.pending", actorId: "hero", payload: { name: "Проверка порядка урона", targetIds: ["enemy"], damage: 2, damageByTarget: { enemy: 2 }, effectDamageBase: 3, effectDamageBaseByTarget: { enemy: 3 }, effectDamageDivisor: 2 } }).scene;
assert.equal(dividedAttackEffects.pendingAction.damageByTarget.enemy, 4, "universal effect damage is applied before a technique halves the result");

const defenseEffectScene = structuredClone(scene);
defenseEffectScene.actors[1].tier = 2;
defenseEffectScene.actors[1].armor = 2;
defenseEffectScene.actors[1].evasion = 0;
defenseEffectScene.actors[1].effects = ["positive.укреплен"];
let defended = Engine.dispatch(defenseEffectScene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 6 } }).scene;
assert.equal(defended.actors[1].hp, 8, "Fortified adds the target's Tier to Armor for shared damage resolution");
const rupturedDefenseScene = structuredClone(defenseEffectScene);
rupturedDefenseScene.actors[1].effects = ["positive.укреплен", "negative.разорван"];
defended = Engine.dispatch(rupturedDefenseScene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 6 } }).scene;
assert.equal(defended.actors[1].hp, 4, "Ruptured suppresses both base and Fortified Armor");

const resistantScene = structuredClone(scene);
resistantScene.actors[1].effects = ["positive.устойчив"];
assert.equal(Engine.displacementStatus(resistantScene, { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1 }).available, false, "Resistant blocks forced displacement");
assert.throws(() => Engine.dispatch(resistantScene, { type: "actor.move", actorId: "enemy", payload: { space: "main", x: 3, y: 1, forced: true } }), /Устойчив/);

const corruptedScene = structuredClone(scene);
corruptedScene.actors[0].tier = 2;
corruptedScene.actors[0].hp = 10;
corruptedScene.actors[0].armor = 20;
corruptedScene.actors[0].evasion = 20;
corruptedScene.actors[0].effects = ["negative.порчен"];
const corruptedAttack = Engine.dispatchMany(corruptedScene, [{ type: "attack.pending", actorId: "hero", payload: { name: "Порченая Атака", targetIds: ["enemy"], damage: 1 } }]).scene;
assert.equal(corruptedAttack.actors[0].hp, 8, "Corrupted loses Health on every canonical Attack, bypassing Armor and Evasion");
assert.equal(corruptedAttack.actors[0].evasion, 20);

const controlEffectScene = structuredClone(scene);
controlEffectScene.actors[0].tier = 2;
controlEffectScene.actors.push({ ...structuredClone(scene.actors[1]), id: "provoker", name: "Провокатор", x: 3, y: 1 });
let controlled = Engine.dispatchMany(controlEffectScene, [
  { type: "effect.apply", actorId: "enemy", payload: { targetId: "hero", effect: "negative.испуган" } },
  { type: "effect.apply", actorId: "provoker", payload: { targetId: "hero", effect: "negative.спровоцирован" } },
]).scene;
assert.equal(Engine.effectAttackStatus(controlled, "hero", ["enemy"]).hindrance, 4, "Frightened and Taunted stack their separate Tier Hindrances");
assert.equal(Engine.effectAttackStatus(controlled, "hero", ["enemy", "provoker"]).hindrance, 2, "Targeting the provoking source removes only Taunted Hindrance");
assert.equal(Engine.effectAttackStatus(controlled, "hero", ["provoker"]).hindrance, 0, "Avoiding the frightening source and targeting the provoking source removes both Hindrances");

const immobilizedScene = structuredClone(scene);
immobilizedScene.actors[0].effects = ["negative.обездвижен"];
assert.equal(Engine.effectMovementStatus(immobilizedScene, "hero", { distance: 4 }).available, false);
assert.deepEqual(Array.from(Engine.movementPath(immobilizedScene, "hero", { x: 1, y: 2 }, { maxDistance: 4 })), []);
assert.equal(Engine.effectDefenseStatus(immobilizedScene, "hero").dodgeAllowed, false, "Immobilized blocks both voluntary movement and Dodge benefit");

const launchedOrderScene = structuredClone(scene);
launchedOrderScene.activeActorId = null;
launchedOrderScene.actors[0].effects = ["negative.подброшен"];
launchedOrderScene.actors.push({ ...structuredClone(scene.actors[0]), id: "ally", name: "Союзник", x: 0, y: 0, effects: [], acted: false });
assert.equal(Engine.turnStartStatus(launchedOrderScene, "hero").available, false, "Launched actors wait for every ready non-Launched ally");
launchedOrderScene.actors.find(actor => actor.id === "ally").acted = true;
assert.equal(Engine.turnStartStatus(launchedOrderScene, "hero").available, true);
assert.equal(Engine.effectDefenseStatus(launchedOrderScene, "hero").dodgeAllowed, false);

const caughtPolicyScene = structuredClone(scene);
caughtPolicyScene.actors[1].x = 5;
caughtPolicyScene.actors[1].y = 1;
let caughtPolicy = Engine.dispatchMany(caughtPolicyScene, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.пойман" } }]).scene;
assert.equal(Math.abs(caughtPolicy.actors[0].x - caughtPolicy.actors[1].x) + Math.abs(caughtPolicy.actors[0].y - caughtPolicy.actors[1].y), 1, "Caught pulls its target adjacent when applied");
assert.equal(Engine.effectMovementStatus(caughtPolicy, "enemy", { distance: 3 }).available, false);
assert.equal(Engine.effectDefenseStatus(caughtPolicy, "enemy").dodgeAllowed, false);
caughtPolicy = Engine.dispatchMany(caughtPolicy, [{ type: "actor.move", actorId: "hero", payload: { space: "main", x: 1, y: 4, movement: "Шаг источника" } }]).scene;
assert.equal(Math.abs(caughtPolicy.actors[0].x - caughtPolicy.actors[1].x) + Math.abs(caughtPolicy.actors[0].y - caughtPolicy.actors[1].y), 1, "Caught follows its source and remains adjacent");

const previewSource = structuredClone(scene);
const preview = Engine.previewEvents(previewSource, [{ type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2 } }]);
assert.equal(preview.ok, true);
assert.equal(preview.scene.actors[0].focus, 52);
assert.equal(previewSource.actors[0].focus, 50, "Previewing an event chain must not mutate the source Scene");
const rejectedPreview = Engine.previewEvents(previewSource, [{ type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 99 } }]);
assert.equal(rejectedPreview.ok, false);
assert.equal(rejectedPreview.scene.actors[0].ap, 3);
assert.match(rejectedPreview.errors[0], /нельзя оплатить/);
const limitedScene = structuredClone(scene);
limitedScene.log = [
  { id: "limit-1", type: "technique.resolve", actorId: "hero", payload: { ruleId: "qa.limit" } },
  { id: "limit-2", type: "technique.resolve", actorId: "hero", payload: { sourceActionId: "qa.limit" } },
];
const availableLimit = Engine.usageLimitStatus(limitedScene, "hero", { ruleId: "qa.limit", scope: "scene", maximum: 3 });
assert.equal(availableLimit.available, true);
assert.equal(availableLimit.used, 2);
assert.equal(availableLimit.remaining, 1);
limitedScene.log.unshift({ id: "limit-3", type: "technique.resolve", actorId: "hero", payload: { techniqueRuleId: "qa.limit" } });
assert.equal(Engine.usageLimitStatus(limitedScene, "hero", { ruleId: "qa.limit", scope: "scene", maximum: 3 }).available, false, "The shared usage-limit contract recognizes all canonical rule references");
const choiceScene = structuredClone(scene);
choiceScene.pendingPrompt = { id: "choice-1", kind: "qa-choice", sourceActorId: "hero", targetId: "enemy", options: ["accept", "pass"] };
assert.equal(Engine.ruleChoiceStatus(choiceScene, { choice: "accept" }).available, true);
assert.equal(Engine.ruleChoiceStatus(choiceScene, { choice: "invented" }).available, false, "A typed choice is revalidated against the live prompt");
choiceScene.actors.find(actor => actor.id === "enemy").knockedOut = true;
assert.equal(Engine.ruleChoiceStatus(choiceScene, { choice: "accept" }).available, false, "A typed choice cannot retain an unavailable target");
assert.deepEqual(Array.from(Engine.actorIdsInCells(scene, "main", ["2,1"], { sourceActorId: "hero", audience: "enemies" })), ["enemy"]);
assert.deepEqual(Array.from(Engine.actorIdsInRange(scene, "hero", 1, { audience: "enemies" })), ["enemy"]);
const squareShape = Engine.spatialShapeStatus(scene, { space: "main", shape: "square3", anchor: { x: 2, y: 2 }, targets: { sourceActorId: "hero", audience: "enemies" } });
assert.equal(squareShape.available, true);
assert.equal(squareShape.cells.length, 9);
assert.deepEqual(Array.from(squareShape.targetIds), ["enemy"]);
assert.deepEqual(Array.from(Engine.spatialShapeStatus(scene, { space: "main", shape: "line", anchor: { x: 3, y: 3 }, orientation: "diagonal-up", full: true }).cells), ["0,6", "1,5", "2,4", "3,3", "4,2", "5,1", "6,0"]);
assert.equal(Engine.spatialShapeStatus(scene, { space: "main", shape: "connected", cells: ["0,0", "1,0", "1,1"] }).available, true);
assert.equal(Engine.spatialShapeStatus(scene, { space: "main", shape: "connected", cells: ["0,0", "2,0"] }).available, false);
const polygonShape = Engine.spatialShapeStatus(scene, { space: "main", shape: "polygon", vertices: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }] });
assert.equal(polygonShape.available, true);
assert.ok(polygonShape.cells.includes("2,2") && polygonShape.cells.includes("1,1"), "Polygon includes its interior and rasterized boundary");
assert.equal(Engine.targetStatus(scene, { sourceActorId: "hero", targetIds: ["enemy"], audience: "enemies", range: 1 }).available, true);
assert.equal(Engine.targetStatus(scene, { sourceActorId: "hero", targetIds: ["hero"], audience: "enemies", range: 1 }).available, false);
assert.equal(Engine.targetStatus(scene, { sourceActorId: "hero", targetIds: "enemy", min: 2, max: 1 }).available, false);
const pushStatus = Engine.displacementStatus(scene, { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1 });
assert.equal(pushStatus.available, true);
assert.deepEqual(JSON.parse(JSON.stringify(pushStatus.destination)), { space: "main", x: 3, y: 1 });
assert.equal(Engine.displacementStatus(scene, { actorId: "hero", destination: { x: 2, y: 1 }, maximum: 1 }).available, false, "Directed movement cannot finish in an occupied cell");
const displacementPlan = Engine.prepareDisplacements(scene, [
  { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1, name: "Тестовый толчок" },
  { actorId: "hero", destination: { x: 2, y: 1 }, maximum: 1, name: "Тестовый сдвиг" },
], { ruleId: "qa.displacement" });
assert.equal(displacementPlan.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(displacementPlan.scene.actors.map(actor => [actor.id, actor.x, actor.y]))), [["hero", 2, 1], ["enemy", 3, 1]], "Sequential displacement validates each destination against the already planned positions");
const movementTraces = Engine.movementTraceStatus(displacementPlan.scene, { space: "main" });
assert.equal(movementTraces.available, true);
assert.equal(movementTraces.traces.find(trace => trace.actorId === "hero").teleport, false);
assert.deepEqual(JSON.parse(JSON.stringify(movementTraces.traces.find(trace => trace.actorId === "hero").points)), [{ x: 1, y: 1 }, { x: 2, y: 1 }], "The board can project the latest ordinary movement from the event journal");
assert.equal(movementTraces.traces.find(trace => trace.actorId === "hero").kind, "forced");
assert.deepEqual(JSON.parse(JSON.stringify(movementTraces.traces.find(trace => trace.actorId === "hero").parts)), [{ index: 1, from: { x: 1, y: 1 }, destination: { x: 2, y: 1 } }], "Movement traces expose journaled path parts for board labels");
assert.equal(Engine.prepareDisplacements(scene, [
  { actorId: "hero", destination: { x: 2, y: 1 }, maximum: 1 },
  { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1 },
]).ok, false, "An invalid sequence is rejected atomically");
const displacementTerrain = structuredClone(scene);
displacementTerrain.objects.push({ id: "wall", space: "main", type: "terrain", label: "Стена", cells: ["3,1"] });
assert.equal(Engine.displacementStatus(displacementTerrain, { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1 }).available, false, "Forced movement respects blocking terrain");
const optionalDisplacements = Engine.prepareDisplacements(displacementTerrain, [
  { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1, allowPartial: true, optional: true },
]);
assert.equal(optionalDisplacements.ok, true);
assert.equal(optionalDisplacements.events.length, 0, "An optional member of a mass displacement may remain in place when immediately blocked");

const breacherScene = structuredClone(scene);
breacherScene.actors[0].techniques = { "powerhouse.breacher": 1 };
breacherScene.actors[1].x = 3;
const breacherAttack = prepareAttack(breacherScene, "hero", "enemy");
assert.equal(breacherAttack.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(breacherAttack.events.find(event => event.type === "attack.pending").payload.postDisplacements)), [{ targetId: "enemy", mode: "push", maximum: 1, name: "Картечь", ruleId: "powerhouse.breacher.1", collisionDamagePerCell: 0 }]);
let breacherFlow = Engine.dispatchMany(breacherScene, breacherAttack.events).scene;
breacherFlow = Engine.dispatchMany(breacherFlow, Engine.respondReaction(breacherFlow, data, { actorId: "enemy", choice: "pass" }).events).scene;
const breacherResolution = Engine.resolvePendingAction(breacherFlow, data);
assert.equal(breacherResolution.ok, true);
assert.ok(breacherResolution.events.some(event => event.type === "actor.move" && event.actorId === "enemy" && event.payload?.x === 4 && event.payload?.movement === "Картечь"), "Breacher I pushes a close successful Skirmish target through post-hit displacement");
assert.ok(!breacherResolution.events.some(event => event.type === "damage.apply" && event.payload?.sourceActionId === "powerhouse.breacher.1"), "Breacher I adds no collision damage");
const rangedBreacher = structuredClone(breacherScene);
rangedBreacher.actors[1].x = 5;
assert.equal(prepareAttack(rangedBreacher, "hero", "enemy").ok, true, "Breacher I extends Skirmish targeting to range 4");

const sirenStudyScene = structuredClone(scene);
sirenStudyScene.actors[0].techniques = { "disruptor.siren": 1 };
const sirenStudy = Engine.prepareAction(sirenStudyScene, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
assert.equal(sirenStudy.ok, true);
let sirenStudyFlow = Engine.dispatchMany(sirenStudyScene, sirenStudy.events).scene;
assert.equal(sirenStudyFlow.pendingPrompt?.kind, "siren-study-frighten");
assert.ok(sirenStudyFlow.log.some(event => event.type === "rule.trigger" && event.payload?.triggerId === "disruptor.siren.1.study" && event.payload?.status === "fired"), "A routed trigger records its source event and outcome");
assert.equal(Engine.ruleChoiceStatus(sirenStudyFlow, { choice: "frighten" }).available, true);
const sirenFrighten = Engine.respondRulePrompt(sirenStudyFlow, data, { choice: "frighten" });
assert.equal(sirenFrighten.ok, true);
sirenStudyFlow = Engine.dispatchMany(sirenStudyFlow, sirenFrighten.events).scene;
assert.ok(sirenStudyFlow.actors.find(actor => actor.id === "enemy").effects.includes("negative.испуган"), "Siren I applies Frightened through a typed decision");
const sirenLimit = Engine.usageLimitStatus(sirenStudyFlow, "hero", { ruleId: "disruptor.siren.1", scope: "scene", maximum: 3 });
assert.equal(sirenLimit.used, 1);
assert.equal(sirenLimit.remaining, 2);
const exhaustedSiren = structuredClone(sirenStudyScene);
exhaustedSiren.log = [1, 2, 3].map(index => ({ id: `siren-limit-${index}`, type: "technique.resolve", actorId: "hero", payload: { ruleId: "disruptor.siren.1" } }));
const exhaustedStudy = Engine.prepareAction(exhaustedSiren, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
const exhaustedStudyScene = Engine.dispatchMany(exhaustedSiren, exhaustedStudy.events).scene;
assert.notEqual(exhaustedStudyScene.pendingPrompt?.kind, "siren-study-frighten", "Siren I cannot offer a fourth use in the Scene");

const stableTriggerScene = structuredClone(sirenStudyScene);
const stableTriggerSource = { id: "stable-trigger-source", type: "action.resolve", actorId: "hero", payload: { name: "Изучение", targetIds: ["enemy"] } };
const stableTriggeredOnce = Engine.dispatchMany(stableTriggerScene, [stableTriggerSource]).scene;
const stableTriggerAuditCount = stableTriggeredOnce.log.filter(event => event.type === "rule.trigger" && event.payload?.sourceEventId === stableTriggerSource.id).length;
const stableTriggeredTwice = Engine.dispatchMany(stableTriggeredOnce, [stableTriggerSource]).scene;
assert.equal(stableTriggeredTwice.log.filter(event => event.type === "rule.trigger" && event.payload?.sourceEventId === stableTriggerSource.id).length, stableTriggerAuditCount, "Duplicate source events cannot emit their triggers twice");

const arbitrationScene = structuredClone(scene);
arbitrationScene.actors[1].techniques = { "disruptor.siren": 2 };
arbitrationScene.actors.push({ ...structuredClone(arbitrationScene.actors[0]), id: "empath", name: "Эмпат", x: 0, y: 1, techniques: { "altruist.empath": 2 } });
const arbitrationSource = { id: "trigger-arbitration-source", type: "effect.apply", actorId: "enemy", payload: { targetId: "hero", effect: "negative.испуган" } };
const arbitrationApplied = Engine.dispatch(arbitrationScene, arbitrationSource);
const triggerRegistry = Engine.triggerRegistryStatus();
assert.equal(triggerRegistry.available, true);
assert.equal(triggerRegistry.count, 13);
assert.ok(triggerRegistry.eventTypes.includes("effect.apply"));
assert.ok(triggerRegistry.rules.every(rule => typeof rule.id === "string" && Number.isInteger(rule.priority) && Array.isArray(rule.eventTypes)));
assert.throws(() => Engine.defineTriggerRule({ id: "bad trigger", eventTypes: ["effect.apply"], priority: 1, match: () => true, build: () => [] }), /id декларативного триггера/);
assert.throws(() => Engine.defineTriggerRule({ id: "qa.trigger", eventTypes: ["unknown.event"], priority: 1, match: () => true, build: () => [] }), /неизвестные исходные события/);
const arbitrationStatus = Engine.triggerRouteStatus(arbitrationApplied.scene, arbitrationApplied.event);
assert.deepEqual(Array.from(arbitrationStatus.selected, proposal => proposal.triggerId), ["disruptor.siren.2.frightened"]);
assert.deepEqual(Array.from(arbitrationStatus.queued, proposal => proposal.triggerId), ["altruist.empath.2.protective-response"]);
const arbitrated = Engine.dispatchMany(arbitrationScene, [arbitrationSource]).scene;
assert.equal(arbitrated.pendingPrompt?.kind, "siren-irresistible", "The highest-priority prompt wins trigger arbitration");
assert.ok(arbitrated.log.some(event => event.type === "rule.trigger" && event.payload?.triggerId === "altruist.empath.2.protective-response" && event.payload?.status === "queued"), "A lower-priority prompt remains in the persistent trigger queue");
assert.equal(arbitrated.triggerQueue.length, 1);
const publicTriggerQueue = Engine.triggerQueueStatus(arbitrated);
assert.equal(publicTriggerQueue.available, true);
assert.equal(publicTriggerQueue.count, 1);
assert.equal(publicTriggerQueue.next.triggerId, "altruist.empath.2.protective-response");
assert.equal(publicTriggerQueue.next.available, true);
publicTriggerQueue.next.event.payload.title = "Changed outside the Scene";
assert.notEqual(arbitrated.triggerQueue[0].event.payload.title, "Changed outside the Scene", "The public trigger queue is a read-only projection");
const resumedArbitration = Engine.dispatchMany(arbitrated, Engine.respondRulePrompt(arbitrated, data, { choice: "pass" }).events).scene;
assert.equal(resumedArbitration.pendingPrompt?.kind, "empath-rush", "The next valid trigger opens after the higher-priority decision closes");
assert.equal(resumedArbitration.triggerQueue.length, 0);
const interruptedArbitration = structuredClone(arbitrated);
interruptedArbitration.actors.find(actor => actor.id === "empath").knockedOut = true;
assert.match(Engine.triggerQueueStatus(interruptedArbitration).next.reason, /Источник/);
const cancelledQueuedTrigger = Engine.dispatchMany(interruptedArbitration, Engine.respondRulePrompt(interruptedArbitration, data, { choice: "pass" }).events).scene;
assert.equal(cancelledQueuedTrigger.pendingPrompt, null);
assert.equal(cancelledQueuedTrigger.triggerQueue.length, 0);
assert.ok(cancelledQueuedTrigger.log.some(event => event.type === "rule.trigger" && event.payload?.triggerId === "altruist.empath.2.protective-response" && event.payload?.status === "cancelled" && /Источник/.test(event.payload.reason)), "An interrupted queued trigger is cancelled with an explicit reason");
assert.throws(() => Engine.dispatch(scene, { type: "rule.trigger", actorId: "hero", payload: { triggerId: "bad trigger", sourceEventId: "x", status: "fired" } }), /маршрутизации триггера/);

const sirenScene = structuredClone(scene);
sirenScene.actors[0].techniques = { "disruptor.siren": 2 };
sirenScene.actors[1].x = 5;
let sirenFlow = Engine.dispatchMany(sirenScene, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.испуган", sourceActionId: "disruptor.siren.1" } }]).scene;
assert.equal(sirenFlow.pendingPrompt?.kind, "siren-irresistible");
sirenFlow = Engine.dispatchMany(sirenFlow, Engine.respondRulePrompt(sirenFlow, data, { choice: "rush" }).events).scene;
assert.equal(sirenFlow.pendingPrompt?.kind, "siren-irresistible-cell");
assert.equal(Engine.preparePromptPlacement(sirenFlow, { destination: { x: 5, y: 2 } }).ok, false, "Siren II rejects a path whose steps do not approach the Siren");
const sirenPlacement = Engine.preparePromptPlacement(sirenFlow, { destination: { x: 2, y: 1 } });
assert.equal(sirenPlacement.ok, true);
sirenFlow = Engine.dispatchMany(sirenFlow, sirenPlacement.events).scene;
assert.equal(sirenFlow.actors.find(actor => actor.id === "enemy").x, 2);
assert.equal(sirenFlow.pendingPrompt?.kind, "siren-irresistible-stun", "Siren II keeps Stunned optional after ending adjacent");
sirenFlow = Engine.dispatchMany(sirenFlow, Engine.respondRulePrompt(sirenFlow, data, { choice: "stun" }).events).scene;
assert.ok(sirenFlow.actors.find(actor => actor.id === "enemy").effects.includes("negative.ошеломлен"), "Siren II applies the separately confirmed Stunned effect");
assert.ok(sirenFlow.log.some(event => event.type === "technique.resolve" && event.payload?.ruleId === "disruptor.siren.2"), "Siren II records its once-per-Turn use");

const warringScene = structuredClone(scene);
warringScene.actors[0].techniques = { "powerhouse.warring-ascendant": 1 };
let warringFlow = Engine.dispatchMany(warringScene, [{ type: "action.resolve", actorId: "hero", payload: { name: "Зарядка" } }]).scene;
assert.equal(warringFlow.pendingPrompt?.kind, "warring-transform");
const warringTransform = Engine.respondRulePrompt(warringFlow, data, { choice: "transform" });
assert.equal(warringTransform.ok, true);
warringFlow = Engine.dispatchMany(warringFlow, warringTransform.events).scene;
assert.equal(warringFlow.actors.find(actor => actor.id === "enemy").x, 5, "Warring Ascendant I uses the shared mass-push plan");
assert.equal(warringFlow.actors.find(actor => actor.id === "hero").ruleState.warringTransformed, true);
assert.equal(warringFlow.actors.find(actor => actor.id === "hero").ruleState.warringUsed, true);
assert.equal(Engine.topologyStatus(scene, { space: "main", cells: ["1,1"], operation: "remove" }).available, false, "Occupied cells cannot disappear before their actors are moved");
const topologyScene = structuredClone(scene);
topologyScene.actors[1].x = 6;
topologyScene.actors[1].y = 6;
const cutCells = Array.from({ length: 7 }, (_, y) => `2,${y}`);
const cutResult = Engine.dispatch(topologyScene, {
  id: "stable-topology-cut",
  type: "topology.cells.remove",
  actorId: "hero",
  payload: { id: "test-cut", space: "main", cells: cutCells, label: "Тестовый разрыв", source: "QA" },
});
assert.deepEqual(Array.from(Engine.removedCellKeys(cutResult.scene, "main")), cutCells);
assert.equal(Engine.movementPath(cutResult.scene, "hero", { x: 4, y: 1 }, { maxDistance: 20 }).length, 0, "Removed cells split movement topology even when terrain is ignored");
assert.throws(() => Engine.dispatch(cutResult.scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 2, y: 1 } }), /удалённую клетку/);
assert.throws(() => Engine.dispatch(cutResult.scene, { type: "topology.cells.remove", payload: { id: "overlap", space: "main", cells: ["2,2"], label: "Повтор" } }), /уже удалена/);
const restoredTopology = Engine.dispatch(cutResult.scene, { type: "topology.cells.restore", actorId: "hero", payload: { cutId: "test-cut" } }).scene;
assert.equal(Engine.removedCellKeys(restoredTopology, "main").size, 0);
assert.ok(Engine.movementPath(restoredTopology, "hero", { x: 4, y: 1 }, { maxDistance: 20 }).length > 0, "Restoring a cut restores pathfinding");
const crossingSource = structuredClone(topologyScene);
crossingSource.objects = [
  { id: "terrain-a", space: "main", type: "terrain", label: "Стена A", cells: ["2,1"] },
  { id: "terrain-b", space: "main", type: "terrain", label: "Стена B", cells: ["3,1"] },
  { id: "terrain-c", space: "main", type: "terrain", label: "Отдельная стена", cells: ["6,0"] },
];
assert.deepEqual(Array.from(Engine.terrainComponentStatus(crossingSource, { space: "main", cells: ["2,1"] }).objectIds), ["terrain-a", "terrain-b"]);
const crossingResult = Engine.dispatch(crossingSource, {
  type: "topology.cells.remove", actorId: "hero",
  payload: { id: "crossing-cut", space: "main", cells: cutCells, label: "Проходимый разрыв", crossing: "opposite", destroyConnectedTerrain: true },
});
assert.deepEqual(Array.from(crossingResult.event.payload.destroyedTerrainIds), ["terrain-a", "terrain-b"]);
assert.deepEqual(Array.from(crossingResult.scene.objects.map(object => object.id)), ["terrain-c"]);
assert.deepEqual(JSON.parse(JSON.stringify(Engine.topologyStepDestination(crossingResult.scene, { space: "main", from: { x: 1, y: 1 }, attempted: { x: 2, y: 1 } }))), { x: 3, y: 1, teleported: true, crossedCutIds: ["crossing-cut"] });
const tracedTeleport = Engine.dispatch(crossingResult.scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 3, y: 1, movement: "Телепортация через разрыв", topologyCrossings: [{ destination: "3,1", cutIds: ["crossing-cut"] }] } }).scene;
assert.equal(Engine.movementTraceStatus(tracedTeleport, { space: "main" }).traces.find(trace => trace.actorId === "hero").teleport, true, "Teleport traces are classified separately from ordinary movement");
assert.deepEqual(JSON.parse(JSON.stringify(Engine.movementPath(crossingResult.scene, "hero", { x: 4, y: 1 }, { maxDistance: 4 }))), [{ x: 3, y: 1, teleported: true, crossedCutIds: ["crossing-cut"] }, { x: 4, y: 1 }], "A crossable cut teleports movement to its nearest opposite cell");
const crossingStep = Engine.prepareAction(crossingResult.scene, data, { actorId: "hero", actionId: actionNamed("Шаг").id, targetIds: [], destination: { x: 4, y: 1 } });
assert.equal(crossingStep.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(crossingStep.events.find(event => event.type === "actor.move").payload.topologyCrossings)), [{ destination: "3,1", cutIds: ["crossing-cut"] }], "Movement events journal the topological teleport explicitly");
assert.deepEqual(JSON.parse(JSON.stringify(Engine.resourceStatus(scene, "hero", { ap: 2, focus: 51 }).missing)), { focus: 1 });
assert.equal(Engine.resourceStatus(scene, "hero", ["ap"]).available, false);
assert.deepEqual(JSON.parse(JSON.stringify((({ active, direct, ambient }) => ({ active, direct, ambient }))(Engine.effectStatus(scene, "hero", "positive.ускорен")))), { active: false, direct: false, ambient: false });
const querySummary = Engine.summarizeEvents(scene, [
  { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 1, participantIds: ["hero"] } },
  { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 2, affectedCells: ["2,1"] } },
]);
assert.equal(querySummary.count, 2);
assert.deepEqual(JSON.parse(JSON.stringify(querySummary.eventTypes)), { "resource.spend": 1, "damage.apply": 1 });
assert.deepEqual(Array.from(querySummary.sourceIds), ["hero"]);
assert.deepEqual(Array.from(querySummary.targetIds), ["enemy"]);
assert.deepEqual(JSON.parse(JSON.stringify(querySummary.resourceDelta)), { hero: { ap: -1 } });
assert.deepEqual(Array.from(querySummary.affectedCells), ["2,1"]);
assert.equal(Engine.summarizeEvents(scene, null).count, 0);
const foundationScene = structuredClone(scene);
foundationScene.actors[0].ruleClocks = { pride: 2 };
foundationScene.actors[0].alternateResources = { bullets: 4 };
foundationScene.actors[0].ruleState = { stance: "ground" };
foundationScene.actors[0].effects = ["positive.ускорен"];
foundationScene.markers = [{ id: "summon", ownerActorId: "hero", kind: "summon", ruleId: "bulwark.servant-s-call.1" }];
foundationScene.objects = [{ id: "crate", ownerActorId: "hero", space: "main", type: "terrain", hp: 10, cells: ["2,1"], ruleId: "powerhouse.improvisational-fighter.1" }];
foundationScene.log = [
  { id: "spell", type: "action.prepare", actorId: "hero", payload: { actionName: "Заклинание", targetIds: ["enemy"] } },
  { id: "turn", type: "turn.start", actorId: "hero", payload: {} },
];
const legacyClockStatus = Engine.clockStatus(foundationScene, "hero", "pride", { size: 6, delta: 1 });
assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(["available", "id", "size", "value", "nextValue", "remaining", "empty", "full"].map(key => [key, legacyClockStatus[key]])))), { available: true, id: "pride", size: 6, value: 2, nextValue: 3, remaining: 3, empty: false, full: false });
assert.equal(Engine.alternateResourceStatus(foundationScene, "hero", { resource: "bullets", amount: 3, replaces: ["focus"] }).remaining, 1);
assert.deepEqual(Array.from(Engine.stanceStatus(foundationScene, "hero", "flight", { requiredEffects: ["positive.ускорен"] }).conflicts), ["ground"]);
assert.deepEqual(Array.from(Engine.ownedEntities(foundationScene, "hero", { kinds: ["summon"] }).markers), ["summon"]);
assert.equal(Engine.actionHistoryStatus(foundationScene, "hero", { scope: "turn", actionNames: ["Заклинание"], targetIds: ["enemy"] }).matched, true);
assert.equal(Engine.terrainStatus(foundationScene, { actorId: "hero", objectId: "crate", range: 1 }).available, true);

const configuredResource = Engine.dispatch(scene, {
  type: "rule-resource.configure",
  actorId: "hero",
  payload: { resource: "crystals", label: "Crystals", initial: 3, minimum: 0, maximum: 5, replaces: ["focus"], resetScope: "scene" },
}).scene;
assert.equal(Engine.ruleResourceStatus(configuredResource, "hero", { resource: "crystals" }).balance, 3);
const configuredSpentOnce = Engine.dispatch(configuredResource, { id: "stable-crystal-spend", type: "rule-resource.spend", actorId: "hero", payload: { resource: "crystals", amount: 2 } }).scene;
const configuredSpentTwice = Engine.dispatch(configuredSpentOnce, { id: "stable-crystal-spend", type: "rule-resource.spend", actorId: "hero", payload: { resource: "crystals", amount: 2 } });
assert.equal(configuredSpentTwice.duplicate, true);
assert.equal(Engine.ruleResourceStatus(configuredSpentTwice.scene, "hero", { resource: "crystals" }).balance, 1, "Named resource events are idempotent");
const configuredSet = Engine.dispatch(configuredSpentTwice.scene, { type: "rule-resource.set", actorId: "hero", payload: { resource: "crystals", value: 5 } }).scene;
const configuredReset = Engine.dispatch(configuredSet, { type: "rule-resource.reset", actorId: "hero", payload: { resource: "crystals", scope: "scene" } }).scene;
assert.equal(Engine.ruleResourceStatus(configuredReset, "hero", { resource: "crystals" }).balance, 3, "Set and reset share the validated resource definition");

const configuredClock = Engine.dispatch(scene, {
  type: "rule-clock.configure", actorId: "hero",
  payload: { clockId: "test.momentum", label: "Импульс", size: 4, minimumSize: 2, initial: 1, resetScope: "scene", value: 1 },
}).scene;
assert.equal(Engine.clockStatus(configuredClock, "hero", "test.momentum").value, 1);
const clockTickedOnce = Engine.dispatch(configuredClock, { id: "stable-clock-tick", type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 2 } }).scene;
const clockTickedTwice = Engine.dispatch(clockTickedOnce, { id: "stable-clock-tick", type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 2 } });
assert.equal(clockTickedTwice.duplicate, true);
assert.equal(Engine.clockStatus(clockTickedTwice.scene, "hero", "test.momentum").value, 3, "Clock ticks are idempotent");
assert.equal(clockTickedTwice.scene.log[0].payload.appliedDelta, 2);
assert.throws(() => Engine.dispatch(configuredClock, { type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: -2 } }), /недостаточно сегментов/i);
const clockFilled = Engine.dispatch(clockTickedTwice.scene, { type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 1 } }).scene;
assert.equal(clockFilled.log[0].payload.filled, true);
const clockReset = Engine.dispatch(clockFilled, { type: "rule-clock.reset", actorId: "hero", payload: { clockId: "test.momentum", scope: "scene" } }).scene;
assert.equal(Engine.clockStatus(clockReset, "hero", "test.momentum").value, 1);
assert.throws(() => Engine.dispatch(configuredClock, { type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 1 } }, { expectedVersion: 99 }), error => error.code === "SCENE_VERSION_CONFLICT");

const braggartScene = structuredClone(scene);
braggartScene.actors[0].techniques = { "powerhouse.braggart": 3 };
braggartScene.actors[0].ruleClocks = { "powerhouse.braggart.pride": { clockId: "powerhouse.braggart.pride", label: "Гордость", size: 6, minimumSize: 2, initial: 0, resetScope: "scene", active: true, value: 5 } };
const proudAttack = Engine.dispatchMany(braggartScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: "low-attack", name: "Стычка", attribute: "mind", targetIds: ["enemy"] } }]).scene;
assert.equal(Engine.clockStatus(proudAttack, "hero", "powerhouse.braggart.pride").full, true);
assert.equal(proudAttack.pendingPrompt?.kind, "braggart-hold-back");
const heldBack = Engine.dispatchMany(proudAttack, Engine.respondRulePrompt(proudAttack, data, { choice: "hold-back" }).events).scene;
assert.equal(Engine.clockStatus(heldBack, "hero", "powerhouse.braggart.pride").size, 4);
assert.equal(Engine.clockStatus(heldBack, "hero", "powerhouse.braggart.pride").value, 0);
const refilledPride = Engine.dispatch(heldBack, { type: "rule-clock.set", actorId: "hero", payload: { clockId: "powerhouse.braggart.pride", value: 4 } }).scene;
assert.equal(Engine.ruleDiceAdvantage(refilledPride, "hero", { actionName: "Стычка" }).total, 2, "Shrunken full Pride grants the increased Advantage");

const staticScene = structuredClone(scene);
staticScene.actors[0].techniques = { "ruiner.thunder-blood": 3 };
const staticRest = Engine.prepareAction(staticScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const staticPrompt = Engine.dispatchMany(staticScene, staticRest.events).scene;
assert.equal(staticPrompt.pendingPrompt?.kind, "thunder-rest-static");
const staticFilled = Engine.dispatchMany(staticPrompt, Engine.respondRulePrompt(staticPrompt, data, { choice: "fill" }).events).scene;
assert.equal(Engine.clockStatus(staticFilled, "hero", "ruiner.thunder-blood.static").value, 4);
const staticImmune = Engine.dispatchMany(staticFilled, [{ type: "effect.apply", actorId: "enemy", payload: { targetId: "hero", effect: "negative.ошеломлен" } }]).scene;
assert.ok(!staticImmune.actors[0].effects.includes("negative.ошеломлен"), "Non-empty Static grants immunity to Stunned");
const chargedScene = structuredClone(scene);
chargedScene.actors[0].techniques = { "ruiner.thunder-blood": 2 };
chargedScene.actors[0].ruleClocks = { "ruiner.thunder-blood.static": { clockId: "ruiner.thunder-blood.static", label: "Статика", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 2 } };
chargedScene.actors.push({ ...structuredClone(chargedScene.actors[1]), id: "enemy-2", name: "Вторая цель", x: 4, y: 1 });
const chargedResolved = Engine.dispatchMany(chargedScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: actionNamed("Заклинание").id, name: "Заклинание", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 }, targetIds: ["enemy"] } }]).scene;
assert.equal(chargedResolved.pendingPrompt?.kind, "thunder-charged-spell");
assert.ok(chargedResolved.pendingPrompt.options.includes("chain:enemy"), "Chain is offered when another enemy is within 5 cells of the original target");
const discharged = Engine.dispatchMany(chargedResolved, Engine.respondRulePrompt(chargedResolved, data, { choice: "discharge:enemy" }).events).scene;
assert.equal(Engine.clockStatus(discharged, "hero", "ruiner.thunder-blood.static").value, 1);
assert.ok(discharged.actors.find(actor => actor.id === "enemy").effects.includes("negative.ошеломлен"));
assert.ok(!discharged.actors.find(actor => actor.id === "hero").effects.includes("negative.ошеломлен"), "Remaining Static removes the self-applied Stunned effect");
const surgeSelected = Engine.dispatchMany(chargedResolved, Engine.respondRulePrompt(chargedResolved, data, { choice: "surge:enemy" }).events).scene;
assert.equal(surgeSelected.pendingPrompt?.kind, "thunder-surge-cell");
assert.equal(Engine.clockStatus(surgeSelected, "hero", "ruiner.thunder-blood.static").value, 2, "Surge does not spend Static before a destination is committed");
const surgeCancelled = Engine.dispatchMany(surgeSelected, Engine.respondRulePrompt(surgeSelected, data, { choice: "cancel" }).events).scene;
assert.equal(Engine.clockStatus(surgeCancelled, "hero", "ruiner.thunder-blood.static").value, 2, "Cancelling Surge preserves Static");
const surged = Engine.dispatchMany(surgeSelected, Engine.preparePromptPlacement(surgeSelected, { destination: { x: 2, y: 2 } }).events).scene;
assert.equal(Engine.clockStatus(surged, "hero", "ruiner.thunder-blood.static").value, 1);
assert.deepEqual([surged.actors[0].x, surged.actors[0].y], [2, 2]);
const chainSelected = Engine.dispatchMany(chargedResolved, Engine.respondRulePrompt(chargedResolved, data, { choice: "chain:enemy" }).events).scene;
assert.equal(chainSelected.pendingPrompt?.kind, "thunder-chain-target");
const chainPrepared = Engine.respondRulePrompt(chainSelected, data, { choice: "target:enemy-2", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 4, 3, 1], successes: 2, crits: 1 } });
assert.equal(chainPrepared.ok, true);
const chainPending = Engine.dispatchMany(chainSelected, chainPrepared.events).scene;
assert.equal(chainPending.pendingAction?.techniqueRuleId, "ruiner.thunder-blood.2");
assert.equal(chainPending.pendingAction?.responses?.["enemy-2"]?.choice, "pending", "Chain creates a new attack with target Reactions");
const dischargeAreaScene = structuredClone(scene);
dischargeAreaScene.actors[0].tier = 2;
dischargeAreaScene.actors[0].techniques = { "ruiner.thunder-blood": 3 };
dischargeAreaScene.actors[0].ruleClocks = { "ruiner.thunder-blood.static": { clockId: "ruiner.thunder-blood.static", label: "Статика", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 3 } };
dischargeAreaScene.actors[1].effects = ["negative.ошеломлен"];
dischargeAreaScene.actors.push({ ...structuredClone(dischargeAreaScene.actors[0]), id: "ally", name: "Союзник", x: 0, y: 1, techniques: {}, ruleClocks: {} });
const dischargeArea = Engine.prepareAction(dischargeAreaScene, data, { actorId: "hero", actionId: actionNamed("Завершение").id, useThunderDischarge: true, attribute: "spirit", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(dischargeArea.ok, true);
const dischargePendingEvent = dischargeArea.events.find(event => event.type === "attack.pending");
assert.deepEqual(Array.from(dischargePendingEvent.payload.targetIds).sort(), ["ally", "enemy"]);
assert.equal(dischargePendingEvent.payload.damageByTarget.enemy, dischargePendingEvent.payload.damageByTarget.ally + 2, "Already Stunned targets take Tier bonus damage");
const eclipseScene = structuredClone(scene);
eclipseScene.actors[0].techniques = { "ruiner.void-soul": 3 };
eclipseScene.actors[0].ruleClocks = { "ruiner.void-soul.void": { clockId: "ruiner.void-soul.void", label: "Пустота", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 6 } };
eclipseScene.actors.push({ ...structuredClone(eclipseScene.actors[1]), id: "enemy-far", name: "Вне затмения", x: 6, y: 6 });
const eclipse = Engine.prepareAction(eclipseScene, data, { actorId: "hero", actionId: actionNamed("Завершение").id, useEclipseStars: true, attribute: "spirit", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(eclipse.ok, true);
const eclipsePending = eclipse.events.find(event => event.type === "attack.pending").payload;
assert.deepEqual(Array.from(eclipsePending.targetIds), ["enemy"]);
assert.equal(eclipsePending.damageByTarget.enemy, 2, "Eclipse deals half of the normal Finish damage");
const spellAdvantageScene = structuredClone(scene);
spellAdvantageScene.actors[0].techniques = { "altruist.chronomancer": 2, "ruiner.cryomancer": 2, "ruiner.feral-arcana": 3, "ruiner.thunder-blood": 2 };
assert.equal(Engine.ruleDiceAdvantage(spellAdvantageScene, "hero", { actionName: "Заклинание" }).total, 3, "Chronomancer II, Cryomancer II and Feral Arcana III grant Spell Advantage");
spellAdvantageScene.actors[0].techniques["ruiner.thunder-blood"] = 3;
assert.equal(Engine.ruleDiceAdvantage(spellAdvantageScene, "hero", { actionName: "Заклинание" }).total, 4, "Thunder Blood grants Spell Advantage only at level III");
const icicleScene = structuredClone(scene);
icicleScene.actors[0].techniques = { "ruiner.cryomancer": 2 };
icicleScene.actors[0].ruleClocks = { "ruiner.cryomancer.icicle": { clockId: "ruiner.cryomancer.icicle", label: "Сосулька", size: 4, minimumSize: 4, initial: 0, resetScope: "scene", active: true, value: 3 } };
icicleScene.actors[1].effects = ["negative.замедлен"];
const icicleRest = Engine.dispatchMany(icicleScene, Engine.prepareAction(icicleScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).events).scene;
assert.equal(icicleRest.pendingPrompt?.kind, "cryomancer-icicle-rest");
const icicleConverted = Engine.dispatchMany(icicleRest, Engine.respondRulePrompt(icicleRest, data, { choice: "convert" }).events).scene;
assert.equal(icicleConverted.pendingPrompt?.kind, "cryomancer-icicle-series");
assert.equal(icicleConverted.actors[0].focus, 50, "Converting Icicle refuses the Focus gained from Rest");
const icicleContinued = Engine.dispatchMany(icicleConverted, Engine.respondRulePrompt(icicleConverted, data, { choice: "continue" }).events).scene;
assert.equal(Engine.availableActions(icicleContinued, data, "hero").find(action => action.name === "Заклинание").quick, true);
assert.match(Engine.availableActions(icicleContinued, data, "hero").find(action => action.name === "Зарядка").reason, /Сосульки/);
const icicleSpell = Engine.prepareAction(icicleContinued, data, { actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], roll: { formula: "5D6", attribute: "spirit", rolls: [6, 5, 4, 2, 1], successes: 3, crits: 1 } });
const iciclePending = Engine.dispatchMany(icicleContinued, icicleSpell.events).scene;
assert.equal(iciclePending.pendingAction.damage, 2, "Icicle Spells deal half damage");
const iciclePassed = Engine.dispatchMany(iciclePending, Engine.respondReaction(iciclePending, data, { actorId: "enemy", choice: "pass" }).events).scene;
const icicleResolved = Engine.dispatchMany(iciclePassed, Engine.resolvePendingAction(iciclePassed, data).events).scene;
assert.equal(icicleResolved.actors[0].ruleState.icicleSpellsRemaining, 3);
assert.ok(icicleResolved.actors[1].effects.includes("negative.обездвижен"));
assert.equal(icicleResolved.pendingPrompt?.kind, "cryomancer-icicle-series");

const styleScene = structuredClone(scene);
styleScene.actors[0].techniques = { "vagabond.egomaniac": 2 };
styleScene.actors[0].ruleClocks = { "vagabond.egomaniac.style": { clockId: "vagabond.egomaniac.style", label: "Стиль", size: 4, minimumSize: 4, initial: 0, resetScope: "scene", active: true, value: 3 } };
const stylish = Engine.dispatchMany(styleScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: "stylish-hit", name: "Стычка", attribute: "talent", roll: { crits: 2 }, targetIds: ["enemy"] } }]).scene;
assert.equal(stylish.pendingPrompt?.kind, "egomaniac-style-full");
const stylishProvoke = Engine.dispatchMany(stylish, Engine.respondRulePrompt(stylish, data, { choice: "provoke" }).events).scene;
assert.equal(Engine.clockStatus(stylishProvoke, "hero", "vagabond.egomaniac.style").value, 0);
assert.ok(stylishProvoke.actors[1].effects.includes("negative.спровоцирован"));
const finaleScene = structuredClone(scene);
finaleScene.tension = 3;
finaleScene.actors[0].techniques = { "vagabond.egomaniac": 3 };
finaleScene.actors[0].ruleClocks = { "vagabond.egomaniac.style": { clockId: "vagabond.egomaniac.style", label: "Стиль", size: 4, minimumSize: 4, initial: 0, resetScope: "scene", active: true, value: 3 } };
const finaleOffered = Engine.dispatchMany(finaleScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: actionNamed("Зарядка").id, name: "Зарядка", targetIds: [] } }]).scene;
const finaleStarted = Engine.dispatchMany(finaleOffered, Engine.respondRulePrompt(finaleOffered, data, { choice: "finale" }).events).scene;
assert.equal(finaleStarted.pendingPrompt?.kind, "egomaniac-style-full");
assert.equal(finaleStarted.actors[0].ruleState.styleCarryRemaining, 5);
const finaleFirst = Engine.dispatchMany(finaleStarted, Engine.respondRulePrompt(finaleStarted, data, { choice: "provoke" }).events).scene;
assert.equal(finaleFirst.pendingPrompt?.kind, "egomaniac-style-full");
assert.equal(finaleFirst.actors[0].ruleState.styleCarryRemaining, 1);
const finaleSecond = Engine.dispatchMany(finaleFirst, Engine.respondRulePrompt(finaleFirst, data, { choice: "frighten" }).events).scene;
assert.equal(Engine.clockStatus(finaleSecond, "hero", "vagabond.egomaniac.style").value, 1);
assert.equal(Engine.clockStatus(finaleSecond, "hero", "vagabond.egomaniac.style").active, false, "Finale carries all segments through multiple fills, then disables Style");

const rageScene = structuredClone(scene);
rageScene.actors[0].techniques = { "ruiner.feral-arcana": 2 };
const unleashed = Engine.prepareAction(rageScene, data, { actorId: "hero", actionId: actionNamed("Взаимодействие").id, startRage: true, targetIds: ["enemy"] });
assert.equal(unleashed.ok, true, "Rage explicitly replaces a targetless Interaction");
const raging = Engine.dispatchMany(rageScene, unleashed.events).scene;
assert.equal(Engine.clockStatus(raging, "hero", "ruiner.feral-arcana.rage").value, 3);
assert.equal(Engine.availableActions(raging, data, "hero").find(action => action.name === "Прыжок").quick, true);
assert.match(Engine.availableActions(raging, data, "hero").find(action => action.name === "Передышка").reason, /Ярость/);
const rageJumped = Engine.dispatchMany(raging, [{ type: "action.resolve", actorId: "hero", payload: { actionId: actionNamed("Прыжок").id, name: "Прыжок", targetIds: [] } }]).scene;
assert.equal(rageJumped.pendingPrompt?.kind, "feral-rage-jump-spell", "A Rage Jump requires the follow-up Spell");
assert.deepEqual(Array.from(rageJumped.pendingPrompt.context.targetIds), ["enemy"]);
const rageSpell = Engine.respondRulePrompt(rageJumped, data, { choice: "attack", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(rageSpell.ok, true);
const rageSpellPending = Engine.dispatchMany(rageJumped, rageSpell.events).scene;
assert.equal(rageSpellPending.pendingAction?.techniqueRuleId, "ruiner.feral-arcana.2");
assert.equal(rageSpellPending.pendingAction?.responses?.enemy?.choice, "pending", "The mandatory Rage Spell still offers target Reactions");
const fadingRage = Engine.dispatch(raging, { type: "rule-clock.set", actorId: "hero", payload: { clockId: "ruiner.feral-arcana.rage", value: 1, active: true } }).scene;
const rageEnded = Engine.dispatchMany(fadingRage, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.equal(Engine.clockStatus(rageEnded, "hero", "ruiner.feral-arcana.rage").active, false);
assert.ok(rageEnded.actors[0].effects.includes("negative.ошеломлен"));

const sentryScene = structuredClone(scene);
sentryScene.actors[0].techniques = { "bulwark.stalwart-sentry": 2 };
sentryScene.actors[0].ruleClocks = { "bulwark.stalwart-sentry.vigilance": { clockId: "bulwark.stalwart-sentry.vigilance", label: "Бдительность", size: 4, minimumSize: 4, initial: 4, resetScope: "scene", active: true, value: 2 } };
const leftSentry = Engine.dispatchMany(sentryScene, [{ type: "actor.move", actorId: "enemy", payload: { space: "main", x: 4, y: 1, movement: "Шаг" } }]).scene;
assert.equal(leftSentry.pendingPrompt?.kind, "sentry-punishment");
const punishment = Engine.respondRulePrompt(leftSentry, data, { choice: "punish-free", roll: { formula: "4D6", attribute: "talent", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
const punishmentPending = Engine.dispatchMany(leftSentry, punishment.events).scene;
assert.equal(Engine.clockStatus(punishmentPending, "hero", "bulwark.stalwart-sentry.vigilance").value, 1);
assert.equal(punishmentPending.pendingAction?.name, "Наказание");
assert.equal(punishmentPending.pendingAction?.responses?.enemy?.choice, "pending");
const graspScene = structuredClone(scene);
graspScene.actors[0].techniques = { "ruiner.feral-arcana": 3 };
graspScene.actors[0].ruleClocks = { "ruiner.feral-arcana.rage": { clockId: "ruiner.feral-arcana.rage", label: "Ярость", size: 6, minimumSize: 6, initial: 0, resetScope: null, active: true, removeWhenEmpty: true, value: 4 } };
const grasp = Engine.prepareAction(graspScene, data, { actorId: "hero", actionId: actionNamed("Завершение").id, targetIds: ["enemy"], destination: { x: 2, y: 2 }, useGrasp: true, attribute: "body", roll: { formula: "5D6", attribute: "body", rolls: [6, 5, 4, 2, 1], successes: 3, crits: 1 } });
assert.equal(grasp.ok, true);
const graspMoved = Engine.dispatchMany(graspScene, grasp.events).scene;
assert.equal(Engine.clockStatus(graspMoved, "hero", "ruiner.feral-arcana.rage").value, 0);
assert.deepEqual([graspMoved.actors[0].x, graspMoved.actors[0].y], [2, 2]);
assert.ok(graspMoved.actors[0].effects.includes("negative.ошеломлен"));

const timeStopScene = structuredClone(scene);
timeStopScene.activeActorId = null;
timeStopScene.actors[0].techniques = { "altruist.chronomancer": 3 };
timeStopScene.actors[0].ruleClocks = { "altruist.chronomancer.flow": { clockId: "altruist.chronomancer.flow", label: "Поток", size: 8, minimumSize: 8, initial: 0, resetScope: "scene", active: true, value: 8 } };
const timeStopOffered = Engine.dispatchMany(timeStopScene, [{ type: "turn.start", actorId: "hero", payload: {} }]).scene;
assert.equal(timeStopOffered.pendingPrompt?.kind, "chronomancer-time-stop");
const timeStop = Engine.respondRulePrompt(timeStopOffered, data, { choice: "time-stop-all-in", roll: { formula: "5D6", attribute: "spirit", rolls: [6, 5, 4, 2, 1], successes: 3, crits: 1 } });
const timeStopped = Engine.dispatchMany(timeStopOffered, timeStop.events).scene;
assert.equal(timeStopped.actors[0].ap, 0);
assert.equal(timeStopped.actors[0].ruleState.timeStopUsed, true);
assert.equal(Engine.clockStatus(timeStopped, "hero", "altruist.chronomancer.flow").value, 0);
assert.equal(timeStopped.pendingAction.damageByTarget.enemy, 5);
assert.equal(timeStopped.pendingAction.damageByTarget.hero, 3);

const zealotScene = structuredClone(scene);
zealotScene.actors[0].tier = 1;
zealotScene.actors[0].techniques = { "ruiner.zealot": 1 };
zealotScene.actors[0].ruleClocks = { "ruiner.zealot.revelation": { clockId: "ruiner.zealot.revelation", label: "Озарение", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 2 } };
const zealotAction = Engine.dispatch(zealotScene, { id: "zealot-action-instance", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Заклинание").id, actionName: "Заклинание", name: "Заклинание", targetIds: ["enemy"] } }).scene;
const zealotFirstOne = Engine.dispatchMany(zealotAction, [{ type: "roll.public", actorId: "hero", payload: { formula: "4D6", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } }]).scene;
assert.equal(zealotFirstOne.pendingPrompt?.kind, "zealot-revelation-one");
const zealotFilledOnce = Engine.dispatchMany(zealotFirstOne, Engine.respondRulePrompt(zealotFirstOne, data, { choice: "fill" }).events).scene;
const zealotSecondOne = Engine.dispatchMany(zealotFilledOnce, [{ type: "roll.public", actorId: "hero", payload: { formula: "4D6", rolls: [5, 4, 3, 1], successes: 2, crits: 0 } }]).scene;
assert.equal(zealotSecondOne.pendingPrompt, null, "Revelation can fill only once per action instance");
assert.equal(Engine.clockStatus(zealotSecondOne, "hero", "ruiner.zealot.revelation").value, 3);
const invertedCharge = Engine.prepareAction(zealotScene, data, {
  actorId: "hero", actionId: actionNamed("Зарядка").id, useRevelation: true,
  roll: { formula: "4D6", attribute: "spirit", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(invertedCharge.ok, true);
assert.equal(invertedCharge.events.find(event => event.type === "roll.public").payload.successes, 8);
assert.equal(invertedCharge.events.find(event => event.type === "rule-clock.tick").payload.delta, -1);
const zealotRuptureScene = structuredClone(scene);
zealotRuptureScene.actors[0].tier = 1;
zealotRuptureScene.actors[0].techniques = { "ruiner.zealot": 3 };
zealotRuptureScene.actors[0].ruleClocks = { "ruiner.zealot.revelation": { clockId: "ruiner.zealot.revelation", label: "Озарение", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 6 } };
zealotRuptureScene.actors.push({ ...structuredClone(zealotRuptureScene.actors[0]), id: "ally-on-line", name: "Союзник на Линии", x: 3, y: 1, techniques: {}, ruleClocks: {} });
const zealotLineCells = [...new Set([
  ...Array.from({ length: 7 }, (_, x) => `${x},1`),
  ...Array.from({ length: 7 }, (_, y) => `2,${y}`),
])];
const ruptureAttack = Engine.prepareAction(zealotRuptureScene, data, {
  actorId: "hero", actionId: actionNamed("Завершение").id, targetIds: [], useZealotRupture: true, zealotCells: zealotLineCells, attribute: "spirit",
  roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(ruptureAttack.ok, true, ruptureAttack.errors?.join(" "));
assert.deepEqual(Array.from(ruptureAttack.events.find(event => event.type === "attack.pending").payload.targetIds).sort(), ["ally-on-line", "enemy", "hero"], "Zealot III replaces ordinary allegiance, count, and range targeting with the two-line audience");
assert.equal(ruptureAttack.events.find(event => event.type === "attack.pending").payload.zealotRupture, true);
const ruptureMoves = Engine.prepareDisplacements(zealotRuptureScene, [
  { actorId: "hero", destination: { x: 1, y: 0 }, maximum: 1, allowKnockedOut: true },
  { actorId: "enemy", destination: { x: 3, y: 0 }, maximum: 1, allowKnockedOut: true },
  { actorId: "ally-on-line", destination: { x: 3, y: 2 }, maximum: 1, allowKnockedOut: true },
], { ruleId: "ruiner.zealot.3" });
assert.equal(ruptureMoves.ok, true);
assert.equal(Engine.topologyStatus(ruptureMoves.scene, { space: "main", cells: zealotLineCells, operation: "remove" }).available, true, "Every occupied line cell becomes removable only after the complete displacement plan");

const bulletsScene = structuredClone(scene);
bulletsScene.actors[0].techniques = { "powerhouse.gunslinger": 1 };
assert.equal(Engine.ruleResourceStatus(bulletsScene, "hero", { resource: "bullets", amount: 1 }).balance, 6, "Gunslinger adapter supplies the canonical Scene balance");
const bulletsSpent = Engine.dispatch(bulletsScene, { type: "resource.spend", actorId: "hero", payload: { resource: "focus", amount: 2 } }).scene;
assert.equal(bulletsSpent.actors[0].focus, 50, "A replaced base resource is not mutated");
assert.equal(Engine.ruleResourceStatus(bulletsSpent, "hero", { resource: "bullets" }).balance, 4);
assert.equal(bulletsSpent.log[0].payload.resolvedResource, "bullets", "The event journal records the resolved resource");
assert.equal(bulletsSpent.log[0].payload.resolvedDelta, -2);
assert.throws(
  () => Engine.dispatch(bulletsScene, { type: "rule-resource.configure", actorId: "hero", payload: { resource: "other", label: "Other", replaces: ["focus"], initial: 1 } }),
  /conflict|конфликт/i,
  "Alternative resources with overlapping replacements are rejected",
);
assert.throws(
  () => Engine.dispatch(bulletsScene, { type: "rule-resource.spend", actorId: "hero", payload: { resource: "bullets", amount: 7 } }, { expectedVersion: 9 }),
  error => error.code === "SCENE_VERSION_CONFLICT",
  "Rule-resource commands honor optimistic Scene versions",
);
const atomicRuleResourcePreview = Engine.previewEvents(bulletsScene, [
  { type: "rule-resource.spend", actorId: "hero", payload: { resource: "bullets", amount: 4 } },
  { type: "rule-resource.spend", actorId: "hero", payload: { resource: "bullets", amount: 4 } },
]);
assert.equal(atomicRuleResourcePreview.ok, false);
assert.equal(Engine.ruleResourceStatus(atomicRuleResourcePreview.scene, "hero", { resource: "bullets" }).balance, 6, "A rejected event chain is atomic");
assert.equal(bulletsScene.actors[0].ruleResources, undefined, "Preview never mutates the source Scene");

const heatScene = structuredClone(scene);
heatScene.actors[0].techniques = { "vagabond.modified-meister": 1 };
const overheated = Engine.dispatchMany(heatScene, [{ type: "resource.spend", actorId: "hero", payload: { resource: "focus", amount: 6 } }]);
assert.equal(Engine.ruleResourceStatus(overheated.scene, "hero", { resource: "heat" }).balance, 3, "Heat 6 explodes and resets to 3");
assert.equal(overheated.scene.actors[0].hp, 10, "The Modified Meister explosion damages its owner by Mind");
assert.equal(overheated.scene.actors[1].hp, 9, "The explosion damages adjacent opponents through normal Armor");
assert.deepEqual(Array.from(overheated.events, event => event.type), ["resource.spend", "rule-resource.set", "damage.apply", "damage.apply"]);
const cooled = Engine.dispatch(overheated.scene, { type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2 } }).scene;
assert.equal(Engine.ruleResourceStatus(cooled, "hero", { resource: "heat" }).balance, 1, "Effects that grant Focus cool Heat");

const gritScene = structuredClone(scene);
gritScene.actors[0].techniques = { "bulwark.mundane": 1 };
assert.equal(Engine.ruleResourceStatus(gritScene, "hero", { resource: "grit" }).balance, 2);
assert.deepEqual(JSON.parse(JSON.stringify(Engine.resourceStatus(gritScene, "hero", { ap: 1, focus: 2 }).missing)), { grit: 1 }, "AP and Focus share one Grit pool");
const restCannotGrantGrit = Engine.dispatch(gritScene, { type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1, sourceActionName: "Передышка" } }).scene;
assert.equal(Engine.ruleResourceStatus(restCannotGrantGrit, "hero", { resource: "grit" }).balance, 2);
assert.match(restCannotGrantGrit.log[0].payload.ignoredReason, /Передышка/);
const gritSpent = Engine.dispatch(gritScene, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 1 } }).scene;
assert.equal(Engine.ruleResourceStatus(gritSpent, "hero", { resource: "grit" }).balance, 1);
gritSpent.actors.forEach(actor => { actor.acted = true; });
gritSpent.activeActorId = null;
gritSpent.log = [
  { id: "grit-enemy-turn", type: "turn.end", actorId: "enemy", payload: { endedTurnActorId: "enemy" } },
  { id: "grit-hero-turn", type: "turn.end", actorId: "hero", payload: { endedTurnActorId: "hero" } },
];
const gritReset = Engine.dispatch(gritSpent, { type: "round.end", payload: {} }).scene;
assert.equal(Engine.ruleResourceStatus(gritReset, "hero", { resource: "grit" }).balance, 2, "Grit resets from Body at Round boundary");
assert.deepEqual(JSON.parse(JSON.stringify(gritReset.log[0].payload.ruleResourceResets)), [{ actorId: "hero", resource: "grit", label: "Упорство", value: 2, scope: "round" }], "Round reset is explicit in the event journal");

const gunslingerActionScene = structuredClone(scene);
gunslingerActionScene.actors[0].techniques = { "powerhouse.gunslinger": 1 };
gunslingerActionScene.actors[1].x = 4;
const bigIron = Engine.prepareAction(gunslingerActionScene, data, {
  actorId: "hero",
  actionId: actionNamed("Стычка").id,
  targetIds: ["enemy"],
  bulletsSpent: 3,
  bulletAdvantage: 2,
  roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(bigIron.ok, true, "Big Iron replaces the Skirmish range and requires an explicit Bullet allocation");
assert.equal(bigIron.events.find(event => event.type === "rule-resource.spend").payload.amount, 3);
const bigIronPending = Engine.dispatchMany(gunslingerActionScene, bigIron.events).scene;
assert.equal(Engine.ruleResourceStatus(bigIronPending, "hero", { resource: "bullets" }).balance, 3);
const interruptedBigIron = Engine.dispatch(bigIronPending, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 99, ignoreArmor: true } }).scene;
const cancelledBigIron = Engine.cancelPendingAction(interruptedBigIron, { reason: "source interrupted" });
const afterBigIronCancel = Engine.dispatchMany(interruptedBigIron, cancelledBigIron.events).scene;
assert.equal(Engine.ruleResourceStatus(afterBigIronCancel, "hero", { resource: "bullets" }).balance, 3, "Cancellation closes the pending attack without silently refunding a committed cost");
assert.equal(afterBigIronCancel.pendingAction, null);
assert.equal(afterBigIronCancel.log[0].type, "attack.clear");

const knifeScene = structuredClone(scene);
knifeScene.actors[0].techniques = { "vagabond.knife-juggler": 2 };
const thrownKnife = Engine.prepareAction(knifeScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], throwWeapon: true,
  roll: { formula: "4D6", attribute: "talent", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(thrownKnife.ok, true);
assert.equal(thrownKnife.events.find(event => event.type === "resource.spend"), undefined, "Throw has zero base cost");
assert.equal(thrownKnife.events.find(event => event.type === "rule-resource.spend").payload.resource, "weapons");
let knifeFlow = Engine.dispatchMany(knifeScene, thrownKnife.events).scene;
knifeFlow = Engine.dispatchMany(knifeFlow, Engine.respondReaction(knifeFlow, data, { actorId: "enemy", choice: "pass" }).events).scene;
knifeFlow = Engine.dispatchMany(knifeFlow, Engine.resolvePendingAction(knifeFlow, {}).events).scene;
assert.equal(Engine.ruleResourceStatus(knifeFlow, "hero", { resource: "weapons" }).balance, 3);
assert.ok(knifeFlow.markers.some(marker => marker.kind === "weapon" && marker.ownerActorId === "hero"), "Knife Juggler II creates an owned Weapon marker after resolution");

const meisterScene = structuredClone(scene);
meisterScene.actors[0].techniques = { "vagabond.modified-meister": 3 };
const overloaded = Engine.prepareAction(meisterScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], overload: true,
  roll: { formula: "4D6", attribute: "talent", rolls: [6, 3, 2, 1], successes: 1, crits: 1 },
});
assert.equal(overloaded.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(overloaded.events.find(event => event.type === "action.prepare").payload.overload)), { advantage: 1, failedDice: 3, ruleId: "vagabond.modified-meister.2" });
const meisterRest = Engine.prepareAction(meisterScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const meisterRested = Engine.dispatchMany(meisterScene, meisterRest.events).scene;
assert.equal(meisterRested.pendingPrompt?.kind, "meister-overclock", "Modified Meister III exposes the overclock decision after Rest at Tension 2+");

const mundaneScene = structuredClone(scene);
mundaneScene.actors[0].techniques = { "bulwark.mundane": 3 };
const mundaneTargeted = Engine.dispatchMany(mundaneScene, [{ type: "reaction.offer", actorId: "hero", payload: { sourceActorId: "enemy", actionId: "test" } }]).scene;
assert.equal(Engine.ruleResourceStatus(mundaneTargeted, "hero", { resource: "grit" }).balance, 3, "Mundane II gains Grit when made the target of an Attack");
const mundaneRest = Engine.prepareAction(mundaneScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id, provokeTargetIds: ["enemy"] });
assert.equal(mundaneRest.ok, true);
assert.ok(mundaneRest.events.some(event => event.type === "effect.apply" && event.payload.effect === "negative.спровоцирован"), "Mundane III applies Provoke to explicit legal targets");
assert.equal(Engine.prepareAction(mundaneScene, data, { actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], roll: { attribute: "spirit", rolls: [6], successes: 1 } }).ok, false);

const faithScene = structuredClone(scene);
faithScene.actors.push({ id: "ally", name: "Союзник", team: "hero", space: "main", x: 1, y: 2, hp: 4, maxHp: 10, wounds: 1, armor: 0, evasion: 0, effects: ["negative.ослаблен"], attrs: { body: 2, talent: 2, spirit: 2, mind: 2 } });
faithScene.actors[0].techniques = { "altruist.heavenly-saint": 3 };
assert.equal(Engine.ruleResourceStatus(faithScene, "hero", { resource: "faith" }).balance, 4);
const faithRest = Engine.dispatch(faithScene, { type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2, sourceActionName: "Передышка" } }).scene;
assert.equal(Engine.ruleResourceStatus(faithRest, "hero", { resource: "faith" }).balance, 4, "Rest cannot grant Faith");
const prayed = Engine.dispatchMany(faithScene, [{ type: "action.prepare", actorId: "hero", payload: { actionId: "prayer", name: "Помощь", targetIds: ["ally"] } }]).scene;
assert.equal(Engine.ruleResourceStatus(prayed, "hero", { resource: "faith" }).balance, 5, "Heavenly Saint I gains Faith for choosing an ally");
const cleansing = Engine.prepareAction(faithScene, data, {
  actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["ally"],
  removeEffectIdsByTarget: { ally: ["negative.ослаблен"] },
  roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 4, 1], successes: 3, crits: 1 },
});
assert.equal(cleansing.ok, true);
assert.ok(cleansing.events.some(event => event.type === "actor.heal" && event.payload.amount === 1));
assert.ok(cleansing.events.some(event => event.type === "effect.remove" && event.payload.effect === "negative.ослаблен"));

const autophageScene = structuredClone(scene);
autophageScene.actors[0].techniques = { "disruptor.autophage": 1 };
autophageScene.actors[0].guts = 3;
const autophageSpent = Engine.dispatchMany(autophageScene, [{ type: "resource.spend", actorId: "hero", payload: { resource: "focus", amount: 2 } }]).scene;
assert.equal(autophageSpent.actors[0].hp, 8, "Autophage pays two Health per Focus through the damage pipeline");
assert.equal(autophageSpent.actors[0].focus, 50);
const autophageGained = Engine.dispatchMany(autophageSpent, [{ type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2 } }]).scene;
assert.equal(autophageGained.actors[0].hp, 10, "Focus gains restore the same amount of Health");

const creationScene = structuredClone(scene);
creationScene.actors[0].techniques = { "ruiner.creation-ascetic": 1 };
const creationRest = Engine.prepareAction(creationScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const creationRested = Engine.dispatchMany(creationScene, creationRest.events).scene;
assert.equal(Engine.ruleResourceStatus(creationRested, "hero", { resource: "creation-marks" }).balance, 1);
assert.equal(creationRested.actors[0].creationMarks, 1, "Creation Marks use the generic resource state while preserving the legacy adapter");
assert.equal(creationRested.actors[0].focus, 50);

const privateScene = structuredClone(scene);
privateScene.actors[0].privateNotes = "Тайна игрока";
privateScene.actors[1].hidden = true;
privateScene.markers = [{ id: "secret", kind: "hidden", hidden: true }];
privateScene.artworks = [{ id: "secret-art", hidden: true, image: "data:image/png;base64,AA==" }];
privateScene.backgroundArt = "secret-art";
privateScene.featuredArt = "secret-art";
privateScene.pendingAction = { id: "hidden-attack", actorId: "enemy", targetIds: ["hero"], responses: { hero: { choice: "pending" } } };
privateScene.pendingPrompt = { id: "hidden-prompt", sourceActorId: "enemy", targetId: "hero", options: ["pass"] };
privateScene.triggerQueue = [{ key: "hidden-trigger", event: { type: "rule.prompt", actorId: "enemy", payload: { sourceActorId: "enemy", targetId: "hero" } } }];
privateScene.opposedRoll = { id: "hidden-opposed", participants: [{ id: "hero-side", actorId: "hero" }, { id: "enemy-side", actorId: "enemy" }] };
privateScene.log = [{ id: "gm-only", visibility: "gm", type: "gm.note", payload: {} }, { id: "public", type: "roll.public", payload: {} }];
const playerProjection = Engine.projectScene(privateScene, { role: "player", actorIds: ["hero"] });
assert.equal(playerProjection.actors.length, 1);
assert.equal(playerProjection.actors[0].privateNotes, "Тайна игрока");
assert.equal(playerProjection.markers.length, 0);
assert.equal(playerProjection.log.length, 1);
assert.equal(playerProjection.backgroundArt, null);
assert.equal(playerProjection.featuredArt, null);
assert.equal(playerProjection.pendingAction, null, "A hidden enemy cannot leak through the pending Reaction chain");
assert.equal(playerProjection.pendingPrompt, null, "A hidden enemy cannot leak through a rule prompt");
assert.equal(playerProjection.triggerQueue.length, 0, "Queued hidden triggers stay Narrator-only");
assert.equal(playerProjection.opposedRoll, null, "Opposed-roll state cannot reveal a hidden participant");
const hiddenEnemyRoll = Engine.dispatch(privateScene, { id: "hidden-enemy-roll", type: "roll.public", actorId: "enemy", payload: { formula: "4D6 ≥4", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } });
assert.equal(hiddenEnemyRoll.event.visibility, "gm", "Events by hidden enemies default to Narrator-only visibility");
assert.equal(hiddenEnemyRoll.scene.rollFeed[0].visibility, "gm", "Hidden-enemy rolls cannot leak through the shared roll feed");
const hiddenEnemyProjection = Engine.projectScene(hiddenEnemyRoll.scene, { role: "player", actorIds: ["hero"] });
assert.equal(hiddenEnemyProjection.log.some(event => event.id === "hidden-enemy-roll"), false);
assert.equal(hiddenEnemyProjection.rollFeed.some(roll => roll.id === "hidden-enemy-roll"), false);

const rest = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(rest.ok, true);
const rested = Engine.dispatchMany(scene, rest.events).scene;
assert.equal(rested.actors[0].ap, 2);
assert.equal(rested.actors[0].focus, 51, "Focus gain must remain unbounded");
assert.ok(rested.actors[0].usedActions.includes(actionNamed("Передышка").id));
assert.equal(Engine.prepareAction(rested, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).ok, false, "A base action is used at most once per Round");

const quickRestScene = structuredClone(scene);
quickRestScene.actors[0].techniques = { "altruist.fog-walker": 3 };
const quickRest = Engine.prepareAction(quickRestScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(quickRest.ok, true);
assert.equal(quickRest.action.quick, true, "A learned Technique can make a base action Quick");
assert.equal(quickRest.action.quickSource.name, "Жалящий пар (Stinging Steam)");
const afterQuickRest = Engine.dispatchMany(quickRestScene, quickRest.events).scene;
assert.ok(!afterQuickRest.actors[0].usedActions.includes(actionNamed("Передышка").id), "Quick actions do not consume the once-per-Round use");
assert.equal(Engine.prepareAction(afterQuickRest, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).ok, true, "An always-Quick Rest may be used again while resources remain");
const firstQuickScene = structuredClone(scene);
firstQuickScene.actors[0].techniques = { "vagabond.drunkard": 3 };
const firstQuickRest = Engine.prepareAction(firstQuickScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(firstQuickRest.action.quick, true, "The first-Rest Quick condition is recognized");
const afterFirstQuick = Engine.dispatchMany(firstQuickScene, firstQuickRest.events).scene;
const normalRest = Engine.prepareAction(afterFirstQuick, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(normalRest.action.quick, false, "A first-only Quick source is not reused in the same Turn");
const afterNormalRest = Engine.dispatchMany(afterFirstQuick, normalRest.events).scene;
assert.equal(Engine.prepareAction(afterNormalRest, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).ok, false, "After the first Quick and one normal use, the base action limit applies again");
for (const techniques of [
  { "powerhouse.spellsword": 2 },
  { "powerhouse.dual-wielder": 1 },
]) {
  const namedSubActionScene = structuredClone(scene);
  namedSubActionScene.actors[0].techniques = techniques;
  assert.equal(Engine.availableActions(namedSubActionScene, data, "hero").find(action => action.name === "Стычка").quick, false, "Named or conditional Technique attacks do not make the ordinary Skirmish Quick");
}
const preparationScene = structuredClone(scene);
preparationScene.actors[0].techniques = { "ruiner.long-draw": 1 };
assert.equal(Engine.availableActions(preparationScene, data, "hero").find(action => action.name === "Зарядка").quick, false, "Preparation charges do not make the base Charge action Quick");

const edgeScene = structuredClone(scene);
edgeScene.actors[0].x = 0;
const hide = Engine.prepareAction(edgeScene, data, { actorId: "hero", actionId: actionNamed("Скрыться").id });
assert.equal(hide.ok, true);
assert.ok(hide.events.some(event => event.type === "effect.apply" && event.payload.effect === "positive.исчез"), "Hide applies the canonical Disappeared effect");
assert.equal(Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Скрыться").id }).ok, false, "Hide rejects a non-edge cell");
const study = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
assert.equal(study.ok, true);
assert.ok(Engine.dispatchMany(scene, study.events).scene.actors[1].effects.includes("negative.помечен"), "Study applies its deterministic Marked step");

const attack = prepareAttack(scene, "hero", "enemy");
assert.equal(attack.ok, true);
const friendlyFireScene = structuredClone(scene);
friendlyFireScene.actors.push({ ...structuredClone(friendlyFireScene.actors[0]), id: "ally", name: "Союзник", x: 1, y: 2 });
assert.equal(prepareAttack(friendlyFireScene, "hero", "ally").ok, false, "Basic Attacks reject allies");
assert.deepEqual(Array.from(attack.events, event => event.type), ["action.prepare", "resource.spend", "reaction.offer", "attack.pending"]);
const awaiting = Engine.dispatchMany(scene, attack.events).scene;
assert.equal(awaiting.actors[1].hp, 10, "Damage waits for every Reaction response");
assert.deepEqual(Array.from(Engine.reactionOptions(awaiting, data, "enemy"), option => option.name), [], "An ordinary enemy exposes no player defensive Reactions");
const ordinaryEnemyStatus = Engine.pendingActionStatus(awaiting, data);
assert.deepEqual(Array.from(ordinaryEnemyStatus.waitingIds), [], "The table does not wait for an enemy without an available Reaction");
assert.deepEqual(Array.from(ordinaryEnemyStatus.autoPassedIds), ["enemy"]);
assert.equal(ordinaryEnemyStatus.canResolve, true);
assert.throws(() => Engine.dispatch(awaiting, { type: "round.end", payload: {} }), /завершите текущую цепочку Реакций/);
assert.equal(Engine.respondReaction(awaiting, data, { actorId: "enemy", choice: "pass" }).ok, false, "An enemy without a Reaction cannot submit a redundant response");
const answered = awaiting;
const resolution = Engine.resolvePendingAction(answered, data);
assert.equal(resolution.ok, true);
const attacked = Engine.dispatchMany(answered, resolution.events).scene;
assert.equal(attacked.actors[0].ap, 2);
assert.equal(attacked.actors[1].hp, 9, "Armor reduces damage, but an Attack still deals at least 1");
assert.equal(attacked.rollFeed[0].successes, 2);
assert.equal(attacked.pendingAction, null);

const antagonistTraitId = en => data.enemies.antagonistTraits.find(trait => trait.en === en).id;
const traitReactionScene = (en, { damage = 4, ownerSeparate = false, sacrifice = false } = {}) => {
  const state = structuredClone(scene);
  state.activeActorId = "hero";
  state.actors[0].x = 3; state.actors[0].y = 2;
  state.actors[1].x = 3; state.actors[1].y = 3;
  if (!ownerSeparate) state.actors[1].antagonistTraitId = antagonistTraitId(en);
  else state.actors.push({ ...structuredClone(state.actors[1]), id: "trait-owner", name: `Антагонист ${en}`, x: 5, y: 5, antagonistTraitId: antagonistTraitId(en) });
  if (sacrifice) state.actors.push({ ...structuredClone(state.actors[1]), id: "sacrifice", name: "Жертва", x: 6, y: 6, antagonistTraitId: null });
  return Engine.dispatch(state, { type: "attack.pending", actorId: "hero", payload: { actionId: actionNamed("Стычка").id, name: "Проверочная Атака", targetIds: ["enemy"], damage } }).scene;
};
for (const [en, mode] of [["All-Seeing", "evasion-move"], ["Cruel-Hearted", "armor-corrupt"], ["God-Like", "armor-repel"], ["Wild-Eyed", "clash"], ["Swift-Stepping", "evasion-vanish"]]) {
  const options = Engine.reactionOptions(traitReactionScene(en), data, "enemy").filter(option => option.enemyTrait);
  assert.ok(options.some(option => option.enemyTrait.mode === mode), `${en} exposes its canonical defensive Reaction instead of player defenses`);
}
for (const [en, mode] of [["Iron-Willed", "intercept-armor"], ["World-Renowned", "intercept-clash"]]) {
  const options = Engine.reactionOptions(traitReactionScene(en, { ownerSeparate: true }), data, "enemy").filter(option => option.enemyTrait);
  assert.ok(options.some(option => option.enemyTrait.mode === mode && option.enemyTrait.redirectTargetId === "trait-owner"), `${en} can intercept an Attack aimed at an ally`);
}
const sacrificeOptions = Engine.reactionOptions(traitReactionScene("Back-Stabbling", { sacrifice: true }), data, "enemy").filter(option => option.enemyTrait);
assert.ok(sacrificeOptions.some(option => option.enemyTrait.mode === "redirect-ally" && option.enemyTrait.redirectTargetId === "sacrifice"), "Back-Stabbling can make a chosen ally become the target");
assert.deepEqual(Array.from(Engine.pendingActionStatus(traitReactionScene("Cruel-Hearted"), data).waitingIds), ["enemy"], "A direct Antagonist defense opens the Reaction window");
assert.deepEqual(Array.from(Engine.pendingActionStatus(traitReactionScene("Iron-Willed", { ownerSeparate: true }), data).waitingIds), ["enemy"], "An allied interception opens the original target's Reaction window");
const unavailableSacrificeStatus = Engine.pendingActionStatus(traitReactionScene("Back-Stabbling"), data);
assert.deepEqual(Array.from(unavailableSacrificeStatus.waitingIds), [], "A redirect that has no eligible ally does not block the Attack");
assert.deepEqual(Array.from(unavailableSacrificeStatus.autoPassedIds), ["enemy"]);

let cruelFlow = traitReactionScene("Cruel-Hearted");
const cruelOption = Engine.reactionOptions(cruelFlow, data, "enemy").find(option => option.enemyTrait?.mode === "armor-corrupt");
cruelFlow = Engine.dispatchMany(cruelFlow, Engine.respondReaction(cruelFlow, data, { actorId: "enemy", choice: cruelOption.id }).events).scene;
cruelFlow = Engine.dispatchMany(cruelFlow, Engine.resolvePendingAction(cruelFlow, data).events).scene;
assert.equal(cruelFlow.actors.find(actor => actor.id === "enemy").hp, 9, "Telo shipov adds tier ×2 Armor and preserves the minimum 1 damage");
assert.ok(cruelFlow.actors.find(actor => actor.id === "hero").effects.includes("negative.порчен"), "Telo shipov Corrupts the attacker when damage is reduced to 1");
let cruelMinimumFlow = traitReactionScene("Cruel-Hearted", { damage: 1 });
const cruelMinimumOption = Engine.reactionOptions(cruelMinimumFlow, data, "enemy").find(option => option.enemyTrait?.mode === "armor-corrupt");
cruelMinimumFlow = Engine.dispatchMany(cruelMinimumFlow, Engine.respondReaction(cruelMinimumFlow, data, { actorId: "enemy", choice: cruelMinimumOption.id }).events).scene;
cruelMinimumFlow = Engine.dispatchMany(cruelMinimumFlow, Engine.resolvePendingAction(cruelMinimumFlow, data).events).scene;
assert.ok(!cruelMinimumFlow.actors.find(actor => actor.id === "hero").effects.includes("negative.порчен"), "Telo shipov does not trigger when incoming damage was already 1");

let godlikeFlow = traitReactionScene("God-Like");
const godlikeOption = Engine.reactionOptions(godlikeFlow, data, "enemy").find(option => option.enemyTrait?.mode === "armor-repel");
godlikeFlow = Engine.dispatchMany(godlikeFlow, Engine.respondReaction(godlikeFlow, data, { actorId: "enemy", choice: godlikeOption.id }).events).scene;
godlikeFlow = Engine.dispatchMany(godlikeFlow, Engine.resolvePendingAction(godlikeFlow, data).events).scene;
assert.deepEqual([godlikeFlow.actors.find(actor => actor.id === "hero").x, godlikeFlow.actors.find(actor => actor.id === "hero").y], [3, 0], "God-Like pushes the attacker up to 3 cells away when damage is reduced to 1");
assert.ok(godlikeFlow.actors.find(actor => actor.id === "hero").effects.includes("negative.замедлен"), "God-Like Slows the pushed attacker");

let seeingFlow = traitReactionScene("All-Seeing", { damage: 3 });
const seeingOption = Engine.reactionOptions(seeingFlow, data, "enemy").find(option => option.enemyTrait?.postMove);
seeingFlow = Engine.dispatchMany(seeingFlow, Engine.respondReaction(seeingFlow, data, { actorId: "enemy", choice: seeingOption.id, destination: { x: 4, y: 3 } }).events).scene;
seeingFlow = Engine.dispatchMany(seeingFlow, Engine.resolvePendingAction(seeingFlow, data).events).scene;
assert.deepEqual([seeingFlow.actors.find(actor => actor.id === "enemy").x, seeingFlow.actors.find(actor => actor.id === "enemy").y], [4, 3], "All-Seeing moves only after its Evasion makes the Attack miss");

let swiftFlow = traitReactionScene("Swift-Stepping", { damage: 3 });
const swiftOption = Engine.reactionOptions(swiftFlow, data, "enemy").find(option => option.enemyTrait?.mode === "evasion-vanish");
assert.equal(Engine.respondReaction(swiftFlow, data, { actorId: "enemy", choice: swiftOption.id, destination: { x: 1, y: 1 } }).ok, false, "Swift-Stepping rejects a destination that is not on the edge");
swiftFlow = Engine.dispatchMany(swiftFlow, Engine.respondReaction(swiftFlow, data, { actorId: "enemy", choice: swiftOption.id, destination: { x: 0, y: 0 } }).events).scene;
swiftFlow = Engine.dispatchMany(swiftFlow, Engine.resolvePendingAction(swiftFlow, data).events).scene;
assert.deepEqual([swiftFlow.actors.find(actor => actor.id === "enemy").x, swiftFlow.actors.find(actor => actor.id === "enemy").y], [0, 0], "Swift-Stepping teleports to the chosen edge cell after a miss");
assert.ok(swiftFlow.actors.find(actor => actor.id === "enemy").effects.includes("positive.исчез"), "Swift-Stepping Disappears after its defensive teleport");

let interceptFlow = traitReactionScene("Iron-Willed", { ownerSeparate: true });
const interceptOption = Engine.reactionOptions(interceptFlow, data, "enemy").find(option => option.enemyTrait?.mode === "intercept-armor");
interceptFlow = Engine.dispatchMany(interceptFlow, Engine.respondReaction(interceptFlow, data, { actorId: "enemy", choice: interceptOption.id, destination: { x: 2, y: 2 } }).events).scene;
interceptFlow = Engine.dispatchMany(interceptFlow, Engine.resolvePendingAction(interceptFlow, data).events).scene;
assert.equal(interceptFlow.actors.find(actor => actor.id === "enemy").hp, 10, "Iron-Willed leaves the original target unharmed");
assert.equal(interceptFlow.actors.find(actor => actor.id === "trait-owner").hp, 9, "Iron-Willed becomes the target and applies its temporary Armor");

let renownedFlow = traitReactionScene("World-Renowned", { ownerSeparate: true });
const renownedOption = Engine.reactionOptions(renownedFlow, data, "enemy").find(option => option.enemyTrait?.mode === "intercept-clash");
renownedFlow = Engine.dispatchMany(renownedFlow, Engine.respondReaction(renownedFlow, data, { actorId: "enemy", choice: renownedOption.id, destination: { x: 2, y: 2 }, clash: { defenderRoll: { formula: "4D6", rolls: [6], successes: 2, crits: 0 }, attackerRoll: { formula: "4D6", rolls: [2], successes: 0, crits: 0 } } }).events).scene;
renownedFlow = Engine.dispatchMany(renownedFlow, Engine.resolvePendingAction(renownedFlow, data).events).scene;
assert.equal(renownedFlow.actors.find(actor => actor.id === "enemy").hp, 10, "World-Renowned protects the original target");
assert.equal(renownedFlow.actors.find(actor => actor.id === "trait-owner").hp, 10, "World-Renowned cancels the redirected Attack when it wins the Clash");

let sacrificeFlow = traitReactionScene("Back-Stabbling", { sacrifice: true });
const sacrificeOption = Engine.reactionOptions(sacrificeFlow, data, "enemy").find(option => option.enemyTrait?.redirectTargetId === "sacrifice");
sacrificeFlow = Engine.dispatchMany(sacrificeFlow, Engine.respondReaction(sacrificeFlow, data, { actorId: "enemy", choice: sacrificeOption.id, destination: { x: 4, y: 3 } }).events).scene;
sacrificeFlow = Engine.dispatchMany(sacrificeFlow, Engine.resolvePendingAction(sacrificeFlow, data).events).scene;
assert.equal(sacrificeFlow.actors.find(actor => actor.id === "enemy").hp, 10, "Back-Stabbling leaves the original target unharmed");
assert.equal(sacrificeFlow.actors.find(actor => actor.id === "sacrifice").hp, 7, "Back-Stabbling teleports the chosen ally in and makes it take the Attack");

let wildFlow = traitReactionScene("Wild-Eyed");
const wildOption = Engine.reactionOptions(wildFlow, data, "enemy").find(option => option.enemyTrait?.mode === "clash");
wildFlow = Engine.dispatchMany(wildFlow, Engine.respondReaction(wildFlow, data, { actorId: "enemy", choice: wildOption.id, clash: { defenderRoll: { formula: "4D6", rolls: [6], successes: 2, crits: 0 }, attackerRoll: { formula: "4D6", rolls: [2], successes: 0, crits: 0 } } }).events).scene;
wildFlow = Engine.dispatchMany(wildFlow, Engine.resolvePendingAction(wildFlow, data).events).scene;
assert.equal(wildFlow.actors.find(actor => actor.id === "enemy").hp, 10, "Wild-Eyed cancels the original Attack when it wins the forced Clash");

const enemyScene = structuredClone(scene);
enemyScene.activeActorId = "enemy";
enemyScene.actors[1].speed = 4;
const enemyStep = Engine.prepareAction(enemyScene, data, { actorId: "enemy", actionId: actionNamed("Шаг").id, destination: { x: 3, y: 1 } });
assert.equal(enemyStep.ok, true, "An enemy can spend its canonical Step during its Turn");
const afterEnemyStep = Engine.dispatchMany(enemyScene, enemyStep.events).scene;
assert.equal(afterEnemyStep.actors[1].ap, 1);
assert.equal(afterEnemyStep.actors[1].stepRemaining, 3, "Unused enemy Step movement is retained like the canonical shared action");
const continuedEnemyStep = Engine.prepareAction(afterEnemyStep, data, { actorId: "enemy", actionId: actionNamed("Шаг").id, destination: { x: 5, y: 1 } });
assert.equal(continuedEnemyStep.ok, true);
const afterContinuedEnemyStep = Engine.dispatchMany(afterEnemyStep, continuedEnemyStep.events).scene;
assert.equal(afterContinuedEnemyStep.actors[1].ap, 1, "Continuing an already paid enemy Step costs no additional AP");
const enemyRules = Engine.availableEnemyRules(enemyScene, data, "enemy");
assert.equal(enemyRules.length, 3);
const neutralize = enemyRules.find(rule => rule.en === "Neutralize Target");
assert.equal(neutralize.automation, "full");
const neutralized = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: neutralize.id, targetIds: ["hero"] });
assert.equal(neutralized.ok, true);
const afterNeutralize = Engine.dispatchMany(enemyScene, neutralized.events).scene;
assert.equal(afterNeutralize.actors[1].ap, 1);
assert.ok(afterNeutralize.actors[1].usedActions.includes(neutralize.id));
assert.ok(afterNeutralize.actors[0].effects.includes("negative.помечен"));
assert.ok(!afterNeutralize.actors[0].effects.includes("negative.замедлен"), "Conditional follow-up effects must not be applied early");
assert.equal(Engine.prepareEnemyRule(afterNeutralize, data, { actorId: "enemy", ruleId: neutralize.id, targetIds: ["hero"] }).ok, false, "Enemy actions are once per Round");

const slice = enemyRules.find(rule => rule.en === "Slice");
assert.equal(slice.automation, "attack", "Slice uses the shared Attack pipeline and resolves its conditional effects itself");
const assistedSlice = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: slice.id, targetIds: ["hero"], roll: { formula: "5D6", rolls: [6, 5, 2, 1, 1], successes: 2, crits: 1 } });
assert.equal(assistedSlice.ok, true);
assert.ok(assistedSlice.events.some(event => event.type === "attack.pending"), "Slice offers the target the normal defensive reaction window");

const simpleEnemyScene = structuredClone(enemyScene);
simpleEnemyScene.actors[1].profileId = "enemy.common.pugilist";
simpleEnemyScene.actors[1].name = "Кулачный боец";
const flurry = Engine.availableEnemyRules(simpleEnemyScene, data, "enemy").find(rule => rule.en === "Flurry Of Strikes");
assert.equal(flurry.automation, "attack");
const enemyAttack = Engine.prepareEnemyRule(simpleEnemyScene, data, { actorId: "enemy", ruleId: flurry.id, targetIds: ["hero"], roll: { formula: "6D6", rolls: [6, 5, 2, 1, 1, 1], successes: 2, crits: 1 } });
assert.equal(enemyAttack.ok, true);
assert.equal(Engine.prepareEnemyRule(simpleEnemyScene, data, { actorId: "enemy", ruleId: flurry.id, targetIds: ["enemy"], roll: { rolls: [6], successes: 1 } }).ok, false, "Automated enemy Attacks reject allies");
const enemyAwaiting = Engine.dispatchMany(simpleEnemyScene, enemyAttack.events).scene;
assert.equal(enemyAwaiting.actors[1].ap, 1);
assert.equal(enemyAwaiting.actors[0].hp, 12);
const heroPass = Engine.respondReaction(enemyAwaiting, data, { actorId: "hero", choice: "pass" });
const enemyAnswered = Engine.dispatchMany(enemyAwaiting, heroPass.events).scene;
const enemyResolved = Engine.dispatchMany(enemyAnswered, Engine.resolvePendingAction(enemyAnswered, data).events).scene;
assert.equal(enemyResolved.actors[0].hp, 6, "Enemy attack damage includes successes plus Tension multiplier");
assert.equal(enemyResolved.pendingAction, null);

const baseTensionScene = structuredClone(enemyScene);
baseTensionScene.actors[1].profileId = "enemy.common.cultist";
baseTensionScene.actors[1].name = "Культист";
const swipe = Engine.availableEnemyRules(baseTensionScene, data, "enemy").find(rule => rule.en === "Swipe");
assert.equal(swipe.automation, "attack");
const swipeAttack = Engine.prepareEnemyRule(baseTensionScene, data, { actorId: "enemy", ruleId: swipe.id, targetIds: ["hero"], roll: { formula: "5D6", rolls: [6, 5, 2, 1, 1], successes: 2, crits: 1 } });
assert.equal(swipeAttack.events.find(event => event.type === "attack.pending").payload.damage, 4, "[Tension] without an explicit multiplier still adds Tension once");

const revenantScene = structuredClone(enemyScene);
revenantScene.actors[1].profileId = "enemy.common.revenant";
revenantScene.actors[1].tier = 2;
revenantScene.actors[0].focus = 2;
const tearFromSoul = Engine.availableEnemyRules(revenantScene, data, "enemy").find(rule => rule.en === "Tear From The Soul");
assert.equal(tearFromSoul.automation, "attack", "Reviewed resource-loss rewards use the shared post-hit family");
const soulAttack = Engine.prepareEnemyRule(revenantScene, data, { actorId: "enemy", ruleId: tearFromSoul.id, targetIds: ["hero"], roll: { formula: "7D6", rolls: [6, 4, 2, 1, 1, 1, 1], successes: 2, crits: 1 } });
assert.equal(soulAttack.events.find(event => event.type === "attack.pending").payload.postResourceLoss.amount, 3, "Tier formulas are resolved before opening Reactions");
let soulResolved = Engine.dispatchMany(revenantScene, soulAttack.events).scene;
soulResolved = Engine.dispatchMany(soulResolved, Engine.respondReaction(soulResolved, data, { actorId: "hero", choice: "pass" }).events).scene;
soulResolved = Engine.dispatchMany(soulResolved, Engine.resolvePendingAction(soulResolved, data).events).scene;
assert.equal(soulResolved.actors[0].focus, 0, "Tear From The Soul removes its tier-scaled Focus after dealing damage");

const lurkingScene = structuredClone(revenantScene);
lurkingScene.actors[0].focus = 1;
lurkingScene.actors.push({ ...structuredClone(lurkingScene.actors[0]), id: "anchor", name: "Не-Ревенант", team: "enemy", profileId: "enemy.common.assassin", x: 2, y: 1, focus: 0, effects: [] });
const lurk = Engine.availableEnemyRules(lurkingScene, data, "enemy").find(rule => rule.id === "enemy.common.revenant.action.lurk");
assert.equal(lurk.automation, "full");
const lurked = Engine.dispatchMany(lurkingScene, Engine.prepareEnemyRule(lurkingScene, data, { actorId: "enemy", ruleId: lurk.id }).events).scene;
assert.ok(lurked.actors[0].effects.includes("negative.испуган"), "Lurk frightens a low-Focus opponent near a non-Revenant");

const oniScene = structuredClone(enemyScene);
oniScene.actors[1].profileId = "enemy.common.oni";
oniScene.actors[1].effects = ["negative.ошеломлен", "positive.усилен"];
const stabilize = Engine.availableEnemyRules(oniScene, data, "enemy").find(rule => rule.id === "enemy.common.oni.action.stabilize");
const stabilized = Engine.dispatchMany(oniScene, Engine.prepareEnemyRule(oniScene, data, { actorId: "enemy", ruleId: stabilize.id }).events).scene;
assert.deepEqual(Array.from(stabilized.actors[1].effects), ["positive.ускорен"], "Stabilize replaces all current Effects with Hasted");

const broodScene = structuredClone(enemyScene);
broodScene.actors[1].profileId = "enemy.common.broodmother";
broodScene.actors[1].x = 2;
broodScene.actors[1].y = 2;
broodScene.actors[0].x = 4;
broodScene.actors[0].y = 4;
const roar = Engine.availableEnemyRules(broodScene, data, "enemy").find(rule => rule.id === "enemy.common.broodmother.trump.roar");
const roared = Engine.dispatchMany(broodScene, Engine.prepareEnemyRule(broodScene, data, { actorId: "enemy", ruleId: roar.id }).events).scene;
assert.ok(roared.actors[0].effects.includes("negative.спровоцирован"), "Roar provokes opponents in its centered 5x5 zone");
assert.equal(roared.actors[1].extraTurns, 1, "Roar grants the Broodmother another Turn");

const martyrScene = structuredClone(enemyScene);
martyrScene.actors[1].profileId = "enemy.common.martyr";
martyrScene.actors[1].hp = 5;
martyrScene.actors[1].maxHp = 12;
const savorBlood = Engine.availableEnemyRules(martyrScene, data, "enemy").find(rule => rule.en === "Savor My Blood");
assert.equal(savorBlood.automation, "attack", "Reviewed self-healing rewards use the shared post-hit family");
assert.equal(Engine.prepareEnemyRule(martyrScene, data, { actorId: "enemy", ruleId: savorBlood.id, targetIds: [], roll: { rolls: [6], successes: 1 } }).ok, false, "The occupied target cell must be selected");
const bloodAttack = Engine.prepareEnemyRule(martyrScene, data, { actorId: "enemy", ruleId: savorBlood.id, targetIds: ["hero"], roll: { formula: "6D6", rolls: [6, 4, 2, 1, 1, 1], successes: 2, crits: 1 } });
let bloodResolved = Engine.dispatchMany(martyrScene, bloodAttack.events).scene;
bloodResolved = Engine.dispatchMany(bloodResolved, Engine.respondReaction(bloodResolved, data, { actorId: "hero", choice: "pass" }).events).scene;
bloodResolved = Engine.dispatchMany(bloodResolved, Engine.resolvePendingAction(bloodResolved, data).events).scene;
assert.equal(bloodResolved.actors[1].hp, 9, "Savor My Blood restores half the Martyr's missing Health, rounded up");
const evadedMartyrScene = structuredClone(martyrScene);
const evadedBloodAttack = Engine.prepareEnemyRule(evadedMartyrScene, data, { actorId: "enemy", ruleId: savorBlood.id, targetIds: ["hero"], roll: { formula: "6D6", rolls: [3, 3, 2, 1, 1, 1], successes: 0, crits: 0 } });
let evadedBlood = Engine.dispatchMany(evadedMartyrScene, evadedBloodAttack.events).scene;
evadedBlood = Engine.dispatchMany(evadedBlood, Engine.respondReaction(evadedBlood, data, { actorId: "hero", choice: "Уворот", destination: { x: 0, y: 1 } }).events).scene;
evadedBlood = Engine.dispatchMany(evadedBlood, Engine.resolvePendingAction(evadedBlood, data).events).scene;
assert.equal(evadedBlood.actors[1].hp, 5, "A fully evaded Savor My Blood hit grants no healing");

const paladinScene = structuredClone(enemyScene);
paladinScene.actors[1].profileId = "enemy.common.paladin";
paladinScene.actors[1].name = "Паладин";
paladinScene.actors.push({ ...structuredClone(paladinScene.actors[1]), id: "enemy-ally", name: "Союзник Паладина", x: 2, y: 2 });
const gift = Engine.availableEnemyRules(paladinScene, data, "enemy").find(rule => rule.en === "Gift From God");
assert.equal(gift.automation, "attack");
assert.equal(gift.maxTargets, 2);
assert.equal(Engine.prepareEnemyRule(paladinScene, data, { actorId: "enemy", ruleId: gift.id, targetIds: ["hero", "enemy-ally"], roll: { formula: "5D6", rolls: [6, 4, 2, 1, 1], successes: 2, crits: 1 } }).ok, true, "Mixed ally/enemy actions honor the two textual targets in the shared Attack pipeline");

const daredevilScene = structuredClone(enemyScene);
daredevilScene.actors[1].profileId = "enemy.common.daredevil";
daredevilScene.actors.push({ ...structuredClone(daredevilScene.actors[0]), id: "hero-2", name: "Вторая цель", x: 2, y: 2 });
const dance = Engine.availableEnemyRules(daredevilScene, data, "enemy").find(rule => rule.en === "Dance");
assert.equal(dance.automation, "attack", "Reviewed multi-target attacks use the shared target and reaction family");
assert.equal(dance.maxTargets, 2);
const danceAttack = Engine.prepareEnemyRule(daredevilScene, data, { actorId: "enemy", ruleId: dance.id, targetIds: ["hero", "hero-2"], roll: { formula: "5D6", rolls: [6, 4, 2, 1, 1], successes: 2, crits: 1 } });
assert.equal(danceAttack.ok, true, "Dance accepts its canonical two adjacent targets");
assert.ok(danceAttack.events.some(event => event.type === "attack.pending"), "Dance uses the shared reaction window");
assert.equal(Engine.enemyRuleAutomation(dance.id), "attack");

for (const [profileId, englishName, expectedTargets, expectedPush] of [
  ["enemy.common.glutton", "Slobber", 2, 0],
  ["enemy.common.guardian", "Shove", 1, 2],
  ["enemy.common.mount", "Thrash", 2, 0],
  ["enemy.common.berserker", "Thrash", 1, 1],
  ["enemy.common.hound-master", "Shove", 1, 2],
]) {
  const familyScene = structuredClone(enemyScene);
  familyScene.actors[1].profileId = profileId;
  const familyRule = Engine.availableEnemyRules(familyScene, data, "enemy").find(rule => rule.en === englishName);
  assert.equal(familyRule.automation, "attack", `${profileId} is connected to the shared attack family`);
  assert.equal(familyRule.maxTargets, expectedTargets);
  const prepared = Engine.prepareEnemyRule(familyScene, data, { actorId: "enemy", ruleId: familyRule.id, targetIds: ["hero"], roll: { formula: "6D6", rolls: [6, 4, 2, 1, 1, 1], successes: 2, crits: 1 } });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.events.find(event => event.type === "attack.pending").payload.postDisplacements[0]?.maximum || 0, expectedPush);
}
assert.equal(dance.automation, "attack", "The audited multi-target damage-and-effect family uses the shared Reaction pipeline");
assert.equal(dance.maxTargets, 2);
const preparedDance = Engine.prepareEnemyRule(daredevilScene, data, { actorId: "enemy", ruleId: dance.id, targetIds: ["hero", "hero-2"], roll: { formula: "5D6", rolls: [6, 4, 2, 1, 1], successes: 2, crits: 1 } });
assert.equal(preparedDance.ok, true, "Dance accepts its canonical two targets");
let danced = Engine.dispatchMany(daredevilScene, preparedDance.events).scene;
danced = Engine.dispatchMany(danced, Engine.respondReaction(danced, data, { actorId: "hero", choice: "pass" }).events).scene;
danced = Engine.dispatchMany(danced, Engine.respondReaction(danced, data, { actorId: "hero-2", choice: "pass" }).events).scene;
danced = Engine.dispatchMany(danced, Engine.resolvePendingAction(danced, data).events).scene;
assert.equal(danced.actors.find(actor => actor.id === "hero").hp, 8);
assert.equal(danced.actors.find(actor => actor.id === "hero-2").hp, 8);
assert.ok(danced.actors.filter(actor => actor.id.startsWith("hero")).every(actor => actor.effects.includes("negative.подброшен")), "Every damaged Dance target receives Launched after its Reaction resolves");

for (const [profileId, ruleEn] of [
  ["enemy.common.glutton", "Slobber"],
  ["enemy.common.mount", "Thrash"],
  ["enemy.common.guardian", "Shove"],
  ["enemy.common.berserker", "Thrash"],
  ["enemy.common.hound-master", "Shove"],
]) {
  const familyScene = structuredClone(enemyScene);
  familyScene.actors[1].profileId = profileId;
  const familyRule = Engine.availableEnemyRules(familyScene, data, "enemy").find(rule => rule.en === ruleEn);
  assert.equal(familyRule.automation, "attack", `${profileId} joins the audited enemy Attack family`);
}

const guardianScene = structuredClone(enemyScene);
guardianScene.actors[1].profileId = "enemy.common.guardian";
guardianScene.actors[1].x = 1;
guardianScene.actors[0].x = 2;
const guardianShove = Engine.availableEnemyRules(guardianScene, data, "enemy").find(rule => rule.en === "Shove");
const guardianAttack = Engine.prepareEnemyRule(guardianScene, data, { actorId: "enemy", ruleId: guardianShove.id, targetIds: ["hero"], roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
let guardianResolved = Engine.dispatchMany(guardianScene, guardianAttack.events).scene;
guardianResolved = Engine.dispatchMany(guardianResolved, Engine.respondReaction(guardianResolved, data, { actorId: "hero", choice: "pass" }).events).scene;
guardianResolved = Engine.dispatchMany(guardianResolved, Engine.resolvePendingAction(guardianResolved, data).events).scene;
assert.equal(guardianResolved.actors[0].x, 4, "Audited enemy push rewards resolve after the target's Reaction");
assert.ok(guardianResolved.actors[0].effects.includes("negative.подброшен"));
assert.equal(guardianResolved.actors[0].hp, 8, "Guardian Shove deals successes plus Tension only; its two-cell push is not extra damage");
assert.equal(guardianResolved.log.filter(event => event.type === "damage.apply" && event.payload?.sourceActionId === guardianShove.id).length, 1, "A rules-text push does not create a second collision-damage event");
const guardianDodgeScene = structuredClone(guardianScene);
guardianDodgeScene.actors[0].attrs.talent = 10;
const guardianDodgeAttack = Engine.prepareEnemyRule(guardianDodgeScene, data, { actorId: "enemy", ruleId: guardianShove.id, targetIds: ["hero"], roll: { formula: "4D6", rolls: [4, 2, 2, 1], successes: 1, crits: 0 } });
let guardianDodged = Engine.dispatchMany(guardianDodgeScene, guardianDodgeAttack.events).scene;
guardianDodged = Engine.dispatchMany(guardianDodged, Engine.respondReaction(guardianDodged, data, { actorId: "hero", choice: "Уворот", destination: { x: 2, y: 1 } }).events).scene;
guardianDodged = Engine.dispatchMany(guardianDodged, Engine.resolvePendingAction(guardianDodged, data).events).scene;
assert.deepEqual({ x: guardianDodged.actors[0].x, y: guardianDodged.actors[0].y }, { x: 2, y: 1 }, "A fully evaded Guardian Shove does not apply its forced movement");

const bodyguardsScene = structuredClone(enemyScene);
bodyguardsScene.actors[1].profileId = "enemy.common.bodyguards";
bodyguardsScene.actors.push({ ...structuredClone(bodyguardsScene.actors[0]), id: "hero-2", name: "Вторая цель", x: 2, y: 2 });
bodyguardsScene.actors.push({ ...structuredClone(bodyguardsScene.actors[0]), id: "hero-3", name: "Третья цель", x: 3, y: 1 });
const behindMe = Engine.availableEnemyRules(bodyguardsScene, data, "enemy").find(rule => rule.en === "Behind Me");
assert.equal(behindMe.maxTargets, 3);
assert.equal(Engine.prepareEnemyRule(bodyguardsScene, data, { actorId: "enemy", ruleId: behindMe.id, targetIds: ["hero", "hero-2", "hero-3"], roll: { formula: "6D6", rolls: [6, 5, 4, 2, 1, 1], successes: 3, crits: 1 } }).ok, true, "Behind Me accepts all three textual targets under assisted resolution");

const disappear = enemyRules.find(rule => rule.en === "Disappear");
const trump = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: disappear.id });
assert.equal(trump.ok, true);
const afterTrump = Engine.dispatchMany(enemyScene, trump.events).scene;
assert.equal(afterTrump.actors[1].usedTrump, true);
assert.ok(afterTrump.actors[1].effects.includes("positive.исчез"));
afterTrump.activeActorId = null;
afterTrump.actors.forEach(actor => { actor.acted = true; });
afterTrump.log.unshift({ id: "enemy-turn-complete", type: "turn.end", actorId: "enemy", payload: {} });
const afterEnemyRound = Engine.dispatch(afterTrump, { type: "round.end", payload: {} }).scene;
assert.equal(afterEnemyRound.actors[1].usedActions.length, 0);
assert.equal(afterEnemyRound.actors[1].usedTrump, true, "Trump remains spent for the whole Scene");

const builderScene = structuredClone(enemyScene);
builderScene.actors[1].profileId = "enemy.common.builder";
builderScene.actors[1].name = "Строитель";
builderScene.actors[1].x = 5;
const construction = Engine.availableEnemyRules(builderScene, data, "enemy").find(rule => rule.en === "Violent Construction");
assert.equal(construction.automation, "attack");
const directAttack = Engine.prepareEnemyRule(builderScene, data, { actorId: "enemy", ruleId: construction.id, targetIds: ["hero"], damage: 3 });
assert.equal(directAttack.ok, true, "Fixed-damage special attacks remain usable");
assert.ok(directAttack.events.some(event => event.type === "attack.pending"), "Violent Construction uses the Attack pipeline before creating its terrain");

const areaScene = structuredClone(enemyScene);
areaScene.actors[1].profileId = "enemy.common.witch";
areaScene.actors[1].name = "Ведьма";
const runes = Engine.availableEnemyRules(areaScene, data, "enemy").find(rule => rule.en === "Drawing Runes");
assert.equal(runes.apCost, 2);
const runeAction = Engine.prepareEnemyRule(areaScene, data, { actorId: "enemy", ruleId: runes.id });
assert.equal(runeAction.ok, true);
const runeScene = Engine.dispatchMany(areaScene, runeAction.events).scene;
assert.equal(runeScene.objects[0].cells.length, 9);
assert.equal(runeScene.objects[0].type, "danger");
assert.equal(runeScene.actors[1].ap, 0);

const awaitingDodge = structuredClone(enemyAwaiting);
awaitingDodge.pendingAction.damage = 2;
awaitingDodge.pendingAction.damageByTarget.hero = 2;
awaitingDodge.pendingAction.effects = ["negative.помечен"];
const dodge = Engine.respondReaction(awaitingDodge, data, { actorId: "hero", choice: "Уворот", destination: { x: 0, y: 1 } });
assert.equal(dodge.ok, true);
const afterDodge = Engine.dispatchMany(awaitingDodge, dodge.events).scene;
assert.equal(afterDodge.actors[0].focus, 48);
assert.equal(afterDodge.actors[0].x, 0);
const dodgeOutcome = Engine.pendingTargetOutcome(afterDodge, afterDodge.pendingAction, "hero");
assert.equal(dodgeOutcome.available, true);
assert.equal(dodgeOutcome.expectedDamage, 0, "The shared damage outcome exposes Armor and Evasion before committing damage");
assert.ok(dodgeOutcome.temporaryEvasion > 0);
const dodged = Engine.dispatchMany(afterDodge, Engine.resolvePendingAction(afterDodge, data).events).scene;
assert.equal(dodged.actors[0].hp, 12, "Temporary Evasion can absorb all post-Armor damage");
assert.ok(!dodged.actors[0].effects.includes("negative.помечен"), "A fully evaded Attack does not apply its secondary Effects");

const awaitingBlock = structuredClone(enemyAwaiting);
const block = Engine.respondReaction(awaitingBlock, data, { actorId: "hero", choice: "Блок" });
assert.equal(block.ok, true);
const afterBlock = Engine.dispatchMany(awaitingBlock, block.events).scene;
assert.equal(afterBlock.actors[0].x, 0, "Block applies its forced one-cell push away from the attacker");
const blocked = Engine.dispatchMany(afterBlock, Engine.resolvePendingAction(afterBlock, data).events).scene;
assert.equal(blocked.actors[0].hp, 9, "Block resolves through temporary Body Armor while preserving minimum Attack damage");

const duelistAwaiting = structuredClone(enemyAwaiting);
duelistAwaiting.actors[0].techniques = { "powerhouse.duelist": 2 };
const duelistBlock = Engine.respondReaction(duelistAwaiting, data, { actorId: "hero", choice: "Блок" });
assert.equal(duelistBlock.ok, true);
const afterDuelistBlock = Engine.dispatchMany(duelistAwaiting, duelistBlock.events).scene;
assert.ok(afterDuelistBlock.actors.find(actor => actor.id === "enemy").effects.includes("negative.ошеломлен"), "Duelist II checks adjacency at the start of Block and Stuns the attacker");

const untouchableAwaiting = structuredClone(enemyAwaiting);
untouchableAwaiting.pendingAction.damage = 2;
untouchableAwaiting.pendingAction.damageByTarget.hero = 2;
untouchableAwaiting.actors[0].techniques = { "vagabond.untouchable": 2 };
const longDodge = Engine.respondReaction(untouchableAwaiting, data, { actorId: "hero", choice: "Уворот", destination: { x: 1, y: 4 } });
assert.equal(longDodge.ok, true, "Untouchable II extends Dodge movement to three cells");
let untouchableFlow = Engine.dispatchMany(untouchableAwaiting, longDodge.events).scene;
assert.equal(Engine.pendingTargetOutcome(untouchableFlow, untouchableFlow.pendingAction, "hero").expectedDamage, 0);
untouchableFlow = Engine.dispatchMany(untouchableFlow, Engine.resolvePendingAction(untouchableFlow, data).events).scene;
assert.equal(untouchableFlow.pendingPrompt?.kind, "untouchable-weave");
const weaveChoice = Engine.respondRulePrompt(untouchableFlow, data, { choice: "rush" });
assert.equal(weaveChoice.ok, true);
untouchableFlow = Engine.dispatchMany(untouchableFlow, weaveChoice.events).scene;
assert.equal(untouchableFlow.pendingPrompt?.kind, "untouchable-weave-cell");
const weavePlacement = Engine.preparePromptPlacement(untouchableFlow, { destination: { x: 4, y: 4 } });
assert.equal(weavePlacement.ok, true);
untouchableFlow = Engine.dispatchMany(untouchableFlow, weavePlacement.events).scene;
assert.deepEqual([untouchableFlow.actors[0].x, untouchableFlow.actors[0].y], [4, 4], "Untouchable II performs its optional second Dodge movement");
assert.ok(untouchableFlow.log.some(event => event.type === "technique.resolve" && event.payload?.ruleId === "vagabond.untouchable.2"));

const awaitingClash = structuredClone(enemyAwaiting);
const clash = Engine.respondReaction(awaitingClash, data, { actorId: "hero", choice: "Столкновение", clash: {
  defenderRoll: { formula: "4D6 · Столкновение", rolls: [6, 5, 4, 1], successes: 3, crits: 1 },
  attackerRoll: { formula: "4D6 · Столкновение", rolls: [4, 2, 2, 1], successes: 1, crits: 0 },
} });
assert.equal(clash.ok, true, "Clash is an automated hero Reaction option");
const afterClash = Engine.dispatchMany(awaitingClash, clash.events).scene;
assert.equal(afterClash.pendingAction.responses.hero.clash.defenderWins, true);
const clashed = Engine.dispatchMany(afterClash, Engine.resolvePendingAction(afterClash, data).events).scene;
assert.equal(clashed.actors[0].hp, 12, "A won Clash cancels the original Attack");

const moved = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 1, y: 3 } });
assert.equal(moved.ok, true);
const afterPartialStep = Engine.dispatchMany(scene, moved.events).scene;
assert.equal(afterPartialStep.actors[0].y, 3);
assert.equal(afterPartialStep.actors[0].stepRemaining, 2, "Unused Step movement is saved");
const betweenSteps = Engine.dispatchMany(afterPartialStep, Engine.prepareAction(afterPartialStep, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).events).scene;
const continuedStep = Engine.prepareAction(betweenSteps, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 3, y: 3 } });
assert.equal(continuedStep.ok, true, "Saved Step movement remains available after another action");
assert.equal(continuedStep.action.continuation, true);
assert.ok(!continuedStep.events.some(event => event.type === "resource.spend"), "Continuing a Step does not spend AP again");
const afterContinuedStep = Engine.dispatchMany(betweenSteps, continuedStep.events).scene;
assert.equal(afterContinuedStep.actors[0].x, 3);
assert.equal(afterContinuedStep.actors[0].stepRemaining, 0);
const blockedPath = structuredClone(scene);
blockedPath.actors[0].speed = 4;
assert.equal(Engine.prepareAction(blockedPath, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 5, y: 1 } }).ok, false, "Step cannot pass through an enemy when the detour exceeds Speed");
const diagonalJump = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Прыжок").id, destination: { x: 3, y: 3 } });
assert.equal(diagonalJump.ok, true, "Jump accepts a diagonal Line and counts each diagonal cell as one");
assert.equal(diagonalJump.events.find(event => event.type === "actor.move").payload.path.length, 2);
assert.equal(Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Прыжок").id, destination: { x: 3, y: 2 } }).ok, false, "Jump rejects a bent Line");
const terrainScene = structuredClone(scene);
terrainScene.actors[1].x = 6;
terrainScene.objects = [{ id: "wall", type: "terrain", space: "main", cells: ["1,2", "0,1", "2,1"] }];
assert.equal(Engine.movementPath(terrainScene, "hero", { x: 1, y: 3 }, { maxDistance: 4 }).length, 0, "Movement cannot pass through terrain");
const difficultScene = structuredClone(scene);
difficultScene.actors[1].x = 6;
difficultScene.objects = [{ id: "ash", type: "difficult", space: "main", cells: ["1,2"] }];
assert.equal(Engine.movementPath(difficultScene, "hero", { x: 1, y: 3 }, { maxDistance: 2 }).length, 0, "Step may enter but cannot move beyond difficult terrain on the direct route");
const stepIntoDifficult = Engine.prepareAction(difficultScene, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 1, y: 2 } });
assert.equal(stepIntoDifficult.ok, true);
const afterDifficultEntry = Engine.dispatchMany(difficultScene, stepIntoDifficult.events).scene;
assert.equal(afterDifficultEntry.actors[0].stepRemaining, 0, "Entering difficult terrain ends saved Step movement");
assert.equal(afterDifficultEntry.actors[0].speedZeroUntilTurnEnd, true, "Difficult terrain sets Speed to zero until Turn end");
assert.match(Engine.availableActions(afterDifficultEntry, data, "hero").find(action => action.name === "Шаг").reason, /Скорость/);
assert.equal(Engine.prepareAction(difficultScene, data, { actorId: "hero", actionId: actionNamed("Прыжок").id, destination: { x: 1, y: 3 } }).ok, true, "Jump ignores difficult terrain");

const woundedScene = structuredClone(scene);
woundedScene.actors[0].hp = 1;
woundedScene.actors[0].guts = 4;
woundedScene.actors[0].wounds = 0;
const wounded = Engine.dispatch(woundedScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 5, ignoreArmor: true } }).scene;
assert.equal(wounded.actors[0].wounds, 1);
assert.equal(wounded.actors[0].hp, 4);
assert.equal(wounded.actors[0].influence, 1);

const finalWoundScene = structuredClone(scene);
finalWoundScene.actors[0].hp = 1;
finalWoundScene.actors[0].guts = 2;
finalWoundScene.actors[0].wounds = 1;
const finalWound = Engine.dispatch(finalWoundScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 1, ignoreArmor: true } }).scene;
assert.equal(finalWound.actors[0].knockedOut, true, "Reaching Guts in Wounds knocks the hero out");
assert.equal(finalWound.actors[0].wounds, 1, "Knockout removes one Wound after the threshold is reached");
assert.equal(finalWound.actors[0].hp, 0);

const selfWoundScene = structuredClone(scene);
selfWoundScene.actors[0].hp = 1;
selfWoundScene.actors[0].guts = 4;
selfWoundScene.actors[0].wounds = 0;
selfWoundScene.actors[0].influence = 0;
const selfWound = Engine.dispatch(selfWoundScene, { type: "damage.apply", actorId: "hero", payload: { targetId: "hero", amount: 1, ignoreArmor: true } }).scene;
assert.equal(selfWound.actors[0].wounds, 1);
assert.equal(selfWound.actors[0].hp, 4);
assert.equal(selfWound.actors[0].influence, 0, "A self-inflicted Wound grants no Influence");

const enemyKnockoutScene = structuredClone(scene);
enemyKnockoutScene.actors[1].hp = 1;
enemyKnockoutScene.actors[1].guts = 0;
enemyKnockoutScene.actors[1].wounds = 0;
const enemyKnockout = Engine.dispatch(enemyKnockoutScene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 1, ignoreArmor: true } }).scene;
assert.equal(enemyKnockout.actors[1].knockedOut, true, "An ordinary enemy with zero Guts is knocked out at zero HP");
assert.equal(enemyKnockout.actors[1].wounds, 0, "An ordinary enemy does not gain Wounds");

const lifecycleScene = structuredClone(scene);
lifecycleScene.activeActorId = null;
lifecycleScene.tension = 2;
lifecycleScene.actors[0].ap = 1;
lifecycleScene.actors[1].ap = 0;
lifecycleScene.objects = [{ id: "gas", type: "gas", duration: "nextTurn", ownerActorId: "hero", space: "main", cells: ["2,1"] }];
const entered = Engine.dispatchMany(lifecycleScene, [{ type: "actor.enter", actorId: "enemy", payload: {} }]).scene;
assert.ok(entered.actors[1].effects.includes("negative.ослаблен"));
const heroTurnResult = Engine.dispatchMany(entered, [{ type: "turn.start", actorId: "hero", payload: {} }]), heroTurn = heroTurnResult.scene;
assert.equal(heroTurn.activeActorId, "hero");
assert.equal(heroTurn.actors[0].ap, 1, "A hero keeps the AP established at Round start when their Turn begins");
assert.equal(heroTurn.objects.length, 0);
assert.ok(heroTurnResult.events.some(event => event.type === "area.remove" && event.payload.automatic && event.payload.boundaryEventId), "Expiring areas leave a typed, journaled removal");
const reminderCreated = Engine.dispatchMany(entered, [{ type: "reminder.create", actorId: "hero", payload: { id: "reminder-hero-start", label: "Отложенный взрыв", text: "Разрешить урон", boundary: "turnStart", ownerActorId: "hero" } }]).scene;
assert.equal(reminderCreated.reminders[0].due, false);
const reminderDueResult = Engine.dispatchMany(reminderCreated, [{ type: "turn.start", actorId: "hero", payload: {} }]), reminderDue = reminderDueResult.scene;
assert.equal(reminderDue.reminders[0].due, true, "A reminder becomes due at the requested future boundary");
assert.ok(reminderDueResult.events.some(event => event.type === "reminder.due" && event.payload.boundaryEventId));
const reminderResolved = Engine.dispatchMany(reminderDue, [{ type: "reminder.resolve", actorId: "hero", payload: { id: "reminder-hero-start" } }]).scene;
assert.equal(reminderResolved.reminders.length, 0, "Resolving a due reminder removes it from active work");
const endedHero = Engine.dispatch(heroTurn, { type: "turn.end", actorId: "hero", payload: {} }).scene;
assert.equal(endedHero.actors[0].ap, 1, "A hero keeps remaining AP for Reactions after their Turn");
assert.throws(() => Engine.dispatch(endedHero, { type: "turn.start", actorId: "hero", payload: {} }), /уже действовал/);
const enemyTurn = Engine.dispatch(endedHero, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
assert.equal(enemyTurn.actors[1].ap, 2, "An enemy starts each own Turn with 2 AP");
const endedEnemy = Engine.dispatch(enemyTurn, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(endedEnemy.actors[1].ap, 0);
assert.equal(Engine.roundEndStatus(endedEnemy).available, true);
const isolatedTurnState = structuredClone(scene);
isolatedTurnState.activeActorId = "enemy";
isolatedTurnState.actors[0].speedZeroUntilTurnEnd = true;
isolatedTurnState.actors[1].speedZeroUntilTurnEnd = true;
const isolatedTurnEnded = Engine.dispatch(isolatedTurnState, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(isolatedTurnEnded.actors[0].speedZeroUntilTurnEnd, true, "Ending another actor's Turn cannot clear this actor's difficult-terrain stop");
assert.equal(isolatedTurnEnded.actors[1].speedZeroUntilTurnEnd, false, "The temporary movement stop clears for its own actor");

const directKnockoutScene = structuredClone(scene);
directKnockoutScene.targetIds = ["hero", "enemy"];
directKnockoutScene.actors[0].extraTurns = 2;
directKnockoutScene.actors[0].stepRemaining = 2;
directKnockoutScene.actors[0].comboCooldowns = { "qa.combo": 2 };
directKnockoutScene.pendingAction = { id: "active-chain", actorId: "hero", responses: { enemy: { choice: "pending" } } };
const directlyKnockedOut = Engine.dispatch(directKnockoutScene, { type: "actor.knockout", actorId: "enemy", payload: { targetId: "hero" } }).scene;
assert.equal(directlyKnockedOut.actors[0].knockedOut, true);
assert.equal(directlyKnockedOut.actors[0].acted, true);
assert.equal(directlyKnockedOut.actors[0].extraTurns, 0);
assert.equal(directlyKnockedOut.actors[0].stepRemaining, 0);
assert.equal(directlyKnockedOut.actors[0].comboCooldowns["qa.combo"], 1);
assert.equal(directlyKnockedOut.activeActorId, null);
assert.equal(directlyKnockedOut.pendingAction.interruptedReason, "Атакующий выведен из боя");
assert.deepEqual(Array.from(directlyKnockedOut.targetIds), ["enemy"]);
assert.equal(directlyKnockedOut.tension, directKnockoutScene.tension + 1, "Every knockout uses the same tension and Turn-closure pipeline");
assert.throws(() => Engine.dispatch(directlyKnockedOut, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 1, y: 2 } }), /строя/, "Ordinary movement cannot move a knocked-out actor");

const reactingKnockoutScene = structuredClone(scene);
reactingKnockoutScene.pendingAction = { id: "reaction-chain", actorId: "hero", responses: { enemy: { choice: "pending" } } };
const reactingKnockout = Engine.dispatch(reactingKnockoutScene, { type: "actor.knockout", actorId: "hero", payload: { targetId: "enemy" } }).scene;
assert.equal(reactingKnockout.pendingAction.responses.enemy.choice, "unavailable", "A directly knocked-out target can no longer leave a Reaction pending");
const nextRound = Engine.dispatch(endedEnemy, { type: "round.end", payload: {} }).scene;
assert.equal(nextRound.round, 2);
assert.equal(nextRound.tension, 3);
assert.equal(nextRound.actors[0].ap, 3);
assert.equal(nextRound.actors[1].ap, 2);

const alternating = structuredClone(lifecycleScene);
alternating.actors.push({ ...structuredClone(alternating.actors[0]), id: "hero-2", name: "Второй герой", x: 1, y: 3, ap: 3, acted: false });
alternating.actors.push({ ...structuredClone(alternating.actors[1]), id: "enemy-2", name: "Второй враг", x: 3, y: 2, ap: 2, acted: false });
alternating.actors.push({ ...structuredClone(alternating.actors[1]), id: "enemy-3", name: "Третий враг", x: 3, y: 3, ap: 2, acted: false });
let alternatingState = Engine.dispatch(alternating, { type: "turn.start", actorId: "hero", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "hero", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "hero-2", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "hero-2", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "enemy-2", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "enemy-2", payload: {} }).scene;
assert.equal(Engine.turnStartStatus(alternatingState, "enemy-3").available, true, "The larger side may take consecutive Turns after every actor on the smaller side has acted");
assert.equal(Engine.roundEndStatus(alternatingState).available, false, "A Round stays open while an eligible actor has not acted");
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "enemy-3", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "enemy-3", payload: {} }).scene;
assert.equal(Engine.roundEndStatus(alternatingState).available, true, "A Round closes after every eligible hero and enemy has acted");

const heroHeavy = structuredClone(lifecycleScene);
heroHeavy.actors.push({ ...structuredClone(heroHeavy.actors[0]), id: "hero-2", name: "Второй герой", x: 1, y: 3, ap: 3, acted: false });
heroHeavy.actors.push({ ...structuredClone(heroHeavy.actors[0]), id: "hero-3", name: "Третий герой", x: 1, y: 4, ap: 3, acted: false });
let heroHeavyState = Engine.dispatch(heroHeavy, { type: "turn.start", actorId: "hero", payload: {} }).scene;
heroHeavyState = Engine.dispatch(heroHeavyState, { type: "turn.end", actorId: "hero", payload: {} }).scene;
heroHeavyState = Engine.dispatch(heroHeavyState, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
heroHeavyState = Engine.dispatch(heroHeavyState, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
heroHeavyState = Engine.dispatch(heroHeavyState, { type: "turn.start", actorId: "hero-2", payload: {} }).scene;
heroHeavyState = Engine.dispatch(heroHeavyState, { type: "turn.end", actorId: "hero-2", payload: {} }).scene;
assert.equal(Engine.turnStartStatus(heroHeavyState, "hero-3").available, true, "Consecutive hero Turns are allowed after every enemy has acted");

const knockedOut = Engine.dispatch(scene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 20, ignoreArmor: true } }).scene;
assert.equal(knockedOut.actors[1].knockedOut, true);
assert.equal(knockedOut.tension, 3);
assert.ok(Engine.availableActions(knockedOut, data, "enemy").every(action => !action.available));

const activeKoScene = structuredClone(scene);
activeKoScene.actors[0].hp = 1;
activeKoScene.actors[0].guts = 0;
activeKoScene.actors.push({ ...structuredClone(activeKoScene.actors[0]), id: "hero-2", name: "Оставшийся герой", x: 1, y: 3, hp: 12, guts: 4, knockedOut: false, acted: false });
const afterActiveKo = Engine.dispatch(activeKoScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 5, ignoreArmor: true } }).scene;
assert.equal(afterActiveKo.activeActorId, null);
assert.equal(afterActiveKo.log[0].payload.endedTurnActorId, "hero", "A KO explicitly records the interrupted Turn closure");
assert.equal(Engine.turnStartStatus(afterActiveKo, "enemy").available, true, "After an active hero is knocked out, alternation passes to an enemy");
assert.equal(Engine.turnStartStatus(afterActiveKo, "hero-2").available, false, "A second hero cannot act immediately after the interrupted hero Turn");

const staleTargetScene = structuredClone(scene);
staleTargetScene.actors[1].knockedOut = true;
assert.equal(prepareAttack(staleTargetScene, "hero", "enemy").ok, false, "A knocked-out participant cannot become a new Attack target");
assert.equal(prepareAttack(scene, "hero", "missing").ok, false, "A removed participant cannot survive in a new target list");
assert.throws(() => Engine.dispatch(scene, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 99 } }), /изменился/, "A stale command cannot silently over-spend a resource");

const interruptedSourceScene = structuredClone(awaiting);
interruptedSourceScene.actors[0].guts = 0;
const sourceDown = Engine.dispatch(interruptedSourceScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 99, ignoreArmor: true } }).scene;
const interruptedStatus = Engine.pendingActionStatus(sourceDown);
assert.equal(interruptedStatus.mustCancel, true);
assert.match(interruptedStatus.interruptedReason, /выведен из боя/);
const cancelledResolution = Engine.resolvePendingAction(sourceDown, data);
assert.equal(cancelledResolution.cancelled, true);
const afterCancellation = Engine.dispatchMany(sourceDown, cancelledResolution.events).scene;
assert.equal(afterCancellation.pendingAction, null);
assert.equal(afterCancellation.actors[1].hp, 10, "An interrupted source never deals delayed damage");

const multiTargetScene = structuredClone(scene);
multiTargetScene.actors.push({ ...structuredClone(multiTargetScene.actors[1]), id: "enemy-2", name: "Вторая цель", x: 1, y: 2, armor: 0, guts: 0 });
const multiAttack = prepareAttack(multiTargetScene, "hero", "enemy", "Стычка");
multiAttack.events.find(event => event.type === "attack.pending").payload.targetIds.push("enemy-2");
multiAttack.events.splice(-1, 0, { type: "reaction.offer", actorId: "enemy-2", payload: { sourceActorId: "hero", actionId: actionNamed("Стычка").id } });
let multiAwaiting = Engine.dispatchMany(multiTargetScene, multiAttack.events).scene;
multiAwaiting = Engine.dispatch(multiAwaiting, { type: "damage.apply", actorId: null, payload: { targetId: "enemy-2", amount: 99, ignoreArmor: true } }).scene;
assert.equal(multiAwaiting.pendingAction.responses["enemy-2"].choice, "unavailable");
assert.deepEqual(Array.from(Engine.pendingActionStatus(multiAwaiting, data).waitingIds), [], "Ordinary enemies never hold a multi-target Attack open");
const partialResolution = Engine.resolvePendingAction(multiAwaiting, data);
assert.equal(partialResolution.ok, true);
const partialResolved = Engine.dispatchMany(multiAwaiting, partialResolution.events).scene;
assert.equal(partialResolved.pendingAction, null);
assert.equal(partialResolved.actors.find(actor => actor.id === "enemy").hp, 9);
assert.equal(partialResolved.actors.find(actor => actor.id === "enemy-2").hp, 0, "An unavailable target is skipped instead of blocking or taking damage twice");
assert.equal(Engine.respondReaction(answered, data, { actorId: "enemy", choice: "pass" }).ok, false, "An unavailable enemy Reaction response is rejected");
assert.throws(() => Engine.dispatch(awaiting, { type: "attack.clear", actorId: "hero", payload: { pendingId: "stale" } }), /устарела/, "A stale cancel command cannot close a newer Attack");

const planScene = structuredClone(scene);
planScene.actors[0].techniques = { "vagabond.cunning-fighter": 2 };
planScene.actors[0].techniqueState = { cunningPlan: 0, studiedActorIds: [] };
const plannedStudy = Engine.prepareAction(planScene, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
const afterPlannedStudy = Engine.dispatchMany(planScene, plannedStudy.events).scene;
assert.equal(afterPlannedStudy.actors[0].techniqueState.cunningPlan, 1, "A first Study target fills Cunning Plan");
const plannedRest = Engine.prepareAction(afterPlannedStudy, data, { actorId: "hero", actionId: actionNamed("Передышка").id, useCunningPlan: true });
assert.equal(plannedRest.ok, true);
assert.equal(plannedRest.action.quick, true);
assert.equal(plannedRest.events.some(event => event.type === "resource.spend"), false, "Plan reduces a 1 AP action to zero");
assert.equal(Engine.dispatchMany(afterPlannedStudy, plannedRest.events).scene.actors[0].techniqueState.cunningPlan, 0);

const comboScene = structuredClone(scene);
comboScene.actors[0].techniques = { "powerhouse.technician": 3 };
comboScene.actors[0].comboCooldowns = {};
comboScene.log.unshift({ id: "previous-skirmish", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Стычка").id, actionName: "Стычка", name: "Стычка" } });
comboScene.actors[0].ap = 1;
const finalBlow = Engine.prepareTechniqueCombo(comboScene, data, { actorId: "hero", ruleId: "powerhouse.technician.3", targetIds: ["enemy"], roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(finalBlow.ok, true);
assert.equal(finalBlow.events.find(event => event.type === "resource.spend").payload.amount, 1, "Final Blow costs exactly 1 AP");
const comboAwaiting = Engine.dispatchMany(comboScene, finalBlow.events).scene;
assert.equal(comboAwaiting.actors[0].comboCooldowns["powerhouse.technician.3"], 2);
assert.equal(Engine.prepareTechniqueCombo(comboAwaiting, data, { actorId: "hero", ruleId: "powerhouse.technician.3", targetIds: ["enemy"] }).ok, false, "A combo cannot be reused while pending/on cooldown");
const speedScene = structuredClone(scene);
speedScene.actors[0].techniques = { "vagabond.assassin": 3 };
speedScene.actors[0].ap = 0;
speedScene.log.unshift({ id: "previous-hide", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Скрыться").id, actionName: "Скрыться", name: "Скрыться" } });
const speedOfDark = Engine.prepareTechniqueCombo(speedScene, data, { actorId: "hero", ruleId: "vagabond.assassin.3", destination: { x: 1, y: 2 } });
assert.equal(speedOfDark.ok, true);
assert.equal(speedOfDark.events.some(event => event.type === "resource.spend"), false);
assert.ok(speedOfDark.events.some(event => event.type === "effect.apply" && event.payload.effect === "positive.невидим"), "Speed of Dark is free and applies Invisible");

const flashStepScene = structuredClone(scene);
flashStepScene.actors[0].techniques = { "vagabond.speed-demon": 2 };
flashStepScene.actors[0].comboCooldowns = {};
flashStepScene.log.unshift({ id: "previous-rest-flash", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Передышка").id, actionName: "Передышка", name: "Передышка" } });
const flashStep = Engine.prepareTechniqueCombo(flashStepScene, data, { actorId: "hero", ruleId: "vagabond.speed-demon.2", destination: { x: 6, y: 1 } });
assert.equal(flashStep.ok, true);
assert.ok(flashStep.events.find(event => event.type === "actor.move").payload.path.length > 4, "Flash Step triples the Step movement allowance through the generic combo modifier");

const heaveScene = structuredClone(scene);
heaveScene.actors[0].techniques = { "powerhouse.dragonslayer": 3 };
heaveScene.actors[0].comboCooldowns = {};
heaveScene.log.unshift({ id: "previous-rest-heave", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Передышка").id, actionName: "Передышка", name: "Передышка" } });
const titanicHeave = Engine.prepareTechniqueCombo(heaveScene, data, { actorId: "hero", ruleId: "powerhouse.dragonslayer.3", targetIds: ["enemy"], attribute: "body", roll: { formula: "3D6", attribute: "body", rolls: [1, 2, 3], successes: 0, crits: 0 } });
assert.equal(titanicHeave.ok, true);
const heavePending = titanicHeave.events.find(event => event.type === "attack.pending").payload;
assert.equal(heavePending.roll.successes, 3, "Titanic Heave counts every die as a Success");
assert.equal(heavePending.postDisplacements[0].maximum, 2);
let heaveFlow = Engine.dispatchMany(heaveScene, titanicHeave.events).scene;
heaveFlow = Engine.dispatchMany(heaveFlow, Engine.respondReaction(heaveFlow, data, { actorId: "enemy", choice: "pass" }).events).scene;
heaveFlow = Engine.dispatchMany(heaveFlow, Engine.resolvePendingAction(heaveFlow, data).events).scene;
assert.equal(heaveFlow.actors.find(actor => actor.id === "enemy").x, 4);
assert.ok(heaveFlow.actors.find(actor => actor.id === "enemy").effects.includes("negative.разорван"), "Dragonslayer I applies Torn after a successful Body Finish");
assert.ok(heaveFlow.actors.find(actor => actor.id === "hero").effects.includes("negative.ослаблен"), "Titanic Heave applies Weakened only after the pending Attack resolves");

const witchScene = structuredClone(scene);
witchScene.actors[0].techniques = { "powerhouse.spellsword": 3 };
witchScene.actors[0].comboCooldowns = {};
witchScene.log.unshift({ id: "previous-spell-witch", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Заклинание").id, actionName: "Заклинание", name: "Заклинание", targetIds: ["enemy"] } });
const witchHunter = Engine.prepareTechniqueCombo(witchScene, data, { actorId: "hero", ruleId: "powerhouse.spellsword.3", targetIds: ["enemy"], attribute: "body", roll: { formula: "3D6", attribute: "body", rolls: [5, 4, 2], successes: 2, crits: 0 } });
assert.equal(witchHunter.ok, true);
assert.equal(witchHunter.events.find(event => event.type === "attack.pending").payload.damage, 8, "Witch Hunter adds Spirit to the Finish damage");
const wrongWitchTarget = structuredClone(witchScene);
wrongWitchTarget.actors.push({ ...structuredClone(witchScene.actors[1]), id: "enemy-2", name: "Другая цель", x: 1, y: 2 });
assert.equal(Engine.prepareTechniqueCombo(wrongWitchTarget, data, { actorId: "hero", ruleId: "powerhouse.spellsword.3", targetIds: ["enemy-2"], attribute: "talent", roll: { formula: "4D6", attribute: "talent", rolls: [6, 4, 2, 1], successes: 3, crits: 1 } }).ok, false, "Witch Hunter must keep the preceding Spell target");

const viperScene = structuredClone(enemyScene);
viperScene.actors[1].profileId = "enemy.common.viper";
viperScene.actors[1].tier = 2;
viperScene.actors[0].effects = ["negative.порчен"];
viperScene.actors.push({ ...structuredClone(viperScene.actors[0]), id: "hero-corrupt", hp: 12, x: 1, y: 2 });
const lick = Engine.availableEnemyRules(viperScene, data, "enemy").find(rule => rule.en === "Lick The Knife");
assert.equal(lick.automation, "full");
const licked = Engine.dispatchMany(viperScene, Engine.prepareEnemyRule(viperScene, data, { actorId: "enemy", ruleId: lick.id }).events).scene;
assert.equal(licked.actors.find(actor => actor.id === "hero").hp, 4);
assert.equal(licked.actors.find(actor => actor.id === "hero-corrupt").hp, 4, "Lick the Knife damages every Corrupted player by count × scaled value");

const cocoonScene = structuredClone(enemyScene);
cocoonScene.tension = 3;
cocoonScene.actors[1].profileId = "enemy.common.cocoon";
const growthRule = Engine.availableEnemyRules(cocoonScene, data, "enemy").find(rule => rule.en === "Quick Growth");
const grown = Engine.dispatchMany(cocoonScene, Engine.prepareEnemyRule(cocoonScene, data, { actorId: "enemy", ruleId: growthRule.id }).events).scene;
assert.equal(grown.actors[1].ruleState.growth, 1);
assert.equal(grown.actors[1].extraTurns, 1, "Quick Growth records Growth and grants the immediate extra Turn");
const extraTurn = Engine.dispatch(grown, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(extraTurn.activeActorId, "enemy");
assert.equal(extraTurn.actors[1].ap, extraTurn.actors[1].baseAp);
assert.equal(extraTurn.log[0].payload.startedExtraTurn, true, "Ending the first Turn immediately opens the granted Turn with fresh per-Turn history");

const trapScene = structuredClone(scene);
trapScene.activeActorId = "enemy";
trapScene.actors[0].techniques = { "disruptor.hunter": 1 };
trapScene.actors[0].x = 0;
trapScene.actors[0].y = 0;
trapScene.actors[1].x = 3;
trapScene.actors[1].y = 1;
trapScene.actors[1].speed = 3;
trapScene.actors[1].ap = 2;
trapScene.markers = [{ id: "trap", kind: "trap", ruleId: "disruptor.hunter.1", source: "disruptor.hunter.1", ownerActorId: "hero", space: "main", x: 2, y: 1 }];
const trappedStep = Engine.prepareAction(trapScene, data, { actorId: "enemy", actionId: actionNamed("Шаг").id, destination: { x: 0, y: 1 } });
assert.equal(trappedStep.ok, true);
const trapped = Engine.dispatchMany(trapScene, trappedStep.events).scene;
assert.deepEqual([trapped.actors[1].x, trapped.actors[1].y], [2, 1], "A Hunter trap truncates movement at the crossed trap cell");
assert.equal(trapped.pendingPrompt.kind, "hunter-trap");
const trapAttack = Engine.respondRulePrompt(trapped, data, { choice: "attack", roll: { formula: "3D6", rolls: [4, 5, 2], successes: 2, crits: 0 } });
const trapAttackScene = Engine.dispatchMany(trapped, trapAttack.events).scene;
assert.equal(trapAttackScene.pendingAction.techniqueRuleId, "disruptor.hunter.1");

const alchemistScene = structuredClone(scene);
alchemistScene.actors[0].techniques = { "altruist.alchemist": 2 };
const alchemistRest = Engine.prepareAction(alchemistScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const mixed = Engine.dispatchMany(alchemistScene, alchemistRest.events).scene;
assert.equal(mixed.pendingPrompt.kind, "alchemist-mix");
const potionCreated = Engine.dispatchMany(mixed, Engine.respondRulePrompt(mixed, data, { choice: "rage-fumes" }).events).scene;
assert.equal(potionCreated.actors[0].inventory["potion:rage-fumes"], 1);

const modifierScene = structuredClone(scene);
modifierScene.actors[0].tier = 2;
modifierScene.actors[1].effects = ["negative.подброшен"];
modifierScene.actors[1].effectStates = { "negative.подброшен": { duration: "startTurn", sources: [{ actorId: "hero", sourceActionId: "qa.launch" }] } };
const spikeId = "core.launch-spike:enemy";
const spikeStatus = Engine.attackModifierStatus(modifierScene, "hero", ["enemy"], [spikeId]);
assert.equal(spikeStatus.available, true);
assert.equal(spikeStatus.advantage, 2, "Spike grants the attacker's Tier as Advantage");
const spikedAttack = Engine.prepareAction(modifierScene, data, {
  actorId: "hero",
  actionId: actionNamed("Стычка").id,
  targetIds: ["enemy"],
  attackModifierIds: [spikeId],
  roll: { formula: "5D6 · Вбить +2", rolls: [6, 5, 4, 2, 1], successes: 3, crits: 1 },
});
assert.equal(spikedAttack.ok, true);
const afterSpike = Engine.dispatchMany(modifierScene, spikedAttack.events).scene;
assert.ok(!afterSpike.actors[1].effects.includes("negative.подброшен"), "A committed Spike removes Launched from only the selected target");
assert.deepEqual(Array.from(afterSpike.pendingAction.attackModifierIds), [spikeId]);
assert.equal(afterSpike.pendingAction.attackModifierAdvantage, 2);
assert.ok(afterSpike.log.some(event => event.type === "effect.remove" && event.payload?.sourceActionId === spikeId), "The consumed Effect is a separate journal event");
const staleSpike = Engine.prepareAction(modifierScene, data, {
  actorId: "hero",
  actionId: actionNamed("Стычка").id,
  targetIds: ["enemy"],
  attackModifierIds: ["core.launch-spike:missing"],
  roll: { formula: "3D6", rolls: [4, 2, 1], successes: 1, crits: 0 },
});
assert.equal(staleSpike.ok, false, "A stale pre-roll modifier cannot silently alter an Attack");
assert.ok(modifierScene.actors[1].effects.includes("negative.подброшен"), "Rejected modifier preparation leaves the source Scene unchanged");

const compositeScene = structuredClone(scene);
compositeScene.actors[0].effects = ["positive.исчез"];
compositeScene.actors[0].effectStates = { "positive.исчез": { duration: "actionOrStartTurn", sources: [{ actorId: "hero", sourceActionId: "qa.disappear" }] } };
const restId = actionNamed("Передышка").id;
const draft = Engine.prepareActionPlan(compositeScene, data, { actorId: "hero", actionId: restId, phase: "reappear", context: { targetIds: [] } });
assert.equal(draft.ok, true);
const drafted = Engine.dispatchMany(compositeScene, draft.events).scene;
assert.equal(drafted.actors[0].ap, 3);
assert.equal(drafted.pendingActionPlan.phase, "reappear");
assert.throws(() => Engine.dispatch(drafted, { type: "turn.end", actorId: "hero", payload: {} }), /составное действие/, "An open composite plan blocks its owner from ending the Turn");
const invalidAppearance = Engine.prepareActionPlanReappearance(drafted, { actorId: "hero", destination: { x: 3, y: 1 } });
assert.equal(invalidAppearance.ok, false, "Ordinary reappearance cannot be adjacent to another character");
const appearance = Engine.prepareActionPlanReappearance(drafted, { actorId: "hero", destination: { x: 5, y: 5 } });
assert.equal(appearance.ok, true);
const stagedComposite = Engine.dispatchMany(drafted, appearance.events).scene;
assert.equal(stagedComposite.pendingActionPlan.phase, "confirm");
assert.deepEqual([stagedComposite.actors[0].x, stagedComposite.actors[0].y], [1, 1], "Choosing phase one does not move the actor before final confirmation");
assert.ok(stagedComposite.actors[0].effects.includes("positive.исчез"));
assert.equal(stagedComposite.actors[0].ap, 3);
const cancelledComposite = Engine.dispatchMany(stagedComposite, Engine.cancelActionPlan(stagedComposite, { actorId: "hero" }).events).scene;
assert.equal(cancelledComposite.pendingActionPlan, null);
assert.deepEqual([cancelledComposite.actors[0].x, cancelledComposite.actors[0].y], [1, 1]);
assert.ok(cancelledComposite.actors[0].effects.includes("positive.исчез"));
assert.equal(cancelledComposite.actors[0].ap, 3, "Cancelling a composite plan leaves position, Effect, and resources untouched");
assert.ok(cancelledComposite.log.some(event => event.type === "action.plan.cancel"), "Cancellation remains visible in the event journal");
const interruptedComposite = Engine.dispatchMany(drafted, [{ type: "actor.knockout", actorId: "enemy", payload: { targetId: "hero" } }]).scene;
assert.equal(interruptedComposite.pendingActionPlan, null, "Knockout interrupts and cancels an open composite plan");
assert.ok(interruptedComposite.log.some(event => event.type === "action.plan.cancel" && /выведен из боя/i.test(event.payload?.reason || "")), "Interruption has an explicit journal reason");
const draftedAgain = Engine.dispatchMany(compositeScene, Engine.prepareActionPlan(compositeScene, data, { actorId: "hero", actionId: restId, phase: "reappear", context: { targetIds: [] } }).events).scene;
const stagedAgain = Engine.dispatchMany(draftedAgain, Engine.prepareActionPlanReappearance(draftedAgain, { actorId: "hero", destination: { x: 5, y: 5 } }).events).scene;
const continued = Engine.prepareActionPlanContinuation(stagedAgain, data, { actorId: "hero" });
assert.equal(continued.ok, true);
const completedComposite = Engine.dispatchMany(stagedAgain, continued.events).scene;
assert.equal(completedComposite.pendingActionPlan, null);
assert.deepEqual([completedComposite.actors[0].x, completedComposite.actors[0].y], [5, 5]);
assert.ok(!completedComposite.actors[0].effects.includes("positive.исчез"));
assert.equal(completedComposite.actors[0].ap, 2);
assert.equal(completedComposite.actors[0].focus, 51, "Appearance, Effect loss, payment, and action resolve in one committed batch");

const assassinScene = structuredClone(scene);
assassinScene.actors[0].techniques = { "vagabond.assassin": 2 };
assassinScene.actors[0].effects = ["positive.исчез"];
assassinScene.actors[0].effectStates = { "positive.исчез": { duration: "actionOrStartTurn", sources: [{ actorId: "hero", sourceActionId: "vagabond.assassin.1" }] } };
const assassinateDraft = Engine.prepareActionPlan(assassinScene, data, {
  actorId: "hero",
  actionId: actionNamed("Стычка").id,
  phase: "reappear",
  context: { targetIds: ["enemy"], attackModifierIds: [] },
});
assert.equal(assassinateDraft.ok, true);
const assassinatePlanned = Engine.dispatchMany(assassinScene, assassinateDraft.events).scene;
const adjacentAssassination = Engine.prepareActionPlanReappearance(assassinatePlanned, { actorId: "hero", destination: { x: 2, y: 2 } });
assert.equal(adjacentAssassination.ok, true, "Assassinate explicitly permits reappearing adjacent to a character");
const assassinateReady = Engine.dispatchMany(assassinatePlanned, adjacentAssassination.events).scene;
assert.equal(assassinateReady.pendingActionPlan.phase, "confirm");
assert.equal(assassinateReady.actors[0].ap, 3);
assert.ok(assassinateReady.actors[0].effects.includes("positive.исчез"), "Assassinate remains reversible before final confirmation");
const assassinateCommit = Engine.prepareActionPlanContinuation(assassinateReady, data, {
  actorId: "hero",
  context: { roll: { formula: "6D6 · Ликвидация · крит 5–6", rolls: [6, 5, 4, 3, 2, 1], successes: 3, crits: 2 }, attribute: "talent" },
});
assert.equal(assassinateCommit.ok, true);
const assassinated = Engine.dispatchMany(assassinateReady, assassinateCommit.events).scene;
assert.equal(assassinated.pendingActionPlan, null);
assert.deepEqual([assassinated.actors[0].x, assassinated.actors[0].y], [2, 2]);
assert.ok(!assassinated.actors[0].effects.includes("positive.исчез"));
assert.equal(assassinated.actors[0].ap, 2);
assert.equal(assassinated.pendingAction.responses.enemy.choice, "pending", "Assassinate keeps the ordinary Reaction window");
assert.ok(assassinated.log.some(event => event.type === "actor.move" && event.payload?.movement === "Ликвидация"));

const grapplerScene = structuredClone(scene);
grapplerScene.actors[0].techniques = { "bulwark.grappler": 2 };
grapplerScene.actors[0].tier = 2;
grapplerScene.actors[1].effects = ["negative.подброшен"];
grapplerScene.actors[1].effectStates = { "negative.подброшен": { duration: "endTurn", sources: [{ actorId: "hero", sourceActionId: "qa.launch" }] } };
assert.equal(Engine.ruleDiceAdvantage(grapplerScene, "hero", { actionName: "Стычка" }).total, 1, "Spine Breaker grants its passive Skirmish Advantage through the common dice query");
const spineId = "bulwark.grappler.2:enemy";
const spineStatus = Engine.attackModifierStatus(grapplerScene, "hero", ["enemy"], [spineId], { actionName: "Стычка" });
assert.equal(spineStatus.available, true);
assert.equal(spineStatus.advantage, 2);
assert.equal(spineStatus.requiresDestination, true);
assert.equal(spineStatus.actionTransform.actionName, "Завершение");
assert.equal(Engine.attackModifierDestinationStatus(grapplerScene, "hero", ["enemy"], [spineId], { x: 6, y: 6 }, { actionName: "Стычка" }).available, false);
const spineDraft = Engine.prepareActionPlan(grapplerScene, data, {
  actorId: "hero",
  actionId: actionNamed("Стычка").id,
  phase: "destination",
  context: { targetIds: ["enemy"], attackModifierIds: [spineId], destinationKind: "attack-modifier" },
});
assert.equal(spineDraft.ok, true);
const spinePlanned = Engine.dispatchMany(grapplerScene, spineDraft.events).scene;
const spineDestination = Engine.prepareActionPlanModifierDestination(spinePlanned, { actorId: "hero", destination: { x: 2, y: 2 } });
assert.equal(spineDestination.ok, true);
const spineReady = Engine.dispatchMany(spinePlanned, spineDestination.events).scene;
assert.equal(spineReady.pendingActionPlan.phase, "confirm");
assert.deepEqual([spineReady.actors[0].x, spineReady.actors[0].y], [1, 1]);
assert.equal(spineReady.actors[0].ap, 3, "Choosing the Spine Breaker teleport does not pay or move early");
const spineCommit = Engine.prepareActionPlanContinuation(spineReady, data, {
  actorId: "hero",
  context: { roll: { formula: "6D6 · Тело · Перелом позвоночника", rolls: [6, 5, 4, 3, 2, 1], successes: 3, crits: 1 }, attribute: "body" },
});
assert.equal(spineCommit.ok, true);
const spineBroken = Engine.dispatchMany(spineReady, spineCommit.events).scene;
assert.deepEqual([spineBroken.actors[0].x, spineBroken.actors[0].y], [2, 2]);
assert.equal(spineBroken.actors[0].ap, 2, "Transformed Finisher keeps the original Skirmish cost");
assert.ok(!spineBroken.actors[1].effects.includes("negative.подброшен"));
assert.equal(spineBroken.pendingAction.name, "Завершение");
assert.equal(spineBroken.pendingAction.attribute, "body");
assert.equal(spineBroken.pendingAction.declaredActionName, "Стычка");
assert.equal(spineBroken.pendingAction.responses.enemy.choice, "pending");
assert.ok(spineBroken.actors[0].usedActions.includes(actionNamed("Завершение").id), "The transformed attack consumes the Finisher use for this Round");
assert.ok(spineBroken.log.some(event => event.type === "actor.move" && /Перелом позвоночника/.test(event.payload?.movement || "")), "The optional teleport has its own journalled movement");
const spentFinisherScene = structuredClone(grapplerScene);
spentFinisherScene.actors[0].usedActions = [actionNamed("Завершение").id];
const spentFinisherDraft = Engine.prepareActionPlan(spentFinisherScene, data, {
  actorId: "hero",
  actionId: actionNamed("Стычка").id,
  phase: "destination",
  context: { targetIds: ["enemy"], attackModifierIds: [spineId], destinationKind: "attack-modifier" },
});
assert.equal(spentFinisherDraft.ok, false, "Spine Breaker cannot bypass the once-per-Round Finisher use");
const interruptedSpineScene = Engine.dispatchMany(spinePlanned, [{ type: "actor.knockout", actorId: "hero", payload: { targetId: "enemy" } }]).scene;
const interruptedSpine = Engine.prepareActionPlanModifierDestination(interruptedSpineScene, { actorId: "hero", destination: { x: 2, y: 2 } });
assert.equal(interruptedSpine.ok, false, "Losing the launched target interrupts the modifier before payment");
assert.deepEqual([interruptedSpineScene.actors[0].x, interruptedSpineScene.actors[0].y], [1, 1]);
assert.equal(interruptedSpineScene.actors[0].ap, 3);

const wispScene = structuredClone(scene);
wispScene.actors[0].techniques = { "altruist.will-o-wisp": 3 };
wispScene.pendingPrompt = { id: "wisp-primary-test", kind: "wisp-primary", sourceActorId: "hero", options: ["dreamy", "bright", "pass"], context: {} };
const firstWispChoice = Engine.respondRulePrompt(wispScene, data, { choice: "dreamy" });
assert.equal(firstWispChoice.ok, true);
const pairedWispPrompt = Engine.dispatchMany(wispScene, firstWispChoice.events).scene;
assert.equal(pairedWispPrompt.pendingPrompt.kind, "wisp-secondary");
const pairedWispChoice = Engine.respondRulePrompt(pairedWispPrompt, data, { choice: "split:bright" });
assert.equal(pairedWispChoice.ok, true);
let movingWispScene = Engine.dispatchMany(pairedWispPrompt, pairedWispChoice.events).scene;
assert.equal(movingWispScene.markers.length, 2, "Paired Spirits creates two separately identifiable wisps");
const selectedWisp = movingWispScene.markers[0];
movingWispScene = Engine.dispatch(movingWispScene, {
  type: "rule.prompt", actorId: "hero",
  payload: { id: "wisp-move-test", kind: "wisp-move-select", sourceActorId: "hero", options: [selectedWisp.id, "pass"], context: {} },
}).scene;
const selectWispMove = Engine.respondRulePrompt(movingWispScene, data, { choice: selectedWisp.id });
assert.equal(selectWispMove.ok, true);
movingWispScene = Engine.dispatchMany(movingWispScene, selectWispMove.events).scene;
assert.equal(movingWispScene.pendingPrompt.kind, "marker-move-cell");
const placeWisp = Engine.preparePromptPlacement(movingWispScene, { destination: { x: 4, y: 1 } });
assert.equal(placeWisp.ok, true);
const movedWispScene = Engine.dispatchMany(movingWispScene, placeWisp.events).scene;
const movedWisp = movedWispScene.markers.find(marker => marker.id === selectedWisp.id);
assert.deepEqual([movedWisp.x, movedWisp.y], [4, 1], "The selected wisp moves to the confirmed highlighted cell");
const leonScene = structuredClone(scene);
leonScene.tension = 3;
leonScene.activeActorId = "leon";
leonScene.actors[1] = {
  id: "leon", kind: "enemy", name: "Леон", team: "enemy",
  profileId: "enemy.named.leon-academy-spatial-mage", tier: 1,
  space: "main", x: 3, y: 3, ap: 2, baseAp: 2, focus: 0,
  hp: 16, maxHp: 16, speed: 2, armor: 0, evasion: 2,
  effects: [], usedActions: [], usedTrump: false, acted: false,
};
const elementalBreach = data.enemies.named.find(enemy => enemy.en === "Leon, Academy Spatial Mage").rules.find(rule => rule.en === "Elemental Breach");
const preparedBreach = Engine.prepareEnemyRule(leonScene, data, { actorId: "leon", ruleId: elementalBreach.id });
assert.equal(preparedBreach.ok, true);
assert.equal(preparedBreach.events.filter(event => event.type === "actor.spawn").length, 2);
const breachedScene = Engine.dispatchMany(leonScene, preparedBreach.events).scene;
assert.equal(breachedScene.actors.filter(actor => actor.summonerId === "leon").length, 2);
assert.equal(breachedScene.actors.find(actor => actor.name.includes("Вайю"))?.baseAp, 1);
assert.equal(breachedScene.actors.find(actor => actor.name.includes("Агни"))?.hp, 1);

const corpseScene = structuredClone(scene);
corpseScene.actors[1].x = 2; corpseScene.actors[1].y = 1; corpseScene.actors[1].knockedOut = true;
assert.equal(Engine.effectCellOccupancyStatus(corpseScene, "hero", { space: "main", x: 2, y: 1 }).available, true, "A defeated actor does not occupy its cell");
assert.equal(Engine.movementPath(corpseScene, "hero", { x: 3, y: 1 }, { maxDistance: 3 }).length, 2, "Movement may pass through a defeated enemy");
const movedCorpse = Engine.dispatch(corpseScene, { type: "actor.move", actorId: "enemy", payload: { space: "main", x: 4, y: 4, placement: true, allowKnockedOut: true, movement: "Ручная перестановка" } }).scene;
assert.deepEqual([movedCorpse.actors[1].x, movedCorpse.actors[1].y], [4, 4], "The Narrator may reposition a defeated token through the explicit placement override");

const manualAttackScene = Engine.dispatchMany(scene, [
  { type: "action.prepare", actorId: "enemy", payload: { actionId: "manual.attack", actionName: "Ручная атака", name: "Ручная атака", targetIds: ["hero"], quickReaction: true } },
  { type: "reaction.offer", actorId: "hero", payload: { sourceActorId: "enemy", actionId: "manual.attack", participantIds: ["enemy", "hero"] } },
  { type: "attack.pending", actorId: "enemy", payload: { actionId: "manual.attack", name: "Ручная атака", targetIds: ["hero"], damage: 2, roll: null, quickReaction: true, manualAttack: true } },
]).scene;
assert.equal(manualAttackScene.pendingAction?.responses?.hero?.choice, "pending", "A Narrator-declared unautomated attack opens the normal defensive Reaction window");

const cinematicScene = structuredClone(scene);
cinematicScene.spaces[0] = { id: "main", mode: "cinematic", width: 7, height: 1 };
cinematicScene.actors[0].x = 0; cinematicScene.actors[0].y = 0;
cinematicScene.actors[1].x = 2; cinematicScene.actors[1].y = 0;
assert.equal(Engine.effectCellOccupancyStatus(cinematicScene, "hero", { space: "main", x: 2, y: 0 }).available, true, "Cinematic positions allow any number of characters");
assert.equal(Engine.movementPath(cinematicScene, "hero", { x: 2, y: 0 }, { maxDistance: 4 }).length, 2, "A character may enter an enemy cinematic position");
assert.equal(Engine.movementPath(cinematicScene, "hero", { x: 3, y: 0 }, { maxDistance: 4 }).length, 0, "Entering an enemy cinematic position ends ordinary movement as Difficult Terrain");

const elevationScene = structuredClone(scene);
elevationScene.actors[1].x = 6; elevationScene.actors[1].y = 6;
elevationScene.objects = [{ id: "ledge", space: "main", type: "high", cells: Array.from({length:7},(_,y)=>`2,${y}`), duration: "persistent" }];
assert.equal(Engine.movementPath(elevationScene, "hero", { x: 2, y: 1 }, { maxDistance: 4 }).length, 1, "A character may enter a new height level");
assert.equal(Engine.movementPath(elevationScene, "hero", { x: 3, y: 1 }, { maxDistance: 4 }).length, 0, "Crossing to a new height level ends the current movement");
elevationScene.objects[0].cells = ["1,1"];
assert.equal(Engine.diceHookStatus(elevationScene, "hero", { scope: "action", actionName: "Стычка", baseCount: 4, targetIds: ["enemy"] }).advantage, 1, "An attack from higher Terrain gains Tier Advantage");
const canonicalTerrainScene = Engine.dispatch(scene, { type: "area.create", actorId: "hero", payload: { id: "wall-of-crates", space: "main", areaType: "terrain", label: "Ящики", source: "QA", duration: "persistent", cells: ["3,3", "3,4"] } }).scene;
assert.equal(canonicalTerrainScene.objects.at(-1).maxHp, 20, "Canonical Terrain receives 10 Health per occupied space");
const difficultStartScene = structuredClone(scene);
difficultStartScene.activeActorId = null;
difficultStartScene.actors[1].x = 6; difficultStartScene.actors[1].y = 6;
difficultStartScene.objects = [{ id: "mud", space: "main", type: "difficult", cells: ["1,1", "2,1", "3,1"], duration: "persistent" }];
const difficultStarted = Engine.dispatch(difficultStartScene, { type: "turn.start", actorId: "hero", payload: {} }).scene;
assert.deepEqual(Array.from(difficultStarted.actors[0].difficultTerrainImmunity), ["1,1", "2,1", "3,1"], "Starting a Turn in Difficult Terrain grants immunity to its connected component");
assert.equal(Engine.movementPath(difficultStarted, "hero", { x: 3, y: 1 }, { maxDistance: 4 }).length, 2, "The connected Difficult Terrain no longer stops that Turn's movement");

const walledScene = Engine.dispatch(scene, { type: "wall.create", actorId: "hero", payload: { id: "stone-wall", space: "main", a: "1,1", b: "2,1", label: "Каменная Стена", source: "QA", hp: 10, maxHp: 10 } }).scene;
assert.equal(walledScene.walls.length, 1, "Walls are canonical Scene entities");
assert.equal(Engine.movementPath(walledScene, "hero", { x: 2, y: 1 }, { maxDistance: 1 }).length, 0, "A Wall blocks voluntary movement across its edge");
assert.equal(Engine.displacementStatus(walledScene, { actorId: "hero", direction: "east", maximum: 1 }).available, false, "A Wall blocks forced movement across its edge");
assert.equal(Engine.wallTargetingStatus(walledScene, "hero", "enemy").available, false, "A Wall blocks targeting across its edge");
assert.equal(Engine.wallTargetingStatus(walledScene, "enemy", "hero").available, false, "Enemies use the same Wall targeting contract as heroes");
assert.equal(Engine.movementPath({ ...walledScene, activeActorId: "enemy" }, "enemy", { x: 1, y: 1 }, { maxDistance: 1 }).length, 0, "Enemy movement cannot cross a Wall");
assert.equal(prepareAttack(walledScene, "hero", "enemy").ok, false, "Canonical attacks reject a target behind a Wall");
const damagedWallScene = Engine.dispatch(walledScene, { type: "wall.damage", actorId: "hero", payload: { wallId: "stone-wall", amount: 5 } }).scene;
const repairedWallScene = Engine.dispatch(damagedWallScene, { type: "wall.restore", actorId: "hero", payload: { wallId: "stone-wall", amount: 3 } }).scene;
assert.equal(repairedWallScene.walls[0].hp, 8, "A Wall can be repaired up to its maximum Health");
const brokenWallScene = Engine.dispatch(repairedWallScene, { type: "wall.damage", actorId: "hero", payload: { wallId: "stone-wall", amount: 8 } }).scene;
assert.equal(brokenWallScene.walls.length, 0, "A Wall is removed when its Health reaches zero");
assert.equal(Engine.effectCellOccupancyStatus(canonicalTerrainScene, "hero", { space: "main", x: 3, y: 3 }).available, false, "Solid Terrain blocks placement as well as paths");
assert.equal(Engine.effectCellOccupancyStatus(canonicalTerrainScene, "enemy", { space: "main", x: 3, y: 3 }).available, false, "Solid Terrain blocks enemy placement through the shared occupancy contract");
const damagedTerrainScene = Engine.dispatch(canonicalTerrainScene, { type: "object.damage", actorId: "hero", payload: { objectId: "wall-of-crates", amount: 5 } }).scene;
assert.equal(Engine.dispatch(damagedTerrainScene, { type: "object.restore", actorId: "hero", payload: { objectId: "wall-of-crates", amount: 3 } }).scene.objects.at(-1).hp, 18, "Terrain can be repaired up to its maximum Health");
const switchedElevation = Engine.dispatch(elevationScene, { type: "area.create", actorId: "hero", payload: { id: "pit", space: "main", areaType: "low", label: "Провал", source: "QA", duration: "persistent", cells: ["1,1"] } }).scene;
assert.equal(switchedElevation.objects.some(object => object.type === "high" && object.cells.includes("1,1")), false, "High and Low Terrain cannot overlap");

const giftScene = structuredClone(scene);giftScene.actors[0].gifts = ["rebel.not-today", "cursed.sacrifice"];giftScene.actors[0].sacrifices = [];giftScene.actors[1].kind = "hero";giftScene.actors[1].profileId = null;giftScene.activeActorId = "enemy";
const giftAttack = Engine.dispatchMany(giftScene, prepareAttack(giftScene, "enemy", "hero").events).scene, notToday = Engine.reactionOptions(giftAttack, data, "hero").find(option => option.giftReaction);
assert.ok(notToday, "Not Today is exposed inside the actual defensive Reaction picker");
let notTodayScene = Engine.dispatchMany(giftAttack, Engine.respondReaction(giftAttack, data, { actorId: "hero", choice: notToday.id }).events).scene;
assert.equal(notTodayScene.pendingPrompt.kind, "not-today-risk", "Not Today asks the Narrator its three canonical risk questions");assert.equal(Engine.pendingTargetOutcome(notTodayScene, notTodayScene.pendingAction, "hero").cancelled, true, "Not Today negates the protected Attack before damage");
notTodayScene = Engine.dispatchMany(notTodayScene, Engine.respondRulePrompt(notTodayScene, data, { choice: "answers:000" }).events).scene;assert.equal(notTodayScene.rollFeed[0].rolls.length, 0, "Zero yes answers roll zero risk dice");
const sacrificeScene = Engine.dispatch(scene, { id: "gift-roll", type: "roll.public", actorId: "hero", payload: { formula: "3D6 ≥4", rolls: [4, 2, 1], successes: 1, crits: 0, target: 2, outcome: "Минимальный успех" } }).scene;sacrificeScene.actors[0].gifts = ["cursed.sacrifice"];sacrificeScene.actors[0].sacrifices = [];
const sacrificed = Engine.dispatchMany(sacrificeScene, Engine.prepareSacrifice(sacrificeScene, { actorId: "hero", rollId: "gift-roll", sacrifice: "eye" }).events).scene;assert.equal(sacrificed.rollFeed[0].outcome, "Крайний успех");assert.deepEqual(Array.from(sacrificed.actors[0].sacrifices), ["eye"]);

const enemyProfiles = [...(data.enemies?.common || []), ...(data.enemies?.named || [])];
const declaredAttacks = enemyProfiles.flatMap(profile => (profile.rules || []).filter(rule => rule.kind === "attack").map(rule => ({ profile, rule })));
assert.ok(declaredAttacks.length >= 40, "The enemy catalogue exposes the complete common Attack set");
assert.deepEqual(declaredAttacks.filter(({ rule }) => Engine.enemyRuleAutomation(rule.id) === "assisted").map(({ rule }) => rule.id), [], "Every declared enemy Attack has an executable automation contract");
for (const profileId of ["enemy.common.assassin", "enemy.common.pugilist", "enemy.common.guardian", "enemy.common.berserker", "enemy.common.ranger"]) {
  const profile = enemyProfiles.find(item => item.id === profileId);
  assert.ok(profile, `${profileId} exists in the canonical enemy catalogue`);
  assert.equal((profile.rules || []).filter(rule => Engine.enemyRuleAutomation(rule.id) === "assisted").length, 0, `${profile.name} has no Narrator-only profile buttons`);
}
const profileScene = profileId => { const value = structuredClone(enemyScene); value.actors[1].profileId = profileId; value.actors[1].name = enemyProfiles.find(item => item.id === profileId).name; value.actors[1].hp = 5; value.actors[1].maxHp = 30; value.actors[1].ruleState = {}; value.actors[1].usedActions = []; value.actors[1].usedTrump = false; value.actors[1].ap = 3; return value; };
const profileRule = (profileId, en) => enemyProfiles.find(item => item.id === profileId).rules.find(rule => rule.en === en);
let assassinFull = profileScene("enemy.common.assassin"), assassinMark = profileRule("enemy.common.assassin", "Neutralize Target");
assassinFull = Engine.dispatchMany(assassinFull, Engine.prepareEnemyRule(assassinFull, data, { actorId: "enemy", ruleId: assassinMark.id, targetIds: ["hero"] }).events).scene;
assert.ok(assassinFull.actors[0].effects.includes("negative.помечен"), "Assassin creates its durable Mark through the shared Effect state");
let pugilistFull = profileScene("enemy.common.pugilist"), stanceRule = profileRule("enemy.common.pugilist", "Take Stance");
pugilistFull = Engine.dispatchMany(pugilistFull, Engine.prepareEnemyRule(pugilistFull, data, { actorId: "enemy", ruleId: stanceRule.id, options: { stanceStep: 3 } }).events).scene;
assert.equal(pugilistFull.actors[1].ruleState.pugilistStance, 3, "Pugilist stance selection persists for Flurry sequencing");
let guardianFull = profileScene("enemy.common.guardian"), shieldRule = profileRule("enemy.common.guardian", "Guardian Shield");
guardianFull = Engine.dispatchMany(guardianFull, Engine.prepareEnemyRule(guardianFull, data, { actorId: "enemy", ruleId: shieldRule.id }).events).scene;
assert.ok(guardianFull.actors[1].effects.includes("negative.обездвижен") && guardianFull.actors[0].effects.includes("negative.спровоцирован"), "Guardian Shield applies both halves of its profile rule");
let berserkerFull = profileScene("enemy.common.berserker"), seethRule = profileRule("enemy.common.berserker", "Seeth");
berserkerFull = Engine.dispatchMany(berserkerFull, Engine.prepareEnemyRule(berserkerFull, data, { actorId: "enemy", ruleId: seethRule.id }).events).scene;
assert.equal(berserkerFull.actors[1].hp, 9, "Berserker Seeth heals its tier-scaled amount");
let rangerFull = profileScene("enemy.common.ranger"), nestRule = profileRule("enemy.common.ranger", "Nest");
rangerFull = Engine.dispatchMany(rangerFull, Engine.prepareEnemyRule(rangerFull, data, { actorId: "enemy", ruleId: nestRule.id }).events).scene;
assert.equal(rangerFull.actors[1].ruleState.enemyAim, 1, "Ranger Nest stores Aim for Take The Shot");
const resolveEnemyFamily = (sourceScene, family, targetIds = ["hero"], anchor = null) => {
  let value = structuredClone(sourceScene); value.pendingAction = null;
  value = Engine.dispatchMany(value, [
    ...targetIds.map(targetId => ({ type: "reaction.offer", actorId: targetId, payload: { sourceActorId: "enemy", actionId: "qa.enemy.attack" } })),
    { type: "attack.pending", actorId: "enemy", payload: { actionId: "qa.enemy.attack", name: "QA attack", targetIds, roll: { rolls: [6], successes: 1, crits: 1 }, damage: 1, damageByTarget: Object.fromEntries(targetIds.map(id => [id, 1])), enemyAttackFamily: family, attackAnchor: anchor } },
  ]).scene;
  for (const targetId of targetIds) value = Engine.dispatchMany(value, Engine.respondReaction(value, data, { actorId: targetId, choice: "pass" }).events).scene;
  return Engine.dispatchMany(value, Engine.resolvePendingAction(value, data).events).scene;
};
let fluxScene = profileScene("enemy.common.illusionist"); fluxScene.actors.push({ ...structuredClone(fluxScene.actors[1]), id: "illusion-ally", profileId: "enemy.common.guardian", x: 4, y: 1, ruleState: {} });
fluxScene = resolveEnemyFamily(fluxScene, { flux: true });
assert.ok(fluxScene.actors[0].effects.includes("special.поток"), "Distort Reality stores Flux as source-aware scene state");
fluxScene.activeActorId = null; fluxScene = Engine.dispatchMany(fluxScene, [{ type: "turn.start", actorId: "hero", payload: {} }]).scene;
assert.equal(fluxScene.pendingPrompt?.kind, "enemy-flux-swap", "Flux offers the Illusionist its canonical swap at the target's Turn start");
let cocoonRepeat = profileScene("enemy.common.cocoon"); cocoonRepeat.actors.push({ ...structuredClone(cocoonRepeat.actors[0]), id: "hero-2", name: "Свежая цель", x: 2, y: 2 });
cocoonRepeat = resolveEnemyFamily(cocoonRepeat, { repeatFreshTargets: true });
assert.equal(cocoonRepeat.pendingPrompt?.kind, "enemy-cocoon-repeat", "Rampage offers a fresh adjacent target after resolution");
let witchExpel = profileScene("enemy.common.witch"), beforeExpel = { x: witchExpel.actors[0].x, y: witchExpel.actors[0].y };
witchExpel = resolveEnemyFamily(witchExpel, { expelFromArea: true, area: [3, 3] }, ["hero"], { x: 1, y: 1 });
assert.notDeepEqual({ x: witchExpel.actors[0].x, y: witchExpel.actors[0].y }, beforeExpel, "Expelling Force moves a hit target to the nearest reachable cell outside its area");

console.log("Scene engine QA passed: canonical Turns and AP, once-per-Round actions, strict Reactions, truthful enemy automation, effects, movement, damage, and public events");
