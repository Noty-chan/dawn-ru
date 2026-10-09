import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8").replaceAll("\r\n","\n");
const events=read("app-scene-events.js"),ui=read("scene-ui.js"),effects=read("scene-effects.js"),lionwing=read("lionwing-ui.js");
const section=(source,start,end)=>{
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,`actual controller section exists: ${start}`);
  return source.slice(from,to);
};
const line=(source,start)=>{
  const result=source.split("\n").find(value=>value.startsWith(start));
  assert.ok(result,`actual controller exists: ${start}`);return result;
};
const plain=value=>JSON.parse(JSON.stringify(value));
let role="gm",openDialog=null,renders=0,cancellations=0;
const handlers=new Map(),keyboard=[],messages=[];
const elements=new Map();
const element=id=>{
  if(!elements.has(id))elements.set(id,{id,hidden:true,addEventListener(type,handler){handlers.set(`${id}:${type}`,handler);}});
  return elements.get(id);
};
const context={
  console,performance:{now:()=>1000},HTMLElement:class {},requestAnimationFrame:()=>{},
  document:{activeElement:null,querySelector:selector=>selector==="dialog[open]"?openDialog:null,
    addEventListener(type,handler,capture=false){if(type==="keydown")keyboard.push({handler,capture});}},
   $:element,sceneViewportProfile:()=>"desktop",activeSceneView:()=>role,canControlScenePrompt:()=>false,
  syncScenePanels:()=>{},persist:()=>{},renderScene:()=>{renders++;},toast:text=>messages.push(text),
  focusSceneActorOnBoard:()=>{},SceneEngine:{},window:{},S:{id:"owned-hero"},
  isEnglishPreview:()=>false,lwActive:()=>true,cancelSceneFlow:()=>{cancellations++;},
};
vm.createContext(context);
const run=code=>vm.runInContext(code,context),load=code=>vm.runInContext(code,context,{filename:"actual Scene pointer/keyboard controller"});
run(`let store={mode:"play"},Scene,sceneInterfaceVersion="next",sceneLeftPanelsEnabled=true,scenePanelLayoutMode="split";
  let activeScenePanel=null,activeScenePanels={left:null,right:null},scenePanelTrigger=null;
  const DEFAULT_SCENE_PANEL_SIDES={director:"left",inspector:"right",map:"right"},scenePanelSides={};
  let playerSceneTool="select",sceneSuppressBoardClickUntil=0,sceneContextTarget=null,sceneSpaceHeld=false,scenePanState=null;
  let activeModifierActionId=null,activeModifierPickerId=null,pendingZealotPlan=null,pendingEnemyStepActorId=null,pendingEnemyRule=null;
  let pendingTechniqueRule=null,pendingCoreReaction=null,pendingCoreAction=null,pendingCoreActionPlan=false,pendingCoreActionContext=null;
  let lwDestination=null,lwTechniqueDraft=null,sceneNeutralTool=null,sceneMeasureEnd=null,sceneMeasureStart=null,sceneMeasureLabel="",hoveredSceneActorId=null;
  const scenePreviewCells=new Set(),sceneTopologyCells=new Set();let sceneMeasureCells=new Set();`);
for(const name of ["activeSceneTool","canControlSceneActor","playerCanRepositionSceneActor","sceneHasLocalPendingSelection","measurementPath","usingNextSceneInterface","scenePanelSide","isScenePanelOpen"])load(line(ui,`function ${name}(`));
load(section(ui,"function moveSceneActorFromBoard(","\nfunction measurementPath("));
load(section(ui,"function setScenePanel(","\nfunction closeAllScenePanels("));
load(section(ui,"function hideSceneContextMenu(","\nfunction showSceneContextMenu("));
load(section(effects,"function clearSceneMeasurement(","\nfunction cancelCommittedAction("));
load(section(events,'$("scene-board").addEventListener("click",event=>{','$("scene-board").addEventListener("dragstart"'));
load(line(events,'$("scene-turn-strip").addEventListener("click"'));
load(line(events,'$("scene-workbench").addEventListener("click",event=>{const close='));
load(section(events,'$("scene-context-menu").addEventListener("click",','document.addEventListener("pointerdown",event=>{if(!event.target.closest?.("#scene-context-menu"))'));
load(section(events,'document.addEventListener("keydown",event=>{\n  if(event.key!=="Escape"','\n},true);')+'\n},true);');
load(line(events,'document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!event.defaultPrevented'));
load(line(events,'document.addEventListener("keydown",event=>{if(event.key==="Escape"){'));
load(line(events,'document.addEventListener("keydown",event=>{if(event.key.toLowerCase()!=="w"'));
load(line(events,'document.addEventListener("keydown",event=>{if(event.key.toLowerCase()==="m"'));
load(lionwing.slice(lionwing.lastIndexOf('document.addEventListener("keydown", event => {')));
context.lwCancelDestination=()=>run("lwDestination=null");

const fixture=()=>({id:"table",rulesEdition:"lionwing",view:role,version:7,activeActorId:"hero",activeSpace:"main",selectedActor:"hero",targetIds:["enemy"],targetCells:["5,4"],
  actors:[{id:"hero",heroId:"owned-hero",name:"Герой",team:"hero",space:"main",x:1,y:1,ap:8},{id:"enemy",name:"Враг",team:"enemy",space:"main",x:3,y:2,ap:3}],
  markers:[],walls:[],spaces:[{id:"main",width:8,height:6}],lionwing:{choices:[]}});
const reset=(view="gm",interfaceVersion="next")=>{
  role=view;openDialog=null;renders=0;cancellations=0;messages.length=0;
  context.nextScene=fixture();context.nextInterface=interfaceVersion;
  run(`Scene=nextScene;store.mode="play";sceneInterfaceVersion=nextInterface;scenePanelLayoutMode="split";
    activeScenePanels={left:"director",right:"inspector"};activeScenePanel="director";playerSceneTool="select";Scene.tool="select";
    pendingCoreAction=null;pendingCoreActionPlan=false;pendingCoreActionContext=null;pendingCoreReaction=null;
    pendingTechniqueRule=null;pendingEnemyRule=null;pendingEnemyStepActorId=null;pendingZealotPlan=null;
    lwTechniqueDraft=null;lwDestination=null;sceneContextTarget=null;sceneNeutralTool=null;sceneMeasureEnd=null;sceneMeasureStart=null;sceneMeasureLabel="";
    scenePreviewCells.clear();sceneTopologyCells.clear();sceneMeasureCells.clear();`);
  element("scene-context-menu").hidden=true;
};
const targets=()=>plain(run("({actorIds:Scene.targetIds,cells:Scene.targetCells})"));
const resources=()=>run("JSON.stringify({version:Scene.version,activeActorId:Scene.activeActorId,ap:Scene.actors.map(actor=>actor.ap),choices:Scene.lionwing.choices,pending:Scene.pendingAction,prompt:Scene.pendingPrompt})");
const clickBoard=(actorId=null,cellKey="6,5",shiftKey=false)=>{
  const actor=run("Scene.actors").find(item=>item.id===actorId);
  const cell={dataset:{sceneCell:actor?`${actor.x},${actor.y}`:cellKey}};
  const token=actor?{dataset:{sceneActor:actor.id}}:null;
  const target={closest:selector=>selector==="[data-scene-cell]"?cell:selector==="[data-scene-actor]"?token:null};
  handlers.get("scene-board:click")({target,shiftKey,preventDefault(){}});
};
const clickStrip=actorId=>handlers.get("scene-turn-strip:click")({target:{closest:selector=>selector==="[data-scene-turn-actor]"?{dataset:{sceneTurnActor:actorId}}:null}});
const clickContext=(action,cell="1,2")=>{
  context.contextPoint=cell;run("sceneContextTarget={actorId:null,markerId:null,cell:contextPoint}");
  element("scene-context-menu").hidden=false;
  handlers.get("scene-context-menu:click")({target:{closest:selector=>selector==="[data-scene-context-action]"?{dataset:{sceneContextAction:action}}:null}});
};
const escape=()=>{
  const event={key:"Escape",defaultPrevented:false,stopped:false,target:{closest:()=>null,matches:()=>false},
    preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
  for(const capture of [true,false])for(const row of keyboard){if(Boolean(row.capture)!==capture||event.stopped)continue;row.handler(event);}
  return event;
};

// Deselecting inspection never closes the independent cockpit or another panel.
for(const interfaceVersion of ["next","classic"]){
  for(const token of [true,false]){
    reset("gm",interfaceVersion);const beforeTargets=targets(),beforeResources=resources();
    if(interfaceVersion==="classic")run('activeScenePanel="director"');
    clickBoard(token?"hero":null);
    assert.equal(run("Scene.selectedActor"),null);
    assert.equal(run("isScenePanelOpen('director')"),true,`${interfaceVersion}: deselection retains the cockpit`);
    if(interfaceVersion==="next")assert.equal(run("isScenePanelOpen('inspector')"),false,"only the open Info panel closes");
    assert.deepEqual(targets(),beforeTargets);assert.equal(resources(),beforeResources);
  }
}
reset();run('activeScenePanels.right="map"');clickBoard();
assert.deepEqual(plain(run("activeScenePanels")),{left:"director",right:"map"},"an unrelated right panel survives an empty-cell click");
reset();run('Scene.tool="place"');const beforePlacement=resources();clickBoard("enemy");
assert.deepEqual(targets(),{actorIds:[],cells:[]},"choosing a different manual placement actor clears destinations from the previous actor");
assert.equal(resources(),beforePlacement,"selecting a placement actor does not spend actions or move it");
reset("gm","classic");run('activeScenePanel="inspector"');clickBoard("hero");
assert.equal(run("activeScenePanel"),null,"classic Info still closes on deselection");
for(const pointer of [clickBoard,clickStrip])for(const view of ["gm","player"]){
  reset(view);const beforeTargets=targets(),beforeResources=resources();pointer("enemy");
  assert.equal(run("Scene.selectedActor"),"enemy");assert.deepEqual(targets(),beforeTargets,"ordinary inspection retains actor and cell targets");
  assert.equal(resources(),beforeResources,"inspection does not change action source, resources or pending rules");
}
reset();run('Scene.tool="target";Scene.targetIds=[];Scene.targetCells=["3,2"]');clickBoard("enemy");
assert.deepEqual(targets(),{actorIds:["enemy"],cells:[]},"explicit targeting keeps its existing actor/cell behavior");
clickBoard("enemy",undefined,true);
assert.deepEqual(targets(),{actorIds:[],cells:["3,2"]},"Shift still picks the cell beneath a token");

// Next token selection leaves the field visible for its token HUD.
for(const version of ["next","classic"]){
  reset("gm",version);run('activeScenePanels={left:null,right:null};activeScenePanel=null');
  clickBoard("enemy");
  assert.equal(run("Scene.selectedActor"),"enemy");
  assert.equal(run("isScenePanelOpen('inspector')"),version==="classic","only classic token selection opens Info automatically");
}

// The context ruler uses the same local Player tool as the next actual board click.
reset("player");run('Scene.tool="place"');const measureResources=resources(),measureTargets=targets();
clickContext("measure");
assert.equal(run("Scene.tool"),"place","a Player ruler does not replace the Narrator tool");
assert.equal(run("activeSceneTool()"),"measure");assert.deepEqual(plain(run("sceneMeasureStart")),{x:1,y:2});
clickBoard(null,"4,2");
assert.match(run("sceneMeasureLabel"),/3 кл\./);assert.equal(run("sceneMeasureStart"),null);
assert.deepEqual(Array.from(run("sceneMeasureCells")),["1,2","2,2","3,2","4,2"]);
assert.equal(resources(),measureResources);assert.deepEqual(targets(),measureTargets);
for(const action of ["marker","area"]){
  reset();clickContext(action);
  assert.equal(run("Scene.tool"),action);assert.equal(run("isScenePanelOpen('map')"),true,"context creation opens the existing Map editor");
  assert.equal(run("isScenePanelOpen('director')"),true);assert.equal(cancellations,0);
  reset("player");clickContext(action);
  assert.equal(run("Scene.tool"),"select");assert.equal(run("playerSceneTool"),"select","a stale context command cannot elevate Player permissions");
  assert.equal(run("isScenePanelOpen('map')"),false);
}
for(const preparation of [
  'lwTechniqueDraft={actorId:"hero",payload:{kind:"action"}}',
  'lwDestination={actorId:"hero",field:"destination"}',
  'Scene.pendingActionPlan={actorId:"hero",phase:"destination"}',
  'pendingCoreAction="jump"',
  'pendingCoreReaction={actorId:"hero",choice:"dodge"}',
])for(const action of ["measure","marker","area"]){
  reset();run(preparation);const before=run("JSON.stringify({Scene,lwTechniqueDraft,lwDestination,pendingCoreAction,pendingCoreReaction,activeScenePanels,playerSceneTool})");
  clickContext(action);
  assert.equal(run("JSON.stringify({Scene,lwTechniqueDraft,lwDestination,pendingCoreAction,pendingCoreReaction,activeScenePanels,playerSceneTool})"),before,"context tool switching leaves an existing preparation intact");
  assert.equal(cancellations,0);if(action!=="measure")assert.match(messages.at(-1),/Сначала завершите/);
}

reset();run('Scene.pendingActionPlan={actorId:"hero",phase:"destination"};changeSceneTool("measure")');const measuredPreparation=resources();escape();assert.equal(resources(),measuredPreparation);assert.equal(cancellations,0);assert.equal(run("sceneNeutralTool"),null);

// Leaving neutral measurement through ordinary shortcuts clears its override.
for(const view of ["gm","player"]){
  reset(view);run('changeSceneTool("measure")');
  const event={key:"v",target:{matches:()=>false,closest:()=>null},preventDefault(){},ctrlKey:false,metaKey:false,altKey:false};
  for(const row of keyboard)if(!row.capture)row.handler(event);
  assert.equal(run("sceneNeutralTool"),null);assert.equal(run("activeSceneTool()"),"select");
}

reset();run('changeSceneTool("measure")');
const wallShortcut=()=>{const event={key:"w",target:{matches:()=>false,closest:()=>null},preventDefault(){},ctrlKey:false,metaKey:false,altKey:false};for(const row of keyboard)if(!row.capture)row.handler(event);};
wallShortcut();assert.equal(run("sceneNeutralTool"),null);assert.equal(run("activeSceneTool()"),"wall");
reset();run('lwDestination={actorId:"hero",field:"destination"};changeSceneTool("measure")');
wallShortcut();assert.equal(run("sceneNeutralTool"),"measure");assert.equal(cancellations,0,"Wall shortcut cannot interrupt pending destination selection");

// App dialogs own keyboard input; table shortcuts must not mutate hidden tools.
for(const shortcut of ["m","w","v","p","t","a","k"]){
  reset();run('changeSceneTool("measure")');openDialog={id:"app-settings-dialog",open:true};
  const before=run("JSON.stringify({tool:Scene.tool,playerSceneTool,sceneNeutralTool})");
  const event={key:shortcut,target:{matches:()=>false,closest:()=>null},preventDefault(){},ctrlKey:false,metaKey:false,altKey:false};
  for(const row of keyboard)if(!row.capture)row.handler(event);
  assert.equal(run("JSON.stringify({tool:Scene.tool,playerSceneTool,sceneNeutralTool})"),before,`dialog owns ${shortcut}`);
}

// Escape belongs to the visible section or app dialog before any Scene cancel path.
const seedPreparation=()=>run(`Scene.pendingActionPlan={actorId:"hero",phase:"destination"};
  pendingCoreActionContext={context:{armamentDestination:{x:2,y:2}}};
  pendingTechniqueRule={id:"rule"};lwTechniqueDraft={actorId:"hero",payload:{kind:"action"}};lwDestination={actorId:"hero",field:"destination"};
  scenePreviewCells.add("2,2");sceneMeasureStart={x:1,y:1};`);
const preparationState=()=>run("JSON.stringify({Scene,pendingCoreActionContext,pendingTechniqueRule,lwTechniqueDraft,lwDestination,activeScenePanels,sceneMeasureStart,preview:[...scenePreviewCells]})");
for(const mode of ["rules","tools","reference","build"]){
  reset();seedPreparation();context.nextMode=mode;run("store.mode=nextMode");const before=preparationState();
  assert.equal(escape().defaultPrevented,false,`${mode}: Scene does not consume Escape`);
  assert.equal(preparationState(),before);assert.equal(cancellations,0);
}
for(const dialogId of ["app-settings-dialog","bug-report-dialog","scene-results"]){
  reset();seedPreparation();openDialog={id:dialogId,open:true};const before=preparationState();
  assert.equal(escape().defaultPrevented,false,"the native dialog keeps its Escape behavior");
  assert.equal(preparationState(),before);assert.equal(cancellations,0);
}
reset();seedPreparation();element("scene-context-menu").hidden=false;run('sceneContextTarget={cell:"2,2"}');
const menuPreparation=preparationState(),menuEscape=escape();
assert.equal(element("scene-context-menu").hidden,true);assert.equal(run("sceneContextTarget"),null);
assert.equal(menuEscape.stopped,true);assert.equal(menuEscape.defaultPrevented,true);
assert.equal(preparationState(),menuPreparation,"closing the context menu cannot also close panels or cancel drafts");assert.equal(cancellations,0);
reset();run('Scene.pendingActionPlan={actorId:"hero",phase:"destination"}');
assert.equal(escape().stopped,true);assert.equal(cancellations,1,"Escape still cancels a visible composite preparation");
reset();run('pendingCoreActionContext={context:{armamentDestination:{x:2,y:2}}}');
assert.equal(escape().stopped,true);assert.equal(cancellations,1,"Escape still cancels visible armament destination preparation");
reset();run('lwTechniqueDraft={actorId:"hero",payload:{kind:"action"}}');const beforeCancel=resources();escape();
assert.equal(run("lwTechniqueDraft"),null,"the ordinary visible LionWing preview can still be cancelled");
assert.equal(resources(),beforeCancel,"local preview cancellation spends no resources");

// Manual Player click-to-move uses the canonical table command and retains ownership.
const moves=[];
context.window.DAWN_TABLE_POLICY={isManual:scene=>scene.tablePolicy?.mode==="manual"};
context.commitSceneEvents=(label,events)=>{moves.push(plain(events));return true;};
const chooseTool=tool=>handlers.get("scene-workbench:click")({target:{closest:selector=>selector==="[data-scene-tool]"?{dataset:{sceneTool:tool}}:null}});
reset("player");chooseTool("place");assert.equal(run("activeSceneTool()"),"select","rules-mode Players cannot enter free placement");
run('Scene.tablePolicy={mode:"manual"}');chooseTool("place");assert.equal(run("activeSceneTool()"),"place");
const beforeOwnMove=resources();clickBoard("hero");clickBoard(null,"2,3");
assert.deepEqual(moves.at(-1),[{type:"table.command",actorId:"hero",payload:{kind:"move",space:"main",x:2,y:3}}]);
assert.equal(resources(),beforeOwnMove,"movement sends no automated AP or combat event");
const moveCount=moves.length;clickBoard("enemy");assert.equal(run("Scene.selectedActor"),"hero","Player cannot select an enemy for free placement");
run('Scene.selectedActor="enemy"');clickBoard(null,"4,3");assert.equal(moves.length,moveCount,"stale selection cannot move an enemy");
run('Scene.actors.push({id:"other",heroId:"other-hero",team:"hero",space:"main",x:0,y:0})');clickBoard("other");
assert.equal(moves.length,moveCount,"another player's Hero remains protected");

console.log("Scene pointer routing passed: inspection/targets, independent panels, Player context ruler, safe Map routes, manual owned movement and Escape ownership.");
