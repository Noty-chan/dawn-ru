import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import {runtime,fixture,actor,clone} from './helpers/scene-contract-harness.mjs';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const ui=read('scene-ui.js'),lw=read('lionwing-ui.js');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;');
class Element{
  constructor(id='',dataset={}){this.id=id;this.dataset=dataset;this.innerHTML='';this.scrollTop=0;this.scrollLeft=0;this.classes=new Set();this.children=[];this.style={setProperty(){},removeProperty(){}};this.classList={contains:name=>this.classes.has(name),add:name=>this.classes.add(name),remove:(...names)=>names.forEach(name=>this.classes.delete(name)),toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)}}
  append(child){child.parentElement=this}
  setAttribute(){}
  querySelector(){return null}
  querySelectorAll(){return[]}
  addEventListener(type,callback){this.handlers??=new Map();this.handlers.set(type,callback)}
  closest(){return null}
  focus(){this.focused=true}
}
class Details extends Element{}
function environment({next=true,mobile=false}={}){
  const {context,core,engine}=runtime(),nodes=new Map(),panels=new Map(),calls={};let view='gm',viewport=mobile?'phone':'desktop';
  const sync={sceneId:'room-a',campaignId:'campaign-a',userId:'user-a',role:'owner',canNarrate:true};
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)};
  for(const id of ['director','sheet','utility','reference','entities','add','inspector','log','network']){
    const panel=new Element('',{scenePanelContent:id});if(['director','entities','add'].includes(id))panel.classes.add('gm-only');panels.set(id,panel);
  }
  const document={body:new Element(),activeElement:null,addEventListener(){},querySelector:selector=>panels.get(selector.match(/data-scene-panel-content="([^"]+)"/)?.[1])||null};
  const leaf=(name,id)=>()=>{calls[name]=(calls[name]||0)+1;get(id).innerHTML=`${name}:${context.Scene.actors[0].name}:${context.Scene.actors[0].hp}:${view}`};
  Object.assign(context,{document,Scene:fixture(),SceneEngine:engine,LionwingEngine:core,Sync:{state:()=>sync},S:{id:'hero'},store:{mode:'play'},esc,
    $:get,$$:selector=>selector==='[data-scene-panel-content]'?[...panels.values()]:[],HTMLElement:Element,HTMLDetailsElement:Details,
    activeSceneView:()=>view,sceneViewportProfile:()=>viewport,requestAnimationFrame:callback=>callback(),
    renderSceneDirector:leaf('director','scene-director'),renderSceneHeroSheet:leaf('sheet','play-kit'),renderSceneUtility:leaf('utility','scene-utility'),
    renderSceneReference:leaf('reference','scene-reference-list'),renderLionwingEntities:leaf('entities','scene-entities'),
    renderEnemySelect:leaf('enemySelect','scene-enemy-select'),renderGmLibraries:leaf('library','gm-enemy-library'),renderCompoundBuilder:leaf('compound','scene-compound-parts'),
    renderSceneChrome(){calls.chrome=(calls.chrome||0)+1},setSheetTab(){},lwOwns:()=>true,
  });
  vm.runInContext(`let activeScenePanel=null,activeScenePanels={left:null,right:null},scenePanelTrigger=null,sceneInterfaceVersion=${JSON.stringify(next?'next':'classic')},sceneLeftPanelsEnabled=true,scenePanelLayoutMode='split',sceneInterfaceDensity='compact',activeSheetTab='combat';const scenePanelWidths={left:'medium',right:'medium'},SCENE_PANEL_WIDTHS={medium:340},DEFAULT_SCENE_PANEL_SIDES={director:'left',reference:'left',entities:'left',add:'right',sheet:'right',utility:'right',inspector:'right',log:'right'},scenePanelSides={...DEFAULT_SCENE_PANEL_SIDES};`,context);
  vm.runInContext(section(lw,'const lwTechniqueText =','const lwTechniqueEnabled ='),context);
  vm.runInContext(section(lw,'const lwFormDraft =','let lwDraftEnabled='),context);
  vm.runInContext(section(ui,'function usingNextSceneInterface()','function sceneTurnApprovalMode()'),context);
  vm.runInContext(section(read('play-ui.js'),'function renderSync(){','  const sync=Sync.state()')+'}',context);
  const run=code=>vm.runInContext(code,context),refresh=()=>run('{const savedPass=scenePanelRenderPass;scenePanelRenderPass=true;try{setScenePanel(activeScenePanel);renderOpenScenePanels()}finally{scenePanelRenderPass=savedPass}}');
  return{context,core,engine,get,panels,calls,sync,run,refresh,view(value){view=value},viewport(value){viewport=value}};
}

for(const next of [false,true])for(const mobile of [false,true]){
  const test=environment({next,mobile});test.refresh();assert.equal(Object.keys(test.calls).length,0,'closed panels do no renderer work');
  test.context.setScenePanel('director');assert.equal(test.calls.director,1,'first open paints current state once');
  test.context.setScenePanel('director',true);const hiddenMarkup=test.get('scene-director').innerHTML;
  test.context.Scene.actors[0].hp=12;test.context.Scene.actors[0].name='Current actor';test.refresh();
  assert.equal(test.get('scene-director').innerHTML,hiddenMarkup,'closed canonical refresh does not replace draft DOM');assert.equal(test.calls.director,1);
  test.context.setScenePanel('director');assert.equal(test.calls.director,2);assert.match(test.get('scene-director').innerHTML,/Current actor:12/,'reopening sees same-object canonical changes without relying on version');
  const before=test.calls.director;test.refresh();assert.equal(test.calls.director,before+1,'canonical refresh paints the open director once, despite calling setScenePanel');
  test.context.setScenePanel('sheet');assert.equal(test.calls.sheet,1);
  const openDirector=next&&!mobile;assert.equal(test.run('isScenePanelOpen("director")'),openDirector,'classic/mobile use one panel; desktop next preserves split panels');
  const priorDirector=test.calls.director;test.context.setScenePanel('utility');assert.equal(test.calls.director,priorDirector,'opening another panel does not repaint the existing split panel');assert.equal(test.calls.utility,1);
  test.context.setScenePanel('entities');assert.equal(test.calls.entities,1,'registry has its own opening path');assert.equal(test.calls.director,priorDirector,'registry opening does not build the director');
  test.context.setScenePanel('add');assert.equal(test.calls.library,1);assert.equal(test.calls.compound,1);assert.equal(test.calls.enemySelect,1);
  test.run('closeAllScenePanels()');const counters={...test.calls};test.refresh();assert.deepEqual(test.calls,counters,'all heavy panels stay idle when closed');
  test.get('scene-director').innerHTML='PRIVATE_ACTOR';test.get('scene-entities').innerHTML='PRIVATE_ENTITY';test.get('scene-reference-list').sceneReferenceMarkup='PRIVATE_REFERENCE';test.get('scene-reference-list').sceneReferenceCards=new Map([['private','PRIVATE']]);
  test.run('lwFormDraft.set(JSON.stringify(["scope","hero","panel","note","",0,null]),"PRIVATE_DRAFT")');
  test.view('player');test.sync.role='player';test.sync.canNarrate=false;test.context.renderSync();
  assert.equal(test.get('scene-director').innerHTML,'');assert.equal(test.get('scene-entities').innerHTML,'');assert.equal(test.run('lwFormDraft.size'),0);
  assert.equal(test.get('scene-reference-list').sceneReferenceMarkup,undefined);assert.equal(test.get('scene-reference-list').sceneReferenceCards,undefined,'private reference caches are discarded with DOM');
  test.context.setScenePanel('director');assert.equal(test.run('isScenePanelOpen("director")'),false);assert.equal(test.calls.director,counters.director,'Player cannot trigger hidden Director work');
  test.context.setScenePanel('sheet');assert.match(test.get('play-kit').innerHTML,/player/);
  test.context.setScenePanel('reference');assert.match(test.get('scene-reference-list').innerHTML,/player/,'reference reopens after its cache and private content were discarded');
  test.sync.sceneId='room-b';test.context.reconcileScenePanelPrivacy();assert.equal(test.get('play-kit').innerHTML,'','room changes discard retained content immediately');
  test.context.Scene.id='different-local-scene';test.get('scene-utility').innerHTML='OLD_LOCAL';test.context.reconcileScenePanelPrivacy();assert.equal(test.get('scene-utility').innerHTML,'');
  test.context.Scene.tablePolicy={mode:'manual',epoch:1};test.context.renderOpenScenePanels();assert.equal(test.get('play-kit').innerHTML,'','manual policy does not build the hidden automatic sheet');
}

// Actual capture/restore helpers preserve same-actor notes/caret while the
// panel is idle. Its canonical counter defaults still refresh on reopening.
const kept=environment(),root=kept.get('scene-director'),owner={dataset:{lwActor:'hero'},className:'lw-actions',closest:()=>null,querySelectorAll:()=>root.controls};
function field(name,value,pending=null){return{attributes:[{name:`data-lw-${name}`,value:''}],dataset:{},tagName:'INPUT',type:'text',id:'',name:'',defaultValue:String(value),value:String(value),disabled:false,readOnly:false,selectionStart:0,selectionEnd:0,selectionDirection:'none',closest:selector=>selector==='[data-lw-root]'?owner:selector==='[data-lw-pending-window]'?pending:null,focus(){kept.context.document.activeElement=this},setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction}}}
root.controls=[];root.querySelectorAll=selector=>selector==='details'?[]:selector==='[data-lw-root]'?[owner]:root.controls;
kept.context.renderSceneDirector=()=>{
  const scope=kept.context.lwCockpitUiScope('hero'),state=kept.context.lwCaptureDirectorUi(root,scope);root.controls=[field('general-note',''),field('correct-value',kept.context.Scene.actors[0].hp)];root.dataset.lwCockpitScope=scope;
  if(kept.context.Scene.lionwing?.choices?.length)root.controls.push(field('choice-note','',{dataset:{lwPendingWindow:kept.context.lwPendingWindowKey()}}));
  kept.context.lwRestoreFormDrafts(root,{refreshActions:false});kept.context.lwRestoreDirectorUi(root,state);
};
kept.context.lwRefreshPendingControls=()=>{};kept.context.lwRefreshCunningActions=()=>{};
kept.context.setScenePanel('director');root.controls[0].value='Keep this note';root.controls[0].focus();root.controls[0].setSelectionRange(2,6,'backward');
kept.context.renderOpenScenePanels();assert.equal(root.controls[0].value,'Keep this note');assert.equal(kept.context.document.activeElement,root.controls[0]);
kept.context.setScenePanel('director',true);const retained=root.controls[0];kept.context.Scene.actors[0].hp=9;kept.refresh();assert.equal(root.controls[0],retained,'closed panel does not remove the focused draft control');
kept.context.setScenePanel('director');assert.equal(root.controls[0].value,'Keep this note');assert.equal(root.controls[1].value,'9','untouched canonical values refresh');assert.deepEqual([root.controls[0].selectionStart,root.controls[0].selectionEnd,root.controls[0].selectionDirection],[2,6,'backward']);
let commandSerial=0;const commit=payload=>{const prepared=kept.core.prepare(kept.context.Scene,{...payload,actorId:'hero',eventId:`lazy-window:${++commandSerial}`});assert.equal(prepared.ok,true,prepared.errors?.join(' '));kept.context.Scene=kept.core.dispatchMany(kept.context.Scene,prepared.events).scene};
commit({kind:'prompt',title:'First decision'});kept.context.setScenePanel('director');root.controls[2].value='Pending draft';root.controls[2].focus();
kept.context.setScenePanel('director',true);kept.context.Scene.actors[0].hp=8;kept.refresh();kept.context.setScenePanel('director');assert.equal(root.controls[2].value,'Pending draft','reopening the same canonical decision preserves its note');
kept.context.setScenePanel('director',true);commit({kind:'choice',id:kept.context.Scene.lionwing.choices[0].id,choice:'record',note:'Recorded'});commit({kind:'prompt',title:'Next decision'});kept.refresh();kept.context.setScenePanel('director');assert.equal(root.controls[2].value,'','a new canonical window while closed discards the old decision note');assert.equal(root.controls[0].value,'Keep this note','unrelated cockpit draft survives a closed pending-window transition');

// Geometry remains board work when the Director is closed. The actual common
// hook reconciles a full core route before painting rather than depending on
// construction of an invisible panel to refresh it.
const moving=environment();Object.assign(moving.context,{scenePreviewCells:new Set(),toast(){},renderScene(){},currentHeroActor:()=>moving.context.Scene.actors[0],lwActive:()=>true});
moving.run('let lwDestination=null,lwGeometryPreview=null,lwTechniqueDraft=null;');
vm.runInContext(section(lw,'function lwTechniqueDraftSceneKey(','function lwTechniqueDraftHtml(')+section(lw,'const lwGeometryStopReasons=','function lwCostsFrom('),moving.context);
moving.context.reconcileScenePanelPrivacy();
assert.equal(moving.context.lwSetGeometryPreview({actorId:'hero',label:'Move'},{kind:'geometry-move',targetId:'hero',maximum:3,destination:{space:'main',x:2,y:1}},{render:false}),true);
const oldRoute=moving.run('lwGeometryPreview');moving.context.Scene.actors[0].focus=1;moving.context.reconcileSceneBoardDrafts();
assert.notEqual(moving.run('lwGeometryPreview'),oldRoute,'closed Director does not suppress same-object route revalidation');
assert.ok(moving.get('scene-board').handlers.has('mouseleave'),'the board route guard is installed without opening Director');
moving.context.Scene.topology.cuts=[{id:'cut',space:'main',cells:['2,1']}];moving.context.reconcileSceneBoardDrafts();assert.equal(moving.run('lwGeometryPreview'),null);assert.equal(moving.context.scenePreviewCells.size,0);
moving.context.Scene.topology.cuts=[];moving.context.lwSetGeometryPreview({actorId:'hero',label:'Move'},{kind:'geometry-move',targetId:'hero',maximum:3,destination:{space:'main',x:2,y:1}},{render:false});
let cancellations=0;moving.context.window.DAWN_SCENE_DESTINATION_HIGHLIGHTS={cancel:()=>cancellations++};
moving.view('player');moving.sync.role='player';moving.sync.canNarrate=false;moving.context.renderSync();assert.equal(moving.run('lwGeometryPreview'),null);assert.equal(moving.context.scenePreviewCells.size,0);assert.equal(cancellations,1,'role loss cancels queued board work before any next render');
moving.view('gm');moving.sync.role='owner';moving.sync.canNarrate=true;moving.context.renderSync();assert.equal(cancellations,2,'a role roundtrip cannot restore an old private job');

// Benchmark invokes the production action renderer and canonical quotes inside
// a closed Director, comparing the old unconditional panel pass with the lazy
// pass. Other panel renderers remain inexpensive fixtures; browser paint is
// measured independently by native acceptance.
if(process.argv.includes('--benchmark')){
  const rows=[];
  for(const lazy of [false,true]){
    const test=environment();test.context.Scene.actors.push(...Array.from({length:18},(_,i)=>actor(`npc-${i}`,'enemy',i%8,2+Math.floor(i/8))));
    test.context.Scene.artworks=[{image:'A'.repeat(100000)}];const saved=clone(test.context.Scene);test.context.Scene.undo=Array.from({length:20},()=>({state:saved}));test.context.Scene.turnUndo=Array.from({length:10},()=>({state:saved}));
    Object.assign(test.context,{lwRules:()=>test.context.window.DAWN_LIONWING_DATA.coreRules,lwActive:()=>true,lwCanNarrate:()=>true,lwOwns:()=>true,lwEntityViewer:()=>({role:'narrator',actorIds:['hero']}),lwPendingCommandReason:()=>'',lwRestoredControls:()=>({})});
    vm.runInContext('let lwDestination=null,lwGeometryPreview=null,lwDetectiveTeleport=null,lwTechniqueDraft=null;'+section(lw,'const lwTechniqueEnabled =','const lwRules ='),test.context);
    vm.runInContext(read('lionwing-technique-surface.js'),test.context);
    for(const name of ['lwStatusHtml','lwPendingHtml','lwDiceHtml','lwChainHtml','lwConsequenceHistoryHtml','lwInventoryHtml','lwAutomationHtml','lwMasterControls'])test.context[name]=()=>'';
    vm.runInContext(section(lw,'function lwActionsHtml(','function lwEffectSourcesHtml('),test.context);
    let renders=0;test.context.renderSceneDirector=()=>{renders++;test.get('scene-director').innerHTML=test.context.lwActionsHtml(test.context.Scene.actors[0])};
    const start=performance.now();for(let i=0;i<8;i++)lazy?test.refresh():test.context.renderSceneDirector();
    rows.push({mode:lazy?'lazy closed panel':'prior unconditional panel',passes:8,actualActionRendererCalls:renders,ms:+(performance.now()-start).toFixed(2)});
  }
  assert.equal(rows[1].actualActionRendererCalls,0);console.log(JSON.stringify({workload:'actual lwActionsHtml/core presentation quotes; 20 actors,100KBart,20undo/10turn snapshots; closed Director,DOM paint excluded',rows}));
}
console.log('Scene lazy panels: real classic/next controller, desktop/mobile, first/reopen/current canonical paints, single refresh, independent split panels, scoped privacy/cache clearing, manual policy and retained drafts/caret passed (DOM fixture).');
