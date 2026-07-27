"use strict";

function actorMatchesQuery(actor, source, options = {}) {
  if (!actor || (!options.includeKnockedOut && actor.knockedOut)) return false;
  if (!options.includeSelf && source && actor.id === source.id) return false;
  if (options.team && actor.team !== options.team) return false;
  if (options.audience === "allies" && source && actor.team !== source.team) return false;
  if (options.audience === "enemies" && source && actor.team === source.team) return false;
  if (Array.isArray(options.excludeIds) && options.excludeIds.includes(actor.id)) return false;
  return true;
}

function actorIdsInCells(scene, spaceId, cells = [], options = {}) {
  const source = actorById(scene, options.sourceActorId);
  const wanted = new Set((Array.isArray(cells) ? cells : []).map(String));
  return (scene?.actors || [])
    .filter(actor => actor.space === spaceId && wanted.has(cellKey(actor)) && actorMatchesQuery(actor, source, options))
    .map(actor => actor.id);
}

function actorIdsInRange(scene, sourceActorId, range, options = {}) {
  const source = actorById(scene, sourceActorId);
  const maximum = Number(range);
  if (!source || Number.isNaN(maximum) || maximum < 0) return [];
  return (scene?.actors || [])
    .filter(actor => distance(source, actor) <= maximum && actorMatchesQuery(actor, source, options))
    .map(actor => actor.id);
}

function targetStatus(scene, request = {}) {
  const source = actorById(scene, request.sourceActorId);
  const requested = [...new Set((Array.isArray(request.targetIds) ? request.targetIds : []).filter(id => typeof id === "string"))];
  const rawMinimum = Number(request.min ?? 1), rawMaximum = Number(request.max ?? 40);
  if (!Number.isFinite(rawMinimum) || !Number.isFinite(rawMaximum) || rawMinimum < 0 || rawMaximum < rawMinimum) return { available: false, reason: "Некорректные ограничения целей.", targetIds: [], invalidIds: requested };
  const minimum = Math.floor(rawMinimum), maximum = Math.floor(rawMaximum);
  if (!source) return { available: false, reason: "Исполнитель не найден.", targetIds: [], invalidIds: requested };
  const valid = new Set(actorIdsInRange(scene, source.id, request.range ?? Infinity, {
    audience: request.audience || "any",
    team: request.team,
    includeSelf: Boolean(request.includeSelf),
    includeKnockedOut: Boolean(request.includeKnockedOut),
    excludeIds: request.excludeIds,
  }));
  const invalidIds = requested.filter(id => !valid.has(id));
  if (invalidIds.length) return { available: false, reason: "Среди целей есть недоступные персонажи.", targetIds: requested.filter(id => valid.has(id)), invalidIds };
  if (requested.length < minimum) return { available: false, reason: `Нужно выбрать целей: минимум ${minimum}.`, targetIds: requested, invalidIds: [] };
  if (requested.length > maximum) return { available: false, reason: `Можно выбрать целей: максимум ${maximum}.`, targetIds: requested.slice(0, maximum), invalidIds: requested.slice(maximum) };
  return { available: true, reason: "", targetIds: requested, invalidIds: [] };
}

function resourceStatus(scene, actorId, costs = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", costs: {}, missing: {} };
  if (!costs || typeof costs !== "object" || Array.isArray(costs)) return { available: false, reason: "Некорректная стоимость действия.", costs: {}, missing: {} };
  const normalized = {}, missing = {};
  for (const [resource, rawAmount] of Object.entries(costs || {})) {
    const amount = Number(rawAmount);
    if (!RESOURCES.has(resource) || !Number.isFinite(amount) || amount < 0) return { available: false, reason: "Некорректная стоимость действия.", costs: {}, missing: {} };
    normalized[resource] = amount;
    const shortage = Math.max(0, amount - Number(actor[resource] || 0));
    if (shortage) missing[resource] = shortage;
  }
  const available = !Object.keys(missing).length;
  return { available, reason: available ? "" : "Недостаточно ресурсов.", costs: normalized, missing };
}

function effectStatus(scene, actorId, effect) {
  const actor = actorById(scene, actorId);
  if (!actor || typeof effect !== "string") return { active: false, direct: false, ambient: false };
  const direct = (actor.effects || []).includes(effect);
  const active = effectiveEffectsFor(scene, actor).includes(effect);
  return { active, direct, ambient: active && !direct };
}

function summarizeEvents(scene, events = []) {
  const list = Array.isArray(events) ? events : [];
  const eventTypes = {}, resourceDelta = {}, sourceIds = new Set(), targetIds = new Set(), affectedCells = new Set();
  for (const event of list) {
    eventTypes[event.type] = Number(eventTypes[event.type] || 0) + 1;
    const participants = eventParticipants(scene, event);
    participants.sourceIds.forEach(id => sourceIds.add(id));
    participants.targetIds.forEach(id => targetIds.add(id));
    const payload = event.payload || {};
    if (["resource.gain", "resource.spend"].includes(event.type) && event.actorId && RESOURCES.has(payload.resource)) {
      resourceDelta[event.actorId] ||= {};
      const sign = event.type === "resource.gain" ? 1 : -1;
      resourceDelta[event.actorId][payload.resource] = Number(resourceDelta[event.actorId][payload.resource] || 0) + sign * Number(payload.amount || 0);
    }
    [payload.cells, payload.targetCells, payload.affectedCells].filter(Array.isArray).flat().forEach(cell => affectedCells.add(String(cell)));
  }
  return { count: list.length, eventTypes, sourceIds: [...sourceIds], targetIds: [...targetIds], resourceDelta, affectedCells: [...affectedCells] };
}
