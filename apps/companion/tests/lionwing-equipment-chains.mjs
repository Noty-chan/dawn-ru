import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
const Engine = loadSceneEngine(context), data = context.DAWN_DATA;
const action = name => data.actions.list.find(item => item.name === name);
const scene = {
  version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: "hero",
  spaces: [{ id: "main", width: 7, height: 7 }], objects: [], markers: [], log: [], rollFeed: [],
  actors: [
    { id: "hero", kind: "hero", name: "Герой", team: "hero", space: "main", x: 1, y: 1, ap: 3, baseAp: 3, focus: 2, hp: 10, maxHp: 10, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], usedActions: [], acted: false, techniques: { "vagabond.master-at-arms": 1, "disruptor.siren": 2 } },
    { id: "enemy", kind: "enemy", name: "Враг", team: "enemy", profileId: "enemy.common.assassin", space: "main", x: 4, y: 1, ap: 2, baseAp: 2, focus: 0, hp: 10, maxHp: 10, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 1, mind: 1 }, effects: [], usedActions: [], acted: false },
  ],
};

const contract = Engine.ruleModeContract(scene, "hero", { groupId: "vagabond.master-at-arms.armament", modeId: "blade" });
assert.equal(contract.sourceRuleId, "vagabond.master-at-arms.1");
assert.equal(contract.modifiers.swift, true);
assert.equal(contract.postOperations[0].type, "effect");
assert.deepEqual(Array.from(Engine.ruleModeContract(scene, "hero", { groupId: contract.groupId, modeId: "polearm" }).postOperations.filter(item => item.type === "effect"), item => item.effect), ["negative.подброшен"], "Polearm applies only the canonical Launch effect");
assert.deepEqual(Array.from(Engine.ruleModeContract(scene, "hero", { groupId: contract.groupId, modeId: "chain" }).postOperations, item => item.effect), ["negative.разорван"], "Chain applies only the canonical Rupture effect");
const bladeReady = structuredClone(scene);
bladeReady.actors[1].x = 3;
let blade = Engine.masterAtArmsStatus(bladeReady, "hero", { modeId: "blade", targetIds: ["enemy"], destination: { x: 2, y: 1 } });
assert.equal(blade.available, true, "Blade accepts exact two-cell origin and one-cell movement before target selection");
assert.equal(Engine.masterAtArmsStatus(bladeReady, "hero", { modeId: "blade", targetIds: ["enemy"], destination: { x: 1, y: 2 } }).available, false, "Blade rejects a destination that cannot create the required adjacent target");
const polearmReady = structuredClone(scene);
polearmReady.actors.push({ ...structuredClone(polearmReady.actors[1]), id: "enemy-2", name: "Враг 2", x: 1, y: 2 });
polearmReady.actors[1].x = 2;
let polearm = Engine.masterAtArmsStatus(polearmReady, "hero", { modeId: "polearm", targetIds: ["enemy", "enemy-2"] });
assert.equal(polearm.available, true, "Polearm accepts exactly two adjacent enemies");
assert.equal(Engine.masterAtArmsStatus(polearmReady, "hero", { modeId: "polearm", targetIds: ["enemy"] }).available, false, "Polearm rejects a single target");
const chainReady = structuredClone(scene);
chainReady.actors[1].x = 5;
let chain = Engine.masterAtArmsStatus(chainReady, "hero", { modeId: "chain", targetIds: ["enemy"] });
assert.equal(chain.available, true, "Chain accepts exactly one target at range four");
chainReady.actors[1].x = 4;
assert.equal(Engine.masterAtArmsStatus(chainReady, "hero", { modeId: "chain", targetIds: ["enemy"] }).available, false, "Chain rejects a forged range");
const modeScene = Engine.dispatchMany(scene, [{ type: "rule-mode.set", actorId: "hero", payload: { groupId: contract.groupId, modeId: "blade", ruleId: contract.sourceRuleId } }]).scene;
assert.equal(Engine.serializeRuleModeState(modeScene.actors[0], contract.groupId).sourceDigest, contract.sourceDigest);
assert.equal(Engine.ruleModeStatus(modeScene, "hero", { groupId: contract.groupId, modeId: "blade" }).available, false, "An armament receipt is once per Turn");
const nextTurn = Engine.dispatchMany(modeScene, [{ type: "turn.start", actorId: "hero", payload: {} }], { narratorOverride: true }).scene;
assert.equal(Engine.ruleModeStatus(nextTurn, "hero", { groupId: contract.groupId, modeId: "blade" }).available, true, "A new Turn gets a fresh armament receipt");

const studyScene = structuredClone(scene);
studyScene.actors[0].techniques = { "disruptor.siren": 1 };
const prepared = Engine.prepareAction(studyScene, data, { actorId: "hero", actionId: action("Изучение").id, targetIds: ["enemy"] });
assert.equal(prepared.ok, true);
let flow = Engine.dispatchMany(studyScene, prepared.events).scene;
assert.equal(flow.pendingPrompt?.kind, "siren-study-frighten");
const beforeFocus = flow.actors[0].focus;
flow = Engine.dispatchMany(flow, Engine.respondRulePrompt(flow, data, { choice: "frighten" }).events).scene;
assert.equal(flow.actors[0].focus, beforeFocus - 1, "Siren I spends one Focus when accepted");

let siren = structuredClone(scene);
siren = Engine.dispatchMany(siren, [{ type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.испуган", sourceActionId: "test" } }]).scene;
assert.equal(siren.pendingPrompt?.kind, "siren-irresistible");
siren = Engine.dispatchMany(siren, Engine.respondRulePrompt(siren, data, { choice: "rush" }).events).scene;
siren = Engine.dispatchMany(siren, Engine.preparePromptPlacement(siren, { destination: { x: 2, y: 1 } }).events).scene;
assert.equal(siren.pendingPrompt?.kind, "siren-irresistible-stun");
const focusBeforeDaze = siren.actors[0].focus;
siren = Engine.dispatchMany(siren, Engine.respondRulePrompt(siren, data, { choice: "stun" }).events).scene;
assert.equal(siren.actors[0].focus, focusBeforeDaze + 1, "Siren II grants Focus only with accepted Daze");

const masterBase = structuredClone(scene);
masterBase.actors[0].techniques = { "vagabond.master-at-arms": 3 };
masterBase.actors[0].ruleModes = { [contract.groupId]: { modeId: "chain", sourceDigest: contract.sourceDigest } };
masterBase.actors[1].x = 1; masterBase.actors[1].y = 2;
const talentFinisher = action("Завершение");
const chainFinisher = Engine.prepareAction(masterBase, data, { actorId: "hero", actionId: talentFinisher.id, attribute: "talent", targetIds: ["enemy"], armamentAnchor: { x: 1, y: 2 }, roll: { attribute: "talent", rolls: [6, 5, 2], successes: 2, crits: 1 } });
assert.equal(chainFinisher.ok, true, "Master III Chain reads the equipped mode from authoritative actor state");
assert.deepEqual(Array.from(chainFinisher.events.find(event => event.type === "attack.pending").payload.masterFinisher.targetCells).sort(), ["0,1", "0,2", "0,3", "1,1", "1,2", "1,3", "2,1", "2,2", "2,3"].sort(), "Chain expands a 1×1 center to 3×3 from one verified Critical");
assert.deepEqual(Array.from(chainFinisher.events.find(event => event.type === "attack.pending").payload.targetIds), ["enemy"], "Master III derives targets from its checked area");
const chainEvents = structuredClone(chainFinisher.events);
const committedChain = Engine.dispatchMany(masterBase, chainEvents);
assert.equal(committedChain.scene.pendingAction?.techniqueRuleId, "vagabond.master-at-arms.3", "Master III survives dispatch as a pending verified attack");
const forgedChain = structuredClone(chainFinisher.events);
for (const event of forgedChain) if (event.type === "attack.pending") event.payload.masterFinisher.targetCells = ["6,6"];
assert.throws(() => Engine.dispatchMany(masterBase, forgedChain), /Геометрия Мастера|Цели Мастера/, "Dispatch rejects forged Master III cells");
const forgedMasterSource = structuredClone(masterBase);
forgedMasterSource.actors[0].ruleModes[contract.groupId].sourceDigest = "stale-master-source";
assert.throws(() => Engine.dispatchMany(forgedMasterSource, chainEvents), /Источник Мастера/, "Dispatch rejects a stale equipped Armament source");
const poleMaster = structuredClone(masterBase);
poleMaster.actors[0].ruleModes[contract.groupId].modeId = "polearm";
poleMaster.actors[1].x = 1; poleMaster.actors[1].y = 2; poleMaster.actors[1].effects = ["negative.подброшен"]; poleMaster.actors[0].tier = 2;
const poleFinisher = Engine.prepareAction(poleMaster, data, { actorId: "hero", actionId: talentFinisher.id, attribute: "talent", armamentAnchor: { x: 1, y: 2 }, attackModifierIds: ["core.launch-spike:enemy"], roll: { attribute: "talent", rolls: [6, 5], successes: 2, crits: 0 } });
assert.equal(poleFinisher.ok, true, "Master III Polearm accepts a checked two-cell line");
assert.equal(poleFinisher.events.find(event => event.type === "attack.pending").payload.masterFinisher.advantage, 2, "Polearm grants Tier Advantage only for a verified Spike");
const polePending = Engine.dispatchMany(poleMaster, poleFinisher.events).scene;
const poleResolved = Engine.resolvePendingAction(polePending, data);
assert.equal(poleResolved.ok, true, "Master III Polearm resolves after a successful Spike with no Criticals");
const poleFinished = Engine.dispatchMany(polePending, poleResolved.events).scene;
assert.ok(poleFinished.objects.some(object => object.type === "difficult" && object.ruleId === "vagabond.master-at-arms.3"), "A successful Spike creates Difficult Terrain even with zero Criticals");
const bladeMaster = structuredClone(masterBase);
bladeMaster.actors[0].ruleModes[contract.groupId].modeId = "blade";
bladeMaster.actors[1].x = 2; bladeMaster.actors[1].y = 1;
const bladeFinisher = Engine.prepareAction(bladeMaster, data, { actorId: "hero", actionId: talentFinisher.id, attribute: "talent", armamentDestination: { x: 3, y: 1 }, roll: { attribute: "talent", rolls: [6, 5], successes: 2, crits: 0 } });
assert.equal(bladeFinisher.ok, true, "Master III Blade accepts an optional two-cell path");
assert.deepEqual(Array.from(bladeFinisher.events.find(event => event.type === "attack.pending").payload.targetIds), ["enemy"], "Blade derives a crossed target from the segment path");
const forgedDiagonal = structuredClone(bladeFinisher.events);
for (const event of forgedDiagonal) if (event.type === "attack.pending") event.payload.masterFinisher.path = ["2,2", "3,1"];
assert.throws(() => Engine.dispatchMany(bladeMaster, forgedDiagonal), /Путь перемещения|Геометрия Мастера/, "Dispatch rejects a diagonal Blade path that is not a legal grid step");
const forgedMode = structuredClone(masterBase); forgedMode.actors[0].ruleModes[contract.groupId].modeId = "polearm";
assert.equal(Engine.prepareAction(forgedMode, data, { actorId: "hero", actionId: talentFinisher.id, attribute: "body", targetIds: ["enemy"], armamentAnchor: { x: 1, y: 2 }, roll: { attribute: "body", rolls: [6], successes: 1, crits: 0 } }).ok, true, "A non-Talent Finisher remains independent of Master III");
assert.equal(Engine.prepareAction(masterBase, data, { actorId: "hero", actionId: talentFinisher.id, attribute: "talent", armamentMode: "blade", armamentAnchor: { x: 1, y: 1 }, roll: { attribute: "talent", rolls: [6], successes: 1, crits: 0 } }).ok, false, "A client cannot replace authoritative Master III Armament");

console.log("LionWing equipment and action chains passed");
