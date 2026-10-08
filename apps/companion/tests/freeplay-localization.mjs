import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../play-ui.js',import.meta.url),'utf8');
const nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',hidden:false,classList:{toggle(){}}});return nodes.get(id);};
let en=false,canEdit=true,currentId='a';
const history=[{actor:'User Имя',formula:'4D6 ≥4',rolls:[6,4,2,1],successes:3,crits:1,outcome:'Крайний успех',payment:'Влияние, флэшбек +4'}];
const request={attempt:2,status:'tied',participants:[{id:'a',name:'User Имя',heroId:'hero',controller:'participant',pool:4},{id:'b',name:'Other',controller:'narrator',pool:6}],results:{a:{successes:3,crits:1,rolls:[6,4],payment:'Влияние'},b:{successes:3,crits:0,rolls:[4,4]}}};
const c=vm.createContext({
  toolsManualMode:()=>false,$:node,isEnglishPreview:()=>en,esc:value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),
  Scene:{opposedRoll:request,rollFeed:history},S:{runtime:{diceHistory:history}},store:{heroes:[{id:'hero'}]},
  toolsSyncContext:()=>({shared:false,canEdit}),toolsRole:()=> 'local-table',toolsView:()=> 'narrator',
  currentOpposedParticipant:()=>request.participants.find(p=>p.id===currentId),opposedParticipantResult:(p,r)=>r.results[p.id],activeSceneView:()=> 'gm',
});
function load(name){const a=source.indexOf(`function ${name}(`),b=source.indexOf('\nfunction ',a+1);assert.ok(a>=0,name);vm.runInContext(source.slice(a,b<0?source.length:b),c);}
for(const name of ['opposedResultSummary','opposedCountLabel','toolsOutcomeLabel','toolsPaymentLabel','challengeResultSummary','renderOpposedStatus','renderDiceHistory'])load(name);
const saved=JSON.stringify({request,history});
for(const language of [false,true,false]){
  en=language;c.renderOpposedStatus();c.renderDiceHistory();
  const opposed=node('freeplay-opposed-status').innerHTML,feed=node('dice-history').innerHTML;
  assert.ok(opposed.includes(language?'YOUR SIDE':'ВАША СТОРОНА'));
  assert.ok(opposed.includes(language?'Reroll the tie':'Перебросить ничью'));
  assert.ok(opposed.includes(language?'All In: Influence':'Ва-банк: Влияние'));
  assert.ok(feed.includes(language?'Extreme Success':'Крайний успех'));
  assert.ok(feed.includes('User Имя'));assert.ok(feed.includes('4D6 ≥4'));
  assert.equal(JSON.stringify({request,history}),saved,'language changes never rewrite stored results, payment or user names');
}
en=true;
for(const [n,expected]of [[0,'0 Successes'],[1,'1 Success'],[2,'2 Successes'],[21,'21 Successes']])assert.equal(c.opposedCountLabel(n,'Успех','Успеха','Успехов'),expected);
en=false;assert.equal(c.opposedCountLabel(21,'Успех','Успеха','Успехов'),'21 Успех');
for(const language of [false,true]){
  en=language;
  const pending={participants:request.participants,results:{}};
  assert.match(c.opposedResultSummary(pending),language?/Both sides build/:/Обе стороны/);
  pending.results={a:{}};assert.match(c.opposedResultSummary(pending),language?/1 of 2/:/1 из 2/);
  pending.status='tied';assert.match(c.opposedResultSummary(pending),language?/must reroll/:/должны перебросить/);
  pending.resolution='both';assert.match(c.opposedResultSummary(pending),language?/both compatible Rewards/:/обе совместимые Награды/);
  delete pending.resolution;pending.winnerParticipantId='a';assert.ok(c.opposedResultSummary(pending).includes('User Имя'));
  assert.equal(c.toolsOutcomeLabel('User-defined outcome'),'User-defined outcome');
  assert.equal(c.toolsPaymentLabel('User-defined payment'),'User-defined payment');
  assert.equal(c.toolsPaymentLabel('Влияние, флэшбек +4'),language?'Influence, flashback +4':'Влияние, флэшбек +4');
}
en=true;canEdit=false;c.renderOpposedStatus();assert.ok(!node('freeplay-opposed-status').innerHTML.includes('data-opposed-reroll'),'locale never gives a reader Narrator commands');
canEdit=true;delete request.results.b;c.renderOpposedStatus();assert.ok(node('freeplay-opposed-status').innerHTML.includes('Manual pool'));assert.ok(node('freeplay-opposed-status').innerHTML.includes('Roll for participant'));
request.status='resolved';c.renderOpposedStatus();assert.ok(node('freeplay-opposed-status').innerHTML.includes('Finish Opposed Roll'));
console.log('Freeplay localization: RU/EN results, tie/winner/pending, read-only roles and language round-trip preserve history, D6 and user text');

// Translate offered standard-tag labels, never their submitted values or user tags.
c.window={};vm.runInContext(fs.readFileSync(new URL('../logic.js',import.meta.url),'utf8'),c);c.Logic=c.window.DAWN_LOGIC;
c.D={bonds:{actions:[{tag:'Партнер'},{tag:'Соперник'}]}};c.S.gifts=[];c.S.bonds=[{id:'bond',name:'User Связь',rank:2,quick:true,tags:['Custom Тег']}];
load('freeplayBondStatus');load('renderFreeplayBonds');
const savedBonds=JSON.stringify(c.S.bonds);
for(const language of [true,false,true]){
  en=language;c.renderFreeplayBonds();const html=node('freeplay-bonds').innerHTML;
  assert.ok(html.includes(language?'Quick Bond':'Быстрая Связь'));assert.ok(html.includes('+3D6'));
  assert.ok(html.includes(language?'<option value="Партнер">Partner</option>':'<option value="Партнер">Партнер</option>'));
  assert.ok(html.includes('Custom Тег'));assert.equal(JSON.stringify(c.S.bonds),savedBonds);
}
