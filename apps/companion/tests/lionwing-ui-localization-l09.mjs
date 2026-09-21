import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const storage = new Map();
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { id, value: "", innerHTML: "", options: [], classList: { toggle() {} } });
  return elements.get(id);
};
const document = {
  currentScript: { src: "http://localhost/apps/companion/app-bootstrap.js?v=l09" },
  body: { innerHTML: "" },
  documentElement: { lang: "ru" },
  getElementById: element,
  querySelectorAll: () => [],
};
const context = {
  console,
  URL,
  URLSearchParams,
  document,
  location: { href: "http://localhost/apps/companion/index.html", hash: "" },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  requestAnimationFrame: callback => callback(),
  window: {},
};
vm.createContext(context);
for (const file of [
  "localization.js",
  "locale-ru.js",
  "locale-en-builder.js",
  "data.js",
  "edition-lionwing.js",
  "edition-lionwing-ru.js",
  "lionwing-display-mapping.js",
]) vm.runInContext(read(file), context, { filename: file });
context.window.DAWN_LOGIC = {};
context.window.DAWN_SCENE_ENGINE = {};
context.window.DAWN_TECHNIQUE_ENGINE = {};
context.window.DAWN_NETWORK_V2 = {};
vm.runInContext(`${read("app-bootstrap.js")}
window.__l09Bootstrap = { activeCoreRules, setLocale: locale => { contentPreferences = { ...contentPreferences, locale }; } };`, context, { filename: "app-bootstrap.js" });

const canonicalNpcs = context.window.DAWN_LIONWING_DATA.coreRules.npcs.list;
const canonicalIds = canonicalNpcs.map(item => item.id);
const canonicalRoles = canonicalNpcs.map(item => item.role);
const roleLabels = { DPS: "Дамагер", Tank: "Танк", Support: "Поддержка", Engine: "Движок" };
assert.deepEqual(canonicalNpcs.map(item => item.id), canonicalIds, "canonical NPC ids are readable before the RU display overlay");
assert.deepEqual(canonicalNpcs.map(item => item.role), canonicalRoles, "canonical role values are readable before the RU display overlay");
assert.equal(context.window.DAWN_LIONWING_DISPLAY_MAPPING.applyRoleLabels(), canonicalNpcs.length, "every canonical role gets one display mapping");
assert.deepEqual(canonicalNpcs.map(item => item.id), canonicalIds, "display mapping does not change canonical NPC ids");
assert.deepEqual(canonicalNpcs.map(item => item.role), canonicalRoles, "display mapping does not change canonical role enums");

const bootstrap = context.window.__l09Bootstrap;
const ruCore = bootstrap.activeCoreRules();
assert.deepEqual(ruCore.npcs.list.map(item => item.id), canonicalIds, "RU projection preserves canonical NPC ids");
assert.deepEqual(ruCore.npcs.list.map(item => item.statistics), canonicalNpcs.map(item => item.statistics), "RU projection preserves canonical NPC statistics");
for (const npc of ruCore.npcs.list) {
  assert.equal(npc.role, roleLabels[npc.en], `${npc.id} exposes a Russian role label and a canonical English alias`);
  assert.ok(["DPS", "Tank", "Support", "Engine"].includes(npc.en), `${npc.id} keeps its canonical English role alias for search`);
}

// Evaluate the production reference catalogue and renderer, with only DOM
// primitives stubbed. This keeps the test on the same referenceItems/renderReference path.
context.$ = element;
context.esc = value => String(value ?? "").replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
context.md = value => context.esc(value).replace(/\n/g, "<br>");
context.automationBadge = () => "";
context.store = { pinnedRules: [] };
context.refKind = "all";
context.refTag = "all";
context.refSort = "source";
vm.runInContext(`${read("play-ui.js")}
window.__l09Reference = { referenceItems, renderReference };`, context, { filename: "play-ui.js" });
const reference = context.window.__l09Reference;
const ruSearch = query => {
  bootstrap.setLocale("ru");
  element("ref-search").value = query;
  context.refKind = "all";
  context.refTag = "all";
  context.refSort = "source";
  reference.renderReference();
  return element("reference-list").innerHTML;
};
for (const [english, russian] of Object.entries(roleLabels)) {
  const byEnglish = ruSearch(english);
  assert.match(byEnglish, new RegExp(russian), `RU reference search finds ${english} and renders ${russian}`);
  assert.doesNotMatch(byEnglish, new RegExp(`NPC · ${english}`), `RU reference cards do not display ${english}`);
  const byRussian = ruSearch(russian);
  assert.match(byRussian, new RegExp(russian), `RU reference search finds the displayed ${russian}`);
}
bootstrap.setLocale("en");
const enSearch = (() => {
  element("ref-search").value = "DPS";
  context.refKind = "all";
  context.refTag = "all";
  context.refSort = "source";
  reference.renderReference();
  return element("reference-list").innerHTML;
})();
assert.match(enSearch, /NPC · DPS/, "EN reference search keeps the canonical role display");

const ruStatusKeys = [
  "lionwing.technique.automation.manual.label",
  "lionwing.technique.automation.assisted.label",
  "lionwing.technique.automation.automatic.label",
  "lionwing.technique.automation.off.label",
  "builder.techniques.statusFilter",
  "builder.techniques.statusFull",
  "builder.techniques.statusDecision",
  "builder.techniques.statusPartial",
  "builder.techniques.statusManual",
];
const ruStatuses = ruStatusKeys.map(key => context.window.DAWN_I18N.t(key, {}, { locale: "ru" }));
assert.ok(ruStatuses.every(value => !/\b(?:manual|partial|automated|automation)\b/i.test(value)), "RU status display mappings contain no English technical status words");
assert.ok(ruStatuses.every(value => !/Авто частично|Автоматизация выключена|Ручной режим|Автоматизировано/.test(value)), "RU status display mappings contain no superseded technical labels");

console.log("L09 LionWing UI localization passed: RU display mapping, canonical ids/enums, production reference render path and RU/EN role search");
