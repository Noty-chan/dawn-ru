"use strict";

// Declarative contracts for actions created by Techniques.  The engine is the
// only writer; this module only validates the shape and exposes immutable
// canonical contracts to the engine, adapters, and tests.
(function installLionwingDerivedActions(global) {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const fail = message => { throw new Error(message); };
  const ids = Object.freeze({
    skirmish: "action.атаки.стычка",
    spell: "action.атаки.заклинание",
    finish: "action.атаки.завершение",
  });
  const contracts = Object.freeze({
    "vagabond.skirmisher.1": Object.freeze({ id: "vagabond.skirmisher.1", actionId: ids.skirmish, mode: "fixed", damageAttribute: "talent", targetMode: "adjacent-single", targetLock: true, sourceDigest: "a14b57ddcf585e19b76a19e20b3ab1dc5190a59a5b044ed5df6d0bc2141a503e" }),
    "vagabond.skirmisher.3": Object.freeze({ id: "vagabond.skirmisher.3", actionId: ids.skirmish, mode: "fixed", damageAttribute: "talent", targetMode: "adjacent-single", targetLock: true, sourceDigest: "4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61" }),
    "vagabond.dim-mak.1": Object.freeze({ id: "vagabond.dim-mak.1", actionId: ids.skirmish, mode: "fixed", damageAttribute: "mind", targetMode: "host-single", targetLock: true, ignoreEvasion: true, sourceDigest: "86bc2801b43ae4f2bd3de697124313b986e9ae1081e0dd8f3f52dfc44b097c59" }),
    "powerhouse.dual-wielder.1": Object.freeze({ id: "powerhouse.dual-wielder.1", actionId: ids.skirmish, mode: "fixed", damageAttribute: "choice-body-talent", targetMode: "same-single", targetLock: true, sourceDigest: "ab0e66e627e16c102f6cd8ec4a2cd62a4aac0a45d4bffc9e5197a3f9dd326b13" }),
    "vagabond.opportunist.1": Object.freeze({ id: "vagabond.opportunist.1", actionId: ids.skirmish, mode: "roll", targetMode: "same-single", targetLock: true, sourceDigest: "f0492855d27579faf8b5030f09909996a4248a7d2367d8b8805f3942ce0bd4e2" }),
    "bulwark.runic-retribution.1": Object.freeze({ id: "bulwark.runic-retribution.1", actionId: ids.spell, mode: "roll", targetMode: "same-single", targetLock: true, ignoreRange: true, sourceDigest: "4bf4aab119ae103e04dde891dc96daefe5cc02c06fcdd16308a24c09a07d3822" }),
  });
  const allowedModes = new Set(["fixed", "roll"]);
  function contract(ruleId) { return contracts[ruleId] || null; }
  function validate(payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("Производное действие имеет неподдерживаемый формат");
    const found = contract(payload.ruleId);
    if (!found) fail("Неизвестный контракт производного действия");
    if (payload.sourceDigest !== found.sourceDigest) fail("Происхождение производного действия не совпадает с Реестром");
    if (payload.actionId != null && payload.actionId !== found.actionId) fail("Производное действие не может менять базовое действие");
    if (payload.mode != null && payload.mode !== found.mode) fail("Производное действие не может менять режим контракта");
    if (!Array.isArray(payload.targetIds) || payload.targetIds.length !== 1 || typeof payload.targetIds[0] !== "string" || !payload.targetIds[0]) fail("Производное действие требует ровно одну цель");
    if (payload.lineage != null && (!Array.isArray(payload.lineage) || payload.lineage.length > 8 || payload.lineage.some(item => typeof item !== "string" || !item))) fail("Повреждена цепочка производного действия");
    if (payload.damageAttribute != null && !["body", "talent", "mind"].includes(payload.damageAttribute)) fail("Недопустимый Атрибут производного действия");
    return found;
  }
  function identity(found, payload, provenance = {}) {
    const previous = payload.lineage || [];
    if (previous.filter(id => id === found.id).length > 1) fail("Защита цикла производных действий остановила цепочку");
    const lineage = [...new Set([...previous, found.id])];
    if (lineage.length > 8) fail("Защита цикла производных действий остановила цепочку");
    return {
      schema: 1,
      derived: true,
      derivedActionId: found.id,
      actionId: found.actionId,
      actionDefinitionId: found.actionId,
      actionInstanceId: payload.actionInstanceId || `${provenance.rootActionId || "derived"}:${found.id}`,
      rootActionId: provenance.rootActionId || null,
      targetIds: [...payload.targetIds],
      lineage,
      swift: true,
      free: true,
      sourceDigest: found.sourceDigest,
    };
  }
  global.DAWN_LIONWING_DERIVED_ACTIONS = Object.freeze({ schema: 1, ids, contracts, contract, validate, identity, clone });
})(typeof window === "object" ? window : globalThis);
