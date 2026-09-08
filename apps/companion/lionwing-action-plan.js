"use strict";

// A declarative ActionPlan foundation.  This file deliberately does not
// dispatch an event, spend a resource, roll dice, move an actor, or run a
// Technique.  It gives the reducer a strict JSON boundary at which those
// existing families can be composed later.
(function exposeLionwingActionPlan(global) {
  const KIND = "lionwing.action-plan";
  const QUOTE_KIND = "lionwing.action-plan.quote";
  const ROOT_KIND = "lionwing.action-root";
  const SCHEMA = 1;
  const PHASES = ["before", "replace", "apply", "after"];
  const STATUSES = ["draft", "targeting", "modifiers", "previewed", "committed", "cancelled", "invalid"];
  const OPEN_STATUSES = new Set(["draft", "targeting", "modifiers", "previewed"]);
  const DERIVED_KEYS = new Set(["total", "totals", "effective", "result", "outcomes", "quote", "computed", "computedTotal", "final", "finalValue", "consumedModifierIds"]);
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const MODIFIER_TYPES = new Set(["add", "multiply", "cap", "replace", "grant-exception"]);
  const STACKING_POLICIES = new Set(["stack", "exclusive", "replace", "highest", "lowest", "unique"]);
  const CONSUME_BOUNDARIES = new Set(["never", "before", "replace", "apply", "after", "commit", "perTarget", "action", "rootAction"]);
  const LIFETIMES = new Set(["default", "action", "rootAction", "startTurn", "endTurn", "nextTurn", "startNextOwnerTurn", "endNextOwnerTurn", "roundEnd", "scene", "persistent", "manual", "turn", "round", "chapter", "session", "perTarget", "commit"]);
  const OPERATION_LIMIT = 192;
  const TARGET_LIMIT = 40;
  const MODIFIER_LIMIT = 96;
  const REVISION_LIMIT = 96;

  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const plain = value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    try {
      const prototype = Object.getPrototypeOf(value);
      return prototype === null || prototype === Object.prototype || prototype?.constructor?.name === "Object";
    } catch {
      return false;
    }
  };
  const fail = message => { throw new Error(message); };

  function assertJson(value, path = "$", depth = 0, seen = new Set()) {
    if (depth > 20) fail(`Слишком глубокий JSON: ${path}`);
    if (value === null) return value;
    const type = typeof value;
    if (type === "string") {
      if (value.length > 12000) fail(`Слишком длинная строка: ${path}`);
      return value;
    }
    if (type === "number") {
      if (!Number.isFinite(value)) fail(`Число должно быть конечным: ${path}`);
      return value;
    }
    if (type === "boolean") return value;
    if (type !== "object") fail(`Значение не является JSON: ${path}`);
    if (seen.has(value)) fail(`Циклический JSON: ${path}`);
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > 512) fail(`Слишком длинный массив: ${path}`);
      value.forEach((item, index) => assertJson(item, `${path}[${index}]`, depth + 1, seen));
    } else {
      if (!plain(value)) fail(`Ожидался обычный JSON-объект: ${path}`);
      const keys = Object.keys(value);
      if (keys.length > 256) fail(`Слишком много полей: ${path}`);
      for (const key of keys) {
        if (FORBIDDEN_KEYS.has(key)) fail(`Запрещённое поле JSON: ${path}.${key}`);
        assertJson(value[key], `${path}.${key}`, depth + 1, seen);
      }
    }
    seen.delete(value);
    return value;
  }

  function copy(value) {
    assertJson(value);
    return JSON.parse(JSON.stringify(value));
  }

  function stringValue(value, label, { optional = false, max = 180 } = {}) {
    if (value == null && optional) return null;
    if (typeof value !== "string" || !value || value.length > max) fail(`Некорректный текст: ${label}`);
    return value;
  }

  function numberValue(value, label, { integer = false, min = -1000000000, max = 1000000000 } = {}) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || integer && !Number.isSafeInteger(value)) fail(`Некорректное число: ${label}`);
    return value;
  }

  function integerValue(value, label, options = {}) {
    return numberValue(value, label, { ...options, integer: true });
  }

  function arrayValue(value, label, max = TARGET_LIMIT) {
    if (!Array.isArray(value) || value.length > max) fail(`Некорректный массив: ${label}`);
    return value;
  }

  function idValue(value, label, optional = false) {
    return stringValue(value, label, { optional });
  }

  function uniqueIds(value, label, max = TARGET_LIMIT) {
    const values = arrayValue(value || [], label, max);
    const result = [];
    const seen = new Set();
    for (const item of values) {
      const id = idValue(item, `${label} ID`);
      if(seen.has(id))fail(`Повтор ID в ${label}: ${id}`);
      seen.add(id);result.push(id);
    }
    return result;
  }

  function normalizePhase(value, label = "фаза") {
    if (!PHASES.includes(value)) fail(`Неизвестная ${label}`);
    return value;
  }

  function normalizeStatus(value, label = "статус") {
    if (!STATUSES.includes(value)) fail(`Неизвестный ${label}`);
    return value;
  }

  function normalizeBoundary(value) {
    const aliases = {
      "on-before": "before",
      "on-replace": "replace",
      "on-apply": "apply",
      "on-after": "after",
      "on-commit": "commit",
      "per-target": "perTarget",
      "root-action": "rootAction",
      "onAction": "action",
      "onRootAction": "rootAction",
    };
    const result = aliases[value] || value;
    if (!CONSUME_BOUNDARIES.has(result)) fail("Неизвестная граница потребления модификатора");
    return result;
  }

  function normalizeLifetime(value, defaults = {}) {
    if (value == null) return "action";
    if (typeof value === "string") {
      const aliases = {
        "start-next-owner-turn": "startNextOwnerTurn",
        "end-next-owner-turn": "endNextOwnerTurn",
        "nextOwnerTurnStart": "startNextOwnerTurn",
        "nextOwnerTurnEnd": "endNextOwnerTurn",
        "startNextTurn": "startNextOwnerTurn",
        "endNextTurn": "endNextOwnerTurn",
      };
      const result = aliases[value] || value;
      if (!LIFETIMES.has(result)) fail("Неизвестный срок жизни модификатора");
      return result;
    }
    if (!plain(value)) fail("Срок жизни модификатора должен быть строкой или объектом");
    const boundary = value.boundary ?? value.kind ?? value.phase;
    if (!["startNextOwnerTurn", "endNextOwnerTurn"].includes(boundary)) fail("Объектный срок жизни требует границу собственного Хода");
    const ownerActorId = idValue(value.ownerActorId ?? value.boundaryOwnerId ?? defaults.ownerActorId, "владелец границы срока");
    const ownerTurnSerial = integerValue(value.ownerTurnSerial ?? value.serial ?? value.turnSerial ?? defaults.ownerTurnSerial, "номер собственного Хода", { min: 0, max: 1000000000 });
    const sceneSerial = integerValue(value.sceneSerial ?? defaults.sceneSerial ?? 1, "номер Сцены", { min: 0, max: 1000000000 });
    const ownerTurnInstanceId = value.ownerTurnInstanceId ?? value.turnInstanceId ?? defaults.ownerTurnInstanceId ?? null;
    if (ownerTurnInstanceId != null) idValue(ownerTurnInstanceId, "экземпляр собственного Хода");
    return {
      schema: 1,
      kind: "turn-boundary",
      boundary,
      ownerActorId,
      ownerTurnSerial,
      ownerTurnKey: `${sceneSerial}:${ownerActorId}:${ownerTurnSerial}`,
      sceneSerial,
      ownerTurnInstanceId,
    };
  }

  function normalizeSource(value, fallbackId = null) {
    let raw = value;
    if (raw == null && fallbackId != null) raw = { id: fallbackId, actorId: fallbackId, kind: "actor" };
    if (typeof raw === "string") raw = { id: raw };
    if (!plain(raw)) fail("ActionPlan требует источник правила");
    const sourceId = idValue(raw.id ?? raw.sourceId ?? raw.actorId ?? raw.entityId, "источник");
    const kind = stringValue(raw.kind ?? (raw.actorId ? "actor" : raw.entityId ? "entity" : "rule"), "вид источника", { max: 64 });
    const result = { id: sourceId, kind };
    const actorId = raw.actorId ?? raw.sourceActorId;
    const entityId = raw.entityId ?? raw.sourceEntityId;
    const ruleId = raw.ruleId;
    const causeEventId = raw.causeEventId ?? raw.eventId;
    if (actorId != null) result.actorId = idValue(actorId, "актор источника");
    if (entityId != null) result.entityId = idValue(entityId, "сущность источника");
    if (ruleId != null) result.ruleId = idValue(ruleId, "правило источника");
    if (causeEventId != null) result.causeEventId = idValue(causeEventId, "событие источника");
    if (raw.metadata != null) {
      if (!plain(raw.metadata)) fail("Метаданные источника должны быть объектом");
      result.metadata = copy(raw.metadata);
    }
    return result;
  }

  function normalizeOwner(value, source) {
    let raw = value;
    if (raw == null) raw = source?.actorId || source?.id;
    if (typeof raw === "string") raw = { id: raw, actorId: raw === "scene" ? null : raw };
    if (!plain(raw)) fail("ActionPlan требует владельца правила");
    const ownerId = idValue(raw.id ?? raw.ownerId ?? raw.ownerActorId ?? raw.actorId, "владелец");
    const result = { id: ownerId, kind: stringValue(raw.kind ?? (raw.actorId ? "actor" : ownerId === "scene" ? "scene" : "entity"), "вид владельца", { max: 64 }) };
    const actorId = raw.actorId ?? raw.ownerActorId;
    const entityId = raw.entityId ?? raw.ownerEntityId;
    if (actorId != null) result.actorId = idValue(actorId, "актор-владелец");
    if (entityId != null) result.entityId = idValue(entityId, "сущность-владелец");
    return result;
  }

  function normalizePoint(value, label = "клетка") {
    if (!plain(value)) fail(`${label} должна быть объектом`);
    const space = idValue(value.space ?? value.spaceId, `${label}: пространство`);
    const x = integerValue(value.x, `${label}: X`, { min: 0, max: 1000000 });
    const y = integerValue(value.y, `${label}: Y`, { min: 0, max: 1000000 });
    return { space, x, y };
  }

  function normalizeAnchor(value) {
    if (value == null) return null;
    if (!plain(value)) fail("Якорь ActionPlan должен быть объектом");
    const rawKind = value.kind ?? (value.actorId ? "actor" : value.markerId ? "marker" : value.entityId ? "entity" : "cell");
    const kind = stringValue(rawKind, "вид якоря", { max: 32 });
    if (!["actor", "marker", "entity", "cell"].includes(kind)) fail("Неизвестный вид геометрического якоря");
    const result = { kind };
    const sourceId = value.id ?? value.actorId ?? value.markerId ?? value.entityId ?? value.sourceId;
    if (kind !== "cell") result.id = idValue(sourceId, "ID якоря");
    const point = normalizePoint(value, "якорь");
    result.space = point.space;
    result.x = point.x;
    result.y = point.y;
    return result;
  }

  function normalizeCells(value, label = "клетки") {
    if (value == null) return [];
    const cells = arrayValue(value, label, 512).map((item, index) => normalizePoint(item, `${label} ${index + 1}`));
    const seen = new Set();
    return cells.filter(cell => {
      const key = `${cell.space}:${cell.x},${cell.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.space.localeCompare(b.space) || a.y - b.y || a.x - b.x);
  }

  function normalizeGeometry(input) {
    const raw = input == null ? null : input;
    if (raw == null) return null;
    if (!plain(raw)) fail("Геометрия ActionPlan должна быть объектом");
    const result = {};
    const anchor = raw.anchor ?? raw.origin;
    if (anchor != null) result.anchor = normalizeAnchor(anchor);
    if (raw.route != null) {
      if (!plain(raw.route)) fail("Маршрут ActionPlan должен быть объектом");
      result.route = copy(raw.route);
    }
    if (raw.footprint != null) {
      if (!plain(raw.footprint)) fail("Габарит ActionPlan должен быть объектом");
      const width = integerValue(raw.footprint.width ?? raw.width, "ширина габарита", { min: 1, max: 1000 });
      const height = integerValue(raw.footprint.height ?? raw.height, "высота габарита", { min: 1, max: 1000 });
      result.footprint = { width, height, cells: normalizeCells(raw.footprint.cells, "клетки габарита") };
    } else if (raw.width != null || raw.height != null || raw.cells != null) {
      const width = integerValue(raw.width, "ширина габарита", { min: 1, max: 1000 });
      const height = integerValue(raw.height, "высота габарита", { min: 1, max: 1000 });
      result.footprint = { width, height, cells: normalizeCells(raw.cells, "клетки габарита") };
    }
    if (raw.targetCells != null || raw.cells != null && !result.footprint) result.targetCells = normalizeCells(raw.targetCells ?? raw.cells, "целевые клетки");
    if (raw.sceneVersion != null) result.sceneVersion = integerValue(raw.sceneVersion, "версия Сцены", { min: 0, max: 1000000000 });
    if (raw.geometryStamp != null) result.geometryStamp = stringValue(raw.geometryStamp, "снимок геометрии", { max: 512 });
    if (!Object.keys(result).length) fail("Пустая геометрия ActionPlan");
    return result;
  }

  function normalizeCostParts(value, { allowEmpty = false } = {}) {
    if (value == null) return [];
    const parts = arrayValue(value, "цена", 16);
    if (!parts.length) {
      if (!allowEmpty) fail("Явная составная цена должна содержать хотя бы одну часть");
      return [];
    }
    const execution = global.DAWN_LIONWING_EXECUTION;
    if (typeof execution?.normalizeCosts === "function") return copy(execution.normalizeCosts(parts));
    if (!parts.length) fail("Явная составная цена должна содержать хотя бы одну часть");
    return parts.map((part, index) => {
      if (!plain(part) || !["resource", "health"].includes(part.kind)) fail("Неизвестная часть составной цены ActionPlan");
      const amount = integerValue(part.amount, `цена ${index + 1}`, { min: 0, max: 9999 });
      if (part.kind === "health") {
        const mode = part.mode ?? "spend";
        if (!["spend", "lose"].includes(mode)) fail("Неизвестный способ потери Здоровья");
        return { kind: "health", mode, amount };
      }
      return { kind: "resource", resource: idValue(part.resource, `ресурс ${index + 1}`), amount };
    }).filter(part => part.amount > 0);
  }

  function normalizeDicePolicy(value) {
    if (value == null) return null;
    if (!plain(value)) fail("Политика броска ActionPlan должна быть объектом");
    for (const key of ["hits", "successes", "criticals", "crits", "finalFaces", "sourceFaces", "rolls", "result", "total"]) if (own(value, key)) fail("Готовый итог броска нельзя подставить в ActionPlan");
    const kind = stringValue(value.kind ?? "check", "вид броска", { max: 32 });
    if(!["check","opposed","raw-d6"].includes(kind))fail("Неизвестный вид броска ActionPlan");
    const pool = integerValue(value.pool ?? value.initialCount ?? 0, "исходный пул", { min: 0, max: 100 });
    const successAt = integerValue(value.successAt ?? 4, "порог успеха", { min: 2, max: 6 });
    const criticalAt = integerValue(value.criticalAt ?? value.critAt ?? 6, "порог Крита", { min: 5, max: 6 });
    const result = { kind, pool, successAt, criticalAt, explode: value.explode !== false };
    if(kind==="raw-d6"&&result.explode)fail("Сырая D6 не поддерживает взрывающиеся Крити");
    if (value.attribute != null) result.attribute = idValue(value.attribute, "Атрибут броска");
    if (value.formula != null) result.formula = stringValue(value.formula, "формула броска", { max: 180 });
    if (value.modifications != null) {
      if (!Array.isArray(value.modifications) || value.modifications.length) fail("Модификации пула принадлежат отдельному контракту броска");
      result.modifications = [];
    }
    return result;
  }

  function normalizeTargets(input) {
    const source = input.targets ?? input.snapshots?.targets ?? null;
    const targetIdsInput = input.targetIds ?? null;
    const snapshotsInput = input.targetSnapshots ?? input.snapshots?.targetSnapshots ?? null;
    const snapshots = new Map();
    if (snapshotsInput != null) {
      if (Array.isArray(snapshotsInput)) {
        for (const [index, item] of snapshotsInput.entries()) {
          if (!plain(item)) fail(`Снимок цели ${index + 1} должен быть объектом`);
          const targetId = idValue(item.targetId ?? item.id, `снимок цели ${index + 1}`);
          snapshots.set(targetId, copy(item.snapshot ?? item.values ?? {}));
        }
      } else if (plain(snapshotsInput)) {
        for (const [targetId, snapshot] of Object.entries(snapshotsInput)) {
          idValue(targetId, "ID снимка цели");
          if (!plain(snapshot)) fail("Снимок цели должен быть объектом");
          snapshots.set(targetId, copy(snapshot));
        }
      } else fail("Снимки целей должны быть массивом или объектом");
    }
    const rows = [];
    if (source != null) {
      if (Array.isArray(source)) {
        for (const [index, item] of source.entries()) {
          if (typeof item === "string") rows.push({ targetId: idValue(item, `цель ${index + 1}`), snapshot: snapshots.get(item) || {} });
          else {
            if (!plain(item)) fail(`Цель ${index + 1} должна быть объектом или ID`);
            const targetId = idValue(item.targetId ?? item.id, `цель ${index + 1}`);
            const snapshot = item.snapshot ?? item.values ?? snapshots.get(targetId) ?? {};
            if (!plain(snapshot)) fail(`Снимок цели ${targetId} должен быть объектом`);
            rows.push({ targetId, snapshot: copy(snapshot), ...(item.role != null ? { role: stringValue(item.role, `роль цели ${targetId}`, { max: 64 }) } : {}) });
          }
        }
      } else if (plain(source)) {
        for (const [targetId, snapshot] of Object.entries(source)) {
          idValue(targetId, "ID цели");
          if (!plain(snapshot)) fail(`Снимок цели ${targetId} должен быть объектом`);
          rows.push({ targetId, snapshot: copy(snapshot) });
        }
      } else fail("Цели должны быть массивом или объектом снимков");
    }
    if (targetIdsInput != null) {
      const ids = uniqueIds(targetIdsInput, "цели");
      for (const targetId of ids) if (!rows.some(row => row.targetId === targetId)) rows.push({ targetId, snapshot: snapshots.get(targetId) || {} });
      const sourceIds = rows.map(row => row.targetId);
      if (source != null && JSON.stringify(sourceIds) !== JSON.stringify(ids)) fail("Список targetIds расходится со снимками целей");
    }
    const result = [];
    const seen = new Set();
    for (const row of rows) {
      if (seen.has(row.targetId)) fail(`Повторная цель ActionPlan: ${row.targetId}`);
      seen.add(row.targetId);
      result.push(row);
    }
    if (result.length > TARGET_LIMIT) fail("В ActionPlan слишком много целей");
    return result;
  }

  function assertTargetAliasesAgree(input) {
    if (input.targets == null || input.snapshots?.targets == null) return;
    const top = normalizeTargets({ targets: input.targets, targetIds: input.targetIds });
    const nested = normalizeTargets({ targets: input.snapshots.targets, targetIds: input.targetIds });
    if (JSON.stringify(top) !== JSON.stringify(nested)) fail("Снимки целей расходятся");
  }

  function normalizeOperation(raw, phase, index) {
    if (!plain(raw)) fail(`Операция ${phase}:${index + 1} должна быть объектом`);
    const kind = stringValue(raw.kind ?? raw.type, `вид операции ${phase}:${index + 1}`, { max: 96 });
    const id = idValue(raw.id ?? `${phase}:${index + 1}`, `ID операции ${phase}:${index + 1}`);
    const result = { id, kind };
    if (raw.targetId != null) result.targetId = idValue(raw.targetId, `цель операции ${id}`);
    if (raw.sourceId != null) result.sourceId = idValue(raw.sourceId, `источник операции ${id}`);
    if (raw.payload != null) {
      if (!plain(raw.payload)) fail(`payload операции ${id} должен быть объектом`);
      result.payload = copy(raw.payload);
    }
    if (raw.data != null) result.data = copy(raw.data);
    if (raw.label != null) result.label = stringValue(raw.label, `название операции ${id}`, { max: 240 });
    // Keep the fields consumed by the existing common reducer alongside the
    // strict operation envelope.  ActionPlan still never interprets these
    // values as outcomes; it only carries them into the execution sequence.
    for (const key of ["amount", "value", "resource", "operation", "mode", "track", "sourceActorId", "actorId", "targetIds", "effects", "effect", "actionId", "swift", "reaction", "destination", "maximum", "width", "height", "geometryPlan", "roll", "cost", "repeat", "targetDamage", "ignoreArmor", "ignoreEvasion", "finalDamage", "attack", "reduction", "temporaryArmor", "preventForcedMovement", "irreducible", "forced", "placement", "remove", "options"]) {
      if (!own(raw, key)) continue;
      assertJson(raw[key], `$.${phase}.${id}.${key}`);
      result[key] = copy(raw[key]);
    }
    if (raw.phase != null && raw.phase !== phase) fail(`Операция ${id} находится не в своей фазе`);
    return result;
  }

  function normalizePhases(input) {
    if (input.phases != null && !plain(input.phases)) fail("Фазы ActionPlan должны быть объектом");
    const raw = input.phases && plain(input.phases) ? input.phases : {};
    for (const key of Object.keys(raw)) if (!PHASES.includes(key)) fail(`Неизвестная фаза ActionPlan: ${key}`);
    const legacyOperations = input.operations;
    const result = {};
    let count = 0;
    for (const phase of PHASES) {
      let values = raw[phase] ?? input[phase] ?? [];
      if (phase === "apply" && legacyOperations != null && !raw.apply && input.apply == null) values = legacyOperations;
      values = arrayValue(values, `операции ${phase}`, OPERATION_LIMIT);
      result[phase] = values.map((item, index) => normalizeOperation(item, phase, index));
      count += result[phase].length;
    }
    if (count > OPERATION_LIMIT) fail("В ActionPlan слишком много операций");
    const operationIds=PHASES.flatMap(phase=>result[phase].map(operation=>operation.id));
    if(new Set(operationIds).size!==operationIds.length)fail("ID операций ActionPlan должны быть уникальны между всеми фазами");
    return result;
  }

  function normalizeModifier(raw, index, actionInstanceId, ownerActorId) {
    if (!plain(raw)) fail(`Модификатор ${index + 1} должен быть объектом`);
    const aliases = { plus: "add", sum: "add", mul: "multiply", max: "cap", set: "replace", grantException: "grant-exception", exception: "grant-exception" };
    const type = aliases[raw.type ?? raw.kind] || raw.type || raw.kind;
    if (!MODIFIER_TYPES.has(type)) fail(`Неизвестный тип модификатора ${index + 1}`);
    const id = idValue(raw.id, `ID модификатора ${index + 1}`);
    const source = normalizeSource(raw.source ?? raw.sourceId ?? raw.sourceActorId, ownerActorId || `modifier:${id}`);
    const ruleId = idValue(raw.ruleId ?? (typeof raw.rule === "string" ? raw.rule : raw.rule?.id) ?? "manual.action-plan", `правило модификатора ${id}`);
    const field = idValue(raw.field ?? raw.target ?? raw.stat ?? (type === "grant-exception" ? "exceptions" : null), `поле модификатора ${id}`, false);
    let value;
    if (type === "add") value = numberValue(raw.amount ?? raw.value, `значение add ${id}`, { min: -1000000, max: 1000000 });
    else if (type === "multiply") value = numberValue(raw.factor ?? raw.amount ?? raw.value, `коэффициент multiply ${id}`, { min: -1000, max: 1000 });
    else if (type === "cap") value = numberValue(raw.cap ?? raw.value ?? raw.amount, `предел cap ${id}`, { min: -1000000, max: 1000000 });
    else if (type === "replace") {
      if (!own(raw, "value") && !own(raw, "replacement") && !own(raw, "replace")) fail(`Замене ${id} нужно значение`);
      value = copy(raw.value ?? raw.replacement ?? raw.replace);
    } else {
      if (!own(raw, "exception") && !own(raw, "value") && !own(raw, "grant")) fail(`Исключению ${id} нужно разрешение`);
      value = copy(raw.exception ?? raw.value ?? raw.grant);
    }
    const policyAliases = { sum: "stack", additive: "stack", exclusiveGroup: "exclusive", set: "replace", max: "highest", min: "lowest" };
    const stackingPolicy = policyAliases[raw.stackingPolicy ?? raw.stacking] || raw.stackingPolicy || raw.stacking || (type === "replace" ? "exclusive" : "stack");
    if (!STACKING_POLICIES.has(stackingPolicy)) fail(`Неизвестная политика stacking у ${id}`);
    const order = integerValue(raw.order ?? index, `порядок модификатора ${id}`, { min: 0, max: 100000 });
    const targetIds = uniqueIds(raw.targetIds ?? raw.targets ?? [], `цели модификатора ${id}`);
    let consume = false;
    let consumeBoundary = "never";
    if (raw.consume === true || raw.consumable === true) {
      consume = true;
      consumeBoundary = normalizeBoundary(raw.consumeBoundary ?? "commit");
    } else if (plain(raw.consume)) {
      consume = raw.consume.enabled !== false;
      consumeBoundary = normalizeBoundary(raw.consume.boundary ?? raw.consumeBoundary ?? (consume ? "commit" : "never"));
    } else if (raw.consumeBoundary != null) {
      consumeBoundary = normalizeBoundary(raw.consumeBoundary);
      consume = consumeBoundary !== "never";
    }
    if (consume && consumeBoundary === "never") fail(`Потребляемый модификатор ${id} требует границу потребления`);
    const consumedByActionId = raw.consumedByActionId ?? raw.consumedBy ?? null;
    if (consumedByActionId != null) idValue(consumedByActionId, `действие, потребившее ${id}`);
    if (!consume && consumedByActionId != null) fail(`Непотребляемый модификатор ${id} не может иметь расход`);
    const exclusiveGroup = raw.exclusiveGroup == null ? null : idValue(raw.exclusiveGroup, `группа модификатора ${id}`);
    const appliesTo = raw.appliesTo == null ? "action" : stringValue(raw.appliesTo, `область модификатора ${id}`, { max: 64 });
    const result = {
      id,
      type,
      field,
      value,
      source,
      sourceId: source.id,
      ruleId,
      lifetime: normalizeLifetime(raw.lifetime ?? raw.duration, { ownerActorId }),
      order,
      stackingPolicy,
      consume,
      consumeBoundary,
      consumedByActionId,
      appliesTo,
      targetIds,
      exclusiveGroup,
    };
    if (raw.metadata != null) {
      if (!plain(raw.metadata)) fail(`Метаданные модификатора ${id} должны быть объектом`);
      result.metadata = copy(raw.metadata);
    }
    return result;
  }

  function normalizeResolutions(value) {
    if (value == null) return {};
    if (!plain(value)) fail("Выборы замен ActionPlan должны быть объектом");
    const result = {};
    for (const [key, modifierId] of Object.entries(value)) {
      idValue(key, "ключ выбора замены");
      result[key] = idValue(modifierId, `выбор для ${key}`);
    }
    return result;
  }

  function normalizeRevisionRows(value) {
    if (value == null) return [];
    const rows = arrayValue(value, "история ревизий", REVISION_LIMIT);
    return rows.map((row, index) => {
      if (!plain(row)) fail(`Запись ревизии ${index + 1} должна быть объектом`);
      const revision = integerValue(row.revision, `ревизия ${index + 1}`, { min: 0, max: 1000000000 });
      const kind = stringValue(row.kind ?? "amend", `тип ревизии ${index + 1}`, { max: 64 });
      const operationId = row.operationId == null ? null : idValue(row.operationId, `операция ревизии ${index + 1}`);
      const result = { revision, kind, ...(operationId == null ? {} : { operationId }) };
      if (row.changedFields != null) result.changedFields = uniqueIds(row.changedFields, `поля ревизии ${index + 1}`, 32);
      if (row.conflictId != null) result.conflictId = idValue(row.conflictId, `конфликт ревизии ${index + 1}`);
      if (row.modifierId != null) result.modifierId = idValue(row.modifierId, `модификатор ревизии ${index + 1}`);
      if (row.reason != null) result.reason = stringValue(row.reason, `причина ревизии ${index + 1}`, { max: 240 });
      if (row.fingerprint != null) result.fingerprint = stringValue(row.fingerprint, `отпечаток ревизии ${index + 1}`, { max: 2000000 });
      return result;
    });
  }

  function normalizeReceipts(value) {
    if (value == null) return [];
    const rows = arrayValue(value, "квитанции ActionPlan", 64);
    const normalized = rows.map((row, index) => {
      if (!plain(row)) fail(`Квитанция ${index + 1} должна быть объектом`);
      return {
        eventId: idValue(row.eventId, `ID квитанции ${index + 1}`),
        revision: integerValue(row.revision, `ревизия квитанции ${index + 1}`, { min: 0, max: 1000000000 }),
        fingerprint: stringValue(row.fingerprint, `отпечаток квитанции ${index + 1}`, { max: 2000000 }),
      };
    });
    uniqueIds(normalized.map(row => row.eventId), "ID квитанций");
    return normalized;
  }

  function normalizeOutcomeRows(value, targets, allowDerived) {
    const targetIds = targets.map(target => target.targetId);
    if (value == null) return Object.fromEntries(targetIds.map(targetId => [targetId, { targetId, status: "pending" }]));
    if (!plain(value)) fail("Итоги по целям ActionPlan должны быть объектом");
    const keys = Object.keys(value);
    if (keys.some(key => !targetIds.includes(key))) fail("Итог ActionPlan ссылается на неизвестную цель");
    if (keys.length !== targetIds.length) fail("Итоги ActionPlan должны содержать каждую цель");
    const result = {};
    for (const targetId of targetIds) {
      const row = value[targetId];
      if (!plain(row)) fail(`Итог цели ${targetId} должен быть объектом`);
      const status = row.status ?? "pending";
      if (!["pending", "ready", "applied", "rejected", "skipped"].includes(status)) fail(`Неизвестный статус итога цели ${targetId}`);
      if (!allowDerived && Object.keys(row).some(key => !["targetId", "status"].includes(key))) fail("Готовый итог цели нельзя подставить при открытии ActionPlan");
      result[targetId] = copy(row);
      result[targetId].targetId = targetId;
      result[targetId].status = status;
    }
    return result;
  }

  function normalizePlan(input, mode = "plan") {
    assertJson(input);
    if (!plain(input)) fail("ActionPlan должен быть JSON-объектом");
    if (input.snapshots != null && !plain(input.snapshots)) fail("Снимки ActionPlan должны быть объектом");
    if (input.schema != null && input.schema !== SCHEMA) fail("Версия ActionPlan не поддерживается");
    if (input.kind != null && input.kind !== KIND) fail("Неизвестный вид ActionPlan");
    const alias = (names, label, fallback = undefined) => {
      const values = names.filter(name => own(input, name) && input[name] != null).map(name => input[name]);
      if (values.length > 1 && values.some(value => JSON.stringify(value) !== JSON.stringify(values[0]))) fail(`Дублирующиеся поля расходятся: ${label}`);
      return values.length ? values[0] : fallback;
    };
    const definitionId = idValue(alias(["definitionId", "actionDefinitionId", "actionId"], "definitionId"), "definitionId");
    const rootActionId = idValue(alias(["rootActionId", "rootId"], "rootActionId"), "rootActionId");
    const actionInstanceId = idValue(alias(["actionInstanceId", "instanceId"], "actionInstanceId"), "actionInstanceId");
    const source = normalizeSource(input.source ?? input.sourceId ?? input.sourceActorId, input.ownerActorId ?? "scene");
    const owner = normalizeOwner(input.owner ?? input.ownerActorId ?? input.ownerId, source);
    const ownerActorId = owner.actorId ?? (owner.id === "scene" ? "scene" : owner.id);
    const id = idValue(input.id ?? input.planId ?? `${rootActionId}:${actionInstanceId}`, "ID плана");
    const revision = integerValue(input.revision ?? 0, "ревизия ActionPlan", { min: 0, max: 1000000000 });
    const status = normalizeStatus(input.status ?? "draft");
    const phase = normalizePhase(input.phase ?? (status === "committed" ? "after" : "before"));
    if (mode === "request") for (const key of DERIVED_KEYS) if (own(input, key)) fail(`Поле ${key} вычисляется ActionPlan и не принимается при открытии`);
    const baseInput = alias(["baseValues", "base"], "baseValues", input.snapshots?.base ?? {});
    if (input.snapshots?.base != null && (own(input, "baseValues") || own(input, "base")) && JSON.stringify(baseInput) !== JSON.stringify(input.snapshots.base)) fail("Снимки базовых значений расходятся");
    if (!plain(baseInput)) fail("Снимок базовых значений должен быть объектом");
    for (const key of DERIVED_KEYS) if (own(baseInput, key)) fail(`Поле ${key} нельзя подставить в снимок базовых значений`);
    const baseValues = copy(baseInput);
    assertTargetAliasesAgree(input);
    const targets = normalizeTargets(input);
    const costsInput = alias(["costs"], "costs", input.snapshots?.costs);
    if (input.snapshots?.costs != null && own(input, "costs") && JSON.stringify(input.costs) !== JSON.stringify(input.snapshots.costs)) fail("Снимки цены расходятся");
    const diceInput = alias(["dicePolicy", "dice"], "dicePolicy", input.snapshots?.dicePolicy);
    if (input.snapshots?.dicePolicy != null && (own(input, "dicePolicy") || own(input, "dice")) && JSON.stringify(diceInput) !== JSON.stringify(input.snapshots.dicePolicy)) fail("Снимки политики броска расходятся");
    const geometryInput = alias(["geometry"], "geometry", input.snapshots?.geometry ?? (input.anchor ? { anchor: input.anchor } : null));
    if (input.snapshots?.geometry != null && own(input, "geometry") && JSON.stringify(input.geometry) !== JSON.stringify(input.snapshots.geometry)) fail("Снимки геометрии расходятся");
    if (input.anchor != null && geometryInput?.anchor != null && JSON.stringify(normalizeAnchor(input.anchor)) !== JSON.stringify(normalizeAnchor(geometryInput.anchor))) fail("Снимки якоря расходятся");
    const costs = normalizeCostParts(costsInput, { allowEmpty: mode !== "request" });
    const dicePolicy = normalizeDicePolicy(diceInput);
    const geometry = normalizeGeometry(geometryInput);
    const rawModifiers = input.modifiers ?? input.snapshots?.modifiers ?? [];
    if (input.snapshots?.modifiers != null && own(input, "modifiers") && JSON.stringify(input.modifiers) !== JSON.stringify(input.snapshots.modifiers)) fail("Списки модификаторов расходятся");
    if (!Array.isArray(rawModifiers) || rawModifiers.length > MODIFIER_LIMIT) fail("Некорректный список модификаторов ActionPlan");
    const modifiers = rawModifiers.map((modifier, index) => normalizeModifier(modifier, index, actionInstanceId, ownerActorId)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    if (new Set(modifiers.map(modifier => modifier.id)).size !== modifiers.length) fail("Повтор ID модификатора ActionPlan");
    const phases = normalizePhases(input);
    const resolutions = normalizeResolutions(input.resolutions ?? input.replacementChoices);
    const allowDerivedOutcomes = mode !== "request" && ["previewed", "committed"].includes(status);
    const outcomes = normalizeOutcomeRows(input.outcomes, targets, allowDerivedOutcomes);
    const amendments = normalizeRevisionRows(input.amendments ?? input.revisions);
    const receipts = normalizeReceipts(input.receipts);
    if(mode==="request"&&(input.receipts!=null||input.amendments!=null||input.revisions!=null))fail("Новый ActionPlan не принимает готовую историю или квитанции");
    const plan = {
      schema: SCHEMA,
      kind: KIND,
      id,
      rootActionId,
      definitionId,
      actionDefinitionId: definitionId,
      actionInstanceId,
      source,
      sourceId: source.id,
      owner,
      ownerActorId,
      revision,
      status,
      phase,
      snapshots: { base: baseValues, targets: copy(targets), costs: copy(costs), dicePolicy: dicePolicy ? copy(dicePolicy) : null, geometry: geometry ? copy(geometry) : null, modifiers: copy(modifiers) },
      baseValues,
      targets: copy(targets),
      targetIds: targets.map(target => target.targetId),
      costs: copy(costs),
      dicePolicy: dicePolicy ? copy(dicePolicy) : null,
      geometry: geometry ? copy(geometry) : null,
      modifiers,
      phases,
      resolutions,
      outcomes,
      amendments,
      receipts,
    };
    if (input.sceneVersion != null) plan.sceneVersion = integerValue(input.sceneVersion, "версия Сцены", { min: 0, max: 1000000000 });
    if (input.metadata != null) {
      if (!plain(input.metadata)) fail("Метаданные ActionPlan должны быть объектом");
      plan.metadata = copy(input.metadata);
    }
    if (input.cancelReason != null) plan.cancelReason = stringValue(input.cancelReason, "причина отмены", { max: 240 });
    if (input.invalidReason != null) plan.invalidReason = stringValue(input.invalidReason, "причина недействительности", { max: 240 });
    if (mode !== "request") {
      if (input.quote != null) plan.quote = copy(input.quote);
      if (input.result != null) plan.result = copy(input.result);
      if (input.phaseHistory != null) plan.phaseHistory = uniqueIds(input.phaseHistory, "история фаз", PHASES.length + 1);
      if (["draft", "targeting", "modifiers"].includes(status) && (input.quote != null || input.result != null)) fail("Открытый ActionPlan не может содержать готовую цитату");
      if(status==="committed"&&(input.quote==null||input.result==null))fail("Подтверждённый ActionPlan должен содержать сохранённые quote и result");
      if(status==="committed"&&receipts.some(receipt=>receipt.fingerprint!==input.result?.fingerprint))fail("Квитанция подтверждённого ActionPlan повреждена");
    }
    return plan;
  }

  function open(request = {}) {
    const plan = normalizePlan({ ...copy(request), status: "draft", phase: "before", revision: 0 }, "request");
    return copy(plan);
  }

  function openMany(request = {}) {
    if (!plain(request)) fail("Корень ActionPlan должен быть объектом");
    const rootActionId = idValue(request.rootActionId ?? request.rootId, "rootActionId");
    if (!Array.isArray(request.actions) || !request.actions.length || request.actions.length > 128) fail("Корень ActionPlan требует от 1 до 128 действий");
    const used = new Set();
    const actions = request.actions.map((raw, index) => {
      if (!plain(raw)) fail(`Действие корня ${index + 1} должно быть объектом`);
      const actionInstanceId = idValue(raw.actionInstanceId ?? `${rootActionId}:action:${index + 1}`, `actionInstanceId ${index + 1}`);
      if (used.has(actionInstanceId)) fail(`Повтор actionInstanceId в одном root: ${actionInstanceId}`);
      used.add(actionInstanceId);
      return open({ ...raw, rootActionId, actionInstanceId });
    });
    return copy({ schema: SCHEMA, kind: ROOT_KIND, rootActionId, actions });
  }

  function conflictKey(field, exclusiveGroup = null) {
    return exclusiveGroup ? `group:${exclusiveGroup}` : `field:${field}`;
  }

  function modifierTargetsOverlap(left, right) {
    if (!left.targetIds.length || !right.targetIds.length) return true;
    return left.targetIds.some(targetId => right.targetIds.includes(targetId));
  }

  function conflictRows(plan) {
    const groups = new Map();
    for (const modifier of plan.modifiers) {
      if (!["replace", "exclusive"].includes(modifier.stackingPolicy) && modifier.type !== "replace") continue;
      // Shape/form replacements conflict by field even when two adapters used
      // different labels for their exclusive group.  An explicit group also
      // remains a conflict boundary for non-replacement modifiers.
      const keys = modifier.type === "replace"
        ? [`field:${modifier.field}`]
        : modifier.stackingPolicy === "exclusive"
          ? [conflictKey(modifier.field, modifier.exclusiveGroup)]
          : [];
      for (const key of [...new Set(keys)]) {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(modifier);
      }
    }
    const conflicts = [];
    for (const [key, modifiers] of groups.entries()) {
      // A field can contain independent per-target replacements.  Build
      // connected components so replacements for disjoint targets do not
      // block one another while overlapping components still require a choice.
      const components = [];
      for (const modifier of modifiers) {
        const touching = components.filter(component => component.some(prior => modifierTargetsOverlap(prior, modifier)));
        if (!touching.length) components.push([modifier]);
        else {
          const merged = [modifier, ...touching.flat()];
          for (const component of touching) components.splice(components.indexOf(component), 1);
          components.push([...new Map(merged.map(item => [item.id, item])).values()]);
        }
      }
      components.filter(component => component.length > 1).forEach((component, index) => {
        const id = components.length === 1 ? key : `${key}:${index + 1}`;
        const modifierIds = component.map(modifier => modifier.id).sort();
        conflicts.push({ id, kind: "replacement", field: component[0].field, modifierIds, resolution: plan.resolutions[id] ?? null, resolved: plan.resolutions[id] != null });
      });
    }
    return conflicts.sort((a, b) => a.id.localeCompare(b.id));
  }

  function checkConflicts(value) {
    const plan = normalizePlan(value, "plan");
    const conflicts = conflictRows(plan);
    const knownIds = new Set(conflicts.map(conflict => conflict.id));
    const invalid = [
      ...conflicts.filter(conflict => conflict.resolution != null && !conflict.modifierIds.includes(conflict.resolution)),
      ...Object.keys(plan.resolutions).filter(id => !knownIds.has(id)).map(id => ({ id, kind: "replacement", field: null, modifierIds: [], resolution: plan.resolutions[id], resolved: false, reason: "unknown-conflict" })),
    ];
    const unresolved = conflicts.filter(conflict => !conflict.resolution);
    return copy({ ok: !invalid.length && !unresolved.length, conflicts, unresolved, invalid, choices: unresolved.map(conflict => ({ id: conflict.id, modifierIds: conflict.modifierIds })) });
  }

  function assertNoConflicts(plan) {
    const status = checkConflicts(plan);
    if (status.invalid.length) fail("Выбор замены ActionPlan больше не доступен");
    if (status.unresolved.length) fail(`ActionPlan содержит неразрешённый конфликт модификаторов: ${status.unresolved.map(item => item.field).join(", ")}`);
    return status;
  }

  function effectiveModifiers(plan) {
    const conflicts = conflictRows(plan);
    const selected = new Set();
    for (const conflict of conflicts) {
      const chosen = conflict.resolution;
      if (chosen) selected.add(chosen);
    }
    const conflictIds = new Set(conflicts.flatMap(conflict => conflict.modifierIds));
    return plan.modifiers.filter(modifier => !conflictIds.has(modifier.id) || selected.has(modifier.id));
  }

  function pathParts(field) {
    const parts = field.split(".");
    if (parts.some(part => !part || part.length > 64 || FORBIDDEN_KEYS.has(part))) fail(`Некорректное поле модификатора: ${field}`);
    return parts;
  }

  function getPath(object, field) {
    let current = object;
    for (const part of pathParts(field)) current = current == null ? undefined : current[part];
    return current;
  }

  function setPath(object, field, value) {
    const parts = pathParts(field);
    let current = object;
    for (const part of parts.slice(0, -1)) {
      if (!plain(current[part])) current[part] = {};
      current = current[part];
    }
    current[parts.at(-1)] = copy(value);
  }

  function isModifierConsumed(modifier, plan) {
    if (!modifier.consumedByActionId) return false;
    return !(plan.status === "committed" && modifier.consumedByActionId === plan.actionInstanceId);
  }

  function applicable(modifier, targetId = null) {
    return !modifier.targetIds.length || targetId != null && modifier.targetIds.includes(targetId);
  }

  function chooseStacking(modifiers) {
    const result = [];
    const groups = new Map();
    for (const modifier of modifiers) {
      if (["highest", "lowest", "unique"].includes(modifier.stackingPolicy)) {
        const key = `${modifier.field}:${modifier.targetIds.join(",")}`;
        const list = groups.get(key) || [];
        list.push(modifier);
        groups.set(key, list);
      } else result.push(modifier);
    }
    for (const list of groups.values()) {
      if (list[0].stackingPolicy === "unique") result.push(list.slice().sort((a, b) => a.id.localeCompare(b.id))[0]);
      else result.push(list.slice().sort((a, b) => Number(a.value) - Number(b.value) || a.id.localeCompare(b.id))[list[0].stackingPolicy === "highest" ? list.length - 1 : 0]);
    }
    return result.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function applyModifiers(values, modifiers) {
    const output = copy(values);
    const exceptions = Array.isArray(output.exceptions) ? [...new Set(output.exceptions.map(String))] : [];
    for (const modifier of chooseStacking(modifiers)) {
      if (modifier.type === "grant-exception") {
        const grants = Array.isArray(modifier.value) ? modifier.value : [modifier.value];
        for (const grant of grants) {
          if (typeof grant !== "string") fail(`Исключение ${modifier.id} должно быть строкой`);
          if (!exceptions.includes(grant)) exceptions.push(grant);
        }
        continue;
      }
      const current = getPath(output, modifier.field);
      if (modifier.type === "replace") {
        setPath(output, modifier.field, modifier.value);
      } else if (modifier.type === "add") {
        const base = current == null ? 0 : numberValue(current, `исходное значение ${modifier.field}`, { min: -1000000000, max: 1000000000 });
        setPath(output, modifier.field, base + modifier.value);
      } else if (modifier.type === "multiply") {
        const base = current == null ? 0 : numberValue(current, `исходное значение ${modifier.field}`, { min: -1000000000, max: 1000000000 });
        setPath(output, modifier.field, base * modifier.value);
      } else if (modifier.type === "cap") {
        const base = current == null ? modifier.value : numberValue(current, `исходное значение ${modifier.field}`, { min: -1000000000, max: 1000000000 });
        setPath(output, modifier.field, Math.min(base, modifier.value));
      }
    }
    if (exceptions.length) output.exceptions = exceptions;
    return output;
  }

  function numericTotals(outcomes, effectiveValues) {
    const values = {};
    const rows = Object.values(outcomes);
    const keys = new Set(Object.keys(effectiveValues));
    for (const row of rows) for (const key of Object.keys(row.values || {})) keys.add(key);
    for (const key of keys) {
      const rowValues = rows.map(row => row.values?.[key]).filter(value => typeof value === "number" && Number.isFinite(value));
      if (rowValues.length) values[key] = rowValues.reduce((sum, value) => sum + value, 0);
      else if (typeof effectiveValues[key] === "number" && Number.isFinite(effectiveValues[key])) values[key] = effectiveValues[key];
    }
    return values;
  }

  function quoteCore(plan) {
    assertNoConflicts(plan);
    const candidateModifiers = effectiveModifiers(plan);
    const unavailable = candidateModifiers.filter(modifier => isModifierConsumed(modifier, plan) && (!modifier.targetIds.length || plan.targets.some(target => modifier.targetIds.includes(target.targetId))));
    if (unavailable.length) fail(`Потребляемый модификатор уже использован: ${unavailable.map(modifier => modifier.id).join(", ")}`);
    const modifiers = candidateModifiers.filter(modifier => !isModifierConsumed(modifier, plan));
    const globalModifiers = chooseStacking(modifiers.filter(modifier => applicable(modifier, null)));
    const effectiveValues = applyModifiers(plan.baseValues, globalModifiers);
    const outcomes = {};
    const consumed = new Set();
    const applied = new Set(globalModifiers.map(modifier=>modifier.id));
    for (const target of plan.targets) {
      const targetModifiers = chooseStacking(modifiers.filter(modifier => applicable(modifier, target.targetId)));
      const targetValues = applyModifiers({ ...plan.baseValues, ...target.snapshot }, targetModifiers);
      for(const modifier of targetModifiers)applied.add(modifier.id);
      for (const modifier of targetModifiers) if (modifier.consume) consumed.add(modifier.id);
      outcomes[target.targetId] = {
        targetId: target.targetId,
        status: "ready",
        snapshot: copy(target.snapshot),
        values: targetValues,
        appliedModifierIds: targetModifiers.map(modifier => modifier.id),
      };
    }
    for (const modifier of globalModifiers) if (modifier.consume) consumed.add(modifier.id);
    const totals = { targetCount: plan.targets.length, values: numericTotals(outcomes, effectiveValues) };
    for (const [key, value] of Object.entries(totals.values)) totals[key] = value;
    const core = {
      schema: SCHEMA,
      kind: QUOTE_KIND,
      planId: plan.id,
      revision: plan.revision,
      rootActionId: plan.rootActionId,
      definitionId: plan.definitionId,
      actionInstanceId: plan.actionInstanceId,
      phase: "apply",
      baseValues: copy(plan.baseValues),
      effectiveValues,
      outcomes,
      totals,
      consumedModifierIds: [...consumed].sort(),
      modifierOrder: modifiers.filter(modifier=>applied.has(modifier.id)).map(modifier => modifier.id),
    };
    const fingerprint = JSON.stringify(core);
    return { ...core, fingerprint };
  }

  function validateScene(plan, scene) {
    if (!plain(scene)) fail("Для перепроверки ActionPlan нужна Сцена");
    if (plan.sceneVersion != null && Number(scene.version ?? 0) !== plan.sceneVersion) fail("Сцена изменилась после предпросмотра ActionPlan");
    const actors = new Map((Array.isArray(scene.actors) ? scene.actors : []).filter(actor => plain(actor) && typeof actor.id === "string").map(actor => [actor.id, actor]));
    const targets = new Map();
    for (const collection of ["actors", "markers", "objects", "areas", "walls"]) {
      for (const item of Array.isArray(scene[collection]) ? scene[collection] : []) if (plain(item) && typeof item.id === "string" && !targets.has(item.id)) targets.set(item.id, item);
    }
    const sourceActorId = plan.source.actorId ?? (plan.source.kind === "actor" ? plan.source.id : null);
    if (sourceActorId && sourceActorId !== "scene") {
      const source = actors.get(sourceActorId);
      if (!source || source.knockedOut) fail("Источник ActionPlan больше недоступен");
    }
    for (const target of plan.targets) {
      const item = targets.get(target.targetId), actor = actors.get(target.targetId);
      if (!item || actor?.knockedOut) fail(`Цель ActionPlan больше недоступна: ${target.targetId}`);
      // A target snapshot is an optimistic concurrency check.  Fields that
      // the live collection does not expose are left to the owning family;
      // fields present on both sides must still match before commit.
      for (const [key, expected] of Object.entries(target.snapshot || {})) {
        if (!own(item, key)) continue;
        if (!sameJson(item[key], expected)) fail(`Снимок цели ActionPlan устарел: ${target.targetId}.${key}`);
      }
    }
    if (plan.geometry?.route && global.DAWN_LIONWING_GEOMETRY?.revalidatePlan) {
      const routePlan = plan.geometry.route.kind === "lionwing.geometry.route" ? plan.geometry.route : plan.geometry.route.plan;
      if (routePlan) {
        const checked = global.DAWN_LIONWING_GEOMETRY.revalidatePlan(scene, routePlan);
        if (!checked?.available) fail(checked.reason || "Геометрический план ActionPlan устарел");
      }
    }
    return true;
  }

  function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function bridgeChoices(plan, conflicts) {
    const choices = [];
    const seen = new Set();
    for (const conflict of conflicts.unresolved) {
      const id = `${plan.id}:choice:${conflict.id}`;
      choices.push({
        id,
        kind: "replacement",
        conflictId: conflict.id,
        phase: "replace",
        rootActionId: plan.rootActionId,
        definitionId: plan.definitionId,
        actionInstanceId: plan.actionInstanceId,
        causeEventId: plan.source.causeEventId ?? null,
        ownerActorId: plan.ownerActorId,
        responderActorId: plan.ownerActorId,
        options: copy(conflict.modifierIds),
        selected: null,
      });
      seen.add(id);
    }
    // Once a plan has reached preview/commit, the replace phase is already
    // resolved and its declarative marker must not keep the execution bridge
    // waiting for a second answer.
    if (["draft", "targeting", "modifiers"].includes(plan.status) && conflicts.unresolved.length > 0) for (const operation of plan.phases.replace || []) {
      if (!["choose-replacement", "choice", "prompt"].includes(operation.kind)) continue;
      const id = operation.choiceId ?? `${plan.id}:choice:${operation.id}`;
      if (seen.has(id)) continue;
      choices.push({
        id,
        kind: operation.kind,
        operationId: operation.id,
        phase: "replace",
        rootActionId: plan.rootActionId,
        definitionId: plan.definitionId,
        actionInstanceId: plan.actionInstanceId,
        causeEventId: plan.source.causeEventId ?? null,
        ownerActorId: plan.ownerActorId,
        responderActorId: operation.responderActorId ?? plan.ownerActorId,
        options: copy(operation.options ?? operation.choices ?? []),
        selected: operation.selected ?? null,
      });
      seen.add(id);
    }
    return choices;
  }

  function bridgeTargetSnapshots(plan, options = {}) {
    const targets = copy(plan.targets);
    if (options.targetSnapshots != null && !sameJson(options.targetSnapshots, targets)) fail("Снимок целей ActionPlan изменён после предпросмотра");
    return targets;
  }

  function bridgeModifierSnapshots(plan, options = {}) {
    const modifiers = copy(plan.modifiers);
    if (options.modifierSnapshots != null && !sameJson(options.modifierSnapshots, modifiers)) fail("Снимок модификаторов ActionPlan изменён после предпросмотра");
    return modifiers;
  }

  // Convert a plan into the existing execution vocabulary.  This is a pure
  // adapter: its result is a reservation plus a deterministic operation
  // sequence.  The Scene reducer remains the only place that can actually
  // spend the reservation or apply the sequence.
  function toExecution(value, options = {}) {
    const input = typeof value === "string" ? JSON.parse(value) : value;
    const plan = normalizePlan(input, "plan");
    if (options.expectedRevision != null && integerValue(options.expectedRevision, "ожидаемая ревизия") !== plan.revision) fail("Ревизия ActionPlan устарела");
    if (options.scene != null) validateScene(plan, options.scene);
    const targets = bridgeTargetSnapshots(plan, options);
    const modifiers = bridgeModifierSnapshots(plan, options);
    const conflicts = checkConflicts(plan);
    let quoteResult = null;
    if (!["cancelled", "invalid"].includes(plan.status) && !conflicts.unresolved.length && !conflicts.invalid.length) {
      quoteResult = quote(plan, options.scene == null ? {} : { scene: options.scene });
    }
    const executionApi = global.DAWN_LIONWING_EXECUTION;
    if (typeof executionApi?.actionPlanExecution !== "function") fail("Мост ActionPlan → execution недоступен");
    const execution = executionApi.actionPlanExecution({
      ...copy(plan),
      targets,
      targetIds: targets.map(target => target.targetId),
      modifiers,
      choices: bridgeChoices(plan, conflicts),
      ...(quoteResult ? { quote: quoteResult, result: plan.status === "committed" ? quoteResult : null } : {}),
    }, {
      ...options,
      targetSnapshots: targets,
      modifierSnapshots: modifiers,
      replay: options.replay === true,
    });
    return {
      ok: true,
      plan: copy(plan),
      execution: copy(execution),
      quote: quoteResult ? copy(quoteResult) : null,
      choices: copy(execution.choices),
      waiting: execution.choices.length > 0,
      ready: !execution.choices.length && !["draft", "targeting", "modifiers", "cancelled", "invalid"].includes(plan.status),
      replay: Boolean(execution.replay),
    };
  }

  function prepareExecution(value, options = {}) {
    const result = toExecution(value, { ...options, replay: false });
    // A preparation is always an unpaid intent, including when its caller
    // serializes the descriptor and reloads it before confirmation.
    result.execution.payment.paid = false;
    result.execution.payment.replay = false;
    result.payment = copy(result.execution.payment);
    return result;
  }

  function commitExecution(value, options = {}) {
    const plan = normalizePlan(value, "plan");
    if (plan.status === "committed") {
      const replayed = toExecution(plan, { ...options, replay: true });
      replayed.execution.payment.paid = false;
      replayed.execution.payment.replay = true;
      replayed.payment = copy(replayed.execution.payment);
      replayed.replay = true;
      return replayed;
    }
    if (plan.status !== "previewed") fail("Execution bridge подтверждает только предпросмотренный ActionPlan");
    const prepared = toExecution(plan, { ...options, replay: false });
    if (!prepared.ready) fail("ActionPlan нельзя подтвердить до разрешения вложенного выбора");
    // `commit` recomputes the quote and marks consumables in one returned
    // snapshot.  If the execution descriptor cannot be built, no snapshot
    // escapes and no Scene has been touched.
    const committed = commit(plan, {
      ...options,
      ...(prepared.quote ? { quote: prepared.quote, result: prepared.quote } : {}),
    });
    const execution = toExecution(committed.plan, { ...options, replay: false, commitResult: true });
    execution.execution.payment.paid = false;
    execution.execution.payment.commitRequested = true;
    execution.execution.payment.replay = false;
    execution.payment = copy(execution.execution.payment);
    execution.replay = Boolean(committed.replay);
    return { ...committed, ...execution, plan: copy(committed.plan), quote: copy(committed.quote), result: copy(committed.result) };
  }

  function resumeExecution(value, rawChoice, options = {}) {
    const plan = normalizePlan(value, "plan");
    const choice = typeof rawChoice === "string" ? { modifierId: rawChoice } : rawChoice;
    if (!plain(choice)) fail("Ответ вложенного выбора ActionPlan должен быть объектом или ID");
    const choiceRootActionId = choice.rootActionId ?? options.rootActionId;
    const choiceActionInstanceId = choice.actionInstanceId ?? options.actionInstanceId;
    if (choiceRootActionId != null && choiceRootActionId !== plan.rootActionId) fail("Ответ choice принадлежит другому rootAction");
    if (choiceActionInstanceId != null && choiceActionInstanceId !== plan.actionInstanceId) fail("Ответ choice принадлежит другому экземпляру действия");
    const conflicts = checkConflicts(plan);
    const conflictId = choice.conflictId ?? options.conflictId ?? (conflicts.unresolved.length === 1 ? conflicts.unresolved[0].id : choice.id);
    const selected = choice.modifierId ?? choice.selected ?? choice.choice;
    if (typeof conflictId !== "string" || typeof selected !== "string") fail("Ответ choice должен содержать конфликт и выбранный модификатор");
    const next = resolveConflict(plan, conflictId, selected, {
      ...options,
      operationId: choice.operationId ?? options.operationId,
    });
    const result = toExecution(next, options);
    return { ...result, plan: copy(next), resumed: true, choice: copy({ ...choice, conflictId, modifierId: selected, rootActionId: plan.rootActionId, actionInstanceId: plan.actionInstanceId }) };
  }

  function reloadExecution(value, options = {}) {
    const plan = reload(value);
    return toExecution(plan, options);
  }

  function assertStoredQuote(plan, expected) {
    if (plan.quote != null && !sameJson(plan.quote, expected)) fail("Сохранённая цитата ActionPlan подделана или устарела");
    if (plan.status === "committed" && plan.result != null && !sameJson(plan.result, expected)) fail("Сохранённый итог ActionPlan подделан или устарел");
    for (const [targetId, row] of Object.entries(plan.outcomes)) {
      if (plan.status === "draft" || plan.status === "targeting" || plan.status === "modifiers") continue;
      if (!sameJson(row, expected.outcomes[targetId])) fail(`Сохранённый итог цели подделан: ${targetId}`);
    }
  }

  function quote(value, options = {}) {
    const plan = normalizePlan(value, "plan");
    if (plan.status === "cancelled" || plan.status === "invalid") fail("Нельзя цитировать отменённый ActionPlan");
    if (options.expectedRevision != null && integerValue(options.expectedRevision, "ожидаемая ревизия") !== plan.revision) fail("Ревизия ActionPlan устарела");
    if (options.scene != null) validateScene(plan, options.scene);
    const result = quoteCore(plan);
    if (plan.status !== "draft" && plan.status !== "targeting" && plan.status !== "modifiers") assertStoredQuote(plan, result);
    if (options.totals != null && !sameJson(options.totals, result.totals)) fail("Поддельные totals ActionPlan отклонены");
    if (options.result != null && !sameJson(options.result, result)) fail("Поддельный итог ActionPlan отклонён");
    return copy(result);
  }

  function quoteStatus(value, options = {}) {
    try {
      const result = quote(value, options);
      return { ok: true, quote: result, conflicts: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      let conflicts = [];
      try { conflicts = checkConflicts(value).conflicts; } catch { /* malformed input is reported below */ }
      return { ok: false, errors: [message], conflicts };
    }
  }

  function preview(value, options = {}) {
    const plan = normalizePlan(value, "plan");
    if (!OPEN_STATUSES.has(plan.status)) fail("Этот ActionPlan уже закрыт");
    if (options.expectedRevision != null && integerValue(options.expectedRevision, "ожидаемая ревизия") !== plan.revision) fail("Ревизия ActionPlan устарела");
    if (options.scene != null) validateScene(plan, options.scene);
    const result = quoteCore(plan);
    const next = copy({ ...plan, status: "previewed", phase: "apply", quote: result, outcomes: result.outcomes, phaseHistory: ["before", "replace", "apply"] });
    return { ok: true, plan: next, quote: copy(result) };
  }

  function checkProvidedQuote(expected, options) {
    const provided = options.quote ?? options.result;
    if (provided != null && !sameJson(provided, expected)) fail("Предоставленная цитата ActionPlan не совпадает с повторным расчётом");
    if (options.totals != null && !sameJson(options.totals, expected.totals)) fail("Поддельные totals ActionPlan отклонены");
  }

  function commit(value, options = {}) {
    const plan = normalizePlan(value, "plan");
    if (plan.status === "committed") {
      if (options.quote != null && plan.result != null && !sameJson(options.quote, plan.result)) fail("Повторное подтверждение содержит другой итог ActionPlan");
      if (options.result != null && plan.result != null && !sameJson(options.result, plan.result)) fail("Повторное подтверждение содержит другой итог ActionPlan");
      if (options.totals != null && plan.result != null && !sameJson(options.totals, plan.result.totals)) fail("Повторное подтверждение содержит поддельные totals");
      return { ok: true, replay: true, plan: copy(plan), quote: copy(plan.result), result: copy(plan.result) };
    }
    if (plan.status === "cancelled" || plan.status === "invalid") fail("Нельзя подтвердить закрытый ActionPlan");
    if (options.expectedRevision != null && integerValue(options.expectedRevision, "ожидаемая ревизия") !== plan.revision) fail("Ревизия ActionPlan устарела");
    if (options.scene != null) validateScene(plan, options.scene);
    const result = quoteCore(plan);
    assertStoredQuote(plan, result);
    checkProvidedQuote(result, options);
    const consumed = new Set(result.consumedModifierIds);
    const modifiers = plan.modifiers.map(modifier => consumed.has(modifier.id) ? { ...modifier, consumedByActionId: plan.actionInstanceId } : modifier);
    const receipts = [...plan.receipts];
    const eventId = options.eventId ?? options.idempotencyKey ?? null;
    if (eventId != null) {
      const normalizedEventId = idValue(eventId, "ID подтверждения");
      if (!receipts.some(receipt => receipt.eventId === normalizedEventId)) receipts.push({ eventId: normalizedEventId, revision: plan.revision + 1, fingerprint: result.fingerprint });
    }
    const next = copy({ ...plan, status: "committed", phase: "after", modifiers, snapshots: { ...plan.snapshots, modifiers: copy(modifiers) }, outcomes: result.outcomes, quote: result, result, phaseHistory: ["before", "replace", "apply", "after"], receipts: receipts.slice(-64) });
    return { ok: true, replay: false, plan: next, quote: copy(result), result: copy(result) };
  }

  function mutateOpenPlan(value, patch, operation) {
    const candidate = copy(value);
    const targetPatch = patch.targets ?? (patch.targetIds != null ? patch.targetIds : null);
    if (targetPatch != null) {
      if (patch.targets != null) {
        candidate.targets = copy(patch.targets);
        candidate.targetIds = candidate.targets.map(item => typeof item === "string" ? item : item.targetId ?? item.id);
      } else {
        candidate.targetIds = copy(patch.targetIds);
        const old = new Map(candidate.targets.map(item => [item.targetId, item]));
        candidate.targets = candidate.targetIds.map(targetId => old.get(targetId) || { targetId, snapshot: {} });
      }
      candidate.targets=normalizeTargets({targets:candidate.targets,targetIds:candidate.targetIds});candidate.targetIds=candidate.targets.map(target=>target.targetId);
      candidate.snapshots.targets = copy(candidate.targets);
    }
    if (patch.geometry !== undefined) {
      candidate.geometry = copy(patch.geometry);
      candidate.snapshots.geometry = copy(patch.geometry);
    }
    if (patch.anchor !== undefined) {
      candidate.geometry = { ...(candidate.geometry || {}), anchor: copy(patch.anchor) };
      candidate.snapshots.geometry = copy(candidate.geometry);
    }
    if (patch.modifiers !== undefined) {
      candidate.modifiers = copy(patch.modifiers);
      candidate.snapshots.modifiers = copy(patch.modifiers);
    }
    if (patch.phases !== undefined) candidate.phases = copy(patch.phases);
    if (patch.resolutions !== undefined) candidate.resolutions = copy(patch.resolutions);
    candidate.revision += 1;
    candidate.status = "draft";
    candidate.phase = "before";
    delete candidate.quote;
    delete candidate.result;
    candidate.outcomes = Object.fromEntries(candidate.targets.map(target => [target.targetId, { targetId: target.targetId, status: "pending" }]));
    const conflicts = conflictRows(normalizePlan(candidate, "plan"));
    if (conflicts.some(conflict => !candidate.resolutions?.[conflict.id])) {
      candidate.phase = "replace";
      candidate.status = "modifiers";
    } else if (patch.targets !== undefined || patch.targetIds !== undefined || patch.geometry !== undefined || patch.anchor !== undefined) {
      candidate.status = "targeting";
    } else if (patch.modifiers !== undefined || patch.resolutions !== undefined) candidate.status = "modifiers";
    candidate.amendments = [...(candidate.amendments || []), { revision: candidate.revision, kind: operation.kind, operationId: operation.operationId, changedFields: operation.changedFields, ...(operation.fingerprint ? { fingerprint: operation.fingerprint } : {}), ...(operation.conflictId ? { conflictId: operation.conflictId } : {}), ...(operation.modifierId ? { modifierId: operation.modifierId } : {}) }].slice(-REVISION_LIMIT);
    return normalizePlan(candidate, "plan");
  }

  function amend(value, patch = {}, options = {}) {
    const plan = normalizePlan(value, "plan");
    if (!OPEN_STATUSES.has(plan.status)) fail("Закрытый ActionPlan нельзя изменить");
    if (!plain(patch)) fail("Изменения ActionPlan должны быть объектом");
    const allowed = new Set(["targets", "targetIds", "geometry", "anchor", "modifiers", "phases", "resolutions"]);
    const changedFields = Object.keys(patch);
    for (const key of changedFields) if (!allowed.has(key)) fail(`Поле ActionPlan нельзя изменить через amend: ${key}`);
    if (!changedFields.length) fail("Пустой amend ActionPlan");
    if (options.expectedRevision != null && integerValue(options.expectedRevision, "ожидаемая ревизия") !== plan.revision) fail("Ревизия ActionPlan устарела");
    const operationId = options.operationId == null ? `amend:${plan.revision + 1}` : idValue(options.operationId, "ID amend");
    const fingerprint = JSON.stringify({ kind: "amend", patch: copy(patch) });
    const prior = plan.amendments.find(row => row.operationId === operationId);
    if (prior) { if(prior.fingerprint&&prior.fingerprint!==fingerprint)fail("Повтор amend с тем же ID содержит другие данные");return copy(plan); }
    const retarget = changedFields.some(key => ["targets", "targetIds", "geometry", "anchor"].includes(key));
    if (plan.status === "previewed" && retarget && !["targeting", "retarget", "recalculate"].includes(options.window)) fail("Поздняя смена цели разрешена только в именованном окне retarget");
    if (plan.status === "previewed" && changedFields.includes("modifiers") && !["modifiers", "recalculate"].includes(options.window)) fail("Поздняя смена модификаторов разрешена только в именованном окне recalculate");
    return copy(mutateOpenPlan(plan, patch, { kind: "amend", operationId, changedFields, fingerprint }));
  }

  function resolveConflict(value, conflictId, modifierId, options = {}) {
    const plan = normalizePlan(value, "plan");
    if (!OPEN_STATUSES.has(plan.status)) fail("Закрытый ActionPlan нельзя разрешить");
    const conflict = conflictRows(plan).find(item => item.id === conflictId);
    if (!conflict) fail("Конфликт замены ActionPlan не найден");
    const selected = idValue(modifierId, "выбранный модификатор");
    if (!conflict.modifierIds.includes(selected)) fail("Выбранный модификатор не входит в конфликт");
    if (options.expectedRevision != null && integerValue(options.expectedRevision, "ожидаемая ревизия") !== plan.revision) fail("Ревизия ActionPlan устарела");
    const operationId = options.operationId == null ? `resolve:${conflictId}:${selected}:${plan.revision + 1}` : idValue(options.operationId, "ID решения конфликта");
    const fingerprint=JSON.stringify({kind:"resolve-conflict",conflictId,modifierId:selected});
    const prior=plan.amendments.find(row=>row.operationId===operationId);
    if (prior) { if(prior.fingerprint&&prior.fingerprint!==fingerprint)fail("Повтор решения с тем же ID содержит другой выбор");return copy(plan); }
    const resolutions = { ...plan.resolutions, [conflictId]: selected };
    const next = { ...plan, resolutions };
    return copy(mutateOpenPlan(next, { resolutions }, { kind: "resolve-conflict", operationId, changedFields: ["resolutions"], conflictId, modifierId: selected, fingerprint }));
  }

  function transition(value, status, reason, options = {}) {
    const plan = normalizePlan(value, "plan");
    if (!OPEN_STATUSES.has(plan.status)) {
      if (plan.status === status) return copy(plan);
      fail("Закрытый ActionPlan нельзя перевести в новый статус");
    }
    const operationId = options.operationId == null ? `${status}:${plan.revision + 1}` : idValue(options.operationId, `ID ${status}`);
    if (plan.amendments.some(row => row.operationId === operationId)) return copy(plan);
    const next = { ...plan, status, phase: status === "invalid" ? "after" : plan.phase, revision: plan.revision + 1, amendments: [...plan.amendments, { revision: plan.revision + 1, kind: status, operationId, changedFields: [], reason: stringValue(reason || (status === "cancelled" ? "Отменено до оплаты." : "План недействителен."), "причина", { max: 240 }) }].slice(-REVISION_LIMIT) };
    if (status === "cancelled") next.cancelReason = next.amendments.at(-1).reason;
    if (status === "invalid") next.invalidReason = next.amendments.at(-1).reason;
    return copy(next);
  }

  function cancel(value, options = {}) {
    return transition(value, "cancelled", options.reason, options);
  }

  function invalidate(value, options = {}) {
    return transition(value, "invalid", options.reason, options);
  }

  function explain(value, options = {}) {
    let plan = null;
    let quoteResult = null;
    let errors = [];
    try {
      if (value?.kind === QUOTE_KIND) quoteResult = copy(value);
      else {
        plan = normalizePlan(value, "plan");
        quoteResult = quote(plan, options);
      }
    } catch (error) {
      errors = [error instanceof Error ? error.message : String(error)];
      try { plan = normalizePlan(value, "plan"); } catch { /* the first error is enough */ }
    }
    const source = plan?.source || null;
    const owner = plan?.owner || null;
    const text = quoteResult
      ? `ActionPlan ${plan?.definitionId || quoteResult.definitionId}#${plan?.actionInstanceId || quoteResult.actionInstanceId}: ${quoteResult.totals.targetCount} целей; итог ${JSON.stringify(quoteResult.totals.values)}.`
      : `ActionPlan не готов: ${errors.join(" ")}`;
    return copy({ schema: SCHEMA, kind: "lionwing.action-plan.explanation", ok: !errors.length, planId: plan?.id || quoteResult?.planId || null, definitionId: plan?.definitionId || quoteResult?.definitionId || null, actionInstanceId: plan?.actionInstanceId || quoteResult?.actionInstanceId || null, rootActionId: plan?.rootActionId || quoteResult?.rootActionId || null, source, owner, phase: plan?.phase || quoteResult?.phase || null, status: plan?.status || "quoted", conflicts: plan ? conflictRows(plan) : [], modifiers: plan ? plan.modifiers.map(modifier => ({ id: modifier.id, type: modifier.type, sourceId: modifier.sourceId, ruleId: modifier.ruleId, lifetime: modifier.lifetime, order: modifier.order, stackingPolicy: modifier.stackingPolicy, consume: modifier.consume, consumeBoundary: modifier.consumeBoundary })) : [], outcomes: quoteResult?.outcomes || {}, totals: quoteResult?.totals || null, consumedModifierIds: quoteResult?.consumedModifierIds || [], errors, text });
  }

  function reload(value) {
    let input = value;
    if (typeof input === "string") {
      try { input = JSON.parse(input); } catch { fail("JSON ActionPlan не разбирается"); }
    }
    const plan = normalizePlan(input, "plan");
    if (plan.status === "previewed" || plan.status === "committed") {
      const expected = quoteCore(plan);
      assertStoredQuote(plan, expected);
    }
    return copy(plan);
  }

  function validate(value, options = {}) {
    try {
      const plan = normalizePlan(value, "plan");
      const conflicts = checkConflicts(plan);
      if (options.scene != null) validateScene(plan, options.scene);
      const result = { ok: !conflicts.invalid.length && (plan.status === "committed" || !conflicts.unresolved.length), plan: copy(plan), conflicts: copy(conflicts) };
      if (options.quote === true && result.ok) result.quote = quote(plan, options);
      return result;
    } catch (error) {
      return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
    }
  }

  function serialize(value) {
    return JSON.stringify(reload(value));
  }

  const api = {
    schema: SCHEMA,
    kind: KIND,
    phases: [...PHASES],
    statuses: [...STATUSES],
    modifierTypes: [...MODIFIER_TYPES],
    stackingPolicies: [...STACKING_POLICIES],
    consumeBoundaries: [...CONSUME_BOUNDARIES],
    open,
    create: open,
    openMany,
    createRoot: openMany,
    normalize: value => normalizePlan(value, "plan"),
    normalizePlan: value => normalizePlan(value, "plan"),
    checkConflicts,
    conflicts: checkConflicts,
    resolveConflict,
    selectReplacement: resolveConflict,
    quote,
    quoteStatus,
    preview,
    commit,
    apply: commit,
    amend,
    cancel,
    invalidate,
    explain,
    reload,
    fromJSON: reload,
    toExecution,
    executionPlan: toExecution,
    prepareExecution,
    prepareExecutionPlan: prepareExecution,
    commitExecution,
    commitExecutionPlan: commitExecution,
    resumeExecution,
    continueExecution: resumeExecution,
    reloadExecution,
    replayExecution: value => toExecution(value, { replay: true }),
    serialize,
    validate,
    // Exposed for adapters and tests that need to inspect the canonical data
    // rules without gaining a stateful execution hook.
    normalizeModifier: (value, index = 0, actionInstanceId = "action:normalization", ownerActorId = "scene") => normalizeModifier(value, index, actionInstanceId, ownerActorId),
    normalizeLifetime,
    normalizeGeometry,
  };
  global.DAWN_LIONWING_ACTION_PLAN = Object.freeze(api);
})(typeof window === "object" ? window : globalThis);
