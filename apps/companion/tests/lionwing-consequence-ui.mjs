import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const engineContext = { window: {}, console };
vm.createContext(engineContext);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), engineContext, { filename: file });
}
const loadEngine = loadSceneEngine(engineContext), lw = engineContext.window.DAWN_LIONWING_ENGINE;
const clone = value => JSON.parse(JSON.stringify(value));
let eventSerial = 0;

const hero = (id = "hero", extra = {}) => ({
  id, name: "Львиное крыло", kind: "hero", rulesEdition: "lionwing", team: "hero", heroId: id,
  space: "main", x: 1, y: 1, hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 8,
  influence: 3, wounds: 2, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false,
  skills: [{ id: "athletics", name: "Атлетика", rank: 2 }],
  ability: {
    id: "ability-main", name: "Искра", enabled: true,
    words: { verbs: ["protect"], nouns: ["ally"], conditions: ["danger"] },
    specializations: { "ally": "защищать союзников" },
  },
  gifts: ["gift-hope"],
  knownTechniques: { "powerhouse.breacher": 2 }, techniques: { "powerhouse.breacher": 2 },
  lionwing: { vulnerable: true, automation: {} },
  ...extra,
});
const scene = () => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0,
  activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [hero(), { ...hero("enemy"), name: "Противник", kind: "enemy", team: "enemy", heroId: null, hp: 20, maxHp: 20, wounds: 0, lionwing: {} }],
  objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [],
});
const run = (current, actorId, payload, id = `consequence-ui:${++eventSerial}`) => loadEngine.dispatchMany(current, [{ ...lw.command(actorId, payload), id }]).scene;

// Evaluate only the presentation adapter added for the consequence window. It
// uses the real engine object and the real scene projection below.
const source = fs.readFileSync(new URL("../lionwing-ui.js", import.meta.url), "utf8");
const start = source.indexOf("const lwConsequenceFallbackCategories");
const end = source.indexOf("function lwPendingHtml", start);
assert.ok(start >= 0 && end > start, "consequence presentation adapter is present");
const uiContext = {
  window: { DAWN_I18N: { t: key => key }, DAWN_LIONWING_ENGINE: lw },
  console,
  LionwingEngine: lw,
  Scene: null,
  Sync: { state: () => ({ sceneId: "shared", canNarrate: false }) },
  lwCanNarrate: () => false,
  lwOwns: actorId => actorId === "hero",
  esc: value => String(value ?? "").replace(/[&<>"']/gu, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]),
};
vm.createContext(uiContext);
vm.runInContext(source.slice(start, end), uiContext, { filename: "lionwing-ui.js consequence adapter" });
const renderPending = (current, canNarrate = false) => {
  uiContext.Scene = current;
  uiContext.Sync = { state: () => ({ sceneId: "shared", canNarrate }) };
  uiContext.lwCanNarrate = () => canNarrate;
  const choice = current.lionwing.choices[0], owner = current.actors.find(actor => actor.id === choice.actorId);
  return { choice, owner, html: vm.runInContext("lwConsequencePendingHtml(choice, owner)", Object.assign(uiContext, { choice, owner })) };
};
const renderHistory = (current, canNarrate = false) => {
  uiContext.Scene = current;
  uiContext.Sync = { state: () => ({ sceneId: "shared", canNarrate }) };
  uiContext.lwCanNarrate = () => canNarrate;
  const actor = current.actors.find(item => item.id === "hero");
  return vm.runInContext("lwConsequenceHistoryHtml(actor)", Object.assign(uiContext, { actor }));
};

let pending = scene();
pending.actors[0].wounds = 2;
pending = run(pending, "enemy", { kind: "wound", targetId: "hero" }, "ko:ui");
assert.equal(pending.lionwing.choices[0].kind, "consequence");
const reloadedPending = lw.reload(clone(pending));
const pendingView = renderPending(reloadedPending);
assert.equal((pendingView.html.match(/class="lw-consequence-category/gu) || []).length, 5, "the window shows all five stable categories");
assert.match(pendingView.html, /Атлетика/gu, "the Skill category offers a concrete populated-sheet target");
assert.match(pendingView.html, /−2 Уровня/gu, "the Technique category offers a concrete populated-sheet target");
assert.match(pendingView.html, /data-lw-consequence-target-index/gu, "a category choice carries a concrete target index");
assert.doesNotMatch(pendingView.html, /data-lw-consequence-correct/gu, "the player window has no narrator correction controls");
const narratorPendingView = renderPending(reloadedPending, true);
assert.doesNotMatch(narratorPendingView.html, /data-lw-choice=/gu, "the Narrator cannot answer the player's consequence window");
assert.match(narratorPendingView.html, /Ожидается решение владельца героя/gu, "the Narrator sees the ownership handoff");

renderPending(reloadedPending);
const typedPayload = vm.runInContext("lwConsequenceChoicePayload(choice, owner, 'boon', 0, 'Вручную убрать Дар из листа')", Object.assign(uiContext, { choice: pendingView.choice, owner: pendingView.owner }));
assert.deepEqual(clone(typedPayload), {
  kind: "choice", id: pendingView.choice.id, choice: "boon",
  lossTarget: { kind: "boon", id: "gift-hope" }, note: "Вручную убрать Дар из листа",
}, "the player payload includes the exact typed loss target");

const recorded = run(reloadedPending, "hero", typedPayload, "choice:boon:ui");
const record = recorded.actors.find(actor => actor.id === "hero").lionwing.consequences[0];
assert.equal(record.status, "pending-manual");
assert.deepEqual(clone(record.lossTarget), { kind: "boon", id: "gift-hope" });
const history = renderHistory(lw.reload(clone(recorded)));
assert.match(history, /Использованные категории/gu, "history names used categories");
assert.match(history, /ожидает ручного применения/gu, "history exposes pending-manual state");
assert.match(history, /Осталось вручную/gu, "history explains the concrete manual remainder");
assert.match(history, /gift-hope/gu, "history retains the concrete selected target");
assert.match(history, /Вручную убрать Дар из листа/gu, "history retains the player's manual note");

const narratorHistory = renderHistory(recorded, true);
assert.match(narratorHistory, /data-lw-consequence-correct="apply"/gu, "only narrator view exposes the correction boundary");
assert.match(narratorHistory, /data-lw-consequence-correction-target/gu, "narrator correction can restate a concrete target");
assert.match(narratorHistory, /лист героя автоматически не изменяется/gu, "correction is an explicit status change, not silent sheet mutation");

const corrected = run(recorded, "hero", {
  kind: "correct", targetId: "hero", resource: "consequence", consequenceId: record.id,
  operation: "apply", lossTarget: { kind: "boon", id: "gift-hope" }, correctionNote: "Дар снят после проверки листа",
}, "correct:consequence:ui");
const correctedRecord = corrected.actors.find(actor => actor.id === "hero").lionwing.consequences[0];
assert.equal(correctedRecord.status, "applied");
assert.equal(correctedRecord.applied, true);
assert.match(renderHistory(corrected, true), /применено/gu, "history reflects the explicit narrator correction");
assert.deepEqual(clone(corrected.actors.find(actor => actor.id === "hero").gifts), ["gift-hope"], "the UI contract never auto-removes a sheet item");

console.log("LionWing consequence UI: five categories, populated targets, player ownership, pending manual history, reload and narrator correction passed");
