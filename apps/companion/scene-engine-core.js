"use strict";

const VERSION = 28;
const EVENT_TYPES = new Set(["action.plan", "action.plan.update", "action.plan.cancel", "action.prepare", "action.resolve", "enemy.action.prepare", "enemy.action.resolve", "reaction.offer", "reaction.respond", "roll.public", "resource.spend", "resource.gain", "rule-resource.configure", "rule-resource.spend", "rule-resource.gain", "rule-resource.set", "rule-resource.reset", "rule-clock.configure", "rule-clock.tick", "rule-clock.set", "rule-clock.reset", "rule.trigger", "actor.move", "actor.enter", "actor.heal", "actor.wound", "actor.knockout", "turn.start", "turn.end", "turn.grant", "round.end", "attack.pending", "attack.clear", "damage.apply", "effect.apply", "effect.remove", "inventory.change", "rule.prompt", "rule.respond", "technique.prepare", "technique.resolve", "technique.manual", "technique.state", "actor.state", "area.create", "area.remove", "object.damage", "marker.create", "marker.move", "marker.remove", "topology.cells.remove", "topology.cells.restore", "targets.set", "space.ensure"]);
const RESOURCES = new Set(["ap", "focus", "influence", "meals", "creationMarks", "innovationCharges"]);
const PLACEMENT_PROMPT_KINDS = new Set(["marker-move-cell", "empath-rush-cell", "reappear-cell", "thunder-surge-cell", "siren-irresistible-cell", "untouchable-weave-cell", "knife-pickup-step", "meister-overclock-move", "egomaniac-style-move"]);
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
const ACTOR_STATE_KEYS = new Set(["pugilistStance", "martialPerfection", "growth", "imposingPresence", "grimTransformed", "grimUsed", "warringTransformed", "warringUsed", "drainLife", "lastCreationSpellMarks", "modifiedOverclockTurns", "icicleSpellsRemaining", "styleCarryRemaining", "timeStopUsed"]);
const clone = value => JSON.parse(JSON.stringify(value));
const actorById = (scene, id) => (scene.actors || []).find(actor => actor.id === id) || null;
const actionById = (data, id) => data?.actions?.list?.find(action => action.id === id) || null;
const enemyProfileById = (data, id) => [...(data?.enemies?.common || []), ...(data?.enemies?.modifiers || [])].find(profile => profile.id === id) || null;
const effectIdByName = (data, name) => [...(data?.effects?.positive || []), ...(data?.effects?.negative || [])].find(effect => effect.id === name || effect.name === name)?.id || name;
const distance = (a, b) => a.space === b.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
const cellKey = point => `${point.x},${point.y}`;
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
  const occupiedCells = cells.filter(cell => (scene?.actors || []).some(actor => !actor.knockedOut && !hasEffect(scene, actor, "positive.исчез") && actor.space === request.space && cellKey(actor) === cell));
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
