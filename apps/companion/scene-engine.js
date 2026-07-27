"use strict";

function projectScene(scene, viewer = {}) {
  const projected = clone(scene);
  const narrator = ["owner", "narrator", "gm"].includes(viewer.role);
  const ownActorIds = new Set(Array.isArray(viewer.actorIds) ? viewer.actorIds : []);
  if (!narrator) {
    projected.actors = (projected.actors || []).filter(actor => !actor.hidden).map(actor => {
      if (ownActorIds.has(actor.id)) return actor;
      const { notes, privateNotes, ownerId, ...publicActor } = actor;
      return publicActor;
    });
    const visibleActorIds = new Set(projected.actors.map(actor => actor.id));
    projected.objects = (projected.objects || []).filter(object => !object.hidden && (!object.ownerActorId || visibleActorIds.has(object.ownerActorId)));
    projected.markers = (projected.markers || []).filter(marker => marker.kind !== "hidden" && !marker.hidden);
    projected.artworks = (projected.artworks || []).filter(art => !art.hidden);
    projected.log = (projected.log || []).filter(event => event.visibility !== "gm" && event.payload?.visibility !== "gm");
    delete projected.undo;
  }
  return projected;
}

(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE = { VERSION, actionCost, actionHistoryStatus, actorIdsInCells, actorIdsInRange, alternateResourceStatus, availableActions, availableEnemyRules, cancelPendingAction, clockStatus, cunningPlanStatus, dispatch, dispatchMany, effectiveEffects: (scene, actorId) => effectiveEffectsFor(scene, actorById(scene, actorId)), effectStatus, eventParticipants, movementPath, ownedEntities, pendingActionStatus, prepareAction, prepareEnemyRule, preparePotionUse, preparePromptPlacement, prepareSurgery, prepareTechniqueCombo, previewEvents, projectScene, reactionOptions, resourceStatus, respondReaction, respondRulePrompt, resolvePendingAction, roundEndStatus, stanceStatus, summarizeEvents, targetStatus, techniqueComboStatus, terrainStatus, turnStartStatus, validateEvent };
