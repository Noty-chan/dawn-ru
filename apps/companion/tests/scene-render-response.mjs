import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const ui=read('lionwing-ui.js'),sceneUi=read('scene-ui.js');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const baselineRef=process.argv.find(arg=>arg.startsWith('--baseline='))?.slice('--baseline='.length);
const baseline=baselineRef?execFileSync('git',['show',`${baselineRef}:apps/companion/lionwing-ui.js`],{encoding:'utf8'}):null;
const plain=value=>JSON.parse(JSON.stringify(value));

function actionFixture(source){
  const counts={selectors:0,pending:0,ownership:0},requests=[];
  const ids={spell:'spell',skirmish:'skirmish',finish:'finish',improvise:'improvise'};
  const inputs=new Map(Object.entries({
    '[data-lw-cunning-plan]':{checked:true},'[data-lw-attribute]':{value:'mind'},'[data-lw-focus]':{value:'2'},
    '[data-lw-both-barrels]':{checked:true},'[data-lw-attack-obstacle]':{value:'wall'},
    '[data-lw-improvise-effect]':{value:'positive.haste'},'[data-lw-remove-obstacle]':{value:'tree'},
  }));
  let owns=true,pending='',cost=1;
  const actions=['step','spell','skirmish','finish','improvise','jump','study','interact','charge','breathe'];
  const buttons=actions.map(action=>({dataset:{lwAction:action,lwActor:'hero'},note:{textContent:''},querySelector(){return this.note},closest:()=>root}));
  const nested={dataset:{lwAction:'nested',lwActor:'nested-owner'},closest:()=>({})};
  const root={dataset:{lwActor:'hero'},querySelectorAll(selector){counts.selectors++;return selector==='[data-lw-action]'?[...buttons,nested]:inputs.has(selector)?[{value:'must not leak',checked:false,closest:()=>({})},inputs.get(selector)]:[]}};
  for(const input of inputs.values())input.closest=()=>root;
  const context=vm.createContext({Scene:{targetIds:['target']},SceneEngine:{ACTION_IDS:ids},
    window:{DAWN_LIONWING_TECHNIQUE_SURFACE:{actionPresentation(table,actorId,request){requests.push(plain(request));return {gate:{available:true,cost},costLabel:`cost:${cost}`}}}},
    LionwingEngine:{actionGate(){throw Error('presentation already supplies canonical gate')}},
    lwPendingCommandReason(){counts.pending++;return pending},lwOwns(){counts.ownership++;return owns},
    lwTechniqueText:(_,fallback)=>fallback,lwCockpitText:(_,fallback)=>fallback,
  });
  vm.runInContext(section(source,'function lwActionControlRequest(','function lwOpenCockpitAction('),context);
  const refresh=()=>context.lwRefreshCunningActions(root);
  refresh();
  return {context,counts,requests,buttons,inputs,root,refresh,change(options){if('owns'in options)owns=options.owns;if('pending'in options)pending=options.pending;if('cost'in options)cost=options.cost}};
}
const actions=actionFixture(ui),initialRequests=plain(actions.requests);
assert.equal(actions.counts.selectors,8,'one DOM lookup for each distinct input selector and action list');
assert.equal(actions.counts.pending,1);assert.equal(actions.counts.ownership,1);
assert.equal(initialRequests.length,10,'nested action roots are excluded');
assert.deepEqual(initialRequests.find(request=>request.actionId==='spell').targetIds,[]);
assert.equal(initialRequests.find(request=>request.actionId==='spell').obstacleId,'wall');
assert.equal(initialRequests.find(request=>request.actionId==='improvise').effect,'positive.haste');
actions.inputs.get('[data-lw-focus]').value='7';actions.inputs.get('[data-lw-cunning-plan]').checked=false;
actions.context.Scene.targetIds=['latest-target'];actions.change({cost:3,pending:'Saving'});actions.refresh();
assert.equal(actions.requests.at(-1).focusSpent,7,'a later refresh reads the latest same-input draft');
assert.deepEqual(actions.requests.at(-1).targetIds,['latest-target']);
assert.equal(actions.requests.at(-1).useCunningPlan,undefined);
assert.ok(actions.buttons.every(button=>button.disabled&&button.title==='Saving'));
actions.change({pending:'',owns:false});actions.refresh();assert.ok(actions.buttons.every(button=>button.disabled&&button.title.includes('другой игрок')));
assert.equal(actions.context.lwActionControlRequest(actions.root,actions.buttons[0]).focusSpent,7,'direct click preparation still reads the current controls');

let pendingLookups=0,actionRefreshes=0,pendingReason='Submitted';
const submittedButtons=Array.from({length:40},(_,i)=>({dataset:{lwActor:i%2?'hero':'ally'},disabled:false}));
const pendingContext=vm.createContext({Scene:{lionwing:{choices:[]}},lwFormDraft:new Map(),lwPendingCommandReason(){pendingLookups++;return pendingReason},lwRefreshCunningActions(){actionRefreshes++}});
vm.runInContext(section(ui,'function lwPendingWindowKey(','const lwTechniqueEnabled =')+section(ui,'function lwPrunePendingFormDrafts()','function lwCockpitElementKey('),pendingContext);
vm.runInContext(section(ui,'function lwRefreshPendingControls(','function lwDiceHtml('),pendingContext);
vm.runInContext(section(ui,'function lwRestoreFormDrafts(','let lwDraftEnabled='),pendingContext);
const pendingRoot={querySelectorAll(selector){return selector==='[data-lw-root]'?[{}]:selector.includes('[data-lw-action]')?submittedButtons:[]}};
pendingContext.lwRestoreFormDrafts(pendingRoot,{refreshActions:false});assert.equal(actionRefreshes,0);assert.equal(pendingLookups,2);assert.ok(submittedButtons.every(button=>button.disabled&&button.title==='Submitted'),'restoration still locks submitted buttons before restoring focus');
pendingReason='';pendingContext.lwRestoreFormDrafts(pendingRoot);assert.equal(actionRefreshes,1);assert.equal(pendingLookups,4,'ordinary sheet restoration retains its immediate action refresh with fresh per-actor pending checks');

function gasFixture(source,{view='gm',size=12,areaCount=40}={}){
  const counts={membership:0,boardScans:0};
  const cells=Array.from({length:size*size},(_,index)=>({dataset:{sceneCell:`${index%size},${Math.floor(index/size)}`},classes:new Set(),title:'base',tokens:[{classes:new Set()}]}));
  for(const cell of cells){cell.classList={add:name=>cell.classes.add(name)};cell.querySelectorAll=()=>cell.tokens;for(const token of cell.tokens)token.classList={add:name=>token.classes.add(name)}}
  const table={actors:Array.from({length:areaCount},(_,i)=>({id:`owner-${i}`,name:`Owner ${i}`})),areas:Array.from({length:areaCount},(_,i)=>({id:`area-${i}`,space:'main',ruleId:'disruptor.chemist.1',ownerActorId:`owner-${i}`,hidden:i%5===0,label:`Gas ${i}`,cells:Array.from({length:16},(_,j)=>`${(i+j)%size},${(Math.floor(i/size)+Math.floor(j/4))%size}`)}))};
  for(const area of table.areas)area.cells.includes=function(key){counts.membership++;return Array.prototype.includes.call(this,key)};
  const board={querySelectorAll(){counts.boardScans++;return cells}};
  const context=vm.createContext({Scene:table,activeSceneView:()=>view,lwTechniqueText:(_,fallback)=>fallback});
  vm.runInContext(sceneUi.split(/\r?\n/).find(line=>line.startsWith('function sceneEnvironmentVisible(')),context);
  vm.runInContext(section(source,'function lwApplyRestoredAreaHighlights(','function lwApplyDestinationHighlights('),context);
  const render=()=>context.lwApplyRestoredAreaHighlights(board,{id:'main'});render();
  const snapshot=()=>cells.map(cell=>({title:cell.title,classes:[...cell.classes],tokens:cell.tokens.map(token=>[...token.classes])}));
  return {counts,table,cells,render,snapshot};
}
for(const size of [7,12])for(const view of ['gm','player']){
  const after=gasFixture(ui,{size,view});assert.equal(after.counts.membership,0);
  assert.ok(after.cells.some(cell=>cell.classes.has('has-gas')));
  if(view==='player')assert.ok(after.cells.every(cell=>!cell.title.includes('Gas 0 ·')),'hidden areas have no player highlights or title');
  if(baseline){const before=gasFixture(baseline,{size,view});assert.deepEqual(after.snapshot(),before.snapshot());console.log(JSON.stringify({workload:'restoredGas',size,view,before:before.counts,after:after.counts}));}
}
const emptyGas=gasFixture(ui,{areaCount:0});assert.equal(emptyGas.counts.boardScans,0,'a board without native Gas needs no all-cell highlight scan');
const ownerGas=gasFixture(ui,{view:'player',areaCount:2});
const resetGasCells=()=>ownerGas.cells.forEach(cell=>{cell.title='base';cell.classes.clear();for(const token of cell.tokens)token.classes.clear()});
assert.ok(ownerGas.cells.some(cell=>cell.title.includes('Owner 1')));
ownerGas.table.actors[1].hidden=true;resetGasCells();ownerGas.render();assert.ok(ownerGas.cells.every(cell=>!cell.title.includes('Owner 1')),'same-object owner privacy change removes player Gas annotations');
ownerGas.table.actors[1].hidden=false;resetGasCells();ownerGas.render();assert.ok(ownerGas.cells.some(cell=>cell.title.includes('Owner 1')));
ownerGas.table.actors.splice(1,1);resetGasCells();ownerGas.render();assert.ok(ownerGas.cells.every(cell=>!cell.classes.has('has-gas')),'removing a Gas owner removes its player geometry');

function highlightFixture(source,mode='action'){
  const cells=Array.from({length:49},(_,i)=>({dataset:{sceneCell:`${i%7},${Math.floor(i/7)}`},classes:new Set(),title:''}));
  for(const cell of cells)cell.classList={add:name=>cell.classes.add(name),toggle(name,value){if(value)cell.classes.add(name);else cell.classes.delete(name)}};
  const board={querySelectorAll:()=>cells},table={actors:[{id:'hero',ap:2}],activeSpace:'main'};
  let validations=0,destinations=0,valid=true;
  const context=vm.createContext({Scene:table,lwTechniqueDraft:{actorId:'hero',mode,cells:[{space:'main',x:1,y:1},{space:'other',x:2,y:2},{space:'main',x:'3',y:'3'}]},lwDestination:null,
    lwReconcileDestination(){},lwApplyRestoredAreaHighlights(){},lwTechniqueDraftValid:()=>valid,lwTechniqueText:(_,fallback)=>fallback,
    lwTechniqueCellStatus:(_,point)=>{validations++;return {available:point.x<=table.actors[0].ap}},
    lwDestinationCellStatus:point=>{destinations++;return {available:point.x<=table.actors[0].ap,reason:'out of range'}},
  });
  vm.runInContext(section(source,'function lwApplyDestinationHighlights(','function lwCancelDestination('),context);
  const render=()=>context.lwApplyDestinationHighlights(board,{id:'main'});render();
  const snapshot=()=>cells.map(cell=>({dataset:cell.dataset,title:cell.title,classes:[...cell.classes]}));
  return {context,cells,table,render,snapshot,counts:()=>({validations,destinations}),invalidate(){valid=false}};
}
for(const mode of ['action','nails','idol']){
  const after=highlightFixture(ui,mode);
  assert.equal(after.cells.find(cell=>cell.dataset.sceneCell==='1,1').classes.has('preview'),true);
  assert.equal(after.cells.find(cell=>cell.dataset.sceneCell==='3,3').classes.has('preview'),false,'string coordinates are not mistaken for canonical integer draft cells');
  if(mode!=='action')assert.equal(after.counts().validations,49,'canonical form status still validates every cell');
  if(baseline)assert.deepEqual(after.snapshot(),highlightFixture(baseline,mode).snapshot(),'form and point highlights remain byte-equivalent');
  after.context.lwTechniqueDraft=null;after.context.lwDestination={label:'Destination'};after.render();assert.equal(after.counts().destinations,49);
  after.table.actors[0].ap=0;after.render();assert.equal(after.cells.find(cell=>cell.dataset.sceneCell==='1,1').dataset.destinationAvailable,'false','a same-object resource change recalculates canonical destination gates');
}
const obsolete=highlightFixture(ui,'nails');obsolete.invalidate();obsolete.render();assert.equal(obsolete.context.lwTechniqueDraft,null,'stale form drafts are cleared before painting');

// Actual reference renderer resolves fresh visible content and links every pass;
// only the unchanged card strings are reused, and the cache stays page-bounded.
const renderSource=section(sceneUi,'function renderSceneReference(){','function sceneTrayHeroActor(');
const referenceCounts={markdown:0,writes:0,pool:0};
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let root={markup:'',querySelectorAll:()=>[],contains:()=>false};
Object.defineProperty(root,'innerHTML',{get:()=>root.markup,set:markup=>{root.markup=markup;referenceCounts.writes++}});
let items=Array.from({length:36},(_,i)=>({id:`rule-${i}`,name:`Rule ${i}`,kind:'Combat',cost:'1',text:'**Rule**\nText',fullRuleId:`source-${i}`})),view='gm';
const reference=vm.createContext({Scene:{rulesEdition:'lionwing',ruleHandouts:[]},sceneReferenceQuery:'',sceneReferenceSection:'combat',sceneReferenceMarkup:'',SCENE_RULE_SECTIONS:[{id:'combat',chapter:'combat',label:'Combat'}],contentPreferences:{locale:'ru'},
  $:()=>root,sceneCombatReferenceItems(){referenceCounts.pool++;return items},activeSceneView:()=>view,sceneRuleChapter:()=>({name:'Combat',desc:'Rules'}),
  sceneReferenceId:item=>item.id,URL,location:{href:'https://example.test/companion?mode=play'},sceneUsesLionwing:()=>true,workspaceRuleAnchor:item=>item.fullRuleId,
  esc:escape,md:value=>{referenceCounts.markdown++;return escape(value).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')},
  document:{activeElement:null},requestAnimationFrame:callback=>callback(),
});
vm.runInContext(section(sceneUi,'function ruleExternalLink(','function renderSceneReference(){')+renderSource,reference);reference.renderSceneReference();const first=root.innerHTML;
for(let i=0;i<10;i++)reference.renderSceneReference();assert.equal(referenceCounts.markdown,36);assert.equal(referenceCounts.writes,1);assert.equal(referenceCounts.pool,11);
items[0].text='**Changed same object**';reference.renderSceneReference();assert.equal(referenceCounts.markdown,37);assert.notEqual(root.innerHTML,first);
items[0].fullRuleId='updated-locale';reference.renderSceneReference();assert.match(root.innerHTML,/#updated-locale/);assert.equal(referenceCounts.markdown,38);
items[0].cost='2';reference.renderSceneReference();assert.match(root.innerHTML,/Rule 0 · 2/);
items[0].name='Same ID new name';items[0].kind='New kind';reference.renderSceneReference();assert.match(root.innerHTML,/Same ID new name · 2/);assert.match(root.innerHTML,/>New kind</);
reference.contentPreferences.locale='en';items=items.map(item=>({...item,name:`English ${item.name}`,text:`English ${item.text}`}));reference.renderSceneReference();assert.match(root.innerHTML,/English Same ID new name/);assert.match(root.innerHTML,/English <strong>Changed same object/);
view='player';reference.renderSceneReference();assert.doesNotMatch(root.innerHTML,/data-scene-rule-share/);
reference.Scene.ruleHandouts=[{title:'Latest handout',sharedBy:'Narrator',ruleId:'rule-0'}];reference.renderSceneReference();assert.match(root.innerHTML,/Latest handout/);
items=items.slice(0,2);reference.renderSceneReference();assert.equal(root.sceneReferenceCards.size,2);
const replacement={innerHTML:'',querySelectorAll:()=>[],contains:()=>false};root=replacement;reference.renderSceneReference();assert.match(root.innerHTML,/English Same ID new name/,'replacing the root cannot inherit the previous root DOM acknowledgment');

const logCounts={formats:0,writes:0},log={markup:''};
Object.defineProperty(log,'innerHTML',{get:()=>log.markup,set:value=>{log.markup=value;logCounts.writes++}});
const logScene={log:[{at:'2026-10-13T10:11:12Z',text:'Public event'},{at:'2026-10-13T10:11:13Z',text:'Private event',visibility:'gm'}]};
const logContext=vm.createContext({Scene:logScene,$:()=>log,activeSceneView:()=>view,esc:escape,clockEventText:()=>'',wallEventText:()=>'',eventText:row=>{logCounts.formats++;return row.text}});
vm.runInContext(section(sceneUi,'function renderSceneLog(','function renderScene(){'),logContext);
logContext.renderSceneLog('player');assert.equal(logCounts.formats,1);assert.doesNotMatch(log.innerHTML,/Private event/);
logContext.renderSceneLog('player');assert.equal(logCounts.writes,1,'an unchanged log keeps existing DOM');
logScene.log[0].text='Latest public event';logContext.renderSceneLog('player');assert.equal(logCounts.writes,2);assert.match(log.innerHTML,/Latest public event/);
logContext.renderSceneLog('gm');assert.match(log.innerHTML,/Private event/);assert.equal(logCounts.writes,3);
assert.equal((section(sceneUi,'function renderScene(){','function activeSceneView(').match(/renderSceneLog\(view\)/g)||[]).length,1,'the full renderer runs exactly one privacy-filtered log pass');

if(baseline){
  const before=actionFixture(baseline);assert.deepEqual(initialRequests,plain(before.requests),'render-scoped lookups preserve all canonical requests');
  const time=fixture=>{const start=performance.now();for(let i=0;i<200;i++)fixture.refresh();return performance.now()-start};
  const after=actionFixture(ui);console.log(JSON.stringify({workload:'actionControlRefresh',before:before.counts,after:after.counts,beforeMs:+time(before).toFixed(2),afterMs:+time(after).toFixed(2)}));
}
console.log('PASS production scene render response: canonical action requests/current drafts/nested roots, gas markup/privacy equivalence, fresh bounded reference presentation, single privacy-filtered log pass and DOM preservation. DOM fixture does not measure browser layout or paint.');
