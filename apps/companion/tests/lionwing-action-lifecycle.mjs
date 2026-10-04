import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { runtime, fixture, actor, clone, exactReplay } from "./helpers/scene-contract-harness.mjs";

const { core, engine, data } = runtime();
const commit = (scene, prepared, prefix) => {
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  const events = prepared.events.map((event, index) => ({ ...event, id: `${prefix}:${index}` }));
  const result = engine.dispatchMany(scene, events, { expectedVersion: scene.version });
  exactReplay(engine, core.reload(JSON.stringify(result.scene)), events);
  return result.scene;
};
const command = (scene, payload, prefix, random = () => .8) => {
  const before = clone(scene), prepared = core.prepare(scene, { actorId: "hero", ...payload }, { random });
  assert.deepEqual(clone(scene), before, "preview cannot mutate the source scene");
  return commit(scene, prepared, prefix);
};

function assertPausedUi(scene) {
  const roots = new Map(["scene-flow", "scene-roll-feed", "scene-action-tray"].map(id => [id, { dataset: {}, classList: { toggle() {} }, innerHTML: "" }]));
  const ui = {
    window: {}, Scene: core.reload(JSON.stringify(scene)), SceneEngine: engine, D: data, S: { id: "hero" },
    $: id => roots.get(id), esc: value => String(value ?? ""), activeSceneView: () => "gm",
    sceneTurnApprovalMode: () => "self", matchMedia: () => ({ matches: false }),
    sceneTrayHeroActor: () => scene.actors[0], sceneResourceChips: () => "", sceneBattleComplete: () => false,
  };
  vm.createContext(ui);
  for (const file of ["localization.js", "locale-ru.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), ui, { filename: file });
  const flow = fs.readFileSync(new URL("../scene-effects.js", import.meta.url), "utf8");
  vm.runInContext(flow.slice(flow.indexOf("function sceneFlowSteps")), ui);
  vm.runInContext("renderSceneFlow()", ui);
  assert.equal(roots.get("scene-flow").dataset.phase, "reaction", "a saved native decision takes priority over shared damage resolution");
  assert.match(roots.get("scene-flow").innerHTML, /Открыть решение/, "the flow opens the actual decision panel");
  assert.doesNotMatch(roots.get("scene-flow").innerHTML, /data-core-resolve|data-core-cancel-pending/, "a paused consequence cannot offer a second resolution or cancellation");
  const chrome = fs.readFileSync(new URL("../scene-ui.js", import.meta.url), "utf8");
  vm.runInContext(chrome.slice(chrome.indexOf("function renderSceneChrome(){"), chrome.indexOf("const renderSceneChromeWithoutActionPlanLock")), ui);
  vm.runInContext("renderSceneChrome()", ui);
  assert.match(roots.get("scene-action-tray").innerHTML, /Сначала ответьте на решение в пульте/);
  assert.doesNotMatch(roots.get("scene-action-tray").innerHTML, /data-core-action=|Примените урон|прервите Атаку/, "quick actions remain locked at the actual native decision");
}

// A public action cannot assert the private authorization of a free derived
// action, including when it is wrapped inside a transaction.
for (const wrapper of ["action", "batch", "plan"]) {
  const scene = fixture(); scene.actors[0].ap = 0; scene.activeActorId = "enemy";
  const action = { kind: "action", actionId: engine.ACTION_IDS.skirmish, attribute: "body", targetIds: ["enemy"],
    __derivedContract: { id: "untrusted.free-action", ignoreRange: true } };
  const payload = wrapper === "action" ? action : { kind: wrapper, operations: [action] };
  const before = clone(scene), prepared = core.prepare(scene, { actorId: "hero", ...payload }, { random: () => .8 });
  assert.equal(prepared.ok, false, `${wrapper}: public input cannot authorize a derived action`);
  assert.deepEqual(clone(scene), before, `${wrapper}: spoof refusal is immutable`);
}
for (const wrapper of ["move", "batch", "plan"]) {
  const scene = fixture(), before = clone(scene);
  const move = { kind: "move", destination: { space: "main", x: 7, y: 1 }, maximum: 0,
    __verifiedRoute: { spent: 0, path: [{ x: 7, y: 1 }], stoppedAt: { space: "main", x: 7, y: 1 }, terminal: false } };
  const payload = wrapper === "move" ? move : { kind: wrapper, operations: [move] };
  const prepared = core.prepare(scene, { actorId: "hero", ...payload });
  assert.equal(prepared.ok, false, `${wrapper}: a public route cannot bypass zero movement allowance`);
  assert.deepEqual(clone(scene), before, `${wrapper}: route spoof refusal is immutable`);
}
let unearnedJab = fixture(); unearnedJab.actors[1].x = 2;
unearnedJab.actors[0].knownTechniques = { "vagabond.skirmisher": 1 };
unearnedJab = command(unearnedJab, { kind: "automation", ruleId: "vagabond.skirmisher.1", enabled: true }, "unearned-jab-enable");
const unearnedBefore = clone(unearnedJab);
const unearnedPrepared = core.prepare(unearnedJab, { actorId: "hero", kind: "jab", targetId: "enemy" });
assert.equal(unearnedPrepared.ok, false, "a public Jab cannot bypass the Stride cause and once-per-Turn right");
assert.deepEqual(clone(unearnedJab), unearnedBefore, "an unearned Jab refusal is immutable");
// Direct event dispatch is another public boundary; preparation is optional
// for manual transactions, so it cannot be the only reserved-field guard.
for (const field of ["__derivedContract", "__verifiedRoute", "__execution"]) for (const wrapper of ["direct", "batch", "plan"]) {
  const scene = fixture(), before = clone(scene);
  const operation = { kind: "attack", targetIds: ["enemy"], amount: 1, [field]: { id: "untrusted", rootActionId: "forged", ignoreRange: true } };
  const payload = wrapper === "direct" ? operation : { kind: wrapper, operations: [operation] };
  assert.throws(() => core.dispatchMany(scene, [{ id: `raw-${field}-${wrapper}`, type: "lionwing.command", actorId: "hero", payload }], { expectedVersion: scene.version }), /[Вв]нутрен|[Пп]араметр|[Оо]пераци/, `${wrapper}: raw dispatch rejects ${field}`);
  assert.deepEqual(clone(scene), before, `${wrapper}: raw dispatch spoof cannot mutate the source`);
}
for (const [ruleId, payload] of [
  ["powerhouse.martial-artist.1", { kind: "martial-quick-step", targetId: "hero", destination: { space: "main", x: 2, y: 1 }, maximum: 1, evasion: 2 }],
  ["vagabond.skirmisher.2", { kind: "skirmisher-shift", targetId: "hero", destination: { space: "main", x: 3, y: 1 }, maximum: 2 }],
  ["powerhouse.breacher.1", { kind: "breacher-push", sourceActorId: "hero", targetId: "enemy", ruleId: "powerhouse.breacher.1", sourceDigest: "9e9680211a203830a82230d86136cc85108032eaea3655fc9e991129d2826af5", initialDistance: 1, maximum: 1 }],
]) {
  let scene = fixture(); scene.actors[0].knownTechniques = { [ruleId.replace(/\.\d+$/, "")]: Number(ruleId.match(/\.(\d+)$/)[1]) };
  scene = command(scene, { kind: "automation", ruleId, enabled: true }, `unearned-${ruleId}`);
  const before = clone(scene), prepared = core.prepare(scene, { actorId: "hero", ...payload });
  assert.equal(prepared.ok, false, `${payload.kind}: a public request cannot invent a canonical trigger`);
  assert.deepEqual(clone(scene), before, `${payload.kind}: no-trigger refusal is immutable`);
}

// Gas belongs to the defender's ally. Any Attack from outside it grants the
// defender 3 Evasion before reactions, irrespective of the execution route.
for (const route of ["native", "master", "npc"]) {
  let scene = fixture(); scene.actors[1].x = 5;
  scene.actors[0].knownTechniques = { "vagabond.master-at-arms": 3 };
  const targetId = route === "npc" ? "hero" : "enemy";
  const cell = route === "npc" ? "1,1" : "5,1";
  scene.areas = [{ ruleId: "disruptor.chemist.1", ownerActorId: targetId, space: "main", cells: [cell], label: "Gas" }];
  if (route === "npc") {
    scene.activeActorId = "enemy";
    scene.actors[1].profileId = "lionwing.npc.ranger";
    scene = commit(scene, engine.prepareEnemyRule(scene, data, {
      actorId: "enemy", ruleId: "lionwing.npc.ranger.take-the-shot", targetIds: [targetId],
      roll: { rolls: Array(7).fill(4), successes: 7, crits: 0, initialCount: 7 },
    }), "npc-gas");
  } else {
    scene = command(scene, { kind: "action", actionId: route === "native" ? engine.ACTION_IDS.spell : engine.ACTION_IDS.skirmish,
      attribute: route === "native" ? "spirit" : "talent", targetIds: [targetId],
      ...(route === "master" ? { armamentMode: "chain" } : {}),
    }, `${route}-gas`);
  }
  assert.equal(scene.actors.find(actor => actor.id === targetId).evasion, 3, `${route}: Gas grants Evasion before reactions`);
  assert.equal(scene.lionwing.restoredReceipts.filter(receipt => receipt.includes(":gas-evasion:")).length, 1, `${route}: one Gas application per Attack`);
  const reloaded = core.reload(JSON.stringify(scene));
  assert.equal(reloaded.actors.find(actor => actor.id === targetId).evasion, 3, `${route}: pending reload preserves Evasion`);
}

// Gunslinger III observes the resolved Attack, including the Armament bridge.
// The two critical faces are followed by noncritical extra dice.
for (const route of ["native", "master"]) {
  let scene = fixture(); scene.actors[1].x = route === "native" ? 2 : 5;
  scene.actors[0].knownTechniques = { "vagabond.master-at-arms": 3, "powerhouse.gunslinger": 3 };
  scene = command(scene, { kind: "automation", ruleId: "powerhouse.gunslinger.3", enabled: true }, `${route}-gun-enable`);
  let index = 0;
  scene = command(scene, { kind: "action", actionId: engine.ACTION_IDS.skirmish, attribute: "talent", targetIds: ["enemy"],
    ...(route === "master" ? { armamentMode: "chain" } : {}),
  }, `${route}-gun-attack`, () => index++ < 2 ? .99 : .8);
  scene = core.reload(JSON.stringify(scene));
  scene = route === "native" ? command(scene, { kind: "resolve-attack" }, "native-gun-resolve")
    : commit(scene, engine.resolvePendingAction(scene, data), "master-gun-resolve");
  const offers = scene.lionwing.choices.filter(choice => choice.context?.ruleId === "powerhouse.gunslinger.3");
  assert.equal(offers.length, 1, `${route}: two Crits offer one Gunslinger III choice`);
  assert.ok(offers[0].options.includes("enemy"), `${route}: the surviving Attack target is selectable`);
}

// Creator's mandatory Material consumption applies to fixed Jabs too.
// It must not change the canonical locked target or Talent/2 damage.
let jabScene = fixture(); jabScene.actors[1].x = 3;
jabScene.actors[0].knownTechniques = { "vagabond.skirmisher": 1, "ruiner.creation-ascetic": 1 };
for (const ruleId of ["vagabond.skirmisher.1", "ruiner.creation-ascetic.1"]) {
  jabScene = command(jabScene, { kind: "automation", ruleId, enabled: true }, `jab-enable-${ruleId}`);
}
jabScene = command(jabScene, { kind: "resource", resource: "material", operation: "gain", amount: 3 }, "jab-material");
jabScene = command(jabScene, { kind: "action", actionId: engine.ACTION_IDS.step, destination: { space: "main", x: 2, y: 1 } }, "jab-stride");
const jabChoice = jabScene.lionwing.choices.find(choice => choice.context?.ruleId === "vagabond.skirmisher.1");
assert.ok(jabChoice?.options.includes("jab:enemy"), "Stride opens the real canonical Jab choice");
jabScene = core.reload(JSON.stringify(jabScene));
jabScene = command(jabScene, { kind: "choice", id: jabChoice.id, choice: "jab:enemy" }, "jab-fixed-derived");
assert.equal(jabScene.actors[0].ruleResources.material.value, 0, "a fixed Jab spends all Material once");
assert.equal(jabScene.actors[1].hp, 28, "Material cannot modify a Jab's locked Talent/2 damage");
assert.ok(!jabScene.pendingAction, "a fixed Jab does not open an editable attack");
const jabDamage = jabScene.log.filter(event => event.type === "damage.apply" && event.payload?.derivedActionId === "vagabond.skirmisher.1");
assert.equal(jabDamage.length, 1, "a fixed Jab damages its single target once");
assert.equal(jabDamage[0].payload.targetId, "enemy", "a fixed Jab keeps its target lock");

// Body Finishers with Master learned still use the native route: Master III
// changes only Talent Finishers. Test its Dragon Slayer before-damage pause,
// then the real shared Blade Finisher's ordered Mark/Launch replacement pauses.
for (const route of ["native-body", "shared-blade"]) {
  let scene = fixture(); scene.actors[1].x = 2;
  scene.actors[0].knownTechniques = { "vagabond.master-at-arms": 3, "powerhouse.dragonslayer": 1 };
  scene.actors[0].ruleModes = { "vagabond.master-at-arms.armament": { modeId: "blade", sourceDigest: "d35f468065e84fbb0c86bc60015632bdbcfe9b0ced2ed2cfa370453f64a72371" } };
  Object.assign(scene.actors[1], { kind: "hero", heroId: "enemy", knownTechniques: { "powerhouse.berserker": 2 }, armor: route === "native-body" ? 20 : 0 });
  scene = command(scene, { kind: "automation", ruleId: "powerhouse.dragonslayer.1", enabled: true }, `${route}-dragon`);
  scene = command(scene, { kind: "automation", actorId: "enemy", ruleId: "powerhouse.berserker.2", enabled: true }, `${route}-replacement`);
  scene = command(scene, { kind: "action", actionId: engine.ACTION_IDS.finish, attribute: route === "native-body" ? "body" : "talent", targetIds: ["enemy"],
    ...(route === "shared-blade" ? { destination: { x: 3, y: 1 } } : {}),
  }, `${route}-finisher`);
  const shared = !scene.pendingAction.lionwing;
  scene = shared ? commit(scene, engine.respondReaction(scene, data, { actorId: "enemy", choice: "pass" }), `${route}-response`)
    : command(scene, { kind: "reaction", actorId: "enemy", choice: "take" }, `${route}-response`);
  const focusBefore = scene.actors[0].focus;
  scene = shared ? commit(scene, engine.resolvePendingAction(scene, data), `${route}-resolve`)
    : command(scene, { kind: "resolve-attack" }, `${route}-resolve`);
  assert.equal(scene.lionwing.choices[0]?.kind, "replacement", `${route}: the effect suspends at the native replacement boundary; effects=${JSON.stringify(scene.actors[1].effects)} recent=${JSON.stringify(scene.log.slice(0,8).map(event=>[event.type,event.payload?.effect]))}`);
  assert.equal(scene.lionwing.choices[0].context.effect, route === "native-body" ? "negative.разорван" : "negative.помечен", `${route}: the first effect is ordered correctly`);
  assert.equal(scene.actors[1].hp, route === "native-body" ? 30 : 25, `${route}: replacement pauses on the correct side of Attack damage`);
  assert.equal(scene.actors[0].focus, focusBefore + (route === "native-body" ? 2 : 0), `${route}: Dragon Slayer's Body-only gain occurs once before the pause`);
  scene = core.reload(JSON.stringify(scene));
  assertPausedUi(scene);
  const pausedSnapshot = clone(scene);
  for (const prepared of [engine.resolvePendingAction(scene, data), engine.cancelPendingAction(scene)]) {
    assert.equal(prepared.ok, false, `${route}: shared resolution/cancellation cannot jump over a native decision`);
    assert.match(prepared.errors.join(" "), /Сначала ответьте/);
    assert.equal(prepared.events.length, 0);
  }
  assert.throws(() => engine.dispatchMany(scene, [{ id: `${route}-raw-clear-while-paused`, type: "attack.clear", actorId: "hero", payload: { cancelled: true } }]), /Сначала ответьте/, "direct packet cancellation is guarded before the waiting cursor");
  assert.deepEqual(clone(scene), pausedSnapshot, `${route}: paused refusal leaves damage, decisions and continuation unchanged`);
  scene = command(scene, { kind: "choice", actorId: "enemy", id: scene.lionwing.choices[0].id, choice: "keep" }, `${route}-keep-first`);
  if (shared) {
    assert.equal(scene.lionwing.choices[0]?.context.effect, "negative.подброшен", "the shared tail resumes to Launch after Mark");
    assert.equal(scene.actors[1].hp, 25, "resuming the shared tail never repeats damage");
    scene = core.reload(JSON.stringify(scene));
    scene = command(scene, { kind: "choice", actorId: "enemy", id: scene.lionwing.choices[0].id, choice: "keep" }, "shared-keep-launch");
    assert.ok(scene.actors[1].effects.includes("negative.помечен"));
    assert.ok(scene.actors[1].effects.includes("negative.подброшен"));
  } else assert.ok(scene.actors[1].effects.includes("negative.разорван"));
  assert.equal(scene.actors[1].hp, 25, `${route}: final Attack damage occurs once`);
  assert.ok(!scene.pendingAction, `${route}: the resumed Attack closes; deferred=${JSON.stringify(scene.lionwing.deferred)} cursor=${JSON.stringify(scene.lionwing.executionCursor)} recent=${JSON.stringify(scene.log.slice(0,8).map(event=>event.type))}`);
  assert.equal(scene.lionwing.choices.length, 0, `${route}: all replacement choices complete`);
  assert.equal(scene.lionwing.deferred.length, 0, `${route}: the private continuation is drained`);
  assert.equal(scene.actors[0].focus, focusBefore + (route === "native-body" ? 2 : 0), `${route}: continuation and replay never repeat the Dragon gain`);
}

// A real NPC Heal cannot restore a Compound beyond its surviving Health gate.
// This is a non-Attack shared packet; it must use the same healing foundation.
let compoundScene = fixture(); compoundScene.activeActorId = "healer";
compoundScene.actors = [
  actor("healer", "enemy", 1, 1, { profileId: "lionwing.npc.healer" }),
  actor("part1", "enemy", 2, 1, { profileId: "lionwing.npc.bruiser", compoundId: "boss", hp: 19, maxHp: 20 }),
  actor("part2", "enemy", 2, 1, { profileId: "lionwing.npc.ranger", compoundId: "boss", hp: 0, maxHp: 20 }),
];
const compoundPreview = engine.prepareEnemyRule(compoundScene, data, { actorId: "healer", ruleId: "lionwing.npc.healer.heal", targetIds: ["part1"] });
const compoundInput = clone(compoundScene);
compoundScene = commit(compoundScene, compoundPreview, "compound-npc-heal");
assert.equal(compoundScene.actors[1].hp, 20, "NPC Heal restores the surviving Compound part up to its gate");
assert.equal(compoundScene.actors[2].hp, 0, "NPC Heal cannot recover a lost Compound part across a Health gate");
assert.equal(compoundScene.actors[0].ap, 2, "the real NPC Heal pays its one AP once");
const noIdResult = engine.dispatchMany(compoundInput, compoundPreview.events.map(({ id, ...event }) => event));
const profileRow = noIdResult.scene.actors[0].lionwing.history.at(-1);
assert.equal(profileRow.actionId, "lionwing.npc.healer.heal", "profile history uses the canonical NPC rule ID");
assert.equal(profileRow.profileId, "lionwing.npc.healer", "profile history keeps the canonical profile identity");
assert.ok(profileRow.actionInstanceId && !profileRow.actionInstanceId.includes("undefined"), "unstamped canonical packets receive a real private Action identity");
assert.equal(new Set(noIdResult.scene.log.map(event => event.id)).size, noIdResult.scene.log.length, "unstamped shared packet receipts have distinct IDs");
assert.deepEqual(clone(compoundInput.actors[0].lionwing.history || []), [], "profile execution does not attach mutable history to its input fixture");
profileRow.targetIds.push("mutated-output-only");
assert.deepEqual(clone(compoundPreview.events[0].payload.targetIds), ["part1"], "profile history does not alias the canonical prepared target list");

// External acknowledgement and the private shared continuation have different
// boundaries. A mixed retry must skip accepted raw changes, then finish the
// fresh canonical shared packet, including after a save/reload.
let retryScene = fixture(); retryScene.actors[1].x = 5;
retryScene.actors[0].knownTechniques = { "vagabond.master-at-arms": 1 };
const acceptedRaw = [
  { id: "mixed-old-resource", type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 2 } },
  { id: "mixed-old-effect", type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.порчен" } },
];
retryScene = engine.dispatchMany(retryScene, acceptedRaw).scene;
retryScene = command(retryScene, { kind: "action", actionId: engine.ACTION_IDS.skirmish, attribute: "talent", armamentMode: "chain", targetIds: ["enemy"] }, "mixed-master-start");
const focusAtRetry = retryScene.actors[0].focus;
const freshResolve = engine.resolvePendingAction(retryScene, data);
assert.equal(freshResolve.ok, true, freshResolve.errors?.join(" "));
const freshGain = { id: "mixed-new-gain", type: "resource.gain", actorId: "hero", payload: { resource: "focus", amount: 1 } };
const freshEffect = { id: "mixed-new-effect", type: "effect.apply", actorId: "hero", payload: { targetId: "enemy", effect: "negative.замедлен" } };
const mixedRetry = [...acceptedRaw, freshGain, freshGain, freshEffect, freshEffect, ...freshResolve.events.map((event, index) => ({ ...event, id: `mixed-fresh-resolve:${index}` }))];
retryScene = core.reload(JSON.stringify(retryScene));
const mixedResult = engine.dispatchMany(retryScene, mixedRetry, { expectedVersion: retryScene.version });
retryScene = mixedResult.scene;
assert.equal(retryScene.actors[0].focus, focusAtRetry + 1, "a mixed retry skips accepted gains and applies each fresh resource ID once");
assert.equal(mixedResult.events.filter(event => event.type === "resource.gain" && event.payload?.resource === "focus").length, 1, "duplicate fresh raw resource IDs emit one gain");
assert.equal(mixedResult.events.filter(event => event.type === "effect.apply" && event.payload?.effect === "negative.замедлен").length, 1, "duplicate fresh raw effect IDs emit one application");
assert.equal(mixedResult.events.filter(event => event.type === "effect.apply" && event.payload?.effect === "negative.порчен").length, 0, "an accepted raw effect is not applied again by a mixed shared retry");
assert.ok(!retryScene.pendingAction, "fresh shared resolution still completes after accepted raw IDs are skipped");
exactReplay(engine, core.reload(JSON.stringify(retryScene)), mixedRetry);
const conflictingRaw = mixedRetry.map(event => event.id === "mixed-old-resource" ? { ...event, payload: { ...event.payload, amount: 3 } } : event);
const immutableRetry = clone(retryScene);
assert.throws(() => engine.dispatchMany(retryScene, conflictingRaw), /Конфликт ID/i, "old raw ID with changed content remains an ID conflict");
assert.deepEqual(clone(retryScene), immutableRetry, "conflicting mixed retry leaves the scene unchanged");

console.log("LionWing Action lifecycle: native/Master/NPC hooks, fixed resources, replacement continuation, healing gates, immutable preview, reload and exact replay passed");
