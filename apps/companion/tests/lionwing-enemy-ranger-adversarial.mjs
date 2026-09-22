import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { sceneEngineFiles } from "./load-scene-engine.mjs";

const copy = value => JSON.parse(JSON.stringify(value));
const root = new URL("../", import.meta.url);

function loadEngine(mutations = {}) {
  const context = { window: {}, console };
  vm.createContext(context);
  for (const file of ["data.js", "edition-lionwing.js", "lionwing-table-data.js", "logic.js"]) {
    vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), context, { filename: file });
  }
  for (const file of sceneEngineFiles) {
    let source = fs.readFileSync(new URL(file, root), "utf8");
    if (mutations[file]) source = mutations[file](source);
    vm.runInContext(source, context, { filename: file });
  }
  return { engine: context.window.DAWN_SCENE_ENGINE, data: context.window.DAWN_DATA, lionwing: context.window.DAWN_LIONWING_DATA };
}

function loadPersistence(appMutation = source => source) {
  const context = {
    console, window: {}, APP_SCHEMA: 14, contentPreferences: { edition: "lionwing" },
    uid: () => "persistence-id", clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
    cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [],
    safeColor: (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback,
    safeImage: value => typeof value === "string" ? value : "", safeTokenImage: value => typeof value === "string" ? value : "",
    normalizeGmLibrary: value => value && typeof value === "object" ? copy(value) : {}, restoreLocalHeroMedia: value => value,
    store: { gmLibrary: null }, validateTableEdit: () => {}, structuredClone: undefined,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("lionwing-entities.js", root), "utf8"), context, { filename: "lionwing-entities.js" });
  const appSource = appMutation(fs.readFileSync(new URL("app-core.js", root), "utf8"));
  const normalizerStart = appSource.indexOf("function blankScene()");
  const normalizerEnd = appSource.indexOf("function validateTableEdit");
  vm.runInContext(`${appSource.slice(normalizerStart, normalizerEnd)}\nthis.sceneCore=sceneCore;this.normalizeScene=normalizeScene;`, context, { filename: "app-core.normalizer.js" });
  const tableStart = appSource.indexOf("const TABLE_BACKUP_FORMAT");
  const tableEnd = appSource.indexOf("function cleanArray", tableStart);
  vm.runInContext(`${appSource.slice(tableStart, tableEnd)}\nthis.tableBackupPayload=tableBackupPayload;this.normalizedTableBackup=normalizedTableBackup;`, context, { filename: "app-core.backup.js" });
  return {
    normalize: value => vm.runInContext(`normalizeScene(${JSON.stringify(value)})`, context),
    roundTripBackup: value => vm.runInContext(`normalizedTableBackup(tableBackupPayload(${JSON.stringify(value)})).scene`, context),
  };
}

const { engine, data, lionwing } = loadEngine();
const actor = (id, team, x, y, extra = {}) => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x, y, hp: 30, maxHp: 30, ap: 3, baseAp: 3,
  focus: 3, influence: 0, wounds: 0, stress: 0, tier: 2, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {}, usedActions: [],
  acted: false, knockedOut: false, hidden: false, knownTechniques: {}, techniques: {}, lionwing: {}, ...extra,
});
const scene = (extra = {}) => ({
  schema: 14, rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "ranger",
  tension: 0, spaces: [{ id: "main", name: "Main", width: 9, height: 7 }],
  actors: [actor("ranger", "enemy", 1, 2, { profileId: "lionwing.npc.ranger" }), actor("hero", "hero", 5, 2)],
  objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] }, targetIds: [], targetCells: [],
  reminders: [], rollFeed: [], log: [], triggerQueue: [], undo: [], redo: [], turnUndo: [],
  lionwing: { entities: {}, entityReceipts: {} }, ...extra,
});
const dice = values => ({ formula: `${values.length}D6`, rolls: values, successes: values.filter(value => value >= 4).length, crits: values.filter(value => value === 6).length });
let sequence = 0;
const commit = (current, prepared, label = "event") => {
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  const events = prepared.events.map((event, index) => ({ ...event, id: `${label}:${++sequence}:${index}` }));
  return { events, result: engine.dispatchMany(current, events, { expectedVersion: Number(current.version || 0) }) };
};
const passAndResolve = (current, label = "attack") => {
  const response = engine.respondReaction(current, data, { actorId: current.pendingAction.targetIds[0], choice: "pass" });
  const answered = response.ok ? commit(current, response, `${label}:pass`).result.scene : current;
  const resolved = engine.resolvePendingAction(answered, data);
  return commit(answered, resolved, `${label}:resolve`).result.scene;
};
const ranger = current => current.actors.find(item => item.id === "ranger");
const rule = (current, id) => engine.availableEnemyRules(current, data, "ranger").find(item => item.id === id);
const expectKnownFailure = (name, body) => {
  let failed = false;
  try { body(); } catch (error) { if (error instanceof assert.AssertionError) failed = true; else throw error; }
  assert.equal(failed, true, `KNOWN FAILING REPRODUCER unexpectedly passed: ${name}`);
  console.log(`KNOWN FAILING REPRODUCER: ${name}`);
};

// Source binding: the test reads the shipped LionWing data rather than copying a
// legacy Ranger profile into the fixture.
const canonical = lionwing.coreRules.npcs.list.find(item => item.id === "lionwing.npc.ranger");
assert.equal(canonical.source.pdfPage, 115);
assert.equal(canonical.passive, "After this NPC is Attacked, it may move 1 space.");
assert.match(canonical.actions.find(item => item.id.endsWith(".nest")).text, /moves on its Turn/);
assert.match(canonical.ace.text, /next time this NPC's Attack hits them/);

// Nest uses the real adapter and dispatcher. It pays once, applies Steady, and
// persists Aim through a plain JSON reload for an allied Ranger as well.
let current = scene({ activeActorId: "ranger", actors: [
  actor("ranger", "hero", 1, 2, { kind: "hero", heroId: null, profileId: "lionwing.npc.ranger" }),
  actor("hero", "enemy", 5, 2),
] });
const nest = engine.prepareEnemyRule(current, data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.nest" });
assert.equal(nest.events.filter(event => event.type === "resource.spend").length, 1);
assert.equal(nest.events.filter(event => event.type === "actor.state" && event.payload.key === "enemyAim").length, 1);
current = commit(current, nest, "nest").result.scene;
assert.equal(ranger(current).ap, 2);
assert.ok(ranger(current).effects.includes("positive.устойчив"));
assert.equal(ranger(JSON.parse(JSON.stringify(current))).ruleState.enemyAim, 1);

// An off-turn retreat, forced move, or allied movement must not consume Aim.
// Baseline currently loses it because the trigger has no active-Turn guard.
const offTurn = { ...copy(current), activeActorId: "hero" };
const offTurnMoved = engine.dispatchMany(offTurn, [{ id: "off-turn-move", type: "actor.move", actorId: "ranger", payload: { space: "main", x: 2, y: 2, movement: "Ranger passive" } }]).scene;
expectKnownFailure("Aim survives movement outside the Ranger's Turn", () => assert.equal(ranger(offTurnMoved).ruleState.enemyAim, 1));
const ownTurnMoved = engine.dispatchMany({ ...copy(current), activeActorId: "ranger" }, [{ id: "own-turn-move", type: "actor.move", actorId: "ranger", payload: { space: "main", x: 2, y: 2, movement: "Step" } }]).scene;
assert.equal(ranger(ownTurnMoved).ruleState.enemyAim, 0);

// Aim must add one damage to a successful LionWing Attack. The canonical family
// omits the aimDamage flag that exists only on the legacy Ranger adapter.
let aimMiss = scene({ actors: [actor("ranger", "enemy", 1, 2, { profileId: "lionwing.npc.ranger", ruleState: { enemyAim: 1 } }), actor("hero", "hero", 2, 2)] });
const aimedShot = engine.prepareEnemyRule(aimMiss, data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.take-the-shot", targetIds: ["hero"], roll: dice([6,1,1,1,1,1]) });
assert.equal(aimedShot.ok, true, aimedShot.errors?.join(" "));
expectKnownFailure("LionWing Aim adds 1 damage to a successful Attack", () => assert.equal(aimedShot.events.find(event => event.type === "attack.pending").payload.damageByTarget.hero, 2));

// Headshot stores exactly the selected target, costs AP (not Tension), survives
// reload/export-shaped JSON, rejects missing targets, and is replay-idempotent.
let headshotScene = scene({ tension: 2 });
const headshot = engine.prepareEnemyRule(headshotScene, data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.headshot", targetIds: ["hero"] });
assert.equal(headshot.events.filter(event => event.type === "actor.state" && event.payload.key === "rangerHeadshotTargetId").length, 1);
const headshotCommit = commit(headshotScene, headshot, "headshot");
headshotScene = headshotCommit.result.scene;
assert.equal(ranger(headshotScene).ap, 1);
assert.equal(headshotScene.tension, 2);
assert.equal(ranger(headshotScene).ruleState.rangerHeadshotTargetId, "hero");
const persistence = loadPersistence();
const reloadedHeadshot = persistence.normalize(JSON.parse(JSON.stringify(headshotScene)));
const importedHeadshot = persistence.roundTripBackup(headshotScene);
assert.equal(ranger(reloadedHeadshot).ruleState.rangerHeadshotTargetId, "hero");
assert.equal(ranger(importedHeadshot).ruleState.rangerHeadshotTargetId, "hero");
const replayed = engine.dispatchMany(headshotScene, headshotCommit.events);
assert.deepEqual(copy(replayed.scene), copy(headshotScene));
assert.equal(replayed.events.length, 0);
assert.throws(() => engine.dispatch(headshotScene, { id: "missing-target-state", type: "actor.state", actorId: "ranger", payload: { key: "rangerHeadshotTargetId", value: "missing", sourceActionId: "lionwing.npc.ranger.headshot" } }), /цель|не перенесено/i);

// The bonus must not manufacture the qualifying hit. Two Hits against 3 Evasion
// miss before Headshot; baseline adds the two bonus damage before defense.
headshotScene.actors.find(item => item.id === "hero").evasion = 3;
const headshotMiss = engine.prepareEnemyRule(headshotScene, data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.take-the-shot", targetIds: ["hero"], roll: dice([6,5,1,1,1,1]) });
expectKnownFailure("Headshot bonus cannot turn its own miss into a hit", () => assert.equal(headshotMiss.events.find(event => event.type === "attack.pending").payload.damageByTarget.hero, 2));

// The Passive is keyed to being Attacked, not damage. Evasion reducing damage to
// zero still yields the post-Attack movement prompt after attack.clear.
let attacked = scene({ actors: [actor("attacker", "hero", 2, 2), actor("ranger", "enemy", 3, 2, { profileId: "lionwing.npc.ranger", evasion: 99 })], activeActorId: "attacker" });
attacked = engine.dispatchMany(attacked, [{ id: "incoming", type: "attack.pending", actorId: "attacker", payload: { actionId: "test.attack", name: "Test", targetIds: ["ranger"], damage: 1, damageByTarget: { ranger: 1 } } }]).scene;
attacked = passAndResolve(attacked, "incoming");
assert.equal(attacked.actors.find(item => item.id === "ranger").hp, 30);
assert.equal(attacked.pendingPrompt?.kind, "enemy-ranger-retreat");

// One area Attack can Attack multiple Rangers. The implementation uses find(),
// so only the first passive owner receives a choice.
let twoRangers = scene({ activeActorId: "attacker", actors: [
  actor("attacker", "hero", 1, 1),
  actor("ranger", "enemy", 2, 1, { profileId: "lionwing.npc.ranger" }),
  actor("ranger-2", "enemy", 2, 2, { profileId: "lionwing.npc.ranger" }),
] });
twoRangers = engine.dispatchMany(twoRangers, [{ id: "area", type: "attack.pending", actorId: "attacker", payload: { actionId: "test.area", name: "Area", targetIds: ["ranger", "ranger-2"], damage: 1, damageByTarget: { ranger: 1, "ranger-2": 1 } } }]).scene;
twoRangers = passAndResolve(twoRangers, "area");
expectKnownFailure("each Ranger Attacked by one area Attack receives its Passive choice", () => assert.deepEqual(new Set([twoRangers.pendingPrompt?.actorId, ...(twoRangers.triggerQueue || []).filter(item => item.type === "rule.prompt").map(item => item.actorId)]), new Set(["ranger", "ranger-2"])));

// A Ranger part of a Compound remains a Ranger rules consumer even when the
// compound target is canonicalized to a different representative part.
let compound = scene({ activeActorId: "attacker", actors: [
  actor("attacker", "hero", 1, 1),
  actor("bruiser-part", "enemy", 3, 1, { profileId: "lionwing.npc.bruiser", compoundId: "boss" }),
  actor("ranger", "enemy", 3, 1, { profileId: "lionwing.npc.ranger", compoundId: "boss" }),
] });
compound = engine.dispatchMany(compound, [{ id: "compound-attack", type: "attack.pending", actorId: "attacker", payload: { actionId: "test.attack", name: "Test", targetIds: ["ranger"], damage: 1, damageByTarget: { ranger: 1 } } }]).scene;
compound = passAndResolve(compound, "compound");
expectKnownFailure("a Ranger Compound part receives its Passive when the Compound is Attacked", () => assert.equal(compound.pendingPrompt?.actorId, "ranger"));

// KO and vanished-target boundaries: KO actors cannot act; a vanished Headshot
// target currently leaves a dangling state reference through JSON persistence.
const ko = scene(); ko.actors[0].knockedOut = true;
assert.equal(engine.prepareEnemyRule(ko, data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.nest" }).ok, false);
const vanished = copy(headshotScene); vanished.actors = vanished.actors.filter(item => item.id !== "hero");
expectKnownFailure("removing the designated Headshot target clears the dangling target id", () => assert.equal(ranger(JSON.parse(JSON.stringify(vanished))).ruleState.rangerHeadshotTargetId, null));

// Authoritative version and event identity boundaries.
assert.throws(() => engine.dispatchMany(scene({ version: 1 }), [{ id: "stale", type: "actor.state", actorId: "ranger", payload: { key: "enemyAim", value: 1 } }], { expectedVersion: 0 }), /Конфликт версии|ожидалась|устар/i);

// Isolated in-memory mutation pack. No mutated source is written to checkout.
const mutations = [
  ["writer omission", { "scene-actions.js": source => source.replace('events.push({ type: "actor.state", actorId: actor.id, payload: { key: "enemyAim", value: 1, sourceActionId: rule.id } });', '') }, mutated => {
    const prepared = mutated.engine.prepareEnemyRule(scene(), mutated.data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.nest" });
    assert.equal(prepared.events.filter(event => event.type === "actor.state" && event.payload.key === "enemyAim").length, 1);
  }],
  ["writer duplication", { "scene-actions.js": source => source.replace('if (fullRule?.type === "ranger-headshot") events.push({ type: "actor.state", actorId: actor.id, payload: { key: "rangerHeadshotTargetId", value: targetIds[0], sourceActionId: rule.id } });', 'if (fullRule?.type === "ranger-headshot") { events.push({ type: "actor.state", actorId: actor.id, payload: { key: "rangerHeadshotTargetId", value: targetIds[0], sourceActionId: rule.id } }); events.push({ type: "actor.state", actorId: actor.id, payload: { key: "rangerHeadshotTargetId", value: targetIds[0], sourceActionId: rule.id } }); }') }, mutated => {
    const prepared = mutated.engine.prepareEnemyRule(scene({ tension: 2 }), mutated.data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.headshot", targetIds: ["hero"] });
    assert.equal(prepared.events.filter(event => event.type === "actor.state" && event.payload.key === "rangerHeadshotTargetId").length, 1);
  }],
  ["targetId loss", { "scene-actions.js": source => source.replace('value: targetIds[0], sourceActionId: rule.id', 'value: null, sourceActionId: rule.id') }, mutated => {
    const prepared = mutated.engine.prepareEnemyRule(scene({ tension: 2 }), mutated.data, { actorId: "ranger", ruleId: "lionwing.npc.ranger.headshot", targetIds: ["hero"] });
    assert.equal(prepared.events.find(event => event.type === "actor.state" && event.payload.key === "rangerHeadshotTargetId").payload.value, "hero");
  }],
];
for (const [name, sourceMutations, probe] of mutations) {
  let caught = false;
  try { probe(loadEngine(sourceMutations)); } catch (error) { if (error instanceof assert.AssertionError) caught = true; else throw error; }
  assert.equal(caught, true, `mutation survived: ${name}`);
  console.log(`MUTATION CAUGHT: ${name}`);
}

console.log("LionWing Ranger adversarial audit passed; six known failing reproducers are explicitly quarantined from npm test.");
