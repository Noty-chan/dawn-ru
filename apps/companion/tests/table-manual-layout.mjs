import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));
const c={window:{},console,Date,structuredClone};vm.createContext(c);
for(const file of ['data.js','edition-lionwing.js','logic.js'])vm.runInContext(read(file),c);
const engine=loadSceneEngine(c),policy=c.window.DAWN_TABLE_POLICY;policy.install(engine,c.window.DAWN_LIONWING_ENGINE);
const resources={hp:5,maxHp:10,ap:2,baseAp:3,focus:4,influence:2,wounds:1,stress:2,armor:1,evasion:2,speed:4};
const hero={id:'hero',kind:'hero',team:'hero',heroId:'sheet',ownerId:'owner',name:'H',rulesEdition:'lionwing',space:'main',x:6,y:6,...resources,effects:['frozen'],ruleState:{growth:7},usedActions:['frozen'],acted:true,knockedOut:true};
const fixture=()=>({rulesEdition:'lionwing',tablePolicy:{mode:'manual',epoch:5},version:9,round:7,tension:8,turnSerial:42,activeActorId:'old',activeSpace:'main',spaces:[{id:'main',name:'Board',mode:'standard',width:7,height:7},{id:'other',name:'Other',mode:'custom',width:3,height:3}],actors:[plain(hero),{id:'old',kind:'enemy',team:'enemy',name:'Old',space:'main',x:1,y:1,hidden:true},{id:'other-npc',kind:'enemy',team:'enemy',name:'Other',space:'other',x:1,y:1}],objects:[{id:'old-map',type:'terrain',space:'main',cells:['1,1']},{id:'other-map',space:'other',cells:['0,0']}],walls:[],markers:[],manualTable:{actorId:'old',round:6},sessionClocks:[{id:'private-clock',manual:true,ownerActorId:'old',size:3,value:1}],eventReceipts:[],lionwing:{auras:[{id:'aura',ownerActorId:'old',label:'PRIVATE'}],receipts:[]},log:[],targetIds:['old','hero'],targetCells:['1,1']});
const payload=()=>({kind:'layout/replace',expectedVersion:9,policyEpoch:5,layout:{scope:'space',name:'Layout',spaces:[{id:'main',name:'New',mode:'custom',width:3,height:3}],activeSpace:'main',actors:[{id:'new',kind:'enemy',team:'enemy',name:'New',rulesEdition:'lionwing',tier:1,space:'main',x:1,y:1,...resources}],objects:[{id:'area',space:'main',cells:['1,1'],label:'Advisory',appearance:'terrain',color:'#65c8d0',hidden:false,ownerActorId:'new'}],walls:[{id:'wall',space:'main',a:'0,0',b:'1,0',label:'Wall',hidden:true,ownerActorId:null}],markers:[{id:'mark',space:'main',x:2,y:2,label:'Clock',kind:'custom',color:'#e2b54a',hidden:false,ownerActorId:'new',clock:{size:3,value:2}}]}});
const event=p=>({id:'layout-event',type:'table.command',actorId:null,payload:p});
const before=fixture(),saved=JSON.stringify(before),out=engine.dispatchMany(before,[event(payload())]);
assert.equal(JSON.stringify(before),saved,'replacement does not mutate the input');assert.equal(out.events.length,1);assert.equal(out.scene.version,10);assert.equal(out.scene.log[0].visibility,'gm','private layout payload cannot enter the public audit');
assert.deepEqual(plain(out.scene.actors.find(row=>row.id==='hero')),{...hero,x:2,y:2});
assert.deepEqual(plain(out.scene.actors.find(row=>row.id==='other-npc')),before.actors[2]);assert.ok(out.scene.objects.some(row=>row.id==='other-map'));
assert.equal(out.scene.objects.find(row=>row.id==='area').type,'manual-area');assert.equal(out.scene.markers[0].metadata.clock.value,2);assert.equal(out.scene.walls[0].manual,true);
for(const key of ['round','tension','turnSerial','activeActorId'])assert.equal(out.scene[key],before[key]);
assert.equal(out.scene.manualTable.round,6);assert.equal(out.scene.manualTable.actorId,null);assert.deepEqual(Array.from(out.scene.targetIds),['hero']);assert.equal(out.scene.sessionClocks[0].ownerActorId,'old','orphan private owner stays private');
assert.equal(out.scene.lionwing.auras[0].ownerActorId,'old','frozen aura is not executed or removed');
assert.equal(engine.dispatchMany(out.scene,[event(payload())]).scene.version,10,'exact replay does not replace the board again');
for(const change of [p=>{p.expectedVersion=8},p=>{p.policyEpoch=4},p=>{p.layout.actors[0].id='hero'},p=>{p.layout.actors[0].x=3},p=>{p.layout.actors[0].heroId='impersonation'},p=>{p.layout.lionwing={}},p=>{p.layout.objects[0].ownerActorId='hero'},p=>{p.layout.markers[0].clock.value=4},p=>{p.layout.spaces[0].width=13},p=>{p.layout.actors=Array.from({length:120},(_,i)=>({...p.layout.actors[0],id:`a-${i}`}))}]){
 const scene=fixture(),p=payload();change(p);assert.throws(()=>engine.dispatchMany(scene,[event(p)]));assert.equal(JSON.stringify(scene),saved,'invalid replacement is atomic');
}
const pending=fixture();pending.pendingPrompt={id:'wait'};assert.throws(()=>engine.dispatchMany(pending,[event(payload())]),error=>error.code==='TABLE_PENDING_WORK');
const full=payload();full.layout.scope='table';full.layout.spaces=[{id:'fresh',name:'Fresh',mode:'custom',width:3,height:3}];full.layout.activeSpace='fresh';for(const key of ['actors','objects','walls','markers'])full.layout[key].forEach(row=>row.space='fresh');Object.assign(full.layout,{artworks:[],backgroundArt:null,featuredArt:null,backgroundView:{fit:'cover',position:'center',dim:28,gridOpacity:58}});
const replaced=engine.dispatchMany(fixture(),[event(full)]).scene;assert.equal(replaced.spaces.length,1);assert.equal(replaced.actors.find(row=>row.id==='hero').space,'fresh');assert.ok(!replaced.actors.some(row=>row.id==='other-npc'));

// Use real aura/inventory producers before freezing the scene, then delete or
// replace their hidden source. Read projection must not execute their cleanup.
const lw=c.window.DAWN_LIONWING_ENGINE,inventory=c.window.DAWN_LIONWING_INVENTORY;
let produced=fixture();produced.tablePolicy.mode='rules';produced.actors[0].knockedOut=false;produced.actors[1]={...plain(hero),id:'old',kind:'enemy',team:'enemy',heroId:null,ownerId:null,name:'SECRET SOURCE',hidden:true,x:1,y:1};
produced=lw.dispatchMany(produced,[{id:'actual-aura',type:'lionwing.command',actorId:'old',payload:{kind:'aura',operation:'create',id:'SECRET_AURA',ownerActorId:'old',sourceEntityId:'old',ruleId:'test.aura',effectId:'positive.укреплен',shape:{kind:'radius',distance:1},filter:{relation:'ally'},lifetime:'scene'}}]).scene;
produced=engine.dispatchMany(produced,[{id:'SECRET_EFFECT_EVENT',type:'effect.apply',actorId:'old',payload:{targetId:'hero',effect:'negative.обездвижен',duration:'scene',sourceBound:true}}]).scene;
produced.markers.push({id:'public-backing',space:'main',x:1,y:1,kind:'mark'});
produced=c.window.DAWN_LIONWING_ENTITIES.create(produced,{id:'SECRET_ENTITY',kind:'summon',ownerActorId:'old',source:{actorId:'hero'},rule:'manual.entity',backing:{markerId:'public-backing'},lifetime:{boundary:'scene'},visibility:'public'},{role:'narrator',eventId:'SECRET_ENTITY_EVENT'}).scene;
inventory.applyOperation(produced,{operation:'configure',targetId:'hero',sourceActorId:'old',id:'secret-source-item',kind:'charges',label:'SECRET_ITEM',minimum:0,maximum:6,initial:3,current:3,visibility:'public',lifetime:'scene',resetAt:'manual'},{actorId:'hero',sourceActorId:'old',role:'gm',eventId:'actual-inventory'});
produced.tablePolicy={mode:'manual',epoch:5};
const producedSaved=JSON.stringify(produced);assert.ok(!JSON.stringify(engine.projectScene(produced,{role:'player',actorId:'hero'})).includes('SECRET_'),'hidden provenance is private even on a public inventory record');assert.equal(JSON.stringify(produced),producedSaved);
assert.ok(engine.projectScene(produced,{role:'player',actorId:'hero'}).actors.find(row=>row.id==='hero').effects.includes('negative.обездвижен'),'visible effect remains while private source metadata is removed');
const journalBefore=JSON.stringify(produced.actors.find(row=>row.id==='hero').lionwing.inventory.journal);
produced.actors.find(row=>row.id==='hero').ruleState.technical={actorId:'old',value:7};
const deleted=engine.dispatchMany(produced,[{id:'remove-source',type:'table.command',actorId:null,payload:{kind:'actor/remove',id:'old'}}]).scene;
assert.equal(JSON.stringify(deleted.actors.find(row=>row.id==='hero').lionwing.inventory.journal),journalBefore,'historical inventory receipts cannot be rewritten during technical detachment');
assert.deepEqual(plain(deleted.actors.find(row=>row.id==='hero').ruleState.technical),{actorId:null,value:7},'only the deleted technical reference is detached');
assert.equal(deleted.lionwing.auras[0].ownerActorId,'old');assert.ok(!JSON.stringify(engine.projectScene(deleted,{role:'player',actorId:'hero'})).includes('SECRET_'),'orphan frozen aura remains private after deleting its source');
const replacePayload=payload();replacePayload.expectedVersion=produced.version;const layoutDeleted=engine.dispatchMany(produced,[{id:'replace-source',type:'table.command',actorId:null,payload:replacePayload}]).scene;assert.ok(!JSON.stringify(engine.projectScene(layoutDeleted,{role:'player',actorId:'hero'})).includes('SECRET_'));
vm.runInContext(read('network-v2.js'),c);assert.throws(()=>c.window.DAWN_NETWORK_V2.materializeIntent(fixture(),c.window.DAWN_DATA,{kind:'table',actorId:'hero',policyEpoch:5,request:payload()},'owner'),/Нарратору/);

// Real preparation and confirmation route; UI/transport dependencies are mocked.
let serial=0,confirm=false,writes=0,role='gm';c.Scene=fixture();c.uid=()=>`prepared-${++serial}`;c.activeSceneView=()=>role;c.activeSceneSpace=()=>c.Scene.spaces.find(row=>row.id===c.Scene.activeSpace);c.toast=()=>null;c.isEnglishPreview=()=>false;c.Sync={state:()=>({})};c.sceneHasLocalPendingSelection=()=>false;c.SceneEngine=engine;c.window.confirm=()=>confirm;
c.commitSceneEvents=(label,events)=>{writes++;const result=engine.dispatchMany(c.Scene,events);c.Scene=result.scene;return result};
const library=read('gm-library.js'),start=library.indexOf('function manualEncounterLayout('),end=library.indexOf('\nfunction deployEncounter(',start);vm.runInContext(library.slice(start,end),c);
c.enemyProfile=id=>({id,name:'A'});c.enemyActorFromProfile=(profile,tier,opts)=>({id:'source',kind:'enemy',team:'enemy',name:'A',profileId:profile.id,space:opts.spaceId,...opts.position,...resources});
const encounter={edition:'lionwing',name:'Basic',mode:'standard',width:7,height:7,enemies:[{profileId:'lionwing.npc.assassin',tier:1,x:1,y:1}],objects:[{type:'difficult',label:'Area',cells:['1,1'],ownerEnemyIndex:0}],walls:[],markers:[]};
let previewDialog;const output={textContent:''};c.showManualEncounterPreview=payload=>{previewDialog={layoutPayload:payload,sceneScope:'local',querySelector:()=>output,close(){this.layoutPayload=null}};return {preview:true}};
c.deployManualEncounter(encounter);assert.equal(writes,0);assert.equal(JSON.stringify(c.Scene),saved,'preview/cancel do not mutate state');previewDialog.close();assert.equal(writes,0);
role='player';c.deployManualEncounter(encounter);assert.equal(writes,0);role='gm';c.deployManualEncounter(encounter);c.confirmManualEncounter(previewDialog);assert.equal(writes,1);assert.equal(c.Scene.actors.find(row=>row.name==='A').profileId,'lionwing.npc.assassin');
console.log('Manual layout: typed atomic space/table replacement, frozen heroes/runtime, caps, stale revision/epoch, private audit, replay, player denial, real preview/cancel route passed');

// Imported full presets exclude sheet-owned heroes. Classify private/orphan
// annotations before their original owner identity is removed by the mapper.
const excluded={...plain(hero),id:'private-sheet-owner',heroId:'foreign-sheet',hidden:true};
const template={spaces:[{id:'main',name:'Main',mode:'custom',width:3,height:3}],activeSpace:'main',actors:[excluded],objects:[{id:'secret-area',space:'main',ownerActorId:excluded.id,label:'SECRET_IMPORTED_AREA',cells:['2,2'],hidden:false}],walls:[{id:'secret-wall',space:'main',ownerActorId:excluded.id,label:'SECRET_IMPORTED_WALL',a:'1,1',b:'2,1',hidden:false}],markers:[{id:'orphan-marker',space:'main',ownerActorId:'deleted-owner',label:'SECRET_IMPORTED_MARKER',x:1,y:1,hidden:false}],artworks:[]};
const imported=c.manualEncounterLayout({edition:'lionwing',name:'Private preset',templateScene:template});
assert.equal(imported.layout.actors.length,0);
for(const kind of ['objects','walls','markers']){assert.equal(imported.layout[kind][0].hidden,true,kind+' preserves source privacy before owner remap');assert.equal(imported.layout[kind][0].ownerActorId,null);}
const importedScene=engine.dispatchMany(c.Scene,[{id:'import-private-full',type:'table.command',actorId:null,payload:imported}]).scene;
assert.ok(!JSON.stringify(engine.projectScene(importedScene,{role:'player'})).includes('SECRET_IMPORTED_'));
assert.equal(importedScene.objects[0].label,'SECRET_IMPORTED_AREA','narrator can still access private annotations');
template.actors[0].hidden=false;template.markers[0].ownerActorId=excluded.id;
const publicImport=c.manualEncounterLayout({edition:'lionwing',name:'Public preset',templateScene:template});
for(const kind of ['objects','walls','markers'])assert.equal(publicImport.layout[kind][0].hidden,false,'explicit public source is not blanket hidden');
console.log('Full preset producer: excluded hidden sheet owner, orphan owner, walls/markers/areas and intentional public annotations passed');
