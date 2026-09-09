import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const clone = value => JSON.parse(JSON.stringify(value));
const source = fs.readFileSync(new URL("../lionwing-ui.js", import.meta.url), "utf8");
const engineContext = { window: {}, console };
vm.createContext(engineContext);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), engineContext);
loadSceneEngine(engineContext);
const lw = engineContext.window.DAWN_LIONWING_ENGINE;

const hero = (id, x, team = "hero") => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x, y: 1, hp: 16, maxHp: 16, ap: 3, baseAp: 3,
  focus: 4, influence: 2, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false,
});
const fixture = () => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null,
  spaces: [{ id: "main", width: 7, height: 7 }], actors: [hero("h", 1), hero("h2", 2), hero("e", 5, "enemy")],
  objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [],
});
let serial = 0;
const run = (scene, actorId, payload) => lw.dispatchMany(scene, [{ ...lw.command(actorId, payload), id: `nested-ui-${++serial}` }]).scene;
const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// The renderer is evaluated in isolation so this test stays at the UI seam:
// it consumes only the serializable scene fields already owned by the kernel.
const helperStart = source.indexOf("const lwChainChoiceStages");
const helperEnd = source.indexOf("function lwGeneralHtml");
const ui = { Scene: null, lwCanNarrate: () => true, esc: escapeHtml };
vm.createContext(ui);
vm.runInContext(`${source.slice(helperStart, helperEnd)}\nthis.renderChain=lwChainHtml;this.frameInfo=lwChainFrameInfo;`, ui);

const render = scene => { ui.Scene = scene; return ui.renderChain({ id: "h", name: "h" }); };
let scene = fixture();
scene = run(scene, "h", { kind: "turn-start" });
scene.actors.find(actor => actor.id === "h2").hp = 1;
scene.actors.find(actor => actor.id === "h2").wounds = 2;
scene.actors.find(actor => actor.id === "h").hp = 1;
scene.actors.find(actor => actor.id === "h").wounds = 2;

// Outer Attack is visible as a Reaction window and can be paused before any
// damage is paid. The stage and path are stable data attributes for the UI.
scene = run(scene, "h", { kind: "attack", targetIds: ["h2"], amount: 20, repeat: 2 });
let html = render(scene);
assert.match(html, /data-lw-chain-stage="Реакция"/);
assert.match(html, /data-lw-chain-path="Атака → Реакция"/);
assert.match(html, /data-lw-chain="pause-chain"/);
assert.doesNotMatch(html, /data-lw-chain="resume-chain"/);

scene = run(scene, "h", { kind: "pause-chain" });
assert.equal(scene.pendingAction, null);
assert.equal(scene.lionwing.pausedChains.length, 1);
html = render(clone(scene));
assert.match(html, /data-lw-chain-stack/);
assert.match(html, /data-lw-chain-depth="1"/);
assert.match(html, /data-lw-chain-frame="paused"/);
assert.match(html, /data-lw-chain-resumable="true"/);
assert.match(html, /Возобновить цепочку \(1\)/);

// A manual nested Attack opens its own Reaction and then a Wound → Resistance
// choice while the outer saved frame remains in the stack.
scene = run(scene, "e", { kind: "attack", targetIds: ["h"], amount: 20 });
html = render(scene);
assert.match(html, /data-lw-chain-stage="Реакция"/);
assert.match(html, /data-lw-chain-depth="1"/);
assert.match(html, /Слой 1/);
scene = run(scene, "h", { kind: "reaction", choice: "take" });
scene = run(scene, "e", { kind: "resolve-attack" });
assert.equal(scene.lionwing.choices[0].kind, "knockout");
html = render(scene);
assert.match(html, /data-lw-chain-stage="Сопротивление"/);
assert.match(html, /data-lw-chain-path="Атака → Реакция → Урон → Рана → Сопротивление"/);
assert.match(html, /data-lw-chain-depth="1"/);

// The nested decision itself can be paused again. Only the newest frame is
// marked resumable, while the older outer frame remains visible underneath it.
scene = run(scene, "h", { kind: "pause-chain" });
assert.equal(scene.lionwing.pausedChains.length, 2);
html = render(clone(scene));
assert.match(html, /data-lw-chain-depth="2"/);
assert.equal((html.match(/data-lw-chain-frame="paused"/g) || []).length, 2);
assert.equal((html.match(/data-lw-chain-resumable="true"/g) || []).length, 1);
assert.match(html, /Возобновить цепочку \(2\)/);

// Resume follows LIFO order and leaves the outer saved frame untouched.
scene = run(scene, "h", { kind: "resume-chain" });
assert.equal(scene.lionwing.pausedChains.length, 1);
assert.equal(scene.lionwing.choices[0].kind, "knockout");
scene = run(scene, "h", { kind: "choice", id: scene.lionwing.choices[0].id, choice: "resist" });
assert.equal(scene.lionwing.choices.length, 0);
html = render(clone(scene));
assert.match(html, /Возобновить цепочку \(1\)/);
assert.match(html, /data-lw-chain-frame="paused"/);

scene = run(scene, "h", { kind: "resume-chain" });
assert.equal(scene.lionwing.pausedChains.length, 0);
assert.equal(scene.pendingAction?.actorId, "h");
html = render(scene);
assert.match(html, /data-lw-chain-stage="Реакция"/);
assert.match(html, /data-lw-chain-depth="0"/);
scene = run(scene, "h2", { kind: "reaction", choice: "take" });
scene = run(scene, "h", { kind: "resolve-attack" });
assert.equal(scene.lionwing.choices[0].kind, "knockout");
html = render(scene);
assert.match(html, /data-lw-chain-stage="Сопротивление"/);
scene = run(scene, "h2", { kind: "choice", id: scene.lionwing.choices[0].id, choice: "resist" });
assert.equal(scene.lionwing.choices.length, 0);
assert.equal(scene.pendingAction, null);
assert.equal(scene.lionwing.pausedChains.length, 0);
assert.equal(render(scene), "", "the chain shelf disappears after the final continuation");

// The submission boundary keeps the director on the turn pane for both stack
// controls, so a rerender cannot strand the manual continuation in another tab.
const submitStart = source.indexOf("function lwSubmit(");
const submitEnd = source.indexOf("function lwDiceHtml");
const submitUi = {
  Scene: { lionwing: { choices: [], pausedChains: [] } },
  LionwingEngine: { prepare: () => ({ ok: true, scene: {}, events: [] }) },
  lwDraftEnabled: false,
  lwCanNarrate: () => true,
  commitSceneEvents: () => true,
  activeDirectorTab: "manual",
};
vm.createContext(submitUi);
vm.runInContext(`${source.slice(submitStart, submitEnd)}\nthis.submit=lwSubmit;`, submitUi);
submitUi.submit("h", { kind: "pause-chain" });
assert.equal(submitUi.activeDirectorTab, "turn");
submitUi.activeDirectorTab = "manual";
submitUi.submit("h", { kind: "resume-chain" });
assert.equal(submitUi.activeDirectorTab, "turn");

console.log("LionWing nested continuation UI passed: stage path, LIFO stack, nested Resistance and turn-pane routing");
