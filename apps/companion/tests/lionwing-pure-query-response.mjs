import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { actor, fixture, clone, runtime, seededRandom } from './helpers/scene-contract-harness.mjs';

const baselineRef = process.argv.find(arg => arg.startsWith('--baseline='))?.slice(11) || 'a7221e6';
const compareBaseline = process.argv.includes('--benchmark');
const changed = runtime(), original = runtime();
for (const file of compareBaseline ? ['lionwing-information-query.js', 'lionwing-inventory.js', 'lionwing-aura-transitions.js', 'lionwing-geometry.js'] : []) {
  vm.runInContext(execFileSync('git', ['show', `${baselineRef}:apps/companion/${file}`], { encoding: 'utf8' }), original.context, { filename: file });
}
const apis = ({ context }) => ({ info: context.window.DAWN_LIONWING_INFORMATION_QUERY, inventory: context.window.DAWN_LIONWING_INVENTORY, aura: context.window.DAWN_LIONWING_AURA_TRANSITIONS, geometry: context.window.DAWN_LIONWING_GEOMETRY });
const current = apis(changed), baseline = apis(original);

function table(width = 7, count = 2) {
  const scene = fixture();
  scene.spaces[0] = { id: 'main', width, height: width };
  for (let i = 2; i < count; i++) scene.actors.push(actor(`enemy-${i}`, 'enemy', i % width, Math.floor(i / width) + 2));
  for (const participant of scene.actors) for (let i = 0; i < (participant.id === 'hero' ? 8 : 1); i++) {
    current.inventory.applyOperation(scene, { operation: 'configure', id: `item-${i}`, kind: 'charges', current: 4, maximum: 8, initial: 0, sourceDigest: 'pure-query-test', ruleId: 'test.inventory', visibility: i % 3 ? 'owner' : 'public' }, { actorId: participant.id, sourceActorId: participant.id, role: 'narrator', operationId: `configure:${participant.id}:${i}` });
  }
  current.inventory.reserve(scene, 'hero', [{ itemId: 'item-0', amount: 2 }], { reservationId: 'held', createdAt: '2026-10-13' });
  const info = current.info.ensureState(scene);
  for (let i = 0; i < 48; i++) {
    const studyId = `study-${i}`;
    info.studies.push({ id: studyId, actorId: 'hero', targetId: 'enemy', status: i % 4 ? 'revealed' : 'pending', scope: 'scene', visibility: i % 2 ? 'owner' : 'public', categories: ['health', 'defense'], revealedFactIds: [`fact-${i}`], turnSerial: i % 2 ? 1 : 0, round: 1, sceneSerial: 1, chapterSerial: 1 });
    info.facts.push({ id: `fact-${i}`, studyId, actorId: 'hero', targetId: 'enemy', category: 'health', value: { current: i, maximum: 50 }, visibility: i % 2 ? 'owner' : 'public', ownerActorId: 'hero', createdAt: String(i).padStart(3, '0') });
    if (i % 4 === 0) info.pending.push(studyId);
  }
  info.journal = Array.from({ length: 12 }, (_, i) => ({ id: `journal-${i}`, before: { ...clone(info), journal: [] }, after: { ...clone(info), journal: [] } }));
  return scene;
}

const viewers = [{ role: 'narrator' }, { role: 'owner', actorIds: ['hero'] }, { role: 'player', actorId: 'hero' }, { role: 'player', actorId: 'enemy' }];
const queries = [
  (api, scene) => api.info.studies(scene, { actorId: 'hero', scope: 'turn' }),
  (api, scene) => api.info.studyCount(scene, { actorId: 'hero', scope: 'turn' }),
  (api, scene) => api.info.firstStudy(scene, { actorId: 'hero', scope: 'scene' }),
  (api, scene) => api.info.studyStatus(scene, 'study-0'),
  (api, scene) => api.info.availableCategories(scene, 'study-0'),
  (api, scene) => api.info.markedTargetStatus(scene, 'hero', 'enemy'),
  ...viewers.flatMap(viewer => [
    (api, scene) => api.info.project(scene, viewer),
    (api, scene) => api.info.facts(scene, { actorId: 'hero', targetId: 'enemy' }, viewer),
    (api, scene) => api.info.knownHealth(scene, 'hero', 'enemy', viewer),
    (api, scene) => api.inventory.project(scene, viewer),
  ]),
  (api, scene) => api.inventory.status(scene, 'hero', { id: 'item-0', operation: 'spend', amount: 3 }),
  (api, scene) => api.inventory.status(scene, 'hero', { id: 'item-0', operation: 'gain', amount: 5 }),
];

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
const scene = table(), expected = clone(scene);
for (const variant of [scene, { ...clone(scene), actors: scene.actors.map((participant, i) => ({ ...clone(participant), hidden: i === 1 })) }]) {
  for (const query of queries) {
    const answer = query(current, freeze(variant));
    if (compareBaseline) assert.deepEqual(clone(answer), clone(query(baseline, variant)), 'query results preserve canonical normalization and private projections');
  }
}
assert.deepEqual(clone(scene), expected, 'queries preserve every input field');
assert.equal(current.inventory.status(scene, 'hero', { id: 'item-0' }).availableAmount, 2, 'active held costs reduce quoted availability');
assert.equal(current.inventory.project(scene, { role: 'player', actorId: 'enemy' }).hero.records['item-1'], undefined, 'private item remains hidden from another player');
const projection = current.info.project(scene, { role: 'narrator' });
projection.studies[0].revealedFactIds.push('forged'); projection.facts[0].value.current = 999;
assert.deepEqual(clone(scene), expected, 'returned information arrays and values are detached');

const legacy = table();
legacy.lionwing.information.studies[1].id = legacy.lionwing.information.studies[0].id;
legacy.lionwing.information.studies[1].categories = ['custom'];
legacy.lionwing.information.studies[0].scope = { kind: 'scene' };
legacy.lionwing.information.facts[0].label = { name: 'Legacy label' };
const legacyOutput = current.info.project(freeze(legacy), { role: 'narrator' });
assert.deepEqual(clone(legacyOutput.studies[1].categories), clone(legacyOutput.studies[0].categories), 'legacy duplicate ids keep first-match category resolution');
if (compareBaseline) assert.deepEqual(clone(legacyOutput), clone(baseline.info.project(legacy, { role: 'narrator' })));
legacyOutput.studies[0].scope.kind = 'changed'; legacyOutput.facts[0].label.name = 'changed';
assert.equal(legacy.lionwing.information.studies[0].scope.kind, 'scene', 'malformed saved scalar fields are detached too');
assert.equal(legacy.lionwing.information.facts[0].label.name, 'Legacy label');

let serialized = 0;
const poisoned = table();
const poison = { toJSON() { serialized++; throw new Error('query serialized unrelated snapshot or media'); } };
poisoned.undo = Array.from({ length: 20 }, () => ({ state: poison })); poisoned.redo = [{ state: poison }]; poisoned.turnUndo = Array.from({ length: 10 }, () => ({ state: poison }));
poisoned.artworks = [poison]; poisoned.actors[0].portrait = poison;
poisoned.lionwing.information.journal[0].before = poison;
poisoned.actors[0].lionwing.inventory.journal[0].before = poison;
// Narrator inventory projection intentionally includes its mechanical journal.
for (const query of queries.filter((_, index) => index !== 9)) {
  query(current, poisoned);
}
const geometryRequest = { actorId: 'hero', destination: { space: 'main', x: 2, y: 2 } };
assert.deepEqual(clone(current.geometry.footprintStatus(poisoned, geometryRequest)), clone(baseline.geometry.footprintStatus(expected, geometryRequest)));
assert.equal(serialized, 0, 'UI snapshots, media, and unreturned mechanical journal rows are never serialized');

const edit = table();
Object.assign(edit.actors[0].lionwing.inventory.records['item-0'], { charges: 1, current: 1, value: 1 });
assert.equal(current.inventory.status(edit, 'hero', { id: 'item-0', operation: 'spend' }).available, false, 'same-object balance change is immediate');
edit.lionwing.information.studies[1].status = 'cancelled';
assert.equal(current.info.studyCount(edit, { actorId: 'hero', scope: 'turn' }), 23, 'same-object Study edit is immediate');
edit.actors[1].hidden = true;
assert.equal(current.info.project(edit, { role: 'player', actorId: 'hero' }).facts.length, 0, 'same-object privacy edit is immediate');

const random = seededRandom(737);
for (let i = 0; i < 500; i++) {
  const body = () => ({ space: random() < .1 ? 'other' : 'main', x: Math.floor(random() * 15) + (i % 3 ? 0 : .25), y: Math.floor(random() * 15), occupiedWidth: Math.floor(random() * 6) - 1, occupiedHeight: Math.floor(random() * 6) - 1 });
  const a = body(), b = body();
  const cellsA = current.aura.bodyCells(a), cellsB = current.aura.bodyCells(b);
  const distance = a.space === b.space ? Math.min(...cellsA.flatMap(left => cellsB.map(right => Math.abs(left.x - right.x) + Math.abs(left.y - right.y)))) : Infinity;
  assert.equal(current.aura.footprintDistance(a, b), distance, 'constant time distance preserves nearest discrete occupied cells');
}
assert.equal(current.aura.footprintDistance({ space: 'main', x: NaN, y: 0 }, { space: 'main', x: 0, y: 0 }), Infinity);
assert.equal(current.aura.footprintDistance({ space: 'main', x: 0, y: 0, occupiedWidth: 1000000, occupiedHeight: 1000000 }, { space: 'main', x: 1000000, y: 1000000 }), 2, 'large rectangular bodies require no cell allocation');
console.log(`LionWing pure queries: ${compareBaseline ? 'baseline equivalence, ' : ''}immutable inputs/outputs, journal/privacy/reservations, current edits and aura distances passed`);

if (process.argv.includes('--benchmark')) {
  const rows = [];
  for (const [width, count] of [[7, 2], [12, 24]]) {
    const input = table(width, count);
    input.artworks = [{ id: 'art', image: `data:image/png;base64,${'A'.repeat(100000)}` }];
    const saved = clone(input);
    input.undo = Array.from({ length: 20 }, () => ({ state: saved })); input.turnUndo = Array.from({ length: 10 }, () => ({ state: saved })); input.redo = [];
    const panel = api => [api.info.project(input, { role: 'narrator' }), api.inventory.project(input, { role: 'owner', actorIds: ['hero'] }), ...Array.from({ length: 8 }, (_, i) => ['spend', 'gain'].map(operation => api.inventory.status(input, 'hero', { id: `item-${i}`, operation, amount: 1 })))];
    let answers;
    for (const [label, api] of [['baseline', baseline], ['changed', current]]) {
      const times = [];
      for (let run = 0; run < 3; run++) {
        const start = performance.now(), value = panel(api); times.push(performance.now() - start);
        if (answers) assert.deepEqual(clone(value), answers); else answers = clone(value);
      }
      times.sort((a, b) => a - b);
      rows.push({ label, board: `${width}x${width}`, actors: count, samples: 3, medianMs: +times[1].toFixed(2), maxMs: +times[2].toFixed(2) });
    }
  }
  console.log(JSON.stringify({ baselineRef, workload: 'Production information panel and inventory panel calls: 8 item rows with spend/gain quotes; bounded mechanical journals, 100KB art, 20 undo and 10 turn snapshots', rows }, null, 2));
}
