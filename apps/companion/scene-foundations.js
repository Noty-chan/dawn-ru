"use strict";

const RULE_CLOCK_ADAPTERS = [
  { techniqueId: "powerhouse.braggart", clockId: "powerhouse.braggart.pride", label: "Гордость", size: 6, minimumSize: 2, initial: 0, resetScope: "scene" },
  { techniqueId: "vagabond.cunning-fighter", clockId: "vagabond.cunning-fighter.plan", label: "Хитрый план", size: 4, initial: 0, resetScope: "scene", legacyTechniqueState: "cunningPlan" },
  { techniqueId: "vagabond.egomaniac", clockId: "vagabond.egomaniac.style", label: "Стиль", size: 4, initial: 0, resetScope: "scene" },
  { techniqueId: "bulwark.stalwart-sentry", minimumLevel: 2, clockId: "bulwark.stalwart-sentry.vigilance", label: "Бдительность", size: 4, initial: 4, resetScope: "scene" },
  { techniqueId: "altruist.chronomancer", minimumLevel: 3, clockId: "altruist.chronomancer.flow", label: "Поток", size: 8, initial: 0, resetScope: "scene" },
  { techniqueId: "ruiner.cryomancer", minimumLevel: 2, clockId: "ruiner.cryomancer.icicle", label: "Сосулька", size: 4, initial: 0, resetScope: "scene" },
  { techniqueId: "ruiner.feral-arcana", minimumLevel: 2, clockId: "ruiner.feral-arcana.rage", label: "Ярость", size: 6, initial: 0, resetScope: null, active: false, removeWhenEmpty: true },
  { techniqueId: "ruiner.void-soul", minimumLevel: 3, clockId: "ruiner.void-soul.void", label: "Пустота", size: 6, initial: 0, resetScope: "scene" },
  { techniqueId: "ruiner.thunder-blood", clockId: "ruiner.thunder-blood.static", label: "Статика", size: 6, initial: 0, resetScope: "scene" },
  { techniqueId: "ruiner.zealot", clockId: "ruiner.zealot.revelation", label: "Озарение", size: 6, initial: 0, resetScope: "scene" },
];

function normalizeRuleClockDefinition(definition = {}) {
  const size = Math.max(1, Math.min(24, Number(definition.size ?? 6) || 6));
  return {
    clockId: String(definition.clockId || ""),
    label: String(definition.label || definition.clockId || ""),
    size,
    minimumSize: Math.max(1, Math.min(size, Number(definition.minimumSize ?? size) || size)),
    initial: Math.max(0, Math.min(size, Number(definition.initial ?? 0) || 0)),
    resetScope: ["scene", "round", "turn"].includes(definition.resetScope) ? definition.resetScope : null,
    active: definition.active !== false,
    removeWhenEmpty: Boolean(definition.removeWhenEmpty),
    legacyTechniqueState: typeof definition.legacyTechniqueState === "string" ? definition.legacyTechniqueState : null,
    techniqueId: typeof definition.techniqueId === "string" ? definition.techniqueId : null,
  };
}

function ruleClockDefinitions(actor) {
  if (!actor) return [];
  const definitions = RULE_CLOCK_ADAPTERS
    .filter(definition => Number(actor.techniques?.[definition.techniqueId] || 0) >= Number(definition.minimumLevel || 1))
    .map(normalizeRuleClockDefinition);
  for (const [clockId, stored] of Object.entries(actor.ruleClocks || {})) {
    if (stored == null) continue;
    const normalized = normalizeRuleClockDefinition(typeof stored === "object" ? { clockId, ...stored } : { clockId, label: clockId, size: 6, initial: 0 });
    const index = definitions.findIndex(definition => definition.clockId === clockId);
    if (index >= 0 && typeof stored === "object") definitions[index] = { ...definitions[index], ...normalized };
    else if (index < 0) definitions.push(normalized);
  }
  return definitions;
}

function ruleClockDefinition(actor, clockId) {
  return ruleClockDefinitions(actor).find(definition => definition.clockId === clockId) || null;
}

function ruleClockValue(actor, definition) {
  const stored = actor?.ruleClocks?.[definition.clockId];
  const legacy = definition.legacyTechniqueState ? actor?.techniqueState?.[definition.legacyTechniqueState] : undefined;
  const raw = typeof stored === "object" ? stored.value : stored ?? legacy ?? definition.initial;
  return Math.max(0, Math.min(definition.size, Number(raw) || 0));
}

function clockStatus(scene, actorId, clockId, options = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", id: clockId || "", size: 0, value: 0, nextValue: 0, remaining: 0, empty: true, full: false, active: false };
  let definition = ruleClockDefinition(actor, clockId);
  if (!definition && options.size != null) definition = normalizeRuleClockDefinition({ clockId, label: options.label || clockId, size: options.size, initial: options.initial, active: options.active });
  const delta = Number(options.delta ?? 0);
  if (!definition || !/^[a-z][a-z0-9.-]{0,79}$/.test(String(clockId || "")) || !Number.isFinite(delta)) return { available: false, reason: "Некорректные параметры часов.", id: String(clockId || ""), size: 0, value: 0, nextValue: 0, remaining: 0, empty: true, full: false, active: false };
  const stored = actor.ruleClocks?.[clockId], active = typeof stored === "object" && typeof stored.active === "boolean" ? stored.active : definition.active;
  const value = ruleClockValue(actor, definition), nextValue = Math.max(0, Math.min(definition.size, value + delta));
  return { available: true, reason: "", id: clockId, label: definition.label, size: definition.size, minimumSize: definition.minimumSize, value, nextValue, remaining: definition.size - nextValue, empty: nextValue === 0, full: nextValue === definition.size, active, definition: clone(definition) };
}

function resetRuleClocks(actor, scope) {
  if (!actor || !["scene", "round", "turn"].includes(scope)) return [];
  const resets = [];
  for (const definition of ruleClockDefinitions(actor).filter(item => item.resetScope === scope)) {
    actor.ruleClocks ||= {};
    actor.ruleClocks[definition.clockId] = { ...definition, value: definition.initial, active: definition.active };
    if (definition.legacyTechniqueState) {
      actor.techniqueState ||= {};
      actor.techniqueState[definition.legacyTechniqueState] = definition.initial;
    }
    resets.push({ clockId: definition.clockId, label: definition.label, value: definition.initial, size: definition.size, scope });
  }
  return resets;
}

const DICE_HOOK_TYPES = new Set(["advantage", "hindrance", "attribute", "success-threshold", "critical-at", "all-dice-succeed", "successes-invert", "reroll", "result-trigger", "random-table"]);

function activeActorsInSpace(scene, actor) {
  return (scene?.actors || []).filter(item => item.id !== actor.id && item.space === actor.space && !item.knockedOut && effectPresenceStatus(scene, item.id).available && effectPresenceStatus(scene, item.id).onField);
}

function sideBalanceStatus(scene, actorId) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", enemies: 0, allies: 0, outnumbered: false, enemyIds: [], allyIds: [] };
  const present = activeActorsInSpace(scene, actor), enemies = present.filter(item => item.team !== actor.team), allies = present.filter(item => item.team === actor.team);
  return { available: true, reason: "", enemies: enemies.length, allies: allies.length, outnumbered: enemies.length > allies.length, enemyIds: enemies.map(item => item.id), allyIds: allies.map(item => item.id) };
}

function normalizeDiceHook(hook = {}) {
  const type = String(hook.type || ""), ruleId = String(hook.ruleId || ""), label = String(hook.label || ruleId || type);
  if (!DICE_HOOK_TYPES.has(type) || !/^[a-z0-9][a-z0-9._:-]{0,179}$/i.test(ruleId) || !label || label.length > 160) return null;
  const normalized = { type, ruleId, label };
  if (["advantage", "hindrance"].includes(type)) {
    const amount = Number(hook.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 99) return null;
    normalized.amount = amount;
  }
  if (type === "attribute") {
    if (!["body", "talent", "spirit", "mind"].includes(hook.value)) return null;
    normalized.value = hook.value;
  }
  if (["success-threshold", "critical-at"].includes(type)) {
    const value = Number(hook.value);
    if (!Number.isInteger(value) || value < 2 || value > 6) return null;
    normalized.value = value;
  }
  if (type === "reroll") {
    if (!["failed", "successful", "all", "selected"].includes(hook.faces || hook.mode)) return null;
    normalized.faces = hook.faces || hook.mode;
    normalized.maximum = Math.max(1, Math.min(99, Number(hook.maximum || 1)));
  }
  if (type === "result-trigger") {
    if (!["odd-successes", "even-successes", "critical", "failed-die", "success"].includes(hook.when)) return null;
    normalized.when = hook.when;
  }
  if (type === "random-table") {
    if (!Array.isArray(hook.entries) || hook.entries.length < 2 || hook.entries.length > 100) return null;
    normalized.entries = hook.entries.map(entry => String(entry).slice(0,240));
  }
  return normalized;
}

function passiveDiceHooks(scene, actor, request = {}) {
  const hooks = [];
  const pride = clockStatus(scene, actor.id, "powerhouse.braggart.pride");
  if (Number(actor.techniques?.["powerhouse.braggart"] || 0) >= 1 && pride.available && pride.active && pride.full) {
    const amount = 1 + (Number(actor.techniques?.["powerhouse.braggart"] || 0) >= 2 ? Math.floor((6 - pride.size) / 2) : 0);
    hooks.push({ type: "advantage", ruleId: "powerhouse.braggart.1", label: "Гордыня", amount });
  }
  const actionId = canonicalActionId(request.actionId || request.actionName || "");
  if (actionIdIs(actionId, "spell") && Number(actor.techniques?.["altruist.chronomancer"] || 0) >= 2) hooks.push({ type: "advantage", ruleId: "altruist.chronomancer.2", label: "Замедление", amount: 1 });
  if (actionIdIs(actionId, "spell") && Number(actor.techniques?.["ruiner.cryomancer"] || 0) >= 2) hooks.push({ type: "advantage", ruleId: "ruiner.cryomancer.2", label: "Ледяной нимб", amount: 1 });
  if (actionIdIs(actionId, "spell") && Number(actor.techniques?.["ruiner.feral-arcana"] || 0) >= 3) hooks.push({ type: "advantage", ruleId: "ruiner.feral-arcana.3", label: "Хватка", amount: 1 });
  if (actionIdIs(actionId, "spell") && Number(actor.techniques?.["ruiner.thunder-blood"] || 0) >= 3) hooks.push({ type: "advantage", ruleId: "ruiner.thunder-blood.3", label: "Разрядка", amount: 1 });
  if (actionIdIs(actionId, "skirmish") && Number(actor.techniques?.["bulwark.grappler"] || 0) >= 2) hooks.push({ type: "advantage", ruleId: "bulwark.grappler.2", label: "Перелом позвоночника", amount: 1 });
  const innerWorldLevel = Number(actor.techniques?.["disruptor.inner-world"] || 0);
  if (innerWorldLevel >= 3 && actor.space === `inner-world-${actor.id}` && (["skirmish", "spell", "finish"].some(key => actionIdIs(actionId, key)) || request.scope === "opposed")) {
    hooks.push({ type: "advantage", ruleId: "disruptor.inner-world.3", label: "Родная территория", amount: Number(actor.tier || 1) });
  }
  const balance = request.sceneContext === false ? { enemies: 0, allies: 0, outnumbered: false } : sideBalanceStatus(scene, actor.id);
  if (request.sceneContext !== false && (actor.gifts || []).includes("wolf.outgunned") && balance.outnumbered) hooks.push({ type: "advantage", ruleId: "wolf.outgunned", label: `В меньшинстве (${balance.enemies} враг. / ${balance.allies} союзн.)`, amount: 2 });
  const selected = new Set(Array.isArray(request.selectedHookIds) ? request.selectedHookIds : []);
  if ((actor.gifts || []).includes("wolf.dark-urge") && request.scope === "challenge" && request.usesAbility && selected.has("wolf.dark-urge")) hooks.push({ type: "advantage", ruleId: "wolf.dark-urge", label: "Тёмный порыв", amount: 4 });
  if (["skirmish", "spell", "finish"].some(key => actionIdIs(actionId, key)) && Array.isArray(request.targetIds) && request.targetIds.length) {
    const levelAt = target => { const key=cellKey(target),types=(scene.objects||[]).filter(object=>object.space===target.space&&(object.cells||[]).includes(key)).map(object=>object.type);return types.includes("high")?1:types.includes("low")?-1:0 }, targets=request.targetIds.map(id=>actorById(scene,id)).filter(Boolean),sourceLevel=levelAt(actor),targetLevels=[...new Set(targets.map(levelAt))];
    if(targets.length===request.targetIds.length&&targetLevels.length===1&&sourceLevel!==targetLevels[0])hooks.push({type:sourceLevel>targetLevels[0]?"advantage":"hindrance",ruleId:"battlefield.elevation",label:sourceLevel>targetLevels[0]?"Атака сверху":"Атака снизу",amount:Number(actor.tier||1)});
  }
  return hooks;
}

function diceHookStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", hooks: [], sources: [], advantage: 0, hindrance: 0, count: 0, threshold: 4, criticalAt: 6 };
  const explicit = Array.isArray(request.hooks) ? request.hooks.map(normalizeDiceHook) : [];
  if (explicit.some(hook => !hook)) return { available: false, reason: "В броске передан неподдерживаемый хук кубов.", hooks: [], sources: [], advantage: 0, hindrance: 0, count: 0, threshold: 4, criticalAt: 6 };
  const hooks = [...passiveDiceHooks(scene, actor, request), ...explicit], attributeHook = [...hooks].reverse().find(hook => hook.type === "attribute");
  const thresholdHook = [...hooks].reverse().find(hook => hook.type === "success-threshold"), criticalHook = [...hooks].reverse().find(hook => hook.type === "critical-at");
  const manualAdvantage = Math.max(0, Math.min(99, Number(request.advantage || 0))), manualHindrance = Math.max(0, Math.min(99, Number(request.hindrance || 0)));
  const advantage = manualAdvantage + hooks.filter(hook => hook.type === "advantage").reduce((sum, hook) => sum + hook.amount, 0);
  const hindrance = manualHindrance + hooks.filter(hook => hook.type === "hindrance").reduce((sum, hook) => sum + hook.amount, 0);
  const rawBaseCount = request.baseCount == null ? null : Number(request.baseCount), count = rawBaseCount == null ? null : Math.max(1, Math.min(300, rawBaseCount + advantage - hindrance));
  const sources = hooks.filter(hook => ["advantage", "hindrance", "attribute", "success-threshold", "critical-at", "all-dice-succeed", "successes-invert"].includes(hook.type));
  return { available: true, reason: "", actorId: actor.id, scope: String(request.scope || "roll"), sceneContext: request.sceneContext !== false, baseCount: rawBaseCount, count, advantage, hindrance, manualAdvantage, manualHindrance, attribute: attributeHook?.value || request.attribute || null, threshold: thresholdHook?.value || Math.max(2, Math.min(6, Number(request.threshold || 4))), criticalAt: criticalHook?.value || Math.max(2, Math.min(6, Number(request.criticalAt || 6))), usesAbility: Boolean(request.usesAbility), abilityKey: request.abilityKey || null, selectedHookIds: [...new Set(Array.isArray(request.selectedHookIds) ? request.selectedHookIds.map(String) : [])], targetIds: [...new Set(Array.isArray(request.targetIds) ? request.targetIds.map(String) : [])], explicitHooks: explicit, hooks, sources, sideBalance: request.sceneContext === false ? { available: true, enemies: 0, allies: 0, outnumbered: false, enemyIds: [], allyIds: [] } : sideBalanceStatus(scene, actor.id) };
}

function evaluateDiceRoll(status, roll = {}) {
  if (!status?.available || !Array.isArray(roll.rolls) || roll.rolls.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 6)) return { available: false, reason: status?.reason || "Некорректный результат броска." };
  const rolls = roll.rolls.map(Number), ordinary = rolls.filter(value => value >= status.threshold).length, crits = rolls.filter(value => value >= status.criticalAt).length;
  let successes = status.hooks.some(hook => hook.type === "all-dice-succeed") ? rolls.length : ordinary;
  if (status.hooks.some(hook => hook.type === "successes-invert")) successes = rolls.length - successes;
  const resultTriggers = status.hooks.filter(hook => hook.type === "result-trigger").filter(hook => hook.when === "odd-successes" ? successes % 2 === 1 : hook.when === "even-successes" ? successes % 2 === 0 : hook.when === "critical" ? crits > 0 : hook.when === "failed-die" ? successes < rolls.length : successes > 0);
  return { available: true, reason: "", rolls, successes, crits, threshold: status.threshold, criticalAt: status.criticalAt, resultTriggers, formula: `${status.count ?? rolls.length}D6 ≥${status.threshold}` };
}

function diceRollPayload(scene, actorId, request = {}, roll = {}) {
  const status = diceHookStatus(scene, actorId, request), evaluated = evaluateDiceRoll(status, roll);
  if (!evaluated.available) return { available: false, reason: evaluated.reason, status, payload: null };
  const dice = { scope: status.scope, sceneContext: status.sceneContext, baseCount: status.baseCount, count: status.count, advantage: status.advantage, hindrance: status.hindrance, manualAdvantage: status.manualAdvantage, manualHindrance: status.manualHindrance, attribute: status.attribute, threshold: status.threshold, criticalAt: status.criticalAt, usesAbility: status.usesAbility, abilityKey: status.abilityKey, selectedHookIds: status.selectedHookIds, targetIds: status.targetIds, explicitHooks: clone(status.explicitHooks), hooks: clone(status.hooks), sources: clone(status.sources) };
  return { available: true, reason: "", status, payload: { formula: evaluated.formula, rolls: evaluated.rolls, successes: evaluated.successes, crits: evaluated.crits, dice } };
}

function ruleDiceAdvantage(scene, actorId, request = {}) {
  const status = diceHookStatus(scene, actorId, request);
  const sources = status.available ? status.hooks.filter(hook => hook.type === "advantage").map(hook => ({ ruleId: hook.ruleId, label: hook.label, amount: hook.amount })) : [];
  return { total: sources.reduce((sum, source) => sum + source.amount, 0), sources };
}

const RULE_RESOURCE_ADAPTERS = [
  { techniqueId: "powerhouse.gunslinger", resource: "bullets", label: "Пули", initial: 6, minimum: 0, replaces: ["focus"], spendDirection: -1, gainDirection: 1, resetScope: "scene" },
  { techniqueId: "vagabond.knife-juggler", resource: "weapons", label: "Оружие", initial: 4, minimum: 0, replaces: ["focus"], spendDirection: -1, gainDirection: 1, resetScope: "scene" },
  { techniqueId: "vagabond.modified-meister", resource: "heat", label: "Нагрев", initial: 0, minimum: 0, replaces: ["focus"], spendDirection: 1, gainDirection: -1, resetScope: "scene" },
  { techniqueId: "bulwark.mundane", resource: "grit", label: "Упорство", initial: actor => 1 + Math.ceil(Number(actor.attrs?.body || 0) / 2), minimum: 0, replaces: ["focus", "ap"], spendDirection: -1, gainDirection: 1, resetScope: "round", blockedGainActionKeys: ["breathe", "charge"] },
  { techniqueId: "altruist.heavenly-saint", resource: "faith", label: "Вера", initial: actor => Number(actor.attrs?.spirit || 0), minimum: 0, replaces: ["focus"], spendDirection: -1, gainDirection: 1, resetScope: "scene", blockedGainActionKeys: ["breathe", "charge"] },
  { techniqueId: "disruptor.autophage", resource: "health", label: "Здоровье", initial: 0, minimum: 0, replaces: ["focus"], spendDirection: -1, gainDirection: 1, externalResource: "hp", spendMultiplier: 2, gainMultiplier: 1 },
  { techniqueId: "ruiner.creation-ascetic", resource: "creation-marks", label: "Метки творения", initial: 0, minimum: 0, replaces: ["focus"], spendDirection: -1, gainDirection: 1, resetScope: "scene", allowedGainActionKeys: ["breathe", "charge"], legacyProperty: "creationMarks" },
];

function normalizeRuleResourceDefinition(actor, definition = {}) {
  const initial = typeof definition.initial === "function" ? definition.initial(actor) : Number(definition.initial ?? 0);
  return {
    resource: String(definition.resource || ""),
    label: String(definition.label || definition.resource || ""),
    initial: Math.max(0, Number.isFinite(initial) ? initial : 0),
    minimum: Math.max(0, Number(definition.minimum ?? 0) || 0),
    maximum: definition.maximum == null ? null : Math.max(0, Number(definition.maximum) || 0),
    replaces: [...new Set((definition.replaces || []).filter(resource => RESOURCES.has(resource)))],
    spendDirection: Number(definition.spendDirection) === 1 ? 1 : -1,
    gainDirection: Number(definition.gainDirection) === -1 ? -1 : 1,
    resetScope: ["scene", "round", "turn"].includes(definition.resetScope) ? definition.resetScope : null,
    blockedGainActionIds: [...new Set([...(definition.blockedGainActionKeys || []).map(key => ACTION_IDS[key]).filter(Boolean), ...(definition.blockedGainActions || []).map(canonicalActionId)].filter(value => typeof value === "string" && value.length <= 180))],
    allowedGainActionIds: [...new Set([...(definition.allowedGainActionKeys || []).map(key => ACTION_IDS[key]).filter(Boolean), ...(definition.allowedGainActions || []).map(canonicalActionId)].filter(value => typeof value === "string" && value.length <= 180))],
    externalResource: definition.externalResource === "hp" ? "hp" : null,
    spendMultiplier: Math.max(0, Number(definition.spendMultiplier ?? 1) || 1),
    gainMultiplier: Math.max(0, Number(definition.gainMultiplier ?? 1) || 1),
    legacyProperty: typeof definition.legacyProperty === "string" && RESOURCES.has(definition.legacyProperty) ? definition.legacyProperty : null,
    techniqueId: typeof definition.techniqueId === "string" ? definition.techniqueId : null,
  };
}

function ruleResourceDefinitions(actor) {
  if (!actor) return [];
  const definitions = RULE_RESOURCE_ADAPTERS
    .filter(definition => Number(actor.techniques?.[definition.techniqueId] || 0) >= 1)
    .map(definition => normalizeRuleResourceDefinition(actor, definition));
  for (const stored of Object.values(actor.ruleResources || {})) {
    if (!stored || typeof stored !== "object" || !stored.resource) continue;
    const normalized = normalizeRuleResourceDefinition(actor, stored);
    const index = definitions.findIndex(definition => definition.resource === normalized.resource);
    if (index >= 0) definitions[index] = { ...definitions[index], ...normalized };
    else definitions.push(normalized);
  }
  return definitions;
}

function ruleResourceDefinition(actor, resource) {
  return ruleResourceDefinitions(actor).find(definition => definition.resource === resource) || null;
}

function ruleResourceBalance(actor, definition) {
  if (definition.externalResource) return Math.max(definition.minimum, Number(actor?.[definition.externalResource] || 0));
  const stored = actor?.ruleResources?.[definition.resource]?.value ?? (definition.legacyProperty ? actor?.[definition.legacyProperty] : undefined) ?? actor?.alternateResources?.[definition.resource] ?? actor?.inventory?.[`resource:${definition.resource}`];
  const value = Number(stored ?? definition.initial);
  const bounded = Math.max(definition.minimum, Number.isFinite(value) ? value : definition.initial);
  return definition.maximum == null ? bounded : Math.min(definition.maximum, bounded);
}

function replacementConflict(actor) {
  const owners = new Map();
  for (const definition of ruleResourceDefinitions(actor)) {
    for (const resource of definition.replaces) {
      if (owners.has(resource) && owners.get(resource) !== definition.resource) return [owners.get(resource), definition.resource];
      owners.set(resource, definition.resource);
    }
  }
  return null;
}

function resourceOperationStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), operation = request.operation === "gain" ? "gain" : "spend", resource = request.resource, amount = Number(request.amount ?? 0);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", resource: String(resource || ""), resolvedResource: null, amount: 0, delta: 0 };
  if (!RESOURCES.has(resource) || !Number.isFinite(amount) || amount < 0) return { available: false, reason: "Некорректное изменение ресурса.", resource: String(resource || ""), resolvedResource: null, amount: 0, delta: 0 };
  const conflict = replacementConflict(actor);
  if (conflict) return { available: false, reason: `Конфликт альтернативных ресурсов: «${conflict[0]}» и «${conflict[1]}».`, resource, resolvedResource: null, amount, delta: 0 };
  const definition = ruleResourceDefinitions(actor).find(candidate => candidate.replaces.includes(resource));
  if (!definition) {
    const balance = Math.max(0, Number(actor[resource] || 0)), delta = operation === "gain" ? amount : -amount;
    return { available: operation === "gain" || balance >= amount, reason: operation === "spend" && balance < amount ? "Ресурс изменился: выбранное действие больше нельзя оплатить." : "", resource, resolvedResource: resource, label: resource, amount, balance, remaining: Math.max(0, balance + delta), delta, replacement: false, ignored: false };
  }
  const balance = ruleResourceBalance(actor, definition);
  const sourceActionId = canonicalActionId(request.sourceActionId || request.sourceActionName || "");
  const blockedById = operation === "gain" && definition.blockedGainActionIds.includes(sourceActionId);
  const blockedByAllowlist = operation === "gain" && definition.allowedGainActionIds.length > 0 && !definition.allowedGainActionIds.includes(sourceActionId);
  const blocked = blockedById || blockedByAllowlist;
  const direction = operation === "gain" ? definition.gainDirection : definition.spendDirection;
  const multiplier = operation === "gain" ? definition.gainMultiplier : definition.spendMultiplier;
  const requestedDelta = blocked ? 0 : amount * direction * multiplier;
  const remaining = definition.maximum == null ? Math.max(definition.minimum, balance + requestedDelta) : Math.min(definition.maximum, Math.max(definition.minimum, balance + requestedDelta));
  const boundaryClampedGain = operation === "gain" && direction < 0;
  const delta = boundaryClampedGain ? remaining - balance : requestedDelta;
  const available = boundaryClampedGain || delta >= 0 || balance + delta >= definition.minimum;
  return { available, reason: available ? "" : `Недостаточно ресурса «${definition.label}».`, resource, resolvedResource: definition.resource, label: definition.label, amount, balance, remaining, delta, replacement: true, ignored: blocked, ignoredReason: blocked ? `${request.sourceActionName || "Этот источник"} не даёт «${definition.label}».` : "", definition };
}

function ruleResourceStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), definition = actor && ruleResourceDefinition(actor, request.resource);
  const amount = Number(request.amount ?? 0), operation = request.operation === "gain" ? "gain" : "spend";
  if (!actor) return { available: false, reason: "Исполнитель не найден.", resource: String(request.resource || ""), balance: 0, amount: 0, remaining: 0, replaces: [] };
  if (!definition || !Number.isFinite(amount) || amount < 0) return { available: false, reason: "Некорректный альтернативный ресурс.", resource: String(request.resource || ""), balance: 0, amount: 0, remaining: 0, replaces: [] };
  const balance = ruleResourceBalance(actor, definition), delta = amount * (operation === "gain" ? 1 : -1);
  const available = delta >= 0 || balance + delta >= definition.minimum;
  return { available, reason: available ? "" : `Недостаточно ресурса «${definition.label}».`, resource: definition.resource, label: definition.label, balance, amount, remaining: Math.max(definition.minimum, balance + delta), replaces: [...definition.replaces], definition: clone(definition) };
}

function alternateResourceStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId);
  if (actor && ruleResourceDefinition(actor, request.resource)) return ruleResourceStatus(scene, actorId, request);
  const resource = request.resource, amount = Number(request.amount ?? 0), initial = Number(request.initial ?? 0);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", resource: String(resource || ""), balance: 0, amount: 0, remaining: 0, replaces: [] };
  if (typeof resource !== "string" || !resource || !Number.isFinite(amount) || amount < 0 || !Number.isFinite(initial) || initial < 0) return { available: false, reason: "Некорректный альтернативный ресурс.", resource: String(resource || ""), balance: 0, amount: 0, remaining: 0, replaces: [] };
  const stored = actor.alternateResources?.[resource] ?? actor[resource] ?? actor.inventory?.[`resource:${resource}`] ?? initial;
  const balance = Math.max(0, Number(stored) || 0), available = balance >= amount;
  return { available, reason: available ? "" : `Недостаточно ресурса «${request.label || resource}».`, resource, label: request.label || resource, balance, amount, remaining: Math.max(0, balance - amount), replaces: [...new Set((Array.isArray(request.replaces) ? request.replaces : []).filter(value => typeof value === "string"))] };
}

function resetRuleResources(actor, scope) {
  if (!actor || !["scene", "round", "turn"].includes(scope)) return [];
  const resets = [];
  for (const definition of ruleResourceDefinitions(actor).filter(item => item.resetScope === scope)) {
    actor.ruleResources ||= {};
    actor.ruleResources[definition.resource] = { ...definition, value: definition.initial };
    if (definition.legacyProperty) actor[definition.legacyProperty] = definition.initial;
    resets.push({ resource: definition.resource, label: definition.label, value: definition.initial, scope });
  }
  return resets;
}

function stanceStatus(scene, actorId, stanceId, options = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", stanceId: String(stanceId || ""), active: false, current: null, conflicts: [] };
  if (typeof stanceId !== "string" || !stanceId) return { available: false, reason: "Не указана Стойка.", stanceId: "", active: false, current: null, conflicts: [] };
  const current = actor.ruleState?.stance || actor.stance || null;
  const requiredEffects = (Array.isArray(options.requiredEffects) ? options.requiredEffects : []).filter(value => typeof value === "string");
  const missingEffects = requiredEffects.filter(effect => !effectiveEffectsFor(scene, actor).includes(effect));
  const available = !actor.knockedOut && !missingEffects.length;
  return { available, reason: actor.knockedOut ? "Выведенный из строя персонаж не может менять Стойку." : missingEffects.length ? `Не хватает Эффектов: ${missingEffects.join(", ")}.` : "", stanceId, active: current === stanceId, current, conflicts: current && current !== stanceId ? [current] : [], missingEffects };
}

const RULE_MODE_ADAPTERS = [
  {
    techniqueId: "vagabond.master-at-arms",
    minimumLevel: 1,
    groupId: "vagabond.master-at-arms.armament",
    label: "Вооружение",
    maximumEachPerTurn: 1,
    modes: [
      { id: "blade", label: "Клинок" },
      { id: "polearm", label: "Древко" },
      { id: "chain", label: "Цепь" },
    ],
  },
];

function ruleModeDefinitions(actor) {
  if (!actor) return [];
  return RULE_MODE_ADAPTERS.filter(definition => Number(actor.techniques?.[definition.techniqueId] || 0) >= Number(definition.minimumLevel || 1)).map(definition => clone(definition));
}

function ruleModeDefinition(actor, groupId) {
  return ruleModeDefinitions(actor).find(definition => definition.groupId === groupId) || null;
}

function ruleModeStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), groupId = String(request.groupId || ""), modeId = request.modeId == null ? null : String(request.modeId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", groupId, modeId, current: null, used: 0, remaining: 0, modes: [] };
  const definition = ruleModeDefinition(actor, groupId), mode = definition?.modes.find(item => item.id === modeId) || null, current = actor.ruleModes?.[groupId] || null;
  if (!definition || modeId && !mode) return { available: false, reason: "Такой режим правила недоступен персонажу.", groupId, modeId, current: clone(current), used: 0, remaining: 0, modes: clone(definition?.modes || []) };
  const uses = modeId ? currentTurnEvents(scene, actor.id).filter(event => event.type === "rule-mode.set" && event.payload?.groupId === groupId && event.payload?.modeId === modeId).length : 0;
  const maximum = Number(definition.maximumEachPerTurn || 1), available = !actor.knockedOut && (!modeId || uses < maximum);
  return { available, reason: actor.knockedOut ? "Выведенный из строя персонаж не может менять режим." : modeId && uses >= maximum ? `«${mode.label}» уже экипирован в этом Ходу.` : "", groupId, label: definition.label, modeId, mode: clone(mode), current: clone(current), active: current?.modeId === modeId, used: uses, maximum, remaining: Math.max(0, maximum - uses), modes: clone(definition.modes), definition: clone(definition) };
}

function ownedEntities(scene, ownerActorId, options = {}) {
  const owner = actorById(scene, ownerActorId);
  if (!owner) return { available: false, reason: "Владелец не найден.", actors: [], objects: [], markers: [], allIds: [], count: 0 };
  const rulePrefix = typeof options.rulePrefix === "string" ? options.rulePrefix : "", kinds = new Set(Array.isArray(options.kinds) ? options.kinds : []);
  const matches = entity => entity.ownerActorId === ownerActorId && (!rulePrefix || String(entity.ruleId || entity.source || "").startsWith(rulePrefix)) && (!kinds.size || kinds.has(entity.kind || entity.type));
  const actors = (scene.actors || []).filter(actor => actor.id !== ownerActorId && matches(actor)).map(actor => actor.id);
  const objects = (scene.objects || []).filter(matches).map(object => object.id);
  const markers = (scene.markers || []).filter(matches).map(marker => marker.id);
  return { available: true, reason: "", actors, objects, markers, allIds: [...actors, ...objects, ...markers], count: actors.length + objects.length + markers.length };
}

function actionHistoryStatus(scene, actorId, query = {}) {
  if (!actorById(scene, actorId)) return { available: false, reason: "Исполнитель не найден.", count: 0, matched: false, lastEvent: null, targetIds: [] };
  const scope = ["turn", "round", "scene"].includes(query.scope) ? query.scope : "turn";
  const source = scope === "turn" ? currentTurnEvents(scene, actorId) : scope === "round" ? currentRoundEvents(scene) : (scene.log || []);
  const types = new Set(Array.isArray(query.types) ? query.types : ["action.prepare", "action.resolve"]);
  const actionIds = new Set([...(Array.isArray(query.actionIds) ? query.actionIds.map(canonicalActionId) : []), ...(Array.isArray(query.actionKeys) ? query.actionKeys.map(key => ACTION_IDS[key]).filter(Boolean) : []), ...(Array.isArray(query.actionNames) ? query.actionNames.map(canonicalActionId) : [])]);
  const requestedTargets = [...new Set((Array.isArray(query.targetIds) ? query.targetIds : []).filter(value => typeof value === "string"))];
  const events = source.filter(event => {
    if (event.actorId !== actorId || (types.size && !types.has(event.type))) return false;
    const payload = event.payload || {};
    if (actionIds.size && !actionIds.has(canonicalActionId(payload.actionId || payload.actionName || payload.name))) return false;
    if (requestedTargets.length) {
      const eventTargets = new Set([payload.targetId, ...(Array.isArray(payload.targetIds) ? payload.targetIds : [])].filter(Boolean));
      if (!requestedTargets.every(id => eventTargets.has(id))) return false;
    }
    return true;
  });
  const lastEvent = events[0] ? clone(events[0]) : null;
  return { available: true, reason: "", scope, count: events.length, matched: Boolean(events.length), lastEvent, targetIds: requestedTargets };
}

function terrainStatus(scene, request = {}) {
  const actor = actorById(scene, request.actorId), types = new Set(Array.isArray(request.types) ? request.types : ["terrain", "difficult", "custom"]);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", object: null, distance: Infinity, cells: [] };
  const point = request.cell && typeof request.cell === "object" ? cellKey(request.cell) : typeof request.cell === "string" ? request.cell : null;
  const candidates = (scene.objects || []).filter(object => object.space === actor.space && (!types.size || types.has(object.type)) && (!request.ownerOnly || object.ownerActorId === actor.id));
  const object = request.objectId ? candidates.find(item => item.id === request.objectId) : point ? [...candidates].reverse().find(item => (item.cells || []).includes(point)) : null;
  if (!object) return { available: false, reason: "Подходящий элемент местности не найден.", object: null, distance: Infinity, cells: [] };
  const distances = (object.cells || []).map(cell => { const [x, y] = String(cell).split(",").map(Number); return Math.abs(Number(actor.x) - x) + Math.abs(Number(actor.y) - y); }).filter(Number.isFinite);
  const nearest = distances.length ? Math.min(...distances) : Infinity, maximum = Number(request.range ?? Infinity), minimumHp = Number(request.minimumHp ?? 0);
  if (Number.isNaN(maximum) || maximum < 0 || !Number.isFinite(minimumHp) || minimumHp < 0) return { available: false, reason: "Некорректные ограничения местности.", object: clone(object), distance: nearest, cells: [...(object.cells || [])] };
  const available = nearest <= maximum && Number(object.hp ?? object.maxHp ?? 1) >= minimumHp;
  return { available, reason: available ? "" : nearest > maximum ? "Местность находится вне допустимой дальности." : "У местности недостаточно Здоровья.", object: clone(object), distance: nearest, cells: [...(object.cells || [])] };
}

function usageLimitStatus(scene, actorId, query = {}) {
  if (!actorById(scene, actorId)) return { available: false, reason: "Исполнитель не найден.", scope: "scene", maximum: 0, used: 0, remaining: 0, events: [] };
  const scope = ["turn", "round", "scene"].includes(query.scope) ? query.scope : "scene", maximum = Math.max(0, Number(query.maximum || 0));
  if (!Number.isInteger(maximum) || maximum < 1) return { available: false, reason: "Лимит использования должен быть положительным целым числом.", scope, maximum, used: 0, remaining: 0, events: [] };
  const source = scope === "turn" ? currentTurnEvents(scene, actorId) : scope === "round" ? currentRoundEvents(scene) : (scene.log || []);
  const ruleId = String(query.ruleId || ""), types = new Set(Array.isArray(query.types) && query.types.length ? query.types : ["technique.resolve"]);
  const matches = source.filter(event => {
    if (event.actorId !== actorId || !types.has(event.type)) return false;
    if (!ruleId) return true;
    const payload = event.payload || {};
    return [payload.ruleId, payload.sourceActionId, payload.techniqueRuleId].includes(ruleId);
  });
  const used = matches.length, remaining = Math.max(0, maximum - used);
  return { available: remaining > 0, reason: remaining > 0 ? "" : `Лимит использования исчерпан: ${maximum} за ${scope === "turn" ? "Ход" : scope === "round" ? "Раунд" : "Сцену"}.`, scope, maximum, used, remaining, events: clone(matches) };
}

function terrainComponentStatus(scene, request = {}) {
  const space = (scene.spaces || []).find(item => item.id === request.space), types = new Set(Array.isArray(request.types) ? request.types : ["terrain"]);
  if (!space) return { available: false, reason: "Пространство не найдено.", objects: [], objectIds: [], cells: [] };
  const candidates = (scene.objects || []).filter(object => object.space === space.id && (!types.size || types.has(object.type)));
  const seedCells = new Set((request.cells || []).map(String)), seedIds = new Set(request.objectIds || []);
  const selected = new Set(candidates.filter(object => seedIds.has(object.id) || (object.cells || []).some(cell => seedCells.has(String(cell)))).map(object => object.id));
  if (!selected.size) return { available: false, reason: "На исходных клетках нет подходящей местности.", objects: [], objectIds: [], cells: [] };
  const points = object => (object.cells || []).map(spatialPoint).filter(Boolean), diagonal = Boolean(request.diagonal);
  const touches = (left, right) => points(left).some(a => points(right).some(b => diagonal ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1 : Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1));
  const queue = candidates.filter(object => selected.has(object.id));
  while (queue.length) {
    const current = queue.shift();
    for (const candidate of candidates) if (!selected.has(candidate.id) && touches(current, candidate)) {
      selected.add(candidate.id);
      queue.push(candidate);
    }
  }
  const objects = candidates.filter(object => selected.has(object.id));
  return { available: true, reason: "", objects: clone(objects), objectIds: objects.map(object => object.id), cells: [...new Set(objects.flatMap(object => object.cells || []))] };
}
