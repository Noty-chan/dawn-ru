import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../scene-workspace-next.js',import.meta.url),'utf8');
const start=source.indexOf('  function measureMobileControls(){'),end=source.indexOf('  function refresh(){',start);
const values=new Map();let mobile=true,next=true,height=80.48;
const context=vm.createContext({bar:{getBoundingClientRect:()=>({height})},narrow:()=>mobile,usingNextSceneInterface:()=>next,$:()=>({style:{setProperty:(key,value)=>values.set(key,value)}})});
vm.runInContext(source.slice(start,end),context);
context.measureMobileControls();assert.equal(values.get('--scene-mobile-controls-height'),'81px','fractional rendered dock is fully reserved');
height=102.2;context.measureMobileControls();assert.equal(values.get('--scene-mobile-controls-height'),'103px','changed font/content height updates the panel boundary');
mobile=false;context.measureMobileControls();assert.equal(values.get('--scene-mobile-controls-height'),'0px','desktop clears the reserved mobile boundary');
mobile=true;next=false;context.measureMobileControls();assert.equal(values.get('--scene-mobile-controls-height'),'0px','classic is not changed');
console.log('Next scene measured dock boundary: fractional height, resize/content and desktop/classic reset passed');

const turnStart=source.indexOf('  function revealCurrentTurn('),turnEnd=source.indexOf('  function measureMobileControls()',turnStart);
const classes=new Set(),turnScene={activeActorId:'one'};
let item={top:210,bottom:254},reads=0,renderedActor='one',viewportHeight=160;
const turns={scrollTop:40,getBoundingClientRect:()=>({top:0,bottom:viewportHeight,height:viewportHeight}),
  querySelector:()=>({dataset:{sceneTurnActor:renderedActor},getBoundingClientRect:()=>{reads++;return item}})};
const turnContext=vm.createContext({Scene:turnScene,document:{body:{classList:{contains:name=>classes.has(name)}}}});
vm.runInContext('let turnLayout=null,turnActorId=null;'+source.slice(turnStart,turnEnd),turnContext);
turnContext.revealCurrentTurn(turns,true,false);
assert.equal(turns.scrollTop,140,'initial current participant becomes visible in a long roster');
turns.scrollTop=20;turnContext.revealCurrentTurn(turns,true,false);
assert.equal(turns.scrollTop,20,'ordinary resource redraw does not undo manual roster scrolling');
assert.equal(reads,1);
turns.scrollTop=100;turnScene.activeActorId='two';item={top:-40,bottom:4};turnContext.revealCurrentTurn(turns,true,false);
assert.equal(reads,1,'pre-render refresh does not consume a handoff against the old roster DOM');
renderedActor='two';turnContext.revealCurrentTurn(turns,true,false);
assert.equal(turns.scrollTop,54,'turn handoff reveals the new current participant after rendering');
classes.add('scene-panel-open-both');turnContext.revealCurrentTurn(turns,true,false);
assert.equal(reads,2,'hidden two-panel roster is not scrolled');
classes.delete('scene-panel-open-both');classes.add('scene-panel-open-left');
turnContext.revealCurrentTurn(turns,true,false);
assert.equal(reads,3,'reopening the compact block reveals the current turn');
classes.add('focus-mode');turnContext.revealCurrentTurn(turns,true,false);
assert.equal(reads,3,'focus mode keeps the hidden roster quiet');
classes.clear();turnContext.revealCurrentTurn(turns,false,false);turnContext.revealCurrentTurn(turns,true,true);
assert.equal(reads,3,'classic and phone layouts are not scrolled by desktop presentation');
viewportHeight=0;turnScene.activeActorId='three';renderedActor='three';
turnContext.revealCurrentTurn(turns,true,false);
assert.equal(reads,3,'hidden Table geometry does not consume a handoff');
viewportHeight=160;turnContext.revealCurrentTurn(turns,true,false);
assert.equal(reads,4,'returning to Table reveals the current participant');
console.log('Portrait turn roster reveal: handoff/layout changes only, manual scroll and hidden/classic/mobile preservation passed');

const css=fs.readFileSync(new URL('../scene-workspace-next.css',import.meta.url),'utf8');
assert.ok(!css.includes('var(--scene-header-height'),'mobile shell has a single measured header owner');
assert.ok(css.includes('height:calc(100dvh - var(--mobile-header-height,101px) - 12px)'),'mobile header changes update the full shell immediately');
console.log('Mobile shell: live header measurement, no stale second header height');

// Production refresh and its actual click listener must use the same current,
// visible participant. No canonical state may be changed by presentation.
const attrs=()=>({values:new Map(),getAttribute(key){return this.values.get(key)??null},setAttribute(key,value){this.values.set(key,String(value))}});
const selection={textContent:''},action={disabled:false},details={open:false},close=attrs(),title={textContent:''};
let phone=false,view='gm',compoundCalls=0,styleWrites=0,clicked=null,opened=null;
const toolbar={},turnsNode={querySelector:()=>null},left={prepend(node){node.parentElement=this;node.previousSibling=null}},palette={classList:{toggle(){}},append(node){node.parentElement=this;node.previousSibling=null},querySelector:selector=>selector==='h2'?title:close};
const toolbarAnchor={after(node){node.previousSibling=this}},turnAnchor={after(node){node.previousSibling=this}};
toolbar.previousSibling=toolbarAnchor;turnsNode.previousSibling=turnAnchor;
const reserved=new Map(),workbench={style:{getPropertyValue:key=>reserved.get(key)||'',setProperty(key,value){styleWrites++;reserved.set(key,value)}}};
const mobileBar={getBoundingClientRect:()=>({height:72}),querySelector:selector=>selector==='.scene-mobile-selection'?selection:selector==='details'?details:action,addEventListener(type,handler){clicked=handler}};
const scene={selectedActor:'secret',activeSpace:'one',activeActorId:null,actors:[{id:'secret',name:'Private NPC',hp:19,maxHp:20,hidden:true,space:'one'},{id:'hero',name:'Hero',hp:9,maxHp:10,heroId:'own',space:'one'}]};
const refreshContext=vm.createContext({Scene:scene,S:{id:'own'},SceneEngine:{compoundEnemyStatus(scene,id){compoundCalls++;assert.notEqual(view==='player'&&id==='secret'&&scene.actors[0].hidden,true,'hidden actor is never queried');return id==='secret'?{active:true,hp:99,maxHp:100}:{active:false}}},
 document:{body:{classList:{toggle(){},contains:()=>false}},querySelector:()=>toolbar},window:{},bar:mobileBar,more:{querySelectorAll:()=>[]},palettePanel:palette,toolbarHome:toolbarAnchor,turnHome:turnAnchor,dockHomes:new Map(),dockIcons:{},turnLayout:null,turnActorId:null,
 activeScenePanels:{left:null,right:null},activeScenePanel:null,usingNextSceneInterface:()=>true,narrow:()=>phone,init:()=>true,activeSceneView:()=>view,copy:ru=>ru,isScenePanelOpen:()=>false,openSceneActorCockpit:id=>{opened=id},setScenePanel:panel=>{opened=panel},
 $:id=>({'scene-turn-strip':turnsNode,'scene-rail-left':left,'scene-workbench':workbench}[id])});
const visibleStart=source.indexOf('  function selectedVisibleActor()'),visibleEnd=source.indexOf('  function init()',visibleStart);
vm.runInContext(source.slice(visibleStart,visibleEnd)+source.slice(turnStart,source.indexOf('  function setVersion(')),refreshContext);
const clickStart=source.indexOf("    bar.addEventListener('click'"),clickEnd=source.indexOf("    if(typeof ResizeObserver",clickStart);
vm.runInContext(source.slice(clickStart,clickEnd),refreshContext);
const originalScene=JSON.stringify(scene);
for(let index=0;index<20;index++)refreshContext.refresh();
assert.equal(compoundCalls,0,'hidden desktop mobile bar does no compound calculation');
assert.equal(styleWrites,1,'unchanged dock geometry is not written on every redraw');
assert.equal(JSON.stringify(scene),originalScene);
phone=true;refreshContext.refresh();assert.equal(compoundCalls,1);assert.match(selection.textContent,/99 \/ 100/);
view='player';refreshContext.refresh();assert.equal(compoundCalls,1);assert.equal(selection.textContent.includes('Private NPC'),false);assert.equal(action.disabled,true);
clicked({target:{closest:selector=>selector==='[data-mobile-actor-action]'?{}:null}});assert.equal(opened,null,'role flip cannot open a selected hidden participant');
clicked({target:{closest:selector=>selector==='[data-mobile-actor-info]'?{}:null}});assert.equal(opened,'media');
scene.actors[0].hidden=false;refreshContext.refresh();assert.equal(compoundCalls,2);assert.match(selection.textContent,/Private NPC/);assert.equal(action.disabled,true,'foreign visible participant is readable but its action remains disabled');
scene.actors[0].space='elsewhere';refreshContext.refresh();assert.equal(compoundCalls,2);assert.equal(selection.textContent.includes('Private NPC'),false);
scene.selectedActor='hero';refreshContext.refresh();assert.equal(action.disabled,false);assert.match(selection.textContent,/9 \/ 10/);
phone=false;const desktopCalls=compoundCalls;refreshContext.refresh();assert.equal(compoundCalls,desktopCalls);assert.equal(reserved.get('--scene-mobile-controls-height'),'0px');
console.log('Production mobile workspace: hidden desktop queries skipped; current phone compound values, role/visibility/space transitions, click privacy and unchanged geometry writes passed. DOM fixture, not native layout timing.');
