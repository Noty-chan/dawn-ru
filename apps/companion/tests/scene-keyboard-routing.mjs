import assert from 'node:assert/strict';
import vm from 'node:vm';
import {sceneAdminHarness} from './helpers/scene-admin-harness.mjs';

const {context,events,read,state,node,handlers,run,clone}=sceneAdminHarness(),lionwing=read('lionwing-ui.js'),keyboard=[],clickCaptures=[];
context.document={querySelector:()=>null,addEventListener(type,handler,options){if(type==='keydown'||type==='keyup')keyboard.push({type,handler,capture:Boolean(options)});if(type==='click'&&options===true)clickCaptures.push(handler);}};
Object.assign(context,{lwActive:()=>true,performance:{now:()=>1000},activeSceneTool:()=>context.Scene.tool,activeSceneSpace:()=>context.Scene.spaces.find(space=>space.id===context.Scene.activeSpace),canControlScenePrompt:()=>false,
 usingNextSceneInterface:()=>true,playerCanRepositionSceneActor:()=>false,isScenePanelOpen:()=>false,hideSceneContextMenu(){node('scene-context-menu').hidden=true;},
});node('scene-context-menu').hidden=true;
vm.runInContext('let sceneSpaceHeld=false,scenePanState=null,sceneSuppressBoardClickUntil=0,sceneNeutralTool=null,activeScenePanel=null,hoveredSceneActorId=null,pendingCoreAction=null,pendingCoreActionPlan=false,pendingCoreActionContext=null,pendingCoreReaction=null,pendingTechniqueRule=null,pendingTechniqueAnchor=null,pendingTechniqueOptions={},pendingTechniqueCells=[],pendingTechniqueLines=[],pendingEnemyRule=null,pendingEnemyStepActorId=null,pendingZealotPlan=null,activeModifierActionId=null,activeModifierPickerId=null,activeModifierShapePreset=null,lwTechniqueDraft=null,lwDestination=null,lwGeometryPreview=null;let scenePreviewCells=new Set(),sceneTopologyCells=new Set();',context);
const oneLine=(source,prefix)=>source.split('\n').find(line=>line.startsWith(prefix));
const captureStart=events.indexOf('document.addEventListener("keydown",event=>{\n  if(event.key!=="Escape"'),captureEnd=events.indexOf('\n},true);',captureStart);vm.runInContext(events.slice(captureStart,captureEnd+'\n},true);'.length),context);
vm.runInContext(oneLine(events,'function resetScenePanGesture('),context);
vm.runInContext(oneLine(events,'document.addEventListener("keydown",event=>{if(event.code==="Space"'),context);
vm.runInContext(oneLine(events,'document.addEventListener("keyup",event=>{if(event.code==="Space"'),context);
vm.runInContext(oneLine(events,'document.addEventListener("keydown",event=>{if(event.key==="Escape"){'),context);
const boardStart=events.indexOf('$("scene-board").addEventListener("click",event=>{if(performance.now()<sceneSuppressBoardClickUntil)'),boardEnd=events.indexOf('\n$("scene-board").addEventListener("dragstart"',boardStart);vm.runInContext(events.slice(boardStart,boardEnd),context);
const lwCaptureStart=lionwing.indexOf('document.addEventListener("click", event => {\n  if (!lwActive()) return;');vm.runInContext(lionwing.slice(lwCaptureStart,lionwing.indexOf('\n},true);',lwCaptureStart)+'\n},true);'.length),context);
vm.runInContext(lionwing.slice(lionwing.indexOf('function lwCancelDestination()'),lionwing.indexOf('const lwRules =')),context);
vm.runInContext(lionwing.slice(lionwing.indexOf('document.addEventListener("keydown", event => {\n  if(!lwActive())return;')),context);
const boardClick=handlers['scene-board:click'][0].handler,cell={dataset:{sceneCell:'2,2'},matches:()=>false,closest:selector=>selector==='[data-scene-cell]'?cell:null};
cell.click=()=>{const event={target:cell,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const capture of clickCaptures){capture(event);if(event.stopped)return;}boardClick(event);};
function key(target,key,code,type='keydown'){
 const event={target,key,code,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
 for(const capture of [true,false])for(const row of keyboard){if(row.type!==type||row.capture!==capture||event.stopped)continue;row.handler(event);}return event;
}
for(const role of ['owner','player'])for(const [keyValue,code]of [['Enter','Enter'],[' ','Space']]){
 state.sync.role=role;state.sync.canNarrate=role==='owner';context.Scene.tool='target';context.Scene.targetCells=[];state.renders=0;run('sceneSpaceHeld=false;');const canonical=clone(context.Scene.actors),version=context.Scene.version;
 assert.equal(key(cell,keyValue,code).defaultPrevented,true);assert.deepEqual(clone(context.Scene.targetCells),['2,2']);assert.equal(run('sceneSpaceHeld'),false,'Grid activation never arms camera panning');assert.equal(state.renders,1);
 assert.deepEqual(clone(context.Scene.actors),canonical);assert.equal(context.Scene.version,version);assert.equal(state.queued.length,0);
}
const background={matches:()=>false,closest:()=>null};key(background,' ','Space');assert.equal(run('sceneSpaceHeld'),true,'Space on the board background still owns panning');key(background,' ','Space','keyup');assert.equal(run('sceneSpaceHeld'),false);
const summary={matches:()=>false,closest:selector=>selector==='summary'?summary:null};assert.equal(key(summary,' ','Space').defaultPrevented,false);assert.equal(run('sceneSpaceHeld'),false);
for(const picker of ['technique','destination']){
 state.sync.role='owner';state.sync.canNarrate=true;run(`lwTechniqueDraft=${picker==='technique'?'{actorId:"hero",mode:"action",payload:{kind:"action"}}':'null'};lwDestination=${picker==='destination'?'{actorId:"hero",payload:{kind:"action"}}':'null'};`);
 state.renders=0;const presentations=[];state.onPaint=()=>presentations.push(run('Boolean(lwTechniqueDraft||lwDestination)'));const before=clone(context.Scene);
 assert.equal(key(cell,'Escape','Escape').defaultPrevented,true);assert.equal(run('lwTechniqueDraft'),null);assert.equal(run('lwDestination'),null);assert.equal(state.renders,1,'The owning native controller cancels a private picker with one render');assert.deepEqual(presentations,[false]);assert.deepEqual(clone(context.Scene),before);
}
console.log('Scene keyboard routing: actual general capture/bubble + native keyboard/click capture + board click preserve Space/Enter cell activation, background panning and summaries; Escape clears each private native picker with one render. DOM mocked.');
