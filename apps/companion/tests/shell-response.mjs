import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadHeroModel } from "./load-hero-model.mjs";

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8").replaceAll("\r\n","\n");
const core=read("app-core.js"),events=read("app-builder-events.js"),play=read("play-ui.js"),app=read("app.js"),scene=read("scene-ui.js");
function evaluate(source,context){vm.runInContext(source,context);}
function line(prefix){const found=events.split("\n").find(row=>row.startsWith(prefix));assert.ok(found,prefix);return found;}

// Production event handlers change model state immediately, preserving the
// newest draft even before deferred previews or the save timer run.
const frames=new Map(),cells=new Map(),calls=[],pendingImages=[];
let nextFrame=0;
const cell=id=>{if(!cells.has(id))cells.set(id,{value:"",dataset:{},addEventListener(type,handler){this[type]=handler}});return cells.get(id);};
const context=vm.createContext({console,Map,Set,$:cell,store:{mode:"build",heroes:[],current:0},S:{id:"first",media:{},skills:[{id:"skill",name:""}]},
  requestAnimationFrame(callback){const id=++nextFrame;frames.set(id,callback);return id},cancelAnimationFrame(id){frames.delete(id)},
  persist(){calls.push(["save",context.S.id,context.S.name])},renderHeroSelect(){calls.push(["select",context.S.name])},
  renderSheet(){calls.push(["sheet",context.S.id,context.S.name])},renderSidebar(){calls.push(["sidebar",context.S.name])},renderPlay(){calls.push(["play"])},
  renderProfile(){calls.push(["profile",context.S.id])},renderRules(){calls.push(["rules",cell("rules-search").value])},
  renderTechniques(){calls.push(["techniques",cell("tech-search").value])},renderReference(){calls.push(["reference",cell("ref-search").value])},
  canonicalSkillByName:()=>null,t:key=>key,toast:()=>{},imageFromFile:()=>new Promise(resolve=>pendingImages.push(resolve)),tokenImageFromFile:()=>new Promise(resolve=>pendingImages.push(resolve)),
});
context.store.heroes=[context.S];
evaluate(events.slice(events.indexOf("let builderPreviewFrame="),events.indexOf("$$('[data-mode]")),context);
for(const prefix of ['for(const key of ["name","player","concept"])','$("skills").addEventListener("input"','$("rules-search").addEventListener("input"'])evaluate(line(prefix),context);
const flush=()=>{const queued=[...frames.values()];frames.clear();queued.forEach(callback=>callback());};
for(const name of ["A","AB","ABC"]){cell("f-name").value=name;cell("f-name").input({target:cell("f-name")})}
assert.equal(context.S.name,"ABC");assert.equal(calls.filter(([kind])=>kind==="save").length,3);
assert.equal(calls.filter(([kind])=>kind==="sheet").length,0,"typing never builds the entire sheet in the input handler");
assert.equal(frames.size,1);flush();
assert.deepEqual(calls.filter(([kind])=>kind==="sheet"),[["sheet","first","ABC"]],"three inputs produce one latest preview");
for(const query of ["H","He","Heal"]){cell("rules-search").value=query;cell("rules-search").input()}
assert.equal(frames.size,1);flush();assert.deepEqual(calls.filter(([kind])=>kind==="rules"),[["rules","Heal"]]);
cell("f-name").input({target:{value:"newest"}});evaluate("cancelBuilderPreview()",context);assert.equal(frames.size,0);
assert.equal(context.S.name,"newest","canceling a preview never cancels model edits");
cell("f-name").input({target:{value:"before navigation"}});context.store.mode="play";flush();
assert.equal(calls.filter(([kind])=>kind==="play").length,0,"a queued builder preview does not repeat the newly opened scene render");context.store.mode="build";

// Real upload controller: navigation, out-of-order completion, clear and deletion.
evaluate(events.slice(events.indexOf("const heroMediaEditGenerations="),events.indexOf('$("f-tier").onchange')),context);
const first=context.S,second={id:"second",media:{}};context.store.heroes.push(second);
const upload=kind=>context.uploadHeroMedia({target:{files:[{}],value:"file"}},kind);
let pending=upload("portrait");context.S=second;pendingImages.shift()("portrait:first");await pending;
assert.equal(first.media.portrait,"portrait:first");assert.equal(second.media.portrait,undefined,"changing hero does not retarget an in-flight upload");
context.S=first;
const older=upload("token"),newer=upload("token"),resolveOlder=pendingImages.shift(),resolveNewer=pendingImages.shift();
resolveNewer("token:new");await newer;resolveOlder("token:old");await older;
assert.equal(first.media.token,"token:new","latest selected file wins even when the older decoder finishes last");
pending=upload("portrait");cell("hero-portrait-clear").onclick();pendingImages.shift()("portrait:obsolete");await pending;
assert.equal(first.media.portrait,"");
pending=upload("token");context.store.heroes=[second];context.S=second;pendingImages.shift()("token:deleted");await pending;
assert.equal(first.media.token,"token:new","an upload does not resurrect a deleted hero");

// Camera drawing is passive; only a user preference change schedules a save.
let saves=0;
const cameraCells=new Map(),camera=vm.createContext({$:id=>{if(!cameraCells.has(id))cameraCells.set(id,{style:{setProperty(){}},classList:{remove(){}},removeAttribute(){},setAttribute(){}});return cameraCells.get(id)},
  clamp:(n,min,max)=>Math.max(min,Math.min(max,Number(n))),isEnglishPreview:()=>false,persist:()=>{saves++},
  activeSceneSpace:()=>({width:7,height:7}),store:{mode:"play"},requestAnimationFrame:()=>1});
evaluate("let sceneZoom=70,sceneZoomMode='fit',sceneNeedsInitialFit=true,sceneViewportFitFrame=null;",camera);
evaluate(scene.slice(scene.indexOf("function applySceneZoom("),scene.indexOf("function reconcileLocalSceneFlow(")),camera);
for(let i=0;i<30;i++)camera.applySceneZoom();assert.equal(saves,0,"30 passive scene renders write no camera saves");
camera.applySceneZoom(70,{manual:true});assert.equal(saves,1,"changing only fit mode still persists");
camera.applySceneZoom(80,{manual:true});camera.applySceneZoom(80,{manual:true});assert.equal(saves,2,"unchanged/clamped repeated zoom requests do not save twice");

// Actual normalizers and save payload: heavy templates are normalized once,
// artwork stripping affects only the persisted copy, and pending edits flush on pagehide.
const model=loadHeroModel(),storage=model.context,saved=new Map(),timers=new Map(),lifecycle=new Map();
Object.assign(storage,{store:{heroes:[],current:0,gmLibrary:{enemyVariants:[],encounters:[]},sceneUi:{tokenCounters:{}}},
  localStorage:{setItem:(key,value)=>saved.set(key,value),getItem:key=>saved.get(key)||null},scheduleHeroMediaPersistence(){},Sync:null,
  sceneZoom:70,sceneZoomMode:"manual",sceneControlMode:"manual",sceneInterfaceVersion:"next",SCENE_INTERFACE_ROLLOUT_VERSION:4,
  sceneLeftPanelsEnabled:false,scenePanelLayoutMode:"split",scenePanelSides:{},scenePanelWidths:{},sceneTurnStripVisible:true,sceneInterfaceDensity:"compact",sceneViewportMode:"desktop",
  setTimeout(callback){const id=timers.size+1;timers.set(id,callback);return id},clearTimeout:id=>timers.delete(id),addEventListener:(type,handler)=>lifecycle.set(type,handler)});
evaluate('store.heroes=[S];S.name="latest saved draft";Scene.artworks=[{id:"art",name:"Art",image:"data:image/png;base64,AAAA",imageStored:false}];',storage);
evaluate('store.gmLibrary.encounters=[{id:"preset",name:"Preset",enemies:[{name:"Enemy",kind:"enemy",hp:10,maxHp:10}],templateScene:Scene}];heroMediaStorageReady=true;storedHeroMediaSignatures.set(presetArtworkKey("preset","art"),mediaSignature(Scene.artworks[0].image));',storage);
let normalizations=0;const normalize=storage.normalizeGmLibrary;storage.normalizeGmLibrary=(...args)=>{normalizations++;return normalize(...args)};
evaluate(core.slice(core.indexOf("function persistableStore("),core.indexOf("const allGifts=")),storage);
evaluate("persist();S.runtime.notes='final keystroke';persist()",storage);assert.equal(timers.size,1,"save coalescing is bounded and does not enqueue another heavy traversal");
lifecycle.get("pagehide")();assert.equal(timers.size,0);assert.equal(normalizations,1,"one save traverses the encounter library once instead of twice");
const payload=[...saved.values()].map(value=>JSON.parse(value)).find(value=>value.scene);
assert.equal(payload.heroes[0].runtime.notes,"final keystroke");assert.equal(payload.heroes[0].name,"latest saved draft");
assert.equal(payload.gmLibrary.encounters[0].templateScene.artworks[0].image,"");
assert.equal(storage.store.gmLibrary.encounters[0].templateScene.artworks[0].image,"data:image/png;base64,AAAA","saving leaves live encounter previews intact");
const oldImage=`data:image/png;base64,${"A".repeat(80)}BBBB${"A".repeat(80)}`,newImage=oldImage.replace("BBBB","CCCC");
storage.oldImage=oldImage;storage.newImage=newImage;
evaluate('S.media.token=newImage;storedHeroMediaSignatures.set(heroMediaKey(S.id,"token"),mediaSignature(oldImage));',storage);
const changedHeroes=storage.persistableHeroes();
assert.equal(changedHeroes[0].media.token,newImage,"an equal-length replacement with matching prefix/tail stays in the save until its exact bytes reach IndexedDB");
const writtenImages=[];
storage.openHeroMediaDb=async()=>({transaction(){const tx={objectStore:()=>({put:entry=>writtenImages.push(entry)})};queueMicrotask(()=>tx.oncomplete());return tx}});
await storage.writeHeroMedia([{key:model.run('heroMediaKey(S.id,"token")'),value:newImage}]);
assert.equal(writtenImages.length,1,"the actual media writer stores the changed middle instead of treating matching edges as an acknowledgment");
await storage.writeHeroMedia([{key:model.run('heroMediaKey(S.id,"token")'),value:newImage}]);assert.equal(writtenImages.length,1,"an unchanged acknowledged image still avoids redundant writes");
assert.equal(storage.persistableHeroes()[0].media.token,"","only the confirmed exact image may be omitted from localStorage");

// Compare the real canonical catalog output and resolver workload against the
// previous three-pass display path. No timing claims from a synthetic DOM.
const catalog=loadHeroModel(),catalogCells=new Map();
catalog.context.document.getElementById=id=>{if(!catalogCells.has(id))catalogCells.set(id,{value:"",innerHTML:""});return catalogCells.get(id)};
catalog.run('let activeArch=activeArchetypes()[0].id,techTag="all",techStatus="all",techSort="source";');
const heroUi=read("hero-ui.js"),catalogSource=heroUi.slice(heroUi.indexOf("function renderTechniques(){"),heroUi.indexOf("function selectedOutlookGifts(){"));
let resolutions=0;const resolveStatus=catalog.context.techniqueLevelStatus;
catalog.context.techniqueLevelStatus=(...args)=>{resolutions++;return resolveStatus(...args)};
catalog.context.renderTechniques();const currentMarkup=catalogCells.get("tech-list").innerHTML,currentResolutions=resolutions;
resolutions=0;
evaluate(catalogSource.replace('techniqueStatusSummaryMarkup(t,t.levels,statusRows)','techniqueStatusSummaryMarkup(t)').replace('t.levels.map((l,index)=>{const status=statusRows[index]','t.levels.map(l=>{const status=techniqueLevelStatus(t.id,l.n)'),catalog.context);
catalog.context.renderTechniques();
assert.equal(catalogCells.get("tech-list").innerHTML,currentMarkup,"reusing one render's status rows preserves every canonical card and badge");
assert.equal(resolutions,currentResolutions*3,"status display resolves each level once instead of three times");
evaluate(catalogSource,catalog.context);
catalog.context.techniqueLevelStatus=(id,level)=>({techniqueId:id,level,automation:"full"});catalog.context.renderTechniques();
assert.notEqual(catalogCells.get("tech-list").innerHTML,currentMarkup,"another render uses fresh mutable readiness rather than a stale persistent cache");

// Mode setup plus renderAll renders the active page only once for boot and
// preference changes; ordinary navigation still renders immediately.
const renders=[],modeCells=new Map(),modeContext=vm.createContext({store:{mode:"build"},window:{scrollTo(){}},document:{body:{classList:{toggle(){},remove(){}}}},
  $$:()=>[],$:id=>{if(!modeCells.has(id))modeCells.set(id,{value:""});return modeCells.get(id)},location:{hash:""},
  activeSceneView:()=>"gm",closeAllScenePanels(){},renderWorkspaceNavigation(){},renderChallengeRequestDock(){},persist(){},
  renderPlay:()=>renders.push("play"),renderToolsWorkspace:()=>renders.push("tools"),renderRules:()=>renders.push("rules"),renderReference:()=>renders.push("reference"),
  renderHeroSelect(){},renderSupplementPicker(){},renderProfile(){},renderAttrs(){},renderOutlooks(){},renderBondTraining(){},renderSkillsAbility(){},renderTechniques(){},renderSheet(){},renderSidebar(){}});
evaluate(play.slice(play.indexOf("function renderAll(){"),play.indexOf("function initCollapsibleBuildPanels()")),modeContext);
evaluate(play.slice(play.indexOf("function setMode(")),modeContext);
for(const mode of ["play","tools","rules","reference"]){renders.length=0;modeContext.store.mode=mode;modeContext.setMode(mode,{render:false});modeContext.renderAll();assert.deepEqual(renders,[mode]);renders.length=0;modeContext.setMode(mode);assert.deepEqual(renders,[mode]);}
assert.equal((app.match(/setMode\(store.mode\|\|"build",\{render:false\}\)/g)||[]).length,2,"both actual startup and preference wiring use the single-render route");
// The local player preview retains the authoritative scene in memory, so the
// active-turn header must apply the same visibility rule as the board tokens.
const headerStart=scene.indexOf('const active=Scene.actors.find(actor=>actor.id===Scene.activeActorId&&(view==='),headerEnd=scene.indexOf('$("scene-space-tabs")',headerStart);
assert.ok(headerStart>=0&&headerEnd>headerStart);
const renderHeader=view=>{const label={textContent:""},header=vm.createContext({view,Scene:{activeActorId:"hidden",actors:[{id:"hidden",name:"SECRET NPC",hidden:true}]},$:()=>label});evaluate(scene.split("\n").find(row=>row.trimStart().startsWith("const writeText="))+"\n"+scene.slice(headerStart,headerEnd),header);return label.textContent};
assert.doesNotMatch(renderHeader("player"),/SECRET NPC/);assert.match(renderHeader("gm"),/SECRET NPC/);
console.log(`Shell response: latest drafts, one preview per frame, safe asynchronous media edits, passive camera, one detached library traversal, status resolutions ${currentResolutions*3} → ${currentResolutions} with identical markup, and single-render navigation passed`);
