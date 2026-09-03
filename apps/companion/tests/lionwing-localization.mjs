import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.window = {};
await import("../edition-lionwing.js");
await import("../edition-lionwing-ru.js");

const english = window.DAWN_LIONWING_DATA;
const russian = window.DAWN_LIONWING_RU;
const worklist = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/translation-worklist.json", import.meta.url), "utf8"));
assert.equal(russian.editionId, english.editionId);
assert.equal(Object.keys(russian.outlooks).length, english.outlooks.length);

const activeAbilityWordIds = Object.values(english.abilityWords).flat().map(item => item.id);
const retiredAbilityWordIds = worklist.units.filter(item => item.domain === "ability-word" && item.action === "retire").map(item => item.stableId);
const newAbilityWordIds = worklist.units.filter(item => item.domain === "ability-word" && item.action === "translate-new").map(item => item.stableId);
assert.equal(activeAbilityWordIds.length, 104);
assert.equal(Object.keys(russian.abilityWords).length, activeAbilityWordIds.length, "every active LionWing Ability word needs a Russian display value");
for (const id of activeAbilityWordIds) assert.ok(russian.abilityWords[id]?.trim(), `missing Russian Ability word: ${id}`);
for (const id of newAbilityWordIds) assert.ok(russian.abilityWords[id]?.trim(), `missing newly introduced Ability word: ${id}`);
for (const id of retiredAbilityWordIds) assert.ok(!(id in russian.abilityWords), `retired Ability word leaked into LionWing Russian overlay: ${id}`);
assert.equal(newAbilityWordIds.length, 35);
assert.equal(retiredAbilityWordIds.length, 14);

let translatedNewBoons = 0;
for (const outlook of english.outlooks) {
  const overlay = russian.outlooks[outlook.id];
  assert.ok(overlay?.name, `missing Russian outlook name: ${outlook.id}`);
  assert.ok(overlay?.description, `missing Russian outlook description: ${outlook.id}`);
  for (const boon of outlook.gifts.filter(item => item.introducedIn)) {
    assert.ok(overlay.gifts?.[boon.id]?.name, `missing new boon name: ${boon.id}`);
    assert.ok(overlay.gifts?.[boon.id]?.text, `missing new boon text: ${boon.id}`);
    translatedNewBoons += 1;
  }
}
assert.equal(translatedNewBoons, 21);

const changedBoonIds = worklist.units.filter(item => item.domain === "boon" && item.action === "retranslate").map(item => item.stableId);
const translatedBoonIds = new Set(Object.values(russian.outlooks).flatMap(outlook => Object.keys(outlook.gifts || {})));
assert.equal(changedBoonIds.length, 33);
for (const id of changedBoonIds) assert.ok(translatedBoonIds.has(id), `missing changed boon translation: ${id}`);

const newTechniqueIds = worklist.units.filter(item => item.domain === "technique" && item.action === "translate-new").map(item => item.stableId);
const translatedTechniqueIds = new Set(Object.values(russian.archetypes).flatMap(archetype => Object.keys(archetype.techniques || {})));
assert.equal(newTechniqueIds.length, 5);
for (const id of newTechniqueIds) assert.ok(translatedTechniqueIds.has(id), `missing new Technique translation: ${id}`);

const changedTechniqueIds = worklist.units.filter(item => item.domain === "technique" && item.action === "retranslate").map(item => item.stableId);
const translatedChangedTechniqueIds = changedTechniqueIds.filter(id => translatedTechniqueIds.has(id));
assert.equal(changedTechniqueIds.length, 106);
assert.equal(translatedChangedTechniqueIds.length, changedTechniqueIds.length, "every changed LionWing Technique must have a reviewed Russian overlay");

console.log(`LionWing RU overlay QA passed: ${activeAbilityWordIds.length} Ability words (${newAbilityWordIds.length} new), 10 Outlooks, ${translatedNewBoons} new and ${changedBoonIds.length} changed Boons, ${newTechniqueIds.length} new and ${translatedChangedTechniqueIds.length}/${changedTechniqueIds.length} changed Techniques`);
