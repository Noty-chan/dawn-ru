import assert from "node:assert/strict";

globalThis.window = {};
await import("../supplement-registry.js");
await import("../supplements.js");

const registry = window.DAWN_SUPPLEMENTS;
const packages = registry.list();
assert.equal(packages.length, 4);
assert.equal(new Set(packages.map(item => item.id)).size, packages.length);
for (const item of packages) {
  assert.deepEqual(item.compatibleEditions, ["lionwing"]);
  assert.deepEqual(item.locales, ["ru"]);
  assert.equal(registry.compatible(item, { edition: "lionwing", locale: "ru" }), true);
  assert.equal(registry.compatible(item, { edition: "ru-v0.9", locale: "ru" }), false);
  assert.equal(registry.compatible(item, { edition: "lionwing", locale: "en" }), false);
  assert.equal(item.source.distribution, "metadata-and-reviewed-translation-only");
  assert.equal(item.content.reference.length, 1);
}

console.log(`Supplement registry QA passed: ${packages.length} isolated packages`);
