import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// This test intentionally loads the two pure foundations directly.  It does
// not boot the browser, reducer, or Technique registry.
const context = { window: {}, console };
vm.createContext(context);
for (const file of ["lionwing-execution.js", "lionwing-action-plan.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
}
const api = context.window.DAWN_LIONWING_ACTION_PLAN;
assert.ok(api, "the ActionPlan foundation is exposed globally");

const clone = value => JSON.parse(JSON.stringify(value));
const actor = (id, team = "hero", x = 1, y = 1, extra = {}) => ({
  id,
  team,
  kind: team === "hero" ? "hero" : "enemy",
  space: "main",
  x,
  y,
  hp: 10,
  knockedOut: false,
  ...extra,
});
const scene = () => ({
  version: 5,
  actors: [actor("hero"), actor("enemy", "enemy", 3, 1), actor("enemy-2", "enemy", 4, 1)],
});

const request = {
  rootActionId: "root:one",
  definitionId: "action.same-name",
  actionInstanceId: "root:one:action:one",
  source: { id: "hero", kind: "actor", actorId: "hero", causeEventId: "event:source" },
  owner: { id: "hero", kind: "actor", actorId: "hero" },
  sceneVersion: 5,
  targets: [{ targetId: "enemy", snapshot: { armor: 2, space: "main", x: 3, y: 1 } }],
  baseValues: { amount: 2, pool: 1, form: "single" },
  costs: [{ kind: "resource", resource: "focus", amount: 1 }],
  dicePolicy: { kind: "check", pool: 1, attribute: "talent" },
  geometry: { anchor: { kind: "actor", actorId: "hero", space: "main", x: 1, y: 1 } },
  phases: {
    before: [{ id: "before:check", kind: "check" }],
    replace: [{ id: "replace:choose", kind: "choose-replacement" }],
    apply: [{ id: "apply:damage", kind: "damage", targetId: "enemy" }],
    after: [{ id: "after:log", kind: "history" }],
  },
  modifiers: [
    { id: "shape:single", type: "replace", field: "form", value: "single", sourceId: "hero", ruleId: "rule.shape.single", lifetime: "action", order: 1 },
    { id: "shape:line", type: "replace", field: "form", value: "line", sourceId: "spell", ruleId: "rule.shape.line", lifetime: "action", order: 2 },
    { id: "damage:once", type: "add", field: "amount", amount: 1, sourceId: "hero", ruleId: "rule.damage.once", lifetime: "action", order: 3, consume: true, consumeBoundary: "commit" },
  ],
};

const beforeOpen = clone(request);
const draft = api.open(request);
assert.deepEqual(request, beforeOpen, "open does not mutate its request");
assert.throws(() => api.open({ ...request, total: 99 }), /вычисляется|подставить/i, "derived totals are not accepted at open");
assert.throws(()=>api.open({...request,actionInstanceId:"bad-cost-empty",costs:[]}),/хотя бы одну|цена/i);
assert.throws(()=>api.open({...request,actionInstanceId:"bad-cost-many",costs:Array.from({length:17},(_,index)=>({kind:"resource",resource:`r${index}`,amount:1}))}),/массив|16|цена/i);
assert.throws(()=>api.open({...request,actionInstanceId:"bad-dice-kind",dicePolicy:{kind:"bogus",pool:1}}),/вид броска/i);
assert.throws(()=>api.open({...request,actionInstanceId:"bad-raw-explode",dicePolicy:{kind:"raw-d6",pool:1,explode:true}}),/Сырая D6/i);
const duplicateTargetRequest = { ...request, actionInstanceId: "duplicate-targets", targetIds: ["enemy", "enemy"] };
delete duplicateTargetRequest.targets;
assert.throws(()=>api.open(duplicateTargetRequest),/Повтор ID|Повторная цель/i);
assert.throws(()=>api.open({...request,actionInstanceId:"duplicate-operations",phases:{before:[{id:"same-operation",kind:"check"}],after:[{id:"same-operation",kind:"history"}]}}),/уникальны/i);
assert.throws(()=>api.open({...request,actionInstanceId:"forged-history",receipts:[{eventId:"fake",revision:0,fingerprint:"fake"}]}),/квитанц|истори/i);
const driftedSnapshots = clone(draft);
driftedSnapshots.snapshots.targets[0].snapshot.armor = 99;
assert.throws(() => api.reload(driftedSnapshots), /Снимки целей расходятся/i, "duplicated snapshots cannot drift across reload");
assert.equal(draft.definitionId, "action.same-name");
assert.equal(draft.actionInstanceId, "root:one:action:one");
assert.equal(draft.rootActionId, "root:one");
assert.equal(draft.source.actorId, "hero");
assert.equal(draft.ownerActorId, "hero");
assert.deepEqual(JSON.parse(JSON.stringify(draft.phases.before.map(item => item.kind))), ["check"]);
assert.deepEqual(JSON.parse(JSON.stringify(draft.phases.replace.map(item => item.kind))), ["choose-replacement"]);
assert.deepEqual(JSON.parse(JSON.stringify(draft.targets[0].snapshot)), request.targets[0].snapshot);

const root = api.openMany({
  rootActionId: "root:two",
  actions: [
    { definitionId: "action.same-name", actionInstanceId: "root:two:a", sourceId: "hero", ownerActorId: "hero", targetIds: ["enemy"], baseValues: { amount: 1 } },
    { definitionId: "action.same-name", actionInstanceId: "root:two:b", sourceId: "hero", ownerActorId: "hero", targetIds: ["enemy"], baseValues: { amount: 1 } },
  ],
});
assert.equal(root.actions.length, 2);
assert.equal(root.actions[0].definitionId, root.actions[1].definitionId, "same definition can occur twice");
assert.notEqual(root.actions[0].actionInstanceId, root.actions[1].actionInstanceId, "same-named uses have separate instances");
assert.equal(root.actions[0].rootActionId, root.actions[1].rootActionId);

const conflictStatus = api.checkConflicts(draft);
assert.equal(conflictStatus.ok, false);
assert.equal(conflictStatus.unresolved.length, 1, "two shape replacements are an explicit conflict");
assert.deepEqual(JSON.parse(JSON.stringify(conflictStatus.unresolved[0].modifierIds)), ["shape:line", "shape:single"]);
assert.equal(api.quoteStatus(draft).ok, false, "preview refuses an unresolved replacement choice");
const disjointShapeUses = api.open({
  ...request,
  actionInstanceId: "root:one:action:disjoint",
  targets: [{ targetId: "enemy-2", snapshot: {} }],
  modifiers: request.modifiers.map(item => item.id === "shape:single" ? { ...item, targetIds: ["enemy"] } : item.id === "shape:line" ? { ...item, targetIds: ["enemy-2"] } : item),
});
assert.equal(api.checkConflicts(disjointShapeUses).conflicts.length, 0, "disjoint per-target shape replacements do not conflict");

const resolved = api.resolveConflict(draft, "field:form", "shape:line", { operationId: "choose:shape" });
assert.equal(resolved.revision, 1, "a saved replacement decision creates a new revision");
assert.equal(resolved.resolutions["field:form"], "shape:line");
assert.throws(()=>api.resolveConflict(resolved,"field:form","shape:single",{operationId:"choose:shape"}),/тем же ID|другой выбор/i,"a replayed resolution ID cannot hide a different choice");
const quoted = api.quote(resolved);
assert.deepEqual(JSON.parse(JSON.stringify(quoted.outcomes.enemy.values)), { amount: 3, pool: 1, form: "line", armor: 2, space: "main", x: 3, y: 1 });
assert.equal(quoted.consumedModifierIds.length, 1, "a consumable modifier is listed once");
assert.equal(quoted.consumedModifierIds[0], "damage:once");
assert.equal(quoted.totals.amount, 3);

const previewed = api.preview(resolved, { scene: scene() });
assert.equal(previewed.ok, true);
assert.equal(previewed.plan.status, "previewed");
assert.equal(previewed.plan.phase, "apply");
const committed = api.commit(previewed.plan, { eventId: "event:action-one", scene: scene() });
assert.equal(committed.replay, false);
assert.equal(committed.plan.status, "committed");
assert.equal(committed.plan.phase, "after");
assert.equal(committed.plan.modifiers.find(item => item.id === "damage:once").consumedByActionId, draft.actionInstanceId);

const jsonReloaded = api.reload(JSON.stringify(committed.plan));
assert.deepEqual(JSON.parse(JSON.stringify(jsonReloaded)), JSON.parse(JSON.stringify(committed.plan)), "a committed ActionPlan survives JSON reload");
assert.deepEqual(JSON.parse(JSON.stringify(api.commit(jsonReloaded, { eventId: "event:action-one" }).plan)), JSON.parse(JSON.stringify(jsonReloaded)), "replaying the same commit is idempotent");

const forgedTotals = clone(previewed.plan);
forgedTotals.quote.totals.amount = 999;
assert.throws(() => api.commit(forgedTotals), /поддел|устарел|цитат/i, "forged totals in a saved preview are rejected");
assert.throws(() => api.commit(previewed.plan, { totals: { targetCount: 1, values: { amount: 999 }, amount: 999 } }), /totals|поддел/i, "forged totals supplied at confirm are rejected");

const retargeted = api.amend(resolved, { targetIds: ["enemy-2"] }, { operationId: "retarget:one", window: "targeting" });
assert.equal(retargeted.revision, 2);
assert.deepEqual(JSON.parse(JSON.stringify(retargeted.targetIds)), ["enemy-2"]);
assert.equal(retargeted.outcomes["enemy-2"].status, "pending");
assert.throws(() => api.amend(retargeted, { targetIds: ["enemy"] }, { operationId: "retarget:one", window: "targeting" }), /тем же ID|другие данные/i, "a replayed amend ID cannot hide a different patch");
const retargetedByRows=api.amend(resolved,{targets:["enemy-2"]},{operationId:"retarget:rows",window:"targeting"});
assert.equal(retargetedByRows.targetIds[0],"enemy-2","string target rows are normalized before outcomes are rebuilt");
assert.throws(() => api.amend(previewed.plan, { targetIds: ["enemy-2"] }, { operationId: "late:without-window" }), /именованном окне|retarget/i, "late retargeting requires its named window");
assert.throws(() => api.amend(resolved, { definitionId: "forged-definition" }), /нельзя изменить|amend/i, "identity is immutable through amend");

const missingTarget = scene();
missingTarget.actors = missingTarget.actors.filter(item => item.id !== "enemy");
assert.throws(() => api.commit(previewed.plan, { scene: missingTarget }), /Цель.*недоступна/i, "a target disappearing after preview invalidates the plan");

const explanation = api.explain(resolved);
assert.equal(explanation.ok, true);
assert.equal(explanation.source.id, "hero");
assert.equal(explanation.owner.id, "hero");
assert.equal(explanation.outcomes.enemy.values.form, "line");
assert.match(explanation.text, /action\.same-name/);

const cancelled = api.cancel(resolved, { reason: "Передумали", operationId: "cancel:one" });
assert.equal(cancelled.status, "cancelled");
assert.throws(() => api.commit(cancelled), /закрытый|отменён/i);
const incompleteCommitted=clone(committed.plan);delete incompleteCommitted.quote;delete incompleteCommitted.result;
assert.throws(()=>api.reload(incompleteCommitted),/quote|result|сохранённые/i);
const forgedReceipt=clone(committed.plan);forgedReceipt.receipts[0].fingerprint="forged";
assert.throws(()=>api.reload(forgedReceipt),/Квитанция|повреждена/i);
const stacked=api.open({...request,actionInstanceId:"stacked-highest",modifiers:[{id:"low",type:"add",field:"amount",amount:1,sourceId:"hero",ruleId:"low",lifetime:"action",stackingPolicy:"highest",consume:true},{id:"high",type:"add",field:"amount",amount:3,sourceId:"hero",ruleId:"high",lifetime:"action",stackingPolicy:"highest",consume:true}]});
const stackedQuote=api.quote(stacked);assert.equal(stackedQuote.totals.amount,5);assert.equal(JSON.stringify(stackedQuote.consumedModifierIds),JSON.stringify(["high"]));assert.equal(stackedQuote.outcomes.enemy.appliedModifierIds.includes("low"),false);

console.log("LionWing ActionPlan foundation: separate definition/instance IDs, root siblings, snapshots, phases, replacement conflicts, consumable modifiers, forged totals, amend windows, reload and replay passed");
