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
const sceneUi=fs.readFileSync(new URL("../scene-ui.js",import.meta.url),"utf8"),css=fs.readFileSync(new URL("../app.css",import.meta.url),"utf8");
assert.match(sceneUi,/function enemyAutomationDetails\(rule,state=rule\)/,"enemy actions must explain their automation coverage");
assert.match(sceneUi,/Автоматизировано:/,"enemy cards must label automated behavior");
assert.match(sceneUi,/Вручную:/,"enemy cards must label Narrator-confirmed behavior");
assert.match(css,/\.enemy-automation-note\{/,"enemy automation explanations must have a visible card treatment");

const data = context.window.DAWN_DATA;
const engine = context.window.DAWN_SCENE_ENGINE;
const clone = value => JSON.parse(JSON.stringify(value));
const npcActionIds = [
  "lionwing.npc.assassin.slice",
  "lionwing.npc.bruiser.skulduggery",
  "lionwing.npc.behemoth.tore-from-earth",
  "lionwing.npc.captor.catch-and-release",
  "lionwing.npc.executioner.cleave",
  "lionwing.npc.javelin.crushing-impact",
  "lionwing.npc.pugilist.flurry-of-strikes",
  "lionwing.npc.ranger.take-the-shot",
  "lionwing.npc.ronin.dissect",
  "lionwing.npc.witch.expelling-force",
  "lionwing.npc.glutton.slobber",
  "lionwing.npc.guardian.shove",
  "lionwing.npc.mount.thrash",
  "lionwing.npc.paladin.gift-from-god",
  "lionwing.npc.revenant.tear-from-the-soul",
  "lionwing.npc.bannerman.swing",
  "lionwing.npc.bodyguards.behind-me",
  "lionwing.npc.broodmother.swarming-chase",
  "lionwing.npc.cocoon.rampage",
  "lionwing.npc.builder.violent-construction",
  "lionwing.npc.healer.exsanguinate",
  "lionwing.npc.illusionist.distort-reality",
  "lionwing.npc.martyr.savor-my-blood",
  "lionwing.npc.baron.suppress",
  "lionwing.npc.berserker.thrash",
  "lionwing.npc.cultist.swipe",
  "lionwing.npc.duelist.fleche",
  "lionwing.npc.spright.incision",
  "lionwing.npc.rifter.emerge",
  "lionwing.npc.daredevil.dance",
  "lionwing.npc.enchanter.heartbreaker",
  "lionwing.npc.hound-master.shove",
  "lionwing.npc.necromancer.terrifying-shot",
  "lionwing.npc.privateer.spray-and-pray",
];
const manualActionIds = [
  "lionwing.npc.viper.filet",
  "lionwing.npc.oni.polaris",
  "lionwing.npc.matriarch.destroy-the-interloper",
  "lionwing.npc.coordinator.fanaticize",
  "lionwing.npc.swarm.tear",
];
const fullActionIds = ["lionwing.npc.cannoneer.load"];
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
assert.deepEqual(new Set(npcActionIds.concat(fullActionIds,manualActionIds)), new Set(canonicalAttackIds), "automated, full and manual sets cover every canonical NPC attack exactly once");

// Cannoneer Load is classified as an Attack in the source data, but is a
// deterministic Clock action: +2 Preparation before movement, otherwise +1.
let cannoneer = scene("lionwing.npc.cannoneer");
const loadStatus = engine.availableEnemyRules(cannoneer, data, "enemy").find(item => item.id === "lionwing.npc.cannoneer.load");
assert.equal(loadStatus.automation, "full");
let loaded = commitWithIds(cannoneer, engine.prepareEnemyRule(cannoneer, data, { actorId: "enemy", ruleId: loadStatus.id }), "load-still").result.scene;
assert.equal(engine.clockStatus(loaded, "enemy", "enemy.common.cannoneer.preparation").value, 2, "Load fills two segments when the Cannoneer has not moved");
cannoneer = scene("lionwing.npc.cannoneer", { log: [{ id: "moved", type: "actor.move", actorId: "enemy", payload: { x: 3, y: 2 } }] });
loaded = commitWithIds(cannoneer, engine.prepareEnemyRule(cannoneer, data, { actorId: "enemy", ruleId: loadStatus.id }), "load-moved").result.scene;
assert.equal(engine.clockStatus(loaded, "enemy", "enemy.common.cannoneer.preparation").value, 1, "Load fills one segment after movement");

// Executioner Cleave replaces its first use with Charge, then exposes the
// canonical temporary Speed/Armor and resolves the adjacent two-space Line.
let executioner=scene("lionwing.npc.executioner",{actors:[actor("enemy","enemy",2,2,{profileId:"lionwing.npc.executioner"}),actor("hero-a","hero",3,2),actor("hero-b","hero",4,2)]});
const cleaveStatus=engine.availableEnemyRules(executioner,data,"enemy").find(item=>item.id==="lionwing.npc.executioner.cleave");
assert.equal(cleaveStatus.automation,"attack");
const chargeCleave=engine.prepareEnemyRule(executioner,data,{actorId:"enemy",ruleId:cleaveStatus.id,targetIds:[]});
assert.equal(chargeCleave.ok,true,chargeCleave.errors?.join(" "));
assert.equal(chargeCleave.events.some(event=>event.type==="attack.pending"),false,"the first Cleave is replaced by Charge");
executioner=commitWithIds(executioner,chargeCleave,"cleave-charge").result.scene;
assert.ok(executioner.actors[0].effects.includes("positive.заряжен"));
assert.equal(engine.effectiveActorSpeed(executioner,"enemy"),1);
assert.equal(engine.effectDefenseStatus(executioner,"enemy").armorBonus,3,"Tier 2 charged Executioner gains 1 + Tier Armor");
const cleave=engine.prepareEnemyRule(executioner,data,{actorId:"enemy",ruleId:cleaveStatus.id,targetIds:["hero-a","hero-b"],roll:dice(10,[6,5,4,1,1,1,1,1,1,1])});
assert.equal(cleave.ok,true,cleave.errors?.join(" "));
assert.deepEqual(new Set(cleave.events.find(event=>event.type==="attack.pending").payload.targetIds),new Set(["hero-a","hero-b"]));

// Bodyguards move their Fodder first, then split one mixed selection into
// automatic allied Reinforcement and the ordinary hostile Attack pipeline.
let bodyguards=scene("lionwing.npc.bodyguards",{actors:[
  actor("enemy","enemy",1,1,{profileId:"lionwing.npc.bodyguards",ruleState:{enemyCrowdMovement:{ruleId:"lionwing.npc.bodyguards.behind-me",turnSerial:1}}}),
  actor("fodder","enemy",3,2,{kind:"crowd",heroId:null,profileId:null}),
  actor("ally","enemy",3,3,{profileId:"lionwing.npc.cultist"}),actor("hero","hero",4,2),
]});
const behindStatus=engine.availableEnemyRules(bodyguards,data,"enemy").find(item=>item.id==="lionwing.npc.bodyguards.behind-me");
assert.equal(behindStatus.automation,"attack");
const behind=engine.prepareEnemyRule(bodyguards,data,{actorId:"enemy",ruleId:behindStatus.id,targetIds:["ally","hero"],roll:dice(6,[6,5,1,1,1,1])});
assert.equal(behind.ok,true,behind.errors?.join(" "));
bodyguards=commitWithIds(bodyguards,behind,"behind-me").result.scene;
assert.ok(bodyguards.actors.find(item=>item.id==="ally").effects.includes("positive.укреплен"),"Behind Me Reinforces allied targets immediately");
bodyguards=passAndResolve(bodyguards,"behind-me");
assert.ok(bodyguards.actors.find(item=>item.id==="hero").effects.includes("negative.ошеломлен"),"Behind Me Dazes an untouched opponent after damage");

// Broodmother moves as a one-cell group, derives only opponents newly entered
// into adjacency, and counts the Fodder that actually follows her destination.
let broodmother=scene("lionwing.npc.broodmother",{actors:[
  actor("enemy","enemy",2,2,{profileId:"lionwing.npc.broodmother"}),
  actor("fodder","enemy",2,1,{kind:"crowd",heroId:null,profileId:null}),
  actor("ally","enemy",1,2,{profileId:"lionwing.npc.cultist"}),
  actor("hero","hero",4,2),
]});
const chaseStatus=engine.availableEnemyRules(broodmother,data,"enemy").find(item=>item.id==="lionwing.npc.broodmother.swarming-chase");
assert.equal(chaseStatus.automation,"attack");
const chase=engine.prepareEnemyRule(broodmother,data,{actorId:"enemy",ruleId:chaseStatus.id,options:{destination:{x:3,y:2}},targetIds:[],roll:dice(5,[6,5,1,1,1])});
assert.equal(chase.ok,true,chase.errors?.join(" "));
const chasePending=chase.events.find(event=>event.type==="attack.pending");
assert.deepEqual(chasePending.payload.targetIds,["hero"],"Swarming Chase derives the newly adjacent opponent");
assert.equal(chasePending.payload.damageByTarget.hero,5,"Swarming Chase includes one following adjacent Fodder Zone");
broodmother=commitWithIds(broodmother,chase,"swarming-chase").result.scene;
assert.deepEqual([broodmother.actors.find(item=>item.id==="enemy").x,broodmother.actors.find(item=>item.id==="enemy").y],[3,2]);
assert.deepEqual([broodmother.actors.find(item=>item.id==="fodder").x,broodmother.actors.find(item=>item.id==="fodder").y],[3,1]);

// Cocoon Rampage performs its unrestricted straight move, then repeats with
// the LionWing Tension multiplier against fresh adjacent targets.
let cocoon=scene("lionwing.npc.cocoon",{actors:[
  actor("enemy","enemy",2,2,{profileId:"lionwing.npc.cocoon"}),
  actor("hero","hero",4,2),actor("hero-b","hero",3,3),
]});
const rampageStatus=engine.availableEnemyRules(cocoon,data,"enemy").find(item=>item.id==="lionwing.npc.cocoon.rampage");
assert.equal(rampageStatus.automation,"attack");
const rampage=engine.prepareEnemyRule(cocoon,data,{actorId:"enemy",ruleId:rampageStatus.id,options:{destination:{x:3,y:2}},targetIds:["hero"],roll:dice(5,[6,5,1,1,1])});
assert.equal(rampage.ok,true,rampage.errors?.join(" "));
cocoon=commitWithIds(cocoon,rampage,"rampage").result.scene;
cocoon=passAndResolve(cocoon,"rampage");
assert.equal(cocoon.pendingPrompt?.kind,"enemy-cocoon-repeat");
assert.equal(cocoon.pendingPrompt?.context?.ruleId,"lionwing.npc.cocoon.rampage");
const repeated=engine.respondRulePrompt(cocoon,data,{actorId:"enemy",choice:"target:hero-b",roll:dice(5,[6,5,1,1,1])});
assert.equal(repeated.ok,true,repeated.errors?.join(" "));
const repeatedPending=repeated.events.find(event=>event.type==="attack.pending");
assert.equal(repeatedPending.payload.damage,4,"LionWing repeat uses Hits + Tension, not the retired Tension × 2 rule");

// Duelist Fleche reuses the shared Attack and post-resolution movement
// contracts while its passive binds Provoked to this Duelist.
let duelist = scene("lionwing.npc.duelist", { actors: [actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.duelist" }), actor("hero", "hero", 4, 2, { effects: ["negative.спровоцирован"] })] });
const flecheStatus = engine.availableEnemyRules(duelist, data, "enemy").find(item => item.id === "lionwing.npc.duelist.fleche");
assert.equal(flecheStatus.automation, "attack");
const flechePrepared = engine.prepareEnemyRule(duelist, data, { actorId: "enemy", ruleId: flecheStatus.id, targetIds: ["hero"], roll: dice(6, [6,5,1,1,1,1]) });
assert.equal(flechePrepared.ok, true, flechePrepared.errors?.join(" "));
assert.equal(flechePrepared.events.find(event => event.type === "attack.pending").payload.damageByTarget.hero, 6, "Fleche adds Tier damage against a Provoked target");
duelist = commitWithIds(duelist, flechePrepared, "fleche").result.scene;
duelist = passAndResolve(duelist, "fleche");
assert.equal(duelist.actors.find(item => item.id === "hero").hp, 24);
assert.equal(duelist.pendingPrompt?.kind, "enemy-move-cell", "Fleche offers its one-space post-Attack movement");

// Spright Incision teleports only after a successful hit and constrains the
// board picker to the farthest available spaces adjacent to the target.
let spright = scene("lionwing.npc.spright");
const incisionStatus = engine.availableEnemyRules(spright, data, "enemy").find(item => item.id === "lionwing.npc.spright.incision");
assert.equal(incisionStatus.automation, "attack");
const incisionPrepared = engine.prepareEnemyRule(spright, data, { actorId: "enemy", ruleId: incisionStatus.id, targetIds: ["hero"], roll: dice(6, [6,5,1,1,1,1]) });
assert.equal(incisionPrepared.ok, true, incisionPrepared.errors?.join(" "));
spright = commitWithIds(spright, incisionPrepared, "incision").result.scene;
spright = passAndResolve(spright, "incision");
assert.equal(spright.pendingPrompt?.context?.teleportFarthestAdjacent, true);
assert.equal(engine.preparePromptPlacement(spright, { actorId:"enemy", role:"narrator", destination:{x:2,y:2} }).ok, false, "Incision rejects a nearer adjacent space");
const incisionTeleport = engine.preparePromptPlacement(spright, { actorId:"enemy", role:"narrator", destination:{x:4,y:2} });
assert.equal(incisionTeleport.ok, true, incisionTeleport.errors?.join(" "));
const incisionMove=incisionTeleport.events.find(event=>event.type==="actor.move");
assert.deepEqual([incisionMove.payload.x,incisionMove.payload.y],[4,2]);
assert.equal(incisionMove.payload.teleport,true,"Incision commits its destination as a Teleport");

// Rifter Emerge derives every adjacent character after the Teleport instead
// of trusting a partial target selection, then uses the shared Attack flow.
let rifter=scene("lionwing.npc.rifter",{actors:[
  actor("enemy","enemy",1,2,{profileId:"lionwing.npc.rifter"}),
  actor("hero-a","hero",4,1),actor("hero-b","hero",5,2),
  actor("ally","enemy",4,3,{profileId:"lionwing.npc.cultist"}),
]});
const emergeStatus=engine.availableEnemyRules(rifter,data,"enemy").find(item=>item.id==="lionwing.npc.rifter.emerge");
assert.equal(emergeStatus.automation,"attack");
const emergePrepared=engine.prepareEnemyRule(rifter,data,{actorId:"enemy",ruleId:emergeStatus.id,options:{destination:{x:4,y:2}},targetIds:[],roll:dice(6,[6,5,1,1,1,1])});
assert.equal(emergePrepared.ok,true,emergePrepared.errors?.join(" "));
assert.deepEqual(new Set(emergePrepared.events.find(event=>event.type==="attack.pending").payload.targetIds),new Set(["hero-a","hero-b","ally"]),"Emerge attacks every adjacent character, including allies");
assert.equal(emergePrepared.events.filter(event=>event.type==="marker.create"&&event.payload.markerKind==="rift").length,2,"Emerge creates Rifts at departure and arrival");
rifter=commitWithIds(rifter,emergePrepared,"emerge").result.scene;
assert.deepEqual([rifter.actors.find(item=>item.id==="enemy").x,rifter.actors.find(item=>item.id==="enemy").y],[4,2]);
assert.ok(rifter.pendingAction,"Emerge opens the ordinary Reaction and damage pipeline");

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

// Viper Filet has an explicit two-path choice in the canonical English text:
// adjacent after the Passive, or up to 5 spaces when the Narrator declines
// the Passive. Until that choice is represented in the action UI, keep the
// attack assisted so the Narrator can resolve either path without the engine
// silently enforcing only the adjacent branch.
let viper = scene("lionwing.npc.viper", { actors: [actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.viper" }), actor("hero", "hero", 3, 2, { effects: ["negative.порчен"] })] });
const filetStatus = engine.availableEnemyRules(viper, data, "enemy").find(item => item.id === "lionwing.npc.viper.filet");
assert.equal(filetStatus.automation, "assisted", "Viper Filet remains manual until its Passive choice is modeled");
const filet = engine.prepareEnemyRule(viper, data, { actorId: "enemy", ruleId: "lionwing.npc.viper.filet", targetIds: ["hero"], roll: dice(5, [6, 5, 4, 1, 2]) });
assert.equal(filet.ok, true, filet.errors?.join(" "));
assert.equal(filet.events.some(event => event.type === "attack.pending"), false, "assisted Filet leaves damage and effects to the Narrator");
assert.equal(filet.events.find(event => event.type === "enemy.action.prepare")?.payload?.automation, "assisted");
const offTurnViper=scene("lionwing.npc.viper",{activeActorId:"hero",actors:[actor("enemy","enemy",2,2,{profileId:"lionwing.npc.viper",acted:true,ap:1}),actor("hero","hero",3,2)]});
const offTurnFilet=engine.prepareEnemyRule(offTurnViper,data,{actorId:"enemy",ruleId:"lionwing.npc.viper.filet",targetIds:["hero"],roll:dice(5,[6,5,4,1,2])});
assert.equal(offTurnFilet.ok,true,"Narrator-assisted attacks remain usable outside the enemy Turn");
assert.ok(offTurnFilet.events.some(event=>event.type==="resource.spend"&&event.payload.resource==="ap"&&event.payload.amount===1),"off-Turn assisted attacks still spend canonical AP");
const offTurnNoAp=scene("lionwing.npc.viper",{activeActorId:"hero",actors:[actor("enemy","enemy",2,2,{profileId:"lionwing.npc.viper",acted:true,ap:0}),actor("hero","hero",3,2)]});
assert.equal(engine.prepareEnemyRule(offTurnNoAp,data,{actorId:"enemy",ruleId:"lionwing.npc.viper.filet",targetIds:["hero"],roll:dice(5,[6,5,4,1,2])}).ok,false,"Narrator flexibility never bypasses AP accounting");
const distantViper = scene("lionwing.npc.viper", { actors: [actor("enemy", "enemy", 2, 2, { profileId: "lionwing.npc.viper" }), actor("hero", "hero", 6, 2, { effects: ["negative.порчен"] })] });
assert.equal(engine.prepareEnemyRule(distantViper, data, { actorId: "enemy", ruleId: "lionwing.npc.viper.filet", targetIds: ["hero"], roll: dice(5, [6, 5, 4, 1, 2]) }).ok, true, "manual Filet can represent the non-Passive target path");

// Builder uses its canonical tier-scaled direct damage without accepting an
// invented roll.

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
