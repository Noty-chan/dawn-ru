import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const VOLATILE_KEYS = new Set(["at", "exportedAt", "openedAt", "updatedAt"]);

function semantic(value, key = "") {
  if (VOLATILE_KEYS.has(key)) return undefined;
  if (Array.isArray(value)) return value.map(item => semantic(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(childKey => {
    const child = semantic(value[childKey], childKey);
    return child === undefined ? null : [childKey, child];
  }).filter(Boolean));
}

function assertSemanticEqual(actual, expected, message) {
  assert.deepEqual(semantic(actual), semantic(expected), message);
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.failKeys = new Set();
  }

  getItem(key) {
    return this.values.has(String(key)) ? this.values.get(String(key)) : null;
  }

  setItem(key, value) {
    const normalized = String(key);
    if (this.failKeys.has(normalized)) throw new Error("QuotaExceededError");
    this.values.set(normalized, String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

class FakeIndexedDB {
  constructor() {
    this.records = new Map();
    this.failTransactions = false;
    this.hasStore = false;
    this.db = {
      objectStoreNames: { contains: () => this.hasStore },
      createObjectStore: () => { this.hasStore = true; },
      transaction: (_storeName, _mode) => {
        const transaction = { failed: this.failTransactions, pending: 0, completeQueued: false, error: null };
        const fail = () => {
          if (transaction.completeQueued) return;
          transaction.completeQueued = true;
          transaction.error = new Error("IndexedDB write failed");
          queueMicrotask(() => {
            transaction.onerror?.();
            transaction.onabort?.();
          });
        };
        const finish = () => {
          if (transaction.failed || transaction.completeQueued) return;
          if (transaction.pending === 0) {
            transaction.completeQueued = true;
            queueMicrotask(() => transaction.oncomplete?.());
          }
        };
        const bucket = {
          put: value => {
            if (transaction.failed) {
              fail();
              return;
            }
            this.records.set(value.key, clone(value));
            finish();
          },
          delete: key => {
            this.records.delete(key);
            finish();
          },
          get: key => {
            const request = { result: undefined, error: null };
            transaction.pending += 1;
            queueMicrotask(() => {
              if (transaction.failed) {
                fail();
                request.onerror?.();
              } else {
                request.result = this.records.get(key);
                request.onsuccess?.();
              }
              transaction.pending -= 1;
              finish();
            });
            return request;
          },
          getAllKeys: () => {
            const request = { result: undefined, error: null };
            transaction.pending += 1;
            queueMicrotask(() => {
              request.result = [...this.records.keys()];
              request.onsuccess?.();
              transaction.pending -= 1;
              finish();
            });
            return request;
          },
        };
        transaction.objectStore = () => bucket;
        queueMicrotask(finish);
        return transaction;
      },
    };
  }

  open() {
    const request = { result: this.db, error: null };
    queueMicrotask(() => {
      if (!this.hasStore) request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  }
}

function buildFixture() {
  const actor = (id, team, space, x, y, extra = {}) => ({
    id,
    kind: team === "hero" ? "hero" : "enemy",
    team,
    rulesEdition: "lionwing",
    heroId: team === "hero" ? id : null,
    ownerId: team === "hero" ? `owner-${id}` : null,
    name: id,
    space,
    x,
    y,
    hp: team === "hero" ? 16 : 20,
    maxHp: team === "hero" ? 16 : 20,
    ap: 3,
    baseAp: 3,
    focus: team === "hero" ? 6 : 0,
    influence: team === "hero" ? 3 : 0,
    wounds: team === "hero" ? 2 : 0,
    stress: 0,
    tier: 1,
    speed: 4,
    armor: 0,
    evasion: 0,
    attrs: { body: 4, talent: 3, spirit: 2, mind: 2 },
    effects: [],
    effectStates: {},
    ruleResources: {
      momentum: {
        resource: "momentum",
        kind: "resource",
        label: "Импульс",
        minimum: 0,
        maximum: 4,
        initial: 2,
        current: 2,
        value: 2,
        scope: "scene",
        lifetime: "scene",
      },
    },
    ruleClocks: {
      preparation: {
        clockId: "preparation",
        kind: "clock",
        label: "Подготовка",
        min: 0,
        maximum: 4,
        max: 4,
        initial: 0,
        current: 0,
        value: 0,
        scope: "scene",
        lifetime: "scene",
      },
    },
    acted: false,
    knockedOut: false,
    hidden: false,
    usedActions: [],
    ...extra,
  });

  const sourceEffect = {
    duration: "scene",
    removable: true,
    sourceBound: true,
    exclusiveBySource: false,
    sources: [{ sourceId: "hero-a", actorId: "hero-a", appliedEventId: "fixture-effect-source" }],
  };

  return {
    schema: 14,
    rulesEdition: "lionwing",
    version: 0,
    name: "L06 neutral recovery fixture",
    view: "gm",
    turnApprovalMode: "self",
    round: 1,
    turnSerial: 0,
    tension: 0,
    activeSpace: "main",
    activeActorId: null,
    spaces: [
      { id: "main", name: "Главное поле", mode: "standard", width: 7, height: 7 },
      { id: "vault", name: "Свод", mode: "custom", width: 5, height: 5 },
      { id: "balcony", name: "Балкон", mode: "cinematic", width: 7, height: 1 },
    ],
    actors: [
      actor("hero-a", "hero", "main", 1, 1, { effects: ["positive.укреплен"], effectStates: { "positive.укреплен": clone(sourceEffect) } }),
      actor("hero-b", "hero", "vault", 1, 1),
      actor("enemy-a", "enemy", "main", 4, 1, { effects: ["negative.помечен"], effectStates: { "negative.помечен": clone(sourceEffect) } }),
      actor("enemy-b", "enemy", "balcony", 5, 0),
    ],
    objects: [{ id: "effect-zone", space: "vault", type: "terrain", label: "Источник эффекта", source: "fixture", cells: ["2,2"], metadata: { effectRules: [{ effect: "positive.укреплен", audience: "allies" }] } }],
    areas: [{ id: "clock-zone", space: "main", type: "area", label: "Зона часов", source: "fixture", duration: "scene", cells: ["3,3"], metadata: {} }],
    walls: [{ id: "wall-main", space: "main", a: "2,2", b: "2,3", label: "Стена", source: "fixture", hp: 10, maxHp: 10 }],
    markers: [{ id: "effect-source", space: "vault", x: 2, y: 2, kind: "mark", label: "Источник", color: "#e2b54a", source: "fixture", ownerActorId: "hero-b", metadata: { effectRules: [{ effect: "positive.укреплен", audience: "allies" }] } }],
    topology: { cuts: [] },
    sessionClocks: [{ id: "threat", name: "Угроза", kind: "danger", size: 8, min: 0, max: 8, initial: 2, current: 2, value: 2, threshold: 8, scope: "scene", lifetime: "scene" }],
    reminders: [],
    ruleHandouts: [],
    tools: { clocksMigrated: false },
    rollFeed: [],
    pendingAction: null,
    pendingPrompt: null,
    triggerQueue: [],
    challengeRequest: null,
    opposedRoll: null,
    targetIds: [],
    targetCells: [],
    lionwing: { sceneSerial: 1, chapterSerial: 1, choices: [], deferred: [], receipts: [], history: [], specialJournal: [], afterEventReceipts: [], boundaryReceipts: [], followups: [] },
    log: [],
    undo: [],
    redo: [],
    turnUndo: [],
  };
}

function loadEngines() {
  const context = { window: {}, console };
  vm.createContext(context);
  for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
    vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
  }
  return { context, sceneEngine: loadSceneEngine(context), lw: context.window.DAWN_LIONWING_ENGINE };
}

function runLionwing(lw, scene, actorId, payload, id) {
  const command = lw.command(actorId, payload);
  return lw.dispatchMany(scene, [{ ...command, id }]).scene;
}

function runSceneEvent(sceneEngine, scene, type, payload, id, actorId = null) {
  return sceneEngine.dispatchMany(scene, [{ id, type, actorId, payload }], { expectedVersion: Number(scene.version || 0) }).scene;
}

function buildStorageContext(storage, idb) {
  const appSource = fs.readFileSync(new URL("../app-core.js", import.meta.url), "utf8");
  const entitySource = fs.readFileSync(new URL("../lionwing-entities.js", import.meta.url), "utf8");
  let id = 0;
  const context = {
    console: { ...console, warn: () => {} },
    window: {},
    APP_SCHEMA: 14,
    STORAGE_KEY: "dawn-ru-companion-v2",
    HERO_STORAGE_KEY: "dawn-ru-companion-heroes-v1",
    SCENE_INTERFACE_ROLLOUT_VERSION: 3,
    contentPreferences: { edition: "lionwing" },
    localStorage: storage,
    indexedDB: idb,
    uid: () => `fixture-${++id}`,
    clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
    cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [],
    safeColor: (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback,
    safeImage: value => typeof value === "string" ? value : "",
    safeTokenImage: value => typeof value === "string" ? value : "",
    normalizeGmLibrary: value => value && typeof value === "object" ? clone(value) : {},
    restoreLocalHeroMedia: scene => scene,
    normalizeHero: value => clone(value),
    Sync: { state: () => ({}), queueScene: () => {} },
    structuredClone: undefined,
    addEventListener: () => {},
    setTimeout,
    clearTimeout,
    renderAll: () => {},
  };
  vm.createContext(context);
  vm.runInContext(entitySource, context, { filename: "lionwing-entities.js" });
  const normalizerStart = appSource.indexOf("function blankScene()");
  const normalizerEnd = appSource.indexOf("const TABLE_BACKUP_FORMAT");
  assert.ok(normalizerStart >= 0 && normalizerEnd > normalizerStart, "app-core normalizer range exists");
  vm.runInContext(`${appSource.slice(normalizerStart, normalizerEnd)}
    this.sceneCore=sceneCore;this.normalizeScene=normalizeScene;this.validateTableEdit=validateTableEdit;`, context, { filename: "app-core.scene-normalizer.js" });

  const mediaStart = appSource.indexOf("const HERO_MEDIA_DB");
  const mediaEnd = appSource.indexOf("function normalizedStoredState", mediaStart);
  assert.ok(mediaStart >= 0 && mediaEnd > mediaStart, "app-core media range exists");
  vm.runInContext(`${appSource.slice(mediaStart, mediaEnd)}
    this.writeHeroMedia=writeHeroMedia;this.readHeroMedia=readHeroMedia;this.initializeHeroMediaStorage=initializeHeroMediaStorage;`, context, { filename: "app-core.media-storage.js" });

  const backupStart = appSource.indexOf("const TABLE_BACKUP_FORMAT");
  const backupEnd = appSource.indexOf("function cleanArray", backupStart);
  assert.ok(backupStart >= 0 && backupEnd > backupStart, "app-core backup range exists");
  vm.runInContext(`${appSource.slice(backupStart, backupEnd)}
    this.tableBackupPayload=tableBackupPayload;this.normalizedTableBackup=normalizedTableBackup;`, context, { filename: "app-core.table-backup.js" });

  const persistStart = appSource.indexOf("function activateHeroEdition");
  const persistEnd = appSource.indexOf("const allGifts", persistStart);
  assert.ok(persistStart >= 0 && persistEnd > persistStart, "app-core persistence range exists");
  vm.runInContext(`${appSource.slice(persistStart, persistEnd)}
    this.persist=persist;this.persistableStore=persistableStore;`, context, { filename: "app-core.persistence.js" });

  const eventsSource = fs.readFileSync(new URL("../app-scene-events.js", import.meta.url), "utf8");
  const recoveryStart = eventsSource.indexOf("async function saveTableRecovery");
  const recoveryEnd = eventsSource.indexOf("function applyTableBackup", recoveryStart);
  assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart, "app-scene recovery range exists");
  context.updateTableRecoveryStatus = () => {};
  context.toast = message => { context.lastToast = String(message); };
  vm.runInContext(`${eventsSource.slice(recoveryStart, recoveryEnd)}
    this.saveTableRecovery=saveTableRecovery;this.readTableRecovery=readTableRecovery;`, context, { filename: "app-scene-events.recovery.js" });
  return context;
}

function installUndoHarness(context, scene) {
  const sceneSource = fs.readFileSync(new URL("../scene-ui.js", import.meta.url), "utf8");
  const start = sceneSource.indexOf("function sceneSnapshot()");
  const end = sceneSource.indexOf("function applyNarratorOverride", start);
  assert.ok(start >= 0 && end > start, "scene-ui history range exists");
  context.Scene = scene;
  context.S = { id: "hero-a", runtime: {} };
  context.store = { mode: "tools", gmLibrary: null, heroes: [context.S], current: 0 };
  context.sceneZoom = 70;
  context.sceneControlMode = "guided";
  context.sceneInterfaceVersion = "next";
  context.SCENE_INTERFACE_ROLLOUT_VERSION = 3;
  context.scenePanelLayoutMode = "split";
  context.scenePanelSides = {};
  context.scenePanelWidths = { left: "wide", right: "normal" };
  context.sceneTurnStripVisible = true;
  context.sceneInterfaceDensity = "compact";
  context.sceneViewportMode = "desktop";
  context.persist = () => {};
  context.renderScene = () => {};
  context.renderPlay = () => {};
  context.queueNetworkV2Snapshot = () => false;
  vm.runInContext(`${sceneSource.slice(start, end)}
    this.commitScene=commitScene;this.undoScene=undoScene;this.redoScene=redoScene;`, context, { filename: "scene-ui.history.js" });
}

const { context: engineContext, sceneEngine, lw } = loadEngines();
let scene = buildFixture();
let eventCount = 0;
let sequence = 0;
const nextId = label => `${label}-${++sequence}`;

scene = runLionwing(lw, scene, "hero-a", { kind: "attack", name: "Ручная атака", actionId: "manual.attack", targetIds: ["enemy-a"], amount: 3 }, nextId("manual-attack"));
eventCount += 1;
assert.equal(scene.pendingAction?.actorId, "hero-a", "manual attack remains pending for a Reaction");
scene = runLionwing(lw, scene, "enemy-a", { kind: "reaction", choice: "take" }, nextId("manual-reaction"));
eventCount += 1;
scene = runLionwing(lw, scene, "hero-a", { kind: "resolve-attack" }, nextId("manual-attack-resolve"));
eventCount += 1;
assert.equal(scene.pendingAction, null, "the manual attack clears after the target Reaction");

scene = runLionwing(lw, scene, "hero-a", { kind: "effect", targetId: "enemy-a", effect: "negative.замедлен" }, nextId("effect-source"));
eventCount += 1;
scene = runLionwing(lw, scene, "hero-a", { kind: "resource", resource: "focus", operation: "spend", amount: 1 }, nextId("resource-spend"));
eventCount += 1;
scene = runLionwing(lw, scene, "hero-a", { kind: "clock", id: "battle-clock", label: "Подготовка атаки", size: 4, current: 0, initial: 0, scope: "scene", lifetime: "scene", sourceEntityId: "effect-zone", ruleId: "fixture.clock" }, nextId("clock-create"));
eventCount += 1;
scene = runLionwing(lw, scene, "hero-a", { kind: "counter", type: "clock", operation: "add", id: "battle-clock", delta: 1 }, nextId("clock-tick"));
eventCount += 1;
scene = runSceneEvent(sceneEngine, scene, "session-clock.add", { id: "threat", delta: 1 }, nextId("scene-clock-add"));
eventCount += 1;
assert.equal(scene.sessionClocks.find(clock => clock.id === "threat")?.current, 3, "Scene clock changes through the Scene event path");

scene = runLionwing(lw, scene, "enemy-a", { kind: "batch", operations: [{ kind: "damage", targetId: "hero-a", amount: 30 }] }, nextId("resistance-offer"));
eventCount += 1;
const resistance = scene.lionwing?.choices?.find(choice => choice.kind === "knockout");
assert.ok(resistance, "a long-battle fixture reaches a pending Resistance choice");
const pendingResistance = clone(scene);
const pendingReload = engineContext.window.DAWN_LIONWING_ENGINE.reload(JSON.stringify(pendingResistance));
assert.equal(pendingReload.lionwing.choices.find(choice => choice.id === resistance.id)?.kind, "knockout", "engine JSON reload preserves pending Resistance");

const storage = new MemoryStorage();
const idb = new FakeIndexedDB();
const app = buildStorageContext(storage, idb);
app.Scene = pendingResistance;
app.store = { mode: "tools", gmLibrary: null, heroes: [{ id: "hero-a", rulesEdition: "lionwing", runtime: {} }], current: 0 };
const pendingCanonical = vm.runInContext("normalizeScene(sceneCore(Scene))", app);
const checkpointPayload = vm.runInContext("tableBackupPayload(Scene)", app);
const checkpointJson = JSON.stringify(checkpointPayload);
const checkpointImport = vm.runInContext(`normalizedTableBackup(${checkpointJson})`, app);
assertSemanticEqual(checkpointImport.scene, pendingCanonical, "export/import preserves the pending Resistance semantics");
assert.equal(checkpointImport.scene.lionwing.choices.find(choice => choice.id === resistance.id)?.kind, "knockout", "exported checkpoint keeps the pending Resistance choice");

const recoverySaved = await app.saveTableRecovery("L06 pending Resistance checkpoint");
assert.equal(recoverySaved, true, "IndexedDB recovery checkpoint is written");
const recoveredJson = await app.readTableRecovery();
assert.ok(recoveredJson, "IndexedDB recovery checkpoint can be read");
const recovered = vm.runInContext(`normalizedTableBackup(JSON.parse(${JSON.stringify(recoveredJson)}))`, app).scene;
assertSemanticEqual(recovered, pendingCanonical, "IndexedDB recovery restores the checkpoint semantics");

scene = runLionwing(lw, scene, "hero-a", { kind: "choice", id: resistance.id, choice: "resist" }, nextId("resistance-resolve"));
eventCount += 1;
assert.equal(scene.lionwing.choices.some(choice => choice.id === resistance.id), false, "Resistance is resolved before the long event run");

for (let index = 0; index < 270; index += 1) {
  const result = lw.dispatchMany(scene, [{ ...lw.command("hero-b", { kind: "note", note: `neutral event ${index + 1}` }), id: nextId("long-event") }]);
  scene = result.scene;
  eventCount += result.events.length;
}
assert.ok(eventCount >= 250, `fixture produced ${eventCount} events`);
assert.equal(scene.log.length, 200, "Scene journal enforces its 200-row display limit");
assert.ok(scene.log.some(row => row.payload?.note === "neutral event 270"), "the newest event remains in the bounded journal");
assert.ok(!scene.log.some(row => row.payload?.note === "neutral event 1"), "the oldest event leaves the bounded journal");
assert.ok(scene.lionwing.history.some(row => row.type === "counter.threshold" || row.type === "spend"), "mechanical history retains facts separately from the 200-row journal");

app.Scene = scene;
app.store = { mode: "tools", gmLibrary: null, heroes: [{ id: "hero-a", rulesEdition: "lionwing", runtime: {} }], current: 0 };
app.S = app.store.heroes[0];
app.sceneZoom = 70;
app.sceneControlMode = "guided";
app.sceneInterfaceVersion = "next";
app.scenePanelLayoutMode = "split";
app.scenePanelSides = {};
app.scenePanelWidths = { left: "wide", right: "normal" };
app.sceneTurnStripVisible = true;
app.sceneInterfaceDensity = "compact";
app.sceneViewportMode = "desktop";
const artImage = `data:image/png;base64,${"A".repeat(400000)}`;
const collidingImages = vm.runInContext(`sceneCore({...Scene,artworks:[{id:"same-art",image:"data:image/png;base64,AAAA"},{id:"same-art",image:"data:image/png;base64,BBBB"}]})`, app);
assert.equal(collidingImages.artworks.length, 2, "imported artwork remains present after normalization");
assert.notEqual(collidingImages.artworks[0].id, collidingImages.artworks[1].id, "duplicate imported artwork IDs cannot collide in IndexedDB");
app.Scene = { ...scene, artworks: [{ id: "scene-art-1", name: "Large scene art", kind: "background", image: artImage, hidden: false }], backgroundArt: "scene-art-1" };
app.store.gmLibrary = { encounters: [{ id: "preset-1", name: "Art preset", enemies: [{ profileId: "lionwing.npc.martyr", name: "Martyr", tier: 1 }], templateScene: { ...scene, artworks: [{ id: "preset-art-1", name: "Preset art", kind: "background", image: artImage, hidden: false }], backgroundArt: "preset-art-1" } }] };
await app.initializeHeroMediaStorage();
await new Promise(resolve => setTimeout(resolve, 120));
const compactArtScene = JSON.parse(storage.getItem(app.STORAGE_KEY)).scene;
assert.equal(compactArtScene.artworks[0].image, "", "frequent localStorage snapshots omit artwork after its IndexedDB write");
assert.equal(compactArtScene.artworks[0].imageStored, true, "localStorage keeps an explicit artwork reference");
assert.equal(JSON.parse(storage.getItem(app.STORAGE_KEY)).gmLibrary.encounters[0].templateScene.artworks[0].image, "", "saved encounter templates also omit repeated artwork bytes");
assert.equal(idb.records.get("scene:art:scene-art-1")?.value, artImage, "the complete artwork is written to IndexedDB first");
assert.equal(idb.records.get("preset:preset-1:art:preset-art-1")?.value, artImage, "preset artwork has its own stable storage key");
app.Scene = vm.runInContext(`sceneCore(${JSON.stringify(compactArtScene)})`, app);
app.store.gmLibrary = JSON.parse(storage.getItem(app.STORAGE_KEY)).gmLibrary;
await app.initializeHeroMediaStorage();
assert.equal(app.Scene.artworks[0].image, artImage, "a reload restores artwork before exporting the table");
assert.equal(app.store.gmLibrary.encounters[0].templateScene.artworks[0].image, artImage, "a reload restores saved encounter artwork");
assert.equal(vm.runInContext("tableBackupPayload(Scene).scene.artworks[0].image", app), artImage, "portable table backup retains the full artwork");
assert.equal(vm.runInContext("tableBackupPayload(Scene).gmLibrary.encounters[0].templateScene.artworks[0].image", app), artImage, "portable table backup retains preset artwork");
app.Scene = scene;
app.store.gmLibrary = null;
const persisted = app.persist();
assert.equal(persisted, undefined, "persist writes through the app persistence boundary");
await new Promise(resolve => setTimeout(resolve, 200));
assert.equal(idb.records.has("scene:art:scene-art-1"), false, "removed Scene art releases its IndexedDB payload");
assert.equal(idb.records.has("preset:preset-1:art:preset-art-1"), false, "removed encounter preset releases its IndexedDB payload");
const goodLocalStorage = storage.getItem(app.STORAGE_KEY);
assert.ok(goodLocalStorage, "localStorage receives a valid table snapshot");
const localReload = vm.runInContext(`normalizeScene(${JSON.stringify(JSON.parse(goodLocalStorage).scene)})`, app);
const persistedCanonical = vm.runInContext("normalizeScene(sceneCore(Scene))", app);
assertSemanticEqual(localReload, persistedCanonical, "localStorage JSON reload preserves the long-battle semantics");

const beforeFailedLocalWrite = storage.getItem(app.STORAGE_KEY);
storage.failKeys.add(app.STORAGE_KEY);
app.Scene = { ...scene, name: "failed local write must not replace checkpoint" };
app.persist();
await new Promise(resolve => setTimeout(resolve, 120));
assert.equal(storage.getItem(app.STORAGE_KEY), beforeFailedLocalWrite, "a localStorage write failure keeps the last valid save");
storage.failKeys.delete(app.STORAGE_KEY);

const undoBase = vm.runInContext(`normalizeScene(${JSON.stringify(scene)})`, app);
installUndoHarness(app, undoBase);
const undoLabels = [];
for (let index = 1; index <= 25; index += 1) {
  const label = `L06 undo change ${index}`;
  undoLabels.push(label);
  const committed = app.commitScene(label, current => { current.name = label; });
  assert.ok(committed, `undoable change ${index} commits${app.lastToast ? `: ${app.lastToast}` : ""}`);
}
assert.equal(app.Scene.undo.length, 20, "undo history keeps its declared 20 snapshots");
assert.deepEqual(Array.from(app.Scene.undo, item => item.label), undoLabels.slice(5).reverse(), "the undo limit drops only the five oldest changes");
const beforeUndoName = app.Scene.name;
app.undoScene();
assert.equal(app.Scene.name, undoLabels[23], "undo restores the immediately preceding semantic state");
app.redoScene();
assert.equal(app.Scene.name, beforeUndoName, "redo restores the undone semantic state");

idb.failTransactions = true;
storage.failKeys.add("dawn-ru-companion-table-recovery-v1");
app.Scene = { ...scene, name: "oversized recovery candidate" };
const failedRecovery = await app.saveTableRecovery("forced write failure");
assert.equal(failedRecovery, false, "recovery reports failure when IndexedDB and localStorage both reject the write");
idb.failTransactions = false;
storage.failKeys.delete("dawn-ru-companion-table-recovery-v1");
const survivingRecovery = await app.readTableRecovery();
const survivingCheckpoint = vm.runInContext(`normalizedTableBackup(JSON.parse(${JSON.stringify(survivingRecovery)}))`, app).scene;
assertSemanticEqual(survivingCheckpoint, pendingCanonical, "a failed recovery write does not erase the previous valid checkpoint");

const finalExport = vm.runInContext("tableBackupPayload(Scene)", app);
const finalExportImport = vm.runInContext(`normalizedTableBackup(${JSON.stringify(finalExport)})`, app).scene;
const finalCanonical = vm.runInContext("normalizeScene(sceneCore(Scene))", app);
assertSemanticEqual(finalExportImport, finalCanonical, "final table export/import preserves semantic state");

console.log(`LionWing L06 recovery stress passed: ${eventCount} events, 3 spaces, pending Resistance checkpoint, 200-row journal limit, 20 undo snapshots, localStorage, IndexedDB recovery, export/import, JSON reload and failed-write preservation`);
