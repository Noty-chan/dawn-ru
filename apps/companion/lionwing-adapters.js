"use strict";

// Small read-only adapters return plans or numeric contributions. They never
// mutate a scene: the LionWing engine remains the single authority that applies
// the resulting rule.
(function (global) {
  const inventory = global.DAWN_LIONWING_INVENTORY || null;
  const lionwing = actor => actor?.rulesEdition === "lionwing";
  const knows = (actor, techniqueId, level) => lionwing(actor) && Number((actor.knownTechniques ?? actor.techniques)?.[techniqueId] || 0) >= level;
  const distance = (a, b) => a?.space === b?.space ? Math.abs(Number(a?.x || 0) - Number(b?.x || 0)) + Math.abs(Number(a?.y || 0) - Number(b?.y || 0)) : Infinity;
  const passive = ({ id, label, sourceDigest, rollBonus, statBonus, statMinimum, rangeBonus, numeric, boundaryOperations, inventoryOperations, resourceGainStatus, actionStatus, triggerKey, match, operations = [], choices = [], choiceSet = false, maximumLevel = null, coverage = "full" }) => {
    const techniqueId = id.replace(/\.\d+$/, ""), level = Number(id.match(/\.(\d+)$/)?.[1] || 0);
    return Object.freeze({ id, techniqueId, level, label, sourceDigest, coverage, available: actor => knows(actor, techniqueId, level) && (maximumLevel == null || Number((actor.knownTechniques ?? actor.techniques)?.[techniqueId] || 0) <= maximumLevel), rollBonus, statBonus, statMinimum, rangeBonus, numeric, boundaryOperations, inventoryOperations, resourceGainStatus, actionStatus, triggerKey, match, operations, choices, choiceSet });
  };
  const actionBonus = (actionId, amount = 1) => (_actor, context) => context?.kind === "attack" && context.actionId === actionId ? amount : 0;
  const attackIds = new Set(["action.атаки.заклинание", "action.атаки.завершение", "action.атаки.стычка"]);
  // Technique tags are rules data.  Never trust a client supplied `tags` /
  // `techniqueTags` array: it could opt a Martial Artist out of its canonical
  // weapon restriction (or opt another technique into one).  Callers may
  // identify techniques, but ownership and level are checked against the
  // loaded LionWing catalogue before tags are read.
  const techniqueCatalogue = () => [...(global.DAWN_LIONWING_DATA?.archetypes || []), ...(global.DAWN_DATA?.archetypes || [])];
  const trustedTechniqueTags = (actor, context = {}) => {
    const ids = [];
    for (const value of [context.techniqueId, context.techniqueRuleId, ...(Array.isArray(context.techniqueIds) ? context.techniqueIds : [])]) {
      if (typeof value !== "string" || !value) continue;
      const match = value.match(/^(.*)\.(\d+)(?:\.[a-z-]+)?$/i);
      const techniqueId = match?.[1] || value, requestedLevel = Number(match?.[2] || 0);
      const known = Number((actor?.knownTechniques ?? actor?.techniques)?.[techniqueId] || 0);
      if (!known || requestedLevel > known) continue;
      ids.push(techniqueId);
    }
    const tags = new Set();
    for (const id of ids) {
      const technique = techniqueCatalogue().flatMap(archetype => archetype.techniques || []).find(item => item.id === id);
      for (const tag of String(technique?.tags || "").split(",")) {
        const normalized = tag.trim().toLowerCase();
        if (normalized) tags.add(normalized);
        if (normalized === "оружие") tags.add("weapon");
      }
    }
    return tags;
  };
  const usesWeaponTechnique = (actor, context = {}) => trustedTechniqueTags(actor, context).has("weapon");
  const ACTIONS = Object.freeze({
    skirmish: "action.атаки.стычка",
    finish: "action.атаки.завершение",
    duel: "action.атаки.дуэль",
    breathe: "action.утилитарные-действия.передышка",
    charge: "action.утилитарные-действия.зарядка",
    hide: "action.утилитарные-действия.скрыться",
    step: "action.движение.шаг",
    interact: "action.утилитарные-действия.взаимодействие",
    study: "action.утилитарные-действия.изучение",
  });
  const SIREN_SOURCE_DIGESTS = Object.freeze({
    "disruptor.siren.1": "8d9becba6e6f63641f5dc1a8a47e965c73f0e7112ef7ef4b781b2c6ffb632979",
    "disruptor.siren.2": "62f65d9d2cfad5b96f12f80b2ece81635e47b5f63083b35b4f4c6eb1db1b5ed6",
    "disruptor.siren.3": "231b63c69615f78497650a97d3a5225a98f298a882d4adb2eedaebdff16c5b7e",
  });
  const eventHistory = (actor, scene) => Array.isArray(actor?.lionwing?.history) ? actor.lionwing.history : [];
  const comboSequences = Object.freeze([
    { techniqueId: "powerhouse.technician", level: 3, sequenceKeys: ["skirmish", "finish"] },
    { techniqueId: "powerhouse.dragonslayer", level: 3, sequenceKeys: ["breathe", "finish"] },
    { techniqueId: "powerhouse.spellsword", level: 3, sequenceKeys: ["spell", "finish"] },
    { techniqueId: "vagabond.assassin", level: 3, sequenceKeys: ["disappear", "step"] },
    { techniqueId: "vagabond.speed-demon", level: 2, sequenceKeys: ["breathe", "step"] },
  ]);
  // Information-query owns authoritative Study receipts. Keep legacy actor
  // history as a compatibility fallback for old saves that predate the
  // shared registry; never treat a client supplied flag as a Study proof.
  const studyHistory = (actor, scene) => {
    const shared = global.DAWN_LIONWING_INFORMATION_QUERY;
    const canonical = typeof shared?.studies === "function" ? shared.studies(scene, { actorId: actor?.id }).map(item => ({ ...item, actionId: ACTIONS.study, targetIds: [item.targetId], ownerTurnInstanceId: item.turnInstanceId })) : [];
    const seen = new Set(canonical.map(item => item.actionInstanceId).filter(Boolean));
    return canonical.concat(eventHistory(actor, scene).filter(item => item.actionId === ACTIONS.study && (!item.actionInstanceId || !seen.has(item.actionInstanceId))));
  };
  const usedInTurn = (actor, scene, actionId) => {
    const serial = Number(scene?.turnSerial);
    const instance = scene?.lionwing?.activeTurnInstanceId || null;
    return eventHistory(actor, scene).some(item => item.actionId === actionId && (
      instance && item.ownerTurnInstanceId === instance || Number(item.turnSerial) === serial
    ));
  };
  const usedInRound = (actor, scene, actionId) => eventHistory(actor, scene).some(item => item.actionId === actionId && Number(item.round) === Number(scene?.round));
  const clockValue = (actor, id) => Number(actor?.ruleClocks?.[id]?.current ?? actor?.ruleClocks?.[id]?.value ?? 0);
  const turnHistory = (actor, scene, event = null) => {
    const rows = eventHistory(actor, scene);
    const instance = event?.payload?.ownerTurnInstanceId || event?.execution?.ownerTurnInstanceId || scene?.lionwing?.activeTurnInstanceId || null;
    const serial = Number(event?.payload?.turnSerial ?? event?.execution?.turnSerial ?? scene?.turnSerial ?? 0);
    return rows.filter(item => instance
      ? item.ownerTurnInstanceId === instance
      : Number(item.ownerTurnSerial ?? item.turnSerial) === serial);
  };
  const immediateAction = (actor, scene, actionId) => {
    const owner = scene?.actors?.find(item => item.id === actor?.id) || actor;
    return turnHistory(owner, scene).at(-1)?.actionId === actionId;
  };
  const sceneTension = scene => {
    const meter = global.DAWN_LIONWING_COMBAT_METER?.read?.(scene);
    const value = Number(meter?.current ?? scene?.tension ?? 0);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  // Power Unleashed is a Charge -> Finisher sequence.  The immediately
  // preceding row is engine-owned history, so a request cannot manufacture
  // the prerequisite with a payload flag or a copied client tension value.
  const studentPowerUnleashed = (actor, scene, context = {}) => {
    if (!knows(actor, "ruiner.student-of-stars", 1) || context.actionId !== ACTIONS.finish) return false;
    const history = turnHistory(actor, scene);
    const previous = history.at(-1);
    return previous?.actionId === ACTIONS.charge
      && (!context.actionInstanceId || previous.ownerTurnInstanceId === context.ownerTurnInstanceId || Number(previous.turnSerial) === Number(scene?.turnSerial));
  };
  const utilityAction = actionId => typeof actionId === "string" && actionId.startsWith("action.утилитарные-действия.");
  const attackAction = actionId => attackIds.has(actionId);
  const balanceId = "powerhouse.monastic-sage.balance";
  const meditatedId = "powerhouse.monastic-sage.meditated";
  // Combo eligibility is derived from the engine-owned action history.  The
  // request payload may carry a cosmetic combo flag, but it cannot establish
  // either member of the sequence or its absence of intervening Actions.
  const comboComplete = (actor, scene, event) => {
    if (event?.type !== "action.resolve" || event.actorId !== actor.id) return false;
    const payload = event.payload || {};
    if (typeof payload.actionInstanceId !== "string" || !payload.actionInstanceId) return false;
    const history = turnHistory(actor, scene), current = history.at(-1), previous = history.at(-2);
    if (!current || !previous || current.actionId !== payload.actionId) return false;
    if (current.ownerTurnInstanceId && previous.ownerTurnInstanceId && current.ownerTurnInstanceId !== previous.ownerTurnInstanceId) return false;
    // Normal engine writes carry the action instance into history.  Retain a
    // compatibility path for pre-instance saves only when the emitted event
    // has an execution receipt; no client boolean is accepted as proof.
    if (current.actionInstanceId && current.actionInstanceId !== payload.actionInstanceId) return false;
    if (!current.actionInstanceId && !event.execution?.actionInstanceId && !event.execution?.rootActionId) return false;
    const idsByKey = {
      skirmish: ACTIONS.skirmish,
      finish: ACTIONS.finish,
      breathe: ACTIONS.breathe,
      step: ACTIONS.step,
      disappear: ACTIONS.hide,
      spell: "action.атаки.заклинание",
    };
    return comboSequences.some(rule => {
      const knownLevel = Math.max(Number(actor.knownTechniques?.[rule.techniqueId] || 0), Number(actor.techniques?.[rule.techniqueId] || 0));
      return knownLevel >= Number(rule.level || 0)
        && idsByKey[rule.sequenceKeys[0]] === previous.actionId
        && idsByKey[rule.sequenceKeys[1]] === current.actionId;
    });
  };
  const stretchClockValue = clockValue;
  const actionModifier = ({ id, techniqueId, level, sourceDigest, label, coverage = "partial", available, modify }) => Object.freeze({
    id, techniqueId, level, sourceDigest, label, coverage,
    available,
    modify,
  });
  const sceneFocus = amount => actor => [{ kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: typeof amount === "function" ? amount(actor) : amount }];
  const resourceConfiguration = (actor, id, label, current, options = {}) => [{ kind: "configure-resource", targetId: actor.id, id, label, current, initial: current, scope: options.scope || "scene", lifetime: "scene", replaces: options.replaces || null, replacesAp: options.replacesAp === true, inverted: options.inverted === true, ruleId: options.ruleId || null }];
  const eventTrigger = ({ id, label, sourceDigest, coverage = "full", triggerKey, match, operations = [], choices = [], choiceSet = false, boundaryOperations, rangeBonus, followUp }) => ({ id, techniqueId: id.replace(/\.\d+$/, ""), level: Number(id.match(/\.(\d+)$/)?.[1] || 0), label, sourceDigest, coverage, available: actor => knows(actor, id.replace(/\.\d+$/, ""), Number(id.match(/\.(\d+)$/)?.[1] || 0)), triggerKey, match, operations, choices, choiceSet, boundaryOperations, rangeBonus, followUp });
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
  const clockConfiguration = (actor, id, label, size, options = {}) => [{ kind: "clock", targetId: actor.id, id, operation: "create", label, current: options.current ?? 0, initial: options.initial ?? 0, size, scope: options.scope || "scene", lifetime: options.lifetime || "scene", ruleId: options.ruleId || null }];

  // Completed-event adapters are deliberately data-only.  The engine supplies
  // the authoritative event and applies the returned operations; an adapter
  // can only describe an eligible trigger and its optional choices.
  const roundRuleUsed = (actor, scene, ruleId) => eventHistory(actor, scene).some(item => item.ruleId === ruleId && Number(item.round) === Number(scene?.round));
  const ownerTurnRuleUsed = (actor, scene, ruleId) => eventHistory(actor, scene).some(item => item.ruleId === ruleId && (
    (scene?.lionwing?.activeTurnInstanceId && item.ownerTurnInstanceId === scene.lionwing.activeTurnInstanceId)
    || Number(item.ownerTurnSerial ?? item.turnSerial) === Number(scene?.turnSerial)
  ));
  const actionReceipt = (scene, actorId, actionInstanceId) => (scene?.log || []).find(item => item.type === "action.resolve" && item.actorId === actorId && item.payload?.actionInstanceId === actionInstanceId) || null;
  const actionTargetsThisTurn = (scene, actor) => {
    const instance = scene?.lionwing?.activeTurnInstanceId;
    return [...new Set((scene?.log || []).filter(item => item.type === "action.resolve" && item.actorId === actor.id && attackIds.has(item.payload?.actionId) && (instance ? item.payload?.ownerTurnInstanceId === instance || item.execution?.ownerTurnInstanceId === instance : true)).flatMap(item => item.payload?.targetIds || []))];
  };
  const hammersChoices = (actor, event, context, triggerKey) => {
    const instanceId = event.payload?.actionInstanceId || event.execution?.actionInstanceId || event.execution?.rootActionId;
    const receipt = actionReceipt(context.scene, actor.id, instanceId), payload = receipt?.payload || {};
    // A Hammer follows this Attack and may choose one of this Attack's
    // targets. Earlier targets from the Turn belong only to Flow-State.
    const targetIds = [...new Set([event.payload?.targetId, ...(payload.targetIds || [])].filter(Boolean))];
    const targets = targetIds.map(id => context.scene.actors?.find(item => item.id === id)).filter(target => target && target.id !== actor.id && !target.knockedOut && target.team !== actor.team);
    const sourceDigest = "5f4610235181dbccff56d2a15b161412018f62becc35812b1e911232e4af4a36", ruleId = "powerhouse.martial-artist.1";
    const use = (id, targetId) => ({ kind: "usage", ruleId: `${ruleId}.${id}`, scope: "round", targetIds: [targetId], actionId: payload.actionId, sourceDigest });
    const option = (id, label, target, operations, extra = {}) => ({ id: `${id}:${target.id}`, label: `${label} (${target.name || target.id})`, operations: [use(id, target.id), ...operations], context: { targetId: target.id, targetIds: [target.id], actionInstanceId: instanceId, ...extra } });
    const choices = [];
    for (const target of targets) {
      if (!roundRuleUsed(actor, context.scene, `${ruleId}.quick-step`)) choices.push(option("quick-step", "Быстрый шаг", target, [{ kind: "martial-quick-step", targetId: actor.id, maximum: 3, evasion: Number(actor.tier || 1), ruleId, sourceDigest }]));
      if (!roundRuleUsed(actor, context.scene, `${ruleId}.binding-blow`)) choices.push(option("binding-blow", "Связывающий удар", target, [{ kind: "effect", targetId: target.id, effect: "negative.пойман", ruleId, sourceDigest }]));
      if (!roundRuleUsed(actor, context.scene, `${ruleId}.rising-knee`)) choices.push(option("rising-knee", "Восходящее колено", target, [{ kind: "effect", targetId: target.id, effect: "negative.подброшен", ruleId, sourceDigest }]));
      if (!roundRuleUsed(actor, context.scene, `${ruleId}.iron-shoulder`)) choices.push(option("iron-shoulder", "Железное плечо", target, [{ kind: "forced-away", targetId: target.id, sourceActorId: actor.id, maximum: 3, ruleId, sourceDigest }]));
    }
    return choices;
  };
  const eventAdapters = [
    eventTrigger({
      id: "powerhouse.breacher.1",
      label: "Картечь I: после успешной Стычки оттолкнуть близкую цель",
      sourceDigest: "9e9680211a203830a82230d86136cc85108032eaea3655fc9e991129d2826af5",
      coverage: "full",
      rangeBonus: (_actor, context) => context?.actionId === ACTIONS.skirmish ? 3 : 0,
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:breacher-buck-shot`,
      match: (actor, event) => {
        const payload = event.payload || {};
        return event.type === "damage.apply" && event.actorId === actor.id && payload.sourceActionId === ACTIONS.skirmish
          && payload.breacherPush === true && payload.breacherAttackSuccess === true && payload.breacherInitialDistance != null
          && Number(payload.breacherInitialDistance) <= 2 && payload.ignored !== true && payload.hit !== false;
      },
      operations: (actor, event) => [{
        kind: "breacher-push",
        targetId: event.payload.targetId,
        sourceActorId: actor.id,
        maximum: Number(event.payload.breacherPushMultiplier || 1),
        initialDistance: Number(event.payload.breacherInitialDistance),
        ruleId: "powerhouse.breacher.1",
        sourceDigest: "9e9680211a203830a82230d86136cc85108032eaea3655fc9e991129d2826af5",
      }],
      choices: () => [],
    }),
    eventTrigger({
      id: "powerhouse.martial-artist.1", label: "Мастер боевых искусств I: выбрать один из Восьми молотов", sourceDigest: "5f4610235181dbccff56d2a15b161412018f62becc35812b1e911232e4af4a36", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.execution?.rootActionId || event.id}:${actor.id}:hammers`,
      match: (actor, event, context) => {
        if (event.type !== "damage.apply" || event.actorId !== actor.id || event.payload?.attack !== true || event.payload?.hit === false || !context.scene || !event.execution?.rootActionId) return false;
        const actionId = event.payload?.sourceActionId, finish = actionReceipt(context.scene, actor.id, event.payload?.actionInstanceId || event.execution?.actionInstanceId || event.execution?.rootActionId);
        const attribute = String(finish?.payload?.attribute || "").toLowerCase();
        if (actionId !== ACTIONS.skirmish && !(actionId === ACTIONS.finish && ["body", "talent"].includes(attribute))) return false;
        return !usesWeaponTechnique(actor, { techniqueId: finish?.payload?.techniqueId, techniqueRuleId: finish?.payload?.techniqueRuleId, techniqueIds: finish?.payload?.techniqueIds });
      },
      operations: () => [],
      choices: (actor, event, context) => hammersChoices(actor, event, context, `${event.execution?.rootActionId || event.id}:${actor.id}:hammers`),
      choiceSet: true,
    }),
    eventTrigger({
      id: "powerhouse.martial-artist.2", label: "Мастер боевых искусств II: урон Состояния потока", sourceDigest: "ffab119dac241453faa82dab8e20523afa694f42b997a24d13fdf4b7f16e9e83", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:flow-state`,
      match: (actor, event, context) => event.type === "rule.used" && event.actorId === actor.id && /^powerhouse\.martial-artist\.1\./.test(String(event.payload?.ruleId || "")) && Boolean(context.scene),
      operations: () => [],
      choices: (actor, event, context) => {
        const targetIds = [...new Set([...actionTargetsThisTurn(context.scene, actor), ...(event.payload?.targetIds || []), event.payload?.targetId].filter(Boolean))];
        const targets = targetIds.map(id => context.scene.actors?.find(item => item.id === id)).filter(target => target && !target.knockedOut && target.team !== actor.team);
        const digest = "ffab119dac241453faa82dab8e20523afa694f42b997a24d13fdf4b7f16e9e83";
        return targets.flatMap(target => [
          { id: `body:${target.id}`, label: `Урон Телом (${target.name || target.id})`, operations: [{ kind: "usage", ruleId: "powerhouse.martial-artist.2.flow", scope: "rootAction", targetIds: [target.id], sourceDigest: digest }, { kind: "damage", targetId: target.id, sourceActorId: actor.id, amount: Math.ceil(Number(actor.attrs?.body || 0) / 2), fixedDamage: true, finalDamage: true, attack: true, sourceActionId: "powerhouse.martial-artist.2" }], context: { targetId: target.id, attribute: "body", eventId: event.id } },
          { id: `talent:${target.id}`, label: `Урон Талантом (${target.name || target.id})`, operations: [{ kind: "usage", ruleId: "powerhouse.martial-artist.2.flow", scope: "rootAction", targetIds: [target.id], sourceDigest: digest }, { kind: "damage", targetId: target.id, sourceActorId: actor.id, amount: Math.ceil(Number(actor.attrs?.talent || 0) / 2), fixedDamage: true, finalDamage: true, attack: true, sourceActionId: "powerhouse.martial-artist.2" }], context: { targetId: target.id, attribute: "talent", eventId: event.id } },
        ]);
      },
      choiceSet: true,
    }),
    eventTrigger({
      id: "vagabond.skirmisher.1", label: "Застрельщик I: Тычок после Шага", sourceDigest: "a14b57ddcf585e19b76a19e20b3ab1dc5190a59a5b044ed5df6d0bc2141a503e", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.execution?.rootActionId || event.id}:${actor.id}:sting`,
      match: (actor, event, context) => event.type === "actor.move" && event.actorId === actor.id && event.payload?.sourceActionId === ACTIONS.step && Number(event.payload?.distance || 0) > 0 && !ownerTurnRuleUsed(actor, context.scene, "vagabond.skirmisher.1.sting"),
      operations: () => [],
      choices: (actor, event, context) => {
        const endpoint = event.payload || actor;
        const target = (context.scene?.actors || []).find(item => item.id !== actor.id && item.team !== actor.team && !item.knockedOut && item.space === (endpoint.space || actor.space) && Math.abs(Number(item.x) - Number(endpoint.x)) + Math.abs(Number(item.y) - Number(endpoint.y)) === 1);
        if (!target) return [];
        return [{ id: `jab:${target.id}`, label: `Тычок (${target.name || target.id})`, operations: [{ kind: "usage", ruleId: "vagabond.skirmisher.1.sting", scope: "ownerTurn", targetIds: [target.id], actionId: ACTIONS.skirmish, sourceDigest: "a14b57ddcf585e19b76a19e20b3ab1dc5190a59a5b044ed5df6d0bc2141a503e" }, { kind: "derived-action", targetIds: [target.id], sourceActorId: actor.id, ruleId: "vagabond.skirmisher.1", sourceDigest: "a14b57ddcf585e19b76a19e20b3ab1dc5190a59a5b044ed5df6d0bc2141a503e" }], context: { targetId: target.id, eventId: event.id } }];
      },
    }),
    eventTrigger({
      id: "vagabond.skirmisher.2", label: "Застрельщик II: сместиться по прямой после Стычки", sourceDigest: "ea74421d17b94486eaedb08b78d461b42ac4eaba89e27430ed74ce015285adc7", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.execution?.rootActionId || event.id}:${actor.id}:shifting-blows`,
      match: (actor, event, context) => event.type === "attack.clear" && event.actorId === actor.id && (event.execution?.actionId === ACTIONS.skirmish || event.payload?.sourceActionId === ACTIONS.skirmish) && Boolean(event.execution?.rootActionId) && Boolean(context.scene),
      operations: () => [],
      choices: (actor, event) => [{ id: "shift", label: "Сместиться на 0–2 клетки по прямой", operations: [{ kind: "skirmisher-shift", targetId: actor.id, maximum: 2, sourceActionId: "vagabond.skirmisher.2", ruleId: "vagabond.skirmisher.2", sourceDigest: "ea74421d17b94486eaedb08b78d461b42ac4eaba89e27430ed74ce015285adc7" }], context: { destinationRequired: true, targetId: actor.id, maximum: 2, eventId: event.id } }],
    }),
    eventTrigger({
      id: "vagabond.skirmisher.3", label: "Застрельщик III: Тычок после смещения", sourceDigest: "4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.execution?.rootActionId || event.id}:${actor.id}:rebound`,
      match: (actor, event, context) => event.type === "actor.move" && event.actorId === actor.id && event.payload?.sourceActionId === "vagabond.skirmisher.2" && !usesWeaponTechnique(actor, event.payload) && Boolean(context.scene),
      operations: () => [],
      choices: (actor, event, context) => {
        const targets = (context.scene?.actors || []).filter(item => item.id !== actor.id && item.team !== actor.team && !item.knockedOut && item.space === actor.space && Math.abs(Number(item.x) - Number(actor.x)) + Math.abs(Number(item.y) - Number(actor.y)) === 1 && !actionTargetsThisTurn(context.scene, actor).includes(item.id));
        return targets.slice(0, 8).map(target => ({ id: `jab:${target.id}`, label: `Тычок (${target.name || target.id})`, operations: [{ kind: "derived-action", targetIds: [target.id], sourceActorId: actor.id, ruleId: "vagabond.skirmisher.3", sourceDigest: "4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61" }], context: { targetId: target.id, eventId: event.id } }));
      },
    }),
    eventTrigger({
      id: "powerhouse.dual-wielder.1", label: "Двойной боец I: Флёрри после Стычки", sourceDigest: "ab0e66e627e16c102f6cd8ec4a2cd62a4aac0a45d4bffc9e5197a3f9dd326b13", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.execution?.rootActionId || event.id}:${actor.id}:flurry`,
      match: (actor, event) => event.type === "attack.clear" && event.actorId === actor.id && event.payload?.actionId === ACTIONS.skirmish && event.payload?.targetIds?.length === 1 && Boolean(event.execution?.rootActionId),
      operations: () => [],
      choices: (actor, event) => ["body", "talent"].map(attribute => ({ id: `flurry:${attribute}`, label: `Флёрри (${attribute === "body" ? "Телом" : "Талантом"})`, operations: [{ kind: "usage", ruleId: "powerhouse.dual-wielder.1.flurry", scope: "rootAction", targetIds: [event.payload.targetIds[0]], actionId: ACTIONS.skirmish, sourceDigest: "ab0e66e627e16c102f6cd8ec4a2cd62a4aac0a45d4bffc9e5197a3f9dd326b13" }, { kind: "derived-action", targetIds: [event.payload.targetIds[0]], sourceActorId: actor.id, ruleId: "powerhouse.dual-wielder.1", sourceDigest: "ab0e66e627e16c102f6cd8ec4a2cd62a4aac0a45d4bffc9e5197a3f9dd326b13", damageAttribute: attribute }], context: { targetId: event.payload.targetIds[0], eventId: event.id, attribute } })),
    }),
    eventTrigger({
      id: "vagabond.opportunist.1", label: "Оппортунист I: Стычка после Атаки союзника", sourceDigest: "f0492855d27579faf8b5030f09909996a4248a7d2367d8b8805f3942ce0bd4e2", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:opportunist`,
      match: (actor, event, context) => event.type === "attack.clear" && event.actorId !== actor.id && event.payload?.targetIds?.length === 1 && context.scene?.actors?.some(item => item.id === event.actorId && item.team === actor.team) && context.scene?.actors?.some(item => item.id === event.payload.targetIds[0] && item.team !== actor.team && !item.knockedOut && item.space === actor.space && distance(actor, item) <= 1),
      operations: () => [],
      choices: (actor, event, context) => {
        const target = context.scene?.actors?.find(item => item.id === event.payload.targetIds[0]);
        return target && target.team !== actor.team && !target.knockedOut && target.space === actor.space && distance(actor, target) <= 1 ? [{ id: "skirmish", label: `Быстрая Стычка (${target.name || target.id})`, operations: [{ kind: "usage", ruleId: "vagabond.opportunist.1.pack-tactics", scope: "round", targetIds: [target.id], actionId: ACTIONS.skirmish, sourceDigest: "f0492855d27579faf8b5030f09909996a4248a7d2367d8b8805f3942ce0bd4e2" }, { kind: "derived-action", targetIds: [target.id], sourceActorId: actor.id, ruleId: "vagabond.opportunist.1", sourceDigest: "f0492855d27579faf8b5030f09909996a4248a7d2367d8b8805f3942ce0bd4e2" }], context: { targetId: target.id, eventId: event.id } }] : [];
      },
    }),
    eventTrigger({
      id: "bulwark.runic-retribution.1", label: "Молли: Ласка — Быстрое Заклинание по атакующему", sourceDigest: "4bf4aab119ae103e04dde891dc96daefe5cc02c06fcdd16308a24c09a07d3822", coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:lash`,
      match: (actor, event, context) => event.type === "damage.apply" && event.payload?.attack === true && event.payload?.hit !== false && event.payload?.targetId !== actor.id && event.actorId !== actor.id && context.scene?.actors?.some(item => item.id === event.payload?.targetId && item.team === actor.team && !item.knockedOut) && context.scene?.actors?.some(item => item.id === event.actorId && item.team !== actor.team && !item.knockedOut),
      operations: (actor, event) => [{ kind: "usage", ruleId: "bulwark.runic-retribution.1.lash", scope: "round", targetIds: [event.actorId], actionId: ACTIONS.spell, sourceDigest: "4bf4aab119ae103e04dde891dc96daefe5cc02c06fcdd16308a24c09a07d3822" }, { kind: "resource", targetId: actor.id, resource: "focus", operation: "spend", amount: 1, ruleId: "bulwark.runic-retribution.1", sourceDigest: "4bf4aab119ae103e04dde891dc96daefe5cc02c06fcdd16308a24c09a07d3822" }, { kind: "derived-action", targetIds: [event.actorId], sourceActorId: actor.id, ruleId: "bulwark.runic-retribution.1", sourceDigest: "4bf4aab119ae103e04dde891dc96daefe5cc02c06fcdd16308a24c09a07d3822" }],
      choices: () => [],
    }),
    eventTrigger({
      id: "powerhouse.technician.1",
      label: "Техник I: Разминка после Зарядки и ОД за завершённое комбо",
      sourceDigest: "79946bc3df6de994901a8519030345403e62c0fac627a76aaa8bc0ee45edda83",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:technician-stretch`,
      match: (actor, event, context) => event.type === "action.resolve" && event.actorId === actor.id && ((event.payload?.actionId === ACTIONS.charge && typeof event.payload?.actionInstanceId === "string" && Boolean(event.execution?.actionInstanceId || event.execution?.rootActionId)) || comboComplete(actor, context.scene, event) && stretchClockValue(actor, "powerhouse.technician.stretch") > 0),
      operations: (actor, event, context) => event.payload?.actionId === ACTIONS.charge ? [{
        kind: "clock",
        targetId: actor.id,
        id: "powerhouse.technician.stretch",
        operation: "configure",
        label: "Разминка",
        size: 1,
        max: 1,
        min: 0,
        current: 1,
        initial: 0,
        resetAt: "manual",
        lifetime: { boundary: "endNextOwnerTurn", ownerActorId: actor.id, ownerTurnSerial: Number(context.ownerTurnSerial ?? actor.lionwing?.ownerTurnSerial ?? 0), ownerTurnInstanceId: context.ownerTurnInstanceId || null, sceneSerial: Number(context.scene?.lionwing?.sceneSerial || 1) },
        ruleId: "powerhouse.technician.1",
        sourceDigest: "79946bc3df6de994901a8519030345403e62c0fac627a76aaa8bc0ee45edda83",
      }] : [{ kind: "resource", targetId: actor.id, resource: "ap", operation: "gain", amount: 1, ruleId: "powerhouse.technician.1", sourceDigest: "79946bc3df6de994901a8519030345403e62c0fac627a76aaa8bc0ee45edda83" }],
      choices: () => [],
    }),
    eventTrigger({
      id: "powerhouse.technician.2",
      label: "Техник II: Идеальная форма после завершённого комбо",
      sourceDigest: "87d635215f2088e683f229d48bc51b0f2bc34d6a88bc1dea707fcea12e4be250",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:technician-perfect-form`,
      match: (actor, event, context) => comboComplete(actor, context.scene, event),
      operations: actor => [{
        kind: "modifier",
        id: `powerhouse.technician.2:${actor.id}`,
        targetId: actor.id,
        ownerActorId: actor.id,
        stat: "armor",
        amount: Math.ceil(Number(actor.tier || 0) / 2),
        duration: "startTurn",
        ruleId: "powerhouse.technician.2",
        sourceDigest: "87d635215f2088e683f229d48bc51b0f2bc34d6a88bc1dea707fcea12e4be250",
      }],
      choices: () => [],
    }),
    eventTrigger({
      id: "vagabond.dim-mak.1",
      label: "Детектив I: удалить Слабую точку и выполнить фиксированный Джеб",
      sourceDigest: "86bc2801b43ae4f2bd3de697124313b986e9ae1081e0dd8f3f52dfc44b097c59",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:dim-mak-1`,
      operations: () => [],
      choices: (actor, event, context) => {
        const marker = (context.scene?.markers || []).find(item => item.ruleId === "vagabond.dim-mak.1" && item.ownerActorId === actor.id && item.space === actor.space && Number(item.x) === Number(actor.x) && Number(item.y) === Number(actor.y)), targetId = marker && (marker.hostActorId || marker.metadata?.hostActorId || marker.metadata?.carrierActorId);
        const target = targetId && (context.scene?.actors || []).find(item => item.id === targetId);
        return marker && target && !target.knockedOut ? [{ id: "jab", label: `Удалить точку и Джеб (${target.name})`, operations: [{ kind: "marker-remove", markerId: marker.id, targetId, sourceActorId: actor.id, ruleId: "vagabond.dim-mak.1", sourceActionId: "vagabond.dim-mak.1.jab" }, { kind: "derived-action", targetIds: [targetId], sourceActorId: actor.id, ruleId: "vagabond.dim-mak.1", sourceDigest: "86bc2801b43ae4f2bd3de697124313b986e9ae1081e0dd8f3f52dfc44b097c59", lineage: ["vagabond.dim-mak.1"] }], context: { targetId, markerId: marker.id, eventId: event.id } }] : [];
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
      followUp: (actor, event) => ({ id: `${event.id}:${actor.id}:rising-challenger-followup`, ownerActorId: actor.id, sourceActorId: actor.id, participantIds: [actor.id, event.payload?.targetId || actor.id], endBoundary: "anyTurnStart", cancelOn: ["damage", "knockout", "sourceLoss"], completionOperations: [] }),
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
      sourceDigest: SIREN_SOURCE_DIGESTS["disruptor.siren.2"],
      coverage: "partial",
      triggerKey: ({ actor, event, context }) => `${context.ownerTurnKey || event.id}:${actor.id}`,
      operations: () => [],
      choices: (actor, event, context) => {
        const targetId = event.payload?.targetId;
        return targetId ? [{
          id: "pull",
          label: "Притянуть до 3 клеток",
          operations: [{ kind: "forced-towards", targetId, sourceActorId: actor.id, maximum: 3, ruleId: "disruptor.siren.2", sourceDigest: SIREN_SOURCE_DIGESTS["disruptor.siren.2"], sourceActionId: "disruptor.siren.2", causeEventId: event.id, frightenedEventId: event.id }],
          context: { targetId, sourceActorId: actor.id, maximum: 3, eventId: event.id, frightenedEventId: event.id, sourceDigest: SIREN_SOURCE_DIGESTS["disruptor.siren.2"] },
        }] : [];
      },
      followUp: (actor, event) => event.payload?.targetId ? ({ id: `${event.id}:${actor.id}:siren-pull-followup`, ownerActorId: actor.id, sourceActorId: actor.id, participantIds: [actor.id, event.payload.targetId], endBoundary: "anyTurnStart", cancelOn: ["damage", "knockout", "sourceLoss"], completionOperations: [] }) : null,
    }),
    eventTrigger({
      id: "disruptor.siren.3",
      label: "Сирена III: после Духовного или Ментального Завершения подтянуть Испуганных врагов",
      sourceDigest: SIREN_SOURCE_DIGESTS["disruptor.siren.3"],
      coverage: "full",
      triggerKey: ({ actor, event }) => `${event.id}:${event.payload?.actionInstanceId || "missing"}:${actor.id}:siren-3`,
      operations: () => [],
      choices: (actor, event, context) => {
        const payload = event.payload || {}, actionInstanceId = payload.actionInstanceId;
        if (event.type !== "action.resolve" || event.actorId !== actor.id || !context.scene || context.scene.activeActorId !== actor.id || !actionInstanceId) return [];
        const targetIds = Array.isArray(payload.targetIds) ? payload.targetIds.filter(id => typeof id === "string") : [];
        if (targetIds.length !== 1) return [];
        const target = context.scene.actors?.find(item => item.id === targetIds[0]);
        const feared = (context.scene.actors || []).filter(item => item.team !== actor.team && !item.knockedOut && item.effects?.includes("negative.испуган"));
        if (!target || target.id === actor.id || target.knockedOut || target.space !== actor.space || !feared.length) return [];
        return [{
          id: "call-help",
          label: `Подтянуть всех Испуганных врагов к цели (${target.name}) и нанести урон рядом`,
          operations: [{ kind: "forced-towards-group", sourceActorId: actor.id, targetId: target.id, ruleId: "disruptor.siren.3", sourceDigest: SIREN_SOURCE_DIGESTS["disruptor.siren.3"], actionInstanceId, filter: { team: "opposing", effect: "negative.испуган" } }],
          context: { targetId: target.id, sourceActorId: actor.id, actionInstanceId, fearedActorIds: feared.map(item => item.id), eventId: event.id, sourceDigest: SIREN_SOURCE_DIGESTS["disruptor.siren.3"] },
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
      followUp: (actor, event) => event.payload?.targetId ? ({ id: `${event.id}:${actor.id}:chemist-health-followup`, ownerActorId: actor.id, sourceActorId: actor.id, participantIds: [actor.id, event.payload.targetId], endBoundary: "anyTurnStart", cancelOn: ["damage", "knockout", "sourceLoss"], completionOperations: [] }) : null,
    }),
    eventTrigger({
      id: "powerhouse.monastic-sage.2",
      label: "Монах-воин II: чередование Атаки и утилитарного Действия заполняет Баланс",
      sourceDigest: "68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60",
      coverage: "full",
      triggerKey: ({ actor, event, context }) => `${event.id}:${event.payload?.actionInstanceId || event.execution?.actionInstanceId || "action"}:${actor.id}:${context.ownerTurnKey || context.scene?.turnSerial || 0}:balance`,
      match: (actor, event, context) => {
        if (event.type !== "action.resolve" || event.actorId !== actor.id || !context.scene) return false;
        const actionId = event.payload?.actionId;
        // A raw action.resolve without trusted execution provenance is not an
        // authoritative action. This keeps a client supplied event/flag from
        // filling a rule clock.
        if (!(attackAction(actionId) || utilityAction(actionId)) || !event.execution?.rootActionId) return false;
        const history = turnHistory(actor, context.scene, event).filter(item => attackAction(item.actionId) || utilityAction(item.actionId));
        if (history.length < 2 || clockValue(actor, meditatedId) > 0) return false;
        const current = history.at(-1), previous = history.at(-2);
        return current?.actionId === actionId && attackAction(current.actionId) !== attackAction(previous.actionId);
      },
      operations: (actor, _event, context) => clockValue(actor, balanceId) < 8 && clockValue(actor, meditatedId) < 1
        ? [{ kind: "clock", targetId: actor.id, id: balanceId, operation: "add", delta: 1, ruleId: "powerhouse.monastic-sage.2", sourceDigest: "68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60" }]
        : [],
      choices: () => [],
      boundaryOperations: (actor, context) => {
        if (context?.boundary === "sceneStart") return [{ kind: "clock", targetId: actor.id, id: balanceId, operation: "create", label: "Баланс", size: 8, max: 8, min: 0, current: 0, initial: 0, resetAt: "scene", lifetime: "scene", ruleId: "powerhouse.monastic-sage.2", sourceDigest: "68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60" }];
        if (context?.boundary === "turnStart" && clockValue(actor, balanceId) > 0 && context.activeActor?.id === actor.id) return {
          operations: [],
          choices: [
            { id: "strengthen", label: "Потратить 1 Баланс: Усилиться", operations: [{ kind: "clock", targetId: actor.id, id: balanceId, operation: "add", delta: -1, ruleId: "powerhouse.monastic-sage.2", sourceDigest: "68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60" }, { kind: "effect", targetId: actor.id, effect: "positive.усилен", ruleId: "powerhouse.monastic-sage.2", sourceActionId: "powerhouse.monastic-sage.2" }], },
            { id: "hasten", label: "Потратить 1 Баланс: Ускориться", operations: [{ kind: "clock", targetId: actor.id, id: balanceId, operation: "add", delta: -1, ruleId: "powerhouse.monastic-sage.2", sourceDigest: "68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60" }, { kind: "effect", targetId: actor.id, effect: "positive.ускорен", ruleId: "powerhouse.monastic-sage.2", sourceActionId: "powerhouse.monastic-sage.2" }], },
          ],
        };
        return [];
      },
    }),
    eventTrigger({
      id: "powerhouse.monastic-sage.3",
      label: "Монах-воин III: после Зарядки можно Медитировать",
      sourceDigest: "b12c0e7f1d63dd1217d15f64aa7f2fcb7bbfa649761b476eb5e0840bc36ba994",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.id}:${event.payload?.actionInstanceId || event.execution?.actionInstanceId || "action"}:${actor.id}:meditate`,
      match: (actor, event, context) => event.type === "action.resolve" && event.actorId === actor.id && event.payload?.actionId === ACTIONS.charge && Boolean(event.execution?.rootActionId) && Boolean(context.scene),
      operations: () => [],
      choices: (actor, event, context) => {
        const filled = Math.max(0, Math.min(8, clockValue(actor, balanceId))), full = filled === 8;
        const sourceDigest = "b12c0e7f1d63dd1217d15f64aa7f2fcb7bbfa649761b476eb5e0840bc36ba994";
        const operations = [
          ...(filled ? [{ kind: "modifier", id: `${event.id}:monastic-meditate:evasion`, targetId: actor.id, stat: "evasion", amount: filled, duration: "manual", ruleId: "powerhouse.monastic-sage.3", sourceDigest }] : []),
          { kind: "clock", targetId: actor.id, id: balanceId, operation: "set", current: 0, ruleId: "powerhouse.monastic-sage.3", sourceDigest },
          ...(full ? [{ kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: Number(actor.tier || 1) + 1, ruleId: "powerhouse.monastic-sage.3", sourceDigest }] : []),
          ...(actor.ruleClocks?.[meditatedId] ? [{ kind: "clock", targetId: actor.id, id: meditatedId, operation: "set", current: 1, ruleId: "powerhouse.monastic-sage.3", sourceDigest }] : [{ kind: "clock", targetId: actor.id, id: meditatedId, operation: "create", label: "Медитация в этом Ходу", size: 1, max: 1, min: 0, current: 1, initial: 0, resetAt: "endTurn", lifetime: "scene", ruleId: "powerhouse.monastic-sage.3", sourceDigest }]),
        ];
        return [{ id: "meditate", label: `Медитировать: получить ${filled} Уклонения и очистить Баланс${full ? `; получить ${Number(actor.tier || 1) + 1} Фокуса` : ""}`, operations, context: { eventId: event.id, filled, full, sourceDigest, manualRemainder: "Teleport to any empty space and swift spirit or mind finisher on adjacent enemy require the manual Narrator path until an authoritative composed action is available." } }];
      },
      boundaryOperations: (actor, context) => context?.boundary === "sceneStart" && !actor.ruleClocks?.[meditatedId]
        ? [{ kind: "clock", targetId: actor.id, id: meditatedId, operation: "create", label: "Медитация в этом Ходу", size: 1, max: 1, min: 0, current: 0, initial: 0, resetAt: "endTurn", lifetime: "scene", ruleId: "powerhouse.monastic-sage.3", sourceDigest: "b12c0e7f1d63dd1217d15f64aa7f2fcb7bbfa649761b476eb5e0840bc36ba994" }]
        : [],
    }),
    eventTrigger({
      id: "vagabond.dim-mak.2",
      label: "Детектив II: после третьего Изучения замедлить всех Помеченных",
      sourceDigest: "d63edd4d649fb29805706009934a7eb38427b2507f32b1d5632e881f7e24a5a2",
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
    eventTrigger({
      id: "ruiner.grim-ascendant.2",
      label: "Мрачный вознёсшийся II: после Духовного Завершения начать Drain Life",
      sourceDigest: "f9768c5e588f5471e9e1e5b145e1b9ec0216d2fcba298f5c64364b027af2bf96",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.payload?.actionInstanceId || event.id}:${actor.id}:grim-2`,
      operations: () => [],
      choices: (actor, event, context) => {
        const payload = event.payload || {}, targetId = Array.isArray(payload.targetIds) && payload.targetIds.length === 1 ? payload.targetIds[0] : null;
        const target = targetId && context.scene?.actors?.find(item => item.id === targetId), transformed = actor.ruleState?.grimTransformed === true || actor.lionwing?.grimTransformed === true || actor.grimTransformed === true;
        if (!transformed || event.type !== "action.resolve" || payload.actionId !== "action.атаки.завершение" || String(payload.attribute || "spirit").toLowerCase() !== "spirit" || !target || target.team === actor.team || target.knockedOut) return [];
        const actionInstanceId = payload.actionInstanceId || event.execution?.actionInstanceId;
        if (typeof actionInstanceId !== "string") return [];
        const drainId = `${actor.id}:${actionInstanceId}:grim-drain`;
        return [{
          id: "drain",
          label: `Начать Drain Life на ${target.name}`,
          operations: [
            { kind: "effect", targetId: actor.id, sourceActorId: actor.id, sourceId: drainId, ownerActorId: actor.id, duration: "scene", effect: "negative.обездвижен", ruleId: "ruiner.grim-ascendant.2", sourceActionId: "ruiner.grim-ascendant.2" },
            { kind: "effect", targetId: target.id, sourceActorId: actor.id, sourceId: drainId, ownerActorId: target.id, duration: "scene", effect: "negative.обездвижен", ruleId: "ruiner.grim-ascendant.2", sourceActionId: "ruiner.grim-ascendant.2" },
          ],
          context: { targetId: target.id, sourceActorId: actor.id, drainId, actionInstanceId },
        }];
      },
      followUp: (actor, event, context) => {
        const payload = event.payload || {}, targetId = Array.isArray(payload.targetIds) && payload.targetIds.length === 1 ? payload.targetIds[0] : null;
        const target = targetId && context.scene?.actors?.find(item => item.id === targetId), actionInstanceId = payload.actionInstanceId || event.execution?.actionInstanceId;
        if (!target || !actionInstanceId) return null;
        const drainId = `${actor.id}:${actionInstanceId}:grim-drain`;
        return { id: drainId, ownerActorId: actor.id, sourceActorId: actor.id, participantIds: [actor.id, target.id], endBoundary: "anyTurnStart", cancelOn: ["damage", "knockout", "sourceLoss"], completionOperations: [{ kind: "resource", targetId: actor.id, resource: "focus", operation: "gain", amount: Number(actor.attrs?.spirit || 0), ruleId: "ruiner.grim-ascendant.2" }, { kind: "effect-source", targetId: actor.id, sourceId: drainId, operation: "remove", effect: "negative.обездвижен", ruleId: "ruiner.grim-ascendant.2" }, { kind: "effect-source", targetId: target.id, sourceId: drainId, operation: "remove", effect: "negative.обездвижен", ruleId: "ruiner.grim-ascendant.2" }] };
      },
    }),
    eventTrigger({
      id: "ruiner.cryomancer.3",
      label: "Раскол: раскрыть приватное Здоровье Обездвиженной цели и проверить нокаут",
      sourceDigest: "0e00f6cef0e67d2cb07a99ada1557193abfd5f1932f170c733a063839a5200eb",
      coverage: "partial",
      triggerKey: ({ actor, event }) => `${event.payload?.actionInstanceId || event.execution?.actionInstanceId || event.id}:${actor.id}:shatter`,
      match: (actor, event, context) => {
        const payload = event.payload || {}, targetId = Array.isArray(payload.targetIds) && payload.targetIds.length === 1 ? payload.targetIds[0] : null;
        const target = targetId && context.scene?.actors?.find(item => item.id === targetId);
        return event.type === "action.resolve" && event.actorId === actor.id && payload.actionId === ACTIONS.finish && typeof (payload.actionInstanceId || event.execution?.actionInstanceId) === "string" && target && target.team !== actor.team && !target.knockedOut && Boolean(target.effects?.includes("negative.обездвижен") || target.effectStates?.["negative.обездвижен"]);
      },
      operations: (actor, event) => [{ kind: "shatter-check", targetId: event.payload.targetIds[0], sourceActorId: actor.id, actionEventId: event.id, ruleId: "ruiner.cryomancer.3", sourceDigest: "0e00f6cef0e67d2cb07a99ada1557193abfd5f1932f170c733a063839a5200eb" }],
      choices: () => [],
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
    passive({
      id: "disruptor.siren.1",
      label: "Сирена I: +3 Фокуса в начале Сцены и Fear после Изучения",
      sourceDigest: SIREN_SOURCE_DIGESTS["disruptor.siren.1"],
      coverage: "partial",
      boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? sceneFocus(3)(actor) : [],
      triggerKey: ({ actor, event }) => `${event.id}:${actor.id}:siren-1-study`,
      match: (actor, event, context) => {
        const payload = event.payload || {}, targetId = Array.isArray(payload.targetIds) && payload.targetIds.length === 1 ? payload.targetIds[0] : null;
        const target = targetId && context.scene?.actors?.find(item => item.id === targetId);
        return event.type === "action.resolve" && event.actorId === actor.id && context.scene?.activeActorId === actor.id
          && payload.actionId === ACTIONS.study && typeof payload.actionInstanceId === "string" && Boolean(event.execution?.actionInstanceId || event.execution?.rootActionId)
          && target && !target.knockedOut && target.team !== actor.team && target.space === actor.space;
      },
      operations: () => [],
      choices: (actor, event, context) => {
        const payload = event.payload || {}, targetId = Array.isArray(payload.targetIds) && payload.targetIds.length === 1 ? payload.targetIds[0] : null;
        const target = targetId && context.scene?.actors?.find(item => item.id === targetId);
        if (!target || target.knockedOut || target.team === actor.team || target.space !== actor.space) return [];
        const ruleId = "disruptor.siren.1", sourceDigest = SIREN_SOURCE_DIGESTS[ruleId];
        return [{
          id: "fear",
          label: `Потратить 1 Фокус и наложить Испуган на ${target.name || target.id}`,
          operations: [
            { kind: "resource", targetId: actor.id, sourceActorId: actor.id, resource: "focus", operation: "spend", amount: 1, actionId: ACTIONS.study, sourceActionId: ACTIONS.study, ruleId, sourceDigest, causeEventId: event.id, studyTargetId: target.id },
            { kind: "effect", targetId: target.id, sourceActorId: actor.id, effect: "negative.испуган", sourceActionId: ACTIONS.study, ruleId, sourceDigest, causeEventId: event.id, studyTargetId: target.id },
          ],
          context: { targetId: target.id, sourceActorId: actor.id, studyEventId: event.id, eventId: event.id, sourceDigest },
        }];
      },
    }),
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
      id: "bulwark.iron-bodied.3",
      label: "Железное тело III: предел итогового урона 4 + [Ранг/2] в Обездвиженности",
      sourceDigest: "7726f5c94cfdfba228b739db1cad6221687af83bf183a7c16bed34afd5a6526f",
      coverage: "partial",
      numeric: (actor, context) => {
        if (context?.key !== "finalDamage" || context.kind !== "damage" || context.targetId !== actor.id) return [];
        const immobilized = actor.effects?.includes("negative.обездвижен") || actor.effectStates?.["negative.обездвижен"]?.present === true;
        if (!immobilized) return [];
        const tier = Number(actor.tier || 0);
        return Number.isFinite(tier) && tier >= 0 ? { operation: "max", amount: 4 + Math.ceil(tier / 2), reason: "Обездвиженное Железное тело ограничивает итоговый урон." } : [];
      },
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
      id: "powerhouse.braggart.1",
      label: "Гордыня I: +1 Преимущество на заполненных часах Гордыни",
      sourceDigest: "27b8843e65beccd8722b61b6ecba36261f77a23c31119b7fae82f4785937ab77",
      coverage: "partial",
      // The clock is created and filled by the engine foundation.  This
      // adapter only reads its persisted value, so a payload flag cannot
      // manufacture the all-roll bonus.
      rollBonus: (actor, context) => {
        if (!context || !["attack", "clash", "roll"].includes(context.kind)) return 0;
        const owner = context.scene?.actors?.find(item => item.id === actor.id) || actor;
        const clock = owner.ruleClocks?.["powerhouse.braggart.pride"], current = clockValue(owner, "powerhouse.braggart.pride");
        const maximum = Number(clock?.max ?? clock?.size ?? 6);
        return maximum > 0 && Number.isSafeInteger(current) && current >= maximum ? 1 : 0;
      },
    }),
    passive({
      id: "powerhouse.duelist.2",
      label: "Дуэлянт II: Блок получает +Напряжение Брони",
      sourceDigest: "6ac5d7c737f81f4ba33f9a649d3bdfae9c2627d6420540f72f9626c53efb0827",
      coverage: "partial",
      // The response is held on the pending Attack until resolution.  It is
      // therefore temporary Armor, rather than a mutation of the actor's
      // persisted Armor stat.
      numeric: (_actor, context) => context?.key === "blockArmor" && context.kind === "block" && context.scene
        ? { operation: "add", amount: Math.max(0, sceneTension(context.scene)), reason: "Блок получает текущее Напряжение дополнительной Бронёй." }
        : [],
    }),
    passive({
      id: "vagabond.drunkard.2",
      label: "Пьяница II: после замедленного Хода получить Уклонение",
      sourceDigest: "73477795efb4e90b3c7bf8d17ed305b312f08703a0085672f72b5e0a869dde56",
      coverage: "partial",
      // This is a bounded lifecycle grant. It is deliberately emitted as a
      // start-of-next-Turn modifier, so it can be spent by the normal damage
      // pipeline and cannot become a permanent actor stat.
      boundaryOperations: (actor, context) => {
        if (context?.canonicalBoundary !== "ownTurnEnd" || context.activeActor?.id !== actor.id || !context.activeEffectIds?.includes("negative.замедлен")) return [];
        const negativeEffects = context.activeEffectIds.filter(effect => String(effect).startsWith("negative.")).length;
        const amount = Math.ceil(Number(actor.tier || 0) / 2) + negativeEffects;
        return amount > 0 ? [{ kind: "modifier", id: `vagabond.drunkard.2:${actor.id}:${context.boundaryKey}`, targetId: actor.id, stat: "evasion", amount, duration: "startTurn", ruleId: "vagabond.drunkard.2", sourceDigest: "73477795efb4e90b3c7bf8d17ed305b312f08703a0085672f72b5e0a869dde56", coverage: "partial", label: "Пьяница II: временное Уклонение", reason: "Уклонение на начало следующего собственного Хода от Пьяницы II." }] : [];
      },
    }),
    passive({
      id: "vagabond.aerial-master.3",
      label: "Воздушный мастер III: в Полёте Атака может использовать Скорость",
      sourceDigest: "af9100fcba37294038c9e66fb6fd2aed9fb592bd0468468ebcce546b087bf3ac",
      coverage: "partial",
      numeric: (actor, context) => {
        if (context?.key !== "attackPool" || context.kind !== "attack" || context.useSpeedAttribute !== true || !attackIds.has(context.actionId)) return [];
        const inFlight = actor.effects?.includes("positive.полёт") || actor.lionwing?.stance === "flight";
        if (!inFlight) return [];
        const speedValue = Number(context.speedValue ?? actor.speed);
        return Number.isFinite(speedValue) && speedValue >= 0
          ? { operation: "replace", amount: speedValue, reason: "Атака в Полёте использует Скорость по выбору игрока." }
          : [];
      },
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
    passive({ id: "disruptor.street-fighter.2", label: "Уличный боец II: Преимущество по числу Эффектов ошеломлённой цели (пассивная часть)", sourceDigest: "d2a047b0ae8184c4e9d98adedde7f5fe1a5db592efef26ab16556a230284a0a8", coverage: "partial", rollBonus: (actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.стычка" && context.targetEffectIds?.includes("negative.ошеломлен") && !usesWeaponTechnique(actor, context) ? context.targetEffectIds.length : 0 }),
    passive({ id: "powerhouse.gunslinger.2", label: "Стрелок II: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "6559e6a6b597f579ef43c6b7b20e4a6d92659d2b41de8338239a7059df0694ea", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "powerhouse.martial-artist.3", label: "Мастер боевых искусств III: +1 Преимущество к Атакам (пассивная часть)", sourceDigest: "8428fb10aec3237aa82ef24d052a5610a5f9701fa3576d9be06b9219dc23176c", coverage: "partial", rollBonus: (actor, context) => context?.kind === "attack" && attackIds.has(context.actionId) && !usesWeaponTechnique(actor, context) ? 1 : 0 }),
    passive({
      id: "powerhouse.lancer.1",
      label: "Копейщик I: дальность Стычки и Завершения Телом не ниже 2",
      sourceDigest: "8591643bda0a61a4165679413af42b8b60a40ca90dc47dc5a9d6ee1c32a5e701",
      coverage: "partial",
      rollBonus: (_actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.стычка" ? Math.min(3, Math.max(0, Number(context.targetDistance || 0))) : 0,
      numeric: (_actor, context) => context?.key === "range" && context.kind === "attack" && (context.actionId === ACTIONS.skirmish || context.actionId === ACTIONS.finish && context.attribute === "body")
        ? { operation: "min", amount: 2, reason: "Копейщик I расширяет обычную дальность до 2." }
        : [],
    }),
    passive({
      id: "powerhouse.lancer.2",
      label: "Копейщик II: дальность Стычки и Завершения Телом не ниже 3",
      sourceDigest: "bbc32f09a04b64473f2a4eaacdb4686a3827af112fa7b2737d5117fcc1975c1b",
      coverage: "partial",
      numeric: (_actor, context) => context?.key === "range" && context.kind === "attack" && (context.actionId === ACTIONS.skirmish || context.actionId === ACTIONS.finish && context.attribute === "body")
        ? { operation: "min", amount: 3, reason: "Копейщик II расширяет обычную дальность до 3." }
        : [],
    }),
    passive({
      id: "powerhouse.lancer.3",
      label: "Копейщик III: дальность Стычки не ниже 4",
      sourceDigest: "cf89959221bf368de82bf3bc9e6c4e2d64fd30d5b33a5095e355a6aa93aab5c0",
      coverage: "partial",
      rollBonus: (actor, context) => {
        if (context?.kind !== "attack" || context.actionId !== ACTIONS.skirmish || !context.scene || !immediateAction(actor, context.scene, ACTIONS.breathe)) return 0;
        const distance = Math.max(0, Number(context.targetDistance || 0));
        return Math.max(0, Math.min(4, distance) - Math.min(3, distance));
      },
      numeric: (actor, context) => context?.key === "range" && context.kind === "attack" && context.actionId === ACTIONS.skirmish && immediateAction(actor, context.scene, ACTIONS.breathe)
        ? { operation: "min", amount: 4, reason: "Копейщик III расширяет дальность Стычки после авторитетной Передышки до 4." }
        : [],
    }),
    passive({ id: "ruiner.feral-arcana.3", label: "Дикий арканист III: +1 Преимущество к Заклинаниям (пассивная часть)", sourceDigest: "9f6cfdd94da5ecb8aae12c24b3602fc117b2890191d51dabd3eb6d89a3b83df3", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание") }),
    passive({ id: "ruiner.flame-heart.3", label: "Пламенное сердце III: +1 Преимущество к Заклинаниям и дальность Духовного Завершения 5 (пассивная часть)", sourceDigest: "4896f18d23e7ba4de201859ecfb76d46c7049c32e532747831b973b2d75c6d29", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание"), numeric: (_actor, context) => context?.key === "range" && context.kind === "attack" && context.actionId === ACTIONS.finish && context.attribute === "spirit" ? { operation: "min", amount: 5, reason: "Пламенное сердце III даёт Духовному Завершению дальность 5." } : [] }),
    passive({ id: "ruiner.flame-heart.2", label: "Пламенное сердце II: +[Напряжение] Преимущества к магической Атаке в Порче (пассивная часть)", sourceDigest: "2259304d1ba4a37ae5e0850fa66ffcba7b9b70b1ce544d02f97fcbd6472809c2", coverage: "partial", rollBonus: (_actor, context) => context?.kind === "attack" && context.sourceEffectIds?.includes("negative.порчен") && (context.actionId === "action.атаки.заклинание" || context.actionId === "action.атаки.завершение" && context.attribute === "spirit") ? Number(context.tension || 0) : 0 }),
    passive({ id: "ruiner.cryomancer.2", label: "Ледяной покров II: +1 Преимущество к Заклинаниям и Сосулька", sourceDigest: "32667d8918127c1729dc39430bde0375999651854e06e8cd599d91b7fcd14f30", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание"), boundaryOperations: (actor, context) => context?.boundary === "sceneStart" ? clockConfiguration(actor, "ruiner.cryomancer.icicle", "Сосулька", 4, { ruleId: "ruiner.cryomancer.2" }) : [] }),
    passive({ id: "ruiner.sellsword-s-call.1", label: "Зов мечника I: +2 Преимущества к Заклинаниям (пассивная часть)", sourceDigest: "712c5d75aebe965eb606cb4b930e141138c87dd24cb14804cd367a1904d5c283", coverage: "partial", rollBonus: actionBonus("action.атаки.заклинание", 2) }),
    passive({ id: "vagabond.skirmisher.3", label: "Застрельщик III: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "vagabond.knife-juggler.2", label: "Жонглёр ножами II: +1 Преимущество к Стычкам (пассивная часть)", sourceDigest: "4da1a911cf7ed1eb5a90e3c4aed8abbb87087a567f7ab38406c11d1130c6c54a", coverage: "partial", rollBonus: actionBonus("action.атаки.стычка") }),
    passive({ id: "vagabond.assassin.2", label: "Убийца II: +[Ранг] Преимущества к Атакам из Исчезновения (пассивная часть)", sourceDigest: "6e95fe2767088e069f995f384a6e03856f26d428161dbd57efca1c03a5eda98f", coverage: "partial", rollBonus: (actor, context) => context?.kind === "attack" && attackIds.has(context.actionId) && context.sourceEffectIds?.includes("positive.исчез") ? Number(actor.tier || 1) : 0 }),
    passive({ id: "vagabond.assassin.3", label: "Ассасин III: после Скрыться → Шаг следующий Завершающий удар получает [Скорость/2] Преимуществ", sourceDigest: "0a28c9c9cc800d859e9f2352923ece0aa23754cc12541124234b16400378c1c1", coverage: "full", rollBonus: (actor, context) => {
      if (context?.kind !== "attack" || context.actionId !== "action.атаки.завершение" || !context.scene) return 0;
      const serial = Number(context.scene.turnSerial), instance = context.scene.lionwing?.activeTurnInstanceId || null;
      const used = eventHistory(actor, context.scene).some(item => item.actionId === ACTIONS.step && item.ruleId === "vagabond.assassin.3" && (instance && item.ownerTurnInstanceId === instance || !instance && Number(item.turnSerial) === serial));
      return used ? Math.ceil(Number(actor.speed || 0) / 2) : 0;
    } }),
    passive({
      id: "vagabond.acrobat.1",
      label: "Акробат I: Преимущество Стычки за клетки этого Прыжка (пассивная часть)",
      sourceDigest: "c32ea3ffcffce0dad6125825610e62362b8a123a707aefbd6e5198a4e4aa80ae",
      coverage: "partial",
      rollBonus: (actor, context) => context?.kind === "attack" && context.actionId === "action.атаки.стычка" && context.targetIds?.length === 1 && Number(context.targetDistance) === 1 && Number.isFinite(Number(context.jumpDistance)) ? Math.min(Number(actor.attrs?.talent || 0), Math.max(0, Number(context.jumpDistance))) : 0,
    }),
    passive({
      id: "vagabond.sniper.1",
      label: "Снайпер I: Завершение Талантом получает дальность 5",
      sourceDigest: "a84de0a68e37fcfc0bd9e9f2b31d19f5f09d686294b82e40138d26e0ed6ba8e8",
      coverage: "partial",
      numeric: (_actor, context) => context?.key === "range" && context.kind === "attack" && context.actionId === ACTIONS.finish && context.attribute === "talent"
        ? { operation: "min", amount: 5, reason: "Снайпер I расширяет дальность Завершения Талантом до 5." }
        : [],
    }),
    passive({
      id: "vagabond.sniper.2",
      label: "Снайпер II: в Обездвиженности ещё +5 дальности Завершения Талантом",
      sourceDigest: "e154b6164f886770be2bb7a63a6a86bd7be83a88967eecaeb1f801b631874767",
      coverage: "partial",
      numeric: (actor, context) => {
        if (context?.key !== "range" || context.kind !== "attack" || context.actionId !== ACTIONS.finish || context.attribute !== "talent") return [];
        const owner = context.scene?.actors?.find(item => item.id === actor.id) || actor;
        const activeEffects = Array.isArray(context.activeEffectIds) ? context.activeEffectIds : owner?.effects;
        return activeEffects?.includes("negative.обездвижен")
          ? { operation: "add", amount: 5, reason: "Снайпер II даёт Обездвиженному Завершению Талантом ещё 5 дальности." }
          : [];
      },
    }),
    passive({
      id: "vagabond.untouchable.1",
      label: "Неуловимый I: первый Уворот Раунда получает +Талант Уклонения",
      sourceDigest: "348244d9362ed86da47559403a2fd0f22afb93a9647db589007e8ff203c8a26a",
      coverage: "partial",
      numeric: (actor, context) => {
        if (context?.key !== "dodgeEvasion" || context.kind !== "dodge" || !context.scene) return [];
        const owner = context.scene.actors?.find(item => item.id === actor.id) || actor;
        const round = Number(context.scene.round || 0), last = Number(owner.lionwing?.lastDodgeRound);
        const logged = (context.scene.log || []).some(row => row?.type === "reaction.respond" && row.actorId === actor.id && row.payload?.choice === "dodge" && Number(row.payload?.round) === round);
        return Number.isSafeInteger(round) && round >= 0 && last !== round && !logged
          ? { operation: "add", amount: Math.max(0, Number(owner.attrs?.talent || 0)), reason: "Первый Уворот этого Раунда получает дополнительное Уклонение от Таланта." }
          : [];
      },
    }),
    passive({
      id: "vagabond.untouchable.2",
      label: "Неуловимый II: Уворот перемещается на 1 клетку дальше",
      sourceDigest: "abd33cfc8f9dfb48eaf90234e99044a1f3c16d2d99d527286e6dd14c52d7433e",
      coverage: "partial",
      numeric: (_actor, context) => context?.key === "dodgeMove" && context.kind === "dodge"
        ? { operation: "add", amount: 1, reason: "Неуловимый II увеличивает дальность перемещения Уворота на 1." }
        : [],
    }),
    passive({
      id: "altruist.heavenly-saint.3",
      label: "Небесный святой III: Духовное Завершение получает дальность 5",
      sourceDigest: "5f42cdf622ce588debfafa058a85655946db0c400a1e925653fec9b6d0568e51",
      coverage: "partial",
      numeric: (_actor, context) => context?.key === "range" && context.kind === "attack" && context.actionId === ACTIONS.finish && context.attribute === "spirit"
        ? { operation: "min", amount: 5, reason: "Небесный святой III расширяет дальность Духовного Завершения до 5." }
        : [],
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
      coverage: "partial",
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
      id: "powerhouse.breacher.2", techniqueId: "powerhouse.breacher", level: 2,
      sourceDigest: "d632e668fdf4e39e44c32cc7c36973f9272fcb04d36a611ebfe7c55be96c565c",
      label: "Картечь II: режим «Из обоих стволов»",
      available: actor => knows(actor, "powerhouse.breacher", 2),
      modify: (actor, context) => {
        if (context.request?.breacherBothBarrels !== true) return null;
        const allowed = context.actionId === ACTIONS.skirmish || context.actionId === ACTIONS.finish && context.attribute === "body" && knows(actor, "powerhouse.breacher", 3);
        return allowed ? { attackBonus: Math.ceil(Number(actor.attrs?.body || 0) / 2), reason: "Из обоих стволов добавляет Преимущество и удваивает толчок." } : null;
      },
    }),
    actionModifier({
      id: "powerhouse.breacher.3", techniqueId: "powerhouse.breacher", level: 3,
      sourceDigest: "ddb18671a7bf29177c52af4b26a5bc35b6408dd125d75007abd25e547f2ac6b3",
      label: "Картечь III: дальнее Завершение Телом и зона 2×2",
      available: actor => knows(actor, "powerhouse.breacher", 3),
      modify: (actor, context) => context.actionId === ACTIONS.finish && context.attribute === "body" ? { range: 3, reason: "Завершение Телом получает дальность 3." } : null,
    }),
    actionModifier({
      id: "vagabond.dim-mak.1", techniqueId: "vagabond.dim-mak", level: 1,
      sourceDigest: "86bc2801b43ae4f2bd3de697124313b986e9ae1081e0dd8f3f52dfc44b097c59",
      label: "Детектив I: повторное Изучение той же цели Быстрое",
      available: actor => knows(actor, "vagabond.dim-mak", 1),
      modify: (actor, context) => {
        if (context.actionId !== ACTIONS.study) return null;
        const targetId = Array.isArray(context.targetIds) && context.targetIds.length === 1 ? context.targetIds[0] : null;
        if (!targetId) return null;
        const serial = Number(context.scene?.turnSerial), instance = context.scene?.lionwing?.activeTurnInstanceId || null;
        const studies = studyHistory(actor, context.scene).filter(item => item.actionId === ACTIONS.study && (instance && item.ownerTurnInstanceId === instance || Number(item.turnSerial) === serial));
        const sameTarget = studies.filter(item => (item.targetIds || [item.targetId]).includes(targetId));
        if (!sameTarget.length) return null;
        return { swift: true, reason: "Повторное Изучение той же цели Быстрое." };
      },
    }),
    actionModifier({
      id: "ruiner.student-of-stars.1", techniqueId: "ruiner.student-of-stars", level: 1,
      sourceDigest: "64d7fc6b8ff19f2f7ab1b9b12c8021872835baf6374bb729837f7d2f2a27fa60",
      label: "Ученик звёзд I: Высвобожденная мощь после Зарядки",
      available: actor => knows(actor, "ruiner.student-of-stars", 1),
      modify: (actor, context) => {
        if (!studentPowerUnleashed(actor, context.scene, context)) return null;
        return { cost: 1, costMode: "replace", studentPowerUnleashed: true, focusCap: sceneTension(context.scene), reason: "Высвобожденная мощь: Завершение после Зарядки стоит 1 ОД и может вложить до 3×Напряжения Фокуса." };
      },
    }),
    actionModifier({
      id: "vagabond.dim-mak.2", techniqueId: "vagabond.dim-mak", level: 2,
      sourceDigest: "d63edd4d649fb29805706009934a7eb38427b2507f32b1d5632e881f7e24a5a2",
      label: "Детектив II: третье Изучение бесплатно и замедляет Помеченных",
      available: actor => knows(actor, "vagabond.dim-mak", 2),
      modify: (actor, context) => {
        if (context.actionId !== ACTIONS.study || !Array.isArray(context.targetIds) || context.targetIds.length !== 1) return null;
        const serial = Number(context.scene?.turnSerial), instance = context.scene?.lionwing?.activeTurnInstanceId || null;
        const studies = studyHistory(actor, context.scene).filter(item => item.actionId === ACTIONS.study && (instance && item.ownerTurnInstanceId === instance || !instance && Number(item.turnSerial) === serial));
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
      id: "vagabond.assassin.3", techniqueId: "vagabond.assassin", level: 3, coverage: "full",
      sourceDigest: "0a28c9c9cc800d859e9f2352923ece0aa23754cc12541124234b16400378c1c1",
      label: "Ассасин III: следующий Шаг после Hide бесплатен и даёт Невидим",
      available: actor => knows(actor, "vagabond.assassin", 3),
      modify: (actor, context) => {
        if (context.actionId !== ACTIONS.step || !context.scene) return null;
        const serial = Number(context.scene.turnSerial), instance = context.scene.lionwing?.activeTurnInstanceId || null;
        const history = eventHistory(actor, context.scene);
        const sameTurn = item => instance && item.ownerTurnInstanceId === instance || !instance && Number(item.turnSerial) === serial;
        const hideUsed = history.some(item => item.actionId === ACTIONS.hide && sameTurn(item));
        return hideUsed && context.scene.actors?.find(item => item.id === actor.id)?.effects?.includes("positive.исчез")
          ? { cost: 0, costMode: "replace", swift: true, assassinStride: true, reason: "Шаг сразу после Hide Ассасина бесплатен и даёт Невидим." } : null;
      },
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
    actionModifier({
      id: "ruiner.cryomancer.3", techniqueId: "ruiner.cryomancer", level: 3,
      sourceDigest: "0e00f6cef0e67d2cb07a99ada1557193abfd5f1932f170c733a063839a5200eb",
      label: "Раскол: дальность Духовного Завершения 5",
      available: actor => knows(actor, "ruiner.cryomancer", 3),
      modify: (_actor, context) => context.actionId === ACTIONS.finish && context.attribute === "spirit" ? { range: 5, reason: "Раскол расширяет дальность Духовного Завершения до 5." } : null,
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
      if (patch.attackBonus != null) {
        const amount = Number(patch.attackBonus);
        if (!Number.isSafeInteger(amount) || amount < 0 || amount > 9999) return { ok: false, reason: "Модификатор действия вернул недопустимое Преимущество." };
        quote.attackBonus = (quote.attackBonus || 0) + amount;
      }
      quote.modifiers.push({ id: rule.id, techniqueId: rule.techniqueId, level: rule.level, sourceDigest: rule.sourceDigest, coverage: rule.coverage, reason: patch.reason || rule.label });
      if (patch.reason) quote.reasons.push(patch.reason);
      if (patch.studentPowerUnleashed === true) quote.studentPowerUnleashed = true;
      if (patch.focusCap != null) {
        const cap = Number(patch.focusCap);
        if (!Number.isSafeInteger(cap) || cap < 0) return { ok: false, reason: "Модификатор действия вернул недопустимый предел Фокуса." };
        quote.focusCap = Math.max(Number(quote.focusCap ?? 0), cap * 3);
      }
    }
    const informationPatch = global.DAWN_LIONWING_INFORMATION_QUERY?.actionQuote?.(actor, context);
    if (informationPatch?.ok === false) return informationPatch;
    if (informationPatch) {
      if (informationPatch.cost != null) {
        const cost = Number(informationPatch.cost);
        if (!Number.isSafeInteger(cost) || cost < 0 || cost > 9999) return { ok: false, reason: "Модификатор Изучения вернул недопустимую цену." };
        replacements.set(informationPatch.modifierIds?.[0] || "information-query", cost);
      }
      if (informationPatch.swift === true) quote.swift = true;
      if (informationPatch.range != null) quote.range = Number(informationPatch.range);
      if (informationPatch.informationCategories) quote.informationCategories = [...informationPatch.informationCategories];
      quote.modifiers.push(...(informationPatch.modifiers || []));
      if (informationPatch.reason) quote.reasons.push(informationPatch.reason);
    }
    const distinctCosts = [...new Set(replacements.values())];
    if (distinctCosts.length > 1) return { ok: false, reason: `Конфликт замен цены: ${[...replacements.keys()].join(", ")}.` };
    if (distinctCosts.length === 1) quote.cost = distinctCosts[0];
    quote.ignoreRequirements = [...new Set(quote.ignoreRequirements)];
    const costComposition = numericQuote(actor, { ...context, key: "actionCost", baseValue: quote.cost, roundUp: true });
    if (costComposition.ok === false) return costComposition;
    quote.cost = costComposition.value;
    quote.costQuote = costComposition;
    return { ok: true, ...quote, modifierIds: quote.modifiers.map(item => item.id), reason: quote.reasons.join(" ") };
  };
  // Duel entry is a separate quote because it can consume a resource before
  // the participants leave the board.  The quote is read-only: the engine
  // snapshots it, asks the owner for the optional choice, and only then
  // performs the payment and creates the Duel.  Focus and the Inner World
  // owner are read from the actor/scene, never from request fields.
  const duelEntryQuote = (actor, context = {}) => {
    const quote = {
      ok: true,
      focusAtEntry: Math.max(0, Number(actor?.focus || 0)),
      advantage: 0,
      modifiers: [],
      options: [],
      reasons: [],
    };
    if (context.actionId !== ACTIONS.duel) return quote;
    const add = (id, techniqueId, level, sourceDigest, reason, extra = {}) => {
      quote.modifiers.push({ id, techniqueId, level, sourceDigest, coverage: "partial", reason, ...extra });
      quote.reasons.push(reason);
    };
    const currentSpace = (context.scene?.spaces || []).find(space => space.id === actor?.space);
    if (knows(actor, "disruptor.inner-world", 3) && actor?.lionwing?.automation?.["disruptor.inner-world.3"] === true && currentSpace?.ownerActorId === actor.id) {
      const amount = Math.max(0, Number(actor.tier || 1));
      quote.advantage += amount;
      add("disruptor.inner-world.3", "disruptor.inner-world", 3, "fb44b773e2eb1b59c5691f7f5f6b9a2b624f2b9d3cdcffe70ee98cd46a597dff", `Родная территория: +${amount} Преимущества в Дуэли.` , { amount });
    }
    if (knows(actor, "ruiner.student-of-stars", 3) && actor?.lionwing?.automation?.["ruiner.student-of-stars.3"] === true && quote.focusAtEntry >= 6) {
      const amount = Math.ceil(quote.focusAtEntry / 2);
      quote.options.push("moment-of-truth");
      quote.studentOfStars = { focus: quote.focusAtEntry, advantage: amount, ruleId: "ruiner.student-of-stars.3", sourceDigest: "806d52c0296048d69a25b379d8dcdfa5690dbee0cef391ea6894485016393f6e" };
      add("ruiner.student-of-stars.3", "ruiner.student-of-stars", 3, quote.studentOfStars.sourceDigest, `Момент истины: потратить все ${quote.focusAtEntry} Фокуса за +${amount} Преимущества в этой Дуэли.`, { amount, focusSpent: quote.focusAtEntry, optional: true });
    }
    if (quote.options.length) quote.options.push("enter", "cancel");
    return { ...quote, modifierIds: quote.modifiers.map(item => item.id), reason: quote.reasons.join(" ") };
  };
  const duelResolveQuote = (actor, context = {}) => {
    const entry = context.entryQuote || context.duel?.entryQuote || {};
    const sources = Array.isArray(entry.sources) ? entry.sources.map(item => ({ ...item })) : [];
    return { ok: true, advantage: Math.max(0, Number(entry.advantage || 0)), sources, modifierIds: sources.map(item => item.id) };
  };
  const enabled = actor => adapters.filter(rule => rule.available(actor) && actor.lionwing?.automation?.[rule.id] === true);
  const eventTriggerRules = Object.freeze(eventAdapters);
  const afterEvent = (actor, event, context = {}) => {
    if (!actor || !event || !event.type) return [];
    return enabled(actor).filter(rule => eventTriggerRules.includes(rule) || ["ruiner.cryomancer.2", "disruptor.siren.1"].includes(rule.id)).flatMap(rule => {
      let match = false;
      if (rule.id === "bulwark.rising-challenger.1") match = event.type === "clash.success" && event.actorId === actor.id;
      else if (rule.id === "powerhouse.berserker.3") match = event.type === "damage.apply" && event.payload?.targetId === actor.id && Number(event.payload?.dealt || 0) > 0 && !context.used;
      else if (rule.id === "powerhouse.intimidator.3") match = event.type === "actor.knockout" && event.actorId === actor.id && event.payload?.targetId !== actor.id && Boolean(event.payload?.targetId);
      else if (rule.id === "disruptor.siren.1") match = typeof rule.match === "function" && Boolean(rule.match(actor, event, context));
      else if (rule.id === "disruptor.siren.2") {
        const target = context.scene?.actors?.find(item => item.id === event.payload?.targetId);
        match = event.type === "effect.apply" && event.payload?.effect === "negative.испуган" && event.actorId === actor.id
          && context.scene?.activeActorId === actor.id && event.payload?.targetId !== actor.id && target && !target.knockedOut;
      }
      else if (rule.id === "disruptor.siren.3") {
        const payload = event.payload || {}, attribute = payload.attribute || "spirit", target = context.scene?.actors?.find(item => item.id === payload.targetIds?.[0]);
        match = event.type === "action.resolve" && event.actorId === actor.id && context.scene?.activeActorId === actor.id && payload.actionId === "action.атаки.завершение" && ["mind", "spirit"].includes(String(attribute).toLowerCase()) && typeof payload.actionInstanceId === "string" && Array.isArray(payload.targetIds) && payload.targetIds.length === 1 && Boolean(payload.targetIds[0]) && target && target.id !== actor.id && !target.knockedOut && target.space === actor.space && Boolean(event.execution?.actionInstanceId || event.execution?.rootActionId);
      }
      else if (rule.id === "disruptor.chemist.2") match = event.type === "effect.apply" && event.payload?.effect === "negative.ослаблен" && event.actorId === actor.id && event.payload?.targetId !== actor.id;
      else if (rule.id === "vagabond.dim-mak.1") {
        const marker = (context.scene?.markers || []).find(item => item.ruleId === "vagabond.dim-mak.1" && item.ownerActorId === actor.id && item.space === actor.space && Number(item.x) === Number(actor.x) && Number(item.y) === Number(actor.y));
        match = event.type === "actor.enter" && event.actorId === actor.id && Boolean(marker);
      } else if (rule.id === "vagabond.dim-mak.2") {
        const instance = context.scene?.lionwing?.activeTurnInstanceId || event.execution?.ownerTurnInstanceId || null;
        const studies = studyHistory(actor, context.scene).filter(item => item.actionId === ACTIONS.study && (instance ? item.ownerTurnInstanceId === instance : Number(item.turnSerial) === Number(context.scene?.turnSerial)));
        match = event.type === "action.resolve" && event.payload?.actionId === ACTIONS.study && event.actorId === actor.id && studies.length === 3;
      } else if (rule.id === "vagabond.dim-mak.3") {
        if (event.type !== "marker.remove" || event.payload?.ruleId !== "vagabond.dim-mak.1" || event.actorId !== actor.id) return [];
        const targetId = event.payload?.carrierActorId || event.payload?.targetId;
        const turnId = event.execution?.ownerTurnInstanceId || context.ownerTurnInstanceId || context.scene?.lionwing?.activeTurnInstanceId || null;
        const removals = (context.scene?.log || []).filter(item => item.type === "marker.remove" && item.actorId === actor.id && item.payload?.ruleId === "vagabond.dim-mak.1" && (item.payload?.carrierActorId || item.payload?.targetId) === targetId && (turnId ? (item.execution?.ownerTurnInstanceId || item.payload?.ownerTurnInstanceId) === turnId : Number(item.payload?.turnSerial ?? item.execution?.turnSerial) === Number(context.scene?.turnSerial)));
        match = removals.length === 3;
      } else if (rule.id === "ruiner.grim-ascendant.2") {
        const payload = event.payload || {}, transformed = actor.ruleState?.grimTransformed === true || actor.lionwing?.grimTransformed === true || actor.grimTransformed === true;
        match = transformed && event.type === "action.resolve" && event.actorId === actor.id && payload.actionId === "action.атаки.завершение" && String(payload.attribute || "spirit").toLowerCase() === "spirit" && typeof (payload.actionInstanceId || event.execution?.actionInstanceId) === "string" && Array.isArray(payload.targetIds) && payload.targetIds.length === 1;
      } else if (rule.id === "ruiner.cryomancer.2") {
        const payload = event.payload || {}, clock = actor.ruleClocks?.["ruiner.cryomancer.icicle"];
        match = event.type === "resource.gain" && event.actorId === actor.id && payload.requestedResource === "focus" && Number(payload.amount || 0) > 0 && typeof payload.actionId === "string" && event.execution?.actionDefinitionId === payload.actionId && typeof (payload.actionInstanceId || event.execution?.actionInstanceId) === "string" && Number(clock?.current ?? clock?.value ?? 0) < Number(clock?.max ?? clock?.size ?? 4);
      }
      else if (typeof rule.match === "function") match = Boolean(rule.match(actor, event, context));
      if (!match) return [];
      const triggerKey = typeof rule.triggerKey === "function" ? rule.triggerKey({ actor, event, context }) : `${event.id}:${actor.id}`;
      const operations = rule.id === "ruiner.cryomancer.2" ? [{ kind: "clock", targetId: actor.id, id: "ruiner.cryomancer.icicle", operation: "add", delta: 1, ruleId: rule.id }] : rule.operations(actor, event, context);
      const ruleChoices = rule.choices ? rule.choices(actor, event, context) : [];
      const followUp = typeof rule.followUp === "function" ? rule.followUp(actor, event, context) : rule.followUp;
      return [{ id: rule.id, label: rule.label, sourceDigest: rule.sourceDigest, coverage: rule.coverage, triggerKey: rule.id === "ruiner.cryomancer.2" ? `${event.payload.actionInstanceId || event.execution?.actionInstanceId}:${actor.id}:cryomancer-2` : triggerKey, operations, choices: ruleChoices, choiceSet: rule.choiceSet === true, ...(followUp ? { followUp } : {}) }];
    });
  };
  const numericContributions = (actor, method, context) => enabled(actor).flatMap(rule => {
    const amount = Number(method.startsWith("stat") ? rule[method]?.(actor, context.key, context) : rule[method]?.(actor, context) || 0);
    return Number.isFinite(amount) && amount !== 0 ? [{ id: rule.id, label: rule.label, amount, sourceDigest: rule.sourceDigest, coverage: rule.coverage, sourceType: "canonical", reason: rule.label, operation: method === "statMinimum" ? "min" : "add" }] : [];
  });
  // One deterministic read-only pipeline for every numeric value. Existing
  // stat/range/roll hooks are projected into it, while future adapters may
  // return typed operations without changing the engine again.
  const numericOperations = new Set(["replace", "multiply", "add", "min", "max"]);
  const normalizeNumericOperation = value => {
    if (value == null) return [];
    return (Array.isArray(value) ? value : [value]).flatMap(item => {
      if (typeof item === "number") return Number.isFinite(item) ? [{ operation: "add", amount: item }] : [];
      if (!item || typeof item !== "object") return [];
      const operation = item.operation || item.mode || "add", amount = Number(item.amount ?? item.value);
      return numericOperations.has(operation) && Number.isFinite(amount) ? [{ ...item, operation, amount }] : [];
    });
  };
  const composeNumeric = (base, operations = [], context = {}) => {
    const initial = Number(base);
    if (!Number.isFinite(initial)) return { ok: false, reason: "Базовое числовое значение некорректно.", key: context.key || null, value: 0, base: initial, operations: [] };
    const normalized = normalizeNumericOperation(operations);
    const replacements = normalized.filter(item => item.operation === "replace");
    const distinctReplacements = [...new Set(replacements.map(item => item.amount))];
    if (distinctReplacements.length > 1) return { ok: false, reason: `Конфликт замен числового значения: ${replacements.map(item => item.id || item.reason || "источник").join(", ")}.`, key: context.key || null, value: initial, base: initial, operations: normalized, sources: normalized, reasons: ["Требуется решение Нарратора"] };
    let value = distinctReplacements.length ? distinctReplacements[0] : initial;
    for (const operation of ["multiply", "add", "min", "max"]) for (const item of normalized.filter(row => row.operation === operation)) {
      if (operation === "multiply") value *= item.amount;
      else if (operation === "add") value += item.amount;
      else if (operation === "min") value = Math.max(value, item.amount);
      else value = Math.min(value, item.amount);
    }
    if (context.roundUp === true || normalized.some(item => item.roundUp === true)) value = Math.ceil(value);
    return { ok: true, key: context.key || null, base: initial, value, effective: value, operations: normalized, order: ["replace", "multiply", "add", "min", "max"] };
  };
  const numericQuote = (actor, context = {}) => {
    const key = String(context.key || "value"), base = Number(context.baseValue ?? context.base ?? actor?.[key] ?? 0);
    if (!Number.isFinite(base)) return { ok: false, reason: "Базовое числовое значение некорректно.", key, value: 0, base, operations: [], sources: [], reasons: [] };
    const operations = [];
    for (const rule of enabled(actor)) {
      const legacy = [];
      if (["maxHp", "hp", "speed", "armor", "evasion", "body", "talent", "spirit", "mind"].includes(key)) {
        const amount = Number(rule.statBonus?.(actor, key, { ...context, key }) || 0);
        const minimum = Number(rule.statMinimum?.(actor, key, { ...context, key }) || 0);
        if (Number.isFinite(amount) && amount !== 0) legacy.push({ operation: "add", amount, reason: rule.label });
        if (Number.isFinite(minimum) && minimum !== 0) legacy.push({ operation: "min", amount: minimum, reason: rule.label });
      }
      if (["attackRange", "range"].includes(key)) {
        const amount = Number(rule.rangeBonus?.(actor, context) || 0);
        if (Number.isFinite(amount) && amount !== 0) legacy.push({ operation: "add", amount, reason: rule.label });
      }
      if (["advantage", "attackPool"].includes(key)) {
        const amount = Number(rule.rollBonus?.(actor, context) || 0);
        if (Number.isFinite(amount) && amount !== 0) legacy.push({ operation: "add", amount, reason: rule.label });
      }
      for (const operation of [...legacy, ...normalizeNumericOperation(rule.numeric?.(actor, { ...context, key }))]) {
        if (operation.amount === 0) continue;
        operations.push({ ...operation, id: rule.id, techniqueId: rule.techniqueId, level: rule.level, label: rule.label, sourceDigest: rule.sourceDigest, coverage: rule.coverage, sourceType: "canonical", reason: operation.reason || rule.label });
      }
    }
    const composed = composeNumeric(base, operations, { ...context, key });
    if (composed.ok === false) return { ...composed, key, operations, sources: operations, reasons: [composed.reason] };
    const sources = operations.map(item => ({ id: item.id, label: item.label, amount: item.amount, operation: item.operation, sourceDigest: item.sourceDigest, coverage: item.coverage, sourceType: item.sourceType || "canonical", reason: item.reason }));
    const sourceDigests = [...new Set(sources.map(item => item.sourceDigest).filter(Boolean))];
    return { ...composed, key, sources, sourceDigest: sourceDigests.length === 1 ? sourceDigests[0] : sourceDigests, sourceDigests, coverage: sources.some(item => item.coverage === "partial") ? "partial" : "full", reasons: sources.map(item => item.reason), reason: sources.map(item => item.reason).join(" ") };
  };
  // Techniques use this small facade rather than scanning the Scene journal
  // themselves. Geometry owns the authoritative facts and checked operation;
  // adapters remain declarative and cannot provide their own route/distance.
  const movementFacts = (scene, request = {}) => global.DAWN_LIONWING_GEOMETRY?.movementFacts?.(scene, request) || { available: false, reason: "Жизненный цикл движения недоступен." };
  const movementCondition = (scene, request = {}) => global.DAWN_LIONWING_GEOMETRY?.movementCondition?.(scene, request) || { available: false, reason: "Жизненный цикл движения недоступен." };
  const movementOperation = (scene, request = {}) => global.DAWN_LIONWING_GEOMETRY?.movementOperation?.(scene, request) || { ok: false, errors: ["Жизненный цикл движения недоступен."], operation: null, plan: null };
  const lifecycleBoundaries = Object.freeze(["sceneStart", "sceneEnd", "roundStart", "roundEnd", "ownTurnStart", "ownTurnEnd", "anyTurnStart", "anyTurnEnd"]);
  const lifecycle = Object.freeze({
    boundaries: lifecycleBoundaries,
    turnKey: (actor, scene) => {
      const serial = Number(actor?.lionwing?.ownerTurnSerial ?? actor?.lionwing?.ownTurnSerial ?? actor?.lionwing?.turnCount ?? 0);
      return `${scene?.lionwing?.sceneSerial || 1}:${actor?.id || ""}:${serial}`;
    },
    count: (actor, scene, query = {}) => {
      const rows = eventHistory(actor, scene), scope = query.scope || "ownerTurn";
      const serial = query.ownerTurnSerial ?? actor?.lionwing?.ownerTurnSerial ?? actor?.lionwing?.ownTurnSerial ?? 0;
      // An owner Turn is keyed by the owner's own serial. The global active
      // instance is meaningful only for anyTurn; using it as a default for an
      // inactive owner made a query for that owner's last Turn silently return
      // zero while somebody else was up.
      const instance = scope === "anyTurn"
        ? query.ownerTurnInstanceId ?? query.turnInstanceId ?? scene?.lionwing?.activeTurnInstanceId
        : query.ownerTurnInstanceId ?? null;
      return rows
        .filter(item => query.ruleId == null || item.ruleId === query.ruleId)
        .filter(item => query.actionId == null || item.actionId === query.actionId)
        .filter(item => scope === "scene"
          ? Number(item.sceneSerial || scene?.lionwing?.sceneSerial || 1) === Number(scene?.lionwing?.sceneSerial || 1)
          : scope === "round"
            ? Number(item.sceneSerial || scene?.lionwing?.sceneSerial || 1) === Number(scene?.lionwing?.sceneSerial || 1) && Number(item.round) === Number(scene?.round)
            : instance
              ? item.ownerTurnInstanceId === instance
              : Number(item.ownerTurnSerial ?? item.turnSerial) === Number(serial)).length;
    },
    used: (actor, scene, query = {}) => lifecycle.count(actor, scene, query) > 0,
    once: (actor, scene, query = {}) => lifecycle.count(actor, scene, query) === 0,
    first: (actor, scene, query = {}) => lifecycle.count(actor, scene, query) === 0,
    nth: (actor, scene, n, query = {}) => Number.isSafeInteger(Number(n)) && Number(n) > 0 && lifecycle.count(actor, scene, query) === Number(n) - 1,
  });
  global.DAWN_LIONWING_ADAPTERS = Object.freeze({
    list: actor => adapters.filter(rule => rule.available(actor)).map(({ id, techniqueId, level, label, sourceDigest, coverage }) => ({
      id, techniqueId, level, label, sourceDigest, coverage,
      enabled: actor?.lionwing?.automation?.[id] === true,
    })).concat((global.DAWN_LIONWING_INFORMATION_QUERY?.adapters || [])
      .filter(rule => Number((actor?.knownTechniques ?? actor?.techniques)?.[rule.techniqueId] || 0) >= rule.level)
      .map(rule => ({ ...rule, enabled: actor?.lionwing?.automation?.[rule.id] === true }))),
    replacements: (actor, original) => enabled(actor).flatMap(rule => rule.replacements?.(actor, original) || []),
    afterEffect: (actor, original) => enabled(actor).flatMap(rule => rule.afterEffect?.(actor, original) || []),
    afterEvent,
    lifecycle,
    rollBonuses: (actor, context = {}) => numericContributions(actor, "rollBonus", context),
    rollBonus: (actor, context = {}) => numericContributions(actor, "rollBonus", context).reduce((sum, item) => sum + item.amount, 0),
    statBonuses: (actor, key, context = {}) => numericContributions(actor, "statBonus", { ...context, key }),
    statBonus: (actor, key, context = {}) => numericContributions(actor, "statBonus", { ...context, key }).reduce((sum, item) => sum + item.amount, 0),
    statMinimums: (actor, key, context = {}) => numericContributions(actor, "statMinimum", { ...context, key }),
    statMinimum: (actor, key, context = {}) => numericContributions(actor, "statMinimum", { ...context, key }).reduce((minimum, item) => Math.max(minimum, item.amount), 0),
    rangeBonuses: (actor, context = {}) => numericContributions(actor, "rangeBonus", context),
    rangeBonus: (actor, context = {}) => numericContributions(actor, "rangeBonus", context).reduce((sum, item) => sum + item.amount, 0),
    numericQuote,
    composeNumeric,
    statQuote: (actor, key, context = {}) => numericQuote(actor, { ...context, key, baseValue: context.baseValue ?? (actor?.attrs?.[key] ?? actor?.[key] ?? 0) }),
    rangeQuote: (actor, context = {}) => numericQuote(actor, { ...context, key: "range", baseValue: context.baseValue ?? context.baseRange ?? 0 }),
    attackQuote: (actor, context = {}) => numericQuote(actor, { ...context, key: context.key || "attackPool" }),
    damageQuote: (actor, context = {}) => numericQuote(actor, { ...context, key: context.key || "damage" }),
    resourceQuote: (actor, context = {}) => numericQuote(actor, { ...context, key: context.key || "resourceCost" }),
    boundaryOperations: (actor, context = {}) => enabled(actor).flatMap(rule => {
      const declared = rule.boundaryOperations?.(actor, context) || [];
      const boundaryOperations = Array.isArray(declared) ? declared : (Array.isArray(declared.operations) ? declared.operations : []);
      const inventoryOperations = rule.inventoryOperations?.(actor, context) || [];
      const operations = [...boundaryOperations, ...inventoryOperations];
      const choices = Array.isArray(declared) ? [] : (Array.isArray(declared.choices) ? declared.choices : []);
      return operations.length || choices.length ? [{ id: rule.id, label: rule.label, sourceDigest: rule.sourceDigest, coverage: rule.coverage, operations, choices }] : [];
    }),
    resourceGainStatus: (actor, context = {}) => enabled(actor).reduce((status, rule) => status.allowed === false ? status : rule.resourceGainStatus?.(actor, context) || status, { allowed: true, reason: "" }),
    actionStatus: (actor, context = {}) => enabled(actor).reduce((status, rule) => status.allowed === false ? status : rule.actionStatus?.(actor, context) || status, { allowed: true, reason: "" }),
    trustedTechniqueTags,
    actionModifiers: actor => enabledActionModifiers(actor).map(rule => ({ id: rule.id, techniqueId: rule.techniqueId, level: rule.level, label: rule.label, sourceDigest: rule.sourceDigest, coverage: rule.coverage })).concat((global.DAWN_LIONWING_INFORMATION_QUERY?.adapters || []).filter(rule => Number((actor?.knownTechniques ?? actor?.techniques)?.[rule.techniqueId] || 0) >= rule.level)),
    actionQuote: (actor, context = {}) => actionQuote(actor, context),
    duelEntryQuote,
    duelResolveQuote,
    movementFacts,
    movementCondition,
    movementOperation,
  });
})(typeof window === "object" ? window : globalThis);
