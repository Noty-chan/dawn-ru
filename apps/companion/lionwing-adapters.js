"use strict";

// Small read-only adapters return plans or numeric contributions. They never
// mutate a scene: the LionWing engine remains the single authority that applies
// the resulting rule.
(function (global) {
  const inventory = global.DAWN_LIONWING_INVENTORY || null;
  const lionwing = actor => actor?.rulesEdition === "lionwing";
  const knows = (actor, techniqueId, level) => lionwing(actor) && Number((actor.knownTechniques ?? actor.techniques)?.[techniqueId] || 0) >= level;
  const passive = ({ id, label, sourceDigest, rollBonus, statBonus, statMinimum, rangeBonus, boundaryOperations, inventoryOperations, resourceGainStatus, actionStatus, maximumLevel = null, coverage = "full" }) => {
    const techniqueId = id.replace(/\.\d+$/, ""), level = Number(id.match(/\.(\d+)$/)?.[1] || 0);
    return Object.freeze({ id, techniqueId, level, label, sourceDigest, coverage, available: actor => knows(actor, techniqueId, level) && (maximumLevel == null || Number((actor.knownTechniques ?? actor.techniques)?.[techniqueId] || 0) <= maximumLevel), rollBonus, statBonus, statMinimum, rangeBonus, boundaryOperations, inventoryOperations, resourceGainStatus, actionStatus });
  };
  const actionBonus = (actionId, amount = 1) => (_actor, context) => context?.kind === "attack" && context.actionId === actionId ? amount : 0;
  const attackIds = new Set(["action.атаки.заклинание", "action.атаки.завершение", "action.атаки.стычка"]);
  const ACTIONS = Object.freeze({
    skirmish: "action.атаки.стычка",
    breathe: "action.утилитарные-действия.передышка",
    charge: "action.утилитарные-действия.зарядка",
    hide: "action.утилитарные-действия.скрыться",
    interact: "action.утилитарные-действия.взаимодействие",
    study: "action.утилитарные-действия.изучение",
  });
  const eventHistory = (actor, scene) => Array.isArray(actor?.lionwing?.history) ? actor.lionwing.history : [];
  const usedInTurn = (actor, scene, actionId) => {
    const serial = Number(scene?.turnSerial);
    const instance = scene?.lionwing?.activeTurnInstanceId || null;
    return eventHistory(actor, scene).some(item => item.actionId === actionId && (
      instance && item.ownerTurnInstanceId === instance || Number(item.turnSerial) === serial
    ));
  };
  const usedInRound = (actor, scene, actionId) => eventHistory(actor, scene).some(item => item.actionId === actionId && Number(item.round) === Number(scene?.round));
  const actionModifier = ({ id, techniqueId, level, sourceDigest, label, coverage = "partial", available, modify }) => Object.freeze({
    id, techniqueId, level, sourceDigest, label, coverage,
    available,
    modify,
  });
  const sceneFocus = amount => actor => [{ kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: typeof amount === "function" ? amount(actor) : amount }];
  const resourceConfiguration = (actor, id, label, current, options = {}) => [{ kind: "configure-resource", targetId: actor.id, id, label, current, initial: current, scope: options.scope || "scene", lifetime: "scene", replaces: options.replaces || null, replacesAp: options.replacesAp === true, inverted: options.inverted === true, ruleId: options.ruleId || null }];
  const eventTrigger = ({ id, label, sourceDigest, coverage = "full", triggerKey, match, operations = [], choices = [], boundaryOperations }) => ({ id, techniqueId: id.replace(/\.\d+$/, ""), level: Number(id.match(/\.(\d+)$/)?.[1] || 0), label, sourceDigest, coverage, available: actor => knows(actor, id.replace(/\.\d+$/, ""), Number(id.match(/\.(\d+)$/)?.[1] || 0)), triggerKey, match, operations, choices, boundaryOperations });
  const typedConfiguration = (actor, id, label, itemKind, source, options = {}) => [{
    kind: "inventory", operation: "configure", targetId: actor.id, ownerActorId: actor.id, sourceActorId: actor.id,
    id, label, inventoryKind: itemKind || "stack", current: options.current ?? (["selected-item", "recorded-value"].includes(itemKind) ? null : options.initial ?? 0), ...(["selected-item", "recorded-value"].includes(itemKind) ? {} : { initial: options.initial ?? 0 }),
    minimum: options.minimum ?? 0, maximum: options.maximum ?? 99, resetAt: options.resetAt ?? options.lifetime ?? "scene",
    lifetime: options.lifetime ?? "scene", visibility: options.visibility ?? "owner", unique: options.unique === true,
    multiple: options.multiple === true, replacementGroup: options.replacementGroup, level: options.level,
    alternateResource: options.alternateResource, labelI18n: options.labelI18n, items: options.items,
    ruleId: source.ruleId, sourceDigest: source.sourceDigest, editionId: "lionwing",
    ...(options.instanceId != null ? { instanceId: options.instanceId } : {}),
  }];
  const typedReset = (actor, id, source) => [{ kind: "inventory", operation: "reset", targetId: actor.id, id, boundary: "intermission", ruleId: source.ruleId, sourceDigest: source.sourceDigest }];

  // Completed-event adapters are deliberately data-only.  The engine supplies
  // the authoritative event and applies the returned operations; an adapter
  // can only describe an eligible trigger and its optional choices.
  const eventAdapters = [
    eventTrigger({
      id: "vagabond.dim-mak.1",
      label: "Детектив I: удалить Слабую точку и выполнить фиксированный Джеб",
      sourceDigest: "57c2d10021b83b34",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:dim-mak-1`,
      operations: () => [],
      choices: (actor, event, context) => {
        const marker = (context.scene?.markers || []).find(item => item.ruleId === "vagabond.dim-mak.1" && item.ownerActorId === actor.id && item.space === actor.space && Number(item.x) === Number(actor.x) && Number(item.y) === Number(actor.y)), targetId = marker && (marker.hostActorId || marker.metadata?.hostActorId || marker.metadata?.carrierActorId);
        const target = targetId && (context.scene?.actors || []).find(item => item.id === targetId);
        return marker && target && !target.knockedOut ? [{ id: "jab", label: `Удалить точку и Джеб (${target.name})`, operations: [{ kind: "marker-remove", markerId: marker.id, targetId, sourceActorId: actor.id, ruleId: "vagabond.dim-mak.1", sourceActionId: "vagabond.dim-mak.1.jab" }, { kind: "damage", targetId, sourceActorId: actor.id, amount: Math.ceil(Number(actor.attrs?.mind || 0) / 2), fixedTargetId: targetId, fixedDamage: true, finalDamage: true, attack: true, ignoreEvasion: true, sourceActionId: "vagabond.dim-mak.1.jab" }], context: { targetId, markerId: marker.id, eventId: event.id } }] : [];
      },
    }),
    eventTrigger({
      id: "bulwark.rising-challenger.1",
      label: "Восходящий претендент I: после успешного Столкновения получить Фокус и выбрать перемещение",
      sourceDigest: "8dac6ad2f82600c0115cd3569d35ae2b0229d6b1ef750e33ee347a2b017bded6",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}`,
      operations: actor => [{ kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: 1 }],
      choices: (actor, event) => [{
        id: "move",
        label: `Переместиться на ${Number(actor.tier || 1)} клеток`,
        operations: [{ kind: "move", targetId: actor.id, maximum: Number(actor.tier || 1), forced: false, techniqueId: "bulwark.rising-challenger.1" }],
        context: { destinationRequired: true, targetId: actor.id, maximum: Number(actor.tier || 1), eventId: event.id },
      }],
    }),
    eventTrigger({
      id: "powerhouse.berserker.3",
      label: "Берсерк III: первый полученный урон за Ход даёт Фокус",
      sourceDigest: "f8a2fdd4233866f34b406075d3315b2284daf7f825d8ba9202fa91b643cfc504",
      coverage: "partial",
      triggerKey: ({ actor, event, context }) => `${context.ownerTurnKey || event.id}:${actor.id}`,
      operations: actor => [{ kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: 1 }],
      choices: () => [],
    }),
    eventTrigger({
      id: "powerhouse.intimidator.3",
      label: "Запугиватель III: после выведения врага получить 2 Фокуса и 1 ОД",
      sourceDigest: "8f8c850431a27afebd4c48021fe9b2e4dec0bf8574f8324222acf328b8a239e5",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}`,
      operations: actor => [
        { kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: 2 },
        { kind: "resource", targetId: actor.id, resource: "ap", operation: "gain", amount: 1 },
      ],
      choices: () => [],
    }),
    eventTrigger({
      id: "disruptor.siren.2",
      label: "Сирена II: после Испуга выбрать притягивание до 3 клеток",
      sourceDigest: "62f65d9d2cfad5b96f12f80b2ece81635e47b5f63083b35b4f4c6eb1db1b5ed6",
      coverage: "partial",
      triggerKey: ({ actor, event, context }) => `${context.ownerTurnKey || event.id}:${actor.id}`,
      operations: () => [],
      choices: (actor, event) => {
        const targetId = event.payload?.targetId;
        return targetId ? [{
          id: "pull",
          label: "Притянуть до 3 клеток",
          operations: [{ kind: "forced-towards", targetId, sourceActorId: actor.id, maximum: 3, ruleId: "disruptor.siren.2" }],
          context: { targetId, sourceActorId: actor.id, maximum: 3, eventId: event.id },
        }] : [];
      },
    }),
    eventTrigger({
      id: "disruptor.siren.3",
      label: "Сирена III: после Духовного или Ментального Завершения подтянуть Испуганных врагов",
      sourceDigest: "231b63c69615f78497650a97d3a5225a98f298a882d4adb2eedaebdff16c5b7e",
      coverage: "full",
      triggerKey: ({ actor, event }) => `${event.id}:${event.payload?.actionInstanceId || "missing"}:${actor.id}:siren-3`,
      operations: () => [],
      choices: (actor, event, context) => {
        const payload = event.payload || {}, actionInstanceId = payload.actionInstanceId;
        if (event.type !== "action.resolve" || event.actorId !== actor.id || !actionInstanceId || !context.scene) return [];
        const targetIds = Array.isArray(payload.targetIds) ? payload.targetIds.filter(id => typeof id === "string") : [];
        if (targetIds.length !== 1) return [];
        const target = context.scene.actors?.find(item => item.id === targetIds[0]);
        const feared = (context.scene.actors || []).filter(item => item.team !== actor.team && !item.knockedOut && item.effects?.includes("negative.испуган"));
        if (!target || target.knockedOut || !feared.length) return [];
        return [{
          id: "call-help",
          label: `Подтянуть всех Испуганных врагов к цели (${target.name}) и нанести урон рядом`,
          operations: [{ kind: "forced-towards-group", sourceActorId: actor.id, targetId: target.id, ruleId: "disruptor.siren.3", sourceDigest: "231b63c69615f78497650a97d3a5225a98f298a882d4adb2eedaebdff16c5b7e", actionInstanceId, filter: { team: "opposing", effect: "negative.испуган" } }],
          context: { targetId: target.id, sourceActorId: actor.id, actionInstanceId, fearedActorIds: feared.map(item => item.id), eventId: event.id },
        }];
      },
    }),
    eventTrigger({
      id: "disruptor.chemist.2",
      label: "Химик II: после Ослабления запросить Здоровье и при пороге вывести цель из боя",
      sourceDigest: "ac64f39e6d822bc8b310d86e0a37a9c2c7236f089e76d51e70693c943bd3dff3",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}`,
      operations: () => [],
      choices: (actor, event) => event.payload?.targetId ? [{
        id: "check-health",
        label: "Запросить текущее Здоровье",
        operations: [{ kind: "chemist-health-check", targetId: event.payload.targetId, sourceActorId: actor.id, ruleId: "disruptor.chemist.2" }],
        context: { targetId: event.payload.targetId, sourceActorId: actor.id, eventId: event.id },
      }] : [],
    }),
    eventTrigger({
      id: "vagabond.dim-mak.2",
      label: "Детектив II: после третьего Изучения замедлить всех Помеченных",
      sourceDigest: "8f245e4e776b3358",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:dim-mak-2`,
      operations: (actor, _event, context) => (context.scene?.actors || []).filter(target => target.team !== actor.team && !target.knockedOut && hasEffect(context.scene, target, "negative.помечен")).map(target => ({ kind: "effect", targetId: target.id, effect: "negative.замедлен", sourceActionId: "vagabond.dim-mak.2", techniqueRuleId: "vagabond.dim-mak.2" })),
      choices: () => [],
    }),
    eventTrigger({
      id: "vagabond.dim-mak.3",
      label: "Детектив III: после трёх удалений Слабых точек — телепорт и Завершение Разумом",
      sourceDigest: "8a5ddc5d808d41166abd99dd0c207a6070ebeacf382fe4b0f3275304d7f532dd",
      coverage: "partial",
      triggerKey: ({ actor, event, context }) => `${actor.id}:${event.payload?.carrierActorId || event.payload?.targetId || ""}:${context.ownerTurnKey || event.execution?.ownerTurnInstanceId || event.id}:dim-mak-3`,
      operations: () => [],
      choices: (actor, event, context) => {
        const targetId = event.payload?.carrierActorId || event.payload?.targetId;
        const target = targetId && (context.scene?.actors || []).find(item => item.id === targetId);
        if (!target || target.knockedOut || target.team === actor.team) return [];
        const rows = (context.scene?.log || []).filter(item => item.type === "marker.remove" && item.actorId === actor.id && (item.payload?.carrierActorId || item.payload?.targetId) === target.id && item.payload?.ruleId === "vagabond.dim-mak.1");
        const turnId = event.execution?.ownerTurnInstanceId || context.ownerTurnInstanceId || context.scene?.lionwing?.activeTurnInstanceId || null;
        const inTurn = rows.filter(item => turnId ? (item.execution?.ownerTurnInstanceId || item.payload?.ownerTurnInstanceId) === turnId : Number(item.payload?.turnSerial ?? item.execution?.turnSerial) === Number(context.scene?.turnSerial));
        if (inTurn.length !== 3) return [];
        return [{ id: "finisher", label: `Телепорт рядом с ${target.name} и бесплатное Завершение Разумом`, operations: [{ kind: "detective-finisher-open", targetId: target.id, triggerKey: `${actor.id}:${target.id}:${turnId || context.scene?.turnSerial}:dim-mak-3`, sourceActorId: actor.id, ruleId: "vagabond.dim-mak.3" }], context: { targetId: target.id, causeEventId: event.id } }];
      },
    }),
    eventTrigger({
      id: "vagabond.malicious-mimic.1",
      label: "Злобный подражатель I: записать Впечатление атакующего",
      sourceDigest: "869edd09e775c11dce1b8a01408870c2841d5970e28544d2380ddcb6752718dd",
      coverage: "partial",
      triggerKey: ({ actor, context }) => `${actor.id}:${Number(context.scene?.round || 0)}:malicious-mimic-impression`,
      match: (actor, event, context) => {
        const pending = context.scene?.pendingAction;
        return event.type === "reaction.respond" && event.actorId === actor.id && ["dodge", "clash"].includes(event.payload?.choice) && pending?.actorId && pending.actorId !== actor.id;
      },
      operations: (actor, event, context) => {
        const attacker = context.scene?.actors?.find(item => item.id === context.scene?.pendingAction?.actorId);
        if (!attacker) return [];
        const instanceId = String(attacker.name || attacker.id).trim(), state = actor.lionwing?.inventory, key = `impression#${instanceId}`;
        const source = { ruleId: "vagabond.malicious-mimic.1", sourceDigest: "869edd09e775c11dce1b8a01408870c2841d5970e28544d2380ddcb6752718dd" };
        return state?.records?.[key] ? [{ kind: "inventory", operation: "gain", targetId: actor.id, id: "impression", instanceId, amount: 1, ...source }] : typedConfiguration(actor, "impression", `Впечатление: ${instanceId}`, "count", source, { instanceId, current: 1, initial: 0, maximum: 99, resetAt: "scene", lifetime: "scene", multiple: true, visibility: "owner" });
      },
      choices: () => [],
    }),
    eventTrigger({
      id: "altruist.bardic-savant.1",
      label: "Виртуоз I: выбрать Куплет после Передышки",
      sourceDigest: "896edba28e9a933577bd1956f94da01f4f6beadc1452a5d4c52ac3e4038a5486",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:bardic-verse`,
      match: (actor, event) => event.type === "action.resolve" && event.actorId === actor.id && event.payload?.actionId === ACTIONS.breathe,
      operations: () => [],
      boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? typedConfiguration(actor, "altruist.bardic-savant.verses", "Куплеты", "selected-item", { ruleId: "altruist.bardic-savant.1", sourceDigest: "896edba28e9a933577bd1956f94da01f4f6beadc1452a5d4c52ac3e4038a5486" }, { current: null, maximum: 4, resetAt: "scene", lifetime: "scene", visibility: "owner", multiple: true, items: ["harsh", "soothing", "inspiring", "raucous", "frantic"] }) : [],
      choices: (actor) => [
        ["harsh", "Резкий"], ["soothing", "Успокаивающий"], ["inspiring", "Вдохновляющий"], ["raucous", "Шумный"], ["frantic", "Неистовый"],
      ].map(([id, label]) => ({ id, label: `Получить Куплет «${label}»`, operations: [{ kind: "inventory", operation: "select", targetId: actor.id, id: "altruist.bardic-savant.verses", selectedItemId: id, mode: "add", ruleId: "altruist.bardic-savant.1", sourceDigest: "896edba28e9a933577bd1956f94da01f4f6beadc1452a5d4c52ac3e4038a5486" }], context: { verse: id } })),
    }),
  ];

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
    passive({ id: "altruist.heavenly-saint.1", label: "Небесный святой I: [Дух] Сострадания в начале Сцены (ресурсная часть)", sourceDigest: "06bc22f4a0aedd97f9854a85d70ac537f6469923b3dd66ce4c4e7df5fd324336", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? resourceConfiguration(actor, "compassion", "Сострадание", Number(actor.attrs?.spirit || 0), { replaces: "focus", ruleId: "altruist.heavenly-saint.1" }) : [], resourceGainStatus: (_actor, context) => context.requestedResource === "focus" && ["action.утилитарные-действия.передышка", "action.утилитарные-действия.зарядка"].includes(context.actionId) ? { allowed: false, reason: "Сострадание нельзя получать Передышкой или Зарядкой" } : { allowed: true } }),
    passive({ id: "powerhouse.gunslinger.1", label: "Стрелок I: 6 Пуль вместо Фокуса в начале Сцены (ресурсная часть)", sourceDigest: "cc0633b1a8b266f025540ac30297254052750613f30867617e5b336ac5f58f9b", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? resourceConfiguration(actor, "bullets", "Пули", 6, { replaces: "focus", ruleId: "powerhouse.gunslinger.1" }) : [] }),
    passive({ id: "vagabond.knife-juggler.1", label: "Жонглёр ножами I: 4 Оружия вместо Фокуса в начале Сцены (ресурсная часть)", sourceDigest: "c966bd386dd7b97dd99360928d1337ffe6c1bb00496e7d28db5d3b720d3e18d3", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? resourceConfiguration(actor, "weapons", "Оружие", 4, { replaces: "focus", ruleId: "vagabond.knife-juggler.1" }) : [] }),
    passive({ id: "ruiner.creation-ascetic.1", label: "Создатель I: Материал вместо Фокуса, 0 в начале Сцены (ресурсная часть)", sourceDigest: "6f4e55f851dd43392db08bf1fb2bd639f7921d6767a899dcde23c7492b8f41a3", coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? resourceConfiguration(actor, "material", "Материал", 0, { replaces: "focus", ruleId: "ruiner.creation-ascetic.1" }) : [], resourceGainStatus: (_actor, context) => context.requestedResource === "focus" && !["action.утилитарные-действия.передышка", "action.утилитарные-действия.зарядка"].includes(context.actionId) ? { allowed: false, reason: "Материал можно получать только Передышкой или Зарядкой" } : { allowed: true } }),
    passive({ id: "bulwark.mundane.1", label: "Обыватель I: Упорство вместо Фокуса и ОД, старт Раунда 2+[Тело/2]", sourceDigest: "68955d58e5ba2eed7a9fcc9dbdf303a782a44fecb22c41d22483f7a2468b6710", boundaryOperations: (actor, context) => ["sceneStart", "roundStart"].includes(context?.boundary) ? resourceConfiguration(actor, "tenacity", "Упорство", 2 + Math.ceil(Number(actor.attrs?.body || 0) / 2), { replaces: "focus", replacesAp: true, scope: "roundEnd", ruleId: "bulwark.mundane.1" }) : [], resourceGainStatus: (_actor, context) => ["focus", "ap"].includes(context.requestedResource) ? { allowed: false, reason: "Упорство нельзя получать не из своей Техники" } : { allowed: true }, actionStatus: (_actor, context) => context.actionId === "action.атаки.заклинание" || context.actionId === "action.атаки.завершение" && context.attribute === "spirit" ? { allowed: false, reason: "Обыватель не может использовать Заклинания и Завершения Духом" } : { allowed: true } }),
    passive({ id: "ruiner.spellcrafter.1", label: "Создатель заклинаний I: [Разум] зарядов Инновации в начале Сцены (ресурсная часть)", sourceDigest: "cd258e50964ec7fdf255d20dfb2a710459dc94dfbb4c5c3e9ea73e8ff6f98303", maximumLevel: 1, coverage: "partial", boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? resourceConfiguration(actor, "innovation", "Инновация", Number(actor.attrs?.mind || 0), { ruleId: "ruiner.spellcrafter.1" }) : [] }),
    passive({
      id: "altruist.gourmand.1", label: "Гурман I: порции обновляются в Антракт", sourceDigest: "d7dabbe3ac7be7d0ded9c75f214be072cd634c54e318455cbd28f6e02d401d73", coverage: "partial",
      inventoryOperations: (actor, context) => context?.boundary === "sceneStart" ? typedConfiguration(actor, "altruist.gourmand.meals", "Порции", "stack", { ruleId: "altruist.gourmand.1", sourceDigest: "d7dabbe3ac7be7d0ded9c75f214be072cd634c54e318455cbd28f6e02d401d73" }, { current: Math.ceil(Number(actor.attrs?.mind || 0) / 2), initial: Math.ceil(Number(actor.attrs?.mind || 0) / 2), maximum: Math.ceil(Number(actor.attrs?.mind || 0) / 2), resetAt: "intermission", lifetime: "scene" }) : [],
    }),
    passive({
      id: "altruist.surgeon.2", label: "Хирург II: Бинты и Антисептики", sourceDigest: "701325c8c91817a0ec796973befba9c45e3230ac5670fbb3271dbc3ff54ea40a", coverage: "partial",
      inventoryOperations: (actor, context) => context?.boundary === "sceneStart" ? [
        ...typedConfiguration(actor, "altruist.surgeon.bandages", "Бинты", "stack", { ruleId: "altruist.surgeon.2", sourceDigest: "701325c8c91817a0ec796973befba9c45e3230ac5670fbb3271dbc3ff54ea40a" }, { current: 0, initial: 0, maximum: 99, resetAt: "intermission", lifetime: "scene" }),
        ...typedConfiguration(actor, "altruist.surgeon.disinfectant", "Антисептики", "stack", { ruleId: "altruist.surgeon.2", sourceDigest: "701325c8c91817a0ec796973befba9c45e3230ac5670fbb3271dbc3ff54ea40a" }, { current: 0, initial: 0, maximum: 99, resetAt: "intermission", lifetime: "scene" }),
      ] : [],
    }),
    passive({
      id: "altruist.deckbuilder.1", label: "Сборщик колоды I: Карты (значения костей)", sourceDigest: "4cc9dcace6206469b673302c5793c819f54edd9bbc31090aea4b22a016ef6b0b", coverage: "partial",
      inventoryOperations: (actor, context) => context?.boundary === "sceneStart" ? typedConfiguration(actor, "altruist.deckbuilder.cards", "Карты", "recorded-value", { ruleId: "altruist.deckbuilder.1", sourceDigest: "4cc9dcace6206469b673302c5793c819f54edd9bbc31090aea4b22a016ef6b0b" }, { current: 0, initial: 0, minimum: 1, maximum: 6, resetAt: "scene", lifetime: "scene", visibility: "owner" }) : [],
    }),
    passive({
      id: "altruist.deckbuilder.2", label: "Сборщик колоды II: захваченная Карта", sourceDigest: "e6c003921a7f4ac2390ae9b65fe104c443f63dedf9df50505bce49285e2b0d6a", coverage: "partial",
      inventoryOperations: (actor, context) => context?.boundary === "sceneStart" ? typedConfiguration(actor, "altruist.deckbuilder.captured-card", "Захваченная Карта", "recorded-value", { ruleId: "altruist.deckbuilder.2", sourceDigest: "e6c003921a7f4ac2390ae9b65fe104c443f63dedf9df50505bce49285e2b0d6a" }, { current: 0, initial: 0, minimum: 1, maximum: 6, resetAt: "scene", lifetime: "scene", visibility: "owner" }) : [],
    }),
    passive({
      id: "ruiner.mana-blades.1", label: "Кузнец клинков I: Арсенал и ковки", sourceDigest: "eacb55ca05c443bfe0782ea2a16415a37749691da1166a9298433934ae40257a", coverage: "partial",
      inventoryOperations: (actor, context) => context?.boundary === "sceneStart" ? [
        ...typedConfiguration(actor, "ruiner.mana-blades.arsenal", "Арсенал", "selected-item", { ruleId: "ruiner.mana-blades.1", sourceDigest: "eacb55ca05c443bfe0782ea2a16415a37749691da1166a9298433934ae40257a" }, { current: null, initial: null, maximum: 99, resetAt: "scene", lifetime: "scene", visibility: "owner", multiple: true, items: [] }),
        ...typedConfiguration(actor, "ruiner.mana-blades.forges", "Ковки", "stack", { ruleId: "ruiner.mana-blades.1", sourceDigest: "eacb55ca05c443bfe0782ea2a16415a37749691da1166a9298433934ae40257a" }, { current: 0, initial: 0, maximum: 99, resetAt: "scene", lifetime: "scene" }),
      ] : [],
    }),
    passive({
      id: "ruiner.long-draw.1", label: "Рейнджер I: заряды Подготовки", sourceDigest: "16797d24282b090cf8d8967f8c6b48cdb67d5e95fc30f3c456a0a786954da4d9", coverage: "partial",
      inventoryOperations: (actor, context) => context?.boundary === "sceneStart" ? typedConfiguration(actor, "ruiner.long-draw.prep", "Подготовка", "charges", { ruleId: "ruiner.long-draw.1", sourceDigest: "16797d24282b090cf8d8967f8c6b48cdb67d5e95fc30f3c456a0a786954da4d9" }, { current: 0, initial: 0, maximum: 6, resetAt: "scene", lifetime: "scene" }) : [],
    }),
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
      id: "powerhouse.monastic-sage.1",
      label: "Монах-воин I: +2 Брони, пока Усилен; +2 Уклонения в конце Хода, пока Ускорен",
      sourceDigest: "f1ff824c2299d7184c07c4bf6a212d3a2f8c40a914d18948ed0c1987059480cc",
      coverage: "full",
      statBonus: (actor, key, context) => key === "armor" && (context?.activeEffectIds || actor.effects || []).includes("positive.усилен") ? 2 : 0,
      boundaryOperations: (actor, context) => context?.boundary === "turnEnd" && context.activeActor?.id === actor.id && context.activeEffectIds?.includes("positive.ускорен")
        ? [{ kind: "modifier", targetId: actor.id, stat: "evasion", amount: 2, duration: "manual" }]
        : [],
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
    passive({
      id: "vagabond.acrobat.1",
      label: "Акробат I: Преимущество Стычки за клетки этого Прыжка (пассивная часть)",
      sourceDigest: "c32ea3ffcffce0dad6125825610e62362b8a123a707aefbd6e5198a4e4aa80ae",
      coverage: "partial",
      rollBonus: (actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.стычка" && context.targetIds?.length === 1 && Number(context.targetDistance) === 1 && Number.isFinite(Number(context.jumpDistance)) ? Math.min(Number(actor.attrs?.talent || 0), Math.max(0, Number(context.jumpDistance))) : 0,
    }),
    passive({
      id: "ruiner.rapid-fire-sorcery.3",
      label: "Искоренитель III: Преимущество Заклинания после Rapid Fire (пассивная часть)",
      sourceDigest: "0462eaa7973d62275213d8721669cbbdd741d05c772b0b87ded9557e7ad58a0b",
      coverage: "partial",
      rollBonus: (actor, context) => {
        if (context?.kind !== "attack" || context.actionId !== "action.атаки.заклинание" || context.rapidFire !== true) return 0;
        const nearbyEnemies = Number(context.differentEnemiesWithinFive ?? 0);
        return Number.isSafeInteger(nearbyEnemies) && nearbyEnemies >= 0 ? nearbyEnemies + Math.max(0, Number(context.tension || 0)) : 0;
      },
    }),
    passive({
      id: "ruiner.bombardier.1",
      label: "Бомбардир I: Завершение Духом по центру и смежным целям",
      sourceDigest: "3d9ff42ccdca001941878db3a63ef647bf904ad689d35b2c6b7e5c76e1ce59d3",
      coverage: "partial",
    }),
    passive({
      id: "ruiner.bombardier.2",
      label: "Бомбардир II: Преимущество Духовного Завершения за пустые клетки (пассивная часть)",
      sourceDigest: "46784c9f35cd64891f6ba70dc0d5a14ddf7f15aaab733ca1dbd3e6b3c60697c5",
      coverage: "partial",
      rollBonus: (actor, context) => {
        if (context?.kind !== "attack" || context.actionId !== "action.атаки.завершение" || context.attribute !== "spirit" || context.techniqueRuleId !== "ruiner.bombardier.2" || Number(context.focusSpent || 0) < 2) return 0;
        const area = context.areaPlan?.result;
        if (area && (area.shape !== "square3" || Number(area.emptyTargetCount) !== Number(context.emptyTargetCount))) return 0;
        const empty = Number(area?.emptyTargetCount ?? context.emptyTargetCount);
        return Number.isSafeInteger(empty) && empty >= 0 ? Math.min(empty, Number(actor.tier || 1) + 2) : 0;
      },
    }),
    passive({
      id: "ruiner.bombardier.3",
      label: "Бомбардир III: Завершение Духом по зоне 5×5",
      sourceDigest: "e9b9958348fa1bf6bf5f752ead593042fcd332ebcc8e28cd2a23054bea16a4de",
      coverage: "full",
    }),
    passive({
      id: "ruiner.ritualist.2",
      label: "Ритуалист II: +Напряжение и +3 дальности первому Духовному Завершению в круге (пассивная часть)",
      sourceDigest: "63d521cc5b39ef4ed246eb5330c236374e010d8e1cd066ee83c92b770211905a",
      coverage: "partial",
      rollBonus: (_actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.завершение" && context.attribute === "spirit" && context.spellCircleActive === true && context.firstSpiritFinisherThisTurn === true ? Math.max(0, Number(context.tension || 0)) : 0,
      rangeBonus: (_actor, context) => context?.actionId === "action.атаки.завершение" && context.attribute === "spirit" && context.spellCircleActive === true && context.firstSpiritFinisherThisTurn === true ? 3 : 0,
    }),
    passive({
      id: "vagabond.enchained.3",
      label: "Скованный III: Преимущество Стычки после движения от связанного Заклинания (пассивная часть)",
      sourceDigest: "d64f6084e498993783640f7d7b09dad64d000a3cfeb26b7744524b23336a1b10",
      coverage: "partial",
      rollBonus: (actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.стычка" && context.enchainedCastMoveAdjacent === true ? Number(actor.tier || 1) * 2 : 0,
    }),
  ];
  // Action modifiers are pure quotes.  They describe a possible change to a
  // base action; the engine remains the only writer of AP, resources, usage
  // history, and Scene state.  A modifier is enabled only when its narrator
  // opt-in flag is present, just like the numeric adapters above.
  const actionModifiers = [
    actionModifier({
      id: "vagabond.dim-mak.1", techniqueId: "vagabond.dim-mak", level: 1,
      sourceDigest: "57c2d10021b83b34",
      label: "Детектив I: повторное Изучение той же цели Быстрое",
      available: actor => knows(actor, "vagabond.dim-mak", 1),
      modify: (actor, context) => {
        if (context.actionId !== ACTIONS.study) return null;
        const targetId = Array.isArray(context.targetIds) && context.targetIds.length === 1 ? context.targetIds[0] : null;
        if (!targetId) return null;
        const serial = Number(context.scene?.turnSerial), instance = context.scene?.lionwing?.activeTurnInstanceId || null;
        const studies = eventHistory(actor, context.scene).filter(item => item.actionId === ACTIONS.study && (instance && item.ownerTurnInstanceId === instance || Number(item.turnSerial) === serial));
        const sameTarget = studies.filter(item => (item.targetIds || [item.targetId]).includes(targetId));
        if (!sameTarget.length) return null;
        return { swift: true, reason: "Повторное Изучение той же цели Быстрое." };
      },
    }),
    actionModifier({
      id: "vagabond.dim-mak.2", techniqueId: "vagabond.dim-mak", level: 2,
      sourceDigest: "8f245e4e776b3358",
      label: "Детектив II: третье Изучение бесплатно и замедляет Помеченных",
      available: actor => knows(actor, "vagabond.dim-mak", 2),
      modify: (actor, context) => {
        if (context.actionId !== ACTIONS.study || !Array.isArray(context.targetIds) || context.targetIds.length !== 1) return null;
        const serial = Number(context.scene?.turnSerial), instance = context.scene?.lionwing?.activeTurnInstanceId || null;
        const studies = eventHistory(actor, context.scene).filter(item => item.actionId === ACTIONS.study && (instance && item.ownerTurnInstanceId === instance || !instance && Number(item.turnSerial) === serial));
        return studies.length >= 2 ? { cost: 0, costMode: "replace", reason: "Третье Изучение бесплатно." } : null;
      },
    }),
    actionModifier({
      id: "powerhouse.martial-artist.2", techniqueId: "powerhouse.martial-artist", level: 2,
      sourceDigest: "ffab119dac241453faa82dab8e20523afa694f42b997a24d13fdf4b7f16e9e83",
      label: "Мастер боевых искусств II: первая Стычка в Ход Быстрая",
      available: actor => knows(actor, "powerhouse.martial-artist", 2),
      modify: (actor, context) => context.actionId === ACTIONS.skirmish && !usedInTurn(actor, context.scene, ACTIONS.skirmish)
        ? { swift: true, reason: "Первая Стычка этого Хода по «Состоянию потока»." } : null,
    }),
    actionModifier({
      id: "altruist.fog-walker.3", techniqueId: "altruist.fog-walker", level: 3,
      sourceDigest: "a82de2c090617d57ffbdfed479a3f04d329d621c75f9a11c1aeadd99e5c45f35",
      label: "Туманник III: Передышки Быстрые",
      available: actor => knows(actor, "altruist.fog-walker", 3),
      modify: (_actor, context) => context.actionId === ACTIONS.breathe ? { swift: true, reason: "Передышки Туманника являются Быстрыми." } : null,
    }),
    actionModifier({
      id: "altruist.bardic-savant.2", techniqueId: "altruist.bardic-savant", level: 2,
      sourceDigest: "e95d0d8dec7fd38dc97009b99220ff661e0c5d27896e6200de36fc110a16c8db",
      label: "Виртуоз II: Передышки Быстрые",
      available: actor => knows(actor, "altruist.bardic-savant", 2),
      modify: (_actor, context) => context.actionId === ACTIONS.breathe ? { swift: true, reason: "Передышки Виртуоза являются Быстрыми." } : null,
    }),
    actionModifier({
      id: "vagabond.drunkard.3", techniqueId: "vagabond.drunkard", level: 3,
      sourceDigest: "33495ba0f5d41b1cda1d7dc1bc5ff3c414484490bfcebbc2fa52b8d994dde833",
      label: "Пьяница III: первая Передышка в Ход Быстрая",
      available: actor => knows(actor, "vagabond.drunkard", 3),
      modify: (actor, context) => context.actionId === ACTIONS.breathe && !usedInTurn(actor, context.scene, ACTIONS.breathe)
        ? { swift: true, reason: "Первая Передышка этого Хода по «Залпом»." } : null,
    }),
    actionModifier({
      id: "ruiner.creation-ascetic.2", techniqueId: "ruiner.creation-ascetic", level: 2,
      sourceDigest: "d19e636560bcfb7c9345b9bb4779f65c6b3f25b78576a6432bd6b1bbc834cbf9",
      label: "Создатель II: первая Передышка Быстрая, Зарядка за 1",
      available: actor => knows(actor, "ruiner.creation-ascetic", 2),
      modify: (actor, context) => {
        if (context.actionId === ACTIONS.breathe && !usedInTurn(actor, context.scene, ACTIONS.breathe)) return { swift: true, reason: "Первая Передышка этого Хода Быстрая." };
        if (context.actionId === ACTIONS.charge) return { cost: 1, costMode: "replace", reason: "Зарядка Создателя стоит 1." };
        return null;
      },
    }),
    actionModifier({
      id: "altruist.artist.2", techniqueId: "altruist.artist", level: 2,
      sourceDigest: "41644f20d10eb46aecf2c3e4548d86ff759ff7dc7f8e679a8b5046395023d851",
      label: "Артист II: первое Взаимодействие в Ход бесплатно",
      available: actor => knows(actor, "altruist.artist", 2),
      modify: (actor, context) => context.actionId === ACTIONS.interact && !usedInTurn(actor, context.scene, ACTIONS.interact)
        ? { cost: 0, costMode: "replace", swift: true, reason: "Первое Взаимодействие этого Хода бесплатно и Быстрое." } : null,
    }),
    actionModifier({
      id: "altruist.alchemist.2", techniqueId: "altruist.alchemist", level: 2,
      sourceDigest: "389ef1a54fb172ceaff075d3155b697ae17d25ad138ea4854d38d515db1333ea",
      label: "Алхимик II: первое Взаимодействие в Ход бесплатно",
      available: actor => knows(actor, "altruist.alchemist", 2),
      modify: (actor, context) => context.actionId === ACTIONS.interact && !usedInTurn(actor, context.scene, ACTIONS.interact)
        ? { cost: 0, costMode: "replace", swift: true, reason: "Первое Взаимодействие этого Хода бесплатно и Быстрое." } : null,
    }),
    actionModifier({
      id: "vagabond.assassin.1", techniqueId: "vagabond.assassin", level: 1,
      sourceDigest: "e2e8e0aa3b195f4df4e15393490e95fe151ebcf62a28e16c75afd5684b2b75ca",
      label: "Ассасин I: первое Hide после Deploy бесплатно",
      available: actor => knows(actor, "vagabond.assassin", 1),
      modify: (actor, context) => context.actionId === ACTIONS.hide && context.firstActionAfterDeploy === true
        ? { cost: 0, costMode: "replace", ignoreRequirements: ["boardEdge", "startedDisappeared"], reason: "Первое действие после Развёртывания — Hide Ассасина." } : null,
    }),
    actionModifier({
      id: "vagabond.weaponsmith.2", techniqueId: "vagabond.weaponsmith", level: 2,
      sourceDigest: "7aa33f76d9edadcbdc4aced83462e36c212eec5b7c1fa48d162a9424dc16fd37",
      label: "Оружейник II: Зарядка за 1 до смены Формы",
      available: actor => knows(actor, "vagabond.weaponsmith", 2),
      // Form swapping is not currently a public engine operation.  Until a
      // trusted form lifecycle writes formSwapTurnSerial, this rule stays
      // inactive rather than accepting a client supplied flag.
      modify: (actor, context) => context.actionId === ACTIONS.charge && Number.isSafeInteger(actor.lionwing?.formSwapTurnSerial) && Number(actor.lionwing.formSwapTurnSerial) !== Number(context.scene?.turnSerial)
        ? { cost: 1, costMode: "replace", reason: "В этом Ходу Формы ещё не менялись." } : null,
    }),
    actionModifier({
      id: "powerhouse.improvisational-fighter.2", techniqueId: "powerhouse.improvisational-fighter", level: 2,
      sourceDigest: "5deab4b222d3c6321b8e5797888d7959ed5e2ac77dba223d0dbf1974857302ba",
      label: "Импровизатор II: одно Взаимодействие за Раунд бесплатно",
      available: actor => knows(actor, "powerhouse.improvisational-fighter", 2),
      // Whether Interact results in an Attack belongs to the trusted ActionPlan
      // semantic context.  The ordinary client action has no proof of that
      // choice, so this adapter deliberately does not guess.
      modify: (_actor, _context) => null,
    }),
  ];
  const adapters = Object.freeze([berserker, flagellant, ...passives, ...eventAdapters]);
  const enabledActionModifiers = actor => actionModifiers.filter(rule => rule.available(actor) && actor?.lionwing?.automation?.[rule.id] === true);
  const actionQuote = (actor, context = {}) => {
    const baseCost = Number(context.baseCost || 0), baseResource = context.baseResource || null;
    const quote = { cost: baseCost, resource: baseResource, swift: Boolean(context.baseSwift), range: context.baseRange ?? null, ignoreRequirements: [], modifiers: [], reasons: [] };
    const replacements = new Map();
    for (const rule of enabledActionModifiers(actor)) {
      const patch = rule.modify?.(actor, context);
      if (!patch) continue;
      if (patch.cost != null) {
        const cost = Number(patch.cost);
        if (!Number.isSafeInteger(cost) || cost < 0 || cost > 9999) return { ok: false, reason: "Модификатор действия вернул недопустимую цену." };
        const mode = patch.costMode || "replace";
        if (mode === "replace") replacements.set(rule.id, cost);
        else if (mode === "add") quote.cost += cost;
        else return { ok: false, reason: "Модификатор действия использует неизвестный порядок цены." };
      }
      if (patch.swift === true) quote.swift = true;
      if (patch.range != null) quote.range = Number(patch.range);
      if (Array.isArray(patch.ignoreRequirements)) quote.ignoreRequirements.push(...patch.ignoreRequirements);
      quote.modifiers.push({ id: rule.id, techniqueId: rule.techniqueId, level: rule.level, sourceDigest: rule.sourceDigest, coverage: rule.coverage, reason: patch.reason || rule.label });
      if (patch.reason) quote.reasons.push(patch.reason);
    }
    const distinctCosts = [...new Set(replacements.values())];
    if (distinctCosts.length > 1) return { ok: false, reason: `Конфликт замен цены: ${[...replacements.keys()].join(", ")}.` };
    if (distinctCosts.length === 1) quote.cost = distinctCosts[0];
    quote.ignoreRequirements = [...new Set(quote.ignoreRequirements)];
    return { ok: true, ...quote, modifierIds: quote.modifiers.map(item => item.id), reason: quote.reasons.join(" ") };
  };
  const enabled = actor => adapters.filter(rule => rule.available(actor) && actor.lionwing?.automation?.[rule.id] === true);
  const eventTriggerRules = Object.freeze(eventAdapters);
  const afterEvent = (actor, event, context = {}) => {
    if (!actor || !event || !event.type) return [];
    return enabled(actor).filter(rule => eventTriggerRules.includes(rule)).flatMap(rule => {
      let match = false;
      if (rule.id === "bulwark.rising-challenger.1") match = event.type === "clash.success" && event.actorId === actor.id;
      else if (rule.id === "powerhouse.berserker.3") match = event.type === "damage.apply" && event.payload?.targetId === actor.id && Number(event.payload?.dealt || 0) > 0 && !context.used;
      else if (rule.id === "powerhouse.intimidator.3") match = event.type === "actor.knockout" && event.actorId === actor.id && event.payload?.targetId !== actor.id && Boolean(event.payload?.targetId);
      else if (rule.id === "disruptor.siren.2") match = event.type === "effect.apply" && event.payload?.effect === "negative.испуган" && event.actorId === actor.id && event.payload?.targetId !== actor.id;
      else if (rule.id === "disruptor.siren.3") {
        const payload = event.payload || {}, attribute = payload.attribute || "spirit";
        match = event.type === "action.resolve" && event.actorId === actor.id && payload.actionId === "action.атаки.завершение" && ["mind", "spirit"].includes(String(attribute).toLowerCase()) && typeof payload.actionInstanceId === "string" && Array.isArray(payload.targetIds) && payload.targetIds.length === 1 && Boolean(payload.targetIds[0]) && Boolean(event.execution?.actionInstanceId || event.execution?.rootActionId);
      }
      else if (rule.id === "disruptor.chemist.2") match = event.type === "effect.apply" && event.payload?.effect === "negative.ослаблен" && event.actorId === actor.id && event.payload?.targetId !== actor.id;
      else if (rule.id === "vagabond.dim-mak.1") {
        const marker = (context.scene?.markers || []).find(item => item.ruleId === "vagabond.dim-mak.1" && item.ownerActorId === actor.id && item.space === actor.space && Number(item.x) === Number(actor.x) && Number(item.y) === Number(actor.y));
        match = event.type === "actor.enter" && event.actorId === actor.id && Boolean(marker);
      } else if (rule.id === "vagabond.dim-mak.2") {
        const instance = context.scene?.lionwing?.activeTurnInstanceId || event.execution?.ownerTurnInstanceId || null;
        const studies = eventHistory(actor, context.scene).filter(item => item.actionId === ACTIONS.study && (instance ? item.ownerTurnInstanceId === instance : Number(item.turnSerial) === Number(context.scene?.turnSerial)));
        match = event.type === "action.resolve" && event.payload?.actionId === ACTIONS.study && event.actorId === actor.id && studies.length === 3;
      } else if (rule.id === "vagabond.dim-mak.3") {
        if (event.type !== "marker.remove" || event.payload?.ruleId !== "vagabond.dim-mak.1" || event.actorId !== actor.id) return [];
        const targetId = event.payload?.carrierActorId || event.payload?.targetId;
        const turnId = event.execution?.ownerTurnInstanceId || context.ownerTurnInstanceId || context.scene?.lionwing?.activeTurnInstanceId || null;
        const removals = (context.scene?.log || []).filter(item => item.type === "marker.remove" && item.actorId === actor.id && item.payload?.ruleId === "vagabond.dim-mak.1" && (item.payload?.carrierActorId || item.payload?.targetId) === targetId && (turnId ? (item.execution?.ownerTurnInstanceId || item.payload?.ownerTurnInstanceId) === turnId : Number(item.payload?.turnSerial ?? item.execution?.turnSerial) === Number(context.scene?.turnSerial)));
        match = removals.length === 3;
      }
      else if (typeof rule.match === "function") match = Boolean(rule.match(actor, event, context));
      if (!match) return [];
      const triggerKey = typeof rule.triggerKey === "function" ? rule.triggerKey({ actor, event, context }) : `${event.id}:${actor.id}`;
      return [{ id: rule.id, label: rule.label, sourceDigest: rule.sourceDigest, coverage: rule.coverage, triggerKey, operations: rule.operations(actor, event, context), choices: rule.choices(actor, event, context) }];
    });
  };
  const numericContributions = (actor, method, context) => enabled(actor).flatMap(rule => {
    const amount = Number(method.startsWith("stat") ? rule[method]?.(actor, context.key, context) : rule[method]?.(actor, context) || 0);
    return Number.isFinite(amount) && amount !== 0 ? [{ id: rule.id, label: rule.label, amount }] : [];
  });
  global.DAWN_LIONWING_ADAPTERS = Object.freeze({
    list: actor => adapters.filter(rule => rule.available(actor)).map(({ id, label, sourceDigest, coverage }) => ({ id, label, sourceDigest, coverage })),
    replacements: (actor, original) => enabled(actor).flatMap(rule => rule.replacements?.(actor, original) || []),
    afterEffect: (actor, original) => enabled(actor).flatMap(rule => rule.afterEffect?.(actor, original) || []),
    afterEvent,
    rollBonuses: (actor, context = {}) => numericContributions(actor, "rollBonus", context),
    rollBonus: (actor, context = {}) => numericContributions(actor, "rollBonus", context).reduce((sum, item) => sum + item.amount, 0),
    statBonuses: (actor, key, context = {}) => numericContributions(actor, "statBonus", { ...context, key }),
    statBonus: (actor, key, context = {}) => numericContributions(actor, "statBonus", { ...context, key }).reduce((sum, item) => sum + item.amount, 0),
    statMinimums: (actor, key, context = {}) => numericContributions(actor, "statMinimum", { ...context, key }),
    statMinimum: (actor, key, context = {}) => numericContributions(actor, "statMinimum", { ...context, key }).reduce((minimum, item) => Math.max(minimum, item.amount), 0),
    rangeBonuses: (actor, context = {}) => numericContributions(actor, "rangeBonus", context),
    rangeBonus: (actor, context = {}) => numericContributions(actor, "rangeBonus", context).reduce((sum, item) => sum + item.amount, 0),
    boundaryOperations: (actor, context = {}) => enabled(actor).flatMap(rule => {
      const operations = [...(rule.boundaryOperations?.(actor, context) || []), ...(rule.inventoryOperations?.(actor, context) || [])];
      return operations.length ? [{ id: rule.id, label: rule.label, operations }] : [];
    }),
    resourceGainStatus: (actor, context = {}) => enabled(actor).reduce((status, rule) => status.allowed === false ? status : rule.resourceGainStatus?.(actor, context) || status, { allowed: true, reason: "" }),
    actionStatus: (actor, context = {}) => enabled(actor).reduce((status, rule) => status.allowed === false ? status : rule.actionStatus?.(actor, context) || status, { allowed: true, reason: "" }),
    actionModifiers: actor => enabledActionModifiers(actor).map(rule => ({ id: rule.id, techniqueId: rule.techniqueId, level: rule.level, label: rule.label, sourceDigest: rule.sourceDigest, coverage: rule.coverage })),
    actionQuote: (actor, context = {}) => actionQuote(actor, context),
  });
})(typeof window === "object" ? window : globalThis);
