import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(read("lionwing-entities.js"), context, { filename: "lionwing-entities.js" });
vm.runInContext(read("lionwing-destroy-plan.js"), context, { filename: "lionwing-destroy-plan.js" });
const Entities = context.window.DAWN_LIONWING_ENTITIES;
const Plans = context.window.DAWN_LIONWING_DESTROY_PLAN;
const copy = value => JSON.parse(JSON.stringify(value));

const actor = (id, extra = {}) => ({
  id,
  kind: "hero",
  rulesEdition: "lionwing",
  team: "hero",
  ownerId: id === "owner" ? "player-1" : null,
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
  actors: [actor("owner"), actor("source"), actor("other")],
  markers: [
    { id: "owner-marker", kind: "mark", ownerActorId: "owner", space: "main", x: 1, y: 1 },
    { id: "unrelated-marker", kind: "mark", ownerActorId: "other", space: "main", x: 2, y: 2 },
  ],
  objects: [
    { id: "owner-object", type: "terrain", ownerActorId: "owner", space: "main", cells: ["3,3"] },
    { id: "unrelated-object", type: "terrain", ownerActorId: "other", space: "main", cells: ["4,4"] },
  ],
  areas: [],
  walls: [],
  topology: { cuts: [] },
  targetIds: ["owner", "other"],
  selectedActor: "owner",
  activeActorId: "owner",
  pendingAction: { id: "pending-owner", actorId: "other", targetId: "owner", targetIds: ["owner", "other"] },
  pendingPrompt: { id: "prompt-other", sourceActorId: "other", targetId: "other" },
  lionwing: {
    entities: {},
    entityReceipts: {},
    auras: [
      { id: "aura-disable", sourceActorId: "owner", sourceLossPolicy: "disable" },
      { id: "aura-lookalike", noteEntityId: "owner", sourceLossPolicy: "remove" },
    ],
    subscriptions: [],
    choices: [],
    deferred: [],
    pausedChains: [],
    afterAttack: [],
    executionCursor: null,
  },
  log: [],
  undo: [],
});

const addEntity = (scene, raw) => Entities.create(scene, {
  lifetime: "scene",
  visibility: "public",
  rule: "test.destroy-plan",
  ...raw,
}, { role: "narrator" }).scene;

let scene = baseScene();
scene = addEntity(scene, { id: "owner-row", kind: "summon", ownerActorId: "owner", source: { actorId: "source" }, backing: { markerId: "owner-marker" }, sourceLossPolicy: "remove" });
scene = addEntity(scene, { id: "disabled-row", kind: "aura", ownerActorId: "source", source: { actorId: "owner" }, backing: { objectId: "unrelated-object" }, sourceLossPolicy: "disable" });
scene = addEntity(scene, { id: "detached-row", kind: "aura", ownerActorId: "source", source: { actorId: "owner" }, backing: { objectId: "unrelated-object" }, sourceLossPolicy: "detach" });
scene.actors.find(item => item.id === "source").effectStates = { "positive.test": { sources: [{ sourceEntityId: "owner-row" }] } };
scene.pendingActionPlan = { id: "plan-other", actorId: "other", context: { targetIds: ["other"] } };

const beforePrepare = copy(scene);
const plan = Plans.planDestroy(scene, { kind: "actor", id: "owner" }, { role: "narrator", expectedVersion: 4, eventId: "destroy-owner" });
assert.equal(plan.type, "lionwing.destroy-plan");
assert.ok(plan.table.some(row => row.subject === "registry-row" && row.action === "remove"), "the explicit actor/registry/backing/space table is present");
assert.ok(plan.entity.removedIds.includes("owner-row"));
assert.ok(plan.entity.disabledIds.includes("disabled-row"));
assert.ok(plan.entity.detachedIds.includes("detached-row"));
assert.equal(JSON.stringify(scene), JSON.stringify(beforePrepare), "planning never mutates the input Scene");
assert.ok(plan.references.some(ref => ref.kind === "actor" && ref.value === "owner"));
assert.equal(plan.references.some(ref => ref.field === "noteEntityId"), false, "lookalike fields are never treated as typed references");

const cancelled = Plans.cancel(plan, scene);
assert.equal(cancelled.cancelled, true);
assert.deepEqual(copy(cancelled.scene), beforePrepare, "cancel returns the original snapshot without applying it");

let validationCalls = 0;
const applied = Plans.apply(scene, plan, {
  role: "narrator",
  eventId: "destroy-owner",
  validateTableEdit: () => { validationCalls += 1; },
});
assert.equal(applied.ok, true);
assert.equal(validationCalls, 1, "the common validateTableEdit boundary runs once on the prepared before/after pair");
assert.equal(applied.scene.actors.some(item => item.id === "owner"), false, "the requested actor is removed");
assert.equal(applied.scene.markers.some(item => item.id === "owner-marker"), false, "owned backing is removed with the actor");
assert.equal(applied.scene.objects.some(item => item.id === "owner-object"), false, "owned object backing is removed with the actor");
assert.equal(applied.scene.actors.some(item => item.id === "other"), true, "an unrelated actor survives");
assert.equal(applied.scene.pendingAction, null, "only a pending chain that targets the removed actor is invalidated");
assert.ok(applied.scene.pendingActionPlan, "an unrelated pending chain survives");
assert.deepEqual(copy(applied.scene.targetIds), ["other"], "selection references are typed and filtered");
assert.equal(applied.scene.lionwing.auras.some(item => item.id === "aura-lookalike"), true, "an unrelated lookalike field survives");
assert.equal(applied.scene.lionwing.auras.find(item => item.id === "aura-disable").disabled, true, "disable follows source-loss policy");
assert.equal(applied.scene.lionwing.entities["disabled-row"].lifecycle, "disabled");
assert.deepEqual(copy(applied.scene.lionwing.entities["detached-row"].source), { detachedId: "owner" }, "detach follows source-loss policy");
assert.equal(applied.scene.lionwing.entities["owner-row"], undefined);
assert.equal(applied.scene.actors.find(item => item.id === "source").effectStates["positive.test"].sources[0].disabled, true, "entity-backed actor runtime is disabled without disabling the actor");
assert.equal(applied.scene.actors.find(item => item.id === "source").disabled, undefined);

const serialized = JSON.stringify(applied.scene);
const reloaded = Entities.reload(serialized);
const replayed = Plans.apply(reloaded, plan, { role: "narrator", eventId: "destroy-owner" });
assert.equal(replayed.replayed, true, "JSON reload keeps the idempotency receipt");
assert.deepEqual(copy(replayed.scene), copy(reloaded));
const undone = Plans.undo(applied, applied.scene);
assert.deepEqual(copy(undone.scene), beforePrepare, "one result carries a complete undo snapshot");

const staleScene = copy(scene);
const stalePlan = Plans.planDestroy(staleScene, { kind: "actor", id: "owner" }, { role: "narrator", expectedVersion: 4, eventId: "stale-owner" });
staleScene.version = 5;
assert.throws(() => Plans.apply(staleScene, stalePlan, { role: "narrator", eventId: "stale-owner" }), error => error.code === "stale-plan");
assert.equal(staleScene.actors.some(item => item.id === "owner"), true, "a stale plan has no partial mutation");

const protectedScene = copy(scene);
protectedScene.lionwing.auras.push({ id: "protected-aura", sourceActorId: "owner", protected: true });
const protectedBefore = copy(protectedScene);
assert.throws(() => Plans.planDestroy(protectedScene, { kind: "actor", id: "owner" }, { role: "narrator", expectedVersion: 4, eventId: "protected-owner" }), error => error.code === "protected-dependency");
assert.deepEqual(protectedScene, protectedBefore, "a protected dependency rejects before every mutation");

// Space removal evacuates Compound parts together.  Filling the main field
// forces the same reserve path as placeActorsSafely.
let spaceScene = baseScene();
spaceScene.activeSpace = "side";
spaceScene.actors = [
  ...spaceScene.actors,
  actor("compound-a", { kind: "enemy", team: "enemy", profileId: "enemy.test", compoundId: "compound-boss", space: "side", x: 0, y: 0 }),
  actor("compound-b", { kind: "enemy", team: "enemy", profileId: "enemy.test", compoundId: "compound-boss", space: "side", x: 0, y: 0 }),
];
for (let index = 0; index < 49; index += 1) spaceScene.actors.push(actor(`main-${index}`, { space: "main", x: index % 7, y: Math.floor(index / 7) }));
spaceScene.objects.push({ id: "side-terrain", type: "terrain", space: "side", cells: ["1,1"] });
spaceScene.areas.push({ id: "side-area", type: "area", space: "side", cells: ["2,2"] });
spaceScene.walls.push({ id: "side-wall", space: "side", a: "0,0", b: "0,1" });
spaceScene.markers.push({ id: "side-marker", space: "side", x: 1, y: 1 });
spaceScene.topology.cuts.push({ id: "side-cut", space: "side", cells: ["3,3"] });
spaceScene.pendingAction = { id: "side-pending", actorId: "other", space: "side" };
spaceScene = addEntity(spaceScene, { id: "side-row", kind: "terrain-binding", ownerActorId: "other", source: { actorId: "source" }, backing: { objectId: "side-terrain" } });
const spacePlan = Plans.planDestroy(spaceScene, { kind: "space", id: "side" }, { role: "narrator", expectedVersion: 4, eventId: "destroy-side" });
assert.equal(spacePlan.fallbackSpaceId, "main");
assert.equal(spacePlan.transfers.find(item => item.actorId === "compound-a").to.space, "destroy-plan-reserve:main");
assert.deepEqual(copy(spacePlan.transfers.filter(item => item.groupId === "compound-boss").map(item => `${item.to.space}:${item.to.x},${item.to.y}`)), ["destroy-plan-reserve:main:0,0", "destroy-plan-reserve:main:0,0"]);
const spaceResult = Plans.apply(spaceScene, spacePlan, { role: "narrator", eventId: "destroy-side" });
assert.equal(spaceResult.scene.spaces.some(item => item.id === "side"), false);
assert.equal(spaceResult.scene.activeSpace, "main");
assert.equal(spaceResult.scene.actors.find(item => item.id === "compound-a").space, "destroy-plan-reserve:main");
assert.equal(spaceResult.scene.actors.find(item => item.id === "compound-b").x, spaceResult.scene.actors.find(item => item.id === "compound-a").x, "Compound parts remain in one cell");
assert.equal(spaceResult.scene.objects.some(item => item.id === "side-terrain"), false);
assert.equal(spaceResult.scene.areas.some(item => item.id === "side-area"), false);
assert.equal(spaceResult.scene.walls.some(item => item.id === "side-wall"), false);
assert.equal(spaceResult.scene.markers.some(item => item.id === "side-marker"), false);
assert.equal(spaceResult.scene.topology.cuts.some(item => item.id === "side-cut"), false);
assert.equal(spaceResult.scene.lionwing.entities["side-row"], undefined);
assert.equal(spaceResult.scene.pendingAction, null, "space-dependent pending state is invalidated");

const engineScene = copy(spaceScene);
engineScene.pendingAction = null;
engineScene.pendingPrompt = null;
const engineEvents = [];
const structuralEngine = {
  dispatchMany(input, events) {
    engineEvents.push(...copy(events));
    const next = copy(input);
    next.spaces = next.spaces.filter(item => item.id !== events[0].payload.id);
    return { scene: next, events: copy(events) };
  },
};
const enginePlan = Plans.planDestroy(engineScene, { kind: "space", id: "side" }, { role: "narrator", expectedVersion: 4, eventId: "destroy-side-engine" });
const engineResult = Plans.apply(engineScene, enginePlan, { role: "narrator", eventId: "destroy-side-engine", engine: structuralEngine });
assert.equal(engineEvents[0].type, "space.remove", "space removal uses the existing typed engine operation when no pending lifecycle blocks it");
assert.equal(engineResult.scene.spaces.some(item => item.id === "side"), false);

console.log("LionWing destroy plan: typed table, immutable prepare/cancel, owner and target cleanup, Compound evacuation, source-loss policy, protected rollback, stale plan, JSON reload, replay and undo passed");
