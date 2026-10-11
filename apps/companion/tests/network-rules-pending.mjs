import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

const drain=async()=>{for(let index=0;index<24;index++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fakeClock(){
  let now=0,serial=0;const timers=new Map();
  class TestDate extends Date {static now(){return now;}}
  return{Date:TestDate,setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,at:now+Math.max(0,Number(delay)||0)});return id;},clearTimeout(id){timers.delete(id);},size:()=>timers.size,
    async advance(ms){const end=now+ms;for(;;){const first=[...timers.entries()].filter(([,row])=>row.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;timers.delete(first[0]);now=first[1].at;first[1].fn();await drain();}now=end;await drain();}};
}
function harness({extraActors=false}={}){
  const {context:c,engine,core,data}=runtime(),clock=fakeClock();
  Object.assign(c,{console,structuredClone,Date:clock.Date,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
  c.window.crypto=webcrypto;
  vm.runInContext(fs.readFileSync(new URL('../scene-table-policy.js',import.meta.url),'utf8'),c);
  c.window.DAWN_TABLE_POLICY.install(engine,core);
  vm.runInContext(fs.readFileSync(new URL('../network-v2.js',import.meta.url),'utf8'),c);
  const network=c.window.DAWN_NETWORK_V2;c.NetworkV2=network;c.SceneEngine=engine;
  for(const file of ['localization.js','locale-ru.js','locale-en-builder.js'])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),c);
  c.t=(key,args)=>c.window.DAWN_I18N.t(key,args);
  const appCore=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
  vm.runInContext(appCore.slice(appCore.indexOf('const esc ='),appCore.indexOf('const uid =')),c);
  let id=0;c.uid=()=>`rules-test:${++id}`;
  const nodes=new Map();c.$=nodeId=>{if(!nodes.has(nodeId))nodes.set(nodeId,{value:'',textContent:'',innerHTML:'',className:'',hidden:false});return nodes.get(nodeId);};
  const painted=[],toasts=[];
  Object.assign(c,{store:{mode:'play'},S:{id:'hero',player:'QA'},document:{activeElement:null,body:{dataset:{}},documentElement:{},querySelector:()=>null,querySelectorAll:()=>[]},CSS:{escape:()=>''},renderSceneBoard(){},renderScene(){painted.push(c.rulesPlayerPendingActorIds());},syncHeroFromScene(){},refreshHeroSheetResourceControls(){},toast:text=>toasts.push(text),friendlySyncError:(error,fallback)=>error?.message||String(error||fallback)});
  let server=fixture();server.version=12;server.tablePolicy={mode:'rules',epoch:4};server.actors[0].ownerId='player';server.actors[0].focus=2;
  if(extraActors)for(const actorId of ['hero2','hero3'])server.actors.push({...clone(server.actors[0]),id:actorId});
  const state={sceneId:'qa-a',campaignId:'campaign-a',userId:'player',role:'player',canNarrate:false,authenticated:true,status:'online',version:12,presence:[]};
  const handlers=new Map(),commands=new Map(),sent=[];let commandSerial=40,reads=0,submitBehavior=null,refreshBehavior=null;
  const emit=(type,payload)=>{for(const handler of handlers.get(type)||[])handler(payload);};
  c.Sync={state:()=>({...state}),on(type,handler){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(handler);},
    async submitCommand(type,envelope){assert.equal(type,'intent_v2');sent.push(clone(envelope));let row=commands.get(envelope.clientIntentId);if(!row){row={id:++commandSerial,scene_id:state.sceneId,actor_id:state.userId,command_type:type,client_intent_id:envelope.clientIntentId,payload:clone(envelope),status:'pending'};commands.set(envelope.clientIntentId,row);}return submitBehavior?await submitBehavior(row):clone(row);},
    async refreshScene(){reads++;if(refreshBehavior)return await refreshBehavior();emitScene(server,{initial:true});return{...state};}};
  const source=fs.readFileSync(new URL('../scene-sync-ui.js',import.meta.url),'utf8');
  vm.runInContext(source.slice(source.indexOf('let networkV2Authority=null')),c,{filename:'scene-sync-ui.js#production-rules-runtime'});
  const play=fs.readFileSync(new URL('../play-ui.js',import.meta.url),'utf8');
  Object.assign(c,{pendingSceneCommands:[],delayedAutomaticCommands:new Set()});
  vm.runInContext(play.slice(play.indexOf('function renderSync('),play.indexOf('function renderSceneHeroSheet(')),c);
  c.Scene=engine.projectScene(server,{role:'player',actorIds:['hero']});network.setConfirmedScene(c.Scene);
  handlers.set('scene',[payload=>{c.Scene=c.mergeNetworkV2Scene(payload.state,c.Scene);c.renderSync();}]);
  const app=fs.readFileSync(new URL('../app-sync-events.js',import.meta.url),'utf8'),observerStart=app.indexOf('// Observe after the normal Scene handler');
  assert.ok(observerStart>=0);vm.runInContext(app.slice(observerStart),c,{filename:'app-sync-events.js#production-pending-observers'});
  function emitScene(snapshot,flags={}){if(Number(snapshot.version)<Number(state.version))return;state.version=snapshot.version;emit('scene',{state:engine.projectScene(snapshot,{role:'player',actorIds:['hero']}),version:snapshot.version,...flags});}
  function send(actorId='hero',request={kind:'action',actionId:engine.ACTION_IDS.breathe}){
    const prepared=core.prepare(c.Scene,{actorId,...request});assert.equal(prepared.ok,true,prepared.errors?.join(' '));return c.submitNetworkV2Events('Rules action',prepared.events);
  }
  function apply(intentId){const row=commands.get(intentId);assert.ok(row);if(row.status==='applied')return row;const events=network.materializeIntent(server,data,row.payload.intent,row.actor_id,{sceneEngine:engine});server=engine.dispatchMany(server,events).scene;row.status='applied';return row;}
  return{c,clock,state,sent,painted,toasts,nodes,commands,engine,core,network,emit,emitScene,send,apply,
    server:()=>server,setServer:next=>server=next,reads:()=>reads,setSubmit:fn=>submitBehavior=fn,setRefresh:fn=>refreshBehavior=fn,
    status:()=>nodes.get('scene-sync-status')?.textContent,close(){c.resetNetworkV2Runtime();assert.equal(clock.size(),0,'runtime reset leaves no scheduled probe/outbox timer');}};
}
{
  const h=harness({extraActors:true}),clockEdit={kind:'clock',id:'progress',label:'Progress',size:4,value:1};h.send();await drain();h.send('hero2',clockEdit);await drain();
  assert.equal(h.sent.length,1,'a second actor keeps the Outbox interval after the immediate first action');
  await h.clock.advance(199);assert.equal(h.sent.length,1);await h.clock.advance(1);assert.equal(h.sent.length,2);
  h.send('hero3',clockEdit);await drain();assert.equal(h.sent.length,2,'the immediate path also respects a preceding scheduled send');
  await h.clock.advance(200);assert.equal(h.sent.length,3);h.close();
}
{
  const h=harness();let lostReply=false;h.setSubmit(async row=>{if(!lostReply){lostReply=true;h.apply(row.client_intent_id);throw new Error('failed to fetch');}return clone(row);});h.send();await drain();
  assert.equal(h.c.networkV2QueueStatus().pending,1,'a lost applied INSERT reply remains pending');
  await h.clock.advance(399);assert.equal(h.sent.length,1,'immediate send preserves retry backoff');await h.clock.advance(1);
  assert.equal(h.c.networkV2QueueStatus().pending,0);assert.deepEqual(h.sent[1],h.sent[0]);assert.equal(h.c.Scene.actors[0].ap,2,'lost INSERT reply replay never pays twice');h.close();
}
{
  const h=harness();h.setSubmit(async()=>{throw Object.assign(new Error('action is not permitted'),{code:'42501'});});h.send();await drain();
  assert.equal(h.c.networkV2QueueStatus().pending,0);assert.equal(h.c.rulesPlayerPendingReason('hero'),null,'terminal INSERT failure unlocks the actor');
  assert.equal(h.c.Scene.actors[0].ap,3);assert.equal(h.status(),'Изменения не сохранены');h.setSubmit(null);
  const prepared=h.core.prepare(h.c.Scene,{actorId:'hero',kind:'clock',id:'progress',label:'Progress',size:4,value:1});assert.equal(prepared.ok,true);
  const intent=h.network.intentFromEvents(h.c.Scene,prepared.events,'Progress');assert.equal(h.c.submitNetworkV2Intent(intent),true);
  assert.equal(h.status(),'Сохранение…','a direct intent retry clears the old terminal error');assert.equal(h.c.submitNetworkV2Intent(intent),false,'direct intents share the same-actor boundary');h.close();
}

// INSERT may succeed while the Narrator has not applied the action. Exercise
// real UI helpers/Outbox/core; only transport, clock and DOM rendering are fake.
{
  const h=harness(),held=deferred();h.setSubmit(async row=>{await held.promise;return clone(row);});
  const before=clone(h.c.Scene),submitted=h.send();
  assert.equal(h.status(),'Сохранение…','pending is painted synchronously before the held INSERT');
  assert.equal(h.c.networkV2QueueStatus().pending,1,'in-flight and rules ledger count one command');
  assert.deepEqual(clone(h.c.Scene),before,'rules submission never spends or moves optimistically');
  assert.deepEqual([...h.c.rulesPlayerPendingActorIds()],['hero']);
  assert.equal(h.c.rulesPlayerPendingReason('enemy'),null,'a different participant is not blocked by this intent');
  assert.throws(()=>h.send(),/Сохранение/,'a repeated same-participant submit is rejected at the submission boundary');
  assert.equal(h.sent.length,1);
  held.resolve();await drain();
  assert.equal(h.c.ensureNetworkV2Runtime().outbox.pending(),0);
  assert.equal(h.c.networkV2QueueStatus().pending,1,'successful pending INSERT is not canonical acceptance');
  const unrelated=clone(h.server());unrelated.version++;unrelated.actors[1].hp--;h.setServer(unrelated);h.emitScene(unrelated);
  h.emitScene(before);
  assert.equal(h.c.networkV2QueueStatus().pending,1,'new unrelated and stale snapshots cannot acknowledge our action');
  assert.equal(h.c.Scene.actors[0].ap,3);
  h.c.window.DAWN_I18N.setLocale('en');h.c.renderSync();assert.equal(h.status(),'Saving…');
  const applied=h.apply(submitted.clientIntentId),fresh=deferred();h.setRefresh(async()=>{await fresh.promise;h.emitScene(h.server(),{initial:true});});
  h.emit('command-update',applied);await drain();
  assert.equal(h.c.networkV2QueueStatus().pending,1,'applied status still waits for the canonical read');
  h.emit('command-update',applied);assert.equal(h.reads(),1,'repeated applied notifications coalesce one read');
  fresh.resolve();await h.c.reconcilePendingRulesPlayerCommands();await drain();
  assert.equal(h.c.networkV2QueueStatus().pending,0);
  assert.equal(h.c.Scene.actors[0].ap,2);assert.equal(h.c.Scene.actors[0].focus,3);
  assert.equal(h.c.Scene.lionwing.receipts,undefined,'confirmation works with the real receipt-free player projection');
  assert.equal(h.status(),'Synchronized');h.close();
}
{
  const h=harness(),held=deferred();h.setSubmit(async row=>{const original=clone(row);await held.promise;return original;});const submitted=h.send();
  const applied=h.apply(submitted.clientIntentId);h.emit('command-update',applied);await h.c.reconcilePendingRulesPlayerCommands();
  assert.equal(h.c.Scene.actors[0].ap,2);held.resolve();await drain();
  assert.equal(h.c.networkV2QueueStatus().pending,0,'a late pending INSERT reply never downgrades an already confirmed applied UPDATE');h.close();
}
{
  const h=harness(),submitted=h.send();await drain();
  const unrelated=clone(h.server());unrelated.version++;unrelated.actors[1].hp--;h.setServer(unrelated);
  const applied=h.apply(submitted.clientIntentId),held=deferred();h.setRefresh(()=>held.promise);h.emit('command-update',applied);await drain();
  h.emitScene(unrelated);held.resolve();await h.c.reconcilePendingRulesPlayerCommands();
  assert.equal(h.c.networkV2QueueStatus().pending,1,'a realtime snapshot during a read cannot stand in for the initial canonical read result');
  h.setRefresh(async()=>h.emitScene(h.server(),{initial:true}));await h.c.reconcilePendingRulesPlayerCommands({force:true});
  assert.equal(h.c.networkV2QueueStatus().pending,0);h.close();
}
{
  const h=harness(),submitted=h.send();await drain();const old=clone(h.server()),applied=h.apply(submitted.clientIntentId);
  h.setRefresh(async()=>h.emitScene(old,{initial:true}));h.emit('command-update',applied);await h.c.reconcilePendingRulesPlayerCommands();
  assert.equal(h.c.networkV2QueueStatus().pending,1,'an initial read of the unchanged base version is not canonical acceptance');
  h.setRefresh(async()=>h.emitScene(h.server(),{initial:true}));await h.c.reconcilePendingRulesPlayerCommands({force:true});assert.equal(h.c.networkV2QueueStatus().pending,0);h.close();
}
{
  const h=harness(),submitted=h.send();await drain();const applied=h.apply(submitted.clientIntentId);
  h.emitScene(h.server());assert.equal(h.c.networkV2QueueStatus().pending,1,'snapshot-before-applied also remains pending');
  h.emit('command-update',applied);await h.c.reconcilePendingRulesPlayerCommands();await drain();
  assert.equal(h.c.networkV2QueueStatus().pending,0);assert.equal(h.reads(),1);h.close();
}
{
  const h=harness(),submitted=h.send();await drain();const row=h.commands.get(submitted.clientIntentId);row.status='rejected';
  const unrelated={...clone(row),id:999,client_intent_id:'other',payload:{clientIntentId:'other'}};
  h.emit('command-update',unrelated);assert.equal(h.c.networkV2QueueStatus().pending,1);
  h.emit('command-update',row);assert.equal(h.c.networkV2QueueStatus().pending,0);assert.ok(h.c.networkV2QueueStatus().error);
  assert.equal(h.c.Scene.actors[0].ap,3);assert.equal(h.c.rulesPlayerPendingReason('hero'),null);
  assert.equal(h.status(),'Изменения не сохранены');h.send();await drain();assert.equal(h.status(),'Сохранение…','a rejection does not lock new valid attempts');h.close();
}
{
  const h=harness(),submitted=h.send();await drain();h.apply(submitted.clientIntentId);
  // The UPDATE is deliberately omitted. A bounded status probe receives the
  // existing applied row by replaying its exact INSERT envelope.
  await h.clock.advance(1500);
  assert.equal(h.c.networkV2QueueStatus().pending,0);assert.equal(h.sent.length,2);
  assert.deepEqual(h.sent[1],h.sent[0]);assert.equal(h.c.Scene.actors[0].ap,2);assert.equal(h.reads(),1);h.close();
}
{
  const h=harness();h.send();await drain();await h.clock.advance(60000);
  assert.equal(h.sent.length,4,'one INSERT plus at most three automatic duplicate-status checks');
  assert.equal(h.c.networkV2QueueStatus().pending,1,'an unapplied command is never silently acknowledged at timeout');
  await h.c.reconcilePendingRulesPlayerCommands({force:true});assert.equal(h.sent.length,5,'manual reconnect can resume exhausted checking');
  assert.deepEqual(h.sent.at(-1),h.sent[0]);h.close();
}
{
  const h=harness(),submitted=h.send();await drain();const applied=h.apply(submitted.clientIntentId),held=deferred();
  h.setRefresh(()=>held.promise);h.emit('command-update',applied);await drain();await h.clock.advance(60000);
  assert.equal(h.c.networkV2QueueStatus().pending,1,'read timeout retains the accepted-but-unconfirmed intent');
  assert.equal(h.reads(),3,'canonical timeouts stop after the bounded read budget');
  assert.equal(h.toasts.filter(message=>message.includes('обновление стола')).length,1,'a read timeout shows one recovery notice');h.setRefresh(async()=>{h.emitScene(h.server(),{initial:true});});
  await h.c.reconcilePendingRulesPlayerCommands({force:true});assert.equal(h.c.networkV2QueueStatus().pending,0);h.close();
}
{
  const h=harness(),submitted=h.send();await drain();h.apply(submitted.clientIntentId);
  h.setSubmit(async()=>{throw Object.assign(new Error('permission denied during status query'),{code:'42501'});});
  await h.c.reconcilePendingRulesPlayerCommands({force:true});
  assert.equal(h.c.networkV2QueueStatus().pending,1,'a failed duplicate-status query is not a rejection of the inserted action');
  h.setSubmit(null);h.state.status='offline';h.emit('status');h.state.status='online';h.emit('status');
  await h.c.reconcilePendingRulesPlayerCommands();assert.equal(h.c.networkV2QueueStatus().pending,0,'reconnect reconciles the same accepted envelope');h.close();
}
// Scope loss invalidates queued work, timers and late responses. A pending
// command must never become a fresh command in the next table.
for(const switchScope of [h=>h.state.sceneId='qa-b',h=>h.state.userId='other-player',h=>{h.state.role='narrator';h.state.canNarrate=true;},h=>h.c.Scene.tablePolicy.epoch++,h=>h.state.authenticated=false,h=>h.c.Scene.tablePolicy.mode='manual']){
  const h=harness(),held=deferred();h.setSubmit(async row=>{await held.promise;return{...clone(row),status:'applied'};});h.send();
  switchScope(h);h.emit('status');assert.equal(h.c.networkV2QueueStatus().pending,0);
  held.resolve();await drain();assert.equal(h.reads(),0,'a late old-scope response cannot start a canonical read');assert.equal(h.sent.length,1);h.close();
}
for(const emitScopeStatus of [true,false]){
  const h=harness(),held=deferred();h.setSubmit(async()=>{await held.promise;throw Object.assign(new Error('old-room permission denied'),{code:'42501'});});h.send();
  h.state.sceneId='qa-b';if(emitScopeStatus)h.emit('status');
  const beforePaint=h.painted.length,beforeToasts=h.toasts.length;
  held.resolve();await drain();
  assert.equal(h.c.networkV2QueueStatus().pending,0);assert.equal(h.c.networkV2QueueStatus().error,undefined,'a late terminal Outbox error never sets the next room error');
  assert.equal(h.toasts.length,beforeToasts,'a late terminal Outbox error never toasts into the next room');
  assert.equal(h.painted.length,beforePaint,'a stale Outbox settlement never repaints the next room');h.close();
}
{
  const h=harness(),submitted=h.send();await drain();const applied=h.apply(submitted.clientIntentId),held=deferred();
  h.setRefresh(()=>held.promise);h.emit('command-update',applied);await drain();h.state.sceneId='qa-b';h.emit('status');
  held.resolve();await drain();assert.equal(h.c.networkV2QueueStatus().pending,0);assert.equal(h.c.Scene.actors[0].ap,3,'a late read never installs an old action');h.close();
}
console.log('Rules pending PASS: real production UI/Outbox/materializer and kernel, held/pending INSERT, same-actor guard, receipt-free canonical acceptance, snapshot/ack order, coalesced reads, reject, exact-envelope lost notification/reconnect, bounded probes, timeouts and scope loss; VM transport/DOM, no live two-client evidence');
