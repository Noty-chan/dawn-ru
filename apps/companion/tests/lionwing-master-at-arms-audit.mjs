import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtime, fixture, actor, clone, exactReplay, rejectedWithoutMutation } from "./helpers/scene-contract-harness.mjs";

const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const companionRoot = path.join(testsRoot, "..");
const repoRoot = path.join(companionRoot, "..", "..");
const editionRoot = path.join(repoRoot, "source", "editions", "dawn-en-lionwing-cb2f8e67");
const canonical = JSON.parse(fs.readFileSync(path.join(editionRoot, "extracted-companion.json"), "utf8"));
const sourceMeta = JSON.parse(fs.readFileSync(path.join(repoRoot, "source", "text-sources.json"), "utf8")).sources.en;
const registry = JSON.parse(fs.readFileSync(path.join(companionRoot, "LIONWING-AUTOMATION-REGISTRY.json"), "utf8"));
const uiSource = fs.readFileSync(path.join(companionRoot, "scene-actions-ui.js"), "utf8");

const techniqueRows = new Map(canonical.archetypes.flatMap(archetype => archetype.techniques.flatMap(technique => technique.levels.map(level => [
  `${technique.id}.${level.n}`,
  { archetype, technique, level },
]))));
const levelDigest = ({ archetype, technique, level }) => crypto.createHash("sha256").update(JSON.stringify({
  id: `${technique.id}.${level.n}`,
  archetypeId: archetype.id,
  techniqueId: technique.id,
  name: level.name,
  text: level.text,
  notes: technique.notes,
  source: technique.source,
})).digest("hex");

assert.equal(sourceMeta.id, "dawn-en-lionwing-cb2f8e67");
assert.equal(sourceMeta.editionLabel, "LionWing Edition (Print Beta)");
assert.equal(sourceMeta.pages, 134);
assert.equal(sourceMeta.distribution, "local-only-not-committed");

const detective = techniqueRows.get("vagabond.dim-mak.1");
assert.equal(detective.technique.name, "Detective", "Dim Mak's current LionWing successor is Detective");
assert.equal(detective.technique.previousName, "Dim Mak");
assert.equal(detective.technique.source.pdfPage, 79);
assert.equal(detective.technique.source.editionId, sourceMeta.id);

const master = techniqueRows.get("vagabond.master-at-arms.1");
assert.equal(master.technique.name, "Master-At-Arms");
assert.equal(master.technique.source.pdfPage, 79);
assert.equal(master.technique.source.editionId, sourceMeta.id);
assert.deepEqual(master.technique.levels.map(level => level.name), ["Multi-Faceted", "Like Water", "Master At Work"]);

const expectedDigests = {
  "vagabond.master-at-arms.1": "d35f468065e84fbb0c86bc60015632bdbcfe9b0ced2ed2cfa370453f64a72371",
  "vagabond.master-at-arms.2": "743ae31f60f1a826d3346b6e07c7cff94983860c399cdc9484302e120fd726c4",
  "vagabond.master-at-arms.3": "f104c7652bda2a425422af31d8d91b30515463c98f78892fe25eb204ac7508d3",
};
for (const [id, expectedDigest] of Object.entries(expectedDigests)) {
  const source = techniqueRows.get(id), row = registry.rows.find(item => item.id === id);
  assert.ok(source && row, `${id} has canonical and registry rows`);
  assert.equal(levelDigest(source), expectedDigest, `${id} canonical digest`);
  assert.equal(row.provenance.canonicalDigest, expectedDigest);
  assert.equal(row.implementation.automation, "full");
  assert.ok(row.implementation.rules.some(rule => rule.coverage === "full"), `${id} keeps a full core coverage declaration`);
  assert.equal(row.review.status, "corrected");
  assert.equal(row.review.explicit, true);
}

assert.match(uiSource, /actor\.ruleModes\?\.\["vagabond\.master-at-arms\.armament"\]\?\.modeId/, "the UI reads the authoritative equipped mode");
assert.match(uiSource, /masterFinisherSelection/, "the Master III geometry picker bypasses generic target prompting");

console.log("LionWing Master at Arms audit: Detective successor, page 79 provenance, canonical digests and authoritative UI guard passed");

// Exercise the native command entry point. A canonical registry entry and a
// successful test of an unversioned shared scene cannot prove this route works.
const { core, engine, data, context } = runtime();
const masterId = "vagabond.master-at-arms", groupId = `${masterId}.armament`;
function fresh() {
  const table = fixture();
  table.actors[0].knownTechniques = { [masterId]: 3 };
  table.actors[0].techniques = {}; // This is how the LionWing hero sheet projects learned levels.
  table.actors[1].x = 5;
  return table;
}
function randomSource(value) { let rolls = 0; return () => value === "one-crit" ? (rolls++ === 0 ? .99 : .8) : value; }
function use(table, request, eventId, randomValue = .8) {
  const before = clone(table);
  const prepared = core.prepare(table, { kind: "action", actorId: "hero", eventId, ...request }, { random: randomSource(randomValue) });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  assert.deepEqual(clone(table), before, "preparation and cancellation before commit are free");
  const result = core.dispatchMany(table, prepared.events, { expectedVersion: table.version });
  exactReplay(core, core.reload(JSON.stringify(result.scene)), prepared.events);
  return result.scene;
}
function resolve(table) {
  assert.equal(engine.pendingActionStatus(table, data).waitingIds.length, 0, "NPC without a choice skips reactions");
  // Hero-sheet refresh can again remove legacy technique flags during an attack.
  table = clone(table); table.actors[0].techniques = {};
  const prepared = engine.resolvePendingAction(table, data);
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return engine.dispatchMany(table, prepared.events).scene;
}
let table = fresh();
assert.equal(core.sharedTechniqueRows(table.actors[0]).length, 3);
assert.deepEqual(clone(core.sharedTechniqueRows(table.actors[0]).map(row => row.sourceDigest)), Object.values(expectedDigests));
const original = clone(table);
assert.equal(core.prepare(table, { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, targetIds: ["enemy"] }).ok, false, "generic Skirmish cannot silently bypass an eligible Armament");
assert.deepEqual(clone(table), original);
const invalid = core.prepare(table, { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", targetIds: ["enemy-absent"] });
assert.equal(invalid.ok, false);
assert.deepEqual(clone(table), original);
table = use(table, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", targetIds: ["enemy"], attribute: "talent" }, "master-chain");
assert.equal(table.actors[0].ap, 3);
assert.equal(table.pendingAction.techniqueRuleId, `${masterId}.1`);
table = resolve(table);
assert.ok(table.actors[1].effects.includes("negative.разорван"));
assert.equal(table.actors[0].ruleModes[groupId].modeId, "chain");
assert.equal(core.prepare(table, { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", targetIds: ["enemy"] }).ok, false, "same Armament cannot be equipped twice in the Turn");
table.actors[1].x = 3;
table = use(table, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "blade", targetIds: ["enemy"], attribute: "talent", destination: { x: 2, y: 1 } }, "master-blade");
assert.equal(table.actors[0].x, 2);
table = resolve(table);
assert.equal(table.actors[0].ap, 4, "Like Water grants one AP after the second equip through the native route");
assert.ok(table.actors[0].effects.includes("positive.ускорен"));
assert.equal(table.log.filter(event => event.type === "resource.gain" && event.payload.sourceActionId === `${masterId}.2`).length, 1);

let polearm = fresh();
polearm.actors[1].x = 2;
polearm.actors.push(actor("enemy-two", "enemy", 1, 2));
polearm = use(polearm, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "polearm", targetIds: ["enemy", "enemy-two"], attribute: "talent" }, "master-polearm");
assert.equal(polearm.actors[0].ap, 3);
polearm = resolve(polearm);
assert.equal(polearm.actors[0].ruleModes[groupId].modeId, "polearm");
assert.ok(polearm.actors.slice(1).every(target => target.effects.includes("negative.подброшен")));

// An appearance origin precedes the Armament geometry. It is part of the same
// atomic command, and an invalid second cell must not reveal or charge the hero.
let hidden = fresh();
hidden.actors[0].effects = ["positive.исчез"];
hidden.actors[1].x = 5;
const hiddenRequest = { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, armamentMode: "blade", targetIds: ["enemy"], attribute: "talent", reappearance: { x: 3, y: 1 }, destination: { x: 4, y: 1 } };
assert.equal(core.destinationStatus(hidden, { actorId: "hero", payload: hiddenRequest, field: "reappearance", destination: hiddenRequest.reappearance }).available, true);
assert.equal(core.destinationStatus(hidden, { actorId: "hero", payload: hiddenRequest, field: "destination", destination: hiddenRequest.destination }).available, true);
const hiddenBefore = clone(hidden);
assert.equal(core.prepare(hidden, { ...hiddenRequest, destination: { x: 7, y: 1 } }).ok, false);
assert.equal(core.prepare(hidden, { ...hiddenRequest, reappearance: { x: 4, y: 1 } }).ok, false, "appearance cannot be adjacent to a character");
assert.deepEqual(clone(hidden), hiddenBefore, "failed geometry keeps Disappear and resources");
hidden = use(hidden, hiddenRequest, "master-appearance-blade");
assert.equal(hidden.actors[0].x, 4);
assert.equal(hidden.actors[0].effects.includes("positive.исчез"), false);
assert.equal(hidden.actors[0].ap, 3);
hidden = resolve(hidden);

for (const mode of ["blade", "polearm", "chain"]) {
  let sample = fresh();
  sample.actors[0].ruleModes = { [groupId]: { modeId: mode, sourceDigest: expectedDigests[`${masterId}.1`] } };
  sample.actors[1].x = 2;
  const request = { actionId: engine.ACTION_IDS.finish, attribute: "talent", targetIds: [], focusSpent: 1,
    ...(mode === "blade" ? { destination: { x: 3, y: 1 } } : { areaCenter: { x: 2, y: 1 } }) };
  assert.equal(core.destinationStatus(sample, { actorId: "hero", payload: { kind: "action", ...request }, field: mode === "blade" ? "destination" : "areaCenter", destination: mode === "blade" ? request.destination : request.areaCenter }).available, true, `${mode} is reachable through the board cell validator`);
  const prepared = core.prepare(sample, { kind: "action", actorId: "hero", ...request }, { random: () => .8 });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  rejectedWithoutMutation(sample, () => core.dispatchMany(sample, prepared.events, { expectedVersion: sample.version + 1 }), /Конфликт версии/);
  sample = use(sample, request, `master-finish-${mode}`);
  assert.equal(sample.pendingAction.techniqueRuleId, `${masterId}.3`);
  assert.equal(sample.pendingAction.masterFinisher.modeId, mode);
  assert.equal(sample.actors[0].ap, 1);
  assert.equal(sample.actors[0].focus, 5);
  sample = resolve(sample);
  if (mode === "blade") assert.ok(sample.actors[1].effects.includes("negative.помечен"));
}
console.log("LionWing Master native route: all Armaments/Finishers, learned-level projection, II bonus, board cells, NPC auto-pass, cancellation, reload, replay and version conflict passed");

// Native passive rules must compose with the shared geometry and with its
// authoritative action history. Only the Cast's target receives Witch Hunter.
function operation(sample, request) {
  const prepared = core.prepare(sample, { actorId: "hero", ...request }, { random: () => .8 });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  return core.dispatchMany(sample, prepared.events, { expectedVersion: sample.version }).scene;
}
function comboTable(enabled = true) {
  let sample = fresh();
  sample.activeActorId = null;
  Object.assign(sample.actors[0], { ap: 12, baseAp: 12, speed: 6, knownTechniques: { [masterId]: 3, "powerhouse.spellsword": 3 } });
  sample.actors[0].ruleModes = { [groupId]: { modeId: "chain", sourceDigest: expectedDigests[`${masterId}.1`] } };
  sample.actors[1].x = 2;
  sample.actors.push(actor("enemy-two", "enemy", 3, 1));
  if (enabled) sample = operation(sample, { kind: "automation", ruleId: "powerhouse.spellsword.3", enabled: true });
  return operation(sample, { kind: "turn-start" });
}
function cast(sample) {
  sample = use(sample, { actionId: engine.ACTION_IDS.spell, targetIds: ["enemy"] }, "composition-cast");
  return operation(sample, { kind: "resolve-attack" });
}
for (const mode of ["blade", "polearm", "chain"]) {
  let sample = cast(comboTable());
  sample.actors[0].ruleModes[groupId].modeId = mode;
  if (mode === "blade") sample.actors[2].y = 3;
  const request = { actionId: engine.ACTION_IDS.finish, attribute: "talent", targetIds: [],
    ...(mode === "blade" ? { destination: { x: 3, y: 1 } } : { areaCenter: { x: 2, y: 1 } }) };
  const randomValue = mode === "chain" ? "one-crit" : .8;
  const before = clone(sample), preview = core.prepare(sample, { kind: "action", actorId: "hero", ...request }, { random: randomSource(randomValue) });
  assert.equal(preview.ok, true, preview.errors?.join(" "));
  assert.deepEqual(clone(sample), before, "composition preview remains cancellable and free");
  rejectedWithoutMutation(sample, () => core.dispatchMany(sample, preview.events, { expectedVersion: sample.version + 1 }), /Конфликт версии/);
  sample = use(sample, request, `composition-${mode}`, randomValue);
  const pending = sample.pendingAction;
  assert.deepEqual(clone(pending.targetIds).sort(), mode === "blade" ? ["enemy"] : ["enemy", "enemy-two"], `${mode} derives its targets`);
  assert.equal(pending.damageByTarget.enemy - (pending.damageByTarget["enemy-two"] ?? pending.damage), 3, `${mode} adds Spirit only to the Cast target`);
  assert.deepEqual(clone(pending.nativeDamageSources.enemy.map(row => row.id)), ["powerhouse.spellsword.3"]);
  if (mode !== "blade") assert.equal(pending.nativeDamageSources["enemy-two"].length, 0);
  assert.equal(sample.actors[0].lionwing.history.at(-1).attribute, "talent");
  sample = core.reload(JSON.stringify(sample));
  const health = sample.actors[1].hp;
  sample = resolve(sample);
  assert.equal(health - sample.actors[1].hp, pending.damageByTarget.enemy, "resolution applies the bonus exactly once after reload");
  const receipt = sample.log.find(row => row.type === "action.resolve" && row.payload.actionInstanceId === pending.actionInstanceId);
  assert.equal(receipt.payload.ownerTurnInstanceId, sample.lionwing.activeTurnInstanceId, "shared resolution retains native Turn identity");
  assert.ok(sample.log.find(row => row.type === "damage.apply" && row.payload.targetId === "enemy").payload.nativeDamageSources.some(row => row.id === "powerhouse.spellsword.3"));
}
for (const scenario of ["disabled", "breathe", "armament", "wrong-target"]) {
  let sample = cast(comboTable(scenario !== "disabled"));
  if (scenario === "breathe") sample = use(sample, { actionId: engine.ACTION_IDS.breathe }, "composition-intervening-breathe");
  if (scenario === "armament") {
    sample.actors[1].x = 5;
    sample = use(sample, { actionId: engine.ACTION_IDS.skirmish, attribute: "talent", armamentMode: "chain", targetIds: ["enemy"] }, "composition-intervening-armament");
    sample = resolve(sample);
    sample.actors[1].x = 2;
    sample.actors[0].ruleModes[groupId].modeId = "chain";
  }
  if (scenario === "wrong-target") Object.assign(sample.actors[1], { x: 7, y: 5 });
  sample = use(sample, { actionId: engine.ACTION_IDS.finish, attribute: "talent", targetIds: [], areaCenter: { x: 2, y: 1 }, combo: true }, `composition-no-bonus-${scenario}`);
  assert.ok(Object.values(sample.pendingAction.nativeDamageSources).every(rows => !rows.some(row => row.id === "powerhouse.spellsword.3")), `${scenario} does not grant a forged Combo bonus`);
}
console.log("LionWing native/shared composition: all three Master Finishers, per-target Witch Hunter, intervening Armament, disabled rule, immutable preview, conflict, reload, exact replay and source log passed");

// Price and extra-dice limits must have exactly the same quote in the console
// and in the shared geometry preparer; one AP is sufficient after Charge.
let student = fresh();
student.lionwing.activeTurnInstanceId = "composition-student-turn";
student.actors[0].knownTechniques["ruiner.student-of-stars"] = 1;
student = operation(student, { kind: "automation", ruleId: "ruiner.student-of-stars.1", enabled: true });
student = use(student, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", attribute: "talent", targetIds: ["enemy"] }, "composition-student-equip");
student = resolve(student);
student.actors[1].x = 2;
student = use(student, { actionId: engine.ACTION_IDS.charge }, "composition-student-charge");
student.actors[0].ap = 1;
const studentRequest = { actionId: engine.ACTION_IDS.finish, attribute: "talent", targetIds: [], areaCenter: { x: 2, y: 1 }, focusSpent: 3 };
const studentGate = core.actionStatus(student, student.actors[0], core.actionDef(engine.ACTION_IDS.finish), studentRequest);
assert.equal(studentGate.cost, 1);
assert.equal(studentGate.actionQuote.focusCap, 6);
const studentFocus = student.actors[0].focus;
student = use(student, studentRequest, "composition-student-finisher");
assert.equal(student.actors[0].ap, 0, "native price reaches the shared preparer and reducer");
assert.equal(student.actors[0].focus, studentFocus - 3, "extra dice above Tension are paid exactly once");
assert.equal(student.pendingAction.roll.initialCount, 6);
student = resolve(core.reload(JSON.stringify(student)));

// Restored hooks apply inside the bridged Action transaction as well. Mundane
// spends its first-Finisher discount once per Round, including an extra Turn.
let mundaneMaster=fresh();
mundaneMaster.lionwing.started=true;
mundaneMaster.lionwing.activeTurnInstanceId="mundane-master-turn";
mundaneMaster.actors[1].x=2;
mundaneMaster.actors[0].knownTechniques["bulwark.mundane"]=2;
mundaneMaster.actors[0].ruleModes={ [groupId]: {modeId:"chain",sourceDigest:expectedDigests[`${masterId}.1`]} };
mundaneMaster=operation(mundaneMaster,{kind:"automation",ruleId:"bulwark.mundane.2",enabled:true});
mundaneMaster=operation(mundaneMaster,{kind:"resource",resource:"focus",operation:"gain",amount:3});
const mundaneFinisher={actionId:engine.ACTION_IDS.finish,attribute:"talent",focusSpent:1,targetIds:[],areaCenter:{x:2,y:1}};
const mundaneBefore=clone(mundaneMaster),tenacityBefore=core.balance(mundaneMaster.actors[0],"focus");
const mundaneQuote=core.actionStatus(mundaneMaster,mundaneMaster.actors[0],core.actionDef(mundaneFinisher.actionId),mundaneFinisher);
assert.equal(mundaneQuote.cost,0);
assert.deepEqual(clone(mundaneMaster),mundaneBefore,"preview does not consume the Round discount");
const invalidMundane=core.prepare(mundaneMaster,{actorId:"hero",kind:"action",...mundaneFinisher,areaCenter:{x:99,y:99}},{random:()=>.8});
assert.equal(invalidMundane.ok,false);
assert.deepEqual(clone(mundaneMaster),mundaneBefore,"rejected geometry cannot consume the discount");
mundaneMaster=use(mundaneMaster,mundaneFinisher,"mundane-master-first");
assert.equal(mundaneMaster.actors[0].lionwing.mundaneDiscount,0);
assert.deepEqual(clone(mundaneMaster.actors[0].lionwing.mundaneFinisherRound),[1]);
assert.equal(core.balance(mundaneMaster.actors[0],"focus"),tenacityBefore,"three discounted units cover two AP and one extra die");
mundaneMaster=resolve(core.reload(JSON.stringify(mundaneMaster)));
mundaneMaster=operation(mundaneMaster,{kind:"grant-turn",targetId:"hero"});
mundaneMaster=operation(mundaneMaster,{kind:"turn-end"});
mundaneMaster=operation(mundaneMaster,{kind:"turn-start"});
assert.equal(mundaneMaster.round,1);
assert.equal(context.window.DAWN_LIONWING_RESTORED_TECHNIQUES.quote(mundaneMaster,mundaneMaster.actors[0],mundaneFinisher.actionId,mundaneFinisher,{cost:2}).cost,2,"another own Turn in the Round does not restore the first-Finisher discount");
const laterTurnBefore=clone(mundaneMaster);
assert.equal(core.prepare(mundaneMaster,{actorId:"hero",kind:"action",...mundaneFinisher},{random:()=>.8}).ok,false,"a normal Finisher remains limited to once per Round");
assert.deepEqual(clone(mundaneMaster),laterTurnBefore,"a refused later Finisher consumes nothing");
mundaneMaster=operation(mundaneMaster,{kind:"turn-end"});
mundaneMaster=operation(mundaneMaster,{actorId:"enemy",kind:"turn-start"});
mundaneMaster=operation(mundaneMaster,{actorId:"enemy",kind:"turn-end"});
mundaneMaster=operation(mundaneMaster,{kind:"round-end"});
mundaneMaster=operation(mundaneMaster,{kind:"turn-start"});
mundaneMaster=operation(mundaneMaster,{kind:"resource",resource:"focus",operation:"gain",amount:3});
assert.equal(mundaneMaster.round,2);
assert.equal(core.actionStatus(mundaneMaster,mundaneMaster.actors[0],core.actionDef(mundaneFinisher.actionId),mundaneFinisher).cost,0,"a new Round permits a newly earned discount");
mundaneMaster=use(mundaneMaster,mundaneFinisher,"mundane-master-new-round");
assert.deepEqual(clone(mundaneMaster.actors[0].lionwing.mundaneFinisherRound),[2]);

// The same missing hook also let Creator retain Material after a Master I
// Skirmish. Payment and authoritative history must use the restored plan.
let creatorMaster=fresh();
creatorMaster.actors[0].knownTechniques["ruiner.creation-ascetic"]=1;
creatorMaster=operation(creatorMaster,{kind:"automation",ruleId:"ruiner.creation-ascetic.1",enabled:true});
creatorMaster=operation(creatorMaster,{kind:"resource",resource:"material",operation:"gain",amount:3});
creatorMaster=use(creatorMaster,{actionId:engine.ACTION_IDS.skirmish,armamentMode:"chain",attribute:"talent",targetIds:["enemy"]},"creator-master-armament");
assert.equal(creatorMaster.actors[0].ruleResources.material.value,0,"the shared Armament consumes all Material once");
assert.equal(creatorMaster.actors[0].lionwing.history.at(-1).materialSpent,3,"shared history retains the material fact for Creator III inheritance");
creatorMaster=resolve(core.reload(JSON.stringify(creatorMaster)));

// Cunning Plan is restricted to non-Attacks. A single charge cannot be
// consumed by a rejected Armament (nor passed to the legacy clock consumer).
let cunningMaster=fresh();
cunningMaster.actors[0].knownTechniques["vagabond.cunning-fighter"]=1;
cunningMaster=operation(cunningMaster,{kind:"automation",ruleId:"vagabond.cunning-fighter.1",enabled:true});
cunningMaster=operation(cunningMaster,{kind:"clock",id:"vagabond.cunning-fighter.plan",operation:"add",delta:1});
const cunningBefore=clone(cunningMaster);
const cunningRejected=core.prepare(cunningMaster,{kind:"action",actorId:"hero",actionId:engine.ACTION_IDS.skirmish,armamentMode:"chain",attribute:"talent",targetIds:["enemy"],useCunningPlan:true},{random:()=>.8});
assert.equal(cunningRejected.ok,false);
assert.match(cunningRejected.errors.join(" "),/не-Атакующее действие/);
assert.deepEqual(clone(cunningMaster),cunningBefore,"a rejected Attack preserves the single Cunning Plan charge and all receipts");

// Pre-Skirmish bullet damage precedes shared reactions. It spends once and
// never leaves a defeated defender in attack.pending.
for (const targetHp of [1,30]) {
  let gunMaster=fresh();
  gunMaster.actors[1].hp=targetHp;
  gunMaster.actors[0].knownTechniques["powerhouse.gunslinger"]=1;
  gunMaster=operation(gunMaster,{kind:"automation",ruleId:"powerhouse.gunslinger.1",enabled:true});
  gunMaster=use(gunMaster,{actionId:engine.ACTION_IDS.skirmish,armamentMode:"chain",attribute:"talent",bulletsSpent:1,bulletTargets:["enemy"]},`gun-master-${targetHp}`);
  assert.equal(gunMaster.actors[0].ruleResources.bullets.value,5);
  assert.equal(gunMaster.actors[1].hp,targetHp-1);
  if(targetHp===1) {
    assert.equal(gunMaster.actors[1].knockedOut,true);
    assert.ok(!gunMaster.pendingAction,"a lethal pre-Skirmish bullet completes without an unavailable defender");
  } else {
    assert.deepEqual(clone(gunMaster.pendingAction.targetIds),["enemy"]);
    gunMaster=resolve(core.reload(JSON.stringify(gunMaster)));
    assert.equal(gunMaster.actors[0].ruleResources.bullets.value,5,"resolving the Armament does not spend bullets twice");
  }
}

// Shared reaction packets include payment and automatic Block displacement.
// They must commit atomically through the shared route, with native modifiers.
for (const canPush of [false, true]) {
  let block = fresh();
  block.actors[0].attrs.talent = 6;
  Object.assign(block.actors[1], { x: 5, kind: "hero", heroId: "enemy", attrs: { body: 1, talent: 3, spirit: 3, mind: 3 }, knownTechniques: { "powerhouse.duelist": 2 } });
  block.actors[1].lionwing.automation = { "powerhouse.duelist.2": true };
  block.spaces[0].width = canPush ? 8 : 6;
  block = use(block, { actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", attribute: "talent", targetIds: ["enemy"] }, `composition-block-${canPush}`);
  const response = engine.respondReaction(block, data, { actorId: "enemy", choice: engine.ACTION_IDS.block });
  assert.equal(response.ok, true, response.errors?.join(" "));
  response.events = response.events.map((event, index) => ({ ...event, id: `composition-block-response-${canPush}:${index}` }));
  const before = clone(block);
  rejectedWithoutMutation(block, () => engine.dispatchMany(block, response.events, { expectedVersion: block.version + 1 }), /Конфликт версии/);
  assert.deepEqual(clone(block), before);
  block = engine.dispatchMany(block, response.events, { expectedVersion: block.version }).scene;
  exactReplay(core, block, response.events);
  const outcome = engine.pendingTargetOutcome(block, block.pendingAction, "enemy");
  assert.equal(outcome.temporaryArmor, 3, "shared Block includes native Duelist Tension Armor");
  assert.equal(block.actors[1].x, canPush ? 6 : 5, "automatic Block push survives native packet routing");
  block = resolve(core.reload(JSON.stringify(block)));
  assert.equal(block.actors[1].hp, 27, "reaction modifier matches the native attack pipeline");
}
console.log("LionWing native/shared quotes: Student price and Focus cap, Block modifiers/payment/displacement, conflict, replay and reload passed");

let defenseSerial = 0;
function sharedCommit(sample, prepared) {
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  const events = prepared.events.map(event => ({ ...event, id: `composition-defense:${defenseSerial++}` }));
  const before = clone(sample), committed = engine.dispatchMany(sample, events, { expectedVersion: sample.version });
  assert.deepEqual(clone(sample), before);
  exactReplay(core, committed.scene, events);
  return committed.scene;
}
for (const scenario of ["armor", "cap", "cap-marked", "modifier", "stacked-evasion", "negative.обездвижен", "negative.пойман", "disabled"]) {
  let sample = fixture();
  sample.activeActorId = "enemy";
  sample.actors[1].profileId = "lionwing.npc.ranger";
  const hero = sample.actors[0];
  if (["armor", "cap", "cap-marked", "disabled"].includes(scenario)) {
    hero.attrs.body = 4;
    hero.knownTechniques = { "bulwark.iron-bodied": 3 };
    hero.lionwing.automation = { "bulwark.iron-bodied.2": scenario !== "disabled", "bulwark.iron-bodied.3": scenario.startsWith("cap") };
    if (scenario.startsWith("cap")) hero.effects = ["negative.обездвижен"];
    if (scenario === "cap-marked") hero.effects.push("negative.помечен");
  } else if (["modifier", "stacked-evasion"].includes(scenario)) {
    hero.lionwing.modifiers = [{ id: "evasion-reserve", stat: "evasion", amount: 4, remaining: 4, boundary: "manual", duration: "manual", sourceActorId: "hero" }];
    if (scenario === "stacked-evasion") hero.evasion = 2;
  } else { hero.evasion = 4; hero.effects = [scenario]; }
  const original = clone(sample);
  sample = sharedCommit(sample, engine.prepareEnemyRule(sample, data, { actorId: "enemy", ruleId: "lionwing.npc.ranger.take-the-shot", targetIds: ["hero"], roll: { rolls: Array(7).fill(5), initialCount: 7, successes: 7, crits: 0 } }));
  sample = sharedCommit(sample, engine.respondReaction(sample, data, { actorId: "hero", choice: "pass" }));
  const beforePreview = clone(sample), outcome = engine.pendingTargetOutcome(sample, sample.pendingAction, "hero");
  assert.deepEqual(clone(sample), beforePreview, "defense preview never spends Evasion");
  const raw = sample.pendingAction.damage;
  sample = sharedCommit(core.reload(JSON.stringify(sample)), engine.resolvePendingAction(sample, data));
  const native = sharedCommit(original, core.prepare(original, { kind: "damage", actorId: "enemy", targetId: "hero", amount: raw, attack: true }));
  assert.equal(sample.actors[0].hp, native.actors[0].hp, `${scenario}: NPC/shared damage matches native damage`);
  assert.equal(30 - sample.actors[0].hp, outcome.expectedDamage, `${scenario}: preview matches actual HP loss`);
  assert.equal(sample.actors[0].evasion, native.actors[0].evasion, `${scenario}: both routes spend the same base Evasion`);
  assert.deepEqual(clone(sample.actors[0].lionwing.modifiers || []), clone(native.actors[0].lionwing.modifiers || []), `${scenario}: temporary Evasion is consumed once`);
  if (scenario.startsWith("cap")) assert.ok(sample.log.find(event => event.type === "damage.apply").payload.finalDamageSources.some(row => row.id === "bulwark.iron-bodied.3"));
}
let headshot = fixture();
headshot.activeActorId = "enemy";
headshot.actors[1].profileId = "lionwing.npc.ranger";
Object.assign(headshot.actors[0], { attrs: { body: 4, talent: 3, spirit: 3, mind: 3 }, knownTechniques: { "bulwark.iron-bodied": 3 }, effects: ["negative.обездвижен", "negative.помечен"] });
headshot.actors[0].lionwing.automation = { "bulwark.iron-bodied.2": true, "bulwark.iron-bodied.3": true };
headshot = sharedCommit(headshot, engine.prepareEnemyRule(headshot, data, { actorId: "enemy", ruleId: "lionwing.npc.ranger.headshot", targetIds: ["hero"] }));
headshot = sharedCommit(headshot, engine.prepareEnemyRule(headshot, data, { actorId: "enemy", ruleId: "lionwing.npc.ranger.take-the-shot", targetIds: ["hero"], roll: { rolls: Array(7).fill(5), initialCount: 7, successes: 7, crits: 0 } }));
headshot = sharedCommit(headshot, engine.respondReaction(headshot, data, { actorId: "hero", choice: "pass" }));
headshot = sharedCommit(headshot, engine.resolvePendingAction(headshot, data));
assert.equal(headshot.actors[0].hp, 20, "Armor protects the separate Headshot; cap applies after Marked on the primary damage");
assert.equal(headshot.actors[0].effects.includes("negative.помечен"), false);
assert.equal(headshot.log.filter(event => event.type === "damage.apply" && event.payload.markedBonus).length, 1);
console.log("LionWing shared defenses: native Armor/cap, Marked/Headshot order, consumable Evasion, Immobilized/Caught, disabled rules, preview/commit parity, reload and replay passed");
