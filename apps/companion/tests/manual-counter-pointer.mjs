import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const {context,engine}=runtime();
vm.runInContext(read('scene-table-policy.js'),context);context.window.DAWN_TABLE_POLICY.install(engine,context.window.DAWN_LIONWING_ENGINE);
const ids=new Map(),documentEvents=new Map();
// DOM identity fixture: an innerHTML replacement disconnects every old child.
// Native pointer delivery is not emulated: the assertion requires the actual
// pressed button to survive before a click is delivered to production code.
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.events=new Map();this.value='';this.hidden=false;this.disabled=false;this.markup='';}
 get isConnected(){return this===host||Boolean(this.parent?.isConnected);}
 append(node){node.remove();node.parent=this;this.children.push(node);if(node.id)ids.set(node.id,node);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
 setAttribute(key,value){this.attrs[key]=String(value);if(key==='value')this.defaultValue=String(value);}
 getAttribute(key){return this.attrs[key]??null;}
 addEventListener(type,fn){this.events.set(type,fn);}
 fire(type,target=this){this.events.get(type)?.({target,preventDefault(){},stopPropagation(){}});}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 matches(selector){if(selector.startsWith('.'))return this.className===selector.slice(1);const match=selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);if(!match)return false;const key=match[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return key in this.dataset&&(match[2]===undefined||this.dataset[key]===match[2]);}
 closest(selector){return this.matches(selector)?this:this.parent?.closest(selector)||null;}
 querySelectorAll(selector){const found=[];for(const child of this.children){if(selector==='details'?child.tagName==='DETAILS':child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 focus(){context.document.activeElement=this;}
 set innerHTML(value){
  this.markup=value;for(const child of this.children)child.parent=null;this.children=[];
  if(this.id!=='scene-manual-footer'&&this.className!=='manual-token-counters')return;
  for(const match of value.matchAll(/<(input|button|details)\b([^>]*)>/g)){
   const node=new Element(match[1]);for(const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)){
    const [,,raw]=attr,key=attr[1];node.attrs[key]=raw??'';
    if(key.startsWith('data-'))node.dataset[key.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=raw??'';
    if(key==='value')node.value=raw??'';if(key==='disabled')node.disabled=true;
   }this.append(node);
  }
 }
 get innerHTML(){return this.markup;}
}
const host=new Element('section');host.id='scene-workbench';ids.set(host.id,host);
let role='gm',room='one',deliveries=0,writes=0;
Object.assign(context,{structuredClone,document:{activeElement:null,getElementById:id=>ids.get(id)||null,createElement:tag=>new Element(tag),addEventListener:(type,fn)=>documentEvents.set(type,fn)},
 Scene:fixture(),store:{sceneUi:{}},$:id=>ids.get(id)||null,Sync:{state:()=>({sceneId:room})},manualClockScope:()=>`${room}:0`,manualTableActive:()=>context.Scene.tablePolicy.mode==='manual',
 activeSceneView:()=>role,canControlSceneActor:()=>role==='gm',manualTableCopy:ru=>ru,esc:String,persist(){},uid:()=>`counter-event-${writes+1}`});
context.Scene.tablePolicy={mode:'manual',epoch:0};
context.commitSceneEvents=(label,events)=>{const result=engine.dispatchMany(context.Scene,events,{expectedVersion:context.Scene.version});context.Scene=result.scene;writes+=result.events.length;render();return result;};
context.renderScene=()=>render();
vm.runInContext(read('scene-manual-workspace.js'),context);
const source=read('scene-manual-integration.js');
vm.runInContext(source.slice(source.indexOf('function renderManualTokenCounters(){'),source.indexOf('function manualTensionScope(){')),context);
vm.runInContext(source.slice(source.indexOf('function manualTensionScope(){'),source.indexOf('function renderManualTensionContext(')),context);
vm.runInContext(source.slice(source.indexOf('function submitManualNumber('),source.indexOf('window.DAWN_TABLE_POLICY?.install()')),context);
const ui=context.window.DAWN_MANUAL_WORKSPACE;
function render(){ui.render({scene:context.Scene,scopeId:room,canNarrate:()=>role==='gm',canControl:()=>role==='gm',readAbilities:()=>[],editResource:(actor,change)=>context.submitManualNumber(actor,{kind:'resource',values:{[change.field]:change.value}},'Health'),afterFooterRender:context.renderManualTokenCounters});context.renderManualTokenCounters();}
const actor=()=>context.Scene.actors.find(row=>row.id==='hero'),footer=()=>ids.get('scene-manual-footer'),panel=()=>footer().querySelector('.manual-token-counters');
const plus=key=>panel().querySelectorAll('[data-token-count]').find(button=>button.dataset.tokenCount===key&&button.dataset.tokenDelta==='1');
const countInput=key=>panel().querySelector(`[data-token-count-input="${key}"]`);
const hp=()=>footer().querySelector('[data-manual-hp]');
function clickPressed(button){assert.equal(button.isConnected,true,'The pressed counter must survive through pointerup');assert.equal(button.disabled,false);deliveries++;button.parent.fire('click',button);}

render();
const initialHp=hp(),initialPanel=panel(),initialPlus=plus('focus');
for(let index=0;index<9;index++)clickPressed(initialPlus);
assert.equal(deliveries,9);assert.equal(actor().focus,15);assert.equal(writes,9);assert.equal(panel(),initialPanel);assert.equal(hp(),initialHp);assert.equal(plus('focus'),initialPlus);
assert.equal(countInput('focus').value,'15');
// Pointerdown fixes a target before changing/blur of the old edited input.
const pressedFocus=plus('focus'),dirtyAp=countInput('ap');dirtyAp.value='8';dirtyAp.focus();panel().fire('change',dirtyAp);pressedFocus.focus();clickPressed(pressedFocus);
assert.equal(actor().ap,8);assert.equal(actor().focus,16);assert.equal(writes,11);
const pressedAp=plus('ap'),dirtyHp=hp();dirtyHp.value='22';dirtyHp.focus();footer().fire('change',dirtyHp);footer().fire('focusout',dirtyHp);pressedAp.focus();clickPressed(pressedAp);
assert.equal(actor().hp,22);assert.equal(actor().ap,9);assert.equal(writes,13,'HP change/focusout submits once, and only the delivered AP click changes AP');
// An unrelated canonical update between pointerdown and pointerup keeps the target.
const pressedNext=plus('focus');context.commitSceneEvents('External wounds',[{type:'table.command',actorId:'hero',payload:{kind:'resource',values:{wounds:2}}}]);clickPressed(pressedNext);assert.equal(actor().focus,17);
// Focused unfinished counter drafts survive external number updates.
const draft=countInput('ap');draft.value='19';draft.focus();context.commitSceneEvents('External Focus',[{type:'table.command',actorId:'hero',payload:{kind:'resource',values:{focus:20}}}]);assert.equal(countInput('ap'),draft);assert.equal(draft.value,'19');assert.equal(actor().ap,9);
// A local submission marker cannot suppress the same correction after Undo.
hp().value='5';hp().focus();footer().fire('change',hp());assert.equal(actor().hp,5);context.document.activeElement=null;
context.commitSceneEvents('External Health',[{type:'table.command',actorId:'hero',payload:{kind:'resource',values:{hp:7}}}]);assert.equal(hp().value,'7');const repeatBefore=writes;hp().value='5';hp().focus();footer().fire('change',hp());assert.equal(actor().hp,5);assert.equal(writes,repeatBefore+1);
// An applied network receipt retires only the matching pending number marker.
hp().manualSubmitted='5';hp().manualSubmission={pending:true,clientIntentId:'health-applied'};
ui.reconcileNumber({status:'applied',clientIntentId:'another-command'});assert.equal(hp().manualSubmission.pending,true);
ui.reconcileNumber({status:'applied',clientIntentId:'health-applied'});assert.equal(hp().manualSubmission,undefined);
context.document.activeElement=null;context.commitSceneEvents('External Health after receipt',[{type:'table.command',actorId:'hero',payload:{kind:'resource',values:{hp:7}}}]);
const appliedBefore=writes;hp().value='5';hp().focus();footer().fire('change',hp());assert.equal(actor().hp,5);assert.equal(writes,appliedBefore+1);
// Counter identity follows the same visible fallback actor as Health.
context.Scene.selectedActor=null;render();assert.equal(hp().dataset.manualActor,'hero');const fallbackBefore=actor().focus;clickPressed(plus('focus'));assert.equal(actor().focus,fallbackBefore+1);
context.Scene.actors.push({...clone(actor()),id:'other-space',space:'elsewhere'});context.Scene.selectedActor='other-space';render();assert.equal(hp().dataset.manualActor,'hero');assert.equal(panel().dataset.actorId,'hero');const offFieldBefore=actor().focus;clickPressed(plus('focus'));assert.equal(actor().focus,offFieldBefore+1);context.Scene.selectedActor='hero';render();
// Scope changes intentionally disconnect old controls; retained listeners cannot write.
const oldButton=plus('focus'),oldPanel=panel(),before=clone(context.Scene);room='two';render();assert.equal(oldButton.isConnected,false);oldPanel.fire('click',oldButton);assert.deepEqual(clone(context.Scene),before);
role='player';render();const writesBefore=writes;panel().fire('click',plus('ap'));assert.equal(writes,writesBefore,'revoked control rejects retained actions');
console.log('Manual counter pointer order: actual workspace/counter renderers and reducer preserve pressed nodes through dirty AP/HP change, duplicate blur and unrelated updates; exactly delivered clicks commit once. DOM identity fixture, not native browser dispatch evidence.');
