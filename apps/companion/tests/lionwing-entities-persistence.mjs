import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const copy = value => JSON.parse(JSON.stringify(value));
const entitiesSource = fs.readFileSync(new URL("../lionwing-entities.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("../app-core.js", import.meta.url), "utf8");
let generatedId = 0;
const context = {
  console,
  window: {},
  APP_SCHEMA: 14,
  contentPreferences: { edition: "ru-v0.9" },
  uid: () => `test-id-${++generatedId}`,
  clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
  cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [],
  safeColor: (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback,
  safeImage: value => typeof value === "string" ? value : "",
  safeTokenImage: value => typeof value === "string" ? value : "",
  normalizeGmLibrary: value => value && typeof value === "object" ? copy(value) : {},
  restoreLocalHeroMedia: scene => scene,
  store: { gmLibrary: null },
  validateTableEdit: () => {},
  structuredClone: undefined,
};
vm.createContext(context);
vm.runInContext(entitiesSource, context, { filename: "lionwing-entities.js" });
const Entities = context.window.DAWN_LIONWING_ENTITIES;
assert.ok(Entities, "the entities API is installed before app-core");

const normalizerStart = appSource.indexOf("function blankScene()");
const normalizerEnd = appSource.indexOf("function validateTableEdit");
assert.ok(normalizerStart >= 0 && normalizerEnd > normalizerStart, "app-core normalizer slice is present");
vm.runInContext(`${appSource.slice(normalizerStart, normalizerEnd)}\nthis.sceneCore=sceneCore;this.normalizeScene=normalizeScene;`, context, { filename: "app-core.scene-normalizer.js" });
const tableStart = appSource.indexOf("const TABLE_BACKUP_FORMAT");
const tableEnd = appSource.indexOf("function cleanArray", tableStart);
assert.ok(tableStart >= 0 && tableEnd > tableStart, "app-core backup slice is present");
vm.runInContext(`${appSource.slice(tableStart, tableEnd)}\nthis.tableBackupPayload=tableBackupPayload;this.normalizedTableBackup=normalizedTableBackup;`, context, { filename: "app-core.table-backup.js" });

const actor = (id, extra = {}) => ({
  id,
  kind: "hero",
  team: "hero",
  rulesEdition: "lionwing",
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
  influence: 1,
  wounds: 0,
  stress: 0,
  tier: 1,
  speed: 4,
  armor: 0,
  evasion: 0,
  attrs: { body: 2, talent: 2, spirit: 2, mind: 2 },
  effects: [],
  effectStates: {},
  knockedOut: false,
  hidden: false,
  ...extra,
});

const fixture = () => ({
  schema: 14,
  rulesEdition: "lionwing",
  version: 7,
  round: 2,
  turnSerial: 3,
  activeSpace: "main",
  spaces: [{ id: "main", name: "Основное поле", mode: "standard", width: 7, height: 7 }],
  actors: [actor("owner"), actor("source"), actor("secret", { hidden: true })],
  markers: [{ id: "flame", kind: "mark", hidden: false, space: "main", x: 1, y: 1, ownerActorId: "owner" }],
  objects: [
    { id: "field", type: "terrain", hidden: false, space: "main", cells: ["2,2"], ownerActorId: "owner" },
    { id: "zone", type: "area", hidden: false, space: "main", cells: ["4,4"], ownerActorId: "owner" },
  ],
  areas: [{ id: "circle", type: "area", hidden: false, space: "main", cells: ["3,3"], ownerActorId: "owner" }],
  walls: [{ id: "wall", hidden: false, space: "main", a: "0,0", b: "0,1" }],
  lionwing: { entities: {}, entityReceipts: {}, auras: [], subscriptions: [], choices: [] },
  log: [],
  undo: [],
  redo: [],
  turnUndo: [],
});

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
const normalize = scene => vm.runInContext(`normalizeScene(${JSON.stringify(scene)})`, context);

let scene = fixture();
for (const entity of [
  common("entity-actor", { actorId: "secret" }),
  common("entity-marker", { markerId: "flame" }, { visibility: "owner", sourceLossPolicy: "disable" }),
  common("entity-object", { objectId: "field" }, { sourceLossPolicy: "remove" }),
  common("entity-area", { areaId: "circle" }, { sourceLossPolicy: "detach" }),
  common("entity-area-object", { areaId: "zone" }),
  common("entity-wall", { wallId: "wall" }),
  common("entity-hidden", { markerId: "flame" }, { visibility: "hidden" }),
]) scene = Entities.create(scene, entity, { role: "narrator" }).scene;
scene = Entities.link(scene, { id: "anchor-link", type: "anchor", from: "entity-marker", to: "entity-object" }, { role: "narrator" }).scene;
scene.lionwing.auras = [{ id: "aura-1", ownerActorId: "owner", sourceEntityId: "entity-marker", ruleId: "manual.aura", effectId: "negative.test", shape: { kind: "radius", distance: 1 }, lifetime: "scene" }];
scene.lionwing.subscriptions = [{ id: "subscription-1", entityId: "entity-object", lifetime: "scene" }];
scene.lionwing.choices = [{ id: "choice-1", context: { anchorEntityId: "entity-marker" } }];
const snapshot = copy(scene);
snapshot.undo = [];
snapshot.redo = [];
snapshot.turnUndo = [];
scene.undo = [{ id: "entity-snapshot", label: "До изменения сущностей", state: snapshot }];

const normalized = normalize(scene);
assert.deepEqual(copy(normalized.lionwing.entities), copy(scene.lionwing.entities), "normalizeScene keeps the canonical entity registry");
assert.equal(normalized.areas[0].id, "circle", "an explicit area backing collection survives normalization");
assert.equal(normalized.objects.find(item => item.id === "zone").type, "area", "an area object keeps its typed object kind");
assert.equal(Entities.resolve(normalized, "entity-actor").backing.actorId, "secret", "actor backing remains typed after app-core");
assert.equal(Entities.resolve(normalized, "entity-marker").backing.markerId, "flame", "marker backing remains typed after app-core");
assert.equal(Entities.resolve(normalized, "entity-object").backing.objectId, "field", "object backing remains typed after app-core");
assert.equal(Entities.resolve(normalized, "entity-area").backing.areaId, "circle", "area backing resolves from scene.areas");
assert.equal(Entities.resolve(normalized, "entity-area-object").active, true, "area backing resolves from an area object without copying its cells");
assert.equal(Entities.resolve(normalized, "entity-wall").backing.wallId, "wall", "wall backing remains typed after app-core");
assert.equal(normalized.undo[0].state.lionwing.entities["entity-area"].backing.areaId, "circle", "undo snapshots pass through the same entity normalizer");
assert.equal(normalized.undo[0].state.lionwing.entities["entity-object"].backing.hp, undefined, "undo snapshots do not acquire backing state copies");

const localReload = normalize(JSON.parse(JSON.stringify(normalized)));
assert.deepEqual(copy(localReload.lionwing.entities), copy(normalized.lionwing.entities), "JSON local persistence reloads entity records and receipts");
const backup = vm.runInContext(`tableBackupPayload(${JSON.stringify(normalized)})`, context);
const imported = vm.runInContext(`normalizedTableBackup(${JSON.stringify(backup)})`, context).scene;
assert.deepEqual(copy(imported.lionwing.entities), copy(normalized.lionwing.entities), "table export/import preserves the entity registry");
assert.equal(imported.areas[0].id, "circle", "table export/import preserves the area backing collection");

const player = Entities.projectScene(imported, { role: "player", actorId: "owner" });
assert.ok(player.lionwing.entities["entity-marker"], "owner-visible entity remains in the player projection");
assert.equal(player.lionwing.entities["entity-actor"].backing, null, "hidden actor backing is removed from the player projection");
assert.equal(player.lionwing.entities["entity-actor"].backingHidden, true, "player projection marks hidden backing without leaking its ID");
assert.equal(player.lionwing.entities["entity-hidden"], undefined, "hidden entity is absent from the player projection");
assert.equal(player.actors.some(item => item.id === "secret"), false, "hidden actor backing is absent from the full player scene");
assert.equal(Entities.projectScene(imported, { role: "narrator" }).lionwing.entities["entity-actor"].backing.actorId, "secret", "narrator projection retains hidden backing");

const dangling = copy(normalized);
dangling.lionwing.entities["dangling-entity"] = common("dangling-entity", { areaId: "missing-area" });
assert.throws(() => normalize(dangling), /недопустим|граф|Backing|backing/i, "normalizeScene rejects a dangling entity backing");
const cyclic = copy(normalized);
cyclic.lionwing.entities["entity-marker"].links = [{ id: "cycle-a", type: "anchor", from: "entity-marker", to: "entity-object" }];
cyclic.lionwing.entities["entity-object"].links = [{ id: "cycle-b", type: "anchor", from: "entity-object", to: "entity-marker" }];
assert.throws(() => normalize(cyclic), /недопустим|граф|цикл/i, "normalizeScene rejects a cyclic entity graph");

const sourceLossInput = copy(imported);
sourceLossInput.actors.find(item => item.id === "source").knockedOut = true;
const loss = Entities.sourceLoss(sourceLossInput, { actorId: "source" }, { role: "narrator", eventId: "entity-source-loss" });
const lossReload = normalize(loss.scene);
assert.equal(lossReload.lionwing.entities["entity-marker"].lifecycle, "disabled", "source-loss disable policy survives app-core persistence");
assert.equal(lossReload.lionwing.entities["entity-object"], undefined, "source-loss remove policy survives app-core persistence");
assert.deepEqual(copy(lossReload.lionwing.entities["entity-area"].source), { detachedId: "source" }, "source-loss detach policy survives app-core persistence");
assert.equal(lossReload.lionwing.auras.length, 1, "source-loss persistence does not mutate foreign aura collections");

const legacyRaw = fixture();
legacyRaw.rulesEdition = "ru-v0.9";
legacyRaw.actors = legacyRaw.actors.map(item => ({ ...item, rulesEdition: "ru-v0.9" }));
legacyRaw.lionwing = { entities: { opaque: { forged: true, backing: { hp: 99 } } }, legacyOnly: { value: "keep" } };
const legacy = normalize(legacyRaw);
assert.equal(JSON.stringify(legacy.lionwing), JSON.stringify(legacyRaw.lionwing), "non-LionWing scenes keep legacy lionwing payloads opaque");

console.log("LionWing entities app-core persistence passed: typed actor/marker/object/area/wall backing, hidden and owner projection, reload, export/import, undo snapshots, source-loss policies, dangling/cycle rejection and legacy isolation");
