import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8').replaceAll('\r\n','\n');
const effects=read('scene-effects.js'),ui=read('scene-ui.js'),events=read('app-scene-events.js');
let highlightMutations=0,highlightScans=0,fieldFocusCalls=0;
let role='gm',english=false,cancels=0,persists=0,fullRenders=0,boardRenders=0,room=null;
class Element {
  constructor(tag='div',dataset={}){
    this.tagName=tag;this.dataset=dataset;this.children=[];this.classes=new Set();this.attrs={};this.listeners=[];this.textContent='';this.hidden=false;
    this.classList={add:(...names)=>names.forEach(name=>{highlightMutations++;this.classes.add(name);}),remove:(...names)=>names.forEach(name=>{highlightMutations++;this.classes.delete(name);}),contains:name=>this.classes.has(name),toggle:(name,on)=>{highlightMutations++;if(on)this.classes.add(name);else this.classes.delete(name);}};
  }
  focus(options){fieldFocusCalls++;document.activeElement=this;this.focusOptions=options;}
  setAttribute(name,value){this.attrs[name]=String(value);}
  appendChild(node){node.remove();node.parentElement=this;this.children.push(node);return node;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  closest(selector){return selector==='[data-scene-cell]'&&this.dataset.sceneCell?this:null;}
  addEventListener(type,handler,options){this.listeners.push({type,handler,options});}
}
const board=new Element(),summary=new Element(),controls=new Map([['scene-board',board],['scene-selection-summary',summary],['scene-context-menu',new Element()]]);
controls.get('scene-context-menu').hidden=true;
for(const id of ['scene-area-controls','scene-wall-controls','scene-marker-controls','scene-topology-controls'])controls.set(id,new Element());
controls.set('scene-area-type',Object.assign(new Element(),{value:'terrain'}));
const buttons=['select','target','measure','place','area','wall','marker','topology'].map(tool=>new Element('button',{sceneTool:tool,sceneAreaType:tool==='area'?'terrain':undefined}));
const cells=Array.from({length:49},(_,i)=>new Element('div',{sceneCell:`${i%7},${Math.floor(i/7)}`}));
for(const cell of cells)board.appendChild(cell);
const cell=(x,y)=>cells.find(item=>item.dataset.sceneCell===`${x},${y}`),outputs=()=>cells.flatMap(item=>item.children).filter(item=>item.className==='scene-measure-readout');
board.contains=node=>cells.includes(node);
board.querySelectorAll=selector=>selector==='[data-scene-cell]'?(highlightScans++,cells):selector==='.scene-measure-readout'?outputs():[];
board.querySelector=selector=>{const match=selector.match(/^\[data-scene-cell="([\d,]+)"\]$/);return match?cells.find(item=>item.dataset.sceneCell===match[1]):null;};
// This fixture rejects the destructive operation itself, rather than counting
// a simulated rendering function as proof of a real browser's paint timing.
Object.defineProperty(board,'innerHTML',{set(){throw new Error('The ruler must not replace board DOM');}});
const focusedInput={value:'unsubmitted draft'},document={activeElement:focusedInput,listeners:[],querySelector:()=>null,querySelectorAll:selector=>selector==='[data-scene-tool]'?buttons:[],createElement:tag=>new Element(tag),addEventListener(type,handler,options){this.listeners.push({type,handler,options});}};
const scene={rulesEdition:'lionwing',tablePolicy:{mode:'rules',epoch:3},activeSpace:'main',spaces:[{id:'main',width:7,height:7},{id:'other',width:3,height:3}],tool:'target',version:4,pendingActionPlan:{id:'prepared'},selectedActor:'hero',actors:[{id:'hero',name:'Hero',hidden:false},{id:'foe',name:'Enemy',hidden:false},{id:'secret',name:'Hidden',hidden:true}],markers:[],targetIds:['foe'],targetCells:['2,2'],hp:12,ap:2};
const context=vm.createContext({CSS:{escape:String},Scene:scene,Sync:{state:()=>({sceneId:room})},store:{mode:'play'},window:{DAWN_TABLE_POLICY:{isManual:()=>false}},document,$:id=>{if(!controls.has(id))controls.set(id,new Element());return controls.get(id);},activeSceneView:()=>role,activeSceneSpace:()=>scene.spaces.find(item=>item.id===scene.activeSpace),isEnglishPreview:()=>english,t:(key,args)=>context.window.DAWN_I18N.t(key,args,{locale:english?'en':'ru'}),performance:{now:()=>1000},renderScene:()=>fullRenders++,renderSceneBoard:()=>{boardRenders++;for(const cell of cells)cell.classList.remove('measured');for(const output of outputs())output.remove();},persist:()=>persists++,cancelSceneFlow:()=>cancels++,hideSceneContextMenu:()=>{},toast:()=>{}});
for(const file of ['localization.js','locale-ru.js','locale-en-builder.js'])vm.runInContext(read(file),context,{filename:file});
vm.runInContext('let playerSceneTool="select",sceneNeutralTool=null,sceneMeasureEnd=null,sceneMeasureStart=null,sceneMeasureCells=new Set(),sceneMeasureLabel="",scenePreviewCells=new Set(["3,3"]),sceneTopologyCells=new Set(),sceneSuppressBoardClickUntil=0,sceneSpaceHeld=false,scenePanState=null,sceneContextTarget=null;let pendingCoreAction="attack",pendingCoreReaction=null,pendingTechniqueRule=null,pendingEnemyRule=null,pendingEnemyStepActorId=null,pendingZealotPlan=null;',context);
const oneLine=(source,start)=>{const at=source.indexOf(start);assert.ok(at>=0,`Production entry point ${start} exists`);return source.slice(at,source.indexOf('\n',at));};
vm.runInContext(oneLine(ui,'function activeSceneTool(')+'\n'+oneLine(ui,'function measurementPath('),context);
vm.runInContext(effects.slice(effects.indexOf('let sceneMeasurementScope='),effects.indexOf('function cancelCommittedAction(')),context);
const run=code=>vm.runInContext(code,context),before=JSON.stringify(scene),cellIdentity=[...cells];
for(const current of ['gm','player']){
  role=current;run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:3,y:2})');
  assert.equal(run('sceneMeasureLabel'),'5 кл.');assert.equal(run('activeSceneTool()'),'measure');
  assert.equal(summary.textContent,'5 кл.');assert.equal(outputs().length,1);assert.equal(outputs()[0].parentElement,cell(3,2));
  const output=outputs()[0];run('updateSceneMeasurement({x:1,y:1})');assert.equal(run('sceneMeasureLabel'),'2 кл.');assert.equal(outputs()[0],output,'One existing readout moves to the current endpoint');
  assert.equal(cell(3,2).classList.contains('measured'),false,'Previous endpoint loses only the ruler highlight');
  run('updateSceneMeasurement({x:0,y:0},{complete:true})');assert.equal(run('sceneMeasureLabel'),'0 кл.');assert.equal(run('sceneMeasureStart'),null);
  const finished=summary.textContent;assert.equal(run('updateSceneMeasurement({x:-1,y:0})'),false);assert.equal(summary.textContent,finished);
  run('clearSceneMeasurement()');assert.equal(run('activeSceneTool()'),current==='gm'?'target':'select');assert.equal(outputs().length,0);assert.ok(cells.every(item=>!item.classList.contains('measured')));
  assert.equal(JSON.stringify(scene),before);assert.equal(run('scenePreviewCells.has("3,3")'),true);
}
english=true;role='gm';run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:3,y:2},{complete:true})');assert.equal(run('sceneMeasureLabel'),'5 spaces');
run('clearSceneMeasurement()');assert.equal(summary.textContent,'Targets (1): Enemy');
assert.equal(buttons.find(item=>item.dataset.sceneTool==='target').attrs['aria-pressed'],'true','Exiting the neutral tool restores the real tool');
assert.equal(fullRenders,0);assert.equal(boardRenders,0);

// Execute the actual registered pointer, click, context and Escape handlers.
const pointerStart='$('+JSON.stringify('scene-board')+').addEventListener("mouseover",event=>{const cell=event.target.closest("[data-scene-cell]")';
vm.runInContext(oneLine(events,pointerStart),context);
const clickStart=events.indexOf('$("scene-board").addEventListener("click",event=>{if(performance.now()<sceneSuppressBoardClickUntil)');
const clickEnd=events.indexOf('\n$("scene-board").addEventListener("dragstart"',clickStart);
assert.ok(clickStart>=0&&clickEnd>clickStart);vm.runInContext(events.slice(clickStart,clickEnd),context);
const escapeStart=events.indexOf('document.addEventListener("keydown",event=>{\n  if(event.key!=="Escape"');
const escapeEnd=events.indexOf('\n},true);',escapeStart);
assert.ok(escapeStart>=0&&escapeEnd>escapeStart);vm.runInContext(events.slice(escapeStart,escapeEnd+'\n},true);'.length),context);
vm.runInContext(oneLine(events,'document.addEventListener("keydown",event=>{if(event.key==="Escape"){'),context);
const contextStart=events.indexOf('$("scene-context-menu").addEventListener("click",event=>{');
const contextEnd=events.indexOf('\ndocument.addEventListener("pointerdown"',contextStart);
assert.ok(contextStart>=0&&contextEnd>contextStart);vm.runInContext(events.slice(contextStart,contextEnd),context);
const eventFor=target=>({target,key:'Escape',defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}});
const click=board.listeners.find(row=>row.type==='click').handler,pointer=board.listeners.find(row=>row.type==='mouseover').handler;
run('changeSceneTool("measure")');click(eventFor(cell(0,0)));
cell(6,6).classList.add('movement-valid','preview','targeted-cell');
const mutationsBeforeHover=highlightMutations,scansBeforeHover=highlightScans;
for(let i=0;i<100;i++)pointer(eventFor(cell(i%7,Math.floor(i/7)%7)));
assert.ok(highlightMutations-mutationsBeforeHover<100*10,'Ruler updates touch changed path cells, not every field cell');assert.equal(highlightScans,scansBeforeHover,'An unchanged field never rebuilds the highlight index on pointer movement');
assert.equal(fullRenders,0,'Hover never calls the full UI renderer');assert.equal(boardRenders,0,'Hover never invokes board or destination rendering');
assert.deepEqual(cells,cellIdentity);assert.equal(document.activeElement,focusedInput,'The unrelated focused input remains untouched');
assert.ok(['movement-valid','preview','targeted-cell'].every(name=>cell(6,6).classList.contains(name)),'Ruler updates leave rule/target/preview highlights untouched');
const beforePan=outputs()[0].textContent;run('sceneSpaceHeld=true');pointer(eventFor(cell(6,6)));assert.equal(outputs()[0].textContent,beforePan,'Space-pan owns hover instead of changing the line');run('sceneSpaceHeld=false;scenePanState={moved:true}');pointer(eventFor(cell(6,6)));assert.equal(outputs()[0].textContent,beforePan);run('scenePanState=null');
click(eventFor(cell(3,2)));assert.equal(run('sceneMeasureStart'),null);assert.equal(outputs()[0].textContent,'5 spaces');
run('sceneSpaceHeld=true');const panClick=eventFor(cell(4,4));click(panClick);assert.equal(panClick.defaultPrevented,true);assert.equal(outputs()[0].textContent,'5 spaces');run('sceneSpaceHeld=false');
const captureEscape=document.listeners.find(row=>row.type==='keydown'&&row.options===true).handler;
captureEscape(eventFor(cell(3,2)));assert.equal(run('sceneNeutralTool'),null);assert.equal(outputs().length,0);
assert.equal(cancels,0,'Escape from the ruler leaves the prepared action alone');
const measureButton=Object.assign(new Element('button'),{dataset:{sceneContextAction:'measure'},closest:selector=>selector==='[data-scene-context-action]'?measureButton:null});
run('sceneContextTarget={cell:"2,1"}');controls.get('scene-context-menu').listeners[0].handler(eventFor(measureButton));
assert.equal(run('sceneMeasureLabel'),'0 spaces');assert.equal(outputs()[0].parentElement,cell(2,1));
document.listeners.find(row=>row.type==='keydown'&&row.options!==true).handler(eventFor(cell(2,1)));assert.equal(outputs().length,0);
assert.equal(fullRenders,0);assert.equal(boardRenders,0);assert.equal(JSON.stringify(scene),before);assert.equal(persists,0);

// Canonical repaint keeps the same local measurement; context changes discard
// it before that repaint. This remains a DOM fixture, not native browser QA.
run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:3,y:2})');
run('renderSceneBoard()');document.activeElement=cell(4,4);scene.version++;scene.hp--;run('renderSceneBoard()');assert.equal(document.activeElement,cell(4,4),'A canonical repaint restores the focused field cell');assert.equal(cell(4,4).focusOptions.preventScroll,true);document.activeElement=focusedInput;assert.equal(outputs()[0].textContent,'5 spaces');assert.equal(run('sceneNeutralTool'),'measure');
scene.actors.push({id:'new-participant',name:'New',hidden:false});run('renderSceneBoard()');assert.equal(outputs()[0].textContent,'5 spaces','An unrelated participant does not change the field scope');
for(const change of [()=>scene.activeSpace='other',()=>scene.tablePolicy.epoch++,()=>role=role==='gm'?'player':'gm',()=>room='different-room',()=>scene.spaces.find(item=>item.id===scene.activeSpace).width++]){
  run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:1,y:1})');document.activeElement=cell(4,4);const oldFieldFocusCalls=fieldFocusCalls;change();run('renderSceneBoard()');assert.equal(fieldFocusCalls,oldFieldFocusCalls,'A focused cell from the last painted field is never restored into a new field/view/policy');document.activeElement=focusedInput;
  assert.equal(run('sceneMeasureStart'),null);assert.equal(run('sceneMeasureEnd'),null);assert.equal(run('sceneNeutralTool'),null);assert.equal(outputs().length,0);
}
// A stale pointer arriving before a full repaint also cannot extend a line
// from the previous field or role.
run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0})');scene.tablePolicy.epoch++;assert.equal(run('updateSceneMeasurement({x:1,y:1})'),false);assert.equal(outputs().length,0);
run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0})');room='new-session';run('renderScene()');assert.equal(run('sceneNeutralTool'),null,'Full UI rendering clears the scope before header/tool computation');
role='player';scene.targetIds=['secret'];scene.selectedActor='secret';run('clearSceneMeasurement()');assert.equal(summary.textContent,'No targets selected','Hidden names do not enter a player summary');
assert.equal(cancels,0);assert.equal(persists,0,'All ruler interactions remain free of storage/writer calls');

// Execute the actual commitScene refusal paths. Import/reset clear a local
// ruler before committing, so a rejected canonical edit must leave both the
// tool state and the existing board DOM consistently cleared.
role='gm';context.Scene.undo=[];context.Scene.redo=[];context.Scene.turnUndo=[];
Object.assign(context,{sceneSnapshot:()=>structuredClone(context.Scene),normalizeScene:value=>structuredClone(value),validateTableEdit:()=>{throw new Error('QA canonical validation refused');},setScenePanel:()=>{throw new Error('A refused edit must not change panels');}});
const commitStart=ui.indexOf('function commitScene('),commitEnd=ui.indexOf('\nfunction lionwingDestroyDescription(',commitStart);
assert.ok(commitStart>=0&&commitEnd>commitStart);vm.runInContext(ui.slice(commitStart,commitEnd),context);
const backupStart=events.indexOf('function applyTableBackup('),backupEnd=events.indexOf('$("scene-export-table").onclick',backupStart);
assert.ok(backupStart>=0&&backupEnd>backupStart);vm.runInContext(events.slice(backupStart,backupEnd),context);
context.Sync.state=()=>({sceneId:room,canNarrate:true});
run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:1,y:1})');
const beforeRefusal=JSON.stringify(context.Scene),beforeRefusalRenders=fullRenders;
context.backup={scene:structuredClone(context.Scene)};assert.equal(run('applyTableBackup(backup,"Refused import")'),false);
assert.equal(JSON.stringify(context.Scene),beforeRefusal,'actual commitScene rollback retains canonical data/resources');
assert.equal(run('sceneNeutralTool'),null);assert.equal(outputs().length,0);assert.ok(cells.every(item=>!item.classList.contains('measured')));
assert.equal(buttons.find(item=>item.dataset.sceneTool==='measure').attrs['aria-pressed'],'false');
assert.equal(fullRenders,beforeRefusalRenders,'a refused import clears locally without a full render');
// A stale administrative control can also reach the reset callback after
// narrating rights are lost. The actual permission guard refuses the mutation.
context.Scene.rulesEdition='legacy';context.Sync.state=()=>({sceneId:room,canNarrate:false});context.window.confirm=()=>true;context.saveTableRecovery=async()=>true;
const blockedStart=effects.indexOf('function sceneEnvironmentCopy('),blockedEnd=effects.indexOf('function removeSceneEnvironment(',blockedStart);
vm.runInContext(effects.slice(blockedStart,blockedEnd),context);
const environmentScopeStart=effects.indexOf('function sceneEnvironmentScope('),environmentScopeEnd=effects.indexOf('function openSceneEnvironmentList(',environmentScopeStart);
vm.runInContext(effects.slice(environmentScopeStart,environmentScopeEnd),context);
context.sceneHasLocalPendingSelection=()=>false;
context.Scene.pendingActionPlan=null;run('pendingCoreAction=null');
const resetStart=events.indexOf('$("scene-reset-table").onclick=()=>{'),resetEnd=events.indexOf('$("scene-clear-log").onclick',resetStart);
assert.ok(resetStart>=0&&resetEnd>resetStart);vm.runInContext(events.slice(resetStart,resetEnd),context);
run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:1,y:1})');
const beforeReset=JSON.stringify(context.Scene);await controls.get('scene-reset-table').onclick();
assert.equal(JSON.stringify(context.Scene),beforeReset,'actual commitScene rights refusal retains the table');
assert.equal(run('sceneNeutralTool'),'measure','A refused reset leaves the neutral ruler available');assert.equal(outputs().length,1);
assert.equal(buttons.find(item=>item.dataset.sceneTool==='measure').attrs['aria-pressed'],'true');assert.equal(fullRenders,beforeRefusalRenders);
console.log('PASS local ruler: actual handler isolation, stable DOM/focus, readout, preserved rule highlights/action/AP, actual RU/EN, Escape/pan/context/scope and actual commitScene import/reset refusal; native paint/network not measured');

// Differential previews share the same scoped board index. Another producer
// can explicitly invalidate it after writing the preview class directly.
run('renderSceneCellHighlights("preview",new Set(["0,0"]))');
const previewMutations=highlightMutations,previewScans=highlightScans;
for(let i=0;i<100;i++)run('renderSceneCellHighlights("preview",new Set(["0,0"]))');
assert.equal(highlightMutations,previewMutations);assert.equal(highlightScans,previewScans);
run('renderSceneCellHighlights("preview",new Set(["1,0"]))');
assert.equal(highlightMutations-previewMutations,2,'Moving a single-cell preview touches exactly its old and new cells');
cell(1,0).classList.remove('preview');run('invalidateSceneCellHighlights();renderSceneCellHighlights("preview",new Set(["1,0"]))');
assert.ok(cell(1,0).classList.contains('preview'));
context.Scene.tablePolicy.epoch++;const scansBeforeScope=highlightScans;run('renderSceneCellHighlights("preview",new Set())');
assert.equal(highlightScans,scansBeforeScope+1,'Policy changes invalidate the cached board index');
const newCell=new Element('div',{sceneCell:'0,0'});cells[0]=newCell;board.children[0]=newCell;
const scansBeforeReplacement=highlightScans;run('renderSceneCellHighlights("preview",new Set(["0,0"]))');
assert.equal(highlightScans,scansBeforeReplacement+1);assert.ok(newCell.classList.contains('preview'),'A replacement board receives highlights on new cells');

// Execute the real drop handler and its deferred frame. A room/space/policy
// change or lost actor permission between drop and the frame cancels it.
const dropFrames=[],moves=[];let dragAllowed=true;
context.requestAnimationFrame=callback=>dropFrames.push(callback);
context.canDragSceneActor=()=>dragAllowed;
context.moveSceneActorFromBoard=(actor,x,y,options)=>moves.push({actorId:actor.id,x,y,...options});
run('clearSceneMeasurement({render:false});Scene.tool="place";let sceneDragActorId="hero"');
context.Scene.actors[0].space=context.Scene.activeSpace;
vm.runInContext(oneLine(events,'$("scene-board").addEventListener("drop"'),context);
const drop=board.listeners.find(row=>row.type==='drop').handler;
const dropEvent=()=>({target:cell(2,2),dataTransfer:{getData:()=>"hero"},preventDefault(){}});
drop(dropEvent());assert.equal(moves.length,0,"Native drop defers movement until its next frame");dropFrames.shift()();assert.equal(moves.length,1);
drop(dropEvent());room='room-after-drop';dropFrames.shift()();assert.equal(moves.length,1);
drop(dropEvent());context.Scene.tablePolicy.epoch++;dropFrames.shift()();assert.equal(moves.length,1);
drop(dropEvent());dragAllowed=false;dropFrames.shift()();assert.equal(moves.length,1);
console.log('PASS differential preview: zero work for unchanged keys, two mutations for moved cell, policy/DOM invalidation; actual deferred drop rejects stale room/policy and lost permission.');

let techniquePreviews=0;context.techniquePreview=()=>{techniquePreviews++;return {affectedCells:['1,0']};};
run('Scene.tool="select";pendingTechniqueRule={kind:"area"}');
pointer({...eventFor(cell(1,0)),relatedTarget:cell(1,0)});
assert.equal(techniquePreviews,0,'Entering a token child inside the same cell never recomputes the technique plan');
pointer(eventFor(cell(1,0)));run('pendingTechniqueRule={kind:"area",orientation:"new"}');pointer(eventFor(cell(1,0)));
assert.equal(techniquePreviews,2,'The controller does not memoize same-cell plans across changes to rule inputs');
console.log('PASS actual hover: nested same-cell events skip plan work; fresh events read current technique inputs.');
