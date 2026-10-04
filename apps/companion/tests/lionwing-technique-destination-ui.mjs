import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { runtime, fixture, clone, packet } from "./helpers/scene-contract-harness.mjs";

const live = runtime(), { context, core, engine } = live;
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
let serial = 0;
const run = (scene, actorId, payload) => {
  const prepared = core.prepare(scene, { actorId, ...payload }, { random: () => .6 });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return core.dispatchMany(scene, packet(prepared, `destination-ui:${++serial}`)).scene;
};
let scene = fixture();
scene.activeActorId = null; scene.turnSerial = 0; scene.tension = 0;
scene.actors[0].knownTechniques = { "bulwark.rising-challenger": 1 };
for (const actor of scene.actors) { actor.attrs = { body: 2, talent: 2, spirit: 2, mind: 2 }; actor.focus = 2; }
scene = run(scene, "hero", { kind: "automation", ruleId: "bulwark.rising-challenger.1", enabled: true });
scene = run(scene, "hero", { kind: "turn-start" });
scene = run(scene, "enemy", { kind: "attack", targetIds: ["hero"], amount: 4 });
scene = run(scene, "hero", { kind: "reaction", choice: "clash" });
if (scene.lionwing.choices[0]?.kind === "clash-tie") scene = run(scene, "hero", { kind: "choice", id: scene.lionwing.choices[0].id, choice: "win" });
assert.equal(scene.lionwing.choices[0]?.context.ruleId, "bulwark.rising-challenger.1");
assert.equal(scene.lionwing.choices[0]?.context.destinationRequired, true);

const handlers = [], committed = [], notices = [];
let narrator = true, authoritative = clone(scene);
Object.assign(context, {
  structuredClone,
  Scene: clone(scene), SceneEngine: engine,
  document: { addEventListener: (kind, handler) => { if (kind === "click") handlers.push(handler); }, querySelector: () => null },
  lwOwns: actorId => actorId === "hero" || narrator, lwCanNarrate: () => narrator, lwActive: () => true,
  lwGeometrySceneIdentity: () => "destination-ui-table", renderScene: () => {}, toast: message => notices.push(message),
  lwRules: () => context.window.DAWN_LIONWING_DATA.coreRules,
  esc: value => String(value ?? ""), activeDirectorTab: "manual", lwDraftEnabled: false,
  lwDraftBatch: null, lwActor: () => context.Scene.actors[0], currentHeroActor: () => context.Scene.actors[0],
  commitSceneEvents: (_label, events) => {
    committed.push(clone(events));
    authoritative = core.dispatchMany(authoritative, events.map(event => ({ ...event, id: `destination-ui-commit:${++serial}` })), { expectedVersion: authoritative.version }).scene;
    context.Scene = narrator ? clone(authoritative) : engine.projectScene(authoritative, { role: "player", actorId: "hero" });
    return true;
  },
});
context.window.document = context.document;
for (const file of ["localization.js", "locale-ru.js", "edition-lionwing-ru.js"]) vm.runInContext(read(file), context, { filename: file });
const source = read("lionwing-ui.js");
vm.runInContext(`const LionwingEngine=window.DAWN_LIONWING_ENGINE;let lwDestination=null,lwGeometryPreview=null,lwTechniqueDraft=null;\n${source.slice(source.indexOf("const lwTechniqueText"), source.indexOf("const lwRules ="))}`, context);
vm.runInContext(source.slice(source.indexOf("function lwSubmit("), source.indexOf("function lwDiceHtml")), context);
vm.runInContext(source.slice(source.indexOf("function lwPendingHtml()"), source.indexOf("function lwAutomationHtml")), context);
// The production order installs the technique surface before the generic
// LionWing click controller. Exercise that seam, rather than call a helper.
vm.runInContext(read("lionwing-technique-surface.js"), context, { filename: "lionwing-technique-surface.js" });
const captureStart = source.indexOf('document.addEventListener("click", event => {\n  if (!lwActive()) return;');
vm.runInContext(source.slice(captureStart, source.indexOf("\n},true);", captureStart) + "\n},true);".length), context);
const value = script => vm.runInContext(script, context);
const root = { dataset: { lwActor: "hero" }, querySelectorAll: () => [] };
const click = (dataset, attrs) => {
  const names = new Set(attrs), button = { dataset, hasAttribute: name => names.has(name) };
  button.closest = selector => selector === "[data-lw-root]" ? root : selector === ".lw-pending" ? { querySelector: () => null } : [...names].some(name => selector.includes(`[${name}]`)) ? button : null;
  let stopped = false;
  const event = { target: button, preventDefault() {}, stopImmediatePropagation() { stopped = true; } };
  for (const handler of handlers) { handler(event); if (stopped) break; }
};
const chooseMove = () => click({ lwTechniqueAction: "true", lwTechniqueChoice: "true", lwChoice: "move", lwChoiceId: context.Scene.lionwing.choices[0].id, lwActor: "hero" }, ["data-lw-technique-action", "data-lw-technique-choice", "data-lw-choice"]);
const cell = point => click({ sceneCell: point }, ["data-scene-cell"]);
const confirm = () => click({ lwActor: "hero" }, ["data-lw-technique-confirm"]);
const cancel = () => click({ lwActor: "hero" }, ["data-lw-shape-cancel"]);

const before = clone(authoritative);
chooseMove();
assert.equal(value("lwDestination.payload.choice"), "move", "the real technique button opens the shared board picker");
assert.equal(value('lwDestinationCellStatus({space:"main",x:2,y:1}).available'), true);
assert.equal(value('lwDestinationCellStatus({space:"main",x:7,y:1}).available'), false, "the board uses the real movement allowance");
cell("7,1"); assert.equal(value("lwTechniqueDraft"), null, "an invalid cell cannot advance to confirmation");
cell("2,1");
assert.equal(value("lwDestination"), null);
assert.equal(value("lwTechniqueDraft.payload.destination.x"), 2);
assert.match(value("lwTechniqueDraftHtml(Scene.actors[0])"), /data-lw-technique-confirm >/);
assert.deepEqual(clone(authoritative), before, "opening the picker and preview pays nothing and consumes no choice");
cancel();
assert.equal(value("lwTechniqueDraft"), null);

assert.deepEqual(clone(authoritative), before, "cancelling the uncommitted destination keeps the real pending choice");

// Player snapshots lack the authoritative deferred queue. The chosen cell is
// forwarded intact, and the Narrator applies it to the full saved continuation.
narrator = false;
context.Scene = engine.projectScene(core.reload(JSON.stringify(authoritative)), { role: "player", actorId: "hero" });
assert.equal(context.Scene.lionwing.deferred, undefined);
chooseMove(); cell("2,1");
const playerBefore = clone(authoritative);
assert.match(value("lwTechniqueDraftHtml(Scene.actors[0])"), /data-lw-technique-confirm >/);
assert.deepEqual(clone(authoritative), playerBefore);
confirm();
assert.equal(committed.length, 1, "the integrated click path submits one answer after confirmation");
assert.equal(committed[0][0].payload.destination.x, 2, "the player's forwarded answer preserves the selected cell");
assert.equal(authoritative.actors[0].x, 2);
assert.equal(authoritative.lionwing.choices.length, 0);
assert.equal(authoritative.actors[0].focus, playerBefore.actors[0].focus, "resuming the choice cannot repeat Focus gain or Clash payment");
assert.equal(value("lwTechniqueDraft"), null);

// An active follow-up is a status, and cannot hide the still unresolved outer
// Attack after the optional movement was answered.
narrator = true; context.Scene = clone(authoritative);
assert.ok(context.Scene.pendingAction?.lionwing);
assert.ok(core.pendingFollowups(context.Scene).some(item => item.status === "active"));
assert.match(value("lwPendingHtml()"), /data-lw-resolve/, "the console keeps the real pending Attack controls ahead of follow-up status");

// A selection becomes obsolete if another response consumed its choice.
authoritative = clone(scene); context.Scene = clone(scene); narrator = true;
chooseMove();
context.Scene = run(context.Scene, "hero", { kind: "choice", id: context.Scene.lionwing.choices[0].id, choice: "skip" });
value("lwReconcileDestination()");
assert.equal(value("lwDestination"), null, "a consumed or replaced choice cancels its stale local picker");
assert.equal(committed.length, 1);

// The plain fallback choice button follows the same picker even when the
// technique surface did not render that offer. Loss of the acting hero clears
// its uncommitted preview before any answer is sent.
authoritative = clone(scene); context.Scene = clone(scene);
click({ lwChoice: "move", lwChoiceId: context.Scene.lionwing.choices[0].id, lwActor: "hero" }, ["data-lw-choice"]);
assert.equal(value("lwDestination.payload.choice"), "move");
cell("2,1");
context.Scene.actors[0].knockedOut = true;
confirm();
assert.equal(value("lwTechniqueDraft"), null);
assert.equal(committed.length, 1, "source loss cannot consume the waiting choice or commit a stale movement");
console.log("LionWing technique destination UI passed: real Clash offer, board gates, preview/cancel, projected player forwarding and stale choice cleanup");
