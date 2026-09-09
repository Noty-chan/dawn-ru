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

console.log("LionWing equipment and action chains passed");
