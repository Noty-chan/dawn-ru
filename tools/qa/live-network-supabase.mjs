import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { runtime, fixture, actor, clone } from '../../apps/companion/tests/helpers/scene-contract-harness.mjs';

// This opt-in probe creates anonymous sessions and disposable campaigns in
// the configured Supabase project. It must never run as an ordinary CI test.
if (process.env.DAWN_LIVE_NETWORK_QA !== 'disposable-campaigns') {
  console.error('Set DAWN_LIVE_NETWORK_QA=disposable-campaigns to run live network QA. See supabase/README.md.');
  process.exit(2);
}
const requireQa = createRequire(new URL('../../output/qa-net/package.json', import.meta.url));
const { createClient } = requireQa('@supabase/supabase-js');

const config = fs.readFileSync(new URL('../../apps/companion/config.js', import.meta.url), 'utf8');
const url = config.match(/supabaseUrl:\s*["']([^"']+)["']/)[1];
const key = config.match(/publishableKey:\s*["']([^"']+)["']/)[1];
const tag = randomUUID().slice(0, 8), created = [], channels = [], timings = [];
const result = { status: 'running', tables: 5, players: 5, memberships: 0, commands: 0, ticks: 0, notifications: 0, cleanup: [] };
const fetchBounded = async (input, init = {}) => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try { return await fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal }); }
  finally { clearTimeout(timer); }
};
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetchBounded } });
const owner = client(), players = Array.from({ length: 5 }, client);
const check = (response, step) => { if (response.error) throw Object.assign(new Error(`${step}: ${response.error.code || response.error.message}`), { code: response.error.code }); return response.data; };
const one = value => Array.isArray(value) ? value[0] : value;
const { context, engine, data } = runtime();
vm.runInContext(fs.readFileSync(new URL('../../apps/companion/network-v2.js', import.meta.url), 'utf8'), context);
const network = context.window.DAWN_NETWORK_V2;
const scenes = [], observed = new Map();
let phase = 'auth';
try {
  const auth = await Promise.all([owner, ...players].map((c, i) => c.auth.signInAnonymously({ options: { data: { display_name: `QA load ${tag} ${i}` } } })));
  const sessions = auth.map((a, i) => check(a, `anonymous ${i}`));
  phase = 'create';
  for (let index = 0; index < 5; index++) {
    const initial = fixture();
    initial.version = 1; initial.activeActorId = null; initial.selectedActor = null;
    initial.actors = players.map((_, p) => actor(`hero-${p}`, 'hero', p, 0, { ownerId: sessions[p + 1].user.id }));
    initial.actors.push(actor('hidden-enemy', 'enemy', 7, 5, { hidden: true }));
    initial.privateNotes = `private-${tag}`;
    initial.objects = [{ id: 'deployment', type: 'deploy-hero', space: 'main', cells: players.flatMap((_, p) => [`${p},0`, `${p},1`]) }];
    const c = one(check(await owner.rpc('create_campaign', { p_name: `Disposable network QA ${tag} ${index}`, p_display_name: 'QA Narrator', p_initial_state: initial }), 'create'));
    created.push(c.campaign_id);
    const s = { ...c, state: initial, index }; scenes.push(s);
    const invite = check(await owner.rpc('create_campaign_invite', { p_campaign_id: c.campaign_id, p_role: 'player', p_max_uses: 5, p_expires_hours: 1 }), 'invite');
    await Promise.all(players.map(async (p) => { const m = one(check(await p.rpc('redeem_campaign_invite', { p_token: invite, p_display_name: 'QA Player' }), 'redeem')); assert.equal(m.campaign_id, c.campaign_id); assert.equal(m.role, 'player'); result.memberships++; }));
  }
  phase = 'subscribe';
  await Promise.all(scenes.flatMap(s => players.map((p, pi) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('subscribe timeout')), 12000);
    const ch = p.channel(`qa-${tag}-${s.index}-${pi}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scene_public_snapshots', filter: `scene_id=eq.${s.scene_id}` }, payload => {
      observed.set(`${s.index}:${pi}`, { version: Number(payload.new.version), at: performance.now() });
      result.notifications++;
    }).subscribe(status => { if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); } else if (status === 'CHANNEL_ERROR') { clearTimeout(timer); reject(new Error('channel error')); } });
    channels.push({ p, ch });
  }))));
  for (let round = 0; round < 2; round++) {
    phase = `commands-${round}`;
    const batches = await Promise.all(scenes.map(async s => {
      const intents = players.map((_, pi) => ({ kind: 'deployment', actorId: `hero-${pi}`, destination: { space: 'main', x: pi, y: round === 0 ? 1 : 0 }, label: `QA deployment ${pi}` }));
      const commands = await Promise.all(players.map(async (p, pi) => {
        const id = randomUUID();
        const row = { campaign_id: s.campaign_id, scene_id: s.scene_id, actor_id: sessions[pi + 1].user.id, command_type: 'intent_v2', client_intent_id: id, payload: { clientIntentId: id, intent: intents[pi] } };
        const start = performance.now();
        const command = check(await p.from('scene_commands').insert(row).select('id,status').single(), 'insert');
        timings.push({ phase: 'insert', ms: performance.now() - start }); assert.equal(command.status, 'pending'); result.commands++;
        return command;
      }));
      let next = clone(s.state), events = [];
      for (let pi = 0; pi < 5; pi++) {
        const raw = network.materializeIntent(next, data, intents[pi], sessions[pi + 1].user.id, { sceneEngine: engine });
        const packet = raw.map((e, ei) => ({ ...clone(e), id: `${tag}-${s.index}-${round}-${pi}-${ei}` }));
        const applied = engine.dispatchMany(next, packet, { expectedVersion: next.version });
        next = applied.scene; events.push(...clone(applied.events));
      }
      assert.ok(events.length > 0);
      // Same event-count version assignment used by production authority flush.
      next.version = s.state.version + events.length;
      return { s, commands, request: { p_scene_id: s.scene_id, p_expected_version: s.state.version, p_command_ids: commands.map(c => Number(c.id)), p_rejected_command_ids: [], p_events: events, p_state: clone(next), p_label: `qa.load.${tag}.${round}` } };
    }));
    phase = `settle-${round}`;
    const starts = new Map();
    await Promise.all(batches.map(async b => {
      const start = performance.now(); starts.set(b.s.index, start);
      const version = check(await owner.rpc('settle_scene_intent_batch', b.request), 'settle');
      assert.equal(Number(version), b.request.p_state.version); b.s.state = b.request.p_state;
      timings.push({ phase: 'settle', ms: performance.now() - start }); result.ticks++;
      const retry = check(await owner.rpc('settle_scene_intent_batch', b.request), 'exact retry'); assert.equal(Number(retry), Number(version));
    }));
    phase = `readback-${round}`;
    await Promise.all(scenes.flatMap(s => players.map(async (p, pi) => {
      const snapshot = check(await p.from('scene_public_snapshots').select('state,version').eq('scene_id', s.scene_id).single(), 'public snapshot');
      assert.equal(snapshot.version, s.state.version); assert.equal(snapshot.state.privateNotes, undefined);
      assert.equal(snapshot.state.actors.some(a => a.id === 'hidden-enemy'), false);
      for (let id = 0; id < 5; id++) assert.equal(snapshot.state.actors.find(a => a.id === `hero-${id}`).y, round === 0 ? 1 : 0);
      assert.deepEqual(check(await p.from('scenes').select('id').eq('id', s.scene_id), 'RLS narrator'), []);
      const deadline = performance.now() + 8000;
      while ((observed.get(`${s.index}:${pi}`)?.version || 0) < s.state.version && performance.now() < deadline) await new Promise(r => setTimeout(r, 50));
      const seen = observed.get(`${s.index}:${pi}`); assert.equal(seen?.version, s.state.version, 'Realtime did not deliver committed snapshot');
      timings.push({ phase: 'realtime', ms: seen.at - starts.get(s.index) });
    })));
    for (const b of batches) {
      const saved = check(await owner.from('scene_events').select('client_event_id').eq('scene_id', b.s.scene_id), 'events');
      assert.equal(new Set(saved.map(e => e.client_event_id)).size, saved.length, 'duplicate event');
      const status = check(await owner.from('scene_commands').select('status').in('id', b.commands.map(c => c.id)), 'commands');
      assert.ok(status.every(c => c.status === 'applied'));
    }
    if (round === 0) {
      phase = 'altered-retry';
      const altered = { ...batches[0].request, p_label: 'changed' };
      const reply = await owner.rpc('settle_scene_intent_batch', altered).retry(false);
      result.changedRetry = { code: reply.error?.code || null, outcome: reply.error?.code === 'PT409' ? 'version-conflict' : reply.error ? 'transport-or-other-error' : 'accepted' };
      if (reply.error?.code !== 'PT409') result.unresolved = ['altered retry returns no SQL conflict before timeout'];
      const unchanged = check(await owner.from('scenes').select('version,state').eq('id', batches[0].s.scene_id).single(), 'altered retry readback');
      assert.equal(unchanged.version, batches[0].s.state.version);
      assert.deepEqual(unchanged.state, batches[0].s.state, 'altered retry mutated the saved state');
    }
  }
  phase = 'same-version-race';
  const raceScene = scenes[0];
  const raceState = { ...clone(raceScene.state), version: raceScene.state.version + 1 };
  const raceStart = performance.now();
  const race = await Promise.all(Array.from({ length: 5 }, (_, i) => owner.rpc('settle_scene_intent_batch', {
    p_scene_id: raceScene.scene_id, p_expected_version: raceScene.state.version, p_command_ids: [], p_rejected_command_ids: [],
    p_events: [{ id: `${tag}-race-${i}`, type: 'scene.snapshot', actorId: null, payload: { label: 'QA concurrent snapshot' }, at: new Date().toISOString() }],
    p_state: raceState, p_label: `qa.race.${tag}.${i}`,
  }).retry(false)));
  assert.equal(race.filter(r => !r.error).length, 1);
  assert.equal(race.filter(r => r.error?.code === 'PT409').length, 4);
  const persistedRace = check(await owner.from('scenes').select('version,state').eq('id', raceScene.scene_id).single(), 'race readback');
  assert.equal(persistedRace.version, raceState.version); assert.deepEqual(persistedRace.state, raceState); raceScene.state = raceState;
  result.sameVersionRace = { requests: 5, committed: 1, conflicts: 4, elapsedMs: Math.round(performance.now() - raceStart) };
  phase = 'reconnect';
  for (let pi = 0; pi < 5; pi++) {
    const refresh = check(await players[pi].auth.refreshSession(), 'refresh');
    const reloaded = client();
    check(await reloaded.auth.setSession({ access_token: refresh.session.access_token, refresh_token: refresh.session.refresh_token }), 'restore');
    for (const s of scenes) { const row = check(await reloaded.from('scene_public_snapshots').select('version,state').eq('scene_id', s.scene_id).single(), 'reload'); assert.equal(row.version, s.state.version); assert.ok(row.state.actors.every(a => a.y === 0)); }
    await reloaded.removeAllChannels();
  }
  result.reconnects = 5;
  result.status = result.unresolved ? 'passed-core-with-unresolved-conflict-timeout' : 'passed';
} catch (error) { result.status = 'failed'; result.failure = { phase, code: error.code || error.name, message: String(error.message).slice(0, 180) }; }
finally {
  await Promise.all(channels.map(({ p, ch }) => p.removeChannel(ch).catch(() => {})));
  for (const id of created) { try { result.cleanup.push({ deleted: check(await owner.rpc('delete_owned_campaign', { p_campaign_id: id }), 'cleanup') === true }); } catch (error) { result.cleanup.push({ deleted: false, code: error.code || error.name }); } }
  if (result.cleanup.some(c => !c.deleted)) result.status = 'cleanup-incomplete';
  for (const stage of ['insert', 'settle', 'realtime']) { const values = timings.filter(t => t.phase === stage).map(t => Math.round(t.ms)).sort((a, b) => a - b); result[`${stage}LatencyMs`] = { count: values.length, median: values[Math.floor(values.length / 2)] ?? null, max: values.at(-1) ?? null }; }
  console.log(JSON.stringify(result, null, 2));
}
process.exit(result.status === 'passed' ? 0 : 1);
