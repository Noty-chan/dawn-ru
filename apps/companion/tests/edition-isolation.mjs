import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(read("data.js"), context);
const russianBefore = JSON.stringify(context.window.DAWN_DATA);
vm.runInContext(read("edition-lionwing.js"), context);

const russianAfter = JSON.stringify(context.window.DAWN_DATA);
const lionwing = context.window.DAWN_LIONWING_DATA;
const extracted = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json", import.meta.url), "utf8"));
assert.equal(russianAfter, russianBefore, "loading LionWing must not mutate the Russian catalogue");
assert.deepEqual(JSON.parse(JSON.stringify(lionwing)), extracted, "browser overlay must match the reviewable extracted data");
assert.equal(lionwing.editionId, "dawn-en-lionwing-cb2f8e67");
assert.equal(lionwing.mechanicsLocale, "ru");
assert.deepEqual(Array.from(lionwing.scope), ["builder", "reference", "techniques"]);

const techniques = lionwing.archetypes.flatMap(archetype => archetype.techniques);
assert.equal(techniques.length, 111);
assert.equal(new Set(techniques.map(item => item.id)).size, techniques.length, "LionWing technique ids must be unique");
for (const technique of techniques) {
  assert.ok(technique.name && technique.flavor && technique.levels.length === 3, `incomplete LionWing technique ${technique.id}`);
  assert.equal(technique.source?.editionId, lionwing.editionId, `wrong source edition for ${technique.id}`);
}

const bootstrap = read("app-bootstrap.js"), app = read("app.js"), events = read("app-builder-events.js");
assert.match(bootstrap, /dawn-companion-content-preferences-v1/);
assert.match(app, /syncContentUrl/);
assert.match(events, /content:\{locale:contentPreferences\.locale,edition:contentPreferences\.edition/);
console.log("Edition isolation QA passed: RU catalogue immutable, LionWing provenance complete, preview routes shareable");
