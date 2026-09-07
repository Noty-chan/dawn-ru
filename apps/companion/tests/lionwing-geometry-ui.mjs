import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../lionwing-ui.js",import.meta.url),"utf8");
const helper=source.slice(source.indexOf("const lwGeometryStopReasons"),source.indexOf("function lwCostsFrom"));
const clickHandler=source.slice(source.indexOf('document.addEventListener("click", event => {'),source.indexOf('document.addEventListener("change",event=>{'));

const classList=()=>({values:new Set(),toggle(name,force){if(force)this.values.add(name);else this.values.delete(name)},add(name){this.values.add(name)},remove(name){this.values.delete(name)},contains(name){return this.values.has(name)}});
const cells=["1,1","2,1","3,1"].map(key=>({dataset:{sceneCell:key},classList:classList()}));
const board={listeners:[],addEventListener(type,handler,options){this.listeners.push({type,handler,options})}};
const document={handlers:{},addEventListener(type,handler){this.handlers[type]=handler},querySelector:()=>null,createElement:()=>({}),querySelectorAll:()=>[]};
const actor=(id,x,y)=>({id,name:id,space:"main",x,y,knockedOut:false});
const scene={rulesEdition:"lionwing",version:1,activeSpace:"main",selectedActor:"mover",targetIds:[],actors:[actor("mover",0,1),actor("other",4,4)]};
const sync={sceneId:"",canNarrate:true,state(){return this}};
let Scene=scene,Sync=sync,commitCount=0,preparedRequests=[],submitted=[],toasts=[],setVmScene=()=>{};
const counters={render:0};
let scenePreviewCells=new Set();
const clone=value=>JSON.parse(JSON.stringify(value));
const routeFor=(request,version=Scene.version)=>({schema:1,sourceActorId:request.actorId,actorId:request.targetId||request.actorId,anchor:{kind:"actor",id:request.actorId,space:"main",x:0,y:1},destination:{space:"main",x:Number(request.destination.x),y:Number(request.destination.y)},mode:request.mode||"move",maximum:Number(request.maximum||2),path:[{space:"main",x:1,y:1},{space:"main",x:2,y:1}],spent:2,stoppedAt:{space:"main",x:2,y:1},remaining:0,terminal:Boolean(request.terminal),stopReason:request.stopReason||null,partial:false,sceneVersion:Number(version),geometryStamp:`stamp:${version}`});
const engine={
  isScene:()=>true,
  prepare(_scene,request){
    preparedRequests.push(clone(request));
    const route=routeFor(request);
    return {ok:true,scene:clone(Scene),events:[{type:"lionwing.command",actorId:request.actorId,payload:{...clone(request),geometryPlan:{schema:1,kind:"lionwing.geometry.route",request:clone(request),route}}}]};
  },
  previewEvents(_scene,events){
    const route=events[0]?.payload?.geometryPlan?.route;
    if(Number(route?.sceneVersion)!==Number(Scene.version))return {ok:false,errors:["Геометрический план устарел."],code:"LIONWING_GEOMETRY_STALE"};
    return {ok:true,scene:clone(Scene),events};
  },
  targetIds:(_scene,ids)=>[...new Set(ids)],
  effectInstanceStatus:()=>({sources:[]}),
};
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const localizedLionwingCoreRules=()=>({effects:{positive:[],negative:[]}});
const currentHeroActor=()=>Scene.actors[0];
function toast(message){toasts.push(String(message));return null}
function renderScene(){counters.render+=1}
function commitSceneEvents(){commitCount+=1;Scene={...clone(Scene),version:Number(Scene.version||0)+1};setVmScene(Scene);return {scene:clone(Scene)}}
function lwSubmit(actorId,payload,label){submitted.push({actorId,payload:clone(payload),label});return true}
function $(id){return id==="scene-board"?board:null}
function $$(selector){return selector==='[data-scene-cell]'?cells:[]}
function makeRoot(actorId="mover"){return{dataset:{lwActor:actorId},querySelector:()=>null,closest:()=>null}}
function makeButton(attrs={},root=makeRoot(attrs["data-lw-actor"]||"mover")){
  const dataset={};
  for(const [key,value] of Object.entries(attrs))if(key.startsWith("data-")){const dataKey=key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());dataset[dataKey]=String(value)}
  return {dataset,hasAttribute:name=>Object.hasOwn(attrs,name),closest(selector){
    if(selector.includes("[data-lw-root]")||selector.includes(".lw-console"))return root;
    for(const name of Object.keys(attrs))if(selector.includes(`[${name}]`))return this;
    return null;
  },querySelector:()=>null};
}
function fireClick(button){document.handlers.click({target:button,preventDefault(){},stopImmediatePropagation(){}})}

const context={window:{DAWN_LIONWING_ENGINE:engine},document,console,structuredClone:clone,Scene,Sync,scenePreviewCells,SceneEngine:{},localizedLionwingCoreRules, currentHeroActor, toast, renderScene, commitSceneEvents, lwSubmit, $, $$, esc,counters,queueMicrotask,setTimeout};
vm.createContext(context);
vm.runInContext(`let Scene=this.Scene,Sync=this.Sync,scenePreviewCells=this.scenePreviewCells;const LionwingEngine=window.DAWN_LIONWING_ENGINE;const lwActive=()=>LionwingEngine.isScene(Scene),lwCanNarrate=()=>!Sync?.state?.().sceneId||Sync.state().canNarrate,lwOwns=actorId=>lwCanNarrate()||currentHeroActor()?.id===actorId;${helper}\n${clickHandler}\nthis.ui={setPreview:lwSetGeometryPreview,previewHtml:lwGeometryPreviewHtml,reconcile:lwReconcileGeometryPreview,installGuard:lwInstallGeometryPreviewGuard,clear:lwClearGeometryPreview,getPreview:()=>lwGeometryPreview,getDestination:()=>lwDestination,getCells:()=>Array.from(scenePreviewCells),getRenderCount:()=>this.counters.render};this.setScene=value=>{Scene=value};this.setSync=value=>{Sync=value};`,context,{filename:"lionwing-ui-behavior-harness.js"});
const ui=context.ui;
setVmScene=value=>context.setScene(value);
const replaceScene=(patch={})=>{Scene={...clone(Scene),...patch};setVmScene(Scene);return Scene};
const resetScene=(patch={})=>replaceScene({version:1,activeSpace:"main",selectedActor:"mover",targetIds:[],...patch});

const movement={kind:"geometry-move",targetId:"mover",destination:{space:"main",x:2,y:1},maximum:2};
const before=JSON.stringify(Scene);
assert.equal(ui.setPreview({actorId:"mover",label:"Движение правила"},movement),true,"a route preview can be prepared");
assert.match(ui.previewHtml(),/Подтвердить движение/);
assert.equal(JSON.stringify(Scene),before,"preview does not mutate the Scene");
const cancelBefore=JSON.stringify(Scene),renderBefore=ui.getRenderCount();
fireClick(makeButton({"data-lw-geometry-cancel":"","data-lw-actor":"mover"}));
assert.equal(ui.getPreview(),null,"cancel clears the pending route");
assert.deepEqual(JSON.parse(JSON.stringify(Scene)),JSON.parse(cancelBefore),"cancel leaves scene state unchanged");
assert.equal(ui.getCells().length,0,"cancel clears only the route highlight");
assert.ok(ui.getRenderCount()>renderBefore,"cancel refreshes the visible panel");

resetScene();toasts=[];commitCount=0;
ui.setPreview({actorId:"mover",label:"Движение правила"},movement);
fireClick(makeButton({"data-lw-geometry-confirm":"","data-lw-actor":"mover"}));
assert.equal(commitCount,1,"a fresh preview confirms through the shared command boundary");
assert.equal(ui.getPreview(),null,"successful confirmation removes the preview");

submitted=[];resetScene();ui.setPreview({actorId:"mover",label:"Движение правила",stage:true},movement);
const stagedBefore=JSON.stringify(Scene);
fireClick(makeButton({"data-lw-geometry-add":"","data-lw-actor":"mover"}));
assert.equal(submitted.length,1,"staging uses the package submission path");
assert.equal(submitted[0].payload.kind,"geometry-move");
assert.ok(submitted[0].payload.geometryPlan,"the package keeps the verified route");
assert.equal(JSON.stringify(Scene),stagedBefore,"adding a route to a package does not move the actor");
assert.equal(ui.getPreview(),null,"adding a route closes its temporary preview");

commitCount=0;toasts=[];resetScene();ui.setPreview({actorId:"mover",label:"Движение правила"},movement);
commitSceneEvents("Внешнее изменение",[]);
const staleCommitBaseline=commitCount;
fireClick(makeButton({"data-lw-geometry-confirm":"","data-lw-actor":"mover"}));
assert.equal(commitCount,staleCommitBaseline,"a stale preview is rejected before commit");
assert.ok(toasts.some(message=>/пересчитан|обновлённый маршрут/.test(message)),"stale rejection explains that the route was refreshed");
assert.match(ui.previewHtml(),/пересчитан|обновлённый маршрут/);
assert.doesNotMatch(ui.previewHtml(),/difficult-terrain/,"the preview never exposes raw stop reason identifiers");
fireClick(makeButton({"data-lw-geometry-confirm":"","data-lw-actor":"mover"}));
assert.equal(commitCount,staleCommitBaseline+1,"the refreshed route requires and accepts a second confirmation");

resetScene();toasts=[];ui.setPreview({actorId:"mover",label:"Движение правила"},{...movement,terminal:true,stopReason:"difficult-terrain"});
assert.match(ui.previewHtml(),/вход в Трудную местность завершает движение/,"terminal terrain has a readable Russian explanation");
assert.doesNotMatch(ui.previewHtml(),/difficult-terrain/);

resetScene();const staleSelectionBefore=JSON.stringify(Scene);ui.setPreview({actorId:"mover",label:"Движение правила"},movement);replaceScene({selectedActor:"other"});fireClick(makeButton({"data-lw-geometry-confirm":"","data-lw-actor":"mover"}));assert.equal(ui.getPreview(),null,"changing the selected participant clears the old route before confirmation");assert.equal(JSON.stringify(Scene),JSON.stringify({...JSON.parse(staleSelectionBefore),selectedActor:"other"}),"clearing a route on a new selection is state free");
replaceScene({selectedActor:"mover"});ui.setPreview({actorId:"mover",label:"Движение правила"},movement);replaceScene({activeSpace:"side"});ui.reconcile();assert.equal(ui.getPreview(),null,"changing spaces clears the old route");replaceScene({activeSpace:"main"});

resetScene();ui.setPreview({actorId:"mover",label:"Движение правила"},movement);replaceScene({name:"Новая сцена"});ui.reconcile();assert.equal(ui.getPreview(),null,"replacing the Scene clears a route from the previous Scene");

resetScene({name:""});commitCount=0;context.setSync({sceneId:"shared",canNarrate:false,state(){return this}});ui.setPreview({actorId:"mover",label:"Движение правила"},movement);const roleBefore=JSON.stringify(Scene);fireClick(makeButton({"data-lw-geometry-confirm":"","data-lw-actor":"mover"}));assert.equal(commitCount,0,"the role check blocks a player before commit");assert.equal(JSON.stringify(Scene),roleBefore,"a player cannot mutate the Scene by confirming geometry");assert.ok(toasts.some(message=>/только Нарратор/.test(message)),"the confirmation explains the Narrator-only role");assert.ok(ui.getPreview(),"a denied confirmation leaves the preview available");
fireClick(makeButton({"data-lw-geometry-cancel":"","data-lw-actor":"mover"}));assert.equal(ui.getPreview(),null,"a player can safely dismiss a stale local preview");assert.equal(JSON.stringify(Scene),roleBefore,"dismissing the preview still leaves Scene state unchanged");
context.setSync(sync);ui.clear();

ui.setPreview({actorId:"mover",label:"Движение правила"},movement);ui.installGuard();const guard=board.listeners.find(item=>item.type==="mouseleave"&&item.options===true);assert.ok(guard,"the geometry preview installs a capture listener for the legacy mouseleave handler");scenePreviewCells.clear();let stopped=false;guard.handler({stopImmediatePropagation(){stopped=true}});await new Promise(resolve=>queueMicrotask(resolve));assert.equal(stopped,false,"the capture listener leaves the legacy handler free to run");assert.equal(JSON.stringify(ui.getCells()),JSON.stringify(["1,1","2,1"]),"leaving the board keeps the path highlighted");

console.log("LionWing geometry UI behavior passed: success, cancel, package staging, stale refresh, role check, selection reset, terminal reason and mouseleave highlight");
