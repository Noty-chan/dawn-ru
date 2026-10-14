import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

const source=fs.readFileSync(new URL('../lionwing-ui.js',import.meta.url),'utf8');
const slice=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const {context,core,engine}=runtime();
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&amp;','&');
let serial=0,view='gm',narrator=true;
const root={dataset:{},controls:[],closest:()=>null,querySelectorAll(selector){return selector==='details'?[]:selector==='[data-lw-root]'?[owner]:this.controls}};
const owner={dataset:{lwActor:'hero'},className:'lw-actions',closest:()=>null,querySelectorAll:()=>root.controls};
const document={activeElement:null,addEventListener(){}};
Object.assign(context,{Scene:fixture(),SceneEngine:engine,LionwingEngine:core,document,$:()=>root,
  lwOwns:id=>narrator||id==='hero',lwCanNarrate:()=>narrator,activeSceneView:()=>view,
  lwRefreshCunningActions(){},lwRefreshPendingControls(){},
  esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
});
vm.runInContext(slice('const lwTechniqueText =','const lwTechniqueEnabled ='),context);
vm.runInContext(slice('function lwTechniqueTargetVisible(','function lwTechniqueDraftHtml('),context);
vm.runInContext(slice('const lwFormDraft =','let lwDraftEnabled='),context);
vm.runInContext(slice('function lwPendingWindowHtml(','function lwAutomationHtml('),context);
const run=payload=>{
  const prepared=core.prepare(context.Scene,{...payload,actorId:'hero',eventId:`pending-ui:${++serial}`},{random:()=>0.35});
  assert.equal(prepared.ok,true,prepared.errors?.join(' '));
  context.Scene=core.dispatchMany(context.Scene,prepared.events).scene;
};
function field(attribute,defaultValue='',pending=null){
  return {attributes:[{name:attribute,value:''}],dataset:{},id:'',name:'',tagName:'INPUT',type:'text',defaultValue:String(defaultValue),value:String(defaultValue),disabled:false,readOnly:false,
    selectionStart:0,selectionEnd:0,selectionDirection:'none',
    closest:selector=>selector==='[data-lw-root]'?owner:selector==='[data-lw-pending-window]'?pending:null,
    focus(){document.activeElement=this},setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction},
  };
}
function paint(){
  const before=clone(context.Scene),html=context.lwPendingHtml();
  const token=html.match(/data-lw-pending-window="([^"]*)"/)?.[1];
  const pending=token?{dataset:{lwPendingWindow:decode(token)}}:null;
  root.controls=[field('data-lw-focus','0'),field('data-lw-general-note','')];
  for(const input of html.matchAll(/<input\b[^>]*>/g)){
    const attribute=input[0].match(/\b(data-lw-[\w-]+)/)?.[1];
    if(attribute)root.controls.push(field(attribute,decode(input[0].match(/\bvalue="([^"]*)"/)?.[1]||''),pending));
  }
  document.activeElement=null;root.dataset.lwCockpitScope=context.lwCockpitUiScope('hero');
  assert.deepEqual(clone(context.Scene),before,'pending markup is read-only');
  return html;
}
const get=name=>root.controls.find(item=>item.attributes[0].name===`data-lw-${name}`);
const capture=()=>context.lwCaptureDirectorUi(root,root.dataset.lwCockpitScope);
const restore=state=>{context.lwRestoreFormDrafts(root,{refreshActions:false});context.lwRestoreDirectorUi(root,state)};
const mapSize=()=>vm.runInContext('lwFormDraft.size',context);

// Two canonical prompts for one actor must not share a decision note/focus.
run({kind:'prompt',targetId:'hero',title:'First independent decision'});paint();
get('choice-note').value='First decision draft';get('choice-note').focus();get('choice-note').setSelectionRange(2,7,'backward');
get('focus').value='2';get('general-note').value='Unrelated cockpit draft';
const firstChoice=context.Scene.lionwing.choices[0].id;
let state=capture();context.Scene.actors[0].hp=24;context.Scene.version++;paint();restore(state);
assert.equal(get('choice-note').value,'First decision draft','same-choice updates preserve the unsent note');
assert.equal(document.activeElement,get('choice-note'));assert.deepEqual([get('choice-note').selectionStart,get('choice-note').selectionEnd,get('choice-note').selectionDirection],[2,7,'backward']);
state=capture();run({kind:'choice',id:firstChoice,choice:'record',note:'Recorded first decision'});run({kind:'prompt',targetId:'hero',title:'Second independent decision'});paint();restore(state);
assert.equal(get('choice-note').value,'','a new canonical choice never receives a previous decision note');
assert.equal(document.activeElement,null,'a new decision does not inherit previous decision focus');
assert.equal(get('focus').value,'2');assert.equal(get('general-note').value,'Unrelated cockpit draft','other cockpit drafts survive the choice transition');
assert.equal(mapSize(),2,'expired pending notes are removed rather than accumulating');
for(let i=0;i<8;i++){
  get('choice-note').value=`discard ${i}`;state=capture();
  run({kind:'choice',id:context.Scene.lionwing.choices[0].id,choice:'record',note:`record ${i}`});run({kind:'prompt',targetId:'hero',title:`New decision ${i}`});paint();restore(state);
  assert.equal(get('choice-note').value,'');assert.equal(mapSize(),2);
}

// Real isolated Duels have distinct IDs. Editing the first tension must retain
// the same Duel draft across resource updates and never transfer to the next.
function duel(){
  context.Scene=fixture();context.Scene.actors[1].x=2;context.Scene.actors[0].influence=5;
  run({kind:'action',actionId:'action.атаки.дуэль',targetIds:['enemy']});
  assert.equal(context.Scene.lionwing.choices[0].kind,'duel-outcome');
}
duel();paint();const firstDuel=context.Scene.lionwing.choices[0].context.duelId;
get('duel-tension').value='17';get('duel-tension').focus();get('focus').value='1';state=capture();
run({kind:'resource',targetId:'hero',resource:'focus',operation:'spend',amount:1});paint();restore(state);
assert.equal(get('duel-tension').value,'17','the current Duel retains its dirty tension value');assert.equal(document.activeElement,get('duel-tension'));
state=capture();duel();assert.notEqual(context.Scene.lionwing.choices[0].context.duelId,firstDuel);paint();restore(state);
assert.equal(get('duel-tension').value,String(context.Scene.lionwing.duels[0].tension),'a different Duel follows its current canonical tension');
assert.equal(document.activeElement,null);assert.equal(get('focus').value,'1');

// Local Player preview still holds the authoritative Scene. No hidden owner
// title, context, option label or control may be emitted by its pending panel.
context.Scene=fixture();context.Scene.actors[1].hidden=true;context.Scene.actors[1].name='PRIVATE_OWNER';
run({kind:'prompt',targetId:'enemy',title:'PRIVATE_TITLE',text:'PRIVATE_CONTEXT'});
context.Scene.lionwing.choices[0].context.optionLabels={record:'PRIVATE_OPTION'};
const canonical=clone(context.Scene);view='player';narrator=false;
assert.doesNotMatch(paint(),/PRIVATE_|data-lw-choice-note|data-lw-choice=/);
narrator=true;assert.doesNotMatch(paint(),/PRIVATE_/,'local GM permission does not defeat Player visibility');
view='gm';assert.match(paint(),/PRIVATE_OWNER/);assert.match(paint(),/PRIVATE_OPTION/);
assert.deepEqual(clone(context.Scene),canonical);

context.Scene=fixture();context.Scene.actors[1].hidden=true;context.Scene.actors[1].name='PRIVATE_PARTICIPANT';
context.Scene.lionwing.followups=[{id:'public',ruleId:'vagabond.speed-demon.1',status:'offered',ownerActorId:'hero',participantIds:['hero','enemy'],endBoundary:'anyTurnEnd'},
  {id:'private',status:'active',ownerActorId:'enemy',participantIds:['enemy'],ruleId:'PRIVATE_RULE',endBoundary:'PRIVATE_DEADLINE'}];
const followups=clone(context.Scene);view='gm';assert.match(paint(),/PRIVATE_PARTICIPANT/);
view='player';assert.doesNotMatch(paint(),/PRIVATE_|enemy/);assert.match(paint(),/hero/);
context.Scene.lionwing.followups=context.Scene.lionwing.followups.slice(1);assert.doesNotMatch(paint(),/PRIVATE_|enemy/);
assert.deepEqual(clone(context.Scene.actors),followups.actors,'privacy presentation leaves canonical participants intact');
console.log('LionWing pending retention: real sequential decisions/Duels, same-window dirty values/caret, unrelated drafts, bounded notes, current canonical tension and local Player hidden owner/continuation privacy passed (DOM fixture).');
