import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';
const read=f=>fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const normal={window:{},console,uid:()=> 'new',APP_SCHEMA:14,contentPreferences:{edition:'lionwing'},cleanArray:v=>Array.isArray(v)?v.filter(x=>typeof x==='string'):[],clamp:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),SceneEngine:{bodyguardsBraceIntact:()=>{throw Error('manual must not run Brace')}}};
vm.createContext(normal);vm.runInContext(read('scene-table-policy.js'),normal);
const core=read('app-core.js');vm.runInContext(core.slice(core.indexOf('function blankScene()'),core.indexOf('function addEnemyDeploymentPassives')),normal);
const c={window:{},console,Date,crypto:globalThis.crypto,setTimeout,clearTimeout,isEnglishPreview:()=>false};vm.createContext(c);
for(const f of ['data.js','edition-lionwing.js','logic.js'])vm.runInContext(read(f),c);
c.Logic=c.window.DAWN_LOGIC;
const Engine=loadSceneEngine(c),Policy=c.window.DAWN_TABLE_POLICY;Policy.install(Engine,c.window.DAWN_LIONWING_ENGINE);
const plain=v=>JSON.parse(JSON.stringify(v));
c.Scene=plain(normal.blankScene());c.Scene.actors=[{id:'actor',kind:'enemy',rulesEdition:'lionwing',name:'A',space:'main',x:2,y:2,hp:6,maxHp:10,ap:3,focus:2,effects:[]}];c.Scene.targetIds=['actor'];
const values=JSON.stringify(c.Scene.actors);let serial=0,role='gm';c.uid=()=>`map-${++serial}`;c.activeSceneView=()=>role;c.activeSceneSpace=()=>c.Scene.spaces[0];c.sceneHasLocalPendingSelection=()=>false;c.manualTableActive=()=>Policy.isManual(c.Scene);c.manualTableCopy=ru=>ru;c.toast=()=>null;c.safeColor=(v,f)=>v||f;
const fields={'scene-area-type':{value:'difficult'},'scene-area-shape':{value:'square2'},'scene-area-label':{value:'Area'},'scene-manual-area-color':{value:'#65c8d0'},'scene-manual-area-hidden':{checked:false},'scene-wall-direction':{value:'east'},'scene-wall-label':{value:'Wall'},'scene-manual-wall-hidden':{checked:true},'scene-marker-kind':{value:'custom'},'scene-marker-label':{value:'Marker'},'scene-marker-color':{value:'#e2b54a'},'scene-marker-clock-size':{value:'6'},'scene-manual-marker-hidden':{checked:true}};
c.$=id=>fields[id];
const ui=read('scene-ui.js');vm.runInContext(ui.slice(ui.indexOf('const SCENE_TYPE_NAMES'),ui.indexOf('const SCENE_DURATION_NAMES')),c);
const integration=read('scene-manual-integration.js');vm.runInContext(integration.slice(integration.indexOf('function placeManualMapObject'),integration.indexOf('function renderManualMapTools')),c);
c.commitSceneEvents=(label,events)=>{const result=Engine.dispatchMany(c.Scene,events);c.Scene=plain(normal.normalizeScene(result.scene));return result};
assert.ok(c.placeManualMapObject('area',{x:2,y:2}));assert.equal(c.Scene.objects[0].type,'manual-area');assert.equal(c.Scene.objects[0].appearance,'difficult');assert.equal(c.sceneObjectDisplayName(c.Scene.objects[0]),'Трудная местность');
assert.deepEqual(c.Scene.targetIds,['actor'],'placement does not replace combat targets');assert.equal(JSON.stringify(c.Scene.actors),JSON.stringify(normal.normalizeScene({...c.Scene,actors:JSON.parse(values)}).actors));
assert.ok(c.placeManualMapObject('wall',{x:1,y:1}));assert.equal(c.Scene.walls[0].hidden,true);assert.equal(c.Scene.walls[0].manual,true);assert.equal(c.placeManualMapObject('wall',{x:1,y:1}),null,'same edge cannot be duplicated');
assert.ok(c.placeManualMapObject('marker',{x:4,y:4}));assert.equal(c.Scene.markers[0].hidden,true);assert.equal(c.Scene.markers[0].manual,true);
let reloaded=plain(normal.normalizeScene(normal.normalizeScene(c.Scene)));assert.equal(reloaded.markers[0].metadata.clock.size,6);assert.equal(reloaded.objects[0].appearance,'difficult');
const marker=reloaded.markers[0];reloaded=Engine.dispatchMany(reloaded,[{id:'clock-change',type:'table.command',actorId:null,payload:{kind:'marker/clock-set',id:marker.id,value:4}}]).scene;assert.equal(reloaded.markers[0].metadata.clock.value,4);assert.equal(reloaded.log[0].visibility,'gm');
assert.equal(Engine.projectScene(reloaded,{role:'player'}).markers.length,0);assert.equal(Engine.projectScene(reloaded,{role:'player'}).walls.length,0);assert.equal(c.sceneEnvironmentVisible(marker,reloaded,'player'),false);
role='player';const before=JSON.stringify(c.Scene);assert.equal(c.placeManualMapObject('area',{x:0,y:0}),null);assert.equal(JSON.stringify(c.Scene),before);role='gm';
const packet=payload=>[{type:'table.command',actorId:null,payload}];
assert.throws(()=>Engine.dispatchMany(c.Scene,packet({kind:'area/create',area:{id:'bad',space:'main',cells:['01,1']}})),/клетка/);
assert.throws(()=>Engine.dispatchMany(c.Scene,packet({kind:'wall/create',wall:{id:'bad',space:'main',a:'0,0',b:'2,0'}})),/соседними/);
for(const [key,payload] of [['objects',{kind:'area/create',area:{id:'extra',space:'main',cells:['0,0']}}],['walls',{kind:'wall/create',wall:{id:'extra',space:'main',a:'0,0',b:'1,0'}}],['markers',{kind:'marker/create',marker:{id:'extra',space:'main',x:0,y:0}}]]){
 const full=plain(c.Scene);full[key]=Array.from({length:240},(_,i)=>({id:`existing-${i}`}));const saved=JSON.stringify(full);assert.throws(()=>Engine.dispatchMany(full,packet(payload)),/240/);assert.equal(JSON.stringify(full),saved,'capacity refusal is atomic');
}
const replayScene=plain(c.Scene),event={id:'replay-map',type:'table.command',actorId:null,payload:{kind:'area/create',area:{id:'replay-area',space:'main',cells:['0,0']}}};
const once=Engine.dispatchMany(replayScene,[event]).scene;assert.equal(Engine.dispatchMany(once,[event]).scene.version,once.version);
vm.runInContext(read('network-v2.js'),c);assert.throws(()=>c.window.DAWN_NETWORK_V2.materializeIntent(c.Scene,c.window.DAWN_DATA,{kind:'table',actorId:'actor',policyEpoch:0,request:{kind:'wall/create'}},null),/Нарратору|не владеет/);
console.log('Manual map UI/core: create, same-edge rejection, canonical cells/capacity, hidden persistence/projection, no targets/resources, marker clocks and replay passed');

for(const name of ['manualAreaDraftActor','manualAreaDraftPayload']){const start=integration.indexOf(`function ${name}(`),end=integration.indexOf('\nfunction ',start+1);vm.runInContext(integration.slice(start,end),c);}
c.manualClockScope=()=> `local:${c.Scene.tablePolicy.epoch}`;c.canControlSceneActor=actor=>role==='gm'||actor.id==='actor';
c.manualTableAbilities=()=>[{id:'ability',text:'Real text',area:true}];
const draft={id:'reader-area',actorId:'actor',entryId:'ability',text:'Real text',name:'Attack annotation',space:'main',scope:c.manualClockScope()};
const priorActors=JSON.stringify(c.Scene.actors),priorTargets=JSON.stringify(c.Scene.targetIds);role='player';
const request=c.manualAreaDraftPayload(draft,{shape:'square3',x:'0',y:'0'});assert.equal(request.kind,'area/create');assert.equal(request.area.cells.length,4,'edge shape clips within board');
assert.ok(c.commitSceneEvents('Show area',[{type:'table.command',actorId:'actor',payload:request}]));
assert.equal(c.Scene.objects.at(-1).ownerActorId,'actor');assert.equal(JSON.stringify(c.Scene.actors),priorActors);assert.equal(JSON.stringify(c.Scene.targetIds),priorTargets);
assert.equal(c.manualAreaDraftPayload({...draft,scope:'stale'},{shape:'cell',x:0,y:0}),null);
c.manualTableAbilities=()=>[{id:'ability',text:'Changed text',area:true}];assert.equal(c.manualAreaDraftPayload(draft,{shape:'cell',x:0,y:0}),null,'source changed while dialog was open');
c.manualTableAbilities=()=>[{id:'ability',text:'Real text',area:true}];c.canControlSceneActor=()=>false;assert.equal(c.manualAreaDraftPayload(draft,{shape:'cell',x:0,y:0}),null,'ownership loss cancels draft');
c.canControlSceneActor=()=>true;c.Scene.actors[0].hidden=true;assert.equal(c.manualAreaDraftPayload(draft,{shape:'cell',x:0,y:0}),null,'hidden own actor cannot publish through stale player dialog');

// Real palette renderer/recovery; only DOM and transport are mocked.
for(const name of ['renderManualAreaDraft','recheckManualAreaDraft']){const marker=name==='recheckManualAreaDraft'?'async function ':'function ',start=integration.indexOf(`${marker}${name}(`),end=integration.indexOf('\nfunction ',start+1);vm.runInContext(integration.slice(start,end<0?integration.length:end),c);}
c.usingNextSceneInterface=()=>true;c.clearManualAreaPreview=()=>{};c.Scene.actors[0].hidden=false;c.canControlSceneActor=actor=>Boolean(actor);c.esc=String;
c.Scene.objects.push({id:'private-area',ownerActorId:'actor',type:'manual-area',manual:true,space:'main',hidden:true,label:'TOP SECRET',cells:['1,1']});
const nodes={name:{textContent:''},existing:{innerHTML:''},shape:{disabled:false},cancel:{disabled:false},recheck:{hidden:false},output:{textContent:''}};
const areaPanel={areaDraft:{...draft,id:'retry-area',pending:true},querySelector:selector=>({'[data-area-name]':nodes.name,'[name="shape"]':nodes.shape,'[data-area-cancel]':nodes.cancel,'[data-area-recheck]':nodes.recheck,'[data-area-existing]':nodes.existing,output:nodes.output})[selector]};
c.$=id=>id==='manual-table-area-tools'?areaPanel:null;
c.renderManualAreaDraft();assert.equal(nodes.shape.disabled,true);assert.ok(!nodes.existing.innerHTML.includes('TOP SECRET'));assert.match(nodes.existing.innerHTML,/type="button"/);
let pending=1,refresh=0;c.Sync={state:()=>({sceneId:'test'}),refreshScene:async()=>{refresh++}};c.networkV2QueueStatus=()=>({pending,failed:0});
await c.recheckManualAreaDraft(areaPanel);assert.equal(areaPanel.areaDraft.pending,true,'no retry during outstanding canonical queue');
pending=0;await c.recheckManualAreaDraft(areaPanel);assert.equal(areaPanel.areaDraft.pending,false);assert.equal(nodes.shape.disabled,false);assert.equal(refresh,2,'retry refreshes canonical state');
c.canControlSceneActor=()=>false;areaPanel.areaDraft.pending=true;await c.recheckManualAreaDraft(areaPanel);assert.equal(refresh,2,'lost ownership does not refresh or retry');
{const start=integration.indexOf('function submitManualAreaDraft('),end=integration.indexOf('\nfunction ',start+1);vm.runInContext(integration.slice(start,end),c);}
c.canControlSceneActor=()=>true;let sends=0;c.commitSceneEvents=()=>{sends++;return {pending:true}};
areaPanel.areaDraft.pending=false;const args={shape:'cell',x:'0',y:'0'};
assert.ok(c.submitManualAreaDraft(areaPanel,args).pending);assert.equal(areaPanel.areaDraft.pending,true);assert.equal(c.submitManualAreaDraft(areaPanel,args),null);assert.equal(sends,1,'double click cannot duplicate queued create');
areaPanel.areaDraft.pending=false;c.commitSceneEvents=()=>null;assert.equal(c.submitManualAreaDraft(areaPanel,args),null);assert.equal(areaPanel.areaDraft.pending,false,'rejected local write leaves draft retryable');
areaPanel.areaDraft={...draft,id:'stale',scope:'old'};c.renderManualAreaDraft();assert.equal(areaPanel.areaDraft,null,'stale role/source/field draft is cancelled');

// Actual wall markup distinguishes advisory manual walls from rules walls.
const wallStart=ui.indexOf('function renderSceneWalls(');vm.runInContext(ui.slice(wallStart,ui.indexOf('\nfunction renderSceneBoard',wallStart)),c);
c.CSS={escape:String};let markup='';const board={querySelector:()=>({insertAdjacentHTML:(where,html)=>{markup+=html}})};
c.renderSceneWalls(board,[{id:'wall',a:'0,0',b:'1,0',label:'Wall',hp:99,maxHp:99}]);
assert.match(markup,/перемещение не блокируется/);assert.ok(!markup.includes('99'),'manual wall does not promise combat HP');
c.Scene.tablePolicy.mode='rules';markup='';c.renderSceneWalls(board,[{id:'wall',a:'0,0',b:'1,0',label:'Wall',hp:99,maxHp:99}]);assert.match(markup,/ЗД 99/);c.Scene.tablePolicy.mode='manual';

c.usingNextSceneInterface=()=>false;areaPanel.areaDraft=null;c.renderManualAreaDraft();assert.equal(areaPanel.hidden,true,"classic palette is compact when idle");
