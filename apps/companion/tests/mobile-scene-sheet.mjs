import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const source=read('scene-ui.js'),start=source.indexOf('function sceneSheetPanel()'),end=source.indexOf('\nfunction sceneUtilityActorAvailable',start);
assert.ok(start>=0&&end>start);
function fixture({gm=true,en=false,actors=[],shared=false}={}){
 const context={Scene:{actors,selectedActor:null,activeActorId:null},S:{id:'own',runtime:{},concept:''},Sync:{state:()=>shared?{sceneId:'room',role:'player'}:null},activeSceneView:()=>gm?'gm':'player',isEnglishPreview:()=>en,
  activeOutlooks:()=>[],techById:()=>null,hasGift:()=>false,ATTRS:[],esc:String,md:String,sceneRollShortcuts:()=>'',sceneActorEffects:()=>[],sceneEffectList:()=>[],sceneUsesLionwing:()=>true,sceneCockpitLinksHtml:actor=>`<button data-normal-actor="${actor.id}">Actions</button>`,sceneActionPanel:()=>'<p>Normal actions</p>',SceneEngine:{ruleResourceDefinitions:()=>[]},window:{}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {context,render:()=>vm.runInContext('sceneSheetPanel()',context)};
}
for(const en of [false,true]){
 for(const [gm,shared,actors] of [[true,false,[]],[true,false,[{id:'other'}]],[false,true,[]],[false,true,[{id:'other'}]],[false,false,[]]]){
  const f=fixture({gm,en,shared,actors}),before=JSON.stringify({Scene:f.context.Scene,S:f.context.S}),html=f.render();
  assert.equal(JSON.stringify({Scene:f.context.Scene,S:f.context.S}),before,'render does not mutate game state');
  assert.match(html,/scene-sheet-empty/);assert.doesNotMatch(html,/data-sheet-tab|scene-sheet-vitals|full-rules|Безымянный/,'empty state omits fake stats, tabs and empty technique reference');
  if(gm)assert.match(html,actors.length?/data-open-scene-panel="director"/:/data-open-scene-panel="add"/);
  else if(shared)assert.match(html,/data-core-join-hero/);else assert.match(html,/data-open-mode="build"/);
  if(actors.length)assert.doesNotMatch(html,en?/No participants on the Table yet/:/На Столе пока нет участников/,'nonempty Scene is not described as empty');
  assert.ok(html.includes(en?'Table':'Стол')||html.includes(en?'selected':'выбран'),'English and Russian messages follow the active language');
 }
 const actor={id:'linked',heroId:'own',name:'Real hero',tier:2,rulesEdition:'lionwing',hp:12,maxHp:20,ap:3,focus:2,kind:'hero'};
 const f=fixture({en,actors:[actor]}),before=JSON.stringify(f.context.Scene),html=f.render();
 assert.doesNotMatch(html,/scene-sheet-empty/);assert.match(html,/data-scene-sheet-actor="linked"/);assert.match(html,/data-sheet-tab="combat"/);assert.match(html,/12\/20/);assert.match(html,/data-normal-actor="linked"/);assert.equal(JSON.stringify(f.context.Scene),before);
 assert.doesNotMatch(html,/class="full-rules"/,'normal actor without Techniques has no empty disclosure');
 actor.knownTechniques={'test.technique':1};f.context.techById=()=>({name:'Real technique',levels:[{n:1,name:'Level one',text:'Real rule'}]});
 const withTechnique=f.render();assert.match(withTechnique,/class="full-rules"/);assert.match(withTechnique,/Real technique/);assert.match(withTechnique,/Real rule/,'real Techniques preserve their existing reference');
}
// CTA routing remains the existing sheet/workbench event path, not a new writer.
const events=read('app-play-events.js'),sceneEvents=read('app-scene-events.js');
assert.match(events,/if\(joinButton\)\{runSyncAction\(publishCurrentHero/);
assert.match(events,/if\(mode\)\{setScenePanel\(null\);setMode\(mode\.dataset\.openMode\)/);
assert.match(events,/if\(panel\).*setScenePanel\(panel\.dataset\.openScenePanel\)/);
assert.match(sceneEvents,/if\(panel\).*setScenePanel\(panel\.dataset\.openScenePanel\)/);
console.log('Scene sheet empty-state VM PASS: RU/EN, empty/nonempty Scene, GM/player/local CTAs, no mutations and normal actor rendering. Browser and network not exercised.');
