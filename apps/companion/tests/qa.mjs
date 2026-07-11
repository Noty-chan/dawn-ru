import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), context);
const data = context.window.DAWN_DATA;
assert.equal(data.schemaVersion, 2);
assert.equal(data.archetypes.length, 6);
assert.equal(data.archetypes.flatMap(a => a.techniques).length, 107);
assert.equal(data.outlooks.length, 10);
assert.equal(data.outlooks.flatMap(o => (o.builtin ? [o.builtin] : []).concat(o.gifts)).length, 52);
assert.equal(data.effects.positive.length, 8);
assert.equal(data.effects.negative.length, 11);
assert.equal(data.actions.list.length, 15);
assert.ok(data.abilityWords.verbs.length > 20);
assert.ok(data.abilityWords.nouns.length > 20);
assert.ok(data.abilityWords.conditions.length > 20);

const ids = [
  ...data.archetypes.flatMap(a => a.techniques.map(t => t.id)),
  ...data.outlooks.map(o => o.id),
  ...data.outlooks.flatMap(o => (o.builtin ? [o.builtin] : []).concat(o.gifts).map(g => g.id)),
  ...Object.values(data.effects).flat().map(e => e.id),
  ...data.actions.list.map(a => a.id),
  ...Object.values(data.abilityWords).flat().map(w => w.id),
];
assert.equal(new Set(ids).size, ids.length, "stable ids must be unique");
for (const archetype of data.archetypes) for (const technique of archetype.techniques) assert.equal(technique.levels.length, 3, technique.name);

for (const file of ["index.html", "app.css", "app.js", "data.js", "manifest.webmanifest", "sw.js"]) assert.ok(fs.existsSync(path.join(root, file)), file);
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.match(app, /Math\.ceil\(attrValue\("talent"\)\/2\)/);
assert.match(app, /takeWound\(external\)/);
assert.doesNotMatch(app, /Math\.floor\(attrValue/);
console.log(`OK: ${ids.length} unique rule ids; companion data and invariants validated.`);
