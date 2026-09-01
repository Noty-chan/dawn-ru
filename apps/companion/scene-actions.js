"use strict";

const QUICK_ACTION_RULES = [
  { id: "vagabond.drunkard.3.rest", techniqueId: "vagabond.drunkard", level: 3, actionKey: "breathe", condition: "firstTurn" },
  { id: "altruist.battle-instructor.1.study", techniqueId: "altruist.battle-instructor", level: 1, actionKey: "study", condition: "always" },
  { id: "altruist.fog-walker.3.rest", techniqueId: "altruist.fog-walker", level: 3, actionKey: "breathe", condition: "always" },
  { id: "altruist.bardic-savant.2.rest", techniqueId: "altruist.bardic-savant", level: 2, actionKey: "breathe", condition: "always" },
  { id: "ruiner.creation-ascetic.2.rest", techniqueId: "ruiner.creation-ascetic", level: 2, actionKey: "breathe", condition: "firstTurn" },
];
const TECHNIQUE_COMBO_RULES = new Map([
  ["powerhouse.technician.3", { techniqueId: "powerhouse.technician", level: 3, name: "Последний удар", requiresKey: "skirmish", actionKey: "finish", apCost: 1 }],
  ["vagabond.assassin.3", { techniqueId: "vagabond.assassin", level: 3, name: "Скорость тьмы", requiresKey: "disappear", actionKey: "step", apCost: 0, selfEffect: "Невидим" }],
  ["powerhouse.dragonslayer.3", { techniqueId: "powerhouse.dragonslayer", level: 3, name: "Титанический замах", requiresKey: "breathe", actionKey: "finish", attribute: "body", allDiceSucceed: true, postPush: 2, postSelfEffects: ["Ослаблен"] }],
  ["powerhouse.spellsword.3", { techniqueId: "powerhouse.spellsword", level: 3, name: "Охотник на ведьм", requiresKey: "spell", actionKey: "finish", attributes: ["body", "talent"], sameTargets: true, bonusDamageAttribute: "spirit" }],
  ["vagabond.speed-demon.2", { techniqueId: "vagabond.speed-demon", level: 2, name: "Мгновенный шаг", requiresKey: "breathe", actionKey: "step", movementMultiplier: 3 }],
]);
// Enemy prose is intentionally never interpreted at runtime. These audited
// registries contain only the deterministic part of a rule; everything else
// stays assisted and is confirmed by the Narrator.
const ENEMY_AUTO_ATTACK_RULES = new Map([
  ["enemy.common.bruiser.attack.skulduggery", 2],
  ["enemy.common.assassin.attack.slice", 2],
  ["enemy.common.behemoth.attack.tore-from-earth", 2],
  ["enemy.common.captor.attack.catch-and-release", 2],
  ["enemy.common.executioner.attack.cleave", 2],
  ["enemy.common.javelin.attack.crushing-impact", 2],
  ["enemy.common.pugilist.attack.flurry-of-strikes", 2],
  ["enemy.common.ranger.attack.take-the-shot", 1],
  ["enemy.common.ronin.attack.dissect", 1],
  ["enemy.common.viper.attack.filet", 1],
  ["enemy.common.witch.attack.expelling-force", 2],
  ["enemy.common.broodmother.attack.swarming-chase", 1],
  ["enemy.common.cocoon.attack.rampage", 2],
  ["enemy.common.duelist.attack.fl-che", 1],
  ["enemy.common.slime.attack.goop", 1],
  ["enemy.common.glutton.attack.slobber", 1],
  ["enemy.common.mount.attack.thrash", 1],
  ["enemy.common.bodyguards.attack.behind-me", 1],
  ["enemy.common.oni.attack.polaris", 1],
  ["enemy.common.paladin.attack.gift-from-god", 1],
  ["enemy.common.daredevil.attack.dance", 1],
  ["enemy.common.guardian.attack.shove", 1],
  ["enemy.common.berserker.attack.thrash", 1],
  ["enemy.common.hound-master.attack.shove", 1],
  ["enemy.common.builder.attack.violent-construction", 0],
  ["enemy.common.coordinator.attack.fanaticize", 1],
  ["enemy.common.bannerman.attack.swing", 1],
  ["enemy.common.baron.attack.suppress", 1],
  ["enemy.common.cultist.attack.swipe", 1],
  ["enemy.common.healer.attack.exsanguinate", 1],
  ["enemy.common.illusionist.attack.distort-reality", 1],
  ["enemy.common.shade.attack.destroy-the-interloper", 1],
  ["enemy.common.necromancer.attack.terrifying-shot", 2],
  ["enemy.common.revenant.attack.tear-from-the-soul", 1],
  ["enemy.common.martyr.attack.savor-my-blood", 1],
  ["enemy.common.enchanter.attack.heartbreaker", 1],
  ["enemy.common.privateer.attack.spray-and-pray", 2],
  ["enemy.common.rifter.attack.emerge", 1],
  ["enemy.common.swarm.attack.tear", 1],
  ["enemy.common.cannoneer.trump.fire", 1],
  ["enemy.common.paladin.trump.weal-and-woe", 1],
  ["enemy.named.leon-academy-spatial-mage.attack.emerge", 1],
  ["enemy.named.leon-s-vayu-spirit.attack.air-shove", 0],
  ["enemy.named.leon-s-agni-spirit.attack.fire-spark", 0],
]);
// These overrides are reviewed facts omitted by the prose parser. They route
// otherwise ordinary attacks through existing target and post-hit families.
const ENEMY_ATTACK_FAMILY_RULES = new Map([
  ["enemy.common.assassin.attack.slice", { effects: [], wound: "isolated", markedSlow: true, hiddenAdvantage: "3(+1)", adjacent: true }],
  ["enemy.common.bruiser.attack.skulduggery", { effects: [], area: [2, 2], areaAnchor: "self", maxTargets: 40, postPushFormula: "1(+1)", stunOnIncompletePush: true }],
  ["enemy.common.behemoth.attack.tore-from-earth", { effects: [], maxTargets: 2, range: 6, createTerrainAdjacent: "10(+1)" }],
  ["enemy.common.glutton.attack.slobber", { maxTargets: 2, adjacent: true }],
  ["enemy.common.executioner.attack.cleave", { effects: ["Разорван"], maxTargets: 2, lineLength: 2, chargedAttack: true }],
  ["enemy.common.javelin.attack.crushing-impact", { effects: [], conditionalSingleEffect: "Подброшен", area: [2, 2], areaAnchor: "self", maxTargets: 40 }],
  ["enemy.common.pugilist.attack.flurry-of-strikes", { effects: [], adjacent: true, pugilistSequence: true }],
  ["enemy.common.ranger.attack.take-the-shot", { effects: [], range: 8, bonusTensionAtRange: 4, wound: "always", aimDamage: true }],
  ["enemy.common.ronin.attack.dissect", { effects: [], adjacent: true, wound: "two-crits" }],
  ["enemy.common.viper.attack.filet", { effects: ["Порчен"], adjacent: true, wound: "already-corrupted" }],
  ["enemy.common.witch.attack.expelling-force", { effects: [], area: [3, 3], maxTargets: 40, expelFromArea: true }],
  ["enemy.common.bodyguards.attack.behind-me", { effects: [], maxTargets: 3, audience: "any", allyEffects: ["Укреплен"], crowdAdvance: 1, targetAdjacentToCrowd: true }],
  ["enemy.common.broodmother.attack.swarming-chase", { effects: [], maxTargets: 40, broodmotherDamage: true, preMoveMaximum: 1, moveAdjacentAllies: true, targetsAdjacentAfterMove: true }],
  ["enemy.common.cocoon.attack.rampage", { effects: [], adjacent: true, preMoveMaximum: 3, preMoveStraight: true, preMoveIgnoreRestrictions: true, repeatFreshTargets: true }],
  ["enemy.common.duelist.attack.fl-che", { effects: [], range: 2, provokedTierDamage: true, postSelfMove: 1 }],
  ["enemy.common.guardian.attack.shove", { postPush: 2 }],
  ["enemy.common.mount.attack.thrash", { maxTargets: 2, adjacent: true }],
  ["enemy.common.oni.attack.polaris", { effects: [], maxTargets: 40, audience: "any", oniModes: true, preMoveMaximum: 2, preMoveStraight: true, targetsAdjacentAfterMove: true }],
  ["enemy.common.paladin.attack.gift-from-god", { effects: [], maxTargets: 2, adjacent: true, audience: "any", allyHeal: true, allyEffects: ["Регенерирует"], enemyEffects: ["Ошеломлен"] }],
  ["enemy.common.paladin.trump.weal-and-woe", { effects: [], attack: true, range: 2, maxTargets: 40, audience: "any", allyHeal: true, allyEffects: ["Регенерирует"], enemyEffects: ["Ошеломлен"] }],
  ["enemy.common.daredevil.attack.dance", { maxTargets: 2, adjacent: true }],
  ["enemy.common.berserker.attack.thrash", { postPush: 1 }],
  ["enemy.common.hound-master.attack.shove", { postPush: 2 }],
  ["enemy.common.builder.attack.violent-construction", { effects: [], range: 6, createTerrainAdjacent: "10(+1)" }],
  ["enemy.common.coordinator.attack.fanaticize", { effects: [], adjacent: true, allyFollowup: true }],
  ["enemy.common.healer.attack.exsanguinate", { effects: [], range: 5, healerMark: true }],
  ["enemy.common.illusionist.attack.distort-reality", { effects: [], flux: true }],
  ["enemy.common.shade.attack.destroy-the-interloper", { effects: ["Изгнан"], postMoveMaximum: 4 }],
  ["enemy.common.revenant.attack.tear-from-the-soul", { postResourceLoss: { resource: "focus", formula: "2(+1)" } }],
  ["enemy.common.martyr.attack.savor-my-blood", { requiresTarget: true, targetCellOccupant: true, postSelfHealMissingFraction: 0.5 }],
  ["enemy.common.cannoneer.trump.fire", { effects: [], attack: true, range: 10, damageRepeats: 3 }],
  ["enemy.common.enchanter.attack.heartbreaker", { effects: [], conditionalEffectsByTarget: { any: ["Испуган", "Спровоцирован"], apply: ["Ослаблен", "Замедлен"] } }],
  ["enemy.common.privateer.attack.spray-and-pray", { effects: [], range: 3, maxTargets: 40, lineLength: 2 }],
  ["enemy.common.rifter.attack.emerge", { effects: [], maxTargets: 40, teleportAttack: true, preMoveMaximum: 5, targetsAdjacentAfterMove: true }],
  ["enemy.common.swarm.attack.tear", { effects: [], maxTargets: 3, chooseOneEffect: "Ошеломлен", crowdAdvance: 1, targetAdjacentToCrowd: true }],
  ["enemy.named.leon-s-vayu-spirit.attack.air-shove", { postPush: 1 }],
  ["enemy.named.leon-academy-spatial-mage.attack.emerge", { effects: [], range: 5, maxTargets: 40, teleportAttack: true }],
]);

function enemyTierFormula(formula, tier) {
  const match = String(formula || "").match(/^(\d+)(?:\(\+(\d+)\))?$/);
  return match ? Number(match[1]) + Math.max(0, Number(tier || 1) - 1) * Number(match[2] || 0) : 0;
}
const ENEMY_AUTO_EFFECT_RULES = new Set([
  "enemy.common.assassin.action.neutralize-target",
  "enemy.common.assassin.trump.disappear",
  "enemy.common.executioner.action.focus-up",
  "enemy.common.ranger.action.nest",
  "enemy.common.ronin.trump.thunderclap-and-flash",
  "enemy.common.cocoon.action.menace",
  "enemy.common.duelist.action.goad",
  "enemy.common.paladin.action.gospel",
  "enemy.common.bannerman.action.in-position",
  "enemy.common.coordinator.action.neutralize-them",
  "enemy.common.privateer.action.escort",
  "enemy.common.cannoneer.action.aim",
]);
const ENEMY_FULL_RULES = new Map([
  ["enemy.common.assassin.trump.disappear", { type: "effects" }],
  ["enemy.common.assassin.action.neutralize-target", { type: "assassin-mark" }],
  ["enemy.common.executioner.action.focus-up", { type: "effects" }],
  ["enemy.common.executioner.trump.bifurcate", { type: "executioner-bifurcate" }],
  ["enemy.common.paladin.action.gospel", { type: "regenerating-allies" }],
  ["enemy.common.cannoneer.action.aim", { type: "effects" }],
  ["enemy.common.pugilist.action.take-stance", { type: "pugilist-stance" }],
  ["enemy.common.pugilist.trump.martial-perfection", { type: "martial-perfection" }],
  ["enemy.common.viper.action.lick-the-knife", { type: "corrupted-damage", formula: "3(+1)" }],
  ["enemy.common.cocoon.trump.quick-growth", { type: "growth-and-turn" }],
  ["enemy.common.guardian.trump.imposing-presence", { type: "imposing-presence" }],
  ["enemy.common.guardian.action.guardian-shield", { type: "guardian-shield" }],
  ["enemy.common.berserker.action.seeth", { type: "berserker-heal", formula: "4(+2)" }],
  ["enemy.common.berserker.trump.last-stand", { type: "berserker-last-stand", formula: "10(+3)" }],
  ["enemy.common.ranger.action.nest", { type: "ranger-nest" }],
  ["enemy.common.ranger.trump.headshot", { type: "ranger-headshot" }],
  ["enemy.common.duelist.action.goad", { type: "duelist-goad" }],
  ["enemy.common.healer.action.heal", { type: "healer-heal", formula: "3(+1)" }],
  ["enemy.common.healer.trump.savior", { type: "healer-savior" }],
  ["enemy.common.cannoneer.attack.load", { type: "cannoneer-load" }],
  ["enemy.common.oni.action.stabilize", { type: "oni-stabilize" }],
  ["enemy.common.revenant.action.lurk", { type: "revenant-lurk" }],
  ["enemy.common.revenant.trump.hollowed-eyes", { type: "revenant-hollowed-eyes" }],
  ["enemy.common.broodmother.trump.roar", { type: "broodmother-roar" }],
  ["enemy.common.hound-master.action.fire-seeker", { type: "hound-seekers", count: 1, minimumTargetDistance: 4 }],
  ["enemy.common.hound-master.trump.wild-hunt", { type: "hound-seekers", count: 3, minimumTargetDistance: 0 }],
  ["enemy.common.privateer.trump.gear-change", { type: "privateer-gear-change" }],
  ["enemy.common.ronin.action.sheath", { type: "ronin-sheath" }],
  ["enemy.named.leon-academy-spatial-mage.trump.elemental-breach", {
    type: "summon-profiles",
    profiles: ["enemy.named.leon-s-vayu-spirit", "enemy.named.leon-s-agni-spirit"],
  }],
]);
const ENEMY_TARGET_LIMITS = new Map([
  ["enemy.common.behemoth.action.leap", 40],
  ["enemy.common.behemoth.trump.meteor", 40],
  ["enemy.common.captor.trump.sticky-bomb", 40],
  ["enemy.common.witch.attack.expelling-force", 40],
  ["enemy.common.bodyguards.attack.behind-me", 3],
  ["enemy.common.glutton.attack.slobber", 2],
  ["enemy.common.mount.attack.thrash", 2],
  ["enemy.common.oni.attack.polaris", 40],
  ["enemy.common.paladin.attack.gift-from-god", 2],
  ["enemy.common.illusionist.attack.distort-reality", 40],
  ["enemy.common.daredevil.attack.dance", 2],
  ["enemy.common.privateer.attack.spray-and-pray", 40],
]);
function quickActionSources(scene, data, actor, action) {
  if (!action?.name || !actor?.techniques || !data?.archetypes) return [];
  const usesThisTurn = currentTurnEvents(scene, actor.id).filter(event => event.type === "action.prepare" && event.payload?.actionId === action.id).length;
  const sources = [];
  const log = scene.log || [], deploymentIndex = log.findIndex(event => event.type === "actor.move" && event.actorId === actor.id && event.payload?.placement && event.payload?.movement === "Развертывание"), actedAfterDeployment = deploymentIndex >= 0 && log.slice(0, deploymentIndex).some(event => event.type === "action.prepare" && event.actorId === actor.id);
  if (actionIs(action, "disappear") && Number(actor.techniques?.["vagabond.assassin"] || 0) >= 1 && deploymentIndex >= 0 && !actedAfterDeployment) {
    const technique = (data.archetypes || []).flatMap(archetype => archetype.techniques || []).find(item => item.id === "vagabond.assassin");
    sources.push({ id: "vagabond.assassin.1", techniqueId: "vagabond.assassin", level: 1, name: "Засада", condition: "afterDeployment", ignoreRequirements: true, needsConfirmation: false, text: technique?.levels?.[0]?.text || "" });
  }
  if (actionIs(action, "spell") && actor.ruleState?.grimTransformed && !currentTurnEvents(scene, actor.id).some(event => event.type === "action.prepare" && actionIdIs(event.payload?.actionId, "spell"))) {
    sources.push({ id: "ruiner.grim-ascendant.1.spell", techniqueId: "ruiner.grim-ascendant", level: 1, name: "Непостоянная мощь", condition: "firstTurn", needsConfirmation: false, text: "Первое Заклинание в Ход является Быстрым." });
  }
  if (actionIs(action, "spell") && Number(actor.ruleState?.icicleSpellsRemaining || 0) > 0) sources.push({ id: "ruiner.cryomancer.2.icicle", techniqueId: "ruiner.cryomancer", level: 2, name: "Ледяной нимб", condition: "quota", needsConfirmation: false, text: "Один из оставшихся зарядов Сосульки делает Заклинание Быстрым и уменьшает его урон вдвое; другие действия не блокируются." });
  for (const rule of QUICK_ACTION_RULES.filter(item => actionIs(action, item.actionKey) && Number(actor.techniques?.[item.techniqueId] || 0) >= item.level)) {
    if (rule.condition === "firstTurn" && usesThisTurn > 0) continue;
    const technique = (data.archetypes || []).flatMap(archetype => archetype.techniques || []).find(item => item.id === rule.techniqueId);
    const level = technique?.levels?.find(item => Number(item.n) === rule.level);
    if (technique && level) sources.push({ id: rule.id, techniqueId: technique.id, level: rule.level, name: level.name, condition: rule.condition, needsConfirmation: false, text: level.text });
  }
  return sources;
}

const MASTER_AT_ARMS_GROUP = "vagabond.master-at-arms.armament";

function masterAtArmsStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), modeId = request.modeId || null, targetIds = [...new Set(request.targetIds || [])], targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
  if (!actor || Number(actor.techniques?.["vagabond.master-at-arms"] || 0) < 1) return { available: false, reason: "Персонаж не владеет «Многогранностью».", modeId, options: [] };
  if (!modeId) {
    const options = ["blade", "polearm", "chain"].map(id => masterAtArmsStatus(scene, actorId, { ...request, modeId: id, requireDestination: false }));
    return { available: options.some(option => option.available), reason: "", modeId: null, current: ruleModeStatus(scene, actor.id, { groupId: MASTER_AT_ARMS_GROUP }).current, options };
  }
  const mode = ruleModeStatus(scene, actor.id, { groupId: MASTER_AT_ARMS_GROUP, modeId });
  if (!mode.available) return { ...mode, options: [] };
  const present = (scene.actors || []).filter(item => item.id !== actor.id && item.space === actor.space && !item.knockedOut && effectPresenceStatus(scene, item.id).available), enemies = present.filter(item => item.team !== actor.team), labels = { blade: "Клинок", polearm: "Древко", chain: "Цепь" };
  let reason = "", destination = request.destination && { x: Number(request.destination.x), y: Number(request.destination.y) }, path = [];
  if (targets.length !== targetIds.length || targets.some(target => target.team === actor.team || target.knockedOut || target.space !== actor.space)) reason = "Вооружение требует доступные вражеские цели.";
  else if (modeId === "blade") {
    if (present.some(item => distance(actor, item) <= 1)) reason = "Клинок требует, чтобы персонаж ни с кем не был смежен.";
    else if (!enemies.some(enemy => distance(actor, enemy) === 2)) reason = "Для Клинка нужен враг ровно в 2 клетках.";
    else if (request.requireDestination !== false) {
      path = destination ? movementPath(scene, actor.id, destination, { maxDistance: 1 }) : [];
      if (!destination || path.length !== 1) reason = "Клинок требует переместиться ровно на 1 свободную клетку перед выбором целей.";
      else if (request.requireTargets === false && !enemies.some(target => distance({ ...actor, ...destination }, target) <= 1)) reason = "Клетка Клинка должна вывести к одной или нескольким смежным вражеским целям.";
      else if (request.requireTargets !== false && (!targetIds.length || targetIds.length > 2 || targets.some(target => distance({ ...actor, ...destination }, target) > 1))) reason = "После перемещения Клинок выбирает одну или две смежные вражеские цели.";
    }
  } else if (modeId === "polearm") {
    if (targetIds.length !== 2 || targets.some(target => distance(actor, target) !== 1)) reason = "Древко требует ровно двух смежных врагов.";
  } else if (modeId === "chain") {
    if (targetIds.length !== 1 || distance(actor, targets[0]) !== 4) reason = "Цепь требует ровно одну вражескую цель на расстоянии 4.";
  } else reason = "Неизвестное Вооружение.";
  return { ...mode, available: !reason, reason, modeId, label: labels[modeId] || mode.mode?.label || modeId, destination, path, targetIds, options: [] };
}

function availableActions(scene, data, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor) return [];
  if (actor.kind === "crowd") return [];
  // Canon: enemies spend AP on their profile actions or Step. They do not get
  // the player's Jump, Attacks, Utility actions, or defensive Reactions.
  const enemyProfileActor = actor.kind === "enemy" || Boolean(actor.profileId);
  const baseActions = enemyProfileActor ? (data?.actions?.list || []).filter(action => actionIs(action, "step")) : (data?.actions?.list || []);
  return baseActions.map(action => {
    const cost = actorActionCost(actor, action);
    const reaction = ["block", "clash", "dodge"].some(key => actionIs(action, key));
    let quickSource = quickActionSources(scene, data, actor, action)[0] || null;
    const rage = clockStatus(scene, actor.id, "ruiner.feral-arcana.rage");
    if (!quickSource && actionIs(action, "jump") && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 2 && rage.available && rage.active && rage.value > 0) quickSource = { id: "ruiner.feral-arcana.2", techniqueId: "ruiner.feral-arcana", level: 2, name: "Сорваться с цепи", needsConfirmation: false, text: "Прыжки Быстрые, пока существует Ярость." };
    const continuation = actionIs(action, "step") && (actor.usedActions || []).includes(action.id) && Number(actor.stepRemaining || 0) > 0;
    const quick = !continuation && Boolean(quickSource);
    const effectiveCost = continuation || quickSource?.id === "vagabond.assassin.1" ? { amount: 0, resource: null } : cost;
    const automation = quickSource?.needsConfirmation ? "assist" : ["jump", "step", "spell", "block", "dodge", "breathe", "charge", "disappear", "study"].some(key => actionIs(action, key)) ? "full" : "assist";
    const offeredReaction = scene.pendingAction?.responses?.[actor.id]?.choice === "pending";
    let reason = "";
    if (actor.knockedOut) reason = "Персонаж выведен из строя";
    else if (reaction && !offeredReaction) reason = "Доступно только в ответ на Атаку";
    else if (scene.pendingAction && !reaction) reason = "Сначала разрешите Реакцию";
    else if (scene.pendingPrompt && !reaction) reason = "Сначала ответьте на сработавшее правило";
    else if (scene.pendingActionPlan && !reaction && (scene.pendingActionPlan.actorId !== actor.id || scene.pendingActionPlan.actionId !== action.id)) reason = `Сначала завершите составное действие «${scene.pendingActionPlan.actionName}»`;
    else if (!reaction && !scene.activeActorId) reason = "Сначала начните Ход";
    else if (!reaction && scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
    else if (!reaction && actor.acted) reason = "Ход уже завершён";
    else if (!reaction && actionIs(action, "step") && actor.speedZeroUntilTurnEnd) reason = "Скорость равна 0 до конца текущего Хода";
    else if (!reaction && ["step", "jump"].some(key => actionIs(action, key)) && !effectMovementStatus(scene, actor.id).available) reason = effectMovementStatus(scene, actor.id).reason;
    else if (!reaction && rage.available && rage.active && rage.value > 0 && effectiveCost.resource === "ap" && !["jump", "finish"].some(key => actionIs(action, key))) reason = "Пока существует Ярость, ОД можно тратить только на Прыжки и Завершения";
    else if (!reaction && (actor.usedActions || []).includes(action.id) && !continuation && !quick) reason = "Это действие уже использовано в Раунде";
    else if (actionIs(action, "skirmish") && Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 1 && !ruleResourceStatus(scene, actor.id, { resource: "bullets", amount: 1 }).available) reason = "Для Стычки нужна хотя бы 1 Пуля";
    else if (effectiveCost.resource && !resourceOperationStatus(scene, actor.id, { ...effectiveCost, operation: "spend" }).available) reason = `Недостаточно: ${action.cost}`;
    return { ...clone(action), costModel: effectiveCost, reaction, automation, quick, quickSource, continuation, remaining: continuation ? Number(actor.stepRemaining || 0) : null, available: !reason, reason };
  });
}

function cunningPlanStatus(scene, data, actorId, actionId) {
  const actor = actorById(scene, actorId), action = actionById(data, actionId);
  if (!actor || !action) return { available: false, reason: "Действие не найдено.", segments: 0, unlimited: false };
  const level = Number(actor.techniques?.["vagabond.cunning-fighter"] || 0), segments = clockStatus(scene, actor.id, "vagabond.cunning-fighter.plan").value, unlimited = level >= 2;
  const attack = ["skirmish", "spell", "finish"].some(key => actionIs(action, key));
  const usedThisTurn = currentTurnEvents(scene, actor.id).some(event => event.type === "rule-clock.tick" && event.payload?.sourceActionId === "vagabond.cunning-fighter.1.plan");
  let reason = "";
  if (level < 1) reason = "Не изучена Техника «План и исполнение».";
  else if (actor.knockedOut) reason = "Персонаж выведен из строя.";
  else if (scene.pendingAction) reason = "Сначала разрешите текущую Реакцию.";
  else if (scene.activeActorId !== actor.id) reason = "Сейчас не Ход этого героя.";
  else if (attack || ["block", "clash", "dodge"].some(key => actionIs(action, key))) reason = "Хитрый план применяется только к действиям не-Атаки.";
  else if (actionIs(action, "step") && Number(actor.stepRemaining || 0) > 0) reason = "Сначала завершите уже оплаченный Шаг.";
  else if (segments < 1) reason = "Часы Хитрого плана пусты.";
  else if (!unlimited && usedThisTurn) reason = "«План и исполнение» уже использован в этом Ходу.";
  return { available: !reason, reason, segments, unlimited, discountedCost: Math.max(0, Number(actionCost(action).amount || 0) - 1) };
}

function prepareAction(scene, data, request = {}) {
  const actionInstanceId = eventId();
  const actor = actorById(scene, request.actorId);
  const declaredAction = actionById(data, request.actionId);
  let action = declaredAction;
  const errors = [];
  if (!actor) errors.push("Не выбран исполнитель действия.");
  if (!declaredAction) errors.push("Неизвестное базовое действие.");
  if (scene.pendingActionPlan && (request.planId !== scene.pendingActionPlan.id || request.actorId !== scene.pendingActionPlan.actorId || request.actionId !== scene.pendingActionPlan.actionId)) errors.push("Действие не совпадает с сохранённым составным планом.");
  let available = actor && declaredAction ? availableActions(scene, data, actor.id).find(item => item.id === declaredAction.id) : null;
  if (actor && declaredAction && !available) errors.push("Это базовое действие недоступно этому типу участника.");
  const planStatus = actor && declaredAction ? cunningPlanStatus(scene, data, actor.id, declaredAction.id) : null;
  if (request.useCunningPlan) {
    if (!planStatus?.available) errors.push(planStatus?.reason || "Хитрый план сейчас недоступен.");
    else if (available?.reason && !/^(Это действие уже использовано|Недостаточно:)/.test(available.reason)) errors.push(available.reason);
    else {
      const discounted = { amount: planStatus.discountedCost, resource: actionCost(declaredAction).resource };
      available = { ...available, available: true, reason: "", quick: true, continuation: false, costModel: discounted, quickSource: { techniqueId: "vagabond.cunning-fighter", level: 1, name: "План и исполнение", needsConfirmation: false } };
    }
  }
  if (actor && declaredAction?.name === "Изучение" && Number(actor.techniques?.["vagabond.dim-mak"] || 0) >= 1 && request.targetIds?.length === 1) {
    const studies = currentTurnEvents(scene, actor.id).filter(event => event.type === "action.prepare" && event.actorId === actor.id && actionIdIs(event.payload?.actionId, "study"));
    const sameTarget = studies.some(event => (event.payload?.targetIds || []).includes(request.targetIds[0])), thirdStudy = studies.length === 2;
    if (sameTarget || thirdStudy) {
      const free = thirdStudy, blockingReason = available?.reason || "";
      if (!blockingReason || /^Это действие уже использовано/.test(blockingReason) || free && /^Недостаточно:/.test(blockingReason)) {
        available = { ...available, available: true, reason: "", quick: true, continuation: false, costModel: free ? { amount: 0, resource: null } : actorActionCost(actor, declaredAction), quickSource: { techniqueId: "vagabond.dim-mak", level: 1, name: free ? "Третье Изучение" : "Изучить слабость", needsConfirmation: false } };
      }
    }
  }
  const selectedAttackOrigin = request.armamentMode === "blade" && request.armamentDestination
    ? { space: actor?.space, x: Number(request.armamentDestination.x), y: Number(request.armamentDestination.y) }
    : actor;
  const selectedDimMakMarker = actor && declaredAction && actionIsAny(declaredAction, ["skirmish", "spell", "finish"])
    ? (scene.markers || []).find(marker =>
        (request.attackModifierIds || []).includes(`vagabond.dim-mak.1:${marker.id}`)
        && marker.ruleId === "vagabond.dim-mak.1"
        && marker.ownerActorId === actor.id
        && marker.metadata?.carrierActorId === request.targetIds?.[0]
        && marker.space === selectedAttackOrigin.space
        && Number(marker.x) === Number(selectedAttackOrigin.x)
        && Number(marker.y) === Number(selectedAttackOrigin.y))
    : null;
  if (selectedDimMakMarker && available && /^(Это действие уже использовано|Недостаточно:)/.test(available.reason || "")) {
    available = { ...available, available: true, reason: "", quick: true, continuation: false, costModel: { amount: 0, resource: null }, quickSource: { techniqueId: "vagabond.dim-mak", level: 1, name: "Слабая точка", needsConfirmation: false } };
  }
  const armamentMode = declaredAction?.name === "Стычка" && Number(actor?.techniques?.["vagabond.master-at-arms"] || 0) >= 1 && request.armamentMode ? String(request.armamentMode) : null;
  const armament = armamentMode ? masterAtArmsStatus(scene, actor.id, { modeId: armamentMode, targetIds: request.targetIds || [], destination: request.armamentDestination || request.destination }) : null;
  const armamentChoices = declaredAction?.name === "Стычка" && Number(actor?.techniques?.["vagabond.master-at-arms"] || 0) >= 1 && !armamentMode ? masterAtArmsStatus(scene, actor.id, { targetIds: request.targetIds || [], requireDestination: false }).options.filter(option => option.available) : [];
  if (armamentChoices.length) errors.push(`Условие Вооружения выполнено: выберите ${armamentChoices.map(option => option.label).join(" или ")}.`);
  if (armamentMode && !armament.available) errors.push(armament.reason);
  if (armament?.available && available && (available.available || /^(Это действие уже использовано|Недостаточно:)/.test(available.reason || ""))) available = { ...available, available: true, reason: "", quick: true, continuation: false, costModel: { amount: 0, resource: null }, quickSource: { techniqueId: "vagabond.master-at-arms", level: 1, name: armament.label, needsConfirmation: false } };
  if (available && !available.available) errors.push(available.reason);
  if (errors.length) return { ok: false, errors, events: [] };

  let targetIds = request.startRage ? [] : [...new Set(request.targetIds || [])];
  const requestedTargetCells = Array.isArray(request.targetCells) ? request.targetCells : [];
  let targetCells = [...new Set(requestedTargetCells)].filter(cell => typeof cell === "string");
  const occupiedCellTargetIds = actionIs(declaredAction, "skirmish") ? targetCells.flatMap(cell => {
    const [x, y] = cell.split(",").map(Number);
    return (scene.actors || []).filter(candidate => candidate.team !== actor.team && candidate.space === actor.space && Number(candidate.x) === x && Number(candidate.y) === y && effectPresenceStatus(scene, candidate.id).onField).map(candidate => candidate.id);
  }) : [];
  targetIds = [...new Set([...targetIds, ...occupiedCellTargetIds])];
  let targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
  const attack = candidate => actionIsAny(candidate, ["skirmish", "spell", "finish"]);
  const attackModifiers = attack(declaredAction) ? attackModifierStatus(scene, actor.id, targetIds, request.attackModifierIds || [], { actionId: declaredAction.id, origin: request.armamentMode === "blade" ? request.armamentDestination : null }) : { available: !(request.attackModifierIds || []).length, reason: "Модификаторы Атаки применимы только к Атакам.", selectedIds: [], advantage: 0, actionTransform: null };
  if (!attackModifiers.available) errors.push(attackModifiers.reason);
  if (attackModifiers.actionTransform) {
    action = actionByKey(data, attackModifiers.actionTransform.actionKey) || null;
    if (!action) errors.push("Действие-замена модификатора не найдено.");
    else {
      const transformedAvailable = availableActions(scene, data, actor.id).find(item => item.id === action.id);
      const transformedReason = transformedAvailable?.reason || "", planLock = request.planId && request.planId === scene.pendingActionPlan?.id && /^Сначала завершите составное действие/.test(transformedReason);
      if (!transformedAvailable?.available && !/^Недостаточно:/.test(transformedReason) && !planLock) errors.push(transformedReason || "Действие-замена сейчас недоступно.");
    }
  }
  const spellcrafterLevel = Number(actor.techniques?.["ruiner.spellcrafter"] || 0), spellModifiers = spellcrafterLevel && actionIsAny(action, ["spell", "finish"]) ? [...new Set(actor.techniqueState?.spellModifiers || [])] : [], modifierResource = spellcrafterLevel >= 2 ? "focus" : "innovationCharges";
  const learnedSpellModifiers = new Set(actor.techniqueState?.spellcrafterLearnedModifiers || []);
  if (errors.length) return { ok: false, errors, events: [] };
  const breacherSkirmish = actionIs(action, "skirmish") && Number(actor.techniques?.["powerhouse.breacher"] || 0) >= 1;
  const gunslingerSkirmish = actionIs(action, "skirmish") && Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 1;
  const bulletsSpent = gunslingerSkirmish ? Number(request.bulletsSpent ?? 1) : 0;
  const selectedTargetCount = targetIds.length + targetCells.length;
  const bulletAdvantage = gunslingerSkirmish ? Number(request.bulletAdvantage ?? Math.max(0, bulletsSpent - Math.max(1, selectedTargetCount))) : 0;
  const knifeThrow = actionIs(action, "skirmish") && Number(actor.techniques?.["vagabond.knife-juggler"] || 0) >= 1 && Boolean(request.throwWeapon);
  const meisterOverload = actionIsAny(action, ["skirmish", "finish"]) && Number(actor.techniques?.["vagabond.modified-meister"] || 0) >= 2 && Boolean(request.overload);
  const finisherFocus = actionIs(action, "finish") ? Number(request.focusSpent ?? request.roll?.finisherFocus ?? 0) : 0;
  const assassination = Boolean(request.planId && scene.pendingActionPlan?.id === request.planId && scene.pendingActionPlan.actorId === actor.id && scene.pendingActionPlan.actionId === declaredAction.id && scene.pendingActionPlan.context?.assassination?.ruleId === "vagabond.assassin.2" && Number(actor.techniques?.["vagabond.assassin"] || 0) >= 2 && attack(declaredAction));
  const mundaneLevel = Number(actor.techniques?.["bulwark.mundane"] || 0), actionAttribute = attackModifiers.attributeOverride || request.attribute || request.roll?.attribute || null;
  const ritualistCircle = actionIs(action, "finish") && actionAttribute === "spirit" && Number(actor.techniques?.["ruiner.ritualist"] || 0) >= 1 && (scene.markers || []).some(marker => marker.ownerActorId === actor.id && marker.kind === "ritual" && marker.duration === "scene" && /ritualist/.test(String(marker.ruleId || "")) && marker.space === actor.space && Number(marker.x) === Number(actor.x) && Number(marker.y) === Number(actor.y));
  const finisherFocusCap = Number(scene.tension || 0) + (ritualistCircle ? 2 : 0);
  const attackModifierDestination = attackModifiers.requiresDestination ? attackModifierDestinationStatus(scene, actor.id, targetIds, attackModifiers.selectedIds, request.attackModifierDestination, { actionId: declaredAction.id }) : null;
  if (attackModifierDestination && !attackModifierDestination.available) errors.push(attackModifierDestination.reason);
  const thunderDischarge = Boolean(request.useThunderDischarge) && actionIs(action, "finish") && actionAttribute === "spirit" && Number(actor.techniques?.["ruiner.thunder-blood"] || 0) >= 3 && clockStatus(scene, actor.id, "ruiner.thunder-blood.static").value >= 3;
  const eclipseStars = Boolean(request.useEclipseStars) && actionIs(action, "finish") && actionAttribute === "spirit" && Number(actor.techniques?.["ruiner.void-soul"] || 0) >= 3 && clockStatus(scene, actor.id, "ruiner.void-soul.void").full;
  const revelationClock = clockStatus(scene, actor.id, "ruiner.zealot.revelation"), zealotCells = [...new Set(request.zealotCells || [])], zealotRupture = Boolean(request.useZealotRupture) && actionIs(action, "finish") && actionAttribute === "spirit" && Number(actor.techniques?.["ruiner.zealot"] || 0) >= 3 && revelationClock.full && zealotCells.length > 0;
  const rageForGrasp = clockStatus(scene, actor.id, "ruiner.feral-arcana.rage"), grasp = Boolean(request.useGrasp) && actionIs(action, "finish") && actionAttribute === "body" && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 3 && rageForGrasp.active && rageForGrasp.value > 0;
  let graspPath = [];
  if (request.useGrasp && !grasp) errors.push("Хватка требует Завершение Телом и непустую Ярость.");
  if (grasp) {
    const graspDistance = effectMovementStatus(scene, actor.id, { distance: 3 }).distance;
    graspPath = request.destination ? movementPath(scene, actor.id, request.destination, { maxDistance: graspDistance }) : [];
    if (!request.destination || !graspPath.length && (Number(request.destination?.x) !== Number(actor.x) || Number(request.destination?.y) !== Number(actor.y))) errors.push(`Для Хватки выберите достижимую свободную клетку в пределах ${graspDistance}.`);
  }
  if (request.useThunderDischarge && !thunderDischarge) errors.push("Для Разрядки нужно Завершение Духом и минимум 3 Статики.");
  if (request.useEclipseStars && !eclipseStars) errors.push("Для Затмения звезд нужно Завершение Духом и полная Пустота.");
  if (request.useZealotRupture && !zealotRupture) errors.push("Для «Так не должно было быть» нужны Завершение Духом, полное Озарение и две проверенные Линии.");
  if ([thunderDischarge, eclipseStars, zealotRupture].filter(Boolean).length > 1) errors.push("Одно Завершение не может одновременно использовать две зональные формы.");
  if (thunderDischarge) {
    targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.id !== actor.id && target.space === actor.space && Math.abs(Number(target.x) - Number(actor.x)) <= 1 && Math.abs(Number(target.y) - Number(actor.y)) <= 1).map(target => target.id);
    targets = targetIds.map(id => actorById(scene, id));
  } else if (eclipseStars) {
    const space = (scene.spaces || []).find(item => item.id === actor.space), centerX = Math.floor((Number(space?.width || 1) - 1) / 2), centerY = Math.floor((Number(space?.height || 1) - 1) / 2);
    targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && target.space === actor.space && Math.abs(Number(target.x) - centerX) <= 2 && Math.abs(Number(target.y) - centerY) <= 2).map(target => target.id);
    targets = targetIds.map(id => actorById(scene, id));
  } else if (zealotRupture) {
    const selectedCells = new Set(zealotCells);
    targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.space === actor.space && selectedCells.has(cellKey(target))).map(target => target.id);
    targets = targetIds.map(id => actorById(scene, id));
  }
  const heavenlyLevel = Number(actor.techniques?.["altruist.heavenly-saint"] || 0), heavenlyHealing = !zealotRupture && (actionIs(action, "spell") && heavenlyLevel >= 2 || actionIs(action, "finish") && heavenlyLevel >= 3 && actionAttribute === "spirit");
  const caughtByConstrictor = target => Number(actor.techniques?.["disruptor.constrictor"] || 0) >= 1 && effectStateFor(target, "negative.пойман")?.sources.some(source => source.actorId === actor.id);
  const startRage = actionIs(action, "interact") && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 2 && Boolean(request.startRage);
  const revelationEligible = actionIsAny(action, ["charge", "spell"]) || actionIs(action, "finish") && actionAttribute === "spirit";
  const useRevelation = Boolean(request.useRevelation) && Number(actor.techniques?.["ruiner.zealot"] || 0) >= 1 && revelationEligible;
  if (request.useRevelation && !revelationEligible) errors.push("Озарение изменяет только Зарядку, Заклинание или Завершение Духом.");
  if (useRevelation && clockStatus(scene, actor.id, "ruiner.zealot.revelation").value < 1) errors.push("Для Еретической преданности нужен сегмент Озарения.");
  if (useRevelation && request.roll) {
    const originalSuccesses = Number(request.roll.successes || 0);
    request.roll = { ...clone(request.roll), originalSuccesses, successes: Math.max(0, (Number(actor.attrs?.spirit || 0) + Number(actor.tier || 1)) * 2 - originalSuccesses), revelation: true };
  }
  if (startRage && targetIds.length) errors.push("«Сорваться с цепи» заменяет только Взаимодействие без цели.");
  if (attack(action) && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 1 && Number(actor.creationMarks || 0) > 0) errors.push("С Метками творения выберите соответствующую форму Атаки в разделе Техники: все Метки должны быть потрачены.");
  if (targets.length !== targetIds.length) errors.push("Одна из выбранных целей больше не находится на Сцене.");
  if (targets.some(target => target.knockedOut)) errors.push("Выведенный из боя персонаж не может быть целью действия.");
  if (spellModifiers.length > (spellcrafterLevel >= 3 ? 2 : 1)) errors.push("Этот Уровень Творца заклинаний не позволяет столько Модификаций.");
  if (spellModifiers.some(mod => !learnedSpellModifiers.has(mod))) errors.push("Можно применить только Модификации, изученные при получении Уровней Творца заклинаний.");
  if (spellModifiers.length && Number(actor[modifierResource] || 0) < spellModifiers.length) errors.push(`Недостаточно ресурса для ${spellModifiers.length} Модификаций.`);
  if (gunslingerSkirmish && (!Number.isInteger(bulletsSpent) || bulletsSpent < 1 || !Number.isInteger(bulletAdvantage) || bulletAdvantage < 0)) errors.push("Укажите целое число потраченных Пуль и Пуль на Преимущество.");
  if (gunslingerSkirmish && bulletAdvantage + Math.max(0, selectedTargetCount - 1) > bulletsSpent - 1) errors.push("Дополнительных Пуль не хватает одновременно на выбранные цели и Преимущество.");
  if (gunslingerSkirmish && !ruleResourceStatus(scene, actor.id, { resource: "bullets", amount: bulletsSpent }).available) errors.push("Недостаточно Пуль для Стычки.");
  if (gunslingerSkirmish && targetCells.length) errors.push("«Большой ствол» выбирает персонажей, а не пустые клетки.");
  if (knifeThrow && !ruleResourceStatus(scene, actor.id, { resource: "weapons", amount: 1 }).available) errors.push("Для Метания нужно 1 Оружие.");
  if (knifeThrow && (targetIds.length !== 1 || targetCells.length)) errors.push("Метание выбирает ровно одного персонажа.");
  if (meisterOverload && !Array.isArray(request.roll?.rolls)) errors.push("Для Перегрузки нужен зафиксированный бросок Атаки.");
  if (!Number.isInteger(finisherFocus) || finisherFocus < 0 || finisherFocus > finisherFocusCap || finisherFocus > Number(actor.focus || 0)) errors.push(`Фокус Завершения должен быть целым числом от 0 до ${finisherFocusCap} и не больше доступного Фокуса.`);
  if (mundaneLevel >= 1 && actionIs(action, "spell")) errors.push("Обычный не может использовать Заклинание.");
  if (mundaneLevel >= 1 && actionIs(action, "finish") && actionAttribute === "spirit") errors.push("Обычный не может использовать Завершение Духом.");
  const modifierQuick = Boolean(attackModifiers.quick), armamentQuick = Boolean(armament?.available);
  const quickSource = armamentQuick ? { techniqueId: "vagabond.master-at-arms", level: 1, name: armament.label, needsConfirmation: false } : modifierQuick ? { techniqueId: "vagabond.dim-mak", level: 1, name: "Слабая точка", needsConfirmation: false } : available?.quickSource;
  const events = [{ type: "action.prepare", actorId: actor.id, payload: { actionInstanceId, actionId: action.id, actionName: action.name, name: action.name, declaredActionId: declaredAction.id, declaredActionName: declaredAction.name, targetIds, targetCells, planId: request.planId || null, attackModifierIds: attackModifiers.selectedIds, attackModifierAdvantage: attackModifiers.advantage, actionTransform: attackModifiers.actionTransform, quick: Boolean(available?.quick || modifierQuick || armamentQuick), quickSource: quickSource ? { techniqueId: quickSource.techniqueId, level: quickSource.level, name: quickSource.name, needsConfirmation: quickSource.needsConfirmation } : null, continuation: Boolean(available?.continuation && !modifierQuick && !armamentQuick) } }];
  events[0].payload.request = { attribute: actionAttribute, focusSpent: finisherFocus, targetCells, useCunningPlan: Boolean(request.useCunningPlan), useRevelation: Boolean(request.useRevelation), useThunderDischarge: Boolean(request.useThunderDischarge), useEclipseStars: Boolean(request.useEclipseStars), useGrasp: Boolean(request.useGrasp), startRage: Boolean(request.startRage), armamentMode, armamentDestination: armament?.destination || null, bulletsSpent: Number.isFinite(Number(request.bulletsSpent)) ? Number(request.bulletsSpent) : null, bulletAdvantage: Number.isFinite(Number(request.bulletAdvantage)) ? Number(request.bulletAdvantage) : null, throwWeapon: Boolean(request.throwWeapon), overload: Boolean(request.overload), provokeTargetIds: [...new Set(request.provokeTargetIds || [])].slice(0, 40), removeEffectIdsByTarget: clone(request.removeEffectIdsByTarget || {}), attackModifierIds: attackModifiers.selectedIds };
  if (armamentQuick) {
    events[0].payload.armament = { groupId: MASTER_AT_ARMS_GROUP, modeId: armamentMode, label: armament.label };
    events.push({ type: "rule-mode.set", actorId: actor.id, payload: { groupId: MASTER_AT_ARMS_GROUP, modeId: armamentMode, ruleId: "vagabond.master-at-arms.1", participantIds: [actor.id, ...targetIds] } });
  }
  if(request.roll&&Number(actor.ruleState?.empathSupport||0)>0)events.push({type:"actor.state",actorId:actor.id,payload:{key:"empathSupport",value:0,sourceActionId:"altruist.empath.3",reason:"Поддержка применена к следующему броску"}});
  if (request.useCunningPlan) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "vagabond.cunning-fighter.plan", delta: -1, sourceActionId: "vagabond.cunning-fighter.1.plan", reason: "План и исполнение" } });
  if (useRevelation) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "ruiner.zealot.revelation", delta: -1, sourceActionId: "ruiner.zealot.1", reason: "Изменение итоговых Успехов" } });
  if (grasp) {
    events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: rageForGrasp.id, value: 0, active: false, sourceActionId: "ruiner.feral-arcana.3", reason: "Хватка тратит всю Ярость" } });
    if (request.destination && (Number(request.destination.x) !== Number(actor.x) || Number(request.destination.y) !== Number(actor.y))) {
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y, movement: "Хватка", path: graspPath.map(cellKey), participantIds: [actor.id, ...targetIds] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y, movement: "Хватка" } });
    }
  }
  if (startRage) {
    const adjacentEnemies = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && distance(actor, target) <= 1).length;
    events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: "ruiner.feral-arcana.rage", value: Math.min(6, adjacentEnemies + Number(scene.tension || 0)), active: true, sourceActionId: "ruiner.feral-arcana.2", reason: "Сорваться с цепи" } });
  }
  const cost = knifeThrow || modifierQuick || armamentQuick ? { resource: null, amount: 0 } : available?.costModel || actorActionCost(actor, declaredAction);
  if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });
  if (finisherFocus) events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "focus", amount: finisherFocus, sourceActionId: action.id, reason: "Преимущество Завершения", participantIds: [actor.id, ...targetIds] } });
  if (gunslingerSkirmish) {
    events[0].payload.ruleResource = { resource: "bullets", spent: bulletsSpent, advantage: bulletAdvantage, additionalTargets: Math.max(0, selectedTargetCount - 1), passiveAdvantage: Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 2 ? 1 : 0, ruleId: "powerhouse.gunslinger.1" };
    events.push({ type: "rule-resource.spend", actorId: actor.id, payload: { resource: "bullets", amount: bulletsSpent, sourceActionId: "powerhouse.gunslinger.1", participantIds: [actor.id, ...targetIds] } });
  }
  if (knifeThrow) {
    events[0].payload.ruleResource = { resource: "weapons", spent: 1, thrown: true, passiveAdvantage: Number(actor.techniques?.["vagabond.knife-juggler"] || 0) >= 2 ? 1 : 0, ruleId: "vagabond.knife-juggler.1" };
    events.push({ type: "rule-resource.spend", actorId: actor.id, payload: { resource: "weapons", amount: 1, sourceActionId: "vagabond.knife-juggler.1", participantIds: [actor.id, ...targetIds] } });
  }
  if (meisterOverload) events[0].payload.overload = { advantage: Math.floor(Number(actor.attrs?.mind || 0) / 2), failedDice: request.roll.rolls.filter(value => Number(value) < 4).length, ruleId: "vagabond.modified-meister.2" };
  if (spellModifiers.length) {
    events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: modifierResource, amount: spellModifiers.length, sourceActionId: "ruiner.spellcrafter" } });
    events.push({ type: "technique.state", actorId: actor.id, payload: { key: "spellModifiers", value: [], ruleId: "ruiner.spellcrafter", name: "Модификации применены" } });
    events[0].payload.spellModifiers = spellModifiers;
  }

  if (actionIsAny(action, ["step", "jump"])) {
    const destination = request.destination;
    const space = (scene.spaces || []).find(item => item.id === actor.space);
    const baseMovement = actionIs(action, "jump") ? Number(actor.attrs?.talent || 0) : actor.speedZeroUntilTurnEnd ? 0 : available?.continuation ? Number(actor.stepRemaining || 0) : effectiveActorSpeed(scene, actor.id), modifiedMovement = baseMovement * Math.max(1, Number(request.movementMultiplier || 1)), moveLimit = effectMovementStatus(scene, actor.id, { distance: modifiedMovement }).distance;
    if (!destination || !space || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Выберите свободную клетку назначения.");
    else if (!effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка назначения занята.");
    else {
      let path = movementPath(scene, actor.id, destination, { maxDistance: moveLimit, straight: actionIs(action, "jump"), ignoreEnemies: actionIs(action, "jump"), ignoreDifficult: actionIs(action, "jump") });
      if (!path.length) errors.push(actionIs(action, "jump") ? `Прыжок должен идти по свободной прямой Линии длиной до ${moveLimit}.` : `До этой клетки нет свободного пути в пределах Скорости ${moveLimit}.`);
      else {
        const trapCell = path.find(point => (scene.markers || []).some(marker => marker.kind === "trap" && /disruptor\.hunter\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`) && marker.space === actor.space && marker.x === point.x && marker.y === point.y && Number(actorById(scene, marker.ownerActorId)?.techniques?.["disruptor.hunter"] || 0) >= 1 && actorById(scene, marker.ownerActorId)?.team !== actor.team));
        if (trapCell) path = path.slice(0, path.indexOf(trapCell) + 1);
        const resolvedDestination = path.at(-1);
        if (actionIs(action, "step")) {
          const difficult = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "difficult").flatMap(object => object.cells || []));
          events[0].payload.stepRemaining = trapCell || difficult.has(cellKey(resolvedDestination)) ? 0 : Math.max(0, moveLimit - path.length);
        }
        events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: resolvedDestination.x, y: resolvedDestination.y, movement: action.name, sourceActionId: action.id, path: path.map(cellKey), topologyCrossings: path.filter(point => point.teleported).map(point => ({ destination: cellKey(point), cutIds: point.crossedCutIds || [] })), interruptedByTrap: Boolean(trapCell) } });
        events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: resolvedDestination.x, y: resolvedDestination.y, movement: action.name, ignoreDifficult: actionIs(action, "jump") } });
      }
    }
  } else if (attack(action)) {
  const limit = (armamentMode === "chain" || gunslingerSkirmish || knifeThrow || breacherSkirmish ? 4 : actionIs(action, "spell") ? 5 : 1) + (spellModifiers.includes("outstanding") ? Number(actor.attrs?.mind || 0) : 0);
    const disappeared = hasEffect(scene, actor, "positive.исчез");
    if (disappeared && Number(actor.techniques?.["vagabond.assassin"] || 0) >= 2 && !assassination) errors.push("Атака из Исчезновения Ассасина требует авторитетный составной план Ликвидации.");
    let attackOrigin = grasp && request.destination ? { ...actor, x: request.destination.x, y: request.destination.y } : actor;
    if (armamentMode === "blade" && armament?.available) {
      attackOrigin = { ...actor, x: armament.destination.x, y: armament.destination.y };
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: attackOrigin.x, y: attackOrigin.y, movement: "Клинок · Многогранность", path: armament.path.map(cellKey), participantIds: [actor.id, ...targetIds] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: attackOrigin.x, y: attackOrigin.y, movement: "Клинок · Многогранность" } });
    }
    if (attackModifierDestination?.available) {
      attackOrigin = { ...actor, x: attackModifierDestination.destination.x, y: attackModifierDestination.destination.y };
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: attackOrigin.x, y: attackOrigin.y, movement: "Телепортация · Перелом позвоночника", placement: true, sourceActionId: "bulwark.grappler.2", participantIds: [actor.id, ...targetIds] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: attackOrigin.x, y: attackOrigin.y, movement: "Телепортация · Перелом позвоночника", sourceActionId: "bulwark.grappler.2" } });
    }
    if (disappeared) {
      const destination = request.destination, space = (scene.spaces || []).find(item => item.id === actor.space);
      if (!destination || !space || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("При выходе из Исчезновения выберите клетку появления.");
      else if (removedCellKeys(scene, actor.space).has(`${destination.x},${destination.y}`) || !effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка появления занята или удалена.");
      else if (!assassination && (scene.actors || []).some(item => item.id !== actor.id && effectPresenceStatus(scene, item.id).onField && item.space === actor.space && distance(item, { ...destination, space: actor.space }) <= 1)) errors.push("При появлении клетка не должна быть смежна с персонажем.");
      else {
        attackOrigin = { ...actor, x: destination.x, y: destination.y };
        events.splice(1, 0, { type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: assassination ? "Ликвидация" : "Появление", placement: true, participantIds: [actor.id, ...targetIds] } });
        events.splice(2, 0, { type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Появление" } });
      }
    }
    const space = (scene.spaces || []).find(item => item.id === actor.space), targetCellPoints = targetCells.map(cell => { const [x, y] = cell.split(",").map(Number); return { cell, space: actor.space, x, y }; });
    const invalidTargetCell = targetCellPoints.find(point => !space || !/^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/.test(point.cell) || !Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x >= Number(space.width) || point.y >= Number(space.height) || removedCellKeys(scene, actor.space).has(point.cell));
    const cellLimit = limit + (actionIs(action, "skirmish") && !targetIds.length && Number(actor.techniques?.["disruptor.hunter"] || 0) >= 2 ? 3 : 0), distantTargetCell = targetCellPoints.find(point => distance(attackOrigin, point) > cellLimit), blockedTargetCell = targetCellPoints.find(point => !wallTargetingStatus(scene, attackOrigin, point, { range: cellLimit }).available);
    if (targetCells.length && !actionIs(action, "skirmish")) errors.push("Пустую клетку можно выбрать целью только для Стычки.");
    if (requestedTargetCells.length > 40) errors.push("Можно передать не больше 40 клеток-целей.");
    if (invalidTargetCell) errors.push("Одна из выбранных клеток находится вне доступного поля.");
    if (distantTargetCell) errors.push(`Пустая клетка должна быть в пределах ${cellLimit} клеток.`);
    if (blockedTargetCell) errors.push("Стена перекрывает проведение цели к выбранной клетке.");
    if (!targets.length && !targetCells.length && !zealotRupture) errors.push("Выберите цель атаки.");
    const unavailableEffectTarget = targets.find(target => !effectTargetingStatus(scene, actor.id, target.id, { sourceReappearing: disappeared }).available);
    if (unavailableEffectTarget) errors.push(effectTargetingStatus(scene, actor.id, unavailableEffectTarget.id, { sourceReappearing: disappeared }).reason);
    const unavailableWallTarget = targets.find(target => !wallTargetingStatus(scene, attackOrigin, target, { range: limit }).available);
    if (unavailableWallTarget) errors.push("Стена перекрывает проведение цели.");
    if (heavenlyHealing ? targets.some(target => target.team !== actor.team || target.id === actor.id) : !thunderDischarge && !zealotRupture && targets.some(target => target.team === actor.team)) errors.push(heavenlyHealing ? "Очищающий свет выбирает союзника, но не самого исполнителя." : "Базовая Атака может выбирать целью только противника.");
    const occupiedSelectedCells = new Set(targetCellPoints.filter(point => targets.some(target => target.space === point.space && Number(target.x) === point.x && Number(target.y) === point.y)).map(point => point.cell));
    if (actionIs(action, "skirmish") && !gunslingerSkirmish && !knifeThrow && targets.length + targetCells.filter(cell => !occupiedSelectedCells.has(cell)).length > 2) errors.push("Стычка выбирает не больше 2 целей или клеток суммарно.");
    if (!actionIs(action, "skirmish") && targets.length > 1 && !thunderDischarge && !eclipseStars && !zealotRupture) errors.push(`${action.name} выбирает только одну цель.`);
    const constrictorReach = target => actionIs(action, "finish") && Number(actor.techniques?.["disruptor.constrictor"] || 0) >= 2 && ["body", "talent"].includes(actionAttribute) && caughtByConstrictor(target);
    if (!thunderDischarge && !eclipseStars && !zealotRupture && targets.some(target => distance(attackOrigin, target) > limit && !constrictorReach(target))) errors.push(`Цель должна быть в пределах ${limit} клеток от клетки появления.`);
    const drainLifeArmed = Boolean(actor.ruleState?.drainLife && actor.ruleState?.grimTransformed);
    if (drainLifeArmed && actionIs(action, "finish") && actionAttribute !== "spirit") errors.push("«Вытянуть жизнь» применяется только к Завершению Духом.");
    const bonus = (actionIs(action, "finish") ? Number(scene.tension || 0) : 0) + (spellModifiers.includes("fierce") ? Number(actor.attrs?.mind || 0) : 0), drainLife = Boolean(drainLifeArmed && actionIs(action, "finish") && actionAttribute === "spirit"), adjustedDamage = value => drainLife ? Math.ceil(Math.max(0, value) / 2) : Math.max(0, value);
    if (heavenlyHealing) {
      const removalMap = request.removeEffectIdsByTarget && typeof request.removeEffectIdsByTarget === "object" ? request.removeEffectIdsByTarget : {};
      targets.forEach(target => {
        events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: target.id, amount: Math.ceil(Number(request.roll?.successes || 0) / 2), sourceActionId: heavenlyLevel >= 3 && actionIs(action, "finish") ? "altruist.heavenly-saint.3" : "altruist.heavenly-saint.2", participantIds: [actor.id, target.id] } });
        [...new Set(removalMap[target.id] || [])].filter(effect => (target.effects || []).includes(effect)).forEach(effect => events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: "altruist.heavenly-saint.2", participantIds: [actor.id, target.id] } }));
        if (heavenlyLevel >= 3 && actionIs(action, "finish")) {
          events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "positive.регенерирует", sourceActionId: "altruist.heavenly-saint.3", participantIds: [actor.id, target.id] } });
          const woundUsed = (scene.log || []).some(event => event.type === "actor.wound" && event.actorId === actor.id && event.payload?.targetId === target.id && event.payload?.sourceActionId === "altruist.heavenly-saint.3");
          if (!woundUsed && Number(target.wounds || 0) > 0) events.push({ type: "actor.wound", actorId: actor.id, payload: { targetId: target.id, delta: -1, sourceActionId: "altruist.heavenly-saint.3", participantIds: [actor.id, target.id] } });
        }
      });
      events.push({ type: "action.resolve", actorId: actor.id, payload: { actionInstanceId, actionId: action.id, name: action.name, targetIds, heavenlyHealing: true } });
      if (request.roll?.rolls) events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    } else {
      targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: action.id } }));
      const icicleHalo = available?.quickSource?.id === "ruiner.cryomancer.2.icicle";
      const effectDamageDivisor = (drainLife ? 2 : 1) * (eclipseStars || icicleHalo ? 2 : 1);
      const areaDamage = value => eclipseStars || icicleHalo ? Math.ceil(adjustedDamage(value) / 2) : adjustedDamage(value);
      const effectAttack = effectAttackStatus(scene, actor.id, targetIds);
      const empathSupport = Math.max(0, Number(actor.ruleState?.empathSupport || 0)), rawHindrance = Number(effectAttack.hindrance || 0), assassinationManualAdvantage = Number(attackModifiers.advantage || 0) + finisherFocus + (gunslingerSkirmish ? bulletAdvantage + (Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 2 ? 1 : 0) : 0) + (actionIs(action, "skirmish") && Number(actor.techniques?.["vagabond.knife-juggler"] || 0) >= 2 ? 1 : 0) + (meisterOverload ? Math.floor(Number(actor.attrs?.mind || 0) / 2) : 0) + (grasp ? Number(scene.tension || 0) : 0) + (assassination ? Number(actor.tier || 1) : 0) + (empathSupport && !rawHindrance ? empathSupport : 0), assassinationManualHindrance = empathSupport ? 0 : rawHindrance;
      const effectDamageBase = Number(request.roll?.successes || 0) + bonus + Number(effectAttack.damageModifier || 0);
      const effectDamageBaseByTarget = Object.fromEntries(targets.map(target => [target.id, effectDamageBase + Number(effectAttack.damageByTarget?.[target.id] || 0) + (thunderDischarge && hasEffect(scene, target, "negative.ошеломлен") ? Number(actor.tier || 1) : 0) + (actionIs(action, "finish") && Number(actor.techniques?.["disruptor.constrictor"] || 0) >= 2 && hasEffect(scene, target, "negative.пойман") ? Number(actor.tier || 1) : 0)]));
      const postDisplacements = armamentMode === "polearm" ? targets.map(target => ({ targetId: target.id, mode: "push", maximum: 3, name: "Древко", ruleId: "vagabond.master-at-arms.1", collisionDamagePerCell: 0 })) : breacherSkirmish ? targets.filter(target => distance(attackOrigin, target) <= 2).map(target => ({ targetId: target.id, mode: "push", maximum: 1, name: "Картечь", ruleId: "powerhouse.breacher.1", collisionDamagePerCell: 0, requiresSuccess: true })) : [];
      const dragonslayerTear = actionIs(action, "finish") && actionAttribute === "body" && Number(actor.techniques?.["powerhouse.dragonslayer"] || 0) >= 1 ? ["negative.разорван"] : [];
      const postSelfEffects = armamentMode === "blade" ? ["positive.усилен"] : [], postTargetEffects = armamentMode === "polearm" ? ["negative.подброшен", "negative.замедлен"] : armamentMode === "chain" ? ["negative.разорван", "negative.порчен"] : [];
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, declaredActionId: declaredAction.id, declaredActionName: declaredAction.name, name: armamentQuick ? `Стычка · ${armament.label}` : assassination ? "Ликвидация" : thunderDischarge ? "Разрядка" : eclipseStars ? "Затмить звезды" : zealotRupture ? "Так не должно было быть" : icicleHalo ? "Ледяной нимб" : action.name, attribute: actionAttribute, targetIds, targetCells, allowEmptyTargets: zealotRupture || targetCells.length > 0, roll: clone(request.roll || null), damage: areaDamage(effectDamageBase), damageByTarget: Object.fromEntries(Object.entries(effectDamageBaseByTarget).map(([targetId, value]) => [targetId, areaDamage(value)])), effectDamageBase, effectDamageBaseByTarget, effectDamageDivisor, attackModifierIds: attackModifiers.selectedIds, attackModifierAdvantage: attackModifiers.advantage, attackModifierDestination: attackModifierDestination?.destination || null, actionTransform: attackModifiers.actionTransform, techniqueRuleId: armamentQuick ? "vagabond.master-at-arms.1" : assassination ? "vagabond.assassin.2" : null, assassination, expectedManualAdvantage: assassination ? assassinationManualAdvantage : null, expectedManualHindrance: assassination ? assassinationManualHindrance : null, finisherFocus, armamentMode, successEffects: dragonslayerTear, postSelfEffects, postTargetEffects, thunderDischarge, eclipseStars, zealotRupture, zealotCells, icicleHalo, drainLife, postDisplacements, gunslingerBulletJuggle: gunslingerSkirmish && Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 3 && bulletsSpent >= 3 && targetIds.length === 1 && !targetCells.length, knifeThrow: knifeThrow && Number(actor.techniques?.["vagabond.knife-juggler"] || 0) >= 2, overload: meisterOverload ? clone(events[0].payload.overload) : null } });
      if (request.roll?.rolls) events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    }
  } else if (actionIs(action, "breathe")) {
    events.push({ type: "resource.gain", actorId: actor.id, payload: { actionInstanceId, resource: "focus", amount: 1, sourceActionName: "Передышка", sourceActionId: action.id } });
  } else if (actionIs(action, "charge") && request.roll) {
    events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: Math.max(2, Number(request.roll.successes || 0)), sourceActionName: "Зарядка", sourceActionId: action.id } });
  } else if (actionIs(action, "disappear")) {
    const atEdge = actor.x === 0 || actor.y === 0 || actor.x === Number((scene.spaces || []).find(item => item.id === actor.space)?.width || 0) - 1 || actor.y === Number((scene.spaces || []).find(item => item.id === actor.space)?.height || 0) - 1;
    const currentTurnEvents = [];
    for (const event of scene.log || []) {
      if (event.type === "turn.start" && event.actorId === actor.id) break;
      currentTurnEvents.push(event);
    }
    const attacked = currentTurnEvents.some(event => event.actorId === actor.id && (event.type === "attack.pending" || event.type === "action.prepare" && ["skirmish", "spell", "finish"].some(key => actionIdIs(event.payload?.actionId, key))));
    if (!available?.quickSource?.ignoreRequirements && !atEdge) errors.push("Скрыться можно только на краю поля.");
    if (!available?.quickSource?.ignoreRequirements && attacked) errors.push("Нельзя Скрыться после Атаки в этом Ходу.");
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: action.id, participantIds: [actor.id] } });
  } else if (actionIs(action, "study")) {
    if (targets.length !== 1) errors.push("Изучение выбирает одного врага.");
    if (targets.some(target => target.team === actor.team)) errors.push("Изучение выбирает врага.");
    if (targets.some(target => distance(actor, target) > Number(actor.attrs?.mind || 0))) errors.push(`Цель Изучения должна быть в пределах ${Number(actor.attrs?.mind || 0)} клеток.`);
    targets.forEach(target => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: effectIdByName(data, "Помечен"), sourceActionId: action.id } }));
    if (Number(actor.techniques?.["vagabond.cunning-fighter"] || 0) >= 1 && targets[0] && !(actor.techniqueState?.studiedActorIds || []).includes(targets[0].id)) events.push({ type: "technique.state", actorId: actor.id, payload: { key: "study", targetId: targets[0].id, ruleId: "vagabond.cunning-fighter.1.study", name: "Хитрый план" } });
  }
  if (mundaneLevel >= 3 && actionIsAny(action, ["breathe", "charge"])) {
    const provokeIds = [...new Set(request.provokeTargetIds || [])], wouldGain = actionIs(action, "breathe") ? 1 : Math.max(2, Number(request.roll?.successes || 0));
    const invalid = provokeIds.filter(id => { const target = actorById(scene, id); return !target || target.knockedOut || distance(actor, target) > 4; });
    if (provokeIds.length > wouldGain) errors.push(`Можно спровоцировать не больше ${wouldGain} персонажей.`);
    if (invalid.length) errors.push("Все цели «Перед лицом Запредельного» должны быть доступны в дальности 4.");
    provokeIds.forEach(targetId => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId, effect: "negative.спровоцирован", sourceActionId: "bulwark.mundane.3", participantIds: [actor.id, targetId] } }));
  }
  if (!attack(action)) events.push({ type: "action.resolve", actorId: actor.id, payload: { actionInstanceId, actionId: action.id, name: action.name, attribute: actionAttribute, text: action.text, targetIds, continuation: Boolean(available?.continuation) } });
  return { ok: errors.length === 0, errors, action: available, events: errors.length ? [] : events };
}

function techniqueComboStatus(scene, data, actorId, ruleId) {
  const rule = TECHNIQUE_COMBO_RULES.get(ruleId), actor = actorById(scene, actorId);
  let reason = "";
  if (!rule) reason = "Неизвестное автоматизированное комбо.";
  else if (!actor) reason = "Не выбран исполнитель комбо.";
  else if (Number(actor.techniques?.[rule.techniqueId] || 0) < rule.level) reason = `Для «${rule.name}» нужен ${rule.level}-й Уровень Техники.`;
  else if (actor.knockedOut) reason = "Выведенный из строя персонаж не может использовать комбо.";
  else if (scene.activeActorId !== actor.id) reason = "Комбо можно использовать только в Ход этого героя.";
  else if (scene.pendingAction) reason = "Сначала завершите текущую цепочку Реакций.";
  else if (Number(actor.comboCooldowns?.[ruleId] || 0) > 0) reason = `«${rule.name}» на перезарядке до конца следующего Хода.`;
  else {
    const lastAction = currentTurnEvents(scene, actor.id).find(event => event.actorId === actor.id && event.type === "action.prepare");
    const requiredAction = actionByKey(data, rule.requiresKey), comboAction = actionByKey(data, rule.actionKey);
    if (!actionIdIs(lastAction?.payload?.actionId, rule.requiresKey)) reason = `Сначала используйте «${requiredAction?.name || rule.requiresKey}» и не совершайте между ними других действий.`;
    else if (!comboAction) reason = `Базовое действие «${rule.actionKey}» не найдено.`;
  }
  return { available: !reason, reason, rule: rule ? clone(rule) : null };
}

function prepareTechniqueCombo(scene, data, request = {}) {
  const status = techniqueComboStatus(scene, data, request.actorId, request.ruleId), rule = status.rule, actor = actorById(scene, request.actorId), errors = status.available ? [] : [status.reason];
  const action = rule ? actionByKey(data, rule.actionKey) : null;
  if (errors.length) return { ok: false, errors, events: [], rule };

  const working = clone(scene), workingActor = actorById(working, actor.id), baseCost = actionCost(action);
  const requiredAction = actionByKey(data, rule.requiresKey);
  if (baseCost.resource === "ap") workingActor.ap = Number(workingActor.ap || 0) + Math.max(0, Number(baseCost.amount || 0) - Number(rule.apCost || 0));
  const priorAction = currentTurnEvents(scene, actor.id).find(event => event.actorId === actor.id && event.type === "action.prepare");
  const targetIds = [...new Set(request.targetIds || [])], roll = clone(request.roll || null);
  if (rule.sameTargets && JSON.stringify([...(priorAction?.payload?.targetIds || [])].sort()) !== JSON.stringify([...targetIds].sort())) errors.push(`«${rule.name}» должно выбрать те же цели, что и «${requiredAction?.name || rule.requiresKey}».`);
  const requestedAttribute = request.attribute || roll?.attribute || null;
  if (rule.attribute && requestedAttribute !== rule.attribute) errors.push(`«${rule.name}» использует Атрибут ${rule.attribute}.`);
  if (rule.attributes && !rule.attributes.includes(requestedAttribute)) errors.push(`«${rule.name}» использует один из Атрибутов: ${rule.attributes.join(", ")}.`);
  if (errors.length) return { ok: false, errors, events: [], rule };
  if (rule.allDiceSucceed && roll) {
    roll.successes = roll.rolls.length + Number(roll.crits || 0);
    roll.outcome = "Все кости считаются Успехами";
  }
  const prepared = prepareAction(working, data, { actorId: actor.id, actionId: action.id, targetIds, destination: request.destination, roll, attribute: requestedAttribute, movementMultiplier: rule.movementMultiplier, attackModifierIds: request.attackModifierIds || [] });
  if (!prepared.ok) return { ok: false, errors: prepared.errors, events: [], rule };

  const events = clone(prepared.events);
  const spendIndex = events.findIndex(event => event.type === "resource.spend" && event.actorId === actor.id && event.payload?.resource === "ap");
  if (spendIndex >= 0 && Number(rule.apCost || 0) > 0) events[spendIndex].payload.amount = Number(rule.apCost);
  else if (spendIndex >= 0) events.splice(spendIndex, 1);
  const actionPrepare = events.find(event => event.type === "action.prepare");
  if (actionPrepare) {
    actionPrepare.payload.name = rule.name;
    actionPrepare.payload.combo = { ruleId: request.ruleId, requiresActionId: requiredAction?.id || ACTION_IDS[rule.requiresKey], actionId: action.id };
  }
  const pending = events.find(event => event.type === "attack.pending");
  if (pending) {
    const bonusDamage = rule.bonusDamageAttribute ? Number(actor.attrs?.[rule.bonusDamageAttribute] || 0) : 0;
    pending.payload.damage = Number(pending.payload.damage || 0) + bonusDamage;
    if (pending.payload.damageByTarget) Object.keys(pending.payload.damageByTarget).forEach(targetId => { pending.payload.damageByTarget[targetId] = Number(pending.payload.damageByTarget[targetId] || 0) + bonusDamage; });
    const displacements = Number(rule.postPush || 0) > 0 ? targetIds.map(targetId => ({ targetId, mode: "push", maximum: Number(rule.postPush), name: rule.name, ruleId: request.ruleId, collisionDamagePerCell: 0 })) : [];
    Object.assign(pending.payload, { name: rule.name, techniqueRuleId: request.ruleId, techniqueName: rule.name, postDisplacements: [...(pending.payload.postDisplacements || []), ...displacements], postSelfEffects: (rule.postSelfEffects || []).map(name => effectIdByName(data, name)) });
  }
  events.unshift({ type: "technique.prepare", actorId: actor.id, payload: { ruleId: request.ruleId, name: rule.name, cooldownTurns: 2, comboActionIds: [requiredAction?.id || ACTION_IDS[rule.requiresKey], action.id] } });
  if (rule.selfEffect) {
    const resolvedIndex = events.findIndex(event => event.type === "action.resolve");
    const additions = [
      { type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: effectIdByName(data, rule.selfEffect), sourceActionId: request.ruleId } },
      { type: "technique.resolve", actorId: actor.id, payload: { ruleId: request.ruleId, name: rule.name, affectedActorIds: [actor.id] } },
    ];
    events.splice(resolvedIndex >= 0 ? resolvedIndex : events.length, 0, ...additions);
  }
  return { ok: true, errors: [], events, rule: { id: request.ruleId, ...clone(rule) } };
}

function availableEnemyRules(scene, data, actorId) {
  const actor = actorById(scene, actorId);
  const profile = actor ? enemyProfileById(data, actor.profileId) : null;
  if (!actor || !profile) return [];
  return (profile.rules || []).map(rule => {
    const family = ENEMY_ATTACK_FAMILY_RULES.get(rule.id) || {};
    const maxTargets = family.maxTargets || (ENEMY_TARGET_LIMITS.has(rule.id) ? ENEMY_TARGET_LIMITS.get(rule.id) : Number(rule.maxTargets || 0));
    const fullRule = ENEMY_FULL_RULES.get(rule.id), stateOnly = ["pugilist-stance", "martial-perfection", "imposing-presence"].includes(fullRule?.type);
    const automation = ENEMY_AUTO_ATTACK_RULES.has(rule.id) ? "attack" : fullRule ? stateOnly ? "state" : "full" : ENEMY_AUTO_EFFECT_RULES.has(rule.id) ? "effect" : "assisted";
    let reason = "";
    if (!(actor.kind === "enemy" || actor.profileId)) reason = "Это не профильный НПС";
    else if (actor.knockedOut) reason = "Профильный НПС выведен из строя";
    else if (scene.pendingAction) reason = "Сначала разрешите текущие Реакции";
    else if (!scene.activeActorId) reason = "Сначала начните Ход противника";
    else if (scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
    else if (actor.acted) reason = "Ход противника уже завершён";
    else if (Number(actor.ap || 0) < Number(rule.apCost || 1)) reason = `Нужно ${rule.apCost || 1} ОД`;
    else if ((actor.usedActions || []).includes(rule.id)) reason = "Это действие уже использовано в Раунде";
    else if (rule.kind === "trump" && actor.usedTrump) reason = "Козырь уже использован в этой Сцене";
    else if (rule.kind === "trump" && Number(scene.tension || 0) < Number(rule.tension || 0)) reason = `Нужно Напряжение ${rule.tension}`;
    else if (rule.id === "enemy.common.cannoneer.trump.fire" && !clockStatus(scene, actor.id, "enemy.common.cannoneer.preparation").full) reason = "Сначала заполните Подготовку 4/4";
    const roninSheathed = rule.id === "enemy.common.ronin.attack.dissect" && actor.ruleState?.roninSheathed;
    return { ...clone(rule), ...family, ...(roninSheathed ? { adjacent: false, range: Number(actor.speed || 0) } : {}), maxTargets, automation, available: !reason, reason };
  });
}

function enemyRuleAutomation(ruleId) {
  const fullRule = ENEMY_FULL_RULES.get(ruleId);
  if (ENEMY_AUTO_ATTACK_RULES.has(ruleId)) return "attack";
  if (fullRule) return ["pugilist-stance", "martial-perfection", "imposing-presence"].includes(fullRule.type) ? "state" : "full";
  return ENEMY_AUTO_EFFECT_RULES.has(ruleId) ? "effect" : "assisted";
}

function prepareEnemyRule(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId);
  const profile = actor ? enemyProfileById(data, actor.profileId) : null;
  const sourceRule = profile?.rules?.find(item => item.id === request.ruleId);
  const available = actor && sourceRule ? availableEnemyRules(scene, data, actor.id).find(item => item.id === sourceRule.id) : null;
  let rule = sourceRule ? { ...sourceRule, ...(ENEMY_ATTACK_FAMILY_RULES.get(sourceRule.id) || {}) } : null;
  if (rule?.id === "enemy.common.ronin.attack.dissect" && actor?.ruleState?.roninSheathed) rule = { ...rule, adjacent: false, range: Number(actor.speed || 0) };
  const errors = [];
  if (!actor || !profile) errors.push("Не выбран профиль противника.");
  if (!rule) errors.push("Неизвестное действие противника.");
  if (available && !available.available) errors.push(available.reason);
  const fullRule = rule ? ENEMY_FULL_RULES.get(rule.id) : null, family = rule ? ENEMY_ATTACK_FAMILY_RULES.get(rule.id) || {} : {};
  const isAttackRule = Boolean(rule && (rule.kind === "attack" || family.attack));
  const crowdMovementReady = Boolean(actor?.ruleState?.enemyCrowdMovement?.ruleId === rule?.id && Number(actor.ruleState.enemyCrowdMovement.turnSerial) === Number(scene.turnSerial || 0));
  if (actor && rule && family.crowdAdvance && request.options?.beginCrowdMovement && !crowdMovementReady) {
    const crowdIds = (scene.actors || []).filter(item => item.kind === "crowd" && !item.knockedOut && item.team === actor.team && item.space === actor.space).map(item => item.id);
    return { ok: true, errors: [], events: [{ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${eventId()}-enemy-crowds`, kind: "enemy-crowd-move-select", sourceActorId: actor.id, controller: "narrator", title: `${rule.name}: движение массовки`, text: `По очереди переместите каждую союзную Зону массовки на расстояние до ${family.crowdAdvance} клетки или оставьте её на месте.`, options: [...crowdIds.map(id => `target:${id}`), "finish"], context: { ruleId: rule.id, remainingTargetIds: crowdIds, maxDistance: Number(family.crowdAdvance), optionLabels: { finish: "Закончить движение" } }, participantIds: [actor.id, ...crowdIds] } }], rule: available || clone(rule) };
  }
  if (actor && rule && family.crowdAdvance && !crowdMovementReady) errors.push("Сначала разрешите движение всех союзных Зон массовки.");
  let targetIds = [...new Set(request.targetIds || [])];
  if (rule?.id === "enemy.common.paladin.trump.weal-and-woe" && actor) targetIds = (scene.actors || []).filter(target => target.id !== actor.id && !target.knockedOut && target.space === actor.space && distance(actor, target) <= 2).map(target => target.id);
  if (fullRule?.type === "regenerating-allies" && actor) targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.team === actor.team && (target.effects || []).some(effect => String(effect).includes("регенер"))).map(target => target.id);
  if (fullRule?.type === "corrupted-damage" && actor) targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && (target.effects || []).some(effect => String(effect).includes("порчен"))).map(target => target.id);
  if (fullRule?.type === "guardian-shield" && actor) targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && target.space === actor.space && distance(actor, target) <= 4).map(target => target.id);
  if (fullRule?.type === "revenant-hollowed-eyes" && actor) {
    const enemies = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team);
    const lowest = Math.min(...enemies.map(target => Number(target.focus || 0)));
    const eligible = enemies.filter(target => Number(target.focus || 0) === lowest);
    targetIds = eligible.some(target => targetIds.includes(target.id)) ? [targetIds.find(id => eligible.some(target => target.id === id))] : eligible.slice(0, 1).map(target => target.id);
  }
  if (fullRule?.type === "healer-savior" && actor) targetIds = actor.ruleState?.healerGuardianId ? [actor.ruleState.healerGuardianId] : [];
  const targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
  const hiddenAssassinAttack = Boolean(family.hiddenAdvantage && (actor?.effects || []).includes("positive.исчез"));
  const assassinReappearance = hiddenAssassinAttack && request.options?.reappearance ? { x: Number(request.options.reappearance.x), y: Number(request.options.reappearance.y) } : null;
  const attackDestination = fullRule?.type !== "hound-seekers" && request.options?.destination && { x: Number(request.options.destination.x), y: Number(request.options.destination.y) };
  const attackOrigin = actor && (assassinReappearance || attackDestination) ? { ...actor, ...(assassinReappearance || attackDestination) } : actor;
  let attackMovePath = [];
  if (targets.length !== targetIds.length) errors.push("Одна из выбранных целей больше не находится на Сцене.");
  if (targets.some(target => target.knockedOut)) errors.push("Выведенный из боя персонаж не может быть целью действия.");
  const targetingOptions = fullRule?.type === "healer-heal" ? { ignoreHealerGuardian: true } : {};
  const unavailableEffectTarget = actor && !hiddenAssassinAttack && targets.find(target => !effectTargetingStatus(scene, actor.id, target.id, targetingOptions).available);
  if (unavailableEffectTarget) errors.push(effectTargetingStatus(scene, actor.id, unavailableEffectTarget.id, targetingOptions).reason);
  const unavailableWallTarget = attackOrigin && targets.find(target => !wallTargetingStatus(scene, attackOrigin, target, { range: rule?.range }).available);
  if (unavailableWallTarget) errors.push("Стена перекрывает проведение цели.");
  const space = actor && (scene.spaces || []).find(item => item.id === actor.space);
  if (hiddenAssassinAttack) {
    const target = targets[0], point = assassinReappearance;
    if (!point) errors.push("Выберите свободную клетку рядом с целью для появления Ассасина.");
    else if (!target || target.space !== actor.space || !Number.isInteger(point.x) || !Number.isInteger(point.y) || point.x < 0 || point.y < 0 || point.x >= Number(space?.width || 0) || point.y >= Number(space?.height || 0)) errors.push("Клетка появления Ассасина находится за пределами поля цели.");
    else if (distance({ ...actor, ...point }, target) > 1) errors.push("Ассасин должен появиться в клетке, смежной с целью.");
    else if (!effectCellOccupancyStatus(scene, actor.id, { actor, space: actor.space, x: point.x, y: point.y }).available || removedCellKeys(scene, actor.space).has(`${point.x},${point.y}`)) errors.push("Клетка появления Ассасина занята или недоступна.");
  }
  if (attackDestination && actor) {
    const maximum = Number(family.preMoveMaximum || 0), dx = Math.abs(attackDestination.x - actor.x), dy = Math.abs(attackDestination.y - actor.y);
    if (!Number.isInteger(attackDestination.x) || !Number.isInteger(attackDestination.y) || attackDestination.x < 0 || attackDestination.y < 0 || attackDestination.x >= Number(space?.width || 0) || attackDestination.y >= Number(space?.height || 0)) errors.push("Клетка перемещения Атаки находится за пределами поля.");
    else if (family.preMoveStraight && dx > 0 && dy > 0) errors.push("Это перемещение должно идти по прямой.");
    else if (family.teleportAttack) {
      if (distance(actor, attackOrigin) > maximum) errors.push(`Телепортация ограничена ${maximum} клетками.`);
      else if (!effectCellOccupancyStatus(scene, actor.id, { actor, space: actor.space, x: attackDestination.x, y: attackDestination.y }).available) errors.push("Клетка телепортации занята.");
    } else if (family.preMoveIgnoreRestrictions) {
      if (distance(actor, attackOrigin) > maximum) errors.push(`Перемещение ограничено ${maximum} клетками.`);
      else if (!effectCellOccupancyStatus(scene, actor.id, { actor, space: actor.space, x: attackDestination.x, y: attackDestination.y }).available) errors.push("Итоговая клетка занята.");
    } else {
      attackMovePath = movementPath(scene, actor.id, attackDestination, { maxDistance: maximum });
      if (!attackMovePath.length) errors.push(`До выбранной клетки нельзя добраться в пределах ${maximum}.`);
    }
  } else if (family.preMoveMaximum && !(family.oniModes && !(actor?.effects || []).includes("positive.усилен"))) errors.push("Укажите клетку перемещения перед Атакой.");
  const anchor = rule?.area?.length ? (rule.areaAnchor === "self" ? { x: actor?.x, y: actor?.y } : request.anchor) : null;
  const affectedCells = rule?.area?.length && space && Number.isInteger(Number(anchor?.x)) && Number.isInteger(Number(anchor?.y)) ? areaCells(space, anchor, rule.area) : [];
  if (rule?.area?.length && !affectedCells.length) errors.push("Укажите область действия на поле.");
  if (actor && rule?.areaAnchor !== "self" && rule?.range && anchor && Math.abs(actor.x - Number(anchor.x)) + Math.abs(actor.y - Number(anchor.y)) > Number(rule.range)) errors.push(`Область должна быть в пределах ${rule.range} клеток.`);
  if (actor && rule?.areaAnchor !== "self" && anchor && !wallTargetingStatus(scene, actor, { space: actor.space, x: Number(anchor.x), y: Number(anchor.y) }).available) errors.push("Стена перекрывает размещение области.");
  if (affectedCells.length && targets.some(target => target.space !== actor.space || !affectedCells.includes(`${target.x},${target.y}`))) errors.push("Все выбранные цели должны находиться в области.");
  if ((available?.requiresTarget ?? rule?.requiresTarget) && !targets.length && fullRule?.type !== "guardian-shield") errors.push(rule.kind === "attack" ? "Выберите хотя бы одну цель Атаки." : "Выберите цель действия.");
  if (fullRule?.type === "executioner-bifurcate" && (targets.length !== 1 || targets[0]?.team === actor?.team)) errors.push("Рассечение требует одного противника.");
  if (fullRule?.type === "revenant-hollowed-eyes" && targets.length !== 1) errors.push("Для Пустых глаз нужен игрок с наименьшим Фокусом.");
  if (fullRule?.type === "healer-heal" && (targets.length !== 1 || targets[0]?.team !== actor?.team || distance(actor, targets[0]) > 3)) errors.push("Лечение требует самого Целителя или одного союзника в пределах 3 клеток.");
  if (fullRule?.type === "healer-savior" && (targets.length !== 1 || targets[0]?.knockedOut || targets[0]?.id !== actor?.ruleState?.healerGuardianId)) errors.push("Для Спасителя сначала выберите доступного Стража в начале Хода Целителя.");
  const seekerCells = [];
  if (fullRule?.type === "hound-seekers" && actor && space) {
    const target = targets[0], destination = request.options?.destination;
    if (targets.length !== 1 || !target || target.team === actor.team || target.kind === "crowd") errors.push("Ищейке нужен один персонаж-противник.");
    else if (Number(fullRule.minimumTargetDistance || 0) && distance(actor, target) < Number(fullRule.minimumTargetDistance)) errors.push(`Цель Ищейки должна находиться на расстоянии не меньше ${fullRule.minimumTargetDistance} клеток.`);
    if (!destination || !Number.isInteger(Number(destination.x)) || !Number.isInteger(Number(destination.y)) || distance(actor, { ...destination, space: actor.space }) !== 1) errors.push("Выберите клетку, смежную с Псарем.");
    else {
      const occupiedCrowd = new Set((scene.actors || []).filter(item => item.kind === "crowd" && !item.knockedOut && item.space === actor.space).map(cellKey)), removed = removedCellKeys(scene, actor.space), candidates = [{ x: Number(destination.x), y: Number(destination.y) }, ...[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy]) => ({ x: Number(actor.x)+dx, y: Number(actor.y)+dy }))].filter(point => point.x >= 0 && point.y >= 0 && point.x < Number(space.width) && point.y < Number(space.height) && distance(actor, { ...point, space: actor.space }) === 1 && !removed.has(cellKey(point)) && !occupiedCrowd.has(cellKey(point)));
      for (const point of candidates) if (!seekerCells.some(item => cellKey(item) === cellKey(point)) && seekerCells.length < Number(fullRule.count || 1)) seekerCells.push(point);
      if (seekerCells.length < Number(fullRule.count || 1)) errors.push(`Рядом с Псарем недостаточно свободных клеток для ${fullRule.count} Ищеек.`);
    }
  }
  if (actor && isAttackRule && available?.automation === "attack" && family.audience !== "any" && targets.some(target => target.team === actor.team && !([ENEMY_MODIFIER_IDS.collateral,ENEMY_MODIFIER_IDS.vip].includes(target.profileId) && effectTargetingStatus(scene,actor.id,target.id).available))) errors.push("Эта автоматизированная Атака может выбирать целью только другую сторону, кроме незащищённых VIP и Случайных жертв.");
  const attackModifiers = actor && isAttackRule && available?.automation === "attack" ? attackModifierStatus(scene, actor.id, targetIds.filter(id => actorById(scene, id)?.team !== actor.team), request.attackModifierIds || []) : { available: !(request.attackModifierIds || []).length, reason: "Модификаторы доступны только Атаке, подключённой к общему окну Реакций.", selectedIds: [], advantage: 0 };
  if (!attackModifiers.available) errors.push(attackModifiers.reason);
  const maxTargets = Number(available?.maxTargets ?? rule?.maxTargets ?? 0);
  if (maxTargets && targets.length > maxTargets) errors.push(`Можно выбрать не больше ${maxTargets} целей.`);
  if (attackOrigin && (available?.adjacent || rule?.adjacent || family.targetsAdjacentAfterMove) && !hiddenAssassinAttack && targets.some(target => distance(attackOrigin, target) > 1)) errors.push("Цель должна быть смежной.");
  if (family.targetAdjacentToCrowd && targets.some(target => !(scene.actors || []).some(crowd => crowd.kind === "crowd" && !crowd.knockedOut && crowd.team === actor.team && crowd.space === target.space && distance(crowd, target) <= 1))) errors.push("Каждая цель должна быть смежна с союзной Зоной массовки.");
  if (attackOrigin && rule?.id === "enemy.common.executioner.attack.cleave" && targets.length) {
    const vectors = targets.map(target => ({ dx: Number(target.x) - Number(attackOrigin.x), dy: Number(target.y) - Number(attackOrigin.y) })), axis = vectors[0].dx ? "x" : "y", sign = Math.sign(vectors[0][axis === "x" ? "dx" : "dy"]), valid = vectors.every(vector => (axis === "x" ? vector.dy === 0 : vector.dx === 0) && Math.sign(vector[axis === "x" ? "dx" : "dy"]) === sign && Math.abs(vector[axis === "x" ? "dx" : "dy"]) <= 2);
    if (!valid) errors.push("Цели Разруба должны находиться на одной смежной Линии длиной 2 клетки.");
  }
  if (attackOrigin && rule?.range && targets.some(target => modifierRangeDistance(scene, attackOrigin, target) > Number(rule.range))) errors.push(`Цель должна быть в пределах ${rule.range} клеток (включая местность Громадины).`);
  if (fullRule?.type === "pugilist-stance" && (!Number.isInteger(Number(request.options?.stanceStep)) || Number(request.options.stanceStep) < 1 || Number(request.options.stanceStep) > 4)) errors.push("Выберите шаг Пассивa от 1 до 4.");
  const summonCells = [];
  if (fullRule?.type === "summon-profiles" && actor && space) {
    const occupied = new Set((scene.actors || []).filter(item => item.kind !== "crowd" && !item.knockedOut && item.space === actor.space).map(item => `${item.x},${item.y}`));
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const x = Number(actor.x) + dx, y = Number(actor.y) + dy;
      if (x >= 0 && y >= 0 && x < Number(space.width) && y < Number(space.height) && !occupied.has(`${x},${y}`) && !removedCellKeys(scene, actor.space).has(`${x},${y}`) && effectCellOccupancyStatus(scene, actor.id, {actor:{...actor,id:`summon-probe-${x}-${y}`,compoundId:null},space:actor.space,x,y}).available) {
        summonCells.push({ x, y });
        occupied.add(`${x},${y}`);
      }
      if (summonCells.length >= fullRule.profiles.length) break;
    }
    if (!summonCells.length) errors.push("Для призыва нужен хотя бы один свободный участок рядом с Леоном.");
  }
  const hasRoll = request.roll && Array.isArray(request.roll.rolls);
  const canonicalDirectDamage = rule?.directDamage ? enemyTierFormula(rule.directDamage, actor?.tier) : null;
  const hasDirectDamage = Number.isFinite(canonicalDirectDamage) || Number.isFinite(Number(request.damage)) && Number(request.damage) >= 0;
  if (attackModifiers.selectedIds.length && !hasRoll) errors.push("Модификатор Преимущества требует бросок Атаки.");
  if (isAttackRule && fullRule?.type !== "cannoneer-load" && !hasRoll && !hasDirectDamage) errors.push("Для Атаки нужен бросок или прямой урон из профиля.");
  if (errors.length) return { ok: false, errors, events: [], rule: available || rule };
  const customTargetResolution = ["assassin-mark", "guardian-shield"].includes(fullRule?.type);
  const targetEffectNames = customTargetResolution ? [] : Object.prototype.hasOwnProperty.call(family, "effects") ? family.effects : (rule.targetEffects || rule.effects || []);
  const targetEffects = targetEffectNames.map(name => effectIdByName(data, name));
  const selfEffects = (rule.selfEffects || []).map(name => effectIdByName(data, name));
  const payload = { ruleId: rule.id, profileId: profile.id, name: rule.name, kind: rule.kind, targetIds, text: rule.text, reward: rule.reward, automation: available?.automation || (targetEffects.length || selfEffects.length ? "effect" : "assisted") };
  const events = [{ type: "enemy.action.prepare", actorId: actor.id, payload }, { type: "resource.spend", actorId: actor.id, payload: { resource: "ap", amount: Number(rule.apCost || 1) } }];
  if (attackDestination) {
    const movement = family.teleportAttack ? `${rule.name}: телепортация` : `${rule.name}: перемещение`, placement = Boolean(family.teleportAttack || family.preMoveIgnoreRestrictions);
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: attackDestination.x, y: attackDestination.y, movement, path: attackMovePath.map(cellKey), placement, teleport: Boolean(family.teleportAttack), participantIds: [actor.id, ...targetIds] } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: attackDestination.x, y: attackDestination.y, movement, placement, teleport: Boolean(family.teleportAttack) } });
    if (family.teleportAttack) for (const [index, point] of [{ x: actor.x, y: actor.y }, attackDestination].entries()) events.push({ type: "marker.create", actorId: actor.id, payload: { id: `rift-${eventId()}-${index}`, space: actor.space, x: point.x, y: point.y, markerKind: "rift", label: "Разлом", color: "#8d6bd1", source: rule.id, ruleId: "enemy.common.rifter.passive.rifts", duration: "scene", ownerActorId: actor.id, participantIds: [actor.id] } });
    if (family.moveAdjacentAllies) {
      const dx = attackDestination.x - actor.x, dy = attackDestination.y - actor.y;
      for (const ally of (scene.actors || []).filter(item => item.id !== actor.id && !item.knockedOut && item.team === actor.team && item.space === actor.space && distance(actor, item) <= 1)) {
        const destination = { x: ally.x + dx, y: ally.y + dy };
        if (!effectCellOccupancyStatus(scene, ally.id, { actor: ally, space: ally.space, ...destination }).available) continue;
        events.push({ type: "actor.move", actorId: ally.id, payload: { space: ally.space, ...destination, movement: `${rule.name}: союзник`, placement: true, participantIds: [actor.id, ally.id] } });
        events.push({ type: "actor.enter", actorId: ally.id, payload: { space: ally.space, ...destination, movement: `${rule.name}: союзник`, placement: true } });
      }
    }
  }
  if (payload.automation !== "assisted") selfEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect, sourceActionId: rule.id } }));
  if (affectedCells.length) events.push({ type: "area.create", actorId: actor.id, payload: { id: `area-${eventId()}`, space: actor.space, areaType: rule.kind === "attack" ? "attack" : "danger", label: rule.name, source: rule.id, duration: rule.kind === "attack" ? "instant" : "scene", ownerActorId: actor.id, cells: affectedCells } });
  if (fullRule?.type === "pugilist-stance") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "pugilistStance", value: Number(request.options.stanceStep), sourceActionId: rule.id } });
  if (fullRule?.type === "martial-perfection") {
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "martialPerfection", value: true, sourceActionId: rule.id } });
    events.push({ type: "turn.grant", actorId: actor.id, payload: { amount: 1, sourceActionId: rule.id } });
  }
  if (fullRule?.type === "growth-and-turn") {
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "growth", delta: 1, sourceActionId: rule.id } });
    events.push({ type: "turn.grant", actorId: actor.id, payload: { amount: 1, sourceActionId: rule.id } });
  }
  if (fullRule?.type === "imposing-presence") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "imposingPresence", value: true, sourceActionId: rule.id } });
  if (fullRule?.type === "assassin-mark") {
    targets.forEach(target => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.помечен", sourceActionId: rule.id, duration: "scene", removable: false, participantIds: [actor.id, target.id] } }));
  }
  if (fullRule?.type === "guardian-shield") {
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "negative.обездвижен", sourceActionId: rule.id, participantIds: [actor.id] } });
    (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && target.space === actor.space && distance(actor, target) <= 4).forEach(target => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.спровоцирован", sourceActionId: rule.id, participantIds: [actor.id, target.id] } }));
  }
  if (fullRule?.type === "berserker-heal") events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: actor.id, amount: enemyTierFormula(fullRule.formula, actor.tier), sourceActionId: rule.id, participantIds: [actor.id] } });
  if (fullRule?.type === "berserker-last-stand") {
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "berserkerLastStand", value: true, sourceActionId: rule.id } });
    events.push({ type: "actor.runtime.set", actorId: actor.id, payload: { key: "hp", value: enemyTierFormula(fullRule.formula, actor.tier), sourceActionId: rule.id, participantIds: [actor.id] } });
    events.push({ type: "turn.grant", actorId: actor.id, payload: { amount: 1, sourceActionId: rule.id } });
  }
  if (fullRule?.type === "ranger-nest") {
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.устойчив", sourceActionId: rule.id, participantIds: [actor.id] } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "enemyAim", value: 1, sourceActionId: rule.id } });
  }
  if (fullRule?.type === "ranger-headshot") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "rangerHeadshotTargetId", value: targetIds[0], sourceActionId: rule.id } });
  if (fullRule?.type === "duelist-goad") {
    const target = targets[0], alreadyProvoked = (target.effects || []).includes("negative.спровоцирован");
    if (alreadyProvoked) {
      const options = Number(target.focus || 0) >= 2 ? ["focus", "move"] : ["move"];
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${eventId()}-duelist-goad`, kind: "enemy-duelist-goad", sourceActorId: actor.id, targetId: target.id, controller: "narrator", title: "Поддразнить", text: `${target.name} уже Спровоцирован: потратить 2 Фокуса или переместиться на 3 клетки прямо к ${actor.name}.`, options, context: { optionLabels: { focus: "Потратить 2 Фокуса", move: "Переместиться к Дуэлянту" } }, participantIds: [actor.id, target.id] } });
    } else events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.спровоцирован", sourceActionId: rule.id, participantIds: [actor.id, target.id] } });
  }
  if (fullRule?.type === "healer-heal") {
    const target = targets[0], multiplier = actor.ruleState?.healerGuardianId === target.id ? 2 : 1;
    events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: target.id, amount: enemyTierFormula(fullRule.formula, actor.tier) * multiplier, sourceActionId: rule.id, participantIds: [actor.id, target.id] } });
  }
  if (fullRule?.type === "healer-savior") {
    const guardian = targets[0];
    for (const effect of [...new Set(guardian.effects || [])]) events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: guardian.id, effect, force: true, sourceActionId: rule.id, participantIds: [actor.id, guardian.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: guardian.id, effect: "positive.регенерирует", duration: "scene", sourceActionId: rule.id, participantIds: [actor.id, guardian.id] } });
  }
  if (fullRule?.type === "oni-stabilize") {
    for (const effect of [...new Set(actor.effects || [])]) events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect, force: true, sourceActionId: rule.id, participantIds: [actor.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.ускорен", sourceActionId: rule.id, participantIds: [actor.id] } });
  }
  if (fullRule?.type === "revenant-lurk") {
    const nonRevenants = (scene.actors || []).filter(item => !item.knockedOut && item.profileId !== "enemy.common.revenant");
    const frightened = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && Number(target.focus || 0) <= 1 && nonRevenants.some(anchor => anchor.id !== target.id && anchor.space === target.space && distance(anchor, target) <= 2));
    for (const target of frightened) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.испуган", sourceActionId: rule.id, participantIds: [actor.id, target.id] } });
  }
  if (fullRule?.type === "executioner-bifurcate") {
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.заряжен", sourceActionId: rule.id, participantIds: [actor.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.устойчив", sourceActionId: rule.id, participantIds: [actor.id] } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "executionerBifurcate", value: { targetId: targets[0].id, dueTurnSerial: Number(scene.turnSerial || 0) + 1 }, sourceActionId: rule.id } });
  }
  if (fullRule?.type === "revenant-hollowed-eyes") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "revenantHollowedEyes", value: { targetId: targets[0].id, dueTurnSerial: Number(scene.turnSerial || 0) + 1 }, sourceActionId: rule.id } });
  if (fullRule?.type === "broodmother-roar") {
    const provoked = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && target.space === actor.space && Math.abs(target.x - actor.x) <= 2 && Math.abs(target.y - actor.y) <= 2);
    for (const target of provoked) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.спровоцирован", sourceActionId: rule.id, participantIds: [actor.id, target.id] } });
    events.push({ type: "turn.grant", actorId: actor.id, payload: { amount: 1, sourceActionId: rule.id } });
  }
  if (fullRule?.type === "privateer-gear-change") {
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "privateerGearChange", value: true, sourceActionId: rule.id, participantIds: [actor.id] } });
    events.push({ type: "turn.grant", actorId: actor.id, payload: { amount: 1, sourceActionId: rule.id, participantIds: [actor.id] } });
  }
  if (fullRule?.type === "ronin-sheath") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "roninSheathed", value: true, sourceActionId: rule.id, participantIds: [actor.id] } });
  if (fullRule?.type === "hound-seekers") {
    const target = targets[0], damage = enemyTierFormula("7(+1)", actor.tier), groupId = `seekers-${eventId()}`;
    for (const [index, point] of seekerCells.entries()) events.push({ type: "actor.spawn", actorId: actor.id, payload: { actor: { id: `seeker-${eventId()}-${index}`, kind: "crowd", crowdSubtype: "seeker", crowdType: "hounds", crowdGroupId: groupId, seekerTargetId: target.id, seekerOwnerId: actor.id, seekerDamage: damage, source: rule.id, sourceActionId: rule.id, team: actor.team, heroId: null, profileId: null, name: "Ищейка", tier: 0, space: actor.space, x: point.x, y: point.y, hp: 1, maxHp: 1, focus: 0, ap: 0, baseAp: 0, speed: 0, armor: 0, evasion: 0, effects: [], usedActions: [], acted: true, hidden: false, tokenSymbol: "◆", tokenColor: "#72558f", tokenImage: "", portraitImage: "" }, participantIds: [actor.id, target.id] } });
  }
  if (fullRule?.type === "cannoneer-load") {
    const clockId = "enemy.common.cannoneer.preparation", configured = clockStatus(scene, actor.id, clockId).available;
    if (!configured) events.push({ type: "rule-clock.configure", actorId: actor.id, payload: { clockId, label: "Подготовка", size: 4, minimumSize: 4, initial: 0, value: 0, active: true, resetScope: "scene", sourceActionId: rule.id } });
    const moved = currentTurnEvents(scene, actor.id).some(event => event.actorId === actor.id && event.type === "actor.move");
    events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId, delta: moved ? 1 : 2, sourceActionId: rule.id, reason: moved ? "Зарядить после движения" : "Зарядить без движения" } });
  }
  if (fullRule?.type === "corrupted-damage") {
    const match = String(fullRule.formula).match(/^(\d+)\(\+(\d+)\)$/), perTarget = match ? Number(match[1]) + Math.max(0, Number(actor.tier || 1) - 1) * Number(match[2]) : 0;
    const amount = targetIds.length * perTarget;
    targets.forEach(target => events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount, sourceActionId: rule.id } }));
  }
  if (fullRule?.type === "summon-profiles") {
    fullRule.profiles.slice(0, summonCells.length).forEach((profileId, index) => {
      const summonProfile = enemyProfileById(data, profileId), stats = summonProfile?.stats || {}, baseAp = 1;
      if (!summonProfile) return;
      events.push({
        type: "actor.spawn",
        actorId: actor.id,
        payload: {
          actor: {
            id: `summon-${eventId()}`,
            kind: "enemy",
            team: actor.team,
            heroId: null,
            profileId: summonProfile.id,
            name: summonProfile.name,
            tier: actor.tier,
            space: actor.space,
            x: summonCells[index].x,
            y: summonCells[index].y,
            hp: Number(stats.health || 1),
            maxHp: Number(stats.health || 1),
            focus: 0,
            ap: baseAp,
            baseAp,
            speed: Number(stats.speed || 3),
            armor: Number(stats.armor || 0),
            evasion: Number(stats.evasion || 0),
            effects: [],
            usedActions: [],
            usedTrump: false,
            acted: false,
            hidden: false,
            tokenSymbol: index === 0 ? "◎" : "✹",
            tokenColor: index === 0 ? "#6fc9d8" : "#df7836",
            tokenImage: "",
            portraitImage: "",
            summonerId: actor.id,
          },
        },
      });
    });
  }
  if (isAttackRule && payload.automation === "attack") {
    if (family.chargedAttack && !(actor.effects || []).includes("positive.заряжен")) {
      events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.заряжен", sourceActionId: rule.id, participantIds: [actor.id] } });
      events.push({ type: "enemy.action.resolve", actorId: actor.id, payload: { ...payload, kind: "charge", targetIds: [] } });
      return { ok: true, errors: [], events, rule: available || clone(rule) };
    }
    if (hiddenAssassinAttack) {
      const target = targets[0];
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: target.space, x: assassinReappearance.x, y: assassinReappearance.y, movement: "Разрез: появление", placement: true, teleport: true, participantIds: [actor.id, target.id] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: target.space, x: assassinReappearance.x, y: assassinReappearance.y, movement: "Разрез: появление", placement: true, teleport: true } });
      events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: rule.id, participantIds: [actor.id] } });
    }
    if (rule.id === "enemy.common.cannoneer.trump.fire") events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: "enemy.common.cannoneer.preparation", value: 0, sourceActionId: rule.id } });
    const oniReinforced = Boolean(family.oniModes && (actor.effects || []).includes("positive.укреплен"));
    const hostileTargets = oniReinforced ? [] : targets.filter(target => target.team !== actor.team), alliedTargets = targets.filter(target => target.team === actor.team);
    hostileTargets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: rule.id } }));
    const tensionMultiplier = Number(ENEMY_AUTO_ATTACK_RULES.get(rule.id) || 0);
    const effectAttack = effectAttackStatus(scene, actor.id, hostileTargets.map(target => target.id));
    const baseDamage = (hasRoll ? Number(request.roll.successes || 0) + Number(scene.tension || 0) * tensionMultiplier : Number.isFinite(canonicalDirectDamage) ? canonicalDirectDamage : Number(request.damage)) + Number(effectAttack.damageModifier || 0);
    const damageByTarget = Object.fromEntries(hostileTargets.map(target => {
      let amount = baseDamage + Number(effectAttack.damageByTarget?.[target.id] || 0);
      if (family.bonusTensionAtRange && distance(attackOrigin, target) >= Number(family.bonusTensionAtRange)) amount += Number(scene.tension || 0);
      if (family.provokedTierDamage && (target.effects || []).includes("negative.спровоцирован")) amount += Number(actor.tier || 1);
      if (family.broodmotherDamage) amount += (scene.actors || []).filter(item => item.kind === "crowd" && !item.knockedOut && item.team === actor.team && distance(attackOrigin, item) <= 1).length;
      if (family.aimDamage) amount += Number(actor.ruleState?.enemyAim || 0);
      if (actor.ruleState?.rangerHeadshotTargetId === target.id) amount += Number(request.roll?.successes || 0);
      return [target.id, amount];
    }));
    const push = Number(family.postPush || enemyTierFormula(family.postPushFormula, actor.tier) || 0);
    const postDisplacements = push ? hostileTargets.map(target => ({ targetId: target.id, mode: "push", maximum: push, name: rule.name, ruleId: rule.id, collisionDamagePerCell: 0 })) : [];
    const postResourceLoss = family.postResourceLoss ? { resource: family.postResourceLoss.resource, amount: enemyTierFormula(family.postResourceLoss.formula, actor.tier), ruleId: rule.id } : null;
    const allyEffectIds = (family.allyEffects || []).map(name => effectIdByName(data, name));
    const supportTargets = oniReinforced ? targets : alliedTargets;
    for (const target of supportTargets) {
      if (family.allyHeal || oniReinforced) events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: target.id, amount: oniReinforced ? Number(request.roll?.successes || 0) : baseDamage, sourceActionId: rule.id, participantIds: [actor.id, target.id] } });
      if (oniReinforced) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: effectIdByName(data, "Ускорен"), sourceActionId: rule.id, participantIds: [actor.id, target.id] } });
      allyEffectIds.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: rule.id, participantIds: [actor.id, target.id] } }));
    }
    const attackEffects = family.oniModes ? ((actor.effects || []).includes("positive.усилен") ? [effectIdByName(data, "Подброшен")] : []) : targetEffects;
    if (hostileTargets.length) events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: rule.id, enemyRuleId: rule.id, name: rule.name, targetIds: hostileTargets.map(target => target.id), roll: hasRoll ? clone(request.roll) : null, damage: baseDamage, damageByTarget, damageRepeats: Math.max(1, Number(family.damageRepeats || 1)), effects: attackEffects, reward: rule.reward || "", attackModifierIds: attackModifiers.selectedIds, attackModifierAdvantage: attackModifiers.advantage, postDisplacements, postResourceLoss, postSelfHealMissingFraction: Number(family.postSelfHealMissingFraction || 0), enemyAttackFamily: clone(family), attackAnchor: anchor ? clone(anchor) : null } });
    else events.push({ type: "enemy.action.resolve", actorId: actor.id, payload: { ...payload, targetIds } });
  } else {
    if (rule.kind !== "attack" && ["effect", "full"].includes(payload.automation)) targets.forEach(target => targetEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: rule.id } })));
    if (rule.kind === "attack" && hasRoll) events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    events.push({ type: "enemy.action.resolve", actorId: actor.id, payload });
  }
  return { ok: true, errors: [], events, rule: available || clone(rule) };
}
