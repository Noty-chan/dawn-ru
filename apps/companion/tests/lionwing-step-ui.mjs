import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const root = new URL("..", import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), "utf8").replace(/\r\n/g, "\n");
const engineContext = { window: {}, console };
vm.createContext(engineContext);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(read(file), engineContext, { filename: file });
loadSceneEngine(engineContext);
const Lionwing = engineContext.window.DAWN_LIONWING_ENGINE;
const SceneEngine = engineContext.window.DAWN_SCENE_ENGINE;
const D = engineContext.window.DAWN_DATA;
const ids = SceneEngine.ACTION_IDS;
const clone = value => JSON.parse(JSON.stringify(value));

const actor = (id, team, x, extra = {}) => ({
  id, name: id, kind: team === "enemy" ? "enemy" : "hero", heroId: team === "enemy" ? null : id,
  rulesEdition: "lionwing", team, space: "main", x, y: 1,
  hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0,
  tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false, lionwing: {}, ...extra,
});
const fixture = (activeActorId, actors) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId,
  spaces: [{ id: "main", width: 8, height: 5 }], actors,
  objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] },
  targetIds: [], targetCells: [], log: [], rollFeed: [], lionwing: { history: [], entities: {}, entityReceipts: {} },
});

const lionwingUi = read("lionwing-ui.js");
const captureStart = lionwingUi.indexOf('document.addEventListener("click", event => {\n  if (!lwActive()) return;');
const captureEnd = lionwingUi.indexOf("\n},true);", captureStart);
assert.ok(captureStart >= 0 && captureEnd > captureStart, "LionWing delegated click handler is present");
const captureHandler = lionwingUi.slice(captureStart, captureEnd + "\n},true);".length);

const playEvents = read("app-play-events.js");
const playKitStart = playEvents.indexOf('$("play-kit").addEventListener("click",event=>{\n  const delegatedSheet=');
const playKitEnd = playEvents.indexOf('\n$("play-kit").addEventListener("click",event=>{const tab=', playKitStart);
const trayStart = playEvents.indexOf('$("scene-action-tray").addEventListener("click",event=>{');
const trayEnd = playEvents.indexOf('\n$("scene-utility").addEventListener', trayStart);
assert.ok(playKitStart >= 0 && playKitEnd > playKitStart, "the hero sheet action handler is present");
assert.ok(trayStart >= 0 && trayEnd > trayStart, "the action tray handler is present");

const sceneEvents = read("app-scene-events.js");
const boardStart = sceneEvents.indexOf('$("scene-board").addEventListener("click",event=>{if(performance.now()<sceneSuppressBoardClickUntil)');
const boardEnd = sceneEvents.indexOf('\n$("scene-board").addEventListener("dragover"', boardStart);
assert.ok(boardStart >= 0 && boardEnd > boardStart, "the board click handler is present");
const boardHandler = sceneEvents.slice(boardStart, boardEnd);
const actionsUi = read("scene-actions-ui.js");
const functionSource = (source, name, nextName) => {
  const start = source.indexOf(`function ${name}(`);
  const end = nextName ? source.indexOf(`\nfunction ${nextName}(`, start) : -1;
  assert.ok(start >= 0 && end > start, `${name} implementation is present`);
  return source.slice(start, end);
};
const enemyStepFunctions = `${functionSource(actionsUi, "startEnemyStep", "commitEnemyStep")}\n${functionSource(actionsUi, "commitEnemyStep", "enemyRuleUiOptions")}`;
const sceneUi = read("scene-ui.js");
assert.match(sceneUi, /enemyStepActor\|\|pendingCoreAction&&currentHeroActor\(\)/, "the board preview resolves a pending Step to its actor");
assert.match(sceneUi, /\$\{movementValid\?"movement-valid":""\}/, "reachable Step destinations receive the visible movement highlight");

const handlers = {};
const targets = Object.fromEntries(["play-kit", "scene-action-tray", "scene-board"].map(id => [id, {
  addEventListener(type, handler) { if (type === "click") handlers[id] = handler; },
}]));
const uiContext = {
  window: { DAWN_LIONWING_ENGINE: Lionwing }, console, Scene: null, D,
  SceneEngine, document: {
    handlers,
    addEventListener(type, handler) { if (type === "click") handlers.documentClick = handler; },
    querySelector: () => null, querySelectorAll: () => [],
  },
  CSS: { escape: value => String(value) }, performance: { now: () => 1000 },
  $: id => targets[id] || { addEventListener() {} }, $$: () => [],
  toast: message => { uiContext.toasts.push(String(message)); },
  toasts: [], submitted: [], startedEnemySteps: [], renders: 0,
  activeSceneView: () => "player", activeSceneTool: () => "select",
  sceneActorEffects: record => record?.effects || [],
  currentHeroActor: () => uiContext.getScene().actors.find(record => record.id === uiContext.heroId),
  renderScene: () => { uiContext.renders += 1; }, persist: () => {},
  isScenePanelOpen: () => false, setScenePanel: () => {},
  canControlScenePrompt: () => false, canControlSceneActor: () => true,
  cancelSceneFlow: () => {},
};
vm.createContext(uiContext);
vm.runInContext(`
  let Scene=this.Scene, pendingCoreActorId=null, pendingCoreAction=null, pendingCoreActionPlan=false,
      pendingCoreActionContext=null, pendingCoreReaction=null, pendingEnemyStepActorId=null,
      pendingEnemyRule=null, pendingTechniqueRule=null, pendingTechniqueAnchor=null,
      pendingZealotPlan=null, activeModifierActionId=null,
      activeModifierPickerId=null, sceneSuppressBoardClickUntil=0, lwDestination=null;
  const Sync={state:()=>({sceneId:"",canNarrate:true})};
  const lwActive=()=>true, lwCanNarrate=()=>true, lwOwns=()=>true;
  const lwActor=()=>Scene.actors.find(record=>record.id===Scene.selectedActor)||Scene.actors.find(record=>record.id===Scene.activeActorId);
  const startZealotFinish=()=>{throw new Error("Step must not start a Finisher plan")};
  function currentHeroActor(){return Scene.actors.find(record=>record.id===pendingCoreActorId)||Scene.actors.find(record=>record.id===this.heroId)}
  function renderScene(){this.renders+=1}
  function persist(){}
  function commitSceneEvents(label,events){const result=SceneEngine.dispatchMany(Scene,events);Scene=result.scene;this.lastCommit={label,result};return result}
  function prepareCoreAction(actionId,extra={}){const actor=currentHeroActor();this.lastPrepared=SceneEngine.prepareAction(Scene,D,{actorId:actor?.id,actionId,targetIds:[],destination:extra.destination})}
  function commitEnemyStep(actorId,destination){const actor=Scene.actors.find(record=>record.id===actorId),step=SceneEngine.actionByKey(D,"step");const prepared=SceneEngine.prepareAction(Scene,D,{actorId:actor?.id,actionId:step?.id,targetIds:[],destination});if(!prepared.ok){this.lastEnemyPreparation=prepared;return}pendingEnemyStepActorId=null;this.lastEnemyPreparation=prepared;commitSceneEvents("Шаг: "+actor.name,prepared.events)}
  this.replaceScene=value=>{Scene=value;pendingCoreActorId=null;pendingCoreAction=null;pendingCoreActionPlan=false;pendingCoreActionContext=null;pendingCoreReaction=null;pendingEnemyStepActorId=null;pendingEnemyRule=null;pendingZealotPlan=null;activeModifierActionId=null;activeModifierPickerId=null;this.lastPrepared=null;this.lastEnemyPreparation=null;this.lastCommit=null};
  this.getScene=()=>Scene;
  this.getStepState=()=>({pendingCoreActorId,pendingCoreAction,pendingCoreActionPlan,pendingEnemyStepActorId});
`, uiContext);

vm.runInContext(enemyStepFunctions, uiContext, { filename: "scene-actions-ui.js enemy Step functions" });
vm.runInContext(captureHandler, uiContext, { filename: "lionwing-ui.js Step click handler" });
vm.runInContext(playEvents.slice(playKitStart, playKitEnd), uiContext, { filename: "app-play-events.js hero sheet handler" });
vm.runInContext(playEvents.slice(trayStart, trayEnd), uiContext, { filename: "app-play-events.js action tray handler" });
vm.runInContext(boardHandler, uiContext, { filename: "app-scene-events.js board click handler" });

const heroScene = fixture("hero", [actor("hero", "hero", 1), actor("foe", "enemy", 6)]);
uiContext.heroId = "hero";
uiContext.replaceScene(heroScene);
const stepButton = attrs => {
  const data = { ...attrs };
  return {
    dataset: data,
    hasAttribute: name => name.startsWith("data-") && Object.hasOwn(data, name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())),
    closest(selector) { return selector.includes("[data-lw-root]") ? { dataset: { lwActor: data.lwActor || data.coreActor || "hero" } } : null; },
  };
};
const clickTarget = button => ({ closest: selector => {
  if (selector.includes("[data-core-action]") || selector.includes("[data-lw-action]")) return button;
  return null;
} });
const clickEvent = target => ({
  target, prevented: false, stopped: false,
  preventDefault() { this.prevented = true; },
  stopImmediatePropagation() { this.stopped = true; },
});
const stepId = ids.step;
const sheetStep = stepButton({ coreAction: stepId });
let click = clickEvent(clickTarget(sheetStep));
handlers.documentClick(click);
assert.equal(click.prevented, false, "the LionWing capture handler lets the regular Step button reach its picker handler");
assert.equal(click.stopped, false, "the Step click is not stopped before the shared UI handles it");
assert.equal(uiContext.submitted.length, 0, "clicking Step does not immediately submit or spend an Action");
handlers["play-kit"](click);
assert.deepEqual(uiContext.getStepState().pendingCoreAction, stepId, "the hero sheet opens the pending Step destination picker");
assert.equal(uiContext.getScene().actors.find(record => record.id === "hero").ap, 3, "AP remains unchanged while the player chooses a destination");
const reachableHeroCells = SceneEngine.movementPath(uiContext.getScene(), "hero", { x: 2, y: 1 }, { maxDistance: 4 });
assert.ok(reachableHeroCells.length > 0, "the pending Step has reachable cells for the board movement highlight");
click = clickEvent({ closest: selector => selector.includes("[data-scene-cell]") ? { dataset: { sceneCell: "2,1" } } : null });
handlers.documentClick(click);
assert.equal(click.prevented, false, "a Step destination cell reaches the shared board selection handler");
handlers["scene-board"](click);
assert.equal(uiContext.lastPrepared?.ok, true, uiContext.lastPrepared?.errors?.join(" "));
assert.deepEqual(clone(uiContext.lastPrepared.events[0].payload.destination), { x: 2, y: 1 }, "the board sends the selected destination to the canonical LionWing action path");
assert.equal(uiContext.getScene().actors.find(record => record.id === "hero").ap, 3, "preparing the selected movement still does not spend AP");
const heroMoved = Lionwing.dispatchMany(uiContext.getScene(), uiContext.lastPrepared.events).scene;
assert.equal(heroMoved.actors.find(record => record.id === "hero").ap, 2, "confirmed Step pays its one AP exactly once");
assert.deepEqual([heroMoved.actors.find(record => record.id === "hero").x, heroMoved.actors.find(record => record.id === "hero").y], [2, 1], "confirmed Step moves to the chosen cell");

uiContext.replaceScene(fixture("hero", [actor("hero", "hero", 1), actor("foe", "enemy", 6)]));
const trayStep = stepButton({ coreAction: stepId, coreActor: "hero" });
click = clickEvent(clickTarget(trayStep));
handlers.documentClick(click);
assert.equal(click.stopped, false, "the action tray Step also reaches its local picker handler");
handlers["scene-action-tray"](click);
assert.equal(uiContext.getStepState().pendingCoreAction, stepId, "the action tray opens the same destination picker");
assert.equal(uiContext.getScene().actors.find(record => record.id === "hero").ap, 3, "the tray also waits for the destination before payment");

const npcScene = fixture("npc", [actor("npc", "enemy", 1, { profileId: "lionwing.npc.bruiser" }), actor("hero", "hero", 6)]);
uiContext.heroId = "hero";
uiContext.replaceScene(npcScene);
const npcStep = stepButton({ lwAction: stepId, lwActor: "npc" });
click = clickEvent(clickTarget(npcStep));
handlers.documentClick(click);
assert.equal(click.stopped, true, "the Narrator's profile action uses its local Step destination flow");
assert.deepEqual(uiContext.getStepState().pendingEnemyStepActorId, "npc", "the NPC Step delegates to the canonical enemy picker");
assert.equal(uiContext.getScene().actors.find(record => record.id === "npc").ap, 3, "NPC AP remains unchanged before a destination is selected");
assert.ok(SceneEngine.movementPath(uiContext.getScene(), "npc", { x: 2, y: 1 }, { maxDistance: 4 }).length, "the NPC also has reachable cells for its movement highlight");
click = clickEvent({ closest: selector => selector.includes("[data-scene-cell]") ? { dataset: { sceneCell: "2,1" } } : null });
handlers.documentClick(click);
handlers["scene-board"](click);
const npcMoved = uiContext.getScene().actors.find(record => record.id === "npc");
assert.equal(npcMoved.ap, 2, "the NPC's confirmed Step spends one AP");
assert.deepEqual([npcMoved.x, npcMoved.y], [2, 1], "the NPC's confirmed Step moves to the selected cell");
assert.equal(uiContext.getStepState().pendingEnemyStepActorId, null, "committing the NPC destination clears its pending picker");
assert.match(enemyStepFunctions, /SceneEngine\.prepareAction\(Scene,D,\{actorId:actor\.id,actionId:step\.id,targetIds:\[\],destination\}\)/, "the profile picker confirms through the canonical action preparation path");

console.log("LionWing Step UI: hero sheet and tray choose a destination before payment; NPC action uses the same reachable-cell and canonical commit path");
