"use strict";

const VERSION = 46;
// Shared input boundary for both editions. Validate before JSON cloning, which
// would silently turn NaN into null or drop functions/undefined array members.
function eventPacketError(message, code = "SCENE_EVENT_PACKET_INVALID") {
  const error = new Error(message); error.code = code; throw error;
}
function eventRequestFingerprint(event) {
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
    return value;
  };
  // Delivery timestamps are transport metadata; every other supplied field is
  // part of the request, including visibility and provenance.
  const { id, at, ...request } = event;
  request.actorId ||= null; request.payload ||= {};
  return JSON.stringify(canonical(request));
}
function eventRequestMetadata(event) {
  const { id, at, type, actorId, payload, ...metadata } = event;
  return eventRequestFingerprint({ type: "metadata", payload: metadata });
}
/** @param {Array<{id?: string, type: string, actorId?: string|null, payload?: object}>} events */
function validateEventPacket(events) {
  if (!Array.isArray(events) || events.length > 192) eventPacketError("Некорректный пакет событий");
  const ancestors = new Set(), ids = new Map(); let nodes = 0;
  const visit = (value, depth = 0, inArray = false) => {
    if (++nodes > 100000 || depth > 64) eventPacketError("Пакет событий слишком сложный");
    if (value === undefined && !inArray || value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number" && Number.isFinite(value)) return;
    if (!value || typeof value !== "object" || Object.prototype.toString.call(value) !== "[object Object]" && !Array.isArray(value)) eventPacketError("События должны содержать только корректные JSON-значения");
    if (ancestors.has(value)) eventPacketError("Пакет событий содержит циклическую ссылку");
    ancestors.add(value);
    if (Array.isArray(value)) { for (let index = 0; index < value.length; index++) visit(value[index], depth + 1, true); }
    else { for (const item of Object.values(value)) visit(item, depth + 1); }
    ancestors.delete(value);
  };
  for (const event of events) {
    if (!event || Array.isArray(event) || typeof event !== "object" || typeof event.type !== "string" || !event.type.trim()) eventPacketError("Событие должно иметь тип");
    if (event.id != null && (typeof event.id !== "string" || !event.id.trim())) eventPacketError("Некорректный ID события");
    if (event.actorId != null && (typeof event.actorId !== "string" || !event.actorId.trim())) eventPacketError("Некорректный исполнитель события");
    if (event.payload != null && (typeof event.payload !== "object" || Array.isArray(event.payload))) eventPacketError("Событие должно иметь объект payload");
    visit(event);
    if (event.id) {
      const fingerprint = eventRequestFingerprint(event);
      if (ids.has(event.id) && ids.get(event.id) !== fingerprint) eventPacketError("Конфликт ID внутри пакета событий", "SCENE_EVENT_ID_CONFLICT");
      ids.set(event.id, fingerprint);
    }
  }
}
function eventRequestReceipts(scene) {
  return scene.rulesEdition === "lionwing" ? scene.lionwing?.receipts || [] : scene.eventReceipts || [];
}
function eventPacketReplayStatus(scene, events, includeCommitted = true) {
  const receipts = new Map(eventRequestReceipts(scene).map(receipt => [receipt.id, receipt]));
  let matched = 0;
  const matchedIds = [];
  for (const event of events) {
    const receipt = event.id && receipts.get(event.id);
    const stored = (scene.log || []).find(item => item.id === event.id);
    if (!receipt) {
      if (!includeCommitted || !stored) continue;
      if (eventRequestFingerprint(stored) !== eventRequestFingerprint(event)) eventPacketError("Конфликт ID события: в журнале уже записано другое событие", "SCENE_EVENT_ID_CONFLICT");
      matched++; matchedIds.push(event.id); continue;
    }
    let matches = receipt.fingerprint === JSON.stringify([event.type, event.actorId || null, event.payload || {}]);
    if (receipt.requestMetadata !== undefined) {
      const [type, actorId, payload] = JSON.parse(receipt.fingerprint);
      matches = eventRequestFingerprint({ type, actorId, payload }) === eventRequestFingerprint({ type: event.type, actorId: event.actorId, payload: event.payload }) && receipt.requestMetadata === eventRequestMetadata(event)
        || stored && eventRequestFingerprint(stored) === eventRequestFingerprint(event);
    }
    if (!matches) eventPacketError("Конфликт ID события: запрос уже принят с другими данными", "SCENE_EVENT_ID_CONFLICT");
    matched++; matchedIds.push(event.id);
  }
  return { complete: matched === events.length, matched, matchedIds };
}
const generatedEventReservations = Symbol("generated event reservations");
function reserveEventIds(scene, events, options = {}) {
  return { ...options, [generatedEventReservations]: new Set([
    ...(options[generatedEventReservations] || []),
    ...(scene.log || []).map(event => event.id),
    ...eventRequestReceipts(scene).map(receipt => receipt.id),
    ...events.map(event => event.id).filter(Boolean),
  ]) };
}
function generatedEventId(scene, base, options = {}) {
  const reserved = options[generatedEventReservations];
  const occupied = new Set([...(reserved || []), ...(scene.log || []).map(event => event.id), ...eventRequestReceipts(scene).map(receipt => receipt.id)]);
  let id = base, serial = 0;
  while (occupied.has(id)) id = `${base}:generated:${++serial}`;
  reserved?.add(id);
  return id;
}
function recordEventRequests(scene, events) {
  const receipts = new Map(eventRequestReceipts(scene).map(receipt => [receipt.id, receipt]));
  // Keep the existing payload fingerprint once. Only the small envelope is
  // added, so canonical attack/geometry payloads do not double network saves.
  for (const event of events) if (event.id && receipts.get(event.id)?.requestMetadata === undefined) receipts.set(event.id, { id: event.id, fingerprint: JSON.stringify([event.type, event.actorId || null, event.payload || {}]), requestMetadata: eventRequestMetadata(event) });
  const retained = [...receipts.values()].slice(-256);
  if (scene.rulesEdition === "lionwing") { scene.lionwing ||= {}; scene.lionwing.receipts = retained; }
  else scene.eventReceipts = retained;
}
// Persisted ids are the rules contract. Display names may be translated and must
// never be used as the only way to identify an action.
const ACTION_IDS = Object.freeze({
  jump: "action.движение.прыжок",
  step: "action.движение.шаг",
  spell: "action.атаки.заклинание",
  finish: "action.атаки.завершение",
  skirmish: "action.атаки.стычка",
  block: "action.защита.блок",
  clash: "action.защита.столкновение",
  dodge: "action.защита.уворот",
  breathe: "action.утилитарные-действия.передышка",
  charge: "action.утилитарные-действия.зарядка",
  disappear: "action.утилитарные-действия.скрыться",
  shove: "action.утилитарные-действия.толчок",
  study: "action.утилитарные-действия.изучение",
  interact: "action.утилитарные-действия.взаимодействие",
  improvise: "action.утилитарные-действия.импровизация",
});
// Read-only compatibility for scenes created before reaction/action ids became
// mandatory. New events must always write the canonical id.
const LEGACY_ACTION_IDS_BY_NAME = Object.freeze({ "Прыжок": ACTION_IDS.jump, "Шаг": ACTION_IDS.step, "Заклинание": ACTION_IDS.spell, "Завершение": ACTION_IDS.finish, "Стычка": ACTION_IDS.skirmish, "Блок": ACTION_IDS.block, "Столкновение": ACTION_IDS.clash, "Уворот": ACTION_IDS.dodge, "Передышка": ACTION_IDS.breathe, "Зарядка": ACTION_IDS.charge, "Скрыться": ACTION_IDS.disappear, "Толчок": ACTION_IDS.shove, "Изучение": ACTION_IDS.study, "Взаимодействие": ACTION_IDS.interact, "Импровизация": ACTION_IDS.improvise });
const canonicalActionId = value => Object.values(ACTION_IDS).includes(value) ? value : LEGACY_ACTION_IDS_BY_NAME[value] || value;
const actionIs = (action, key) => Boolean(action && ACTION_IDS[key] && action.id === ACTION_IDS[key]);
const actionIsAny = (action, keys) => Array.isArray(keys) && keys.some(key => actionIs(action, key));
const actionIdIs = (actionId, key) => Boolean(ACTION_IDS[key] && canonicalActionId(actionId) === ACTION_IDS[key]);
const actionByKey = (data, key) => data?.actions?.list?.find(action => actionIs(action, key)) || null;
const EVENT_TYPES = new Set(["action.plan", "action.plan.update", "action.plan.cancel", "action.prepare", "action.resolve", "enemy.action.prepare", "enemy.action.resolve", "reaction.offer", "reaction.respond", "roll.public", "roll.redirect", "gift.sacrifice", "challenge.request", "challenge.clear", "opposed.request", "opposed.reroll", "opposed.tie.resolve", "opposed.clear", "rule.share", "session-clock.create", "session-clock.set", "session-clock.add", "session-clock.reset", "session-clock.rename", "session-clock.kind", "session-clock.size", "session-clock.remove", "counter.threshold", "combat-meter.change", "reminder.create", "reminder.due", "reminder.resolve", "reminder.remove", "resource.spend", "resource.gain", "actor.runtime.set", "rule-mode.set", "rule-resource.configure", "rule-resource.spend", "rule-resource.gain", "rule-resource.set", "rule-resource.reset", "rule-clock.configure", "rule-clock.tick", "rule-clock.set", "rule-clock.reset", "rule.trigger", "modifier.configure", "modifier.mode.flip", "actor.spawn", "actor.despawn", "actor.move", "actor.enter", "actor.heal", "actor.wound", "actor.knockout", "turn.start", "turn.end", "turn.grant", "round.end", "attack.pending", "attack.clear", "damage.apply", "effect.apply", "effect.remove", "inventory.change", "rule.prompt", "rule.respond", "technique.prepare", "technique.resolve", "technique.manual", "technique.state", "actor.state", "area.create", "area.remove", "area.duration", "object.damage", "object.restore", "wall.create", "wall.damage", "wall.restore", "wall.remove", "marker.create", "marker.move", "marker.remove", "marker.duration", "topology.cells.remove", "topology.cells.restore", "targets.set", "space.ensure", "space.remove"]);
EVENT_TYPES.add("modifier.action");
EVENT_TYPES.add("modifier.used");
EVENT_TYPES.add("modifier.vortex.absorb");
EVENT_TYPES.add("terrain.convert-to-fodder");
const RESOURCES = new Set(["ap", "focus", "influence", "meals", "creationMarks", "innovationCharges"]);
// Every prompt whose answer is a board placement must expose the typed `cell`
// option at the event boundary. Keep this registry wider than the current UI
// lists: prompts can be restored from a save or answered by a remote client.
const PLACEMENT_PROMPT_KINDS = new Set(["marker-move-cell", "wisp-create-cell", "dim-mak-weak-point-cell", "empath-rush-cell", "reappear-cell", "thunder-surge-cell", "siren-irresistible-cell", "untouchable-weave-cell", "knife-pickup-step", "meister-overclock-move", "egomaniac-style-move", "constrictor-move-cell", "enemy-move-cell", "enemy-crowd-move-cell", "fodder-move-cell", "wave-rider-move-cell"]);
const EFFECT_DURATIONS = new Set(["default", "persistent", "scene", "startTurn", "actionOrStartTurn", "roundEnd"]);
const ACTION_PLAN_PHASES = new Set(["reappear", "targets", "destination", "modifiers", "confirm"]);
const EFFECT_LIFECYCLE = Object.freeze({
  "positive.изгнан": Object.freeze({ duration: "startTurn", sourceBound: true, exclusiveBySource: true }),
  "positive.исчез": Object.freeze({ duration: "actionOrStartTurn" }),
  "positive.регенерирует": Object.freeze({ duration: "persistent" }),
  "negative.порчен": Object.freeze({ duration: "persistent" }),
  "negative.испуган": Object.freeze({ duration: "default", sourceBound: true, removeWithSource: true }),
  "negative.подброшен": Object.freeze({ duration: "startTurn" }),
  "negative.пойман": Object.freeze({ duration: "default", sourceBound: true, removeWithSource: true }),
  "negative.спровоцирован": Object.freeze({ duration: "default", sourceBound: true, removeWithSource: true }),
});
function applyEnemyDeploymentPassive(scene, actor) {
  const assassin = scene?.rulesEdition === "lionwing" && actor?.profileId === "lionwing.npc.assassin"
    || scene?.rulesEdition !== "lionwing" && actor?.profileId === "enemy.common.assassin";
  if (!assassin) return actor;
  actor.effects ||= [];
  if (!actor.effects.includes("positive.исчез")) actor.effects.push("positive.исчез");
  actor.effectStates ||= {};
  actor.effectStates["positive.исчез"] = {
    duration: "actionOrStartTurn", removable: true,
    appliedTurnSerial: Number(scene.turnSerial || 0), appliedRound: Number(scene.round || 1),
    sources: [{ actorId: actor.id, actionId: `${actor.profileId}#passive`, eventId: "" }],
  };
  return actor;
}
const ACTOR_STATE_KEYS = new Set(["pugilistStance", "martialPerfection", "growth", "gluttonConsumed", "evasion", "armor", "imposingPresence", "enemyAim", "rangerHeadshotTargetId", "berserkerLastStand", "berserkerReactionTurnSerial", "executionerBifurcate", "revenantHollowedEyes", "healerGuardianId", "enemyCrowdMovement", "privateerGearChange", "roninSheathed", "grimTransformed", "grimUsed", "warringTransformed", "warringUsed", "lastCreationSpellMarks", "modifiedOverclockTurns", "icicleSpellsRemaining", "styleCarryRemaining", "timeStopUsed", "empathSupport", "masterArmament", "wispCreationUsed", "bodyguardsBrace"]);
const clone = value => JSON.parse(JSON.stringify(value));
const actorById = (scene, id) => (scene.actors || []).find(actor => actor.id === id) || null;
const compoundParts = (scene, actorOrId, options = {}) => {
  const actor = typeof actorOrId === "string" ? actorById(scene, actorOrId) : actorOrId;
  if (actor?.profileId === "enemy.modifier.collateral") return [actor];
  const compoundId = (actor?.kind === "enemy" || actor?.profileId) && typeof actor.compoundId === "string" ? actor.compoundId.trim() : "";
  if (!actor || !compoundId) return actor ? [actor] : [];
  return (scene.actors || []).filter(part => part.profileId !== "enemy.modifier.collateral" && part.team === actor.team && (part.kind === "enemy" || part.profileId) && String(part.compoundId || "").trim() === compoundId && (options.includeKnockedOut || !part.knockedOut));
};
function compoundEnemyStatus(scene, actorOrId) {
  const actor = typeof actorOrId === "string" ? actorById(scene, actorOrId) : actorOrId, parts = compoundParts(scene, actor, { includeKnockedOut: true });
  if (!actor || parts.length < 2) return { active: false, actor, parts: actor ? [actor] : [], id: null };
  const maxHp = parts.reduce((sum, part) => sum + Math.max(0, Number(part.maxHp || 0)), 0), hp = parts.reduce((sum, part) => sum + Math.max(0, Number(part.hp || 0)), 0), speeds = parts.map(part => Math.max(0, Number(part.compoundBaseSpeed ?? part.speed ?? 0))), frequency = new Map();
  speeds.forEach(speed => frequency.set(speed, Number(frequency.get(speed) || 0) + 1));
  const speed = [...frequency.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0] || 0, armorMax = Math.max(...parts.map(part => Number(part.armor || 0))), evasionMax = Math.max(...parts.map(part => Number(part.evasion || 0))), storedDefense = parts.map(part => part.compoundDefense).find(value => value === "armor" || value === "evasion"), defenseTied = armorMax === evasionMax, defenseType = defenseTied ? storedDefense || "armor" : evasionMax > armorMax ? "evasion" : "armor";
  return { active: true, actor, parts, id: String(actor.compoundId).trim(), representativeId: parts[0].id, hp, maxHp, gate: maxHp / parts.length, defenseType, defenseTied, armorMax, evasionMax, armor: defenseType === "armor" ? armorMax : 0, evasion: defenseType === "evasion" ? evasionMax : 0, speed };
}
const canonicalTargetId = (scene, actorId) => compoundEnemyStatus(scene, actorId).representativeId || actorId;
const effectiveActorSpeed = (scene, actorId) => {
  const actor = actorById(scene, actorId), compound = compoundEnemyStatus(scene, actor);
  if(compound.parts?.some(part=>part.profileId===ENEMY_MODIFIER_IDS.gargantuan&&!part.knockedOut))return 0;
  if (["enemy.common.executioner","lionwing.npc.executioner"].includes(actor?.profileId) && (actor.effects || []).includes("positive.заряжен")) return 1;
  return compound.active ? compound.speed : Math.max(0, Number(actor?.speed || 0));
};
const actionById = (data, id) => data?.actions?.list?.find(action => action.id === id) || null;
// LionWing keeps its canonical NPC catalog outside the legacy `D.enemies`
// table.  Scene commands still receive the legacy data object for backwards
// compatibility, so resolve a canonical profile from the edition payload when
// the actor belongs to that edition.  This is deliberately a read-only bridge:
// canonical text is never parsed here and the action adapter in
// `scene-actions.js` remains the authority for executable rule metadata.
const lionwingCanonicalRoot = data => {
  const scope = typeof window === "object" && window ? window : typeof globalThis === "object" ? globalThis : {};
  return data?.coreRules?.npcs?.list ? data.coreRules : data?.npcs?.list ? data : scope.DAWN_LIONWING_DATA?.coreRules || scope.DAWN_LIONWING_DATA || null;
};
const enemyProfileById = (data, id) => {
  const legacy = Object.values(data?.enemies || {}).flat().find(profile => profile.id === id);
  if (legacy) return legacy;
  const canonical = lionwingCanonicalRoot(data)?.npcs?.list?.find(profile => profile.id === id);
  if (!canonical) return null;
  const scope = typeof window === "object" && window ? window : typeof globalThis === "object" ? globalThis : {};
  const table = scope.DAWN_LIONWING_TABLE_DATA;
  if (table?.normalizeNpc) return table.normalizeNpc(canonical);
  const stats = canonical.statistics || {};
  const formula = value => typeof value === "number" ? String(value) : String(value || "0");
  const rules = (canonical.actions || []).map(action => ({ ...action, apCost: 1, automation: "assisted", available: false }));
  if (canonical.ace) rules.push({ ...canonical.ace, kind: "trump", apCost: 2, automation: "assisted", available: false });
  return {
    id: canonical.id,
    kind: "common",
    editionId: "lionwing",
    manualOnly: true,
    name: canonical.name,
    tags: canonical.role || "NPC",
    role: canonical.role || "NPC",
    stats: { health: formula(stats.health), speed: formula(stats.speed), armor: formula(stats.armor), evasion: formula(stats.evasion) },
    passive: canonical.passive || "",
    text: canonical.description || "",
    rules,
    source: canonical.source || null,
  };
};
const effectIdByName = (data, name) => [...(data?.effects?.positive || []), ...(data?.effects?.negative || [])].find(effect => effect.id === name || effect.name === name)?.id || name;
const distance = (a, b) => {if(a.space!==b.space)return Infinity;const aw=Math.max(1,Number(a.occupiedWidth||1)),ah=Math.max(1,Number(a.occupiedHeight||1)),bw=Math.max(1,Number(b.occupiedWidth||1)),bh=Math.max(1,Number(b.occupiedHeight||1)),dx=Math.max(0,Number(a.x)-Number(b.x)-bw+1,Number(b.x)-Number(a.x)-aw+1),dy=Math.max(0,Number(a.y)-Number(b.y)-bh+1,Number(b.y)-Number(a.y)-ah+1);return dx+dy};
const cellKey = point => `${point.x},${point.y}`;
const wallEdgeKey = (left,right) => [typeof left==="string"?left:cellKey(left),typeof right==="string"?right:cellKey(right)].sort().join("|");
const wallAt = (scene,space,from,to) => (scene.walls||[]).find(wall=>wall.space===space&&wallEdgeKey(wall.a,wall.b)===wallEdgeKey(from,to))||null;
const wallBlocksStep = (scene, space, from, to) => {
  const dx = Number(to.x) - Number(from.x), dy = Number(to.y) - Number(from.y);
  if (Math.abs(dx) + Math.abs(dy) === 1) return wallAt(scene, space, from, to);
  if (Math.abs(dx) === 1 && Math.abs(dy) === 1) return wallAt(scene, space, from, { x: Number(from.x) + dx, y: Number(from.y) }) || wallAt(scene, space, from, { x: Number(from.x), y: Number(from.y) + dy });
  return null;
};
const markerById = (scene, id) => (scene.markers || []).find(marker => marker.id === id) || null;
const topologyCuts = scene => Array.isArray(scene?.topology?.cuts) ? scene.topology.cuts : [];
const removedCellKeys = (scene, spaceId) => new Set(topologyCuts(scene).filter(cut => cut.space === spaceId).flatMap(cut => cut.cells || []));
const topologyCutAt = (scene, spaceId, cell) => topologyCuts(scene).find(cut => cut.space === spaceId && (cut.cells || []).includes(cell)) || null;
function topologyStepDestination(scene, request = {}) {
  const space = (scene?.spaces || []).find(item => item.id === request.space), from = request.from, attempted = request.attempted;
  if (!space || !from || !attempted) return null;
  const dx = Math.sign(Number(attempted.x) - Number(from.x)), dy = Math.sign(Number(attempted.y) - Number(from.y));
  if ((!dx && !dy) || Math.abs(Number(attempted.x) - Number(from.x)) > 1 || Math.abs(Number(attempted.y) - Number(from.y)) > 1) return null;
  let point = { x: Number(attempted.x), y: Number(attempted.y) };
  const crossedCutIds = [];
  for (let guard = 0; guard < Number(space.width) + Number(space.height); guard += 1) {
    if (point.x < 0 || point.y < 0 || point.x >= space.width || point.y >= space.height) return null;
    const cut = topologyCutAt(scene, request.space, cellKey(point));
    if (!cut) return crossedCutIds.length ? { ...point, teleported: true, crossedCutIds: [...new Set(crossedCutIds)] } : point;
    if (cut.crossing !== "opposite") return null;
    crossedCutIds.push(cut.id);
    point = { x: point.x + dx, y: point.y + dy };
  }
  return null;
}
function topologyStatus(scene, request = {}) {
  const space = (scene?.spaces || []).find(item => item.id === request.space);
  const cells = [...new Set((Array.isArray(request.cells) ? request.cells : request.cell ? [request.cell] : []).map(String))];
  const removed = removedCellKeys(scene, request.space);
  const invalidCells = cells.filter(cell => {
    const match = cell.match(/^(\d{1,2}),(\d{1,2})$/);
    return !space || !match || Number(match[1]) >= Number(space.width) || Number(match[2]) >= Number(space.height);
  });
  const actorOccupiesCell=(actor,cell)=>{const[x,y]=cell.split(",").map(Number);return x>=Number(actor.x)&&x<Number(actor.x)+Math.max(1,Number(actor.occupiedWidth||1))&&y>=Number(actor.y)&&y<Number(actor.y)+Math.max(1,Number(actor.occupiedHeight||1))};
  const occupiedCells = cells.filter(cell => (scene?.actors || []).some(actor => !actor.knockedOut && !hasEffect(scene, actor, "positive.исчез") && actor.space === request.space && actorOccupiesCell(actor,cell)));
  const alreadyRemoved = cells.filter(cell => removed.has(cell));
  const operation = request.operation || "inspect";
  let reason = "";
  if (!space) reason = "Пространство не найдено.";
  else if (!cells.length) reason = "Не выбраны клетки.";
  else if (invalidCells.length) reason = "Выбор выходит за границы пространства.";
  else if (operation === "remove" && occupiedCells.length) reason = "Сначала переместите персонажей с удаляемых клеток.";
  else if (operation === "remove" && alreadyRemoved.length) reason = "Часть выбранных клеток уже удалена.";
  else if (operation === "restore" && !alreadyRemoved.length) reason = "Выбранные клетки не удалены.";
  return { available: !reason, reason, space: space || null, cells, invalidCells, occupiedCells, alreadyRemoved, removed: cells.filter(cell => removed.has(cell)) };
}
function eventParticipants(scene, event = {}) {
  const payload = event.payload || {};
  const known = new Set((scene?.actors || []).map(actor => actor.id));
  const uniqueKnown = values => [...new Set(values.flat().filter(id => typeof id === "string" && known.has(id)))];
  const sourceIds = uniqueKnown([event.actorId, payload.sourceActorId, payload.triggerOwnerId, payload.ownerActorId]);
  const sourceSet = new Set(sourceIds);
  const targetIds = uniqueKnown([payload.targetId, payload.targetIds || [], payload.affectedActorIds || [], payload.participantIds || []]).filter(id => !sourceSet.has(id));
  return { sourceIds, targetIds, actorIds: [...sourceIds, ...targetIds] };
}
function ambientEffects(scene, actor) {
  if (!actor) return [];
  const markerEffects = (scene.markers || []).flatMap(marker => {
    const owner = actorById(scene, marker.ownerActorId);
    if (marker.space !== actor.space || !/altruist\.will-o-wisp\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`) || Math.abs(marker.x - actor.x) + Math.abs(marker.y - actor.y) > 1 || !owner) return [];
    const rules = marker.metadata?.effectRules || (marker.metadata?.effects || []).map(effect => ({ effect, audience: marker.metadata?.audience || "allies" }));
    return rules.filter(rule => rule.audience === "allies" ? owner.team === actor.team : owner.team !== actor.team).map(rule => rule.effect);
  });
  const banishedState = effectStateFor(actor, "positive.изгнан");
  const banishmentEffects = (banishedState?.sources || []).flatMap(source => {
    const owner = actorById(scene, source.actorId);
    if (!owner || Number(owner.techniques?.["disruptor.mind-breaker"] || 0) < 2) return [];
    return [owner.team === actor.team ? "positive.усилен" : "negative.помечен"];
  });
  return [...new Set([...markerEffects, ...banishmentEffects])];
}
const effectiveEffectsFor = (scene, actor) => [...new Set([...(actor?.effects || []), ...ambientEffects(scene, actor)])];
const hasEffect = (scene, actor, effect) => effectiveEffectsFor(scene, actor).includes(effect);
const effectLifecycleDefinition = effect => ({ duration: "default", sourceBound: false, exclusiveBySource: false, removeWithSource: false, ...(EFFECT_LIFECYCLE[effect] || {}) });
function effectStateFor(actor, effect) {
  const saved = actor?.effectStates?.[effect];
  if (!saved || typeof saved !== "object") return null;
  const definition = effectLifecycleDefinition(effect), duration = EFFECT_DURATIONS.has(saved.duration) ? saved.duration : definition.duration;
  const sources = Array.isArray(saved.sources) ? saved.sources.filter(source => source && typeof source.actorId === "string").slice(0, 12).map(source => ({ actorId: source.actorId, actionId: typeof source.actionId === "string" ? source.actionId.slice(0, 180) : "", eventId: typeof source.eventId === "string" ? source.eventId.slice(0, 120) : "" })) : [];
  return {
    duration,
    removable: saved.removable !== false,
    appliedTurnSerial: saved.appliedTurnSerial != null && Number.isInteger(Number(saved.appliedTurnSerial)) ? Number(saved.appliedTurnSerial) : null,
    appliedRound: saved.appliedRound != null && Number.isInteger(Number(saved.appliedRound)) ? Number(saved.appliedRound) : null,
    appliedEventId: typeof saved.appliedEventId === "string" ? saved.appliedEventId : "",
    sourceBound: saved.sourceBound === true || definition.sourceBound,
    exclusiveBySource: saved.exclusiveBySource === true || definition.exclusiveBySource,
    removeWithSource: saved.removeWithSource === true || definition.removeWithSource,
    sources,
  };
}
