"use strict";

function projectScene(scene, viewer = {}) {
  const projected = clone(scene);
  const narrator = ["owner", "narrator", "gm"].includes(viewer.role);
  const ownActorIds = new Set(Array.isArray(viewer.actorIds) ? viewer.actorIds : []);
  if (typeof viewer.actorId === "string" && viewer.actorId) ownActorIds.add(viewer.actorId);
  if (!narrator) {
    delete projected.eventReceipts;
    if (projected.lionwing) delete projected.lionwing.receipts;
    const manual=projected.tablePolicy?.mode==="manual";
    projected.manualInitiative=manual?[...(projected.actors||[]).filter(actor=>actor.hidden&&actor.manualInitiativeVisible===true),...(projected.manualInitiative||[]).filter(row=>!(projected.actors||[]).some(actor=>actor.id===row.id))].map(actor=>({id:actor.id,name:actor.name,space:actor.space,hidden:true,initiativeOnly:true})):[];
    projected.actors = (projected.actors || []).filter(actor => !actor.hidden).map(actor => {
      if (ownActorIds.has(actor.id)) return actor;
      const { notes, privateNotes, ownerId, ...publicActor } = actor;
      return publicActor;
    });
    const visibleActorIds = new Set(projected.actors.map(actor => actor.id));
    projected.sessionClocks=(projected.sessionClocks||[]).filter(clock=>!clock.manual||!clock.ownerActorId||visibleActorIds.has(clock.ownerActorId));
    projected.selectedActor = visibleActorIds.has(projected.selectedActor) ? projected.selectedActor : null;
    projected.activeActorId = visibleActorIds.has(projected.activeActorId) ? projected.activeActorId : null;
    if(projected.manualTable)projected.manualTable.actorId=visibleActorIds.has(projected.manualTable.actorId)||projected.manualInitiative.some(row=>row.id===projected.manualTable.actorId)?projected.manualTable.actorId:null;
    projected.targetIds = (projected.targetIds || []).filter(id => visibleActorIds.has(id));
    projected.objects = (projected.objects || []).filter(object => !object.hidden && (!object.ownerActorId || visibleActorIds.has(object.ownerActorId)));
    projected.walls=(projected.walls||[]).filter(wall=>!wall.hidden&&(!wall.ownerActorId||visibleActorIds.has(wall.ownerActorId)));
    projected.markers = (projected.markers || []).filter(marker => marker.kind !== "hidden" && !marker.hidden&&(!marker.ownerActorId||visibleActorIds.has(marker.ownerActorId))).map(marker => {
      if (marker.hostActorId && !visibleActorIds.has(marker.hostActorId)) { const { hostActorId, sourceActorId, offset, ...publicMarker } = marker; return publicMarker; }
      return marker;
    });
    projected.artworks = (projected.artworks || []).filter(art => !art.hidden);
    const visibleArtIds = new Set(projected.artworks.map(art => art.id));
    projected.backgroundArt = visibleArtIds.has(projected.backgroundArt) ? projected.backgroundArt : null;
    projected.featuredArt = visibleArtIds.has(projected.featuredArt) ? projected.featuredArt : null;
    const hiddenIds=new Set();
    for(const key of ["actors","objects","walls","markers","sessionClocks","artworks"]){const kept=new Set((projected[key]||[]).map(row=>row.id));for(const row of scene[key]||[])if(!kept.has(row.id))hiddenIds.add(row.id);}
    for(const [key,row] of Object.entries(scene.lionwing?.entities||{}))if(row.visibility==="narrator"||row.visibility==="owner"&&!ownActorIds.has(row.ownerActorId))hiddenIds.add(row.id||key);
    const refersToHidden=value=>typeof value==="string"?hiddenIds.has(value):value&&typeof value==="object"?Object.entries(value).some(([key,item])=>hiddenIds.has(key)||refersToHidden(item)):false;
    if(projected.lionwing){delete projected.lionwing.entityReceipts;delete projected.lionwing.boundaryReceipts;for(const key of ["auras","subscriptions","selections"])if(Array.isArray(projected.lionwing[key]))projected.lionwing[key]=projected.lionwing[key].filter(row=>!refersToHidden(row));}
    projected.log = (projected.log || []).filter(event => event.visibility !== "gm" && event.payload?.visibility !== "gm" && (event.visibility !== "owner" && event.payload?.visibility !== "owner" || ownActorIds.has(event.payload?.ownerActorId || event.actorId)));
    projected.rollFeed = (projected.rollFeed || []).filter(roll => roll.visibility !== "gm").map(roll => ({ ...roll, targetIds: (roll.targetIds || []).filter(id => visibleActorIds.has(id)), dice: roll.dice ? { ...roll.dice, targetIds: (roll.dice.targetIds || []).filter(id => visibleActorIds.has(id)) } : roll.dice }));
    projected.log=projected.log.filter(row=>!refersToHidden(row));projected.rollFeed=projected.rollFeed.filter(row=>!refersToHidden(row));
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

(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE = { VERSION, actionCost, actionHistoryStatus, actionPlanStatus, actorIdsInCells, actorIdsInRange, alternateResourceStatus, attackModifierDestinationStatus, attackModifierStatus, availableActions, availableEnemyRules, bodyguardsBraceIntact, bodyguardsBraceLines, bodyguardsBracedCells, bodyguardsLifecycleEvents, lionwingRevenantRoundEvents, cancelActionPlan, cancelPendingAction, clockStatus, cunningPlanStatus, defineTriggerRule, diceHookStatus, diceRollPayload, dispatch, dispatchMany, displacementStatus, effectiveEffects: (scene, actorId) => effectiveEffectsFor(scene, actorById(scene, actorId)), effectAttackStatus, effectCellOccupancyStatus, effectDefenseStatus, effectExpiryStatus, effectMovementStatus, effectPresenceStatus, effectStatus, effectTargetingStatus, enemyRuleAutomation, evaluateDiceRoll, eventParticipants, masterAtArmsStatus, movementPath, movementTraceStatus, ownedEntities, pendingActionStatus, pendingTargetOutcome, prepareAction, prepareActionPlan, prepareActionPlanContinuation, prepareActionPlanModifierDestination, prepareActionPlanReappearance, prepareDisplacements, prepareEnemyDeployment, prepareEnemyRule, prepareInvisibleDisappear, preparePotionUse, prepareSacrifice, preparePromptPlacement, prepareSurgery, prepareTechniqueCombo, previewEvents, projectScene, reactionOptions, removedCellKeys, resetRuleClocks, resetRuleResources, resourceOperationStatus, resourceStatus, respondReaction, respondRulePrompt, resolvePendingAction, roundEndStatus, ruleChoiceStatus, ruleClockDefinitions, ruleDiceAdvantage, ruleModeDefinitions, ruleModeStatus, ruleResourceDefinitions, ruleResourceStatus, sideBalanceStatus, spatialShapeStatus, stanceStatus, summarizeEvents, targetStatus, techniqueComboStatus, terrainComponentStatus, terrainStatus, topologyStatus, topologyStepDestination, triggerQueueStatus, triggerRegistryStatus, triggerRouteStatus, turnActionProgressStatus, turnStartStatus, usageLimitStatus, validateEvent };
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.ruleModeContract = ruleModeContract;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.eventPacketContract = { validate: validateEventPacket, replayStatus: eventPacketReplayStatus, record: recordEventRequests, reserveIds: reserveEventIds, generatedId: generatedEventId, validateConsequences: validateEnemySummonPacket, dispatchContinuation: dispatchEventContinuation };
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.ruleModeState = ruleModeState;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.serializeRuleModeState = serializeRuleModeState;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.clearRuleModeState = clearRuleModeState;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.wallTargetingStatus = wallTargetingStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.ACTION_IDS = ACTION_IDS;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionIs = actionIs;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionIsAny = actionIsAny;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionIdIs = actionIdIs;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.canonicalActionId = canonicalActionId;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.actionByKey = actionByKey;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.fodderMoveStatus = fodderMoveStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.fodderMoveDestinations = fodderMoveDestinations;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.isEnemyModifier = isEnemyModifier;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.isAttachedModifier = isAttachedModifier;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.markerAttachmentStatus = markerAttachmentStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierConfigurationStatus = modifierConfigurationStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.prepareModifierConfigure = prepareModifierConfigure;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierActionStatus = modifierActionStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.prepareModifierAction = prepareModifierAction;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.prepareCollateralRescue = prepareCollateralRescue;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.compoundEnemyStatus = compoundEnemyStatus;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierRangeDistance = modifierRangeDistance;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.fodderBoundaryPromptEvents = fodderBoundaryPromptEvents;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierRoundEndEvents = modifierRoundEndEvents;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.lionwingLegionRoundStartEvents = lionwingLegionRoundStartEvents;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierKnockoutEvents = modifierKnockoutEvents;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.modifierMovementEvents = modifierMovementEvents;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.effectiveActorSpeed = effectiveActorSpeed;
(typeof window === "object" ? window : globalThis).DAWN_SCENE_ENGINE.berserkerPassiveEvents = (scene, event) => routeLegacyPromptEvents(scene, event, [], berserkerPassiveEvents(scene, event));
