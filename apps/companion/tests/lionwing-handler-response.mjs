import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=(process.env.DAWN_UI_BASELINE_REF?execFileSync('git',['show',`${process.env.DAWN_UI_BASELINE_REF}:apps/companion/lionwing-ui.js`],{encoding:'utf8'}):read('lionwing-ui.js')).replaceAll('\r\n','\n'),app=read('app-core.js'),writer=read('scene-ui.js');
const {context,core,engine}=runtime();
let serial=0,renders=0,pending=false,refuse=false,room='one',role='gm',pendingActor=null,seenDrafts=[],queued=[];
const handlers=[],flowRoot={hidden:false,dataset:{},innerHTML:''};
Object.assign(context,{structuredClone,SceneEngine:engine,APP_SCHEMA:14,contentPreferences:{edition:'lionwing'},uid:()=>`handler-${++serial}`,
 cleanArray:value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[],clamp:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),
 store:{mode:'play'},performance:{now:()=>serial*1000+1000},Sync:{state:()=>({sceneId:null,canNarrate:role==='gm'})},
 document:{addEventListener:(type,handler)=>{if(type==='click')handlers.push(handler);},querySelector:()=>null,querySelectorAll:()=>[]},
 activeSceneView:()=>role,lwActive:()=>true,lwOwns:()=>role==='gm',lwCanNarrate:()=>role==='gm',lwGeometrySceneIdentity:()=>room,
 lwRules:()=>context.window.DAWN_LIONWING_DATA.coreRules,lwActor:()=>context.Scene.actors[0],currentHeroActor:()=>context.Scene.actors[0],
 sceneDirectorActor:()=>context.Scene.actors[0],esc:String,toast:message=>{context.lastNotice=message;return null;},
 activeDirectorTab:'manual',lwDraftEnabled:false,lwDraftBatch:null,scenePreviewCells:new Set(),
 rulesPlayerPendingReason:actorId=>pendingActor&&actorId===pendingActor?{pending:true}:null,
 submitNetworkV2Events:(_label,events)=>{if(refuse)throw new Error('Immediate refusal');if(pending){queued.push(clone(events));return {pending:true,queued:true};}return null;},
 friendlySyncError:error=>error.message,syncHeroFromScene(){},persist(){},renderChallengeRequestDock(){},playSceneEventFx(){},$:()=>null,
 renderPlay:()=>paint(),renderScene:()=>paint(),renderToolsWorkspace:()=>paint(),sceneNumericCorrectionReason:()=>'',
 D:context.window.DAWN_DATA,matchMedia:()=>({matches:false}),sceneActionDisplayName:action=>typeof action==='string'?action:action.name||action.id,
});
context.window.document=context.document;
vm.runInContext(app.slice(app.indexOf('function blankScene()'),app.indexOf('function addEnemyDeploymentPassives')),context);
vm.runInContext('function sceneSnapshot(){return sceneCore(Scene)}',context);
vm.runInContext(writer.slice(writer.indexOf('let lastSceneEventSubmission='),writer.indexOf('function restoreSceneHistory(')),context);
vm.runInContext(`const LionwingEngine=window.DAWN_LIONWING_ENGINE;let lwDestination=null,lwGeometryPreview=null,lwTechniqueDraft=null;\n${source.slice(source.indexOf('const lwTechniqueText'),source.indexOf('const lwRules ='))}`,context);
vm.runInContext(source.slice(source.indexOf('function lwSubmit('),source.indexOf('function lwDiceHtml')),context);
vm.runInContext(source.slice((source.indexOf('function lwPendingWindowHtml(')>=0?source.indexOf('function lwPendingWindowHtml('):source.indexOf('function lwPendingHtml()')),source.indexOf('function lwAutomationHtml')),context);
const actions=read('scene-actions-ui.js'),effects=read('scene-effects.js');
vm.runInContext(actions.slice(actions.indexOf('function sceneActionPanel('),actions.indexOf('function coreActionRoll(')).replace('function sceneActionPanel(','function coreSheetPanel('),context);
vm.runInContext(effects.slice(effects.indexOf('function sceneFlowSteps('),effects.indexOf('\nfunction ',effects.indexOf('function sceneFlowSteps(')+1)),context);
vm.runInContext(effects.slice(effects.indexOf('function renderSceneFlow(')),context);
context.$=id=>id==='scene-flow'?flowRoot:null;
const start=source.indexOf('document.addEventListener("click", event => {\n  if (!lwActive()) return;');
vm.runInContext(source.slice(start,source.indexOf('\n},true);',start)+'\n},true);'.length),context);
function paint(){renders++;seenDrafts.push(vm.runInContext('Boolean(lwDestination||lwTechniqueDraft)',context));if(vm.runInContext('lwTechniqueDraft',context))context.lwTechniqueDraftHtml(context.Scene.actors[0]);}
const value=code=>vm.runInContext(code,context);
function fresh(){
 const scene=fixture();scene.activeActorId=null;scene.turnSerial=0;scene.actors[1].x=2;scene.actors[1].kind='hero';scene.actors[1].heroId='enemy';scene.tablePolicy={mode:'rules',epoch:1};
 const prepared=core.prepare(scene,{actorId:'hero',kind:'turn-start',eventId:`setup-${++serial}`});assert.equal(prepared.ok,true,prepared.errors?.join(' '));
 context.Scene=context.normalizeScene(engine.dispatchMany(scene,prepared.events).scene);context.Scene.undo=[];context.Scene.redo=[];context.Scene.turnUndo=[];
 value('lwDestination=null;lwTechniqueDraft=null;lwGeometryPreview=null;');pending=refuse=false;room='one';role='gm';pendingActor=null;renders=0;seenDrafts=[];queued=[];
}
function click(dataset,attributes){
 const attrs=new Set(attributes),root={dataset:{lwActor:'hero'},querySelectorAll:()=>[]},button={dataset,hasAttribute:name=>attrs.has(name)};
 button.closest=selector=>selector==='[data-lw-root]'?root:selector==='.lw-pending'?{querySelector:()=>null}:[...attrs].some(name=>selector.includes(`[${name}]`))?button:null;
 let stopped=false;for(const handler of handlers){handler({target:button,preventDefault(){},stopImmediatePropagation(){stopped=true;}});if(stopped)break;}
}
const confirm=()=>click({lwActor:'hero'},['data-lw-technique-confirm']);
const cell=()=>click({sceneCell:'1,2'},['data-scene-cell']);
function htmlButton(html,attribute,text=null){
 const needle=text===null?attribute:`${attribute}="${text}"`,tag=[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]).find(value=>value.includes(needle));assert.ok(tag,`The real pending UI offers ${needle}`);
 const dataset={},attributes=[];for(const [,name,value='']of tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){attributes.push(name);if(name.startsWith('data-'))dataset[name.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=value;}return [dataset,attributes];
}
const pendingButton=(attribute,text=null)=>htmlButton(context.lwPendingHtml(),attribute,text);
const sheetButton=(attribute,text=null)=>htmlButton(context.coreSheetPanel(),attribute,text);
function flowButton(attribute){context.renderSceneFlow();return htmlButton(flowRoot.innerHTML,attribute);}
function attackPreview(){context.Scene.targetIds=['enemy'];context.lwBeginActionPreview('hero',{kind:'action',actionId:engine.ACTION_IDS.skirmish,targetIds:['enemy']},'Attack');context.lwTechniqueDraftHtml(context.Scene.actors[0]);const preview=value('lwTechniqueDraft.preview');assert.equal(preview.ok,true,preview.errors?.join(' '));return clone(preview.events);}

fresh();const before=clone(context.Scene),events=attackPreview(),expected=context.normalizeScene(engine.dispatchMany(before,events,{expectedVersion:before.version}).scene);renders=0;seenDrafts=[];
confirm();assert.equal(renders,1,'A local confirmation uses the canonical writer render once');assert.deepEqual(seenDrafts,[false],'The writer renders the committed Scene after releasing the private preview');assert.equal(value('lwTechniqueDraft'),null);
assert.deepEqual(clone(context.Scene.actors),clone(expected.actors));assert.deepEqual(clone(context.Scene.pendingAction),clone(expected.pendingAction));assert.equal(context.Scene.undo.length,1);
const applied=clone(context.Scene);confirm();assert.deepEqual(clone(context.Scene),applied,'A repeated confirm has no active draft to spend again');assert.equal(renders,2,'The obsolete button only refreshes its presentation');

fresh();attackPreview();const declined=clone(context.Scene),draft=value('lwTechniqueDraft');refuse=true;renders=0;confirm();assert.equal(value('lwTechniqueDraft'),draft);assert.deepEqual(clone(context.Scene),declined);assert.equal(renders,0,'A refused writer retains the existing visible preview without rebuilding it');
refuse=false;confirm();assert.ok(context.Scene.pendingAction);assert.equal(context.Scene.undo.length,1);assert.equal(renders,1);

fresh();attackPreview();const queuedBefore=clone(context.Scene);pending=true;renders=0;seenDrafts=[];confirm();assert.equal(renders,1,'Queued confirmation clears the private preview with one explicit UI render');assert.deepEqual(seenDrafts,[false]);assert.deepEqual(clone(context.Scene),queuedBefore);assert.equal(value('lwTechniqueDraft'),null);
fresh();attackPreview();const blockedDraft=value('lwTechniqueDraft'),blockedBefore=clone(context.Scene);pendingActor='hero';renders=0;confirm();assert.equal(value('lwTechniqueDraft'),blockedDraft);assert.equal(renders,0);assert.deepEqual(clone(context.Scene),blockedBefore);

function destination(){context.lwSetDestination({actorId:'hero',payload:{kind:'action',actionId:engine.ACTION_IDS.step,targetIds:[]},label:'Step'});}
fresh();destination();renders=0;seenDrafts=[];cell();assert.equal(renders,1);assert.deepEqual(seenDrafts,[false]);assert.equal(context.Scene.actors[0].y,2);assert.equal(value('lwDestination'),null);
fresh();destination();const destinationBefore=clone(context.Scene),picker=value('lwDestination');refuse=true;renders=0;cell();assert.equal(value('lwDestination'),picker);assert.equal(renders,0);assert.deepEqual(clone(context.Scene),destinationBefore);
for(const change of [()=>room='other',()=>role='player',()=>context.Scene.selectedActor='enemy',()=>context.Scene.turnSerial++]){
 fresh();destination();change();const stale=clone(context.Scene);renders=0;cell();assert.equal(value('lwDestination'),null);assert.deepEqual(clone(context.Scene),stale,'The handler itself rejects an obsolete picker without relying on a prior render');assert.equal(context.Scene.undo.length,0);
}
// Read the real pending reaction button, then deliver its retained click after
// another Attack replaced the original window with the same source and target.
fresh();attackPreview();confirm();const oldAttack=context.Scene.pendingAction.id,capturedBlock=pendingButton('data-lw-reaction','block'),capturedCancel=pendingButton('data-lw-cancel');
assert.ok(context.lwSubmit('enemy',{kind:'reaction',choice:'take'},'Take'));const capturedResolve=pendingButton('data-lw-resolve');
for(const [actorId,kind]of [['hero','cancel-attack'],['hero','turn-end'],['enemy','turn-start'],['enemy','turn-end'],[null,'round-end'],['hero','turn-start']])assert.ok(context.lwSubmit(actorId,{kind},kind),context.lastNotice);
attackPreview();confirm();assert.notEqual(context.Scene.pendingAction.id,oldAttack);
const replacedAttack=JSON.stringify(context.Scene);click(...capturedBlock);click(...capturedCancel);assert.ok(JSON.stringify(context.Scene)===replacedAttack,'An old reaction/cancel button cannot answer or pay for the replacement Attack');
const liveAttack=context.Scene.pendingAction.id,liveBlock=pendingButton('data-lw-reaction','block');pending=true;click(...liveBlock);assert.equal(queued.at(-1)[0].payload.attackId,liveAttack,'A queued reaction carries its original Attack identity to canonical acceptance');assert.ok(JSON.stringify(context.Scene)===replacedAttack,'Queueing cannot pay reaction costs locally');pending=false;
click(...liveBlock);assert.equal(context.Scene.pendingAction.responses.enemy.choice,'block','The current stamped button still uses the real reaction');const ready=JSON.stringify(context.Scene);click(...capturedResolve);assert.ok(JSON.stringify(context.Scene)===ready,'An old resolve button cannot resolve the ready replacement Attack');
click(...pendingButton('data-lw-resolve'));assert.equal(context.Scene.pendingAction,null);
for(const surface of ['sheet','flow']){
 fresh();attackPreview();confirm();
 const button=surface==='sheet'?sheetButton:flowButton,oldCancel=button('data-core-cancel-pending'),oldReaction=surface==='sheet'?sheetButton('data-core-reaction','block'):null;
 assert.ok(context.lwSubmit('enemy',{kind:'reaction',choice:'take'},'Take'));const oldResolve=button('data-core-resolve');
 for(const [actorId,kind]of [['hero','cancel-attack'],['hero','turn-end'],['enemy','turn-start'],['enemy','turn-end'],[null,'round-end'],['hero','turn-start']])assert.ok(context.lwSubmit(actorId,{kind},kind),context.lastNotice);
 attackPreview();confirm();const unchanged=JSON.stringify(context.Scene),attackId=context.Scene.pendingAction.id;
 click(...oldCancel);if(oldReaction)click(...oldReaction);click(...oldResolve);
 assert.equal(JSON.stringify(context.Scene),unchanged,`Retained ${surface} controls cannot affect the replacement Attack`);
 const currentCancel=button('data-core-cancel-pending');pending=true;click(...currentCancel);assert.equal(queued.at(-1)[0].payload.attackId,attackId,`${surface} queued cancel carries the rendered Attack stamp`);assert.equal(JSON.stringify(context.Scene),unchanged);pending=false;
 if(surface==='sheet'){
  const currentReaction=sheetButton('data-core-reaction','block');pending=true;click(...currentReaction);assert.equal(queued.at(-1)[0].payload.attackId,attackId,'Core sheet queued reaction carries the rendered Attack stamp');assert.equal(JSON.stringify(context.Scene),unchanged);pending=false;
  click(...currentReaction);assert.equal(context.Scene.pendingAction.responses.enemy.choice,'block','The core sheet routes its native reaction through the LionWing canonical writer');
 }else assert.ok(context.lwSubmit('enemy',{kind:'reaction',choice:'take'},'Take'));
 const readyScene=JSON.stringify(context.Scene),currentResolve=button('data-core-resolve');click(...oldResolve);assert.equal(JSON.stringify(context.Scene),readyScene,`Retained ${surface} resolve cannot apply replacement damage`);
 pending=true;click(...currentResolve);assert.equal(queued.at(-1)[0].payload.attackId,attackId,`${surface} queued resolve carries the rendered Attack stamp`);assert.equal(JSON.stringify(context.Scene),readyScene);pending=false;
 click(...currentResolve);assert.equal(context.Scene.pendingAction,null,`Current ${surface} resolve commits the ready Attack`);
}
console.log('LionWing handler response: actual click controller + native/core-sheet/flow renderers + prepare/reducer/normalize/history writer preserve canonical Attack/Step, one local/queued render, no double spend, refusal retry, pending command and stale room/role/selection/Turn/Attack guards. DOM/transport mocked.');
