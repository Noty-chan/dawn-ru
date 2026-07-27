"use strict";

function clockStatus(scene, actorId, clockId, options = {}) {
  const actor = actorById(scene, actorId), size = Number(options.size ?? 6), initial = Number(options.initial ?? 0), delta = Number(options.delta ?? 0);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", id: clockId || "", size: 0, value: 0, nextValue: 0, remaining: 0, empty: true, full: false };
  if (typeof clockId !== "string" || !clockId || !Number.isInteger(size) || size < 1 || size > 24 || !Number.isFinite(initial) || !Number.isFinite(delta)) return { available: false, reason: "Некорректные параметры часов.", id: String(clockId || ""), size: 0, value: 0, nextValue: 0, remaining: 0, empty: true, full: false };
  const stored = Number(actor.ruleClocks?.[clockId] ?? initial), value = Math.max(0, Math.min(size, Number.isFinite(stored) ? stored : initial));
  const nextValue = Math.max(0, Math.min(size, value + delta));
  return { available: true, reason: "", id: clockId, size, value, nextValue, remaining: size - nextValue, empty: nextValue === 0, full: nextValue === size };
}

function alternateResourceStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), resource = request.resource, amount = Number(request.amount ?? 0), initial = Number(request.initial ?? 0);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", resource: String(resource || ""), balance: 0, amount: 0, remaining: 0, replaces: [] };
  if (typeof resource !== "string" || !resource || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(initial) || initial < 0) return { available: false, reason: "Некорректный альтернативный ресурс.", resource: String(resource || ""), balance: 0, amount: 0, remaining: 0, replaces: [] };
  const stored = actor.alternateResources?.[resource] ?? actor[resource] ?? actor.inventory?.[`resource:${resource}`] ?? initial;
  const balance = Math.max(0, Number(stored) || 0), available = balance >= amount;
  return { available, reason: available ? "" : `Недостаточно ресурса «${request.label || resource}».`, resource, label: request.label || resource, balance, amount, remaining: Math.max(0, balance - amount), replaces: [...new Set((Array.isArray(request.replaces) ? request.replaces : []).filter(value => typeof value === "string"))] };
}

function stanceStatus(scene, actorId, stanceId, options = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", stanceId: String(stanceId || ""), active: false, current: null, conflicts: [] };
  if (typeof stanceId !== "string" || !stanceId) return { available: false, reason: "Не указана Стойка.", stanceId: "", active: false, current: null, conflicts: [] };
  const current = actor.ruleState?.stance || actor.stance || null;
  const requiredEffects = (Array.isArray(options.requiredEffects) ? options.requiredEffects : []).filter(value => typeof value === "string");
  const missingEffects = requiredEffects.filter(effect => !effectiveEffectsFor(scene, actor).includes(effect));
  const available = !actor.knockedOut && !missingEffects.length;
  return { available, reason: actor.knockedOut ? "Выведенный из строя персонаж не может менять Стойку." : missingEffects.length ? `Не хватает Эффектов: ${missingEffects.join(", ")}.` : "", stanceId, active: current === stanceId, current, conflicts: current && current !== stanceId ? [current] : [], missingEffects };
}

function ownedEntities(scene, ownerActorId, options = {}) {
  const owner = actorById(scene, ownerActorId);
  if (!owner) return { available: false, reason: "Владелец не найден.", actors: [], objects: [], markers: [], allIds: [], count: 0 };
  const rulePrefix = typeof options.rulePrefix === "string" ? options.rulePrefix : "", kinds = new Set(Array.isArray(options.kinds) ? options.kinds : []);
  const matches = entity => entity.ownerActorId === ownerActorId && (!rulePrefix || String(entity.ruleId || entity.source || "").startsWith(rulePrefix)) && (!kinds.size || kinds.has(entity.kind || entity.type));
  const actors = (scene.actors || []).filter(actor => actor.id !== ownerActorId && matches(actor)).map(actor => actor.id);
  const objects = (scene.objects || []).filter(matches).map(object => object.id);
  const markers = (scene.markers || []).filter(matches).map(marker => marker.id);
  return { available: true, reason: "", actors, objects, markers, allIds: [...actors, ...objects, ...markers], count: actors.length + objects.length + markers.length };
}

function actionHistoryStatus(scene, actorId, query = {}) {
  if (!actorById(scene, actorId)) return { available: false, reason: "Исполнитель не найден.", count: 0, matched: false, lastEvent: null, targetIds: [] };
  const scope = ["turn", "round", "scene"].includes(query.scope) ? query.scope : "turn";
  const source = scope === "turn" ? currentTurnEvents(scene, actorId) : scope === "round" ? currentRoundEvents(scene) : (scene.log || []);
  const types = new Set(Array.isArray(query.types) ? query.types : ["action.prepare", "action.resolve"]);
  const actionNames = new Set(Array.isArray(query.actionNames) ? query.actionNames : []);
  const actionIds = new Set(Array.isArray(query.actionIds) ? query.actionIds : []);
  const requestedTargets = [...new Set((Array.isArray(query.targetIds) ? query.targetIds : []).filter(value => typeof value === "string"))];
  const events = source.filter(event => {
    if (event.actorId !== actorId || (types.size && !types.has(event.type))) return false;
    const payload = event.payload || {};
    if (actionNames.size && !actionNames.has(payload.actionName || payload.name)) return false;
    if (actionIds.size && !actionIds.has(payload.actionId)) return false;
    if (requestedTargets.length) {
      const eventTargets = new Set([payload.targetId, ...(Array.isArray(payload.targetIds) ? payload.targetIds : [])].filter(Boolean));
      if (!requestedTargets.every(id => eventTargets.has(id))) return false;
    }
    return true;
  });
  const lastEvent = events[0] ? clone(events[0]) : null;
  return { available: true, reason: "", scope, count: events.length, matched: Boolean(events.length), lastEvent, targetIds: requestedTargets };
}

function terrainStatus(scene, request = {}) {
  const actor = actorById(scene, request.actorId), types = new Set(Array.isArray(request.types) ? request.types : ["terrain", "difficult", "custom"]);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", object: null, distance: Infinity, cells: [] };
  const point = request.cell && typeof request.cell === "object" ? cellKey(request.cell) : typeof request.cell === "string" ? request.cell : null;
  const candidates = (scene.objects || []).filter(object => object.space === actor.space && (!types.size || types.has(object.type)) && (!request.ownerOnly || object.ownerActorId === actor.id));
  const object = request.objectId ? candidates.find(item => item.id === request.objectId) : point ? [...candidates].reverse().find(item => (item.cells || []).includes(point)) : null;
  if (!object) return { available: false, reason: "Подходящий элемент местности не найден.", object: null, distance: Infinity, cells: [] };
  const distances = (object.cells || []).map(cell => { const [x, y] = String(cell).split(",").map(Number); return Math.abs(Number(actor.x) - x) + Math.abs(Number(actor.y) - y); }).filter(Number.isFinite);
  const nearest = distances.length ? Math.min(...distances) : Infinity, maximum = Number(request.range ?? Infinity), minimumHp = Number(request.minimumHp ?? 0);
  if (Number.isNaN(maximum) || maximum < 0 || !Number.isFinite(minimumHp) || minimumHp < 0) return { available: false, reason: "Некорректные ограничения местности.", object: clone(object), distance: nearest, cells: [...(object.cells || [])] };
  const available = nearest <= maximum && Number(object.hp ?? object.maxHp ?? 1) >= minimumHp;
  return { available, reason: available ? "" : nearest > maximum ? "Местность находится вне допустимой дальности." : "У местности недостаточно Здоровья.", object: clone(object), distance: nearest, cells: [...(object.cells || [])] };
}
