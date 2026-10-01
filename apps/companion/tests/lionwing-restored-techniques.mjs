import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { runtime, fixture, actor, clone, exactReplay, rejectedWithoutMutation } from "./helpers/scene-contract-harness.mjs";
const { core, engine, context } = runtime(), ids = engine.ACTION_IDS;
const restored = context.window.DAWN_LIONWING_RESTORED_TECHNIQUES;
const book = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json", import.meta.url), "utf8"));
for (const row of restored.defs) {
  const a = book.archetypes.find(a => a.techniques.some(t => t.id === row.techniqueId)), t = a.techniques.find(t => t.id === row.techniqueId), l = t.levels.find(l => l.n === row.level);
  assert.equal(crypto.createHash("sha256").update(JSON.stringify({ id: row.id, archetypeId: a.id, techniqueId: t.id, name: l.name, text: l.text, notes: t.notes, source: t.source })).digest("hex"), row.sourceDigest, row.id);
}
let serial = 0;
function run(table, request, owner = "hero", random = () => .8) {
  const before = clone(table), p = core.prepare(table, { actorId: owner, eventId: `restored-${serial++}`, ...request }, { random });
  assert.equal(p.ok, true, `${request.kind}/${request.actionId || request.choice || request.operation || request.ruleId}: ${p.errors?.join(" ")}`);
  assert.deepEqual(clone(table), before, "preparation does not mutate a snapshot");
  rejectedWithoutMutation(table, () => core.dispatchMany(table, p.events, { expectedVersion: table.version + 1 }), /Конфликт версии/);
  const result = core.dispatchMany(table, p.events, { expectedVersion: table.version }).scene;
  for (const participant of result.actors) for (const counter of Object.values(participant.ruleResources || {})) assert.equal(counter.current, counter.value, "resource mirrors stay synchronized for import");
  exactReplay(core, core.reload(JSON.stringify(result)), p.events);
  return result;
}
function fresh(techniqueId, level) { const table = fixture(); table.actors[0].knownTechniques = { [techniqueId]: level }; table.actors[0].ap = table.actors[0].baseAp = 12; table.actors[1].x = 2; return table; }
function enable(table, id) { return run(table, { kind: "automation", ruleId: id, enabled: true }); }
function answer(table, value, extras = {}) { const pending = table.lionwing.choices[0]; assert.ok(pending, "a persisted choice exists"); return run(table, { kind: "choice", id: pending.id, choice: value, ...extras }, pending.actorId); }
function resolve(table) { for (const id of engine.pendingActionStatus(table).waitingIds || []) table = run(table, { kind: "reaction", choice: "take" }, id); return run(table, { kind: "resolve-attack" }); }
function denied(table, request) { const before = clone(table); assert.equal(core.prepare(table, { actorId: "hero", ...request }).ok, false); assert.deepEqual(clone(table), before); }

let dragon = enable(fresh("powerhouse.dragonslayer", 3), "powerhouse.dragonslayer.1");
dragon = enable(dragon, "powerhouse.dragonslayer.3"); dragon.actors[1].armor = 20;
dragon = run(dragon, { kind: "action", actionId: ids.breathe });
dragon = run(dragon, { kind: "action", actionId: ids.finish, attribute: "body", targetIds: ["enemy"] }, "hero", () => .1);
assert.equal(dragon.pendingAction.damage, 5, "Titanic Heave makes every rolled die a Hit plus Tension");
const focusBefore = dragon.actors[0].focus;
dragon = resolve(dragon);
assert.equal(dragon.actors[0].focus, focusBefore + 2);
assert.equal(dragon.actors[1].hp, 25, "Shred precedes armor calculation");
assert.equal(dragon.actors[1].x, 4, "Titanic Heave pushes 2");
assert.ok(dragon.actors[0].effects.includes("negative.ослаблен"));

let laterDragon = enable(fresh("powerhouse.dragonslayer", 1), "powerhouse.dragonslayer.1");
laterDragon = run(laterDragon, { kind: "attack", targetIds: ["enemy"], amount: 0 }); laterDragon = resolve(laterDragon);
const laterFocus = laterDragon.actors[0].focus;
laterDragon = run(laterDragon, { kind: "action", actionId: ids.finish, attribute: "body", targetIds: ["enemy"] }); laterDragon = resolve(laterDragon);
assert.equal(laterDragon.actors[0].focus, laterFocus, "a preceding manual Attack blocks the first-Attack bonus");
assert.ok(!laterDragon.actors[1].effects.includes("negative.разорван"));

let disabledCreator = enable(fresh("ruiner.creation-ascetic", 3), "ruiner.creation-ascetic.3");
disabledCreator = run(disabledCreator, { kind: "automation", ruleId: "ruiner.creation-ascetic.1", enabled: false });
assert.equal(disabledCreator.actors[0].lionwing.automation["ruiner.creation-ascetic.3"], false, "disabling a prerequisite disables its dependent automation");
disabledCreator = enable(disabledCreator, "ruiner.creation-ascetic.3");
assert.equal(disabledCreator.actors[0].lionwing.automation["ruiner.creation-ascetic.1"], true);

let gun = enable(fresh("powerhouse.gunslinger", 3), "powerhouse.gunslinger.3");
let gunDie = 0;
gun = run(gun, { kind: "action", actionId: ids.spell, targetIds: ["enemy"] }, "hero", () => gunDie++ < 2 ? .99 : .1);
assert.equal(gun.pendingAction.criticals, 2);
gun = resolve(gun); gun = answer(gun, "enemy");
assert.ok(gun.actors[1].effects.includes("negative.подброшен"));
const gunHealth = gun.actors[1].hp;
gun = run(gun, { kind: "action", actionId: ids.skirmish, targetIds: [], bulletsSpent: 2, bulletTargets: ["enemy", "enemy"] });
assert.equal(gun.actors[1].hp, gunHealth - 4, "each Big Iron bullet deals double damage to a Launched target");
assert.equal(gun.lionwing.choices.length, 0, "pre-Skirmish bullets are not offered a second time");
gun = resolve(gun);

let flash = enable(fresh("vagabond.speed-demon", 2), "vagabond.speed-demon.2");
flash.spaces[0].height = 1; flash.actors.forEach(a => { a.y = 0; });
flash = run(flash, { kind: "action", actionId: ids.step, destination: { x: 3, y: 0 } });
flash = answer(flash, "flash"); assert.equal(flash.actors[1].hp, 28);
flash = run(flash, { kind: "move", destination: { x: 1, y: 0 }, maximum: 4 });
assert.equal(flash.lionwing.choices.length, 0, "same target cannot be Flash Struck twice this Round");

let cunning = enable(fresh("vagabond.cunning-fighter", 2), "vagabond.cunning-fighter.2");
cunning = run(cunning, { kind: "action", actionId: ids.study, targetIds: ["enemy"] });
assert.equal(cunning.actors[0].ruleClocks["vagabond.cunning-fighter.plan"].current, 1);
cunning = run(cunning, { kind: "action", actionId: ids.study, targetIds: ["enemy"], useCunningPlan: true });
assert.equal(cunning.actors[0].ruleClocks["vagabond.cunning-fighter.plan"].current, 0, "same target adds no extra segment in this Turn");
cunning = run(cunning, { kind: "clock", id: "vagabond.cunning-fighter.plan", operation: "add", delta: 2 });
const cunningAp = cunning.actors[0].ap;
cunning = run(cunning, { kind: "action", actionId: ids.breathe, useCunningPlan: true });
cunning = run(cunning, { kind: "action", actionId: ids.breathe, useCunningPlan: true });
assert.equal(cunning.actors[0].ap, cunningAp);
denied(cunning, { kind: "action", actionId: ids.spell, targetIds: ["enemy"], useCunningPlan: true });

let swing = enable(fresh("vagabond.enchained", 1), "vagabond.enchained.1");
swing = run(swing, { kind: "action", actionId: ids.spell, targetIds: [], areaCenter: { x: 4, y: 1 } });
assert.equal(Boolean(swing.pendingAction), false);
denied(swing, { kind: "choice", id: swing.lionwing.choices[0].id, choice: "swing", destination: { x: 4, y: 2 } });
swing = answer(swing, "swing", { destination: { x: 7, y: 1 } }); assert.equal(swing.actors[0].x, 7);

let mundane = enable(fresh("bulwark.mundane", 2), "bulwark.mundane.2");
mundane = run(mundane, { kind: "resource", resource: "focus", operation: "gain", amount: 3 });
assert.equal(mundane.actors[0].lionwing.mundaneDiscount, 3);
const tenacity = mundane.actors[0].ruleResources.tenacity.value;
mundane = run(mundane, { kind: "action", actionId: ids.finish, attribute: "body", targetIds: ["enemy"], focusSpent: 1 });
assert.equal(mundane.actors[0].ruleResources.tenacity.value, tenacity, "discount applies to initial AP and additional Focus costs");
mundane = resolve(mundane);

let meals = enable(fresh("altruist.gourmand", 2), "altruist.gourmand.2");
meals.actors.push(actor("ally", "hero", 1, 2, { hp: 10 }));
meals = run(meals, { kind: "action", actionId: ids.step, destination: { x: 0, y: 1 } });
meals = answer(meals, "reinforce"); assert.ok(meals.actors[2].effects.includes("positive.укреплен"));
meals = run(meals, { kind: "effect", targetId: "ally", effect: "positive.укреплен", remove: true });
assert.equal(meals.actors[2].hp, 17, "meal heals 4 + owner's Mind on effect expiry");

let gas = enable(fresh("disruptor.chemist", 3), "disruptor.chemist.3");
gas.objects.push({ id: "obstacle", type: "terrain", space: "main", cells: ["3,1"], hp: 10 }); gas.actors[1].x = 4;
gas = run(gas, { kind: "action", actionId: ids.spell, targetIds: [], obstacleId: "obstacle" });
gas = answer(gas, "gas"); assert.equal(gas.objects.length, 0); assert.equal(gas.areas.length, 1); assert.equal(gas.actors[1].hp, 27);

let trap = enable(fresh("disruptor.hunter", 2), "disruptor.hunter.2"); trap.actors[1].x = 6;
trap = run(trap, { kind: "action", actionId: ids.skirmish, targetIds: [], areaCenter: { x: 4, y: 1 } });
assert.equal(trap.actors[0].ap, 11); trap = answer(trap, "trap");
trap = run(trap, { kind: "move", targetId: "enemy", destination: { x: 2, y: 1 }, maximum: 4 });
assert.equal(trap.actors[1].x, 4, "trap stops the enemy at the crossed cell");
let trapDefended = clone(trap); trapDefended.actors[1].evasion = 20; trapDefended = answer(trapDefended, "trap-attack"); trapDefended = resolve(trapDefended); assert.equal(trapDefended.actors[1].effects.includes("negative.обездвижен"), false, "Evasion negates Steel Jaws' secondary Effect");
trap = answer(trap, "trap-attack"); assert.equal(trap.markers.length, 0); assert.equal(trap.actors[1].effects.includes("negative.обездвижен"), false, "secondary immobilization waits for the Attack");
assert.equal(trap.pendingAction.techniqueRuleId, "disruptor.hunter.1"); trap = resolve(trap); assert.ok(trap.actors[1].effects.includes("negative.обездвижен"));

let creator = enable(fresh("ruiner.creation-ascetic", 3), "ruiner.creation-ascetic.3");
creator = run(creator, { kind: "resource", resource: "material", operation: "gain", amount: 3 }); creator.actors[1].x = 4;
creator = run(creator, { kind: "action", actionId: ids.spell, targetIds: [], creatorRadius: 3 });
assert.equal(creator.actors[0].ruleResources.material.value, 0); assert.equal(creator.pendingAction.restoredPlan.materialCount, 3); assert.equal(creator.objects.length, 0, "Mallet terrain awaits Attack resolution"); creator = resolve(creator);
creator = run(creator, { kind: "action", actionId: ids.finish, attribute: "body", targetIds: [], creatorCells: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }] });
assert.equal(creator.pendingAction.restoredPlan.form, "idol"); assert.equal(creator.pendingAction.restoredPlan.materialCount, 3); creator = resolve(creator);
assert.deepEqual(clone(creator.objects.map(object => object.type)), ["low", "high"], "forms use the shared elevation types");

let lethal = enable(fresh("powerhouse.gunslinger", 1), "powerhouse.gunslinger.1"); lethal.actors[1].hp = 1;
lethal = run(lethal, { kind: "action", actionId: ids.skirmish, bulletsSpent: 2, bulletTargets: ["enemy", "enemy"] });
assert.ok(lethal.actors[1].knockedOut); assert.equal(lethal.actors[0].ruleResources.bullets.value, 4); assert.equal(lethal.pendingAction, undefined, "lethal repeated pre-Skirmish bullets complete without an unavailable defender");
let mixed = enable(fresh("powerhouse.gunslinger", 1), "powerhouse.gunslinger.1"); mixed.actors[1].hp = 1; mixed.actors.push(actor("enemy2", "enemy", 3, 1));
mixed = run(mixed, { kind: "action", actionId: ids.skirmish, bulletsSpent: 2, bulletTargets: ["enemy", "enemy2"] });
assert.deepEqual(clone(mixed.pendingAction.targetIds), ["enemy2"]); mixed = resolve(mixed);
for (const operation of ["bullet-launch", "titanic-push", "pile-arm"]) denied(fresh("powerhouse.gunslinger", 3), { kind: "restored-technique", operation, targetId: "enemy", targetIds: ["enemy"] });

let cutHook = enable(fresh("vagabond.enchained", 1), "vagabond.enchained.1"); cutHook.topology.cuts = [{ id: "cut", space: "main", cells: ["3,1"] }];
denied(cutHook, { kind: "action", actionId: ids.spell, areaCenter: { x: 3, y: 1 }, targetIds: [] });
let cutCreator = enable(fresh("ruiner.creation-ascetic", 1), "ruiner.creation-ascetic.1"); cutCreator = run(cutCreator, { kind: "resource", resource: "material", operation: "gain", amount: 1 }); cutCreator.topology.cuts = clone(cutHook.topology.cuts);
denied(cutCreator, { kind: "action", actionId: ids.spell, creatorLines: [[{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }], [{ x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }]] });

let separateMeal = enable(fresh("altruist.gourmand", 1), "altruist.gourmand.1"); separateMeal.actors.push(actor("ally", "hero", 1, 2, { hp: 10 }));
separateMeal = run(separateMeal, { kind: "effect", targetId: "ally", effect: "positive.укреплен", sourceId: "other-source" });
separateMeal = run(separateMeal, { kind: "restored-technique", operation: "meal", targetId: "ally" }); separateMeal = answer(separateMeal, "reinforce");
const mealSource = separateMeal.actors[2].lionwing.meals[0].sourceId;
separateMeal = run(separateMeal, { kind: "effect", targetId: "ally", effect: "positive.укреплен", remove: true, sourceId: mealSource });
assert.equal(separateMeal.actors[2].hp, 17); assert.ok(separateMeal.actors[2].effects.includes("positive.укреплен"), "other source does not delay the Meal's healing");
separateMeal = run(separateMeal, { kind: "effect", targetId: "ally", effect: "positive.укреплен", remove: true }); assert.equal(separateMeal.actors[2].hp, 17, "the Meal never heals twice");

let passage = clone(gas); passage.spaces[0].height = 1; passage.areas[0].cells = ["2,0", "3,0", "4,0"]; passage.actors[0].y = 0; passage.actors[0].x = 7; passage.actors[1].y = 0; passage.actors[1].x = 0;
passage = run(passage, { kind: "move", targetId: "enemy", destination: { x: 6, y: 0 }, maximum: 6 }); assert.ok(passage.actors[1].effects.includes("negative.ослаблен"), "passing through Gas applies Weakening even when ending outside");
let gasDefense = clone(gas); gasDefense.actors[0].x = 7; gasDefense.actors[1].x = 0; gasDefense.actors.push(actor("ally", "hero", 3, 1));
gasDefense = run(gasDefense, { kind: "attack", targetIds: ["ally"], amount: 2 }, "enemy"); assert.equal(gasDefense.actors[2].evasion, 3); gasDefense = resolve(gasDefense); assert.equal(gasDefense.actors[2].hp, 30); assert.equal(gasDefense.actors[2].evasion, 1);
gasDefense = run(gasDefense, { kind: "attack", targetIds: ["ally"], amount: 0 }, "enemy"); assert.equal(gasDefense.actors[2].evasion, 4, "canonical Evasion is gained, persists until spent or Scene end"); gasDefense = resolve(gasDefense);
gasDefense = run(gasDefense, { kind: "turn-end" }); gasDefense = run(gasDefense, { kind: "turn-start" }, "enemy"); assert.equal(gasDefense.areas.length, 1);
gasDefense = run(gasDefense, { kind: "turn-end" }, "enemy"); gasDefense.actors[0].acted = false; gasDefense = run(gasDefense, { kind: "turn-start" }); assert.equal(gasDefense.areas.length, 0, "Gas expires at its owner's next Turn");

let targetMundane = enable(fresh("bulwark.mundane", 2), "bulwark.mundane.2"); const gritBefore = targetMundane.actors[0].ruleResources.tenacity.value;
targetMundane = run(targetMundane, { kind: "attack", targetIds: ["hero"], amount: 0 }, "enemy"); assert.equal(targetMundane.actors[0].ruleResources.tenacity.value, gritBefore + 1, "Tenacity is gained when targeted, before choosing a Reaction");
targetMundane = run(targetMundane, { kind: "cancel-attack" }); assert.equal(targetMundane.actors[0].ruleResources.tenacity.value, gritBefore + 1);

let resetPlan = enable(fresh("vagabond.cunning-fighter", 2), "vagabond.cunning-fighter.2"); resetPlan = run(resetPlan, { kind: "clock", id: "vagabond.cunning-fighter.plan", operation: "add", delta: 3 }); resetPlan = run(resetPlan, { kind: "scene-reset" }); assert.equal(resetPlan.actors[0].ruleClocks["vagabond.cunning-fighter.plan"].current, 0);
let resetGas = run(clone(gas), { kind: "scene-reset" }); assert.equal(resetGas.areas.length, 0);
let precipitate = enable(fresh("disruptor.chemist", 3), "disruptor.chemist.3"); precipitate = enable(precipitate, "disruptor.chemist.2"); precipitate.actors[1].hp = 3;
precipitate = run(precipitate, { kind: "effect", targetId: "enemy", effect: "negative.ослаблен" }); precipitate = answer(precipitate, "check-health"); assert.ok(precipitate.actors[1].knockedOut); assert.equal(precipitate.areas.length, 1, "Experimental Mixture knockout creates Gas");
let heights = fresh("ruiner.creation-ascetic", 1); heights.actors[1].x = 6; heights.objects = [{ id: "high", type: "high", space: "main", cells: ["2,1"] }];
heights = run(heights, { kind: "action", actionId: ids.step, destination: { x: 2, y: 1 } }); assert.equal(heights.actors[0].stepRemaining, 0); assert.equal(core.effectiveStats(heights, "hero").speed.value, 0, "ascending ends movement and Speed until Turn end");
let upperAttack = fixture(); upperAttack.actors[0].tier = 3; upperAttack.objects = [{ id: "height", type: "high", space: "main", cells: ["1,1"] }]; upperAttack = run(upperAttack, { kind: "action", actionId: ids.spell, targetIds: ["enemy"] }, "hero", () => .1); assert.equal(upperAttack.pendingAction.damage, 0); assert.equal(upperAttack.rollFeed[0].initialCount, 5, "attacks from above add ceil(Tier/2) Advantage");
const legacyBalance = context.normalizeRuleResourceDefinition({ id: "hero" }, { resource: "bullets", current: 6, value: 0, initial: 6 }); assert.equal(legacyBalance.current, 0, "import preserves a depleted balance from historic native saves");
let emptyMaterial = enable(fresh("ruiner.creation-ascetic", 1), "ruiner.creation-ascetic.1"); denied(emptyMaterial, { kind: "action", actionId: ids.finish, attribute: "body", targetIds: ["enemy"], focusSpent: 1 });
let mealPlan = fresh("altruist.gourmand", 1); mealPlan.actors[0].knownTechniques["vagabond.cunning-fighter"] = 1; mealPlan.actors.push(actor("ally", "hero", 1, 2)); mealPlan = enable(mealPlan, "altruist.gourmand.1"); mealPlan = enable(mealPlan, "vagabond.cunning-fighter.1"); mealPlan = run(mealPlan, { kind: "clock", id: "vagabond.cunning-fighter.plan", operation: "add", delta: 1 }); const mealAp = mealPlan.actors[0].ap; mealPlan = run(mealPlan, { kind: "restored-technique", operation: "meal", targetId: "ally", useCunningPlan: true }); assert.equal(mealPlan.actors[0].ap, mealAp); assert.equal(mealPlan.actors[0].ruleClocks["vagabond.cunning-fighter.plan"].current, 0);
console.log("All 12 restored LionWing levels: canonical digests, costs, optional choices, ownership, movement, attack order, forms, immutable preview, version rejection, reload and exact replay passed");
