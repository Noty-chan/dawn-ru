import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8'),clone=value=>JSON.parse(JSON.stringify(value));
const context={window:{},console,Date};vm.createContext(context);
for(const file of ['data.js','edition-lionwing.js','logic.js'])vm.runInContext(read(file),context);
const engine=loadSceneEngine(context);vm.runInContext(read('scene-table-policy.js'),context);const policy=context.window.DAWN_TABLE_POLICY;
const fixture=()=>({rulesEdition:'lionwing',tablePolicy:{mode:'manual',epoch:3,processStatuses:false},manualTable:{actorId:'h',round:1},version:0,round:5,tension:2,turnSerial:8,activeActorId:'h',spaces:[{id:'main',width:7,height:7}],actors:[{id:'h',name:'Hero',kind:'hero',heroId:'h',space:'main',x:1,y:1,hp:10,maxHp:10,focus:3,ap:3,acted:false,ruleState:{power:1}}],objects:[],walls:[],markers:[],sessionClocks:[],log:[],undo:[],redo:[]});
let before=fixture(),after=clone(before);after.actors[0].name='New name';assert.equal(policy.validateSnapshot(before,after),true);
for(const mutate of [s=>s.tablePolicy.mode='rules',s=>s.tablePolicy.epoch++,s=>s.round++,s=>s.activeActorId=null,s=>s.lionwing={choices:[{id:'injected'}]},s=>s.actors[0].acted=true,s=>s.actors[0].ruleState.power=100,s=>s.actors[0].focus=5,s=>s.manualTable.round++]){after=clone(before);mutate(after);assert.throws(()=>policy.validateSnapshot(before,after),error=>error.code.startsWith('TABLE_SNAPSHOT'));assert.equal(before.actors[0].ruleState.power,1);}
after=clone(before);after.actors[0].focus=5;after.actors[0].x=2;after.manualTable.round++;assert.equal(policy.validateSnapshot(before,after,{history:true}),true);
after.actors[0].acted=true;assert.throws(()=>policy.validateSnapshot(before,after,{history:true}),/боевое состояние/);
after=clone(before);after.actors[0].focus=6;assert.equal(policy.validateSnapshot(before,after,{restore:true}),true);after.tablePolicy.mode='rules';assert.throws(()=>policy.validateSnapshot(before,after,{restore:true}),/Ведение/);
// The frozen Entities exports guard themselves; engine.install cannot wrap them.
policy.install();const entities=context.window.DAWN_LIONWING_ENTITIES;
for(const method of ['create','transform','prepareDestroy','destroy','changeOwner','link','unlink','pilotEnter','pilotExit','sourceLoss','transition','replay','undo','applyCleanup']){const saved=JSON.stringify(before);assert.throws(()=>entities[method](before,{}),error=>error.code==='TABLE_AUTOMATION_BLOCKED',method);assert.equal(JSON.stringify(before),saved);}
assert.deepEqual(clone(entities.reload(JSON.stringify(before))),before,'manual reload is storage-only');
// Real history controller; external DOM/storage/render are substituted.
let role='gm',messages=[];Object.assign(context,{Scene:clone(before),Sync:{state:()=>({})},activeSceneView:()=>role,sceneCore:clone,sceneSnapshot:()=>clone(context.Scene),uid:()=> 'id',store:{mode:'build'},toast:message=>{messages.push(message);return null},sceneEvent:()=>{},syncHeroFromScene:()=>{},persist:()=>{},renderScene:()=>{}});
const ui=read('scene-ui.js');vm.runInContext(ui.slice(ui.indexOf('function restoreSceneHistory('),ui.indexOf('function undoScene(')),context);
const rules=clone(before);rules.tablePolicy.mode='rules';const step={id:'switch',label:'Policy change',state:rules};const saved=JSON.stringify(context.Scene);assert.equal(context.restoreSceneHistory(step,[step],[],'Undo'),null);assert.equal(JSON.stringify(context.Scene),saved,'policy undo is atomic and refuses a return to rules');
const change={id:'hp-edit',type:'table.command',actorId:'h',payload:{kind:'resource',values:{hp:4}}};context.Scene=engine.dispatchMany(before,[change]).scene;
context.restoreSceneHistory({id:'hp',label:'HP',state:before},[{state:before}],[],'Undo');assert.equal(context.Scene.actors[0].hp,10);assert.equal(context.Scene.lionwing.receipts[0].id,'hp-edit');assert.equal(engine.dispatchMany(context.Scene,[change]).events.length,0,'undo must never forget committed event identities');
role='player';const protectedScene=JSON.stringify(context.Scene);assert.equal(context.restoreSceneHistory({state:before},[],[],'Undo'),null);assert.equal(JSON.stringify(context.Scene),protectedScene);role='gm';
// Actual network queue + authority entry point reject direct snapshot injection.
vm.runInContext(read('network-v2.js'),context);const network=context.window.DAWN_NETWORK_V2;network.setConfirmedScene(before);
let queued=[];Object.assign(context,{NetworkV2:network,normalizeScene:clone,ensureNetworkV2Runtime:()=>({authority:{enqueue:row=>queued.push(row)}}),Sync:{state:()=>({sceneId:'qa',canNarrate:true,version:0})}});
const sync=read('scene-sync-ui.js');vm.runInContext(sync.slice(sync.indexOf('function queueNetworkV2Snapshot('),sync.indexOf('function submitNetworkV2Events(')),context);
after=clone(before);after.actors[0].ruleState.power=999;assert.throws(()=>context.queueNetworkV2Snapshot(after,'Injected'),/боевое состояние/);assert.equal(queued.length,0);
after=clone(before);after.actors[0].name='Rename';assert.equal(context.queueNetworkV2Snapshot(after,'Rename'),true);assert.equal(queued.length,1);
vm.runInContext(sync.slice(sync.indexOf('async function flushNetworkV2Authority('),sync.indexOf('async function commitNetworkV2Tick(')),context);
const tampered=clone(before);tampered.lionwing={choices:[{id:'injected'}]};await assert.rejects(context.flushNetworkV2Authority([{kind:'snapshot',baseScene:before,scene:tampered}]),/замороженную механику/);
console.log('Manual snapshots: frozen runtime, policy/undo, receipts preserved, explicit backup limits, direct frozen Entities and actual network queue/flush guards passed; DOM/transport/normalization mocked');
