import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { runtime, clone } from "./helpers/scene-contract-harness.mjs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url),"utf8");
const { context: kernel } = runtime(), canonical = kernel.window.DAWN_LIONWING_DATA;
const core = canonical.coreRules, before = clone(core), handlers = [];
const context = vm.createContext({
  console, URL, window: {}, document: { addEventListener: (type,callback) => handlers.push(callback), querySelectorAll: () => [] },
  store: { mode: "rules" }, isEnglishPreview: () => true, sceneUsesLionwing: () => true,
  activeCoreRules: () => core, ruleKey: value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-"),
  ruleCardData: card => card, esc: String, location: { href: "https://example.test/companion/?edition=lionwing", origin: "https://example.test" },
});
vm.runInContext(read("app-workspace.js"),context);
const play = read("play-ui.js"), start = play.indexOf("function activeRuleChapters(){"), end = play.indexOf("\nfunction renderRules(){",start);
vm.runInContext(play.slice(start,end),context);
vm.runInContext(play.slice(play.indexOf("function ruleCardId("),play.indexOf("\n",play.indexOf("function ruleCardId("))),context);
const chapters = context.activeRuleChapters();
assert.equal(new Set(chapters.map(chapter => chapter.id)).size,chapters.length,"every generated chapter has a unique navigation target");
const narrator = chapters.filter(chapter => chapter.audience === "gm").flatMap(chapter => chapter.cards);
assert.equal(narrator.length,71,"all 71 canonical Narrator and Modifier cards remain reachable by the Narrator filter");
assert.ok(chapters.filter(chapter => chapter.audience === "player").flatMap(chapter => chapter.cards || []).every(card => !narrator.includes(card)),"player and Narrator chapter contents remain distinct");
assert.equal(chapters.flatMap(chapter => chapter.cards || []).length,core.rules.length,"grouping loses no canonical rules");
for (const chapter of chapters.filter(chapter => chapter.cards?.length)) {
  const href = context.workspaceRulesHref("combat",chapter.cards);
  assert.equal(href,`?mode=rules#rules-${chapter.id}`,"a battlefield summary links to its actual chapter in this edition");
  assert.equal(context.workspaceRuleAnchor(chapter.cards[0]),context.ruleCardId(chapter.cards[0],chapter.id),"individual cards link to the generated rule target");
}
assert.equal(context.workspaceRulesHref("actions",core.actions.list),"?mode=rules#rules-lionwing-actions");
const records = [...core.rules,...core.actions.list,...core.effects.positive,...core.effects.negative,...(core.npcs?.list || []),...canonical.archetypes.flatMap(archetype => archetype.techniques)];
assert.ok(records.length > 250,"the real catalog exceeds the old silent limit");
let page = context.workspaceResultPage("reference","all",records,40);
assert.equal(page.shown,40);assert.equal(page.total,records.length);assert.equal(page.hasMore,true);
while (page.hasMore) { assert.equal(context.workspaceMoreResults("reference"),true); page=context.workspaceResultPage("reference","all",records,40); }
assert.deepEqual(page.items.map(item => item.id),records.map(item => item.id),"successive reveal reaches every real record in source order");
assert.equal(context.workspaceResultPage("reference","new-search",records,40).shown,40,"changing filters restarts the result window");
assert.equal(context.workspaceResultPage("reference","new-search",records,40,records.length-1).shown,records.length,"a bookmarked final record is revealed before navigation");
assert.equal(context.workspaceResultPage("scene-reference","all",records,36).shown,36,"the scene and global windows are independent");
assert.deepEqual(clone(core),before,"navigation and pagination preserve canonical game data");
let request = null;
context.setMode = (...args) => { request=args; };
const link = { getAttribute: () => "?mode=rules#rules-lionwing-actions" };
let prevented=false;
handlers[0]({ target: { closest: selector => selector.includes(".reference-rules-link") ? link : null }, preventDefault: () => { prevented=true; } });
assert.equal(prevented,true);assert.equal(request[0],"rules");assert.equal(request[1].hash,"#rules-lionwing-actions","internal navigation uses the existing application controller");
request=null;handlers[0]({ctrlKey:true,target:{closest:selector=>selector.includes(".reference-rules-link")?link:null},preventDefault:()=>{throw Error("modified click must retain browser navigation")}});assert.equal(request,null);
// Exercise the actual catalog builder and renderer: category text must not
// change an entry's type (NPC Rules is a Rule, Bond Actions is also a Rule).
const cells = new Map();
context.$ = id => {
  if (!cells.has(id)) cells.set(id,{ value:"", innerHTML:"", textContent:"", hidden:false, focus(){ context.document.activeElement=this; } });
  return cells.get(id);
};
Object.assign(context,{
  isLionwingEdition:()=>true, activeReferenceSections:()=>[], activeCanonicalSkills:()=>[],
  activeArchetypes:()=>[], activeOutlooks:()=>[], activeAttrs:()=>[], actionCostLabel:()=>"",
  makeRulePinRecord:()=>({}), rulePinButton:()=>"", automationBadge:()=>"", md:String,
  refKind:"NPC", refTag:"all", refSort:"source",
});
vm.runInContext(play.slice(play.indexOf("function referenceItems(){"),play.indexOf("\nfunction renderAll(){")),context);
assert.equal(core.npcs.list.length,41,"canonical fixture contains all 41 NPC profiles");
context.renderReference();
assert.equal(context.$("reference-count").textContent,"Showing 40 of 41","NPC filter excludes rules with NPC in their category");
context.document.activeElement=context.$("reference-more");
context.workspaceMoreResults("reference");context.renderReference();
assert.equal(context.$("reference-count").textContent,"Showing 41 of 41");
assert.equal(context.$("reference-more").hidden,true);
assert.equal(context.document.activeElement,context.$("reference-count"),"the final reveal keeps keyboard focus on a visible result count");
context.refKind="Action";context.renderReference();
assert.equal(core.actions.list.length,17);
assert.equal(context.$("reference-count").textContent,"Showing 17 of 17","Action filter excludes Antagonist Actions and Bond Actions rules");
const sceneSource=read("scene-ui.js");
vm.runInContext(sceneSource.slice(sceneSource.indexOf("function sceneRuleChapter(id){"),sceneSource.indexOf("\nfunction sceneCombatReferenceItems(",sceneSource.indexOf("function sceneRuleChapter(id){"))),context);
for (const [section,primaryId] of [["combat","lionwing.core.combat.structured"],["field","lionwing.core.spatial.setting-up"],["enemies","lionwing.narrator.npcs.turns"]]) {
  const primary=chapters.find(chapter=>chapter.cards?.some(card=>card.id===primaryId));
  assert.ok(primary,`the canonical ${section} primary chapter exists`);
  assert.equal(context.workspaceRulesHref(section,core.rules),`?mode=rules#rules-${primary.id}`,"the full chapter link follows the selected section rather than the largest unrelated category");
}
assert.equal(context.workspaceRulesHref("effects",core.effects.negative),"?mode=rules#rules-lionwing-actions");
assert.deepEqual(clone(core),before,"catalog filtering and rendering preserve canonical rules");
console.log("Desktop workspace: canonical audiences and type filters, complete catalog windows, valid edition links and internal navigation passed");
