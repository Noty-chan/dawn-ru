import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const entitiesSource = fs.readFileSync(new URL("lionwing-entities.js", root), "utf8");
const moduleContext = { window: {}, console };
vm.createContext(moduleContext);
vm.runInContext(entitiesSource, moduleContext, { filename: "lionwing-entities.js" });
const Entities = moduleContext.window.DAWN_LIONWING_ENTITIES;
assert.ok(Entities?.create && Entities?.projectScene, "production entity API exposes writer and scene projection");

const scene = {
  rulesEdition: "lionwing",
  version: 1,
  spaces: [{ id: "main", name: "Основное поле", width: 7, height: 7 }],
  actors: [
    { id: "owner", kind: "hero", team: "hero", name: "Ворон", ownerId: "user-owner", space: "main", x: 1, y: 1, hp: 5, maxHp: 5, hidden: false },
    { id: "stranger", kind: "hero", team: "hero", name: "Свидетель", ownerId: "user-stranger", space: "main", x: 2, y: 1, hp: 5, maxHp: 5, hidden: false },
    { id: "hidden-actor", kind: "crowd", team: "enemy", name: "Скрытый страж", ownerId: null, space: "main", x: 3, y: 1, hp: 5, maxHp: 5, hidden: true },
  ],
  markers: [
    { id: "marker-visible", label: "Публичный маркер", kind: "objective", space: "main", x: 1, y: 3, duration: "scene" },
    { id: "marker-hidden", label: "Тайна Нарратора", kind: "hidden", space: "main", x: 5, y: 5, duration: "scene" },
  ],
  objects: [
    { id: "object-visible", label: "Рунный пол", type: "terrain", space: "main", cells: ["2,2"], duration: "scene" },
    { id: "object-hidden", label: "Секретная дверь", type: "terrain", space: "main", cells: ["5,2"], hidden: true, duration: "scene" },
  ],
  areas: [
    { id: "area-visible", label: "Публичная область", type: "area", space: "main", cells: ["2,4"], duration: "scene" },
    { id: "area-hidden", label: "Скрытая область", type: "area", space: "main", cells: ["5,4"], hidden: true, duration: "scene" },
  ],
  walls: [
    { id: "wall-visible", label: "Древняя стена", space: "main", a: "2,5", b: "2,6", hp: 10, maxHp: 10 },
    { id: "wall-hidden", label: "Скрытая стена", space: "main", a: "5,5", b: "5,6", hp: 10, maxHp: 10, hidden: true },
  ],
  selectedActor: "owner",
  activeActorId: "owner",
  targetIds: [],
  lionwing: { entities: {}, entityReceipts: {} },
};

function createEntity(id, backing, visibility = "public", ownerActorId = "owner") {
  const result = Entities.create(scene, {
    id,
    kind: `qa-${id}`,
    ownerActorId,
    source: { actorId: ownerActorId },
    rule: "qa.player-objects",
    backing,
    lifetime: "scene",
    visibility,
  }, { role: "narrator", actorId: "owner" });
  for (const key of Object.keys(scene)) delete scene[key];
  Object.assign(scene, result.scene);
}

createEntity("entity-visible-object", { objectId: "object-visible" });
createEntity("entity-public-hidden-marker", { markerId: "marker-hidden" });
createEntity("entity-owner-wall", { wallId: "wall-visible" }, "owner");
createEntity("entity-narrator-area", { areaId: "area-visible" }, "narrator");
createEntity("entity-public-hidden-area", { areaId: "area-hidden" });
createEntity("entity-public-hidden-wall", { wallId: "wall-hidden" });
createEntity("entity-public-secret-actor", { actorId: "hidden-actor" });

const narrator = Entities.projectScene(scene, { role: "narrator", actorId: "owner", userId: "user-owner" });
assert.equal(narrator.actors.some(item => item.id === "hidden-actor"), true, "Narrator projection keeps hidden actors");
assert.equal(narrator.markers.some(item => item.id === "marker-hidden"), true, "Narrator projection keeps hidden markers");
assert.equal(narrator.objects.some(item => item.id === "object-hidden"), true, "Narrator projection keeps hidden objects");
assert.equal(narrator.areas.some(item => item.id === "area-hidden"), true, "Narrator projection keeps hidden areas");
assert.equal(narrator.walls.some(item => item.id === "wall-hidden"), true, "Narrator projection keeps hidden walls");
assert.equal(Object.keys(narrator.lionwing.entities).length, 7, "Narrator receives every registry row");

const owner = Entities.projectScene(scene, { role: "player", actorId: "owner", userId: "user-owner" });
const stranger = Entities.projectScene(scene, { role: "player", actorId: "stranger", userId: "user-stranger" });
for (const projection of [owner, stranger]) {
  assert.equal(projection.actors.some(item => item.id === "hidden-actor"), false, "player projection removes hidden actors");
  assert.equal(projection.markers.some(item => item.id === "marker-hidden"), false, "player projection removes hidden markers");
  assert.equal(projection.objects.some(item => item.id === "object-hidden"), false, "player projection removes hidden objects");
  assert.equal(projection.areas.some(item => item.id === "area-hidden"), false, "player projection removes hidden areas");
  assert.equal(projection.walls.some(item => item.id === "wall-hidden"), false, "player projection removes hidden walls");
  assert.equal(projection.objects.some(item => item.id === "object-visible"), true, "visible object remains in player projection");
  assert.equal(projection.areas.some(item => item.id === "area-visible"), true, "visible area remains in player projection");
  assert.equal(projection.walls.some(item => item.id === "wall-visible"), true, "visible wall remains in player projection");
}

const ownerRows = owner.lionwing.entities;
assert.ok(ownerRows["entity-visible-object"], "owner receives public visible registry row");
assert.ok(ownerRows["entity-owner-wall"], "owner receives owner-only registry row");
assert.equal(ownerRows["entity-narrator-area"], undefined, "player never receives narrator-only registry row");
assert.equal(ownerRows["entity-public-hidden-marker"].backing, null, "public relation to hidden marker is redacted");
assert.equal(ownerRows["entity-public-hidden-marker"].backingHidden, true, "redaction carries only hidden-state reason");
assert.equal(ownerRows["entity-public-hidden-area"].backing, null, "public relation to hidden area is redacted");
assert.equal(ownerRows["entity-public-hidden-wall"].backing, null, "public relation to hidden wall is redacted");
assert.equal(ownerRows["entity-public-secret-actor"].backing, null, "public relation to hidden actor is redacted");

const strangerRows = stranger.lionwing.entities;
assert.ok(strangerRows["entity-visible-object"], "stranger receives public visible registry row");
assert.equal(strangerRows["entity-owner-wall"], undefined, "non-owner does not receive owner-only registry row");
assert.equal(strangerRows["entity-narrator-area"], undefined, "non-narrator does not receive narrator-only registry row");
for (const hiddenId of ["marker-hidden", "area-hidden", "wall-hidden", "hidden-actor"]) {
  assert.equal(JSON.stringify(owner).includes(hiddenId), false, `player projection does not leak ${hiddenId}`);
  assert.equal(JSON.stringify(stranger).includes(hiddenId), false, `non-owner projection does not leak ${hiddenId}`);
}

const reloaded = Entities.reload(JSON.parse(JSON.stringify(scene)), { allowInvalid: true });
assert.equal(Object.keys(reloaded.lionwing.entities).length, 7, "all registry rows survive production JSON reload");
assert.equal(reloaded.objects.find(item => item.id === "object-visible").label, "Рунный пол", "reload preserves backing state");

console.log("LionWing O10 player objects: production writer, full Narrator inventory, player redaction, owner visibility, hidden area/wall/actor backing, and reload passed");
