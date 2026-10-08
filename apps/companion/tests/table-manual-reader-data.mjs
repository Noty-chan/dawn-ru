import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
const context = vm.createContext({window});
Object.defineProperty(context, 'S', {get() {throw new Error('Reader must not consult the current hero');}});
for (const file of ['edition-lionwing.js', 'lionwing-table-data.js', 'scene-manual-reader-data.js']) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
}
const reader = window.DAWN_MANUAL_READER_DATA;
const data = window.DAWN_LIONWING_DATA;
const profiles = window.DAWN_LIONWING_TABLE_DATA.profiles(data.coreRules);
assert.ok(profiles.length, 'Use actual LionWing NPC profiles, not only invented fixtures');
const words = Object.values(data.abilityWords).flat();
const plainVerb = data.abilityWords.verbs.find(word => !word.marks.includes('✢'));
const markedVerb = data.abilityWords.verbs.find(word => word.marks.includes('✢'));
const noun = data.abilityWords.nouns[0], condition = data.abilityWords.conditions[0];
const options = {english: true, wordById: id => words.find(word => word.id === id), enemyProfile: id => profiles.find(profile => profile.id === id)};
const actor = {id: 'hero-b', gifts: [], ability: {enabled: true, name: 'Own ability', rank: 2, words: {verbs: [plainVerb.id], nouns: [noun.id], conditions: [condition.id]}, desc: ''}};
const before = JSON.stringify(actor);
let rows = reader.entries(actor, options);
assert.match(rows[0].text, /^You can /);
assert.ok(rows[0].text.includes(plainVerb.name.toLowerCase()), 'Formula belongs to the actor being read');
assert.ok(rows[0].text.includes(condition.name.toLowerCase()));
assert.equal(rows[0].meta, 'Rank 2');
assert.equal(JSON.stringify(actor), before, 'Reading does not normalize or mutate the participant');
const cursed = structuredClone(actor);
cursed.gifts.push('cursed.uncontrollable-power');
cursed.taintedAbility = structuredClone(cursed.ability);
rows = reader.entries(cursed, options);
assert.ok(!rows[0].text.startsWith('You can '), 'Actor gift changes their own main formula');
assert.ok(rows[1].text.startsWith('You can '), 'The main ability gift does not change Tainted Body');
cursed.ability.words.conditions = [];
assert.ok(reader.entries(cursed, options)[0].text.endsWith('constantly.'), 'Uncontrollable power without a condition is constant, not an invented placeholder');
actor.ability.words.verbs = [markedVerb.id];
assert.ok(!reader.entries(actor, options)[0].text.includes(' while '), 'Canonical unconditional word suppresses the condition');

for (const profile of profiles) {
  const npc = {id: 'npc', profileId: profile.id};
  const snapshot = JSON.stringify(profile);
  rows = reader.entries(npc, options);
  if (profile.passive) assert.ok(rows.some(row => row.text === profile.passive));
  for (const rule of profile.rules) {
    assert.ok(rows.some(row => row.text === rule.text), `${profile.id}: canonical action/ace is readable`);
    if (rule.reward) assert.ok(rows.some(row => row.text === rule.reward));
  }
  assert.ok(rows.every(row => !('apCost' in row) && !('automation' in row)), 'NPC text has no automated controls or AP metadata');
  assert.equal(JSON.stringify(profile), snapshot);
}
const customOptions = {
  enemyProfile: () => ({id: 'fixture', passive: 'Passive', defense: {name: 'Defense', text: 'Defense prose'}, rules: [{id: 'action', name: 'Action', text: 'Action prose', reward: 'Action reward'}], reward: 'Profile reward'}),
  techniqueEntries: () => [{id: 'tech', displayTechniqueName: 'Technique', displayLevelName: 'I', displayText: 'Technique prose'}],
};
rows = reader.entries({profileId: 'fixture', notes: 'Own notes'}, customOptions);
for (const text of ['Passive', 'Defense prose', 'Action prose', 'Action reward', 'Profile reward', 'Own notes']) assert.ok(rows.some(row => row.text === text));
assert.equal(rows.filter(row => row.toggle && row.counter).length, 2, 'Technique and NPC action allow explicit notes; prose/rewards do not');
assert.equal(reader.entries(null).length, 0);
assert.equal(reader.entries({ability: {enabled: false, desc: 'Disabled'}}).length, 0);
assert.ok(reader.entries({ability: {enabled: true, words: {}, desc: 'Incomplete'}})[0].text.includes('[Глагол]'), 'Incomplete saved ability remains readable');
console.log('Manual reader: actor-owned formula, canonical NPC actions/passives/aces, rewards, read-only data and no automation controls passed');
