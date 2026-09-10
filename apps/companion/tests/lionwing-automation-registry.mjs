import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(root, "..");
const registry = JSON.parse(fs.readFileSync(path.join(appRoot, "LIONWING-AUTOMATION-REGISTRY.json"), "utf8"));
const canonical = JSON.parse(fs.readFileSync(path.join(appRoot, "..", "..", "source", "editions", "dawn-en-lionwing-cb2f8e67", "extracted-companion.json"), "utf8"));
const canonicalById = new Map(canonical.archetypes.flatMap(archetype => archetype.techniques.flatMap(technique => technique.levels.map(level => [
  `${technique.id}.${level.n}`,
  { archetypeId: archetype.id, technique, level },
]))));
const digest = (techniqueId, level, technique, archetypeId) => crypto.createHash("sha256").update(JSON.stringify({
  id: `${techniqueId}.${level.n}`,
  archetypeId,
  techniqueId,
  name: level.name,
  text: level.text,
  notes: technique.notes,
  source: technique.source,
})).digest("hex");

assert.equal(registry.schemaVersion, 1);
assert.equal(registry.editionId, "dawn-en-lionwing-cb2f8e67");
assert.equal(registry.rows.length, 333, "registry must have one row per canonical level");
assert.equal(new Set(registry.rows.map(row => row.id)).size, registry.rows.length, "registry ids must be unique");
assert.equal(registry.rows.some(row => row.id.includes("servant-s-call")), false, "removed Servant's Call must stay out");

const explicit = registry.rows.filter(row => row.review.explicit).map(row => row.id).sort();
assert.deepEqual(explicit, [
  "vagabond.dim-mak.1",
  "vagabond.dim-mak.2",
  "ruiner.cryomancer.2",
  "ruiner.grim-ascendant.2",
  "altruist.empath.3",
  "vagabond.assassin.3",
  "vagabond.opportunist.1",
  "vagabond.opportunist.2",
  "vagabond.opportunist.3",
].sort());
for (const row of registry.rows) {
  for (const key of ["implementation", "provenance", "review", "surfaces", "certification"]) assert.equal(typeof row[key], "object", `${row.id} has ${key}`);
  const source = canonicalById.get(row.id);
  assert.ok(source, `${row.id} exists in canonical source`);
  assert.equal(row.provenance.canonicalDigest, digest(row.technique.id, source.level, source.technique, source.archetypeId), `${row.id} canonical digest`);
  if (row.provenance.engineRuleDigests.length) assert.ok(row.provenance.engineRuleDigests.includes(row.provenance.canonicalDigest), `${row.id} adapter digest uses canonical payload`);
  if (!row.review.explicit) {
    assert.equal(row.review.status, "unreviewed");
    assert.equal(row.review.inherited, true);
  }
}
execFileSync(process.execPath, ["build_lionwing_automation_registry.mjs", "--check"], { cwd: appRoot, stdio: "pipe" });
console.log("LionWing automation registry: 333 canonical rows, strict ids/digests, explicit audit reviews and inherited defaults passed");
