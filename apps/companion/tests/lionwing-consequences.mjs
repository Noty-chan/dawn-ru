import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
const engine = loadSceneEngine(context), lw = context.window.DAWN_LIONWING_ENGINE;
let serial = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const hero = (id, x, y) => ({
  id, name: id, kind: "hero", rulesEdition: "lionwing", team: "hero", heroId: id,
  space: "main", x, y, hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 10,
  influence: 3, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0,
  attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {},
  usedActions: [], acted: false, knockedOut: false,
});
const scene = () => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, tension: 0,
  activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [hero("hero", 1, 1), { ...hero("enemy", 3, 1), kind: "enemy", heroId: null, team: "enemy", hp: 20, maxHp: 20 }],
  objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [],
});
const runEvent = (current, actorId, payload, id = `consequence-test-${++serial}`) => lw.dispatchMany(current, [{ ...lw.command(actorId, payload), id }]);
const run = (current, actorId, payload, id) => runEvent(current, actorId, payload, id).scene;

// A normal KO has no lasting-consequence choice.  The Vulnerable KO belongs to
// the affected hero, awards Influence once, and does not reward a second hero.
let normal = scene();
normal.actors[0].wounds = 2;
normal = run(normal, "enemy", { kind: "wound", targetId: "hero" }, "ko:normal");
assert.equal(normal.lionwing.choices[0].kind, "knockout");
normal = run(normal, "hero", { kind: "choice", id: normal.lionwing.choices[0].id, choice: "accept" }, "ko:normal:accept");
assert.equal(normal.actors[0].knockedOut, true);
assert.equal(normal.lionwing.choices.some(item => item.kind === "consequence"), false, "ordinary KO does not open a consequence choice");
assert.equal(normal.actors[0].influence, 4, "the ordinary non-self-inflicted Wound still gives its normal Influence");

let vulnerable = scene();
vulnerable.actors.push(hero("ally", 5, 5));
vulnerable.actors[0].wounds = 2;
vulnerable.actors[0].lionwing = { vulnerable: true };
const koEvent = { ...lw.command("enemy", { kind: "wound", targetId: "hero" }), id: "ko:vulnerable" };
let committed = lw.dispatchMany(vulnerable, [koEvent]);
vulnerable = committed.scene;
assert.equal(vulnerable.actors.find(item => item.id === "hero").influence, 6, "Vulnerable KO gives 3 Influence to the KOed hero");
assert.equal(vulnerable.actors.find(item => item.id === "ally").influence, 3, "an ally receives no KO Influence");
const choice = vulnerable.lionwing.choices[0];
assert.equal(choice.kind, "consequence");
assert.deepEqual(clone(choice.options), ["skill-ranks", "ability-part", "boon", "technique-levels", "death"]);
assert.equal(choice.context.reason, "vulnerable-knockout");
assert.throws(() => run(vulnerable, "hero", { kind: "choice", id: choice.id, choice: "record", note: "обход" }, "choice:record:bypass"), /старого сохранения|устарело/);
assert.throws(() => run(vulnerable, "hero", { kind: "choice", id: choice.id, choice: "boon", lossTarget: { kind: "skill", id: "athletics" } }, "choice:wrong-target"), /Тип цели/);

const typedChoiceEvent = {
  ...lw.command("hero", {
    kind: "choice",
    id: choice.id,
    choice: "boon",
    lossTarget: { kind: "boon", id: "outlook-oath" },
    note: "Вручную убрать Дар из листа героя",
  }),
  id: "choice:boon",
};
vulnerable = lw.dispatchMany(vulnerable, [typedChoiceEvent]).scene;
const typed = vulnerable.actors.find(item => item.id === "hero").lionwing.consequences;
assert.equal(typed.length, 1);
assert.deepEqual(clone(typed[0]), {
  schema: 1,
  id: `${choice.id}:consequence:boon`,
  category: "boon",
  lossTarget: { kind: "boon", id: "outlook-oath" },
  target: { kind: "boon", id: "outlook-oath" },
  choiceId: choice.id,
  reason: "vulnerable-knockout",
  status: "pending-manual",
  applied: false,
  sceneSerial: 1,
  createdEventId: "choice:boon",
  manualNote: "Вручную убрать Дар из листа героя",
});
assert.equal(vulnerable.actors.find(item => item.id === "hero").influence, 6, "choosing a consequence has no additional price");
assert.deepEqual(clone(lw.consequenceStatus(vulnerable, "hero").availableCategories), ["skill-ranks", "ability-part", "technique-levels", "death"]);

// A JSON reload keeps the typed record and the category guard.  Replaying the
// original KO event is idempotent and cannot award Influence twice.
const reloaded = lw.reload(clone(vulnerable));
assert.deepEqual(clone(reloaded.actors[0].lionwing.consequences), clone(typed));
const replayed = lw.dispatchMany(reloaded, [koEvent]);
assert.equal(replayed.events.length, 0);
assert.equal(replayed.scene.actors[0].influence, 6);
assert.equal(replayed.scene.actors[0].lionwing.consequences.length, 1);

// Scene reset clears Vulnerability and KO state while preserving the lasting
// record.  The next KO cannot select the same category again.
vulnerable = run(vulnerable, null, { kind: "scene-reset" }, "reset:consequence");
assert.equal(vulnerable.actors[0].lionwing.vulnerable, undefined);
assert.equal(vulnerable.actors[0].lionwing.consequences.length, 1);
vulnerable = run(vulnerable, "hero", { kind: "correct", targetId: "hero", resource: "vulnerable", amount: 1 }, "correct:vulnerable");
vulnerable = run(vulnerable, "enemy", { kind: "wound", targetId: "hero" }, "ko:vulnerable:again");
const secondChoice = vulnerable.lionwing.choices[0];
assert.ok(!secondChoice.options.includes("boon"), "a category cannot be selected twice for one hero");
assert.throws(() => run(vulnerable, "hero", { kind: "choice", id: secondChoice.id, choice: "boon" }, "choice:boon:repeat"), /категория|последствие уже выбрано|устарело/);

// A correction through the command boundary marks manual application and records
// the concrete loss. Role authorization is enforced by the UI/network boundary.
// it does not silently delete anything from the hero sheet.
const recordId = vulnerable.actors[0].lionwing.consequences[0].id;
vulnerable.actors[0].gifts = ["outlook-oath"];
vulnerable = run(vulnerable, "hero", {
  kind: "correct", targetId: "hero", resource: "consequence", consequenceId: recordId,
  operation: "apply", lossTarget: { kind: "boon", id: "outlook-oath" }, correctionNote: "Дар снят после проверки листа",
}, "correct:consequence");
const corrected = vulnerable.actors[0].lionwing.consequences[0];
assert.equal(corrected.status, "applied");
assert.equal(corrected.applied, true);
assert.equal(corrected.correctedEventId, "correct:consequence");
assert.deepEqual(clone(vulnerable.actors[0].gifts), ["outlook-oath"], "the engine never removes a Gift without a preview contract");

// The old saved record-only window remains valid.  Its free note is stored as
// a separate historical record and is never interpreted as a category.
let legacy = scene();
legacy.lionwing = { choices: [{ id: "legacy:choice", actorId: "hero", kind: "consequence", title: "Старое окно", options: ["record"], context: {} }] };
legacy = run(legacy, "hero", { kind: "choice", id: "legacy:choice", choice: "record", note: "Старое решение без категории" }, "legacy:record");
assert.equal(legacy.actors[0].lionwing.consequences.length, 0);
assert.deepEqual(clone(legacy.actors[0].lionwing.legacyNotes.map(item => ({ type: item.type, note: item.note, choiceId: item.choiceId })),), [{ type: "legacy-note", note: "Старое решение без категории", choiceId: "legacy:choice" }]);

console.log("LionWing consequence persistence: typed categories, single-use history, legacy record, reload/replay, reset and Narrator correction passed");
