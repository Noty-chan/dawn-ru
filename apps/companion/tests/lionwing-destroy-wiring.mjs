import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const copy = value => JSON.parse(JSON.stringify(value));
const planContext = { window: {}, console };
vm.createContext(planContext);
vm.runInContext(read("lionwing-entities.js"), planContext, { filename: "lionwing-entities.js" });
vm.runInContext(read("lionwing-destroy-plan.js"), planContext, { filename: "lionwing-destroy-plan.js" });
const Plans = planContext.window.DAWN_LIONWING_DESTROY_PLAN;

const coreSource = read("app-core.js");
const validatorStart = coreSource.indexOf("function validateTableEdit");
const validatorEnd = coreSource.indexOf("const TABLE_BACKUP_FORMAT", validatorStart);
const validatorContext = {};
vm.createContext(validatorContext);
vm.runInContext(`${coreSource.slice(validatorStart, validatorEnd)}\nthis.validateTableEdit=validateTableEdit;`, validatorContext, { filename: "validateTableEdit.js" });
const validateTableEdit = validatorContext.validateTableEdit;

const actor = (id, extra = {}) => ({
  id,
  kind: "hero",
  rulesEdition: "lionwing",
  team: "hero",
  name: id,
  space: "main",
  x: 0,
  y: 0,
  hp: 10,
  maxHp: 10,
  ap: 3,
  baseAp: 3,
  focus: 2,
  effects: [],
  effectStates: {},
  ruleResources: {},
  ruleClocks: {},
  knockedOut: false,
  hidden: false,
  ...extra,
});

const baseScene = () => ({
  rulesEdition: "lionwing",
  version: 4,
  activeSpace: "main",
  spaces: [
    { id: "main", name: "Главное поле", mode: "standard", width: 7, height: 7 },
    { id: "side", name: "Вторая площадка", mode: "standard", width: 7, height: 7 },
  ],
  actors: [
    actor("owner", { x: 1, y: 1 }),
    actor("target", { x: 2, y: 2 }),
    actor("unrelated", { x: 3, y: 3 }),
  ],
  markers: [],
  objects: [],
  areas: [],
  walls: [],
  topology: { cuts: [] },
  targetIds: ["owner", "target", "unrelated"],
  selectedActor: "owner",
  activeActorId: "owner",
  pendingAction: { id: "pending-owner-target", actorId: "owner", targetId: "target", targetIds: ["target"] },
  pendingActionPlan: { id: "pending-unrelated", actorId: "unrelated", context: { targetIds: ["unrelated"] } },
  pendingPrompt: { id: "prompt-owner-target", sourceActorId: "owner", targetId: "target" },
  lionwing: {
    entities: {},
    entityReceipts: {},
    auras: [],
    subscriptions: [],
    choices: [{ id: "choice-owner", actorId: "owner" }, { id: "choice-unrelated", actorId: "unrelated" }],
    deferred: [],
    pausedChains: [],
    afterAttack: [],
    executionCursor: null,
  },
  log: [],
  undo: [],
  redo: [],
});

const scene = baseScene();
const plan = Plans.prepare(scene, { kind: "actor", id: "owner" }, { role: "narrator", expectedVersion: 4, eventId: "destroy-owner-wiring" });
const before = copy(scene);
const applied = Plans.apply(scene, plan, {
  role: "narrator",
  eventId: "destroy-owner-wiring",
  expectedVersion: 4,
  validateTableEdit,
  plannedDestroy: true,
  recordHistory: false,
  advanceVersion: false,
});
assert.equal(applied.ok, true, "the real app-core validator accepts an explicitly planned deletion");
assert.equal(applied.scene.actors.some(item => item.id === "owner"), false, "the planned owner is removed");
assert.equal(applied.scene.pendingAction, null, "pending action owned by the deleted actor is invalidated");
assert.equal(applied.scene.pendingPrompt, null, "pending prompt owned by the deleted actor is invalidated");
assert.ok(applied.scene.pendingActionPlan, "an unrelated pending action survives");
assert.deepEqual(copy(applied.scene.lionwing.choices.map(item => item.id)), ["choice-unrelated"], "the deleted owner's choice is invalidated while an unrelated choice survives");
assert.deepEqual(copy(applied.scene.targetIds), ["target", "unrelated"], "the deleted owner is removed from selections while target and unrelated actors survive");
assert.equal(applied.scene.undo.length, 0, "plan apply does not write history when commitScene owns history");
assert.equal(applied.scene.version, before.version, "plan apply does not advance version when commitScene owns versioning");
assert.equal(Object.prototype.hasOwnProperty.call(applied.scene, "before"), false, "the transient before snapshot is not placed in Scene");
const serializedPlan = Plans.serialize(plan);
assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(serializedPlan), "before"), false, "plan serialization omits the transient before snapshot");
assert.equal(Object.prototype.hasOwnProperty.call(Plans.reload(serializedPlan), "before"), false, "reloaded plans keep the transient snapshot out of transport data");

const commitSource = read("scene-ui.js");
const commitStart = commitSource.indexOf("function commitScene(");
const commitEnd = commitSource.indexOf("\nfunction lionwingDestroyDescription", commitStart);
const commitContext = {
  initialScene: copy(before),
  Sync: { state: () => ({}) },
  validateTableEdit,
  normalizeScene: value => value,
  uid: (() => { let counter = 0; return () => `history-${++counter}`; })(),
  toast: () => null,
  sceneEvent: () => {},
  syncHeroFromScene: () => {},
  persist: () => {},
  renderPlay: () => {},
  renderScene: () => {},
  queueNetworkV2Snapshot: () => null,
  store: { mode: "tools" },
};
vm.createContext(commitContext);
vm.runInContext(`let Scene=this.initialScene;function sceneSnapshot(){return JSON.parse(JSON.stringify(Scene));}\n${commitSource.slice(commitStart, commitEnd)}\nthis.getScene=()=>Scene;this.commitScene=commitScene;`, commitContext, { filename: "commitScene.js" });
let committedApply;
const committed = commitContext.commitScene("Убран участник через commitScene", liveScene => {
  committedApply = Plans.apply(liveScene, plan, {
    role: "narrator",
    eventId: "destroy-owner-wiring",
    expectedVersion: 4,
    validateTableEdit,
    plannedDestroy: true,
    recordHistory: false,
    advanceVersion: false,
  });
  for (const key of Object.keys(liveScene)) delete liveScene[key];
  Object.assign(liveScene, committedApply.scene);
}, { plannedDestroy: plan, plannedDestroyReceiptKey: "destroy-owner-wiring" });
assert.ok(committed?.scene, "the production commitScene path completes");
const committedScene = commitContext.getScene();
assert.equal(committedApply.scene.version, before.version, "the plan leaves version ownership with commitScene");
assert.equal(committedScene.version, before.version + 1, "commitScene advances version exactly once");
assert.equal(committedScene.undo.length, 1, "commitScene writes exactly one undo entry");
assert.equal(committedScene.undo[0].label, "Убран участник через commitScene");
assert.equal(committedScene.lionwing.destroyPlanReceipts["destroy-owner-wiring"].version, before.version + 1, "commitScene updates the receipt to its single committed version");

const staleScene = copy(before);
staleScene.version = 5;
const staleBefore = copy(staleScene);
assert.throws(() => Plans.apply(staleScene, plan, { role: "narrator", eventId: "destroy-owner-wiring", validateTableEdit, plannedDestroy: true }), error => error.code === "stale-plan", "a changed version rejects the prepared plan");
assert.deepEqual(staleScene, staleBefore, "a stale plan leaves the current scene unchanged");
const missing = Plans.prepare(before, { kind: "actor", id: "missing" }, { role: "narrator", expectedVersion: 4 });
assert.equal(missing.exists, false, "missing participant is a no-op plan");
assert.deepEqual(copy(Plans.cancel(plan, before).scene), before, "cancel leaves the original scene untouched");

const sideScene = baseScene();
sideScene.actors.push(actor("side-actor", { space: "side", x: 6, y: 6, team: "enemy" }));
const movedPlan = Plans.prepare(sideScene, { kind: "space", id: "side" }, {
  role: "narrator",
  expectedVersion: 4,
  placeActorsSafely(input, moving) {
    const next = copy(input);
    next.actors = next.actors.map(item => moving.some(candidate => candidate.id === item.id) ? { ...item, space: "main", x: 5, y: 4 } : item);
    return { scene: next, reserves: [] };
  },
});
assert.deepEqual(copy(movedPlan.transfers.find(item => item.actorId === "side-actor").to), { space: "main", x: 5, y: 4 }, "preview transfers use the scene returned by the placement primitive");

const adapterPlan = Plans.prepare(sideScene, { kind: "space", id: "side" }, { role: "narrator", expectedVersion: 4 });
assert.throws(() => Plans.apply(sideScene, adapterPlan, { role: "narrator", eventId: "remove-side", removeManagedSceneSpace: () => ({ scene: copy(sideScene) }), recordHistory: false, advanceVersion: false }), error => error.code === "space-remove-postcondition", "a handled adapter must prove that the space disappeared");

const placementSource = read("app-scene-events.js");
const placementStart = placementSource.indexOf("function placeActorsSafely");
const placementEnd = placementSource.indexOf("\nfunction removeManagedSceneSpace", placementStart);
const placementContext = { clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)), uid: () => "large-reserve", SceneEngine: { removedCellKeys: () => new Set() } };
vm.createContext(placementContext);
vm.runInContext(`${placementSource.slice(placementStart, placementEnd)}\nthis.placeActorsSafely=placeActorsSafely;`, placementContext, { filename: "placeActorsSafely.js" });
const largeScene = {
  spaces: [{ id: "main", width: 2, height: 2, mode: "standard" }, { id: "side", width: 2, height: 2, mode: "standard" }],
  actors: [actor("fixed", { space: "main", x: 0, y: 0, occupiedWidth: 2, occupiedHeight: 2 }), actor("large", { space: "side", x: 0, y: 0, occupiedWidth: 2, occupiedHeight: 2 })],
  objects: [],
  topology: { cuts: [] },
};
placementContext.placeActorsSafely(largeScene, [largeScene.actors[1]], largeScene.spaces[0], "Резерв большого участника");
const large = largeScene.actors.find(item => item.id === "large");
assert.equal(large.space, "large-reserve", "a full field moves a large body to an explicit reserve");
assert.ok(largeScene.spaces.find(item => item.id === "large-reserve").width >= 2, "the reserve is wide enough for the body footprint");
assert.deepEqual([large.x, large.y], [0, 0], "the large body receives a deterministic reserve placement");

for (const selector of ["data-scene-remove-actor", "scene-remove-npcs", "data-crowd-remove-defeated", "data-crowd-remove-group", "data-manage-space-remove", "data-lw-entity-destroy", "data-scene-remove-object", "data-scene-remove-marker", "data-scene-remove-wall"]) {
  assert.match(placementSource, new RegExp(selector.replace(/[\[\]-]/g, "\\$&")), `the LionWing capture wiring includes ${selector}`);
}
assert.match(placementSource, /sceneTool===\"erase\"[^\n]+commitLionwingDestroy/, "board erase routes LionWing removals through the plan");

console.log("LionWing destroy wiring: production validator, commitScene single writer, stale/cancel/adapter guards, returned-scene transfers, and large-body placement passed");
