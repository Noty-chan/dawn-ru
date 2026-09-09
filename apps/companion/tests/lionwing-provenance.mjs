import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine, sceneEngineFiles } from "./load-scene-engine.mjs";

const root = new URL("../", import.meta.url);
const canonicalDir = new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/", import.meta.url);
const canonicalTechniques = fs.readdirSync(canonicalDir)
  .filter(file => file.endsWith(".json"))
  .flatMap(file => JSON.parse(fs.readFileSync(new URL(file, canonicalDir), "utf8")).techniques);
const canonicalLevel = sourceLevelId => {
  const match = String(sourceLevelId).match(/^(.*)\.(\d+)$/);
  const technique = canonicalTechniques.find(item => item.id === match?.[1]);
  const level = technique?.levels.find(item => item.n === Number(match?.[2]));
  assert.ok(technique && level, `canonical source has ${sourceLevelId}`);
  return { technique, level };
};
const sourceDigest = sourceLevelId => {
  const { technique, level } = canonicalLevel(sourceLevelId);
  return crypto.createHash("sha256").update(JSON.stringify({
    id: sourceLevelId,
    archetypeId: technique.archetypeId,
    techniqueId: technique.id,
    name: level.name,
    text: level.text,
    notes: technique.notes,
    source: technique.source,
  })).digest("hex");
};

const context = { window: {}, console, Date };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
vm.runInContext(fs.readFileSync(new URL("technique-engine.js", root), "utf8"), context, { filename: "technique-engine.js" });

const adapters = context.window.DAWN_LIONWING_ADAPTERS;
const allKnown = Object.fromEntries(canonicalTechniques.map(technique => [technique.id, Math.max(...technique.levels.map(level => Number(level.n)))]));
const catalogActor = { id: "provenance", rulesEdition: "lionwing", knownTechniques: allKnown, techniques: allKnown, lionwing: { automation: {} } };
const adapterRules = adapters.list(catalogActor);
for (const rule of adapterRules) {
  assert.match(rule.sourceDigest || "", /^[0-9a-f]{64}$/u, `${rule.id} must carry a full SHA-256 digest`);
  assert.equal(rule.sourceDigest, sourceDigest(rule.id), `${rule.id} must match the canonical payload`);
  assert.ok(["full", "partial", "manual"].includes(rule.coverage), `${rule.id} must declare coverage`);
}

const executableRules = context.window.DAWN_TECHNIQUE_ENGINE.RULES.filter(rule => ["full", "decision"].includes(rule.automation));
assert.ok(executableRules.length > 0, "the technique registry must expose executable LionWing levels");
for (const rule of executableRules) {
  assert.match(rule.sourceDigest || "", /^[0-9a-f]{64}$/u, `${rule.id} must carry a full SHA-256 digest`);
  assert.ok(rule.sourceLevelId, `${rule.id} must name its canonical level explicitly`);
  assert.equal(rule.sourceDigest, sourceDigest(rule.sourceLevelId), `${rule.id} must match its canonical source level`);
  assert.ok(["full", "partial", "manual"].includes(rule.coverage), `${rule.id} must declare coverage`);
  if (rule.id !== rule.sourceLevelId) assert.notEqual(rule.sourceLevelId, rule.id, `${rule.id} must not silently self-source an internal subrule`);
}

console.log(`LionWing provenance gate passed: ${adapterRules.length} adapters and ${executableRules.length} executable registry levels verified`);
