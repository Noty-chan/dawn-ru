import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const current=fs.readFileSync(new URL('../scene-ui.js',import.meta.url),'utf8');
const section=source=>source.slice(source.indexOf('function sceneDestinationPreviewScene()')>=0?source.indexOf('function sceneDestinationPreviewScene()'):source.indexOf('function renderSceneBoard(){'),source.indexOf('function applyEnemyModifierVisuals()'));
const baselineRef=process.argv.find(arg=>arg.startsWith('--baseline='))?.split('=')[1];
const baseline=baselineRef&&execFileSync('git',['show',`${baselineRef}:apps/companion/scene-ui.js`],{encoding:'utf8'});
function workload(source,{view='gm',manual=false,moving=false,size=12}={}){
  const counts={objectMembership:0,deployment:0,movementStatus:0,legacyPath:0,destination:0,havenSafe:0};
  const space={id:'main',width:size,height:size},board={dataset:{},style:{setProperty(){}},setAttribute(){},querySelector:()=>({classList:{add:className=>{if(className==="haven-safe-cell")counts.havenSafe++;}},style:{setProperty(){}}}),innerHTML:''};
  const scene={rulesEdition:'lionwing',activeSpace:'main',spaces:[space],actors:[],objects:[],markers:[],walls:[],topology:{cuts:[]},targetIds:[],targetCells:[],tool:'select'};
  for(let i=0;i<(size===7?12:40);i++)scene.actors.push({id:`actor-${i}`,space:'main',x:i%size,y:Math.floor(i/size),name:`Actor ${i}`,kind:'token',team:'hero',hp:10,maxHp:12,speed:4,ap:2,tokenColor:'#ffffff',hidden:i%9===0,effects:[],usedActions:[]});
  for(let i=0;i<(size===7?12:40);i++){
    const cells=Array.from({length:16},(_,j)=>`${(i+j)%size},${(Math.floor(i/size)+Math.floor(j/4))%size}`);
    cells.includes=function(key){counts.objectMembership++;return Array.prototype.includes.call(this,key);};
    scene.objects.push({id:`area-${i}`,space:'main',type:'terrain',cells,label:`Area ${i}`,source:'fixture',manual:i%2===0,color:'#ffffff',hidden:i%9===0,metadata:i===0?{enemyModifier:"haven"}:undefined});
  }
  for(let i=0;i<(size===7?8:24);i++)scene.markers.push({id:`marker-${i}`,space:'main',x:i%size,y:Math.floor(i/size),kind:'flag',label:`Marker ${i}`,color:'#ffffff',ruleId:i%5===0?'altruist.will-o-wisp.1':'',hidden:i%9===0});
  scene.objects.push({id:'deployment',space:'main',type:'deploy-hero',cells:['0,0','1,0'],label:'Deployment',source:'fixture'});
  const removed=[`${size-1},${size-1}`,`${size-2},${size-1}`];scene.topology.cuts=[{space:'main',cells:removed,crossing:'opposite'}];
  const engine={effectPresenceStatus:()=>({onField:true}),removedCellKeys:()=>new Set(removed),actionIs:(action,key)=>action?.id===key,actionIsAny:(action,keys)=>keys.includes(action?.id),effectMovementStatus:(_,id,{distance})=>{counts.movementStatus++;return {distance};},movementPath:()=>{counts.legacyPath++;return [{x:0,y:0}];},effectCellOccupancyStatus:()=>({available:true})};
  const context=vm.createContext({Scene:scene,SceneEngine:engine,D:{actions:{list:[{id:'step'}]}},window:{DAWN_TABLE_POLICY:{isManual:()=>manual},DAWN_LIONWING_ENGINE:{destinationStatus:()=>{counts.destination++;return {available:true};}}},$:()=>board,activeSceneSpace:()=>space,activeSceneView:()=>view,sceneCombatStarted:()=>false,sceneEnvironmentVisible:item=>view==='gm'||!item.hidden,canControlScenePrompt:()=>false,currentHeroActor:()=>scene.actors[1],pendingCoreAction:moving?'step':null,pendingCoreActionContext:null,pendingCoreReaction:null,pendingEnemyStepActorId:null,pendingZealotPlan:null,scenePreviewCells:new Set(['3,3']),sceneMeasureCells:new Set(),sceneTopologyCells:new Set(),sceneMeasureLabel:'',sceneActorEffects:actor=>actor.effects,canDragSceneActor:()=>true,sceneObjectDisplayType:item=>item.type,sceneObjectDisplayName:item=>item.label,safeColor:color=>color||'#ffffff',t:(key,args)=>`${key}:${JSON.stringify(args)}`,esc:value=>String(value),clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),SCENE_DURATION_NAMES:{},sceneMarkerGlyph:()=>'*',sceneMarkerHostLabel:()=>'',renderSceneWalls:()=>{},sceneMovementTracesSvg:()=>'',isEnglishPreview:()=>false,manualTableCopy:ru=>ru,CSS:{escape:String},deploymentCells:(_,team)=>{counts.deployment++;return team==='hero'?['0,0','1,0']:[`${size-1},0`];}});
  vm.runInContext(section(source),context);
  const render=()=>vm.runInContext('renderSceneBoard()',context);
  render();
  return {render,counts,board,scene};
}
for(const size of [7,12])for(const mode of [{},{view:'player'},{manual:true},{moving:true}]){
  const options={size,...mode};
  const after=workload(current,options);
  assert.equal((after.board.innerHTML.match(/role="gridcell"/g)||[]).length,size*size);
  assert.equal(after.counts.objectMembership,0,'Rendering indexes object cells once instead of testing every object against every board cell');
  assert.equal(after.counts.deployment,2,'Deployment is calculated once for each team');
  if(options.moving){assert.equal(after.counts.legacyPath,0);assert.equal(after.counts.movementStatus,0);assert.equal(after.counts.destination,size*size,'LionWing remains the source of every destination highlight');}
  if(options.view==='player'){assert.equal(after.counts.havenSafe,0,'Hidden Haven geometry never receives Player highlights');assert.doesNotMatch(after.board.innerHTML,/data-scene-actor="actor-0"/);assert.doesNotMatch(after.board.innerHTML,/data-scene-marker="marker-0"/);}
  if(baseline){
    const before=workload(baseline,options);
    assert.equal(after.board.innerHTML,before.board.innerHTML,'Production rendering remains byte-identical for the same scene/view/policy/selection');
    const time=fixture=>{for(let i=0;i<3;i++)fixture.render();const start=performance.now();for(let i=0;i<10;i++)fixture.render();return (performance.now()-start)/10;};
    const beforeCounts={...before.counts},afterCounts={...after.counts};
    const beforeMs=time(before),afterMs=time(after);
    console.log(JSON.stringify({options,baselineRef,beforeCounts,afterCounts,beforeMs:+beforeMs.toFixed(2),afterMs:+afterMs.toFixed(2)}));
  }
}
console.log('PASS actual board renderer: bounded spatial/deployment work, LionWing-only destinations, player visibility and full markup equivalence when baseline supplied. DOM layout/paint and native engine latency are not measured.');
