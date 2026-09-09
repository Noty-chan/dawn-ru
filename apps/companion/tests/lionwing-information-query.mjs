import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date, structuredClone };
context.globalThis = context;
context.window = context;
for (const file of ["data.js", "edition-lionwing.js", "edition-lionwing-ru.js", "logic.js"]) {
  vm.runInNewContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);

const Engine = context.DAWN_LIONWING_ENGINE;
const Info = context.DAWN_LIONWING_INFORMATION_QUERY;
const Adapters = context.DAWN_LIONWING_ADAPTERS;
const ids = context.DAWN_SCENE_ENGINE.ACTION_IDS;
let serial = 0;

const hero = (id = "hero", x = 1, y = 1) => ({
  id,
  name: id === "hero" ? "Изучающий" : "Другой игрок",
  kind: "hero",
  heroId: id,
  ownerId: id === "hero" ? "player-one" : "player-two",
  rulesEdition: "lionwing",
  team: "hero",
  space: "main",
  x,
  y,
  hp: 12,
  maxHp: 12,
  ap: 8,
  baseAp: 8,
  focus: 4,
  influence: 2,
  wounds: 0,
  stress: 0,
  tier: 1,
  speed: 4,
  armor: 0,
  evasion: 0,
  attrs: { body: 4, talent: 3, spirit: 2, mind: 2 },
  effects: [],
  effectStates: {},
  usedActions: [],
  acted: false,
  knockedOut: false,
  techniques: {
    "powerhouse.predator": 2,
    "vagabond.cunning-fighter": 3,
    "bulwark.absolute-bastard": 1,
    "altruist.battle-instructor": 1,
    "vagabond.dim-mak": 3,
  },
  knownTechniques: {
    "powerhouse.predator": 2,
    "vagabond.cunning-fighter": 3,
    "bulwark.absolute-bastard": 1,
    "altruist.battle-instructor": 1,
    "vagabond.dim-mak": 3,
  },
  lionwing: {
    automation: {
      "powerhouse.predator.1": true,
      "powerhouse.predator.2": true,
      "vagabond.cunning-fighter.1": true,
      "vagabond.cunning-fighter.3": true,
      "bulwark.absolute-bastard.1": true,
      "altruist.battle-instructor.1": true,
      "vagabond.dim-mak.1": false,
      "vagabond.dim-mak.2": false,
    },
  },
});

const enemy = (id, x, y) => ({
  id,
  name: id,
  kind: "enemy",
  rulesEdition: "lionwing",
  team: "enemy",
  space: "main",
  x,
  y,
  hp: 7,
  maxHp: 20,
  ap: 2,
  baseAp: 2,
  focus: 0,
  wounds: 0,
  stress: 0,
  tier: 1,
  speed: 3,
  armor: 2,
  evasion: 1,
  attrs: { body: 2, talent: 2, spirit: 1, mind: 1 },
  effects: [],
  effectStates: {},
  usedActions: [],
  acted: false,
  knockedOut: false,
});

const base = () => ({
  rulesEdition: "lionwing",
  version: 0,
  round: 1,
  turnSerial: 0,
  activeActorId: null,
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [hero(), enemy("enemy-one", 3, 1), enemy("enemy-two", 1, 3)],
  objects: [],
  walls: [],
  markers: [],
  topology: { cuts: [] },
  log: [],
  rollFeed: [],
  lionwing: { sceneSerial: 1, chapterSerial: 1 },
});

const actor = (scene, id) => scene.actors.find(item => item.id === id);
const dispatch = (scene, actorId, payload, options = {}) => {
  const eventId = payload.eventId || `information-test-${++serial}`;
  const event = { ...Engine.command(actorId, payload), id: eventId };
  return Engine.dispatchMany(scene, [event], options);
};
const run = (scene, actorId, payload, options = {}) => dispatch(scene, actorId, payload, options).scene;
const prepare = (scene, actorId, payload, options = {}) => {
  const eventId = payload.eventId || `information-action-${++serial}`;
  const prepared = Engine.prepare(scene, { actorId, ...payload, eventId }, { random: () => 0.6 });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return { ...Engine.dispatchMany(scene, prepared.events, options), prepared };
};
const resultCode = result => result?.code || result?.errors?.[0] || "";

let scene = base();
const initialInfo = Info.ensureState(scene);
assert.equal(initialInfo.studies.length, 0);
assert.equal(Info.recordStudy(scene, {
  actorId: "hero",
  targetId: "enemy-one",
  actionInstanceId: "forged-study",
  marked: true,
  clientApproved: true,
}).ok, false, "arbitrary client flags cannot prove Study");
assert.equal(Info.recordStudy(scene, {
  actorId: "hero",
  targetId: "enemy-one",
  actionInstanceId: "forged-study",
  actionEventId: "forged-event",
}).code, "STUDY_RECEIPT_REQUIRED");
assert.equal(Info.ensureState(scene).studies.length, 0);

const oldScene = base();
oldScene.rulesEdition = "ru-v0.9";
oldScene.log = [{ id: "old-study", type: "action.resolve", actorId: "hero", payload: { actionId: ids.study, actionInstanceId: "old-study", targetIds: ["enemy-one"] } }];
actor(oldScene, "hero").lionwing.history = [{ actionId: ids.study, actionInstanceId: "old-study", targetIds: ["enemy-one"] }];
assert.equal(Info.recordStudy(oldScene, { actorId: "hero", targetId: "enemy-one", actionInstanceId: "old-study" }).code, "OLD_EDITION_ISOLATION");

scene = run(scene, "hero", { kind: "turn-start", eventId: "information-turn-1" });
assert.equal(scene.activeActorId, "hero");
const firstStatus = Engine.actionStatus(scene, actor(scene, "hero"), Engine.actionDef(ids.study), { targetIds: ["enemy-one"] });
assert.equal(firstStatus.available, true);
assert.equal(firstStatus.cost, 0, "Predator I reduces the first Study cost to zero");
assert.equal(firstStatus.swift, true);
assert.equal(firstStatus.actionQuote.range, 4);
assert.equal(JSON.stringify(firstStatus.actionQuote.informationCategories), JSON.stringify(["health"]));
assert.equal(Info.followupStatus(scene, "hero").available, true);

const firstAction = prepare(scene, "hero", { kind: "action", actionId: ids.study, targetIds: ["enemy-one"], eventId: "study-action-1" });
scene = firstAction.scene;
const firstStudyId = "information:study:study-action-1";
const firstStudy = Info.studyStatus(scene, firstStudyId);
assert.ok(firstStudy);
assert.equal(firstStudy.status, "pending");
assert.equal(firstStudy.actionInstanceId, "study-action-1");
assert.equal(firstStudy.actionEventId, "study-action-1:0");
assert.equal(firstStudy.targetId, "enemy-one");
assert.equal(firstStudy.turnSerial, 1);
assert.equal(firstStudy.sceneSerial, 1);
assert.equal(Info.studiedThisTurn(scene, "hero", "enemy-one"), true);
assert.equal(Info.studyCount(scene, { actorId: "hero", scope: "turn" }), 1);
assert.equal(Info.studyCount(scene, { actorId: "hero", targetId: "enemy-two", scope: "turn" }), 0);
assert.equal(Info.markedTarget(scene, "hero", "enemy-one"), true);
assert.equal(Info.markedTargetStatus(scene, "hero", "enemy-one").source, "effect");
assert.equal(Info.followupStatus(scene, "hero").available, false, "Cunning Fighter III is no longer first after a Study");

const duplicateStudy = Info.recordStudy(scene, { actorId: "hero", targetId: "enemy-one", actionInstanceId: "study-action-1", actionEventId: "study-action-1:0" });
assert.equal(duplicateStudy.ok, true);
assert.equal(duplicateStudy.duplicate, true);
const duplicateDelivery = Engine.dispatchMany(scene, firstAction.prepared.events);
assert.equal(duplicateDelivery.events.length, 0, "re-delivering an action receipt is idempotent");
assert.equal(duplicateDelivery.scene.version, scene.version);
assert.equal(Info.studyCount(scene, { actorId: "hero", scope: "scene" }), 1);

const forgedTarget = Info.recordStudy(scene, { actorId: "hero", targetId: "enemy-two", actionInstanceId: "study-action-1", actionEventId: "study-action-1:0" });
assert.equal(forgedTarget.ok, false);
assert.equal(resultCode(forgedTarget), "STUDY_RECEIPT_REQUIRED");
assert.equal(Info.studyCount(scene, { actorId: "hero", scope: "scene" }), 1);

const firstReveal = Info.confirmReveal(scene, { studyId: firstStudyId, category: "health" }, { role: "narrator" });
assert.equal(firstReveal.ok, true, firstReveal.errors?.join(" "));
assert.equal(JSON.stringify(firstReveal.fact.value), JSON.stringify({ current: 7, maximum: 20 }));
assert.equal(firstReveal.study.status, "resolved");
assert.equal(Info.knownHealth(scene, "hero", "enemy-one", { role: "player", actorId: "hero" }).current, 7);
assert.equal(Info.knownHealthAtMost(scene, "hero", "enemy-one", { role: "player", actorId: "hero" }), true);
assert.equal(Info.revealedFact(scene, firstStudyId, "health", { role: "player", actorId: "hero" }).id, firstReveal.fact.id);
assert.equal(Info.revealedFact(scene, firstStudyId, "health", { role: "player", actorId: "other" }).id, firstReveal.fact.id);

const replayedReveal = Info.replay(scene, firstReveal.event);
assert.equal(replayedReveal.ok, true);
assert.equal(replayedReveal.idempotent, true);
const undoneReveal = Info.undo(scene, firstReveal.event);
assert.equal(undoneReveal.ok, true);
assert.equal(Info.studyStatus(undoneReveal.scene, firstStudyId).status, "pending");
assert.equal(Info.revealedFact(undoneReveal.scene, firstStudyId, "health", { role: "narrator" }), null);
const replayedFromUndo = Info.replay(undoneReveal.scene, firstReveal.event);
assert.equal(replayedFromUndo.ok, true);
assert.equal(replayedFromUndo.idempotent, false);
assert.equal(Info.studyStatus(replayedFromUndo.scene, firstStudyId).status, "resolved");

const reloaded = Info.reload(Info.serialize(scene));
assert.equal(JSON.stringify(Info.project(reloaded, { role: "player", actorId: "hero" })), JSON.stringify(Info.project(scene, { role: "player", actorId: "hero" })));

const secondAction = prepare(scene, "hero", { kind: "action", actionId: ids.study, targetIds: ["enemy-two"], eventId: "study-action-2" });
scene = secondAction.scene;
const secondStudyId = "information:study:study-action-2";
assert.equal(Info.studyCount(scene, { actorId: "hero", scope: "turn" }), 2);
assert.equal(Info.studyCount(scene, { actorId: "hero", targetId: "enemy-two", scope: "turn" }), 1);
assert.equal(Info.firstStudy(scene, { actorId: "hero", targetId: "enemy-two", scope: "scene" }).id, secondStudyId);
assert.equal(Info.availableCategories(scene, secondStudyId).length, 7);
assert.equal(Info.confirmReveal(scene, { studyId: secondStudyId, category: "defense", value: { armor: 2, evasion: 1 }, visibility: "player" }, { role: "player", actorId: "hero" }).code, "INFORMATION_AUTHORITY_REQUIRED");
const privateReveal = Info.confirmReveal(scene, { studyId: secondStudyId, category: "defense", value: { armor: 2, evasion: 1 }, visibility: "player", ownerPlayerId: "player-one" }, { role: "gm" });
assert.equal(privateReveal.ok, true, privateReveal.errors?.join(" "));
assert.ok(Info.revealedFact(scene, secondStudyId, "defense", { role: "player", actorId: "hero" }));
assert.ok(Info.revealedFact(scene, secondStudyId, "defense", { role: "player", playerId: "player-one", actorId: "other" }));
assert.equal(Info.revealedFact(scene, secondStudyId, "defense", { role: "player", actorId: "other" }), null);
assert.equal(Info.revealedFact(scene, secondStudyId, "defense", { role: "narrator" }).value.armor, 2);

const thirdAction = prepare(scene, "hero", { kind: "action", actionId: ids.study, targetIds: ["enemy-one"], eventId: "study-action-3" });
scene = thirdAction.scene;
const thirdStudyId = "information:study:study-action-3";
const blocked = Info.confirmReveal(scene, { studyId: thirdStudyId, category: "mystery" }, { role: "narrator" });
assert.equal(blocked.code, "INFORMATION_RULE_BLOCKED");
assert.equal(Info.studyStatus(scene, thirdStudyId).status, "blocked");
assert.equal(Info.state(scene).warnings.some(item => item.studyId === thirdStudyId && item.code === "UNKNOWN_CATEGORY"), true);
const overridden = Info.confirmReveal(scene, { studyId: thirdStudyId, category: "mystery", value: "Нарраторское наблюдение", label: "Особая деталь", override: true, visibility: "narrator" }, { role: "narrator" });
assert.equal(overridden.ok, true, overridden.errors?.join(" "));
assert.equal(overridden.fact.category, "custom");
assert.equal(Info.revealedFact(scene, thirdStudyId, "custom", { role: "player", actorId: "hero" }), null);
assert.equal(Info.revealedFact(scene, thirdStudyId, "custom", { role: "narrator" }).value, "Нарраторское наблюдение");

const fourthAction = prepare(scene, "hero", { kind: "action", actionId: ids.study, targetIds: ["enemy-two"], eventId: "study-action-4" });
scene = fourthAction.scene;
const fourthStudyId = "information:study:study-action-4";
const cancelled = Info.cancelReveal(scene, { studyId: fourthStudyId }, { actorId: "hero" });
assert.equal(cancelled.ok, true);
assert.equal(Info.studyStatus(scene, fourthStudyId).status, "cancelled");
assert.equal(Info.state(scene).pending.includes(fourthStudyId), false);
assert.equal(Info.studyCount(scene, { actorId: "hero", targetId: "enemy-two", scope: "scene" }), 1, "cancelled Studies are excluded from counts");

const fifthAction = prepare(scene, "hero", { kind: "action", actionId: ids.study, targetIds: ["enemy-one"], eventId: "study-action-5" });
scene = fifthAction.scene;
const fifthStudyId = "information:study:study-action-5";
actor(scene, "enemy-one").knockedOut = true;
const koReveal = Info.confirmReveal(scene, { studyId: fifthStudyId, category: "health" }, { role: "narrator" });
assert.equal(koReveal.code, "STUDY_TARGET_UNAVAILABLE");
assert.equal(Info.studyStatus(scene, fifthStudyId).status, "blocked");
assert.equal(Info.state(scene).warnings.some(item => item.studyId === fifthStudyId && item.code === "TARGET_UNAVAILABLE"), true);
actor(scene, "enemy-one").knockedOut = false;
const routedReveal = dispatch(scene, null, { kind: "information-reveal", studyId: fifthStudyId, category: "health", eventId: "narrator-reveal-5" }, { role: "narrator" });
scene = routedReveal.scene;
assert.ok(routedReveal.events.some(event => event.type === "information.reveal"));
assert.equal(Info.studyStatus(scene, fifthStudyId).status, "resolved");

const removedAction = prepare(scene, "hero", { kind: "action", actionId: ids.study, targetIds: ["enemy-two"], eventId: "study-action-6" });
scene = removedAction.scene;
const removedStudyId = "information:study:study-action-6";
actor(scene, "enemy-two").removed = true;
const removedReveal = Info.confirmReveal(scene, { studyId: removedStudyId, category: "health" }, { role: "narrator" });
assert.equal(removedReveal.code, "STUDY_TARGET_UNAVAILABLE");
assert.equal(Info.studyStatus(scene, removedStudyId).status, "blocked");
actor(scene, "enemy-two").removed = false;
const routedCancel = dispatch(scene, null, { kind: "information-cancel", studyId: removedStudyId, eventId: "narrator-cancel-6" }, { role: "narrator" });
scene = routedCancel.scene;
assert.ok(routedCancel.events.some(event => event.type === "information.cancel"));
assert.equal(Info.studyStatus(scene, removedStudyId).status, "cancelled");

const pendingAction = prepare(scene, "hero", { kind: "action", actionId: ids.study, targetIds: ["enemy-two"], eventId: "study-action-7" });
scene = pendingAction.scene;
const pendingStudyId = "information:study:study-action-7";

const handout = Info.handout(scene, { handoutId: "manual-defense", targetId: "enemy-two", actorId: "hero", category: "defense", value: "Уязвим к холоду", visibility: "player" }, { role: "narrator" });
assert.equal(handout.ok, true);
assert.equal(Info.handout(scene, { handoutId: "forged-handout", value: "нет" }, { role: "player" }).code, "INFORMATION_AUTHORITY_REQUIRED");
assert.equal(Info.facts(scene, { targetId: "enemy-two" }, { role: "player", actorId: "hero" }).some(item => item.id === "manual-defense"), true);
assert.equal(Info.facts(scene, { targetId: "enemy-two" }, { role: "player", actorId: "other" }).some(item => item.id === "manual-defense"), false);

const playerProjection = Info.project(scene, { role: "player", actorId: "hero", playerId: "player-one" });
assert.equal(playerProjection.pending.length, 0);
assert.equal(playerProjection.receiptCount, undefined);
assert.equal(playerProjection.facts.some(item => "fingerprint" in item || "sourceDigest" in item || "actionInstanceId" in item), false);
assert.equal(JSON.stringify(playerProjection).includes("journal"), false);
const narratorProjection = Info.project(scene, { role: "narrator" });
assert.ok(narratorProjection.pending.some(item => item.studyId === pendingStudyId));
assert.ok(narratorProjection.warnings.some(item => item.studyId === fifthStudyId));

const hidden = JSON.parse(JSON.stringify(scene));
actor(hidden, "enemy-two").hidden = true;
assert.equal(Info.project(hidden, { role: "player", actorId: "hero" }).facts.some(item => item.targetId === "enemy-two"), false);
assert.equal(Info.facts(hidden, { targetId: "enemy-two" }, { role: "player", actorId: "hero" }).length, 0);
assert.equal(Info.project(hidden, { role: "narrator" }).facts.some(item => item.targetId === "enemy-two"), true);

const panel = Info.panel(scene, { role: "player", actorId: "hero", playerId: "player-one" });
assert.match(panel, /Изучение и сведения/);
assert.doesNotMatch(panel, /actionInstanceId|fingerprint|sourceDigest/);
const narratorPanel = Info.panel(scene, { role: "narrator" });
assert.match(narratorPanel, /Ожидает выбора Нарратора/);
assert.match(narratorPanel, /data-information-reveal/);
assert.match(narratorPanel, /data-information-cancel/);

const canonicalTechniques = Object.values(context.DAWN_LIONWING_DATA.archetypes).flatMap(item => item.techniques);
for (const [id, evidence] of Object.entries(Info.evidence)) {
  const technique = canonicalTechniques.find(item => item.id === id.slice(0, id.lastIndexOf(".")));
  const level = Number(id.slice(id.lastIndexOf(".") + 1));
  const ruTechnique = context.DAWN_LIONWING_RU.archetypes[technique.archetypeId].techniques[technique.id];
  assert.equal(evidence.en, technique.levels.find(item => item.n === level).text, `${id} EN evidence must match canonical JSON`);
  assert.equal(evidence.ru, ruTechnique.levels[String(level)].text, `${id} RU overlay evidence must match reviewed overlay`);
  assert.equal(typeof evidence.sourceDigest, "string");
  assert.ok(evidence.semanticDiff.length > 0);
}
assert.ok(Info.adapters.every(rule => rule.coverage === "partial" && rule.sourceDigest));
assert.ok(Adapters.list(actor(scene, "hero")).some(rule => rule.id === "powerhouse.predator.1"));
assert.ok(Adapters.actionModifiers(actor(scene, "hero")).some(rule => rule.id === "vagabond.cunning-fighter.3"));
assert.equal(Info.actionQuote(actor(scene, "hero"), { scene, actionId: ids.study }).ok, true);

const publicProjection = context.DAWN_SCENE_ENGINE.projectScene(scene, { role: "player", actorIds: ["hero"] });
assert.equal(publicProjection.lionwing.information.receiptCount, undefined);
assert.equal(publicProjection.lionwing.information.facts.some(item => "fingerprint" in item), false);
assert.equal(publicProjection.lionwing.information.pending.length, 0);
assert.ok(Info.state(scene).journal.every(event => event.before?.journal?.length === 0 && event.after?.journal?.length === 0), "information journal snapshots must not recursively contain the journal");

console.log("LionWing information-query: authoritative Study receipts, scoped facts, private projections, Narrator choices, replay/undo, adapters and UI passed");
