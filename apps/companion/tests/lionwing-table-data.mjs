import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const context={window:{}};
vm.createContext(context);
for(const file of ["edition-lionwing.js","edition-lionwing-ru.js","lionwing-table-data.js","logic.js"]){
  vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
}

const english=context.window.DAWN_LIONWING_DATA.coreRules;
const russianOverlay=context.window.DAWN_LIONWING_RU.coreRules.npcs.entries;
const table=context.window.DAWN_LIONWING_TABLE_DATA;
const englishProfiles=table.profiles(english);

assert.equal(englishProfiles.length,english.npcs.list.length,"every LionWing NPC reaches the manual table adapter");
assert.ok(englishProfiles.length>=30,"LionWing NPC catalog is unexpectedly small");

const cannoneer=englishProfiles.find(profile=>profile.id==="lionwing.npc.cannoneer");
assert.ok(cannoneer,"Cannoneer is available to the table");
assert.equal(cannoneer.stats.health,"13 + [Tier × 5]");
assert.equal(context.window.DAWN_LOGIC.scaleTierFormula(cannoneer.stats.health,2),23,"LionWing Tier formula must use the assigned Tier, not the legacy Tier-1 increment");
assert.equal(cannoneer.rules.find(rule=>rule.id==="lionwing.npc.cannoneer.fire")?.kind,"trump");
assert.equal(cannoneer.rules.find(rule=>rule.id==="lionwing.npc.cannoneer.fire")?.apCost,2);
assert.ok(cannoneer.rules.every(rule=>rule.automation==="assisted"&&!rule.available),"LionWing rules must remain manual");

const localizedCore=structuredClone(english);
localizedCore.npcs.list=localizedCore.npcs.list.map(npc=>{
  const localized=russianOverlay[npc.id]||{};
  const actions=localized.actions||{};
  return{...npc,...localized,actions:npc.actions.map(action=>({...action,...(actions[action.id]||{})})),ace:{...npc.ace,...(localized.ace||{})}};
});
const russianProfiles=table.profiles(localizedCore);
assert.equal(russianProfiles.find(profile=>profile.id==="lionwing.npc.viper")?.name,"Гадюка");
assert.equal(JSON.stringify(russianProfiles.map(profile=>profile.id)),JSON.stringify(englishProfiles.map(profile=>profile.id)),"locale must not change stable NPC ids");
assert.equal(JSON.stringify(table.effects(english).positive.map(effect=>effect.id)),JSON.stringify(english.effects.positive.map(effect=>effect.id)));

console.log(`LionWing manual table data OK: ${englishProfiles.length} NPC profiles, stable RU/EN ids`);
