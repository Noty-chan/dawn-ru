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
after=clone(before);after.actors[0].focus=5;after.actors[0].x=2;after.manualTable.round++;before.undo=[{state:clone(after)}];assert.equal(policy.validateSnapshot(before,after,{history:true}),true);
after.actors[0].hp=777;assert.throws(()=>policy.validateSnapshot(before,after,{history:true}),/сохранённый шаг/);after.actors[0].hp=10;
after.actors[0].acted=true;assert.throws(()=>policy.validateSnapshot(before,after,{history:true}),/сохранённый шаг/);
after=clone(before);after.actors[0].focus=6;assert.equal(policy.validateSnapshot(before,after,{restore:true}),true);after.tablePolicy.mode='rules';assert.throws(()=>policy.validateSnapshot(before,after,{restore:true}),/Ведение/);
// Snapshot metadata cannot erase command identities or inject challenges.
policy.install();
const accepted=engine.dispatchMany(before,[{id:'ledger-hp',type:'table.command',actorId:'h',payload:{kind:'resource',values:{hp:4}}}]).scene;
for(const mutate of [s=>s.lionwing.receipts=[],s=>s.eventReceipts=[],s=>s.log=[],s=>s.challengeRequest={id:'request',actorId:'h',target:2},s=>s.opposedRoll={id:'opposed'}]){const candidate=clone(accepted);mutate(candidate);assert.throws(()=>policy.validateSnapshot(accepted,candidate),e=>e.code==='TABLE_SNAPSHOT_RUNTIME');}
const linked=fixture();linked.objects=[{id:'object'}];linked.lionwing={entities:{entity:{id:'entity',backing:{objectId:'object'}}}};
linked.actors[0].ruleState.objectId='object';
const removed=engine.dispatchMany(linked,[{id:'delete-object',type:'table.command',payload:{kind:'object/remove',id:'object'}}]).scene;
removed.undo=[{state:clone(linked)}];
const restored=clone(linked);restored.lionwing.receipts=clone(removed.lionwing.receipts);if(removed.eventReceipts)restored.eventReceipts=clone(removed.eventReceipts);
assert.equal(policy.validateSnapshot(removed,restored,{history:true}),true,'storage deletion can restore backing and detached actor refs');
restored.actors[0].ruleState.power=999;assert.throws(()=>policy.validateSnapshot(removed,restored,{history:true}),/сохранённый шаг/);
// The frozen Entities exports guard themselves; engine.install cannot wrap them.
policy.install();const entities=context.window.DAWN_LIONWING_ENTITIES;
for(const method of ['create','transform','prepareDestroy','destroy','changeOwner','link','unlink','pilotEnter','pilotExit','sourceLoss','transition','replay','undo','applyCleanup']){const saved=JSON.stringify(before);assert.throws(()=>entities[method](before,{}),error=>error.code==='TABLE_AUTOMATION_BLOCKED',method);assert.equal(JSON.stringify(before),saved);}
assert.deepEqual(clone(entities.reload(JSON.stringify(before))),before,'manual reload is storage-only');
// Real history controller; external DOM/storage/render are substituted.
let role='gm',messages=[];Object.assign(context,{Scene:clone(before),Sync:{state:()=>({})},activeSceneView:()=>role,sceneCore:clone,sceneSnapshot:()=>clone(context.Scene),uid:()=> 'id',store:{mode:'build'},toast:message=>{messages.push(message);return null},sceneEvent:()=>{},syncHeroFromScene:()=>{},persist:()=>{},renderScene:()=>{}});
const ui=read('scene-ui.js');vm.runInContext(ui.slice(ui.indexOf('function restoreSceneHistory('),ui.indexOf('function undoScene(')),context);
const rules=clone(before);rules.tablePolicy.mode='rules';const step={id:'switch',label:'Policy change',state:rules};const saved=JSON.stringify(context.Scene);assert.equal(context.restoreSceneHistory(step,[step],[],'Undo'),null);assert.equal(JSON.stringify(context.Scene),saved,'policy undo is atomic and refuses a return to rules');
const change={id:'hp-edit',type:'table.command',actorId:'h',payload:{kind:'resource',values:{hp:4}}};context.Scene=engine.dispatchMany(before,[change]).scene;context.Scene.undo=[{state:clone(before)}];
context.restoreSceneHistory({id:'hp',label:'HP',state:before},[{state:before}],[],'Undo');assert.equal(context.Scene.actors[0].hp,10);assert.equal(context.Scene.lionwing.receipts[0].id,'hp-edit');assert.equal(engine.dispatchMany(context.Scene,[change]).events.length,0,'undo must never forget committed event identities');
role='player';const protectedScene=JSON.stringify(context.Scene);assert.equal(context.restoreSceneHistory({state:before},[],[],'Undo'),null);assert.equal(JSON.stringify(context.Scene),protectedScene);role='gm';
// Actual network queue + authority entry point reject direct snapshot injection.
vm.runInContext(read('network-v2.js'),context);const network=context.window.DAWN_NETWORK_V2;network.setConfirmedScene(before);
let queued=[];Object.assign(context,{NetworkV2:network,normalizeScene:clone,ensureNetworkV2Runtime:()=>({authority:{enqueue:row=>queued.push(row)}}),Sync:{state:()=>({sceneId:'qa',canNarrate:true,version:0})}});
const sync=read('scene-sync-ui.js');vm.runInContext(sync.slice(sync.indexOf('function queueNetworkV2Snapshot('),sync.indexOf('function submitNetworkV2Events(')),context);
after=clone(before);after.actors[0].ruleState.power=999;assert.throws(()=>context.queueNetworkV2Snapshot(after,'Injected'),/боевое состояние/);assert.equal(queued.length,0);
after=clone(before);after.actors[0].name='Rename';after.log.unshift({id:'note',type:'legacy.note',actorId:null,visibility:'public',text:'Rename',payload:{label:'Rename'}});assert.equal(context.queueNetworkV2Snapshot(after,'Rename'),true);assert.equal(queued.length,1);
restored.actors[0].ruleState.power=1;const wire=clone(removed);delete wire.undo;assert.equal(policy.validateSnapshot(wire,restored,{history:true,historyAnchor:linked}),true);
const invented=clone(before);invented.actors[0].ruleState.power=999;assert.throws(()=>context.queueNetworkV2Snapshot(invented,'Forged',{history:true,historyAnchor:invented}),/сохранённый шаг/);
const forged=clone(restored);forged.lionwing.entities.entity.power=999;assert.throws(()=>policy.validateSnapshot(wire,forged,{history:true,historyAnchor:linked}),/сохранённый шаг/);
// Production shared commit must survive its own audit note, including cap200.
Object.assign(context,{Scene:clone(before),assertNetworkSceneFits:()=>{},validateTableEdit:(left,right)=>policy.validateSnapshot(left,right)});
vm.runInContext(ui.slice(ui.indexOf('function sceneEvent('),ui.indexOf('function syncHeroFromScene(')),context);
vm.runInContext(ui.slice(ui.indexOf('function commitScene('),ui.indexOf('function lionwingDestroyDescription(')),context);
queued=[];assert.ok(context.commitScene('Rename',scene=>{scene.actors[0].name='Renamed'}));assert.equal(queued.length,1);assert.equal(context.Scene.actors[0].name,'Renamed');
const fullLog=clone(before);fullLog.log=Array.from({length:200},(_,i)=>({id:`old-${i}`,type:'table.command'}));network.setConfirmedScene(fullLog);context.Scene=clone(fullLog);queued=[];assert.ok(context.commitScene('Rename',scene=>{scene.actors[0].name='Full log'}));assert.equal(queued.length,1);
// Shared Undo validates locally, then carries only an approved anchor through
// the queue because confirmed wire state omits local history stacks.
network.setConfirmedScene(removed);context.Scene=clone(removed);queued=[];context.restoreSceneHistory(context.Scene.undo[0],context.Scene.undo,[],'Undo');assert.equal(queued.length,1);assert.ok(queued[0].manualSnapshotOptions.historyAnchor);assert.equal(queued[0].scene.historyAnchor,undefined);
vm.runInContext(sync.slice(sync.indexOf('async function flushNetworkV2Authority('),sync.indexOf('async function commitNetworkV2Tick(')),context);
network.setConfirmedScene(before);const tampered=clone(before);tampered.lionwing={choices:[{id:'injected'}]};await assert.rejects(context.flushNetworkV2Authority([{kind:'snapshot',baseScene:before,scene:tampered}]),/замороженную механику/);
console.log('Manual snapshots: frozen runtime, policy/undo, receipts preserved, explicit backup limits, direct frozen Entities and actual network queue/flush guards passed; DOM/transport/normalization mocked');

// Remote joins are metadata additions, never a fabricated Undo anchor.
{
context.Scene=clone(before);context.Scene.undo=[];
vm.runInContext(sync.slice(sync.indexOf('function snapshotCommandCandidate('),sync.indexOf('async function prepareRemoteHeroCommand(')),context);
const event={id:'join-audit',at:'now',type:'command.join-hero',actorId:null,payload:{characterId:'new-character'}};
const prepared=context.snapshotCommandCandidate('New participant',event,scene=>{scene.actors.push({...clone(scene.actors[0]),id:'new-hero',characterId:'new-character',ownerId:'p2'});});
assert.equal(prepared.candidate.actors.length,before.actors.length+1);assert.equal(prepared.events[0].type,'legacy.note');
assert.equal(policy.validateSnapshot(context.Scene,prepared.candidate),true,'admission guard accepts the bounded join audit');
assert.throws(()=>context.snapshotCommandCandidate('Invalid update',event,scene=>{scene.actors[0].hp=999;}),/боевое состояние/);
}

// A metadata-only remote Undo must not invent a kernel receipt ledger.
{
context.Scene=clone(before);if(context.Scene.lionwing)delete context.Scene.lionwing.receipts;
const original=clone(context.Scene);original.undo=[];
context.Scene.actors.push({...clone(original.actors[0]),id:'remote-added'});
context.Scene.undo=[{id:'join-step',label:'Join',state:original}];
context.remoteCommandEvent=(type,command,payload)=>({id:'undo-audit',type,payload,at:'now'});
vm.runInContext(sync.slice(sync.indexOf('function prepareUndoCommand('),sync.indexOf('function prepareEventCommand(')),context);
const undo=context.prepareUndoCommand({id:'request',actor_id:'p2'});
assert.equal(undo.candidate.lionwing?.receipts,undefined);
assert.equal(policy.validateSnapshot(context.Scene,undo.candidate,{history:true}),true);
}
