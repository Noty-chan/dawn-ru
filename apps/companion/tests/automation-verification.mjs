import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sceneEngineFiles } from "./load-scene-engine.mjs";
import { defaultVerificationRepoRoot as repoRoot, loadVerificationManifest, validateVerificationManifest,
  verificationRepoPath, verificationDigest, runAutomationVerification, evaluateVerificationReport,
  VERIFICATION_SURFACES, canonicalVerificationRule } from "../automation-verification.mjs";

const copy = value => JSON.parse(JSON.stringify(value));
const actualManifest = loadVerificationManifest({ repoRoot });
assert.equal(actualManifest.rules.length, 3, "start with three honestly scoped rules");
const implementedDependencies = new Set(actualManifest.dependencyGroups["native-scene-runtime"].files);
for (const file of sceneEngineFiles) assert.ok(implementedDependencies.has(`apps/companion/${file}`), `dependency contract includes actually loaded ${file}`);
for (const file of ["data.js", "edition-lionwing.js", "lionwing-table-data.js", "logic.js"]) assert.ok(implementedDependencies.has(`apps/companion/${file}`));
assert.ok(actualManifest.rules.every(rule => rule.coverage === "focused" && !rule.checks.some(check => check.surface === "ui" || check.surface === "network")));
const canonicalPath = "source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json";
for (const [id, profileId, sourceKind, expectedKind] of [
  ["lionwing.npc.executioner.focus", "lionwing.npc.executioner", "npc-action", "enemy-rule"],
  ["lionwing.npc.executioner.cleave", "lionwing.npc.executioner", "npc-action", "enemy-attack"],
  ["lionwing.npc.assassin.passive", "lionwing.npc.assassin", "npc-passive", "enemy-rule"],
]) {
  const rule = canonicalVerificationRule(repoRoot, actualManifest.editionId, { path: canonicalPath, kind: sourceKind, ruleId: id, profileId }, expectedKind);
  assert.equal(rule.id, id);
  assert.equal(rule.profileId, profileId);
  assert.ok(rule.text.length);
}
assert.throws(() => canonicalVerificationRule(repoRoot, actualManifest.editionId, { path: canonicalPath, kind: "npc-action", ruleId: "lionwing.npc.executioner.focus", profileId: "lionwing.npc.executioner" }, "enemy-attack"), /not an attack/);
assert.throws(() => canonicalVerificationRule(repoRoot, actualManifest.editionId, { path: canonicalPath, kind: "npc-action", ruleId: "lionwing.npc.executioner.focus", profileId: "lionwing.npc.assassin" }, "enemy-rule"), /NPC source locator/);
assert.throws(() => canonicalVerificationRule(repoRoot, actualManifest.editionId, { path: canonicalPath, kind: "npc-passive", ruleId: "lionwing.npc.assassin.random-passive", profileId: "lionwing.npc.assassin" }, "enemy-rule"), /passive identity/);
assert.throws(() => canonicalVerificationRule(repoRoot, actualManifest.editionId, { path: canonicalPath, kind: "npc-action", ruleId: "lionwing.npc.assassin.invented", profileId: "lionwing.npc.assassin" }, "enemy-rule"), /missing canonical rule/);
assert.equal(canonicalVerificationRule(repoRoot, actualManifest.editionId, { path: canonicalPath, kind: "core-rule", ruleId: "lionwing.narrator.modifiers.overview" }, "core-rule").id, "lionwing.narrator.modifiers.overview");
assert.equal(verificationDigest("a\r\nb\r\n"), verificationDigest("a\nb\n"), "CRLF/LF does not invalidate proof");
assert.equal(verificationDigest({ b: 1, a: 2 }), verificationDigest({ a: 2, b: 1 }), "object insertion order is irrelevant");
for (const unsafe of ["../outside.json", "C:/outside.json", "\\outside.json", "apps/../outside.json", ".git/HEAD", "apps//companion/data.js", "apps/./companion/data.js"]) {
  assert.throws(() => verificationRepoPath(repoRoot, unsafe), /repository path/);
}

// All negative runner fixtures stay inside the ignored output directory; no
// production files, real Git state, browser or external network are mutated.
const outputRoot = path.join(repoRoot, "output", "qa-verification");
const fixtureName = `contract-test-${crypto.randomUUID()}`;
const fixtureRoot = path.join(outputRoot, fixtureName);
const relativeRoot = `output/qa-verification/${fixtureName}`;
fs.mkdirSync(fixtureRoot, { recursive: true });
const relative = name => `${relativeRoot}/${name}`;
const write = (name, value) => fs.writeFileSync(path.join(fixtureRoot, name), typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
const ruleId = "vagabond.sniper.1";
const manifest = {
  schemaVersion: 1, editionId: "verification-test-fixture", dependencyGroups: { fixture: { files: [relative("implementation.js")] } },
  rules: [{ id: ruleId, kind: "technique", implemented: true, coverage: "focused", requiredSurfaces: [...VERIFICATION_SURFACES],
    source: { path: relative("source.json"), ruleId }, implementationGroups: ["fixture"], checks: [] }],
};
const addCheck = (surface, environment) => {
  const id = `${ruleId}.fixture-${surface}`;
  return { id, surface, environment, claim: `Fixture checks the ledger ${surface} contract only, not the actual rule.`,
    command: { path: relative("scenario.mjs"), args: ["--case", id] },
    testFiles: [relative("scenario.mjs"), relative("behavior.json")], timeoutMs: 5000 };
};
manifest.rules[0].checks = [addCheck("core", "node-core"), addCheck("persistence", "json-reload")];
write("implementation.js", "export const fixture = 1;\n");
write("source.json", { editionId: manifest.editionId, archetypes: [{ id: "vagabond", techniques: [{ id: "vagabond.sniper", notes: "", source: { fixture: true }, levels: [{ n: 1, name: "Fixture", text: "Ledger fixture only." }] }] }] });
write("behavior.json", { mode: "pass" });
write("scenario.mjs", `import fs from 'node:fs';
const behavior = JSON.parse(fs.readFileSync(new URL('./behavior.json', import.meta.url), 'utf8'));
const scenarioId = process.argv[3], ruleId = process.env.DAWN_VERIFICATION_RULE_ID;
const surface = scenarioId.split('fixture-').at(-1);
if (behavior.mode === 'fail') process.exit(1);
if (behavior.mode === 'skip') process.exit(0);
if (behavior.mode === 'change') fs.appendFileSync(new URL('./implementation.js', import.meta.url), '// changed during scenario\\n');
if (behavior.mode === 'timeout') await new Promise(resolve => setTimeout(resolve, 20000));
if (behavior.mode === 'overflow') { process.stdout.write('x'.repeat(1100000)); await new Promise(resolve => setTimeout(resolve, 20000)); }
const environment = behavior.environments?.[surface] || ({core:'node-core',ui:'vm-ui',network:'simulated-network',persistence:'json-reload'})[surface];
const receipt = {schemaVersion:1,ruleId,scenarioId,surface,environment,completed:true};
if (behavior.mode === 'wrong-rule') receipt.ruleId = 'vagabond.untouchable.1';
console.log('DAWN_VERIFICATION_CASE '+JSON.stringify(receipt));
if (behavior.mode === 'duplicate') console.log('DAWN_VERIFICATION_CASE '+JSON.stringify(receipt));
if (behavior.mode === 'fail-after-receipt') process.exit(1);
`);
let sequence = 0;
const run = async (configuration = manifest, scenarioIds = []) => {
  write("manifest.json", configuration);
  return runAutomationVerification({ repoRoot, manifestPath: relative("manifest.json"),
    outputPath: relative(`run-${++sequence}.json`), allowDirty: true, scenarioIds });
};
const evaluate = (report, configuration = manifest, extras = {}) => evaluateVerificationReport({ repoRoot, manifest: configuration, report, ...extras });

try {
  const guardRoot = path.join(fixtureRoot, "guard-repo");
  const guardOutside = path.join(fixtureRoot, "guard-outside");
  fs.mkdirSync(guardRoot);
  fs.mkdirSync(guardOutside);
  fs.symlinkSync(guardOutside, path.join(guardRoot, "summary-link"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => verificationRepoPath(guardRoot, "summary-link/new.json", { mustExist: false }), /symlink outside repository/);
  fs.mkdirSync(path.join(guardRoot, "inside"));
  fs.symlinkSync(path.join(guardRoot, "inside"), path.join(guardRoot, "inside-link"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => verificationRepoPath(guardRoot, "inside-link/new.json", { mustExist: false, allowLinks: false }), /links not allowed for artifacts/);
  fs.symlinkSync(path.join(guardRoot, "inside"), path.join(fixtureRoot, "artifact-link"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(runAutomationVerification({ repoRoot, outputPath: relative("artifact-link/run.json"), allowDirty: true }), /links not allowed for artifacts/);
  const danglingLink = path.join(guardRoot, "dangling.json");
  try {
    fs.symlinkSync(path.join(guardOutside, "missing.json"), danglingLink, "file");
    assert.throws(() => verificationRepoPath(guardRoot, "dangling.json", { mustExist: false }), /unresolvable filesystem link/);
  } catch (error) {
    if (process.platform !== "win32" || !["EPERM", "EACCES"].includes(error.code)) throw error;
    console.log("File symlink regression requires Windows symlink permission; Linux CI executes it.");
  }
  const missing = evaluate(null);
  assert.equal(missing.run.status, "missing");
  assert.equal(missing.byId[ruleId].status, "unverified");
  assert.equal(missing.byId[ruleId].full, false);
  const { report, evaluation } = await run();
  assert.equal(evaluation.run.status, "current");
  assert.equal(evaluation.byId[ruleId].surfaces.core.status, "current");
  assert.equal(evaluation.byId[ruleId].surfaces.persistence.status, "current");
  assert.equal(evaluation.byId[ruleId].surfaces.ui.status, "missing");
  assert.deepEqual(evaluation.byId[ruleId].badges, ["implemented", "core-tested", "persistence-tested"]);
  assert.equal(evaluation.byId[ruleId].full, false);
  const beforeRead = fs.readFileSync(path.join(fixtureRoot, "implementation.js"), "utf8");
  assert.deepEqual(evaluate(report), evaluation);
  assert.equal(fs.readFileSync(path.join(fixtureRoot, "implementation.js"), "utf8"), beforeRead, "evaluation is read-only");

  const partial = copy(report);
  partial.results.pop();
  assert.equal(evaluate(partial).run.status, "partial");
  assert.equal(evaluate(partial).byId[ruleId].surfaces.persistence.tested, false);
  assert.equal(evaluate(partial).byId[ruleId].surfaces.core.tested, true);
  for (const mutate of [
    value => value.results.push(copy(value.results[0])),
    value => value.results[0].ruleId = "vagabond.untouchable.1",
    value => value.results[0].scenarioId = "vagabond.untouchable.1.fixture-core",
    value => value.results[0].gitSha = "0".repeat(40),
    value => value.results[0].surface = "network",
    value => value.results[0].command.args = [],
    value => value.results[0].execution.exitCode = 1,
    value => value.results[0].execution.receipt = null,
    value => value.results[0].execution.receipt.ruleId = "vagabond.untouchable.1",
    value => value.results[0].execution.timedOut = true,
    value => value.results[0].execution.error = "skipped",
    value => value.results[0].execution.signal = "SIGTERM",
    value => value.results[0].execution.endedAt = new Date(Date.parse(value.run.endedAt) + 10000).toISOString(),
    value => value.results[0].execution.durationMs = -1,
    value => value.results[0].after.implementation.push(copy(value.results[0].after.implementation[0])),
    value => value.results[0].before.source.ruleId = "vagabond.untouchable.1",
    value => value.results[0].before.implementation[0].path = "../outside.js",
    value => value.run.gitSha = "0".repeat(40),
    value => value.run.gitSha = "abcd123",
    value => value.run.exitCode = 1,
    value => value.run.endedAt = null,
    value => value.manifestDigest = "invalid",
  ]) {
    const invalid = copy(report);
    mutate(invalid);
    const rejected = evaluate(invalid);
    assert.ok(["invalid", "stale"].includes(rejected.run.status), `malformed evidence rejected: ${JSON.stringify(rejected.run)}`);
    assert.equal(rejected.byId[ruleId].full, false);
    assert.equal(rejected.byId[ruleId].surfaces.core.tested, false);
  }
  const dirty = copy(report); dirty.run.dirty = true;
  assert.equal(evaluate(dirty, manifest, { requireClean: true }).run.status, "invalid");
  assert.ok(evaluate(dirty, manifest, { requireClean: true }).run.issues.includes("dirty-worktree"));
  assert.equal(evaluate(report, manifest, { expectedGitSha: "0".repeat(40) }).run.status, "invalid");

  write("implementation.js", beforeRead.replace(/\n/g, "\r\n"));
  assert.equal(evaluate(report).run.status, "current", "checkout line endings preserve evidence");
  write("implementation.js", `${beforeRead}// dependency changed\n`);
  assert.equal(evaluate(report).run.status, "stale");
  assert.equal(evaluate(report).byId[ruleId].surfaces.core.status, "stale");
  write("implementation.js", beforeRead);
  const sourceBefore = fs.readFileSync(path.join(fixtureRoot, "source.json"), "utf8");
  const sourceChanged = JSON.parse(sourceBefore); sourceChanged.archetypes[0].techniques[0].levels[0].text += " Changed.";
  write("source.json", sourceChanged);
  assert.equal(evaluate(report).run.status, "stale", "rule text changes invalidate actual evidence");
  write("source.json", sourceBefore);
  const testBefore = fs.readFileSync(path.join(fixtureRoot, "scenario.mjs"), "utf8");
  write("scenario.mjs", `${testBefore}// test dependency changed\n`);
  assert.equal(evaluate(report).run.status, "stale");
  write("scenario.mjs", testBefore);
  const contractChanged = copy(manifest); contractChanged.rules[0].checks[0].claim += " Changed.";
  assert.equal(evaluate(report, contractChanged).run.status, "invalid");

  for (const mode of ["fail", "skip", "wrong-rule", "duplicate", "fail-after-receipt"]) {
    write("behavior.json", { mode });
    const failed = await run();
    assert.equal(failed.report.run.exitCode, 1, `${mode} cannot pass the real subprocess gate`);
    assert.equal(failed.evaluation.run.status, "failed");
    assert.equal(failed.evaluation.byId[ruleId].surfaces.core.tested, false);
    assert.equal(failed.evaluation.byId[ruleId].full, false);
  }
  write("behavior.json", { mode: "change" });
  const changed = await run();
  assert.equal(changed.report.run.integrity, "changed");
  assert.equal(changed.evaluation.run.status, "stale");
  assert.equal(changed.evaluation.byId[ruleId].surfaces.core.tested, false);
  write("implementation.js", beforeRead);
  for (const [mode, expectedError] of [["timeout", "scenario-timeout"], ["overflow", "scenario-output-limit"]]) {
    const bounded = copy(manifest);
    bounded.rules[0].checks[0].timeoutMs = mode === "timeout" ? 100 : 3000;
    write("behavior.json", { mode });
    const failed = await run(bounded, [bounded.rules[0].checks[0].id]);
    assert.equal(failed.report.results[0].execution.error, expectedError);
    assert.equal(failed.evaluation.byId[ruleId].surfaces.core.tested, false);
  }
  write("behavior.json", { mode: "pass" });
  const selected = await run(manifest, [manifest.rules[0].checks[0].id]);
  assert.equal(selected.evaluation.run.status, "partial");
  assert.equal(selected.evaluation.byId[ruleId].surfaces.persistence.status, "missing");
  await assert.rejects(run(manifest, ["unknown"]), /unknown or duplicate selected scenario/);
  await assert.rejects(run(manifest, [manifest.rules[0].checks[0].id, manifest.rules[0].checks[0].id]), /unknown or duplicate selected scenario/);
  await assert.rejects(runAutomationVerification({ repoRoot, manifestPath: relative("manifest.json"), outputPath: "apps/companion/fake-result.json", allowDirty: true }), /artifacts must be JSON under ignored/);

  const completeHarness = copy(manifest);
  completeHarness.rules[0].coverage = "complete";
  completeHarness.rules[0].checks.push(addCheck("ui", "vm-ui"), addCheck("network", "simulated-network"));
  const harnessOnly = await run(completeHarness);
  assert.equal(harnessOnly.evaluation.summary.uiTested, 1);
  assert.equal(harnessOnly.evaluation.summary.networkTested, 1);
  assert.equal(harnessOnly.evaluation.byId[ruleId].surfaces.ui.fullPath, false);
  assert.equal(harnessOnly.evaluation.byId[ruleId].surfaces.network.fullPath, false);
  assert.equal(harnessOnly.evaluation.byId[ruleId].surfaces.persistence.fullPath, false);
  assert.equal(harnessOnly.evaluation.byId[ruleId].full, false, "VM/simulated network/JSON reload cannot prove the complete user path");

  // This protocol fixture models the eligibility gate only; actual rule
  // manifests remain focused and contain no browser/live-network claims.
  const eligible = copy(completeHarness);
  for (const check of eligible.rules[0].checks) check.environment = ({ core: "node-core", ui: "browser-e2e", network: "live-network", persistence: "browser-reload" })[check.surface];
  write("behavior.json", { mode: "pass", environments: { core: "node-core", ui: "browser-e2e", network: "live-network", persistence: "browser-reload" } });
  const complete = await run(eligible);
  assert.equal(complete.evaluation.byId[ruleId].full, true, "explicit complete contracts require current evidence on all real user surfaces");
  const focused = copy(eligible); focused.rules[0].coverage = "focused";
  assert.equal((await run(focused)).evaluation.byId[ruleId].full, false, "even four surfaces cannot promote a focused semantic claim to complete");
  write("behavior.json", { mode: "pass" });

  for (const mutate of [
    value => value.rules.push(copy(value.rules[0])),
    value => value.rules[0].checks.push(copy(value.rules[0].checks[0])),
    value => value.rules[0].source.ruleId = "vagabond.untouchable.1",
    value => value.rules[0].requiredSurfaces = ["core"],
    value => value.rules[0].implementationGroups = ["missing"],
    value => value.rules[0].checks[0].command.path = "../outside.mjs",
    value => value.rules[0].checks[0].command.args = ["--case", value.rules[0].checks[1].id],
    value => value.rules[0].checks[0].testFiles = [relative("behavior.json")],
    value => value.rules[0].checks[0].environment = "live-network",
  ]) {
    const invalid = copy(manifest); mutate(invalid);
    assert.throws(() => validateVerificationManifest(invalid, { repoRoot }), /Automation verification:/);
  }
  const doubleSource = JSON.parse(sourceBefore);
  doubleSource.archetypes[0].techniques[0].levels.push(copy(doubleSource.archetypes[0].techniques[0].levels[0]));
  write("source.json", doubleSource);
  assert.throws(() => validateVerificationManifest(manifest, { repoRoot }), /duplicate canonical rule/);
  write("source.json", sourceBefore);
} finally {
  const checked = path.resolve(fixtureRoot), expected = path.resolve(outputRoot, fixtureName);
  assert.equal(checked, expected);
  assert.equal(path.relative(outputRoot, checked), fixtureName);
  assert.match(fixtureName, /^contract-test-[a-f0-9-]+$/);
  fs.rmSync(checked, { recursive: true, force: true });
}

console.log("Automation verification contract passed: real scoped subprocess receipts, revision/dependency invalidation, partial/failed/dirty/mixed evidence, CRLF stability and honest surface completeness");
