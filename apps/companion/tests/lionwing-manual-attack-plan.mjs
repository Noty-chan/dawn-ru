import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js", "lionwing-dice.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
vm.runInContext(fs.readFileSync(new URL("../lionwing-action-plan.js", import.meta.url), "utf8"), context, { filename: "lionwing-action-plan.js" });

const engine = context.window.DAWN_LIONWING_ENGINE;
const plans = context.window.DAWN_LIONWING_ACTION_PLAN;
const clone = value => JSON.parse(JSON.stringify(value));
const actor = (id, team, x, y, extra = {}) => ({
  id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing", team, space: "main", x, y, hp: team === "hero" ? 1 : 20, maxHp: team === "hero" ? 16 : 20,
  ap: 3, baseAp: 3, focus: 3, influence: 3, wounds: team === "hero" ? 2 : 0, stress: 0, tier: 1, speed: 4,
  armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 3, mind: 2 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false, lionwing: {}, ...extra,
});
const fixture = () => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0, activeActorId: null,
  spaces: [{ id: "main", name: "Поле", mode: "standard", width: 8, height: 6 }],
  actors: [actor("attacker", "enemy", 3, 1), actor("target", "hero", 1, 1)],
  objects: [], walls: [], markers: [], areas: [], targetIds: [], targetCells: [], reminders: [], rollFeed: [], log: [],
  lionwing: { entities: {}, entityReceipts: {} },
});
const makeAttack = (scene, id, extra = {}) => engine.prepare(scene, {
  actorId: "attacker", eventId: id, kind: "plan", actionId: "manual.attack", targetIds: ["target"],
  costs: [{ kind: "resource", resource: "focus", amount: 1 }],
  operations: [{ id: `${id}:attack`, kind: "attack", targetIds: ["target"], amount: 5, repeat: 2, ...extra }],
});
const dispatch = (scene, prepared) => engine.dispatchMany(scene, prepared.events).scene;

let scene = fixture();
const before = clone(scene);
const prepared = makeAttack(scene, "manual-plan-1");
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
assert.equal(prepared.events[0].payload.actionPlan.status, "previewed");
assert.equal(prepared.events[0].payload.execution.payment.paid, false);
assert.deepEqual(scene, before, "preparation does not pay or mutate the Scene");

assert.throws(() => engine.dispatchMany({ ...clone(scene), version: 1 }, prepared.events), /Сцена изменилась|устарел/, "a stale ActionPlan is rejected at the reducer boundary");
assert.deepEqual(scene, before, "stale confirmation leaves the source Scene untouched");
const forgedCostEvent = clone(prepared.events[0]);
forgedCostEvent.payload.costs = [];
forgedCostEvent.payload.reservation = { schema: 1, sceneVersion: 0, actorId: "attacker", targetIds: ["target"], costs: [] };
assert.throws(() => engine.dispatchMany(scene, [forgedCostEvent]), /Цена или цели|ActionPlan|цена/i, "the event cannot lower the ActionPlan price");

const tooExpensive = engine.prepare(scene, {
  actorId: "attacker", eventId: "manual-plan-expensive", kind: "plan", actionId: "manual.attack", targetIds: ["target"],
  costs: [{ kind: "resource", resource: "focus", amount: 4 }],
  operations: [{ id: "expensive:attack", kind: "attack", targetIds: ["target"], amount: 1 }],
});
assert.equal(tooExpensive.ok, false);
assert.match(tooExpensive.errors.join(" "), /Недостаточно|цена/i);
assert.deepEqual(scene, before, "insufficient price is rejected before any payment");

scene = dispatch(scene, prepared);
const committedPlanId = scene.pendingAction.actionPlanId;
assert.equal(committedPlanId, "manual-plan-1");
assert.equal(scene.actors.find(item => item.id === "attacker").focus, 2, "the ActionPlan price is paid once");
assert.equal(scene.pendingAction.execution.status, "committed");
const pendingSave = clone(scene);
assert.throws(() => engine.dispatchMany(scene, [{ ...engine.command("attacker", { kind: "resolve-attack", planId: "wrong-plan" }), id: "wrong-resolve" }]), /другому ActionPlan/);
assert.throws(() => engine.dispatchMany(scene, [{ ...engine.command("attacker", { kind: "resolve-attack", planId: committedPlanId }), id: "early-resolve" }]), /Реакций/);
assert.throws(() => engine.dispatchMany(scene, [{ ...engine.command("attacker", { kind: "reaction", choice: "take", planId: committedPlanId }), id: "reaction" }]), /Недоступна|недоступна|Реакция/);
assert.equal(scene.actors.find(item => item.id === "attacker").focus, 2, "rejected reactions do not alter payment");

scene = engine.dispatchMany(scene, [{ ...engine.command("target", { kind: "reaction", choice: "take", planId: committedPlanId }), id: "reaction" }]).scene;
scene = engine.dispatchMany(scene, [{ ...engine.command("attacker", { kind: "resolve-attack", planId: committedPlanId }), id: "resolve" }]).scene;
assert.equal(scene.lionwing.choices[0].kind, "knockout", "damage continuation opens Resistance");
assert.equal(scene.lionwing.choices[0].context.actionPlanId, committedPlanId);
assert.throws(() => engine.dispatchMany(scene, [{ ...engine.command("target", { kind: "choice", id: scene.lionwing.choices[0].id, choice: "resist", planId: "wrong-plan" }), id: "wrong-choice" }]), /другому ActionPlan/);

const reloaded = clone(scene);
assert.equal(reloaded.pendingAction, null, "reaction window is closed before continuation");
const choice = reloaded.lionwing.choices[0];
scene = engine.dispatchMany(reloaded, [{ ...engine.command("target", { kind: "choice", id: choice.id, choice: "resist", planId: committedPlanId }), id: "resistance" }]).scene;
assert.equal(scene.lionwing.choices.length, 0);
assert.equal(scene.actors.find(item => item.id === "target").wounds, 1);
assert.equal(scene.actors.find(item => item.id === "target").hp, 11);

const replay = engine.dispatchMany(scene, prepared.events);
assert.deepEqual(replay.scene, scene, "repeating the original event ID is idempotent");
assert.equal(replay.events.length, 0);
assert.deepEqual(pendingSave.pendingAction.execution.planId, committedPlanId, "the saved pending descriptor survives reload");

console.log("LionWing manual Attack ActionPlan: preview, stale and price rejection, Reaction gate, Resistance continuation, JSON reload, replay and payment idempotency passed");

// Use the real dice reducer behind the UI controls, including cancellation.
vm.runInContext(fs.readFileSync(new URL("../network-v2.js", import.meta.url), "utf8"), context);
const uiSource = fs.readFileSync(new URL("../lionwing-ui.js", import.meta.url), "utf8");
const ui = { window: { DAWN_I18N: { t: key => key } }, Scene: fixture(), esc: String, uid: () => `dice-ui-${++ui.serial}`, serial: 0, lwOwns: () => true };
ui.window.confirm = () => true;
ui.lwSubmit = (actorId, payload) => {
  const prepared = engine.prepare(ui.Scene, { actorId, ...payload });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  ui.Scene = engine.dispatchMany(ui.Scene, prepared.events).scene;
  return true;
};
vm.createContext(ui);
vm.runInContext(uiSource.slice(uiSource.indexOf("function lwDiceHtml"), uiSource.indexOf("function lwStatusHtml")), ui);
const panel = { dataset: { lwActor: "attacker" }, querySelector: () => ({ value: "2" }) };
assert.equal(ui.lwDiceClick({ closest: () => panel, hasAttribute: () => true }), true);
const rollId = Object.keys(ui.Scene.lionwing.diceRolls)[0];
const dieId = ui.Scene.lionwing.diceRolls[rollId].dice[0].id;
const button = kind => ({ dataset: { lwDiceOp: kind }, hasAttribute: () => false, closest: selector => selector === "[data-lw-dice-panel]" ? panel : selector === "[data-lw-roll]" ? { dataset: { lwRoll: rollId } } : { dataset: { lwDie: dieId }, querySelector: () => ({ value: "5" }) } });
const beforeCancel = JSON.stringify(ui.Scene);
ui.window.confirm = () => false;
assert.equal(ui.lwDiceClick(button("change")), false);
assert.equal(JSON.stringify(ui.Scene), beforeCancel);
ui.window.confirm = () => true;
ui.lwDiceClick(button("change"));
assert.equal(ui.Scene.lionwing.diceRolls[rollId].dice[0].value, 5);
ui.lwDiceClick(button("lock"));
assert.equal(ui.Scene.lionwing.diceRolls[rollId].dice[0].locked, true);
assert.match(ui.lwDiceHtml(ui.Scene.actors[0]), /disabled/);
ui.lwDiceClick(button("unlock"));
ui.lwDiceClick(button("remove"));
assert.equal(ui.Scene.lionwing.diceRolls[rollId].dice[0].removed, true);
const network = context.window.DAWN_NETWORK_V2;
assert.throws(() => network.materializeIntent(fixture(), {}, { kind: "lionwing", actorId: "attacker", request: { kind: "plan", operations: [] } }), /Нарратор/);
const networkBase = fixture();
const networkPrepared = engine.prepare(networkBase, { actorId: "attacker", kind: "dice-create", pool: 2, rollId: "network-roll" });
const networkIntent = network.intentFromEvents(networkBase, networkPrepared.events, "Сетевой бросок");
assert.equal(networkIntent.request.pool, 2, "the player intent keeps the requested pool while discarding its local outcome");
const authoritativeEvents = network.materializeIntent(networkBase, {}, networkIntent, null);
const authoritative = engine.dispatchMany(networkBase, authoritativeEvents).scene.lionwing.diceRolls["network-roll"];
assert.equal(authoritative.pool, 2, "the authoritative materializer can create the requested persistent roll");
console.log("Persistent dice UI: create, cancel, change, lock/unlock, remove and Narrator plan boundary passed");
