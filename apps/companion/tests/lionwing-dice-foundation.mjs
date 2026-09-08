import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../lionwing-dice.js", import.meta.url), "utf8"), context, { filename: "lionwing-dice.js" });
const dice = context.window.DAWN_LIONWING_DICE;
assert.ok(dice, "the dice API is installed");

const clone = value => JSON.parse(JSON.stringify(value));
const rejects = (fn, pattern) => assert.throws(fn, error => pattern.test(error.message), pattern);

const source = {
  id: "roll:foundation",
  kind: "check",
  pool: 2,
  sourceFaces: [6, 4, 6, 2],
  rootActionId: "root:foundation",
  actionDefinitionId: "action.attack",
  actionInstanceId: "action:foundation:1",
  causeEventId: "event:attack:1",
  ownerActorId: "hero:a",
};
const initial = dice.create(source);
assert.equal(initial.pool, 2);
assert.deepEqual(clone(initial.sourceFaces), [6, 4, 6, 2]);
assert.equal(initial.hits, 3);
assert.equal(initial.successes, 3);
assert.equal(initial.crits, 2);
assert.equal(initial.rules.explode, true);
assert.equal(initial.sourceDice[2].parentId, initial.sourceDice[0].id, "the first critical extra die keeps its parent");
assert.equal(initial.sourceDice[3].parentId, initial.sourceDice[2].id, "a critical chain keeps every link");
assert.equal(initial.criticalLinks.length, 2);
assert.equal(initial.provenance.rootActionId, "root:foundation");
assert.equal(initial.provenance.actionInstanceId, "action:foundation:1");
assert.equal(initial.provenance.causeEventId, "event:attack:1");
assert.deepEqual(clone(initial.dice.map(die => die.id)), [
  "roll:foundation:die:0",
  "roll:foundation:die:1",
  "roll:foundation:die:2",
  "roll:foundation:die:3",
]);

// Raw D6 is a table result: it has no automatic Hits, Crits, or explosion.
const raw = dice.create({ id: "roll:raw", kind: "raw-d6", pool: 2, sourceFaces: [6, 4] });
assert.equal(raw.hits, null);
assert.equal(raw.successes, null);
assert.equal(raw.crits, null);
assert.equal(raw.explode, false);
assert.deepEqual(clone(raw.criticalLinks), []);
const empty = dice.create({ id: "roll:empty", kind: "check", pool: 0, sourceFaces: [] });
assert.equal(empty.hits, 0);
assert.equal(empty.crits, 0);

// A flat source is verified as a queue, so a critical cannot be smuggled in
// after a noncritical root just by making the total length look plausible.
rejects(() => dice.create({ id: "roll:bad-chain", pool: 1, sourceFaces: [2, 6, 6] }), /лишн|цепочк/);
rejects(() => dice.create({ id: "roll:bad-source", pool: 1, sourceFaces: [7] }), /гран/);
rejects(() => dice.create({ id: "roll:too-many", pool: 101, sourceFaces: [] }), /пул|100/);

const beforeOperations = clone(initial);
const added = dice.apply(initial, { id: "op:add", kind: "add", values: [5] });
assert.equal(added.dice.length, 5);
assert.equal(added.dice[4].id, "roll:foundation:die:4", "added IDs are deterministic and stable");
assert.equal(added.dice[4].origin, "added");
assert.deepEqual(clone(added.sourceFaces), clone(initial.sourceFaces), "add does not rewrite source faces");
assert.deepEqual(clone(initial), beforeOperations, "applying an operation does not mutate its input");

const changed = dice.apply(added, {
  id: "op:change",
  kind: "change",
  dieId: added.dice[4].id,
  value: 6,
});
assert.equal(changed.dice[4].value, 6);
assert.equal(changed.dice[4].changeCount, 1);
assert.equal(changed.crits, 3, "Crits are recalculated from changed values");

const rerolled = dice.apply(changed, {
  id: "op:reroll",
  kind: "reroll",
  dieIds: [changed.dice[1].id, changed.dice[4].id],
  values: [1, 2],
});
assert.deepEqual(clone(rerolled.dice.slice(0, 5).map(die => die.id)), clone(changed.dice.slice(0, 5).map(die => die.id)));
assert.deepEqual(clone(rerolled.finalFaces), [6, 1, 6, 2, 2]);
assert.equal(rerolled.crits, 2);
assert.equal(rerolled.dice[1].originalValue, 4, "reroll preserves the original face separately");
assert.equal(rerolled.dice[1].rerollCount, 1);

const removed = dice.apply(rerolled, { id: "op:remove", kind: "remove", dieId: rerolled.dice[3].id });
assert.deepEqual(clone(removed.finalFaces), [6, 1, 6, 2]);
assert.equal(removed.dice[3].active, false);
assert.equal(removed.dice[3].removed, true);
assert.equal(removed.dice.length, 5, "removed IDs stay in the ledger for replay and provenance");
assert.equal(removed.hits, 2);

const locked = dice.apply(removed, { id: "op:lock", kind: "lock", dieId: removed.dice[1].id });
assert.equal(locked.dice[1].locked, true);
rejects(() => dice.apply(locked, { id: "op:locked-change", kind: "change", dieId: locked.dice[1].id, value: 6 }), /заблок/);
rejects(() => dice.apply(locked, { id: "op:locked-remove", kind: "remove", dieId: locked.dice[1].id }), /заблок/);
const unlocked = dice.apply(locked, { id: "op:unlock", kind: "unlock", dieId: locked.dice[1].id });
assert.equal(unlocked.dice[1].locked, false);

// The same operation ID is an idempotent receipt. Reusing it with another
// payload is a conflict and never produces a second state transition.
const duplicate = dice.apply(unlocked, { id: "op:change", kind: "change", dieId: added.dice[4].id, value: 6 });
assert.deepEqual(duplicate, unlocked);
rejects(() => dice.apply(unlocked, { id: "op:change", kind: "change", dieId: added.dice[4].id, value: 1 }), /Повтор операции|другими данными/);
rejects(() => dice.apply(unlocked, { id: "op:foreign", kind: "change", dieId: added.dice[0].id, value: 2, rootActionId: "root:other" }), /другому rootAction/);
rejects(() => dice.apply(unlocked, { id: "op:foreign-instance", kind: "change", dieId: added.dice[0].id, value: 2, actionInstanceId: "action:other" }), /экземпляру/);

// A failed second operation cannot leak the first operation from an atomic
// batch into the caller or into a returned partial result.
const atomicInput = clone(initial);
rejects(() => dice.applyOperations(atomicInput, [
  { id: "batch:add", kind: "add", values: [3] },
  { id: "batch:bad", kind: "change", dieId: "roll:foundation:missing", value: 3 },
]), /не найдена/);
assert.deepEqual(clone(atomicInput), clone(initial));
rejects(() => dice.apply(initial, { id: "op:bad-kind", kind: "teleport", dieId: initial.dice[0].id }), /Неизвестная операция/);
rejects(() => dice.apply(initial, { id: "op:bad-target", kind: "change", dieId: "missing", value: 3 }), /не найдена/);

// JSON is a real reload boundary. Derived ready-made Hits are ignored, while
// the authoritative source and operation ledger are verified.
const saved = JSON.stringify(unlocked);
const reloaded = dice.reload(saved);
assert.deepEqual(reloaded, unlocked);
const forgedHits = JSON.parse(saved);
forgedHits.hits = 999;
forgedHits.successes = 999;
forgedHits.crits = 999;
assert.equal(dice.reload(forgedHits).hits, unlocked.hits);
const forgedDie = JSON.parse(saved);
forgedDie.dice[0].value = 1;
rejects(() => dice.reload(forgedDie), /костей|операций/);
const forgedSourceDie = JSON.parse(saved);
forgedSourceDie.sourceDice[0].value = 1;
rejects(() => dice.reload(forgedSourceDie), /sourceDice|исходн/);
const forgedActiveProjection = JSON.parse(saved);
forgedActiveProjection.activeDice[0].value = 1;
rejects(() => dice.reload(forgedActiveProjection), /проекцион|костей/);
const replayed = dice.replay(JSON.stringify(unlocked));
assert.deepEqual(replayed, unlocked);
assert.equal(JSON.parse(dice.serialize(unlocked)).revision, unlocked.revision);

const predicted = dice.preview(initial, { id: "op:preview", kind: "change", dieId: initial.dice[1].id, value: 6 });
assert.equal(predicted.ok, true);
assert.equal(predicted.roll.crits, 3);
assert.equal(initial.dice[1].value, 4, "preview is read-only");
const badPreview = dice.preview(initial, { id: "op:preview-bad", kind: "change", dieId: "missing", value: 6 });
assert.equal(badPreview.ok, false);

const changedThreshold = dice.apply(dice.create({ id: "roll:threshold", pool: 2, sourceFaces: [5, 2, 1], criticalAt: 5 }), {
  id: "op:threshold",
  kind: "change-threshold",
  window: "resolution",
  criticalAt: 6,
});
assert.equal(changedThreshold.crits, 0);
rejects(() => dice.apply(changedThreshold, { id: "op:threshold-bad", kind: "change-threshold", criticalAt: 5 }), /окна/);
const negativeHits = dice.apply(empty, { id: "op:negative-hits", kind: "add-hits", value: -3 });
assert.equal(negativeHits.baseHits, 0);
assert.equal(negativeHits.hits, 0, "derived Hits never become negative");
rejects(() => dice.apply(raw, { id: "op:raw-hits", kind: "add-hits", value: 1 }), /сырая|Hits/);

// The authority supplies random values once. A critical chain is persisted;
// no callback appears in the JSON result.
const randomValues = [0.99, 0.0];
const generated = dice.roll({ id: "roll:random", pool: 1 }, { random: () => randomValues.shift() });
assert.deepEqual(clone(generated.sourceFaces), [6, 1]);
assert.equal(generated.sourceDice[1].parentId, generated.sourceDice[0].id);
assert.equal(Object.hasOwn(generated, "random"), false);
assert.equal(Object.values(generated).some(value => typeof value === "function"), false);

const opposed = dice.opposed({
  id: "opposed:foundation",
  rootActionId: "root:duel",
  actionInstanceId: "action:duel:1",
  causeEventId: "event:duel:1",
  tieRule: "reroll",
  participants: [
    { id: "attacker", pool: 1, sourceFaces: [4] },
    { id: "defender", pool: 1, sourceFaces: [1] },
  ],
});
assert.equal(opposed.comparison.winnerParticipantId, "attacker");
assert.equal(opposed.participants.length, 2);
assert.equal(opposed.participants[0].provenance.rootActionId, "root:duel");
assert.deepEqual(dice.reload(JSON.stringify(opposed)), opposed);
const tie = dice.opposed({
  id: "opposed:tie",
  rootActionId: "root:tie",
  actionInstanceId: "action:tie:1",
  causeEventId: "event:tie:1",
  tieRule: "left",
  participants: [
    { id: "left", pool: 1, sourceFaces: [4] },
    { id: "right", pool: 1, sourceFaces: [4] },
  ],
});
assert.equal(tie.status, "tied");
assert.equal(dice.resolveTie(tie, "left").comparison.winnerParticipantId, "left");
rejects(() => dice.resolveTie(tie, "right"), /правилом/);
const tieRequest=(id,tieRule)=>({id:`opposed:${id}`,rootActionId:`root:${id}`,actionInstanceId:`action:${id}:1`,causeEventId:`event:${id}:1`,tieRule,participants:[{id:"left",pool:1,sourceFaces:[4]},{id:"right",pool:1,sourceFaces:[4]}]});
const missingTieRule = tieRequest("missing-rule", "left");
delete missingTieRule.tieRule;
rejects(()=>dice.opposed(missingTieRule),/явное правило/i);
const forgedTie=clone(tie);forgedTie.resolution="right";rejects(()=>dice.reload(forgedTie),/правилом/i);
const resolvedLeft=dice.resolveTie(tie,"left");
assert.equal(dice.resolveTie(resolvedLeft,"left").comparison.winnerParticipantId,"left");
rejects(()=>dice.resolveTie(resolvedLeft,"right"),/нельзя переиграть/i);
const defenderTie=dice.opposed(tieRequest("defender-tie","defender"));
assert.equal(dice.resolveTie(defenderTie,"defender").comparison.winnerParticipantId,"right","defender aliases the right side consistently");
rejects(()=>dice.resolveTie(defenderTie,"attacker"),/правилом/);
const narratorTie=dice.opposed(tieRequest("narrator-tie","narrator"));
rejects(()=>dice.resolveTie(narratorTie,"narrator"),/Недопустимое/,"narrator is a decision authority, not a resolved outcome");
rejects(()=>dice.create({id:"roll:bad-explode",pool:1,sourceFaces:[1],explode:"false"}),/explode|логическим/i);
rejects(()=>dice.create({id:"roll:alias-faces",pool:1,sourceFaces:[1],faces:[6]}),/Алиасы|расходятся/i);

console.log("LionWing dice foundation passed: verified source/critical links, raw D6, stable dice IDs, add-remove-reroll-change-lock, derived results, provenance, atomic receipts, JSON reload/replay, thresholds, random authority, and opposed checks");
