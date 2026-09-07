import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const sceneSource=fs.readFileSync(path.join(root,"scene-ui.js"),"utf8");
const playSource=fs.readFileSync(path.join(root,"app-play-events.js"),"utf8");
const sceneFunctions=sceneSource.slice(sceneSource.indexOf("function sceneUtilityActorAvailable"),sceneSource.indexOf("function sceneReferenceId"));
const rollFunction=sceneSource.slice(sceneSource.indexOf("function rollSceneDice"),sceneSource.indexOf("function applySceneZoom"));
const utilityClickHandler=playSource.slice(playSource.indexOf('$("scene-utility").addEventListener("click"'),playSource.indexOf("function handleSceneDiceUtilityInput"));
const utilityHandlers=playSource.slice(playSource.indexOf("function handleSceneDiceUtilityInput"),playSource.indexOf('$("scene-ref-search")'));

const clone=value=>JSON.parse(JSON.stringify(value));
const actor=(id,name,team,{heroId=null,hidden=false,body=3}={})=>({
  id,name,kind:team==="enemy"?"enemy":"hero",team,heroId,hidden,knockedOut:false,tier:1,
  attrs:{body,talent:2,spirit:2,mind:2},skills:[{id:`${id}.skill`,name:"Атлетика",rank:1}],
  ability:{name:"Рывок",rank:1},taintedAbility:null,gifts:[],sacrifices:[],rollFeed:[],
});
const hero=actor("hero-local","Рааша", "hero",{heroId:"sheet-1",body:3});
const ally=actor("hero-ally","Союзник","hero",{heroId:"sheet-2",body:4});
const enemy=actor("enemy-hidden","Скрытый враг","enemy",{hidden:true,body:6});
const sceneFixture=()=>({view:"gm",selectedActor:enemy.id,actors:[clone(hero),clone(ally),clone(enemy)],rollFeed:[],challengeRequest:null});

const controls=Object.create(null);
const listeners=Object.create(null);
const optionsFrom=html=>[...String(html).matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(match=>({value:match[1],selected:/\bselected\b/.test(match[2])}));
const selectedValue=options=>options.find(option=>option.selected)?.value||options[0]?.value||"";
const readValue=(html,id,fallback="")=>{
  const match=String(html).match(new RegExp(`<input[^>]*id="${id}"[^>]*value="([^"]*)"`));
  return match?match[1]:fallback;
};
const installControl=(id,value="")=>{const control=controls[id]||{id,value,checked:false,disabled:false,options:[]};control.id=id;control.value=value;controls[id]=control;return control};
const parseControls=html=>{
  const attrOptions=optionsFrom(String(html).match(/<select id="scene-dice-attr">([\s\S]*?)<\/select>/)?.[0]||"");
  const skillOptions=optionsFrom(String(html).match(/<select id="scene-dice-skill">([\s\S]*?)<\/select>/)?.[0]||"");
  const abilityOptions=optionsFrom(String(html).match(/<select id="scene-dice-ability">([\s\S]*?)<\/select>/)?.[0]||"");
  const actorOptions=optionsFrom(String(html).match(/<select id="scene-dice-actor-select"[^>]*>([\s\S]*?)<\/select>/)?.[0]||"");
  for(const [id,options] of [["scene-dice-attr",attrOptions],["scene-dice-skill",skillOptions],["scene-dice-ability",abilityOptions],["scene-dice-actor-select",actorOptions]])if(options.length){const control=installControl(id,selectedValue(options));control.options=options}
  for(const id of ["scene-dice-pool","scene-dice-target","scene-dice-adv","scene-dice-dis"]){const control=installControl(id,readValue(html,id,""));control.type="number"}
  const dark=String(html).match(/<input id="scene-dark-urge"[^>]*>/)?.[0];if(dark){const control=installControl("scene-dark-urge","");control.checked=/\bchecked\b/.test(dark)}else delete controls["scene-dark-urge"];
  installControl("scene-dice-total","");
};
const rootElement={
  _html:"",
  insertAdjacentHTML(_position,html){this._html+=String(html)},
  addEventListener(type,handler){listeners[type]=handler},
  classList:{toggle(){}},
};
Object.defineProperty(rootElement,"innerHTML",{get(){return this._html},set(value){this._html=String(value);parseControls(this._html)}});

let Scene=sceneFixture(),S={id:"sheet-1",concept:""},Sync={state(){return this}},activeSceneMode="gm";
const committed=[],toasts=[],statusCalls=[];
const SceneEngine={
  diceHookStatus(_scene,actorId,request){statusCalls.push({actorId,request:clone(request)});return{available:true,count:Math.max(1,request.baseCount+request.advantage-request.hindrance),threshold:4,criticalAt:6,sources:[]}},
  diceRollPayload(_scene,actorId,_request,result){const successes=result.rolls.filter(value=>value>=4).length;return{available:true,payload:{actorId,rolls:result.rolls,successes,crits:result.rolls.filter(value=>value>=6).length,formula:`${result.rolls.length}D6`}}},
};
const Logic={rollXd6({count}){return{rolls:Array.from({length:count},()=>4)}}};
const D={effects:{positive:[],negative:[]}};
const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const skillDisplayName=skill=>skill?.name||skill?.id||"";
const $=id=>id==="scene-utility"?rootElement:controls[id]||null;
const $$=()=>[];
const toast=message=>{toasts.push(String(message));return null};
const setScenePanel=()=>{};
const renderScene=()=>{};
const requestAnimationFrame=callback=>callback();
const uid=()=>"request-1";
const commitSceneEvents=(label,events)=>{committed.push({label,events:clone(events)});return{pending:false}};
const applyOptimisticToolsEvents=()=>{};

const context={console,Date,D,Logic,SceneEngine,esc,clamp,skillDisplayName,$,$$,toast,setScenePanel,renderScene,requestAnimationFrame,uid,commitSceneEvents,applyOptimisticToolsEvents,root:rootElement,controls,listeners,Scene,S,Sync,activeSceneMode};
vm.createContext(context);
vm.runInContext(`
  let Scene=this.Scene,S=this.S,Sync=this.Sync,activeUtilityPreset={skillId:"",abilityKey:""},activeUtilityActorId=null;
  const currentHeroActor=()=>Scene.actors.find(item=>item.heroId===S.id)||null;
  const activeSceneView=()=>Sync?.state?.().sceneId?(Sync.state().canNarrate?"gm":"player"):activeSceneMode;
  ${sceneFunctions}
  ${rollFunction}
  ${utilityClickHandler}
  ${utilityHandlers}
  this.api={
    actor:()=>sceneUtilityActor(),
    available:(candidate,view)=>sceneUtilityActorAvailable(candidate,view),
    render:()=>renderSceneUtility(),
    roll:(actorId)=>rollSceneDice(actorId),
    open:(options)=>openSceneRollPreset(options),
    control:id=>$(id),
    html:()=>$("scene-utility").innerHTML,
    setScene:value=>{Scene=value},
    setSheet:value=>{S=value},
    setSync:value=>{Sync=value},
    setMode:value=>{activeSceneMode=value},
    setUtilityActor:value=>{activeUtilityActorId=value},
    resetPreset:()=>{activeUtilityPreset={skillId:"",abilityKey:""}},
    listener:type=>listeners[type],
  };
`,context,{filename:"lionwing-narrator-roll-ui-harness.js"});

const api=context.api;
const fireInput=target=>api.listener("input")({target});
const fireChange=target=>api.listener("change")({target});
const targetFor=({rollId="",requestId=""}={})=>({closest(selector){
  if(selector==="[data-scene-roll]"&&rollId)return{dataset:{sceneRoll:rollId}};
  if(selector==="[data-scene-request-roll]"&&requestId)return{dataset:{sceneRequestRoll:requestId}};
  return null;
}});
const fireClick=options=>api.listener("click")({target:targetFor(options)});
const latestStatus=()=>statusCalls.at(-1);
const latestCommit=()=>committed.at(-1);

api.setSync({state(){return this}});api.setMode("gm");api.setScene(sceneFixture());api.setSheet({id:"sheet-1"});api.resetPreset();
api.render();
assert.equal(api.actor().id,"enemy-hidden","Narrator can start from the selected participant");
assert.match(api.html(),/Кто бросает/,"Narrator sees an explicit thrower label");
assert.match(api.html(),/Рааша/);assert.match(api.html(),/Скрытый враг/);

const actorSelect=api.control("scene-dice-actor-select");actorSelect.value="hero-local";fireChange(actorSelect);
assert.equal(api.actor().id,"hero-local","Narrator selection changes the active thrower");
assert.match(api.html(),/Рааша/);
api.control("scene-dice-pool").value="7";fireInput(api.control("scene-dice-pool"));
assert.equal(latestStatus().actorId,"hero-local");assert.equal(latestStatus().request.baseCount,7,"Manual pool is passed to the existing SceneEngine path");
api.control("scene-dice-skill").value="hero-local.skill";fireChange(api.control("scene-dice-skill"));
api.control("scene-dice-ability").value="ability";fireChange(api.control("scene-dice-ability"));
api.control("scene-dice-attr").value="mind";fireInput(api.control("scene-dice-attr"));
api.control("scene-dice-target").value="5";fireInput(api.control("scene-dice-target"));
api.control("scene-dice-adv").value="2";fireInput(api.control("scene-dice-adv"));
api.control("scene-dice-dis").value="1";fireInput(api.control("scene-dice-dis"));
api.render();
assert.equal(api.control("scene-dice-attr").value,"mind","Saved attribute survives utility rerender");
assert.equal(api.control("scene-dice-skill").value,"hero-local.skill");assert.equal(api.control("scene-dice-ability").value,"ability");
assert.equal(api.control("scene-dice-pool").value,"7","Saved manual pool survives utility rerender");
assert.equal(api.control("scene-dice-target").value,"5");assert.equal(api.control("scene-dice-adv").value,"2");assert.equal(api.control("scene-dice-dis").value,"1");

committed.length=0;fireClick({rollId:"hero-local"});assert.equal(latestCommit().events[0].type,"roll.public");assert.equal(latestCommit().events[0].actorId,"hero-local","Roll action records the selected actor");
committed.length=0;fireClick({requestId:"hero-local"});assert.equal(committed.length,0,"Request action is unavailable without a shared narrator session");

api.setMode("player");api.setSync({state(){return this}});api.setUtilityActor("enemy-hidden");api.resetPreset();api.render();
assert.equal(api.actor().id,"hero-local","Player view always resolves to the owned local hero");
assert.doesNotMatch(api.html(),/scene-dice-actor-select/);assert.doesNotMatch(api.html(),/Скрытый враг/,"Player view does not expose hidden participants");
committed.length=0;api.roll("enemy-hidden");assert.equal(committed.length,0,"A player cannot spoof an enemy actor through a stale roll id");
committed.length=0;fireClick({rollId:"enemy-hidden"});assert.equal(committed.length,0,"The click handler also rejects a spoofed actor id");
api.open({actorId:"enemy-hidden"});assert.match(toasts.at(-1),/только для вашего героя/);

api.setMode("gm");api.setSheet({id:"missing-local-sheet"});api.setScene({...sceneFixture(),selectedActor:"enemy-hidden"});api.setUtilityActor(null);api.resetPreset();
api.render();assert.equal(api.actor().id,"enemy-hidden","Narrator still has a usable actor without a local hero");assert.equal(latestStatus().actorId,"enemy-hidden");assert.equal(latestStatus().request.baseCount,6,"The pool uses the selected participant's sheet");

api.setSync({sceneId:"shared-scene",canNarrate:true,displayName:"Нарратор",state(){return this}});api.setSheet({id:"sheet-1"});api.setScene({...sceneFixture(),selectedActor:"hero-local"});api.setUtilityActor("hero-local");api.resetPreset();api.render();
committed.length=0;fireClick({requestId:"hero-local"});assert.equal(latestCommit().events[0].type,"challenge.request","Network request remains a separate action");assert.equal(latestCommit().events.some(event=>event.type==="roll.public"),false);
committed.length=0;fireClick({rollId:"hero-local"});assert.equal(latestCommit().events[0].type,"roll.public","Immediate roll remains separate from request");

console.log("LionWing Narrator roll UI passed: actor selection, sheet pool, form persistence, narrator without local hero, player ownership, spoof rejection, and request/roll separation");
