import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { clone, fixture, packet, runtime, seededRandom } from "./helpers/scene-contract-harness.mjs";

const { core, engine } = runtime(), ids = engine.ACTION_IDS;
const draft = (actionId, extra = {}) => ({ actorId: "hero", payload: { kind: "action", actionId, targetIds: [], ...extra } });
const status = (scene, request, x, y) => core.destinationStatus(scene, { ...request, destination: { space: "main", x, y } });
const scene = fixture();
assert.equal(status(scene, draft(ids.jump), 4, 4).available, true, "Talent 3 permits three diagonal Line spaces");
assert.equal(status(scene, draft(ids.jump), 5, 5).available, false);
assert.equal(status(scene, draft(ids.jump), 2, 3).available, false, "Jump requires a straight Line");
assert.equal(status(scene, draft(ids.jump), 4, 1).available, false, "an occupied endpoint is not highlighted");
assert.equal(status(scene, draft(ids.jump), 1, 1).available, false, "a zero-distance Jump is not an action");
const overEnemy = clone(scene); overEnemy.actors[1].x = 2;
assert.equal(status(overEnemy, draft(ids.jump), 4, 1).available, true, "Jump may pass over opponents");
const mud = clone(overEnemy); mud.objects.push({ id: "mud", type: "difficult", space: "main", cells: ["3,1"] });
assert.equal(status(mud, draft(ids.jump), 4, 1).available, true, "Jump ignores Difficult Terrain");
const obstacle = clone(mud); obstacle.objects.push({ id: "obstacle", type: "terrain", space: "main", cells: ["3,1"] });
assert.equal(status(obstacle, draft(ids.jump), 4, 1).available, false, "Jump still respects Obstacles");
const caught = clone(scene); caught.actors[0].effects.push("negative.обездвижен");
assert.equal(status(caught, draft(ids.jump), 2, 1).available, false);
const shove = clone(scene); shove.actors[1].x = 2;
assert.equal(status(shove, draft(ids.shove, { targetIds: ["enemy"] }), 3, 1).available, true);
assert.equal(status(shove, draft(ids.shove, { targetIds: ["enemy"] }), 4, 1).available, false);
assert.equal(status(scene, draft(ids.improvise), 1, 2).available, true);
assert.equal(status(scene, draft(ids.improvise), 3, 2).available, false);
assert.equal(core.destinationStatus(scene, { ...draft(ids.improvise), destination: { x: 1, y: 2 } }).available, true, "omitted space means the source board");
const otherBoard = clone(scene); otherBoard.spaces.push({ id: "other", width: 8, height: 6 });
assert.equal(core.destinationStatus(otherBoard, { ...draft(ids.improvise), destination: { space: "other", x: 1, y: 2 } }).available, false);
assert.equal(core.prepare(otherBoard, { ...draft(ids.improvise).payload, actorId: "hero", destination: { space: "other", x: 1, y: 2 } }).ok, false, "Improvise cannot validate one board and create an obstacle on another");
const deciding = clone(scene); deciding.pendingPrompt = { id: "passive", sourceActorId: "enemy", kind: "enemy-move-cell" };
assert.equal(status(deciding, draft(ids.jump), 2, 1).available, false, "a shared NPC passive decision blocks a new action");
assert.equal(core.prepare(deciding, { actorId: "hero", kind: "turn-end" }).ok, false);
deciding.activeActorId = null;
assert.equal(engine.turnStartStatus(deciding, "hero").available, false);
deciding.actors.forEach(actor => { actor.acted = true; });
assert.equal(engine.roundEndStatus(deciding).available, false);
const area = fixture(); area.actors[0].knownTechniques = { "ruiner.bombardier": 1 }; area.actors[0].lionwing.automation = { "ruiner.bombardier.1": true };
const bombard = { ...draft(ids.finish, { attribute: "spirit", techniqueRuleId: "ruiner.bombardier.1", focusSpent: 0 }), field: "areaCenter" };
assert.equal(status(area, bombard, 4, 1).available, true, "area center previews use the actual technique preparation");
assert.equal(status(area, bombard, 7, 5).available, false);

const hidden = clone(scene); hidden.actors[0].effects.push("positive.исчез");
const appearing = { ...draft(ids.jump), field: "reappearance" };
assert.equal(status(hidden, appearing, 5, 4).available, true);
assert.equal(status(hidden, appearing, 4, 2).available, false, "reappearance cannot be next to another character");
const afterAppearance = draft(ids.jump, { reappearance: { space: "main", x: 5, y: 4 } });
assert.equal(status(hidden, afterAppearance, 6, 4).available, true, "the second picker measures movement from the staged appearance");
assert.equal(status(hidden, afterAppearance, 1, 1).available, false);
assert.equal(status(hidden, draft(ids.improvise, { reappearance: { space: "main", x: 5, y: 4 } }), 6, 4).available, true, "Improvise adjacency is measured from staged appearance");
assert.equal(status(scene, appearing, 5, 4).available, false, "an obsolete appearance picker has no legal cells");

let attacked = fixture(); attacked.actors[1].x = 2; attacked.activeActorId = "enemy";
attacked = engine.dispatchMany(attacked, packet(core.prepare(attacked, { kind: "attack", actorId: "enemy", targetIds: ["hero"], amount: 2 }), "incoming")).scene;
const dodge = { actorId: "hero", payload: { kind: "reaction", choice: "dodge" } };
assert.equal(status(attacked, dodge, 1, 2).available, true);
assert.equal(status(attacked, dodge, 7, 5).available, false);
const placement = fixture(); placement.lionwing.choices = [{ id: "place", actorId: "hero", kind: "placement", title: "Размещение", options: ["place"], context: { adjacentTo: "enemy" } }];
const placementDraft = { actorId: "hero", payload: { kind: "choice", id: "place", choice: "place" } };
assert.equal(status(placement, placementDraft, 4, 2).available, true);
assert.equal(status(placement, placementDraft, 1, 2).available, false);

// Generated boards assert the public query/actual preparation contract rather
// than duplicating a second set of distance/terrain rules in the test.
for (const seed of [1, 4, 17, 904]) {
  const random = seededRandom(seed), generated = fixture();
  for (let index = 0; index < 5; index++) generated.objects.push({ id: `terrain:${index}`, type: index % 2 ? "difficult" : "terrain", space: "main", cells: [`${Math.floor(random() * 8)},${Math.floor(random() * 6)}`] });
  for (const request of [draft(ids.jump), draft(ids.improvise)]) {
    const before = clone(generated);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
      const destination = { space: "main", x, y }, query = core.destinationStatus(generated, { ...request, destination });
      const actual = core.prepare(generated, { ...request.payload, actorId: request.actorId, destination }, { random: () => 0 });
      assert.equal(query.available, actual.ok, `seed ${seed}: ${request.payload.actionId} ${x},${y}`);
    }
    assert.deepEqual(generated, before, "querying every cell changes no state, costs or receipts");
  }
}

// Execute the production picker, board highlight helper and click listener with
// the real core. This reproduces the UI path which used to omit Jump previews.
const uiSource = fs.readFileSync(new URL("../lionwing-ui.js", import.meta.url), "utf8");
const helpers = uiSource.slice(uiSource.indexOf("let lwDestination ="), uiSource.indexOf("const lwRules ="));
const handler = uiSource.slice(uiSource.indexOf('document.addEventListener("click", event => {'), uiSource.indexOf('document.addEventListener("change",event=>{'));
const cells = Array.from({ length: 48 }, (_, index) => ({ dataset: { sceneCell: `${index % 8},${Math.floor(index / 8)}` }, classes: new Set(), classList: { toggle(name, value) { if (value) cells[index].classes.add(name); else cells[index].classes.delete(name); } } }));
const board = { querySelectorAll: () => cells }, toasts = [], ui = { window: { DAWN_LIONWING_ENGINE: core }, Scene: fixture(), console,
  SceneEngine: engine, document: { addEventListener(type, fn) { if (type === "click") ui.click = fn; }, querySelector: () => null },
  CSS: { escape: value => value }, toast: message => toasts.push(message), renders: 0, submissions: 0 };
vm.createContext(ui);
vm.runInContext(`
 let Scene=this.Scene; const LionwingEngine=window.DAWN_LIONWING_ENGINE, lwActive=()=>true, lwOwns=()=>true, lwCanNarrate=()=>true;
 const lwActor=()=>Scene.actors[0], lwRules=()=>({actions:{list:[{id:SceneEngine.ACTION_IDS.jump,name:"Прыжок"}]}}), lwGeometrySceneIdentity=()=>Scene.id||"local";
 let scenePreviewCells=new Set();
 function renderScene(){this.renders++;lwApplyDestinationHighlights(this.board,Scene.spaces[0])}
 function lwSubmit(actorId,payload){const p=LionwingEngine.prepare(Scene,{actorId,...payload});if(!p.ok)throw new Error(p.errors.join(" "));Scene=SceneEngine.dispatchMany(Scene,p.events).scene;this.submissions++;return true}
 ${helpers}\n${handler}
 this.getScene=()=>Scene;this.getDestination=()=>lwDestination;this.cancel=lwCancelDestination;this.setScene=value=>{Scene=value};this.setDestination=lwSetDestination;
`, Object.assign(ui, { board }));
const root = { dataset: { lwActor: "hero" }, querySelector: () => null };
const button = { dataset: { lwAction: ids.jump, lwActor: "hero" }, hasAttribute: name => name === "data-lw-action", closest: selector => selector.includes("[data-lw-root]") ? root : null };
const click = target => ui.click({ target, preventDefault() {}, stopImmediatePropagation() {} });
click({ closest: selector => selector.includes("[data-lw-action]") ? button : null });
assert.ok(ui.renders > 0, "starting Jump immediately repaints its destinations");
assert.ok(cells.find(cell => cell.dataset.sceneCell === "4,4").classes.has("movement-valid"));
assert.equal(ui.getScene().actors[0].ap, 3, "selection spends nothing");
const cellTarget = key => ({ closest: selector => selector.includes("[data-scene-cell]") ? { dataset: { sceneCell: key } } : null });
click(cellTarget("2,3"));
assert.equal(ui.submissions, 0, "an invalid cell cannot submit a command");
assert.ok(toasts.some(message => /Лини/.test(message)));
const occupiedDuringSelection = clone(ui.getScene()); occupiedDuringSelection.actors[1].x = 4; occupiedDuringSelection.actors[1].y = 4; occupiedDuringSelection.version++;
ui.setScene(occupiedDuringSelection);
click(cellTarget("4,4"));
assert.equal(ui.submissions, 0, "the click rechecks a cell occupied after the highlight was drawn");
ui.setScene(fixture());
click(cellTarget("4,4"));
assert.equal(ui.submissions, 1);
assert.equal(ui.getScene().actors[0].ap, 2);
assert.deepEqual([ui.getScene().actors[0].x, ui.getScene().actors[0].y], [4, 4]);
assert.equal(ui.getDestination(), null);
ui.setScene(fixture()); ui.setDestination({ ...draft(ids.jump), label: "Прыжок" }); ui.cancel();
assert.equal(ui.getDestination(), null);
assert.equal(ui.getScene().actors[0].ap, 3, "canceling the picker is free");
ui.setDestination({ ...draft(ids.jump), label: "Прыжок" });
const nextTurn = fixture(); nextTurn.turnSerial++;
ui.setScene(nextTurn); vm.runInContext("lwReconcileDestination()", ui);
assert.equal(ui.getDestination(), null, "a new Turn invalidates the old picker");
ui.setScene(fixture()); ui.setDestination({ ...draft(ids.jump), label: "Прыжок" });
ui.setScene(deciding); vm.runInContext("lwReconcileDestination()", ui);
assert.equal(ui.getDestination(), null, "a newly opened passive decision cancels an action picker");
console.log("Destination contracts: Jump/diagonal/terrain, Shove, Improvise, Dodge, appearance, placement, generated query/commit parity, production picker/highlight/click/stale cell/cancel");
