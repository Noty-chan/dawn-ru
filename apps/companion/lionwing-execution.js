"use strict";

// Pure, serializable consequence frames. Only the kernel applies operations.
(function (global) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const reject = message => { throw new Error(message); };
  const id = (value, label) => {
    if (typeof value !== "string" || !value || value.length > 180) reject(`Некорректный ID: ${label}`);
    return value;
  };
  const amount = (value, label = "количество") => {
    if (!Number.isSafeInteger(value) || value < 0 || value > 9999) reject(`Некорректное значение: ${label}`);
    return value;
  };
  const serial = (value, label) => {
    if (!Number.isSafeInteger(value) || value < 0) reject(`Некорректное значение: ${label}`);
    return value;
  };
  const plain = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const serializable = value => {
    try { return JSON.stringify(value) !== undefined; } catch { return false; }
  };
  const cursorStatuses = new Set(["running", "waiting", "completed"]);
  const scopes = new Set(["rootAction", "action", "ownerTurn", "anyTurn", "round", "scene", "chapter"]);
  const factTypes = new Set(["attempt", "apply", "hit", "damage", "healthLoss", "heal", "wound", "knockout", "spend", "gain", "preventedGain", "roll", "cancel", "counter.threshold"]);
  const rollKinds = new Set(["check", "opposed", "raw-d6"]);
  const lifetimeNames = new Set(["default", "startTurn", "endTurn", "nextTurn", "roundEnd", "scene", "persistent", "manual", "turn", "round", "chapter", "session"]);
  const lifetimeBoundaries = new Set(["startNextOwnerTurn", "endNextOwnerTurn"]);
  const boundaryPhases = new Set(["start", "end"]);

  // A lifetime boundary is data, rather than an implicit comparison against
  // the scene-wide turnSerial.  The owner serial is the number of the owner's
  // own started Turns at the moment the lifetime is created.  Consequently a
  // source can remain active through any number of other participants' Turns.
  const normalizeBoundaryName = value => {
    const aliases = {
      "start-next-owner-turn": "startNextOwnerTurn",
      "end-next-owner-turn": "endNextOwnerTurn",
      "nextOwnerTurnStart": "startNextOwnerTurn",
      "nextOwnerTurnEnd": "endNextOwnerTurn",
      "ownerTurnStart": "startNextOwnerTurn",
      "ownerTurnEnd": "endNextOwnerTurn",
      "startNextTurn": "startNextOwnerTurn",
      "endNextTurn": "endNextOwnerTurn",
      "turn-start": "start",
      "turn-end": "end",
    };
    return aliases[value] || value;
  };
  const normalizeBoundaryPhase = value => ({ startTurn: "start", endTurn: "end", "turn-start": "start", "turn-end": "end", startNextOwnerTurn: "start", endNextOwnerTurn: "end" }[value] || value);
  const optionalSerial = (value, label, fallback = null) => {
    if (value == null) return fallback;
    return serial(value, label);
  };

  function lifetimeBoundary(value, defaults = {}) {
    if (value == null) return null;
    const raw = typeof value === "string" ? { boundary: value } : value;
    if (!plain(raw)) reject("Граница срока должна быть объектом или строкой");
    const boundary = normalizeBoundaryName(raw.boundary ?? raw.kind ?? raw.phase);
    if (!lifetimeBoundaries.has(boundary)) reject("Неизвестная граница срока");
    const ownerActorId = raw.ownerActorId ?? raw.boundaryOwnerId ?? defaults.ownerActorId;
    if (typeof ownerActorId !== "string" || !ownerActorId || ownerActorId.length > 180) reject("Границе срока нужен владелец Хода");
    const ownerTurnSerial = optionalSerial(raw.ownerTurnSerial ?? raw.serial ?? raw.turnSerial ?? defaults.ownerTurnSerial, "номер собственного Хода");
    if (ownerTurnSerial == null) reject("Границе срока нужен номер собственного Хода");
    const sceneSerial = optionalSerial(raw.sceneSerial ?? defaults.sceneSerial, "Сцена", 1);
    const ownerTurnInstanceId = raw.ownerTurnInstanceId ?? raw.turnInstanceId ?? defaults.ownerTurnInstanceId ?? null;
    if (ownerTurnInstanceId != null) id(ownerTurnInstanceId, "экземпляр собственного Хода");
    return copy({ schema: 1, kind: "turn-boundary", boundary, ownerActorId, ownerTurnSerial, ownerTurnKey: `${sceneSerial}:${ownerActorId}:${ownerTurnSerial}`, sceneSerial, ownerTurnInstanceId });
  }

  function normalizeLifetime(value, defaults = {}) {
    if (value == null) return null;
    if (typeof value === "string") {
      if (!lifetimeNames.has(value) && !lifetimeBoundaries.has(normalizeBoundaryName(value))) reject("Неизвестный срок жизни");
      if (lifetimeBoundaries.has(normalizeBoundaryName(value))) return lifetimeBoundary(value, defaults);
      return value;
    }
    return lifetimeBoundary(value, defaults);
  }

  // Strict query used by effects, counters and future rule families.  It only
  // returns true at the requested owner's boundary; a foreign Turn never
  // consumes the interval.  `phase` is intentionally mandatory for a turn
  // boundary so callers cannot accidentally treat a status/render query as an
  // expiry transition.
  function lifetimeExpired(value, query = {}) {
    const lifetime = normalizeLifetime(value);
    if (!lifetime || typeof lifetime !== "object") return false;
    if (!plain(query)) reject("Запрос истечения должен быть объектом");
    const queriedBoundary = query.boundary == null ? null : normalizeBoundaryName(query.boundary);
    const phase = normalizeBoundaryPhase(query.phase ?? (boundaryPhases.has(queriedBoundary) ? queriedBoundary : queriedBoundary === "startNextOwnerTurn" ? "start" : queriedBoundary === "endNextOwnerTurn" ? "end" : null));
    const canonicalBoundary = queriedBoundary != null && lifetimeBoundaries.has(queriedBoundary) ? queriedBoundary : null;
    if (!boundaryPhases.has(phase) || query.boundary != null && queriedBoundary !== phase && canonicalBoundary == null) reject("Запрос истечения должен содержать фазу границы");
    const ownerActorId = query.ownerActorId ?? query.actorId;
    if (ownerActorId !== lifetime.ownerActorId) return false;
    const sceneSerial = query.sceneSerial;
    if (sceneSerial != null && sceneSerial !== lifetime.sceneSerial) return false;
    const currentSerial = query.ownerTurnSerial ?? query.currentOwnerTurnSerial ?? query.ownerSerial ?? query.serial ?? query.turnSerial;
    if (!Number.isSafeInteger(currentSerial) || currentSerial < 0) reject("Запрос истечения требует номер собственного Хода");
    if (canonicalBoundary != null && lifetime.boundary !== canonicalBoundary) return false;
    // A boundary is crossed once the next own serial has been reached.  `>=`
    // keeps a reloaded/late query truthful even if an intervening event was
    // compacted; a foreign owner still cannot consume the lifetime.
    if (currentSerial < lifetime.ownerTurnSerial + 1) return false;
    return lifetime.boundary === (phase === "start" ? "startNextOwnerTurn" : "endNextOwnerTurn");
  }

  function identity(value = {}) {
    const result = {
      rootActionId: id(value.rootActionId, "rootAction"),
      actionId: value.actionId == null ? null : id(value.actionId, "action"),
      actionDefinitionId: value.actionDefinitionId == null ? (value.actionId == null ? null : id(value.actionId, "action definition")) : id(value.actionDefinitionId, "action definition"),
      actionInstanceId: value.actionInstanceId == null ? null : id(value.actionInstanceId, "action instance"),
      effectInstanceId: value.effectInstanceId == null ? null : id(value.effectInstanceId, "effectInstance"),
      causeEventId: value.causeEventId == null ? value.rootActionId : id(value.causeEventId, "causeEvent"),
      ownerActorId: id(value.ownerActorId, "owner"),
    };
    if (value.consequenceId != null) result.consequenceId = id(value.consequenceId, "consequence");
    if (value.ruleId != null) result.ruleId = id(value.ruleId, "rule");
    return result;
  }

  function open(original, metadata, replacements = []) {
    if (!metadata.id || !metadata.ownerActorId) reject("Последствию нужны ID и владелец решения");
    if (new Set(replacements.map(rule => rule.id)).size !== replacements.length) reject("Повтор ID замены");
    for (const rule of replacements) {
      if (!rule.id || rule.id === "keep" || !rule.label || !Array.isArray(rule.operations) || !rule.operations.length) reject("Некорректная замена последствия");
    }
    const provenance = identity({ ...metadata, rootActionId: metadata.rootActionId || metadata.id, consequenceId: metadata.id });
    if (!plain(original) || !serializable(original) || !serializable(replacements)) reject("Последствие должно быть сохраняемым JSON");
    return copy({ schema: 2, id: provenance.consequenceId, ...provenance, original, replacements, phase: "before", selected: null, cursor: 0, results: [], responderActorId: provenance.ownerActorId, purpose: metadata.purpose || null });
  }
  function choose(frame, selection) {
    if (frame.phase !== "before") reject("Выбор последствия уже завершён");
    if (selection !== "keep" && !frame.replacements.some(rule => rule.id === selection)) reject("Замена недоступна");
    return { ...copy(frame), phase: selection === "keep" ? "apply" : "replace", selected: selection };
  }
  function plan(frame) {
    if (!["apply", "replace"].includes(frame.phase)) reject("Последствие ожидает решения");
    const replaced = frame.phase === "replace";
    const rule = replaced ? frame.replacements.find(rule => rule.id === frame.selected) : null;
    if (replaced && !rule) reject("Замена отсутствует в сохранённом плане");
    return copy({ operations: replaced ? rule.operations : [frame.original], outcome: replaced ? "replaced" : "applied", ruleId: rule?.id || null });
  }

  // A cursor describes only progress through an already persisted queue. The
  // queue remains owned by the kernel in `scene.lionwing.deferred`; keeping
  // this small companion record lets a reload identify the exact waiting
  // choice without copying executable functions or creating another queue.
  function openCursor(metadata = {}) {
    if (!plain(metadata)) reject("Курсор исполнения должен быть объектом");
    if (metadata.schema != null && metadata.schema !== 1) reject("Версия курсора исполнения не поддерживается");
    const total = amount(metadata.total ?? 0, "число операций курсора");
    const cursor = amount(metadata.cursor ?? 0, "позиция курсора");
    if (cursor > total) reject("Позиция курсора выходит за число операций");
    const rootActionId = id(metadata.rootActionId, "rootAction курсора");
    const ownerActorId = id(metadata.ownerActorId, "владелец курсора");
    const responderActorId = id(metadata.responderActorId ?? ownerActorId, "отвечающий курсора");
    const waitingChoiceId = metadata.waitingChoiceId == null ? null : id(metadata.waitingChoiceId, "choice курсора");
    const status = metadata.status ?? (waitingChoiceId ? "waiting" : cursor >= total ? "completed" : "running");
    if (!cursorStatuses.has(status)) reject("Неизвестный статус курсора");
    if (status === "waiting" && !waitingChoiceId) reject("Ожидающему курсору нужен choice");
    if (status !== "waiting" && waitingChoiceId) reject("Ожидающий choice есть только у курсора в ожидании");
    if (status === "running" && cursor >= total) reject("Рабочий курсор не содержит незавершённых операций");
    if (status === "waiting" && cursor >= total) reject("Ожидающий курсор не содержит незавершённых операций");
    if (status === "completed" && cursor !== total) reject("Завершённый курсор содержит незавершённые операции");
    const results = Array.isArray(metadata.results) ? metadata.results.slice(-192).map((result, index) => {
      if (!plain(result)) reject("Результат курсора должен быть объектом");
      return { index: Number.isSafeInteger(result.index) ? result.index : index, status: String(result.status || "completed").slice(0, 32), stepId: result.stepId == null ? null : id(result.stepId, "шага курсора") };
    }) : [];
    return copy({
      schema: 1,
      id: id(metadata.id, "курсора"),
      rootActionId,
      actionId: metadata.actionId == null ? null : id(metadata.actionId, "action курсора"),
      actionInstanceId: metadata.actionInstanceId == null ? null : id(metadata.actionInstanceId, "экземпляр действия курсора"),
      ownerActorId,
      responderActorId,
      phase: String(metadata.phase || "apply").slice(0, 32),
      cursor,
      total,
      results,
      waitingChoiceId,
      status,
    });
  }

  function advanceCursor(frame, result = {}) {
    const current = openCursor(frame);
    if (current.status !== "running") reject("Курсор не принимает следующий результат");
    if (current.cursor >= current.total) reject("Курсор уже завершён");
    const stepId = result?.stepId == null ? null : id(result.stepId, "шага курсора");
    const status = String(result?.status || "completed").slice(0, 32);
    const nextCursor = current.cursor + 1;
    return copy({ ...current, cursor: nextCursor, results: [...current.results, { index: current.cursor, status, stepId }].slice(-192), status: nextCursor >= current.total ? "completed" : "running" });
  }

  function resizeCursor(frame, total) {
    const current = openCursor(frame), nextTotal = amount(total, "число операций курсора");
    if (nextTotal < current.cursor) reject("Число операций курсора меньше его позиции");
    const status = current.status === "completed" && nextTotal > current.cursor ? "running" : current.status;
    return copy({ ...current, total: nextTotal, status });
  }

  function waitCursor(frame, choiceId, responderActorId = frame?.responderActorId) {
    const current = openCursor(frame), waitingChoiceId = id(choiceId, "choice курсора"), responder = id(responderActorId ?? current.responderActorId, "отвечающий курсора");
    if (current.status !== "running") reject("Курсор не может перейти в ожидание");
    return copy({ ...current, status: "waiting", waitingChoiceId, responderActorId: responder });
  }

  function resumeCursor(frame, choiceId, responderActorId = frame?.responderActorId) {
    const current = openCursor(frame), responseId = id(choiceId, "choice ответа"), responder = id(responderActorId ?? current.responderActorId, "отвечающий ответа");
    if (current.status !== "waiting" || current.waitingChoiceId !== responseId || current.responderActorId !== responder) reject("Ответ не соответствует ожидающему курсору");
    return copy({ ...current, status: current.cursor >= current.total ? "completed" : "running", waitingChoiceId: null });
  }

  function fact(type, context, details = {}) {
    if (!factTypes.has(type)) reject("Неизвестный тип исторического факта");
    if (!plain(details) || !serializable(details)) reject("Исторический факт должен быть сохраняемым JSON");
    const provenance = identity(context);
    // `scene` is a provenance owner, never an actor.  This matters for
    // narrator-authored damage: the target remains a target and is not
    // silently promoted to the event subject or author.
    const actorId=Object.hasOwn(context,"actorId")?context.actorId:(provenance.ownerActorId === "scene" ? null : provenance.ownerActorId);
    if(actorId!==null&&typeof actorId!=="string")reject("Некорректный субъект исторического факта");
    const ownerTurnActorId = context.ownerTurnActorId == null ? null : id(context.ownerTurnActorId, "участник текущего Хода");
    const ownerTurnSerial = context.ownerTurnSerial == null ? null : serial(context.ownerTurnSerial, "номер текущего собственного Хода");
    const ownerTurnInstanceId = context.ownerTurnInstanceId == null ? null : id(context.ownerTurnInstanceId, "экземпляр текущего собственного Хода");
    const turnInstanceId = context.turnInstanceId == null ? null : id(context.turnInstanceId, "экземпляр Хода");
    const sceneSerial = serial(context.sceneSerial ?? 1, "Сцена");
    return copy({
      schema: 2,
      id: id(context.id, "history"),
      type,
      ...provenance,
      actorId,
      subjectKind: actorId === null ? "scene" : "actor",
      targetIds: [...new Set((context.targetIds || []).filter(value => typeof value === "string"))].slice(0, 40),
      round: serial(context.round ?? 0, "Раунд"),
      turnSerial: serial(context.turnSerial ?? 0, "Ход"),
      turnInstanceId,
      ownerTurnActorId,
      ownerTurnSerial,
      ownerTurnInstanceId,
      ownerTurnKey: ownerTurnActorId && ownerTurnSerial != null ? `${sceneSerial}:${ownerTurnActorId}:${ownerTurnSerial}` : null,
      sceneSerial,
      chapterSerial: serial(context.chapterSerial ?? 1, "Глава"),
      details,
    });
  }

  function inScope(item, query = {}) {
    if (!scopes.has(query.scope)) reject("Неизвестная область истории");
    const legacyTurnSerial = typeof (query.turnInstanceId ?? query.ownerTurnInstanceId) === "string" ? Number(String(query.turnInstanceId ?? query.ownerTurnInstanceId).match(/^legacy-turn:(\d+)$/)?.[1]) : null;
    const queryTurnSerial = query.turnSerial ?? (Number.isSafeInteger(legacyTurnSerial) ? legacyTurnSerial : undefined);
    if (query.type && item.type !== query.type || query.ruleId && item.ruleId !== query.ruleId || Object.hasOwn(query, "actorId") && query.actorId !== undefined && item.actorId !== query.actorId || query.targetId && !item.targetIds.includes(query.targetId) || query.ownerActorId && item.ownerActorId !== query.ownerActorId) return false;
    if (query.scope === "rootAction") return item.rootActionId === query.rootActionId;
    if (query.scope === "action") return query.actionInstanceId ? item.actionInstanceId === query.actionInstanceId : item.actionId === query.actionId && (!query.rootActionId || item.rootActionId === query.rootActionId);
    if (query.scope === "ownerTurn") {
      if (query.ownerTurnKey != null) return item.ownerTurnKey === query.ownerTurnKey;
      if (item.sceneSerial !== query.sceneSerial || item.ownerTurnActorId !== query.ownerActorId) return false;
      const instanceId = query.ownerTurnInstanceId ?? query.turnInstanceId;
      if (instanceId != null) {
        const itemInstanceId = item.ownerTurnInstanceId ?? item.turnInstanceId;
        return itemInstanceId != null ? itemInstanceId === instanceId : (item.ownerTurnSerial ?? item.turnSerial) === (query.ownerTurnSerial ?? query.serial ?? queryTurnSerial);
      }
      const ownerSerial = query.ownerTurnSerial ?? query.serial;
      // New facts use the participant's own serial.  Old facts fall back to
      // the global turnSerial so existing saves remain queryable.
      return ownerSerial != null ? (item.ownerTurnSerial ?? item.turnSerial) === ownerSerial : item.turnSerial === queryTurnSerial;
    }
    if (query.scope === "anyTurn") {
      if (item.sceneSerial !== query.sceneSerial) return false;
      if (query.turnInstanceId != null) return item.turnInstanceId != null ? item.turnInstanceId === query.turnInstanceId : item.turnSerial === queryTurnSerial;
      return item.turnSerial === queryTurnSerial;
    }
    if (query.scope === "round") return item.sceneSerial === query.sceneSerial && item.round === query.round;
    if (query.scope === "scene") return item.sceneSerial === query.sceneSerial;
    return item.chapterSerial === query.chapterSerial;
  }

  function historyCount(history, query) {
    return (Array.isArray(history) ? history : []).filter(item => inScope(item, query)).length;
  }

  function normalizeCosts(costs) {
    if (!Array.isArray(costs) || !costs.length || costs.length > 16) reject("Составная цена должна содержать от 1 до 16 частей");
    return costs.map((part, index) => {
      if (!plain(part) || !["resource", "health"].includes(part.kind)) reject("Неизвестная часть составной цены");
      if (part.kind === "health" && ![undefined, "spend", "lose"].includes(part.mode)) reject("Неизвестный способ потери Здоровья");
      return part.kind === "health"
        ? { kind: "health", mode: part.mode || "spend", amount: amount(part.amount, `цена ${index + 1}`) }
        : { kind: "resource", resource: id(part.resource, `ресурс ${index + 1}`), amount: amount(part.amount, `цена ${index + 1}`) };
    }).filter(part => part.amount > 0);
  }

  function reserveCost(sceneVersion, actorId, targetIds, costs) {
    return copy({ schema: 1, sceneVersion: serial(sceneVersion, "версия Сцены"), actorId: id(actorId, "плательщик"), targetIds: [...new Set((targetIds || []).map(value => id(value, "цель")))].slice(0, 40), costs: normalizeCosts(costs) });
  }

  function normalizeRoll(value, rules = {}) {
    const kind = rules.kind || value?.kind || "check";
    if (!rollKinds.has(kind)) reject("Неизвестный вид броска");
    const pool = amount(value?.initialCount ?? value?.pool, "исходный пул");
    if(pool>100)reject("Пул ограничен 100 костями");
    const sourceFaces = copy(value?.sourceFaces || value?.rolls || []);
    if (sourceFaces.length > 300 || sourceFaces.some(face => !Number.isInteger(face) || face < 1 || face > 6)) reject("Некорректные грани броска");
    const criticalAt = rules.criticalAt ?? value?.critAt ?? 6;
    const successAt = rules.successAt ?? 4;
    const explode = kind === "raw-d6" ? false : rules.explode ?? value?.explode !== false;
    if (![5, 6].includes(criticalAt) || !Number.isInteger(successAt) || successAt < 2 || successAt > 6) reject("Некорректные ограничения броска");
    const criticals = sourceFaces.filter(face => face >= criticalAt).length;
    if (sourceFaces.length !== pool + (explode ? criticals : 0)) reject("Бросок содержит незавершённые или лишние кости");
    if (rules.hitAdjustment) reject("Изменения успехов ещё не поддерживаются этим контрактом броска");
    const hits = kind === "raw-d6" ? null : sourceFaces.filter(face => face >= successAt).length;
    const modifications = copy(rules.modifications || []);
    if (!Array.isArray(modifications) || modifications.length) reject("Изменения граней ещё не поддерживаются этим контрактом броска");
    return { schema: 1, kind, pool, sourceFaces, finalFaces: copy(sourceFaces), rules: { successAt, criticalAt, explode }, modifications, hits, criticals, initialCount: pool, rolls: copy(sourceFaces), successes: hits, crits: criticals, formula: `${pool}D6`, ...(criticalAt !== 6 || !explode ? { critAt: criticalAt, explode } : {}) };
  }

  global.DAWN_LIONWING_EXECUTION = Object.freeze({
    open, choose, plan, openCursor, advanceCursor, resizeCursor, waitCursor, resumeCursor,
    identity, fact, inScope, historyCount,
    lifetimeBoundary, normalizeLifetime, lifetimeExpired,
    // Short aliases make the pure query usable by foundations without exposing
    // another mutable registry or storing executable callbacks in saves.
    boundaryDescriptor: lifetimeBoundary,
    isLifetimeExpired: lifetimeExpired,
    normalizeCosts, reserveCost, normalizeRoll,
  });
})(typeof window === "object" ? window : globalThis);
