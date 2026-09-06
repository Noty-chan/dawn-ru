"use strict";

// Small read-only adapters return plans. No state mutation and no legacy hooks.
(function (global) {
  const berserker = Object.freeze({
    id: "powerhouse.berserker.2", techniqueId: "powerhouse.berserker", level: 2,
    label: "Берсерк II: получить 2 урона вместо Эффекта",
    sourceDigest: "56e415b6892d81877093cb421cb609550273e47df1a90f2aa9225340219173f3",
    available: actor => actor?.rulesEdition === "lionwing" && Number((actor.knownTechniques ?? actor.techniques)?.["powerhouse.berserker"] || 0) >= 2,
    replacements: (actor, original) => original.kind === "effect" && !original.remove && !actor.knockedOut
      ? [{ id: "powerhouse.berserker.2", label: "Получить 2 урона вместо Эффекта", operations: [{ kind: "damage", targetId: actor.id, sourceActorId: actor.id, amount: 2 }] }]
      : []
  });
  const adapters = Object.freeze([berserker]);
  global.DAWN_LIONWING_ADAPTERS = Object.freeze({
    list: actor => adapters.filter(rule => rule.available(actor)).map(({ id, label, sourceDigest }) => ({ id, label, sourceDigest })),
    replacements: (actor, original) => adapters.filter(rule => rule.available(actor) && actor.lionwing?.automation?.[rule.id] === true).flatMap(rule => rule.replacements(actor, original))
  });
})(typeof window === "object" ? window : globalThis);
