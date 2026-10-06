import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const play=read('play-ui.js'),scene=read('scene-ui.js'),events=read('app-play-events.js');
function declaration(source,name){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end<0?source.length:end);}
// These fixtures model DOM values/selection and event registration, not a browser or network.
function fixture(){
 const nodes=new Map(),commits=[],messages=[];let context;
 class Element{
  constructor(id){this.id=id;this.value='';this.options=[];this.disabled=false;this.hidden=false;this.dataset={};this.checked=false;this.classList={toggle(){}};this.listeners={};}
  set value(value){this.rawValue=String(value);} get value(){return this.rawValue;}
  set innerHTML(html){this.html=html;this.options=[...html.matchAll(/<option(?: value="([^"]*)")?([^>]*)>([^<]*)<\/option>/g)].map(m=>({value:m[1]??m[3],selected:m[2].includes('selected')}));if(this.options.length)this.value=(this.options.find(o=>o.selected)||this.options[0]).value;
   for(const m of html.matchAll(/<(input|select)[^>]*id="([^"]+)"[^>]*>/g)){const node=get(m[2]);node.value=m[0].match(/value="([^"]*)"/)?.[1]??'';if(m[1]==='select'){const select=html.slice(m.index+m[0].length,html.indexOf('</select>',m.index));node.innerHTML=select;} }
  }
  get innerHTML(){return this.html||'';} querySelector(){return null;} querySelectorAll(){return [];} insertAdjacentHTML(){} setAttribute(){} focus(){context.document.activeElement=this;} addEventListener(type,fn){this.listeners[type]=fn;}
 }
 const get=id=>{if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id)};
 const hero={id:'local',name:'Local',tier:3,rulesEdition:'lionwing',runtime:{freeplay:{target:null},funding:0}};
 const ownActor={id:'own',heroId:'local',name:'Local actor',tier:3,rulesEdition:'lionwing',team:'hero'};
 const recipient={id:'recipient',name:'Recipient',tier:5,rulesEdition:'lionwing',team:'hero',heroId:'other',attrs:{body:3},gifts:[],skills:[]};
 context={window:{},console,S:hero,Scene:{actors:[recipient,ownActor],challengeRequest:null,opposedRoll:null,rollFeed:[]},store:{mode:'tools',heroes:[hero],current:0},role:'local-table',view:'player',activeUtilityPreset:{},utilityActor:recipient,
  $:get,esc:String,isLionwingEdition:()=>context.S.rulesEdition==='lionwing',isEnglishPreview:()=>false,
  document:{activeElement:null,body:{classList:{toggle(){}}},querySelector:selector=>get(selector)},
  toolsRole:()=>context.role,toolsView:()=>context.view,toolsSyncContext:()=>({shared:context.role!=='local-table',canEdit:context.role!=='network-player',displayName:'Narrator'}),
  currentHeroActor:()=>context.Scene.actors.find(actor=>actor.heroId===context.S.id),currentOpposedParticipant:()=>null,opposedParticipantResult:()=>null,opposedResultSummary:()=>'',challengeResultSummary:()=>'',
  challengeActors:()=>context.Scene.actors,opposedActorChoices:()=>[],renderEnglishToolsDirector(){},renderOpposedStatus(){},renderToolsSyncState(){},persists:0,persistAfterPaint(){context.persists++;},pendingAllIn:null,resolved:[],toolsDiceRequest:()=>({baseCount:3,advantage:0,hindrance:0}),toolsRollContext:()=>({scene:context.Scene,actor:context.currentHeroActor()}),resolveDice:(count,threshold,payment,request,scenario)=>{context.resolved.push({count,scenario});return true},updateAllInAvailability(){},resetToolsRollResult(){},renderDiceComposer(){},renderAll(){},
  sceneUtilityActor:()=>context.utilityActor,sceneUtilityActorAvailable:()=>true,activeSceneView:()=>context.view==='narrator'?'gm':'player',skillDisplayName:skill=>skill.name,sceneNarratorRollHistory:()=>'',updateSceneDiceTotal(){},sceneDiceRequest:()=>({}),
  SceneEngine:{diceHookStatus:()=>({available:true,count:3,threshold:4,criticalAt:6}),diceRollPayload:()=>({available:true,payload:{successes:5,rolls:[4,4,4,4,4]}})},
  Sync:{state:()=>({sceneId:'mock',canNarrate:context.role==='network-narrator',displayName:'Narrator'})},
  toast:message=>messages.push(message),commitSceneEvents:(label,items)=>{commits.push(...items);return true},uid:()=> 'request-id',
 };
 vm.createContext(context);vm.runInContext(read('logic.js'),context);context.Logic=context.window.DAWN_LOGIC;context.clamp=context.Logic.clamp;
 for(const name of ['toolsCopy','freeplayState','defaultChallengeTarget','requireChallengeTarget','currentChallengeRequest','freeplayTarget','freeplayScenario','renderOutcomeGuide','renderFreeplayDirector','rollDice'])vm.runInContext(declaration(play,name),context);
 for(const name of ['sceneDiceFormSnapshot','sceneDiceFormFor','rememberSceneDiceForm','renderSceneUtility','rollSceneDice'])vm.runInContext(declaration(scene,name),context);
 for(const id of ['freeplay-request-kind','freeplay-request-actor','freeplay-opponent'])get(id).value=id==='freeplay-request-kind'?'challenge':id==='freeplay-request-actor'?'recipient':'';
 for(const prefix of ['$("dice-target").addEventListener("input"','$("dice-target-default").onclick=','$("freeplay-request-actor").addEventListener("change"']){const line=events.split('\n').find(s=>s.startsWith(prefix));assert.ok(line,prefix);vm.runInContext(line,context);}
 const requestStart=events.indexOf('$("freeplay-request-roll").onclick=');const requestEnd=events.indexOf('\n$("tools-view-switch")',requestStart);vm.runInContext(events.slice(requestStart,requestEnd),context);
 const utilityLine=events.split('\n').find(s=>s.startsWith('$("scene-utility").addEventListener("click"'));vm.runInContext(utilityLine,context);
 return {c:context,get,commits,messages,run:code=>vm.runInContext(code,context)};
}
const f=fixture(),{c,get,run}=f;
for(const [tier,target] of [2,3,5,6,8,9].entries())assert.equal(c.Logic.standardChallengeTarget({edition:'lionwing',tier:tier+1}),target);
for(const tier of [7,99,2.5])assert.equal(c.Logic.standardChallengeTarget({edition:'lionwing',tier}),null);
assert.equal(c.Logic.standardChallengeTarget({edition:'lionwing'}),2);for(const tier of [0,undefined])assert.equal(c.Logic.standardChallengeTarget({edition:'lionwing',tier}),2,'missing/zero Tier follows existing minimum-one policy');assert.equal(c.Logic.standardChallengeTarget({edition:'ru-v0.9',tier:5}),6);
run('renderFreeplayDirector()');assert.equal(Number(get('dice-target').value),5,'local initial Tier 3');
for(const target of [4,11]){c.S.runtime.freeplay.target=target;run('renderFreeplayDirector()');assert.equal(Number(get('dice-target').value),target,'saved override survives render');}
get('dice-target-default').onclick();assert.equal(c.S.runtime.freeplay.target,5,'reset persists canonical default');
c.role='network-narrator';c.view='narrator';c.S.runtime.freeplay.target=null;run('renderFreeplayDirector()');assert.equal(Number(get('dice-target').value),8,'initial narrator uses recipient, not local hero');
get('dice-target-default').onclick();assert.equal(c.S.runtime.freeplay.target,8);
c.Scene.actors.push({...c.utilityActor,id:'recipient-2',tier:4});get('freeplay-request-actor').value='recipient-2';get('freeplay-request-actor').listeners.change({target:get('freeplay-request-actor')});assert.equal(Number(get('dice-target').value),6);assert.equal(c.S.runtime.freeplay.target,6);
get('freeplay-request-roll').onclick();assert.equal(f.commits.at(-1).payload.target,6,'request handler sends chosen target');
f.commits.length=0;get('dice-target').value='';get('freeplay-request-roll').onclick();assert.equal(f.commits.length,0,'blank request rejected');
c.role='network-player';c.view='player';c.Scene.challengeRequest={id:'incoming',actorId:'own',target:12,requestedBy:'Narrator'};c.S.runtime.freeplay.target=4;run('renderFreeplayDirector()');assert.equal(Number(get('dice-target').value),12);assert.equal(get('dice-target').disabled,true);assert.equal(get('dice-target-default').disabled,true);get('dice-target-default').onclick();assert.equal(Number(get('dice-target').value),12);get('dice-target').listeners.input();assert.equal(c.S.runtime.freeplay.target,4,'incoming does not overwrite saved local override');
get('freeplay-request-actor').listeners.change({target:get('freeplay-request-actor')});assert.equal(Number(get('dice-target').value),12,'recipient handler cannot replace incoming request');
assert.equal(run('currentChallengeRequest()').actorId,'own');assert.match(get('dice-outcome-guide').innerHTML,/0\u201311/,'guide uses received target after render');get('dice-target').value='3';run('rollDice()');assert.equal(c.resolved.at(-1).scenario.target,12,'incoming request defeats manipulated DOM target');
c.Scene.challengeRequest=null;run('renderFreeplayDirector()');get('dice-target').value='11';get('dice-target').listeners.input();run('renderFreeplayDirector()');assert.equal(Number(get('dice-target').value),11,'network player manual override persists');
run('rollDice()');assert.equal(c.resolved.at(-1).scenario.target,11,'manual target reaches free-play scenario');get('dice-target').value='';const beforeBlank={resolved:c.resolved.length,persists:c.persists};run('rollDice()');assert.equal(c.resolved.length,beforeBlank.resolved,'blank free roll never resolves');assert.equal(c.persists,beforeBlank.persists,'blank free roll never persists');
c.S.rulesEdition='ru-v0.9';c.S.tier=5;c.S.runtime.freeplay.target=null;c.document.activeElement=null;c.role='local-table';run('renderFreeplayDirector()');assert.equal(Number(get('dice-target').value),6,'legacy director keeps previous default');c.S.rulesEdition='lionwing';
c.role='local-table';c.Scene.opposedRoll={id:'opposed',participants:[]};run('renderFreeplayDirector()');assert.equal(get('freeplay-target-wrap').hidden,true,'opposed has no fixed target');c.Scene.opposedRoll=null;
c.document.activeElement=null;c.utilityActor.tier=7;c.S.tier=7;c.S.runtime.freeplay.target=null;run('renderFreeplayDirector()');assert.equal(get('dice-target').value,'');assert.equal(get('dice-target-default').disabled,true);
c.view='narrator';c.role='network-narrator';c.utilityActor.tier=3;run('renderSceneUtility()');assert.equal(get('scene-dice-target').value,'5','utility uses actor standard');
for(const target of [4,11]){get('scene-dice-target').value=String(target);run('rememberSceneDiceForm(sceneUtilityActor())');run('renderSceneUtility()');assert.equal(get('scene-dice-target').value,String(target));assert.equal(run('sceneDiceFormSnapshot(sceneUtilityActor())').target,target);f.commits.length=0;run('rollSceneDice(sceneUtilityActor().id)');assert.equal(f.commits[0].payload.target,target,'public roll preserves explicit target');}
c.activeUtilityPreset.form=null;c.utilityActor.tier=7;run('renderSceneUtility()');assert.equal(get('scene-dice-target').value,'');assert.equal(run('sceneDiceFormSnapshot(sceneUtilityActor())').target,null);f.commits.length=0;run('rollSceneDice(sceneUtilityActor().id)');assert.equal(f.commits.length,0,'unsupported tier blank utility roll rejected');
get('scene-utility').listeners.click({target:{closest:selector=>selector==='[data-scene-request-roll]'?{dataset:{sceneRequestRoll:c.utilityActor.id}}:null}});assert.equal(f.commits.length,0,'blank utility request rejected');
get('scene-dice-target').value='12';get('scene-utility').listeners.click({target:{closest:selector=>selector==='[data-scene-request-roll]'?{dataset:{sceneRequestRoll:c.utilityActor.id}}:null}});assert.equal(f.commits.at(-1).payload.target,12,'utility request uses explicit override');
c.utilityActor.rulesEdition='ru-v0.9';c.utilityActor.tier=5;c.activeUtilityPreset.form=null;run('renderSceneUtility()');assert.equal(get('scene-dice-target').value,'6','legacy utility remains tier+1');
console.log('Challenge target scenarios passed: real director, target/scenario/guide, free roll, utility, snapshot, scene roll and request/input/reset/recipient handlers; DOM/network dependencies mocked.');
