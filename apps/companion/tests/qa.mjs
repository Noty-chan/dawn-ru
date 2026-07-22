import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "logic.js"), "utf8"), context);
vm.runInNewContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), context);
const data = context.window.DAWN_DATA;
const logic = context.window.DAWN_LOGIC;
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const cockpitSource = fs.readFileSync(path.join(root, "vtt-concepts.js"), "utf8");
assert.match(appSource, /counter\("focus","Фокус",rt\.focus\)/, "Focus counter must remain unbounded");
assert.doesNotMatch(cockpitSource, /maxFocus|Фокус\s*\$\{[^}]+\}\s*\//, "Cockpit must not display or store a Focus ceiling");
const syncStorage = new Map();
const syncContext = { window: {}, URL, console, setTimeout, clearTimeout, localStorage: { getItem: key => syncStorage.get(key) || null, setItem: (key, value) => syncStorage.set(key, value) } };
vm.runInNewContext(fs.readFileSync(path.join(root, "sync.js"), "utf8"), syncContext);
const syncApi = syncContext.window.DAWN_SYNC;
assert.ok(syncApi);
assert.equal(syncApi.hasConfig(), false);
syncApi.configure({ url: "https://dawn-test.supabase.co/path", publishableKey: "sb_publishable_test", displayName: "Нарратор" });
assert.equal(syncApi.state().url, "https://dawn-test.supabase.co");
assert.equal(syncApi.state().displayName, "Нарратор");
assert.equal(syncApi.hasConfig(), true);
const configuredContext = { window: {}, URL, console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem: () => {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, "config.js"), "utf8"), configuredContext);
vm.runInNewContext(fs.readFileSync(path.join(root, "sync.js"), "utf8"), configuredContext);
assert.equal(configuredContext.window.DAWN_SYNC.hasConfig(), true, "Published companion must use the DAWN Supabase project by default");
const fakeScene = { id: "00000000-0000-0000-0000-000000000002", campaign_id: "00000000-0000-0000-0000-000000000001", name: "Структурированный бой", state: { round: 1 }, version: 1 };
const fakeQuery = { select(){ return this; }, eq(){ return this; }, order(){ return this; }, limit: async () => ({ data: [], error: null }), single: async () => ({ data: fakeScene, error: null }), maybeSingle: async () => ({ data: null, error: null }) };
const fakeChannel = { on(){ return this; }, subscribe(callback){ callback("SUBSCRIBED"); return this; } };
const fakeClient = {
  auth: { getSession: async () => ({ data: { session: null }, error: null }), signInAnonymously: async () => ({ data: { session: { user: { id: "00000000-0000-0000-0000-000000000003" } } }, error: null }) },
  from: () => fakeQuery,
  rpc: name => ({ single: async () => name === "create_campaign" ? ({ data: { campaign_id: fakeScene.campaign_id, scene_id: fakeScene.id, role: "owner" }, error: null }) : ({ data: null, error: new Error("unexpected rpc") }) }),
  channel: () => fakeChannel,
  removeChannel: async () => {},
};
syncContext.window.supabase = { createClient: () => fakeClient };
await syncApi.connect();
await syncApi.createCampaign("Тестовая Серия", { round: 1 });
assert.equal(syncApi.state().role, "owner");
assert.equal(syncApi.state().sceneId, fakeScene.id);
assert.equal(syncApi.state().status, "online");
assert.equal(data.schemaVersion, 2);
assert.equal(data.archetypes.length, 6);
assert.equal(data.archetypes.flatMap(a => a.techniques).length, 107);
assert.equal(data.archetypes.flatMap(a => a.techniques.flatMap(technique => technique.levels)).filter(level => level.mechanics).length, 321);
assert.equal(data.outlooks.length, 10);
assert.equal(data.outlooks.flatMap(o => (o.builtin ? [o.builtin] : []).concat(o.gifts)).length, 52);
const loyal = data.outlooks.find(outlook => outlook.name === "Верный");
const wolf = data.outlooks.find(outlook => outlook.name === "Волк");
const loyalGifts = logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [loyal.id], primaryOutlookId: loyal.id, selectedGiftIds: [] });
const wolfGifts = logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [wolf.id], primaryOutlookId: wolf.id, selectedGiftIds: [] });
assert.deepEqual(JSON.parse(JSON.stringify(loyalGifts.map(gift => gift.en))), ["The Oath"], "The Loyal must automatically receive The Oath");
assert.deepEqual(JSON.parse(JSON.stringify(wolfGifts.map(gift => gift.en))), ["Lone Wolf"], "The Wolf must automatically receive Lone Wolf");
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [loyal.id, wolf.id], primaryOutlookId: loyal.id, selectedGiftIds: [] }).map(gift => gift.en))),
  ["The Oath"],
  "An inherent Gift belongs only to the Primary Outlook",
);
const loyalChoice = loyal.gifts[0];
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [loyal.id], primaryOutlookId: loyal.id, selectedGiftIds: [loyalChoice.id] }).map(gift => gift.id))),
  [loyal.builtin.id, loyalChoice.id],
  "An inherent Gift must be added on top of selectable Gifts without occupying their slots",
);
assert.equal(data.bonds.actions.length, 12);
assert.equal(data.bonds.actions.filter(action => !action.antagonistic).length, 10);
assert.match(data.bonds.rankUp, /Есть 10/);
assert.equal(data.bonds.actions.find(action => action.name === "Защита")?.tag, "Подопечный");
assert.match(data.bonds.quick, /Ранг\*\* 1|Ранг 1/);
assert.match(data.bonds.favoredActions, /Стресс/);
assert.equal(data.bonds.relatedRules.length, 6);
assert.match(data.bonds.relatedRules.find(rule => rule.id === "bond.context.duel")?.text || "", /встречный бросок/);
assert.equal(data.effects.positive.length, 8);
assert.equal(data.effects.negative.length, 11);
assert.ok(data.effects.positive.find(effect => effect.name === "Исчез")?.aliases.includes("Исчезнуть"));
assert.equal(data.actions.list.length, 15);
assert.equal(data.enemies.common.length, 41);
assert.equal(data.enemies.modifiers.length, 11);
assert.equal(data.enemies.common.find(enemy => enemy.en === "Bruiser")?.stats.armor, "1(+1/2)");
const assassin = data.enemies.common.find(enemy => enemy.en === "Assassin");
assert.match(assassin?.text || "", /Исчезнуть/);
assert.ok(data.enemies.common.reduce((total, enemy) => total + enemy.rules.length, 0) >= 120);
assert.deepEqual(Array.from(assassin.deployEffects), ["Исчез"]);
assert.equal(assassin.rules.find(rule => rule.en === "Slice")?.dice, "5(+1)");
assert.equal(assassin.rules.find(rule => rule.en === "Slice")?.tensionMultiplier, 2);
assert.deepEqual(Array.from(assassin.rules.find(rule => rule.en === "Neutralize Target")?.targetEffects || []), ["Помечен"]);
assert.deepEqual(Array.from(assassin.rules.find(rule => rule.en === "Disappear")?.selfEffects || []), ["Исчез"]);
assert.ok(data.abilityWords.verbs.length > 20);
assert.ok(data.abilityWords.nouns.length > 20);
assert.ok(data.abilityWords.conditions.length > 20);

const ids = [
  ...data.archetypes.flatMap(a => a.techniques.map(t => t.id)),
  ...data.outlooks.map(o => o.id),
  ...data.outlooks.flatMap(o => (o.builtin ? [o.builtin] : []).concat(o.gifts).map(g => g.id)),
  ...data.bonds.actions.map(action => action.id),
  ...data.bonds.relatedRules.map(rule => rule.id),
  ...Object.values(data.effects).flat().map(e => e.id),
  ...data.actions.list.map(a => a.id),
  ...Object.values(data.enemies).flat().map(enemy => enemy.id),
  ...Object.values(data.abilityWords).flat().map(w => w.id),
];
assert.equal(new Set(ids).size, ids.length, "stable ids must be unique");
for (const archetype of data.archetypes) for (const technique of archetype.techniques) assert.equal(technique.levels.length, 3, technique.name);

assert.deepEqual(
  JSON.parse(JSON.stringify(logic.calculateRankSpend({ skillSpent: 4, abilityCost: 5, abilityExtra: 2, gadgetSpent: 5, gadgetPool: 3 }))),
  { paidAbility: 3, paidGadgets: 2, rankSpent: 14, coreRankSpent: 9 },
  "Gearhead's first three gadget ranks must not spend the main rank budget",
);
const cursedBudget = JSON.parse(JSON.stringify(logic.calculateCreationBudgets({
  tier: 1,
  gifts: ["Uncontrollable Power"],
  skillRanks: [2, 2],
  abilityCost: 6,
})));
assert.equal(cursedBudget.rankPool, 12);
assert.equal(cursedBudget.coreRankPool, 8);
assert.equal(cursedBudget.uncontrollableRanks, 4);
assert.equal(cursedBudget.abilityExtra, 4);
assert.equal(cursedBudget.paidAbility, 2);
assert.equal(cursedBudget.rankSpent, 10, "Selecting an Ability-only gift must not reduce the visible ranks already spent");
assert.equal(cursedBudget.coreRankSpent, 6, "Uncontrollable Power still restricts its four bonus ranks to the Ability");
const darkUrgeRegression = logic.calculateCreationBudgets({ gifts: ["Dark Urge"], skillRanks: [2, 2], abilityCost: 4 });
assert.equal(darkUrgeRegression.rankSpent, 8, "Dark Urge must not change 8 spent ranks into 4");
assert.equal(darkUrgeRegression.rankPool, 12, "Dark Urge adds four restricted ranks to the visible total pool");
assert.equal(darkUrgeRegression.rankOver, 0);
assert.equal(logic.calculateCreationBudgets({ gifts: ["Dark Urge"], skillRanks: [3, 3, 3, 3] }).rankOver, 4, "Dark Urge ranks cannot be diverted into Skills");
const taintedBudget = JSON.parse(JSON.stringify(logic.calculateCreationBudgets({
  tier: 3,
  gifts: ["Dark Urge", "Uncontrollable Power", "Tainted Body"],
  skillRanks: [2, 2],
  abilityCost: 10,
  taintedBodyUsed: true,
  taintedAbilityCost: 5,
})));
assert.equal(taintedBudget.abilityExtra, 8);
assert.equal(taintedBudget.taintedAbilityPool, 6);
assert.equal(taintedBudget.taintedAbilitySpent, 5);
assert.equal(taintedBudget.taintedAbilityRemaining, 1);
assert.equal(taintedBudget.taintedAbilityOver, 0);
assert.equal(taintedBudget.rankPool, 26, "Tainted Body reserve must be present in the visible total pool");
assert.equal(taintedBudget.rankSpent, 19, "Tainted Body Ability cost must be present in visible spent ranks");
assert.equal(taintedBudget.paidAbility, 2, "Tainted Body is reserved for a new Ability, not the existing one");
assert.equal(logic.calculateCreationBudgets({ tier: 1, gifts: ["Tainted Body"], taintedBodyUsed: true, taintedAbilityCost: 6 }).taintedAbilityOver, 2, "Tainted Body cannot silently overpay its new Ability");
const artistBudget = JSON.parse(JSON.stringify(logic.calculateCreationBudgets({
  gifts: ["Performance Artist"],
  skillRanks: [2, 2],
  performanceTargetRank: 2,
})));
assert.equal(artistBudget.skillSpent, 4);
assert.equal(artistBudget.performanceBonus, 1, "Performance Artist grants a free rank to the selected Skill");
assert.equal(logic.calculateCreationBudgets({ gifts: ["Performance Artist"], skillRanks: [3, 1], performanceTargetRank: 3 }).performanceBonus, 0, "Skill rank cannot exceed 3");
const deafnessBudget = logic.calculateCreationBudgets({ gifts: ["Supernatural Deafness"], skillRanks: [2, 2], abilityCost: 4 });
assert.equal(deafnessBudget.rankPool, 11, "Supernatural Deafness adds three unrestricted ranks");
assert.equal(deafnessBudget.rankSpent, 8, "Selecting Supernatural Deafness must not rewrite already spent ranks");
const gearheadBudget = logic.calculateCreationBudgets({ gifts: ["Gearhead"], skillRanks: [2, 2], abilityCost: 4, gadgetSpent: 3 });
assert.equal(gearheadBudget.rankPool, 11, "Gearhead adds its three gadget-only ranks to the visible pool");
assert.equal(gearheadBudget.rankSpent, 11, "Configured gadget ranks must be visible in total spending");
assert.equal(gearheadBudget.coreRankSpent, 8, "Gift-paid gadget ranks must not consume the core pool");
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.calculateCreationBudgets({ tier: 3, gifts: ["Past Your Prime"], skillRanks: [] }))).rankPool,
  14,
);
assert.equal(logic.calculateCreationBudgets({ tier: 3, gifts: ["Past Your Prime"], skillRanks: [] }).skillMin, 8);
assert.equal(logic.calculateCreationBudgets({ tier: 3, gifts: ["Amazing Potential"], skillRanks: [] }).rankPool, 12);
assert.equal(logic.calculateCreationBudgets({ tier: 3, gifts: ["Amazing Potential"], skillRanks: [] }).skillMin, 2);
const conflictingRankGifts = logic.calculateCreationBudgets({ tier: 1, gifts: ["Past Your Prime", "Amazing Potential"], skillRanks: [2, 2] });
assert.equal(conflictingRankGifts.rankBudgetConflict, true);
assert.equal(conflictingRankGifts.rankPool, 8, "An invalid pair must not arbitrarily let one starting budget overwrite the other");
assert.equal(conflictingRankGifts.skillMin, 4);
assert.equal(logic.calculateCreationBudgets({ gifts: [], skillRanks: [], gadgetSpent: 9 }).rankSpent, 0, "Gadget spend is ignored without Gearhead");
const forcedConditionWords = [{ id: "verb", group: "verbs", cost: 1, marks: "✢" }, { id: "noun", group: "nouns", cost: 1, marks: "" }, { id: "condition", group: "conditions", cost: 2, marks: "" }];
assert.equal(logic.calculateAbilityCost({ enabled: true, words: forcedConditionWords }), 2, "A terminating word normally omits the Condition cost");
assert.equal(logic.calculateAbilityCost({ enabled: true, words: forcedConditionWords, forceCondition: true }), 4, "Uncontrollable Power must retain and pay for its required Condition");
assert.equal(logic.scaleTierFormula("15(+5)", 1), 15);
assert.equal(logic.scaleTierFormula("15(+5)", 3), 25);
assert.equal(logic.scaleTierFormula("1(+1/2)", 1), 1);
assert.equal(logic.scaleTierFormula("1(+1/2)", 2), 2);
assert.equal(logic.scaleTierFormula("1(+1/2)", 3), 2);
assert.equal(logic.scaleTierFormula("X", 3), null);
assert.equal(logic.areaCells({ shape: "radius2", x: 3, y: 3, width: 7, height: 7 }).length, 13);
assert.equal(logic.areaCells({ shape: "square5", x: 3, y: 3, width: 7, height: 7 }).length, 25);
assert.equal(logic.areaCells({ shape: "square5", x: 0, y: 0, width: 7, height: 7 }).length, 9);
assert.equal(logic.areaCells({ shape: "lineDiagDown", x: 3, y: 3, width: 7, height: 7 }).length, 7);
assert.deepEqual(Array.from(logic.areaCells({ shape: "square2", x: 6, y: 6, width: 7, height: 7 })), ["6,6"]);
assert.equal(logic.calculateAbilityCost({
  enabled: true,
  words: [
    { id: "verb.create", group: "verbs", cost: 4, marks: "✢" },
    { id: "noun.gravity", group: "nouns", cost: 3, marks: "" },
    { id: "condition.memory", group: "conditions", cost: 3, marks: "" },
  ],
}), 7, "✢ omits the Condition and its cost");
assert.equal(logic.calculateAbilityCost({
  enabled: true,
  words: [{ id: "noun.people", group: "nouns", cost: 2, marks: "✝" }],
  specializations: { "noun.people": "только врачи" },
}), 1, "✝ narrows a category and reduces its cost by one");
assert.equal(logic.calculateAbilityCost({
  enabled: true,
  words: [
    { id: "verb.merge", group: "verbs", cost: null, marks: "☾" },
    { id: "noun.gravity", group: "nouns", cost: 3, marks: "" },
  ],
  xWord: { id: "noun.plants", group: "nouns", cost: 1, marks: "✝" },
  specializations: { "noun.plants": "только розы" },
}), 3, "☾ derives X from the selected Noun cost, including category narrowing");
const sequence = [5 / 6, 0, 2 / 6];
const rolled = logic.rollXd6({ count: 2, threshold: 3, random: () => sequence.shift() });
assert.deepEqual(Array.from(rolled.rolls), [6, 1, 3]);
assert.equal(rolled.successes, 2, "All Out succeeds on 3+");
assert.equal(rolled.crits, 1, "exploding six is still a critical success");
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.swapAttributeBase({ body: 4, talent: 3, spirit: 2, mind: 2 }, "spirit", 4, ["body", "talent", "spirit", "mind"]))),
  { body: 2, talent: 3, spirit: 4, mind: 2 },
  "choosing a base attribute must swap values and preserve the 4/3/2/2 array",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.normalizeAttributeBases({ body: 3, talent: 4, spirit: 4, mind: 2 }, ["body", "talent", "spirit", "mind"]))),
  { body: 3, talent: 4, mind: 2, spirit: 2 },
  "invalid persisted base Attributes must be repaired to the 4/3/2/2 array",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.normalizeAttributeGrowth({ body: 2, talent: 2, spirit: 1, mind: 1 }, 2, ["body", "talent", "spirit", "mind"]))),
  { body: 1, talent: 1, spirit: 0, mind: 0 },
  "each gained tier grants two different ordinary Attribute increases",
);

for (const file of ["index.html", "app.css", "app.js", "logic.js", "config.js", "sync.js", "data.js", "manifest.webmanifest", "sw.js", "icon.svg"]) assert.ok(fs.existsSync(path.join(root, file)), file);
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const sync = fs.readFileSync(path.join(root, "sync.js"), "utf8");
const sql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607130001_dawn_multiplayer.sql"), "utf8");
const eventSql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607210001_dawn_event_stream.sql"), "utf8");
const liveCharacterSql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607230001_dawn_live_characters.sql"), "utf8");
const eventRepairSql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607230002_fix_append_scene_events.sql"), "utf8");
assert.match(app, /Math\.ceil\(attrValueFor\(hero,"talent"\)\/2\)/);
assert.match(app, /takeWound\(external\)/);
assert.match(app, /setPlayCounter\("influence"/);
assert.match(app, /Logic\.calculateCreationBudgets/);
assert.match(app, /builtinGifts\.hidden=!builtin/);
assert.match(app, /Получен автоматически и не занимает слот/);
assert.match(app, /performanceSkill/);
assert.match(app, /taintedAbilityPool/);
assert.match(app, /taintedAbility/);
assert.match(app, /function commitScene/);
assert.match(app, /Logic\.areaCells/);
assert.match(app, /scaledEnemyStats/);
assert.match(app, /TECH_SCENE_TEMPLATES/);
assert.match(app, /disruptor\.chemist/);
assert.match(app, /disruptor\.inner-world/);
assert.match(app, /bulwark\.giant-frame/);
assert.match(app, /powerhouse\.warring-ascendant/);
assert.match(app, /ruiner\.bombardier/);
assert.match(app, /shape:"square5"/);
assert.match(app, /ruiner\.rapid-fire-sorcery/);
assert.match(app, /ruiner\.ritualist/);
assert.match(app, /ruiner\.ego-arm/);
assert.match(app, /ruiner\.sellsword-s-call/);
assert.match(app, /disruptor\.wave-rider/);
assert.match(app, /disruptor\.hunter/);
assert.match(app, /disruptor\.gale-strider/);
assert.match(app, /GIFT_SCENE_TEMPLATES/);
assert.match(app, /Trust Fund/);
assert.match(app, /data-sacrifice/);
assert.match(app, /tokenImageFromFile/);
assert.match(app, /scene\.markers/);
assert.match(app, /hero\.media\.token/);
assert.match(app, /hero\.media\.portrait/);
assert.match(app, /function renderSceneMedia/);
assert.match(app, /initCollapsibleBuildPanels/);
assert.match(app, /builder-mode/);
assert.match(app, /scene-mode/);
assert.match(app, /function renderBondTraining/);
assert.match(app, /function renderBondReference/);
assert.match(app, /const RULE_CHAPTERS/);
assert.match(app, /const GLOSSARY/);
assert.match(app, /Рана, которую герой наносит себе сам, Влияния не даёт/);
assert.match(app, /<article id="\$\{id\}" class="rules-card">/);
assert.doesNotMatch(app, /<details id="\$\{id\}" class="rules-card">/);
assert.match(css, /rules-index::\-webkit-scrollbar-thumb/);
assert.match(css, /\.rules-card>header/);
const glossaryIds = [...app.matchAll(/glossaryTerm\("([^"]+)"/g)].map(match => match[1]);
assert.ok(glossaryIds.length >= 80, `expected a broad glossary, got ${glossaryIds.length} terms`);
assert.equal(new Set(glossaryIds).size, glossaryIds.length, "glossary term ids must be unique");
for (const requiredTerm of ["stress","scene","threat","risk","reward","intermission","knocked-out","on-the-line","character-rank","technique-level","motivation","history","impact","access","health","guts","ap","turn","action","basic-action","attack","damage","reaction","defensive-reaction","fast","line","zone","terrain","ally","antagonist","trump"]) assert.ok(glossaryIds.includes(requiredTerm), `missing required glossary term: ${requiredTerm}`);
assert.match(app, /function renderRules/);
assert.match(app, /function actionRulesHtml/);
assert.match(app, /function rulesChapterText/);
assert.match(app, /function fieldRulesVisual/);
assert.match(app, /function ruleKey/);
assert.match(app, /rule-permalink/);
assert.match(app, /target\?\.matches\?\./);
assert.match(app, /Преимущество от Рангов/);
assert.match(app, /Поставить на кон/);
assert.match(app, /Альтернативные Фокусы/);
assert.match(app, /Жизненный цикл Эффектов/);
assert.match(app, /id:"abilities"/);
assert.match(app, /id:"narrator"/);
assert.match(app, /id:"enemies"/);
assert.match(app, /requestedMode/);
assert.match(app, /bondRelatedItems/);
assert.match(html, /id="bond-training"/);
assert.match(html, /data-mode="rules"/);
assert.match(html, /data-page="rules"/);
assert.match(html, /id="rules-index"/);
assert.match(html, /id="rules-chapters"/);
assert.match(html, /id="rules-search"/);
assert.match(html, /id="rules-filters"/);
assert.match(html, /id="rules-expand"/);
assert.match(html, /id="rules-collapse"/);
assert.match(html, /reference-rules-link/);
assert.doesNotMatch(html, /id="bond-reference"/);
assert.match(html, /scene-sync-body/);
assert.match(html, /scene-inspector-panel/);
assert.match(app, /scene\.artworks/);
assert.match(app, /data-scene-portrait-actor/);
assert.match(app, /duration:"nextTurn"/);
assert.match(app, /data-scene-turn/);
assert.match(app, /data-ability-field="xNoun"/);
assert.match(app, /wordSpecialization/);
assert.match(app, /customWordCosts/);
assert.match(app, /data-custom-word-cost/);
assert.match(app, /customWordCostOptions/);
assert.match(app, /value==="X"/);
assert.doesNotMatch(app, /id="ability-variable"/);
assert.match(app, /\(item\.aliases\|\|\[\]\)\.join/);
assert.match(app, /name:"Эффекты"/);
assert.doesNotMatch(app, /Math\.floor\(attrValue/);
assert.match(html, /Метки слов:/);
assert.match(html, /id="builtin-gifts"/);
assert.match(html, /Новая Способность «Порченого тела»/);
assert.match(html, /supabase-js@2\.110\.3/);
assert.match(html, /data-scene-tool="marker"/);
assert.match(html, /scene-add-free-token/);
assert.match(html, /scene-marker-kind/);
assert.match(html, /square5/);
assert.match(html, /hero-portrait-upload/);
assert.match(html, /hero-token-upload/);
assert.match(html, /scene-hero-select/);
assert.match(html, /scene-media-menu/);
assert.match(html, /scene-art-upload/);
assert.match(html, /scene-dock/);
assert.match(html, /scene-enemy-roster/);
assert.match(html, /scene-zoom-fit/);
assert.match(html, /data-scene-tool="measure"/);
assert.match(html, /scene-roll-feed/);
assert.match(html, /scene-action-tray/);
assert.match(html, /scene-turn-strip/);
assert.match(html, /data-scene-panel="utility"/);
assert.match(html, /data-scene-panel="reference"/);
assert.match(html, /scene-ref-search/);
assert.match(html, /dice-attr/);
assert.match(html, /dice-skill/);
assert.match(html, /dice-ability/);
assert.match(sync, /signInAnonymously/);
assert.match(sync, /save_scene_snapshot/);
assert.match(sync, /postgres_changes/);
assert.match(sync, /decideCommand/);
assert.match(sync, /scene_public_snapshots/);
assert.match(sync, /append_scene_events/);
assert.match(sync, /presenceState/);
assert.match(sync, /listCharacters/);
assert.match(html, /config\.js\?v=__BUILD_VERSION__/);
assert.match(html, /sync-publish-hero/);
assert.match(app, /Нарратор принял цели игрока/);
assert.match(app, /canonicalPlayerEvents/);
assert.match(app, /TechniqueEngine\.toEvents/);
assert.match(app, /data-core-technique/);
assert.match(app, /SceneEngine\.prepareEnemyRule/);
assert.match(app, /data-enemy-rule/);
assert.match(app, /profile\.deployEffects/);
assert.match(app, /activeActorId/);
assert.match(app, /public-actor-card/);
assert.match(app, /data-core-assist-technique/);
assert.match(app, /TechniqueEngine\.assistedPreview/);
assert.match(app, /pendingEnemyRule/);
assert.match(app, /enemyAreaCells/);
assert.match(app, /renderSceneReference/);
assert.match(app, /function sceneSheetPanel/);
assert.match(app, /function rollSceneDice/);
assert.match(app, /function measurementPath/);
assert.match(app, /taintedAbility:hero\.mods\.taintedBody/);
assert.match(sql, /enable row level security/);
assert.match(sql, /redeem_campaign_invite/);
assert.match(sql, /scene version conflict/);
assert.doesNotMatch(sql, /service_role/i);
assert.match(eventSql, /public_scene_projection/);
assert.match(eventSql, /append_scene_events/);
assert.match(eventSql, /characters_private_select/);
assert.match(eventSql, /commands_private_select/);
assert.match(eventSql, /event_log_narrator_select/);
assert.match(eventSql, /state version does not match event batch/);
assert.match(eventSql, /join_hero/);
assert.doesNotMatch(eventSql, /create policy scenes_member_select/);
assert.match(liveCharacterSql, /bump_character_version/);
assert.match(liveCharacterSql, /supabase_realtime add table public\.characters/);
assert.match(eventRepairSql, /batch\(event_item\)/);
assert.doesNotMatch(eventRepairSql, /batch\(item\)/);
console.log(`OK: ${ids.length} unique rule ids; companion data and invariants validated.`);
