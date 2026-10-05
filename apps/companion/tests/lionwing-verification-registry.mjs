import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildRegistry, buildRuntimeStatus, buildRuntimeScript, writeVerifiedRuntime } from "../build_lionwing_automation_registry.mjs";
import { runAutomationVerification } from "../automation-verification.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const old = read(path.join(appRoot, "LIONWING-AUTOMATION-REGISTRY.json"));
const canonical = read(path.join(repoRoot, "source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json"));
const review = read(path.join(appRoot, "lionwing-automation-registry.review.json"));
const evidence = read(path.join(appRoot, "automation-evidence.json"));
const coverage = old.rows.map(row => ({ id: row.id, automation: row.implementation.automation, rules: row.implementation.rules, foundationPlan: row.implementation.foundationPlan }));
const historical = structuredClone(evidence);
historical.entries[0].confidence = "certified";
historical.entries[0].surfaces = { core: true, ui: true, network: true, persistence: true };
const registry = buildRegistry({ canonical, coverage, review, evidence: historical });
assert.equal(registry.rows.find(row => row.id === historical.entries[0].id).certification.status, "uncertified", "source audit declarations cannot certify today's implementation");
assert.ok(registry.rows.every(row => row.certification.requiresCurrentRun === true));
const staticStatus = buildRuntimeStatus(registry);
assert.equal(staticStatus.verificationRun, null);
assert.equal(staticStatus.verificationRows.length, 0, "the committed status projection cannot contain a fabricated run");

const ruleId = "vagabond.master-at-arms.2";
const partial = {
  run: { id: "fixture-result", gitSha: "a".repeat(40), dirty: false, endedAt: "2026-10-05T09:00:00.000Z" },
  byId: { [ruleId]: { full: false, surfaces: { core: { tested: true }, persistence: { tested: true } }, checks: [{ status: "current" }] } },
};
const runtime = buildRuntimeStatus(registry, partial);
assert.equal(runtime.verificationRun.commit, partial.run.gitSha);
assert.equal(runtime.verificationRun.clean, true);
const verified = runtime.verificationRows.find(row => row.id === ruleId);
assert.equal(verified.state, "current");
assert.deepEqual(verified.currentSurfaces, ["core", "persistence"]);
assert.equal(verified.fullPath, false);
assert.equal(verified.canonicalDigest, registry.rows.find(row => row.id === ruleId).provenance.canonicalDigest);
assert.ok(runtime.verificationRows.filter(row => row.id !== ruleId).every(row => row.state === "unverified" && !row.fullPath), "a success is attached only to the explicitly checked rule");
const stale = structuredClone(partial);
stale.byId[ruleId].checks[0].status = "stale";
assert.equal(buildRuntimeStatus(registry, stale).verificationRows.find(row => row.id === ruleId).state, "stale");
const failed = structuredClone(partial);
failed.byId[ruleId].checks[0].status = "failed";
assert.equal(buildRuntimeStatus(registry, failed).verificationRows.find(row => row.id === ruleId).state, "failed");
const browser = { window: {} };
vm.createContext(browser);
vm.runInContext(buildRuntimeScript(registry, partial), browser);
assert.equal(browser.window.DAWN_LIONWING_AUTOMATION_STATUS.verificationRows.find(row => row.id === ruleId).state, "current");
const artifactName = `registry-write-test-${crypto.randomUUID()}`;
const artifactPath = `output/qa-verification/${artifactName}`;
const artifactRoot = path.join(repoRoot, ...artifactPath.split("/"));
const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dawn-verification-outside-"));
try {
  const result = await runAutomationVerification({ repoRoot, outputPath: `${artifactPath}/run.json`, allowDirty: true });
  assert.equal(result.evaluation.run.status, "current");
  const options = { reportPath: `${artifactPath}/run.json`, runtimeOutput: `${artifactPath}/status.js`,
    expectedCommit: result.report.run.gitSha, allowDirty: true };
  fs.symlinkSync(outsideRoot, path.join(artifactRoot, "verification-summary.json"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => writeVerifiedRuntime(registry, options), /links not allowed for artifacts/);
  assert.equal(fs.existsSync(path.join(artifactRoot, "status.js")), false, "validate both output paths before writing either artifact");
  assert.deepEqual(fs.readdirSync(outsideRoot), [], "summary cannot write outside the repository");
  fs.unlinkSync(path.join(artifactRoot, "verification-summary.json"));
  assert.throws(() => writeVerifiedRuntime(registry, { ...options, runtimeOutput: `${artifactPath}/verification-summary.json` }), /must differ/);
  if (process.platform === "win32") assert.throws(() => writeVerifiedRuntime(registry, { ...options, runtimeOutput: `${artifactPath}/VERIFICATION-SUMMARY.JSON` }), /must differ/);
  fs.writeFileSync(path.join(artifactRoot, "verification-summary.json"), "old artifact");
  fs.linkSync(path.join(artifactRoot, "verification-summary.json"), path.join(artifactRoot, "status.js"));
  writeVerifiedRuntime(registry, options);
  assert.ok(fs.existsSync(path.join(artifactRoot, "status.js")));
  assert.match(fs.readFileSync(path.join(artifactRoot, "status.js"), "utf8"), /window\.DAWN_LIONWING_AUTOMATION_STATUS =/, "atomic replacement separates existing hardlink aliases");
  assert.equal(JSON.parse(fs.readFileSync(path.join(artifactRoot, "verification-summary.json"), "utf8")).summary.full, 0);
} finally {
  assert.equal(path.dirname(artifactRoot), path.join(repoRoot, "output", "qa-verification"));
  assert.match(artifactName, /^registry-write-test-[a-f0-9-]+$/);
  assert.equal(path.dirname(outsideRoot), os.tmpdir());
  assert.match(path.basename(outsideRoot), /^dawn-verification-outside-/);
  fs.rmSync(artifactRoot, { recursive: true, force: true });
  fs.rmSync(outsideRoot, { recursive: true, force: true });
}
console.log("LionWing verification registry: historical claims never certify, exact rule projection, partial/stale/failed receipts and browser artifact passed");
