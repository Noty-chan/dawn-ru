import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bootstrap = fs.readFileSync(path.join(root, "app-bootstrap.js"), "utf8");
const start = bootstrap.indexOf("const LIONWING_VERIFICATION_SURFACES");
const end = bootstrap.indexOf('const STORAGE_KEY =', start);
assert.ok(start >= 0 && end > start);
const commit = "a".repeat(40), id = "vagabond.master-at-arms.2", digest = "b".repeat(64);
const canonical = new Map([[id, { id, canonicalDigest: digest }]]);
const context = { Map, APP_BUILD_VERSION: commit, LionwingAutomationStatus: {}, lionwingAutomationRows: canonical };
vm.createContext(context);
vm.runInContext(`${bootstrap.slice(start, end)}\nthis.normalize=normalizeLionwingVerification;`, context);
const makeBundle = (row = {}, run = {}) => ({
  verificationRun: { schemaVersion: 1, commit, clean: true, ...run },
  verificationRows: [{ id, canonicalDigest: digest, state: "current", currentSurfaces: ["core", "persistence"], fullPath: true, ...row }],
});
const get = (bundle, build = commit) => context.normalize(bundle, canonical, build).get(id);
const current = get(makeBundle());
assert.equal(current.state, "current");
assert.deepEqual([...current.currentSurfaces], ["core", "persistence"]);
assert.equal(current.fullPath, false, "a core and reload test cannot certify the complete user path");
assert.ok(Object.isFrozen(current) && Object.isFrozen(current.currentSurfaces));
assert.equal(get(makeBundle({ currentSurfaces: ["core", "ui", "network", "persistence"] })).fullPath, true);
for (const bundle of [makeBundle({}, { commit: "c".repeat(40) }), makeBundle({}, { clean: false })]) {
  const stale = get(bundle);
  assert.equal(stale.state, "stale");
  assert.equal(stale.currentSurfaces.length, 0);
  assert.equal(stale.fullPath, false);
}
assert.equal(get(makeBundle(), "dev").state, "stale", "a receipt from another build cannot certify local code");
assert.equal(get(makeBundle({ state: "failed" })).fullPath, false);
assert.equal(get(makeBundle({ state: "failed" })).currentSurfaces.length, 0);
assert.equal(get(makeBundle({ canonicalDigest: "wrong" })), undefined);
assert.equal(context.normalize({}, canonical, commit).size, 0);
const duplicate = makeBundle();
duplicate.verificationRows.push({ ...duplicate.verificationRows[0] });
assert.equal(context.normalize(duplicate, canonical, commit).size, 0, "duplicate IDs invalidate the receipt projection");
assert.deepEqual([...get(makeBundle({ currentSurfaces: ["core", "arbitrary", "core"] })).currentSurfaces], ["core"]);

const core = fs.readFileSync(path.join(root, "app-core.js"), "utf8");
const helperStart = core.indexOf("function techniqueVerificationStatus");
const helperEnd = core.indexOf("function techniqueStatusSummaryMarkup", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
let selected = current, lionwing = true;
const copy = {
  verificationCore: "ядро <правил>", verificationUi: "интерфейс", verificationNetwork: "сеть", verificationPersistence: "сохранение",
  verificationNone: "Пользовательский путь ещё не проверен", verificationCurrent: "Проверено: {surfaces}",
  verificationFull: "Полный пользовательский путь проверен", verificationStale: "Проверки устарели после изменения кода", verificationFailed: "Последняя проверка не прошла",
};
const ui = {
  isLionwingEdition: () => lionwing,
  canonicalLionwingTechniqueVerification: () => selected,
  t: (key, params = {}) => (copy[key.split(".").at(-1)] || key).replace("{surfaces}", params.surfaces || ""),
  esc: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
};
vm.createContext(ui);
vm.runInContext(`${core.slice(helperStart, helperEnd)}\nthis.markup=techniqueVerificationMarkup;`, ui);
assert.match(ui.markup("vagabond.master-at-arms", 2), /Проверено: ядро &lt;правил&gt;, сохранение/);
assert.doesNotMatch(ui.markup("vagabond.master-at-arms", 2), /Полный пользовательский путь/);
selected = get(makeBundle({}, { commit: "c".repeat(40) }));
assert.match(ui.markup("vagabond.master-at-arms", 2), /устарели/);
selected = get(makeBundle({ state: "failed" }));
assert.match(ui.markup("vagabond.master-at-arms", 2), /не прошла/);
selected = null;
assert.match(ui.markup("vagabond.master-at-arms", 2), /ещё не проверен/);
lionwing = false;
assert.equal(ui.markup("vagabond.master-at-arms", 2), "");
console.log("LionWing verification UI: exact-build receipts, partial surfaces, stale/failed/missing evidence, canonical IDs and escaping passed");
