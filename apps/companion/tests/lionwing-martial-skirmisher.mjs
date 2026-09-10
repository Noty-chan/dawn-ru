import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console, Date };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context), lionwing = context.window.DAWN_LIONWING_ENGINE, adapters = context.window.DAWN_LIONWING_ADAPTERS;
const ids = engine.ACTION_IDS;
const hero = (techniques = {}, extra = {}) => ({ id: "h", name: "Hero", kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x: 2, y: 2, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 6, influence: 0, tier: 2, speed: 4, armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: techniques, techniques, lionwing: { automation: Object.fromEntries(Object.keys(techniques).map(id => [`${id}.1`, true])) }, ...extra });
const foe = (id, x = 3, y = 2) => ({ id, name: id, kind: "enemy", rulesEdition: "lionwing", team: "enemy", space: "main", x, y, hp: 20, maxHp: 20, ap: 0, baseAp: 0, focus: 0, influence: 0, tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {} });
const scene = (actors, extra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: "h", lionwing: { activeTurnInstanceId: "turn:1" }, spaces: [{ id: "main", width: 8, height: 8 }], actors, objects: [], walls: [], markers: [], log: [], targetIds: [], ...extra });
const enable = (actor, ids) => { actor.lionwing.automation = Object.fromEntries(ids.map(id => [id, true])); return actor; };
const dispatch = (s, event) => lionwing.dispatchMany(s, [event], { random: () => 0.8 }).scene;

let h = enable(hero({ "powerhouse.martial-artist": 3 }), ["powerhouse.martial-artist.1", "powerhouse.martial-artist.2", "powerhouse.martial-artist.3"]), s = scene([h, foe("e")]);
let prepared = lionwing.prepare(s, { actorId: "h", kind: "action", actionId: ids.skirmish, targetIds: ["e"], attribute: "body" }, { random: () => 0.8 });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
s = lionwing.dispatchMany(s, prepared.events, { random: () => 0.8 }).scene;
assert.ok(s.pendingAction, "Skirmish enters common attack pipeline");
s = dispatch(s, { id: "react", type: "lionwing.command", actorId: "e", payload: { kind: "reaction", choice: "take" } });
s = dispatch(s, { id: "resolve", type: "lionwing.command", actorId: "h", payload: { kind: "resolve-attack" } });
assert.ok(s.lionwing.choices[0], "successful attack offers Art Of The 8 Hammers");
assert.ok(s.lionwing.choices[0].options.some(id => id.startsWith("binding-blow:")), "Hammers expose an effect choice");
const hammersChoice = s.lionwing.choices[0], binding = hammersChoice.options.find(id => id.startsWith("binding-blow:"));
s = dispatch(s, { id: "hammer-choice", type: "lionwing.command", actorId: "h", payload: { kind: "choice", id: hammersChoice.id, choice: binding } });
assert.ok(s.actors.find(a => a.id === "e").effects.includes("negative.пойман"), "Binding Blow uses the typed effect pipeline");
assert.ok(s.lionwing.choices[0], "Flow State follows the selected Hammer");
const flowChoice = s.lionwing.choices[0], bodyFlow = flowChoice.options.find(id => id.startsWith("body:e"));
s = dispatch(s, { id: "flow-choice", type: "lionwing.command", actorId: "h", payload: { kind: "choice", id: flowChoice.id, choice: bodyFlow } });
assert.ok(s.actors.find(a => a.id === "e").hp < 20, "Flow State damage resolves through damage pipeline");

h = enable(hero({ "powerhouse.martial-artist": 1, "powerhouse.dragonslayer": 1 }), ["powerhouse.martial-artist.1"]); s = scene([h, foe("weapon-foe")]);
prepared = lionwing.prepare(s, { actorId: "h", kind: "action", actionId: ids.skirmish, targetIds: ["weapon-foe"], attribute: "body", techniqueIds: ["powerhouse.dragonslayer.1"] }, { random: () => 0.8 });
assert.equal(prepared.ok, true, prepared.errors?.join(" ")); s = lionwing.dispatchMany(s, prepared.events, { random: () => 0.8 }).scene;
s = dispatch(s, { id: "weapon-react", type: "lionwing.command", actorId: "weapon-foe", payload: { kind: "reaction", choice: "take" } });
s = dispatch(s, { id: "weapon-resolve", type: "lionwing.command", actorId: "h", payload: { kind: "resolve-attack" } });
assert.equal(s.lionwing.choices.length, 0, "Art Of The 8 Hammers is unavailable for a trusted weapon Technique");

h = enable(hero({ "vagabond.skirmisher": 1 }), ["vagabond.skirmisher.1"]); s = scene([h, foe("e", 4, 2)]);
prepared = lionwing.prepare(s, { actorId: "h", kind: "action", actionId: ids.step, destination: { x: 3, y: 2 } }, { random: () => 0.8 });
assert.equal(prepared.ok, true, prepared.errors?.join(" ")); s = lionwing.dispatchMany(s, prepared.events, { random: () => 0.8 }).scene;
assert.ok(s.lionwing.choices[0], "Stride exposes Sting choice");
const sting = s.lionwing.choices[0]; s = dispatch(s, { id: "sting", type: "lionwing.command", actorId: "h", payload: { kind: "choice", id: sting.id, choice: sting.options.find(id => id.startsWith("jab:")) } });
assert.equal(s.actors.find(a => a.id === "e").hp, 18, "Jab uses fixed ceil(Talent/2) damage");
const reloaded = lionwing.reload(JSON.parse(JSON.stringify(s))); assert.deepEqual(reloaded.actors, s.actors, "Jab state survives reload");
assert.equal(lionwing.dispatchMany(reloaded, [{ id: "sting", type: "lionwing.command", actorId: "h", payload: { kind: "choice", id: sting.id, choice: sting.options.find(id => id.startsWith("jab:")) } }], { random: () => 0.8 }).scene.version, reloaded.version, "duplicate choice is idempotent");

h = enable(hero({ "vagabond.skirmisher": 3 }), ["vagabond.skirmisher.2", "vagabond.skirmisher.3"]); s = scene([h, foe("attacked", 3, 2), foe("rebound", 3, 3)]);
prepared = lionwing.prepare(s, { actorId: "h", kind: "action", actionId: ids.skirmish, targetIds: ["attacked"], attribute: "body" }, { random: () => 0.8 });
assert.equal(prepared.ok, true, prepared.errors?.join(" ")); s = lionwing.dispatchMany(s, prepared.events, { random: () => 0.8 }).scene;
s = dispatch(s, { id: "skirmish-react", type: "lionwing.command", actorId: "attacked", payload: { kind: "reaction", choice: "take" } });
s = dispatch(s, { id: "skirmish-resolve", type: "lionwing.command", actorId: "h", payload: { kind: "resolve-attack" } });
assert.ok(s.lionwing.choices[0]?.options.includes("shift"), "Shifting Blows offers a post-Skirmish movement choice");
const shiftChoice = s.lionwing.choices[0]; s = dispatch(s, { id: "shift-choice", type: "lionwing.command", actorId: "h", payload: { kind: "choice", id: shiftChoice.id, choice: "shift" } });
const shiftPlacement = s.lionwing.choices[0]; assert.equal(shiftPlacement.kind, "placement");
s = dispatch(s, { id: "shift-placement", type: "lionwing.command", actorId: "h", payload: { kind: "choice", id: shiftPlacement.id, choice: "place", destination: { x: 2, y: 3 } } });
assert.ok(s.lionwing.choices[0]?.options.some(id => id === "jab:rebound"), "Rebound offers Jab after Skirmisher movement");

h = enable(hero({ "powerhouse.martial-artist": 3, "powerhouse.dragonslayer": 1 }), ["powerhouse.martial-artist.3"]);
const forged = adapters.rollBonus(h, { scene: scene([h, foe("e")]), kind: "attack", actionId: ids.skirmish, techniqueTags: ["weapon"] });
assert.equal(forged, 1, "client supplied weapon tag cannot disable/enable Martial rules");
const trusted = adapters.rollBonus(h, { scene: scene([h, foe("e")]), kind: "attack", actionId: ids.skirmish, techniqueIds: ["powerhouse.dragonslayer.1"] });
assert.equal(trusted, 0, "trusted weapon technique suppresses Martial III only when level III is known");
console.log("LionWing Martial Artist / Skirmisher contracts passed: trusted tags, Hammers choices, Flow damage, fixed Jab, reload and duplicate guards");
