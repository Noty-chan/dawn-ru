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
    projected.selectedActor = visibleActorIds.has(projected.selectedActor) ? projected.selectedActor : null;
    projected.activeActorId = visibleActorIds.has(projected.activeActorId) ? projected.activeActorId : null;
    projected.targetIds = (projected.targetIds || []).filter(id => visibleActorIds.has(id));
    projected.objects = (projected.objects || []).filter(object => !object.hidden && (!object.ownerActorId || visibleActorIds.has(object.ownerActorId)));
    projected.markers = (projected.markers || []).filter(marker => marker.kind !== "hidden" && !marker.hidden);
    projected.artworks = (projected.artworks || []).filter(art => !art.hidden);
    const visibleArtIds = new Set(projected.artworks.map(art => art.id));
    projected.backgroundArt = visibleArtIds.has(projected.backgroundArt) ? projected.backgroundArt : null;
    projected.featuredArt = visibleArtIds.has(projected.featuredArt) ? projected.featuredArt : null;
    projected.log = (projected.log || []).filter(event => event.visibility !== "gm" && event.payload?.visibility !== "gm");
    projected.rollFeed = (projected.rollFeed || []).filter(roll => roll.visibility !== "gm").map(roll => ({ ...roll, targetIds: (roll.targetIds || []).filter(id => visibleActorIds.has(id)), dice: roll.dice ? { ...roll.dice, targetIds: (roll.dice.targetIds || []).filter(id => visibleActorIds.has(id)) } : roll.dice }));
    if (projected.pendingAction) {
      if (!visibleActorIds.has(projected.pendingAction.actorId)) projected.pendingAction = null;
      else {
        projected.pendingAction.targetIds = (projected.pendingAction.targetIds || []).filter(id => visibleActorIds.has(id));
        projected.pendingAction.responses = Object.fromEntries(Object.entries(projected.pendingAction.responses || {}).filter(([id]) => visibleActorIds.has(id)));
        if (!projected.pendingAction.targetIds.length && !projected.pendingAction.allowEmptyTargets) projected.pendingAction = null;
      }
    }
    if (projected.pendingActionPlan && (!visibleActorIds.has(projected.pendingActionPlan.actorId) || (projected.pendingActionPlan.context?.targetIds || []).some(id => !visibleActorIds.has(id)))) projected.pendingActionPlan = null;
    if (projected.pendingPrompt && (!visibleActorIds.has(projected.pendingPrompt.sourceActorId) || projected.pendingPrompt.targetId && !visibleActorIds.has(projected.pendingPrompt.targetId))) projected.pendingPrompt = null;
    projected.triggerQueue = (projected.triggerQueue || []).filter(item => { const payload = item.event?.payload || {}, sourceId = item.event?.actorId || payload.sourceActorId; return visibleActorIds.has(sourceId) && (!payload.targetId || visibleActorIds.has(payload.targetId)); });
    if (projected.challengeRequest && !visibleActorIds.has(projected.challengeRequest.actorId)) projected.challengeRequest = null;
    if (projected.opposedRoll?.participants?.some(participant => participant.actorId && !visibleActorIds.has(participant.actorId))) projected.opposedRoll = null;
    delete projected.undo;
    delete projected.redo;
  }
  return projected;
}

(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE = { VERSION, actionCost, actionHistoryStatus, actionPlanStatus, actorIdsInCells, actorIdsInRange, alternateResourceStatus, attackModifierDestinationStatus, attackModifierStatus, availableActions, availableEnemyRules, cancelActionPlan, cancelPendingAction, clockStatus, cunningPlanStatus, defineTriggerRule, diceHookStatus, diceRollPayload, dispatch, dispatchMany, displacementStatus, effectiveEffects: (scene, actorId) => effectiveEffectsFor(scene, actorById(scene, actorId)), effectAttackStatus, effectCellOccupancyStatus, effectDefenseStatus, effectExpiryStatus, effectMovementStatus, effectPresenceStatus, effectStatus, effectTargetingStatus, enemyRuleAutomation, evaluateDiceRoll, eventParticipants, masterAtArmsStatus, movementPath, movementTraceStatus, ownedEntities, pendingActionStatus, pendingTargetOutcome, prepareAction, prepareActionPlan, prepareActionPlanContinuation, prepareActionPlanModifierDestination, prepareActionPlanReappearance, prepareDisplacements, prepareEnemyRule, prepareInvisibleDisappear, preparePotionUse, prepareSacrifice, preparePromptPlacement, prepareSurgery, prepareTechniqueCombo, previewEvents, projectScene, reactionOptions, removedCellKeys, resetRuleClocks, resetRuleResources, resourceOperationStatus, resourceStatus, respondReaction, respondRulePrompt, resolvePendingAction, roundEndStatus, ruleChoiceStatus, ruleClockDefinitions, ruleDiceAdvantage, ruleModeDefinitions, ruleModeStatus, ruleResourceDefinitions, ruleResourceStatus, sideBalanceStatus, spatialShapeStatus, stanceStatus, summarizeEvents, targetStatus, techniqueComboStatus, terrainComponentStatus, terrainStatus, topologyStatus, topologyStepDestination, triggerQueueStatus, triggerRegistryStatus, triggerRouteStatus, turnActionProgressStatus, turnStartStatus, usageLimitStatus, validateEvent };
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.wallTargetingStatus = wallTargetingStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.ACTION_IDS = ACTION_IDS;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionIs = actionIs;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionIsAny = actionIsAny;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionIdIs = actionIdIs;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.canonicalActionId = canonicalActionId;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionByKey = actionByKey;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.fodderMoveStatus = fodderMoveStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.isEnemyModifier = isEnemyModifier;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.isAttachedModifier = isAttachedModifier;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierConfigurationStatus = modifierConfigurationStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.prepareModifierConfigure = prepareModifierConfigure;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierActionStatus = modifierActionStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.prepareModifierAction = prepareModifierAction;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.prepareCollateralRescue = prepareCollateralRescue;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.compoundEnemyStatus = compoundEnemyStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.effectiveActorSpeed = effectiveActorSpeed;
