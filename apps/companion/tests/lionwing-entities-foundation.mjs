import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../lionwing-entities.js", import.meta.url), "utf8"), context, { filename: "lionwing-entities.js" });
const Entities = context.window.DAWN_LIONWING_ENTITIES;
assert.ok(Entities, "the JSON entities API is installed");

const copy = value => JSON.parse(JSON.stringify(value));
const actor = (id, extra = {}) => ({ id, ownerId: id === "owner" ? "player-1" : null, kind: "hero", hidden: false, knockedOut: false, ...extra });
const fixture = () => ({
  rulesEdition: "lionwing",
  version: 4,
  actors: [actor("owner"), actor("source"), actor("summon", { hidden: true }), actor("outsider", { ownerId: "player-2" })],
  markers: [{ id: "flame", kind: "mark", hidden: false, space: "main", x: 1, y: 1 }],
  objects: [{ id: "field", type: "terrain", hidden: false, cells: ["2,2"] }],
  areas: [{ id: "circle", type: "area", hidden: false, cells: ["3,3"] }],
  walls: [{ id: "wall", hidden: false, space: "main", a: "0,0", b: "0,1" }],
  lionwing: { entities: {}, auras: [], subscriptions: [], choices: [] },
});

const create = (scene, input, options = { role: "narrator" }) => Entities.create(scene, input, options);
const common = (id, backing, extra = {}) => ({
  id,
  kind: "summon",
  ownerActorId: "owner",
  source: { actorId: "source" },
  rule: "manual.entity",
  backing,
  lifetime: { boundary: "scene" },
  visibility: "public",
  ...extra,
});

let scene = fixture();
const original = copy(scene);
let made = create(scene, common("entity-actor", { actorId: "summon" }, { visibility: "hidden" }));
scene = made.scene;
assert.deepEqual(copy(scene.actors), original.actors, "creating a registry entry does not duplicate or mutate actor state");
assert.deepEqual(copy(scene.lionwing.entities["entity-actor"].backing), { actorId: "summon" }, "actor backing is a typed reference only");
assert.equal(scene.lionwing.entities["entity-actor"].backing.x, undefined, "backing has no copied coordinates");

made = create(scene, common("entity-marker", { markerId: "flame" }, { sourceLossPolicy: "disable", visibility: "owner" }));
scene = made.scene;
made = create(scene, common("entity-object", { objectId: "field" }, { sourceLossPolicy: "remove" }));
scene = made.scene;
made = create(scene, common("entity-area", { areaId: "circle" }, { sourceLossPolicy: "detach" }));
scene = made.scene;

let receiptScene=fixture();
receiptScene=Entities.create(receiptScene,common("receipt-entity",{markerId:"flame"}),{role:"narrator",eventId:"entity-event:shared"}).scene;
assert.throws(()=>Entities.transform(receiptScene,"receipt-entity",{objectId:"field"},{role:"narrator",eventId:"entity-event:shared"}),/тем же ID|другие данные/i,"an entity receipt ID cannot be replayed with a different operation");
assert.throws(()=>Entities.create(receiptScene,common("receipt-entity",{markerId:"flame"}),{role:"player",actorId:"outsider"}),/владельц|Нарратор/i,"idempotent create still checks authority");

assert.equal(Entities.entityStatus(scene, "entity-marker").active, true);
assert.equal(Entities.entityStatus(scene, "entity-actor").active, true);
assert.equal(Entities.query(scene, { backingType: "object" }).length, 1, "typed backing filters are stable");
assert.equal(Entities.resolve(scene, "entity-marker").entity.id, "entity-marker", "resolve exposes status and the immutable record");
assert.equal(Entities.resolve(scene, "entity-marker").backing.markerId, "flame", "resolve also exposes a typed backing reference");
const beforeQueries = copy(scene);
Entities.validateGraph(scene); Entities.query(scene, {}); Entities.entityStatus(scene, "entity-marker"); Entities.project(scene, { role: "player", actorId: "owner" });
assert.deepEqual(copy(scene), beforeQueries, "resolve, validate, query and projection are read-only");

let linked = Entities.link(scene, { id: "pilot-link", type: "pilot", from: "entity-marker", to: "entity-actor" }, { role: "narrator" });
scene = linked.scene;
assert.equal(Entities.graph(scene).links[0].type, "pilot");
assert.deepEqual(copy(Entities.connected(scene, "entity-marker", { direction: "out" })), ["entity-actor"]);
assert.throws(() => Entities.link(scene, { id: "reverse-link", type: "pilot", from: "entity-actor", to: "entity-marker" }, { role: "narrator" }), /цикл/i, "a reverse directed link is rejected as a cycle");
assert.throws(() => Entities.link(scene, { id: "dangling-link", type: "anchor", from: "entity-marker", to: "missing" }, { role: "narrator" }), /отсутствующ|висяч/i, "a dangling target is rejected");
const blockedExit = Entities.pilotExit(scene, "entity-marker", "entity-actor", { role: "narrator", requireLanding: true });
assert.equal(blockedExit.waiting, true, "pilot exit keeps an explicit placement choice when no landing cell is supplied");
assert.equal(Entities.graph(scene).links.length, 1, "a waiting pilot exit does not unlink the vehicle");
assert.throws(()=>Entities.pilotExit(scene,"entity-marker","entity-actor",{role:"player",actorId:"outsider",requireLanding:true}),/владельц|Нарратор/i,"pilot exit checks authority before returning hidden link details");
const exited = Entities.pilotExit(scene, "entity-marker", "entity-actor", { role: "narrator", landingCell: { space: "main", x: 2, y: 1 } });
scene = exited.scene;
assert.equal(Entities.graph(scene).links.length, 0, "pilot exit explicitly removes only the pilot link");
scene = Entities.pilotEnter(scene, "entity-marker", "entity-actor", { role: "narrator", linkId: "pilot-link" }).scene;
assert.throws(() => create(scene, common("bad-backing", { actorId: "missing" })), /Backing|backing/i, "a new entity cannot bind a missing backing");
assert.throws(() => create(scene, common("bad-copy", { markerId: "flame", x: 1 })), /чужой подсистем|данные/i, "a backing cannot copy scene coordinates");
assert.throws(() => create(scene, common("bad-owner-backing", { actorId: "outsider" }), { actorId: "owner", role: "player" }), /привязать|владельц/i, "a player cannot bind another player's backing");
assert.throws(() => create(scene, common("forged", { markerId: "flame" }), { actorId: "outsider", role: "player" }), /владельц|Нарратор/i, "a player cannot forge another actor's owner");

scene.lionwing.auras = [{ id: "aura-1", sourceEntityId: "entity-marker", lifetime: "scene" }, { id: "independent", sourceActorId: "source", lifetime: "persistent" }];
scene.lionwing.subscriptions = [{ id: "subscription-1", entityId: "entity-object", lifetime: "scene" }];
scene.lionwing.choices = [{ id: "choice-1", context: { anchorEntityId: "entity-marker" } }];
const cleanup = Entities.cleanupPlan(scene, ["entity-marker", "entity-object"]);
assert.equal(cleanup.mutatesForeignCollections, false, "cleanup is declarative");
assert.deepEqual(copy(cleanup.cleanups.map(item => item.id)), ["aura-1", "choice-1", "subscription-1"]);
assert.equal(scene.lionwing.auras.length, 2, "cleanup planning does not mutate aura state");

// The same lost source drives three explicit policies in one immutable transition.
const beforeLoss = copy(scene);
scene.actors.find(item => item.id === "source").knockedOut = true;
const loss = Entities.sourceLoss(scene, { actorId: "source" }, { role: "narrator", eventId: "source-loss-1" });
assert.equal(loss.plan.actions.find(item => item.entityId === "entity-marker").action, "disable");
assert.equal(loss.plan.actions.find(item => item.entityId === "entity-object").action, "remove");
assert.equal(loss.plan.actions.find(item => item.entityId === "entity-area").action, "detach");
assert.equal(loss.scene.lionwing.entities["entity-marker"].lifecycle, "disabled");
assert.equal(loss.scene.lionwing.entities["entity-object"], undefined);
assert.deepEqual(copy(loss.scene.lionwing.entities["entity-area"].source), { detachedId: "source" });
assert.equal(Entities.entityStatus(loss.scene, "entity-area").active, true, "detached source leaves the entity independently active");
assert.equal(loss.scene.lionwing.auras.length, 2, "source loss returns cleanup work without touching foreign collections");
assert.deepEqual(copy(scene.lionwing.entities["entity-object"].backing), beforeLoss.lionwing.entities["entity-object"].backing, "source-loss transition leaves its input scene immutable");

const player = Entities.projectScene(loss.scene, { role: "player", actorId: "owner" });
assert.equal(player.lionwing.entities["entity-actor"], undefined, "hidden entity is absent from a player projection");
assert.ok(player.lionwing.entities["entity-marker"], "owner-visible entity remains available to its owner");
assert.equal(player.lionwing.entities["entity-actor"], undefined);
assert.equal(player.actors.some(item => item.id === "summon"), false, "hidden actor backing is filtered from the full player scene");
assert.equal(player.lionwing.entities["entity-marker"].backing.markerId, "flame", "visible marker backing is retained");
const narrator = Entities.projectScene(loss.scene, { role: "narrator" });
assert.ok(narrator.lionwing.entities["entity-actor"], "Narrator sees hidden entities");
assert.equal(narrator.lionwing.entities["entity-actor"].backing.actorId, "summon");

const serialized = Entities.serialize(loss.scene);
const reloaded = Entities.reload(serialized);
assert.deepEqual(copy(reloaded.lionwing.entities), copy(loss.scene.lionwing.entities), "JSON reload retains the registry and detached source");
const replayed = Entities.replay(reloaded, loss.event);
assert.equal(replayed.replayed, true, "replaying a recorded event is idempotent after reload");
assert.deepEqual(copy(replayed.scene), copy(reloaded), "idempotent replay does not create a second transition");
const forgedReplay=copy(loss.event);forgedReplay.id="forged-replay";forgedReplay.before={};
assert.throws(()=>Entities.replay(reloaded,forgedReplay),/снимку|stale/i,"replay requires the exact before snapshot when no receipt exists");

const undone = Entities.undo(loss.scene, loss.event);
assert.deepEqual(copy(undone.scene.lionwing.entities), copy(beforeLoss.lionwing.entities), "undo restores the exact prior registry snapshot");
assert.equal(undone.scene.lionwing.auras.length, 2, "undo keeps foreign collections untouched");

const malformed = copy(loss.scene);
malformed.lionwing.entities.bad = common("bad", { markerId: "missing" });
const malformedStatus = Entities.validateGraph(malformed);
assert.equal(malformedStatus.valid, false);
assert.ok(malformedStatus.errors.some(error => error.code === "dangling-backing"));
assert.throws(() => Entities.reload(malformed), /недопустим|граф/i, "reload rejects dangling persisted graph data");

let sourceEntityScene = fixture();
sourceEntityScene = create(sourceEntityScene, common("source-entity", { markerId: "flame" })).scene;
sourceEntityScene = create(sourceEntityScene, common("dependent-entity", { objectId: "field" }, { source: { entityId: "source-entity" }, sourceLossPolicy: "disable" })).scene;
const destroyedSource = Entities.destroy(sourceEntityScene, "source-entity", { role: "narrator", purge: true });
assert.equal(destroyedSource.scene.lionwing.entities["source-entity"], undefined, "purging a source removes its registry record");
assert.equal(destroyedSource.scene.lionwing.entities["dependent-entity"].lifecycle, "disabled", "destroying a source propagates the dependent policy");

console.log("LionWing entities: typed actor/marker/object/area backing, immutable lifecycle, links, cycle and dangling rejection, source-loss policies, cleanup planning, projections, JSON reload, replay and undo passed");
