import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { runtime, fixture, clone } from "./helpers/scene-contract-harness.mjs";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const sceneUi = read("scene-ui.js"), heroUi = read("hero-ui.js"), sceneEvents = read("app-scene-events.js"), builderEvents = read("app-builder-events.js"), playEvents = read("app-play-events.js");
const between = (source, start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `${start} remains available to the behavior harness`);
  return source.slice(first, last);
};
const functionBlock = (source, name, next) => between(source, `function ${name}(`, `\nfunction ${next}(`);
const { engine, context: kernel } = runtime();
vm.runInContext(read("lionwing-technique-surface.js"), kernel);
const table = fixture();
table.selectedActor = "enemy";
table.targetIds = ["enemy"];
table.actors[0].heroId = "hero-sheet";
table.actors[1].profileId = "lionwing.npc.assassin";
const profiles = kernel.window.DAWN_LIONWING_TABLE_DATA.profiles(kernel.window.DAWN_LIONWING_DATA.coreRules);
const elements = new Map(), calls = [], profileCalls = [];
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    innerHTML: "", handlers: [], querySelector: () => null, querySelectorAll: () => [],
    insertAdjacentHTML(position, markup) { this.innerHTML = position === "afterbegin" ? markup + this.innerHTML : this.innerHTML + markup; },
    addEventListener(type, handler) { if (type === "click") this.handlers.push(handler); },
  });
  return elements.get(id);
};
let view = "gm", sharedTableId = "table-a";
const context = {
  fixture: table, originalActors: clone(table.actors), window: kernel.window, SceneEngine: engine, D: kernel.window.DAWN_DATA,
  S: { id: "hero-sheet", techniques: {}, runtime: { sacrifices: [] } },
  Sync: { state: () => ({ sceneId: sharedTableId }) }, activeSceneView: () => view,
  esc: value => String(value ?? "").replaceAll('"', "&quot;"), md: value => String(value ?? ""),
  $: element, CSS: { escape: String }, usingNextSceneInterface: () => false,
  enemyProfile: id => profiles.find(profile => profile.id === id),
  sceneNumericSourcesHtml: () => "", antagonistTrait: () => null, antagonistTraits: () => [],
  sceneEffectList: () => [], sceneActorEffects: () => [], activeSceneSpace: () => table.spaces[0],
  enemyRuleStateLabel: () => "", enemyProfileAutomation: () => "full", automationBadge: () => "",
  TOKEN_SYMBOLS: [], modifierModeDrafts: new Map(), attackModifierControlsHtml: () => { throw new Error("Info must not execute attack controls"); },
  sceneNarratorConsoleHtml: () => { profileCalls.push("manual"); return '<button data-gm-health="damage">manual</button>'; },
  sceneNarratorBasicActionsHtml: () => { profileCalls.push("actions"); return '<button data-gm-core-action="spell">action</button>'; },
  sceneNarratorTechniquesHtml: () => { profileCalls.push("techniques"); return '<button data-lw-action="spell">technique</button>'; },
  renderSceneDirector: () => calls.push({ kind: "render", source: vm.runInContext("sceneDirectorActor()?.id", context) }),
  setScenePanel: panel => calls.push({ kind: "panel", panel }), setSheetTab: tab => calls.push({ kind: "sheet-tab", tab }),
  setMode: mode => calls.push({ kind: "mode", mode }), toast: message => calls.push({ kind: "toast", message }),
  isEnglishPreview: () => false, t: key => key,
  sceneActionDisplayName: action => action.name,
};
vm.createContext(context);
vm.runInContext("let Scene=fixture, sceneDirectorActorContext=null, activeDirectorTab='turn', activeSheetTab='main';", context);
vm.runInContext(between(sceneUi, "const sceneUsesLionwing=", "function sceneEffects("), context);
const run = script => vm.runInContext(script, context);
assert.equal(context.Scene, undefined, "the harness uses the application's real lexical Scene binding");
assert.equal(run("sceneDirectorActor().id"), "hero", "inspecting a target cannot change the active action source");
const before = run("JSON.stringify(Scene)");
assert.equal(run('openSceneActorCockpit("enemy",{section:"manual"})'), true);
assert.equal(run("sceneDirectorActor().id"), "enemy", "an explicit manual transition pins the inspected actor");
assert.equal(run("activeDirectorTab"), "manual");
assert.equal(run("JSON.stringify(Scene)"), before, "navigation changes neither actor state, turn, targets, inspection nor journal");
run('Scene.selectedActor="hero"');
assert.equal(run("sceneDirectorActor().id"), "enemy", "later inspection remains independent of the explicit source");
run("Scene.turnSerial+=1");
assert.equal(run("sceneDirectorActor().id"), "hero", "the next turn resets an old explicit source");
run('openSceneActorCockpit("enemy",{section:"manual"})');
sharedTableId = "table-b";
assert.equal(run("sceneDirectorActor().id"), "hero", "a table switch cannot reuse a source from another table");
run('openSceneActorCockpit("enemy")');
run('Scene.actors=Scene.actors.filter(actor=>actor.id!=="enemy")');
assert.equal(run("sceneDirectorActor().id"), "hero", "removal clears a stale source");
const callsBeforeStale = calls.filter(call => call.kind === "panel").length;
assert.equal(run('openSceneCockpitLink({dataset:{sceneControlActor:"missing"}})'), true, "a stale explicit route is handled without falling back to a different actor");
assert.equal(calls.filter(call => call.kind === "panel").length, callsBeforeStale);
run("Scene.actors=originalActors;Scene.selectedActor='enemy'");
view = "player";
assert.equal(run('openSceneActorCockpit("enemy")'), false, "a player cannot open another participant's control panel");
assert.equal(run('openSceneActorCockpit("hero")'), true);
assert.deepEqual(calls.at(-2), { kind: "panel", panel: "sheet" });
assert.equal(run("activeSheetTab"), "combat");

view = "gm";
vm.runInContext(functionBlock(sceneUi, "renderSceneInspector", "sceneNarratorBasicActionsHtml"), context);
vm.runInContext("const baseRenderSceneInspectorV27=renderSceneInspector;" + between(sceneUi, "renderSceneInspector=function(){", "function renderSceneManager("), context);
const unchanged = run("JSON.stringify(Scene)");
run("renderSceneInspector()");
const npcInfo = element("scene-inspector").innerHTML;
assert.deepEqual(profileCalls, [], "LionWing Info never renders a second manual, base-action or Technique executor");
assert.match(npcInfo, /data-scene-control-actor="enemy" data-scene-director-section="manual"/);
assert.match(npcInfo, /scene-profile-reference/);
assert.ok(npcInfo.includes(profiles.find(profile => profile.id === "lionwing.npc.assassin").passive), "the enemy's Passive is readable inline");
assert.doesNotMatch(npcInfo, /data-gm-core-action|data-lw-action=|data-gm-health|data-scene-turn=|data-scene-actor-effect=/);
assert.equal(run("JSON.stringify(Scene)"), unchanged, "opening Info is a read-only operation");
run('Scene.selectedActor="hero";renderSceneInspector()');
assert.match(element("scene-inspector").innerHTML, /data-scene-cockpit-links="hero"/);
assert.doesNotMatch(element("scene-inspector").innerHTML, /data-gm-core-action|data-lw-action=|data-gm-health/);
view = "player";
run("renderSceneInspector()");
assert.match(element("scene-inspector").innerHTML, /data-open-scene-panel="sheet"/);
assert.doesNotMatch(element("scene-inspector").innerHTML, /data-scene-director-section|data-gm-health/);
view = "gm";
vm.runInContext(between(sceneEvents, '$("scene-inspector").addEventListener("click",event=>{const panel=', '\n$("scene-inspector").addEventListener("change"'), context);
const inspectorRoute = element("scene-inspector").handlers[0];
assert.equal(typeof inspectorRoute, "function");
const infoButton = { dataset: { openScenePanel: "director", sceneControlActor: "enemy", sceneDirectorSection: "manual" } };
let stopped = false;
inspectorRoute({ target: { closest: () => infoButton }, stopPropagation: () => { stopped = true; } });
assert.equal(stopped, true, "a handled route does not reopen the generic panel while bubbling");
assert.equal(run("sceneDirectorActor().id"), "enemy");
assert.equal(run("activeDirectorTab"), "manual");

vm.runInContext(functionBlock(heroUi, "heroSheetLinkedActor", "heroSheetTransferRecord"), context);
vm.runInContext(functionBlock(heroUi, "heroSheetCopy", "heroSheetFirstSentence"), context);
assert.equal(run("heroSheetLinkedActor().id"), "hero", "the filled sheet resolves its actor from lexical Scene");
assert.match(run('heroSheetTableButton("manual")'), /data-hero-sheet-section="manual" data-scene-control-actor="hero"/);
const beforeSheet = run("JSON.stringify(Scene)");
assert.equal(run('openHeroSheetTable({section:"manual"})'), true);
assert.equal(run("sceneDirectorActor().id"), "hero");
assert.equal(run("activeDirectorTab"), "manual");
assert.equal(run("JSON.stringify(Scene)"), beforeSheet, "the filled sheet route cannot join, spend resources or change targets");
const builderPage = { handlers: [], addEventListener(type, handler) { if (type === "click") this.handlers.push(handler); } };
context.document = { querySelector: () => builderPage };
vm.runInContext(between(builderEvents, "document.querySelector('.mode-page[data-page=\"build\"]')", '\n$("hero-play-sheet").addEventListener'), context);
builderPage.handlers[0]({ target: { closest: selector => selector === "[data-hero-sheet-table]" ? { dataset: { heroSheetSection: "turn" } } : null } });
assert.equal(run("activeDirectorTab"), "turn", "the production sheet handler reaches the requested canonical section");
run("Scene.actors[0].heroId='another-sheet'");
assert.equal(run("heroSheetLinkedActor()"), null);
const panelsBeforeMissing = calls.filter(call => call.kind === "panel").length;
run("openHeroSheetTable()");
assert.equal(calls.filter(call => call.kind === "panel").length, panelsBeforeMissing, "a missing linked actor cannot accidentally open the last inspected participant");
assert.equal(calls.at(-1).kind, "toast");
run("Scene.actors[0].heroId='hero-sheet';Scene.selectedActor='enemy';sceneDirectorActorContext=null");
vm.runInContext(functionBlock(sceneUi, "sceneTrayActionHtml", "renderSceneChrome"), context);
const snapshotBeforeTray = run("JSON.stringify(Scene)");
const trayAction = run(`sceneTrayActionHtml(Scene.actors[0],{id:${JSON.stringify(engine.ACTION_IDS.spell)},name:"Заклинание",available:true})`);
const presentation = kernel.window.DAWN_LIONWING_TECHNIQUE_SURFACE.actionPresentation(table, "hero", { kind: "action", actionId: engine.ACTION_IDS.spell, targetIds: ["enemy"] });
assert.match(trayAction, /data-lw-action-guide=/, "the lower dock is a shortcut to the single executor");
assert.doesNotMatch(trayAction, /data-core-action=| disabled/, "unavailable actions remain navigable so their explanation can be read");
assert.ok(trayAction.includes(presentation.costLabel), "the dock displays the common engine-backed cost quote");
assert.equal(run("JSON.stringify(Scene)"), snapshotBeforeTray, "drawing a shortcut cannot spend resources or emit events");
assert.match(run("sceneTrayMoreActionsHtml(Scene.actors[0],true)"), /data-open-scene-panel="director" data-scene-control-actor="hero"/);
assert.match(run("sceneTrayMoreActionsHtml(Scene.actors[0],false)"), /data-open-scene-panel="sheet" data-scene-control-actor="hero"/);
for (const [id, start, end] of [
  ["scene-action-tray", '$("scene-action-tray").addEventListener("click"', '\n$("scene-utility").addEventListener'],
  ["play-kit", '$("play-kit").addEventListener("click"', '\n$("play-kit").addEventListener("keydown"'],
  ["scene-utility", '$("scene-utility").addEventListener("click"', '\nfunction handleSceneDiceUtilityInput('],
]) {
  vm.runInContext(between(playEvents, start, end), context);
  const route = element(id).handlers.at(-1), beforePanels = calls.filter(call => call.kind === "panel").length;
  const snapshot = run("JSON.stringify(Scene)");
  let propagationStopped = false;
  route({ target: { closest: selector => selector === "[data-open-scene-panel]" ? { dataset: { openScenePanel: "director", sceneControlActor: "hero", sceneDirectorSection: "turn" } } : null }, stopPropagation: () => { propagationStopped = true; } });
  assert.equal(propagationStopped, true, `${id} handles navigation once instead of reopening it at the workbench`);
  assert.equal(calls.filter(call => call.kind === "panel").length, beforePanels + 1, `${id} opens exactly one canonical panel`);
  assert.equal(run("sceneDirectorActor().id"), "hero", `${id} preserves the explicit source route`);
  assert.equal(run("JSON.stringify(Scene)"), snapshot, `${id} navigation is read-only`);
}
const learnedTechnique=kernel.window.DAWN_LIONWING_DATA.archetypes.flatMap(archetype=>archetype.techniques).find(technique=>technique.id==="vagabond.master-at-arms");
table.actors[0].knownTechniques={ [learnedTechnique.id]:2 };
table.actors[0].ability={name:"Способность героя",rank:2,desc:"Сохранённый текст Способности"};
table.actors[0].taintedAbility={name:"Способность Порченого тела",rank:1,desc:"Сохранённый текст Порченого тела"};
Object.assign(context, {
  ATTRS: [], activeOutlooks: () => [], techById: id => id===learnedTechnique.id?learnedTechnique:null, sceneRollShortcuts: () => "", hasGift: () => false,
  sceneActionPanel: actor => { profileCalls.push("sheet-executor"); return '<button data-lw-action="spell">execute</button>'+kernel.window.DAWN_LIONWING_TECHNIQUE_SURFACE.render(actor,{scene:table,viewer:{role:"player",actorIds:[actor.id]}}); },
});
vm.runInContext(functionBlock(sceneUi, "sceneSheetPanel", "sceneUtilityActorAvailable"), context);
run("Scene.selectedActor='hero'");
const gmSheet = run("sceneSheetPanel()");
assert.doesNotMatch(gmSheet, /data-lw-action=/, "the Narrator's reference sheet has no second executor");
assert.match(gmSheet, /data-scene-cockpit-links="hero"/);
assert.match(gmSheet, /class="full-rules"/, "the Narrator keeps the independent reference beside the cockpit route");
assert.ok(gmSheet.includes(learnedTechnique.levels[0].text), "the Narrator reference retains learned Technique text");
view = "player";
const playerSheet=run("sceneSheetPanel()");
assert.match(playerSheet, /data-lw-action="spell"/, "the player's own sheet retains the canonical action controls");
assert.doesNotMatch(playerSheet, /class="full-rules"/, "LionWing Player combat has one Technique reference in the control surface");
for(const level of kernel.window.DAWN_LIONWING_TECHNIQUE_SURFACE.entries(table.actors[0])){
  const text=String(level.displayText).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  assert.ok(playerSheet.includes(text), "removing the duplicate reference preserves full learned Level text in the Technique surface");
}
assert.match(playerSheet, /Сохранённый текст Способности/);
assert.match(playerSheet, /Сохранённый текст Порченого тела/);
assert.deepEqual(profileCalls, ["sheet-executor"]);
run('Scene.rulesEdition="0.9";Scene.actors.forEach(actor=>actor.rulesEdition="0.9")');
assert.match(run("sceneSheetPanel()"), /class="full-rules"/, "legacy Player reference remains available");
run('Scene.rulesEdition="lionwing";Scene.actors.forEach(actor=>actor.rulesEdition="lionwing")');
assert.deepEqual(clone(table.log), [], "all route and reference checks left the journal untouched");

context.document.createElement=()=>({className:"",innerHTML:""});
context.antagonistDefense=()=>null;
vm.runInContext(functionBlock(sceneUi,"enemyAutomationName","enemyAutomationDetails"),context);
vm.runInContext(functionBlock(sceneUi,"enemyAutomationDetails","enemyStepButtonHtml"),context);
vm.runInContext(functionBlock(sceneUi,"enemyStepButtonHtml","enemyRuleOptionsHtml"),context);
vm.runInContext(functionBlock(sceneUi,"enemyRuleOptionsHtml","enemyRuleStateLabel"),context);
vm.runInContext(between(sceneUi,"function directorEnemyProfileSection(","\nconst renderSceneDirectorEnemyProfileBase="),context);
table.actors[1].ap=0;
const npcSnapshot=run("JSON.stringify(Scene)"),visibleText=markup=>markup.replace(/<[^>]*>/g,"");
const step=engine.actionByKey(context.D,"step"),stepState=engine.availableActions(table,context.D,"enemy").find(action=>action.id===step.id);
assert.equal(stepState.available,false);
assert.ok(stepState.reason);
const npcStep=run("enemyStepButtonHtml(Scene.actors[1])");
assert.ok(visibleText(npcStep).includes(stepState.reason), "an unavailable NPC Step explains its actual gate without hover");
assert.match(visibleText(npcStep),/1 ОД/, "showing a disabled reason never replaces the action price");
const npcControls=run("directorEnemyProfileSection(Scene.actors[1]).innerHTML");
const disabledRules=engine.availableEnemyRules(table,context.D,"enemy").filter(rule=>!rule.available&&rule.reason);
assert.ok(disabledRules.length>0);
for(const rule of disabledRules)assert.ok(visibleText(npcControls).includes(rule.reason), `NPC ${rule.id} explains its gate in visible text`);
assert.equal(run("JSON.stringify(Scene)"),npcSnapshot,"rendering NPC gate reasons remains read-only");

class DirectorNode {
  constructor(className="",title=""){this.className=className;this.title=title;this.children=[];this.dataset={};this.hidden=false;this.open=false;this.markup="";this.parentElement=null;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  prepend(...nodes){for(const node of nodes)node.remove();for(const node of nodes)node.parentElement=this;this.children.unshift(...nodes);}
  setAttribute(){}
  get innerHTML(){return this.markup;}
  set innerHTML(markup){this.markup=markup;this.children=[];const details=markup.match(/^<details class="([^"]+)"/);if(details)this.append(new DirectorNode(details[1]));}
  get firstElementChild(){return this.children[0]||null;}
  querySelector(selector){if(selector===":scope > header span")return this.title?{textContent:this.title}:null;return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){if(selector===":scope > .director-section")return this.children.filter(node=>node.className.split(" ").includes("director-section"));const descendants=this.children.flatMap(node=>[node,...node.querySelectorAll("*")]);return selector==="*"?descendants:selector.startsWith(".")?descendants.filter(node=>node.className.split(" ").includes(selector.slice(1))):[];}
}
const directorRoot=new DirectorNode(),directorNodes={
  overview:new DirectorNode("director-overview"),mode:new DirectorNode("director-mode"),
  roster:new DirectorNode("director-section director-roster"),actor:new DirectorNode("director-actor"),
  resources:new DirectorNode("director-section","ЗД И РЕСУРСЫ"),enemy:new DirectorNode("director-section director-active-enemy"),
  quickEffect:new DirectorNode("director-section","ЭФФЕКТ ВЫБРАННОМУ"),outcome:new DirectorNode("director-outcome"),round:new DirectorNode("director-round"),
};
directorRoot.append(...Object.values(directorNodes));
context.document.createElement=()=>new DirectorNode();
vm.runInContext(functionBlock(sceneUi,"sceneTurnStatusAfterCurrent","sceneActionDisplayName"),context);
vm.runInContext(functionBlock(sceneUi,"directorManualStateEditor","organizeSceneDirector"),context);
vm.runInContext(between(sceneUi,"function organizeSceneDirector(","\nconst renderSceneDirectorOrganizedBase="),context);
view="gm";context.directorRoot=directorRoot;
const beforeOrganize=run("JSON.stringify(Scene)");
run("organizeSceneDirector(directorRoot)");
const panes=Object.fromEntries(directorRoot.querySelectorAll(".director-pane").map(node=>[node.dataset.directorPane,node]));
assert.equal(directorNodes.overview.parentElement,panes.roster,"readiness and Tension are in Roster instead of occupying the action pane");
assert.equal(directorNodes.roster.parentElement,panes.roster);
assert.equal(directorNodes.round.parentElement,panes.roster);
const help=directorRoot.querySelector(".director-mode-help");
assert.equal(help.parentElement,panes.manual,"mode help is beside the Narrator's manual controls");
assert.equal(help.open,false,"mode help starts collapsed");
assert.match(help.innerHTML,/Как работает пульт/);
assert.equal(directorNodes.mode.parentElement,help,"help keeps the original mode explanation");
assert.equal(directorRoot.children[0].className,"director-tabs");
assert.equal(directorRoot.children[1].className,"director-focus-bar","the explicit source selector remains visible before the panes");
assert.deepEqual(directorRoot.children.slice(2).map(node=>node.dataset.directorPane),["turn","manual","roster"]);
assert.equal(directorNodes.resources.parentElement,panes.turn);
assert.equal(directorNodes.enemy.parentElement,panes.turn,"the canonical NPC executor stays in the action pane");
assert.equal(directorNodes.outcome.parentElement,panes.manual);
assert.equal(directorNodes.quickEffect.parentElement,panes.manual,"manual emergency controls remain available");
assert.equal(run("JSON.stringify(Scene)"),beforeOrganize,"organizing the cockpit cannot change the scene or action source");

Object.assign(context,{scenePanelWidths:{left:"normal",right:"normal"},sceneInterfaceVersion:"next",scenePanelLayoutMode:"custom",scenePanelSides:{},sceneInterfaceDensity:"compact",sceneTurnStripVisible:true});
vm.runInContext(functionBlock(sceneUi,"renderSceneLayoutSettings","sceneBattleComplete"),context);
run("renderSceneLayoutSettings()");
assert.match(element("scene-layout-settings").innerHTML,/<span>Инфо<\/span><select data-scene-panel-side="inspector"/,"layout settings use the same Info label as the main navigation");
assert.doesNotMatch(element("scene-layout-settings").innerHTML,/<span>Цель<\/span>/);

console.log("LionWing cockpit routes passed: independent action source, explicit read-only navigation, one executor/reference, visible NPC gate reasons, compact panes and lexical Hero linkage");
