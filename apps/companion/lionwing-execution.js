"use strict";

// Pure, serializable consequence frames. Only the kernel applies operations.
(function (global) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const reject = message => { throw new Error(message); };
  function open(original, identity, replacements = []) {
    if (!identity.id || !identity.ownerActorId) reject("Последствию нужны ID и владелец решения");
    if (new Set(replacements.map(rule => rule.id)).size !== replacements.length) reject("Повтор ID замены");
    for (const rule of replacements) {
      if (!rule.id || rule.id === "keep" || !rule.label || !Array.isArray(rule.operations) || !rule.operations.length) reject("Некорректная замена последствия");
    }
    return copy({ schema: 1, ...identity, original, replacements, phase: "before", selected: null });
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
  global.DAWN_LIONWING_EXECUTION = Object.freeze({ open, choose, plan });
})(typeof window === "object" ? window : globalThis);
