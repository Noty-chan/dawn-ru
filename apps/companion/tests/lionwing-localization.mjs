import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.window = {};
await import("../edition-lionwing.js");
await import("../edition-lionwing-ru.js");
await import("../logic.js");

const english = window.DAWN_LIONWING_DATA;
const russian = window.DAWN_LIONWING_RU;
const appBootstrapSource = fs.readFileSync(new URL("../app-bootstrap.js", import.meta.url), "utf8");
const worklist = JSON.parse(fs.readFileSync(new URL("../../../source/editions/dawn-en-lionwing-cb2f8e67/translation-worklist.json", import.meta.url), "utf8"));
assert.equal(russian.editionId, english.editionId);
assert.equal(Object.keys(russian.outlooks).length, english.outlooks.length);

assert.equal(Object.keys(russian.reference).length, english.reference.length, "every LionWing builder reference card needs a Russian overlay");
const localizedReference = english.reference.map(item => ({ ...item, ...(russian.reference[item.id] || {}) }));
for (const item of english.reference) {
  const overlay = russian.reference[item.id];
  assert.ok(overlay, `missing Russian reference card: ${item.id}`);
  for (const field of ["name", "kind", "tags", "text"]) assert.ok(overlay[field]?.trim(), `missing ${field} in Russian reference card: ${item.id}`);
}
assert.deepEqual(localizedReference.map(item => item.id), english.reference.map(item => item.id), "switching LionWing reference to RU must preserve ids");
assert.deepEqual(localizedReference.map(item => item.source), english.reference.map(item => item.source), "switching LionWing reference to RU must preserve canonical sources");
assert.match(localizedReference.find(item => item.id === "lionwing.reference.story-change").text, /хотя бы с Нарратором/, "Change must retain required Narrator discussion");
assert.match(localizedReference.find(item => item.id === "lionwing.reference.example-qayid").text, /Тело 4.+Талант 3.+Дух 2.+Разум 2/, "Qayid example must retain its Attributes");
assert.match(localizedReference.find(item => item.id === "lionwing.reference.example-yvon").text, /Крадущийся зверь/, "Yvon example must preserve the source-only Stalking Beast name for review");
const localizedRecipes = localizedReference.filter(item => item.id.startsWith("lionwing.reference.recipe-"));
assert.equal(localizedRecipes.length, 8, "all eight LionWing combat recipes need bilingual reference cards");
assert.ok(localizedRecipes.every(item => /Атрибуты: Тело [234], Талант [234], Дух [234], Разум [234]/.test(item.text)), "every combat recipe must retain recommended Attributes");
assert.match(localizedReference.find(item => item.id === "lionwing.reference.recipe-death-dealing-assassin").text, /Рейнджер \(в рецепте назван Long Draw\)/, "the outdated Long Draw recipe reference must resolve to Ranger without changing its stable identity");
assert.match(appBootstrapSource, /localizedLionwingReference\(\)/, "the companion must project LionWing reference cards through the locale overlay");

const englishEffects = [...english.coreRules.effects.positive, ...english.coreRules.effects.negative];
const russianEffects = russian.coreRules.effects.entries;
assert.equal(englishEffects.length, 19);
assert.equal(Object.keys(russianEffects).length, englishEffects.length, "every LionWing core Effect needs a Russian overlay");
const localizedEffects = englishEffects.map(item => ({ ...item, ...(russianEffects[item.id] || {}) }));
for (const item of englishEffects) assert.ok(russianEffects[item.id]?.text, `missing Russian core Effect: ${item.id}`);
assert.deepEqual(localizedEffects.map(item => item.id), englishEffects.map(item => item.id), "switching LionWing Effects to RU must preserve ids");
assert.deepEqual(localizedEffects.map(item => item.source), englishEffects.map(item => item.source), "switching LionWing Effects to RU must preserve sources");
assert.match(russianEffects["positive.регенерирует"].text, /4 \+ \[Ступень\]/, "LionWing Regenerating must not reuse the 0.9 formula");
assert.match(russianEffects["positive.усилен"].text, /Ступень \/ 2/, "LionWing Strengthened must use half Tier");
assert.match(russianEffects["negative.помечен"].text, /Первая Атака/, "LionWing Marked must describe its one-Attack consumption");

const englishActions = english.coreRules.actions.list;
const russianActions = russian.coreRules.actions.entries;
assert.equal(englishActions.length, 17);
assert.equal(Object.keys(russianActions).length, englishActions.length, "every LionWing Basic Action needs a Russian overlay");
const localizedActions = englishActions.map(item => ({ ...item, ...(russianActions[item.id] || {}) }));
for (const item of englishActions) assert.ok(russianActions[item.id]?.text, `missing Russian core Action: ${item.id}`);
assert.deepEqual(localizedActions.map(item => item.id), englishActions.map(item => item.id), "switching LionWing Actions to RU must preserve ids");
assert.deepEqual(localizedActions.map(item => item.cost), englishActions.map(item => item.cost), "switching LionWing Actions to RU must preserve costs");
assert.deepEqual(localizedActions.map(item => item.source), englishActions.map(item => item.source), "switching LionWing Actions to RU must preserve sources");
assert.match(russianActions["action.защита.столкновение"].text, /5 урона/, "LionWing Clash must not reuse the 0.9 reaction");
assert.match(russianActions["action.утилитарные-действия.изучение"].text, /одного из следующих/, "LionWing Investigate must reveal one category");

const englishCoreRules = english.coreRules.rules;
const russianCoreRules = russian.coreRules.rules.entries;
assert.equal(englishCoreRules.length, 165);
assert.equal(Object.keys(russianCoreRules).length, englishCoreRules.length, "every LionWing core rule card needs a Russian overlay");
const localizedCoreRules = englishCoreRules.map(item => ({ ...item, ...(russianCoreRules[item.id] || {}) }));
for (const item of englishCoreRules) assert.ok(russianCoreRules[item.id]?.text, `missing Russian core rule: ${item.id}`);
assert.deepEqual(localizedCoreRules.map(item => item.id), englishCoreRules.map(item => item.id), "switching LionWing core rules to RU must preserve ids");
assert.deepEqual(localizedCoreRules.map(item => item.kind), englishCoreRules.map(item => item.kind), "switching LionWing core rules to RU must preserve rule kinds");
assert.deepEqual(localizedCoreRules.map(item => item.source), englishCoreRules.map(item => item.source), "switching LionWing core rules to RU must preserve sources");
assert.match(russianCoreRules["lionwing.core.combat.assisting"].text, /самым высоким Атрибутом/, "LionWing Assisting must not reuse the 0.9 secondary-Attribute rule");
assert.match(russianCoreRules["lionwing.core.statistics.health"].text, /10 \+ \[Тело\] \+ \[Ступень × 2\]/, "LionWing maximum Health formula must be preserved");
assert.match(russianCoreRules["lionwing.core.spatial.special-targeting"].text, /сначала бросьте наименьшее число костей/, "LionWing multi-target rolls must preserve their staged dice rule");
assert.match(russianCoreRules["lionwing.core.combat.cinematic"].text, /Линии из 7 клеток/, "LionWing Cinematic Combat must preserve its board size");
assert.match(russianCoreRules["lionwing.core.rolls.quick"].text, /3 или больше костей/, "LionWing Quick Rolls must use the new three-die compression threshold");
assert.match(russianCoreRules["lionwing.core.duels.roll"].text, /\[Напряжение \+ Ступень\]/, "LionWing Duels must use the new NPC dice pool");
assert.match(russianCoreRules["lionwing.core.knockouts.consequences"].text, /Каждое последствие.+только один раз/, "irreversible Knockout consequences must retain their one-time restriction");
assert.match(russianCoreRules["lionwing.core.progression.experience"].text, /15 Опыта/, "LionWing Tier progression must retain its Experience threshold");
assert.match(russianCoreRules["lionwing.core.progression.awakening"].text, /сохранить/, "LionWing Awakening must retain deferred rewards");
assert.match(russianCoreRules["lionwing.core.abilities.expansion"].text, /хотя бы одно слово из исходной формы/, "expanded Abilities must retain an original word");
assert.match(russianCoreRules["lionwing.core.bonds.quick"].text, /Один раз за Главу/, "LionWing must limit Quick Bonds per Chapter");
assert.match(russianCoreRules["lionwing.core.bond-actions.study"].text, /нельзя оплатить Стрессом/, "Study must keep its Stress payment exception");
assert.match(russianCoreRules["lionwing.core.bond-actions.abandon"].text, /только один раз/, "Abandon Influence must remain once per target character");
assert.match(russianCoreRules["lionwing.narrator.antagonism.pool"].text, /числа игроков/, "Antagonism must start from the player count");
assert.match(russianCoreRules["lionwing.narrator.antagonism.all-out"].text, /3 или выше/, "Narrator All Out must preserve its changed Hit threshold");
assert.match(russianCoreRules["lionwing.narrator.npcs.wounds"].text, /10 урона, который нельзя уменьшить/, "NPC Wounds must convert to irreducible damage");
assert.match(russianCoreRules["lionwing.narrator.compound.gates"].text, /избыток становится равен 0/, "Compound Health Gates must stop excess damage");
assert.match(russianCoreRules["lionwing.narrator.edges.overview"].text, /3 бесплатных применения за Сцену/, "Antagonist Edges must share their free-use pool");
assert.match(russianCoreRules["lionwing.narrator.edges.wild-eyed"].text, /Столкновение/, "Wild-Eyed interception must use LionWing Clash");
assert.match(russianCoreRules["lionwing.narrator.deployments.overview"].text, /Трудный бой для 4 игроков/, "Deployment Recipes must retain their target difficulty and party size");
assert.match(russianCoreRules["lionwing.narrator.deployments.taking-on-a-god"].text, /4 Частей/, "Taking On A God must retain the Compound part count");
assert.match(russianCoreRules["lionwing.narrator.modifiers.npc-deployment"].text, /лишь большее значение/, "NPC Modifier statistics must not stack twice");
assert.match(russianCoreRules["lionwing.narrator.modifiers.scene-deployment"].text, /нельзя выбирать целью.+не совершают Ходов/, "Modifiers must not become targetable turn-taking characters");
assert.match(russianCoreRules["lionwing.modifier.blaze"].text, /\[Ступень \/ 2\].+Критов/, "Blaze must retain its critical threshold");
assert.match(russianCoreRules["lionwing.modifier.collateral"].text, /испытанием Духа.+1 \+ \[Ступень\]/, "Collateral rescue must retain its Spirit challenge");
assert.match(russianCoreRules["lionwing.modifier.gargantuan"].text, /4 \+ \[Ступень\]/, "Gargantuan must retain its LionWing Attack roll");
assert.match(russianCoreRules["lionwing.modifier.vortex"].text, /повысит его Броню на 3/, "Vortex must track Armor gained from its own effect");
assert.match(russianCoreRules["lionwing.narrator.custom-npcs.averages"].text, /Танк 18 или 12.+Поддержка 13.+Движок 13/, "custom NPC guidance must retain role Health baselines");
assert.match(russianCoreRules["lionwing.narrator.custom-npcs.limits"].text, /не должен Атаковать чаще одного раза за Ход/, "custom NPC guidance must retain its Attack limit");
assert.match(russianCoreRules["lionwing.narrator.scenarios.defense"].text, /Напряжения 6.+не позволив NPC начать Ход/, "Defense must retain its victory condition");
assert.match(russianCoreRules["lionwing.narrator.scenarios.destroy"].text, /20 \+ \[Ступень × 10\].+больше 5 урона/, "Destroy must retain Terrain Health and damage cap");

const englishNpcs = english.coreRules.npcs.list;
const russianNpcs = russian.coreRules.npcs.entries;
assert.equal(englishNpcs.length, 41);
assert.equal(Object.keys(russianNpcs).length, englishNpcs.length, "every imported LionWing NPC needs a Russian overlay");
const localizedNpcs = englishNpcs.map(item => {
  const overlay = russianNpcs[item.id];
  assert.ok(overlay?.name && overlay?.description, `missing Russian NPC profile: ${item.id}`);
  assert.equal(Object.keys(overlay.actions || {}).length, item.actions.length, `missing Russian NPC action: ${item.id}`);
  return { ...item, ...overlay, actions: item.actions.map(action => ({ ...action, ...(overlay.actions[action.id] || {}) })), ace: { ...item.ace, ...(overlay.ace || {}) } };
});
assert.deepEqual(localizedNpcs.map(item => item.id), englishNpcs.map(item => item.id), "switching NPC profiles to RU must preserve ids");
assert.deepEqual(localizedNpcs.map(item => item.statistics), englishNpcs.map(item => item.statistics), "switching NPC profiles to RU must preserve statistics");
assert.deepEqual(localizedNpcs.map(item => item.source), englishNpcs.map(item => item.source), "switching NPC profiles to RU must preserve sources");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.behemoth").ace.text, /2 Раны/, "Meteor must retain its Wound count");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.captor").actions.find(item => item.id.endsWith("catch-and-release")).text, /не Атаковали/, "Catch And Release must retain its conditional Effects");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.executioner").actions.find(item => item.id.endsWith("cleave")).text, /6 \+ \[Ступень × 2\]/, "Cleave must retain its LionWing dice formula");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.pugilist").ace.text, /дважды/, "Martial Perfection must retain its double Passive trigger");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.ronin").actions.find(item => item.id.endsWith("dissect")).text, /2 Крита/, "Dissect must retain its Crit threshold");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.witch").actions.find(item => item.id.endsWith("drawing-runes")).text, /каждая.+кость.+Успехом/, "Drawing Runes must retain automatic Hits");
assert.equal(englishNpcs.find(item => item.id === "lionwing.npc.bodyguards").statistics.health, "1*", "Bodyguards must retain their special Health");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.cocoon").passive, /3 Ростом/, "Cocoon must retain its Growth threshold");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.duelist").ace.text, /можете немедленно снова/, "Disassemble must retain immediate Ace reuse");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.glutton").ace.text, /сколько NPC уничтожил/, "Regurgitate must retain its tracked Fodder count");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.mount").passive, /одной клетке/, "Mount and rider must retain shared-space movement");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.oni").ace.text, /удвоенную пользу/, "Vibrant Terror must retain doubled positive Effects");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.revenant").actions.find(item => item.id.endsWith("tear-from-the-soul")).text, /1 \+ \[Ступень\].+Фокуса/, "Tear From The Soul must retain Focus drain");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.spright").ace.text, /один раз за Ход/, "Thunderous Ascension must retain its per-Turn limit");
assert.equal(englishNpcs.find(item => item.id === "lionwing.npc.bannerman").statistics.speed, 4, "Bannerman must use its changed LionWing Speed");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.builder").actions.find(item => item.id.endsWith("violent-construction")).text, /2 \+ \[Ступень\]/, "Violent Construction must retain direct damage");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.doppelganger").passive, /Атаковать дважды/, "Doppelganger must retain its double-Attack condition");
assert.equal(englishNpcs.find(item => item.id === "lionwing.npc.healer").statistics.speed, 4, "Healer must use its changed LionWing Speed");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.illusionist").actions.find(item => item.id.endsWith("spatial-rift")).text, /3 Стены/, "Spatial Rift must retain its changed Wall count");
assert.equal(localizedNpcs.find(item => item.id === "lionwing.npc.matriarch").name, "Матриарх", "renamed Matriarch must not reuse the old Shade name");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.martyr").ace.text, /автоматически/, "Sacrifice must retain its automatic trigger");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.baron").actions.find(item => item.id.endsWith("prescript")).text, /получает Рану/, "Prescript must retain its Wound consequence");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.berserker").passive, /хотя бы 4 урона/, "Berserker must retain its single-instance threshold");
assert.equal(englishNpcs.find(item => item.id === "lionwing.npc.cannoneer").ace.tension, 0, "Fire must remain a Tension 0 Ace gated by Preparation");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.cultist").ace.text, /Модификатор Гигант/, "Grand Calling must use the new Giant Modifier model");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.enchanter").ace.text, /1 Рану/, "By My Command must use the changed one-Wound consequence");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.hound-master").passive, /3 клетки вместо 2/, "Hound Master must use the changed Fodder movement");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.necromancer").actions.find(item => item.id.endsWith("call-the-dead")).text, /повторно в том же Раунде/, "Call The Dead must retain its diminishing reuse rule");
assert.match(localizedNpcs.find(item => item.id === "lionwing.npc.rifter").passive, /Один раз за Ход/, "Rifter travel must retain its per-Turn limit");
assert.equal(englishNpcs.find(item => item.id === "lionwing.npc.swarm").statistics.health, "1*", "Swarm must retain its special Health");

const englishSkills = english.builderRules.skills.canonical;
const russianSkillNames = russian.builderRules.skills.entries;
assert.equal(englishSkills.length, 16);
assert.equal(Object.keys(russianSkillNames).length, englishSkills.length, "every canonical LionWing Skill needs a Russian display name");
for (const skill of englishSkills) assert.ok(russianSkillNames[skill.id], `missing Russian Skill: ${skill.id}`);
assert.deepEqual(englishSkills.map(skill => skill.id), englishSkills.map(skill => ({ ...skill, name: russianSkillNames[skill.id] })).map(skill => skill.id), "switching canonical Skills to RU must preserve ids");

const activeAbilityWordIds = Object.values(english.abilityWords).flat().map(item => item.id);
const retiredAbilityWordIds = worklist.units.filter(item => item.domain === "ability-word" && item.action === "retire").map(item => item.stableId);
const newAbilityWordIds = worklist.units.filter(item => item.domain === "ability-word" && item.action === "translate-new").map(item => item.stableId);
assert.equal(activeAbilityWordIds.length, 104);
assert.equal(Object.keys(russian.abilityWords).length, activeAbilityWordIds.length, "every active LionWing Ability word needs a Russian display value");
for (const id of activeAbilityWordIds) assert.ok(russian.abilityWords[id]?.trim(), `missing Russian Ability word: ${id}`);
for (const id of newAbilityWordIds) assert.ok(russian.abilityWords[id]?.trim(), `missing newly introduced Ability word: ${id}`);
for (const id of retiredAbilityWordIds) assert.ok(!(id in russian.abilityWords), `retired Ability word leaked into LionWing Russian overlay: ${id}`);
assert.equal(newAbilityWordIds.length, 35);
assert.equal(retiredAbilityWordIds.length, 14);

let translatedNewBoons = 0;
for (const outlook of english.outlooks) {
  const overlay = russian.outlooks[outlook.id];
  assert.ok(overlay?.name, `missing Russian outlook name: ${outlook.id}`);
  assert.ok(overlay?.description, `missing Russian outlook description: ${outlook.id}`);
  for (const boon of outlook.gifts.filter(item => item.introducedIn)) {
    assert.ok(overlay.gifts?.[boon.id]?.name, `missing new boon name: ${boon.id}`);
    assert.ok(overlay.gifts?.[boon.id]?.text, `missing new boon text: ${boon.id}`);
    translatedNewBoons += 1;
  }
}
assert.equal(translatedNewBoons, 21);

const changedBoonIds = worklist.units.filter(item => item.domain === "boon" && item.action === "retranslate").map(item => item.stableId);
const translatedBoonIds = new Set(Object.values(russian.outlooks).flatMap(outlook => Object.keys(outlook.gifts || {})));
assert.equal(changedBoonIds.length, 33);
for (const id of changedBoonIds) assert.ok(translatedBoonIds.has(id), `missing changed boon translation: ${id}`);

const newTechniqueIds = worklist.units.filter(item => item.domain === "technique" && item.action === "translate-new").map(item => item.stableId);
const translatedTechniqueIds = new Set(Object.values(russian.archetypes).flatMap(archetype => Object.keys(archetype.techniques || {})));
assert.equal(newTechniqueIds.length, 5);
for (const id of newTechniqueIds) assert.ok(translatedTechniqueIds.has(id), `missing new Technique translation: ${id}`);

const changedTechniqueIds = worklist.units.filter(item => item.domain === "technique" && item.action === "retranslate").map(item => item.stableId);
const translatedChangedTechniqueIds = changedTechniqueIds.filter(id => translatedTechniqueIds.has(id));
assert.equal(changedTechniqueIds.length, 106);
assert.equal(translatedChangedTechniqueIds.length, changedTechniqueIds.length, "every changed LionWing Technique must have a reviewed Russian overlay");

const localizedOutlooks = english.outlooks.map(outlook => {
  const overlay = russian.outlooks[outlook.id];
  return { ...outlook, ...overlay, gifts: outlook.gifts.map(gift => ({ ...gift, ...(overlay.gifts?.[gift.id] || {}) })) };
});
const localizedArchetypes = english.archetypes.map(archetype => {
  const overlay = russian.archetypes[archetype.id];
  return { ...archetype, ...overlay, techniques: archetype.techniques.map(technique => {
    const translated = overlay.techniques?.[technique.id];
    return { ...technique, ...translated, levels: technique.levels.map(level => ({ ...level, ...(translated?.levels?.[level.n] || {}) })) };
  }) };
});
const localizedAbilityWords = Object.fromEntries(Object.entries(english.abilityWords).map(([group, words]) => [group, words.map(word => ({ ...word, name: russian.abilityWords[word.id] }))]));
assert.deepEqual(localizedOutlooks.map(item => item.id), english.outlooks.map(item => item.id), "switching LionWing to RU must preserve Outlook ids");
assert.deepEqual(localizedArchetypes.flatMap(item => item.techniques.map(technique => technique.id)), english.archetypes.flatMap(item => item.techniques.map(technique => technique.id)), "switching LionWing to RU must preserve Technique ids");
for (const group of ["verbs", "nouns", "conditions"]) {
  assert.deepEqual(localizedAbilityWords[group].map(item => item.id), english.abilityWords[group].map(item => item.id), `switching LionWing to RU must preserve ${group} ids`);
  assert.deepEqual(localizedAbilityWords[group].map(({ cost, costLabel, marks }) => ({ cost, costLabel, marks })), english.abilityWords[group].map(({ cost, costLabel, marks }) => ({ cost, costLabel, marks })), `switching LionWing to RU must preserve ${group} mechanics`);
}

const word = id => Object.values(english.abilityWords).flat().find(item => item.id === id);
const withGroup = (id, group) => ({ ...word(id), group });
const variableAbility = [withGroup("ability.en.verbs.store-x-in", "verbs"), withGroup("ability.en.nouns.plants", "nouns"), withGroup("ability.en.conditions.you-ve-built-the-target", "conditions")];
assert.equal(window.DAWN_LOGIC.calculateAbilityCost({ enabled: true, rank: 2, words: variableAbility, xWord: word("ability.en.nouns.machines") }), 4, "X must use the selected Noun cost and include the Rank increase");
assert.equal(window.DAWN_LOGIC.calculateAbilityCost({ enabled: true, rank: 2, words: variableAbility, xWord: word("ability.en.nouns.machines"), specializations: { "ability.en.nouns.plants": "roses", "ability.en.nouns.machines": "trains" } }), 2, "✝ specializations must reduce both direct and X Noun costs");
const stoppingAbility = [withGroup("ability.en.verbs.breathe", "verbs"), withGroup("ability.en.nouns.machines", "nouns"), withGroup("ability.en.conditions.you-are-sweating", "conditions")];
assert.equal(window.DAWN_LOGIC.calculateAbilityCost({ enabled: true, rank: 1, words: stoppingAbility }), 2, "✢ must omit the Condition from an ordinary Ability");
assert.equal(window.DAWN_LOGIC.calculateAbilityCost({ enabled: true, rank: 1, words: stoppingAbility, forceCondition: true }), 1, "a mandatory Condition must override ✢ and remain in the cost");

const selectedOutlookIds = english.outlooks.slice(0, 2).map(item => item.id), primaryOutlookId = selectedOutlookIds[0];
const selectedGiftIds = english.outlooks.filter(item => selectedOutlookIds.includes(item.id)).flatMap(item => item.gifts.slice(0, 1).map(gift => gift.id));
const budgetFor = outlooks => {
  const gifts = window.DAWN_LOGIC.resolveSelectedGifts({ outlooks, selectedOutlookIds, primaryOutlookId, selectedGiftIds });
  return window.DAWN_LOGIC.calculateCreationBudgets({ tier: 2, builderRules: english.builderRules, gifts: gifts.map(gift => gift.en || gift.name), skillRanks: [2, 2], abilityCost: 3 });
};
assert.deepEqual(budgetFor(localizedOutlooks), budgetFor(english.outlooks), "switching LionWing RU/EN must not change character budgets");

console.log(`LionWing RU/EN QA passed: stable ids and budgets; ${activeAbilityWordIds.length} Ability words (${newAbilityWordIds.length} new); ✢/✝/☾ and X cost verified; 10 Outlooks, ${translatedNewBoons} new and ${changedBoonIds.length} changed Boons, ${newTechniqueIds.length} new and ${translatedChangedTechniqueIds.length}/${changedTechniqueIds.length} changed Techniques`);
