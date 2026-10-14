import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runtime, actor, clone } from './helpers/scene-contract-harness.mjs';

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const coreSource = read('app-core.js'), uiSource = read('scene-ui.js');
function controller(source = uiSource) {
  const { context, engine } = runtime();
  context.window.DAWN_TABLE_POLICY.install();
  let serial = 0, tick = 1000;
  const calls = { render: 0, save: 0, fx: 0, layout: 0, historyNormalization: 0, historyDispatch: 0 };
  Object.assign(context, {
    structuredClone, APP_SCHEMA: 14, contentPreferences: { edition: 'lionwing' },
    uid: () => `ui-${++serial}`, cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [],
    clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
    store: { mode: 'play' }, performance: { now: () => tick += 500 },
    SceneEngine: engine, submitNetworkV2Events: () => null,
    friendlySyncError: error => error.message, toast: message => { context.lastToast = message; return null; },
    syncHeroFromScene() {}, persist: () => calls.save++, renderPlay: () => calls.render++,
    renderToolsWorkspace: () => calls.render++, renderScene: () => calls.render++, renderChallengeRequestDock() {},
    playSceneEventFx: () => calls.fx++,
    $: () => { calls.layout++; return null; },
  });
  vm.runInContext(coreSource.slice(coreSource.indexOf('function blankScene()'), coreSource.indexOf('function addEnemyDeploymentPassives')), context);
  vm.runInContext('function sceneSnapshot(){return sceneCore(Scene)}', context);
  const normalize = context.normalizeScene;
  context.normalizeScene = scene => {
    calls.historyNormalization += (scene.undo?.length || 0) + (scene.redo?.length || 0) + (scene.turnUndo?.length || 0);
    return normalize(scene);
  };
  const dispatch = engine.dispatchMany;
  context.SceneEngine = { ...engine, dispatchMany: (scene, events, options) => {
    calls.historyDispatch += (scene.undo?.length || 0) + (scene.redo?.length || 0) + (scene.turnUndo?.length || 0);
    return dispatch(scene, events, options);
  } };
  vm.runInContext(source.slice(source.indexOf('let lastSceneEventSubmission='), source.indexOf('function restoreSceneHistory(')), context);
  const fresh = context.blankScene();
  fresh.actors = [actor('hero', 'hero', 1, 1)];
  fresh.artworks = [{ id: 'art', name: 'Fixture', image: `data:image/png;base64,${'A'.repeat(100000)}` }];
  context.Scene = normalize(fresh);
  const snapshot = context.sceneCore(context.Scene);
  context.Scene.undo = Array.from({ length: 20 }, (_, index) => ({ id: `undo-${index}`, label: 'Saved change', state: clone(snapshot) }));
  context.Scene.redo = [{ id: 'redo', label: 'Saved redo', state: clone(snapshot) }];
  context.Scene.turnUndo = Array.from({ length: 10 }, (_, index) => ({ id: `turn-${index}`, label: 'Saved turn', state: clone(snapshot) }));
  calls.historyNormalization = 0;
  return { context, calls };
}
const resourceEvent = (id, value) => ({ id, type: 'table.command', actorId: 'hero', payload: { kind: 'resource', values: { hp: value } } });

{
  const { context, calls } = controller(), originalHistory = context.Scene.undo, originalTurn = context.Scene.turnUndo;
  const original = clone(context.Scene), event = resourceEvent('hp-once', 27);
  const result = context.commitSceneEvents('HP', [event]);
  assert.ok(result, context.lastToast);
  assert.equal(context.Scene.actors[0].hp, 27);
  assert.equal(context.Scene.version, original.version + 1);
  assert.equal(context.Scene.undo.length, 20);
  assert.equal(context.Scene.undo[0].state.actors[0].hp, 30);
  assert.equal(context.Scene.undo[1], originalHistory[0], 'existing detached snapshots are retained without rebuilding');
  assert.equal(context.Scene.turnUndo[0], originalTurn[0]);
  assert.deepEqual(clone(originalHistory), original.undo, 'the reducer cannot mutate local history');
  assert.equal(context.Scene.redo.length, 0);
  assert.equal(calls.historyDispatch, 0, 'UI histories never enter the rule reducer');
  assert.equal(calls.historyNormalization, 0, 'only the newly committed scene is normalized');
  assert.equal(calls.layout, 0, 'a non-movement command needs no movement geometry');
  assert.equal(calls.render, 1); assert.equal(calls.save, 1); assert.equal(calls.fx, 1);

  const committed = context.Scene, beforeReplay = clone(committed), counters = { ...calls };
  const replay = context.commitSceneEvents('HP', [clone(event)]);
  assert.ok(replay, context.lastToast); assert.equal(replay.events.length, 0);
  assert.equal(context.Scene, committed, 'exact replay keeps current UI state and inputs');
  assert.deepEqual(clone(context.Scene), beforeReplay, 'replay does not consume an undo slot');
  assert.deepEqual(calls, counters, 'replay saves nothing, renders nothing and starts no animation');

  const invalid = context.commitSceneEvents('Invalid', [resourceEvent('bad', -5)]);
  assert.equal(invalid, null); assert.equal(context.Scene, committed);
  assert.deepEqual(clone(context.Scene), beforeReplay);
}
{
  const { context, calls } = controller();
  context.Scene.tablePolicy = { mode: 'rules', processStatuses: false, epoch: 0 };
  context.Scene.activeActorId = null;
  const result = context.commitSceneEvents('Start', [{ id: 'start', type: 'lionwing.command', actorId: 'hero', payload: { kind: 'turn-start' } }]);
  assert.ok(result, context.lastToast);
  assert.equal(context.Scene.activeActorId, 'hero');
  assert.equal(context.Scene.turnUndo[0].checkpoint, 'turn-start');
  assert.equal(context.Scene.turnUndo[0].state.activeActorId, null);
  assert.equal(context.Scene.turnUndo.length, 11);
  assert.equal(calls.historyDispatch, 0);
  const stopped = context.commitSceneEvents('End', [{ id: 'end', type: 'lionwing.command', actorId: 'hero', payload: { kind: 'turn-end' } }]);
  assert.ok(stopped, context.lastToast);
  const round = context.commitSceneEvents('Round', [{ id: 'round', type: 'lionwing.command', actorId: null, payload: { kind: 'round-end' } }]);
  assert.ok(round, context.lastToast);
  assert.equal(context.Scene.turnUndo.length, 0, 'round boundary retains its history reset');
}
{
  const { context, calls } = controller();
  context.Scene.tablePolicy={mode:'rules',processStatuses:false,epoch:0};
  const original=clone(context.Scene),request={id:'decision-once',type:'lionwing.command',actorId:'hero',payload:{kind:'prompt',targetId:'hero',title:'Independent decision'}};
  const result=context.commitSceneEvents('Decision',[request]);
  assert.ok(result,context.lastToast);assert.equal(result.events.length,0,'A prompt has no visual consequence events');
  assert.equal(context.Scene.version,original.version+1);
  assert.equal(context.Scene.lionwing.choices[0].title,'Independent decision','Accepted metadata-only commands install their canonical scene');
  assert.equal(context.Scene.undo[0].state.version,original.version);
  assert.equal(calls.render,1);assert.equal(calls.save,1);
  const committed=context.Scene,counters={...calls};
  context.commitSceneEvents('Decision',[clone(request)]);
  assert.equal(context.Scene,committed);assert.deepEqual(calls,counters,'Replaying the same prompt still performs no save or render');
  const choice=committed.lionwing.choices[0];
  assert.ok(context.commitSceneEvents('Record decision',[{id:'decision-record',type:'lionwing.command',actorId:'hero',payload:{kind:'choice',id:choice.id,choice:'record',note:'Resolved'}}]));
  assert.equal(context.Scene.lionwing.choices.length,0,'The newly installed decision can be answered through the same writer');
}
{
  const { context, calls } = controller(), original = context.Scene;
  context.submitNetworkV2Events = () => ({ queued: true });
  assert.equal(context.commitSceneEvents('Queued', [resourceEvent('queued', 27)]).queued, true);
  assert.equal(context.Scene, original);
  assert.equal(calls.historyDispatch, 0); assert.equal(calls.render, 0); assert.equal(calls.save, 0);
}
console.log('scene event response: actual reducers, bounded undo, exact replay, rejection, turn/round history and queued authority passed');

// Optional CPU measurement, not a browser-paint or network-latency assertion.
if (process.argv.includes('--benchmark')) {
  const baselineRef = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length) || '9c48a36';
  const baselineSource = execFileSync('git', ['show', `${baselineRef}:apps/companion/scene-ui.js`], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8' });
  const rows = [];
  for (const [label, source] of [['baseline', baselineSource], ['changed', uiSource]]) {
    const { context, calls } = controller(source), durations = [];
    for (let index = 0; index < 16; index++) {
      const started = performance.now();
      assert.ok(context.commitSceneEvents('Benchmark', [resourceEvent(`bench-${index}`, 25 + index % 2)]), context.lastToast);
      durations.push(performance.now() - started);
    }
    durations.sort((a, b) => a - b);
    rows.push({ label, samples: durations.length, historySnapshotsDispatched: calls.historyDispatch, historySnapshotsNormalized: calls.historyNormalization, p50Ms: +durations[7].toFixed(2), p95Ms: +durations[15].toFixed(2) });
  }
  console.log(JSON.stringify({ baselineRef, workload: 'Production local commit + reducer + normalization; one 100KB art, 20 undo, 10 turn snapshots; mocked rendering/storage', rows }, null, 2));
}
