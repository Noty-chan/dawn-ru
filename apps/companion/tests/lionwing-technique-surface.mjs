import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { runtime, fixture, packet, clone } from "./helpers/scene-contract-harness.mjs";

const listeners = new Map(), preferences = new Map();
const context = { window: {
  document: { addEventListener: (type, handler) => listeners.set(type, handler) },
  localStorage: { getItem: key => preferences.get(key) ?? null, setItem: (key, value) => preferences.set(key, value) },
}, console };
vm.createContext(context);
for (const file of ["localization.js", "locale-ru.js", "locale-en-builder.js", "edition-lionwing.js", "edition-lionwing-ru.js"]) {
  vm.runInContext(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), context, { filename: file });
}
let adapterInstalled = true;
context.window.DAWN_LIONWING_ADAPTERS = {
  list: actor => adapterInstalled ? [{
    id: "ruiner.cryomancer.1",
    techniqueId: "ruiner.cryomancer",
    level: 1,
    label: "Frost Veiler I · reviewed adapter",
    coverage: "partial",
    sourceDigest: "canonical",
    enabled: actor?.lionwing?.automation?.["ruiner.cryomancer.1"] === true,
  }] : [],
};
context.window.DAWN_SCENE_ENGINE = {
  availableActions: () => [{ id: "action.cast", name: "Cast", available: false, reason: "Сейчас Ход другого участника", costModel: { amount: 1, resource: "ap" } }],
};
context.window.DAWN_LIONWING_ENGINE = {
  prepare(scene, request) {
    if (request.kind === "choice" && request.id === "offer-1") return { ok: true, events: [{ id: "choice-event", type: "lionwing.command", actorId: request.actorId, payload: { kind: "choice", id: request.id, choice: request.choice } }] };
    if (request.kind === "batch" && Array.isArray(request.operations)) {
      if (request.operations.some(operation => operation.targetId && !scene.actors.some(item => item.id === operation.targetId))) return { ok: false, errors: ["Неверная цель"] };
      return { ok: true, events: [{ id: "batch-event", type: "lionwing.command", actorId: request.actorId, payload: request }] };
    }
    return { ok: false, errors: ["Неверное действие"] };
  },
  previewEvents(scene, events, options = {}) {
    if (Number(options.expectedVersion) !== Number(scene.version)) return { ok: false, errors: ["Сцена изменилась"] };
    return { ok: true, scene, events, errors: [] };
  },
  dispatchMany(scene, events, options = {}) {
    if (Number(options.expectedVersion) !== Number(scene.version)) return { ok: false, errors: ["Сцена изменилась"] };
    return { ok: true, scene: { ...scene, version: scene.version + 1 }, events };
  },
};
vm.runInContext(fs.readFileSync(new URL("../lionwing-technique-surface.js", import.meta.url), "utf8"), context, { filename: "lionwing-technique-surface.js" });
const surface = context.window.DAWN_LIONWING_TECHNIQUE_SURFACE;

const actor = {
  id: "hero",
  name: "Герой",
  rulesEdition: "lionwing",
  knownTechniques: { "ruiner.cryomancer": 2 },
  techniques: { "ruiner.cryomancer": 2 },
  lionwing: { automation: { "ruiner.cryomancer.1": true } },
  knockedOut: false,
};
const baseScene = {
  rulesEdition: "lionwing",
  version: 7,
  activeActorId: "other",
  actors: [actor, { id: "other", name: "Другой", rulesEdition: "lionwing", knockedOut: false }],
  targetIds: [],
  log: [],
  lionwing: { choices: [] },
};

const entries = surface.entries(actor);
const frost = entries.find(entry => entry.id === "ruiner.cryomancer.1");
assert.ok(frost, "known LionWing level is visible");
assert.equal(frost.canonicalTechniqueName, "Frost Veiler", "new canonical name is used");
assert.equal(frost.previousName, "Cryomancer", "migration name remains a hint only");
assert.match(frost.canonicalText, /successful Casts Slow/i);
assert.equal(frost.canonicalSource.locale, "en");
assert.equal(frost.canonicalSource.pdfPage, 100);
assert.equal(frost.displayLevelName, "Охлаждение", "RU overlay is applied even outside the application bootstrap");
assert.equal(frost.displayText, "Ваши успешные Заклинания Замедляют цели.");

const model = surface.model(baseScene, actor, { viewer: { role: "player", actorId: "hero" } });
assert.equal(model.statuses[0].status.state, "assisted");
assert.equal(model.statuses[0].status.rows[0].coverage, "partial");
assert.equal(model.actionSummary.total, 1);
assert.equal(model.actionSummary.available, 0);
const html = surface.render(actor, { scene: baseScene, viewer: { role: "player", actorId: "hero" } });
assert.match(html, /Канон: LionWing EN · стр\. 100/);
assert.match(html, /Автоматика частично/);
assert.match(html, /Your successful Casts Slow/);
assert.doesNotMatch(html, /reviewed adapter/);
assert.match(html, /Сейчас Ход другого участника/);
assert.match(html, /<p class="lw-technique-description lw-technique-canonical">Ваши успешные Заклинания Замедляют цели\.<\/p>/);
assert.match(html, /<details class="lw-technique-original lw-technique-translation"><summary>Оригинал EN и источник<\/summary>[\s\S]*Your successful Casts Slow/);
assert.doesNotMatch(html, /data-lw-technique-group="ruiner\.cryomancer" open/, "the first technique is not expanded by default");
assert.doesNotMatch(html, /<strong>Криомант · Frost Veiler/, "the group heading has no duplicate EN name");
assert.doesNotMatch(html, /data-lw-automation=/, "players cannot toggle automation");
const narratorHtml = surface.render(actor, { scene: baseScene, viewer: { role: "narrator" } });
assert.match(narratorHtml, /data-lw-automation="ruiner\.cryomancer\.1" data-lw-actor="hero" data-lw-enabled="false"/);
assert.match(narratorHtml, /<details class="lw-technique-manual-panel"><summary>Записать результат вручную<\/summary>/);
assert.doesNotMatch(narratorHtml, /<details class="lw-technique-manual-panel" open/);
listeners.get("toggle")({ target: {
  matches: () => true,
  hasAttribute: name => name === "data-lw-technique-surface",
  dataset: { lwTechniqueSurface: "", lwTechniqueActor: "hero" },
  open: true,
} });
assert.equal(preferences.get("dawn-lionwing-techniques:surface:hero"), "1", "an empty HTML marker attribute still stores the outer menu preference");
assert.match(surface.render(actor, { scene: baseScene, viewer: { role: "player", actorId: "hero" } }), /data-lw-technique-actor="hero" open/);
preferences.clear();

context.window.DAWN_LIONWING_AUTOMATION_STATUS = {
  rows: [{ id: "ruiner.cryomancer.1", reason: { ru: "Причина RU <проверена>", en: "Reason EN <checked> & \"quoted\"" } }],
};
const localizedRu = surface.model(baseScene, actor, { locale: "ru", viewer: { role: "player", actorId: "hero" } });
assert.equal(localizedRu.locale, "ru");
assert.equal(localizedRu.statuses[0].status.reason, "Причина RU <проверена>");
assert.match(surface.render(actor, { scene: baseScene, locale: "ru", viewer: { role: "player", actorId: "hero" } }), /Причина RU &lt;проверена&gt;/);
const localizedEn = surface.model(baseScene, actor, { locale: "en", viewer: { role: "player", actorId: "hero" } });
assert.equal(localizedEn.locale, "en");
assert.equal(localizedEn.statuses[0].status.reason, "Reason EN <checked> & \"quoted\"");
const enHtml = surface.render(actor, { scene: baseScene, locale: "en", viewer: { role: "player", actorId: "hero" } });
assert.match(enHtml, /Partially automated/);
assert.match(enHtml, /Reason EN &lt;checked&gt; &amp; &quot;quoted&quot;/);
assert.match(enHtml, /Your successful Casts Slow/);
assert.match(enHtml, /Enabled techniques trigger through their corresponding actions and events/);
assert.doesNotMatch(enHtml, /Reason EN <checked>/);
assert.match(enHtml, /<p class="lw-technique-description lw-technique-canonical">Your successful Casts Slow/, "English preview uses the canonical description");

const disabledActor = structuredClone(actor);
disabledActor.lionwing.automation["ruiner.cryomancer.1"] = false;
const disabled = surface.model(baseScene, disabledActor, { viewer: { role: "narrator" } });
assert.equal(disabled.statuses[0].status.state, "off");
assert.match(disabled.statuses[0].status.detail, /выключена для этого персонажа/);
assert.doesNotMatch(disabled.statuses[0].status.detail, /Причина RU/, "readiness text cannot overwrite the actual disabled status");
assert.match(surface.render(disabledActor, { scene: baseScene, viewer: { role: "narrator" } }), /data-lw-automation="ruiner\.cryomancer\.1" data-lw-actor="hero" data-lw-enabled="true"/);
adapterInstalled = false;
const missing = surface.model(baseScene, actor, { viewer: { role: "narrator" } });
assert.equal(missing.statuses[0].status.state, "manual", "saved enabled flag does not invent a missing runtime adapter");
assert.match(missing.statuses[0].status.detail, /ещё не подключена/);
assert.doesNotMatch(missing.statuses[0].status.detail, /Причина RU/);
assert.doesNotMatch(surface.render(actor, { scene: baseScene, viewer: { role: "narrator" } }), /data-lw-automation=/);
adapterInstalled = true;

const offerScene = structuredClone(baseScene);
offerScene.activeActorId = "hero";
offerScene.lionwing.choices = [{
  id: "offer-1",
  actorId: "hero",
  kind: "technique-trigger",
  title: "Frost Veiler: choose",
  options: ["skip", "apply"],
  context: {
    ruleId: "ruiner.cryomancer.1",
    optionLabels: { skip: "Не использовать", apply: "Применить" },
    choices: { apply: [{ kind: "effect", targetId: "other", effect: "negative.замедлен" }] },
    sourceDigest: "adapter-digest-1",
  },
}];
const ownerModel = surface.model(offerScene, actor, { viewer: { role: "player", actorId: "hero" } });
assert.equal(ownerModel.offers.length, 1);
assert.equal(surface.model(structuredClone(offerScene), actor, { viewer: { role: "player", actorId: "hero" } }).offers.length, 1, "offer survives JSON reload");
const offerHtml = surface.pendingHtml(offerScene.lionwing.choices[0], { scene: offerScene, viewer: { role: "player", actorId: "hero" } });
assert.match(offerHtml, /data-lw-technique-choice="true"/);
assert.match(offerHtml, /Не использовать/);
assert.match(surface.pendingHtml({ ...offerScene.lionwing.choices[0], options: ["pass", "apply"], context: { ...offerScene.lionwing.choices[0].context, optionLabels: { pass: "Pass", apply: "Apply" } } }, { scene: offerScene, viewer: { role: "player", actorId: "hero" } }), /Pass · отмена/);
assert.match(offerHtml, /Срок: до ответа на это решение/);
assert.match(offerHtml, /Frost Veiler/);
assert.match(offerHtml, /Цели: Другой/);
assert.match(offerHtml, /<p class="lw-technique-description lw-technique-canonical">Ваши успешные Заклинания Замедляют цели/);
assert.match(offerHtml, /<details class="lw-technique-original lw-technique-translation"><summary>Оригинал EN и источник/);
assert.deepEqual(surface.visibleChoices(offerScene, { role: "player", actorId: "other" }), [], "another player cannot see private technique offer");
assert.equal(surface.visibleChoices(offerScene, { role: "player", actorId: "hero" }).length, 1);
assert.equal(surface.visibleChoices(offerScene, { role: "narrator" }).length, 1);
const actions = surface.adapterActions(offerScene, actor, { viewer: { role: "player", actorId: "hero" } });
assert.equal(actions.length, 2, "each adapter choice is exposed as one table action");
const applyAction = actions.find(item => item.option === "apply");
assert.equal(Array.from(applyAction.targetIds).join(","), "other");
assert.equal(applyAction.sourceDigest, "adapter-digest-1");
const preparedAction = surface.previewAction(offerScene, applyAction);
assert.equal(preparedAction.ok, true, "adapter action prepares and previews through the engine");
assert.equal(preparedAction.sceneVersion, offerScene.version);
let committedAction = 0;
const committed = surface.commitAction(offerScene, preparedAction, { commit: (_label, events) => { committedAction += events.length; return { ok: true }; } });
assert.equal(committed.ok, true, "previewed adapter action can be committed");
assert.equal(committedAction, 1);
const stale = surface.commitAction({ ...offerScene, version: offerScene.version + 1 }, preparedAction, { commit: () => ({ ok: true }) });
assert.equal(stale.stale, true, "stale adapter preview is rejected before commit");
assert.equal(surface.cancelAction("choice:offer-1:apply"), true, "adapter action can be cancelled");
assert.match(surface.pendingHtml(offerScene.lionwing.choices[0], { scene: offerScene, viewer: { role: "player", actorId: "hero" } }), /Источник адаптера: adapter-digest-1/);
const batchAction = surface.operationAction(offerScene, actor, {
  id: "batch:heal-and-focus",
  title: "Восстановить и получить Фокус",
  level: 2,
  sourceDigest: "batch-digest",
  operations: [
    { kind: "heal", targetId: "hero", amount: 1 },
    { kind: "resource", targetId: "hero", resource: "focus", operation: "gain", amount: 1 },
  ],
});
assert.equal(surface.previewAction(offerScene, batchAction).ok, true, "single UI bridge previews operation batches");
assert.match(surface.renderActionControl(batchAction), /batch-digest/);
const invalidTarget = surface.operationAction(offerScene, actor, { id: "bad-target", operations: [{ kind: "heal", targetId: "missing", amount: 1 }] });
assert.equal(surface.previewAction(offerScene, invalidTarget).ok, false, "engine rejects an invalid operation target");

let dispatches = 0;
assert.equal(surface.dispatchOnce("choice:offer-1:skip", () => { dispatches += 1; return true; }), true);
assert.equal(surface.dispatchOnce("choice:offer-1:skip", () => { dispatches += 1; return true; }), false, "repeated click is ignored until state changes");
assert.equal(dispatches, 1);
assert.equal(surface.dispatchOnce("failed", () => false), false);
assert.equal(surface.dispatchOnce("failed", () => { dispatches += 1; return true; }), true, "failed dispatch can be retried");

console.log("LionWing technique surface passed: canonical source, separate automation status, action availability, offer cancel/reload and visibility");

// Execute the same bulk configuration that the console submits to the real core.
const live = runtime();
for (const file of ["localization.js", "locale-ru.js", "edition-lionwing-ru.js", "lionwing-technique-surface.js"]) {
  vm.runInContext(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), live.context, { filename: file });
}
const actualSurface = live.context.window.DAWN_LIONWING_TECHNIQUE_SURFACE;
let table = fixture();
const hero = table.actors[0];
hero.knownTechniques = hero.techniques = { "vagabond.master-at-arms": 3, "ruiner.cryomancer": 2, "ruiner.bombardier": 2 };
hero.lionwing.automation = { "vagabond.master-at-arms.1": true };
const before = clone(table);
const operations = actualSurface.enableOperations(hero, table);
assert.ok(operations.length > 0);
assert.ok(operations.every(operation => !operation.ruleId.startsWith("vagabond.master-at-arms")), "a saved flag cannot invent executable LionWing coverage");
const prepared = live.core.prepare(table, { kind: "batch", actorId: hero.id, operations });
table = live.core.dispatchMany(table, packet(prepared, "console-enable")).scene;
assert.deepEqual(clone(table.actors[0].lionwing.automation), { ...before.actors[0].lionwing.automation, ...Object.fromEntries(operations.map(operation => [operation.ruleId, true])) });
for (const resource of ["ap", "focus", "hp", "influence"]) assert.equal(table.actors[0][resource], before.actors[0][resource], "enabling automation does not spend " + resource);
assert.equal(actualSurface.enableOperations(table.actors[0], table).length, 0, "repeated activation has no additional commands");
const invalidInput = clone(before);
const invalid = live.core.prepare(before, { kind: "batch", actorId: hero.id, operations: [...operations, { kind: "automation", ruleId: "unknown.technique.1", enabled: true }] });
assert.equal(invalid.ok, false, "unknown rules reject the entire configuration batch");
assert.deepEqual(clone(before), invalidInput, "prepare preserves the input snapshot");
const actualModel = actualSurface.model(table, table.actors[0], { viewer: { role: "narrator" } });
assert.equal(actualModel.entries.length, 7);
assert.ok(actualModel.statuses.filter(item => item.entry.techniqueId === "vagabond.master-at-arms").every(item => item.status.state === "automatic"));
const actualHtml = actualSurface.render(table.actors[0], { scene: table, viewer: { role: "narrator" } });
assert.match(actualHtml, /Пульт техник · 3/);
assert.match(actualHtml, /7 изученных уровней/);
assert.doesNotMatch(actualHtml, /Вручную: 3/);
assert.doesNotMatch(actualHtml, /data-lw-automation="vagabond\.master-at-arms/);
assert.doesNotMatch(actualHtml, /Автоматика включена: .*\/7/);
assert.match(actualHtml, /data-lw-action-guide="action\.атаки\.заклинание"/);
assert.equal((actualHtml.match(/data-lw-action-guide="action\.атаки\.заклинание"/g) || []).length, 1, "all studied levels share one navigation link to the canonical action");
assert.doesNotMatch(actualHtml, /data-lw-action=/, "rule descriptions do not duplicate executable basic actions");
assert.doesNotMatch(actualHtml, /preview|reviewed adapter/);
const blockedManual = actualSurface.model({ ...table, pendingPrompt: { kind: "enemy-decision" } }, table.actors[0], { viewer: { role: "narrator" } });
assert.equal(blockedManual.manual.available, false, "NPC decisions block manual recording too");
assert.equal(live.context.window.DAWN_LIONWING_ADAPTERS.coverage("vagabond.master-at-arms", 1), "full");
assert.equal(live.context.window.DAWN_LIONWING_ADAPTERS.coverage("ruiner.bombardier", 2), "partial");
console.log("Technique console: seven-level status, real atomic activation, resources, native Cast entry and pending NPC decision passed");

let studentTable = fixture();
studentTable.actors[0].knownTechniques = studentTable.actors[0].techniques = { "ruiner.student-of-stars": 2 };
const studentOps = actualSurface.enableOperations(studentTable.actors[0], studentTable);
assert.deepEqual(clone(studentOps.map(operation => operation.ruleId).sort()), ["ruiner.student-of-stars.1", "ruiner.student-of-stars.2-line", "ruiner.student-of-stars.2-zone"], "all native Student commands are configurable without editing stored flags");
studentTable = live.core.dispatchMany(studentTable, packet(live.core.prepare(studentTable, { actorId: "hero", kind: "batch", operations: studentOps }), "student-connect")).scene;
studentTable = live.core.dispatchMany(studentTable, packet(live.core.prepare(studentTable, { actorId: "hero", kind: "action", actionId: live.engine.ACTION_IDS.charge }, { random: () => 0.6 }), "student-charge")).scene;
const charged = clone(studentTable);
const area = live.core.prepare(studentTable, { actorId: "hero", kind: "action", actionId: live.engine.ACTION_IDS.finish, techniqueRuleId: "ruiner.student-of-stars.2-line", areaCenter: { space: "main", x: 2, y: 1 }, studentArea: { shape: "line", orientation: "horizontal" }, attribute: "spirit", focusSpent: 2 }, { random: () => 0.6 });
assert.equal(area.ok, true, area.errors?.join(" "));
assert.deepEqual(clone(studentTable), charged, "preparing an area is free and leaves the input untouched");
studentTable = live.core.dispatchMany(studentTable, packet(area, "student-finish")).scene;
assert.equal(studentTable.actors[0].ap, charged.actors[0].ap - 1, "connected Student I applies the authoritative reduced Finisher cost");
assert.equal(studentTable.actors[0].focus, charged.actors[0].focus - 2);
console.log("Student console: connect -> Charge -> line Finisher, no direct flag injection, atomic AP/Focus and free prepare passed");

let frostTable = fixture();
frostTable.actors[0].knownTechniques = frostTable.actors[0].techniques = { "ruiner.cryomancer": 2 };
const frostEnable = live.core.prepare(frostTable, { actorId: "hero", kind: "automation", ruleId: "ruiner.cryomancer.2", enabled: true });
frostTable = live.core.dispatchMany(frostTable, packet(frostEnable, "frost-enable")).scene;
assert.equal(frostTable.actors[0].ruleClocks["ruiner.cryomancer.icicle"].current, 0, "mid-scene activation creates the missing Icicle clock");
let frostChargeEvents = packet(live.core.prepare(frostTable, { actorId: "hero", kind: "action", actionId: live.engine.ACTION_IDS.charge }, { random: () => 0.6 }), "frost-charge");
frostTable = live.core.dispatchMany(frostTable, frostChargeEvents).scene;
assert.equal(frostTable.actors[0].ruleClocks["ruiner.cryomancer.icicle"].current, 1, "Charge succeeds and fills one segment");
assert.equal(live.core.dispatchMany(frostTable, frostChargeEvents).scene.actors[0].ruleClocks["ruiner.cryomancer.icicle"].current, 1, "an exact retry cannot fill another segment");
frostTable = live.core.dispatchMany(frostTable, packet(live.core.prepare(frostTable, { actorId: "hero", kind: "batch", operations: [{ kind: "automation", ruleId: "ruiner.cryomancer.2", enabled: false }, { kind: "automation", ruleId: "ruiner.cryomancer.2", enabled: true }] }), "frost-reconnect")).scene;
assert.equal(frostTable.actors[0].ruleClocks["ruiner.cryomancer.icicle"].current, 1, "re-enabling never erases earned segments");
const restoredFlags = fixture();
restoredFlags.actors[0].knownTechniques = restoredFlags.actors[0].techniques = { "ruiner.cryomancer": 2 };
restoredFlags.actors[0].lionwing.automation = { "ruiner.cryomancer.2": true };
const restoredCharge = live.core.prepare(restoredFlags, { actorId: "hero", kind: "action", actionId: live.engine.ACTION_IDS.charge }, { random: () => 0.6 });
const restoredResult = live.core.dispatchMany(restoredFlags, packet(restoredCharge, "frost-old-flags")).scene;
assert.equal(restoredResult.actors[0].ruleClocks["ruiner.cryomancer.icicle"].current, 1, "restored enabled flags without clock state are repaired by the action transaction");
assert.equal(restoredFlags.actors[0].ruleClocks, undefined, "prepare and dispatch leave the restored input untouched");
console.log("Icicle activation: mid-scene create, Charge, exact retry, re-enable preservation and restored-flag recovery passed");

// Keep historical declarations visible as explicit migration debt. A new lost
// route (or a disconnected working adapter) must fail CI instead of silently
// making an advertised automation manual in the player's console.
const automationRegistry = JSON.parse(fs.readFileSync(new URL("../LIONWING-AUTOMATION-REGISTRY.json", import.meta.url), "utf8"));
const expectedUnrouted = [];
const actualUnrouted = automationRegistry.rows.filter(row => row.implementation.automation === "full"
  && live.context.window.DAWN_LIONWING_ADAPTERS.coverage(row.id.replace(/\.\d+$/, ""), Number(row.id.match(/\.(\d+)$/)[1])) === "manual").map(row => row.id).sort();
assert.deepEqual(actualUnrouted, expectedUnrouted, "full declarations must have executable LionWing routes with no routing audit exceptions");
console.log("Technique routing contract: all previously disconnected full declarations are routed; any new gap fails QA");
