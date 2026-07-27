"use strict";

const VERSION = 10;
const EVENT_TYPES = new Set(["action.prepare", "action.resolve", "enemy.action.prepare", "enemy.action.resolve", "reaction.offer", "reaction.respond", "roll.public", "resource.spend", "resource.gain", "actor.move", "actor.enter", "actor.heal", "actor.knockout", "turn.start", "turn.end", "turn.grant", "round.end", "attack.pending", "attack.clear", "damage.apply", "effect.apply", "effect.remove", "inventory.change", "rule.prompt", "rule.respond", "technique.prepare", "technique.resolve", "technique.manual", "technique.state", "actor.state", "area.create", "area.remove", "object.damage", "marker.create", "marker.move", "marker.remove", "targets.set", "space.ensure"]);
const RESOURCES = new Set(["ap", "focus", "influence", "meals", "creationMarks", "innovationCharges"]);
const ACTOR_STATE_KEYS = new Set(["pugilistStance", "martialPerfection", "growth", "imposingPresence", "grimTransformed", "grimUsed", "drainLife", "lastCreationSpellMarks"]);
const clone = value => JSON.parse(JSON.stringify(value));
const actorById = (scene, id) => (scene.actors || []).find(actor => actor.id === id) || null;
const actionById = (data, id) => data?.actions?.list?.find(action => action.id === id) || null;
const enemyProfileById = (data, id) => [...(data?.enemies?.common || []), ...(data?.enemies?.modifiers || [])].find(profile => profile.id === id) || null;
const effectIdByName = (data, name) => [...(data?.effects?.positive || []), ...(data?.effects?.negative || [])].find(effect => effect.id === name || effect.name === name)?.id || name;
const distance = (a, b) => a.space === b.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
const cellKey = point => `${point.x},${point.y}`;
const markerById = (scene, id) => (scene.markers || []).find(marker => marker.id === id) || null;
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
  return [...new Set((scene.markers || []).flatMap(marker => {
    const owner = actorById(scene, marker.ownerActorId);
    if (marker.space !== actor.space || !/altruist\.will-o-wisp\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`) || Math.abs(marker.x - actor.x) + Math.abs(marker.y - actor.y) > 1 || !owner) return [];
    const rules = marker.metadata?.effectRules || (marker.metadata?.effects || []).map(effect => ({ effect, audience: marker.metadata?.audience || "allies" }));
    return rules.filter(rule => rule.audience === "allies" ? owner.team === actor.team : owner.team !== actor.team).map(rule => rule.effect);
  }))];
}
const effectiveEffectsFor = (scene, actor) => [...new Set([...(actor?.effects || []), ...ambientEffects(scene, actor)])];
const hasEffect = (scene, actor, effect) => effectiveEffectsFor(scene, actor).includes(effect);
