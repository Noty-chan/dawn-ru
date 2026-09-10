import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadSceneEngine } from "./tests/load-scene-engine.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, "..", "..");
const editionPath = path.join(repoRoot, "source", "editions", "dawn-en-lionwing-cb2f8e67", "extracted-companion.json");
const reviewPath = path.join(root, "lionwing-automation-registry.review.json");
const evidencePath = path.join(root, "automation-evidence.json");
const jsonTarget = path.join(root, "LIONWING-AUTOMATION-REGISTRY.json");
const markdownTarget = path.join(root, "LIONWING-AUTOMATION-REGISTRY.md");
const EXPECTED_EDITION = "dawn-en-lionwing-cb2f8e67";
const SURFACES = ["core", "ui", "network", "persistence"];
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const canonicalLevelDigest = (techniqueId, level) => sha256(JSON.stringify({ techniqueId, ...level }));
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const fail = message => { throw new Error(message); };
const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const escapeCell = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();

function loadCoverage() {
  const canonical = readJson(editionPath);
  const context = { console, Date };
  context.globalThis = context;
  context.window = context;
  for (const file of ["edition-lionwing.js", "technique-foundation-map.js"]) {
    vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  loadSceneEngine(context);
  vm.runInNewContext(fs.readFileSync(path.join(root, "technique-engine.js"), "utf8"), context, { filename: "technique-engine.js" });
  if (context.DAWN_LIONWING_DATA?.editionId !== EXPECTED_EDITION) fail("LionWing registry must use the canonical edition");
  const coverage = context.DAWN_TECHNIQUE_ENGINE.techniqueCoverage(context.DAWN_LIONWING_DATA);
  return { canonical, coverage };
}

function canonicalRows(canonical) {
  if (!isObject(canonical) || canonical.editionId !== EXPECTED_EDITION) fail("Canonical LionWing edition is missing or incorrect");
  const rows = [];
  const ids = new Set();
  for (const archetype of canonical.archetypes || []) for (const technique of archetype.techniques || []) for (const level of technique.levels || []) {
    const id = `${technique.id}.${level.n}`;
    if (ids.has(id)) fail(`Canonical LionWing has duplicate level id: ${id}`);
    ids.add(id);
    rows.push({ id, archetype, technique, level, canonicalDigest: canonicalLevelDigest(technique.id, level) });
  }
  if (rows.length !== 333) fail(`Expected 333 canonical LionWing levels, got ${rows.length}`);
  if (rows.some(row => row.id.includes("servant-s-call"))) fail("Removed Servant's Call must not enter the LionWing registry");
  return rows;
}

function validateReview(review, known) {
  if (!isObject(review) || review.schemaVersion !== 1 || review.editionId !== EXPECTED_EDITION || !Array.isArray(review.entries)) {
    fail("lionwing-automation-registry.review.json: unsupported schema or edition");
  }
  if (!review.auditDocument || !fs.existsSync(path.join(repoRoot, review.auditDocument))) fail("Review audit document is missing");
  const auditText = fs.readFileSync(path.join(repoRoot, review.auditDocument), "utf8");
  if (!auditText.includes("Исправленные границы")) fail("Review audit document has no corrected-boundaries section");
  const seen = new Set();
  const result = new Map();
  for (const entry of review.entries) {
    if (!isObject(entry) || typeof entry.id !== "string" || !entry.id) fail("Review entry has no id");
    if (seen.has(entry.id)) fail(`Review entries contain duplicate id: ${entry.id}`);
    seen.add(entry.id);
    const source = known.get(entry.id);
    if (!source) fail(`Review entry references unknown canonical level id: ${entry.id}`);
    const techniqueId = entry.id.replace(/\.\d+$/, "");
    if (!auditText.includes(techniqueId)) fail(`Review entry ${entry.id} is not named by the audit document`);
    if (entry.status !== "corrected" || typeof entry.correction !== "string" || !entry.correction.trim() || typeof entry.auditRef !== "string" || !entry.auditRef.trim()) {
      fail(`Review entry ${entry.id} must be an explicit corrected audit entry`);
    }
    if (!/^[0-9a-f]{64}$/i.test(String(entry.canonicalDigest || ""))) fail(`Review entry ${entry.id} has an invalid canonical digest`);
    if (entry.canonicalDigest.toLowerCase() !== source.canonicalDigest) {
      fail(`Review entry ${entry.id} has a stale canonical digest`);
    }
    result.set(entry.id, clone(entry));
  }
  return result;
}

function validateEvidence(evidence, known) {
  if (!isObject(evidence) || evidence.schemaVersion !== 1 || !Array.isArray(evidence.entries)) fail("automation-evidence.json: unsupported schema");
  const seen = new Set();
  const result = new Map();
  for (const entry of evidence.entries) {
    if (!isObject(entry) || typeof entry.id !== "string" || !entry.id) fail("automation-evidence.json: missing id");
    if (seen.has(entry.id)) fail(`automation-evidence.json: duplicate id ${entry.id}`);
    seen.add(entry.id);
    if (!["technique", "enemy-rule", "enemy-attack"].includes(entry.kind)) fail(`automation-evidence.json: invalid kind for ${entry.id}`);
    if (entry.kind === "technique" && !known.has(entry.id)) fail(`automation-evidence.json: unknown technique level id ${entry.id}`);
    if (!entry.sourcePath || !entry.sourceDigest || !Array.isArray(entry.claims) || !entry.claims.length || !entry.auditedAtCommit || !isObject(entry.surfaces) || !Array.isArray(entry.tests) || !entry.tests.length || !Array.isArray(entry.edgeCases) || !entry.edgeCases.length) {
      fail(`automation-evidence.json: ${entry.id} lacks source, tests, or edge cases`);
    }
    const sourcePath = path.join(root, entry.sourcePath);
    if (!fs.existsSync(sourcePath)) fail(`automation-evidence.json: missing source ${entry.sourcePath} for ${entry.id}`);
    const actualDigest = `sha256:${sha256(fs.readFileSync(sourcePath))}`;
    const stale = entry.sourceDigest !== actualDigest;
    if (entry.canonicalDigest && (!known.has(entry.id) || entry.canonicalDigest !== known.get(entry.id).canonicalDigest)) fail(`automation-evidence.json: stale canonical digest for ${entry.id}`);
    for (const test of entry.tests) if (!test.path || !fs.existsSync(path.join(root, test.path))) fail(`automation-evidence.json: missing test file ${test.path || "<empty>"} for ${entry.id}`);
    result.set(entry.id, { entry: clone(entry), stale });
  }
  return result;
}

function buildRegistry({ canonical, coverage, review, evidence }) {
  const sourceRows = canonicalRows(canonical);
  const known = new Map(sourceRows.map(row => [row.id, row]));
  if (!Array.isArray(coverage) || coverage.length !== sourceRows.length) fail(`techniqueCoverage must contain ${sourceRows.length} rows`);
  const reviewById = validateReview(review, known);
  const evidenceById = validateEvidence(evidence, known);
  const coverageById = new Map();
  for (const row of coverage) {
    if (!known.has(row.id)) fail(`techniqueCoverage references unknown canonical level id: ${row.id}`);
    if (coverageById.has(row.id)) fail(`techniqueCoverage contains duplicate id: ${row.id}`);
    coverageById.set(row.id, row);
  }
  const rows = sourceRows.map(source => {
    const row = coverageById.get(source.id);
    const evidenceRecord = evidenceById.get(source.id);
    const explicitReview = reviewById.get(source.id);
    const surfaces = Object.fromEntries(SURFACES.map(surface => [surface, evidenceRecord?.entry.surfaces[surface] === true]));
    const certified = Boolean(evidenceRecord && !evidenceRecord.stale && evidenceRecord.entry.confidence === "certified");
    return {
      id: source.id,
      archetype: { id: source.archetype.id, name: source.archetype.name },
      technique: { id: source.technique.id, name: source.technique.name },
      level: Number(source.level.n),
      implementation: {
        automation: row.automation,
        ruleIds: row.rules.map(rule => rule.id),
        rules: clone(row.rules),
        foundationPlan: clone(row.foundationPlan),
      },
      provenance: {
        editionId: canonical.editionId,
        sourcePath: "source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json",
        canonicalLevel: clone(source.level),
        canonicalDigest: source.canonicalDigest,
        engineRuleDigests: [...new Set(row.rules.map(rule => rule.sourceDigest).filter(Boolean))],
      },
      review: explicitReview ? { ...explicitReview, explicit: true } : {
        status: "unreviewed",
        inherited: true,
        explicit: false,
        source: "default",
      },
      surfaces,
      certification: {
        status: certified ? "certified" : "uncertified",
        confidence: evidenceRecord?.entry.confidence || null,
        evidenceId: evidenceRecord?.entry.id || null,
        staleEvidence: evidenceRecord?.stale || false,
        evidence: evidenceRecord?.entry ? clone(evidenceRecord.entry) : null,
      },
    };
  });
  return {
    schemaVersion: 1,
    editionId: canonical.editionId,
    canonical: {
      sourcePath: "source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json",
      sourceDigest: `sha256:${sha256(fs.readFileSync(editionPath))}`,
      levelCount: rows.length,
    },
    inputs: {
      review: "apps/companion/lionwing-automation-registry.review.json",
      automationEvidence: "apps/companion/automation-evidence.json",
      techniqueCoverage: "apps/companion/technique-engine.js",
    },
    rows,
  };
}

function buildMarkdown(registry) {
  const reviewed = registry.rows.filter(row => row.review.explicit).length;
  const certified = registry.rows.filter(row => row.certification.status === "certified").length;
  const lines = [
    "# Реестр автоматизации LionWing",
    "",
    "> Генерируется командой `npm run build:lionwing-registry`. Реестр строится из canonical EN, `techniqueCoverage` и `automation-evidence.json`.",
    "> `review=unreviewed/inherited` означает отсутствие явной записи в аудите; это не сертификация и не повышение readiness.",
    "",
    `Canonical уровней: **${registry.rows.length}** · Явно исправленных review: **${reviewed}** · Сертифицированных evidence: **${certified}**`,
    "",
    "| ID | Техника | Ур. | Implementation | Review | Surfaces | Certification |",
    "| --- | --- | ---: | --- | --- | --- | --- |",
  ];
  for (const row of registry.rows) {
    const surfaces = SURFACES.filter(surface => row.surfaces[surface]).join(", ") || "—";
    lines.push(`| \`${row.id}\` | ${escapeCell(row.technique.name)} | ${row.level} | \`${row.implementation.automation}\` | \`${row.review.status}\` | ${surfaces} | \`${row.certification.status}\` |`);
  }
  return `${lines.join("\n")}\n`;
}

const { canonical, coverage } = loadCoverage();
const review = readJson(reviewPath);
const evidence = readJson(evidencePath);
const registry = buildRegistry({ canonical, coverage, review, evidence });
const outputJson = `${JSON.stringify(registry, null, 2)}\n`;
const outputMarkdown = buildMarkdown(registry);
if (process.argv.includes("--check")) {
  const actualJson = fs.existsSync(jsonTarget) ? fs.readFileSync(jsonTarget, "utf8").replace(/\r\n/g, "\n") : "";
  const actualMarkdown = fs.existsSync(markdownTarget) ? fs.readFileSync(markdownTarget, "utf8").replace(/\r\n/g, "\n") : "";
  if (actualJson !== outputJson || actualMarkdown !== outputMarkdown) {
    console.error("LionWing automation registry is stale. Run npm run build:lionwing-registry.");
    process.exitCode = 1;
  } else {
    console.log(`LionWing automation registry is current: ${registry.rows.length} rows, ${registry.rows.filter(row => row.review.explicit).length} explicit reviews`);
  }
} else {
  fs.writeFileSync(jsonTarget, outputJson, "utf8");
  fs.writeFileSync(markdownTarget, outputMarkdown, "utf8");
  console.log(`LionWing automation registry written: ${registry.rows.length} rows, ${registry.rows.filter(row => row.review.explicit).length} explicit reviews`);
}

export { buildMarkdown, buildRegistry, canonicalLevelDigest, canonicalRows, validateEvidence, validateReview };
