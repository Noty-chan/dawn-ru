import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date, structuredClone };
context.globalThis = context;
context.window = context;
for (const file of ["data.js", "technique-foundation-map.js"]) {
  vm.runInNewContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(new URL("../technique-engine.js", import.meta.url), "utf8"), context, { filename: "technique-engine.js" });

const data = context.DAWN_DATA;
const SceneEngine = context.DAWN_SCENE_ENGINE;
const TechniqueEngine = context.DAWN_TECHNIQUE_ENGINE;

const actor = (overrides = {}) => ({
  id: "hero", kind: "hero", name: "Герой", team: "hero", space: "main", x: 3, y: 3,
  ap: 6, baseAp: 3, focus: 12, hp: 24, maxHp: 24, guts: 5, wounds: 0,
  speed: 6, armor: 2, evasion: 2, tier: 2,
  attrs: { body: 4, talent: 4, spirit: 4, mind: 4 },
  effects: ["positive.ускорен"], effectStates: {}, usedActions: [], acted: false,
  techniques: {}, techniqueState: { spellModifiers: [] }, ruleState: {}, ruleResources: {},
  ruleClocks: {}, alternateResources: { bullets: 6, heat: 0, grit: 4, faith: 4, weapons: 4 },
  inventory: {}, ...overrides,
});
const enemy = (overrides = {}) => actor({
  id: "enemy", kind: "enemy", name: "Враг", team: "enemy", x: 4, y: 3,
  ap: 3, baseAp: 3, focus: 4, hp: 18, maxHp: 24, effects: ["negative.порчен", "negative.замедлен"],
  techniques: {}, ...overrides,
});
const ally = (overrides = {}) => actor({
  id: "ally", name: "Союзник", x: 3, y: 4, hp: 12, maxHp: 24, effects: ["negative.ошеломлен"],
  techniques: {}, ...overrides,
});
const sceneFor = techniques => ({
  version: 0, round: 2, tension: 4, turnSerial: 3, activeActorId: "hero", activeSpace: "main",
  spaces: [{ id: "main", name: "Поле", width: 12, height: 10 }],
  actors: [actor({ techniques }), enemy(), ally()],
  objects: [
    { id: "terrain", ownerActorId: "hero", space: "main", type: "terrain", label: "Стена", hp: 10, cells: ["2,3"], ruleId: "test" },
  ],
  markers: [
    { id: "summon", ownerActorId: "hero", space: "main", kind: "summon", x: 2, y: 2, ruleId: "test" },
  ],
  targetIds: ["enemy"], pendingPrompt: null, pendingAction: null, log: [], rollFeed: [],
});

const canonicalFamilies = data.archetypes.flatMap(archetype => archetype.techniques);
const canonicalLevels = canonicalFamilies.flatMap(technique => technique.levels.map(level => `${technique.id}.${level.n}`));
assert.equal(new Set(canonicalLevels).size, canonicalLevels.length, "Technique level ids must be unique");
const adapterIds = TechniqueEngine.RULES.map(rule => rule.id);
assert.equal(new Set(adapterIds).size, adapterIds.length, "Technique adapter ids must be unique");

const failures = [];
for (const technique of canonicalFamilies) {
  for (const level of technique.levels) {
    const techniques = { [technique.id]: Number(level.n) };
    const scene = sceneFor(techniques);
    try {
      const coverage = TechniqueEngine.techniqueCoverage(data, techniques);
      assert.equal(coverage.length, Number(level.n), `${technique.id} ${level.n}: selected levels are cumulative`);
      assert.ok(coverage.every(entry => entry.techniqueId === technique.id), `${technique.id} ${level.n}: coverage must stay inside the selected family`);

      const available = SceneEngine.availableActions(scene, data, "hero");
      assert.ok(Array.isArray(available) && available.length, `${technique.id} ${level.n}: base actions remain available`);
      assert.equal(new Set(available.map(action => action.id)).size, available.length, `${technique.id} ${level.n}: action ids must not duplicate`);
      for (const action of available) {
        assert.equal(typeof action.id, "string");
        assert.equal(typeof action.name, "string");
        assert.ok(Number.isFinite(Number(action.costModel?.amount || 0)), `${technique.id} ${level.n}: ${action.name} has a finite cost`);
        assert.ok(action.available || typeof action.reason === "string", `${technique.id} ${level.n}: unavailable actions explain why`);
      }
    } catch (error) {
      failures.push(`${technique.id}.${level.n} build: ${error.stack || error}`);
    }
  }
}

let pairCount = 0;
for (let left = 0; left < canonicalFamilies.length; left += 1) {
  for (let right = left + 1; right < canonicalFamilies.length; right += 1) {
    const first = canonicalFamilies[left];
    const second = canonicalFamilies[right];
    const techniques = {
      [first.id]: Math.max(...first.levels.map(level => Number(level.n))),
      [second.id]: Math.max(...second.levels.map(level => Number(level.n))),
    };
    try {
      const scene = sceneFor(techniques);
      const coverage = TechniqueEngine.techniqueCoverage(data, techniques);
      assert.equal(coverage.length, first.levels.length + second.levels.length);
      const available = SceneEngine.availableActions(scene, data, "hero");
      assert.equal(new Set(available.map(action => action.id)).size, available.length);
      assert.ok(TechniqueEngine.rulesFor(techniques).every(rule => Number(techniques[rule.techniqueId] || 0) >= rule.level));
      pairCount += 1;
    } catch (error) {
      failures.push(`${first.id} + ${second.id}: ${error.stack || error}`);
    }
  }
}

const genericRequest = rule => ({
  actorId: "hero", ruleId: rule.id, targetIds: ["enemy"], anchor: { x: 4, y: 3 },
  destination: { x: 5, y: 3 }, orientation: "horizontal", cells: ["3,3", "4,3", "5,3"],
  effectIds: ["negative.порчен"], rolls: [2, 5],
  roll: { formula: "4D6", attribute: "spirit", rolls: [6, 5, 3, 1], successes: 3, crits: 1 },
  options: {
    amount: 1, focusSpent: 2, actionMode: "skirmish", attribute: "spirit", objectId: "terrain",
    targetId: "enemy", choice: "pass", cells: ["3,3", "4,3", "5,3"],
  },
});

for (const rule of TechniqueEngine.RULES) {
  const scene = sceneFor({ [rule.techniqueId]: Number(rule.level) });
  try {
    const request = genericRequest(rule);
    if (rule.id.startsWith("ruiner.bombardier.")) {
      request.options.focusSpent = rule.level >= 3 ? 4 : rule.level >= 2 ? 2 : 0;
      request.roll = SceneEngine.diceRollPayload(scene, "hero", {
        scope: "action",
        baseCount: 4,
        advantage: request.options.focusSpent,
        hindrance: 0,
        attribute: "spirit",
        actionId: data.actions.list.find(action => action.name === "Завершение").id,
        targetIds: request.targetIds,
      }, { rolls: [6, 5, 4, 3, 2, 1, 1, 1].slice(0, 4 + request.options.focusSpent) }).payload;
    }
    const preview = TechniqueEngine.preview(scene, request);
    assert.equal(typeof preview.ok, "boolean", `${rule.id}: preview returns a verdict`);
    assert.ok(Array.isArray(preview.errors), `${rule.id}: preview returns errors`);
    assert.ok(Array.isArray(preview.warnings), `${rule.id}: preview returns warnings`);
    if (!preview.ok) continue;
    const events = TechniqueEngine.toEvents(scene, preview, { makeId: prefix => `smoke-${prefix}` });
    assert.ok(Array.isArray(events), `${rule.id}: preview converts to events`);
    assert.ok(events.every(event => event && typeof event.type === "string"), `${rule.id}: every emitted event has a type`);
    SceneEngine.dispatchMany(scene, events);
  } catch (error) {
    failures.push(`${rule.id} adapter: ${error.stack || error}`);
  }
}

assert.deepEqual(failures, [], `Catalog smoke failures:\n${failures.join("\n\n")}`);
console.log(`Catalog smoke QA passed: ${canonicalFamilies.length} families, ${canonicalLevels.length} levels, ${pairCount} pair builds, ${TechniqueEngine.RULES.length} adapters`);
