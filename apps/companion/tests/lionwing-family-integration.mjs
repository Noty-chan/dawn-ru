import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

// This is one deliberately small, saveable scene.  It exercises the public
// family APIs in the order a manual battle uses them; it does not inspect
// source text or invent a browser surface.
const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js", "lionwing-entities.js", "lionwing-dice.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
vm.runInContext(fs.readFileSync(new URL("../lionwing-action-plan.js", import.meta.url), "utf8"), context, { filename: "lionwing-action-plan.js" });

const engine = context.window.DAWN_LIONWING_ENGINE;
const plans = context.window.DAWN_LIONWING_ACTION_PLAN;
const entities = context.window.DAWN_LIONWING_ENTITIES;
assert.ok(engine && plans && entities, "the LionWing family APIs are installed");
const browserMarkup = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const browserDice = browserMarkup.indexOf('src="lionwing-dice.js');
const browserPlan = browserMarkup.indexOf('src="lionwing-action-plan.js');
const browserEntities = browserMarkup.indexOf('src="lionwing-entities.js');
const browserEngine = browserMarkup.indexOf('src="lionwing-engine.js');
assert.ok(browserDice >= 0 && browserDice < browserEngine, "the browser installs dice before the engine captures its adapter");
assert.ok(browserPlan >= 0 && browserPlan < browserEngine && browserEntities < browserEngine, "the browser installs family foundations before the LionWing engine");

const copy = value => JSON.parse(JSON.stringify(value));
const actor = (id, team, x, y, extra = {}) => ({
  id,
  name: id,
  kind: team === "hero" ? "hero" : "enemy",
  heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing",
  team,
  space: "main",
  x,
  y,
  hp: team === "hero" ? 16 : 20,
  maxHp: team === "hero" ? 16 : 20,
  ap: 3,
  baseAp: 3,
  focus: 3,
  influence: 3,
  wounds: 0,
  stress: 0,
  tier: 1,
  speed: 4,
  armor: 0,
  evasion: 0,
  attrs: { body: 4, talent: 3, spirit: 3, mind: 2 },
  effects: [],
  effectStates: {},
  usedActions: [],
  acted: false,
  knockedOut: false,
  lionwing: {},
  ...extra,
});

const fixture = () => ({
  rulesEdition: "lionwing",
  version: 0,
  round: 1,
  turnSerial: 0,
  tension: 0,
  activeActorId: null,
  spaces: [{ id: "main", name: "Площадка", mode: "standard", width: 8, height: 6 }],
  actors: [
    actor("hero", "hero", 1, 1, { hp: 4, wounds: 2 }),
    actor("enemy", "enemy", 3, 1),
    actor("mover", "hero", 1, 0),
  ],
  objects: [],
  walls: [],
  markers: [{ id: "marker-a", kind: "mark", space: "main", x: 0, y: 0, duration: "scene" }],
  areas: [],
  log: [],
  targetIds: [],
  targetCells: [],
  reminders: [],
  rollFeed: [],
  lionwing: { entities: {}, entityReceipts: {} },
});

let serial = 0;
const prepareEvent = (scene, actorId, payload, id, options = {}) => {
  const prepared = engine.prepare(scene, { ...payload, actorId, eventId: id }, options);
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  assert.equal(prepared.events.length, 1);
  return prepared;
};
const commitPrepared = (scene, actorId, payload, id, options = {}) => {
  const prepared = prepareEvent(scene, actorId, payload, id, options);
  return { ...engine.dispatchMany(scene, prepared.events, options), prepared };
};
const run = (scene, actorId, payload, id = `flow:event:${++serial}`, options = {}) => commitPrepared(scene, actorId, payload, id, options).scene;
const findActor = (scene, id) => scene.actors.find(item => item.id === id);

let scene = fixture();

// A marker is a real scene backing for an entity.  The aura and clock below
// use that same marker through their own public source fields.
const markerEntity = entities.create(scene, {
  id: "entity:marker-a",
  kind: "battle-marker",
  ownerActorId: "hero",
  source: { actorId: "hero" },
  rule: "flow.marker",
  backing: { markerId: "marker-a" },
  lifetime: "scene",
  visibility: "public",
  sourceLossPolicy: "disable",
}, { eventId: "flow:entity-create", role: "narrator" });
assert.equal(markerEntity.ok, true);
assert.equal(entities.resolve(scene, "entity:marker-a").exists, false);
scene = markerEntity.scene;
assert.equal(entities.resolve(scene, "entity:marker-a").backing.backing.markerId, "marker-a");

// ActionPlan preparation/confirmation is pure.  Its execution descriptor is
// then handed to the reducer's typed `plan` operation, which performs the
// authoritative payment and state changes.
const actionDraft = plans.open({
  rootActionId: "flow:action",
  definitionId: "flow.manual-attack",
  actionInstanceId: "flow:attack:1",
  source: { id: "enemy", kind: "actor", actorId: "enemy", causeEventId: "flow:prepare" },
  owner: { id: "enemy", kind: "actor", actorId: "enemy" },
  sceneVersion: scene.version,
  targets: [{ targetId: "hero", snapshot: { space: "main", x: 1, y: 1 } }],
  baseValues: { amount: 5, pool: 2, form: "single" },
  costs: [{ kind: "resource", resource: "focus", amount: 1 }],
  phases: {
    before: [],
    replace: [],
    apply: [
      { id: "flow:attack", kind: "attack", targetIds: ["hero"], amount: 5, sourceActorId: "enemy" },
      { id: "flow:second-damage", kind: "damage", targetId: "hero", amount: 5, sourceActorId: "enemy" },
    ],
    after: [],
  },
});
const preparedDraft = plans.prepareExecution(actionDraft);
assert.equal(preparedDraft.payment.paid, false);
assert.equal(preparedDraft.execution.payment.atomic, true);

const roll = engine.createDiceRoll({
  id: "flow:roll",
  kind: "check",
  pool: 2,
  successAt: 4,
  criticalAt: 6,
  explode: false,
  ownerActorId: "enemy",
  rootActionId: "flow:action",
  actionInstanceId: "flow:attack:1",
  causeEventId: "flow:prepare",
}, { random: () => 0.5 });
assert.deepEqual(copy(roll.sourceFaces), [4, 4]);
assert.equal(roll.successes, 2);

// The roll is first committed through the persistent dice operation, then the
// pure plan is confirmed and handed to the reducer below.
scene = run(scene, "enemy", { kind: "dice-create", roll }, "flow:dice-create");
assert.equal(scene.lionwing.diceRolls["flow:roll"].successes, 2);

const previewedPlan = plans.preview(actionDraft);
const committedPlan = plans.commitExecution(previewedPlan.plan, { eventId: "flow:plan-confirm" });
assert.equal(committedPlan.replay, false);
assert.equal(committedPlan.payment.paid, false);
assert.equal(committedPlan.payment.commitRequested, true);
const reloadedPlan = plans.reloadExecution(JSON.stringify(committedPlan.plan));
assert.deepEqual(copy(reloadedPlan.execution.operations.map(operation => operation.kind)), ["attack", "damage"]);

// There is no stateful ActionPlan commit method: the common bridge is the
// reducer's existing reservation plus typed execution operations.  Preserve
// the descriptor's operation order while preparing that one scene event.
const planRun = commitPrepared(scene, "enemy", {
  kind: "plan",
  costs: committedPlan.plan.costs,
  targetIds: committedPlan.plan.targetIds,
  operations: reloadedPlan.execution.operations,
}, "flow:plan-dispatch");
scene = planRun.scene;
assert.equal(findActor(scene, "enemy").focus, 2, "the plan reservation is paid once at the reducer boundary");
assert.equal(scene.lionwing.diceRolls["flow:roll"].successes, 2);
assert.equal(scene.pendingAction.targetIds[0], "hero");
assert.equal(scene.lionwing.afterAttack?.length, 1);

// Attack → Reaction → first damage (a Wound/Resistance decision) → second
// damage from the saved tail.  The second case is intentionally deferred,
// so the save is resumed through the same choice API.
scene = run(scene, "hero", { kind: "reaction", choice: "take" }, "flow:reaction");
scene = run(scene, "enemy", { kind: "resolve-attack" }, "flow:resolve-attack");
assert.equal(findActor(scene, "hero").hp, 16, "the Wound restores Health before the pending Resistance choice");
assert.equal(findActor(scene, "hero").wounds, 2);
assert.equal(scene.lionwing.choices[0].kind, "knockout");
assert.equal(scene.lionwing.deferred.length, 1, "the second damage case waits behind Resistance");

const damageSave = entities.reload(entities.serialize(scene));
const resistanceId = damageSave.lionwing.choices[0].id;
scene = run(damageSave, "hero", { kind: "choice", id: resistanceId, choice: "resist" }, "flow:resistance");
assert.equal(findActor(scene, "hero").hp, 11);
assert.equal(findActor(scene, "hero").wounds, 1);
assert.equal(findActor(scene, "hero").lionwing.vulnerable, true);
assert.equal(scene.lionwing.choices.length, 0);
assert.equal(scene.lionwing.deferred.length, 0);
assert.equal(scene.log.filter(row => row.type === "damage.apply" && row.payload.targetId === "hero").length, 2);

// A sourced Effect remains inspectable by its stable source ID after the
// continuation has completed.
scene = run(scene, "enemy", {
  kind: "effect",
  targetId: "hero",
  effect: "negative.помечен",
  sourceId: "flow:mark-source",
  duration: "scene",
  removable: true,
}, "flow:effect");
const marked = engine.effectInstanceStatus(scene, "hero", "negative.помечен");
assert.equal(marked.present, true);
assert.equal(marked.sources.find(source => source.sourceId === "flow:mark-source").actorId, "enemy");

// A clock is owned by the hero, sourced by the same real marker backing, and
// emits one threshold crossing when it reaches its cap.
scene = run(scene, "hero", {
  kind: "clock",
  operation: "create",
  id: "beacon",
  label: "Маяк",
  size: 2,
  current: 0,
  initial: 0,
  scope: "scene",
  lifetime: "scene",
  sourceEntityId: "marker-a",
  ruleId: "flow.beacon",
}, "flow:clock-create");
scene = run(scene, "hero", { kind: "counter", type: "clock", operation: "add", id: "beacon", delta: 2 }, "flow:clock-fill");
assert.equal(findActor(scene, "hero").ruleClocks.beacon.current, 2);
assert.equal(scene.log.filter(row => row.type === "counter.threshold" && row.payload.counterId === "beacon").length, 1);

// The aura is computed from the marker position.  It is active for the mover
// while the first movement segment remains within radius two.
scene = run(scene, "hero", {
  kind: "aura",
  operation: "create",
  id: "flow:aura",
  ownerActorId: "hero",
  sourceEntityId: "marker-a",
  ruleId: "flow.aura",
  effectId: "positive.укреплен",
  shape: { kind: "radius", distance: 2 },
  filter: { relation: "ally" },
  lifetime: "scene",
  removable: true,
}, "flow:aura-create");
assert.equal(engine.effectInstanceStatus(scene, "mover", "positive.укреплен").present, true);

const movement = prepareEvent(scene, "hero", {
  kind: "geometry-move",
  targetId: "mover",
  destination: { space: "main", x: 3, y: 0 },
  maximum: 2,
  segmentChoices: [{ id: "flow:move-boundary", segmentIndex: 0, title: "Граница движения", options: ["continue", "stop"] }],
}, "flow:geometry");
const paused = engine.dispatchMany(scene, movement.events);
scene = paused.scene;
assert.deepEqual([findActor(scene, "mover").x, findActor(scene, "mover").y], [2, 0]);
assert.equal(scene.lionwing.choices[0].kind, "geometry-boundary");
assert.equal(engine.effectInstanceStatus(scene, "mover", "positive.укреплен").present, true);
assert.equal(scene.lionwing.geometryCursor.segmentIndex, 1);

// Save at the segment boundary, resume once, and verify that repeating the
// exact response is an idempotent receipt lookup rather than another move.
const pausedReload = entities.reload(entities.serialize(scene));
assert.deepEqual(copy(pausedReload.lionwing.geometryCursor), copy(scene.lionwing.geometryCursor));
const continueId = pausedReload.lionwing.choices[0].id;
const continued = commitPrepared(pausedReload, "hero", {
  kind: "choice",
  id: continueId,
  choice: "continue",
}, "flow:geometry-continue");
scene = continued.scene;
assert.deepEqual([findActor(scene, "mover").x, findActor(scene, "mover").y], [3, 0]);
assert.equal(scene.lionwing.choices.length, 0);
assert.equal(scene.lionwing.deferred.length, 0);
assert.equal(engine.effectInstanceStatus(scene, "mover", "positive.укреплен").present, false);
const movementReplay = engine.dispatchMany(scene, continued.prepared.events);
assert.deepEqual(movementReplay.scene, scene, "replaying the saved segment response cannot move twice");

// Final JSON reload keeps all family state together before exercising the
// entity API's explicit undo/replay pair.
scene = entities.reload(entities.serialize(scene));
assert.equal(scene.lionwing.diceRolls["flow:roll"].successes, 2);
assert.equal(findActor(scene, "hero").ruleClocks.beacon.current, 2);
assert.equal(engine.effectInstanceStatus(scene, "hero", "negative.помечен").present, true);
assert.equal(entities.resolve(scene, "entity:marker-a").backing.backing.markerId, "marker-a");

const undone = entities.undo(scene, markerEntity.event);
assert.equal(entities.resolve(undone.scene, "entity:marker-a").exists, false);
const replayedEntity = entities.replay(undone.scene, markerEntity.event, { role: "narrator" });
assert.equal(replayedEntity.replayed, false);
assert.equal(entities.resolve(replayedEntity.scene, "entity:marker-a").backing.backing.markerId, "marker-a");

console.log("LionWing family integration: ActionPlan preparation, persistent roll, Attack/Reaction, two damage cases with Resistance continuation, sourced Effect, threshold clock, aura/segmented movement, JSON reload and entity undo/replay passed");
