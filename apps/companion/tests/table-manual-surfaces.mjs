import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const handlers=new Map(),nodes=new Map(),events=[],opened=[];
const element=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',value:'',checked:false,closest:()=>({hidden:false})});return nodes.get(id)};
let role='gm';const scene={tablePolicy:{mode:'manual',epoch:0,processStatuses:false},spaces:[{id:'main',name:'Main',width:7,height:7}],activeSpace:'main',selectedActor:'hero',manualTable:{actorId:'hero',round:1},actors:[{id:'hero',heroId:'owned',space:'main',name:'Hero',hp:7,maxHp:10,focus:4,influence:1,stress:0,tokenColor:'#112233'},{id:'enemy',space:'main',name:'Enemy',hidden:false},{id:'hidden',space:'main',hidden:true}],version:0};
const context={window:{DAWN_TABLE_POLICY:{isManual:s=>s.tablePolicy?.mode==='manual'},DAWN_MANUAL_READER_DATA:{entries:a=>[{id:'ability',name:a.name,text:`Private ${a.id}`}]},DAWN_MANUAL_WORKSPACE:{render:o=>{context.options=o},open:id=>{opened.push(id);return true}}},Scene:scene,Sync:{state:()=>({})},activeScenePanel:null,isEnglishPreview:()=>false,activeSceneView:()=>role,canControlSceneActor:a=>role==='gm'||a.id==='hero',esc:v=>String(v).replaceAll('<','&lt;'),$:element,document:{body:{dataset:{}},addEventListener:(name,handler)=>handlers.set(name,handler),querySelector:()=>null,querySelectorAll:()=>[]},activeSceneSpace:()=>scene.spaces[0],uid:()=>"note-event",clearManualAreaPreview:()=>{},persist:()=>{},renderScene:()=>{},closeAllScenePanels:()=>{},enemyProfile:()=>{},antagonistDefense:()=>{},wordById:()=>{},t:()=>{},sceneEffectList:()=>[],commitSceneEvents:(label,packet)=>{events.push(packet);return {ok:true}},setNarratorActorValue:()=>{throw Error('legacy numeric mutation')},setNarratorEffect:()=>{throw Error('legacy effect mutation')}};
vm.createContext(context);const source=read('scene-manual-integration.js');
vm.runInContext(source.slice(0,source.indexOf('function placeManualMapObject')),context);
vm.runInContext(source.slice(source.indexOf('function manualTableAbilities'),source.indexOf('window.DAWN_TABLE_POLICY?.install()')),context);
context.ensureManualAreaTools=()=>{};context.renderManualAreaDraft=()=>{};context.openManualTableArea=()=>{};context.renderManualClocks=()=>{};context.renderManualMapTools=()=>{};context.renderManualJournal=()=>{};
context.openManualTableDice=()=>{};context.openManualTableClocks=()=>{};
vm.runInContext(source.slice(source.indexOf('const numericCorrectionWithRules')),context);
const before=JSON.stringify(scene);
context.renderManualTable();assert.equal(context.options.openSheet,undefined,'Reader does not lead back to executable sheet');
assert.equal(context.options.roll,context.openManualTableDice);
context.renderManualActorInspector(scene.actors[0]);
assert.ok(element('scene-inspector').innerHTML.includes('data-manual-resource="stress"'));
assert.ok(!element('scene-inspector').innerHTML.includes('data-core-action'));
assert.ok(!element('scene-inspector').innerHTML.includes('data-scene-actor-acted'));
role='player';context.renderManualActorInspector({...scene.actors[2],name:'SECRET',hp:13});assert.ok(!element('scene-inspector').innerHTML.includes('SECRET'));assert.ok(!element('scene-inspector').innerHTML.includes('value="13"'));assert.equal(context.manualTableAbilities(scene.actors[1])[0].id,'access','player cannot read private NPC abilities');
assert.equal(context.manualTableAbilities(scene.actors[0])[0].text,'Private hero');
assert.equal(context.openManualActorReader('hidden'),false);assert.equal(opened.length,0);
assert.equal(context.openManualActorReader('hero'),true);assert.deepEqual(opened,['hero']);
const change=handlers.get('change');const input={value:'3',dataset:{manualResource:'focus',manualActor:'hero'}};
change({target:{closest:selector=>selector.includes("data-manual-resource")?input:null}});assert.equal(events.at(-1)[0].payload.kind,'resource');assert.equal(events.at(-1)[0].payload.values.focus,3);
input.dataset.manualActor='enemy';change({target:{closest:selector=>selector.includes("data-manual-resource")?input:null}});assert.equal(events.length,1,'foreign values cannot be edited');
input.dataset.manualActor='hero';input.value='';change({target:{closest:selector=>selector.includes("data-manual-resource")?input:null}});assert.equal(events.length,1,'blank is not interpreted as zero');
change({target:{id:'scene-manual-status-processing',checked:true}});assert.equal(events.length,1,'player cannot toggle shared hints');
role='gm';change({target:{id:'scene-manual-status-processing',checked:true}});assert.equal(events.at(-1)[0].payload.processStatuses,true);
assert.equal(JSON.stringify(scene),before,'reading and commands never write resource/policy locally');
console.log('Manual surfaces: Reader routing, NPC privacy, actor-bound typed resources, hint authority and no legacy runtime writes passed');

// Exercise the real legacy-panel redirects. A render calls setScenePanel again,
// as the production render does, so a stale panel exposes recursion.
const uiSource=read('scene-ui.js');
context.closeAllScenePanels=()=>{context.activeScenePanel=null};
vm.runInContext(uiSource.slice(uiSource.indexOf('function setScenePanel('),uiSource.indexOf('function closeAllScenePanels(')),context);
let renders=0;
context.renderScene=()=>{if(++renders>10)throw Error('recursive manual panel');if(context.activeScenePanel)context.setScenePanel(context.activeScenePanel)};
for(const panel of ['sheet','director']){context.activeScenePanel=panel;renders=0;context.setScenePanel(panel);assert.equal(context.activeScenePanel,null);assert.equal(renders,1)}
let inspectedActor=null,environmentReads=0;
context.renderManualActorInspector=a=>{inspectedActor=a};context.renderManualEnvironmentInspector=()=>{environmentReads++};
vm.runInContext(uiSource.slice(uiSource.indexOf('function renderSceneInspector('),uiSource.indexOf('function ',uiSource.indexOf('function renderSceneInspector(')+10)),context);
scene.selectedActor=null;context.renderSceneInspector();assert.equal(environmentReads,1,'manual environment inspector stays reachable');
scene.selectedActor='hero';context.renderSceneInspector();assert.equal(inspectedActor.id,'hero');
context.SceneEngine={ruleResourceDefinitions:()=>[],ruleClockDefinitions:()=>[],ruleModeDefinitions:()=>[]};
vm.runInContext(uiSource.slice(uiSource.indexOf('function sceneResourceChips('),uiSource.indexOf('function clockEventText(')),context);
assert.ok(context.sceneResourceChips({ap:3,focus:2}).includes('3 ОД'),'rules resource tray remains executable');
console.log('Manual panel regressions: stale sheet/director render is nonrecursive, environment remains readable, rules resource chips execute');

context.commitScene=(label,mutate)=>{mutate(scene);return {ok:true}};
context.clamp=(n,min,max)=>Math.max(min,Math.min(max,n));role='gm';
const hide={dataset:{manualActorHidden:'enemy'},checked:true};const hideEvent={target:{closest:selector=>selector.includes('data-manual-actor-hidden')?hide:null}};
scene.manualTable.actorId=null;change(hideEvent);assert.equal(scene.actors[1].hidden,true);assert.equal(scene.actors[1].manualInitiativeVisible,false,'hidden before start stays out of initiative');
scene.actors[1].hidden=false;delete scene.actors[1].manualInitiativeVisible;scene.manualTable.actorId='hero';change(hideEvent);assert.equal(scene.actors[1].manualInitiativeVisible,true,'vanishing during play keeps initiative');
const toggle={dataset:{manualInitiativeVisible:'enemy'},checked:false};change({target:{closest:selector=>selector.includes('data-manual-initiative-visible')?toggle:null}});assert.equal(scene.actors[1].manualInitiativeVisible,false);
role='player';toggle.checked=true;change({target:{closest:selector=>selector.includes('data-manual-initiative-visible')?toggle:null}});assert.equal(scene.actors[1].manualInitiativeVisible,false,'player cannot reveal hidden initiative');

// Execute the production board predicate against frozen mechanical presence.
const actorPredicate=uiSource.match(/actors=(Scene\.actors\.filter[\s\S]*?),markers=/)[1];
context.SceneEngine.effectPresenceStatus=()=>{throw Error('manual board must not query mechanical presence')};context.SceneEngine.isEnemyModifier=()=>{throw Error('manual board must not query modifier deployment')};
context.Scene.actors=[{id:'ordinary',space:'main'},{id:'vanished',space:'main',effects:['positive.исчез']},{id:'proxy',space:'main',deploymentProxy:true},{id:'hidden',space:'main',hidden:true}];
context.space={id:'main'};context.manualBoard=true;role='player';
assert.deepEqual(Array.from(vm.runInContext(actorPredicate,context),actor=>actor.id),['ordinary','vanished','proxy'],'manual visibility uses explicit hidden rather than frozen effects');

// The wrapping modifier renderer used to remove/recreate tokens even in manual mode.
context.renderSceneBoard=()=>{};let baseCalls=0;context.renderSceneBoardWithCrowdBase=()=>{baseCalls++};
context.applyEnemyModifierVisuals=()=>{throw Error('manual must not run automatic compound/modifier renderer')};
const wrapperStart=uiSource.indexOf('renderSceneBoard=function(){renderSceneBoardWithCrowdBase();');
vm.runInContext(uiSource.slice(wrapperStart,uiSource.indexOf('function renderSceneInspector',wrapperStart)),context);
context.renderSceneBoard();assert.equal(baseCalls,1);
