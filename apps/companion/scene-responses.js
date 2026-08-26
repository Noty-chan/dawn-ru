"use strict";

function antagonistDefenseRule(data, actor) {
  const trait = (data.enemies?.antagonistTraits || []).find(item => item.id === actor?.antagonistTraitId);
  const rule = trait?.rules?.find(item => item.kind === "defense-reaction");
  return rule ? { trait, rule } : null;
}

function antagonistReactionOptions(scene, data, target, source) {
  if (!target || !(target.kind === "enemy" || target.profileId)) return [];
  const options = [];
  const enemies = (scene.actors || []).filter(actor => actor.team === target.team && !actor.knockedOut && effectPresenceStatus(scene, actor.id).onField);
  for (const owner of enemies) {
    const definition = antagonistDefenseRule(data, owner), automation = definition?.rule?.automation;
    if (!definition || !automation || automation.mode === "manual") continue;
    const direct = owner.id === target.id;
    if (["evasion-move", "armor-corrupt", "armor-repel", "clash", "evasion-vanish"].includes(automation.mode) && !direct) continue;
    const base = {
      id: definition.rule.id,
      name: definition.rule.name,
      available: true,
      reason: "",
      cost: "Без затрат",
      costModel: { amount: 0, resource: null },
      enemyTrait: {
        traitId: definition.trait.id,
        traitName: definition.trait.name,
        ruleId: definition.rule.id,
        ruleName: definition.rule.name,
        ruleText: definition.rule.text,
        mode: automation.mode,
        reactionActorId: owner.id,
        defenderActorId: owner.id,
        originalTargetId: target.id,
        temporaryArmor: Number(automation.temporaryArmorPerTier || 0) * Number(owner.tier || 1),
        temporaryEvasion: Number(automation.temporaryEvasionPerTier || 0) * Number(owner.tier || 1),
      },
    };
    if (automation.mode === "evasion-move") {
      options.push(base, { ...base, id: `${base.id}.move`, name: `${base.name} · переместиться при промахе`, requiresDestination: true, destinationKind: "move", maxDistance: Number(automation.move || 3), enemyTrait: { ...base.enemyTrait, postMove: true, maxDistance: Number(automation.move || 3) } });
    } else if (automation.mode === "evasion-vanish") {
      options.push({ ...base, requiresDestination: true, destinationKind: "edge", enemyTrait: { ...base.enemyTrait, postMove: true, disappear: true } });
    } else if (automation.mode === "intercept-armor" || automation.mode === "intercept-clash") {
      options.push({ ...base, name: `${base.name} · ${owner.name}`, requiresDestination: true, destinationKind: "adjacent-attacker", enemyTrait: { ...base.enemyTrait, redirectTargetId: owner.id } });
    } else if (automation.mode === "redirect-ally") {
      for (const ally of enemies.filter(actor => actor.id !== owner.id && actor.id !== target.id)) {
        options.push({
          ...base,
          id: `${base.id}.${ally.id}`,
          name: `${base.name} · ${ally.name}`,
          requiresDestination: true,
          destinationKind: "adjacent-trait-owner",
          enemyTrait: { ...base.enemyTrait, defenderActorId: ally.id, redirectTargetId: ally.id },
        });
      }
    } else options.push(base);
  }
  return options;
}

function reactionOptions(scene, data, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor || actor.knockedOut || scene.pendingAction?.responses?.[actorId]?.choice !== "pending") return [];
  const source = actorById(scene, scene.pendingAction.actorId);
  if (!source || source.knockedOut) return [];
  if (!effectTargetingStatus(scene, source.id, actor.id).available) return [];
  const effectDefense = effectDefenseStatus(scene, actorId);
  const profileActor = actor.kind === "enemy" || Boolean(actor.profileId);
  const defenses = profileActor ? antagonistReactionOptions(scene, data, actor, source) : availableActions(scene, data, actorId).filter(action => action.reaction).map(action => actionIs(action, "dodge") && !effectDefense.dodgeAllowed ? { ...action, available: false, reason: effectDefense.dodgeReason } : action);
  if (profileActor && !defenses.some(option => option.available)) return [];
  return [{ id: "pass", name: "Без Реакции", available: true, reason: "Принять исходную Атаку без защиты", costModel: { amount: 0, resource: null } }, ...defenses];
}

function pendingActionStatus(scene, data = null) {
  const pending = scene?.pendingAction;
  if (!pending) return { exists: false, pending: null, source: null, targetIds: [], eligibleIds: [], unavailableIds: [], waitingIds: [], answeredIds: [], autoPassedIds: [], interruptedReason: "", canResolve: false, mustCancel: false };
  const source = actorById(scene, pending.actorId);
  const targetIds = [...new Set(pending.targetIds || [])];
  const eligibleIds = targetIds.filter(id => { const target = actorById(scene, id); return target && !target.knockedOut && effectTargetingStatus(scene, source?.id, target.id).available && wallTargetingStatus(scene, source, target).available; });
  const unavailableIds = targetIds.filter(id => !eligibleIds.includes(id));
  const pendingIds = eligibleIds.filter(id => pending.responses?.[id]?.choice === "pending");
  const autoPassedIds = data ? pendingIds.filter(id => {
    const target = actorById(scene, id);
    return Boolean(target?.kind === "enemy" || target?.profileId) && !reactionOptions(scene, data, id).some(option => option.id !== "pass" && option.available);
  }) : [];
  const waitingIds = pendingIds.filter(id => !autoPassedIds.includes(id));
  const answeredIds = eligibleIds.filter(id => autoPassedIds.includes(id) || pending.responses?.[id]?.choice && pending.responses[id].choice !== "pending" && pending.responses[id].choice !== "unavailable");
  const sourcePresence = source ? effectPresenceStatus(scene, source.id) : null;
  const interruptedReason = pending.interruptedReason || (!source ? "Атакующий больше не находится на Сцене" : source.knockedOut ? "Атакующий выведен из боя" : !sourcePresence.onField ? sourcePresence.reason : ""), emptyAllowed = Boolean(pending.allowEmptyTargets && targetIds.length === 0);
  return { exists: true, pending, source, targetIds, eligibleIds, unavailableIds, waitingIds, answeredIds, autoPassedIds, interruptedReason, canResolve: !interruptedReason && (eligibleIds.length > 0 || emptyAllowed) && waitingIds.length === 0, mustCancel: Boolean(interruptedReason) || (!emptyAllowed && eligibleIds.length === 0) };
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
  const source = actorById(scene, pending?.actorId), originalTarget = actorById(scene, targetId), reaction = pending?.responses?.[targetId] || {}, response = reaction.choice, target = actorById(scene, reaction.redirectTargetId || targetId);
  if (!pending || !source || !target || target.knockedOut) return { available: false, reason: "Источник или цель Атаки больше не доступны.", source, target, cancelled: true, rawDamage: 0, armor: 0, evasion: 0, expectedDamage: 0 };
  const clashCancelled = (actionIdIs(response, "clash") || reaction.enemyTrait?.clash) && reaction.clash?.defenderWins, giftCancelled = Boolean(reaction.giftReaction?.cancelAttack), body = Number(target.attrs?.body || 0);
  const alliedGas = (scene.objects || []).find(object => object.type === "gas" && object.space === target.space && object.cells?.includes(`${target.x},${target.y}`) && actorById(scene, object.ownerActorId)?.team === target.team), sourceInsideGas = alliedGas && source.space === alliedGas.space && alliedGas.cells?.includes(`${source.x},${source.y}`), gasEvasion = alliedGas && !sourceInsideGas ? 3 : 0;
  const defense = effectDefenseStatus(scene, target.id), temporaryArmor = actionIdIs(response, "block") ? body : Number(reaction.temporaryArmor || 0), temporaryEvasion = Number(reaction.temporaryEvasion || 0) + gasEvasion;
  const rawDamage = pending.damageByTarget && Number.isFinite(Number(pending.damageByTarget[targetId])) ? Number(pending.damageByTarget[targetId]) : Number(pending.damage || 0), raw = Math.max(0, rawDamage), armor = defense.armorAllowed ? Math.max(0, Number(target.armor || 0) + temporaryArmor + defense.armorBonus) : 0, afterArmor = raw > 0 ? Math.max(1, raw - armor) : 0, evasion = Math.max(0, Number(target.evasion || 0) + temporaryEvasion), expectedDamage = clashCancelled || giftCancelled ? 0 : Math.max(0, afterArmor - Math.min(afterArmor, evasion));
  return { available: true, reason: "", source, originalTarget, target, reaction, response, cancelled: clashCancelled || giftCancelled, rawDamage, raw, armor, evasion, temporaryArmor, temporaryEvasion, afterArmor, expectedDamage };
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

function prepareSacrifice(scene, request = {}) {
  const actor = actorById(scene, request.actorId), roll = (scene.rollFeed || []).find(item => item.id === request.rollId), sacrifice = String(request.sacrifice || ""), errors = [];
  if (!actor || !(actor.gifts || []).includes("cursed.sacrifice")) errors.push("У персонажа нет Дара «Жертва».");
  if (!roll || roll.pending) errors.push("Выберите уже завершённый публичный бросок.");
  if (roll?.sacrificedBy) errors.push("Этот бросок уже превращён в Крайний успех Жертвой.");
  if (!["eye", "arm", "leg", "tongue", "life"].includes(sacrifice) || (actor?.sacrifices || []).includes(sacrifice)) errors.push("Выберите ещё не принесённую необратимую цену.");
  if (errors.length) return { ok: false, errors, events: [] };
  return { ok: true, errors: [], events: [{ type: "gift.sacrifice", actorId: actor.id, payload: { rollId: roll.id, sacrifice, sourceActionId: "cursed.sacrifice", participantIds: [actor.id, roll.actorId].filter(Boolean) } }] };
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
    const attack = actionIsAny(action, ["skirmish", "spell", "finish"]), modifiers = attack ? attackModifierStatus(scene, actor.id, context.targetIds || [], context.attackModifierIds || [], { actionId: action.id }) : null;
    if (modifiers && !modifiers.available) errors.push(modifiers.reason);
    if (modifiers?.actionTransform) {
      const transformedAction = actionByKey(data, modifiers.actionTransform.actionKey), transformedAvailable = transformedAction && availableActions(scene, data, actor.id).find(item => item.id === transformedAction.id);
      if (!transformedAction) errors.push("Действие-замена модификатора не найдено.");
      else if (!transformedAvailable?.available && !/^Недостаточно:/.test(transformedAvailable?.reason || "")) errors.push(transformedAvailable?.reason || "Действие-замена сейчас недоступно.");
    }
    if (request.phase === "destination" && !modifiers?.requiresDestination && !actionIsAny(action, ["step", "jump"])) errors.push("Это составное действие не требует клетки назначения.");
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
  const attack = ["skirmish", "spell", "finish"].some(key => actionIdIs(plan?.actionId, key)), assassination = attack && Number(actor?.techniques?.["vagabond.assassin"] || 0) >= 2;
  const modifiers = actor && plan ? attackModifierStatus(scene, actor.id, plan.context?.targetIds || [], plan.context?.attackModifierIds || [], { actionId: plan.actionId }) : null;
  if (modifiers && !modifiers.available) errors.push(modifiers.reason);
  const space = (scene.spaces || []).find(item => item.id === actor?.space);
  if (!space || !destination || !Number.isInteger(destination.x) || !Number.isInteger(destination.y) || destination.x < 0 || destination.y < 0 || destination.x >= Number(space?.width || 0) || destination.y >= Number(space?.height || 0)) errors.push("Выберите клетку появления в пределах поля.");
  if (actor && destination && !effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка появления занята.");
  if (!assassination && actor && destination && (scene.actors || []).some(item => item.id !== actor.id && effectPresenceStatus(scene, item.id).onField && item.space === actor.space && distance(item, { ...destination, space: actor.space }) <= 1)) errors.push("При появлении клетка не должна быть смежна с персонажем.");
  if (errors.length) return { ok: false, errors, events: [] };
  const needsDestination = ["step", "jump"].some(key => actionIdIs(plan.actionId, key)) || Boolean(modifiers?.requiresDestination), nextPhase = needsDestination ? "destination" : "confirm", context = { ...(plan.context || {}), reappearance: { space: actor.space, x: destination.x, y: destination.y }, destinationKind: modifiers?.requiresDestination ? "attack-modifier" : needsDestination ? "movement" : null };
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
  const placement = actor && plan ? attackModifierDestinationStatus(scene, actor.id, plan.context?.targetIds || [], plan.context?.attackModifierIds || [], destination, { actionId: plan.actionId, origin: plan.context?.reappearance || null }) : null;
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
    { type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: reappearance.x, y: reappearance.y, movement: Number(actor.techniques?.["vagabond.assassin"] || 0) >= 2 && ["skirmish", "spell", "finish"].some(key => actionIdIs(plan.actionId, key)) ? "Ликвидация" : "Появление перед действием", placement: true, participantIds: [actor.id, ...(context.targetIds || [])] } },
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
  if (prompt.kind === "enemy-healer-guardian") {
    const guardian = choice.startsWith("guard:") ? actorById(scene, choice.slice(6)) : null;
    if (guardian && (guardian.knockedOut || guardian.id === actor.id || guardian.team !== actor.team || !effectPresenceStatus(scene, guardian.id).onField)) return { ok: false, errors: ["Выбранный Страж больше недоступен."], events: [] };
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "healerGuardianId", value: guardian?.id || null, sourceActionId: "enemy.common.healer.passive", participantIds: [actor.id, guardian?.id].filter(Boolean) } });
  }
  if (prompt.kind === "enemy-duelist-goad") {
    if (!target || target.knockedOut || target.space !== actor.space) return { ok: false, errors: ["Цель Поддразнивания больше недоступна."], events: [] };
    if (choice === "focus") {
      if (Number(target.focus || 0) < 2) return { ok: false, errors: ["У цели больше нет 2 Фокуса."], events: [] };
      events.push({ type: "resource.spend", actorId: target.id, payload: { resource: "focus", amount: 2, sourceActionId: "enemy.common.duelist.action.goad", participantIds: [actor.id, target.id] } });
    } else {
      const space = (scene.spaces || []).find(item => item.id === target.space), candidates = [];
      for (let y = 0; y < Number(space?.height || 0); y += 1) for (let x = 0; x < Number(space?.width || 0); x += 1) {
        const path = movementPath(scene, target.id, { x, y }, { maxDistance: 3, forced: true, straight: true });
        if (path.length && path.every((point, index) => distance({ ...point, space: target.space }, actor) < distance(index ? { ...path[index - 1], space: target.space } : target, actor))) candidates.push({ x, y, path });
      }
      candidates.sort((left, right) => right.path.length - left.path.length || distance({ ...left, space: target.space }, actor) - distance({ ...right, space: target.space }, actor));
      const destination = candidates[0];
      if (destination) {
        events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Поддразнить", forced: true, path: destination.path.map(cellKey), participantIds: [actor.id, target.id] } });
        events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Поддразнить", forced: true } });
        if (distance({ ...destination, space: target.space }, actor) === 1) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.ошеломлен", sourceActionId: "enemy.common.duelist.action.goad", participantIds: [actor.id, target.id] } });
      }
    }
  }
  if (prompt.kind === "inner-world-offer" && choice === "invoke") {
    const domainTarget = target;
    if (!domainTarget || domainTarget.id !== prompt.context?.targetId || domainTarget.knockedOut || domainTarget.id === actor.id || domainTarget.space !== actor.space || !effectPresenceStatus(scene, domainTarget.id).onField) return { ok: false, errors: ["Цель наложенного Эффекта больше не подходит для Домена."], events: [] };
    const spaceId = `inner-world-${actor.id}`, innerSpace = (scene.spaces || []).find(space => space.id === spaceId), occupied = new Set((scene.actors || []).filter(item => !item.knockedOut && item.space === innerSpace?.id).map(cellKey));
    const innerCells = ["cell:0,0", "cell:1,0", "cell:2,0", "cell:0,1", "cell:1,1", "cell:2,1", "cell:0,2", "cell:1,2", "cell:2,2"].filter(cell => !occupied.has(cell.slice(5)));
    if (!innerCells.length) return { ok: false, errors: ["Во Внутреннем мире нет свободной клетки для цели."], events: [] };
    const optionLabels = Object.fromEntries(innerCells.map(cell => [cell, `Клетка ${String.fromCharCode(65 + Number(cell[5]))}${Number(cell[7]) + 1}`]));
    events.push({ type: "space.ensure", actorId: actor.id, payload: { id: spaceId, name: `Внутренний мир · ${actor.name}`, width: 3, height: 3, returnSpaceId: actor.space, ownerActorId: actor.id, activate: true, sourceActionId: "disruptor.inner-world.2", ruleId: "disruptor.inner-world.2", innerWorldPrelude: true, participantIds: [actor.id, domainTarget.id] } });
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-target-cell`, kind: "inner-world-target-cell", sourceActorId: actor.id, targetId: domainTarget.id, title: "Домен контроля · противник", text: `Выберите на поле клетку Внутреннего мира для ${domainTarget.name}.`, options: [...innerCells, "cancel"], context: { ruleId: "disruptor.inner-world.2", targetId: domainTarget.id, spaceId, returnSpaceId: actor.space, temporarySpace: !innerSpace, optionLabels }, participantIds: [actor.id, domainTarget.id] } });
  }
  if (["inner-world-target-cell", "inner-world-caster-cell"].includes(prompt.kind) && choice === "cancel") {
    const returnSpaceId = prompt.context?.returnSpaceId, spaceId = prompt.context?.spaceId;
    if (returnSpaceId) events.push({ type: "space.ensure", actorId: actor.id, payload: { id: returnSpaceId, name: (scene.spaces || []).find(space => space.id === returnSpaceId)?.name || "Основное поле", width: Number((scene.spaces || []).find(space => space.id === returnSpaceId)?.width || 7), height: Number((scene.spaces || []).find(space => space.id === returnSpaceId)?.height || 7), activate: true, participantIds: [actor.id, target?.id].filter(Boolean) } });
    if (prompt.context?.temporarySpace && spaceId) events.push({ type: "space.remove", actorId: actor.id, payload: { id: spaceId, reason: "Активация Внутреннего мира отменена", participantIds: [actor.id, target?.id].filter(Boolean) } });
  }
  if (prompt.kind === "inner-world-target-cell" && choice.startsWith("cell:")) {
    const targetPoint = choice.slice(5).split(",").map(Number), targetCell = { x: targetPoint[0], y: targetPoint[1] };
    if (targetPoint.length !== 2 || targetPoint.some(value => !Number.isInteger(value) || value < 0 || value > 2)) return { ok: false, errors: ["Клетка Внутреннего мира недоступна."], events: [] };
    const innerSpace = (scene.spaces || []).find(space => space.id === `inner-world-${actor.id}`), occupied = new Set((scene.actors || []).filter(item => !item.knockedOut && item.space === innerSpace?.id).map(cellKey));
    const innerCells = ["cell:0,0", "cell:1,0", "cell:2,0", "cell:0,1", "cell:1,1", "cell:2,1", "cell:0,2", "cell:1,2", "cell:2,2"].filter(cell => cell !== choice && !occupied.has(cell.slice(5))), optionLabels = Object.fromEntries(innerCells.map(cell => [cell, `Клетка ${String.fromCharCode(65 + Number(cell[5]))}${Number(cell[7]) + 1}`]));
    if (!innerCells.length) return { ok: false, errors: ["Во Внутреннем мире нет второй свободной клетки."], events: [] };
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-caster-cell`, kind: "inner-world-caster-cell", sourceActorId: actor.id, targetId: target.id, title: "Домен контроля · инициатор", text: `Клетка ${String.fromCharCode(65 + targetCell.x)}${targetCell.y + 1} сохранена для ${target.name}. Теперь выберите на поле свободную клетку для себя.`, options: [...innerCells, "cancel"], context: { ...prompt.context, ruleId: "disruptor.inner-world.2", targetId: target.id, targetCell, optionLabels }, participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "inner-world-caster-cell" && choice.startsWith("cell:")) {
    const casterPoint = choice.slice(5).split(",").map(Number), targetPoint = prompt.context?.targetCell, spaceId = `inner-world-${actor.id}`;
    if (casterPoint.length !== 2 || casterPoint.some(value => !Number.isInteger(value) || value < 0 || value > 2) || !targetPoint || casterPoint[0] === Number(targetPoint.x) && casterPoint[1] === Number(targetPoint.y)) return { ok: false, errors: ["Выберите другую свободную клетку Внутреннего мира."], events: [] };
    if (!target || target.knockedOut || target.space !== actor.space) return { ok: false, errors: ["Цель Домена больше недоступна."], events: [] };
    const innerSpace = (scene.spaces || []).find(space => space.id === spaceId), occupied = new Set((scene.actors || []).filter(item => !item.knockedOut && item.space === innerSpace?.id).map(cellKey));
    if (occupied.has(`${Number(targetPoint.x)},${Number(targetPoint.y)}`) || occupied.has(`${casterPoint[0]},${casterPoint[1]}`)) return { ok: false, errors: ["Выбранная клетка Внутреннего мира уже занята."], events: [] };
    const level = Number(actor.techniques?.["disruptor.inner-world"] || 0), maximum = level >= 3 ? Math.max(1, Number(actor.attrs?.spirit || 1)) : 1, limit = usageLimitStatus(scene, actor.id, { ruleId: "disruptor.inner-world.2", scope: "scene", maximum });
    if (!limit.available) return { ok: false, errors: [limit.reason], events: [] };
    const participants = [actor.id, target.id];
    events.push({ type: "technique.prepare", actorId: actor.id, payload: { ruleId: "disruptor.inner-world.2", name: "Домен контроля", targetIds: [target.id], participantIds: participants } });
    events.push({ type: "space.ensure", actorId: actor.id, payload: { id: spaceId, name: `Внутренний мир · ${actor.name}`, width: 3, height: 3, returnSpaceId: prompt.context?.returnSpaceId || actor.space, ownerActorId: actor.id, activate: true, sourceActionId: "disruptor.inner-world.2", ruleId: "disruptor.inner-world.2", participantIds: participants } });
    events.push({ type: "actor.move", actorId: target.id, payload: { space: spaceId, x: Number(targetPoint.x), y: Number(targetPoint.y), movement: "Домен контроля", teleport: true, placement: true, sourceActionId: "disruptor.inner-world.2", ruleId: "disruptor.inner-world.2", participantIds: participants } });
    events.push({ type: "actor.enter", actorId: target.id, payload: { space: spaceId, x: Number(targetPoint.x), y: Number(targetPoint.y), movement: "Домен контроля", teleport: true, placement: true, sourceActionId: "disruptor.inner-world.2", ruleId: "disruptor.inner-world.2", participantIds: participants } });
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: spaceId, x: casterPoint[0], y: casterPoint[1], movement: "Домен контроля", teleport: true, placement: true, sourceActionId: "disruptor.inner-world.2", ruleId: "disruptor.inner-world.2", participantIds: participants } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: spaceId, x: casterPoint[0], y: casterPoint[1], movement: "Домен контроля", teleport: true, placement: true, sourceActionId: "disruptor.inner-world.2", ruleId: "disruptor.inner-world.2", participantIds: participants } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.inner-world.2", name: "Домен контроля", affectedActorIds: participants, participantIds: participants } });
  }
  if (["enemy-executioner-bifurcate", "enemy-revenant-hollowed"].includes(prompt.kind)) {
    const executioner = prompt.kind === "enemy-executioner-bifurcate", stateKey = executioner ? "executionerBifurcate" : "revenantHollowedEyes";
    if (choice === "pass") events.push({ type: "actor.state", actorId: actor.id, payload: { key: stateKey, value: null, sourceActionId: prompt.context?.ruleId } });
    else {
      const rule = enemyProfileById(data, actor.profileId)?.rules?.find(item => item.id === prompt.context?.ruleId), advantage = executioner ? 0 : Math.max(0, enemyTierFormula("7(+1)", actor.tier) - Number(target?.focus || 0)), dice = enemyTierFormula(rule?.dice || "0", actor.tier) + advantage, rolled = Array.from({ length: dice }, () => 1 + Math.floor(Math.random() * 6)), roll = request.roll || { formula: `${dice}D6 · ${rule?.name || prompt.title}`, rolls: rolled, successes: rolled.filter(value => value >= 4).length, crits: rolled.filter(value => value === 6).length }, space = (scene.spaces || []).find(item => item.id === actor.space);
      if (!target || target.knockedOut || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Цель или бросок отложенной Атаки больше недоступны."], events: [] };
      let destination = null, path = [];
      for (let y = 0; y < Number(space?.height || 0); y += 1) for (let x = 0; x < Number(space?.width || 0); x += 1) {
        if (distance({ x, y, space: actor.space }, target) > 1 || !effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x, y }).available) continue;
        const candidate = executioner ? movementPath(scene, actor.id, { x, y }, { maxDistance: Number(space.width || 0) + Number(space.height || 0) }) : [];
        if (executioner && !candidate.length && (actor.x !== x || actor.y !== y)) continue;
        if (!destination || candidate.length < path.length) { destination = { x, y }; path = candidate; }
      }
      if (!destination) return { ok: false, errors: ["Рядом с указанной целью нет доступной клетки."], events: [] };
      const targetIds = executioner ? [...new Set((scene.actors || []).filter(item => !item.knockedOut && item.team !== actor.team && item.space === actor.space && (path.map(cellKey).includes(cellKey(item)) || distance({ ...destination, space: actor.space }, item) <= 1)).map(item => item.id))] : [target.id];
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, ...destination, movement: prompt.title, path: path.map(cellKey), placement: !executioner, teleport: !executioner, participantIds: [actor.id, ...targetIds] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, ...destination, movement: prompt.title, placement: !executioner, teleport: !executioner } });
      targetIds.forEach(targetId => events.push({ type: "reaction.offer", actorId: targetId, payload: { sourceActorId: actor.id, actionId: prompt.context.ruleId, participantIds: [actor.id, targetId] } }));
      const damage = Number(roll.successes || 0) + Number(scene.tension || 0) * (executioner ? 2 : 1);
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: prompt.context.ruleId, enemyRuleId: prompt.context.ruleId, name: `${prompt.title} · отложенная Атака`, targetIds, roll: clone(roll), damage, damageByTarget: Object.fromEntries(targetIds.map(id => [id, damage])), quickReaction: true, enemyAttackFamily: executioner ? { effects: ["Разорван"], chargedAttack: true } : { postResourceLoss: { resource: "focus", formula: "2(+1)" } }, participantIds: [actor.id, ...targetIds] } });
      if (executioner) events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.заряжен", sourceActionId: prompt.context.ruleId, participantIds: [actor.id] } });
      events.push({ type: "actor.state", actorId: actor.id, payload: { key: stateKey, value: null, sourceActionId: prompt.context.ruleId } });
    }
  }
  if (prompt.kind === "chemist-sublimation" && choice === "sublimate") {
    const terrain = (scene.objects || []).find(object => object.id === prompt.context?.terrainId);
    if (prompt.context?.terrainId && !terrain) return { ok: false, errors: ["Выбранная местность уже уничтожена."], events: [] };
    if (terrain) events.push({ type: "area.remove", actorId: actor.id, payload: { id: terrain.id, label: terrain.label, sourceActionId: "disruptor.chemist.1" } });
    events.push({ type: "area.create", actorId: actor.id, payload: { id: `gas-${prompt.id}`, space: terrain?.space || prompt.context?.space || actor.space, areaType: "gas", label: "Сублимация", source: "disruptor.chemist.1", ruleId: "disruptor.chemist.1", duration: "nextTurn", ownerActorId: actor.id, cells: clone(prompt.context?.cells || []), participantIds: [actor.id] } });
  }
  if (prompt.kind === "clash-counterattack") {
    const attacker = actorById(scene, prompt.context?.attackerId), action = ["skirmish", "spell"].includes(choice) ? actionByKey(data, choice) : null, roll = request.roll;
    if (choice === "pass") {
      if (scene.pendingAction) events.push({ type: "attack.clear", actorId: actor.id, payload: { reason: "Столкновение выиграно; ответная Атака пропущена", participantIds: [actor.id, attacker?.id].filter(Boolean) } });
    } else {
      const maximum = choice === "skirmish" ? 1 : 5;
      if (!attacker || attacker.knockedOut || attacker.team === actor.team || attacker.space !== actor.space || distance(actor, attacker) > maximum || !action || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: [`Ответная ${choice === "skirmish" ? "Стычка" : "Заклинание"} или её цель больше недоступны.`], events: [] };
      if (scene.pendingAction) events.push({ type: "attack.clear", actorId: actor.id, payload: { reason: "Столкновение выиграно; исходная Атака отменена", participantIds: [actor.id, attacker.id] } });
      events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, name: `${action.name} · ответ Столкновения`, targetIds: [attacker.id], quick: true, quickReaction: true, reaction: true, free: true, participantIds: [actor.id, attacker.id] } });
      events.push({ type: "reaction.offer", actorId: attacker.id, payload: { sourceActorId: actor.id, actionId: action.id, participantIds: [actor.id, attacker.id] } });
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, name: `${action.name} · ответ Столкновения`, targetIds: [attacker.id], roll: clone(roll), damage: Number(roll.successes || 0), damageByTarget: { [attacker.id]: Number(roll.successes || 0) }, quickReaction: true, clashCounterattack: true, participantIds: [actor.id, attacker.id] } });
    }
  }
  if (prompt.kind === "enemy-ranger-retreat" && choice === "move") {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "enemy-move-cell", sourceActorId: actor.id, controller: "narrator", title: "Снайперская дистанция", text: "Переместите Егеря на 1 клетку после Атаки по нему.", options: ["cancel"], context: { maxDistance: 1 }, participantIds: [actor.id] } });
  }
  if (prompt.kind === "enemy-berserker-retaliate" && choice === "retaliate") {
    const roll = request.roll, maximum = actor.ruleState?.berserkerLastStand ? 2 : 1;
    if (!target || target.knockedOut || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Цель или бросок ответного Сокрушения больше недоступны."], events: [] };
    let destination = { x: actor.x, y: actor.y }, path = [];
    const space = (scene.spaces || []).find(item => item.id === actor.space);
    for (let y = 0; y < Number(space?.height || 0); y += 1) for (let x = 0; x < Number(space?.width || 0); x += 1) {
      const candidatePath = movementPath(scene, actor.id, { x, y }, { maxDistance: maximum });
      if (!candidatePath.length || distance({ ...destination, space: actor.space }, target) <= distance({ x, y, space: actor.space }, target)) continue;
      destination = { x, y }; path = candidatePath;
    }
    if (path.length) {
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Неумолимое разрушение", path: path.map(cellKey), participantIds: [actor.id, target.id] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Неумолимое разрушение" } });
    }
    if (distance({ ...destination, space: actor.space }, target) <= 1) {
      events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: "enemy.common.berserker.attack.thrash", participantIds: [actor.id, target.id] } });
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: "enemy.common.berserker.attack.thrash", enemyRuleId: "enemy.common.berserker.attack.thrash", name: "Сокрушение · реакция", targetIds: [target.id], roll: clone(roll), damage: Number(roll.successes || 0) + Number(scene.tension || 0), damageByTarget: { [target.id]: Number(roll.successes || 0) + Number(scene.tension || 0) }, quickReaction: true, postDisplacements: [{ targetId: target.id, mode: "push", maximum: 1, name: "Сокрушение", ruleId: "enemy.common.berserker.attack.thrash", collisionDamagePerCell: 0 }], enemyAttackFamily: { postPush: 1 }, participantIds: [actor.id, target.id] } });
    }
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "berserkerReactionTurnSerial", value: Number(scene.turnSerial || 0), sourceActionId: "enemy.common.berserker.passive.relentless-destruction" } });
  }
  if (prompt.kind === "enemy-cocoon-repeat" && choice.startsWith("target:")) {
    const repeatTarget = actorById(scene, choice.slice(7)), rule = enemyProfileById(data, actor.profileId)?.rules?.find(item => item.id === "enemy.common.cocoon.attack.rampage"), roll = request.roll;
    if (!repeatTarget || repeatTarget.knockedOut || repeatTarget.team === actor.team || distance(actor, repeatTarget) > 1 || !rule || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Новая цель Буйства или бросок больше недоступны."], events: [] };
    events.push({ type: "reaction.offer", actorId: repeatTarget.id, payload: { sourceActorId: actor.id, actionId: rule.id, participantIds: [actor.id, repeatTarget.id] } });
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: rule.id, enemyRuleId: rule.id, name: `${rule.name} · повтор`, targetIds: [repeatTarget.id], roll: clone(roll), damage: Number(roll.successes || 0) + Number(scene.tension || 0) * 2, damageByTarget: { [repeatTarget.id]: Number(roll.successes || 0) + Number(scene.tension || 0) * 2 }, quickReaction: true, enemyAttackFamily: { repeatFreshTargets: true }, participantIds: [actor.id, repeatTarget.id] } });
  }
  if (prompt.kind === "enemy-flux-swap" && choice.startsWith("swap:")) {
    const swapTarget = actorById(scene, choice.slice(5)), fluxTarget = target;
    if (!fluxTarget || fluxTarget.knockedOut || !swapTarget || swapTarget.knockedOut || swapTarget.team !== actor.team || swapTarget.id === actor.id || swapTarget.id === fluxTarget.id) return { ok: false, errors: ["Участники перестановки Потока больше недоступны."], events: [] };
    const first = { space: fluxTarget.space, x: fluxTarget.x, y: fluxTarget.y }, second = { space: swapTarget.space, x: swapTarget.x, y: swapTarget.y };
    events.push({ type: "actor.move", actorId: fluxTarget.id, payload: { ...second, movement: "Поток: перестановка", placement: true, teleport: true, participantIds: [actor.id, fluxTarget.id, swapTarget.id] } });
    events.push({ type: "actor.move", actorId: swapTarget.id, payload: { ...first, movement: "Поток: перестановка", placement: true, teleport: true, participantIds: [actor.id, fluxTarget.id, swapTarget.id] } });
    events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: fluxTarget.id, effect: "special.поток", sourceActorId: actor.id, sourceActionId: "enemy.common.illusionist.attack.distort-reality", participantIds: [actor.id, fluxTarget.id] } });
  }
  if (prompt.kind === "not-today-risk") {
    const answers = choice.replace(/^answers:/, ""), count = [...answers].filter(value => value === "1").length, rolled = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)), failures = rolled.filter(value => value < 4).length, stress = Math.min(3, Number(actor.stress || 0) + failures);
    events.push({ type: "roll.public", actorId: actor.id, payload: { formula: `${count}D6 ≥4`, rolls: rolled, successes: count - failures, crits: rolled.filter(value => value === 6).length, outcome: `Не сегодня · ${failures} Стресса`, targetIds: [prompt.context?.originalTargetId].filter(Boolean) } });
    if (failures) events.push({ type: "actor.runtime.set", actorId: actor.id, payload: { key: "stress", value: stress, sourceActionId: "rebel.not-today", reason: "Не сегодня" } });
    if (failures && stress >= 3 && !actor.knockedOut) events.push({ type: "actor.knockout", actorId: actor.id, payload: { targetId: actor.id, sourceActionId: "rebel.not-today", reason: "Достигнут максимум Стресса" } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "rebel.not-today", name: "Не сегодня", affectedActorIds: [prompt.context?.originalTargetId].filter(Boolean) } });
  }
  if (prompt.kind === "dark-urge-narrator" && choice.startsWith("target:")) {
    const redirected = actorById(scene, choice.slice(7)), original = prompt.context?.originalTargetIds || [], sourceRoll = (scene.rollFeed || []).find(roll => roll.id === prompt.context?.sourceRollId);
    if (!redirected || redirected.knockedOut || redirected.id === actor.id || redirected.space !== actor.space || original.includes(redirected.id) || !sourceRoll || sourceRoll.actorId !== actor.id) return { ok: false, errors: ["Выбранная Нарратором цель или исходный бросок больше недоступны."], events: [] };
    const options = Number(actor.stress || 0) <= 1 ? ["accept", "resist"] : ["accept"];
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-resist`, kind: "dark-urge-resist", sourceActorId: actor.id, targetId: redirected.id, title: "Сопротивление Тёмному порыву", text: `Нарратор перенаправляет сохранённый результат на ${redirected.name}. Принять это или получить 2 Стресса, чтобы сохранить исходную цель?${options.includes("resist")?"":" Сейчас получить 2 Стресса нельзя: шкала переполнится."}`, options, context: { sourceRollId: sourceRoll.id, originalTargetIds: [...original], optionLabels: { accept: `Принять: цель — ${redirected.name}`, resist: "Сопротивляться: +2 Стресса" } }, participantIds: [actor.id, redirected.id] } });
  }
  if (prompt.kind === "dark-urge-resist" && choice === "resist") {
    if (Number(actor.stress || 0) > 1) return { ok: false, errors: [`${actor.name} больше не может получить 2 Стресса без переполнения шкалы.`], events: [] };
    events.push({ type: "actor.runtime.set", actorId: actor.id, payload: { key: "stress", value: Number(actor.stress || 0) + 2, sourceActionId: "wolf.dark-urge", reason: "Сопротивление Тёмному порыву", participantIds: [actor.id] } });
  }
  if (prompt.kind === "dark-urge-resist" && choice === "accept") {
    const sourceRoll = (scene.rollFeed || []).find(roll => roll.id === prompt.context?.sourceRollId);
    if (!target || target.knockedOut || target.id === actor.id || target.space !== actor.space || !sourceRoll || sourceRoll.actorId !== actor.id || (sourceRoll.targetIds || []).includes(target.id)) return { ok: false, errors: ["Цель перенаправления или сохранённый результат больше недоступны."], events: [] };
    events.push({ type: "roll.redirect", actorId: actor.id, payload: { sourceRollId: sourceRoll.id, targetId: target.id, originalTargetIds: clone(sourceRoll.targetIds || []), ruleId: "wolf.dark-urge", participantIds: [actor.id, target.id, ...(sourceRoll.targetIds || [])] } });
  }
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
  if (prompt.kind === "inner-world-gaze" && choice === "gaze") {
    const amount = Math.max(1, Number(prompt.context?.amount || 0)), range = Math.max(1, Number(prompt.context?.range || amount));
    const targets = (scene.actors || []).filter(target => target.id !== actor.id && target.team !== actor.team && !target.knockedOut && target.space === actor.space && distance(actor, target) <= range);
    if (!resourceOperationStatus(scene, actor.id, { resource: "focus", amount, operation: "spend" }).available) return { ok: false, errors: ["Полученный Зарядкой Фокус уже недоступен."], events: [] };
    events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "focus", amount, sourceActionId: "disruptor.inner-world.1", reason: "Глубокий взгляд", participantIds: [actor.id, ...targets.map(target => target.id)] } });
    targets.forEach(target => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.обездвижен", sourceActionId: "disruptor.inner-world.1", participantIds: [actor.id, target.id] } }));
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.inner-world.1", name: "Глубокий взгляд", affectedActorIds: targets.map(target => target.id), participantIds: [actor.id, ...targets.map(target => target.id)] } });
  }
  if (prompt.kind === "cryomancer-icicle-rest" && choice === "convert") {
    const segments = clockStatus(scene, actor.id, "ruiner.cryomancer.icicle").value;
    const gain = (scene.log || []).find(event => event.id === prompt.context?.focusGainEventId);
    const alreadyConverted = (scene.log || []).some(event => event.type === "resource.spend" && event.payload?.forgoneGainEventId === gain?.id);
    const exactBreatheGain = gain?.type === "resource.gain" && gain.actorId === actor.id && gain.payload?.actionInstanceId === prompt.context?.actionInstanceId && actionIdIs(gain.payload?.sourceActionId, "breathe") && gain.payload?.resolvedResource === "focus" && Number(gain.payload?.resolvedDelta || 0) > 0;
    if (segments < 1 || !exactBreatheGain || alreadyConverted || Number(actor.focus || 0) < Number(gain.payload.resolvedDelta)) return { ok: false, errors: ["Сосулька или Фокус именно этой Передышки уже недоступны."], events: [] };
    events.push({ type: "resource.spend", actorId: actor.id, payload: { actionInstanceId: prompt.context.actionInstanceId, forgoneGainEventId: gain.id, resource: "focus", amount: Number(gain.payload.resolvedDelta), sourceActionId: "ruiner.cryomancer.2", reason: "Отказ от Фокуса Передышки" } });
    events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: "ruiner.cryomancer.icicle", value: 0, sourceActionId: "ruiner.cryomancer.2" } });
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "icicleSpellsRemaining", value: segments, sourceActionId: "ruiner.cryomancer.2" } });
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-series`, kind: "cryomancer-icicle-series", sourceActorId: actor.id, title: "Ледяной нимб", text: `Доступно Быстрых Заклинаний: ${segments}. Продолжить серию?`, options: ["continue", "stop"], context: { remaining: segments }, participantIds: [actor.id] } });
  }
  if (prompt.kind === "alchemist-powerful-mix-damage" && choice === "damage") {
    const amount = Number(prompt.context?.amount || 0);
    if (!target || target.knockedOut || target.team === actor.team || Number(actor.techniques?.["altruist.alchemist"] || 0) < 2 || amount !== Number(actor.attrs?.mind || 0)) return { ok: false, errors: ["Цель или величина урона «Мощной смеси» больше не соответствует правилу."], events: [] };
    events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount, sourceActionId: "altruist.alchemist.2", participantIds: [actor.id, target.id] } });
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
    const originalTarget = actorById(scene, prompt.context?.originalTargetId), chainTarget = actorById(scene, choice.slice(7)), spell = actionByKey(data, "spell"), roll = request.roll;
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
    const marker = markerById(scene, prompt.context?.markerId), roll = request.roll, skirmish = actionByKey(data, "skirmish");
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
    const spell = actionByKey(data, "spell"), roll = request.roll;
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
    const skirmish = actionByKey(data, "skirmish"), roll = request.roll, basePunishment = Boolean(prompt.context?.basePunishment), sourceActionId = basePunishment ? "core.punishment" : "bulwark.stalwart-sentry.2";
    if (!target || target.knockedOut || !skirmish || !roll || !Array.isArray(roll.rolls)) return { ok: false, errors: ["Цель Наказания или бросок больше недоступны."], events: [] };
    if (choice === "punish-free") {
      if (clockStatus(scene, actor.id, "bulwark.stalwart-sentry.vigilance").value < 1) return { ok: false, errors: ["Бдительность уже пуста."], events: [] };
      events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "bulwark.stalwart-sentry.vigilance", delta: -1, sourceActionId: "bulwark.stalwart-sentry.2", reason: "Бесплатное Наказание" } });
    } else {
      const cost = actorActionCost(actor, skirmish);
      if (!resourceOperationStatus(scene, actor.id, { ...cost, operation: "spend" }).available) return { ok: false, errors: ["Наказание больше нельзя оплатить."], events: [] };
      if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: { ...cost, sourceActionId } });
    }
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: skirmish.id, actionName: skirmish.name, name: "Наказание", targetIds: [target.id], quick: true, quickReaction: true, ...(basePunishment ? {} : { quickSource: { techniqueId: "bulwark.stalwart-sentry", level: 2, name: "На посту" } }) } });
    events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: sourceActionId, participantIds: [actor.id, target.id] } });
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: skirmish.id, ...(basePunishment ? {} : { techniqueRuleId: "bulwark.stalwart-sentry.2", techniqueName: "На посту" }), name: "Наказание", targetIds: [target.id], roll: clone(roll), damage: Number(roll.successes || 0), quickReaction: true, punishmentStop: clone(prompt.context?.stop || null), participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "chronomancer-time-stop" && choice !== "pass") {
    const flow = clockStatus(scene, actor.id, "altruist.chronomancer.flow"), spell = actionByKey(data, "spell"), roll = request.roll, allIn = choice === "time-stop-all-in";
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
  if (prompt.kind === "alchemist-mix" && choice !== "pass") events.push({ type: "inventory.change", actorId: actor.id, payload: { item: `potion:${choice}`, delta: 1, sourceActionId: "altruist.alchemist.1" } });
  if (prompt.kind === "empath-calm" && choice !== "pass") {
    events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: target.id, effect: choice, sourceActionId: "altruist.empath.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "positive.усилен", sourceActionId: "altruist.empath.1", participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "siren-irresistible" && choice === "rush") {
    const frightenedEvent = (scene.log || []).find(event => event.id === prompt.context?.frightenedEventId);
    if (Number(actor.techniques?.["disruptor.siren"] || 0) < 2 || !target || target.knockedOut || target.space !== actor.space || frightenedEvent?.type !== "effect.apply" || frightenedEvent.actorId !== actor.id || frightenedEvent.payload?.targetId !== target.id || frightenedEvent.payload?.effect !== "negative.испуган" || !frightenedEvent.payload?.applied) return { ok: false, errors: ["Источник или цель «Неотразимой» больше не соответствуют сработавшему Испугу."], events: [] };
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
    const study = actionByKey(data, "study");
    const missEvent = (scene.log || []).find(event => event.id === prompt.context?.missEventId), pending = scene.pendingAction;
    if (Number(actor.techniques?.["vagabond.dim-mak"] || 0) < 2 || !target || target.knockedOut || target.team === actor.team || !study || missEvent?.type !== "damage.apply" || missEvent.actorId !== target.id || missEvent.payload?.targetId !== actor.id || missEvent.payload?.attackMiss !== true || pending?.id !== prompt.context?.pendingId || pending.actorId !== target.id) return { ok: false, errors: ["Промах, атакующий или право на Полевое исследование больше недоступны."], events: [] };
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
      const plan = prepareDisplacements(scene, enemies.map(enemy => ({ actorId: enemy.id, mode: "push", sourceActorId: actor.id, maximum: 3, allowPartial: true, allowBlocked: true, name: "Непостоянная мощь", ruleId: "ruiner.grim-ascendant.1", participantIds: [actor.id, enemy.id] })));
      if (!plan.ok) return { ok: false, errors: plan.errors, events: [] };
      for (const move of plan.events) {
        events.push(move);
        events.push({ type: "actor.enter", actorId: move.actorId, payload: { space: move.payload.space, x: move.payload.x, y: move.payload.y, movement: "Непостоянная мощь", forced: true } });
      }
      events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "ruiner.grim-ascendant.1", name: "Непостоянная мощь", affectedActorIds: plan.statuses.filter(status => status.available).map(status => status.actor.id), blockedActorIds: plan.statuses.filter(status => status.blocked).map(status => status.actor?.id).filter(Boolean), participantIds: [actor.id, ...enemies.map(enemy => enemy.id)] } });
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
  if (prompt.kind === "wisp-primary") {
    const learned = [...new Set(actor.techniqueState?.wispLearnedTypes || [])].filter(id => WISP_TYPES[id]);
    if (choice !== "pass" && (!learned.includes(choice) || Number(actor.techniques?.["altruist.will-o-wisp"] || 0) < 1)) return { ok: false, errors: ["Выбранный тип Духа не изучен владельцем Пламени."], events: [] };
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "wispCreationUsed", value: true, sourceActionId: "altruist.will-o-wisp.1" } });
    if (choice !== "pass" && Number(actor.techniques?.["altruist.will-o-wisp"] || 0) >= 3) {
      const secondOptions = ["single", ...learned.filter(id => id !== choice).flatMap(id => [`combine:${id}`, `split:${id}`])];
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-secondary`, kind: "wisp-secondary", sourceActorId: actor.id, title: "Парные духи", text: "Оставить один Дух, объединить два свойства или создать два отдельных Пламени?", options: secondOptions, context: { firstType: choice }, participantIds: [actor.id] } });
    } else if (choice !== "pass") {
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
  if (prompt.kind === "wisp-stop") {
    const candidates = prompt.context?.candidates || [], current = candidates[0], marker = markerById(scene, current?.markerId), exit = prompt.context?.exitCell;
    if (!target || target.knockedOut || !exit || target.space !== exit.space || Number(target.x) !== Number(exit.x) || Number(target.y) !== Number(exit.y) || current?.ownerActorId !== actor.id || !marker || marker.ownerActorId !== actor.id || Number(actor.techniques?.["altruist.will-o-wisp"] || 0) < 2) return { ok: false, errors: ["Пламя, владелец или остановленный персонаж больше не соответствуют прерванному перемещению."], events: [] };
    if (choice === "stop") {
      if (!resourceOperationStatus(scene, actor.id, { resource: "focus", amount: 1, operation: "spend" }).available) return { ok: false, errors: ["Для остановки больше не хватает Фокуса."], events: [] };
      events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "focus", amount: 1, sourceActionId: "altruist.will-o-wisp.2", reason: "Остановка при выходе из клетки Пламени", participantIds: [actor.id, target.id] } });
      events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "altruist.will-o-wisp.2", name: "Дружелюбные духи", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
    } else {
      const remainingCandidates = candidates.slice(1).filter(candidate => actorById(scene, candidate.ownerActorId) && markerById(scene, candidate.markerId));
      if (remainingCandidates.length) {
        const nextOwner = actorById(scene, remainingCandidates[0].ownerActorId);
        events.push({ type: "rule.prompt", actorId: nextOwner.id, payload: { id: `prompt-${prompt.id}-${nextOwner.id}`, kind: "wisp-stop", sourceActorId: nextOwner.id, targetId: target.id, title: "Дружелюбные духи", text: `Потратить 1 Фокус и остановить ${target.name} после выхода из клетки Пламени?`, options: ["stop", "pass"], context: { ...clone(prompt.context), candidates: remainingCandidates }, participantIds: [nextOwner.id, target.id] } });
      } else {
        const final = prompt.context?.finalDestination, maximum = (prompt.context?.remainingPath || []).length;
        const path = final && maximum > 0 ? movementPath(scene, target.id, final, { maxDistance: maximum, forced: Boolean(prompt.context?.forced) }) : [];
        if (final && maximum > 0 && !path.length) return { ok: false, errors: ["Оставшийся путь изменился и больше недоступен."], events: [] };
        if (path.length) {
          events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: final.x, y: final.y, movement: prompt.context?.movement || "Продолжение перемещения", forced: Boolean(prompt.context?.forced), path: path.map(cellKey), participantIds: [actor.id, target.id] } });
          events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: final.x, y: final.y, movement: prompt.context?.movement || "Продолжение перемещения", forced: Boolean(prompt.context?.forced) } });
        }
      }
    }
  }
  if (prompt.kind === "constrictor-follow" && choice === "pull") {
    const targetIds = [...new Set(prompt.context?.targetIds || [])].filter(id => actorById(scene, id));
    const plan = prepareDisplacements(scene, targetIds.map(targetId => ({ actorId: targetId, mode: "pull", sourceActorId: actor.id, maximum: 99, allowPartial: true, optional: true, name: "Обвить · притягивание", ruleId: "disruptor.constrictor.1", participantIds: [actor.id, targetId] })));
    if (!plan.ok) return { ok: false, errors: plan.errors, events: [] };
    for (const move of plan.events) {
      events.push(move);
      events.push({ type: "actor.enter", actorId: move.actorId, payload: { space: move.payload.space, x: move.payload.x, y: move.payload.y, movement: "Обвить · притягивание", forced: true } });
    }
  }
  if (prompt.kind === "constrictor-move-select" && choice !== "pass") {
    const remainingTargetIds = [...new Set(prompt.context?.targetIds || prompt.options || [])].filter(id => id !== choice && actorById(scene, id));
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-${choice}-cell`, kind: "constrictor-move-cell", sourceActorId: actor.id, targetId: choice, title: "Обвить · перемещение", text: `Переместите ${actorById(scene, choice)?.name || "Пойманного"} на расстояние до 5 клеток.`, options: ["cancel"], context: { maxDistance: 5, remainingTargetIds }, participantIds: [actor.id, choice] } });
  }
  if (prompt.kind === "empath-rush" && choice === "rush") events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-cell`, kind: "empath-rush-cell", sourceActorId: actor.id, targetId: target.id, title: "Защитный отклик · Прорыв", text: `Выберите свободную клетку, смежную с ${target.name}, в пределах Скорости.`, options: ["cancel"], context: { targetId: target.id, maxDistance: Number(actor.speed || 0) }, participantIds: [actor.id, target.id] } });
  if (prompt.kind === "hunter-trap" && choice === "attack") {
    const trap = markerById(scene, prompt.markerId);
    if (!target || target.knockedOut || Number(actor.techniques?.["disruptor.hunter"] || 0) < 1 || !trap || trap.ownerActorId !== actor.id || trap.kind !== "trap" || !/disruptor\.hunter\.1/.test(`${trap.ruleId || ""} ${trap.source || ""}`) || target.team === actor.team || trap.space !== target.space || Number(trap.x) !== Number(target.x) || Number(trap.y) !== Number(target.y)) return { ok: false, errors: ["Цель или принадлежащая Охотнику ловушка уже недоступны."], events: [] };
    const roll = request.roll;
    if (!roll || !Array.isArray(roll.rolls) || !roll.dice || roll.dice.attribute && !["body", "talent"].includes(roll.dice.attribute)) return { ok: false, errors: ["Для Стычки от ловушки нужен проверяемый бросок Тела или Таланта."], events: [] };
    events.push({ type: "action.prepare", actorId: actor.id, payload: { actionId: "action.атаки.стычка", actionName: "Стычка", name: "Стальные челюсти", targetIds: [target.id], quick: true, quickReaction: true, quickSource: { techniqueId: "disruptor.hunter", level: 1, name: "Стальные челюсти" } } });
    events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: "disruptor.hunter.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: "action.атаки.стычка", techniqueRuleId: "disruptor.hunter.1", techniqueName: "Стальные челюсти", name: "Стальные челюсти", targetIds: [target.id], roll: clone(roll), damage: Number(roll.successes || 0), effects: Number(actor.techniques?.["disruptor.hunter"] || 0) >= 2 ? ["negative.обездвижен"] : [], quickReaction: true, participantIds: [actor.id, target.id] } });
    events.push({ type: "roll.public", actorId: actor.id, payload: clone(roll) });
  }
  if (prompt.kind === "wave-rider-consent" && choice === "consent") {
    const owner = actorById(scene, prompt.context?.ownerActorId), entrant = actorById(scene, prompt.context?.entrantActorId), seal = markerById(scene, prompt.context?.markerId);
    if (!owner || owner.knockedOut || !entrant || entrant.knockedOut || entrant.id !== actor.id || !seal || seal.ownerActorId !== owner.id || seal.space !== entrant.space || Number(seal.x) !== Number(entrant.x) || Number(seal.y) !== Number(entrant.y)) return { ok: false, errors: ["Участники или Печать волны больше недоступны."], events: [] };
    events.push({ type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${prompt.id}-resolve`, kind: "wave-rider-seal", sourceActorId: owner.id, targetId: entrant.id, markerId: seal.id, title: "Печать волны", text: `${entrant.name} согласился: убрать Печать, чтобы наложить Подброшен или переместить персонажа до 2 клеток по линии?`, options: ["knockdown", "move", "pass"], context: { ...prompt.context }, participantIds: [owner.id, entrant.id] } });
  }
  if (prompt.kind === "wave-rider-seal" && choice === "knockdown") {
    const seal = markerById(scene, prompt.context?.markerId);
    if (!actor || !target || target.knockedOut || !seal || seal.ownerActorId !== actor.id || seal.space !== target.space || Number(seal.x) !== Number(target.x) || Number(seal.y) !== Number(target.y)) return { ok: false, errors: ["Цель или Печать волны больше недоступны."], events: [] };
    events.push({ type: "marker.remove", actorId: actor.id, payload: { markerId: seal.id, label: "Печать волны", sourceActionId: "disruptor.wave-rider.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.подброшен", sourceActionId: "disruptor.wave-rider.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.wave-rider.1", name: "Мягкие волны", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "wave-rider-seal" && choice === "move") {
    const seal = markerById(scene, prompt.context?.markerId);
    if (!target || target.knockedOut || !seal || seal.ownerActorId !== actor.id || seal.space !== target.space || Number(seal.x) !== Number(target.x) || Number(seal.y) !== Number(target.y)) return { ok: false, errors: ["Цель или Печать волны больше недоступны."], events: [] };
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-wave-move`, kind: "wave-rider-move-cell", sourceActorId: actor.id, targetId: target.id, markerId: seal.id, title: "Печать волны · перемещение", text: `Выберите для ${target.name} достижимую клетку не дальше 2 клеток по линии от Печати волны.`, options: ["cancel"], context: { markerId: seal.id, seal: { space: seal.space, x: seal.x, y: seal.y } }, participantIds: [actor.id, target.id] } });
  }
  if (prompt.kind === "gale-strider-shift" && choice !== "pass") {
    const vectors = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0], "north-east": [1, -1], "south-east": [1, 1], "south-west": [-1, 1], "north-west": [-1, -1] }, [dx, dy] = vectors[choice] || [0, 0];
    const space = (scene.spaces || []).find(item => item.id === prompt.context?.space), spaceId = prompt.context?.space;
    const typhoon = (scene.objects || []).find(object => object.id === prompt.context?.typhoonId && object.ownerActorId === actor.id && object.space === spaceId && object.type === "danger" && /Тайфун|gale-strider|Растущие ветра/.test(`${object.label || ""} ${object.ruleId || object.source || ""}`));
    if (!typhoon) return { ok: false, errors: ["Тайфун больше не существует или сменил владельца."], events: [] };
    const targets = (scene.actors || []).filter(target => !target.knockedOut && (prompt.context?.targetIds || []).includes(target.id) && target.space === spaceId && (typhoon.cells || []).includes(`${target.x},${target.y}`)).sort((left, right) => Number(right.x) * dx + Number(right.y) * dy - (Number(left.x) * dx + Number(left.y) * dy));
    const workingScene = clone(scene), movedIds = [];
    for (const original of targets) {
      const mover = actorById(workingScene, original.id);
      const nx = Number(mover.x) + dx, ny = Number(mover.y) + dy;
      const movement = effectMovementStatus(workingScene, mover.id, { forced: true, distance: 1 });
      const blocked = !space || !movement.available || nx < 0 || ny < 0 || nx >= Number(space.width) || ny >= Number(space.height) || removedCellKeys(workingScene, spaceId).has(`${nx},${ny}`) || !effectCellOccupancyStatus(workingScene, mover.id, { space: spaceId, x: nx, y: ny }).available;
      if (blocked) continue;
      Object.assign(mover, { x: nx, y: ny });
      movedIds.push(mover.id);
      events.push({ type: "actor.move", actorId: mover.id, payload: { space: spaceId, x: nx, y: ny, movement: "Растущие ветра", forced: true, participantIds: [actor.id, ...targets.map(item => item.id)] } });
      events.push({ type: "actor.enter", actorId: mover.id, payload: { space: spaceId, x: nx, y: ny, movement: "Растущие ветра", forced: true } });
    }
    if (movedIds.length) events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.gale-strider.1", name: "Растущие ветра", affectedActorIds: movedIds, participantIds: [actor.id, ...targets.map(mover => mover.id)] } });
  }
  return { ok: true, errors: [], events };
}

function preparePromptPlacement(scene, request = {}) {
  const prompt = scene.pendingPrompt, actor = actorById(scene, prompt?.sourceActorId), marker = markerById(scene, prompt?.context?.markerId), target = actorById(scene, prompt?.targetId || prompt?.context?.targetId), destination = request.destination && { x: Number(request.destination.x), y: Number(request.destination.y) }, errors = [];
  const space = (scene.spaces || []).find(item => item.id === (marker?.space || actor?.space));
  if (!prompt || !actor || !["marker-move-cell", "dim-mak-weak-point-cell", "empath-rush-cell", "reappear-cell", "knife-pickup-step", "meister-overclock-move", "egomaniac-style-move", "thunder-surge-cell", "siren-irresistible-cell", "untouchable-weave-cell", "constrictor-move-cell", "enemy-move-cell", "wave-rider-move-cell"].includes(prompt.kind)) errors.push("Сейчас нет выбора клетки для правила.");
  if (!space || !destination || !Number.isInteger(destination.x) || !Number.isInteger(destination.y) || destination.x < 0 || destination.y < 0 || destination.x >= Number(space?.width || 0) || destination.y >= Number(space?.height || 0)) errors.push("Выберите клетку в пределах поля.");
  if (space && destination && removedCellKeys(scene, space.id).has(cellKey(destination))) errors.push("Эта клетка удалена из поля.");
  const movingActor = ["siren-irresistible-cell", "constrictor-move-cell", "wave-rider-move-cell"].includes(prompt?.kind) || prompt?.kind === "enemy-move-cell" && prompt.context?.moveTarget ? target : actor;
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
  let constrictorPath = [];
  if (prompt?.kind === "constrictor-move-cell") {
    if (!target || !effectStateFor(target, "negative.пойман")?.sources.some(source => source.actorId === actor.id)) errors.push("Цель больше не Поймана этим персонажем.");
    else {
      const unchanged = target.x === destination?.x && target.y === destination?.y;
      constrictorPath = unchanged ? [] : movementPath(scene, target.id, destination, { forced: true, maxDistance: Number(prompt.context?.maxDistance || 5) });
      if (!unchanged && !constrictorPath.length) errors.push("Пойманного можно переместить не дальше 5 клеток по доступному пути.");
      if (unchanged) errors.push("Чтобы оставить Пойманного на месте, выберите «Не использовать» на предыдущем шаге.");
    }
  }
  let enemyMovePath = [];
  if (prompt?.kind === "enemy-move-cell") {
    const mover = movingActor, unchanged = mover.x === destination?.x && mover.y === destination?.y;
    const maximum = effectMovementStatus(scene, mover.id, { forced: Boolean(prompt.context?.moveTarget), distance: Number(prompt.context?.maxDistance || 1) }).distance;
    enemyMovePath = unchanged ? [] : movementPath(scene, mover.id, destination, { maxDistance: maximum, forced: Boolean(prompt.context?.moveTarget) });
    if (!unchanged && !enemyMovePath.length) errors.push(`Выберите достижимую клетку в пределах ${maximum}.`);
  }
  let wavePath = [];
  if (prompt?.kind === "wave-rider-move-cell") {
    const seal = prompt.context?.seal || { space: actor.space, x: actor.x, y: actor.y };
    const dx = Number(destination?.x) - Number(seal.x), dy = Number(destination?.y) - Number(seal.y);
    const marker = markerById(scene, prompt.context?.markerId);
    if (!target || target.knockedOut || !marker || marker.ownerActorId !== actor.id || marker.space !== target.space || Number(marker.x) !== Number(target.x) || Number(marker.y) !== Number(target.y)) errors.push("Цель или Печать волны больше недоступны.");
    if (distance({ ...seal, space: actor.space }, { ...destination, space: actor.space }) > 2) errors.push("Перемещение Печатью волны ограничено 2 клетками.");
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) errors.push("Перемещение Печатью волны идёт по прямой линии от Печати.");
    if (target && destination && Number(target.x) === Number(destination.x) && Number(target.y) === Number(destination.y)) errors.push("Выберите другую клетку или отмените перемещение.");
    if (target && destination) {
      wavePath = movementPath(scene, target.id, destination, { maxDistance: 2, forced: true, straight: true });
      if (!wavePath.length) errors.push("До выбранной клетки нельзя переместить персонажа по прямой.");
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
  } else if (prompt.kind === "constrictor-move-cell") {
    if (constrictorPath.length) {
      events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Обвить · конец Хода", forced: true, path: constrictorPath.map(cellKey), topologyCrossings: constrictorPath.filter(point => point.teleported).map(point => ({ destination: cellKey(point), cutIds: point.crossedCutIds || [] })), participantIds: [actor.id, target.id] } });
      events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Обвить · конец Хода", forced: true } });
    }
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.constrictor.1", name: "Обвить", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
    const remaining = [...new Set(prompt.context?.remainingTargetIds || [])].filter(id => actorById(scene, id));
    if (remaining.length) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${prompt.id}-next`, kind: "constrictor-move-select", sourceActorId: actor.id, title: "Обвить · конец Хода", text: "Можно переместить следующего Пойманного персонажа на расстояние до 5 клеток.", options: [...remaining, "pass"], context: { targetIds: remaining }, participantIds: [actor.id, ...remaining] } });
  } else if (prompt.kind === "untouchable-weave-cell") {
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Маятник", path: weavePath.map(cellKey), topologyCrossings: weavePath.filter(point => point.teleported).map(point => ({ destination: cellKey(point), cutIds: point.crossedCutIds || [] })), participantIds: [actor.id] } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Маятник" } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "vagabond.untouchable.2", name: "Маятник", affectedActorIds: [actor.id], participantIds: [actor.id] } });
  } else if (prompt.kind === "wave-rider-move-cell") {
    events.push({ type: "marker.remove", actorId: actor.id, payload: { markerId: prompt.context.markerId, label: "Печать волны", sourceActionId: "disruptor.wave-rider.1", participantIds: [actor.id, target.id] } });
    events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Печать волны", forced: true, path: wavePath.map(cellKey), participantIds: [actor.id, target.id] } });
    events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Печать волны", forced: true } });
    events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "disruptor.wave-rider.1", name: "Мягкие волны", affectedActorIds: [target.id], participantIds: [actor.id, target.id] } });
  } else {
    const mover = prompt.kind === "enemy-move-cell" && prompt.context?.moveTarget ? target : actor, forced = Boolean(prompt.kind === "enemy-move-cell" && prompt.context?.moveTarget);
    events.push({ type: "actor.move", actorId: mover.id, payload: { space: mover.space, x: destination.x, y: destination.y, movement: prompt.kind === "thunder-surge-cell" ? "Телепортация · Скачок" : prompt.title, path: prompt.kind === "enemy-move-cell" ? enemyMovePath.map(cellKey) : undefined, placement: ["reappear-cell", "thunder-surge-cell"].includes(prompt.kind), forced, participantIds: [actor.id, target?.id].filter(Boolean) } });
    events.push({ type: "actor.enter", actorId: mover.id, payload: { space: mover.space, x: destination.x, y: destination.y, movement: prompt.title, forced } });
    if (prompt.kind === "reappear-cell") events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: "reappear", participantIds: [actor.id] } });
  }
  return { ok: true, errors: [], events };
}

function preparePotionUse(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId), target = actorById(scene, request.targetId), potion = String(request.potion || ""), interaction = actionByKey(data, "interact");
  const errors = [], stockKey = `potion:${potion}`, canonicalPotions = new Set(["pure-water", ...Object.keys(POTION_EFFECTS)]);
  if (!actor || !target || !interaction) errors.push("Не найдены алхимик, цель или Взаимодействие.");
  if (!canonicalPotions.has(potion)) errors.push("Неизвестный тип Зелья.");
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
  }
  events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: interaction.id, name: interaction.name, targetIds: [target.id], alchemistPowerfulMixTargetId: Number(actor.techniques?.["altruist.alchemist"] || 0) >= 2 && target.team !== actor.team ? target.id : null } });
  events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: "altruist.alchemist.1", name: "Быстрая смесь", affectedActorIds: [target.id] } });
  return { ok: true, errors: [], events };
}

function prepareSurgery(scene, data, request = {}) {
  const actor = actorById(scene, request.actorId), target = actorById(scene, request.targetId), skirmish = actionByKey(data, "skirmish"), roll = request.roll, errors = [];
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
  const source = actorById(scene, pending?.actorId);
  const requestedChoiceId = canonicalActionId(request.choice), option = reactionOptions(scene, data, request.actorId).find(item => item.id === requestedChoiceId);
  const errors = [];
  if (!pending || !actor) errors.push("Нет ожидающей Реакции для персонажа.");
  if (!option) errors.push("Неизвестный ответ на Реакцию.");
  if (option && !option.available) errors.push(option.reason || "Реакция недоступна.");
  const traitReaction = option?.enemyTrait || null, giftReaction = option?.giftReaction || null;
  const reactionActor = actorById(scene, traitReaction?.reactionActorId) || actor;
  const defender = actorById(scene, traitReaction?.defenderActorId) || actor;
  if (traitReaction && (!reactionActor || reactionActor.knockedOut || !defender || defender.knockedOut)) errors.push("Участник особой Реакции больше не доступен.");
  if (option?.requiresDestination) {
    const destination = request.destination, mover = traitReaction?.postMove ? reactionActor : defender;
    const space = (scene.spaces || []).find(item => item.id === mover?.space);
    if (!destination || !space || !Number.isInteger(Number(destination.x)) || !Number.isInteger(Number(destination.y)) || Number(destination.x) < 0 || Number(destination.y) < 0 || Number(destination.x) >= Number(space.width) || Number(destination.y) >= Number(space.height)) errors.push("Выберите клетку назначения особой Реакции.");
    else if (!effectCellOccupancyStatus(scene, mover.id, { space: mover.space, x: destination.x, y: destination.y }).available) errors.push("Клетка особой Реакции занята.");
    else if (option.destinationKind === "move" && !movementPath(scene, mover.id, destination, { maxDistance: option.maxDistance }).length && (Number(destination.x) !== Number(mover.x) || Number(destination.y) !== Number(mover.y))) errors.push(`Для этой Реакции выберите достижимую клетку в пределах ${option.maxDistance} клеток.`);
    else if (option.destinationKind === "edge" && ![0, Number(space.width) - 1].includes(Number(destination.x)) && ![0, Number(space.height) - 1].includes(Number(destination.y))) errors.push("Для этой Реакции выберите свободную клетку на краю поля.");
    else if (option.destinationKind === "adjacent-attacker" && (!source || source.space !== mover.space || distance(source, { ...destination, space: mover.space }) > 1)) errors.push("Перехватчик должен телепортироваться смежно с атакующим.");
    else if (option.destinationKind === "adjacent-trait-owner" && (!reactionActor || reactionActor.space !== mover.space || distance(reactionActor, { ...destination, space: mover.space }) > 1)) errors.push("Союзник должен телепортироваться смежно с владельцем Черты.");
  }
  if (actionIs(option, "dodge")) {
    const destination = request.destination;
    const space = (scene.spaces || []).find(item => item.id === actor?.space);
    const baseDodgeDistance = Number(actor?.techniques?.["vagabond.untouchable"] || 0) >= 2 ? 3 : 2, dodgeDistance = actor ? effectMovementStatus(scene, actor.id, { distance: baseDodgeDistance }).distance : 0, path = actor && destination ? movementPath(scene, actor.id, destination, { maxDistance: dodgeDistance }) : [];
    if (!destination || !space || !path.length || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push(`Для Уворота выберите достижимую свободную клетку в пределах ${dodgeDistance} клеток.`);
    else if (!effectCellOccupancyStatus(scene, actor.id, { space: actor.space, x: destination.x, y: destination.y }).available) errors.push("Клетка Уворота занята.");
  }
  if (actionIs(option, "clash") || ["clash", "intercept-clash"].includes(traitReaction?.mode)) {
    const clash = request.clash;
    if (!source) errors.push("Атакующий для Столкновения не найден.");
    else if (!traitReaction && distance(actor, source) > 5) errors.push("Атакующий вне дальности Стычки или Заклинания для Столкновения.");
    if (!clash?.defenderRoll || !clash?.attackerRoll || !Array.isArray(clash.defenderRoll.rolls) || !Array.isArray(clash.attackerRoll.rolls)) errors.push("Для Столкновения нужны оба встречных броска.");
  }
  if (errors.length) return { ok: false, errors, events: [] };
  const events = [];
  if (giftReaction) {
    const protector = actorById(scene, giftReaction.reactionActorId), options = [], optionLabels = {}, questions = ["Нападающий назван по имени?", "У защитницы нет Связи с нападающим?", "По мнению Нарратора, Атака могла её убить?"];
    if (!protector || protector.knockedOut || !(protector.gifts || []).includes("rebel.not-today")) return { ok: false, errors: ["Владелица «Не сегодня» больше не может защитить цель."], events: [] };
    for (let mask = 0; mask < 8; mask++) { const bits = [0, 1, 2].map(bit => mask & (1 << bit) ? "1" : "0").join(""); options.push(`answers:${bits}`); optionLabels[`answers:${bits}`] = questions.map((question, index) => `${bits[index] === "1" ? "Да" : "Нет"}: ${question}`).join(" · "); }
    events.push({ type: "rule.prompt", actorId: protector.id, payload: { id: `prompt-${pending.id}-not-today-${actor.id}`, kind: "not-today-risk", sourceActorId: protector.id, controller: "narrator", title: "Не сегодня · вопросы риска", text: `${protector.name} становится целью вместо ${actor.name}, а Атака сводится на нет. Отметьте ответы на три канонических вопроса; за каждое «да» будет брошена кость.`, options, context: { originalTargetId: actor.id, attackerId: source?.id || null, optionLabels }, participantIds: [source?.id, actor.id, protector.id].filter(Boolean) } });
  }
  const untouchableEvasion = actionIs(option, "dodge") && Number(actor?.techniques?.["vagabond.untouchable"] || 0) >= 1 && !currentRoundEvents(scene).some(event => event.type === "reaction.respond" && event.actorId === actor.id && actionIdIs(event.payload?.choice, "dodge") && Number(event.payload?.untouchableEvasion || 0) > 0) ? Math.ceil(Number(actor.attrs?.talent || 0) / 2) : 0;
  if (option.costModel?.resource && option.costModel.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: option.costModel });
  if (actionIs(option, "dodge")) {
    const baseDodgeDistance = Number(actor?.techniques?.["vagabond.untouchable"] || 0) >= 2 ? 3 : 2, dodgeDistance = effectMovementStatus(scene, actor.id, { distance: baseDodgeDistance }).distance, path = movementPath(scene, actor.id, request.destination, { maxDistance: dodgeDistance });
    events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y, movement: "Уворот", path: path.map(cellKey) } });
    events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y } });
    const gainedEvasion = Math.ceil(Math.max(Number(actor.attrs?.talent || 0), Number(actor.attrs?.mind || 0)) / 2) + untouchableEvasion;
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "evasion", delta: gainedEvasion, sourceActionId: option.id, reason: "Уворот", participantIds: [actor.id, pending.actorId].filter(Boolean) } });
  }
  let responseDestination = request.destination || null;
  if (actionIs(option, "block")) {
    const destination = pushDestination(scene, actor, source, 1);
    if (destination.distance > 0) {
      responseDestination = destination;
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Блок · отталкивание", forced: true, displacement: { mode: "push", direction: destination.direction, distance: destination.distance, ruleId: "action.block" }, path: (destination.path || []).map(cellKey), topologyCrossings: destination.topologyCrossings || [] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y } });
    }
  }
  if (traitReaction?.redirectTargetId && request.destination) {
    events.push({ type: "actor.move", actorId: defender.id, payload: { space: defender.space, x: Number(request.destination.x), y: Number(request.destination.y), movement: traitReaction.mode === "redirect-ally" ? "«Почетная» жертва" : traitReaction.ruleName, placement: true, teleport: true, participantIds: [pending.actorId, actor.id, reactionActor.id, defender.id] } });
    events.push({ type: "actor.enter", actorId: defender.id, payload: { space: defender.space, x: Number(request.destination.x), y: Number(request.destination.y), movement: traitReaction.ruleName, placement: true, teleport: true } });
  }
  let clash = null;
  if (actionIs(option, "clash") || ["clash", "intercept-clash"].includes(traitReaction?.mode)) {
    const defenderRoll = clone(request.clash.defenderRoll), attackerRoll = clone(request.clash.attackerRoll);
    const defenderWins = Number(defenderRoll.successes || 0) > Number(attackerRoll.successes || 0);
    clash = { defenderRoll, attackerRoll, defenderWins };
    events.push({ type: "roll.public", actorId: defender.id, payload: { ...defenderRoll, outcome: defenderWins ? "Столкновение выиграно: исходная Атака отменена" : "Столкновение проиграно" } });
    events.push({ type: "roll.public", actorId: pending.actorId, payload: { ...attackerRoll, outcome: defenderWins ? "Столкновение проиграно" : "Столкновение выиграно" } });
  }
  events.push({ type: "reaction.respond", actorId: actor.id, payload: {
    choice: option.id,
    label: option.name,
    destination: responseDestination,
    clash,
    untouchableEvasion,
    temporaryArmor: Number(traitReaction?.temporaryArmor || 0),
    temporaryEvasion: Number(traitReaction?.temporaryEvasion || 0),
    redirectTargetId: traitReaction?.redirectTargetId || giftReaction?.reactionActorId || null,
    enemyTrait: traitReaction ? { ...traitReaction, clash: ["clash", "intercept-clash"].includes(traitReaction.mode) } : null,
    giftReaction,
    participantIds: [...new Set([pending.actorId, actor.id, reactionActor?.id, defender?.id].filter(Boolean))],
  } });
  if (clash?.defenderWins && defender.team === "hero") {
    const attacker = actorById(scene, pending.actorId), options = ["pass"], optionLabels = { pass: "Не атаковать" };
    if (attacker && attacker.space === defender.space && distance(defender, attacker) <= 1) { options.unshift("skirmish"); optionLabels.skirmish = "Ответная Стычка"; }
    if (attacker && attacker.space === defender.space && distance(defender, attacker) <= 5) { options.splice(options.length - 1, 0, "spell"); optionLabels.spell = "Ответное Заклинание"; }
    events.push({ type: "rule.prompt", actorId: defender.id, payload: { id: `prompt-clash-${pending.id || pending.actorId}-${defender.id}`, kind: "clash-counterattack", sourceActorId: defender.id, targetId: pending.actorId, controller: defender.team === "hero" ? "source" : "narrator", title: "Ответ Столкновения", text: "Исходная Атака отменена. По правилам победитель может бесплатно провести Стычку или Заклинание против атакующего.", options, context: { attackerId: pending.actorId, optionLabels }, participantIds: [defender.id, pending.actorId] } });
  }
  const pendingRoll = events.find(event => event.type === "attack.pending" && event.payload?.roll?.rolls)?.payload.roll;
  if (pendingRoll && !events.some(event => event.type === "roll.public" && JSON.stringify(event.payload?.rolls || []) === JSON.stringify(pendingRoll.rolls || []))) events.push({ type: "roll.public", actorId: actor.id, payload: clone(pendingRoll) });
  return { ok: true, errors: [], events };
}

function resolvePendingAction(scene, data) {
  const status = pendingActionStatus(scene, data), pending = status.pending;
  const errors = [];
  if (!pending) errors.push("Нет ожидающего действия.");
  if (errors.length) return { ok: false, errors, events: [] };
  if (status.mustCancel) return cancelPendingAction(scene, { reason: status.interruptedReason || "Все цели Атаки уже недоступны" });
  if (status.waitingIds.length) errors.push("Не все доступные цели ответили на Реакцию.");
  if (errors.length) return { ok: false, errors, events: [] };
  const source = status.source;
  const events = [];
  let autophageRegeneration = false;
  let postSelfHeal = false;
  const successfulEnemyTargets = [];
  if (pending.roll) events.push({ type: "roll.public", actorId: pending.actorId, payload: pending.roll });
  for (const targetId of status.eligibleIds) {
    const outcome = pendingTargetOutcome(scene, pending, targetId), target = outcome.target, resolvedTargetId = target?.id || targetId, traitReaction = outcome.reaction?.enemyTrait;
    if (!outcome.cancelled) {
      const { rawDamage, temporaryArmor, temporaryEvasion, expectedDamage } = outcome;
      events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, amount: rawDamage, temporaryArmor, temporaryEvasion, dodgeEvasion: actionIdIs(outcome.response,"dodge"), attackMiss: expectedDamage === 0, attackPendingId: pending.id, sourceActionId: pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      const attackSucceeded = Number(pending.roll?.successes || 0) > 0 || !pending.roll && rawDamage > 0;
      const enemyFamily = pending.enemyAttackFamily || {};
      if (expectedDamage > 0) successfulEnemyTargets.push(resolvedTargetId);
      if (expectedDamage > 0 && Number(source?.techniques?.["disruptor.autophage"] || 0) >= 1 && new Set(target.effects || []).size >= 2) autophageRegeneration = true;
      if (expectedDamage > 0 && pending.postResourceLoss?.resource && Number(pending.postResourceLoss.amount) > 0) {
        const requested = Number(pending.postResourceLoss.amount), balance = Number(resourceOperationStatus(scene, resolvedTargetId, { resource: pending.postResourceLoss.resource, amount: requested, operation: "spend" }).balance || 0), amount = Math.min(requested, balance);
        if (amount > 0) events.push({ type: "resource.spend", actorId: resolvedTargetId, payload: { resource: pending.postResourceLoss.resource, amount, sourceActionId: pending.postResourceLoss.ruleId || pending.enemyRuleId || pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      }
      if (expectedDamage > 0 && Number(pending.postSelfHealMissingFraction) > 0) postSelfHeal = true;
      if (expectedDamage > 0) for (const effect of pending.effects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect, sourceActionId: pending.actionId } });
      if (expectedDamage > 0 && enemyFamily.conditionalSingleEffect && status.eligibleIds.length === 1) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect: effectIdByName(data, enemyFamily.conditionalSingleEffect), sourceActionId: pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      if (expectedDamage > 0 && enemyFamily.enemyEffects) for (const effect of enemyFamily.enemyEffects) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect: effectIdByName(data, effect), sourceActionId: pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      if (expectedDamage > 0 && enemyFamily.conditionalEffectsByTarget?.any?.some(name => (target.effects || []).includes(effectIdByName(data, name)))) for (const effect of enemyFamily.conditionalEffectsByTarget.apply || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect: effectIdByName(data, effect), sourceActionId: pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      if (expectedDamage > 0 && enemyFamily.markedSlow) {
        const marked = effectStateFor(target, "negative.помечен"), ownedMark = marked ? marked.sources.some(item => item.actorId === pending.actorId) : (target.effects || []).includes("negative.помечен");
        if (ownedMark) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect: "negative.замедлен", sourceActionId: pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      }
      const wound = enemyFamily.wound === "always"
        || enemyFamily.wound === "two-crits" && Number(pending.roll?.crits || 0) >= 2
        || enemyFamily.wound === "already-corrupted" && (target.effects || []).includes("negative.порчен")
        || enemyFamily.wound === "isolated" && !(scene.actors || []).some(other => other.id !== target.id && other.id !== pending.actorId && !other.knockedOut && other.space === target.space && distance(other, target) <= 1);
      if (expectedDamage > 0 && wound) events.push({ type: "actor.wound", actorId: pending.actorId, payload: { targetId: resolvedTargetId, delta: 1, sourceActionId: pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      if (attackSucceeded) for (const effect of pending.successEffects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect, sourceActionId: pending.techniqueRuleId || pending.actionId } });
      for (const effect of pending.postTargetEffects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect, sourceActionId: pending.techniqueRuleId || pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      if (attackSucceeded && status.eligibleIds.length === 1 && Number(source?.techniques?.["disruptor.constrictor"] || 0) >= 1 && (pending.declaredActionName || pending.name) === "Стычка") events.push({ type: "effect.apply", actorId: source.id, payload: { targetId: resolvedTargetId, effect: "negative.пойман", sourceActionId: "disruptor.constrictor.1", participantIds: [source.id, resolvedTargetId] } });
      const postDisplacement = (pending.postDisplacements || []).find(item => item.targetId === targetId) || (pending.postPush?.targetId === targetId ? { mode: "push", collisionDamagePerCell: 1, ...pending.postPush } : null);
      if (expectedDamage > 0 && postDisplacement && (!postDisplacement.requiresSuccess || attackSucceeded)) {
        const destination = postDisplacement.mode === "push" ? pushDestination(scene, target, source, Number(postDisplacement.maximum || 99)) : null;
        if (destination?.distance) {
          const movementName = postDisplacement.name || "Принудительное движение", ruleId = postDisplacement.ruleId || pending.techniqueRuleId || pending.enemyRuleId || pending.actionId;
          events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: movementName, forced: true, displacement: { mode: "push", direction: destination.direction, distance: destination.distance, ruleId }, path: (destination.path || []).map(cellKey), topologyCrossings: destination.topologyCrossings || [], participantIds: [pending.actorId, target.id] } });
          events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: movementName, forced: true } });
          const collisionDamage = destination.distance * Number(postDisplacement.collisionDamagePerCell || 0);
          if (collisionDamage > 0) events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, amount: collisionDamage, ignoreArmor: true, sourceActionId: ruleId, participantIds: [pending.actorId, target.id] } });
        }
        if (enemyFamily.stunOnIncompletePush && Number(destination?.distance || 0) < Number(postDisplacement.maximum || 0)) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: resolvedTargetId, effect: "negative.ошеломлен", sourceActionId: pending.enemyRuleId || pending.actionId, participantIds: [pending.actorId, resolvedTargetId] } });
      }
      if (traitReaction?.mode === "armor-corrupt" && outcome.raw > 1 && expectedDamage === 1 && source) events.push({ type: "effect.apply", actorId: target.id, payload: { targetId: source.id, effect: "negative.порчен", sourceActionId: traitReaction.ruleId, participantIds: [source.id, target.id] } });
      if (traitReaction?.mode === "armor-repel" && outcome.raw > 1 && expectedDamage === 1 && source) {
        const destination = pushDestination(scene, source, target, 3);
        if (destination.distance) {
          events.push({ type: "actor.move", actorId: source.id, payload: { space: source.space, x: destination.x, y: destination.y, movement: traitReaction.ruleName, forced: true, displacement: { mode: "push", direction: destination.direction, distance: destination.distance, ruleId: traitReaction.ruleId }, path: (destination.path || []).map(cellKey), topologyCrossings: destination.topologyCrossings || [], participantIds: [source.id, target.id] } });
          events.push({ type: "actor.enter", actorId: source.id, payload: { space: source.space, x: destination.x, y: destination.y, movement: traitReaction.ruleName, forced: true } });
        }
        events.push({ type: "effect.apply", actorId: target.id, payload: { targetId: source.id, effect: "negative.замедлен", sourceActionId: traitReaction.ruleId, participantIds: [source.id, target.id] } });
      }
      if (traitReaction?.postMove && expectedDamage === 0 && outcome.reaction?.destination) {
        const destination = outcome.reaction.destination;
        if (traitReaction.mode === "evasion-move") {
          const path = movementPath(scene, target.id, destination, { maxDistance: Number(traitReaction.maxDistance || 3) });
          if (path.length) {
            events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: traitReaction.ruleName, path: path.map(cellKey), participantIds: [source.id, target.id] } });
            events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: traitReaction.ruleName } });
          }
        } else if (traitReaction.mode === "evasion-vanish") {
          events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: traitReaction.ruleName, placement: true, teleport: true, participantIds: [source.id, target.id] } });
          events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: traitReaction.ruleName, placement: true, teleport: true } });
          events.push({ type: "effect.apply", actorId: target.id, payload: { targetId: target.id, effect: "positive.исчез", sourceActionId: traitReaction.ruleId, participantIds: [target.id] } });
        }
      }
    }
  }
  const enemyFamily = pending.enemyAttackFamily || {};
  if (enemyFamily.healerMark) for (const targetId of successfulEnemyTargets) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect: "negative.помечен", sourceActionId: pending.actionId, duration: "scene", participantIds: [pending.actorId, targetId] } });
  if (enemyFamily.flux) for (const targetId of successfulEnemyTargets) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect: "special.поток", sourceActionId: pending.actionId, duration: "scene", participantIds: [pending.actorId, targetId] } });
  if (enemyFamily.expelFromArea && pending.attackAnchor && source) {
    const space = (scene.spaces || []).find(item => item.id === source.space), selected = new Set(areaCells(space, pending.attackAnchor, enemyFamily.area || [3, 3]));
    for (const targetId of successfulEnemyTargets) {
      const target = actorById(scene, targetId); if (!target) continue;
      const candidates = [];
      for (let y = 0; y < Number(space?.height || 0); y += 1) for (let x = 0; x < Number(space?.width || 0); x += 1) {
        if (selected.has(`${x},${y}`) || !effectCellOccupancyStatus(scene, target.id, { actor: target, space: target.space, x, y }).available) continue;
        const path = movementPath(scene, target.id, { x, y }, { maxDistance: Number(space.width) + Number(space.height), forced: true });
        if (path.length) candidates.push({ x, y, path });
      }
      candidates.sort((a, b) => a.path.length - b.path.length || distance(target, a) - distance(target, b));
      const destination = candidates[0]; if (!destination) continue;
      events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: pending.name, forced: true, path: destination.path.map(cellKey), participantIds: [source.id, target.id] } });
      events.push({ type: "actor.enter", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: pending.name, forced: true } });
    }
  }
  if (successfulEnemyTargets.length && enemyFamily.chooseOneEffect) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId: successfulEnemyTargets[0], effect: effectIdByName(data, enemyFamily.chooseOneEffect), sourceActionId: pending.actionId, participantIds: [pending.actorId, successfulEnemyTargets[0]] } });
  if (successfulEnemyTargets.length && enemyFamily.createTerrainAdjacent && source) {
    const space = (scene.spaces || []).find(item => item.id === source.space), occupied = new Set((scene.actors || []).filter(item => !item.knockedOut && item.kind !== "crowd" && item.space === source.space).map(cellKey));
    for (const targetId of successfulEnemyTargets) {
      const target = actorById(scene, targetId), cell = target && [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].map(([dx,dy]) => ({ x: target.x + dx, y: target.y + dy })).find(point => point.x >= 0 && point.y >= 0 && point.x < Number(space?.width || 0) && point.y < Number(space?.height || 0) && !occupied.has(`${point.x},${point.y}`) && !removedCellKeys(scene, source.space).has(`${point.x},${point.y}`));
      if (!cell) continue;
      occupied.add(`${cell.x},${cell.y}`);
      const hp = enemyTierFormula(enemyFamily.createTerrainAdjacent, source.tier);
      events.push({ type: "area.create", actorId: source.id, payload: { id: `enemy-terrain-${pending.id}-${targetId}`, space: source.space, areaType: "terrain", label: `${pending.name}: местность`, source: pending.actionId, ruleId: pending.actionId, duration: "scene", ownerActorId: source.id, cells: [`${cell.x},${cell.y}`], hp, maxHp: hp, participantIds: [source.id, targetId] } });
    }
  }
  if (source && enemyFamily.chargedAttack) events.push({ type: "effect.remove", actorId: source.id, payload: { targetId: source.id, effect: "positive.заряжен", sourceActionId: pending.actionId, participantIds: [source.id] } });
  if (source?.ruleState?.rangerHeadshotTargetId && successfulEnemyTargets.includes(source.ruleState.rangerHeadshotTargetId)) events.push({ type: "actor.state", actorId: source.id, payload: { key: "rangerHeadshotTargetId", value: null, sourceActionId: pending.actionId } });
  if (source && enemyFamily.postSelfMove) events.push({ type: "rule.prompt", actorId: source.id, payload: { id: `prompt-${pending.id}-enemy-move`, kind: "enemy-move-cell", sourceActorId: source.id, controller: "narrator", title: `${pending.name}: перемещение`, text: `Переместите ${source.name} на расстояние до ${enemyFamily.postSelfMove} клетки.`, options: ["cancel"], context: { maxDistance: Number(enemyFamily.postSelfMove) }, participantIds: [source.id] } });
  if (source && enemyFamily.postMoveMaximum && successfulEnemyTargets[0]) {
    const target = actorById(scene, successfulEnemyTargets[0]);
    events.push({ type: "rule.prompt", actorId: source.id, payload: { id: `prompt-${pending.id}-target-move`, kind: "enemy-move-cell", sourceActorId: source.id, targetId: target.id, controller: "narrator", title: `${pending.name}: перемещение цели`, text: `Переместите ${target.name} на расстояние до ${enemyFamily.postMoveMaximum} клеток.`, options: ["cancel"], context: { maxDistance: Number(enemyFamily.postMoveMaximum), moveTarget: true }, participantIds: [source.id, target.id] } });
  }
  if (source && enemyFamily.repeatFreshTargets) {
    const attacked = new Set(currentTurnEvents(scene, source.id).filter(event => event.actorId === source.id && event.type === "attack.pending").flatMap(event => event.payload?.targetIds || []).concat(pending.targetIds || []));
    const candidates = (scene.actors || []).filter(target => !target.knockedOut && target.team !== source.team && target.space === source.space && distance(source, target) <= 1 && !attacked.has(target.id));
    if (candidates.length) events.push({ type: "rule.prompt", actorId: source.id, payload: { id: `prompt-${pending.id}-cocoon-repeat`, kind: "enemy-cocoon-repeat", sourceActorId: source.id, controller: "narrator", title: "Буйство · повтор", text: "Бесплатно повторите Буйство против персонажа, которого Кокон ещё не атаковал в этот Ход.", options: [...candidates.map(target => `target:${target.id}`), "pass"], context: { optionLabels: Object.fromEntries(candidates.map(target => [`target:${target.id}`, target.name])) }, participantIds: [source.id, ...candidates.map(target => target.id)] } });
  }
  if (source && enemyFamily.pugilistSequence && successfulEnemyTargets.length) {
    const firstStep = Math.max(1, Math.min(4, Number(source.ruleState?.pugilistStance || 1))), targetId = successfulEnemyTargets[0], target = actorById(scene, targetId), steps = source.ruleState?.martialPerfection ? [firstStep, firstStep % 4 + 1] : [firstStep];
    for (const step of steps) {
      if (step === 1 && target) {
        const origin = { x: target.x, y: target.y }, destination = pushDestination(scene, target, source, 3);
        if (destination.distance) {
          events.push({ type: "actor.move", actorId: target.id, payload: { space: target.space, x: destination.x, y: destination.y, movement: "Град ударов", forced: true, displacement: { mode: "push", direction: destination.direction, distance: destination.distance, ruleId: pending.actionId }, path: (destination.path || []).map(cellKey), participantIds: [source.id, target.id] } });
          events.push({ type: "actor.move", actorId: source.id, payload: { space: source.space, x: origin.x, y: origin.y, movement: "Град ударов: следом", placement: true, participantIds: [source.id, target.id] } });
        }
      } else if (step === 2) events.push({ type: "effect.apply", actorId: source.id, payload: { targetId, effect: "negative.пойман", sourceActionId: pending.actionId, participantIds: [source.id, targetId] } });
      else if (step === 3) events.push({ type: "effect.apply", actorId: source.id, payload: { targetId, effect: "negative.подброшен", sourceActionId: pending.actionId, participantIds: [source.id, targetId] } });
    }
    events.push({ type: "actor.state", actorId: source.id, payload: { key: "pugilistStance", value: ((firstStep - 1 + steps.length) % 4) + 1, sourceActionId: pending.actionId } });
  }
  if (postSelfHeal && source) {
    const missing = Math.max(0, Number(source.maxHp || 0) - Number(source.hp || 0));
    const amount = Math.ceil(missing * Number(pending.postSelfHealMissingFraction));
    if (amount > 0) events.push({ type: "actor.heal", actorId: source.id, payload: { targetId: source.id, amount, sourceActionId: pending.enemyRuleId || pending.actionId, participantIds: [source.id, ...status.eligibleIds] } });
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
  const masterArmament=pending.armamentMode||pending.masterArmament||null;if(masterArmament&&source){const equipped=[];for(const event of scene.log||[]){if(event.type==="turn.start"&&event.actorId===source.id)break;if(event.type==="technique.resolve"&&event.actorId===source.id&&event.payload?.ruleId==="vagabond.master-at-arms.1")equipped.push(event.payload.armament)}events.push({type:"actor.state",actorId:source.id,payload:{key:"masterArmament",value:masterArmament,sourceActionId:"vagabond.master-at-arms.1"}});if(Number(source.techniques?.["vagabond.master-at-arms"]||0)>=2&&equipped.length===1){events.push({type:"resource.gain",actorId:source.id,payload:{resource:"ap",amount:1,sourceActionId:"vagabond.master-at-arms.2"}});events.push({type:"effect.apply",actorId:source.id,payload:{targetId:source.id,effect:"positive.ускорен",sourceActionId:"vagabond.master-at-arms.2",participantIds:[source.id]}})}events.push({type:"technique.resolve",actorId:source.id,payload:{ruleId:"vagabond.master-at-arms.1",name:"Многогранность",armament:masterArmament,affectedActorIds:status.eligibleIds,participantIds:[source.id,...status.eligibleIds]}})}
  if (pending.createTerrain?.cells?.length && source) pending.createTerrain.cells.forEach((cell, index) => events.push({ type: "area.create", actorId: source.id, payload: { id: `terrain-${pending.id}-${index}`, space: source.space, areaType: "terrain", label: pending.createTerrain.label || "Высокая местность", source: pending.createTerrain.ruleId, ruleId: pending.createTerrain.ruleId, duration: "scene", ownerActorId: source.id, cells: [cell], hp: Number(pending.createTerrain.hp || 10), maxHp: Number(pending.createTerrain.hp || 10), participantIds: [source.id, ...status.eligibleIds] } }));
  const targetedCells = [...new Set([...(pending.targetCells || []), ...status.eligibleIds.map(id => actorById(scene, id)).filter(Boolean).map(cellKey)])];
  if (targetedCells.length && source) {
    for (const marker of (scene.markers || []).filter(item => item.space === source.space && targetedCells.includes(`${item.x},${item.y}`) && /altruist\.will-o-wisp\.1/.test(`${item.ruleId || ""} ${item.source || ""}`))) {
      const destination = pushDestination(scene, marker, source, 1);
      if (destination.distance) events.push({ type: "marker.move", actorId: marker.ownerActorId, payload: { markerId: marker.id, space: marker.space, x: destination.x, y: destination.y, movement: "Атака по Духовному пламени", participantIds: [source.id, marker.ownerActorId] } });
    }
  }
  events.push({ type: pending.enemyRuleId ? "enemy.action.resolve" : "action.resolve", actorId: pending.actorId, payload: pending.enemyRuleId ? { ruleId: pending.enemyRuleId, name: pending.name, kind: "attack", targetIds: status.eligibleIds, skippedTargetIds: status.unavailableIds, reward: pending.reward || "" } : { actionId: pending.actionId, name: pending.name, attribute: pending.attribute || pending.roll?.attribute || null, roll: clone(pending.roll || null), targetIds: status.eligibleIds, targetCells: [...new Set(pending.targetCells || [])], skippedTargetIds: status.unavailableIds, icicleHalo: Boolean(pending.icicleHalo),masterArmament, techniqueRuleId:pending.techniqueRuleId||null, techniqueAnchor:clone(pending.techniqueAnchor||null), targetsTerrainCell:Boolean(pending.targetsTerrainCell), targetedTerrainId:pending.targetedTerrainId||null } });
  if (pending.techniqueRuleId && !masterArmament) events.push({ type: "technique.resolve", actorId: pending.actorId, payload: { ruleId: pending.techniqueRuleId, name: pending.techniqueName || pending.name, affectedActorIds: status.eligibleIds, skippedTargetIds: status.unavailableIds } });
  events.push({ type: "attack.clear", actorId: source?.id || pending.actorId, payload: { pendingId: pending.id, targetIds: status.eligibleIds, sourceActionId: pending.actionId } });
  return { ok: true, errors: [], events };
}
