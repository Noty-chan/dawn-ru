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
    .filter(actor => options.ignoreEffectTargeting || effectTargetingStatus(scene, source?.id, actor.id, options).available)
    .map(actor => actor.id);
}

function actorIdsInRange(scene, sourceActorId, range, options = {}) {
  const source = actorById(scene, sourceActorId);
  const maximum = Number(range);
  if (!source || Number.isNaN(maximum) || maximum < 0) return [];
  return (scene?.actors || [])
    .filter(actor => distance(source, actor) <= maximum && actorMatchesQuery(actor, source, options))
    .filter(actor => options.ignoreEffectTargeting || effectTargetingStatus(scene, source.id, actor.id, options).available)
    .map(actor => actor.id);
}

const spatialPoint = value => {
  if (typeof value === "string") {
    const match = value.match(/^(\d{1,2}),(\d{1,2})$/);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
  }
  return value && Number.isInteger(Number(value.x)) && Number.isInteger(Number(value.y)) ? { x: Number(value.x), y: Number(value.y) } : null;
};
const spatialLine = (start, end) => {
  let x0 = start.x, y0 = start.y;
  const cells = [], dx = Math.abs(end.x - x0), sx = x0 < end.x ? 1 : -1, dy = -Math.abs(end.y - y0), sy = y0 < end.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    cells.push(`${x0},${y0}`);
    if (x0 === end.x && y0 === end.y) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x0 += sx; }
    if (doubled <= dx) { error += dx; y0 += sy; }
  }
  return cells;
};
function spatialShapeStatus(scene, request = {}) {
  const space = (scene?.spaces || []).find(item => item.id === request.space), anchor = spatialPoint(request.anchor), shape = request.shape || "cell";
  if (!space) return { available: false, reason: "Пространство не найдено.", cells: [], targetIds: [] };
  const inBounds = point => point && point.x >= 0 && point.y >= 0 && point.x < Number(space.width) && point.y < Number(space.height);
  const cells = new Set(), add = point => { if (inBounds(point)) cells.add(cellKey(point)); };
  const legacySquares = { square2: [2, 2], square3: [3, 3], square5: [5, 5] };
  const legacyLines = { lineH: "horizontal", lineV: "vertical", lineDiagDown: "diagonal-down", lineDiagUp: "diagonal-up" };
  let reason = "";
  if (shape === "connected") {
    const chosen = [...new Set((request.cells || []).map(String))], chosenSet = new Set(chosen), points = chosen.map(spatialPoint);
    if (!chosen.length || points.some(point => !inBounds(point))) reason = "Связная фигура содержит некорректные клетки.";
    else {
      const diagonal = Boolean(request.diagonal), queue = [points[0]], visited = new Set([cellKey(points[0])]);
      while (queue.length) {
        const point = queue.shift();
        for (const other of points) {
          const dx = Math.abs(point.x - other.x), dy = Math.abs(point.y - other.y), adjacent = diagonal ? Math.max(dx, dy) === 1 : dx + dy === 1, key = cellKey(other);
          if (adjacent && chosenSet.has(key) && !visited.has(key)) { visited.add(key); queue.push(other); }
        }
      }
      if (visited.size !== chosen.length) reason = "Выбранные клетки должны образовывать одну связную фигуру.";
      else chosen.forEach(cell => cells.add(cell));
    }
  } else if (shape === "polygon") {
    const vertices = (request.vertices || []).map(spatialPoint);
    if (vertices.length < 3 || vertices.some(point => !inBounds(point))) reason = "Многоугольнику нужны минимум три корректные вершины.";
    else {
      for (let index = 0; index < vertices.length; index += 1) spatialLine(vertices[index], vertices[(index + 1) % vertices.length]).forEach(cell => cells.add(cell));
      for (let y = 0; y < space.height; y += 1) for (let x = 0; x < space.width; x += 1) {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
          const a = vertices[i], b = vertices[j], px = x + .5, py = y + .5;
          if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        if (inside) add({ x, y });
      }
    }
  } else if (!inBounds(anchor)) reason = "Нужна опорная клетка внутри поля.";
  else if (shape === "adjacent") {
    const diagonal = Boolean(request.diagonal);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((diagonal ? Math.max(Math.abs(dx), Math.abs(dy)) === 1 : Math.abs(dx) + Math.abs(dy) === 1)) add({ x: anchor.x + dx, y: anchor.y + dy });
    if (request.includeAnchor) add(anchor);
  } else if (shape === "radius" || shape === "radius2") {
    const radius = Math.max(0, Math.floor(Number(shape === "radius2" ? 2 : request.radius || 0))), metric = request.metric === "chebyshev" ? "chebyshev" : "manhattan";
    for (let y = 0; y < space.height; y += 1) for (let x = 0; x < space.width; x += 1) if ((metric === "chebyshev" ? Math.max(Math.abs(x - anchor.x), Math.abs(y - anchor.y)) : Math.abs(x - anchor.x) + Math.abs(y - anchor.y)) <= radius) add({ x, y });
  } else if (shape === "square" || legacySquares[shape]) {
    const [width, height] = legacySquares[shape] || [Math.floor(Number(request.width || 1)), Math.floor(Number(request.height || request.width || 1))];
    if (width < 1 || height < 1 || width > space.width || height > space.height) reason = "Некорректный размер зоны.";
    else {
      const startX = request.origin === "top-left" || width % 2 === 0 ? anchor.x : anchor.x - Math.floor(width / 2), startY = request.origin === "top-left" || height % 2 === 0 ? anchor.y : anchor.y - Math.floor(height / 2);
      for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) add({ x: startX + dx, y: startY + dy });
    }
  } else if (shape === "line" || legacyLines[shape]) {
    const orientation = legacyLines[shape] || request.orientation || "horizontal", vectors = { horizontal: [1, 0], vertical: [0, 1], "diagonal-down": [1, 1], "diagonal-up": [1, -1] }, vector = vectors[orientation];
    if (!vector) reason = "Некорректное направление линии.";
    else if (request.full || legacyLines[shape]) {
      const maximum = Math.max(space.width, space.height);
      for (let offset = -maximum; offset <= maximum; offset += 1) add({ x: anchor.x + vector[0] * offset, y: anchor.y + vector[1] * offset });
    } else {
      const length = Math.max(1, Math.floor(Number(request.length || 1))), before = request.centered ? Math.floor((length - 1) / 2) : 0;
      for (let index = -before; index < length - before; index += 1) add({ x: anchor.x + vector[0] * index, y: anchor.y + vector[1] * index });
    }
  } else if (shape === "cell") add(anchor);
  else reason = "Неизвестная форма области.";
  const resultCells = [...cells], targetIds = reason ? [] : actorIdsInCells(scene, space.id, resultCells, request.targets || {});
  return { available: !reason && resultCells.length > 0, reason: reason || (resultCells.length ? "" : "Форма не содержит клеток поля."), space, shape, cells: resultCells, targetIds };
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
  const normalized = {}, missing = {}, requiredByResolvedResource = {};
  for (const [resource, rawAmount] of Object.entries(costs || {})) {
    const amount = Number(rawAmount);
    if (!RESOURCES.has(resource) || !Number.isFinite(amount) || amount < 0) return { available: false, reason: "Некорректная стоимость действия.", costs: {}, missing: {} };
    normalized[resource] = amount;
    const status = resourceOperationStatus(scene, actorId, { resource, amount, operation: "spend" });
    if (!status.available && !status.replacement) missing[resource] = Math.max(0, amount - Number(actor[resource] || 0));
    if (status.replacement && status.delta < 0) requiredByResolvedResource[status.resolvedResource] = Number(requiredByResolvedResource[status.resolvedResource] || 0) - status.delta;
  }
  for (const [resource, required] of Object.entries(requiredByResolvedResource)) {
    const definition = ruleResourceDefinition(actor, resource), balance = ruleResourceBalance(actor, definition);
    const shortage = Math.max(0, required - (balance - definition.minimum));
    if (shortage) missing[resource] = shortage;
  }
  const available = !Object.keys(missing).length;
  return { available, reason: available ? "" : "Недостаточно ресурсов.", costs: normalized, missing };
}

function effectStatus(scene, actorId, effect) {
  const actor = actorById(scene, actorId);
  if (!actor || typeof effect !== "string") return { active: false, direct: false, ambient: false, state: null, sourceActorIds: [], expiresAt: "" };
  const direct = (actor.effects || []).includes(effect);
  const active = effectiveEffectsFor(scene, actor).includes(effect);
  const state = direct ? effectStateFor(actor, effect) : null, definition = effectLifecycleDefinition(effect), duration = state?.duration || definition.duration;
  const expiresAt = duration === "default" ? "в конце собственного Хода, кроме Хода применения"
    : duration === "startTurn" ? "в начале собственного Хода"
      : duration === "actionOrStartTurn" ? "при действии или в начале собственного Хода"
        : duration === "roundEnd" ? "в конце Раунда"
          : duration === "scene" ? "в конце Сцены"
            : "только по правилу снятия";
  return { active, direct, ambient: active && !direct, state, duration, removable: state?.removable !== false, sourceActorIds: state?.sources.map(source => source.actorId) || [], expiresAt };
}

function effectExpiryStatus(scene, actorId, effect, boundary = {}) {
  const status = effectStatus(scene, actorId, effect), eventType = boundary.type || boundary.eventType || "", boundaryActorId = boundary.actorId || null;
  if (!status.direct) return { ...status, expires: false, reason: "Эффект не наложен непосредственно." };
  let expires = false, reason = "";
  if (status.duration === "default" && eventType === "turn.end" && boundaryActorId === actorId) {
    const boundaryTurnSerial = boundary.turnSerial == null ? Number(scene.turnSerial || 0) : Number(boundary.turnSerial);
    expires = status.state?.appliedTurnSerial == null || Number(status.state.appliedTurnSerial) !== boundaryTurnSerial;
    reason = expires ? "Закончился собственный Ход после Хода применения." : "Эффект применён в этом Ходу и пока сохраняется.";
  } else if (status.duration === "startTurn" && eventType === "turn.start" && boundaryActorId === actorId) {
    expires = true;
    reason = "Наступило начало собственного Хода.";
  } else if (status.duration === "actionOrStartTurn" && ((eventType === "turn.start" && boundaryActorId === actorId) || (["action.prepare", "enemy.action.prepare"].includes(eventType) && boundaryActorId === actorId))) {
    expires = true;
    reason = eventType === "turn.start" ? "Наступило начало собственного Хода." : "Персонаж начал выполнять Действие.";
  } else if (status.duration === "roundEnd" && eventType === "round.end") {
    expires = true;
    reason = "Закончился Раунд.";
  } else reason = status.duration === "persistent" || status.duration === "scene" ? "Автоматическое истечение не предусмотрено." : "Эта граница не снимает Эффект.";
  return { ...status, expires, reason };
}

function effectPresenceStatus(scene, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Участник не найден.", actor: null, onField: false, disappeared: false, banished: false };
  const disappeared = hasEffect(scene, actor, "positive.исчез"), banished = hasEffect(scene, actor, "positive.изгнан");
  return {
    available: !actor.knockedOut && !disappeared,
    reason: actor.knockedOut ? "Участник выведен из боя." : disappeared ? "Участник Исчез и сейчас не находится на поле." : "",
    actor,
    onField: !disappeared,
    disappeared,
    banished,
  };
}

function effectTargetingStatus(scene, sourceActorId, targetActorId, options = {}) {
  const source = sourceActorId ? actorById(scene, sourceActorId) : null, target = actorById(scene, targetActorId);
  if (!target) return { available: false, reason: "Цель не найдена.", source, target: null };
  const targetPresence = effectPresenceStatus(scene, target.id);
  if (targetPresence.disappeared && !options.includeDisappeared) return { available: false, reason: "Исчезнувший персонаж не может быть целью.", source, target };
  if (!source) return { available: true, reason: "", source: null, target };
  const sourcePresence = effectPresenceStatus(scene, source.id);
  if (sourcePresence.disappeared && !options.sourceReappearing) return { available: false, reason: "Исчезнувший персонаж сначала должен появиться.", source, target };
  if (!options.ignoreBanished && sourcePresence.banished !== targetPresence.banished) {
    return { available: false, reason: sourcePresence.banished ? "Изгнанный персонаж может выбирать целью только Изгнанных." : "Неизгнанный персонаж не может выбирать целью Изгнанного.", source, target };
  }
  return { available: true, reason: "", source, target };
}

function effectMovementStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Перемещаемый персонаж не найден.", actor: null, multiplier: 1, distance: 0, blockers: [] };
  const forced = Boolean(request.forced), placement = Boolean(request.placement), blockers = [];
  if (!placement && forced && hasEffect(scene, actor, "positive.устойчив") && !request.ignoreResistance) blockers.push("Устойчив");
  if (!placement && !forced && !request.ignoreVoluntaryRestrictions) {
    if (hasEffect(scene, actor, "negative.обездвижен")) blockers.push("Обездвижен");
    if (hasEffect(scene, actor, "negative.подброшен")) blockers.push("Подброшен");
    if (hasEffect(scene, actor, "negative.пойман")) blockers.push("Пойман");
  }
  const accelerated = hasEffect(scene, actor, "positive.ускорен"), slowed = hasEffect(scene, actor, "negative.замедлен");
  const multiplier = accelerated === slowed ? 1 : accelerated ? 2 : .5;
  const baseDistance = Math.max(0, Number(request.distance ?? request.maximum ?? 0));
  const adjustedDistance = multiplier < 1 ? Math.floor(baseDistance * multiplier) : baseDistance * multiplier;
  const reason = forced && blockers.includes("Устойчив")
    ? "Устойчивого персонажа нельзя перемещать против воли."
    : blockers.length ? `${blockers.join(", ")} запрещает добровольное перемещение.` : "";
  return { available: !blockers.length, reason, actor, forced, placement, multiplier, distance: adjustedDistance, blockers };
}

function effectCellOccupancyStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), space = request.space || actor?.space, x = Number(request.x), y = Number(request.y);
  if (!actor || !space || !Number.isInteger(x) || !Number.isInteger(y)) return { available: false, reason: "Некорректная клетка назначения.", actor, blockers: [] };
  const banished = hasEffect(scene, actor, "positive.изгнан");
  const blockers = (scene.actors || []).filter(other => other.id !== actor.id && other.space === space && Number(other.x) === x && Number(other.y) === y)
    .filter(other => effectPresenceStatus(scene, other.id).onField)
    .filter(other => !banished && !hasEffect(scene, other, "positive.изгнан"));
  return { available: blockers.length === 0, reason: blockers.length ? "Клетка назначения уже занята." : "", actor, blockers };
}

function effectAttackStatus(scene, sourceActorId, targetIds = []) {
  const source = actorById(scene, sourceActorId), targets = [...new Set(targetIds || [])].map(id => actorById(scene, id)).filter(Boolean);
  if (!source) return { available: false, reason: "Атакующий не найден.", source: null, targets, damageModifier: 0, damageByTarget: {}, hindrance: 0, hindranceEffects: [] };
  const tier = Number(source.tier || 1);
  const damageModifier = (hasEffect(scene, source, "positive.усилен") ? tier : 0) - (hasEffect(scene, source, "negative.ослаблен") ? tier : 0);
  const damageByTarget = Object.fromEntries(targets.map(target => [target.id, hasEffect(scene, target, "negative.помечен") ? tier : 0]));
  const targetSet = new Set(targets.map(target => target.id)), hindranceEffects = [];
  const frightened = effectStateFor(source, "negative.испуган");
  if (frightened?.sources.some(item => targetSet.has(item.actorId))) hindranceEffects.push("Испуган");
  const taunted = effectStateFor(source, "negative.спровоцирован");
  if (taunted?.sources.length && !taunted.sources.some(item => targetSet.has(item.actorId))) hindranceEffects.push("Спровоцирован");
  return { available: true, reason: "", source, targets, damageModifier, damageByTarget, hindrance: hindranceEffects.length * tier, hindranceEffects };
}

function effectDefenseStatus(scene, targetActorId) {
  const target = actorById(scene, targetActorId);
  if (!target) return { available: false, reason: "Защищающийся не найден.", target: null, armorAllowed: false, armorBonus: 0, dodgeAllowed: false, dodgeReason: "" };
  const armorAllowed = !hasEffect(scene, target, "negative.разорван");
  const armorBonus = armorAllowed && hasEffect(scene, target, "positive.укреплен") ? Number(target.tier || 1) : 0;
  const dodgeBlockers = [
    hasEffect(scene, target, "negative.обездвижен") && "Обездвижен",
    hasEffect(scene, target, "negative.пойман") && "Пойман",
    hasEffect(scene, target, "negative.подброшен") && "Подброшен",
  ].filter(Boolean);
  return {
    available: true,
    reason: "",
    target,
    armorAllowed,
    armorBonus,
    dodgeAllowed: dodgeBlockers.length === 0,
    dodgeReason: dodgeBlockers.length ? `${dodgeBlockers.join(", ")} не позволяет получить преимущество Уворота.` : "",
  };
}

function attackModifierStatus(scene, sourceActorId, targetIds = [], selectedIds = [], request = {}) {
  const source = actorById(scene, sourceActorId), targets = [...new Set(targetIds || [])].map(id => actorById(scene, id)).filter(Boolean), actionName = String(request.actionName || "");
  if (!source) return { available: false, reason: "Атакующий не найден.", source: null, targets, options: [], selectedOptions: [], selectedIds: [], invalidIds: [], advantage: 0, requiresDestination: false, attributeOverride: null, actionTransform: null };
  const launchedTargets = targets.filter(target => !target.knockedOut && hasEffect(scene, target, "negative.подброшен")), options = launchedTargets.map(target => ({
    id: `core.launch-spike:${target.id}`,
    kind: "effect-consume",
    timing: "before-roll",
    targetId: target.id,
    exclusiveGroup: `launch-spike:${target.id}`,
    label: `Вбить: ${target.name}`,
    description: `Снять «Подброшен» и получить ${Number(source.tier || 1)} Преимущества.`,
    advantage: Number(source.tier || 1),
    removeEffect: "negative.подброшен",
  }));
  if (Number(source.techniques?.["bulwark.grappler"] || 0) >= 2 && targets.length === 1 && launchedTargets.length === 1 && (!actionName || actionName === "Стычка")) {
    const target = launchedTargets[0];
    options.push({
      id: `bulwark.grappler.2:${target.id}`,
      kind: "attack-transform",
      timing: "before-roll",
      targetId: target.id,
      exclusiveGroup: `launch-spike:${target.id}`,
      label: `Перелом позвоночника: ${target.name}`,
      description: `Вбить, телепортироваться смежно и заменить Стычку на Завершение Телом без доплаты.`,
      advantage: Number(source.tier || 1),
      removeEffect: "negative.подброшен",
      requiresActionName: "Стычка",
      requiresDestination: true,
      destinationKind: "adjacent-target",
      attributeOverride: "body",
      actionTransform: { actionName: "Завершение", attribute: "body", costActionName: "Стычка", ruleId: "bulwark.grappler.2" },
      ruleId: "bulwark.grappler.2",
    });
  }
  if (Number(source.techniques?.["vagabond.dim-mak"] || 0) >= 1 && targets.length === 1 && (!actionName || ["Стычка", "Заклинание", "Завершение"].includes(actionName))) {
    const target = targets[0];
    const weakPoints = (scene.markers || []).filter(marker =>
      marker.ruleId === "vagabond.dim-mak.1"
      && marker.ownerActorId === source.id
      && marker.metadata?.carrierActorId === target.id
      && marker.space === source.space
      && Number(marker.x) === Number(source.x)
      && Number(marker.y) === Number(source.y)
    );
    weakPoints.forEach(marker => options.push({
      id: `vagabond.dim-mak.1:${marker.id}`,
      kind: "marker-consume",
      timing: "before-roll",
      targetId: target.id,
      exclusiveGroup: `dim-mak:${target.id}`,
      label: `Слабая точка: ${target.name}`,
      description: "Убрать Слабую точку, бросить Атаку Разумом и сделать её Быстрой.",
      advantage: 0,
      removeMarkerId: marker.id,
      attributeOverride: "mind",
      quick: true,
      ruleId: "vagabond.dim-mak.1",
    }));
  }
  const optionById = new Map(options.map(option => [option.id, option])), requested = [...new Set(selectedIds || [])], invalidIds = requested.filter(id => !optionById.has(id)), selected = requested.map(id => optionById.get(id)).filter(Boolean);
  const duplicateGroup = selected.map(option => option.exclusiveGroup).filter(Boolean).find((group, index, groups) => groups.indexOf(group) !== index);
  const transformOptions = selected.filter(option => option.actionTransform), destinationOptions = selected.filter(option => option.requiresDestination);
  const reason = invalidIds.length ? "Выбранный модификатор Атаки больше недоступен."
    : duplicateGroup ? "Нельзя дважды потратить один и тот же Эффект на модификаторы Атаки."
      : transformOptions.length > 1 ? "Одна Атака не может получить две замены базового действия."
        : destinationOptions.length > 1 ? "Одна Атака не может требовать две разные клетки модификатора."
          : "";
  return {
    available: !reason,
    reason,
    source,
    targets,
    options,
    selectedOptions: selected.map(clone),
    selectedIds: selected.map(option => option.id),
    invalidIds,
    advantage: selected.reduce((sum, option) => sum + Number(option.advantage || 0), 0),
    requiresDestination: destinationOptions.length === 1,
    destinationOption: destinationOptions[0] ? clone(destinationOptions[0]) : null,
    attributeOverride: selected.find(option => option.attributeOverride)?.attributeOverride || null,
    quick: selected.some(option => option.quick),
    actionTransform: transformOptions[0]?.actionTransform ? clone(transformOptions[0].actionTransform) : null,
  };
}

function attackModifierDestinationStatus(scene, sourceActorId, targetIds = [], selectedIds = [], destination = null, request = {}) {
  const modifiers = attackModifierStatus(scene, sourceActorId, targetIds, selectedIds, request), source = modifiers.source, option = modifiers.destinationOption, target = option ? actorById(scene, option.targetId) : null;
  let reason = modifiers.reason;
  const point = destination && { x: Number(destination.x), y: Number(destination.y) }, space = (scene.spaces || []).find(item => item.id === source?.space);
  const origin = request.origin && { x: Number(request.origin.x), y: Number(request.origin.y) };
  if (!reason && !option) reason = "Выбранные модификаторы Атаки не требуют клетки.";
  else if (!reason && !target) reason = "Цель модификатора больше не находится на Сцене.";
  else if (!reason && (!point || !Number.isInteger(point.x) || !Number.isInteger(point.y) || !space || point.x < 0 || point.y < 0 || point.x >= Number(space.width || 0) || point.y >= Number(space.height || 0))) reason = "Выберите клетку модификатора в пределах поля.";
  else if (!reason && target.space !== source.space) reason = "Цель модификатора находится в другом пространстве.";
  else if (!reason && distance(target, { ...point, space: source.space }) !== 1) reason = "Клетка телепортации должна быть смежна с целью.";
  else if (!reason && ((origin && origin.x === point.x && origin.y === point.y) || effectPresenceStatus(scene, source.id).onField && Number(source.x) === point.x && Number(source.y) === point.y)) reason = "Телепортация должна завершиться в другой незанятой клетке.";
  else if (!reason && !effectCellOccupancyStatus(scene, source.id, { space: source.space, x: point.x, y: point.y }).available) reason = "Клетка телепортации занята.";
  return { available: !reason, reason, source, target, destination: point, option, modifiers };
}

function actionPlanStatus(scene, actorId = null) {
  const plan = scene?.pendingActionPlan;
  if (!plan) return { available: false, reason: "Нет подготовленного составного действия.", plan: null, actor: null };
  const actor = actorById(scene, plan.actorId);
  let reason = "";
  if (!actor) reason = "Исполнитель составного действия больше не находится на Сцене.";
  else if (actor.knockedOut) reason = "Исполнитель составного действия выведен из боя.";
  else if (scene.activeActorId !== actor.id) reason = "Ход исполнителя составного действия уже закончился.";
  else if (actorId && actor.id !== actorId) reason = "Это составное действие принадлежит другому персонажу.";
  return { available: !reason, reason, plan: clone(plan), actor };
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
      const resource = payload.resolvedResource || payload.resource, delta = Number.isFinite(Number(payload.resolvedDelta)) ? Number(payload.resolvedDelta) : (event.type === "resource.gain" ? 1 : -1) * Number(payload.amount || 0);
      resourceDelta[event.actorId][resource] = Number(resourceDelta[event.actorId][resource] || 0) + delta;
    }
    if (["rule-resource.gain", "rule-resource.spend", "rule-resource.set", "rule-resource.reset"].includes(event.type) && event.actorId && typeof payload.resource === "string") {
      resourceDelta[event.actorId] ||= {};
      const delta = Number.isFinite(Number(payload.resolvedDelta)) ? Number(payload.resolvedDelta) : event.type === "rule-resource.gain" ? Number(payload.amount || 0) : event.type === "rule-resource.spend" ? -Number(payload.amount || 0) : 0;
      resourceDelta[event.actorId][payload.resource] = Number(resourceDelta[event.actorId][payload.resource] || 0) + delta;
    }
    [payload.cells, payload.targetCells, payload.affectedCells].filter(Array.isArray).flat().forEach(cell => affectedCells.add(String(cell)));
  }
  return { count: list.length, eventTypes, sourceIds: [...sourceIds], targetIds: [...targetIds], resourceDelta, affectedCells: [...affectedCells] };
}

function movementTraceStatus(scene, request = {}) {
  const space = request.space || scene.activeSpace, traces = [];
  for (const actor of scene.actors || []) {
    if (actor.space !== space) continue;
    const event = (scene.log || []).find(item => item.type === "actor.move" && item.actorId === actor.id && item.payload?.from && (item.payload.space || item.payload.from.space) === space);
    if (!event) continue;
    const payload = event.payload || {}, from = payload.from;
    if (Number(payload.x) !== Number(actor.x) || Number(payload.y) !== Number(actor.y) || from.space !== space) continue;
    const teleport = Boolean(payload.topologyCrossings?.length) || /телепорт|появлен|ликвидац|скачок|reappear/i.test(String(payload.movement || ""));
    const path = teleport ? [] : (payload.path || []).map(key => {
      const [x, y] = String(key).split(",").map(Number);
      return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
    }).filter(Boolean);
    const points = [{ x: Number(from.x), y: Number(from.y) }, ...path, { x: Number(payload.x), y: Number(payload.y) }].filter((point, index, values) => index === 0 || point.x !== values[index - 1].x || point.y !== values[index - 1].y);
    if (points.length < 2) continue;
    const forced = Boolean(payload.forced || payload.displacement), jump = !teleport && /прыж|jump/i.test(String(payload.movement || ""));
    const kind = teleport ? "teleport" : forced ? "forced" : jump ? "jump" : "step";
    const parts = points.slice(1).map((point, index) => ({ index: index + 1, from: clone(points[index]), destination: clone(point) }));
    traces.push({ actorId: actor.id, movement: payload.movement || "Перемещение", kind, teleport, forced, from: points[0], destination: points.at(-1), points, parts, topologyCrossings: clone(payload.topologyCrossings || []), eventId: event.id });
  }
  return { available: traces.length > 0, reason: traces.length ? "" : "На поле ещё нет зафиксированных перемещений.", space, traces };
}
