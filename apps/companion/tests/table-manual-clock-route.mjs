import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';
const context={window:{},console,Scene:{tablePolicy:{mode:'manual',epoch:2},version:0,selectedActor:'a',actors:[{id:'a',name:'A',hp:6,maxHp:10,ap:3,focus:2},{id:'b',name:'B',hp:8,maxHp:10}],sessionClocks:[]},isEnglishPreview:()=>false,activeSceneView:()=> 'player',canControlSceneActor:a=>a.id==='a'};
vm.createContext(context);loadSceneEngine(context);
let eventSequence=0;context.uid=()=>`clock-event-${++eventSequence}`;
context.commitSceneEvents=(label,events)=>{const result=context.window.DAWN_TABLE_POLICY.dispatchMany(context.Scene,events);context.Scene=result.scene;return result};
const source=fs.readFileSync(new URL('../scene-manual-integration.js',import.meta.url),'utf8');
vm.runInContext(source.slice(0,source.indexOf('function manualTableRoll')),context);
const values=JSON.stringify(context.Scene.actors);
assert.ok(context.manualClockCommand({kind:'clock/create',clock:{id:'c',name:'Counter',kind:'counter',size:6,value:0}}));
assert.equal(context.Scene.sessionClocks[0].ownerActorId,'a');
context.Scene.selectedActor='b';
assert.ok(context.manualClockCommand({kind:'clock/set',id:'c',value:4}),'clock owner remains usable after selection changes');
assert.equal(context.Scene.sessionClocks[0].value,4);
context.canControlSceneActor=()=>false;
assert.equal(context.manualClockCommand({kind:'clock/remove',id:'c'}),null,'ownership loss blocks stale controls');
context.activeSceneView=()=> 'gm';
assert.throws(()=>context.manualClockCommand({kind:'clock/set',id:'c',value:7}));
assert.equal(context.Scene.sessionClocks[0].value,4,'invalid update is atomic');
assert.ok(context.manualClockCommand({kind:'clock/remove',id:'c'}));
assert.equal(context.Scene.sessionClocks.length,0);
assert.equal(JSON.stringify(context.Scene.actors),values,'clocks never spend actor resources or execute mechanics');
context.Scene.actors.push({id:'secret',hidden:true});
context.Scene.sessionClocks=[{id:'private',manual:true,ownerActorId:'secret',name:'Secret plan'},{id:'orphan',manual:true,ownerActorId:'missing'},{id:'public',manual:true,ownerActorId:null}];
const projected=context.window.DAWN_SCENE_ENGINE.projectScene(context.Scene,{role:'player'});
assert.deepEqual(Array.from(projected.sessionClocks,c=>c.id),['public'],'redacted or missing owner never exposes personal clocks');
assert.equal(context.window.DAWN_SCENE_ENGINE.projectScene(context.Scene,{role:'gm'}).sessionClocks.length,3);
context.Scene.sessionClocks[0].size=6;context.Scene.sessionClocks[0].value=0;
assert.ok(context.manualClockCommand({kind:'clock/set',id:'private',value:2}));
assert.equal(context.Scene.log[0].visibility,'gm','GM edits inherit hidden clock visibility');
assert.ok(context.manualClockCommand({kind:'clock/remove',id:'private'}));
assert.equal(context.Scene.log[0].visibility,'gm','GM removal keeps hidden clock visibility');
context.Scene.tablePolicy.mode='rules';
assert.equal(context.manualClockCommand({kind:'clock/create',clock:{id:'other',name:'Other',kind:'progress',size:4}}),null);
context.Scene.tablePolicy.mode='manual';context.activeSceneView=()=> 'player';context.canControlSceneActor=()=>true;
context.Scene.sessionClocks=[{id:'draft',manual:true,ownerActorId:'a',size:6,value:1}];
const focused={dataset:{manualClockId:'draft'},value:'4',max:'6'};
let closed=false,replaced=false;
const dialog={open:true,contains:()=>true,dataset:{scope:'local:2:0',visibility:context.manualClockVisibilityScope()},close:()=>closed=true,querySelectorAll:()=>[],querySelector:()=>({replaceChildren:()=>{replaced=true;throw Error('rebuild')}})};
context.Sync={state:()=>({})};context.$=()=>dialog;context.document={activeElement:focused};
context.renderManualClocks();assert.equal(replaced,false);assert.equal(focused.value,'4','unconfirmed draft survives scene render');
context.Scene.sessionClocks[0].size=3;context.renderManualClocks();assert.equal(focused.max,'3','new bounds update without losing draft');
context.canControlSceneActor=()=>false;assert.throws(()=>context.renderManualClocks(),/rebuild/,'lost rights reset stale editor');
context.canControlSceneActor=()=>true;context.Scene.actors.find(a=>a.id==='a').hidden=true;assert.throws(()=>context.renderManualClocks(),/rebuild/,'hidden owner resets stale visible rows');
context.Scene.actors.find(a=>a.id==='a').hidden=false;context.activeSceneView=()=> 'gm';dialog.dataset.visibility=context.manualClockVisibilityScope();context.activeSceneView=()=> 'player';assert.throws(()=>context.renderManualClocks(),/rebuild/,'view changes rebuild every private row despite focused own clock');
context.Scene.tablePolicy.epoch=3;context.renderManualClocks();assert.equal(closed,true,'changed policy closes stale dialog');
console.log('manual clock UI route: create/set/remove, owner recheck, atomic bounds and no combat mutations passed');

// Actual renderer/listeners with a delayed writer and fresh DOM controls.
context.activeSceneView=()=> 'gm';context.Scene.tablePolicy.epoch=0;
context.Scene.sessionClocks=[{id:'clock-a',manual:true,ownerActorId:null,name:'A',size:6,value:0}];
let inputs=[],createdInputs=[],clockSends=0,rebuildChange=null;
class ClockNode {
  constructor(tag){this.tag=tag;this.dataset={};this.events={};this.children=[];this.value='';}
  setAttribute(){} append(...nodes){this.children.push(...nodes);}
  addEventListener(type,callback){this.events[type]=callback;}
  checkValidity(){return this.value!==''&&Number.isSafeInteger(Number(this.value))&&Number(this.value)>=0&&Number(this.value)<=Number(this.max);}
  focus(){context.document.activeElement=this;}
}
const list=new ClockNode('div');list.replaceChildren=()=>{rebuildChange?.();inputs=[];createdInputs=[];list.children=[];};
Object.defineProperty(list,'childElementCount',{get:()=>list.children.length});
const create=new ClockNode('button');
const pendingDialog={open:true,dataset:{scope:'local:0:0'},contains:input=>inputs.includes(input),close(){this.open=false},querySelector:selector=>selector==='[data-clock-list]'?list:create,querySelectorAll:()=>inputs};
context.$=id=>id==='manual-table-clocks'?pendingDialog:null;
context.document={activeElement:null,createElement:tag=>{const node=new ClockNode(tag);if(tag==='input'){createdInputs.push(node);inputs.push(node);}return node}};
context.manualClockCommand=()=>({pending:true,clientIntentId:`clock-intent-${++clockSends}`,manualEventIds:[`clock-event-${clockSends}`]});
context.renderManualClocks();let clockInput=inputs[0];clockInput.value='2';context.document.activeElement=clockInput;
clockInput.events.change();assert.equal(clockSends,1);
clockInput.events.blur();assert.equal(clockSends,1,'change followed by a delayed blur submits once');
context.document.activeElement=clockInput;rebuildChange=()=>clockInput.events.change();
context.Scene.sessionClocks.push({id:'clock-b',manual:true,ownerActorId:null,name:'B',size:6,value:0});
context.renderManualClocks();assert.equal(clockSends,1,'adding another clock cannot resubmit dirty input during DOM replacement');
assert.notEqual(inputs[0],clockInput);clockInput=inputs[0];assert.equal(clockInput.value,'2');assert.equal(context.document.activeElement,clockInput);
rebuildChange=null;clockInput.events.blur();assert.equal(clockSends,1,'fresh clock input retains its pending submission marker');
context.reconcileManualClockNumbers({status:'rejected',payload:{clientIntentId:'other'}});assert.equal(clockInput.manualSubmitted,'2');
context.reconcileManualClockNumbers({status:'rejected',payload:{clientIntentId:'clock-intent-1'}});assert.equal(clockInput.manualSubmitted,undefined);
context.document.activeElement=clockInput;clockInput.events.change();assert.equal(clockSends,2,'exact rejection restores a retry');
clockInput.value='3';context.manualClockCommand=()=>{clockSends++;return null;};clockInput.events.change();assert.equal(clockInput.manualSubmitted,undefined);
clockInput.events.blur();assert.equal(clockSends,4,'immediate refusal never locks a retry');
clockInput.value='';clockInput.events.change();assert.equal(clockSends,4,'blank clock input does not write zero');
console.log('Manual clock actual DOM handlers: delayed writer, fresh-node rebuild, repaint suppression, exact rejection, retry and blank input passed.');
