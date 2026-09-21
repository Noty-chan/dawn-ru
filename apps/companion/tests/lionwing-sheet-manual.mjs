import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const heroUi=read("hero-ui.js"),events=read("app-builder-events.js");

assert.match(heroUi,/heroSheetPlaybookMarkup\(\)/,"the play sheet must explain the manual route and table transition");
assert.match(heroUi,/heroSheetGiftsAndBondsMarkup\(\)/,"the filled sheet must show selected Gifts and Bonds");
assert.match(heroUi,/heroSheetConsequenceMarkup\(\)/,"the sheet must expose read-only consequence history when it exists");
assert.match(heroUi,/heroSheetBuildWarningMarkup\(\)/,"an unfinished build must remain playable with a visible warning");
assert.match(heroUi,/data-manual-guide/,"manual and partial Levels need an actionable guide");
assert.match(heroUi,/data-hero-sheet-table/,"manual cards need a direct Table transition");
assert.match(events,/heroExportLionwingBridge/,"LionWing export must include the bridge helper");
assert.match(events,/heroImportLionwingBridge/,"LionWing import must read the bridge helper");
assert.match(events,/delete snapshot\.lionwing/,"export must strip any stale runtime/queue state before adding the bridge");
assert.doesNotMatch(events,/Scene\.lionwing/,"the hero export bridge must not carry combat queues from Scene");

const helperStart=heroUi.indexOf("function heroSheetClone");
const helperEnd=heroUi.indexOf("function heroSheetResourceMarkup");
assert.ok(helperStart>=0&&helperEnd>helperStart,"manual sheet helper block must stay extractable for behavior tests");
const context={isEnglishPreview:()=>false};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(`${heroUi.slice(helperStart,helperEnd)}\nthis.bridge=heroSheetConsequenceBridge;this.guide=heroSheetTechniqueGuide;`,context);

const source={lionwing:{choices:[{id:"combat-choice"}],pausedChains:[{id:"combat-chain"}],consequences:[{schema:1,id:"c1",category:"boon",lossTarget:{kind:"boon",id:"gift.one"},target:{kind:"boon",id:"gift.one"},choiceId:"choice",reason:"vulnerable-knockout",status:"pending-manual",applied:false,sceneSerial:4,createdEventId:"evt",manualNote:"Убрать Дар"}],legacyNotes:[{schema:1,id:"l1",type:"legacy-note",note:"Старое решение",choiceId:"choice",reason:"legacy-record",createdEventId:"evt",sceneSerial:4}]}};
const bridge=context.bridge(source);
assert.deepEqual(JSON.parse(JSON.stringify(bridge)),{
  schema:1,
  consequences:[{schema:1,id:"c1",category:"boon",lossTarget:{kind:"boon",id:"gift.one"},target:{kind:"boon",id:"gift.one"},choiceId:"choice",reason:"vulnerable-knockout",status:"pending-manual",applied:false,sceneSerial:4,createdEventId:"evt",manualNote:"Убрать Дар"}],
  legacyNotes:[{schema:1,id:"l1",type:"legacy-note",note:"Старое решение",choiceId:"choice",reason:"legacy-record",createdEventId:"evt",sceneSerial:4}],
},"only consequence records and legacy notes may cross the hero bridge");
assert.equal("choices" in bridge,false,"combat choice queue must not cross hero export/import");
assert.equal("pausedChains" in bridge,false,"paused combat chain must not cross hero export/import");

const guide=context.guide({text:"Когда способность срабатывает, потратьте 1 ОД и выберите союзника в области.",name:"Ручной уровень"},"manual");
assert.match(guide.when,/Когда способность срабатывает/);
assert.match(guide.resource,/1 ОД/);
assert.match(guide.target,/союзника/);
assert.match(guide.where,/Столе/);
assert.match(guide.what,/вручную/);
const partial=context.guide({text:"После броска выберите цель.",name:"Частичный уровень"},"partial","Остаток: вручную примените эффект.");
assert.equal(partial.what,"Остаток: вручную примените эффект.","partial status reason must remain the first instruction");

console.log("LionWing manual sheet behavior QA passed: gifts/bonds/playbook, actionable manual guide, read-only consequence bridge, and combat-queue exclusion");
