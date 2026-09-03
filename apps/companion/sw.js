const BUILD = "__BUILD_VERSION__";
const CACHE = `dawn-ru-companion-${BUILD}`;
const versioned = path => `${path}?v=${BUILD}`;
const SCRIPT_ASSETS = [
  "./localization.js", "./locale-ru.js", "./locale-en-builder.js", "./data.js", "./edition-lionwing.js", "./logic.js",
  "./scene-engine-core.js", "./scene-query.js", "./scene-movement.js", "./scene-foundations.js", "./scene-events.js", "./scene-triggers.js", "./scene-actions.js", "./scene-responses.js", "./scene-engine.js",
  "./technique-foundation-map.js", "./technique-engine.js", "./config.js", "./sync.js", "./network-v2.js",
  "./app-bootstrap.js", "./app-reference-data.js", "./app-core.js", "./hero-ui.js", "./scene-ui.js", "./scene-effects.js", "./scene-actions-ui.js", "./scene-sync-ui.js", "./play-ui.js",
  "./app-builder-events.js", "./app-sync-events.js", "./app-scene-events.js", "./app-play-events.js", "./app.js",
];
const ASSETS = ["./", "./index.html", versioned("./app.css"), versioned("./vtt-interface-classic.css"), versioned("./vtt-cockpit.css"), ...SCRIPT_ASSETS.map(versioned), "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put("./index.html", response.clone()));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request)));
});
