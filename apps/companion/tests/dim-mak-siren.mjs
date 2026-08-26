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
const actionNamed = name => data.actions.list.find(action => action.name === name);
const baseScene = techniques => ({
  version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: "hero",
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [
    { id: "hero", kind: "hero", name: "Герой", team: "hero", space: "main", x: 1, y: 1, ap: 3, baseAp: 3, focus: 5, hp: 10, maxHp: 10, speed: 4, armor: 0, evasion: 0, attrs: { body: 2, talent: 3, spirit: 2, mind: 4 }, effects: [], usedActions: [], acted: false, techniques },
    { id: "enemy", kind: "enemy", name: "Враг", team: "enemy", space: "main", x: 3, y: 1, ap: 2, baseAp: 2, focus: 0, hp: 10, maxHp: 10, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 1, mind: 1 }, effects: [], usedActions: [], acted: false },
  ],
  objects: [], markers: [], log: [], rollFeed: [],
});

let dimMak = baseScene({ "vagabond.dim-mak": 2 });
const study = Engine.prepareAction(dimMak, data, { actorId: "hero", actionId: actionNamed("Изучение").id, targetIds: ["enemy"] });
assert.equal(study.ok, true);
dimMak = Engine.dispatchMany(dimMak, study.events).scene;
assert.equal(dimMak.pendingPrompt?.kind, "dim-mak-weak-point");
dimMak = Engine.dispatchMany(dimMak, Engine.respondRulePrompt(dimMak, data, { choice: "place" }).events).scene;
assert.equal(dimMak.pendingPrompt?.kind, "dim-mak-weak-point-cell");
const placement = Engine.preparePromptPlacement(dimMak, { destination: { x: 3, y: 2 } });
assert.equal(placement.ok, true);
dimMak = Engine.dispatchMany(dimMak, placement.events).scene;
assert.equal(dimMak.markers[0]?.metadata?.carrierActorId, "enemy");

dimMak = Engine.dispatchMany(dimMak, [{ type: "actor.move", actorId: "enemy", payload: { space: "main", x: 4, y: 1, path: ["4,1"] } }]).scene;
assert.deepEqual([dimMak.markers[0].x, dimMak.markers[0].y], [4, 2], "Слабая точка следует за носителем");
dimMak = Engine.dispatchMany(dimMak, [{ type: "actor.move", actorId: "hero", payload: { space: "main", x: 4, y: 2, path: ["2,1", "2,2", "3,2", "4,2"] } }]).scene;
const modifierId = Engine.attackModifierStatus(dimMak, "hero", ["enemy"], [], { actionName: "Стычка" }).options.find(option => option.ruleId === "vagabond.dim-mak.1")?.id;
assert.ok(modifierId);
const attack = Engine.prepareAction(dimMak, data, { actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], attackModifierIds: [modifierId], roll: { formula: "4D6", rolls: [6, 5, 3, 2], successes: 2, crits: 1 } });
assert.equal(attack.ok, true);
assert.equal(attack.events.find(event => event.type === "action.prepare").payload.quick, true);
assert.equal(attack.events.find(event => event.type === "attack.pending").payload.attribute, "mind");
assert.equal(attack.events.some(event => event.type === "resource.spend"), false);
dimMak = Engine.dispatchMany(dimMak, attack.events).scene;
assert.equal(dimMak.markers.length, 0);
assert.equal(dimMak.actors[0].evasion, 2);

let bladeDimMak = baseScene({ "vagabond.dim-mak": 1, "vagabond.master-at-arms": 1 });
bladeDimMak.actors[0].x = 1; bladeDimMak.actors[0].y = 1;
bladeDimMak.actors[1].x = 3; bladeDimMak.actors[1].y = 1;
bladeDimMak.markers = [{ id: "blade-weak-point", space: "main", x: 2, y: 1, kind: "mark", label: "Слабая точка", ruleId: "vagabond.dim-mak.1", ownerActorId: "hero", metadata: { carrierActorId: "enemy", offset: { dx: -1, dy: 0 } } }];
const bladeModifier = Engine.attackModifierStatus(bladeDimMak, "hero", ["enemy"], [], { actionName: "Стычка", origin: { x: 2, y: 1 } }).options.find(option => option.ruleId === "vagabond.dim-mak.1")?.id;
assert.ok(bladeModifier, "Слабая точка доступна после подготовленного перемещения Клинка");
const bladeAttack = Engine.prepareAction(bladeDimMak, data, { actorId: "hero", actionId: actionNamed("Стычка").id, targetIds: ["enemy"], armamentMode: "blade", armamentDestination: { x: 2, y: 1 }, attackModifierIds: [bladeModifier], attribute: "mind", roll: { formula: "4D6 · Разум", attribute: "mind", rolls: [6, 5, 3, 2], successes: 2, crits: 1 } });
assert.equal(bladeAttack.ok, true);
assert.equal(bladeAttack.events.find(event => event.type === "attack.pending").payload.attribute, "mind", "Дим Мак имеет приоритет над обычным атрибутом Клинка");
assert.ok(bladeAttack.events.find(event => event.type === "action.prepare").payload.attackModifierIds.includes(bladeModifier));
assert.equal(bladeAttack.events.some(event => event.type === "resource.spend"), false, "Клинок со Слабой точкой остаётся Быстрым");

let miss = baseScene({ "vagabond.dim-mak": 2 });
miss.actors[0].evasion = 3;
miss.activeActorId = "enemy";
miss = Engine.dispatchMany(miss, [
  { id: "dim-mak-miss-pending", type: "attack.pending", actorId: "enemy", payload: { actionId: "enemy.attack", name: "Атака", targetIds: ["hero"], damage: 1 } },
  { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 1, attackMiss: true, attackPendingId: "dim-mak-miss-pending" } },
]).scene;
assert.equal(miss.pendingPrompt?.kind, "dim-mak-field-investigation");
const investigation = Engine.respondRulePrompt(miss, data, { choice: "study" });
assert.equal(investigation.ok, true);
miss = Engine.dispatchMany(miss, investigation.events).scene;
assert.ok(miss.log.some(event => event.type === "action.prepare" && event.payload?.quickReaction && event.payload?.name === "Полевое исследование"));
const zeroButHit = baseScene({ "vagabond.dim-mak": 2 });
zeroButHit.activeActorId = "enemy";
const zeroButHitResolved = Engine.dispatchMany(zeroButHit, [{ id: "zero-hit", type: "attack.pending", actorId: "enemy", payload: { actionId: "enemy.attack", name: "Атака", targetIds: ["hero"], damage: 0 } }, { type: "damage.apply", actorId: "enemy", payload: { targetId: "hero", amount: 0, attackMiss: false, attackPendingId: "zero-hit" } }]).scene;
assert.notEqual(zeroButHitResolved.pendingPrompt?.kind, "dim-mak-field-investigation", "Zero damage without authoritative miss provenance is not enough to forge Field Investigation");

let siren = baseScene({ "disruptor.siren": 2 });
siren = Engine.dispatchMany(siren, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.испуган" } }]).scene;
assert.equal(siren.pendingPrompt?.kind, "siren-irresistible");
siren = Engine.dispatchMany(siren, Engine.respondRulePrompt(siren, data, { choice: "rush" }).events).scene;
const sirenPlacement = Engine.preparePromptPlacement(siren, { destination: { x: 2, y: 1 } });
assert.equal(sirenPlacement.ok, true);
siren = Engine.dispatchMany(siren, sirenPlacement.events).scene;
assert.equal(siren.pendingPrompt?.kind, "siren-irresistible-stun");
assert.equal(siren.actors[1].effects.includes("negative.ошеломлен"), false);
siren = Engine.dispatchMany(siren, Engine.respondRulePrompt(siren, data, { choice: "stun" }).events).scene;
assert.equal(siren.actors[1].effects.includes("negative.ошеломлен"), true);

console.log("Dim Mak and Siren QA passed");
