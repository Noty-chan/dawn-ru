"use strict";

function pushDestination(scene, target, source, maximum = 1) {
  const space = (scene.spaces || []).find(item => item.id === target?.space);
  if (!space || !target || !source || target.space !== source.space) return { x: target?.x, y: target?.y, distance: 0 };
  const dx = Math.sign(target.x - source.x), dy = Math.sign(target.y - source.y);
  if (!dx && !dy) return { x: target.x, y: target.y, distance: 0 };
  const movingMarker = Boolean(markerById(scene, target.id));
  const occupied = new Set(movingMarker ? [] : (scene.actors || []).filter(item => item.id !== target.id && item.space === target.space && !item.knockedOut).map(cellKey));
  const terrain = new Set((scene.objects || []).filter(object => object.space === target.space && object.type === "terrain").flatMap(object => object.cells || []));
  let x = target.x, y = target.y, moved = 0;
  for (let step = 0; step < Number(maximum || 0); step += 1) {
    const next = { x: x + dx, y: y + dy }, key = cellKey(next);
    if (next.x < 0 || next.y < 0 || next.x >= space.width || next.y >= space.height || occupied.has(key) || terrain.has(key)) break;
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
function movementPath(scene, actorId, destination, options = {}) {
  const actor = actorById(scene, actorId), space = (scene.spaces || []).find(item => item.id === actor?.space);
  if (!actor || !space || !destination || !Number.isInteger(Number(destination.x)) || !Number.isInteger(Number(destination.y))) return [];
  const end = { x: Number(destination.x), y: Number(destination.y) }, limit = Number.isFinite(Number(options.maxDistance)) ? Number(options.maxDistance) : Infinity;
  if (end.x < 0 || end.y < 0 || end.x >= space.width || end.y >= space.height) return [];
  const terrain = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "terrain").flatMap(object => object.cells || []));
  const difficult = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "difficult").flatMap(object => object.cells || []));
  const opponents = new Set((scene.actors || []).filter(item => item.id !== actor.id && item.space === actor.space && item.team !== actor.team).map(item => `${item.x},${item.y}`));
  const blocked = point => (!options.ignoreTerrain && terrain.has(cellKey(point))) || (!options.ignoreEnemies && opponents.has(cellKey(point)));
  if (options.straight) {
    const dx = end.x - actor.x, dy = end.y - actor.y, ax = Math.abs(dx), ay = Math.abs(dy);
    if (!(dx === 0 || dy === 0 || ax === ay)) return [];
    const steps = Math.max(ax, ay);
    if (steps < 1 || steps > limit) return [];
    const path = [];
    for (let step = 1; step <= steps; step += 1) {
      const point = { x: actor.x + Math.sign(dx) * step, y: actor.y + Math.sign(dy) * step };
      if (blocked(point)) return [];
      path.push(point);
    }
    return path;
  }
  const start = { x: actor.x, y: actor.y }, queue = [{ point: start, path: [] }], seen = new Set([cellKey(start)]), directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  while (queue.length) {
    const current = queue.shift();
    if (current.point.x === end.x && current.point.y === end.y) return current.path;
    if (current.path.length >= limit) continue;
    if (!options.ignoreDifficult && current.path.length && difficult.has(cellKey(current.point))) continue;
    for (const direction of directions) {
      const point = { x: current.point.x + direction.x, y: current.point.y + direction.y }, key = cellKey(point);
      if (point.x < 0 || point.y < 0 || point.x >= space.width || point.y >= space.height || seen.has(key) || blocked(point)) continue;
      seen.add(key);
      queue.push({ point, path: current.path.concat(point) });
    }
  }
  return [];
}
function turnStartStatus(scene, actorId) {
  const actor = actorById(scene, actorId), heroes = (scene.actors || []).filter(item => item.kind === "hero" && item.team === "hero" && !item.knockedOut), enemies = (scene.actors || []).filter(item => item.team === "enemy" && !item.knockedOut);
  if (!actor) return { available: false, reason: "Участник не найден." };
  if (scene.pendingAction) return { available: false, reason: "Сначала завершите текущую цепочку Реакций." };
  if (scene.pendingPrompt) return { available: false, reason: "Сначала ответьте на сработавшее правило." };
  if (scene.activeActorId) return { available: false, reason: "Сначала завершите текущий Ход." };
  if (actor.knockedOut) return { available: false, reason: "Выведенный из строя участник не может начать Ход." };
  if (actor.team !== "enemy" && actor.acted) return { available: false, reason: "Этот участник уже действовал в текущем Раунде." };
  if (actor.team === "enemy" && actor.acted && enemies.some(item => !item.acted)) return { available: false, reason: "Сначала должен действовать ещё не ходивший враг." };
  const lastEnd = currentRoundEvents(scene).find(event => closedTurnActorId(event)), lastActor = actorById(scene, closedTurnActorId(lastEnd));
  if (heroes.length && enemies.length) {
    if (!lastEnd && actor.team !== "hero") return { available: false, reason: "Раунд начинает персонаж игрока." };
    if (lastActor?.team === "hero" && actor.team !== "enemy") return { available: false, reason: "После игрока должен действовать враг." };
    if (lastActor?.team === "enemy" && actor.team === "enemy") return { available: false, reason: "После врага должен действовать игрок." };
  }
  return { available: true, reason: "" };
}
function roundEndStatus(scene) {
  if (scene.pendingAction) return { available: false, reason: "Сначала завершите текущую цепочку Реакций." };
  if (scene.pendingPrompt) return { available: false, reason: "Сначала ответьте на сработавшее правило." };
  if (scene.activeActorId) return { available: false, reason: "Сначала завершите текущий Ход." };
  const completedTurns = currentRoundEvents(scene).filter(event => closedTurnActorId(event));
  if (!completedTurns.length) return { available: false, reason: "Раунд ещё не начат." };
  const heroes = (scene.actors || []).filter(item => item.kind === "hero" && item.team === "hero" && !item.knockedOut), enemyTurns = completedTurns.filter(event => actorById(scene, closedTurnActorId(event))?.team === "enemy").length;
  if (heroes.some(actor => !actor.acted)) return { available: false, reason: "Не все персонажи игроков завершили Ход." };
  if (heroes.length && enemyTurns < heroes.length) return { available: false, reason: `Нужно ещё Ходов врагов: ${heroes.length - enemyTurns}.` };
  return { available: true, reason: "" };
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
  if (Number(actor?.techniques?.["ruiner.creation-ascetic"] || 0) >= 1 && cost.resource === "focus") cost.resource = "creationMarks";
  if (Number(actor?.techniques?.["ruiner.creation-ascetic"] || 0) >= 2 && action?.name === "Зарядка") cost.amount = 1;
  return cost;
};
