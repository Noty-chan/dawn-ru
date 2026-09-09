"use strict";

// Typed item state for LionWing.  This module deliberately sits beside the
// existing ruleResources/ruleClocks contract: those counters continue to own
// alternate Focus/AP and clocks, while this registry owns named items, charges
// and values that may have more than one instance.
(function (global) {
  const VERSION = 1;
  const KINDS = Object.freeze(["stack", "count", "charges", "slots", "recorded-value", "selected-item"]);
  const KIND_ALIASES = Object.freeze({ "recorded-values": "recorded-value", "selected-items": "selected-item" });
  const VISIBILITY = new Set(["public", "owner", "narrator", "hidden"]);
  const BOUNDARIES = new Set(["scene", "round", "turn", "intermission", "persistent", "manual"]);
  const ID = /^[a-z][a-z0-9._:-]{0,119}$/i;
  const MAX_ID = 180;
  const MAX_RECORDS = 128;
  const MAX_DEFINITIONS = 96;
  const MAX_JOURNAL = 256;
  const MAX_RESERVATIONS = 64;
  const MAX_VALUES = 64;
  const MAX_NUMBER = 999999;
  const FORBIDDEN_KEYS = new Set(["constructor", "prototype", "__proto__", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString"]);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const actorById = (scene, id) => (scene?.actors || []).find(actor => actor.id === id) || null;
  const fail = (message, code = "LIONWING_INVENTORY_BLOCKED") => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };
  const integer = (value, label, max = MAX_NUMBER) => {
    if (!Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > max) fail(`Некорректное значение: ${label}`);
    return Number(value);
  };
  const positive = (value, label = "количество") => {
    const result = integer(value, label);
    if (result < 1) fail(`${label} должно быть положительным`);
    return result;
  };
  const text = (value, label, max = 180) => {
    if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f]/u.test(value)) fail(`Некорректное значение: ${label}`);
    return value.trim();
  };
  const optionalText = (value, label, max = 180) => value == null || value === "" ? null : text(value, label, max);
  const safeDigest = value => {
    const digest = value == null || value === "" ? "manual" : text(value, "sourceDigest", 180);
    if (/\b(?:ru-v0\.9|old[-_ ]edition|русск|translation|supplement)\b/iu.test(digest)) fail("Источник старой редакции не может быть источником LionWing");
    return digest;
  };
  const kind = value => {
    const normalized = KIND_ALIASES[String(value || "stack").toLowerCase()] || String(value || "stack").toLowerCase();
    if (!KINDS.includes(normalized)) fail("Неизвестный тип записи инвентаря");
    return normalized;
  };
  const safeMapKey = (value, label) => {
    if (FORBIDDEN_KEYS.has(String(value))) fail(`Некорректное значение: ${label}`);
    return value;
  };
  const boundary = value => {
    const normalized = value == null || value === "" ? "manual" : String(value);
    if (!BOUNDARIES.has(normalized)) fail("Неизвестная граница сброса инвентаря");
    return normalized;
  };
  const visibility = value => {
    const normalized = value == null || value === "" ? "public" : String(value);
    if (!VISIBILITY.has(normalized)) fail("Неизвестная видимость записи инвентаря");
    return normalized;
  };
  const keyFor = (id, instanceId = null) => instanceId ? `${id}#${instanceId}` : id;
  const fieldFor = value => value === "charges" ? "charges" : value === "slots" ? "available" : "count";
  const numericKind = value => ["stack", "count", "charges", "slots"].includes(value);

  function inventoryState(actor) {
    if (!actor || typeof actor !== "object") fail("Владелец записи инвентаря отсутствует");
    actor.lionwing ||= {};
    const existing = actor.lionwing.inventory;
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) actor.lionwing.inventory = { schema: VERSION, definitions: {}, records: {}, reservations: {}, journal: [] };
    const state = actor.lionwing.inventory;
    state.schema = VERSION;
    if (!state.definitions || typeof state.definitions !== "object" || Array.isArray(state.definitions)) state.definitions = {};
    if (!state.records || typeof state.records !== "object" || Array.isArray(state.records)) state.records = {};
    if (!state.reservations || typeof state.reservations !== "object" || Array.isArray(state.reservations)) state.reservations = {};
    if (!Array.isArray(state.journal)) state.journal = [];
    return state;
  }

  function definitionPayload(scene, actor, payload, previous = null) {
    const id = text(payload.id || payload.itemId || payload.definitionId, "ID записи", MAX_ID);
    if (!ID.test(id) || FORBIDDEN_KEYS.has(id)) fail("ID записи инвентаря имеет неподдерживаемый формат");
    const recordKind = kind(payload.kind || previous?.kind);
    const ownerActorId = payload.ownerActorId ?? previous?.ownerActorId ?? actor.id;
    if (ownerActorId !== actor.id) fail("Владелец записи инвентаря не совпадает с участником");
    const sourceActorId = payload.sourceActorId ?? previous?.sourceActorId ?? actor.id;
    if (sourceActorId != null && !actorById(scene, sourceActorId)) fail("Источник записи инвентаря отсутствует");
    const sourceEntityId = optionalText(payload.sourceEntityId ?? previous?.sourceEntityId, "sourceEntityId", MAX_ID);
    if (sourceEntityId && scene?.lionwing?.entities && !scene.lionwing.entities[sourceEntityId]) fail("Источник-сущность записи инвентаря отсутствует");
    const maximumRaw = own(payload, "maximum") ? payload.maximum : own(payload, "max") ? payload.max : previous?.maximum ?? previous?.max ?? (numericKind(recordKind) ? 99 : null);
    const maximum = maximumRaw == null ? null : integer(maximumRaw, "максимум");
    const minimum = integer(payload.minimum ?? payload.min ?? previous?.minimum ?? previous?.min ?? 0, "минимум");
    if (maximum != null && minimum > maximum) fail("Минимум записи превышает максимум");
    const initialRaw = own(payload, "initial") ? payload.initial : previous?.initial;
    const initial = numericKind(recordKind) ? integer(initialRaw ?? minimum, "начальное значение") : initialRaw == null ? null : text(String(initialRaw), "начальное значение", 120);
    if (numericKind(recordKind) && maximum != null && initial > maximum || numericKind(recordKind) && initial < minimum) fail("Начальное значение записи выходит за границы");
    const label = text(payload.label || payload.name || previous?.label || id, "название записи", 120);
    const labelI18n = payload.labelI18n ?? payload.localization ?? previous?.labelI18n ?? previous?.localization ?? {};
    if (!labelI18n || typeof labelI18n !== "object" || Array.isArray(labelI18n)) fail("localization записи имеет неподдерживаемый формат");
    const cleanI18n = Object.fromEntries(Object.entries(labelI18n).filter(([key, value]) => /^[a-z-]{2,12}$/i.test(key) && typeof value === "string").slice(0, 8).map(([key, value]) => [key, value.slice(0, 120)]));
    const resetAt = boundary(payload.resetAt ?? payload.scope ?? payload.lifetime ?? previous?.resetAt ?? previous?.scope ?? (previous?.lifetime || "manual"));
    const lifetime = boundary(payload.lifetime ?? previous?.lifetime ?? resetAt);
    const sourceDigest = safeDigest(payload.sourceDigest ?? previous?.sourceDigest);
    const unique = payload.unique === true || previous?.unique === true;
    const multiple = payload.multiple === true || previous?.multiple === true || payload.instanceId != null;
    const replacementGroup = optionalText(payload.replacementGroup ?? previous?.replacementGroup ?? payload.replaces, "replacementGroup", MAX_ID);
    const replacementLevel = integer(payload.level ?? payload.replacementLevel ?? previous?.level ?? previous?.replacementLevel ?? 0, "уровень замены", 99);
    const alternateResource = optionalText(payload.alternateResource ?? previous?.alternateResource, "alternateResource", MAX_ID);
    const editionId = payload.editionId ?? previous?.editionId ?? "lionwing";
    if (editionId !== "lionwing") fail("Запись старой редакции не может быть подключена к LionWing");
    return {
      schema: VERSION, id, definitionId: id, kind: recordKind, label, name: label,
      labelI18n: cleanI18n, localization: cleanI18n,
      ownerActorId, sourceActorId, sourceEntityId, ruleId: optionalText(payload.ruleId ?? previous?.ruleId, "ruleId", MAX_ID), sourceDigest,
      minimum, min: minimum, maximum, max: maximum, initial,
      resetAt, scope: resetAt, lifetime, visibility: visibility(payload.visibility ?? previous?.visibility),
      unique, multiple, replacementGroup, replaces: replacementGroup,
      alternateResource, replacementLevel, level: replacementLevel, editionId, active: previous?.active !== false,
    };
  }

  function readNumeric(record) {
    if (!record) return 0;
    if (record.kind === "charges") return Number(record.charges ?? record.current ?? record.value ?? 0);
    if (record.kind === "slots") return Number(record.available ?? record.current ?? record.value ?? record.count ?? 0);
    return Number(record.count ?? record.current ?? record.value ?? 0);
  }
  function writeNumeric(record, value) {
    const next = Number(value);
    record.current = next; record.value = next;
    if (record.kind === "charges") record.charges = next;
    else if (record.kind === "slots") { record.available = next; record.used = Math.max(0, Number(record.maximum ?? 0) - next); record.slots = Number(record.maximum ?? 0); }
    else record.count = next;
  }
  function readRecordValue(payload, record) {
    if (record.kind === "recorded-value") return payload.value;
    if (record.kind === "selected-item") return payload.selectedItemId ?? payload.selected ?? payload.value;
    return payload.value ?? payload.current ?? payload.count ?? payload.charges ?? payload.available;
  }
  function recordSnapshot(definition, payload, existing = null) {
    const record = existing ? { ...existing } : {
      schema: VERSION, id: keyFor(definition.id, payload.instanceId || null), definitionId: definition.id,
      instanceId: payload.instanceId || null, kind: definition.kind,
      ownerActorId: definition.ownerActorId, sourceActorId: definition.sourceActorId, sourceEntityId: definition.sourceEntityId,
      ruleId: definition.ruleId, sourceDigest: definition.sourceDigest, label: definition.label, name: definition.label,
      labelI18n: clone(definition.labelI18n), localization: clone(definition.localization),
      minimum: definition.minimum, min: definition.minimum, maximum: definition.maximum, max: definition.maximum,
      initial: definition.initial, resetAt: definition.resetAt, scope: definition.scope, lifetime: definition.lifetime,
      visibility: definition.visibility, active: definition.active, unique: definition.unique, multiple: definition.multiple,
    };
    // Rebuild provenance and visibility from the immutable definition on every
    // reload/reconfigure. A stale record must never widen a private definition
    // into a public projection.
    Object.assign(record, {
      schema: VERSION, definitionId: definition.id, kind: definition.kind,
      ownerActorId: definition.ownerActorId, sourceActorId: definition.sourceActorId, sourceEntityId: definition.sourceEntityId,
      ruleId: definition.ruleId, sourceDigest: definition.sourceDigest, label: definition.label, name: definition.label,
      labelI18n: clone(definition.labelI18n), localization: clone(definition.localization),
      minimum: definition.minimum, min: definition.minimum, maximum: definition.maximum, max: definition.maximum,
      initial: definition.initial, resetAt: definition.resetAt, scope: definition.scope, lifetime: definition.lifetime,
      visibility: definition.visibility, active: definition.active, unique: definition.unique, multiple: definition.multiple,
    });
    if (numericKind(definition.kind)) {
      const initial = definition.initial ?? definition.minimum;
      const raw = existing ? readNumeric(existing) : readNumeric({ kind: definition.kind, ...payload, current: readRecordValue(payload, { kind: definition.kind }) ?? initial });
      const value = own(payload, "value") || own(payload, "current") || own(payload, "count") || own(payload, "charges") || own(payload, "available") ? Number(readRecordValue(payload, { kind: definition.kind })) : raw;
      if (!Number.isSafeInteger(value) || value < definition.minimum || definition.maximum != null && value > definition.maximum) fail("Значение записи выходит за границы");
      writeNumeric(record, value);
    } else if (definition.kind === "recorded-value") {
      const values = Array.isArray(existing?.values) ? clone(existing.values) : [];
      if (Array.isArray(payload.values)) {
        if (payload.values.length > MAX_VALUES || payload.values.some(item => item == null || typeof item !== "object" || !Number.isSafeInteger(Number(item.value)) || Number(item.value) < definition.minimum || definition.maximum != null && Number(item.value) > definition.maximum)) fail("Некорректные recorded-values");
        record.values = payload.values.slice(0, MAX_VALUES).map((item, index) => ({ id: text(item.id || `${record.id}:${index}`, "ID recorded-value", MAX_ID), value: Number(item.value), label: typeof item.label === "string" ? item.label.slice(0, 120) : null }));
      } else if (own(payload, "value")) {
        const value = integer(payload.value, "recorded-value");
        if (value < definition.minimum || definition.maximum != null && value > definition.maximum) fail("Recorded-value выходит за границы записи");
        values.push({ id: text(payload.valueId || `${record.id}:${values.length}`, "ID recorded-value", MAX_ID), value, label: typeof payload.valueLabel === "string" ? payload.valueLabel.slice(0, 120) : null });
        record.values = values.slice(-MAX_VALUES);
      } else record.values = values;
      record.count = record.values.length; record.current = record.values.length ? record.values[record.values.length - 1].value : null; record.value = record.current;
    } else if (definition.kind === "selected-item") {
      const selected = readRecordValue(payload, { kind: definition.kind });
      if (definition.multiple) {
        const values = Array.isArray(payload.selectedItems) ? payload.selectedItems : selected == null ? existing?.selectedItems || [] : [selected];
        if (values.some(item => typeof item !== "string")) fail("selected-item требует ID выбранного предмета");
        const normalized = values.map(String).slice(0, MAX_VALUES);
        if (definition.maximum != null && normalized.length > definition.maximum) fail("Число выбранных предметов превышает максимум", "LIONWING_INVENTORY_MAX");
        if (Array.isArray(payload.items) && payload.items.length && normalized.some(item => !payload.items.includes(item))) fail("Выбранного предмета нет в selected-item", "LIONWING_INVENTORY_SELECTION");
        record.selectedItems = normalized;
        record.selectedItemId = normalized.at(-1) || null;
      } else {
        if (selected != null && typeof selected !== "string") fail("selected-item требует ID выбранного предмета");
        record.selectedItemId = selected == null ? existing?.selectedItemId ?? null : selected;
      }
      record.selected = record.selectedItemId;
      record.current = record.selectedItemId; record.value = record.selectedItemId;
      if (Array.isArray(payload.items)) record.items = [...new Set(payload.items.filter(item => typeof item === "string").map(String))].slice(0, MAX_VALUES);
      else if (!Array.isArray(record.items)) record.items = [];
      if (record.selectedItemId && record.items.length && !record.items.includes(record.selectedItemId)) fail("Выбранного предмета нет в selected-item");
    }
    return record;
  }

  function assertSource(scene, record, operationActorId, role = null) {
    const owner = record.ownerActorId;
    if (operationActorId && operationActorId !== owner && !["narrator", "gm"].includes(role)) fail("Запись инвентаря принадлежит другому участнику", "LIONWING_INVENTORY_OWNER");
    if (record.sourceActorId && !actorById(scene, record.sourceActorId)) fail("Источник записи инвентаря больше не существует", "LIONWING_INVENTORY_SOURCE");
    if (record.sourceEntityId && scene?.lionwing?.entities && !scene.lionwing.entities[record.sourceEntityId]) fail("Источник-сущность записи инвентаря больше не существует", "LIONWING_INVENTORY_SOURCE");
  }

  function mirrorLegacy(actor, record) {
    if (!numericKind(record.kind) || record.instanceId) return;
    actor.inventory ||= {};
    const value = readNumeric(record);
    if (value > 0) actor.inventory[record.definitionId] = value;
    else delete actor.inventory[record.definitionId];
  }

  // A typed record is authoritative, but old scenes still expose a small
  // numeric map at actor.inventory. Keep that projection exact after a
  // rollback or undo, including removal of a record that reached zero.
  function syncLegacy(actor) {
    const state = actor?.lionwing?.inventory;
    if (!state || typeof state !== "object") return;
    actor.inventory ||= {};
    for (const [id, definition] of Object.entries(state.definitions || {})) {
      const record = Object.values(state.records || {}).find(item => item.definitionId === id && !item.instanceId);
      if (record && numericKind(definition.kind) && readNumeric(record) > 0) actor.inventory[id] = readNumeric(record);
      else delete actor.inventory[id];
    }
  }

  function findDefinition(actor, id) {
    const state = inventoryState(actor);
    return own(state.definitions, id) ? state.definitions[id] : null;
  }
  function findRecord(actor, id, instanceId = null) {
    const state = inventoryState(actor), definition = findDefinition(actor, id);
    if (!definition) return { state, definition: null, record: null, key: keyFor(id, instanceId) };
    const key = keyFor(id, instanceId || null);
    return { state, definition, record: state.records[key] || null, key };
  }
  function assertDefinitionConflict(scene, actor, definition, replacing = false) {
    const state = inventoryState(actor);
    for (const other of Object.values(state.definitions)) {
      if (other.id === definition.id || !other.active || !definition.replacementGroup || other.replacementGroup !== definition.replacementGroup) continue;
      if (!replacing && Number(other.replacementLevel || 0) >= Number(definition.replacementLevel || 0)) fail("Конфликт замены записи инвентаря", "LIONWING_INVENTORY_REPLACEMENT");
      if (Number(other.replacementLevel || 0) < Number(definition.replacementLevel || 0)) {
        other.active = false;
        for (const [key, record] of Object.entries(state.records)) if (record.definitionId === other.id) {
          delete state.records[key];
          if (!record.instanceId) { actor.inventory ||= {}; delete actor.inventory[other.id]; }
        }
      }
    }
  }
  function ensureRecord(scene, actor, payload, options = {}) {
    const state = inventoryState(actor), id = text(payload.id || payload.itemId || payload.definitionId, "ID записи", MAX_ID);
    const existingDefinition = state.definitions[id];
    const definition = definitionPayload(scene, actor, payload, existingDefinition);
    if (existingDefinition && JSON.stringify({ ownerActorId: existingDefinition.ownerActorId, sourceActorId: existingDefinition.sourceActorId, ruleId: existingDefinition.ruleId, sourceDigest: existingDefinition.sourceDigest, kind: existingDefinition.kind }) !== JSON.stringify({ ownerActorId: definition.ownerActorId, sourceActorId: definition.sourceActorId, ruleId: definition.ruleId, sourceDigest: definition.sourceDigest, kind: definition.kind })) fail("Нельзя подменить происхождение существующей записи", "LIONWING_INVENTORY_PROVENANCE");
    if (existingDefinition) {
      // A configure operation may refresh the current value at a boundary,
      // but cannot silently raise a client supplied maximum or change the
      // reset/visibility contract of an existing source.
      for (const field of ["minimum", "maximum", "initial", "resetAt", "lifetime", "visibility", "unique", "multiple", "replacementGroup", "replacementLevel", "alternateResource", "editionId"]) {
        const supplied = field === "minimum" ? own(payload, "minimum") || own(payload, "min") : field === "maximum" ? own(payload, "maximum") || own(payload, "max") : field === "replacementLevel" ? own(payload, "replacementLevel") || own(payload, "level") : own(payload, field);
        if (supplied && JSON.stringify(existingDefinition[field]) !== JSON.stringify(definition[field])) fail("Нельзя изменить контракт существующей записи инвентаря", "LIONWING_INVENTORY_PROVENANCE");
      }
    }
    assertDefinitionConflict(scene, actor, definition, options.replaceExisting === true);
    if (definition.unique && definition.multiple && payload.instanceId && Object.values(state.records).some(record => record.definitionId === definition.id && record.instanceId && record.instanceId !== payload.instanceId)) fail("Уникальная запись уже имеет экземпляр", "LIONWING_INVENTORY_UNIQUE");
    if (definition.unique && !definition.multiple && !existingDefinition && Object.values(state.definitions).some(item => item.id === definition.id && item.ownerActorId === actor.id)) fail("Уникальная запись уже существует", "LIONWING_INVENTORY_UNIQUE");
    if (!existingDefinition && Object.keys(state.definitions).length >= MAX_DEFINITIONS) fail("Реестр определений инвентаря переполнен");
    state.definitions[id] = definition;
    const instanceId = payload.instanceId == null ? null : text(String(payload.instanceId), "ID экземпляра", MAX_ID);
    if (instanceId && !definition.multiple) fail("Экземпляр допустим только для multiple-записи");
    const key = keyFor(id, instanceId), previous = state.records[key];
    if (!previous && Object.keys(state.records).length >= MAX_RECORDS) fail("Реестр записей инвентаря переполнен");
    const record = recordSnapshot(definition, { ...payload, instanceId }, previous);
    state.records[key] = record;
    mirrorLegacy(actor, record);
    return { state, definition, record, key, previous };
  }

  function snapshotActors(scene, actorIds) {
    return Object.fromEntries([...new Set(actorIds.filter(Boolean))].map(id => [id, clone(actorById(scene, id)?.lionwing?.inventory || null)]));
  }
  function snapshotLegacy(scene, actorIds) {
    return Object.fromEntries([...new Set(actorIds.filter(Boolean))].map(id => [id, clone(actorById(scene, id)?.inventory || {})]));
  }
  const journalSnapshot = value => {
    if (!value || typeof value !== "object") return value;
    const result = clone(value);
    result.journal = [];
    return result;
  };
  const journalSnapshots = (scene, actorIds) => Object.fromEntries(Object.entries(snapshotActors(scene, actorIds)).map(([id, value]) => [id, journalSnapshot(value)]));
  function restoreActors(scene, snapshot, legacySnapshot = null) {
    for (const [id, saved] of Object.entries(snapshot || {})) {
      const actor = actorById(scene, id);
      if (!actor) continue;
      actor.lionwing ||= {};
      if (saved == null) delete actor.lionwing.inventory;
      else actor.lionwing.inventory = clone(saved);
      if (legacySnapshot && own(legacySnapshot, id)) actor.inventory = clone(legacySnapshot[id]) || {};
      else if (saved) syncLegacy(actor);
    }
  }
  function fingerprint(value) { return JSON.stringify(value); }
  function journal(state, row) {
    state.journal ||= [];
    state.journal.push(row);
    state.journal = state.journal.slice(-MAX_JOURNAL);
  }
  function emitOperation(ctx, operation, actorId, payload) {
    if (typeof ctx.emit === "function") ctx.emit(`inventory.${operation}`, actorId, payload);
  }
  const eventVisibility = value => value === "public" ? "public" : "gm";
  function roleFor(ctx) { return ctx.role || (ctx.actorId === "narrator" || ctx.actorId === "gm" ? ctx.actorId : null); }

  function normalizeReservation(scene, actor, key, raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("Резерв инвентаря имеет неподдерживаемый формат", "LIONWING_INVENTORY_RESERVATION");
    const rawId = raw.id ?? raw.reservationId ?? key;
    const id = text(String(rawId), "ID резерва", MAX_ID);
    safeMapKey(id, "ID резерва");
    if (id !== key) fail("Ключ резерва инвентаря не совпадает с его ID", "LIONWING_INVENTORY_RESERVATION");
    if (raw.actorId !== actor.id) fail("Резерв инвентаря принадлежит другому участнику", "LIONWING_INVENTORY_OWNER");
    const status = String(raw.status || "");
    if (!["reserved", "committed", "cancelled"].includes(status)) fail("Резерв инвентаря имеет неизвестный статус", "LIONWING_INVENTORY_RESERVATION");
    if (!Array.isArray(raw.costs) || !raw.costs.length || raw.costs.length > 32) fail("Резерв инвентаря содержит некорректную стоимость", "LIONWING_INVENTORY_RESERVATION");
    const costs = raw.costs.map(cost => {
      if (!cost || typeof cost !== "object" || Array.isArray(cost)) fail("Часть резерва инвентаря имеет неподдерживаемый формат", "LIONWING_INVENTORY_RESERVATION");
      const itemId = text(String(cost.itemId || cost.id || ""), "ID записи стоимости", MAX_ID), lookup = findRecord(actor, itemId, cost.instanceId || null);
      if (!lookup.definition || !lookup.record || !numericKind(lookup.definition.kind)) fail("Резерв ссылается на недоступную запись", "LIONWING_INVENTORY_RESERVATION");
      const instanceId = lookup.record.instanceId;
      if ((cost.instanceId || null) !== (instanceId || null)) fail("Резерв ссылается на неизвестный экземпляр", "LIONWING_INVENTORY_RESERVATION");
      const amount = positive(cost.amount, "стоимость записи");
      const sourceDigest = safeDigest(cost.sourceDigest ?? lookup.definition.sourceDigest);
      if (sourceDigest !== lookup.definition.sourceDigest) fail("Источник стоимости резерва изменился", "LIONWING_INVENTORY_PROVENANCE");
      return { itemId, instanceId, amount, sourceDigest };
    });
    const sceneVersion = integer(raw.sceneVersion ?? 0, "версия резерва");
    const operationId = optionalText(raw.operationId, "operationId", MAX_ID);
    const createdAt = optionalText(raw.createdAt, "createdAt", 80);
    return { schema: VERSION, id, reservationId: id, actorId: actor.id, sceneVersion, costs, status, operationId, createdAt,
      ...(raw.committedAt != null ? { committedAt: optionalText(raw.committedAt, "committedAt", 80) } : {}),
      ...(raw.cancelledAt != null ? { cancelledAt: optionalText(raw.cancelledAt, "cancelledAt", 80) } : {}),
      ...(raw.reason != null ? { reason: optionalText(raw.reason, "reason", 180) } : {}),
    };
  }

  function mutateOne(scene, actor, payload, ctx = {}) {
    const operation = String(payload.operation || payload.action || "");
    if (!["configure", "create", "gain", "add", "spend", "remove", "set", "record", "select", "reset"].includes(operation)) fail("Неизвестная операция записи инвентаря");
    if (["configure", "create", "set", "record", "reset"].includes(operation) && roleFor(ctx) === "player") fail("Игрок не может менять служебное определение записи инвентаря", "LIONWING_INVENTORY_AUTHORITY");
    if (operation === "configure" || operation === "create") {
      const result = ensureRecord(scene, actor, payload, { replaceExisting: payload.replaceExisting === true });
      emitOperation(ctx, operation === "create" ? "create" : "configure", actor.id, { operation, itemId: result.definition.id, instanceId: result.record.instanceId, kind: result.definition.kind, ownerActorId: actor.id, sourceActorId: result.definition.sourceActorId, sourceEntityId: result.definition.sourceEntityId, ruleId: result.definition.ruleId, sourceDigest: result.definition.sourceDigest, label: result.definition.label, value: readNumeric(result.record), current: result.record.current, maximum: result.definition.maximum, minimum: result.definition.minimum, lifetime: result.definition.lifetime, visibility: eventVisibility(result.definition.visibility) });
      return { ...result, changed: true };
    }
    const id = text(payload.id || payload.itemId || payload.definitionId, "ID записи", MAX_ID), lookup = findRecord(actor, id, payload.instanceId || null);
    if (!lookup.definition || !lookup.record) fail("Запись инвентаря не настроена", "LIONWING_INVENTORY_MISSING");
    assertSource(scene, lookup.record, ctx.actorId || actor.id, roleFor(ctx));
    const { state, definition, record } = lookup;
    const before = clone(record);
    if (operation === "gain" || operation === "add") {
      if (!numericKind(definition.kind)) fail("Получение доступно только числовой записи");
      const amount = positive(payload.amount ?? payload.delta, "получение");
      const next = readNumeric(record) + amount;
      if (definition.maximum != null && next > definition.maximum) fail("Получение превышает максимум записи", "LIONWING_INVENTORY_MAX");
      writeNumeric(record, next);
    } else if (operation === "spend") {
      if (!numericKind(definition.kind)) fail("Расход доступен только числовой записи");
      const amount = positive(payload.amount ?? payload.delta, "расход"), held = Object.values(state.reservations || {}).filter(reservation => reservation.status === "reserved" && reservation.id !== ctx.reservationId).flatMap(reservation => reservation.costs || []).filter(item => item.itemId === definition.id && (item.instanceId || null) === (record.instanceId || null)).reduce((sum, item) => sum + Number(item.amount || 0), 0), available = readNumeric(record) - held;
      if (available < amount) fail(`Недостаточно ${definition.label}: нужно ${amount}, доступно ${available}`, "LIONWING_INVENTORY_BALANCE");
      writeNumeric(record, available - amount);
    } else if (operation === "set") {
      if (definition.kind === "recorded-value" || definition.kind === "selected-item") fail("Для этой записи используйте record/select");
      const value = readRecordValue(payload, record);
      if (!Number.isSafeInteger(Number(value)) || Number(value) < definition.minimum || definition.maximum != null && Number(value) > definition.maximum) fail("Новое значение записи выходит за границы", "LIONWING_INVENTORY_BOUNDS");
      writeNumeric(record, Number(value));
    } else if (operation === "record") {
      if (definition.kind !== "recorded-value") fail("record доступен только recorded-value");
      const updated = recordSnapshot(definition, payload, record);
      Object.assign(record, updated);
    } else if (operation === "select") {
      if (definition.kind !== "selected-item") fail("select доступен только selected-item");
      const value = payload.selectedItemId ?? payload.selected ?? payload.value;
      if (value != null && typeof value !== "string") fail("selected-item требует ID выбранного предмета");
      if (value != null && Array.isArray(record.items) && record.items.length && !record.items.includes(value)) fail("Выбранного предмета нет в selected-item", "LIONWING_INVENTORY_SELECTION");
      if (definition.multiple) {
        let values = Array.isArray(record.selectedItems) ? [...record.selectedItems] : [];
        if (Array.isArray(payload.selectedItems)) values = payload.selectedItems;
        else if (payload.remove === true || ["remove", "discard"].includes(payload.mode)) values = values.filter(item => item !== value);
        else if (value != null && (definition.multiple || !values.includes(value))) values.push(value);
        if (values.some(item => typeof item !== "string") || definition.maximum != null && values.length > definition.maximum) fail("Число выбранных предметов выходит за границы", "LIONWING_INVENTORY_MAX");
        record.selectedItems = values.map(String); record.selectedItemId = record.selectedItems.at(-1) || null;
      } else record.selectedItemId = value == null ? null : value;
      record.selected = record.selectedItemId; record.current = record.selectedItemId; record.value = record.selectedItemId;
    } else if (operation === "remove") {
      const amount = payload.amount == null ? null : positive(payload.amount, "удаление");
      if (amount != null && numericKind(definition.kind)) {
        const available = readNumeric(record); if (available < amount) fail("Удаление превышает доступное количество", "LIONWING_INVENTORY_BALANCE");
        writeNumeric(record, available - amount);
        if (readNumeric(record) > 0) { mirrorLegacy(actor, record); emitOperation(ctx, "remove", actor.id, { itemId: id, instanceId: record.instanceId, amount, before: readNumeric(before), value: readNumeric(record), ownerActorId: actor.id, sourceDigest: definition.sourceDigest }); return { state, definition, record, removed: false, changed: true }; }
      }
      delete state.records[record.id];
      if (!Object.values(state.records).some(item => item.definitionId === definition.id)) delete state.definitions[definition.id];
      if (!record.instanceId) { actor.inventory ||= {}; delete actor.inventory[definition.id]; }
      emitOperation(ctx, "remove", actor.id, { itemId: id, instanceId: record.instanceId, ownerActorId: actor.id, sourceDigest: definition.sourceDigest, before: before.current ?? before.value ?? before.count ?? null, removed: true });
      return { state, definition, record: null, removed: true, changed: true };
    } else if (operation === "reset") {
      const targetBoundary = boundary(payload.boundary || payload.resetAt || definition.resetAt);
      if (targetBoundary !== definition.resetAt && targetBoundary !== definition.lifetime && targetBoundary !== "manual") fail("Граница не совпадает со сроком записи");
      if (numericKind(definition.kind)) writeNumeric(record, definition.initial ?? definition.minimum);
      else if (definition.kind === "recorded-value") { record.values = []; record.count = 0; record.current = null; record.value = null; }
      else { record.selectedItems = definition.multiple ? [] : record.selectedItems; record.selectedItemId = null; record.selected = null; record.current = null; record.value = null; }
    }
    mirrorLegacy(actor, record);
    emitOperation(ctx, operation, actor.id, { operation, itemId: id, instanceId: record.instanceId, kind: definition.kind, label: definition.label, ownerActorId: actor.id, sourceActorId: definition.sourceActorId, sourceEntityId: definition.sourceEntityId, ruleId: definition.ruleId, sourceDigest: definition.sourceDigest, before: before.current ?? before.value ?? before.count ?? null, value: record.current ?? record.value ?? record.count ?? null, current: record.current ?? record.value ?? record.count ?? null, maximum: definition.maximum, minimum: definition.minimum, lifetime: definition.lifetime, visibility: eventVisibility(definition.visibility) });
    return { state, definition, record, before, changed: true };
  }

  function applyOperation(scene, payload, ctx = {}) {
    if (!scene || !Array.isArray(scene.actors)) fail("Сцена не содержит участников");
    normalizeScene(scene);
    const operation = String(payload.operation || payload.action || "");
    const sourceId = ctx.sourceActorId || ctx.actorId || payload.ownerActorId || payload.targetId;
    const targetId = operation === "transfer" ? (payload.fromActorId || sourceId) : (payload.targetId || payload.ownerActorId || sourceId);
    const target = actorById(scene, targetId);
    if (!target) fail("Участник-владелец записи инвентаря отсутствует", "LIONWING_INVENTORY_OWNER");
    const role = roleFor(ctx);
    if (sourceId && sourceId !== target.id && !["narrator", "gm"].includes(role)) fail("Операция инвентаря принадлежит другому участнику", "LIONWING_INVENTORY_OWNER");
    const actorIds = [target.id, payload.fromActorId, payload.toActorId].filter(Boolean);
    const before = snapshotActors(scene, actorIds), beforeLegacy = snapshotLegacy(scene, actorIds);
    const beforeForJournal = journalSnapshots(scene, actorIds);
    const operationId = payload.operationId || ctx.operationId || ctx.eventId || `inventory:${target.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const inputFingerprint = fingerprint({ ...payload, operationId });
    const prior = actorIds.map(id => actorById(scene, id)).filter(Boolean).map(owner => inventoryState(owner).journal.find(row => row.operationId === operationId || row.eventId === operationId)).find(Boolean);
    if (prior) {
      if (prior.inputFingerprint && prior.inputFingerprint !== inputFingerprint) fail("Конфликт ID операции инвентаря", "LIONWING_INVENTORY_REPLAY");
      return { ok: true, changed: false, duplicate: true, operationId, itemId: prior.itemId || payload.id, record: clone(prior.record || null) };
    }
    try {
      if (operation === "transfer") {
        const from = actorById(scene, payload.fromActorId || sourceId), to = actorById(scene, payload.toActorId || payload.targetId);
        if (!from || !to) fail("Перевод требует существующих участников", "LIONWING_INVENTORY_OWNER");
        const id = text(payload.id || payload.itemId || payload.definitionId, "ID записи", MAX_ID), fromLookup = findRecord(from, id, payload.instanceId || null);
        if (!fromLookup.record || !fromLookup.definition) fail("Переводимая запись инвентаря отсутствует", "LIONWING_INVENTORY_MISSING");
        assertSource(scene, fromLookup.record, ctx.actorId || from.id, role);
        if (ctx.actorId && ctx.actorId !== from.id && !["narrator", "gm"].includes(role)) fail("Перевод доступен владельцу записи", "LIONWING_INVENTORY_OWNER");
        const amount = positive(payload.amount ?? 1, "перевод");
        if (!numericKind(fromLookup.definition.kind)) fail("Перевод поддерживает числовые записи и экземпляры");
        const available = readNumeric(fromLookup.record); if (available < amount) fail("Перевод превышает доступное количество", "LIONWING_INVENTORY_BALANCE");
        // A transfer creates or updates the recipient's copy using the same
        // definition contract.  Its initial value belongs to that contract;
        // using zero here would turn a valid transfer into a provenance
        // change when the recipient already has the item configured.
        const destinationExisting = findRecord(to, id, payload.instanceId || null);
        if (fromLookup.definition.unique && !fromLookup.definition.multiple && destinationExisting.record && readNumeric(destinationExisting.record) > 0) fail("Перевод конфликтует с уникальной записью получателя", "LIONWING_INVENTORY_UNIQUE");
        const destinationCurrent = destinationExisting.record ? readNumeric(destinationExisting.record) : 0;
        if (fromLookup.definition.maximum != null && destinationCurrent + amount > fromLookup.definition.maximum) fail("Перевод превышает максимум записи получателя", "LIONWING_INVENTORY_MAX");
        const destinationPayload = { ...clone(payload), operation: "configure", targetId: to.id, ownerActorId: to.id, sourceActorId: fromLookup.definition.sourceActorId, id, kind: fromLookup.definition.kind, label: fromLookup.definition.label, sourceDigest: fromLookup.definition.sourceDigest, ruleId: fromLookup.definition.ruleId, maximum: fromLookup.definition.maximum, minimum: fromLookup.definition.minimum, initial: fromLookup.definition.initial, current: destinationCurrent + amount, visibility: fromLookup.definition.visibility, lifetime: fromLookup.definition.lifetime, resetAt: fromLookup.definition.resetAt, multiple: fromLookup.definition.multiple, unique: fromLookup.definition.unique };
        const toResult = ensureRecord(scene, to, destinationPayload, { replaceExisting: true });
        writeNumeric(fromLookup.record, available - amount); mirrorLegacy(from, fromLookup.record);
        if (readNumeric(fromLookup.record) === 0 && payload.removeEmpty !== false) { delete inventoryState(from).records[fromLookup.record.id]; if (!fromLookup.record.instanceId) delete from.inventory[id]; }
        emitOperation(ctx, "transfer", from.id, { operation, itemId: id, instanceId: fromLookup.record.instanceId, fromActorId: from.id, toActorId: to.id, amount, sourceDigest: fromLookup.definition.sourceDigest, ownerActorId: from.id, visibility: eventVisibility(fromLookup.definition.visibility) });
        const afterForJournal = journalSnapshots(scene, actorIds);
        for (const ownerId of actorIds) if (actorById(scene, ownerId)) journal(inventoryState(actorById(scene, ownerId)), { schema: VERSION, operationId, eventId: ctx.eventId || null, operation: "transfer", itemId: id, inputFingerprint, before: beforeForJournal[ownerId] || null, after: afterForJournal[ownerId] || null, record: clone(toResult.record), at: ctx.at || null });
        return { ok: true, changed: true, operationId, fromActorId: from.id, toActorId: to.id, amount, record: toResult.record };
      }
      const result = mutateOne(scene, target, payload, { ...ctx, role, actorId: ctx.actorId || sourceId });
      const afterForJournal = journalSnapshots(scene, actorIds);
      journal(inventoryState(target), { schema: VERSION, operationId, eventId: ctx.eventId || null, operation, itemId: result.definition?.id || payload.id, instanceId: result.record?.instanceId || payload.instanceId || null, inputFingerprint, before: beforeForJournal[target.id] || null, after: afterForJournal[target.id] || null, record: clone(result.record || null), at: ctx.at || null });
      return { ok: true, changed: Boolean(result.changed), operationId, itemId: result.definition?.id || payload.id, record: clone(result.record || null), definition: clone(result.definition || null) };
    } catch (error) {
      restoreActors(scene, before, beforeLegacy);
      throw error;
    }
  }

  function normalizeScene(scene, options = {}) {
    for (const actor of scene?.actors || []) {
      const raw = actor.lionwing?.inventory;
      if (raw == null) continue;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) { if (options.strict) fail("Сохранённый инвентарь имеет неподдерживаемый формат"); delete actor.lionwing.inventory; continue; }
      const state = inventoryState(actor);
      if (Object.keys(state.definitions).length > MAX_DEFINITIONS || Object.keys(state.records).length > MAX_RECORDS) fail("Сохранённый реестр инвентаря переполнен");
      for (const [id, definition] of Object.entries(state.definitions)) {
        try {
          const canonical = definitionPayload(scene, actor, { ...definition, id }, definition);
          if (options.strict && canonical.ownerActorId !== actor.id) fail("Сохранённый владелец записи инвентаря недействителен", "LIONWING_INVENTORY_OWNER");
          state.definitions[id] = canonical;
        } catch (error) {
          if (options.strict) throw error;
          delete state.definitions[id];
        }
      }
      for (const [key, record] of Object.entries(state.records)) {
        const definition = state.definitions[record?.definitionId];
        if (!definition) { delete state.records[key]; continue; }
        if (record.ownerActorId && record.ownerActorId !== actor.id) { if (options.strict) fail("Сохранённый владелец записи инвентаря недействителен", "LIONWING_INVENTORY_OWNER"); delete state.records[key]; continue; }
        try { state.records[key] = recordSnapshot(definition, { ...record, instanceId: record.instanceId || null }, record); mirrorLegacy(actor, state.records[key]); }
        catch (error) { if (options.strict) throw error; delete state.records[key]; }
      }
      state.journal = Array.isArray(state.journal) ? state.journal.slice(-MAX_JOURNAL) : [];
      const reservations = {};
      for (const [key, rawReservation] of Object.entries(state.reservations || {}).slice(-MAX_RESERVATIONS)) {
        try {
          const normalized = normalizeReservation(scene, actor, key, rawReservation);
          if (reservations[normalized.id]) fail("В сохранении есть дублирующийся резерв инвентаря", "LIONWING_INVENTORY_RESERVATION");
          reservations[normalized.id] = normalized;
        } catch (error) {
          if (options.strict) throw error;
        }
      }
      state.reservations = reservations;
    }
    return scene;
  }

  function resetActor(actor, requestedBoundary, context = {}) {
    const raw = actor?.lionwing?.inventory;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const resetBoundary = boundary(requestedBoundary), state = inventoryState(actor), changed = [], resetIds = new Set();
    for (const record of Object.values(state.records)) {
      const definition = state.definitions[record.definitionId];
      if (!definition) continue;
      const due = record.resetAt === resetBoundary || record.lifetime === resetBoundary || resetBoundary === "scene" && record.lifetime === "scene";
      if (!due || record.lifetime === "persistent") continue;
      resetIds.add(record.definitionId);
      const before = record.current ?? record.value ?? record.count ?? null;
      if (numericKind(record.kind)) writeNumeric(record, record.initial ?? record.minimum);
      else if (record.kind === "recorded-value") { record.values = []; record.count = 0; record.current = null; record.value = null; }
      else { record.selectedItems = definition.multiple ? [] : record.selectedItems; record.selectedItemId = null; record.selected = null; record.current = null; record.value = null; }
      mirrorLegacy(actor, record); changed.push({ itemId: record.definitionId, instanceId: record.instanceId, before, value: record.current ?? record.value ?? record.count ?? null, boundary: resetBoundary, sourceDigest: record.sourceDigest, visibility: eventVisibility(definition.visibility) });
    }
    for (const reservation of Object.values(state.reservations || {})) {
      if (reservation.status !== "reserved" || !(reservation.costs || []).some(cost => resetIds.has(cost.itemId))) continue;
      reservation.status = "cancelled";
      reservation.cancelledAt = context.at || null;
      reservation.reason = `reset:${resetBoundary}`;
    }
    return changed;
  }
  function persistentState(actor) {
    const raw = actor?.lionwing?.inventory;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { schema: VERSION, definitions: {}, records: {}, reservations: {}, journal: [] };
    const state = inventoryState(actor), definitions = {}, records = {};
    for (const [id, definition] of Object.entries(state.definitions)) if (definition.lifetime === "persistent" || definition.resetAt === "persistent") definitions[id] = clone(definition);
    for (const [key, record] of Object.entries(state.records)) if (definitions[record.definitionId]) records[key] = clone(record);
    return { schema: VERSION, definitions, records, reservations: {}, journal: [] };
  }
  function resetScene(scene) {
    for (const actor of scene?.actors || []) {
      const previousIds = Object.keys(actor.lionwing?.inventory?.definitions || {}), kept = persistentState(actor);
      actor.lionwing ||= {};
      if (Object.keys(kept.definitions).length || Object.keys(kept.records).length) actor.lionwing.inventory = kept;
      else delete actor.lionwing.inventory;
      actor.inventory ||= {};
      for (const id of previousIds) delete actor.inventory[id];
      syncLegacy(actor);
    }
    return scene;
  }
  function removeSource(scene, sourceId) {
    if (!sourceId) return [];
    const removed = [];
    for (const actor of scene?.actors || []) {
      const raw = actor?.lionwing?.inventory;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const state = inventoryState(actor);
      const removedIds = new Set();
      for (const [key, record] of Object.entries(state.records)) if (record.sourceActorId === sourceId || record.sourceEntityId === sourceId) {
        delete state.records[key]; removedIds.add(record.definitionId); removed.push({ actorId: actor.id, itemId: record.definitionId, instanceId: record.instanceId, sourceId });
      }
      for (const reservation of Object.values(state.reservations || {})) if (reservation.status === "reserved" && (reservation.costs || []).some(cost => removedIds.has(cost.itemId))) {
        reservation.status = "cancelled";
        reservation.reason = "source-removed";
      }
      for (const id of Object.keys(state.definitions)) if (!Object.values(state.records).some(record => record.definitionId === id)) delete state.definitions[id];
      actor.inventory ||= {};
      for (const id of removedIds) {
        if (!Object.values(state.records).some(record => record.definitionId === id && !record.instanceId)) delete actor.inventory[id];
      }
    }
    return removed;
  }

  function status(scene, actorId, payload = {}) {
    normalizeScene(scene);
    const actor = actorById(scene, actorId), id = payload.id || payload.itemId || payload.definitionId;
    if (!actor || !id) return { available: false, reason: "Запись инвентаря не выбрана" };
    const lookup = findRecord(actor, id, payload.instanceId || null);
    if (!lookup.definition || !lookup.record) return { available: false, reason: "Запись инвентаря не настроена", itemId: id };
    const amount = Number(payload.amount ?? 1), current = numericKind(lookup.definition.kind) ? readNumeric(lookup.record) : null;
    const reserved = numericKind(lookup.definition.kind) ? Object.values(lookup.state.reservations || {}).filter(reservation => reservation.status === "reserved").flatMap(reservation => reservation.costs || []).filter(item => item.itemId === id && (item.instanceId || null) === (lookup.record.instanceId || null)).reduce((sum, item) => sum + Number(item.amount || 0), 0) : 0;
    let reason = "";
    if (payload.operation === "spend" && (!Number.isSafeInteger(amount) || amount < 1 || current - reserved < amount)) reason = `Недостаточно ${lookup.definition.label}`;
    if (payload.operation === "gain" && lookup.definition.maximum != null && current + amount > lookup.definition.maximum) reason = "Получение превышает максимум записи";
    return { available: !reason, reason, itemId: id, instanceId: lookup.record.instanceId, kind: lookup.definition.kind, label: lookup.definition.label, current, reserved, availableAmount: numericKind(lookup.definition.kind) ? Math.max(0, current - reserved) : null, value: lookup.record.value, minimum: lookup.definition.minimum, maximum: lookup.definition.maximum, canSpend: numericKind(lookup.definition.kind) && current - reserved > 0, canGain: numericKind(lookup.definition.kind) && (lookup.definition.maximum == null || current < lookup.definition.maximum), definition: clone(lookup.definition), record: clone(lookup.record) };
  }

  // Inventory definitions may name an existing Focus/AP or rule-resource
  // replacement as their cost source. Keep that resource in its established
  // contract: this adapter only quotes availability and leaves the actual
  // balance mutation to the Scene engine.
  function alternateResourceStatus(scene, actorId, payload = {}) {
    const actor = actorById(scene, actorId), id = payload.id || payload.itemId || payload.definitionId;
    if (!actor || !id) return { available: false, reason: "Запись инвентаря не выбрана", itemId: id || null };
    const lookup = findRecord(actor, id, payload.instanceId || null);
    if (!lookup.definition || !lookup.record) return { available: false, reason: "Запись инвентаря не настроена", itemId: id };
    const resource = payload.resource || lookup.definition.alternateResource;
    if (!resource) return { available: false, reason: "Для записи не задан альтернативный ресурс", itemId: id, definition: clone(lookup.definition), record: clone(lookup.record) };
    const delegate = global.DAWN_SCENE_ENGINE?.alternateResourceStatus;
    const delegated = typeof delegate === "function"
      ? delegate(scene, actorId, { ...payload, resource, amount: payload.amount ?? 1 })
      : { available: false, reason: "Проверка альтернативного ресурса недоступна" };
    return { ...clone(delegated), itemId: id, instanceId: lookup.record.instanceId, alternateResource: resource, definition: clone(lookup.definition), record: clone(lookup.record), sourceDigest: lookup.definition.sourceDigest };
  }

  function prepareCost(scene, actorId, costs, options = {}) {
    normalizeScene(scene);
    const actor = actorById(scene, actorId); if (!actor) fail("Участник для резерва записи отсутствует");
    if (!Array.isArray(costs) || !costs.length || costs.length > 32) fail("Некорректный список стоимости инвентаря");
    const pending = new Map(), normalized = costs.map(cost => {
      const itemId = cost.itemId || cost.id || (typeof cost.resource === "string" && cost.resource.startsWith("inventory:") ? cost.resource.slice("inventory:".length) : typeof cost.resource === "string" && findDefinition(actor, cost.resource) ? cost.resource : null);
      if (!itemId) fail("Часть стоимости не указывает запись инвентаря");
      const amount = positive(cost.amount, "стоимость записи");
      const lookup = findRecord(actor, itemId, cost.instanceId || null);
      if (!lookup.definition || !lookup.record || !numericKind(lookup.definition.kind)) fail("Часть стоимости недоступна");
      const key = `${itemId}#${lookup.record.instanceId || ""}`;
      const held = Object.values(inventoryState(actor).reservations || {}).filter(reservation => reservation.status === "reserved" && reservation.id !== options.reservationId).flatMap(reservation => reservation.costs || []).filter(item => item.itemId === itemId && (item.instanceId || null) === (lookup.record.instanceId || null)).reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(pending.get(key) || 0);
      const available = readNumeric(lookup.record) - held; if (available < amount) fail(`Недостаточно ${lookup.definition.label}: нужно ${amount}, доступно ${Math.max(0, available)}`, "LIONWING_INVENTORY_BALANCE");
      pending.set(key, Number(pending.get(key) || 0) + amount);
      return { itemId, instanceId: lookup.record.instanceId, amount, sourceDigest: lookup.definition.sourceDigest };
    });
    const reservationId = text(options.reservationId || `inventory-reservation:${actorId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, "ID резерва", MAX_ID);
    return { schema: VERSION, id: reservationId, reservationId, actorId, sceneVersion: Number(scene.version || 0), costs: normalized, status: "reserved", operationId: options.operationId || null, createdAt: options.createdAt || null };
  }
  function reserve(scene, actorId, costs, options = {}) {
    const actor = actorById(scene, actorId); if (!actor) fail("Участник для резерва записи отсутствует");
    const reservation = prepareCost(scene, actorId, costs, options), state = inventoryState(actor);
    if (state.reservations[reservation.id] && fingerprint(state.reservations[reservation.id]) !== fingerprint(reservation)) fail("Конфликт ID резерва инвентаря");
    state.reservations[reservation.id] = reservation;
    return clone(reservation);
  }
  function commitReservation(scene, actorId, reservationId, ctx = {}) {
    const actor = actorById(scene, actorId); if (!actor) fail("Участник для резерва записи отсутствует");
    const state = inventoryState(actor), reservation = state.reservations[reservationId];
    if (!reservation) fail("Резерв инвентаря не найден", "LIONWING_INVENTORY_RESERVATION");
    if (reservation.actorId !== actorId || reservation.status === "cancelled") fail("Резерв инвентаря принадлежит другому участнику", "LIONWING_INVENTORY_OWNER");
    if (reservation.status === "committed") return { ok: true, duplicate: true, reservation: clone(reservation) };
    const before = snapshotActors(scene, [actorId]), beforeLegacy = snapshotLegacy(scene, [actorId]);
    const emitted = [], operationContext = { ...ctx, emit: (...args) => emitted.push(args) };
    try {
        for (const cost of reservation.costs) mutateOne(scene, actor, { operation: "spend", id: cost.itemId, instanceId: cost.instanceId, amount: cost.amount }, { ...operationContext, actorId, sourceActorId: actorId, reservationId });
      reservation.status = "committed"; reservation.committedAt = ctx.at || null;
      if (typeof ctx.emit === "function") for (const args of emitted) ctx.emit(...args);
      emitOperation(ctx, "commit", actorId, { reservationId, actorId, costs: clone(reservation.costs), sourceDigest: reservation.costs.map(cost => cost.sourceDigest), visibility: "gm" });
      return { ok: true, reservation: clone(reservation) };
    } catch (error) { restoreActors(scene, before, beforeLegacy); throw error; }
  }
  function cancelReservation(scene, actorId, reservationId, ctx = {}) {
    const actor = actorById(scene, actorId); if (!actor) fail("Участник для резерва записи отсутствует");
    const state = inventoryState(actor), reservation = state.reservations[reservationId];
    if (!reservation || reservation.actorId !== actorId) fail("Резерв инвентаря принадлежит другому участнику", "LIONWING_INVENTORY_OWNER");
    if (reservation.status === "committed") fail("Нельзя отменить уже подтверждённый резерв");
    reservation.status = "cancelled"; emitOperation(ctx, "cancel", actorId, { reservationId, actorId, visibility: "gm" });
    return { ok: true, reservation: clone(reservation) };
  }
  function applyCosts(scene, actorId, costs, ctx = {}) {
    const actor = actorById(scene, actorId); if (!actor) fail("Участник для стоимости записи отсутствует");
    if (!Array.isArray(costs) || !costs.length || costs.length > 32) fail("Некорректный список стоимости инвентаря");
    const before = snapshotActors(scene, [actorId]), beforeLegacy = snapshotLegacy(scene, [actorId]);
    const emitted = [], operationContext = { ...ctx, emit: (...args) => emitted.push(args) };
    try {
      const normalized = (costs || []).map(cost => ({ operation: "spend", id: cost.itemId || cost.id || String(cost.resource || "").replace(/^inventory:/u, ""), instanceId: cost.instanceId || null, amount: cost.amount }));
      const results = normalized.map(cost => mutateOne(scene, actor, cost, { ...operationContext, actorId, sourceActorId: actorId }));
      if (typeof ctx.emit === "function") for (const args of emitted) ctx.emit(...args);
      return { ok: true, results };
    } catch (error) { restoreActors(scene, before, beforeLegacy); throw error; }
  }

  function project(scene, viewer = {}) {
    const normalizedScene = clone(scene);
    normalizeScene(normalizedScene);
    const narrator = ["narrator", "gm"].includes(viewer.role);
    const ownActors = new Set(Array.isArray(viewer.actorIds) ? viewer.actorIds : viewer.actorId ? [viewer.actorId] : []);
    const result = {};
    for (const actor of normalizedScene?.actors || []) {
      const state = actor.lionwing?.inventory;
      if (!state || typeof state !== "object") continue;
      const allowed = record => narrator || record.visibility === "public" || record.visibility === "owner" && ownActors.has(actor.id);
      const definitions = Object.fromEntries(Object.entries(state.definitions || {}).filter(([, definition]) => definition.active !== false && allowed(definition)).map(([id, definition]) => [id, clone(definition)]));
      const records = Object.fromEntries(Object.entries(state.records || {}).filter(([, record]) => definitions[record.definitionId] && allowed(record)).map(([id, record]) => [id, clone(record)]));
      result[actor.id] = { schema: VERSION, actorId: actor.id, definitions, records };
      if (narrator) { result[actor.id].reservations = clone(state.reservations || {}); result[actor.id].journal = clone(state.journal || []); }
    }
    return result;
  }
  function exportInventory(scene, viewer = { role: "narrator" }) { return clone(project(scene, viewer)); }
  function importInventory(scene, payload, options = {}) {
    if (![
      "narrator", "gm",
    ].includes(options.role)) fail("Импорт инвентаря доступен только Нарратору");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("Импорт инвентаря имеет неподдерживаемый формат");
    const before = snapshotActors(scene, Object.keys(payload)), beforeLegacy = snapshotLegacy(scene, Object.keys(payload));
    try {
      for (const [actorId, incoming] of Object.entries(payload)) {
        const actor = actorById(scene, actorId); if (!actor) fail("Импорт содержит неизвестного владельца");
        actor.lionwing ||= {}; actor.lionwing.inventory = clone(incoming); normalizeScene(scene, { strict: true });
      }
      return { ok: true, scene, changed: true };
    } catch (error) { restoreActors(scene, before, beforeLegacy); throw error; }
  }
  function replay(scene, event, options = {}) {
    const payload = typeof event === "string" ? JSON.parse(event) : clone(event);
    if (!payload || typeof payload !== "object") fail("Событие инвентаря имеет неподдерживаемый формат");
    const operation = payload.payload && payload.payload.operation ? payload.payload : payload;
    const operationId = payload.operationId || payload.id || operation.operationId;
    if (typeof operationId !== "string" || !operationId.trim()) fail("Повтор инвентаря требует стабильный ID операции", "LIONWING_INVENTORY_REPLAY");
    const owner = payload.actorId || operation.targetId || operation.ownerActorId;
    const actor = actorById(scene, owner), state = actor && inventoryState(actor);
    const existing = state?.journal?.find(row => row.operationId === operationId || row.eventId === operationId);
    if (existing) return { ok: true, scene: clone(scene), event: clone(existing), replayed: true, idempotent: true };
    return { ...applyOperation(scene, { ...clone(operation), operationId }, { ...options, actorId: owner, sourceActorId: owner, eventId: operationId }), replayed: false, idempotent: false };
  }
  function undo(scene, eventOrId, options = {}) {
    const id = typeof eventOrId === "string" ? eventOrId : eventOrId?.operationId || eventOrId?.id;
    if (!id) fail("Откат инвентаря требует ID операции");
    const owners = options.actorId ? [options.actorId] : (scene?.actors || []).map(actor => actor.id);
    for (const actorId of owners) {
      const actor = actorById(scene, actorId), state = actor && inventoryState(actor), row = state?.journal?.find(item => item.operationId === id || item.eventId === id);
      if (!row) continue;
      if (row.after && fingerprint(journalSnapshot(actor.lionwing.inventory)) !== fingerprint(row.after)) fail("Откат инвентаря устарел: состояние уже изменилось");
      const currentDefinitionIds = Object.keys(actor.lionwing.inventory?.definitions || {});
      const restoredDefinitionIds = Object.keys(row.before?.definitions || {});
      if (row.before == null) delete actor.lionwing.inventory;
      else actor.lionwing.inventory = clone(row.before);
      actor.inventory ||= {};
      for (const definitionId of new Set([...currentDefinitionIds, ...restoredDefinitionIds])) delete actor.inventory[definitionId];
      if (row.before) syncLegacy(actor);
      return { ok: true, scene, event: clone(row), undone: true };
    }
    fail("Операция инвентаря для отката не найдена");
  }

  const api = Object.freeze({
    VERSION, KINDS, KIND_ALIASES, VISIBILITY, BOUNDARIES,
    inventoryState, normalizeScene, applyOperation, apply: applyOperation, status, operationStatus: status,
    prepareCost, reserve, commitReservation, cancelReservation, applyCosts,
    resetActor, persistentState, resetScene, removeSource, syncLegacy,
    project, projectScene: project, alternateResourceStatus, exportInventory, export: exportInventory, importInventory, import: importInventory,
    replay, undo, fieldFor, readNumeric,
  });
  global.DAWN_LIONWING_INVENTORY = api;
})(typeof window === "object" ? window : globalThis);
