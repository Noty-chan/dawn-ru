import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const companion = path.resolve(here, "..");
const repo = path.resolve(companion, "..", "..");
const inventoryPath = path.join(repo, "docs", "tasks", "enemies", "S00-INVENTORY.json");
const canonicalPath = "source/editions/dawn-en-lionwing-cb2f8e67/canonical/core-rules.json";
const pdfPath = "source/original/DAWN_ The RPG (LionWing Edition) w Bookmarks.pdf";
const context = { window: {}, console, structuredClone, crypto: { randomUUID: () => "inventory-event" } };
vm.createContext(context);
for (const file of ["edition-lionwing.js", "lionwing-table-data.js"])
  vm.runInContext(fs.readFileSync(path.join(companion, file), "utf8"), context, { filename: file });
const Engine = loadSceneEngine(context);
const core = context.window.DAWN_LIONWING_DATA.coreRules;
const canonical = JSON.parse(fs.readFileSync(path.join(repo, canonicalPath), "utf8"));
const profiles = context.window.DAWN_LIONWING_TABLE_DATA.profiles(core);

const sha = text => `sha256:${crypto.createHash("sha256").update(String(text)).digest("hex")}`;
const kebab = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const profileSlug = id => id.split(".").at(-1);
const engineId = rule => `enemy.common.${profileSlug(rule.profileId)}.${rule.kind === "trump" ? "trump" : rule.kind}.${kebab(rule.name)}`;

const waveByProfile = new Map(Object.entries({
  ranger: 2, executioner: 2, paladin: 2, berserker: 2, spright: 2, ronin: 2,
  javelin: 3, broodmother: 3, glutton: 3, swarm: 3, bodyguards: 3, "hound-master": 3,
  captor: 4, witch: 4, bruiser: 4, behemoth: 4, cannoneer: 4, assassin: 4,
  pugilist: 5, viper: 5, rifter: 5, cocoon: 5, revenant: 5, privateer: 5, daredevil: 5,
  guardian: 6, builder: 6, healer: 6, illusionist: 6, martyr: 6, oni: 6, duelist: 6,
  coordinator: 7, bannerman: 7, mount: 7, doppelganger: 7, matriarch: 7, baron: 7,
  cultist: 7, enchanter: 7, necromancer: 7,
}));

function dependencies(text) {
  const checks = [
    [/Attack|Attacked|Hit|Crit|damage/i, "attack/hit/damage facts and reaction ordering"],
    [/move|space|adjacent|range|Line|Zone|board|Terrain|Teleport|push|pull|Launch/i, "authoritative geometry, occupancy, and movement facts"],
    [/Effect|Mark|Slow|Shred|Fear|Taunt|Snare|Daze|Blight|Reinforce|Strengthen|Steady|Hasten|Charged|Regenerat/i, "typed effects with source and lifetime"],
    [/Turn|Round|Scene|Deployment|Deployed/i, "turn/round/scene/deployment lifecycle"],
    [/next Turn|next Round|rest of the Scene|until/i, "persisted boundary intent and reload"],
    [/Fodder|Seeker|Corpse|create .*NPC|Deploy .*NPC/i, "source-owned entity creation and removal"],
    [/ally|allies|opponent|enemy|player|character|target/i, "relationship-based targeting including hero-side NPCs"],
    [/Clock|Segment|Growth|Aim|Preparation|Doom|counter/i, "persisted counters/clocks"],
    [/Wound|Health|restore|Armor|Evasion/i, "health/defense/wound authoritative calculation"],
    [/another Turn|use .* against|each time|times|every character|all targets/i, "serial resolution with separate triggers and interruption"],
    [/Disappear|reappear|Hidden|private|indicate/i, "hidden/indicated state and projection"],
    [/Compound|Part|Host|Modifier/i, "compound/modifier ownership and shared body"],
  ];
  return [...new Set(checks.filter(([re]) => re.test(text)).map(([, label]) => label))];
}

function ambiguities(text) {
  const out = [];
  if (/next Turn/i.test(text)) out.push("Do not rewrite ‘next Turn’ as the source NPC's next Turn; persist the global boundary literally.");
  if (/Attack.*times|damage.*times|every .*Attack/i.test(text)) out.push("Repeated attacks/damage instances remain ordered instances; a multiplier is not equivalent.");
  if (/allies|opponents|enemies|player/i.test(text)) out.push("Audience is relative to actor/target; actor.kind or a hard-coded hero team is insufficient.");
  if (/empty|unoccupied|Fodder/i.test(text)) out.push("Occupancy exceptions are rule-specific; Fodder is not forced through the ordinary empty-cell rule.");
  if (/at the start|at the end|after|before|when/i.test(text)) out.push("Trigger timing must use the named fact even when damage is zero or the source acts outside its own Turn.");
  if (/more Evasion than Armor|more Armor than Evasion/i.test(text)) out.push("Positive equal Armor/Evasion has no stated branch; zero/zero satisfies ‘neither’. Do not invent an equality effect.");
  return out;
}

const testFiles = fs.readdirSync(here).filter(name => name.endsWith(".mjs") && name !== path.basename(import.meta.url));
const testSources = new Map(testFiles.map(name => [name, fs.readFileSync(path.join(here, name), "utf8")]));
function evidenceTests(profile, rule) {
  const needles = [profile.id, profileSlug(profile.id), rule?.id, rule?.name].filter(Boolean).map(x => String(x).toLowerCase());
  return [...testSources].filter(([, source]) => needles.some(needle => source.toLowerCase().includes(needle))).map(([name]) => `apps/companion/tests/${name}`);
}

function sourceFor(profile) {
  return {
    canonicalPath,
    editionId: profile.source?.editionId || core.editionId,
    locale: "en",
    pdfPath,
    pdfPage: profile.source?.pdfPage ?? null,
    printedPage: null,
    pdfVerification: "not-run:S00-inventory-only",
  };
}

function ruleEntry(profile, rule) {
  const actual = Engine.enemyRuleAutomation(rule.id);
  return {
    auditKey: rule.id,
    stableId: rule.id,
    engineAlias: engineId({ ...rule, profileId: profile.id }),
    kind: rule.kind,
    name: rule.name,
    englishText: rule.text,
    digest: sha(rule.text),
    digestBasis: "UTF-8 bytes of exact edition-lionwing.js English text",
    source: sourceFor(profile),
    declaredStatus: rule.automation,
    actualHandler: {
      entry: "DAWN_SCENE_ENGINE.prepareEnemyRule",
      implementation: actual === "assisted" ? null : `scene-actions.js prepareEnemyRule (${actual} route)`,
      automation: actual,
      note: actual === "assisted" ? "The common entry exists, but no automatic rule handler is selected." : "Presence is recorded without promoting readiness or verifying completeness.",
    },
    uiEntryPoint: "scene-actions-ui.js useEnemyRule → DAWN_SCENE_ENGINE.prepareEnemyRule → commitSceneEvents",
    tests: evidenceTests(profile, rule),
    notRun: ["real browser click path", "two-client network/reconnect", "visual PDF comparison (outside S00 inventory)"],
    dependencies: dependencies(rule.text),
    ambiguities: ambiguities(rule.text),
    remainder: actual === "assisted" ? "No selected production automation handler; full mechanics, payment, cancellation, persistence, and UI acceptance remain." : "Audit implementation against every clause; handler presence does not prove payment, lifecycle, persistence, browser, or network acceptance.",
    wave: waveByProfile.get(profileSlug(profile.id)) ?? 7,
  };
}

function passiveEntry(profile) {
  const text = profile.passive || "";
  return {
    auditKey: `${profile.id}#passive`,
    stableId: null,
    canonicalIdClaim: false,
    kind: "passive",
    name: "Passive",
    applicability: text ? "applicable" : "not-applicable",
    englishText: text,
    digest: text ? sha(text) : null,
    digestBasis: text ? "UTF-8 bytes of exact edition-lionwing.js English text" : null,
    source: sourceFor(profile),
    declaredStatus: "untracked-by-table-adapter",
    actualHandler: { entry: null, implementation: null, automation: "unknown", note: "Passive coverage cannot be inferred from action automation; production triggers require clause-by-clause audit." },
    uiEntryPoint: text ? "unknown (passives are trigger/lifecycle driven; no generic action button)" : null,
    tests: evidenceTests(profile, null),
    notRun: text ? ["complete trigger-to-writer trace", "real browser lifecycle", "reload/export/import", "two-client network/reconnect", "visual PDF comparison (outside S00 inventory)"] : [],
    dependencies: dependencies(text),
    ambiguities: ambiguities(text),
    remainder: text ? "Find and prove exact trigger, choices, writer, persistence, allied-NPC behavior, and clause coverage; do not infer from an action handler." : "None: canonical profile has no passive text.",
    wave: waveByProfile.get(profileSlug(profile.id)) ?? 7,
  };
}

function externalEntry(rule) {
  return { stableId: rule.id, name: rule.name, kind: rule.kind, englishText: rule.text, digest: sha(rule.text), source: { canonicalPath, ...rule.source, printedPage: null, pdfPath }, excludedFromActionDenominator: true };
}

function buildInventory() {
  const entries = profiles.map(profile => ({
    profileId: profile.id,
    name: profile.name,
    kind: profile.kind,
    source: sourceFor(profile),
    wave: waveByProfile.get(profileSlug(profile.id)) ?? 7,
    passive: passiveEntry(profile),
    rules: profile.rules.map(rule => ruleEntry(profile, rule)),
    profileDependencies: [...new Set([profile.passive, ...profile.rules.map(rule => rule.text)].flatMap(dependencies))],
    profileAmbiguities: [...new Set([profile.passive, ...profile.rules.map(rule => rule.text)].flatMap(ambiguities))],
    oldAccountingErrors: ["Passive was outside the 122-rule denominator.", "Declared assisted status neither proves absence nor presence of implementation.", "Handler presence was sometimes treated as complete automation without clause/browser/network evidence."],
  }));
  const modifiers = (core.rules || []).filter(rule => ["npc-modifier", "scene-modifier"].includes(rule.kind)).map(externalEntry);
  const antagonists = (core.rules || []).filter(rule => ["antagonist-edge", "antagonist-action", "antagonistic-bond-action"].includes(rule.kind)).map(externalEntry);
  const rules = entries.flatMap(profile => profile.rules);
  const passives = entries.map(profile => profile.passive);
  return {
    schemaVersion: 1,
    generatedFrom: ["apps/companion/edition-lionwing.js", "apps/companion/lionwing-table-data.js", "apps/companion/tests/load-scene-engine.mjs", "apps/companion production engine files"],
    editionId: core.editionId,
    digestAlgorithm: "sha256 over exact UTF-8 English rule text",
    denominators: { profiles: entries.length, actionAttackAce: rules.length, passives: passives.length, nonEmptyPassives: passives.filter(item => item.applicability === "applicable").length, notApplicablePassives: passives.filter(item => item.applicability === "not-applicable").length, combinedAuditRecords: rules.length + passives.length },
    actualAutomationCounts: Object.fromEntries([...new Set(rules.map(rule => rule.actualHandler.automation))].sort().map(status => [status, rules.filter(rule => rule.actualHandler.automation === status).length])),
    profiles: entries,
    excludedContours: { modifiers, antagonists, note: "Listed for boundary control only; excluded from the 122 ordinary-NPC Action/Attack/Ace denominator." },
  };
}

// Normalize cross-realm arrays and objects created by the VM before strict comparison.
const built = JSON.parse(JSON.stringify(buildInventory()));
if (process.argv.includes("--write")) {
  fs.mkdirSync(path.dirname(inventoryPath), { recursive: true });
  fs.writeFileSync(inventoryPath, `${JSON.stringify(built, null, 2)}\n`);
}
assert.ok(fs.existsSync(inventoryPath), "Run this test once with --write to create S00-INVENTORY.json");
const saved = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
assert.deepEqual(saved, built, "S00 inventory is stale; regenerate with --write and inspect the diff");
assert.deepEqual(JSON.parse(JSON.stringify(core.npcs.list)), canonical.npcs.list, "Browser LionWing NPC data must match canonical EN exactly");
assert.deepEqual(JSON.parse(JSON.stringify(core.rules)), canonical.rules, "Browser modifier/antagonist data must match canonical EN exactly");
assert.equal(built.denominators.profiles, 41);
assert.equal(built.denominators.actionAttackAce, 122);
assert.equal(built.denominators.passives, 41);
assert.equal(built.denominators.combinedAuditRecords, 163);
assert.equal(new Set(built.profiles.map(profile => profile.profileId)).size, 41, "No duplicate profile IDs");
assert.equal(new Set(built.profiles.flatMap(profile => profile.rules.map(rule => rule.stableId))).size, 122, "No duplicate Action/Attack/Ace IDs");
assert.equal(new Set(built.profiles.map(profile => profile.passive.auditKey)).size, 41, "No duplicate passive audit keys");
assert.ok(built.profiles.every(profile => profile.rules.length >= 2 && profile.rules.every(rule => rule.englishText && rule.digest && rule.source.canonicalPath)), "Every canonical rule keeps text/digest/source");
assert.ok(built.profiles.every(profile => profile.passive.applicability === (profile.passive.englishText ? "applicable" : "not-applicable")), "Empty passives are explicit N/A records");
assert.ok(built.excludedContours.modifiers.length && built.excludedContours.antagonists.length, "Modifiers and antagonist contours are listed separately");
console.log(`LionWing enemy inventory OK: ${built.denominators.profiles} profiles, ${built.denominators.actionAttackAce} actions/attacks/aces, ${built.denominators.nonEmptyPassives} non-empty passives + ${built.denominators.notApplicablePassives} N/A passives; ${built.excludedContours.modifiers.length} modifiers and ${built.excludedContours.antagonists.length} antagonist records excluded`);
