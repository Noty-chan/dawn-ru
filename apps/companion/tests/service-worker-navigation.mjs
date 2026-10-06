import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

// Execute the real service worker with browser-like cache keys. This checks
// observable navigation behavior, not implementation text or helper copies.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const workerUrl = "https://demo.test/dawn/apps/companion/sw.js";
const shellUrl = new URL("./index.html", workerUrl).href;
const entries = new Map([[shellUrl, new Response("ORIGINAL SHELL")]]);
const writes = [], listeners = {};
let offline = false, fetchCalls = 0;
const key = request => new URL(typeof request === "string" ? request : request.url, workerUrl).href;
const cache = {
  async put(request, response) { const url = key(request); writes.push(url); entries.set(url, response); },
  async match(request) { return entries.get(key(request))?.clone(); },
  async addAll() {}
};
const caches = { async open() { return cache; }, async match(request) { return cache.match(request); }, async keys() { return []; }, async delete() { return true; } };
const self = { location: new URL(workerUrl), registration: { scope: new URL("./", workerUrl).href }, addEventListener(type, listener) { listeners[type] = listener; }, async skipWaiting() {}, clients: { async claim() {} } };
vm.runInNewContext(source, {
  self, caches, URL, Response, Request,
  fetch: async request => { fetchCalls++; if (offline) throw new Error("offline"); return new Response(`PAGE:${key(request)}`); }
}, { filename: "sw.js" });

async function request(url, { method = "GET", mode = "navigate" } = {}) {
  let responsePromise, intercepted = false;
  const deferred = [];
  listeners.fetch({ request: { url: new URL(url, workerUrl).href, method, mode }, respondWith(value) { intercepted = true; responsePromise = Promise.resolve(value); }, waitUntil(value) { deferred.push(value); } });
  const response = intercepted ? await responsePromise : undefined;
  await Promise.all(deferred);
  // Existing SW caching may deliberately run in a separate microtask chain.
  await Promise.resolve(); await Promise.resolve();
  return { intercepted, response };
}
async function text(response) { return response ? response.text() : undefined; }

const ownRoutes = [
  "./testing.html",
  "./prototypes/tools-designs-20261006/index.html?variant=1",
  "./prototypes/tools-designs-20261006/index.html?variant=2",
  "./prototypes/tools-designs-20261006/index.html?variant=3",
  "./prototypes/ux-audit-20261006/cockpit/index.html",
  "./prototypes/ux-audit-20261006/tools-flow/index.html",
  "./prototypes/ux-audit-20261006/workspace/index.html"
];
for (const route of ownRoutes) {
  const ownUrl = new URL(route, workerUrl).href;
  const result = await request(route);
  assert.equal(await text(result.response), `PAGE:${ownUrl}`);
  assert.equal(await text(entries.get(shellUrl).clone()), "ORIGINAL SHELL", `Navigation to ${route} must not overwrite the offline companion shell`);
  assert(entries.has(ownUrl), `The navigation is cached under its own URL: ${route}`);
}
assert(!writes.includes(shellUrl), "Testing and iframe navigation never write index.html");

for (const route of ["./?mode=play", "./index.html?mode=build"]) {
  const before = writes.length;
  const ownUrl = new URL(route, workerUrl).href;
  await request(route);
  assert.deepEqual(writes.slice(before), [shellUrl], "Both shell aliases cache to canonical index.html");
  assert.equal(await text(entries.get(shellUrl).clone()), `PAGE:${ownUrl}`);
}

offline = true;
for (const route of ownRoutes) {
  const result = await request(route);
  assert.equal(await text(result.response), `PAGE:${new URL(route, workerUrl).href}`, "Each offline demo receives its own cached document/variant");
}
const offlineShell = await request("./?mode=rules");
assert.equal(await text(offlineShell.response), `PAGE:${new URL("./index.html?mode=build", workerUrl).href}`, "Offline shell alias uses canonical shell cache");
const missing = await request("./prototypes/not-cached/index.html");
assert(!missing.response || missing.response.type === "error" || missing.response.status >= 400, "Uncached route must fail instead of serving the companion shell");
const callsBefore = fetchCalls;
assert.equal((await request("./testing.html", { method: "POST" })).intercepted, false);
assert.equal((await request("https://external.test/testing.html")).intercepted, false);
assert.equal(fetchCalls, callsBefore, "Non-GET/external requests are untouched");
console.log("PASS: real SW shell aliases, isolated testing/iframe navigation cache, own offline variants, uncached failure, non-GET/external bypass.");
