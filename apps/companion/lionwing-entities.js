"use strict";

// Declarative LionWing entity registry.  The registry is deliberately kept
// separate from the scene reducer: it stores references to existing actors,
// markers, objects, areas and walls and emits JSON intents for the owner of
// those collections to apply.
(function installLionwingEntities(global) {
  const SCHEMA = 1;
  const MAX_ID = 180;
  const MAX_ENTITIES = 512;
  const MAX_LINKS = 2048;
  const LINK_TYPES = new Set([
    "pilot", "carrier", "anchor", "movement", "attachment", "contains", "contained",
  ]);
  const BACKING_TYPES = new Set(["actor", "marker", "object", "area", "wall"]);
  const SOURCE_TYPES = new Set(["actor", "entity", "action", "event", "scene", "detached"]);
  const VISIBILITIES = new Set(["public", "owner", "narrator", "hidden"]);
  const STATES = new Set(["active", "transformed", "disabled", "destroyed"]);
  const POLICIES = new Set(["disable", "remove", "detach"]);
  const LIFETIMES = new Set([
    "default", "turn", "ownerTurn", "action", "round", "roundEnd", "scene", "chapter", "session", "persistent", "manual", "actionOrStartTurn",
    "startTurn", "endTurn", "nextTurn", "startNextOwnerTurn", "endNextOwnerTurn",
  ]);
  const FORBIDDEN_REF_FIELDS = new Set([
    "x", "y", "space", "hp", "maxHp", "health", "wounds", "ap", "focus", "effects",
    "duration", "lifetime", "ownerActorId", "source", "rule", "links", "coordinates",
  ]);
  const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);

  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const isObject = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const ownEntries = value => isObject(value) ? Object.entries(value) : [];

  class EntityError extends Error {
    constructor(message, code = "invalid-entity", details = {}) {
      super(message);
      this.name = "LionWingEntityError";
      this.code = code;
      this.details = clone(details);
    }
  }

  const fail = (message, code, details) => { throw new EntityError(message, code, details); };

  function stringId(value, label = "ID", { allowNull = false, max = MAX_ID } = {}) {
    if (allowNull && value == null) return null;
    if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\s]/u.test(value) || RESERVED_IDS.has(value)) {
      fail(`Некорректный ${label}.`, "invalid-id", { label });
    }
    return value.trim();
  }

  function plainId(value, label = "ID") {
    return stringId(value, label);
  }

  function defineAlias(target, key, getter) {
    Object.defineProperty(target, key, { configurable: true, enumerable: false, get: getter });
  }

  function backingTypeAndId(raw) {
    if (typeof raw === "string") {
      const match = /^(actor|marker|object|area|wall):(.+)$/u.exec(raw);
      if (match) return { type: match[1], id: match[2] };
      return null;
    }
    if (!isObject(raw)) return null;
    const type = typeof raw.type === "string" ? raw.type : typeof raw.kind === "string" ? raw.kind : null;
    const id = raw.id ?? raw.entityId ?? (type && raw[`${type}Id`]);
    if (type && id != null) return { type, id };
    for (const candidate of ["actor", "marker", "object", "area", "wall"]) {
      const candidateId = raw[`${candidate}Id`];
      if (candidateId != null) return { type: candidate, id: candidateId };
    }
    return null;
  }

  function makeBacking(raw) {
    const parsed = backingTypeAndId(raw);
    if (!parsed || !BACKING_TYPES.has(parsed.type)) fail("Backing сущности должен ссылаться на actor, marker, object, area или wall.", "invalid-backing");
    const id = plainId(parsed.id, `ID backing (${parsed.type})`);
    if (isObject(raw)) {
      const typedKeys = ["actor", "marker", "object", "area", "wall"].map(type => `${type}Id`).filter(key => raw[key] != null);
      if (typedKeys.length > 1) fail("Backing должен содержать ровно одну типизированную ссылку.", "ambiguous-backing");
      if (typedKeys.length === 1 && typedKeys[0] !== `${parsed.type}Id`) fail("Тип и ссылка backing противоречат друг другу.", "ambiguous-backing");
      if (raw.type && raw[`${raw.type}Id`] != null && String(raw[`${raw.type}Id`]) !== String(raw.id ?? raw[`${raw.type}Id`])) fail("Тип и ID backing противоречат друг другу.", "ambiguous-backing");
      for (const key of Object.keys(raw)) {
        if (!["type", "kind", "id", "actorId", "markerId", "objectId", "areaId", "wallId"].includes(key)) fail("Backing должен содержать только типизированную ссылку; данные чужой подсистемы запрещены.", "backing-extra-data", { key });
        if (FORBIDDEN_REF_FIELDS.has(key)) fail("Backing хранит данные чужой подсистемы; сохраните только типизированную ссылку.", "backing-duplicates-state", { key });
      }
    }
    const key = `${parsed.type}Id`;
    const result = { [key]: id };
    defineAlias(result, "type", () => parsed.type);
    defineAlias(result, "id", () => id);
    return result;
  }

  function sourceTypeAndId(raw, scene) {
    if (typeof raw === "string") {
      const match = /^(actor|entity|action|event|scene|detached):(.+)$/u.exec(raw);
      if (match) return { type: match[1], id: match[2] };
      if ((scene?.actors || []).some(actor => actor?.id === raw)) return { type: "actor", id: raw };
      if (registryEntries(scene).some(([, entity]) => entity?.source?.actorId === raw || entity?.sourceActorId === raw)) return { type: "actor", id: raw };
      if (entityRaw(scene, raw)) return { type: "entity", id: raw };
      return { type: "entity", id: raw };
    }
    if (!isObject(raw)) return null;
    const type = typeof raw.type === "string" ? raw.type : typeof raw.kind === "string" ? raw.kind : null;
    const id = raw.id ?? raw.entityId ?? (type && raw[`${type}Id`]);
    if (type && id != null) return { type, id };
    for (const candidate of ["actor", "entity", "action", "event", "scene", "detached"]) {
      const candidateId = raw[`${candidate}Id`];
      if (candidateId != null) return { type: candidate, id: candidateId };
    }
    return null;
  }

  function makeSource(raw, scene) {
    const parsed = sourceTypeAndId(raw, scene);
    if (!parsed || !SOURCE_TYPES.has(parsed.type)) fail("Источник сущности должен иметь тип и стабильный ID.", "invalid-source");
    const id = plainId(parsed.id, `ID источника (${parsed.type})`);
    const result = { [`${parsed.type}Id`]: id };
    defineAlias(result, "type", () => parsed.type);
    defineAlias(result, "id", () => id);
    return result;
  }

  function makeRule(raw) {
    const value = typeof raw === "string" ? raw : raw?.rule ?? raw?.ruleId ?? raw?.sourceRuleId;
    return stringId(value, "ID правила");
  }

  function normalizeVisibility(raw) {
    const aliases = { all: "public", players: "public", gm: "narrator", private: "owner" };
    const value = aliases[raw] || raw;
    if (typeof value !== "string" || !VISIBILITIES.has(value)) fail("Неизвестная видимость сущности.", "invalid-visibility");
    return value;
  }

  function normalizeLifetime(raw) {
    if (typeof raw === "string") {
      if (!LIFETIMES.has(raw)) fail("Неизвестный срок жизни сущности.", "invalid-lifetime");
      return { boundary: raw };
    }
    if (!isObject(raw)) fail("Срок жизни сущности обязателен и должен быть JSON-объектом.", "invalid-lifetime");
    const aliases = {
      kind: raw.boundary || raw.kind,
      duration: raw.boundary || raw.duration,
      resetAt: raw.boundary || raw.resetAt,
    };
    const boundary = aliases.kind || aliases.duration || aliases.resetAt;
    if (typeof boundary !== "string" || !LIFETIMES.has(boundary)) fail("Неизвестная граница срока жизни сущности.", "invalid-lifetime");
    const result = { boundary };
    for (const key of ["ownerActorId", "ownerTurnSerial", "ownerTurnInstanceId", "sceneSerial", "round", "chapter", "actionId"]) {
      if (!own(raw, key)) continue;
      if (key.endsWith("Id") || key === "ownerTurnInstanceId" || key === "actionId") result[key] = stringId(raw[key], `поле срока ${key}`);
      else if (!Number.isSafeInteger(Number(raw[key])) || Number(raw[key]) < 0) fail(`Некорректное поле срока ${key}.`, "invalid-lifetime", { key });
      else result[key] = Number(raw[key]);
    }
    return result;
  }

  function normalizeState(raw, fallback = "active") {
    const value = typeof raw === "string" ? raw : raw?.state;
    const state = value || fallback;
    if (!STATES.has(state)) fail("Неизвестное состояние жизненного цикла сущности.", "invalid-lifecycle");
    return state;
  }

  function ownerFrom(raw) {
    const value = raw?.ownerActorId ?? (typeof raw?.owner === "string" ? raw.owner : raw?.owner?.actorId);
    return stringId(value, "ID владельца-актора");
  }

  function linkType(raw) {
    const type = raw?.type ?? raw?.kind;
    if (typeof type !== "string" || !LINK_TYPES.has(type)) fail("Неизвестный тип связи сущностей.", "invalid-link-type");
    return type;
  }

  function linkEndpoints(raw) {
    const from = raw?.from ?? raw?.source ?? raw?.fromEntityId ?? raw?.sourceEntityId ?? raw?.sourceId;
    const to = raw?.to ?? raw?.target ?? raw?.toEntityId ?? raw?.targetEntityId ?? raw?.targetId;
    return { from: plainId(from, "исходная сущность связи"), to: plainId(to, "целевая сущность связи") };
  }

  function makeLink(raw, defaults = {}) {
    if (!isObject(raw)) fail("Связь сущностей должна быть JSON-объектом.", "invalid-link");
    const type = linkType(raw);
    const endpoints = linkEndpoints(raw);
    if (endpoints.from === endpoints.to) fail("Связь сущности с самой собой запрещена.", "link-cycle");
    const id = plainId(raw.id ?? defaults.id ?? `link:${type}:${endpoints.from}:${endpoints.to}`, "ID связи");
    const policyRaw = raw.sourceLossPolicy ?? raw.onSourceLoss ?? defaults.sourceLossPolicy ?? "detach";
    if (typeof policyRaw !== "string" || !POLICIES.has(policyRaw)) fail("Неизвестная политика потери источника связи.", "invalid-source-policy");
    const result = { schema: SCHEMA, id, type, from: endpoints.from, to: endpoints.to, sourceLossPolicy: policyRaw };
    if (raw.lifetime != null || defaults.lifetime != null) result.lifetime = normalizeLifetime(raw.lifetime ?? defaults.lifetime);
    defineAlias(result, "fromEntityId", () => result.from);
    defineAlias(result, "toEntityId", () => result.to);
    defineAlias(result, "sourceId", () => result.from);
    defineAlias(result, "targetId", () => result.to);
    defineAlias(result, "direction", () => "from-to");
    return result;
  }

  function attachEntityAliases(entity) {
    defineAlias(entity, "owner", () => entity.ownerActorId);
    if (!own(entity, "state")) defineAlias(entity, "state", () => entity.lifecycle);
    defineAlias(entity, "ruleId", () => entity.rule);
    defineAlias(entity, "sourceRuleId", () => entity.rule);
    defineAlias(entity, "sourceActorId", () => entity.source?.actorId || null);
    defineAlias(entity, "sourceEntityId", () => entity.source?.entityId || null);
    if (!own(entity, "sourceActionId")) defineAlias(entity, "sourceActionId", () => entity.source?.actionId || null);
    if (!own(entity, "sourceEventId")) defineAlias(entity, "sourceEventId", () => entity.source?.eventId || null);
    defineAlias(entity, "sourceId", () => entity.source?.id || null);
    defineAlias(entity, "backingType", () => entity.backing?.type || null);
    defineAlias(entity, "backingId", () => entity.backing?.id || null);
    return entity;
  }

  const cloneEntityRecord = entity => entity ? attachEntityAliases(clone(entity)) : entity;
  const cloneLinkRecord = link => link ? makeLink(clone(link)) : link;

  function entityRaw(scene, id) {
    const records = scene?.lionwing?.entities;
    if (Array.isArray(records)) return records.find(item => item?.id === id) || null;
    return isObject(records) && own(records, id) ? records[id] : null;
  }

  function registryEntries(scene) {
    const records = scene?.lionwing?.entities;
    if (Array.isArray(records)) return records.map(item => [item?.id, item]).filter(item => typeof item[0] === "string");
    return ownEntries(records).filter(([id]) => RESERVED_IDS.has(id) === false);
  }

  function registryMap(scene) {
    const map = Object.create(null);
    for (const [id, raw] of registryEntries(scene)) {
      if (typeof id !== "string" || !isObject(raw)) continue;
      try { map[id] = normalizeEntity(raw, scene, { allowMissingReferences: true }); } catch { /* graph validation reports this row */ }
    }
    return map;
  }

  function normalizeEntity(raw, scene, options = {}) {
    if (!isObject(raw)) fail("Сущность должна быть JSON-объектом.", "invalid-entity");
    const id = plainId(raw.id, "ID сущности");
    const kind = stringId(raw.kind, "тип сущности", { max: 80 });
    const ownerActorId = ownerFrom(raw);
    const sourceRaw = raw.source ?? raw.sourceRef ?? (raw.sourceActorId != null ? { actorId: raw.sourceActorId } : raw.sourceEntityId != null ? { entityId: raw.sourceEntityId } : raw.sourceActionId != null ? { actionId: raw.sourceActionId } : raw.sourceEventId != null ? { eventId: raw.sourceEventId } : null);
    const source = makeSource(sourceRaw, scene);
    const rule = makeRule(raw);
    const backing = makeBacking(raw.backing);
    const lifetime = normalizeLifetime(raw.lifetime ?? raw.duration);
    const visibility = normalizeVisibility(raw.visibility);
    const policyRaw = raw.sourceLossPolicy ?? raw.onSourceLoss ?? "disable";
    if (typeof policyRaw !== "string" || !POLICIES.has(policyRaw)) fail("Неизвестная политика потери источника сущности.", "invalid-source-policy");
    const lifecycle = normalizeState(raw.lifecycle ?? raw.state, "active");
    const result = {
      schema: SCHEMA,
      id,
      kind,
      ownerActorId,
      source,
      rule,
      backing,
      lifetime,
      visibility,
      sourceLossPolicy: policyRaw,
      lifecycle,
      state: lifecycle,
      links: [],
    };
    if (raw.createdEventId != null) result.createdEventId = stringId(raw.createdEventId, "событие создания сущности");
    if (raw.sourceActionId != null && !source.actionId) result.sourceActionId = stringId(raw.sourceActionId, "исходное действие сущности");
    if (raw.sourceEventId != null && !source.eventId) result.sourceEventId = stringId(raw.sourceEventId, "исходное событие сущности");
    attachEntityAliases(result);
    const rawLinks = Array.isArray(raw.links) ? raw.links : [];
    if (rawLinks.length > MAX_LINKS) fail("Слишком много связей у сущности.", "link-limit");
    result.links = rawLinks.map(item => makeLink(item, { sourceLossPolicy: "detach" }));
    if (!options.allowMissingReferences) assertEntityReferences(scene, result);
    return result;
  }

  function collectionFor(scene, type) {
    if (type === "actor") return scene?.actors || [];
    if (type === "marker") return scene?.markers || [];
    if (type === "object") return scene?.objects || [];
    if (type === "area") return [...(scene?.areas || []), ...(scene?.objects || []).filter(item => item?.type === "area")];
    if (type === "wall") return scene?.walls || [];
    return [];
  }

  function backingItem(scene, backing) {
    const ref = backingTypeAndId(backing);
    if (!ref || !BACKING_TYPES.has(ref.type)) return null;
    return collectionFor(scene, ref.type).find(item => item?.id === ref.id) || null;
  }

  function hasBacking(scene, backing) { return Boolean(backingItem(scene, backing)); }

  function actorById(scene, id) { return (scene?.actors || []).find(actor => actor?.id === id) || null; }

  function sourceStatus(scene, source, resolving = new Set()) {
    const ref = sourceTypeAndId(source, scene);
    if (!ref || !SOURCE_TYPES.has(ref.type)) return { present: false, active: false, reason: "Источник не распознан.", source: null };
    const id = ref.id;
    if (ref.type === "detached") return { present: false, active: false, reason: "Источник отсоединён.", source: makeSource(ref, scene) };
    if (ref.type === "actor") {
      const actor = actorById(scene, id);
      if (!actor) return { present: false, active: false, reason: "Источник-актор отсутствует на Сцене.", source: makeSource(ref, scene) };
      if (actor.knockedOut) return { present: true, active: false, reason: "Источник-актор выведен из боя.", actor: clone(actor), source: makeSource(ref, scene) };
      return { present: true, active: true, reason: "", actor: clone(actor), source: makeSource(ref, scene) };
    }
    if (ref.type === "entity") {
      if (resolving.has(id)) return { present: false, active: false, reason: "Цепочка источников содержит цикл.", source: makeSource(ref, scene) };
      const entity = resolveEntityRecord(scene, id);
      if (!entity) return { present: false, active: false, reason: "Источник-сущность отсутствует.", source: makeSource(ref, scene) };
      const status = entityStatus(scene, id, new Set([...resolving, id]));
      if (entity.lifecycle === "destroyed") return { present: true, active: false, reason: "Источник-сущность уничтожен.", entity: clone(entity), source: makeSource(ref, scene) };
      return { present: true, active: Boolean(status.active), reason: status.active ? "" : status.reason, entity: clone(entity), source: makeSource(ref, scene) };
    }
    if (ref.type === "scene") return { present: true, active: true, reason: "", source: makeSource(ref, scene) };
    return { present: true, active: true, reason: "", source: makeSource(ref, scene) };
  }

  function assertEntityReferences(scene, entity, options = {}) {
    if (!actorById(scene, entity.ownerActorId)) {
      if (options.allowMissingOwner) return;
      fail("Владелец сущности отсутствует на Сцене.", "missing-owner", { ownerActorId: entity.ownerActorId });
    }
    if (!hasBacking(scene, entity.backing)) {
      if (options.allowMissingBacking || entity.lifecycle === "destroyed") return;
      fail("Backing сущности отсутствует на Сцене.", "dangling-backing", { entityId: entity.id, backing: clone(entity.backing) });
    }
    const source = sourceStatus(scene, entity.source);
    if (!source.present && !options.allowMissingSource) fail("Источник сущности отсутствует на Сцене.", "missing-source", { entityId: entity.id });
  }

  function resolveEntityRecord(scene, ref) {
    const id = typeof ref === "string" ? ref : ref?.id ?? ref?.entityId;
    if (typeof id !== "string") return null;
    const raw = entityRaw(scene, id);
    if (!raw) return null;
    try { return normalizeEntity(raw, scene, { allowMissingReferences: true }); } catch { return null; }
  }

  function backingStatus(scene, backing) {
    const ref = backingTypeAndId(backing);
    const item = backingItem(scene, backing);
    if (!ref) return { present: false, active: false, reason: "Backing не распознан.", backing: null, item: null };
    const hidden = Boolean(item?.hidden || item?.visibility === "hidden" || item?.kind === "hidden" || item?.type === "hidden" || item?.metadata?.hidden);
    return {
      present: Boolean(item),
      active: Boolean(item),
      hidden,
      reason: item ? "" : "Backing отсутствует на Сцене.",
      backing: makeBacking(ref),
      item: item ? clone(item) : null,
    };
  }

  function entityStatus(scene, ref, resolving = new Set()) {
    const entity = resolveEntityRecord(scene, ref);
    if (!entity) return { available: false, active: false, exists: false, entity: null, reason: "Сущность отсутствует на Сцене.", owner: null, source: null, backing: null, links: [] };
    const owner = actorById(scene, entity.ownerActorId);
    const source = sourceStatus(scene, entity.source, new Set([...resolving, entity.id]));
    const backing = backingStatus(scene, entity.backing);
    let reason = "";
    if (entity.lifecycle === "destroyed") reason = "Сущность уничтожена.";
    else if (entity.lifecycle === "disabled") reason = "Сущность отключена политикой потери источника.";
    else if (!owner) reason = "Владелец сущности отсутствует на Сцене.";
    else if (owner.knockedOut) reason = "Владелец сущности выведен из боя.";
    else if (!source.active && !entity.source?.detachedId) reason = source.reason;
    else if (!backing.present) reason = backing.reason;
    const links = linksFor(scene, entity.id);
    const response = {
      available: true,
      active: !reason,
      exists: true,
      entity,
      reason,
      owner: owner ? { id: owner.id, knockedOut: Boolean(owner.knockedOut) } : { id: entity.ownerActorId, missing: true },
      source: { ...source, source: source.source ? clone(source.source) : null },
      backing: { ...backing, backing: backing.backing ? clone(backing.backing) : null },
      links: clone(links),
    };
    defineAlias(response, "id", () => entity.id);
    defineAlias(response, "kind", () => entity.kind);
    defineAlias(response, "ownerActorId", () => entity.ownerActorId);
    defineAlias(response, "record", () => response.entity);
    defineAlias(response, "backingRef", () => response.entity.backing);
    defineAlias(response, "sourceRef", () => response.entity.source);
    defineAlias(response, "resolvedBacking", () => response.backing?.item ? clone(response.backing.item) : null);
    if (response.backing) {
      defineAlias(response.backing, "type", () => response.backing.backing?.type || null);
      defineAlias(response.backing, "id", () => response.backing.backing?.id || null);
      for (const type of BACKING_TYPES) defineAlias(response.backing, `${type}Id`, () => response.backing.backing?.[`${type}Id`] || null);
    }
    return response;
  }

  function linksFor(scene, entityId) {
    const result = [];
    for (const [, entity] of registryEntries(scene)) {
      if (!isObject(entity) || !Array.isArray(entity.links)) continue;
      for (const raw of entity.links) {
        try {
          const link = makeLink(raw);
          if (link.from === entityId || link.to === entityId) result.push(link);
        } catch { /* graph validation reports malformed links */ }
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  function allLinks(map) {
    const result = [];
    for (const entity of Object.values(map)) for (const raw of entity.links || []) {
      try { result.push(makeLink(raw)); } catch { /* validateGraph reports malformed links */ }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  function cyclePath(map, extraLink = null) {
    const links = allLinks(map).concat(extraLink ? [extraLink] : []);
    const adjacency = Object.create(null);
    for (const link of links) (adjacency[link.from] ||= []).push(link.to);
    const visiting = new Set(), visited = new Set(), stack = [];
    const walk = id => {
      if (visiting.has(id)) return [...stack.slice(stack.indexOf(id)), id];
      if (visited.has(id)) return null;
      visiting.add(id); stack.push(id);
      for (const next of adjacency[id] || []) { const found = walk(next); if (found) return found; }
      stack.pop(); visiting.delete(id); visited.add(id); return null;
    };
    for (const id of Object.keys(map)) { const found = walk(id); if (found) return found; }
    return null;
  }

  function resolveLinkCycle(map, link) { return cyclePath(map, link); }

  function graphStatus(scene) {
    const rawEntries = registryEntries(scene), map = Object.create(null), errors = [], warnings = [], dangling = [], links = [];
    if (rawEntries.length > MAX_ENTITIES) errors.push({ code: "entity-limit", message: "Слишком много сущностей." });
    for (const [key, raw] of rawEntries) {
      if (own(map, key)) { errors.push({ code: "duplicate-entity", entityId: key, message: "Повторяющийся ID сущности." }); continue; }
      try {
        const entity = normalizeEntity(raw, scene, { allowMissingReferences: true });
        if (entity.id !== key) errors.push({ code: "entity-key-mismatch", entityId: key, message: "Ключ индекса не совпадает с ID сущности." });
        map[entity.id] = entity;
        if (!actorById(scene, entity.ownerActorId)) warnings.push({ code: "missing-owner", entityId: entity.id, ownerActorId: entity.ownerActorId, message: "Владелец сущности временно отсутствует." });
        if (!hasBacking(scene, entity.backing) && entity.lifecycle !== "destroyed") { const item = { code: "dangling-backing", entityId: entity.id, message: "Backing сущности отсутствует." }; errors.push(item); dangling.push(item); }
        if (!sourceStatus(scene, entity.source).present) warnings.push({ code: "missing-source", entityId: entity.id, message: "Источник сущности отсутствует; политика потери источника остаётся применима." });
      } catch (error) { errors.push({ code: error.code || "invalid-entity", entityId: key, message: error.message }); }
    }
    const linkIds = new Set();
    for (const entity of Object.values(map)) for (const raw of entity.links || []) {
      try {
        const link = makeLink(raw);
        if (linkIds.has(link.id)) errors.push({ code: "duplicate-link", linkId: link.id, message: "Повторяющийся ID связи." });
        linkIds.add(link.id); links.push(link);
        if (link.from !== entity.id) errors.push({ code: "link-owner-mismatch", linkId: link.id, entityId: entity.id, message: "Связь должна храниться у своей исходной сущности." });
        if (!own(map, link.from) || !own(map, link.to)) {
          const item = { code: "dangling-link", linkId: link.id, from: link.from, to: link.to, message: "Связь ссылается на отсутствующую сущность." };
          errors.push(item); dangling.push(item);
        }
      } catch (error) { errors.push({ code: error.code || "invalid-link", entityId: entity.id, message: error.message }); }
    }
    const cycle = cyclePath(map);
    if (cycle) errors.push({ code: "link-cycle", path: cycle, message: "Граф связей содержит цикл." });
    links.sort((a, b) => a.id.localeCompare(b.id));
    const entities = Object.values(map).sort((a, b) => a.id.localeCompare(b.id));
    const projectedEntities = entities.map(cloneEntityRecord);
    const projectedLinks = links.map(cloneLinkRecord);
    const byId = Object.fromEntries(projectedEntities.map(entity => [entity.id, entity]));
    return { schema: SCHEMA, valid: errors.length === 0, ok: errors.length === 0, errors, warnings, dangling, cycles: cycle ? [cycle] : [], entities: projectedEntities, links: projectedLinks, byId };
  }

  function validateEntity(scene, raw, options = {}) {
    try {
      const entity = normalizeEntity(raw, scene, { allowMissingReferences: options.allowMissingReferences !== false });
      const errors = [];
      const warnings = [];
      if (!actorById(scene, entity.ownerActorId)) warnings.push({ code: "missing-owner", message: "Владелец сущности отсутствует." });
      if (!hasBacking(scene, entity.backing)) warnings.push({ code: "dangling-backing", message: "Backing сущности отсутствует." });
      if (!sourceStatus(scene, entity.source).present) warnings.push({ code: "missing-source", message: "Источник сущности отсутствует." });
      return { schema: SCHEMA, valid: errors.length === 0, ok: errors.length === 0, errors, warnings, entity };
    } catch (error) { return { schema: SCHEMA, valid: false, ok: false, errors: [{ code: error.code || "invalid-entity", message: error.message }], warnings: [], entity: null }; }
  }

  function validateLink(scene, raw, options = {}) {
    try {
      const link = makeLink(raw);
      const map = registryMap(scene);
      if (!own(map, link.from) || !own(map, link.to)) return { valid: false, ok: false, errors: [{ code: "dangling-link", message: "Связь ссылается на отсутствующую сущность." }], link };
      const duplicate = allLinks(map).find(item => item.id === link.id);
      if (duplicate) return { valid: false, ok: false, errors: [{ code: "duplicate-link", message: "Связь с таким ID уже существует." }], link };
      const cycle = resolveLinkCycle(map, link);
      if (cycle) return { valid: false, ok: false, errors: [{ code: "link-cycle", path: cycle, message: "Связь создаёт цикл." }], link };
      return { valid: true, ok: true, errors: [], link };
    } catch (error) { return { valid: false, ok: false, errors: [{ code: error.code || "invalid-link", message: error.message }], link: null }; }
  }

  function authority(scene, requester, ownerIds, options = {}) {
    const role = options.role || options.viewerRole;
    if (["narrator", "gm", "owner-authority"].includes(role)) return true;
    if (role === "player" && requester == null && ownerIds.filter(Boolean).length) return false;
    if (requester == null) return true;
    const requested = String(requester);
    const ids = [...new Set(ownerIds.filter(Boolean))];
    if (!ids.length) return true;
    return ids.every(ownerId => {
      if (ownerId === requested) return true;
      const owner = actorById(scene, ownerId);
      return owner?.ownerId === requested;
    });
  }

  function assertAuthority(scene, requester, ownerIds, options = {}) {
    if (!authority(scene, requester, ownerIds, options)) fail("Операция сущности доступна только владельцу или Нарратору.", "forged-ownership", { requester, ownerIds });
  }

  function assertBackingPermission(scene, backing, ownerActorId, options = {}) {
    const requester = requesterOf(options), role = options.role || options.viewerRole;
    if (requester == null || ["narrator", "gm", "owner-authority"].includes(role)) return;
    const item = backingItem(scene, backing);
    const itemOwner = item?.ownerActorId || item?.ownerId;
    if (itemOwner && itemOwner !== ownerActorId && itemOwner !== requester) fail("Нельзя привязать к сущности backing другого владельца.", "forged-backing", { backing: clone(backing), ownerActorId, backingOwnerId: itemOwner });
  }

  function requesterOf(options = {}) { return options.actorId ?? options.requesterActorId ?? options.requesterId ?? options.userId ?? null; }

  function assertVersion(scene, options = {}) {
    const expected = options.expectedVersion ?? options.expectedSceneVersion;
    if (expected != null && Number(expected) !== Number(scene?.version || 0)) fail("Сцена изменилась: переход сущности устарел.", "stale-version", { expected, actual: Number(scene?.version || 0) });
  }

  function entityProjection(scene, entity, viewer = {}, visibleSet = null) {
    const role = viewer.role || viewer.viewerRole || "player";
    const actorIds = new Set([...(Array.isArray(viewer.actorIds) ? viewer.actorIds : []), viewer.actorId].filter(Boolean));
    const narrator = ["narrator", "gm"].includes(role);
    const ownerVisible = actorIds.has(entity.ownerActorId) || actorById(scene, entity.ownerActorId)?.ownerId && viewer.userId === actorById(scene, entity.ownerActorId)?.ownerId;
    const visible = narrator || entity.visibility === "public" || entity.visibility === "owner" && ownerVisible;
    if (!visible) return null;
    const result = clone(entity);
    const backing = backingStatus(scene, entity.backing);
    const source = sourceStatus(scene, entity.source);
    if (!narrator && backing.hidden) { result.backing = null; result.backingHidden = true; }
    if (!narrator && result.source?.detachedId) { result.source = null; result.sourceHidden = true; }
    if (!narrator && source.source?.entityId && visibleSet && !visibleSet.has(source.source.entityId)) { result.source = null; result.sourceHidden = true; }
    if (!narrator && source.source?.actorId && actorById(scene, source.source.actorId)?.hidden) { result.source = null; result.sourceHidden = true; }
    if (!narrator && result.source === null) {
      delete result.sourceActionId; delete result.sourceEventId; delete result.createdEventId;
    }
    if (!narrator && actorById(scene, entity.ownerActorId)?.hidden) { result.ownerActorId = null; result.ownerHidden = true; }
    result.links = (entity.links || []).filter(raw => {
      try { const link = makeLink(raw); return narrator || visibleSet?.has(link.to); } catch { return false; }
    }).map(cloneLinkRecord);
    return attachEntityAliases(result);
  }

  function project(scene, viewer = {}) {
    const graph = graphStatus(scene);
    const role = viewer.role || viewer.viewerRole || "player";
    const visibleSet = new Set(graph.entities.filter(entity => {
      const owner = actorById(scene, entity.ownerActorId);
      const actors = new Set([...(Array.isArray(viewer.actorIds) ? viewer.actorIds : []), viewer.actorId].filter(Boolean));
      return ["narrator", "gm"].includes(role) || entity.visibility === "public" || entity.visibility === "owner" && (actors.has(entity.ownerActorId) || owner?.ownerId && owner.ownerId === viewer.userId);
    }).map(entity => entity.id));
    const entities = graph.entities.map(entity => entityProjection(scene, entity, viewer, visibleSet)).filter(Boolean);
    const links = entities.flatMap(entity => entity.links || []).sort((a, b) => a.id.localeCompare(b.id));
    return { schema: SCHEMA, role, actorId: viewer.actorId || null, entities, list: entities, entityIndex: Object.fromEntries(entities.map(entity => [entity.id, entity])), links };
  }

  function projectScene(scene, viewer = {}) {
    const result = clone(scene || {});
    result.lionwing = isObject(result.lionwing) ? result.lionwing : {};
    const projection = project(scene, viewer);
    const role = viewer.role || viewer.viewerRole || "player";
    if (!["narrator", "gm"].includes(role)) {
      const hiddenEntityIds = new Set(graphStatus(scene).entities.filter(entity => !projection.entityIndex[entity.id]).map(entity => entity.id));
      const hiddenActorIds = new Set((scene?.actors || []).filter(item => item?.hidden).map(item => item.id));
      const hiddenMarkerIds = new Set((scene?.markers || []).filter(item => item?.hidden || item?.kind === "hidden").map(item => item.id));
      const hiddenObjectIds = new Set((scene?.objects || []).filter(item => item?.hidden || item?.visibility === "hidden" || item?.metadata?.hidden || item?.type === "hidden" || item?.kind === "hidden").map(item => item.id));
      result.actors = (result.actors || []).filter(item => !hiddenActorIds.has(item.id));
      result.markers = (result.markers || []).filter(item => !hiddenMarkerIds.has(item.id));
      result.objects = (result.objects || []).filter(item => !hiddenObjectIds.has(item.id));
      if (hiddenActorIds.has(result.activeActorId)) result.activeActorId = null;
      if (hiddenActorIds.has(result.selectedActor)) result.selectedActor = null;
      if (Array.isArray(result.targetIds)) result.targetIds = result.targetIds.filter(id => !hiddenActorIds.has(id));
      if (Array.isArray(result.spaces)) for (const space of result.spaces) if (hiddenActorIds.has(space.ownerActorId)) delete space.ownerActorId;
      if (Array.isArray(result.areas)) result.areas = result.areas.filter(item => !item?.hidden && item?.visibility !== "hidden" && !item?.metadata?.hidden);
      if (Array.isArray(result.walls)) result.walls = result.walls.filter(item => !item?.hidden && item?.visibility !== "hidden" && !item?.metadata?.hidden);
      const hiddenBackingIds = new Set([...hiddenActorIds, ...hiddenMarkerIds, ...hiddenObjectIds]);
      if (Array.isArray(result.log)) result.log = result.log.filter(row => !valueReferencesEntity(row, hiddenEntityIds) && !valueReferencesBacking(row, hiddenBackingIds));
      for (const key of ["auras", "subscriptions", "choices", "deferred", "pausedChains", "selections"]) {
        if (Array.isArray(result.lionwing[key])) result.lionwing[key] = result.lionwing[key].filter(row => !valueReferencesEntity(row, hiddenEntityIds) && !valueReferencesBacking(row, hiddenBackingIds));
      }
    }
    result.lionwing.entities = Object.fromEntries(projection.entities.map(entity => [entity.id, entity]));
    if (![
      "narrator", "gm",
    ].includes(viewer.role || viewer.viewerRole)) delete result.lionwing.entityReceipts;
    return result;
  }

  function valueReferencesEntity(value, ids, key = "") {
    if (typeof value === "string") return /(?:entity|source|target|carrier|pilot|anchor|movement|attachment|subscription|choice|owner).*?(?:id)?$/iu.test(key) && ids.has(value);
    if (Array.isArray(value)) return value.some(item => valueReferencesEntity(item, ids, key));
    if (!isObject(value)) return false;
    return Object.entries(value).some(([childKey, child]) => valueReferencesEntity(child, ids, childKey));
  }

  function valueReferencesBacking(value, ids, key = "") {
    if (typeof value === "string") return /(?:actor|marker|object|area|wall)Id$/iu.test(key) && ids.has(value);
    if (Array.isArray(value)) return value.some(item => valueReferencesBacking(item, ids, key));
    if (!isObject(value)) return false;
    return Object.entries(value).some(([childKey, child]) => valueReferencesBacking(child, ids, childKey));
  }

  function cleanupPlan(scene, entityIds, options = {}) {
    const ids = new Set((Array.isArray(entityIds) ? entityIds : [entityIds]).filter(value => typeof value === "string"));
    const cleanups = [], collections = [
      ["aura", scene?.lionwing?.auras], ["subscription", scene?.lionwing?.subscriptions], ["subscription", scene?.subscriptions],
      ["choice", scene?.lionwing?.choices], ["choice", scene?.choices], ["deferred", scene?.lionwing?.deferred],
      ["paused-chain", scene?.lionwing?.pausedChains], ["selection", scene?.lionwing?.selections], ["selection", scene?.selections],
    ];
    for (const [kind, rows] of collections) for (const row of Array.isArray(rows) ? rows : []) {
      if (!isObject(row) || !valueReferencesEntity(row, ids)) continue;
      const policy = POLICIES.has(row.sourceLossPolicy) ? row.sourceLossPolicy : options.policy || "disable";
      const lifetime = typeof row.lifetime === "string" ? row.lifetime : row.lifetime?.boundary || row.duration || "default";
      const id = typeof row.id === "string" ? row.id : `${kind}:${cleanups.length}`;
      cleanups.push({ kind, id, policy, lifetime, action: policy === "remove" ? "remove" : policy === "detach" ? "detach" : "disable", sourceEntityIds: [...ids] });
    }
    cleanups.sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
    return { schema: SCHEMA, entityIds: [...ids].sort(), cleanups, preservesIndependentConsequences: true, mutatesForeignCollections: false };
  }

  function sourceMatches(entity, source, scene) {
    const a = sourceTypeAndId(source, scene);
    const b = sourceTypeAndId(entity.source, scene);
    return Boolean(a && b && a.type === b.type && a.id === b.id);
  }

  function sourceLossPlan(scene, source, options = {}) {
    const sourceRef = makeSource(source, scene);
    const map = registryMap(scene), actions = [];
    for (const entity of Object.values(map)) if (sourceMatches(entity, sourceRef, scene)) actions.push({ entityId: entity.id, policy: entity.sourceLossPolicy, action: entity.sourceLossPolicy === "remove" ? "remove" : entity.sourceLossPolicy === "detach" ? "detach" : "disable", backing: clone(entity.backing), lifetime: clone(entity.lifetime) });
    actions.sort((a, b) => a.entityId.localeCompare(b.entityId));
    const removedIds = actions.filter(item => item.action === "remove").map(item => item.entityId);
    const affectedIds = actions.map(item => item.entityId);
    const links = allLinks(map).filter(link => removedIds.includes(link.from) || removedIds.includes(link.to)).map(link => ({ id: link.id, action: "detach", from: link.from, to: link.to }));
    return { schema: SCHEMA, source: clone(sourceRef), actions, links, cleanup: cleanupPlan(scene, affectedIds, { policy: options.policy }), entityIds: affectedIds };
  }

  function withRegistry(scene, map, receipts = null) {
    const next = clone(scene || {});
    next.lionwing = isObject(next.lionwing) ? next.lionwing : {};
    next.lionwing.entities = Object.fromEntries(Object.entries(map).sort(([left], [right]) => left.localeCompare(right)).map(([id, entity]) => [id, attachEntityAliases(normalizeEntity(entity, next, { allowMissingReferences: true }))]));
    if (receipts !== null) next.lionwing.entityReceipts = clone(receipts);
    return next;
  }

  function receiptsOf(scene) { return isObject(scene?.lionwing?.entityReceipts) ? clone(scene.lionwing.entityReceipts) : {}; }

  function eventId(operation, id, options = {}) {
    return plainId(options.eventId || options.idempotencyKey || `entity:${operation}:${id || "scene"}`, "ID события сущности");
  }

  function registrySnapshot(map) { return clone(Object.fromEntries(Object.entries(map).sort(([left], [right]) => left.localeCompare(right)))); }
  const eventFingerprint = (operation, payload) => JSON.stringify([operation, payload]);

  function finish(scene, before, after, operation, payload, options = {}, extra = {}) {
    const id = eventId(operation, payload?.id || payload?.entityId || payload?.sourceEntityId, options);
    const receipts = receiptsOf(scene);
    const fingerprint=eventFingerprint(operation,payload);
    if (receipts[id]) {
      const saved=receipts[id],savedEvent=saved.event||saved,savedFingerprint=saved.fingerprint||eventFingerprint(savedEvent.operation,savedEvent.payload);
      if(savedFingerprint!==fingerprint)fail("Повтор события сущности с тем же ID содержит другие данные.","entity-event-conflict",{eventId:id});
      return { ok: true, scene: clone(scene), event: clone(savedEvent), replayed: true, idempotent: true, ...extra };
    }
    const event = {
      schema: SCHEMA,
      id,
      type: `entity.${operation}`,
      operation,
      payload: clone(payload),
      before: registrySnapshot(before),
      after: registrySnapshot(after),
      backingEvent: clone(extra.backingEvent || null),
      backingEvents: clone(extra.backingEvents || (extra.backingEvent ? [extra.backingEvent] : [])),
      cleanup: clone(extra.cleanup || null),
    };
    const nextReceipts = { ...receipts, [id]: { fingerprint, event: clone(event) } };
    const next = withRegistry(scene, after, nextReceipts);
    return { ok: true, scene: next, event, replayed: false, ...extra };
  }

  function alreadySame(map, id, entity) { return own(map, id) && sameJson(registrySnapshot({ [id]: map[id] }), registrySnapshot({ [id]: entity })); }

  function create(scene, raw, options = {}) {
    assertVersion(scene, options);
    const map = registryMap(scene), existingRaw = raw?.id == null ? null : map[raw.id];
    if (existingRaw) {
      assertAuthority(scene, requesterOf(options), [existingRaw.ownerActorId], options);
      let candidate = null;
      try { candidate = normalizeEntity(raw, scene, { allowMissingReferences: true }); } catch { /* strict validation below handles a conflicting duplicate */ }
      if (candidate && alreadySame(map, candidate.id, candidate)) return { ok: true, scene: clone(scene), entity: clone(existingRaw), replayed: true, idempotent: true, event: null };
    }
    const entity = normalizeEntity(raw, scene, { allowMissingReferences: false });
    assertAuthority(scene, requesterOf(options), [entity.ownerActorId], options);
    assertBackingPermission(scene, entity.backing, entity.ownerActorId, options);
    if (own(map, entity.id)) {
      if (alreadySame(map, entity.id, entity)) return { ok: true, scene: clone(scene), entity: clone(map[entity.id]), replayed: true, idempotent: true, event: null };
      fail("Сущность с таким ID уже существует.", "duplicate-entity", { entityId: entity.id });
    }
    if (Object.keys(map).length >= MAX_ENTITIES) fail("Достигнут лимит сущностей Сцены.", "entity-limit");
    for (const link of entity.links) {
      if (!own(map, link.from) || !own(map, link.to)) fail("Начальные связи сущности не должны быть висячими.", "dangling-link");
      if (resolveLinkCycle(map, link)) fail("Начальная связь создаёт цикл.", "link-cycle");
    }
    const nextMap = { ...map, [entity.id]: entity };
    const result = finish(scene, map, nextMap, "create", { id: entity.id, entity }, options, { entity: clone(entity), backingEvent: { operation: "bind", backing: clone(entity.backing), entityId: entity.id } });
    return result;
  }

  function transform(scene, ref, rawBacking, options = {}) {
    assertVersion(scene, options);
    const map = registryMap(scene), id = typeof ref === "string" ? ref : ref?.id ?? ref?.entityId;
    const old = map[id];
    if (!old) fail("Сущность для превращения не найдена.", "missing-entity");
    assertAuthority(scene, requesterOf(options), [old.ownerActorId], options);
    const backing = makeBacking(rawBacking?.backing ?? rawBacking);
    if (!hasBacking(scene, backing)) fail("Новое превращение должно ссылаться на существующий backing.", "dangling-backing");
    assertBackingPermission(scene, backing, old.ownerActorId, options);
    if (sameJson(backing, old.backing)) fail("Превращение должно сменить backing.", "same-backing");
    const next = attachEntityAliases({ ...clone(old), backing, lifecycle: "transformed", state: "transformed", links: (old.links || []).map(makeLink) });
    const nextMap = { ...map, [old.id]: next };
    return finish(scene, map, nextMap, "transform", { id: old.id, from: old.backing, to: backing }, options, { entity: clone(next), backingEvent: { operation: "rebind", entityId: old.id, from: clone(old.backing), to: clone(backing) } });
  }

  function destroy(scene, ref, options = {}) {
    assertVersion(scene, options);
    const map = registryMap(scene), id = typeof ref === "string" ? ref : ref?.id ?? ref?.entityId, old = map[id];
    if (!old) return { ok: true, scene: clone(scene), replayed: true, idempotent: true, event: null };
    assertAuthority(scene, requesterOf(options), [old.ownerActorId], options);
    const dependentPlan = options.propagateSourceLoss === false ? { actions: [], entityIds: [], cleanup: null } : sourceLossPlan(scene, { entityId: old.id }, options);
    const removed = options.purge === true || options.removeRecord === true;
    const next = removed ? Object.fromEntries(Object.entries(map).filter(([key]) => key !== old.id)) : { ...map, [old.id]: attachEntityAliases({ ...clone(old), lifecycle: "destroyed", state: "destroyed", links: [] }) };
    for (const action of dependentPlan.actions || []) {
      if (action.entityId === old.id || !next[action.entityId]) continue;
      if (action.action === "remove") delete next[action.entityId];
      else if (action.action === "detach") {
        const lifecycle = next[action.entityId].lifecycle === "disabled" ? "active" : next[action.entityId].lifecycle;
        next[action.entityId] = attachEntityAliases({ ...clone(next[action.entityId]), source: makeSource({ detachedId: old.id }, scene), lifecycle, state: lifecycle });
      } else next[action.entityId] = attachEntityAliases({ ...clone(next[action.entityId]), lifecycle: "disabled", state: "disabled" });
    }
    for (const entity of Object.values(next)) entity.links = (entity.links || []).filter(link => link.from !== old.id && link.to !== old.id).map(makeLink);
    const cleanup = cleanupPlan(scene, [old.id, ...(dependentPlan.entityIds || [])], { policy: old.sourceLossPolicy });
    const backingEvents = [{ operation: "unbind", entityId: old.id, backing: clone(old.backing) }, ...(dependentPlan.actions || []).filter(action => action.action === "remove").map(action => ({ operation: "unbind", entityId: action.entityId, backing: clone(action.backing) }))];
    return finish(scene, map, next, removed ? "remove" : "destroy", { id: old.id, purge: removed, dependentActions: dependentPlan.actions || [] }, options, { entity: removed ? null : clone(next[old.id]), cleanup, backingEvent: { operation: "unbind", entityId: old.id, backing: clone(old.backing) }, backingEvents, sourceLoss: dependentPlan });
  }

  function changeOwner(scene, ref, ownerActorId, options = {}) {
    assertVersion(scene, options);
    const map = registryMap(scene), id = typeof ref === "string" ? ref : ref?.id ?? ref?.entityId, old = map[id], nextOwner = plainId(ownerActorId, "новый ID владельца");
    if (!old) fail("Сущность для смены владельца не найдена.", "missing-entity");
    assertAuthority(scene, requesterOf(options), [old.ownerActorId], options);
    if (!actorById(scene, nextOwner)) fail("Новый владелец сущности отсутствует на Сцене.", "missing-owner");
    const nextEntity = attachEntityAliases({ ...clone(old), ownerActorId: nextOwner });
    const next = { ...map, [old.id]: nextEntity };
    return finish(scene, map, next, "owner-change", { id: old.id, from: old.ownerActorId, to: nextOwner }, options, { entity: clone(nextEntity) });
  }

  function link(scene, raw, options = {}) {
    assertVersion(scene, options);
    const map = registryMap(scene), linkRecord = makeLink(raw), source = map[linkRecord.from], target = map[linkRecord.to];
    if (!source || !target) fail("Связь не может ссылаться на отсутствующую сущность.", "dangling-link");
    assertAuthority(scene, requesterOf(options), [source.ownerActorId, target.ownerActorId], options);
    if (allLinks(map).some(item => item.id === linkRecord.id)) {
      const existing = allLinks(map).find(item => item.id === linkRecord.id);
      if (sameJson(existing, linkRecord)) return { ok: true, scene: clone(scene), link: clone(existing), replayed: true, idempotent: true, event: null };
      fail("Связь с таким ID уже существует.", "duplicate-link");
    }
    if (allLinks(map).length >= MAX_LINKS) fail("Достигнут лимит связей Сцены.", "link-limit");
    const cycle = resolveLinkCycle(map, linkRecord);
    if (cycle) fail("Связь создаёт цикл.", "link-cycle", { path: cycle });
    const nextSource = attachEntityAliases({ ...clone(source), links: [...(source.links || []).map(makeLink), linkRecord] });
    const next = { ...map, [source.id]: nextSource };
    return finish(scene, map, next, "link", { id: linkRecord.id, link: linkRecord }, options, { link: clone(linkRecord) });
  }

  function unlink(scene, ref, options = {}) {
    assertVersion(scene, options);
    const map = registryMap(scene), id = typeof ref === "string" ? ref : ref?.id ?? ref?.linkId;
    const existing = allLinks(map).find(linkRecord => linkRecord.id === id);
    if (!existing) return { ok: true, scene: clone(scene), replayed: true, idempotent: true, event: null };
    const source = map[existing.from];
    assertAuthority(scene, requesterOf(options), [map[existing.from]?.ownerActorId, map[existing.to]?.ownerActorId].filter(Boolean), options);
    const next = { ...map, [source.id]: attachEntityAliases({ ...clone(source), links: (source.links || []).filter(item => item.id !== id).map(makeLink) }) };
    return finish(scene, map, next, "unlink", { id, link: existing }, options, { link: clone(existing) });
  }

  // Pilot entry/exit stay explicit operations on top of the generic directed
  // link.  They do not copy a vehicle's resources, health, turn or geometry;
  // a caller may pass a placement status when exit needs a Narrator decision.
  function pilotEnter(scene, controller, controlled, options = {}) {
    const from = typeof controller === "string" ? controller : controller?.id ?? controller?.entityId;
    const to = typeof controlled === "string" ? controlled : controlled?.id ?? controlled?.entityId;
    const result = link(scene, { ...(options.link || {}), id: options.linkId || options.link?.id, type: "pilot", from, to }, options);
    return { ...result, pilot: { operation: "enter", controller: from, controlled: to } };
  }

  function pilotExit(scene, controller, controlled = null, options = {}) {
    const from = typeof controller === "string" ? controller : controller?.id ?? controller?.entityId;
    const to = controlled == null ? null : typeof controlled === "string" ? controlled : controlled?.id ?? controlled?.entityId;
    const candidate = linksFor(scene, from).find(item => item.type === "pilot" && item.from === from && (to == null || item.to === to));
    if (!candidate) return { ok: true, scene: clone(scene), replayed: true, idempotent: true, event: null, pilot: { operation: "exit", controller: from, controlled: to } };
    const map=registryMap(scene);
    assertAuthority(scene,requesterOf(options),[map[candidate.from]?.ownerActorId,map[candidate.to]?.ownerActorId].filter(Boolean),options);
    const placement = options.placementStatus || options.landingStatus || null;
    const needsChoice = placement && placement.available === false || options.requireLanding === true && !options.landingCell && !options.placement;
    if (needsChoice) {
      const choiceId = options.choiceId || `entity:pilot-exit:${candidate.id}`;
      return {
        ok: false,
        waiting: true,
        scene: clone(scene),
        reason: placement?.reason || "Для выхода из пилотирования нужна допустимая клетка высадки.",
        choice: { schema: SCHEMA, id: choiceId, kind: "pilot-exit-placement", linkId: candidate.id, controller: from, controlled: candidate.to, options: ["choose-cell", "cancel"] },
        link: clone(candidate),
        pilot: { operation: "exit", controller: from, controlled: candidate.to },
      };
    }
    const result = unlink(scene, candidate.id, options);
    return { ...result, pilot: { operation: "exit", controller: from, controlled: candidate.to, landingCell: clone(options.landingCell || options.placement || null) } };
  }

  function sourceLoss(scene, source, options = {}) {
    assertVersion(scene, options);
    const plan = sourceLossPlan(scene, source, options), map = registryMap(scene);
    if (!plan.actions.length) return { ok: true, scene: clone(scene), plan, replayed: true, idempotent: true, event: null };
    assertAuthority(scene, requesterOf(options), plan.actions.map(item => map[item.entityId]?.ownerActorId).filter(Boolean), options);
    const next = { ...map };
    for (const action of plan.actions) {
      const current = next[action.entityId];
      if (!current) continue;
      if (action.action === "remove") delete next[action.entityId];
      else if (action.action === "detach") {
        const sourceId = sourceTypeAndId(plan.source, scene)?.id;
        const lifecycle = current.lifecycle === "disabled" ? "active" : current.lifecycle;
        next[action.entityId] = attachEntityAliases({ ...clone(current), source: makeSource({ detachedId: sourceId }, scene), lifecycle, state: lifecycle });
      }
      else next[action.entityId] = attachEntityAliases({ ...clone(current), lifecycle: "disabled", state: "disabled" });
    }
    const removed = new Set(plan.actions.filter(item => item.action === "remove").map(item => item.entityId));
    for (const entity of Object.values(next)) entity.links = (entity.links || []).filter(item => !removed.has(item.from) && !removed.has(item.to)).map(makeLink);
    const sourceId = sourceTypeAndId(plan.source, scene)?.id || "source";
    const backingEvents = plan.actions.filter(action => action.action === "remove").map(action => ({ operation: "unbind", entityId: action.entityId, backing: clone(action.backing) }));
    return finish(scene, map, next, "source-loss", { id: sourceId, source: plan.source, actions: plan.actions }, options, { plan, cleanup: plan.cleanup, backingEvents });
  }

  function transition(scene, operation, options = {}) {
    const action = typeof operation === "string" ? { operation } : operation || {};
    const type = String(action.operation || action.kind || action.type || "").replace(/^lionwing\./u, "").replace(/^entities?\./u, "").replace(/^entity\./u, "");
    const payload = action.payload || action.request || action;
    const merged = { ...options, ...(action.options || {}), ...(action.actorId == null ? {} : { actorId: action.actorId }) };
    if (type === "command") return transition(scene, payload, merged);
    if (type === "create") return create(scene, payload.entity || payload, merged);
    if (type === "transform") return transform(scene, payload.id || payload.entityId, payload.backing || payload.to, merged);
    if (type === "destroy" || type === "remove") return destroy(scene, payload.id || payload.entityId, { ...merged, purge: type === "remove" || payload.purge });
    if (type === "owner-change" || type === "owner.change" || type === "change-owner") return changeOwner(scene, payload.id || payload.entityId, payload.ownerActorId || payload.to, merged);
    if (type === "link") return link(scene, payload.link || payload, merged);
    if (type === "unlink") return unlink(scene, payload.id || payload.linkId || payload, merged);
    if (type === "pilot-enter") return pilotEnter(scene, payload.controller || payload.from, payload.controlled || payload.to, merged);
    if (type === "pilot-exit") return pilotExit(scene, payload.controller || payload.from, payload.controlled || payload.to, merged);
    if (type === "source-loss" || type === "sourceLoss") return sourceLoss(scene, payload.source || payload, merged);
    fail(`Неизвестная операция сущности: ${type}.`, "unknown-entity-operation");
  }

  function replay(scene, rawEvent, options = {}) {
    const event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : clone(rawEvent);
    if (!isObject(event) || typeof event.type !== "string") fail("Событие сущности не является JSON-объектом.", "invalid-event");
    const receipts = receiptsOf(scene);
    if (receipts[event.id]) {
      const saved=receipts[event.id],savedEvent=saved.event||saved,savedFingerprint=saved.fingerprint||eventFingerprint(savedEvent.operation,savedEvent.payload);
      if(savedFingerprint!==eventFingerprint(event.operation,event.payload))fail("Повтор события сущности с тем же ID содержит другие данные.","entity-event-conflict",{eventId:event.id});
      return { ok: true, scene: clone(scene), event: clone(savedEvent), replayed: true, idempotent: true };
    }
    if(!isObject(event.before)||!sameJson(registrySnapshot(registryMap(scene)),event.before))fail("Событие сущности применено не к тому снимку реестра.","stale-entity-replay",{eventId:event.id});
    const result = transition(scene, { type: event.type, operation: event.operation, payload: event.payload }, { ...options, eventId: event.id, role: options.role || "narrator" });
    return { ...result, replayed: Boolean(result.replayed), event: result.event || event };
  }

  function undo(scene, rawEvent, options = {}) {
    const event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : rawEvent;
    if (!isObject(event) || !isObject(event.before) || !isObject(event.after)) fail("Событие сущности не содержит снимки для отката.", "invalid-event");
    const current = registrySnapshot(registryMap(scene));
    if (!sameJson(current, event.after)) fail("Откат сущности устарел: текущий реестр уже изменён.", "stale-undo");
    const receipts = receiptsOf(scene);
    if (event.id) delete receipts[event.id];
    const next = withRegistry(scene, event.before, receipts);
    const undoEvent = { schema: SCHEMA, id: `undo:${event.id || "entity"}`, type: "entity.undo", operation: "undo", payload: { eventId: event.id || null }, before: clone(event.after), after: clone(event.before) };
    return { ok: true, scene: next, event: undoEvent, undone: true };
  }

  function serialize(scene) { return JSON.stringify(clone(scene)); }

  function reload(serialized, options = {}) {
    const scene = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
    if (!isObject(scene)) fail("Сохранение Сцены не является JSON-объектом.", "invalid-scene");
    const graph = graphStatus(scene);
    if (!graph.valid && options.allowInvalid !== true) fail("Сохранение содержит недопустимый граф сущностей.", "invalid-entity-graph", { errors: graph.errors });
    return withRegistry(scene, registryMap(scene), receiptsOf(scene));
  }

  function query(scene, filter = {}) {
    const graph = graphStatus(scene);
    if (typeof filter === "function") return graph.entities.filter(entity => filter(clone(entity), entityStatus(scene, entity.id)));
    const options = isObject(filter) ? filter : {};
    return graph.entities.filter(entity => {
      if (options.id && entity.id !== options.id) return false;
      if (options.ids && !options.ids.includes(entity.id)) return false;
      if (options.kind && entity.kind !== options.kind) return false;
      if (options.ownerActorId && entity.ownerActorId !== options.ownerActorId) return false;
      if (options.state && entity.lifecycle !== options.state) return false;
      if (options.visibility && entity.visibility !== options.visibility) return false;
      if (options.backingType && backingTypeAndId(entity.backing)?.type !== options.backingType) return false;
      if (options.sourceId && sourceTypeAndId(entity.source, scene)?.id !== options.sourceId) return false;
      if (options.active != null && Boolean(entityStatus(scene, entity.id).active) !== Boolean(options.active)) return false;
      if (options.linkedTo && !linksFor(scene, entity.id).some(linkRecord => linkRecord.from === options.linkedTo || linkRecord.to === options.linkedTo)) return false;
      if (options.linkType && !linksFor(scene, entity.id).some(linkRecord => linkRecord.type === options.linkType)) return false;
      return true;
    }).map(cloneEntityRecord);
  }

  function connected(scene, ref, options = {}) {
    const id = typeof ref === "string" ? ref : ref?.id ?? ref?.entityId;
    const graph = graphStatus(scene), links = graph.links.filter(linkRecord => !options.type || linkRecord.type === options.type);
    const result = new Set(), queue = [{ id, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (result.has(current.id) || current.depth > Number(options.depth ?? 1)) continue;
      result.add(current.id);
      for (const linkRecord of links) {
        if (options.direction === "in" && linkRecord.to === current.id) queue.push({ id: linkRecord.from, depth: current.depth + 1 });
        else if (options.direction === "out" && linkRecord.from === current.id) queue.push({ id: linkRecord.to, depth: current.depth + 1 });
        else if (!options.direction && linkRecord.from === current.id) queue.push({ id: linkRecord.to, depth: current.depth + 1 });
        else if (!options.direction && linkRecord.to === current.id) queue.push({ id: linkRecord.from, depth: current.depth + 1 });
      }
    }
    result.delete(id);
    return [...result].sort();
  }

  const api = Object.freeze({
    SCHEMA, VERSION: SCHEMA, LINK_TYPES: Object.freeze([...LINK_TYPES]), BACKING_TYPES: Object.freeze([...BACKING_TYPES]),
    SOURCE_LOSS_POLICIES: Object.freeze([...POLICIES]),
    EntityError, normalizeEntity, entityRecord: (sceneOrRaw, raw) => raw === undefined ? normalizeEntity(sceneOrRaw, {}, { allowMissingReferences: true }) : normalizeEntity(raw, sceneOrRaw, { allowMissingReferences: true }), normalizeLifetime, normalizeLink: makeLink,
    validateEntity, validateRecord: validateEntity, validateLink, validate: graphStatus, validateGraph: graphStatus, graph: graphStatus, entityGraph: graphStatus,
    resolve: (scene, ref) => entityStatus(scene, ref), resolveStatus: entityStatus, resolveEntity: resolveEntityRecord, entityStatus, status: entityStatus,
    resolveBacking: (scene, ref) => { const entity = resolveEntityRecord(scene, ref); const item = entity ? backingItem(scene, entity.backing) : null; return item ? clone(item) : null; },
    query, queryEntities: query, queryGraph: graphStatus, connected, linksFor,
    project, projection: project, projectEntities: project, projectEntity: entityProjection, projectScene,
    cleanupPlan, planCleanup: cleanupPlan, sourceLossPlan, sourceLossStatus: sourceLossPlan, sourceLoss,
    command: (actorId, payload) => ({ type: "entity.command", actorId: actorId ?? null, payload: clone(payload) }),
    transition, apply: transition, dispatch: transition,
    create, createEntity: create, transform, transformEntity: transform, destroy, destroyEntity: destroy,
    remove: (scene, ref, options = {}) => destroy(scene, ref, { ...options, purge: true }),
    changeOwner, ownerChange: changeOwner, link, linkEntities: link, unlink, unlinkEntities: unlink, pilotEnter, pilotExit,
    replay, reload, hydrate: reload, serialize, undo,
  });

  global.DAWN_LIONWING_ENTITIES = api;
})(typeof window === "object" ? window : globalThis);
