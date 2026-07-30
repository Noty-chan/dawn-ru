"use strict";

const QUICK_ACTION_RULES = [
  { id: "vagabond.drunkard.3.rest", techniqueId: "vagabond.drunkard", level: 3, action: "Передышка", condition: "firstTurn" },
  { id: "altruist.battle-instructor.1.study", techniqueId: "altruist.battle-instructor", level: 1, action: "Изучение", condition: "always" },
  { id: "altruist.fog-walker.3.rest", techniqueId: "altruist.fog-walker", level: 3, action: "Передышка", condition: "always" },
  { id: "altruist.bardic-savant.2.rest", techniqueId: "altruist.bardic-savant", level: 2, action: "Передышка", condition: "always" },
  { id: "ruiner.creation-ascetic.2.rest", techniqueId: "ruiner.creation-ascetic", level: 2, action: "Передышка", condition: "firstTurn" },
];
const TECHNIQUE_COMBO_RULES = new Map([
  ["powerhouse.technician.3", { techniqueId: "powerhouse.technician", level: 3, name: "Последний удар", requires: "Стычка", action: "Завершение", apCost: 1 }],
  ["vagabond.assassin.3", { techniqueId: "vagabond.assassin", level: 3, name: "Скорость тьмы", requires: "Скрыться", action: "Шаг", apCost: 0, selfEffect: "Невидим" }],
  ["powerhouse.dragonslayer.3", { techniqueId: "powerhouse.dragonslayer", level: 3, name: "Титанический замах", requires: "Передышка", action: "Завершение", attribute: "body", allDiceSucceed: true, postPush: 2, postSelfEffects: ["Ослаблен"] }],
  ["powerhouse.spellsword.3", { techniqueId: "powerhouse.spellsword", level: 3, name: "Охотник на ведьм", requires: "Заклинание", action: "Завершение", attributes: ["body", "talent"], sameTargets: true, bonusDamageAttribute: "spirit" }],
  ["vagabond.speed-demon.2", { techniqueId: "vagabond.speed-demon", level: 2, name: "Мгновенный шаг", requires: "Передышка", action: "Шаг", movementMultiplier: 3 }],
]);
// Enemy prose is intentionally never interpreted at runtime. These audited
// registries contain only the deterministic part of a rule; everything else
// stays assisted and is confirmed by the Narrator.
const ENEMY_AUTO_ATTACK_RULES = new Map([
  ["enemy.common.captor.attack.catch-and-release", 2],
  ["enemy.common.pugilist.attack.flurry-of-strikes", 2],
  ["enemy.common.slime.attack.goop", 1],
  ["enemy.common.bannerman.attack.swing", 1],
  ["enemy.common.baron.attack.suppress", 1],
  ["enemy.common.cultist.attack.swipe", 1],
  ["enemy.common.necromancer.attack.terrifying-shot", 2],
]);
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
  "enemy.common.cannoneer.action.aim",
  "enemy.common.privateer.action.escort",
]);
const ENEMY_FULL_RULES = new Map([
  ["enemy.common.assassin.trump.disappear", { type: "effects" }],
  ["enemy.common.executioner.action.focus-up", { type: "effects" }],
  ["enemy.common.paladin.action.gospel", { type: "regenerating-allies" }],
  ["enemy.common.cannoneer.action.aim", { type: "effects" }],
  ["enemy.common.pugilist.action.take-stance", { type: "pugilist-stance" }],
  ["enemy.common.pugilist.trump.martial-perfection", { type: "martial-perfection" }],
  ["enemy.common.viper.action.lick-the-knife", { type: "corrupted-damage", formula: "3(+1)" }],
  ["enemy.common.cocoon.trump.quick-growth", { type: "growth-and-turn" }],
  ["enemy.common.guardian.trump.imposing-presence", { type: "imposing-presence" }],
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
  const sceneActions = (scene.log || []).filter(event => event.type === "action.prepare" && event.actorId === actor.id);
  if (action.name === "Скрыться" && Number(actor.techniques?.["vagabond.assassin"] || 0) >= 1 && sceneActions.length === 0) {
    const technique = (data.archetypes || []).flatMap(archetype => archetype.techniques || []).find(item => item.id === "vagabond.assassin");
    sources.push({ id: "vagabond.assassin.1", techniqueId: "vagabond.assassin", level: 1, name: "Засада", condition: "sceneFirst", ignoreRequirements: true, needsConfirmation: false, text: technique?.levels?.[0]?.text || "" });
  }
  if (action.name === "Заклинание" && actor.ruleState?.grimTransformed && !currentTurnEvents(scene, actor.id).some(event => event.type === "action.prepare" && event.payload?.actionName === "Заклинание")) {
    sources.push({ id: "ruiner.grim-ascendant.1.spell", techniqueId: "ruiner.grim-ascendant", level: 1, name: "Непостоянная мощь", condition: "firstTurn", needsConfirmation: false, text: "Первое Заклинание в Ход является Быстрым." });
  }
  if (action.name === "Заклинание" && Number(actor.ruleState?.icicleSpellsRemaining || 0) > 0) sources.push({ id: "ruiner.cryomancer.2.icicle", techniqueId: "ruiner.cryomancer", level: 2, name: "Ледяной нимб", condition: "series", needsConfirmation: false, text: "Заклинание серии Сосульки является Быстрым и наносит половину урона." });
  for (const rule of QUICK_ACTION_RULES.filter(item => item.action === action.name && Number(actor.techniques?.[item.techniqueId] || 0) >= item.level)) {
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
      else if (!targetIds.length || targetIds.length > 2 || targets.some(target => distance({ ...actor, ...destination }, target) > 1)) reason = "После перемещения Клинок выбирает одну или две смежные вражеские цели.";
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
  return (data?.actions?.list || []).map(action => {
    const cost = actorActionCost(actor, action);
    const reaction = action.group === "Защита" || action.en === "Реакция";
    let quickSource = quickActionSources(scene, data, actor, action)[0] || null;
    const rage = clockStatus(scene, actor.id, "ruiner.feral-arcana.rage");
    if (!quickSource && action.name === "Прыжок" && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 2 && rage.available && rage.active && rage.value > 0) quickSource = { id: "ruiner.feral-arcana.2", techniqueId: "ruiner.feral-arcana", level: 2, name: "Сорваться с цепи", needsConfirmation: false, text: "Прыжки Быстрые, пока существует Ярость." };
    const continuation = action.name === "Шаг" && (actor.usedActions || []).includes(action.id) && Number(actor.stepRemaining || 0) > 0;
    const quick = !continuation && Boolean(quickSource);
    const effectiveCost = continuation || quickSource?.id === "vagabond.assassin.1" ? { amount: 0, resource: null } : cost;
    const automation = quickSource?.needsConfirmation ? "assist" : new Set(["Прыжок", "Шаг", "Заклинание", "Блок", "Уворот", "Передышка", "Зарядка", "Скрыться", "Изучение"]).has(action.name) ? "full" : "assist";
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
    else if (!reaction && action.name === "Шаг" && actor.speedZeroUntilTurnEnd) reason = "Скорость равна 0 до конца текущего Хода";
    else if (!reaction && ["Шаг", "Прыжок"].includes(action.name) && !effectMovementStatus(scene, actor.id).available) reason = effectMovementStatus(scene, actor.id).reason;
    else if (!reaction && rage.available && rage.active && rage.value > 0 && effectiveCost.resource === "ap" && !["Прыжок", "Завершение"].includes(action.name)) reason = "Пока существует Ярость, ОД можно тратить только на Прыжки и Завершения";
    else if (!reaction && Number(actor.ruleState?.icicleSpellsRemaining || 0) > 0 && action.name !== "Заклинание") reason = "Сначала завершите или остановите серию Заклинаний Сосульки";
    else if (!reaction && (actor.usedActions || []).includes(action.id) && !continuation && !quick) reason = "Это действие уже использовано в Раунде";
    else if (action.name === "Стычка" && Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 1 && !ruleResourceStatus(scene, actor.id, { resource: "bullets", amount: 1 }).available) reason = "Для Стычки нужна хотя бы 1 Пуля";
    else if (effectiveCost.resource && !resourceOperationStatus(scene, actor.id, { ...effectiveCost, operation: "spend" }).available) reason = `Недостаточно: ${action.cost}`;
    return { ...clone(action), costModel: effectiveCost, reaction, automation, quick, quickSource, continuation, remaining: continuation ? Number(actor.stepRemaining || 0) : null, available: !reason, reason };
  });
}

function cunningPlanStatus(scene, data, actorId, actionId) {
  const actor = actorById(scene, actorId), action = actionById(data, actionId);
  if (!actor || !action) return { available: false, reason: "Действие не найдено.", segments: 0, unlimited: false };
  const level = Number(actor.techniques?.["vagabond.cunning-fighter"] || 0), segments = clockStatus(scene, actor.id, "vagabond.cunning-fighter.plan").value, unlimited = level >= 2;
  const attack = ["Стычка", "Заклинание", "Завершение"].includes(action.name) || action.group === "Атаки";
  const usedThisTurn = currentTurnEvents(scene, actor.id).some(event => event.type === "rule-clock.tick" && event.payload?.sourceActionId === "vagabond.cunning-fighter.1.plan");
  let reason = "";
  if (level < 1) reason = "Не изучена Техника «План и исполнение».";
  else if (actor.knockedOut) reason = "Персонаж выведен из строя.";
  else if (scene.pendingAction) reason = "Сначала разрешите текущую Реакцию.";
  else if (scene.activeActorId !== actor.id) reason = "Сейчас не Ход этого героя.";
  else if (attack || action.group === "Защита") reason = "Хитрый план применяется только к действиям не-Атаки.";
  else if (action.name === "Шаг" && Number(actor.stepRemaining || 0) > 0) reason = "Сначала завершите уже оплаченный Шаг.";
  else if (segments < 1) reason = "Часы Хитрого плана пусты.";
  else if (!unlimited && usedThisTurn) reason = "«План и исполнение» уже использован в этом Ходу.";
  return { available: !reason, reason, segments, unlimited, discountedCost: Math.max(0, Number(actionCost(action).amount || 0) - 1) };
}

function prepareAction(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId);
  const declaredAction = actionById(data, request.actionId);
  let action = declaredAction;
  const errors = [];
  if (!actor) errors.push("Не выбран исполнитель действия.");
  if (!declaredAction) errors.push("Неизвестное базовое действие.");
  if (scene.pendingActionPlan && (request.planId !== scene.pendingActionPlan.id || request.actorId !== scene.pendingActionPlan.actorId || request.actionId !== scene.pendingActionPlan.actionId)) errors.push("Действие не совпадает с сохранённым составным планом.");
  let available = actor && declaredAction ? availableActions(scene, data, actor.id).find(item => item.id === declaredAction.id) : null;
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
    const studies = currentTurnEvents(scene, actor.id).filter(event => event.type === "action.prepare" && event.actorId === actor.id && (event.payload?.actionName || event.payload?.name) === "Изучение");
    const sameTarget = studies.some(event => (event.payload?.targetIds || []).includes(request.targetIds[0])), thirdStudy = studies.length === 2;
    if (sameTarget || thirdStudy) {
      const free = thirdStudy, blockingReason = available?.reason || "";
      if (!blockingReason || /^Это действие уже использовано/.test(blockingReason) || free && /^Недостаточно:/.test(blockingReason)) {
        available = { ...available, available: true, reason: "", quick: true, continuation: false, costModel: free ? { amount: 0, resource: null } : actorActionCost(actor, declaredAction), quickSource: { techniqueId: "vagabond.dim-mak", level: 1, name: free ? "Третье Изучение" : "Изучить слабость", needsConfirmation: false } };
      }
    }
  }
  const selectedDimMakMarker = actor && declaredAction && ["Стычка", "Заклинание", "Завершение"].includes(declaredAction.name)
    ? (scene.markers || []).find(marker =>
        (request.attackModifierIds || []).includes(`vagabond.dim-mak.1:${marker.id}`)
        && marker.ruleId === "vagabond.dim-mak.1"
        && marker.ownerActorId === actor.id
        && marker.metadata?.carrierActorId === request.targetIds?.[0]
        && marker.space === actor.space
        && Number(marker.x) === Number(actor.x)
        && Number(marker.y) === Number(actor.y))
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
  let targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
  const attackNames = new Set(["Стычка", "Заклинание", "Завершение"]);
  const attackModifiers = attackNames.has(declaredAction.name) ? attackModifierStatus(scene, actor.id, targetIds, request.attackModifierIds || [], { actionName: declaredAction.name }) : { available: !(request.attackModifierIds || []).length, reason: "Модификаторы Атаки применимы только к Атакам.", selectedIds: [], advantage: 0, actionTransform: null };
  if (!attackModifiers.available) errors.push(attackModifiers.reason);
  if (attackModifiers.actionTransform) {
    action = (data.actions?.list || []).find(item => item.name === attackModifiers.actionTransform.actionName) || null;
    if (!action) errors.push("Действие-замена модификатора не найдено.");
    else {
      const transformedAvailable = availableActions(scene, data, actor.id).find(item => item.id === action.id);
      const transformedReason = transformedAvailable?.reason || "", planLock = request.planId && request.planId === scene.pendingActionPlan?.id && /^Сначала завершите составное действие/.test(transformedReason);
      if (!transformedAvailable?.available && !/^Недостаточно:/.test(transformedReason) && !planLock) errors.push(transformedReason || "Действие-замена сейчас недоступно.");
    }
  }
  const spellcrafterLevel = Number(actor.techniques?.["ruiner.spellcrafter"] || 0), spellModifiers = spellcrafterLevel && ["Заклинание", "Завершение"].includes(action?.name) ? [...new Set(actor.techniqueState?.spellModifiers || [])] : [], modifierResource = spellcrafterLevel >= 2 ? "focus" : "innovationCharges";
  if (errors.length) return { ok: false, errors, events: [] };
  const breacherSkirmish = action.name === "Стычка" && Number(actor.techniques?.["powerhouse.breacher"] || 0) >= 1;
  const gunslingerSkirmish = action.name === "Стычка" && Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 1;
  const bulletsSpent = gunslingerSkirmish ? Number(request.bulletsSpent ?? 1) : 0;
  const bulletAdvantage = gunslingerSkirmish ? Number(request.bulletAdvantage ?? Math.max(0, bulletsSpent - Math.max(1, targetIds.length))) : 0;
  const knifeThrow = action.name === "Стычка" && Number(actor.techniques?.["vagabond.knife-juggler"] || 0) >= 1 && Boolean(request.throwWeapon);
  const meisterOverload = ["Стычка", "Завершение"].includes(action.name) && Number(actor.techniques?.["vagabond.modified-meister"] || 0) >= 2 && Boolean(request.overload);
  const mundaneLevel = Number(actor.techniques?.["bulwark.mundane"] || 0), actionAttribute = attackModifiers.attributeOverride || request.attribute || request.roll?.attribute || null;
  const attackModifierDestination = attackModifiers.requiresDestination ? attackModifierDestinationStatus(scene, actor.id, targetIds, attackModifiers.selectedIds, request.attackModifierDestination, { actionName: declaredAction.name }) : null;
  if (attackModifierDestination && !attackModifierDestination.available) errors.push(attackModifierDestination.reason);
  const thunderDischarge = Boolean(request.useThunderDischarge) && action.name === "Завершение" && actionAttribute === "spirit" && Number(actor.techniques?.["ruiner.thunder-blood"] || 0) >= 3 && clockStatus(scene, actor.id, "ruiner.thunder-blood.static").value >= 3;
  const eclipseStars = Boolean(request.useEclipseStars) && action.name === "Завершение" && actionAttribute === "spirit" && Number(actor.techniques?.["ruiner.void-soul"] || 0) >= 3 && clockStatus(scene, actor.id, "ruiner.void-soul.void").full;
  const revelationClock = clockStatus(scene, actor.id, "ruiner.zealot.revelation"), zealotCells = [...new Set(request.zealotCells || [])], zealotRupture = Boolean(request.useZealotRupture) && action.name === "Завершение" && actionAttribute === "spirit" && Number(actor.techniques?.["ruiner.zealot"] || 0) >= 3 && revelationClock.full && zealotCells.length > 0;
  const rageForGrasp = clockStatus(scene, actor.id, "ruiner.feral-arcana.rage"), grasp = Boolean(request.useGrasp) && action.name === "Завершение" && actionAttribute === "body" && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 3 && rageForGrasp.active && rageForGrasp.value > 0;
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
  const heavenlyLevel = Number(actor.techniques?.["altruist.heavenly-saint"] || 0), heavenlyHealing = !zealotRupture && (action.name === "Заклинание" && heavenlyLevel >= 2 || action.name === "Завершение" && heavenlyLevel >= 3 && actionAttribute === "spirit");
  const startRage = action.name === "Взаимодействие" && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 2 && Boolean(request.startRage);
  const revelationEligible = ["Зарядка", "Заклинание"].includes(action.name) || action.name === "Завершение" && actionAttribute === "spirit";
  const useRevelation = Boolean(request.useRevelation) && Number(actor.techniques?.["ruiner.zealot"] || 0) >= 1 && revelationEligible;
  if (request.useRevelation && !revelationEligible) errors.push("Озарение изменяет только Зарядку, Заклинание или Завершение Духом.");
  if (useRevelation && clockStatus(scene, actor.id, "ruiner.zealot.revelation").value < 1) errors.push("Для Еретической преданности нужен сегмент Озарения.");
  if (useRevelation && request.roll) {
    const originalSuccesses = Number(request.roll.successes || 0);
    request.roll = { ...clone(request.roll), originalSuccesses, successes: Math.max(0, (Number(actor.attrs?.spirit || 0) + Number(actor.tier || 1)) * 2 - originalSuccesses), revelation: true };
  }
  if (startRage && targetIds.length) errors.push("«Сорваться с цепи» заменяет только Взаимодействие без цели.");
  if (attackNames.has(action.name) && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 1 && Number(actor.creationMarks || 0) > 0) errors.push("С Метками творения выберите соответствующую форму Атаки в разделе Техники: все Метки должны быть потрачены.");
  if (targets.length !== targetIds.length) errors.push("Одна из выбранных целей больше не находится на Сцене.");
  if (targets.some(target => target.knockedOut)) errors.push("Выведенный из боя персонаж не может быть целью действия.");
  if (spellModifiers.length > (spellcrafterLevel >= 3 ? 2 : 1)) errors.push("Этот Уровень Творца заклинаний не позволяет столько Модификаций.");
  if (spellModifiers.some(mod => ["focused", "wild"].includes(mod))) errors.push("Сфокусированная и Дикая Модификации применяются через зональный конструктор Техники.");
  if (spellModifiers.length && Number(actor[modifierResource] || 0) < spellModifiers.length) errors.push(`Недостаточно ресурса для ${spellModifiers.length} Модификаций.`);
  if (gunslingerSkirmish && (!Number.isInteger(bulletsSpent) || bulletsSpent < 1 || !Number.isInteger(bulletAdvantage) || bulletAdvantage < 0)) errors.push("Укажите целое число потраченных Пуль и Пуль на Преимущество.");
  if (gunslingerSkirmish && bulletAdvantage + Math.max(0, targetIds.length - 1) > bulletsSpent - 1) errors.push("Дополнительных Пуль не хватает одновременно на выбранные цели и Преимущество.");
  if (gunslingerSkirmish && !ruleResourceStatus(scene, actor.id, { resource: "bullets", amount: bulletsSpent }).available) errors.push("Недостаточно Пуль для Стычки.");
  if (knifeThrow && !ruleResourceStatus(scene, actor.id, { resource: "weapons", amount: 1 }).available) errors.push("Для Метания нужно 1 Оружие.");
  if (knifeThrow && targetIds.length !== 1) errors.push("Метание выбирает ровно одного персонажа.");
  if (meisterOverload && !Array.isArray(request.roll?.rolls)) errors.push("Для Перегрузки нужен зафиксированный бросок Атаки.");
  if (mundaneLevel >= 1 && action.name === "Заклинание") errors.push("Обычный не может использовать Заклинание.");
  if (mundaneLevel >= 1 && action.name === "Завершение" && actionAttribute === "spirit") errors.push("Обычный не может использовать Завершение Духом.");
  const modifierQuick = Boolean(attackModifiers.quick), armamentQuick = Boolean(armament?.available);
  const quickSource = armamentQuick ? { techniqueId: "vagabond.master-at-arms", level: 1, name: armament.label, needsConfirmation: false } : modifierQuick ? { techniqueId: "vagabond.dim-mak", level: 1, name: "Слабая точка", needsConfirmation: false } : available?.quickSource;
  const events = [{ type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, actionName: action.name, name: action.name, declaredActionId: declaredAction.id, declaredActionName: declaredAction.name, targetIds, planId: request.planId || null, attackModifierIds: attackModifiers.selectedIds, attackModifierAdvantage: attackModifiers.advantage, actionTransform: attackModifiers.actionTransform, quick: Boolean(available?.quick || modifierQuick || armamentQuick), quickSource: quickSource ? { techniqueId: quickSource.techniqueId, level: quickSource.level, name: quickSource.name, needsConfirmation: quickSource.needsConfirmation } : null, continuation: Boolean(available?.continuation && !modifierQuick && !armamentQuick) } }];
  events[0].payload.request = { attribute: actionAttribute, useCunningPlan: Boolean(request.useCunningPlan), useRevelation: Boolean(request.useRevelation), useThunderDischarge: Boolean(request.useThunderDischarge), useEclipseStars: Boolean(request.useEclipseStars), useGrasp: Boolean(request.useGrasp), startRage: Boolean(request.startRage), armamentMode, armamentDestination: armament?.destination || null, bulletsSpent: Number.isFinite(Number(request.bulletsSpent)) ? Number(request.bulletsSpent) : null, bulletAdvantage: Number.isFinite(Number(request.bulletAdvantage)) ? Number(request.bulletAdvantage) : null, throwWeapon: Boolean(request.throwWeapon), overload: Boolean(request.overload), provokeTargetIds: [...new Set(request.provokeTargetIds || [])].slice(0, 40), removeEffectIdsByTarget: clone(request.removeEffectIdsByTarget || {}), attackModifierIds: attackModifiers.selectedIds };
  if (armamentQuick) {
    events[0].payload.armament = { groupId: MASTER_AT_ARMS_GROUP, modeId: armamentMode, label: armament.label };
    events.push({ type: "rule-mode.set", actorId: actor.id, payload: { groupId: MASTER_AT_ARMS_GROUP, modeId: armamentMode, ruleId: "vagabond.master-at-arms.1", participantIds: [actor.id, ...targetIds] } });
  }
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
  if (gunslingerSkirmish) {
    events[0].payload.ruleResource = { resource: "bullets", spent: bulletsSpent, advantage: bulletAdvantage, additionalTargets: Math.max(0, targetIds.length - 1), passiveAdvantage: Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 2 ? 1 : 0, ruleId: "powerhouse.gunslinger.1" };
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

  if (["Шаг", "Прыжок"].includes(action.name)) {
    const destination = request.destination;
    const space = (scene.spaces || []).find(item => item.id === actor.space);
    const baseMovement = action.name === "Прыжок" ? Number(actor.attrs?.talent || 0) : actor.speedZeroUntilTurnEnd ? 0 : available?.continuation ? Number(actor.stepRemaining || 0) : Number(actor.speed || 0), modifiedMovement = baseMovement * Math.max(1, Number(request.movementMultiplier || 1)), moveLimit = effectMovementStatus(scene, actor.id, { distance: modifiedMovement }).distance;
    if (!destination || !space || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Выберите свободную клетку назначения.");
    else if (!effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка назначения занята.");
    else {
      let path = movementPath(scene, actor.id, destination, { maxDistance: moveLimit, straight: action.name === "Прыжок", ignoreEnemies: action.name === "Прыжок", ignoreDifficult: action.name === "Прыжок" });
      if (!path.length) errors.push(action.name === "Прыжок" ? `Прыжок должен идти по свободной прямой Линии длиной до ${moveLimit}.` : `До этой клетки нет свободного пути в пределах Скорости ${moveLimit}.`);
      else {
        const trapCell = path.find(point => (scene.markers || []).some(marker => marker.kind === "trap" && /disruptor\.hunter\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`) && marker.space === actor.space && marker.x === point.x && marker.y === point.y && Number(actorById(scene, marker.ownerActorId)?.techniques?.["disruptor.hunter"] || 0) >= 1 && actorById(scene, marker.ownerActorId)?.team !== actor.team));
        if (trapCell) path = path.slice(0, path.indexOf(trapCell) + 1);
        const resolvedDestination = path.at(-1);
        if (action.name === "Шаг") {
          const difficult = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "difficult").flatMap(object => object.cells || []));
          events[0].payload.stepRemaining = trapCell || difficult.has(cellKey(resolvedDestination)) ? 0 : Math.max(0, moveLimit - path.length);
        }
        events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: resolvedDestination.x, y: resolvedDestination.y, movement: action.name, path: path.map(cellKey), topologyCrossings: path.filter(point => point.teleported).map(point => ({ destination: cellKey(point), cutIds: point.crossedCutIds || [] })), interruptedByTrap: Boolean(trapCell) } });
        events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: resolvedDestination.x, y: resolvedDestination.y, movement: action.name, ignoreDifficult: action.name === "Прыжок" } });
      }
    }
  } else if (["Стычка", "Заклинание", "Завершение"].includes(action.name)) {
    const limit = (armamentMode === "chain" || gunslingerSkirmish || knifeThrow || breacherSkirmish ? 4 : action.name === "Заклинание" ? 5 : 1) + (spellModifiers.includes("outstanding") ? Number(actor.attrs?.mind || 0) : 0);
    const disappeared = hasEffect(scene, actor, "positive.исчез");
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
      else if (!effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка появления занята.");
      else if (Number(actor.techniques?.["vagabond.assassin"] || 0) < 2 && (scene.actors || []).some(item => item.id !== actor.id && effectPresenceStatus(scene, item.id).onField && item.space === actor.space && distance(item, { ...destination, space: actor.space }) <= 1)) errors.push("При появлении клетка не должна быть смежна с персонажем.");
      else {
        attackOrigin = { ...actor, x: destination.x, y: destination.y };
        events.splice(1, 0, { type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: Number(actor.techniques?.["vagabond.assassin"] || 0) >= 2 ? "Ликвидация" : "Появление", placement: true, participantIds: [actor.id, ...targetIds] } });
        events.splice(2, 0, { type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Появление" } });
      }
    }
    if (!targets.length && !zealotRupture) errors.push("Выберите цель атаки.");
    const unavailableEffectTarget = targets.find(target => !effectTargetingStatus(scene, actor.id, target.id, { sourceReappearing: disappeared }).available);
    if (unavailableEffectTarget) errors.push(effectTargetingStatus(scene, actor.id, unavailableEffectTarget.id, { sourceReappearing: disappeared }).reason);
    if (heavenlyHealing ? targets.some(target => target.team !== actor.team || target.id === actor.id) : !thunderDischarge && !zealotRupture && targets.some(target => target.team === actor.team)) errors.push(heavenlyHealing ? "Очищающий свет выбирает союзника, но не самого исполнителя." : "Базовая Атака может выбирать целью только противника.");
    if (action.name === "Стычка" && !gunslingerSkirmish && !knifeThrow && targets.length > 2) errors.push("Стычка выбирает не больше 2 целей.");
    if (action.name !== "Стычка" && targets.length > 1 && !thunderDischarge && !eclipseStars && !zealotRupture) errors.push(`${action.name} выбирает только одну цель.`);
    if (!thunderDischarge && !eclipseStars && !zealotRupture && targets.some(target => distance(attackOrigin, target) > limit)) errors.push(`Цель должна быть в пределах ${limit} клеток от клетки появления.`);
    const bonus = (action.name === "Завершение" ? Number(scene.tension || 0) : 0) + (spellModifiers.includes("fierce") ? Number(actor.attrs?.mind || 0) : 0), drainLife = Boolean(actor.ruleState?.drainLife && action.name === "Завершение" && actor.ruleState?.grimTransformed), adjustedDamage = value => drainLife ? Math.ceil(Math.max(0, value) / 2) : Math.max(0, value);
    if (heavenlyHealing) {
      const removalMap = request.removeEffectIdsByTarget && typeof request.removeEffectIdsByTarget === "object" ? request.removeEffectIdsByTarget : {};
      targets.forEach(target => {
        events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: target.id, amount: Math.floor(Number(request.roll?.successes || 0) / 2), sourceActionId: heavenlyLevel >= 3 && action.name === "Завершение" ? "altruist.heavenly-saint.3" : "altruist.heavenly-saint.2", participantIds: [actor.id, target.id] } });
        [...new Set(removalMap[target.id] || [])].filter(effect => (target.effects || []).includes(effect)).forEach(effect => events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: "altruist.heavenly-saint.2", participantIds: [actor.id, target.id] } }));
        if (heavenlyLevel >= 3 && action.name === "Завершение") {
          events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "positive.регенерирует", sourceActionId: "altruist.heavenly-saint.3", participantIds: [actor.id, target.id] } });
          const woundUsed = (scene.log || []).some(event => event.type === "actor.wound" && event.actorId === actor.id && event.payload?.targetId === target.id && event.payload?.sourceActionId === "altruist.heavenly-saint.3");
          if (!woundUsed && Number(target.wounds || 0) > 0) events.push({ type: "actor.wound", actorId: actor.id, payload: { targetId: target.id, delta: -1, sourceActionId: "altruist.heavenly-saint.3", participantIds: [actor.id, target.id] } });
        }
      });
      events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: action.id, name: action.name, targetIds, heavenlyHealing: true } });
    } else {
      targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: action.id } }));
      const icicleHalo = available?.quickSource?.id === "ruiner.cryomancer.2.icicle";
      const effectDamageDivisor = (drainLife ? 2 : 1) * (eclipseStars || icicleHalo ? 2 : 1);
      const areaDamage = value => eclipseStars || icicleHalo ? Math.ceil(adjustedDamage(value) / 2) : adjustedDamage(value);
      const effectDamageBase = Number(request.roll?.successes || 0) + bonus;
      const effectDamageBaseByTarget = Object.fromEntries(targets.map(target => [target.id, effectDamageBase + (thunderDischarge && hasEffect(scene, target, "negative.ошеломлен") ? Number(actor.tier || 1) : 0)]));
      const postDisplacements = armamentMode === "polearm" ? targets.map(target => ({ targetId: target.id, mode: "push", maximum: 3, name: "Древко", ruleId: "vagabond.master-at-arms.1", collisionDamagePerCell: 0 })) : breacherSkirmish ? targets.filter(target => distance(attackOrigin, target) <= 2).map(target => ({ targetId: target.id, mode: "push", maximum: 1, name: "Картечь", ruleId: "powerhouse.breacher.1", collisionDamagePerCell: 0 })) : [];
      const dragonslayerTear = action.name === "Завершение" && actionAttribute === "body" && Number(actor.techniques?.["powerhouse.dragonslayer"] || 0) >= 1 ? ["negative.разорван"] : [];
      const postSelfEffects = armamentMode === "blade" ? ["positive.усилен"] : [], postTargetEffects = armamentMode === "polearm" ? ["negative.подброшен", "negative.замедлен"] : armamentMode === "chain" ? ["negative.разорван", "negative.порчен"] : [];
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, declaredActionId: declaredAction.id, declaredActionName: declaredAction.name, name: armamentQuick ? `Стычка · ${armament.label}` : thunderDischarge ? "Разрядка" : eclipseStars ? "Затмить звезды" : zealotRupture ? "Так не должно было быть" : icicleHalo ? "Ледяной нимб" : action.name, attribute: actionAttribute, targetIds, allowEmptyTargets: zealotRupture, roll: clone(request.roll || null), damage: areaDamage(effectDamageBase), damageByTarget: Object.fromEntries(Object.entries(effectDamageBaseByTarget).map(([targetId, value]) => [targetId, areaDamage(value)])), effectDamageBase, effectDamageBaseByTarget, effectDamageDivisor, attackModifierIds: attackModifiers.selectedIds, attackModifierAdvantage: attackModifiers.advantage, attackModifierDestination: attackModifierDestination?.destination || null, actionTransform: attackModifiers.actionTransform, techniqueRuleId: armamentQuick ? "vagabond.master-at-arms.1" : null, armamentMode, successEffects: dragonslayerTear, postSelfEffects, postTargetEffects, thunderDischarge, eclipseStars, zealotRupture, zealotCells, icicleHalo, drainLife, postDisplacements, gunslingerBulletJuggle: gunslingerSkirmish && Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 3 && bulletsSpent >= 3 && targetIds.length === 1, knifeThrow: knifeThrow && Number(actor.techniques?.["vagabond.knife-juggler"] || 0) >= 2, overload: meisterOverload ? clone(events[0].payload.overload) : null } });
    }
  } else if (action.name === "Передышка") {
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: 1, sourceActionName: "Передышка", sourceActionId: action.id } });
  } else if (action.name === "Зарядка" && request.roll) {
    events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: Math.max(2, Number(request.roll.successes || 0)), sourceActionName: "Зарядка", sourceActionId: action.id } });
  } else if (action.name === "Скрыться") {
    const atEdge = actor.x === 0 || actor.y === 0 || actor.x === Number((scene.spaces || []).find(item => item.id === actor.space)?.width || 0) - 1 || actor.y === Number((scene.spaces || []).find(item => item.id === actor.space)?.height || 0) - 1;
    const currentTurnEvents = [];
    for (const event of scene.log || []) {
      if (event.type === "turn.start" && event.actorId === actor.id) break;
      currentTurnEvents.push(event);
    }
    const attacked = currentTurnEvents.some(event => event.actorId === actor.id && (event.type === "attack.pending" || (event.type === "action.prepare" && ["Стычка", "Заклинание", "Завершение"].includes(event.payload?.name))));
    if (!available?.quickSource?.ignoreRequirements && !atEdge) errors.push("Скрыться можно только на краю поля.");
    if (!available?.quickSource?.ignoreRequirements && attacked) errors.push("Нельзя Скрыться после Атаки в этом Ходу.");
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: action.id, participantIds: [actor.id] } });
  } else if (action.name === "Изучение") {
    if (targets.length !== 1) errors.push("Изучение выбирает одного врага.");
    if (targets.some(target => target.team === actor.team)) errors.push("Изучение выбирает врага.");
    if (targets.some(target => distance(actor, target) > Number(actor.attrs?.mind || 0))) errors.push(`Цель Изучения должна быть в пределах ${Number(actor.attrs?.mind || 0)} клеток.`);
    targets.forEach(target => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: effectIdByName(data, "Помечен"), sourceActionId: action.id } }));
    if (Number(actor.techniques?.["vagabond.cunning-fighter"] || 0) >= 1 && targets[0] && !(actor.techniqueState?.studiedActorIds || []).includes(targets[0].id)) events.push({ type: "technique.state", actorId: actor.id, payload: { key: "study", targetId: targets[0].id, ruleId: "vagabond.cunning-fighter.1.study", name: "Хитрый план" } });
  }
  if (mundaneLevel >= 3 && ["Передышка", "Зарядка"].includes(action.name)) {
    const provokeIds = [...new Set(request.provokeTargetIds || [])], wouldGain = action.name === "Передышка" ? 1 : Math.max(2, Number(request.roll?.successes || 0));
    const invalid = provokeIds.filter(id => { const target = actorById(scene, id); return !target || target.knockedOut || distance(actor, target) > 4; });
    if (provokeIds.length > wouldGain) errors.push(`Можно спровоцировать не больше ${wouldGain} персонажей.`);
    if (invalid.length) errors.push("Все цели «Перед лицом Запредельного» должны быть доступны в дальности 4.");
    provokeIds.forEach(targetId => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId, effect: "negative.спровоцирован", sourceActionId: "bulwark.mundane.3", participantIds: [actor.id, targetId] } }));
  }
  if (!["Стычка", "Заклинание", "Завершение"].includes(action.name)) events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: action.id, name: action.name, attribute: actionAttribute, text: action.text, targetIds, continuation: Boolean(available?.continuation) } });
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
    if (lastAction?.payload?.actionName !== rule.requires) reason = `Сначала используйте «${rule.requires}» и не совершайте между ними других действий.`;
    else if (!(data?.actions?.list || []).some(item => item.name === rule.action)) reason = `Базовое действие «${rule.action}» не найдено.`;
  }
  return { available: !reason, reason, rule: rule ? clone(rule) : null };
}

function prepareTechniqueCombo(scene, data, request = {}) {
  const status = techniqueComboStatus(scene, data, request.actorId, request.ruleId), rule = status.rule, actor = actorById(scene, request.actorId), errors = status.available ? [] : [status.reason];
  const action = rule ? (data?.actions?.list || []).find(item => item.name === rule.action) : null;
  if (errors.length) return { ok: false, errors, events: [], rule };

  const working = clone(scene), workingActor = actorById(working, actor.id), baseCost = actionCost(action);
  if (baseCost.resource === "ap") workingActor.ap = Number(workingActor.ap || 0) + Math.max(0, Number(baseCost.amount || 0) - Number(rule.apCost || 0));
  const priorAction = currentTurnEvents(scene, actor.id).find(event => event.actorId === actor.id && event.type === "action.prepare");
  const targetIds = [...new Set(request.targetIds || [])], roll = clone(request.roll || null);
  if (rule.sameTargets && JSON.stringify([...(priorAction?.payload?.targetIds || [])].sort()) !== JSON.stringify([...targetIds].sort())) errors.push(`«${rule.name}» должно выбрать те же цели, что и «${rule.requires}».`);
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
    actionPrepare.payload.combo = { ruleId: request.ruleId, requires: rule.requires, action: rule.action };
  }
  const pending = events.find(event => event.type === "attack.pending");
  if (pending) {
    const bonusDamage = rule.bonusDamageAttribute ? Number(actor.attrs?.[rule.bonusDamageAttribute] || 0) : 0;
    pending.payload.damage = Number(pending.payload.damage || 0) + bonusDamage;
    if (pending.payload.damageByTarget) Object.keys(pending.payload.damageByTarget).forEach(targetId => { pending.payload.damageByTarget[targetId] = Number(pending.payload.damageByTarget[targetId] || 0) + bonusDamage; });
    const displacements = Number(rule.postPush || 0) > 0 ? targetIds.map(targetId => ({ targetId, mode: "push", maximum: Number(rule.postPush), name: rule.name, ruleId: request.ruleId, collisionDamagePerCell: 0 })) : [];
    Object.assign(pending.payload, { name: rule.name, techniqueRuleId: request.ruleId, techniqueName: rule.name, postDisplacements: [...(pending.payload.postDisplacements || []), ...displacements], postSelfEffects: (rule.postSelfEffects || []).map(name => effectIdByName(data, name)) });
  }
  events.unshift({ type: "technique.prepare", actorId: actor.id, payload: { ruleId: request.ruleId, name: rule.name, cooldownTurns: 2, combo: `${rule.requires} -> ${rule.action}` } });
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
    const maxTargets = ENEMY_TARGET_LIMITS.has(rule.id) ? ENEMY_TARGET_LIMITS.get(rule.id) : Number(rule.maxTargets || 0);
    const fullRule = ENEMY_FULL_RULES.get(rule.id), stateOnly = ["pugilist-stance", "martial-perfection", "imposing-presence"].includes(fullRule?.type);
    const automation = ENEMY_AUTO_ATTACK_RULES.has(rule.id) ? "attack" : fullRule ? stateOnly ? "state" : "full" : ENEMY_AUTO_EFFECT_RULES.has(rule.id) ? "effect" : "assisted";
    let reason = "";
    if (actor.team !== "enemy") reason = "Это не противник";
    else if (actor.knockedOut) reason = "Противник выведен из строя";
    else if (scene.pendingAction) reason = "Сначала разрешите текущие Реакции";
    else if (!scene.activeActorId) reason = "Сначала начните Ход противника";
    else if (scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
    else if (actor.acted) reason = "Ход противника уже завершён";
    else if (Number(actor.ap || 0) < Number(rule.apCost || 1)) reason = `Нужно ${rule.apCost || 1} ОД`;
    else if ((actor.usedActions || []).includes(rule.id)) reason = "Это действие уже использовано в Раунде";
    else if (rule.kind === "trump" && actor.usedTrump) reason = "Козырь уже использован в этой Сцене";
    else if (rule.kind === "trump" && Number(scene.tension || 0) < Number(rule.tension || 0)) reason = `Нужно Напряжение ${rule.tension}`;
    return { ...clone(rule), maxTargets, automation, available: !reason, reason };
  });
}

function prepareEnemyRule(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId);
  const profile = actor ? enemyProfileById(data, actor.profileId) : null;
  const rule = profile?.rules?.find(item => item.id === request.ruleId);
  const available = actor && rule ? availableEnemyRules(scene, data, actor.id).find(item => item.id === rule.id) : null;
  const errors = [];
  if (!actor || !profile) errors.push("Не выбран профиль противника.");
  if (!rule) errors.push("Неизвестное действие противника.");
  if (available && !available.available) errors.push(available.reason);
  const fullRule = rule ? ENEMY_FULL_RULES.get(rule.id) : null;
  let targetIds = [...new Set(request.targetIds || [])];
  if (fullRule?.type === "regenerating-allies" && actor) targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.team === actor.team && (target.effects || []).some(effect => String(effect).includes("регенер"))).map(target => target.id);
  if (fullRule?.type === "corrupted-damage" && actor) targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && (target.effects || []).some(effect => String(effect).includes("порчен"))).map(target => target.id);
  const targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
  if (targets.length !== targetIds.length) errors.push("Одна из выбранных целей больше не находится на Сцене.");
  if (targets.some(target => target.knockedOut)) errors.push("Выведенный из боя персонаж не может быть целью действия.");
  const unavailableEffectTarget = actor && targets.find(target => !effectTargetingStatus(scene, actor.id, target.id).available);
  if (unavailableEffectTarget) errors.push(effectTargetingStatus(scene, actor.id, unavailableEffectTarget.id).reason);
  const space = actor && (scene.spaces || []).find(item => item.id === actor.space);
  const anchor = rule?.area?.length ? (rule.areaAnchor === "self" ? { x: actor?.x, y: actor?.y } : request.anchor) : null;
  const affectedCells = rule?.area?.length && space && Number.isInteger(Number(anchor?.x)) && Number.isInteger(Number(anchor?.y)) ? areaCells(space, anchor, rule.area) : [];
  if (rule?.area?.length && !affectedCells.length) errors.push("Укажите область действия на поле.");
  if (actor && rule?.areaAnchor !== "self" && rule?.range && anchor && Math.abs(actor.x - Number(anchor.x)) + Math.abs(actor.y - Number(anchor.y)) > Number(rule.range)) errors.push(`Область должна быть в пределах ${rule.range} клеток.`);
  if (affectedCells.length && targets.some(target => target.space !== actor.space || !affectedCells.includes(`${target.x},${target.y}`))) errors.push("Все выбранные цели должны находиться в области.");
  if (rule?.requiresTarget && !targets.length) errors.push(rule.kind === "attack" ? "Выберите хотя бы одну цель Атаки." : "Выберите цель действия.");
  if (actor && rule?.kind === "attack" && available?.automation === "attack" && targets.some(target => target.team === actor.team)) errors.push("Эта автоматизированная Атака может выбирать целью только другую сторону.");
  const attackModifiers = actor && rule?.kind === "attack" && available?.automation === "attack" ? attackModifierStatus(scene, actor.id, targetIds, request.attackModifierIds || []) : { available: !(request.attackModifierIds || []).length, reason: "Модификаторы доступны только Атаке, подключённой к общему окну Реакций.", selectedIds: [], advantage: 0 };
  if (!attackModifiers.available) errors.push(attackModifiers.reason);
  const maxTargets = Number(available?.maxTargets ?? rule?.maxTargets ?? 0);
  if (maxTargets && targets.length > maxTargets) errors.push(`Можно выбрать не больше ${maxTargets} целей.`);
  if (actor && rule?.adjacent && targets.some(target => distance(actor, target) > 1)) errors.push("Цель должна быть смежной.");
  if (actor && rule?.range && targets.some(target => distance(actor, target) > Number(rule.range))) errors.push(`Цель должна быть в пределах ${rule.range} клеток.`);
  if (fullRule?.type === "pugilist-stance" && (!Number.isInteger(Number(request.options?.stanceStep)) || Number(request.options.stanceStep) < 1 || Number(request.options.stanceStep) > 4)) errors.push("Выберите шаг Пассивa от 1 до 4.");
  const hasRoll = request.roll && Array.isArray(request.roll.rolls);
  const hasDirectDamage = Number.isFinite(Number(request.damage)) && Number(request.damage) >= 0;
  if (attackModifiers.selectedIds.length && !hasRoll) errors.push("Модификатор Преимущества требует бросок Атаки.");
  if (rule?.kind === "attack" && !hasRoll && !hasDirectDamage) errors.push("Для Атаки нужен бросок или прямой урон из профиля.");
  if (errors.length) return { ok: false, errors, events: [], rule: available || rule };
  const targetEffects = (rule.targetEffects || rule.effects || []).map(name => effectIdByName(data, name));
  const selfEffects = (rule.selfEffects || []).map(name => effectIdByName(data, name));
  const payload = { ruleId: rule.id, profileId: profile.id, name: rule.name, kind: rule.kind, targetIds, text: rule.text, reward: rule.reward, automation: available?.automation || (targetEffects.length || selfEffects.length ? "effect" : "assisted") };
  const events = [{ type: "enemy.action.prepare", actorId: actor.id, payload }, { type: "resource.spend", actorId: actor.id, payload: { resource: "ap", amount: Number(rule.apCost || 1) } }];
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
  if (fullRule?.type === "corrupted-damage") {
    const match = String(fullRule.formula).match(/^(\d+)\(\+(\d+)\)$/), perTarget = match ? Number(match[1]) + Math.max(0, Number(actor.tier || 1) - 1) * Number(match[2]) : 0;
    const amount = targetIds.length * perTarget;
    targets.forEach(target => events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount, sourceActionId: rule.id } }));
  }
  if (rule.kind === "attack" && payload.automation === "attack") {
    targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: rule.id } }));
    const tensionMultiplier = Number(ENEMY_AUTO_ATTACK_RULES.get(rule.id) || 0);
    const damage = hasRoll ? Number(request.roll.successes || 0) + Number(scene.tension || 0) * tensionMultiplier : Number(request.damage);
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: rule.id, enemyRuleId: rule.id, name: rule.name, targetIds, roll: hasRoll ? clone(request.roll) : null, damage, effects: targetEffects, reward: rule.reward || "", attackModifierIds: attackModifiers.selectedIds, attackModifierAdvantage: attackModifiers.advantage } });
  } else {
    if (rule.kind !== "attack" && ["effect", "full"].includes(payload.automation)) targets.forEach(target => targetEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: rule.id } })));
    if (rule.kind === "attack" && hasRoll) events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    events.push({ type: "enemy.action.resolve", actorId: actor.id, payload });
  }
  return { ok: true, errors: [], events, rule: available || clone(rule) };
}
