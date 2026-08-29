"use strict";

function pushDestination(scene, target, source, maximum = 1) {
  const space = (scene.spaces || []).find(item => item.id === target?.space);
  if (!space || !target || !source || target.space !== source.space) return { x: target?.x, y: target?.y, distance: 0 };
  if (actorById(scene, target.id)) {
    const status = displacementStatus(scene, { actorId: target.id, mode: "push", source, maximum, allowPartial: true });
    return status.available ? { ...status.destination, distance: status.distance, direction: status.direction, path: status.path, topologyCrossings: status.topologyCrossings } : { x: target.x, y: target.y, distance: 0, direction: null, path: [], topologyCrossings: [] };
  }
  const dx = Math.sign(target.x - source.x), dy = Math.sign(target.y - source.y);
  if (!dx && !dy) return { x: target.x, y: target.y, distance: 0 };
  const movingMarker = Boolean(markerById(scene, target.id));
  const occupied = new Set(movingMarker ? [] : (scene.actors || []).filter(item => item.id !== target.id && item.space === target.space && !item.knockedOut).map(cellKey));
  const terrain = new Set((scene.objects || []).filter(object => object.space === target.space && object.type === "terrain").flatMap(object => object.cells || []));
  const removed = removedCellKeys(scene, target.space);
  let x = target.x, y = target.y, moved = 0;
  for (let step = 0; step < Number(maximum || 0); step += 1) {
    const attempted = { x: x + dx, y: y + dy };
    if (wallBlocksStep(scene, target.space, { x, y }, attempted)) break;
    const next = removed.has(cellKey(attempted)) ? topologyStepDestination(scene, { space: target.space, from: { x, y }, attempted }) : attempted, key = next && cellKey(next);
    if (!next || next.x < 0 || next.y < 0 || next.x >= space.width || next.y >= space.height || occupied.has(key) || terrain.has(key) || removed.has(key)) break;
    x = next.x; y = next.y; moved += 1;
  }
  return { x, y, distance: moved };
}
const currentRoundEvents = scene => {
  const events = [];
  for (const event of scene.log || []) {
    if (event.type === "round.end") break;
    events.push(event);
  }
  return events;
};
const closedTurnActorId = event => event?.type === "turn.end" ? event.actorId : event?.payload?.endedTurnActorId || null;
const currentTurnEvents = (scene, actorId) => {
  const events = [];
  for (const event of scene.log || []) {
    if ((event.type === "turn.start" || (event.type === "turn.end" && event.payload?.startedExtraTurn)) && event.actorId === actorId) break;
    events.push(event);
  }
  return events;
};
function turnActionProgressStatus(scene, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Участник не найден.", total: 0, used: 0, remaining: 0, currentAction: 0, readyToEnd: false, labels: [] };
  if (scene.activeActorId !== actor.id) return { available: false, reason: "Сейчас не Ход этого участника.", total: 0, used: 0, remaining: 0, currentAction: 0, readyToEnd: false, labels: [] };
  const events = currentTurnEvents(scene, actor.id), base = Math.max(1, Number(actor.baseAp || (actor.team === "enemy" ? 2 : 3)));
  const spent = events.filter(event => event.actorId === actor.id && event.type === "resource.spend" && event.payload?.resource === "ap" && !event.payload?.ignoredReason).reduce((sum, event) => sum + Math.max(0, Number(event.payload?.amount || 0)), 0);
  const gained = events.filter(event => event.actorId === actor.id && event.type === "resource.gain" && event.payload?.resource === "ap" && !event.payload?.ignoredReason).reduce((sum, event) => sum + Math.max(0, Number(event.payload?.amount || 0)), 0);
  const paidActions = events.filter(event => event.actorId === actor.id && ["action.prepare", "enemy.action.prepare", "technique.prepare"].includes(event.type) && !event.payload?.quick && !event.payload?.continuation).length;
  const total = Math.max(base, base + gained, spent, Number(actor.ap || 0)), fallbackUsed = Math.max(0, total - Math.max(0, Number(actor.ap || 0)));
  const used = Math.min(total, Math.max(spent, fallbackUsed, paidActions)), remaining = Math.max(0, total - used), readyToEnd = remaining === 0 || Number(actor.ap || 0) <= 0;
  return {
    available: true,
    reason: "",
    total,
    used: readyToEnd ? total : used,
    remaining: readyToEnd ? 0 : remaining,
    currentAction: readyToEnd ? 0 : Math.min(total, used + 1),
    readyToEnd,
    labels: ["Ход начат", ...Array.from({ length: total }, (_, index) => `Действие ${index + 1}`), "Завершить Ход"],
  };
}
function movementPath(scene, actorId, destination, options = {}) {
  const actor = actorById(scene, actorId), space = (scene.spaces || []).find(item => item.id === actor?.space);
  if (!actor || !space || !destination || !Number.isInteger(Number(destination.x)) || !Number.isInteger(Number(destination.y))) return [];
  const movement = effectMovementStatus(scene, actorId, { forced: Boolean(options.forced), placement: Boolean(options.placement), ignoreResistance: Boolean(options.ignoreResistance), ignoreVoluntaryRestrictions: Boolean(options.ignoreVoluntaryRestrictions) });
  if (!movement.available) return [];
  const end = { x: Number(destination.x), y: Number(destination.y) }, limit = Number.isFinite(Number(options.maxDistance)) ? Number(options.maxDistance) : Infinity;
  if (end.x < 0 || end.y < 0 || end.x >= space.width || end.y >= space.height) return [];
  const terrain = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "terrain").flatMap(object => object.cells || []));
  const difficult = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "difficult").flatMap(object => object.cells || []));
  for (const zone of (scene.actors || []).filter(item => item.kind === "crowd" && !item.knockedOut && item.team !== actor.team && item.space === actor.space)) difficult.add(cellKey(zone));
  for (const guardian of (scene.actors || []).filter(item => !item.knockedOut && item.team !== actor.team && item.profileId === "enemy.common.guardian" && item.space === actor.space)) {
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) difficult.add(`${guardian.x + dx},${guardian.y + dy}`);
  }
  for(const cell of actor.difficultTerrainImmunity||[])difficult.delete(cell);
  const elevation = new Map((scene.objects || []).filter(object => object.space === actor.space && ["high","low"].includes(object.type)).flatMap(object => (object.cells || []).map(cell => [cell,object.type])));
  const removed = removedCellKeys(scene, actor.space);
  const actorBanished = hasEffect(scene, actor, "positive.изгнан");
  const opponents = new Set((scene.actors || []).filter(item => item.id !== actor.id && !item.knockedOut && item.space === actor.space && item.team !== actor.team && effectPresenceStatus(scene, item.id).onField)
    .filter(item => !actorBanished && !hasEffect(scene, item, "positive.изгнан")).map(item => `${item.x},${item.y}`));
  const cinematic = space.mode === "cinematic";
  if (cinematic && !options.ignoreDifficult) opponents.forEach(cell => difficult.add(cell));
  const blocked = point => removed.has(cellKey(point)) || (!options.ignoreTerrain && terrain.has(cellKey(point))) || (!cinematic && !options.ignoreEnemies && opponents.has(cellKey(point)));
  if (options.straight) {
    const dx = end.x - actor.x, dy = end.y - actor.y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (!(dx === 0 || dy === 0 || ax === ay)) return [];
    const steps = Math.max(ax, ay);
    if (steps < 1 || steps > limit) return [];
    const path = [], direction = { x: Math.sign(dx), y: Math.sign(dy) };
    while (path.length < limit) {
      const current = path.at(-1) || actor;
      if (current.x === end.x && current.y === end.y) return path;
      const attempted = { x: current.x + direction.x, y: current.y + direction.y };
      if (!options.ignoreTerrain && wallBlocksStep(scene, actor.space, current, attempted)) return [];
      const point = removed.has(cellKey(attempted)) ? topologyStepDestination(scene, { space: actor.space, from: current, attempted }) : attempted;
      if (!point) return [];
      if (blocked(point)) return [];
      if (direction.x && Math.sign(end.x - point.x) !== direction.x && end.x !== point.x || direction.y && Math.sign(end.y - point.y) !== direction.y && end.y !== point.y) return [];
      path.push(point);
    }
    return path.at(-1)?.x === end.x && path.at(-1)?.y === end.y ? path : [];
  }
  const start = { x: actor.x, y: actor.y }, queue = [{ point: start, path: [] }], seen = new Set([cellKey(start)]), directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  while (queue.length) {
    const current = queue.shift();
    if (current.point.x === end.x && current.point.y === end.y) return current.path;
    if (current.path.length >= limit) continue;
    if (!options.ignoreDifficult && current.path.length && difficult.has(cellKey(current.point))) continue;
    if (!options.ignoreTerrain && current.path.length) { const previous=current.path.length>1?current.path.at(-2):start,from=elevation.get(cellKey(previous))||"normal",to=elevation.get(cellKey(current.point))||"normal";if(from!==to)continue; }
    for (const direction of directions) {
      const attempted = { x: current.point.x + direction.x, y: current.point.y + direction.y };
      if (!options.ignoreTerrain && wallBlocksStep(scene, actor.space, current.point, attempted)) continue;
      const point = removed.has(cellKey(attempted)) ? topologyStepDestination(scene, { space: actor.space, from: current.point, attempted }) : attempted, key = point && cellKey(point);
      if (!point) continue;
      if (point.x < 0 || point.y < 0 || point.x >= space.width || point.y >= space.height || seen.has(key) || blocked(point)) continue;
      seen.add(key);
      queue.push({ point, path: current.path.concat(point) });
    }
  }
  return [];
}

const DISPLACEMENT_DIRECTIONS = {
  north: { x: 0, y: -1 },
  northeast: { x: 1, y: -1 },
  east: { x: 1, y: 0 },
  southeast: { x: 1, y: 1 },
  south: { x: 0, y: 1 },
  southwest: { x: -1, y: 1 },
  west: { x: -1, y: 0 },
  northwest: { x: -1, y: -1 },
};

function displacementStatus(scene, request = {}) {
  const actor = actorById(scene, request.actorId), space = (scene.spaces || []).find(item => item.id === actor?.space);
  const unavailable = (reason, extra = {}) => ({ available: false, reason, actor, from: actor ? { space: actor.space, x: Number(actor.x), y: Number(actor.y) } : null, destination: null, path: [], topologyCrossings: [], ...extra });
  if (!actor) return unavailable("Перемещаемый персонаж не найден.");
  if (!space) return unavailable("Поле персонажа не найдено.");
  if (actor.knockedOut && !request.allowKnockedOut) return unavailable("Выведенного из строя персонажа нельзя переместить этим правилом.");
  const effectMovement = effectMovementStatus(scene, actor.id, { forced: true, ignoreResistance: Boolean(request.ignoreResistance) });
  if (!effectMovement.available) return unavailable(effectMovement.reason);

  const maximum = Math.max(1, Math.min(99, Number(request.maximum || request.distance || 1)));
  const mode = String(request.mode || "directed");
  let vector = typeof request.direction === "string" ? DISPLACEMENT_DIRECTIONS[request.direction] : request.direction;
  if (["push", "pull"].includes(mode)) {
    const source = actorById(scene, request.sourceActorId) || request.source;
    if (!source || source.space && source.space !== actor.space) return unavailable("Источник принудительного перемещения должен находиться на том же поле.");
    const away = { x: Math.sign(actor.x - Number(source.x)), y: Math.sign(actor.y - Number(source.y)) };
    if (!away.x && !away.y) return unavailable("Источник и цель занимают одну клетку: направление не определено.");
    vector = mode === "pull" ? { x: -away.x, y: -away.y } : away;
  }

  const requested = request.destination ? { x: Number(request.destination.x), y: Number(request.destination.y) } : null;
  if (requested && (!Number.isInteger(requested.x) || !Number.isInteger(requested.y))) return unavailable("Клетка назначения должна иметь целые координаты.");
  if (requested) {
    const dx = requested.x - Number(actor.x), dy = requested.y - Number(actor.y), distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (!distance || distance > maximum || dx && dy && Math.abs(dx) !== Math.abs(dy)) return unavailable(`Назначение должно лежать на прямой не дальше ${maximum} кл.`);
    vector = { x: Math.sign(dx), y: Math.sign(dy) };
  }
  if (!vector || !Number.isInteger(Number(vector.x)) || !Number.isInteger(Number(vector.y)) || Math.abs(Number(vector.x)) > 1 || Math.abs(Number(vector.y)) > 1 || !Number(vector.x) && !Number(vector.y)) return unavailable("Не задано допустимое направление перемещения.");
  vector = { x: Math.sign(Number(vector.x)), y: Math.sign(Number(vector.y)) };

  const occupied = new Set((scene.actors || []).filter(item => item.id !== actor.id && item.space === actor.space && effectPresenceStatus(scene, item.id).onField)
    .filter(item => !hasEffect(scene, actor, "positive.изгнан") && !hasEffect(scene, item, "positive.изгнан")).map(cellKey));
  const blockingTypes = new Set(request.blockingTypes || ["terrain"]);
  const terrain = new Set((scene.objects || []).filter(object => object.space === actor.space && blockingTypes.has(object.type)).flatMap(object => object.cells || []));
  const removed = removedCellKeys(scene, actor.space), path = [], crossings = [];
  let current = { x: Number(actor.x), y: Number(actor.y) };
  const steps = requested ? Math.max(Math.abs(requested.x - current.x), Math.abs(requested.y - current.y)) : maximum;
  let stoppedReason = "", blockedAt = null;
  for (let step = 0; step < steps; step += 1) {
    const attempted = { x: current.x + vector.x, y: current.y + vector.y };
    if (!request.ignoreTerrain && wallBlocksStep(scene, actor.space, current, attempted)) { stoppedReason = "Стена блокирует перемещение."; blockedAt = attempted; break; }
    const next = removed.has(cellKey(attempted)) ? topologyStepDestination(scene, { space: actor.space, from: current, attempted }) : attempted;
    const key = next && cellKey(next);
    if (!next) { stoppedReason = "Разрыв поля блокирует перемещение."; blockedAt = attempted; break; }
    if (next.x < 0 || next.y < 0 || next.x >= space.width || next.y >= space.height) { stoppedReason = "Перемещение выводит персонажа за границу поля."; blockedAt = next; break; }
    if (!request.ignoreActors && occupied.has(key)) { stoppedReason = "Клетка назначения занята другим персонажем."; blockedAt = next; break; }
    if (!request.ignoreTerrain && terrain.has(key)) { stoppedReason = "Клетка назначения занята непроходимой местностью."; blockedAt = next; break; }
    if (removed.has(key)) { stoppedReason = "Нельзя закончить перемещение в удалённой клетке."; blockedAt = next; break; }
    current = next;
    path.push(next);
    if (next.teleported) crossings.push({ destination: key, cutIds: [...(next.crossedCutIds || [])] });
  }
  if (stoppedReason && (!request.allowPartial || requested || !path.length)) return unavailable(stoppedReason, { blockedAt, path, direction: vector });
  if (requested && (current.x !== requested.x || current.y !== requested.y)) return unavailable("Топологический переход не ведёт в выбранную клетку.", { path, direction: vector });
  return {
    available: true,
    reason: "",
    actor,
    mode,
    from: { space: actor.space, x: Number(actor.x), y: Number(actor.y) },
    destination: { space: actor.space, x: current.x, y: current.y },
    direction: vector,
    distance: path.length,
    path,
    topologyCrossings: crossings,
    interrupted: Boolean(stoppedReason),
    interruptedReason: stoppedReason,
  };
}

function prepareDisplacements(scene, requests = [], options = {}) {
  if (!Array.isArray(requests) || !requests.length) return { ok: false, errors: ["Не задано ни одного перемещения."], events: [], statuses: [], scene: clone(scene) };
  let working = clone(scene);
  const events = [], statuses = [], moved = new Set();
  try {
    for (const request of requests) {
      if (moved.has(request.actorId) && !options.allowRepeatedActors) throw new Error("Один персонаж не может быть перемещён дважды в одном плане.");
      const status = displacementStatus(working, request);
      if (!status.available && request.allowBlocked) {
        statuses.push({ ...status, mandatory: true, blocked: true });
        continue;
      }
      if (!status.available && request.optional) {
        statuses.push(status);
        continue;
      }
      if (!status.available) throw new Error(`${status.actor?.name || "Персонаж"}: ${status.reason}`);
      const event = {
        type: "actor.move",
        actorId: request.actorId,
        payload: {
          space: status.destination.space,
          x: status.destination.x,
          y: status.destination.y,
          movement: String(request.name || options.name || "Принудительное перемещение").slice(0, 120),
          forced: request.forced !== false,
          displacement: { mode: status.mode, direction: status.direction, distance: status.distance, ruleId: request.ruleId || options.ruleId || null, allowKnockedOut: Boolean(request.allowKnockedOut), ignoreActors: Boolean(request.ignoreActors), ignoreTerrain: Boolean(request.ignoreTerrain), ignoreResistance: Boolean(request.ignoreResistance) },
          path: status.path.map(cellKey),
          topologyCrossings: status.topologyCrossings,
          participantIds: [...new Set([...(request.participantIds || []), request.actorId])],
        },
      };
      working = dispatch(working, event).scene;
      moved.add(request.actorId);
      statuses.push(status);
      events.push(event);
    }
    return { ok: true, errors: [], events, statuses, scene: working };
  } catch (error) {
    return { ok: false, errors: [error?.message || "План перемещений недопустим."], events: [], statuses: [], scene: clone(scene) };
  }
}
function turnStartStatus(scene, actorId) {
  const actor = actorById(scene, actorId), heroes = (scene.actors || []).filter(item => item.team === "hero" && item.kind !== "crowd" && !isEnemyModifier(item) && !item.knockedOut), enemies = (scene.actors || []).filter(item => item.team === "enemy" && item.kind !== "crowd" && !isEnemyModifier(item) && !item.knockedOut);
  if (!actor) return { available: false, reason: "Участник не найден." };
  if (actor.kind === "crowd") return { available: false, reason: "Зоны массовки не совершают Ходы." };
  if (isEnemyModifier(actor)) return { available: false, reason: "Враги-Модификаторы не совершают отдельных Ходов." };
  if (scene.pendingAction) return { available: false, reason: "Сначала завершите текущую цепочку Реакций." };
  if (scene.pendingPrompt) return { available: false, reason: "Сначала ответьте на сработавшее правило." };
  if (scene.activeActorId) return { available: false, reason: "Сначала завершите текущий Ход." };
  if (actor.knockedOut) return { available: false, reason: "Выведенный из строя участник не может начать Ход." };
  if (actor.acted) return { available: false, reason: "Этот участник уже действовал в текущем Раунде." };
  if (hasEffect(scene, actor, "negative.подброшен")) {
    const unlaunchedAlly = (scene.actors || []).find(item => item.id !== actor.id && item.team === actor.team && !item.knockedOut && !item.acted && !hasEffect(scene, item, "negative.подброшен"));
    if (unlaunchedAlly) return { available: false, reason: `Подброшенный персонаж действует после союзника «${unlaunchedAlly.name}».` };
  }
  const lastEnd = currentRoundEvents(scene).find(event => closedTurnActorId(event)), lastActor = actorById(scene, closedTurnActorId(lastEnd));
  if (heroes.length && enemies.length) {
    if (!lastEnd && !(actor.kind === "hero" || actor.heroId)) return { available: false, reason: "Раунд начинает персонаж игрока." };
    const oppositeTeam = lastActor?.team === "enemy" ? "hero" : "enemy";
    const oppositeReady = (oppositeTeam === "hero" ? heroes : enemies).some(item => !item.acted);
    if (lastActor?.team === actor.team && oppositeReady) return { available: false, reason: actor.team === "enemy" ? "Сначала должен действовать ещё не ходивший герой." : "Сначала должен действовать ещё не ходивший враг." };
  }
  return { available: true, reason: "" };
}
function roundEndStatus(scene) {
  if (scene.pendingAction) return { available: false, reason: "Сначала завершите текущую цепочку Реакций." };
  if (scene.pendingPrompt) return { available: false, reason: "Сначала ответьте на сработавшее правило." };
  if (scene.activeActorId) return { available: false, reason: "Сначала завершите текущий Ход." };
  const completedTurns = currentRoundEvents(scene).filter(event => closedTurnActorId(event));
  if (!completedTurns.length) return { available: false, reason: "Раунд ещё не начат." };
  const readyActors = (scene.actors || []).filter(item => !item.knockedOut && item.kind !== "crowd" && !isEnemyModifier(item));
  const remaining = readyActors.filter(actor => !actor.acted);
  if (remaining.length) return { available: false, reason: `Не завершили Ход: ${remaining.map(actor => actor.name).join(", ")}.` };
  return { available: true, reason: "" };
}
function fodderMoveStatus(scene, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor || actor.kind !== "crowd" || actor.knockedOut) return { available: false, reason: "Зона массовки недоступна.", remaining: 0, boundaryEventId: null };
  const events = currentRoundEvents(scene), boundaryIndex = events.findIndex(event => event.type === "turn.end" && actorById(scene, event.actorId)?.team === "enemy" && actorById(scene, event.actorId)?.kind !== "crowd");
  if (boundaryIndex < 0) return { available: false, reason: "Массовка перемещается после завершения Хода врага.", remaining: 0, boundaryEventId: null };
  const boundary = events[boundaryIndex], boundaryActor = actorById(scene, boundary.actorId), maximum = boundaryActor?.profileId === "enemy.common.hound-master" ? 4 : 2, used = events.slice(0, boundaryIndex).filter(event => event.type === "actor.move" && event.actorId === actor.id && event.payload?.fodderMove && event.payload?.boundaryEventId === boundary.id).reduce((sum, event) => sum + Math.max(0, Number(event.payload?.distance || 0)), 0), remaining = Math.max(0, maximum - used);
  return { available: remaining > 0, reason: remaining > 0 ? "" : `Эта зона уже переместилась на ${maximum} клетки после последнего Хода врага.`, remaining, maximum, used, boundaryEventId: boundary.id };
}
const areaCells = (space, anchor, area) => {
  const width = Number(area?.[0] || 0), height = Number(area?.[1] || 0), cells = [];
  const startX = Number(anchor?.x) - (width % 2 ? Math.floor(width / 2) : 0), startY = Number(anchor?.y) - (height % 2 ? Math.floor(height / 2) : 0);
  for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) {
    const x = startX + dx, y = startY + dy;
    if (x >= 0 && y >= 0 && x < Number(space?.width || 0) && y < Number(space?.height || 0)) cells.push(`${x},${y}`);
  }
  return cells;
};
const eventId = () => `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const actionCost = action => {
  const match = String(action?.cost || "").match(/(\d+)\s*(ОД|Фокус)/i);
  return match ? { amount: Number(match[1]), resource: match[2].toLowerCase() === "од" ? "ap" : "focus" } : { amount: 0, resource: null };
};
const actorActionCost = (actor, action) => {
  const cost = actionCost(action);
  if (Number(actor?.techniques?.["ruiner.creation-ascetic"] || 0) >= 2 && actionIs(action, "charge")) cost.amount = 1;
  return cost;
};
