import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
loadSceneEngine(context);
const Engine = context.DAWN_SCENE_ENGINE;
const data = context.DAWN_DATA;
const scene = {
  version: 0, round: 1, tension: 2, activeActorId: "hero",
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [
    { id: "hero", kind: "hero", name: "Эта", team: "hero", space: "main", x: 1, y: 1, ap: 3, baseAp: 3, focus: 50, hp: 12, maxHp: 12, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 4, spirit: 4, mind: 2 }, effects: [], usedActions: [], acted: false },
    { id: "enemy", kind: "enemy", name: "Ассасин", team: "enemy", profileId: "enemy.common.assassin", tier: 1, space: "main", x: 2, y: 1, ap: 2, baseAp: 2, focus: 0, hp: 10, maxHp: 10, armor: 1, evasion: 0, attrs: { body: 2, talent: 4, spirit: 1, mind: 2 }, effects: [], usedActions: [], usedTrump: false, acted: false },
  ], objects: [], markers: [], log: [], rollFeed: [],
};
const actionNamed = name => data.actions.list.find(action => action.name === name);
const prepareAttack = (source, actorId, targetId, actionName = "Стычка") => Engine.prepareAction(source, data, {
  actorId, actionId: actionNamed(actionName).id, targetIds: [targetId],
  roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});

const actions = Engine.availableActions(scene, data, "hero");
assert.equal(actions.length, 15);
assert.equal(actions.find(action => action.name === "Стычка").available, true);
assert.ok(actions.filter(action => action.reaction).every(action => !action.available), "Defenses cannot be spent as standalone Turn actions");
const freshTurnProgress = Engine.turnActionProgressStatus(scene, "hero");
assert.equal(freshTurnProgress.total, 3);
assert.equal(freshTurnProgress.currentAction, 1);
assert.deepEqual(Array.from(freshTurnProgress.labels), ["Ход начат", "Действие 1", "Действие 2", "Действие 3", "Завершить Ход"]);
const afterOneActionPoint = Engine.dispatch(scene, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 1 } }).scene;
assert.equal(Engine.turnActionProgressStatus(afterOneActionPoint, "hero").currentAction, 2);
const afterAllActionPoints = Engine.dispatch(afterOneActionPoint, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 2 } }).scene;
assert.equal(Engine.turnActionProgressStatus(afterAllActionPoints, "hero").readyToEnd, true);
assert.equal(Engine.turnActionProgressStatus(afterAllActionPoints, "hero").used, 3);
const afterQuickAction = Engine.dispatch(scene, { type: "action.prepare", actorId: "hero", payload: { actionId: "qa.quick", name: "Быстрое действие", quick: true } }).scene;
assert.equal(Engine.turnActionProgressStatus(afterQuickAction, "hero").currentAction, 1, "A Quick action does not occupy one of the three Turn action slots");
const idleScene = structuredClone(scene);
idleScene.activeActorId = null;
assert.ok(Engine.availableActions(idleScene, data, "hero").filter(action => !action.reaction).every(action => !action.available), "Ordinary actions require an explicitly started Turn");
assert.ok(Engine.availableEnemyRules(idleScene, data, "enemy").every(rule => !rule.available), "Enemy rules require an explicitly started Turn");
assert.equal(Engine.turnStartStatus(idleScene, "enemy").available, false, "A player begins a Round");
assert.equal(Engine.roundEndStatus(idleScene).available, false, "An untouched Round cannot be ended prematurely");
assert.throws(() => Engine.dispatch(scene, { type: "turn.start", actorId: "enemy", payload: {} }), /завершите текущий Ход/);
assert.throws(() => Engine.dispatch(scene, { type: "action.prepare", actorId: "enemy", payload: { actionId: "x", name: "Чужое действие", targetIds: [] } }), /не Ход/);

assert.throws(() => Engine.dispatch(scene, { type: "turn.end", actorId: "hero" }, { expectedVersion: 9 }), error => error.code === "SCENE_VERSION_CONFLICT");
const stableEvent = { id: "same-event", type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1 } };
const once = Engine.dispatch(scene, stableEvent).scene;
const twice = Engine.dispatch(once, stableEvent);
assert.equal(twice.duplicate, true);
assert.equal(twice.scene.actors[0].focus, 51, "Duplicate events are idempotent");
assert.throws(() => Engine.dispatch(scene, { type: "resource.gain", actorId: "hero", payload: { resource: "admin", amount: 9999 } }), /ресурса/);
assert.throws(() => Engine.dispatch(scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 99, y: 99 } }), /клетка/);
assert.throws(() => Engine.dispatch(scene, { type: "scene.replace", payload: { state: {} } }), /Неизвестный тип/);
const publicRoll = Engine.dispatch(scene, { type: "roll.public", actorId: "hero", payload: { formula: "4D6 ≥4", rolls: [6, 5, 2, 1], successes: 2, crits: 1, outcome: "Минимальный успех" } }).scene;
assert.equal(publicRoll.rollFeed[0].actor, "Эта");
assert.equal(publicRoll.rollFeed[0].outcome, "Минимальный успех");
assert.deepEqual(
  JSON.parse(JSON.stringify(Engine.eventParticipants(scene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", participantIds: ["hero", "enemy", "missing"] } }))),
  { sourceIds: ["hero"], targetIds: ["enemy"], actorIds: ["hero", "enemy"] },
  "Event participants must be canonical, role-aware, unique, and limited to actors on the Scene",
);
const previewSource = structuredClone(scene);
const preview = Engine.previewEvents(previewSource, [{ type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2 } }]);
assert.equal(preview.ok, true);
assert.equal(preview.scene.actors[0].focus, 52);
assert.equal(previewSource.actors[0].focus, 50, "Previewing an event chain must not mutate the source Scene");
const rejectedPreview = Engine.previewEvents(previewSource, [{ type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 99 } }]);
assert.equal(rejectedPreview.ok, false);
assert.equal(rejectedPreview.scene.actors[0].ap, 3);
assert.match(rejectedPreview.errors[0], /нельзя оплатить/);
const limitedScene = structuredClone(scene);
limitedScene.log = [
  { id: "limit-1", type: "technique.resolve", actorId: "hero", payload: { ruleId: "qa.limit" } },
  { id: "limit-2", type: "technique.resolve", actorId: "hero", payload: { sourceActionId: "qa.limit" } },
];
const availableLimit = Engine.usageLimitStatus(limitedScene, "hero", { ruleId: "qa.limit", scope: "scene", maximum: 3 });
assert.equal(availableLimit.available, true);
assert.equal(availableLimit.used, 2);
assert.equal(availableLimit.remaining, 1);
limitedScene.log.unshift({ id: "limit-3", type: "technique.resolve", actorId: "hero", payload: { techniqueRuleId: "qa.limit" } });
assert.equal(Engine.usageLimitStatus(limitedScene, "hero", { ruleId: "qa.limit", scope: "scene", maximum: 3 }).available, false, "The shared usage-limit contract recognizes all canonical rule references");
const choiceScene = structuredClone(scene);
choiceScene.pendingPrompt = { id: "choice-1", kind: "qa-choice", sourceActorId: "hero", targetId: "enemy", options: ["accept", "pass"] };
assert.equal(Engine.ruleChoiceStatus(choiceScene, { choice: "accept" }).available, true);
assert.equal(Engine.ruleChoiceStatus(choiceScene, { choice: "invented" }).available, false, "A typed choice is revalidated against the live prompt");
choiceScene.actors.find(actor => actor.id === "enemy").knockedOut = true;
assert.equal(Engine.ruleChoiceStatus(choiceScene, { choice: "accept" }).available, false, "A typed choice cannot retain an unavailable target");
assert.deepEqual(Array.from(Engine.actorIdsInCells(scene, "main", ["2,1"], { sourceActorId: "hero", audience: "enemies" })), ["enemy"]);
assert.deepEqual(Array.from(Engine.actorIdsInRange(scene, "hero", 1, { audience: "enemies" })), ["enemy"]);
const squareShape = Engine.spatialShapeStatus(scene, { space: "main", shape: "square3", anchor: { x: 2, y: 2 }, targets: { sourceActorId: "hero", audience: "enemies" } });
assert.equal(squareShape.available, true);
assert.equal(squareShape.cells.length, 9);
assert.deepEqual(Array.from(squareShape.targetIds), ["enemy"]);
assert.deepEqual(Array.from(Engine.spatialShapeStatus(scene, { space: "main", shape: "line", anchor: { x: 3, y: 3 }, orientation: "diagonal-up", full: true }).cells), ["0,6", "1,5", "2,4", "3,3", "4,2", "5,1", "6,0"]);
assert.equal(Engine.spatialShapeStatus(scene, { space: "main", shape: "connected", cells: ["0,0", "1,0", "1,1"] }).available, true);
assert.equal(Engine.spatialShapeStatus(scene, { space: "main", shape: "connected", cells: ["0,0", "2,0"] }).available, false);
const polygonShape = Engine.spatialShapeStatus(scene, { space: "main", shape: "polygon", vertices: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }] });
assert.equal(polygonShape.available, true);
assert.ok(polygonShape.cells.includes("2,2") && polygonShape.cells.includes("1,1"), "Polygon includes its interior and rasterized boundary");
assert.equal(Engine.targetStatus(scene, { sourceActorId: "hero", targetIds: ["enemy"], audience: "enemies", range: 1 }).available, true);
assert.equal(Engine.targetStatus(scene, { sourceActorId: "hero", targetIds: ["hero"], audience: "enemies", range: 1 }).available, false);
assert.equal(Engine.targetStatus(scene, { sourceActorId: "hero", targetIds: "enemy", min: 2, max: 1 }).available, false);
const pushStatus = Engine.displacementStatus(scene, { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1 });
assert.equal(pushStatus.available, true);
assert.deepEqual(JSON.parse(JSON.stringify(pushStatus.destination)), { space: "main", x: 3, y: 1 });
assert.equal(Engine.displacementStatus(scene, { actorId: "hero", destination: { x: 2, y: 1 }, maximum: 1 }).available, false, "Directed movement cannot finish in an occupied cell");
const displacementPlan = Engine.prepareDisplacements(scene, [
  { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1, name: "Тестовый толчок" },
  { actorId: "hero", destination: { x: 2, y: 1 }, maximum: 1, name: "Тестовый сдвиг" },
], { ruleId: "qa.displacement" });
assert.equal(displacementPlan.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(displacementPlan.scene.actors.map(actor => [actor.id, actor.x, actor.y]))), [["hero", 2, 1], ["enemy", 3, 1]], "Sequential displacement validates each destination against the already planned positions");
const movementTraces = Engine.movementTraceStatus(displacementPlan.scene, { space: "main" });
assert.equal(movementTraces.available, true);
assert.equal(movementTraces.traces.find(trace => trace.actorId === "hero").teleport, false);
assert.deepEqual(JSON.parse(JSON.stringify(movementTraces.traces.find(trace => trace.actorId === "hero").points)), [{ x: 1, y: 1 }, { x: 2, y: 1 }], "The board can project the latest ordinary movement from the event journal");
assert.equal(Engine.prepareDisplacements(scene, [
  { actorId: "hero", destination: { x: 2, y: 1 }, maximum: 1 },
  { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1 },
]).ok, false, "An invalid sequence is rejected atomically");
const displacementTerrain = structuredClone(scene);
displacementTerrain.objects.push({ id: "wall", space: "main", type: "terrain", label: "Стена", cells: ["3,1"] });
assert.equal(Engine.displacementStatus(displacementTerrain, { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1 }).available, false, "Forced movement respects blocking terrain");
const optionalDisplacements = Engine.prepareDisplacements(displacementTerrain, [
  { actorId: "enemy", mode: "push", sourceActorId: "hero", maximum: 1, allowPartial: true, optional: true },
]);
assert.equal(optionalDisplacements.ok, true);
assert.equal(optionalDisplacements.events.length, 0, "An optional member of a mass displacement may remain in place when immediately blocked");

const breacherScene = structuredClone(scene);
breacherScene.actors[0].techniques = { "powerhouse.breacher": 1 };
breacherScene.actors[1].x = 3;
const breacherAttack = prepareAttack(breacherScene, "hero", "enemy");
assert.equal(breacherAttack.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(breacherAttack.events.find(event => event.type === "attack.pending").payload.postDisplacements)), [{ targetId: "enemy", mode: "push", maximum: 1, name: "Картечь", ruleId: "powerhouse.breacher.1", collisionDamagePerCell: 0 }]);
let breacherFlow = Engine.dispatchMany(breacherScene, breacherAttack.events).scene;
breacherFlow = Engine.dispatchMany(breacherFlow, Engine.respondReaction(breacherFlow, data, { actorId: "enemy", choice: "pass" }).events).scene;
const breacherResolution = Engine.resolvePendingAction(breacherFlow, data);
assert.equal(breacherResolution.ok, true);
assert.ok(breacherResolution.events.some(event => event.type === "actor.move" && event.actorId === "enemy" && event.payload?.x === 4 && event.payload?.movement === "Картечь"), "Breacher I pushes a close successful Skirmish target through post-hit displacement");
assert.ok(!breacherResolution.events.some(event => event.type === "damage.apply" && event.payload?.sourceActionId === "powerhouse.breacher.1"), "Breacher I adds no collision damage");
const rangedBreacher = structuredClone(breacherScene);
rangedBreacher.actors[1].x = 5;
assert.equal(prepareAttack(rangedBreacher, "hero", "enemy").ok, true, "Breacher I extends Skirmish targeting to range 4");

const sirenStudyScene = structuredClone(scene);
sirenStudyScene.actors[0].techniques = { "disruptor.siren": 1 };
const sirenStudy = Engine.prepareAction(sirenStudyScene, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
assert.equal(sirenStudy.ok, true);
let sirenStudyFlow = Engine.dispatchMany(sirenStudyScene, sirenStudy.events).scene;
assert.equal(sirenStudyFlow.pendingPrompt?.kind, "siren-study-frighten");
assert.ok(sirenStudyFlow.log.some(event => event.type === "rule.trigger" && event.payload?.triggerId === "disruptor.siren.1.study" && event.payload?.status === "fired"), "A routed trigger records its source event and outcome");
assert.equal(Engine.ruleChoiceStatus(sirenStudyFlow, { choice: "frighten" }).available, true);
const sirenFrighten = Engine.respondRulePrompt(sirenStudyFlow, data, { choice: "frighten" });
assert.equal(sirenFrighten.ok, true);
sirenStudyFlow = Engine.dispatchMany(sirenStudyFlow, sirenFrighten.events).scene;
assert.ok(sirenStudyFlow.actors.find(actor => actor.id === "enemy").effects.includes("negative.испуган"), "Siren I applies Frightened through a typed decision");
const sirenLimit = Engine.usageLimitStatus(sirenStudyFlow, "hero", { ruleId: "disruptor.siren.1", scope: "scene", maximum: 3 });
assert.equal(sirenLimit.used, 1);
assert.equal(sirenLimit.remaining, 2);
const exhaustedSiren = structuredClone(sirenStudyScene);
exhaustedSiren.log = [1, 2, 3].map(index => ({ id: `siren-limit-${index}`, type: "technique.resolve", actorId: "hero", payload: { ruleId: "disruptor.siren.1" } }));
const exhaustedStudy = Engine.prepareAction(exhaustedSiren, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
const exhaustedStudyScene = Engine.dispatchMany(exhaustedSiren, exhaustedStudy.events).scene;
assert.notEqual(exhaustedStudyScene.pendingPrompt?.kind, "siren-study-frighten", "Siren I cannot offer a fourth use in the Scene");

const stableTriggerScene = structuredClone(sirenStudyScene);
const stableTriggerSource = { id: "stable-trigger-source", type: "action.resolve", actorId: "hero", payload: { name: "Изучение", targetIds: ["enemy"] } };
const stableTriggeredOnce = Engine.dispatchMany(stableTriggerScene, [stableTriggerSource]).scene;
const stableTriggerAuditCount = stableTriggeredOnce.log.filter(event => event.type === "rule.trigger" && event.payload?.sourceEventId === stableTriggerSource.id).length;
const stableTriggeredTwice = Engine.dispatchMany(stableTriggeredOnce, [stableTriggerSource]).scene;
assert.equal(stableTriggeredTwice.log.filter(event => event.type === "rule.trigger" && event.payload?.sourceEventId === stableTriggerSource.id).length, stableTriggerAuditCount, "Duplicate source events cannot emit their triggers twice");

const arbitrationScene = structuredClone(scene);
arbitrationScene.actors[1].techniques = { "disruptor.siren": 2 };
arbitrationScene.actors.push({ ...structuredClone(arbitrationScene.actors[0]), id: "empath", name: "Эмпат", x: 0, y: 1, techniques: { "altruist.empath": 2 } });
const arbitrationSource = { id: "trigger-arbitration-source", type: "effect.apply", actorId: "enemy", payload: { targetId: "hero", effect: "negative.испуган" } };
const arbitrationApplied = Engine.dispatch(arbitrationScene, arbitrationSource);
const triggerRegistry = Engine.triggerRegistryStatus();
assert.equal(triggerRegistry.available, true);
assert.equal(triggerRegistry.count, 6);
assert.ok(triggerRegistry.eventTypes.includes("effect.apply"));
assert.ok(triggerRegistry.rules.every(rule => typeof rule.id === "string" && Number.isInteger(rule.priority) && Array.isArray(rule.eventTypes)));
assert.throws(() => Engine.defineTriggerRule({ id: "bad trigger", eventTypes: ["effect.apply"], priority: 1, match: () => true, build: () => [] }), /id декларативного триггера/);
assert.throws(() => Engine.defineTriggerRule({ id: "qa.trigger", eventTypes: ["unknown.event"], priority: 1, match: () => true, build: () => [] }), /неизвестные исходные события/);
const arbitrationStatus = Engine.triggerRouteStatus(arbitrationApplied.scene, arbitrationApplied.event);
assert.deepEqual(Array.from(arbitrationStatus.selected, proposal => proposal.triggerId), ["disruptor.siren.2.frightened"]);
assert.deepEqual(Array.from(arbitrationStatus.queued, proposal => proposal.triggerId), ["altruist.empath.2.protective-response"]);
const arbitrated = Engine.dispatchMany(arbitrationScene, [arbitrationSource]).scene;
assert.equal(arbitrated.pendingPrompt?.kind, "siren-irresistible", "The highest-priority prompt wins trigger arbitration");
assert.ok(arbitrated.log.some(event => event.type === "rule.trigger" && event.payload?.triggerId === "altruist.empath.2.protective-response" && event.payload?.status === "queued"), "A lower-priority prompt remains in the persistent trigger queue");
assert.equal(arbitrated.triggerQueue.length, 1);
const publicTriggerQueue = Engine.triggerQueueStatus(arbitrated);
assert.equal(publicTriggerQueue.available, true);
assert.equal(publicTriggerQueue.count, 1);
assert.equal(publicTriggerQueue.next.triggerId, "altruist.empath.2.protective-response");
assert.equal(publicTriggerQueue.next.available, true);
publicTriggerQueue.next.event.payload.title = "Changed outside the Scene";
assert.notEqual(arbitrated.triggerQueue[0].event.payload.title, "Changed outside the Scene", "The public trigger queue is a read-only projection");
const resumedArbitration = Engine.dispatchMany(arbitrated, Engine.respondRulePrompt(arbitrated, data, { choice: "pass" }).events).scene;
assert.equal(resumedArbitration.pendingPrompt?.kind, "empath-rush", "The next valid trigger opens after the higher-priority decision closes");
assert.equal(resumedArbitration.triggerQueue.length, 0);
const interruptedArbitration = structuredClone(arbitrated);
interruptedArbitration.actors.find(actor => actor.id === "empath").knockedOut = true;
assert.match(Engine.triggerQueueStatus(interruptedArbitration).next.reason, /Источник/);
const cancelledQueuedTrigger = Engine.dispatchMany(interruptedArbitration, Engine.respondRulePrompt(interruptedArbitration, data, { choice: "pass" }).events).scene;
assert.equal(cancelledQueuedTrigger.pendingPrompt, null);
assert.equal(cancelledQueuedTrigger.triggerQueue.length, 0);
assert.ok(cancelledQueuedTrigger.log.some(event => event.type === "rule.trigger" && event.payload?.triggerId === "altruist.empath.2.protective-response" && event.payload?.status === "cancelled" && /Источник/.test(event.payload.reason)), "An interrupted queued trigger is cancelled with an explicit reason");
assert.throws(() => Engine.dispatch(scene, { type: "rule.trigger", actorId: "hero", payload: { triggerId: "bad trigger", sourceEventId: "x", status: "fired" } }), /маршрутизации триггера/);

const sirenScene = structuredClone(scene);
sirenScene.actors[0].techniques = { "disruptor.siren": 2 };
sirenScene.actors[1].x = 5;
let sirenFlow = Engine.dispatchMany(sirenScene, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.испуган", sourceActionId: "disruptor.siren.1" } }]).scene;
assert.equal(sirenFlow.pendingPrompt?.kind, "siren-irresistible");
sirenFlow = Engine.dispatchMany(sirenFlow, Engine.respondRulePrompt(sirenFlow, data, { choice: "rush" }).events).scene;
assert.equal(sirenFlow.pendingPrompt?.kind, "siren-irresistible-cell");
assert.equal(Engine.preparePromptPlacement(sirenFlow, { destination: { x: 5, y: 2 } }).ok, false, "Siren II rejects a path whose steps do not approach the Siren");
const sirenPlacement = Engine.preparePromptPlacement(sirenFlow, { destination: { x: 2, y: 1 } });
assert.equal(sirenPlacement.ok, true);
sirenFlow = Engine.dispatchMany(sirenFlow, sirenPlacement.events).scene;
assert.equal(sirenFlow.actors.find(actor => actor.id === "enemy").x, 2);
assert.ok(sirenFlow.actors.find(actor => actor.id === "enemy").effects.includes("negative.ошеломлен"), "Siren II applies Stunned after ending adjacent");
assert.ok(sirenFlow.log.some(event => event.type === "technique.resolve" && event.payload?.ruleId === "disruptor.siren.2"), "Siren II records its once-per-Turn use");

const warringScene = structuredClone(scene);
warringScene.actors[0].techniques = { "powerhouse.warring-ascendant": 1 };
let warringFlow = Engine.dispatchMany(warringScene, [{ type: "action.resolve", actorId: "hero", payload: { name: "Зарядка" } }]).scene;
assert.equal(warringFlow.pendingPrompt?.kind, "warring-transform");
const warringTransform = Engine.respondRulePrompt(warringFlow, data, { choice: "transform" });
assert.equal(warringTransform.ok, true);
warringFlow = Engine.dispatchMany(warringFlow, warringTransform.events).scene;
assert.equal(warringFlow.actors.find(actor => actor.id === "enemy").x, 5, "Warring Ascendant I uses the shared mass-push plan");
assert.equal(warringFlow.actors.find(actor => actor.id === "hero").ruleState.warringTransformed, true);
assert.equal(warringFlow.actors.find(actor => actor.id === "hero").ruleState.warringUsed, true);
assert.equal(Engine.topologyStatus(scene, { space: "main", cells: ["1,1"], operation: "remove" }).available, false, "Occupied cells cannot disappear before their actors are moved");
const topologyScene = structuredClone(scene);
topologyScene.actors[1].x = 6;
topologyScene.actors[1].y = 6;
const cutCells = Array.from({ length: 7 }, (_, y) => `2,${y}`);
const cutResult = Engine.dispatch(topologyScene, {
  id: "stable-topology-cut",
  type: "topology.cells.remove",
  actorId: "hero",
  payload: { id: "test-cut", space: "main", cells: cutCells, label: "Тестовый разрыв", source: "QA" },
});
assert.deepEqual(Array.from(Engine.removedCellKeys(cutResult.scene, "main")), cutCells);
assert.equal(Engine.movementPath(cutResult.scene, "hero", { x: 4, y: 1 }, { maxDistance: 20 }).length, 0, "Removed cells split movement topology even when terrain is ignored");
assert.throws(() => Engine.dispatch(cutResult.scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 2, y: 1 } }), /удалённую клетку/);
assert.throws(() => Engine.dispatch(cutResult.scene, { type: "topology.cells.remove", payload: { id: "overlap", space: "main", cells: ["2,2"], label: "Повтор" } }), /уже удалена/);
const restoredTopology = Engine.dispatch(cutResult.scene, { type: "topology.cells.restore", actorId: "hero", payload: { cutId: "test-cut" } }).scene;
assert.equal(Engine.removedCellKeys(restoredTopology, "main").size, 0);
assert.ok(Engine.movementPath(restoredTopology, "hero", { x: 4, y: 1 }, { maxDistance: 20 }).length > 0, "Restoring a cut restores pathfinding");
const crossingSource = structuredClone(topologyScene);
crossingSource.objects = [
  { id: "terrain-a", space: "main", type: "terrain", label: "Стена A", cells: ["2,1"] },
  { id: "terrain-b", space: "main", type: "terrain", label: "Стена B", cells: ["3,1"] },
  { id: "terrain-c", space: "main", type: "terrain", label: "Отдельная стена", cells: ["6,0"] },
];
assert.deepEqual(Array.from(Engine.terrainComponentStatus(crossingSource, { space: "main", cells: ["2,1"] }).objectIds), ["terrain-a", "terrain-b"]);
const crossingResult = Engine.dispatch(crossingSource, {
  type: "topology.cells.remove", actorId: "hero",
  payload: { id: "crossing-cut", space: "main", cells: cutCells, label: "Проходимый разрыв", crossing: "opposite", destroyConnectedTerrain: true },
});
assert.deepEqual(Array.from(crossingResult.event.payload.destroyedTerrainIds), ["terrain-a", "terrain-b"]);
assert.deepEqual(Array.from(crossingResult.scene.objects.map(object => object.id)), ["terrain-c"]);
assert.deepEqual(JSON.parse(JSON.stringify(Engine.topologyStepDestination(crossingResult.scene, { space: "main", from: { x: 1, y: 1 }, attempted: { x: 2, y: 1 } }))), { x: 3, y: 1, teleported: true, crossedCutIds: ["crossing-cut"] });
const tracedTeleport = Engine.dispatch(crossingResult.scene, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 3, y: 1, movement: "Телепортация через разрыв", topologyCrossings: [{ destination: "3,1", cutIds: ["crossing-cut"] }] } }).scene;
assert.equal(Engine.movementTraceStatus(tracedTeleport, { space: "main" }).traces.find(trace => trace.actorId === "hero").teleport, true, "Teleport traces are classified separately from ordinary movement");
assert.deepEqual(JSON.parse(JSON.stringify(Engine.movementPath(crossingResult.scene, "hero", { x: 4, y: 1 }, { maxDistance: 4 }))), [{ x: 3, y: 1, teleported: true, crossedCutIds: ["crossing-cut"] }, { x: 4, y: 1 }], "A crossable cut teleports movement to its nearest opposite cell");
const crossingStep = Engine.prepareAction(crossingResult.scene, data, { actorId: "hero", actionId: actionNamed("Шаг").id, targetIds: [], destination: { x: 4, y: 1 } });
assert.equal(crossingStep.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(crossingStep.events.find(event => event.type === "actor.move").payload.topologyCrossings)), [{ destination: "3,1", cutIds: ["crossing-cut"] }], "Movement events journal the topological teleport explicitly");
assert.deepEqual(JSON.parse(JSON.stringify(Engine.resourceStatus(scene, "hero", { ap: 2, focus: 51 }).missing)), { focus: 1 });
assert.equal(Engine.resourceStatus(scene, "hero", ["ap"]).available, false);
assert.deepEqual(JSON.parse(JSON.stringify(Engine.effectStatus(scene, "hero", "positive.ускорен"))), { active: false, direct: false, ambient: false });
const querySummary = Engine.summarizeEvents(scene, [
  { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 1, participantIds: ["hero"] } },
  { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 2, affectedCells: ["2,1"] } },
]);
assert.equal(querySummary.count, 2);
assert.deepEqual(JSON.parse(JSON.stringify(querySummary.eventTypes)), { "resource.spend": 1, "damage.apply": 1 });
assert.deepEqual(Array.from(querySummary.sourceIds), ["hero"]);
assert.deepEqual(Array.from(querySummary.targetIds), ["enemy"]);
assert.deepEqual(JSON.parse(JSON.stringify(querySummary.resourceDelta)), { hero: { ap: -1 } });
assert.deepEqual(Array.from(querySummary.affectedCells), ["2,1"]);
assert.equal(Engine.summarizeEvents(scene, null).count, 0);
const foundationScene = structuredClone(scene);
foundationScene.actors[0].ruleClocks = { pride: 2 };
foundationScene.actors[0].alternateResources = { bullets: 4 };
foundationScene.actors[0].ruleState = { stance: "ground" };
foundationScene.actors[0].effects = ["positive.ускорен"];
foundationScene.markers = [{ id: "summon", ownerActorId: "hero", kind: "summon", ruleId: "bulwark.servant-s-call.1" }];
foundationScene.objects = [{ id: "crate", ownerActorId: "hero", space: "main", type: "terrain", hp: 10, cells: ["2,1"], ruleId: "powerhouse.improvisational-fighter.1" }];
foundationScene.log = [
  { id: "spell", type: "action.prepare", actorId: "hero", payload: { actionName: "Заклинание", targetIds: ["enemy"] } },
  { id: "turn", type: "turn.start", actorId: "hero", payload: {} },
];
const legacyClockStatus = Engine.clockStatus(foundationScene, "hero", "pride", { size: 6, delta: 1 });
assert.deepEqual(JSON.parse(JSON.stringify(Object.fromEntries(["available", "id", "size", "value", "nextValue", "remaining", "empty", "full"].map(key => [key, legacyClockStatus[key]])))), { available: true, id: "pride", size: 6, value: 2, nextValue: 3, remaining: 3, empty: false, full: false });
assert.equal(Engine.alternateResourceStatus(foundationScene, "hero", { resource: "bullets", amount: 3, replaces: ["focus"] }).remaining, 1);
assert.deepEqual(Array.from(Engine.stanceStatus(foundationScene, "hero", "flight", { requiredEffects: ["positive.ускорен"] }).conflicts), ["ground"]);
assert.deepEqual(Array.from(Engine.ownedEntities(foundationScene, "hero", { kinds: ["summon"] }).markers), ["summon"]);
assert.equal(Engine.actionHistoryStatus(foundationScene, "hero", { scope: "turn", actionNames: ["Заклинание"], targetIds: ["enemy"] }).matched, true);
assert.equal(Engine.terrainStatus(foundationScene, { actorId: "hero", objectId: "crate", range: 1 }).available, true);

const configuredResource = Engine.dispatch(scene, {
  type: "rule-resource.configure",
  actorId: "hero",
  payload: { resource: "crystals", label: "Crystals", initial: 3, minimum: 0, maximum: 5, replaces: ["focus"], resetScope: "scene" },
}).scene;
assert.equal(Engine.ruleResourceStatus(configuredResource, "hero", { resource: "crystals" }).balance, 3);
const configuredSpentOnce = Engine.dispatch(configuredResource, { id: "stable-crystal-spend", type: "rule-resource.spend", actorId: "hero", payload: { resource: "crystals", amount: 2 } }).scene;
const configuredSpentTwice = Engine.dispatch(configuredSpentOnce, { id: "stable-crystal-spend", type: "rule-resource.spend", actorId: "hero", payload: { resource: "crystals", amount: 2 } });
assert.equal(configuredSpentTwice.duplicate, true);
assert.equal(Engine.ruleResourceStatus(configuredSpentTwice.scene, "hero", { resource: "crystals" }).balance, 1, "Named resource events are idempotent");
const configuredSet = Engine.dispatch(configuredSpentTwice.scene, { type: "rule-resource.set", actorId: "hero", payload: { resource: "crystals", value: 5 } }).scene;
const configuredReset = Engine.dispatch(configuredSet, { type: "rule-resource.reset", actorId: "hero", payload: { resource: "crystals", scope: "scene" } }).scene;
assert.equal(Engine.ruleResourceStatus(configuredReset, "hero", { resource: "crystals" }).balance, 3, "Set and reset share the validated resource definition");

const configuredClock = Engine.dispatch(scene, {
  type: "rule-clock.configure", actorId: "hero",
  payload: { clockId: "test.momentum", label: "Импульс", size: 4, minimumSize: 2, initial: 1, resetScope: "scene", value: 1 },
}).scene;
assert.equal(Engine.clockStatus(configuredClock, "hero", "test.momentum").value, 1);
const clockTickedOnce = Engine.dispatch(configuredClock, { id: "stable-clock-tick", type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 2 } }).scene;
const clockTickedTwice = Engine.dispatch(clockTickedOnce, { id: "stable-clock-tick", type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 2 } });
assert.equal(clockTickedTwice.duplicate, true);
assert.equal(Engine.clockStatus(clockTickedTwice.scene, "hero", "test.momentum").value, 3, "Clock ticks are idempotent");
assert.equal(clockTickedTwice.scene.log[0].payload.appliedDelta, 2);
assert.throws(() => Engine.dispatch(configuredClock, { type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: -2 } }), /недостаточно сегментов/i);
const clockFilled = Engine.dispatch(clockTickedTwice.scene, { type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 1 } }).scene;
assert.equal(clockFilled.log[0].payload.filled, true);
const clockReset = Engine.dispatch(clockFilled, { type: "rule-clock.reset", actorId: "hero", payload: { clockId: "test.momentum", scope: "scene" } }).scene;
assert.equal(Engine.clockStatus(clockReset, "hero", "test.momentum").value, 1);
assert.throws(() => Engine.dispatch(configuredClock, { type: "rule-clock.tick", actorId: "hero", payload: { clockId: "test.momentum", delta: 1 } }, { expectedVersion: 99 }), error => error.code === "SCENE_VERSION_CONFLICT");

const braggartScene = structuredClone(scene);
braggartScene.actors[0].techniques = { "powerhouse.braggart": 3 };
braggartScene.actors[0].ruleClocks = { "powerhouse.braggart.pride": { clockId: "powerhouse.braggart.pride", label: "Гордость", size: 6, minimumSize: 2, initial: 0, resetScope: "scene", active: true, value: 5 } };
const proudAttack = Engine.dispatchMany(braggartScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: "low-attack", name: "Стычка", attribute: "mind", targetIds: ["enemy"] } }]).scene;
assert.equal(Engine.clockStatus(proudAttack, "hero", "powerhouse.braggart.pride").full, true);
assert.equal(proudAttack.pendingPrompt?.kind, "braggart-hold-back");
const heldBack = Engine.dispatchMany(proudAttack, Engine.respondRulePrompt(proudAttack, data, { choice: "hold-back" }).events).scene;
assert.equal(Engine.clockStatus(heldBack, "hero", "powerhouse.braggart.pride").size, 4);
assert.equal(Engine.clockStatus(heldBack, "hero", "powerhouse.braggart.pride").value, 0);
const refilledPride = Engine.dispatch(heldBack, { type: "rule-clock.set", actorId: "hero", payload: { clockId: "powerhouse.braggart.pride", value: 4 } }).scene;
assert.equal(Engine.ruleDiceAdvantage(refilledPride, "hero", { actionName: "Стычка" }).total, 2, "Shrunken full Pride grants the increased Advantage");

const staticScene = structuredClone(scene);
staticScene.actors[0].techniques = { "ruiner.thunder-blood": 3 };
const staticRest = Engine.prepareAction(staticScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const staticPrompt = Engine.dispatchMany(staticScene, staticRest.events).scene;
assert.equal(staticPrompt.pendingPrompt?.kind, "thunder-rest-static");
const staticFilled = Engine.dispatchMany(staticPrompt, Engine.respondRulePrompt(staticPrompt, data, { choice: "fill" }).events).scene;
assert.equal(Engine.clockStatus(staticFilled, "hero", "ruiner.thunder-blood.static").value, 4);
const staticImmune = Engine.dispatchMany(staticFilled, [{ type: "effect.apply", actorId: "enemy", payload: { targetId: "hero", effect: "negative.ошеломлен" } }]).scene;
assert.ok(!staticImmune.actors[0].effects.includes("negative.ошеломлен"), "Non-empty Static grants immunity to Stunned");
const chargedScene = structuredClone(scene);
chargedScene.actors[0].techniques = { "ruiner.thunder-blood": 2 };
chargedScene.actors[0].ruleClocks = { "ruiner.thunder-blood.static": { clockId: "ruiner.thunder-blood.static", label: "Статика", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 2 } };
chargedScene.actors.push({ ...structuredClone(chargedScene.actors[1]), id: "enemy-2", name: "Вторая цель", x: 4, y: 1 });
const chargedResolved = Engine.dispatchMany(chargedScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: actionNamed("Заклинание").id, name: "Заклинание", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 }, targetIds: ["enemy"] } }]).scene;
assert.equal(chargedResolved.pendingPrompt?.kind, "thunder-charged-spell");
assert.ok(chargedResolved.pendingPrompt.options.includes("chain:enemy"), "Chain is offered when another enemy is within 5 cells of the original target");
const discharged = Engine.dispatchMany(chargedResolved, Engine.respondRulePrompt(chargedResolved, data, { choice: "discharge:enemy" }).events).scene;
assert.equal(Engine.clockStatus(discharged, "hero", "ruiner.thunder-blood.static").value, 1);
assert.ok(discharged.actors.find(actor => actor.id === "enemy").effects.includes("negative.ошеломлен"));
assert.ok(!discharged.actors.find(actor => actor.id === "hero").effects.includes("negative.ошеломлен"), "Remaining Static removes the self-applied Stunned effect");
const surgeSelected = Engine.dispatchMany(chargedResolved, Engine.respondRulePrompt(chargedResolved, data, { choice: "surge:enemy" }).events).scene;
assert.equal(surgeSelected.pendingPrompt?.kind, "thunder-surge-cell");
assert.equal(Engine.clockStatus(surgeSelected, "hero", "ruiner.thunder-blood.static").value, 2, "Surge does not spend Static before a destination is committed");
const surgeCancelled = Engine.dispatchMany(surgeSelected, Engine.respondRulePrompt(surgeSelected, data, { choice: "cancel" }).events).scene;
assert.equal(Engine.clockStatus(surgeCancelled, "hero", "ruiner.thunder-blood.static").value, 2, "Cancelling Surge preserves Static");
const surged = Engine.dispatchMany(surgeSelected, Engine.preparePromptPlacement(surgeSelected, { destination: { x: 2, y: 2 } }).events).scene;
assert.equal(Engine.clockStatus(surged, "hero", "ruiner.thunder-blood.static").value, 1);
assert.deepEqual([surged.actors[0].x, surged.actors[0].y], [2, 2]);
const chainSelected = Engine.dispatchMany(chargedResolved, Engine.respondRulePrompt(chargedResolved, data, { choice: "chain:enemy" }).events).scene;
assert.equal(chainSelected.pendingPrompt?.kind, "thunder-chain-target");
const chainPrepared = Engine.respondRulePrompt(chainSelected, data, { choice: "target:enemy-2", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 4, 3, 1], successes: 2, crits: 1 } });
assert.equal(chainPrepared.ok, true);
const chainPending = Engine.dispatchMany(chainSelected, chainPrepared.events).scene;
assert.equal(chainPending.pendingAction?.techniqueRuleId, "ruiner.thunder-blood.2");
assert.equal(chainPending.pendingAction?.responses?.["enemy-2"]?.choice, "pending", "Chain creates a new attack with target Reactions");
const dischargeAreaScene = structuredClone(scene);
dischargeAreaScene.actors[0].tier = 2;
dischargeAreaScene.actors[0].techniques = { "ruiner.thunder-blood": 3 };
dischargeAreaScene.actors[0].ruleClocks = { "ruiner.thunder-blood.static": { clockId: "ruiner.thunder-blood.static", label: "Статика", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 3 } };
dischargeAreaScene.actors[1].effects = ["negative.ошеломлен"];
dischargeAreaScene.actors.push({ ...structuredClone(dischargeAreaScene.actors[0]), id: "ally", name: "Союзник", x: 0, y: 1, techniques: {}, ruleClocks: {} });
const dischargeArea = Engine.prepareAction(dischargeAreaScene, data, { actorId: "hero", actionId: actionNamed("Завершение").id, useThunderDischarge: true, attribute: "spirit", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(dischargeArea.ok, true);
const dischargePendingEvent = dischargeArea.events.find(event => event.type === "attack.pending");
assert.deepEqual(Array.from(dischargePendingEvent.payload.targetIds).sort(), ["ally", "enemy"]);
assert.equal(dischargePendingEvent.payload.damageByTarget.enemy, dischargePendingEvent.payload.damageByTarget.ally + 2, "Already Stunned targets take Tier bonus damage");
const eclipseScene = structuredClone(scene);
eclipseScene.actors[0].techniques = { "ruiner.void-soul": 3 };
eclipseScene.actors[0].ruleClocks = { "ruiner.void-soul.void": { clockId: "ruiner.void-soul.void", label: "Пустота", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 6 } };
eclipseScene.actors.push({ ...structuredClone(eclipseScene.actors[1]), id: "enemy-far", name: "Вне затмения", x: 6, y: 6 });
const eclipse = Engine.prepareAction(eclipseScene, data, { actorId: "hero", actionId: actionNamed("Завершение").id, useEclipseStars: true, attribute: "spirit", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(eclipse.ok, true);
const eclipsePending = eclipse.events.find(event => event.type === "attack.pending").payload;
assert.deepEqual(Array.from(eclipsePending.targetIds), ["enemy"]);
assert.equal(eclipsePending.damageByTarget.enemy, 2, "Eclipse deals half of the normal Finish damage");
const spellAdvantageScene = structuredClone(scene);
spellAdvantageScene.actors[0].techniques = { "altruist.chronomancer": 2, "ruiner.cryomancer": 2, "ruiner.feral-arcana": 3, "ruiner.thunder-blood": 2 };
assert.equal(Engine.ruleDiceAdvantage(spellAdvantageScene, "hero", { actionName: "Заклинание" }).total, 3, "Chronomancer II, Cryomancer II and Feral Arcana III grant Spell Advantage");
spellAdvantageScene.actors[0].techniques["ruiner.thunder-blood"] = 3;
assert.equal(Engine.ruleDiceAdvantage(spellAdvantageScene, "hero", { actionName: "Заклинание" }).total, 4, "Thunder Blood grants Spell Advantage only at level III");
const icicleScene = structuredClone(scene);
icicleScene.actors[0].techniques = { "ruiner.cryomancer": 2 };
icicleScene.actors[0].ruleClocks = { "ruiner.cryomancer.icicle": { clockId: "ruiner.cryomancer.icicle", label: "Сосулька", size: 4, minimumSize: 4, initial: 0, resetScope: "scene", active: true, value: 3 } };
icicleScene.actors[1].effects = ["negative.замедлен"];
const icicleRest = Engine.dispatchMany(icicleScene, Engine.prepareAction(icicleScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).events).scene;
assert.equal(icicleRest.pendingPrompt?.kind, "cryomancer-icicle-rest");
const icicleConverted = Engine.dispatchMany(icicleRest, Engine.respondRulePrompt(icicleRest, data, { choice: "convert" }).events).scene;
assert.equal(icicleConverted.pendingPrompt?.kind, "cryomancer-icicle-series");
assert.equal(icicleConverted.actors[0].focus, 50, "Converting Icicle refuses the Focus gained from Rest");
const icicleContinued = Engine.dispatchMany(icicleConverted, Engine.respondRulePrompt(icicleConverted, data, { choice: "continue" }).events).scene;
assert.equal(Engine.availableActions(icicleContinued, data, "hero").find(action => action.name === "Заклинание").quick, true);
assert.match(Engine.availableActions(icicleContinued, data, "hero").find(action => action.name === "Зарядка").reason, /Сосульки/);
const icicleSpell = Engine.prepareAction(icicleContinued, data, { actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], roll: { formula: "5D6", attribute: "spirit", rolls: [6, 5, 4, 2, 1], successes: 3, crits: 1 } });
const iciclePending = Engine.dispatchMany(icicleContinued, icicleSpell.events).scene;
assert.equal(iciclePending.pendingAction.damage, 2, "Icicle Spells deal half damage");
const iciclePassed = Engine.dispatchMany(iciclePending, Engine.respondReaction(iciclePending, data, { actorId: "enemy", choice: "pass" }).events).scene;
const icicleResolved = Engine.dispatchMany(iciclePassed, Engine.resolvePendingAction(iciclePassed, data).events).scene;
assert.equal(icicleResolved.actors[0].ruleState.icicleSpellsRemaining, 3);
assert.ok(icicleResolved.actors[1].effects.includes("negative.обездвижен"));
assert.equal(icicleResolved.pendingPrompt?.kind, "cryomancer-icicle-series");

const styleScene = structuredClone(scene);
styleScene.actors[0].techniques = { "vagabond.egomaniac": 2 };
styleScene.actors[0].ruleClocks = { "vagabond.egomaniac.style": { clockId: "vagabond.egomaniac.style", label: "Стиль", size: 4, minimumSize: 4, initial: 0, resetScope: "scene", active: true, value: 3 } };
const stylish = Engine.dispatchMany(styleScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: "stylish-hit", name: "Стычка", attribute: "talent", roll: { crits: 2 }, targetIds: ["enemy"] } }]).scene;
assert.equal(stylish.pendingPrompt?.kind, "egomaniac-style-full");
const stylishProvoke = Engine.dispatchMany(stylish, Engine.respondRulePrompt(stylish, data, { choice: "provoke" }).events).scene;
assert.equal(Engine.clockStatus(stylishProvoke, "hero", "vagabond.egomaniac.style").value, 0);
assert.ok(stylishProvoke.actors[1].effects.includes("negative.спровоцирован"));
const finaleScene = structuredClone(scene);
finaleScene.tension = 3;
finaleScene.actors[0].techniques = { "vagabond.egomaniac": 3 };
finaleScene.actors[0].ruleClocks = { "vagabond.egomaniac.style": { clockId: "vagabond.egomaniac.style", label: "Стиль", size: 4, minimumSize: 4, initial: 0, resetScope: "scene", active: true, value: 3 } };
const finaleOffered = Engine.dispatchMany(finaleScene, [{ type: "action.resolve", actorId: "hero", payload: { actionId: actionNamed("Зарядка").id, name: "Зарядка", targetIds: [] } }]).scene;
const finaleStarted = Engine.dispatchMany(finaleOffered, Engine.respondRulePrompt(finaleOffered, data, { choice: "finale" }).events).scene;
assert.equal(finaleStarted.pendingPrompt?.kind, "egomaniac-style-full");
assert.equal(finaleStarted.actors[0].ruleState.styleCarryRemaining, 5);
const finaleFirst = Engine.dispatchMany(finaleStarted, Engine.respondRulePrompt(finaleStarted, data, { choice: "provoke" }).events).scene;
assert.equal(finaleFirst.pendingPrompt?.kind, "egomaniac-style-full");
assert.equal(finaleFirst.actors[0].ruleState.styleCarryRemaining, 1);
const finaleSecond = Engine.dispatchMany(finaleFirst, Engine.respondRulePrompt(finaleFirst, data, { choice: "frighten" }).events).scene;
assert.equal(Engine.clockStatus(finaleSecond, "hero", "vagabond.egomaniac.style").value, 1);
assert.equal(Engine.clockStatus(finaleSecond, "hero", "vagabond.egomaniac.style").active, false, "Finale carries all segments through multiple fills, then disables Style");

const rageScene = structuredClone(scene);
rageScene.actors[0].techniques = { "ruiner.feral-arcana": 2 };
const unleashed = Engine.prepareAction(rageScene, data, { actorId: "hero", actionId: actionNamed("Взаимодействие").id, startRage: true, targetIds: ["enemy"] });
assert.equal(unleashed.ok, true, "Rage explicitly replaces a targetless Interaction");
const raging = Engine.dispatchMany(rageScene, unleashed.events).scene;
assert.equal(Engine.clockStatus(raging, "hero", "ruiner.feral-arcana.rage").value, 3);
assert.equal(Engine.availableActions(raging, data, "hero").find(action => action.name === "Прыжок").quick, true);
assert.match(Engine.availableActions(raging, data, "hero").find(action => action.name === "Передышка").reason, /Ярость/);
const rageJumped = Engine.dispatchMany(raging, [{ type: "action.resolve", actorId: "hero", payload: { actionId: actionNamed("Прыжок").id, name: "Прыжок", targetIds: [] } }]).scene;
assert.equal(rageJumped.pendingPrompt?.kind, "feral-rage-jump-spell", "A Rage Jump requires the follow-up Spell");
assert.deepEqual(Array.from(rageJumped.pendingPrompt.context.targetIds), ["enemy"]);
const rageSpell = Engine.respondRulePrompt(rageJumped, data, { choice: "attack", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(rageSpell.ok, true);
const rageSpellPending = Engine.dispatchMany(rageJumped, rageSpell.events).scene;
assert.equal(rageSpellPending.pendingAction?.techniqueRuleId, "ruiner.feral-arcana.2");
assert.equal(rageSpellPending.pendingAction?.responses?.enemy?.choice, "pending", "The mandatory Rage Spell still offers target Reactions");
const fadingRage = Engine.dispatch(raging, { type: "rule-clock.set", actorId: "hero", payload: { clockId: "ruiner.feral-arcana.rage", value: 1, active: true } }).scene;
const rageEnded = Engine.dispatchMany(fadingRage, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.equal(Engine.clockStatus(rageEnded, "hero", "ruiner.feral-arcana.rage").active, false);
assert.ok(rageEnded.actors[0].effects.includes("negative.ошеломлен"));

const sentryScene = structuredClone(scene);
sentryScene.actors[0].techniques = { "bulwark.stalwart-sentry": 2 };
sentryScene.actors[0].ruleClocks = { "bulwark.stalwart-sentry.vigilance": { clockId: "bulwark.stalwart-sentry.vigilance", label: "Бдительность", size: 4, minimumSize: 4, initial: 4, resetScope: "scene", active: true, value: 2 } };
const leftSentry = Engine.dispatchMany(sentryScene, [{ type: "actor.move", actorId: "enemy", payload: { space: "main", x: 4, y: 1, movement: "Шаг" } }]).scene;
assert.equal(leftSentry.pendingPrompt?.kind, "sentry-punishment");
const punishment = Engine.respondRulePrompt(leftSentry, data, { choice: "punish-free", roll: { formula: "4D6", attribute: "talent", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
const punishmentPending = Engine.dispatchMany(leftSentry, punishment.events).scene;
assert.equal(Engine.clockStatus(punishmentPending, "hero", "bulwark.stalwart-sentry.vigilance").value, 1);
assert.equal(punishmentPending.pendingAction?.name, "Наказание");
assert.equal(punishmentPending.pendingAction?.responses?.enemy?.choice, "pending");
const graspScene = structuredClone(scene);
graspScene.actors[0].techniques = { "ruiner.feral-arcana": 3 };
graspScene.actors[0].ruleClocks = { "ruiner.feral-arcana.rage": { clockId: "ruiner.feral-arcana.rage", label: "Ярость", size: 6, minimumSize: 6, initial: 0, resetScope: null, active: true, removeWhenEmpty: true, value: 4 } };
const grasp = Engine.prepareAction(graspScene, data, { actorId: "hero", actionId: actionNamed("Завершение").id, targetIds: ["enemy"], destination: { x: 2, y: 2 }, useGrasp: true, attribute: "body", roll: { formula: "5D6", attribute: "body", rolls: [6, 5, 4, 2, 1], successes: 3, crits: 1 } });
assert.equal(grasp.ok, true);
const graspMoved = Engine.dispatchMany(graspScene, grasp.events).scene;
assert.equal(Engine.clockStatus(graspMoved, "hero", "ruiner.feral-arcana.rage").value, 0);
assert.deepEqual([graspMoved.actors[0].x, graspMoved.actors[0].y], [2, 2]);
assert.ok(graspMoved.actors[0].effects.includes("negative.ошеломлен"));

const timeStopScene = structuredClone(scene);
timeStopScene.activeActorId = null;
timeStopScene.actors[0].techniques = { "altruist.chronomancer": 3 };
timeStopScene.actors[0].ruleClocks = { "altruist.chronomancer.flow": { clockId: "altruist.chronomancer.flow", label: "Поток", size: 8, minimumSize: 8, initial: 0, resetScope: "scene", active: true, value: 8 } };
const timeStopOffered = Engine.dispatchMany(timeStopScene, [{ type: "turn.start", actorId: "hero", payload: {} }]).scene;
assert.equal(timeStopOffered.pendingPrompt?.kind, "chronomancer-time-stop");
const timeStop = Engine.respondRulePrompt(timeStopOffered, data, { choice: "time-stop-all-in", roll: { formula: "5D6", attribute: "spirit", rolls: [6, 5, 4, 2, 1], successes: 3, crits: 1 } });
const timeStopped = Engine.dispatchMany(timeStopOffered, timeStop.events).scene;
assert.equal(timeStopped.actors[0].ap, 0);
assert.equal(timeStopped.actors[0].ruleState.timeStopUsed, true);
assert.equal(Engine.clockStatus(timeStopped, "hero", "altruist.chronomancer.flow").value, 0);
assert.equal(timeStopped.pendingAction.damageByTarget.enemy, 5);
assert.equal(timeStopped.pendingAction.damageByTarget.hero, 3);

const zealotScene = structuredClone(scene);
zealotScene.actors[0].tier = 1;
zealotScene.actors[0].techniques = { "ruiner.zealot": 1 };
zealotScene.actors[0].ruleClocks = { "ruiner.zealot.revelation": { clockId: "ruiner.zealot.revelation", label: "Озарение", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 2 } };
const zealotAction = Engine.dispatch(zealotScene, { id: "zealot-action-instance", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Заклинание").id, actionName: "Заклинание", name: "Заклинание", targetIds: ["enemy"] } }).scene;
const zealotFirstOne = Engine.dispatchMany(zealotAction, [{ type: "roll.public", actorId: "hero", payload: { formula: "4D6", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } }]).scene;
assert.equal(zealotFirstOne.pendingPrompt?.kind, "zealot-revelation-one");
const zealotFilledOnce = Engine.dispatchMany(zealotFirstOne, Engine.respondRulePrompt(zealotFirstOne, data, { choice: "fill" }).events).scene;
const zealotSecondOne = Engine.dispatchMany(zealotFilledOnce, [{ type: "roll.public", actorId: "hero", payload: { formula: "4D6", rolls: [5, 4, 3, 1], successes: 2, crits: 0 } }]).scene;
assert.equal(zealotSecondOne.pendingPrompt, null, "Revelation can fill only once per action instance");
assert.equal(Engine.clockStatus(zealotSecondOne, "hero", "ruiner.zealot.revelation").value, 3);
const invertedCharge = Engine.prepareAction(zealotScene, data, {
  actorId: "hero", actionId: actionNamed("Зарядка").id, useRevelation: true,
  roll: { formula: "4D6", attribute: "spirit", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(invertedCharge.ok, true);
assert.equal(invertedCharge.events.find(event => event.type === "roll.public").payload.successes, 8);
assert.equal(invertedCharge.events.find(event => event.type === "rule-clock.tick").payload.delta, -1);
const zealotRuptureScene = structuredClone(scene);
zealotRuptureScene.actors[0].tier = 1;
zealotRuptureScene.actors[0].techniques = { "ruiner.zealot": 3 };
zealotRuptureScene.actors[0].ruleClocks = { "ruiner.zealot.revelation": { clockId: "ruiner.zealot.revelation", label: "Озарение", size: 6, minimumSize: 6, initial: 0, resetScope: "scene", active: true, value: 6 } };
zealotRuptureScene.actors.push({ ...structuredClone(zealotRuptureScene.actors[0]), id: "ally-on-line", name: "Союзник на Линии", x: 3, y: 1, techniques: {}, ruleClocks: {} });
const zealotLineCells = [...new Set([
  ...Array.from({ length: 7 }, (_, x) => `${x},1`),
  ...Array.from({ length: 7 }, (_, y) => `2,${y}`),
])];
const ruptureAttack = Engine.prepareAction(zealotRuptureScene, data, {
  actorId: "hero", actionId: actionNamed("Завершение").id, targetIds: [], useZealotRupture: true, zealotCells: zealotLineCells, attribute: "spirit",
  roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(ruptureAttack.ok, true, ruptureAttack.errors?.join(" "));
assert.deepEqual(Array.from(ruptureAttack.events.find(event => event.type === "attack.pending").payload.targetIds).sort(), ["ally-on-line", "enemy", "hero"], "Zealot III replaces ordinary allegiance, count, and range targeting with the two-line audience");
assert.equal(ruptureAttack.events.find(event => event.type === "attack.pending").payload.zealotRupture, true);
const ruptureMoves = Engine.prepareDisplacements(zealotRuptureScene, [
  { actorId: "hero", destination: { x: 1, y: 0 }, maximum: 1, allowKnockedOut: true },
  { actorId: "enemy", destination: { x: 3, y: 0 }, maximum: 1, allowKnockedOut: true },
  { actorId: "ally-on-line", destination: { x: 3, y: 2 }, maximum: 1, allowKnockedOut: true },
], { ruleId: "ruiner.zealot.3" });
assert.equal(ruptureMoves.ok, true);
assert.equal(Engine.topologyStatus(ruptureMoves.scene, { space: "main", cells: zealotLineCells, operation: "remove" }).available, true, "Every occupied line cell becomes removable only after the complete displacement plan");

const bulletsScene = structuredClone(scene);
bulletsScene.actors[0].techniques = { "powerhouse.gunslinger": 1 };
assert.equal(Engine.ruleResourceStatus(bulletsScene, "hero", { resource: "bullets", amount: 1 }).balance, 6, "Gunslinger adapter supplies the canonical Scene balance");
const bulletsSpent = Engine.dispatch(bulletsScene, { type: "resource.spend", actorId: "hero", payload: { resource: "focus", amount: 2 } }).scene;
assert.equal(bulletsSpent.actors[0].focus, 50, "A replaced base resource is not mutated");
assert.equal(Engine.ruleResourceStatus(bulletsSpent, "hero", { resource: "bullets" }).balance, 4);
assert.equal(bulletsSpent.log[0].payload.resolvedResource, "bullets", "The event journal records the resolved resource");
assert.equal(bulletsSpent.log[0].payload.resolvedDelta, -2);
assert.throws(
  () => Engine.dispatch(bulletsScene, { type: "rule-resource.configure", actorId: "hero", payload: { resource: "other", label: "Other", replaces: ["focus"], initial: 1 } }),
  /conflict|конфликт/i,
  "Alternative resources with overlapping replacements are rejected",
);
assert.throws(
  () => Engine.dispatch(bulletsScene, { type: "rule-resource.spend", actorId: "hero", payload: { resource: "bullets", amount: 7 } }, { expectedVersion: 9 }),
  error => error.code === "SCENE_VERSION_CONFLICT",
  "Rule-resource commands honor optimistic Scene versions",
);
const atomicRuleResourcePreview = Engine.previewEvents(bulletsScene, [
  { type: "rule-resource.spend", actorId: "hero", payload: { resource: "bullets", amount: 4 } },
  { type: "rule-resource.spend", actorId: "hero", payload: { resource: "bullets", amount: 4 } },
]);
assert.equal(atomicRuleResourcePreview.ok, false);
assert.equal(Engine.ruleResourceStatus(atomicRuleResourcePreview.scene, "hero", { resource: "bullets" }).balance, 6, "A rejected event chain is atomic");
assert.equal(bulletsScene.actors[0].ruleResources, undefined, "Preview never mutates the source Scene");

const heatScene = structuredClone(scene);
heatScene.actors[0].techniques = { "vagabond.modified-meister": 1 };
const overheated = Engine.dispatchMany(heatScene, [{ type: "resource.spend", actorId: "hero", payload: { resource: "focus", amount: 6 } }]);
assert.equal(Engine.ruleResourceStatus(overheated.scene, "hero", { resource: "heat" }).balance, 3, "Heat 6 explodes and resets to 3");
assert.equal(overheated.scene.actors[0].hp, 10, "The Modified Meister explosion damages its owner by Mind");
assert.equal(overheated.scene.actors[1].hp, 9, "The explosion damages adjacent opponents through normal Armor");
assert.deepEqual(Array.from(overheated.events, event => event.type), ["resource.spend", "rule-resource.set", "damage.apply", "damage.apply"]);
const cooled = Engine.dispatch(overheated.scene, { type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2 } }).scene;
assert.equal(Engine.ruleResourceStatus(cooled, "hero", { resource: "heat" }).balance, 1, "Effects that grant Focus cool Heat");

const gritScene = structuredClone(scene);
gritScene.actors[0].techniques = { "bulwark.mundane": 1 };
assert.equal(Engine.ruleResourceStatus(gritScene, "hero", { resource: "grit" }).balance, 2);
assert.deepEqual(JSON.parse(JSON.stringify(Engine.resourceStatus(gritScene, "hero", { ap: 1, focus: 2 }).missing)), { grit: 1 }, "AP and Focus share one Grit pool");
const restCannotGrantGrit = Engine.dispatch(gritScene, { type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1, sourceActionName: "Передышка" } }).scene;
assert.equal(Engine.ruleResourceStatus(restCannotGrantGrit, "hero", { resource: "grit" }).balance, 2);
assert.match(restCannotGrantGrit.log[0].payload.ignoredReason, /Передышка/);
const gritSpent = Engine.dispatch(gritScene, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 1 } }).scene;
assert.equal(Engine.ruleResourceStatus(gritSpent, "hero", { resource: "grit" }).balance, 1);
gritSpent.actors.forEach(actor => { actor.acted = true; });
gritSpent.activeActorId = null;
gritSpent.log = [
  { id: "grit-enemy-turn", type: "turn.end", actorId: "enemy", payload: { endedTurnActorId: "enemy" } },
  { id: "grit-hero-turn", type: "turn.end", actorId: "hero", payload: { endedTurnActorId: "hero" } },
];
const gritReset = Engine.dispatch(gritSpent, { type: "round.end", payload: {} }).scene;
assert.equal(Engine.ruleResourceStatus(gritReset, "hero", { resource: "grit" }).balance, 2, "Grit resets from Body at Round boundary");
assert.deepEqual(JSON.parse(JSON.stringify(gritReset.log[0].payload.ruleResourceResets)), [{ actorId: "hero", resource: "grit", label: "Упорство", value: 2, scope: "round" }], "Round reset is explicit in the event journal");

const gunslingerActionScene = structuredClone(scene);
gunslingerActionScene.actors[0].techniques = { "powerhouse.gunslinger": 1 };
gunslingerActionScene.actors[1].x = 4;
const bigIron = Engine.prepareAction(gunslingerActionScene, data, {
  actorId: "hero",
  actionId: actionNamed("Стычка").id,
  targetIds: ["enemy"],
  bulletsSpent: 3,
  bulletAdvantage: 2,
  roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(bigIron.ok, true, "Big Iron replaces the Skirmish range and requires an explicit Bullet allocation");
assert.equal(bigIron.events.find(event => event.type === "rule-resource.spend").payload.amount, 3);
const bigIronPending = Engine.dispatchMany(gunslingerActionScene, bigIron.events).scene;
assert.equal(Engine.ruleResourceStatus(bigIronPending, "hero", { resource: "bullets" }).balance, 3);
const interruptedBigIron = Engine.dispatch(bigIronPending, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 99, ignoreArmor: true } }).scene;
const cancelledBigIron = Engine.cancelPendingAction(interruptedBigIron, { reason: "source interrupted" });
const afterBigIronCancel = Engine.dispatchMany(interruptedBigIron, cancelledBigIron.events).scene;
assert.equal(Engine.ruleResourceStatus(afterBigIronCancel, "hero", { resource: "bullets" }).balance, 3, "Cancellation closes the pending attack without silently refunding a committed cost");
assert.equal(afterBigIronCancel.pendingAction, null);
assert.equal(afterBigIronCancel.log[0].type, "attack.clear");

const knifeScene = structuredClone(scene);
knifeScene.actors[0].techniques = { "vagabond.knife-juggler": 2 };
const thrownKnife = Engine.prepareAction(knifeScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], throwWeapon: true,
  roll: { formula: "4D6", attribute: "talent", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(thrownKnife.ok, true);
assert.equal(thrownKnife.events.find(event => event.type === "resource.spend"), undefined, "Throw has zero base cost");
assert.equal(thrownKnife.events.find(event => event.type === "rule-resource.spend").payload.resource, "weapons");
let knifeFlow = Engine.dispatchMany(knifeScene, thrownKnife.events).scene;
knifeFlow = Engine.dispatchMany(knifeFlow, Engine.respondReaction(knifeFlow, data, { actorId: "enemy", choice: "pass" }).events).scene;
knifeFlow = Engine.dispatchMany(knifeFlow, Engine.resolvePendingAction(knifeFlow, {}).events).scene;
assert.equal(Engine.ruleResourceStatus(knifeFlow, "hero", { resource: "weapons" }).balance, 3);
assert.ok(knifeFlow.markers.some(marker => marker.kind === "weapon" && marker.ownerActorId === "hero"), "Knife Juggler II creates an owned Weapon marker after resolution");

const meisterScene = structuredClone(scene);
meisterScene.actors[0].techniques = { "vagabond.modified-meister": 3 };
const overloaded = Engine.prepareAction(meisterScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], overload: true,
  roll: { formula: "4D6", attribute: "talent", rolls: [6, 3, 2, 1], successes: 1, crits: 1 },
});
assert.equal(overloaded.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(overloaded.events.find(event => event.type === "action.prepare").payload.overload)), { advantage: 1, failedDice: 3, ruleId: "vagabond.modified-meister.2" });
const meisterRest = Engine.prepareAction(meisterScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const meisterRested = Engine.dispatchMany(meisterScene, meisterRest.events).scene;
assert.equal(meisterRested.pendingPrompt?.kind, "meister-overclock", "Modified Meister III exposes the overclock decision after Rest at Tension 2+");

const mundaneScene = structuredClone(scene);
mundaneScene.actors[0].techniques = { "bulwark.mundane": 3 };
const mundaneTargeted = Engine.dispatchMany(mundaneScene, [{ type: "reaction.offer", actorId: "hero", payload: { sourceActorId: "enemy", actionId: "test" } }]).scene;
assert.equal(Engine.ruleResourceStatus(mundaneTargeted, "hero", { resource: "grit" }).balance, 3, "Mundane II gains Grit when made the target of an Attack");
const mundaneRest = Engine.prepareAction(mundaneScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id, provokeTargetIds: ["enemy"] });
assert.equal(mundaneRest.ok, true);
assert.ok(mundaneRest.events.some(event => event.type === "effect.apply" && event.payload.effect === "negative.спровоцирован"), "Mundane III applies Provoke to explicit legal targets");
assert.equal(Engine.prepareAction(mundaneScene, data, { actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], roll: { attribute: "spirit", rolls: [6], successes: 1 } }).ok, false);

const faithScene = structuredClone(scene);
faithScene.actors.push({ id: "ally", name: "Союзник", team: "hero", space: "main", x: 1, y: 2, hp: 4, maxHp: 10, wounds: 1, armor: 0, evasion: 0, effects: ["negative.ослаблен"], attrs: { body: 2, talent: 2, spirit: 2, mind: 2 } });
faithScene.actors[0].techniques = { "altruist.heavenly-saint": 3 };
assert.equal(Engine.ruleResourceStatus(faithScene, "hero", { resource: "faith" }).balance, 4);
const faithRest = Engine.dispatch(faithScene, { type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2, sourceActionName: "Передышка" } }).scene;
assert.equal(Engine.ruleResourceStatus(faithRest, "hero", { resource: "faith" }).balance, 4, "Rest cannot grant Faith");
const prayed = Engine.dispatchMany(faithScene, [{ type: "action.prepare", actorId: "hero", payload: { actionId: "prayer", name: "Помощь", targetIds: ["ally"] } }]).scene;
assert.equal(Engine.ruleResourceStatus(prayed, "hero", { resource: "faith" }).balance, 5, "Heavenly Saint I gains Faith for choosing an ally");
const cleansing = Engine.prepareAction(faithScene, data, {
  actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["ally"],
  removeEffectIdsByTarget: { ally: ["negative.ослаблен"] },
  roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 4, 1], successes: 3, crits: 1 },
});
assert.equal(cleansing.ok, true);
assert.ok(cleansing.events.some(event => event.type === "actor.heal" && event.payload.amount === 1));
assert.ok(cleansing.events.some(event => event.type === "effect.remove" && event.payload.effect === "negative.ослаблен"));

const autophageScene = structuredClone(scene);
autophageScene.actors[0].techniques = { "disruptor.autophage": 1 };
autophageScene.actors[0].guts = 3;
const autophageSpent = Engine.dispatchMany(autophageScene, [{ type: "resource.spend", actorId: "hero", payload: { resource: "focus", amount: 2 } }]).scene;
assert.equal(autophageSpent.actors[0].hp, 8, "Autophage pays two Health per Focus through the damage pipeline");
assert.equal(autophageSpent.actors[0].focus, 50);
const autophageGained = Engine.dispatchMany(autophageSpent, [{ type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2 } }]).scene;
assert.equal(autophageGained.actors[0].hp, 10, "Focus gains restore the same amount of Health");

const creationScene = structuredClone(scene);
creationScene.actors[0].techniques = { "ruiner.creation-ascetic": 1 };
const creationRest = Engine.prepareAction(creationScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const creationRested = Engine.dispatchMany(creationScene, creationRest.events).scene;
assert.equal(Engine.ruleResourceStatus(creationRested, "hero", { resource: "creation-marks" }).balance, 1);
assert.equal(creationRested.actors[0].creationMarks, 1, "Creation Marks use the generic resource state while preserving the legacy adapter");
assert.equal(creationRested.actors[0].focus, 50);

const privateScene = structuredClone(scene);
privateScene.actors[0].privateNotes = "Тайна игрока";
privateScene.actors[1].hidden = true;
privateScene.markers = [{ id: "secret", kind: "hidden", hidden: true }];
privateScene.log = [{ id: "gm-only", visibility: "gm", type: "gm.note", payload: {} }, { id: "public", type: "roll.public", payload: {} }];
const playerProjection = Engine.projectScene(privateScene, { role: "player", actorIds: ["hero"] });
assert.equal(playerProjection.actors.length, 1);
assert.equal(playerProjection.actors[0].privateNotes, "Тайна игрока");
assert.equal(playerProjection.markers.length, 0);
assert.equal(playerProjection.log.length, 1);

const rest = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(rest.ok, true);
const rested = Engine.dispatchMany(scene, rest.events).scene;
assert.equal(rested.actors[0].ap, 2);
assert.equal(rested.actors[0].focus, 51, "Focus gain must remain unbounded");
assert.ok(rested.actors[0].usedActions.includes(actionNamed("Передышка").id));
assert.equal(Engine.prepareAction(rested, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).ok, false, "A base action is used at most once per Round");

const quickRestScene = structuredClone(scene);
quickRestScene.actors[0].techniques = { "altruist.fog-walker": 3 };
const quickRest = Engine.prepareAction(quickRestScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(quickRest.ok, true);
assert.equal(quickRest.action.quick, true, "A learned Technique can make a base action Quick");
assert.equal(quickRest.action.quickSource.name, "Жалящий пар (Stinging Steam)");
const afterQuickRest = Engine.dispatchMany(quickRestScene, quickRest.events).scene;
assert.ok(!afterQuickRest.actors[0].usedActions.includes(actionNamed("Передышка").id), "Quick actions do not consume the once-per-Round use");
assert.equal(Engine.prepareAction(afterQuickRest, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).ok, true, "An always-Quick Rest may be used again while resources remain");
const firstQuickScene = structuredClone(scene);
firstQuickScene.actors[0].techniques = { "vagabond.drunkard": 3 };
const firstQuickRest = Engine.prepareAction(firstQuickScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(firstQuickRest.action.quick, true, "The first-Rest Quick condition is recognized");
const afterFirstQuick = Engine.dispatchMany(firstQuickScene, firstQuickRest.events).scene;
const normalRest = Engine.prepareAction(afterFirstQuick, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
assert.equal(normalRest.action.quick, false, "A first-only Quick source is not reused in the same Turn");
const afterNormalRest = Engine.dispatchMany(afterFirstQuick, normalRest.events).scene;
assert.equal(Engine.prepareAction(afterNormalRest, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).ok, false, "After the first Quick and one normal use, the base action limit applies again");
for (const techniques of [
  { "powerhouse.spellsword": 2 },
  { "powerhouse.dual-wielder": 1 },
]) {
  const namedSubActionScene = structuredClone(scene);
  namedSubActionScene.actors[0].techniques = techniques;
  assert.equal(Engine.availableActions(namedSubActionScene, data, "hero").find(action => action.name === "Стычка").quick, false, "Named or conditional Technique attacks do not make the ordinary Skirmish Quick");
}
const preparationScene = structuredClone(scene);
preparationScene.actors[0].techniques = { "ruiner.long-draw": 1 };
assert.equal(Engine.availableActions(preparationScene, data, "hero").find(action => action.name === "Зарядка").quick, false, "Preparation charges do not make the base Charge action Quick");

const edgeScene = structuredClone(scene);
edgeScene.actors[0].x = 0;
const hide = Engine.prepareAction(edgeScene, data, { actorId: "hero", actionId: actionNamed("Скрыться").id });
assert.equal(hide.ok, true);
assert.ok(hide.events.some(event => event.type === "effect.apply" && event.payload.effect === "positive.исчез"), "Hide applies the canonical Disappeared effect");
assert.equal(Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Скрыться").id }).ok, false, "Hide rejects a non-edge cell");
const study = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
assert.equal(study.ok, true);
assert.ok(Engine.dispatchMany(scene, study.events).scene.actors[1].effects.includes("negative.помечен"), "Study applies its deterministic Marked step");

const attack = prepareAttack(scene, "hero", "enemy");
assert.equal(attack.ok, true);
const friendlyFireScene = structuredClone(scene);
friendlyFireScene.actors.push({ ...structuredClone(friendlyFireScene.actors[0]), id: "ally", name: "Союзник", x: 1, y: 2 });
assert.equal(prepareAttack(friendlyFireScene, "hero", "ally").ok, false, "Basic Attacks reject allies");
assert.deepEqual(Array.from(attack.events, event => event.type), ["action.prepare", "resource.spend", "reaction.offer", "attack.pending"]);
const awaiting = Engine.dispatchMany(scene, attack.events).scene;
assert.equal(awaiting.actors[1].hp, 10, "Damage waits for every Reaction response");
assert.deepEqual(Array.from(Engine.reactionOptions(awaiting, data, "enemy"), option => option.name), ["Без Реакции"], "Enemies do not spend the heroes' Focus Reactions");
assert.throws(() => Engine.dispatch(awaiting, { type: "round.end", payload: {} }), /завершите текущую цепочку Реакций/);
const passed = Engine.respondReaction(awaiting, data, { actorId: "enemy", choice: "pass" });
const answered = Engine.dispatchMany(awaiting, passed.events).scene;
const resolution = Engine.resolvePendingAction(answered, data);
assert.equal(resolution.ok, true);
const attacked = Engine.dispatchMany(answered, resolution.events).scene;
assert.equal(attacked.actors[0].ap, 2);
assert.equal(attacked.actors[1].hp, 9, "Armor reduces damage, but an Attack still deals at least 1");
assert.equal(attacked.rollFeed[0].successes, 2);
assert.equal(attacked.pendingAction, null);

const enemyScene = structuredClone(scene);
enemyScene.activeActorId = "enemy";
const enemyRules = Engine.availableEnemyRules(enemyScene, data, "enemy");
assert.equal(enemyRules.length, 3);
const neutralize = enemyRules.find(rule => rule.en === "Neutralize Target");
assert.equal(neutralize.automation, "effect");
const neutralized = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: neutralize.id, targetIds: ["hero"] });
assert.equal(neutralized.ok, true);
const afterNeutralize = Engine.dispatchMany(enemyScene, neutralized.events).scene;
assert.equal(afterNeutralize.actors[1].ap, 1);
assert.ok(afterNeutralize.actors[1].usedActions.includes(neutralize.id));
assert.ok(afterNeutralize.actors[0].effects.includes("negative.помечен"));
assert.ok(!afterNeutralize.actors[0].effects.includes("negative.замедлен"), "Conditional follow-up effects must not be applied early");
assert.equal(Engine.prepareEnemyRule(afterNeutralize, data, { actorId: "enemy", ruleId: neutralize.id, targetIds: ["hero"] }).ok, false, "Enemy actions are once per Round");

const slice = enemyRules.find(rule => rule.en === "Slice");
assert.equal(slice.automation, "assisted", "Conditional wounds and positioning keep Slice under Narrator confirmation");
const assistedSlice = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: slice.id, targetIds: ["hero"], roll: { formula: "5D6", rolls: [6, 5, 2, 1, 1], successes: 2, crits: 1 } });
assert.equal(assistedSlice.ok, true);
assert.ok(!assistedSlice.events.some(event => event.type === "attack.pending"), "Assisted attacks never silently apply a partial rule as if it were complete");
assert.ok(assistedSlice.events.some(event => event.type === "roll.public"));

const simpleEnemyScene = structuredClone(enemyScene);
simpleEnemyScene.actors[1].profileId = "enemy.common.pugilist";
simpleEnemyScene.actors[1].name = "Кулачный боец";
const flurry = Engine.availableEnemyRules(simpleEnemyScene, data, "enemy").find(rule => rule.en === "Flurry Of Strikes");
assert.equal(flurry.automation, "attack");
const enemyAttack = Engine.prepareEnemyRule(simpleEnemyScene, data, { actorId: "enemy", ruleId: flurry.id, targetIds: ["hero"], roll: { formula: "6D6", rolls: [6, 5, 2, 1, 1, 1], successes: 2, crits: 1 } });
assert.equal(enemyAttack.ok, true);
assert.equal(Engine.prepareEnemyRule(simpleEnemyScene, data, { actorId: "enemy", ruleId: flurry.id, targetIds: ["enemy"], roll: { rolls: [6], successes: 1 } }).ok, false, "Automated enemy Attacks reject allies");
const enemyAwaiting = Engine.dispatchMany(simpleEnemyScene, enemyAttack.events).scene;
assert.equal(enemyAwaiting.actors[1].ap, 1);
assert.equal(enemyAwaiting.actors[0].hp, 12);
const heroPass = Engine.respondReaction(enemyAwaiting, data, { actorId: "hero", choice: "pass" });
const enemyAnswered = Engine.dispatchMany(enemyAwaiting, heroPass.events).scene;
const enemyResolved = Engine.dispatchMany(enemyAnswered, Engine.resolvePendingAction(enemyAnswered, data).events).scene;
assert.equal(enemyResolved.actors[0].hp, 6, "Enemy attack damage includes successes plus Tension multiplier");
assert.equal(enemyResolved.pendingAction, null);

const baseTensionScene = structuredClone(enemyScene);
baseTensionScene.actors[1].profileId = "enemy.common.cultist";
baseTensionScene.actors[1].name = "Культист";
const swipe = Engine.availableEnemyRules(baseTensionScene, data, "enemy").find(rule => rule.en === "Swipe");
assert.equal(swipe.automation, "attack");
const swipeAttack = Engine.prepareEnemyRule(baseTensionScene, data, { actorId: "enemy", ruleId: swipe.id, targetIds: ["hero"], roll: { formula: "5D6", rolls: [6, 5, 2, 1, 1], successes: 2, crits: 1 } });
assert.equal(swipeAttack.events.find(event => event.type === "attack.pending").payload.damage, 4, "[Tension] without an explicit multiplier still adds Tension once");

const paladinScene = structuredClone(enemyScene);
paladinScene.actors[1].profileId = "enemy.common.paladin";
paladinScene.actors[1].name = "Паладин";
paladinScene.actors.push({ ...structuredClone(paladinScene.actors[1]), id: "enemy-ally", name: "Союзник Паладина", x: 2, y: 2 });
const gift = Engine.availableEnemyRules(paladinScene, data, "enemy").find(rule => rule.en === "Gift From God");
assert.equal(gift.automation, "assisted");
assert.equal(gift.maxTargets, 2);
assert.equal(Engine.prepareEnemyRule(paladinScene, data, { actorId: "enemy", ruleId: gift.id, targetIds: ["hero", "enemy-ally"], roll: { formula: "5D6", rolls: [6, 4, 2, 1, 1], successes: 2, crits: 1 } }).ok, true, "Mixed ally/enemy actions honor the two textual targets through Narrator confirmation");

const daredevilScene = structuredClone(enemyScene);
daredevilScene.actors[1].profileId = "enemy.common.daredevil";
daredevilScene.actors.push({ ...structuredClone(daredevilScene.actors[0]), id: "hero-2", name: "Вторая цель", x: 2, y: 2 });
const dance = Engine.availableEnemyRules(daredevilScene, data, "enemy").find(rule => rule.en === "Dance");
assert.equal(dance.automation, "assisted", "A two-target textual Attack is not falsely presented as fully automatic");
assert.equal(dance.maxTargets, 2);
assert.equal(Engine.prepareEnemyRule(daredevilScene, data, { actorId: "enemy", ruleId: dance.id, targetIds: ["hero", "hero-2"], roll: { formula: "5D6", rolls: [6, 4, 2, 1, 1], successes: 2, crits: 1 } }).ok, true, "Dance accepts its canonical two targets");

const bodyguardsScene = structuredClone(enemyScene);
bodyguardsScene.actors[1].profileId = "enemy.common.bodyguards";
bodyguardsScene.actors.push({ ...structuredClone(bodyguardsScene.actors[0]), id: "hero-2", name: "Вторая цель", x: 2, y: 2 });
bodyguardsScene.actors.push({ ...structuredClone(bodyguardsScene.actors[0]), id: "hero-3", name: "Третья цель", x: 3, y: 1 });
const behindMe = Engine.availableEnemyRules(bodyguardsScene, data, "enemy").find(rule => rule.en === "Behind Me");
assert.equal(behindMe.maxTargets, 3);
assert.equal(Engine.prepareEnemyRule(bodyguardsScene, data, { actorId: "enemy", ruleId: behindMe.id, targetIds: ["hero", "hero-2", "hero-3"], roll: { formula: "6D6", rolls: [6, 5, 4, 2, 1, 1], successes: 3, crits: 1 } }).ok, true, "Behind Me accepts all three textual targets under assisted resolution");

const disappear = enemyRules.find(rule => rule.en === "Disappear");
const trump = Engine.prepareEnemyRule(enemyScene, data, { actorId: "enemy", ruleId: disappear.id });
assert.equal(trump.ok, true);
const afterTrump = Engine.dispatchMany(enemyScene, trump.events).scene;
assert.equal(afterTrump.actors[1].usedTrump, true);
assert.ok(afterTrump.actors[1].effects.includes("positive.исчез"));
afterTrump.activeActorId = null;
afterTrump.actors.forEach(actor => { actor.acted = true; });
afterTrump.log.unshift({ id: "enemy-turn-complete", type: "turn.end", actorId: "enemy", payload: {} });
const afterEnemyRound = Engine.dispatch(afterTrump, { type: "round.end", payload: {} }).scene;
assert.equal(afterEnemyRound.actors[1].usedActions.length, 0);
assert.equal(afterEnemyRound.actors[1].usedTrump, true, "Trump remains spent for the whole Scene");

const builderScene = structuredClone(enemyScene);
builderScene.actors[1].profileId = "enemy.common.builder";
builderScene.actors[1].name = "Строитель";
builderScene.actors[1].x = 5;
const construction = Engine.availableEnemyRules(builderScene, data, "enemy").find(rule => rule.en === "Violent Construction");
assert.equal(construction.automation, "assisted");
const directAttack = Engine.prepareEnemyRule(builderScene, data, { actorId: "enemy", ruleId: construction.id, targetIds: ["hero"], damage: 3 });
assert.equal(directAttack.ok, true, "Fixed-damage special attacks remain usable");
assert.ok(!directAttack.events.some(event => event.type === "attack.pending"), "Terrain placement is not falsely presented as fully automated");

const areaScene = structuredClone(enemyScene);
areaScene.actors[1].profileId = "enemy.common.witch";
areaScene.actors[1].name = "Ведьма";
const runes = Engine.availableEnemyRules(areaScene, data, "enemy").find(rule => rule.en === "Drawing Runes");
assert.equal(runes.apCost, 2);
const runeAction = Engine.prepareEnemyRule(areaScene, data, { actorId: "enemy", ruleId: runes.id });
assert.equal(runeAction.ok, true);
const runeScene = Engine.dispatchMany(areaScene, runeAction.events).scene;
assert.equal(runeScene.objects[0].cells.length, 9);
assert.equal(runeScene.objects[0].type, "danger");
assert.equal(runeScene.actors[1].ap, 0);

const awaitingDodge = structuredClone(enemyAwaiting);
awaitingDodge.pendingAction.damage = 2;
awaitingDodge.pendingAction.effects = ["negative.помечен"];
const dodge = Engine.respondReaction(awaitingDodge, data, { actorId: "hero", choice: "Уворот", destination: { x: 0, y: 1 } });
assert.equal(dodge.ok, true);
const afterDodge = Engine.dispatchMany(awaitingDodge, dodge.events).scene;
assert.equal(afterDodge.actors[0].focus, 48);
assert.equal(afterDodge.actors[0].x, 0);
const dodgeOutcome = Engine.pendingTargetOutcome(afterDodge, afterDodge.pendingAction, "hero");
assert.equal(dodgeOutcome.available, true);
assert.equal(dodgeOutcome.expectedDamage, 0, "The shared damage outcome exposes Armor and Evasion before committing damage");
assert.ok(dodgeOutcome.temporaryEvasion > 0);
const dodged = Engine.dispatchMany(afterDodge, Engine.resolvePendingAction(afterDodge, data).events).scene;
assert.equal(dodged.actors[0].hp, 12, "Temporary Evasion can absorb all post-Armor damage");
assert.ok(!dodged.actors[0].effects.includes("negative.помечен"), "A fully evaded Attack does not apply its secondary Effects");

const awaitingBlock = structuredClone(enemyAwaiting);
const block = Engine.respondReaction(awaitingBlock, data, { actorId: "hero", choice: "Блок" });
assert.equal(block.ok, true);
const afterBlock = Engine.dispatchMany(awaitingBlock, block.events).scene;
assert.equal(afterBlock.actors[0].x, 0, "Block applies its forced one-cell push away from the attacker");
const blocked = Engine.dispatchMany(afterBlock, Engine.resolvePendingAction(afterBlock, data).events).scene;
assert.equal(blocked.actors[0].hp, 9, "Block resolves through temporary Body Armor while preserving minimum Attack damage");

const duelistAwaiting = structuredClone(enemyAwaiting);
duelistAwaiting.actors[0].techniques = { "powerhouse.duelist": 2 };
const duelistBlock = Engine.respondReaction(duelistAwaiting, data, { actorId: "hero", choice: "Блок" });
assert.equal(duelistBlock.ok, true);
const afterDuelistBlock = Engine.dispatchMany(duelistAwaiting, duelistBlock.events).scene;
assert.ok(afterDuelistBlock.actors.find(actor => actor.id === "enemy").effects.includes("negative.ошеломлен"), "Duelist II checks adjacency at the start of Block and Stuns the attacker");

const untouchableAwaiting = structuredClone(enemyAwaiting);
untouchableAwaiting.pendingAction.damage = 2;
untouchableAwaiting.actors[0].techniques = { "vagabond.untouchable": 2 };
const longDodge = Engine.respondReaction(untouchableAwaiting, data, { actorId: "hero", choice: "Уворот", destination: { x: 1, y: 4 } });
assert.equal(longDodge.ok, true, "Untouchable II extends Dodge movement to three cells");
let untouchableFlow = Engine.dispatchMany(untouchableAwaiting, longDodge.events).scene;
assert.equal(Engine.pendingTargetOutcome(untouchableFlow, untouchableFlow.pendingAction, "hero").expectedDamage, 0);
untouchableFlow = Engine.dispatchMany(untouchableFlow, Engine.resolvePendingAction(untouchableFlow, data).events).scene;
assert.equal(untouchableFlow.pendingPrompt?.kind, "untouchable-weave");
const weaveChoice = Engine.respondRulePrompt(untouchableFlow, data, { choice: "rush" });
assert.equal(weaveChoice.ok, true);
untouchableFlow = Engine.dispatchMany(untouchableFlow, weaveChoice.events).scene;
assert.equal(untouchableFlow.pendingPrompt?.kind, "untouchable-weave-cell");
const weavePlacement = Engine.preparePromptPlacement(untouchableFlow, { destination: { x: 4, y: 4 } });
assert.equal(weavePlacement.ok, true);
untouchableFlow = Engine.dispatchMany(untouchableFlow, weavePlacement.events).scene;
assert.deepEqual([untouchableFlow.actors[0].x, untouchableFlow.actors[0].y], [4, 4], "Untouchable II performs its optional second Dodge movement");
assert.ok(untouchableFlow.log.some(event => event.type === "technique.resolve" && event.payload?.ruleId === "vagabond.untouchable.2"));

const awaitingClash = structuredClone(enemyAwaiting);
const clash = Engine.respondReaction(awaitingClash, data, { actorId: "hero", choice: "Столкновение", clash: {
  defenderRoll: { formula: "4D6 · Столкновение", rolls: [6, 5, 4, 1], successes: 3, crits: 1 },
  attackerRoll: { formula: "4D6 · Столкновение", rolls: [4, 2, 2, 1], successes: 1, crits: 0 },
} });
assert.equal(clash.ok, true, "Clash is an automated hero Reaction option");
const afterClash = Engine.dispatchMany(awaitingClash, clash.events).scene;
assert.equal(afterClash.pendingAction.responses.hero.clash.defenderWins, true);
const clashed = Engine.dispatchMany(afterClash, Engine.resolvePendingAction(afterClash, data).events).scene;
assert.equal(clashed.actors[0].hp, 12, "A won Clash cancels the original Attack");

const moved = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 1, y: 3 } });
assert.equal(moved.ok, true);
const afterPartialStep = Engine.dispatchMany(scene, moved.events).scene;
assert.equal(afterPartialStep.actors[0].y, 3);
assert.equal(afterPartialStep.actors[0].stepRemaining, 2, "Unused Step movement is saved");
const betweenSteps = Engine.dispatchMany(afterPartialStep, Engine.prepareAction(afterPartialStep, data, { actorId: "hero", actionId: actionNamed("Передышка").id }).events).scene;
const continuedStep = Engine.prepareAction(betweenSteps, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 3, y: 3 } });
assert.equal(continuedStep.ok, true, "Saved Step movement remains available after another action");
assert.equal(continuedStep.action.continuation, true);
assert.ok(!continuedStep.events.some(event => event.type === "resource.spend"), "Continuing a Step does not spend AP again");
const afterContinuedStep = Engine.dispatchMany(betweenSteps, continuedStep.events).scene;
assert.equal(afterContinuedStep.actors[0].x, 3);
assert.equal(afterContinuedStep.actors[0].stepRemaining, 0);
const blockedPath = structuredClone(scene);
blockedPath.actors[0].speed = 4;
assert.equal(Engine.prepareAction(blockedPath, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 5, y: 1 } }).ok, false, "Step cannot pass through an enemy when the detour exceeds Speed");
const diagonalJump = Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Прыжок").id, destination: { x: 3, y: 3 } });
assert.equal(diagonalJump.ok, true, "Jump accepts a diagonal Line and counts each diagonal cell as one");
assert.equal(diagonalJump.events.find(event => event.type === "actor.move").payload.path.length, 2);
assert.equal(Engine.prepareAction(scene, data, { actorId: "hero", actionId: actionNamed("Прыжок").id, destination: { x: 3, y: 2 } }).ok, false, "Jump rejects a bent Line");
const terrainScene = structuredClone(scene);
terrainScene.actors[1].x = 6;
terrainScene.objects = [{ id: "wall", type: "terrain", space: "main", cells: ["1,2", "0,1", "2,1"] }];
assert.equal(Engine.movementPath(terrainScene, "hero", { x: 1, y: 3 }, { maxDistance: 4 }).length, 0, "Movement cannot pass through terrain");
const difficultScene = structuredClone(scene);
difficultScene.actors[1].x = 6;
difficultScene.objects = [{ id: "ash", type: "difficult", space: "main", cells: ["1,2"] }];
assert.equal(Engine.movementPath(difficultScene, "hero", { x: 1, y: 3 }, { maxDistance: 2 }).length, 0, "Step may enter but cannot move beyond difficult terrain on the direct route");
const stepIntoDifficult = Engine.prepareAction(difficultScene, data, { actorId: "hero", actionId: actionNamed("Шаг").id, destination: { x: 1, y: 2 } });
assert.equal(stepIntoDifficult.ok, true);
const afterDifficultEntry = Engine.dispatchMany(difficultScene, stepIntoDifficult.events).scene;
assert.equal(afterDifficultEntry.actors[0].stepRemaining, 0, "Entering difficult terrain ends saved Step movement");
assert.equal(afterDifficultEntry.actors[0].speedZeroUntilTurnEnd, true, "Difficult terrain sets Speed to zero until Turn end");
assert.match(Engine.availableActions(afterDifficultEntry, data, "hero").find(action => action.name === "Шаг").reason, /Скорость/);
assert.equal(Engine.prepareAction(difficultScene, data, { actorId: "hero", actionId: actionNamed("Прыжок").id, destination: { x: 1, y: 3 } }).ok, true, "Jump ignores difficult terrain");

const woundedScene = structuredClone(scene);
woundedScene.actors[0].hp = 1;
woundedScene.actors[0].guts = 4;
woundedScene.actors[0].wounds = 0;
const wounded = Engine.dispatch(woundedScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 5, ignoreArmor: true } }).scene;
assert.equal(wounded.actors[0].wounds, 1);
assert.equal(wounded.actors[0].hp, 4);
assert.equal(wounded.actors[0].influence, 1);

const lifecycleScene = structuredClone(scene);
lifecycleScene.activeActorId = null;
lifecycleScene.tension = 2;
lifecycleScene.actors[0].ap = 1;
lifecycleScene.actors[1].ap = 0;
lifecycleScene.objects = [{ id: "gas", type: "gas", duration: "nextTurn", ownerActorId: "hero", space: "main", cells: ["2,1"] }];
const entered = Engine.dispatchMany(lifecycleScene, [{ type: "actor.enter", actorId: "enemy", payload: {} }]).scene;
assert.ok(entered.actors[1].effects.includes("negative.ослаблен"));
const heroTurn = Engine.dispatch(entered, { type: "turn.start", actorId: "hero", payload: {} }).scene;
assert.equal(heroTurn.activeActorId, "hero");
assert.equal(heroTurn.actors[0].ap, 1, "A hero keeps the AP established at Round start when their Turn begins");
assert.equal(heroTurn.objects.length, 0);
const endedHero = Engine.dispatch(heroTurn, { type: "turn.end", actorId: "hero", payload: {} }).scene;
assert.equal(endedHero.actors[0].ap, 1, "A hero keeps remaining AP for Reactions after their Turn");
assert.throws(() => Engine.dispatch(endedHero, { type: "turn.start", actorId: "hero", payload: {} }), /уже действовал/);
const enemyTurn = Engine.dispatch(endedHero, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
assert.equal(enemyTurn.actors[1].ap, 2, "An enemy starts each own Turn with 2 AP");
const endedEnemy = Engine.dispatch(enemyTurn, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(endedEnemy.actors[1].ap, 0);
assert.equal(Engine.roundEndStatus(endedEnemy).available, true);
const nextRound = Engine.dispatch(endedEnemy, { type: "round.end", payload: {} }).scene;
assert.equal(nextRound.round, 2);
assert.equal(nextRound.tension, 3);
assert.equal(nextRound.actors[0].ap, 3);
assert.equal(nextRound.actors[1].ap, 2);

const alternating = structuredClone(lifecycleScene);
alternating.actors.push({ ...structuredClone(alternating.actors[0]), id: "hero-2", name: "Второй герой", x: 1, y: 3, ap: 3, acted: false });
let alternatingState = Engine.dispatch(alternating, { type: "turn.start", actorId: "hero", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "hero", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "hero-2", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "hero-2", payload: {} }).scene;
assert.equal(Engine.turnStartStatus(alternatingState, "enemy").available, true, "When all enemies have acted, one of them may repeat to preserve alternation");
alternatingState = Engine.dispatch(alternatingState, { type: "turn.start", actorId: "enemy", payload: {} }).scene;
alternatingState = Engine.dispatch(alternatingState, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(Engine.roundEndStatus(alternatingState).available, true, "A Round closes after every hero and one enemy Turn per hero");

const knockedOut = Engine.dispatch(scene, { type: "damage.apply", actorId: "hero", payload: { targetId: "enemy", amount: 20, ignoreArmor: true } }).scene;
assert.equal(knockedOut.actors[1].knockedOut, true);
assert.equal(knockedOut.tension, 3);
assert.ok(Engine.availableActions(knockedOut, data, "enemy").every(action => !action.available));

const activeKoScene = structuredClone(scene);
activeKoScene.actors[0].hp = 1;
activeKoScene.actors[0].guts = 0;
activeKoScene.actors.push({ ...structuredClone(activeKoScene.actors[0]), id: "hero-2", name: "Оставшийся герой", x: 1, y: 3, hp: 12, guts: 4, knockedOut: false, acted: false });
const afterActiveKo = Engine.dispatch(activeKoScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 5, ignoreArmor: true } }).scene;
assert.equal(afterActiveKo.activeActorId, null);
assert.equal(afterActiveKo.log[0].payload.endedTurnActorId, "hero", "A KO explicitly records the interrupted Turn closure");
assert.equal(Engine.turnStartStatus(afterActiveKo, "enemy").available, true, "After an active hero is knocked out, alternation passes to an enemy");
assert.equal(Engine.turnStartStatus(afterActiveKo, "hero-2").available, false, "A second hero cannot act immediately after the interrupted hero Turn");

const staleTargetScene = structuredClone(scene);
staleTargetScene.actors[1].knockedOut = true;
assert.equal(prepareAttack(staleTargetScene, "hero", "enemy").ok, false, "A knocked-out participant cannot become a new Attack target");
assert.equal(prepareAttack(scene, "hero", "missing").ok, false, "A removed participant cannot survive in a new target list");
assert.throws(() => Engine.dispatch(scene, { type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 99 } }), /изменился/, "A stale command cannot silently over-spend a resource");

const interruptedSourceScene = structuredClone(awaiting);
interruptedSourceScene.actors[0].guts = 0;
const sourceDown = Engine.dispatch(interruptedSourceScene, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 99, ignoreArmor: true } }).scene;
const interruptedStatus = Engine.pendingActionStatus(sourceDown);
assert.equal(interruptedStatus.mustCancel, true);
assert.match(interruptedStatus.interruptedReason, /выведен из боя/);
const cancelledResolution = Engine.resolvePendingAction(sourceDown, data);
assert.equal(cancelledResolution.cancelled, true);
const afterCancellation = Engine.dispatchMany(sourceDown, cancelledResolution.events).scene;
assert.equal(afterCancellation.pendingAction, null);
assert.equal(afterCancellation.actors[1].hp, 10, "An interrupted source never deals delayed damage");

const multiTargetScene = structuredClone(scene);
multiTargetScene.actors.push({ ...structuredClone(multiTargetScene.actors[1]), id: "enemy-2", name: "Вторая цель", x: 1, y: 2, armor: 0, guts: 0 });
const multiAttack = prepareAttack(multiTargetScene, "hero", "enemy", "Стычка");
multiAttack.events.find(event => event.type === "attack.pending").payload.targetIds.push("enemy-2");
multiAttack.events.splice(-1, 0, { type: "reaction.offer", actorId: "enemy-2", payload: { sourceActorId: "hero", actionId: actionNamed("Стычка").id } });
let multiAwaiting = Engine.dispatchMany(multiTargetScene, multiAttack.events).scene;
multiAwaiting = Engine.dispatch(multiAwaiting, { type: "damage.apply", actorId: null, payload: { targetId: "enemy-2", amount: 99, ignoreArmor: true } }).scene;
assert.equal(multiAwaiting.pendingAction.responses["enemy-2"].choice, "unavailable");
const firstTargetPass = Engine.respondReaction(multiAwaiting, data, { actorId: "enemy", choice: "pass" });
multiAwaiting = Engine.dispatchMany(multiAwaiting, firstTargetPass.events).scene;
const partialResolution = Engine.resolvePendingAction(multiAwaiting, data);
assert.equal(partialResolution.ok, true);
const partialResolved = Engine.dispatchMany(multiAwaiting, partialResolution.events).scene;
assert.equal(partialResolved.pendingAction, null);
assert.equal(partialResolved.actors.find(actor => actor.id === "enemy").hp, 9);
assert.equal(partialResolved.actors.find(actor => actor.id === "enemy-2").hp, 0, "An unavailable target is skipped instead of blocking or taking damage twice");
assert.equal(Engine.respondReaction(answered, data, { actorId: "enemy", choice: "pass" }).ok, false, "A repeated Reaction response is rejected");
assert.throws(() => Engine.dispatch(awaiting, { type: "attack.clear", actorId: "hero", payload: { pendingId: "stale" } }), /устарела/, "A stale cancel command cannot close a newer Attack");

const planScene = structuredClone(scene);
planScene.actors[0].techniques = { "vagabond.cunning-fighter": 2 };
planScene.actors[0].techniqueState = { cunningPlan: 0, studiedActorIds: [] };
const plannedStudy = Engine.prepareAction(planScene, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
const afterPlannedStudy = Engine.dispatchMany(planScene, plannedStudy.events).scene;
assert.equal(afterPlannedStudy.actors[0].techniqueState.cunningPlan, 1, "A first Study target fills Cunning Plan");
const plannedRest = Engine.prepareAction(afterPlannedStudy, data, { actorId: "hero", actionId: actionNamed("Передышка").id, useCunningPlan: true });
assert.equal(plannedRest.ok, true);
assert.equal(plannedRest.action.quick, true);
assert.equal(plannedRest.events.some(event => event.type === "resource.spend"), false, "Plan reduces a 1 AP action to zero");
assert.equal(Engine.dispatchMany(afterPlannedStudy, plannedRest.events).scene.actors[0].techniqueState.cunningPlan, 0);

const comboScene = structuredClone(scene);
comboScene.actors[0].techniques = { "powerhouse.technician": 3 };
comboScene.actors[0].comboCooldowns = {};
comboScene.log.unshift({ id: "previous-skirmish", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Стычка").id, actionName: "Стычка", name: "Стычка" } });
comboScene.actors[0].ap = 1;
const finalBlow = Engine.prepareTechniqueCombo(comboScene, data, { actorId: "hero", ruleId: "powerhouse.technician.3", targetIds: ["enemy"], roll: { formula: "4D6", rolls: [6, 5, 2, 1], successes: 2, crits: 1 } });
assert.equal(finalBlow.ok, true);
assert.equal(finalBlow.events.find(event => event.type === "resource.spend").payload.amount, 1, "Final Blow costs exactly 1 AP");
const comboAwaiting = Engine.dispatchMany(comboScene, finalBlow.events).scene;
assert.equal(comboAwaiting.actors[0].comboCooldowns["powerhouse.technician.3"], 2);
assert.equal(Engine.prepareTechniqueCombo(comboAwaiting, data, { actorId: "hero", ruleId: "powerhouse.technician.3", targetIds: ["enemy"] }).ok, false, "A combo cannot be reused while pending/on cooldown");
const speedScene = structuredClone(scene);
speedScene.actors[0].techniques = { "vagabond.assassin": 3 };
speedScene.actors[0].ap = 0;
speedScene.log.unshift({ id: "previous-hide", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Скрыться").id, actionName: "Скрыться", name: "Скрыться" } });
const speedOfDark = Engine.prepareTechniqueCombo(speedScene, data, { actorId: "hero", ruleId: "vagabond.assassin.3", destination: { x: 1, y: 2 } });
assert.equal(speedOfDark.ok, true);
assert.equal(speedOfDark.events.some(event => event.type === "resource.spend"), false);
assert.ok(speedOfDark.events.some(event => event.type === "effect.apply" && event.payload.effect === "positive.невидим"), "Speed of Dark is free and applies Invisible");

const flashStepScene = structuredClone(scene);
flashStepScene.actors[0].techniques = { "vagabond.speed-demon": 2 };
flashStepScene.actors[0].comboCooldowns = {};
flashStepScene.log.unshift({ id: "previous-rest-flash", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Передышка").id, actionName: "Передышка", name: "Передышка" } });
const flashStep = Engine.prepareTechniqueCombo(flashStepScene, data, { actorId: "hero", ruleId: "vagabond.speed-demon.2", destination: { x: 6, y: 1 } });
assert.equal(flashStep.ok, true);
assert.ok(flashStep.events.find(event => event.type === "actor.move").payload.path.length > 4, "Flash Step triples the Step movement allowance through the generic combo modifier");

const heaveScene = structuredClone(scene);
heaveScene.actors[0].techniques = { "powerhouse.dragonslayer": 3 };
heaveScene.actors[0].comboCooldowns = {};
heaveScene.log.unshift({ id: "previous-rest-heave", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Передышка").id, actionName: "Передышка", name: "Передышка" } });
const titanicHeave = Engine.prepareTechniqueCombo(heaveScene, data, { actorId: "hero", ruleId: "powerhouse.dragonslayer.3", targetIds: ["enemy"], attribute: "body", roll: { formula: "3D6", attribute: "body", rolls: [1, 2, 3], successes: 0, crits: 0 } });
assert.equal(titanicHeave.ok, true);
const heavePending = titanicHeave.events.find(event => event.type === "attack.pending").payload;
assert.equal(heavePending.roll.successes, 3, "Titanic Heave counts every die as a Success");
assert.equal(heavePending.postDisplacements[0].maximum, 2);
let heaveFlow = Engine.dispatchMany(heaveScene, titanicHeave.events).scene;
heaveFlow = Engine.dispatchMany(heaveFlow, Engine.respondReaction(heaveFlow, data, { actorId: "enemy", choice: "pass" }).events).scene;
heaveFlow = Engine.dispatchMany(heaveFlow, Engine.resolvePendingAction(heaveFlow, data).events).scene;
assert.equal(heaveFlow.actors.find(actor => actor.id === "enemy").x, 4);
assert.ok(heaveFlow.actors.find(actor => actor.id === "enemy").effects.includes("negative.разорван"), "Dragonslayer I applies Torn after a successful Body Finish");
assert.ok(heaveFlow.actors.find(actor => actor.id === "hero").effects.includes("negative.ослаблен"), "Titanic Heave applies Weakened only after the pending Attack resolves");

const witchScene = structuredClone(scene);
witchScene.actors[0].techniques = { "powerhouse.spellsword": 3 };
witchScene.actors[0].comboCooldowns = {};
witchScene.log.unshift({ id: "previous-spell-witch", type: "action.prepare", actorId: "hero", payload: { actionId: actionNamed("Заклинание").id, actionName: "Заклинание", name: "Заклинание", targetIds: ["enemy"] } });
const witchHunter = Engine.prepareTechniqueCombo(witchScene, data, { actorId: "hero", ruleId: "powerhouse.spellsword.3", targetIds: ["enemy"], attribute: "body", roll: { formula: "3D6", attribute: "body", rolls: [5, 4, 2], successes: 2, crits: 0 } });
assert.equal(witchHunter.ok, true);
assert.equal(witchHunter.events.find(event => event.type === "attack.pending").payload.damage, 8, "Witch Hunter adds Spirit to the Finish damage");
const wrongWitchTarget = structuredClone(witchScene);
wrongWitchTarget.actors.push({ ...structuredClone(witchScene.actors[1]), id: "enemy-2", name: "Другая цель", x: 1, y: 2 });
assert.equal(Engine.prepareTechniqueCombo(wrongWitchTarget, data, { actorId: "hero", ruleId: "powerhouse.spellsword.3", targetIds: ["enemy-2"], attribute: "talent", roll: { formula: "4D6", attribute: "talent", rolls: [6, 4, 2, 1], successes: 3, crits: 1 } }).ok, false, "Witch Hunter must keep the preceding Spell target");

const viperScene = structuredClone(enemyScene);
viperScene.actors[1].profileId = "enemy.common.viper";
viperScene.actors[1].tier = 2;
viperScene.actors[0].effects = ["negative.порчен"];
viperScene.actors.push({ ...structuredClone(viperScene.actors[0]), id: "hero-corrupt", hp: 12, x: 1, y: 2 });
const lick = Engine.availableEnemyRules(viperScene, data, "enemy").find(rule => rule.en === "Lick The Knife");
assert.equal(lick.automation, "full");
const licked = Engine.dispatchMany(viperScene, Engine.prepareEnemyRule(viperScene, data, { actorId: "enemy", ruleId: lick.id }).events).scene;
assert.equal(licked.actors.find(actor => actor.id === "hero").hp, 4);
assert.equal(licked.actors.find(actor => actor.id === "hero-corrupt").hp, 4, "Lick the Knife damages every Corrupted player by count × scaled value");

const cocoonScene = structuredClone(enemyScene);
cocoonScene.tension = 3;
cocoonScene.actors[1].profileId = "enemy.common.cocoon";
const growthRule = Engine.availableEnemyRules(cocoonScene, data, "enemy").find(rule => rule.en === "Quick Growth");
const grown = Engine.dispatchMany(cocoonScene, Engine.prepareEnemyRule(cocoonScene, data, { actorId: "enemy", ruleId: growthRule.id }).events).scene;
assert.equal(grown.actors[1].ruleState.growth, 1);
assert.equal(grown.actors[1].extraTurns, 1, "Quick Growth records Growth and grants the immediate extra Turn");
const extraTurn = Engine.dispatch(grown, { type: "turn.end", actorId: "enemy", payload: {} }).scene;
assert.equal(extraTurn.activeActorId, "enemy");
assert.equal(extraTurn.actors[1].ap, extraTurn.actors[1].baseAp);
assert.equal(extraTurn.log[0].payload.startedExtraTurn, true, "Ending the first Turn immediately opens the granted Turn with fresh per-Turn history");

const trapScene = structuredClone(scene);
trapScene.activeActorId = "enemy";
trapScene.actors[0].techniques = { "disruptor.hunter": 1 };
trapScene.actors[0].x = 0;
trapScene.actors[0].y = 0;
trapScene.actors[1].x = 3;
trapScene.actors[1].y = 1;
trapScene.actors[1].speed = 3;
trapScene.actors[1].ap = 2;
trapScene.markers = [{ id: "trap", kind: "trap", ruleId: "disruptor.hunter.1", source: "disruptor.hunter.1", ownerActorId: "hero", space: "main", x: 2, y: 1 }];
const trappedStep = Engine.prepareAction(trapScene, data, { actorId: "enemy", actionId: actionNamed("Шаг").id, destination: { x: 0, y: 1 } });
assert.equal(trappedStep.ok, true);
const trapped = Engine.dispatchMany(trapScene, trappedStep.events).scene;
assert.deepEqual([trapped.actors[1].x, trapped.actors[1].y], [2, 1], "A Hunter trap truncates movement at the crossed trap cell");
assert.equal(trapped.pendingPrompt.kind, "hunter-trap");
const trapAttack = Engine.respondRulePrompt(trapped, data, { choice: "attack", roll: { formula: "3D6", rolls: [4, 5, 2], successes: 2, crits: 0 } });
const trapAttackScene = Engine.dispatchMany(trapped, trapAttack.events).scene;
assert.equal(trapAttackScene.pendingAction.techniqueRuleId, "disruptor.hunter.1");

const alchemistScene = structuredClone(scene);
alchemistScene.actors[0].techniques = { "altruist.alchemist": 2 };
const alchemistRest = Engine.prepareAction(alchemistScene, data, { actorId: "hero", actionId: actionNamed("Передышка").id });
const mixed = Engine.dispatchMany(alchemistScene, alchemistRest.events).scene;
assert.equal(mixed.pendingPrompt.kind, "alchemist-mix");
const potionCreated = Engine.dispatchMany(mixed, Engine.respondRulePrompt(mixed, data, { choice: "rage-fumes" }).events).scene;
assert.equal(potionCreated.actors[0].inventory["potion:rage-fumes"], 1);

console.log("Scene engine QA passed: canonical Turns and AP, once-per-Round actions, strict Reactions, truthful enemy automation, effects, movement, damage, and public events");
