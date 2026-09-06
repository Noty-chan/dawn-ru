"use strict";

// Read-only geometry plans for LionWing. Command integration is a separate step.
(function installLionwingGeometry(global) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const pointKey = point => `${point.x},${point.y}`;
  const integer = value => Number.isInteger(Number(value));
  const actorById = (scene, id) => (scene?.actors || []).find(actor => actor.id === id) || null;
  const spaceById = (scene, id) => (scene?.spaces || []).find(space => space.id === id) || null;
  const sortPoints = points => [...points].sort((left, right) => left.space.localeCompare(right.space) || left.y - right.y || left.x - right.x);
  const fail = reason => ({ available: false, reason, anchor: null });

  function engine() {
    return global.DAWN_SCENE_ENGINE || null;
  }

  function footprintCells(point, width, height) {
    const cells = [];
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) cells.push({ x: point.x + x, y: point.y + y });
    return cells;
  }

  function anchorStatus(scene, request = {}) {
    const source = request.sourceActorId == null ? null : actorById(scene, request.sourceActorId);
    if (request.sourceActorId != null && !source) return fail("Автор геометрии не найден.");
    const requested = request.anchor || {};
    const kind = requested.kind;
    let anchor = null;
    if (kind === "actor") {
      const actor = actorById(scene, requested.actorId || requested.id);
      if (!actor || actor.knockedOut) return fail("Геометрический якорь-участник недоступен.");
      anchor = { kind, id: actor.id, space: actor.space, x: Number(actor.x), y: Number(actor.y) };
    } else if (kind === "marker") {
      const marker = (scene?.markers || []).find(item => item.id === (requested.markerId || requested.id));
      if (!marker) return fail("Геометрический якорь-маркер не найден.");
      anchor = { kind, id: marker.id, space: marker.space, x: Number(marker.x), y: Number(marker.y) };
    } else if (kind === "cell") {
      anchor = { kind, space: requested.space, x: Number(requested.x), y: Number(requested.y) };
    } else if (kind === "entity") {
      const entity = scene?.lionwing?.entities?.[requested.entityId || requested.id];
      const backing = entity?.backing || {};
      if (backing.actorId) return anchorStatus(scene, { ...request, anchor: { kind: "actor", actorId: backing.actorId } });
      if (backing.markerId) return anchorStatus(scene, { ...request, anchor: { kind: "marker", markerId: backing.markerId } });
      if (entity?.anchor) return anchorStatus(scene, { ...request, anchor: { kind: "cell", ...entity.anchor } });
      return fail("Сущность не имеет пространственного якоря.");
    } else return fail("Неизвестный тип геометрического якоря.");
    const space = spaceById(scene, anchor.space);
    if (!space || !integer(anchor.x) || !integer(anchor.y) || anchor.x < 0 || anchor.y < 0 || anchor.x >= Number(space.width) || anchor.y >= Number(space.height)) return fail("Якорь находится вне пространства.");
    const removed = engine()?.removedCellKeys?.(scene, anchor.space) || new Set();
    if (removed.has(pointKey(anchor))) return fail("Якорь находится в удалённой клетке.");
    return { available: true, reason: "", sourceActorId: source?.id || null, anchor };
  }

  function footprintStatus(scene, request = {}) {
    const runtime = engine();
    if (!runtime?.effectCellOccupancyStatus || !runtime?.removedCellKeys) return { available: false, reason: "Общие пространственные запросы недоступны.", cells: [] };
    const base = request.actorId ? actorById(scene, request.actorId) : request.actor;
    const point = request.destination || request.point;
    const width = Number(request.width ?? request.footprint?.width ?? base?.occupiedWidth ?? 1);
    const height = Number(request.height ?? request.footprint?.height ?? base?.occupiedHeight ?? 1);
    if (!base || !point || !integer(point.x) || !integer(point.y) || !integer(width) || !integer(height) || width < 1 || height < 1) return { available: false, reason: "Некорректное тело или клетка назначения.", cells: [] };
    const space = point.space || base.space;
    const battlefield=spaceById(scene,space);
    if(!battlefield||Number(point.x)<0||Number(point.y)<0||Number(point.x)+width>battlefield.width||Number(point.y)+height>battlefield.height)return {available:false,reason:"Фигура целиком не помещается на поле.",cells:[]};
    const body = { ...clone(base), space, x: Number(point.x), y: Number(point.y), occupiedWidth: width, occupiedHeight: height };
    const cells = footprintCells(body, width, height).map(cell => ({ ...cell, space }));
    const occupancy = runtime.effectCellOccupancyStatus(scene, base.id || null, { actor: body, space, x: body.x, y: body.y });
    const removed = runtime.removedCellKeys(scene, space);
    const removedCells = cells.filter(cell => removed.has(pointKey(cell)));
    return {
      available: Boolean(occupancy.available) && !removedCells.length,
      reason: !occupancy.available ? occupancy.reason : removedCells.length ? "Тело пересекает удалённую клетку." : "",
      space,
      width,
      height,
      cells,
      removedCells,
      blockers: occupancy.blockers || [],
    };
  }

  function nearestCandidates(scene, request = {}) {
    const anchor = anchorStatus(scene, request);
    if (!anchor.available) return { ...anchor, candidates: [] };
    const raw = Array.isArray(request.candidates) ? request.candidates : [];
    const seen = new Set(), candidates = [];
    for (const item of raw) {
      const point = typeof item === "string" ? (() => { const [x, y] = item.split(",").map(Number); return { x, y }; })() : item;
      const candidate = { space: point?.space || anchor.anchor.space, x: Number(point?.x), y: Number(point?.y) };
      if(candidate.space!==anchor.anchor.space)continue;
      const key = `${candidate.space}:${candidate.x},${candidate.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const footprint = footprintStatus(scene, { actorId: request.actorId, actor: request.actor, destination: candidate, footprint: request.footprint, width: request.width, height: request.height });
      if (!footprint.available) continue;
      candidates.push({ ...candidate, distance: Math.abs(candidate.x - anchor.anchor.x) + Math.abs(candidate.y - anchor.anchor.y), cells: footprint.cells });
    }
    candidates.sort((left, right) => left.distance - right.distance || left.space.localeCompare(right.space) || left.y - right.y || left.x - right.x);
    return { available: true, reason: "", anchor: anchor.anchor, candidates: clone(candidates) };
  }

  function geometryStamp(scene) {
    const normalize = value => clone(value || {});
    return JSON.stringify({
      version: Number(scene?.version || 0),
      spaces: (scene?.spaces || []).map(space => ({ id: space.id, width: space.width, height: space.height, mode: space.mode || "" })).sort((a, b) => a.id.localeCompare(b.id)),
      actors: (scene?.actors || []).map(actor => ({ id: actor.id, space: actor.space, x: actor.x, y: actor.y, width: actor.occupiedWidth || 1, height: actor.occupiedHeight || 1, knockedOut: Boolean(actor.knockedOut), effects: actor.effects || [] })).sort((a, b) => a.id.localeCompare(b.id)),
      markers: (scene?.markers || []).map(marker => ({ id: marker.id, space: marker.space, x: marker.x, y: marker.y })).sort((a, b) => a.id.localeCompare(b.id)),
      objects: (scene?.objects || []).map(object => ({ id: object.id, space: object.space, type: object.type, cells: [...(object.cells || [])].sort() })).sort((a, b) => a.id.localeCompare(b.id)),
      walls: (scene?.walls || []).map(wall => ({ id: wall.id, space: wall.space, a: normalize(wall.a), b: normalize(wall.b) })).sort((a, b) => a.id.localeCompare(b.id)),
      cuts: (scene?.topology?.cuts || []).map(cut => ({ id: cut.id, space: cut.space, cells: [...(cut.cells || [])].sort(), crossing: cut.crossing || "blocked" })).sort((a, b) => a.id.localeCompare(b.id)),
    });
  }

  function routePlan(scene, request = {}) {
    const runtime = engine();
    const source = request.sourceActorId == null ? null : actorById(scene, request.sourceActorId);
    const mover = actorById(scene, request.actorId);
    const anchor = anchorStatus(scene, request);
    const destination = request.destination || {};
    const maximum = Number(request.maximum);
    if(![undefined,"move","forced"].includes(request.mode))return {available:false,reason:"Этот план поддерживает только движение и принудительное движение."};
    if (!runtime?.movementPath || !runtime?.topologyStatus) return { available: false, reason: "Общие пространственные запросы недоступны." };
    if (!mover || mover.knockedOut || !source || !anchor.available) return { available: false, reason: !mover ? "Перемещаемый участник не найден." : mover.knockedOut ? "Перемещаемый участник выведен из боя." : !source ? "Автор геометрии не найден." : anchor.reason };
    if (!integer(destination.x) || !integer(destination.y) || destination.space && destination.space !== mover.space || !integer(maximum) || maximum < 0) return { available: false, reason: "Некорректная цель или дальность маршрута." };
    const space = spaceById(scene, mover.space);
    if (!space || destination.x < 0 || destination.y < 0 || destination.x >= Number(space.width) || destination.y >= Number(space.height)) return { available: false, reason: "Цель маршрута вне пространства." };
    const options = { forced: request.mode === "forced", placement: request.mode === "placement", ignoreResistance: Boolean(request.ignoreResistance), ignoreVoluntaryRestrictions: Boolean(request.ignoreVoluntaryRestrictions), ignoreTerrain: Boolean(request.ignoreTerrain), ignoreEnemies: Boolean(request.ignoreEnemies), ignoreDifficult: Boolean(request.ignoreDifficult), straight: Boolean(request.straight), maxDistance: maximum };
    const validPath = point => {
      const path = runtime.movementPath(scene, mover.id, point, options);
      if (!path.length && (point.x !== mover.x || point.y !== mover.y)) return null;
      for (const segment of path) if (!footprintStatus(scene, { actorId: mover.id, destination: { ...segment, space: mover.space }, footprint: request.footprint, width: request.width, height: request.height }).available) return null;
      return path;
    };
    const direct = validPath(destination);
    let selected = direct ? { x: Number(destination.x), y: Number(destination.y), space: mover.space, path: direct, partial: false } : null;
    if (!selected && request.allowPartial === true) {
      const alternatives = [];
      for (let y = 0; y < Number(space.height); y += 1) for (let x = 0; x < Number(space.width); x += 1) {
        const path = validPath({ x, y });
        if (!path?.length) continue;
        alternatives.push({ x, y, space: mover.space, path, partial: true, distance: Math.abs(x - Number(destination.x)) + Math.abs(y - Number(destination.y)) });
      }
      alternatives.sort((left, right) => left.distance - right.distance || left.y - right.y || left.x - right.x);
      selected = alternatives[0] || null;
    }
    if (!selected) return { available: false, reason: "Нет допустимого маршрута к цели." };
    const route = {
      schema: 1,
      sourceActorId: source.id,
      actorId: mover.id,
      anchor: anchor.anchor,
      destination: { space: mover.space, x: Number(destination.x), y: Number(destination.y) },
      mode: request.mode || "move",
      maximum,
      path: selected.path.map(point => ({ space: mover.space, x: Number(point.x), y: Number(point.y) })),
      spent: selected.path.length,
      stoppedAt: { space: selected.space, x: selected.x, y: selected.y },
      remaining: Math.max(0, maximum - selected.path.length),
      partial: selected.partial,
      sceneVersion: Number(scene.version || 0),
      geometryStamp: geometryStamp(scene),
    };
    const plan = { schema: 1, kind: "lionwing.geometry.route", request: clone(request), route };
    return { available: true, reason: "", plan: clone(plan), route: clone(route) };
  }

  function revalidatePlan(scene, plan) {
    if (!plan || plan.schema !== 1 || plan.kind !== "lionwing.geometry.route" || !plan.route || !plan.request) return { available: false, stale: true, reason: "Некорректный геометрический план." };
    if (Number(plan.route.sceneVersion) !== Number(scene?.version || 0) || plan.route.geometryStamp !== geometryStamp(scene)) return { available: false, stale: true, reason: "Геометрический план устарел." };
    const fresh = routePlan(scene, plan.request);
    if (!fresh.available || JSON.stringify(fresh.route) !== JSON.stringify(plan.route)) return { available: false, stale: true, reason: fresh.reason || "Геометрический план изменился." };
    return { available: true, stale: false, reason: "", plan: clone(plan), route: clone(plan.route) };
  }

  global.DAWN_LIONWING_GEOMETRY = Object.freeze({ anchorStatus, footprintStatus, nearestCandidates, routePlan, revalidatePlan });
})(typeof window === "object" ? window : globalThis);
