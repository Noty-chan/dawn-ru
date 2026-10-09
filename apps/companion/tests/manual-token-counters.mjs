import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../scene-manual-integration.js',import.meta.url),'utf8');
const begin=source.indexOf('function renderManualTokenCounters(){');
const end=source.indexOf('function submitManualNumber(',begin);
assert.ok(begin>=0&&end>begin);
// Model the synchronous native change delivered when a dirty input is removed.
// These are production functions/handlers with a fake DOM, not browser proof.
let currentPanel=null,dirtyCounter=null,dirtyTension=null,role='gm',control=true;
let removalChanges=0,statusChanges=0;
const documentHandlers=new Map(),commands=[];
const counterTarget=(key,value)=>({dataset:{tokenCountInput:key},value:String(value)});
const tensionTarget=value=>({dataset:{},value:String(value),matches:s=>s==='[data-manual-tension]'});
const documentChange=target=>documentHandlers.get('change')({target});
const footer={
  querySelector:()=>currentPanel,
  append:panel=>{currentPanel=panel;},
};
let tensionInput=null;
const status={dataset:{},contains:node=>node===tensionInput,querySelector:selector=>selector==='[data-manual-tension]'?tensionInput:{textContent:''},
 set innerHTML(value){this.markup=value;if(dirtyTension){statusChanges++;documentChange(dirtyTension);dirtyTension=null;}tensionInput=tensionTarget('');tensionInput.setAttribute=()=>{};}};
const actor={id:'hero',ap:3,focus:2,wounds:0};
const context={
  window:{DAWN_TABLE_POLICY:{resourceMaximum:()=>99}},
  Scene:{actors:[actor],selectedActor:'hero',name:'QA',tension:4},
  store:{sceneUi:{}},status,space:{name:'Board'},current:null,
  $:id=>id==='scene-manual-footer'?footer:id==='scene-manual-context'?status:null,
  Sync:{state:()=>({sceneId:'qa'})},manualClockScope:()=> 'qa:0',uid:()=> 'qa-event',
  manualTableActive:()=>true,manualTableCopy:ru=>ru,esc:String,
  canControlSceneActor:()=>control,activeSceneView:()=>role,
  persist(){},renderScene(){},
  commitSceneEvents(label,events){
    commands.push(structuredClone(events[0]));
    const payload=events[0].payload;
    if(payload.kind==='resource')Object.assign(actor,payload.values);
    else context.Scene.tension=payload.value;
  },
  document:{
    addEventListener:(type,handler)=>documentHandlers.set(type,handler),
    createElement(){
      const handlers=new Map(),details={open:false};
      return {dataset:{},innerHTML:'',addEventListener:(type,handler)=>handlers.set(type,handler),
        fire:(type,target)=>handlers.get(type)({target}),querySelectorAll:()=>[],querySelector:()=>details,
        remove(){if(dirtyCounter){removalChanges++;handlers.get('change')({target:dirtyCounter});dirtyCounter=null;}currentPanel=null;},
      };
    },
  },
};
vm.createContext(context);
vm.runInContext(source.slice(begin,end),context);
vm.runInContext(source.slice(source.indexOf('function submitManualNumber('),source.indexOf('window.DAWN_TABLE_POLICY?.install()')),context);
const render=()=>context.renderManualTokenCounters();
const click=(key,delta)=>currentPanel.fire('click',{closest:()=>({dataset:{tokenCount:key,tokenDelta:String(delta)}})});
const change=(key,value)=>currentPanel.fire('change',counterTarget(key,value));

render();
currentPanel.querySelector('details').open=true;
const originalPanel=currentPanel;render();
assert.equal(currentPanel,originalPanel,'opening preferences does not invalidate stable markup');
dirtyCounter=counterTarget('ap',17);
actor.focus=5; // An unrelated update changes markup and forces replacement.
render();
assert.equal(currentPanel.querySelector('details').open,true,'resource repaint retains preferences menu');
assert.equal(removalChanges,1,'the fake native removal event must actually fire');
assert.equal(commands.length,0,'repaint must not submit the unfinished AP draft');
assert.equal(actor.ap,3);
assert.equal(context.window.DAWN_MANUAL_SURFACE_PAINTING,false);

dirtyTension=tensionTarget(21);
context.renderManualTensionContext(status,context.space,null);
assert.equal(statusChanges,1,'status replacement must deliver the removal event');
assert.equal(commands.length,0,'status repaint must not submit unfinished tension');
assert.equal(context.Scene.tension,4);
assert.equal(context.window.DAWN_MANUAL_SURFACE_PAINTING,false);

change('ap','');change('ap','   ');
assert.equal(commands.length,0,'empty counter must not become zero');
change('ap','8');
assert.equal(actor.ap,8);
actor.ap=12; // A stale rendered button must read the current actor value.
click('ap',1);click('ap',1);click('ap',-1);
assert.deepEqual(commands.map(event=>event.payload.values?.ap),[8,13,14,13]);
control=false;change('ap','20');click('ap',1);
assert.equal(commands.length,4,'revoked control must block retained handlers');
control=true;
tensionInput.value='';documentChange(tensionInput);tensionInput.value='bad';documentChange(tensionInput);
assert.equal(commands.length,4);
tensionInput.value='9';documentChange(tensionInput);
assert.equal(context.Scene.tension,9);
role='player';tensionInput.value='10';documentChange(tensionInput);
assert.equal(commands.length,5,'player cannot write tension');
role='gm';delete tensionInput.manualSubmitted;delete tensionInput.manualSubmission;
context.Scene.tension=999;context.renderManualTensionContext(status,context.space,null);
const stableInput=tensionInput;tensionInput.value='17';context.document.activeElement=tensionInput;
actor.wounds=1;context.renderManualTensionContext(status,context.space,null);
assert.equal(tensionInput,stableInput);assert.equal(tensionInput.value,'17');assert.equal(context.document.activeElement,tensionInput);assert.equal(context.Scene.tension,999);
const beforeTension=commands.length;documentHandlers.get('keydown')({target:tensionInput,key:'Enter',preventDefault(){}});documentChange(tensionInput);documentHandlers.get('focusout')({target:tensionInput});
assert.equal(commands.length,beforeTension+1,'Enter/change/blur writes tension exactly once');assert.equal(context.Scene.tension,17);
tensionInput.value='55';documentHandlers.get('keydown')({target:tensionInput,key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(tensionInput.value,'17');
role='player';context.renderManualTensionContext(status,context.space,null);assert.notEqual(tensionInput,stableInput);assert.equal(tensionInput.disabled,true);assert.equal(tensionInput.value,'17');
console.log('Tension production renderer: same DOM/draft/focus after external wounds, no early commit, Enter/change/blur dedup, Escape and role reset passed');
console.log('Manual token counters QA passed: removal-change guards, empty draft, explicit input, fresh repeated steps and rights');

// Exercise real persistence, not only the counter UI's persist stub.
const appSource=fs.readFileSync(new URL('../app-core.js',import.meta.url),'utf8');
const saved=new Map(),preferences={hero:['ap'],enemy:[]};
const storageContext={store:{heroes:[],current:0,sceneUi:{tokenCounters:preferences}},S:{id:'hero'},Scene:{actors:[],artworks:[]},
  sceneCore:s=>structuredClone(s),normalizeGmLibrary:v=>v||{},persistableHeroes:()=>[],persistHeroStore:()=>true,
  scheduleHeroMediaPersistence(){},localStorage:{setItem:(key,value)=>saved.set(key,value)},STORAGE_KEY:'qa',heroMediaStorageReady:false,
  sceneZoom:1,sceneZoomMode:'fit',sceneControlMode:'manual',sceneInterfaceVersion:'next',SCENE_INTERFACE_ROLLOUT_VERSION:1,
  sceneLeftPanelsEnabled:true,scenePanelLayoutMode:'split',scenePanelSides:{},scenePanelWidths:{},sceneTurnStripVisible:true,
  sceneInterfaceDensity:'normal',sceneViewportMode:'auto',console};
vm.createContext(storageContext);
vm.runInContext(appSource.slice(appSource.indexOf('function persistableStore('),appSource.indexOf('function persistableHeroes(')),storageContext);
vm.runInContext(appSource.slice(appSource.indexOf('function persistNow()'),appSource.indexOf('function persist(){')),storageContext);
storageContext.persistNow();storageContext.persistNow();
assert.deepEqual(JSON.parse(saved.get('qa')).sceneUi.tokenCounters,preferences,'regular saves retain separate per-token counter choices, including an empty set');
console.log('Token counter preferences survive actual persistNow/persistableStore and JSON reload');
