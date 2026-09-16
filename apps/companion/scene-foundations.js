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
  // Commands that resize an existing clock carry both the stored `max` and
  // the newly requested `size`; the explicit command value must win.
  const size = Math.max(1, Math.min(100, Number(definition.size ?? definition.max ?? 6) || 6));
  const minimum = Math.max(0, Math.min(size, Number(definition.min ?? 0) || 0));
  const initial = Math.max(minimum, Math.min(size, Number(definition.initial ?? minimum) || minimum));
  const value = Math.max(minimum, Math.min(size, Number(definition.current ?? definition.value ?? initial) || initial));
  return {
    clockId: String(definition.clockId || ""),
    id: String(definition.id || definition.clockId || ""),
    kind: "clock",
    label: String(definition.label || definition.clockId || ""),
    size,
    minimumSize: Math.max(1, Math.min(size, Number(definition.minimumSize ?? size) || size)),
    initial,
    value,
    current: value,
    min: minimum,
    max: size,
    threshold: definition.threshold == null ? size : Math.max(minimum, Math.min(size, Number(definition.threshold) || size)),
    resetScope: ["scene", "round", "turn"].includes(definition.resetScope) ? definition.resetScope : null,
    scope: typeof definition.scope === "string" ? definition.scope : definition.resetScope || "manual",
    lifetime: typeof definition.lifetime === "string" ? definition.lifetime : definition.resetScope || "manual",
    ownerActorId: typeof definition.ownerActorId === "string" ? definition.ownerActorId : null,
    sourceActorId: typeof definition.sourceActorId === "string" ? definition.sourceActorId : null,
    sourceEntityId: typeof definition.sourceEntityId === "string" ? definition.sourceEntityId : null,
    ruleId: typeof definition.ruleId === "string" ? definition.ruleId : null,
    active: definition.active !== false,
    removeWhenEmpty: Boolean(definition.removeWhenEmpty),
    legacyTechniqueState: typeof definition.legacyTechniqueState === "string" ? definition.legacyTechniqueState : null,
    techniqueId: typeof definition.techniqueId === "string" ? definition.techniqueId : null,
  };
}

function ruleClockDefinitions(actor) {
  if (!actor) return [];
  const owned = definition => ({ ...normalizeRuleClockDefinition(definition), ownerActorId: actor.id, sourceActorId: definition.sourceActorId || actor.id });
  const definitions = RULE_CLOCK_ADAPTERS
    .filter(definition => Number(actor.techniques?.[definition.techniqueId] || 0) >= Number(definition.minimumLevel || 1))
    .map(owned);
  for (const [clockId, stored] of Object.entries(actor.ruleClocks || {})) {
    if (stored == null) continue;
    const normalized = owned(typeof stored === "object" ? { clockId, ...stored } : { clockId, label: clockId, size: 6, initial: 0 });
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
  const raw = typeof stored === "object" ? stored.current ?? stored.value : stored ?? legacy ?? definition.initial;
  return Math.max(definition.min ?? 0, Math.min(definition.max ?? definition.size, Number(raw) || 0));
}

function clockStatus(scene, actorId, clockId, options = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", id: clockId || "", size: 0, value: 0, nextValue: 0, remaining: 0, empty: true, full: false, active: false };
  let definition = ruleClockDefinition(actor, clockId);
  if (!definition && options.size != null) definition = { ...normalizeRuleClockDefinition({ clockId, label: options.label || clockId, size: options.size, initial: options.initial, active: options.active }), ownerActorId: actor.id, sourceActorId: actor.id };
  const delta = Number(options.delta ?? 0);
  if (!definition || !/^[a-z][a-z0-9.-]{0,79}$/.test(String(clockId || "")) || !Number.isFinite(delta)) return { available: false, reason: "Некорректные параметры часов.", id: String(clockId || ""), size: 0, value: 0, nextValue: 0, remaining: 0, empty: true, full: false, active: false };
  const stored = actor.ruleClocks?.[clockId], active = typeof stored === "object" && typeof stored.active === "boolean" ? stored.active : definition.active;
  const value = ruleClockValue(actor, definition), nextValue = Math.max(definition.min ?? 0, Math.min(definition.max ?? definition.size, value + delta));
  return { available: true, reason: "", id: clockId, kind: definition.kind, label: definition.label, size: definition.size, min: definition.min ?? 0, max: definition.max ?? definition.size, minimumSize: definition.minimumSize, value, current: value, nextValue, remaining: definition.size - nextValue, empty: nextValue === (definition.min ?? 0), full: nextValue === (definition.max ?? definition.size), active, definition: clone(definition) };
}

function resetRuleClocks(actor, scope) {
  if (!actor || !["scene", "round", "turn"].includes(scope)) return [];
  const resets = [];
  for (const definition of ruleClockDefinitions(actor).filter(item => item.resetScope === scope)) {
    actor.ruleClocks ||= {};
    actor.ruleClocks[definition.clockId] = { ...definition, value: definition.initial, current: definition.initial, initial: definition.initial, active: definition.active };
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
  if ((actor.gifts || []).includes("cursed.the-voice") && request.scope === "challenge" && request.usesAbility && !request.usesSkill) {
    if (selected.has("cursed.the-voice.agree")) hooks.push({ type: "advantage", ruleId: "cursed.the-voice", label: "Голос согласен", amount: 2 });
    if (selected.has("cursed.the-voice.disagree")) hooks.push({ type: "hindrance", ruleId: "cursed.the-voice", label: "Голос не согласен", amount: 2 });
  }
  if (["skirmish", "spell", "finish"].some(key => actionIdIs(actionId, key)) && Array.isArray(request.targetIds) && request.targetIds.length) {
    const levelAt = target => { const key=cellKey(target),types=(scene.objects||[]).filter(object=>object.space===target.space&&(object.cells||[]).includes(key)).map(object=>object.type);return types.includes("high")?1:types.includes("low")?-1:0 }, targets=request.targetIds.map(id=>actorById(scene,id)).filter(Boolean),sourceLevel=levelAt(actor),targetLevels=[...new Set(targets.map(levelAt))];
    if(targets.length===request.targetIds.length&&targetLevels.length===1&&sourceLevel!==targetLevels[0])hooks.push({type:sourceLevel>targetLevels[0]?"advantage":"hindrance",ruleId:"battlefield.elevation",label:sourceLevel>targetLevels[0]?"Атака сверху":"Атака снизу",amount:Number(actor.tier||1)});
  }
  return hooks;
}

function diceHookStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", hooks: [], sources: [], advantage: 0, hindrance: 0, count: 0, threshold: 4, criticalAt: 6 };
  const actionId = canonicalActionId(request.actionId || request.actionName || "");
  const explicit = Array.isArray(request.hooks) ? request.hooks.map(normalizeDiceHook) : [];
  if (explicit.some(hook => !hook)) return { available: false, reason: "В броске передан неподдерживаемый хук кубов.", hooks: [], sources: [], advantage: 0, hindrance: 0, count: 0, threshold: 4, criticalAt: 6 };
  const hooks = [...passiveDiceHooks(scene, actor, request), ...explicit], attributeHook = [...hooks].reverse().find(hook => hook.type === "attribute");
  const thresholdHook = [...hooks].reverse().find(hook => hook.type === "success-threshold"), criticalHook = [...hooks].reverse().find(hook => hook.type === "critical-at");
  const manualAdvantage = Math.max(0, Math.min(99, Number(request.advantage || 0))), manualHindrance = Math.max(0, Math.min(99, Number(request.hindrance || 0)));
  const advantage = manualAdvantage + hooks.filter(hook => hook.type === "advantage").reduce((sum, hook) => sum + hook.amount, 0);
  const hindrance = manualHindrance + hooks.filter(hook => hook.type === "hindrance").reduce((sum, hook) => sum + hook.amount, 0);
  const rawBaseCount = request.baseCount == null ? null : Number(request.baseCount), count = rawBaseCount == null ? null : Math.max(1, Math.min(300, rawBaseCount + advantage - hindrance));
  const sources = hooks.filter(hook => ["advantage", "hindrance", "attribute", "success-threshold", "critical-at", "all-dice-succeed", "successes-invert"].includes(hook.type));
  return { available: true, reason: "", actorId: actor.id, scope: String(request.scope || "roll"), actionId, sceneContext: request.sceneContext !== false, baseCount: rawBaseCount, count, advantage, hindrance, manualAdvantage, manualHindrance, attribute: attributeHook?.value || request.attribute || null, threshold: thresholdHook?.value || Math.max(2, Math.min(6, Number(request.threshold || 4))), criticalAt: criticalHook?.value || Math.max(2, Math.min(6, Number(request.criticalAt || 6))), usesAbility: Boolean(request.usesAbility), usesSkill: Boolean(request.usesSkill), abilityKey: request.abilityKey || null, selectedHookIds: [...new Set(Array.isArray(request.selectedHookIds) ? request.selectedHookIds.map(String) : [])], targetIds: [...new Set(Array.isArray(request.targetIds) ? request.targetIds.map(String) : [])], explicitHooks: explicit, hooks, sources, sideBalance: request.sceneContext === false ? { available: true, enemies: 0, allies: 0, outnumbered: false, enemyIds: [], allyIds: [] } : sideBalanceStatus(scene, actor.id) };
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
  const dice = { scope: status.scope, actionId: status.actionId, sceneContext: status.sceneContext, baseCount: status.baseCount, count: status.count, advantage: status.advantage, hindrance: status.hindrance, manualAdvantage: status.manualAdvantage, manualHindrance: status.manualHindrance, attribute: status.attribute, threshold: status.threshold, criticalAt: status.criticalAt, usesAbility: status.usesAbility, usesSkill: status.usesSkill, abilityKey: status.abilityKey, selectedHookIds: status.selectedHookIds, targetIds: status.targetIds, explicitHooks: clone(status.explicitHooks), hooks: clone(status.hooks), sources: clone(status.sources) };
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
  const minimum = Math.max(0, Number(definition.min ?? definition.minimum ?? 0) || 0), maximum = definition.max === null || definition.maximum === null ? null : definition.max != null || definition.maximum != null ? Math.max(minimum, Number(definition.max ?? definition.maximum) || 0) : null;
  const current = Math.max(minimum, Math.min(maximum ?? 9999, Number(definition.current ?? definition.value ?? initial) || initial));
  const replaces = Array.isArray(definition.replaces) ? definition.replaces : definition.replaces == null ? [] : [definition.replaces];
  return {
    resource: String(definition.resource || ""),
    id: String(definition.id || definition.resource || ""),
    kind: "resource",
    label: String(definition.label || definition.resource || ""),
    initial: Math.max(0, Number.isFinite(initial) ? initial : 0),
    minimum,
    min: minimum,
    maximum,
    max: maximum,
    value: current,
    current,
    threshold: definition.threshold == null ? maximum : Math.max(minimum, Math.min(maximum ?? 9999, Number(definition.threshold) || maximum || minimum)),
    ownerActorId: typeof definition.ownerActorId === "string" ? definition.ownerActorId : actor?.id || null,
    sourceActorId: typeof definition.sourceActorId === "string" ? definition.sourceActorId : actor?.id || null,
    sourceEntityId: typeof definition.sourceEntityId === "string" ? definition.sourceEntityId : null,
    ruleId: typeof definition.ruleId === "string" ? definition.ruleId : null,
    scope: typeof definition.scope === "string" ? definition.scope : definition.resetScope || "manual",
    lifetime: typeof definition.lifetime === "string" ? definition.lifetime : definition.resetScope || "manual",
    replaces: [...new Set(replaces.filter(resource => RESOURCES.has(resource)))],
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
    sourceRuleId: "vagabond.master-at-arms.1",
    sourceDigest: "d35f468065e84fbb0c86bc60015632bdbcfe9b0ced2ed2cfa370453f64a72371",
    actionId: ACTION_IDS.skirmish,
    stateScope: "scene",
    maximumEachPerTurn: 1,
    modes: [
      { id: "blade", label: "Клинок", condition: { distance: 2, targetCount: { min: 1, max: 2 }, adjacentToOwner: false, moveBeforeTarget: { exact: 1 } }, modifiers: { swift: true }, postOperations: [{ type: "effect", effect: "positive.усилен", target: "self", timing: "after-resolve" }] },
      { id: "polearm", label: "Древко", condition: { targetCount: { exact: 2 }, adjacentTargets: true }, modifiers: { swift: true }, postOperations: [{ type: "displacement", mode: "push", maximum: 3, target: "targets", timing: "after-damage" }, { type: "effect", effect: "negative.подброшен", target: "targets", timing: "after-resolve" }] },
      { id: "chain", label: "Цепь", condition: { distance: 4, targetCount: { exact: 1 } }, modifiers: { swift: true, range: 4 }, postOperations: [{ type: "effect", effect: "negative.разорван", target: "targets", timing: "after-resolve" }] },
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

// Serializable contract consumed by action preparation and resolution. The
// contract is deliberately generic so future forms and stances can register
// their own modes without adding technique-specific reducer branches.
function ruleModeContract(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), groupId = String(request.groupId || ""), modeId = request.modeId == null ? null : String(request.modeId);
  const definition = ruleModeDefinition(actor, groupId), mode = definition?.modes.find(item => item.id === modeId) || null;
  if (!actor || !definition || !mode) return { available: false, reason: "Режим правила не найден.", groupId, modeId, mode: null };
  const turnSerial = Number(scene.turnSerial || 0), uses = currentTurnEvents(scene, actor.id).filter(event => event.type === "rule-mode.set" && event.payload?.groupId === groupId && event.payload?.modeId === modeId).length;
  const maximum = Number(definition.maximumEachPerTurn || 1);
  return { available: !actor.knockedOut && uses < maximum, reason: actor.knockedOut ? "Выведенный из строя персонаж не может менять режим." : uses >= maximum ? `«${mode.label}» уже использован в этом Ходу.` : "", groupId, modeId, label: mode.label, sourceRuleId: definition.sourceRuleId, sourceDigest: definition.sourceDigest, actionId: definition.actionId, stateScope: definition.stateScope, modifiers: clone(mode.modifiers || {}), condition: clone(mode.condition || {}), postOperations: clone(mode.postOperations || []), receipt: { schema: 1, key: `${actor.id}:${groupId}:${modeId}:${turnSerial}`, turnSerial, useIndex: uses + 1 } };
}

function ruleModeState(actor, groupId) {
  const value = actor?.ruleModes?.[groupId];
  return value && typeof value === "object" ? clone(value) : null;
}

function serializeRuleModeState(actor, groupId) {
  const value = ruleModeState(actor, groupId);
  return value ? { schema: 1, groupId: String(groupId || ""), ...value } : null;
}

function clearRuleModeState(actor, groupId) {
  if (!actor?.ruleModes || typeof groupId !== "string" || !Object.hasOwn(actor.ruleModes, groupId)) return false;
  delete actor.ruleModes[groupId];
  return true;
}

function ruleModeStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId), groupId = String(request.groupId || ""), modeId = request.modeId == null ? null : String(request.modeId);
  if (!actor) return { available: false, reason: "Исполнитель не найден.", groupId, modeId, current: null, used: 0, remaining: 0, modes: [] };
  const definition = ruleModeDefinition(actor, groupId), mode = definition?.modes.find(item => item.id === modeId) || null, current = ruleModeState(actor, groupId);
  if (!definition || modeId && !mode) return { available: false, reason: "Такой режим правила недоступен персонажу.", groupId, modeId, current: clone(current), used: 0, remaining: 0, modes: clone(definition?.modes || []) };
  const uses = modeId ? currentTurnEvents(scene, actor.id).filter(event => event.type === "rule-mode.set" && event.payload?.groupId === groupId && event.payload?.modeId === modeId).length : 0;
  const maximum = Number(definition.maximumEachPerTurn || 1), available = !actor.knockedOut && (!modeId || uses < maximum);
  return { available, reason: actor.knockedOut ? "Выведенный из строя персонаж не может менять режим." : modeId && uses >= maximum ? `«${mode.label}» уже экипирован в этом Ходу.` : "", groupId, label: definition.label, modeId, mode: clone(mode), current: clone(current), active: current?.modeId === modeId, used: uses, maximum, remaining: Math.max(0, maximum - uses), modes: clone(definition.modes), definition: clone(definition), contract: modeId ? ruleModeContract(scene, actor.id, { groupId, modeId }) : null };
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

// Generic, read-only boundary bridge used by the LionWing writer. Adapters
// may quote a plan, but they never get to pass state or an executable object
// graph into the authoritative reducer. Keep this contract here because it is
// the small, edition-neutral seam between the adapter registry and the engine.
(function installLionwingFoundationBridge(root) {
  const BRIDGE_SCHEMA = 2;
  const boundaries = new Set(["sceneStart", "sceneEnd", "roundStart", "roundEnd", "ownTurnStart", "ownTurnEnd", "anyTurnStart", "anyTurnEnd"]);
  const aliases = { turnStart: "ownTurnStart", turnEnd: "ownTurnEnd", scene: "sceneStart", round: "roundStart", turn: "ownTurnStart" };
  const forbiddenKeys = new Set([
    "actor", "actorstate", "actorsnapshot", "copiedactor", "client", "clientstate", "clientsnapshot", "clientflags", "flags", "confirmed",
    "payload", "request", "snapshot", "provenance", "execution", "worldstate", "scenegraph", "state", "before", "after",
  ]);
  const operationKinds = new Set([
    "breacher-push", "chemist-health-check", "clock", "configure-resource", "damage", "derived-action", "detective-finisher-open",
    "effect-source", "effect", "forced-away", "forced-towards-group", "forced-towards", "heal", "inventory", "marker-remove",
    "martial-quick-step", "modifier", "move", "note", "resource", "shatter-check", "skirmisher-shift", "usage",
  ]);
  const commonOperationKeys = new Set([
    "kind", "id", "targetId", "targetIds", "sourceActorId", "ownerActorId", "sourceId", "sourceDigest", "ruleId", "sourceActionId",
    "actionId", "actionEventId", "actionInstanceId", "triggerKey", "label", "coverage", "reason", "techniqueId", "techniqueRuleId",
    "techniqueSourceDigest", "causeEventId", "frightenedEventId", "studyTargetId", "dazeTargetId", "lineage", "boundary", "lifetime",
  ]);
  const operationKeys = {
    "breacher-push": ["maximum", "initialDistance"],
    "chemist-health-check": [],
    clock: ["operation", "label", "size", "value", "max", "min", "current", "initial", "resetAt", "scope", "delta", "threshold", "active", "removeWhenEmpty", "minimumSize", "legacyTechniqueState"],
    "configure-resource": ["label", "current", "initial", "scope", "replaces", "replacesAp", "inverted"],
    damage: ["amount", "fixedDamage", "finalDamage", "attack", "irreducible", "ignoreArmor", "ignoreEvasion", "criticals", "reduction", "temporaryArmor", "effects"],
    "derived-action": ["damageAttribute"],
    "detective-finisher-open": [],
    "effect-source": ["operation", "effect"],
    effect: ["effect", "duration", "remove"],
    "forced-away": ["maximum", "initialDistance"],
    "forced-towards-group": ["filter"],
    "forced-towards": ["maximum", "initialDistance", "filter"],
    heal: ["amount"],
    inventory: ["operation", "inventoryKind", "current", "initial", "minimum", "maximum", "resetAt", "visibility", "unique", "multiple", "replacementGroup", "level", "alternateResource", "labelI18n", "items", "instanceId", "amount", "selectedItemId", "mode", "editionId"],
    "marker-remove": ["markerId"],
    "martial-quick-step": ["maximum", "evasion"],
    modifier: ["stat", "amount", "duration"],
    move: ["maximum", "forced"],
    note: ["note"],
    resource: ["resource", "operation", "amount", "studyTargetId", "daze", "dazeTargetId"],
    "shatter-check": [],
    "skirmisher-shift": ["maximum"],
    usage: ["scope", "limit", "oncePerTarget"],
  };
  const choiceKeys = new Set(["id", "label", "operations", "context"]);
  const contextKeys = new Set([
    "targetId", "targetIds", "sourceActorId", "ownerActorId", "eventId", "causeEventId", "actionInstanceId", "studyEventId", "frightenedEventId",
    "attribute", "destinationRequired", "maximum", "markerId", "drainId", "fearedActorIds", "filled", "full", "manualRemainder", "verse",
    "choiceSet", "optional", "boundary", "boundaryKey", "sourceDigest", "coverage", "followupId", "followup", "mandatory", "deadline",
  ]);
  const declarationKeys = new Set(["id", "ruleId", "label", "sourceDigest", "coverage", "operations", "choices", "ownerActorId", "choiceSet", "optional", "triggerKey", "followUp", "followup"]);
  const followUpKeys = new Set(["id", "ownerActorId", "sourceActorId", "participantIds", "participants", "endBoundary", "deadline", "cancelOn", "optional", "completionOperations", "completeOperations"]);
  const cancelReasons = new Set(["damage", "knockout", "sourceLoss"]);
  const lifetimeBoundaries = new Set([...boundaries, "endNextOwnerTurn", "startNextOwnerTurn", "intermission", "manual", "scene", "round", "turn"]);
  const aliasesForKey = value => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isPlain = isRecord;
  const text = (value, max = 240) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
  const id = value => text(value, 180) && /^[a-z0-9][a-z0-9._:-]*$/i.test(value);
  // Action names are edition data and may contain Cyrillic (the current
  // LionWing action IDs do). They still must be a single bounded token.
  const token = value => text(value, 180) && !/[\s\u0000-\u001f]/u.test(value);
  const digest = value => text(value, 240) && (/^[a-f0-9]{64}$/i.test(value) || /^[a-z][a-z0-9_-]{1,31}:[a-z0-9][a-z0-9._:/-]{1,199}$/i.test(value));
  const safeInteger = (value, min = -9999, max = 9999) => Number.isSafeInteger(value) && value >= min && value <= max;
  const keyAllowed = (key, allowed) => allowed.has(key) && !forbiddenKeys.has(aliasesForKey(key));
  const fail = reason => ({ ok: false, manual: true, code: "LIONWING_FOUNDATION_REJECTED", reason });

  // Walk every adapter value before it is copied. This also prevents a
  // hostile adapter from handing the engine functions, symbols, BigInts, a
  // cycle, or an unexpectedly deep object graph.
  const safeValue = (value, path = "value", seen = new Set(), depth = 0) => {
    if (depth > 8) return { ok: false, reason: `Слишком глубокое значение в ${path}.` };
    if (value == null || typeof value === "string" || typeof value === "boolean") return { ok: true };
    if (typeof value === "number") return Number.isFinite(value) && Number.isSafeInteger(value) && Math.abs(value) <= 1000000
      ? { ok: true } : { ok: false, reason: `Некорректное число в ${path}.` };
    if (typeof value !== "object") return { ok: false, reason: `Неподтверждённое значение в ${path}.` };
    if (seen.has(value)) return { ok: false, reason: `Циклическое значение в ${path}.` };
    seen.add(value);
    const entries = Array.isArray(value) ? value.map((child, index) => [`${index}`, child]) : Object.entries(value);
    for (const [key, child] of entries) {
      if (!Array.isArray(value) && forbiddenKeys.has(aliasesForKey(key))) return { ok: false, reason: `Неподтверждённое состояние клиента в ${path}.${key}.` };
      const result = safeValue(child, `${path}.${key}`, seen, depth + 1);
      if (!result.ok) return result;
    }
    seen.delete(value);
    return { ok: true };
  };
  const clone = (value, seen = new Map()) => {
    if (value == null || typeof value !== "object") return value;
    if (seen.has(value)) throw new Error("Циклическое значение не может попасть в декларацию.");
    const result = Array.isArray(value) ? [] : {};
    seen.set(value, result);
    for (const [key, child] of Object.entries(value)) result[key] = clone(child, seen);
    seen.delete(value);
    return result;
  };
  const normalizeBoundary = value => {
    const canonical = aliases[String(value || "")] || String(value || "");
    return boundaries.has(canonical) ? canonical : null;
  };
  const boundaryDescriptor = (context = {}) => {
    const boundary = normalizeBoundary(context.canonicalBoundary || context.boundary);
    if (!boundary) return { available: false, reason: "Неизвестная граница жизненного цикла.", boundary: null, periodKey: null };
    const sceneSerial = Number(context.sceneSerial ?? context.scene?.lionwing?.sceneSerial ?? context.scene?.sceneSerial ?? 0);
    const round = Number(context.round ?? context.scene?.round ?? 0);
    const ownerActorId = context.ownerActorId || context.actor?.id || null;
    const ownerTurnSerial = Number(context.ownerTurnSerial ?? context.actor?.lionwing?.ownTurnSerial ?? 0);
    const ownerTurnInstanceId = context.ownerTurnInstanceId || null;
    if (![sceneSerial, round, ownerTurnSerial].every(value => Number.isSafeInteger(value) && value >= 0)) return { available: false, reason: "Состояние границы жизненного цикла не подтверждено.", boundary: null, periodKey: null };
    if (ownerActorId != null && !id(ownerActorId)) return { available: false, reason: "Владелец границы жизненного цикла не подтверждён.", boundary: null, periodKey: null };
    if (ownerTurnInstanceId != null && !id(ownerTurnInstanceId)) return { available: false, reason: "Идентификатор Хода не подтверждён.", boundary: null, periodKey: null };
    let periodKey = `${sceneSerial}:${boundary}`;
    if (boundary === "roundStart" || boundary === "roundEnd") periodKey = `${sceneSerial}:${round}:${boundary}`;
    if (boundary === "ownTurnStart" || boundary === "ownTurnEnd") periodKey = `${sceneSerial}:${ownerActorId || "unknown"}:${ownerTurnSerial}:${boundary}`;
    if (boundary === "anyTurnStart" || boundary === "anyTurnEnd") periodKey = `${sceneSerial}:${ownerTurnInstanceId || context.activeTurnInstanceId || "unknown"}:${boundary}`;
    return { available: true, reason: "", boundary, sceneSerial, round, ownerActorId, ownerTurnSerial, ownerTurnInstanceId, periodKey };
  };
  const checkScalar = (value, field, options = {}) => {
    if (value == null) return null;
    if (options.kind === "id" && !id(value)) return `Поле ${field} должно быть идентификатором.`;
    if (options.kind === "token" && !token(value)) return `Поле ${field} должно быть одним идентификатором.`;
    if (options.kind === "digest" && !digest(value)) return `Поле ${field} не содержит подтверждённый sourceDigest.`;
    if (options.kind === "text" && !text(value, options.max || 240)) return `Поле ${field} должно быть коротким текстом.`;
    if (options.kind === "integer" && !safeInteger(value, options.min ?? -9999, options.max ?? 9999)) return `Поле ${field} содержит недопустимое число.`;
    if (options.kind === "boolean" && typeof value !== "boolean") return `Поле ${field} должно быть булевым.`;
    return null;
  };
  const lifetimeSafe = (value, field) => {
    if (value == null || typeof value === "string") return value == null || text(value, 80) ? null : `Поле ${field} содержит недопустимый срок.`;
    if (!isRecord(value)) return `Поле ${field} содержит неподтверждённый срок.`;
    const allowed = new Set(["boundary", "ownerActorId", "ownerTurnSerial", "ownerTurnInstanceId", "sceneSerial"]);
    for (const key of Object.keys(value)) if (!allowed.has(key)) return `Поле ${field}.${key} не разрешено.`;
    if (value.boundary != null && !lifetimeBoundaries.has(String(value.boundary))) return `Поле ${field}.boundary не разрешено.`;
    if (value.ownerActorId != null && !id(value.ownerActorId)) return `Поле ${field}.ownerActorId не подтверждено.`;
    if (value.ownerTurnInstanceId != null && !id(value.ownerTurnInstanceId)) return `Поле ${field}.ownerTurnInstanceId не подтверждено.`;
    if (value.ownerTurnSerial != null && !safeInteger(value.ownerTurnSerial, 0, 1000000)) return `Поле ${field}.ownerTurnSerial не подтверждено.`;
    if (value.sceneSerial != null && !safeInteger(value.sceneSerial, 0, 1000000)) return `Поле ${field}.sceneSerial не подтверждено.`;
    return null;
  };
  const validateOperation = (operation, owner, parent, path) => {
    if (!isRecord(operation) || !operationKinds.has(operation.kind)) return fail(`Операция ${path} имеет неподдерживаемую форму.`);
    const allowed = new Set([...commonOperationKeys, ...(operationKeys[operation.kind] || [])]);
    for (const key of Object.keys(operation)) if (!keyAllowed(key, allowed)) return fail(`Поле ${path}.${key} не разрешено для операции ${operation.kind}.`);
    const safe = safeValue(operation, path);
    if (!safe.ok) return fail(safe.reason);
    const fields = [
      ["id", "id"], ["targetId", "id"], ["sourceActorId", "id"], ["ownerActorId", "id"], ["sourceId", "id"], ["sourceActionId", "token"],
      ["actionId", "token"], ["actionEventId", "id"], ["actionInstanceId", "id"], ["triggerKey", "text"], ["techniqueId", "token"], ["techniqueRuleId", "token"],
      ["causeEventId", "id"], ["frightenedEventId", "id"], ["studyTargetId", "id"], ["dazeTargetId", "id"], ["ruleId", "id"], ["sourceDigest", "digest"], ["techniqueSourceDigest", "digest"],
      ["label", "text"], ["coverage", "text"], ["reason", "text"], ["resource", "text"], ["operation", "text"], ["effect", "text"], ["duration", "text"],
      ["stat", "text"], ["markerId", "id"], ["inventoryKind", "text"], ["editionId", "text"], ["resetAt", "text"], ["scope", "text"], ["boundary", "text"],
      ["maximum", "integer"], ["initialDistance", "integer"], ["amount", "integer"], ["delta", "integer"], ["evasion", "integer"], ["size", "integer"], ["value", "integer"],
      ["max", "integer"], ["min", "integer"], ["current", "integer"], ["initial", "integer"], ["threshold", "integer"], ["minimumSize", "integer"],
      ["level", "integer"], ["minimum", "integer"], ["maximum", "integer"], ["fixedDamage", "boolean"], ["finalDamage", "boolean"], ["attack", "boolean"],
      ["irreducible", "boolean"], ["ignoreArmor", "boolean"], ["ignoreEvasion", "boolean"], ["active", "boolean"], ["removeWhenEmpty", "boolean"], ["replacesAp", "boolean"],
      ["inverted", "boolean"], ["unique", "boolean"], ["multiple", "boolean"], ["forced", "boolean"], ["daze", "boolean"], ["remove", "boolean"], ["oncePerTarget", "boolean"],
    ];
    for (const [field, kind] of fields) {
      const problem = checkScalar(operation[field], `${path}.${field}`, kind === "id" ? { kind: "id" } : kind === "token" ? { kind: "token" } : kind === "digest" ? { kind: "digest" } : kind === "integer" ? { kind: "integer", min: -1000000, max: 1000000 } : { kind });
      if (problem) return fail(problem);
    }
    if (operation.targetIds != null && (!Array.isArray(operation.targetIds) || !operation.targetIds.length || operation.targetIds.length > 32 || operation.targetIds.some(value => !id(value)))) return fail(`Поле ${path}.targetIds не подтверждено.`);
    if (operation.lineage != null && (!Array.isArray(operation.lineage) || operation.lineage.length > 16 || operation.lineage.some(value => !id(value)))) return fail(`Поле ${path}.lineage не подтверждено.`);
    if (operation.items != null && (!Array.isArray(operation.items) || operation.items.length > 64 || operation.items.some(value => !text(value, 120)))) return fail(`Поле ${path}.items не подтверждено.`);
    if (operation.fearedActorIds != null && (!Array.isArray(operation.fearedActorIds) || operation.fearedActorIds.length > 32 || operation.fearedActorIds.some(value => !id(value)))) return fail(`Поле ${path}.fearedActorIds не подтверждено.`);
    if (operation.labelI18n != null && (!isRecord(operation.labelI18n) || Object.values(operation.labelI18n).some(value => !text(value, 300)))) return fail(`Поле ${path}.labelI18n не подтверждено.`);
    if (operation.effects != null && (!Array.isArray(operation.effects) || operation.effects.length > 32 || operation.effects.some(value => !text(value, 120)))) return fail(`Поле ${path}.effects не подтверждено.`);
    for (const [field, limit] of [["replaces", 120], ["alternateResource", 120], ["replacementGroup", 120], ["selectedItemId", 180], ["mode", 80]]) if (operation[field] != null && !text(operation[field], limit)) return fail(`Поле ${path}.${field} не подтверждено.`);
    for (const field of ["reduction", "temporaryArmor"]) if (operation[field] != null && !safeInteger(operation[field], -1000000, 1000000)) return fail(`Поле ${path}.${field} не подтверждено.`);
    const lifetimeProblem = lifetimeSafe(operation.lifetime, `${path}.lifetime`);
    if (lifetimeProblem) return fail(lifetimeProblem);
    if (operation.filter != null) {
      if (!isRecord(operation.filter) || Object.keys(operation.filter).some(key => !["team", "effect"].includes(key)) || (operation.filter.team != null && !text(operation.filter.team, 40)) || (operation.filter.effect != null && !text(operation.filter.effect, 120))) return fail(`Поле ${path}.filter не подтверждено.`);
    }
    if (operation.ruleId != null && operation.ruleId !== parent.id && !String(operation.ruleId).startsWith(`${parent.id}.`)) return fail(`Операция ${path} принадлежит другому ruleId.`);
    if (operation.sourceDigest != null && operation.sourceDigest !== parent.sourceDigest) return fail(`Операция ${path} содержит чужой sourceDigest.`);
    if (operation.techniqueSourceDigest != null && operation.techniqueSourceDigest !== parent.sourceDigest) return fail(`Операция ${path} содержит неподтверждённый techniqueSourceDigest.`);
    if (operation.sourceActorId != null && operation.sourceActorId !== owner.id) return fail(`Операция ${path} содержит чужого sourceActorId.`);
    if (operation.ownerActorId != null && operation.ownerActorId !== owner.id && !(operation.kind === "effect" && operation.ownerActorId === operation.targetId)) return fail(`Операция ${path} содержит чужого ownerActorId.`);
    if (operation.kind === "note" && !text(operation.note, 500)) return fail(`Операция ${path} требует короткую заметку.`);
    if (operation.kind === "resource" && (!id(operation.targetId) || !text(operation.resource, 80) || !text(operation.operation, 40) || !safeInteger(operation.amount, -1000000, 1000000))) return fail(`Ресурсная операция ${path} не подтверждена.`);
    if (["configure-resource", "clock", "inventory"].includes(operation.kind) && (!id(operation.targetId) || !id(operation.id))) return fail(`Операция ${path} требует подтверждённый targetId и id.`);
    if (["effect", "effect-source", "modifier", "heal", "damage", "move", "breacher-push", "chemist-health-check", "detective-finisher-open", "forced-away", "forced-towards", "forced-towards-group", "martial-quick-step", "shatter-check", "skirmisher-shift", "marker-remove"].includes(operation.kind) && !id(operation.targetId)) return fail(`Операция ${path} требует подтверждённый targetId.`);
    if (operation.kind === "derived-action" && (!Array.isArray(operation.targetIds) || !operation.targetIds.length)) return fail(`Операция ${path} требует targetIds.`);
    if (operation.kind === "usage" && (!Array.isArray(operation.targetIds) || !operation.targetIds.length || !text(operation.scope, 80))) return fail(`Операция ${path} требует scope и targetIds.`);
    if (operation.kind === "effect-source" && (!id(operation.sourceId) || !text(operation.effect, 120) || !text(operation.operation, 40))) return fail(`Операция ${path} требует источник Эффекта.`);
    // Keep optional operation metadata absent when the adapter omitted it.
    // The engine adds provenance at the write boundary; manufacturing a
    // ruleId here would turn an otherwise ordinary boundary resource into a
    // special technique mutation (for example, Siren's cause-event gate).
    return { ok: true, value: clone(operation) };
  };
  const validateContext = (context, owner, parent, path) => {
    if (context == null) return { ok: true, value: undefined };
    if (!isRecord(context)) return fail(`Контекст ${path} не подтверждён.`);
    for (const key of Object.keys(context)) if (!keyAllowed(key, contextKeys)) return fail(`Поле ${path}.${key} не разрешено.`);
    const safe = safeValue(context, path);
    if (!safe.ok) return fail(safe.reason);
    for (const [field, kind] of [["targetId", "id"], ["sourceActorId", "id"], ["ownerActorId", "id"], ["eventId", "id"], ["causeEventId", "id"], ["actionInstanceId", "id"], ["studyEventId", "id"], ["frightenedEventId", "id"], ["markerId", "id"], ["drainId", "id"], ["followupId", "id"], ["sourceDigest", "digest"], ["coverage", "text"], ["attribute", "text"], ["boundary", "text"], ["boundaryKey", "text"], ["manualRemainder", "text"], ["verse", "id"]]) {
      const problem = checkScalar(context[field], `${path}.${field}`, { kind });
      if (problem) return fail(problem);
    }
    for (const field of ["targetIds", "fearedActorIds"]) if (context[field] != null && (!Array.isArray(context[field]) || context[field].length > 32 || context[field].some(value => !id(value)))) return fail(`Поле ${path}.${field} не подтверждено.`);
    if (context.sourceActorId != null && context.sourceActorId !== owner.id) return fail(`Контекст ${path} содержит чужого sourceActorId.`);
    if (context.ownerActorId != null && context.ownerActorId !== owner.id) return fail(`Контекст ${path} содержит чужого ownerActorId.`);
    if (context.sourceDigest != null && context.sourceDigest !== parent.sourceDigest) return fail(`Контекст ${path} содержит чужой sourceDigest.`);
    if (context.deadline != null && (!isRecord(context.deadline) || Object.keys(context.deadline).some(key => key !== "boundary") || !normalizeBoundary(context.deadline.boundary))) return fail(`Контекст ${path}.deadline не подтверждён.`);
    if (context.maximum != null && !safeInteger(context.maximum, 0, 1000000)) return fail(`Контекст ${path}.maximum не подтверждён.`);
    for (const field of ["destinationRequired", "filled", "full", "choiceSet", "optional", "followup", "mandatory"]) if (context[field] != null && typeof context[field] !== "boolean") return fail(`Контекст ${path}.${field} должен быть булевым.`);
    return { ok: true, value: clone(context) };
  };
  const validateChoice = (choice, owner, parent, path) => {
    if (!isRecord(choice) || !id(choice.id) || !Array.isArray(choice.operations) || choice.operations.length > 192) return fail(`Вариант ${path} имеет неподдерживаемую форму.`);
    for (const key of Object.keys(choice)) if (!choiceKeys.has(key)) return fail(`Поле ${path}.${key} не разрешено.`);
    if (choice.label != null && !text(choice.label, 300)) return fail(`Вариант ${path}.label не подтверждён.`);
    const operations = [];
    for (let index = 0; index < choice.operations.length; index++) {
      const result = validateOperation(choice.operations[index], owner, parent, `${path}.operations[${index}]`);
      if (!result.ok) return result;
      operations.push(result.value);
    }
    const context = validateContext(choice.context, owner, parent, `${path}.context`);
    if (!context.ok) return context;
    return { ok: true, value: { ...clone(choice), operations, ...(context.value === undefined ? {} : { context: context.value }) } };
  };
  const validateFollowUp = (raw, owner, parent) => {
    if (raw == null) return { ok: true, value: undefined };
    if (!isRecord(raw)) return fail("Follow-up содержит неподтверждённое состояние.");
    for (const key of Object.keys(raw)) if (!followUpKeys.has(key)) return fail(`Поле follow-up.${key} не разрешено.`);
    const value = clone(raw);
    if (value.id != null && !id(value.id)) return fail("Follow-up содержит недопустимый ID.");
    if (value.ownerActorId != null && value.ownerActorId !== owner.id) return fail("Follow-up принадлежит другому участнику.");
    if (value.sourceActorId != null && value.sourceActorId !== owner.id) return fail("Follow-up содержит чужого sourceActorId.");
    const participants = value.participantIds ?? value.participants;
    if (participants != null && (!Array.isArray(participants) || participants.length < 1 || participants.length > 16 || participants.some(item => !id(item)))) return fail("Follow-up содержит неподтверждённых участников.");
    const endBoundary = value.endBoundary || value.deadline?.boundary;
    if (endBoundary != null && !normalizeBoundary(endBoundary)) return fail("Follow-up содержит неизвестную границу.");
    if (value.deadline != null && (!isRecord(value.deadline) || Object.keys(value.deadline).some(key => key !== "boundary"))) return fail("Follow-up содержит неподтверждённый deadline.");
    if (value.cancelOn != null && (!Array.isArray(value.cancelOn) || value.cancelOn.length > 3 || value.cancelOn.some(item => !cancelReasons.has(item)))) return fail("Follow-up содержит неподтверждённое условие отмены.");
    if (value.optional != null && typeof value.optional !== "boolean") return fail("Follow-up.optional должен быть булевым.");
    const completion = value.completionOperations ?? value.completeOperations;
    if (completion != null) {
      if (!Array.isArray(completion) || completion.length > 192) return fail("Follow-up содержит неподтверждённый план завершения.");
      const normalized = [];
      for (let index = 0; index < completion.length; index++) {
        const result = validateOperation(completion[index], owner, parent, `followUp.completionOperations[${index}]`);
        if (!result.ok) return result;
        normalized.push(result.value);
      }
      value.completionOperations = normalized;
      delete value.completeOperations;
    }
    if (value.ownerActorId == null) value.ownerActorId = owner.id;
    if (value.sourceActorId == null) value.sourceActorId = owner.id;
    if (value.participantIds == null && Array.isArray(value.participants)) value.participantIds = value.participants;
    delete value.participants;
    if (value.endBoundary == null) value.endBoundary = endBoundary || "anyTurnStart";
    return { ok: true, value };
  };
  const validateDeclaration = (rule, owner, context = {}, kind = "boundary") => {
    if (!isRecord(rule)) return fail(`${kind === "trigger" ? "Триггер" : "Автоматизация"} имеет неподдерживаемую форму.`);
    if (!owner || !id(owner.id)) return fail(`${kind === "trigger" ? "Триггер" : "Автоматизация"} требует подтверждённого владельца.`);
    const descriptor = kind === "boundary" ? boundaryDescriptor(context) : null;
    if (descriptor && !descriptor.available) return fail(descriptor.reason);
    for (const key of Object.keys(rule)) if (!declarationKeys.has(key)) return fail(`Поле декларации ${key} не разрешено.`);
    if (!id(rule.id)) return fail(`${kind === "trigger" ? "Триггер" : "Автоматизация"} требует корректный ID правила.`);
    if (rule.ruleId != null && rule.ruleId !== rule.id) return fail("Декларация содержит чужой ruleId.");
    if (rule.ownerActorId != null && rule.ownerActorId !== owner.id) return fail(`${kind === "trigger" ? "Триггер" : "Автоматизация"} принадлежит другому участнику.`);
    if (!digest(rule.sourceDigest)) return fail(`${kind === "trigger" ? "Триггер" : "Автоматизация"} без подтверждённого sourceDigest передан Нарратору.`);
    if (rule.label != null && !text(rule.label, 300)) return fail("Декларация содержит недопустимую подпись.");
    if (rule.coverage != null && !text(rule.coverage, 80)) return fail("Декларация содержит недопустимое покрытие.");
    for (const field of ["choiceSet", "optional"]) if (rule[field] != null && typeof rule[field] !== "boolean") return fail(`Декларация.${field} должна быть булевой.`);
    if (kind === "trigger" && !text(rule.triggerKey, 240)) return fail("Триггер без подтверждённого triggerKey передан Нарратору.");
    if (rule.triggerKey != null && !text(rule.triggerKey, 240)) return fail("Декларация содержит недопустимый triggerKey.");
    const safe = safeValue(rule, "declaration");
    if (!safe.ok) return fail(safe.reason);
    const parent = { id: rule.id, sourceDigest: rule.sourceDigest };
    const rawOperations = rule.operations == null ? [] : rule.operations;
    if (!Array.isArray(rawOperations) || rawOperations.length > 192) return fail("Декларация содержит неподтверждённый список операций.");
    const operations = [];
    for (let index = 0; index < rawOperations.length; index++) {
      const result = validateOperation(rawOperations[index], owner, parent, `operations[${index}]`);
      if (!result.ok) return result;
      operations.push(result.value);
    }
    const rawChoices = rule.choices == null ? [] : rule.choices;
    if (!Array.isArray(rawChoices) || rawChoices.length > 64) return fail("Декларация содержит неподтверждённый список вариантов.");
    const choices = [], choiceIds = new Set();
    for (let index = 0; index < rawChoices.length; index++) {
      const result = validateChoice(rawChoices[index], owner, parent, `choices[${index}]`);
      if (!result.ok) return result;
      if (choiceIds.has(result.value.id)) return fail("Декларация содержит повторяющийся вариант.");
      choiceIds.add(result.value.id); choices.push(result.value);
    }
    const followUp = validateFollowUp(rule.followUp ?? rule.followup, owner, parent);
    if (!followUp.ok) return followUp;
    const normalized = { ...clone(rule), ownerActorId: owner.id, operations, choices };
    // Keep a canonical ruleId alongside the historical `id` field so the
    // engine and audit tools can bind every receipt to one declaration.
    normalized.ruleId = rule.id;
    if (followUp.value !== undefined) normalized.followUp = followUp.value;
    delete normalized.followup;
    return { schema: BRIDGE_SCHEMA, ok: true, manual: false, rule: normalized, ...(descriptor ? { descriptor } : {}) };
  };
  const validateBoundaryDeclaration = (rule, owner, context = {}) => validateDeclaration(rule, owner, context, "boundary");
  const validateTriggerDeclaration = (rule, owner) => validateDeclaration(rule, owner, {}, "trigger");
  root.DAWN_LIONWING_FOUNDATION = Object.freeze({ BRIDGE_SCHEMA, normalizeBoundary, boundaryDescriptor, validateBoundaryDeclaration, validateTriggerDeclaration });
})(typeof window === "object" ? window : globalThis);
