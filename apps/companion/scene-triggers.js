"use strict";

const WISP_TYPES = {
  dreamy: { label: "Мечтательный дух", effect: "negative.замедлен", audience: "enemies" },
  angry: { label: "Злой дух", effect: "negative.порчен", audience: "enemies" },
  insightful: { label: "Проницательный дух", effect: "negative.помечен", audience: "enemies" },
  bright: { label: "Яркий дух", effect: "positive.ускорен", audience: "allies" },
  kind: { label: "Добрый дух", effect: "positive.регенерирует", audience: "allies" },
  fierce: { label: "Яростный дух", effect: "positive.усилен", audience: "allies" },
};
const wispMarkers = (scene, ownerId) => (scene.markers || []).filter(marker => marker.ownerActorId === ownerId && /altruist\.will-o-wisp\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`));
// Old saved event logs may only contain the former Russian display name.
// Normalize that value once at the event boundary; trigger rules still compare stable IDs.
const eventActionId = payload => {
  const explicit = canonicalActionId(payload?.baseActionId || payload?.actionId);
  return Object.values(ACTION_IDS).includes(explicit) ? explicit : canonicalActionId(payload?.actionName || payload?.name || explicit);
};

function defineTriggerRule(definition = {}) {
  const id = String(definition.id || ""), eventTypes = [...new Set(definition.eventTypes || [])], priority = Number(definition.priority ?? 0);
  if (!/^[a-z][a-z0-9.-]{0,119}$/.test(id)) throw new Error(`Некорректный id декларативного триггера: «${id}».`);
  if (!eventTypes.length || eventTypes.length > 24 || eventTypes.some(type => !EVENT_TYPES.has(type) || type === "rule.trigger")) throw new Error(`Триггер «${id}» содержит неизвестные исходные события.`);
  if (!Number.isInteger(priority) || priority < -1000 || priority > 1000) throw new Error(`Триггер «${id}» содержит некорректный приоритет.`);
  if (typeof definition.match !== "function" || typeof definition.build !== "function") throw new Error(`Триггер «${id}» должен определить match и build.`);
  return Object.freeze({ id, eventTypes: Object.freeze(eventTypes), priority, match: definition.match, build: definition.build });
}

const TRIGGER_RULES = [
  {
    id: "wolf.dark-urge.redirect",
    eventTypes: ["roll.public"],
    priority: 90,
    match: ({ scene, actor, payload }) => {
      const selected = payload.dice?.selectedHookIds || [];
      if (!actor || !(actor.gifts || []).includes("wolf.dark-urge") || payload.dice?.scope !== "challenge" || !payload.dice?.usesAbility || !selected.includes("wolf.dark-urge") || Number(payload.successes || 0) % 2 !== 1) return false;
      const original = new Set(payload.dice?.targetIds || []);
      return (scene.actors || []).some(target => target.id !== actor.id && target.space === actor.space && !target.knockedOut && effectPresenceStatus(scene, target.id).available && !original.has(target.id));
    },
    build: ({ scene, event, actor, payload }) => {
      const original = new Set(payload.dice?.targetIds || []), targets = (scene.actors || []).filter(target => target.id !== actor.id && target.space === actor.space && !target.knockedOut && effectPresenceStatus(scene, target.id).available && !original.has(target.id));
      const options = ["pass", ...targets.map(target => `target:${target.id}`)], optionLabels = Object.fromEntries(targets.map(target => [`target:${target.id}`, `Перенаправить на ${target.name}`]));
      return [{ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-dark-urge`, kind: "dark-urge-narrator", sourceActorId: actor.id, controller: "narrator", title: "Тёмный порыв", text: `${actor.name}: нечётное число Успехов (${payload.successes}). Нарратор может заменить исходную цель, сохранив этот результат броска.`, options, context: { sourceRollId: event.id, originalTargetIds: [...original], optionLabels }, participantIds: [actor.id, ...targets.map(target => target.id)] } }];
    },
  },
  {
    id: "disruptor.siren.1.study",
    eventTypes: ["action.resolve"],
    priority: 60,
    match: ({ scene, actor, payload }) => actor && actionIdIs(eventActionId(payload), "study") && Number(actor.techniques?.["disruptor.siren"] || 0) >= 1 && usageLimitStatus(scene, actor.id, { ruleId: "disruptor.siren.1", scope: "scene", maximum: 3 }).available,
    build: ({ scene, event, actor, payload }) => {
      const limit = usageLimitStatus(scene, actor.id, { ruleId: "disruptor.siren.1", scope: "scene", maximum: 3 }), target = actorById(scene, payload.targetIds?.[0]);
      if (!target || target.knockedOut || target.team === actor.team) return [];
      return [{ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-siren-study`, kind: "siren-study-frighten", sourceActorId: actor.id, targetId: target.id, title: "Ты ведь не причинишь МНЕ боль?", text: `Наложить Испуган на ${target.name}? Осталось применений в Сцене: ${limit.remaining}.`, options: ["frighten", "pass"], participantIds: [actor.id, target.id] } }];
    },
  },
  {
    id: "powerhouse.duelist.2.block",
    eventTypes: ["reaction.respond"],
    priority: 80,
    match: ({ actor, payload }) => actor && actionIdIs(payload.choice, "block") && Number(actor.techniques?.["powerhouse.duelist"] || 0) >= 2,
    build: ({ scene, actor }) => {
      const source = actorById(scene, scene.pendingAction?.actorId), blockMove = (scene.log || []).find(item => item.type === "actor.move" && item.actorId === actor.id && item.payload?.displacement?.ruleId === "action.block"), blockOrigin = blockMove?.payload?.from || actor;
      return source && !source.knockedOut && distance(blockOrigin, source) <= 1
        ? [{ type: "effect.apply", actorId: actor.id, payload: { targetId: source.id, effect: "negative.ошеломлен", sourceActionId: "powerhouse.duelist.2", participantIds: [actor.id, source.id] } }]
        : [];
    },
  },
  {
    id: "vagabond.untouchable.2.weave",
    eventTypes: ["damage.apply"],
    priority: 70,
    match: ({ scene, payload }) => {
      const target = actorById(scene, payload.targetId);
      return Number(payload.dealt || 0) === 0 && payload.dodgeEvasion === true && target && !target.knockedOut && Number(target.techniques?.["vagabond.untouchable"] || 0) >= 2;
    },
    build: ({ scene, event, payload }) => {
      const target = actorById(scene, payload.targetId);
      return [{ type: "rule.prompt", actorId: target.id, payload: { id: `prompt-${event.id}-untouchable-weave`, kind: "untouchable-weave", sourceActorId: target.id, title: "Маятник", text: "Уклонение снизило урон до 0. Переместиться ещё раз, как при Увороте?", options: ["rush", "pass"], context: { maxDistance: 3 }, participantIds: [target.id, event.actorId].filter(Boolean) } }];
    },
  },
  {
    id: "disruptor.siren.2.frightened",
    eventTypes: ["effect.apply"],
    priority: 65,
    match: ({ scene, actor, payload }) => actor && payload.applied && payload.effect === "negative.испуган" && Number(actor.techniques?.["disruptor.siren"] || 0) >= 2 && !currentTurnEvents(scene, actor.id).some(item => item.type === "technique.resolve" && item.payload?.ruleId === "disruptor.siren.2"),
    build: ({ scene, event, actor, payload }) => {
      const target = actorById(scene, payload.targetId);
      if (!target || target.knockedOut || target.id === actor.id || target.space !== actor.space) return [];
      return [{ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-siren-irresistible`, kind: "siren-irresistible", sourceActorId: actor.id, targetId: target.id, title: "Неотразимая", text: `Заставить ${target.name} переместиться на расстояние до 3 клеток к вам? Если цель окажется смежной, можно наложить Ошеломлен.`, options: ["rush", "pass"], participantIds: [actor.id, target.id] } }];
    },
  },
  {
    id: "vagabond.dim-mak.1.study",
    eventTypes: ["action.resolve"],
    priority: 58,
    match: ({ actor, payload }) => actor && actionIdIs(eventActionId(payload), "study") && Number(actor.techniques?.["vagabond.dim-mak"] || 0) >= 1,
    build: ({ scene, event, actor, payload }) => {
      const target = actorById(scene, payload.targetIds?.[0]);
      if (!target || target.knockedOut || target.team === actor.team || target.space !== actor.space) return [];
      return [{ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-dim-mak`, kind: "dim-mak-weak-point", sourceActorId: actor.id, targetId: target.id, title: "Изучение слабости", text: `Поставить Слабую точку в свободной клетке, смежной с ${target.name}?`, options: ["place", "pass"], participantIds: [actor.id, target.id] } }];
    },
  },
  {
    id: "vagabond.dim-mak.2.miss",
    eventTypes: ["damage.apply"],
    priority: 68,
    match: ({ scene, event, payload }) => {
      const target = actorById(scene, payload.targetId), attacker = actorById(scene, event.actorId);
      return Number(payload.dealt || 0) === 0 && target && attacker && target.id !== attacker.id && target.team !== attacker.team && !target.knockedOut && !attacker.knockedOut && Number(target.techniques?.["vagabond.dim-mak"] || 0) >= 2 && scene.pendingAction?.actorId === attacker.id;
    },
    build: ({ scene, event, payload }) => {
      const target = actorById(scene, payload.targetId), attacker = actorById(scene, event.actorId);
      return [{ type: "rule.prompt", actorId: target.id, payload: { id: `prompt-${event.id}-dim-mak-investigation`, kind: "dim-mak-field-investigation", sourceActorId: target.id, targetId: attacker.id, title: "Полевое исследование", text: `Атака ${attacker.name} не попала. Бесплатно и Быстро Изучить атакующего?`, options: ["study", "pass"], participantIds: [target.id, attacker.id] } }];
    },
  },
  {
    id: "vagabond.dim-mak.2.evasion",
    eventTypes: ["marker.remove"],
    priority: 55,
    match: ({ actor, payload }) => actor && payload.ruleId === "vagabond.dim-mak.1" && Number(actor.techniques?.["vagabond.dim-mak"] || 0) >= 2,
    build: ({ actor, payload }) => [{ type: "actor.state", actorId: actor.id, payload: { key: "evasion", delta: 2, sourceActionId: "vagabond.dim-mak.2", reason: "Снята Слабая точка", participantIds: [actor.id, payload.carrierActorId].filter(Boolean) } }],
  },
  {
    id: "powerhouse.braggart.3.wound",
    eventTypes: ["damage.apply"],
    priority: 60,
    match: ({ scene, payload }) => {
      const target = actorById(scene, payload.targetId);
      return Boolean(payload.woundGained) && target && Number(target.techniques?.["powerhouse.braggart"] || 0) >= 3;
    },
    build: ({ scene, event, payload }) => {
      const target = actorById(scene, payload.targetId);
      return [{ type: "rule.prompt", actorId: target.id, payload: { id: `prompt-${event.id}-pride-wound`, kind: "braggart-wound-pride", sourceActorId: target.id, title: "Достойный противник", text: "Заполнить сегмент Гордости за полученную Рану?", options: ["fill", "pass"], participantIds: [target.id, event.actorId].filter(Boolean) } }];
    },
  },
  {
    id: "altruist.empath.2.protective-response",
    eventTypes: ["effect.apply", "damage.apply"],
    priority: 50,
    match: ({ event, payload }) => event.type === "effect.apply" ? Boolean(payload.applied) && event.actorId !== payload.targetId : Boolean(payload.woundGained),
    build: ({ scene, event, payload }) => {
      const target = actorById(scene, payload.targetId);
      const empath = (scene.actors || []).find(owner => target && !owner.knockedOut && owner.team === target.team && owner.id !== target.id && Number(owner.techniques?.["altruist.empath"] || 0) >= 2 && distance(owner, target) <= Number(owner.attrs?.talent || 0));
      return empath ? [{ type: "rule.prompt", actorId: empath.id, payload: { id: `prompt-${event.id}-empath-rush`, kind: "empath-rush", sourceActorId: empath.id, targetId: target.id, title: "Защитный отклик", text: `Переместиться смежно с ${target.name} бесплатным Прорывом?`, options: ["rush", "pass"], context: { targetId: target.id }, participantIds: [empath.id, target.id] } }] : [];
    },
  },
  {
    id: "core.disappeared.reappear",
    eventTypes: ["turn.start"],
    priority: 100,
    match: ({ scene, event }) => hasEffect(scene, actorById(scene, event.actorId), "positive.исчез"),
    build: ({ event }) => [{ type: "rule.prompt", actorId: event.actorId, payload: { id: `prompt-${event.id}-reappear`, kind: "reappear-cell", sourceActorId: event.actorId, title: "Возвращение на поле", text: "Выберите свободную клетку, не смежную с персонажами.", options: ["cancel"], context: { actorId: event.actorId }, participantIds: [event.actorId] } }],
  },
  {
    id: "core.invisible.on-loss",
    eventTypes: ["effect.remove"],
    priority: 80,
    match: ({ scene, payload }) => payload.removed && payload.effect === "positive.невидим" && !payload.suppressInvisibleReaction && !actorById(scene, payload.targetId)?.knockedOut,
    build: ({ scene, event, payload }) => {
      const target = actorById(scene, payload.targetId);
      return target ? [{ type: "rule.prompt", actorId: target.id, payload: { id: `prompt-${event.id}-invisible`, kind: "invisible-on-loss", sourceActorId: target.id, targetId: target.id, title: "Невидим", text: "Исчезнуть Реакцией на потерю Невидимости?", options: ["disappear", "pass"], participantIds: [target.id] } }] : [];
    },
  },
  {
    id: "altruist.chronomancer.2.effect-loss",
    eventTypes: ["effect.remove"],
    priority: 50,
    match: ({ scene, payload }) => payload.removed && (scene.actors || []).some(owner => !owner.knockedOut && Number(owner.techniques?.["altruist.chronomancer"] || 0) >= 2 && resourceOperationStatus(scene, owner.id, { resource: "focus", amount: 1, operation: "spend" }).available),
    build: ({ scene, event, payload }) => {
      const owner = (scene.actors || []).find(candidate => !candidate.knockedOut && Number(candidate.techniques?.["altruist.chronomancer"] || 0) >= 2 && resourceOperationStatus(scene, candidate.id, { resource: "focus", amount: 1, operation: "spend" }).available);
      const target = actorById(scene, payload.targetId);
      if (!owner || !target || target.knockedOut) return [];
      return [{ type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${event.id}-chronomancer`, kind: "chronomancer-reapply-effect", sourceActorId: owner.id, targetId: target.id, title: "Замедление", text: `Потратить 1 Фокус и снова применить снятый Эффект к ${target.name}?`, options: ["reapply", "pass"], context: { effect: payload.effect, duration: payload.previousState?.duration || effectLifecycleDefinition(payload.effect).duration, removable: payload.previousState?.removable !== false }, participantIds: [owner.id, target.id] } }];
    },
  },
].map(defineTriggerRule);

function triggerRegistryStatus() {
  const rules = TRIGGER_RULES.map(rule => ({ id: rule.id, eventTypes: [...rule.eventTypes], priority: rule.priority }));
  const eventTypes = [...new Set(rules.flatMap(rule => rule.eventTypes))].sort();
  return { available: true, count: rules.length, eventTypes, rules };
}

function caughtFollowEvent(scene, source, target, boundaryEvent, movement) {
  if (!source || !target || source.id === target.id || source.space !== target.space || distance(source, target) <= 1) return null;
  const space = (scene.spaces || []).find(item => item.id === source.space), removed = removedCellKeys(scene, source.space);
  if (!space) return null;
  const candidates = [{ x: source.x + 1, y: source.y }, { x: source.x - 1, y: source.y }, { x: source.x, y: source.y + 1 }, { x: source.x, y: source.y - 1 }]
    .filter(point => point.x >= 0 && point.y >= 0 && point.x < space.width && point.y < space.height && !removed.has(cellKey(point)))
    .filter(point => !(scene.objects || []).some(object => object.space === source.space && object.type === "terrain" && (object.cells || []).includes(cellKey(point))))
    .filter(point => effectCellOccupancyStatus(scene, target.id, { space: source.space, x: point.x, y: point.y }).available)
    .map(point => ({ point, path: movementPath(scene, target.id, point, { forced: true, maxDistance: 144 }) }))
    .filter(candidate => candidate.path.length)
    .sort((left, right) => left.path.length - right.path.length);
  const chosen = candidates[0];
  if (!chosen) return null;
  return {
    type: "actor.move",
    actorId: target.id,
    payload: {
      space: target.space,
      x: chosen.point.x,
      y: chosen.point.y,
      movement,
      forced: true,
      path: chosen.path.map(cellKey),
      topologyCrossings: chosen.path.filter(point => point.teleported).map(point => ({ destination: cellKey(point), cutIds: point.crossedCutIds || [] })),
      sourceActionId: "negative.пойман",
      boundaryEventId: boundaryEvent.id,
      participantIds: [source.id, target.id],
    },
  };
}

function triggerQueueStatus(scene) {
  const queued = (scene?.triggerQueue || []).map((item, index) => {
    const deferred = item.event, payload = deferred?.payload || {}, source = actorById(scene, payload.sourceActorId || deferred?.actorId), target = payload.targetId ? actorById(scene, payload.targetId) : null;
    const reason = !source || source.knockedOut ? "Источник отложенного триггера больше недоступен." : payload.targetId && (!target || target.knockedOut) ? "Цель отложенного триггера больше недоступна." : "";
    return {
      index,
      key: item.key,
      triggerId: item.triggerId,
      sourceEventId: item.sourceEventId,
      priority: Number(item.priority || 0),
      ownerId: item.ownerId,
      kind: payload.kind || "",
      title: payload.title || "Решение правила",
      sourceActorId: source?.id || payload.sourceActorId || deferred?.actorId || null,
      targetId: target?.id || payload.targetId || null,
      available: !reason,
      reason,
      event: clone(deferred),
    };
  });
  return { available: queued.length > 0, count: queued.length, pending: scene?.pendingPrompt ? clone(scene.pendingPrompt) : null, next: queued[0] || null, queued };
}

function triggerAuditEvent(event, proposal, status, reason = "") {
  const emittedTypes = proposal.events.map(item => item.type);
  const audit = {
    id: `trigger-${event.id}-${proposal.rule.id}-${status}`,
    type: "rule.trigger",
    actorId: proposal.ownerId,
    payload: {
      triggerId: proposal.rule.id,
      sourceEventId: event.id,
      sourceEventType: event.type,
      status,
      reason,
      priority: proposal.rule.priority,
      emittedTypes,
      triggerOwnerId: proposal.ownerId,
      participantIds: proposal.participantIds,
    },
  };
  if (status === "queued") audit.payload.deferredEvent = clone(proposal.events.find(item => item.type === "rule.prompt"));
  return audit;
}

function triggerRouteStatus(scene, event, options = {}) {
  if (!event?.id || event.type === "rule.trigger") return { available: true, sourceEventId: event?.id || "", proposals: [], selected: [], queued: [], events: [] };
  const payload = event.payload || {}, actor = event.actorId ? actorById(scene, event.actorId) : null, context = { scene, event, payload, actor };
  const proposals = TRIGGER_RULES
    .map((rule, order) => ({ rule, order }))
    .filter(({ rule }) => rule.eventTypes.includes(event.type) && rule.match(context))
    .map(({ rule, order }) => {
      const events = rule.build(context) || [], prompt = events.some(item => item.type === "rule.prompt"), participants = eventParticipants(scene, { actorId: events[0]?.actorId || event.actorId, payload: { participantIds: events.flatMap(item => eventParticipants(scene, item).actorIds) } });
      return { rule, order, events, prompt, ownerId: events[0]?.actorId || event.actorId || null, participantIds: participants.actorIds };
    })
    .filter(proposal => proposal.events.length)
    .sort((left, right) => Number(right.rule.priority || 0) - Number(left.rule.priority || 0) || left.order - right.order);
  const automatic = proposals.filter(proposal => !proposal.prompt), prompts = proposals.filter(proposal => proposal.prompt);
  const selectedPrompt = scene.pendingPrompt || options.promptReserved ? null : prompts[0] || null;
  const selected = [...automatic, ...(selectedPrompt ? [selectedPrompt] : [])];
  const queued = prompts.filter(proposal => proposal !== selectedPrompt).map(proposal => ({
    ...proposal,
    reason: scene.pendingPrompt || options.promptReserved ? "Запрос ждёт завершения уже открытого решения." : `Запрос поставлен после триггера «${selectedPrompt.rule.id}» с более высоким приоритетом.`,
  }));
  const events = [];
  selected.forEach(proposal => events.push(triggerAuditEvent(event, proposal, "fired"), ...proposal.events));
  queued.forEach(proposal => events.push(triggerAuditEvent(event, proposal, "queued", proposal.reason)));
  const describe = proposal => ({
    triggerId: proposal.rule.id,
    priority: Number(proposal.rule.priority || 0),
    prompt: proposal.prompt,
    ownerId: proposal.ownerId,
    participantIds: clone(proposal.participantIds),
    emittedTypes: proposal.events.map(item => item.type),
    events: clone(proposal.events),
    reason: proposal.reason || "",
  });
  return { available: true, sourceEventId: event.id, proposals: proposals.map(describe), selected: selected.map(describe), queued: queued.map(describe), events };
}

function resumeQueuedTriggers(scene, event) {
  const status = triggerQueueStatus(scene);
  if (scene.pendingPrompt || !status.available) return { events: [], promptReserved: false };
  const events = [];
  for (const queuedStatus of status.queued) {
    const queued = (scene.triggerQueue || []).find(item => item.key === queuedStatus.key), deferred = queued.event, reason = queuedStatus.reason;
    const audit = {
      id: `trigger-resume-${event.id}-${queued.triggerId}-${reason ? "cancelled" : "fired"}`,
      type: "rule.trigger",
      actorId: queued.ownerId,
      payload: {
        triggerId: queued.triggerId,
        sourceEventId: queued.sourceEventId,
        sourceEventType: "queued",
        status: reason ? "cancelled" : "fired",
        reason,
        priority: queued.priority,
        emittedTypes: reason ? [] : ["rule.prompt"],
        triggerOwnerId: queued.ownerId,
        participantIds: deferred?.payload?.participantIds || [],
        queued: true,
      },
    };
    events.push(audit);
    if (!reason) {
      events.push(clone(deferred));
      return { events, promptReserved: true };
    }
  }
  return { events, promptReserved: false };
}

function effectRetainedAtBoundary(scene, target, effect, event) {
  if (event.type === "turn.end" && effect === "negative.помечен") {
    const reaper = (scene.actors || []).find(owner => !owner.knockedOut && owner.team !== target.team && owner.space === target.space && Number(owner.techniques?.["disruptor.reaper"] || 0) >= 2 && distance(owner, target) <= 3);
    if (reaper) return { retained: true, reason: `«Уход» сохраняет Помечен рядом с ${reaper.name}.`, ruleId: "disruptor.reaper.2" };
  }
  if (event.type === "turn.start" && effect === "positive.изгнан") {
    const state = effectStateFor(target, effect);
    const owner = state?.sources.map(source => actorById(scene, source.actorId)).find(source => source && !source.knockedOut && Number(source.techniques?.["disruptor.mind-breaker"] || 0) >= 3);
    if (owner) {
      const banishedByOwner = (scene.actors || []).filter(candidate => effectStateFor(candidate, effect)?.sources.some(source => source.actorId === owner.id));
      if (banishedByOwner.length === 1) return { retained: true, reason: `«Кто они?» сохраняет единственного Изгнанного персонажа.`, ruleId: "disruptor.mind-breaker.3" };
    }
  }
  return { retained: false, reason: "", ruleId: "" };
}

function effectLifecycleEvents(scene, event) {
  const events = [], boundaryActorId = event.actorId || null;
  if (["turn.start", "turn.end", "round.end", "action.prepare", "enemy.action.prepare"].includes(event.type)) {
    for (const target of scene.actors || []) for (const effect of target.effects || []) {
      const expiry = effectExpiryStatus(scene, target.id, effect, { type: event.type, actorId: boundaryActorId, turnSerial: event.payload?.endedTurnSerial });
      if (!expiry.expires) continue;
      if (event.type === "turn.start" && effect === "positive.исчез") continue;
      const retention = effectRetainedAtBoundary(scene, target, effect, event);
      if (retention.retained) continue;
      events.push({ type: "effect.remove", actorId: target.id, payload: { targetId: target.id, effect, automatic: true, reason: expiry.reason, boundaryEventId: event.id, participantIds: [target.id] } });
    }
  }
  if (event.type === "actor.knockout" && event.payload?.applied) {
    const sourceActorId = event.payload.targetId;
    for (const target of scene.actors || []) for (const effect of target.effects || []) {
      const state = effectStateFor(target, effect);
      if (state?.removeWithSource && state.sources.some(source => source.actorId === sourceActorId)) events.push({ type: "effect.remove", actorId: sourceActorId, payload: { targetId: target.id, effect, sourceOnly: true, sourceActorId, automatic: true, reason: "Источник Эффекта выведен из боя.", boundaryEventId: event.id, participantIds: [sourceActorId, target.id] } });
    }
  }
  if (event.type === "effect.apply" && event.payload?.applied && event.payload.effect === "positive.исчез") {
    const sourceActorId = event.payload.targetId;
    for (const target of scene.actors || []) {
      const state = effectStateFor(target, "negative.пойман");
      if (state?.sources.some(source => source.actorId === sourceActorId)) events.push({ type: "effect.remove", actorId: sourceActorId, payload: { targetId: target.id, effect: "negative.пойман", sourceOnly: true, sourceActorId, automatic: true, reason: "Источник Пойман больше не находится на поле.", boundaryEventId: event.id, participantIds: [sourceActorId, target.id] } });
    }
  }
  if (event.type === "effect.apply" && event.payload?.applied && event.payload.effect === "negative.пойман") {
    const source = actorById(scene, event.actorId), target = actorById(scene, event.payload.targetId), follow = caughtFollowEvent(scene, source, target, event, "Пойман · притягивание");
    if (follow) events.push(follow, { type: "actor.enter", actorId: target.id, payload: { space: follow.payload.space, x: follow.payload.x, y: follow.payload.y, movement: follow.payload.movement, forced: true, participantIds: [source.id, target.id] } });
  }
  if (event.type === "actor.move" && actorById(scene, event.actorId)) {
    const source = actorById(scene, event.actorId);
    const caughtTargets = (scene.actors || []).filter(target => effectStateFor(target, "negative.пойман")?.sources.some(item => item.actorId === source.id));
    if (Number(source.techniques?.["disruptor.constrictor"] || 0) >= 1 && caughtTargets.some(target => distance(source, target) > 1) && !scene.pendingPrompt) {
      const targetIds = caughtTargets.filter(target => distance(source, target) > 1).map(target => target.id);
      events.push({ type: "rule.prompt", actorId: source.id, payload: { id: `prompt-${event.id}-constrictor-follow`, kind: "constrictor-follow", sourceActorId: source.id, title: "Обвить · притягивание", text: "Притянуть Пойманных персонажей в смежность после своего перемещения?", options: ["pull", "pass"], context: { targetIds }, participantIds: [source.id, ...targetIds] } });
      return events;
    }
    for (const target of caughtTargets) {
      const state = effectStateFor(target, "negative.пойман");
      if (!state?.sources.some(item => item.actorId === source.id)) continue;
      const follow = caughtFollowEvent(scene, source, target, event, "Пойман · следует за источником");
      if (follow) events.push(follow, { type: "actor.enter", actorId: target.id, payload: { space: follow.payload.space, x: follow.payload.x, y: follow.payload.y, movement: follow.payload.movement, forced: true, participantIds: [source.id, target.id] } });
    }
  }
  if (event.type === "effect.apply" && event.payload?.applied && event.payload.effect === "positive.изгнан" && actorById(scene, event.actorId) && event.payload.exclusiveBySource !== false && Number(actorById(scene, event.actorId).techniques?.["disruptor.mind-breaker"] || 0) < 1) {
    for (const target of scene.actors || []) {
      if (target.id === event.payload.targetId) continue;
      const state = effectStateFor(target, event.payload.effect);
      if (state?.sources.some(source => source.actorId === event.actorId)) events.push({ type: "effect.remove", actorId: event.actorId, payload: { targetId: target.id, effect: event.payload.effect, sourceOnly: true, sourceActorId: event.actorId, automatic: true, reason: "Источник применил Изгнание к другому персонажу.", boundaryEventId: event.id, participantIds: [event.actorId, target.id] } });
    }
  }
  if (event.type === "damage.apply" && Number(event.payload?.dealt || 0) > 0) {
    const attacker = actorById(scene, event.actorId), target = actorById(scene, event.payload.targetId), state = effectStateFor(target, "positive.изгнан");
    if (attacker?.team === "hero" && !hasEffect(scene, attacker, "positive.изгнан") && state) for (const source of state.sources) {
      const owner = actorById(scene, source.actorId);
      if (Number(owner?.techniques?.["disruptor.mind-breaker"] || 0) >= 1) events.push({ type: "effect.remove", actorId: owner.id, payload: { targetId: target.id, effect: "positive.изгнан", sourceOnly: true, sourceActorId: owner.id, automatic: true, reason: "Неизгнанный персонаж игрока нанёс урон.", boundaryEventId: event.id, participantIds: [attacker.id, owner.id, target.id] } });
    }
  }
  return events;
}

function entityLifecycleEvents(scene, event) {
  const events = [], actorId = event.actorId || null;
  const areaDue = object => event.type === "area.create" && object.id === event.payload?.id && object.duration === "instant"
    || event.type === "turn.start" && object.duration === "nextTurn" && object.ownerActorId === actorId
    || event.type === "turn.end" && object.duration === "endTurn" && object.ownerActorId === actorId
    || event.type === "round.end" && object.duration === "round";
  const markerDue = marker => event.type === "turn.start" && marker.duration === "nextTurn" && marker.ownerActorId === actorId
    || event.type === "turn.end" && marker.duration === "endTurn" && marker.ownerActorId === actorId
    || event.type === "round.end" && marker.duration === "round";
  const reason = event.type === "area.create" ? "Мгновенная область разрешена." : event.type === "turn.start" ? "Начался следующий Ход владельца." : event.type === "turn.end" ? "Завершился Ход владельца." : "Завершился Раунд.";
  for (const object of (scene.objects || []).filter(areaDue)) events.push({ type: "area.remove", actorId: object.ownerActorId || actorId, payload: { id: object.id, automatic: true, reason, boundaryEventId: event.id, participantIds: object.ownerActorId ? [object.ownerActorId] : [] } });
  for (const marker of (scene.markers || []).filter(markerDue)) events.push({ type: "marker.remove", actorId: marker.ownerActorId || actorId, payload: { markerId: marker.id, automatic: true, reason, boundaryEventId: event.id, participantIds: marker.ownerActorId ? [marker.ownerActorId] : [] } });
  return events;
}

function reminderLifecycleEvents(scene, event) {
  const events = [];
  for (const reminder of scene.reminders || []) {
    if (reminder.due) continue;
    const ownerMatches = reminder.ownerActorId === event.actorId;
    const due = reminder.boundary === "turnStart" && event.type === "turn.start" && ownerMatches && Number(reminder.createdTurnSerial || 0) < Number(scene.turnSerial || 0)
      || reminder.boundary === "turnEnd" && event.type === "turn.end" && ownerMatches && Number(reminder.createdTurnSerial || 0) <= Number(event.payload?.endedTurnSerial || 0)
      || reminder.boundary === "roundEnd" && event.type === "round.end" && Number(reminder.createdRound || 1) < Number(scene.round || 1);
    if (due) events.push({ type: "reminder.due", actorId: reminder.ownerActorId || event.actorId, payload: { id: reminder.id, boundaryEventId: event.id, participantIds: reminder.ownerActorId ? [reminder.ownerActorId] : [] } });
  }
  return events;
}

function triggeredEvents(scene, event, options = {}) {
  const payload = event.payload || {}, actor = event.actorId ? actorById(scene, event.actorId) : null, resumesQueue = event.type === "attack.clear" || event.type === "rule.respond" && !options.deferQueuedResume, resumed = resumesQueue ? resumeQueuedTriggers(scene, event) : { events: [], promptReserved: false }, routed = triggerRouteStatus(scene, event, { promptReserved: resumed.promptReserved }), events = [...resumed.events, ...routed.events], promptQueued = () => events.some(item => item.type === "rule.prompt");
  if (event.type === "actor.knockout" && payload.applied && scene.pendingActionPlan?.actorId === payload.targetId) {
    events.push({ type: "action.plan.cancel", actorId: payload.targetId, payload: { planId: scene.pendingActionPlan.id, reason: "Исполнитель выведен из боя.", participantIds: [payload.targetId] } });
  }
  if (event.type === "turn.end" && !scene.pendingPrompt && !promptQueued()) {
    const delayed = (scene.actors || []).find(item => !item.knockedOut && (Number(item.ruleState?.executionerBifurcate?.dueTurnSerial || Infinity) <= Number(scene.turnSerial || 0) || Number(item.ruleState?.revenantHollowedEyes?.dueTurnSerial || Infinity) <= Number(scene.turnSerial || 0)));
    const state = delayed?.ruleState?.executionerBifurcate || delayed?.ruleState?.revenantHollowedEyes, target = actorById(scene, state?.targetId);
    if (delayed && target && !target.knockedOut) {
      const executioner = Boolean(delayed.ruleState?.executionerBifurcate);
      events.push({ type: "rule.prompt", actorId: delayed.id, payload: { id: `prompt-${event.id}-${executioner ? "bifurcate" : "hollowed"}`, kind: executioner ? "enemy-executioner-bifurcate" : "enemy-revenant-hollowed", sourceActorId: delayed.id, targetId: target.id, controller: "narrator", title: executioner ? "Рассечение" : "Пустые глаза", text: executioner ? "Отложенное Рассечение готово: переместить Палача и провести Разруб?" : "Пустые глаза готовы: телепортировать Ревенанта и вырвать душу?", options: ["resolve", "pass"], context: { ruleId: executioner ? "enemy.common.executioner.attack.cleave" : "enemy.common.revenant.attack.tear-from-the-soul" }, participantIds: [delayed.id, target.id] } });
    } else if (delayed) events.push({ type: "actor.state", actorId: delayed.id, payload: { key: delayed.ruleState?.executionerBifurcate ? "executionerBifurcate" : "revenantHollowedEyes", value: null, sourceActionId: "delayed-target-unavailable" } });
  }
  if (event.type === "round.end") {
    for (const revenant of (scene.actors || []).filter(item => item.knockedOut && item.profileId === "enemy.common.revenant")) {
      const space = (scene.spaces || []).find(item => item.id === revenant.space), occupied = new Set((scene.actors || []).filter(item => !item.knockedOut && item.space === revenant.space).map(cellKey)); let destination = null;
      for (let y = 0; y < Number(space?.height || 0) && !destination; y += 1) for (let x = 0; x < Number(space?.width || 0); x += 1) if (!occupied.has(`${x},${y}`) && !removedCellKeys(scene, revenant.space).has(`${x},${y}`) && effectCellOccupancyStatus(scene, revenant.id, { actor: revenant, space: revenant.space, x, y }).available) { destination = { x, y }; break; }
      if (destination) {
        events.push({ type: "actor.move", actorId: revenant.id, payload: { space: revenant.space, ...destination, placement: true, allowKnockedOut: true, movement: "Возвращение Ревенанта", participantIds: [revenant.id] } });
        events.push({ type: "actor.knockout", actorId: revenant.id, payload: { targetId: revenant.id, restore: true, amount: Number(revenant.maxHp || 1), sourceActionId: "enemy.common.revenant.passive.return", participantIds: [revenant.id] } });
      }
    }
  }
  if (["actor.knockout", "damage.apply"].includes(event.type) && actorById(scene, payload.targetId)?.knockedOut && scene.pendingAction?.targetIds?.includes(payload.targetId) && scene.pendingAction?.punishmentStop) {
    const target = actorById(scene, payload.targetId), stop = scene.pendingAction.punishmentStop;
    if (target && (target.space !== stop.space || target.x !== stop.x || target.y !== stop.y)) events.push({ type: "actor.move", actorId: target.id, payload: { space: stop.space || target.space, x: Number(stop.x), y: Number(stop.y), movement: "Наказание: движение прервано", placement: true, allowKnockedOut: true, participantIds: [event.actorId, target.id].filter(Boolean) } });
  }
  if (event.type === "attack.pending" && actor && Array.isArray(payload.attackModifierIds) && payload.attackModifierIds.length) {
    const modifiers = attackModifierStatus(scene, actor.id, payload.targetIds, payload.attackModifierIds, { actionId: payload.declaredActionId || payload.actionId });
    for (const option of modifiers.options.filter(item => modifiers.selectedIds.includes(item.id))) {
      if (option.removeMarkerId) events.push({ type: "marker.remove", actorId: actor.id, payload: { markerId: option.removeMarkerId, ruleId: option.ruleId, carrierActorId: option.targetId, sourceActionId: option.id, reason: option.label, participantIds: [actor.id, option.targetId] } });
      else if (option.removeEffect) events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: option.targetId, effect: option.removeEffect, sourceActionId: option.id, reason: option.label, participantIds: [actor.id, option.targetId] } });
    }
  }
  if (event.type === "actor.move" && actor && payload.from) {
    const weakPoints = (scene.markers || []).filter(marker => marker.ruleId === "vagabond.dim-mak.1" && marker.metadata?.carrierActorId === actor.id);
    const space = (scene.spaces || []).find(item => item.id === actor.space), occupied = new Set((scene.actors || []).filter(item => !item.knockedOut && item.space === actor.space).map(item => `${item.x},${item.y}`));
    for (const marker of weakPoints) {
      const offset = marker.metadata?.offset || { dx: Number(marker.x) - Number(payload.from.x), dy: Number(marker.y) - Number(payload.from.y) };
      const preferred = { x: Number(actor.x) + Number(offset.dx || 0), y: Number(actor.y) + Number(offset.dy || 0) };
      const candidates = [preferred, { x: actor.x + 1, y: actor.y }, { x: actor.x - 1, y: actor.y }, { x: actor.x, y: actor.y + 1 }, { x: actor.x, y: actor.y - 1 }]
        .filter((point, index, list) => list.findIndex(other => other.x === point.x && other.y === point.y) === index)
        .filter(point => space && point.x >= 0 && point.y >= 0 && point.x < space.width && point.y < space.height && !removedCellKeys(scene, actor.space).has(cellKey(point)));
      const destination = candidates.find(point => !occupied.has(cellKey(point)));
      if (destination && (marker.space !== actor.space || marker.x !== destination.x || marker.y !== destination.y)) events.push({ type: "marker.move", actorId: marker.ownerActorId, payload: { markerId: marker.id, space: actor.space, x: destination.x, y: destination.y, carrierActorId: actor.id, offset: { dx: destination.x - actor.x, dy: destination.y - actor.y }, movement: `Слабая точка следует за ${actor.name}`, sourceActionId: "vagabond.dim-mak.1", participantIds: [marker.ownerActorId, actor.id] } });
    }
  }
  if (actor && payload.resolvedResource === "health" && Number(payload.resolvedDelta || 0) !== 0) {
    if (Number(payload.resolvedDelta) < 0) events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: actor.id, amount: Math.abs(Number(payload.resolvedDelta)), ignoreArmor: true, sourceActionId: payload.sourceActionId || "disruptor.autophage.1", resourcePayment: true, participantIds: [actor.id] } });
    else events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: actor.id, amount: Number(payload.resolvedDelta), sourceActionId: payload.sourceActionId || "disruptor.autophage.1", resourcePayment: true, participantIds: [actor.id] } });
  }
  if (actor && (payload.resolvedResource === "heat" || ["rule-resource.gain", "rule-resource.set"].includes(event.type) && payload.resource === "heat")) {
    const heat = ruleResourceStatus(scene, actor.id, { resource: "heat", amount: 0 }).balance;
    if (heat >= 6) {
      const targets = (scene.actors || []).filter(target => !target.knockedOut && (target.id === actor.id || target.team !== actor.team && distance(actor, target) <= 1));
      if (Number(actor.techniques?.["vagabond.modified-meister"] || 0) >= 3 && Number(actor.ruleState?.modifiedOverclockTurns || 0) > 0 && !scene.pendingPrompt) {
        events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-meister-explosion`, kind: "meister-explosion", sourceActorId: actor.id, title: "Разгон: контролируемый взрыв", text: "Разрешить обычный взрыв или получить половину Разума урона, 1 ОД и переместиться до 3 клеток?", options: ["normal", "overclock"], context: { targetIds: targets.map(target => target.id) }, participantIds: targets.map(target => target.id) } });
      } else {
        events.push({ type: "rule-resource.set", actorId: actor.id, payload: { resource: "heat", value: 3, sourceActionId: "vagabond.modified-meister.1", reason: "Взрыв Нагрева", participantIds: targets.map(target => target.id) } });
        targets.forEach(target => events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount: Number(actor.attrs?.mind || 0), sourceActionId: "vagabond.modified-meister.1", participantIds: [actor.id, target.id] } }));
      }
    }
  }
  if (event.type === "reaction.offer" && actor && Number(actor.techniques?.["bulwark.mundane"] || 0) >= 2) events.push({ type: "rule-resource.gain", actorId: actor.id, payload: { resource: "grit", amount: 1, sourceActionId: "bulwark.mundane.2" } });
  if (event.type === "technique.state" && payload.key === "study" && payload.newTarget && actor && Number(actor.techniques?.["vagabond.cunning-fighter"] || 0) >= 1) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "vagabond.cunning-fighter.plan", delta: 1, sourceActionId: "vagabond.cunning-fighter.1.study", reason: "Новая цель Изучения" } });
  if (event.type === "action.resolve" && actor && Number(actor.techniques?.["powerhouse.braggart"] || 0) >= 1 && ["skirmish", "spell", "finish"].some(key => actionIdIs(eventActionId(payload), key))) {
    const attribute = payload.attribute, lowest = Object.entries(actor.attrs || {}).sort((left, right) => Number(left[1]) - Number(right[1])).slice(0, 2).map(([key]) => key);
    if (lowest.includes(attribute)) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "powerhouse.braggart.pride", delta: 1, sourceActionId: "powerhouse.braggart.1", reason: `Атака низким Атрибутом: ${attribute}` } });
  }
  if (event.type === "damage.apply" && Number(payload.dealt || 0) > 0) {
    const target = actorById(scene, payload.targetId), response = scene.pendingAction?.responses?.[payload.targetId]?.choice, source = actorById(scene, event.actorId);
    if (target && source?.team !== target.team && response === "pass" && Number(target.techniques?.["powerhouse.braggart"] || 0) >= 1) events.push({ type: "rule-clock.tick", actorId: target.id, payload: { clockId: "powerhouse.braggart.pride", delta: 1, sourceActionId: "powerhouse.braggart.1", reason: "Попадание без защитной Реакции", participantIds: [source.id, target.id] } });
  }
  if (event.type === "action.resolve" && actor && Number(actor.techniques?.["vagabond.egomaniac"] || 0) >= 1 && clockStatus(scene, actor.id, "vagabond.egomaniac.style").active && ["skirmish", "spell", "finish"].some(key => actionIdIs(eventActionId(payload), key))) {
    const targets = [...new Set(payload.targetIds || [])].map(id => actorById(scene, id)).filter(Boolean), priorResolve = (scene.log || []).find(logged => logged.id !== event.id && logged.type === "action.resolve" && logged.actorId === actor.id);
    const priorMove = (scene.log || []).find(logged => logged.type === "actor.move" && logged.actorId === actor.id);
    const drama = Number(payload.roll?.crits || 0) >= 2;
    const dance = Boolean(targets.length && priorMove && (!priorResolve || (scene.log || []).indexOf(priorMove) < (scene.log || []).indexOf(priorResolve)) && targets.some(target => distance(actor, target) <= 1));
    const finale = Number(actor.ap || 0) === 0;
    const previousTurn = [], log = scene.log || [];
    let foundCurrentStart = false;
    for (const logged of log) {
      if (!foundCurrentStart) {
        if (logged.type === "turn.start" && logged.actorId === actor.id) foundCurrentStart = true;
        continue;
      }
      if (logged.type === "turn.start" && logged.actorId === actor.id) break;
      previousTurn.push(logged);
    }
    const variety = !previousTurn.some(logged => logged.type === "action.resolve" && logged.actorId === actor.id && logged.payload?.name === payload.name);
    const amount = [drama, dance, variety, finale].filter(Boolean).length;
    if (amount) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "vagabond.egomaniac.style", delta: amount, sourceActionId: "vagabond.egomaniac.1", reason: `Стиль: ${[drama && "Драма", dance && "Танец", variety && "Разнообразие", finale && "Развязка"].filter(Boolean).join(", ")}` } });
  }
  if (event.type === "rule-clock.tick" && payload.clockId === "vagabond.egomaniac.style" && payload.filled && actor && !scene.pendingPrompt && !promptQueued()) {
    const options = Number(actor.techniques?.["vagabond.egomaniac"] || 0) >= 2 ? ["flow", "provoke", "frighten"] : ["flow"];
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-style`, kind: "egomaniac-style-full", sourceActorId: actor.id, title: "Пиковая форма", text: options.length > 1 ? "Получить 1 ОД и переместиться либо отказаться от ОД ради массового Эффекта?" : "Очистить Стиль, получить 1 ОД и переместиться до 2 клеток по прямой?", options, participantIds: [actor.id] } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "charge") && Number(actor.techniques?.["vagabond.egomaniac"] || 0) >= 3 && clockStatus(scene, actor.id, "vagabond.egomaniac.style").active && Number(scene.tension || 0) > 0 && !scene.pendingPrompt && !promptQueued()) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-finale`, kind: "egomaniac-finale", sourceActorId: actor.id, title: "Финал", text: `Заполнить ${Number(scene.tension || 0) * 2} сегмента Стиля с переносом между заполнениями, затем потерять Стиль до конца Сцены?`, options: ["finale", "pass"], participantIds: [actor.id] } });
  if (event.type === "rule-clock.tick" && payload.clockId === "vagabond.egomaniac.style" && payload.sourceActionId === "vagabond.egomaniac.3" && actor) {
    const remaining = Math.max(0, Number(actor.ruleState?.styleCarryRemaining || 0) - Number(payload.appliedDelta || 0));
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "styleCarryRemaining", value: remaining, sourceActionId: "vagabond.egomaniac.3" } });
    if (!payload.filled) events.push({ type: "rule-clock.configure", actorId: actor.id, payload: { ...clockStatus(scene, actor.id, payload.clockId).definition, value: payload.value, active: false, sourceActionId: "vagabond.egomaniac.3" } });
  }
  if (event.type === "rule-clock.set" && payload.clockId === "vagabond.egomaniac.style" && Number(payload.value || 0) === 0 && actor && !scene.pendingPrompt && Object.prototype.hasOwnProperty.call(actor.ruleState || {}, "styleCarryRemaining")) {
    const remaining = Number(actor.ruleState?.styleCarryRemaining || 0), style = clockStatus(scene, actor.id, payload.clockId);
    if (remaining > 0) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: style.id, delta: Math.min(remaining, style.size), sourceActionId: "vagabond.egomaniac.3", reason: "Финал: перенесённые сегменты" } });
    else events.push({ type: "rule-clock.configure", actorId: actor.id, payload: { ...style.definition, value: 0, active: false, sourceActionId: "vagabond.egomaniac.3" } });
  }
  if (event.type === "rule.respond" && payload.kind === "egomaniac-style-move" && actor && Object.prototype.hasOwnProperty.call(actor.ruleState || {}, "styleCarryRemaining")) {
    const remaining = Number(actor.ruleState?.styleCarryRemaining || 0), style = clockStatus(scene, actor.id, "vagabond.egomaniac.style");
    if (remaining > 0) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: style.id, delta: Math.min(remaining, style.size), sourceActionId: "vagabond.egomaniac.3", reason: "Финал: перенесённые сегменты" } });
    else events.push({ type: "rule-clock.configure", actorId: actor.id, payload: { ...style.definition, value: 0, active: false, sourceActionId: "vagabond.egomaniac.3" } });
  }
  if (event.type === "turn.start" && actor && Number(actor.techniques?.["ruiner.zealot"] || 0) >= 2 && clockStatus(scene, actor.id, "ruiner.zealot.revelation").value >= 4 && !scene.pendingPrompt && !promptQueued()) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-zealot-gaze`, kind: "zealot-watched", sourceActorId: actor.id, title: "Всегда под взглядом", text: "Стать Усиленным и заставить всех персонажей наложить на вас Испуган?", options: ["invoke", "pass"], participantIds: (scene.actors || []).map(item => item.id) } });
  if (event.type === "turn.start" && actor && Number(actor.techniques?.["altruist.chronomancer"] || 0) >= 3 && clockStatus(scene, actor.id, "altruist.chronomancer.flow").full && !actor.ruleState?.timeStopUsed && !scene.pendingPrompt && !promptQueued()) {
    const enemies = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team);
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-time-stop`, kind: "chronomancer-time-stop", sourceActorId: actor.id, title: "Остановка времени", text: "Потратить все ОД, очистить Поток и использовать Заклинание против всех персонажей Сцены?", options: enemies.length <= 2 ? ["time-stop", "time-stop-all-in", "pass"] : ["time-stop", "pass"], context: { optionLabels: { "time-stop": "Остановить время", "time-stop-all-in": "Получить Рану и применить Ва-банк", pass: "Не использовать" } }, participantIds: (scene.actors || []).map(item => item.id) } });
  }
  if (event.type === "rule-clock.tick" && payload.clockId === "powerhouse.braggart.pride" && payload.filled && actor && Number(actor.techniques?.["powerhouse.braggart"] || 0) >= 2 && clockStatus(scene, actor.id, payload.clockId).size > 2 && !scene.pendingPrompt && !promptQueued()) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-hold-back`, kind: "braggart-hold-back", sourceActorId: actor.id, title: "Докажи, чего стоишь", text: "Сдержаться: очистить Гордость и уменьшить размер часов на 2?", options: ["hold-back", "pass"], context: { clockId: payload.clockId }, participantIds: [actor.id] } });
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "charge") && Number(actor.techniques?.["bulwark.stalwart-sentry"] || 0) >= 2) events.push({ type: "rule-clock.set", actorId: actor.id, payload: { clockId: "bulwark.stalwart-sentry.vigilance", value: 4, sourceActionId: "bulwark.stalwart-sentry.2", reason: "Зарядка восстанавливает Бдительность" } });
  if (event.type === "effect.apply" && payload.applied && actor && event.actorId !== payload.targetId) {
    const target = actorById(scene, payload.targetId);
    if (target?.team === actor.team && Number(actor.techniques?.["altruist.chronomancer"] || 0) >= 3) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "altruist.chronomancer.flow", delta: 1, sourceActionId: "altruist.chronomancer.3", reason: "Эффект применён к союзнику", participantIds: [actor.id, target.id] } });
  }
  if (event.type === "resource.gain" && actor && payload.resolvedResource === "focus" && Number(payload.resolvedDelta || 0) > 0 && Number(actor.techniques?.["ruiner.cryomancer"] || 0) >= 2) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: "ruiner.cryomancer.icicle", delta: 1, sourceActionId: "ruiner.cryomancer.2", reason: "Получен Фокус" } });
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "breathe") && Number(actor.techniques?.["ruiner.cryomancer"] || 0) >= 2 && clockStatus(scene, actor.id, "ruiner.cryomancer.icicle").value > 0 && !scene.pendingPrompt && !promptQueued()) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-icicle`, kind: "cryomancer-icicle-rest", sourceActorId: actor.id, title: "Ледяной нимб", text: "Отказаться от полученного Передышкой Фокуса, очистить Сосульку и начать серию Быстрых Заклинаний с половинным уроном?", options: ["convert", "pass"], participantIds: [actor.id] } });
  if (event.type === "action.resolve" && actor && payload.icicleHalo) {
    const remaining = Math.max(0, Number(actor.ruleState?.icicleSpellsRemaining || 0) - 1);
    events.push({ type: "actor.state", actorId: actor.id, payload: { key: "icicleSpellsRemaining", value: remaining, sourceActionId: "ruiner.cryomancer.2" } });
    for (const targetId of payload.targetIds || []) {
      const target = actorById(scene, targetId);
      if (target && hasEffect(scene, target, "negative.замедлен")) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId, effect: "negative.обездвижен", sourceActionId: "ruiner.cryomancer.2", participantIds: [actor.id, targetId] } });
    }
    if (remaining > 0 && !scene.pendingPrompt && !promptQueued()) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-icicle-next`, kind: "cryomancer-icicle-series", sourceActorId: actor.id, title: "Ледяной нимб", text: `Осталось Быстрых Заклинаний: ${remaining}. Продолжить серию?`, options: ["continue", "stop"], context: { remaining }, participantIds: [actor.id] } });
  }
  if (event.type === "action.resolve" && actor && (actionIdIs(eventActionId(payload), "spell") || payload.icicleHalo) && Number(payload.roll?.successes || 0) > 0 && Number(actor.techniques?.["ruiner.cryomancer"] || 0) >= 1) for (const targetId of payload.targetIds || []) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId, effect: "negative.замедлен", sourceActionId: "ruiner.cryomancer.1", participantIds: [actor.id, targetId] } });
  if (event.type === "turn.end" && actor && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 2) {
    const rage = clockStatus(scene, actor.id, "ruiner.feral-arcana.rage");
    if (rage.active && rage.value > 0) events.push({ type: "rule-clock.tick", actorId: actor.id, payload: { clockId: rage.id, delta: -1, sourceActionId: "ruiner.feral-arcana.2", reason: "Конец Хода" } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "jump") && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 2 && !scene.pendingPrompt && !scene.pendingAction && !promptQueued()) {
    const rage = clockStatus(scene, actor.id, "ruiner.feral-arcana.rage");
    const targetIds = (scene.actors || []).filter(target => !target.knockedOut && target.id !== actor.id && target.space === actor.space && distance(actor, target) <= 1).map(target => target.id);
    if (rage.active && rage.value > 0 && targetIds.length) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-rage-spell`, kind: "feral-rage-jump-spell", sourceActorId: actor.id, title: "Сорваться с цепи", text: "После Прыжка обязательно используйте бесплатное Быстрое Заклинание против всех персонажей в смежных клетках.", options: ["attack"], context: { targetIds }, participantIds: [actor.id, ...targetIds] } });
  }
  if (event.type === "rule-clock.tick" && payload.clockId === "ruiner.feral-arcana.rage" && payload.emptied && actor) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.feral-arcana.2", participantIds: [actor.id] } });
  if (event.type === "rule-clock.set" && payload.clockId === "ruiner.feral-arcana.rage" && Number(payload.value || 0) === 0 && actor) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.feral-arcana.2", participantIds: [actor.id] } });
  if ((event.type === "actor.move" && /телепорт/i.test(payload.movement || "") || event.type === "effect.apply" && payload.applied && payload.effect === "positive.изгнан") && actor) {
    const voidOwner = event.type === "effect.apply" ? actorById(scene, payload.targetId) : actor;
    if (voidOwner && Number(voidOwner.techniques?.["ruiner.void-soul"] || 0) >= 3) events.push({ type: "rule-clock.tick", actorId: voidOwner.id, payload: { clockId: "ruiner.void-soul.void", delta: 1, sourceActionId: "ruiner.void-soul.3", reason: event.type === "actor.move" ? "Телепортация" : "Получен Изгнан", participantIds: [voidOwner.id] } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "breathe") && Number(actor.techniques?.["ruiner.thunder-blood"] || 0) >= 1 && !scene.pendingPrompt && !promptQueued()) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-static`, kind: "thunder-rest-static", sourceActorId: actor.id, title: "Райден", text: `Заполнить ${Number(actor.techniques?.["ruiner.thunder-blood"] || 0) >= 3 ? 4 : 2} сегмента Статики?`, options: ["fill", "pass"], context: { amount: Number(actor.techniques?.["ruiner.thunder-blood"] || 0) >= 3 ? 4 : 2 }, participantIds: [actor.id] } });
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "spell") && Number(payload.roll?.successes || 0) > 0 && Number(actor.techniques?.["ruiner.thunder-blood"] || 0) >= 2 && clockStatus(scene, actor.id, "ruiner.thunder-blood.static").value > 0 && !scene.pendingPrompt && !promptQueued()) {
    const originalTargets = [...new Set(payload.targetIds || [])].map(id => actorById(scene, id)).filter(target => target && !target.knockedOut);
    const options = ["pass"], optionLabels = { pass: "Не использовать" };
    for (const target of originalTargets) {
      options.push(`surge:${target.id}`, `discharge:${target.id}`);
      optionLabels[`surge:${target.id}`] = `Скачок к цели: ${target.name}`;
      optionLabels[`discharge:${target.id}`] = `Разряд по цели: ${target.name}`;
      const chainTargets = (scene.actors || []).filter(candidate => !candidate.knockedOut && candidate.team !== actor.team && candidate.id !== target.id && candidate.space === target.space && distance(target, candidate) <= 5);
      if (chainTargets.length) {
        options.push(`chain:${target.id}`);
        optionLabels[`chain:${target.id}`] = `Цепь от цели: ${target.name}`;
      }
    }
    if (options.length > 1) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-charged-spell`, kind: "thunder-charged-spell", sourceActorId: actor.id, title: "Заряженное заклинание", text: "Очистить 1 Статику, наложить на себя Ошеломлен и выбрать дополнительный эффект?", options, context: { optionLabels }, participantIds: [actor.id, ...originalTargets.map(target => target.id)] } });
  }
  if (event.type === "effect.apply" && payload.applied && payload.effect === "negative.ошеломлен") {
    const target = actorById(scene, payload.targetId), staticClock = target && clockStatus(scene, target.id, "ruiner.thunder-blood.static");
    if (target && Number(target.techniques?.["ruiner.thunder-blood"] || 0) >= 1 && staticClock.active && staticClock.value > 0) events.push({ type: "effect.remove", actorId: target.id, payload: { targetId: target.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.thunder-blood.1", reason: "Невосприимчивость Статики", participantIds: [target.id] } });
  }
  if (event.type === "roll.public" && actor && Number(actor.techniques?.["ruiner.zealot"] || 0) >= 1 && (payload.rolls || []).includes(1) && Number(actor.focus || 0) >= 1 && !scene.pendingPrompt && !promptQueued()) {
    const log = scene.log || [], latestPrepare = log.find(logged => logged.type === "action.prepare" && logged.actorId === actor.id), latestResolve = log.find(logged => logged.type === "action.resolve" && logged.actorId === actor.id);
    const actionInstanceId = latestPrepare && (!latestResolve || log.indexOf(latestPrepare) < log.indexOf(latestResolve)) ? latestPrepare.id : event.id;
    const alreadyUsed = log.some(logged => logged.type === "rule-clock.tick" && logged.actorId === actor.id && logged.payload?.sourceActionId === "ruiner.zealot.1" && logged.payload?.actionInstanceId === actionInstanceId);
    if (!alreadyUsed) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-revelation`, kind: "zealot-revelation-one", sourceActorId: actor.id, title: "Еретическая преданность", text: "Потратить 1 Фокус и заполнить сегмент Озарения за выпавшую 1?", options: ["fill", "pass"], context: { rollEventId: event.id, actionInstanceId }, participantIds: [actor.id] } });
  }
  if (event.type === "damage.apply" && Number(payload.dealt || 0) > 0) {
    const target = actorById(scene, payload.targetId);
    if (target && Number(target.techniques?.["vagabond.egomaniac"] || 0) >= 1 && scene.pendingAction?.actorId === event.actorId) {
      const style = clockStatus(scene, target.id, "vagabond.egomaniac.style");
      if (style.value > 0) events.push({ type: "rule-clock.tick", actorId: target.id, payload: { clockId: style.id, delta: -1, sourceActionId: "vagabond.egomaniac.1", reason: "Попадание вражеской Атаки", participantIds: [event.actorId, target.id].filter(Boolean) } });
    }
  }
  if (event.type === "action.prepare" && actor && Number(actor.techniques?.["altruist.heavenly-saint"] || 0) >= 1) {
    const allies = [...new Set(payload.targetIds || [])].map(id => actorById(scene, id)).filter(target => target && target.id !== actor.id && target.team === actor.team);
    if (allies.length) events.push({ type: "rule-resource.gain", actorId: actor.id, payload: { resource: "faith", amount: 1, sourceActionId: "altruist.heavenly-saint.1", participantIds: [actor.id, ...allies.map(target => target.id)] } });
  }
  if (event.type === "turn.end" && actor && Number(actor.techniques?.["powerhouse.gunslinger"] || 0) >= 2 && !scene.pendingPrompt) {
    const turnEvents = [];
    for (const logged of scene.log || []) {
      if (logged.id === event.id) continue;
      if (logged.type === "turn.start" && logged.actorId === actor.id) break;
      turnEvents.push(logged);
    }
    const attacked = turnEvents.some(logged => logged.type === "action.prepare" && logged.actorId === actor.id && ["skirmish", "spell", "finish"].some(key => actionIdIs(logged.payload?.actionId, key)));
    if (!attacked && ruleResourceStatus(scene, actor.id, { resource: "bullets" }).balance < 6) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-reload`, kind: "gunslinger-reload", sourceActorId: actor.id, title: "Зарядить и взвести", text: "Выставить Пули на 6?", options: ["reload", "pass"], participantIds: [actor.id] } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "breathe") && Number(actor.techniques?.["vagabond.modified-meister"] || 0) >= 3 && Number(scene.tension || 0) >= 2 && !scene.pendingPrompt && !promptQueued()) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-overclock`, kind: "meister-overclock", sourceActorId: actor.id, title: "Разгон", text: "Разогнаться до конца следующего Хода?", options: ["overclock", "pass"], participantIds: [actor.id] } });
  if (event.type === "damage.apply" && Number(payload.dealt || 0) > 0) {
    const owners = [...new Set([event.actorId, payload.targetId])].map(id => actorById(scene, id)).filter(owner => owner && Number(owner.techniques?.["vagabond.modified-meister"] || 0) >= 3 && Number(owner.ruleState?.modifiedOverclockTurns || 0) > 0);
    owners.forEach(owner => events.push({ type: "rule-resource.gain", actorId: owner.id, payload: { resource: "heat", amount: 1, sourceActionId: "vagabond.modified-meister.3", participantIds: [owner.id, payload.targetId].filter(Boolean) } }));
  }
  if (event.type === "actor.enter" && actor && !scene.pendingPrompt) {
    const weapon = (scene.markers || []).find(marker => marker.ownerActorId === actor.id && marker.ruleId === "vagabond.knife-juggler.2" && marker.space === actor.space && marker.x === actor.x && marker.y === actor.y);
    if (weapon) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-weapon`, kind: "knife-pickup", sourceActorId: actor.id, markerId: weapon.id, title: "Пополнение", text: "Подобрать Оружие, получить 1 Оружие и переместиться на 1 клетку?", options: ["pickup", "pass"], context: { markerId: weapon.id }, participantIds: [actor.id] } });
  }
  if (event.type === "actor.move" && actor && payload.from && !scene.pendingPrompt) {
    const marker = (scene.markers || []).find(item => item.ruleId === "vagabond.knife-juggler.2" && item.space === payload.from.space && item.x === Number(payload.from.x) && item.y === Number(payload.from.y) && actorById(scene, item.ownerActorId)?.team !== actor.team && Number(actorById(scene, item.ownerActorId)?.techniques?.["vagabond.knife-juggler"] || 0) >= 3);
    const owner = marker && actorById(scene, marker.ownerActorId);
    if (owner && !owner.knockedOut) events.push({ type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${event.id}-chaser`, kind: "knife-chaser", sourceActorId: owner.id, targetId: actor.id, markerId: marker.id, title: "Преследователь", text: `Телепортироваться к Оружию и использовать Быструю Стычку против ${actor.name}?`, options: ["chase", "pass"], context: { markerId: marker.id }, participantIds: [owner.id, actor.id] } });
  }
  if (event.type === "actor.move" && actor && payload.from && !payload.forced && !payload.placement && scene.activeActorId && !scene.pendingPrompt && !scene.pendingAction && !promptQueued()) {
    const route = [payload.from, ...(payload.path || []).map(cell => { const [x, y] = String(cell).split(",").map(Number); return { space: payload.space || actor.space, x, y }; })];
    if (!route.length || route.at(-1).x !== actor.x || route.at(-1).y !== actor.y) route.push({ space: actor.space, x: actor.x, y: actor.y });
    const leavesAdjacency = owner => route.some((point, index) => index < route.length - 1 && owner.space === point.space && distance(owner, point) <= 1 && distance(owner, route[index + 1]) > 1);
    const departureIndex = owner => route.findIndex((point, index) => index < route.length - 1 && owner.space === point.space && distance(owner, point) <= 1 && distance(owner, route[index + 1]) > 1);
    const punishers = (scene.actors || []).filter(owner => {
      const sentry = Number(owner.techniques?.["bulwark.stalwart-sentry"] || 0) >= 2, canPay = resourceOperationStatus(scene, owner.id, { resource: "ap", amount: 1, operation: "spend" }).available, canUseVigilance = sentry && clockStatus(scene, owner.id, "bulwark.stalwart-sentry.vigilance").value > 0;
      return !owner.knockedOut && owner.team !== actor.team && (sentry || actionIdIs(payload.sourceActionId, "step") && owner.kind === "hero" && !owner.profileId) && (canPay || canUseVigilance);
    }).map(owner => ({ owner, index: departureIndex(owner) })).filter(item => item.index >= 0).sort((left, right) => left.index - right.index);
    const prompts = punishers.map(({ owner, index }, order) => {
      const sentry = Number(owner.techniques?.["bulwark.stalwart-sentry"] || 0) >= 2, vigilance = sentry ? clockStatus(scene, owner.id, "bulwark.stalwart-sentry.vigilance") : { value: 0 }, canPay = resourceOperationStatus(scene, owner.id, { resource: "ap", amount: 1, operation: "spend" }).available, options = [...(sentry && vigilance.value > 0 ? ["punish-free"] : []), ...(canPay ? ["punish-paid"] : []), "pass"];
      return { type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${event.id}-punishment-${order}`, kind: "sentry-punishment", sourceActorId: owner.id, targetId: actor.id, title: "Наказание", text: `${actor.name} покидает смежность с ${owner.name}. Использовать Стычку как Быструю Реакцию?`, options, context: { basePunishment: !sentry, stop: clone(route[index]), optionLabels: { "punish-free": "Очистить Бдительность · 0 ОД", "punish-paid": sentry ? "Заплатить обычную стоимость" : "Использовать Наказание", pass: "Пропустить" } }, participantIds: [owner.id, actor.id] } };
    });
    if (prompts.length) {
      events.push(prompts[0]);
      prompts.slice(1).forEach((prompt, index) => events.push({ type: "rule.trigger", actorId: prompt.actorId, payload: { triggerId: `core.punishment.${prompt.actorId}.${index}`, sourceEventId: event.id, sourceEventType: event.type, status: "queued", reason: "Предыдущее Наказание разрешается первым.", priority: 0, emittedTypes: ["rule.prompt"], triggerOwnerId: prompt.actorId, participantIds: prompt.payload.participantIds, deferredEvent: prompt } }));
    }
  }
  if (event.type === "attack.pending" && actor && hasEffect(scene, actor, "negative.порчен")) {
    events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: actor.id, amount: Number(actor.tier || 1), ignoreArmor: true, ignoreEvasion: true, healthLoss: true, sourceActionId: "negative.порчен", participantIds: [actor.id] } });
  }
  if (event.type === "turn.start" && actor && !scene.pendingPrompt && !promptQueued()) {
    const empath = (scene.actors || []).find(owner => !owner.knockedOut && owner.team === actor.team && owner.id !== actor.id && Number(owner.techniques?.["altruist.empath"] || 0) >= 1 && distance(owner, actor) <= 1);
    if (empath && (actor.effects || []).length) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-empath`, kind: "empath-calm", sourceActorId: empath.id, targetId: actor.id, title: "Успокаивающая аура", text: "Можно потерять один Эффект и стать Усиленным.", options: [...actor.effects.slice(0, 11), "pass"], participantIds: [empath.id, actor.id] } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "breathe") && Number(actor.techniques?.["altruist.alchemist"] || 0) >= 1 && !scene.pendingPrompt) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}`, kind: "alchemist-mix", sourceActorId: actor.id, title: "Быстрая смесь", text: "Передышка позволяет создать одно Зелье.", options: ["pure-water", "rage-fumes", "growth-serum", "adrenaline", "stone-skin", "thorn-rot"] } });
  }
  if (event.type === "action.resolve" && actor && Number(actor.techniques?.["disruptor.chemist"] || 0) >= 1 && (payload.targetedTerrainId || payload.targetsTerrainCell) && payload.techniqueAnchor && !scene.pendingPrompt && !promptQueued()) {
    const terrain = (scene.objects || []).find(object => object.id === payload.targetedTerrainId);
    if (!payload.targetedTerrainId || terrain) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-sublimation`, kind: "chemist-sublimation", sourceActorId: actor.id, title: "Сублимация", text: terrain ? `Уничтожить «${terrain.label}» и создать на его клетке зону Газа 3×3?` : "Сублимировать обычную местность выбранной клетки и создать зону Газа 3×3?", options: ["sublimate", "pass"], context: { terrainId: terrain?.id || null, space: actor.space, cells: squareCells(scene, actor, payload.techniqueAnchor, 1), optionLabels: { sublimate: terrain ? "Уничтожить и создать Газ" : "Создать Газ", pass: "Не использовать Сублимацию" } }, participantIds: [actor.id] } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "charge") && Number(actor.techniques?.["ruiner.grim-ascendant"] || 0) >= 1 && Number(scene.tension || 0) >= 2 && !actor.ruleState?.grimUsed && !scene.pendingPrompt && !promptQueued()) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-grim`, kind: "grim-transform", sourceActorId: actor.id, title: "Непостоянная мощь", text: "Трансформироваться: получить 2 ОД, обратить потерянное Здоровье в удвоенный Фокус и оттолкнуть ближайших врагов?", options: ["transform", "pass"], participantIds: [actor.id] } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "charge") && Number(actor.techniques?.["powerhouse.warring-ascendant"] || 0) >= 1 && Number(scene.tension || 0) >= 2 && !actor.ruleState?.warringUsed && !scene.pendingPrompt && !promptQueued()) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-warring`, kind: "warring-transform", sourceActorId: actor.id, title: "Небесная рука", text: "Трансформироваться и оттолкнуть всех врагов в пределах 2 клеток на 3 клетки? Выбранные оружейные Техники должны быть заранее записаны в листе.", options: ["transform", "pass"], participantIds: [actor.id] } });
  }
  if (event.type === "action.resolve" && actor && actionIdIs(eventActionId(payload), "charge") && Number(actor.techniques?.["altruist.will-o-wisp"] || 0) >= 1 && !actor.ruleState?.wispCreationUsed && !wispMarkers(scene, actor.id).length && !scene.pendingPrompt && !promptQueued()) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-wisp`, kind: "wisp-primary", sourceActorId: actor.id, title: "Пламя духовного плетения", text: "Выберите первый Дух для Духовного пламени.", options: [...Object.keys(WISP_TYPES), "pass"], participantIds: [actor.id] } });
  }
  if ((event.type === "action.resolve" && actionIdIs(eventActionId(payload), "step") && !payload.continuation || event.type === "turn.end") && actor && Number(actor.techniques?.["altruist.will-o-wisp"] || 0) >= 1 && wispMarkers(scene, actor.id).length && !scene.pendingPrompt && !promptQueued()) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-wisp-move`, kind: "wisp-move-select", sourceActorId: actor.id, title: "Духовное пламя", text: "Можно переместить одно Духовное пламя на расстояние до 4 клеток.", options: [...wispMarkers(scene, actor.id).map(marker => marker.id), "pass"], participantIds: [actor.id] } });
  }
  if (event.type === "turn.end" && actor && Number(actor.techniques?.["disruptor.constrictor"] || 0) >= 1 && !scene.pendingPrompt && !promptQueued()) {
    const caughtIds = (scene.actors || []).filter(target => !target.knockedOut && effectStateFor(target, "negative.пойман")?.sources.some(source => source.actorId === actor.id)).map(target => target.id);
    if (caughtIds.length) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-constrictor-move`, kind: "constrictor-move-select", sourceActorId: actor.id, title: "Обвить · конец Хода", text: "Можно по очереди переместить каждого Пойманного персонажа на расстояние до 5 клеток.", options: [...caughtIds, "pass"], context: { targetIds: caughtIds }, participantIds: [actor.id, ...caughtIds] } });
  }
  if (event.type === "turn.end" && actor && hasEffect(scene, actor, "positive.регенерирует")) events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: actor.id, amount: Number(actor.tier || 1), sourceActionId: "positive.регенерирует", participantIds: [actor.id] } });
  if (event.type === "damage.apply" && actorById(scene, payload.targetId)?.ruleState?.grimTransformed && Number(actorById(scene, payload.targetId)?.focus || 0) === 0) {
    const target = actorById(scene, payload.targetId);
    events.push({ type: "actor.state", actorId: target.id, payload: { key: "grimTransformed", value: false, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "effect.apply", actorId: target.id, payload: { targetId: target.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.grim-ascendant.1", participantIds: [target.id] } });
  }
  if (event.type === "damage.apply" && actorById(scene, payload.targetId)?.ruleState?.warringTransformed && Number(actorById(scene, payload.targetId)?.hp || 0) === 0) {
    const target = actorById(scene, payload.targetId);
    events.push({ type: "actor.state", actorId: target.id, payload: { key: "warringTransformed", value: false, sourceActionId: "powerhouse.warring-ascendant.1" } });
    events.push({ type: "effect.apply", actorId: target.id, payload: { targetId: target.id, effect: "negative.ошеломлен", sourceActionId: "powerhouse.warring-ascendant.1", participantIds: [target.id] } });
  }
  if (event.type === "actor.move" && actor && payload.from && !scene.pendingPrompt) {
    for (const owner of (scene.actors || []).filter(item => !item.knockedOut && Number(item.techniques?.["altruist.will-o-wisp"] || 0) >= 2)) {
      const flames = wispMarkers(scene, owner.id);
      const exited = flames.filter(marker => marker.space === actor.space && marker.x === Number(payload.from.x) && marker.y === Number(payload.from.y) && (marker.x !== actor.x || marker.y !== actor.y));
      if (!exited.length) continue;
      if (owner.team === actor.team) events.push({ type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${event.id}-wisp-follow`, kind: "wisp-follow", sourceActorId: owner.id, targetId: actor.id, title: "Дружелюбные духи", text: `Переместить Пламя вслед за ${actor.name}?`, options: [...exited.map(marker => marker.id), "pass"], context: { targetId: actor.id }, participantIds: [owner.id, actor.id] } });
      else if (Number(owner.focus || 0) >= 1) {
        const path = (payload.path || []).map(value => { const [x, y] = String(value).split(",").map(Number); return { x, y }; });
        const firstExit = path.find(point => exited.some(marker => marker.x !== point.x || marker.y !== point.y)) || { x: actor.x, y: actor.y };
        events.push({ type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${event.id}-wisp-stop`, kind: "wisp-stop", sourceActorId: owner.id, targetId: actor.id, title: "Дружелюбные духи", text: `Потратить 1 Фокус и остановить ${actor.name} рядом с Пламенем?`, options: ["stop", "pass"], context: { stopCell: firstExit }, participantIds: [owner.id, actor.id] } });
      }
      break;
    }
  }
  if (event.type === "actor.enter" && actor && !actor.knockedOut) {
    const cell = `${actor.x},${actor.y}`;
    const hostileGas = (scene.objects || []).find(object => object.type === "gas" && object.space === actor.space && object.cells?.includes(cell) && actorById(scene, object.ownerActorId)?.team !== actor.team);
    if (hostileGas && !(actor.effects || []).includes("negative.ослаблен")) events.push({ type: "effect.apply", actorId: hostileGas.ownerActorId, payload: { targetId: actor.id, effect: "negative.ослаблен", sourceActionId: hostileGas.ruleId || hostileGas.source, triggerOwnerId: hostileGas.ownerActorId, participantIds: [hostileGas.ownerActorId, actor.id] } });
    const trap = (scene.markers || []).find(marker => marker.kind === "trap" && /disruptor\.hunter\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`) && marker.space === actor.space && marker.x === actor.x && marker.y === actor.y && Number(actorById(scene, marker.ownerActorId)?.techniques?.["disruptor.hunter"] || 0) >= 1 && actorById(scene, marker.ownerActorId)?.team !== actor.team);
    if (trap && !scene.pendingPrompt && !scene.pendingAction) {
      actor.stepRemaining = 0;
      events.push({ type: "rule.prompt", actorId: trap.ownerActorId, payload: { id: `prompt-${event.id}-${trap.id}`, kind: "hunter-trap", sourceActorId: trap.ownerActorId, targetId: actor.id, markerId: trap.id, title: "Стальные челюсти", text: `${actor.name} проходит через Малую ловушку: движение остановлено. Использовать бесплатную Быструю Стычку?`, options: ["attack", "pass"], triggerOwnerId: trap.ownerActorId, participantIds: [trap.ownerActorId, actor.id] } });
    }
  }
  if (event.type === "area.create" && actor && (payload.ruleId === "disruptor.chemist.1" || payload.source === "disruptor.chemist.1") && Number(actor.techniques?.["disruptor.chemist"] || 0) >= 3) {
    const targets = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && target.space === payload.space && (payload.cells || []).includes(`${target.x},${target.y}`));
    for (const target of targets) {
      events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.ослаблен", sourceActionId: "disruptor.chemist.3", participantIds: [actor.id, target.id] } });
      events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount: Number(actor.attrs?.mind || 0), sourceActionId: "disruptor.chemist.3", participantIds: [actor.id, target.id] } });
    }
  }
  if (event.type === "effect.apply" && payload.applied && payload.effect === "negative.ослаблен" && actor && Number(actor.techniques?.["disruptor.chemist"] || 0) >= 2) {
    const target = actorById(scene, payload.targetId);
    if (target && !target.knockedOut && Number(target.hp || 0) <= Number(actor.attrs?.mind || 0)) {
      events.push({ type: "actor.knockout", actorId: actor.id, payload: { targetId: target.id, sourceActionId: "disruptor.chemist.2", participantIds: [actor.id, target.id] } });
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: 2, sourceActionId: "disruptor.chemist.2", participantIds: [actor.id, target.id] } });
      if (Number(actor.techniques?.["disruptor.chemist"] || 0) >= 3) events.push({ type: "area.create", actorId: actor.id, payload: { id: `gas-${event.id}-${target.id}`, space: target.space, areaType: "gas", label: "Сублимация", source: "disruptor.chemist.1", ruleId: "disruptor.chemist.1", duration: "nextTurn", ownerActorId: actor.id, cells: squareCells(scene, target, target, 1), participantIds: [actor.id, target.id] } });
    }
  }
  if (event.type === "damage.apply" && payload.sourceActionId === "disruptor.chemist.3" && Number(payload.dealt || 0) > 0 && actor && Number(actor.techniques?.["disruptor.chemist"] || 0) >= 2) {
    const target = actorById(scene, payload.targetId);
    if (target && !target.knockedOut && (target.effects || []).includes("negative.ослаблен") && Number(target.hp || 0) <= Number(actor.attrs?.mind || 0)) {
      events.push({ type: "actor.knockout", actorId: actor.id, payload: { targetId: target.id, sourceActionId: "disruptor.chemist.2", reason: "Экспериментальная смесь после урона Осаждения", participantIds: [actor.id, target.id] } });
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: 2, sourceActionId: "disruptor.chemist.2", participantIds: [actor.id, target.id] } });
      if (Number(actor.techniques?.["disruptor.chemist"] || 0) >= 3) events.push({ type: "area.create", actorId: actor.id, payload: { id: `gas-${event.id}-${target.id}`, space: target.space, areaType: "gas", label: "Сублимация", source: "disruptor.chemist.1", ruleId: "disruptor.chemist.1", duration: "nextTurn", ownerActorId: actor.id, cells: squareCells(scene, target, target, 1), participantIds: [actor.id, target.id] } });
    }
  }
  if ((event.type === "area.remove" || event.type === "object.damage" && Number(payload.dealt || 0) > 0) && actor && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 2) events.push({ type: "rule-resource.gain", actorId: actor.id, payload: { resource: "creation-marks", amount: 1, sourceActionId: "ruiner.creation-ascetic.2" } });
  if (event.type === "attack.clear" && !scene.pendingPrompt && !promptQueued()) {
    const ranger = [...new Set(payload.targetIds || [])].map(id => actorById(scene, id)).find(target => !target?.knockedOut && target?.profileId === "enemy.common.ranger");
    if (ranger) events.push({ type: "rule.prompt", actorId: ranger.id, payload: { id: `prompt-${event.id}-ranger-retreat`, kind: "enemy-ranger-retreat", sourceActorId: ranger.id, controller: "narrator", title: "Снайперская дистанция", text: `${ranger.name} может переместиться на 1 клетку после Атаки по нему.`, options: ["move", "pass"], context: { optionLabels: { move: "Переместиться", pass: "Не использовать" } }, participantIds: [ranger.id, event.actorId].filter(Boolean) } });
  }
  if (event.type === "turn.start" && actor && !scene.pendingPrompt && !promptQueued()) {
    if (actor.profileId === "enemy.common.healer") {
      const allies = (scene.actors || []).filter(item => !item.knockedOut && item.id !== actor.id && item.team === actor.team && effectPresenceStatus(scene, item.id).onField);
      events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-healer-guardian`, kind: "enemy-healer-guardian", sourceActorId: actor.id, controller: "narrator", title: "Страж Целителя", text: "Выберите союзника Стражем Целителя на этот Ход.", options: [...allies.map(item => `guard:${item.id}`), "pass"], context: { optionLabels: Object.fromEntries([...allies.map(item => [`guard:${item.id}`, item.name]), ["pass", "Не выбирать Стража"]]) }, participantIds: [actor.id, ...allies.map(item => item.id)] } });
    }
    if (actor.profileId === "enemy.common.coordinator") {
      for (const ally of (scene.actors || []).filter(item => !item.knockedOut && item.id !== actor.id && item.team === actor.team && item.space === actor.space && distance(actor, item) <= 4)) events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: ally.id, effect: "positive.усилен", duration: "scene", sourceActionId: "enemy.common.coordinator.passive", participantIds: [actor.id, ally.id] } });
    }
    const flux = effectStateFor(actor, "special.поток"), sourceState = flux?.sources.find(source => actorById(scene, source.actorId)?.profileId === "enemy.common.illusionist"), illusionist = actorById(scene, sourceState?.actorId);
    const swaps = illusionist ? (scene.actors || []).filter(candidate => !candidate.knockedOut && candidate.team === illusionist.team && candidate.id !== illusionist.id && candidate.id !== actor.id) : [];
    if (illusionist && swaps.length) events.push({ type: "rule.prompt", actorId: illusionist.id, payload: { id: `prompt-${event.id}-flux`, kind: "enemy-flux-swap", sourceActorId: illusionist.id, targetId: actor.id, controller: "narrator", title: "Поток", text: `${actor.name} начинает Ход в Потоке. Иллюзионист может поменять его позицию с позицией другого врага.`, options: [...swaps.map(target => `swap:${target.id}`), "pass"], context: { optionLabels: Object.fromEntries(swaps.map(target => [`swap:${target.id}`, `Поменять с ${target.name}`])) }, participantIds: [illusionist.id, actor.id, ...swaps.map(target => target.id)] } });
  }
  if (event.type === "turn.end" && actor?.profileId === "enemy.common.coordinator") {
    for (const ally of scene.actors || []) if (effectStateFor(ally, "positive.усилен")?.sources.some(source => source.actorId === actor.id && source.actionId === "enemy.common.coordinator.passive")) events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: ally.id, effect: "positive.усилен", sourceOnly: true, sourceActorId: actor.id, sourceActionId: "enemy.common.coordinator.passive", participantIds: [actor.id, ally.id] } });
  }
  if (event.type === "actor.move") {
    const coordinator = actorById(scene, scene.activeActorId);
    if (coordinator?.profileId === "enemy.common.coordinator") {
      for (const ally of (scene.actors || []).filter(item => item.id !== coordinator.id && item.team === coordinator.team)) {
        const inRange = !ally.knockedOut && ally.space === coordinator.space && distance(coordinator, ally) <= 4;
        const sourced = effectStateFor(ally, "positive.усилен")?.sources.some(source => source.actorId === coordinator.id && source.actionId === "enemy.common.coordinator.passive");
        if (inRange && !sourced) events.push({ type: "effect.apply", actorId: coordinator.id, payload: { targetId: ally.id, effect: "positive.усилен", duration: "scene", sourceActionId: "enemy.common.coordinator.passive", participantIds: [coordinator.id, ally.id] } });
        if (!inRange && sourced) events.push({ type: "effect.remove", actorId: coordinator.id, payload: { targetId: ally.id, effect: "positive.усилен", sourceOnly: true, sourceActorId: coordinator.id, sourceActionId: "enemy.common.coordinator.passive", participantIds: [coordinator.id, ally.id] } });
      }
    }
  }
  if (event.type === "attack.pending" && actor) {
    const duelistSource = actor.profileId === "enemy.common.duelist" ? actor : null;
    if (duelistSource) for (const targetId of payload.targetIds || []) events.push({ type: "effect.apply", actorId: duelistSource.id, payload: { targetId, effect: "negative.спровоцирован", sourceActionId: "enemy.common.duelist.passive", duration: "scene", participantIds: [duelistSource.id, targetId] } });
    for (const targetId of payload.targetIds || []) {
      const duelistTarget = actorById(scene, targetId);
      if (duelistTarget?.profileId === "enemy.common.duelist") events.push({ type: "effect.apply", actorId: duelistTarget.id, payload: { targetId: actor.id, effect: "negative.спровоцирован", sourceActionId: "enemy.common.duelist.passive", duration: "scene", participantIds: [duelistTarget.id, actor.id] } });
    }
    for (const targetId of payload.targetIds || []) {
      const target = actorById(scene, targetId), mark = effectStateFor(target, "negative.помечен"), healerSource = mark?.sources.find(source => actorById(scene, source.actorId)?.profileId === "enemy.common.healer" && source.actionId === "enemy.common.healer.attack.exsanguinate");
      if (!healerSource) continue;
      events.push({ type: "effect.remove", actorId: healerSource.actorId, payload: { targetId, effect: "negative.помечен", sourceActorId: healerSource.actorId, sourceActionId: "enemy.common.healer.attack.exsanguinate", participantIds: [healerSource.actorId, targetId, actor.id] } });
      events.push({ type: "actor.heal", actorId: healerSource.actorId, payload: { targetId: actor.id, amount: enemyTierFormula("5(+2)", actorById(scene, healerSource.actorId)?.tier), sourceActionId: "enemy.common.healer.attack.exsanguinate", participantIds: [healerSource.actorId, actor.id, targetId] } });
    }
  }
  if (event.type === "damage.apply" && Number(payload.dealt || 0) >= 4 && !scene.pendingPrompt && !promptQueued()) {
    const berserker = actorById(scene, payload.targetId), attacker = actorById(scene, event.actorId);
    if (berserker && !berserker.knockedOut && berserker.profileId === "enemy.common.berserker" && attacker && attacker.team !== berserker.team && Number(berserker.ruleState?.berserkerReactionTurnSerial || -1) !== Number(scene.turnSerial || 0)) events.push({ type: "rule.prompt", actorId: berserker.id, payload: { id: `prompt-${event.id}-berserker-retaliate`, kind: "enemy-berserker-retaliate", sourceActorId: berserker.id, targetId: attacker.id, controller: "narrator", title: "Неумолимое разрушение", text: `${berserker.name} получил не менее 4 урона: переместиться к ${attacker.name} и использовать Сокрушение?`, options: ["retaliate", "pass"], context: { maxDistance: berserker.ruleState?.berserkerLastStand ? 2 : 1, ruleId: "enemy.common.berserker.attack.thrash", optionLabels: { retaliate: "Ответить Сокрушением", pass: "Не использовать" } }, participantIds: [berserker.id, attacker.id] } });
  }
  if (event.type === "actor.move" && actor?.profileId === "enemy.common.ranger" && Number(actor.ruleState?.enemyAim || 0) > 0) events.push({ type: "actor.state", actorId: actor.id, payload: { key: "enemyAim", value: 0, sourceActionId: "enemy.common.ranger.action.nest" } });
  events.push(...effectLifecycleEvents(scene, event));
  events.push(...entityLifecycleEvents(scene, event));
  events.push(...reminderLifecycleEvents(scene, event));
  return events;
}

function dispatchMany(scene, events, options = {}) {
  let next = clone(scene);
  const committed = [], duplicates = [];
  const queue = [...(events || [])];
  let versionPending = options.expectedVersion !== undefined;
  let handled = 0;
  while (queue.length) {
    if (handled++ > 240) throw new Error("Слишком длинная цепочка автоматических правил.");
    const event = queue.shift();
    const prompt = next.pendingPrompt, destination = event?.payload?.destination;
    const placementActorId = ["siren-irresistible-cell", "constrictor-move-cell"].includes(prompt?.kind) || prompt?.kind === "enemy-move-cell" && prompt.context?.moveTarget ? prompt.targetId : prompt?.sourceActorId;
    const stationarySiren = prompt?.kind === "siren-irresistible-cell" && actorById(next, prompt.targetId)?.x === Number(destination?.x) && actorById(next, prompt.targetId)?.y === Number(destination?.y);
    const placementResponse = event?.type === "rule.respond" && event.payload?.choice === "cell" && destination && (
      prompt?.kind === "marker-move-cell"
        ? queue.some(candidate => candidate.type === "marker.move" && candidate.payload?.markerId === (prompt.context?.markerId || prompt.markerId) && Number(candidate.payload?.x) === Number(destination.x) && Number(candidate.payload?.y) === Number(destination.y))
        : prompt?.kind === "dim-mak-weak-point-cell"
          ? queue.some(candidate => candidate.type === "marker.create" && Number(candidate.payload?.x) === Number(destination.x) && Number(candidate.payload?.y) === Number(destination.y))
        : prompt?.kind === "constrictor-move-cell"
          ? queue.some(candidate => candidate.type === "actor.move" && candidate.actorId === event.payload?.targetId && Number(candidate.payload?.x) === Number(destination.x) && Number(candidate.payload?.y) === Number(destination.y))
        : stationarySiren
          ? queue.some(candidate => candidate.type === "technique.resolve" && candidate.actorId === prompt.sourceActorId && candidate.payload?.ruleId === "disruptor.siren.2")
          : queue.some(candidate => candidate.type === "actor.move" && candidate.actorId === placementActorId && Number(candidate.payload?.x) === Number(destination.x) && Number(candidate.payload?.y) === Number(destination.y))
    );
    const dispatchOptions = { ...options, expectedVersion: versionPending ? options.expectedVersion : undefined, placementResponse };
    const result = dispatch(next, event, dispatchOptions);
    next = result.scene;
    if (result.duplicate) duplicates.push(result.event);
    else {
      committed.push(result.event);
      versionPending = false;
    }
    const deferQueuedResume = result.event.type === "rule.respond" && queue.some(candidate => ["rule.prompt", "action.prepare", "attack.pending"].includes(candidate?.type));
    const derived = result.duplicate ? [] : triggeredEvents(next, result.event, { deferQueuedResume });
    if (derived.length) queue.unshift(...derived);
  }
  return { scene: next, events: committed, duplicates };
}

function previewEvents(scene, events, options = {}) {
  try {
    const result = dispatchMany(scene, events, options);
    return { ok: true, ...result, errors: [], code: null };
  } catch (error) {
    return {
      ok: false,
      scene: clone(scene),
      events: [],
      errors: [error?.message || "Цепочку событий нельзя применить."],
      code: error?.code || "SCENE_EVENT_INVALID",
    };
  }
}

// Only deterministic base-action modifiers belong here. Conditional follow-ups,
// named sub-actions (such as Flurry/Sting), clocks and target-shape clauses stay
// in the Technique assistant instead of being guessed from localized prose.
