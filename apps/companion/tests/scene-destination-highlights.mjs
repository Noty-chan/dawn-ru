import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

const source=fs.readFileSync(new URL('../scene-ui.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function sceneDestinationPreviewScene()'),source.indexOf('function renderSceneBoard(){'));
const runnerSource=fs.readFileSync(new URL('../scene-destination-highlights.js',import.meta.url),'utf8');
function setup(){
  const{context,core,engine}=runtime();
  let clock=0,view='gm',queries=0,disposals=0;
  const tasks=[],cells=Array.from({length:144},(_,index)=>({dataset:{sceneCell:`${index%12},${Math.floor(index/12)}`},title:`Cell ${index}`,classList:{values:new Set(),toggle(key,value){if(value)this.values.add(key);else this.values.delete(key);},remove(key){this.values.delete(key);},contains(key){return this.values.has(key);}}}));
  const board={isConnected:true,attributes:{},setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},querySelectorAll(){return cells;}};
  const scene=fixture();scene.spaces[0]={id:'main',width:12,height:12};
  scene.lionwing.receipts=[];
  scene.artworks=[{id:'art',image:'A'.repeat(100000)}];scene.actors[0].tokenImage='B'.repeat(30000);
  scene.undo=Array.from({length:20},()=>({state:clone(scene)}));
  const sync={sceneId:'room-a',campaignId:'campaign',userId:'gm',role:'owner',canNarrate:true};
  Object.assign(context,{Scene:scene,SceneEngine:engine,Sync:{state:()=>sync},store:{mode:'play'},S:{id:'hero'},activeSceneView:()=>view,pendingCoreAction:engine.ACTION_IDS.step,pendingEnemyStepActorId:null,sceneMediaScopeGeneration:0,manualTableDraftGeneration:0});
  const measured={...core,destinationStatus(scene,request){queries++;clock+=4;return core.destinationStatus(scene,request);}};
  if(core.createDestinationQuery)measured.createDestinationQuery=scene=>{
    const query=core.createDestinationQuery(scene);
    return{status(request){queries++;clock+=4;return query.status(request);},dispose(){disposals++;query.dispose();}};
  };
  context.window.DAWN_LIONWING_ENGINE=measured;
  vm.runInContext(runnerSource,context);
  const runner=context.window.DAWN_SCENE_DESTINATION_HIGHLIGHTS.createRunner({schedule:task=>tasks.push(task),now:()=>clock,budget:6});
  context.window.DAWN_SCENE_DESTINATION_HIGHLIGHTS={supportsAsync:true,...runner};
  vm.runInContext(helper,context);
  const request={actorId:'hero',payload:{kind:'action',actionId:engine.ACTION_IDS.step,targetIds:[]}},space=scene.spaces[0];
  const queue=(options={})=>context.queueSceneBoardDestinationHighlights(board,space,request,options);
  const flush=()=>{let guard=0;while(tasks.length){assert.ok(++guard<500);tasks.shift()();}};
  const clear=()=>{assert.ok(cells.every(cell=>!cell.classList.contains('movement-valid')&&cell.dataset.destinationAvailable===undefined));assert.equal(board.attributes['aria-busy'],undefined);};
  return{context,core,scene,sync,board,cells,tasks,queue,flush,clear,setView:value=>view=value,counts:()=>({queries,disposals}),request};
}
{
  const t=setup(),before=clone(t.scene);
  const expected=t.cells.map(cell=>{const[x,y]=cell.dataset.sceneCell.split(',').map(Number);return t.core.destinationStatus(t.scene,{...t.request,destination:{space:'main',x,y}});});
  assert.equal(t.queue({describe:status=>status.reason||'Available'}),true);
  assert.equal(t.counts().queries,0,'The native board pass never starts the expensive cell validators synchronously');
  assert.equal(t.board.attributes['aria-busy'],'true');
  t.tasks.shift()();assert.equal(t.counts().queries,2,'The slice finishes the current query then yields within its CPU budget');
  t.flush();
  for(const[cell,index]of t.cells.map((cell,index)=>[cell,index])){
    assert.equal(cell.classList.contains('movement-valid'),expected[index].available);
    assert.equal(cell.dataset.destinationAvailable,String(expected[index].available));
    assert.equal(cell.title,expected[index].reason||'Available');
  }
  assert.deepEqual(clone(t.scene),before,'The presentation job never changes canonical state or local history/media');
  assert.equal(t.board.attributes['aria-busy'],undefined);
  if(t.core.createDestinationQuery)assert.equal(t.counts().disposals,1);
}
for(const mutation of [
  t=>{t.context.Scene.actors[0].ap=0;},
  t=>{t.context.Scene.objects.push({id:'block',type:'terrain',space:'main',cells:['2,1']});},
  t=>{t.context.Scene.lionwing.receipts.push({id:'new-receipt',fingerprint:'new'});},
  t=>{t.context.Scene.selectedActor='enemy';},
  t=>{t.sync.canNarrate=false;t.sync.role='player';},
  t=>{t.setView('player');},
  t=>{t.sync.sceneId='room-b';},
  t=>{t.context.sceneMediaScopeGeneration++;},
  t=>{t.context.pendingCoreAction=null;},
  t=>{t.board.isConnected=false;},
]){
  const t=setup();t.queue({describe:()=> 'Private result'});t.tasks.shift()();const prior=t.counts().queries;
  mutation(t);t.flush();t.clear();assert.equal(t.counts().queries,prior,'A stale job stops before the next expensive validator');
  assert.ok(t.cells.every((cell,index)=>cell.title===`Cell ${index}`),'Cancelled titles cannot retain private reasons');
}
{
  const t=setup();let selected=true;t.queue({isCurrent:()=>selected});t.tasks.shift()();selected=false;t.flush();t.clear();
}
{
  const t=setup();t.queue();t.tasks.shift()();t.queue();t.flush();
  assert.equal(t.counts().queries,146,'The superseded callback cannot cancel the replacement job');
  assert.equal(t.board.attributes['aria-busy'],undefined);
}
{
  const t=setup(),play=fs.readFileSync(new URL('../play-ui.js',import.meta.url),'utf8');
  const start=play.indexOf('function renderSync(){'),end=play.indexOf('  const sync=Sync.state()',start);
  assert.ok(start>=0&&end>start);
  t.context.$=()=>t.board;
  vm.runInContext(play.slice(start,end)+'}',t.context);
  t.queue({describe:()=> 'Private result'});t.tasks.shift()();const before=t.counts().queries;
  t.sync.role='player';t.sync.canNarrate=false;t.context.renderSync();
  t.sync.role='owner';t.sync.canNarrate=true;t.context.renderSync();
  t.flush();t.clear();assert.equal(t.counts().queries,before,'The actual status hook cancels a role roundtrip before its old callback can observe restored permissions');
}
{
  const t=setup(),api=t.context.window.DAWN_LIONWING_ENGINE,create=api.createDestinationQuery;
  assert.ok(create);let replaced=false;
  api.createDestinationQuery=scene=>{
    const query=create(scene);
    return{status:query.status,dispose(){query.dispose();if(!replaced){replaced=true;t.queue();}}};
  };
  t.queue();t.tasks.shift()();t.context.window.DAWN_SCENE_DESTINATION_HIGHLIGHTS.cancel(t.board);t.flush();
  assert.equal(t.counts().queries,146,'A dispose callback can register a replacement without the old cancellation deleting it');
  assert.equal(t.board.attributes['aria-busy'],undefined);
}
{
  const t=setup(),api=t.context.window.DAWN_LIONWING_ENGINE,create=api.createDestinationQuery;
  let replaced=false;
  api.createDestinationQuery=scene=>{const query=create(scene);if(!replaced){replaced=true;t.queue();}return query;};
  t.queue();t.flush();
  assert.equal(t.counts().queries,144,'A replacement registered by provider creation prevents all obsolete cell queries');
  assert.equal(t.board.attributes['aria-busy'],undefined);
}
console.log('Destination presentation jobs: full 144-cell validator equivalence, deferred CPU slices, same-object/receipt/authority/room/draft cancellation, private title cleanup and replacement isolation passed. Browser scheduling is checked separately.');
