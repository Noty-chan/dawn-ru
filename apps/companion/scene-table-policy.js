"use strict";

// Shared policy and storage-only commands. UI preferences are deliberately not
// consulted here. Authorization belongs to the authoritative commit boundary.
(function (global) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const RESOURCE_FIELDS = Object.freeze(["hp", "maxHp", "ap", "baseAp", "focus", "influence", "wounds", "stress", "armor", "evasion", "speed"]);
  const installed = new WeakSet();
  let serial = 0;
  function fail(message, code = "TABLE_COMMAND_INVALID") {
    const error = new Error(message); error.code = code; throw error;
  }
  function normalizePolicy(raw) {
    return { mode: raw?.mode === "manual" ? "manual" : "rules", processStatuses: raw?.processStatuses === true,
      epoch: Number.isSafeInteger(raw?.epoch) && raw.epoch >= 0 ? raw.epoch : 0 };
  }
  const isManual = scene => normalizePolicy(scene?.tablePolicy).mode === "manual";
  const actor = (scene, id) => (scene.actors || []).find(row => row.id === id);
  function requiredActor(scene, id) {
    const row = actor(scene, id); if (!row) fail("Участник отсутствует на столе."); return row;
  }
  function exactKeys(value, keys) {
    if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).some(key => !keys.includes(key))) fail("Неизвестные поля ручной команды.");
  }
  function safeId(value) {
    if (typeof value !== "string" || !value.trim() || value.length > 160 || /[\u0000-\u001f]/u.test(value) || ["__proto__", "constructor", "prototype"].includes(value)) fail("Некорректный ID.");
    return value;
  }
  function cell(scene, spaceId, x, y) {
    const space = (scene.spaces || []).find(row => row.id === spaceId);
    if (!space || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= space.width || y >= space.height) fail("Клетка находится вне поля.");
    // Walls, terrain, occupancy and status mechanics are advisory in manual.
    return { space: spaceId, x, y };
  }
  function pendingWork(scene) {
    return Boolean(scene.pendingAction || scene.pendingPrompt || scene.pendingActionPlan || scene.triggerQueue?.length
      || scene.lionwing?.pendingActionPlan || scene.lionwing?.choices?.length || scene.lionwing?.deferred?.length
      || scene.lionwing?.pausedChains?.length || scene.lionwing?.afterAttack?.length || scene.lionwing?.executionCursor);
  }
  // Only typed technical references are detached. Actor values, consequences,
  // durations, effect arrays and the historical journal are never executed.
  const REF_KEYS = new Set(["objectId", "markerId", "areaId", "wallId", "entityId", "sourceEntityId", "ownerEntityId", "linkedEntityId", "backingId"]);
  const REF_ARRAY_KEYS = new Set(["objectIds", "markerIds", "areaIds", "wallIds", "entityIds", "sourceEntityIds"]);
  function detachReferences(value, ids) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (REF_KEYS.has(key) && ids.has(item)) value[key] = null;
      else if (REF_ARRAY_KEYS.has(key) && Array.isArray(item)) value[key] = item.filter(id => !ids.has(id));
      else if (key === "links" && Array.isArray(item)) value[key] = item.filter(link => !ids.has(link?.from) && !ids.has(link?.to));
      else detachReferences(item, ids);
    }
  }
  function removeStoredObject(scene, collection, id) {
    if (!(scene[collection] || []).some(row => row.id === id)) fail("Удаляемый объект отсутствует.");
    if (pendingWork(scene)) fail("Сначала завершите ожидающее действие.", "TABLE_PENDING_WORK");
    const ids = new Set([id]);
    const registry = scene.lionwing?.entities;
    const rows = Array.isArray(registry) ? registry.map((row, index) => [index, row]) : Object.entries(registry || {});
    for (const [key, row] of rows) {
      if (Object.entries(row?.backing || {}).some(([ref, value]) => REF_KEYS.has(ref) && value === id)) {
        ids.add(row.id || key);
        if (!Array.isArray(registry)) delete registry[key];
      }
    }
    if (Array.isArray(registry)) scene.lionwing.entities = registry.filter(row => !ids.has(row.id));
    scene[collection] = scene[collection].filter(row => row.id !== id);
    // Do not rewrite receipts or historical records: their original payload is
    // essential for duplicate detection and undo handled by the caller.
    for (const key of ["actors", "objects", "markers", "walls", "reminders", "sessionClocks"]) detachReferences(scene[key], ids);
    if (scene.lionwing) for (const [key, value] of Object.entries(scene.lionwing)) {
      if (!["receipts", "history", "specialJournal", "boundaryReceipts", "afterEventReceipts"].includes(key)) detachReferences(value, ids);
    }
  }
  function reduce(scene, event) {
    const p = event.payload;
    if (p.kind === "policy") {
      exactKeys(p, ["kind", "mode", "processStatuses"]);
      if (p.processStatuses !== undefined && typeof p.processStatuses !== "boolean") fail("Некорректная настройка пометок.");
      if (!["manual", "rules"].includes(p.mode)) fail("Неизвестная политика стола.");
      const current = normalizePolicy(scene.tablePolicy);
      if (p.mode === "rules" && current.mode === "manual") fail("Начало боя требует явной команды start-rules и выбора первого участника.", "TABLE_START_RULES_REQUIRED");
      const changed = p.mode !== current.mode || p.processStatuses !== undefined && p.processStatuses !== current.processStatuses;
      if (changed && pendingWork(scene)) fail("Сначала завершите ожидающее действие.", "TABLE_PENDING_WORK");
      scene.tablePolicy = { ...current, mode: p.mode, processStatuses: p.processStatuses ?? current.processStatuses, epoch: current.epoch + Number(changed) };
      if (p.mode === "manual") scene.manualTable ||= { actorId: null, round: 1 };
      return;
    }
    if (!isManual(scene)) fail("Ручная команда требует ручной политики стола.", "TABLE_MANUAL_REQUIRED");
    if (p.kind === "start-rules") fail("Инициализация нового боя ещё не подключена.", "TABLE_START_RULES_UNAVAILABLE");
    if (p.kind === "move") {
      exactKeys(p, ["kind", "space", "x", "y"]);
      const target = requiredActor(scene, event.actorId), to = cell(scene, p.space, p.x, p.y);
      target.manualMovementTrace = { eventId: event.id, from: { space: target.space, x: target.x, y: target.y }, to: copy(to) };
      Object.assign(target, to);
    } else if (p.kind === "resource") {
      exactKeys(p, ["kind", "values"]); exactKeys(p.values, RESOURCE_FIELDS);
      if (!Object.keys(p.values).length) fail("Не указаны ресурсы.");
      for (const value of Object.values(p.values)) if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) fail("Ресурс должен быть конечным неотрицательным целым числом.");
      const target = requiredActor(scene, event.actorId), result = { ...target, ...p.values };
      if (Number(result.hp || 0) > Number(result.maxHp || 0)) fail("Здоровье превышает максимум: явно исправьте оба поля.");
      Object.assign(target, p.values);
    } else if (p.kind === "status") {
      exactKeys(p, ["kind", "effectId", "enabled"]); safeId(p.effectId);
      if (typeof p.enabled !== "boolean") fail("Пометка требует явного enabled.");
      const target = requiredActor(scene, event.actorId), statuses = new Set(target.manualStatuses || []);
      if (p.enabled) statuses.add(p.effectId); else statuses.delete(p.effectId);
      target.manualStatuses = [...statuses];
    } else if (p.kind === "technique") {
      exactKeys(p, ["kind", "key", "enabled"]); safeId(p.key);
      if (typeof p.enabled !== "boolean") fail("Пометка приёма требует enabled.");
      const target = requiredActor(scene, event.actorId); target.manualTechniqueState ||= {};
      target.manualTechniqueState[p.key] = p.enabled;
    } else if (p.kind === "roll") {
      exactKeys(p, ["kind", "roll"]);
      exactKeys(p.roll, ["formula", "rolls", "successes", "crits", "outcome", "payment", "target", "dice", "targetIds", "label", "count", "rollKind", "scope", "attribute", "advantage", "hindrance", "criticalAt", "criticalValue", "baseCount", "kept", "dropped", "total"]);
      const roll = p.roll;
      if (!Array.isArray(roll.rolls) || roll.rolls.length > 200 || roll.rolls.some(value => !Number.isSafeInteger(value) || value < 1 || value > 1000)) fail("Некорректные результаты броска.");
      for (const key of ["successes", "crits", "count", "total"]) if (roll[key] !== undefined && (!Number.isSafeInteger(roll[key]) || roll[key] < 0 || roll[key] > 1000000)) fail("Некорректный итог броска.");
      for (const key of ["formula", "label", "outcome", "payment"]) if (roll[key] !== undefined && (typeof roll[key] !== "string" || roll[key].length > 240)) fail("Некорректная подпись броска.");
      if (JSON.stringify(roll).length > 8192) fail("Бросок слишком большой.");
      const owner = event.actorId ? requiredActor(scene, event.actorId) : null;
      scene.rollFeed ||= []; scene.rollFeed.unshift({ ...copy(roll), id: event.id, at: event.at, actorId: event.actorId, actor: owner?.name || "Стол", manual: true, visibility: event.visibility }); scene.rollFeed = scene.rollFeed.slice(0, 20);
    } else if (p.kind === "clock/create") {
      exactKeys(p, ["kind", "clock"]); exactKeys(p.clock, ["id", "name", "kind", "size", "value"]);
      const clock = p.clock; safeId(clock.id);
      if (typeof clock.name !== "string" || !clock.name.trim() || clock.name.length > 160 || !["progress", "danger", "counter"].includes(clock.kind) || !Number.isSafeInteger(clock.size) || clock.size < 1 || clock.size > 1000000 || !Number.isSafeInteger(clock.value ?? 0) || (clock.value ?? 0) < 0 || (clock.value ?? 0) > clock.size) fail("Некорректные ручные часы.");
      if ((scene.sessionClocks || []).some(row => row.id === clock.id)) fail("ID часов уже занят.");
      if (event.actorId) requiredActor(scene, event.actorId);
      scene.sessionClocks ||= []; scene.sessionClocks.push({ ...copy(clock), value: clock.value ?? 0, current: clock.value ?? 0, min: 0, max: clock.size, initial: clock.value ?? 0, ownerActorId: event.actorId, manual: true });
    } else if (["clock/set", "clock/remove"].includes(p.kind)) {
      exactKeys(p, p.kind === "clock/set" ? ["kind", "id", "value"] : ["kind", "id"]); safeId(p.id);
      const clock = (scene.sessionClocks || []).find(row => row.id === p.id);
      if (!clock || !clock.manual) fail("Ручные часы отсутствуют.");
      if (p.kind === "clock/remove") scene.sessionClocks = scene.sessionClocks.filter(row => row.id !== p.id);
      else { if (!Number.isSafeInteger(p.value) || p.value < 0 || p.value > clock.size) fail("Некорректное значение часов."); clock.value = clock.current = p.value; }
    } else if (p.kind === "area/create") {
      exactKeys(p, ["kind", "area"]); exactKeys(p.area, ["id", "space", "cells", "label", "color", "hidden"]);
      const area = p.area; safeId(area.id);
      if (!Array.isArray(area.cells) || !area.cells.length || area.cells.length > 128 || new Set(area.cells).size !== area.cells.length) fail("Некорректная область.");
      for (const value of area.cells) { if (typeof value !== "string" || !/^\d+,\d+$/u.test(value)) fail("Некорректная клетка области."); const [x,y] = value.split(",").map(Number); cell(scene, area.space, x, y); }
      for (const key of ["label", "color"]) if (area[key] !== undefined && (typeof area[key] !== "string" || area[key].length > 200)) fail("Некорректная подпись области.");
      if (area.hidden !== undefined && typeof area.hidden !== "boolean") fail("Некорректная видимость области.");
      if ([...(scene.objects || []), ...(scene.markers || []), ...(scene.walls || []), ...(scene.actors || [])].some(row => row.id === area.id)) fail("ID объекта уже занят.");
      if (event.actorId) requiredActor(scene, event.actorId);
      scene.objects ||= []; scene.objects.push({ ...copy(area), type: "manual-area", manual: true, ownerActorId: event.actorId });
    } else if (p.kind === "area/remove") {
      exactKeys(p, ["kind", "id"]); safeId(p.id);
      const area = (scene.objects || []).find(row => row.id === p.id);
      if (!area || area.type !== "manual-area") fail("Ручная область отсутствует."); removeStoredObject(scene, "objects", p.id);
    } else if (p.kind === "pointer") {
      exactKeys(p, ["kind", "actorId"]);
      if (p.actorId !== null) requiredActor(scene, p.actorId);
      scene.manualTable ||= { actorId: null, round: 1 }; scene.manualTable.actorId = p.actorId;
    } else if (p.kind === "round") {
      exactKeys(p, ["kind", "delta"]);
      if (!Number.isSafeInteger(p.delta) || Math.abs(p.delta) > 1000) fail("Некорректное изменение ручного раунда.");
      scene.manualTable ||= { actorId: null, round: 1 };
      const value = scene.manualTable.round + p.delta;
      if (!Number.isSafeInteger(value) || value < 1) fail("Ручной раунд начинается с 1.");
      scene.manualTable.round = value;
    } else if (p.kind === "marker/create") {
      exactKeys(p, ["kind", "marker"]);
      exactKeys(p.marker, ["id", "space", "x", "y", "kind", "label", "color", "hidden"]);
      const marker = p.marker; safeId(marker.id); cell(scene, marker.space, marker.x, marker.y);
      if ([...(scene.actors || []), ...(scene.objects || []), ...(scene.markers || []), ...(scene.walls || [])].some(row => row.id === marker.id)) fail("ID объекта уже занят.");
      for (const key of ["kind", "label", "color"]) if (marker[key] !== undefined && (typeof marker[key] !== "string" || marker[key].length > 200)) fail("Некорректная подпись метки.");
      if (marker.hidden !== undefined && typeof marker.hidden !== "boolean") fail("Некорректная видимость метки.");
      scene.markers ||= []; scene.markers.push({ ...copy(marker), manual: true });
    } else if (p.kind === "marker/move") {
      exactKeys(p, ["kind", "id", "space", "x", "y"]); safeId(p.id);
      const marker = (scene.markers || []).find(row => row.id === p.id);
      if (!marker) fail("Метка отсутствует."); Object.assign(marker, cell(scene, p.space, p.x, p.y));
    } else if (["marker/remove", "object/remove", "wall/remove"].includes(p.kind)) {
      exactKeys(p, ["kind", "id"]); safeId(p.id);
      removeStoredObject(scene, { "marker/remove": "markers", "object/remove": "objects", "wall/remove": "walls" }[p.kind], p.id);
    } else fail("Неизвестная ручная команда.");
  }
  function dispatchMany(scene, events, options = {}) {
    const contract = global.DAWN_SCENE_ENGINE?.eventPacketContract;
    if (!contract) fail("Общий контракт событий недоступен.", "TABLE_ENGINE_UNAVAILABLE");
    contract.validate(events);
    if (events.some(row => row.type !== "table.command")) fail("Автоматические события выключены в ручном столе.", "TABLE_AUTOMATION_BLOCKED");
    const replay = contract.replayStatus(scene, events);
    if (replay.complete) return { ok: true, scene: copy(scene), events: [], event: null, duplicates: copy(events) };
    if (options.expectedVersion !== undefined && Number(scene.version || 0) !== Number(options.expectedVersion)) fail("Конфликт версии Сцены: обновите состояние.", "SCENE_VERSION_CONFLICT");
    if (options.expectedPolicyEpoch !== undefined && normalizePolicy(scene.tablePolicy).epoch !== options.expectedPolicyEpoch) fail("Политика стола изменилась.", "TABLE_POLICY_CONFLICT");
    const next = copy(scene), output = [], accepted = new Set(replay.matchedIds);
    const reserved = contract.reserveIds(scene, events, options);
    for (const request of events) {
      if (request.id && accepted.has(request.id)) continue;
      if (request.id) accepted.add(request.id);
      const event = { ...copy(request), id: request.id || contract.generatedId(next, `table-${Date.now()}-${++serial}`, reserved),
        at: request.at || new Date().toISOString(), actorId: request.actorId || null, payload: copy(request.payload || {}), visibility: request.visibility || "public" };
      if (!["public", "gm", "owner"].includes(event.visibility)) fail("Некорректная видимость события.");
      if (actor(next, event.actorId)?.hidden || event.payload?.kind === "marker/create" && event.payload.marker?.hidden || event.payload?.kind === "area/create" && event.payload.area?.hidden) event.visibility = "gm";
      reduce(next, event);
      next.version = Number(next.version || 0) + 1;
      next.log ||= []; next.log.unshift(event); next.log = next.log.slice(0, 200);
      output.push(event);
    }
    contract.record(next, events);
    return { ok: true, scene: next, events: output, event: output.at(-1) || null,
      duplicates: copy(events.filter(row => replay.matchedIds.includes(row.id))) };
  }
  function blocked() { fail("Автоматические действия выключены в ручном столе.", "TABLE_AUTOMATION_BLOCKED"); }
  function install(sceneEngine = global.DAWN_SCENE_ENGINE, lionwingEngine = global.DAWN_LIONWING_ENGINE) {
    for (const engine of [sceneEngine, lionwingEngine]) {
      if (!engine || installed.has(engine)) continue;
      for (const name of ["dispatch", "dispatchMany", "previewEvents"]) {
        const original = engine[name]; if (typeof original !== "function") continue;
        engine[name] = function (scene, input, options = {}) {
          const events = name === "dispatch" ? [input] : input;
          if ((events || []).some(row => row?.type === "table.command") || isManual(scene)) {
            if (name === "previewEvents") {
              try { return dispatchMany(scene, events, options); }
              catch (error) { return { ok: false, scene: copy(scene), events: [], errors: [error.message], code: error.code }; }
            }
            return dispatchMany(scene, events, options);
          }
          return original.apply(this, arguments);
        };
      }
      for (const name of Object.keys(engine).filter(key => /^prepare/.test(key) || /^(respond|resolve|cancel)/.test(key) || /^(createEntity|destroyEntity|removeEntity|changeEntityOwner|replayEntityEvent|undoEntityEvent|replay|undo|consumeEvasion)$/.test(key))) {
        const original = engine[name]; if (typeof original !== "function") continue;
        engine[name] = function (scene) {
          if (isManual(scene)) return { ok: false, events: [], errors: ["Автоматические действия выключены в ручном столе."], code: "TABLE_AUTOMATION_BLOCKED" };
          return original.apply(this, arguments);
        };
      }
      if (typeof engine.reload === "function") {
        const original = engine.reload;
        engine.reload = function (scene) {
          const parsed = typeof scene === "string" ? JSON.parse(scene) : scene;
          if (isManual(parsed)) return copy(parsed);
          return original.apply(this, arguments);
        };
      }
      // Internal continuation is an exported mutation entry point too.
      if (engine.eventPacketContract?.dispatchContinuation) {
        const original = engine.eventPacketContract.dispatchContinuation;
        engine.eventPacketContract.dispatchContinuation = function (scene) { if (isManual(scene)) blocked(); return original.apply(this, arguments); };
      }
      installed.add(engine);
    }
    return global.DAWN_TABLE_POLICY;
  }
  global.DAWN_TABLE_POLICY = { isManual, normalizePolicy, dispatchMany, install, pendingWork, resourceFields: RESOURCE_FIELDS };
})(typeof window === "object" ? window : globalThis);
