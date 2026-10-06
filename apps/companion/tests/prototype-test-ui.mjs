import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const companion = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(companion, "prototype-test-ui.js"), "utf8");
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.classList = { add() {} }; this.srcWrites = 0; }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
  replaceChildren() { this.children.forEach(child => { child.parentNode = null; }); this.children = []; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  set src(value) { this.url = value; this.srcWrites++; }
  get src() { return this.url; }
}
function initialize(root = new Element("main")) {
  const document = { baseURI: "https://example.test/dawn/apps/companion/testing.html", readyState: "interactive", getElementById: () => root, createElement: tag => new Element(tag) };
  const context = vm.createContext({ document, window: {}, URL });
  vm.runInContext(source, context);
  return { root, document, api: context.window.DAWN_PROTOTYPE_TEST_UI };
}
const { root, document, api } = initialize();
const toolbar = root.children.find(node => node.className === "prototype-test-toolbar");
const select = toolbar.children[0].children[0];
const reset = toolbar.children[1];
const open = toolbar.children[2];
const frame = root.children.find(node => node.tagName === "iframe");
assert.equal(select.children.length, 6, "All six review drafts are offered");
assert.equal(frame.attributes.sandbox, "allow-scripts allow-forms allow-top-navigation-by-user-activation", "No same-origin access; parent navigation requires a user gesture");
assert.equal(frame.attributes.referrerpolicy, "no-referrer");
assert.equal(open.rel, "noopener noreferrer");
assert.equal(frame.srcWrites, 1, "Automatic standalone mount loads the first demo once");
const initialChildren = [...root.children];
api.activate(); api.render(); api.mount(root);
assert.deepEqual(root.children, initialChildren, "Lifecycle calls retain controls and the iframe instead of resetting the demo/focus");
assert.equal(frame.srcWrites, 1);
for (const option of select.children) {
  document.activeElement = select;
  select.value = option.value;
  select.listeners.change();
  assert.equal(document.activeElement, select, "Selection does not move keyboard focus");
  assert.equal(open.href, frame.src, "Full-size link follows the selected demo including variant");
  assert(frame.title.includes(option.textContent));
  const resolved = new URL(frame.src);
  assert.equal(resolved.origin, "https://example.test");
  assert(resolved.pathname.startsWith("/dawn/apps/companion/prototypes/"));
  const localFile = path.join(companion, resolved.pathname.split("/companion/")[1]);
  assert(fs.existsSync(localFile), `Locally served demo exists: ${localFile}`);
  const html = fs.readFileSync(localFile, "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    if (/^(?:https?:|\/)/.test(match[1])) continue;
    assert(fs.existsSync(path.resolve(path.dirname(localFile), match[1])), `Local demo asset exists: ${match[1]}`);
  }
}
const beforeReset = frame.srcWrites, sameUrl = frame.src;
document.activeElement = reset;
reset.listeners.click();
assert.equal(frame.srcWrites, beforeReset + 1, "Reset navigates the existing iframe even when URL is identical");
assert.equal(frame.src, sameUrl);
assert.equal(document.activeElement, reset, "Reset keeps the user's keyboard position");
assert.equal(initialize(null).api.activate(), false, "Main companion page without a root is untouched");
console.log("PASS: six local drafts/assets, isolated sandbox, mount lifecycle, selection/focus, reset and full-size URL.");
