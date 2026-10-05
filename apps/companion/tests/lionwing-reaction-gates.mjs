import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "edition-lionwing-ru.js", "logic.js"]) vm.runInContext(read(file), context);
const engine = loadSceneEngine(context), lw = context.window.DAWN_LIONWING_ENGINE;
const clone = value => JSON.parse(JSON.stringify(value));
const participant = (id, kind, x) => ({ id, name: id, kind, heroId: kind === "hero" ? id : null, rulesEdition: "lionwing", team: id === "source" ? "hero" : "enemy", space: "main", x, y: 1, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 6, influence: 3, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {}, usedActions: [], knockedOut: false });
const fixture = () => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 0, activeActorId: null, tension: 0, spaces: [{ id: "main", width: 8, height: 6 }], actors: [participant("source", "hero", 1), { ...participant("assassin", "enemy", 3), profileId: "lionwing.npc.assassin" }, participant("hero-target", "hero", 4)], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [] });
let serial = 0;
const run = (scene, actorId, payload) => lw.dispatchMany(scene, [{ ...lw.command(actorId, payload), id: `reaction-gate-${++serial}` }]).scene;

let scene = run(fixture(), "source", { kind: "turn-start" });
const cast = lw.prepare(scene, { actorId: "source", kind: "action", actionId: engine.ACTION_IDS.spell, targetIds: ["assassin"] }, { random: () => 0.6 });
assert.equal(cast.ok, true, cast.errors?.join(" "));
scene = lw.dispatchMany(scene, cast.events).scene;
assert.equal(scene.pendingAction.name, "Cast", "canonical name stays intact");
assert.deepEqual(Array.from(lw.reactionOptions(scene, "assassin")), []);
assert.deepEqual(Array.from(engine.pendingActionStatus(scene).waitingIds), []);
assert.deepEqual(Array.from(engine.pendingActionStatus(scene).autoPassedIds), ["assassin"]);
for (const choice of ["block", "dodge", "clash"]) {
  const before = JSON.stringify(scene);
  const attempt = lw.prepare(scene, { actorId: "assassin", kind: "reaction", choice, destination: { x: 3, y: 2 } });
  assert.equal(attempt.ok, false, `${choice} must be rejected by authoritative preparation`);
  assert.throws(() => run(scene, "assassin", { kind: "reaction", choice, destination: { x: 3, y: 2 } }), /недоступна/);
  assert.equal(JSON.stringify(scene), before, "rejected reaction is atomic");
}

// Render the production pending UI against the localized catalog.
const ui = read("lionwing-ui.js"), pendingFunction = ui.slice(ui.indexOf("function lwPendingHtml()"), ui.indexOf("function lwAutomationHtml("));
const uiTextHelpers = ui.slice(ui.indexOf("const lwTechniqueText ="), ui.indexOf("const lwTechniqueEnabled ="));
const canonical = context.window.DAWN_LIONWING_DATA.coreRules, translation = context.window.DAWN_LIONWING_RU.coreRules;
const display = { ...canonical, actions: { ...canonical.actions, list: canonical.actions.list.map(def => ({ ...def, ...(translation.actions.entries[def.id] || {}) })) } };
Object.assign(context, { Scene: scene, SceneEngine: engine, LionwingEngine: lw, lwRules: () => display, lwOwns: () => true, lwCanNarrate: () => true, esc: value => String(value ?? ""), lwDestination: null });
vm.runInContext(`${uiTextHelpers}\n${pendingFunction}\nwindow.renderPending = lwPendingHtml;`, context);
let html = context.window.renderPending();
assert.match(html, /Заклинание ·/);
assert.doesNotMatch(html, /Cast ·|data-lw-reaction=/);
assert.match(html, /data-lw-resolve/);
const reloaded = lw.reload(JSON.stringify(scene));
const resolved = run(reloaded, "source", { kind: "resolve-attack" });
assert.equal(resolved.pendingAction, null);
assert.equal(resolved.actors[1].hp, 17);

// Only the hero in a mixed attack holds up resolution across clients.
scene = run(fixture(), "source", { kind: "attack", targetIds: ["assassin", "hero-target"], amount: 3 });
assert.deepEqual(Array.from(engine.pendingActionStatus(scene).waitingIds), ["hero-target"]);
assert.deepEqual(Array.from(lw.reactionOptions(scene, "hero-target"), option => option.id), ["take", "block", "dodge", "clash"]);
assert.throws(() => run(scene, "source", { kind: "resolve-attack" }), /Реакций/);
context.Scene = scene;
html = context.window.renderPending();
assert.match(html, /data-lw-reaction="block"/);
assert.match(html, /Сейчас без расхода ресурсов/, "the actual cockpit helper labels the no-cost defense");
assert.doesNotMatch(html, /class="lw-reaction"><b>assassin/);
scene = run(clone(scene), "hero-target", { kind: "reaction", choice: "block" });
scene = run(clone(scene), "source", { kind: "resolve-attack" });
assert.equal(scene.pendingAction, null);
assert.equal(scene.actors[1].hp, 17);
assert.equal(scene.actors[2].focus, 4);

// The UI and reducer agree on Effect and resource restrictions.
scene = run(fixture(), "source", { kind: "effect", targetId: "hero-target", effect: "negative.обездвижен" });
scene = run(scene, "source", { kind: "attack", targetIds: ["hero-target"], amount: 3 });
assert.equal(lw.reactionOptions(scene, "hero-target").find(option => option.id === "dodge").available, false);
assert.throws(() => run(scene, "hero-target", { kind: "reaction", choice: "dodge", destination: { x: 4, y: 2 } }), /недоступна/);
scene.actors[2].focus = 0;
assert.equal(lw.reactionOptions(scene, "hero-target").filter(option => option.available).length, 1);
assert.throws(() => run(scene, "hero-target", { kind: "reaction", choice: "block" }), /недоступна/);

console.log("LionWing reactions: localized Cast, NPC auto-pass, forged defenses, mixed clients and hero gates passed");
