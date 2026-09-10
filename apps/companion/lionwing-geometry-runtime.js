"use strict";

// A small, JSON-only contract for the three spatial operations which do not
// have the same semantics as an ordinary route: placing a body, teleporting a
// body, and displacing a body along a straight line.  The reducer owns the
// actual Scene transition.  This module owns the intent, the read-only
// validation and the evidence the reducer must check again at commit time.
//
// The module deliberately sits above lionwing-geometry.js.  It uses that
// module's geometry stamp and footprint query when they are available, and
// keeps a conservative fallback for tests or old pages that have not loaded
// the complete stack yet.  No functions, DOM nodes or live Scene references
// are stored in a plan.
(function installLionwingGeometryRuntime(global) {
  const SCHEMA = 1;
  const KIND = "lionwing.geometry.runtime";
  const MAX_JOURNAL = 256;
  const OPERATIONS = Object.freeze(["placement", "teleport", "displacement"]);
  const DIRECTIONS = Object.freeze({
    north: { x: 0, y: -1 },
    northeast: { x: 1, y: -1 },
    east: { x: 1, y: 0 },
    southeast: { x: 1, y: 1 },
    south: { x: 0, y: 1 },
    southwest: { x: -1, y: 1 },
    west: { x: -1, y: 0 },
    northwest: { x: -1, y: -1 },
  });

  let serial = 0;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const object = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const actorById = (scene, id) => (scene?.actors || []).find(actor => actor?.id === id) || null;
  const spaceById = (scene, id) => (scene?.spaces || []).find(space => space?.id === id) || null;
  const pointKey = point => `${point?.space || ""}:${Number(point?.x)},${Number(point?.y)}`;
  const cellKey = point => `${Number(point?.x)},${Number(point?.y)}`;
  const live = actor => Boolean(actor && !actor.knockedOut);
  const disappeared = actor => Boolean(actor && ((actor.effects || []).includes("positive.исчез") || actor.effectStates?.["positive.исчез"]));
  const exile = actor => Boolean(actor && (actor.effects || []).includes("positive.изгнан"));
  const fail = (message, code = "LIONWING_GEOMETRY_RUNTIME_BLOCKED", details = {}) => {
    const error = new Error(String(message));
    error.code = code;
    Object.assign(error, details);
    throw error;
  };
  const integer = (value, label, maximum = 9999) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0 || number > maximum) fail(`Некорректное значение: ${label}`, "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return number;
  };
  const boundedString = (value, label, maximum = 180, fallback = null) => {
    if (value == null && fallback != null) return fallback;
    if (typeof value !== "string" || !value.trim() || value.length > maximum) fail(`Некорректное значение: ${label}`, "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return value.trim();
  };

  function geometryApi() {
    return global.DAWN_LIONWING_GEOMETRY || null;
  }

  function sceneApi() {
    return global.DAWN_SCENE_ENGINE || null;
  }

  function geometryStamp(scene) {
    const api = geometryApi();
    if (typeof api?.geometryStamp === "function") return api.geometryStamp(scene);
    return JSON.stringify({
      version: Number(scene?.version || 0),
      spaces: (scene?.spaces || []).map(space => ({ id: space.id, width: space.width, height: space.height, mode: space.mode || "" })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
      actors: (scene?.actors || []).map(actor => ({ id: actor.id, space: actor.space, x: actor.x, y: actor.y, width: actor.occupiedWidth || 1, height: actor.occupiedHeight || 1, knockedOut: Boolean(actor.knockedOut), effects: actor.effects || [] })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
      markers: (scene?.markers || []).map(marker => ({ id: marker.id, space: marker.space, x: marker.x, y: marker.y })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
      objects: (scene?.objects || []).map(item => ({ id: item.id, space: item.space, type: item.type, cells: [...(item.cells || [])].sort() })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
      walls: (scene?.walls || []).map(wall => ({ id: wall.id, space: wall.space, a: wall.a, b: wall.b })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
      cuts: (scene?.topology?.cuts || []).map(cut => ({ id: cut.id, space: cut.space, cells: [...(cut.cells || [])].sort(), crossing: cut.crossing || "blocked" })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
    });
  }

  // Area targeting is a read-only plan.  The action reducer owns payment and
  // damage; this contract owns only the canonical center, shape, cells and
  // derived targets.  Keeping it here lets all future area techniques share
  // the same snapshot/revalidation boundary as placement and teleport.
  const AREA_SHAPES = Object.freeze(["adjacent", "square2", "square3", "square5", "line"]);
  const AREA_RULES = Object.freeze({
    adjacent: { shape: "adjacent", range: 4, includeAnchor: true },
    square2: { shape: "square", width: 2, height: 2, range: 1 },
    square3: { shape: "square", width: 3, height: 3, range: 5 },
    square5: { shape: "square", width: 5, height: 5, range: 6 },
    line: { shape: "line", range: 1, includeAnchor: true, full: true },
  });

  function areaSpacePoint(scene, source, raw) {
    const point = normalizePoint(raw, source?.space, "центр области");
    const space = spaceById(scene, point.space);
    if (!space) fail("Пространство области не найдено", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    if (point.x >= Number(space.width) || point.y >= Number(space.height)) fail("Центр области находится вне поля", "LIONWING_GEOMETRY_RUNTIME_DESTINATION_BLOCKED");
    if (removedCells(scene, point.space).has(cellKey(point))) fail("Центр области находится в удалённой клетке", "LIONWING_GEOMETRY_RUNTIME_DESTINATION_BLOCKED");
    return point;
  }

  function sourceDistanceToPoint(source, point) {
    const width = Math.max(1, Number(source?.occupiedWidth || 1));
    const height = Math.max(1, Number(source?.occupiedHeight || 1));
    let best = Infinity;
    for (let oy = 0; oy < height; oy += 1) for (let ox = 0; ox < width; ox += 1) {
      best = Math.min(best, Math.abs(point.x - (Number(source.x) + ox)) + Math.abs(point.y - (Number(source.y) + oy)));
    }
    return best;
  }

  function areaCells(scene, source, center, rule, request) {
    const query = global.DAWN_SCENE_ENGINE?.spatialShapeStatus;
    if (typeof query !== "function") fail("Общий планировщик форм области недоступен");
    const shape = rule.shape === "adjacent" ? "adjacent" : rule.shape === "line" ? "line" : "square";
    const result = query(scene, {
      space: center.space,
      anchor: { x: center.x, y: center.y },
      shape,
      width: rule.width,
      height: rule.height,
      includeAnchor: rule.includeAnchor,
      ...(rule.shape === "line" ? { full: true, orientation: request.orientation || "horizontal" } : {}),
      // Finishers affect enemies in their selected area.  The common query
      // also accounts for occupiedWidth/occupiedHeight and effect targeting.
      sourceActorId: source.id,
      targets: { audience: request.targetAudience === "all" ? "all" : "enemies", includeSelf: false },
    });
    if (!result.available) fail(result.reason || "Форма области недоступна", "LIONWING_GEOMETRY_RUNTIME_DESTINATION_BLOCKED");
    const removed = removedCells(scene, center.space);
    const cells = result.cells
      .map(cell => {
        if (typeof cell === "string") { const [x, y] = cell.split(",").map(Number); return { space: center.space, x, y }; }
        return { space: center.space, x: Number(cell.x), y: Number(cell.y) };
      })
      .filter(cell => !removed.has(cellKey(cell)));
    const wanted = new Set(cells.map(cellKey));
    const targetIds = (scene.actors || []).filter(actor => {
      if (!live(actor) || actor.space !== center.space || actor.id === source.id || request.targetAudience !== "all" && actor.team === source.team) return false;
      if (disappeared(actor) || exile(actor) !== exile(source)) return false;
      return actorCells(actor).some(cell => wanted.has(cellKey(cell)));
    }).map(actor => actor.id);
    const occupied = new Set();
    // "Empty space" means no character stands in the selected cell, even if
    // that character is an ally and therefore is not a Finisher target.
    for (const participant of scene.actors || []) {
      if (!participant || participant.space !== center.space) continue;
      for (const actorCell of actorCells(participant)) occupied.add(cellKey(actorCell));
    }
    return { cells, targetIds, emptyTargetCount: cells.filter(cell => !occupied.has(cellKey(cell))).length };
  }

  function normalizeAreaRequest(scene, request = {}) {
    if (!object(request)) fail("План области должен быть объектом", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const sourceActorId = request.sourceActorId || request.actorId;
    const source = actorById(scene, sourceActorId);
    if (!source || !live(source)) fail("Автор области отсутствует или выведен из боя", "LIONWING_GEOMETRY_RUNTIME_SOURCE_MISSING");
    const rawShape = String(request.shape || request.areaShape || "");
    const shapeKey = rawShape === "square" ? `square${Number(request.width || 0)}` : rawShape;
    const rule = AREA_RULES[shapeKey];
    if (!rule) fail("Неизвестная форма области", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const center = areaSpacePoint(scene, source, request.center || request.anchor);
    const range = Number(request.range == null ? rule.range : request.range);
    if (!Number.isSafeInteger(range) || range < 0 || source.space !== center.space || sourceDistanceToPoint(source, center) > range) fail(`Центр области находится вне дальности ${range}`, "LIONWING_GEOMETRY_RUNTIME_RANGE");
    const orientation = shapeKey === "line" ? String(request.orientation || "horizontal") : null;
    if (shapeKey === "line" && !["horizontal", "vertical", "diagonal-down", "diagonal-up"].includes(orientation)) fail("Некорректное направление линии", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return { schema: SCHEMA, sourceActorId: source.id, center, shape: shapeKey, range, orientation, targetAudience: request.targetAudience === "all" ? "all" : "enemies", ruleId: request.ruleId || null, label: request.label || null };
  }

  function areaPlanFor(scene, request) {
    const normalized = normalizeAreaRequest(scene, request), source = actorById(scene, normalized.sourceActorId);
    const derived = areaCells(scene, source, normalized.center, AREA_RULES[normalized.shape], normalized);
    return {
      schema: SCHEMA,
      kind: `${KIND}.area`,
      id: String(request.id || request.areaId || `area:${normalized.sourceActorId}:${Number(scene.version || 0)}:${normalized.shape}:${normalized.center.x},${normalized.center.y}`),
      request: normalized,
      precondition: { sceneVersion: Number(scene.version || 0), geometryStamp: geometryStamp(scene), source: actorSnapshot(source) },
      result: { center: clone(normalized.center), shape: normalized.shape, range: normalized.range, cells: derived.cells, targetIds: derived.targetIds, emptyTargetCount: derived.emptyTargetCount },
      status: "prepared",
    };
  }

  function validateAreaShape(raw) {
    if (!object(raw) || raw.kind !== `${KIND}.area` || Number(raw.schema) !== SCHEMA || !object(raw.request) || !object(raw.precondition) || !object(raw.result)) fail("Некорректный план области", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return clone(raw);
  }

  function revalidateArea(scene, rawPlan, options = {}) {
    const plan = validateAreaShape(rawPlan), currentVersion = Number(scene?.version || 0);
    if (!options.allowVersionChange && Number(plan.precondition.sceneVersion) !== currentVersion) fail("План области устарел: версия Сцены изменилась", "LIONWING_GEOMETRY_RUNTIME_STALE");
    if (!options.allowGeometryChange && plan.precondition.geometryStamp !== geometryStamp(scene)) fail("План области устарел: геометрия Сцены изменилась", "LIONWING_GEOMETRY_RUNTIME_STALE");
    const fresh = areaPlanFor(scene, { ...plan.request, id: plan.id });
    if (!same(comparableAreaResult(fresh.result), comparableAreaResult(plan.result))) fail("План области устарел: цели или форма изменились", "LIONWING_GEOMETRY_RUNTIME_STALE");
    if (!same(actorSnapshot(actorById(scene, plan.request.sourceActorId)), plan.precondition.source)) fail("План области устарел: автор изменился", "LIONWING_GEOMETRY_RUNTIME_STALE");
    return { available: true, stale: false, plan: clone(plan), result: clone(plan.result) };
  }

  function comparableAreaResult(result) {
    return { center: result.center, shape: result.shape, range: result.range, cells: result.cells, targetIds: result.targetIds, emptyTargetCount: result.emptyTargetCount };
  }

  function removedCells(scene, spaceId) {
    const api = sceneApi();
    if (typeof api?.removedCellKeys === "function") {
      const result = api.removedCellKeys(scene, spaceId);
      if (result instanceof Set) return result;
      if (Array.isArray(result)) return new Set(result);
    }
    return new Set((scene?.topology?.cuts || [])
      .filter(cut => cut?.space === spaceId)
      .flatMap(cut => cut.cells || []));
  }

  function normalizePoint(raw, fallbackSpace = null, label = "клетка") {
    if (!object(raw)) fail(`${label} должна быть объектом`, "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const space = raw.space == null ? fallbackSpace : boundedString(String(raw.space), `${label}: пространство`, 120);
    if (!space) fail(`${label}: не задано пространство`, "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return { space, x: integer(raw.x, `${label}: X`, 9999), y: integer(raw.y, `${label}: Y`, 9999) };
  }

  function actorSnapshot(actor) {
    if (!actor) return null;
    return {
      id: actor.id,
      space: actor.space,
      x: Number(actor.x),
      y: Number(actor.y),
      width: Number(actor.occupiedWidth || 1),
      height: Number(actor.occupiedHeight || 1),
      knockedOut: Boolean(actor.knockedOut),
      compoundId: actor.compoundId || null,
    };
  }

  function footprint(destination, width, height) {
    const cells = [];
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) cells.push({ space: destination.space, x: destination.x + x, y: destination.y + y });
    return cells;
  }

  function actorCells(actor, point = null) {
    const destination = point || { space: actor.space, x: Number(actor.x), y: Number(actor.y) };
    return footprint(destination, Number(actor.occupiedWidth || 1), Number(actor.occupiedHeight || 1));
  }

  function validSpaceCells(scene, destination, width, height) {
    const space = spaceById(scene, destination.space);
    if (!space) return { available: false, reason: "Пространство назначения не найдено.", cells: [] };
    const cells = footprint(destination, width, height);
    if (cells.some(cell => cell.x < 0 || cell.y < 0 || cell.x >= Number(space.width) || cell.y >= Number(space.height))) return { available: false, reason: "Фигура целиком не помещается на поле.", cells };
    const removed = removedCells(scene, destination.space);
    const removedCellsList = cells.filter(cell => removed.has(cellKey(cell)));
    if (removedCellsList.length) return { available: false, reason: "Тело пересекает удалённую клетку.", cells, removedCells: removedCellsList };
    return { available: true, reason: "", cells, removedCells: [] };
  }

  function actorOccupancy(scene, target, cells, options = {}) {
    const blockers = [];
    const targetParts = target?.compoundId
      ? new Set((scene?.actors || []).filter(actor => actor.compoundId === target.compoundId).map(actor => actor.id))
      : new Set([target?.id]);
    const targetExiled = exile(target);
    for (const other of scene?.actors || []) {
      if (!other || targetParts.has(other.id) || !live(other) || disappeared(other) || other.space !== cells[0]?.space) continue;
      if (targetExiled !== exile(other)) continue;
      const otherCells = actorCells(other);
      const overlap = cells.filter(cell => otherCells.some(otherCell => cellKey(otherCell) === cellKey(cell)));
      if (overlap.length && options.ignoreActors !== true) blockers.push({ kind: "actor", id: other.id, cells: overlap.map(clone) });
    }
    return blockers;
  }

  function terrainOccupancy(scene, cells, options = {}) {
    if (options.ignoreTerrain === true) return [];
    const blocked = new Set((scene?.objects || [])
      .filter(item => item?.space === cells[0]?.space && (options.blockingTypes || ["terrain"]).includes(item.type))
      .flatMap(item => item.cells || []));
    return cells.filter(cell => blocked.has(cellKey(cell))).map(cell => ({ kind: "terrain", cell: clone(cell) }));
  }

  function footprintStatus(scene, target, destination, options = {}) {
    const valid = validSpaceCells(scene, destination, options.width, options.height);
    if (!valid.available) return { ...valid, blockers: [] };
    const terrain = terrainOccupancy(scene, valid.cells, options);
    if (terrain.length) return { available: false, reason: "Клетка назначения занята непроходимой местностью.", cells: valid.cells, removedCells: [], blockers: terrain };
    const blockers = actorOccupancy(scene, target, valid.cells, options);
    if (blockers.length) return { available: false, reason: "Клетка назначения занята другим персонажем.", cells: valid.cells, removedCells: [], blockers };
    // The common geometry query additionally accounts for effects/aura-owned
    // occupancy. Use it as a second opinion when the full engine is loaded;
    // the local check above remains the fallback for pure runtime tests.
    const api = geometryApi();
    if (typeof api?.footprintStatus === "function" && destination.space === target.space) {
      const checked = api.footprintStatus(scene, { actorId: target.id, destination, width: options.width, height: options.height });
      if (!checked.available) return { available: false, reason: checked.reason || "Клетка назначения недоступна.", cells: valid.cells, removedCells: [], blockers: checked.blockers || [] };
    }
    return { available: true, reason: "", cells: valid.cells, removedCells: [], blockers: [] };
  }

  function parseWallPoint(raw) {
    if (typeof raw === "string") {
      const [x, y] = raw.split(",").map(Number);
      return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
    }
    return object(raw) && Number.isInteger(Number(raw.x)) && Number.isInteger(Number(raw.y)) ? { x: Number(raw.x), y: Number(raw.y) } : null;
  }

  function wallBlocksStep(scene, spaceId, from, to) {
    const sameEdge = (left, right, first, second) => left && right && ((left.x === first.x && left.y === first.y && right.x === second.x && right.y === second.y) || (left.x === second.x && left.y === second.y && right.x === first.x && right.y === first.y));
    return (scene?.walls || []).some(wall => wall?.space === spaceId && sameEdge(parseWallPoint(wall.a), parseWallPoint(wall.b), from, to));
  }

  function normalizeDirection(raw) {
    if (typeof raw === "string") {
      const direction = DIRECTIONS[raw.trim().toLowerCase()];
      if (!direction) fail("Неизвестное направление принудительного перемещения", "LIONWING_GEOMETRY_RUNTIME_INVALID");
      return { ...direction };
    }
    if (!object(raw)) fail("Не задано направление принудительного перемещения", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const x = Math.sign(Number(raw.x)), y = Math.sign(Number(raw.y));
    if (!Number.isInteger(Number(raw.x)) || !Number.isInteger(Number(raw.y)) || Math.abs(Number(raw.x)) > 1 || Math.abs(Number(raw.y)) > 1 || (!x && !y)) fail("Не задано допустимое направление перемещения", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return { x, y };
  }

  function normalizeOperation(request = {}, options = {}) {
    if (!object(request)) fail("Геометрическая операция должна быть объектом", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const rawOperation = request.operation || request.movementKind || request.geometryOperation
      || (request.kind === "move" || request.kind === "geometry-move" ? request.teleport ? "teleport" : request.placement ? "placement" : request.mode : request.kind);
    const operation = OPERATIONS.find(kind => kind === rawOperation || `geometry-${kind}` === rawOperation || `lionwing.geometry.${kind}` === rawOperation);
    if (!operation) fail("Неизвестный тип геометрической операции", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const targetId = request.targetId || request.actorId || request.moverId;
    if (typeof targetId !== "string" || !targetId) fail("Геометрическая операция требует targetId", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const sourceActorId = request.sourceActorId || request.authorActorId || options.sourceActorId || request.actorId || targetId;
    if (typeof sourceActorId !== "string" || !sourceActorId) fail("Геометрическая операция требует sourceActorId", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const result = {
      schema: SCHEMA,
      operation,
      sourceActorId,
      targetId,
      destination: request.destination == null ? null : request.destination,
      mode: request.mode == null ? operation === "displacement" ? "directed" : operation : request.mode,
      direction: request.direction == null ? null : request.direction,
      maximum: request.maximum == null && request.distance == null ? null : request.maximum ?? request.distance,
      width: request.width ?? request.footprint?.width ?? null,
      height: request.height ?? request.footprint?.height ?? null,
      allowPartial: request.allowPartial === true,
      allowKnockedOut: request.allowKnockedOut === true,
      ignoreActors: request.ignoreActors === true,
      ignoreTerrain: request.ignoreTerrain === true,
      ignoreResistance: request.ignoreResistance === true,
      blockingTypes: Array.isArray(request.blockingTypes) && request.blockingTypes.length ? request.blockingTypes.map(String).slice(0, 8) : ["terrain"],
      ruleId: request.ruleId == null ? null : boundedString(String(request.ruleId), "ID правила", 180),
      label: request.label == null && request.name == null ? null : boundedString(String(request.label ?? request.name), "название операции", 160),
      participantIds: Array.isArray(request.participantIds) ? [...new Set(request.participantIds.filter(id => typeof id === "string"))].slice(0, 32) : [],
      trace: request.trace !== false,
      // A caller may pass a stable id under any of the names already used by
      // the LionWing command layer. The generated fallback is deterministic
      // within this process and is replaced by the network event id upstream.
      id: request.operationId || request.eventId || request.id || options.operationId || `geometry:${operation}:${targetId}:${Number(options.sceneVersion ?? 0)}:${serial++}`,
    };
    if (typeof result.id !== "string" || !result.id || result.id.length > 180) fail("Некорректный ID геометрической операции", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    if (result.operation === "placement" || result.operation === "teleport") {
      if (!result.destination) fail(`${result.operation === "placement" ? "Размещение" : "Телепортация"} требует клетку назначения`, "LIONWING_GEOMETRY_RUNTIME_INVALID");
      if (result.mode !== result.operation && result.mode !== "placement" && result.mode !== "teleport") fail("Режим не соответствует типу геометрической операции", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    }
    if (result.operation === "displacement") {
      if (!["directed", "push", "pull"].includes(String(result.mode))) fail("Неизвестный режим принудительного перемещения", "LIONWING_GEOMETRY_RUNTIME_INVALID");
      if (result.maximum == null && !result.destination) fail("Принудительное перемещение требует дальность или цель", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    }
    return result;
  }

  function dimensions(target, request) {
    const width = integer(request.width == null ? Number(target.occupiedWidth || 1) : request.width, "ширина тела", 32);
    const height = integer(request.height == null ? Number(target.occupiedHeight || 1) : request.height, "высота тела", 32);
    if (width < 1 || height < 1) fail("Размер тела должен быть положительным", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return { width, height };
  }

  function commonActors(scene, request) {
    const target = actorById(scene, request.targetId), source = actorById(scene, request.sourceActorId);
    if (!target) fail("Перемещаемый участник не найден.", "LIONWING_GEOMETRY_RUNTIME_TARGET_MISSING");
    if (!source) fail("Автор геометрии не найден.", "LIONWING_GEOMETRY_RUNTIME_SOURCE_MISSING");
    if (target.knockedOut && !request.allowKnockedOut) fail("Выведенного из боя участника нельзя переместить этой операцией.", "LIONWING_GEOMETRY_RUNTIME_TARGET_BLOCKED");
    return { target, source };
  }

  function makeSegments(origin, path, terminal = false, stopReason = null) {
    const segments = [];
    let from = clone(origin);
    for (const [index, raw] of (path || []).entries()) {
      const to = clone(raw);
      segments.push({
        schema: SCHEMA,
        index,
        from,
        to,
        cost: Math.max(1, Math.abs(Number(to.x) - Number(from.x)) + Math.abs(Number(to.y) - Number(from.y))),
        terminal: Boolean(terminal && index === path.length - 1),
        stopReason: terminal && index === path.length - 1 ? stopReason : null,
        boundaries: ["before-leave", "leave", "before-enter", "enter"],
      });
      from = to;
    }
    return segments;
  }

  function placementOrTeleport(scene, request, actors) {
    const { target } = actors, dims = dimensions(target, request);
    const destination = normalizePoint(request.destination, target.space, "клетка назначения");
    const status = footprintStatus(scene, target, destination, { ...request, ...dims });
    if (!status.available) fail(status.reason, "LIONWING_GEOMETRY_RUNTIME_DESTINATION_BLOCKED", { blockers: status.blockers || [] });
    if (request.operation === "teleport" && request.maximum != null && destination.space === target.space) {
      const maximum = integer(request.maximum, "дальность телепортации", 999);
      const distance = Math.abs(Number(destination.x) - Number(target.x)) + Math.abs(Number(destination.y) - Number(target.y));
      if (distance > maximum) fail("Телепортация выходит за дальность.", "LIONWING_GEOMETRY_RUNTIME_RANGE");
    }
    const from = { space: target.space, x: Number(target.x), y: Number(target.y) };
    return {
      operation: request.operation,
      from,
      requestedDestination: destination,
      stoppedAt: destination,
      destination,
      path: [],
      segments: [],
      spent: 0,
      remaining: 0,
      terminal: false,
      stopReason: null,
      // Placement and teleportation change the endpoint without traversing
      // cells. They must never be rendered as an ordinary movement trail.
      trace: false,
      teleported: request.operation === "teleport",
      forced: false,
      width: dims.width,
      height: dims.height,
      cells: status.cells,
      blockers: [],
    };
  }

  function displacementViaExistingStatus(scene, request, target, dims) {
    // The old query already handles topology crossings, effects and the
    // canonical push/pull direction. Reuse it for a one-cell body so this
    // runtime cannot silently diverge from the movement family. Larger
    // bodies use the body-aware fallback below because the old query exposes
    // only a one-cell destination.
    const api = sceneApi();
    if (dims.width !== 1 || dims.height !== 1 || typeof api?.displacementStatus !== "function") return null;
    const status = api.displacementStatus(scene, {
      actorId: target.id,
      sourceActorId: request.sourceActorId,
      source: actorById(scene, request.sourceActorId),
      mode: request.mode,
      direction: request.direction,
      destination: request.destination,
      maximum: request.maximum,
      distance: request.maximum,
      allowPartial: request.destination == null ? true : request.allowPartial,
      allowKnockedOut: request.allowKnockedOut,
      ignoreActors: request.ignoreActors,
      ignoreTerrain: request.ignoreTerrain,
      ignoreResistance: request.ignoreResistance,
    });
    if (!status) return null;
    if (!status.available) fail(status.reason || "Принудительное перемещение недоступно.", "LIONWING_GEOMETRY_RUNTIME_DESTINATION_BLOCKED");
    const path = (status.path || []).map(point => ({ space: target.space, x: Number(point.x), y: Number(point.y) }));
    const origin = { space: target.space, x: Number(target.x), y: Number(target.y) };
    const interrupted = Boolean(status.interrupted);
    const spent = path.length;
    const maximum = integer(request.maximum == null ? request.distance ?? spent : request.maximum, "дальность принудительного перемещения", 999);
    return {
      operation: "displacement",
      from: origin,
      requestedDestination: request.destination ? normalizePoint(request.destination, target.space, "клетка назначения") : null,
      stoppedAt: status.destination ? { space: target.space, x: Number(status.destination.x), y: Number(status.destination.y) } : origin,
      destination: status.destination ? { space: target.space, x: Number(status.destination.x), y: Number(status.destination.y) } : origin,
      path,
      segments: makeSegments(origin, path, interrupted, status.interruptedReason || null),
      spent,
      remaining: Math.max(0, maximum - spent),
      terminal: interrupted,
      stopReason: status.interruptedReason || null,
      trace: request.trace,
      teleported: path.some(point => point.teleported === true),
      forced: true,
      direction: status.direction || normalizeDirection(request.direction),
      mode: status.mode || request.mode,
      width: dims.width,
      height: dims.height,
      cells: path.length ? footprint(path.at(-1), dims.width, dims.height) : actorCells(target),
      blockers: status.blockedAt ? [{ kind: "blocked", cell: { space: target.space, x: Number(status.blockedAt.x), y: Number(status.blockedAt.y) } }] : [],
    };
  }

  function displacementFallback(scene, request, actors, dims) {
    const { target, source } = actors;
    if (source.space !== target.space) fail("Источник принудительного перемещения должен находиться на том же поле.", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    if (!request.ignoreResistance && (target.effects || []).includes("positive.устойчив")) fail("Устойчивость запрещает принудительное перемещение.", "LIONWING_GEOMETRY_RUNTIME_TARGET_BLOCKED");
    let direction;
    if (["push", "pull"].includes(request.mode)) {
      const dx = Math.sign(Number(target.x) - Number(source.x)), dy = Math.sign(Number(target.y) - Number(source.y));
      if (!dx && !dy) fail("Источник и цель занимают одну клетку: направление не определено.", "LIONWING_GEOMETRY_RUNTIME_INVALID");
      direction = request.mode === "pull" ? { x: -dx, y: -dy } : { x: dx, y: dy };
    } else direction = normalizeDirection(request.direction);
    const maximum = integer(request.maximum == null ? request.distance : request.maximum, "дальность принудительного перемещения", 999);
    if (maximum < 1) fail("Дальность принудительного перемещения должна быть положительной.", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const requested = request.destination == null ? null : normalizePoint(request.destination, target.space, "клетка назначения");
    if (requested && requested.space !== target.space) fail("Принудительное перемещение не меняет пространство.", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const requestedDistance = requested ? Math.max(Math.abs(requested.x - Number(target.x)), Math.abs(requested.y - Number(target.y))) : maximum;
    if (requested && (!requestedDistance || requestedDistance > maximum || (requested.x !== Number(target.x) && requested.y !== Number(target.y) && Math.abs(requested.x - Number(target.x)) !== Math.abs(requested.y - Number(target.y))))) fail(`Назначение должно лежать на прямой не дальше ${maximum} кл.`, "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const steps = requested ? requestedDistance : maximum;
    const path = [], origin = { space: target.space, x: Number(target.x), y: Number(target.y) };
    let current = origin, stoppedReason = null, blockedAt = null;
    const isBlocked = destination => {
      const valid = validSpaceCells(scene, destination, dims.width, dims.height);
      if (!valid.available) return { reason: valid.reason, blockers: valid.blockers || [], point: destination };
      for (let y = 0; y < dims.height; y += 1) for (let x = 0; x < dims.width; x += 1) {
        const from = { x: current.x + x, y: current.y + y }, to = { x: destination.x + x, y: destination.y + y };
        if (!request.ignoreTerrain && wallBlocksStep(scene, target.space, from, to)) return { reason: "Стена блокирует перемещение.", point: to };
      }
      const terrain = terrainOccupancy(scene, valid.cells, request);
      if (terrain.length) return { reason: "Клетка назначения занята непроходимой местностью.", blockers: terrain, point: destination };
      const blockers = actorOccupancy(scene, target, valid.cells, request);
      if (blockers.length) return { reason: "Клетка назначения занята другим персонажем.", blockers, point: destination };
      return null;
    };
    for (let index = 0; index < steps; index += 1) {
      const attempted = { space: target.space, x: current.x + direction.x, y: current.y + direction.y };
      const blocked = isBlocked(attempted);
      if (blocked) { stoppedReason = blocked.reason; blockedAt = blocked.point; break; }
      current = attempted; path.push(current);
    }
    if (requested && (current.x !== requested.x || current.y !== requested.y)) fail(stoppedReason || "Топологический переход не ведёт в выбранную клетку.", "LIONWING_GEOMETRY_RUNTIME_DESTINATION_BLOCKED", { blockers: [] });
    if (!path.length && stoppedReason) fail(stoppedReason, "LIONWING_GEOMETRY_RUNTIME_DESTINATION_BLOCKED", { blockers: [] });
    const interrupted = Boolean(stoppedReason);
    return {
      operation: "displacement",
      from: origin,
      requestedDestination: requested,
      stoppedAt: current,
      destination: current,
      path,
      segments: makeSegments(origin, path, interrupted, stoppedReason),
      spent: path.length,
      remaining: Math.max(0, maximum - path.length),
      terminal: interrupted,
      stopReason: stoppedReason,
      trace: request.trace,
      teleported: false,
      forced: true,
      direction,
      mode: request.mode,
      width: dims.width,
      height: dims.height,
      cells: footprint(current, dims.width, dims.height),
      blockers: blockedAt ? [{ kind: "blocked", cell: clone(blockedAt) }] : [],
    };
  }

  function buildResult(scene, request) {
    const actors = commonActors(scene, request), dims = dimensions(actors.target, request);
    if (request.operation !== "displacement") return placementOrTeleport(scene, request, actors);
    const existing = displacementViaExistingStatus(scene, request, actors.target, dims);
    return existing || displacementFallback(scene, request, actors, dims);
  }

  function planFor(scene, request, options = {}) {
    if (!object(scene)) fail("Сцена геометрической операции недоступна", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const normalized = normalizeOperation(request, { ...options, sceneVersion: Number(scene.version || 0) });
    const result = buildResult(scene, normalized);
    const target = actorById(scene, normalized.targetId), source = actorById(scene, normalized.sourceActorId);
    const precondition = {
      sceneVersion: Number(scene.version || 0),
      geometryStamp: geometryStamp(scene),
      source: actorSnapshot(source),
      target: actorSnapshot(target),
    };
    const plan = {
      schema: SCHEMA,
      kind: KIND,
      id: normalized.id,
      operation: normalized.operation,
      sourceActorId: normalized.sourceActorId,
      targetId: normalized.targetId,
      request: clone(normalized),
      precondition,
      result: clone(result),
      status: "prepared",
      basedOn: "lionwing.geometry",
    };
    return plan;
  }

  function validatePlanShape(raw) {
    if (!object(raw) || Number(raw.schema) !== SCHEMA || raw.kind !== KIND || !OPERATIONS.includes(raw.operation) || typeof raw.id !== "string" || !raw.id || !object(raw.request) || !object(raw.precondition) || !object(raw.result)) fail("Некорректный план геометрической операции", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    if (raw.request.operation !== raw.operation || raw.request.targetId !== raw.targetId || raw.request.sourceActorId !== raw.sourceActorId) fail("План геометрической операции содержит несовпадающие ID", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    if (!Number.isSafeInteger(Number(raw.precondition.sceneVersion)) || typeof raw.precondition.geometryStamp !== "string") fail("План геометрической операции не содержит проверяемого снимка", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    return clone(raw);
  }

  function reload(raw) {
    let value = raw;
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch { fail("JSON-план геометрической операции повреждён", "LIONWING_GEOMETRY_RUNTIME_INVALID"); }
    }
    if (object(value) && value.plan && !value.kind) value = value.plan;
    if (object(value) && value.payload?.geometryRuntime && !value.kind) value = value.payload.geometryRuntime;
    return value?.kind === `${KIND}.area` ? validateAreaShape(value) : validatePlanShape(value);
  }

  function eventFor(plan, options = {}) {
    const operation = plan.operation;
    return {
      schema: SCHEMA,
      id: plan.id,
      type: `geometry.${operation}.commit`,
      actorId: plan.sourceActorId,
      payload: {
        operation,
        sourceActorId: plan.sourceActorId,
        targetId: plan.targetId,
        geometryRuntime: clone(plan),
        geometryPlan: clone(plan),
        label: plan.request.label || options.label || `Геометрическая операция: ${operation}`,
      },
    };
  }

  function prepare(scene, request, options = {}) {
    try {
      const plan = planFor(scene, request, options), event = eventFor(plan, options);
      return { ok: true, errors: [], plan: clone(plan), preview: clone(plan.result), event, command: clone(event), events: [event], scene: clone(scene) };
    } catch (error) {
      return { ok: false, errors: [error.message], code: error.code || "LIONWING_GEOMETRY_RUNTIME_BLOCKED", plan: null, preview: null, events: [], scene: clone(scene) };
    }
  }

  function preview(scene, input, options = {}) {
    try {
      const plan = object(input) && (input.kind === KIND || input.kind === `${KIND}.area` || input.plan?.kind === KIND || input.plan?.kind === `${KIND}.area` || input.payload?.geometryRuntime)
        ? reload(input)
        : planFor(scene, input, options);
      const checked = plan.kind === `${KIND}.area` ? revalidateArea(scene, plan, options) : revalidate(scene, plan, options);
      return { ok: true, errors: [], plan: clone(checked.plan), preview: clone(checked.plan.result), stale: false, scene: clone(scene) };
    } catch (error) {
      return { ok: false, errors: [error.message], code: error.code || "LIONWING_GEOMETRY_RUNTIME_BLOCKED", plan: null, preview: null, stale: /устар|измен|снимок/i.test(error.message || ""), scene: clone(scene) };
    }
  }

  function comparableResult(result) {
    const value = clone(result || {});
    delete value.blockers;
    return value;
  }

  function revalidate(scene, rawPlan, options = {}) {
    const plan = reload(rawPlan), expectedVersion = Number(plan.precondition.sceneVersion), currentVersion = Number(scene?.version || 0);
    if (!options.allowVersionChange && expectedVersion !== currentVersion) fail("Геометрический план устарел: версия Сцены изменилась.", "LIONWING_GEOMETRY_RUNTIME_STALE");
    if (!options.allowGeometryChange && plan.precondition.geometryStamp !== geometryStamp(scene)) fail("Геометрический план устарел: геометрия Сцены изменилась.", "LIONWING_GEOMETRY_RUNTIME_STALE");
    const fresh = planFor(scene, plan.request, { operationId: plan.id });
    if (!same(comparableResult(fresh.result), comparableResult(plan.result))) fail("Геометрический план устарел: итог операции изменился.", "LIONWING_GEOMETRY_RUNTIME_STALE");
    if (!same(actorSnapshot(actorById(scene, plan.targetId)), plan.precondition.target) || !same(actorSnapshot(actorById(scene, plan.sourceActorId)), plan.precondition.source)) fail("Геометрический план устарел: участник или автор изменился.", "LIONWING_GEOMETRY_RUNTIME_STALE");
    return { available: true, stale: false, reason: "", plan: clone(plan), result: clone(plan.result) };
  }

  function affectedActorIds(scene, targetId) {
    const target = actorById(scene, targetId);
    if (!target?.compoundId) return [targetId];
    return (scene?.actors || []).filter(actor => actor.compoundId === target.compoundId).map(actor => actor.id);
  }

  function geometrySnapshot(scene, actorIds) {
    return {
      sceneVersion: Number(scene?.version || 0),
      geometryStamp: geometryStamp(scene),
      actors: actorIds.map(id => actorSnapshot(actorById(scene, id))).filter(Boolean),
    };
  }

  // This projection is intentionally private. It is only used to construct
  // the `after` precondition of the typed commit event; the common Scene
  // reducer remains the sole owner of mutable state, receipts and journal.
  function projectResult(scene, plan) {
    const next = clone(scene), destination = plan.result.stoppedAt || plan.result.destination;
    if (!destination) fail("Геометрический итог не содержит остановку", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    const ids = affectedActorIds(next, plan.targetId);
    for (const id of ids) {
      const target = actorById(next, id);
      if (!target) fail("Участник исчез во время геометрической операции", "LIONWING_GEOMETRY_RUNTIME_TARGET_MISSING");
      target.space = destination.space;
      target.x = Number(destination.x);
      target.y = Number(destination.y);
    }
    return next;
  }

  function compactPayload(plan, before, after) {
    return {
      operation: plan.operation,
      sourceActorId: plan.sourceActorId,
      targetId: plan.targetId,
      requestedDestination: clone(plan.result.requestedDestination),
      from: clone(plan.result.from),
      stoppedAt: clone(plan.result.stoppedAt),
      path: clone(plan.result.path || []),
      segments: clone(plan.result.segments || []),
      spent: Number(plan.result.spent || 0),
      remaining: Number(plan.result.remaining || 0),
      terminal: Boolean(plan.result.terminal),
      stopReason: plan.result.stopReason || null,
      teleported: Boolean(plan.result.teleported),
      trace: plan.result.trace !== false,
      ruleId: plan.request.ruleId || null,
      before: clone(before),
      after: clone(after),
    };
  }

  function fingerprint(plan) {
    return JSON.stringify({ id: plan.id, operation: plan.operation, request: plan.request, precondition: plan.precondition, result: comparableResult(plan.result) });
  }

  function extractPlan(input) {
    if (object(input) && input.plan) return reload(input.plan);
    if (object(input) && input.payload?.geometryRuntime) return reload(input.payload.geometryRuntime);
    if (object(input) && input.geometryRuntime) return reload(input.geometryRuntime);
    return reload(input);
  }

  function commit(scene, input, options = {}) {
    const plan = extractPlan(input);
    const checked = revalidate(scene, plan, options), actorIds = affectedActorIds(scene, plan.targetId), before = geometrySnapshot(scene, actorIds);
    const next = projectResult(scene, checked.plan);
    next.version = Number(scene?.version || 0) + 1;
    const after = geometrySnapshot(next, actorIds);
    const event = eventFor(checked.plan, options);
    event.before = clone(before);
    event.after = clone(after);
    event.payload = { ...event.payload, summary: compactPayload(checked.plan, before, after) };
    const journal = {
      id: `${event.id}:journal`,
      schema: SCHEMA,
      at: new Date().toISOString(),
      type: event.type,
      actorId: event.actorId,
      payload: clone(event.payload.summary),
      visibility: "public",
    };
    return {
      ok: true,
      plan: clone(checked.plan),
      result: clone(checked.result),
      before,
      after,
      event,
      journal,
      fingerprint: fingerprint(checked.plan),
      // The caller records this fingerprint in the common receipts stream.
      // Keeping it beside the event makes replay conflict checks independent
      // from any particular Scene storage layout.
      replayed: false,
      idempotent: false,
    };
  }

  function replay(scene, rawEvent, options = {}) {
    const event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : rawEvent;
    const result = commit(scene, event, options);
    return { ...result, replayed: true };
  }

  function undo(scene, input, options = {}) {
    const source = object(input) && input.event ? input.event : input;
    const event = typeof source === "string" ? JSON.parse(source) : clone(source);
    if (!object(event) || !event.before || !event.after || !event.payload?.targetId || !OPERATIONS.includes(event.payload.operation)) fail("Событие геометрии не содержит снимки для отката", "LIONWING_GEOMETRY_RUNTIME_INVALID");
    if (options.expectedVersion !== undefined && Number(options.expectedVersion) !== Number(scene?.version || 0)) fail("Откат геометрии устарел: версия Сцены изменилась.", "LIONWING_GEOMETRY_RUNTIME_STALE");
    if (Number(scene?.version || 0) !== Number(event.after.sceneVersion)) fail("Откат геометрии устарел: версия Сцены изменилась.", "LIONWING_GEOMETRY_RUNTIME_STALE");
    const actorIds = (event.after.actors || []).map(actor => actor.id), current = geometrySnapshot(scene, actorIds);
    if (!same(current, event.after)) fail("Откат геометрии устарел: текущая геометрия уже изменена.", "LIONWING_GEOMETRY_RUNTIME_STALE");
    const next = clone(scene);
    for (const saved of event.before.actors || []) {
      const target = actorById(next, saved.id);
      if (!target) fail("Откат геометрии не нашёл участника.", "LIONWING_GEOMETRY_RUNTIME_TARGET_MISSING");
      target.space = saved.space;
      target.x = Number(saved.x);
      target.y = Number(saved.y);
    }
    next.version = Number(scene?.version || 0) + 1;
    const undoEvent = {
      schema: SCHEMA,
      id: `undo:${event.id}`,
      type: `geometry.${event.payload.operation}.undo`,
      actorId: event.actorId || event.payload.sourceActorId || null,
      payload: { operation: event.payload.operation, sourceActorId: event.payload.sourceActorId || event.actorId || null, targetId: event.payload.targetId, eventId: event.id, from: clone(event.after), to: clone(event.before) },
      before: clone(event.after),
      after: geometrySnapshot(next, actorIds),
    };
    const journal = { id: `${undoEvent.id}:journal`, schema: SCHEMA, at: new Date().toISOString(), type: undoEvent.type, actorId: undoEvent.actorId, payload: clone(undoEvent.payload), visibility: "public" };
    return { ok: true, event: undoEvent, journal, after: undoEvent.after, fingerprint: JSON.stringify({ undoOf: event.id, before: event.after, after: undoEvent.after }), undone: true };
  }

  function areaPrepare(scene, request = {}) {
    try {
      const plan = areaPlanFor(scene, request);
      return { ok: true, errors: [], plan: clone(plan), preview: clone(plan.result), scene: clone(scene) };
    } catch (error) {
      return { ok: false, errors: [error.message], code: error.code || "LIONWING_GEOMETRY_RUNTIME_BLOCKED", plan: null, preview: null, scene: clone(scene) };
    }
  }

  function areaPreview(scene, input, options = {}) {
    try {
      const plan = object(input) && input.kind === `${KIND}.area` ? validateAreaShape(input) : areaPlanFor(scene, input);
      const checked = revalidateArea(scene, plan, options);
      return { ok: true, errors: [], plan: clone(checked.plan), preview: clone(checked.result), stale: false, scene: clone(scene) };
    } catch (error) {
      return { ok: false, errors: [error.message], code: error.code || "LIONWING_GEOMETRY_RUNTIME_BLOCKED", plan: null, preview: null, stale: /устар|измен|снимок/i.test(error.message || ""), scene: clone(scene) };
    }
  }

  function journal(scene) {
    return clone((scene?.log || []).filter(row => typeof row?.type === "string" && row.type.startsWith("geometry.")).slice(0, MAX_JOURNAL));
  }

  const api = Object.freeze({
    schema: SCHEMA,
    kind: KIND,
    operations: OPERATIONS,
    directions: DIRECTIONS,
    geometryStamp,
    normalizeOperation,
    normalizePlan: reload,
    reload,
    deserialize: reload,
    serialize: value => JSON.stringify(reload(value)),
    prepare,
    preview,
    revalidate,
    validate: revalidate,
    fingerprint,
    eventFingerprint: fingerprint,
    eventFor,
    commit,
    replay,
    undo,
    journal,
    prepareOperation: prepare,
    previewOperation: preview,
    commitOperation: commit,
    replayOperation: replay,
    undoOperation: undo,
    areaShapes: AREA_SHAPES,
    areaRules: AREA_RULES,
    areaPlan: areaPlanFor,
    areaPrepare,
    areaPreview,
    areaRevalidate: revalidateArea,
    revalidateArea,
  });
  global.DAWN_LIONWING_GEOMETRY_RUNTIME = api;
})(typeof window === "object" ? window : globalThis);
