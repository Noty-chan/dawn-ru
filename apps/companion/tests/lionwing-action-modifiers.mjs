import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context), lionwing = context.window.DAWN_LIONWING_ENGINE, adapters = context.window.DAWN_LIONWING_ADAPTERS;
const ids = engine.ACTION_IDS;
const action = { skirmish: ids.skirmish, breathe: ids.breathe, charge: ids.charge, hide: ids.disappear, interact: ids.interact };
const actor = (techniques = {}, extra = {}) => ({ id: "h", name: "Hero", kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x: 2, y: 2, hp: 12, maxHp: 12, ap: 3, baseAp: 3, focus: 4, influence: 2, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 3 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: techniques, techniques, lionwing: { automation: Object.fromEntries(Object.keys(techniques).map(id => [`${id}.2`, true])) }, ...extra });
const scene = (hero, extra = {}) => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: hero.id, lionwing: { activeTurnInstanceId: "turn:1" }, spaces: [{ id: "main", width: 7, height: 7 }], actors: [hero], objects: [], walls: [], markers: [], log: [], targetIds: [], ...extra });
const enable = (hero, ids) => { hero.lionwing.automation = Object.fromEntries(ids.map(id => [id, true])); return hero; };

let hero = actor({ "powerhouse.martial-artist": 2 });
enable(hero, ["powerhouse.martial-artist.2"]);
let quote = adapters.actionQuote(hero, { scene: scene(hero), actionId: action.skirmish, baseCost: 1, baseResource: "ap", baseSwift: false });
assert.equal(quote.ok, true); assert.equal(quote.swift, true); assert.deepEqual(Array.from(quote.modifierIds), ["powerhouse.martial-artist.2"]);
hero.lionwing.history = [{ actionId: action.skirmish, ownerTurnInstanceId: "turn:1", turnSerial: 1, round: 1 }];
assert.equal(adapters.actionQuote(hero, { scene: scene(hero), actionId: action.skirmish, baseCost: 1, baseResource: "ap", baseSwift: false }).swift, false, "first Skirmish is only once per Turn");

hero = actor({ "altruist.fog-walker": 3, "altruist.bardic-savant": 2 });
enable(hero, ["altruist.fog-walker.3", "altruist.bardic-savant.2"]);
quote = adapters.actionQuote(hero, { scene: scene(hero), actionId: action.breathe, baseCost: 1, baseResource: "ap", baseSwift: false });
assert.equal(quote.swift, true); assert.equal(quote.modifiers.length, 2, "independent Swift sources stack");

hero = actor({ "altruist.artist": 2, "altruist.alchemist": 2 });
enable(hero, ["altruist.artist.2", "altruist.alchemist.2"]);
quote = adapters.actionQuote(hero, { scene: scene(hero), actionId: action.interact, baseCost: 1, baseResource: "ap", baseSwift: false });
assert.equal(quote.cost, 0); assert.equal(quote.swift, true); assert.equal(quote.modifiers.length, 2);
hero.lionwing.history = [{ actionId: action.interact, ownerTurnInstanceId: "turn:1", turnSerial: 1, round: 1 }];
assert.equal(adapters.actionQuote(hero, { scene: scene(hero), actionId: action.interact, baseCost: 1, baseResource: "ap", baseSwift: false }).cost, 1, "the free Interact is only once per Turn");

hero = actor({ "ruiner.creation-ascetic": 2 }); enable(hero, ["ruiner.creation-ascetic.2"]);
assert.equal(adapters.actionQuote(hero, { scene: scene(hero), actionId: action.charge, baseCost: 2, baseResource: "ap", baseSwift: false }).cost, 1);
assert.equal(adapters.actionQuote(hero, { scene: scene(hero), actionId: action.breathe, baseCost: 1, baseResource: "ap", baseSwift: false }).swift, true);

hero = actor({ "vagabond.weaponsmith": 2 }); enable(hero, ["vagabond.weaponsmith.2"]);
assert.equal(adapters.actionQuote(hero, { scene: scene(hero), actionId: action.charge, baseCost: 2, baseResource: "ap", baseSwift: false }).cost, 2, "Charge discount stays inactive without trusted form state");
hero.lionwing.formSwapTurnSerial = 0;
assert.equal(adapters.actionQuote(hero, { scene: scene(hero), actionId: action.charge, baseCost: 2, baseResource: "ap", baseSwift: false }).cost, 1);

hero = actor({ "vagabond.assassin": 1 }); enable(hero, ["vagabond.assassin.1"]);
const deployed = scene(hero, { log: [{ type: "actor.move", actorId: hero.id, payload: { placement: true, movement: "Развертывание" } }] });
quote = adapters.actionQuote(hero, { scene: deployed, actionId: action.hide, baseCost: 1, baseResource: "ap", baseSwift: false, firstActionAfterDeploy: true });
assert.deepEqual(Array.from(quote.ignoreRequirements), ["boardEdge", "startedDisappeared"]);
assert.equal(lionwing.actionStatus(deployed, hero, lionwing.actionDef(action.hide)).available, true, "Assassin Hide can ignore edge requirements after Deploy");
hero.lionwing.history = [{ actionId: action.hide, ownerTurnInstanceId: "turn:1", turnSerial: 1, round: 1 }]; hero.x = 0;
assert.equal(lionwing.actionStatus(deployed, hero, lionwing.actionDef(action.hide)).cost, 1, "the first post-Deploy action is consumed");

hero = actor({ "powerhouse.improvisational-fighter": 2 }); enable(hero, ["powerhouse.improvisational-fighter.2"]);
quote = adapters.actionQuote(hero, { scene: scene(hero), actionId: action.interact, baseCost: 1, baseResource: "ap", baseSwift: false });
assert.equal(quote.modifiers.length, 0, "Interact without trusted outcome semantics is not guessed as non-Attack");

hero = actor({ "vagabond.dim-mak": 2 }); enable(hero, ["vagabond.dim-mak.1", "vagabond.dim-mak.2"]);
const study = ids.study || "action.утилитарные-действия.изучение";
const studyScene = scene(hero);
hero.lionwing.history = [{ actionId: study, targetIds: ["enemy"], ownerTurnInstanceId: "turn:1", turnSerial: 1 }, { actionId: study, targetIds: ["enemy"], ownerTurnInstanceId: "turn:1", turnSerial: 1 }];
quote = adapters.actionQuote(hero, { scene: studyScene, actionId: study, targetIds: ["enemy"], baseCost: 1, baseResource: "ap", baseSwift: false });
assert.equal(quote.cost, 0, "Detective II makes the third Investigate free");
assert.equal(quote.swift, true, "Detective repeat Investigate is Swift");

// prepare and dispatch recompute the same quote.  A client supplied cost does
// not alter the authoritative payment.
hero = actor({ "altruist.artist": 2 }); enable(hero, ["altruist.artist.2"]);
let s = scene(hero); const prepared = lionwing.prepare(s, { actorId: hero.id, kind: "action", actionId: action.interact, cost: 99 }, { random: () => 0.6 });
assert.equal(prepared.ok, true, prepared.errors?.join(" ")); const next = lionwing.dispatchMany(s, prepared.events).scene;
assert.equal(next.actors[0].ap, 3, "free Interact does not spend AP");
const reloaded = lionwing.reload(JSON.parse(JSON.stringify(next)));
assert.equal(lionwing.actionStatus(reloaded, reloaded.actors[0], lionwing.actionDef(action.interact)).cost, 1, "used action history survives reload");
const replay = lionwing.dispatchMany(next, prepared.events);
assert.equal(replay.scene.version, next.version, "replaying the same action does not pay again");
console.log("LionWing action modifiers: pure quote contract, first-per-turn/round gates, Swift/cost stacking, trusted-state safeguards, Hide requirement exceptions, prepare/dispatch replay and forged cost protection passed");
