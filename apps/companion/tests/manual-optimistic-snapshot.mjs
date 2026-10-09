import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';

const source=fs.readFileSync(new URL('../scene-sync-ui.js',import.meta.url),'utf8');
const begin=source.indexOf('let networkV2Authority=null');
const end=source.indexOf('function renderNetworkScene(',begin);
assert.ok(begin>=0&&end>begin);
const context={window:{},console,structuredClone,setTimeout,clearTimeout,renderSceneBoard(){},renderScene(){},syncHeroFromScene(){},
  Sync:{state:()=>({sceneId:'qa',canNarrate:true})},
  Scene:{name:'Before',tablePolicy:{mode:'manual',epoch:1},version:0,actors:[{id:'hero',name:'Hero',space:'main',x:0,y:0,hp:10,maxHp:10,focus:0}],spaces:[{id:'main',width:7,height:7}],activeSpace:'main',selectedActor:'hero',log:[]},
};
vm.createContext(context);
context.SceneEngine=loadSceneEngine(context);context.window.DAWN_TABLE_POLICY.install();
vm.runInContext(fs.readFileSync(new URL('../network-v2.js',import.meta.url),'utf8'),context);
context.NetworkV2=context.window.DAWN_NETWORK_V2;
vm.runInContext(source.slice(begin,end)+'\nthis.setAuthority=q=>networkV2Authority=q;',context);
const confirmed=structuredClone(context.Scene);
const overlay=structuredClone(confirmed);overlay.name='Pending rename';
const first={id:'snapshot-ui-1',type:'table.command',actorId:'hero',payload:{kind:'resource',values:{focus:1}}};
const authority={queue:[{kind:'events',events:[first]}],latestSnapshot:()=>({baseScene:confirmed,scene:overlay})};
context.setAuthority(authority);context.NetworkV2.setConfirmedScene(confirmed);
context.refreshPendingManualUi();
assert.equal(context.Scene.name,'Pending rename','first resource preview must retain metadata overlay');
assert.equal(context.Scene.actors[0].focus,1);
assert.equal(context.NetworkV2.getConfirmedScene().actors[0].focus,0,'preview cannot change canonical state');
context.Scene=context.mergeNetworkV2Scene(confirmed,context.Scene);
assert.equal(context.Scene.name,'Pending rename');
assert.equal(context.Scene.actors[0].focus,1,'remote repaint must preserve resource preview over snapshot');
const second={id:'snapshot-ui-2',type:'table.command',actorId:'hero',payload:{kind:'resource',values:{focus:context.Scene.actors[0].focus+1}}};
authority.queue.push({kind:'events',events:[second]});
context.refreshPendingManualUi();
assert.equal(context.Scene.actors[0].focus,2,'rapid second step must use the provisional value');
const accepted=context.SceneEngine.dispatchMany(confirmed,[first,second]).scene;
context.Scene=context.mergeNetworkV2Scene(accepted,context.Scene);
assert.equal(context.Scene.actors[0].focus,2,'accepted receipts must not replay the two commands');
assert.equal(context.Scene.log.length,2);
assert.equal(context.Scene.name,'Pending rename');
authority.queue=[];
context.NetworkV2.setConfirmedScene(confirmed);context.refreshPendingManualUi();
assert.equal(context.Scene.actors[0].focus,0,'rejected events must roll back while retaining metadata');
assert.equal(context.Scene.name,'Pending rename');
console.log('Manual optimistic snapshot QA passed: refresh/remote overlay, rapid steps, canonical isolation, receipts and rollback');

// Exercise the actual pending predicate, including accepted-but-unacknowledged
// player commands. Command insertion is not the canonical Scene receipt.
vm.runInContext(source.slice(source.indexOf('function networkV2QueueStatus('),source.indexOf('function retryNetworkV2Failed(')),context);
vm.runInContext('this.setOutbox=q=>networkV2Outbox=q;this.addPending=(id,events)=>pendingManualUiIntents.set(id,{events});this.pendingCount=()=>pendingManualUiIntents.size;',context);
context.setAuthority(null);context.setOutbox({pending:()=>1});
assert.equal(context.networkV2QueueStatus().pending,1);
context.addPending('intent-qa',[first]);context.setOutbox({pending:()=>0});
assert.equal(context.networkV2QueueStatus().pending,1,'successful command insertion still waits for canonical receipt');
context.Scene=context.mergeNetworkV2Scene(confirmed,context.Scene);
assert.equal(context.networkV2QueueStatus().pending,1,'unrelated older snapshot cannot mark pending write synced');
context.Scene=context.mergeNetworkV2Scene(accepted,context.Scene);
assert.equal(context.networkV2QueueStatus().pending,0,'canonical receipt settles the optimistic write');
context.addPending('intent-reject',[first]);context.clearPendingNetworkPlacement({status:'rejected',payload:{clientIntentId:'intent-reject'},result:{message:'Rejected'}});
assert.equal(context.networkV2QueueStatus().pending,0);assert.equal(context.networkV2QueueStatus().failed,0,'a terminal player rejection must not lock new edits');assert.equal(context.networkV2QueueStatus().error,'Rejected','terminal server rejection remains visible');

const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',className:'',hidden:false});return nodes.get(id);};
let status='online';
for(const file of ['localization.js','locale-ru.js'])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context);
context.t=(key,params)=>context.window.DAWN_I18N.t(key,params);
const appCore=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');vm.runInContext(appCore.slice(appCore.indexOf('const esc ='),appCore.indexOf('const uid =')),context);
Object.assign(context,{$:node,S:{player:'QA'},pendingSceneCommands:[],delayedAutomaticCommands:new Set(),document:{body:{dataset:{}},activeElement:null}});
context.Sync.state=()=>({status,sceneId:'qa',role:'player',canNarrate:false,authenticated:true,version:52,presence:[]});
const play=fs.readFileSync(new URL('../play-ui.js',import.meta.url),'utf8');vm.runInContext(play.slice(play.indexOf('function renderSync('),play.indexOf('function renderSceneHeroSheet(')),context);
vm.runInContext('networkV2PlayerError="";',context);context.addPending('player-visible',[first]);context.renderSync();
assert.equal(node('scene-sync-status').textContent,'Сохранение…','player UI must not claim synced before ack');
context.clearPendingNetworkPlacement({status:'rejected',payload:{clientIntentId:'player-visible'}});context.renderSync();
assert.equal(node('scene-sync-status').textContent,'Изменения не сохранены');
vm.runInContext('networkV2PlayerError="";',context);context.renderSync();assert.equal(node('scene-sync-status').textContent,'Синхронизировано');
context.setOutbox({pending:()=>1});context.renderSync();assert.equal(node('scene-sync-status').textContent,'Сохранение…');
let release;const held=new Promise(resolve=>release=resolve);let settled=0;
const outbox=new context.NetworkV2.PlayerOutbox({send:()=>held,onSettled:()=>settled++});
outbox.enqueue({kind:'targets',actorId:'h',targetIds:[]},0);const flush=outbox.flush();assert.equal(outbox.pending(),1);assert.equal(settled,0);
release();await flush;assert.equal(outbox.pending(),0);assert.equal(settled,1,'settled UI notification occurs after in-flight is cleared');outbox.clear();
console.log('Manual sync status: player outbox/in-flight/awaiting canonical, stale snapshot, exact receipt, terminal reject and settled repaint passed');

let toolsSettledPaint=0;context.store={mode:'tools'};context.renderStressTrackers=()=>toolsSettledPaint++;context.refreshFreeplayResourceUi=()=>{};
context.setOutbox({pending:()=>0});context.renderSync();assert.equal(toolsSettledPaint,1,'settled status updates Tools stress controls in-place without navigation');
