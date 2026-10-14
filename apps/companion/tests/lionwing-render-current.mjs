import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {runtime,fixture,actor,clone} from './helpers/scene-contract-harness.mjs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const source=read('lionwing-ui.js'),baselineRef=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11)||'1368b6f';
const baseline=process.argv.includes('--benchmark')?execFileSync('git',['show',`${baselineRef}:apps/companion/lionwing-ui.js`],{encoding:'utf8'}):null;
const section=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child)}return value};

function renderRuntime(text=source){
  const {context,engine,core}=runtime(),counts={status:0,gate:0,prepare:0,targets:0,pending:0,ownership:0};
  let view='gm',owns=true,pending='';
  const wrapper={...core,actionStatus(...args){counts.status++;return core.actionStatus(...args)},actionGate(...args){counts.gate++;return core.actionGate(...args)},prepare(...args){counts.prepare++;return core.prepare(...args)}};
  context.window.DAWN_LIONWING_ENGINE=wrapper;
  Object.assign(context,{Scene:fixture(),SceneEngine:engine,LionwingEngine:wrapper,esc,store:{mode:'play'},
    document:{documentElement:{},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    lwOwns(){counts.ownership++;return owns},lwCanNarrate:()=>view==='gm',lwActive:()=>true,activeSceneView:()=>view,
    lwGeometrySceneIdentity:()=> 'render-current-scene',renderScene(){},toast(){},lwRules:()=>context.window.DAWN_LIONWING_DATA.coreRules,
    currentHeroActor:()=>context.Scene.actors.find(row=>row.id==='hero'),sceneDirectorActor:()=>context.Scene.actors.find(row=>row.id==='hero'),
    lwPendingCommandReason(){counts.pending++;return pending},lwEntityViewer:()=>({role:'narrator',actorIds:['hero']}),
  });
  context.window.document=context.document;
  for(const file of ['localization.js','locale-ru.js','locale-en-builder.js','edition-lionwing-ru.js','lionwing-technique-surface.js'])vm.runInContext(read(file),context,{filename:file});
  const actualSurface=context.window.DAWN_LIONWING_TECHNIQUE_SURFACE;
  context.window.DAWN_LIONWING_TECHNIQUE_SURFACE={...actualSurface,render:()=>'',actionTargets(...args){counts.targets++;return actualSurface.actionTargets(...args)}};
  vm.runInContext('let lwDestination=null,lwGeometryPreview=null,lwDetectiveTeleport=null,lwTechniqueDraft=null;'+section(text,'const lwTechniqueText','const lwRules ='),context);
  for(const name of ['lwStatusHtml','lwPendingHtml','lwDiceHtml','lwChainHtml','lwConsequenceHistoryHtml','lwInventoryHtml','lwAutomationHtml','lwMasterControls'])context[name]=()=>'';
  context.lwRestoredControls=()=>({});
  vm.runInContext(section(text,'function lwActionsHtml(','function lwEffectSourcesHtml('),context);
  const run=code=>vm.runInContext(code,context),html=()=>run('lwTechniqueDraftHtml(Scene.actors.find(row=>row.id==="hero"))');
  return {context,engine,core,counts,run,html,actions:()=>context.lwActionsHtml(context.Scene.actors[0]),view:value=>{view=value;context.Scene.view=value},owns:value=>{owns=value},pending:value=>{pending=value},surface:actualSurface};
}

// The actual button renderer consumes the canonical presentation gate once.
// Full markup remains identical for normal, unpaid, denied and Breakout cases.
for(const mode of ['normal','no-ap','breakout','pending','foreign']){
  const changed=renderRuntime();changed.context.Scene.targetIds=['enemy'];
  const configure=test=>{
    if(mode==='no-ap')test.context.Scene.actors[0].ap=0;
    if(mode==='breakout'){test.context.Scene.activeActorId='enemy';test.context.Scene.lionwing.breakout={actorId:'enemy'}}
    if(mode==='pending')test.pending('Awaiting this actor');
    if(mode==='foreign')test.owns(false);
  };
  configure(changed);const before=clone(changed.context.Scene);freeze(changed.context.Scene);
  const markup=changed.actions(),actionCount=changed.context.lwRules().actions.list.filter(row=>row.type==='action').length;
  assert.equal(changed.counts.status,2,'only two distinct Finisher attribute/cap quotes remain as direct status calls');
  assert.equal(changed.counts.pending,1,'one pending-actor check feeds all initial buttons');
  assert.deepEqual(clone(changed.context.Scene),before,'rendering a frozen canonical Scene is read-only');
  if(mode==='pending')assert.match(markup,/Awaiting this actor/);
  if(baseline){const prior=renderRuntime(baseline);prior.context.Scene=clone(before);configure(prior);assert.equal(markup,prior.actions(),`all canonical ${mode} button markup stays identical`);assert.equal(prior.counts.status,actionCount+2+(mode==='breakout'?actionCount:0));console.log(JSON.stringify({workload:'actionMarkup',mode,before:prior.counts,after:changed.counts}));}
}

// The board tool changes pointer handling only. Its canonical gate, candidate
// rows and prepared events are identical, so changing it must retain a draft's
// exact displayed roll rather than preparing another random result.
for(const actionKey of ['spell','study']){
  const test=renderRuntime(),scene=test.context.Scene;
  scene.targetIds=['enemy'];scene.tool='target';
  const payload={kind:'action',actionId:test.engine.ACTION_IDS[actionKey],targetIds:['enemy']};
  let expectedPrepared,expectedTargets;
  for(const tool of ['target','measure','select']){
    const input={...clone(scene),tool};freeze(input);const before=clone(input);
    const prepared=test.core.prepare(input,{...payload,actorId:'hero',eventId:`tool-oracle:${actionKey}`},{random:()=>0.35});
    assert.equal(prepared.ok,true,prepared.errors?.join(' '));
    const mechanical={events:clone(prepared.events),errors:clone(prepared.errors)};
    const targets=clone(test.surface.actionTargets(input,'hero',payload));
    if(expectedPrepared){assert.deepEqual(mechanical,expectedPrepared,'board tool cannot change canonical prepared events');assert.deepEqual(targets,expectedTargets,'board tool cannot change canonical candidate gates')}
    else{expectedPrepared=mechanical;expectedTargets=targets}
    assert.deepEqual(clone(input),before,'tool oracle queries preserve the frozen input');
  }
  test.context.lwBeginActionPreview('hero',payload,actionKey);test.html();
  const displayed=test.run('lwTechniqueDraft.preview'),events=clone(displayed.events),calls=test.counts.prepare,probes=test.counts.targets;
  for(const tool of ['measure','select','target']){
    scene.tool=tool;test.html();
    assert.equal(test.run('lwTechniqueDraft.preview'),displayed,'switching the board tool retains the exact displayed prepared action');
    assert.deepEqual(clone(test.run('lwTechniqueDraft.preview.events')),events);
    assert.equal(test.run('lwTechniqueDraft.previewNotice'),'','a board tool change does not announce a mechanical Scene change');
  }
  assert.equal(test.counts.prepare,calls,'tool changes neither re-roll the draft nor repeat candidate prepares');
  assert.equal(test.counts.targets,probes,'tool changes retain current candidate rows');
  scene.actors[0].ap=0;scene.tool='measure';test.html();
  assert.equal(test.run('lwTechniqueDraft.preview.ok'),false,'same-object canonical resources still invalidate a draft while measuring');
  scene.actors[0].ap=3;scene.tool='select';test.html();assert.equal(test.run('lwTechniqueDraft.preview.ok'),true);
  const key=test.run('lwTechniqueDraftSceneKey()');scene.selectedActor='enemy';
  assert.notEqual(test.run('lwTechniqueDraftSceneKey()'),key,'selected actor remains in the complete context key');
}

const draft=renderRuntime(),table=draft.context.Scene,hero=table.actors[0],enemy=table.actors[1];
// Scene.targetIds is UI selection, not an implicit target for the canonical
// target probe: each candidate request supplies its own explicit targetIds.
for(const actionId of [draft.engine.ACTION_IDS.spell,draft.engine.ACTION_IDS.study,draft.engine.ACTION_IDS.shove]){
  let expected;
  for(const selection of [[],['enemy'],['hero'],['missing'],['enemy','hero']]){
    const candidateScene={...clone(table),targetIds:selection};freeze(candidateScene);
    const actual=clone(draft.surface.actionTargets(candidateScene,'hero',{kind:'action',actionId,targetIds:['enemy']}));
    if(expected)assert.deepEqual(actual,expected,'canonical candidate availability/reasons are independent of UI selection');else expected=actual;
  }
}
table.targetIds=['enemy'];draft.context.lwBeginActionPreview('hero',{kind:'action',actionId:draft.engine.ACTION_IDS.spell,targetIds:['enemy']},'Spell');
const initial=clone(table);assert.match(draft.html(),/data-lw-technique-confirm >/);
const events=clone(draft.run('lwTechniqueDraft.preview.events')),preparedCalls=draft.counts.prepare;
draft.html();assert.deepEqual(clone(draft.run('lwTechniqueDraft.preview.events')),events,'unchanged renders retain the exact displayed roll/event ids');
assert.equal(draft.counts.prepare,preparedCalls,'unchanged draft rendering formats the verified preview instead of preparing another quote');
draft.context.window.DAWN_I18N.setLocale('en');draft.html();assert.deepEqual(clone(draft.run('lwTechniqueDraft.preview.events')),events,'locale changes update presentation without re-rolling');
assert.equal(draft.counts.prepare-preparedCalls,table.actors.length-1,'locale change probes current target rows but does not reprepare the cached action');
assert.deepEqual(clone(table),initial,'draft rendering and locale changes preserve canonical state');

hero.ap=0;draft.html();assert.equal(draft.run('lwTechniqueDraft.preview.ok'),false,'same-object AP depletion invalidates a displayed preview without a version bump');
assert.match(draft.html(),/data-lw-technique-confirm disabled/);hero.ap=3;draft.html();assert.equal(draft.run('lwTechniqueDraft.preview.ok'),true);
enemy.x=7;enemy.y=5;draft.html();assert.equal(draft.run('lwTechniqueDraft.preview.ok'),false,'same-object target movement refreshes canonical range checks');
assert.equal(draft.run('lwTechniqueDraft.targets.find(row=>row.id==="enemy").available'),false);
enemy.x=4;enemy.y=1;hero.lionwing.denials=[{id:'block',actionId:draft.engine.ACTION_IDS.spell,remaining:1,scope:'manual',reason:'Canonical action block'}];draft.html();assert.equal(draft.run('lwTechniqueDraft.preview.ok'),false);assert.match(draft.html(),/Canonical action block/);
delete hero.lionwing.denials;draft.html();assert.equal(draft.run('lwTechniqueDraft.preview.ok'),true);
draft.pending('Awaiting this actor');assert.match(draft.html(),/data-lw-technique-confirm disabled/);draft.pending('');

// UI history is never input to the value key; canonical journals and usage
// receipts remain input. Mutating history does not roll the visible action.
const poison={toJSON(){throw new Error('serialized local UI history')}};table.undo=[{state:poison}];table.redo=[poison];table.turnUndo=[poison];
const keyBefore=draft.run('lwTechniqueDraftPreviewKey(lwTechniqueDraftPayload(lwTechniqueDraft))');draft.html();
table.lionwing.receipts=[{id:'canonical-receipt'}];const keyAfter=draft.run('lwTechniqueDraftPreviewKey(lwTechniqueDraftPayload(lwTechniqueDraft))');assert.notEqual(keyBefore,keyAfter,'canonical receipts participate in the complete value key');
table.lionwing.information={schema:1,studies:[],facts:[],receipts:[],pending:[],warnings:[],handouts:[],journal:[{id:'canonical-journal'}]};
assert.notEqual(keyAfter,draft.run('lwTechniqueDraftPreviewKey(lwTechniqueDraftPayload(lwTechniqueDraft))'),'canonical mechanical journals remain input');
delete table.undo;delete table.redo;delete table.turnUndo;

// Movement previews use the same complete-value contract. Canonical route
// preparation catches same-object topology/effect edits before confirmation.
const moving=renderRuntime();Object.assign(moving.context,{Sync:{state:()=>({})},scenePreviewCells:new Set(),$:()=>null});
vm.runInContext(section(source,'const lwGeometryStopReasons','function lwCostsFrom('),moving.context);
const moveRequest={kind:'geometry-move',targetId:'hero',destination:{space:'main',x:2,y:1},maximum:3};
assert.equal(moving.context.lwSetGeometryPreview({actorId:'hero',label:'Move'},moveRequest,{render:false}),true);
const movementBefore=clone(moving.context.Scene),firstMovement=moving.run('lwGeometryPreview'),movementCalls=moving.counts.prepare;
moving.context.lwReconcileGeometryPreview();assert.equal(moving.run('lwGeometryPreview'),firstMovement);assert.equal(moving.counts.prepare,movementCalls,'unchanged movement keeps its verified plan');
moving.context.Scene.actors[0].focus=1;moving.context.lwReconcileGeometryPreview();assert.notEqual(moving.run('lwGeometryPreview'),firstMovement,'same-object resource edits refresh the current movement preview context');
moving.context.Scene.topology.cuts=[{id:'cut',space:'main',cells:['2,1']}];moving.context.lwReconcileGeometryPreview();assert.equal(moving.run('lwGeometryPreview'),null,'a same-object removed destination clears the unavailable route');
moving.context.Scene.topology.cuts=[];assert.equal(moving.context.lwSetGeometryPreview({actorId:'hero',label:'Move'},moveRequest,{render:false}),true);
moving.context.Scene.actors[0].effects=['negative.обездвижен'];moving.context.lwReconcileGeometryPreview();assert.equal(moving.run('lwGeometryPreview'),null,'same-object movement restrictions clear the obsolete route');
moving.context.Scene.actors[0].effects=[];assert.equal(moving.context.lwSetGeometryPreview({actorId:'hero',label:'Move'},moveRequest,{render:false}),true);
moving.view('player');moving.context.Scene.actors[0].hidden=true;moving.context.lwReconcileGeometryPreview();assert.equal(moving.run('lwGeometryPreview'),null,'Player view cannot retain a hidden source route');
moving.context.Scene.actors[0].hidden=false;moving.view('gm');assert.equal(moving.context.lwSetGeometryPreview({actorId:'hero',label:'Move'},moveRequest,{render:false}),true);moving.owns(false);moving.context.lwReconcileGeometryPreview();assert.equal(moving.run('lwGeometryPreview'),null,'a changed owner cannot retain another actor movement draft');
assert.deepEqual([moving.context.Scene.actors[0].x,moving.context.Scene.actors[0].y],[movementBefore.actors[0].x,movementBefore.actors[0].y],'reconciling previews never moves the source');

// Local Player preview retains the authoritative Scene in memory. Hidden
// candidates must not appear in available/denied lists or selected names.
table.actors.push(actor('private-npc','enemy',2,1,{hidden:true,name:'PRIVATE_NPC_LABEL'}));
draft.html();assert.match(draft.html(),/PRIVATE_NPC_LABEL/);const publicRoll=clone(draft.run('lwTechniqueDraft.preview.events'));
draft.view('player');assert.doesNotMatch(draft.html(),/PRIVATE_NPC_LABEL|data-lw-action-target="private-npc"/);
assert.deepEqual(clone(draft.run('lwTechniqueDraft.preview.events')),publicRoll,'view changes with visible selections retain the mechanical roll');
table.targetIds=['private-npc'];assert.equal(draft.html(),'','a GM-only selected target cannot retain an actionable Player draft');
assert.equal(draft.run('lwTechniqueDraft'),null);
draft.view('gm');table.targetIds=['enemy'];draft.context.lwBeginActionPreview('hero',{kind:'action',actionId:draft.engine.ACTION_IDS.spell,targetIds:['enemy']});draft.html();draft.owns(false);assert.equal(draft.html(),'','ownership changes clear the stale actor draft');

if(baseline){
  const rows=[];
  for(const [label,text]of [['baseline',baseline],['changed',source]]){
    const test=renderRuntime(text);test.context.Scene.spaces[0]={id:'main',width:12,height:12};
    for(let i=2;i<20;i++)test.context.Scene.actors.push(actor(`target-${i}`,'enemy',i%12,Math.floor(i/12)+2));
    test.context.Scene.artworks=[{id:'large-art',image:`data:image/png;base64,${'A'.repeat(100000)}`}];
    const saved=clone(test.context.Scene);test.context.Scene.undo=Array.from({length:20},()=>({state:saved}));test.context.Scene.turnUndo=Array.from({length:10},()=>({state:saved}));
    test.context.Scene.targetIds=['enemy'];test.context.lwBeginActionPreview('hero',{kind:'action',actionId:test.engine.ACTION_IDS.spell,targetIds:['enemy']});test.html();
    const start=performance.now(),initialPrepare=test.counts.prepare;for(let i=0;i<8;i++)test.html();
    rows.push({label,actors:20,artKB:100,rerenders:8,prepareCalls:test.counts.prepare-initialPrepare,ms:+(performance.now()-start).toFixed(2)});
  }
  console.log(JSON.stringify({baselineRef,workload:'actual unchanged action draft incl gates/value key/target presentation, no DOM paint',rows}));
  const selectionRows=[];
  for(const [label,text]of [['baseline',baseline],['changed',source]]){
    const test=renderRuntime(text);test.context.Scene.actors.push(actor('next-target','enemy',2,2));test.context.Scene.targetIds=['enemy'];
    test.context.lwBeginActionPreview('hero',{kind:'action',actionId:test.engine.ACTION_IDS.spell,targetIds:['enemy']});test.html();
    const probes=test.counts.targets;for(const target of ['next-target','enemy','next-target','enemy']){test.context.Scene.targetIds=[target];test.html()}
    selectionRows.push({label,targetSelections:4,extraCandidateProbePasses:test.counts.targets-probes});
  }
  assert.equal(selectionRows[1].extraCandidateProbePasses,0,'fresh payload selection does not repeat every canonical target probe');console.log(JSON.stringify({workload:'actual target selection without mechanical scene changes',selectionRows}));
}
console.log('PASS current automatic renderer: canonical markup, reduced duplicate gates, frozen state, exact rolls, same-object AP/range/denials, pending actors, local Player privacy, ownership/locale/view changes and complete mechanical snapshot keys.');
