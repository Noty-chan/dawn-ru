import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const index=read("index.html"),heroUi=read("hero-ui.js"),events=read("app-builder-events.js"),css=read("app.css"),ru=read("locale-ru.js"),en=read("locale-en-builder.js"),sw=read("sw.js");

assert.match(index,/data-page="build"[\s\S]+id="hero-view-switch"[\s\S]+data-hero-view-mode="builder"[\s\S]+data-hero-view-mode="sheet"/,"Build and Sheet must be modes inside the existing Hero page");
assert.match(index,/id="hero-sheet-view"[\s\S]+data-hero-view-mode="builder"/,"the play sheet must provide an explicit return to the Builder");
assert.match(heroUi,/HERO_VIEW_STORAGE_KEY[\s\S]+heroViewPreferences\[S\.id\]/,"the local view preference must be scoped to a Hero id");
assert.match(heroUi,/Scene\.actors[\s\S]+actor\.heroId===S\.id/,"a linked Hero must read current resources from the table actor");
assert.match(heroUi,/canonicalById=new Map\(\(Lionwing\?\.archetypes\|\|\[\]\)/,"the technique catalog must retain the canonical English entries while showing a translation");
assert.match(heroUi,/techniqueSearchText\(t,canonical\)/,"the technique catalog search must use both display and canonical text");
assert.match(heroUi,/techniqueTagValues\(technique,canonical(?:\)|ById)/,"technique tags must be filterable in either language");
const viewSource=heroUi.slice(heroUi.indexOf("const HERO_VIEW_STORAGE_KEY"),heroUi.indexOf("function counter("));
assert.doesNotMatch(viewSource,/Scene\s*=|Scene\.[A-Za-z_$][\w$]*\s*=/,"the UI-only sheet must not mutate authoritative Scene state");
assert.match(viewSource,/activeCoreRules\(\)\?\.actions\|\|D\.actions/,"basic actions must reuse the active edition rules");
assert.match(viewSource,/techniqueLevelStatus\(technique\.id,level\.n\)/,"learned levels must use the canonical readiness projection");
assert.match(viewSource,/\["all","full","decision","partial","manual"\]/,"the sheet must expose all canonical readiness filters");
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
assert.match(events,/data-hero-sheet-table[\s\S]+setMode\("play"\)/,"table actions must reuse the existing page mode handler");
assert.match(css,/hero-sheet-resources[\s\S]+@media\(max-width:420px\)/,"the resource rail and small-screen layout must be styled");
assert.match(css,/\.techniques \.catalog-card\{[^}]*max-width:620px/,"a single filtered technique must keep a readable card width");
assert.doesNotMatch(css,/\.tech-level strong\{[^}]*display:flex/,"bold words inside technique text must stay inline");
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

console.log("LionWing Hero Build/Sheet mode QA passed: mode policy, per-Hero preference, canonical statuses, RU/EN, resource counters and legacy isolation");
