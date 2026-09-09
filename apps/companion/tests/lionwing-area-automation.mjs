import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context);
const lionwing = context.window.DAWN_LIONWING_ENGINE;
const runtime = context.window.DAWN_LIONWING_GEOMETRY_RUNTIME;
const clone = value => JSON.parse(JSON.stringify(value));
const actor = (id, team, x, y, extra = {}) => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x, y, hp: 20, maxHp: 20, ap: 3, baseAp: 3,
  focus: 8, influence: 2, wounds: 0, stress: 0, tier: 2, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {}, ...extra,
});
const scene = (extra = {}) => ({
  rulesEdition: "lionwing", version: 4, round: 1, turnSerial: 1, activeActorId: "hero", tension: 6,
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [actor("hero", "hero", 1, 1), actor("enemy", "enemy", 2, 1), actor("ally", "hero", 1, 2)],
  objects: [], walls: [], markers: [], topology: { cuts: [] }, log: [], lionwing: {}, ...extra,
});

let plan = runtime.areaPrepare(scene(), { sourceActorId: "hero", shape: "square5", range: 6, center: { space: "main", x: 0, y: 0 } });
assert.equal(plan.ok, true, plan.errors?.join(" "));
assert.equal(plan.preview.cells.length, 9, "a 5x5 area is clipped at a field corner");
assert.deepEqual(JSON.parse(JSON.stringify(plan.preview.targetIds)), ["enemy"], "only enemies in the clipped area are targets");
assert.equal(plan.preview.emptyTargetCount, 6, "empty selected cells are derived by the runtime");
assert.deepEqual(runtime.preview(scene(), runtime.reload(clone(plan.plan))).preview, plan.preview, "reloaded area plans reproduce the same result");

const forged = clone(plan.plan);
forged.result.targetIds = ["ally"];
forged.result.emptyTargetCount = 0;
assert.throws(() => runtime.revalidateArea(scene(), forged), /устар|цели|измен/i, "forged targets/count are rejected");
assert.equal(runtime.areaPreview({ ...scene(), version: 5 }, plan.plan).ok, false, "a stale preview cannot be reused");

const large = scene();
large.actors[1] = { ...large.actors[1], x: 2, y: 2, occupiedWidth: 2, occupiedHeight: 2 };
const largePlan = runtime.areaPrepare(large, { sourceActorId: "hero", shape: "square3", range: 5, center: { space: "main", x: 2, y: 2 } });
assert.equal(largePlan.ok, true, largePlan.errors?.join(" "));
assert.deepEqual(JSON.parse(JSON.stringify(largePlan.preview.targetIds)), ["enemy"], "large bodies are included when any footprint cell is selected");

const bombardier = (level, center, focusSpent) => {
  const s = scene();
  s.actors[0].knownTechniques = { "ruiner.bombardier": level };
  s.actors[0].lionwing.automation = {};
  s.actors[0].lionwing.automation[`ruiner.bombardier.${level}`] = true;
  const prepared = lionwing.prepare(s, {
    actorId: "hero", eventId: `bombardier-${level}`, kind: "action", actionId: "action.атаки.завершение",
    attribute: "spirit", techniqueRuleId: `ruiner.bombardier.${level}`, areaCenter: center,
    focusSpent,
  });
  return { s, prepared };
};

const one = bombardier(1, { space: "main", x: 2, y: 1 }, 0);
assert.equal(one.prepared.ok, true, one.prepared.errors?.join(" "));
assert.deepEqual(JSON.parse(JSON.stringify(one.prepared.events[0].payload.targetIds)), ["enemy"], "Bombardier I selects the center and adjacent enemy targets");
assert.equal(one.prepared.events[0].payload.areaPlan.result.shape, "adjacent");
const many = scene();
many.actors[0].knownTechniques = { "ruiner.bombardier": 1 };
many.actors[0].lionwing.automation = { "ruiner.bombardier.1": true };
many.actors.push(actor("enemy2", "enemy", 3, 1));
const manyPrepared = lionwing.prepare(many, {
  actorId: "hero", eventId: "bombardier-many", kind: "action", actionId: "action.атаки.завершение",
  attribute: "spirit", techniqueRuleId: "ruiner.bombardier.1", areaCenter: { space: "main", x: 2, y: 1 }, focusSpent: 0,
}, { random: () => 0.6 });
assert.equal(manyPrepared.ok, true, manyPrepared.errors?.join(" "));
assert.deepEqual(JSON.parse(JSON.stringify(manyPrepared.events[0].payload.targetIds)), ["enemy", "enemy2"], "Bombardier I supports multiple adjacent enemies");

const two = bombardier(2, { space: "main", x: 2, y: 2 }, 2);
assert.equal(two.prepared.ok, true, two.prepared.errors?.join(" "));
assert.equal(two.prepared.events[0].payload.areaPlan.result.cells.length, 9);
assert.equal(two.prepared.events[0].payload.emptyTargetCount, 6, "Bombardier II derives the 3x3 empty-cell count");
const forgedEvent = clone(two.prepared.events[0]);
forgedEvent.payload.areaPlan.result.emptyTargetCount = 0;
assert.throws(() => lionwing.dispatchMany(two.s, [forgedEvent]), /устар|план|цели|измен/i, "dispatch rejects a forged area result");

const three = bombardier(3, { space: "main", x: 3, y: 3 }, 4);
assert.equal(three.prepared.ok, true, three.prepared.errors?.join(" "));
assert.equal(three.prepared.events[0].payload.areaPlan.result.cells.length, 25);
assert.equal(lionwing.prepare(scene(), {
  actorId: "hero", eventId: "bombardier-off", kind: "action", actionId: "action.атаки.завершение",
  attribute: "spirit", techniqueRuleId: "ruiner.bombardier.1", areaCenter: { space: "main", x: 2, y: 1 },
  focusSpent: 0,
}).ok, false, "opt-in is required");

const ordinary = lionwing.prepare(scene(), {
  actorId: "hero", eventId: "ordinary-finisher", kind: "action", actionId: "action.атаки.завершение",
  attribute: "spirit", targetIds: ["enemy"], focusSpent: 0,
});
assert.equal(ordinary.ok, true, ordinary.errors?.join(" "));
assert.equal(ordinary.events[0].payload.targetIds.length, 1, "ordinary Spirit Finisher remains single-target");

console.log("LionWing area automation: shared shapes, clipping, large bodies, derived targets/empty cells, forged/stale/reload checks, Bombardier I/II/III, opt-in and ordinary Finisher passed");
