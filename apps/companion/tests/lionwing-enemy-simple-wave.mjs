import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "lionwing-table-data.js", "logic.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
const engine = context.window.DAWN_SCENE_ENGINE;
const data = context.window.DAWN_DATA;
const actor = (id, team, extra = {}) => ({
  id, name: id, kind: "enemy", heroId: null, rulesEdition: "lionwing", team, space: "main", x: 2, y: 2,
  hp: 20, maxHp: 20, ap: 2, baseAp: 2, focus: 0, tier: 1, speed: 3, armor: 0, evasion: 0,
  effects: [], effectStates: {}, usedActions: [], acted: false, knockedOut: false, lionwing: {}, ...extra,
});
const scene = (profileId, extra = {}, others = []) => ({
  rulesEdition: "lionwing", version: 0, round: 1, turnSerial: 1, activeActorId: "source", tension: 1,
  spaces: [{ id: "main", name: "Main", width: 7, height: 7 }],
  actors: [actor("source", "red", { profileId, ...extra }), ...others],
  objects: [], walls: [], markers: [], areas: [], topology: { cuts: [] }, targetIds: [], targetCells: [],
  reminders: [], rollFeed: [], log: [], triggerQueue: [], lionwing: { entities: {}, entityReceipts: {} },
});
let serial = 0;
const prepare = (current, ruleId, request = {}) => engine.prepareEnemyRule(current, data, { actorId: "source", ruleId, ...request });
const stamp = events => events.map(event => ({ ...event, id: `wave-${serial++}` }));
const commit = (current, prepared) => engine.dispatchMany(current, stamp(prepared.events), { expectedVersion: current.version }).scene;
const actionStatus = (current, id) => engine.availableEnemyRules(current, data, "source").find(rule => rule.id === id);
const ids = {
  heal: "lionwing.npc.healer.heal",
  gloat: "lionwing.npc.daredevil.gloat",
  lick: "lionwing.npc.viper.lick-the-knife",
  stabilize: "lionwing.npc.oni.stabilize",
};

for (const [profile, id] of [["healer", ids.heal], ["daredevil", ids.gloat], ["viper", ids.lick], ["oni", ids.stabilize]]) {
  const current = scene(`lionwing.npc.${profile}`);
  assert.equal(actionStatus(current, id)?.automation, "full", `${id} is connected to the LionWing rule route`);
  assert.equal(actionStatus(current, id)?.available, true);
}

const guardian = actor("guardian", "red", { hp: 2, maxHp: 20 });
const healer = scene("lionwing.npc.healer", { tier: 2, ruleState: { healerGuardianId: "guardian" } }, [guardian]);
const preparedHeal = prepare(healer, ids.heal, { targetIds: ["guardian"] });
assert.equal(preparedHeal.ok, true, preparedHeal.errors?.join(" "));
assert.deepEqual(healer.actors[0].hp, 20, "prepare does not mutate state");
assert.equal(JSON.stringify(healer.actors), JSON.stringify(scene("lionwing.npc.healer", { tier: 2, ruleState: { healerGuardianId: "guardian" } }, [guardian]).actors), "cancel before commit leaves resources and targets unchanged");
const healed = commit(healer, preparedHeal);
assert.equal(healed.actors.find(item => item.id === "guardian").hp, 10, "Guardian receives double (2 + Tier) healing");
assert.equal(healed.actors[0].ap, 1);
assert.equal(actionStatus({ ...healer, actors: healed.actors }, ids.heal)?.available, false, "round use is recorded");
assert.equal(prepare(healer, ids.heal, { targetIds: ["source"] }).ok, false, "Heal cannot target its user because ally excludes the user");
const regularAlly = actor("regular-ally", "red", { kind: "enemy", hp: 2, maxHp: 20 });
const regularHeal = scene("lionwing.npc.healer", { tier: 1 }, [regularAlly]);
const regularPrepared = prepare(regularHeal, ids.heal, { targetIds: ["regular-ally"] });
const cappedTarget = scene("lionwing.npc.healer", { tier: 1 }, [actor("capped-ally", "red", { kind: "enemy", hp: 19, maxHp: 20 })]);
assert.equal(commit(cappedTarget, prepare(cappedTarget, ids.heal, { targetIds: ["capped-ally"] })).actors.find(item => item.id === "capped-ally").hp, 20, "Heal respects the target's max Health");
const forgedHeal = stamp(regularPrepared.events);
forgedHeal.find(event => event.type === "actor.heal").payload.amount += 10;
assert.throws(() => engine.dispatchMany(regularHeal, forgedHeal, { expectedVersion: regularHeal.version }), /формула лечения Heal/i, "forged Heal amount is rejected by the validator");
const forgedHealCost = stamp(regularPrepared.events);
forgedHealCost.find(event => event.type === "resource.spend").payload.amount = 0;
assert.throws(() => engine.dispatchMany(regularHeal, forgedHealCost, { expectedVersion: regularHeal.version }), /ровно 1 ОД/i, "forged Heal cost is rejected by the validator");
const lostGuardian = { ...healer, actors: healer.actors.filter(item => item.id !== "guardian") };
assert.throws(() => engine.dispatchMany(lostGuardian, stamp(preparedHeal.events), { expectedVersion: healer.version }), /цель отсутствует/i, "a missing Heal target is revalidated before payment");
const koGuardian = { ...healer, actors: healer.actors.map(item => item.id === "guardian" ? { ...item, knockedOut: true } : item) };
assert.throws(() => engine.dispatchMany(koGuardian, stamp(preparedHeal.events), { expectedVersion: healer.version }), /выведена из боя/i, "a KO Heal target is revalidated before payment");

const gloat = scene("lionwing.npc.daredevil", { ap: 1 }, [actor("hero", "blue", { kind: "hero", heroId: "hero-1" })]);
const preparedGloat = prepare(gloat, ids.gloat), gloatEvents = stamp(preparedGloat.events);
const gloatResult = engine.dispatchMany(gloat, gloatEvents, { expectedVersion: gloat.version }).scene;
assert.equal(gloatResult.tension, 2, "Gloat raises the shared Tension by exactly one");
assert.equal(gloatResult.actors[0].ap, 0);
assert.equal(gloatResult.log.filter(row => row.type === "scene.tension").length, 1, "shared writer records one Tension change");
assert.equal(engine.dispatchMany(gloatResult, gloatEvents, { expectedVersion: gloat.version }).events.length, 0, "a replayed Gloat does not raise Tension twice");
const staleGloat = prepare(gloat, ids.gloat), staleGloatEvents = stamp(staleGloat.events);
assert.throws(() => engine.dispatchMany({ ...gloat, version: gloat.version + 1 }, staleGloatEvents, { expectedVersion: gloat.version }), /конфликт версии/i, "stale Gloat request is rejected");

const viper = scene("lionwing.npc.viper", { tier: 2 }, [
  actor("blighted-a", "blue", { kind: "hero", heroId: "hero-a", hp: 20, armor: 9, effects: ["negative.порчен"] }),
  actor("blighted-b", "blue", { kind: "hero", heroId: "hero-b", hp: 20, evasion: 2, effects: ["negative.порчен"] }),
  actor("unblighted", "blue", { kind: "hero", heroId: "hero-c", hp: 20 }),
  actor("blighted-npc", "blue", { effects: ["negative.порчен"] }),
]);
const preparedLick = prepare(viper, ids.lick);
assert.equal(preparedLick.ok, true, preparedLick.errors?.join(" "));
const lickEvents = stamp(preparedLick.events);
const lickDamage = preparedLick.events.filter(event => event.type === "damage.apply");
assert.equal(lickDamage.length, 2, "only living Blighted player characters are hit");
assert.ok(lickDamage.every(event => event.payload.amount === 4), "amount is count of Blighted players (2) + Tier (2)");
assert.ok(lickDamage.every(event => event.payload.attack === false && event.payload.sourceActionId === ids.lick), "damage retains provenance without being an Attack");
const afterLick = engine.dispatchMany(viper, lickEvents, { expectedVersion: viper.version }).scene;
assert.equal(afterLick.actors.find(item => item.id === "blighted-a").hp, 16, "non-Attack damage is not reduced by Armor");
assert.equal(afterLick.actors.find(item => item.id === "blighted-b").evasion, 0, "ordinary incoming damage still depletes Evasion");
assert.equal(afterLick.actors.find(item => item.id === "unblighted").hp, 20);
assert.equal(afterLick.actors.find(item => item.id === "blighted-npc").hp, 20, "Blighted NPCs are not Blighted players");
const replay = engine.dispatchMany(afterLick, lickEvents, { expectedVersion: viper.version });
assert.equal(replay.events.length, 0, "a replayed Lick wave is idempotent and deals damage once");
const noBlighted = scene("lionwing.npc.viper", { tier: 2 }, [actor("healthy-player", "blue", { kind: "hero", heroId: "hero-clean" })]);
const emptyLick = prepare(noBlighted, ids.lick);
assert.equal(emptyLick.ok, true, "Lick remains an available Action without Blighted players");
assert.equal(emptyLick.events.filter(event => event.type === "damage.apply").length, 0);
const afterEmptyLick = commit(noBlighted, emptyLick);
assert.equal(afterEmptyLick.actors[0].ap, 1, "empty Lick still pays its AP and records use");
assert.equal(afterEmptyLick.actors[1].hp, 20, "empty Lick does not invent damage");
const forgedLick = stamp(prepare(viper, ids.lick).events);
forgedLick.find(event => event.type === "damage.apply").payload.amount += 1;
assert.throws(() => engine.dispatchMany(viper, forgedLick, { expectedVersion: viper.version }), /Lick The Knife|Blighted players/i, "forged Lick damage is rejected");
const unavailableLick = { ...viper, actors: viper.actors.map(item => item.id === "blighted-a" ? { ...item, knockedOut: true } : item) };
assert.throws(() => engine.dispatchMany(unavailableLick, stamp(preparedLick.events), { expectedVersion: viper.version }), /Lick The Knife|Blighted players|цель/i, "a target knocked out after preview is rejected");
const attackResult = engine.dispatchMany(scene("lionwing.npc.viper", {}, [actor("target", "blue", { kind: "hero", heroId: "hero-z", hp: 20, armor: 3 })]), [
  { id: "ordinary-attack", type: "damage.apply", actorId: "source", payload: { targetId: "target", amount: 5, sourceActionId: "test.attack" } },
]).scene;
assert.equal(attackResult.actors.find(item => item.id === "target").hp, 18, "a normal Attack with sourceActionId still applies Armor");

const oni = scene("lionwing.npc.oni", { effects: ["positive.усилен", "positive.укреплен"] });
const stabilized = commit(oni, prepare(oni, ids.stabilize));
assert.deepEqual(JSON.parse(JSON.stringify(stabilized.actors[0].effects)), ["positive.ускорен"], "Stabilize clears Effects then Hastes the Oni");
assert.equal(stabilized.actors[0].ap, 1);
const preparedOni = prepare(oni, ids.stabilize), forgedOni = stamp(preparedOni.events);
forgedOni.splice(forgedOni.findIndex(event => event.type === "effect.remove"), 1);
assert.throws(() => engine.dispatchMany(oni, forgedOni, { expectedVersion: oni.version }), /Stabilize должен снять все доступные Эффекты/i, "forged partial Effect removal is rejected");
const protectedOni = scene("lionwing.npc.oni", { effects: ["negative.помечен"], effectStates: { "negative.помечен": { sources: [{ sourceId: "locked", removable: false }] } } });
const protectedPreview = prepare(protectedOni, ids.stabilize);
assert.equal(protectedPreview.ok, false, "protected Effects are not silently forced away");
assert.equal(protectedOni.actors[0].ap, 2, "protected removal refusal costs no AP");

const saved = JSON.parse(JSON.stringify(afterLick));
assert.equal(JSON.stringify(saved), JSON.stringify(afterLick), "Lick damage, costs, version and log survive JSON save/reload");
const exportImport = JSON.parse(JSON.stringify({ schema: 1, scene: saved })).scene;
assert.equal(JSON.stringify(exportImport), JSON.stringify(afterLick), "export/import preserves resolved state separately from transient UI state");

console.log("LionWing enemy simple wave: Heal, Gloat, Lick The Knife, guarded Stabilize and non-Attack damage passed");
