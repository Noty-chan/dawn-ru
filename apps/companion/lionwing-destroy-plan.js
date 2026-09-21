"use strict";

// Read-only preparation and one-shot application for the L05 cleanup boundary.
// This file deliberately does not install handlers or write to the live Scene.
(function installLionwingDestroyPlan(global) {
  const SCHEMA = 1;
  const SOURCE_POLICIES = new Set(["disable", "remove", "detach"]);
  const TARGET_KINDS = new Set(["actor", "space", "entity", "registry-row", "backing"]);
  const BACKING_TYPES = new Set(["actor", "marker", "object", "area", "wall"]);
  const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);

  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const publicPlan = value => { const result = clone(value); if (result?.type === "lionwing.destroy-plan") delete result.before; return result; };
  const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const isObject = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const asId = (value, label = "ID") => {
    if (typeof value !== "string" || !value.trim() || value.length > 180 || /[\u0000-\u001f\s]/u.test(value) || RESERVED_IDS.has(value)) {
      throw new DestroyPlanError(`Некорректный ${label}.`, "invalid-id", { label });
    }
    return value.trim();
  };

  class DestroyPlanError extends Error {
    constructor(message, code = "destroy-plan-error", details = {}) {
      super(message);
      this.name = "LionWingDestroyPlanError";
      this.code = code;
      this.details = clone(details);
    }
  }

  const fail = (message, code, details) => { throw new DestroyPlanError(message, code, details); };

  // This table is the contract consumed by L07.  A registry row is a reference
  // to a backing; it is never a second copy of that backing.  The table is kept
  // as data so a review can see what is removed, moved, or merely invalidated.
  const REMOVAL_TABLE = Object.freeze([
    Object.freeze({ target: "actor", subject: "actor", action: "remove", rule: "exact actor id (all Compound parts)" }),
    Object.freeze({ target: "actor", subject: "registry-row", action: "remove", rule: "ownerActorId or backing.actorId is removed" }),
    Object.freeze({ target: "actor", subject: "backing", action: "remove", rule: "owned marker/object/area/wall or actor backing" }),
    Object.freeze({ target: "actor", subject: "space", action: "preserve", rule: "the field remains; no implicit space deletion" }),
    Object.freeze({ target: "actor", subject: "pending", action: "invalidate", rule: "only exact actor fields and arrays" }),
    Object.freeze({ target: "space", subject: "actor", action: "transfer", rule: "move to main/return fallback; Compound stays together" }),
    Object.freeze({ target: "space", subject: "registry-row", action: "remove", rule: "backing in the removed space becomes unavailable" }),
    Object.freeze({ target: "space", subject: "backing", action: "remove", rule: "objects, areas, walls, markers, and topology in the space" }),
    Object.freeze({ target: "space", subject: "space", action: "remove", rule: "exact space id after evacuation" }),
    Object.freeze({ target: "space", subject: "pending", action: "invalidate", rule: "only exact space fields" }),
    Object.freeze({ target: "any", subject: "source-dependent", action: "policy", rule: "sourceLossPolicy: disable/remove/detach; independent consequences are preserved separately" }),
  ]);

  // Paths are intentionally enumerated.  The planner never walks arbitrary
  // JSON looking for strings that happen to equal an ID.
  const REFERENCE_TABLE = Object.freeze([
    Object.freeze({ root: ["pendingAction"], kind: "pending", actor: Object.freeze(["actorId", "sourceActorId", "targetId", "targetIds", "participantIds", "affectedActorIds", "context.actorId", "context.sourceActorId", "context.targetId", "context.targetIds", "context.participantIds"]), space: Object.freeze(["space", "spaceId", "context.space", "context.spaceId"]) }),
    Object.freeze({ root: ["pendingActionPlan"], kind: "pending", actor: Object.freeze(["actorId", "sourceActorId", "targetId", "targetIds", "participantIds", "affectedActorIds", "context.actorId", "context.sourceActorId", "context.targetId", "context.targetIds", "context.participantIds"]), space: Object.freeze(["space", "spaceId", "context.space", "context.spaceId"]) }),
    Object.freeze({ root: ["pendingPrompt"], kind: "pending", actor: Object.freeze(["sourceActorId", "actorId", "targetId", "targetIds", "participantIds", "context.sourceActorId", "context.actorId", "context.targetId", "context.targetIds"]), space: Object.freeze(["space", "spaceId", "context.space", "context.spaceId"]) }),
    Object.freeze({ root: ["challengeRequest"], kind: "pending", actor: Object.freeze(["actorId", "targetId", "participantIds"]), space: Object.freeze(["space", "spaceId"]) }),
    Object.freeze({ root: ["opposedRoll"], kind: "pending", actor: Object.freeze(["actorId", "sourceActorId", "targetId", "participantIds.*.actorId", "participants.*.actorId"]), space: Object.freeze(["space", "spaceId", "participants.*.space"]) }),
    Object.freeze({ root: ["triggerQueue"], kind: "pending-row", actor: Object.freeze(["*.event.actorId", "*.event.payload.actorId", "*.event.payload.sourceActorId", "*.event.payload.targetId", "*.event.payload.targetIds", "*.event.payload.participantIds", "*.event.payload.affectedActorIds"]), space: Object.freeze(["*.event.payload.space", "*.event.payload.spaceId", "*.event.payload.targetSpaceId"]) }),
    Object.freeze({ root: ["lionwing", "choices"], kind: "pending-row", actor: Object.freeze(["*.actorId", "*.sourceActorId", "*.targetId", "*.targetIds", "*.participantIds", "*.context.actorId", "*.context.sourceActorId", "*.context.targetId", "*.context.targetIds"]), space: Object.freeze(["*.space", "*.spaceId", "*.context.space", "*.context.spaceId"]) }),
    Object.freeze({ root: ["lionwing", "deferred"], kind: "pending-row", actor: Object.freeze(["*.actorId", "*.sourceActorId", "*.targetId", "*.targetIds", "*.participantIds", "*.p.actorId", "*.p.sourceActorId", "*.p.targetId", "*.p.targetIds"]), space: Object.freeze(["*.space", "*.spaceId", "*.p.space", "*.p.spaceId"]) }),
    Object.freeze({ root: ["lionwing", "pausedChains"], kind: "pending-row", actor: Object.freeze(["*.actorId", "*.sourceActorId", "*.targetId", "*.targetIds", "*.participantIds", "*.pendingAction.actorId", "*.pendingAction.targetId", "*.pendingAction.targetIds"]), space: Object.freeze(["*.space", "*.spaceId", "*.pendingAction.space", "*.pendingAction.spaceId"]) }),
    Object.freeze({ root: ["lionwing", "afterAttack"], kind: "pending-row", actor: Object.freeze(["*.actorId", "*.sourceActorId", "*.targetId", "*.targetIds", "*.participantIds"]), space: Object.freeze(["*.space", "*.spaceId"]) }),
    Object.freeze({ root: ["lionwing", "subscriptions"], kind: "runtime", actor: Object.freeze(["*.ownerActorId", "*.sourceActorId", "*.targetActorId", "*.actorId"]), entity: Object.freeze(["*.entityId", "*.sourceEntityId", "*.targetEntityId"]), space: Object.freeze(["*.space", "*.spaceId"]) }),
    Object.freeze({ root: ["lionwing", "auras"], kind: "runtime", actor: Object.freeze(["*.ownerActorId", "*.sourceActorId", "*.targetActorId", "*.actorId"]), entity: Object.freeze(["*.entityId", "*.sourceEntityId", "*.targetEntityId", "*.suppressedBy"]), space: Object.freeze(["*.space", "*.spaceId"]) }),
    Object.freeze({ root: ["lionwing", "executionCursor"], kind: "pending", actor: Object.freeze(["actorId", "sourceActorId", "targetId", "targetIds", "context.actorId", "context.targetId", "context.targetIds"]), entity: Object.freeze(["entityId", "sourceEntityId", "targetEntityId", "context.entityId", "context.sourceEntityId"]), space: Object.freeze(["space", "spaceId", "context.space", "context.spaceId"]) }),
    Object.freeze({ root: ["actors"], kind: "runtime", defaultPolicy: "disable", rowDepth: 5, actor: Object.freeze(["*.effectStates.*.sources.*.sourceActorId", "*.effectStates.*.sources.*.actorId", "*.ruleResources.*.sourceActorId", "*.ruleClocks.*.sourceActorId"]), entity: Object.freeze(["*.effectStates.*.sources.*.sourceEntityId", "*.effectStates.*.sources.*.entityId", "*.ruleResources.*.sourceEntityId", "*.ruleResources.*.entityId", "*.ruleClocks.*.sourceEntityId", "*.ruleClocks.*.entityId"]), space: Object.freeze([]) }),
  ]);

  const CLEANUP_ROOTS = Object.freeze([
    ["lionwing", "auras"], ["lionwing", "subscriptions"], ["lionwing", "choices"],
    ["lionwing", "deferred"], ["lionwing", "pausedChains"], ["lionwing", "afterAttack"],
    ["lionwing", "executionCursor"], ["pendingAction"], ["pendingActionPlan"],
    ["pendingPrompt"], ["triggerQueue"], ["challengeRequest"], ["opposedRoll"],
  ]);

  const pathParts = path => (Array.isArray(path) ? path.map(String) : String(path).split(".")).filter(Boolean);
  const rootKey = root => root.join(".");
  const readPath = (value, path) => {
    let current = value;
    for (const part of pathParts(path)) {
      if (part === "*") return undefined;
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  };
  const readPathEntries = (value, path, prefix = []) => {
    const parts = pathParts(path);
    if (!parts.length) return [{ value, path: prefix }];
    const [part, ...rest] = parts;
    if (part === "*") {
      if (Array.isArray(value)) return value.flatMap((item, index) => readPathEntries(item, rest.join("."), [...prefix, index]));
      if (isObject(value)) return Object.entries(value).flatMap(([key, item]) => readPathEntries(item, rest.join("."), [...prefix, key]));
      return [];
    }
    if (value == null || !own(value, part)) return [];
    return readPathEntries(value[part], rest.join("."), [...prefix, part]);
  };
  const readAbsoluteEntries = (scene, root, path) => readPathEntries(readPath(scene, root), path, [...root]);
  const parentAndKey = (value, path) => {
    const parts = Array.isArray(path) ? path : pathParts(path);
    if (!parts.length) return { parent: null, key: null };
    let parent = value;
    for (const part of parts.slice(0, -1)) {
      if (parent == null) return { parent: null, key: parts.at(-1) };
      parent = parent[part];
    }
    return { parent, key: parts.at(-1) };
  };
  const writePath = (value, path, next) => {
    const { parent, key } = parentAndKey(value, path);
    if (parent == null || key == null) return false;
    if (next === undefined) delete parent[key]; else parent[key] = next;
    return true;
  };

  function normalizeBacking(raw) {
    if (typeof raw === "string") {
      const match = /^(actor|marker|object|area|wall):(.+)$/u.exec(raw);
      if (!match) fail("Backing должен содержать явный тип и ID.", "invalid-backing");
      return { type: match[1], id: asId(match[2], `ID backing (${match[1]})`) };
    }
    if (!isObject(raw)) fail("Backing должен быть типизированной ссылкой.", "invalid-backing");
    const keys = [...BACKING_TYPES].filter(type => raw[`${type}Id`] != null);
    const type = typeof raw.type === "string" ? raw.type : typeof raw.kind === "string" ? raw.kind : keys[0];
    if (!BACKING_TYPES.has(type)) fail("Неизвестный тип backing.", "invalid-backing");
    const id = raw[`${type}Id`] ?? raw.id ?? raw.entityId;
    if (keys.length > 1 || keys.length === 1 && keys[0] !== type || id == null) fail("Backing должен содержать одну типизированную ссылку.", "ambiguous-backing");
    return { type, id: asId(id, `ID backing (${type})`) };
  }

  function normalizeTarget(raw) {
    if (typeof raw === "string") {
      const typed = /^(actor|space|entity|registry-row|backing):(.+)$/u.exec(raw);
      if (typed) return { kind: typed[1], id: asId(typed[2]) };
      return { kind: "actor", id: asId(raw) };
    }
    if (!isObject(raw)) fail("Цель удаления должна быть типизированной ссылкой.", "invalid-target");
    const kindRaw = raw.kind ?? raw.type ?? raw.targetType;
    if (kindRaw === "backing" || raw.backing != null) return { kind: "backing", backing: normalizeBacking(raw.backing ?? raw), id: asId(raw.id ?? raw.backing?.id ?? raw.entityId ?? raw.targetId) };
    const aliases = { registry: "registry-row", "registryRow": "registry-row", entity: "entity", actor: "actor", space: "space" };
    const kind = aliases[kindRaw] || kindRaw;
    if (!TARGET_KINDS.has(kind)) fail("Неизвестный тип цели удаления.", "invalid-target-kind", { kind: kindRaw });
    const typedId = raw[`${kind === "registry-row" ? "entity" : kind}Id`] ?? raw.id ?? raw.entityId ?? raw.targetId ?? raw.spaceId;
    return { kind, id: asId(typedId, `ID цели (${kind})`) };
  }

  function roleOf(options = {}) { return options.role || options.viewerRole || null; }
  function assertNarrator(options = {}) {
    const role = roleOf(options);
    if (!["narrator", "gm"].includes(role)) fail("Единое удаление доступно только Нарратору.", "narrator-authority");
    if (options.actorId != null && !["narrator", "gm"].includes(String(options.actorId))) fail("ID игрока не может повышать полномочия до Нарратора.", "narrator-authority");
  }
  function assertVersion(scene, expected, code = "stale-version") {
    if (expected == null) return;
    const actual = Number(scene?.version || 0);
    if (Number(expected) !== actual) fail("Сцена изменилась: подготовленный план устарел.", code, { expected: Number(expected), actual });
  }
  function sceneFingerprint(scene) { return JSON.stringify(scene); }

  function entitiesApi(options = {}) { return options.entities || global.DAWN_LIONWING_ENTITIES || null; }
  function engineApi(options = {}) { return options.engine || global.DAWN_LIONWING_ENGINE || global.DAWN_SCENE_ENGINE || null; }
  function validateTable(options = {}) { return options.validateTableEdit || global.validateTableEdit || null; }
  function explicitPrimitive(options, name) {
    return options[name] || options.primitives?.[name] || null;
  }

  function actorById(scene, id) { return (scene?.actors || []).find(actor => actor?.id === id) || null; }
  function spaceById(scene, id) { return (scene?.spaces || []).find(space => space?.id === id) || null; }
  function collection(scene, type) {
    if (type === "actor") return scene?.actors || [];
    if (type === "marker") return scene?.markers || [];
    if (type === "object") return scene?.objects || [];
    if (type === "area") return [...(scene?.areas || []), ...(scene?.objects || []).filter(item => item?.type === "area")];
    if (type === "wall") return scene?.walls || [];
    return [];
  }
  function findBacking(scene, backing) { return collection(scene, backing.type).find(item => item?.id === backing.id) || null; }
  function registryRawEntries(scene) {
    const records = scene?.lionwing?.entities;
    if (Array.isArray(records)) return records.map(item => [item?.id, item]).filter(item => typeof item[0] === "string");
    return isObject(records) ? Object.entries(records) : [];
  }
  function registryRows(scene, entities) {
    if (entities?.query) {
      try { return entities.query(scene).map(row => clone(row)); } catch { /* malformed graph is reported below */ }
    }
    return registryRawEntries(scene).map(([, row]) => clone(row)).filter(isObject);
  }
  function rowBacking(row) {
    try { return normalizeBacking(row?.backing); } catch { return null; }
  }
  function rowSource(row) {
    const source = row?.source;
    if (isObject(source)) {
      for (const type of ["actor", "entity", "action", "event", "scene", "detached"]) if (source[`${type}Id`] != null) return { type, id: String(source[`${type}Id`]) };
      if (source.type && source.id != null) return { type: String(source.type), id: String(source.id) };
    }
    if (row?.sourceActorId != null) return { type: "actor", id: String(row.sourceActorId) };
    if (row?.sourceEntityId != null) return { type: "entity", id: String(row.sourceEntityId) };
    return null;
  }

  function compoundActorIds(scene, actor) {
    if (!actor?.compoundId) return [actor?.id].filter(Boolean);
    const ids = (scene.actors || []).filter(item => item?.compoundId === actor.compoundId && item.team === actor.team && (item.kind === "enemy" || item.profileId)).map(item => item.id);
    return ids.length ? ids : [actor.id];
  }

  function directPathReferences(scene, specs, kind, ids) {
    const result = [];
    const idSet = new Set(ids);
    for (const spec of specs) {
      const rootValue = readPath(scene, spec.root);
      for (const path of spec[kind] || []) {
        for (const entry of readAbsoluteEntries(scene, spec.root, path)) {
          const value = entry.value;
          const matches = Array.isArray(value) ? value.filter(item => idSet.has(item)) : idSet.has(value) ? [value] : [];
          const relativePath = entry.path.slice(spec.root.length);
          const rowIndex = relativePath.length ? relativePath[0] : null;
          const rowRelative = spec.rowDepth ? relativePath.slice(0, Math.min(Number(spec.rowDepth), relativePath.length - 1)) : rowIndex == null ? [] : [rowIndex];
          const rowPath = rowRelative.length ? [...spec.root, ...rowRelative] : [...spec.root];
          const row = rowIndex == null ? rootValue : Array.isArray(rootValue) ? rootValue[rowIndex] : rootValue?.[rowIndex];
          for (const matched of matches) result.push({ root: [...spec.root], path: entry.path.slice(spec.root.length), absolutePath: entry.path, rowPath, kind, value: matched, rootKind: spec.kind, field: entry.path.at(-1), policy: spec.kind === "runtime" ? sourcePolicy(row, spec.defaultPolicy || "remove") : "remove" });
        }
      }
    }
    return result;
  }

  function sourcePolicy(row, fallback = "remove") {
    const value = row?.sourceLossPolicy ?? row?.onSourceLoss;
    return SOURCE_POLICIES.has(value) ? value : fallback;
  }
  function dependencyProtected(row) {
    if (!isObject(row)) return false;
    if (row.cleanupProtected === true || row.protected === true || row.required === true || row.unresolved === true || row.resolvable === false || row.dependencyState === "unresolved") return true;
    return row.removable === false && ["remove", "purge"].includes(row.cleanupPolicy || row.sourceLossPolicy || row.onSourceLoss);
  }

  function cleanRuntimeRoots(scene) {
    const next = clone(scene);
    for (const path of CLEANUP_ROOTS) writePath(next, path, path.length === 1 ? null : []);
    next.lionwing ||= {};
    next.lionwing.entityReceipts = clone(scene?.lionwing?.entityReceipts || {});
    // The entity primitive is exercised against a copy with actor runtime
    // streams removed.  Runtime fields are reapplied by the typed planner.
    next.actors = (next.actors || []).map(actor => ({ ...actor, effectStates: {}, ruleResources: {}, ruleClocks: {}, lionwing: {} }));
    return next;
  }

  function validateRegistry(scene, entities) {
    if (!entities?.validateGraph) return;
    const status = entities.validateGraph(scene);
    if (!status.valid && status.errors?.some(error => error.code !== "missing-source" && error.code !== "missing-owner")) fail("Реестр сущностей повреждён; удаление остановлено.", "invalid-entity-graph", { errors: clone(status.errors) });
  }

  function prepareEntityOperations(scene, target, affectedBackingIds, options) {
    const entities = entitiesApi(options);
    const rows = registryRows(scene, entities);
    if (!rows.length) return { operations: [], events: [], registryBefore: {}, registryAfter: {}, removedIds: [], disabledIds: [], detachedIds: [], rows: [] };
    if (!entities) fail("Для удаления реестровых строк нужен LionWing Entities primitive.", "entities-unavailable");
    validateRegistry(scene, entities);
    const directRemove = new Set();
    const sourceActors = new Set();
    if (target.kind === "actor") {
      const actorIds = new Set(target.actorIds || [target.id]);
      for (const row of rows) {
        const backing = rowBacking(row);
        if (actorIds.has(row.ownerActorId) || backing?.type === "actor" && actorIds.has(backing.id)) directRemove.add(row.id);
      }
      for (const actorId of actorIds) sourceActors.add(actorId);
    } else if (target.kind === "space") {
      for (const row of rows) {
        const backing = rowBacking(row);
        if (backing && affectedBackingIds.has(`${backing.type}:${backing.id}`)) directRemove.add(row.id);
      }
    } else if (["entity", "registry-row"].includes(target.kind)) directRemove.add(target.id);
    else if (target.kind === "backing") {
      for (const row of rows) {
        const backing = rowBacking(row);
        if (backing && backing.type === target.backing.type && backing.id === target.backing.id) directRemove.add(row.id);
      }
    }

    const operations = [];
    const events = [];
    const simulated = cleanRuntimeRoots(scene);
    const expectedVersion = Number(scene.version || 0);
    const seenSource = new Set();
    const sourceOps = [...sourceActors].sort();
    for (const actorId of sourceOps) {
      if (!entities.sourceLossPlan || !entities.sourceLoss) continue;
      const sourcePlan = entities.sourceLossPlan(simulated, { actorId });
      if (sourcePlan.actions?.some(action => dependencyProtected(action)) || sourcePlan.cleanup?.cleanups?.some(item => item.protected || item.resolved === false)) fail("Удаление блокирует защищённую зависимость сущности.", "protected-dependency", { source: { type: "actor", id: actorId }, actions: clone(sourcePlan.actions), cleanup: clone(sourcePlan.cleanup) });
      if (!sourcePlan.actions?.length) continue;
      const eventId = `${options.idempotencyKey || options.eventId || "destroy-plan"}:source:${actorId}`;
      const result = entities.sourceLoss(simulated, { actorId }, { role: "narrator", eventId, expectedVersion, propagateSourceLoss: true });
      Object.assign(simulated, result.scene);
      operations.push({ operation: "source-loss", source: { actorId }, eventId, actions: clone(sourcePlan.actions) });
      if (result.event) events.push(clone(result.event));
      for (const action of sourcePlan.actions || []) if (action.action === "remove") seenSource.add(action.entityId);
    }

    for (const rowId of [...directRemove].sort()) {
      const originalPrepared = entities.prepareDestroy?.(scene, rowId, { role: "narrator", purge: true, expectedVersion, propagateSourceLoss: true });
      if (originalPrepared?.cleanup?.cleanups?.some(item => item.protected || item.resolved === false)) fail("Удаление блокирует защищённую зависимость сущности.", "protected-dependency", { entityId: rowId, cleanup: clone(originalPrepared.cleanup) });
      const current = registryRows(simulated, entities).find(row => row.id === rowId);
      if (!current) continue;
      const prepared = entities.prepareDestroy?.(simulated, rowId, { role: "narrator", purge: true, expectedVersion, propagateSourceLoss: true });
      if (prepared?.cleanup?.cleanups?.some(item => item.protected || item.resolved === false)) fail("Удаление блокирует защищённую зависимость сущности.", "protected-dependency", { entityId: rowId, cleanup: clone(prepared.cleanup) });
      const eventId = `${options.idempotencyKey || options.eventId || "destroy-plan"}:entity:${rowId}`;
      const result = entities.destroy(simulated, rowId, { role: "narrator", purge: true, expectedVersion, eventId, propagateSourceLoss: true });
      Object.assign(simulated, result.scene);
      operations.push({ operation: "remove", entityId: rowId, eventId, backing: clone(rowBacking(current)) });
      if (result.event) events.push(clone(result.event));
    }
    const beforeMap = Object.fromEntries(rows.map(row => [row.id, row]));
    const afterRows = registryRows(simulated, entities);
    const afterMap = Object.fromEntries(afterRows.map(row => [row.id, row]));
    const removedIds = Object.keys(beforeMap).filter(id => !own(afterMap, id)).sort();
    const disabledIds = afterRows.filter(row => row.lifecycle === "disabled" && beforeMap[row.id]?.lifecycle !== "disabled").map(row => row.id).sort();
    const detachedIds = afterRows.filter(row => row.source?.detachedId && !beforeMap[row.id]?.source?.detachedId).map(row => row.id).sort();
    return { operations, events, registryBefore: clone(beforeMap), registryAfter: clone(afterMap), removedIds, disabledIds, detachedIds, rows: clone(rows), simulated };
  }

  function backingRowsForActor(scene, actorIds) {
    const ids = new Set(actorIds);
    const result = [];
    const add = (type, row, rule) => {
      if (!row?.id || !ids.has(row.ownerActorId)) return;
      result.push({ type, id: row.id, action: "remove", rule, sourceLossPolicy: sourcePolicy(row, "remove") });
    };
    for (const row of scene.markers || []) add("marker", row, "ownerActorId");
    for (const row of scene.objects || []) add("object", row, "ownerActorId");
    for (const row of scene.areas || []) add("area", row, "ownerActorId");
    for (const row of scene.walls || []) add("wall", row, "ownerActorId");
    return result;
  }

  function backingRowsForSpace(scene, spaceId) {
    const result = [];
    for (const [type, rows] of [["marker", scene.markers], ["object", scene.objects], ["area", scene.areas], ["wall", scene.walls], ["cut", scene.topology?.cuts]]) {
      for (const row of rows || []) if (row?.space === spaceId) result.push({ type, id: row.id, action: "remove", rule: "space" });
    }
    return result;
  }

  function placementGroups(scene, actors) {
    const groups = [], seen = new Set();
    for (const actor of actors) {
      if (!actor || seen.has(actor.id)) continue;
      const key = actor.compoundId ? `compound:${actor.compoundId}:${actor.team}` : `actor:${actor.id}`;
      if (seen.has(key)) continue;
      const group = actor.compoundId ? actors.filter(item => item.compoundId === actor.compoundId && item.team === actor.team) : [actor];
      group.forEach(item => seen.add(item.id)); seen.add(key); groups.push(group);
    }
    return groups;
  }

  function actorFootprint(actor, space, x = actor?.x, y = actor?.y) {
    const width = Math.max(1, Number(actor?.occupiedWidth || actor?.width || 1));
    const height = Math.max(1, Number(actor?.occupiedHeight || actor?.height || 1));
    const left = Number(x), top = Number(y);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    const cells = [];
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) {
      const cellX = left + dx, cellY = top + dy;
      if (cellX < 0 || cellY < 0 || cellX >= Number(space?.width || 0) || cellY >= Number(space?.height || 0)) return null;
      cells.push(`${cellX},${cellY}`);
    }
    return cells;
  }

  function internalPlaceActorsSafely(scene, actors, space, reserveName) {
    if (!space) fail("Не найдено резервное пространство для переноса.", "missing-fallback-space");
    const movingIds = new Set(actors.map(actor => actor.id));
    const occupied = new Set();
    for (const actor of (scene.actors || []).filter(item => item.space === space.id && !movingIds.has(item.id) && item.kind !== "crowd")) {
      for (const key of actorFootprint(actor, space) || [`${actor.x},${actor.y}`]) occupied.add(key);
    }
    const blocked = new Set((scene.objects || []).filter(object => object.space === space.id && object.type === "terrain").flatMap(object => object.cells || []));
    const removed = new Set((scene.topology?.cuts || []).filter(cut => cut.space === space.id).flatMap(cut => cut.cells || []));
    const all = Array.from({ length: Number(space.width || 0) * Number(space.height || 0) }, (_, index) => `${index % Number(space.width)},${Math.floor(index / Number(space.width))}`);
    const groups = placementGroups(scene, actors);
    const transfers = [], reserves = [];
    let reserve = null, reserveCreated = false;
    const reserveOccupied = new Set();
    for (const group of groups) {
      const lead = group[0], preferred = space.mode === "cinematic" ? [lead.team === "enemy" ? "6,0" : "0,0"] : all;
      const fits = (key, target = space, used = occupied) => {
        const [x, y] = key.split(",").map(Number), cells = actorFootprint(lead, target, x, y);
        return Boolean(cells?.length && cells.every(cell => !used.has(cell) && (target !== space || !blocked.has(cell) && !removed.has(cell))));
      };
      const cell = preferred.find(fits);
      const width = Math.max(1, Number(lead?.occupiedWidth || lead?.width || 1)), height = Math.max(1, Number(lead?.occupiedHeight || lead?.height || 1));
      let destination = space, key = cell;
      if (!key) {
        reserve ||= { id: `destroy-plan-reserve:${space.id}`, name: reserveName, mode: "cinematic", width: Math.max(7, width), height: Math.max(1, height) };
        if (width > reserve.width || height > reserve.height) fail("Для переноса участника не хватает места даже в резервном поле.", "placement-failed", { actorIds: group.map(actor => actor.id), footprint: { width, height } });
        if (!scene.spaces.some(item => item.id === reserve.id)) { scene.spaces.push(reserve); reserveCreated = true; }
        let reserveKey = null;
        for (let y = 0; !reserveKey; y += 1) for (let x = 0; x + width <= reserve.width; x += 1) {
          if (y + height > reserve.height) reserve.height = y + height;
          const candidate = `${x},${y}`;
          if (fits(candidate, reserve, reserveOccupied)) { reserveKey = candidate; break; }
        }
        if (!reserveKey) fail("Резервное поле не может разместить участника без пересечения клеток.", "placement-failed", { actorIds: group.map(actor => actor.id), footprint: { width, height } });
        destination = reserve; key = reserveKey;
        for (const reserveCell of actorFootprint(lead, reserve, ...key.split(",").map(Number)) || []) reserveOccupied.add(reserveCell);
      } else for (const occupiedCell of actorFootprint(lead, space, ...key.split(",").map(Number)) || []) occupied.add(occupiedCell);
      const [x, y] = key.split(",").map(Number);
      for (const actor of group) { const from = { space: actor.space, x: actor.x, y: actor.y }; Object.assign(actor, { space: destination.id, x, y }); transfers.push({ actorId: actor.id, from, to: { space: destination.id, x, y }, groupId: actor.compoundId || null }); }
    }
    return { transfers, reserves: reserveCreated && reserve ? [clone(reserve)] : reserves };
  }

  function placementPreview(scene, movingIds, fallback, targetSpace, options, reserveName) {
    const copyScene = clone(scene);
    const moving = (copyScene.actors || []).filter(actor => movingIds.has(actor.id));
    const place = explicitPrimitive(options, "placeActorsSafely");
    let result;
    if (typeof place === "function") {
      const output = place(copyScene, moving, copyScene.spaces.find(space => space.id === fallback.id), reserveName);
      result = output?.scene ? output : { scene: Array.isArray(output?.actors) ? output : copyScene, primitive: output };
    } else result = { scene: copyScene, ...internalPlaceActorsSafely(copyScene, moving, copyScene.spaces.find(space => space.id === fallback.id), reserveName) };
    const previewScene = result.scene || copyScene;
    const originalById = new Map((scene.actors || []).map(actor => [actor.id, actor]));
    const placedById = new Map((previewScene.actors || []).map(actor => [actor.id, actor]));
    const transfers = [...movingIds].map(actorId => {
      const before = originalById.get(actorId), after = placedById.get(actorId);
      return { actorId, from: { space: before?.space || targetSpace.id, x: before?.x, y: before?.y }, to: { space: after?.space, x: after?.x, y: after?.y }, groupId: after?.compoundId || before?.compoundId || null };
    });
    return { transfers, reserves: result.reserves || previewScene.spaces.filter(space => String(space.id).startsWith(`destroy-plan-reserve:${targetSpace.id}`)).map(clone), previewScene };
  }

  function collectPlanReferences(scene, target, removedEntityIds = []) {
    const targetByKind = target.kind === "actor" ? { actor: target.actorIds || [target.id] } : target.kind === "space" ? { space: [target.id] } : target.kind === "entity" || target.kind === "registry-row" ? { entity: [target.id] } : target.kind === "backing" ? { [target.backing.type]: [target.backing.id] } : {};
    const references = [];
    for (const [kind, ids] of Object.entries(targetByKind)) {
      if (!["actor", "space", "entity"].includes(kind)) continue;
      references.push(...directPathReferences(scene, REFERENCE_TABLE, kind, ids));
    }
    if (removedEntityIds.length) references.push(...directPathReferences(scene, REFERENCE_TABLE, "entity", removedEntityIds));
    return references;
  }

  function planRuntimeActions(scene, references, target, removedEntityIds) {
    const actions = [];
    const protectedRows = [];
    const seen = new Set();
    for (const ref of references) {
      const rootValue = readPath(scene, ref.root);
      let row = rootValue;
      if (ref.rowPath?.length > ref.root.length) row = readPath(scene, ref.rowPath) || rootValue;
      const pathKey = `${rootKey(ref.absolutePath)}:${ref.value}`;
      if (seen.has(pathKey)) continue;
      seen.add(pathKey);
      const pending = ["pending", "pending-row"].includes(ref.rootKind);
      const policy = pending ? "remove" : sourcePolicy(row, ref.policy || "remove");
      if (dependencyProtected(row)) protectedRows.push({ path: ref.absolutePath, value: ref.value, row: clone(row) });
      actions.push({ path: ref.absolutePath, rowPath: ref.rowPath, root: ref.root, field: ref.field, kind: ref.kind, value: ref.value, rootKind: ref.rootKind, policy, action: pending ? "invalidate" : policy, reason: pending ? "Зависимая цепочка больше не имеет допустимой ссылки." : "Потерян типизированный источник." });
    }
    if (protectedRows.length) fail("Удаление блокирует защищённую зависимость.", "protected-dependency", { dependencies: protectedRows });
    return actions;
  }

  function applyRuntimeAction(scene, action) {
    if (["runtime", "pending-row"].includes(action.rootKind) && action.rowPath?.length > action.root.length) {
      const row = readPath(scene, action.rowPath);
      const rowParent = parentAndKey(scene, action.rowPath);
      if (action.action === "remove" || action.action === "invalidate") {
        if (Array.isArray(rowParent.parent)) rowParent.parent.splice(Number(rowParent.key), 1);
        else if (rowParent.parent && rowParent.key != null) delete rowParent.parent[rowParent.key];
        return;
      }
      if (isObject(row) && action.action === "disable") {
        writePath(scene, action.rowPath, { ...row, disabled: true, active: false, status: "disabled", disabledBy: [...new Set([...(row.disabledBy || []), action.value])] });
        return;
      }
      if (isObject(row) && action.action === "detach") {
        const detached = { ...row, detached: true, detachedBy: [...new Set([...(row.detachedBy || []), action.value])] };
        for (const field of ["sourceActorId", "sourceEntityId", "entityId", "targetEntityId", "actorId"]) if (detached[field] === action.value) delete detached[field];
        writePath(scene, action.rowPath, detached);
        return;
      }
    }
    const { parent, key } = parentAndKey(scene, action.path);
    if (parent == null || key == null) return;
    const value = parent[key];
    const targetValue = action.value;
    const clearMatching = current => Array.isArray(current) ? current.filter(item => item !== targetValue) : current === targetValue ? null : current;
    if (action.action === "remove" || action.action === "invalidate") {
      if (Array.isArray(value)) parent[key] = clearMatching(value);
      else if (value === targetValue || action.kind === "space" && key === "space") parent[key] = null;
      if (action.root[0] === "pendingAction" || action.root[0] === "pendingActionPlan" || action.root[0] === "pendingPrompt" || action.root[0] === "challengeRequest" || action.root[0] === "opposedRoll") {
        const root = readPath(scene, action.root);
        if (root && (action.kind !== "actor" || ["actorId", "sourceActorId", "targetId", "space", "spaceId"].includes(key) || Array.isArray(value) && !parent[key].length)) writePath(scene, action.root, null);
      }
    } else if (action.action === "disable") {
      if (isObject(parent[key])) parent[key] = { ...parent[key], disabled: true, active: false, status: "disabled", disabledBy: [...new Set([...(parent[key].disabledBy || []), action.value])] };
      else if (action.rowPath && isObject(readPath(scene, action.rowPath))) { const row = readPath(scene, action.rowPath); writePath(scene, action.rowPath, { ...row, disabled: true, active: false, status: "disabled", disabledBy: [...new Set([...(row.disabledBy || []), action.value])] }); }
    } else if (action.action === "detach") {
      if (isObject(parent[key])) parent[key] = { ...parent[key], detached: true, detachedBy: [...new Set([...(parent[key].detachedBy || []), action.value])] };
      else if (action.rowPath && isObject(readPath(scene, action.rowPath))) { const row = readPath(scene, action.rowPath); const detached = { ...row, detached: true, detachedBy: [...new Set([...(row.detachedBy || []), action.value])] }; if (detached[key] === action.value) delete detached[key]; writePath(scene, action.rowPath, detached); }
      else if (key) delete parent[key];
    }
  }

  function removeTypedBackings(scene, backings) {
    const byType = new Map();
    for (const backing of backings) { if (!backing?.id) continue; if (!byType.has(backing.type)) byType.set(backing.type, new Set()); byType.get(backing.type).add(backing.id); }
    const filter = (rows, type) => (rows || []).filter(row => !byType.get(type)?.has(row?.id));
    scene.markers = filter(scene.markers, "marker");
    scene.objects = filter(scene.objects, "object");
    scene.areas = filter(scene.areas, "area");
    scene.walls = filter(scene.walls, "wall");
    if (scene.topology?.cuts) scene.topology.cuts = filter(scene.topology.cuts, "cut");
  }

  function applyTypedBackings(scene, backings) {
    const action = backings || [];
    removeTypedBackings(scene, action);
  }

  function applyActorRemoval(scene, actorIds) {
    const ids = new Set(actorIds);
    scene.actors = (scene.actors || []).filter(actor => !ids.has(actor.id));
    scene.targetIds = (scene.targetIds || []).filter(id => !ids.has(id));
    if (ids.has(scene.selectedActor)) scene.selectedActor = null;
    if (ids.has(scene.activeActorId)) scene.activeActorId = null;
  }

  function applySpaceRemoval(scene, spaceId, fallbackId) {
    scene.spaces = (scene.spaces || []).filter(space => space.id !== spaceId);
    for (const space of scene.spaces) if (space.returnSpaceId === spaceId) space.returnSpaceId = fallbackId;
    if (scene.activeSpace === spaceId) scene.activeSpace = fallbackId;
    scene.targetCells = [];
  }

  function planDestroy(scene, rawTarget, options = {}) {
    assertNarrator(options);
    if (!isObject(scene)) fail("Сцена для удаления отсутствует.", "invalid-scene");
    const target = normalizeTarget(rawTarget);
    const expectedVersion = options.expectedVersion ?? options.expectedSceneVersion ?? scene.version ?? 0;
    assertVersion(scene, expectedVersion);
    const actor = target.kind === "actor" ? actorById(scene, target.id) : null;
    const space = target.kind === "space" ? spaceById(scene, target.id) : null;
    if (target.kind === "actor" && !actor) return { schema: SCHEMA, type: "lionwing.destroy-plan", ok: true, exists: false, target, expectedVersion: Number(expectedVersion), fingerprint: sceneFingerprint(scene), before: clone(scene), operations: [], references: [], backings: [], transfers: [], entity: { operations: [], events: [], removedIds: [] } };
    if (target.kind === "space" && (!space || space.id === "main")) fail(space ? "Основное поле удалить нельзя." : "Пространство для удаления не найдено.", space ? "protected-space" : "missing-space");
    if (["entity", "registry-row"].includes(target.kind) && !registryRawEntries(scene).some(([id]) => id === target.id)) return { schema: SCHEMA, type: "lionwing.destroy-plan", ok: true, exists: false, target, expectedVersion: Number(expectedVersion), fingerprint: sceneFingerprint(scene), before: clone(scene), operations: [], references: [], backings: [], transfers: [], entity: { operations: [], events: [], removedIds: [] } };
    if (target.kind === "backing" && !findBacking(scene, target.backing)) fail("Backing для удаления не найден.", "missing-backing", { backing: target.backing });

    const requestedActorIds = target.kind === "actor" && Array.isArray(options.actorIds) && options.actorIds.length ? [...new Set(options.actorIds.map(id => asId(id, "ID участника массового удаления")))] : null;
    if (requestedActorIds && requestedActorIds.some(id => !actorById(scene, id))) fail("Массовое удаление содержит участника, которого нет в Сцене.", "missing-actor", { actorIds: requestedActorIds });
    const actorIds = target.kind === "actor" ? [...new Set((requestedActorIds || [target.id]).flatMap(id => compoundActorIds(scene, actorById(scene, id))))] : [];
    const normalizedTarget = { ...target, actorIds };
    const targetSpace = space;
    let fallback = null, transfers = [], reserves = [], movingIds = new Set();
    let backings = [];
    if (target.kind === "actor") {
      backings = backingRowsForActor(scene, actorIds);
      for (const row of registryRows(scene, entitiesApi(options))) { const backing = rowBacking(row); if (actorIds.includes(row.ownerActorId) || backing?.type === "actor" && actorIds.includes(backing.id)) backings.push({ type: backing?.type || "actor", id: backing?.id || row.id, action: "remove", rule: "registry backing" }); }
    } else if (target.kind === "space") {
      fallback = (scene.spaces || []).find(item => item.id === "main" && item.id !== target.id) || (scene.spaces || []).find(item => item.id !== target.id);
      if (!fallback) fail("Для удаления пространства не осталось поля переноса.", "missing-fallback-space");
      const moving = (scene.actors || []).filter(item => item.space === target.id);
      moving.forEach(item => movingIds.add(item.id));
      const preview = placementPreview(scene, movingIds, fallback, targetSpace, options, `Резерв после удаления «${targetSpace.name || target.id}»`);
      transfers = preview.transfers; reserves = preview.reserves;
      backings = backingRowsForSpace(scene, target.id);
    } else if (target.kind === "backing") backings = [{ type: target.backing.type, id: target.backing.id, action: "remove", rule: "explicit backing target" }];

    const backingSet = new Set(backings.map(item => `${item.type}:${item.id}`));
    const entity = prepareEntityOperations(scene, normalizedTarget, backingSet, options);
    const references = collectPlanReferences(scene, normalizedTarget, entity.removedIds);
    const runtimeActions = planRuntimeActions(scene, references, normalizedTarget, entity.removedIds);
    const operations = [];
    if (target.kind === "actor") operations.push({ type: "actor.remove", actorIds: [...actorIds], action: "remove" });
    if (target.kind === "space") operations.push({ type: "actors.transfer", actorIds: [...movingIds], action: "transfer", fallbackSpaceId: fallback.id });
    operations.push(...backings.map(item => ({ type: "backing.remove", backing: { type: item.type, id: item.id }, action: "remove", rule: item.rule })));
    if (target.kind === "space") operations.push({ type: "space.remove", spaceId: target.id, action: "remove" });
    const plan = {
      schema: SCHEMA,
      type: "lionwing.destroy-plan",
      ok: true,
      exists: true,
      target: clone(normalizedTarget),
      expectedVersion: Number(expectedVersion),
      fingerprint: sceneFingerprint(scene),
      before: clone(scene),
      table: clone(REMOVAL_TABLE),
      operations,
      entity: {
        operations: clone(entity.operations),
        events: clone(entity.events),
        registryBefore: clone(entity.registryBefore),
        registryAfter: clone(entity.registryAfter),
        removedIds: clone(entity.removedIds),
        disabledIds: clone(entity.disabledIds),
        detachedIds: clone(entity.detachedIds),
      },
      references: clone(references),
      runtimeActions: clone(runtimeActions),
      backings: clone(backings),
      transfers: clone(transfers),
      reserves: clone(reserves),
      fallbackSpaceId: fallback?.id || null,
      createdAt: options.now || new Date().toISOString(),
    };
    return plan;
  }

  function invokePlacementForApply(scene, plan, options) {
    if (plan.target.kind !== "space") return;
    const place = explicitPrimitive(options, "placeActorsSafely");
    if (typeof place === "function") {
      const moving = (scene.actors || []).filter(actor => plan.transfers.some(item => item.actorId === actor.id));
      const fallback = scene.spaces.find(space => space.id === plan.fallbackSpaceId);
      const output = place(scene, moving, fallback, `Резерв после удаления «${plan.target.id}»`);
      if (output?.scene) return output.scene;
      if (Array.isArray(output?.actors) && Array.isArray(output?.spaces)) return output;
      return scene;
    }
    const moving = (scene.actors || []).filter(actor => plan.transfers.some(item => item.actorId === actor.id));
    const fallback = scene.spaces.find(space => space.id === plan.fallbackSpaceId);
    internalPlaceActorsSafely(scene, moving, fallback, `Резерв после удаления «${plan.target.id}»`);
    return scene;
  }

  function applyEntityPrimitives(scene, plan, options) {
    if (!plan.entity.operations.length) return scene;
    const entities = entitiesApi(options);
    if (!entities) fail("Для применения плана нужен LionWing Entities primitive.", "entities-unavailable");
    const simulated = cleanRuntimeRoots(scene);
    const expectedVersion = Number(plan.expectedVersion);
    for (const operation of plan.entity.operations) {
      let result;
      if (operation.operation === "source-loss") result = entities.sourceLoss(simulated, operation.source, { role: "narrator", eventId: operation.eventId, expectedVersion, propagateSourceLoss: true });
      else result = entities.destroy(simulated, operation.entityId, { role: "narrator", eventId: operation.eventId, expectedVersion, purge: true, propagateSourceLoss: true });
      Object.assign(simulated, result.scene);
    }
    const finalRegistry = Object.fromEntries(registryRows(simulated, entities).map(row => [row.id, row]));
    if (!sameJson(finalRegistry, plan.entity.registryAfter)) fail("Подготовленный план сущностей больше не совпадает с текущим реестром.", "stale-plan", { expected: plan.entity.registryAfter, actual: finalRegistry });
    scene.lionwing ||= {};
    scene.lionwing.entities = clone(simulated.lionwing.entities || {});
    scene.lionwing.entityReceipts = clone(simulated.lionwing.entityReceipts || {});
    scene.log = clone(simulated.log || scene.log || []);
    return scene;
  }

  function applyThroughEngine(scene, plan, options) {
    const engine = engineApi(options);
    const hasLivePending = Boolean(scene.pendingAction || scene.pendingPrompt || scene.pendingActionPlan || scene.lionwing?.choices?.length || scene.lionwing?.pausedChains?.length || scene.lionwing?.executionCursor);
    if (plan.target.kind === "space" && engine?.dispatchMany && !hasLivePending) {
      const event = { id: `${options.idempotencyKey || options.eventId || "destroy-plan"}:space:${plan.target.id}`, type: "space.remove", actorId: null, payload: { id: plan.target.id } };
      const result = engine.dispatchMany(scene, [event], { role: "narrator" });
      return { scene: result.scene, events: result.events || result.event ? (result.events || [result.event].filter(Boolean)) : [] };
    }
    if (plan.target.kind === "actor" && plan.target.actorIds?.length === 1 && actorById(scene, plan.target.actorIds[0])?.kind === "crowd" && engine?.dispatchMany && !hasLivePending) {
      const event = { id: `${options.idempotencyKey || options.eventId || "destroy-plan"}:actor:${plan.target.actorIds[0]}`, type: "actor.despawn", actorId: plan.target.actorIds[0], payload: { actorId: plan.target.actorIds[0], reason: "Единое удаление Нарратора" } };
      const result = engine.dispatchMany(scene, [event], { role: "narrator" });
      return { scene: result.scene, events: result.events || result.event ? (result.events || [result.event].filter(Boolean)) : [] };
    }
    return { scene, events: [] };
  }

  function receiptKey(plan, options) { return options.idempotencyKey || options.eventId || `destroy-plan:${plan.target.kind}:${plan.target.id}`; }
  function applyDestroyPlan(scene, rawPlan, options = {}) {
    assertNarrator(options);
    const plan = rawPlan?.type === "lionwing.destroy-plan" ? rawPlan : planDestroy(scene, rawPlan, options);
    const key = receiptKey(plan, options);
    const existing = scene?.lionwing?.destroyPlanReceipts?.[key];
    if (existing) {
      if (existing.fingerprint !== plan.fingerprint) fail("ID плана уже использован для другой операции.", "destroy-plan-event-conflict", { key });
      return { ok: true, scene: clone(scene), plan: publicPlan(plan), replayed: true, idempotent: true, events: [] };
    }
    assertVersion(scene, plan.expectedVersion, "stale-plan");
    if (sceneFingerprint(scene) !== plan.fingerprint) fail("Подготовленный план устарел: снимок Сцены изменился.", "stale-plan", { expectedVersion: plan.expectedVersion, actualVersion: Number(scene.version || 0) });
    if (plan.exists === false) return { ok: true, scene: clone(scene), plan: publicPlan(plan), replayed: true, idempotent: true, events: [] };
    const validator = validateTable(options);
    const plannedDestroy = options.plannedDestroy === true;
    const working = clone(scene);
    try {
      const placed = invokePlacementForApply(working, plan, options);
      if (placed !== working) Object.assign(working, placed);
      applyEntityPrimitives(working, plan, options);
      for (const action of plan.runtimeActions || []) applyRuntimeAction(working, action);
      if (plan.target.kind === "actor") working.targetIds = (working.targetIds || []).filter(id => !(plan.target.actorIds || [plan.target.id]).includes(id));
      if (plan.target.kind === "actor") applyTypedBackings(working, plan.backings);
      else if (plan.target.kind === "space") applyTypedBackings(working, plan.backings);
      else if (plan.target.kind === "backing") applyTypedBackings(working, plan.backings);
      let spaceHandledByAdapter = false;
      if (plan.target.kind === "space") {
        if (working.activeSpace === plan.target.id) working.activeSpace = plan.fallbackSpaceId;
        // The existing removeManagedSceneSpace hook is an integration adapter;
        // it is called only when explicitly supplied and only on this copy.
        const removeSpace = explicitPrimitive(options, "removeManagedSceneSpace");
        if (typeof removeSpace === "function") {
          const output = removeSpace(working, plan.target.id, { fallbackSpaceId: plan.fallbackSpaceId, prepared: true });
          if (output?.scene) Object.assign(working, output.scene);
          if (spaceById(working, plan.target.id)) fail("Адаптер удаления пространства не выполнил удаление.", "space-remove-postcondition", { spaceId: plan.target.id });
          spaceHandledByAdapter = true;
        }
      }
      const engineResult = spaceHandledByAdapter ? { scene: working, events: [] } : applyThroughEngine(working, plan, options);
      let finalScene = engineResult.scene;
      if (plan.target.kind === "actor") applyActorRemoval(finalScene, plan.target.actorIds || [plan.target.id]);
      if (plan.target.kind === "space" && !spaceHandledByAdapter) applySpaceRemoval(finalScene, plan.target.id, plan.fallbackSpaceId);
      if (plan.target.kind === "space" && spaceHandledByAdapter && !spaceById(finalScene, plan.target.id)) applySpaceRemoval(finalScene, plan.target.id, plan.fallbackSpaceId);
      const finalValidator = validateTable(options);
      if (typeof finalValidator === "function") finalValidator(plan.before || scene, finalScene, { plannedDestroy: plannedDestroy ? plan : null });
      if (options.advanceVersion !== false) finalScene.version = Number(plan.expectedVersion) + 1;
      else finalScene.version = Number(scene.version || plan.expectedVersion || 0);
      finalScene.lionwing ||= {};
      finalScene.lionwing.destroyPlanReceipts = { ...(finalScene.lionwing.destroyPlanReceipts || {}), [key]: { fingerprint: plan.fingerprint, target: clone(plan.target), version: finalScene.version } };
      if (options.recordHistory !== false) {
        finalScene.undo = Array.isArray(finalScene.undo) ? finalScene.undo : [];
        finalScene.undo.unshift({ id: `${key}:undo`, label: "Единое удаление", state: clone(scene) });
        finalScene.undo = finalScene.undo.slice(0, 20);
      }
      const events = [...(plan.entity.events || []), ...engineResult.events];
      return { ok: true, scene: finalScene, plan: publicPlan(plan), events, event: events.at(-1) || null, replayed: false, idempotent: false, before: clone(scene), after: clone(finalScene) };
    } catch (error) {
      // All writes above target the clone.  The caller's Scene is untouched on
      // a protected dependency, stale primitive, or placement failure.
      throw error;
    }
  }

  function cancelDestroy(first, second) {
    const plan = first?.type === "lionwing.destroy-plan" ? first : second;
    const scene = first?.type === "lionwing.destroy-plan" ? second || first.before : first || plan?.before;
    return { ok: false, cancelled: true, plan: publicPlan(plan), scene: clone(scene), events: [] };
  }

  function undoDestroy(first, second) {
    const result = first?.before && first?.after ? first : second;
    const scene = first?.before && first?.after ? second : first;
    if (!result?.before || !result?.after) fail("План не содержит полного снимка для отката.", "invalid-undo");
    const current = scene || result.scene;
    if (sceneFingerprint(current) !== sceneFingerprint(result.after)) fail("Откат плана устарел: текущая Сцена уже изменилась.", "stale-undo");
    return { ok: true, undone: true, scene: clone(result.before), event: { type: "destroy-plan.undo", target: clone(result.plan?.target || null) } };
  }

  function safePlan(scene, target, options = {}) {
    try { return { ok: true, plan: planDestroy(scene, target, options) }; }
    catch (error) { return { ok: false, error: { name: error.name, code: error.code || "destroy-plan-error", message: error.message, details: clone(error.details) } }; }
  }

  const api = Object.freeze({
    SCHEMA,
    TARGET_KINDS: Object.freeze([...TARGET_KINDS]),
    BACKING_TYPES: Object.freeze([...BACKING_TYPES]),
    REMOVAL_TABLE,
    REFERENCE_TABLE,
    CLEANUP_ROOTS: Object.freeze(CLEANUP_ROOTS.map(path => Object.freeze([...path]))),
    DestroyPlanError,
    normalizeTarget,
    planDestroy,
    prepareDestroy: planDestroy,
    prepare: planDestroy,
    createPlan: planDestroy,
    safePlan,
    applyDestroyPlan,
    apply: applyDestroyPlan,
    execute: applyDestroyPlan,
    cancelDestroy,
    cancel: cancelDestroy,
    undoDestroy,
    undo: undoDestroy,
    serialize: value => JSON.stringify(publicPlan(value)),
    reload: value => publicPlan(typeof value === "string" ? JSON.parse(value) : value),
  });
  global.DAWN_LIONWING_DESTROY_PLAN = api;
})(typeof window === "object" && window ? window : globalThis);
