import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
