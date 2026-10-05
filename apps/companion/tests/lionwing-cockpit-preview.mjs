import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { runtime, fixture, actor, clone } from "./helpers/scene-contract-harness.mjs";

const read = name => fs.readFileSync(new URL("../" + name, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const { context, engine, core } = runtime();
const handlers = [], commits = [], notices = [];
let narrator = true;
const root = { dataset: { lwActor: "hero" }, querySelectorAll: () => [] };
Object.assign(context, {
  structuredClone, Scene: fixture(), SceneEngine: engine,
  document: { addEventListener(type, handler) { if (type === "click") handlers.push(handler); }, querySelector: () => null, querySelectorAll: () => [] },
  esc: value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  lwOwns: id => narrator || id === "hero", lwCanNarrate: () => narrator, lwActive: () => true,
  lwGeometrySceneIdentity: () => "cockpit-preview-scene", renderScene: () => {}, toast: value => notices.push(value),
  lwRules: () => context.window.DAWN_LIONWING_DATA.coreRules,
  currentHeroActor: () => context.Scene.actors.find(row => row.id === "hero"), lwActor: () => context.Scene.actors[0],
  activeDirectorTab: "turn", lwDraftEnabled: false, lwDraftBatch: null,
  commitSceneEvents(label, events) {
    commits.push({ label, events: clone(events) });
    context.Scene = core.dispatchMany(context.Scene, events, { expectedVersion: context.Scene.version }).scene;
    return true;
  },
});
context.window.document = context.document;
for (const file of ["localization.js", "locale-ru.js", "edition-lionwing-ru.js", "lionwing-technique-surface.js"]) vm.runInContext(read(file), context, { filename: file });
const source = read("lionwing-ui.js");
vm.runInContext(`const LionwingEngine=window.DAWN_LIONWING_ENGINE;let lwDestination=null,lwGeometryPreview=null,lwTechniqueDraft=null;\n${source.slice(source.indexOf("const lwTechniqueText"), source.indexOf("const lwRules ="))}`, context);
vm.runInContext(source.slice(source.indexOf("function lwSubmit("), source.indexOf("function lwDiceHtml")), context);
const captureStart = source.indexOf('document.addEventListener("click", event => {\n  if (!lwActive()) return;');
vm.runInContext(source.slice(captureStart, source.indexOf("\n},true);", captureStart) + "\n},true);".length), context);
const surface = context.window.DAWN_LIONWING_TECHNIQUE_SURFACE;
const value = script => vm.runInContext(script, context);
const click = (dataset, names) => {
  const attributes = new Set(names);
  const button = { dataset, hasAttribute: name => attributes.has(name) };
  button.closest = selector => selector === "[data-lw-root]" ? root : selector.split(",").some(part => attributes.has(part.trim().slice(1, -1))) ? button : null;
  let stopped = false;
  const event = { target: button, preventDefault() {}, stopImmediatePropagation() { stopped = true; } };
  for (const handler of handlers) { handler(event); if (stopped) break; }
};
const action = id => click({ lwAction: id, lwActor: "hero" }, ["data-lw-action"]);
const target = id => click({ lwActionTarget: id, lwActor: "hero" }, ["data-lw-action-target"]);
const confirm = () => click({ lwActor: "hero" }, ["data-lw-technique-confirm"]);
const cancel = () => click({ lwActor: "hero" }, ["data-lw-shape-cancel"]);
const html = () => value('lwTechniqueDraftHtml(Scene.actors.find(row=>row.id==="hero"))');

// Availability is probed against the whole core contract, including actual
// modified range and target kind. Merely opening the picker is read-only.
context.Scene.actors.push(actor("far", "enemy", 7, 5), actor("ally", "hero", 2, 1));
const before = clone(context.Scene);
const targets = surface.actionTargets(context.Scene, "hero", { actionId: engine.ACTION_IDS.study });
assert.equal(targets.find(row => row.id === "enemy").available, true);
assert.equal(targets.find(row => row.id === "far").available, false);
assert.match(targets.find(row => row.id === "far").reason, /дальности/);
assert.equal(targets.find(row => row.id === "ally").available, false);
assert.match(targets.find(row => row.id === "ally").reason, /NPC/);
assert.deepEqual(clone(context.Scene), before);

action(engine.ACTION_IDS.spell);
assert.equal(commits.length, 0, "ordinary attack opens the same unpaid preview as a Technique");
assert.match(html(), /Неверное число целей/);
assert.match(html(), /data-lw-technique-confirm disabled/);
assert.match(html(), /data-lw-action-target="enemy"/);
assert.match(html(), /Почему другие цели недоступны/);
assert.match(html(), /1 ОД · итог после выбора/, "an incomplete target selection cannot advertise the whole price as free");
target("enemy");
assert.match(html(), /Стоимость: 1 ОД/);
assert.doesNotMatch(html(), /Сцена изменилась/, "ordinary target selection updates the quote without an external-change warning");
assert.match(html(), /Выбранные цели: enemy/);
assert.match(html(), /data-lw-technique-confirm >/);
assert.equal(context.Scene.actors[0].ap, 3);
cancel();
assert.equal(value("lwTechniqueDraft"), null);
assert.equal(commits.length, 0, "cancellation sends no event");
assert.deepEqual(clone(context.Scene), { ...before, tool: "target", targetIds: ["enemy"] });

// Price reads gross cost events, not a balance delta which can conceal a spend
// followed by a gain of the same resource in this action.
const spendAndGain = surface.operationAction(context.Scene, context.Scene.actors[0], {
  operations: [{ kind: "resource", resource: "focus", operation: "spend", amount: 2 }, { kind: "resource", resource: "focus", operation: "gain", amount: 2 }],
});
const pricePreview = surface.previewAction(context.Scene, spendAndGain);
assert.equal(pricePreview.ok, true, pricePreview.errors?.join(" "));
const price = surface.previewCosts(context.Scene, pricePreview, "hero");
assert.equal(price.complete, true);
assert.equal(price.costs.find(row => row.resource === "focus").amount, 2);
assert.equal(pricePreview.preview.scene.actors[0].focus, context.Scene.actors[0].focus, "test includes an actual net-zero resource balance");
assert.match(price.label, /2 Фокус/);
assert.deepEqual(clone(context.Scene), { ...before, tool: "target", targetIds: ["enemy"] });

// The confirmation commits the exact roll already prepared for the visible
// quote. Rendering again neither rolls again nor pays again.
action(engine.ACTION_IDS.spell);
html();
const events = clone(value("lwTechniqueDraft.preview.events"));
html();
assert.deepEqual(clone(value("lwTechniqueDraft.preview.events")), events);
confirm();
assert.equal(commits.length, 1);
assert.deepEqual(commits[0].events, events);
assert.equal(context.Scene.actors[0].ap, 2);
assert.equal(context.Scene.pendingAction.actorId, "hero");
assert.equal(value("lwTechniqueDraft"), null);
const applied = clone(context.Scene);
const replay = core.dispatchMany(context.Scene, clone(events));
assert.deepEqual(clone(replay.scene), applied);
assert.equal(replay.events.length, 0);

// A version change between viewing and confirming must require a new review.
context.Scene = fixture(); context.Scene.actors[1].x = 2; context.Scene.targetIds = ["enemy"];
action(engine.ACTION_IDS.finish); html();
const firstVersion = context.Scene.version, firstPacket = clone(value("lwTechniqueDraft.preview.events"));
const changed = core.prepare(context.Scene, { actorId: "hero", kind: "resource", resource: "focus", operation: "spend", amount: 1 });
assert.equal(changed.ok, true, changed.errors?.join(" "));
context.Scene = core.dispatchMany(context.Scene, changed.events).scene;
assert.ok(context.Scene.version > firstVersion);
const beforeStale = commits.length;
confirm();
assert.equal(commits.length, beforeStale);
assert.match(notices.at(-1), /Сцена изменилась/);
assert.match(html(), /Сцена изменилась/);
assert.notDeepEqual(clone(value("lwTechniqueDraft.preview.events")), firstPacket);
confirm();
assert.equal(commits.length, beforeStale + 1);
assert.equal(context.Scene.actors[0].ap, 1);

// Replacement and inverted resources must display their actual names and
// direction, while the input scene remains byte-for-byte unchanged.
context.Scene = fixture();context.Scene.actors[1].x = 2;context.Scene.targetIds = ["enemy"];
context.Scene.actors[0].ruleResources = { resolve: { id: "resolve", label: "Решимость", value: 3, current: 3, replacesAp: true }, heat: { id: "heat", label: "Жар", value: 1, current: 1, maximum: 9, replaces: "focus", inverted: true } };
const replacementBefore = clone(context.Scene);
const quote = surface.actionPresentation(context.Scene, "hero", { actionId: engine.ACTION_IDS.finish, targetIds: ["enemy"], focusSpent: 2 });
assert.equal(quote.costComplete, true);
assert.match(quote.costLabel, /2 Решимость/);
assert.match(quote.costLabel, /2 Жар \(увеличение ресурса\)/);
assert.doesNotMatch(quote.costLabel, /2 ОД|2 Фокус/);
assert.deepEqual(clone(context.Scene), replacementBefore);
const breathe = surface.actionPresentation(context.Scene, "hero", { actionId: engine.ACTION_IDS.breathe });
assert.match(breathe.costLabel, /1 Решимость/);
assert.doesNotMatch(breathe.costLabel, /Жар/, "reducing an inverted resource when gaining Focus is a benefit, not an extra price");

context.Scene = fixture();
const inventory = core.prepare(context.Scene, { actorId: "hero", kind: "inventory", operation: "configure", id: "ammo", inventoryKind: "charges", label: "Боеприпасы", current: 3, initial: 0, maximum: 6, ruleId: "test.cockpit-ammo", sourceDigest: "a".repeat(64), visibility: "owner" });
assert.equal(inventory.ok, true, inventory.errors?.join(" "));
context.Scene = core.dispatchMany(context.Scene, inventory.events).scene;
const itemAction = surface.operationAction(context.Scene, context.Scene.actors[0], { operations: [{ kind: "inventory", operation: "spend", id: "ammo", amount: 2 }] });
const itemPreview = surface.previewAction(context.Scene, itemAction);
assert.equal(itemPreview.ok, true, itemPreview.errors?.join(" "));
assert.match(surface.previewCosts(context.Scene, itemPreview, "hero").label, /2 Боеприпасы/, "typed inventory price uses the actual spend event and display label");

const exclusive = { context: { choices: { first: [{ kind: "resource", operation: "spend", resource: "focus", amount: 1 }], second: [{ kind: "resource", operation: "spend", resource: "focus", amount: 3 }] } } };
assert.equal(surface.operationCosts(exclusive).length, 0, "mutually exclusive offers have no aggregate price");
assert.equal(surface.operationCosts(exclusive, "second")[0].amount, 3);

// Actual special rule costs also remain visible when the AP part is free.
context.Scene = fixture();context.Scene.actors[0].knownTechniques = { "vagabond.cunning-fighter": 1 };
let enabled = core.prepare(context.Scene, { actorId: "hero", kind: "automation", ruleId: "vagabond.cunning-fighter.1", enabled: true });
context.Scene = core.dispatchMany(context.Scene, enabled.events).scene;
context.Scene.actors[0].ruleClocks["vagabond.cunning-fighter.plan"].current = 1;
context.Scene.actors[0].ruleClocks["vagabond.cunning-fighter.plan"].value = 1;
const cunningBefore = clone(context.Scene);
const cunning = surface.actionPresentation(context.Scene, "hero", { actionId: engine.ACTION_IDS.step, useCunningPlan: true });
assert.equal(cunning.available, true);
assert.match(cunning.costLabel, /0 ОД/);
assert.match(cunning.costLabel, /1 Хитрый план/);
assert.deepEqual(clone(context.Scene), cunningBefore);

// Navigation never dispatches an action, and ownership is checked again even
// when a removed or disabled control is activated programmatically.
context.Scene = fixture();context.Scene.targetIds = ["enemy"];
const navState = clone(context.Scene), navCommits = commits.length;
click({ lwActor: "hero", lwActionGuide: engine.ACTION_IDS.spell }, ["data-lw-action-guide"]);
assert.deepEqual(clone(context.Scene), navState);
assert.equal(commits.length, navCommits);
const foldedActions={open:false,parentElement:{closest:()=>null}},savedQueryAll=context.document.querySelectorAll;
let focusedAction=false;
context.document.querySelectorAll=()=>[{dataset:{lwActor:"hero",lwAction:engine.ACTION_IDS.study},hasAttribute:()=>false,parentElement:{closest:()=>foldedActions},scrollIntoView:()=>assert.equal(foldedActions.open,true,"navigation unfolds the destination before scrolling"),focus:()=>{focusedAction=true;}}];
assert.equal(context.lwOpenCockpitAction("hero",engine.ACTION_IDS.study),true);
assert.equal(foldedActions.open,true);
assert.equal(focusedAction,true);
assert.deepEqual(clone(context.Scene),navState,"opening an action in a folded group remains navigation");
assert.equal(commits.length,navCommits);
context.document.querySelectorAll=savedQueryAll;
narrator = false;
click({ lwActor: "enemy", lwAction: engine.ACTION_IDS.spell }, ["data-lw-action"]);
assert.equal(commits.length, navCommits);
assert.match(notices.at(-1), /другой игрок/);
narrator = true;
action(engine.ACTION_IDS.spell); html();
context.Scene.actors[1].knockedOut = true;context.Scene.version++;
assert.match(html(), /data-lw-technique-confirm disabled/);
confirm();
assert.equal(commits.length, navCommits, "a newly invalid target cannot be committed");
cancel();

// Exercise the real board and turn-strip handlers after the capture controller:
// picking a target must retain the original source, including when inspection
// follows the target in the turn strip. A player uses their own target tool.
const fieldHandlers = new Map();
let directorActorId = "hero";
Object.assign(context, {
  performance: { now: () => 1000 }, sceneSuppressBoardClickUntil: 0,
  activeSceneView: () => narrator ? "gm" : "player", playerSceneTool: "select",
  sceneDirectorActor: () => context.Scene.actors.find(row => row.id === directorActorId),
  activeModifierActionId: null, activeModifierPickerId: null,
  pendingZealotPlan: null, pendingEnemyStepActorId: null, pendingEnemyRule: null,
  pendingTechniqueRule: null, pendingCoreReaction: null, pendingCoreAction: null,
  canControlScenePrompt: () => false, persist: () => {}, setScenePanel: () => {}, focusSceneActorOnBoard: () => {},
  $: id => ({ addEventListener(type, handler) { if (type === "click") fieldHandlers.set(id, handler); } }),
});
const sceneUi = read("scene-ui.js"), sceneEvents = read("app-scene-events.js");
vm.runInContext(sceneUi.match(/function activeSceneTool\(\)\{[^\n]+\}/)[0], context, { filename: "scene-ui.js" });
const boardStart = sceneEvents.indexOf('$("scene-board").addEventListener("click",event=>{');
vm.runInContext(sceneEvents.slice(boardStart, sceneEvents.indexOf('$("scene-board").addEventListener("dragstart"', boardStart)), context, { filename: "app-scene-events.js" });
vm.runInContext(sceneEvents.split("\n").find(line => line.startsWith('$("scene-turn-strip").addEventListener("click"')), context, { filename: "app-scene-events.js" });
const fieldClick = (actorId, strip = false) => {
  const selected = context.Scene.actors.find(row => row.id === actorId);
  const cell = { dataset: { sceneCell: `${selected.x},${selected.y}` } };
  const token = { dataset: { sceneActor: actorId, sceneTurnActor: actorId } };
  token.closest = selector => selector === "[data-scene-cell]" && !strip ? cell :
    selector === (strip ? "[data-scene-turn-actor]" : "[data-scene-actor]") ? token : null;
  let stopped = false;
  const event = { target: token, preventDefault() {}, stopImmediatePropagation() { stopped = true; } };
  for (const handler of handlers) { handler(event); if (stopped) break; }
  assert.equal(stopped, false, "an ordinary target click reaches the existing field handler");
  fieldHandlers.get(strip ? "scene-turn-strip" : "scene-board")(event);
};
const boardCell = (key, title, classes = []) => {
  const values = new Set(classes);
  return { dataset: { sceneCell: key }, title, querySelectorAll: () => [], classList: {
    contains: name => values.has(name), add: name => values.add(name),
    toggle(name, enabled) { enabled ? values.add(name) : values.delete(name); },
  } };
};
for (const role of ["gm", "player"]) {
  narrator = role === "gm";context.Scene = fixture();context.Scene.tool = "place";context.playerSceneTool = "select";
  const fieldBefore = clone(context.Scene), fieldCommits = commits.length;
  action(engine.ACTION_IDS.spell);
  assert.equal(value("activeSceneTool()"), "target", `${role}: opening a targeted preview enables actual field targeting`);
  if (!narrator) assert.equal(context.Scene.tool, "place", "player targeting does not replace the GM tool");
  const cells = [boardCell("1,1", "Исходное описание", ["movement-valid", "preview"]), boardCell("4,1", "Враг на клетке")];
  context.previewBoard = { querySelectorAll: () => cells };
  value('lwApplyDestinationHighlights(previewBoard,{id:"main"})');
  assert.equal(cells[0].title, "Исходное описание");
  assert.equal(cells[0].classList.contains("movement-valid"), true);
  assert.equal(cells[0].classList.contains("preview"), true);
  assert.equal(cells[1].title, "Враг на клетке", "an ordinary preview must not use the nails/idol cell rejection");
  assert.equal(cells[1].classList.contains("preview"), false);
  fieldClick("enemy");
  assert.deepEqual(clone(context.Scene.targetIds), ["enemy"]);
  assert.equal(context.Scene.selectedActor, "hero");
  assert.equal(context.Scene.activeActorId, "hero");
  assert.equal(commits.length, fieldCommits);
  assert.deepEqual(clone(context.Scene.actors), fieldBefore.actors, "selecting on the board spends no resources");
  assert.match(html(), /Выбранные цели: enemy/);
  assert.match(html(), /data-lw-technique-confirm >/);
  assert.doesNotMatch(html(), /Сцена изменилась/);
  fieldClick("enemy", true); // remove, then reselect through the real turn strip
  assert.equal(context.Scene.selectedActor, "enemy");
  assert.match(html(), /Неверное число целей/);
  assert.doesNotMatch(html(), /Сцена изменилась/, "turn-strip target toggles are local choices rather than scene mutations");
  assert.equal(value("lwTechniqueDraft.actorId"), "hero", "inspecting the target does not switch the action source");
  fieldClick("enemy", true);
  assert.match(html(), /data-lw-technique-confirm >/);
  assert.doesNotMatch(html(), /Сцена изменилась/);
  const shownPacket = clone(value("lwTechniqueDraft.preview.events"));
  confirm();
  assert.equal(commits.length, fieldCommits + 1);
  assert.deepEqual(commits.at(-1).events, shownPacket);
  assert.equal(context.Scene.pendingAction.actorId, "hero");
  assert.deepEqual(clone(context.Scene.pendingAction.targetIds), ["enemy"]);
  assert.equal(context.Scene.actors[0].ap, 2);
}

// Only the shape pickers replace cell eligibility; a confirmed point preview
// adds its own marker while preserving existing board titles and movement.
narrator = true;context.Scene = fixture();context.Scene.tool = "measure";
action(engine.ACTION_IDS.breathe);
assert.equal(context.Scene.tool, "measure", "a utility action does not start target picking");
cancel();
const pointCells = [boardCell("2,1", "Клетка прыжка", ["movement-valid"]), boardCell("3,1", "Иная клетка")];
context.previewBoard = { querySelectorAll: () => pointCells };
value('lwTechniqueDraft={actorId:"hero",mode:"point",payload:{},cells:[{space:"main",x:2,y:1}],...lwTechniqueDraftContext("hero",null)};lwApplyDestinationHighlights(previewBoard,{id:"main"})');
assert.equal(pointCells[0].classList.contains("preview"), true);
assert.equal(pointCells[0].classList.contains("movement-valid"), true);
assert.equal(pointCells[0].title, "Клетка прыжка");
assert.equal(pointCells[1].classList.contains("preview"), false);
assert.equal(pointCells[1].title, "Иная клетка");
cancel();
action(engine.ACTION_IDS.spell);directorActorId = "enemy";
assert.equal(html(), "", "an explicit GM source switch cancels the old actor's draft");
assert.equal(value("lwTechniqueDraft"), null);

// The Player's canonical cockpit is the actual Hero sheet. Install its real
// renderer and the common Scene render cycle; a direct draft helper alone
// cannot detect a sheet which was never repainted after a board selection.
const dom = new Map();
const noop = () => {};
const makeElement = id => ({ id, dataset: {}, value: id === "scene-area-type" ? "terrain" : "", innerHTML: "", hidden: false,
  classList: { toggle: noop, add: noop, remove: noop }, querySelector: () => null, querySelectorAll: () => [],
  setAttribute: noop, getAttribute: () => null, addEventListener: noop,
});
const element = id => { if (!dom.has(id)) dom.set(id, makeElement(id)); return dom.get(id); };
const kit = element("play-kit"), controls = [], detailNodes = [];
let kitMarkup = "";
const sheetOwner = { dataset: { sceneSheetActor: "hero" } };
const actionRoot = { dataset: { lwActor: "hero" }, className: "lw-actions", closest: () => null,
  querySelectorAll(selector) { return controls.filter(input => input.closest("[data-lw-root]") === actionRoot && input.attributes.some(attr => selector.includes(`[${attr.name}]`))); },
};
const attributes = markup => [...markup.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(match => ({ name: match[1], value: match[2] || "" }));
Object.defineProperty(kit, "innerHTML", { get: () => kitMarkup, set(markup) {
  kitMarkup = markup;controls.length = 0;detailNodes.length = 0;
  for (const match of markup.matchAll(/<(input|select|textarea)\b([^>]*)>(?:([\s\S]*?)<\/(?:select|textarea)>)?/g)) {
    const attrs = attributes(match[2]), get = name => attrs.find(attr => attr.name === name)?.value;
    const type = get("type") || (match[1] === "select" ? "select-one" : "text"), lw = attrs.some(attr => attr.name.startsWith("data-lw-"));
    const input = { attributes: attrs, type, id: get("id") || "", name: get("name") || "", checked: attrs.some(attr => attr.name === "checked"),
      value: get("value") || (match[1] === "textarea" ? match[3] || "" : ""), dataset: {}, selectionStart: type === "text" ? 0 : null, selectionEnd: type === "text" ? 0 : null,
      closest(selector) { return selector === "[data-lw-root]" ? lw ? actionRoot : null : selector === "[data-scene-sheet-actor]" ? sheetOwner : null; },
      focus() { context.document.activeElement = input; }, setSelectionRange(start, end, direction) { this.selectionStart = start;this.selectionEnd = end;this.selectionDirection = direction; },
    };
    controls.push(input);
  }
  for (const match of markup.matchAll(/<details\b([^>]*)>\s*<summary>([\s\S]*?)<\/summary>/g)) detailNodes.push({
    open: /\bopen\b/.test(match[1]), summary: match[2].replace(/<[^>]+>/g, ""),
    closest: selector => selector === "[data-scene-sheet-actor]" ? sheetOwner : null,
    querySelector() { return { textContent: this.summary }; },
  });
} });
kit.querySelectorAll = selector => selector === "details" ? detailNodes : selector === "[data-lw-root]" ? [actionRoot] : controls;
Object.assign(context, {
  $: element, $$: () => [], D: context.window.DAWN_DATA,
  S: { id: "hero", concept: "", techniques: {}, runtime: { notes: "заметка", sacrifices: [] } },
  ATTRS: [["body","Тело"],["talent","Талант"],["spirit","Дух"],["mind","Разум"]],
  activeOutlooks: () => [], hasGift: () => false, techById: () => null, sceneRollShortcuts: () => "",
  sceneActorEffects: () => [], sceneEffectList: () => [], sceneUsesLionwing: () => true, md: String,
  lwStatusHtml: () => "", lwConsequenceHistoryHtml: () => "", lwDiceHtml: () => "", lwInventoryHtml: () => "", lwChainHtml: () => "", lwMasterControls: () => "",
  lwEntityViewer: () => ({ role: "owner", actorIds: ["hero"] }),
  activeSheetTab: "combat", activeScenePanel: "sheet", sceneControlMode: "automated", sceneMeasureLabel: "", sceneTurnStripVisible: true,
  sceneTopologyCells: new Set(), sceneInterfaceDensity: "comfortable", sceneNeedsInitialFit: false, store: { mode: "play" },
  Sync: { state: () => ({ sceneId: "", role: "player" }) },
  usingNextSceneInterface: () => false, sceneCombatStarted: () => true, availableSceneTemplates: () => [],
  sceneHasLegacyLionwingModifiers: () => false, sceneTurnApprovalMode: () => "automatic", clockEventText: () => "", wallEventText: () => "", eventText: () => "", setSheetTab: tab => { context.activeSheetTab = tab; },
});
for (const name of ["reconcileLocalSceneFlow","renderSceneLayoutSettings","renderSceneSources","renderEnemySelect","renderSceneManager","renderSceneBoard","renderSceneInspector","renderSceneMedia","appendTerrainRepairControls","appendSceneWallInspector","appendMarkerClockControls","renderSceneTurnStrip","renderSceneFlow","renderSceneDirector","renderSceneUtility","renderSceneReference","renderGmLibraries","renderCompoundBuilder","renderSceneChrome","refreshSceneControlStates","applySceneZoom"]) context[name] = noop;
context.document.body = { classList: { toggle: noop }, dataset: {} };
vm.runInContext("let lwDetectiveTeleport=null;", context);
vm.runInContext(source.slice(source.indexOf("const lwFormDraft ="), source.indexOf("let lwDraftEnabled=")), context);
vm.runInContext(source.slice(source.indexOf("function lwPendingHtml()"), source.indexOf("function lwAutomationHtml")), context);
vm.runInContext(source.slice(source.indexOf("function lwAutomationHtml("), source.indexOf("function lwInventoryHtml(")), context);
vm.runInContext(source.slice(source.indexOf("function lwActionsHtml("), source.indexOf("function lwEffectSourcesHtml(")), context);
context.sceneActionPanel = actor => context.lwActionsHtml(actor);
vm.runInContext(sceneUi.slice(sceneUi.indexOf("function sceneSheetPanel("), sceneUi.indexOf("function sceneUtilityActorAvailable(")), context);
const playUi = read("play-ui.js");
vm.runInContext(playUi.slice(playUi.indexOf("function renderSceneHeroSheet("), playUi.indexOf("function renderPlay(")), context);
vm.runInContext(sceneUi.slice(sceneUi.indexOf("function renderScene(){"), sceneUi.indexOf("function activeSceneView(){")), context);
const baseCommit = context.commitSceneEvents;
context.commitSceneEvents = (label, events) => { const result = baseCommit(label, events);context.renderScene();return result; };
const freshSheetScene = () => { context.Scene = fixture();context.Scene.name="Player sheet";context.Scene.undo=[];context.Scene.view="player";context.Scene.actors[0].heroId="hero";context.renderScene(); };
const sheetInput = attr => controls.find(input => input.attributes.some(row => row.name === attr));
narrator = false;directorActorId = "hero";freshSheetScene();
const sheetBefore = clone(context.Scene), sheetCommits = commits.length;
action(engine.ACTION_IDS.spell);
assert.match(kit.innerHTML, /data-lw-technique-preview/);
assert.match(kit.innerHTML, /Неверное число целей/);
const parameters = detailNodes.find(detail => detail.summary === "Параметры действия");parameters.open = true;
const notesInput = sheetInput("data-scene-hero-notes");notesInput.value="новая заметка";notesInput.focus();notesInput.setSelectionRange(3,5,"forward");
sheetInput("data-lw-focus").value="2";
fieldClick("enemy");
assert.match(kit.innerHTML, /Выбранные цели: enemy/);
assert.match(kit.innerHTML, /Стоимость: 1 ОД/);
assert.match(kit.innerHTML, /data-lw-technique-confirm >/);
assert.equal(context.Scene.actors[0].ap, 3);
assert.equal(detailNodes.find(detail => detail.summary === "Параметры действия").open, true, "inserted preview details do not collapse the parameter panel");
assert.equal(sheetInput("data-lw-focus").value,"2", "the common render preserves entered LionWing parameters");
assert.equal(sheetInput("data-scene-hero-notes").value,"новая заметка");
assert.equal(context.document.activeElement, sheetInput("data-scene-hero-notes"));
assert.equal(context.document.activeElement.selectionStart,3);assert.equal(context.document.activeElement.selectionEnd,5);
assert.equal(context.activeSheetTab,"combat");
cancel();assert.doesNotMatch(kit.innerHTML,/data-lw-technique-preview/);assert.equal(commits.length,sheetCommits);
assert.deepEqual(clone(context.Scene.actors),sheetBefore.actors);
action(engine.ACTION_IDS.spell);confirm();
assert.equal(commits.length,sheetCommits+1);
assert.equal(context.Scene.actors[0].ap,2);
assert.doesNotMatch(kit.innerHTML,/data-lw-technique-confirm/, "post-commit cleanup removes paid previews from the Player sheet");
assert.match(kit.innerHTML,/class="lw-pending"/, "the same sheet displays the actual pending Attack");

freshSheetScene();action(engine.ACTION_IDS.jump);
assert.match(kit.innerHTML,/data-lw-destination-hint/);
click({sceneCell:"2,1"},["data-scene-cell"]);
assert.match(kit.innerHTML,/data-lw-technique-preview/);
assert.equal(context.Scene.actors[0].ap,3);
cancel();assert.doesNotMatch(kit.innerHTML,/data-lw-technique-preview/);assert.equal(context.Scene.actors[0].x,1);
action(engine.ACTION_IDS.jump);click({sceneCell:"2,1"},["data-scene-cell"]);confirm();
assert.equal(context.Scene.actors[0].x,2);assert.equal(context.Scene.actors[0].ap,2);
assert.doesNotMatch(kit.innerHTML,/data-lw-technique-confirm|data-lw-destination-hint/);

freshSheetScene();context.Scene.activeActorId="enemy";
const incoming = core.prepare(context.Scene,{actorId:"enemy",kind:"attack",targetIds:["hero"],amount:2});
assert.equal(incoming.ok,true,incoming.errors?.join(" "));
context.Scene=core.dispatchMany(context.Scene,incoming.events).scene;context.renderScene();
assert.match(kit.innerHTML,/data-lw-reaction="block"/);
click({lwActor:"hero",lwReaction:"block"},["data-lw-reaction"]);
assert.doesNotMatch(kit.innerHTML,/data-lw-reaction="block"/, "a submitted reaction leaves the Player sheet's updated pending state");
assert.equal(engine.pendingActionStatus(context.Scene).waitingIds.includes("hero"),false);

// Local Player mode retains Narrator capabilities, but its own draft source
// is independent of the GM director pin. Ownership/version guards still apply.
narrator=true;context.activeSceneView=()=>"player";directorActorId="enemy";freshSheetScene();
action(engine.ACTION_IDS.spell);
assert.match(kit.innerHTML,/data-lw-technique-preview/);
assert.equal(value("lwTechniqueDraft.actorId"),"hero");
cancel();

console.log("LionWing cockpit preview passed: exact price, board/strip targeting, Player sheet refresh/pending/reaction/destination, retained fields/focus/details/source/roll, cancel, version guard, replay and ownership");
