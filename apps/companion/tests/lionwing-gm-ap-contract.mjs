import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const json = value => JSON.parse(JSON.stringify(value));
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
vm.runInContext(`${coreSource.slice(coreStart, coreEnd)};this.normalizeGmLibrary=normalizeGmLibrary;this.normalizeGmLibraryEnemy=normalizeGmLibraryEnemy;this.sceneCore=sceneCore;`, coreContext, { filename: "app-core.js" });
const persistedCorpseScene = json(coreContext.sceneCore({
  rulesEdition: "lionwing", spaces: [{ id: "main", mode: "standard", width: 7, height: 7 }], activeSpace: "main",
  actors: [{ id: "corpse", kind: "crowd", team: "enemy", space: "main", x: 2, y: 2, crowdSubtype: "corpse", sourceActionId: "lionwing.npc.necromancer.call-the-dead", summonerId: "necro" }],
}));
assert.deepEqual([persistedCorpseScene.actors[0].crowdSubtype, persistedCorpseScene.actors[0].sourceActionId, persistedCorpseScene.actors[0].summonerId], ["corpse", "lionwing.npc.necromancer.call-the-dead", "necro"], "Saved scene normalization preserves Corpse subtype, rule provenance, and summoner ID");
const persistedCorpseMarker = json(coreContext.sceneCore({
  rulesEdition: "lionwing", spaces: [{ id: "main", mode: "standard", width: 7, height: 7 }], activeSpace: "main",
  actors: [{ id: "necro", kind: "enemy", team: "enemy", profileId: "lionwing.npc.necromancer", space: "main", x: 1, y: 1 }],
  markers: [{ id: "corpse-marker", kind: "corpse", space: "main", x: 2, y: 2, sourceActorId: "necro", ownerActorId: "necro", sourceLossPolicy: "detach", ruleId: "lionwing.npc.necromancer.passive", metadata: { victimActorId: "victim" } }],
})).markers[0];
assert.deepEqual([persistedCorpseMarker.kind, persistedCorpseMarker.sourceActorId, persistedCorpseMarker.sourceLossPolicy], ["corpse", "necro", "detach"], "Saved Corpse marker stays revivable and retains source-loss policy");
const persistedAttachedMarker = json(coreContext.sceneCore({
  rulesEdition: "lionwing", spaces: [{ id: "main", mode: "standard", width: 7, height: 7 }], activeSpace: "main",
  actors: [{ id: "host", kind: "enemy", team: "enemy", space: "main", x: 1, y: 1 }],
  markers: [{ id: "attached", kind: "mark", space: "main", x: 2, y: 1, hostActorId: "host", offset: { dx: 1, dy: 0 } }],
})).markers[0];
assert.deepEqual([persistedAttachedMarker.hostActorId, persistedAttachedMarker.offset], ["host", { dx: 1, dy: 0 }], "Saved attached marker retains its host and relative position");

const gmSource = fs.readFileSync(path.join(root, "gm-library.js"), "utf8");
const placementStart = gmSource.indexOf("function availableEncounterCell");
const placementEnd = gmSource.indexOf("function resetGmVariantEditor", placementStart);
assert.ok(placementStart >= 0 && placementEnd > placementStart);
const placementContext = { clamp, gmDeployTerrainCells: new Set(), removedCellKeys: () => new Set(), Scene: null };
vm.createContext(placementContext);
vm.runInContext(`${gmSource.slice(placementStart, placementEnd)};this.availableEncounterCell=availableEncounterCell;`, placementContext, { filename: "gm-library.js" });
const reinforcementScene = { objects: [{ space: "main", type: "terrain", cells: ["1,1"] }], actors: [] };
const reinforcementCell = placementContext.availableEncounterCell({ id: "main", mode: "standard", width: 3, height: 3 }, { kind: "crowd", x: 1, y: 1 }, new Set(), { sceneState: reinforcementScene });
assert.ok(reinforcementCell && `${reinforcementCell.x},${reinforcementCell.y}` !== "1,1", "Fodder reinforcement avoids existing blocking terrain");
const occupiedFodderScene = { objects: [], actors: [{ kind: "crowd", space: "main", x: 1, y: 1, knockedOut: false }] };
const separateFodderCell = placementContext.availableEncounterCell({ id: "main", mode: "standard", width: 3, height: 3 }, { kind: "crowd", x: 1, y: 1 }, new Set(), { sceneState: occupiedFodderScene });
assert.ok(separateFodderCell && `${separateFodderCell.x},${separateFodderCell.y}` !== "1,1", "Fodder reinforcement cannot stack two live Zones");
const relinkStart = gmSource.indexOf("function encounterTemplateActorForReinforcement");
const relinkEnd = gmSource.indexOf("function deployEncounterTemplate", relinkStart);
assert.ok(relinkStart >= 0 && relinkEnd > relinkStart, "Special Fodder reinforcement relinking stays directly testable");
const relinkContext = { clamp };
vm.createContext(relinkContext);
vm.runInContext(`${gmSource.slice(relinkStart, relinkEnd)};this.encounterTemplateActorForReinforcement=encounterTemplateActorForReinforcement;this.linkEncounterSpecialFodder=linkEncounterSpecialFodder;`, relinkContext, { filename: "gm-library.js" });
const owner = { id: "new-houndmaster", profileId: "lionwing.npc.hound-master", team: "enemy", space: "main" };
const liveHero = { id: "live-hero", kind: "hero", team: "hero", space: "main", knockedOut: false };
const linkedSeeker = { kind: "crowd", sourceActionId: "lionwing.npc.hound-master.fire-seeker" };
assert.equal(relinkContext.linkEncounterSpecialFodder(linkedSeeker, { crowdSubtype: "seeker", sourceActionId: "lionwing.npc.hound-master.fire-seeker", seekerOwnerId: "old-houndmaster", seekerTargetId: "live-hero", seekerDamage: 9 }, new Map([["old-houndmaster", owner]]), [liveHero], "main"), true, "Seeker Fodder relinks to a newly reinforced Hound Master and an existing live target");
assert.deepEqual(json(linkedSeeker), { kind: "crowd", sourceActionId: "lionwing.npc.hound-master.fire-seeker", crowdSubtype: "seeker", seekerOwnerId: "new-houndmaster", seekerTargetId: "live-hero", seekerDamage: 9 }, "Seeker provenance and target survive with current IDs");
assert.equal(relinkContext.linkEncounterSpecialFodder({ kind: "crowd" }, { crowdSubtype: "seeker", seekerOwnerId: "old-houndmaster", seekerTargetId: "missing-hero", sourceActionId: "lionwing.npc.hound-master.fire-seeker" }, new Map([["old-houndmaster", owner]]), [], "main"), false, "A Seeker with a target absent from both the preset and current scene is skipped safely");
const necromancer = { id: "new-necromancer", profileId: "lionwing.npc.necromancer", team: "enemy", space: "main", knockedOut: false };
const linkedCorpse = { kind: "crowd" };
assert.equal(relinkContext.linkEncounterSpecialFodder(linkedCorpse, { crowdSubtype: "corpse", sourceActionId: "lionwing.npc.necromancer.call-the-dead", summonerId: "old-necromancer" }, new Map([["old-necromancer", necromancer]]), [], "main"), true, "Corpse Fodder preserves its canonical source and relinks to the reinforced Necromancer");
assert.deepEqual(json(linkedCorpse), { kind: "crowd", crowdSubtype: "corpse", sourceActionId: "lionwing.npc.necromancer.call-the-dead", summonerId: "new-necromancer" }, "Corpse provenance and owner use the replacement IDs");
assert.equal(relinkContext.linkEncounterSpecialFodder({ kind: "crowd", team: "enemy" }, { crowdSubtype: "corpse", sourceActionId: "lionwing.npc.necromancer.call-the-dead", summonerId: "missing-necromancer" }, new Map(), [], "main"), false, "Corpse Fodder is not deployed without its matching live Necromancer");
assert.equal(relinkContext.linkEncounterSpecialFodder({ kind: "crowd", team: "enemy" }, { crowdSubtype: "corpse", sourceActionId: "lionwing.npc.necromancer.call-the-dead", summonerId: "wrong-side-necromancer" }, new Map([["wrong-side-necromancer", { ...necromancer, id: "wrong-side-necromancer", team: "hero" }]]), [], "main"), false, "A Necromancer on the opposite team cannot own this Corpse Fodder");
assert.equal(relinkContext.linkEncounterSpecialFodder({ kind: "crowd" }, { crowdSubtype: "vortex" }, new Map(), [], "main"), false, "Vortex zones are skipped because their modifier state is a separate active rule chain");
assert.equal(relinkContext.encounterTemplateActorForReinforcement({ templateScene: { actors: [{ id: "saved", kind: "crowd", team: "enemy", name: "Corpse", x: 2, y: 3 }] } }, { kind: "crowd", team: "enemy", name: "Corpse", x: 2, y: 3 }, 0)?.id, "saved", "A matching saved scene actor supplies special Fodder provenance");
assert.equal(relinkContext.encounterTemplateActorForReinforcement({ templateScene: { actors: [{ id: "wrong", kind: "crowd", team: "enemy", name: "Different", x: 2, y: 3 }] } }, { kind: "crowd", team: "enemy", name: "Corpse", x: 2, y: 3 }, 0), null, "Mismatched template actor metadata is not attached by array index alone");
const deployStart = gmSource.indexOf("function deployEncounter(encounter,{replace=false}={})");
const deployEnd = gmSource.indexOf("\n}", deployStart) + 2;
assert.ok(deployStart >= 0 && deployEnd > deployStart, "Encounter reinforcement deployment remains directly testable");
const deploymentToasts = [];
Object.assign(relinkContext, {
  Scene: { rulesEdition: "lionwing", activeActorId: null, pendingAction: null, pendingActionPlan: null, activeSpace: "main", spaces: [{ id: "main", mode: "standard", width: 7, height: 7 }], actors: [{ id: "live-hero", kind: "hero", team: "hero", space: "main", x: 1, y: 1, knockedOut: false }], objects: [], markers: [], targetIds: [] },
  activeSceneSpace: () => relinkContext.Scene.spaces[0],
  deployEncounterTemplate: () => false,
  addEnemyDeploymentPassives: () => [],
  commitScene: (_label, change) => { const next = structuredClone(relinkContext.Scene); change(next); relinkContext.Scene = next; },
  toast: message => deploymentToasts.push(message),
  uid: (() => { let serial = 0; return () => `reinforcement-${++serial}`; })(),
  availableEncounterCell: (_space, wanted, occupied) => { const options = [{ x: wanted.x, y: wanted.y }, { x: wanted.x + 1, y: wanted.y }, { x: wanted.x - 1, y: wanted.y }, { x: wanted.x, y: wanted.y + 1 }, { x: wanted.x, y: wanted.y - 1 }]; const cell = options.find(point => point.x >= 0 && point.y >= 0 && point.x < 7 && point.y < 7 && !occupied.has(`${point.x},${point.y}`)); if (cell) occupied.add(`${cell.x},${cell.y}`); return cell || null; },
  enemyProfile: id => ({ id, name: id }),
  enemyActorFromProfile: (profile, tier, { blueprint, spaceId, position }) => ({ id: `spawn-${profile.id}`, kind: "enemy", team: "enemy", profileId: profile.id, name: blueprint.name, tier, space: spaceId, ...position, knockedOut: false }),
});
vm.runInContext(`${gmSource.slice(deployStart, deployEnd)};this.deployEncounter=deployEncounter;`, relinkContext, { filename: "gm-library.js" });
const reinforcementPreset = {
  edition: "lionwing", name: "Hound and Seeker", enemies: [
    { kind: "enemy", team: "enemy", profileId: "lionwing.npc.hound-master", name: "Hound Master", tier: 1, x: 4, y: 2 },
    { kind: "enemy", team: "enemy", profileId: "lionwing.npc.necromancer", name: "Necromancer", tier: 1, x: 3, y: 2 },
    { kind: "crowd", team: "enemy", name: "Seeker", x: 5, y: 2, crowdGroupId: "seekers" },
    { kind: "crowd", team: "enemy", name: "Corpse", x: 3, y: 3, crowdGroupId: "corpses" },
  ],
  templateScene: { activeSpace: "main", spaces: [{ id: "main", width: 7, height: 7 }], actors: [
    { id: "old-houndmaster", kind: "enemy", team: "enemy", profileId: "lionwing.npc.hound-master", name: "Hound Master", space: "main", x: 4, y: 2 },
    { id: "old-necromancer", kind: "enemy", team: "enemy", profileId: "lionwing.npc.necromancer", name: "Necromancer", space: "main", x: 3, y: 2 },
    { id: "old-seeker", kind: "crowd", team: "enemy", name: "Seeker", space: "main", x: 5, y: 2, crowdSubtype: "seeker", sourceActionId: "lionwing.npc.hound-master.fire-seeker", seekerOwnerId: "old-houndmaster", seekerTargetId: "live-hero", seekerDamage: 8 },
    { id: "old-corpse", kind: "crowd", team: "enemy", name: "Corpse", space: "main", x: 3, y: 3, crowdSubtype: "corpse", sourceActionId: "lionwing.npc.necromancer.call-the-dead", summonerId: "old-necromancer" },
  ] },
};
relinkContext.deployEncounter(reinforcementPreset);
const deployedOwner = relinkContext.Scene.actors.find(actor => actor.profileId === "lionwing.npc.hound-master"), deployedNecromancer = relinkContext.Scene.actors.find(actor => actor.profileId === "lionwing.npc.necromancer"), deployedSeeker = relinkContext.Scene.actors.find(actor => actor.crowdSubtype === "seeker"), deployedCorpse = relinkContext.Scene.actors.find(actor => actor.crowdSubtype === "corpse");
assert.ok(deployedOwner && deployedNecromancer && deployedSeeker && deployedCorpse, `Reinforcement deploys linked Hound Master/Seeker and Necromancer/Corpse pairs: ${JSON.stringify({ actors: relinkContext.Scene.actors, deploymentToasts })}`);
assert.deepEqual([deployedSeeker.seekerOwnerId, deployedSeeker.seekerTargetId, deployedSeeker.sourceActionId, Math.abs(deployedSeeker.x - deployedOwner.x) + Math.abs(deployedSeeker.y - deployedOwner.y)], [deployedOwner.id, "live-hero", "lionwing.npc.hound-master.fire-seeker", 1], "Reinforced Seeker points to the new owner and current target and stays adjacent");
assert.deepEqual([deployedCorpse.summonerId, deployedCorpse.sourceActionId], [deployedNecromancer.id, "lionwing.npc.necromancer.call-the-dead"], "Reinforced Corpse retains the canonical source and points to the new Necromancer");
relinkContext.Scene = { rulesEdition: "lionwing", activeActorId: null, pendingAction: null, pendingActionPlan: null, activeSpace: "main", spaces: [{ id: "main", mode: "standard", width: 7, height: 7 }], actors: [], objects: [], markers: [], targetIds: [] };
deploymentToasts.length = 0;
relinkContext.deployEncounter(reinforcementPreset);
assert.equal(relinkContext.Scene.actors.some(actor => actor.crowdSubtype === "seeker"), false, "A saved Seeker whose target is absent is not deployed with a stale or guessed target");
assert.match(deploymentToasts.at(-1), /особых зон пропущено/u, "Unsafe special Fodder is reported to the Narrator");
relinkContext.Scene = { rulesEdition: "lionwing", activeActorId: null, pendingAction: null, pendingActionPlan: null, activeSpace: "main", spaces: [{ id: "main", mode: "standard", width: 7, height: 7 }], actors: [{ id: "live-hero", kind: "hero", team: "hero", space: "main", x: 1, y: 1, knockedOut: false }], objects: [], markers: [], targetIds: [] };
deploymentToasts.length = 0;
const disconnectedPreset = structuredClone(reinforcementPreset);
disconnectedPreset.enemies[2].x = 0; disconnectedPreset.enemies[2].y = 0;
disconnectedPreset.enemies[3].x = 0; disconnectedPreset.enemies[3].y = 0;
disconnectedPreset.templateScene.actors[2].x = 0; disconnectedPreset.templateScene.actors[2].y = 0;
disconnectedPreset.templateScene.actors[3].x = 0; disconnectedPreset.templateScene.actors[3].y = 0;
relinkContext.deployEncounter(disconnectedPreset);
const survivingCorpse = relinkContext.Scene.actors.find(actor => actor.crowdSubtype === "corpse");
assert.ok(survivingCorpse, "The reinforcement after a rejected non-adjacent Seeker still deploys");
assert.deepEqual([survivingCorpse.x, survivingCorpse.y], [0, 0], "Rejecting a Seeker releases the fallback cell for the next valid reinforcement");
assert.match(deploymentToasts.at(-1), /особых зон пропущено/u, "The Narrator receives the skipped-Seeker notice while later entries still deploy");
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

const builtin = gmContext.BUILTIN_ENCOUNTERS.find(item => item.id === "builtin.lionwing-dune-runners-audit");
assert.ok(builtin, "The canonical LionWing builtin remains available");
assert.equal(builtin.edition, "lionwing", "The canonical LionWing builtin declares its edition");
assert.ok(builtin.enemies.every(enemy => enemy.ap == null && enemy.baseAp == null), "Builtin source stays sparse and lets the canonical profile choose AP");
const builtinCopy = json(gmContext.materializeBuiltinEncounter(builtin));
assert.equal(builtinCopy.edition, "lionwing", "A copied LionWing builtin retains its edition");
assert.ok(builtinCopy.enemies.every(enemy => enemy.kind === "crowd" ? enemy.ap === 0 && enemy.baseAp === 0 : enemy.ap === 3 && enemy.baseAp === 3), "A copied LionWing builtin materializes ordinary NPCs at 3 AP and Fodder at 0");
assert.equal(builtinCopy.builtin, undefined, "A copied builtin becomes a user encounter");

assert.equal(gmContext.BUILTIN_ENCOUNTERS.some(item => item.id === "builtin.raasha-castle-companions"), false, "Removed author preset must not return");
assert.doesNotMatch(gmSource, /Светозар|Svetozar|svetozar/u, "Removed character and compound id must not remain in the encounter catalogue");
assert.match(gmSource,/deploymentByTeam=\{enemy:[\s\S]+hero:/,"Preset deployment selects cells separately for allies and hostiles");
assert.match(gmSource,/availableEncounterCell\(space,blueprint,occupied,\{allowedCells,compoundCell,sceneState:scene\}\)/,"Preset placement validates against the scene being rebuilt, not stale table state");
assert.doesNotMatch(gmSource,/wanted\?\.team==="hero"\)allowedCells=null/,"Allied profiles remain inside their authored deployment zone");

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
