import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fixture, clone, runtime } from './helpers/scene-contract-harness.mjs';
import { sceneEngineFiles } from './load-scene-engine.mjs';

const { core, engine } = runtime(), scene = fixture();
scene.spaces[0] = { id: 'main', width: 7, height: 7 };
const snapshot = clone(scene);
let historySerializations = 0;
scene.undo = Array.from({ length: 20 }, () => ({ state: { ...snapshot, toJSON() { historySerializations++; throw new Error('UI history is not a rule query input'); } } }));
scene.redo = scene.undo.slice(0, 3); scene.turnUndo = scene.undo.slice(0, 10);
const status = (table, x, y) => core.destinationStatus(table, { actorId: 'hero', payload: { kind: 'action', actionId: engine.ACTION_IDS.jump, targetIds: [] }, destination: { space: 'main', x, y } });
const withoutHistory = clone(snapshot), originalCore = clone(snapshot);
for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
  assert.deepEqual(clone(status(scene, x, y)), clone(status(withoutHistory, x, y)), 'UI undo entries cannot influence canonical destination gates');
}
for (const query of [
  table => core.actionGate(table, 'hero', { actionId: engine.ACTION_IDS.jump }),
  table => core.turnStartStatus(table, 'hero'), table => core.roundEndStatus(table),
  table => core.followupStatus(table), table => core.consequenceStatus(table, 'hero'),
  table => core.compoundStatus(table, 'hero'),
  table => core.historyStatus(table, { scope: 'scene', sceneSerial: 1 }),
  table => core.turnIdentity(table, 'hero'), table => core.lifecycleContext(table, { actorId: 'hero' }),
  table => core.lifetimeExpired(table, 'scene', { ownerActorId: 'hero' }),
]) {
  assert.deepEqual(clone(query(scene)), clone(query(withoutHistory)), 'rule query has the same result with or without UI history');
}
assert.equal(historySerializations, 0, 'none of the query paths serializes old scene snapshots');
const { undo, redo, turnUndo, ...after } = scene;
assert.deepEqual(clone(after), originalCore, 'canonical state stays immutable during queries');
scene.actors[0].ap = 0;
assert.equal(status(scene, 2, 1).available, false, 'a same-object resource change is checked immediately');
scene.actors[0].ap = 3;
assert.equal(status(scene, 2, 1).available, true, 'queries do not retain a stale denied result');
scene.objects.push({ id: 'obstacle', type: 'terrain', space: 'main', cells: ['2,1'] });
assert.equal(status(scene, 2, 1).available, false, 'a same-object terrain edit immediately affects the query');
console.log('LionWing query response: canonical equivalence, immutable snapshots, no undo serialization, current resources and geometry passed');

if (process.argv.includes('--benchmark')) {
  const baselineRef = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length) || '9c48a36';
  const baselineSource = execFileSync('git', ['show', `${baselineRef}:apps/companion/lionwing-engine.js`], { encoding: 'utf8' });
  const context = vm.createContext({ window: {}, console });
  for (const file of ['data.js', 'edition-lionwing.js', 'lionwing-table-data.js', 'logic.js', ...sceneEngineFiles]) {
    const source = file === 'lionwing-engine.js' ? baselineSource : fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }
  const baselineCore = context.window.DAWN_LIONWING_ENGINE;
  const input = clone(snapshot);
  input.artworks = [{ id: 'art', image: `data:image/png;base64,${'A'.repeat(100000)}` }];
  const saved = clone(input);
  input.undo = Array.from({ length: 20 }, () => ({ state: saved }));
  input.turnUndo = Array.from({ length: 10 }, () => ({ state: saved }));
  input.redo = [];
  const request = (x, y) => ({ actorId: 'hero', payload: { kind: 'action', actionId: engine.ACTION_IDS.jump, targetIds: [] }, destination: { space: 'main', x, y } });
  const rows = [];
  let previousResults;
  for (const [label, api] of [['baseline', baselineCore], ['changed', core]]) {
    const times = [], answers = [];
    for (let run = 0; run < 4; run++) {
      const start = performance.now(), pass = [];
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) pass.push(api.destinationStatus(input, request(x, y)));
      times.push(performance.now() - start); answers.push(clone(pass));
    }
    if (previousResults) assert.deepEqual(answers, previousResults, 'before/after highlights have identical canonical reasons and availability');
    previousResults = answers;
    times.sort((a, b) => a - b);
    rows.push({ label, samples: 4, cellsPerSample: 49, medianMs: +((times[1] + times[2]) / 2).toFixed(2), maxMs: +times[3].toFixed(2) });
  }
  console.log(JSON.stringify({ baselineRef, workload: 'Production canonical Jump queries for every cell on 7x7, one 100KB art, 20 undo and 10 turn snapshots; no DOM or network', rows }, null, 2));
}
