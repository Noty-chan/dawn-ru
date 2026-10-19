import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const lw=read('lionwing-ui.js'),play=read('play-ui.js'),ui=read('scene-ui.js');
const part=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const {context,core}=runtime();let view='gm',serial=0,disabled=false;
const document={activeElement:null,addEventListener(){}};
const root={dataset:{},controls:[],details:[],querySelectorAll:selector=>selector==='details'?root.details:selector==='[data-lw-root]'?[root.owner]:root.controls};
Object.assign(context,{Scene:fixture(),S:{id:'hero'},Sync:{state:()=>({sceneId:'room',userId:'user',canNarrate:true,role:'owner'})},document,$:()=>root,
  activeSceneView:()=>view,lwOwns:()=>true,lwCanNarrate:()=>true,lwGeometrySceneIdentity:()=> 'one-scene',lwRefreshCunningActions(){},lwRefreshPendingControls(){},esc:String});
for(const name of ['localization.js','locale-ru.js'])vm.runInContext(read(name),context);
vm.runInContext(part(lw,'const lwTechniqueText =','const lwTechniqueEnabled ='),context);
vm.runInContext(part(lw,'const lwFormDraft =','let lwDraftEnabled='),context);
vm.runInContext(part(lw,'function lwDiceHtml(','function lwDiceClick('),context);
if(ui.includes('function sceneSheetActor('))vm.runInContext(part(ui,'function sceneSheetActor(','function sceneSheetPanel('),context);
vm.runInContext(part(play,'function renderSceneHeroSheet(','function renderPlay('),context);
const selected=()=>context.Scene.actors.find(actor=>actor.id===context.Scene.selectedActor);
const commit=payload=>{const prepared=core.prepare(context.Scene,{...payload,actorId:'hero',eventId:`sheet:${++serial}`},{random:()=>0.35});assert.equal(prepared.ok,true,prepared.errors?.join(' '));context.Scene=core.dispatchMany(context.Scene,prepared.events).scene};
function field(attribute,value,{type='text',pending=null,roll=null,die=null,readOnly=false,locked=false}={}){
  const node={attributes:[{name:attribute,value:''}],dataset:{},tagName:type==='select-one'?'SELECT':'INPUT',type,defaultValue:String(value),value:String(value),disabled:locked,readOnly,id:'',name:'',
    selectionStart:0,selectionEnd:0,selectionDirection:'none',
    closest:selector=>selector==='[data-lw-root]'?root.owner:selector==='[data-scene-sheet-actor]'?root.sheet:selector==='[data-lw-pending-window]'?pending:selector==='[data-lw-roll]'?roll:selector==='[data-lw-die]'?die:null,
    focus(){document.activeElement=this},setSelectionRange(start,end,direction){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction}};
  if(type==='select-one'){
    node.options=Array.from({length:6},(_,i)=>({value:String(i+1),selected:i+1===Number(value),defaultSelected:i+1===Number(value)}));
    Object.defineProperty(node,'value',{get(){return this.options.find(option=>option.selected)?.value||''},set(next){for(const option of this.options)option.selected=option.value===String(next)}});
  }
  return node;
}
let markup='';Object.defineProperty(root,'innerHTML',{get:()=>markup,set(next){
  markup=next;root.sheet={dataset:{sceneSheetActor:selected()?.id}};root.owner={dataset:{lwActor:selected()?.id},className:'lw-actions',closest:()=>null,querySelectorAll:selector=>root.controls.filter(control=>control.attributes.some(attribute=>`[${attribute.name}]`===selector))};
  root.controls=[field('data-lw-general-note',''),field('data-lw-focus','0'),field('data-lw-correct-value',selected()?.hp||0),field('data-lw-read-only','canonical',{readOnly:true}),field('data-lw-disabled','canonical',{locked:true}),field('data-lw-file','',{type:'file'})];
  const diceMarkup=context.lwDiceHtml(selected());assert.ok(next.includes(diceMarkup),'the fixture consumes the actual dice renderer markup');
  for(const match of diceMarkup.matchAll(/data-lw-die="([^"]+)"[\s\S]*?<select data-lw-die-value([^>]*)>([\s\S]*?)<\/select>/g)){
    const prior=diceMarkup.slice(0,match.index),rollId=[...prior.matchAll(/data-lw-roll="([^"]+)"/g)].at(-1)?.[1],face=match[3].match(/<option selected>(\d)<\/option>/)?.[1];
    root.controls.push(field('data-lw-die-value',face,{type:'select-one',roll:{dataset:{lwRoll:rollId}},die:{dataset:{lwDie:match[1]}},locked:match[2].includes('disabled')}));
  }
  if(context.Scene.lionwing?.choices?.length)root.controls.push(field('data-lw-choice-note','',{pending:{dataset:{lwPendingWindow:context.lwPendingWindowKey()}}}));
  root.details=[{open:false,querySelector:()=>({textContent:'Dice'}),closest:selector=>selector==='[data-scene-sheet-actor]'?root.sheet:null}];document.activeElement=null;
}});
context.sceneSheetPanel=()=>context.lwDiceHtml(selected());
const paint=()=>{const before=clone(context.Scene);context.renderSceneHeroSheet();assert.deepEqual(clone(context.Scene),before,'sheet rendering is read-only')};
const get=name=>root.controls.find(control=>control.attributes[0].name===`data-lw-${name}`);
const dice=()=>root.controls.filter(control=>control.attributes[0].name==='data-lw-die-value');

commit({kind:'dice-create',roll:{id:'first',pool:1,sourceFaces:[3]}});paint();const firstDie=context.Scene.lionwing.diceRolls.first.dice[0].id;
assert.equal(dice()[0].value,'3');dice()[0].focus();
commit({kind:'dice-apply',rollId:'first',operation:{id:'face-five',kind:'change',dieId:firstDie,value:5}});paint();
assert.equal(dice()[0].value,'5','an untouched die selector follows the current canonical face');assert.equal(document.activeElement,dice()[0],'an untouched field keeps focus without pinning its old value');
get('general-note').value='Draft note';get('general-note').focus();get('general-note').setSelectionRange(2,6,'backward');get('focus').value='2';root.details[0].open=true;
dice()[0].value='4';commit({kind:'dice-apply',rollId:'first',operation:{id:'face-two',kind:'change',dieId:firstDie,value:2}});paint();
assert.equal(dice()[0].value,'4','a genuinely dirty face selection survives the same die update');assert.equal(get('general-note').value,'Draft note');assert.equal(get('focus').value,'2');assert.equal(root.details[0].open,true);assert.equal(document.activeElement,get('general-note'));assert.deepEqual([get('general-note').selectionStart,get('general-note').selectionEnd,get('general-note').selectionDirection],[2,6,'backward']);
get('read-only').value='old';get('disabled').value='old';get('file').value='fake file';paint();assert.equal(get('read-only').value,'canonical');assert.equal(get('disabled').value,'canonical');assert.equal(get('file').value,'');
commit({kind:'dice-create',roll:{id:'second',pool:1,sourceFaces:[3]}});paint();assert.equal(dice()[0].value,'3','a new roll never inherits another die draft');assert.equal(dice()[1].value,'4','the original die draft survives a new roll inserted before it');
commit({kind:'dice-apply',rollId:'first',operation:{id:'lock-first',kind:'lock',dieId:firstDie}});paint();assert.equal(dice()[1].disabled,true);assert.equal(dice()[1].value,'2','newly locked controls follow canonical values and cannot restore a dirty face');
commit({kind:'prompt',title:'First choice'});paint();get('choice-note').value='First window draft';paint();assert.equal(get('choice-note').value,'First window draft');
commit({kind:'choice',id:context.Scene.lionwing.choices[0].id,choice:'record',note:'Record'});commit({kind:'prompt',title:'Second choice'});paint();assert.equal(get('choice-note').value,'','pending window changes clear only their own note');assert.equal(get('general-note').value,'Draft note');
context.Scene.actors[0].ownerId='different-owner';paint();assert.equal(get('general-note').value,'','a new owner of the same actor cannot receive an old draft');get('general-note').value='Different owner draft';delete context.Scene.actors[0].ownerId;paint();assert.equal(get('general-note').value,'','an owner roundtrip cannot resurrect a discarded draft');
context.Scene.actors[0].heroId='reassigned';paint();assert.equal(get('general-note').value,'','same actor ID with different character binding cannot receive an old draft');
context.Scene.selectedActor='enemy';paint();assert.equal(get('focus').value,'0','another source cannot inherit the previous actor parameters');
context.Scene.selectedActor='hero';context.Scene.actors[0].heroId='hero';paint();assert.equal(get('general-note').value,'','returning to a reassigned source cannot resurrect discarded drafts');
console.log('Scene sheet drafts: actual canonical dice operations/markup, fresh untouched faces, dirty stable-die retention through reordered rolls, locked/file/read-only guards, caret/disclosure, pending windows and source reassignment passed (DOM fixture).');
