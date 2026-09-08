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

  function lionwingEngine() {
    return global.DAWN_LIONWING_ENGINE || null;
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

  // A route used to contain only `path` and `stoppedAt`. Keep accepting that
  // shape, but give every new route a stable, JSON-only segment description.
  // Costs are deliberately derived from the two endpoints so old plans remain
  // readable and diagonal Line movement keeps its two-cell cost.
  function routeSegments(route = {}) {
    if (Array.isArray(route.segments) && route.segments.length) return route.segments.map((raw, index) => {
      const from = raw?.from || {}, to = raw?.to || {};
      const cost = Number(raw?.cost ?? Math.abs(Number(to.x) - Number(from.x)) + Math.abs(Number(to.y) - Number(from.y)));
      return {
        ...clone(raw),
        index: Number.isSafeInteger(Number(raw?.index)) ? Number(raw.index) : index,
        from: { space: from.space || route.origin?.space || route.stoppedAt?.space || route.destination?.space, x: Number(from.x), y: Number(from.y) },
        to: { space: to.space || route.stoppedAt?.space || route.destination?.space, x: Number(to.x), y: Number(to.y) },
        cost,
        terminal: Boolean(raw?.terminal || route.terminal && index === route.segments.length - 1),
        stopReason: raw?.stopReason ?? (route.terminal && index === route.segments.length - 1 ? route.stopReason || null : null),
        boundaries: Array.isArray(raw?.boundaries) && raw.boundaries.length ? [...raw.boundaries] : ["before-leave", "leave", "before-enter", "enter"],
        cursor: raw?.cursor && typeof raw.cursor === "object" ? { ...clone(raw.cursor), schema: 1, segmentIndex: index } : { schema: 1, segmentIndex: index, phase: "before-leave" },
      };
    });
    const points = Array.isArray(route.path) ? route.path : [];
    let from = route.origin && Number.isInteger(Number(route.origin.x)) ? route.origin : points[0];
    const segments = [];
    for (const [index, raw] of points.entries()) {
      const to = { space: raw.space || route.stoppedAt?.space || route.destination?.space, x: Number(raw.x), y: Number(raw.y) };
      if (!from || !Number.isInteger(Number(from.x)) || !Number.isInteger(Number(from.y))) break;
      const start = { space: from.space || to.space, x: Number(from.x), y: Number(from.y) };
      const cost = Math.abs(to.x - start.x) + Math.abs(to.y - start.y);
      segments.push({
        index,
        from: start,
        to,
        cost,
        terminal: Boolean(route.terminal && index === points.length - 1),
        stopReason: route.terminal && index === points.length - 1 ? route.stopReason || null : null,
        boundaries: ["before-leave", "leave", "before-enter", "enter"],
        cursor: { schema: 1, segmentIndex: index, phase: "before-leave" },
      });
      from = to;
    }
    return segments;
  }

  function geometryCursor(route, segmentIndex = 0, scene = null, overrides = {}) {
    const segments = routeSegments(route);
    const index = Number(segmentIndex);
    const expectedSceneVersion = overrides.expectedSceneVersion == null ? Number(scene?.version || 0) : Number(overrides.expectedSceneVersion);
    const expectedGeometryStamp = overrides.expectedGeometryStamp || (scene ? geometryStamp(scene) : null);
    return {
      schema: 1,
      id: String(overrides.id || `${route.actorId || "movement"}:geometry`),
      routeSceneVersion: Number(route.sceneVersion || 0),
      segmentIndex: Number.isInteger(index) && index >= 0 ? index : 0,
      segmentCount: segments.length,
      phase: overrides.phase || "before-leave",
      status: overrides.status || (index >= segments.length ? "completed" : "running"),
      expectedSceneVersion,
      expectedGeometryStamp,
      spent: Number(overrides.spent ?? 0),
      ...(overrides.reason ? { stopReason: String(overrides.reason) } : {}),
    };
  }

  function samePoint(left, right) {
    return Boolean(left && right) && String(left.space || "") === String(right.space || "") && Number(left.x) === Number(right.x) && Number(left.y) === Number(right.y);
  }

  function segmentStatus(scene, plan, cursor = {}, options = {}) {
    if (!plan || plan.schema !== 1 || plan.kind !== "lionwing.geometry.route" || !plan.route || !plan.request) return { available: false, stale: true, reason: "Некорректный геометрический план." };
    const route = plan.route;
    const segments = routeSegments(route);
    const index = Number(cursor.segmentIndex ?? cursor.cursor ?? 0);
    if (!Number.isSafeInteger(index) || index < 0 || index > segments.length) return { available: false, stale: true, reason: "Курсор движения повреждён." };
    if (index >= segments.length) return { available: true, stale: false, completed: true, reason: "", route: clone(route), cursor: geometryCursor(route, index, scene, { ...cursor, status: "completed" }) };
    const mover = actorById(scene, route.actorId), source = actorById(scene, route.sourceActorId);
    if (!mover || mover.knockedOut) return { available: false, stale: true, reason: "Перемещаемый участник отсутствует или выведен из боя." };
    if (!source) return { available: false, stale: true, reason: "Автор геометрии не найден." };
    const segment = segments[index], actual = { space: mover.space, x: Number(mover.x), y: Number(mover.y) };
    if (!samePoint(actual, segment.from)) return { available: false, stale: true, reason: "Курсор движения больше не совпадает с координатами участника." };
    const plannedWidth = route.width == null ? null : Number(route.width), plannedHeight = route.height == null ? null : Number(route.height);
    if (plannedWidth != null && Number(mover.occupiedWidth || 1) !== plannedWidth || plannedHeight != null && Number(mover.occupiedHeight || 1) !== plannedHeight) return { available: false, stale: true, reason: "Размер перемещаемого тела изменился во время движения." };
    if (!options.allowVersionChange && cursor.expectedSceneVersion != null && Number(cursor.expectedSceneVersion) !== Number(scene?.version || 0)) return { available: false, stale: true, reason: "Геометрический план устарел." };
    const request = {
      ...clone(plan.request),
      sourceActorId: route.sourceActorId,
      actorId: route.actorId,
      // The saved anchor is useful for the initial confirmation. A resumed
      // segment is checked from the mover's actual current cell instead.
      anchor: { kind: "cell", space: segment.from.space, x: segment.from.x, y: segment.from.y },
      destination: { space: segment.to.space, x: segment.to.x, y: segment.to.y },
      maximum: Math.max(0, Number(segment.cost || 0)),
      ...(plannedWidth == null ? {} : { width: plannedWidth }),
      ...(plannedHeight == null ? {} : { height: plannedHeight }),
      allowPartial: false,
    };
    const fresh = routePlan(scene, request);
    if (!fresh.available) return { available: false, stale: Boolean(options.allowVersionChange), reason: fresh.reason || "Следующий сегмент движения больше недоступен." };
    const freshPath = fresh.route.path || [];
    if (freshPath.length !== 1 || !samePoint({ ...freshPath[0], space: segment.to.space }, segment.to)) return { available: false, stale: true, reason: "Следующий сегмент движения изменился." };
    const freshSegment = routeSegments(fresh.route)[0] || segment;
    const verifiedSegment = {
      ...clone(segment),
      cost: Number(freshSegment.cost ?? segment.cost ?? 0),
      terminal: Boolean(segment.terminal || fresh.route.terminal || freshSegment.terminal),
      stopReason: fresh.route.terminal || freshSegment.terminal ? fresh.route.stopReason || freshSegment.stopReason || segment.stopReason || null : segment.stopReason || null,
    };
    const nextCursor = geometryCursor(route, index, scene, {
      ...cursor,
      expectedSceneVersion: Number(scene?.version || 0),
      expectedGeometryStamp: geometryStamp(scene),
      segmentCount: segments.length,
      spent: Number(cursor.spent || 0),
      phase: "before-leave",
      status: "running",
    });
    return { available: true, stale: false, completed: false, reason: "", route: clone(route), segment: verifiedSegment, cursor: nextCursor, fresh: clone(fresh.route) };
  }

  function routePlan(scene, request = {}) {
    const runtime = engine();
    const lionwing = lionwingEngine();
    const source = request.sourceActorId == null ? null : actorById(scene, request.sourceActorId);
    const mover = actorById(scene, request.actorId);
    const anchor = anchorStatus(scene, request);
    const destination = request.destination || {};
    const maximum = Number(request.maximum);
    if(![undefined,"move","forced"].includes(request.mode))return {available:false,reason:"Этот план поддерживает только движение и принудительное движение."};
    if (!runtime?.topologyStatus || !lionwing?.movement) return { available: false, reason: "Общие пространственные запросы недоступны." };
    if (!mover || mover.knockedOut || !source || !anchor.available) return { available: false, reason: !mover ? "Перемещаемый участник не найден." : mover.knockedOut ? "Перемещаемый участник выведен из боя." : !source ? "Автор геометрии не найден." : anchor.reason };
    if (!integer(destination.x) || !integer(destination.y) || destination.space && destination.space !== mover.space || !integer(maximum) || maximum < 0) return { available: false, reason: "Некорректная цель или дальность маршрута." };
    const space = spaceById(scene, mover.space);
    if (!space || destination.x < 0 || destination.y < 0 || destination.x >= Number(space.width) || destination.y >= Number(space.height)) return { available: false, reason: "Цель маршрута вне пространства." };
    const options = { forced: request.mode === "forced", ignoreTerrain: Boolean(request.ignoreTerrain), ignoreOpponents: Boolean(request.ignoreEnemies), line: Boolean(request.straight), maximum };
    const width = Number(request.width ?? request.footprint?.width ?? mover.occupiedWidth ?? 1);
    const height = Number(request.height ?? request.footprint?.height ?? mover.occupiedHeight ?? 1);
    if (!integer(width) || !integer(height) || width < 1 || height < 1) return { available: false, reason: "Некорректные размеры перемещаемого тела." };
    // movement() remains the source of truth for every crossed edge. A shallow
    // probe Scene is enough because the validator is read-only, and avoids a
    // full JSON clone for every node explored by the body-aware planner.
    const probeActors = new Map();
    const edgeStatus = (from, to) => {
      let cost = 0, stoppedByDifficult = false;
      for (let oy = 0; oy < height; oy += 1) for (let ox = 0; ox < width; ox += 1) {
        const offset = `${ox},${oy}`;
        let probe = probeActors.get(offset);
        if (!probe) {
          probe = { ...mover, occupiedWidth: 1, occupiedHeight: 1 };
          probeActors.set(offset, probe);
        }
        probe.x = Number(from.x) + ox; probe.y = Number(from.y) + oy;
        const probeScene = { ...scene, actors: (scene.actors || []).map(actor => actor.id === mover.id ? probe : actor) };
        try {
          const edge = lionwing.movement(probeScene, probe, { space: mover.space, x: Number(to.x) + ox, y: Number(to.y) + oy }, { ...options, maximum: 2 });
          if (edge.path.length !== 1 || Number(edge.path[0].x) !== Number(to.x) + ox || Number(edge.path[0].y) !== Number(to.y) + oy) return null;
          cost = Math.max(cost, Number(edge.cost || 0));
          stoppedByDifficult ||= Boolean(edge.endedByDifficultTerrain);
        } catch { return null; }
      }
      return { cost, stoppedByDifficult };
    };
    const footprintAvailable = point => footprintStatus(scene, { actorId: mover.id, destination: { ...point, space: mover.space }, footprint: request.footprint, width: request.width, height: request.height }).available;
    let reachable = null;
    const reachablePaths = () => {
      if (reachable) return reachable;
      const start = { x: Number(mover.x), y: Number(mover.y) };
      reachable = new Map([[pointKey(start), { path: [], cost: 0 }]]);
      const queue = [{ ...start, cost: 0, path: [] }];
      while (queue.length) {
        queue.sort((left, right) => left.cost - right.cost || left.y - right.y || left.x - right.x);
        const current = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = { x: current.x + dx, y: current.y + dy };
          if (!footprintAvailable(next)) continue;
          const edge = edgeStatus(current, next);
          const nextCost = current.cost + Number(edge?.cost);
          if (!edge || nextCost > maximum || (reachable.get(pointKey(next))?.cost ?? Infinity) <= nextCost) continue;
          const result = { path: [...current.path, next], cost: nextCost, terminal: edge.stoppedByDifficult, stopReason: edge.stoppedByDifficult ? "difficult-terrain" : null };
          reachable.set(pointKey(next), result);
          if (!edge.stoppedByDifficult) queue.push({ ...next, ...result });
        }
      }
      return reachable;
    };
    const weightedPath = point => {
      const start = { x: Number(mover.x), y: Number(mover.y) };
      const target = { x: Number(point.x), y: Number(point.y) };
      if (start.x === target.x && start.y === target.y) return footprintAvailable(start) ? { path: [], cost: 0 } : null;
      if (options.line) {
        let anchorRoute;
        try { anchorRoute = lionwing.movement(scene, mover, target, options); } catch { return null; }
        let previous = start, cost = 0;
        for (const segment of anchorRoute.path || []) {
          if (!footprintAvailable(segment)) return null;
          const edge = edgeStatus(previous, segment);
          if (!edge || cost + edge.cost > maximum || edge.stoppedByDifficult && segment !== anchorRoute.path.at(-1)) return null;
          cost += edge.cost; previous = segment;
        }
        const terminal=Boolean(anchorRoute.endedByDifficultTerrain);
        return { path: anchorRoute.path || [], cost, terminal, stopReason: terminal ? "difficult-terrain" : null };
      }
      return reachablePaths().get(pointKey(target)) || null;
    };
    const validPath = point => weightedPath(point);
    const direct = validPath(destination);
    const endpoint = result => result?.path?.at(-1) || { x: Number(mover.x), y: Number(mover.y) };
    let selected = direct ? { x: Number(endpoint(direct).x), y: Number(endpoint(direct).y), space: mover.space, ...direct, partial: Number(endpoint(direct).x) !== Number(destination.x) || Number(endpoint(direct).y) !== Number(destination.y) } : null;
    if (!selected && request.allowPartial === true) {
      const alternatives = [];
      for (let y = 0; y < Number(space.height); y += 1) for (let x = 0; x < Number(space.width); x += 1) {
        const result = validPath({ x, y });
        if (!result || !result.path.length) continue;
        const reached=endpoint(result);
        alternatives.push({ x:reached.x, y:reached.y, space: mover.space, ...result, partial: true, distance: Math.abs(reached.x - Number(destination.x)) + Math.abs(reached.y - Number(destination.y)) });
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
      origin: { space: mover.space, x: Number(mover.x), y: Number(mover.y) },
      mode: request.mode || "move",
      maximum,
      width,
      height,
      path: selected.path.map(point => ({ space: mover.space, x: Number(point.x), y: Number(point.y) })),
      spent: selected.cost,
      stoppedAt: { space: selected.space, x: selected.x, y: selected.y },
      remaining: selected.terminal ? 0 : Math.max(0, maximum - selected.cost),
      terminal: Boolean(selected.terminal),
      stopReason: selected.stopReason || null,
      partial: selected.partial,
      sceneVersion: Number(scene.version || 0),
      geometryStamp: geometryStamp(scene),
    };
    route.segments = routeSegments(route);
    route.cursor = geometryCursor(route, 0, scene);
    const plan = { schema: 1, kind: "lionwing.geometry.route", request: clone(request), route };
    return { available: true, reason: "", plan: clone(plan), route: clone(route) };
  }

  function revalidatePlan(scene, plan) {
    if (!plan || plan.schema !== 1 || plan.kind !== "lionwing.geometry.route" || !plan.route || !plan.request) return { available: false, stale: true, reason: "Некорректный геометрический план." };
    if (Number(plan.route.sceneVersion) !== Number(scene?.version || 0)) return { available: false, stale: true, reason: "Геометрический план устарел." };
    const fresh = routePlan(scene, plan.request);
    if (!fresh.available) return { available: false, stale: true, reason: fresh.reason || "Геометрический план изменился." };
    const saved = clone(plan.route), current = clone(fresh.route);
    // The additions (`segments` and `cursor`) are optional for old saves. For
    // a new save compare the complete route, while old saves compare their
    // original fields and receive the normalized segment view on return.
    const savedHasSegments = Array.isArray(saved.segments);
    if (saved.geometryStamp !== geometryStamp(scene)) return { available: false, stale: true, reason: "Геометрический план устарел." };
    if (savedHasSegments ? JSON.stringify(current) !== JSON.stringify(saved) : Object.keys(saved).some(key => key !== "cursor" && key !== "segments" && key !== "origin" && JSON.stringify(saved[key]) !== JSON.stringify(current[key]))) return { available: false, stale: true, reason: "Геометрический план устарел." };
    if (!savedHasSegments) {
      const mover = actorById(scene, saved.actorId);
      saved.origin ||= mover ? { space: mover.space, x: Number(mover.x), y: Number(mover.y) } : null;
      saved.segments = routeSegments(saved);
      saved.cursor = geometryCursor(saved, 0, scene);
    }
    return { available: true, stale: false, reason: "", plan: { ...clone(plan), route: saved }, route: saved };
  }

  global.DAWN_LIONWING_GEOMETRY = Object.freeze({ anchorStatus, footprintStatus, nearestCandidates, routePlan, revalidatePlan, geometryStamp, routeSegments, geometryCursor, segmentStatus });
})(typeof window === "object" ? window : globalThis);
