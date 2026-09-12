import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console, Date };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context), lionwing = context.window.DAWN_LIONWING_ENGINE;
let serial = 0;
const hero = (extra = {}) => ({ id: "hero", name: "Unbroken", kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x: 1, y: 1, hp: 10, maxHp: 10, ap: 3, baseAp: 3, focus: 2, influence: 2, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: { "powerhouse.unbroken": 3 }, techniques: { "powerhouse.unbroken": 3 }, lionwing: { automation: { "powerhouse.unbroken.1": true, "powerhouse.unbroken.3": true }, history: [] }, ...extra });
const foe = () => ({ id: "foe", name: "Foe", kind: "enemy", rulesEdition: "lionwing", team: "enemy", space: "main", x: 3, y: 1, hp: 20, maxHp: 20, ap: 0, baseAp: 0, focus: 0, influence: 0, wounds: 0, stress: 0, tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {} });
const scene = (extra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: null, spaces: [{ id: "main", width: 7, height: 7 }], actors: [hero(), foe()], objects: [], walls: [], markers: [], log: [], targetIds: [], ...extra });
const run = (s, actorId, payload) => lionwing.dispatchMany(s, [{ ...lionwing.command(actorId, payload), id: `unbroken-${++serial}` }]).scene;
const knockOutChoice = (s, choice) => run(s, "hero", { kind: "choice", id: s.lionwing.choices[0].id, choice });
const trigger = (s, extra = {}) => run({ ...s, actors: s.actors.map(a => a.id === "hero" ? { ...a, hp: 0, wounds: 2, ...extra } : a) }, "foe", { kind: "wound", targetId: "hero", sourceActorId: "foe" });

let s = trigger(scene());
assert.equal(s.lionwing.choices[0].kind, "knockout");
assert.equal(JSON.stringify(s.lionwing.choices[0].options), JSON.stringify(["get-back-up", "resist", "accept"]), "Get Back Up is offered before ordinary Resist");
const publicLogWound = engine.projectScene(s, { role: "player", actorIds: ["hero"] }).log.find(event => event.type === "actor.wound");
assert.equal("hp" in publicLogWound.payload, false, "public Wound log does not disclose private Health");
const offered = JSON.parse(JSON.stringify(s));
s = knockOutChoice(s, "get-back-up");
assert.equal(s.actors[0].knockedOut, false);
assert.equal(s.actors[0].influence, 2);
assert.equal(s.actors[0].wounds, 1);
assert.equal(s.actors[0].lionwing.vulnerable, false);
assert.equal(s.lionwing.choices[0].kind, "unbroken-phoenix");
assert.equal("hp" in offered.lionwing.choices[0].context.getBackUp.snapshot, false, "Get Back Up pending context omits private Health");
assert.deepEqual(s.actors[0].lionwing.history.find(item => item.ruleId === "powerhouse.unbroken.1")?.sourceDigest, "52ba0087d2a15fd28046b031145f0604f7ef83c4bbdfce709c77d39ea167bda1");
s = run(s, "hero", { kind: "choice", id: s.lionwing.choices[0].id, choice: "phoenix" });
assert.equal(s.actors[0].wounds, 1, "Phoenix sets Wounds to exactly one");
const phoenixEvent = s.log.find(event => event.type === "technique.resolve" && event.payload?.ruleId === "powerhouse.unbroken.3");
assert.ok(phoenixEvent);
assert.equal("hp" in phoenixEvent.payload, false, "Phoenix public event does not disclose private Health");

// The same chapter cannot offer the option twice, while a new chapter can.
s = trigger(scene({ actors: s.actors.map(a => a.id === "hero" ? { ...a, lionwing: { ...a.lionwing, unbrokenGetBackUpChapter: 1 } } : a) }));
assert.equal(JSON.stringify(s.lionwing.choices[0].options), JSON.stringify(["resist", "accept"]));
s = trigger(scene({ lionwing: { chapterSerial: 2, sceneSerial: 2 }, actors: [hero({ ...s.actors[0], hp: 0, wounds: 2, knockedOut: false, lionwing: { ...s.actors[0].lionwing, unbrokenGetBackUpChapter: 1 } }), foe()] }));
assert.ok(s.lionwing.choices[0].options.includes("get-back-up"), "chapter start reopens the limit");

// Stale/replayed offers cannot spend a changed balance or be answered by the target.
let stale = trigger(scene());
stale.actors[0].influence = 1;
assert.throws(() => knockOutChoice(stale, "get-back-up"), /устарело|лимит|недоступно/i);
let forgedTrack = trigger(scene());
forgedTrack.lionwing.choices[0].context.getBackUp.snapshot.track = "influence";
assert.throws(() => knockOutChoice(forgedTrack, "get-back-up"), /устарело|лимит|недоступно/i);
let replay = trigger(scene({ actors: [hero({ knownTechniques: { "powerhouse.unbroken": 1 }, techniques: { "powerhouse.unbroken": 1 }, lionwing: { automation: { "powerhouse.unbroken.1": true }, history: [] } }), foe()] }));
const replayChoiceId = replay.lionwing.choices[0].id;
replay = run(replay, "hero", { kind: "choice", id: replayChoiceId, choice: "get-back-up" });
assert.throws(() => run(replay, "hero", { kind: "choice", id: replayChoiceId, choice: "get-back-up" }), /устарело|принадлежит другому/i);
let foreign = trigger(scene());
assert.throws(() => run(foreign, "foe", { kind: "choice", id: foreign.lionwing.choices[0].id, choice: "get-back-up" }), /принадлежит другому/i);

// A scene reload retains the pending choice, and decline remains a manual fallback.
let reloaded = lionwing.reload(JSON.parse(JSON.stringify(offered)));
reloaded = knockOutChoice(reloaded, "resist");
assert.equal(reloaded.actors[0].lionwing.vulnerable, true);
assert.equal(reloaded.actors[0].influence, 3);

// A Get Back Up lock blocks every ordinary Influence gain until the next Scene.
let locked = trigger(scene());
locked = knockOutChoice(locked, "get-back-up");
locked = run(locked, "hero", { kind: "choice", id: locked.lionwing.choices[0].id, choice: "skip" });
const before = locked.actors[0].influence;
locked = run(locked, "foe", { kind: "wound", targetId: "hero", sourceActorId: "foe" });
assert.equal(locked.actors[0].influence, before, "wound Influence is suppressed after Get Back Up");
assert.ok(locked.log.some(event => event.type === "resource.gain.prevented" && event.actorId === "hero"));

// Phoenix is only reachable through the confirmed Get Back Up continuation.
assert.throws(() => run(scene(), "hero", { kind: "choice", id: "forged", choice: "phoenix" }), /устарело|Решение|другому/i);
console.log("LionWing Unbroken I/III: canonical Get Back Up → Phoenix, chapter limit, stale/reload/ownership, cancel fallback and Influence lock passed");
