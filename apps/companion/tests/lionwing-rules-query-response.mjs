import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {actor, fixture, clone, runtime} from './helpers/scene-contract-harness.mjs';
import {sceneEngineFiles} from './load-scene-engine.mjs';

const current = runtime(), {core,engine,context} = current;
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
vm.runInContext(read('lionwing-technique-surface.js'), context);
const surface = context.window.DAWN_LIONWING_TECHNIQUE_SURFACE;
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
};
function table(count = 20) {
  const scene = fixture(); scene.spaces[0] = {id:'main',width:12,height:12};
  for (let i=2;i<count;i++) scene.actors.push(actor(`actor-${i}`,i%2?'hero':'enemy',i%12,Math.floor(i/12)+3));
  scene.lionwing.history = Array.from({length:32},(_,i)=>({schema:1,id:`fact-${i}`,type:'apply',actorId:'hero',ownerActorId:'hero',sceneSerial:1,round:1,turnSerial:1,ruleId:'test.history',targetIds:['enemy']}));
  scene.lionwing.receipts = [{id:'canonical-receipt',fingerprint:'must-remain'}];
  scene.lionwing.boundaryReceipts = [{id:'boundary',ruleId:'test.rule',ownerActorId:'hero',boundaryKey:'1:hero:1:ownTurnStart'}];
  scene.log = [{id:'own-turn',type:'turn.start',actorId:'hero',payload:{},at:'2026-10-13T00:00:00.000Z'}];
  return scene;
}
const metadataQueries = api => [
  scene => api.core.turnStartStatus(scene,'hero'), scene => api.core.roundEndStatus(scene),
  scene => api.core.turnIdentity(scene,'hero'), scene => api.core.lifecycleContext(scene,{actorId:'hero',ruleId:'test.rule',history:{ruleId:'test.history'}}),
  scene => api.core.lifetimeExpired(scene,{boundary:'startNextOwnerTurn',ownerActorId:'hero',ownerTurnSerial:0},{phase:'start',ownerActorId:'hero'}),
  scene => api.core.historyStatus(scene,{scope:'scene',sceneSerial:1}), scene => api.core.followupStatus(scene),
  scene => api.core.consequenceStatus(scene,'hero'), scene => api.core.actionGate(scene,'hero',{actionId:api.engine.ACTION_IDS.step}),
  scene => api.engine.availableActions(scene,{},'hero'),
];
const scene = table(), saved = clone(scene);
let mediaSerializations = 0;
const poison = {toJSON(){mediaSerializations++;throw Error('Rule-state metadata must not serialize table media or UI snapshots');}};
scene.artworks = [poison]; scene.undo=[{state:poison}]; scene.redo=[{state:poison}];scene.turnUndo=[{state:poison}];
for (const participant of scene.actors) {participant.tokenImage=poison;participant.portraitImage=poison;}
for (const query of metadataQueries(current)) assert.deepEqual(clone(query(freeze(scene))),clone(query(saved)));
const poisonedDestination={actorId:'hero',payload:{kind:'action',actionId:engine.ACTION_IDS.step,targetIds:[]},destination:{space:'main',x:2,y:1}};
assert.deepEqual(clone(core.destinationStatus(scene,poisonedDestination)),clone(core.destinationStatus(saved,poisonedDestination)),'destination gates do not serialize discarded UI media');
assert.equal(mediaSerializations,0);
assert.equal(core.turnIdentity(scene,'hero').ownerTurnSerial,1,'turn metadata still migrates stale counters from the canonical turn log');
assert.equal(core.historyStatus(scene,{scope:'scene',sceneSerial:1}).facts.length,32,'the mechanical action ledger remains complete');
const mutableResult=core.historyStatus(scene,{scope:'scene',sceneSerial:1});mutableResult.facts[0].targetIds.push('forged');
assert.deepEqual(clone(scene.lionwing),saved.lionwing,'returned metadata is detached and queries preserve receipts and journals');
const malformed=table();malformed.lionwing.diceRolls=[];const malformedBefore=clone(malformed);
assert.throws(()=>core.actionGate(malformed,'hero',{actionId:engine.ACTION_IDS.step}),/Реестр бросков/,'narrow state copies still perform canonical registry validation');
assert.deepEqual(clone(malformed),malformedBefore);
// The narrow snapshot must exercise the same transitive normalizers as a
// full reload, including old saves and corrupted private registries.
const legacy=table(3);delete legacy.lionwing.history;delete legacy.lionwing.started;delete legacy.lionwing.lastTeam;
legacy.lionwing.followups=[null,{id:'kept',ruleId:'test.rule',actorId:'hero'}];
legacy.actors[0].acted=true;legacy.actors[0].ruleState={drainLife:true,other:{retained:true}};
legacy.actors[0].lionwing={turns:2,ownerTurnSerial:1,history:[{ruleId:'test.legacy',targetIds:['enemy'],turnSerial:2}],consequences:{category:'death',applied:true,target:{kind:'death'}},legacyNotes:[{text:'old note'}],inventory:{definitions:{'test.stack':{id:'test.stack',kind:'stack',ownerActorId:'hero',sourceActorId:'enemy',sourceEntityId:'entity',initial:1}},records:{},reservations:{},journal:[]}};
legacy.lionwing.entities={entity:{id:'entity'}};legacy.log.push({type:'turn.end',actorId:'enemy',payload:{}});legacy.tension=7;
const legacyBefore=clone(legacy),normalizedLegacy=core.reload(legacy);freeze(legacy);
for(const query of metadataQueries(current))assert.deepEqual(clone(query(legacy)),clone(query(normalizedLegacy)),'state metadata retains all transitive normalization and old-save migrations');
assert.deepEqual(clone(legacy),legacyBefore,'all transitive normalizers work on a detached snapshot even for frozen legacy saves');
for(const mutate of [
  value=>{value.lionwing.compounds=[];},
  value=>{value.lionwing.information={studies:{}};},
  value=>{value.lionwing.executionCursor=[];},
  value=>{value.lionwing.meters={tension:{current:-1}};},
]){
  const value=table();mutate(value);const corruptBefore=clone(value);freeze(value);
  let expected;try{core.reload(value);}catch(error){expected=error.message;}
  assert.ok(expected,'full canonical reload rejects the malformed registry');
  assert.throws(()=>core.turnIdentity(value,'hero'),error=>error.message===expected,'narrow metadata retains the exact canonical validation failure');
  assert.deepEqual(clone(value),corruptBefore);
}

const auraScene=table(4);
auraScene.actors[0].lionwing={ownerTurnSerial:2};
auraScene.actors[0].lionwing.denials=[{id:'turn-denial',actionId:engine.ACTION_IDS.jump,scope:'turn',ownerTurnSerial:2,remaining:1}];
auraScene.lionwing.auras=[{id:'aura',ownerActorId:'hero',sourceEntityId:'hero',effectId:'positive.ускорен',shape:{distance:4},lifetime:{boundary:'endNextOwnerTurn',ownerActorId:'hero',ownerTurnSerial:2},filter:{relation:'ally'}}];
auraScene.actors[1].effects=['negative.замедлен'];
auraScene.actors[1].effectStates={'negative.замедлен':{sources:[{sourceId:'suppressed',suppressedBy:['test']}]}};
const auraBefore=clone(auraScene);
freeze(auraScene);
assert.equal(core.actionGate(auraScene,'hero',{actionId:engine.ACTION_IDS.jump}).available,false);
const effects=[...context.window.DAWN_LIONWING_DATA.coreRules.effects.positive,...context.window.DAWN_LIONWING_DATA.coreRules.effects.negative].map(row=>row.id);
for (const participant of auraScene.actors) for(const effect of effects) {
  assert.equal(context.window.DAWN_LIONWING_EFFECTIVE_EFFECT_ACTIVE(auraScene,participant.id,effect),core.activeState(auraScene,participant.id,effect).present,'boolean gates agree with full source/suppression/aura diagnostics');
}
assert.deepEqual(clone(auraScene),auraBefore,'aura lifetime and own-turn guards cannot normalize the caller in place');
const stale=clone(auraBefore);stale.actors[0].lionwing.denials=[];assert.equal(core.actionGate(stale,'hero',{actionId:engine.ACTION_IDS.jump}).available,true);
stale.lionwing.auras[0].suppressedBy=['test'];assert.equal(context.window.DAWN_LIONWING_EFFECTIVE_EFFECT_ACTIVE(stale,'hero','positive.ускорен'),false);
stale.lionwing.auras[0].suppressedBy=[];stale.actors[0].x=10;assert.equal(context.window.DAWN_LIONWING_EFFECTIVE_EFFECT_ACTIVE(stale,'actor-3','positive.ускорен'),false,'same-object aura/geometry changes are observed immediately');
for(const mutate of [value=>{value.actors[0].effectStates['positive.ускорен']={sources:[{suppressedBy:'malformed'}]};},value=>{value.lionwing.auras[0].suppressedBy={};}]){
  const value=clone(auraBefore);mutate(value);
  assert.throws(()=>core.activeState(value,'hero','positive.ускорен'));
  assert.throws(()=>context.window.DAWN_LIONWING_EFFECTIVE_EFFECT_ACTIVE(value,'hero','positive.ускорен'),'malformed suppression retains the diagnostic validation failure');
}

// Reusing a checked preview is presentation composition only. The formatter
// reads current resource labels and does not prepare a second command/roll.
const previewScene=table(2),request={kind:'action',actionId:engine.ACTION_IDS.step,targetIds:[],destination:{space:'main',x:2,y:1}};
const gate=core.actionGate(previewScene,'hero',request),prepared=core.prepare(previewScene,{...request,actorId:'hero'},{random:()=>0});
assert.equal(prepared.ok,true,prepared.errors?.join(' '));
const presentation=surface.actionPresentation(previewScene,'hero',request);
const originalPrepare=core.prepare;core.prepare=()=>{throw Error('The composition must not prepare a second action');};
assert.deepEqual(clone(surface.actionPresentationFromPreview(previewScene,'hero',request,{gate,prepared})),clone(presentation));core.prepare=originalPrepare;
previewScene.artworks=[{id:'full-art',image:'data:image/png;base64,full-art'}];previewScene.actors[0].tokenImage='data:image/png;base64,full-portrait';
const fullPreview=core.prepare(previewScene,{...request,actorId:'hero'},{random:()=>0});
assert.equal(fullPreview.ok,true);assert.deepEqual(clone(fullPreview.scene.artworks),previewScene.artworks);assert.equal(fullPreview.scene.actors[0].tokenImage,previewScene.actors[0].tokenImage,'full preparation retains media in its returned scene');
const adapters=context.window.DAWN_LIONWING_ADAPTERS,indexActor=actor('indexed','hero',1,1,{knownTechniques:{'vagabond.speed-demon':1},lionwing:{automation:{'vagabond.speed-demon.1':true}}});
assert.deepEqual(clone(adapters.movementOptions(indexActor,{})),{ignoreOpponents:true,endEmpty:true});
indexActor.knownTechniques['vagabond.speed-demon']=0;assert.deepEqual(clone(adapters.movementOptions(indexActor,{})),{},'same-object learned-level changes invalidate rule availability');
indexActor.knownTechniques['vagabond.speed-demon']=2;indexActor.lionwing.automation['vagabond.speed-demon.1']=false;assert.deepEqual(clone(adapters.movementOptions(indexActor,{})),{});
indexActor.lionwing.automation=Object.create({'vagabond.speed-demon.1':true});assert.equal(adapters.movementOptions(indexActor,{}).ignoreOpponents,true,'inherited opt-in switches retain the direct caller contract');
indexActor.lionwing.automation={};Object.defineProperty(indexActor.lionwing.automation,'vagabond.speed-demon.1',{value:true});assert.equal(adapters.movementOptions(indexActor,{}).ignoreOpponents,true,'non-enumerable switches retain the direct caller contract');
indexActor.rulesEdition='legacy';assert.deepEqual(clone(adapters.movementOptions(indexActor,{})),{});
const restored=context.window.DAWN_LIONWING_RESTORED_TECHNIQUES;
indexActor.rulesEdition='lionwing';
const dynamicRule={id:'vagabond.speed-demon.1',techniqueId:'test.dynamic',level:1,label:'old',sourceDigest:'test',coverage:'partial'};
context.window.DAWN_LIONWING_RESTORED_TECHNIQUES={...restored,rows:()=>[dynamicRule]};
assert.equal(adapters.list(indexActor).find(row=>row.id===dynamicRule.id).label,'old','dynamic replacement by ID retains configuration precedence');
dynamicRule.label='new';dynamicRule.sourceDigest='new-digest';dynamicRule.level=3;dynamicRule.coverage='full';
assert.equal(adapters.list(indexActor).find(row=>row.id===dynamicRule.id).label,'new','same-object dynamic row fields are read afresh');
assert.equal(adapters.list(indexActor).find(row=>row.id===dynamicRule.id).level,3);
assert.equal(adapters.list(indexActor).find(row=>row.id===dynamicRule.id).sourceDigest,'new-digest');
context.window.DAWN_LIONWING_RESTORED_TECHNIQUES={...restored,rows:()=>[]};
assert.notEqual(adapters.list(indexActor).find(row=>row.id===dynamicRule.id).techniqueId,'test.dynamic','whole provider replacement immediately restores static catalogue rows');
context.window.DAWN_LIONWING_RESTORED_TECHNIQUES=restored;
const information=context.window.DAWN_LIONWING_INFORMATION_QUERY,custom={id:'test.custom',techniqueId:'vagabond.speed-demon',level:2,label:'old'};
context.window.DAWN_LIONWING_INFORMATION_QUERY={...information,adapters:[custom]};
assert.ok(adapters.actionModifiers(indexActor).some(row=>row.id===custom.id));custom.level=3;
assert.ok(!adapters.actionModifiers(indexActor).some(row=>row.id===custom.id),'dynamic learned-level changes remain fresh');
custom.level=2;custom.label='changed';assert.equal(adapters.list(indexActor).find(row=>row.id===custom.id).label,'changed');
context.window.DAWN_LIONWING_INFORMATION_QUERY=information;
assert.ok(!adapters.list(indexActor).some(row=>row.id===custom.id),'replacing a dynamic provider removes its prior rows');
  const baselineRef=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice(11)||'1368b6f';
  const baselineContext=vm.createContext({window:{},console});
  for(const file of ['data.js','edition-lionwing.js','lionwing-table-data.js','logic.js',...sceneEngineFiles]) {
    const source=['lionwing-engine.js','lionwing-adapters.js'].includes(file)?execFileSync('git',['show',`${baselineRef}:apps/companion/${file}`],{encoding:'utf8'}):read(file);
    vm.runInContext(source,baselineContext,{filename:file});
  }
  const baseline={core:baselineContext.window.DAWN_LIONWING_ENGINE,engine:baselineContext.window.DAWN_SCENE_ENGINE};
  const beforeAdapters=baselineContext.window.DAWN_LIONWING_ADAPTERS;
  const adapterQueries=[
    (api,value,s)=>api.movementOptions(value,{scene:s}),
    (api,value,s)=>api.statQuote(value,'speed',{scene:s,baseValue:4}),
    (api,value,s)=>api.statQuote(value,'armor',{scene:s,baseValue:0}),
    (api,value,s)=>api.boundaryOperations(value,{scene:s,boundary:'sceneStart',activeActor:value}),
    (api,value,s)=>api.actionStatus(value,{scene:s,actionId:engine.ACTION_IDS.step}),
    (api,value,s)=>api.actionQuote(value,{scene:s,actionId:engine.ACTION_IDS.step,baseCost:1,baseResource:'ap'}),
    (api,value,s)=>api.afterEvent(value,{id:'probe',type:'action.resolve',actorId:value.id,payload:{actionId:engine.ACTION_IDS.spell,targetIds:['enemy'],attribute:'spirit'},execution:{rootActionId:'probe',actionInstanceId:'probe'}},{scene:s,used:false}),
  ];
  for(const archetype of context.window.DAWN_LIONWING_DATA.archetypes)for(const technique of archetype.techniques||[])for(const level of [1,2,3]){
    const s=table(2),value=s.actors[0];value.knownTechniques={[technique.id]:level};value.techniques=value.knownTechniques;
    value.lionwing.automation=Object.fromEntries(beforeAdapters.list(value).reverse().map(row=>[row.id,true]));
    for(const query of adapterQueries)assert.deepEqual(clone(query(adapters,value,s)),clone(query(beforeAdapters,clone(value),clone(s))),'static candidate indexing preserves all catalogue level gates, rule order, numeric contributions, lifecycle operations and triggers');
  }
  // A mixed actor catches ordering/replacement interactions that individual
  // technique probes cannot. Opt-ins are deliberately inserted backwards.
  const mixed=table(2),mixedActor=mixed.actors[0];
  mixedActor.knownTechniques=Object.fromEntries(context.window.DAWN_LIONWING_DATA.archetypes.flatMap(archetype=>(archetype.techniques||[]).map(technique=>[technique.id,3])));
  mixedActor.techniques=mixedActor.knownTechniques;
  mixedActor.lionwing.automation=Object.fromEntries(beforeAdapters.list(mixedActor).reverse().map(row=>[row.id,true]));
  for(const query of adapterQueries)assert.deepEqual(clone(query(adapters,mixedActor,mixed)),clone(query(beforeAdapters,clone(mixedActor),clone(mixed))),'mixed rules retain canonical registry order and conflicts');
console.log('LionWing rules query response: frozen transitive normalization, complete ledgers, immutable aura/guard queries, fresh boolean effects, all catalogue adapter gates/order, mutable providers and preview presentation passed');

if (process.argv.includes('--benchmark')) {
  for(const fixtureScene of [table(),clone(auraBefore)])for(const [before,after]of metadataQueries(baseline).map((fn,i)=>[fn,metadataQueries(current)[i]])) {
    assert.deepEqual(clone(after(clone(fixtureScene))),clone(before(clone(fixtureScene))),'metadata quotes match the merged production baseline');
  }
  const normalizedAura = core.reload(auraBefore);
  for(const participant of normalizedAura.actors){
    assert.deepEqual(clone(engine.effectiveEffects(normalizedAura,participant.id)),clone(baseline.engine.effectiveEffects(clone(normalizedAura),participant.id)));
    assert.deepEqual(clone(engine.effectPresenceStatus(normalizedAura,participant.id)),clone(baseline.engine.effectPresenceStatus(clone(normalizedAura),participant.id)),'target-only effect expansion preserves public actor fields and aura presence');
  }
  const geometryVariants = [];
  const terrain = table();
  terrain.objects=[{id:'blocked',type:'terrain',space:'main',cells:['2,1','2,2']},{id:'difficult',type:'difficult',space:'main',cells:['1,2']},{id:'high',type:'high',space:'main',cells:['3,1']}];
  terrain.walls=[{id:'wall',space:'main',a:'1,1',b:'1,2'}];terrain.topology={cuts:[{id:'cut',space:'main',cells:['3,2'],crossing:'blocked'}]};geometryVariants.push(terrain);
  const continuation=table();continuation.actors[0].ap=0;continuation.actors[0].stepRemaining=3;continuation.actors[0].usedActions=[engine.ACTION_IDS.step];geometryVariants.push(continuation);
  const immobilized=table();immobilized.actors[0].effects=['negative.обездвижен'];geometryVariants.push(immobilized);
  const hasted=table();hasted.actors[0].effects=['positive.ускорен'];geometryVariants.push(hasted);
  const swiftStep=table();swiftStep.actors[0].techniques={'vagabond.speed-demon':2};swiftStep.actors[0].knownTechniques={'vagabond.speed-demon':2};swiftStep.actors[0].lionwing={automation:{'vagabond.speed-demon.2':true},history:[{actionId:engine.ACTION_IDS.breathe,turnSerial:1,ownerTurnInstanceId:'legacy-turn:1'}]};geometryVariants.push(swiftStep);
  for(const variant of geometryVariants) {
    const before = clone(variant);
    for(let i=0;i<144;i++){
      const request={actorId:'hero',payload:{kind:'action',actionId:engine.ACTION_IDS.step,targetIds:[]},destination:{space:'main',x:i%12,y:Math.floor(i/12)}};
      assert.deepEqual(clone(core.destinationStatus(variant,request)),clone(baseline.core.destinationStatus(clone(before),request)),'all terrain/wall/topology/effect/continuation gates and reasons retain the complete prepare/commit result');
    }
    assert.deepEqual(clone(variant),before);
  }
  const rows=[];
  for(const media of [false,true]) {
    const input=table();
    if(media){input.artworks=[{id:'art',image:`data:image/png;base64,${'A'.repeat(100000)}`}];for(const participant of input.actors)participant.tokenImage=`data:image/png;base64,${'B'.repeat(30000)}`;}
    const saved=clone(input);input.undo=Array.from({length:20},()=>({state:saved}));input.turnUndo=Array.from({length:10},()=>({state:saved}));input.redo=[];
    const workloads={
      actionRoster:api=>api.engine.availableActions(input,{},'hero'),
      turnRoster:api=>input.actors.map(participant=>api.core.turnStartStatus(input,participant.id)),
      effectRoster:api=>input.actors.map(participant=>api.engine.effectPresenceStatus(input,participant.id)),
      stepCells:api=>Array.from({length:144},(_,i)=>api.core.destinationStatus(input,{actorId:'hero',payload:{kind:'action',actionId:api.engine.ACTION_IDS.step,targetIds:[]},destination:{space:'main',x:i%12,y:Math.floor(i/12)}})),
    };
    for(const [workload,run]of Object.entries(workloads)){
      let expected;const times={baseline:[],changed:[]};
      for(let sample=0;sample<3;sample++)for(const [label,api]of sample%2?[['changed',current],['baseline',baseline]]:[['baseline',baseline],['changed',current]]){
        const start=performance.now(),answers=run(api);times[label].push(performance.now()-start);if(expected)assert.deepEqual(clone(answers),expected);else expected=clone(answers);
      }
      for(const [label,samples]of Object.entries(times)){samples.sort((a,b)=>a-b);rows.push({workload,media,label,samples:3,medianMs:+samples[1].toFixed(2),maxMs:+samples[2].toFixed(2)});}
    }
  }
  console.log(JSON.stringify({baselineRef,workload:'Production native action roster, turn roster and all 144 Step destination gates on 12x12/20 actors; canonical action ledger and receipts; with/without 100KB art + 20 portraits at 30KB, 20 undo/10 turn snapshots. Same full prepare/commit validators, no DOM/network',rows},null,2));
}
