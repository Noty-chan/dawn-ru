import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const registry = JSON.parse(read("LIONWING-AUTOMATION-REGISTRY.json"));
const runtimeSource = read("lionwing-automation-status.js");
const runtimeContext = { window: {} };
vm.createContext(runtimeContext);
vm.runInContext(runtimeSource, runtimeContext, { filename: "lionwing-automation-status.js" });
const runtime = runtimeContext.window.DAWN_LIONWING_AUTOMATION_STATUS;
const validStatuses = new Set(["full", "decision", "partial", "manual"]);

assert.equal(runtime.schemaVersion, 1);
assert.equal(runtime.editionId, registry.editionId);
assert.equal(runtime.rows.length, registry.rows.length);
assert.equal(new Set(runtime.rows.map(row => row.id)).size, runtime.rows.length, "browser status rows must have unique canonical level ids");
const registryById = new Map(registry.rows.map(row => [row.id, row]));
for (const row of runtime.rows) {
  const source = registryById.get(row.id);
  assert.ok(source, `${row.id} must be present in the generated registry`);
  assert.ok(validStatuses.has(row.automation), `${row.id} must have a known automation status`);
  assert.equal(row.automation, validStatuses.has(source.implementation.automation) ? source.implementation.automation : "manual");
  assert.equal(row.canonicalDigest, source.provenance.canonicalDigest, `${row.id} must retain its canonical digest`);
  assert.deepEqual(Object.keys(row).sort(), ["automation", "canonicalDigest", "id", "reason"]);
}
const partial = runtime.rows.find(row => row.automation === "partial");
const manual = runtime.rows.find(row => row.automation === "manual");
assert.ok(partial && manual, "the canonical registry must expose partial and manual levels");
assert.equal(typeof partial.reason, "string");
assert.equal(typeof manual.reason, "string");

const appCore = read("app-core.js");
const helperStart = appCore.indexOf("const TECHNIQUE_STATUS_LABEL_KEYS");
const helperEnd = appCore.indexOf("function enemyProfileAutomation", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "status helpers must remain a contiguous testable unit");
const helperSource = appCore.slice(helperStart, helperEnd);
const translations = {
  "builder.techniques.statusFull": "Fully <automated>",
  "builder.techniques.statusDecision": "Automated & choice",
  "builder.techniques.statusPartial": "Partially \"covered\"",
  "builder.techniques.statusManual": "Manual / unsupported",
  "builder.techniques.statusFullShort": "full",
  "builder.techniques.statusDecisionShort": "choice",
  "builder.techniques.statusPartialShort": "partial & note",
  "builder.techniques.statusManualShort": "manual",
  "builder.techniques.statusSummary": "Coverage & status",
  "builder.techniques.statusPartialHelp": "Some conditions remain manual.",
  "builder.techniques.statusManualHelp": "Resolve this rule manually.",
};
const esc = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const canonicalRows = new Map([
  ["demo.technique.1", { id: "demo.technique.1", automation: "partial", reason: "<canonical & reviewed>" }],
  ["demo.technique.2", { id: "demo.technique.2", automation: "full", reason: "" }],
  ["demo.technique.3", { id: "demo.technique.3", automation: "manual", reason: "" }],
]);
let coverageCalls = 0;
const helperContext = {
  console,
  t: key => translations[key] || key,
  esc,
  LIONWING_AUTOMATION_STATUSES: validStatuses,
  isLionwingEdition: () => true,
  canonicalLionwingTechniqueStatus: (techniqueId, level) => canonicalRows.get(`${techniqueId}.${level}`) || null,
  TechniqueEngine: { techniqueCoverage: () => { coverageCalls += 1; return [{ techniqueId: "demo.technique", level: 1, automation: "manual" }]; } },
  D: {},
};
vm.createContext(helperContext);
vm.runInContext(`${helperSource}\nthis.api={techniqueLevelStatus,techniqueLevelAutomation,techniqueAutomationStatusMarkup,techniqueLevelStatusReason,techniqueMatchesStatus,techniqueStatusSummaryMarkup};`, helperContext, { filename: "app-core-status-helpers.js" });
const api = helperContext.api;
const technique = { id: "demo.technique", levels: [{ n: 1 }, { n: 2 }, { n: 3 }] };
assert.equal(api.techniqueLevelStatus("demo.technique", 1).automation, "partial", "LionWing level status must use canonical readiness");
assert.equal(coverageCalls, 0, "LionWing status lookup must not fall back to the legacy engine");
assert.equal(api.techniqueMatchesStatus(technique, "partial"), true);
assert.equal(api.techniqueMatchesStatus(technique, "decision"), false);
assert.equal(api.techniqueMatchesStatus(technique, "all"), true);
assert.equal(api.techniqueMatchesStatus(technique, "arbitrary-payload-status"), false);
assert.equal(api.techniqueLevelStatusReason({ automation: "partial" }), translations["builder.techniques.statusPartialHelp"]);
assert.equal(api.techniqueLevelStatusReason({ automation: "manual" }), translations["builder.techniques.statusManualHelp"]);
const summary = api.techniqueStatusSummaryMarkup(technique);
assert.match(summary, /technique-status-partial/);
assert.match(summary, /technique-status-full/);
assert.match(summary, /technique-status-manual/);
const markup = api.techniqueAutomationStatusMarkup("partial");
const shortMarkup = api.techniqueAutomationStatusMarkup("partial", { short: true });
assert.match(markup, /title="Partially &quot;covered&quot;/);
assert.match(shortMarkup, /partial &amp; note/);
assert.doesNotMatch(markup, /<canonical|<Partially/);

const bootstrap = read("app-bootstrap.js");
const heroUi = read("hero-ui.js");
const index = read("index.html");
assert.match(bootstrap, /DAWN_LIONWING_AUTOMATION_STATUS/);
assert.match(bootstrap, /lionwingAutomationRows/);
assert.match(bootstrap, /lionwingCanonicalTechniqueLevelIds[\s\S]+has\(row\.id\)/, "Only canonical LionWing level ids may enter the browser status map");
assert.match(bootstrap, /lionwingCanonicalDigest\.test\(row\.canonicalDigest/, "Status rows must retain a canonical digest before reaching the UI");
assert.doesNotMatch(helperSource, /(?:actor|payload|dataset)/, "status helper must not read client actor payload fields");
assert.match(heroUi, /techniqueMatchesStatus\(t,techStatus\)/);
assert.match(heroUi, /data-automation-status=/);
assert.match(heroUi, /esc\(reason\)/);
assert.match(heroUi, /esc\(statusValues\)/);
assert.match(index, /lionwing-automation-status\.js[\s\S]+app-bootstrap\.js/);

console.log("LionWing technique status UI/logic QA passed: canonical rows, filters, partial/manual help and HTML escaping");
