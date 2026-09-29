import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "edition-lionwing-ru.js", "logic.js"]) vm.runInContext(read(file), context);
const engine = loadSceneEngine(context), lw = context.window.DAWN_LIONWING_ENGINE, data = context.window.DAWN_DATA;
const clone = value => JSON.parse(JSON.stringify(value));
const actor = (id, kind, x, extra = {}) => ({ id, name: id, kind, heroId: kind === "hero" ? id : null, rulesEdition: "lionwing", team: kind === "hero" ? "hero" : "enemy", space: "main", x, y: 1, hp: 20, maxHp: 20, ap: 3, baseAp: 3, focus: 6, influence: 3, wounds: 0, stress: 0, tier: 1, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 3, spirit: 3, mind: 3 }, effects: [], effectStates: {}, usedActions: [], knockedOut: false, techniques: {}, knownTechniques: {}, lionwing: {}, ...extra });
const fixture = target => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "npc", selectedActor: "npc", tension: 0, spaces: [{ id: "main", width: 8, height: 6 }], actors: [actor("npc", "enemy", 1, { profileId: "lionwing.npc.assassin" }), target], objects: [], areas: [], topology: { cuts: [] }, walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [], triggerQueue: [], lionwing: { entities: {}, entityReceipts: {} } });
let serial = 0;
const commit = (scene, prepared) => {
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return engine.dispatchMany(scene, prepared.events.map(event => ({ ...event, id: `enemy-ui-${++serial}` }))).scene;
};
const attack = scene => commit(scene, engine.prepareEnemyRule(scene, data, {
  actorId: "npc", ruleId: "lionwing.npc.assassin.slice", targetIds: [scene.actors[1].id],
  roll: { rolls: [4, 4, 1], successes: 2, crits: 0, formula: "3D6" },
}));

const actionUi = read("scene-actions-ui.js"), lwUi = read("lionwing-ui.js");
Object.assign(context, { Scene: null, D: data, SceneEngine: engine, LionwingEngine: lw, Sync: { state: () => ({}) }, currentHeroActor: () => context.Scene.actors.find(item => item.kind === "hero"), lwActor: () => context.Scene.actors[0], lwCanNarrate: () => true, lwOwns: () => true, esc: value => String(value ?? ""), md: value => String(value ?? ""), lwRules: () => context.window.DAWN_LIONWING_DATA.coreRules });
Object.assign(context, { Lionwing: context.window.DAWN_LIONWING_DATA, LionwingRu: context.window.DAWN_LIONWING_RU, contentPreferences: { locale: "ru" } });
const bootstrap = read("app-bootstrap.js"), sceneUi = read("scene-ui.js");
vm.runInContext(bootstrap.slice(bootstrap.indexOf("function localizedLionwingCoreRules()"), bootstrap.indexOf("const activeCoreRules=")), context);
vm.runInContext(sceneUi.slice(sceneUi.indexOf("function sceneActionDisplayName("), sceneUi.indexOf("function refreshSceneControlStates(")), context);
vm.runInContext(actionUi.slice(actionUi.indexOf("function sceneActionPanel("), actionUi.indexOf("function coreActionRoll(")), context);
vm.runInContext(`const lwOldActionPanel=sceneActionPanel;\n${lwUi.slice(lwUi.indexOf("function lwPendingHtml()"), lwUi.indexOf("function lwAutomationHtml("))}\nwindow.renderEnemyPending=lwPendingHtml;`, context);

let scene = attack(fixture(actor("hero", "hero", 2)));
assert.ok(scene.pendingAction?.enemyRuleId, "canonical NPC attack owns the shared pending action");
assert.equal(scene.pendingAction.lionwing, undefined);
context.Scene = scene;
let html = context.window.renderEnemyPending();
assert.match(html, /data-core-reaction="pass"/, "NPC attack must expose the shared defense controls in the LionWing panel");
assert.match(html, /data-core-reaction="action\.защита\.блок"/);
assert.doesNotMatch(html, /Slice/, "shared attack titles use the Russian NPC overlay");
context.Sync.state = () => ({ sceneId: "table", canNarrate: false });
assert.match(context.window.renderEnemyPending(), /data-core-reaction="pass"/, "the owning hero sees the defense buttons");
const ownHero = context.currentHeroActor;
context.currentHeroActor = () => null;
assert.match(context.window.renderEnemyPending(), /ОЖИДАЕТСЯ РЕАКЦИЯ/);
assert.doesNotMatch(context.window.renderEnemyPending(), /data-core-reaction=/, "a player without a hero cannot answer for another player");
context.currentHeroActor = ownHero;
context.Sync.state = () => ({});
scene = commit(scene, engine.respondReaction(scene, data, { actorId: "hero", choice: "pass" }));
context.Scene = clone(scene);
assert.match(context.window.renderEnemyPending(), /data-core-resolve/, "the Narrator can finish the NPC attack after the hero responds");
scene = commit(clone(scene), engine.resolvePendingAction(scene, data));
assert.equal(scene.pendingAction, null);
assert.equal(scene.actors[1].hp, 17, "two hits plus the Assassin's isolated-target bonus apply once");

scene = attack(fixture(actor("ally-npc", "enemy", 2, { team: "hero", profileId: "lionwing.npc.bruiser" })));
assert.equal(engine.pendingActionStatus(scene, data).waitingIds.length, 0);
assert.equal(engine.pendingActionStatus(scene).waitingIds.length, 0, "queries without a display catalog also auto-pass NPCs");
context.Scene = scene;
html = context.window.renderEnemyPending();
assert.doesNotMatch(html, /data-core-reaction=/);
assert.match(html, /data-core-resolve/);
scene = commit(clone(scene), engine.resolvePendingAction(scene, data));
assert.equal(scene.pendingAction, null);

// Exercise the production NPC button path with a critical that adds a die.
let rollIndex = 0;
const randomValues = [0.9, 0.55, 0.1, 0.75];
const criticalRoll = context.window.DAWN_LOGIC.rollXd6({ count: 3, random: () => randomValues[rollIndex++] });
assert.equal(criticalRoll.rolls.length, 4);
Object.assign(context, {
  Logic: { ...context.window.DAWN_LOGIC, rollXd6: () => criticalRoll },
  enemyProfile: id => ({ rules: context.localizedLionwingCoreRules().npcs.list.find(npc => npc.id === id).actions }),
  selectedAttackModifierIds: () => [], isScenePanelOpen: () => true, toast: () => {},
  commitSceneEvents: (_label, events) => { context.Scene = commit(context.Scene, { ok: true, events }); return context.Scene; },
  pendingEnemyRule: null,
});
vm.runInContext(actionUi.slice(actionUi.indexOf("function useEnemyRule("), actionUi.indexOf("function techniquePreview(")), context);
context.Scene = fixture(actor("hero", "hero", 2));
context.Scene.targetIds = ["hero"];
context.useEnemyRule("npc", "lionwing.npc.assassin.slice");
assert.ok(context.Scene.pendingAction, "a critical generated by the NPC button starts the attack");
assert.equal(context.Scene.pendingAction.roll.initialCount, 3);
assert.equal(context.Scene.pendingAction.roll.rolls.length, 4);
scene = commit(context.Scene, engine.respondReaction(context.Scene, data, { actorId: "hero", choice: "pass" }));
scene = commit(clone(scene), engine.resolvePendingAction(scene, data));
assert.equal(scene.actors[1].hp, 16, "all three successes and the isolated-target bonus survive replay");
for (const invalid of [
  { ...criticalRoll, initialCount: 2 },
  { ...criticalRoll, rolls: [4, 4, 1, 5], crits: 0 },
  { ...criticalRoll, rolls: [6, 4, 1], successes: 2 },
  { ...criticalRoll, truncated: true },
]) assert.equal(engine.prepareEnemyRule(fixture(actor("hero", "hero", 2)), data, { actorId: "npc", ruleId: "lionwing.npc.assassin.slice", targetIds: ["hero"], roll: invalid }).ok, false, "inflated, incomplete and truncated critical chains are rejected");

scene = fixture(actor("hero", "hero", 2));
scene = commit(scene, engine.prepareEnemyRule(scene, data, { actorId: "npc", ruleId: "lionwing.npc.assassin.neutralize-target", targetIds: ["hero"] }));
scene = attack(scene);
assert.equal(scene.pendingAction.assassinDisappearAfterAttack, true);
scene = commit(scene, engine.respondReaction(scene, data, { actorId: "hero", choice: "pass" }));
const beforeResolve = clone(scene), resolution = engine.resolvePendingAction(scene, data);
const resolutionEvents = resolution.events.map(event => ({ ...event, id: `enemy-ui-${++serial}` }));
scene = engine.dispatchMany(clone(scene), resolutionEvents).scene;
assert.ok(scene.actors[0].effects.includes("positive.исчез"), "a visible Assassin disappears after attacking its Marked target");
assert.ok(scene.actors[1].effects.includes("negative.помечен"));
assert.ok(lw.reload(JSON.stringify(scene)).actors[0].effects.includes("positive.исчез"), "post-attack disappearance survives reload");
const receipt = scene.log.find(event => event.type === "effect.apply" && event.payload?.effect === "positive.исчез");
assert.ok(receipt?.payload?.sourceRuleId, "the passive records its canonical attack provenance");
const replayed = engine.dispatchMany(clone(scene), resolutionEvents).scene;
assert.equal(replayed.version, scene.version, "replaying the resolution does not deal damage or apply the passive twice");
const cancelled = commit(beforeResolve, engine.cancelPendingAction(beforeResolve));
assert.equal(cancelled.actors[0].effects.includes("positive.исчез"), false, "an explicitly cancelled attack cannot trigger disappearance");

const sceneEvents = read("app-scene-events.js"), directorStart = sceneEvents.indexOf('$("scene-director").addEventListener("click",event=>{');
let directorHandler, received = [];
Object.assign(context, {
  $: () => ({ addEventListener: (_type, handler) => { directorHandler = handler; } }),
  respondCoreReaction: (...args) => received.push(["reaction", ...args]),
  resolveCommittedAction: () => received.push(["resolve"]),
  cancelCommittedAction: () => received.push(["cancel"]),
});
vm.runInContext(sceneEvents.slice(directorStart, sceneEvents.indexOf("\n});", directorStart) + 4), context);
for (const selector of ["data-core-reaction", "data-core-resolve", "data-core-cancel-pending"]) directorHandler({ target: { closest: value => value === `[${selector}]` ? { dataset: { coreReactionActor: "hero", coreReaction: "pass" } } : null } });
assert.deepEqual(received, [["reaction", "hero", "pass"], ["resolve"], ["cancel"]], "the Narrator panel dispatches the shared buttons to the shared pipeline");

const captureStart = lwUi.indexOf('document.addEventListener("click", event => {\n  if (!lwActive()) return;');
let captureHandler;
Object.assign(context, { document: { addEventListener: (_type, handler) => { captureHandler = handler; } }, lwActive: () => true, lwDestination: null });
vm.runInContext(lwUi.slice(captureStart, lwUi.indexOf("\n},true);", captureStart) + "\n},true);".length), context);
context.Scene = attack(fixture(actor("hero", "hero", 2)));
let intercepted = false;
captureHandler({ target: { closest: selector => selector === "[data-core-resolve], [data-core-cancel-pending]" ? {} : null }, preventDefault: () => { intercepted = true; }, stopImmediatePropagation: () => { intercepted = true; } });
assert.equal(intercepted, false, "LionWing capture lets a shared NPC attack reach its shared resolution handler");
console.log("LionWing NPC UI: shared hero defenses, finish controls, NPC auto-pass and serialized resolution passed");
