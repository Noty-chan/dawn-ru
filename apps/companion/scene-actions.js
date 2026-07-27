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
  for (const rule of QUICK_ACTION_RULES.filter(item => item.action === action.name && Number(actor.techniques?.[item.techniqueId] || 0) >= item.level)) {
    if (rule.condition === "firstTurn" && usesThisTurn > 0) continue;
    const technique = (data.archetypes || []).flatMap(archetype => archetype.techniques || []).find(item => item.id === rule.techniqueId);
    const level = technique?.levels?.find(item => Number(item.n) === rule.level);
    if (technique && level) sources.push({ id: rule.id, techniqueId: technique.id, level: rule.level, name: level.name, condition: rule.condition, needsConfirmation: false, text: level.text });
  }
  return sources;
}

function availableActions(scene, data, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor) return [];
  return (data?.actions?.list || []).map(action => {
    const cost = actorActionCost(actor, action);
    const reaction = action.group === "Защита" || action.en === "Реакция";
    const quickSource = quickActionSources(scene, data, actor, action)[0] || null;
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
    else if (!reaction && !scene.activeActorId) reason = "Сначала начните Ход";
    else if (!reaction && scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
    else if (!reaction && actor.acted) reason = "Ход уже завершён";
    else if (!reaction && action.name === "Шаг" && actor.speedZeroUntilTurnEnd) reason = "Скорость равна 0 до конца текущего Хода";
    else if (!reaction && (actor.usedActions || []).includes(action.id) && !continuation && !quick) reason = "Это действие уже использовано в Раунде";
    else if (effectiveCost.resource && Number(actor[effectiveCost.resource] || 0) < effectiveCost.amount) reason = `Недостаточно: ${action.cost}`;
    return { ...clone(action), costModel: effectiveCost, reaction, automation, quick, quickSource, continuation, remaining: continuation ? Number(actor.stepRemaining || 0) : null, available: !reason, reason };
  });
}

function cunningPlanStatus(scene, data, actorId, actionId) {
  const actor = actorById(scene, actorId), action = actionById(data, actionId);
  if (!actor || !action) return { available: false, reason: "Действие не найдено.", segments: 0, unlimited: false };
  const level = Number(actor.techniques?.["vagabond.cunning-fighter"] || 0), segments = Number(actor.techniqueState?.cunningPlan || 0), unlimited = level >= 2;
  const attack = ["Стычка", "Заклинание", "Завершение"].includes(action.name) || action.group === "Атаки";
  const usedThisTurn = currentTurnEvents(scene, actor.id).some(event => event.type === "technique.state" && event.payload?.ruleId === "vagabond.cunning-fighter.1.plan");
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
  const action = actionById(data, request.actionId);
  const errors = [];
  if (!actor) errors.push("Не выбран исполнитель действия.");
  if (!action) errors.push("Неизвестное базовое действие.");
  let available = actor && action ? availableActions(scene, data, actor.id).find(item => item.id === action.id) : null;
  const planStatus = actor && action ? cunningPlanStatus(scene, data, actor.id, action.id) : null;
  if (request.useCunningPlan) {
    if (!planStatus?.available) errors.push(planStatus?.reason || "Хитрый план сейчас недоступен.");
    else if (available?.reason && !/^(Это действие уже использовано|Недостаточно:)/.test(available.reason)) errors.push(available.reason);
    else {
      const discounted = { amount: planStatus.discountedCost, resource: actionCost(action).resource };
      available = { ...available, available: true, reason: "", quick: true, continuation: false, costModel: discounted, quickSource: { techniqueId: "vagabond.cunning-fighter", level: 1, name: "План и исполнение", needsConfirmation: false } };
    }
  }
  if (available && !available.available) errors.push(available.reason);
  if (errors.length) return { ok: false, errors, events: [] };

  const targetIds = [...new Set(request.targetIds || [])];
  const targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
  const attackNames = new Set(["Стычка", "Заклинание", "Завершение"]), spellcrafterLevel = Number(actor.techniques?.["ruiner.spellcrafter"] || 0), spellModifiers = spellcrafterLevel && ["Заклинание", "Завершение"].includes(action.name) ? [...new Set(actor.techniqueState?.spellModifiers || [])] : [], modifierResource = spellcrafterLevel >= 2 ? "focus" : "innovationCharges";
  if (attackNames.has(action.name) && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 1 && Number(actor.creationMarks || 0) > 0) errors.push("С Метками творения выберите соответствующую форму Атаки в разделе Техники: все Метки должны быть потрачены.");
  if (targets.length !== targetIds.length) errors.push("Одна из выбранных целей больше не находится на Сцене.");
  if (targets.some(target => target.knockedOut)) errors.push("Выведенный из боя персонаж не может быть целью действия.");
  if (spellModifiers.length > (spellcrafterLevel >= 3 ? 2 : 1)) errors.push("Этот Уровень Творца заклинаний не позволяет столько Модификаций.");
  if (spellModifiers.some(mod => ["focused", "wild"].includes(mod))) errors.push("Сфокусированная и Дикая Модификации применяются через зональный конструктор Техники.");
  if (spellModifiers.length && Number(actor[modifierResource] || 0) < spellModifiers.length) errors.push(`Недостаточно ресурса для ${spellModifiers.length} Модификаций.`);
  const events = [{ type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, actionName: action.name, name: action.name, targetIds, quick: Boolean(available?.quick), quickSource: available?.quickSource ? { techniqueId: available.quickSource.techniqueId, level: available.quickSource.level, name: available.quickSource.name, needsConfirmation: available.quickSource.needsConfirmation } : null, continuation: Boolean(available?.continuation) } }];
  if (request.useCunningPlan) events.push({ type: "technique.state", actorId: actor.id, payload: { key: "cunningPlan", delta: -1, ruleId: "vagabond.cunning-fighter.1.plan", name: "План и исполнение" } });
  const cost = available?.costModel || actorActionCost(actor, action);
  if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });
  if (spellModifiers.length) {
    events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: modifierResource, amount: spellModifiers.length, sourceActionId: "ruiner.spellcrafter" } });
    events.push({ type: "technique.state", actorId: actor.id, payload: { key: "spellModifiers", value: [], ruleId: "ruiner.spellcrafter", name: "Модификации применены" } });
    events[0].payload.spellModifiers = spellModifiers;
  }

  if (["Шаг", "Прыжок"].includes(action.name)) {
    const destination = request.destination;
    const space = (scene.spaces || []).find(item => item.id === actor.space);
    const accelerated = hasEffect(scene, actor, "positive.ускорен"), slowed = hasEffect(scene, actor, "negative.замедлен"), baseMovement = action.name === "Прыжок" ? Number(actor.attrs?.talent || 0) : actor.speedZeroUntilTurnEnd ? 0 : available?.continuation ? Number(actor.stepRemaining || 0) : Number(actor.speed || 0), moveLimit = Math.max(0, accelerated ? baseMovement * 2 : slowed ? Math.floor(baseMovement / 2) : baseMovement);
    if (!destination || !space || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Выберите свободную клетку назначения.");
    else if ((scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка назначения занята.");
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
        events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: resolvedDestination.x, y: resolvedDestination.y, movement: action.name, path: path.map(cellKey), interruptedByTrap: Boolean(trapCell) } });
        events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: resolvedDestination.x, y: resolvedDestination.y, movement: action.name, ignoreDifficult: action.name === "Прыжок" } });
      }
    }
  } else if (["Стычка", "Заклинание", "Завершение"].includes(action.name)) {
    const limit = (action.name === "Заклинание" ? 5 : 1) + (spellModifiers.includes("outstanding") ? Number(actor.attrs?.mind || 0) : 0);
    const disappeared = hasEffect(scene, actor, "positive.исчез");
    let attackOrigin = actor;
    if (disappeared) {
      const destination = request.destination, space = (scene.spaces || []).find(item => item.id === actor.space);
      if (!destination || !space || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("При выходе из Исчезновения выберите клетку появления.");
      else if ((scene.actors || []).some(item => !item.knockedOut && item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка появления занята.");
      else if (Number(actor.techniques?.["vagabond.assassin"] || 0) < 2 && (scene.actors || []).some(item => !item.knockedOut && item.id !== actor.id && item.space === actor.space && distance(item, { ...destination, space: actor.space }) <= 1)) errors.push("При появлении клетка не должна быть смежна с персонажем.");
      else {
        attackOrigin = { ...actor, x: destination.x, y: destination.y };
        events.splice(1, 0, { type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: Number(actor.techniques?.["vagabond.assassin"] || 0) >= 2 ? "Ликвидация" : "Появление", participantIds: [actor.id, ...targetIds] } });
        events.splice(2, 0, { type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Появление" } });
      }
    }
    if (!targets.length) errors.push("Выберите цель атаки.");
    if (targets.some(target => target.team === actor.team)) errors.push("Базовая Атака может выбирать целью только противника.");
    if (action.name === "Стычка" && targets.length > 2) errors.push("Стычка выбирает не больше 2 целей.");
    if (action.name !== "Стычка" && targets.length > 1) errors.push(`${action.name} выбирает только одну цель.`);
    if (targets.some(target => distance(attackOrigin, target) > limit)) errors.push(`Цель должна быть в пределах ${limit} клеток от клетки появления.`);
    targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: action.id } }));
    const effectDamage = (hasEffect(scene, actor, "positive.усилен") ? Number(actor.tier || 1) : 0) - (hasEffect(scene, actor, "negative.ослаблен") ? Number(actor.tier || 1) : 0), bonus = (action.name === "Завершение" ? Number(scene.tension || 0) : 0) + (spellModifiers.includes("fierce") ? Number(actor.attrs?.mind || 0) : 0) + effectDamage, drainLife = Boolean(actor.ruleState?.drainLife && action.name === "Завершение" && actor.ruleState?.grimTransformed), adjustedDamage = value => drainLife ? Math.ceil(Math.max(0, value) / 2) : Math.max(0, value);
    const markedBonusByTarget = Object.fromEntries(targets.map(target => [target.id, hasEffect(scene, target, "negative.помечен") ? Number(actor.tier || 1) : 0]));
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, name: action.name, targetIds, roll: clone(request.roll || null), damage: adjustedDamage(Number(request.roll?.successes || 0) + bonus), damageByTarget: Object.fromEntries(targets.map(target => [target.id, adjustedDamage(Number(request.roll?.successes || 0) + bonus + markedBonusByTarget[target.id])])), drainLife } });
  } else if (action.name === "Передышка") {
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 1 ? "creationMarks" : "focus", amount: 1 } });
  } else if (action.name === "Зарядка" && request.roll) {
    events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 1 ? "creationMarks" : "focus", amount: Math.max(2, Number(request.roll.successes || 0)) } });
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
  if (!["Стычка", "Заклинание", "Завершение"].includes(action.name)) events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: action.id, name: action.name, text: action.text, continuation: Boolean(available?.continuation) } });
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
  const prepared = prepareAction(working, data, { actorId: actor.id, actionId: action.id, targetIds: request.targetIds || [], destination: request.destination, roll: request.roll || null });
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
  if (pending) Object.assign(pending.payload, { name: rule.name, techniqueRuleId: request.ruleId, techniqueName: rule.name });
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
  const space = actor && (scene.spaces || []).find(item => item.id === actor.space);
  const anchor = rule?.area?.length ? (rule.areaAnchor === "self" ? { x: actor?.x, y: actor?.y } : request.anchor) : null;
  const affectedCells = rule?.area?.length && space && Number.isInteger(Number(anchor?.x)) && Number.isInteger(Number(anchor?.y)) ? areaCells(space, anchor, rule.area) : [];
  if (rule?.area?.length && !affectedCells.length) errors.push("Укажите область действия на поле.");
  if (actor && rule?.areaAnchor !== "self" && rule?.range && anchor && Math.abs(actor.x - Number(anchor.x)) + Math.abs(actor.y - Number(anchor.y)) > Number(rule.range)) errors.push(`Область должна быть в пределах ${rule.range} клеток.`);
  if (affectedCells.length && targets.some(target => target.space !== actor.space || !affectedCells.includes(`${target.x},${target.y}`))) errors.push("Все выбранные цели должны находиться в области.");
  if (rule?.requiresTarget && !targets.length) errors.push(rule.kind === "attack" ? "Выберите хотя бы одну цель Атаки." : "Выберите цель действия.");
  if (actor && rule?.kind === "attack" && available?.automation === "attack" && targets.some(target => target.team === actor.team)) errors.push("Эта автоматизированная Атака может выбирать целью только другую сторону.");
  const maxTargets = Number(available?.maxTargets ?? rule?.maxTargets ?? 0);
  if (maxTargets && targets.length > maxTargets) errors.push(`Можно выбрать не больше ${maxTargets} целей.`);
  if (actor && rule?.adjacent && targets.some(target => distance(actor, target) > 1)) errors.push("Цель должна быть смежной.");
  if (actor && rule?.range && targets.some(target => distance(actor, target) > Number(rule.range))) errors.push(`Цель должна быть в пределах ${rule.range} клеток.`);
  if (fullRule?.type === "pugilist-stance" && (!Number.isInteger(Number(request.options?.stanceStep)) || Number(request.options.stanceStep) < 1 || Number(request.options.stanceStep) > 4)) errors.push("Выберите шаг Пассивa от 1 до 4.");
  const hasRoll = request.roll && Array.isArray(request.roll.rolls);
  const hasDirectDamage = Number.isFinite(Number(request.damage)) && Number(request.damage) >= 0;
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
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: rule.id, enemyRuleId: rule.id, name: rule.name, targetIds, roll: hasRoll ? clone(request.roll) : null, damage, effects: targetEffects, reward: rule.reward || "" } });
  } else {
    if (rule.kind !== "attack" && ["effect", "full"].includes(payload.automation)) targets.forEach(target => targetEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: rule.id } })));
    if (rule.kind === "attack" && hasRoll) events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
    events.push({ type: "enemy.action.resolve", actorId: actor.id, payload });
  }
  return { ok: true, errors: [], events, rule: available || clone(rule) };
}
