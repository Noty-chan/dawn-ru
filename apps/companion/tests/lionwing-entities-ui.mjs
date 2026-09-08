import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

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
assert.match(serviceWorker, /dev-20260908-lionwing-entities-ui-1/, "service worker cache revision covers the entities UI package");

const moduleContext = { window: {}, console };
vm.createContext(moduleContext);
vm.runInContext(entitiesSource, moduleContext, { filename: "lionwing-entities.js" });
assert.ok(moduleContext.window.DAWN_LIONWING_ENTITIES?.project, "entities module installs its browser API");

const helperStart = uiSource.indexOf("const lwEntities = () =>");
const helperEnd = uiSource.indexOf("const lwFormDraft =", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "entities UI projection helper is present");
const css = read("app.css");
assert.match(css, /\.scene-entity-card header strong\{[^}]*overflow-wrap:anywhere/, "entity kinds wrap on narrow cards");

const domRoot = { innerHTML: "" };
const scene = {
  actors: [{ id: "owner", name: "<Ворон & \"х\">" }],
  markers: [{ id: "marker-1", label: "<Костёр &>" }],
  objects: [],
  areas: [],
  walls: [],
};
let view = "gm";
let projectionMode = "full";
const projectionCalls = [];
const context = {
  console,
  window: {
    DAWN_LIONWING_ENTITIES: {
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
  },
  Scene: scene,
  Sync: { state: () => ({ userId: "player-1" }) },
  currentHeroActor: () => scene.actors[0],
  activeSceneView: () => view,
  lwActive: () => true,
  $: () => domRoot,
  esc: value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])),
};
vm.createContext(context);
vm.runInContext(`${uiSource.slice(helperStart, helperEnd)}\nthis.renderLionwingEntities = renderLionwingEntities;`, context, { filename: "lionwing-entities-ui.helpers.js" });

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

console.log("LionWing entities UI loading and read-only projection passed");
