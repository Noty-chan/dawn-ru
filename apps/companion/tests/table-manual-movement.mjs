import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const context={window:{},console};vm.createContext(context);
for(const file of ['data.js','edition-lionwing.js','logic.js'])vm.runInContext(read(file),context);
const engine=loadSceneEngine(context);vm.runInContext(read('scene-table-policy.js'),context);context.window.DAWN_TABLE_POLICY.install();
const scene={rulesEdition:'lionwing',tablePolicy:{mode:'manual',epoch:2},version:0,spaces:[{id:'main',width:7,height:7},{id:'other',width:7,height:7}],actors:[{id:'hero',kind:'hero',heroId:'h',space:'main',x:1,y:1,hp:8,maxHp:8,ap:3,effects:[],tokenColor:'#123456',name:'Hero',manualMovementTrace:{from:{space:'main',x:0,y:0},to:{space:'main',x:1,y:1}}},{id:'other',space:'other',manualMovementTrace:{from:{space:'other',x:0,y:0},to:{space:'other',x:1,y:1}}}],movementTraces:[{legacy:true}],lionwing:{sentinel:'frozen'},log:[]};
const before=JSON.stringify(scene),event={id:'clear-traces',type:'table.command',actorId:null,payload:{kind:'movement/clear',space:'main'}};
const result=engine.dispatchMany(scene,[event]);
assert.equal(JSON.stringify(scene),before);
assert.equal(result.scene.actors[0].manualMovementTrace,undefined);
assert.deepEqual(JSON.parse(JSON.stringify(result.scene.actors[1])),scene.actors[1]);
assert.deepEqual(JSON.parse(JSON.stringify(result.scene.movementTraces)),scene.movementTraces);
assert.equal(result.scene.lionwing.sentinel,scene.lionwing.sentinel);
assert.equal(result.scene.lionwing.receipts.length,1,'the canonical receipt is the sole legacy-container write');
assert.equal(engine.dispatchMany(result.scene,[event]).scene.version,result.scene.version,'duplicate clear is idempotent');
assert.throws(()=>engine.dispatchMany(scene,[{...event,id:'bad',payload:{kind:'movement/clear',space:'missing'}}]),/Пространство/);
assert.throws(()=>engine.dispatchMany(scene,[{...event,id:'bad2',payload:{kind:'movement/clear',space:'main',actorId:'other'}}]),/Неизвестные поля/);
// Real SVG adapter: manual traces do not read the legacy combat status query.
Object.assign(context,{Scene:scene,SceneEngine:{movementTraceStatus(){throw Error('legacy query')}},sceneCombatStarted:()=>false,manualTableCopy:(ru,en)=>en,safeColor:v=>v,esc:v=>String(v)});
const ui=read('scene-ui.js');vm.runInContext(ui.slice(ui.indexOf('function insetSceneTracePoints('),ui.indexOf('function renderSceneBoard(')),context);
const svg=context.sceneMovementTracesSvg(scene.spaces[0],[scene.actors[0]]);
assert.ok(svg.includes('Manual movement'));assert.ok(svg.includes('scene-move-trace normal manual'));
scene.actors[0].manualMovementTrace.to.x=NaN;assert.equal(context.sceneMovementTracesSvg(scene.spaces[0],[scene.actors[0]]),'');
const node={};let role='gm',events=[];
Object.assign(context,{$:()=>node,activeSceneView:()=>role,commitSceneEvents:(label,packet)=>events.push(packet)});
const source=read('app-scene-events.js'),start=source.indexOf('$('+'"scene-clear-movement-traces")');
vm.runInContext(source.slice(start,source.indexOf('\n',start)),context);node.onclick();assert.equal(events[0][0].payload.kind,'movement/clear');role='player';node.onclick();assert.equal(events.length,1);
console.log('Manual movement: typed clear isolation, space validation, replay, GM UI authority and actual SVG without legacy query passed');

// Load the final LionWing override too: base UI coverage alone missed deployment.
Object.assign(context,{moveSceneActorFromBoard:undefined,canControlSceneActor:()=>true,toast:()=>null});
vm.runInContext(ui.slice(ui.indexOf('function moveSceneActorFromBoard('),ui.indexOf('function ',ui.indexOf('function moveSceneActorFromBoard(')+10)),context);
const lwUi=read('lionwing-ui.js');vm.runInContext(lwUi.slice(lwUi.indexOf('const lwOldBoardMove ='),lwUi.indexOf('document.addEventListener',lwUi.indexOf('const lwOldBoardMove ='))),context);
events=[];scene.activeSpace='main';context.moveSceneActorFromBoard(scene.actors[0],3,3,{manual:true});
assert.equal(events[0][0].type,'table.command');assert.equal(events[0][0].payload.kind,'move','final LionWing override must not reinterpret manual movement as Deployment or Step');
