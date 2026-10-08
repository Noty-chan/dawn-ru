import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const index=read("index.html"),appCore=read("app-core.js"),heroUi=read("hero-ui.js"),events=read("app-builder-events.js"),css=read("app.css"),ru=read("locale-ru.js"),en=read("locale-en-builder.js"),sw=read("sw.js");

assert.match(index,/data-page="build"[\s\S]+id="hero-view-switch"[\s\S]+data-hero-view-mode="builder"[\s\S]+data-hero-view-mode="sheet"/,"Build and Sheet must be modes inside the existing Hero page");
assert.match(index,/id="hero-sheet-view"[\s\S]+data-hero-view-mode="builder"/,"the play sheet must provide an explicit return to the Builder");
assert.match(heroUi,/HERO_VIEW_STORAGE_KEY[\s\S]+heroViewPreferences\[S\.id\]/,"the local view preference must be scoped to a Hero id");
assert.match(heroUi,/Scene\.actors[\s\S]+actor\.heroId===S\.id/,"a linked Hero must read current resources from the table actor");
assert.match(heroUi,/canonicalById=new Map\(\(Lionwing\?\.archetypes\|\|\[\]\)/,"the technique catalog must retain the canonical English entries while showing a translation");
assert.match(heroUi,/techniqueSearchText\(t,canonical\)/,"the technique catalog search must use both display and canonical text");
assert.match(heroUi,/techniqueTagValues\(technique,canonical(?:\)|ById)/,"technique tags must be filterable in either language");
assert.match(appCore,/function spellcrafterLearnedLimitFor\(level\)/,"Spellcrafter learned-count policy must be centralized");
assert.match(heroUi,/spellLimit=spellcrafterLearnedLimitFor\(level\)/,"the builder must show the canonical learned-count limit");
assert.match(events,/limit=spellcrafterLearnedLimitFor\(level\)/,"the builder must enforce the canonical learned-count limit");
const viewSource=heroUi.slice(heroUi.indexOf("const HERO_VIEW_STORAGE_KEY"),heroUi.indexOf("function counter("));
assert.doesNotMatch(viewSource,/Scene\s*=|Scene\.[A-Za-z_$][\w$]*\s*=/,"the UI-only sheet must not mutate authoritative Scene state");
assert.match(viewSource,/activeCoreRules\(\)\?\.actions\|\|D\.actions/,"basic actions must reuse the active edition rules");
assert.match(viewSource,/techniqueLevelStatus\(technique\.id,level\.n\)/,"learned levels must use the canonical readiness projection");
assert.match(viewSource,/\["all","full","decision","partial","manual"\]/,"the sheet must expose all canonical readiness filters");
assert.match(viewSource,/heroSheetPlaybookMarkup\(\)/,"the play sheet must explain the manual route and Table transition");
assert.match(viewSource,/heroSheetGiftsAndBondsMarkup\(\)/,"the filled sheet must show selected Gifts and Bonds");
assert.match(viewSource,/heroSheetConsequenceMarkup\(\)/,"the play sheet must show read-only consequence history when linked");
assert.match(viewSource,/heroSheetBuildWarningMarkup\(\)/,"an incomplete build must remain playable with a clear warning");
assert.match(viewSource,/heroSheetTechniqueGuideMarkup\(level,status,reason\)/,"partial and manual Levels must expose a manual action guide");
assert.doesNotMatch(viewSource,/DAWN_LIONWING_AUTOMATION_STATUS\s*=/,"the sheet must not duplicate or replace the generated registry projection");
assert.match(viewSource,/esc\(identity\)/);
assert.match(viewSource,/esc\(S\.concept/);
assert.match(viewSource,/esc\(t\("heroView\.player",\{player:S\.player\}\)\)/);
assert.match(viewSource,/data-hero-resource/,"the sheet must expose editable Stress and Influence counters");
assert.match(viewSource,/key==="influence"\|\|key==="stress"/,"only Stress and Influence should be directly editable in the resource rail");
assert.match(viewSource,/const threshold=reroll\?3:4/,"an Influence reroll must count 3s as Successes while normal rolls stay at 4+");
assert.match(ru,/heroView\.dice\.rerolledHint[\s\S]+3 и выше/,"RU sheet copy must explain the 3+ Influence reroll threshold");
assert.match(en,/heroView\.dice\.rerolledHint[\s\S]+3 or higher/,"EN sheet copy must explain the 3+ Influence reroll threshold");
assert.match(events,/data-hero-sheet-tools[\s\S]+openToolsDicePreset/,"sheet rolls must reuse the existing Tools handler");
assert.match(events,/data-hero-sheet-table[\s\S]+openHeroSheetTable/,"table references must use the actor-aware canonical route");
assert.match(heroUi,/function openHeroSheetTable\([\s\S]+setMode\("play"\)/,"the canonical sheet route must reuse the existing page mode handler");
assert.match(events,/heroExportLionwingBridge/,"the LionWing hero export must expose the consequence bridge");
assert.match(events,/heroImportLionwingBridge/,"the LionWing hero import must read the consequence bridge");
assert.doesNotMatch(events,/Scene\.lionwing/,"the hero export bridge must not include combat queues");
assert.match(css,/hero-sheet-resources[\s\S]+@media\(max-width:420px\)/,"the resource rail and small-screen layout must be styled");
assert.match(css,/\.techniques \.catalog-card\{[^}]*max-width:620px/,"a single filtered technique must keep a readable card width");
assert.match(heroUi,/class="tech-level-heading"/,"technique level headers must have an explicit styling hook");
assert.match(css,/\.tech-level-heading\{[^}]*display:flex/,"only the explicit technique level heading should use the flex layout");
assert.doesNotMatch(css,/\.tech-level(?:>|\s+)strong\{[^}]*display:flex/,"bold words inside catalog technique text must stay inline");
assert.doesNotMatch(css,/\.sheet-technique-level(?:>|\s+)strong\{[^}]*display:flex/,"bold words inside legacy sheet technique text must stay inline");
assert.match(appCore,/function ruleTextMarkup\(value\)/,"technique option lists must use the shared rule-text renderer");
assert.match(heroUi,/ruleTextMarkup\(l\.text\)/,"builder technique cards must lay out embedded option lists");
assert.match(heroUi,/ruleTextMarkup\(level\.text\)/,"play-sheet technique cards must lay out embedded option lists");
const ruleTextContext={};
vm.createContext(ruleTextContext);
vm.runInContext(`${appCore.slice(appCore.indexOf("const esc ="),appCore.indexOf("const uid ="))};globalThis.renderRuleText=ruleTextMarkup`,ruleTextContext);
const renderedRuleText=ruleTextContext.renderRuleText("Intro. ‣ **Dire:** damage. • **Wild:** area.");
assert.equal((renderedRuleText.match(/<li>/g)||[]).length,2,"both LionWing bullet glyphs must become list items");
assert.match(renderedRuleText,/<li><strong>Dire:<\/strong> damage\.<\/li>/,"inline emphasis must survive list layout");
assert.match(css,/\.rule-list\{[^}]*display:grid/,"rule lists must have compact card layout");
for(const key of ["heroView.modeLabel","heroView.editBuild","heroView.resource.health","heroView.actions","heroView.noMatchingTechniques"]){assert.ok(ru.includes(`"${key}"`),`${key} missing from RU locale`);assert.ok(en.includes(`"${key}"`),`${key} missing from EN locale`)}
assert.match(sw,/\.\/hero-ui\.js/);assert.match(sw,/\.\/app-builder-events\.js/);

const modeFunction=heroUi.match(/function resolvedHeroViewMode\([^\n]+/s)?.[0];
assert.ok(modeFunction,"resolved Hero view policy must stay directly testable");
const context={HERO_VIEW_MODES:new Set(["builder","sheet"])};vm.createContext(context);vm.runInContext(`${modeFunction}\nthis.resolve=resolvedHeroViewMode;`,context);
assert.equal(context.resolve("lionwing",true,undefined),"sheet","a completed LionWing Hero defaults to the play sheet");
assert.equal(context.resolve("lionwing",false,"sheet"),"sheet","an explicit Sheet choice is available before the build is complete");
assert.equal(context.resolve("lionwing",true,"builder"),"builder","an explicit per-Hero Builder choice is retained");
assert.equal(context.resolve("ru-v0.9",true,"sheet"),"builder","legacy v0.9 remains on its existing Builder path");

const searchSource=heroUi.slice(heroUi.indexOf("function techniqueSearchText"),heroUi.indexOf("function selectedOutlookGifts"));
const searchContext={};vm.createContext(searchContext);vm.runInContext(`${searchSource}\nthis.search=techniqueSearchText;this.tags=techniqueTagValues;`,searchContext);
const localizedTechnique={id:"vagabond.master-at-arms",name:"Мастер оружия",tags:"оружие, движение",levels:[{name:"Многогранность",text:"Экипируйте три Вооружения."}]};
const canonicalTechnique={id:"vagabond.master-at-arms",name:"Master At Arms",tags:"Weapon, Movement",levels:[{name:"Versatility",text:"Equip three Armaments."}]};
assert.match(searchContext.search(localizedTechnique,canonicalTechnique),/master at arms/,"English technique names must be searchable from the Russian catalog");
assert.match(searchContext.search(localizedTechnique,canonicalTechnique),/versatility/,"English level names must be searchable from the Russian catalog");
assert.deepEqual([...searchContext.tags(localizedTechnique,canonicalTechnique)], ["оружие","движение","Weapon","Movement"], "tag filters must include both language variants");

const countContext={};vm.createContext(countContext);
const countStart=appCore.indexOf("function spellcrafterLearnedLimitFor"),countEnd=appCore.indexOf("function sceneCore");
vm.runInContext(`${appCore.slice(countStart,countEnd)}\nthis.limit=spellcrafterLearnedLimitFor;`,countContext);
assert.deepEqual([0,1,2,3,4].map(level=>countContext.limit(level)),[0,1,2,3,3],"Spellcrafter learns one, two, then three total Modifications");

// Resource availability follows the existing correction route. Queue changes
// refresh only the two counters, preserving the rest of the Hero sheet and focus.
let englishResources=false;
const resourceQueue={pending:0,failed:0},resourceRole={sceneId:"table-a",canNarrate:false};
const resourceActor={id:"own",heroId:"hero",team:"hero",hp:10,maxHp:10,influence:1,stress:1,attrs:{}};
const resourceCards=new Map(["influence","stress"].map(key=>{
  const count={textContent:""},note={textContent:"",hidden:true},buttons=[-1,1].map(delta=>({dataset:{heroResource:key,heroResourceDelta:String(delta)},disabled:false,attributes:{},setAttribute(name,value){this.attributes[name]=value;}}));
  return[key,{count,note,buttons,querySelector:selector=>selector==="strong"?count:selector===".hero-sheet-resource-reason"?note:null,querySelectorAll:()=>buttons}];
}));
const resourceRoot={querySelector:selector=>resourceCards.get(selector.match(/data-resource="([^"]+)"/)?.[1])||null};
const resourceContext={window:{},Scene:{rulesEdition:"lionwing",actors:[resourceActor]},S:{id:"hero",runtime:{influence:1,stress:1}},Sync:{state:()=>resourceRole},
  $:()=>resourceRoot,networkV2QueueStatus:()=>resourceQueue,isEnglishPreview:()=>englishResources,
  ensureRuntime(){},derived:()=>({hp:10,focus:2,speed:4}),stressMaximumFor:()=>3,
  clamp:(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0)),t:key=>key};
vm.createContext(resourceContext);
const resourceLoad=code=>vm.runInContext(code,resourceContext),resourceRun=code=>vm.runInContext(code,resourceContext);
resourceLoad(appCore.slice(appCore.indexOf("const esc ="),appCore.indexOf("const uid =")));
resourceLoad(heroUi.slice(heroUi.indexOf("function heroViewRuntime("),heroUi.indexOf("function heroSheetClone(")));
resourceLoad(heroUi.slice(heroUi.indexOf("function heroSheetCopy("),heroUi.indexOf("function heroSheetFirstSentence(")));
resourceLoad(heroUi.slice(heroUi.indexOf("function heroSheetLinkedActor("),heroUi.indexOf("function heroSheetTableButton(")));
resourceLoad(read("lionwing-ui.js").split(/\r?\n/).find(line=>line.startsWith("const lwCanNarrate =")));
const numericReasonSource=read("scene-ui.js");
resourceLoad(numericReasonSource.slice(numericReasonSource.indexOf("function sceneNumericCorrectionReason("),numericReasonSource.indexOf("function narratorActorValue(")));
resourceLoad(heroUi.slice(heroUi.indexOf("function heroSheetResourceCorrectionReason("),heroUi.indexOf("function heroSheetActionCost(")));
const resourceMarkup=key=>resourceRun(`heroSheetResourceMarkup(${JSON.stringify(key)},1)`);
const buttonsIn=html=>[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);
for(const key of ["influence","stress"]){
  const markup=resourceMarkup(key);
  assert.ok(buttonsIn(markup).every(button=>/\bdisabled\b/.test(button)),"Player corrections are visibly disabled instead of promising an unavailable route");
  assert.match(markup,/<small class="hero-sheet-resource-reason" >Изменяет Нарратор<\/small>/,"the reason is visible outside a tooltip");
}
resourceRole.canNarrate=true;
assert.ok(buttonsIn(resourceMarkup("influence")).every(button=>!/\bdisabled\b/.test(button)),"the Narrator retains valid corrections");
resourceQueue.pending=1;resourceRun("refreshHeroSheetResourceControls()");
assert.ok([...resourceCards.values()].every(card=>card.buttons.every(button=>button.disabled)));
assert.equal(resourceCards.get("influence").note.textContent,"Сохранение…");
assert.equal(resourceCards.get("influence").note.hidden,false);
resourceQueue.pending=0;resourceActor.influence=2;resourceRun("refreshHeroSheetResourceControls()");
assert.equal(resourceCards.get("influence").count.textContent,"2","acknowledgement updates the displayed count");
assert.ok(resourceCards.get("influence").buttons.every(button=>!button.disabled),"acknowledgement restores available controls without rebuilding the sheet");
assert.equal(resourceCards.get("influence").note.hidden,true);
resourceQueue.failed=1;resourceRun("refreshHeroSheetResourceControls()");
assert.match(resourceCards.get("stress").note.textContent,/несохранённые изменения/);
assert.ok(resourceCards.get("stress").buttons.every(button=>button.disabled));
resourceQueue.failed=0;resourceActor.stress=3;resourceRun("refreshHeroSheetResourceControls()");
assert.equal(resourceCards.get("stress").buttons[0].disabled,false);assert.equal(resourceCards.get("stress").buttons[1].disabled,true,"Stress still respects its maximum");
resourceRole.canNarrate=false;englishResources=true;resourceRun("refreshHeroSheetResourceControls()");
assert.equal(resourceCards.get("influence").note.textContent,"Only the Narrator can edit.");
assert.match(resourceCards.get("influence").buttons[1].attributes["aria-label"],/Only the Narrator can edit/);
resourceContext.Scene.actors=[];
assert.ok(buttonsIn(resourceMarkup("influence")).every(button=>!/\bdisabled\b/.test(button)),"an unlinked Hero retains the existing local resource route");
assert.doesNotMatch(resourceRun("heroSheetResourceMarkup('hp',10)"),/data-hero-resource/,"health remains read-only in the Hero resource rail");

const heroContext={console,contentPreferences:{edition:"lionwing"},APP_SCHEMA:14,ATTRS:[["body"],["talent"],["spirit"],["mind"]],Logic:{normalizeAttributeBases:values=>values,normalizeAttributeGrowth:values=>values},crypto:{randomUUID:()=>"hero-test-id"}};heroContext.globalThis=heroContext;vm.createContext(heroContext);
const heroStart=appCore.indexOf("const $ ="),heroEnd=appCore.indexOf("function normalizePinnedRules");
vm.runInContext(`${appCore.slice(heroStart,heroEnd)}\nthis.normalize=normalizeHero;`,heroContext);
for(const [level,expected] of [[1,["fierce"]],[2,["fierce","focused"]],[3,["fierce","focused","wild"]]]){
  const normalized=vm.runInContext(`normalize({rulesEdition:"lionwing",techniques:{"ruiner.spellcrafter":${level}},mods:{spellcrafterAugments:["fierce","focused","wild","outstanding"]}})`,heroContext);
  assert.deepEqual(Array.from(normalized.mods.spellcrafterAugments),expected,`Hero import keeps the ${level === 1 ? "first" : level === 2 ? "first two" : "first three"} canonical learned Modifications`);
}

const dataContext={console};dataContext.window=dataContext;dataContext.globalThis=dataContext;vm.createContext(dataContext);
for(const file of ["edition-lionwing.js","edition-lionwing-ru.js"])vm.runInContext(read(file),dataContext,{filename:file});
const canonicalSpellcrafter=dataContext.DAWN_LIONWING_DATA.archetypes.flatMap(archetype=>archetype.techniques).find(technique=>technique.id==="ruiner.spellcrafter");
const localizedSpellcrafter=dataContext.DAWN_LIONWING_RU.archetypes.ruiner.techniques["ruiner.spellcrafter"];
assert.deepEqual(Array.from(canonicalSpellcrafter.levels,level=>level.n),[1,2,3],"canonical Spellcrafter has all three levels");
assert.match(canonicalSpellcrafter.levels[1].text,/additional Augment/);
assert.match(canonicalSpellcrafter.levels[2].text,/additional Augment/);
assert.match(localizedSpellcrafter.levels["1"].text,/Выраженная/);
assert.match(localizedSpellcrafter.levels["2"].text,/начальный Фокус/);
assert.match(localizedSpellcrafter.levels["3"].text,/две разные Модификации/);

console.log("LionWing Hero Build/Sheet mode QA passed: mode policy, per-Hero preference, canonical statuses, RU/EN, resource counters and legacy isolation");
const viewNodes=new Map();const viewNode=id=>{if(!viewNodes.has(id))viewNodes.set(id,{hidden:false,textContent:'',querySelectorAll:()=>[]});return viewNodes.get(id)};
const viewPage={dataset:{},querySelectorAll:()=>[]};let complete=false,sheetPaints=0;
const viewContext=vm.createContext({HERO_VIEW_MODES:new Set(['builder','sheet']),HERO_VIEW_STORAGE_KEY:'qa',heroViewPreferences:{},S:{id:'a',rulesEdition:'lionwing'},document:{querySelector:()=>viewPage},$:viewNode,isLionwingEdition:()=>true,heroBuildComplete:()=>complete,initHeroViewLayout(){},renderHeroPlaySheet(){sheetPaints++},t:key=>key,localStorage:{setItem(){}}});
for(const name of ['resolvedHeroViewMode','saveHeroViewPreference','renderHeroView']){
 const start=heroUi.indexOf(`function ${name}(`),end=heroUi.indexOf('\nfunction ',start+1);vm.runInContext(heroUi.slice(start,end<0?heroUi.length:end),viewContext);
}
viewContext.renderHeroView();assert.equal(viewPage.dataset.heroView,'builder');complete=true;viewContext.renderHeroView();assert.equal(viewPage.dataset.heroView,'builder','Finishing the build never closes the existing editor');
viewContext.S={id:'b',rulesEdition:'lionwing'};viewContext.renderHeroView();assert.equal(viewPage.dataset.heroView,'sheet','A new complete Hero still initially opens Sheet');complete=false;viewContext.renderHeroView();assert.equal(viewPage.dataset.heroView,'sheet','Resource/build changes never move a Hero out of its chosen view');
viewContext.S={id:'a',rulesEdition:'lionwing'};viewContext.renderHeroView();assert.equal(viewPage.dataset.heroView,'builder','The initial view is remembered independently for each Hero');assert.ok(sheetPaints>0);
console.log('Hero initial-view lifecycle: completion/invalidation retain current editor/sheet, separate Heroes keep separate choices');
// Execute the real export button handler, including per-edition metadata.
const exportSource=events.slice(events.indexOf('$("export-hero").onclick='),events.indexOf('\n$("import-hero").onchange='));
const exportButton={};let savedExport=null;
const exportContext=vm.createContext({$:()=>exportButton,S:{name:'User Имя',rulesEdition:'lionwing',supplementIds:[],runtime:{diceHistory:[]}},contentPreferences:{locale:'ru'},APP_SCHEMA:2,isLionwingEdition:()=>exportContext.S.rulesEdition==='lionwing',heroExportLionwingBridge:()=>null,heroSheetClone:value=>JSON.parse(JSON.stringify(value)),download:(name,data)=>{savedExport={name,data:JSON.parse(data)}}});
vm.runInContext(exportSource,exportContext);exportButton.onclick();
assert.equal(savedExport.data.schema,2);assert.equal(savedExport.data.content.locale,'ru');assert.equal(savedExport.data.content.builderRulesLocale,'en');assert.equal(savedExport.data.content.canonicalRulesLocale,'en');assert.equal(savedExport.data.content.tableMechanicsStatus,'partial');assert.equal(savedExport.data.hero.name,'User Имя');
exportContext.S.rulesEdition='ru-v0.9';exportButton.onclick();assert.equal(savedExport.data.content.canonicalRulesLocale,'ru');assert.equal(savedExport.data.content.tableMechanicsStatus,'available');
console.log('Hero export button: bilingual UI locale stays separate from canonical language, partial LionWing support and schema=2 remain explicit');
