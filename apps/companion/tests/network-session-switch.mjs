import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const scene1 = "00000000-0000-4000-8000-000000000111";
const scene2 = "00000000-0000-4000-8000-000000000112";
const campaign1 = "00000000-0000-4000-8000-000000000221";
const campaign2 = "00000000-0000-4000-8000-000000000222";
const user = { id: "00000000-0000-4000-8000-000000000333", is_anonymous: true };
const storage = new Map([["dawn-ru-sync-v1", JSON.stringify({
  url: "https://dawn-test.supabase.co", publishableKey: "sb_test", sceneId: scene1, campaignId: campaign1, role: "owner",
})]]);
const rpcCalls = [];
const submittedCommands = [];
let releaseFirstRpc;
let notifyFirstRpc;
const firstRpcStarted = new Promise(resolve => { notifyFirstRpc = resolve; });
const firstRpcGate = new Promise(resolve => { releaseFirstRpc = resolve; });
let nextRpcError = null;
let deferCampaign1Membership = false;
let releaseCampaign1Membership;
let markCampaign1MembershipStarted;
const campaign1MembershipStarted = new Promise(resolve => { markCampaign1MembershipStarted = resolve; });
const campaign1MembershipGate = new Promise(resolve => { releaseCampaign1Membership = resolve; });

function query(table) {
  const filters = new Map();
  let inserted = null;
  const chain = {
    select() { return chain; },
    eq(column, value) { filters.set(column, value); return chain; },
    insert(record) { inserted = { ...record }; submittedCommands.push(inserted); return chain; },
    order() { return chain; },
    async maybeSingle() {
      if (deferCampaign1Membership && filters.get("campaign_id") === campaign1) {
        deferCampaign1Membership = false;
        markCampaign1MembershipStarted();
        await campaign1MembershipGate;
      }
      return { data: { role: "owner", display_name: "Narrator" }, error: null };
    },
    async single() {
      if (table === "campaigns") {
        const id = filters.get("id");
        return { data: { id, name: id === campaign1 ? "First campaign" : "Second campaign" }, error: null };
      }
      if (table === "scene_commands" && inserted) return { data: { ...inserted, id: "201", status: "pending" }, error: null };
      if (table === "scenes") {
        const id = filters.get("id");
        const targetCampaign = id === scene1 ? campaign1 : campaign2;
        return { data: { id, campaign_id: targetCampaign, name: `Scene ${id}`, state: { version: 1, actors: [] }, version: 1 }, error: null };
      }
      throw new Error(`Unexpected single query: ${table}`);
    },
    async limit() { return { data: [], error: null }; },
  };
  return chain;
}

const channel = {
  on() { return this; },
  subscribe(callback) { callback("SUBSCRIBED"); return this; },
  track: async () => {},
  presenceState: () => ({}),
  send: async () => {},
};
const client = {
  auth: {
    getSession: async () => ({ data: { session: { user } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: query,
  channel: () => channel,
  removeChannel: async () => {},
  rpc: async (name, args) => {
    rpcCalls.push({ name, args });
    if (nextRpcError) { const error = nextRpcError; nextRpcError = null; return { data: null, error }; }
    if (rpcCalls.length === 1) { notifyFirstRpc(); await firstRpcGate; }
    return { data: 2, error: null };
  },
};
const browser = {
  supabase: { createClient: () => client },
  navigator: { onLine: true },
  setInterval: () => 1,
  clearInterval() {},
  addEventListener() {},
};
const context = {
  window: browser, URL, console, setTimeout, clearTimeout,
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
};
vm.runInNewContext(fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8"), context);
const Sync = browser.DAWN_SYNC;
await Sync.connect();

const first = Sync.acceptCommand("101", [{ id: "e1", type: "round.end", actorId: null, payload: {} }], { version: 2 }, "first");
await firstRpcStarted;
const queuedFromOldTable = Sync.acceptCommand("102", [{ id: "e2", type: "round.start", actorId: null, payload: {} }], { version: 2 }, "queued old table command");
await Sync.openCampaign(campaign2, scene2);
releaseFirstRpc();
const [firstResult, queuedResult] = await Promise.allSettled([first, queuedFromOldTable]);
assert.equal(firstResult.status, "rejected", "the already-sent old-table request must not update the new local session");
assert.equal(queuedResult.status, "rejected", "a mutation queued for a previous table is canceled before sending");
assert.match(String(queuedResult.reason?.message), /Стол уже закрыт/);
assert.deepEqual(rpcCalls.map(call => call.name), ["accept_scene_command"], "a queued old-table command is never sent against the newly opened table");
assert.equal(Sync.state().sceneId, scene2);

deferCampaign1Membership = true;
const staleOpen = Sync.openCampaign(campaign1, scene1);
await campaign1MembershipStarted;
await Sync.openCampaign(campaign2, scene2);
releaseCampaign1Membership();
await staleOpen;
assert.equal(Sync.state().sceneId, scene2, "a slow earlier table selection cannot override the later selection");
assert.equal(Sync.state().campaignId, campaign2);

const commandId = "00000000-0000-4000-8000-000000000201";
const submitted = await Sync.submitCommand("intent_v2", { clientIntentId: commandId, protocol: 2, intent: { kind: "public-roll" } });
assert.equal(submitted.id, "201");
assert.equal(submittedCommands.length, 1);
assert.equal(submittedCommands[0].scene_id, scene2, "a newly submitted idempotent intent is bound to the active table");
assert.equal(submittedCommands[0].campaign_id, campaign2);
assert.equal(submittedCommands[0].actor_id, user.id);

const syncSource = fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8");
const submitStart = syncSource.indexOf("async function submitCommand(commandType,payload={}){");
const acceptStart = syncSource.indexOf("async function acceptCommand(", submitStart);
const submitBody = syncSource.slice(submitStart, acceptStart);
assert.match(submitBody, /const sceneId=String\(state\.sceneId\|\|""\)[\s\S]+generation=sceneSessionGeneration[\s\S]+await ensureConnected\(\);[\s\S]+sceneSessionIsActive\(sceneId,generation\)/,
  "submitCommand captures its scene generation before connection recovery and rechecks it before creating the insert");
const saveCharacterStart = syncSource.indexOf("async function saveCharacter(hero){");
const listCharactersStart = syncSource.indexOf("async function listCharacters(){", saveCharacterStart);
const saveCharacterBody = syncSource.slice(saveCharacterStart, listCharactersStart);
assert.match(saveCharacterBody, /const campaignId=String\(state\.campaignId\|\|""\)[\s\S]+await ensureConnected\(\);[\s\S]+sceneSessionIsActive\(sceneId,generation\)[\s\S]+campaign_id:campaignId/,
  "character persistence captures the owning campaign before reconnect and cannot drift to another active table");

browser.navigator.onLine = false;
nextRpcError = Object.assign(new Error("upstream unavailable"), { code: "PGRST000", status: 503 });
const transportFailure = await Sync.settleIntentBatch({
  commandIds: [], rejectedCommandIds: [], events: [{ id: "timeout-event", type: "round.end", actorId: null, payload: {} }],
  scene: { version: 2 }, expectedVersion: 1,
}).catch(error => error);
assert.equal(transportFailure.status, 503, "the sync layer preserves an HTTP status for transport classification");
assert.equal(transportFailure.retryable, true, "HTTP 5xx RPC failures retain the exact idempotent batch for retry");

console.log("Network session-switch QA passed: queued writes, character saves, and overlapping table selections stay session-bound");
