import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storage = new Map();
const sessionStorageMap = new Map();
class FakeBroadcastChannel {
  constructor(name) { this.name = name; this.onmessage = null; }
  postMessage() {}
  close() {}
}
const window = {
  DEUS_MORTUUS_CONFIG: {},
  crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
  localStorage: { getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key) },
  sessionStorage: { getItem: key => sessionStorageMap.get(key) || null, setItem: (key,value) => sessionStorageMap.set(key,value), removeItem: key => sessionStorageMap.delete(key) },
  BroadcastChannel: FakeBroadcastChannel,
  setTimeout,
  clearTimeout,
};
window.window = window;
const context = { window, localStorage: window.localStorage, sessionStorage: window.sessionStorage, BroadcastChannel: FakeBroadcastChannel, URL, console, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(root, "network.js"), "utf8"), context);
const Net = window.DM_NETWORK;
assert.ok(Net);
assert.equal(Net.hasCloudConfig(), false);
const initialState = { schema: 3, runtime: { paused: true } };
await Net.createRoom("Смотритель", initialState);
const status = Net.state();
assert.equal(status.role, "gm");
assert.equal(status.mode, "local");
assert.equal(status.code.length, 6);
assert.equal(status.userId, "11111111-1111-4111-8111-111111111111");
assert.equal(Net.hasSavedSession(), true);
await Net.sendState({ schema: 3, runtime: { paused: false } }, true);
await new Promise(resolve => setTimeout(resolve, 35));
assert.ok(Net.state().version >= 2, "local room snapshot must persist");
console.log("OK: local room creation, identity and persistence validated.");
