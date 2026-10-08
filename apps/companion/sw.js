const RAW_BUILD = "__BUILD_VERSION__";
const BUILD = RAW_BUILD.startsWith("__") ? "dev-20261007-manual-table" : RAW_BUILD;
const CACHE = `dawn-ru-companion-${BUILD}`;
const versioned = path => `${path}?v=${BUILD}`;
const SCRIPT_ASSETS = [
  "./localization.js", "./locale-ru.js", "./locale-en-builder.js", "./data.js", "./edition-lionwing.js", "./edition-lionwing-ru.js", "./lionwing-display-mapping.js", "./lionwing-table-data.js", "./logic.js", "./hero-gadgets.js",
  "./scene-engine-core.js", "./scene-query.js", "./scene-movement.js", "./scene-foundations.js", "./scene-events.js", "./scene-triggers.js", "./scene-actions.js", "./scene-responses.js", "./scene-engine.js",
  "./lionwing-execution.js", "./lionwing-dice.js", "./lionwing-geometry.js", "./lionwing-geometry-runtime.js", "./lionwing-aura-transitions.js", "./lionwing-action-plan.js", "./lionwing-entities.js", "./lionwing-destroy-plan.js", "./lionwing-information-query.js", "./lionwing-inventory.js", "./lionwing-derived-actions.js", "./lionwing-restored-techniques.js", "./lionwing-adapters.js", "./lionwing-combat-meter.js", "./lionwing-engine.js", "./scene-table-policy.js", "./lionwing-ui.js", "./technique-foundation-map.js", "./technique-engine.js", "./lionwing-technique-surface.js", "./lionwing-automation-status.js", "./config.js", "./sync.js", "./network-v2.js",
  "./app-bootstrap.js", "./app-reference-data.js", "./app-core.js", "./hero-ui.js", "./scene-ui.js", "./scene-effects.js", "./scene-actions-ui.js", "./scene-sync-ui.js", "./app-workspace.js", "./app-navigation.js", "./mobile-header.js", "./tools-workspace.js", "./play-ui.js",
  "./app-builder-events.js", "./app-sync-events.js", "./app-scene-events.js", "./app-play-events.js", "./ui-icons.js", "./scene-workspace-next.js", "./scene-board-tools.js", "./scene-presentation-model.js", "./scene-presentations.js", "./scene-token-hud.js", "./scene-manual-workspace.js", "./scene-manual-reader-data.js", "./scene-manual-integration.js", "./app.js",
];
const ASSETS = ["./", "./index.html", versioned("./app.css"), versioned("./hero-gadgets.css"), versioned("./mobile-header.css"), versioned("./scene-board-tools.css"), versioned("./tools-workspace.css"), versioned("./scene-workspace-next.css"), versioned("./scene-manual-workspace.css"), versioned("./vtt-interface-classic.css"), versioned("./vtt-cockpit.css"), ...SCRIPT_ASSETS.map(versioned), "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    const scope = new URL("./", self.location.href);
    const shell = url.pathname === scope.pathname || url.pathname === new URL("index.html", scope).pathname;
    const cacheKey = shell ? "./index.html" : event.request;
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(cacheKey, response.clone()));
      return response;
    }).catch(() => caches.match(cacheKey)));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request)));
});
