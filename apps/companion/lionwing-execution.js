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
  const scopes = new Set(["rootAction", "action", "ownerTurn", "anyTurn", "round", "scene", "chapter"]);
  const factTypes = new Set(["attempt", "apply", "hit", "damage", "healthLoss", "heal", "wound", "knockout", "spend", "gain", "preventedGain", "roll", "cancel"]);
  const rollKinds = new Set(["check", "opposed", "raw-d6"]);

  function identity(value = {}) {
    const result = {
      rootActionId: id(value.rootActionId, "rootAction"),
      actionId: value.actionId == null ? null : id(value.actionId, "action"),
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

  function fact(type, context, details = {}) {
    if (!factTypes.has(type)) reject("Неизвестный тип исторического факта");
    if (!plain(details) || !serializable(details)) reject("Исторический факт должен быть сохраняемым JSON");
    const provenance = identity(context);
    return copy({ schema: 1, id: id(context.id, "history"), type, ...provenance, actorId: context.actorId || provenance.ownerActorId, targetIds: [...new Set((context.targetIds || []).filter(value => typeof value === "string"))].slice(0, 40), round: serial(context.round ?? 0, "Раунд"), turnSerial: serial(context.turnSerial ?? 0, "Ход"), ownerTurnActorId: context.ownerTurnActorId || null, sceneSerial: serial(context.sceneSerial ?? 1, "Сцена"), chapterSerial: serial(context.chapterSerial ?? 1, "Глава"), details });
  }

  function inScope(item, query = {}) {
    if (!scopes.has(query.scope)) reject("Неизвестная область истории");
    if (query.type && item.type !== query.type || query.ruleId && item.ruleId !== query.ruleId || query.actorId && item.actorId !== query.actorId || query.targetId && !item.targetIds.includes(query.targetId)) return false;
    if (query.scope === "rootAction") return item.rootActionId === query.rootActionId;
    if (query.scope === "action") return item.actionId === query.actionId && (!query.rootActionId || item.rootActionId === query.rootActionId);
    if (query.scope === "ownerTurn") return item.sceneSerial === query.sceneSerial && item.turnSerial === query.turnSerial && item.ownerTurnActorId === query.ownerActorId;
    if (query.scope === "anyTurn") return item.sceneSerial === query.sceneSerial && item.turnSerial === query.turnSerial;
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

  global.DAWN_LIONWING_EXECUTION = Object.freeze({ open, choose, plan, identity, fact, inScope, historyCount, normalizeCosts, reserveCost, normalizeRoll });
})(typeof window === "object" ? window : globalThis);
