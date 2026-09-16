import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const coreSource = fs.readFileSync(path.join(root, "app-core.js"), "utf8");
const coreStart = coreSource.indexOf("function safeImage");
const coreEnd = coreSource.indexOf("function normalizedSceneObjectType", coreStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart, "Encounter normalization helpers must stay extractable");
const coreContext = {
  console,
  clamp,
  uid: (() => {
    let serial = 0;
    return () => `gm-ap-${++serial}`;
  })(),
  cleanArray: value => Array.isArray(value) ? value.filter(Boolean) : [],
  sceneCore: value => value,
};
vm.createContext(coreContext);
vm.runInContext(`${coreSource.slice(coreStart, coreEnd)};this.normalizeGmLibrary=normalizeGmLibrary;this.normalizeGmLibraryEnemy=normalizeGmLibraryEnemy;`, coreContext, { filename: "app-core.js" });

const gmSource = fs.readFileSync(path.join(root, "gm-library.js"), "utf8");
assert.match(gmSource, /edition=\["ru-v0\.9","lionwing"\]\.includes\(Scene\.rulesEdition\)\?Scene\.rulesEdition:contentPreferences\.edition/, "Newly saved encounters record their active edition");
const builtinStart = gmSource.indexOf("const BUILTIN_ENCOUNTERS=Object.freeze([");
const builtinEnd = gmSource.indexOf("\n]);", builtinStart) + 3;
const materializeStart = gmSource.indexOf("function materializeBuiltinEncounter");
const materializeEnd = gmSource.indexOf("function encounterCard", materializeStart);
assert.ok(builtinStart >= 0 && builtinEnd > builtinStart && materializeStart >= 0 && materializeEnd > materializeStart, "Builtin materialization must stay available to the regression");
const profiles = new Map();
const enemyProfile = id => {
  if (!profiles.has(id)) profiles.set(id, { id, editionId: String(id).startsWith("lionwing.") ? "lionwing" : "ru-v0.9", name: id });
  return profiles.get(id);
};
const gmContext = {
  console,
  clamp,
  normalizedEncounterApContract: coreContext.normalizedEncounterApContract,
  structuredClone,
  uid: (() => {
    let serial = 0;
    return () => `materialized-${++serial}`;
  })(),
  enemyProfile,
  scaledEnemyStats: (_profile, tier) => ({ health: 10 + Number(tier || 1), speed: 4, armor: 1, evasion: 1 }),
};
vm.createContext(gmContext);
vm.runInContext(`${gmSource.slice(builtinStart, builtinEnd)};${gmSource.slice(materializeStart, materializeEnd)};this.BUILTIN_ENCOUNTERS=BUILTIN_ENCOUNTERS;this.materializeBuiltinEncounter=materializeBuiltinEncounter;`, gmContext, { filename: "gm-library.js" });

const json = value => JSON.parse(JSON.stringify(value));
const builtin = gmContext.BUILTIN_ENCOUNTERS.find(item => item.id === "builtin.lionwing-dune-runners-audit");
assert.ok(builtin, "The canonical LionWing builtin remains available");
assert.equal(builtin.edition, "lionwing", "The canonical LionWing builtin declares its edition");
assert.ok(builtin.enemies.every(enemy => enemy.ap == null && enemy.baseAp == null), "Builtin source stays sparse and lets the canonical profile choose AP");
const builtinCopy = json(gmContext.materializeBuiltinEncounter(builtin));
assert.equal(builtinCopy.edition, "lionwing", "A copied LionWing builtin retains its edition");
assert.ok(builtinCopy.enemies.every(enemy => enemy.kind === "crowd" ? enemy.ap === 0 && enemy.baseAp === 0 : enemy.ap === 3 && enemy.baseAp === 3), "A copied LionWing builtin materializes ordinary NPCs at 3 AP and Fodder at 0");
assert.equal(builtinCopy.builtin, undefined, "A copied builtin becomes a user encounter");

const raashaCastle = gmContext.BUILTIN_ENCOUNTERS.find(item => item.id === "builtin.raasha-castle-companions");
assert.ok(raashaCastle, "Raasha Melnum Ruins companion preset is available");
assert.equal(raashaCastle.edition, "lionwing", "Raasha Melnum Ruins preset is LionWing-only");
assert.match(gmSource, /kind:actorTeam==="hero"\?"hero":"enemy"/, "Allied profile actors enter the player turn queue");
assert.equal(raashaCastle.enemies.filter(enemy => enemy.team === "hero").length, 4, "Preset deploys Svetozar's two-part profile plus Mira and Tom");
assert.equal(JSON.stringify(raashaCastle.enemies.filter(enemy => enemy.team === "hero").map(enemy => enemy.profileId)), JSON.stringify(["lionwing.npc.ranger", "lionwing.npc.coordinator", "lionwing.npc.duelist", "lionwing.npc.builder"]));
assert.equal(raashaCastle.enemies.filter(enemy => enemy.team !== "hero").length, 5, "Preset has a varied five-profile ruins defense");
assert.equal(JSON.stringify(raashaCastle.enemies.filter(enemy => enemy.team !== "hero").map(enemy => enemy.profileId)), JSON.stringify(["lionwing.npc.javelin", "lionwing.npc.guardian", "lionwing.npc.ranger", "lionwing.npc.captor", "lionwing.npc.berserker"]), "Ruins defense lineup is explicitly selected");
assert.ok(raashaCastle.enemies.some(enemy => enemy.profileId === "lionwing.npc.javelin"), "One defense profile creates Fodder crowd");
assert.equal(raashaCastle.enemies.filter(enemy => enemy.team !== "hero" && enemy.profileId === "lionwing.npc.builder").length, 0, "Tom is the only Builder in the preset");
assert.equal(raashaCastle.enemies.filter(enemy => enemy.compoundId === "svetozar").length, 2, "Svetozar is represented as a two-part allied profile");
assert.ok(raashaCastle.objects.some(object => object.type === "deploy-hero") && raashaCastle.objects.some(object => object.type === "deploy-enemy"), "Preset has both deployment zones");
assert.ok(raashaCastle.markers.some(marker => marker.kind === "objective"), "Preset has a Melnum-core objective");
const normalizedCastle = json(coreContext.normalizeGmLibrary({ encounters: [raashaCastle] })).encounters[0];
assert.equal(normalizedCastle.enemies.filter(enemy => enemy.team === "hero").length, 4, "Saving the preset keeps allied NPC membership");
assert.ok(normalizedCastle.enemies.filter(enemy => enemy.team === "hero").every(enemy => enemy.profileId.startsWith("lionwing.npc.")), "All allies retain canonical LionWing profile IDs after save");

const newLionwingCopy = json(gmContext.materializeBuiltinEncounter({
  edition: "lionwing",
  name: "New LionWing profile preset",
  enemies: [
    { profileId: "lionwing.npc.viper" },
    { kind: "crowd", crowdGroupId: "alpha-crowd" },
    { profileId: "enemy.modifier.giant", ap: 3, baseAp: 3 },
    { profileId: "lionwing.npc.mount", baseAp: 1 },
  ],
}));
assert.deepEqual(newLionwingCopy.enemies.map(enemy => [enemy.ap, enemy.baseAp]), [[3, 3], [0, 0], [0, 0], [1, 1]], "New LionWing presets preserve explicit summon AP while enforcing Fodder and Modifier zero AP");

const oldCopy = json(gmContext.materializeBuiltinEncounter({
  name: "Existing RU encounter",
  enemies: [
    { profileId: "enemy.common.assassin", ap: 2, baseAp: 2 },
    { profileId: "lionwing.npc.viper", ap: 2, baseAp: 2 },
    { kind: "crowd", ap: 2, baseAp: 2 },
    { profileId: "enemy.modifier.giant", ap: 2, baseAp: 2 },
  ],
}));
assert.deepEqual(oldCopy.enemies.map(enemy => [enemy.ap, enemy.baseAp]), [[2, 2], [2, 2], [0, 0], [0, 0]], "An old or unknown edition keeps explicit 2 AP without a migration layer");

const normalized = json(coreContext.normalizeGmLibrary({ encounters: [
  { id: "new-user-lionwing", name: "New user record", edition: "lionwing", enemies: [
    { profileId: "lionwing.npc.viper" },
    { kind: "crowd", crowdGroupId: "alpha-crowd" },
    { profileId: "enemy.modifier.giant", ap: 3, baseAp: 3 },
    { profileId: "lionwing.npc.mount", baseAp: 1 },
  ] },
  { id: "legacy-ru", name: "Old RU record", enemies: [{ profileId: "enemy.common.assassin", ap: 2, baseAp: 2 }] },
  { id: "legacy-lionwing-explicit", name: "Recreated old record", enemies: [{ profileId: "lionwing.npc.viper", ap: 2, baseAp: 2 }] },
] }));
const byId = id => normalized.encounters.find(item => item.id === id);
assert.deepEqual(byId("new-user-lionwing").enemies.map(enemy => [enemy.ap, enemy.baseAp]), [[3, 3], [0, 0], [0, 0], [1, 1]], "A new LionWing user record normalizes canonical NPC, Fodder, Modifier, and summon AP correctly");
assert.equal(byId("new-user-lionwing").edition, "lionwing", "New user records retain the LionWing edition marker");
assert.deepEqual(byId("legacy-ru").enemies[0] && [byId("legacy-ru").enemies[0].ap, byId("legacy-ru").enemies[0].baseAp], [2, 2], "RU-v0.9 keeps its 2 AP contract");
assert.deepEqual(byId("legacy-lionwing-explicit").enemies[0] && [byId("legacy-lionwing-explicit").enemies[0].ap, byId("legacy-lionwing-explicit").enemies[0].baseAp], [2, 2], "Explicit AP in an old record is preserved rather than migrated");

console.log("LionWing GM AP contract: builtin copy, new user record, Fodder, Modifier, summons, and old encounter policy passed");
