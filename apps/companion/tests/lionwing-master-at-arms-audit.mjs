import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtime, fixture, actor, clone, exactReplay, rejectedWithoutMutation } from "./helpers/scene-contract-harness.mjs";

const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const companionRoot = path.join(testsRoot, "..");
const repoRoot = path.join(companionRoot, "..", "..");
const editionRoot = path.join(repoRoot, "source", "editions", "dawn-en-lionwing-cb2f8e67");
const canonical = JSON.parse(fs.readFileSync(path.join(editionRoot, "extracted-companion.json"), "utf8"));
const sourceMeta = JSON.parse(fs.readFileSync(path.join(repoRoot, "source", "text-sources.json"), "utf8")).sources.en;
const registry = JSON.parse(fs.readFileSync(path.join(companionRoot, "LIONWING-AUTOMATION-REGISTRY.json"), "utf8"));
const uiSource = fs.readFileSync(path.join(companionRoot, "scene-actions-ui.js"), "utf8");

const techniqueRows = new Map(canonical.archetypes.flatMap(archetype => archetype.techniques.flatMap(technique => technique.levels.map(level => [
  `${technique.id}.${level.n}`,
  { archetype, technique, level },
]))));
const levelDigest = ({ archetype, technique, level }) => crypto.createHash("sha256").update(JSON.stringify({
  id: `${technique.id}.${level.n}`,
  archetypeId: archetype.id,
  techniqueId: technique.id,
  name: level.name,
  text: level.text,
  notes: technique.notes,
  source: technique.source,
})).digest("hex");

assert.equal(sourceMeta.id, "dawn-en-lionwing-cb2f8e67");
assert.equal(sourceMeta.editionLabel, "LionWing Edition (Print Beta)");
assert.equal(sourceMeta.pages, 134);
assert.equal(sourceMeta.distribution, "local-only-not-committed");

const detective = techniqueRows.get("vagabond.dim-mak.1");
assert.equal(detective.technique.name, "Detective", "Dim Mak's current LionWing successor is Detective");
assert.equal(detective.technique.previousName, "Dim Mak");
assert.equal(detective.technique.source.pdfPage, 79);
assert.equal(detective.technique.source.editionId, sourceMeta.id);

const master = techniqueRows.get("vagabond.master-at-arms.1");
assert.equal(master.technique.name, "Master-At-Arms");
assert.equal(master.technique.source.pdfPage, 79);
assert.equal(master.technique.source.editionId, sourceMeta.id);
assert.deepEqual(master.technique.levels.map(level => level.name), ["Multi-Faceted", "Like Water", "Master At Work"]);

const expectedDigests = {
  "vagabond.master-at-arms.1": "d35f468065e84fbb0c86bc60015632bdbcfe9b0ced2ed2cfa370453f64a72371",
  "vagabond.master-at-arms.2": "743ae31f60f1a826d3346b6e07c7cff94983860c399cdc9484302e120fd726c4",
  "vagabond.master-at-arms.3": "f104c7652bda2a425422af31d8d91b30515463c98f78892fe25eb204ac7508d3",
};
for (const [id, expectedDigest] of Object.entries(expectedDigests)) {
  const source = techniqueRows.get(id), row = registry.rows.find(item => item.id === id);
  assert.ok(source && row, `${id} has canonical and registry rows`);
  assert.equal(levelDigest(source), expectedDigest, `${id} canonical digest`);
  assert.equal(row.provenance.canonicalDigest, expectedDigest);
  assert.equal(row.implementation.automation, "full");
  assert.ok(row.implementation.rules.some(rule => rule.coverage === "full"), `${id} keeps a full core coverage declaration`);
  assert.equal(row.review.status, "corrected");
  assert.equal(row.review.explicit, true);
}

assert.match(uiSource, /actor\.ruleModes\?\.\["vagabond\.master-at-arms\.armament"\]\?\.modeId/, "the UI reads the authoritative equipped mode");
assert.match(uiSource, /masterFinisherSelection/, "the Master III geometry picker bypasses generic target prompting");

console.log("LionWing Master at Arms audit: Detective successor, page 79 provenance, canonical digests and authoritative UI guard passed");

// Exercise the native command entry point. A canonical registry entry and a
// successful test of an unversioned shared scene cannot prove this route works.
const { core, engine, data } = runtime();
const masterId = "vagabond.master-at-arms", groupId = `${masterId}.armament`;
function fresh() {
  const table = fixture();
  table.actors[0].knownTechniques = { [masterId]: 3 };
  table.actors[0].techniques = {}; // This is how the LionWing hero sheet projects learned levels.
  table.actors[1].x = 5;
  return table;
}
function use(table, request, eventId) {
  const before = clone(table);
  const prepared = core.prepare(table, { kind: "action", actorId: "hero", eventId, ...request }, { random: () => .8 });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  assert.deepEqual(clone(table), before, "preparation and cancellation before commit are free");
  const result = core.dispatchMany(table, prepared.events, { expectedVersion: table.version });
  exactReplay(core, core.reload(JSON.stringify(result.scene)), prepared.events);
  return result.scene;
}
function resolve(table) {
  assert.equal(engine.pendingActionStatus(table, data).waitingIds.length, 0, "NPC without a choice skips reactions");
  // Hero-sheet refresh can again remove legacy technique flags during an attack.
  table = clone(table); table.actors[0].techniques = {};
  const prepared = engine.resolvePendingAction(table, data);
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return engine.dispatchMany(table, prepared.events).scene;
}
let table = fresh();
assert.equal(core.sharedTechniqueRows(table.actors[0]).length, 3);
assert.deepEqual(clone(core.sharedTechniqueRows(table.actors[0]).map(row => row.sourceDigest)), Object.values(expectedDigests));
const original = clone(table);
assert.equal(core.prepare(table, { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, targetIds: ["enemy"] }).ok, false, "generic Skirmish cannot silently bypass an eligible Armament");
assert.deepEqual(clone(table), original);
const invalid = core.prepare(table, { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", targetIds: ["enemy-absent"] });
assert.equal(invalid.ok, false);
assert.deepEqual(clone(table), original);
table = use(table, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", targetIds: ["enemy"], attribute: "talent" }, "master-chain");
assert.equal(table.actors[0].ap, 3);
assert.equal(table.pendingAction.techniqueRuleId, `${masterId}.1`);
table = resolve(table);
assert.ok(table.actors[1].effects.includes("negative.разорван"));
assert.equal(table.actors[0].ruleModes[groupId].modeId, "chain");
assert.equal(core.prepare(table, { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", targetIds: ["enemy"] }).ok, false, "same Armament cannot be equipped twice in the Turn");
table.actors[1].x = 3;
table = use(table, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "blade", targetIds: ["enemy"], attribute: "talent", destination: { x: 2, y: 1 } }, "master-blade");
assert.equal(table.actors[0].x, 2);
table = resolve(table);
assert.equal(table.actors[0].ap, 4, "Like Water grants one AP after the second equip through the native route");
assert.ok(table.actors[0].effects.includes("positive.ускорен"));
assert.equal(table.log.filter(event => event.type === "resource.gain" && event.payload.sourceActionId === `${masterId}.2`).length, 1);

let polearm = fresh();
polearm.actors[1].x = 2;
polearm.actors.push(actor("enemy-two", "enemy", 1, 2));
polearm = use(polearm, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "polearm", targetIds: ["enemy", "enemy-two"], attribute: "talent" }, "master-polearm");
assert.equal(polearm.actors[0].ap, 3);
polearm = resolve(polearm);
assert.equal(polearm.actors[0].ruleModes[groupId].modeId, "polearm");
assert.ok(polearm.actors.slice(1).every(target => target.effects.includes("negative.подброшен")));

// An appearance origin precedes the Armament geometry. It is part of the same
// atomic command, and an invalid second cell must not reveal or charge the hero.
let hidden = fresh();
hidden.actors[0].effects = ["positive.исчез"];
hidden.actors[1].x = 5;
const hiddenRequest = { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, armamentMode: "blade", targetIds: ["enemy"], attribute: "talent", reappearance: { x: 3, y: 1 }, destination: { x: 4, y: 1 } };
assert.equal(core.destinationStatus(hidden, { actorId: "hero", payload: hiddenRequest, field: "reappearance", destination: hiddenRequest.reappearance }).available, true);
assert.equal(core.destinationStatus(hidden, { actorId: "hero", payload: hiddenRequest, field: "destination", destination: hiddenRequest.destination }).available, true);
const hiddenBefore = clone(hidden);
assert.equal(core.prepare(hidden, { ...hiddenRequest, destination: { x: 7, y: 1 } }).ok, false);
assert.equal(core.prepare(hidden, { ...hiddenRequest, reappearance: { x: 4, y: 1 } }).ok, false, "appearance cannot be adjacent to a character");
assert.deepEqual(clone(hidden), hiddenBefore, "failed geometry keeps Disappear and resources");
hidden = use(hidden, hiddenRequest, "master-appearance-blade");
assert.equal(hidden.actors[0].x, 4);
assert.equal(hidden.actors[0].effects.includes("positive.исчез"), false);
assert.equal(hidden.actors[0].ap, 3);
hidden = resolve(hidden);

for (const mode of ["blade", "polearm", "chain"]) {
  let sample = fresh();
  sample.actors[0].ruleModes = { [groupId]: { modeId: mode, sourceDigest: expectedDigests[`${masterId}.1`] } };
  sample.actors[1].x = 2;
  const request = { actionId: engine.ACTION_IDS.finish, attribute: "talent", targetIds: [], focusSpent: 1,
    ...(mode === "blade" ? { destination: { x: 3, y: 1 } } : { areaCenter: { x: 2, y: 1 } }) };
  assert.equal(core.destinationStatus(sample, { actorId: "hero", payload: { kind: "action", ...request }, field: mode === "blade" ? "destination" : "areaCenter", destination: mode === "blade" ? request.destination : request.areaCenter }).available, true, `${mode} is reachable through the board cell validator`);
  const prepared = core.prepare(sample, { kind: "action", actorId: "hero", ...request }, { random: () => .8 });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  rejectedWithoutMutation(sample, () => core.dispatchMany(sample, prepared.events, { expectedVersion: sample.version + 1 }), /Конфликт версии/);
  sample = use(sample, request, `master-finish-${mode}`);
  assert.equal(sample.pendingAction.techniqueRuleId, `${masterId}.3`);
  assert.equal(sample.pendingAction.masterFinisher.modeId, mode);
  assert.equal(sample.actors[0].ap, 1);
  assert.equal(sample.actors[0].focus, 5);
  sample = resolve(sample);
  if (mode === "blade") assert.ok(sample.actors[1].effects.includes("negative.помечен"));
}
console.log("LionWing Master native route: all Armaments/Finishers, learned-level projection, II bonus, board cells, NPC auto-pass, cancellation, reload, replay and version conflict passed");
