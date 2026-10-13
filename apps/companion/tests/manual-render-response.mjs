import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const slice=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
const sceneSource=read('scene-ui.js'),effects=read('scene-effects.js'),lw=read('lionwing-ui.js'),manual=read('scene-manual-integration.js');
const nodes=new Map(),calls=[],esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;');
const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'Old automatic UI',dataset:{lwCockpitScope:'old'},scrollTop:4,classList:{toggle(){},add(){}},querySelectorAll:()=>[]});return nodes.get(id)};
const hero={id:'hero',name:'Hero',kind:'hero',team:'hero',hp:8,maxHp:12,ap:2,space:'main'};
const table={tablePolicy:{mode:'manual'},actors:[hero],log:[{at:'2026-10-13T10:11:12Z',text:'Public event'}],rollFeed:[{at:new Date().toISOString(),actor:'Visible roller',formula:'1D6',successes:1,rolls:[4]}],pendingAction:{id:'frozen'},round:1};
const engine={pendingActionStatus(){calls.push('pending');return {waitingIds:[],answeredIds:[],eligibleIds:[],unavailableIds:[]}},triggerQueueStatus(){calls.push('triggers');return {count:0}},roundEndStatus(){calls.push('round');return {available:false}},turnStartStatus(){calls.push('turn');return {available:true}},availableActions(){calls.push('actions');return [{id:'step',name:'Step'}]},actionIsAny:()=>true,isEnemyModifier:()=>false,compoundEnemyStatus(){calls.push('compound');return {active:false}}};
const context=vm.createContext({Scene:table,SceneEngine:engine,D:{},S:{id:'sheet'},window:{DAWN_TABLE_POLICY:{isManual:scene=>scene.tablePolicy?.mode==='manual'}},$:node,esc,
  activeSceneView:()=> 'gm',sceneUtilityActor(){calls.push('utility');return null},sceneTrayHeroActor:()=>hero,sceneBattleComplete:()=>false,sceneResourceChips:()=>'',sceneTrayActionHtml:()=>'<button>Fresh action</button>',sceneTrayMoreActionsHtml:()=>'',usingNextSceneInterface:()=>false,isEnglishPreview:()=>false,
  matchMedia:()=>({matches:false}),sceneFlowSteps:()=>'<i>Steps</i>',sceneTurnApprovalMode:()=> 'self',
  pendingCoreReaction:null,pendingCoreAction:null,pendingEnemyStepActorId:null,pendingEnemyRule:null,pendingTechniqueRule:null,pendingZealotPlan:null,
  lwFormDraft:new Map([['old','draft']]),lwPaintingDirector:false,lwActive:()=>false,renderSceneDirector(){calls.push('director');node('scene-director').innerHTML='Fresh rules cockpit'},
  clockEventText:()=>'',wallEventText:()=>'',eventText:row=>{calls.push('log');return row.text},
});
vm.runInContext(slice(sceneSource,'function renderSceneUtility(){','function sceneDiceRequest('),context);
vm.runInContext(slice(sceneSource,'function renderSceneChrome(){','const renderSceneChromeWithoutActionPlanLock='),context);
vm.runInContext(slice(sceneSource,'function renderSceneTurnStrip(){','function appendMarkerClockControls('),context);
vm.runInContext(slice(sceneSource,'function renderSceneLog(','function renderScene(){'),context);
vm.runInContext(slice(effects,'function renderSceneFlow(){','function sceneTurnStatusAfterCurrent('),context);
vm.runInContext(slice(lw,'const lwOldDirector =','const lwOldEventText ='),context);
const original=JSON.stringify(table);
for(let i=0;i<3;i++)for(const name of ['renderSceneDirector','renderSceneUtility','renderSceneFlow','renderSceneTurnStrip','renderSceneChrome','renderSceneLog'])context[name]();
assert.deepEqual(calls,[],'manual rendering performs no automatic cockpit, turn, action, reaction, utility or log queries');
assert.equal(context.lwFormDraft.size,0);assert.equal(node('scene-director').dataset.lwCockpitScope,'');
for(const id of ['scene-director','scene-utility','scene-flow','scene-turn-strip','scene-action-tray'])assert.equal(node(id).innerHTML,'');
assert.match(node('scene-roll-feed').innerHTML,/Visible roller/,'manual policy still displays public roll feedback');
assert.equal(node('scene-log').innerHTML,'Old automatic UI','automatic log leaves manual journal ownership intact');
assert.equal(JSON.stringify(table),original,'policy gates do not rewrite frozen canonical state');
table.tablePolicy.mode='rules';table.pendingAction=null;table.actors=[];
context.renderSceneDirector();context.renderSceneUtility();context.renderSceneFlow();context.renderSceneLog();
assert.equal(node('scene-director').innerHTML,'Fresh rules cockpit');assert.match(node('scene-utility').innerHTML,/Добавьте героя/);
assert.equal(node('scene-flow').hidden,false);assert.match(node('scene-flow').innerHTML,/Подготовьте столкновение/);
assert.ok(calls.includes('pending')&&calls.includes('triggers')&&calls.includes('round')&&calls.includes('log'));
table.actors=[hero];table.activeActorId=hero.id;context.renderSceneTurnStrip();context.renderSceneChrome();
assert.ok(calls.includes('compound')&&calls.includes('actions'),'switching back to rules recalculates canonical turn and action gates');
assert.match(node('scene-turn-strip').innerHTML,/data-scene-turn-actor="hero"/);assert.match(node('scene-action-tray').innerHTML,/Fresh action/);assert.equal(node('scene-action-tray').hidden,false);

// Production journal formatting stays byte-identical to toLocaleTimeString,
// includes fresh privacy projection, and creates one formatter per locale.
let english=false,view='gm',formatters=0,writes=0,projectCalls=0;
const log={markup:''};Object.defineProperty(log,'innerHTML',{get:()=>log.markup,set:value=>{log.markup=value;writes++}});
const journalScene={actors:[{id:'hero'}],log:Array.from({length:120},(_,i)=>({at:new Date(Date.UTC(2026,9,13,10,i)).toISOString(),text:`Event ${i}`,visibility:i%2?'gm':'public'})).concat([{at:'Invalid time',text:'Invalid'}, {at:'',text:'Empty time'}])};
const journal=vm.createContext({Scene:journalScene,$:()=>log,manualTableActive:()=>true,activeSceneView:()=>view,canControlSceneActor:()=>true,isEnglishPreview:()=>english,manualTableCopy:(ru,en)=>english?en:ru,esc,eventText:row=>row.text,
  Intl:{DateTimeFormat:function(...args){formatters++;return new Intl.DateTimeFormat(...args)}},
  SceneEngine:{projectScene(scene){projectCalls++;return {log:scene.log.filter(row=>row.visibility!=='gm')}}},
});
vm.runInContext(slice(manual,'function renderManualJournal(){','const sceneEventTextWithRules='),journal);
const expected=rows=>rows.map(row=>{const date=new Date(row.at),at=Number.isNaN(date.getTime())?row.at||'':date.toLocaleTimeString(english?'en-GB':'ru-RU',{hour:'2-digit',minute:'2-digit'});return `<li><time>${esc(at)}</time>${esc(row.text)}</li>`}).join('');
journal.renderManualJournal();assert.equal(log.innerHTML,expected(journalScene.log));assert.equal(formatters,1);
for(let i=0;i<8;i++)journal.renderManualJournal();assert.equal(formatters,1);assert.equal(writes,1,'unchanged journal preserves DOM and scroll');
english=true;journal.renderManualJournal();assert.equal(formatters,2);assert.equal(log.innerHTML,expected(journalScene.log));
journalScene.log[0].at='Changed invalid';journalScene.log[0].text='Fresh event';journal.renderManualJournal();assert.match(log.innerHTML,/Changed invalid.*Fresh event/);
view='player';journal.renderManualJournal();assert.equal(projectCalls,1);assert.equal(log.innerHTML,expected(journalScene.log.filter(row=>row.visibility!=='gm')));
view='gm';english=false;const started=performance.now();for(let i=0;i<10;i++)journal.renderManualJournal();const optimizedMs=performance.now()-started;
const legacyStarted=performance.now();for(let i=0;i<10;i++)expected(journalScene.log);const legacyMs=performance.now()-legacyStarted;
console.log(JSON.stringify({workload:'120 valid and 2 invalid journal rows, 10 redraws',formatters,legacyMs:+legacyMs.toFixed(2),optimizedMs:+optimizedMs.toFixed(2)}));
console.log('PASS production manual render response: hidden automatic gates, fresh rules restoration, public roll feed, frozen state, manual journal ownership, RU/EN byte equivalence, current edits, privacy projection and bounded Intl formatter creation.');
