"use strict";

// Small read-only adapters return plans or numeric contributions. They never
// mutate a scene: the LionWing engine remains the single authority that applies
// the resulting rule.
(function (global) {
  const lionwing = actor => actor?.rulesEdition === "lionwing";
  const knows = (actor, techniqueId, level) => lionwing(actor) && Number((actor.knownTechniques ?? actor.techniques)?.[techniqueId] || 0) >= level;
  const passive = ({ id, label, sourceDigest, rollBonus, statBonus, coverage = "full" }) => {
    const techniqueId = id.replace(/\.\d+$/, ""), level = Number(id.match(/\.(\d+)$/)?.[1] || 0);
    return Object.freeze({ id, techniqueId, level, label, sourceDigest, coverage, available: actor => knows(actor, techniqueId, level), rollBonus, statBonus });
  };
  const actionBonus = (actionId, amount = 1) => (_actor, context) => context?.kind === "attack" && context.actionId === actionId ? amount : 0;

  const berserker = Object.freeze({
    id: "powerhouse.berserker.2", techniqueId: "powerhouse.berserker", level: 2,
    label: "Берсерк II: получить 2 урона вместо Эффекта",
    sourceDigest: "56e415b6892d81877093cb421cb609550273e47df1a90f2aa9225340219173f3",
    coverage: "full",
    available: actor => knows(actor, "powerhouse.berserker", 2),
    replacements: (actor, original) => original.kind === "effect" && !original.remove && !actor.knockedOut
      ? [{ id: "powerhouse.berserker.2", label: "Получить 2 урона вместо Эффекта", operations: [{ kind: "damage", targetId: actor.id, sourceActorId: actor.id, amount: 2 }] }]
      : []
  });
  const flagellant = Object.freeze({
    id: "powerhouse.flagellant.1", techniqueId: "powerhouse.flagellant", level: 1,
    label: "Самобичеватель I: Усилить себя после отрицательного Эффекта",
    sourceDigest: "c12c31e1e139493887d7851bccd3f07d776513991665646b55a91734f2b73ef9",
    coverage: "full",
    available: actor => knows(actor, "powerhouse.flagellant", 1),
    afterEffect: (actor, original) => original.effect?.startsWith("negative.") && !actor.knockedOut
      ? [{ id: "powerhouse.flagellant.1", label: "Самобичеватель I: Усилить себя", operations: [{ kind: "effect", targetId: actor.id, sourceActorId: actor.id, effect: "positive.усилен" }] }]
      : []
  });

  const passives = [
    passive({
      id: "bulwark.iron-bodied.2",
      label: "Железное тело II: +[Тело/2] Брони",
      sourceDigest: "fa7b6c2676514b1bf9dfca34c58256d51ef5f80513957fd244784ba1e0b94344",
      statBonus: (actor, key) => key === "armor" ? Math.ceil(Number(actor.attrs?.body || 0) / 2) : 0,
    }),
    passive({
      id: "bulwark.rising-challenger.3",
      label: "Восходящий претендент III: +2 Преимущества и +2 Духа в Столкновении",
      sourceDigest: "e9655fd8cbbaab4e8119a75716013a6ac3aec744c098de9d0d9e404cd7cf6d41",
      rollBonus: (_actor, context) => context?.kind === "clash" ? 2 : 0,
      statBonus: (_actor, key, context) => key === "spirit" && context?.kind === "clash" ? 2 : 0,
    }),
    passive({
      id: "bulwark.absolute-bastard.3",
      label: "Абсолютный мерзавец III: +[Ранг/2] Преимущества против спровоцированных вами целей",
      sourceDigest: "a9978de47bd6423343c83933ef3572457618ce046c6ec55a29090b03b3089f0f",
      rollBonus: (actor, context) => context?.kind === "attack" && context.tauntedByActor ? Math.ceil(Number(actor.tier || 1) / 2) : 0,
    }),
    passive({ id: "altruist.chronomancer.2", label: "Хрономант II: +1 Преимущество к Заклинаниям (пассивная часть)", sourceDigest: "bab452f231f9a7c7c0ee1777945bb658db08a587663551cdcb857ccb1b3f5105", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание") }),
    passive({ id: "bulwark.grappler.2", label: "Борец II: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "87e908315db54db355c6fa2e4c772f05a08a0fbd835cd50e6339ac034f66ff4d", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "disruptor.bloodletter.2", label: "Кровопускатель II: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "c9c73dd242441bab4248e9a2726af8ed73cae41c41df3d09d6bb095c709f9d05", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "disruptor.constrictor.3", label: "Удушитель III: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "0103c5ab35c610ced640ee2b40b6bb0d0dc9c7552a1c961a6afb0877ba79bd80", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "powerhouse.gunslinger.2", label: "Стрелок II: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "6559e6a6b597f579ef43c6b7b20e4a6d92659d2b41de8338239a7059df0694ea", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "ruiner.feral-arcana.3", label: "Дикий арканист III: +1 Преимущество к Заклинаниям (пассивная часть)", sourceDigest: "9f6cfdd94da5ecb8aae12c24b3602fc117b2890191d51dabd3eb6d89a3b83df3", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание") }),
    passive({ id: "ruiner.cryomancer.2", label: "Ледяной покров II: +1 Преимущество к Заклинаниям (пассивная часть)", sourceDigest: "32667d8918127c1729dc39430bde0375999651854e06e8cd599d91b7fcd14f30", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание") }),
    passive({ id: "vagabond.skirmisher.3", label: "Застрельщик III: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
  ];
  const adapters = Object.freeze([berserker, flagellant, ...passives]);
  const enabled = actor => adapters.filter(rule => rule.available(actor) && actor.lionwing?.automation?.[rule.id] === true);
  const numericContributions = (actor, method, context) => enabled(actor).flatMap(rule => {
    const amount = Number(method === "statBonus" ? rule[method]?.(actor, context.key, context) : rule[method]?.(actor, context) || 0);
    return Number.isFinite(amount) && amount !== 0 ? [{ id: rule.id, label: rule.label, amount }] : [];
  });
  global.DAWN_LIONWING_ADAPTERS = Object.freeze({
    list: actor => adapters.filter(rule => rule.available(actor)).map(({ id, label, sourceDigest, coverage }) => ({ id, label, sourceDigest, coverage })),
    replacements: (actor, original) => enabled(actor).flatMap(rule => rule.replacements?.(actor, original) || []),
    afterEffect: (actor, original) => enabled(actor).flatMap(rule => rule.afterEffect?.(actor, original) || []),
    rollBonuses: (actor, context = {}) => numericContributions(actor, "rollBonus", context),
    rollBonus: (actor, context = {}) => numericContributions(actor, "rollBonus", context).reduce((sum, item) => sum + item.amount, 0),
    statBonuses: (actor, key, context = {}) => numericContributions(actor, "statBonus", { ...context, key }),
    statBonus: (actor, key, context = {}) => numericContributions(actor, "statBonus", { ...context, key }).reduce((sum, item) => sum + item.amount, 0),
  });
})(typeof window === "object" ? window : globalThis);
