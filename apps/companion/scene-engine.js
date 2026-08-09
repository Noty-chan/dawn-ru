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

(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE = { VERSION, actionCost, actionHistoryStatus, actionPlanStatus, actorIdsInCells, actorIdsInRange, alternateResourceStatus, attackModifierDestinationStatus, attackModifierStatus, availableActions, availableEnemyRules, cancelActionPlan, cancelPendingAction, clockStatus, cunningPlanStatus, defineTriggerRule, diceHookStatus, diceRollPayload, dispatch, dispatchMany, displacementStatus, effectiveEffects: (scene, actorId) => effectiveEffectsFor(scene, actorById(scene, actorId)), effectAttackStatus, effectCellOccupancyStatus, effectDefenseStatus, effectExpiryStatus, effectMovementStatus, effectPresenceStatus, effectStatus, effectTargetingStatus, enemyRuleAutomation, evaluateDiceRoll, eventParticipants, masterAtArmsStatus, movementPath, movementTraceStatus, ownedEntities, pendingActionStatus, pendingTargetOutcome, prepareAction, prepareActionPlan, prepareActionPlanContinuation, prepareActionPlanModifierDestination, prepareActionPlanReappearance, prepareDisplacements, prepareEnemyRule, prepareInvisibleDisappear, preparePotionUse, preparePromptPlacement, prepareSurgery, prepareTechniqueCombo, previewEvents, projectScene, reactionOptions, removedCellKeys, resetRuleClocks, resetRuleResources, resourceOperationStatus, resourceStatus, respondReaction, respondRulePrompt, resolvePendingAction, roundEndStatus, ruleChoiceStatus, ruleClockDefinitions, ruleDiceAdvantage, ruleModeDefinitions, ruleModeStatus, ruleResourceDefinitions, ruleResourceStatus, sideBalanceStatus, spatialShapeStatus, stanceStatus, summarizeEvents, targetStatus, techniqueComboStatus, terrainComponentStatus, terrainStatus, topologyStatus, topologyStepDestination, triggerQueueStatus, triggerRegistryStatus, triggerRouteStatus, turnActionProgressStatus, turnStartStatus, usageLimitStatus, validateEvent };
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.wallTargetingStatus = wallTargetingStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.fodderMoveStatus = fodderMoveStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.compoundEnemyStatus = compoundEnemyStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.effectiveActorSpeed = effectiveActorSpeed;
