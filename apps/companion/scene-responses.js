"use strict";

function reactionOptions(scene, data, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor || actor.knockedOut || scene.pendingAction?.responses?.[actorId]?.choice !== "pending") return [];
  const source = actorById(scene, scene.pendingAction.actorId);
  if (!source || source.knockedOut) return [];
  if (!effectTargetingStatus(scene, source.id, actor.id).available) return [];
  const effectDefense = effectDefenseStatus(scene, actorId);
  const defenses = actor.team === "enemy" ? [] : availableActions(scene, data, actorId).filter(action => action.reaction).map(action => action.name === "Уворот" && !effectDefense.dodgeAllowed ? { ...action, available: false, reason: effectDefense.dodgeReason } : action);
  return [{ id: "pass", name: "Без Реакции", available: true, reason: "Принять исходную Атаку без защиты", costModel: { amount: 0, resource: null } }, ...defenses];
}

function pendingActionStatus(scene) {
  const pending = scene?.pendingAction;
  if (!pending) return { exists: false, pending: null, source: null, targetIds: [], eligibleIds: [], unavailableIds: [], waitingIds: [], answeredIds: [], interruptedReason: "", canResolve: false, mustCancel: false };
  const source = actorById(scene, pending.actorId);
  const targetIds = [...new Set(pending.targetIds || [])];
  const eligibleIds = targetIds.filter(id => { const target = actorById(scene, id); return target && !target.knockedOut && effectTargetingStatus(scene, source?.id, target.id).available; });
  const unavailableIds = targetIds.filter(id => !eligibleIds.includes(id));
  const waitingIds = eligibleIds.filter(id => pending.responses?.[id]?.choice === "pending");
  const answeredIds = eligibleIds.filter(id => pending.responses?.[id]?.choice && pending.responses[id].choice !== "pending" && pending.responses[id].choice !== "unavailable");
  const sourcePresence = source ? effectPresenceStatus(scene, source.id) : null;
  const interruptedReason = pending.interruptedReason || (!source ? "Атакующий больше не находится на Сцене" : source.knockedOut ? "Атакующий выведен из боя" : !sourcePresence.onField ? sourcePresence.reason : ""), emptyAllowed = Boolean(pending.allowEmptyTargets && targetIds.length === 0);
  return { exists: true, pending, source, targetIds, eligibleIds, unavailableIds, waitingIds, answeredIds, interruptedReason, canResolve: !interruptedReason && (eligibleIds.length > 0 || emptyAllowed) && waitingIds.length === 0, mustCancel: Boolean(interruptedReason) || (!emptyAllowed && eligibleIds.length === 0) };
}

function ruleChoiceStatus(scene, request = {}) {
  const prompt = scene?.pendingPrompt, choice = String(request.choice || ""), source = actorById(scene, prompt?.sourceActorId), target = actorById(scene, prompt?.targetId);
  let reason = "";
  if (!prompt) reason = "Запрос правила больше не доступен.";
  else if (!source || source.knockedOut) reason = "Источник решения больше не доступен.";
  else if (!(prompt.options || []).includes(choice)) reason = "Такого ответа нет в запросе правила.";
  else if (prompt.targetId && (!target || target.knockedOut)) reason = "Цель решения больше не доступна.";
  return { available: !reason, reason, prompt: prompt ? clone(prompt) : null, source, target, choice, options: clone(prompt?.options || []) };
}

function pendingTargetOutcome(scene, pending, targetId) {
  const source = actorById(scene, pending?.actorId), target = actorById(scene, targetId), reaction = pending?.responses?.[targetId] || {}, response = reaction.choice;
  if (!pending || !source || !target || target.knockedOut) return { available: false, reason: "Источник или цель Атаки больше не доступны.", source, target, cancelled: true, rawDamage: 0, armor: 0, evasion: 0, expectedDamage: 0 };
  const clashCancelled = response === "Столкновение" && reaction.clash?.defenderWins, body = Number(target.attrs?.body || 0), dodge = Math.ceil(Math.max(Number(target.attrs?.talent || 0), Number(target.attrs?.mind || 0)) / 2);
  const alliedGas = (scene.objects || []).find(object => object.type === "gas" && object.space === target.space && object.cells?.includes(`${target.x},${target.y}`) && actorById(scene, object.ownerActorId)?.team === target.team), sourceInsideGas = alliedGas && source.space === alliedGas.space && alliedGas.cells?.includes(`${source.x},${source.y}`), gasEvasion = alliedGas && !sourceInsideGas ? 3 : 0;
  const defense = effectDefenseStatus(scene, target.id), temporaryArmor = response === "Блок" ? body : 0, temporaryEvasion = (response === "Уворот" ? dodge + Number(reaction.untouchableEvasion || 0) : 0) + gasEvasion;
  const rawDamage = pending.damageByTarget && Number.isFinite(Number(pending.damageByTarget[targetId])) ? Number(pending.damageByTarget[targetId]) : Number(pending.damage || 0), raw = Math.max(0, rawDamage), armor = defense.armorAllowed ? Math.max(0, Number(target.armor || 0) + temporaryArmor + defense.armorBonus) : 0, afterArmor = raw > 0 ? Math.max(1, raw - armor) : 0, evasion = Math.max(0, Number(target.evasion || 0) + temporaryEvasion), expectedDamage = clashCancelled ? 0 : Math.max(0, afterArmor - Math.min(afterArmor, evasion));
  return { available: true, reason: "", source, target, response, cancelled: clashCancelled, rawDamage, raw, armor, evasion, temporaryArmor, temporaryEvasion, afterArmor, expectedDamage };
}

function prepareInvisibleDisappear(scene, actorId) {
  const actor = actorById(scene, actorId), errors = [];
  if (!actor) errors.push("Персонаж не найден.");
  if (actor && scene.activeActorId !== actor.id) errors.push("Свободно Исчезнуть можно только в собственный Ход.");
  if (actor?.knockedOut) errors.push("Выведенный из боя персонаж не может Исчезнуть.");
  if (actor && !hasEffect(scene, actor, "positive.невидим")) errors.push("У персонажа нет Эффекта Невидим.");
  if (actor && hasEffect(scene, actor, "positive.исчез")) errors.push("Персонаж уже Исчез.");
  if (scene.pendingAction) errors.push("Сначала завершите текущую цепочку Реакций.");
  if (scene.pendingPrompt) errors.push("Сначала ответьте на сработавшее правило.");
  if (errors.length) return { ok: false, errors, events: [] };
  return { ok: true, errors: [], events: [
    { type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.невидим", suppressInvisibleReaction: true, sourceActionId: "positive.невидим", participantIds: [actor.id] } },
    { type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: "positive.невидим", participantIds: [actor.id] } },
  ] };
}

function prepareActionPlan(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId), action = actionById(data, request.actionId), context = clone(request.context || {}), errors = [];
  if (!actor) errors.push("Не выбран исполнитель составного действия.");
  if (!action) errors.push("Неизвестное действие для составного плана.");
  if (scene.pendingActionPlan || scene.pendingAction || scene.pendingPrompt) errors.push("Сначала завершите текущую цепочку правил.");
  if (actor && (actor.knockedOut || scene.activeActorId !== actor.id)) errors.push("Составное действие можно готовить только в собственный Ход.");
  if (actor && !hasEffect(scene, actor, "positive.исчез") && request.phase === "reappear") errors.push("Появление требуется только Исчезнувшему персонажу.");
  if (actor && action) {
    const available = availableActions(scene, data, actor.id).find(item => item.id === action.id);
    const planned = request.context?.useCunningPlan ? cunningPlanStatus(scene, data, actor.id, action.id) : null;
    if (request.context?.useCunningPlan ? !planned?.available : !available?.available) errors.push(planned?.reason || available?.reason || "Действие сейчас недоступно.");
    const attack = ["Стычка", "Заклинание", "Завершение"].includes(action.name), modifiers = attack ? attackModifierStatus(scene, actor.id, context.targetIds || [], context.attackModifierIds || [], { actionName: action.name }) : null;
    if (modifiers && !modifiers.available) errors.push(modifiers.reason);
    if (modifiers?.actionTransform) {
      const transformedAction = (data.actions?.list || []).find(item => item.name === modifiers.actionTransform.actionName), transformedAvailable = transformedAction && availableActions(scene, data, actor.id).find(item => item.id === transformedAction.id);
      if (!transformedAction) errors.push("Действие-замена модификатора не найдено.");
      else if (!transformedAvailable?.available && !/^Недостаточно:/.test(transformedAvailable?.reason || "")) errors.push(transformedAvailable?.reason || "Действие-замена сейчас недоступно.");
    }
    if (request.phase === "destination" && !modifiers?.requiresDestination && !["Шаг", "Прыжок"].includes(action.name)) errors.push("Это составное действие не требует клетки назначения.");
  }
  if (JSON.stringify(context).length > 8192) errors.push("Контекст составного действия слишком велик.");
  if (errors.length) return { ok: false, errors, events: [] };
  const planId = request.planId || `action-plan-${eventId()}`;
  return {
    ok: true,
    errors: [],
    plan: { id: planId, actorId: actor.id, actionId: action.id, actionName: action.name, phase: request.phase || "confirm", context },
    events: [{ type: "action.plan", actorId: actor.id, payload: { id: planId, actionId: action.id, actionName: action.name, phase: request.phase || "confirm", context, participantIds: [actor.id, ...(context.targetIds || [])] } }],
  };
}

function prepareActionPlanReappearance(scene, request = {}) {
  const status = actionPlanStatus(scene, request.actorId), plan = status.plan, actor = status.actor, destination = request.destination && { x: Number(request.destination.x), y: Number(request.destination.y) }, errors = [];
  if (!status.available) errors.push(status.reason);
  if (plan?.phase !== "reappear") errors.push("Составной план сейчас не ожидает появления.");
  if (actor && !hasEffect(scene, actor, "positive.исчез")) errors.push("Персонаж уже находится на поле.");
  const attack = ["Стычка", "Заклинание", "Завершение"].includes(plan?.actionName), assassination = attack && Number(actor?.techniques?.["vagabond.assassin"] || 0) >= 2;
  const modifiers = actor && plan ? attackModifierStatus(scene, actor.id, plan.context?.targetIds || [], plan.context?.attackModifierIds || [], { actionName: plan.actionName }) : null;
  if (modifiers && !modifiers.available) errors.push(modifiers.reason);
  const space = (scene.spaces || []).find(item => item.id === actor?.space);
  if (!space || !destination || !Number.isInteger(destination.x) || !Number.isInteger(destination.y) || destination.x < 0 || destination.y < 0 || destination.x >= Number(space?.width || 0) || destination.y >= Number(space?.height || 0)) errors.push("Выберите клетку появления в пределах поля.");
  if (actor && destination && !effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка появления занята.");
  if (!assassination && actor && destination && (scene.actors || []).some(item => item.id !== actor.id && effectPresenceStatus(scene, item.id).onField && item.space === actor.space && distance(item, { ...destination, space: actor.space }) <= 1)) errors.push("При появлении клетка не должна быть смежна с персонажем.");
  if (errors.length) return { ok: false, errors, events: [] };
  const action = plan.actionName, needsDestination = ["Шаг", "Прыжок"].includes(action) || Boolean(modifiers?.requiresDestination), nextPhase = needsDestination ? "destination" : "confirm", context = { ...(plan.context || {}), reappearance: { space: actor.space, x: destination.x, y: destination.y }, destinationKind: modifiers?.requiresDestination ? "attack-modifier" : needsDestination ? "movement" : null };
  const events = [{ type: "action.plan.update", actorId: actor.id, payload: { planId: plan.id, phase: nextPhase, context, participantIds: [actor.id, ...(context.targetIds || [])] } }];
  const preview = previewEvents(scene, events, { expectedVersion: scene.version });
  if (!preview.ok) return { ok: false, errors: preview.errors, events: [] };
  return { ok: true, errors: [], plan: { ...plan, phase: nextPhase, context }, events };
}

function prepareActionPlanModifierDestination(scene, request = {}) {
  const status = actionPlanStatus(scene, request.actorId), plan = status.plan, actor = status.actor, errors = [];
  if (!status.available) errors.push(status.reason);
  if (plan?.phase !== "destination") errors.push("Составной план сейчас не ожидает клетку модификатора.");
  const destination = request.destination && { x: Number(request.destination.x), y: Number(request.destination.y) };
  const placement = actor && plan ? attackModifierDestinationStatus(scene, actor.id, plan.context?.targetIds || [], plan.context?.attackModifierIds || [], destination, { actionName: plan.actionName, origin: plan.context?.reappearance || null }) : null;
  if (!placement?.available) errors.push(placement?.reason || "Клетку модификатора проверить не удалось.");
  if (errors.length) return { ok: false, errors, events: [] };
  const context = { ...(plan.context || {}), modifierDestination: { space: actor.space, x: destination.x, y: destination.y }, destinationKind: "attack-modifier" };
  const events = [{ type: "action.plan.update", actorId: actor.id, payload: { planId: plan.id, phase: "confirm", context, participantIds: [actor.id, ...(context.targetIds || [])] } }];
  const preview = previewEvents(scene, events, { expectedVersion: scene.version });
  if (!preview.ok) return { ok: false, errors: preview.errors, events: [] };
  return { ok: true, errors: [], plan: { ...plan, phase: "confirm", context }, events };
}

function prepareActionPlanContinuation(scene, data, request = {}) {
  const status = actionPlanStatus(scene, request.actorId), plan = status.plan, actor = status.actor, errors = [];
  if (!status.available) errors.push(status.reason);
  if (plan && !["confirm", "destination"].includes(plan.phase)) errors.push("Составной план ещё не готов к подтверждению.");
  const context = { ...(plan?.context || {}), ...(request.context || {}) }, reappearance = context.reappearance;
  if (!actor) errors.push("Исполнитель составного действия больше не находится на Сцене.");
  if (actor && hasEffect(scene, actor, "positive.исчез") && !reappearance) errors.push("В составном плане не выбрана клетка появления.");
  if (plan?.phase === "destination" && context.destinationKind === "movement" && !request.destination) errors.push("Выберите клетку назначения действия.");
  if (context.destinationKind === "attack-modifier" && !context.modifierDestination) errors.push("В составном плане не выбрана клетка модификатора.");
  if (errors.length) return { ok: false, errors, events: [] };
  const prefix = reappearance ? [
    { type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: reappearance.x, y: reappearance.y, movement: Number(actor.techniques?.["vagabond.assassin"] || 0) >= 2 && ["Стычка", "Заклинание", "Завершение"].includes(plan.actionName) ? "Ликвидация" : "Появление перед действием", placement: true, participantIds: [actor.id, ...(context.targetIds || [])] } },
    { type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: reappearance.x, y: reappearance.y, movement: "Появление перед действием", placement: true } },
    { type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: "core.composite-action.reappear", participantIds: [actor.id] } },
  ] : [];
  const staged = previewEvents(scene, prefix, { expectedVersion: scene.version });
  if (!staged.ok) return { ok: false, errors: staged.errors, events: [] };
  const prepared = prepareAction(staged.scene, data, { ...context, actorId: actor.id, actionId: plan.actionId, destination: request.destination || context.destination || null, attackModifierDestination: context.modifierDestination || null, planId: plan.id });
  if (!prepared.ok) return prepared;
  const events = [...prefix, ...prepared.events], preview = previewEvents(scene, events, { expectedVersion: scene.version });
  if (!preview.ok) return { ok: false, errors: preview.errors, events: [] };
  return { ...prepared, plan, events };
}

function cancelActionPlan(scene, request = {}) {
  const status = actionPlanStatus(scene, request.actorId);
  if (!status.plan) return { ok: false, errors: [status.reason], events: [] };
  if (request.actorId && status.plan.actorId !== request.actorId) return { ok: false, errors: ["Этот составной план принадлежит другому персонажу."], events: [] };
  return { ok: true, errors: [], events: [{ type: "action.plan.cancel", actorId: status.plan.actorId, payload: { planId: status.plan.id, reason: String(request.reason || "Отменено до оплаты.").slice(0, 240), participantIds: [status.plan.actorId] } }] };
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
  const choiceStatus = ruleChoiceStatus(scene, request), prompt = scene.pendingPrompt, actor = choiceStatus.source, target = choiceStatus.target, choice = choiceStatus.choice;
  const errors = choiceStatus.available ? [] : [choiceStatus.reason];
  if (errors.length) return { ok: false, errors, events: [] };
  const events = [{ type: "rule.respond", actorId: actor.id, payload: { promptId: prompt.id, choice, sourceActorId: actor.id, targetId: target?.id || null, participantIds: [actor.id, target?.id].filter(Boolean) } }];
  if (prompt.kind === "invisible-on-loss" && choice === "disappear") events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: "positive.невидим", participantIds: [actor.id] } });
  if (prompt.kind === "chronomancer-reapply-effect" && choice === "reapply") {
    if (!target || target.knockedOut) return { ok: false, errors: ["Цель повторного Эффекта больше недоступна."], events: [] };
    if (!resourceOperationStatus(scene, actor.id, { resource: "focus", amount: 1, operation: "spend" }).available) return { ok: false, errors: ["Для реакции Хрономанта больше не хватает Фокуса."], events: [] };
    events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "focus", amount: 1, sourceActionId: "altruist.chronomancer.2", participantIds: [actor.id, target.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: prompt.context?.effect, duration: prompt.context?.duration, removable: prompt.context?.removable !== false, sourceActionId: "altruist.chronomancer.2", participantIds: [actor.id, target.id] } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "altruist.chronomancer.2", name: "Замедление", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "braggart-wound-pride" && choice === "fill") events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "powerhouse.braggart.pride", delta: 1, sourceActionId: "powerhouse.braggart.3", reason: "Рана от достойного противника" } });
  if (prompt.kind === "braggart-hold-back" && choice === "hold-back") {
    const status = clockStatus(scene, actor.id, "powerhouse.braggart.pride"), size = Math.max(status.minimumSize, status.size - 2);
    events.push({ type: "rule-clock.configure", actorId: actor.id, payload: { ...status.definition, size, minimumSize: status.minimumSize, initial: 0, value: 0, active: true, sourceActionId: "powerhouse.braggart.2" } });
  }
  if (prompt.kind === "thunder-rest-static" && choice === "fill") events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "ruiner.thunder-blood.static", delta: Number(prompt.context?.amount || 2), sourceActionId: "ruiner.thunder-blood.1", reason: "Райден" } });
  if (prompt.kind === "cryomancer-icicle-rest" && choice === "convert") {
    const segments = clockStatus(scene, actor.id, "ruiner.cryomancer.icicle").value;
    if (segments < 1 || Number(actor.focus || 0) < 1) return { ok: false, errors: ["Сосулька или полученный Передышкой Фокус уже недоступны."], events: [] };
    events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "focus", amount: 1, sourceActionId: "ruiner.cryomancer.2", reason: "Отказ от Фокуса Передышки" } });
    events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: "ruiner.cryomancer.icicle", value: 0, sourceActionId: "ruiner.cryomancer.2" } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "icicleSpellsRemaining", value: segments, sourceActionId: "ruiner.cryomancer.2" } });
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-series`, kind: "cryomancer-icicle-series", sourceActorId: actor.id, title: "Ледяной нимб", text: `Доступно Быстрых Заклинаний: ${segments}. Продолжить серию?`, options: ["continue", "stop"], context: { remaining: segments }, participantIds: [actor.id] } });
  }
  if (prompt.kind === "cryomancer-icicle-series" && choice === "stop") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "icicleSpellsRemaining", value: 0, sourceActionId: "ruiner.cryomancer.2" } });
  if (prompt.kind === "thunder-charged-spell" && choice !== "pass") {
    const [mode, originalTargetId] = choice.split(":"), originalTarget = actorById(scene, originalTargetId);
    if (!["surge", "discharge", "chain"].includes(mode) || !originalTarget || originalTarget.knockedOut) return { ok: false, errors: ["Исходная цель Заряженного заклинания больше недоступна."], events: [] };
    if (mode === "chain") {
      const chainTargets = (scene.actors || []).filter(candidate => !candidate.knockedOut && candidate.team !== actor.team && candidate.id !== originalTarget.id && candidate.space === originalTarget.space && distance(originalTarget, candidate) <= 5);
      if (!chainTargets.length) return { ok: false, errors: ["Для Цепи больше нет допустимой второй цели."], events: [] };
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-chain-target`, kind: "thunder-chain-target", sourceActorId: actor.id, targetId: originalTarget.id, title: "Заряженное заклинание · Цепь", text: `Выберите другого врага в пределах 5 клеток от ${originalTarget.name}.`, options: chainTargets.map(target => `target:${target.id}`), context: { originalTargetId, optionLabels: Object.fromEntries(chainTargets.map(target => [`target:${target.id}`, target.name])) }, participantIds: [actor.id, originalTarget.id, ...chainTargets.map(target => target.id)] } });
    } else if (mode === "discharge") {
      events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "ruiner.thunder-blood.static", delta: -1, sourceActionId: "ruiner.thunder-blood.2", reason: "Разряд" } });
      events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.thunder-blood.2", participantIds: [actor.id] } });
      events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: originalTarget.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.thunder-blood.2", participantIds: [actor.id, originalTarget.id] } });
    } else {
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-surge-cell`, kind: "thunder-surge-cell", sourceActorId: actor.id, targetId: originalTarget.id, title: "Заряженное заклинание · Скачок", text: `Выберите свободную клетку, смежную с ${originalTarget.name}.`, options: ["cancel"], context: { targetId: originalTarget.id }, participantIds: [actor.id, originalTarget.id] } });
    }
  }
  if (prompt.kind === "thunder-chain-target" && choice.startsWith("target:")) {
    const originalTarget = actorById(scene, prompt.context?.originalTargetId), chainTarget = actorById(scene, choice.slice(7)), spell = (data?.actions?.list || []).find(action => action.name === "Заклинание"), roll = request.roll;
    if (!originalTarget || originalTarget.knockedOut || !chainTarget || chainTarget.knockedOut || chainTarget.team === actor.team || chainTarget.id === originalTarget.id || chainTarget.space !== originalTarget.space || distance(originalTarget, chainTarget) > 5) return { ok: false, errors: ["Цель Цепи больше не соответствует условиям правила."], events: [] };
    if (!spell || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Для Заклинания Цепи нужен бросок."], events: [] };
    events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "ruiner.thunder-blood.static", delta: -1, sourceActionId: "ruiner.thunder-blood.2", reason: "Цепь" } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.thunder-blood.2", participantIds: [actor.id] } });
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: spell.id, actionName: spell.name, name: "Заряженное заклинание · Цепь", targetIds: [chainTarget.id], quick: true, quickReaction: true, quickSource: { techniqueId: "ruiner.thunder-blood", level: 2, name: "Заряженное заклинание" } } });
    events.push({ type: "reaction.offer", actorId: chainTarget.id, payload: { sourceActorId: actor.id, actionId: "ruiner.thunder-blood.2", participantIds: [actor.id, chainTarget.id] } });
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: spell.id, techniqueRuleId: "ruiner.thunder-blood.2", techniqueName: "Заряженное заклинание", name: "Заряженное заклинание · Цепь", targetIds: [chainTarget.id], roll: clone(roll), damage: Number(roll.successes || 0), quickReaction: true, participantIds: [actor.id, chainTarget.id] } });
  }
  if (prompt.kind === "zealot-revelation-one" && choice === "fill") {
    events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "focus", amount: 1, sourceActionId: "ruiner.zealot.1" } });
    events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "ruiner.zealot.revelation", delta: 1, sourceActionId: "ruiner.zealot.1", actionInstanceId: prompt.context?.actionInstanceId || prompt.context?.rollEventId, reason: "Выпавшая 1" } });
  }
  if (prompt.kind === "egomaniac-style-full") {
    if (choice === "flow") {
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "ap", amount: 1, sourceActionId: "vagabond.egomaniac.1" } });
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-move`, kind: "egomaniac-style-move", sourceActorId: actor.id, title: "Пиковая форма: перемещение", text: "Выберите свободную клетку на прямой в пределах 2.", options: ["cancel"], context: { maxDistance: 2, straight: true }, participantIds: [actor.id] } });
      events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: "vagabond.egomaniac.style", value: 0, sourceActionId: "vagabond.egomaniac.1" } });
    } else {
      events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: "vagabond.egomaniac.style", value: 0, sourceActionId: "vagabond.egomaniac.2" } });
      const effect = choice === "provoke" ? "negative.спровоцирован" : "negative.испуган";
      for (const enemy of (scene.actors || []).filter(item => !item.knockedOut && item.team !== actor.team && distance(actor, item) <= 3)) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: enemy.id, effect, sourceActionId: "vagabond.egomaniac.2", participantIds: [actor.id, enemy.id] } });
    }
  }
  if (prompt.kind === "egomaniac-finale" && choice === "finale") {
    const style = clockStatus(scene, actor.id, "vagabond.egomaniac.style"), amount = Math.max(0, Number(scene.tension || 0) * 2), first = Math.min(amount, style.size - style.value);
    if (!style.active || amount < 1) return { ok: false, errors: ["Стиль уже потерян или Напряжение не даёт сегментов."], events: [] };
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "styleCarryRemaining", value: amount, sourceActionId: "vagabond.egomaniac.3" } });
    if (first > 0) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: style.id, delta: first, sourceActionId: "vagabond.egomaniac.3", reason: "Финал: перенос Стиля" } });
    else events.push({ type: "rule-clock.configure", actorId: actor.id, payload: { ...style.definition, value: style.value, active: false, sourceActionId: "vagabond.egomaniac.3" } });
  }
  if (prompt.kind === "zealot-watched" && choice === "invoke") {
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.усилен", sourceActionId: "ruiner.zealot.2", participantIds: [actor.id] } });
    for (const source of scene.actors || []) events.push({ type: "effect.apply", actorId: source.id, payload: { targetId: actor.id, effect: "negative.испуган", sourceActionId: "ruiner.zealot.2", participantIds: [source.id, actor.id] } });
  }
  if (prompt.kind === "gunslinger-reload" && choice === "reload") events.push({ type: "rule-resource.set", actorId: actor.id, payload: { resource: "bullets", value: 6, sourceActionId: "powerhouse.gunslinger.2" } });
  if (prompt.kind === "meister-overclock" && choice === "overclock") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "modifiedOverclockTurns", value: 2, sourceActionId: "vagabond.modified-meister.3" } });
  if (prompt.kind === "meister-explosion") {
    events.push({ type: "rule-resource.set", actorId: actor.id, payload: { resource: "heat", value: 3, sourceActionId: "vagabond.modified-meister.3" } });
    if (choice === "normal") {
      for (const targetId of prompt.context?.targetIds || []) events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId, amount: Number(actor.attrs?.mind || 0), sourceActionId: "vagabond.modified-meister.1", participantIds: [actor.id, targetId] } });
    } else {
      events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: actor.id, amount: Math.floor(Number(actor.attrs?.mind || 0) / 2), ignoreArmor: true, sourceActionId: "vagabond.modified-meister.3", participantIds: [actor.id] } });
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "ap", amount: 1, sourceActionId: "vagabond.modified-meister.3" } });
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-move`, kind: "meister-overclock-move", sourceActorId: actor.id, title: "Разгон: перемещение", text: "Выберите свободную клетку в пределах 3.", options: ["cancel"], context: { maxDistance: 3 }, participantIds: [actor.id] } });
    }
  }
  if (prompt.kind === "knife-pickup" && choice === "pickup") {
    const marker = markerById(scene, prompt.context?.markerId);
    if (!marker) return { ok: false, errors: ["Маркер Оружия уже отсутствует."], events: [] };
    events.push({ type: "marker.remove", actorId: actor.id, payload: { markerId: marker.id, sourceActionId: "vagabond.knife-juggler.2" } });
    events.push({ type: "rule-resource.gain", actorId: actor.id, payload: { resource: "weapons", amount: 1, sourceActionId: "vagabond.knife-juggler.2" } });
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-step`, kind: "knife-pickup-step", sourceActorId: actor.id, title: "Пополнение: шаг", text: "Выберите свободную клетку на расстоянии 1.", options: ["cancel"], context: { maxDistance: 1 }, participantIds: [actor.id] } });
  }
  if (prompt.kind === "knife-chaser" && choice === "chase") {
    const marker = markerById(scene, prompt.context?.markerId), roll = request.roll, skirmish = (data?.actions?.list || []).find(action => action.name === "Стычка");
    if (!marker || !target || target.knockedOut) return { ok: false, errors: ["Цель или маркер Преследователя уже недоступны."], events: [] };
    if ((scene.actors || []).some(item => !item.knockedOut && item.id !== actor.id && item.space === marker.space && item.x === marker.x && item.y === marker.y)) return { ok: false, errors: ["Клетка маркера Оружия занята: телепортация Преследователя невозможна."], events: [] };
    if (!roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Для Быстрой Стычки нужен бросок."], events: [] };
    const cost = actorActionCost(actor, skirmish);
    if (!resourceOperationStatus(scene, actor.id, { ...cost, operation: "spend" }).available) return { ok: false, errors: ["Стычку Преследователя больше нельзя оплатить."], events: [] };
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: marker.space, x: marker.x, y: marker.y, movement: "Преследователь", participantIds: [actor.id, target.id] } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: marker.space, x: marker.x, y: marker.y, movement: "Преследователь" } });
    if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: { ...cost, sourceActionId: "vagabond.knife-juggler.3" } });
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: skirmish.id, actionName: skirmish.name, name: "Преследователь", targetIds: [target.id], quick: true, quickReaction: true, quickSource: { techniqueId: "vagabond.knife-juggler", level: 3, name: "Преследователь" } } });
    events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: "vagabond.knife-juggler.3", participantIds: [actor.id, target.id] } });
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: skirmish.id, techniqueRuleId: "vagabond.knife-juggler.3", techniqueName: "Преследователь", name: "Преследователь", targetIds: [target.id], roll: clone(roll), damage: Number(roll.successes || 0), quickReaction: true, participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "feral-rage-jump-spell" && choice === "attack") {
    const spell = (data?.actions?.list || []).find(action => action.name === "Заклинание"), roll = request.roll;
    const targetIds = [...new Set(prompt.context?.targetIds || [])].filter(id => {
      const candidate = actorById(scene, id);
      return candidate && !candidate.knockedOut && candidate.id !== actor.id && candidate.space === actor.space && distance(actor, candidate) <= 1;
    });
    if (!spell || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Для обязательного Заклинания после Прыжка нужен бросок."], events: [] };
    if (!targetIds.length) return { ok: false, errors: ["После Прыжка больше нет смежных целей для Заклинания."], events: [] };
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: spell.id, actionName: spell.name, name: "Сорваться с цепи", targetIds, quick: true, quickReaction: true, quickSource: { techniqueId: "ruiner.feral-arcana", level: 2, name: "Сорваться с цепи" } } });
    targetIds.forEach(targetId => events.push({ type: "reaction.offer", actorId: targetId, payload: { sourceActorId: actor.id, actionId: "ruiner.feral-arcana.2", participantIds: [actor.id, targetId] } }));
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: spell.id, techniqueRuleId: "ruiner.feral-arcana.2", techniqueName: "Сорваться с цепи", name: "Сорваться с цепи", targetIds, roll: clone(roll), damage: Number(roll.successes || 0), quickReaction: true, participantIds: [actor.id, ...targetIds] } });
  }
  if (prompt.kind === "sentry-punishment" && choice !== "pass") {
    const skirmish = (data?.actions?.list || []).find(action => action.name === "Стычка"), roll = request.roll;
    if (!target || target.knockedOut || !skirmish || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Цель Наказания или бросок больше недоступны."], events: [] };
    if (choice === "punish-free") {
      if (clockStatus(scene, actor.id, "bulwark.stalwart-sentry.vigilance").value < 1) return { ok: false, errors: ["Бдительность уже пуста."], events: [] };
      events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "bulwark.stalwart-sentry.vigilance", delta: -1, sourceActionId: "bulwark.stalwart-sentry.2", reason: "Бесплатное Наказание" } });
    } else {
      const cost = actorActionCost(actor, skirmish);
      if (!resourceOperationStatus(scene, actor.id, { ...cost, operation: "spend" }).available) return { ok: false, errors: ["Наказание больше нельзя оплатить."], events: [] };
      if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: { ...cost, sourceActionId: "bulwark.stalwart-sentry.2" } });
    }
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: skirmish.id, actionName: skirmish.name, name: "Наказание", targetIds: [target.id], quick: true, quickReaction: true, quickSource: { techniqueId: "bulwark.stalwart-sentry", level: 2, name: "На посту" } } });
    events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: "bulwark.stalwart-sentry.2", participantIds: [actor.id, target.id] } });
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: skirmish.id, techniqueRuleId: "bulwark.stalwart-sentry.2", techniqueName: "На посту", name: "Наказание", targetIds: [target.id], roll: clone(roll), damage: Number(roll.successes || 0), quickReaction: true, participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "chronomancer-time-stop" && choice !== "pass") {
    const flow = clockStatus(scene, actor.id, "altruist.chronomancer.flow"), spell = (data?.actions?.list || []).find(action => action.name === "Заклинание"), roll = request.roll, allIn = choice === "time-stop-all-in";
    const targets = (scene.actors || []).filter(candidate => !candidate.knockedOut), enemies = targets.filter(candidate => candidate.team !== actor.team);
    if (!flow.full || actor.ruleState?.timeStopUsed || !spell || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Остановка времени больше недоступна или не имеет броска."], events: [] };
    if (allIn && enemies.length > 2) return { ok: false, errors: ["Ва-банк доступен только при двух или менее врагах."], events: [] };
    if (Number(actor.ap || 0) > 0) events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "ap", amount: Number(actor.ap), sourceActionId: "altruist.chronomancer.3" } });
    events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: flow.id, value: 0, sourceActionId: "altruist.chronomancer.3" } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "timeStopUsed", value: true, sourceActionId: "altruist.chronomancer.3" } });
    if (allIn) events.push({ type: "actor.wound", actorId: actor.id, payload: { targetId: actor.id, delta: 1, sourceActionId: "altruist.chronomancer.3", participantIds: [actor.id] } });
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: spell.id, actionName: spell.name, name: allIn ? "Остановка времени · Ва-банк" : "Остановка времени", targetIds: targets.map(target => target.id), quick: true, quickReaction: true, quickSource: { techniqueId: "altruist.chronomancer", level: 3, name: "Остановка времени" } } });
    targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: "altruist.chronomancer.3", participantIds: [actor.id, target.id] } }));
    const baseDamage = Number(roll.successes || 0), damageByTarget = Object.fromEntries(targets.map(target => [target.id, baseDamage + (allIn && target.team !== actor.team ? Number(scene.tension || 0) : 0)]));
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: spell.id, techniqueRuleId: "altruist.chronomancer.3", techniqueName: "Остановка времени", name: allIn ? "Остановка времени · Ва-банк" : "Остановка времени", targetIds: targets.map(target => target.id), roll: clone(roll), damage: baseDamage, damageByTarget, quickReaction: true, participantIds: targets.map(target => target.id) } });
  }
  if (prompt.kind === "alchemist-mix") events.push({ type: "inventory.change", actorId: actor.id, payload: { item: `potion:${choice}`, delta: 1, sourceActionId: "altruist.alchemist.1" } });
  if (prompt.kind === "empath-calm" && choice !== "pass") {
    events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: target.id, effect: choice, sourceActionId: "altruist.empath.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "positive.усилен", sourceActionId: "altruist.empath.1", participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "siren-irresistible" && choice === "rush") {
    if (!target || target.knockedOut || target.space !== actor.space) return { ok: false, errors: ["Цель «Неотразимой» больше недоступна."], events: [] };
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "siren-irresistible-cell", sourceActorId: actor.id, targetId: target.id, title: "Неотразимая", text: `Выберите для ${target.name} клетку на пути к ${actor.name} в пределах 3 клеток.`, options: ["cancel"], context: { maxDistance: 3 }, participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "siren-irresistible-stun" && choice === "stun") {
    if (!target || target.knockedOut || target.space !== actor.space || distance(actor, target) !== 1) return { ok: false, errors: ["Цель «Неотразимой» больше не смежна с Сиреной."], events: [] };
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.ошеломлен", sourceActionId: "disruptor.siren.2", participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "dim-mak-weak-point" && choice === "place") {
    if (!target || target.knockedOut || target.team === actor.team || target.space !== actor.space) return { ok: false, errors: ["Цель Слабой точки больше недоступна."], events: [] };
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "dim-mak-weak-point-cell", sourceActorId: actor.id, targetId: target.id, title: "Слабая точка", text: `Выберите свободную клетку, смежную с ${target.name}.`, options: ["cancel"], participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "dim-mak-field-investigation" && choice === "study") {
    const study = (data?.actions?.list || []).find(action => action.name === "Изучение");
    if (!target || target.knockedOut || target.team === actor.team || !study) return { ok: false, errors: ["Атакующий или базовое Изучение больше недоступны."], events: [] };
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: study.id, actionName: study.name, name: "Полевое исследование", targetIds: [target.id], quick: true, quickReaction: true, quickSource: { techniqueId: "vagabond.dim-mak", level: 2, name: "Полевое исследование" } } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: effectIdByName(data, "Помечен"), sourceActionId: "vagabond.dim-mak.2", participantIds: [actor.id, target.id] } });
    events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: study.id, name: study.name, targetIds: [target.id], quick: true, quickReaction: true, participantIds: [actor.id, target.id] } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "vagabond.dim-mak.2", name: "Полевое исследование", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "siren-study-frighten" && choice === "frighten") {
    const limit = usageLimitStatus(scene, actor.id, { ruleId: "disruptor.siren.1", scope: "scene", maximum: 3 });
    if (!limit.available) return { ok: false, errors: [limit.reason], events: [] };
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.испуган", sourceActionId: "disruptor.siren.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.siren.1", name: "Ты ведь не причинишь МНЕ боль?", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "untouchable-weave" && choice === "rush") events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "untouchable-weave-cell", sourceActorId: actor.id, title: "Маятник", text: "Выберите свободную клетку в пределах 3 клеток.", options: ["cancel"], context: { maxDistance: 3 }, participantIds: [actor.id] } });
  if (prompt.kind === "grim-transform" && choice === "transform") {
    const lostHealth = Math.max(0, Number(actor.hp || 0) - 1);
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "grimUsed", value: true, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "grimTransformed", value: true, lostHealth, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "ap", amount: 2, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: lostHealth * 2, sourceActionId: "ruiner.grim-ascendant.1" } });
    const enemies = (scene.actors || []).filter(item => !item.knockedOut && item.team !== actor.team && distance(actor, item) <= 2);
    if (enemies.length) {
      const plan = prepareDisplacements(scene, enemies.map(enemy => ({ actorId: enemy.id, mode: "push", sourceActorId: actor.id, maximum: 3, allowPartial: true, optional: true, name: "Непостоянная мощь", ruleId: "ruiner.grim-ascendant.1", participantIds: [actor.id, enemy.id] })));
      if (!plan.ok) return { ok: false, errors: plan.errors, events: [] };
      for (const move of plan.events) {
        events.push(move);
        events.push({ type: "actor.enter", actorId: move.actorId, payload: { space: move.payload.space, x: move.payload.x, y: move.payload.y, movement: "Непостоянная мощь", forced: true } });
      }
    }
  }
  if (prompt.kind === "warring-transform" && choice === "transform") {
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "warringUsed", value: true, sourceActionId: "powerhouse.warring-ascendant.1" } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "warringTransformed", value: true, sourceActionId: "powerhouse.warring-ascendant.1" } });
    const enemies = (scene.actors || []).filter(item => !item.knockedOut && item.team !== actor.team && distance(actor, item) <= 2);
    if (enemies.length) {
      const plan = prepareDisplacements(scene, enemies.map(enemy => ({ actorId: enemy.id, mode: "push", sourceActorId: actor.id, maximum: 3, allowPartial: true, optional: true, name: "Небесная рука", ruleId: "powerhouse.warring-ascendant.1", participantIds: [actor.id, enemy.id] })));
      if (!plan.ok) return { ok: false, errors: plan.errors, events: [] };
      for (const move of plan.events) {
        events.push(move);
        events.push({ type: "actor.enter", actorId: move.actorId, payload: { space: move.payload.space, x: move.payload.x, y: move.payload.y, movement: "Небесная рука", forced: true } });
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
  if (!prompt || !actor || !["marker-move-cell", "dim-mak-weak-point-cell", "empath-rush-cell", "reappear-cell", "knife-pickup-step", "meister-overclock-move", "egomaniac-style-move", "thunder-surge-cell", "siren-irresistible-cell", "untouchable-weave-cell"].includes(prompt.kind)) errors.push("Сейчас нет выбора клетки для правила.");
  if (!space || !destination || !Number.isInteger(destination.x) || !Number.isInteger(destination.y) || destination.x < 0 || destination.y < 0 || destination.x >= Number(space?.width || 0) || destination.y >= Number(space?.height || 0)) errors.push("Выберите клетку в пределах поля.");
  const movingActor = prompt?.kind === "siren-irresistible-cell" ? target : actor;
  if (prompt?.kind !== "marker-move-cell" && movingActor && !effectCellOccupancyStatus(scene, movingActor.id, { space: space?.id, x: destination?.x, y: destination?.y }).available) errors.push("Клетка занята.");
  if (prompt?.kind === "marker-move-cell") {
    if (!marker) errors.push("Духовное пламя больше не существует.");
    if (prompt.context?.maxDistance && marker && distance(marker, { ...destination, space: marker.space }) > Number(prompt.context.maxDistance)) errors.push(`Маркер можно переместить не дальше ${prompt.context.maxDistance} клеток.`);
    const adjacent = actorById(scene, prompt.context?.adjacentToActorId);
    if (adjacent && distance(adjacent, { ...destination, space: adjacent.space }) !== 1) errors.push("Пламя должно оказаться смежно с союзником.");
  }
  if (prompt?.kind === "empath-rush-cell") {
    if (!target || distance(target, { ...destination, space: target.space }) !== 1) errors.push("Прорыв должен закончиться смежно с союзником.");
    const maximum = actor ? effectMovementStatus(scene, actor.id, { distance: Number(prompt.context?.maxDistance || actor.speed || 0) }).distance : 0;
    if (actor && movementPath(scene, actor.id, destination, { maxDistance: maximum }).length < 1) errors.push("До этой клетки нельзя добраться Прорывом.");
  }
  if (prompt?.kind === "reappear-cell" && (scene.actors || []).some(item => item.id !== actor.id && effectPresenceStatus(scene, item.id).onField && item.space === actor.space && distance(item, { ...destination, space: actor.space }) <= 1)) errors.push("При появлении клетка не должна быть смежна с персонажем.");
  if (["knife-pickup-step", "meister-overclock-move"].includes(prompt?.kind)) {
    const maximum = effectMovementStatus(scene, actor.id, { distance: Number(prompt.context?.maxDistance || 0) }).distance;
    if (distance(actor, { ...destination, space: actor.space }) > maximum) errors.push("Клетка находится за пределами разрешённого перемещения.");
  }
  if (prompt?.kind === "egomaniac-style-move") {
    const dx = Math.abs(Number(destination?.x) - Number(actor?.x)), dy = Math.abs(Number(destination?.y) - Number(actor?.y)), maximum = effectMovementStatus(scene, actor.id, { distance: Number(prompt.context?.maxDistance || 2) }).distance;
    if (distance(actor, { ...destination, space: actor.space }) > maximum || dx > 0 && dy > 0) errors.push(`Пиковая форма перемещает не дальше ${maximum} клеток по прямой.`);
  }
  if (prompt?.kind === "thunder-surge-cell" && (!target || target.knockedOut || target.space !== actor.space || distance(target, { ...destination, space: target.space }) !== 1)) errors.push("Скачок должен закончиться в свободной клетке, смежной с исходной целью.");
  if (prompt?.kind === "dim-mak-weak-point-cell") {
    const occupied = (scene.actors || []).some(item => !item.knockedOut && item.space === target?.space && Number(item.x) === Number(destination?.x) && Number(item.y) === Number(destination?.y));
    if (!target || target.knockedOut || target.space !== actor.space || distance(target, { ...destination, space: target?.space }) !== 1) errors.push("Слабая точка должна находиться в клетке, смежной с целью.");
    if (occupied) errors.push("Слабую точку можно поставить только в незанятую клетку.");
  }
  let weavePath = [];
  if (prompt?.kind === "untouchable-weave-cell") {
    const maximum = effectMovementStatus(scene, actor.id, { distance: Number(prompt.context?.maxDistance || 3) }).distance;
    weavePath = movementPath(scene, actor.id, destination, { maxDistance: maximum });
    if (!weavePath.length) errors.push(`Для «Маятника» выберите достижимую свободную клетку в пределах ${maximum} клеток.`);
  }
  let sirenPath = [];
  if (prompt?.kind === "siren-irresistible-cell") {
    if (!target || target.knockedOut || target.space !== actor.space) errors.push("Цель «Неотразимой» больше недоступна.");
    else {
      const unchanged = target.x === destination?.x && target.y === destination?.y;
      const movement = effectMovementStatus(scene, target.id, { forced: true, distance: Number(prompt.context?.maxDistance || 3) });
      if (!movement.available) errors.push(movement.reason);
      sirenPath = unchanged ? [] : movementPath(scene, target.id, destination, { maxDistance: movement.distance, forced: true });
      if (!unchanged && !sirenPath.length) errors.push("Цель должна добраться до клетки обычным перемещением не дальше 3 клеток.");
      let previous = distance(target, actor);
      for (const point of sirenPath) {
        const next = distance({ ...point, space: target.space }, actor);
        if (next >= previous) {
          errors.push("Каждый шаг «Неотразимой» должен приближать цель к Сирене.");
          break;
        }
        previous = next;
      }
    }
  }
  if (errors.length) return { ok: false, errors, events: [] };
  const events = [{ type: "rule.respond", actorId: actor.id, payload: { promptId: prompt.id, choice: "cell", destination: clone(destination), sourceActorId: actor.id, targetId: target?.id || null, participantIds: [actor.id, target?.id].filter(Boolean) } }];
  if (prompt.kind === "thunder-surge-cell") {
    events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "ruiner.thunder-blood.static", delta: -1, sourceActionId: "ruiner.thunder-blood.2", reason: "Скачок" } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.thunder-blood.2", participantIds: [actor.id] } });
  }
  if (prompt.kind === "marker-move-cell") events.push({ type: "marker.move", actorId: actor.id, payload: { markerId: marker.id, space: marker.space, x: destination.x, y: destination.y, movement: prompt.title, participantIds: [actor.id] } });
  else if (prompt.kind === "dim-mak-weak-point-cell") {
    events.push({ type: "marker.create", actorId: actor.id, payload: { id: `dim-mak-${prompt.id}`, space: target.space, x: destination.x, y: destination.y, markerKind: "mark", label: `Слабая точка · ${target.name}`, color: "#db6c9b", source: "vagabond.dim-mak.1", ruleId: "vagabond.dim-mak.1", duration: "scene", ownerActorId: actor.id, metadata: { carrierActorId: target.id, offset: { dx: Number(destination.x) - Number(target.x), dy: Number(destination.y) - Number(target.y) } }, participantIds: [actor.id, target.id] } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "vagabond.dim-mak.1", name: "Изучение слабости", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
  }
  else if (prompt.kind === "siren-irresistible-cell") {
    if (sirenPath.length) {
      events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Неотразимая", forced: true, path: sirenPath.map(cellKey), topologyCrossings: sirenPath.filter(point => point.teleported).map(point => ({ destination: cellKey(point), cutIds: point.crossedCutIds || [] })), participantIds: [actor.id, target.id] } });
      events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Неотразимая", forced: true } });
    }
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.siren.2", name: "Неотразимая", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
    if (distance(actor, { ...destination, space: actor.space }) === 1) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-stun`, kind: "siren-irresistible-stun", sourceActorId: actor.id, targetId: target.id, title: "Неотразимая", text: `Наложить Ошеломлен на ${target.name}?`, options: ["stun", "pass"], participantIds: [actor.id, target.id] } });
  } else if (prompt.kind === "untouchable-weave-cell") {
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Маятник", path: weavePath.map(cellKey), topologyCrossings: weavePath.filter(point => point.teleported).map(point => ({ destination: cellKey(point), cutIds: point.crossedCutIds || [] })), participantIds: [actor.id] } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Маятник" } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "vagabond.untouchable.2", name: "Маятник", affectedActorIds: [actor.id], participantIds: [actor.id] } });
  } else {
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: prompt.kind === "thunder-surge-cell" ? "Телепортация · Скачок" : prompt.title, placement: ["reappear-cell", "thunder-surge-cell"].includes(prompt.kind), participantIds: [actor.id, target?.id].filter(Boolean) } });
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
    const baseDodgeDistance = Number(actor?.techniques?.["vagabond.untouchable"] || 0) >= 2 ? 3 : 2, dodgeDistance = actor ? effectMovementStatus(scene, actor.id, { distance: baseDodgeDistance }).distance : 0, path = actor && destination ? movementPath(scene, actor.id, destination, { maxDistance: dodgeDistance }) : [];
    if (!destination || !space || !path.length || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push(`Для Уворота выберите достижимую свободную клетку в пределах ${dodgeDistance} клеток.`);
    else if (!effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка Уворота занята.");
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
    const baseDodgeDistance = Number(actor?.techniques?.["vagabond.untouchable"] || 0) >= 2 ? 3 : 2, dodgeDistance = effectMovementStatus(scene, actor.id, { distance: baseDodgeDistance }).distance, path = movementPath(scene, actor.id, request.destination, { maxDistance: dodgeDistance });
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y, movement: "Уворот", path: path.map(cellKey) } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y } });
  }
  let responseDestination = request.destination || null;
  if (option.name === "Блок") {
    const source = actorById(scene, pending.actorId), destination = pushDestination(scene, actor, source, 1);
    if (destination.distance > 0) {
      responseDestination = destination;
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Блок · отталкивание", forced: true, displacement: { mode: "push", direction: destination.direction, distance: destination.distance, ruleId: "action.block" }, path: (destination.path || []).map(cellKey), topologyCrossings: destination.topologyCrossings || [] } });
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
  let autophageRegeneration = false;
  if (pending.roll) events.push({ type: "roll.public", actorId: pending.actorId, payload: pending.roll });
  for (const targetId of status.eligibleIds) {
    const outcome = pendingTargetOutcome(scene, pending, targetId), target = outcome.target;
    if (!outcome.cancelled) {
      const { rawDamage, temporaryArmor, temporaryEvasion, expectedDamage } = outcome;
      events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId, amount: rawDamage, temporaryArmor, temporaryEvasion, sourceActionId: pending.actionId, participantIds: [pending.actorId, targetId] } });
      const attackSucceeded = Number(pending.roll?.successes || 0) > 0 || !pending.roll && rawDamage > 0;
      if (expectedDamage > 0 && Number(source?.techniques?.["disruptor.autophage"] || 0) >= 1 && new Set(target.effects || []).size >= 2) autophageRegeneration = true;
      if (expectedDamage > 0) for (const effect of pending.effects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect, sourceActionId: pending.actionId } });
      if (attackSucceeded) for (const effect of pending.successEffects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect, sourceActionId: pending.techniqueRuleId || pending.actionId } });
      const postDisplacement = (pending.postDisplacements || []).find(item => item.targetId === targetId) || (pending.postPush?.targetId === targetId ? { mode: "push", collisionDamagePerCell: 1, ...pending.postPush } : null);
      if (attackSucceeded && postDisplacement) {
        const destination = postDisplacement.mode === "push" ? pushDestination(scene, target, source, Number(postDisplacement.maximum || 99)) : null;
        if (destination?.distance) {
          const movementName = postDisplacement.name || "Принудительное движение", ruleId = postDisplacement.ruleId || pending.techniqueRuleId || pending.enemyRuleId || pending.actionId;
          events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: movementName, forced: true, displacement: { mode: "push", direction: destination.direction, distance: destination.distance, ruleId }, path: (destination.path || []).map(cellKey), topologyCrossings: destination.topologyCrossings || [], participantIds: [pending.actorId, target.id] } });
          events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: movementName, forced: true } });
          const collisionDamage = destination.distance * Number(postDisplacement.collisionDamagePerCell || 0);
          if (collisionDamage > 0) events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId, amount: collisionDamage, ignoreArmor: true, sourceActionId: ruleId, participantIds: [pending.actorId, target.id] } });
        }
      }
    }
  }
  if (source) for (const effect of pending.postSelfEffects || []) events.push({ type: "effect.apply", actorId: source.id, payload: { targetId: source.id, effect, sourceActionId: pending.techniqueRuleId || pending.actionId, participantIds: [source.id] } });
  if (pending.gunslingerBulletJuggle && status.eligibleIds[0]) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: status.eligibleIds[0], effect: "negative.подброшен", sourceActionId: "powerhouse.gunslinger.3", participantIds: [pending.actorId, status.eligibleIds[0]] } });
  if (pending.thunderDischarge && Number(pending.roll?.successes || 0) > 0) status.eligibleIds.forEach(targetId => events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect: "negative.ошеломлен", sourceActionId: "ruiner.thunder-blood.3", participantIds: [pending.actorId, targetId] } }));
  if (pending.overload) {
    status.eligibleIds.forEach(targetId => events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect: "negative.порчен", sourceActionId: "vagabond.modified-meister.2", participantIds: [pending.actorId, targetId] } }));
    if (Number(pending.overload.failedDice || 0) > 0) events.push({ type: "rule-resource.gain", actorId: pending.actorId, payload: { resource: "heat", amount: Number(pending.overload.failedDice), sourceActionId: "vagabond.modified-meister.2" } });
  }
  if (pending.knifeThrow && source && status.eligibleIds[0]) {
    const target = actorById(scene, status.eligibleIds[0]);
    events.push({ type: "marker.create", actorId: source.id, payload: { id: `weapon-${pending.id}`, space: target.space, x: target.x, y: target.y, markerKind: "weapon", label: "Оружие", color: "#8f9aa8", source: "vagabond.knife-juggler.2", ruleId: "vagabond.knife-juggler.2", duration: "scene", ownerActorId: source.id, participantIds: [source.id, target.id] } });
  }
  if (autophageRegeneration && source && !(source.effects || []).includes("positive.регенерирует")) events.push({ type: "effect.apply", actorId: source.id, payload: { targetId: source.id, effect: "positive.регенерирует", sourceActionId: "disruptor.autophage.1", participantIds: [source.id] } });
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
  events.push({ type: pending.enemyRuleId ? "enemy.action.resolve" : "action.resolve", actorId: pending.actorId, payload: pending.enemyRuleId ? { ruleId: pending.enemyRuleId, name: pending.name, kind: "attack", targetIds: status.eligibleIds, skippedTargetIds: status.unavailableIds, reward: pending.reward || "" } : { actionId: pending.actionId, name: pending.name, attribute: pending.attribute || pending.roll?.attribute || null, roll: clone(pending.roll || null), targetIds: status.eligibleIds, skippedTargetIds: status.unavailableIds, icicleHalo: Boolean(pending.icicleHalo) } });
  if (pending.techniqueRuleId) events.push({ type: "technique.resolve", actorId: pending.actorId, payload: { ruleId: pending.techniqueRuleId, name: pending.techniqueName || pending.name, affectedActorIds: status.eligibleIds, skippedTargetIds: status.unavailableIds } });
  events.push({ type: "attack.clear", actorId: source?.id || pending.actorId, payload: { pendingId: pending.id } });
  return { ok: true, errors: [], events };
}
