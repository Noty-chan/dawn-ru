import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const root = new URL("..", import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), "utf8");
const index = read("index.html");
const serviceWorker = read("sw.js");
const uiSource = read("lionwing-ui.js");
const entitiesSource = read("lionwing-entities.js");

const entitiesScript = index.indexOf('src="lionwing-entities.js');
const appCoreScript = index.indexOf('src="app-core.js');
const lionwingUiScript = index.indexOf('src="lionwing-ui.js');
assert.ok(entitiesScript >= 0 && appCoreScript > entitiesScript && lionwingUiScript > entitiesScript, "browser loads entities before its consumers");
const entitiesNavStart = index.indexOf('data-scene-panel="entities"');
assert.ok(entitiesNavStart >= 0, "entities panel trigger is present");
assert.match(index.slice(index.lastIndexOf("<button", entitiesNavStart), index.indexOf(">", entitiesNavStart) + 1), /class="[^"]*\bgm-only\b/, "entities panel trigger is Narrator-only");
const entitiesPanelStart = index.indexOf('data-scene-panel-content="entities"');
const entitiesPanelEnd = index.indexOf("</section>", entitiesPanelStart);
assert.match(index.slice(index.lastIndexOf("<section", entitiesPanelStart), entitiesPanelEnd + "</section>".length), /class="[^"]*\bgm-only\b/, "entities panel is Narrator-only");
assert.match(index.slice(index.lastIndexOf("<section", entitiesPanelStart), entitiesPanelEnd + "</section>".length), /<button type="button"[^>]*data-close-scene-panel[^>]*aria-label="Закрыть панель"/, "entities panel has a keyboard-close button");
assert.ok(serviceWorker.indexOf('"./lionwing-entities.js"') >= 0, "service worker precaches the entities module");
assert.ok(serviceWorker.indexOf('"./lionwing-entities.js"') < serviceWorker.indexOf('"./app-core.js"') && serviceWorker.indexOf('"./lionwing-entities.js"') < serviceWorker.indexOf('"./lionwing-ui.js"'), "service worker keeps entities before its consumers");
assert.match(serviceWorker, /dev-20260908-lionwing-family-integration-1/, "service worker cache revision covers the family integration package");

const moduleContext = { window: {}, console };
vm.createContext(moduleContext);
vm.runInContext(entitiesSource, moduleContext, { filename: "lionwing-entities.js" });
assert.ok(moduleContext.window.DAWN_LIONWING_ENTITIES?.project, "entities module installs its browser API");
const Entities = moduleContext.window.DAWN_LIONWING_ENTITIES;
const runtimeContext = { window: {}, console, crypto: globalThis.crypto };
vm.createContext(runtimeContext);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(read(file), runtimeContext, { filename: file });
vm.runInContext(entitiesSource, runtimeContext, { filename: "lionwing-entities.js" });
const RuntimeEngine = loadSceneEngine(runtimeContext);

const helperStart = uiSource.indexOf("const lwEntities = () =>");
const helperEnd = uiSource.indexOf("const lwFormDraft =", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "entities UI projection helper is present");
const css = read("app.css");
assert.match(css, /\.scene-entity-card header strong\{[^}]*overflow-wrap:anywhere/, "entity kinds wrap on narrow cards");

const domRoot = { innerHTML: "" };
const scene = {
  rulesEdition: "lionwing",
  version: 0,
  actors: [{ id: "owner", name: "<Ворон & \"х\">", ownerId: "player-1" }],
  markers: [{ id: "marker-1", label: "<Костёр &>", ownerActorId: "owner" }],
  objects: [],
  areas: [],
  walls: [],
  lionwing: { entities: {}, entityReceipts: {} },
};
let view = "gm";
let projectionMode = "full";
const projectionCalls = [];
const commitLabels = [];
let committedEvents = [];
let generatedId = 0;
let confirmed = true;
const context = {
  console,
  window: {
    DAWN_LIONWING_ENTITIES: {
      create: Entities.create,
      destroy: Entities.destroy,
      remove: Entities.remove,
      resolve: Entities.resolve,
      project(_scene, viewer) {
        projectionCalls.push({ ...viewer });
        assert.equal(viewer.role, view === "gm" ? "narrator" : "player");
        assert.equal(viewer.actorId, "owner", "projection receives the local actor identity");
        assert.equal(viewer.userId, "player-1", "projection receives the synced user identity");
        if (projectionMode === "empty") return { entities: [] };
        const publicEntity = { id: "entity-public", kind: "<img src=x onerror=alert(1)>", ownerActorId: "owner", source: { actorId: "owner" }, backing: { markerId: "marker-1" }, visibility: "public", lifecycle: "active" };
        const ownerEntity = { id: "entity-owner", kind: "owner", ownerActorId: "owner", sourceHidden: true, backingHidden: true, visibility: "owner", lifecycle: "disabled" };
        const hiddenEntity = { id: "entity-hidden", kind: "hidden", ownerActorId: "owner", source: { actorId: "owner" }, backing: { markerId: "marker-1" }, visibility: "hidden", lifecycle: "active" };
        return { entities: view === "gm" ? [publicEntity, ownerEntity, hiddenEntity] : [publicEntity, ownerEntity] };
      },
    },
    confirm: () => confirmed,
  },
  Scene: scene,
  Sync: { state: () => ({ userId: "player-1" }) },
  currentHeroActor: () => scene.actors[0],
  activeSceneView: () => view,
  lwActive: () => true,
  $: () => domRoot,
  uid: () => `entity-ui-${++generatedId}`,
  toast: message => message,
  commitScene: (label, mutator) => {
    commitLabels.push(label);
    mutator(scene);
    scene.version += 1;
    return { scene };
  },
  commitSceneEvents: (label, events) => {
    commitLabels.push(label);
    committedEvents = JSON.parse(JSON.stringify(events));
    const before = JSON.parse(JSON.stringify(scene));
    const result = RuntimeEngine.dispatchMany(scene, events, { expectedVersion: Number(scene.version || 0) });
    for (const key of Object.keys(scene)) delete scene[key];
    Object.assign(scene, result.scene);
    scene.undo = [{ id: `ui-undo-${generatedId + 1}`, label, state: before }, ...(scene.undo || [])].slice(0, 20);
    return result;
  },
  esc: value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])),
};
vm.createContext(context);
vm.runInContext(`${uiSource.slice(helperStart, helperEnd)}\nthis.renderLionwingEntities = renderLionwingEntities;this.lwCreateEntity=lwCreateEntity;this.lwDestroyEntity=lwDestroyEntity;`, context, { filename: "lionwing-entities-ui.helpers.js" });

const beforeRender = JSON.stringify(scene);
context.renderLionwingEntities();
assert.match(domRoot.innerHTML, /&lt;Костёр &amp;&gt;/, "backing labels are escaped");
assert.match(domRoot.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/, "entity kinds are escaped");
assert.doesNotMatch(domRoot.innerHTML, /<img src=x/, "escaped entity kinds cannot inject markup");
assert.ok(domRoot.innerHTML.indexOf("<details") < domRoot.innerHTML.indexOf("entity-public"), "technical entity ID stays inside details");
assert.match(domRoot.innerHTML, /entity-hidden/, "narrator receives hidden records");

view = "player";
context.renderLionwingEntities();
assert.doesNotMatch(domRoot.innerHTML, /entity-hidden/, "player projection omits hidden records");
assert.match(domRoot.innerHTML, /entity-owner/, "owner projection remains available to the owner");
assert.doesNotMatch(domRoot.innerHTML, /Нарратор|Создать|Удалить/, "player projection has no narrator controls");
projectionMode = "empty";
context.renderLionwingEntities();
assert.match(domRoot.innerHTML, /Доступных сущностей пока нет/, "player sees an empty allowed projection without internal data");
assert.deepEqual(JSON.parse(JSON.stringify(scene)), JSON.parse(beforeRender), "read-only rendering does not mutate the scene");
assert.equal(projectionCalls.length, 3, "render asks the projection API for each view");

const values = { kind: "summon", owner: "owner", backing: "marker:marker-1", visibility: "public" };
const form = { querySelector(selector) {
  if (selector === "[data-lw-entity-kind]") return { value: values.kind };
  if (selector === "[data-lw-entity-owner]") return { value: values.owner };
  if (selector === "[data-lw-entity-backing]") return { value: values.backing };
  if (selector === "[data-lw-entity-visibility]") return { value: values.visibility };
  return null;
} };
view = "gm";
projectionMode = "empty";
confirmed = false;
assert.equal(context.lwCreateEntity(form), false, "cancel does not commit a create");
assert.deepEqual(Object.keys(scene.lionwing.entities), []);
confirmed = true;
assert.ok(context.lwCreateEntity(form)?.scene, "Narrator create uses the common Scene commit boundary");
assert.deepEqual(Object.keys(scene.lionwing.entities), ["entity-ui-1"]);
assert.equal(scene.lionwing.entities["entity-ui-1"].backing.markerId, "marker-1");
assert.equal(scene.lionwing.entities["entity-ui-1"].backing.x, undefined, "entity does not copy backing coordinates");
assert.equal(Entities.reload(JSON.parse(JSON.stringify(scene))).lionwing.entities["entity-ui-1"].id, "entity-ui-1", "created entity survives JSON reload");
scene.lionwing.auras = [{ id: "ui-aura", sourceEntityId: "entity-ui-1", sourceLossPolicy: "remove" }];
scene.lionwing.choices = [{ id: "ui-choice", context: { anchorEntityId: "entity-ui-1" } }];
scene.pendingAction = { id: "ui-pending", targetEntityId: "entity-ui-1" };
const networkBase = JSON.parse(JSON.stringify(scene));
confirmed = false;
assert.equal(context.lwDestroyEntity("entity-ui-1"), false, "cancel does not remove an entity");
assert.ok(scene.lionwing.entities["entity-ui-1"]);
view = "player";
assert.equal(context.lwDestroyEntity("entity-ui-1"), "Эта операция доступна только Нарратору", "player cannot invoke entity removal");
view = "gm";
confirmed = true;
assert.ok(context.lwDestroyEntity("entity-ui-1")?.scene, "Narrator remove uses the common Scene commit boundary");
assert.equal(scene.lionwing.entities["entity-ui-1"], undefined);
assert.equal(scene.lionwing.auras.length, 0, "the actual UI event path removes a dependent aura");
assert.equal(scene.lionwing.choices.length, 0, "the actual UI event path removes a dependent choice");
assert.equal(scene.pendingAction, null, "the actual UI event path cancels a dependent pending action");
assert.equal(committedEvents[0].type, "entity.remove", "the UI submits the typed entity removal event");
assert.equal(committedEvents[0].actorId, "narrator", "the typed UI event carries Narrator authority");
assert.equal(scene.log[0].type, "entity.remove", "the cleanup event is journaled by the runtime reducer");
assert.ok(scene.undo[0].state.lionwing.auras.some(aura => aura.id === "ui-aura"), "the common UI commit stores a full cleanup undo snapshot");
const networkResult = RuntimeEngine.dispatchMany(networkBase, committedEvents, { expectedVersion: networkBase.version, role: "narrator" });
assert.equal(networkResult.scene.lionwing.entities["entity-ui-1"], undefined, "authoritative network materialization purges the registry");
assert.equal(networkResult.scene.lionwing.auras.length, 0, "authoritative network materialization applies the same aura cleanup");
assert.equal(networkResult.scene.pendingAction, null, "authoritative network materialization applies the same pending cleanup");
const reloadedUiScene = Entities.reload(JSON.parse(JSON.stringify(scene)));
assert.equal(reloadedUiScene.lionwing.entities["entity-ui-1"], undefined, "the committed cleanup survives JSON reload");
assert.equal(reloadedUiScene.lionwing.auras.length, 0, "the committed aura cleanup survives JSON reload");
const reloadedUndo = Entities.reload(JSON.parse(JSON.stringify(scene.undo[0].state)));
assert.equal(reloadedUndo.lionwing.entities["entity-ui-1"].id, "entity-ui-1", "the full UI undo snapshot reloads the removed entity");
assert.equal(reloadedUndo.lionwing.auras[0].id, "ui-aura", "the full UI undo snapshot reloads the dependent aura");
assert.equal(commitLabels.length, 2, "only confirmed create and remove reach undo/log commit");
view = "player";
assert.equal(context.lwCreateEntity(form), "Эта операция доступна только Нарратору", "player cannot invoke mutations directly");

console.log("LionWing entities UI loading, projection and Narrator create/remove commit passed");
