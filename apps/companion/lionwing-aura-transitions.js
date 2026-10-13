"use strict";

// Pure spatial queries and before/after transition detection for declarative
// LionWing auras. The engine remains responsible for lifetime, relation and
// authority checks; this module only answers where a body is and which active
// aura/target pairs appeared or disappeared after an authoritative mutation.
(function installLionwingAuraTransitions(global) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const actorById = (scene, id) => (scene?.actors || []).find(item => item.id === id) || null;

  function sourceEntity(scene, id) {
    const sourceActor = actorById(scene, id);
    if (sourceActor) return { kind: "actor", entity: sourceActor };
    const marker = (scene?.markers || []).find(item => item.id === id);
    return marker ? { kind: "marker", entity: marker } : null;
  }

  function bodyCells(entity) {
    if (!entity || !Number.isFinite(Number(entity.x)) || !Number.isFinite(Number(entity.y))) return [];
    const width = Math.max(1, Number.isSafeInteger(Number(entity.occupiedWidth)) ? Number(entity.occupiedWidth) : 1);
    const height = Math.max(1, Number.isSafeInteger(Number(entity.occupiedHeight)) ? Number(entity.occupiedHeight) : 1);
    const cells = [];
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      cells.push({ space: entity.space, x: Number(entity.x) + x, y: Number(entity.y) + y });
    }
    return cells;
  }

  function footprintDistance(left, right) {
    if (!left || !right || left.space !== right.space) return Infinity;
    const axisDistance = (a, b, sizeA, sizeB) => {
      if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return Infinity;
      const widthA = Math.max(1, Number.isSafeInteger(Number(sizeA)) ? Number(sizeA) : 1);
      const widthB = Math.max(1, Number.isSafeInteger(Number(sizeB)) ? Number(sizeB) : 1);
      const delta = Number(b) - Number(a);
      if (delta < -(widthB - 1)) return -delta - (widthB - 1);
      if (delta > widthA - 1) return delta - (widthA - 1);
      // Coordinates may be fractional on unnormalized snapshots. Preserve
      // the distance between discrete occupied cells even for overlapping
      // rectangles on different fractional offsets.
      return Math.abs(delta - Math.round(delta));
    };
    return axisDistance(left.x, right.x, left.occupiedWidth, right.occupiedWidth)
      + axisDistance(left.y, right.y, left.occupiedHeight, right.occupiedHeight);
  }

  function coverage(scene, aura, target) {
    const targetActor = typeof target === "string" ? actorById(scene, target) : target;
    if (!targetActor) return { active: false, reason: "Цель отсутствует на Сцене", distance: Infinity };
    const source = sourceEntity(scene, aura?.sourceEntityId);
    if (!source) return { active: false, reason: "Источник ауры отсутствует на Сцене", distance: Infinity };
    if (source.entity.space !== targetActor.space) return { active: false, reason: "Цель в другом пространстве", distance: Infinity };
    const radius = Number(aura?.shape?.distance ?? aura?.distance);
    const distance = footprintDistance(source.entity, targetActor);
    if (!Number.isSafeInteger(radius) || radius < 0 || distance > radius) return { active: false, reason: `За пределами радиуса ${radius}`, distance };
    return { active: true, reason: "В области ауры", distance };
  }

  const pairKey = item => `${item.auraId}\u0000${item.targetId}`;

  function capture(scene, status, actorIds = null) {
    if (typeof status !== "function") throw new Error("Для снимка аур нужен запрос активного состояния");
    const allowed = actorIds == null ? null : new Set(actorIds.map(String));
    const result = [];
    for (const aura of scene?.lionwing?.auras || []) for (const target of scene?.actors || []) {
      if (allowed && !allowed.has(String(target.id))) continue;
      const resolved = status(scene, aura, target);
      if (!resolved?.active) continue;
      result.push({
        auraId: aura.id,
        targetId: target.id,
        ownerActorId: aura.ownerActorId || null,
        sourceEntityId: aura.sourceEntityId || null,
        ruleId: aura.ruleId || null,
        effectId: aura.effectId || null,
        position: { space: target.space, x: Number(target.x), y: Number(target.y) },
      });
    }
    return result.sort((left, right) => pairKey(left).localeCompare(pairKey(right))).map(clone);
  }

  function diff(before, after) {
    const previous = new Map((before || []).map(item => [pairKey(item), item]));
    const current = new Map((after || []).map(item => [pairKey(item), item]));
    const transitions = [];
    for (const [key, item] of previous) if (!current.has(key)) transitions.push({ operation: "exit", ...clone(item) });
    for (const [key, item] of current) if (!previous.has(key)) transitions.push({ operation: "enter", ...clone(item) });
    return transitions.sort((left, right) => pairKey(left).localeCompare(pairKey(right)) || left.operation.localeCompare(right.operation));
  }

  global.DAWN_LIONWING_AURA_TRANSITIONS = Object.freeze({ bodyCells, footprintDistance, coverage, capture, diff });
})(typeof window !== "undefined" ? window : globalThis);
