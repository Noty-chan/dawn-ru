import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
const engine = loadSceneEngine(context);
const lionwing = context.window.DAWN_LIONWING_ENGINE;
const inventory = context.window.DAWN_LIONWING_INVENTORY;
const adapters = context.window.DAWN_LIONWING_ADAPTERS;
const copy = value => JSON.parse(JSON.stringify(value));
const digest = "lionwing-test-digest-20260909";
let operationSerial = 0;

const makeActor = (id, team = "hero", extra = {}) => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  ownerId: team === "hero" ? "player" : null, rulesEdition: "lionwing", team,
  space: "main", x: team === "hero" ? 1 : 4, y: 1, hp: 16, maxHp: 16,
  ap: 3, baseAp: 3, focus: 3, influence: 2, wounds: 0, stress: 0,
  tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 4, talent: 3, spirit: 3, mind: 5 },
  effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false,
  ruleResources: {}, ruleClocks: {}, knownTechniques: {}, techniques: {}, lionwing: {}, ...extra,
});
const makeScene = (heroExtra = {}) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0,
  activeActorId: null, spaces: [{ id: "main", width: 8, height: 8 }],
  actors: [makeActor("h", "hero", heroExtra), makeActor("e", "enemy")],
  objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [],
  lionwing: { entities: { "source-entity": { id: "source-entity" } } },
});

const direct = (scene, payload, options = {}) => {
  const actorId = options.actorId ?? payload.fromActorId ?? payload.targetId ?? payload.ownerActorId ?? "h";
  const eventId = options.operationId ?? payload.operationId ?? `inventory-test-${++operationSerial}`;
  const events = [];
  const normalizedPayload = payload.kind === "inventory" ? { ...payload, ...(payload.inventoryKind || payload.itemKind || payload.recordKind ? { kind: payload.inventoryKind || payload.itemKind || payload.recordKind } : {}) } : { ...payload, ...(payload.kind ? {} : { kind: payload.inventoryKind || payload.itemKind || payload.recordKind }) };
  return inventory.applyOperation(scene, { ...normalizedPayload, operationId: eventId }, {
    actorId, sourceActorId: options.sourceActorId ?? actorId, role: options.role,
    operationId: eventId, eventId, emit: (type, ownerActorId, value) => events.push({ type, ownerActorId, payload: copy(value) }),
  });
};
const blocked = (fn, matcher) => assert.throws(fn, matcher);
const state = (scene, id = "h") => scene.actors.find(actor => actor.id === id).lionwing.inventory;
const record = (scene, id, itemId, instanceId = null) => state(scene, id).records[instanceId ? `${itemId}#${instanceId}` : itemId];

assert.ok(inventory && inventory.KINDS.includes("selected-item") && inventory.KIND_ALIASES["selected-items"] === "selected-item", "typed inventory API is loaded before the engine");
assert.deepEqual([...inventory.BOUNDARIES], ["scene", "round", "turn", "intermission", "persistent", "manual"]);

// The engine accepts only typed declarations and keeps the old numeric map as
// an exact compatibility projection.
let scene = makeScene();
direct(scene, {
  operation: "configure", targetId: "h", id: "ammo", kind: "charges", label: "Боеприпасы",
  ownerActorId: "h", sourceActorId: "h", sourceEntityId: "source-entity", ruleId: "test.ammo",
  sourceDigest: digest, minimum: 0, maximum: 6, initial: 1, current: 3,
  resetAt: "turn", lifetime: "scene", visibility: "owner",
}, { operationId: "configure-ammo" });
assert.equal(record(scene, "h", "ammo").charges, 3);
assert.equal(scene.actors[0].inventory.ammo, 3);
direct(scene, { operation: "configure", targetId: "h", id: "focus-bound-item", kind: "stack", label: "Фокусируемый предмет", ownerActorId: "h", sourceActorId: "h", ruleId: "test.alternate", sourceDigest: digest, initial: 0, current: 0, maximum: 2, alternateResource: "focus", resetAt: "scene", lifetime: "scene" }, { operationId: "configure-alternate" });
assert.equal(inventory.alternateResourceStatus(scene, "h", { id: "focus-bound-item", amount: 2 }).available, true, "typed definitions can quote an existing alternate resource");
blocked(() => direct(scene, { operation: "configure", targetId: "h", id: "ammo", kind: "charges", ownerActorId: "h", sourceActorId: "h", ruleId: "test.ammo", sourceDigest: digest, minimum: 0, maximum: 7, initial: 1, current: 3, resetAt: "turn", lifetime: "scene" }, { operationId: "forged-max" }), /контракт|происхожд/i);
blocked(() => direct(scene, { operation: "set", targetId: "h", id: "ammo", value: 99 }, { operationId: "forged-balance" }), /границ|значение/i);
blocked(() => direct(scene, { operation: "spend", targetId: "h", id: "ammo", amount: 4 }, { operationId: "overspend" }), /Недостаточно|доступн/i);
assert.equal(record(scene, "h", "ammo").charges, 3, "a rejected overspend leaves the typed record unchanged");
blocked(() => direct(scene, { operation: "gain", targetId: "e", id: "ammo", amount: 1 }, { actorId: "h", operationId: "forged-owner" }), /владелец|принадлежит/i);
blocked(() => direct(scene, { operation: "configure", targetId: "h", id: "old", kind: "stack", sourceDigest: "old-edition-rules" }, { operationId: "old-digest" }), /старой редакции|источник/i);
blocked(() => direct(scene, { operation: "configure", targetId: "h", id: "old-translation", kind: "stack", editionId: "ru-v0.9" }, { operationId: "old-edition" }), /старой редакции/i);

for (const [id, current] of [["cost-a", 2], ["cost-b", 2]]) direct(scene, {
  operation: "configure", targetId: "h", id, kind: "stack", label: id, ownerActorId: "h", sourceActorId: "h",
  ruleId: "test.cost", sourceDigest: digest, initial: 0, current, maximum: 4, resetAt: "manual", lifetime: "scene",
}, { operationId: `configure-${id}` });
const costBefore = copy(scene);
const atomicEvents = [];
blocked(() => inventory.applyCosts(scene, "h", [{ id: "cost-a", amount: 1 }, { id: "cost-b", amount: 3 }], { operationId: "atomic-cost", emit: (...args) => atomicEvents.push(args) }), /Недостаточно/i);
assert.equal(record(scene, "h", "cost-a").count, record(costBefore, "h", "cost-a")?.count ?? 2, "multi-cost rollback restores the first leg");
assert.equal(record(scene, "h", "cost-b").count, 2, "multi-cost rollback restores the failing leg");
assert.equal(atomicEvents.length, 0, "atomic cost rollback does not publish phantom spend events");
blocked(() => inventory.prepareCost(scene, "h", [{ id: "cost-a", amount: 2 }, { id: "cost-a", amount: 1 }], { reservationId: "duplicate-cost" }), /Недостаточно/i);
const reservation = inventory.reserve(scene, "h", [{ id: "cost-a", amount: 1 }, { id: "cost-b", amount: 1 }], { reservationId: "reservation-1" });
assert.equal(reservation.status, "reserved");
blocked(() => direct(scene, { operation: "spend", targetId: "h", id: "cost-a", amount: 2 }, { operationId: "spend-held" }), /Недостаточно/i);
inventory.commitReservation(scene, "h", "reservation-1", { operationId: "commit-reservation", eventId: "commit-reservation" });
assert.deepEqual([record(scene, "h", "cost-a").count, record(scene, "h", "cost-b").count], [1, 1], "reserved costs commit atomically");
const forgedReservationScene = makeScene();
direct(forgedReservationScene, { operation: "configure", targetId: "h", id: "forged-reservation-item", kind: "stack", label: "Проверка резерва", ownerActorId: "h", sourceActorId: "h", ruleId: "test.reservation", sourceDigest: digest, initial: 0, current: 1, maximum: 2, resetAt: "scene", lifetime: "scene" }, { operationId: "forged-reservation-item" });
state(forgedReservationScene).reservations["forged-reservation"] = { id: "forged-reservation", reservationId: "forged-reservation", actorId: "h", costs: [{ itemId: "forged-reservation-item", amount: -99 }], status: "reserved" };
blocked(() => inventory.normalizeScene(forgedReservationScene, { strict: true }), /положительной|стоимость|резерв/i, "forged reservation costs are rejected during strict reload");

// Recorded values and selected items preserve their typed shape. Multiple
// selections intentionally allow repeated entries, as the canonical Verse
// rule does.
direct(scene, { operation: "configure", targetId: "h", id: "cards", kind: "recorded-values", label: "Карты", ownerActorId: "h", sourceActorId: "h", ruleId: "test.cards", sourceDigest: digest, minimum: 1, maximum: 6, resetAt: "scene", lifetime: "scene", visibility: "owner" }, { operationId: "configure-cards" });
direct(scene, { operation: "record", targetId: "h", id: "cards", value: 4, valueId: "card-4" }, { operationId: "record-card-4" });
direct(scene, { operation: "record", targetId: "h", id: "cards", value: 6, valueId: "card-6" }, { operationId: "record-card-6" });
assert.deepEqual(copy(record(scene, "h", "cards").values.map(item => item.value)), [4, 6]);
blocked(() => direct(scene, { operation: "record", targetId: "h", id: "cards", value: 7 }, { operationId: "record-card-7" }), /границ/i);
direct(scene, { operation: "configure", targetId: "h", id: "verses", kind: "selected-items", label: "Куплеты", ownerActorId: "h", sourceActorId: "h", ruleId: "test.verses", sourceDigest: digest, maximum: 4, resetAt: "scene", lifetime: "scene", visibility: "owner", multiple: true, items: ["harsh", "soothing"] }, { operationId: "configure-verses" });
direct(scene, { operation: "select", targetId: "h", id: "verses", selectedItemId: "harsh", mode: "add" }, { operationId: "select-harsh-1" });
direct(scene, { operation: "select", targetId: "h", id: "verses", selectedItemId: "harsh", mode: "add" }, { operationId: "select-harsh-2" });
assert.deepEqual(copy(record(scene, "h", "verses").selectedItems), ["harsh", "harsh"]);
blocked(() => direct(scene, { operation: "select", targetId: "h", id: "verses", selectedItemId: "soothing", selectedItems: ["harsh", "harsh", "soothing", "soothing", "harsh"] }, { operationId: "select-too-many" }), /максимум|границ/i);

// Replacement levels and unique multiple instances have one authoritative
// definition and never leave a lower-level active record behind.
direct(scene, { operation: "configure", targetId: "h", id: "weapon-low", kind: "stack", label: "Старое оружие", ownerActorId: "h", sourceActorId: "h", ruleId: "test.weapon", sourceDigest: digest, initial: 1, current: 1, maximum: 2, replacementGroup: "weapon", level: 1, resetAt: "scene", lifetime: "scene" }, { operationId: "weapon-low" });
direct(scene, { operation: "configure", targetId: "h", id: "weapon-high", kind: "stack", label: "Старшее оружие", ownerActorId: "h", sourceActorId: "h", ruleId: "test.weapon", sourceDigest: digest, initial: 1, current: 1, maximum: 2, replacementGroup: "weapon", level: 2, resetAt: "scene", lifetime: "scene" }, { operationId: "weapon-high" });
assert.equal(state(scene).definitions["weapon-low"].active, false);
assert.equal(state(scene).records["weapon-low"], undefined);
assert.equal(scene.actors[0].inventory["weapon-low"], undefined, "replacing a typed record clears its compatibility mirror");
blocked(() => direct(scene, { operation: "configure", targetId: "h", id: "weapon-low", kind: "stack", ownerActorId: "h", sourceActorId: "h", ruleId: "test.weapon", sourceDigest: digest, initial: 1, current: 1, maximum: 2, replacementGroup: "weapon", level: 1, resetAt: "scene", lifetime: "scene" }, { operationId: "weapon-low-again" }), /замены/i);
direct(scene, { operation: "configure", targetId: "h", id: "unique-token", instanceId: "one", kind: "count", label: "Уникальный жетон", ownerActorId: "h", sourceActorId: "h", ruleId: "test.unique", sourceDigest: digest, initial: 0, current: 1, maximum: 3, multiple: true, unique: true, resetAt: "scene", lifetime: "scene" }, { operationId: "unique-one" });
blocked(() => direct(scene, { operation: "configure", targetId: "h", id: "unique-token", instanceId: "two", kind: "count", ownerActorId: "h", sourceActorId: "h", ruleId: "test.unique", sourceDigest: digest, initial: 0, current: 1, maximum: 3, multiple: true, unique: true, resetAt: "scene", lifetime: "scene" }, { operationId: "unique-two" }), /уникаль/i);

// Every declared lifetime is independent; persistent state crosses a Scene
// reset while selected and recorded values are cleared at their boundary.
for (const [id, resetAt, lifetime, initial, current] of [
  ["turn-item", "turn", "scene", 0, 2], ["round-item", "round", "scene", 0, 2],
  ["intermission-item", "intermission", "scene", 0, 2], ["persistent-item", "scene", "persistent", 1, 4],
]) direct(scene, { operation: "configure", targetId: "h", id, kind: "stack", label: id, ownerActorId: "h", sourceActorId: "h", ruleId: "test.boundary", sourceDigest: digest, initial, current, maximum: 9, resetAt, lifetime }, { operationId: `configure-${id}` });
assert.equal(inventory.resetActor(scene.actors[0], "turn").length, 2);
assert.deepEqual([record(scene, "h", "turn-item").count, record(scene, "h", "round-item").count], [0, 2]);
inventory.resetActor(scene.actors[0], "round");
inventory.resetActor(scene.actors[0], "intermission");
assert.deepEqual([record(scene, "h", "round-item").count, record(scene, "h", "intermission-item").count], [0, 0]);
direct(scene, { operation: "configure", targetId: "h", id: "reset-reservation-item", kind: "stack", label: "Резерв на сброс", ownerActorId: "h", sourceActorId: "h", ruleId: "test.boundary", sourceDigest: digest, initial: 0, current: 1, maximum: 2, resetAt: "round", lifetime: "scene" }, { operationId: "configure-reset-reservation" });
inventory.reserve(scene, "h", [{ id: "reset-reservation-item", amount: 1 }], { reservationId: "reset-reservation" });
inventory.resetActor(scene.actors[0], "round");
assert.equal(state(scene).reservations["reset-reservation"].status, "cancelled", "a boundary reset cancels reservations that refer to reset records");
inventory.resetScene(scene);
assert.equal(record(scene, "h", "persistent-item").count, 4);
assert.equal(record(scene, "h", "turn-item"), undefined);
assert.equal(scene.actors[0].inventory["turn-item"], undefined, "Scene reset removes stale legacy inventory keys");
assert.equal(record(scene, "h", "verses"), undefined);

// Journal IDs are idempotent and conflict-safe. Undo can remove a newly
// created definition, and a strict JSON reload/import keeps the same shape.
let journalScene = makeScene();
direct(journalScene, { operation: "configure", targetId: "h", id: "journal-item", kind: "stack", label: "Журнал", ownerActorId: "h", sourceActorId: "h", ruleId: "test.journal", sourceDigest: digest, initial: 1, current: 1, maximum: 4, resetAt: "scene", lifetime: "scene" }, { operationId: "journal-config" });
direct(journalScene, { operation: "gain", targetId: "h", id: "journal-item", amount: 1 }, { operationId: "journal-gain" });
const duplicate = direct(journalScene, { operation: "gain", targetId: "h", id: "journal-item", amount: 1 }, { operationId: "journal-gain" });
assert.equal(duplicate.duplicate, true);
blocked(() => direct(journalScene, { operation: "gain", targetId: "h", id: "journal-item", amount: 2 }, { operationId: "journal-gain" }), /Конфликт ID|повтор/i);
const replay = inventory.replay(journalScene, { operationId: "journal-gain", targetId: "h", operation: "gain", id: "journal-item", amount: 1 }, { actorId: "h", sourceActorId: "h" });
assert.equal(replay.idempotent, true);
inventory.undo(journalScene, "journal-gain", { actorId: "h" });
assert.equal(record(journalScene, "h", "journal-item").count, 1);
const newJournalScene = makeScene();
direct(newJournalScene, { operation: "configure", targetId: "h", id: "undo-item", kind: "stack", label: "Undo", ownerActorId: "h", sourceActorId: "h", ruleId: "test.undo", sourceDigest: digest, initial: 0, current: 1, maximum: 2, resetAt: "scene", lifetime: "scene" }, { operationId: "undo-config" });
inventory.undo(newJournalScene, "undo-config", { actorId: "h" });
assert.equal(newJournalScene.actors[0].lionwing.inventory, undefined, "undo removes a newly created typed registry");
const exported = inventory.exportInventory(scene, { role: "narrator" });
const importedScene = makeScene();
inventory.importInventory(importedScene, exported, { role: "narrator" });
assert.deepEqual(copy(inventory.project(importedScene, { role: "narrator" })), copy(inventory.project(scene, { role: "narrator" })));

// Visibility and source ownership are applied at projection and transfer
// boundaries; reservations and journal receipts remain narrator-only.
const publicScene = makeScene();
for (const [id, visibility] of [["public-item", "public"], ["private-item", "owner"], ["hidden-item", "hidden"]]) direct(publicScene, { operation: "configure", targetId: "h", id, kind: "stack", label: id, ownerActorId: "h", sourceActorId: "h", ruleId: "test.visibility", sourceDigest: digest, initial: 0, current: 1, maximum: 2, resetAt: "scene", lifetime: "scene", visibility }, { operationId: `visibility-${id}` });
inventory.reserve(publicScene, "h", [{ id: "public-item", amount: 1 }], { reservationId: "visibility-reserve" });
const ownerProjection = inventory.project(publicScene, { role: "owner", actorIds: ["h"] }).h;
const foreignProjection = inventory.project(publicScene, { role: "owner", actorIds: ["e"] }).h;
const narratorProjection = inventory.project(publicScene, { role: "narrator" }).h;
assert.deepEqual(Object.keys(ownerProjection.definitions).sort(), ["private-item", "public-item"]);
assert.deepEqual(Object.keys(foreignProjection.definitions), ["public-item"]);
assert.equal(ownerProjection.journal, undefined);
assert.ok(narratorProjection.journal && narratorProjection.reservations);

const transferScene = makeScene();
transferScene.actors[0].inventory = { "legacy-potion": 2 };
direct(transferScene, { operation: "configure", targetId: "h", id: "trade", kind: "stack", label: "Передаваемый ресурс", ownerActorId: "h", sourceActorId: "h", ruleId: "test.transfer", sourceDigest: digest, initial: 0, current: 2, maximum: 3, resetAt: "scene", lifetime: "scene" }, { operationId: "trade-config" });
direct(transferScene, { operation: "configure", targetId: "e", id: "trade", kind: "stack", label: "Передаваемый ресурс", ownerActorId: "e", sourceActorId: "h", ruleId: "test.transfer", sourceDigest: digest, initial: 0, current: 1, maximum: 3, resetAt: "scene", lifetime: "scene" }, { actorId: "h", sourceActorId: "h", role: "narrator", operationId: "trade-recipient-config" });
direct(transferScene, { operation: "transfer", id: "trade", fromActorId: "h", toActorId: "e", amount: 1 }, { actorId: "h", operationId: "trade-transfer" });
assert.equal(record(transferScene, "h", "trade").count, 1);
assert.equal(record(transferScene, "e", "trade").count, 2, "transfer adds to an existing compatible recipient record");
inventory.reserve(transferScene, "e", [{ id: "trade", amount: 1 }], { reservationId: "source-removal-reservation" });
assert.equal(inventory.removeSource(transferScene, "h").length, 2);
assert.equal(record(transferScene, "e", "trade"), undefined);
assert.equal(state(transferScene, "e").reservations["source-removal-reservation"].status, "cancelled", "source removal cancels reservations for removed records");
assert.equal(transferScene.actors[0].inventory["legacy-potion"], 2, "source cleanup leaves unrelated legacy inventory entries intact");

// Adapter declarations are opt-in and canonical-anchored. The independent
// inventory slices all materialize through the same typed operations.
const canonicalDigests = {
  "altruist.gourmand.1": "d7dabbe3ac7be7d0ded9c75f214be072cd634c54e318455cbd28f6e02d401d73",
  "vagabond.malicious-mimic.1": "869edd09e775c11dce1b8a01408870c2841d5970e28544d2380ddcb6752718dd",
  "altruist.surgeon.2": "701325c8c91817a0ec796973befba9c45e3230ac5670fbb3271dbc3ff54ea40a",
  "altruist.deckbuilder.1": "4cc9dcace6206469b673302c5793c819f54edd9bbc31090aea4b22a016ef6b0b",
  "altruist.deckbuilder.2": "e6c003921a7f4ac2390ae9b65fe104c443f63dedf9df50505bce49285e2b0d6a",
  "altruist.bardic-savant.1": "896edba28e9a933577bd1956f94da01f4f6beadc1452a5d4c52ac3e4038a5486",
  "ruiner.mana-blades.1": "eacb55ca05c443bfe0782ea2a16415a37749691da1166a9298433934ae40257a",
  "ruiner.long-draw.1": "16797d24282b090cf8d8967f8c6b48cdb67d5e95fc30f3c456a0a786954da4d9",
};
const canonicalDir = new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/", import.meta.url);
const canonicalTechniques = fs.readdirSync(canonicalDir).filter(file => file.endsWith(".json")).flatMap(file => JSON.parse(fs.readFileSync(new URL(file, canonicalDir), "utf8")).techniques);
const canonicalDigest = ruleId => {
  const techniqueId = ruleId.replace(/\.\d+$/u, ""), levelNumber = Number(ruleId.match(/(\d+)$/u)[1]);
  const technique = canonicalTechniques.find(item => item.id === techniqueId), level = technique?.levels.find(item => item.n === levelNumber);
  assert.ok(technique && level, `canonical EN source contains ${ruleId}`);
  return crypto.createHash("sha256").update(JSON.stringify({ id: ruleId, archetypeId: technique.archetypeId, techniqueId: technique.id, name: level.name, text: level.text, notes: technique.notes, source: technique.source })).digest("hex");
};
const chosen = Object.keys(canonicalDigests);
const adapterHero = makeActor("h", "hero", {
  knownTechniques: Object.fromEntries(chosen.map(id => [id.replace(/\.\d+$/u, ""), Number(id.match(/(\d+)$/u)[1])])),
  lionwing: { automation: Object.fromEntries(chosen.map(id => [id, true])) },
});
const adapterScene = makeScene();
adapterScene.actors[0] = adapterHero;
for (const ruleId of chosen) {
  const rule = adapters.list(adapterHero).find(item => item.id === ruleId);
  assert.ok(rule, `${ruleId} is available at its known level`);
  assert.equal(rule.sourceDigest, canonicalDigests[ruleId]);
  assert.equal(rule.sourceDigest, canonicalDigest(ruleId), `${ruleId} uses the current canonical EN digest`);
  assert.equal(rule.coverage, "partial");
  const boundary = adapters.boundaryOperations(adapterHero, { scene: adapterScene, boundary: "sceneStart" }).find(item => item.id === ruleId);
  if (boundary) for (const operation of boundary.operations) direct(adapterScene, operation, { operationId: `adapter-${ruleId}-${operation.id}` });
}
assert.equal(record(adapterScene, "h", "altruist.gourmand.meals").count, 3);
assert.equal(record(adapterScene, "h", "altruist.surgeon.bandages").count, 0);
assert.equal(record(adapterScene, "h", "altruist.surgeon.disinfectant").count, 0);
direct(adapterScene, { operation: "gain", targetId: "h", id: "altruist.surgeon.bandages", amount: 2 }, { operationId: "adapter-bandages-gain" });
direct(adapterScene, { operation: "spend", targetId: "h", id: "altruist.surgeon.bandages", amount: 1 }, { operationId: "adapter-bandages-spend" });
direct(adapterScene, { operation: "record", targetId: "h", id: "altruist.deckbuilder.cards", value: 5, valueId: "adapter-card" }, { operationId: "adapter-card-record" });
direct(adapterScene, { operation: "record", targetId: "h", id: "altruist.deckbuilder.captured-card", value: 2, valueId: "adapter-captured" }, { operationId: "adapter-captured-record" });
direct(adapterScene, { operation: "select", targetId: "h", id: "ruiner.mana-blades.arsenal", selectedItemId: "weapon.test", mode: "add" }, { operationId: "adapter-arsenal-select" });
direct(adapterScene, { operation: "gain", targetId: "h", id: "ruiner.mana-blades.forges", amount: 1 }, { operationId: "adapter-forge-gain" });
direct(adapterScene, { operation: "gain", targetId: "h", id: "ruiner.long-draw.prep", amount: 1 }, { operationId: "adapter-prep-gain" });
direct(adapterScene, { operation: "spend", targetId: "h", id: "ruiner.long-draw.prep", amount: 1 }, { operationId: "adapter-prep-spend" });
assert.deepEqual(copy(record(adapterScene, "h", "altruist.deckbuilder.cards").values.map(item => item.value)), [5]);
assert.deepEqual(copy(record(adapterScene, "h", "ruiner.mana-blades.arsenal").selectedItems), ["weapon.test"]);
assert.equal(record(adapterScene, "h", "ruiner.mana-blades.forges").count, 1);
assert.equal(record(adapterScene, "h", "ruiner.long-draw.prep").charges, 0);
const offScene = makeScene({ knownTechniques: { "altruist.gourmand": 1 }, lionwing: {} });
const offResult = lionwing.dispatchMany(offScene, [{ ...lionwing.command("h", { kind: "turn-start" }), id: "inventory-opt-in-off" }]);
assert.equal(offResult.scene.actors[0].lionwing.inventory, undefined, "a known Technique stays manual until opt-in is enabled");

// Scene boundary scheduling uses the same adapter declarations and the
// Intermission operation resets only records whose contract says so.
const engineScene = makeScene({
  knownTechniques: { "altruist.gourmand": 1, "ruiner.long-draw": 1 },
  lionwing: { automation: { "altruist.gourmand.1": true, "ruiner.long-draw.1": true } },
});
const started = lionwing.dispatchMany(engineScene, [{ ...lionwing.command("h", { kind: "turn-start" }), id: "inventory-boundary-start" }]).scene;
assert.equal(record(started, "h", "altruist.gourmand.meals").count, 3);
direct(started, { operation: "spend", targetId: "h", id: "altruist.gourmand.meals", amount: 1 }, { operationId: "meal-spend-before-intermission" });
const intermission = lionwing.dispatchMany(started, [{ ...lionwing.command(null, { kind: "intermission" }), id: "inventory-boundary-intermission" }]).scene;
assert.equal(record(intermission, "h", "altruist.gourmand.meals").count, 3);

const privateEventScene = makeScene();
const privateEventResult = lionwing.dispatchMany(privateEventScene, [{
  ...lionwing.command("h", { kind: "inventory", operation: "configure", targetId: "h", id: "private-event-item", inventoryKind: "stack", label: "Скрытая запись", ownerActorId: "h", sourceActorId: "h", ruleId: "test.private-event", sourceDigest: digest, initial: 0, current: 1, maximum: 2, visibility: "owner", resetAt: "scene", lifetime: "scene" }),
  id: "private-event-configure",
}]);
assert.equal(privateEventResult.events.find(event => event.type === "inventory.configure")?.visibility, "gm", "private inventory receipts never enter the public event stream");

// Mimic creates a named count instance, and Bardic choices are typed selected
// items. The router supplies the once-per-round key; the engine remains the
// writer for both operations.
const mimicActor = makeActor("m", "hero", { knownTechniques: { "vagabond.malicious-mimic": 1 }, lionwing: { automation: { "vagabond.malicious-mimic.1": true } } });
const mimicScene = makeScene();
mimicScene.actors[0] = mimicActor;
mimicScene.actors.push(makeActor("npc", "enemy", { name: "Goblin" }));
mimicScene.pendingAction = { actorId: "npc" };
const mimicTrigger = adapters.afterEvent(mimicActor, { id: "reaction-1", type: "reaction.respond", actorId: "m", payload: { choice: "dodge" } }, { scene: mimicScene });
assert.equal(mimicTrigger.length, 1);
direct(mimicScene, mimicTrigger[0].operations[0], { actorId: "m", operationId: "mimic-impression" });
assert.equal(record(mimicScene, "m", "impression", "Goblin").count, 1);
const bardActor = makeActor("b", "hero", { knownTechniques: { "altruist.bardic-savant": 1 }, lionwing: { automation: { "altruist.bardic-savant.1": true } } });
const bardScene = makeScene();
bardScene.actors[0] = bardActor;
const bardBoundary = adapters.boundaryOperations(bardActor, { scene: bardScene, boundary: "sceneStart" }).find(item => item.id === "altruist.bardic-savant.1");
direct(bardScene, bardBoundary.operations[0], { operationId: "bard-verses-configure" });
const bardTrigger = adapters.afterEvent(bardActor, { id: "breathe-1", type: "action.resolve", actorId: "b", payload: { actionId: "action.утилитарные-действия.передышка" } }, { scene: bardScene });
assert.equal(bardTrigger[0].choices.length, 5);
direct(bardScene, bardTrigger[0].choices[0].operations[0], { actorId: "b", operationId: "bard-verse-choice" });
assert.deepEqual(copy(record(bardScene, "b", "altruist.bardic-savant.verses").selectedItems), ["harsh"]);

// The player network surface can only spend or transfer an existing owned
// record. Acquisition and mutable record contents require an authoritative
// rule event or a Narrator operation.
const networkSource = fs.readFileSync(new URL("../network-v2.js", import.meta.url), "utf8");
vm.runInContext(networkSource, context, { filename: "network-v2.js" });
const network = context.window.DAWN_NETWORK_V2;
const networkScene = makeScene();
direct(networkScene, { operation: "configure", targetId: "h", id: "network-item", kind: "stack", label: "Сетевой ресурс", ownerActorId: "h", sourceActorId: "h", ruleId: "test.network", sourceDigest: digest, initial: 0, current: 2, maximum: 3, resetAt: "scene", lifetime: "scene" }, { operationId: "network-config" });
const networkEvents = network.materializeIntent(networkScene, {}, { kind: "lionwing", actorId: "h", request: { kind: "inventory", operation: "spend", id: "network-item", amount: 1 } }, "player", { sceneEngine: lionwing });
assert.equal(networkEvents[0].type, "lionwing.command");
const networkAfter = lionwing.dispatchMany(networkScene, networkEvents).scene;
assert.equal(record(networkAfter, "h", "network-item").count, 1);
blocked(() => network.materializeIntent(networkScene, {}, { kind: "lionwing", actorId: "h", request: { kind: "inventory", operation: "configure", id: "network-item", maximum: 999 } }, "player", { sceneEngine: lionwing }), /только расходовать|операция/i);
for (const operation of ["gain", "add", "remove", "select"]) blocked(
  () => network.materializeIntent(networkScene, {}, { kind: "lionwing", actorId: "h", request: { kind: "inventory", operation, id: "network-item", amount: 1, selectedItemId: "forged" } }, "player", { sceneEngine: lionwing }),
  /только расходовать|подтверждает ядро|Нарратор/i,
);
blocked(() => network.materializeIntent(networkScene, {}, { kind: "lionwing", actorId: "h", request: { kind: "inventory", operation: "spend", id: "network-item", targetId: "e", amount: 1 } }, "player", { sceneEngine: lionwing }), /чуж|владель/i);
blocked(() => inventory.applyOperation(networkScene, { operation: "gain", targetId: "h", id: "network-item", amount: 1 }, { actorId: "h", sourceActorId: "h", role: "player", operationId: "forged-direct-gain" }), /подтверждает ядро|Нарратор/i);

// Static UI checks exercise the rendered controls and their lock reason. The
// A player sees spend, while the gain control is reserved for the Narrator.
const uiSource = fs.readFileSync(new URL("../lionwing-ui.js", import.meta.url), "utf8");
const uiHelper = uiSource.slice(uiSource.indexOf("function lwInventoryHtml"), uiSource.indexOf("function lwActionsHtml"));
const uiContext = {
  window: { DAWN_LIONWING_INVENTORY: { project: () => ({ h: { definitions: { ammo: { id: "ammo", kind: "stack", label: "Боеприпасы", maximum: 3 } }, records: { ammo: { definitionId: "ammo", count: 1 } } } }), readNumeric: recordValue => recordValue.count, status: (_scene, _actor, payload) => ({ available: payload.operation === "gain", reason: payload.operation === "spend" ? "Недостаточно Боеприпасов" : "" }) } },
  Scene: { actors: [{ id: "h" }] }, lwCanNarrate: () => false, lwOwns: id => id === "h", esc: value => String(value),
};
vm.createContext(uiContext);
vm.runInContext(`${uiHelper}\nthis.renderInventory = lwInventoryHtml;`, uiContext);
const uiHtml = uiContext.renderInventory({ id: "h", lionwing: { inventory: { records: { ammo: {} } } } });
assert.doesNotMatch(uiHtml, /data-lw-inventory="gain"/);
assert.match(uiHtml, /data-lw-inventory="spend"[^>]+disabled/);
assert.match(uiHtml, /Недостаточно Боеприпасов/);
assert.doesNotMatch(uiHtml, /data-lw-(?:journal|receipt)/i);
assert.match(uiSource, /kind:"inventory",operation,id,amount/);

uiContext.lwCanNarrate = () => true;
const narratorHtml = uiContext.renderInventory({ id: "h", lionwing: { inventory: { records: { ammo: {} } } } });
assert.match(narratorHtml, /data-lw-inventory="gain"/);

console.log("LionWing inventory: typed records, atomic costs, boundaries, provenance, replacement, visibility, transfer, adapters, network and UI passed");
