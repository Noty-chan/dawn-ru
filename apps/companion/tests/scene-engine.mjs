import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
vm.runInNewContext(fs.readFileSync(new URL("../scene-engine.js", import.meta.url), "utf8"), context);
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
const idleScene = structuredClone(scene);
idleScene.activeActorId = null;
assert.ok(Engine.availableActions(idleScene, data, "hero").filter(action => !action.reaction).every(action => !action.available), "Ordinary actions require an explicitly started Turn");
assert.ok(Engine.availableEnemyRules(idleScene, data, "enemy").every(rule => !rule.available), "Enemy rules require an explicitly started Turn");
assert.equal(Engine.turnStartStatus(idleScene, "enemy").available, false, "A player begins a Round");
assert.equal(Engine.roundEndStatus(idleScene).available, false, "An untouched Round cannot be ended prematurely");
assert.throws(() => Engine.dispatch(scene, { type: "turn.start", actorId: "enemy", payload: {} }), /завершите текущий Ход/);
assert.throws(() => Engine.dispatch(scene, { type: "action.prepare", actorId: "enemy", payload: { actionId: "x", name: "Чужое действие", targetIds: [] } }), /не Ход/);

assert.throws(() => Engine.dispatch(scene, { type: "turn.end", actorId: "hero" }, { expectedVersion: 9 }), error => error.code === "SCENE_VERSION_CONFLICT");
const stableEvent = { id: "same-event", type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1 } };
const once = Engine.dispatch(scene, stableEvent).scene;
const twice = Engine.dispatch(once, stableEvent);
assert.equal(twice.duplicate, true);
assert.equal(twice.scene.actors[0].focus, 51, "Duplicate events are idempotent");
assert.throws(() => Engine.dispatch(scene, { type: "resource.gain", actorId: "hero", payload: { resource: "admin", amount: 9999 } }), /ресурса/);
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 99, y: 99 } }), /клетка/);
assert.throws(() => Engine.dispatch(scene, { type: "scene.replace", payload: { state: {} } }), /Неизвестный тип/);
const publicRoll = Engine.dispatch(scene, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, outcome: "Минимальный успех" } }).scene;
assert.equal(publicRoll.rollFeed[0].actor, "Эта");
assert.equal(publicRoll.rollFeed[0].outcome, "Минимальный успех");

const privateScene = structuredClone(scene);
privateScene.actors[0].privateNotes = "Тайна игрока";
privateScene.actors[1].hidden = true;
privateScene.markers = [{ id: "secret", kind: "hidden", hidden: true }];
privateScene.log = [{ id: "gm-only", visibility: "gm", type: "gm.note", payload: {} }, { id: "public", type: "roll.public", payload: {} }];
const playerProjection = Engine.projectScene(privateScene, { role: "player", actorIds: ["hero"] });
assert.equal(playerProjection.actors.length, 1);
assert.equal(playerProjection.actors[0].privateNotes, "Тайна игрока");
assert.equal(playerProjection.markers.length, 0);
assert.equal(playerProjection.log.length, 1);

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
assert.equal(hide.action.automation, "assist");
assert.ok(!hide.events.some(event => event.type === "effect.apply"), "Hide records its valid use without inventing a fully automated Vanished effect");
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
assert.deepEqual(Array.from(Engine.reactionOptions(awaiting, data, "enemy"), option => option.name), ["Без Реакции"], "Enemies do not spend the heroes' Focus Reactions");
assert.throws(() => Engine.dispatch(awaiting, { type: "round.end", payload: {} }), /завершите текущую цепочку Реакций/);
const passed = Engine.respondReaction(awaiting, data, { actorId: "enemy", choice: "pass" });
const answered = Engine.dispatchMany(awaiting, passed.events).scene;
const resolution = Engine.resolvePendingAction(answered, data);
assert.equal(resolution.ok, true);
const attacked = Engine.dispatchMany(answered, resolution.events).scene;
assert.equal(attacked.actors[0].ap, 2);
assert.equal(attacked.actors[1].hp, 9, "Armor reduces damage, but an Attack still deals at least 1");
assert.equal(attacked.rollFeed[0].successes, 2);
assert.equal(attacked.pendingAction, null);

const enemyScene = structuredClone(scene);
enemyScene.activeActorId = "enemy";
const enemyRules = Engine.availableEnemyRules(enemyScene, data, "enemy");
assert.equal(enemyRules.length, 3);
const neutralize = enemyRules.find(rule => rule.en === "Neutralize Target");
assert.equal(neutralize.automation, "effect");
const neutralized = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: neutralize.id, targetIds: ["hero"] });
assert.equal(neutralized.ok, true);
const afterNeutralize = Engine.dispatchMany(enemyScene, neutralized.events).scene;
assert.equal(afterNeutralize.actors[1].ap, 1);
assert.ok(afterNeutralize.actors[1].usedActions.includes(neutralize.id));
assert.ok(afterNeutralize.actors[0].effects.includes("negative.помечен"));
assert.ok(!afterNeutralize.actors[0].effects.includes("negative.замедлен"), "Conditional follow-up effects must not be applied early");
assert.equal(Engine.prepareEnemyRule(afterNeutralize, data, { actorId: "enemy", ruleId: neutralize.id, targetIds: ["hero"] }).ok, false, "Enemy actions are once per Round");

const slice = enemyRules.find(rule => rule.en === "Slice");
assert.equal(slice.automation, "assisted", "Conditional wounds and positioning keep Slice under Narrator confirmation");
const assistedSlice = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: slice.id, targetIds: ["hero"], roll: { formula: "5D6", rolls: [6, 5, 2, 1, 1], successes: 2, crits: 1 } });
assert.equal(assistedSlice.ok, true);
assert.ok(!assistedSlice.events.some(event => event.type === "attack.pending"), "Assisted attacks never silently apply a partial rule as if it were complete");
assert.ok(assistedSlice.events.some(event => event.type === "roll.public"));

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

const paladinScene = structuredClone(enemyScene);
paladinScene.actors[1].profileId = "enemy.common.paladin";
paladinScene.actors[1].name = "Паладин";
paladinScene.actors.push({ ...structuredClone(paladinScene.actors[1]), id: "enemy-ally", name: "Союзник Паладина", x: 2, y: 2 });
const gift = Engine.availableEnemyRules(paladinScene, data, "enemy").find(rule => rule.en === "Gift From God");
assert.equal(gift.automation, "assisted");
assert.equal(gift.maxTargets, 2);
assert.equal(Engine.prepareEnemyRule(paladinScene, data, { actorId: "enemy", ruleId: gift.id, targetIds: ["hero", "enemy-ally"], roll: { formula: "5D6", rolls: [6, 4, 2, 1, 1], successes: 2, crits: 1 } }).ok, true, "Mixed ally/enemy actions honor the two textual targets through Narrator confirmation");

const daredevilScene = structuredClone(enemyScene);
daredevilScene.actors[1].profileId = "enemy.common.daredevil";
daredevilScene.actors.push({ ...structuredClone(daredevilScene.actors[0]), id: "hero-2", name: "Вторая цель", x: 2, y: 2 });
const dance = Engine.availableEnemyRules(daredevilScene, data, "enemy").find(rule => rule.en === "Dance");
assert.equal(dance.automation, "assisted", "A two-target textual Attack is not falsely presented as fully automatic");
assert.equal(dance.maxTargets, 2);
assert.equal(Engine.prepareEnemyRule(daredevilScene, data, { actorId: "enemy", ruleId: dance.id, targetIds: ["hero", "hero-2"], roll: { formula: "5D6", rolls: [6, 4, 2, 1, 1], successes: 2, crits: 1 } }).ok, true, "Dance accepts its canonical two targets");

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
assert.equal(construction.automation, "assisted");
const directAttack = Engine.prepareEnemyRule(builderScene, data, { actorId: "enemy", ruleId: construction.id, targetIds: ["hero"], damage: 3 });
assert.equal(directAttack.ok, true, "Fixed-damage special attacks remain usable");
assert.ok(!directAttack.events.some(event => event.type === "attack.pending"), "Terrain placement is not falsely presented as fully automated");

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
awaitingDodge.pendingAction.effects = ["negative.помечен"];
const dodge = Engine.respondReaction(awaitingDodge, data, { actorId: "hero", choice: "Уворот", destination: { x: 0, y: 1 } });
assert.equal(dodge.ok, true);
const afterDodge = Engine.dispatchMany(awaitingDodge, dodge.events).scene;
assert.equal(afterDodge.actors[0].focus, 48);
assert.equal(afterDodge.actors[0].x, 0);
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

const lifecycleScene = structuredClone(scene);
lifecycleScene.activeActorId = null;
lifecycleScene.tension = 2;
lifecycleScene.actors[0].ap = 1;
lifecycleScene.actors[1].ap = 0;
lifecycleScene.objects = [{ id: "gas", type: "gas", duration: "nextTurn", ownerActorId: "hero", space: "main", cells: ["2,1"] }];
const entered = Engine.dispatch(lifecycleScene, { type: "actor.enter", actorId: "enemy", payload: {} }).scene;
assert.ok(entered.actors[1].effects.includes("Ослаблен"));
const heroTurn = Engine.dispatch(entered, { type: "turn.start", actorId: "hero", payload: {} }).scene;
assert.equal(heroTurn.activeActorId, "hero");
assert.equal(heroTurn.actors[0].ap, 1, "A hero keeps the AP established at Round start when their Turn begins");
assert.equal(heroTurn.objects.length, 0);
const endedHero = Engine.dispatch(heroTurn, { type: "turn.end", actorId: "hero", payload: {} }).scene;
assert.equal(endedHero.actors[0].ap, 1, "A hero keeps remaining AP for Reactions after their Turn");
assert.throws(() => Engine.dispatch(endedHero, { type: "turn.start", actorId: "hero", payload: {} }), /уже действовал/);
const enemyTurn = Engine.dispatch(endedHero, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
assert.equal(enemyTurn.actors[1].ap, 2, "An enemy starts each own Turn with 2 AP");
const endedEnemy = Engine.dispatch(enemyTurn, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(endedEnemy.actors[1].ap, 0);
assert.equal(Engine.roundEndStatus(endedEnemy).available, true);
const nextRound = Engine.dispatch(endedEnemy, { type: "round.end", payload: {} }).scene;
assert.equal(nextRound.round, 2);
assert.equal(nextRound.tension, 3);
assert.equal(nextRound.actors[0].ap, 3);
assert.equal(nextRound.actors[1].ap, 2);

const alternating = structuredClone(lifecycleScene);
alternating.actors.push({ ...structuredClone(alternating.actors[0]), id: "hero-2", name: "Второй герой", x: 1, y: 3, ap: 3, acted: false });
let alternatingState = Engine.dispatch(alternating, { type: "turn.start", actorId: "hero", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "hero", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "hero-2", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "hero-2", payload: {} }).scene;
assert.equal(Engine.turnStartStatus(alternatingState, "enemy").available, true, "When all enemies have acted, one of them may repeat to preserve alternation");
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(Engine.roundEndStatus(alternatingState).available, true, "A Round closes after every hero and one enemy Turn per hero");

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

console.log("Scene engine QA passed: canonical Turns and AP, once-per-Round actions, strict Reactions, truthful enemy automation, effects, movement, damage, and public events");
