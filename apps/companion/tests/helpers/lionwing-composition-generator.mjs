import assert from "node:assert/strict";
import fs from "node:fs";
import { runtime, fixture, actor, clone, exactReplay } from "./scene-contract-harness.mjs";

export const profiles = [
  { id: "master-mundane-student", levels: { "vagabond.master-at-arms": 3, "bulwark.mundane": 2, "ruiner.student-of-stars": 1 }, enabled: ["bulwark.mundane.2", "ruiner.student-of-stars.1"] },
  { id: "master-creator-student", levels: { "vagabond.master-at-arms": 3, "ruiner.creation-ascetic": 1, "ruiner.student-of-stars": 1 }, enabled: ["ruiner.creation-ascetic.1", "ruiner.student-of-stars.1"] },
  { id: "master-gunslinger", levels: { "vagabond.master-at-arms": 3, "powerhouse.gunslinger": 3 }, enabled: ["powerhouse.gunslinger.3"] },
  { id: "master-spellsword", levels: { "vagabond.master-at-arms": 3, "powerhouse.spellsword": 3 }, enabled: ["powerhouse.spellsword.3"] },
  { id: "mundane-student", levels: { "bulwark.mundane": 2, "ruiner.student-of-stars": 1 }, enabled: ["bulwark.mundane.2", "ruiner.student-of-stars.1"] },
  { id: "fixed-skirmisher-creator", fixed: "stride", levels: { "vagabond.skirmisher": 1, "ruiner.creation-ascetic": 1 }, enabled: ["vagabond.skirmisher.1", "ruiner.creation-ascetic.1"] },
  { id: "fixed-flurry-creator", fixed: "flurry", levels: { "powerhouse.dual-wielder": 1, "ruiner.creation-ascetic": 1 }, enabled: ["powerhouse.dual-wielder.1", "ruiner.creation-ascetic.1"] },
];
const canonical = JSON.parse(fs.readFileSync(new URL("../../../../source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json", import.meta.url), "utf8"));
const canonicalLevels = new Map(canonical.archetypes.flatMap(archetype => archetype.techniques.map(technique => [technique.id, technique.levels.map(level => level.n)])));
for (const profile of profiles) for (const [id, level] of Object.entries(profile.levels)) assert.ok(canonicalLevels.get(id)?.includes(level), `${profile.id}: canonical LionWing fixture ${id}.${level}`);
const addonPool = [
  { id: "ruiner.student-of-stars", level: 1 },
  { id: "powerhouse.spellsword", level: 3 },
  { id: "powerhouse.dragonslayer", level: 1 },
];
function composedProfile(testCase) {
  const base = profiles.find(item => item.id === testCase.profile);
  assert.ok(base, "known composition profile");
  const profile = clone(base);
  for (const addon of testCase.addons || []) {
    assert.ok(addonPool.some(item => item.id === addon.id && item.level === addon.level), "reviewed compatible addon");
    profile.levels[addon.id] = Math.max(profile.levels[addon.id] || 0, addon.level);
    profile.enabled.push(`${addon.id}.${addon.level}`);
  }
  assert.ok(["bulwark.mundane", "ruiner.creation-ascetic", "powerhouse.gunslinger"].filter(id => profile.levels[id]).length <= 1, "Focus replacers remain mutually exclusive");
  for (const [id, level] of Object.entries(profile.levels)) assert.ok(canonicalLevels.get(id)?.includes(level), `canonical generated technique ${id}.${level}`);
  profile.enabled = [...new Set(profile.enabled)];
  return profile;
}
export function random(seed) {
  let value = Number(seed) >>> 0;
  return () => { value += 0x6D2B79F5; let x = value; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; };
}
export function generate(seed, count = 16) {
  const pick = random(seed), base = profiles[seed % profiles.length];
  const addons = addonPool.filter(item => !base.levels[item.id] && pick() < .6).map(clone);
  const profile = composedProfile({ profile: base.id, addons });
  const armament = profile.levels["vagabond.master-at-arms"] ? ["blade", "polearm", "chain"][Math.floor(pick() * 3)] : null;
  const trace = [{ type: "gain", resource: profile.levels["ruiner.creation-ascetic"] ? "material" : "focus", amount: 3 }];
  const initialActions = profile.fixed ? [profile.fixed === "stride" ? "step" : "skirmish"] : profile.levels["vagabond.master-at-arms"] ? (profile.levels["bulwark.mundane"] ? ["skirmish", "finish"] : ["skirmish", "spell", "finish"]) : ["finish"];
  for (const [index, action] of initialActions.entries()) trace.push({ type: "action", action, required: index === 0, focus: 0, bullets: false, rollSeed: (seed ^ 0x13579BDF) >>> 0 }, { type: "reload" }, { type: "resolve" });
  if (profile.fixed === "stride") trace.splice(3, 0, { type: "fixed-jab", required: true });
  if (profile.fixed === "flurry") trace.push({ type: "fixed-jab", required: true }, { type: "reload" });
  for (let index = 0; index < count; index++) {
    const choice = Math.floor(pick() * 7);
    if (choice < 3) {
      trace.push({ type: "action", action: ["spell", "finish", "skirmish"][choice], attribute: choice === 1 && profile.levels["powerhouse.dragonslayer"] && pick() < .5 ? "body" : undefined, focus: Math.floor(pick() * 3), bullets: pick() < .5, rollSeed: Math.floor(pick() * 0xffffffff) });
      trace.push({ type: "reload" }, { type: "resolve" });
    } else trace.push({ type: ["refuse", "extra-turn", "new-round", "gain"][choice - 3], resource: "focus", amount: 3 });
  }
  return { seed, profile: profile.id, addons, armament, trace };
}

export function runTrace(testCase) {
  assert.ok(testCase && typeof testCase === "object" && !Array.isArray(testCase), "composition replay must be an object");
  assert.ok(Number.isSafeInteger(testCase.seed) && testCase.seed >= 0 && testCase.seed <= 4294967295, "composition replay seed must be uint32");
  assert.ok(Array.isArray(testCase.trace) && testCase.trace.length > 0 && testCase.trace.length <= 4096, "composition replay requires a bounded nonempty trace");
  assert.ok(testCase.addons === undefined || Array.isArray(testCase.addons), "composition addons must be an array");
  assert.ok(testCase.armament === undefined || testCase.armament === null || ["blade", "polearm", "chain"].includes(testCase.armament), "known composition armament");
  const stepTypes = new Set(["gain", "action", "reload", "resolve", "fixed-jab", "refuse", "extra-turn", "new-round"]);
  for (const step of testCase.trace) {
    assert.ok(step && typeof step === "object" && !Array.isArray(step) && stepTypes.has(step.type), "known composition trace step type");
    if (step.type === "action") {
      assert.ok(["spell", "finish", "skirmish", "step"].includes(step.action), "known composition trace Action");
      assert.ok(Number.isSafeInteger(step.rollSeed) && step.rollSeed >= 0 && step.rollSeed <= 4294967295, "Action roll seed must be uint32");
      assert.ok(Number.isSafeInteger(step.focus) && step.focus >= 0 && step.focus <= 99, "Action Focus must be a bounded integer");
      assert.ok(step.attribute === undefined || ["body", "talent", "spirit", "mind"].includes(step.attribute), "known Action attribute");
    }
    if (step.type === "gain") {
      assert.ok(["focus", "material"].includes(step.resource), "known generated resource");
      assert.ok(Number.isSafeInteger(step.amount) && step.amount >= 0 && step.amount <= 99, "resource amount must be a bounded integer");
    }
  }
  const { core, engine, data, context } = runtime(), profile = composedProfile(testCase), routes = new Set();
  const armament = testCase.armament || "chain";
  let scene = fixture(); scene.lionwing.started = true; scene.lionwing.activeTurnInstanceId = "composition-turn";
  scene.actors[0].knownTechniques = clone(profile.levels); scene.actors[1].x = profile.fixed === "stride" ? 3 : profile.levels["vagabond.master-at-arms"] ? ({blade:3,polearm:2,chain:5}[armament]) : 2;
  if (profile.levels["vagabond.master-at-arms"] && armament === "polearm") scene.actors.push(actor("enemy2", "enemy", 1, 2, { hp: 200, maxHp: 200 }));
  scene.actors[1].hp = 200; scene.actors[1].maxHp = 200;
  let serial = 0, accepted = 0, refused = 0;
  const refusals = {};
  const hero = () => scene.actors[0];
  const commit = prepared => {
    assert.equal(prepared.ok, true, prepared.errors?.join(" "));
    const events = prepared.events.map((event, index) => ({ ...event, id: `composition:${serial++}:${index}` }));
    const old = clone(scene), result = engine.dispatchMany(scene, events, { expectedVersion: scene.version });
    assert.deepEqual(clone(scene), old, "dispatch leaves its input snapshot unchanged");
    scene = result.scene;
    const applied = result.events || [];
    const clearedAt = applied.findIndex(event => event.type === "attack.clear" && !event.payload?.cancelled);
    if (clearedAt >= 0) {
      const damageAt = applied.map((event, index) => event.type === "damage.apply" ? index : -1).filter(index => index >= 0);
      for (const index of damageAt) assert.ok(index < clearedAt, "Attack closes only after its actual damage is committed");
      const targets = applied.filter(event => event.type === "damage.apply" && event.actorId === applied[clearedAt].actorId).map(event => event.payload.targetId);
      assert.equal(new Set(targets).size, targets.length, "one completed Attack damages each locked target once");
    }
    exactReplay(engine, core.reload(JSON.stringify(scene)), events);
    for (const actor of scene.actors) for (const [id, resource] of Object.entries(actor.ruleResources || {})) {
      assert.ok(Number(resource.value) >= 0, `nonnegative resource ${actor.id}:${id}`);
    }
  };
  const prepare = (payload, seed = 1) => {
    const before = clone(scene), prepared = core.prepare(scene, { actorId: "hero", eventId: `composition-command:${serial++}`, ...payload }, { random: random(seed) });
    assert.deepEqual(clone(scene), before, "prepare/refusal does not mutate scene");
    return prepared;
  };
  for (const ruleId of profile.enabled) commit(prepare({ kind: "automation", ruleId, enabled: true }));
  for (const ruleId of profile.enabled) {
    for (const dependency of context.window.DAWN_LIONWING_RESTORED_TECHNIQUES.dependencies(ruleId)) {
      const split = dependency.lastIndexOf("."), id = dependency.slice(0, split), level = Number(dependency.slice(split + 1));
      assert.ok(profile.levels[id] >= level && canonicalLevels.get(id)?.includes(level), "enabled dependency is canonically learned");
      assert.equal(hero().lionwing.automation[dependency], true, "enabled dependency is installed");
    }
  }
  const fixedRule = profile.fixed === "flurry" ? "powerhouse.dual-wielder.1" : "vagabond.skirmisher.1";
  let awaitingFixed = Boolean(profile.fixed);
  function drainChoices() {
    while (scene.lionwing.choices?.length) {
      const choice = scene.lionwing.choices[0];
      if (awaitingFixed && choice.context?.ruleId === fixedRule) break;
      const answer = choice.options.includes("skip") ? "skip" : choice.kind === "replacement" && choice.options.includes("keep") ? "keep" : null;
      if (!answer) break;
      commit(prepare({ kind: "choice", actorId: choice.actorId, id: choice.id, choice: answer }));
    }
  }
  function resolve() {
    drainChoices();
    if (scene.lionwing.choices?.length) return;
    if (scene.pendingAction?.lionwing) commit(prepare({ kind: "resolve-attack" }));
    else if (scene.pendingAction) commit(engine.resolvePendingAction(scene, data));
    drainChoices();
  }
  for (const [index, step] of testCase.trace.entries()) {
    try {
      if (step.type === "reload") { const before = clone(scene); scene = core.reload(JSON.stringify(scene)); assert.deepEqual(clone(scene), before, "reload is lossless"); }
      else if (step.type === "resolve") resolve();
      else if (step.type === "gain") {
        const prepared = prepare({ kind: "resource", resource: step.resource, operation: "gain", amount: step.amount });
        if (prepared.ok) commit(prepared);
        else { assert.match(prepared.errors.join(" "), /ожидающее решение|замен|запрещ|Фокус/i, "resource gain has an explained refusal"); refused++; }
      }
      else if (step.type === "fixed-jab") {
        const choice = scene.lionwing.choices?.find(item => item.context?.ruleId === fixedRule);
        if (!choice) { if (step.required) assert.fail("required fixed Jab has no Stride trigger"); continue; }
        const option = profile.fixed === "flurry" ? choice.options.find(value => /^flurry:(body|talent)$/.test(value)) : "jab:enemy";
        assert.ok(choice.options.includes(option), "the real trigger selects the canonical fixed action");
        const beforeHp = scene.actors[1].hp, expected = Math.ceil(hero().attrs[profile.fixed === "flurry" ? option.split(":")[1] : "talent"] / 2);
        commit(prepare({ kind: "choice", id: choice.id, choice: option })); accepted++; routes.add(`fixed:${fixedRule}`);
        assert.equal(hero().ruleResources.material.value, 0, "fixed derived Skirmish consumes all Material once");
        assert.equal(scene.actors[1].hp, beforeHp - expected, "fixed derived damage remains Talent/2 despite Material");
        assert.ok(!scene.pendingAction, "fixed derived targeting cannot become editable");
        const row = hero().lionwing.history.findLast(item => item.derivedActionId === fixedRule);
        assert.ok(row?.actionInstanceId, "fixed derived action retains an authoritative instance identity");
        assert.deepEqual(clone(row.targetIds), ["enemy"], "fixed derived history preserves the locked target");
        awaitingFixed = false; resolve();
      }
      else if (step.type === "refuse") {
        const before = clone(scene), prepared = prepare({ kind: "action", actionId: engine.ACTION_IDS.finish, attribute: "talent", targetIds: ["missing"], focusSpent: -1 });
        assert.equal(prepared.ok, false, "invalid target/Focus is rejected"); assert.deepEqual(clone(scene), before, "refusal has no partial costs/history"); refused++;
      } else if (step.type === "extra-turn" && !scene.pendingAction && !scene.lionwing.choices?.length) {
        if (scene.activeActorId === "hero") { commit(prepare({ kind: "grant-turn", targetId: "hero" })); commit(prepare({ kind: "turn-end" })); commit(prepare({ kind: "turn-start" })); }
      } else if (step.type === "new-round" && !scene.pendingAction && !scene.lionwing.choices?.length) {
        if (scene.activeActorId === "hero") commit(prepare({ kind: "turn-end" }));
        for (const enemy of scene.actors.filter(item => item.id !== "hero" && !item.acted && !item.knockedOut)) {
          const start = prepare({ kind: "turn-start", actorId: enemy.id }); if (start.ok) { commit(start); commit(prepare({ kind: "turn-end", actorId: enemy.id })); }
        }
        if (core.roundEndStatus(scene).available) { commit(prepare({ kind: "round-end" })); commit(prepare({ kind: "turn-start" })); }
      } else if (step.type === "action") {
        const actionId = engine.ACTION_IDS[step.action], target = scene.actors[1];
        const request = { kind: "action", actionId, attribute: step.attribute || (step.action === "spell" ? "spirit" : "talent"), targetIds: [target.id] };
        if (step.action === "step") { request.targetIds = []; request.destination = { space: "main", x: 2, y: 1 }; }
        if (step.action === "skirmish" && profile.levels["vagabond.master-at-arms"]) {
          request.armamentMode = armament;
          if (armament === "blade") request.destination = { x: hero().x + 1, y: hero().y };
          if (armament === "polearm") request.targetIds = ["enemy", "enemy2"];
        }
        if (step.action === "skirmish" && profile.levels["powerhouse.gunslinger"] && step.bullets && hero().ruleResources?.bullets?.value > 0) Object.assign(request, { bulletsSpent: 1, bulletTargets: [target.id] });
        if (step.action === "finish") {
          request.focusSpent = step.focus;
          if (request.attribute === "talent" && hero().ruleModes?.["vagabond.master-at-arms.armament"]?.modeId) {
            if (armament !== "blade") { request.targetIds = []; request.areaCenter = { x: hero().x + 1, y: hero().y }; }
          }
        }
        const before = clone(scene), history = (hero().lionwing.history || []).length, discount = Number(hero().lionwing.mundaneDiscount || 0), material = hero().ruleResources?.material?.value;
        const quote = core.actionStatus(scene, hero(), core.actionDef(actionId), request), prepared = prepare(request, step.rollSeed);
        assert.deepEqual(clone(scene), before, "quote and prepare are pure");
        if (!prepared.ok) {
          const reason = prepared.errors?.join(" ") || "unknown";
          assert.doesNotMatch(reason, /is not defined|is not a function|Cannot read|TypeError|ReferenceError/, "refusal cannot hide an internal exception");
          if (step.required) assert.fail(`required Action rejected: ${reason}`);
          refused++; refusals[reason] = (refusals[reason] || 0) + 1; continue;
        }
        assert.equal(quote.available, true, "accepted action has an available quote");
        const beforeBase = core.balance(hero(), quote.resource), beforeFocus = core.balance(hero(), "focus");
        commit(prepared); accepted++;
        assert.equal((hero().lionwing.history || []).length, history + 1, "one authoritative action history row per accepted action");
        const row = hero().lionwing.history.at(-1);
        routes.add(`${row.execution?.route || "native"}:${step.action}:${request.attribute}${request.armamentMode || step.action === "finish" && request.attribute === "talent" && profile.levels["vagabond.master-at-arms"] ? `:${armament}` : ""}`);
        assert.equal(row.actionId, actionId, "history preserves the declared action");
        assert.ok(typeof row.actionInstanceId === "string" && row.actionInstanceId.length, "accepted action has an authoritative instance identity");
        assert.equal(row.attribute, request.attribute, "history preserves the chosen attribute");
        assert.equal(row.ownerTurnInstanceId, scene.lionwing.activeTurnInstanceId, "history preserves the current Turn identity");
        const facts = (scene.lionwing.history || []).filter(fact => fact.type === "apply" && fact.actionId === actionId && fact.actionInstanceId === row.actionInstanceId);
        assert.equal(facts.length, 1, "one authoritative apply fact per accepted action");
        if (scene.pendingAction) {
          assert.equal(scene.pendingAction.actionInstanceId, row.actionInstanceId, "pending attack and action history identify the same action");
          assert.deepEqual(clone(row.targetIds), clone(scene.pendingAction.targetIds), "history retains the attack's actual targets");
        }
        const extraCost = step.action === "finish" && material == null ? Math.max(0, step.focus - Math.max(0, discount - 2)) : 0;
        const sharedLedger = quote.resource === "focus" || quote.resource === "ap" && Boolean(profile.levels["bulwark.mundane"]);
        assert.equal(core.balance(hero(), quote.resource), beforeBase - quote.cost - (sharedLedger ? extraCost : 0), "quoted base price is paid once");
        if (!sharedLedger && step.action === "finish" && material == null) assert.equal(core.balance(hero(), "focus"), beforeFocus - extraCost, "extra Focus is paid once");
        if (material != null && ["spell", "skirmish", "finish"].includes(step.action)) { assert.equal(hero().ruleResources.material.value, 0, "Creator spends all actual Material once"); assert.equal(row.materialSpent, material, "history records consumed Material"); }
        if (step.action === "finish" && profile.levels["bulwark.mundane"]) { assert.equal(hero().lionwing.mundaneDiscount, 0, "first Finisher consumes its discount"); assert.ok(hero().lionwing.mundaneFinisherRound.includes(scene.round), "first-Finisher right is recorded for this Round"); }
      }
    } catch (error) { error.compositionStep = index; throw error; }
  }
  return { accepted, refused, refusals, routes: [...routes], combination: JSON.stringify({levels:profile.levels,armament:testCase.armament||null}) };
}

export function minimize(testCase, signature) {
  let trace = [...testCase.trace], changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < trace.length; index++) {
      const candidate = trace.filter((_, position) => position !== index);
      try { runTrace({ ...testCase, trace: candidate }); } catch (error) {
        if (String(error.message).split("\n")[0] === signature) { trace = candidate; changed = true; break; }
      }
    }
  }
  return { ...testCase, trace };
}
