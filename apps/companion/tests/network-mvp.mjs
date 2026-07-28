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
      createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: { user } }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
        from: query,
      }),
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
await Sync.saveLibraryCharacter({ id: "local-hero", name: "Эта" });
assert.equal((await Sync.listLibraryCharacters()).length, 1);
assert.equal((await Sync.loadLibraryCharacter(library[0].id)).name, "Эта");
await Sync.deleteLibraryCharacter(library[0].id);
assert.equal((await Sync.listLibraryCharacters()).length, 0);

const migration = fs.readFileSync(new URL("../../../supabase/migrations/202607290001_dawn_network_mvp.sql", import.meta.url), "utf8");
assert.match(migration, /create table if not exists public\.user_characters/i);
assert.match(migration, /create or replace function public\.accept_scene_command/i);
assert.match(migration, /for update/i);
assert.match(migration, /current_command\.status = 'applied'/i);
assert.match(migration, /update public\.scene_commands[\s\S]+status = 'applied'/i);
assert.match(migration, /update public\.scenes[\s\S]+version = next_version/i);

const syncSource = fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8");
assert.match(syncSource, /async function listCampaigns\(\)/);
assert.match(syncSource, /async function openCampaign\(campaignId,sceneId\)/);
assert.match(syncSource, /p_command_id:rawId/, "bigint command ids must not pass through Number");
assert.match(syncSource, /acceptedVersion!==Number\(scene\?\.version\).*loadScene/s, "idempotent retries must reconcile a newer canonical Scene");
assert.match(syncSource, /\["http:","https:"\]\.includes\(global\.location\.protocol\)/, "file:// account links must fall back to the configured Site URL");
const privacyMigration = fs.readFileSync(new URL("../../../supabase/migrations/202607290002_dawn_public_actor_privacy.sql", import.meta.url), "utf8");
assert.match(privacyMigration, /item[\s\S]+- 'ownerId'[\s\S]+- 'skills'[\s\S]+- 'techniques'/, "player snapshots must redact private actor sheets");
assert.match(privacyMigration, /update public\.scene_public_snapshots/, "existing public snapshots must be backfilled");
const syncUiSource = fs.readFileSync(new URL("../app-sync-events.js", import.meta.url), "utf8");
assert.match(syncUiSource, /function hydratePlayerScene[\s\S]+heroActorState\(S,actor\)/, "the local player's redacted actor must be hydrated from their own hero");

console.log("Network MVP QA passed: cloud character ownership, rule handouts, and atomic command SQL");
