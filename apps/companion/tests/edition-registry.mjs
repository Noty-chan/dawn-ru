import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../../", import.meta.url);
const registry = JSON.parse(fs.readFileSync(new URL("source/text-sources.json", root), "utf8"));
const queue = JSON.parse(fs.readFileSync(new URL("source/editions/dawn-en-lionwing-cb2f8e67/changes.json", root), "utf8"));
const detected = JSON.parse(fs.readFileSync(new URL("source/editions/dawn-en-lionwing-cb2f8e67/detected-changes.json", root), "utf8"));

assert.equal(registry.schemaVersion, 1);
assert.equal(queue.schemaVersion, 1);
assert.equal(queue.editionId, registry.sources.en.id);
assert.equal(queue.baseEditionId, registry.sources["en-legacy"].id);
assert.ok(["awaiting-source", "inventory", "in-progress", "reviewed", "published"].includes(queue.status));
assert.equal(detected.editionId, queue.editionId);
assert.equal(detected.counts.oldTechniques, 107);
assert.equal(detected.counts.newTechniques, 111);
assert.equal(detected.changes.length, detected.counts.newTechniques + detected.counts.removals);

const ids = new Set();
const kinds = new Set(["editorial", "terminology", "addition", "removal", "mechanics", "layout"]);
const states = new Set(["not-applicable", "pending", "draft", "reviewed", "published"]);
for (const change of queue.changes) {
  assert.match(change.id, /^change-[a-z0-9-]+$/);
  assert.ok(!ids.has(change.id), `duplicate edition change id: ${change.id}`);
  ids.add(change.id);
  assert.ok(kinds.has(change.kind), `unsupported change kind: ${change.kind}`);
  assert.equal(typeof change.summaryEn, "string");
  assert.equal(typeof change.status?.sourceReviewed, "boolean");
  for (const field of ["translation", "mechanics", "companion"]) assert.ok(states.has(change.status?.[field]), `unsupported ${field} status in ${change.id}`);
}

for (const [key, expected] of [["detected", queue.changes.length], ["translated", queue.changes.filter(item => ["reviewed", "published"].includes(item.status.translation)).length], ["mechanicsReviewed", queue.changes.filter(item => ["reviewed", "published", "not-applicable"].includes(item.status.mechanics)).length], ["published", queue.changes.filter(item => item.status.companion === "published").length]]) assert.equal(queue.summary[key], expected, `stale ${key} count`);

console.log(`Edition registry QA passed: ${queue.changes.length} tracked changes`);
