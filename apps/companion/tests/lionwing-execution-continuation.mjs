import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE;
const clone = value => JSON.parse(JSON.stringify(value));

const hero = (id, { hp = 16, wounds = 0, x = 1, y = 1 } = {}) => ({
  id,
  name: id,
  kind: "hero",
  heroId: id,
  rulesEdition: "lionwing",
  team: "hero",
  space: "main",
  x,
  y,
  hp,
  maxHp: 16,
  ap: 3,
  baseAp: 3,
  focus: 3,
  influence: 3,
  wounds,
  stress: 0,
  tier: 1,
  speed: 4,
  armor: 0,
  evasion: 0,
  attrs: { body: 4, talent: 3, spirit: 2, mind: 2 },
  effects: [],
  effectStates: {},
  usedActions: [],
  acted: false,
  knockedOut: false,
});

const fixture = () => ({
  rulesEdition: "lionwing",
  version: 0,
  round: 1,
  turnSerial: 1,
  tension: 0,
  activeActorId: null,
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [hero("h", { hp: 1, wounds: 2 }), hero("h2", { hp: 1, wounds: 2, y: 3 }), { ...hero("e", { x: 3 }), kind: "enemy", heroId: null, team: "enemy", hp: 16, maxHp: 16 }],
  objects: [],
  walls: [],
  markers: [],
  log: [],
  targetIds: [],
  reminders: [],
  rollFeed: [],
});

let serial = 0;
const event = (actorId, payload, id = `continuation-${++serial}`) => ({ ...engine.command(actorId, payload), id });
const run = (scene, actorId, payload, id) => engine.dispatchMany(scene, [event(actorId, payload, id)]).scene;
const answer = (scene, actorId, id, choice, eventId) => run(scene, actorId, { kind: "choice", id, choice }, eventId);

const plan = {
  kind: "plan",
  costs: [{ kind: "health", amount: 1 }, { kind: "resource", resource: "focus", amount: 1 }],
  targetIds: ["e"],
  operations: [
    { kind: "damage", targetId: "e", amount: 2, irreducible: true },
    { kind: "damage", targetId: "h2", amount: 16, irreducible: true },
    { kind: "resource", targetId: "h", resource: "focus", operation: "gain", amount: 1 },
  ],
};

let scene = fixture();
const prepared = engine.prepare(scene, { actorId: "h", ...plan });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
scene = engine.dispatchMany(scene, prepared.events).scene;
const firstChoice = scene.lionwing.choices[0];
assert.equal(firstChoice.kind, "knockout", "Health payment opens the first Resistance choice");
assert.equal(firstChoice.actorId, "h");
assert.equal(scene.actors[0].hp, 16);
assert.equal(scene.actors[0].wounds, 2);
assert.equal(scene.actors[0].focus, 2, "the compound cost is reserved and paid once before waiting");
assert.equal(scene.actors[2].hp, 16, "the first deferred operation waits behind the payment choice");
assert.equal(scene.lionwing.deferred.length, 3);
assert.equal(scene.lionwing.executionCursor.status, "waiting");
assert.equal(scene.lionwing.executionCursor.waitingChoiceId, firstChoice.id);
assert.equal(scene.lionwing.executionCursor.cursor, 1);
assert.equal(scene.lionwing.executionCursor.total, 4);
assert.equal(scene.lionwing.executionCursor.responderActorId, "h");
JSON.stringify(scene.lionwing.executionCursor);
JSON.stringify(scene.lionwing.deferred);

const forged = clone(scene);
forged.lionwing.choices[0].id = "forged-choice";
assert.throws(
  () => answer(forged, "h", "forged-choice", "resist"),
  /курсора|соответствует|ожидающ/,
  "a same-actor choice from a merged state cannot consume this continuation",
);
assert.throws(
  () => answer(clone(scene), "e", firstChoice.id, "resist"),
  /устарело|другому участнику/,
  "a foreign actor cannot answer the pending choice",
);
const responderForged = clone(scene);
responderForged.lionwing.choices[0].actorId = "e";
assert.throws(
  () => answer(responderForged, "e", firstChoice.id, "resist"),
  /курсора|соответствует|ожидающ/,
  "changing the responder in a merged state cannot bypass the cursor owner",
);
const missingResponder = clone(scene);
missingResponder.actors = missingResponder.actors.filter(actor => actor.id !== "h");
assert.throws(
  () => answer(missingResponder, "h", firstChoice.id, "resist"),
  /отсутствует/,
  "a removed responder cannot resume a saved continuation",
);

// app-core sceneCore is the storage normalizer. It copies the authoritative
// LionWing record wholesale; exercise that reload boundary without changing
// app-core.js in this slice.
const appContext = {
  console,
  crypto: { randomUUID: () => "normalized-id" },
  APP_SCHEMA: 14,
  contentPreferences: { edition: "ru-v0.9" },
  uid: () => "normalized-id",
  clamp: (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0)),
  cleanArray: value => Array.isArray(value) ? value.filter(item => typeof item === "string") : [],
};
vm.createContext(appContext);
const appSource = fs.readFileSync(new URL("../app-core.js", import.meta.url), "utf8");
const appFunctions = appSource.slice(appSource.indexOf("function blankScene()"), appSource.indexOf("function normalizeScene(raw)"));
vm.runInContext(appFunctions, appContext, { filename: "app-core.scene-normalizer.js" });
const normalizeThroughApp = value => vm.runInContext(`sceneCore(${JSON.stringify(value)})`, appContext);
const reloaded = normalizeThroughApp(clone(scene));
assert.equal(reloaded.lionwing.executionCursor.waitingChoiceId, firstChoice.id);
assert.equal(reloaded.lionwing.deferred.length, 3);
assert.equal(reloaded.lionwing.executionCursor.responderActorId, "h");

const firstAnswerEventId = "continuation-answer-first";
let afterFirst = answer(reloaded, "h", firstChoice.id, "resist", firstAnswerEventId);
assert.equal(afterFirst.actors[2].hp, 14);
assert.equal(afterFirst.lionwing.choices.length, 1);
const secondChoice = afterFirst.lionwing.choices[0];
assert.equal(secondChoice.kind, "knockout", "the next consequence waits for its own Resistance choice");
assert.equal(secondChoice.actorId, "h2");
assert.equal(afterFirst.lionwing.deferred.length, 1);
assert.equal(afterFirst.lionwing.executionCursor.status, "waiting");
assert.equal(afterFirst.lionwing.executionCursor.waitingChoiceId, secondChoice.id);
assert.equal(afterFirst.lionwing.executionCursor.responderActorId, "h2");
assert.equal(afterFirst.lionwing.executionCursor.cursor, 3);
assert.equal(afterFirst.lionwing.executionCursor.total, 4);
assert.equal(afterFirst.actors[1].hp, 16);

const replay = engine.dispatchMany(afterFirst, [event("h", { kind: "choice", id: firstChoice.id, choice: "resist" }, firstAnswerEventId)]);
assert.deepEqual(replay.scene, afterFirst, "repeating an acknowledged answer does not resume the queue again");
assert.equal(replay.events.length, 0);
assert.throws(
  () => answer(clone(afterFirst), "h", firstChoice.id, "resist", "stale-choice-after-resume"),
  /устарело|другому участнику/,
);
assert.throws(
  () => answer(clone(afterFirst), "e", secondChoice.id, "resist", "foreign-choice-after-resume"),
  /устарело|другому участнику/,
);

const final = answer(afterFirst, "h2", secondChoice.id, "resist", "continuation-answer-second");
assert.equal(final.actors[0].hp, 16);
assert.equal(final.actors[0].wounds, 1);
assert.equal(final.actors[0].focus, 3, "the deferred tail applies once after both responses");
assert.equal(final.actors[1].hp, 16);
assert.equal(final.actors[1].wounds, 1);
assert.equal(final.actors[1].hp, 16);
assert.equal(final.lionwing.choices.length, 0);
assert.equal(final.lionwing.deferred.length, 0);
assert.equal(final.lionwing.executionCursor, undefined, "a completed cursor is cleared with an empty tail");
assert.equal(final.log.filter(row => row.type === "resource.gain" && row.payload.resource === "focus").length, 1);
assert.equal(final.log.filter(row => row.type === "damage.apply" && row.payload.targetId === "e").length, 1);
assert.equal(final.log.filter(row => row.type === "damage.apply" && row.payload.targetId === "h2").length, 1);

// Existing saves without the new companion record still resume through the
// established deferred queue and acquire a cursor at the response boundary.
const legacyWaiting = clone(scene);
delete legacyWaiting.lionwing.executionCursor;
const legacyFinal = answer(legacyWaiting, "h", firstChoice.id, "resist", "legacy-continuation-answer");
assert.equal(legacyFinal.actors[2].hp, 14);
assert.equal(legacyFinal.lionwing.choices[0].actorId, "h2");

// A source that is no longer a persisted actor remains valid cursor metadata.
const removedAuthor = clone(scene);
delete removedAuthor.lionwing.executionCursor;
for (const item of removedAuthor.lionwing.deferred) {
  if (item.provenance) item.provenance.ownerActorId = "removed-author";
}
const removedFinal = answer(removedAuthor, "h", firstChoice.id, "resist", "removed-author-answer");
assert.equal(removedFinal.actors[2].hp, 14);

let sceneAuthored = fixture();
sceneAuthored = run(sceneAuthored, null, {
  kind: "batch",
  operations: [
    { kind: "damage", targetId: "h", amount: 16, irreducible: true },
    { kind: "resource", targetId: "h", resource: "focus", operation: "gain", amount: 1 },
  ],
}, "scene-authored-continuation");
assert.equal(sceneAuthored.lionwing.executionCursor.ownerActorId, "scene");
sceneAuthored = answer(sceneAuthored, "h", sceneAuthored.lionwing.choices[0].id, "resist", "scene-authored-answer");
assert.equal(sceneAuthored.actors[0].focus, 4);
assert.equal(sceneAuthored.lionwing.executionCursor, undefined);

const malformed = clone(scene);
malformed.lionwing.executionCursor.cursor = 99;
assert.throws(() => answer(malformed, "h", firstChoice.id, "resist", "malformed-cursor"), /курсор/);
const unsupported = clone(scene);
unsupported.lionwing.executionCursor.schema = 9;
assert.throws(() => answer(unsupported, "h", firstChoice.id, "resist", "unsupported-cursor"), /курсор/);

// A final choice without a queued tail must not leave a completed cursor.
let noTail = fixture();
noTail = run(noTail, "e", { kind: "damage", targetId: "h", amount: 16, irreducible: true });
assert.equal(noTail.lionwing.choices[0].kind, "knockout");
assert.equal(noTail.lionwing.executionCursor, undefined);
noTail = answer(noTail, "h", noTail.lionwing.choices[0].id, "resist", "no-tail-answer");
assert.equal(noTail.lionwing.executionCursor, undefined);

console.log("LionWing execution continuation: Health payment, serialized cursor, two Consequences, reload, ownership, replay and empty-tail cleanup passed");
