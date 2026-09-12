import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console, Date };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context), lionwing = context.window.DAWN_LIONWING_ENGINE, adapters = context.window.DAWN_LIONWING_ADAPTERS;
const derived = context.window.DAWN_LIONWING_DERIVED_ACTIONS;
const ids = engine.ACTION_IDS;
let choiceSerial = 0;
const canonical = name => JSON.parse(fs.readFileSync(new URL(`../../../source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/${name}.json`, import.meta.url), "utf8"));
const canonicalLevel = (name, technique, level) => canonical(name).techniques.find(item => item.id === technique).levels.find(item => item.n === level);
assert.equal(canonicalLevel("vagabond", "vagabond.opportunist", 1).text, "Once per Round, when an ally resolves an Attack on a character within [Talent] spaces, you may Swiftly Skirmish at no Cost, targeting them. If you are outside Skirmish's range, you may Teleport to a space adjacent to the target before drawing range.");
assert.equal(canonicalLevel("bulwark", "bulwark.runic-retribution", 1).text, "When an ally is hit by an Attack, you may spend 1 Focus to Swiftly Cast, targeting the attacker regardless of range at no AP Cost (this cannot trigger Lash or have you Cast targeting yourself).");
const hero = (techniques = {}, extra = {}) => ({ id: "h", name: "Hero", kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x: 2, y: 2, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 6, influence: 0, tier: 2, speed: 4, armor: 0, evasion: 0, attrs: { body: 4, talent: 3, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: techniques, techniques, lionwing: { automation: Object.fromEntries(Object.keys(techniques).map(id => [`${id}.1`, true])) }, ...extra });
const foe = (id, x = 3, y = 2) => ({ id, name: id, kind: "enemy", rulesEdition: "lionwing", team: "enemy", space: "main", x, y, hp: 20, maxHp: 20, ap: 0, baseAp: 0, focus: 0, influence: 0, tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {} });
const ally = (id = "ally", x = 2, y = 3) => ({ id, name: id, kind: "hero", rulesEdition: "lionwing", team: "hero", space: "main", x, y, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 0, influence: 0, tier: 1, speed: 3, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: {} });
const scene = actors => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 0, activeActorId: "h", lionwing: { activeTurnInstanceId: "turn:1" }, spaces: [{ id: "main", width: 8, height: 8 }], actors, objects: [], walls: [], markers: [], log: [], targetIds: [] });
const dispatch = (s, event) => lionwing.dispatchMany(s, [event], { random: () => 0.8 }).scene;
const enable = (actor, ...idsToEnable) => { actor.lionwing.automation = Object.fromEntries(idsToEnable.map(id => [id, true])); return actor; };
const trustedDerived = (s, actorId, payload, responderId = actorId, simulateSpend = true) => {
  const causeEventId = `cause-${payload.ruleId}`;
  if (payload.ruleId === "vagabond.opportunist.1" && !s.log.some(row => row.id === causeEventId)) s.log.unshift({ id: causeEventId, type: "attack.clear", actorId: "ally", payload: { actionId: ids.skirmish, targetIds: [...payload.targetIds] }, execution: { rootActionId: causeEventId, actionInstanceId: causeEventId } });
  if (payload.ruleId === "bulwark.runic-retribution.1" && !s.log.some(row => row.id === causeEventId)) {
    s.log.unshift({ id: causeEventId, type: "damage.apply", actorId: "e", payload: { actionId: ids.skirmish, targetId: "ally", attack: true, hit: true }, execution: { rootActionId: causeEventId, actionInstanceId: causeEventId } });
    if (simulateSpend) {
      s.log.unshift({ id: `${causeEventId}:focus`, type: "resource.spend", actorId, payload: { ruleId: payload.ruleId, resource: "focus", requestedResource: "focus", amount: 1, causeEventId }, execution: { rootActionId: causeEventId, actionInstanceId: causeEventId, causeEventId } });
      const owner = s.actors.find(item => item.id === actorId);
      if (owner) owner.focus = Math.max(0, Number(owner.focus || 0) - 1);
    }
  }
  s.lionwing.choices = [{ id: `trusted-${payload.ruleId}`, actorId, kind: "technique-trigger", options: ["go"], context: { ruleId: payload.ruleId, sourceDigest: payload.sourceDigest, ownerActorId: actorId, causeEventId, choices: { go: [payload] } } }];
  return dispatch(s, { id: `choose-${payload.ruleId}-${++choiceSerial}`, type: "lionwing.command", actorId: responderId, payload: { kind: "choice", id: `trusted-${payload.ruleId}`, choice: "go" } });
};

let h = enable(hero({ "vagabond.skirmisher": 1 }), "vagabond.skirmisher.1"), s = scene([h, foe("e", 4, 2)]);
const trigger = { id: "move", type: "actor.move", actorId: "h", payload: { sourceActionId: ids.step, x: 3, y: 2, space: "main", distance: 1 } };
s = dispatch(s, trigger);
const sting = adapters.afterEvent(h, s.log.find(row => row.type === "actor.move"), { scene: s })[0];
assert.equal(sting.choices[0].operations[1].kind, "derived-action");
s = dispatch(s, { id: "derived-jab", type: "lionwing.command", actorId: "h", payload: { kind: "choice", id: s.lionwing.choices[0]?.id, choice: "jab:e" } });
const resolved = s.log.find(row => row.type === "action.resolve" && row.payload?.derivedActionId === "vagabond.skirmisher.1");
assert.equal(resolved.payload.actionId, ids.skirmish);
assert.equal(JSON.stringify(resolved.payload.targetIds), JSON.stringify(["e"]));
assert.equal(s.actors.find(a => a.id === "e").hp, 18);
assert.equal(s.actors.find(a => a.id === "h").ap, 3);
assert.equal(s.actors.find(a => a.id === "h").usedActions.includes(ids.skirmish), false);
assert.ok(s.log.some(row => row.type === "damage.apply" && row.payload.derivedActionId === "vagabond.skirmisher.1"));

// A roll based derived action uses the ordinary reaction window while keeping
// its trusted identity and free action contract through the continuation.
h = enable(hero({ "vagabond.opportunist": 1 }), "vagabond.opportunist.1");
s = scene([h, ally(), foe("e")]);
const opportunist = derived.contract("vagabond.opportunist.1");
s = trustedDerived(s, "h", { kind: "derived-action", sourceActorId: "h", ruleId: opportunist.id,
  sourceDigest: opportunist.sourceDigest, targetIds: ["e"], attribute: "body",
});
assert.equal(s.pendingAction.derivedActionId, opportunist.id, "roll derived action keeps identity in pending attack");
assert.equal(JSON.stringify(s.pendingAction.targetIds), JSON.stringify(["e"]), "roll derived action locks its target set");
s = dispatch(s, { id: "opportunist-reaction", type: "lionwing.command", actorId: "e", payload: { kind: "reaction", choice: "take" } });
s = dispatch(s, { id: "opportunist-resolve", type: "lionwing.command", actorId: "h", payload: { kind: "resolve-attack" } });
assert.ok(s.log.some(row => row.type === "damage.apply" && row.payload.derivedActionId === opportunist.id), "derived action survives reaction resolution");
assert.ok(s.log.some(row => row.type === "attack.clear" && row.payload.derivedActionId === opportunist.id), "derived action emits clear receipt");

// Runic Retribution I is an event sourced follow-up: the cause must be an
// actual hit on an ally, its target is locked to the attacker, and the normal
// reaction lifecycle remains available.
h = enable(hero({ "bulwark.runic-retribution": 1 }), "bulwark.runic-retribution.1");
s = scene([h, ally(), foe("e", 4, 4)]);
const runic = derived.contract("bulwark.runic-retribution.1");
s = trustedDerived(s, "h", { kind: "derived-action", sourceActorId: "h", ruleId: runic.id,
  sourceDigest: runic.sourceDigest, targetIds: ["e"],
});
assert.equal(s.pendingAction.derivedActionId, runic.id, "Lash keeps its derived identity through the reaction window");
assert.equal(s.actors.find(actor => actor.id === "h").focus, 5, "Lash requires the one-Focus spend before the derived action");
const runicProjection = engine.projectScene(s, { role: "player", actorIds: ["h"] });
assert.equal("hp" in runicProjection.log.find(row => row.type === "damage.apply").payload, false, "cause receipts preserve health privacy");
s = dispatch(lionwing.reload(JSON.parse(JSON.stringify(s))), { id: "runic-reaction", type: "lionwing.command", actorId: "e", payload: { kind: "reaction", choice: "take" } });
s = dispatch(s, { id: "runic-resolve", type: "lionwing.command", actorId: "h", payload: { kind: "resolve-attack" } });
assert.ok(s.log.some(row => row.type === "attack.clear" && row.payload.derivedActionId === runic.id), "Lash resolves after reload and reaction");

// The real adapter path writes the resource spend and derived continuation
// only after the engine has emitted the authoritative hit receipt.
let triggeredRunic = scene([enable(hero({ "bulwark.runic-retribution": 1 }), "bulwark.runic-retribution.1"), ally(), foe("e", 4, 4)]);
triggeredRunic = dispatch(triggeredRunic, { id: "authoritative-hit", type: "damage.apply", actorId: "e", payload: { targetId: "ally", amount: 1, attack: true, sourceActionId: ids.skirmish } });
assert.equal(triggeredRunic.pendingAction?.derivedActionId, runic.id, "authoritative ally hit opens Lash");
assert.equal(triggeredRunic.actors.find(actor => actor.id === "h").focus, 5, "Lash spends exactly one Focus");

// Cause, target, stale and replay checks are reducer checks, so a forged
// continuation cannot manufacture a legal target or reuse the same cause.
const forgedTarget = scene([enable(hero({ "bulwark.runic-retribution": 1 }), "bulwark.runic-retribution.1"), ally(), foe("e"), foe("other", 5, 2)]);
assert.throws(() => trustedDerived(forgedTarget, "h", { kind: "derived-action", sourceActorId: "h", ruleId: runic.id, sourceDigest: runic.sourceDigest, targetIds: ["other"] }), /Ласка|атакующего|цели/i);
const wrongCause = scene([enable(hero({ "bulwark.runic-retribution": 1 }), "bulwark.runic-retribution.1"), ally(), foe("e")]);
wrongCause.log.unshift({ id: "cause-bulwark.runic-retribution.1", type: "attack.clear", actorId: "e", payload: { actionId: ids.skirmish, targetIds: ["ally"] }, execution: { rootActionId: "wrong", actionInstanceId: "wrong" } });
assert.throws(() => trustedDerived(wrongCause, "h", { kind: "derived-action", sourceActorId: "h", ruleId: runic.id, sourceDigest: runic.sourceDigest, targetIds: ["e"] }), /Ласка|событие причины/i);
const noSpend = scene([enable(hero({ "bulwark.runic-retribution": 1 }), "bulwark.runic-retribution.1"), ally(), foe("e")]);
assert.throws(() => trustedDerived(noSpend, "h", { kind: "derived-action", sourceActorId: "h", ruleId: runic.id, sourceDigest: runic.sourceDigest, targetIds: ["e"] }, "h", false), /Фокуса|расход/i);
const replayCause = scene([enable(hero({ "bulwark.runic-retribution": 1 }), "bulwark.runic-retribution.1"), ally(), foe("e")]);
let firstRunic = trustedDerived(replayCause, "h", { kind: "derived-action", sourceActorId: "h", ruleId: runic.id, sourceDigest: runic.sourceDigest, targetIds: ["e"] });
firstRunic = dispatch(firstRunic, { id: "replay-reaction", type: "lionwing.command", actorId: "e", payload: { kind: "reaction", choice: "take" } });
firstRunic = dispatch(firstRunic, { id: "replay-resolve", type: "lionwing.command", actorId: "h", payload: { kind: "resolve-attack" } });
assert.throws(() => trustedDerived(firstRunic, "h", { kind: "derived-action", sourceActorId: "h", ruleId: runic.id, sourceDigest: runic.sourceDigest, targetIds: ["e"] }), /уже выполнено|повтор/i);
assert.throws(() => trustedDerived(scene([enable(hero({ "bulwark.runic-retribution": 1 }), "bulwark.runic-retribution.1"), ally(), foe("e")]), "h", { kind: "derived-action", sourceActorId: "h", ruleId: runic.id, sourceDigest: runic.sourceDigest, targetIds: ["e"] }, "e"), /принадлежит другому|другому участнику/i);

// Cancellation clears a derived continuation without applying damage, and a
// serialized scene remains replay safe.
h = enable(hero({ "vagabond.opportunist": 1 }), "vagabond.opportunist.1");
s = scene([h, ally(), foe("e")]);
s = trustedDerived(s, "h", { kind: "derived-action", sourceActorId: "h", ruleId: opportunist.id,
  sourceDigest: opportunist.sourceDigest, targetIds: ["e"], attribute: "body",
});
const beforeCancel = s.log.length;
const reloadedCancel = lionwing.reload(JSON.parse(JSON.stringify(s)));
s = dispatch(reloadedCancel, { id: "opportunist-cancelled", type: "lionwing.command", actorId: "h", payload: { kind: "cancel-attack" } });
assert.equal(s.pendingAction, null, "reload preserves a cancellable derived continuation");
assert.equal(s.actors.find(actor => actor.id === "e").hp, 20, "cancellation prevents derived damage");
assert.ok(s.log.length > beforeCancel && s.log.some(row => row.type === "attack.clear" && row.payload?.cancelled === true && row.payload?.derivedActionId === opportunist.id), "cancellation emits lifecycle receipt");

assert.throws(() => derived.identity(opportunist, { lineage: [opportunist.id, opportunist.id], targetIds: ["e"] }, { rootActionId: "loop" }), /цикла|loop/i, "lineage loop guard rejects replayed continuation");

assert.throws(() => dispatch(scene([enable(hero({ "vagabond.skirmisher": 1 }), "vagabond.skirmisher.1"), foe("e")]), { id: "forged", type: "lionwing.command", actorId: "h", payload: { kind: "derived-action", targetIds: ["e"], sourceActorId: "h", ruleId: "vagabond.skirmisher.1", sourceDigest: "forged" } }), /Происхождение|origin|Реестру/);
console.log("LionWing derived actions: trusted identity, fixed target/damage, reaction, cancellation, replay loop guard and forged payload rejection passed");
