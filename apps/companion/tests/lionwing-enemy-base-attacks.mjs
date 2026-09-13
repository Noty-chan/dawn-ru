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

const data = context.window.DAWN_DATA;
const engine = context.window.DAWN_SCENE_ENGINE;
const clone = value => JSON.parse(JSON.stringify(value));
const npcActionIds = [
  "lionwing.npc.assassin.slice",
  "lionwing.npc.bruiser.skulduggery",
  "lionwing.npc.behemoth.tore-from-earth",
  "lionwing.npc.captor.catch-and-release",
  "lionwing.npc.javelin.crushing-impact",
  "lionwing.npc.pugilist.flurry-of-strikes",
  "lionwing.npc.ranger.take-the-shot",
  "lionwing.npc.ronin.dissect",
  "lionwing.npc.viper.filet",
  "lionwing.npc.witch.expelling-force",
  "lionwing.npc.glutton.slobber",
  "lionwing.npc.guardian.shove",
  "lionwing.npc.mount.thrash",
  "lionwing.npc.paladin.gift-from-god",
  "lionwing.npc.revenant.tear-from-the-soul",
  "lionwing.npc.bannerman.swing",
  "lionwing.npc.builder.violent-construction",
  "lionwing.npc.healer.exsanguinate",
  "lionwing.npc.illusionist.distort-reality",
  "lionwing.npc.martyr.savor-my-blood",
  "lionwing.npc.baron.suppress",
  "lionwing.npc.berserker.thrash",
  "lionwing.npc.cultist.swipe",
  "lionwing.npc.daredevil.dance",
  "lionwing.npc.enchanter.heartbreaker",
  "lionwing.npc.hound-master.shove",
  "lionwing.npc.necromancer.terrifying-shot",
  "lionwing.npc.privateer.spray-and-pray",
];
const manualActionIds = [
  "lionwing.npc.executioner.cleave",
  "lionwing.npc.bodyguards.behind-me",
  "lionwing.npc.broodmother.swarming-chase",
  "lionwing.npc.cocoon.rampage",
  "lionwing.npc.duelist.fleche",
  "lionwing.npc.oni.polaris",
  "lionwing.npc.spright.incision",
  "lionwing.npc.matriarch.destroy-the-interloper",
  "lionwing.npc.coordinator.fanaticize",
  "lionwing.npc.cannoneer.load",
  "lionwing.npc.rifter.emerge",
  "lionwing.npc.swarm.tear",
];
const actor = (id, team, x, y, extra = {}) => ({
  id,
  name: id,
  kind: team === "hero" ? "hero" : "enemy",
  heroId: team === "hero" ? id : null,
  rulesEdition: "lionwing",
  team,
  space: "main",
  x,
  y,
  hp: team === "hero" ? 30 : 25,
  maxHp: team === "hero" ? 30 : 25,
  ap: 3,
  baseAp: 3,
  focus: 6,
  influence: 2,
  wounds: 0,
  stress: 0,
  tier: 2,
  speed: 4,
  armor: 0,
  evasion: 0,
  attrs: { body: 3, talent: 3, spirit: 3, mind: 3 },
  effects: [],
  effectStates: {},
  usedActions: [],
  acted: false,
  knockedOut: false,
  knownTechniques: {},
  techniques: {},
  lionwing: {},
  ...extra,
});
const scene = (profileId, extra = {}) => ({
  rulesEdition: "lionwing",
  version: 0,
  round: 1,
  turnSerial: 1,
  activeActorId: "enemy",
  tension: 2,
  spaces: [{ id: "main", name: "Main", width: 9, height: 7 }],
  actors: [
    actor("enemy", "enemy", 2, 2, { profileId }),
    actor("hero", "hero", 3, 2),
  ],
  objects: [],
  walls: [],
  markers: [],
  areas: [],
  topology: { cuts: [] },
  targetIds: [],
  targetCells: [],
  reminders: [],
  rollFeed: [],
  log: [],
  triggerQueue: [],
  lionwing: { entities: {}, entityReceipts: {} },
  ...extra,
});
const dice = (count, values = null) => {
  const rolls = values || Array.from({ length: count }, (_, index) => index === 0 ? 6 : index === 1 ? 5 : 1);
  return { formula: `${rolls.length}D6`, rolls, successes: rolls.filter(value => value >= 4).length, crits: rolls.filter(value => value === 6).length };
};
const commitWithIds = (s, prepared, prefix) => {
  const events = prepared.events.map((event, index) => ({ ...event, id: `${prefix}:${index}` }));
  return { events, result: engine.dispatchMany(s, events), prepared };
};
const passAndResolve = (s, prefix) => {
  const response = engine.respondReaction(s, data, { actorId: "hero", choice: "pass" });
  assert.equal(response.ok, true, response.errors?.join(" "));
  const answered = engine.dispatchMany(s, response.events.map((event, index) => ({ ...event, id: `${prefix}:response:${index}` }))).scene;
  const resolved = engine.resolvePendingAction(answered, data);
  assert.equal(resolved.ok, true, resolved.errors?.join(" "));
  return engine.dispatchMany(answered, resolved.events.map((event, index) => ({ ...event, id: `${prefix}:resolve:${index}` }))).scene;
};

// Canonical actions are exposed through the GM query and carry the reviewed
// automation status/source digest; complex clauses remain assisted.
const available = engine.availableEnemyRules(scene("lionwing.npc.guardian"), data, "enemy");
assert.ok(available.length >= 2, "canonical profile actions are visible to the GM query");
assert.ok(engine.availableEnemyRules(scene("lionwing.npc.guardian"), context.window.DAWN_LIONWING_DATA, "enemy").some(item => item.id === "lionwing.npc.guardian.shove"), "canonical edition data is accepted directly by the profile bridge");
const canonicalNpcs = context.window.DAWN_LIONWING_DATA.coreRules.npcs.list;
const canonicalAttackIds = canonicalNpcs.flatMap(profile => (profile.actions || []).filter(action => action.kind === "attack").map(action => action.id));
assert.equal(canonicalAttackIds.length, 40, "all canonical NPC attack actions are audited");
for (const id of npcActionIds) {
  const profile = id.split(".").slice(0, 3).join(".");
  const current = scene(profile);
  const status = engine.availableEnemyRules(current, data, "enemy").find(item => item.id === id);
  assert.ok(status, `${id} exists in canonical profile`);
  assert.equal(status.automation, "attack", `${id} is automated through the shared Attack pipeline`);
  assert.equal(status.sourceDigest, "sha256:1228663d26bf3c87b3b94b0d2f3c4c02b302007df98aa407c40d13ee731c175f");
}
for (const id of manualActionIds) {
  const profile = id.split(".").slice(0, 3).join(".");
  const status = engine.availableEnemyRules(scene(profile), data, "enemy").find(item => item.id === id);
  assert.ok(status, `${id} exists in canonical profile`);
  assert.equal(status.automation, "assisted", `${id} retains manual fallback`);
}
const canonicalAceIds = canonicalNpcs.flatMap(profile => profile.ace?.id ? [profile.ace.id] : []);
for (const id of canonicalAceIds) {
  const profile = id.split(".").slice(0, 3).join(".");
  const status = engine.availableEnemyRules(scene(profile), data, "enemy").find(item => item.id === id);
  assert.ok(status, `${id} exists in canonical profile`);
  assert.equal(status.automation, "assisted", `${id} retains manual fallback`);
}
assert.deepEqual(new Set(npcActionIds.concat(manualActionIds)), new Set(canonicalAttackIds), "automated and manual sets cover every canonical NPC attack exactly once");

// Guardian Shove: preview does not mutate, commit spends AP and opens the
// ordinary Reaction window, then the normal resistance/evasion/damage reducer
// applies Launch, push, and source provenance.
let current = scene("lionwing.npc.guardian");
const shove = engine.availableEnemyRules(current, data, "enemy").find(item => item.id === "lionwing.npc.guardian.shove");
assert.equal(shove.automation, "attack");
const preparedShove = engine.prepareEnemyRule(current, data, {
  actorId: "enemy",
  ruleId: shove.id,
  targetIds: ["hero"],
  roll: dice(5, [6, 5, 4, 1, 2]),
});
assert.equal(preparedShove.ok, true, preparedShove.errors?.join(" "));
const pendingEvent = preparedShove.events.find(event => event.type === "attack.pending");
assert.equal(pendingEvent.payload.sourceRuleId, shove.id);
assert.equal(pendingEvent.payload.sourceDigest, shove.sourceDigest);
const beforePreview = clone(current);
const preview = engine.previewEvents(current, preparedShove.events.map((event, index) => ({ ...event, id: `shove:preview:${index}` })));
assert.equal(preview.ok, true, preview.errors?.join(" "));
assert.deepEqual(current, beforePreview, "preview leaves the source Scene unchanged");
const committedShove = commitWithIds(current, preparedShove, "shove");
current = committedShove.result.scene;
assert.equal(current.actors.find(item => item.id === "enemy").ap, 2, "canonical AP cost is paid once");
assert.equal(current.pendingAction.enemyRuleId, shove.id);
current = passAndResolve(current, "shove");
assert.equal(current.pendingAction, null);
assert.equal(current.actors.find(item => item.id === "hero").hp, 25, "damage uses successes plus Scene Tension through the shared reducer");
assert.ok(current.actors.find(item => item.id === "hero").effects.includes("negative.подброшен"), "direct canonical Launch effect is applied");
assert.equal(current.actors.find(item => item.id === "hero").x, 5, "canonical push is committed through displacement validation");

// Effects and direct damage: Viper applies Blight and then Mark when the
// target was already Blighted; Builder uses its canonical tier-scaled direct
// damage without accepting an invented roll.
let viper = scene("lionwing.npc.viper", { actors: [actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.viper" }), actor("hero", "hero", 3, 2, { effects: ["negative.порчен"] })] });
const filet = engine.prepareEnemyRule(viper, data, { actorId: "enemy", ruleId: "lionwing.npc.viper.filet", targetIds: ["hero"], roll: dice(5, [6, 5, 4, 1, 2]) });
assert.equal(filet.ok, true, filet.errors?.join(" "));
viper = engine.dispatchMany(viper, filet.events.map((event, index) => ({ ...event, id: `filet:${index}` }))).scene;
viper = passAndResolve(viper, "filet");
assert.ok(viper.actors.find(item => item.id === "hero").effects.includes("negative.порчен"));
assert.ok(viper.actors.find(item => item.id === "hero").effects.includes("negative.помечен"), "conditional Blight to Mark effect is applied");

let builder = scene("lionwing.npc.builder", { actors: [actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.builder" }), actor("hero", "hero", 3, 2)] });
const construction = engine.prepareEnemyRule(builder, data, { actorId: "enemy", ruleId: "lionwing.npc.builder.violent-construction", targetIds: ["hero"] });
assert.equal(construction.ok, true, construction.errors?.join(" "));
assert.ok(construction.events.some(event => event.type === "attack.pending" && event.payload.damage === 4));
assert.equal(engine.prepareEnemyRule(builder, data, { actorId: "enemy", ruleId: "lionwing.npc.builder.violent-construction", targetIds: ["hero"], roll: dice(1, [6]) }).ok, false, "direct-damage actions reject an invented roll");

// Area/line targeting and range/space/ownership guards are checked before AP
// payment. Privateer uses an adjacent two-cell Line with two hostile targets.
let privateer = scene("lionwing.npc.privateer", { actors: [
  actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.privateer" }),
  actor("hero-a", "hero", 3, 2),
  actor("hero-b", "hero", 4, 2),
  actor("hero-c", "hero", 3, 3),
] });
const spray = engine.prepareEnemyRule(privateer, data, { actorId: "enemy", ruleId: "lionwing.npc.privateer.spray-and-pray", targetIds: ["hero-a", "hero-b"], roll: dice(5, [6, 5, 4, 1, 2]) });
assert.equal(spray.ok, true, spray.errors?.join(" "));
assert.equal(spray.events.find(event => event.type === "attack.pending").payload.targetIds.length, 2);
assert.equal(engine.prepareEnemyRule(privateer, data, { actorId: "enemy", ruleId: "lionwing.npc.privateer.spray-and-pray", targetIds: ["hero-a", "hero-c"], roll: dice(5, [6, 5, 4, 1, 2]) }).ok, false, "a non-line target selection is rejected");
assert.equal(engine.prepareEnemyRule(privateer, data, { actorId: "enemy", ruleId: "lionwing.npc.privateer.spray-and-pray", targetIds: ["missing"], roll: dice(5, [6, 5, 4, 1, 2]) }).ok, false, "a missing target is rejected");
privateer.walls = [{ id: "wall", space: "main", a: { x: 2, y: 2 }, b: { x: 3, y: 2 } }];
assert.equal(engine.prepareEnemyRule(privateer, data, { actorId: "enemy", ruleId: "lionwing.npc.privateer.spray-and-pray", targetIds: ["hero-a"], roll: dice(5, [6, 5, 4, 1, 2]) }).ok, false, "a wall blocks target resolution");

// AP and target state are enforced before event creation.
const noAp = scene("lionwing.npc.guardian", { actors: [actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.guardian", ap: 0 }), actor("hero", "hero", 3, 2)] });
const noApStatus = engine.availableEnemyRules(noAp, data, "enemy").find(item => item.id === "lionwing.npc.guardian.shove");
assert.equal(noApStatus.available, false);
assert.match(noApStatus.reason, /ОД/);
assert.equal(engine.prepareEnemyRule(noAp, data, { actorId: "enemy", ruleId: noApStatus.id, targetIds: ["hero"], roll: dice(5, [6, 5, 4, 1, 2]) }).ok, false, "wrong AP is rejected");
const knocked = scene("lionwing.npc.guardian", { actors: [actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.guardian" }), actor("hero", "hero", 3, 2, { knockedOut: true })] });
assert.equal(engine.prepareEnemyRule(knocked, data, { actorId: "enemy", ruleId: "lionwing.npc.guardian.shove", targetIds: ["hero"], roll: dice(5, [6, 5, 4, 1, 2]) }).ok, false, "a knocked-out target is rejected");

// Roll pool, canonical provenance, stale preview, and replay/idempotency are
// checked at the event boundary.
const forgedRoll = engine.prepareEnemyRule(scene("lionwing.npc.guardian"), data, { actorId: "enemy", ruleId: "lionwing.npc.guardian.shove", targetIds: ["hero"], roll: dice(4, [6, 5, 4, 1]) });
assert.equal(forgedRoll.ok, false, "a roll with the wrong canonical pool is rejected");
const staleEvents = committedShove.events.map(event => ({ ...event, id: `stale:${event.id}` }));
assert.throws(() => engine.dispatchMany({ ...clone(beforePreview), version: 1 }, staleEvents, { expectedVersion: 0 }), /ожидалась|устар|Конфликт версии/);
const replay = engine.dispatchMany(current, committedShove.events);
assert.deepEqual(replay.scene, current, "replaying committed event ids is idempotent");
assert.equal(replay.events.length, 0);
const forgedSource = clone(committedShove.events.find(event => event.type === "attack.pending"));
forgedSource.id = "forged-source";
forgedSource.payload.sourceDigest = "sha256:stale";
assert.throws(() => engine.dispatch(current, forgedSource), /Источник|digest|canonical/);

console.log(`LionWing enemy base attacks: ${npcActionIds.length} automated canonical attacks, ${manualActionIds.length} manual attack fallbacks, ${canonicalAceIds.length} manual Aces, shared reaction/effect/damage pipeline, guards, stale/replay/idempotency passed`);
