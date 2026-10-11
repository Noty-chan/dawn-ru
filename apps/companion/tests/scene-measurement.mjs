import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const effects=read('scene-effects.js'),ui=read('scene-ui.js'),events=read('app-scene-events.js');
let role='gm',english=false,cancels=0,persists=0,fullRenders=0,boardRenders=0,room=null;
class Element {
  constructor(tag='div',dataset={}){
    this.tagName=tag;this.dataset=dataset;this.children=[];this.classes=new Set();this.attrs={};this.listeners=[];this.textContent='';this.hidden=false;
    this.classList={add:(...names)=>names.forEach(name=>this.classes.add(name)),remove:(...names)=>names.forEach(name=>this.classes.delete(name)),contains:name=>this.classes.has(name),toggle:(name,on)=>{if(on)this.classes.add(name);else this.classes.delete(name);}};
  }
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
board.querySelectorAll=selector=>selector==='[data-scene-cell]'?cells:selector==='.scene-measure-readout'?outputs():[];
board.querySelector=selector=>{const match=selector.match(/^\[data-scene-cell="([\d,]+)"\]$/);return match?cells.find(item=>item.dataset.sceneCell===match[1]):null;};
// This fixture rejects the destructive operation itself, rather than counting
// a simulated rendering function as proof of a real browser's paint timing.
Object.defineProperty(board,'innerHTML',{set(){throw new Error('The ruler must not replace board DOM');}});
const focusedInput={value:'unsubmitted draft'},document={activeElement:focusedInput,listeners:[],querySelector:()=>null,querySelectorAll:selector=>selector==='[data-scene-tool]'?buttons:[],createElement:tag=>new Element(tag),addEventListener(type,handler,options){this.listeners.push({type,handler,options});}};
const scene={rulesEdition:'lionwing',tablePolicy:{mode:'rules',epoch:3},activeSpace:'main',spaces:[{id:'main',width:7,height:7},{id:'other',width:3,height:3}],tool:'target',version:4,pendingActionPlan:{id:'prepared'},selectedActor:'hero',actors:[{id:'hero',name:'Hero',hidden:false},{id:'foe',name:'Enemy',hidden:false},{id:'secret',name:'Hidden',hidden:true}],markers:[],targetIds:['foe'],targetCells:['2,2'],hp:12,ap:2};
const context=vm.createContext({Scene:scene,Sync:{state:()=>({sceneId:room})},store:{mode:'play'},window:{DAWN_TABLE_POLICY:{isManual:()=>false}},document,$:id=>{if(!controls.has(id))controls.set(id,new Element());return controls.get(id);},activeSceneView:()=>role,activeSceneSpace:()=>scene.spaces.find(item=>item.id===scene.activeSpace),isEnglishPreview:()=>english,t:(key,args)=>context.window.DAWN_I18N.t(key,args,{locale:english?'en':'ru'}),performance:{now:()=>1000},renderScene:()=>fullRenders++,renderSceneBoard:()=>{boardRenders++;for(const cell of cells)cell.classList.remove('measured');for(const output of outputs())output.remove();},persist:()=>persists++,cancelSceneFlow:()=>cancels++,hideSceneContextMenu:()=>{},toast:()=>{}});
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
for(let i=0;i<100;i++)pointer(eventFor(cell(i%7,Math.floor(i/7)%7)));
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
scene.version++;scene.hp--;run('renderSceneBoard()');assert.equal(outputs()[0].textContent,'5 spaces');assert.equal(run('sceneNeutralTool'),'measure');
scene.actors.push({id:'new-participant',name:'New',hidden:false});run('renderSceneBoard()');assert.equal(outputs()[0].textContent,'5 spaces','An unrelated participant does not change the field scope');
for(const change of [()=>scene.activeSpace='other',()=>scene.tablePolicy.epoch++,()=>role=role==='gm'?'player':'gm',()=>room='different-room',()=>scene.spaces.find(item=>item.id===scene.activeSpace).width++]){
  run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:1,y:1})');change();run('renderSceneBoard()');
  assert.equal(run('sceneMeasureStart'),null);assert.equal(run('sceneMeasureEnd'),null);assert.equal(run('sceneNeutralTool'),null);assert.equal(outputs().length,0);
}
// A stale pointer arriving before a full repaint also cannot extend a line
// from the previous field or role.
run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0})');scene.tablePolicy.epoch++;assert.equal(run('updateSceneMeasurement({x:1,y:1})'),false);assert.equal(outputs().length,0);
run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0})');room='new-session';run('renderScene()');assert.equal(run('sceneNeutralTool'),null,'Full UI rendering clears the scope before header/tool computation');
role='player';scene.targetIds=['secret'];scene.selectedActor='secret';run('clearSceneMeasurement()');assert.equal(summary.textContent,'No targets selected','Hidden names do not enter a player summary');
assert.equal(cancels,0);assert.equal(persists,0,'All ruler interactions remain free of storage/writer calls');
console.log('PASS local ruler: actual handler isolation, stable DOM/focus, one live/final readout, preserved rule highlights/action/AP, RU/EN, invalid coordinates, Escape/pan/context and scope reset; native paint/network not measured');
