import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
class Element {
  constructor(tag = "div") { this.tagName = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.textContent = ""; this.innerHTML = ""; this.classes = new Set(); this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) }; }
  append(...nodes) { nodes.forEach(node => { node.remove(); node.parentNode = this; this.children.push(node); }); }
  prepend(...nodes) { nodes.forEach(node => node.remove()); this.children.unshift(...nodes); nodes.forEach(node => { node.parentNode = this; }); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
  before(node) { const parent = this.parentNode; node.remove(); parent.children.splice(parent.children.indexOf(this), 0, node); node.parentNode = parent; }
  after(node) { const parent = this.parentNode; node.remove(); parent.children.splice(parent.children.indexOf(this) + 1, 0, node); node.parentNode = parent; }
  querySelector(selector) { return selector === ".scene-board-tool-original-label" && this.innerHTML.includes("scene-board-tool-original-label") ? {} : null; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  closest() { return stage; }
}
const candidate = new Element(), stage = new Element(), oldPrimary = new Element(), oldActions = new Element(), body = new Element();
oldPrimary.hidden = false;
candidate.append(oldPrimary, oldActions);
const controls = new Map(), operations = new Map();
let gameClicks = 0;
for (const name of ["select", "place", "target", "measure", "wall", "marker", "topology", "erase"]) {
  const button = new Element("button"); button.textContent = name; button.innerHTML = name; button.dataset = { sceneTool: name }; button.addEventListener("click", () => gameClicks++); button.setAttribute("aria-pressed", name === "select" ? "true" : "false");
  operations.set(`[data-scene-tool="${name}"]`, [button]); oldPrimary.append(button);
}
operations.set('[data-scene-tool="area"]', Array.from({ length: 3 }, () => new Element("button")));
oldPrimary.append(...operations.get('[data-scene-tool="area"]'));
const headerTarget = new Element("button");
headerTarget.classList.add("scene-stage-quick-action");
headerTarget.dataset = { sceneTool: "target" };
stage.append(headerTarget);
operations.get('[data-scene-tool="target"]').push(headerTarget);
for (const id of ["scene-zoom-fit", "scene-undo", "scene-redo", "scene-clear-targets", "scene-clear-movement-traces"]) {
  const button = new Element("button"); button.id = id; button.textContent = id; button.innerHTML = id; button.disabled = id === "scene-undo"; operations.set(`#${id}`, [button]); oldActions.append(button);
}
for (const id of ["scene-area-controls", "scene-wall-controls", "scene-marker-controls", "scene-topology-controls"]) { const node = new Element(); node.hidden = true; controls.set(`#${id}`, node); candidate.append(node); }
candidate.querySelector = selector => selector === ".scene-tool-group" ? oldPrimary : selector === ".scene-tool-actions" ? oldActions : controls.get(selector);
candidate.querySelectorAll = selector => operations.get(selector) || [];
const documentListeners = [];
let lateMount = true;
const mapTools = new Element();
const document = { body, readyState: "interactive", querySelector: () => candidate, querySelectorAll: selector => lateMount && /"(?:area|wall|marker|topology|erase)"/.test(selector) ? [] : operations.get(selector) || [], getElementById: id => id === "scene-map-tools" ? mapTools : controls.get(`#${id}`), createElement: tag => new Element(tag), createComment: () => new Element("#comment"), addEventListener(type) { documentListeners.push(type); } };
const observers = [];
class Observer { constructor(callback) { this.callback = callback; observers.push(this); } observe(target, options) { this.target = target; this.options = options; } }
let next = false;
const Scene = { tool: "select", history: ["existing"] };
const context = vm.createContext({ document, Scene, usingNextSceneInterface: () => next, window: { DAWN_UI_ICONS: { html: name => `<svg class="dawn-control-icon" data-icon="${name}"></svg>` } }, MutationObserver: Observer });
vm.runInContext(fs.readFileSync(path.join(root, "scene-board-tools.js"), "utf8"), context);
const api = context.window.DAWN_SCENE_BOARD_TOOLS;
assert.equal(api.isEnabled(), false, "Classic startup does not mount experimental controls");
assert.equal(oldPrimary.hidden, false);
next = true; api.setEnabled(true);
const strip = candidate.children[0], panels = candidate.children[1];
assert.equal(strip.children.length, 3, "First render can precede real GM tool mounting");
lateMount = false;
const childObserver = observers.find(item => item.options.childList);
childObserver.callback();
assert.equal(strip.children.length, 5, "Five useful categories; environment combines areas/walls/erase");
assert.equal(panels.children.length, 5);
assert.equal(oldPrimary.parentNode, candidate, "Original published primary container remains available for restoration");
assert.equal(oldPrimary.hidden, true);
const tokens = panels.children[0], measure = panels.children[1];
assert.equal(tokens.children[1], operations.get('[data-scene-tool="select"]')[0], "Real operation nodes are reparented, never cloned");
assert.equal(tokens.children[4], operations.get("#scene-clear-targets")[0]);
assert.equal(headerTarget.parentNode, stage, "The header's contextual quick Target action is never reparented into the palette");
assert.equal(tokens.children.filter(node => node.dataset?.sceneTool === "target").length, 1, "Token category contains exactly the original toolbar Target button");
assert.equal(measure.children[2], operations.get("#scene-clear-movement-traces")[0], "Route and target clearing remain separate");
const walls = panels.children[2];
assert.equal(controls.get("#scene-wall-controls").parentNode, walls, "Parameters use the real environment flyout");
const mapDrawer = new Element(); mapDrawer.append(controls.get("#scene-wall-controls"));
childObserver.callback();
assert.equal(controls.get("#scene-wall-controls").parentNode, walls, "A later mount converges to the single flyout parameter owner");
childObserver.callback();
assert.equal(strip.children.length, 5, "Repeated late-mount enhancement converges without duplicate categories");
api.select("areas"); controls.get("#scene-wall-controls").hidden = false;
api.select("tokens"); assert.equal(walls.hidden, true, "Browsing another category hides the wall controls even when the Scene's wall tool remains active");
tokens.children[1].listeners.click(); assert.equal(gameClicks, 1, "Original tool listeners survive relocation");
api.select("history");
assert.equal(gameClicks, 1, "Category selection cannot trigger game actions");
assert.equal(operations.get("#scene-undo")[0].disabled, true, "Existing disabled authority is preserved");
assert.equal(operations.get('[data-scene-tool="select"]')[0].attrs["aria-pressed"], "true", "Category browsing does not change the active Scene tool");
const toolObserver = observers.find(item => item.target === candidate);
toolObserver.callback();
assert.equal(panels.children[4].hidden, false, "An unchanged active tool does not override browsing History");
operations.get('[data-scene-tool="select"]')[0].setAttribute("aria-pressed", "false");
operations.get('[data-scene-tool="measure"]')[0].setAttribute("aria-pressed", "true");
toolObserver.callback();
assert.equal(measure.hidden, false, "Keyboard/core tool changes reveal their category");
assert.equal(strip.children[1].attrs["data-active-tool"], "true");
api.select("history");
body.classList.add("scene-player-view"); api.refresh();
assert.equal(tokens.hidden, false, "Changing to player view leaves a visible supported category");
assert.equal(api.select("history"), false, "Player cannot browse GM-only history group");
assert.equal(controls.get("#scene-area-controls").hidden, true, "Existing parameter visibility is preserved");
assert.equal(documentListeners.includes("keydown"), false, "Permanent palette does not hijack game Escape");
const children = [...candidate.children]; api.init(); assert.deepEqual(candidate.children, children, "Repeated initialization retains live DOM nodes");
const selectButton = operations.get('[data-scene-tool="select"]')[0], originalListener = selectButton.listeners.click;
const sceneBefore = JSON.stringify(Scene);
const originalPrimaryOrder = ["select", "place", "target", "measure", "wall", "marker", "topology", "erase"];
for (let cycle = 0; cycle < 3; cycle++) {
  next = false; api.setEnabled(false);
  assert.equal(api.isEnabled(), false);
  assert.equal(selectButton.parentNode, oldPrimary);
  assert.equal(selectButton.innerHTML, "select", "Classic restores original button content");
  assert.equal(oldPrimary.hidden, false);
  assert.equal(controls.get("#scene-wall-controls").parentNode, candidate, "Parameter controls return to their anchored original homes");
  assert.deepEqual(oldPrimary.children.filter(node => node.dataset?.sceneTool).map(node => node.dataset.sceneTool), originalPrimaryOrder, "Original operation order survives cycles");
  childObserver.callback(); assert.equal(selectButton.parentNode, oldPrimary, "Disabled observer cannot steal classic nodes");
  next = true; api.setEnabled(true);
  assert.equal(controls.get("#scene-wall-controls").parentNode,walls,"Switching back restores the same flyout parameter controls");
  assert.equal(selectButton.parentNode, tokens);
  assert(selectButton.innerHTML.includes("data-icon=\"select\""));
  assert.equal(selectButton.listeners.click, originalListener);
  assert.equal(operations.get("#scene-undo")[0].disabled, true);
  assert.equal(JSON.stringify(Scene), sceneBefore, "Interface toggles do not write Scene.tool/history");
}
console.log("PASS: actual controls/listeners/state preserved, separate clears, five real categories, player gating, idempotent lifecycle, no Escape interception.");
