"use strict";

function reactionOptions(scene, data, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor || actor.knockedOut || scene.pendingAction?.responses?.[actorId]?.choice !== "pending") return [];
  const source = actorById(scene, scene.pendingAction.actorId);
  if (!source || source.knockedOut) return [];
  const defenses = actor.team === "enemy" ? [] : availableActions(scene, data, actorId).filter(action => action.reaction);
  return [{ id: "pass", name: "Без Реакции", available: true, reason: "Принять исходную Атаку без защиты", costModel: { amount: 0, resource: null } }, ...defenses];
}

function pendingActionStatus(scene) {
  const pending = scene?.pendingAction;
  if (!pending) return { exists: false, pending: null, source: null, targetIds: [], eligibleIds: [], unavailableIds: [], waitingIds: [], answeredIds: [], interruptedReason: "", canResolve: false, mustCancel: false };
  const source = actorById(scene, pending.actorId);
  const targetIds = [...new Set(pending.targetIds || [])];
  const eligibleIds = targetIds.filter(id => { const target = actorById(scene, id); return target && !target.knockedOut; });
  const unavailableIds = targetIds.filter(id => !eligibleIds.includes(id));
  const waitingIds = eligibleIds.filter(id => pending.responses?.[id]?.choice === "pending");
  const answeredIds = eligibleIds.filter(id => pending.responses?.[id]?.choice && pending.responses[id].choice !== "pending" && pending.responses[id].choice !== "unavailable");
  const interruptedReason = pending.interruptedReason || (!source ? "Атакующий больше не находится на Сцене" : source.knockedOut ? "Атакующий выведен из боя" : ""), emptyAllowed = Boolean(pending.allowEmptyTargets && targetIds.length === 0);
  return { exists: true, pending, source, targetIds, eligibleIds, unavailableIds, waitingIds, answeredIds, interruptedReason, canResolve: !interruptedReason && (eligibleIds.length > 0 || emptyAllowed) && waitingIds.length === 0, mustCancel: Boolean(interruptedReason) || (!emptyAllowed && eligibleIds.length === 0) };
}

function cancelPendingAction(scene, request = {}) {
  const status = pendingActionStatus(scene);
  if (!status.exists) return { ok: false, errors: ["Нет ожидающего действия."], events: [] };
  const reason = String(request.reason || status.interruptedReason || "Цепочка прервана Нарратором").slice(0, 240);
  const events = [];
  if (status.pending.drainLife && status.source) events.push({ type: "actor.state", actorId: status.source.id, payload: { key: "drainLife", value: false, sourceActionId: "ruiner.grim-ascendant.2" } });
  events.push({ type: "attack.clear", actorId: status.source?.id || null, payload: { pendingId: status.pending.id, cancelled: true, reason } });
  return { ok: true, errors: [], cancelled: true, events };
}

const POTION_EFFECTS = {
  "rage-fumes": "positive.усилен",
  "growth-serum": "positive.регенерирует",
  adrenaline: "positive.ускорен",
  "stone-skin": "positive.укреплен",
  "thorn-rot": "negative.порчен",
};

function respondRulePrompt(scene, data, request = {}) {
  const prompt = scene.pendingPrompt, actor = actorById(scene, prompt?.sourceActorId), target = actorById(scene, prompt?.targetId), choice = String(request.choice || "");
  const errors = [];
  if (!prompt || !actor) errors.push("Запрос правила больше не доступен.");
  if (prompt && !(prompt.options || []).includes(choice)) errors.push("Такого ответа нет в запросе правила.");
  if (errors.length) return { ok: false, errors, events: [] };
  const events = [{ type: "rule.respond", actorId: actor.id, payload: { promptId: prompt.id, choice, sourceActorId: actor.id, targetId: target?.id || null, participantIds: [actor.id, target?.id].filter(Boolean) } }];
  if (prompt.kind === "alchemist-mix") events.push({ type: "inventory.change", actorId: actor.id, payload: { item: `potion:${choice}`, delta: 1, sourceActionId: "altruist.alchemist.1" } });
  if (prompt.kind === "empath-calm" && choice !== "pass") {
    events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: target.id, effect: choice, sourceActionId: "altruist.empath.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "positive.усилен", sourceActionId: "altruist.empath.1", participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "grim-transform" && choice === "transform") {
    const lostHealth = Math.max(0, Number(actor.hp || 0) - 1);
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "grimUsed", value: true, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "grimTransformed", value: true, lostHealth, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "ap", amount: 2, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: lostHealth * 2, sourceActionId: "ruiner.grim-ascendant.1" } });
    for (const enemy of (scene.actors || []).filter(item => !item.knockedOut && item.team !== actor.team && distance(actor, item) <= 2)) {
      const destination = pushDestination(scene, enemy, actor, 3);
      if (destination.distance) {
        events.push({ type: "actor.move", actorId: enemy.id, payload: { space: enemy.space, x: destination.x, y: destination.y, movement: "Непостоянная мощь", forced: true, participantIds: [actor.id, enemy.id] } });
        events.push({ type: "actor.enter", actorId: enemy.id, payload: { space: enemy.space, x: destination.x, y: destination.y, movement: "Непостоянная мощь", forced: true } });
      }
    }
  }
  if (prompt.kind === "wisp-primary" && choice !== "pass") {
    if (Number(actor.techniques?.["altruist.will-o-wisp"] || 0) >= 3) {
      const secondOptions = ["single", ...Object.keys(WISP_TYPES).filter(id => id !== choice).flatMap(id => [`combine:${id}`, `split:${id}`])];
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-secondary`, kind: "wisp-secondary", sourceActorId: actor.id, title: "Парные духи", text: "Оставить один Дух, объединить два свойства или создать два отдельных Пламени?", options: secondOptions, context: { firstType: choice }, participantIds: [actor.id] } });
    } else {
      const spirit = WISP_TYPES[choice];
      events.push({ type: "marker.create", actorId: actor.id, payload: { id: `wisp-${prompt.id}`, space: actor.space, x: actor.x, y: actor.y, markerKind: "ritual", label: `Духовное пламя · ${spirit.label}`, color: "#ef9ac1", source: "altruist.will-o-wisp.1", ruleId: "altruist.will-o-wisp.1", duration: "scene", ownerActorId: actor.id, metadata: { spiritTypes: [choice], effectRules: [{ effect: spirit.effect, audience: spirit.audience }] } } });
    }
  }
  if (prompt.kind === "wisp-secondary") {
    const firstType = prompt.context?.firstType, [layout, secondType] = choice.split(":"), first = WISP_TYPES[firstType], second = WISP_TYPES[secondType];
    if (choice === "single" && first) events.push({ type: "marker.create", actorId: actor.id, payload: { id: `wisp-${prompt.id}-a`, space: actor.space, x: actor.x, y: actor.y, markerKind: "ritual", label: `Духовное пламя · ${first.label}`, color: "#ef9ac1", source: "altruist.will-o-wisp.1", ruleId: "altruist.will-o-wisp.1", duration: "scene", ownerActorId: actor.id, metadata: { spiritTypes: [firstType], effectRules: [{ effect: first.effect, audience: first.audience }] } } });
    else if (layout === "combine" && first && second) {
      events.push({ type: "marker.create", actorId: actor.id, payload: { id: `wisp-${prompt.id}-a`, space: actor.space, x: actor.x, y: actor.y, markerKind: "ritual", label: `Духовное пламя · ${first.label} + ${second.label}`, color: "#ef9ac1", source: "altruist.will-o-wisp.1", ruleId: "altruist.will-o-wisp.1", duration: "scene", ownerActorId: actor.id, metadata: { spiritTypes: [firstType, secondType], effectRules: [{ effect: first.effect, audience: first.audience }, { effect: second.effect, audience: second.audience }] } } });
    } else if (layout === "split" && first && second) {
      for (const [index, pair] of [[0, [firstType, first]], [1, [secondType, second]]]) events.push({ type: "marker.create", actorId: actor.id, payload: { id: `wisp-${prompt.id}-${index}`, space: actor.space, x: actor.x, y: actor.y, markerKind: "ritual", label: `Духовное пламя · ${pair[1].label}`, color: "#ef9ac1", source: "altruist.will-o-wisp.1", ruleId: "altruist.will-o-wisp.1", duration: "scene", ownerActorId: actor.id, metadata: { spiritTypes: [pair[0]], effectRules: [{ effect: pair[1].effect, audience: pair[1].audience }] } } });
    }
  }
  if (prompt.kind === "wisp-move-select" && choice !== "pass") events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "marker-move-cell", sourceActorId: actor.id, title: "Перемещение Пламени", text: "Выберите клетку в пределах 4 клеток.", options: ["cancel"], context: { markerId: choice, maxDistance: 4 }, participantIds: [actor.id] } });
  if (prompt.kind === "wisp-follow" && choice !== "pass") events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "marker-move-cell", sourceActorId: actor.id, targetId: target.id, title: "Пламя следует за союзником", text: `Выберите клетку, смежную с ${target.name}.`, options: ["cancel"], context: { markerId: choice, adjacentToActorId: target.id }, participantIds: [actor.id, target.id] } });
  if (prompt.kind === "wisp-stop" && choice === "stop") {
    const stop = prompt.context?.stopCell;
    events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "focus", amount: 1, sourceActionId: "altruist.will-o-wisp.2" } });
    events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: stop.x, y: stop.y, movement: "Дружелюбные духи", forced: true, participantIds: [actor.id, target.id] } });
    events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: stop.x, y: stop.y, movement: "Дружелюбные духи", forced: true } });
  }
  if (prompt.kind === "empath-rush" && choice === "rush") events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "empath-rush-cell", sourceActorId: actor.id, targetId: target.id, title: "Защитный отклик · Прорыв", text: `Выберите свободную клетку, смежную с ${target.name}, в пределах Скорости.`, options: ["cancel"], context: { targetId: target.id, maxDistance: Number(actor.speed || 0) }, participantIds: [actor.id, target.id] } });
  if (prompt.kind === "hunter-trap" && choice === "attack") {
    if (!target || target.knockedOut) return { ok: false, errors: ["Цель ловушки уже недоступна."], events: [] };
    const roll = request.roll;
    if (!roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Для Стычки от ловушки нужен бросок."], events: [] };
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: "action.атаки.стычка", actionName: "Стычка", name: "Стальные челюсти", targetIds: [target.id], quick: true, quickReaction: true, quickSource: { techniqueId: "disruptor.hunter", level: 1, name: "Стальные челюсти" } } });
    events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: "disruptor.hunter.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: "action.атаки.стычка", techniqueRuleId: "disruptor.hunter.1", techniqueName: "Стальные челюсти", name: "Стальные челюсти", targetIds: [target.id], roll: clone(roll), damage: Number(roll.successes || 0), effects: Number(actor.techniques?.["disruptor.hunter"] || 0) >= 2 ? ["negative.обездвижен"] : [], quickReaction: true, participantIds: [actor.id, target.id] } });
  }
  return { ok: true, errors: [], events };
}

function preparePromptPlacement(scene, request = {}) {
  const prompt = scene.pendingPrompt, actor = actorById(scene, prompt?.sourceActorId), marker = markerById(scene, prompt?.context?.markerId), target = actorById(scene, prompt?.targetId || prompt?.context?.targetId), destination = request.destination && { x: Number(request.destination.x), y: Number(request.destination.y) }, errors = [];
  const space = (scene.spaces || []).find(item => item.id === (marker?.space || actor?.space));
  if (!prompt || !actor || !["marker-move-cell", "empath-rush-cell", "reappear-cell"].includes(prompt.kind)) errors.push("Сейчас нет выбора клетки для правила.");
  if (!space || !destination || !Number.isInteger(destination.x) || !Number.isInteger(destination.y) || destination.x < 0 || destination.y < 0 || destination.x >= Number(space?.width || 0) || destination.y >= Number(space?.height || 0)) errors.push("Выберите клетку в пределах поля.");
  if (prompt?.kind !== "marker-move-cell" && (scene.actors || []).some(item => !item.knockedOut && item.id !== actor?.id && item.space === space?.id && item.x === destination?.x && item.y === destination?.y)) errors.push("Клетка занята.");
  if (prompt?.kind === "marker-move-cell") {
    if (!marker) errors.push("Духовное пламя больше не существует.");
    if (prompt.context?.maxDistance && marker && distance(marker, { ...destination, space: marker.space }) > Number(prompt.context.maxDistance)) errors.push(`Маркер можно переместить не дальше ${prompt.context.maxDistance} клеток.`);
    const adjacent = actorById(scene, prompt.context?.adjacentToActorId);
    if (adjacent && distance(adjacent, { ...destination, space: adjacent.space }) !== 1) errors.push("Пламя должно оказаться смежно с союзником.");
  }
  if (prompt?.kind === "empath-rush-cell") {
    if (!target || distance(target, { ...destination, space: target.space }) !== 1) errors.push("Прорыв должен закончиться смежно с союзником.");
    if (actor && movementPath(scene, actor.id, destination, { maxDistance: Number(prompt.context?.maxDistance || actor.speed || 0) }).length < 1) errors.push("До этой клетки нельзя добраться Прорывом.");
  }
  if (prompt?.kind === "reappear-cell" && (scene.actors || []).some(item => !item.knockedOut && item.id !== actor.id && item.space === actor.space && distance(item, { ...destination, space: actor.space }) <= 1)) errors.push("При появлении клетка не должна быть смежна с персонажем.");
  if (errors.length) return { ok: false, errors, events: [] };
  const events = [{ type: "rule.respond", actorId: actor.id, payload: { promptId: prompt.id, choice: "cell", sourceActorId: actor.id, targetId: target?.id || null, participantIds: [actor.id, target?.id].filter(Boolean) } }];
  if (prompt.kind === "marker-move-cell") events.push({ type: "marker.move", actorId: actor.id, payload: { markerId: marker.id, space: marker.space, x: destination.x, y: destination.y, movement: prompt.title, participantIds: [actor.id] } });
  else {
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: prompt.title, participantIds: [actor.id, target?.id].filter(Boolean) } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: prompt.title } });
    if (prompt.kind === "reappear-cell") events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: "reappear", participantIds: [actor.id] } });
  }
  return { ok: true, errors: [], events };
}

function preparePotionUse(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId), target = actorById(scene, request.targetId), potion = String(request.potion || ""), interaction = (data?.actions?.list || []).find(action => action.name === "Взаимодействие");
  const errors = [], stockKey = `potion:${potion}`;
  if (!actor || !target || !interaction) errors.push("Не найдены алхимик, цель или Взаимодействие.");
  if (actor && Number(actor.techniques?.["altruist.alchemist"] || 0) < 1) errors.push("Герой не владеет «Быстрой смесью».");
  if (actor && Number(actor.inventory?.[stockKey] || 0) < 1) errors.push("Такого Зелья нет в запасе.");
  if (actor && target && distance(actor, target) > 4) errors.push("Зелье применяется в пределах 4 клеток.");
  const available = actor && interaction ? availableActions(scene, data, actor.id).find(action => action.id === interaction.id) : null;
  if (available && !available.available) errors.push(available.reason);
  if (errors.length) return { ok: false, errors, events: [] };
  const events = [
    { type: "technique.prepare", actorId: actor.id, payload: { ruleId: "altruist.alchemist.1", name: "Быстрая смесь", targetIds: [target.id], participantIds: [actor.id, target.id] } },
    { type: "action.prepare", actorId: actor.id, payload: { actionId: interaction.id, actionName: interaction.name, name: `Зелье: ${potion}`, targetIds: [target.id] } },
    { type: "resource.spend", actorId: actor.id, payload: actorActionCost(actor, interaction) },
    { type: "inventory.change", actorId: actor.id, payload: { item: stockKey, delta: -1, sourceActionId: "altruist.alchemist.1" } },
  ];
  if (potion === "pure-water") for (const effect of target.effects || []) events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: "altruist.alchemist.1", participantIds: [actor.id, target.id] } });
  else if (POTION_EFFECTS[potion]) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: POTION_EFFECTS[potion], sourceActionId: "altruist.alchemist.1", participantIds: [actor.id, target.id] } });
  if (Number(actor.techniques?.["altruist.alchemist"] || 0) >= 2) {
    if (target.team === actor.team) events.push({ type: "resource.gain", actorId: target.id, payload: { resource: "focus", amount: Math.ceil(Number(actor.attrs?.mind || 0) / 2), sourceActionId: "altruist.alchemist.2", participantIds: [actor.id, target.id] } });
    else events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount: Number(actor.attrs?.mind || 0), sourceActionId: "altruist.alchemist.2", participantIds: [actor.id, target.id] } });
  }
  events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: interaction.id, name: interaction.name, targetIds: [target.id] } });
  events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "altruist.alchemist.1", name: "Быстрая смесь", affectedActorIds: [target.id] } });
  return { ok: true, errors: [], events };
}

function prepareSurgery(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId), target = actorById(scene, request.targetId), skirmish = (data?.actions?.list || []).find(action => action.name === "Стычка"), roll = request.roll, errors = [];
  if (!actor || !target || !skirmish) errors.push("Не найдены хирург, союзник или Стычка.");
  if (actor && Number(actor.techniques?.["altruist.surgeon"] || 0) < 1) errors.push("Герой не владеет «Не навреди».");
  if (actor && target && (target.team !== actor.team || distance(actor, target) > 1)) errors.push("Оперировать можно только смежного союзника.");
  if (!roll || !Array.isArray(roll.rolls)) errors.push("Для операции нужен бросок Разума.");
  const available = actor && skirmish ? availableActions(scene, data, actor.id).find(action => action.id === skirmish.id) : null;
  if (available && !available.available) errors.push(available.reason);
  if (errors.length) return { ok: false, errors, events: [] };
  const amount = Math.ceil(Number(roll.successes || 0) / 2);
  return { ok: true, errors: [], events: [
    { type: "technique.prepare", actorId: actor.id, payload: { ruleId: "altruist.surgeon.1", name: "Не навреди", targetIds: [target.id], participantIds: [actor.id, target.id] } },
    { type: "action.prepare", actorId: actor.id, payload: { actionId: skirmish.id, actionName: skirmish.name, name: "Не навреди", targetIds: [target.id] } },
    { type: "resource.spend", actorId: actor.id, payload: actorActionCost(actor, skirmish) },
    { type: "roll.public", actorId: actor.id, payload: clone(roll) },
    { type: "actor.heal", actorId: actor.id, payload: { targetId: target.id, amount, sourceActionId: "altruist.surgeon.1", participantIds: [actor.id, target.id] } },
    { type: "action.resolve", actorId: actor.id, payload: { actionId: skirmish.id, name: "Не навреди", targetIds: [target.id] } },
    { type: "technique.resolve", actorId: actor.id, payload: { ruleId: "altruist.surgeon.1", name: "Не навреди", affectedActorIds: [target.id] } },
  ] };
}

function respondReaction(scene, data, request = {}) {
  const pending = scene.pendingAction;
  const actor = actorById(scene, request.actorId);
  const option = reactionOptions(scene, data, request.actorId).find(item => item.id === request.choice || item.name === request.choice);
  const errors = [];
  if (!pending || !actor) errors.push("Нет ожидающей Реакции для персонажа.");
  if (!option) errors.push("Неизвестный ответ на Реакцию.");
  if (option && !option.available) errors.push(option.reason || "Реакция недоступна.");
  if (option?.name === "Уворот") {
    const destination = request.destination;
    const space = (scene.spaces || []).find(item => item.id === actor?.space);
    const path = actor && destination ? movementPath(scene, actor.id, destination, { maxDistance: 2 }) : [];
    if (!destination || !space || !path.length || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Для Уворота выберите достижимую свободную клетку в пределах 2 клеток.");
    else if ((scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка Уворота занята.");
  }
  if (option?.name === "Столкновение") {
    const source = actorById(scene, pending?.actorId);
    const clash = request.clash;
    if (!source) errors.push("Атакующий для Столкновения не найден.");
    else if (distance(actor, source) > 5) errors.push("Атакующий вне дальности Стычки или Заклинания для Столкновения.");
    if (!clash?.defenderRoll || !clash?.attackerRoll || !Array.isArray(clash.defenderRoll.rolls) || !Array.isArray(clash.attackerRoll.rolls)) errors.push("Для Столкновения нужны оба встречных броска.");
  }
  if (errors.length) return { ok: false, errors, events: [] };
  const events = [];
  const untouchableEvasion = option?.name === "Уворот" && Number(actor?.techniques?.["vagabond.untouchable"] || 0) >= 1 && !currentRoundEvents(scene).some(event => event.type === "reaction.respond" && event.actorId === actor.id && event.payload?.choice === "Уворот" && Number(event.payload?.untouchableEvasion || 0) > 0) ? Math.ceil(Number(actor.attrs?.talent || 0) / 2) : 0;
  if (option.costModel?.resource && option.costModel.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: option.costModel });
  if (option.name === "Уворот") {
    const path = movementPath(scene, actor.id, request.destination, { maxDistance: 2 });
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y, movement: "Уворот", path: path.map(cellKey) } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y } });
  }
  let responseDestination = request.destination || null;
  if (option.name === "Блок") {
    const source = actorById(scene, pending.actorId), space = (scene.spaces || []).find(item => item.id === actor.space);
    const dx = actor.x - Number(source?.x), dy = actor.y - Number(source?.y), ax = Math.abs(dx), ay = Math.abs(dy), diagonal = ax && ay && Math.min(ax, ay) / Math.max(ax, ay) >= Math.SQRT2 - 1, directions = [];
    if (diagonal) directions.push({ x: Math.sign(dx), y: Math.sign(dy) });
    else if (ax >= ay && dx) directions.push({ x: Math.sign(dx), y: 0 });
    else if (dy) directions.push({ x: 0, y: Math.sign(dy) });
    const terrain = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "terrain").flatMap(object => object.cells || []));
    const destination = directions.map(direction => ({ x: actor.x + direction.x, y: actor.y + direction.y })).find(point => point.x >= 0 && point.y >= 0 && point.x < Number(space?.width || 0) && point.y < Number(space?.height || 0) && !(scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === point.x && item.y === point.y));
    if (destination && !terrain.has(cellKey(destination))) {
      responseDestination = destination;
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Блок · отталкивание" } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y } });
    }
  }
  let clash = null;
  if (option.name === "Столкновение") {
    const defenderRoll = clone(request.clash.defenderRoll), attackerRoll = clone(request.clash.attackerRoll);
    const defenderWins = Number(defenderRoll.successes || 0) > Number(attackerRoll.successes || 0);
    clash = { defenderRoll, attackerRoll, defenderWins };
    events.push({ type: "roll.public", actorId: actor.id, payload: { ...defenderRoll, outcome: defenderWins ? "Столкновение выиграно: исходная Атака отменена" : "Столкновение проиграно" } });
    events.push({ type: "roll.public", actorId: pending.actorId, payload: { ...attackerRoll, outcome: defenderWins ? "Столкновение проиграно" : "Столкновение выиграно" } });
  }
  events.push({ type: "reaction.respond", actorId: actor.id, payload: { choice: option.id === "pass" ? "pass" : option.name, destination: responseDestination, clash, untouchableEvasion, participantIds: [pending.actorId, actor.id] } });
  return { ok: true, errors: [], events };
}

function resolvePendingAction(scene, data) {
  const status = pendingActionStatus(scene), pending = status.pending;
  const errors = [];
  if (!pending) errors.push("Нет ожидающего действия.");
  if (errors.length) return { ok: false, errors, events: [] };
  if (status.mustCancel) return cancelPendingAction(scene, { reason: status.interruptedReason || "Все цели Атаки уже недоступны" });
  if (status.waitingIds.length) errors.push("Не все доступные цели ответили на Реакцию.");
  if (errors.length) return { ok: false, errors, events: [] };
  const source = status.source;
  const events = [];
  if (pending.roll) events.push({ type: "roll.public", actorId: pending.actorId, payload: pending.roll });
  for (const targetId of status.eligibleIds) {
    const target = actorById(scene, targetId);
    const reaction = pending.responses[targetId] || {}, response = reaction.choice;
    const body = Number(target?.attrs?.body || 0);
    const dodge = Math.ceil(Math.max(Number(target?.attrs?.talent || 0), Number(target?.attrs?.mind || 0)) / 2);
    if (!(response === "Столкновение" && reaction.clash?.defenderWins)) {
      const alliedGas = (scene.objects || []).find(object => object.type === "gas" && object.space === target.space && object.cells?.includes(`${target.x},${target.y}`) && actorById(scene, object.ownerActorId)?.team === target.team);
      const sourceInsideGas = alliedGas && source?.space === alliedGas.space && alliedGas.cells?.includes(`${source.x},${source.y}`);
      const gasEvasion = alliedGas && !sourceInsideGas ? 3 : 0;
      const fortifiedArmor = hasEffect(scene, target, "positive.укреплен") ? Number(target.tier || 1) : 0, temporaryArmor = (response === "Блок" ? body : 0) + fortifiedArmor, temporaryEvasion = (response === "Уворот" ? dodge + Number(reaction.untouchableEvasion || 0) : 0) + gasEvasion;
      const rawDamage = pending.damageByTarget && Number.isFinite(Number(pending.damageByTarget[targetId])) ? Number(pending.damageByTarget[targetId]) : Number(pending.damage || 0), raw = Math.max(0, rawDamage), armor = Math.max(0, Number(target?.armor || 0) + temporaryArmor), afterArmor = raw > 0 ? Math.max(1, raw - armor) : 0, evasion = Math.max(0, Number(target?.evasion || 0) + temporaryEvasion), expectedDamage = Math.max(0, afterArmor - Math.min(afterArmor, evasion));
      events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId, amount: rawDamage, temporaryArmor, temporaryEvasion, sourceActionId: pending.actionId, participantIds: [pending.actorId, targetId] } });
      if (expectedDamage > 0) for (const effect of pending.effects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect, sourceActionId: pending.actionId } });
      if (expectedDamage > 0 && pending.postPush?.targetId === targetId) {
        const destination = pushDestination(scene, target, source, Number(pending.postPush.maximum || 99));
        if (destination.distance) {
          events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: pending.postPush.name || "Принудительное движение", forced: true, participantIds: [pending.actorId, target.id] } });
          events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: pending.postPush.name || "Принудительное движение", forced: true } });
          events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId, amount: destination.distance, ignoreArmor: true, sourceActionId: pending.postPush.ruleId || pending.actionId, participantIds: [pending.actorId, target.id] } });
        }
      }
    }
  }
  if (pending.drainLife && source) {
    if (Number(pending.roll?.successes || 0) > 0) events.push({ type: "effect.apply", actorId: source.id, payload: { targetId: source.id, effect: "positive.регенерирует", sourceActionId: "ruiner.grim-ascendant.2", participantIds: [source.id] } });
    events.push({ type: "actor.state", actorId: source.id, payload: { key: "drainLife", value: false, sourceActionId: "ruiner.grim-ascendant.2" } });
  }
  if (pending.createTerrain?.cells?.length && source) pending.createTerrain.cells.forEach((cell, index) => events.push({ type: "area.create", actorId: source.id, payload: { id: `terrain-${pending.id}-${index}`, space: source.space, areaType: "terrain", label: pending.createTerrain.label || "Высокая местность", source: pending.createTerrain.ruleId, ruleId: pending.createTerrain.ruleId, duration: "scene", ownerActorId: source.id, cells: [cell], hp: Number(pending.createTerrain.hp || 10), maxHp: Number(pending.createTerrain.hp || 10), participantIds: [source.id, ...status.eligibleIds] } }));
  const targetedCells = [...new Set([...(pending.targetCells || []), ...status.eligibleIds.map(id => actorById(scene, id)).filter(Boolean).map(cellKey)])];
  if (targetedCells.length && source) {
    for (const marker of (scene.markers || []).filter(item => item.space === source.space && targetedCells.includes(`${item.x},${item.y}`) && /altruist\.will-o-wisp\.1/.test(`${item.ruleId || ""} ${item.source || ""}`))) {
      const destination = pushDestination(scene, marker, source, 1);
      if (destination.distance) events.push({ type: "marker.move", actorId: marker.ownerActorId, payload: { markerId: marker.id, space: marker.space, x: destination.x, y: destination.y, movement: "Атака по Духовному пламени", participantIds: [source.id, marker.ownerActorId] } });
    }
  }
  events.push({ type: pending.enemyRuleId ? "enemy.action.resolve" : "action.resolve", actorId: pending.actorId, payload: pending.enemyRuleId ? { ruleId: pending.enemyRuleId, name: pending.name, kind: "attack", targetIds: status.eligibleIds, skippedTargetIds: status.unavailableIds, reward: pending.reward || "" } : { actionId: pending.actionId, name: pending.name, targetIds: status.eligibleIds, skippedTargetIds: status.unavailableIds } });
  if (pending.techniqueRuleId) events.push({ type: "technique.resolve", actorId: pending.actorId, payload: { ruleId: pending.techniqueRuleId, name: pending.techniqueName || pending.name, affectedActorIds: status.eligibleIds, skippedTargetIds: status.unavailableIds } });
  events.push({ type: "attack.clear", actorId: source?.id || pending.actorId, payload: { pendingId: pending.id } });
  return { ok: true, errors: [], events };
}
