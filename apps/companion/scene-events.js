"use strict";

function normalizeEvent(event, options = {}) {
  if (!event?.type) throw new Error("Событию Сцены нужен type.");
  return {
    id: event.id || (options.makeId || eventId)(),
    at: event.at || new Date().toISOString(),
    type: event.type,
    actorId: event.actorId || null,
    payload: clone(event.payload || {}),
  };
}

function validateEvent(scene, event, options = {}) {
  if (!EVENT_TYPES.has(event.type) && event.type !== "movement-traces.clear") throw new Error(`Неизвестный тип события: ${event.type}.`);
  if (typeof event.id !== "string" || !event.id || event.id.length > 120) throw new Error("Некорректный id события.");
  if (event.actorId && !actorById(scene, event.actorId)) throw new Error("Исполнитель события отсутствует на Сцене.");
  const payload = event.payload || {}, actor = event.actorId ? actorById(scene, event.actorId) : null;
  const finite = value => Number.isFinite(Number(value));
  if (event.type === "action.plan") {
    if (!actor || typeof payload.id !== "string" || !payload.id || payload.id.length > 120 || typeof payload.actionId !== "string" || !payload.actionId || payload.actionId.length > 180 || !ACTION_PLAN_PHASES.has(payload.phase) || !payload.context || typeof payload.context !== "object" || Array.isArray(payload.context) || JSON.stringify(payload.context).length > 8192) throw new Error("Некорректный план составного действия.");
  }
  if (event.type === "action.plan.update") {
    if (!actor || typeof payload.planId !== "string" || !payload.planId || !ACTION_PLAN_PHASES.has(payload.phase) || payload.context != null && (typeof payload.context !== "object" || Array.isArray(payload.context) || JSON.stringify(payload.context).length > 8192)) throw new Error("Некорректное продолжение составного действия.");
  }
  if (event.type === "action.plan.cancel" && (!actor || typeof payload.planId !== "string" || !payload.planId || payload.reason != null && (typeof payload.reason !== "string" || payload.reason.length > 240))) throw new Error("Некорректная отмена составного действия.");
  if (["resource.spend", "resource.gain"].includes(event.type)) {
    if (!RESOURCES.has(payload.resource) || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999) throw new Error("Некорректное изменение ресурса.");
  }
  if (event.type === "actor.runtime.set") {
    const limits = { hp: 9999, wounds: 99, stress: 3, focus: 9999, influence: 999, ap: 99 };
    if (!actor || !Object.hasOwn(limits, payload.key) || !finite(payload.value) || Number(payload.value) < 0 || Number(payload.value) > limits[payload.key]) throw new Error("Некорректное значение ресурса героя.");
  }
  if (event.type === "rule-mode.set") {
    const status = ruleModeStatus(scene, event.actorId, { groupId: payload.groupId, modeId: payload.modeId });
    if (!status.available) throw new Error(status.reason || "Некорректное изменение режима правила.");
  }
  if (event.type === "rule-resource.configure") {
    const definition = normalizeRuleResourceDefinition(actor, payload);
    if (!actor || !/^[a-z][a-z0-9-]{0,39}$/.test(definition.resource) || !definition.label.trim() || definition.label.length > 80 || definition.initial < definition.minimum || definition.maximum != null && (definition.maximum < definition.minimum || definition.initial > definition.maximum)) throw new Error("Некорректная конфигурация альтернативного ресурса.");
    const conflicts = ruleResourceDefinitions(actor).filter(item => item.resource !== definition.resource && item.replaces.some(resource => definition.replaces.includes(resource)));
    if (conflicts.length) throw new Error(`Альтернативный ресурс конфликтует с «${conflicts[0].label}».`);
  }
  if (["rule-resource.spend", "rule-resource.gain", "rule-resource.set", "rule-resource.reset"].includes(event.type)) {
    const definition = actor && ruleResourceDefinition(actor, payload.resource);
    if (!actor || !definition) throw new Error("Альтернативный ресурс не настроен для исполнителя.");
    if (["rule-resource.spend", "rule-resource.gain"].includes(event.type) && (!finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999)) throw new Error("Некорректное изменение альтернативного ресурса.");
    if (event.type === "rule-resource.set" && (!finite(payload.value) || Number(payload.value) < definition.minimum || definition.maximum != null && Number(payload.value) > definition.maximum)) throw new Error("Некорректное значение альтернативного ресурса.");
    if (event.type === "rule-resource.reset" && payload.scope != null && !["scene", "round", "turn"].includes(payload.scope)) throw new Error("Некорректная область сброса альтернативного ресурса.");
  }
  if (event.type === "rule-clock.configure") {
    const definition = normalizeRuleClockDefinition(payload);
    if (!actor || !/^[a-z][a-z0-9.-]{0,79}$/.test(definition.clockId) || !definition.label.trim() || definition.label.length > 80 || !Number.isInteger(Number(payload.size)) || definition.minimumSize > definition.size || payload.value != null && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 0 || Number(payload.value) > definition.size)) throw new Error("Некорректная конфигурация часов правила.");
  }
  if (["rule-clock.tick", "rule-clock.set", "rule-clock.reset"].includes(event.type)) {
    const status = actor && clockStatus(scene, actor.id, payload.clockId);
    if (!actor || !status?.available) throw new Error("Часы правила не настроены для исполнителя.");
    if (event.type === "rule-clock.tick" && (!Number.isInteger(Number(payload.delta)) || Number(payload.delta) === 0 || Math.abs(Number(payload.delta)) > 24)) throw new Error("Некорректное изменение часов правила.");
    if (event.type === "rule-clock.set" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 0 || Number(payload.value) > status.size || payload.active != null && typeof payload.active !== "boolean")) throw new Error("Некорректное значение часов правила.");
    if (event.type === "rule-clock.reset" && payload.scope != null && !["scene", "round", "turn"].includes(payload.scope)) throw new Error("Некорректная область сброса часов правила.");
  }
  if (event.type === "actor.move") {
    const space = (scene.spaces || []).find(item => item.id === payload.space);
    if (!space || !Number.isInteger(Number(payload.x)) || !Number.isInteger(Number(payload.y)) || Number(payload.x) < 0 || Number(payload.y) < 0 || Number(payload.x) >= space.width || Number(payload.y) >= space.height) throw new Error("Некорректная клетка перемещения.");
    if (removedCellKeys(scene, payload.space).has(`${Number(payload.x)},${Number(payload.y)}`)) throw new Error("Нельзя переместиться в удалённую клетку.");
    if (actor?.knockedOut && !payload.displacement?.allowKnockedOut) throw new Error("Выведенный из строя участник не может перемещаться.");
    if (actor?.kind === "crowd") {
      const status = fodderMoveStatus(scene, actor.id), moveDistance = Math.abs(Number(payload.x) - Number(actor.x)) + Math.abs(Number(payload.y) - Number(actor.y));
      if (!payload.fodderMove || !status.available || payload.boundaryEventId !== status.boundaryEventId || moveDistance < 1 || moveDistance > status.remaining || (payload.space || actor.space) !== actor.space) throw new Error(status.reason || "Некорректное перемещение зоны массовки.");
      payload.distance = moveDistance;
    }
    const movement = effectMovementStatus(scene, event.actorId, { forced: Boolean(payload.forced || payload.displacement), placement: Boolean(payload.placement), ignoreResistance: Boolean(payload.displacement?.ignoreResistance), ignoreVoluntaryRestrictions: Boolean(payload.ignoreVoluntaryRestrictions) });
    if (!movement.available) throw new Error(movement.reason);
    const occupancy = effectCellOccupancyStatus(scene, event.actorId, { space: payload.space, x: payload.x, y: payload.y });
    if (!occupancy.available) throw new Error(occupancy.reason);
    if (payload.from && (payload.from.space !== actor?.space || Number(payload.from.x) !== Number(actor?.x) || Number(payload.from.y) !== Number(actor?.y))) throw new Error("Исходная клетка перемещения устарела.");
    if (payload.path != null) {
      if (!Array.isArray(payload.path) || payload.path.length > 144) throw new Error("Некорректный путь перемещения.");
      const pathCells = payload.path.map(String), invalidPath = pathCells.some(cell => {
        const match = cell.match(/^(\d{1,2}),(\d{1,2})$/);
        return !match || Number(match[1]) >= Number(space.width) || Number(match[2]) >= Number(space.height) || removedCellKeys(scene, payload.space).has(cell);
      });
      if (invalidPath || pathCells.length && pathCells.at(-1) !== `${Number(payload.x)},${Number(payload.y)}`) throw new Error("Путь перемещения не совпадает с клеткой назначения.");
    }
    if (payload.displacement) {
      const status = displacementStatus(scene, { actorId: event.actorId, mode: "directed", direction: payload.displacement.direction, maximum: payload.displacement.distance, allowKnockedOut: Boolean(payload.displacement.allowKnockedOut), ignoreActors: Boolean(payload.displacement.ignoreActors), ignoreTerrain: Boolean(payload.displacement.ignoreTerrain), ignoreResistance: Boolean(payload.displacement.ignoreResistance) });
      if (!status.available || status.destination.x !== Number(payload.x) || status.destination.y !== Number(payload.y)) throw new Error(status.reason || "Событие перемещения не совпадает с проверенным направлением.");
    }
  }
  if (event.type === "actor.spawn") {
    const spawned = payload.actor, space = (scene.spaces || []).find(item => item.id === spawned?.space);
    if (!spawned || typeof spawned.id !== "string" || !spawned.id || actorById(scene, spawned.id) || !space || !Number.isInteger(Number(spawned.x)) || !Number.isInteger(Number(spawned.y)) || Number(spawned.x) < 0 || Number(spawned.y) < 0 || Number(spawned.x) >= Number(space.width) || Number(spawned.y) >= Number(space.height) || spawned.compoundId != null && (typeof spawned.compoundId !== "string" || !spawned.compoundId.trim() || spawned.compoundId.length > 120)) throw new Error("Некорректный призыв участника.");
    const occupancy = effectCellOccupancyStatus(scene, null, { actor: spawned, space: spawned.space, x: spawned.x, y: spawned.y });
    if (!occupancy.available) throw new Error(occupancy.reason || "Клетка призыва занята.");
  }
  if (event.type === "marker.move") {
    const marker = markerById(scene, payload.markerId), space = (scene.spaces || []).find(item => item.id === (payload.space || marker?.space));
    if (!marker || !space || !Number.isInteger(Number(payload.x)) || !Number.isInteger(Number(payload.y)) || Number(payload.x) < 0 || Number(payload.y) < 0 || Number(payload.x) >= space.width || Number(payload.y) >= space.height) throw new Error("Некорректное перемещение маркера.");
    if (removedCellKeys(scene, payload.space || marker.space).has(`${Number(payload.x)},${Number(payload.y)}`)) throw new Error("Нельзя переместить маркер в удалённую клетку.");
  }
  if (event.type === "marker.remove" && !markerById(scene, payload.markerId)) throw new Error("Удаляемый маркер уже отсутствует.");
  if (event.type === "area.duration") {
    if (!(scene.objects || []).some(object => object.id === payload.id) || !["instant", "endTurn", "nextTurn", "round", "scene", "persistent"].includes(payload.duration)) throw new Error("Некорректная длительность области.");
  }
  if (event.type === "damage.apply" && payload.sourceActionId === "fodder.round-end") {
    const target = actorById(scene, payload.targetId), alreadyUsed = currentRoundEvents(scene).some(item => item.type === "damage.apply" && item.actorId === actor?.id && item.payload?.sourceActionId === "fodder.round-end");
    if (actor?.kind !== "crowd" || actor.knockedOut || !target || target.team === actor.team || target.knockedOut || target.space !== actor.space || distance(actor, target) > 1 || Number(payload.amount) !== 2 || !roundEndStatus(scene).available || alreadyUsed) throw new Error("Урон массовки доступен один раз для каждой зоны в конце Раунда по герою в пределах 1 клетки.");
  }
  if (event.type === "marker.duration") {
    if (!markerById(scene, payload.markerId) || !["endTurn", "nextTurn", "round", "scene", "persistent"].includes(payload.duration)) throw new Error("Некорректная длительность маркера.");
  }
  if (event.type === "reminder.create") {
    const boundary = payload.boundary;
    if ((scene.reminders || []).length >= 80 || typeof payload.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,119}$/i.test(payload.id) || (scene.reminders || []).some(item => item.id === payload.id) || typeof payload.label !== "string" || !payload.label.trim() || payload.label.length > 120 || typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 800 || !["turnStart", "turnEnd", "roundEnd", "manual"].includes(boundary) || (["turnStart", "turnEnd"].includes(boundary) && !actorById(scene, payload.ownerActorId || event.actorId))) throw new Error("Некорректное напоминание.");
  }
  if (["reminder.due", "reminder.resolve", "reminder.remove"].includes(event.type)) {
    const reminder = (scene.reminders || []).find(item => item.id === payload.id);
    if (!reminder) throw new Error("Напоминание уже отсутствует.");
    if (event.type === "reminder.due" && reminder.due) throw new Error("Напоминание уже сработало.");
    if (event.type === "reminder.resolve" && !reminder.due) throw new Error("Напоминание ещё не наступило.");
  }
  if (["object.damage","object.restore"].includes(event.type)) {
    const object = (scene.objects || []).find(item => item.id === payload.objectId);
    if (!object || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999) throw new Error("Некорректное повреждение местности.");
  }
  if (event.type === "challenge.request") {
    const targetActor = actorById(scene, payload.actorId);
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/i.test(String(payload.id || "")) || !targetActor || targetActor.team !== "hero" || targetActor.knockedOut || !Number.isInteger(Number(payload.target)) || Number(payload.target) < 1 || Number(payload.target) > 99 || typeof payload.requestedBy !== "string" || !payload.requestedBy.trim() || payload.requestedBy.length > 120) throw new Error("Некорректный запрос испытания.");
  }
  if (event.type === "challenge.clear" && (!scene.challengeRequest || payload.requestId !== scene.challengeRequest.id)) throw new Error("Этот запрос испытания уже закрыт.");
  if (event.type === "opposed.request") {
    const participants = Array.isArray(payload.participants) ? payload.participants : [], ids = new Set(), actorIds = new Set(), heroIds = new Set();
    const invalid = participants.length !== 2 || participants.some(participant => {
      if (!participant || typeof participant.id !== "string" || !participant.id || participant.id.length > 120 || ids.has(participant.id) || typeof participant.name !== "string" || !participant.name.trim() || participant.name.length > 120 || !["participant", "narrator"].includes(participant.controller) || !Number.isInteger(Number(participant.pool)) || Number(participant.pool) < 1 || Number(participant.pool) > 99) return true;
      ids.add(participant.id);
      if (participant.actorId) {
        const opposedActor = actorById(scene, participant.actorId);
        if (!opposedActor || opposedActor.knockedOut || actorIds.has(participant.actorId) || participant.heroId && opposedActor.heroId && opposedActor.heroId !== participant.heroId) return true;
        actorIds.add(participant.actorId);
      }
      if (participant.heroId) {
        if (typeof participant.heroId !== "string" || participant.heroId.length > 120 || heroIds.has(participant.heroId)) return true;
        heroIds.add(participant.heroId);
      }
      return !participant.actorId && !participant.heroId && participant.controller !== "narrator";
    });
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/i.test(String(payload.id || "")) || invalid || typeof payload.requestedBy !== "string" || !payload.requestedBy.trim() || payload.requestedBy.length > 120) throw new Error("Некорректный встречный бросок.");
  }
  if (["opposed.reroll", "opposed.tie.resolve", "opposed.clear"].includes(event.type)) {
    if (!scene.opposedRoll || payload.requestId !== scene.opposedRoll.id) throw new Error("Этот встречный бросок уже закрыт.");
    if (event.type === "opposed.reroll" && scene.opposedRoll.status !== "tied") throw new Error("Переброс возможен только после ничьей.");
    if (event.type === "opposed.tie.resolve" && scene.opposedRoll.status !== "tied") throw new Error("Обе Награды можно разрешить только при ничьей.");
  }
  if (event.type === "roll.public") {
    if (!Array.isArray(payload.rolls) || payload.rolls.length > 300 || payload.rolls.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 6)) throw new Error("Некорректный публичный бросок.");
    if (!Number.isInteger(Number(payload.successes)) || Number(payload.successes) < 0 || Number(payload.successes) > 300 || !Number.isInteger(Number(payload.crits)) || Number(payload.crits) < 0 || Number(payload.crits) > Number(payload.successes)) throw new Error("Некорректный результат публичного броска.");
    if (payload.target != null && (!Number.isInteger(Number(payload.target)) || Number(payload.target) < 1 || Number(payload.target) > 99) || ["intent", "threat", "reward"].some(key => payload[key] != null && (typeof payload[key] !== "string" || payload[key].length > 240))) throw new Error("Некорректный контекст испытания.");
    if (payload.challengeRequestId != null && (!scene.challengeRequest || payload.challengeRequestId !== scene.challengeRequest.id || event.actorId !== scene.challengeRequest.actorId || Number(payload.target) !== Number(scene.challengeRequest.target) || scene.challengeRequest.result && !payload.payment)) throw new Error("Бросок не соответствует активному запросу Нарратора.");
    if (payload.opposedRequestId != null) {
      const opposed = scene.opposedRoll, participant = opposed?.participants?.find(item => item.id === payload.opposedParticipantId), previous = opposed?.results?.[payload.opposedParticipantId];
      if (!opposed || payload.opposedRequestId !== opposed.id || Number(payload.opposedAttempt) !== Number(opposed.attempt) || !participant || event.actorId !== (participant.actorId || null) || opposed.resolution === "both" || previous && !payload.payment) throw new Error("Бросок не соответствует активному встречному броску.");
    }
    if (payload.challengeRequestId != null && payload.opposedRequestId != null) throw new Error("Бросок не может одновременно быть обычным и встречным.");
    if (payload.dice != null) {
      const dice = payload.dice;
      if (!actor || !dice || typeof dice !== "object" || dice.sceneContext != null && typeof dice.sceneContext !== "boolean" || !Number.isInteger(Number(dice.baseCount)) || Number(dice.baseCount) < 1 || Number(dice.baseCount) > 300 || !Number.isInteger(Number(dice.count)) || Number(dice.count) < 1 || Number(dice.count) > 300 || !Array.isArray(dice.selectedHookIds) || dice.selectedHookIds.length > 30 || dice.selectedHookIds.some(id => typeof id !== "string" || id.length > 180) || !Array.isArray(dice.targetIds) || dice.targetIds.length > 40 || dice.targetIds.some(id => !actorById(scene, id))) throw new Error("Некорректный снимок правил броска.");
      const preparedActionRoll = scene.pendingAction?.actorId === actor.id && JSON.stringify(scene.pendingAction.roll) === JSON.stringify(payload);
      const status = diceHookStatus(scene, actor.id, { scope: dice.scope, sceneContext: dice.sceneContext, baseCount: dice.baseCount, advantage: dice.manualAdvantage, hindrance: dice.manualHindrance, attribute: dice.attribute, threshold: dice.threshold, criticalAt: dice.criticalAt, usesAbility: dice.usesAbility, abilityKey: dice.abilityKey, selectedHookIds: dice.selectedHookIds, targetIds: dice.targetIds, hooks: dice.explicitHooks || [] });
      const evaluated = evaluateDiceRoll(status, payload);
      if (!preparedActionRoll && (!status.available || !evaluated.available || payload.rolls.length < status.count || status.count !== Number(dice.count) || status.advantage !== Number(dice.advantage) || status.hindrance !== Number(dice.hindrance) || status.threshold !== Number(dice.threshold) || status.criticalAt !== Number(dice.criticalAt) || evaluated.successes !== Number(payload.successes) || evaluated.crits !== Number(payload.crits) || JSON.stringify(status.hooks) !== JSON.stringify(dice.hooks || []))) throw new Error("Результат броска не соответствует активным правилам.");
    }
  }
  if (event.type === "roll.redirect") {
    const sourceRoll = (scene.rollFeed || []).find(roll => roll.id === payload.sourceRollId), target = actorById(scene, payload.targetId);
    if (!actor || !sourceRoll || sourceRoll.actorId !== actor.id || !target || target.knockedOut || target.id === actor.id || target.space !== actor.space || (sourceRoll.targetIds || []).includes(target.id)) throw new Error("Перенаправление броска больше недоступно.");
  }
  if (event.type === "rule.share") {
    if (!/^[a-z0-9][a-z0-9._:-]{0,179}$/i.test(String(payload.ruleId || "")) || typeof payload.title !== "string" || !payload.title.trim() || payload.title.length > 180 || typeof payload.kind !== "string" || payload.kind.length > 80 || typeof payload.sharedBy !== "string" || payload.sharedBy.length > 120) throw new Error("Некорректная ссылка на правило.");
  }
  if (event.type === "session-clock.create") {
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/i.test(String(payload.id || "")) || (scene.sessionClocks || []).some(clock => clock.id === payload.id) || typeof payload.name !== "string" || !payload.name.trim() || payload.name.length > 120 || !["progress", "danger"].includes(payload.kind) || ![4, 6, 8, 12].includes(Number(payload.size))) throw new Error("Некорректные часы Сцены.");
  }
  if (["session-clock.set", "session-clock.rename", "session-clock.kind", "session-clock.size", "session-clock.remove"].includes(event.type)) {
    const clock = (scene.sessionClocks || []).find(item => item.id === payload.id);
    if (!clock) throw new Error("Часы Сцены уже отсутствуют.");
    if (event.type === "session-clock.set" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 0 || Number(payload.value) > Number(clock.size))) throw new Error("Некорректное значение часов Сцены.");
    if (event.type === "session-clock.rename" && (typeof payload.name !== "string" || !payload.name.trim() || payload.name.length > 120)) throw new Error("Некорректное название часов Сцены.");
    if (event.type === "session-clock.kind" && !["progress", "danger"].includes(payload.kind)) throw new Error("Некорректный тип часов Сцены.");
    if (event.type === "session-clock.size" && ![4, 6, 8, 12].includes(Number(payload.size))) throw new Error("Некорректный размер часов Сцены.");
  }
  if (event.type === "attack.pending") {
    payload.targetIds = [...new Map((payload.targetIds || []).map(id => [canonicalTargetId(scene, id), canonicalTargetId(scene, id)])).values()];
    if (!Array.isArray(payload.targetIds) || payload.targetIds.length > 40 || !payload.allowEmptyTargets && payload.targetIds.length < 1 || payload.targetIds.some(id => !actorById(scene, id) || actorById(scene, id).knockedOut) || !finite(payload.damage) || Number(payload.damage) < 0 || Number(payload.damage) > 9999) throw new Error("Некорректные параметры атаки.");
    const unavailableTarget = payload.targetIds.find(id => !effectTargetingStatus(scene, event.actorId, id).available);
    if (unavailableTarget) throw new Error(effectTargetingStatus(scene, event.actorId, unavailableTarget).reason);
    if (payload.attackModifierIds != null && (!Array.isArray(payload.attackModifierIds) || payload.attackModifierIds.length > 40 || !attackModifierStatus(scene, event.actorId, payload.targetIds, payload.attackModifierIds, { actionName: payload.declaredActionName || payload.name }).available)) throw new Error("Некорректные модификаторы Атаки.");
  }
  if (event.type === "effect.apply" && (!actorById(scene, payload.targetId) || typeof payload.effect !== "string" || !payload.effect.trim() || payload.effect.length > 80 || payload.duration != null && !EFFECT_DURATIONS.has(payload.duration) || payload.removable != null && typeof payload.removable !== "boolean" || payload.exclusiveBySource != null && typeof payload.exclusiveBySource !== "boolean")) throw new Error("Некорректный Эффект.");
  if (event.type === "effect.apply" && actor && !payload.ignoreEffectTargeting) {
    const targeting = effectTargetingStatus(scene, actor.id, payload.targetId, { sourceReappearing: Boolean(payload.sourceReappearing) });
    if (!targeting.available) throw new Error(targeting.reason);
  }
  if (event.type === "effect.remove" && (!actorById(scene, payload.targetId) || typeof payload.effect !== "string" || !payload.effect.trim() || payload.effect.length > 80 || payload.sourceOnly != null && typeof payload.sourceOnly !== "boolean" || payload.sourceActorId != null && !actorById(scene, payload.sourceActorId))) throw new Error("Некорректное удаление Эффекта.");
  if (event.type === "actor.heal" && (!actorById(scene, payload.targetId) || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999)) throw new Error("Некорректное исцеление.");
  if (event.type === "actor.wound" && (!actorById(scene, payload.targetId) || !Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) !== 1)) throw new Error("Некорректное изменение Ран.");
  if (event.type === "actor.knockout" && !actorById(scene, payload.targetId)) throw new Error("Некорректное выведение из строя.");
  if (event.type === "inventory.change" && (typeof payload.item !== "string" || payload.item.length > 80 || !Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) > 99)) throw new Error("Некорректное изменение инвентаря.");
  if (event.type === "rule.prompt" && (typeof payload.id !== "string" || !payload.id || payload.id.length > 160 || typeof payload.kind !== "string" || !payload.kind || payload.controller != null && !["source", "narrator"].includes(payload.controller) || !Array.isArray(payload.options) || payload.options.length < 1 || payload.options.length > 48 || payload.options.some(option => typeof option !== "string" || !option || option.length > 120) || new Set(payload.options).size !== payload.options.length)) throw new Error("Некорректный запрос правила.");
  if (event.type === "rule.respond") {
    const prompt = scene.pendingPrompt, source = actorById(scene, prompt?.sourceActorId), target = actorById(scene, prompt?.targetId);
    if (!prompt || payload.promptId !== prompt.id) throw new Error("Этот запрос правила уже закрыт.");
    if (event.actorId !== prompt.sourceActorId || !source || source.knockedOut) throw new Error("Источник решения больше не доступен.");
    if (typeof payload.choice !== "string" || !(prompt.options || []).includes(payload.choice)) throw new Error("Такого ответа нет в запросе правила.");
    if (prompt.targetId && (!target || target.knockedOut)) throw new Error("Цель решения больше не доступна.");
    if (payload.choice === "cell" && !options.placementResponse) throw new Error("Выбор клетки должен применяться вместе с проверенным перемещением.");
  }
  if (event.type === "rule.trigger" && (
    typeof payload.triggerId !== "string" || !/^[a-z][a-z0-9.-]{0,119}$/.test(payload.triggerId)
    || typeof payload.sourceEventId !== "string" || !payload.sourceEventId
    || !["fired", "queued", "cancelled"].includes(payload.status)
    || payload.priority != null && !Number.isInteger(Number(payload.priority))
    || payload.emittedTypes != null && (!Array.isArray(payload.emittedTypes) || payload.emittedTypes.length > 24 || payload.emittedTypes.some(type => !EVENT_TYPES.has(type)))
    || payload.status === "queued" && (
      payload.deferredEvent?.type !== "rule.prompt"
      || typeof payload.deferredEvent?.payload?.id !== "string"
      || typeof payload.deferredEvent?.payload?.kind !== "string"
      || !Array.isArray(payload.deferredEvent?.payload?.options)
      || payload.deferredEvent.payload.options.length < 1
      || JSON.stringify(payload.deferredEvent).length > 8192
    )
  )) throw new Error("Некорректная запись маршрутизации триггера.");
  if (event.type === "technique.state") {
    if (!actorById(scene, event.actorId) || !["cunningPlan", "study", "spellModifiers"].includes(payload.key)) throw new Error("Некорректное состояние Техники.");
    if (payload.key === "cunningPlan" && (!Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) > 4)) throw new Error("Некорректное изменение часов Хитрого плана.");
    if (payload.key === "study" && (!actorById(scene, payload.targetId) || typeof payload.targetId !== "string")) throw new Error("Некорректная цель Хитрого плана.");
    if (payload.key === "spellModifiers" && (!Array.isArray(payload.value) || payload.value.length > 2 || payload.value.some(value => !["fierce", "focused", "wild", "outstanding"].includes(value)))) throw new Error("Некорректный выбор Модификаций.");
  }
  if (event.type === "actor.state") {
    if (!actorById(scene, event.actorId) || !ACTOR_STATE_KEYS.has(payload.key)) throw new Error("Некорректное состояние персонажа.");
    if (payload.key === "pugilistStance" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 1 || Number(payload.value) > 4)) throw new Error("Шаг стойки должен быть от 1 до 4.");
    if (payload.key === "growth" && (!Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) > 20)) throw new Error("Некорректное изменение Роста.");
    if (payload.key === "evasion" && (!Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) > 20)) throw new Error("Некорректное изменение Уклонения.");
    if (["martialPerfection", "imposingPresence"].includes(payload.key) && typeof payload.value !== "boolean") throw new Error("Некорректный переключатель состояния.");
    if (["grimTransformed", "grimUsed", "warringTransformed", "warringUsed", "drainLife", "wispCreationUsed"].includes(payload.key) && typeof payload.value !== "boolean") throw new Error("Некорректный переключатель Техники.");
    if (payload.key === "lastCreationSpellMarks" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 0 || Number(payload.value) > 99)) throw new Error("Некорректное число Меток творения.");
    if (payload.key === "empathSupport" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 0 || Number(payload.value) > 99)) throw new Error("Некорректная Поддержка Эмпата.");
    if(payload.key==="masterArmament"&&!["blade","pole","chain"].includes(payload.value))throw new Error("Некорректное Вооружение.");
    if (payload.key === "modifiedOverclockTurns" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 0 || Number(payload.value) > 2)) throw new Error("Некорректная длительность Разгона.");
  }
  if (event.type === "turn.grant" && (!actorById(scene, event.actorId) || !Number.isInteger(Number(payload.amount)) || Number(payload.amount) < 1 || Number(payload.amount) > 4)) throw new Error("Некорректный дополнительный Ход.");
  if (["enemy.action.prepare", "enemy.action.resolve"].includes(event.type) && (typeof payload.ruleId !== "string" || typeof payload.name !== "string" || payload.ruleId.length > 180 || payload.name.length > 120)) throw new Error("Некорректное действие врага.");
  if (event.type === "damage.apply") {
    if (!actorById(scene, payload.targetId) || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999) throw new Error("Некорректный урон.");
  }
  if (event.type === "area.create") {
    const space = (scene.spaces || []).find(item => item.id === payload.space);
    if ((scene.objects || []).length >= 240 || typeof payload.id !== "string" || !payload.id || payload.id.length > 120 || (scene.objects || []).some(object => object.id === payload.id) || !space || !Array.isArray(payload.cells) || payload.cells.length < 1 || payload.cells.length > 144 || payload.cells.some(cell => {const match=String(cell).match(/^(\d{1,2}),(\d{1,2})$/);return !match||Number(match[1])>=space.width||Number(match[2])>=space.height||removedCellKeys(scene,payload.space).has(String(cell))}) || !["attack","gas","terrain","difficult","high","low","deploy-hero","deploy-enemy","objective","danger","portal","custom"].includes(payload.areaType) || !["instant","endTurn","nextTurn","round","scene","persistent"].includes(payload.duration)) throw new Error("Некорректная область Техники.");
  }
  if(event.type==="wall.create"){
    const space=(scene.spaces||[]).find(item=>item.id===payload.space),parse=value=>{const match=String(value||"").match(/^(\d{1,2}),(\d{1,2})$/);return match?{x:Number(match[1]),y:Number(match[2])}:null},a=parse(payload.a),b=parse(payload.b),duplicate=a&&b&&wallAt(scene,payload.space,a,b);
    if((scene.walls||[]).length>=240||typeof payload.id!=="string"||!payload.id||payload.id.length>120||(scene.walls||[]).some(wall=>wall.id===payload.id)||!space||!a||!b||a.x<0||a.y<0||b.x<0||b.y<0||a.x>=space.width||b.x>=space.width||a.y>=space.height||b.y>=space.height||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1||duplicate||typeof payload.label!=="string"||!payload.label.trim()||payload.label.length>80||!finite(payload.hp)||Number(payload.hp)<1||Number(payload.hp)>9999||payload.maxHp!=null&&(!finite(payload.maxHp)||Number(payload.maxHp)<Number(payload.hp)||Number(payload.maxHp)>9999))throw new Error("Некорректная Стена.");
  }
  if(["wall.damage","wall.restore","wall.remove"].includes(event.type)){
    const wall=(scene.walls||[]).find(item=>item.id===payload.wallId);if(!wall||event.type!=="wall.remove"&&(!finite(payload.amount)||Number(payload.amount)<0||Number(payload.amount)>9999))throw new Error("Стена уже отсутствует или изменение некорректно.");
  }
  if (event.type === "marker.create") {
    const space = (scene.spaces || []).find(item => item.id === payload.space);
    if ((scene.markers || []).length >= 240 || typeof payload.id !== "string" || !payload.id || payload.id.length > 120 || (scene.markers || []).some(marker => marker.id === payload.id) || typeof payload.markerKind !== "string" || !payload.markerKind || payload.markerKind.length > 40 || !space || !Number.isInteger(Number(payload.x)) || !Number.isInteger(Number(payload.y)) || Number(payload.x) < 0 || Number(payload.y) < 0 || Number(payload.x) >= space.width || Number(payload.y) >= space.height || !["endTurn","nextTurn","round","scene","persistent"].includes(payload.duration)) throw new Error("Некорректный маркер Техники.");
    if (removedCellKeys(scene, payload.space).has(`${Number(payload.x)},${Number(payload.y)}`)) throw new Error("Нельзя поставить маркер в удалённую клетку.");
  }
  if (event.type === "topology.cells.remove") {
    const status = topologyStatus(scene, { space: payload.space, cells: payload.cells, operation: "remove" });
    if (!status.available || typeof payload.id !== "string" || !payload.id || payload.id.length > 120 || topologyCuts(scene).some(cut => cut.id === payload.id) || typeof payload.label !== "string" || !payload.label.trim() || payload.label.length > 80 || status.cells.length > 144 || payload.crossing != null && !["blocked", "opposite"].includes(payload.crossing) || payload.destroyConnectedTerrain != null && typeof payload.destroyConnectedTerrain !== "boolean") throw new Error(status.reason || "Некорректное удаление клеток.");
  }
  if (event.type === "topology.cells.restore") {
    const cut = topologyCuts(scene).find(item => item.id === payload.cutId);
    if (!cut) throw new Error("Восстанавливаемый разрыв поля уже отсутствует.");
  }
  if (event.type === "targets.set" && (!Array.isArray(payload.actorIds) || payload.actorIds.length > 40 || payload.actorIds.some(id => !actorById(scene, id) || actorById(scene, id).knockedOut))) throw new Error("Некорректный список целей.");
  if (event.type === "space.ensure" && (typeof payload.id !== "string" || !payload.id || (!((scene.spaces || []).some(space => space.id === payload.id || space.name === payload.name)) && (scene.spaces || []).length >= 12) || !finite(payload.width) || !finite(payload.height) || Number(payload.width) < 1 || Number(payload.height) < 1 || Number(payload.width) > 12 || Number(payload.height) > 12)) throw new Error("Некорректное отдельное пространство.");
  if (["technique.prepare", "technique.resolve", "technique.manual"].includes(event.type) && JSON.stringify(payload).length > 8192) throw new Error("Событие Техники слишком велико.");
  if (event.type === "reaction.respond" && !["pass", "Блок", "Уворот", "Столкновение"].includes(payload.choice) && !String(payload.choice || "").startsWith("enemy.antagonist-trait.")) throw new Error("Некорректный ответ на Реакцию.");
  return event;
}

function validateTransition(scene, event) {
  const actor = event.actorId ? actorById(scene, event.actorId) : null;
  const plan = scene.pendingActionPlan;
  if (event.type === "action.plan") {
    if (scene.pendingAction || scene.pendingPrompt || plan) throw new Error("Сначала завершите текущую цепочку или составное действие.");
    if (scene.activeActorId !== event.actorId || actor?.knockedOut) throw new Error("Составное действие можно готовить только в собственный Ход.");
  }
  if (["action.plan.update", "action.plan.cancel"].includes(event.type)) {
    if (!plan || plan.id !== event.payload?.planId) throw new Error("Этот план составного действия уже устарел.");
    if (plan.actorId !== event.actorId) throw new Error("План составного действия принадлежит другому персонажу.");
  }
  if (plan && ["turn.start", "turn.end", "round.end", "enemy.action.prepare"].includes(event.type)) throw new Error("Сначала завершите или отмените составное действие.");
  if (plan && event.type === "action.prepare" && (event.payload?.planId !== plan.id || event.actorId !== plan.actorId || (event.payload?.declaredActionId || event.payload?.actionId) !== plan.actionId)) throw new Error("Действие не совпадает с сохранённым составным планом.");
  if (plan && event.type === "attack.pending" && event.actorId !== plan.actorId) throw new Error("Сначала завершите сохранённое составное действие.");
  if (scene.pendingAction && ["turn.start", "turn.end", "round.end"].includes(event.type)) {
    throw new Error("Сначала завершите текущую цепочку Реакций.");
  }
  if (scene.pendingAction && event.type === "attack.pending") throw new Error("Сначала завершите текущую цепочку Реакций.");
  if (scene.pendingPrompt && ["action.prepare", "enemy.action.prepare", "attack.pending"].includes(event.type)) throw new Error("Сначала ответьте на сработавшее правило.");
  if (event.type === "turn.start") {
    const status = turnStartStatus(scene, event.actorId);
    if (!status.available) throw new Error(status.reason);
  }
  if (event.type === "turn.end" && scene.activeActorId !== event.actorId) {
    throw new Error("Завершить можно только текущий Ход.");
  }
  if (event.type === "round.end") {
    const status = roundEndStatus(scene);
    if (!status.available) throw new Error(status.reason);
  }
  if (["action.prepare", "enemy.action.prepare", "attack.pending"].includes(event.type) && scene.activeActorId !== event.actorId && !event.payload?.quickReaction) {
    throw new Error(actor ? `Сейчас не Ход «${actor.name}».` : "Исполнитель действия не найден.");
  }
  if (["action.prepare", "enemy.action.prepare", "attack.pending"].includes(event.type) && actor?.knockedOut) throw new Error("Выведенный из строя участник не может действовать.");
  if (event.type === "area.remove" && (!(scene.objects || []).some(object => object.id === event.payload?.id))) throw new Error("Удаляемая местность уже отсутствует.");
  if (event.type === "effect.remove") {
    const status = effectStatus(scene, event.payload?.targetId, event.payload?.effect);
    if (status.direct && !status.removable && !event.payload?.automatic && !event.payload?.force) throw new Error("Этот Эффект нельзя снять до конца Сцены.");
  }
  if (["resource.spend", "resource.gain"].includes(event.type) && actor) {
    const status = resourceOperationStatus(scene, actor.id, { ...event.payload, operation: event.type === "resource.gain" ? "gain" : "spend" });
    if (!status.available) throw new Error(status.reason);
  }
  if (event.type === "rule-resource.spend" && actor) {
    const status = ruleResourceStatus(scene, actor.id, { resource: event.payload.resource, amount: event.payload.amount, operation: "spend" });
    if (!status.available) throw new Error(status.reason);
  }
  if (event.type === "rule-clock.tick" && actor) {
    const status = clockStatus(scene, actor.id, event.payload.clockId, { delta: event.payload.delta });
    if (Number(event.payload.delta) < 0 && status.value + Number(event.payload.delta) < 0) throw new Error(`На часах «${status.label}» недостаточно сегментов.`);
  }
  if (event.type === "rule.prompt" && scene.pendingPrompt) throw new Error("Сначала ответьте на уже открытый запрос правила.");
  if (event.type === "reaction.respond") {
    const response = scene.pendingAction?.responses?.[event.actorId];
    if (!response || response.choice !== "pending") throw new Error("Эта Реакция уже закрыта или не предлагалась.");
    if (actor?.knockedOut) throw new Error("Персонаж уже вне боя и не может Реагировать.");
    const source = actorById(scene, scene.pendingAction?.actorId);
    if (!source || source.knockedOut) throw new Error("Атакующий уже вне боя; цепочку нужно закрыть.");
  }
  if (event.type === "attack.clear") {
    if (!scene.pendingAction) throw new Error("Ожидающей Атаки уже нет.");
    if (event.payload?.pendingId && event.payload.pendingId !== scene.pendingAction.id) throw new Error("Эта цепочка Атаки уже устарела.");
  }
}

function advanceComboCooldowns(actor) {
  actor.comboCooldowns ||= {};
  Object.keys(actor.comboCooldowns).forEach(ruleId => {
    actor.comboCooldowns[ruleId] = Math.max(0, Number(actor.comboCooldowns[ruleId] || 0) - 1);
    if (!actor.comboCooldowns[ruleId]) delete actor.comboCooldowns[ruleId];
  });
}

function applyKnockoutState(scene, target, payload) {
  if (!target || target.knockedOut) {
    payload.applied = false;
    return false;
  }
  target.hp = 0;
  target.knockedOut = true;
  scene.tension = Number(scene.tension || 0) + 1;
  scene.targetIds = (scene.targetIds || []).filter(id => id !== target.id);
  if (scene.pendingAction?.responses?.[target.id]?.choice === "pending") scene.pendingAction.responses[target.id] = { choice: "unavailable", reason: "Цель выведена из боя" };
  if (scene.pendingAction?.actorId === target.id) scene.pendingAction.interruptedReason = "Атакующий выведен из боя";
  if (scene.activeActorId === target.id) {
    target.acted = true;
    target.stepRemaining = 0;
    target.extraTurns = 0;
    advanceComboCooldowns(target);
    payload.endedTurnActorId = target.id;
    scene.activeActorId = null;
  }
  payload.applied = true;
  return true;
}

function setCompoundHealth(scene, status, total) {
  let remaining = Math.max(0, Math.min(Number(status.maxHp || 0), Number(total || 0)));
  for (const part of status.parts) {
    const value = Math.min(Math.max(0, Number(part.maxHp || 0)), remaining);
    part.hp = value;
    part.knockedOut = Number(total || 0) <= 0;
    remaining -= value;
  }
  if (total <= 0) for (const part of status.parts) part.knockedOut = true;
}

function reduceEvent(scene, event) {
  const actor = event.actorId ? actorById(scene, event.actorId) : null;
  const payload = event.payload;
  if (event.type === "action.plan" && actor) {
    scene.pendingActionPlan = { id: payload.id, actorId: actor.id, actionId: payload.actionId, actionName: payload.actionName || payload.name || "Действие", phase: payload.phase, context: clone(payload.context), createdVersion: Number(scene.version || 0), createdEventId: event.id };
  } else if (event.type === "action.plan.update" && actor) {
    scene.pendingActionPlan.phase = payload.phase;
    if (payload.context) scene.pendingActionPlan.context = clone(payload.context);
    payload.actionId = scene.pendingActionPlan.actionId;
  } else if (event.type === "action.plan.cancel" && actor) {
    payload.actionId = scene.pendingActionPlan?.actionId || payload.actionId || null;
    payload.actionName = scene.pendingActionPlan?.actionName || payload.actionName || "Действие";
    payload.cancelled = true;
    scene.pendingActionPlan = null;
  } else if (["resource.spend", "resource.gain"].includes(event.type) && actor) {
    const status = resourceOperationStatus(scene, actor.id, { ...payload, operation: event.type === "resource.gain" ? "gain" : "spend" });
    payload.resolvedResource = status.resolvedResource;
    payload.resolvedDelta = status.delta;
    payload.replacement = status.replacement;
    if (status.ignored) payload.ignoredReason = status.ignoredReason;
    if (status.replacement && !status.definition.externalResource) {
      actor.ruleResources ||= {};
      actor.ruleResources[status.resolvedResource] = { ...status.definition, value: status.remaining };
      if (status.definition.legacyProperty) actor[status.definition.legacyProperty] = status.remaining;
    } else {
      const key = status.replacement ? null : payload.resource;
      // Focus deliberately has no upper clamp. Starting Focus is not a maximum.
      if (key) {
        const next = Math.max(0, Number(actor[key] || 0) + status.delta);
        actor[key] = key === "meals" ? Math.min(Number(actor.maxMeals || next), next) : next;
      }
    }
  } else if (event.type === "actor.runtime.set" && actor) {
    payload.before = Number(actor[payload.key] || 0);
    actor[payload.key] = Number(payload.value);
  } else if (event.type === "rule-mode.set" && actor) {
    const status = ruleModeStatus(scene, actor.id, { groupId: payload.groupId, modeId: payload.modeId });
    actor.ruleModes ||= {};
    actor.ruleModes[payload.groupId] = { modeId: payload.modeId, label: status.mode.label, ruleId: payload.ruleId || null, equippedTurnSerial: Number(scene.turnSerial || 0) };
    payload.label = status.mode.label;
    payload.replacedModeId = status.current?.modeId || null;
  } else if (event.type === "rule-resource.configure" && actor) {
    const definition = normalizeRuleResourceDefinition(actor, payload);
    const previous = ruleResourceDefinition(actor, definition.resource);
    actor.ruleResources ||= {};
    actor.ruleResources[definition.resource] = { ...definition, value: previous ? ruleResourceBalance(actor, previous) : definition.initial };
    payload.value = actor.ruleResources[definition.resource].value;
  } else if (["rule-resource.spend", "rule-resource.gain"].includes(event.type) && actor) {
    const definition = ruleResourceDefinition(actor, payload.resource), balance = ruleResourceBalance(actor, definition);
    const direction = event.type === "rule-resource.gain" ? 1 : -1;
    const delta = Number(payload.amount || 0) * direction;
    const next = definition.maximum == null ? Math.max(definition.minimum, balance + delta) : Math.min(definition.maximum, Math.max(definition.minimum, balance + delta));
    actor.ruleResources ||= {};
    actor.ruleResources[definition.resource] = { ...definition, value: next };
    if (definition.legacyProperty) actor[definition.legacyProperty] = next;
    payload.resolvedDelta = next - balance;
  } else if (event.type === "rule-resource.set" && actor) {
    const definition = ruleResourceDefinition(actor, payload.resource);
    actor.ruleResources ||= {};
    actor.ruleResources[definition.resource] = { ...definition, value: Number(payload.value) };
    if (definition.legacyProperty) actor[definition.legacyProperty] = Number(payload.value);
  } else if (event.type === "rule-resource.reset" && actor) {
    const definition = ruleResourceDefinition(actor, payload.resource);
    actor.ruleResources ||= {};
    actor.ruleResources[definition.resource] = { ...definition, value: definition.initial };
    if (definition.legacyProperty) actor[definition.legacyProperty] = definition.initial;
    payload.value = definition.initial;
  } else if (event.type === "rule-clock.configure" && actor) {
    const definition = normalizeRuleClockDefinition(payload), previous = ruleClockDefinition(actor, definition.clockId), previousValue = previous ? ruleClockValue(actor, previous) : definition.initial;
    actor.ruleClocks ||= {};
    const value = payload.value == null ? Math.min(definition.size, previousValue) : Number(payload.value);
    const active = payload.active == null ? (previous ? clockStatus(scene, actor.id, definition.clockId).active : definition.active) : Boolean(payload.active);
    actor.ruleClocks[definition.clockId] = { ...definition, value, active };
    if (definition.legacyTechniqueState) {
      actor.techniqueState ||= {};
      actor.techniqueState[definition.legacyTechniqueState] = value;
    }
    Object.assign(payload, { value, active, previousSize: previous?.size ?? null });
  } else if (event.type === "rule-clock.tick" && actor) {
    const status = clockStatus(scene, actor.id, payload.clockId), definition = status.definition, before = status.value, value = Math.max(0, Math.min(status.size, before + Number(payload.delta)));
    const active = payload.activate === true ? true : status.active;
    actor.ruleClocks ||= {};
    actor.ruleClocks[payload.clockId] = { ...definition, value, active: definition.removeWhenEmpty && value === 0 ? false : active };
    if (definition.legacyTechniqueState) {
      actor.techniqueState ||= {};
      actor.techniqueState[definition.legacyTechniqueState] = value;
    }
    Object.assign(payload, { label: status.label, size: status.size, before, value, appliedDelta: value - before, filled: before < status.size && value === status.size, emptied: before > 0 && value === 0, active: actor.ruleClocks[payload.clockId].active });
  } else if (event.type === "rule-clock.set" && actor) {
    const status = clockStatus(scene, actor.id, payload.clockId), definition = status.definition, before = status.value, value = Number(payload.value), active = payload.active == null ? status.active : Boolean(payload.active);
    actor.ruleClocks ||= {};
    actor.ruleClocks[payload.clockId] = { ...definition, value, active: definition.removeWhenEmpty && value === 0 ? false : active };
    if (definition.legacyTechniqueState) {
      actor.techniqueState ||= {};
      actor.techniqueState[definition.legacyTechniqueState] = value;
    }
    Object.assign(payload, { label: status.label, size: status.size, before, appliedDelta: value - before, filled: before < status.size && value === status.size, emptied: before > 0 && value === 0, active: actor.ruleClocks[payload.clockId].active });
  } else if (event.type === "rule-clock.reset" && actor) {
    const status = clockStatus(scene, actor.id, payload.clockId), definition = status.definition, value = definition.initial;
    actor.ruleClocks ||= {};
    actor.ruleClocks[payload.clockId] = { ...definition, value, active: definition.active };
    if (definition.legacyTechniqueState) {
      actor.techniqueState ||= {};
      actor.techniqueState[definition.legacyTechniqueState] = value;
    }
    Object.assign(payload, { label: status.label, size: status.size, before: status.value, value, appliedDelta: value - status.value, active: definition.active });
  } else if (event.type === "actor.spawn") {
    scene.actors ||= [];
    scene.actors.push(clone(payload.actor));
  } else if (event.type === "actor.move" && actor) {
    payload.from ||= { space: actor.space, x: Number(actor.x), y: Number(actor.y) };
    const compoundId = actor.team === "enemy" && typeof actor.compoundId === "string" && actor.compoundId.trim() ? actor.compoundId.trim() : null;
    const moved = compoundId ? (scene.actors || []).filter(item => item.team === "enemy" && String(item.compoundId || "").trim() === compoundId) : [actor];
    for (const part of moved) Object.assign(part, { space: payload.space || actor.space, x: Number(payload.x), y: Number(payload.y) });
    if (compoundId) payload.movedActorIds = moved.map(part => part.id);
  } else if (event.type === "area.create") {
    scene.objects ||= [];
    if (["high","low"].includes(payload.areaType)) {
      const cells = new Set(payload.cells), opposite = payload.areaType === "high" ? "low" : "high";
      scene.objects = scene.objects.map(object => object.space === payload.space && object.type === opposite ? { ...object, cells: (object.cells || []).filter(cell => !cells.has(cell)) } : object).filter(object => object.type !== opposite || object.cells.length);
    }
    const destructible = payload.areaType === "terrain", defaultHp = destructible ? payload.cells.length * 10 : 0;
    scene.objects.push({ id: payload.id, space: payload.space, type: payload.areaType, label: payload.label, source: payload.source, ruleId: payload.ruleId || payload.source || "", duration: payload.duration, ownerActorId: payload.ownerActorId || event.actorId, cells: [...payload.cells], hp: destructible ? Number(payload.hp ?? payload.metadata?.hp ?? defaultHp) : null, maxHp: destructible ? Number(payload.maxHp ?? payload.metadata?.maxHp ?? payload.hp ?? defaultHp) : null, createdRound: Number(scene.round || 1), metadata: clone(payload.metadata || {}) });
  } else if (event.type === "area.remove") {
    const removed = (scene.objects || []).find(object => object.id === payload.id);
    payload.label = removed?.label || payload.label || "местность";
    scene.objects = (scene.objects || []).filter(object => object.id !== payload.id);
  } else if (event.type === "area.duration") {
    const object = (scene.objects || []).find(item => item.id === payload.id);
    payload.before = object.duration;
    payload.label = object.label;
    object.duration = payload.duration;
  } else if (event.type === "object.damage") {
    const object = (scene.objects || []).find(item => item.id === payload.objectId);
    if (object) {
      const fallback = Math.max(1, Number(object.cells?.length || 1) * 10), before = Number(object.hp || object.maxHp || fallback);
      object.maxHp = Math.max(before, Number(object.maxHp || before));
      object.hp = Math.max(0, before - Number(payload.amount || 0));
      payload.dealt = before - object.hp;
      payload.destroyed = object.hp === 0;
      payload.label = object.label;
      if (payload.destroyed) scene.objects = (scene.objects || []).filter(item => item.id !== object.id);
    }
  } else if (event.type === "object.restore") {
    const object=(scene.objects||[]).find(item=>item.id===payload.objectId);if(object){const before=Number(object.hp||0);object.hp=Math.min(Number(object.maxHp||before),before+Number(payload.amount||0));payload.restored=object.hp-before;payload.label=object.label}
  } else if(event.type==="wall.create"){
    scene.walls||=[];scene.walls.push({id:payload.id,space:payload.space,a:payload.a,b:payload.b,label:payload.label,source:payload.source||"Ручное правило",hp:Number(payload.hp),maxHp:Number(payload.maxHp||payload.hp),createdRound:Number(scene.round||1)});
  } else if(event.type==="wall.damage"){
    const wall=(scene.walls||[]).find(item=>item.id===payload.wallId);if(wall){const before=Number(wall.hp||wall.maxHp||10);wall.hp=Math.max(0,before-Number(payload.amount||0));payload.dealt=before-wall.hp;payload.destroyed=wall.hp===0;payload.label=wall.label;if(payload.destroyed)scene.walls=scene.walls.filter(item=>item.id!==wall.id)}
  } else if(event.type==="wall.restore"){
    const wall=(scene.walls||[]).find(item=>item.id===payload.wallId);if(wall){const before=Number(wall.hp||0);wall.hp=Math.min(Number(wall.maxHp||before),before+Number(payload.amount||0));payload.restored=wall.hp-before;payload.label=wall.label}
  } else if(event.type==="wall.remove"){
    const wall=(scene.walls||[]).find(item=>item.id===payload.wallId);payload.label=wall?.label||payload.label||"Стена";scene.walls=(scene.walls||[]).filter(item=>item.id!==payload.wallId);
  } else if (event.type === "marker.create") {
    scene.markers ||= [];
    scene.markers.push({ id: payload.id, space: payload.space, x: Number(payload.x), y: Number(payload.y), kind: payload.markerKind, label: payload.label, color: payload.color, source: payload.source, ruleId: payload.ruleId || payload.source || "", duration: payload.duration, ownerActorId: payload.ownerActorId || event.actorId, createdRound: Number(scene.round || 1), metadata: clone(payload.metadata || {}) });
  } else if (event.type === "marker.move") {
    const marker = markerById(scene, payload.markerId);
    if (marker) {
      payload.from ||= { space: marker.space, x: marker.x, y: marker.y };
      Object.assign(marker, { space: payload.space || marker.space, x: Number(payload.x), y: Number(payload.y) });
    }
  } else if (event.type === "marker.remove") {
    const marker = markerById(scene, payload.markerId);
    payload.label = marker?.label || payload.label || "маркер";
    scene.markers = (scene.markers || []).filter(item => item.id !== payload.markerId);
  } else if (event.type === "marker.duration") {
    const marker = markerById(scene, payload.markerId);
    payload.before = marker.duration;
    payload.label = marker.label;
    marker.duration = payload.duration;
  } else if (event.type === "reminder.create") {
    scene.reminders ||= [];
    scene.reminders.push({ id: payload.id, label: payload.label.trim(), text: payload.text.trim(), boundary: payload.boundary, ownerActorId: payload.ownerActorId || event.actorId || null, createdTurnSerial: Number(scene.turnSerial || 0), createdRound: Number(scene.round || 1), due: false, dueEventId: "", sourceActionId: payload.sourceActionId || "manual.reminder" });
  } else if (event.type === "reminder.due") {
    const reminder = (scene.reminders || []).find(item => item.id === payload.id);
    reminder.due = true;
    reminder.dueEventId = event.id;
    payload.label = reminder.label;
    payload.text = reminder.text;
  } else if (["reminder.resolve", "reminder.remove"].includes(event.type)) {
    const reminder = (scene.reminders || []).find(item => item.id === payload.id);
    payload.label = reminder.label;
    scene.reminders = (scene.reminders || []).filter(item => item.id !== payload.id);
  } else if (event.type === "topology.cells.remove") {
    scene.topology ||= { cuts: [] };
    scene.topology.cuts ||= [];
    const cells = [...new Set(payload.cells.map(String))];
    const terrain = payload.destroyConnectedTerrain ? terrainComponentStatus(scene, { space: payload.space, cells, types: ["terrain", "difficult", "custom"] }) : null;
    const destroyedTerrainIds = terrain?.available ? terrain.objectIds : [];
    const destroyedTerrainLabels = terrain?.available ? terrain.objects.map(object => object.label) : [];
    if (destroyedTerrainIds.length) scene.objects = (scene.objects || []).filter(object => !destroyedTerrainIds.includes(object.id));
    scene.topology.cuts.push({ id: payload.id, space: payload.space, cells, label: payload.label, source: payload.source || "Ручное правило", ruleId: payload.ruleId || "", ownerActorId: payload.ownerActorId || event.actorId || null, crossing: payload.crossing === "opposite" ? "opposite" : "blocked", createdRound: Number(scene.round || 1) });
    Object.assign(payload, { cells, count: cells.length, crossing: payload.crossing === "opposite" ? "opposite" : "blocked", destroyedTerrainIds, destroyedTerrainLabels });
  } else if (event.type === "topology.cells.restore") {
    const cut = topologyCuts(scene).find(item => item.id === payload.cutId);
    Object.assign(payload, { label: cut?.label || payload.label || "Разрыв поля", cells: [...(cut?.cells || [])], count: Number(cut?.cells?.length || 0), space: cut?.space || payload.space });
    scene.topology.cuts = topologyCuts(scene).filter(item => item.id !== payload.cutId);
  } else if (event.type === "targets.set") {
    scene.targetIds = [...payload.actorIds];
  } else if (event.type === "space.ensure") {
    scene.spaces ||= [];
    if (!scene.spaces.some(space => space.id === payload.id || space.name === payload.name)) scene.spaces.push({ id: payload.id, name: payload.name, width: Number(payload.width), height: Number(payload.height) });
    if (payload.activate) scene.activeSpace = (scene.spaces.find(space => space.id === payload.id || space.name === payload.name) || {}).id || scene.activeSpace;
  } else if (event.type === "challenge.request") {
    scene.challengeRequest = { id: payload.id, actorId: payload.actorId, target: Number(payload.target), requestedBy: payload.requestedBy.trim(), at: event.at, result: null };
    scene.opposedRoll = null;
  } else if (event.type === "challenge.clear") {
    scene.challengeRequest = null;
  } else if (event.type === "opposed.request") {
    scene.opposedRoll = { id: payload.id, participants: payload.participants.map(participant => ({ id: participant.id, actorId: participant.actorId || null, heroId: participant.heroId || null, name: participant.name.trim(), controller: participant.controller, pool: Number(participant.pool) })), attempt: 1, results: {}, status: "rolling", winnerParticipantId: null, resolution: null, requestedBy: payload.requestedBy.trim(), at: event.at };
    scene.challengeRequest = null;
  } else if (event.type === "opposed.reroll") {
    scene.opposedRoll.attempt = Number(scene.opposedRoll.attempt || 1) + 1;
    scene.opposedRoll.results = {};
    scene.opposedRoll.status = "rolling";
    scene.opposedRoll.winnerParticipantId = null;
    scene.opposedRoll.resolution = null;
  } else if (event.type === "opposed.tie.resolve") {
    scene.opposedRoll.status = "resolved";
    scene.opposedRoll.winnerParticipantId = null;
    scene.opposedRoll.resolution = "both";
  } else if (event.type === "opposed.clear") {
    scene.opposedRoll = null;
  } else if (event.type === "roll.public") {
    scene.rollFeed ||= [];
    scene.rollFeed.unshift({ id: event.id, at: event.at || new Date().toISOString(), actor: actor?.name || payload.actor || "Система", actorId: actor?.id || null, formula: payload.formula, rolls: payload.rolls || [], successes: Number(payload.successes || 0), crits: Number(payload.crits || 0), outcome: typeof payload.outcome === "string" ? payload.outcome.slice(0, 80) : "", payment: typeof payload.payment === "string" ? payload.payment.slice(0, 80) : "", target: payload.target == null ? null : Number(payload.target), challengeRequestId: typeof payload.challengeRequestId === "string" ? payload.challengeRequestId.slice(0, 120) : "", opposedRequestId: typeof payload.opposedRequestId === "string" ? payload.opposedRequestId.slice(0, 120) : "", opposedParticipantId: typeof payload.opposedParticipantId === "string" ? payload.opposedParticipantId.slice(0, 120) : "", opposedAttempt: payload.opposedAttempt == null ? null : Number(payload.opposedAttempt), dice: payload.dice ? clone(payload.dice) : null, targetIds: clone(payload.dice?.targetIds || payload.targetIds || []) });
    scene.rollFeed = scene.rollFeed.slice(0, 20);
    if (payload.challengeRequestId && scene.challengeRequest?.id === payload.challengeRequestId) {
      scene.challengeRequest.result = { rollEventId: event.id, formula: payload.formula, rolls: clone(payload.rolls || []), successes: Number(payload.successes || 0), crits: Number(payload.crits || 0), outcome: typeof payload.outcome === "string" ? payload.outcome.slice(0, 80) : "", payment: typeof payload.payment === "string" ? payload.payment.slice(0, 80) : "", at: event.at };
    }
    if (payload.opposedRequestId && scene.opposedRoll?.id === payload.opposedRequestId) {
      const opposed = scene.opposedRoll, participantId = payload.opposedParticipantId;
      opposed.results ||= {};
      opposed.results[participantId] = { participantId, rollEventId: event.id, formula: payload.formula, rolls: clone(payload.rolls || []), successes: Number(payload.successes || 0), crits: Number(payload.crits || 0), payment: typeof payload.payment === "string" ? payload.payment.slice(0, 80) : "", at: event.at };
      const [left, right] = opposed.participants, leftResult = opposed.results[left.id], rightResult = opposed.results[right.id];
      if (leftResult && rightResult) {
        if (leftResult.successes === rightResult.successes) {
          opposed.status = "tied";
          opposed.winnerParticipantId = null;
          opposed.resolution = null;
        } else {
          opposed.status = "resolved";
          opposed.winnerParticipantId = leftResult.successes > rightResult.successes ? left.id : right.id;
          opposed.resolution = "winner";
        }
      } else {
        opposed.status = "rolling";
        opposed.winnerParticipantId = null;
        opposed.resolution = null;
      }
    }
  } else if (event.type === "roll.redirect") {
    const sourceRoll = (scene.rollFeed || []).find(roll => roll.id === payload.sourceRollId);
    if (sourceRoll) {
      sourceRoll.redirected = true;
      sourceRoll.redirectTargetId = payload.targetId;
      sourceRoll.originalTargetIds = clone(sourceRoll.targetIds || []);
    }
    scene.targetIds = [payload.targetId];
  } else if (event.type === "rule.share") {
    scene.ruleHandouts ||= [];
    scene.ruleHandouts.unshift({ id: event.id, ruleId: payload.ruleId, title: payload.title.trim(), kind: payload.kind.trim() || "Правило", sharedBy: payload.sharedBy.trim() || "Нарратор", at: event.at });
    scene.ruleHandouts = scene.ruleHandouts.slice(0, 12);
  } else if (event.type === "session-clock.create") {
    scene.sessionClocks ||= [];
    scene.sessionClocks.push({ id: payload.id, name: payload.name.trim(), kind: payload.kind, size: Number(payload.size), value: 0 });
    scene.tools = { ...(scene.tools || {}), clocksMigrated: true };
  } else if (event.type === "session-clock.set") {
    const clock = (scene.sessionClocks || []).find(item => item.id === payload.id);
    payload.before = clock.value;
    clock.value = Number(payload.value);
  } else if (event.type === "session-clock.rename") {
    const clock = (scene.sessionClocks || []).find(item => item.id === payload.id);
    payload.before = clock.name;
    clock.name = payload.name.trim();
  } else if (event.type === "session-clock.kind") {
    const clock = (scene.sessionClocks || []).find(item => item.id === payload.id);
    payload.before = clock.kind;
    clock.kind = payload.kind;
  } else if (event.type === "session-clock.size") {
    const clock = (scene.sessionClocks || []).find(item => item.id === payload.id);
    payload.before = clock.size;
    clock.size = Number(payload.size);
    clock.value = Math.min(clock.value, clock.size);
  } else if (event.type === "session-clock.remove") {
    const clock = (scene.sessionClocks || []).find(item => item.id === payload.id);
    payload.name = clock.name;
    scene.sessionClocks = (scene.sessionClocks || []).filter(item => item.id !== payload.id);
  } else if (event.type === "attack.pending") {
    payload.targetIds = [...new Set(payload.targetIds || [])];
    const modifiers = effectAttackStatus(scene, event.actorId, payload.targetIds), originalDamage = Number(payload.damage || 0), originalByTarget = clone(payload.damageByTarget || {});
    const effectDamageDivisor = Math.max(1, Number(payload.effectDamageDivisor || 1));
    const transformDamage = value => Math.ceil(Math.max(0, Number(value || 0)) / effectDamageDivisor);
    const effectDamageBase = Number.isFinite(Number(payload.effectDamageBase)) ? Number(payload.effectDamageBase) : originalDamage;
    const effectDamageBaseByTarget = clone(payload.effectDamageBaseByTarget || originalByTarget);
    payload.baseDamage = originalDamage;
    payload.baseDamageByTarget = originalByTarget;
    payload.effectDamageModifier = modifiers.damageModifier;
    payload.effectHindrance = modifiers.hindrance;
    payload.effectHindranceEffects = modifiers.hindranceEffects;
    payload.damage = Math.max(0, originalDamage + transformDamage(effectDamageBase + modifiers.damageModifier) - transformDamage(effectDamageBase));
    payload.damageByTarget = Object.fromEntries(payload.targetIds.map(targetId => {
      const base = Number.isFinite(Number(originalByTarget[targetId])) ? Number(originalByTarget[targetId]) : originalDamage;
      const effectBase = Number.isFinite(Number(effectDamageBaseByTarget[targetId])) ? Number(effectDamageBaseByTarget[targetId]) : effectDamageBase;
      const modifier = modifiers.damageModifier + Number(modifiers.damageByTarget[targetId] || 0);
      return [targetId, Math.max(0, base + transformDamage(effectBase + modifier) - transformDamage(effectBase))];
    }));
    scene.pendingAction = { id: event.id, actorId: event.actorId, ...clone(payload), responses: Object.fromEntries(payload.targetIds.map(id => [id, { choice: "pending" }])) };
  } else if (event.type === "reaction.respond" && scene.pendingAction) {
    scene.pendingAction.responses[event.actorId] = {
      choice: payload.choice,
      label: payload.label || payload.choice,
      destination: payload.destination || null,
      clash: payload.clash || null,
      untouchableEvasion: Number(payload.untouchableEvasion || 0),
      temporaryArmor: Number(payload.temporaryArmor || 0),
      temporaryEvasion: Number(payload.temporaryEvasion || 0),
      redirectTargetId: payload.redirectTargetId || null,
      enemyTrait: payload.enemyTrait || null,
    };
  } else if (event.type === "attack.clear") {
    scene.pendingAction = null;
  } else if (event.type === "damage.apply") {
    const target = actorById(scene, payload.targetId);
    if (target) {
      if (target.knockedOut) {
        payload.ignored = true;
        payload.dealt = 0;
        scene.log ||= [];
        scene.log.unshift(event);
        scene.log = scene.log.slice(0, 200);
        return;
      }
      const raw = Math.max(0, Number(payload.amount || 0));
      const compound = compoundEnemyStatus(scene, target), defense = effectDefenseStatus(scene, target.id);
      const armor = payload.ignoreArmor || !defense.armorAllowed ? 0 : Math.max(0, Number(compound.active ? compound.armor : target.armor || 0) + Number(payload.temporaryArmor || 0) + Number(defense.armorBonus || 0));
      const afterArmor = raw > 0 ? Math.max(1, raw - armor) : 0;
      const evasionOwner = compound.active ? compound.parts.reduce((best, part) => Number(part.evasion || 0) > Number(best.evasion || 0) ? part : best, compound.parts[0]) : target;
      const evasion = payload.ignoreEvasion ? 0 : Math.max(0, Number(evasionOwner.evasion || 0) + Number(payload.temporaryEvasion || 0));
      const evaded = Math.min(afterArmor, evasion);
      if (!payload.ignoreEvasion) evasionOwner.evasion = Math.max(0, Number(evasionOwner.evasion || 0) - Math.max(0, evaded - Number(payload.temporaryEvasion || 0)));
      let dealt = Math.max(0, afterArmor - evaded);
      if (compound.active && dealt > 0) {
        const gate = Number(compound.gate || 0), nextGate = gate > 0 ? Math.max(0, (Math.ceil(compound.hp / gate - 1e-9) - 1) * gate) : 0;
        dealt = Math.min(dealt, Math.max(0, compound.hp - nextGate));
        setCompoundHealth(scene, compound, compound.hp - dealt);
        payload.compoundId = compound.id;
        payload.compoundTargetIds = compound.parts.map(part => part.id);
        payload.healthGate = gate;
        payload.healthGateCrossed = compound.hp - dealt <= nextGate && dealt > 0;
        if (payload.healthGateCrossed) scene.tension = Number(scene.tension || 0) + 1;
      }
      const grimRedirect = Boolean(target.ruleState?.grimTransformed);
      if (!compound.active) {
        if (grimRedirect) target.focus = Math.max(0, Number(target.focus || 0) - dealt);
        else target.hp = Math.max(0, Number(target.hp || 0) - dealt);
      }
      payload.raw = raw;
      payload.armor = armor;
      payload.evaded = evaded;
      payload.dealt = dealt;
      payload.redirectedResource = grimRedirect ? "focus" : null;
      if (compound.active && compound.hp - dealt <= 0 && dealt > 0) {
        const ids = new Set(compound.parts.map(part => part.id));
        scene.targetIds = (scene.targetIds || []).filter(id => !ids.has(id));
        if (ids.has(scene.activeActorId)) scene.activeActorId = null;
        payload.applied = true;
      } else if (!compound.active && !grimRedirect && target.hp === 0 && dealt > 0) {
        const guts = Math.max(0, Number(target.guts ?? (target.team === "enemy" ? 0 : 1 + Number(target.attrs?.body || 0))));
        target.wounds = Math.max(0, Number(target.wounds || 0));
        let knockedOut = guts === 0;
        if (guts === 0) target.hp = 0;
        else {
          target.wounds += 1;
          payload.woundGained = true;
          if (event.actorId !== target.id) target.influence = Math.max(0, Number(target.influence || 0) + 1);
          if (target.wounds >= guts) {
            target.wounds -= 1;
            knockedOut = true;
          } else target.hp = guts;
        }
        if (knockedOut) applyKnockoutState(scene, target, payload);
      }
    }
  } else if (event.type === "effect.apply") {
    const target = actorById(scene, payload.targetId);
    if (target) {
      const affected = compoundParts(scene, target), source = event.actorId ? { actorId: event.actorId, actionId: String(payload.sourceActionId || "").slice(0, 180), eventId: event.id } : null, definition = effectLifecycleDefinition(payload.effect);
      for (const recipient of affected) {
        recipient.effects ||= []; recipient.effectStates ||= {};
        const added = !recipient.effects.includes(payload.effect), existing = effectStateFor(recipient, payload.effect);
        if (added) recipient.effects.push(payload.effect);
        const sources = [...(existing?.sources || []).filter(item => item.actorId !== source?.actorId), ...(source ? [source] : [])].slice(-12);
        recipient.effectStates[payload.effect] = {duration:existing?.removable===false?existing.duration:payload.duration||existing?.duration||definition.duration,removable:payload.removable===false?false:existing?.removable!==false,appliedTurnSerial:Number(scene.turnSerial||0),appliedRound:Number(scene.round||1),appliedEventId:event.id,sourceBound:existing?.sourceBound===true||definition.sourceBound,exclusiveBySource:payload.exclusiveBySource??existing?.exclusiveBySource??definition.exclusiveBySource,removeWithSource:existing?.removeWithSource===true||definition.removeWithSource,sources};
        if (recipient.id === target.id) {payload.added=added;payload.refreshed=!added;payload.duration=recipient.effectStates[payload.effect].duration;payload.sourceActorIds=sources.map(item=>item.actorId)}
      }
      payload.applied = true; payload.affectedActorIds = affected.map(item => item.id);
    }
  } else if (event.type === "effect.remove") {
    const target = actorById(scene, payload.targetId);
    if (target) {
      const affected = compoundParts(scene, target);
      for (const recipient of affected) {
      const active = (recipient.effects || []).includes(payload.effect), previous = effectStateFor(recipient, payload.effect);
      payload.previousState = previous ? clone(previous) : null;
      if (payload.sourceOnly && payload.sourceActorId && previous?.sources.length) {
        const sources = previous.sources.filter(source => source.actorId !== payload.sourceActorId);
        payload.detachedSource = sources.length !== previous.sources.length;
        if (sources.length) recipient.effectStates[payload.effect] = { ...previous, sources };
        else {
          recipient.effects = (recipient.effects || []).filter(effect => effect !== payload.effect);
          if (recipient.effectStates) delete recipient.effectStates[payload.effect];
        }
        payload.removed = active && !sources.length;
      } else {
        payload.removed = active;
        recipient.effects = (recipient.effects || []).filter(effect => effect !== payload.effect);
        if (recipient.effectStates) delete recipient.effectStates[payload.effect];
      }
      }
      payload.affectedActorIds = affected.map(item => item.id);
    }
  } else if (event.type === "actor.heal") {
    const target = actorById(scene, payload.targetId);
    if (target) {
      const compound=compoundEnemyStatus(scene,target),grimRedirect = Boolean(target.ruleState?.grimTransformed), key = grimRedirect ? "focus" : "hp", before = compound.active?compound.hp:Number(target[key] || 0);
      if(compound.active)setCompoundHealth(scene,compound,Math.min(compound.maxHp,before+Number(payload.amount||0)));else target[key] = grimRedirect ? before + Number(payload.amount || 0) : Math.min(Number(target.maxHp || before + Number(payload.amount || 0)), before + Number(payload.amount || 0));
      payload.restored = (compound.active?compoundEnemyStatus(scene,target).hp:target[key]) - before;
      if(compound.active)payload.affectedActorIds=compound.parts.map(part=>part.id);
      payload.redirectedResource = grimRedirect ? "focus" : null;
    }
  } else if (event.type === "actor.wound") {
    const target = actorById(scene, payload.targetId);
    if (target) {
      const before = Math.max(0, Number(target.wounds || 0));
      target.wounds = Math.max(0, before + Number(payload.delta || 0));
      payload.appliedDelta = target.wounds - before;
    }
  } else if (event.type === "actor.knockout") {
    const target = actorById(scene, payload.targetId);
    const compound=compoundEnemyStatus(scene,target);if(compound.active){for(const part of compound.parts){part.hp=0;part.knockedOut=true}scene.tension=Number(scene.tension||0)+1;scene.targetIds=(scene.targetIds||[]).filter(id=>!compound.parts.some(part=>part.id===id));if(compound.parts.some(part=>part.id===scene.activeActorId))scene.activeActorId=null;payload.applied=true;payload.affectedActorIds=compound.parts.map(part=>part.id)}else applyKnockoutState(scene, target, payload);
  } else if (event.type === "inventory.change" && actor) {
    actor.inventory ||= {};
    actor.inventory[payload.item] = Math.max(0, Number(actor.inventory[payload.item] || 0) + Number(payload.delta || 0));
    if (!actor.inventory[payload.item]) delete actor.inventory[payload.item];
  } else if (event.type === "rule.trigger") {
    scene.triggerQueue ||= [];
    const key = `${payload.sourceEventId}:${payload.triggerId}`;
    if (payload.status === "queued" && !scene.triggerQueue.some(item => item.key === key)) {
      scene.triggerQueue.push({ key, triggerId: payload.triggerId, sourceEventId: payload.sourceEventId, priority: Number(payload.priority || 0), ownerId: event.actorId, event: clone(payload.deferredEvent) });
      scene.triggerQueue.sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
    }
    if (payload.queued && ["fired", "cancelled"].includes(payload.status)) scene.triggerQueue = scene.triggerQueue.filter(item => item.key !== key);
  } else if (event.type === "rule.prompt") {
    const options = PLACEMENT_PROMPT_KINDS.has(payload.kind) && !payload.options.includes("cell") ? ["cell", ...payload.options] : payload.options;
    scene.pendingPrompt = { id: payload.id, kind: payload.kind, actorId: event.actorId, sourceActorId: payload.sourceActorId || event.actorId, controller: payload.controller === "narrator" ? "narrator" : "source", targetId: payload.targetId || null, markerId: payload.markerId || null, title: payload.title || "Решение правила", text: payload.text || "", options: clone(options || []), context: clone(payload.context || {}) };
  } else if (event.type === "rule.respond") {
    payload.kind = scene.pendingPrompt?.kind || payload.kind;
    payload.sourceActorId = scene.pendingPrompt?.sourceActorId || null;
    payload.targetId = scene.pendingPrompt?.targetId || null;
    scene.pendingPrompt = null;
  } else if (event.type === "technique.state" && actor) {
    actor.techniqueState ||= {};
    if (payload.key === "cunningPlan") actor.techniqueState.cunningPlan = Math.max(0, Math.min(4, Number(actor.techniqueState.cunningPlan || 0) + Number(payload.delta || 0)));
    if (payload.key === "study") {
      actor.techniqueState.studiedActorIds ||= [];
      payload.newTarget = !actor.techniqueState.studiedActorIds.includes(payload.targetId);
      if (payload.newTarget) actor.techniqueState.studiedActorIds.push(payload.targetId);
    }
    if (payload.key === "spellModifiers") actor.techniqueState.spellModifiers = [...new Set(payload.value || [])].slice(0, 2);
  } else if (event.type === "actor.state" && actor) {
    actor.ruleState ||= {};
    if (payload.key === "growth") actor.ruleState.growth = Math.max(0, Number(actor.ruleState.growth || 0) + Number(payload.delta || 0));
    else if (payload.key === "evasion") {
      payload.before = Number(actor.evasion || 0);
      actor.evasion = Math.max(0, payload.before + Number(payload.delta || 0));
      payload.value = actor.evasion;
      payload.appliedDelta = actor.evasion - payload.before;
    }
    else {
      actor.ruleState[payload.key] = payload.value;
      if (payload.key === "grimTransformed" && payload.value) actor.hp = Math.min(Number(actor.hp || 0), 1);
      if (payload.key === "grimTransformed" && !payload.value) actor.ruleState.drainLife = false;
    }
  } else if (event.type === "turn.grant" && actor) {
    actor.extraTurns = Math.max(0, Number(actor.extraTurns || 0) + Number(payload.amount || 0));
  } else if (event.type === "enemy.action.prepare" && actor) {
    actor.usedActions ||= [];
    if (!actor.usedActions.includes(payload.ruleId)) actor.usedActions.push(payload.ruleId);
    if (payload.kind === "trump") actor.usedTrump = true;
  } else if (event.type === "action.prepare" && actor) {
    if (scene.pendingActionPlan?.id === payload.planId) scene.pendingActionPlan = null;
    actor.usedActions ||= [];
    if (payload.actionId && !payload.quick && !payload.continuation && !actor.usedActions.includes(payload.actionId)) actor.usedActions.push(payload.actionId);
    if (payload.actionName === "Шаг" || payload.name === "Шаг") actor.stepRemaining = Math.max(0, Number(payload.stepRemaining || 0));
  } else if (event.type === "technique.prepare" && actor) {
    if (payload.cooldownTurns && payload.ruleId) {
      actor.comboCooldowns ||= {};
      actor.comboCooldowns[payload.ruleId] = Math.max(Number(actor.comboCooldowns[payload.ruleId] || 0), Number(payload.cooldownTurns || 0));
    }
  } else if (event.type === "actor.enter" && actor) {
    const cell = `${actor.x},${actor.y}`;
    const hazards = (scene.objects || []).filter(object => object.space === actor.space && object.cells?.includes(cell));
    const hostileFodder = (scene.actors || []).some(item => item.kind === "crowd" && !item.knockedOut && item.team !== actor.team && item.space === actor.space && Number(item.x) === Number(actor.x) && Number(item.y) === Number(actor.y));
    if (!payload.ignoreDifficult && !(actor.difficultTerrainImmunity||[]).includes(cell) && (hazards.some(object => object.type === "difficult") || hostileFodder)) {
      actor.speedZeroUntilTurnEnd = true;
      actor.stepRemaining = 0;
    }
  } else if (event.type === "turn.start" && actor) {
    scene.turnSerial = Number(scene.turnSerial || 0) + 1;
    scene.activeActorId = actor.id;
    actor.acted = false;
    actor.stepRemaining = 0;
    const difficult=terrainComponentStatus(scene,{space:actor.space,cells:[`${actor.x},${actor.y}`],types:["difficult"]}),crowdHere=(scene.actors||[]).some(item=>item.kind==="crowd"&&!item.knockedOut&&item.team!==actor.team&&item.space===actor.space&&Number(item.x)===Number(actor.x)&&Number(item.y)===Number(actor.y));actor.difficultTerrainImmunity=difficult.available?difficult.cells:crowdHere?[`${actor.x},${actor.y}`]:[];
    if (actor.team === "enemy") actor.ap = Number(actor.baseAp || 2);
    if (hasEffect(scene, actor, "negative.ошеломлен")) {
      const before = Number(actor.ap || 0);
      actor.ap = Math.max(0, before - 1);
      payload.stunnedApPenalty = before - actor.ap;
    }
  } else if (event.type === "turn.end" && actor) {
    payload.endedTurnSerial = Number(scene.turnSerial || 0);
    actor.acted = true;
    actor.stepRemaining = 0;
    advanceComboCooldowns(actor);
    if (Number(actor.ruleState?.modifiedOverclockTurns || 0) > 0) actor.ruleState.modifiedOverclockTurns = Math.max(0, Number(actor.ruleState.modifiedOverclockTurns) - 1);
    actor.speedZeroUntilTurnEnd = false;
    actor.difficultTerrainImmunity = [];
    if (Number(actor.extraTurns || 0) > 0) {
      actor.extraTurns -= 1;
      actor.acted = false;
      actor.ap = Number(actor.baseAp || (actor.team === "enemy" ? 2 : 3));
      scene.turnSerial = Number(scene.turnSerial || 0) + 1;
      if (hasEffect(scene, actor, "negative.ошеломлен")) {
        const before = Number(actor.ap || 0);
        actor.ap = Math.max(0, before - 1);
        payload.extraTurnStunnedApPenalty = before - actor.ap;
      }
      scene.activeActorId = actor.id;
      payload.startedExtraTurn = true;
    } else {
      if (actor.team === "enemy") actor.ap = 0;
      if (scene.activeActorId === actor.id) scene.activeActorId = null;
    }
  } else if (event.type === "round.end") {
    scene.round = Number(scene.round || 0) + 1;
    scene.tension = Number(scene.tension || 0) + 1;
    scene.activeActorId = null;
    payload.ruleResourceResets = [];
    payload.ruleClockResets = [];
    (scene.actors || []).forEach(item => {
      item.acted = item.kind === "crowd";
      item.ap = item.kind === "crowd" ? 0 : Number(item.baseAp || 3);
      item.usedActions = [];
      item.stepRemaining = 0;
      item.speedZeroUntilTurnEnd = false;
      resetRuleResources(item, "round").forEach(reset => payload.ruleResourceResets.push({ actorId: item.id, ...reset }));
      resetRuleClocks(item, "round").forEach(reset => payload.ruleClockResets.push({ actorId: item.id, ...reset }));
    });
  }
  scene.log ||= [];
  scene.log.unshift(event);
  scene.log = scene.log.slice(0, 200);
}

function dispatch(scene, event, options = {}) {
  const stored = event?.id ? (scene?.log || []).find(item => item.id === event.id) : null;
  if (stored) {
    const subsetMatches = (canonical, candidate) => {
      if (Array.isArray(candidate)) return Array.isArray(canonical) && canonical.length === candidate.length && candidate.every((value, index) => subsetMatches(canonical[index], value));
      if (candidate && typeof candidate === "object") return canonical && typeof canonical === "object" && !Array.isArray(canonical) && Object.keys(candidate).every(key => subsetMatches(canonical[key], candidate[key]));
      return Object.is(canonical, candidate);
    };
    const sameEvent = stored.type === event.type && (stored.actorId || null) === (event.actorId || null) && subsetMatches(stored.payload || {}, event.payload || {});
    if (!sameEvent) {
      const error = new Error(`Конфликт id события «${event.id}»: под этим id уже записано другое событие.`);
      error.code = "SCENE_EVENT_ID_CONFLICT";
      throw error;
    }
    return { scene: clone(scene), event: clone(stored), duplicate: true };
  }
  if (options.expectedVersion !== undefined && Number(scene?.version || 0) !== Number(options.expectedVersion)) {
    const error = new Error(`Конфликт версии Сцены: ожидалась ${options.expectedVersion}, получена ${Number(scene?.version || 0)}.`);
    error.code = "SCENE_VERSION_CONFLICT";
    throw error;
  }
  const normalized = normalizeEvent(event, options);
  validateEvent(scene, normalized, options);
  validateTransition(scene, normalized);
  const next = clone(scene);
  reduceEvent(next, normalized);
  next.version = Number(next.version || 0) + 1;
  return { scene: next, event: normalized };
}

function squareCells(scene, actor, center, radius = 1) {
  const space = (scene.spaces || []).find(item => item.id === actor?.space);
  const cells = [];
  if (!space) return cells;
  for (let y = center.y - radius; y <= center.y + radius; y += 1) for (let x = center.x - radius; x <= center.x + radius; x += 1) {
    if (x >= 0 && y >= 0 && x < space.width && y < space.height) cells.push(`${x},${y}`);
  }
  return cells;
}
