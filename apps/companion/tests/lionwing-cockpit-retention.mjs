import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fixture, actor, clone } from "./helpers/scene-contract-harness.mjs";

// Exercise the production GM wrapper with a DOM fixture. Native browser focus
// and real Realtime delivery are separate acceptance checks.
const source = fs.readFileSync(new URL("../lionwing-ui.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const context = vm.createContext({ console, Scene: fixture() });
let actorId = "hero", active = true, view = "gm", owned = true, throwOnPaint = false;
let optionValues = ["", "mind"], writes = 0, removalEvents = 0;
const sync = { sceneId: "qa-room", userId: "qa-user", role: "owner", canNarrate: true };
const changeHandlers = [];
const rail = { scrollTop: 73, scrollLeft: 8 };
const panel = { scrollTop: 51, scrollLeft: 4, parentElement: rail };
const panes = Object.fromEntries(["turn", "manual"].map(id => [id, { dataset: { directorPane: id }, prepend() {} }]));
const root = {
  dataset: {}, scrollTop: 27, scrollLeft: 2, controls: [], details: [], owners: [],
  closest: selector => selector === "[data-scene-panel-content]" ? panel : null,
  contains(element) { return [...this.controls, ...this.details, ...this.owners].includes(element); },
  querySelector(selector) { return panes[selector.match(/^\[data-director-pane="(.*)"\]$/)?.[1]] || null; },
  querySelectorAll(selector) {
    if (selector === "details") return this.details;
    if (selector === "[data-lw-root]") return this.owners;
    if (["input,select,textarea", "input,select,textarea,button,a", "[data-lw-root] input,[data-lw-root] select,[data-lw-root] textarea"].includes(selector)) return this.controls;
    return [];
  },
  prepend() {},
};
const document = {
  activeElement: null,
  addEventListener(type, handler, capture) { if (type === "change" && capture) changeHandlers.push(handler); },
  createElement() {
    const consoleNode = { insertAdjacentHTML() {}, querySelector(selector) { return selector === ".lw-actions" ? root.owners[0] : null; } };
    return { firstElementChild: consoleNode, innerHTML: "" };
  },
};
function field(name, value, config = {}) {
  const owner = root.owners[0], attribute = `data-lw-${name}`;
  const element = {
    id: "", name: "", tagName: "INPUT", type: "number", disabled: false, readOnly: false,
    attributes: [{ name: attribute, value: "" }], dataset: {}, defaultValue: String(value), value: String(value),
    selectionStart: null, selectionEnd: null,
    closest(selector) { return selector === "[data-lw-root]" ? owner : selector === "[data-director-pane]" ? panes.turn : null; },
    focus(options) { assert.equal(options.preventScroll, true); document.activeElement = this; },
    ...config,
  };
  if (element.tagName === "SELECT") {
    element.options = optionValues.map(option => ({ value: option, defaultSelected: option === value, selected: option === value }));
    Object.defineProperty(element, "value", {
      get() { return this.options.find(option => option.selected)?.value || ""; },
      set(next) { for (const option of this.options) option.selected = option.value === next; },
    });
  }
  if (element.tagName === "TEXTAREA") {
    element.selectionStart = 0; element.selectionEnd = 0; element.selectionDirection = "none";
    element.setSelectionRange = function(start, end, direction) { this.selectionStart = Math.min(start, this.value.length); this.selectionEnd = Math.min(end, this.value.length); this.selectionDirection = direction; };
  }
  return element;
}
function disclosure(section, open = false) {
  return { dataset: { lwCockpitSection: section }, className: "", open,
    hasAttribute: () => false, querySelector: () => ({ textContent: section }),
    closest: selector => selector === "[data-lw-root]" ? root.owners[0] : selector === "[data-director-pane]" ? panes.turn : null,
  };
}
function change(target) {
  const event = { target, stopped: false, prevented: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; },
  };
  for (const handler of changeHandlers) { handler(event); if (event.stopped) break; }
  if (!event.stopped) writes++;
  return event;
}
function basePaint() {
  if (throwOnPaint) throw new Error("fixture renderer failure");
  if (root.contains(document.activeElement)) { removalEvents++; change(document.activeElement); }
  document.activeElement = null;
  const owner = { dataset: { lwActor: actorId }, className: "lw-actions",
    closest: () => null,
    querySelectorAll(selector) { return root.controls.filter(element => element.attributes.some(attribute => `[${attribute.name}]` === selector)); },
  };
  root.owners = [owner];
  const selected = context.Scene.actors.find(item => item.id === actorId);
  root.controls = [
    field("focus", "0"),
    field("note", "", { tagName: "TEXTAREA", type: "textarea" }),
    field("attribute", "", { tagName: "SELECT", type: "select-one" }),
    field("cunning-plan", "", { type: "checkbox", checked: false, defaultChecked: false }),
    field("correct-value", selected?.hp || 0),
    field("canonical-focus", selected?.focus || 0, { readOnly: true }),
    field("disabled", "canonical", { disabled: true }),
    field("file", "", { type: "file" }),
  ];
  root.details = [disclosure("parameters"), disclosure("dice"), disclosure("inventory")];
  root.scrollTop = root.scrollLeft = panel.scrollTop = panel.scrollLeft = rail.scrollTop = rail.scrollLeft = 0;
}
Object.assign(context, {
  document, manualTableDraftGeneration: 0,
  Sync: { state: () => sync }, $: id => id === "scene-director" ? root : null,
  activeSceneView: () => view, lwOwns: () => owned, lwCanNarrate: () => sync.canNarrate,
  lwActive: () => active, lwActor: () => context.Scene.actors.find(item => item.id === actorId),
  renderSceneDirector: basePaint, lwReconcileGeometryPreview() {}, renderLionwingEntities() {}, lwInstallGeometryPreviewGuard() {},
  lwDirectorHtml: () => "", lwBatchHtml: () => "", lwGeneralHtml: () => "", lwEffectSourcesHtml: () => "",
  lwRefreshCunningActions() {}, lwRefreshPendingControls() {},
});
vm.runInContext(source.slice(source.indexOf("const lwFormDraft ="), source.indexOf("let lwDraftEnabled=")), context, { filename: "lionwing-ui.js:retention" });
vm.runInContext(source.slice(source.indexOf("const lwOldDirector ="), source.indexOf("const lwOldEventText =")), context, { filename: "lionwing-ui.js:director" });
const value = script => vm.runInContext(script, context);
const paint = () => context.renderSceneDirector();
const find = name => root.controls.find(element => element.attributes[0].name === `data-lw-${name}`);
const detail = section => root.details.find(element => element.dataset.lwCockpitSection === section);

paint();
find("focus").value = "1";
find("note").value = "Draft note";
find("note").focus({ preventScroll: true });
find("note").setSelectionRange(3, 7, "backward");
find("attribute").value = "mind";
find("cunning-plan").checked = true;
find("canonical-focus").value = "old read-only draft";
find("disabled").value = "old disabled draft";
find("file").value = "local mock file";
detail("parameters").open = true; detail("dice").open = true;
root.scrollTop = 27; root.scrollLeft = 2; panel.scrollTop = 51; panel.scrollLeft = 4; rail.scrollTop = 73; rail.scrollLeft = 8;
// Simulate a fresh canonical update belonging to the same room, with unrelated
// roster changes. Painting must not mutate this new snapshot or pin old HP.
context.Scene.actors[0].hp = 24; context.Scene.actors[0].focus = 2; context.Scene.version++;
context.Scene.actors.push(actor("new-ally", "hero", 2, 2));
const canonical = clone(context.Scene);
paint();
assert.equal(find("focus").value, "1");
assert.equal(find("note").value, "Draft note");
assert.equal(document.activeElement, find("note"));
assert.equal(document.activeElement.selectionStart, 3); assert.equal(document.activeElement.selectionEnd, 7); assert.equal(document.activeElement.selectionDirection, "backward");
assert.equal(find("attribute").value, "mind"); assert.equal(find("cunning-plan").checked, true);
assert.equal(find("correct-value").value, "24", "an untouched correction field follows canonical HP");
assert.equal(find("canonical-focus").value, "2"); assert.equal(find("disabled").value, "canonical"); assert.equal(find("file").value, "");
assert.equal(detail("parameters").open, true); assert.equal(detail("dice").open, true); assert.equal(detail("inventory").open, false);
assert.deepEqual([root.scrollTop, root.scrollLeft, panel.scrollTop, panel.scrollLeft, rail.scrollTop, rail.scrollLeft], [27, 2, 51, 4, 73, 8]);
assert.equal(removalEvents, 1); assert.equal(writes, 0, "the capture guard prevents a DOM-removal change from reaching a command handler");
assert.deepEqual(clone(context.Scene), canonical, "rendering changes neither canonical values, receipts nor resources");
assert.equal(change(find("focus")).stopped, false, "a real change outside repaint remains available to the ordinary handler");
assert.equal(writes, 1);

// A focused but unedited canonical field must still receive new server values.
find("correct-value").focus({ preventScroll: true });
context.Scene.actors[0].hp = 17; context.Scene.version++;
paint();
assert.equal(find("correct-value").value, "17"); assert.equal(document.activeElement, find("correct-value"));
assert.equal(writes, 1);
// Stale choices no longer present in the fresh DOM cannot erase its default.
optionValues = [""];
paint();
assert.equal(find("attribute").value, "");
assert.equal(detail("dice").open, true);
detail("dice").open = false; paint(); assert.equal(detail("dice").open, false, "explicit service collapse survives subsequent updates");

// Scope changes clear the draft map as well as values/focus/details. Returning
// to an earlier actor or room must never resurrect the previous unsent draft.
function assertReset(label, mutate) {
  find("focus").value = "2"; find("note").value = `draft ${label}`; find("note").focus({ preventScroll: true }); detail("parameters").open = true;
  paint();
  assert.ok(value("lwFormDraft.size") > 0);
  mutate(); paint();
  assert.equal(find("focus").value, "0", `${label}: prior input was discarded`);
  assert.equal(find("note").value, "", `${label}: prior note was discarded`);
  assert.equal(document.activeElement, null, `${label}: prior focus was discarded`);
  assert.equal(detail("parameters").open, false, `${label}: prior disclosure was discarded`);
  assert.equal(value("lwFormDraft.size"), 0, `${label}: old drafts cannot return`);
}
assertReset("actor", () => { actorId = "enemy"; });
actorId = "hero"; paint(); assert.equal(find("note").value, "");
assertReset("room", () => { sync.sceneId = "other-room"; });
sync.sceneId = "qa-room"; paint(); assert.equal(find("note").value, "");
assertReset("epoch", () => { context.Scene.tablePolicy = { mode: "rules", epoch: 2 }; });
assertReset("scene ID", () => { context.Scene.id = "new-scene"; });
assertReset("battle serial", () => { context.Scene.lionwing.sceneSerial = 2; });
assertReset("explicit local replacement", () => { context.manualTableDraftGeneration++; });
assertReset("account", () => { sync.userId = "other-user"; });
assertReset("role", () => { sync.role = "player"; });
assertReset("ownership", () => { owned = false; });
owned = true; paint();
assertReset("narrator access", () => { sync.canNarrate = false; });
sync.canNarrate = true; paint();
assertReset("Player view", () => { view = "player"; });
view = "gm"; paint();
assertReset("rules mode", () => { context.Scene.tablePolicy.mode = "manual"; });
assertReset("actor reassignment", () => { context.Scene.actors[0].heroId = "new-character"; });

active = false; paint(); assert.equal(root.dataset.lwCockpitScope, "");
active = true; actorId = "missing"; paint(); assert.equal(root.dataset.lwCockpitScope, "");
actorId = "hero"; paint();
throwOnPaint = true;
assert.throws(paint, /fixture renderer failure/);
assert.equal(value("lwPaintingDirector"), false, "a failed renderer cannot leave the real-change guard stuck on");
assert.equal(change(find("focus")).stopped, false);

console.log("LionWing GM cockpit retention passed: typed values/caret, fresh canonical fields, disclosure/scroll, stale options, context/access reset and removal-change guard (DOM fixture)");
