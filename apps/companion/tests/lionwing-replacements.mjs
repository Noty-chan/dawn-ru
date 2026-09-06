import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context);
const engine = loadSceneEngine(context), lw = context.window.DAWN_LIONWING_ENGINE;
vm.runInContext(fs.readFileSync(new URL("../network-v2.js", import.meta.url), "utf8"), context);
const network = context.window.DAWN_NETWORK_V2, execution = context.window.DAWN_LIONWING_EXECUTION;
const copy = value => JSON.parse(JSON.stringify(value));
const ruleId = "powerhouse.berserker.2", effect = "negative.ослаблен";
const hero = id => ({ id, name: id, kind: "hero", heroId: id, ownerId: id, rulesEdition: "lionwing", team: "hero", space: "main", x: id === "h" ? 1 : 3, y: 1, hp: 16, maxHp: 16, wounds: 0, ap: 3, focus: 2, influence: 2, tier: 1, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], knownTechniques: { "powerhouse.berserker": 2 }, techniques: {} });
const fixture = () => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, tension: 0, actors: [hero("h"), hero("e")], spaces: [{ id: "main", width: 7, height: 7 }], log: [], objects: [], walls: [], markers: [] });
let serial = 0;
const run = (scene, actorId, payload) => lw.dispatchMany(scene, [{ ...lw.command(actorId, payload), id: `replacement-${++serial}` }]).scene;
const enabled = () => run(fixture(), "h", { kind: "automation", ruleId, enabled: true });
const receive = (scene, selected = effect) => run(scene, "e", { kind: "effect", targetId: "h", effect: selected });
const answer = (scene, selection) => run(scene, "h", { kind: "choice", id: scene.lionwing.choices[0].id, choice: selection });

// Source identity is anchored to the actual text, not just to a handwritten hash.
const source = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json", import.meta.url)));
const technique = source.archetypes.flatMap(a => a.techniques).find(t => t.id === "powerhouse.berserker"), level = technique.levels.find(l => l.n === 2);
const digest = crypto.createHash("sha256").update(JSON.stringify({ id: ruleId, archetypeId: technique.archetypeId, techniqueId: technique.id, name: level.name, text: level.text, notes: technique.notes, source: technique.source })).digest("hex");
assert.equal(context.window.DAWN_LIONWING_ADAPTERS.list(hero("h"))[0].sourceDigest, digest);

// Anonymous competing replacements: no registration-order winner, no mutation.
const original = { kind: "effect", effect, targetId: "h" };
const f = execution.open(original, { id: "frame", ownerActorId: "h" }, [{ id: "alpha", label: "A", operations: [{ kind: "damage", amount: 1 }] }, { id: "beta", label: "B", operations: [{ kind: "damage", amount: 2 }] }]);
assert.throws(() => execution.plan(f), /ожидает/);
assert.equal(execution.plan(execution.choose(copy(f), "beta")).operations[0].amount, 2);
assert.equal(f.phase, "before");assert.throws(() => execution.choose(f, "forged"), /недоступна/);
assert.throws(() => execution.choose(execution.choose(f, "keep"), "alpha"), /завершён/);

let s = receive(fixture());assert.ok(s.actors[0].effects.includes(effect));assert.equal(s.lionwing.choices.length, 0, "manual saves stay manual");
s = receive(enabled());assert.equal(s.actors[0].effects.length, 0);assert.equal(s.actors[0].hp, 16);
const suspended = copy(s);
s = answer(copy(s), "keep");assert.ok(s.actors[0].effects.includes(effect));assert.equal(s.actors[0].hp, 16);
assert.equal(s.log.filter(e => e.type === "effect.apply").length, 1);
s = answer(copy(suspended), ruleId);assert.equal(s.actors[0].hp, 14);assert.equal(s.actors[0].effects.length, 0);
assert.equal(s.log.filter(e => e.type === "effect.apply").length, 0, "replacement never applies the original");
assert.equal(s.log.find(e => e.type === "consequence.completed").payload.outcome, "replaced");
assert.equal(s.log.find(e => e.type === "damage.apply").execution.ruleId, ruleId);

// Queue pauses before later effects and the batch tail; reload between each answer.
s = run(enabled(), "e", { kind: "batch", operations: [{ kind: "damage", targetId: "h", amount: 0, effects: [effect, "positive.усилен"] }, { kind: "resource", targetId: "h", resource: "focus", operation: "gain", amount: 1 }] });
assert.equal(s.actors[0].effects.length, 0);
s = answer(copy(s), ruleId);assert.equal(s.actors[0].hp, 14);assert.equal(s.lionwing.choices[0].context.effect, "positive.усилен");assert.equal(s.actors[0].focus, 2);
s = answer(copy(s), "keep");assert.ok(s.actors[0].effects.includes("positive.усилен"));assert.equal(s.actors[0].focus, 3);assert.equal(s.lionwing.deferred.length, 0);

// Self-inflicted replacement can Wound and pause at Resistance before the next hit.
s = enabled();s.actors[0].hp = 1;s.actors[0].wounds = 2;
s = run(s, "e", { kind: "batch", operations: [{ kind: "effect", targetId: "h", effect }, { kind: "damage", targetId: "h", amount: 3 }] });
s = answer(copy(s), ruleId);assert.equal(s.lionwing.choices[0].kind, "knockout");assert.equal(s.actors[0].hp, 16);assert.equal(s.actors[0].influence, 2);
s = answer(copy(s), "resist");assert.equal(s.actors[0].hp, 13);assert.equal(s.actors[0].wounds, 1);assert.equal(s.lionwing.deferred.length, 0);

// Ordinary defense rules apply to replacement damage, not the original Attack's armor.
s = enabled();s.actors[0].armor = 20;s.actors[0].evasion = 1;
s = answer(receive(s), ruleId);assert.equal(s.actors[0].hp, 15);assert.equal(s.actors[0].evasion, 0);

// Authority owns the continuation; player sends only a choice, never replacement code.
s = receive(enabled());const projected = engine.projectScene(s, { role: "player", actorIds: ["h"] });
assert.equal(projected.lionwing.deferred, undefined);assert.equal(JSON.stringify(projected.lionwing.choices).includes('"operations"'), false);
const intent = network.intentFromEvents(projected, [lw.command("h", { kind: "choice", id: s.lionwing.choices[0].id, choice: ruleId, operations: [{ kind: "heal", amount: 999 }] })], "Заменить");
assert.throws(() => network.materializeIntent(s, context.window.DAWN_DATA, intent, "e"), /владеет/);
const events = network.materializeIntent(s, context.window.DAWN_DATA, copy(intent), "h").map((event, index) => ({ ...event, id: `authority-replacement-${index}` }));
const before = copy(s);s = lw.dispatchMany(s, events).scene;assert.equal(s.actors[0].hp, 14);
assert.equal(JSON.stringify(lw.dispatchMany(s, events).scene), JSON.stringify(s), "same receipt cannot pay twice");
assert.equal(before.actors[0].hp, 16, "saved undo snapshot is unchanged");
assert.equal(before.lionwing.choices[0].kind, "replacement");
assert.equal(answer(copy(before), "keep").actors[0].hp, 16, "restoring the snapshot allows the other decision");
// Exercise the real UI submission function against a redacted player snapshot.
const uiSource = fs.readFileSync(new URL("../lionwing-ui.js", import.meta.url), "utf8");
let sent;
const ui = { Scene: projected, LionwingEngine: lw, lwDraftEnabled: false, lwCanNarrate: () => false, lwOwns: id => id === "h", commitSceneEvents: (label, events) => { sent = events; return true; } };
vm.createContext(ui);
vm.runInContext(uiSource.slice(uiSource.indexOf("function lwSubmit("), uiSource.indexOf("function lwStatusHtml(")), ui);
ui.lwSubmit("h", { kind: "choice", id: projected.lionwing.choices[0].id, choice: ruleId });
assert.equal(sent[0].payload.choice, ruleId, "player UI must not require the private continuation to send a choice");
const uiIntent = network.intentFromEvents(projected, sent, "Замена");
assert.equal(lw.dispatchMany(before, network.materializeIntent(before, context.window.DAWN_DATA, uiIntent, "h")).scene.actors[0].hp, 14);

// A Narrator's nested manual ruling must retain the suspended automatic frame.
let paused = run(copy(before), "h", { kind: "pause-chain" });
paused = run(paused, "h", { kind: "note", note: "Вложенное решение" });
paused = run(copy(paused), "h", { kind: "resume-chain" });
assert.equal(answer(paused, ruleId).actors[0].hp, 14);
const atomic = enabled(), originalAtomic = JSON.stringify(atomic);
assert.throws(() => run(atomic, "h", { kind: "batch", operations: [{ kind: "heal", amount: 1 }, { kind: "effect", effect: "bad" }] }), /Эффект/);
assert.equal(JSON.stringify(atomic), originalAtomic);
assert.throws(() => answer(s, ruleId));
assert.throws(() => run(fixture(), "h", { kind: "execution-frame", frame: f }), /публичная операция/);
const low = fixture();low.actors[0].knownTechniques["powerhouse.berserker"] = 1;
assert.throws(() => run(low, "h", { kind: "automation", ruleId, enabled: true }), /недоступна/);
console.log("LionWing replacements: anonymous contracts, source digest, opt-in, ordered effects, Resistance, reload, undo snapshots, ownership and replay passed");

const thrillId = "powerhouse.flagellant.1";
const combined = () => {
  let scene = enabled();scene.actors[0].knownTechniques["powerhouse.flagellant"] = 1;
  return run(scene, "h", { kind: "automation", ruleId: thrillId, enabled: true });
};
const flagellant = source.archetypes.flatMap(a => a.techniques).find(t => t.id === "powerhouse.flagellant"), thrill = flagellant.levels[0];
const thrillDigest = crypto.createHash("sha256").update(JSON.stringify({ id: thrillId, archetypeId: flagellant.archetypeId, techniqueId: flagellant.id, name: thrill.name, text: thrill.text, notes: flagellant.notes, source: flagellant.source })).digest("hex");
assert.equal(context.window.DAWN_LIONWING_ADAPTERS.list(combined().actors[0]).find(rule => rule.id === thrillId).sourceDigest, thrillDigest);

s = answer(receive(combined()), ruleId);
assert.equal(s.lionwing.choices.length, 0, "replacing the negative effect must not offer an after-receive trigger");
assert.equal(s.log.some(e => e.type === "rule.activated"), false);
s = answer(receive(combined()), "keep");
assert.ok(s.actors[0].effects.includes(effect));assert.equal(s.lionwing.choices[0].kind, "rule-trigger");
const afterReceived = copy(s);
s = answer(copy(s), "keep");assert.equal(s.actors[0].effects.includes("positive.усилен"), false);
s = answer(copy(afterReceived), thrillId);
assert.equal(s.lionwing.choices[0].kind, "replacement");assert.equal(s.lionwing.choices[0].context.effect, "positive.усилен");
assert.equal(s.actors[0].effects.includes("positive.усилен"), false, "trigger consequences use the same replacement pipeline");
s = answer(copy(s), "keep");assert.ok(s.actors[0].effects.includes("positive.усилен"));assert.equal(s.lionwing.choices.length, 0);
assert.equal(s.log.filter(e => e.type === "rule.activated").length, 1);
const rootAction = s.log.find(e => e.type === "rule.activated").execution.rootActionId;
assert.equal(s.log.find(e => e.type === "effect.apply" && e.payload.effect === "positive.усилен").execution.rootActionId, rootAction);

s = answer(answer(copy(afterReceived), thrillId), ruleId);
assert.equal(s.actors[0].hp, 14);assert.equal(s.actors[0].effects.includes("positive.усилен"), false);assert.equal(s.lionwing.choices.length, 0);
// Public player submission also works for the after-effect window.
ui.Scene = engine.projectScene(afterReceived, { role: "player", actorIds: ["h"] });
ui.lwSubmit("h", { kind: "choice", id: ui.Scene.lionwing.choices[0].id, choice: thrillId });
const triggerEvents = network.materializeIntent(afterReceived, context.window.DAWN_DATA, network.intentFromEvents(ui.Scene, sent, "Усилить себя"), "h");
assert.equal(lw.dispatchMany(afterReceived, triggerEvents).scene.lionwing.choices[0].context.effect, "positive.усилен");
console.log("LionWing after-effect rules: Flagellant I, cancellation, nested replacement, optional pass, provenance and public player submission passed");
