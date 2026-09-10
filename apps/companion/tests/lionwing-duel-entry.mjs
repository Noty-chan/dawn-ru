import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
const engine = loadSceneEngine(context), lionwing = context.window.DAWN_LIONWING_ENGINE, adapters = context.window.DAWN_LIONWING_ADAPTERS, ids = engine.ACTION_IDS, duelId = "action.атаки.дуэль";
let serial = 0;
const hero = (extra = {}) => ({ id: "hero", name: "Star Student", kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x: 1, y: 1, hp: 16, maxHp: 16, ap: 3, baseAp: 3, focus: 8, influence: 3, wounds: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: { "ruiner.student-of-stars": 3 }, techniques: { "ruiner.student-of-stars": 3 }, lionwing: { automation: { "ruiner.student-of-stars.3": true }, history: [] }, ...extra });
const foe = () => ({ id: "foe", name: "Foe", kind: "enemy", rulesEdition: "lionwing", team: "enemy", space: "main", x: 2, y: 1, hp: 20, maxHp: 20, ap: 0, baseAp: 0, focus: 0, influence: 0, tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {} });
const scene = (actor, extra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 2, activeActorId: actor.id, lionwing: { activeTurnInstanceId: "turn:1" }, spaces: [{ id: "main", width: 7, height: 7 }], actors: [actor, foe()], objects: [], walls: [], markers: [], log: [], targetIds: [], ...extra });
const prepareAndCommit = (s, actorId, payload) => { const prepared = lionwing.prepare(s, { actorId, ...payload }); assert.equal(prepared.ok, true, prepared.errors?.join(" ")); return lionwing.dispatchMany(s, prepared.events).scene; };
const respond = (s, choice) => lionwing.dispatchMany(s, [{ id: `choice-${++serial}`, type: "lionwing.command", actorId: "hero", payload: { kind: "choice", id: s.lionwing.choices[0].id, choice } }]).scene;

let a = hero(), s = scene(a);
let quote = adapters.duelEntryQuote(a, { actionId: duelId, targetIds: ["foe"] });
assert.equal(quote.studentOfStars.advantage, 4, "even Focus spends all and grants half");
assert.deepEqual(Array.from(quote.options), ["moment-of-truth", "enter", "cancel"]);
assert.equal(lionwing.actionStatus(s, a, lionwing.actionDef(duelId), { targetIds: ["foe"] }).actionQuote.duelEntry.focusAtEntry, 8, "actionStatus publishes the same entry quote for the table");
s = prepareAndCommit(s, "hero", { kind: "action", actionId: duelId, targetIds: ["foe"] });
assert.equal(s.lionwing.choices[0].kind, "duel-entry");
assert.equal(s.actors[0].focus, 8, "choice window is unpaid");
const stale = JSON.parse(JSON.stringify(s)); stale.actors[0].focus = 7;
assert.throws(() => respond(stale, "moment-of-truth"), /устарело|изменились/, "entry cannot spend a forged or stale Focus amount");
s = respond(s, "moment-of-truth");
assert.equal(s.lionwing.duels[0].advantage, 4);
assert.equal(s.actors[0].focus, 0, "Moment Of Truth spends the authoritative entry snapshot");
assert.equal(s.lionwing.duels[0].entryQuote.studentFocusSpent, 8);
assert.equal(adapters.duelResolveQuote(s.actors[0], { duel: s.lionwing.duels[0], entryQuote: s.lionwing.duels[0].entryQuote }).advantage, 4, "resolve hook consumes the persisted quote");
assert.equal(s.lionwing.choices[0].context.advantage, 4, "resolved Advantage is persisted in the Duel outcome window");
assert.match(s.lionwing.choices[0].title, /Преимущество 4/);
const reloaded = lionwing.reload(JSON.parse(JSON.stringify(s)));
assert.equal(reloaded.lionwing.duels[0].entrySnapshot.initiator.focus, 8);

a = hero({ focus: 5 }); s = scene(a); quote = adapters.duelEntryQuote(a, { actionId: duelId, targetIds: ["foe"] });
assert.equal(quote.options.length, 0, "five Focus is below the canonical threshold");
s = prepareAndCommit(s, "hero", { kind: "action", actionId: duelId, targetIds: ["foe"] });
assert.equal(s.lionwing.duels.length, 1, "ordinary Duel enters without an optional technique window");

a = hero({ focus: 7 }); quote = adapters.duelEntryQuote(a, { actionId: duelId, targetIds: ["foe"] });
assert.equal(quote.studentOfStars.advantage, 4, "odd Focus uses the canonical ceil half bracket");
a = hero({ space: "inner-world-hero", knownTechniques: { "disruptor.inner-world": 3 }, techniques: { "disruptor.inner-world": 3 }, lionwing: { automation: { "disruptor.inner-world.3": true }, history: [] } });
quote = adapters.duelEntryQuote(a, { actionId: duelId, targetIds: ["foe"] });
assert.equal(quote.advantage, 1, "Home Turf adds Tier Advantage only in the owner's Inner World");
assert.equal(quote.modifiers[0].sourceDigest, "fb44b773e2eb1b59c5691f7f5f6b9a2b624f2b9d3cdcffe70ee98cd46a597dff");

a = hero(); s = scene(a); s = prepareAndCommit(s, "hero", { kind: "action", actionId: duelId, targetIds: ["foe"] });
const pendingId = s.lionwing.choices[0].id;
const cancelled = respond(s, "cancel");
assert.equal(cancelled.lionwing.duels?.length || 0, 0, "cancel does not enter or pay");
assert.equal(cancelled.actors[0].focus, 8);
assert.throws(() => lionwing.dispatchMany(s, [{ id: "forged", type: "lionwing.command", actorId: "hero", payload: { kind: "choice", id: pendingId, choice: "moment-of-truth", focusSpent: 1 } }]), /Решение устарело|Фокус|не принимает/);

console.log("LionWing Duel entry: trusted Focus snapshot, Moment Of Truth threshold/ceil, sources, cancel, reload and forged choice rejection passed");
