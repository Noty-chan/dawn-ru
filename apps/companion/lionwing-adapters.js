"use strict";

// Small read-only adapters return plans or numeric contributions. They never
// mutate a scene: the LionWing engine remains the single authority that applies
// the resulting rule.
(function (global) {
  const lionwing = actor => actor?.rulesEdition === "lionwing";
  const knows = (actor, techniqueId, level) => lionwing(actor) && Number((actor.knownTechniques ?? actor.techniques)?.[techniqueId] || 0) >= level;
  const passive = ({ id, label, sourceDigest, rollBonus, statBonus, statMinimum, boundaryOperations, coverage = "full" }) => {
    const techniqueId = id.replace(/\.\d+$/, ""), level = Number(id.match(/\.(\d+)$/)?.[1] || 0);
    return Object.freeze({ id, techniqueId, level, label, sourceDigest, coverage, available: actor => knows(actor, techniqueId, level), rollBonus, statBonus, statMinimum, boundaryOperations });
  };
  const actionBonus = (actionId, amount = 1) => (_actor, context) => context?.kind === "attack" && context.actionId === actionId ? amount : 0;
  const attackIds = new Set(["action.атаки.заклинание", "action.атаки.завершение", "action.атаки.стычка"]);
  const sceneFocus = amount => actor => [{ kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: typeof amount === "function" ? amount(actor) : amount }];

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
    passive({ id: "bulwark.absolute-bastard.1", label: "Абсолютный мерзавец I: +3 Фокуса в начале Сцены (пассивная часть)", sourceDigest: "91c7070f4960afafc561e002df64ca574cf017f64e12b15f175339623fd1d903", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? sceneFocus(3)(actor) : [] }),
    passive({ id: "disruptor.siren.1", label: "Сирена I: +3 Фокуса в начале Сцены (пассивная часть)", sourceDigest: "8d9becba6e6f63641f5dc1a8a47e965c73f0e7112ef7ef4b781b2c6ffb632979", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? sceneFocus(3)(actor) : [] }),
    passive({ id: "ruiner.spellcrafter.2", label: "Создатель заклинаний II: +[Разум] к начальному Фокусу (пассивная часть)", sourceDigest: "f94f640a08662ad025e0ded425aab945bdf0b4accabc6519142867e5f5cf0886", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? sceneFocus(owner => Number(owner.attrs?.mind || 0))(actor) : [] }),
    passive({ id: "bulwark.stalwart-sentry.2", label: "Стойкий часовой II: 4 Бдительности в начале Сцены (пассивная часть)", sourceDigest: "11c89e120a37e64ba570b3bb664bf52f056ebca5ad3e83046100c00952bb8d67", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? [{ kind: "clock", targetId: actor.id, id: "bulwark.stalwart-sentry.vigilance", label: "Бдительность", size: 4, value: 4, initial: 4, resetAt: "scene", ruleId: "bulwark.stalwart-sentry.2" }] : [] }),
    passive({
      id: "altruist.empath.3",
      label: "Эмпат III: союзник рядом начинает Ход с +3 Фокуса и +[Ранг] Здоровья",
      sourceDigest: "4473ee348631cf63dd51750aca3869aac5f3abb159e490f4b390407c8ac61f73",
      boundaryOperations: (actor, context) => context?.boundary === "turnStart" && !actor.knockedOut && context.activeActor?.id !== actor.id && context.activeActor?.team === actor.team && context.distanceToActive === 1
        ? [{ kind: "resource", targetId: context.activeActor.id, resource: "focus", operation: "gain", amount: 3 }, { kind: "heal", targetId: context.activeActor.id, amount: Number(actor.tier || 1) }]
        : [],
    }),
    passive({
      id: "bulwark.iron-bodied.2",
      label: "Железное тело II: +[Тело/2] Брони",
      sourceDigest: "fa7b6c2676514b1bf9dfca34c58256d51ef5f80513957fd244784ba1e0b94344",
      statBonus: (actor, key) => key === "armor" ? Math.ceil(Number(actor.attrs?.body || 0) / 2) : 0,
    }),
    passive({
      id: "bulwark.iron-bodied.1",
      label: "Железное тело I: Скорость не ниже 3 (пассивная часть)",
      sourceDigest: "67e59b6badf638975b3e95d0a570a6bd6c759fd49b4f632cd31791d28a7bfad7",
      coverage: "partial",
      statMinimum: (_actor, key) => key === "speed" ? 3 : 0,
    }),
    passive({
      id: "bulwark.giant-frame.2",
      label: "Огромное телосложение II: +[Тело] к максимуму Здоровья (пассивная часть)",
      sourceDigest: "975bd5e7a5998ef8e1cc117ce188735f040ecf96be68d9a857248fd6dfb4147a",
      coverage: "partial",
      statBonus: (actor, key) => key === "maxHp" ? Number(actor.attrs?.body || 0) : 0,
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
    passive({ id: "disruptor.street-fighter.2", label: "Уличный боец II: Преимущество по числу Эффектов ошеломлённой цели (пассивная часть)", sourceDigest: "d2a047b0ae8184c4e9d98adedde7f5fe1a5db592efef26ab16556a230284a0a8", coverage: "partial", rollBonus: (_actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.стычка" && context.targetEffectIds?.includes("negative.ошеломлен") && !(context.techniqueTags || []).includes("weapon") ? context.targetEffectIds.length : 0 }),
    passive({ id: "powerhouse.gunslinger.2", label: "Стрелок II: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "6559e6a6b597f579ef43c6b7b20e4a6d92659d2b41de8338239a7059df0694ea", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "powerhouse.martial-artist.3", label: "Мастер боевых искусств III: +1 Преимущество к Атакам (пассивная часть)", sourceDigest: "8428fb10aec3237aa82ef24d052a5610a5f9701fa3576d9be06b9219dc23176c", coverage: "partial", rollBonus: (_actor, context) => context?.kind === "attack" && attackIds.has(context.actionId) && !(context.techniqueTags || []).includes("weapon") ? 1 : 0 }),
    passive({ id: "powerhouse.lancer.1", label: "Копейщик I: Преимущество к Стычке по расстоянию, максимум 3 (пассивная часть)", sourceDigest: "8591643bda0a61a4165679413af42b8b60a40ca90dc47dc5a9d6ee1c32a5e701", coverage: "partial", rollBonus: (_actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.стычка" ? Math.min(3, Math.max(0, Number(context.targetDistance || 0))) : 0 }),
    passive({ id: "ruiner.feral-arcana.3", label: "Дикий арканист III: +1 Преимущество к Заклинаниям (пассивная часть)", sourceDigest: "9f6cfdd94da5ecb8aae12c24b3602fc117b2890191d51dabd3eb6d89a3b83df3", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание") }),
    passive({ id: "ruiner.flame-heart.3", label: "Пламенное сердце III: +1 Преимущество к Заклинаниям (пассивная часть)", sourceDigest: "4896f18d23e7ba4de201859ecfb76d46c7049c32e532747831b973b2d75c6d29", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание") }),
    passive({ id: "ruiner.flame-heart.2", label: "Пламенное сердце II: +[Напряжение] Преимущества к магической Атаке в Порче (пассивная часть)", sourceDigest: "2259304d1ba4a37ae5e0850fa66ffcba7b9b70b1ce544d02f97fcbd6472809c2", coverage: "partial", rollBonus: (_actor, context) => context?.kind === "attack" && context.sourceEffectIds?.includes("negative.порчен") && (context.actionId === "action.атаки.заклинание" || context.actionId === "action.атаки.завершение" && context.attribute === "spirit") ? Number(context.tension || 0) : 0 }),
    passive({ id: "ruiner.cryomancer.2", label: "Ледяной покров II: +1 Преимущество к Заклинаниям (пассивная часть)", sourceDigest: "32667d8918127c1729dc39430bde0375999651854e06e8cd599d91b7fcd14f30", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание") }),
    passive({ id: "ruiner.sellsword-s-call.1", label: "Зов мечника I: +2 Преимущества к Заклинаниям (пассивная часть)", sourceDigest: "712c5d75aebe965eb606cb4b930e141138c87dd24cb14804cd367a1904d5c283", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание", 2) }),
    passive({ id: "vagabond.skirmisher.3", label: "Застрельщик III: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "vagabond.knife-juggler.2", label: "Жонглёр ножами II: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "4da1a911cf7ed1eb5a90e3c4aed8abbb87087a567f7ab38406c11d1130c6c54a", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "vagabond.assassin.2", label: "Убийца II: +[Ранг] Преимущества к Атакам из Исчезновения (пассивная часть)", sourceDigest: "6e95fe2767088e069f995f384a6e03856f26d428161dbd57efca1c03a5eda98f", coverage: "partial", rollBonus: (actor, context) => context?.kind === "attack" && attackIds.has(context.actionId) && context.sourceEffectIds?.includes("positive.исчез") ? Number(actor.tier || 1) : 0 }),
  ];
  const adapters = Object.freeze([berserker, flagellant, ...passives]);
  const enabled = actor => adapters.filter(rule => rule.available(actor) && actor.lionwing?.automation?.[rule.id] === true);
  const numericContributions = (actor, method, context) => enabled(actor).flatMap(rule => {
    const amount = Number(method.startsWith("stat") ? rule[method]?.(actor, context.key, context) : rule[method]?.(actor, context) || 0);
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
    statMinimums: (actor, key, context = {}) => numericContributions(actor, "statMinimum", { ...context, key }),
    statMinimum: (actor, key, context = {}) => numericContributions(actor, "statMinimum", { ...context, key }).reduce((minimum, item) => Math.max(minimum, item.amount), 0),
    boundaryOperations: (actor, context = {}) => enabled(actor).flatMap(rule => {
      const operations = rule.boundaryOperations?.(actor, context) || [];
      return operations.length ? [{ id: rule.id, label: rule.label, operations }] : [];
    }),
  });
})(typeof window === "object" ? window : globalThis);
