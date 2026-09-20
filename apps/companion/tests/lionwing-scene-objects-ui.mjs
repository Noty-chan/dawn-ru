import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), "utf8");
const uiSource = read("lionwing-ui.js");
const entitiesSource = read("lionwing-entities.js");
const moduleContext = { window: {}, console };
vm.createContext(moduleContext);
vm.runInContext(entitiesSource, moduleContext, { filename: "lionwing-entities.js" });
const Entities = moduleContext.window.DAWN_LIONWING_ENTITIES;
assert.ok(Entities?.projectScene, "the entity API exposes a player projection for the scene inventory");

const crowd = (id, name, x, hidden = false) => ({ id, kind: "crowd", team: "enemy", name, tier: 0, space: "main", x, y: 1, hp: 1, maxHp: 1, knockedOut: false, hidden, ownerActorId: null });
const scene = {
  rulesEdition: "lionwing",
  version: 3,
  spaces: [{ id: "main", name: "Главное поле", width: 8, height: 6 }],
  actors: [
    { id: "hero", kind: "hero", team: "hero", name: "Ворон", ownerId: "player-1", space: "main", x: 0, y: 0, hp: 5, maxHp: 5, knockedOut: false },
    crowd("crowd-1", "Двойники", 1), crowd("crowd-2", "Двойники", 2), crowd("crowd-3", "Двойники", 3),
    crowd("crowd-4", "Двойники", 4), crowd("crowd-5", "Двойники", 5),
  ],
  markers: [{ id: "marker-owner", label: "Сигнал", kind: "objective", ownerActorId: "hero", space: "main", x: 1, y: 2, duration: "scene" }],
  objects: [
    { id: "object-hidden", label: "Скрытая дверь", type: "terrain", space: "main", cells: ["6,1"], hidden: true, duration: "scene" },
    { id: "object-visible", label: "Камень", type: "terrain", space: "main", cells: ["6,2"], hp: 3, maxHp: 3, duration: "round" },
  ],
  areas: [{ id: "area-main", label: "Зона риска", type: "area", space: "main", cells: ["2,3"], duration: "scene" }],
  walls: [{ id: "wall-main", label: "Старая Стена", space: "main", a: "3,3", b: "3,4", hp: 10, maxHp: 10 }],
  selectedActor: "crowd-1",
  targetIds: [],
  lionwing: { entities: {}, entityReceipts: {} },
};

const linked = Entities.create(scene, {
  id: "registry-marker",
  kind: "summon",
  ownerActorId: "hero",
  source: { actorId: "hero" },
  rule: "manual.entity",
  backing: { markerId: "marker-owner" },
  lifetime: "scene",
  visibility: "public",
}, { role: "narrator", actorId: "hero" });
Object.assign(scene, linked.scene);
scene.lionwing.entities.unbound = {
  id: "unbound",
  kind: "summon",
  ownerActorId: "hero",
  source: { actorId: "hero" },
  rule: "manual.entity",
  backing: { objectId: "object-gone" },
  lifetime: { boundary: "round" },
  visibility: "public",
};

const domRoot = { innerHTML: "" };
let view = "gm";
let renderCount = 0;
const context = {
  console,
  window: { DAWN_LIONWING_ENTITIES: Entities },
  Scene: scene,
  Sync: { state: () => ({ userId: "player-1" }) },
  currentHeroActor: () => scene.actors[0],
  activeSceneView: () => view,
  lwActive: () => true,
  $: id => id === "scene-entities" ? domRoot : id === "scene-board-wrap" ? null : null,
  esc: value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])),
  toast: message => message,
  persist: () => {},
  renderScene: () => { renderCount += 1; },
  setScenePanel: panel => { context.lastPanel = panel; },
};
vm.createContext(context);
const helperStart = uiSource.indexOf("const lwEntities = () =>");
const helperEnd = uiSource.indexOf("const lwFormDraft =", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "scene object helpers are available in the LionWing UI");
vm.runInContext(`${uiSource.slice(helperStart, helperEnd)}
this.renderLionwingEntities = renderLionwingEntities;
this.lwEntityRows = lwEntityRows;
this.lwShowEntityOnField = lwShowEntityOnField;`, context, { filename: "lionwing-scene-objects-ui.helpers.js" });

const before = JSON.stringify(scene);
context.renderLionwingEntities();
assert.equal((domRoot.innerHTML.match(/data-lw-entity-row/g) || []).length, 11, "five crowds, two participants and marker/object/area/wall backings share one list");
assert.match(domRoot.innerHTML, /Двойники/g, "same named backings remain visible as separate rows");
assert.match(domRoot.innerHTML, /Показать на поле/, "every backing has the existing field navigation action");
assert.match(domRoot.innerHTML, /Поиск по объектам Сцены/, "the inventory exposes game-facing search");
assert.match(domRoot.innerHTML, /Участники и массовка|Маркеры|Без связи/, "the inventory exposes game-facing filters");
for (const field of ["Вид", "Владелец", "Пространство", "Срок", "Состояние"]) assert.match(domRoot.innerHTML, new RegExp(`<dt>${field}</dt>`), `${field} is a visible game-facing field`);
assert.match(domRoot.innerHTML, /Связать существующий объект/, "the form describes an existing-object link");
assert.match(domRoot.innerHTML, /Координаты, Здоровье и другие поля объекта остаются/, "the form explains that backing state is not copied");
assert.doesNotMatch(domRoot.innerHTML, /Создать public сущность|Создать сущность/, "the form does not present a summon-creation action");
assert.match(domRoot.innerHTML, /Связь с точкой призыва/, "registry kind is translated to a game-facing relation label");
assert.doesNotMatch(domRoot.innerHTML, />summon</, "raw registry kind is not shown in the card");
assert.match(domRoot.innerHTML, /kind:summon/, "raw kind remains available in technical details");
assert.match(domRoot.innerHTML, /Связи без объекта/, "a registry row without its backing is separated with a reason");
assert.match(domRoot.innerHTML, /объект отсутствует на Сцене/, "the unbound row explains why it is separate");
assert.equal(JSON.stringify(scene), before, "rendering the inventory is read-only");

const playerProjection = Entities.projectScene(scene, { role: "player", actorId: "hero", userId: "player-1" });
assert.equal(playerProjection.objects.some(item => item.id === "object-hidden"), false, "player projection removes a hidden object backing");
view = "player";
context.renderLionwingEntities();
assert.doesNotMatch(domRoot.innerHTML, /Скрытая дверь/, "hidden backing is absent from the player inventory");
assert.doesNotMatch(domRoot.innerHTML, /object-hidden/, "player projection does not expose the hidden backing ID");
view = "gm";

context.lwShowEntityOnField("actor:crowd-3");
assert.equal(scene.selectedActor, "crowd-3", "show on field reuses the current actor selection");
assert.equal(scene.activeSpace, "main", "show on field keeps the backing space selected");
assert.equal(context.lastPanel, "inspector", "show on field opens the existing inspector");
context.lwShowEntityOnField("marker:marker-owner");
assert.equal(scene.selectedActor, null, "showing a non-actor backs into the existing object inspector");
assert.equal(context.lastPanel, "inspector", "non-actor navigation uses the existing inspector");

const reloaded = Entities.reload(JSON.parse(JSON.stringify(scene)), { allowInvalid: true });
const reloadProjection = Entities.project(reloaded, { role: "narrator", actorId: "hero" });
assert.ok(reloadProjection.entities.some(entity => entity.id === "registry-marker"), "a registry link survives JSON reload");
assert.equal(reloaded.actors.find(actor => actor.id === "crowd-3").hp, 1, "reload does not replace backing state with registry data");
assert.ok(renderCount >= 1, "field navigation remains a regular UI action");

console.log("LionWing scene objects UI: backing inventory, registry joins, unbound reasons, player projection, filters/search markup, field navigation and reload passed");
