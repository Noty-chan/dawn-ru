import assert from "node:assert/strict";
import { runtime, fixture, actor, clone } from "./helpers/scene-contract-harness.mjs";

const { core, engine, context } = runtime();
const info = context.window.DAWN_LIONWING_INFORMATION_QUERY;
const entities = context.window.DAWN_LIONWING_ENTITIES;
const inventory = context.window.DAWN_LIONWING_INVENTORY;
let full = core.reload(fixture());
full.actors[0].ap = 8;
full.actors[0].knownTechniques = { "powerhouse.predator": 1 };
full = engine.dispatch(full, { id: "projection-enable-predator", type: "lionwing.command", actorId: "hero",
  payload: { kind: "automation", ruleId: "powerhouse.predator.1", enabled: true } }).scene;
const study = core.prepare(full, { actorId: "hero", kind: "action", actionId: engine.ACTION_IDS.study, attribute: "mind", targetIds: ["enemy"] });
assert.equal(study.ok, true, study.errors?.join(" "));
full = engine.dispatchMany(full, study.events.map((event, index) => ({ ...event, id: `projection-study-${index}` }))).scene;
assert.equal(info.studyCount(full, { actorId: "hero", scope: "scene" }), 1);
assert.deepEqual(clone(info.availableCategories(full, full.lionwing.information.studies[0]).map(item => item.id)), ["health"]);
assert.equal(info.handout(full, { id: "projection-owner-health", actorId: "hero", targetId: "enemy", category: "health",
  value: { current: 10, maximum: 30 }, visibility: "player", ownerActorId: "hero" }, { role: "narrator" }).ok, true);
assert.equal(info.handout(full, { id: "projection-narrator-secret", actorId: "hero", targetId: "enemy", category: "custom",
  value: "NARRATOR_ONLY_INFORMATION", visibility: "narrator" }, { role: "narrator" }).ok, true);
full.actors.push(actor("projection-secret-actor", "enemy", 7, 5, { hidden: true }));
full = entities.create(full, { id: "projection-secret-entity", kind: "summon", ownerActorId: "hero",
  source: { actorId: "hero" }, rule: "manual.entity", backing: { actorId: "projection-secret-actor" },
  lifetime: { boundary: "scene" }, visibility: "hidden" }, { role: "narrator", eventId: "projection-private-entity-receipt" }).scene;
inventory.applyOperation(full, { operation: "configure", targetId: "hero", id: "projection-ammo", kind: "charges", label: "Ammo",
  minimum: 0, maximum: 6, initial: 3, current: 3, visibility: "owner", lifetime: "scene", resetAt: "manual" },
{ actorId: "hero", sourceActorId: "hero", role: "narrator", eventId: "projection-private-inventory-journal" });
inventory.applyOperation(full, { operation: "configure", targetId: "enemy", id: "projection-secret-inventory", kind: "charges", label: "Hidden ammo",
  minimum: 0, maximum: 99, initial: 37, current: 37, visibility: "narrator", lifetime: "scene", resetAt: "manual" },
{ actorId: "enemy", sourceActorId: "enemy", role: "narrator", eventId: "projection-secret-inventory-journal" });
inventory.applyOperation(full, { operation: "configure", targetId: "hero", id: "projection-hidden-own-inventory", kind: "charges", label: "Hidden own record",
  minimum: 0, maximum: 6, initial: 3, current: 3, visibility: "narrator", lifetime: "scene", resetAt: "manual" },
{ actorId: "hero", sourceActorId: "hero", role: "narrator", eventId: "projection-hidden-own-journal" });
inventory.reserve(full, "hero", [{ itemId: "projection-ammo", amount: 1 }], {
  reservationId: "projection-ammo-reservation", operationId: "PRIVATE_RESERVATION_OPERATION", createdAt: "PRIVATE_RESERVATION_DATE" });
inventory.reserve(full, "hero", [{ itemId: "projection-ammo", amount: 1 }, { itemId: "projection-hidden-own-inventory", amount: 2 }], {
  reservationId: "projection-mixed-reservation", operationId: "PRIVATE_MIXED_RESERVATION_OPERATION" });
inventory.reserve(full, "enemy", [{ itemId: "projection-secret-inventory", amount: 5 }], {
  reservationId: "projection-private-reservation", operationId: "PRIVATE_HIDDEN_RESERVATION_OPERATION" });

const request = { actorId: "hero", kind: "action", actionId: engine.ACTION_IDS.jump, attribute: "talent", destination: { x: 2, y: 1 } };
for (const role of ["player", "narrator", "owner"]) {
  const viewer = { role, actorId: "hero" }, sourceBefore = clone(full);
  const projected = engine.projectScene(full, viewer);
  assert.deepEqual(clone(full), sourceBefore, `${role}: projecting cannot normalize or mutate the authority scene`);
  if (role === "player") {
    const json = JSON.stringify(projected);
    for (const privateValue of ["NARRATOR_ONLY_INFORMATION", "projection-secret-entity", "projection-secret-actor", "projection-private-entity-receipt", "projection-private-inventory-journal", "projection-secret-inventory", "projection-hidden-own-inventory", "projection-private-reservation", "PRIVATE_RESERVATION_OPERATION", "PRIVATE_RESERVATION_DATE", "PRIVATE_HIDDEN_RESERVATION_OPERATION", "PRIVATE_MIXED_RESERVATION_OPERATION"])
      assert.ok(!json.includes(privateValue), `player projection must not disclose ${privateValue}`);
    assert.equal(projected.lionwing.receipts, undefined);
    assert.equal(projected.lionwing.history, undefined);
    assert.equal(projected.lionwing.entityReceipts, undefined);
  }
  for (const snapshot of [projected, core.reload(JSON.stringify(projected))]) {
    const before = clone(snapshot);
    const stock = inventory.status(snapshot, "hero", { id: "projection-ammo", operation: "spend", amount: 2 });
    assert.equal(stock.current, 3);
    assert.equal(stock.reserved, 2, `${role}: visible reservations survive projection/reload`);
    assert.equal(stock.availableAmount, 1);
    assert.equal(stock.available, false, `${role}: a projection cannot offer inventory already held by a pending operation`);
    assert.equal(inventory.status(snapshot, "hero", { id: "projection-ammo", operation: "spend", amount: 1 }).available, true);
    assert.deepEqual(clone(snapshot), before, `${role}: inventory status normalizes a copy`);
    const prepared = core.prepare(snapshot, request);
    assert.equal(prepared.ok, true, `${role}: projected action preview: ${prepared.errors?.join(" ")}`);
    const destination = core.destinationStatus(snapshot, { actorId: "hero", field: "destination", destination: request.destination,
      payload: { kind: "action", actionId: request.actionId, attribute: request.attribute } });
    assert.equal(destination.available, true, `${role}: projected destination query: ${destination.reason}`);
    const html = info.panel(snapshot, viewer);
    assert.match(html, /Изучение/);
    if (role === "player") assert.doesNotMatch(html, /NARRATOR_ONLY_INFORMATION/);
    for (const scope of ["turn", "round", "scene", "chapter"])
      assert.equal(info.studyCount(snapshot, { actorId: "hero", scope }), info.studyCount(full, { actorId: "hero", scope }), `${role}: ${scope} Study count survives projection/reload`);
    assert.deepEqual(clone(info.availableCategories(snapshot, snapshot.lionwing.information.studies[0]).map(item => item.id)), ["health"], `${role}: projection preserves the canonical restricted categories`);
    assert.equal(info.facts(snapshot, { category: "health" }, viewer).length, 1, `${role}: the owner's visible health fact remains queryable`);
    assert.deepEqual(clone(snapshot), before, `${role}: preview, destination and information UI are read-only`);
    const again = engine.projectScene(snapshot, viewer);
    assert.equal(again.lionwing.information.facts.filter(fact => fact.category === "health").length, 1, `${role}: reproject retains the owner's fact`);
    assert.equal(again.lionwing.information.handouts.filter(fact => fact.category === "health").length, 1, `${role}: reproject retains handout identity`);
    assert.deepEqual(clone(snapshot), before, `${role}: reproject does not mutate its input`);
  }
}
const player = engine.projectScene(full, { role: "player", actorId: "hero" });
assert.equal(info.project(player, { role: "player", actorId: "other" }).studies.length, 1, "a public Study remains public after projection");
assert.equal(info.facts(player, {}, { role: "player", actorId: "other" }).length, 0, "a private health fact remains restricted to its owner");
console.log("LionWing projection previews: player/narrator/owner prepare, destinations, information UI, reload/reproject and private containers passed");
