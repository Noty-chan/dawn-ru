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
const canonicalRoot = new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", canonicalRoot), "utf8"));
const oldEnglish = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-9ce6d8d6/extracted-comparison-source.json", import.meta.url), "utf8"));
const translationWorklist = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/translation-worklist.json", import.meta.url), "utf8"));
assert.equal(russianAfter, russianBefore, "loading LionWing must not mutate the Russian catalogue");
assert.deepEqual(JSON.parse(JSON.stringify(lionwing)), extracted, "browser overlay must match the reviewable extracted data");
assert.equal(lionwing.editionId, "dawn-en-lionwing-cb2f8e67");
assert.equal(lionwing.tableMechanicsStatus, "not-ported");
assert.deepEqual(Array.from(lionwing.scope), ["builder", "reference", "techniques", "core-rules"]);
assert.equal(lionwing.builderRules.editionId, lionwing.editionId);
assert.deepEqual(JSON.parse(JSON.stringify(lionwing.builderRules.derivedStatistics)), { health: "10 + Body + Tier * 2", speed: "2 + ceil(Talent / 2)", focus: "1 + ceil(Spirit / 2)", guts: null });
assert.equal(manifest.editionId, lionwing.editionId);
assert.equal(manifest.counts.techniques, 111);
assert.equal(manifest.counts.coreEffects, 19);
assert.equal(manifest.counts.coreActions, 17);
assert.equal(manifest.counts.coreNpcs, 18);
assert.equal(manifest.counts.coreRuleCards, 136);
assert.deepEqual(JSON.parse(JSON.stringify(lionwing.builderRules.progression)), { experienceToTier: 15, chapterBaseExperience: 2, chapterMaximumExperience: 4, rewardsMayBeSavedForAwakening: true });
assert.deepEqual(JSON.parse(JSON.stringify(lionwing.builderRules.abilities)), { maximum: 1, minimumCost: 1, maximumRank: 3, customWordsRequireNarratorApproval: true, expandedUsesRequireOriginalWord: true });
assert.deepEqual(JSON.parse(JSON.stringify(lionwing.builderRules.bonds)), { maximumRank: 3, quickPerChapter: 1, quickRank: 1, quickSustainInfluenceCost: 1, actionInfluenceCost: 1, actionStressCost: 1 });
assert.equal(lionwing.builderRules.skills.canonical.length, 16);
assert.equal(new Set(lionwing.builderRules.skills.canonical.map(item => item.id)).size, 16, "canonical LionWing Skill ids must be unique");
assert.equal(oldEnglish.techniques.length, 107);
assert.deepEqual(Object.fromEntries(Object.entries(oldEnglish.abilityWords).map(([group, words]) => [group, words.length])), { verbs: 32, nouns: 30, conditions: 21 });
assert.ok(oldEnglish.outlooks.every(outlook => !outlook.description.includes("Favored Bond Actions")), "old Outlook descriptions must not absorb rules and Boons");
assert.deepEqual(translationWorklist.summary.technique, { retranslate: 106, "translate-new": 5, retire: 1 });
assert.deepEqual(translationWorklist.summary.outlook, { "reuse-existing-ru": 8, retranslate: 2 });

const techniques = lionwing.archetypes.flatMap(archetype => archetype.techniques);
assert.equal(techniques.length, 111);
assert.equal(new Set(techniques.map(item => item.id)).size, techniques.length, "LionWing technique ids must be unique");
for (const technique of techniques) {
  assert.ok(technique.name && technique.flavor && technique.levels.length === 3, `incomplete LionWing technique ${technique.id}`);
  assert.equal(technique.source?.editionId, lionwing.editionId, `wrong source edition for ${technique.id}`);
  assert.ok(technique.levels.every(level => !/\s\d{1,3}$/.test(level.text)), `PDF page number leaked into ${technique.id}`);
}
const byName = Object.fromEntries(techniques.map(item => [item.name, item]));
assert.deepEqual(Array.from(byName.Alchemist.levels, level => level.name), ["Quick Mix", "Powerful Mix", "High Intensity Mix"]);
assert.deepEqual(Array.from(byName.Deckbuilder.levels, level => level.name), ["Draw", "Card Capture", "Greed"]);
assert.deepEqual(Array.from(byName.Autophage.levels, level => level.name), ["Transfusion", "Overexert", "Born Of Mutable Flesh"]);
assert.equal(byName.Worldsmith.id, "disruptor.inner-world", "renamed Technique must retain its stable 0.9 id");
const canonicalTechniques = lionwing.archetypes.flatMap(archetype => {
  const canonical = JSON.parse(fs.readFileSync(new URL(`archetypes/${archetype.id}.json`, canonicalRoot), "utf8"));
  assert.equal(canonical.name, archetype.name);
  return canonical.techniques;
});
assert.deepEqual(canonicalTechniques.map(item => item.id), techniques.map(item => item.id), "canonical corpus must match runtime technique ids");
for (const [file, value] of [["outlooks.json", lionwing.outlooks], ["ability-words.json", lionwing.abilityWords], ["builder-reference.json", lionwing.reference], ["builder-rules.json", lionwing.builderRules], ["core-rules.json", lionwing.coreRules]]) {
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL(file, canonicalRoot), "utf8")), JSON.parse(JSON.stringify(value)), `${file} must match runtime data`);
}

const bootstrap = read("app-bootstrap.js"), app = read("app.js"), events = read("app-builder-events.js"), playUi = read("play-ui.js");
assert.match(bootstrap, /dawn-companion-content-preferences-v1/);
assert.match(bootstrap, /localizedLionwingAbilityWords/, "LionWing RU must localize Ability words without mutating English canonical data");
assert.match(bootstrap, /localizedLionwingCoreRules/, "LionWing RU must localize core rules without mutating English canonical data");
assert.match(bootstrap, /activeCoreRules/, "selected-edition rules must have a dedicated resolver");
assert.match(app, /syncContentUrl/);
assert.match(events, /content:\{locale:contentPreferences\.locale,edition:S\.rulesEdition/);
assert.match(events, /supplements:\[\.\.\.\(S\.supplementIds\|\|\[\]\)\]/, "portable heroes must declare their enabled supplement packages");
assert.match(events, /supplementIds:data\.hero\?\.supplementIds\|\|data\.content\?\.supplements/, "hero import must restore supplement package identity");
assert.match(events, /\["ru","en"\]\.includes\(data\.content\?\.locale\)/, "hero import must restore the exported display language");
assert.match(bootstrap + read("app-core.js"), /rulesEdition[\s\S]+activateHeroEdition/, "heroes must be isolated by rules edition");
assert.doesNotMatch(app, /demo-no-table",isLionwingEdition\(\)/, "LionWing must remain playable through the manual table");
assert.match(app, /isLionwingEdition\(\)&&sceneControlMode!=="manual"/, "LionWing must enter the table with Technique automation disabled");
assert.doesNotMatch(playUi, /isEnglishPreview\(\)&&\["play","tools","rules"\]/, "English LionWing must be allowed to enter the table");
assert.match(read("app-core.js"), /if\(isLionwingEdition\(\)\)return"manual"/, "0.9 Technique coverage must not be reported as LionWing automation");
assert.match(read("scene-actions-ui.js"), /sceneControlMode!=="manual"&&hero\.rulesEdition==="ru-v0\.9"/, "manual and LionWing actors must not expose Techniques to the 0.9 engine");
assert.match(playUi + read("scene-ui.js"), /activeOutlooks\(\)[\s\S]+activeArchetypes\(\)/, "table and reference views must consume the selected edition");
assert.match(playUi, /function activeRuleChapters\(\)[\s\S]+activeCoreRules\(\)/, "LionWing rules view must consume selected-edition core rules");
assert.match(playUi, /if\(isLionwingEdition\(\)\)\{[\s\S]+core\.rules\.map[\s\S]+core\.actions\.list\.map[\s\S]+core\.effects\.positive\.map[\s\S]+core\.npcs/, "both LionWing locales must build reference items from LionWing rules, actions, effects, and NPCs");
assert.match(playUi, /filters=lionwing\?\(en\?\["all","Builder Reference","Skill","Rule","Action","Effect","NPC","Technique","Boon"\]:\["all","Справка","Навык","Правило","Действие","Эффект","NPC","Техника","Дар"\]\)/, "LionWing reference filters must be complete in RU and EN");
console.log("Edition isolation QA passed: RU catalogue immutable, LionWing provenance complete, manual table isolated");
