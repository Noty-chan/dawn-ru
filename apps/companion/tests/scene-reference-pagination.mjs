import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../scene-ui.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const start = source.indexOf("function sceneReferenceId("), end = source.indexOf("\nfunction sceneTrayHeroActor(", start);
assert.ok(start >= 0 && end > start, "load the actual reference collection and renderer");
const playSource = fs.readFileSync(new URL("../play-ui.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const keyStart = playSource.indexOf("function ruleKey("), keyEnd = playSource.indexOf("\nconst PINNED_RULE_LIMIT", keyStart);
const chapterStart = playSource.indexOf("function activeRuleChapters("), chapterEnd = playSource.indexOf("\nfunction renderRules(", chapterStart);
assert.ok(keyStart >= 0 && keyEnd > keyStart && chapterStart >= 0 && chapterEnd > chapterStart, "load the actual canonical chapter and anchor functions");
const workspaceSource = fs.readFileSync(new URL("../app-workspace.js", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const workspaceEnd = workspaceSource.indexOf("\nfunction renderWorkspaceNavigation(");
assert.ok(workspaceEnd > 0, "load the actual read-only paging and chapter navigation helpers");
const core = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/core-rules.json", import.meta.url), "utf8"));
const document = { activeElement: null };
const searchInput = { value: "", selectionStart: 0, selectionEnd: 0 };
class ReferenceRoot {
  constructor() { this.markup = ""; this.cards = []; this.writes = 0; this.more = null; this.count = null; }
  get innerHTML() { return this.markup; }
  set innerHTML(markup) {
    this.markup = markup; this.writes += 1;
    this.cards = [...markup.matchAll(/<details class="scene-reference-card" data-scene-rule-id="([^"]+)"/g)].map(match => ({ dataset: { sceneRuleId: match[1] }, open: false }));
    const node = more => ({
      matches: selector => more && selector === '[data-workspace-more="scene-reference"]',
      focus(options) { this.focusOptions = options; document.activeElement = this; },
    });
    this.more = markup.includes('data-workspace-more="scene-reference"') ? node(true) : null;
    this.count = markup.includes('class="workspace-result-count"') ? node(false) : null;
  }
  querySelectorAll(selector) { return selector.startsWith("details[open]") ? this.cards.filter(card => card.open) : this.cards; }
  querySelector(selector) { return selector === '[data-workspace-more="scene-reference"]' ? this.more : selector === ".workspace-result-count" ? this.count : null; }
  contains(node) { return Boolean(node && (node === this.more || node === this.count || this.cards.includes(node))); }
}
const root = new ReferenceRoot(), scene = { rulesEdition: "lionwing", actors: [{ id: "hidden-npc", hidden: true, name: "PRIVATE_NPC_INSTANCE" }], ruleHandouts: [], log: [], version: 7 };
let view = "gm", localizedCore = core, lionwing = true;
const legacyChapter = { id: "combat", name: "Legacy combat", cards: [] };
const calls = [], commits = [];
const context = vm.createContext({
  Scene: scene, sceneReferenceQuery: "", sceneReferenceSection: "combat", sceneReferenceMarkup: "",
  document, URL, location: { href: "http://localhost/apps/companion/index.html?edition=lionwing&mode=play" },
  contentPreferences: { locale: "ru" }, RULE_CHAPTERS: [legacyChapter],
  $: id => id === "scene-reference-list" ? root : searchInput,
  esc: value => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"),
  md: value => String(value ?? ""), sceneUsesLionwing: () => lionwing,
  localizedLionwingCoreRules: () => localizedCore, activeCoreRules: () => lionwing ? localizedCore : null, activeSceneView: () => view,
  isEnglishPreview: () => false, actionCostLabel: () => "", referenceItems: () => [],
  requestAnimationFrame: callback => callback(),
  commitSceneEvents: (...args) => { commits.push(args); throw new Error("Reading rules must not commit game events"); },
});
vm.runInContext(playSource.slice(keyStart, keyEnd) + "\n" + playSource.slice(chapterStart, chapterEnd), context, { filename: "play-ui.js:canonical-chapters" });
vm.runInContext(source.slice(start, end), context, { filename: "scene-ui.js:reference" });
const render = () => context.renderSceneReference(), ids = () => root.cards.map(card => card.dataset.sceneRuleId);
const before = JSON.stringify(scene), allCombat = context.sceneCombatReferenceItems("combat");
const expectedCounts = { combat: 18, field: 18, actions: 17, effects: 19, enemies: 61 };
const counts = () => Object.fromEntries(Object.keys(expectedCounts).map(section => [section, context.sceneCombatReferenceItems(section).length]));
assert.deepEqual(counts(), expectedCounts, "canonical rules belong to the five relevant combat reference sections");
const allItems = context.sceneCombatReferenceItems(), allIds = new Set(Array.from(allItems, item => item.id));
assert.equal(allItems.length, 133);
assert.equal(allIds.size, allItems.length, "each canonical item has exactly one combat reference section");
for (const [id, section] of [
  ["lionwing.core.combat.structured", "combat"],
  ["lionwing.core.combat.turn-order", "combat"],
  ["lionwing.core.statistics.health", "combat"],
  ["lionwing.core.spatial.setting-up", "field"],
  ["lionwing.core.terrain.overview", "field"],
  ["lionwing.narrator.npcs.turns", "enemies"],
  ["lionwing.narrator.antagonism.all-out", "enemies"],
]) assert.equal(allItems.find(item => item.id === id)?.section, section, `${id} has its canonical battle section`);
const modifiers = core.rules.filter(rule => /^(lionwing\.modifier\.|lionwing\.narrator\.modifiers\.)/.test(rule.id));
assert.equal(modifiers.length, 16);
for (const modifier of modifiers) assert.equal(allItems.find(item => item.id === modifier.id)?.section, "enemies", "Modifiers belong to enemies, never to combat");
assert.ok(allCombat.every(item => /^lionwing\.core\.(combat|statistics)\./.test(item.id)));
const excluded = core.rules.filter(rule => !allIds.has(rule.id));
assert.equal(excluded.length, 71, "freeplay and character build rules remain outside the combat reference");
for (const id of [
  "lionwing.core.abilities.overview", "lionwing.core.bonds.overview", "lionwing.core.creation.modes",
  "lionwing.core.rolls.challenge", "lionwing.narrator.chapters.hook", "lionwing.narrator.antagonism.foil",
  "lionwing.narrator.antagonism.bargain", "lionwing.narrator.antagonism.awaken",
]) {
  assert.ok(core.rules.some(rule => rule.id === id), `${id} remains available in the full canonical rule collection`);
  assert.ok(!allIds.has(id), `${id} is not a battle reference rule`);
}
assert.equal(core.npcs.list.length, 41);
assert.ok(core.npcs.list.every(npc => !allIds.has(npc.id)), "NPC profiles stay in the full reference without duplicating the battle rule cards");
const primaryIds = { combat: "lionwing.core.combat.structured", field: "lionwing.core.spatial.setting-up", enemies: "lionwing.narrator.npcs.turns" };
const primaryChapter = section => ["actions", "effects"].includes(section)
  ? context.activeRuleChapters().find(chapter => chapter.special === "actions")
  : context.activeRuleChapters().find(chapter => chapter.cards?.some(card => card.id === primaryIds[section]));
for (const section of Object.keys(expectedCounts)) assert.equal(context.sceneRuleChapter(section)?.id, primaryChapter(section)?.id, `${section} points to its primary canonical chapter`);
lionwing = false;
assert.equal(context.sceneRuleChapter("combat"), legacyChapter, "legacy chapter lookup remains intact");
lionwing = true;
localizedCore = { ...core, rules: core.rules.map(rule => ({ ...rule, category: `Перевод ${rule.category}` })).concat({ id: "lionwing.core.other.spatial-preview", category: "Combat", name: "New misc rule", text: "" }) };
assert.deepEqual(counts(), expectedCounts, "translated display categories and unclassified misc rules cannot change battle section membership");
assert.ok(!context.sceneCombatReferenceItems().some(item => item.id === "lionwing.core.other.spatial-preview"), "unclassified IDs never default to combat");
for (const section of Object.keys(expectedCounts)) assert.equal(context.sceneRuleChapter(section)?.id, primaryChapter(section)?.id, "primary chapter selection follows stable card IDs after localization");
localizedCore = core;

// The compatibility path must never silently hide rules when the workspace helper is absent.
document.activeElement = searchInput;
render();
assert.equal(root.cards.length, allCombat.length);
assert.ok(ids().includes(allCombat.at(-1).id));
assert.match(root.markup, new RegExp(`Показано ${allCombat.length} из ${allCombat.length}`));
assert.equal(root.more, null);
assert.equal(document.activeElement, searchInput);

// Load the real shared helpers: expanding a result window changes local UI state only.
vm.runInContext(workspaceSource.slice(0, workspaceEnd), context, { filename: "app-workspace.js:result-page" });
const resultPage = context.workspaceResultPage;
context.workspaceResultPage = (kind, key, items, ...options) => {
  const [pageSize] = options;
  calls.push({ kind, key: JSON.parse(key), items: [...items], pageSize });
  return resultPage(kind, key, items, ...options);
};
for (const section of Object.keys(expectedCounts)) {
  const chapter = primaryChapter(section);
  assert.ok(chapter, `${section} has an actual canonical primary chapter`);
  assert.equal(context.workspaceRulesHref(section, context.sceneCombatReferenceItems(section)), `?mode=rules#rules-${chapter.id}`, `${section} full chapter navigation chooses its primary chapter before ranking incidental category counts`);
}
render();
assert.equal(calls.at(-1).kind, "scene-reference");
assert.equal(calls.at(-1).pageSize, 36);
assert.equal(calls.at(-1).key.section, "combat");
assert.equal(root.cards.length, allCombat.length);
assert.equal(root.more, null, "the focused battle rules fit in the initial result window");
assert.match(root.markup, /role="status" aria-live="polite" aria-atomic="true"/);

context.sceneReferenceQuery = " e ";
searchInput.value = " e "; searchInput.selectionStart = 2; searchInput.selectionEnd = 2;
document.activeElement = searchInput;
render();
const filtered = context.sceneCombatReferenceItems().filter(item => `${item.name} ${item.kind} ${item.text || ""} ${item.group || ""}`.toLowerCase().includes("e"));
assert.ok(filtered.length > 120, "canonical search exercises at least three result windows");
assert.equal(calls.at(-1).pageSize, 60);
assert.equal(calls.at(-1).key.query, "e");
assert.equal(root.cards.length, 60);
assert.deepEqual(calls.at(-1).items.map(item => item.id), Array.from(filtered, item => item.id), "the paging helper receives only matching results");
assert.equal(document.activeElement, searchInput);
assert.equal(searchInput.value, " e ");
assert.equal(searchInput.selectionStart, 2);
assert.match(root.markup, /type="button" data-workspace-more="scene-reference"/);
const retainedId = root.cards[0].dataset.sceneRuleId;
root.cards[0].open = true;
root.more.focus({ preventScroll: true });
assert.equal(context.workspaceMoreResults("scene-reference"), true);
render();
assert.equal(root.cards.length, 120);
assert.equal(root.cards.find(card => card.dataset.sceneRuleId === retainedId).open, true, "expansion retains already opened rule text");
assert.equal(document.activeElement, root.more, "load more retains keyboard focus on the replacement button");
assert.equal(root.more.focusOptions.preventScroll, true);
assert.equal(context.workspaceMoreResults("scene-reference"), true);
render();
assert.equal(root.cards.length, filtered.length);
assert.equal(root.more, null);
assert.equal(document.activeElement, root.count, "the final page keeps focus at the result summary");

context.sceneReferenceQuery = ""; context.sceneReferenceSection = "enemies";
render();
assert.equal(calls.at(-1).key.section, "enemies");
assert.equal(calls.at(-1).pageSize, 36);
assert.ok(calls.at(-1).items.every(item => item.section === "enemies"));
assert.ok(!root.markup.includes("PRIVATE_NPC_INSTANCE"), "private scene actor state is never added to the canonical reference results");
view = "player";
render();
assert.equal(calls.at(-1).key.view, "player", "paging context is isolated when the viewer changes");
assert.ok(!root.markup.includes("data-scene-rule-share="), "pagination cannot introduce Narrator controls in Player view");
context.sceneReferenceQuery = "__missing_reference_query__";
render();
assert.equal(root.cards.length, 0);
assert.match(root.markup, /ничего не найдено/);
assert.match(root.markup, /Показано 0 из 0/);
assert.equal(root.more, null);
const writes = root.writes;
render();
assert.equal(root.writes, writes, "unchanged reference results leave the existing DOM and focus alone");
assert.equal(JSON.stringify(scene), before, "search and expansion never alter the scene, journal, targets or turn");
assert.equal(commits.length, 0);
console.log(`Scene reference classification ${JSON.stringify(expectedCounts)}; excluded full-reference rules: ${excluded.length}/${core.rules.length}; primary chapters, paging, details/focus and read-only visibility: OK`);
