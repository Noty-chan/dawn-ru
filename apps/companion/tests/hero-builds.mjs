import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8"), context);

const SceneEngine = context.DAWN_SCENE_ENGINE;
const TechniqueEngine = context.DAWN_TECHNIQUE_ENGINE;
const data = context.DAWN_DATA;
const actionNamed = name => data.actions.list.find(action => action.name === name);
const actor = (overrides = {}) => ({
  id: "hero", kind: "hero", name: "Герой", team: "hero", space: "main", x: 1, y: 1,
  ap: 3, baseAp: 3, focus: 6, hp: 12, maxHp: 12, guts: 4, wounds: 0,
  speed: 4, armor: 0, evasion: 0, tier: 1,
  attrs: { body: 3, talent: 4, spirit: 4, mind: 3 }, effects: [], effectStates: {},
  usedActions: [], acted: false, techniques: {}, techniqueState: { spellModifiers: [] },
  ruleState: {}, ruleResources: {}, ruleClocks: {}, inventory: {},
  ...overrides,
});
const foe = (overrides = {}) => actor({
  id: "enemy", kind: "enemy", name: "Враг", team: "enemy", x: 5, y: 1,
  ap: 2, baseAp: 2, focus: 0, hp: 20, maxHp: 20, guts: 0,
  attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, techniques: {}, ...overrides,
});
const ally = (overrides = {}) => actor({
  id: "ally", name: "Союзник", x: 1, y: 2, hp: 5, maxHp: 12, techniques: {}, ...overrides,
});
const sceneWith = (hero, others = [foe()]) => ({
  version: 0, round: 1, tension: 2, turnSerial: 1, activeActorId: hero.id, activeSpace: "main",
  spaces: [{ id: "main", name: "Поле", width: 10, height: 8 }],
  actors: [hero, ...others], objects: [], markers: [], targetIds: [], log: [], rollFeed: [],
});
const coverageFor = techniques => TechniqueEngine.techniqueCoverage(data, techniques);

const chainedBuild = {
  "vagabond.enchained": 1,
  "vagabond.untouchable": 1,
  "altruist.surgeon": 1,
  "ruiner.creation-ascetic": 2,
};
assert.equal(coverageFor(chainedBuild).find(level => level.id === "altruist.surgeon.1")?.automation, "partial", "The build UI exposes the audited missing authoritative Mind-roll validation");
assert.ok(coverageFor(chainedBuild).filter(level => level.id !== "altruist.surgeon.1").every(level => !["manual", "partial"].includes(level.automation)), "Only the independently downgraded Surgery level is partial in the chained support fixture");
const chainedHero = actor({ techniques: chainedBuild, creationMarks: 0 });
const chainedScene = sceneWith(chainedHero, [ally(), foe({ x: 7, y: 7 })]);
const hook = TechniqueEngine.preview(chainedScene, {
  actorId: "hero", ruleId: "vagabond.enchained.1", anchor: { x: 3, y: 1 }, destination: { x: 3, y: 3 },
});
assert.equal(hook.ok, true, "Hook Shot works while the Creation Ascetic has no Marks");
const hooked = SceneEngine.dispatchMany(chainedScene, hook.events).scene;
assert.deepEqual([hooked.actors[0].x, hooked.actors[0].y], [3, 3]);
assert.equal(hooked.actors[0].ap, 2);

const markedScene = structuredClone(chainedScene);
markedScene.actors[0].creationMarks = 1;
markedScene.actors[0].ruleResources = { "creation-marks": { value: 1 } };
const blockedHook = TechniqueEngine.preview(markedScene, {
  actorId: "hero", ruleId: "vagabond.enchained.1", anchor: { x: 3, y: 1 }, destination: { x: 3, y: 3 },
});
assert.equal(blockedHook.ok, false, "Creation Marks force the matching Creation Ascetic attack form");
assert.match(blockedHook.errors.join(" "), /форму Аскета творения/);

const surgery = TechniqueEngine.preview(chainedScene, {
  actorId: "hero", ruleId: "altruist.surgeon.1", targetIds: ["ally"],
  roll: { formula: "3D6 · Разум", rolls: [6, 4, 2], successes: 2, crits: 1 },
});
assert.equal(surgery.ok, true);
const operated = SceneEngine.dispatchMany(chainedScene, surgery.events).scene;
assert.equal(operated.actors.find(item => item.id === "ally").hp, 6, "Surgery heals half the Mind-roll successes instead of dealing damage");
assert.equal(operated.actors[0].ap, 2);

const creationScene = sceneWith(actor({ techniques: chainedBuild, creationMarks: 0 }));
const charge = SceneEngine.prepareAction(creationScene, data, { actorId: "hero", actionId: actionNamed("Зарядка").id, roll: { formula: "4D6 · Дух", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } });
assert.equal(charge.ok, true);
assert.equal(charge.events.find(event => event.type === "resource.spend")?.payload.amount, 1, "Creation Ascetic II reduces Charge to 1 AP");
const charged = SceneEngine.dispatchMany(creationScene, charge.events).scene;
assert.equal(SceneEngine.ruleResourceStatus(charged, "hero", { resource: "creation-marks" }).balance, 2, "Charge gains Creation Marks instead of Focus");

const shadowBuild = { "vagabond.assassin": 2, "ruiner.grim-ascendant": 2, "disruptor.hunter": 1 };
const shadowCoverage = coverageFor(shadowBuild);
assert.deepEqual(Array.from(shadowCoverage.filter(level => level.automation === "partial"), level => level.id), [], "Assassin I-II expose their completed deployment and dice contracts");
assert.ok(shadowCoverage.every(level => level.automation !== "manual"), "The assassin/ascendant/hunter build has no fully manual level");
const upgradedShadowBuild = { "vagabond.assassin": 3, "ruiner.grim-ascendant": 2, "disruptor.hunter": 2 };
assert.deepEqual(Array.from(coverageFor(upgradedShadowBuild).filter(level => level.automation === "partial"), level => level.id), [], "Upgrading Assassin keeps every family level on an implemented path");
const shadowBeforeDeployment = sceneWith(actor({ techniques: shadowBuild, x: 3, y: 3, hp: 8, focus: 0 }), [foe({ x: 4, y: 3 })]);
const shadowScene = SceneEngine.dispatch(shadowBeforeDeployment, { type: "actor.move", actorId: "hero", payload: { space: "main", x: 3, y: 4, movement: "Развертывание", placement: true } }).scene;
const hide = SceneEngine.prepareAction(shadowScene, data, { actorId: "hero", actionId: actionNamed("Скрыться").id });
assert.equal(hide.ok, true, "Assassin I ignores the ordinary edge requirement on the first action after Deployment");
const hidden = SceneEngine.dispatchMany(shadowScene, hide.events).scene;
assert.equal(hidden.actors[0].ap, 3, "Assassin I makes the opening Hide free and Quick");
assert.ok(hidden.actors[0].effects.includes("positive.исчез"));

const grimScene = sceneWith(actor({ techniques: shadowBuild, x: 3, y: 3, hp: 8, focus: 0 }), [foe({ x: 4, y: 3 })]);
const grimCharge = SceneEngine.prepareAction(grimScene, data, { actorId: "hero", actionId: actionNamed("Зарядка").id });
const chargedGrim = SceneEngine.dispatchMany(grimScene, grimCharge.events).scene;
assert.equal(chargedGrim.pendingPrompt?.kind, "grim-transform");
const transform = SceneEngine.respondRulePrompt(chargedGrim, data, { actorId: "hero", choice: "transform" });
assert.equal(transform.ok, true);
const transformed = SceneEngine.dispatchMany(chargedGrim, transform.events).scene;
assert.equal(transformed.actors[0].hp, 1);
assert.equal(transformed.actors[0].ruleState.grimTransformed, true);
assert.ok(transformed.actors[0].focus >= 14, "Lost Health becomes doubled Focus");
assert.ok(SceneEngine.availableActions(transformed, data, "hero").find(item => item.name === "Заклинание")?.quick, "The first transformed Spell is Quick");
const grimSpell = actionNamed("Заклинание");
const afterFirstGrimSpell = SceneEngine.dispatch(transformed, { type: "action.prepare", actorId: "hero", payload: { actionId: grimSpell.id, name: grimSpell.name, quick: true } }).scene;
assert.equal(SceneEngine.availableActions(afterFirstGrimSpell, data, "hero").find(item => item.name === grimSpell.name)?.quick, false, "Only the first transformed Spell in a Turn is Quick");
const nextGrimTurn = structuredClone(afterFirstGrimSpell);
nextGrimTurn.log.unshift({ id: "next-grim-turn", type: "turn.start", actorId: "hero", payload: {} });
assert.equal(SceneEngine.availableActions(nextGrimTurn, data, "hero").find(item => item.name === grimSpell.name)?.quick, true, "A transformed Spell becomes Quick again at the start of every Turn");

const trapScene = sceneWith(actor({ techniques: shadowBuild, x: 3, y: 3 }), [foe({ x: 7, y: 7 })]);
const trap = TechniqueEngine.preview(trapScene, { actorId: "hero", ruleId: "disruptor.hunter.1", anchor: { x: 4, y: 3 }, options: { actionMode: "skirmish" } });
assert.equal(trap.ok, true);
const trapped = SceneEngine.dispatchMany(trapScene, trap.events).scene;
assert.equal(trapped.markers[0]?.kind, "trap");
assert.equal(trapped.actors[0].ap, 2, "Hunter I pays the Skirmish cost while marking the trap placement Quick");
assert.equal(trap.events.find(event => event.type === "action.prepare")?.payload.quick, true);

const farTrapScene = sceneWith(actor({ techniques: upgradedShadowBuild, x: 1, y: 1 }), [foe({ x: 8, y: 7 })]);
const farTrap = TechniqueEngine.preview(farTrapScene, { actorId: "hero", ruleId: "disruptor.hunter.1", anchor: { x: 5, y: 1 }, options: { actionMode: "skirmish" } });
assert.equal(farTrap.ok, true, "Hunter II extends empty-cell Skirmishes to range 4");

const emptyCellScene = sceneWith(actor({ x: 1, y: 1 }), [foe({ x: 8, y: 7 })]);
const emptyCellSkirmish = SceneEngine.prepareAction(emptyCellScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetCells: ["2,1"], attribute: "talent",
  roll: { formula: "4D6 · Талант", attribute: "talent", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(emptyCellSkirmish.ok, true, "A core Skirmish can target an adjacent empty cell");
assert.deepEqual(Array.from(emptyCellSkirmish.events[0].payload.targetCells), ["2,1"]);
const emptyCellPending = SceneEngine.dispatchMany(emptyCellScene, emptyCellSkirmish.events).scene;
assert.deepEqual(Array.from(emptyCellPending.pendingAction.targetCells), ["2,1"]);
assert.equal(SceneEngine.pendingActionStatus(emptyCellPending, data).canResolve, true, "An empty-cell Skirmish needs no character Reaction");
const emptyCellResolution = SceneEngine.resolvePendingAction(emptyCellPending, data);
assert.equal(emptyCellResolution.ok, true);
assert.deepEqual(Array.from(emptyCellResolution.events.find(event => event.type === "action.resolve").payload.targetCells), ["2,1"], "Resolved actions expose targeted cells to technique triggers");

const occupiedCellScene = structuredClone(emptyCellScene);
occupiedCellScene.actors.find(item => item.id === "enemy").x = 2;
occupiedCellScene.actors.find(item => item.id === "enemy").y = 1;
const occupiedCellSkirmish = SceneEngine.prepareAction(occupiedCellScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetCells: ["2,1"], attribute: "talent",
  roll: { formula: "4D6 · Талант", attribute: "talent", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(occupiedCellSkirmish.ok, true, "A board cell remains targetable when an opponent occupies it");
assert.deepEqual(Array.from(occupiedCellSkirmish.events.find(event => event.type === "attack.pending").payload.targetIds), ["enemy"], "The authority derives the current occupant of a targeted cell");
assert.deepEqual(Array.from(occupiedCellSkirmish.events.find(event => event.type === "attack.pending").payload.targetCells), ["2,1"], "The cell provenance is preserved alongside its occupant");

const nonCanonicalCellSkirmish = SceneEngine.prepareAction(emptyCellScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetCells: ["02,1"], attribute: "talent",
  roll: { formula: "4D6 · Талант", attribute: "talent", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(nonCanonicalCellSkirmish.ok, false);
assert.match(nonCanonicalCellSkirmish.errors.join(" "), /вне доступного поля/, "Non-canonical cell keys cannot bypass topology and occupancy checks");

const hunterCellSkirmish = SceneEngine.prepareAction(farTrapScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetCells: ["5,1"], attribute: "talent",
  roll: { formula: "4D6 · Талант", attribute: "talent", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(hunterCellSkirmish.ok, true, "Hunter II extends the common empty-cell Skirmish target to range 4");

const assassinCellScene = sceneWith(actor({ techniques: { "vagabond.assassin": 2 }, x: 1, y: 1, effects: ["positive.исчез"] }), [foe({ x: 8, y: 7 })]);
const assassinCellPlan = SceneEngine.prepareActionPlan(assassinCellScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, phase: "reappear",
  context: { targetIds: [], targetCells: ["3,2"], attackModifierIds: [], attribute: "talent", roll: { formula: "4D6 · Талант", attribute: "talent", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } },
});
assert.equal(assassinCellPlan.ok, true);
const assassinCellPlanned = SceneEngine.dispatchMany(assassinCellScene, assassinCellPlan.events).scene;
const assassinCellPlacement = SceneEngine.prepareActionPlanReappearance(assassinCellPlanned, { actorId: "hero", destination: { x: 2, y: 2 } });
assert.equal(assassinCellPlacement.ok, true);
const assassinCellReady = SceneEngine.dispatchMany(assassinCellPlanned, assassinCellPlacement.events).scene;
const assassinCellDice = SceneEngine.diceRollPayload(assassinCellReady, "hero", { scope: "action", baseCount: 4, advantage: 1, hindrance: 0, attribute: "talent", actionId: actionNamed("Стычка").id, criticalAt: 5, targetIds: [] }, { rolls: [6, 5, 4, 2, 1] });
const assassinCellAttack = SceneEngine.prepareActionPlanContinuation(assassinCellReady, data, { actorId: "hero", context: { roll: assassinCellDice.payload, attribute: "talent" } });
assert.equal(assassinCellAttack.ok, true, "Assassin reappearance remains compatible with empty-cell Skirmish targets");
assert.deepEqual(Array.from(assassinCellAttack.events.find(event => event.type === "attack.pending").payload.targetCells), ["3,2"]);

const tooManyCellTargets = SceneEngine.prepareAction(emptyCellScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetCells: ["2,1", "1,2", "0,1"], attribute: "talent",
  roll: { formula: "4D6 · Талант", attribute: "talent", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(tooManyCellTargets.ok, false);
assert.match(tooManyCellTargets.errors.join(" "), /не больше 2/);

const neelBuild = { "altruist.alchemist": 2, "ruiner.spellcrafter": 3, "ruiner.cryomancer": 2 };
const neelCoverage = coverageFor(neelBuild);
assert.equal(neelCoverage.length, 7, "Neel's build exposes every selected technique level to the coverage UI");
assert.equal(neelCoverage.find(level => level.id === "altruist.alchemist.2")?.automation, "decision", "The optional enemy-potion branch is exposed as a canonical decision");
const cryomancerScene = sceneWith(actor({
  techniques: neelBuild,
  attrs: { body: 2, talent: 2, spirit: 3, mind: 4 },
  ruleClocks: { "ruiner.cryomancer.icicle": { clockId: "ruiner.cryomancer.icicle", label: "Сосулька", size: 4, minimumSize: 4, initial: 0, resetScope: "scene", active: true, value: 0 } },
}), [foe({ x: 5, y: 1 })]);
const chillingSpell = SceneEngine.prepareAction(cryomancerScene, data, {
  actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], attribute: "spirit",
  roll: { formula: "4D6 · Дух", attribute: "spirit", rolls: [6, 4, 2, 1], successes: 2, crits: 1 },
});
assert.equal(chillingSpell.ok, true);
let chilled = SceneEngine.dispatchMany(cryomancerScene, chillingSpell.events).scene;
chilled = SceneEngine.dispatchMany(chilled, SceneEngine.respondReaction(chilled, data, { actorId: "enemy", choice: "pass" }).events).scene;
chilled = SceneEngine.dispatchMany(chilled, SceneEngine.resolvePendingAction(chilled, data).events).scene;
assert.ok(chilled.actors.find(item => item.id === "enemy").effects.includes("negative.замедлен"), "Cryomancer I slows every target of a successful Spell");
const focused = SceneEngine.dispatchMany(chilled, [{ type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 3, sourceActionId: "test.focus" } }]).scene;
assert.equal(SceneEngine.clockStatus(focused, "hero", "ruiner.cryomancer.icicle").value, 1, "Cryomancer II fills one Icicle segment whenever Focus is gained");

const spellcrafterBuild = { "ruiner.spellcrafter": 3 };
assert.ok(coverageFor(spellcrafterBuild).every(level => level.automation === "decision"), "Spellcrafter exposes the completed persisted modifier choices at every level");
const experimentalScene = sceneWith(actor({ techniques: { "ruiner.spellcrafter": 1 }, innovationCharges: 3, techniqueState: { spellcrafterLearnedModifiers: ["fierce"], spellModifiers: ["fierce"] } }), [foe({ x: 4, y: 1 })]);
const experimentalSpell = SceneEngine.prepareAction(experimentalScene, data, { actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], attribute: "spirit", roll: { formula: "4D6 · Дух", attribute: "spirit", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } });
assert.equal(experimentalSpell.ok, true);
assert.deepEqual(Array.from(experimentalSpell.events.filter(event => event.type === "resource.spend").map(event => [event.payload.resource, event.payload.amount])), [["ap", 1], ["innovationCharges", 1]], "Spellcrafter I spends one Innovation, not Focus");
const experimentalPending = SceneEngine.dispatchMany(experimentalScene, experimentalSpell.events).scene;
assert.equal(experimentalPending.pendingAction.damage, 5, "The single persisted level-I Fierce augment adds Mind damage");
const focusedTargetScene = sceneWith(actor({ techniques: spellcrafterBuild, focus: 3, techniqueState: { spellcrafterLearnedModifiers: ["focused"], spellModifiers: ["focused"] } }), [foe({ x: 4, y: 1 })]);
const focusedTargetSpell = SceneEngine.prepareAction(focusedTargetScene, data, { actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], attribute: "spirit", roll: { formula: "4D6 · Дух", attribute: "spirit", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } });
assert.equal(focusedTargetSpell.ok, true, "Focused no longer blocks the normal target picker when the current attack has no Zone to replace");
assert.deepEqual(Array.from(focusedTargetSpell.events.find(event => event.type === "attack.pending").payload.targetIds), ["enemy"]);
const spellScene = sceneWith(actor({ techniques: spellcrafterBuild, focus: 5, techniqueState: { spellcrafterLearnedModifiers: ["fierce", "outstanding"], spellModifiers: ["fierce", "outstanding"] } }), [foe({ x: 8, y: 1 })]);
const spell = SceneEngine.prepareAction(spellScene, data, {
  actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], attribute: "spirit",
  roll: { formula: "4D6 · Дух", attribute: "spirit", rolls: [6, 5, 2, 1], successes: 2, crits: 1 },
});
assert.equal(spell.ok, true, "Outstanding extends a Spell far enough to reach the selected target");
const crafted = SceneEngine.dispatchMany(spellScene, spell.events).scene;
assert.equal(crafted.actors[0].focus, 3, "Two different level-3 Modifications cost 2 Focus");
assert.deepEqual(Array.from(crafted.actors[0].techniqueState.spellModifiers), [], "Applied Modifications clear after the attack is prepared");
assert.equal(crafted.pendingAction.damage, 5, "Fierce adds Mind to attack damage");
const underfundedFinalization = sceneWith(actor({ techniques: spellcrafterBuild, focus: 1, techniqueState: { spellcrafterLearnedModifiers: ["fierce", "outstanding"], spellModifiers: ["fierce", "outstanding"] } }), [foe({ x: 4, y: 1 })]);
assert.equal(SceneEngine.prepareAction(underfundedFinalization, data, { actorId: "hero", actionId: actionNamed("Заклинание").id, targetIds: ["enemy"], attribute: "spirit", roll: { formula: "4D6", attribute: "spirit", rolls: [6, 4, 2, 1], successes: 2, crits: 1 } }).ok, false, "Finalization cannot partially pay for two learned augments");

const wispBuild = { "altruist.will-o-wisp": 3 };
assert.deepEqual(Array.from(coverageFor(wispBuild), level => level.automation), ["decision", "decision", "decision"], "Will-O-Wisp exposes all three completed interactive levels");
const wispScene = sceneWith(actor({ techniques: wispBuild, focus: 4, techniqueState: { wispLearnedTypes: ["bright", "dreamy"] } }), [ally({ x: 2, y: 1 }), foe({ x: 1, y: 2 })]);
const wispCharge = SceneEngine.prepareAction(wispScene, data, { actorId: "hero", actionId: actionNamed("Зарядка").id });
const offered = SceneEngine.dispatchMany(wispScene, wispCharge.events).scene;
assert.equal(offered.pendingPrompt?.kind, "wisp-primary");
const firstSpirit = SceneEngine.respondRulePrompt(offered, data, { actorId: "hero", choice: "bright" });
const choosingLayout = SceneEngine.dispatchMany(offered, firstSpirit.events).scene;
assert.equal(choosingLayout.pendingPrompt?.kind, "wisp-secondary");
assert.equal(choosingLayout.actors[0].ruleState.wispCreationUsed, true);
const secondSpirit = SceneEngine.respondRulePrompt(choosingLayout, data, { actorId: "hero", choice: "split:dreamy" });
const twinWisps = SceneEngine.dispatchMany(choosingLayout, secondSpirit.events).scene;
assert.equal(twinWisps.markers.length, 2);
assert.ok(SceneEngine.effectiveEffects(twinWisps, "ally").includes("positive.ускорен"));
assert.ok(SceneEngine.effectiveEffects(twinWisps, "enemy").includes("negative.замедлен"));

const attackedWispScene = sceneWith(actor({ techniques: wispBuild, x: 1, y: 1, techniqueState: { wispLearnedTypes: ["bright", "dreamy"] } }), [foe({ x: 2, y: 1 })]);
attackedWispScene.markers = [{ id: "attacked-wisp", kind: "ritual", ruleId: "altruist.will-o-wisp.1", source: "altruist.will-o-wisp.1", ownerActorId: "hero", space: "main", x: 2, y: 1, duration: "scene", metadata: { spiritTypes: ["bright"] } }];
const attackFlame = SceneEngine.prepareAction(attackedWispScene, data, { actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], attribute: "body", roll: { formula: "3D6 · Тело", attribute: "body", rolls: [6, 4, 2], successes: 2, crits: 1 } });
let flameUnderAttack = SceneEngine.dispatchMany(attackedWispScene, attackFlame.events).scene;
flameUnderAttack = SceneEngine.dispatchMany(flameUnderAttack, SceneEngine.respondReaction(flameUnderAttack, data, { actorId: "enemy", choice: "pass" }).events).scene;
flameUnderAttack = SceneEngine.dispatchMany(flameUnderAttack, SceneEngine.resolvePendingAction(flameUnderAttack, data).events).scene;
assert.deepEqual([flameUnderAttack.markers[0].x, flameUnderAttack.markers[0].y], [3, 1], "An attack targeting a Spirit Flame's cell pushes it exactly one cell away");

const wispStopScene = sceneWith(actor({ techniques: wispBuild, focus: 2, x: 0, y: 0, techniqueState: { wispLearnedTypes: ["bright", "dreamy"] } }), [foe({ x: 1, y: 1, ap: 2, speed: 4 })]);
wispStopScene.activeActorId = "enemy";
wispStopScene.markers = [{ id: "hostile-wisp", kind: "ritual", ruleId: "altruist.will-o-wisp.1", source: "altruist.will-o-wisp.1", ownerActorId: "hero", space: "main", x: 1, y: 1, duration: "scene", metadata: { spiritTypes: ["dreamy"] } }];
const crossingStep = SceneEngine.prepareAction(wispStopScene, data, { actorId: "enemy", actionId: actionNamed("Шаг").id, destination: { x: 4, y: 1 } });
assert.equal(crossingStep.ok, true);
const interruptedByWisp = SceneEngine.dispatchMany(wispStopScene, crossingStep.events).scene;
assert.deepEqual([interruptedByWisp.actors[1].x, interruptedByWisp.actors[1].y], [2, 1], "Will-O-Wisp II interrupts movement at the first exit before downstream cells are entered");
assert.equal(interruptedByWisp.pendingPrompt?.kind, "wisp-stop");
assert.ok(!interruptedByWisp.log.some(event => event.type === "actor.move" && event.actorId === "enemy" && Number(event.payload?.x) === 4), "The unconfirmed remainder is not committed before the owner's decision");
const reconnectedWispPrompt = structuredClone(interruptedByWisp);
const stoppedByWisp = SceneEngine.dispatchMany(reconnectedWispPrompt, SceneEngine.respondRulePrompt(reconnectedWispPrompt, data, { choice: "stop" }).events).scene;
assert.deepEqual([stoppedByWisp.actors[1].x, stoppedByWisp.actors[1].y], [2, 1]);
assert.equal(stoppedByWisp.actors[0].focus, 1, "Stopping after reconnect spends exactly one Focus and does not roll movement back");
const staleWispMarker = structuredClone(interruptedByWisp);
staleWispMarker.markers = [];
assert.equal(SceneEngine.respondRulePrompt(staleWispMarker, data, { choice: "stop" }).ok, false, "A removed flame invalidates the persisted stop prompt before payment");
const staleWispTarget = structuredClone(interruptedByWisp);
staleWispTarget.actors.find(item => item.id === "enemy").x = 3;
assert.equal(SceneEngine.respondRulePrompt(staleWispTarget, data, { choice: "stop" }).ok, false, "A target moved after the prompt cannot be stopped from stale continuation state");
const exhaustedWispOwner = structuredClone(interruptedByWisp);
exhaustedWispOwner.actors.find(item => item.id === "hero").focus = 0;
assert.equal(SceneEngine.respondRulePrompt(exhaustedWispOwner, data, { choice: "stop" }).ok, false, "Focus is revalidated at response time and is not leaked on rejection");
const resumedPastWisp = SceneEngine.dispatchMany(interruptedByWisp, SceneEngine.respondRulePrompt(interruptedByWisp, data, { choice: "pass" }).events).scene;
assert.deepEqual([resumedPastWisp.actors[1].x, resumedPastWisp.actors[1].y], [4, 1], "Passing resumes only the revalidated remaining path");

const declinedScene = sceneWith(actor({ techniques: wispBuild, focus: 4, techniqueState: { wispLearnedTypes: ["bright", "dreamy"] } }));
const firstDeclinedCharge = SceneEngine.dispatchMany(declinedScene, SceneEngine.prepareAction(declinedScene, data, { actorId: "hero", actionId: actionNamed("Зарядка").id }).events).scene;
assert.equal(SceneEngine.respondRulePrompt(firstDeclinedCharge, data, { actorId: "hero", choice: "heated" }).ok, false, "A forged unlearned spirit type is rejected");
const decline = SceneEngine.respondRulePrompt(firstDeclinedCharge, data, { actorId: "hero", choice: "pass" });
const declined = SceneEngine.dispatchMany(firstDeclinedCharge, decline.events).scene;
assert.equal(declined.actors[0].ruleState.wispCreationUsed, true);
const noSecondOffer = SceneEngine.dispatchMany(declined, [{ type: "action.resolve", actorId: "hero", payload: { actionId: actionNamed("Зарядка").id, name: "Зарядка", targetIds: [] } }]).scene;
assert.equal(noSecondOffer.pendingPrompt, null, "Declining the first Scene offer cannot be retried on a later Charge");

const autophageConstrictorBuild = { "disruptor.autophage": 3, "disruptor.constrictor": 2 };
assert.ok(coverageFor(autophageConstrictorBuild).filter(level => level.techniqueId === "disruptor.autophage").every(level => level.automation === "partial"), "Autophage I-III remain partial until success timing and stale-trigger defects are fixed");
const constrictorScene = sceneWith(actor({ techniques: autophageConstrictorBuild, tier: 2, hp: 20, maxHp: 20, guts: 4, focus: 0 }), [
  foe({ id: "bound", name: "Связанная цель", x: 2, y: 1, hp: 35, maxHp: 35, effects: ["negative.порчен", "negative.замедлен"] }),
]);
const wrapAttack = SceneEngine.prepareAction(constrictorScene, data, {
  actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["bound"], attribute: "body",
  roll: { formula: "3D6 · Тело", attribute: "body", rolls: [6, 4, 2], successes: 2, crits: 1 },
});
assert.equal(wrapAttack.ok, true);
let wrapped = SceneEngine.dispatchMany(constrictorScene, wrapAttack.events).scene;
wrapped = SceneEngine.dispatchMany(wrapped, SceneEngine.respondReaction(wrapped, data, { actorId: "bound", choice: "pass" }).events).scene;
wrapped = SceneEngine.dispatchMany(wrapped, SceneEngine.resolvePendingAction(wrapped, data).events).scene;
assert.ok(wrapped.actors.find(item => item.id === "bound").effects.includes("negative.пойман"), "A successful single-target Skirmish applies Caught");
assert.ok(wrapped.actors[0].effects.includes("positive.регенерирует"), "Autophage starts Regenerating after attacking a target with two different Effects");
assert.ok(wrapped.actors.find(item => item.id === "bound").effectStates["negative.пойман"].sources.some(source => source.actorId === "hero"), "Caught preserves the Constrictor as its source");

const remoteFinishScene = structuredClone(wrapped);
remoteFinishScene.actors.find(item => item.id === "bound").x = 8;
remoteFinishScene.actors.find(item => item.id === "bound").y = 1;
const choke = SceneEngine.prepareAction(remoteFinishScene, data, {
  actorId: "hero", actionId: actionNamed("Завершение").id, targetIds: ["bound"], attribute: "body",
  roll: { formula: "3D6 · Тело", attribute: "body", rolls: [6, 4, 2], successes: 2, crits: 1 },
});
assert.equal(choke.ok, true, "A Body Finisher can target the Constrictor's own Caught character at any distance");
const choked = SceneEngine.dispatchMany(remoteFinishScene, choke.events).scene;
assert.equal(choked.pendingAction.damageByTarget.bound, 6, "Choke adds the hero Tier to Finisher damage against their Caught target");

const otherSnareScene = structuredClone(wrapped);
otherSnareScene.actors[0].tier = 2;
otherSnareScene.actors.find(item => item.id === "bound").x = 2;
otherSnareScene.actors.find(item => item.id === "bound").effects = ["negative.пойман"];
otherSnareScene.actors.find(item => item.id === "bound").effectStates = { "negative.пойман": { duration: "default", sources: [{ actorId: "another-constrictor", actionId: "disruptor.constrictor.1", eventId: "other-snare" }] } };
const otherSnareFinish = SceneEngine.prepareAction(otherSnareScene, data, {
  actorId: "hero", actionId: actionNamed("Завершение").id, targetIds: ["bound"], attribute: "body",
  roll: { formula: "3D6 · Тело", attribute: "body", rolls: [6, 4, 2], successes: 2, crits: 1 },
});
assert.equal(otherSnareFinish.ok, true);
assert.equal(otherSnareFinish.events.find(event => event.type === "attack.pending").payload.damageByTarget.bound, 6, "Choke adds Tier damage to any Snared target, while remote targeting remains restricted to the Constrictor's own Snare");

let finished = SceneEngine.dispatchMany(choked, SceneEngine.respondReaction(choked, data, { actorId: "bound", choice: "pass" }).events).scene;
finished = SceneEngine.dispatchMany(finished, SceneEngine.resolvePendingAction(finished, data).events).scene;
const mutable = TechniqueEngine.preview(finished, { actorId: "hero", ruleId: "disruptor.autophage.3", rolls: [2, 5] });
assert.equal(mutable.ok, true);
assert.equal(mutable.events.filter(event => event.type === "damage.apply" && event.payload.targetId === "hero").length, 2, "Two Overexert invocations each charge Health while the hero remains above Guts");
const overexerted = SceneEngine.dispatchMany(finished, mutable.events).scene;
assert.equal(overexerted.actors[0].hp, 10);
assert.ok(overexerted.actors.find(item => item.id === "bound").effects.includes("negative.обездвижен"));

const endTurnScene = sceneWith(actor({ techniques: autophageConstrictorBuild, ap: 0, tier: 2 }), [foe({ id: "bound", x: 2, y: 1 })]);
endTurnScene.actors[1].effects = ["negative.пойман"];
endTurnScene.actors[1].effectStates = { "negative.пойман": { duration: "default", sources: [{ actorId: "hero", actionId: "disruptor.constrictor.1", eventId: "caught" }] } };
const ending = SceneEngine.dispatchMany(endTurnScene, [{ type: "turn.end", actorId: "hero", payload: {} }]).scene;
assert.equal(ending.pendingPrompt?.kind, "constrictor-move-select");
const chooseBound = SceneEngine.respondRulePrompt(ending, data, { actorId: "hero", choice: "bound" });
const choosingBoundCell = SceneEngine.dispatchMany(ending, chooseBound.events).scene;
assert.equal(choosingBoundCell.pendingPrompt?.kind, "constrictor-move-cell");
const moveBound = SceneEngine.preparePromptPlacement(choosingBoundCell, { destination: { x: 5, y: 1 } });
assert.equal(moveBound.ok, true);
assert.ok(moveBound.events.some(event => event.type === "actor.move" && event.actorId === "bound"), "Constrictor placement commits the selected Caught actor's movement");
const repositioned = SceneEngine.dispatchMany(choosingBoundCell, moveBound.events).scene;
assert.deepEqual([repositioned.actors.find(item => item.id === "bound").x, repositioned.actors.find(item => item.id === "bound").y], [5, 1]);

console.log("Hero build QA passed: Nari Tier 2, Neel Tier 2, Autophage/Constrictor, Spellcrafter III, Will-O-Wisp III, and deferred chained support");
