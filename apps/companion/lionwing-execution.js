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
  function assertJson(value, path = "$", depth = 0, seen = new Set()) {
    if (depth > 20) reject(`Слишком глубокий JSON: ${path}`);
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) reject(`Число должно быть конечным: ${path}`);
      return value;
    }
    if (typeof value !== "object") reject(`Значение не является JSON: ${path}`);
    if (seen.has(value)) reject(`Циклический JSON: ${path}`);
    seen.add(value);
    if (Array.isArray(value)) value.forEach((item, index) => assertJson(item, `${path}[${index}]`, depth + 1, seen));
    else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== null && prototype !== Object.prototype && prototype?.constructor?.name !== "Object") reject(`Ожидался обычный JSON-объект: ${path}`);
      for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) reject(`Запрещённое поле JSON: ${path}.${key}`);
      assertJson(item, `${path}.${key}`, depth + 1, seen);
      }
    }
    seen.delete(value);
    return value;
  }
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

  // ActionPlan is the declaration layer; execution owns the serializable
  // reservation and the ordered queue that a reducer may consume.  This
  // bridge deliberately returns data only.  It never receives a Scene and
  // therefore cannot spend a resource or apply an operation by accident.
  const actionPlanOperationKinds = new Set([
    "automation", "action", "attack", "damage", "spend-health", "lose-health", "heal", "wound", "stress", "knockout",
    "resource", "correct", "effect", "effect-source", "aura", "aura-create", "aura-update", "aura-suppress", "aura-restore", "aura-remove",
    "move", "geometry-move", "geometry-segment", "modifier", "allow-action", "grant-turn", "usage", "punish", "invisible", "search",
    "configure-resource", "counter", "clock", "prompt", "choice", "roll", "reaction", "resolve-attack", "cancel-attack", "turn-start", "turn-end",
    "round-end", "scene-reset", "chapter-start", "tension", "note", "plan", "batch", "pause-chain", "resume-chain", "record-action", "recover-track",
    "amend-attack",
  ]);
  const ACTION_PLAN_PHASES = ["before", "replace", "apply", "after"];

  function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

  function actionPlanInput(value) {
    let input = value;
    if (typeof input === "string") {
      try { input = JSON.parse(input); } catch { reject("JSON ActionPlan не разбирается"); }
    }
    if (!plain(input)) reject("ActionPlan исполнения должен быть JSON-объектом");
    assertJson(input);
    return input;
  }

  function actionPlanIdentity(input) {
    const plan = plain(input.plan) && input.kind !== "lionwing.action-plan" ? input.plan : input;
    const aliases = (object, names, label) => {
      const values = names.filter(name => Object.hasOwn(object, name) && object[name] != null).map(name => object[name]);
      if (values.length > 1 && values.some(value => !sameJson(value, values[0]))) reject(`Дублирующиеся ID расходятся: ${label}`);
    };
    for (const [names, label] of [[["planId", "id"], "плана действия"], [["rootActionId", "rootId"], "rootAction плана"], [["definitionId", "actionDefinitionId", "actionId"], "definition плана"], [["actionInstanceId", "instanceId"], "экземпляра действия"]]) aliases(plan, names, label);
    if (plan !== input && plain(input.plan)) for (const [names, label] of [[["planId", "id"], "плана действия"], [["rootActionId", "rootId"], "rootAction плана"], [["definitionId", "actionDefinitionId", "actionId"], "definition плана"], [["actionInstanceId", "instanceId"], "экземпляра действия"]]) {
      const nested = names.find(name => Object.hasOwn(plan, name) && plan[name] != null);
      const outer = names.find(name => Object.hasOwn(input, name) && input[name] != null);
      if (nested && outer && !sameJson(plan[nested], input[outer])) reject(`ID ${label} расходится с вложенным ActionPlan`);
    }
    const planId = id(plan.planId ?? plan.id, "плана действия");
    const rootActionId = id(plan.rootActionId ?? plan.rootId, "rootAction плана");
    const definitionId = id(plan.definitionId ?? plan.actionDefinitionId ?? plan.actionId, "definition плана");
    const actionInstanceId = id(plan.actionInstanceId ?? plan.instanceId, "экземпляра действия");
    const ownerActorId = id(plan.ownerActorId ?? plan.owner?.actorId ?? plan.owner?.id ?? plan.sourceActorId ?? plan.source?.actorId ?? "scene", "владельца плана");
    const sourceActorId = plan.sourceActorId ?? plan.source?.actorId ?? (ownerActorId === "scene" ? null : ownerActorId);
    if (sourceActorId != null) id(sourceActorId, "источника плана");
    const causeEventId = plan.causeEventId ?? plan.source?.causeEventId ?? null;
    if (causeEventId != null) id(causeEventId, "причины плана");
    return { plan, planId, rootActionId, definitionId, actionInstanceId, ownerActorId, sourceActorId: sourceActorId ?? null, causeEventId: causeEventId ?? null };
  }

  function actionPlanTargets(plan, options = {}) {
    const rows = Array.isArray(plan.targets)
      ? plan.targets
      : Array.isArray(plan.targetSnapshots)
        ? plan.targetSnapshots
        : Array.isArray(plan.targetIds)
          ? plan.targetIds.map(targetId => ({ targetId, snapshot: {} }))
          : [];
    if (rows.length > 40) reject("ActionPlan содержит слишком много целей");
    const seen = new Set();
    const targets = rows.map((raw, index) => {
      const row = typeof raw === "string" ? { targetId: raw, snapshot: {} } : raw;
      if (!plain(row)) reject(`Цель исполнения ${index + 1} должна быть объектом`);
      const targetId = id(row.targetId ?? row.id, `цели исполнения ${index + 1}`);
      if (seen.has(targetId)) reject(`Повтор цели исполнения: ${targetId}`);
      seen.add(targetId);
      const snapshot = row.snapshot ?? row.values ?? {};
      if (!plain(snapshot) || !serializable(snapshot)) reject(`Снимок цели ${targetId} должен быть JSON-объектом`);
      return { targetId, snapshot: copy(snapshot), ...(row.role == null ? {} : { role: String(row.role) }) };
    });
    const targetIds = targets.map(target => target.targetId);
    if (Array.isArray(plan.targetIds) && !sameJson(targetIds, plan.targetIds)) reject("targetIds расходятся со снимками целей исполнения");
    for (const supplied of [plan.targetSnapshots, plan.snapshots?.targets]) if (supplied != null && (!Array.isArray(supplied) || !sameJson(supplied, targets))) reject("Снимок целей изменён после предпросмотра");
    if (options.targetSnapshots != null) {
      if (!Array.isArray(options.targetSnapshots) || !sameJson(options.targetSnapshots, targets)) reject("Снимок целей изменён после предпросмотра");
    }
    return { targets, targetIds };
  }

  function actionPlanCosts(plan) {
    const raw = plan.costs ?? plan.snapshots?.costs ?? [];
    if (raw == null) return [];
    if (!Array.isArray(raw)) reject("Цена ActionPlan исполнения должна быть массивом");
    if (plan.costs != null && plan.snapshots?.costs != null && !sameJson(plan.costs, plan.snapshots.costs)) reject("Снимки цены расходятся");
    return raw.length ? normalizeCosts(raw) : [];
  }

  function actionPlanModifiers(plan, options = {}) {
    const raw = plan.modifiers ?? plan.modifierSnapshots ?? plan.snapshots?.modifiers ?? [];
    if (!Array.isArray(raw) || raw.length > 96) reject("Некорректный снимок модификаторов ActionPlan");
    if (plan.modifiers != null && plan.modifierSnapshots != null && !sameJson(plan.modifiers, plan.modifierSnapshots) || plan.modifiers != null && plan.snapshots?.modifiers != null && !sameJson(plan.modifiers, plan.snapshots.modifiers)) reject("Снимки модификаторов расходятся");
    const seen = new Set();
    const modifiers = raw.map((modifier, index) => {
      if (!plain(modifier)) reject(`Модификатор исполнения ${index + 1} должен быть объектом`);
      const idValue = id(modifier.id, `модификатора исполнения ${index + 1}`);
      if (seen.has(idValue)) reject(`Повтор ID модификатора исполнения: ${idValue}`);
      seen.add(idValue);
      if (modifier.sourceId != null) id(modifier.sourceId, `источника модификатора ${idValue}`);
      if (modifier.ruleId != null) id(modifier.ruleId, `правила модификатора ${idValue}`);
      if (modifier.consumedByActionId != null) id(modifier.consumedByActionId, `потребившего действия ${idValue}`);
      return copy(modifier);
    });
    if (options.modifierSnapshots != null && !sameJson(options.modifierSnapshots, modifiers)) reject("Снимок модификаторов изменён после предпросмотра");
    return modifiers;
  }

  function actionPlanPhases(plan, identity) {
    const source = plain(plan.phases) ? plan.phases : {};
    const sequence = [], phaseOperations = {}, operationIds = new Set();
    for (const phase of ACTION_PLAN_PHASES) {
      const values = source[phase] ?? [];
      if (!Array.isArray(values) || values.length > 192) reject(`Операции фазы ${phase} должны быть массивом`);
      phaseOperations[phase] = values.map((raw, index) => {
        if (!plain(raw)) reject(`Операция ${phase}:${index + 1} должна быть объектом`);
        if (raw.id != null && raw.operationId != null && raw.id !== raw.operationId) reject(`ID операции ${phase}:${index + 1} расходятся`);
        for (const key of ["rootActionId", "rootId", "definitionId", "actionDefinitionId", "actionInstanceId", "instanceId"]) if (raw[key] != null) {
          const expected = key === "rootId" ? identity.rootActionId : ["definitionId", "actionDefinitionId"].includes(key) ? identity.definitionId : ["actionInstanceId", "instanceId"].includes(key) ? identity.actionInstanceId : identity.rootActionId;
          if (raw[key] !== expected) reject(`ID операции ${phase}:${index + 1} расходится с ActionPlan`);
        }
        for (const key of ["sourceActorId", "ownerActorId"]) if (raw[key] != null) id(raw[key], `${key} операции`);
        if (Array.isArray(raw.targetIds)) for (const targetId of raw.targetIds) id(targetId, "цели операции");
        const operationId = id(raw.id ?? raw.operationId ?? `${phase}:${index + 1}`, `операции ${phase}:${index + 1}`);
        if (operationIds.has(operationId)) reject(`Повтор ID операции ActionPlan исполнения: ${operationId}`);
        operationIds.add(operationId);
        const kind = id(raw.kind ?? raw.type, `вида операции ${operationId}`);
        if (raw.targetId != null) id(raw.targetId, `цели операции ${operationId}`);
        const operation = {
          ...copy(raw),
          id: operationId,
          operationId,
          kind,
          phase,
          rootActionId: identity.rootActionId,
          definitionId: identity.definitionId,
          actionInstanceId: identity.actionInstanceId,
          causeEventId: identity.causeEventId,
          sourceActorId: raw.sourceActorId ?? identity.sourceActorId ?? identity.ownerActorId,
          ownerActorId: raw.ownerActorId ?? identity.ownerActorId,
        };
        sequence.push(operation);
        return operation;
      });
    }
    // `operations` is the queue accepted by the current common reducer. The
    // complete phase sequence remains available for adapters that handle the
    // declarative before/replace/after markers themselves.
    const controlKinds = new Set(["check", "choose-replacement", "history", "choice", "prompt"]);
    const runtimeOperations = sequence.filter(operation => actionPlanOperationKinds.has(operation.kind) && !controlKinds.has(operation.kind));
    for (const operation of sequence) if (!actionPlanOperationKinds.has(operation.kind) && !controlKinds.has(operation.kind)) {
      // ActionPlan control markers are kept in the sequence and choices, but
      // must never accidentally reach the generic reducer as an executable op.
      reject(`Операция не поддерживается execution: ${operation.kind}`);
    }
    return { phaseOperations, sequence, runtimeOperations };
  }

  function actionPlanChoices(plan, identity, sequence) {
    const source = plan.choices ?? plan.nestedChoices ?? [];
    if (!Array.isArray(source) || source.length > 64) reject("Choices ActionPlan исполнения должны быть массивом");
    const seenChoiceIds = new Set();
    const choices = source.map((raw, index) => {
      if (!plain(raw)) reject(`Choice исполнения ${index + 1} должен быть объектом`);
      const choiceId = id(raw.id ?? raw.choiceId ?? `${identity.planId}:choice:${index + 1}`, `choice исполнения ${index + 1}`);
      const rootActionId = id(raw.rootActionId ?? identity.rootActionId, `rootAction choice ${choiceId}`);
      const actionInstanceId = id(raw.actionInstanceId ?? identity.actionInstanceId, `экземпляра choice ${choiceId}`);
      if (rootActionId !== identity.rootActionId || actionInstanceId !== identity.actionInstanceId) reject(`Choice ${choiceId} принадлежит другому ActionPlan`);
      const options = raw.options ?? raw.choices ?? raw.modifierIds ?? [];
      if (!Array.isArray(options)) reject(`Варианты choice ${choiceId} должны быть массивом`);
      if (seenChoiceIds.has(choiceId)) reject(`Повтор ID choice исполнения: ${choiceId}`);
      seenChoiceIds.add(choiceId);
      if (raw.definitionId != null && raw.definitionId !== identity.definitionId) reject(`Choice ${choiceId} принадлежит другому definition`);
      for (const key of ["ownerActorId", "responderActorId", "actorId", "conflictId", "operationId"]) if (raw[key] != null) id(raw[key], `${key} choice ${choiceId}`);
      const phase = raw.phase ?? "replace";
      if (!ACTION_PLAN_PHASES.includes(phase)) reject(`Неизвестная фаза choice ${choiceId}`);
      return {
        schema: 1,
        kind: String(raw.kind || "action-plan-choice"),
        id: choiceId,
        rootActionId,
        definitionId: identity.definitionId,
        actionInstanceId,
        causeEventId: identity.causeEventId,
        ownerActorId: raw.ownerActorId ?? identity.ownerActorId,
        responderActorId: raw.responderActorId ?? raw.actorId ?? identity.ownerActorId,
        phase,
        options: copy(options),
        selected: raw.selected ?? raw.choice ?? null,
        conflictId: raw.conflictId ?? null,
        operationId: raw.operationId ?? null,
      };
    });
    // A replace operation with an explicit choice marker is automatically
    // represented as a serializable nested choice when the caller did not
    // provide a separate choices array.
    for (const operation of sequence.filter(item => item.phase === "replace" && ["choose-replacement", "choice", "prompt"].includes(item.kind))) {
      const operationOptions = operation.options ?? operation.choices ?? [];
      if (choices.some(choice => choice.operationId === operation.id || choice.conflictId != null && sameJson(choice.options, operationOptions))) continue;
      const choiceId = `${identity.planId}:choice:${choices.length + 1}`;
      if (seenChoiceIds.has(choiceId)) continue;
      seenChoiceIds.add(choiceId);
      choices.push({
        schema: 1,
        kind: "action-plan-choice",
        id: choiceId,
        rootActionId: identity.rootActionId,
        definitionId: identity.definitionId,
        actionInstanceId: identity.actionInstanceId,
        causeEventId: identity.causeEventId,
        ownerActorId: identity.ownerActorId,
        responderActorId: identity.ownerActorId,
        phase: "replace",
        options: copy(operationOptions),
        selected: operation.selected ?? null,
        conflictId: operation.conflictId ?? null,
        operationId: operation.id,
      });
    }
    return choices;
  }

  function assertQuoteIntegrity(quote, identity, targets) {
    if (quote == null) return;
    if (quote.kind !== "lionwing.action-plan.quote" || typeof quote.fingerprint !== "string") reject("Quote ActionPlan исполнения не является проверяемой цитатой");
    for (const [key, expected] of [["planId", identity.planId], ["rootActionId", identity.rootActionId], ["definitionId", identity.definitionId], ["actionInstanceId", identity.actionInstanceId]]) if (quote[key] != null && quote[key] !== expected) reject(`Quote ActionPlan исполнения расходится с ${key}`);
    if (quote.revision != null && Number(quote.revision) !== Number(identity.plan.revision ?? 0)) reject("Quote ActionPlan исполнения относится к другой ревизии");
    if (!Array.isArray(quote.consumedModifierIds)) reject("Quote ActionPlan исполнения не содержит список потребления");
    if (!plain(quote.outcomes)) reject("Quote ActionPlan исполнения не содержит итоги целей");
    const targetIds = targets.map(target => target.targetId);
    if (!sameJson(Object.keys(quote.outcomes).sort(), [...targetIds].sort())) reject("Quote ActionPlan исполнения содержит другие цели");
    for (const target of targets) {
      const outcome = quote.outcomes[target.targetId];
      if (!plain(outcome) || !sameJson(outcome.snapshot ?? {}, target.snapshot)) reject(`Quote ActionPlan исполнения содержит другой снимок цели: ${target.targetId}`);
    }
    const fingerprint = { ...quote };
    delete fingerprint.fingerprint;
    if (quote.fingerprint !== JSON.stringify(fingerprint)) reject("Fingerprint Quote ActionPlan исполнения повреждён");
  }

  function recomputeQuote(plan, status) {
    if (status === "cancelled" || status === "invalid") return null;
    if (status !== "committed" && plan.quote == null && plan.result == null) return null;
    const actionPlan = global.DAWN_LIONWING_ACTION_PLAN;
    if (typeof actionPlan?.quote !== "function") {
      if (status === "committed") reject("Проверка quote ActionPlan недоступна");
      return null;
    }
    if (!Object.hasOwn(plan, "baseValues") && !plain(plan.snapshots?.base)) {
      return null;
    }
    const candidate = copy(plan);
    if (["draft", "targeting", "modifiers"].includes(status)) {
      delete candidate.quote;
      delete candidate.result;
    }
    try { return actionPlan.quote(candidate); } catch (error) { reject(`Quote ActionPlan исполнения не прошёл повторную проверку: ${error.message}`); }
  }

  function actionPlanExecution(value, options = {}) {
    const input = actionPlanInput(value);
    const identity = actionPlanIdentity(input);
    const plan = identity.plan;
    const status = plan.status ?? input.status ?? "draft";
    if (!["draft", "targeting", "modifiers", "previewed", "committed", "cancelled", "invalid"].includes(status)) reject("Неизвестный статус ActionPlan исполнения");
    const phase = plan.phase ?? (status === "committed" ? "after" : "before");
    if (!ACTION_PLAN_PHASES.includes(phase)) reject("Неизвестная фаза ActionPlan исполнения");
    const sceneVersion = plan.sceneVersion ?? input.sceneVersion ?? options.sceneVersion ?? 0;
    const sceneVersionValue = serial(sceneVersion, "версии Сцены ActionPlan");
    const { targets, targetIds } = actionPlanTargets(plan, options);
    const costs = actionPlanCosts(plan);
    const modifiers = actionPlanModifiers(plan, options);
    const { phaseOperations, sequence, runtimeOperations } = actionPlanPhases(plan, identity);
    const choices = actionPlanChoices(plan, identity, sequence);
    if (input.quote != null && plan.quote != null && !sameJson(input.quote, plan.quote)) reject("Quote ActionPlan исполнения расходится с вложенным планом");
    if (input.result != null && plan.result != null && !sameJson(input.result, plan.result)) reject("Result ActionPlan исполнения расходится с вложенным планом");
    const quote = input.quote ?? plan.quote ?? null;
    const result = input.result ?? plan.result ?? null;
    if (status === "committed" && (!plain(quote) || !plain(result))) reject("Подтверждённый ActionPlan исполнения требует quote и result");
    if (quote != null && !plain(quote)) reject("Quote ActionPlan исполнения должен быть объектом");
    if (result != null && !plain(result)) reject("Result ActionPlan исполнения должен быть объектом");
    if (result != null && quote == null) reject("Result ActionPlan исполнения требует quote");
    if (quote != null && result != null && !sameJson(quote, result)) reject("Quote и result ActionPlan исполнения расходятся");
    if (options.quote != null && (quote == null || !sameJson(options.quote, quote))) reject("Quote ActionPlan исполнения изменён");
    if (options.result != null && (result == null || !sameJson(options.result, result))) reject("Result ActionPlan исполнения изменён");
    assertQuoteIntegrity(quote, { ...identity, plan: plan }, targets);
    const expectedQuote = recomputeQuote(plan, status);
    if (expectedQuote != null && quote != null && !sameJson(expectedQuote, quote)) reject("Quote ActionPlan исполнения подделан или устарел");
    if (expectedQuote != null && result != null && !sameJson(expectedQuote, result)) reject("Result ActionPlan исполнения подделан или устарел");
    if (options.expectedRevision != null && Number(options.expectedRevision) !== Number(plan.revision ?? 0)) reject("Ревизия ActionPlan исполнения устарела");
    const reservation = costs.length
      ? reserveCost(sceneVersionValue, identity.ownerActorId, targetIds, costs)
      : { schema: 1, sceneVersion: sceneVersionValue, actorId: identity.ownerActorId, targetIds: [...targetIds], costs: [] };
    if (input.reservation != null && !sameJson(input.reservation, reservation)) reject("Резерв цены ActionPlan исполнения подделан или устарел");
    const consumedModifierIds = Array.isArray(quote?.consumedModifierIds)
      ? [...new Set(quote.consumedModifierIds.map(value => id(value, "потребляемого модификатора")))].sort()
      : [];
    const modifierById = new Map(modifiers.map(modifier => [modifier.id, modifier]));
    for (const modifierId of consumedModifierIds) {
      const modifier = modifierById.get(modifierId);
      if (!modifier || modifier.consume !== true || modifier.consumedByActionId && modifier.consumedByActionId !== identity.actionInstanceId) reject(`Quote ссылается на непотребляемый модификатор: ${modifierId}`);
    }
    const alreadyConsumedModifierIds = modifiers.filter(modifier => modifier.consumedByActionId === identity.actionInstanceId).map(modifier => modifier.id).sort();
    const receipts = consumedModifierIds.map(modifierId => ({ id: `modifier:${modifierId}:${identity.actionInstanceId}`, modifierId, actionInstanceId: identity.actionInstanceId, boundary: "commit" }));
    const storedExecution = input.kind === "lionwing.execution-plan";
    const replay = options.commitResult !== true && (options.replay === true || input.replay === true || !storedExecution && status === "committed");
    const payment = {
      boundary: "commit",
      reservation: copy(reservation),
      costs: copy(costs),
      // This module only builds a descriptor.  The Scene reducer is the sole
      // authority that may turn the reservation into an actual payment.
      paid: false,
      commitRequested: !replay && (options.commitResult === true || storedExecution && input.payment?.commitRequested === true),
      replay,
      atomic: true,
    };
    const execution = {
      schema: 1,
      kind: "lionwing.execution-plan",
      planId: identity.planId,
      rootActionId: identity.rootActionId,
      definitionId: identity.definitionId,
      actionDefinitionId: identity.definitionId,
      actionInstanceId: identity.actionInstanceId,
      causeEventId: identity.causeEventId,
      ownerActorId: identity.ownerActorId,
      sourceActorId: identity.sourceActorId,
      sceneVersion: sceneVersionValue,
      status,
      phase,
      reservation,
      targetIds,
      targets,
      targetSnapshots: copy(targets),
      modifierSnapshots: copy(modifiers),
      costs: copy(costs),
      phases: phaseOperations,
      sequence,
      operations: runtimeOperations,
      runtimeOperations,
      choices,
      quote: quote == null ? null : copy(quote),
      result: result == null ? null : copy(result),
      consumption: {
        boundary: "commit",
        consumeOnce: true,
        modifierIds: consumedModifierIds,
        alreadyConsumedModifierIds,
        receipts,
      },
      payment,
      replay,
    };
    if (input.kind === "lionwing.execution-plan") {
      const integrityKeys = ["planId", "rootActionId", "definitionId", "actionDefinitionId", "actionInstanceId", "causeEventId", "ownerActorId", "sourceActorId", "sceneVersion", "status", "phase", "targetIds", "targets", "targetSnapshots", "modifierSnapshots", "costs", "phases", "sequence", "operations", "runtimeOperations", "choices", "quote", "result", "reservation", "consumption"];
      if (options.replay !== true) integrityKeys.push("payment", "replay");
      for (const key of integrityKeys) {
        if (input[key] != null && !sameJson(input[key], execution[key])) reject(`Execution plan повреждён: ${key}`);
      }
    }
    return copy(execution);
  }

  function prepareActionPlan(value, options = {}) {
    const execution = actionPlanExecution(value, { ...options, replay: false });
    return { ok: true, execution, plan: copy(value), payment: copy(execution.payment), choices: copy(execution.choices), ready: execution.choices.length === 0 && !["cancelled", "invalid"].includes(execution.status) };
  }

  function commitActionPlan(value, options = {}) {
    const input = actionPlanInput(value);
    const status = input.status ?? "draft";
    if (status !== "committed") reject("Execution bridge принимает только подтверждённый ActionPlan");
    const execution = actionPlanExecution(input, { ...options, replay: Boolean(options.replay) });
    return { ok: true, execution, payment: copy(execution.payment), choices: copy(execution.choices), replay: execution.replay };
  }

  function replayActionPlan(value, options = {}) {
    return commitActionPlan(value, { ...options, replay: true });
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
    actionPlanExecution, normalizeActionPlan: actionPlanExecution, prepareActionPlan,
    commitActionPlan, replayActionPlan, reloadActionPlan: actionPlanExecution,
  });
})(typeof window === "object" ? window : globalThis);
