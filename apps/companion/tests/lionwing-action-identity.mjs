import assert from "node:assert/strict";
import { runtime, fixture, actor, clone, exactReplay } from "./helpers/scene-contract-harness.mjs";

const { core, engine, data } = runtime(), ids = engine.ACTION_IDS;
let serial = 0;
function commit(scene, prepared) {
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  const before = clone(scene), events = prepared.events.map((event, index) => ({ ...event, id: event.id || `identity-event:${serial++}:${index}` }));
  const result = engine.dispatchMany(scene, events, { expectedVersion: scene.version });
  assert.deepEqual(clone(scene), before, "a commit leaves its input snapshot unchanged");
  exactReplay(engine, core.reload(JSON.stringify(result.scene)), events);
  return result.scene;
}
function prepare(scene, payload, actorId = "hero") {
  const before = clone(scene), prepared = core.prepare(scene, { actorId, eventId: `identity-command:${serial++}`, ...payload }, { random: () => .8 });
  assert.deepEqual(clone(scene), before, "identity validation and preview are pure");
  return prepared;
}
const command = (scene, payload, actorId) => commit(scene, prepare(scene, payload, actorId));
function table(levels = {}) {
  const scene = fixture(); scene.lionwing.started = true; scene.lionwing.activeTurnInstanceId = "identity-current-turn";
  scene.actors[0].knownTechniques = clone(levels); scene.actors[1].x = 2;
  return scene;
}
function assertActions(scene, ownerId, actionId, count) {
  const owner = scene.actors.find(item => item.id === ownerId);
  const rows = owner.lionwing.history.filter(row => row.actionId === actionId && row.actionDefinitionId === actionId);
  assert.equal(rows.length, count, "one actor history row is recorded for each accepted Action");
  assert.equal(new Set(rows.map(row => row.actionInstanceId)).size, count, "separate Actions have separate authoritative instance IDs");
  for (const row of rows) {
    assert.ok(typeof row.actionInstanceId === "string" && row.actionInstanceId.length, "each Action has a nonempty instance ID");
    const facts = scene.lionwing.history.filter(fact => fact.type === "apply" && fact.actionId === actionId && fact.actionInstanceId === row.actionInstanceId);
    assert.equal(facts.length, 1, "the Action has exactly one matching apply fact");
    assert.equal(row.ownerTurnInstanceId, facts[0].ownerTurnInstanceId, "actor and scene history use the same authoritative Turn");
  }
  return rows;
}
function forgedIdentity(scene, payload, actorId = "hero") {
  const hint = "untrusted-same-action-instance", foreignTurn = "untrusted-foreign-turn";
  const prepared = prepare(scene, { ...payload, actionInstanceId: hint, ownerTurnInstanceId: foreignTurn }, actorId);
  // A public identity hint may be refused or ignored. It must never become
  // authoritative history, nor cause a partial spend on a refused request.
  if (!prepared.ok) {
    assert.equal((prepared.events || []).length, 0, "refused public identities cannot emit a partial transaction");
    return { scene, accepted: false };
  }
  const next = commit(scene, prepared), owner = next.actors.find(item => item.id === actorId), row = owner.lionwing.history.at(-1);
  assert.notEqual(row.actionInstanceId, hint, "a public hint cannot choose the authoritative Action identity");
  assert.equal(row.ownerTurnInstanceId, next.lionwing.activeTurnInstanceId, "a public hint cannot choose the authoritative Turn");
  return { scene: next, accepted: true };
}

// Ordinary repeated Swift Actions spend and gain once per accepted event;
// exact replay does neither, while a new event creates another Action.
let ordinary = table();
ordinary = command(ordinary, { kind: "allow-action", actionId: ids.breathe, uses: 2, cost: 1, swift: true });
const ordinaryAp = ordinary.actors[0].ap, ordinaryFocus = ordinary.actors[0].focus;
ordinary = command(ordinary, { kind: "action", actionId: ids.breathe });
ordinary = core.reload(JSON.stringify(ordinary));
ordinary = command(ordinary, { kind: "action", actionId: ids.breathe });
assertActions(ordinary, "hero", ids.breathe, 2);
assert.equal(ordinary.actors[0].ap, ordinaryAp - 2);
assert.equal(ordinary.actors[0].focus, ordinaryFocus + 2);
const poor = clone(ordinary); poor.actors[0].ap = 0;
const exhausted = prepare(poor, { kind: "action", actionId: ids.breathe });
assert.equal(exhausted.ok, false, "an unpaid Action is refused before creating history");
assert.equal((exhausted.events || []).length, 0);

for (const route of ["native", "manual"]) {
  let scene = table();
  if (route === "native") scene = command(scene, { kind: "allow-action", actionId: ids.breathe, uses: 2, cost: 1, swift: true });
  const payload = route === "native" ? { kind: "action", actionId: ids.breathe } : { kind: "record-action", actionId: ids.breathe, amount: 1, swift: true };
  for (let index = 0; index < 2; index++) {
    const result = forgedIdentity(scene, payload); scene = result.scene;
    if (!result.accepted) scene = command(scene, payload);
    scene = core.reload(JSON.stringify(scene));
  }
  assertActions(scene, "hero", ids.breathe, 2);
  assert.equal(scene.actors[0].ap, 1, `${route}: each accepted event pays exactly once`);
}

// Batch and ActionPlan are different entry points. In both, the root event
// identifies the transaction, while each Action identifies its own history.
for (const wrapper of ["batch", "plan"]) {
  let scene = table();
  const operations = [0, 1].map(() => ({ kind: "record-action", actionId: ids.breathe, amount: wrapper === "batch" ? 1 : 0, swift: true }));
  scene = command(scene, { kind: wrapper, operations, ...(wrapper === "plan" ? { costs: [{ kind: "resource", resource: "ap", amount: 2 }], targetIds: [] } : {}) });
  assertActions(scene, "hero", ids.breathe, 2);
  assert.equal(scene.actors[0].ap, 1, `${wrapper}: the whole accepted price is paid once`);
  const reloaded = core.reload(JSON.stringify(scene));
  assert.deepEqual(clone(reloaded), clone(scene), `${wrapper}: Action identities survive reload`);
}

// A prebuilt preview is still uncommitted data. Repreparing it for a fresh
// request must give its actual Actions distinct IDs and preserve the price.
let prebuilt = table();
const planRequest = { kind: "plan", targetIds: [], costs: [{ kind: "resource", resource: "ap", amount: 2 }], operations: [0, 1].map(() => ({ kind: "record-action", actionId: ids.breathe, amount: 0, swift: true })) };
const planPreview = prepare(prebuilt, planRequest);
assert.equal(planPreview.ok, true, planPreview.errors?.join(" "));
const planSnapshot = clone(planPreview.events[0].payload.actionPlan);
prebuilt = command(prebuilt, { ...planRequest, actionPlan: planSnapshot });
assert.deepEqual(clone(planPreview.events[0].payload.actionPlan), planSnapshot, "rebinding execution never mutates the caller's preview descriptor");
assertActions(prebuilt, "hero", ids.breathe, 2);
assert.equal(prebuilt.actors[0].ap, 1);

// Raw public commands bypass prepare, so they need the same identity guard.
let raw = table();
const rawEvent = { id: `identity-raw:${serial++}`, type: "lionwing.command", actorId: "hero", payload: { kind: "record-action", actionId: ids.breathe, amount: 1, swift: true, actionInstanceId: "untrusted-raw-id", ownerTurnInstanceId: "untrusted-raw-turn" } };
const rawBefore = clone(raw);
let rawResult;
try {
  rawResult = engine.dispatchMany(raw, [rawEvent], { expectedVersion: raw.version });
} catch (error) {
  assert.match(error.message, /[Ии]дентич|[Ээ]кземпляр|[Вв]нутрен|[Пп]араметр|[Аа]вторитет|actionInstanceId|ownerTurnInstanceId/, "a refused public identity must have a meaningful reason");
  assert.deepEqual(clone(raw), rawBefore, "raw identity refusal is immutable");
}
if (rawResult) {
  assert.deepEqual(clone(raw), rawBefore);
  raw = rawResult.scene;
  const row = assertActions(raw, "hero", ids.breathe, 1)[0];
  assert.notEqual(row.actionInstanceId, "untrusted-raw-id");
  assert.equal(raw.actors[0].ap, 2);
  exactReplay(engine, core.reload(JSON.stringify(raw)), [rawEvent]);
}

// A real fixed Jab is authorized by its Stride trigger. Answering the saved
// choice is a continuation, so a client hint cannot replace the trusted ID.
let fixed = table({ "vagabond.skirmisher": 1 }); fixed.actors[1].x = 3;
fixed = command(fixed, { kind: "automation", ruleId: "vagabond.skirmisher.1", enabled: true });
fixed = command(fixed, { kind: "action", actionId: ids.step, destination: { space: "main", x: 2, y: 1 } });
const jabChoice = fixed.lionwing.choices.find(choice => choice.context?.ruleId === "vagabond.skirmisher.1");
assert.ok(jabChoice?.options.includes("jab:enemy"));
fixed = core.reload(JSON.stringify(fixed));
fixed = command(fixed, { kind: "choice", id: jabChoice.id, choice: "jab:enemy", actionInstanceId: "untrusted-choice-hint" });
const jabRow = assertActions(fixed, "hero", ids.skirmish, 1)[0];
assert.notEqual(jabRow.actionInstanceId, "untrusted-choice-hint");
assert.equal(fixed.actors[1].hp, 28);
assert.ok(!fixed.pendingAction);

// Profile packets create their own canonical identity from the prepared NPC
// action. Two genuine Heals are two Actions even without hero attributes.
let profile = table(); profile.activeActorId = "healer";
profile.actors = [actor("healer", "enemy", 1, 1, { profileId: "lionwing.npc.healer" }), actor("patient", "enemy", 2, 1, { hp: 10 }), actor("opponent", "hero", 6, 1)];
delete profile.actors[0].attrs; delete profile.actors[0].knownTechniques; delete profile.actors[0].techniques;
for (let index = 0; index < 2; index++) {
  if (index) {
    profile = command(profile, { kind: "turn-end" }, "healer");
    for (const actorId of ["opponent", "patient"]) {
      profile = command(profile, { kind: "turn-start" }, actorId);
      profile = command(profile, { kind: "turn-end" }, actorId);
    }
    profile = command(profile, { kind: "round-end" }, null);
    profile = command(profile, { kind: "turn-start" }, "opponent");
    profile = command(profile, { kind: "turn-end" }, "opponent");
    profile = command(profile, { kind: "turn-start" }, "healer");
  }
  const ap = profile.actors[0].ap;
  profile = commit(profile, engine.prepareEnemyRule(profile, data, { actorId: "healer", ruleId: "lionwing.npc.healer.heal", targetIds: ["patient"] }));
  assert.equal(profile.actors[0].ap, ap - 1, "each canonical Heal pays its one AP once");
  profile = core.reload(JSON.stringify(profile));
}
assertActions(profile, "healer", "lionwing.npc.healer.heal", 2);

// Manual attacks also run before-Attack hooks. Reusing a public identity hint
// must not suppress Gas's protection on the next genuinely new Attack.
let gas = table();
gas.areas = [{ id: "identity-gas", ruleId: "disruptor.chemist.1", ownerActorId: "enemy", space: "main", cells: ["2,1"] }];
const gasIds = [];
for (let index = 0; index < 2; index++) {
  const request = { kind: "attack", targetIds: ["enemy"], amount: 1, actionInstanceId: "untrusted-manual-attack-id" };
  const evasion = gas.actors[1].evasion, preview = prepare(gas, request);
  gas = preview.ok ? commit(gas, preview) : command(gas, { kind: "attack", targetIds: ["enemy"], amount: 1 });
  gasIds.push(gas.pendingAction.actionInstanceId);
  assert.notEqual(gas.pendingAction.actionInstanceId, request.actionInstanceId);
  assert.equal(gas.actors[1].evasion, evasion + 3, "each new Attack from outside allied Gas gains its own protection");
  gas = core.reload(JSON.stringify(gas));
  gas = command(gas, { kind: "resolve-attack" });
}
assert.equal(new Set(gasIds).size, 2);

// A cancellation is a continuation of the originating Attack. Its clear
// receipt and cancellation fact must retain that Action, including the UI's
// routed cancelPendingAction path for native, Armament and NPC attacks.
for (const route of ["native-command", "native-ui", "master-ui", "profile-ui"]) {
  let cancelled = table(route === "master-ui" ? { "vagabond.master-at-arms": 3 } : {});
  let sourceId = "hero", targetId = "enemy";
  if (route === "profile-ui") {
    sourceId = "enemy"; targetId = "hero"; cancelled.activeActorId = sourceId;
    cancelled.actors[1].x = 5; cancelled.actors[1].profileId = "lionwing.npc.ranger";
    cancelled = commit(cancelled, engine.prepareEnemyRule(cancelled, data, { actorId: sourceId, ruleId: "lionwing.npc.ranger.take-the-shot", targetIds: [targetId], roll: { rolls: Array(7).fill(4), successes: 7, crits: 0, initialCount: 7 } }));
  } else {
    cancelled.actors[1].x = route === "master-ui" ? 5 : 2;
    cancelled = command(cancelled, { kind: "action", actionId: ids.skirmish, attribute: "talent", targetIds: [targetId], ...(route === "master-ui" ? { armamentMode: "chain" } : {}) });
  }
  const instanceId = cancelled.pendingAction.actionInstanceId, hp = cancelled.actors.find(item => item.id === targetId).hp;
  cancelled = core.reload(JSON.stringify(cancelled));
  cancelled = route === "native-command" ? command(cancelled, { kind: "cancel-attack" }, sourceId) : commit(cancelled, engine.cancelPendingAction(cancelled));
  assert.ok(!cancelled.pendingAction, `${route}: cancellation closes the Attack`);
  assert.equal(cancelled.actors.find(item => item.id === targetId).hp, hp, `${route}: a cancelled Attack applies no damage`);
  const clear = cancelled.log.find(row => row.type === "attack.clear" && row.payload?.cancelled === true);
  assert.ok(clear, `${route}: cancellation has a public receipt`);
  assert.equal(clear.payload.actionInstanceId || clear.execution?.actionInstanceId, instanceId, `${route}: clear identifies the original Attack`);
  assert.ok(cancelled.lionwing.history.some(fact => fact.type === "cancel" && fact.actionInstanceId === instanceId), `${route}: cancellation history identifies the original Attack`);
}

// The Armament bridge can replace Actor objects. Its price, pending attack,
// history, damage and completion all keep the same engine-owned identity.
let master = table({ "vagabond.master-at-arms": 3 }); master.actors[1].x = 3;
master.actors.push(actor("enemy2", "enemy", 2, 2));
for (let index = 0; index < 2; index++) {
  const request = { kind: "action", actionId: ids.skirmish, attribute: "talent", armamentMode: index ? "polearm" : "blade", targetIds: index ? ["enemy", "enemy2"] : ["enemy"], ...(!index ? { destination: { x: 2, y: 1 } } : {}) };
  const attempt = forgedIdentity(master, request); master = attempt.scene;
  if (!attempt.accepted) master = command(master, request);
  const instanceId = master.pendingAction.actionInstanceId;
  master = core.reload(JSON.stringify(master));
  master = commit(master, engine.resolvePendingAction(master, data));
  assert.equal(master.actors[0].lionwing.history.at(-1).actionInstanceId, instanceId, "the shared continuation keeps its original Action identity");
  assert.ok(master.log.some(event => event.type === "damage.apply" && (event.payload?.actionInstanceId || event.execution?.actionInstanceId) === instanceId), `actual shared damage identifies its Action ${instanceId}: ${JSON.stringify(master.log.filter(event => event.type === "damage.apply"))}`);
}
const masterRows = assertActions(master, "hero", ids.skirmish, 2);
assert.ok(masterRows.every(row => row.execution.costs.length === 0), "two canonical Swift Armaments remain free");
assert.equal(master.actors[0].ap, 4, "the second Equip grants Master II's one AP once");

console.log("LionWing Action identity: distinct fresh Actions, public hint isolation, immutable refusals, batch/plan, Armament and fixed/profile continuations, reload and exact replay passed");
