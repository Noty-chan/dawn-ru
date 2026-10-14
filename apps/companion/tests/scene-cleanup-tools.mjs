import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,fixture,clone,exactReplay,rejectedWithoutMutation} from './helpers/scene-contract-harness.mjs';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const {context,engine,core}=runtime();
vm.runInContext(read('scene-table-policy.js'),context);
const policy=context.window.DAWN_TABLE_POLICY;policy.install(engine,core);vm.runInContext(read('lionwing-destroy-plan.js'),context);
const base=()=>{
 const s=fixture();s.tablePolicy={mode:'manual',epoch:7,processStatuses:true};s.manualTable={actorId:'hero',round:8};s.round=5;s.turnSerial=11;
 s.spaces.push({id:'side',name:'Side',mode:'standard',width:7,height:7});
 s.objects=[{id:'terrain',type:'manual-area',appearance:'terrain',manual:true,space:'main',cells:['2,2'],label:'Rock',color:'#112233',ownerActorId:null},
 {id:'lower',type:'manual-area',manual:true,appearance:'custom',space:'main',cells:['2,2'],label:'Lower',color:'#112233',ownerActorId:'hero'},
 {id:'upper',type:'manual-area',manual:true,appearance:'custom',space:'main',cells:['2,2'],label:'Upper',color:'#112233',ownerActorId:'hero',hidden:true},
 {id:'side-area',type:'manual-area',manual:true,space:'side',cells:['2,2'],label:'Other field',color:'#112233'}];
 s.walls=[{id:'wall',space:'main',a:'2,2',b:'3,2',label:'Wall',manual:true},{id:'side-wall',space:'side',a:'2,2',b:'3,2',manual:true}];
 s.markers=[{id:'mark',space:'main',x:2,y:2,label:'Mark',manual:true},{id:'side-mark',space:'side',x:2,y:2,manual:true}];
 s.topology={cuts:[{id:'cut',space:'main',cells:['6,4'],label:'Cut',crossing:'blocked'},{id:'side-cut',space:'side',cells:['6,4'],label:'Other cut',crossing:'blocked'}]};
 s.sessionClocks=[{id:'clock',manual:true,value:2,size:6}];s.lionwing.entities={entity:{id:'entity',backing:{objectId:'upper'}}};
 s.reminders=[{id:'reminder',areaId:'upper'}];return s;
};
const clear=(s,layer='all')=>({id:`clear-${layer}`,type:'table.command',at:'2026-10-12T00:00:00.000Z',actorId:null,payload:{kind:'environment/clear',space:'main',layer,expectedVersion:s.version,policyEpoch:7}});
// Baseline bug: the old field-clear snapshot is rejected, rather than deleting anything.
const before=base(),old=clone(before);old.objects=old.objects.filter(r=>r.space!=='main');old.walls=old.walls.filter(r=>r.space!=='main');old.markers=old.markers.filter(r=>r.space!=='main');
assert.throws(()=>policy.validateSnapshot(before,old),e=>e.code==='TABLE_SNAPSHOT_RUNTIME');
for(const [layer,objects,walls,markers,cuts]of [['terrain',3,2,2,2],['areas',1,2,2,2],['walls',4,1,2,2],['markers',4,2,1,2],['all',1,1,1,1]]){
 const s=base(),saved=clone(s),event=clear(s,layer),preview=engine.previewEvents(s,[event]);assert.equal(preview.ok,true,preview.errors?.join(' '));assert.deepEqual(clone(s),saved);
 const result=engine.dispatchMany(s,[event]),next=result.scene;assert.deepEqual(clone(next),clone(preview.scene));
 assert.equal(next.objects.length,objects,layer);assert.equal(next.walls.length,walls);assert.equal(next.markers.length,markers);assert.equal(next.topology.cuts.length,cuts);
 assert.deepEqual(clone(next.actors),clone(s.actors),'clear never removes participants or changes their resources');
 assert.deepEqual(clone(next.spaces),clone(s.spaces));assert.deepEqual(clone(next.sessionClocks),clone(s.sessionClocks));
 assert.ok(next.objects.some(r=>r.id==='side-area'));assert.ok(next.walls.some(r=>r.id==='side-wall'));assert.ok(next.markers.some(r=>r.id==='side-mark'));assert.ok(next.topology.cuts.some(r=>r.id==='side-cut'));
 assert.equal(next.log[0].visibility,'gm');assert.equal(next.version,s.version+1);exactReplay(engine,next,[event]);exactReplay(engine,core.reload(JSON.stringify(next)),[event]);
 if(layer==='all'||layer==='areas'){assert.equal(next.lionwing.entities.entity,undefined);assert.equal(next.reminders[0].areaId,null);}
}
for(const mutate of [e=>e.actorId='hero',e=>e.payload.expectedVersion++,e=>e.payload.policyEpoch++,e=>e.payload.layer='actors',e=>e.payload.space='absent',e=>e.payload.extra=true]){
 const s=base(),event=clear(s);mutate(event);rejectedWithoutMutation(s,()=>engine.dispatchMany(s,[event]));
}
for(const pending of [s=>s.pendingPrompt={id:'p'},s=>s.pendingAction={id:'p'},s=>s.pendingActionPlan={id:'p'},s=>s.lionwing.choices=[{id:'p'}],s=>s.lionwing.executionCursor={actorId:'hero'}]){const s=base();pending(s);rejectedWithoutMutation(s,()=>engine.dispatchMany(s,[clear(s)]),/завершите/);}
const rules=base();rules.tablePolicy.mode='rules';rejectedWithoutMutation(rules,()=>engine.dispatchMany(rules,[clear(rules)]),/ручной политики/);
// A bulk packet is atomic even when a later event rejects.
const atomic=base();rejectedWithoutMutation(atomic,()=>engine.dispatchMany(atomic,[clear(atomic),{id:'bad',type:'table.command',payload:{kind:'object/remove',id:'missing'}}]));

// Execute the production controller, writer, normalization and history boundary.
let role='gm',accept=true,saveRecovery=async()=>true,room=null,localPending=false,serial=0,writes=0,notices=[],renders=0;
const nodes=new Map();
class Node{
 constructor(){this.open=false;this.hidden=true;this.innerHTML='';this.dataset={};this.attrs={};this.value='all';this.handlers={};this.classList={contains:()=>false};this.summary={focus(){document.activeElement=this;}};this.confirm={disabled:false,textContent:'',focus(){document.activeElement=this;}};}
 set innerHTML(value){this.markup=value;this.buttons=[...value.matchAll(/data-cleanup-index="(\d+)" data-cleanup-key="([^"]+)"/g)].map(match=>({dataset:{cleanupIndex:match[1],cleanupKey:match[2]},disabled:false,focus(){document.activeElement=this;}}));}get innerHTML(){return this.markup;}
 contains(node){return this.buttons.includes(node)||node===this.confirm;}setAttribute(key,value){this.attrs[key]=value;} addEventListener(type,fn){this.handlers[type]=fn;} showModal(){throw new Error("No deletion dialogs");} close(){throw new Error("No deletion dialogs");} querySelectorAll(selector){return selector==='[data-cleanup-index]'?this.buttons:[];} querySelector(selector){return selector==='summary'?this.summary:selector.startsWith('[data-cleanup-index=')?this.buttons.find(button=>selector===`[data-cleanup-index="${button.dataset.cleanupIndex}"]`):this.confirm;} remove(){}
}
const document={documentElement:{},getElementById:id=>nodes.get(id)||null,createElement:()=>new Node(),body:{append:node=>nodes.set(node.id,node)},querySelectorAll:()=>[],querySelector:()=>null};
for(const id of ['scene-reset-table','scene-remove-npcs','scene-clear-field','scene-clear-layer','scene-erase-layer','scene-environment-objects','scene-environment-list','scene-layer-clear-confirmation','scene-field-clear-confirmation','scene-reset-confirmation','scene-history-confirmation'])nodes.set(id,new Node());
Object.assign(context,{structuredClone,document,performance:{now:()=>1000},APP_SCHEMA:14,contentPreferences:{edition:'lionwing'},uid:()=>`cleanup-test-${++serial}`,clamp:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),
 cleanArray:v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[],SceneEngine:engine,Sync:{state:()=>({sceneId:room,canNarrate:role==='gm'})},$:id=>nodes.get(id)||null,
 activeSceneView:()=>role,activeSceneSpace:()=>context.Scene.spaces.find(s=>s.id===context.Scene.activeSpace),sceneHasLocalPendingSelection:()=>localPending,
 toast:message=>{notices.push(message);return null;},persist:()=>writes++,renderScene:()=>renders++,store:{mode:'build'},syncHeroFromScene:()=>{},sceneEvent:label=>context.Scene.log.unshift({type:'legacy.note',text:label,actorId:null,visibility:'public',payload:{label}}),
 submitNetworkV2Events:()=>null,renderChallengeRequestDock:()=>{},playSceneEventFx:()=>{},resetManualTableDraftScope:()=>{},clearSceneMeasurement:()=>{},setScenePanel:()=>{},saveTableRecovery:label=>saveRecovery(label),isEnglishPreview:()=>context.window.DAWN_I18N.getLocale()==='en',placeActorsSafely:()=>{},friendlySyncError:e=>e.message});
context.window.confirm=()=>{throw new Error("Deletion must not use native confirmation");};
for(const file of ['localization.js','locale-ru.js','locale-en-builder.js'])vm.runInContext(read(file),context);
context.t=(key,args)=>context.window.DAWN_I18N.t(key,args);context.esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const app=read('app-core.js');vm.runInContext(app.slice(app.indexOf('function blankScene()'),app.indexOf('function addEnemyDeploymentPassives')),context);
vm.runInContext(app.slice(app.indexOf('function validateTableEdit('),app.indexOf('const TABLE_BACKUP_FORMAT')),context);
context.sceneSnapshot=()=>context.sceneCore(context.Scene);
const ui=read('scene-ui.js');
vm.runInContext(ui.slice(ui.indexOf('function commitScene('),ui.indexOf('function lionwingDestroyDescription(')),context);
vm.runInContext(ui.slice(ui.indexOf('function commitLionwingDestroy('),ui.indexOf('function captureSceneFxContext(')),context);
context.captureSceneFxContext=()=>({});
vm.runInContext(ui.slice(ui.indexOf('function commitSceneEvents('),ui.indexOf('function redoScene(')),context);
const effects=read('scene-effects.js');vm.runInContext(effects.slice(effects.indexOf('function sceneEnvironmentTarget('),effects.indexOf('function previewSceneWall(')),context);
const events=read('app-scene-events.js');vm.runInContext(events.slice(events.indexOf('const sceneMediaEdits='),events.indexOf('function refreshSceneShortcutQuote(')),context);
vm.runInContext(events.slice(events.indexOf('$("scene-reset-table").onclick='),events.indexOf('$("scene-clear-log").onclick')),context);
vm.runInContext(events.slice(events.indexOf('function handleLionwingDestroyClick('),events.indexOf('// Narrator cleanup must remain available')),context);
vm.runInContext(events.slice(events.indexOf('$("scene-remove-npcs").onclick='),events.indexOf('function updateTableRecoveryStatus(')),context);
const reset=()=>{context.Scene=context.normalizeScene(base());context.Scene.undo=[];context.Scene.redo=[];context.Scene.turnUndo=[];role='gm';accept=true;room=null;localPending=false;notices=[];saveRecovery=async()=>true;};
const confirmEvent={target:{closest:selector=>selector==='[data-cleanup-confirm]'?{}:null}},cancelEvent={target:{closest:selector=>selector==='[data-cleanup-cancel]'?{}:null}};
async function applyClear(layer='all',options={}){const saved=JSON.stringify(context.Scene),armed=context.clearSceneEnvironment(layer,options);if(!armed)return armed;assert.equal(JSON.stringify(context.Scene),saved,'First step only opens inline confirmation');return nodes.get(options.hostId||'scene-layer-clear-confirmation').onclick(confirmEvent);}
async function applyReset(){const saved=JSON.stringify(context.Scene),armed=nodes.get('scene-reset-table').onclick();if(!armed)return armed;assert.equal(JSON.stringify(context.Scene),saved,'Reset first step never writes or saves recovery');return nodes.get('scene-reset-confirmation').onclick(confirmEvent);}

for(const locale of ['ru','en']){
 reset();context.window.DAWN_I18N.setLocale(locale);const original=clone(context.Scene),saved=JSON.stringify(context.Scene);assert.equal(context.clearSceneEnvironment('all'),true);await nodes.get('scene-layer-clear-confirmation').onclick(cancelEvent);assert.equal(JSON.stringify(context.Scene),saved,'Cancel does not create history or write storage');assert.equal(nodes.get('scene-layer-clear-confirmation').hidden,true);
 role='player';assert.equal(context.clearSceneEnvironment('all'),false);assert.equal(JSON.stringify(context.Scene),saved);role='gm';
 localPending=true;assert.equal(context.clearSceneEnvironment('all'),false);localPending=false;
 assert.ok(await applyClear('terrain'));assert.equal(context.Scene.undo.length,1);assert.equal(context.Scene.objects.some(r=>r.id==='terrain'),false);assert.deepEqual(clone(context.Scene.actors),original.actors);
 const step=context.Scene.undo[0];assert.ok(context.restoreSceneHistory(step,context.Scene.undo,context.Scene.redo,'Undo'));assert.equal(context.Scene.objects.length,4);
 const redo=context.Scene.redo[0];assert.ok(context.restoreSceneHistory(redo,context.Scene.redo,context.Scene.undo,'Redo'));assert.equal(context.Scene.objects.some(r=>r.id==='terrain'),false);
 reset();const areas=JSON.stringify(context.Scene.objects);assert.ok(context.openSceneEnvironmentList());assert.ok(nodes.get('scene-environment-list').innerHTML.includes('Lower'));assert.ok(nodes.get('scene-environment-list').innerHTML.includes('Upper'));
 nodes.get('scene-environment-objects').open=false;assert.equal(JSON.stringify(context.Scene.objects),areas,'Closing chooser never deletes');
 // Layer-specific erase reaches an object under a token without touching it.
 nodes.get('scene-erase-layer').value='terrain';const actors=clone(context.Scene.actors);assert.ok(context.eraseSceneEnvironment({x:2,y:2,markerId:'mark',wallId:'wall'}));assert.equal(context.Scene.objects.some(r=>r.id==='terrain'),false);assert.deepEqual(clone(context.Scene.actors),actors);nodes.get('scene-erase-layer').value='all';
 // Full reset uses the explicit restore boundary; rules mechanics never run in manual.
 reset();const resetBefore=clone(context.Scene);await applyReset();assert.equal(context.Scene.actors.length,0);assert.equal(context.Scene.spaces.length,1);assert.deepEqual(clone(context.Scene.tablePolicy),resetBefore.tablePolicy);assert.equal(context.Scene.undo.length,1);
 const resetStep=context.Scene.undo[0];assert.ok(context.restoreSceneHistory(resetStep,context.Scene.undo,context.Scene.redo,'Undo'));assert.deepEqual(clone(context.Scene.actors),resetBefore.actors);assert.deepEqual(clone(context.Scene.topology),resetBefore.topology);assert.equal(context.Scene.round,5);
 const normalized=context.normalizeScene(JSON.parse(JSON.stringify(context.Scene)));assert.deepEqual(clone(normalized.objects),clone(context.Scene.objects));assert.equal(normalized.tablePolicy.epoch,7);
}
// Lower overlapping object selection, rejected confirmation and stale selection.
reset();context.openSceneEnvironmentList();const dialog=nodes.get('scene-environment-list'),choose=index=>({target:{closest:selector=>selector==='[data-cleanup-index]'?{dataset:{cleanupIndex:String(index)}}:null}});
dialog.onclick(choose(1));assert.equal(context.Scene.objects.some(r=>r.id==='lower'),false);assert.ok(context.Scene.objects.some(r=>r.id==='upper'));nodes.get('scene-environment-objects').open=false;
reset();context.openSceneEnvironmentList();context.Scene.version++;dialog.onclick(choose(1));assert.ok(context.Scene.objects.some(r=>r.id==='lower'));assert.equal(context.Scene.undo.length,0);
// Bulk confirmations never apply a stale selection after navigation or edits.
for(const change of [()=>context.Scene.version++,()=>context.Scene.tablePolicy.epoch++,()=>context.Scene.activeSpace='side',()=>role='player',()=>room='another-table',()=>localPending=true,()=>context.Scene=clone(context.Scene)]){
 reset();assert.ok(context.clearSceneEnvironment('all'));const before=clone(context.Scene);change();const afterChange=JSON.stringify(context.Scene);assert.equal(await nodes.get('scene-layer-clear-confirmation').onclick(confirmEvent),false);assert.equal(JSON.stringify(context.Scene),afterChange);assert.equal(context.Scene.objects.length,before.objects.length);assert.equal(nodes.get('scene-layer-clear-confirmation').hidden,true);
}
reset();assert.ok(context.clearSceneEnvironment('all',{hostId:'scene-field-clear-confirmation'}));assert.equal(nodes.get('scene-field-clear-confirmation').hidden,false);assert.ok(context.clearSceneEnvironment('terrain'));assert.equal(nodes.get('scene-field-clear-confirmation').hidden,true,'A second inline action cancels the first draft');await nodes.get('scene-layer-clear-confirmation').onclick(cancelEvent);
reset();context.clearSceneEnvironment('terrain');nodes.get('scene-layer-clear-confirmation').onkeydown({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(nodes.get('scene-layer-clear-confirmation').hidden,true);assert.equal(context.Scene.undo.length,0);
reset();const origin={isConnected:true,disabled:false,getClientRects:()=>[{}],focus(){document.activeElement=this;}};document.activeElement=origin;context.clearSceneEnvironment('all');assert.equal(document.activeElement,nodes.get('scene-layer-clear-confirmation').confirm);await nodes.get('scene-layer-clear-confirmation').onclick(cancelEvent);assert.equal(document.activeElement,origin,'Cancel returns keyboard focus to the existing cleanup trigger');document.activeElement=null;
// Reset confirmation also rechecks the version before even starting recovery.
reset();let recoveries=0;saveRecovery=async()=>{recoveries++;return true;};nodes.get('scene-reset-table').onclick();context.Scene.version++;assert.equal(await nodes.get('scene-reset-confirmation').onclick(confirmEvent),false);assert.equal(recoveries,0);assert.equal(context.Scene.actors.length,2);
// Cancel while recovery is running, and repeated confirmation, are safe.
reset();let releaseRecovery;saveRecovery=()=>new Promise(resolve=>{releaseRecovery=resolve;});nodes.get('scene-reset-table').onclick();const host=nodes.get('scene-reset-confirmation'),inFlight=host.onclick(confirmEvent);assert.equal(await host.onclick(confirmEvent),false,'Second confirmation does not start another operation');await host.onclick(cancelEvent);releaseRecovery(true);await inFlight;assert.equal(context.Scene.actors.length,2);assert.equal(context.Scene.undo.length,0);assert.equal(host.hidden,true);
// Actual structural Undo uses the History panel, with no native dialog.
for(const locale of ['ru','en']){
 reset();context.window.DAWN_I18N.setLocale(locale);await applyClear('all');const cleared=JSON.stringify(context.Scene),history=nodes.get('scene-history-confirmation');
 assert.ok(context.undoScene());assert.equal(JSON.stringify(context.Scene),cleared);assert.ok(history.innerHTML.includes(context.t('scene.cleanup.confirmUndoButton')));await history.onclick(cancelEvent);assert.equal(JSON.stringify(context.Scene),cleared);assert.equal(history.hidden,true);
 assert.ok(context.undoScene());assert.ok(await history.onclick(confirmEvent));assert.equal(context.Scene.objects.length,4);assert.equal(context.Scene.topology.cuts.length,2);assert.equal(context.Scene.redo.length,1);
 // Undo was already allowed during pending work; do not impose deletion guards.
 reset();await applyClear('all');context.Scene.pendingPrompt={id:'pending-before-undo'};localPending=true;assert.ok(context.undoScene());assert.ok(await history.onclick(confirmEvent));assert.equal(context.Scene.objects.length,4);assert.equal(context.Scene.pendingPrompt,null);localPending=false;
 // Ordinary, nonstructural Undo remains immediate.
 reset();context.commitSceneEvents('HP',[{id:'ordinary-undo',type:'table.command',actorId:'hero',payload:{kind:'resource',values:{hp:24}}}]);assert.ok(context.undoScene());assert.equal(context.Scene.actors[0].hp,30);
}
reset();await applyClear('all');context.undoScene();context.Scene.version++;const staleUndo=JSON.stringify(context.Scene);assert.equal(await nodes.get('scene-history-confirmation').onclick(confirmEvent),false);assert.equal(JSON.stringify(context.Scene),staleUndo);
reset();await applyClear('all');role='player';assert.equal(context.undoScene(),false);assert.equal(context.Scene.objects.length,1);

// Coordinates and appearance stay human-readable in the compact list.
reset();context.openSceneEnvironmentList();assert.ok(nodes.get('scene-environment-list').innerHTML.includes('C3'));assert.ok(nodes.get('scene-environment-list').innerHTML.includes(context.t('scene.cleanup.appearance.terrain')));assert.equal(nodes.get('scene-environment-list').innerHTML.includes('2,2'),false);

// Passive refresh during another workflow is quiet, disables deletion and expires drafts.
reset();context.openSceneEnvironmentList();context.clearSceneEnvironment('all');localPending=true;
const pendingNotices=notices.length;context.renderSceneCleanupTools();context.renderSceneCleanupTools();assert.equal(notices.length,pendingNotices);assert.ok(dialog.buttons.every(button=>button.disabled));assert.equal(dialog.attrs['aria-disabled'],'true');assert.equal(nodes.get('scene-layer-clear-confirmation').hidden,true);
localPending=false;context.renderSceneCleanupTools();assert.ok(dialog.buttons.every(button=>!button.disabled));assert.equal(dialog.attrs['aria-disabled'],'false');
// Structural history is intentionally usable during pending work, including a render.
reset();await applyClear('all');context.undoScene();localPending=true;context.renderSceneCleanupTools();assert.equal(nodes.get('scene-history-confirmation').hidden,false);assert.ok(await nodes.get('scene-history-confirmation').onclick(confirmEvent));localPending=false;
// Keyboard deletion stays at the next row, then returns to the existing summary.
reset();nodes.get('scene-erase-layer').value='markers';context.openSceneEnvironmentList();dialog.buttons[0].focus();dialog.onclick(choose(0));assert.equal(document.activeElement,nodes.get('scene-environment-objects').summary);
reset();nodes.get('scene-erase-layer').value='areas';context.openSceneEnvironmentList();dialog.scrollTop=37;dialog.buttons[1].focus();dialog.onclick(choose(1));assert.equal(document.activeElement,dialog.buttons[1]);assert.equal(dialog.scrollTop,37);assert.equal(document.activeElement.dataset.cleanupIndex,'1');nodes.get('scene-erase-layer').value='all';document.activeElement=null;
reset();context.openSceneEnvironmentList();dialog.buttons[1].focus();const focusedKey=document.activeElement.dataset.cleanupKey;context.Scene.objects.unshift({...context.Scene.objects[0],id:'inserted',label:'Inserted'});context.Scene.version++;context.renderSceneCleanupTools();assert.equal(document.activeElement.dataset.cleanupKey,focusedKey,'A passive insertion keeps focus on the same entity, even when its row moves');assert.equal(document.activeElement.dataset.cleanupIndex,'2');document.activeElement=null;
// Mixed layers and a topology-only clear are structural history changes too.
for(const configure of [()=>{context.Scene.objects=context.Scene.objects.filter(row=>row.space!=='main');context.Scene.topology.cuts=context.Scene.topology.cuts.filter(row=>row.space!=='main');},()=>{context.Scene.objects=context.Scene.objects.filter(row=>row.space!=='main');context.Scene.walls=context.Scene.walls.filter(row=>row.space!=='main');context.Scene.markers=context.Scene.markers.filter(row=>row.space!=='main');}]){
 reset();configure();await applyClear('all');const snapshot=JSON.stringify(context.Scene);assert.ok(context.undoScene());assert.equal(JSON.stringify(context.Scene),snapshot);assert.equal(nodes.get('scene-history-confirmation').hidden,false);assert.ok(await nodes.get('scene-history-confirmation').onclick(confirmEvent));
}

// A reset is a new empty table, but cannot forget already accepted event identities.
reset();const prior={id:'prior-health',type:'table.command',actorId:'hero',payload:{kind:'resource',values:{hp:25}}};context.commitSceneEvents('Prior health', [prior]);await applyReset();
const resetHistory=JSON.stringify(context.Scene.undo);exactReplay(engine,context.Scene,[prior]);assert.equal(JSON.stringify(context.Scene.undo),resetHistory);
const committedBeforeReplay=clone(context.Scene),renderBeforeReplay=renders,writeBeforeReplay=writes;context.commitSceneEvents('Prior health',[prior]);assert.deepEqual(clone(context.Scene),committedBeforeReplay);assert.equal(renders,renderBeforeReplay);assert.equal(writes,writeBeforeReplay);
const resetHistoryStep=context.Scene.undo[0];assert.ok(context.restoreSceneHistory(resetHistoryStep,context.Scene.undo,context.Scene.redo,'Undo'));assert.equal(context.Scene.actors[0].hp,25);exactReplay(engine,context.Scene,[prior]);
// The control policy remains rules after a rules-mode reset, and Undo restores it.
reset();context.Scene.tablePolicy.mode='rules';context.Scene.lionwing.entities={};context.Scene=context.normalizeScene(context.Scene);const rulesResetBefore=clone(context.Scene);
await applyReset();assert.equal(context.Scene.actors.length,0);assert.deepEqual(clone(context.Scene.tablePolicy),rulesResetBefore.tablePolicy);assert.equal(context.Scene.undo.length,1);
const rulesResetStep=context.Scene.undo[0];assert.ok(context.restoreSceneHistory(rulesResetStep,context.Scene.undo,context.Scene.redo,'Undo'));assert.deepEqual(clone(context.Scene.actors),rulesResetBefore.actors);

// Recovery is asynchronous. Losing rights or editing the table while saving must refuse reset.
for(const change of [()=>context.Scene.version++,()=>context.Scene.tablePolicy.epoch++,()=>context.Scene.activeSpace='side',()=>role='player',()=>room='different-table',()=>context.Scene=clone(context.Scene)]){
 reset();saveRecovery=async()=>{change();return true;};await applyReset();assert.equal(context.Scene.actors.length,2);assert.equal(context.Scene.undo.length,0);
}
reset();saveRecovery=async()=>false;await applyReset();assert.equal(context.Scene.actors.length,2);assert.equal(context.Scene.undo.length,0);
reset();nodes.get('scene-reset-table').onclick();await nodes.get('scene-reset-confirmation').onclick(cancelEvent);assert.equal(context.Scene.actors.length,2);
// Exact history anchors allow reset/clear undo; forged core changes remain rejected.
reset();await applyClear('all');const valid=context.sceneCore(context.Scene.undo[0].state);if(context.Scene.lionwing?.receipts){valid.lionwing||={};valid.lionwing.receipts=clone(context.Scene.lionwing.receipts);}valid.eventReceipts=clone(context.Scene.eventReceipts);
assert.equal(policy.validateSnapshot(context.Scene,valid,{history:true}),true);
for(const mutate of [s=>s.round=999,s=>s.topology.cuts=[],s=>s.spaces[0].width=12,s=>s.actors[0].hp=999,s=>s.tablePolicy.epoch++]){const forged=clone(valid);mutate(forged);assert.throws(()=>policy.validateSnapshot(context.Scene,forged,{history:true}));}
const forgedAnchor=clone(valid);forgedAnchor.round=999;assert.throws(()=>policy.validateSnapshot(context.Scene,forgedAnchor,{history:true,historyAnchor:forgedAnchor}));

// Rules clear must compose canonical plans, keep tokens and undo as a single step.
reset();context.Scene.tablePolicy.mode='rules';context.Scene.objects=context.Scene.objects.filter(r=>r.id==='terrain'||r.id==='side-area').map(r=>({...r,type:'terrain',manual:false,appearance:undefined,hp:8,maxHp:8,ownerActorId:null,source:'test',duration:'persistent'}));context.Scene.lionwing.entities={};
context.Scene=context.normalizeScene(context.Scene);const rulesActors=clone(context.Scene.actors);
assert.ok(await applyClear('all'),notices.join(' '));assert.deepEqual(context.Scene.actors.map(r=>[r.id,r.space,r.x,r.y,r.hp,r.maxHp,r.ap,r.focus,r.wounds,r.stress]),rulesActors.map(r=>[r.id,r.space,r.x,r.y,r.hp,r.maxHp,r.ap,r.focus,r.wounds,r.stress]));assert.equal(context.Scene.objects.length,1);assert.equal(context.Scene.walls.length,1);assert.equal(context.Scene.markers.length,1);assert.equal(context.Scene.topology.cuts.length,1);assert.equal(context.Scene.topology.cuts[0].space,"side");assert.equal(context.Scene.undo.length,1);assert.ok(context.Scene.lionwing.destroyPlanReceipts);
const rulesStep=context.Scene.undo[0];assert.ok(context.restoreSceneHistory(rulesStep,context.Scene.undo,context.Scene.redo,'Undo'));assert.equal(context.Scene.objects.length,2);
// Missing planner / mid-plan failure leaves all original layers unchanged.
reset();context.Scene.tablePolicy.mode='rules';const actual=context.window.DAWN_LIONWING_DESTROY_PLAN;
context.window.DAWN_LIONWING_DESTROY_PLAN={prepare:actual.prepare,apply:()=>{throw new Error('protected dependency');}};const failed=JSON.stringify(context.Scene);assert.equal(await applyClear('all'),false);assert.equal(JSON.stringify(context.Scene),failed);context.window.DAWN_LIONWING_DESTROY_PLAN=actual;
// Even a source-loss plan cannot remove a participant through the eraser.
reset();context.Scene.tablePolicy.mode='rules';context.Scene.lionwing.entities={};context.Scene=context.normalizeScene(context.Scene);
context.window.DAWN_LIONWING_DESTROY_PLAN={prepare:actual.prepare,apply:(...args)=>{const result=actual.apply(...args);result.scene.actors=result.scene.actors.slice(1);return result;}};
const tokenProtected=JSON.stringify(context.Scene);assert.equal(context.eraseSceneEnvironment({x:2,y:2}),null);assert.equal(JSON.stringify(context.Scene),tokenProtected);assert.equal(context.Scene.undo.length,0);
assert.equal(await applyClear('all'),false);assert.equal(JSON.stringify(context.Scene),tokenProtected);context.window.DAWN_LIONWING_DESTROY_PLAN=actual;

// The actual NPC capture and bubble controllers share one inline, atomic path.
for(const locale of ['ru','en'])for(const mode of ['manual','rules']){
 reset();context.window.DAWN_I18N.setLocale(locale);context.Scene.tablePolicy.mode=mode;context.Scene.lionwing.entities={};context.Scene=context.normalizeScene(context.Scene);
 context.Scene.actors.push({...clone(context.Scene.actors[0]),id:'owned-token',kind:'token',heroId:null,ownerId:'player'});
 const before=JSON.stringify(context.Scene),heroes=clone(context.Scene.actors.filter(actor=>actor.id!=='enemy'));
 assert.equal(context.handleLionwingDestroyClick({target:{closest:selector=>selector==='#scene-remove-npcs'?{}:null},preventDefault(){},stopImmediatePropagation(){}}),true);
 assert.equal(JSON.stringify(context.Scene),before,'Capture opens only existing controls');assert.equal(nodes.get('scene-field-clear-confirmation').hidden,false);
 await nodes.get('scene-field-clear-confirmation').onclick(cancelEvent);assert.equal(JSON.stringify(context.Scene),before);
 assert.ok(nodes.get('scene-remove-npcs').onclick());assert.ok(await nodes.get('scene-field-clear-confirmation').onclick(confirmEvent));
 assert.deepEqual(context.Scene.actors.map(actor=>actor.id),heroes.map(actor=>actor.id));assert.equal(context.Scene.undo.length,1);assert.ok(context.undoScene());assert.ok(await nodes.get('scene-history-confirmation').onclick(confirmEvent));assert.equal(context.Scene.actors.length,3);
}
reset();nodes.get('scene-remove-npcs').onclick();context.Scene.version++;const staleNpc=JSON.stringify(context.Scene);assert.equal(await nodes.get('scene-field-clear-confirmation').onclick(confirmEvent),false);assert.equal(JSON.stringify(context.Scene),staleNpc);
reset();context.Scene.tablePolicy.mode='rules';context.Scene.lionwing.entities={};context.Scene=context.normalizeScene(context.Scene);
context.window.DAWN_LIONWING_DESTROY_PLAN={prepare:actual.prepare,apply:(...args)=>{const result=actual.apply(...args);result.scene.actors=result.scene.actors.filter(actor=>actor.id!=='hero');return result;}};
const heroProtected=JSON.stringify(context.Scene);nodes.get('scene-remove-npcs').onclick();assert.equal(await nodes.get('scene-field-clear-confirmation').onclick(confirmEvent),null);assert.equal(JSON.stringify(context.Scene),heroProtected);assert.equal(context.Scene.undo.length,0);assert.ok(notices.includes(context.t('scene.cleanup.protectedActors')));context.window.DAWN_LIONWING_DESTROY_PLAN=actual;

console.log('Cleanup PASS: real manual/rules writers, field/layer isolation, overlap chooser, erase under token, cancel/rights/pending/async races, atomic failure, receipts replay/reload, reset undo and hostile history snapshots; DOM/transport mocked.');




