import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "../load-scene-engine.mjs";

export const clone = value => JSON.parse(JSON.stringify(value));
export function runtime() {
  const context = { window: {}, console };
  vm.createContext(context);
  for (const file of ["data.js", "edition-lionwing.js", "lionwing-table-data.js", "logic.js"]) {
    vm.runInContext(fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8"), context, { filename: file });
  }
  return { context, engine: loadSceneEngine(context), core: context.window.DAWN_LIONWING_ENGINE, data: context.window.DAWN_DATA };
}
export function actor(id, team, x, y, extra = {}) {
  return { id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
    rulesEdition: "lionwing", team, space: "main", x, y, hp: 30, maxHp: 30,
    ap: 3, baseAp: 3, focus: 6, influence: 3, wounds: 0, stress: 0, tier: 2,
    speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 },
    effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false,
    knownTechniques: {}, techniques: {}, lionwing: {}, ...extra };
}
export function fixture(edition = "lionwing") {
  return { rulesEdition: edition, version: 0, round: 1, turnSerial: 1, activeActorId: "hero", activeSpace: "main", selectedActor: "hero", tension: 2,
    spaces: [{ id: "main", name: "Проверка ядра", width: 8, height: 6 }],
    actors: [actor("hero", "hero", 1, 1, { rulesEdition: edition }), actor("enemy", "enemy", 4, 1, { rulesEdition: edition })],
    objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] }, targetIds: [], targetCells: [],
    reminders: [], rollFeed: [], log: [], triggerQueue: [], lionwing: { entities: {}, entityReceipts: {} } };
}
export function packet(prepared, prefix) {
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return prepared.events.map((event, index) => ({ ...event, id: `${prefix}:${index}` }));
}
export function rejectedWithoutMutation(scene, run, expected) {
  const before = clone(scene);
  assert.throws(run, expected);
  assert.deepEqual(clone(scene), before, "rejection must leave the input snapshot unchanged");
}
export function exactReplay(engine, scene, events, options = {}) {
  const before = clone(scene), result = engine.dispatchMany(scene, clone(events), options);
  assert.deepEqual(clone(result.scene), before, "replay preserves every field, including version, prompts and receipts");
  assert.equal(result.events.length, 0, "replay emits no triggers or UI effects");
  assert.deepEqual(clone(scene), before, "replay does not mutate its input");
}
export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
