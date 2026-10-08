import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const play=read('play-ui.js'),events=read('app-play-events.js');
function declaration(source,name){const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0,name);return source.slice(start,end<0?source.length:end)}
const nodes=new Map();let c;
function node(id){if(!nodes.has(id))nodes.set(id,{id,value:'',options:[],checked:false,disabled:false,hidden:false,dataset:{},querySelector(){return null},classList:{toggle(){}},set innerHTML(html){this.html=html;this.options=[...html.matchAll(/<option value="([^"]*)"[^>]*>/g)].map(match=>({value:match[1]}));if(this.options.length)this.value=this.options[0].value},get innerHTML(){return this.html||''},focus(){c.document.activeElement=this}});return nodes.get(id)}
const hero={id:'sheet-a',rulesEdition:'lionwing',name:'Own',tier:3,runtime:{influence:1,stress:0,funding:0},mods:{taintedBody:false},skills:[],bonds:[],gifts:['gearhead'],ability:{enabled:true,name:'Real ability',rank:1},taintedAbility:{enabled:false},gadgets:[{id:'scanner',status:'active',ability:{enabled:true,name:'Real scanner',rank:2,desc:'From the actual sheet'}},{id:'broken',status:'destroyed',ability:{enabled:true,name:'Broken scanner',rank:3}}]};
const own={id:'own',heroId:hero.id,team:'hero',kind:'hero',name:'Own actor',rulesEdition:'lionwing',influence:7,stress:2,attrs:{body:4,talent:2,mind:3,spirit:2},effects:[],gifts:[],bonds:[]};
const delegated={...own,id:'delegated',heroId:'sheet-b',name:'Other actor',influence:99,stress:0};
let shared=false,narrator=true,busy='',refreshes=0,heroRefreshes=0,failWrite=false;
const writes=[],messages=[],commands=[];
c={console,Date,Math,window:null,globalThis:null,$:node,$$:()=>[],S:hero,Scene:{rulesEdition:'lionwing',actors:[delegated,own],spaces:[{id:'main',width:7,height:7}],version:0,round:1,tension:1,log:[],rollFeed:[],objects:[],markers:[]},currentHeroActor:()=>delegated,document:{querySelector:()=>null,activeElement:null},toolsSyncContext:()=>({shared,canEdit:narrator}),lwCanNarrate:()=>narrator,sceneNumericCorrectionReason:()=>busy,isEnglishPreview:()=>false,stressMaximumFor:()=>3,toast:value=>messages.push(value),persistAfterPaint(){},renderStressTrackers(){},refreshHeroSheetResourceControls(){heroRefreshes++},updateAllInAvailability(){},hasGift:name=>name==='Gearhead'&&c.S.gifts.includes('gearhead'),gadgetText:()=> 'Гаджеты',abilityFormula:ability=>ability.name,skillDisplayName:skill=>skill.name,effectiveSkillRank:skill=>skill.rank,freeplayBondStatus:()=>({amount:0}),esc:String,attrValue:key=>own.attrs[key],currentOpposedParticipant:()=>null,freeplayTarget:()=>2,renderOutcomeGuide(){},syncToolsSourceSelection(){},pendingAllIn:null,
  lwSubmit(id,payload){writes.push({id,payload,native:true});if(failWrite)return false;const actor=c.Scene.actors.find(actor=>actor.id===id);actor[payload.resource]=payload.amount;return true},
  commitSceneEvents(label,items){writes.push({label,items});if(failWrite)return false;for(const event of items)c.Scene.actors.find(actor=>actor.id===event.actorId)[event.payload.key]=event.payload.value;return true},
  Sync:{submitCommand(type,payload){commands.push({type,payload});return Promise.resolve()},refreshScene(){}},
};c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(read('logic.js'),c);c.Logic=c.DAWN_LOGIC;c.clamp=c.Logic.clamp;
vm.runInContext(read('data.js'),c);loadSceneEngine(c);c.SceneEngine=c.DAWN_SCENE_ENGINE;
c.DAWN_TOOLS_WORKSPACE={refresh(){refreshes++}};
for(const name of ['toolsManualMode','toolsSkillRank','currentOpposedRoll','toolsHeroActor','toolsRuntimeActor','toolsResourceCorrectionReason','toolsResourceValue','refreshFreeplayResourceUi','setToolsResource','toolsRollContext','currentChallengeRequest','toolSkillId','toolsSelectedAbility','toolsDiceRequest','toolsCopy','renderDiceComposer','updateDicePoolTotal','recalculateDicePool'])vm.runInContext(declaration(play,name),c);
vm.runInContext(declaration(read('hero-gadgets.js'),'heroGadgetDiceSources'),c);
vm.runInContext(events.slice(events.indexOf('function setPlayCounter('),events.indexOf('\n$("play-counters").addEventListener')),c);
assert.equal(c.toolsRuntimeActor(),own);assert.equal(c.toolsRollContext().actor,own,'A delegated actor never becomes the free roll or resource owner');
assert.equal(c.toolsResourceValue('influence'),7,'Local LionWing reads its linked actor, not stale runtime');
c.Scene.challengeRequest={actorId:'own',target:12};assert.equal(c.currentChallengeRequest().target,12);c.Scene.challengeRequest={actorId:'delegated',target:9};assert.equal(c.currentChallengeRequest(),null);c.Scene.challengeRequest=null;
assert.equal(c.setToolsResource('influence',6,'Влияние',{correction:true}),true);assert.equal(writes.at(-1).id,'own');assert.equal(writes.at(-1).payload.kind,'correct');assert.equal(c.toolsResourceValue('influence'),6);assert.equal(delegated.influence,99);
c.setPlayCounter('stress',1);assert.equal(writes.at(-1).id,'own');assert.equal(own.stress,1,'Hero and Tools manual resource edits share the writer');
const count=writes.length;narrator=false;shared=true;
assert.equal(c.setToolsResource('influence',9,'Влияние',{correction:true}),false);assert.equal(writes.length,count);assert.equal(own.influence,6);assert.equal(commands.length,0,'A player cannot submit a manual native correction through Tools');
assert.equal(c.setToolsResource('influence',5,'Влияние'),true);assert.equal(commands.at(-1).payload.actorId,'own','Existing legitimate rule spending still uses its player transport');assert.equal(own.influence,5);assert.equal(hero.runtime.influence,5);
narrator=true;busy='Сохранение…';const blocked=writes.length;assert.equal(c.setToolsResource('stress',2,'Стресс',{correction:true}),false);assert.equal(writes.length,blocked);busy='';failWrite=true;assert.equal(c.setToolsResource('stress',2,'Стресс',{correction:true}),false);assert.equal(own.stress,1);failWrite=false;
c.Scene.actors=[delegated];assert.equal(c.toolsResourceValue('influence'),5);assert.equal(c.setToolsResource('influence',4,'Влияние'),false,'Missing own network actor cannot mutate another actor or silently change its local sheet');
c.Scene.actors=[delegated,own];own.heroId=null;own.characterId=hero.id;assert.equal(c.toolsRuntimeActor(),own,'Imported characterId linkage is supported');own.heroId=hero.id;
shared=false;c.Scene.rulesEdition='ru-v0.9';assert.equal(c.toolsRuntimeActor(),null,'Legacy local fallback remains local sheet runtime');c.Scene.rulesEdition='lionwing';
const payments=[];c.store={mode:'tools'};c.renderAllInControls=()=>{};c.resolveDice=(...args)=>{payments.push(args);return true};
vm.runInContext(declaration(play,'allIn'),c);c.pendingAllIn={count:6,diceRequest:null,scenario:{target:5}};
c.allIn('Влияние');assert.equal(own.influence,4);assert.equal(hero.runtime.influence,4);assert.equal(delegated.influence,99);assert.equal(payments[0][1],3);assert.equal(c.pendingAllIn,null,'Real All In consumes the own actor resource through the existing rule writer');
const riskRoot=node('freeplay-risk-actions');riskRoot.addEventListener=(_,handler)=>riskRoot.handle=handler;
vm.runInContext(events.slice(events.indexOf('$("freeplay-risk-actions").addEventListener'),events.indexOf('\n$("sheet").addEventListener')),c);
const riskButton={disabled:false,textContent:''};riskRoot.handle({target:{closest:()=>riskButton}});
assert.equal(own.stress,2);assert.equal(own.influence,5);assert.equal(riskButton.disabled,true,'Real Risk applies Stress and Influence to the same own actor');

// The scene-wide Stress drawer uses exactly the same linked actor data as
// Hero and the compact resource counters, even in a local native Scene.
c.store.heroes=[hero,{id:'sheet-b',name:'Other sheet',runtime:{stress:2}},{id:'sheet-c',name:'Unlinked',runtime:{stress:0}}];
for(const name of ['toolsStressOwners','toolsStressCorrectionReason','setToolsStressTracker','renderStressTrackers'])vm.runInContext(declaration(play,name),c);
assert.equal(c.toolsStressOwners()[0].stress,own.stress,'Drawer reads linked actor, not its stale sheet runtime');
assert.equal(c.setToolsStressTracker(hero.id,3),true);assert.equal(own.stress,3);assert.equal(writes.at(-1).id,'own');assert.equal(writes.at(-1).payload.kind,'correct');
assert.equal(c.setToolsStressTracker('sheet-b',2),true);assert.equal(delegated.stress,2);assert.equal(own.stress,3,'Editing another drawer row never redirects the current hero');
assert.equal(c.setToolsStressTracker('sheet-c',1),true);assert.equal(c.store.heroes[2].runtime.stress,1,'Unlinked local sheet retains its own runtime');
busy='Saving';const beforeStressWrite=writes.length;assert.equal(c.setToolsStressTracker(hero.id,1),false);assert.equal(writes.length,beforeStressWrite);busy='';
shared=true;narrator=false;assert.equal(c.setToolsStressTracker('own',1),false);assert.equal(own.stress,3);c.renderStressTrackers();assert.doesNotMatch(node('stress-trackers').innerHTML,/data-stress-value=/,'Shared player only sees readonly Stress');
narrator=true;assert.equal(c.setToolsStressTracker('delegated',1),true);assert.equal(delegated.stress,1);assert.equal(c.setToolsStressTracker('sheet-a',1),false,'Stale local-row identity cannot write on a shared Table');
shared=false;c.renderStressTrackers();assert.match(node('stress-trackers').innerHTML,/Maximum|Максимум/);assert.equal(c.toolsStressOwners()[0].stress,3);

for(const[id,value]of [['dice-attr','body'],['dice-count','4'],['dice-adv','0'],['dice-dis','0'],['dice-ability','gadget|scanner']])node(id).value=value;
c.renderDiceComposer();assert.equal(node('dice-ability').value,'gadget|scanner','Active gadget selection survives composer redraw');assert.match(node('dice-ability').innerHTML,/Real scanner/);assert.doesNotMatch(node('dice-ability').innerHTML,/Broken scanner/);
let request=c.toolsDiceRequest();assert.equal(request.usesAbility,true);assert.equal(request.hooks[0].amount,2);assert.equal(request.hooks[0].ruleId,'freeplay.ability:gadget:scanner');
let status=c.SceneEngine.diceHookStatus(c.Scene,'own',request);assert.equal(status.available,true);assert.equal(status.count,6,'The real dice engine adds the gadget rank once to the Attribute pool');
const prepared=c.SceneEngine.diceRollPayload(c.Scene,'own',request,{rolls:[4,4,5,2,1,1]});assert.equal(prepared.available,true);assert.equal(prepared.payload.successes,3);assert.ok(prepared.payload.dice.sources.some(source=>source.ruleId==='freeplay.ability:gadget:scanner'));
node('dice-ability').value='main';assert.equal(c.toolsDiceRequest().hooks.filter(hook=>hook.ruleId.startsWith('freeplay.ability:')).length,1,'Ability and gadget occupy the same single selector');
hero.gadgets[0].status='destroyed';node('dice-ability').value='gadget|scanner';assert.equal(c.toolsDiceRequest().usesAbility,false,'A stale destroyed gadget does not unlock ability hooks');c.renderDiceComposer();assert.equal(node('dice-ability').value,'');
hero.gadgets[0].status='active';hero.gifts=[];node('dice-ability').value='gadget|scanner';assert.equal(c.toolsDiceRequest().usesAbility,false);c.renderDiceComposer();assert.doesNotMatch(node('dice-ability').innerHTML,/Real scanner/);assert.equal(node('dice-ability').value,'','Losing Gearhead removes the gadget and invalid selection');
assert.ok(refreshes>0&&heroRefreshes>0,'Real recalculation/resource refresh notifies both presentations');
console.log('Freeplay resource/gadget VM PASS: own actor binding, local/shared/legacy resource policy, denied/failed writes, Hero writer reuse, conditional/stale gadgets, actual engine pool and roll payload. Network transport and canonical correction writer mocked; browser not exercised.');
