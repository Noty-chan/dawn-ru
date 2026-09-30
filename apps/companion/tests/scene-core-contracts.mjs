import assert from "node:assert/strict";
import { actor, clone, exactReplay, fixture, packet, rejectedWithoutMutation, runtime, seededRandom, shuffle } from "./helpers/scene-contract-harness.mjs";

const { engine, core, data } = runtime(), ids = engine.ACTION_IDS;
const idConflict = error => error.code === "SCENE_EVENT_ID_CONFLICT";
const invalidPacket = error => error.code === "SCENE_EVENT_PACKET_INVALID";
const command = (id, payload, actorId = "hero") => ({ id, type: "lionwing.command", actorId, payload });

for (const edition of ["ru-v0.9", "lionwing"]) {
  const scene = fixture(edition), valid = edition === "lionwing" ? command("gain", { kind: "resource", operation: "gain", resource: "influence", amount: 1 })
    : { id: "gain", type: "resource.gain", actorId: "hero", payload: { resource: "influence", amount: 1 } };
  const cycle = {}; cycle.self = cycle;
  for (const bad of [null, {}, { ...valid, id: 7 }, { ...valid, actorId: [] }, { ...valid, payload: [] },
    { ...valid, payload: { amount: NaN } }, { ...valid, payload: { amount: Infinity } },
    { ...valid, payload: { callback() {} } }, { ...valid, payload: { cycle } }, { ...valid, payload: { list: new Array(2) } }]) {
    rejectedWithoutMutation(scene, () => engine.dispatchMany(scene, [valid, bad]), invalidPacket);
  }
  rejectedWithoutMutation(scene, () => engine.dispatchMany(scene, null), invalidPacket);
  exactReplay(engine, scene, []);
  rejectedWithoutMutation(scene, () => engine.dispatchMany(scene, [valid, { ...valid, payload: { ...valid.payload, amount: 2 } }]), idConflict);
  const accepted = clone(engine.dispatchMany(scene, [valid], { expectedVersion: 0 }).scene);
  exactReplay(engine, accepted, [valid], { expectedVersion: 0 });
  // JSON object key order and delivery timestamps are not rule changes.
  const reordered = { ...valid, at: "2030-01-01T00:00:00Z", payload: Object.fromEntries(Object.entries(valid.payload).reverse()) };
  exactReplay(engine, accepted, [reordered]);
  for (const changed of [{ ...valid, visibility: "gm" }, { ...valid, sourceActorId: "enemy" }, { ...valid, payload: { ...valid.payload, amount: 2 } }]) {
    rejectedWithoutMutation(accepted, () => engine.dispatchMany(accepted, [changed]), idConflict);
  }
  const projected = engine.projectScene(accepted, { role: "player", actorIds: ["hero"] });
  assert.equal(projected.eventReceipts, undefined, "request payloads cannot leak through a player projection");
  assert.equal(projected.lionwing?.receipts, undefined);
  const failedSecond = edition === "lionwing" ? command("insufficient", { kind: "resource", operation: "spend", resource: "ap", amount: 99 })
    : { id: "insufficient", type: "resource.spend", actorId: "hero", payload: { resource: "ap", amount: 99 } };
  rejectedWithoutMutation(scene, () => engine.dispatchMany(scene, [valid, failedSecond]), /Недостаточно|ОД|ресурс/i);

  // Replay the original attack after defense, damage, reload and a new prompt.
  let battle = fixture(edition); battle.actors[1].x = 2;
  const faces = edition === "lionwing" ? [4, 4, 1] : [4, 4, 1, 1];
  const attack = packet(engine.prepareAction(battle, data, { actorId: "hero", actionId: ids.skirmish, targetIds: ["enemy"], roll: { initialCount: faces.length, rolls: faces, successes: 2, crits: 0 } }), `${edition}:attack`);
  battle = engine.dispatchMany(battle, attack).scene;
  if (edition === "lionwing") {
    battle = engine.dispatchMany(battle, packet(core.prepare(battle, { actorId: "enemy", kind: "reaction", choice: "take" }), `${edition}:defense`)).scene;
    battle = engine.dispatchMany(battle, packet(core.prepare(battle, { actorId: "hero", kind: "resolve-attack" }), `${edition}:resolve`)).scene;
  } else {
    const response = engine.respondReaction(battle, data, { actorId: "enemy", choice: "pass" });
    if (response.events.length) battle = engine.dispatchMany(battle, packet(response, `${edition}:defense`)).scene;
    battle = engine.dispatchMany(battle, packet(engine.resolvePendingAction(battle, data), `${edition}:resolve`)).scene;
  }
  battle = clone(battle);
  battle.pendingPrompt = { id: "next-prompt", kind: "contract-probe", sourceActorId: "enemy", options: ["pass"] };
  exactReplay(engine, battle, attack, { expectedVersion: 0 });
  const forged = clone(attack); forged.at(-1).payload.injected = true;
  rejectedWithoutMutation(battle, () => engine.dispatchMany(battle, forged), idConflict);
}

// Reproducible scheduling probe: five independent tables, each with five
// writers preparing against one version; delayed duplicates and reloads.
// This exercises the real dispatcher, not a mock implementation of its rules.
for (const seed of [1, 17, 904, 20260930]) {
  const random = seededRandom(seed), tables = Array.from({ length: 5 }, (_, table) => {
    const scene = fixture(); scene.id = `table:${table}`;
    scene.actors = Array.from({ length: 5 }, (_, player) => actor(`player:${player}`, "hero", player, 1));
    scene.activeActorId = scene.actors[0].id;
    return { scene, accepted: [] };
  });
  const deliveries = tables.flatMap((_, table) => Array.from({ length: 5 }, (_, player) => ({ table, event: command(`table:${table}:player:${player}:gain`, { kind: "resource", operation: "gain", resource: "influence", amount: 1 }, `player:${player}`), expectedVersion: 0 })));
  for (const delivery of shuffle(deliveries, random)) {
    const table = tables[delivery.table], events = [delivery.event];
    if (table.scene.version !== delivery.expectedVersion) rejectedWithoutMutation(table.scene, () => engine.dispatchMany(table.scene, events, { expectedVersion: delivery.expectedVersion }), /Конфликт версии/);
    table.scene = clone(engine.dispatchMany(table.scene, events, { expectedVersion: table.scene.version }).scene);
    table.accepted.push(delivery);
    // A very late retry still refers to its original version.
    for (const earlier of shuffle(table.accepted, random)) exactReplay(engine, table.scene, [earlier.event], { expectedVersion: earlier.expectedVersion });
  }
  for (const table of tables) {
    assert.equal(table.scene.version, 5, `seed ${seed}: exactly five operations per table`);
    assert.ok(table.scene.actors.every(player => player.influence === 4), `seed ${seed}: each player gains exactly once`);
    for (const delivery of table.accepted) {
      const altered = clone(delivery.event); altered.payload.amount = 100;
      rejectedWithoutMutation(table.scene, () => engine.dispatchMany(table.scene, [altered]), idConflict);
    }
  }
}

// Bounded retained requests; retry correctness outlives the shorter game log.
let retained = fixture();
for (let index = 0; index < 280; index++) retained = engine.dispatchMany(retained, [command(`note:${index}`, { kind: "note", note: `probe ${index}` })]).scene;
assert.equal(retained.lionwing.receipts.length, 256);
assert.ok(!retained.log.some(event => event.id === "note:24"));
exactReplay(engine, clone(retained), [command("note:24", { kind: "note", note: "probe 24" })], { expectedVersion: 24 });
let legacyRetained = fixture("ru-v0.9");
const oldest = { id: "old-gain", type: "resource.gain", actorId: "hero", payload: { resource: "influence", amount: 1 } };
legacyRetained = engine.dispatchMany(legacyRetained, [oldest]).scene;
for (let index = 0; index < 210; index++) legacyRetained = engine.dispatchMany(legacyRetained, [{ ...oldest, id: `legacy-gain:${index}` }]).scene;
assert.ok(!legacyRetained.log.some(event => event.id === oldest.id));
const mixed = engine.dispatchMany(legacyRetained, [oldest, { ...oldest, id: "new-gain" }]);
assert.equal(mixed.scene.actors[0].influence, legacyRetained.actors[0].influence + 1, "a mixed old/new packet skips an accepted request even after its log entry expires");
assert.equal(mixed.scene.version, legacyRetained.version + 1);
console.log("Core packet contracts: both editions, atomic failures, exact retries after full combat/reload, metadata conflicts, four seeds × five tables × five writers, bounded receipts");
