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

console.log("Network flow integration QA passed: coalesced deployment, version invariant, enemy removal, reload and exact retry");
