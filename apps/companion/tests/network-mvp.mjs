import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const engineContext = { console, Date };
engineContext.globalThis = engineContext;
engineContext.window = engineContext;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), engineContext);
loadSceneEngine(engineContext);
const Engine = engineContext.DAWN_SCENE_ENGINE;
const scene = {
  version: 0, round: 1, tension: 0, spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [], objects: [], markers: [], log: [], rollFeed: [], ruleHandouts: [],
};
const shared = Engine.dispatch(scene, {
  id: "rule-share-1",
  type: "rule.share",
  payload: { ruleId: "action.skirmish", title: "Стычка", kind: "Действие", sharedBy: "Нарратор" },
}).scene;
assert.deepEqual(
  JSON.parse(JSON.stringify(shared.ruleHandouts[0])),
  { id: "rule-share-1", ruleId: "action.skirmish", title: "Стычка", kind: "Действие", sharedBy: "Нарратор", at: shared.ruleHandouts[0].at },
);
assert.throws(() => Engine.dispatch(scene, { type: "rule.share", payload: { ruleId: "bad rule", title: "", kind: "x", sharedBy: "x" } }), /ссылка на правило/i);

const storage = new Map();
const library = [];
let pendingUpsert = null;
let createClientCalls = 0;
const user = { id: "00000000-0000-0000-0000-000000000101", email: "hero@example.com", is_anonymous: false };
function query(table) {
  let operation = "select", selectedId = null;
  const chain = {
    select() { return chain; },
    order() { return chain; },
    eq(column, value) { if (column === "id") selectedId = value; return chain; },
    upsert(record) { operation = "upsert"; pendingUpsert = { ...record, id: "00000000-0000-0000-0000-000000000201", version: 1, updated_at: new Date().toISOString() }; return chain; },
    delete() { operation = "delete"; return chain; },
    limit: async () => ({ data: library, error: null }),
    single: async () => {
      if (table !== "user_characters") return { data: null, error: new Error(`unexpected table ${table}`) };
      if (operation === "upsert") { library.splice(0, library.length, pendingUpsert); return { data: pendingUpsert, error: null }; }
      const record = library.find(item => item.id === selectedId);
      if (operation === "delete") { if (record) library.splice(library.indexOf(record), 1); return { data: { id: selectedId }, error: null }; }
      return { data: record, error: record ? null : new Error("not found") };
    },
  };
  return chain;
}
const syncContext = {
  window: {
    supabase: {
      createClient: () => {
        createClientCalls++;
        return {
        auth: {
          getSession: async () => ({ data: { session: { user } }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
        from: query,
      };
      },
    },
  },
  URL, console, setTimeout, clearTimeout,
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
};
vm.runInNewContext(fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8"), syncContext);
const Sync = syncContext.window.DAWN_SYNC;
Sync.configure({ url: "https://dawn-test.supabase.co", publishableKey: "sb_publishable_test", displayName: "Эта" });
await Sync.connect();
assert.equal(Sync.state().hasAccount, true);
await Sync.connect();
assert.equal(createClientCalls, 1, "reconnecting with the same project must reuse one Supabase client");
await Sync.saveLibraryCharacter({ id: "local-hero", name: "Эта" });
assert.equal((await Sync.listLibraryCharacters()).length, 1);
assert.equal((await Sync.loadLibraryCharacter(library[0].id)).name, "Эта");
await Sync.deleteLibraryCharacter(library[0].id);
assert.equal((await Sync.listLibraryCharacters()).length, 0);

const quotaContext = {
  window: {},
  URL,
  console: { ...console, warn() {} },
  setTimeout,
  clearTimeout,
  localStorage: {
    getItem: () => null,
    setItem: () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); },
  },
};
vm.runInNewContext(fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8"), quotaContext);
assert.doesNotThrow(
  () => quotaContext.window.DAWN_SYNC.configure({ url: "https://dawn-test.supabase.co", publishableKey: "sb_publishable_test", displayName: "Эта" }),
  "full browser storage must not interrupt network state transitions",
);

const migration = fs.readFileSync(new URL("../../../supabase/migrations/202607290001_dawn_network_mvp.sql", import.meta.url), "utf8");
assert.match(migration, /create table if not exists public\.user_characters/i);
assert.match(migration, /create or replace function public\.accept_scene_command/i);
assert.match(migration, /for update/i);
assert.match(migration, /current_command\.status = 'applied'/i);
assert.match(migration, /update public\.scene_commands[\s\S]+status = 'applied'/i);
assert.match(migration, /update public\.scenes[\s\S]+version = next_version/i);
const commandFixMigration = fs.readFileSync(new URL("../../../supabase/migrations/202607290003_fix_accept_scene_command_event_alias.sql", import.meta.url), "utf8");
assert.doesNotMatch(commandFixMigration, /declare[\s\S]*\bevent_item jsonb/i, "The command acceptor must not shadow its SQL event alias with a PL/pgSQL variable");
assert.match(commandFixMigration, /batch\.value->>'id'/, "Event validation must qualify the JSON array value explicitly");

const syncSource = fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8");
assert.match(syncSource, /async function listCampaigns\(\)/);
assert.match(syncSource, /async function openCampaign\(campaignId,sceneId\)/);
assert.match(syncSource, /p_command_id:rawId/, "bigint command ids must not pass through Number");
assert.match(syncSource, /acceptedVersion!==Number\(scene\?\.version\).*loadScene/s, "idempotent retries must reconcile a newer canonical Scene");
assert.match(syncSource, /\["http:","https:"\]\.includes\(global\.location\.protocol\)/, "file:// account links must fall back to the configured Site URL");
assert.match(syncSource, /function refreshSceneIfNewer[\s\S]+select\("version"\)[\s\S]+1000/, "a fast lightweight version heartbeat must recover missed Realtime Scene updates");
assert.match(syncSource, /broadcast[\s\S]+scene-command[\s\S]+refreshPendingCommands[\s\S]+scene-updated[\s\S]+refreshSceneIfNewer\(true\)/, "Realtime broadcast wakeups must bypass the polling delay in both directions");
assert.match(syncSource, /scene refresh failed[\s\S]+scheduleReconnect[\s\S]+command refresh failed[\s\S]+scheduleReconnect/, "transient synchronization failures must reconnect the current table automatically");
assert.match(syncSource, /57014[\s\S]+statement timeout[\s\S]+scheduleReconnect/, "database statement timeouts must be treated as retryable connection failures");
assert.match(syncSource, /scene_events[\s\S]+scene_version[\s\S]+refreshSceneIfNewer\(true\)/, "a public Scene event must immediately recover a missed snapshot update");
assert.match(syncSource, /function refreshPendingCommands[\s\S]+status","pending"[\s\S]+refreshPendingCommands\(\)/, "the narrator heartbeat must recover missed player commands");
assert.match(syncSource, /function serializeSceneMutation[\s\S]+acceptCommand[\s\S]+serializeSceneMutation[\s\S]+settleIntentBatch[\s\S]+serializeSceneMutation/s, "all authoritative Scene writes must share one mutation queue");
assert.match(syncSource, /presenceDetails=\{\.\.\.presenceDetails,\.\.\.extra\}/, "presence metadata must survive a Realtime reconnect");
assert.match(syncSource, /try\{localStorage\.setItem[\s\S]+DAWN sync settings could not be persisted/, "full browser storage must not break network state updates");
assert.match(syncSource, /client&&clientConfigKey!==nextConfigKey[\s\S]+if\(!client\)/, "the sync client must only be replaced when project credentials change");
assert.match(syncSource, /function refreshSceneIfNewer[\s\S]+sceneSessionIsActive\(sceneId,generation\)[\s\S]+function refreshPendingCommands[\s\S]+sceneSessionIsActive\(sceneId,generation\)/, "late heartbeat results from a previous table must be ignored");
assert.match(syncSource, /const subscriptionIsActive=[\s\S]+if\(!subscriptionIsActive\(\)\)return[\s\S]+scene_commands[\s\S]+subscriptionIsActive\(\)/, "callbacks from a removed Realtime channel must not mutate the current table");
assert.match(syncSource, /async function submitCommand[\s\S]+const sceneId=state\.sceneId,generation=sceneSessionGeneration,actorId=state\.userId[\s\S]+eq\("scene_id",sceneId\)[\s\S]+eq\("actor_id",actorId\)/, "idempotent command recovery must stay bound to the table and actor that sent it");
assert.match(syncSource, /async function deleteCampaign\(campaignId\)[\s\S]+delete_owned_campaign[\s\S]+campaignId:null[\s\S]+global\.DAWN_SYNC=\{[\s\S]+deleteCampaign/, "an owner can delete a saved table and the active client session is cleared");
const privacyMigration = fs.readFileSync(new URL("../../../supabase/migrations/202607290002_dawn_public_actor_privacy.sql", import.meta.url), "utf8");
assert.match(privacyMigration, /item[\s\S]+- 'ownerId'[\s\S]+- 'skills'[\s\S]+- 'techniques'/, "player snapshots must redact private actor sheets");
assert.match(privacyMigration, /update public\.scene_public_snapshots/, "existing public snapshots must be backfilled");
const syncUiSource = fs.readFileSync(new URL("../app-sync-events.js", import.meta.url), "utf8");
assert.match(syncUiSource, /function hydratePlayerScene[\s\S]+heroActorState\(S,actor\)/, "the local player's redacted actor must be hydrated from their own hero");
assert.match(syncUiSource, /NetworkV2\.AUTOMATIC_COMMANDS[\s\S]+command_type===["']intent_v2["'][\s\S]+enqueueNetworkV2Command/, "safe player intents and legacy MVP commands must be applied automatically");
assert.match(syncUiSource, /command_type===["']set_targets["'][\s\S]+applyTransientTargetsCommand[\s\S]+Sync\.decideCommand/, "player target suggestions must stay local to the narrator instead of versioning the whole Scene");
assert.match(syncUiSource, /retainPendingNetworkV2Commands\(pendingSceneCommands\.map/, "a second narrator must prune commands already settled elsewhere");
assert.match(syncUiSource, /chosen\?\.role===["']owner["'][\s\S]+sync-table-delete[\s\S]+Sync\.deleteCampaign/, "only the table owner sees and invokes destructive campaign deletion");
assert.match(syncUiSource, /sync-create-campaign[\s\S]+resetClientTableRuntime\(\)[\s\S]+Sync\.createCampaign\([^;]+sceneCore\(blankScene\(\)\)/, "a new campaign must start from a clean Scene instead of cloning the currently open table");
assert.doesNotMatch(syncUiSource, /Sync\.createCampaign\([^;]+sceneSnapshot\(\)/, "current table actors must never seed a new campaign");
assert.match(syncUiSource, /sync-table-open[\s\S]+resetClientTableRuntime\(\)[\s\S]+Sync\.openCampaign[\s\S]+sync-join-campaign[\s\S]+resetClientTableRuntime\(\)[\s\S]+Sync\.redeemInvite/, "every table switch must clear the previous table's client queues");
const sceneSyncUiSource = fs.readFileSync(new URL("../scene-sync-ui.js", import.meta.url), "utf8");
assert.match(sceneSyncUiSource, /ruleResponse[\s\S]+preparePromptPlacement[\s\S]+respondRulePrompt/, "rule prompt choices and placement events must be reconstructed against the narrator Scene");
assert.match(sceneSyncUiSource, /actor\.ownerId!==command\.actor_id/, "automatic event acceptance must verify actor ownership");
assert.match(sceneSyncUiSource, /settleIntentBatch/, "network v2 must settle a whole narrator tick atomically");

const deleteCampaignMigration = fs.readFileSync(new URL("../../../supabase/migrations/202607300001_delete_owned_campaign.sql", import.meta.url), "utf8");
assert.match(deleteCampaignMigration, /create or replace function public\.delete_owned_campaign/i);
assert.match(deleteCampaignMigration, /security definer[\s\S]+owner_id = auth\.uid\(\)/i, "campaign deletion must be owner-only even through the privileged RPC");
assert.match(deleteCampaignMigration, /delete from public\.campaigns/i, "campaign cascades are the single deletion root");
assert.match(deleteCampaignMigration, /grant execute on function public\.delete_owned_campaign\(uuid\)[\s\S]+to authenticated/i);

console.log("Network MVP QA passed: cloud character ownership, rule handouts, and atomic command SQL");
