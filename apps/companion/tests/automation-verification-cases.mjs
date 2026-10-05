import assert from "node:assert/strict";
import fs from "node:fs";
import { runtime, fixture, actor, clone, exactReplay } from "./helpers/scene-contract-harness.mjs";

// This entry point selects exactly one actual rule scenario. Merely passing a
// larger suite does not produce evidence for rules that were never exercised.
const args = process.argv.slice(2);
assert.equal(args.length, 2, "select exactly one verification scenario");
assert.equal(args[0], "--case");
const scenarioId = args[1];
const canonical = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json", import.meta.url), "utf8"));
const sourceFor = ruleId => canonical.archetypes.flatMap(group => group.techniques.flatMap(technique => technique.levels.map(level => ({ id: `${technique.id}.${level.n}`, text: level.text })))).find(row => row.id === ruleId);
const { core, engine, context, data } = runtime();
const adapters = context.window.DAWN_LIONWING_ADAPTERS;
const enable = (ruleId, talent = 4) => {
  const table = fixture();
  const owner = table.actors[0], techniqueId = ruleId.replace(/\.\d+$/, ""), level = Number(ruleId.split(".").at(-1));
  owner.attrs.talent = talent;
  owner.knownTechniques = { [techniqueId]: level };
  owner.techniques = { [techniqueId]: level };
  owner.lionwing = { automation: { [ruleId]: true } };
  return table;
};
const sniperRule = "vagabond.sniper.1", duckRule = "vagabond.untouchable.1", masterRule = "vagabond.master-at-arms.2";
const sniperQuote = (table, attribute = "talent", baseValue = 1, owner = table.actors[0]) => adapters.rangeQuote(owner, {
  scene: table, kind: "attack", actionId: engine.ACTION_IDS.finish, attribute, baseValue,
}).value;
const duckQuote = (table, owner = table.actors[0]) => adapters.numericQuote(owner, { scene: table, kind: "dodge", key: "dodgeEvasion", baseValue: 2 }).value;
const addDodge = table => table.log.push({ id: "verification-dodge", type: "reaction.respond", actorId: "hero", payload: { choice: "dodge", round: table.round } });

const scoped = new Map();
const register = (id, ruleId, surface, run) => scoped.set(id, { ruleId, surface, environment: surface === "core" ? "node-core" : "json-reload", run });

register(`${sniperRule}.core-range`, sniperRule, "core", () => {
  assert.equal(sourceFor(sniperRule).text, "Your Talent Finisher can target characters within 5 range instead of its normal targeting.");
  const table = enable(sniperRule), before = clone(table);
  assert.equal(sniperQuote(table), 5);
  assert.equal(sniperQuote(table, "talent", 7), 7);
  assert.equal(sniperQuote(table, "body"), 1);
  assert.equal(sniperQuote(table, "talent", 1, { ...table.actors[0], lionwing: { automation: {} } }), 1);
  assert.equal(sniperQuote(table, "talent", 1, { ...table.actors[0], knownTechniques: {}, techniques: {} }), 1);
  assert.equal(sniperQuote(table, "talent", 1, { ...table.actors[0], rulesEdition: "legacy" }), 1);
  assert.deepEqual(clone(table), before, "range quote does not mutate scene or ownership");
});
register(`${sniperRule}.persisted-range`, sniperRule, "persistence", () => {
  let table = core.reload(JSON.stringify(enable(sniperRule)));
  assert.equal(sniperQuote(table), 5);
  const before = clone(table);
  for (let index = 0; index < 3; index++) {
    table = core.reload(JSON.stringify(table));
    assert.equal(table.actors[0].knownTechniques["vagabond.sniper"], 1);
    assert.equal(table.actors[0].lionwing.automation[sniperRule], true);
    assert.equal(sniperQuote(table), 5);
    assert.equal(sniperQuote(table, "body"), 1);
  }
  assert.deepEqual(clone(table), before, "repeated JSON reload and quotes keep the persisted state");
});
register(`${duckRule}.core-round-gate`, duckRule, "core", () => {
  assert.equal(sourceFor(duckRule).text, "The first time you Dodge each Round, gain [Talent] additional Evasion.");
  const table = enable(duckRule), before = clone(table);
  assert.equal(duckQuote(table), 6);
  assert.deepEqual(clone(table), before, "query is read-only");
  addDodge(table);
  assert.equal(duckQuote(table), 2);
  table.round += 1;
  assert.equal(duckQuote(table), 6);
  assert.equal(duckQuote(table, { ...table.actors[0], lionwing: { automation: {} } }), 2);
  assert.equal(duckQuote(table, { ...table.actors[0], knownTechniques: {}, techniques: {} }), 2);
  assert.equal(duckQuote(table, { ...table.actors[0], rulesEdition: "legacy" }), 2);
});
register(`${duckRule}.persisted-round-gate`, duckRule, "persistence", () => {
  let table = enable(duckRule);
  addDodge(table);
  table = core.reload(JSON.stringify(table));
  assert.equal(duckQuote(table), 2, "receipt still closes current Round after native reload");
  const before = clone(table);
  assert.equal(duckQuote(table), 2, "repeated quote cannot grant a duplicate first Dodge");
  assert.deepEqual(clone(table), before);
  table.round += 1;
  table = core.reload(JSON.stringify(table));
  assert.equal(duckQuote(table), 6);
  assert.equal(duckQuote(core.reload(JSON.stringify(table))), 6);
});

const masterTable = () => {
  const table = fixture();
  table.actors[0].knownTechniques = { "vagabond.master-at-arms": 3 };
  table.actors[0].techniques = {};
  table.actors[1].x = 5;
  return table;
};
const equip = (table, mode, id) => {
  const before = clone(table);
  const prepared = core.prepare(table, { kind: "action", actorId: "hero", eventId: id,
    actionId: engine.ACTION_IDS.skirmish, armamentMode: mode, targetIds: mode === "polearm" ? ["enemy", "enemy-two"] : ["enemy"],
    attribute: "talent", ...(mode === "blade" ? { destination: { x: 2, y: 1 } } : {}),
  }, { random: () => .8 });
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  assert.deepEqual(clone(table), before, "preview/cancel before commit costs nothing");
  const result = core.dispatchMany(table, prepared.events, { expectedVersion: table.version });
  exactReplay(core, result.scene, prepared.events);
  return { table: result.scene, events: prepared.events };
};
const resolve = (table, id) => {
  assert.equal(engine.pendingActionStatus(table, data).waitingIds.length, 0, "NPC without a choice skips reactions");
  const prepared = engine.resolvePendingAction(table, data);
  assert.equal(prepared.ok, true, prepared.errors?.join(" "));
  const events = prepared.events.map((event, index) => ({ ...event, id: `${id}:${index}` }));
  const result = engine.dispatchMany(table, events, { expectedVersion: table.version });
  exactReplay(engine, result.scene, events);
  return { table: result.scene, events };
};
const assertReward = (table, ap, count) => {
  assert.equal(table.actors[0].ap, ap);
  assert.equal(table.log.filter(row => row.type === "resource.gain" && row.payload.sourceActionId === masterRule).length, count);
  if (count) assert.ok(table.actors[0].effects.includes("positive.ускорен"));
};
register(`${masterRule}.core-second-equip`, masterRule, "core", () => {
  assert.equal(sourceFor(masterRule).text, "The 2nd time you Equip an Armament each Turn, you gain 1 AP and Hasten yourself.");
  let table = resolve(equip(masterTable(), "chain", "verification-chain").table, "verification-resolve-chain").table;
  assertReward(table, 3, 0);
  const before = clone(table);
  assert.equal(core.prepare(table, { kind: "action", actorId: "hero", actionId: engine.ACTION_IDS.skirmish, armamentMode: "chain", targetIds: ["enemy"] }).ok, false);
  assert.deepEqual(clone(table), before, "same-mode refusal does not advance Equip count or charge AP");
  table.actors[1].x = 3;
  table = resolve(equip(table, "blade", "verification-blade").table, "verification-resolve-blade").table;
  assertReward(table, 4, 1);
  table.actors.push(actor("enemy-two", "enemy", 2, 2));
  table = resolve(equip(table, "polearm", "verification-polearm").table, "verification-resolve-polearm").table;
  assertReward(table, 4, 1);
});
register(`${masterRule}.persisted-second-equip`, masterRule, "persistence", () => {
  let table = resolve(equip(masterTable(), "chain", "verification-persist-chain").table, "verification-persist-resolve-chain").table;
  table.actors[1].x = 3;
  const blade = equip(table, "blade", "verification-persist-blade");
  const pendingId = blade.table.pendingAction.actionInstanceId;
  table = core.reload(JSON.stringify(blade.table));
  assert.equal(table.pendingAction.actionInstanceId, pendingId);
  exactReplay(core, table, blade.events);
  const resolved = resolve(table, "verification-persist-resolve-blade");
  table = core.reload(JSON.stringify(resolved.table));
  assertReward(table, 4, 1);
  exactReplay(core, table, blade.events);
  exactReplay(core, table, resolved.events);
  assertReward(core.reload(JSON.stringify(table)), 4, 1);
});

const selected = scoped.get(scenarioId);
assert.ok(selected, `unknown verification scenario ${scenarioId}`);
if (process.env.DAWN_VERIFICATION_RULE_ID) assert.equal(process.env.DAWN_VERIFICATION_RULE_ID, selected.ruleId);
if (process.env.DAWN_VERIFICATION_SCENARIO) assert.equal(process.env.DAWN_VERIFICATION_SCENARIO, scenarioId);
selected.run();
console.log(`DAWN_VERIFICATION_CASE ${JSON.stringify({ schemaVersion: 1, ruleId: selected.ruleId,
  scenarioId, surface: selected.surface, environment: selected.environment, completed: true })}`);
