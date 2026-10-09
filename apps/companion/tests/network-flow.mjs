import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

// Run the production authority flush function with real Scene and network
// engines. Only browser rendering and the Supabase RPC boundary are mocked.
const context = { console, Date, structuredClone, setTimeout, clearTimeout };
context.globalThis = context;
context.window = context;
context.performance = { now: () => 1000 };
context.CustomEvent = class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
context.dispatchEvent = () => {};
context.uid = (() => { let id = 0; return () => `flow-${++id}`; })();
context.toast = () => {};
context.trimSceneHistory = history => history.slice(0, 20);
context.sceneCore = scene => structuredClone(scene);
context.normalizeScene = scene => structuredClone(scene);
context.renderNetworkScene = () => {};
context.captureSceneFxContext = () => ({});
context.playSceneEventFx = () => {};
context.syncHeroFromScene = () => {};
context.persist = () => {};
context.store = { mode: "play" };
context.renderPlay = () => {};
context.renderToolsWorkspace = () => {};
context.renderScene = () => {};
context.renderChallengeRequestDock = () => {};
context.friendlySyncError = (_error, fallback) => fallback;
context.assertNetworkSceneFits = () => {};
context.data = {};

vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(new URL("../network-v2.js", import.meta.url), "utf8"), context);

const Engine = context.DAWN_SCENE_ENGINE;
const Network = context.DAWN_NETWORK_V2;
const baseScene = {
  version: 12, round: 1, tension: 0, activeActorId: null, rulesEdition: "ru-v0.9",
  spaces: [{ id: "main", width: 7, height: 7 }], activeSpace: "main", tool: "select",
  actors: [
    { id: "hero", ownerId: "player-1", heroId: "sheet-1", name: "Герой", team: "hero", kind: "hero", space: "main", x: 0, y: 0, hp: 10, maxHp: 10, effects: [], acted: false },
    { id: "enemy", name: "Враг", team: "enemy", kind: "enemy", space: "main", x: 4, y: 4, hp: 8, maxHp: 8, effects: [], acted: false },
  ],
  objects: [{ id: "hero-deploy", space: "main", type: "deploy-hero", cells: ["0,0", "0,1"] }],
  markers: [], walls: [], sessionClocks: [], rollFeed: [], log: [], undo: [], redo: [], turnUndo: [],
};

let Scene = structuredClone(baseScene);
let persisted = structuredClone(baseScene);
const rpcCalls = [];
function validateRpcVersion(args) {
  if (Number(args.scene.version) !== Number(args.expectedVersion) + args.events.length) {
    throw new Error("state version does not match event batch");
  }
}
const Sync = {
  state: () => ({ sceneId: "scene-1", canNarrate: true, version: persisted.version }),
  async settleIntentBatch(args) {
    // This is the SQL state.version invariant. Throw the same diagnostic if
    // the production flush sends a mismatched snapshot/event batch.
    validateRpcVersion(args);
    if (Number(persisted.version) !== Number(args.expectedVersion)) throw new Error("scene version conflict");
    rpcCalls.push(structuredClone(args));
    persisted = structuredClone(args.scene);
    return persisted.version;
  },
  async refreshScene() { context.Scene = Network.mergeRemoteScene(persisted, context.Scene); },
};
context.Scene = Scene;
context.Sync = Sync;
context.SceneEngine = Engine;
context.NetworkV2 = Network;
context.mergeNetworkV2Scene = (remote, current) => Network.mergeRemoteScene(remote, current);
context.TechniqueEngine = {};
context.D = context.DAWN_DATA;
context.safeTechniqueEffectIds = () => [];
context.Scene = Scene;
const source = fs.readFileSync(new URL("../scene-sync-ui.js", import.meta.url), "utf8");
const flushStart = source.indexOf("async function flushNetworkV2Authority(items)");
assert.notEqual(flushStart, -1, "production flush function is present");
vm.runInNewContext(source.slice(flushStart), context, { filename: "scene-sync-ui.js#flushNetworkV2Authority" });

async function flush(items) {
  context.Scene = Scene;
  await context.flushNetworkV2Authority(items);
  Scene = context.Scene;
}

// Coalesce a narrator snapshot, a narrator event, and a player's precombat
// placement intent. The real reducer must produce the persisted batch and the
// mocked SQL boundary verifies the exact version/event arithmetic.
Network.setConfirmedScene(baseScene);
const narratorSnapshot = structuredClone(baseScene);
narratorSnapshot.name = "До боя";
narratorSnapshot.actors[1].hp = 6;
const deploymentIntent = {
  kind: "deployment", actorId: "hero", destination: { space: "main", x: 0, y: 1 }, label: "Развертывание",
};
const narratorEvent = { type: "rule.share", payload: { ruleId: "action.skirmish", title: "Стычка", kind: "Действие", sharedBy: "Нарратор" } };
await flush([
  { kind: "snapshot", baseScene: structuredClone(baseScene), scene: narratorSnapshot, label: "Правка Нарратора" },
  { kind: "events", events: [narratorEvent], label: "Поделиться правилом" },
  { kind: "command", command: { id: "101", actor_id: "player-1", payload: { protocol: 2, clientIntentId: "00000000-0000-4000-8000-000000000101", baseVersion: 12, intent: deploymentIntent } } },
]);
assert.equal(rpcCalls.length, 1);
assert.equal(rpcCalls[0].events.length, 4, "one snapshot audit event, one narrator event, and two deployment events are persisted");
assert.equal(rpcCalls[0].scene.version, rpcCalls[0].expectedVersion + rpcCalls[0].events.length);
assert.equal(rpcCalls[0].scene.version, 16);
assert.equal(rpcCalls[0].scene.actors.find(actor => actor.id === "hero").y, 1);
assert.equal(rpcCalls[0].scene.actors.find(actor => actor.id === "enemy").hp, 6);
assert.deepEqual(Array.from(rpcCalls[0].commandIds), ["101"]);

// A narrator's enemy removal is a one-event snapshot. Verify the canonical
// state has no enemy, then exercise the same merge used by the scene reload
// listener and ensure the deletion survives hydration.
const beforeRemoval = structuredClone(persisted);
Network.setConfirmedScene(beforeRemoval);
const afterRemoval = structuredClone(beforeRemoval);
afterRemoval.actors = afterRemoval.actors.filter(actor => actor.id !== "enemy");
afterRemoval.objects = afterRemoval.objects.filter(object => object.ownerActorId !== "enemy");
await flush([{ kind: "snapshot", baseScene: beforeRemoval, scene: afterRemoval, label: "Убран враг" }]);
assert.equal(rpcCalls[1].events.length, 1, "bulk state removal is represented by one scene.snapshot audit event");
assert.equal(rpcCalls[1].scene.version, rpcCalls[1].expectedVersion + 1);
const reloaded = Network.mergeRemoteScene(persisted, Scene);
assert.ok(!reloaded.actors.some(actor => actor.id === "enemy"), "reload merge retains the narrator's enemy removal");
assert.equal(reloaded.actors.find(actor => actor.id === "hero").y, 1, "reload retains the player's accepted deployment");

assert.throws(() => validateRpcVersion({ expectedVersion: 20, events: [{ id: "x" }], scene: { version: 20 } }),
  /state version does not match event batch/, "the mocked RPC boundary reproduces the SQL error for a stale candidate version");
const migration = fs.readFileSync(new URL("../../../supabase/migrations/202607290004_network_v2_intent_batches.sql", import.meta.url), "utf8");
assert.match(migration, /p_state->>'version'[\s\S]+p_expected_version\s*\+\s*event_count/i);
assert.match(migration, /raise exception 'state version does not match event batch'/i);

// Once one action would overflow a tick, later actions must not overtake it
// merely because they happen to be smaller.
Scene = structuredClone(persisted);
Network.setConfirmedScene(persisted);
const requeuedAfterOverflow = [];
context.networkV2Authority = { defer: items => requeuedAfterOverflow.push(...items) };
const crowdedEvents = Array.from({ length: Network.MAX_BATCH_EVENTS - 1 }, (_, index) => ({
  type: "rule.share", payload: { ruleId: "action.skirmish", title: `Crowded ${index}`, kind: "Действие", sharedBy: "Narrator" },
}));
const tooLargeForRemainingSlot = { kind: "command", command: { id: "102", actor_id: "player-1", payload: { protocol: 2, clientIntentId: "00000000-0000-4000-8000-000000000102", baseVersion: persisted.version, intent: { ...deploymentIntent, destination: { space: "main", x: 0, y: 0 } } } } };
const laterSmallAction = { kind: "events", events: [{ type: "rule.share", payload: { ruleId: "action.skirmish", title: "Later small action", kind: "Действие", sharedBy: "Narrator" } }] };
await flush([{ kind: "events", events: crowdedEvents }, tooLargeForRemainingSlot, laterSmallAction]);
assert.equal(rpcCalls[2].events.length, Network.MAX_BATCH_EVENTS - 1, "the full first tick stops at the first deferred item");
assert.deepEqual(Array.from(rpcCalls[2].commandIds), [], "the two-event deployment is not pulled ahead of an earlier overflowing action");
assert.deepEqual(requeuedAfterOverflow, [tooLargeForRemainingSlot, laterSmallAction], "the overflow item and every later action retain their original order");

// A committed RPC can lose its HTTP response. The queue must repeat the
// exact event IDs and state so the database can recognize its receipt.
const lostResponseBatch = [];
let firstResponseLost = true;
Sync.settleIntentBatch = async args => {
  lostResponseBatch.push(structuredClone(args));
  if (firstResponseLost) {
    firstResponseLost = false;
    persisted = structuredClone(args.scene);
    const error = new Error("network response lost");
    error.retryable = true;
    throw error;
  }
  assert.equal(JSON.stringify(args), JSON.stringify(lostResponseBatch[0]), "retry must repeat the exact settled request");
  return persisted.version;
};
const retryItem = { kind: "events", events: [narratorEvent], label: "Повтор после потери ответа" };
await assert.rejects(() => flush([retryItem]), /network response lost/);
await flush([retryItem]);
assert.equal(lostResponseBatch.length, 2);
assert.equal(Scene.version, persisted.version);

// PT409 must invalidate the cached tick as well as refresh the Scene. Merely
// retrying the immutable old receipt would keep its stale expectedVersion.
persisted=structuredClone(baseScene);
context.Scene=structuredClone(baseScene);
Network.setConfirmedScene(baseScene);
context.pendingSceneCommands=[];
context.retainPendingNetworkV2Commands=()=>{};
const conflictCalls=[];
Sync.settleIntentBatch=async args=>{
  conflictCalls.push(structuredClone(args));
  if(conflictCalls.length===1){
    persisted.version++;
    persisted.name="Concurrent edit";
    await Sync.refreshScene();
    throw Object.assign(new Error("scene version conflict"),{code:"PT409"});
  }
  assert.equal(args.expectedVersion,persisted.version);
  persisted=structuredClone(args.scene);
  return persisted.version;
};
const conflictQueue=new Network.AuthorityQueue({tickMs:10000,flush:items=>context.flushNetworkV2Authority(items)});
context.networkV2Authority=conflictQueue;
conflictQueue.enqueue({kind:"events",events:[narratorEvent]});
await conflictQueue.flush();
assert.equal(conflictQueue.retryBatch[0]._networkTick,undefined,"PT409 drops the stale materialized request");
await conflictQueue.flush();
assert.equal(conflictCalls.length,2);
assert.equal(conflictCalls[1].expectedVersion,conflictCalls[0].expectedVersion+1,"retry recomputes from the refreshed version");
assert.equal(persisted.name,"Concurrent edit","recomputation preserves the concurrent canonical change");
assert.equal(conflictQueue.pending(),0);
conflictQueue.clear();

// Use the real queue with the real authority flush: deferred slots must move
// ahead of existing queued work without counting twice at the 200-item cap.
for (const { total, arrival, loseReply } of [
  { total: 40 }, { total: 200 }, { total: 40, arrival: true },
  { total: 40, loseReply: true }, { total: 200, loseReply: true },
]) {
  persisted = structuredClone(baseScene);
  context.Scene = structuredClone(baseScene);
  Network.setConfirmedScene(baseScene);
  let releaseRpc, receipt = null, attempts = 0;
  const gate = new Promise(resolve => { releaseRpc = resolve; });
  const durableTitles = [], errors = [];
  Sync.settleIntentBatch = async args => {
    attempts++;
    if (attempts === 1) await gate;
    if (receipt && JSON.stringify(args) === JSON.stringify(receipt)) return persisted.version;
    validateRpcVersion(args);
    assert.equal(args.expectedVersion, persisted.version);
    persisted = structuredClone(args.scene);
    durableTitles.push(...args.events.map(event => event.payload.title));
    if (loseReply && attempts === 1) {
      receipt = structuredClone(args);
      throw Object.assign(new Error("reply lost after commit"), { retryable: true });
    }
    return persisted.version;
  };
  const queue = new Network.AuthorityQueue({ tickMs: 10000, flush: items => context.flushNetworkV2Authority(items), onError: error => errors.push(error) });
  context.networkV2Authority = queue;
  const queuedItem = tag => ({ kind: "events", tag, events: Array.from({ length: tag === 0 ? 191 : 1 }, () => ({ type: "rule.share", payload: { ruleId: "action.skirmish", title: `queue-${tag}`, kind: "Действие", sharedBy: "Narrator" } })) });
  for (let tag = 0; tag < total; tag++) queue.enqueue(queuedItem(tag));
  const firstFlush = queue.flush();
  assert.equal(queue.inFlight.length, 20);
  if (arrival) queue.enqueue(queuedItem(total));
  if (total === 200) assert.throws(() => queue.enqueue(queuedItem(total)), /переполнена/, "new arrivals cannot exceed capacity while the RPC is pending");
  releaseRpc();
  await firstFlush;
  if (loseReply) {
    assert.equal(queue.pending(), total, "a lost response retains the complete exact tick");
    await queue.flush();
  }
  assert.equal(queue.failed.length, 0, "a committed full tick cannot report deferred slots as a capacity failure");
  assert.equal(queue.pending(), total + Number(Boolean(arrival)) - 2);
  assert.equal(queue.queue[0].tag, 2, "first deferred action precedes every later arrival");
  while (queue.pending()) await queue.flush();
  const order = durableTitles.filter((title, index) => title !== durableTitles[index - 1]);
  assert.deepEqual(order, Array.from({ length: total + Number(Boolean(arrival)) }, (_, tag) => `queue-${tag}`), "all actions persist once in FIFO order across overflow and exact retry");
  assert.equal(durableTitles.length, 190 + total + Number(Boolean(arrival)));
  assert.equal(errors.length, loseReply ? 1 : 0);
  queue.clear();
}

// A deterministic server rejection must remove its speculative snapshot from
// the live board immediately, while retaining the failed items for manual retry.
const sceneSyncSource = fs.readFileSync(new URL("../scene-sync-ui.js", import.meta.url), "utf8");
const runtimeStart = sceneSyncSource.indexOf("function ensureNetworkV2Runtime(){");
const queueStatusStart = sceneSyncSource.indexOf("function networkV2QueueStatus(){", runtimeStart);
const retryFailedStart = sceneSyncSource.indexOf("function retryNetworkV2Failed(){", queueStatusStart);
assert.ok(runtimeStart >= 0 && queueStatusStart > runtimeStart && retryFailedStart > queueStatusStart);
vm.runInNewContext(sceneSyncSource.slice(runtimeStart, retryFailedStart), context, { filename: "scene-sync-ui.js#authority-runtime" });
context.pendingNetworkPlacements = new Map(); context.refreshPendingManualUi = ()=>{}; context.networkV2Authority = null;
context.networkV2Outbox = null;
context.NetworkV2 = Network;
const canonicalAfterRejection = structuredClone(persisted);
const speculativeSnapshot = structuredClone(canonicalAfterRejection);
speculativeSnapshot.actors[0].name = "Спекулятивная правка";
Scene = structuredClone(speculativeSnapshot);
context.Scene = Scene;
Network.setConfirmedScene(canonicalAfterRejection);
let canonicalRefreshes = 0;
const unsavedStatuses = [];
context.Sync = {
  state: () => ({ sceneId: "scene-1", canNarrate: true, version: canonicalAfterRejection.version }),
  settleIntentBatch: async () => { throw Object.assign(new Error('column reference "request_hash" is ambiguous'), { code: "42702", status: 400 }); },
  async refreshScene() {
    canonicalRefreshes++;
    const merged = context.mergeNetworkV2Scene(canonicalAfterRejection, context.Scene);
    context.Scene = merged;
  },
};
context.mergeNetworkV2Scene = (remote, current) => {
  const canonical = Network.mergeRemoteScene(remote, current);
  const snapshot = context.networkV2Authority?.latestSnapshot?.();
  if (!context.Sync?.state?.().canNarrate || !snapshot) return canonical;
  return Network.restoreLocalUi(Network.rebaseSceneSnapshot(snapshot.baseScene || canonical, snapshot.scene, canonical), canonical);
};
context.friendlySyncError = error => error.message;
context.toast = () => {};
context.renderSync = () => unsavedStatuses.push(context.networkV2QueueStatus());
const recoveryRuntime = context.ensureNetworkV2Runtime();
context.networkV2Authority = recoveryRuntime.authority;
recoveryRuntime.authority.enqueue({ kind: "snapshot", baseScene: canonicalAfterRejection, scene: speculativeSnapshot, label: "Rejected local edit" });
await recoveryRuntime.authority.flush();
assert.equal(canonicalRefreshes, 1, "permanent authority failures trigger an immediate canonical Scene refresh");
assert.equal(context.Scene.actors[0].name, canonicalAfterRejection.actors[0].name, "the rejected speculative actor edit disappears from the live Scene");
assert.equal(recoveryRuntime.authority.failed.length, 1, "canonical refresh preserves the rejected snapshot for explicit retry");
assert.equal(recoveryRuntime.authority.latestSnapshot(), null, "the rejected snapshot is not overlaid after canonical refresh");
assert.equal(unsavedStatuses.at(-1).failed, 1, "the sync UI rerenders with the unsaved-change state after refresh");
recoveryRuntime.authority.clear();

console.log("Network flow integration QA passed: ordered batches, immediate recovery, version invariant and exact retry");
