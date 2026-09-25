"use strict";

const BUILDER_ARMY_OF_STONE_RULE_ID = "lionwing.npc.builder.army-of-stone";
const BUILDER_ARMY_OF_STONE_TERRAIN_TYPES = new Set(["terrain", "difficult", "high", "low"]);

function builderArmyOfStoneStatus(scene, actorOrId) {
  const actor = typeof actorOrId === "string" ? actorById(scene, actorOrId) : actorOrId;
  const fail = reason => ({ available: false, reason, terrainObjects: [], cells: [], spawnCells: [], existingFodderIds: [] });
  if (!actor || actor.profileId !== "lionwing.npc.builder" || actor.knockedOut) return fail("Армия камня доступна только выведенному на поле Строителю.");
  if ((scene?.walls || []).length) return fail("Армия камня пока не может превратить Стены: у них нет клетки, где разместить Зону массовки. Уберите Стены вручную или разрешите это правило Нарратором.");

  const spaces = new Map((scene?.spaces || []).map(space => [space.id, space]));
  const cuts = new Set((scene?.topology?.cuts || []).flatMap(cut => (cut.cells || []).map(key => `${cut.space}:${String(key)}`)));
  const terrainObjects = (scene?.objects || [])
    .filter(object => BUILDER_ARMY_OF_STONE_TERRAIN_TYPES.has(object?.type))
    .map(object => {
      const space = spaces.get(object.space), rawCells = Array.isArray(object.cells) ? object.cells : null;
      if (!object.id || !space || !rawCells?.length || rawCells.length > 144) return { invalid: true, id: object.id || "?" };
      const cells = [...new Set(rawCells.map(String))].sort((a, b) => {
        const [ax, ay] = a.split(",").map(Number), [bx, by] = b.split(",").map(Number);
        return ay - by || ax - bx;
      });
      if (cells.some(key => {
        const match = key.match(/^(\d{1,2}),(\d{1,2})$/), x = match ? Number(match[1]) : -1, y = match ? Number(match[2]) : -1;
        return !match || x < 0 || y < 0 || x >= Number(space.width) || y >= Number(space.height) || cuts.has(`${object.space}:${key}`);
      })) return { invalid: true, id: object.id };
      return { id: object.id, space: object.space, type: object.type, label: String(object.label || "Местность"), cells, hidden: Boolean(object.hidden) };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (terrainObjects.some(object => object.invalid)) return fail("На поле есть повреждённая область Местности; исправьте её до применения Армии камня.");

  const cellSources = new Map();
  for (const object of terrainObjects) for (const key of object.cells) {
    const cellId = `${object.space}:${key}`;
    const source = cellSources.get(cellId) || { space: object.space, ...spatialPoint(key), terrainObjectIds: [], hidden: true };
    source.terrainObjectIds.push(object.id);
    source.hidden = source.hidden && object.hidden;
    cellSources.set(cellId, source);
  }
  const cells = [...cellSources.values()].sort((a, b) => String(a.space).localeCompare(String(b.space)) || a.y - b.y || a.x - b.x);
  if (terrainObjects.length > 240 || cells.length > 144) return fail("Слишком много местности для одного безопасного преобразования; разрешите Армию камня вручную.");
  const existingFodderIds = [];
  const spawnCells = [];
  for (const cell of cells) {
    const fodder = (scene?.actors || []).filter(item => item.kind === "crowd" && !item.knockedOut && item.space === cell.space && Number(item.x) === cell.x && Number(item.y) === cell.y);
    if (fodder.length > 1 || fodder.some(item => item.team !== actor.team)) return fail("На клетке Местности уже есть чужая или конфликтующая Зона массовки; разрешите её вручную перед применением Армии камня.");
    if (fodder.length === 1) {
      cell.existingFodderId = fodder[0].id;
      existingFodderIds.push(fodder[0].id);
    } else spawnCells.push(cell);
  }
  return { available: true, reason: "", terrainObjects, cells, spawnCells, existingFodderIds };
}

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
    .filter(actor => {if(actor.space!==spaceId||!actorMatchesQuery(actor,source,options))return false;for(let oy=0;oy<Math.max(1,Number(actor.occupiedHeight||1));oy++)for(let ox=0;ox<Math.max(1,Number(actor.occupiedWidth||1));ox++)if(wanted.has(`${Number(actor.x)+ox},${Number(actor.y)+oy}`))return true;return false})
    .filter(actor => options.ignoreEffectTargeting || effectTargetingStatus(scene, source?.id, actor.id, options).available)
    .map(actor => actor.id);
}

function actorIdsInRange(scene, sourceActorId, range, options = {}) {
  const source = actorById(scene, sourceActorId);
  const maximum = Number(range);
  if (!source || Number.isNaN(maximum) || maximum < 0) return [];
  return (scene?.actors || [])
    .filter(actor => modifierRangeDistance(scene, source, actor) <= maximum && actorMatchesQuery(actor, source, options))
    .filter(actor => options.ignoreEffectTargeting || effectTargetingStatus(scene, source.id, actor.id, options).available)
    .map(actor => actor.id);
}

function wallTargetingStatus(scene, sourceActorId, targetActorId, request = {}) {
  const source = typeof sourceActorId === "string" ? actorById(scene, sourceActorId) : sourceActorId;
  const typedTarget = lionwingTypedTargetObject(targetActorId) ? typedTargetStatus(scene, { ...request, sourceActorId: source?.id, target: targetActorId, intent: "target" }) : null;
  if (typedTarget && !typedTarget.available) return { ...typedTarget, walls: [] };
  if (typedTarget && !["actor", "cell"].includes(typedTarget.kind)) return lionwingTypedTargetFailure(typedTarget.normalized, "Проверка стен поддерживает только персонажа или клетку; передайте выбор Нарратору.", "manual-only-kind", { walls: [], manualFallback: true, manual: true, fallback: "manual" });
  if (typedTarget?.kind === "cell" && (typedTarget.cells || []).length !== 1) return lionwingTypedTargetFailure(typedTarget.normalized, "Проверка стен поддерживает одну клетку за раз; передайте выбор Нарратору.", "invalid-target", { walls: [], manualFallback: true, manual: true, fallback: "manual" });
  const target = typedTarget ? typedTarget.kind === "cell" ? { space: typedTarget.space, ...spatialPoint(typedTarget.cell) } : typedTarget.target : typeof targetActorId === "string" ? actorById(scene, targetActorId) : targetActorId;
  const space = (scene.spaces || []).find(item => item.id === source?.space);
  if (!source || !target || !space || source.space !== target.space) return { available: false, reason: "Цель находится на другом поле.", walls: [] };
  const targetCells=new Set(typedTarget?.kind === "cell" ? typedTarget.cells : modifierTargetCells(scene,target)),sourceCells=modifierTargetCells(scene,source);
  if(sourceCells.some(key=>targetCells.has(key)))return {available:true,reason:"",walls:[]};
  const maximum = modifierRangeDistance(scene,source,target);
  const queue = sourceCells.map(key=>{const[x,y]=key.split(",").map(Number);return{x,y,steps:0}}), seen = new Set(sourceCells), blocking = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (targetCells.has(cellKey(current))) return { available: true, reason: "", walls: [...blocking] };
    if (current.steps >= maximum) continue;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const next = { x: current.x + dx, y: current.y + dy }, key = cellKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= space.width || next.y >= space.height || seen.has(key)) return;
      const wall = wallAt(scene, space.id, current, next);
      if (wall) { blocking.add(wall.id); return; }
      seen.add(key); queue.push({ ...next, steps: current.steps + 1 });
    });
  }
  return { available: false, reason: "Стена перекрывает проведение цели.", walls: [...blocking] };
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
  const typedAnchorInput = request.typedAnchor || (lionwingTypedTargetObject(request.anchor) ? request.anchor : null);
  let typedAnchorStatus = null;
  if (typedAnchorInput) {
    typedAnchorStatus = typedTargetStatus(scene, { ...request, target: typedAnchorInput, intent: request.intent || "target" });
    if (!typedAnchorStatus.available) return { ...typedAnchorStatus, cells: [], targetIds: [], shape: request.shape || "cell" };
    if (typedAnchorStatus.kind !== "cell" || (typedAnchorStatus.cells || []).length !== 1) return lionwingTypedTargetFailure(typedAnchorStatus.normalized, "Опорная типизированная цель должна быть одной клеткой.", "invalid-target", { cells: [], targetIds: [], shape: request.shape || "cell" });
    if (request.space && request.space !== typedAnchorStatus.space) return lionwingTypedTargetFailure(typedAnchorStatus.normalized, "Опорная клетка находится в другом пространстве.", "space-mismatch", { cells: [], targetIds: [], shape: request.shape || "cell" });
  }
  const typedCellInputs = Array.isArray(request.cells) ? request.cells.filter(item => lionwingTypedTargetObject(item)) : [];
  let typedCellStatus = null;
  if (typedCellInputs.length) {
    typedCellStatus = typedTargetsStatus(scene, typedCellInputs, { ...request, sourceActorId: request.sourceActorId, intent: request.intent || "target" });
    if (!typedCellStatus.available) return { ...typedCellStatus, cells: [], targetIds: [], shape: request.shape || "connected" };
    const nonCell = typedCellStatus.statuses.find(status => status.kind !== "cell");
    if (nonCell) return lionwingTypedTargetFailure(nonCell.normalized, "Зона принимает только типизированные клетки.", "invalid-target", { cells: [], targetIds: [], shape: request.shape || "connected", typedTargets: typedCellStatus.typedTargets, statuses: typedCellStatus.statuses });
  }
  const space = (scene?.spaces || []).find(item => item.id === request.space || item.id === typedAnchorStatus?.space || item.id === typedCellStatus?.spaces?.[0]);
  const anchor = typedAnchorStatus ? spatialPoint(typedAnchorStatus.cell) : spatialPoint(request.anchor);
  const shape = request.shape || "cell";
  const shapeRequest = typedCellStatus ? { ...request, cells: [...(Array.isArray(request.cells) ? request.cells.filter(item => typeof item === "string") : []), ...typedCellStatus.targetCells] } : request;
  if (!space) return { available: false, reason: "Пространство не найдено.", cells: [], targetIds: [] };
  const inBounds = point => point && point.x >= 0 && point.y >= 0 && point.x < Number(space.width) && point.y < Number(space.height);
  const cells = new Set(), add = point => { if (inBounds(point)) cells.add(cellKey(point)); };
  const legacySquares = { square2: [2, 2], square3: [3, 3], square5: [5, 5] };
  const legacyLines = { lineH: "horizontal", lineV: "vertical", lineDiagDown: "diagonal-down", lineDiagUp: "diagonal-up" };
  let reason = "";
  if (shape === "connected") {
    const chosen = [...new Set((shapeRequest.cells || []).map(String))], chosenSet = new Set(chosen), points = chosen.map(spatialPoint);
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
  const resultCells = [...cells], targetOptions = Array.isArray(request.targets) ? { sourceActorId: request.sourceActorId } : request.targets || {}, targetIds = reason ? [] : actorIdsInCells(scene, space.id, resultCells, targetOptions);
  const explicitTargetIds = Array.isArray(request.targets) && request.targets.some(item => lionwingTypedTargetObject(item))
    ? (typedTargetsStatus(scene, request.targets, { sourceActorId: request.sourceActorId, intent: "target" }).targetIds || [])
    : null;
  const selectedTargetIds = explicitTargetIds ? explicitTargetIds.filter(id => targetIds.includes(id)) : targetIds;
  const result = { available: !reason && resultCells.length > 0, reason: reason || (resultCells.length ? "" : "Форма не содержит клеток поля."), space, shape, cells: resultCells, targetIds: selectedTargetIds };
  if (typedAnchorStatus) result.typedAnchor = typedAnchorStatus.normalized;
  if (typedCellStatus) result.typedCells = typedCellStatus.typedTargets;
  return result;
}

// LionWing's next technique adapters need one small, serializable target
// vocabulary.  The vocabulary deliberately carries references only: the
// authoritative Scene resolves ids, coordinates, ownership and visibility at
// query time.  A client supplied actor/object snapshot is never copied into a
// normalized target.
const LIONWING_TYPED_TARGET_KINDS = Object.freeze(["actor", "cell", "terrain", "wall", "entity"]);
const LIONWING_TYPED_TARGET_KIND_SET = new Set(LIONWING_TYPED_TARGET_KINDS);
const LIONWING_TYPED_TARGET_FORBIDDEN_KEYS = new Set([
  "snapshot", "clientSnapshot", "actorSnapshot", "objectSnapshot", "wallSnapshot", "terrainSnapshot",
  "actorState", "clientState", "clientFlags", "confirmed", "available", "availability", "accessible",
  "name", "label", "team", "profileId", "hp", "maxHp", "effects", "hidden", "knockedOut", "ownerId",
  "width", "height", "occupiedWidth", "occupiedHeight", "x", "y",
]);
const LIONWING_TYPED_TARGET_TERRAIN_TYPES = new Set(["terrain", "difficult", "custom"]);
const LIONWING_TYPED_TARGET_MANUAL_CODES = new Set([
  "unsupported-edition", "invalid-target", "missing-kind", "unknown-kind", "missing-space", "invalid-space",
  "missing-id", "invalid-id", "invalid-cell", "invalid-cells", "conflicting-fields", "snapshot-forbidden",
  "ambiguous-target", "ownership-mismatch", "owner-not-found", "hidden-entity", "disappeared-entity",
]);

const lionwingTypedTargetPlain = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
const lionwingTypedTargetObject = value => lionwingTypedTargetPlain(value) && typeof value.kind === "string" && LIONWING_TYPED_TARGET_KIND_SET.has(value.kind.trim().toLowerCase());
const lionwingTypedTargetText = (value, max = 180) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const lionwingTypedTargetCell = value => {
  if (typeof value === "string") {
    const match = value.match(/^(0|[1-9]\d*),(0|[1-9]\d*)$/);
    if (!match) return null;
    const x = Number(match[1]), y = Number(match[2]);
    return Number.isSafeInteger(x) && Number.isSafeInteger(y) ? `${x},${y}` : null;
  }
  if (!lionwingTypedTargetPlain(value) || !Number.isSafeInteger(Number(value.x)) || !Number.isSafeInteger(Number(value.y)) || Number(value.x) < 0 || Number(value.y) < 0) return null;
  return `${Number(value.x)},${Number(value.y)}`;
};
const lionwingTypedTargetCellExtrasForbidden = value => {
  if (Array.isArray(value)) return value.some(lionwingTypedTargetCellExtrasForbidden);
  if (!lionwingTypedTargetPlain(value)) return false;
  return Object.entries(value).some(([key, child]) => key !== "x" && key !== "y" || lionwingTypedTargetForbidden(child));
};
const lionwingTypedTargetForbidden = value => {
  if (Array.isArray(value)) return value.some(lionwingTypedTargetForbidden);
  if (!lionwingTypedTargetPlain(value)) return false;
  return Object.entries(value).some(([key, child]) => {
    if (LIONWING_TYPED_TARGET_FORBIDDEN_KEYS.has(key)) return true;
    // A nested cell is intentionally allowed to carry x/y.  Other nested
    // values still undergo the same check, so a snapshot cannot hide inside
    // an owner or arbitrary metadata field.
    if (key === "cell" || key === "cells") return lionwingTypedTargetCellExtrasForbidden(child);
    return lionwingTypedTargetForbidden(child);
  });
};

function normalizeTypedTarget(value, options = {}) {
  if (!lionwingTypedTargetPlain(value)) return { ok: false, reason: "Типизированная цель должна быть объектом.", reasonCode: "invalid-target", target: null };
  if (lionwingTypedTargetForbidden(value)) return { ok: false, reason: "Типизированная цель не принимает снимок или заявление клиента о доступности.", reasonCode: "snapshot-forbidden", target: null };
  const kind = typeof value.kind === "string" ? value.kind.trim().toLowerCase() : "";
  if (!kind) return { ok: false, reason: "Типизированной цели нужен kind.", reasonCode: "missing-kind", target: null };
  if (!LIONWING_TYPED_TARGET_KIND_SET.has(kind)) return { ok: false, reason: `Неизвестный вид типизированной цели: ${kind}.`, reasonCode: "unknown-kind", target: null };
  const spaces = [value.space, value.spaceId].filter(item => item != null).map(item => typeof item === "string" ? item.trim() : item);
  if (spaces.length > 1 && spaces[0] !== spaces[1]) return { ok: false, reason: "Типизированная цель содержит два разных пространства.", reasonCode: "conflicting-fields", target: null };
  const space = spaces[0];
  if (!lionwingTypedTargetText(space, 120)) return { ok: false, reason: "Типизированной цели нужно пространство.", reasonCode: "missing-space", target: null };
  const idValues = [value.id, value.targetId].filter(item => item != null).map(item => typeof item === "string" ? item.trim() : item);
  if (idValues.length > 1 && idValues[0] !== idValues[1]) return { ok: false, reason: "Типизированная цель содержит два разных ID.", reasonCode: "conflicting-fields", target: null };
  const id = idValues.length ? idValues[0] : null;
  if (id != null && !lionwingTypedTargetText(id)) return { ok: false, reason: "ID типизированной цели должен быть строкой.", reasonCode: "invalid-id", target: null };
  const ownerValues = [value.ownerActorId, value.owner].filter(item => item != null).map(item => typeof item === "string" ? item.trim() : item);
  if (ownerValues.length > 1 && ownerValues[0] !== ownerValues[1]) return { ok: false, reason: "Типизированная цель содержит двух разных владельцев.", reasonCode: "conflicting-fields", target: null };
  if (ownerValues.some(item => !lionwingTypedTargetText(item))) return { ok: false, reason: "Владелец типизированной цели должен быть ID участника.", reasonCode: "invalid-id", target: null };
  const ownerActorId = ownerValues[0] || null;
  const rawCells = value.cells == null ? null : value.cells;
  if (rawCells != null && !Array.isArray(rawCells)) return { ok: false, reason: "Поле cells типизированной цели должно быть массивом.", reasonCode: "invalid-cells", target: null };
  const cells = rawCells == null ? [] : rawCells.map(lionwingTypedTargetCell);
  if (cells.some(cell => !cell) || new Set(cells).size !== cells.length) return { ok: false, reason: "Типизированная цель содержит некорректные или повторные клетки.", reasonCode: "invalid-cells", target: null };
  const cell = value.cell == null ? null : lionwingTypedTargetCell(value.cell);
  if (value.cell != null && !cell) return { ok: false, reason: "Клетка типизированной цели должна быть канонической парой координат.", reasonCode: "invalid-cell", target: null };
  if (cell && cells.length && !cells.includes(cell)) return { ok: false, reason: "Поле cell не входит в поле cells типизированной цели.", reasonCode: "conflicting-fields", target: null };
  const normalizedCells = [...new Set([...(cell ? [cell] : []), ...cells])];
  if (["actor", "terrain", "wall", "entity"].includes(kind) && !id) return { ok: false, reason: `Типизированной цели ${kind} нужен id.`, reasonCode: "missing-id", target: null };
  if (kind === "cell" && !normalizedCells.length) return { ok: false, reason: "Цели-клетке нужна cell или cells.", reasonCode: "invalid-cell", target: null };
  if (kind === "cell" && id) return { ok: false, reason: "Цель-клетка не принимает id персонажа или сущности.", reasonCode: "conflicting-fields", target: null };
  const entityKind = value.entityKind == null ? (value.type == null ? null : value.type) : value.entityKind;
  if (entityKind != null && !["actor", "object", "marker"].includes(entityKind)) return { ok: false, reason: "entityKind должен быть actor, object или marker.", reasonCode: "invalid-target", target: null };
  if (kind === "actor" && entityKind != null && entityKind !== "actor") return { ok: false, reason: "Цель-actor должна ссылаться на actor.", reasonCode: "invalid-target", target: null };
  if (kind === "terrain" && entityKind != null && entityKind !== "object") return { ok: false, reason: "Цель-terrain должна ссылаться на object.", reasonCode: "invalid-target", target: null };
  if (kind === "wall" && entityKind != null) return { ok: false, reason: "Цель-wall не принимает entityKind.", reasonCode: "invalid-target", target: null };
  if (kind === "cell" && entityKind != null) return { ok: false, reason: "Цель-cell не принимает entityKind.", reasonCode: "invalid-target", target: null };
  const target = { kind, space: String(space).trim() };
  if (id) target.id = String(id).trim();
  if (ownerActorId) target.ownerActorId = String(ownerActorId).trim();
  if (cell) target.cell = cell;
  if (normalizedCells.length) target.cells = normalizedCells;
  if (entityKind != null) target.entityKind = entityKind;
  return { ok: true, reason: "", reasonCode: "", target };
}

function normalizeTypedTargets(value, options = {}) {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  if (!list.length) return { ok: false, reason: "Не выбраны типизированные цели.", reasonCode: "invalid-target", targets: [], errors: [] };
  const targets = [], errors = [];
  for (const item of list) {
    const normalized = normalizeTypedTarget(item, options);
    if (!normalized.ok) errors.push(normalized);
    else targets.push(normalized.target);
  }
  const first = errors[0];
  return { ok: !errors.length, reason: first?.reason || "", reasonCode: first?.reasonCode || "", targets, errors };
}

function lionwingTypedTargetSceneIsLionwing(scene) {
  if (!scene || scene.rulesEdition && scene.rulesEdition !== "lionwing") return false;
  if (scene.rulesEdition === "lionwing") return true;
  if (scene.lionwing && typeof scene.lionwing === "object") return true;
  return (scene.actors || []).some(actor => actor?.rulesEdition === "lionwing" || String(actor?.profileId || "").startsWith("lionwing."));
}

function lionwingTypedTargetFailure(normalized, reason, reasonCode, extras = {}) {
  const manualFallback = extras.manualFallback == null ? LIONWING_TYPED_TARGET_MANUAL_CODES.has(reasonCode) : Boolean(extras.manualFallback);
  return {
    available: false,
    reason,
    reasonCode,
    code: reasonCode,
    manualFallback,
    manual: manualFallback,
    fallback: manualFallback ? "manual" : null,
    kind: normalized?.kind || null,
    space: normalized?.space || null,
    id: normalized?.id || null,
    cell: normalized?.cell || null,
    cells: normalized?.cells ? [...normalized.cells] : [],
    ownerActorId: normalized?.ownerActorId || null,
    normalized: normalized ? clone(normalized) : null,
    ...extras,
  };
}

function lionwingTypedTargetSuccess(normalized, extras = {}) {
  return {
    available: true,
    reason: "",
    reasonCode: "",
    code: "",
    manualFallback: false,
    manual: false,
    fallback: null,
    kind: normalized.kind,
    space: normalized.space,
    id: normalized.id || null,
    cell: normalized.cell || null,
    cells: normalized.cells ? [...normalized.cells] : [],
    ownerActorId: normalized.ownerActorId || null,
    normalized: clone(normalized),
    ...extras,
  };
}

function lionwingTypedTargetEntityCells(entity, entityKind) {
  if (!entity) return [];
  if (entityKind === "actor" || entity.kind === "hero" || entity.kind === "enemy" || entity.kind === "crowd" || entity.profileId) {
    const width = Math.max(1, Number(entity.occupiedWidth || entity.width || 1)), height = Math.max(1, Number(entity.occupiedHeight || entity.height || 1));
    if (!Number.isInteger(Number(entity.x)) || !Number.isInteger(Number(entity.y))) return [];
    const cells = [];
    for (let oy = 0; oy < height; oy += 1) for (let ox = 0; ox < width; ox += 1) cells.push(`${Number(entity.x) + ox},${Number(entity.y) + oy}`);
    return cells;
  }
  if (Array.isArray(entity.cells)) return entity.cells.map(lionwingTypedTargetCell).filter(Boolean);
  if (Number.isInteger(Number(entity.x)) && Number.isInteger(Number(entity.y))) return [`${Number(entity.x)},${Number(entity.y)}`];
  return [];
}

function lionwingTypedTargetSpaceCells(scene, normalized, cells = [], options = {}) {
  const space = (scene?.spaces || []).find(item => item.id === normalized.space);
  if (!space) return lionwingTypedTargetFailure(normalized, "Пространство типизированной цели не найдено.", "invalid-space", { spaceObject: null, cells: [...cells] });
  const width = Number(space.width), height = Number(space.height);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 0 || height < 0) return lionwingTypedTargetFailure(normalized, "Пространство типизированной цели содержит некорректные границы.", "invalid-space", { spaceObject: space, cells: [...cells] });
  const invalidCells = cells.filter(cell => {
    const point = lionwingTypedTargetCell(cell), [x, y] = point ? point.split(",").map(Number) : [-1, -1];
    return !point || x < 0 || y < 0 || x >= width || y >= height;
  });
  if (invalidCells.length) return lionwingTypedTargetFailure(normalized, "Клетка типизированной цели находится за пределами поля.", "out-of-bounds", { spaceObject: space, cells: [...cells], invalidCells });
  const rawRemoved = typeof removedCellKeys === "function" ? removedCellKeys(scene, normalized.space) : new Set((scene?.topology?.cuts || []).filter(cut => cut.space === normalized.space).flatMap(cut => cut.cells || []));
  const removed = new Set([...rawRemoved].map(lionwingTypedTargetCell).filter(Boolean));
  const removedCells = cells.filter(cell => removed.has(cell));
  if (removedCells.length && !options.allowRemoved) return lionwingTypedTargetFailure(normalized, "Удалённая клетка не может быть типизированной целью.", "removed-cell", { spaceObject: space, cells: [...cells], removedCells });
  return { ok: true, space, removed, cells: [...cells] };
}

function lionwingTypedTargetOwnerStatus(scene, normalized, entity) {
  if (!normalized.ownerActorId) return { ok: true, ownerActorId: entity?.ownerActorId || null };
  const owner = actorById(scene, normalized.ownerActorId);
  if (!owner) return { ok: false, result: lionwingTypedTargetFailure(normalized, "Владелец типизированной цели больше не находится на Сцене.", "owner-not-found") };
  const actual = entity?.ownerActorId || null;
  if (actual !== normalized.ownerActorId) return { ok: false, result: lionwingTypedTargetFailure(normalized, "Типизированная цель принадлежит другому участнику.", "ownership-mismatch", { actualOwnerActorId: actual }) };
  return { ok: true, ownerActorId: actual };
}

function lionwingTypedTargetEntityVisibility(scene, entity, entityKind, normalized, request = {}) {
  if (!entity) return lionwingTypedTargetFailure(normalized, "Сущность типизированной цели больше не находится на Сцене.", "unknown-id");
  if (entity.hidden || entity.visibility === "hidden" || entityKind === "marker" && entity.kind === "hidden") return lionwingTypedTargetFailure(normalized, "Скрытая сущность не может быть выбрана типизированной целью.", "hidden-entity");
  if (entityKind === "actor" && typeof effectPresenceStatus === "function") {
    const presence = effectPresenceStatus(scene, entity.id);
    if (presence.disappeared && !request.includeDisappeared) return lionwingTypedTargetFailure(normalized, "Исчезнувший персонаж сейчас недоступен как цель.", "disappeared-entity");
  }
  if (entityKind === "actor" && entity.knockedOut && !request.includeKnockedOut) return lionwingTypedTargetFailure(normalized, "Выведенный из боя персонаж недоступен как цель.", "knocked-out-entity");
  return null;
}

function typedTargetStatus(scene, request = {}) {
  const wrapper = lionwingTypedTargetPlain(request) && (request.target || request.typedTarget) ? (request.target || request.typedTarget) : request;
  const normalizedResult = normalizeTypedTarget(wrapper, request);
  if (!normalizedResult.ok) return lionwingTypedTargetFailure(null, normalizedResult.reason, normalizedResult.reasonCode, { normalized: null });
  const normalized = normalizedResult.target;
  if (!lionwingTypedTargetSceneIsLionwing(scene)) return lionwingTypedTargetFailure(normalized, "Типизированные цели доступны только в Сцене редакции LionWing.", "unsupported-edition");
  const sourceActorId = request.sourceActorId || request.sourceId || null;
  const source = sourceActorId ? actorById(scene, sourceActorId) : null;
  if (sourceActorId && !source) return lionwingTypedTargetFailure(normalized, "Исполнитель типизированной цели не найден.", "unknown-source");
  if (source && source.hidden) return lionwingTypedTargetFailure(normalized, "Скрытый исполнитель не может выбирать типизированную цель.", "hidden-source");
  if (request.range != null && (!Number.isFinite(Number(request.range)) || Number(request.range) < 0)) return lionwingTypedTargetFailure(normalized, "Дальность типизированной цели должна быть неотрицательным числом.", "invalid-target");
  if (source && source.space !== normalized.space && request.allowCrossSpace !== true) return lionwingTypedTargetFailure(normalized, "Типизированная цель находится в другом пространстве.", "space-mismatch");
  if (normalized.kind === "cell") {
    if (normalized.ownerActorId) return lionwingTypedTargetFailure(normalized, "У отдельной клетки нет однозначного владельца; передайте выбор Нарратору.", "ownership-mismatch");
    const cellStatus = lionwingTypedTargetSpaceCells(scene, normalized, normalized.cells || [], request);
    if (!cellStatus.ok) return cellStatus;
    const occupants = [], terrainIds = [], blockingTerrainIds = [];
    for (const actor of scene.actors || []) {
      const actorCells = lionwingTypedTargetEntityCells(actor, "actor");
      if (actor.space !== normalized.space || actor.hidden || actor.knockedOut || typeof effectPresenceStatus === "function" && effectPresenceStatus(scene, actor.id).disappeared) continue;
      if (actorCells.some(cell => normalized.cells.includes(cell))) occupants.push(actor.id);
    }
    for (const object of scene.objects || []) {
      if (object.space !== normalized.space || object.hidden || object.visibility === "hidden" || ![...LIONWING_TYPED_TARGET_TERRAIN_TYPES].includes(object.type)) continue;
      if (lionwingTypedTargetEntityCells(object, "object").some(cell => normalized.cells.includes(cell))) {
        terrainIds.push(object.id);
        if (object.type === "terrain") blockingTerrainIds.push(object.id);
      }
    }
    if (request.range != null && source && (normalized.cells || []).some(cell => modifierRangeDistance(scene, source, { space: normalized.space, ...spatialPoint(cell) }) > Number(request.range))) return lionwingTypedTargetFailure(normalized, "Клетка типизированной цели находится вне допустимой дальности.", "out-of-range", { spaceObject: cellStatus.space, occupants, terrainIds });
    const requireFree = request.requireFree === true || request.placement === true || request.intent === "placement" || request.mode === "placement";
    if (requireFree && occupants.length) return lionwingTypedTargetFailure(normalized, "Клетка типизированной цели уже занята.", "occupied-cell", { spaceObject: cellStatus.space, occupants, terrainIds });
    if (requireFree && blockingTerrainIds.length) return lionwingTypedTargetFailure(normalized, "Клетка типизированной цели занята непроходимой местностью.", "blocked-terrain", { spaceObject: cellStatus.space, occupants, terrainIds, blockingTerrainIds });
    return lionwingTypedTargetSuccess(normalized, { spaceObject: cellStatus.space, occupants, occupantIds: [...occupants], terrainIds, blockingTerrainIds, occupied: occupants.length > 0, blocked: blockingTerrainIds.length > 0 });
  }
  const collections = normalized.kind === "actor"
    ? [{ entityKind: "actor", values: scene.actors || [] }]
    : normalized.kind === "terrain"
      ? [{ entityKind: "object", values: (scene.objects || []).filter(object => LIONWING_TYPED_TARGET_TERRAIN_TYPES.has(object.type)) }]
      : normalized.kind === "wall"
        ? [{ entityKind: "wall", values: scene.walls || [] }]
        : [{ entityKind: "actor", values: scene.actors || [] }, { entityKind: "object", values: scene.objects || [] }, { entityKind: "marker", values: scene.markers || [] }];
  const entityKindFilter = normalized.entityKind || null;
  const matches = collections.flatMap(collection => collection.values.filter(entity => entity.id === normalized.id && (!entityKindFilter || collection.entityKind === entityKindFilter)).map(entity => ({ entity, entityKind: collection.entityKind })));
  if (!matches.length) return lionwingTypedTargetFailure(normalized, `Сущность с ID «${normalized.id}» не найдена в пространстве Сцены.`, "unknown-id");
  if (matches.length > 1) return lionwingTypedTargetFailure(normalized, "ID типизированной цели неоднозначен: найдено несколько сущностей.", "ambiguous-target", { matches: matches.map(item => item.entityKind) });
  const { entity, entityKind } = matches[0];
  if (entity.space !== normalized.space) return lionwingTypedTargetFailure(normalized, "Типизированная цель находится в другом пространстве.", "space-mismatch", { entity, entityKind });
  const visibilityFailure = lionwingTypedTargetEntityVisibility(scene, entity, entityKind, normalized, request);
  if (visibilityFailure) return visibilityFailure;
  const ownerStatus = lionwingTypedTargetOwnerStatus(scene, normalized, entity);
  if (!ownerStatus.ok) return ownerStatus.result;
  if (normalized.kind === "wall") {
    const endpoints = [lionwingTypedTargetCell(entity.a), lionwingTypedTargetCell(entity.b)];
    if (endpoints.some(cell => !cell)) return lionwingTypedTargetFailure(normalized, "Стена не содержит двух канонических граничных клеток.", "invalid-target", { entity, entityKind });
    const endpointStatus = lionwingTypedTargetSpaceCells(scene, normalized, endpoints, request);
    if (!endpointStatus.ok) return endpointStatus;
    if (normalized.cells?.some(cell => !endpoints.includes(cell))) return lionwingTypedTargetFailure(normalized, "Клетка типизированной стены не совпадает с её граничными клетками.", "target-cell-mismatch", { entity, entityKind, endpoints });
    return lionwingTypedTargetSuccess(normalized, { target: clone(entity), entity, entityKind, spaceObject: endpointStatus.space, endpoints, cells: endpoints });
  }
  const entityCells = lionwingTypedTargetEntityCells(entity, entityKind);
  if (entityKind === "actor" && !entityCells.length) return lionwingTypedTargetFailure(normalized, "Персонаж не содержит корректной позиции на поле.", "invalid-target", { target: clone(entity), entity, entityKind });
  if (entityKind === "object" && normalized.kind === "terrain" && (!Array.isArray(entity.cells) || !entity.cells.length || entityCells.length !== entity.cells.length)) return lionwingTypedTargetFailure(normalized, "Местность не содержит корректных клеток поля.", "invalid-target", { target: clone(entity), entity, entityKind });
  if (entityKind !== "actor" && Array.isArray(entity.cells) && entity.cells.length !== entityCells.length) return lionwingTypedTargetFailure(normalized, "Сущность содержит некорректные клетки поля.", "invalid-target", { target: clone(entity), entity, entityKind });
  if (entityKind !== "actor" && new Set(entityCells).size !== entityCells.length) return lionwingTypedTargetFailure(normalized, "Сущность содержит повторные клетки поля.", "invalid-target", { target: clone(entity), entity, entityKind });
  const entityCellStatus = entityCells.length ? lionwingTypedTargetSpaceCells(scene, normalized, entityCells, request) : { ok: true, space: (scene.spaces || []).find(item => item.id === normalized.space), removed: new Set(), cells: [] };
  if (!entityCellStatus.ok) return entityCellStatus;
  if (normalized.cells?.some(cell => !entityCells.includes(cell))) return lionwingTypedTargetFailure(normalized, "Выбранная клетка не принадлежит указанной сущности.", "target-cell-mismatch", { target: clone(entity), entity, entityKind, entityCells });
  if (normalized.cell && !entityCells.includes(normalized.cell)) return lionwingTypedTargetFailure(normalized, "Выбранная клетка не принадлежит указанной сущности.", "target-cell-mismatch", { target: clone(entity), entity, entityKind, entityCells });
  if (request.range != null && source && entityKind !== "wall" && (!entityCells.length || entityCells.every(cell => modifierRangeDistance(scene, source, { space: normalized.space, ...spatialPoint(cell) }) > Number(request.range)))) return lionwingTypedTargetFailure(normalized, "Типизированная цель находится вне допустимой дальности.", "out-of-range", { target: clone(entity), entity, entityKind, entityCells });
  return lionwingTypedTargetSuccess(normalized, { target: clone(entity), entity, entityKind, spaceObject: entityCellStatus.space, entityCells, cells: entityCells, actualOwnerActorId: ownerStatus.ownerActorId });
}

function typedTargetsStatus(scene, value, options = {}) {
  const normalized = normalizeTypedTargets(value, options);
  if (!normalized.ok) return { available: false, reason: normalized.reason, reasonCode: normalized.reasonCode, code: normalized.reasonCode, manualFallback: true, manual: true, fallback: "manual", typedTargets: [], statuses: [], targetIds: [], targetCells: [], terrainIds: [], wallIds: [], entityIds: [] };
  const statuses = normalized.targets.map(target => typedTargetStatus(scene, { ...options, target }));
  const firstFailure = statuses.find(status => !status.available);
  const spaces = [...new Set(normalized.targets.map(target => target.space))];
  const sameSpaceRequired = options.allowCrossSpace !== true && options.sameSpace !== false;
  if (!firstFailure && sameSpaceRequired && spaces.length > 1) return { available: false, reason: "Типизированные цели находятся в разных пространствах.", reasonCode: "space-mismatch", code: "space-mismatch", manualFallback: false, manual: false, fallback: null, typedTargets: normalized.targets.map(clone), statuses, targetIds: [], targetCells: [], terrainIds: [], wallIds: [], entityIds: [] };
  const unique = values => [...new Set(values.filter(Boolean))];
  const targetIds = unique(statuses.filter(status => status.available && status.entityKind === "actor").map(status => status.id));
  const targetCells = unique(statuses.filter(status => status.available && status.kind === "cell").flatMap(status => status.cells || []));
  const terrainIds = unique(statuses.filter(status => status.available && status.kind === "terrain").map(status => status.id));
  const wallIds = unique(statuses.filter(status => status.available && status.kind === "wall").map(status => status.id));
  const entityIds = unique(statuses.filter(status => status.available && status.kind === "entity").map(status => status.id));
  const available = !firstFailure;
  return {
    available,
    reason: firstFailure?.reason || "",
    reasonCode: firstFailure?.reasonCode || "",
    code: firstFailure?.reasonCode || "",
    manualFallback: Boolean(firstFailure?.manualFallback),
    manual: Boolean(firstFailure?.manualFallback),
    fallback: firstFailure?.manualFallback ? "manual" : null,
    typedTargets: normalized.targets.map(clone),
    statuses,
    targetIds,
    targetCells,
    terrainIds,
    wallIds,
    entityIds,
    spaces,
    count: normalized.targets.length,
  };
}

function typedTargetInputsFromRequest(request = {}) {
  if (!lionwingTypedTargetPlain(request)) return null;
  if (request.typedTargets != null) return request.typedTargets;
  if (request.typedTarget != null) return request.typedTarget;
  if (request.target != null && lionwingTypedTargetObject(request.target)) return request.target;
  if (Array.isArray(request.targets) && request.targets.some(item => lionwingTypedTargetObject(item))) return request.targets.filter(item => lionwingTypedTargetObject(item));
  if (lionwingTypedTargetObject(request.targets)) return request.targets;
  const typedIds = Array.isArray(request.targetIds) && request.targetIds.filter(item => lionwingTypedTargetObject(item));
  if (typedIds?.length) return typedIds;
  if (lionwingTypedTargetObject(request.targetIds)) return request.targetIds;
  const typedCells = Array.isArray(request.targetCells) && request.targetCells.filter(item => lionwingTypedTargetObject(item));
  if (typedCells?.length) return typedCells;
  return lionwingTypedTargetObject(request.targetCells) ? request.targetCells : null;
}

function normalizeLionwingActionTargetRequest(scene, request = {}) {
  const typedInput = typedTargetInputsFromRequest(request);
  let typedStatus = null;
  const coordinateTargets = [];
  if (typedInput != null) {
    typedStatus = typedTargetsStatus(scene, typedInput, { sourceActorId: request.sourceActorId || request.actorId, intent: "target" });
    if (!typedStatus.available) return { request, errors: [typedStatus.reason || "Типизированная цель недоступна."], typedTargets: typedStatus };
    const unsupportedKind = typedStatus.statuses.find(status => !["actor", "cell"].includes(status.kind));
    if (unsupportedKind) return { request, errors: ["Это действие ещё не поддерживает типизированную местность, стену или принадлежащую сущность; передайте выбор Нарратору."], typedTargets: { ...typedStatus, available: false, reason: "Базовое действие ещё не поддерживает эту типизированную цель.", reasonCode: "manual-only-kind", code: "manual-only-kind", manualFallback: true, manual: true, fallback: "manual" } };
  }
  const legacyIds = Array.isArray(request.targetIds) ? request.targetIds.filter(item => typeof item === "string") : [];
  const legacyCells = Array.isArray(request.targetCells) ? request.targetCells.filter(item => typeof item === "string") : [];
  const next = typedStatus ? { ...request, targetIds: [...new Set([...legacyIds, ...typedStatus.targetIds])], targetCells: [...new Set([...legacyCells, ...typedStatus.targetCells])] } : { ...request };
  if (lionwingTypedTargetPlain(next.options)) next.options = { ...next.options };
  const coordinateFields = [
    [next, "destination"], [next, "attackModifierDestination"], [next, "armamentDestination"],
    [next.options, "destination"], [next.options, "reappearance"],
  ];
  for (const [container, field] of coordinateFields) {
    const value = container?.[field];
    if (!lionwingTypedTargetObject(value)) continue;
    const status = typedTargetStatus(scene, { sourceActorId: request.sourceActorId || request.actorId, target: value, intent: "target" });
    if (!status.available || status.kind !== "cell" || (status.cells || []).length !== 1) return { request, errors: [status.reason || `Типизированная клетка ${field} недоступна.`], typedTargets: status };
    coordinateTargets.push(status.normalized);
    container[field] = { space: status.space, ...spatialPoint(status.cell) };
  }
  if (coordinateTargets.length) {
    const allTargets = [...(typedStatus?.typedTargets || []), ...coordinateTargets];
    typedStatus = typedTargetsStatus(scene, allTargets, { sourceActorId: request.sourceActorId || request.actorId, intent: "target" });
  }
  return { request: next, errors: [], typedTargets: typedStatus };
}

function targetStatus(scene, request = {}) {
  const typedInput = typedTargetInputsFromRequest(request);
  const typedStatus = typedInput == null ? null : typedTargetsStatus(scene, typedInput, { sourceActorId: request.sourceActorId, intent: "target", includeKnockedOut: Boolean(request.includeKnockedOut), includeDisappeared: Boolean(request.includeDisappeared) });
  if (typedStatus && !typedStatus.available) return { ...typedStatus, targetIds: typedStatus.targetIds || [], targetCells: typedStatus.targetCells || [] };
  const source = actorById(scene, request.sourceActorId);
  const requested = [...new Set([
    ...(Array.isArray(request.targetIds) ? request.targetIds : []).filter(id => typeof id === "string"),
    ...(typedStatus?.targetIds || []),
  ])];
  const rawMinimum = Number(request.min ?? 1), rawMaximum = Number(request.max ?? 40);
  if (!Number.isFinite(rawMinimum) || !Number.isFinite(rawMaximum) || rawMinimum < 0 || rawMaximum < rawMinimum) return { available: false, reason: "Некорректные ограничения целей.", targetIds: [], invalidIds: requested, ...(typedStatus ? { typedTargets: typedStatus.typedTargets, targetCells: typedStatus.targetCells } : {}) };
  const minimum = Math.floor(rawMinimum), maximum = Math.floor(rawMaximum);
  if (!source) return { available: false, reason: "Исполнитель не найден.", targetIds: [], invalidIds: requested, ...(typedStatus ? { typedTargets: typedStatus.typedTargets, targetCells: typedStatus.targetCells } : {}) };
  const valid = new Set(actorIdsInRange(scene, source.id, request.range ?? Infinity, {
    audience: request.audience || "any",
    team: request.team,
    includeSelf: Boolean(request.includeSelf),
    includeKnockedOut: Boolean(request.includeKnockedOut),
    excludeIds: request.excludeIds,
  }).filter(id => request.ignoreWalls || wallTargetingStatus(scene, source.id, id, { range: request.range }).available));
  const invalidIds = requested.filter(id => !valid.has(id));
  const extra = typedStatus ? { typedTargets: typedStatus.typedTargets, targetCells: typedStatus.targetCells, typedTargetStatuses: typedStatus.statuses } : {};
  const selectionCount = requested.length + Number(typedStatus?.targetCells?.length || 0) + Number(typedStatus?.terrainIds?.length || 0) + Number(typedStatus?.wallIds?.length || 0) + Number(typedStatus?.entityIds?.length || 0);
  if (invalidIds.length) return { available: false, reason: "Среди целей есть недоступные персонажи.", targetIds: requested.filter(id => valid.has(id)), invalidIds, ...extra };
  if (selectionCount < minimum) return { available: false, reason: `Нужно выбрать целей: минимум ${minimum}.`, targetIds: requested, invalidIds: [], ...extra };
  if (selectionCount > maximum) return { available: false, reason: `Можно выбрать целей: максимум ${maximum}.`, targetIds: requested.slice(0, maximum), invalidIds: requested.slice(maximum), ...extra };
  return { available: true, reason: "", targetIds: requested, invalidIds: [], ...extra };
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
  const compound = compoundEnemyStatus(scene, actor), expiresAt = duration === "default" ? compound.active ? "в конце Раунда (Составной враг)" : "в конце собственного Хода, кроме Хода применения"
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
  const compound = compoundEnemyStatus(scene, actorId);
  if (status.duration === "default" && compound.active && eventType === "round.end") {
    expires = true;
    reason = "Эффект Составного врага сохранялся до конца Раунда.";
  } else if (status.duration === "default" && !compound.active && eventType === "turn.end" && boundaryActorId === actorId) {
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
  // The Guardian prevents opponents from targeting the Healer.  It is not a
  // blanket untargetable flag: the Healer and its allies must still be able to
  // heal or otherwise help it while the passive is active.
  if (!options.ignoreHealerGuardian && source.team !== target.team && target.profileId === "enemy.common.healer" && target.ruleState?.healerGuardianId) {
    const guardian = actorById(scene, target.ruleState.healerGuardianId);
    if (guardian && !guardian.knockedOut && guardian.id !== target.id && guardian.space === target.space && distance(target, guardian) <= 1 && effectTargetingStatus(scene, sourceActorId, guardian.id, { ...options, ignoreHealerGuardian: true }).available) return { available: false, reason: `${target.name} защищён смежным Стражем ${guardian.name}.`, source, target, guardian };
  }
  if(source.team===target.team&&[ENEMY_MODIFIER_IDS.collateral,ENEMY_MODIFIER_IDS.vip,LIONWING_COLLATERAL_ID,LIONWING_VIP_ID].includes(target.profileId)){
    const canonicalProtected=[LIONWING_COLLATERAL_ID,LIONWING_VIP_ID].includes(target.profileId);
    const protectedBy=(scene.actors||[]).find(item=>item.team!==target.team&&!item.knockedOut&&item.id!==target.id&&item.space===target.space&&distance(item,target)<=1&&(canonicalProtected?(item.kind==="hero"&&!item.profileId||(item.ownerId||item.heroId)&&(scene.actors||[]).some(owner=>owner.id===(item.ownerId||item.heroId)&&owner.kind==="hero"&&!owner.profileId)):item.kind==="hero"||item.heroId));
    if(protectedBy)return{available:false,reason:`${target.name} нельзя ранить врагом рядом с ${protectedBy.name}.`,source,target,guardian:protectedBy};
  }
  return { available: true, reason: "", source, target };
}

function effectMovementStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Перемещаемый персонаж не найден.", actor: null, multiplier: 1, distance: 0, blockers: [] };
  if (actor.kind === "crowd" && !request.placement) return { available: false, reason: "Зоны массовки перемещаются только после Хода врага.", actor, multiplier: 1, distance: 0, blockers: ["Массовка"] };
  const forced = Boolean(request.forced), placement = Boolean(request.placement), blockers = [];
  if (!placement && forced && hasEffect(scene, actor, "positive.устойчив") && !request.ignoreResistance) blockers.push("Устойчив");
  if (!placement && !forced && !request.ignoreVoluntaryRestrictions) {
    if (hasEffect(scene, actor, "negative.обездвижен")) blockers.push("Обездвижен");
    if (hasEffect(scene, actor, "negative.подброшен")) blockers.push("Подброшен");
    if (hasEffect(scene, actor, "negative.пойман")) blockers.push("Пойман");
  }
  const executioner = actor.profileId === "enemy.common.executioner";
  if (executioner && !placement && !forced) blockers.splice(0, blockers.length);
  const accelerated = hasEffect(scene, actor, "positive.ускорен"), slowed = !executioner && hasEffect(scene, actor, "negative.замедлен");
  const multiplier = accelerated === slowed ? 1 : accelerated ? 2 : .5;
  const baseDistance = Math.max(0, Number(request.distance ?? request.maximum ?? 0));
  const adjustedDistance = multiplier < 1 ? Math.floor(baseDistance * multiplier) : baseDistance * multiplier;
  const reason = forced && blockers.includes("Устойчив")
    ? "Устойчивого персонажа нельзя перемещать против воли."
    : blockers.length ? `${blockers.join(", ")} запрещает добровольное перемещение.` : "";
  return { available: !blockers.length, reason, actor, forced, placement, multiplier, distance: adjustedDistance, blockers };
}

function effectCellOccupancyStatus(scene, actorId, request = {}) {
  const typedDestination = (lionwingTypedTargetPlain(request.destination) && request.destination.kind ? request.destination : null)
    || (lionwingTypedTargetPlain(request.typedTarget) && request.typedTarget.kind ? request.typedTarget : null)
    || (lionwingTypedTargetObject(request) ? request : null);
  let typedDestinationStatus = null;
  if (typedDestination) {
    typedDestinationStatus = typedTargetStatus(scene, { ...request, sourceActorId: actorId, target: typedDestination, intent: "target", includeKnockedOut: true });
    if (!typedDestinationStatus.available || typedDestinationStatus.kind !== "cell" || (typedDestinationStatus.cells || []).length !== 1) return { ...typedDestinationStatus, actor: actorById(scene, actorId), blockers: [] };
    request = { ...request, space: typedDestinationStatus.space, ...spatialPoint(typedDestinationStatus.cell) };
  }
  const actor = request.actor || actorById(scene, actorId) || null, space = request.space || actor?.space, x = Number(request.x), y = Number(request.y);
  if (!actor || !space || !Number.isInteger(x) || !Number.isInteger(y)) return { available: false, reason: "Некорректная клетка назначения.", actor, blockers: [] };
  const battlefield = (scene.spaces || []).find(item => item.id === space);
  if (battlefield?.mode === "cinematic") return { available: true, reason: "", actor, blockers: [] };
  const banished = hasEffect(scene, actor, "positive.изгнан");
  const compoundId = (actor.kind === "enemy" || actor.profileId) && typeof actor.compoundId === "string" && actor.compoundId.trim() ? actor.compoundId.trim() : null;
  const width=Math.max(1,Number(actor.occupiedWidth||1)),height=Math.max(1,Number(actor.occupiedHeight||1));if(x+width>Number(battlefield?.width||0)||y+height>Number(battlefield?.height||0))return{available:false,reason:"Фигура целиком не помещается на поле.",actor,blockers:[]};
  const overlaps=other=>x<Number(other.x)+Math.max(1,Number(other.occupiedWidth||1))&&x+width>Number(other.x)&&y<Number(other.y)+Math.max(1,Number(other.occupiedHeight||1))&&y+height>Number(other.y);
  const blockers = (scene.actors || []).filter(other => other.id !== actor.id && other.space === space && overlaps(other))
    .filter(other => effectPresenceStatus(scene, other.id).onField)
    .filter(other => !other.knockedOut)
    .filter(other => actor.kind !== "crowd" && other.kind !== "crowd")
    .filter(other => !compoundId || other.team !== actor.team || String(other.compoundId || "").trim() !== compoundId)
    .filter(other => !banished && !hasEffect(scene, other, "positive.изгнан"));
  const footprint=[];for(let oy=0;oy<height;oy++)for(let ox=0;ox<width;ox++)footprint.push(`${x+ox},${y+oy}`);const terrain = !banished && (scene.objects || []).find(object => object.space === space && object.type === "terrain" && (object.cells || []).some(cell=>footprint.includes(cell)));
  return { available: blockers.length === 0 && !terrain, reason: blockers.length ? "Клетка назначения уже занята." : terrain ? "Клетка занята непроходимой местностью." : "", actor, blockers: terrain ? blockers.concat(terrain) : blockers, ...(typedDestinationStatus ? { typedTarget: typedDestinationStatus.normalized } : {}) };
}

function effectAttackStatus(scene, sourceActorId, targetIds = []) {
  const source = actorById(scene, sourceActorId), targets = [...new Set(targetIds || [])].map(id => actorById(scene, id)).filter(Boolean);
  if (!source) return { available: false, reason: "Атакующий не найден.", source: null, targets, damageModifier: 0, damageByTarget: {}, hindrance: 0, hindranceEffects: [] };
  const tier = Number(source.tier || 1);
  const damageModifier = (hasEffect(scene, source, "positive.усилен") ? tier : 0) - (hasEffect(scene, source, "negative.ослаблен") ? tier : 0);
  // Marked adds the defender's Tier only after an Attack actually deals
  // damage. Applying it here would use the attacker's Tier and let Armor or
  // Evasion absorb a bonus that has not triggered yet.
  const damageByTarget = Object.fromEntries(targets.map(target => [target.id, 0]));
  const targetSet = new Set(targets.map(target => target.id)), hindranceEffects = [];
  const frightened = effectStateFor(source, "negative.испуган");
  if (frightened?.sources.some(item => targetSet.has(item.actorId))) hindranceEffects.push("Испуган");
  const taunted = effectStateFor(source, "negative.спровоцирован");
  if (taunted?.sources.length && !taunted.sources.some(item => targetSet.has(item.actorId))) {
    hindranceEffects.push("Спровоцирован");
    if (taunted.sources.some(item => actorById(scene, item.actorId)?.ruleState?.imposingPresence)) hindranceEffects.push("Внушительное присутствие");
  }
  return { available: true, reason: "", source, targets, damageModifier, damageByTarget, hindrance: hindranceEffects.length * tier, hindranceEffects };
}

function effectDefenseStatus(scene, targetActorId) {
  const target = actorById(scene, targetActorId);
  if (!target) return { available: false, reason: "Защищающийся не найден.", target: null, armorAllowed: false, armorBonus: 0, dodgeAllowed: false, dodgeReason: "" };
  const compound = compoundEnemyStatus(scene, target), defendedParts = compound.active ? compound.parts : [target];
  const armorAllowed = !defendedParts.some(part => hasEffect(scene, part, "negative.разорван"));
  const fortifiedBonus = armorAllowed && defendedParts.some(part => hasEffect(scene, part, "positive.укреплен")) ? Math.max(...defendedParts.map(part => Number(part.tier || 1))) : 0;
  const chargedBonus = armorAllowed ? Math.max(0, ...defendedParts.filter(part => ["enemy.common.executioner","lionwing.npc.executioner"].includes(part.profileId) && hasEffect(scene, part, "positive.заряжен")).map(part => part.profileId === "lionwing.npc.executioner" ? 1 + Number(part.tier || 1) : 3 + Math.floor(Number(part.tier || 1) / 2))) : 0;
  const armorBonus = fortifiedBonus + chargedBonus;
  const dodgeBlockers = [
    defendedParts.some(part => hasEffect(scene, part, "negative.обездвижен")) && "Обездвижен",
    defendedParts.some(part => hasEffect(scene, part, "negative.пойман")) && "Пойман",
    defendedParts.some(part => hasEffect(scene, part, "negative.подброшен")) && "Подброшен",
  ].filter(Boolean);
  return {
    available: true,
    reason: "",
    target,
    compound,
    armorAllowed,
    armorBonus,
    dodgeAllowed: dodgeBlockers.length === 0,
    dodgeReason: dodgeBlockers.length ? `${dodgeBlockers.join(", ")} не позволяет получить преимущество Уворота.` : "",
  };
}

function attackModifierStatus(scene, sourceActorId, targetIds = [], selectedIds = [], request = {}) {
  const source = actorById(scene, sourceActorId), targets = [...new Set(targetIds || [])].map(id => actorById(scene, id)).filter(Boolean), actionId = canonicalActionId(String(request.actionId || request.actionName || ""));
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
  if (Number(source.techniques?.["bulwark.grappler"] || 0) >= 2 && targets.length === 1 && launchedTargets.length === 1 && (!actionId || actionIdIs(actionId, "skirmish"))) {
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
      actionTransform: { actionKey: "finish", actionName: "Завершение", attribute: "body", costActionKey: "skirmish", costActionName: "Стычка", ruleId: "bulwark.grappler.2" },
      ruleId: "bulwark.grappler.2",
    });
  }
  if (Number(source.techniques?.["vagabond.dim-mak"] || 0) >= 1 && targets.length === 1 && (!actionId || ["skirmish", "spell", "finish"].some(key => actionIdIs(actionId, key)))) {
    const target = targets[0];
    const attackOrigin = request.origin && Number.isInteger(Number(request.origin.x)) && Number.isInteger(Number(request.origin.y))
      ? { space: request.origin.space || source.space, x: Number(request.origin.x), y: Number(request.origin.y) }
      : source;
    const weakPoints = (scene.markers || []).filter(marker =>
      marker.ruleId === "vagabond.dim-mak.1"
      && marker.ownerActorId === source.id
      && marker.metadata?.carrierActorId === target.id
      && marker.space === attackOrigin.space
      && Number(marker.x) === Number(attackOrigin.x)
      && Number(marker.y) === Number(attackOrigin.y)
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
  const visibleLog = [];
  for (const item of scene.log || []) {
    if (item.type === "movement-traces.clear") break;
    visibleLog.push(item);
  }
  for (const actor of scene.actors || []) {
    if (actor.space !== space) continue;
    const event = visibleLog.find(item => item.type === "actor.move" && item.actorId === actor.id && item.payload?.trace !== false && item.payload?.from && (item.payload.space || item.payload.from.space) === space);
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

// scene-engine.js assembles the public Engine object after this file loads.
// Keep the contract available both as a small standalone bridge and on that
// object without widening the reducer or adding a second writer.
(function installLionwingTargetContract(root) {
  const api = Object.freeze({
    LIONWING_TYPED_TARGET_KINDS,
    normalizeTypedTarget,
    normalizeTypedTargets,
    typedTargetStatus,
    typedTargetsStatus,
    targetContractStatus: typedTargetStatus,
    normalizeLionwingActionTargetRequest,
  });
  root.DAWN_LIONWING_TARGETS = api;
  const descriptor = Object.getOwnPropertyDescriptor(root, "DAWN_SCENE_ENGINE");
  if (descriptor && !descriptor.configurable) {
    if (descriptor.value && typeof descriptor.value === "object") Object.assign(descriptor.value, api);
    return;
  }
  let engine = descriptor?.value;
  Object.defineProperty(root, "DAWN_SCENE_ENGINE", {
    configurable: true,
    enumerable: true,
    get: () => engine,
    set: value => {
      engine = value;
      if (value && typeof value === "object") Object.assign(value, api);
    },
  });
})(typeof window === "object" ? window : globalThis);
