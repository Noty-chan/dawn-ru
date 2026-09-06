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
  const flagellant = Object.freeze({
    id: "powerhouse.flagellant.1", techniqueId: "powerhouse.flagellant", level: 1,
    label: "Самобичеватель I: Усилить себя после отрицательного Эффекта",
    sourceDigest: "c12c31e1e139493887d7851bccd3f07d776513991665646b55a91734f2b73ef9",
    available: actor => actor?.rulesEdition === "lionwing" && Number((actor.knownTechniques ?? actor.techniques)?.["powerhouse.flagellant"] || 0) >= 1,
    afterEffect: (actor, original) => original.effect?.startsWith("negative.") && !actor.knockedOut
      ? [{ id: "powerhouse.flagellant.1", label: "Самобичеватель I: Усилить себя", operations: [{ kind: "effect", targetId: actor.id, sourceActorId: actor.id, effect: "positive.усилен" }] }]
      : []
  });
  const adapters = Object.freeze([berserker, flagellant]);
  const enabled = actor => adapters.filter(rule => rule.available(actor) && actor.lionwing?.automation?.[rule.id] === true);
  global.DAWN_LIONWING_ADAPTERS = Object.freeze({
    list: actor => adapters.filter(rule => rule.available(actor)).map(({ id, label, sourceDigest }) => ({ id, label, sourceDigest })),
    replacements: (actor, original) => enabled(actor).flatMap(rule => rule.replacements?.(actor, original) || []),
    afterEffect: (actor, original) => enabled(actor).flatMap(rule => rule.afterEffect?.(actor, original) || [])
  });
})(typeof window === "object" ? window : globalThis);
