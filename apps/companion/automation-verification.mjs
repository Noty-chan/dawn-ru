import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const VERIFICATION_SCHEMA_VERSION = 1;
export const VERIFICATION_SURFACES = Object.freeze(["core", "ui", "network", "persistence"]);
export const DEFAULT_VERIFICATION_MANIFEST = "apps/companion/automation-verification.manifest.json";
export const DEFAULT_VERIFICATION_REPORT = "output/qa-verification/automation-verification.json";
export const VERIFICATION_CASE_PREFIX = "DAWN_VERIFICATION_CASE ";
export const defaultVerificationRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const runtimeFiles = ["apps/companion/automation-verification.mjs", "apps/companion/run_automation_verification.mjs"];
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const environments = {
  core: ["node-core"],
  ui: ["vm-ui", "browser-e2e"],
  network: ["simulated-network", "live-network"],
  persistence: ["json-reload", "browser-reload", "database-roundtrip"],
};
const completeEnvironments = {
  core: ["node-core"], ui: ["browser-e2e"], network: ["live-network"],
  persistence: ["browser-reload", "database-roundtrip"],
};
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(`Automation verification: ${message}`); };
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const canonicalValue = value => Array.isArray(value) ? value.map(canonicalValue)
  : isObject(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])])) : value;
export const verificationDigest = value => `sha256:${crypto.createHash("sha256").update(typeof value === "string" ? value.replace(/\r\n/g, "\n") : JSON.stringify(canonicalValue(value))).digest("hex")}`;
const same = (left, right) => JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));
const rootCompare = value => process.platform === "win32" ? value.toLowerCase() : value;
const within = (root, candidate) => {
  const relative = path.relative(rootCompare(root), rootCompare(candidate));
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

// Every manifest path is repository relative. Check both the lexical path and
// its actual filesystem target; a symlink/junction must not escape the repo.
export function verificationRepoPath(repoRoot, relative, { mustExist = true, file = true, allowLinks = true } = {}) {
  if (typeof relative !== "string" || !relative || relative.includes("\0") || relative.includes("\\") || relative.includes(":") || path.isAbsolute(relative)) fail(`invalid repository path ${String(relative)}`);
  const parts = relative.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) fail(`unsafe repository path ${relative}`);
  const root = fs.realpathSync(repoRoot), resolved = path.resolve(root, ...parts);
  if (!within(root, resolved)) fail(`path outside repository: ${relative}`);
  if (!allowLinks) {
    let component = root;
    for (const part of parts) {
      component = path.join(component, part);
      try {
        if (fs.lstatSync(component).isSymbolicLink()) fail(`filesystem links not allowed for artifacts: ${relative}`);
      } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
    }
  }
  let existing = resolved;
  while (true) {
    try {
      fs.lstatSync(existing);
      break;
    } catch (error) {
      if (error.code !== "ENOENT") fail(`unresolvable path ${relative}`);
      const parent = path.dirname(existing);
      if (parent === existing) fail(`unresolvable path ${relative}`);
      existing = parent;
    }
  }
  let actual;
  try { actual = fs.realpathSync(existing); }
  catch { fail(`unresolvable filesystem link: ${relative}`); }
  if (!within(root, actual)) fail(`symlink outside repository: ${relative}`);
  if (mustExist && !fs.existsSync(resolved)) fail(`missing file ${relative}`);
  if (mustExist && file && !fs.statSync(resolved).isFile()) fail(`not a file: ${relative}`);
  return resolved;
}

const paths = (repoRoot, values, label) => {
  if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== "string") || new Set(values.map(value => rootCompare(value))).size !== values.length) fail(`${label} requires unique paths`);
  values.forEach(value => verificationRepoPath(repoRoot, value));
};

export function validateVerificationManifest(manifest, { repoRoot = defaultVerificationRepoRoot } = {}) {
  if (!isObject(manifest) || manifest.schemaVersion !== VERIFICATION_SCHEMA_VERSION || typeof manifest.editionId !== "string" || !manifest.editionId || !isObject(manifest.dependencyGroups) || !Array.isArray(manifest.rules)) fail("unsupported manifest schema");
  for (const [id, group] of Object.entries(manifest.dependencyGroups)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !isObject(group)) fail(`invalid dependency group ${id}`);
    paths(repoRoot, group.files, `dependency group ${id}`);
  }
  const ruleIds = new Set(), scenarioIds = new Set();
  for (const rule of manifest.rules) {
    if (!isObject(rule) || !/^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/.test(rule.id || "") || ruleIds.has(rule.id)) fail(`missing or duplicate stable rule id ${rule?.id}`);
    ruleIds.add(rule.id);
    if (!["technique", "enemy-rule", "enemy-attack", "core-rule"].includes(rule.kind) || typeof rule.implemented !== "boolean" || !["focused", "complete"].includes(rule.coverage)) fail(`invalid implementation/coverage declaration for ${rule.id}`);
    if (!same([...rule.requiredSurfaces || []].sort(), [...VERIFICATION_SURFACES].sort())) fail(`${rule.id} must retain all four required surfaces`);
    if (!isObject(rule.source) || rule.source.ruleId !== rule.id) fail(`mixed source rule id for ${rule.id}`);
    verificationRepoPath(repoRoot, rule.source.path);
    if (!Array.isArray(rule.implementationGroups) || !rule.implementationGroups.length || new Set(rule.implementationGroups).size !== rule.implementationGroups.length || rule.implementationGroups.some(id => !manifest.dependencyGroups[id])) fail(`unknown implementation dependencies for ${rule.id}`);
    if (!Array.isArray(rule.checks) || !rule.checks.length) fail(`no scoped checks for ${rule.id}`);
    for (const check of rule.checks) {
      if (!isObject(check) || !/^[a-z][a-z0-9.-]*$/.test(check.id || "") || scenarioIds.has(check.id) || !check.id.startsWith(`${rule.id}.`)) fail(`missing, duplicate or mixed scenario id ${check?.id}`);
      scenarioIds.add(check.id);
      if (!VERIFICATION_SURFACES.includes(check.surface) || !environments[check.surface].includes(check.environment)) fail(`invalid surface/environment for ${check.id}`);
      if (typeof check.claim !== "string" || !check.claim.trim()) fail(`missing scenario claim for ${check.id}`);
      if (!isObject(check.command) || typeof check.command.path !== "string" || !check.command.path.endsWith(".mjs") || !Array.isArray(check.command.args) || check.command.args.some(arg => typeof arg !== "string" || arg.includes("\0"))) fail(`only explicit Node scenario commands are supported for ${check.id}`);
      verificationRepoPath(repoRoot, check.command.path);
      if (!same(check.command.args, ["--case", check.id])) fail(`command must select only ${check.id}`);
      paths(repoRoot, check.testFiles, `test dependencies for ${check.id}`);
      if (!check.testFiles.includes(check.command.path)) fail(`command omitted from test dependencies for ${check.id}`);
      if (!Number.isInteger(check.timeoutMs) || check.timeoutMs < 100 || check.timeoutMs > 120_000) fail(`invalid timeout for ${check.id}`);
    }
    canonicalVerificationRule(repoRoot, manifest.editionId, rule.source, rule.kind);
  }
  return manifest;
}

export function loadVerificationManifest({ repoRoot = defaultVerificationRepoRoot, manifestPath = DEFAULT_VERIFICATION_MANIFEST } = {}) {
  const manifest = JSON.parse(fs.readFileSync(verificationRepoPath(repoRoot, manifestPath), "utf8"));
  return validateVerificationManifest(manifest, { repoRoot });
}

export function canonicalVerificationRule(repoRoot, editionId, source, expectedKind = "technique") {
  const document = JSON.parse(fs.readFileSync(verificationRepoPath(repoRoot, source.path), "utf8"));
  if (document.editionId !== editionId) fail(`wrong canonical edition for ${source.ruleId}`);
  const sourceKind = source.kind || "technique";
  const seen = new Set(), rows = [];
  const add = row => {
    if (!row.id || seen.has(row.id)) fail(`duplicate canonical rule id ${row.id}`);
    seen.add(row.id);
    if (row.id === source.ruleId) rows.push(row);
  };
  if (sourceKind === "technique") {
    if (expectedKind !== "technique" || !Array.isArray(document.archetypes) || !/\.[1-9][0-9]*$/.test(source.ruleId || "")) fail(`invalid technique source locator for ${source.ruleId}`);
    for (const archetype of document.archetypes) {
    for (const technique of archetype.techniques || []) {
      for (const level of technique.levels || []) {
        const id = `${technique.id}.${level.n}`;
        add({ id, archetypeId: archetype.id, techniqueId: technique.id,
          name: level.name, text: level.text, notes: technique.notes ?? "", source: technique.source ?? null });
      }
    }
    }
  } else if (["npc-action", "npc-passive"].includes(sourceKind)) {
    if (!["enemy-rule", "enemy-attack"].includes(expectedKind) || !Array.isArray(document.coreRules?.npcs?.list) || !/^lionwing\.npc\.[a-z0-9-]+$/.test(source.profileId || "") || !source.ruleId.startsWith(`${source.profileId}.`)) fail(`invalid NPC source locator for ${source.ruleId}`);
    const profileIds = new Set();
    for (const profile of document.coreRules.npcs.list) {
      if (profileIds.has(profile.id)) fail(`duplicate canonical NPC profile ${profile.id}`);
      profileIds.add(profile.id);
      const metadata = { profileId: profile.id, profileName: profile.name, statistics: profile.statistics ?? null,
        role: profile.role ?? null, passive: profile.passive ?? "", source: profile.source ?? null };
      if (sourceKind === "npc-passive") {
        if (expectedKind !== "enemy-rule" || source.ruleId !== `${source.profileId}.passive`) fail(`invalid NPC passive identity for ${source.ruleId}`);
        if (profile.id === source.profileId && typeof profile.passive === "string" && profile.passive.trim()) add({ id: `${profile.id}.passive`, ...metadata, text: profile.passive });
      } else {
        for (const action of [...(profile.actions || []), ...(profile.ace ? [{ ...profile.ace, kind: "trump" }] : [])]) {
          if (!action.id?.startsWith(`${profile.id}.`)) fail(`mixed canonical NPC action ${action.id}`);
          if (seen.has(action.id)) fail(`duplicate canonical rule id ${action.id}`);
          // Keep action IDs globally unique even when a different profile is
          // selected, then verify the exact profile and action kind below.
          if (profile.id === source.profileId) add({ ...metadata, ...action, profileId: profile.id, source: profile.source ?? null });
          else seen.add(action.id);
        }
      }
    }
    if (!profileIds.has(source.profileId)) fail(`missing canonical NPC profile ${source.profileId}`);
    if (expectedKind === "enemy-attack" && rows[0]?.kind !== "attack") fail(`NPC source is not an attack: ${source.ruleId}`);
  } else if (sourceKind === "core-rule") {
    if (expectedKind !== "core-rule" || !Array.isArray(document.coreRules?.rules)) fail(`invalid core rule source locator for ${source.ruleId}`);
    document.coreRules.rules.forEach(add);
  } else {
    fail(`unsupported canonical source locator ${sourceKind}`);
  }
  if (rows.length !== 1 || typeof rows[0].text !== "string") fail(`missing canonical rule ${source.ruleId}`);
  return rows[0];
}

const fileDigest = (repoRoot, file) => ({ path: file, digest: verificationDigest(fs.readFileSync(verificationRepoPath(repoRoot, file), "utf8")) });
const collectFiles = (repoRoot, files) => [...new Set(files)].sort().map(file => fileDigest(repoRoot, file));
const ruleContract = (manifest, rule, check) => ({ schemaVersion: manifest.schemaVersion, editionId: manifest.editionId,
  rule: { ...rule, checks: undefined }, check,
  implementation: rule.implementationGroups.map(id => ({ id, files: manifest.dependencyGroups[id].files })),
});

export function captureVerificationInputs({ repoRoot = defaultVerificationRepoRoot, manifest, rule, check } = {}) {
  return {
    contractDigest: verificationDigest(ruleContract(manifest, rule, check)),
    source: { ...fileDigest(repoRoot, rule.source.path), ruleId: rule.id,
      ruleDigest: verificationDigest(canonicalVerificationRule(repoRoot, manifest.editionId, rule.source, rule.kind)) },
    implementation: collectFiles(repoRoot, rule.implementationGroups.flatMap(id => manifest.dependencyGroups[id].files)),
    tests: collectFiles(repoRoot, [...check.testFiles, ...runtimeFiles]),
  };
}

export function verificationGitState(repoRoot = defaultVerificationRepoRoot) {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", windowsHide: true }).trim();
  if (!shaPattern.test(sha)) fail("Git HEAD must be a full 40-character SHA");
  const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: repoRoot, encoding: "utf8", windowsHide: true }).replace(/\r\n/g, "\n");
  return { sha, dirty: Boolean(status.trim()), statusDigest: verificationDigest(status) };
}

const allChecks = manifest => manifest.rules.flatMap(rule => rule.checks.map(check => ({ rule, check })));
const allSnapshots = (repoRoot, manifest) => allChecks(manifest).map(({ rule, check }) => ({ ruleId: rule.id, scenarioId: check.id,
  inputs: captureVerificationInputs({ repoRoot, manifest, rule, check }) }));
const parseReceipt = (stdout, rule, check) => {
  const rows = stdout.split(/\r?\n/).filter(row => row.startsWith(VERIFICATION_CASE_PREFIX));
  if (rows.length !== 1) return { error: "missing-or-duplicate-scenario-receipt" };
  let receipt;
  try { receipt = JSON.parse(rows[0].slice(VERIFICATION_CASE_PREFIX.length)); } catch { return { error: "invalid-scenario-receipt" }; }
  const expected = { schemaVersion: 1, ruleId: rule.id, scenarioId: check.id, surface: check.surface, environment: check.environment, completed: true };
  if (!same(receipt, expected)) return { error: "mixed-scenario-receipt" };
  return { receipt };
};

function executeScenario(repoRoot, rule, check) {
  return new Promise(resolve => {
    const startedAt = new Date().toISOString(), start = performance.now();
    let stdout = "", stderr = "", outputBytes = 0, error = null, timedOut = false;
    const child = spawn(process.execPath, [verificationRepoPath(repoRoot, check.command.path), ...check.command.args], {
      cwd: repoRoot, shell: false, windowsHide: true,
      env: { ...process.env, DAWN_VERIFICATION_RULE_ID: rule.id, DAWN_VERIFICATION_SCENARIO: check.id },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = (kind, chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > 1_048_576) { error ||= "scenario-output-limit"; child.kill(); return; }
      if (kind === "stdout") stdout += chunk.toString("utf8"); else stderr += chunk.toString("utf8");
    };
    child.stdout.on("data", chunk => append("stdout", chunk));
    child.stderr.on("data", chunk => append("stderr", chunk));
    child.on("error", value => { error = `spawn-failed: ${value.code || value.message}`; });
    const timeout = setTimeout(() => { timedOut = true; error = "scenario-timeout"; child.kill(); }, check.timeoutMs);
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      const parsed = parseReceipt(stdout, rule, check);
      resolve({ startedAt, endedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start),
        exitCode, signal, timedOut, error: error || (exitCode !== 0 ? "scenario-failed" : parsed.error) || null,
        receipt: parsed.receipt || null,
        stdoutDigest: verificationDigest(stdout), stderrDigest: verificationDigest(stderr),
        stdoutTail: stdout.slice(-4000), stderrTail: stderr.slice(-4000) });
    });
  });
}

const safeArtifactPath = (repoRoot, outputPath) => {
  if (typeof outputPath !== "string" || !outputPath.startsWith("output/qa-verification/") || !outputPath.endsWith(".json")) fail("run artifacts must be JSON under ignored output/qa-verification/");
  return verificationRepoPath(repoRoot, outputPath, { mustExist: false, allowLinks: false });
};

// The runner is the only writer. Registry generators consume this report with
// evaluateVerificationReport; they never replace static evidence with a claim.
export async function runAutomationVerification({ repoRoot = defaultVerificationRepoRoot,
  manifestPath = DEFAULT_VERIFICATION_MANIFEST, outputPath = DEFAULT_VERIFICATION_REPORT,
  allowDirty = false, scenarioIds = [], onProgress = () => {} } = {}) {
  const reportPath = safeArtifactPath(repoRoot, outputPath), manifest = loadVerificationManifest({ repoRoot, manifestPath });
  const beforeGit = verificationGitState(repoRoot);
  if (beforeGit.dirty && !allowDirty) fail("dirty worktree; commit the checked code, or use --allow-dirty for local evidence explicitly marked as a worktree run");
  const available = allChecks(manifest);
  if (!Array.isArray(scenarioIds) || new Set(scenarioIds).size !== scenarioIds.length || scenarioIds.some(id => !available.some(({ check }) => check.id === id))) fail("unknown or duplicate selected scenario id");
  const selected = scenarioIds.length ? available.filter(({ check }) => scenarioIds.includes(check.id)) : available;
  const initialInputs = allSnapshots(repoRoot, manifest);
  const report = { schemaVersion: VERIFICATION_SCHEMA_VERSION, kind: "dawn-automation-verification-run", editionId: manifest.editionId,
    manifestDigest: verificationDigest(manifest), run: { id: crypto.randomUUID(), gitSha: beforeGit.sha,
      dirty: beforeGit.dirty, gitStatusDigest: beforeGit.statusDigest, nodeVersion: process.version,
      startedAt: new Date().toISOString(), endedAt: null, integrity: "stable" }, results: [] };
  for (const { rule, check } of selected) {
    const before = captureVerificationInputs({ repoRoot, manifest, rule, check });
    onProgress({ ruleId: rule.id, scenarioId: check.id, state: "running" });
    const execution = await executeScenario(repoRoot, rule, check);
    let after, inputError = null;
    try { after = captureVerificationInputs({ repoRoot, manifest, rule, check }); } catch (error) { after = null; inputError = error.message; }
    const stable = !inputError && same(before, after);
    const result = { ruleId: rule.id, scenarioId: check.id, surface: check.surface, environment: check.environment,
      claim: check.claim, command: { executable: "node", path: check.command.path, args: check.command.args },
      gitSha: beforeGit.sha, before, after, execution,
      status: !stable ? "changed" : execution.error ? "failed" : "passed", inputError };
    report.results.push(result);
    onProgress({ ruleId: rule.id, scenarioId: check.id, state: result.status });
  }
  const afterGit = verificationGitState(repoRoot);
  let finalInputs, finalManifest;
  try { finalManifest = loadVerificationManifest({ repoRoot, manifestPath }); finalInputs = allSnapshots(repoRoot, finalManifest); }
  catch (error) { finalInputs = null; report.run.inputError = error.message; }
  if (afterGit.sha !== beforeGit.sha || !same(manifest, finalManifest) || !same(initialInputs, finalInputs) || report.results.some(result => result.status === "changed")) report.run.integrity = "changed";
  report.run.dirty ||= afterGit.dirty;
  report.run.endedAt = new Date().toISOString();
  report.run.exitCode = report.run.integrity !== "stable" || report.results.some(result => result.status !== "passed") ? 1 : 0;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  // Recheck the directory after mkdir, before touching it, including junctions.
  verificationRepoPath(repoRoot, outputPath, { mustExist: false, allowLinks: false });
  const temporary = `${reportPath}.${report.run.id}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  fs.renameSync(temporary, reportPath);
  return { report, outputPath, evaluation: evaluateVerificationReport({ repoRoot, manifest, report, requireClean: !allowDirty }) };
}

const inputShape = inputs => isObject(inputs) && digestPattern.test(inputs.contractDigest || "")
  && isObject(inputs.source) && digestPattern.test(inputs.source.digest || "") && digestPattern.test(inputs.source.ruleDigest || "")
  && [inputs.implementation, inputs.tests].every(rows => Array.isArray(rows) && rows.length && rows.every(row => isObject(row) && typeof row.path === "string" && digestPattern.test(row.digest || "")) && new Set(rows.map(row => row.path)).size === rows.length);

function blankRules(manifest, status = "missing") {
  return Object.fromEntries(manifest.rules.map(rule => [rule.id, {
    id: rule.id, implemented: rule.implemented, implementationStatus: rule.implemented ? "implemented" : "not-implemented",
    status: "unverified", coverage: rule.coverage, full: false, badges: rule.implemented ? ["implemented"] : [],
    surfaces: Object.fromEntries(VERIFICATION_SURFACES.map(surface => [surface, { status, tested: false, fullPath: false, checks: [] }])),
    checks: rule.checks.map(check => ({ id: check.id, surface: check.surface, environment: check.environment, status, reasons: [] })),
  }]));
}

// Read-only. A report is evidence for one exact code revision and dependency
// snapshot. Missing, failed, malformed, dirty publication or stale evidence
// cannot become current merely because a test file or old audit entry exists.
export function evaluateVerificationReport({ repoRoot = defaultVerificationRepoRoot, manifest, report = null,
  expectedGitSha, requireClean = false } = {}) {
  manifest ||= loadVerificationManifest({ repoRoot });
  validateVerificationManifest(manifest, { repoRoot });
  const byId = blankRules(manifest), issues = [];
  const result = { schemaVersion: VERIFICATION_SCHEMA_VERSION, editionId: manifest.editionId,
    run: { status: report ? "invalid" : "missing", gitSha: null, dirty: null, currentCommit: null, issues }, byId,
    summary: { rules: manifest.rules.length, implemented: manifest.rules.filter(rule => rule.implemented).length,
      coreTested: 0, uiTested: 0, networkTested: 0, persistenceTested: 0, full: 0 } };
  if (!report) return result;
  const invalidate = reason => { issues.push(reason); result.byId = blankRules(manifest, "invalid"); return result; };
  if (!isObject(report) || report.schemaVersion !== VERIFICATION_SCHEMA_VERSION || report.kind !== "dawn-automation-verification-run" || report.editionId !== manifest.editionId || !isObject(report.run) || !Array.isArray(report.results)) return invalidate("invalid-report-schema");
  if (!shaPattern.test(report.run.gitSha || "") || typeof report.run.dirty !== "boolean" || !digestPattern.test(report.run.gitStatusDigest || "") || !/^v\d+\.\d+\.\d+(?:[-+].*)?$/.test(report.run.nodeVersion || "") || typeof report.run.id !== "string" || !report.run.id || !Number.isFinite(Date.parse(report.run.startedAt)) || !Number.isFinite(Date.parse(report.run.endedAt)) || Date.parse(report.run.endedAt) < Date.parse(report.run.startedAt) || ![0, 1].includes(report.run.exitCode) || !["stable", "changed"].includes(report.run.integrity)) return invalidate("invalid-run-provenance");
  result.run.gitSha = report.run.gitSha; result.run.dirty = report.run.dirty;
  let git;
  try { git = verificationGitState(repoRoot); } catch { return invalidate("missing-current-git-revision"); }
  const expected = expectedGitSha || git.sha;
  result.run.currentCommit = git.sha;
  if (!shaPattern.test(expected) || git.sha !== expected || report.run.gitSha !== expected) return invalidate("wrong-git-commit");
  if (requireClean && (report.run.dirty || git.dirty)) return invalidate("dirty-worktree");
  if (report.manifestDigest !== verificationDigest(manifest)) return invalidate("changed-manifest-contract");
  const index = new Map(allChecks(manifest).map(entry => [entry.check.id, entry])), seen = new Set();
  for (const row of report.results) {
    if (!isObject(row) || seen.has(row.scenarioId) || !index.has(row.scenarioId)) return invalidate("unknown-or-duplicate-result-id");
    seen.add(row.scenarioId);
    const { rule, check } = index.get(row.scenarioId);
    if (row.ruleId !== rule.id || row.surface !== check.surface || row.environment !== check.environment || row.gitSha !== report.run.gitSha || row.claim !== check.claim || !same(row.command, { executable: "node", path: check.command.path, args: check.command.args })) return invalidate("mixed-result-identity");
    if (!["passed", "failed", "changed"].includes(row.status) || !inputShape(row.before) || (row.after !== null && !inputShape(row.after)) || !isObject(row.execution)) return invalidate("invalid-result-shape");
    if (row.before.source.ruleId !== rule.id || (row.after && row.after.source.ruleId !== rule.id)) return invalidate("mixed-input-rule-identity");
    const execution = row.execution;
    if (!Number.isFinite(Date.parse(execution.startedAt)) || !Number.isFinite(Date.parse(execution.endedAt)) || Date.parse(execution.endedAt) < Date.parse(execution.startedAt) || Date.parse(execution.startedAt) < Date.parse(report.run.startedAt) || Date.parse(execution.endedAt) > Date.parse(report.run.endedAt) || !Number.isFinite(execution.durationMs) || execution.durationMs < 0 || !(execution.exitCode === null || Number.isInteger(execution.exitCode)) || !(execution.signal === null || typeof execution.signal === "string") || typeof execution.timedOut !== "boolean" || !(execution.error === null || typeof execution.error === "string") || !digestPattern.test(execution.stdoutDigest || "") || !digestPattern.test(execution.stderrDigest || "")) return invalidate("invalid-execution-provenance");
    const expectedReceipt = { schemaVersion: 1, ruleId: rule.id, scenarioId: check.id, surface: check.surface, environment: check.environment, completed: true };
    if (row.status === "passed" && (execution.exitCode !== 0 || execution.signal || execution.timedOut !== false || execution.error !== null || !same(execution.receipt, expectedReceipt) || !same(row.before, row.after) || row.inputError)) return invalidate("passed-result-without-successful-execution");
    if (row.status === "failed" && !execution.error) return invalidate("failed-result-without-failure");
    if (row.status === "changed" && same(row.before, row.after)) return invalidate("changed-result-without-change");
  }
  if (report.run.exitCode === 0 && (report.run.integrity !== "stable" || report.results.some(row => row.status !== "passed"))) return invalidate("successful-run-with-failed-result");
  if (report.run.exitCode === 1 && report.run.integrity === "stable" && report.results.every(row => row.status === "passed")) return invalidate("failed-run-without-failed-result");
  const reportIndex = new Map(report.results.map(row => [row.scenarioId, row]));
  for (const rule of manifest.rules) {
    const state = byId[rule.id];
    for (const check of state.checks) {
      const row = reportIndex.get(check.id);
      if (!row) { check.reasons.push("no-actual-run"); continue; }
      if (report.run.integrity !== "stable" || row.status === "changed") { check.status = "stale"; check.reasons.push("inputs-changed-during-run"); continue; }
      let inputs;
      try { inputs = captureVerificationInputs({ repoRoot, manifest, rule, check: rule.checks.find(item => item.id === check.id) }); }
      catch { check.status = "stale"; check.reasons.push("missing-current-dependency"); continue; }
      if (!same(row.before, inputs) || !same(row.after, inputs)) { check.status = "stale"; check.reasons.push("dependency-digest-changed"); continue; }
      check.status = row.status === "passed" ? "current" : "failed";
      if (check.status === "failed") check.reasons.push(row.execution.error);
    }
    for (const surface of VERIFICATION_SURFACES) {
      const checks = state.checks.filter(check => check.surface === surface), target = state.surfaces[surface];
      target.checks = clone(checks);
      target.status = !checks.length ? "missing" : checks.some(check => check.status === "stale") ? "stale"
        : checks.some(check => check.status === "failed") ? "failed" : checks.some(check => check.status === "missing") ? "missing" : "current";
      target.tested = target.status === "current";
      target.fullPath = target.tested && checks.some(check => completeEnvironments[surface].includes(check.environment));
      if (target.tested) { state.badges.push(`${surface}-tested`); result.summary[`${surface}Tested`]++; }
    }
    state.full = rule.implemented && rule.coverage === "complete" && VERIFICATION_SURFACES.every(surface => state.surfaces[surface].fullPath);
    if (state.full) { state.badges.push("full"); result.summary.full++; }
    state.status = state.full ? "full" : state.badges.includes("core-tested") ? "core-tested" : state.badges.length > Number(state.implemented) ? "partially-tested" : "unverified";
  }
  const statuses = Object.values(byId).flatMap(rule => rule.checks.map(check => check.status));
  result.run.status = report.run.integrity !== "stable" || statuses.includes("stale") ? "stale"
    : statuses.includes("failed") || report.run.exitCode !== 0 ? "failed" : statuses.includes("missing") ? "partial" : "current";
  result.run.id = report.run.id; result.run.startedAt = report.run.startedAt; result.run.endedAt = report.run.endedAt;
  result.run.nodeVersion = report.run.nodeVersion;
  return result;
}

export function readVerificationReport({ repoRoot = defaultVerificationRepoRoot, reportPath = DEFAULT_VERIFICATION_REPORT } = {}) {
  return JSON.parse(fs.readFileSync(verificationRepoPath(repoRoot, reportPath), "utf8"));
}
