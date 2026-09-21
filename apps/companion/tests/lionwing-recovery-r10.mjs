import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const clone = value => JSON.parse(JSON.stringify(value));
const RECOVERY_KEY = "dawn-ru-companion-table-recovery-v1";
const META_KEY = "dawn-ru-companion-table-recovery-meta-v1";

class MemoryStorage {
  constructor() { this.values = new Map(); this.failKeys = new Set(); }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) {
    const normalized = String(key);
    if (this.failKeys.has(normalized)) throw new Error("QuotaExceededError");
    this.values.set(normalized, String(value));
  }
  removeItem(key) { this.values.delete(String(key)); }
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
        const tx = { pending: 0, failed: this.failTransactions, completeQueued: false, error: null };
        const fail = () => {
          if (tx.completeQueued) return;
          tx.completeQueued = true;
          tx.error = new Error("IndexedDB transaction failed");
          queueMicrotask(() => { tx.onerror?.(); tx.onabort?.(); });
        };
        const finish = () => {
          if (tx.failed || tx.completeQueued || tx.pending) return;
          tx.completeQueued = true;
          queueMicrotask(() => tx.oncomplete?.());
        };
        const bucket = {
          put: value => {
            if (tx.failed) return fail();
            this.records.set(value.key, clone(value));
            finish();
          },
          get: key => {
            const request = { result: undefined, error: null };
            tx.pending += 1;
            queueMicrotask(() => {
              if (tx.failed) { fail(); request.onerror?.(); }
              else { request.result = this.records.get(key); request.onsuccess?.(); }
              tx.pending -= 1;
              finish();
            });
            return request;
          },
        };
        tx.objectStore = () => bucket;
        return tx;
      },
    };
  }
  open() {
    const request = { result: this.db, error: null };
    queueMicrotask(() => { if (!this.hasStore) request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  }
}

const actor = (id, team, x) => ({
  id, kind: team, team, rulesEdition: "lionwing", heroId: team === "hero" ? id : null,
  ownerId: team === "hero" ? `owner-${id}` : null, name: id, space: "main", x, y: 0,
  hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: team === "hero" ? 2 : 0,
  influence: team === "hero" ? 1 : 0, wounds: 0, stress: 0, tier: 1, speed: 3,
  armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 },
  effects: [], effectStates: {}, ruleResources: {}, ruleClocks: {}, acted: false,
  knockedOut: false, hidden: false, usedActions: [],
});

function buildScene(name) {
  return {
    schema: 14, rulesEdition: "lionwing", version: 0, name, view: "gm", turnApprovalMode: "self",
    round: 1, turnSerial: 0, tension: 0, tool: "select", activeSpace: "main", activeActorId: null,
    spaces: [{ id: "main", name: "Основное поле", mode: "standard", width: 7, height: 7 }],
    actors: [actor("hero-r10", "hero", 1), actor("enemy-r10", "enemy", 3)], objects: [], walls: [], markers: [],
    topology: { cuts: [] }, artworks: [], backgroundArt: null, backgroundView: { fit: "cover", position: "center", dim: 28, gridOpacity: 58 },
    featuredArt: null, selectedActor: null, targetIds: [], targetCells: [], pendingActionPlan: null, pendingAction: null,
    pendingPrompt: null, triggerQueue: [], challengeRequest: null, opposedRoll: null, sessionClocks: [], reminders: [],
    ruleHandouts: [], tools: { clocksMigrated: false }, rollFeed: [],
    lionwing: { sceneSerial: 1, choices: [{ id: "resistance-r10", kind: "knockout", actorId: "hero-r10", options: ["resist", "take"] }], deferred: [], receipts: [], history: [], specialJournal: [], afterEventReceipts: [], boundaryReceipts: [], followups: [] },
    log: Array.from({ length: 205 }, (_, index) => ({ id: `log-${index}`, at: "2026-09-21T00:00:00.000Z", text: `row ${index}`, type: "note", actorId: null, payload: {}, visibility: "public" })),
    undo: [], redo: [], turnUndo: [],
  };
}

function buildApp(storage, idb) {
  const source = fs.readFileSync(new URL("../app-core.js", import.meta.url), "utf8");
  const entitySource = fs.readFileSync(new URL("../lionwing-entities.js", import.meta.url), "utf8");
  let generatedId = 0;
  const context = {
    console: { ...console, warn: () => {} }, window: {}, APP_SCHEMA: 14,
    STORAGE_KEY: "dawn-ru-companion-v2", HERO_STORAGE_KEY: "dawn-ru-companion-heroes-v1",
    contentPreferences: { edition: "lionwing" }, localStorage: storage, indexedDB: idb,
    uid: () => `r10-${++generatedId}`, clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
    cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [],
    safeColor: (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback,
    safeImage: value => typeof value === "string" ? value : "", safeTokenImage: value => typeof value === "string" ? value : "",
    normalizeGmLibrary: value => value && typeof value === "object" ? clone(value) : {}, restoreLocalHeroMedia: scene => scene,
    normalizeHero: value => clone(value), Sync: { state: () => ({}) }, structuredClone: undefined,
    addEventListener: () => {},
    ATTRS: [["body"], ["talent"], ["spirit"], ["mind"]],
    Logic: { normalizeAttributeBases: value => value, normalizeAttributeGrowth: value => value },
    D: { archetypes: [], outlooks: [] },
    stressMaximumFor: () => 3, spellcrafterLearnedLimitFor: level => Number(level) >= 3 ? 3 : Number(level) >= 2 ? 2 : Number(level) >= 1 ? 1 : 0,
    blankAbility: () => ({ enabled: false, name: "", desc: "", rank: 1, words: { verbs: [], nouns: [], conditions: [] }, xNoun: null, specializations: {}, customWordCosts: {} }),
  };
  context.recoveryStatus = { textContent: "" };
  context.$ = id => id === "scene-recovery-status" ? context.recoveryStatus : null;
  vm.createContext(context);
  vm.runInContext(entitySource, context, { filename: "lionwing-entities.js" });
  const normalizerStart = source.indexOf("function blankScene()");
  const backupStart = source.indexOf("const TABLE_BACKUP_FORMAT");
  const backupEnd = source.indexOf("function cleanArray", backupStart);
  const heroStart = source.indexOf("function blankHero");
  const heroEnd = source.indexOf("function blankScene", heroStart);
  vm.runInContext(`${source.slice(heroStart, heroEnd)}`, context, { filename: "app-core.hero-default.js" });
  vm.runInContext(`${source.slice(normalizerStart, backupStart)}\nthis.sceneCore=sceneCore;this.normalizeScene=normalizeScene;`, context, { filename: "app-core.scene-normalizer.js" });
  const migrationStart = source.indexOf("function normalizeAbility");
  const migrationEnd = source.indexOf("const HERO_MEDIA_DB", migrationStart);
  vm.runInContext(`${source.slice(migrationStart, migrationEnd)}\nthis.migrateLegacy=migrateLegacy;`, context, { filename: "app-core.legacy-migration.js" });
  const mediaStart = source.indexOf("const HERO_MEDIA_DB");
  const mediaEnd = source.indexOf("function normalizedStoredState", mediaStart);
  vm.runInContext(`${source.slice(mediaStart, mediaEnd)}\nthis.writeHeroMedia=writeHeroMedia;this.readHeroMedia=readHeroMedia;`, context, { filename: "app-core.media-storage.js" });
  vm.runInContext(`${source.slice(backupStart, backupEnd)}\nthis.tableBackupPayload=tableBackupPayload;this.normalizedTableBackup=normalizedTableBackup;`, context, { filename: "app-core.table-backup.js" });
  const eventsSource = fs.readFileSync(new URL("../app-scene-events.js", import.meta.url), "utf8");
  const recoveryStart = eventsSource.indexOf("function updateTableRecoveryStatus");
  const recoveryEnd = eventsSource.indexOf('$("scene-export-table")', recoveryStart);
  context.toast = message => { context.lastToast = String(message); };
  context.Scene = null;
  context.commitScene = (label, mutate) => { context.commitCalls = (context.commitCalls || 0) + 1; context.lastCommitLabel = label; mutate(context.Scene); return true; };
  context.persist = () => { context.persistCalls = (context.persistCalls || 0) + 1; };
  context.renderScene = () => { context.renderCalls = (context.renderCalls || 0) + 1; };
  context.setScenePanel = panel => { context.lastScenePanel = panel; };
  vm.runInContext(`${eventsSource.slice(recoveryStart, recoveryEnd)}\nthis.saveTableRecovery=saveTableRecovery;this.readTableRecovery=readTableRecovery;this.applyTableBackup=applyTableBackup;`, context, { filename: "app-scene-events.recovery.js" });
  return context;
}

const storage = new MemoryStorage();
const idb = new FakeIndexedDB();
const app = buildApp(storage, idb);
app.store = { gmLibrary: null };
const freshLionwing = vm.runInContext("sceneCore(blankScene())", app);
const explicitLegacy = vm.runInContext("sceneCore(blankScene('ru-v0.9'))", app);
assert.equal(freshLionwing.rulesEdition, "lionwing", "a fresh LionWing scene follows the active edition");
assert.equal(explicitLegacy.rulesEdition, "ru-v0.9", "an explicitly requested legacy scene remains legacy");
const migratedLegacy = vm.runInContext(`migrateLegacy(${JSON.stringify({ heroes: [{ name: "Legacy hero" }] })})`, app);
assert.equal(migratedLegacy.scene.rulesEdition, "ru-v0.9", "legacy dawn-heroes migration keeps the legacy scene edition under LionWing");
assert.equal(migratedLegacy.heroes[0].rulesEdition, "ru-v0.9", "legacy dawn-heroes migration keeps heroes in the legacy edition under LionWing");

app.Scene = buildScene("old IndexedDB checkpoint");
const firstSave = await app.saveTableRecovery("old checkpoint");
assert.equal(firstSave, true, "the first checkpoint uses production IndexedDB writer");
const oldRecord = idb.records.get(RECOVERY_KEY);
const oldPayload = JSON.parse(oldRecord.value);
oldPayload.exportedAt = "2026-09-21T00:00:00.000Z";
oldRecord.value = JSON.stringify(oldPayload);

app.Scene = buildScene("new localStorage fallback checkpoint");
storage.setItem(META_KEY, JSON.stringify({ exportedAt: "2020-01-01T00:00:00.000Z", recoveryLabel: "old metadata" }));
idb.failTransactions = true;
assert.equal(await app.saveTableRecovery("new fallback checkpoint"), true, "a failed IndexedDB write falls back to localStorage");
const fallbackRaw = storage.getItem(RECOVERY_KEY);
assert.ok(fallbackRaw, "the fallback checkpoint is present in localStorage");
assert.equal(JSON.parse(storage.getItem(META_KEY)).exportedAt, JSON.parse(fallbackRaw).exportedAt, "fallback metadata follows the new checkpoint instead of the old date");
assert.ok(app.recoveryStatus.textContent.includes("Точка:"), "fallback status is refreshed after writing the new checkpoint");
idb.failTransactions = false;
const recoveredFallback = JSON.parse(await app.readTableRecovery());
assert.equal(recoveredFallback.scene.name, "new localStorage fallback checkpoint", "recovery reads the newest fallback instead of stale IndexedDB");

storage.failKeys.add(RECOVERY_KEY);
idb.failTransactions = true;
app.Scene = buildScene("rejected checkpoint");
assert.equal(await app.saveTableRecovery("rejected checkpoint"), false, "a write rejected by both stores reports failure");
storage.failKeys.delete(RECOVERY_KEY);
const surviving = JSON.parse(await app.readTableRecovery());
assert.equal(surviving.scene.name, "new localStorage fallback checkpoint", "a failed write preserves the previous valid checkpoint");

const tiedIndexed = clone(JSON.parse(fallbackRaw));
const tiedLocal = clone(JSON.parse(fallbackRaw));
tiedIndexed.exportedAt = "2026-09-21T01:00:00.000Z";
tiedIndexed.scene.name = "equal-date IndexedDB checkpoint";
tiedLocal.exportedAt = tiedIndexed.exportedAt;
tiedLocal.scene.name = "equal-date localStorage checkpoint";
idb.records.set(RECOVERY_KEY, { key: RECOVERY_KEY, value: JSON.stringify(tiedIndexed), updatedAt: Date.parse(tiedIndexed.exportedAt) });
storage.setItem(RECOVERY_KEY, JSON.stringify(tiedLocal));
const recoveredTie = JSON.parse(await app.readTableRecovery());
assert.equal(recoveredTie.scene.name, "equal-date localStorage checkpoint", "equal-date recovery candidates deterministically prefer valid localStorage fallback");

idb.records.set(RECOVERY_KEY, { key: RECOVERY_KEY, value: "{ invalid recovery", updatedAt: Date.now() });
const recoveredAfterInvalidIndexedDb = JSON.parse(await app.readTableRecovery());
assert.equal(recoveredAfterInvalidIndexedDb.scene.name, "equal-date localStorage checkpoint", "an invalid IndexedDB candidate is rejected in favor of valid localStorage");

const exported = vm.runInContext("tableBackupPayload(Scene)", app);
const imported = vm.runInContext(`normalizedTableBackup(${JSON.stringify(exported)})`, app).scene;
assert.equal(imported.lionwing.choices[0].kind, "knockout", "table export/import keeps pending Resistance");
assert.equal(imported.log.length, 200, "table import keeps the bounded journal");
assert.throws(() => vm.runInContext("normalizedTableBackup(null)", app), /не содержит данных стола/i, "corrupt input is rejected");
const oversized = buildScene("oversized");
oversized.spaces = Array.from({ length: 20 }, (_, index) => ({ id: `space-${index}`, name: "x", mode: "custom", width: 7, height: 7 }));
oversized.actors = Array.from({ length: 140 }, (_, index) => actor(`actor-${index}`, index % 2 ? "hero" : "enemy", index % 7));
const bounded = vm.runInContext(`normalizedTableBackup(tableBackupPayload(${JSON.stringify(oversized)}))`, app).scene;
assert.equal(bounded.spaces.length, 12, "oversized input is bounded by the production normalizer");
assert.equal(bounded.actors.length, 120, "oversized actor input is bounded by the production normalizer");

app.Scene = buildScene("current table");
app.Scene.version = 44;
app.Scene.view = "player";
app.Scene.undo = [{ id: "current-undo" }];
const applySource = buildScene("backup table");
applySource.selectedActor = "enemy-r10";
applySource.targetIds = ["enemy-r10"];
const applyBackup = vm.runInContext(`tableBackupPayload(${JSON.stringify(applySource)})`, app);
assert.equal(app.applyTableBackup(applyBackup, "Восстановлена копия"), true, "production recovery applies a normalized backup through commitScene");
assert.equal(app.commitCalls > 0, true, "recovery application uses the production commitScene path");
assert.equal(app.Scene.name, "backup table", "production recovery replaces the table state");
assert.equal(app.Scene.version, 44, "production recovery preserves the current version boundary");
assert.equal(app.Scene.view, "player", "production recovery preserves the current view");
assert.deepEqual(app.Scene.undo, [{ id: "current-undo" }], "production recovery preserves the current undo history");
assert.equal(JSON.stringify(app.Scene.targetIds), "[]", "production recovery clears stale target selection");

console.log("LionWing R10 recovery passed: real storage helpers, IndexedDB-to-localStorage fallback precedence, failed-write preservation, pending Resistance export/import, bounded journal and corrupt/oversized input");
