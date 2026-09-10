"use strict";

// Shared combat counters. The engine is the only writer: this module provides
// canonical metadata, read-only quotes and an atomic transition primitive.
(function installCombatMeter(global) {
  const VERSION = 1;
  const TENSION_ID = "tension";
  const METER_ID = /^[a-z][a-z0-9._:-]{0,119}$/i;
  const LIFETIMES = new Set(["manual", "turn", "round", "scene", "chapter", "session"]);
  const SCOPES = new Set(["manual", "turn", "round", "scene", "chapter", "session"]);
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };
  const integer = (value, label, min = 0, max = 9999) => {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(`Некорректное значение: ${label}`);
    return value;
  };
  const text = (value, label, max = 180) => {
    if (typeof value !== "string" || !value.trim() || value.length > max) fail(`Некорректное значение: ${label}`);
    return value.trim();
  };
  const plain = value => Boolean(value && typeof value === "object" && !Array.isArray(value));

  function baseTension(scene) {
    const value = Number(scene?.tension);
    return Number.isSafeInteger(value) && value >= 0 ? Math.min(999, value) : 0;
  }

  function definition(scene, id = TENSION_ID, input = {}, previous = null) {
    const old = plain(previous) ? previous : {};
    const isTension = id === TENSION_ID;
    const owner = input.owner || old.owner || { kind: "scene", id: "scene" };
    const source = input.source || old.source || { kind: "engine", id: "lionwing-engine" };
    if (!plain(owner) || typeof owner.kind !== "string" || typeof owner.id !== "string") fail("Счётчику нужен владелец");
    if (!plain(source) || typeof source.kind !== "string" || typeof source.id !== "string") fail("Счётчику нужен источник");
    const min = integer(input.min ?? old.min ?? 0, "минимум", 0, 9999);
    const max = integer(input.max ?? old.max ?? (isTension ? 999 : 9999), "максимум", min, 9999);
    const scope = input.scope ?? old.scope ?? (isTension ? "scene" : "manual");
    const lifetime = input.lifetime ?? old.lifetime ?? scope;
    if (!SCOPES.has(scope)) fail("Неизвестная область счётчика");
    if (!LIFETIMES.has(lifetime)) fail("Неизвестный срок жизни счётчика");
    const initial = integer(input.initial ?? old.initial ?? min, "начальное значение", min, max);
    const current = integer(input.current ?? old.current ?? old.value ?? (isTension ? baseTension(scene) : initial), "текущее значение", min, max);
    const thresholdRaw = input.threshold ?? old.threshold ?? null;
    const threshold = thresholdRaw == null ? null : integer(thresholdRaw, "порог", min, max);
    const label = text(input.label ?? old.label ?? (isTension ? "Напряжение" : id), "название счётчика", 120);
    return {
      schema: VERSION, id, kind: "meter", label, name: label,
      owner: { kind: owner.kind, id: owner.id }, source: { kind: source.kind, id: source.id },
      ownerActorId: owner.kind === "actor" ? owner.id : null,
      sourceActorId: source.kind === "actor" ? source.id : null,
      scope, lifetime, min, max, minimum: min, maximum: max,
      initial, current, value: current, threshold,
      active: old.active !== false, revision: Number.isSafeInteger(old.revision) && old.revision >= 0 ? old.revision : 0,
      receipts: Array.isArray(old.receipts) ? old.receipts.slice(-64) : [],
    };
  }

  function ensureScene(scene) {
    if (!scene || typeof scene !== "object") return scene;
    scene.lionwing ||= {};
    const meters = scene.lionwing.meters;
    if (!plain(meters)) scene.lionwing.meters = {};
    const previous = plain(scene.lionwing.meters[TENSION_ID]) ? scene.lionwing.meters[TENSION_ID] : null;
    // Legacy saves are imported once. Afterwards the typed meter is the
    // authority and scene.tension is only a compatibility projection.
    const normalized = definition(scene, TENSION_ID, {}, previous);
    scene.lionwing.meters[TENSION_ID] = normalized;
    scene.tension = normalized.current;
    return scene;
  }

  function read(scene, id = TENSION_ID) {
    if (!scene || typeof scene !== "object") return null;
    const snapshot = copy(scene);
    ensureScene(snapshot);
    const meter = snapshot?.lionwing?.meters?.[id];
    return meter ? copy(meter) : null;
  }

  function quote(scene, id = TENSION_ID, change = {}) {
    const current = read(scene, id);
    if (!current) return { ok: false, reason: "Счётчик не найден" };
    try {
      const operation = change.operation || (change.delta !== undefined ? "add" : "set");
      if (!["set", "add", "reset"].includes(operation)) fail("Неизвестная операция счётчика");
      const requested = operation === "add" ? integer(change.delta, "изменение", -9999, 9999) : operation === "reset" ? current.initial : integer(change.value ?? change.current, "новое значение", current.min, current.max);
      const next = operation === "add" ? current.current + requested : requested;
      integer(next, "итоговое значение", current.min, current.max);
      return { ok: true, id, operation, before: current.current, value: next, current: next, min: current.min, max: current.max, threshold: current.threshold, changed: next !== current.current };
    } catch (error) { return { ok: false, reason: error.message }; }
  }

  function apply(scene, id = TENSION_ID, change = {}, options = {}) {
    ensureScene(scene);
    const meter = scene.lionwing.meters[id];
    if (!meter) fail("Счётчик не найден");
    const receiptId = options.receiptId ?? change.receiptId;
    if (receiptId != null && (typeof receiptId !== "string" || !receiptId)) fail("Изменение счётчика требует receiptId");
    if (receiptId != null && meter.receipts.includes(receiptId)) return { meter: copy(meter), before: meter.current, value: meter.current, changed: false, idempotent: true, receiptId };
    const checked = quote(scene, id, change);
    if (!checked.ok) fail(checked.reason);
    const next = { ...meter, current: checked.value, value: checked.value, revision: meter.revision + 1 };
    if (receiptId != null) next.receipts = [...meter.receipts, receiptId].slice(-64);
    scene.lionwing.meters[id] = next;
    scene.tension = id === TENSION_ID ? next.current : scene.tension;
    return { meter: copy(next), before: checked.before, value: checked.value, changed: checked.changed, idempotent: false, receiptId, thresholdCrossed: meter.threshold != null && meter.current < meter.threshold && next.current >= meter.threshold };
  }

  const api = { schema: VERSION, ids: { tension: TENSION_ID }, ensureScene, definition, read, quote, apply };
  global.DAWN_LIONWING_COMBAT_METER = api;
})(typeof window === "object" ? window : globalThis);
