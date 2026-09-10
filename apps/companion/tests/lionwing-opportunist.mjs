import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
loadSceneEngine(context);
const engine = context.window.DAWN_LIONWING_ENGINE, adapters = context.window.DAWN_LIONWING_ADAPTERS;
const digest = { 1: "f0492855d27579faf8b5030f09909996a4248a7d2367d8b8805f3942ce0bd4e2", 2: "4428e0016f97c612a78e62f5229be16a4b71ec6043a44d1599195d77e81ae62f", 3: "4d949a7772b7991cf858b6076c5df703fbb138721a7b62cb591511d732692b37" };
const actor = (id, team, x, extra = {}) => ({ id, name: id, kind: team === "hero" ? "hero" : "enemy", heroId: team === "hero" ? id : null, rulesEdition: "lionwing", team, space: "main", x, y: 1, hp: 10, maxHp: 10, ap: 3, baseAp: 3, focus: 2, influence: 0, wounds: 0, stress: 0, tier: 2, speed: 4, armor: 0, evasion: 0, attrs: { body: 2, talent: 2, spirit: 2, mind: 2 }, effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, knownTechniques: {}, techniques: {}, lionwing: { automation: {} }, ...extra });
const fixture = owner => ({ rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "ally", spaces: [{ id: "main", width: 7, height: 7 }], actors: [owner, actor("ally", "hero", 1), actor("enemy", "enemy", 4)], objects: [], walls: [], markers: [], log: [], targetIds: [], reminders: [], rollFeed: [], lionwing: { schema: 2, sceneSerial: 1, choices: [], deferred: [], receipts: [], history: [], afterEventReceipts: [], boundaryReceipts: [], auras: [], compounds: {}, sceneSerial: 1 } });
const triggerRow = (id, type, payload) => ({ id, type, actorId: "ally", payload, execution: { rootActionId: id, actionInstanceId: payload.actionInstanceId || id, ownerActorId: "ally" } });
const setup = (level, row) => { const owner = actor("owner", "hero", 2, { knownTechniques: { "vagabond.opportunist": level }, attrs: { body: 2, talent: 3, spirit: 2, mind: 2 } }); owner.lionwing.automation[`vagabond.opportunist.${level}`] = true; const scene = fixture(owner); scene.log.unshift(row); scene.lionwing.afterEventReceipts.push({ key: `1:1:owner:vagabond.opportunist.${level}`, ruleId: `vagabond.opportunist.${level}`, ownerActorId: "owner", eventId: row.id }); return scene; };
const row1 = triggerRow("ally-attack", "action.resolve", { actionId: "action.атаки.стычка", actionInstanceId: "attack-1", targetIds: ["enemy"], target: 999, range: 999 });
const direct = adapters.afterEvent(setup(1, row1).actors[0], row1, { scene: setup(1, row1) });
assert.equal(direct.length, 1);
assert.equal(direct[0].sourceDigest, digest[1]);
assert.equal(direct[0].choices[0].id, "skirmish");
assert.equal(adapters.afterEvent(setup(1, row1).actors[0], { ...row1, actorId: "owner" }, { scene: setup(1, row1) }).length, 0, "self trigger rejected");
const noFocus = setup(2, row1); noFocus.actors[0].focus = 0;
assert.equal(adapters.afterEvent(noFocus.actors[0], row1, { scene: noFocus }).length, 0, "Hungry Eyes requires an available Focus");
const far = setup(1, { ...row1, id: "far", payload: { ...row1.payload, targetIds: ["enemy"] } }); far.actors.find(a => a.id === "enemy").x = 6;
assert.equal(adapters.afterEvent(far.actors[0], far.log[0], { scene: far }).length, 0, "out of Talent range rejected");

let scene = setup(1, row1);
let prepared = engine.prepare(scene, { actorId: "owner", eventId: "open-1", kind: "opportunist-skirmish-open", targetId: "enemy", ruleId: "vagabond.opportunist.1", triggerKey: "1:1:owner:vagabond.opportunist.1", causeEventId: row1.id, sourceDigest: digest[1] }, { random: () => 0 });
assert.equal(prepared.ok, true, prepared.errors?.join(" "));
scene = engine.dispatchMany(scene, prepared.events, { random: () => 0 }).scene;
assert.equal(scene.lionwing.choices[0].kind, "technique-trigger");
const beforeFocus = scene.actors.find(a => a.id === "owner").focus;
const pending = scene.lionwing.choices[0];
scene = engine.dispatchMany(scene, [{ type: "lionwing.command", id: "cancel-1", actorId: "owner", payload: { kind: "choice", id: pending.id, choice: "skip" } }]).scene;
assert.equal(scene.actors.find(a => a.id === "owner").focus, beforeFocus, "cancel before optional action does not spend Focus");
assert.equal(scene.lionwing.afterEventReceipts.filter(r => r.ruleId === "vagabond.opportunist.1").length, 1);

scene = setup(1, row1);
prepared = engine.prepare(scene, { actorId: "owner", eventId: "open-2", kind: "opportunist-skirmish-open", targetId: "enemy", ruleId: "vagabond.opportunist.1", triggerKey: "1:1:owner:vagabond.opportunist.1", causeEventId: row1.id, sourceDigest: digest[1] }, { random: () => 0 });
scene = engine.dispatchMany(scene, prepared.events, { random: () => 0 }).scene;
const teleportChoice = scene.lionwing.choices[0], teleportOption = teleportChoice.options.find(option => option !== "skip");
assert.ok(teleportOption, "out of range trigger offers a checked adjacent destination");
const beforeAp = scene.actors.find(a => a.id === "owner").ap;
 const chosenResult = engine.dispatchMany(scene, [{ type: "lionwing.command", id: "choose-2", actorId: "owner", payload: { kind: "choice", id: teleportChoice.id, choice: teleportOption } }], { random: () => 0 });
scene = chosenResult.scene;
assert.equal(scene.actors.find(a => a.id === "owner").ap, beforeAp, "free Pack Tactics does not spend AP");
assert.equal(scene.pendingAction?.actorId, "owner");
assert.equal(scene.pendingAction?.targetIds?.join(","), "enemy");

let markScene = setup(2, row1); markScene.lionwing.afterEventReceipts[0].key = `${row1.id}:owner:vagabond.opportunist.2`;
let markPlan = engine.prepare(markScene, { actorId: "owner", eventId: "mark-1", kind: "opportunist-mark", targetId: "enemy", ruleId: "vagabond.opportunist.2", triggerKey: "ally-attack:owner:vagabond.opportunist.2", causeEventId: row1.id, sourceDigest: digest[2], actionInstanceId: "attack-1" }, { random: () => 0 });
assert.equal(markPlan.ok, true, markPlan.errors?.join(" "));
markScene = engine.dispatchMany(markScene, markPlan.events, { random: () => 0 }).scene;
assert.equal(markScene.actors.find(a => a.id === "owner").focus, 1, "Hungry Eyes spends exactly one Focus after confirmation");
assert.ok(markScene.actors.find(a => a.id === "enemy").effects.includes("negative.помечен"), "Hungry Eyes applies Mark to the authoritative target");
const staleMark = setup(2, row1); staleMark.lionwing.afterEventReceipts[0].key = `${row1.id}:owner:vagabond.opportunist.2`; staleMark.actors.find(a => a.id === "owner").focus = 0;
assert.throws(() => engine.dispatchMany(staleMark, markPlan.events, { random: () => 0 }), /Фокуса|устарел|недоступен/i, "stale Focus is revalidated before payment");

const row2 = triggerRow("ally-effect", "effect.apply", { targetId: "enemy", effect: "negative.ослаблен", range: 999, sourceActorId: "owner" });
const s2 = setup(3, row2); const t2 = adapters.afterEvent(s2.actors[0], row2, { scene: s2 }); assert.equal(t2.length, 1); assert.equal(t2[0].sourceDigest, digest[3]);
const row2bad = { ...row2, actorId: "enemy" }; assert.equal(adapters.afterEvent(s2.actors[0], row2bad, { scene: s2 }).length, 0, "enemy event rejected");
assert.equal(adapters.afterEvent(s2.actors[0], { ...row2, id: "different", payload: { ...row2.payload, targetId: "owner" } }, { scene: s2 }).length, 0, "self target rejected");

console.log("LionWing Opportunist I–III: canonical digests, ally/self/enemy guards, exact Talent range, optional cancel and trigger isolation passed");
