import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["lionwing-execution.js", "lionwing-action-plan.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
const planApi = context.window.DAWN_LIONWING_ACTION_PLAN;
const execution = context.window.DAWN_LIONWING_EXECUTION;
assert.ok(planApi && execution, "ActionPlan and execution APIs are installed");

const clone = value => JSON.parse(JSON.stringify(value));
const rejects = (fn, pattern) => assert.throws(fn, error => pattern.test(error.message), pattern);
const actor = (id, x, extra = {}) => ({ id, kind: id === "hero" ? "hero" : "enemy", team: id === "hero" ? "hero" : "enemy", space: "main", x, y: 1, hp: 10, knockedOut: false, ...extra });
const scene = () => ({ version: 7, actors: [actor("hero", 1, { focus: 3, ap: 3 }), actor("enemy-a", 3), actor("enemy-b", 4)] });

const baseRequest = {
  rootActionId: "root:bridge",
  definitionId: "action.multi-target",
  actionInstanceId: "action:bridge:1",
  source: { id: "hero", kind: "actor", actorId: "hero", causeEventId: "event:open" },
  owner: { id: "hero", kind: "actor", actorId: "hero" },
  sceneVersion: 7,
  targets: [
    { targetId: "enemy-a", snapshot: { space: "main", x: 3, y: 1 } },
    { targetId: "enemy-b", snapshot: { space: "main", x: 4, y: 1 } },
  ],
  baseValues: { amount: 2, form: "single" },
  costs: [{ kind: "resource", resource: "focus", amount: 1 }, { kind: "health", mode: "spend", amount: 1 }],
  phases: {
    before: [{ id: "before:validate", kind: "check" }],
    replace: [],
    apply: [
      { id: "damage:a", kind: "damage", targetId: "enemy-a", amount: 2 },
      { id: "damage:b", kind: "damage", targetId: "enemy-b", amount: 2 },
    ],
    after: [{ id: "after:record", kind: "history" }],
  },
  modifiers: [{ id: "damage:once", type: "add", field: "amount", amount: 1, sourceId: "hero", ruleId: "rule.damage.once", lifetime: "action", consume: true, consumeBoundary: "commit" }],
};

// Price and both target snapshots become one execution reservation/queue. No
// Scene is supplied to the adapter, so nothing can be paid or applied here.
const draft = planApi.open(baseRequest);
const draftBefore = clone(draft);
const preparedDraft = planApi.prepareExecution(draft);
assert.deepEqual(clone(draft), draftBefore, "preparing an execution plan is pure");
assert.deepEqual(clone(preparedDraft.execution.reservation.targetIds), ["enemy-a", "enemy-b"]);
assert.deepEqual(clone(preparedDraft.execution.reservation.costs), baseRequest.costs);
assert.equal(preparedDraft.execution.operations.length, 2);
assert.equal(preparedDraft.execution.operations[0].rootActionId, draft.rootActionId);
assert.equal(preparedDraft.execution.operations[0].actionInstanceId, draft.actionInstanceId);
assert.equal(preparedDraft.payment.paid, false, "prepare does not pay");
assert.equal(preparedDraft.execution.payment.atomic, true);

// Executable steps keep their phase order in the single runtime queue; a
// before/after step must not disappear merely because it is outside apply.
const phased = planApi.open({
  ...baseRequest,
  actionInstanceId: "action:bridge:phases",
  phases: {
    before: [{ id: "before:resource", kind: "resource", targetId: "hero", resource: "focus", operation: "gain", amount: 1 }],
    replace: [],
    apply: baseRequest.phases.apply,
    after: [{ id: "after:damage", kind: "damage", targetId: "enemy-a", amount: 1 }],
  },
});
const phasedExecution = planApi.prepareExecution(phased).execution;
assert.deepEqual(clone(phasedExecution.operations.map(operation => operation.id)), ["before:resource", "damage:a", "damage:b", "after:damage"]);

const previewed = planApi.preview(draft, { scene: scene() });
const prepared = planApi.prepareExecution(previewed.plan, { scene: scene() });
assert.equal(prepared.execution.status, "previewed");
assert.equal(prepared.payment.paid, false, "preview bridge remains unpaid");
assert.deepEqual(clone(prepared.execution.targetSnapshots), clone(previewed.plan.targets));

// A target disappearing after preview is an atomic refusal before commit.
const missingTarget = scene();
missingTarget.actors = missingTarget.actors.filter(actorRecord => actorRecord.id !== "enemy-b");
rejects(() => planApi.commitExecution(previewed.plan, { scene: missingTarget }), /Цель.*недоступна|доступна/i);
assert.equal(previewed.plan.status, "previewed", "failed commit does not mutate the preview");

// A cancelled plan has no execution payment and cannot be confirmed.
const cancelled = planApi.cancel(draft, { operationId: "cancel:bridge", reason: "отмена до оплаты" });
const cancelledExecution = planApi.toExecution(cancelled);
assert.equal(cancelledExecution.execution.payment.paid, false);
rejects(() => planApi.commitExecution(cancelled), /закрытый|подтвержд/i);

// Two shape replacements produce a persisted choice. The choice carries the
// same root and concrete action instance through the continuation.
const conflictPlan = planApi.open({
  ...baseRequest,
  actionInstanceId: "action:bridge:choice",
  modifiers: [
    { id: "shape:single", type: "replace", field: "form", value: "single", sourceId: "hero", ruleId: "shape.single" },
    { id: "shape:line", type: "replace", field: "form", value: "line", sourceId: "spell", ruleId: "shape.line" },
  ],
});
const waiting = planApi.prepareExecution(conflictPlan);
assert.equal(waiting.waiting, true);
assert.equal(waiting.payment.paid, false);
assert.equal(waiting.choices.length, 1);
assert.equal(waiting.choices[0].rootActionId, conflictPlan.rootActionId);
assert.equal(waiting.choices[0].actionInstanceId, conflictPlan.actionInstanceId);
const resumed = planApi.resumeExecution(conflictPlan, waiting.choices[0].options[1], {
  conflictId: waiting.choices[0].conflictId,
  rootActionId: conflictPlan.rootActionId,
  actionInstanceId: conflictPlan.actionInstanceId,
  operationId: "choice:shape",
});
assert.equal(resumed.resumed, true);
assert.equal(resumed.plan.resolutions[waiting.choices[0].conflictId], waiting.choices[0].options[1]);
assert.equal(resumed.execution.rootActionId, conflictPlan.rootActionId);
assert.equal(resumed.execution.actionInstanceId, conflictPlan.actionInstanceId);
assert.equal(resumed.waiting, false, "the nested choice continues the same plan");

// Commit recomputes the quote, records one modifier consumption, and returns
// the existing execution vocabulary without touching a Scene.
const committed = planApi.commitExecution(prepared.plan, { scene: scene(), eventId: "event:bridge:commit" });
assert.equal(committed.replay, false);
assert.equal(committed.plan.status, "committed");
assert.equal(committed.payment.paid, false, "a pure bridge cannot claim that the Scene already paid");
assert.equal(committed.payment.commitRequested, true, "fresh commit asks the reducer to settle the reservation atomically");
assert.deepEqual(clone(committed.execution.targetIds), ["enemy-a", "enemy-b"]);
assert.deepEqual(clone(committed.execution.consumption.modifierIds), ["damage:once"]);
assert.equal(committed.execution.consumption.receipts.length, 1);
assert.equal(committed.plan.modifiers.find(modifier => modifier.id === "damage:once").consumedByActionId, draft.actionInstanceId);

// A committed plan is an acknowledged replay when converted directly; it
// cannot silently become a second paid execution.
const committedAgain = planApi.toExecution(committed.plan);
assert.equal(committedAgain.replay, true);
assert.equal(committedAgain.execution.payment.paid, false);

// Repeating a commit is a replay and does not create another consumption
// receipt. Reloading the execution descriptor validates all canonical queues.
const replayed = planApi.commitExecution(JSON.parse(JSON.stringify(committed.plan)), { scene: scene(), eventId: "event:bridge:commit" });
assert.equal(replayed.replay, true);
assert.equal(replayed.execution.payment.paid, false);
assert.equal(replayed.execution.consumption.receipts.length, 1);
const executionReloaded = execution.reloadActionPlan(JSON.stringify(committed.execution));
assert.deepEqual(clone(executionReloaded), clone(committed.execution), "execution descriptor survives JSON reload");
const executionReplay = execution.replayActionPlan(JSON.stringify(committed.execution));
assert.equal(executionReplay.replay, true);
assert.equal(executionReplay.execution.replay, true);

// A forged stored or supplied quote never reaches the execution bridge.
const forgedQuote = clone(previewed.plan);
forgedQuote.quote.totals.amount = 999;
rejects(() => planApi.commitExecution(forgedQuote, { scene: scene() }), /поддел|устарел|цитат/i);
rejects(() => planApi.commitExecution(previewed.plan, { scene: scene(), totals: { targetCount: 2, values: { amount: 999 }, amount: 999 } }), /totals|поддел/i);
const forgedExecution = clone(committed.execution);
forgedExecution.targetSnapshots[0].snapshot.x = 99;
rejects(() => execution.reloadActionPlan(forgedExecution), /повреждён|targetSnapshots|целей/i);
const forgedExecutionQuote = clone(committed.execution);
forgedExecutionQuote.quote.totals.amount = 999;
forgedExecutionQuote.result = clone(forgedExecutionQuote.quote);
rejects(() => execution.reloadActionPlan(forgedExecutionQuote), /quote|fingerprint|поддел|поврежд/i);
const forgedDirectPlan = clone(draft);
forgedDirectPlan.planId = "other-plan-id";
rejects(() => execution.actionPlanExecution(forgedDirectPlan), /ID|расход/i);
const nonJsonOperation = clone(draft);
nonJsonOperation.phases.apply[0].data = () => 1;
rejects(() => execution.actionPlanExecution(nonJsonOperation), /JSON|обычный|значение/i);
const changedTarget = scene();
changedTarget.actors.find(actorRecord => actorRecord.id === "enemy-a").x = 99;
rejects(() => planApi.commitExecution(prepared.plan, { scene: changedTarget }), /Снимок цели|устарел/i);

console.log("LionWing ActionPlan execution bridge: reservation, two targets, conflict continuation, unpaid preview/commit descriptor, one-time modifier intent, reload/replay and forged result rejection passed");
