import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");
const events=new Map(),frames=[],observers=[],commands=[],navigation=[];
let role="gm",shared=null,queued={pending:0,failed:0},dialog=null,compound=null;
const document={activeElement:null,querySelector:selector=>selector==="dialog[open]"?dialog:null,
  addEventListener(type,handler,capture){events.set(`document:${type}:${Boolean(capture)}`,handler);}};
class Element{
  constructor(id=""){this.id=id;this.dataset={};this.hidden=false;this.style={};this.attributes={};this.controls={};this.disabled=false;
    const classes=new Set();this.classList={add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)};}
  addEventListener(type,handler,capture){events.set(`${this.id}:${type}:${Boolean(capture)}`,handler);}
  setAttribute(name,value){this.attributes[name]=String(value);}
  removeAttribute(name){delete this.attributes[name];}
  querySelector(selector){return this.controls[selector]||null;}
  focus(){document.activeElement=this;}
  getBoundingClientRect(){return {left:400,right:440,top:300,bottom:340,width:40,height:40};}
  closest(selector){return selector==="[data-scene-cell]"?{dataset:{sceneCell:"3,2"}}:null;}
  set innerHTML(html){
    this.html=html;this.controls={};document.activeElement=null;
    const value=html.match(/id="token-hud-health-input"[^>]*value="([^"]*)"/);
    if(value){const input=new Element("input");input.value=value[1];this.controls.input=input;
      const form=new Element("form"),submit=new Element("submit");form.controls['button[type="submit"]']=submit;this.controls.form=form;}
    const status=new Element("status");status.textContent="";this.controls[".token-hud-status"]=status;
    for(const action of ["target","cockpit","inspect","close","more"]){
      if(html.includes(`data-token-hud-action="${action}"`)){const control=new Element(action);control.dataset.tokenHudAction=action;this.controls[`[data-token-hud-action="${action}"]`]=control;}
    }
  }
  get offsetWidth(){return 266;}
  get offsetHeight(){return 145;}
}
const elements=new Map(["scene-board","scene-context-menu","scene-board-wrap","scene-sync-status"].map(id=>[id,new Element(id)]));
const board=elements.get("scene-board"),menu=elements.get("scene-context-menu"),wrap=elements.get("scene-board-wrap"),token=new Element("token");
token.dataset.sceneActor="enemy";
board.querySelector=selector=>selector==='[data-scene-actor="enemy"]'?token:null;
wrap.getBoundingClientRect=()=>({left:100,right:1000,top:100,bottom:800});
const context={console,document,innerWidth:1200,innerHeight:900,CSS:{escape:String},$:id=>elements.get(id),
  store:{mode:"play"},sceneContextTarget:null,S:{id:"owned"},Sync:{state:()=>({sceneId:shared})},esc:String,clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),
  activeSceneView:()=>role,isEnglishPreview:()=>false,usingNextSceneInterface:()=>context.interfaceVersion==="next",
  networkV2QueueStatus:()=>queued,SceneEngine:{compoundEnemyStatus:()=>compound||{active:false}},hideSceneTokenTip:()=>{},
  persist:()=>{},renderScene:()=>{},setScenePanel:panel=>navigation.push(panel),openSceneActorCockpit:id=>navigation.push(id),
  toggleSceneTarget:id=>{context.Scene.targetIds=context.Scene.targetIds.includes(id)?context.Scene.targetIds.filter(value=>value!==id):context.Scene.targetIds.concat(id);},
  showSceneContextMenu:(event,target)=>navigation.push({event,target}),
  lwSubmit:(id,payload)=>{commands.push({id,payload});if(shared){queued.pending++;return {pending:true};}context.Scene.actors.find(actor=>actor.id===id).hp=payload.amount;return {events:[]};},
  setNarratorActorValue:(actor,key,value)=>{commands.push({id:actor.id,key,value});actor[key]=value;return {events:[]};},
  requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},
  MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}},
};
context.window={addEventListener(type,handler){events.set(`window:${type}`,handler);}};
vm.createContext(context);
const sceneUiSource=read("scene-ui.js");
vm.runInContext(sceneUiSource.slice(sceneUiSource.indexOf("function sceneNumericCorrectionReason("),sceneUiSource.indexOf("function narratorActorValue(")),context);
const identitySource=read("lionwing-ui.js");
vm.runInContext(identitySource.slice(identitySource.indexOf("function lwGeometrySceneIdentity("),identitySource.indexOf("function lwApplyGeometryPreviewCells(")),context);
vm.runInContext(read("scene-token-hud.js"),context,{filename:"actual token HUD"});
const hud=context.window.DAWN_SCENE_TOKEN_HUD;
const reset=()=>{
  hud.close();role="gm";shared=null;queued={pending:0,failed:0};dialog=null;compound=null;commands.length=0;navigation.length=0;frames.length=0;
  context.store.mode="play";context.interfaceVersion="next";
  context.Scene={id:"local-a",name:"Test",rulesEdition:"lionwing",activeActorId:"hero",selectedActor:"hero",activeSpace:"main",targetIds:["hero"],targetCells:["1,1"],
    spaces:[{id:"main",width:8,height:6}],lionwing:{sceneSerial:1},actors:[{id:"hero",heroId:"owned",name:"Hero",space:"main",hp:30,maxHp:30},{id:"enemy",name:"Enemy",space:"main",x:3,y:2,hp:30,maxHp:30}]};
};
const enemy=()=>context.Scene.actors[1],open=()=>hud.show(enemy());
const input=()=>menu.querySelector("input"),status=()=>menu.querySelector(".token-hud-status").textContent;
const apply=text=>{input().value=text;return hud.applyHealth();};
const key=(name,target={matches:()=>false})=>{const event={key:name,target,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};events.get("document:keydown:true")(event);return event;};
const resources=()=>JSON.stringify({active:context.Scene.activeActorId,selected:context.Scene.selectedActor,targets:context.Scene.targetIds,cells:context.Scene.targetCells,hp:context.Scene.actors.map(actor=>actor.hp)});

reset();const before=resources();open();assert.equal(resources(),before,"right-click controls do not switch the caster or clear targets");
context.Scene.selectedActor="enemy";assert.equal(apply("-5"),true);assert.equal(commands[0].id,"enemy","health correction remains pinned to the opened token");
assert.deepEqual(JSON.parse(JSON.stringify(commands[0].payload)),{kind:"correct",resource:"hp",amount:25});assert.equal(enemy().hp,25);
assert.equal(apply("+2"),true);assert.equal(enemy().hp,27);assert.equal(apply("18"),true);assert.equal(enemy().hp,18);
for(const value of ["", "1.5", "1e2", "--5", "10000", "NaN"]){assert.equal(apply(value),false,`invalid health is rejected: ${value}`);}
assert.equal(commands.length,3);assert.match(status(),/Введите число/);
assert.equal(apply("-50"),true);assert.equal(enemy().hp,0,"health does not become negative");

reset();open();input().value="15";document.activeElement=input();enemy().hp=20;hud.refresh();
assert.equal(input().value,"15","background renders preserve an unfinished edit");assert.equal(hud.applyHealth(),false);
assert.equal(commands.length,0);assert.equal(input().value,"20");assert.match(status(),/уже изменилось/);
input().value="-3";enemy().hp=17;assert.equal(hud.applyHealth(),true);assert.equal(enemy().hp,14,"signed edits use the latest confirmed health");
reset();open();input().value="-5";document.activeElement=menu.querySelector("form").querySelector('button[type="submit"]');hud.refresh();
assert.equal(input().value,"-5","Tab to Apply and a background refresh do not discard the draft");
hud.action("target");assert.equal(input().value,"-5","targeting preserves an unfinished health edit");assert.equal(hud.applyHealth(),true);assert.equal(enemy().hp,25);
assert.equal(document.activeElement,input(),"Enter keeps the health editor ready for another edit");

reset();shared="table-a";open();assert.equal(apply("-5"),true);assert.equal(enemy().hp,30,"shared corrections wait for the canonical update");
assert.equal(menu.querySelector("form").querySelector('button[type="submit"]').disabled,true);assert.match(status(),/Сохранение/);
assert.equal(apply("-5"),false);assert.equal(commands.length,1,"a second delta cannot be derived from unconfirmed health");
enemy().hp=25;queued.pending=0;hud.refresh();assert.equal(apply("-5"),true);assert.equal(commands[1].payload.amount,20);
queued.pending=0;queued.failed=1;hud.refresh();assert.equal(apply("-5"),false);assert.equal(commands.length,2);assert.match(status(),/несохранённые/);
queued.failed=0;hud.refresh();assert.equal(menu.querySelector("form").querySelector('button[type="submit"]').disabled,false);

reset();open();role="player";assert.equal(apply("-5"),false);assert.equal(commands.length,0,"a role change cannot retain write access");
hud.refresh();assert.equal(input(),null);assert.ok(!menu.html.includes('data-token-hud-action="cockpit"'),"other players get Info and Target only");

reset();context.Scene.rulesEdition="ru-v0.9";open();assert.equal(apply("-2"),true);assert.equal(commands[0].key,"hp","legacy corrections retain the existing engine route");
reset();compound={active:true,hp:24,maxHp:60};open();assert.equal(input().value,"24");apply("-4");assert.equal(commands[0].payload.amount,20,"compound health is edited as one existing correction");

reset();open();const savedSelection=context.Scene.selectedActor;hud.action("target");
assert.equal(context.Scene.selectedActor,savedSelection);assert.deepEqual(context.Scene.targetIds,["hero","enemy"]);assert.deepEqual(context.Scene.targetCells,["1,1"]);
assert.equal(key("t").stopped,true);assert.deepEqual(context.Scene.targetIds,["hero"]);
assert.equal(key("t",{matches:selector=>selector.includes("input")}).prevented,undefined,"typing does not trigger targeting");
dialog={};key("t");assert.deepEqual(context.Scene.targetIds,["hero"],"a modal owns keyboard input");dialog=null;
enemy().knockedOut=true;hud.action("target");assert.deepEqual(context.Scene.targetIds,["hero"],"keyboard cannot target a knocked out actor");
hud.action("cockpit");assert.equal(navigation[0],"enemy");assert.equal(menu.hidden,true);

reset();open();hud.action("inspect");assert.equal(context.Scene.selectedActor,"enemy");assert.equal(navigation[0],"inspector");assert.deepEqual(context.Scene.targetIds,["hero"]);
reset();open();hud.action("more");assert.equal(navigation[0].target.actor.id,"enemy");assert.equal(menu.classList.contains("is-token-hud"),false);assert.equal(menu.attributes.role,"menu");

reset();open();input().value="-5";
assert.equal(key("Escape",{matches:()=>true}).stopped,true,"Escape closes HUD even while editing health");
assert.equal(menu.hidden,true);assert.equal(commands.length,0,"dismissing an unfinished edit does not apply it");
assert.equal(menu.style.maxHeight,"","HUD height limit does not leak into the shared context menu");
assert.equal(document.activeElement,token,"keyboard dismissal returns focus to the token");
reset();open();dialog={};key("Escape");assert.equal(menu.hidden,false,"a modal retains Escape ownership");dialog=null;
const originalTokenRect=token.getBoundingClientRect;
token.getBoundingClientRect=()=>({left:400,right:440,top:775,bottom:815,width:40,height:40});
hud.refresh();assert.ok(Number.parseFloat(menu.style.top)+menu.offsetHeight<=792,"HUD stays inside the field bottom margin");
assert.equal(menu.style.maxHeight,"684px","HUD height is bounded by the visible field");
token.getBoundingClientRect=originalTokenRect;

for(const change of [()=>{context.Scene.id="local-b";},()=>{shared="table-b";},()=>{context.Scene.lionwing.sceneSerial++;},()=>{context.Scene.actors.pop();},()=>{context.store.mode="hero";}]){
  reset();open();change();assert.equal(hud.applyHealth(),undefined);assert.equal(menu.hidden,true);assert.equal(commands.length,0,"stale token binding cannot write to a different scene");
}

reset();context.interfaceVersion="classic";
const rightClick={target:{closest:()=>token},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
events.get("scene-board:contextmenu:true")(rightClick);assert.equal(rightClick.prevented,undefined,"the optional HUD does not replace classic control");
context.interfaceVersion="next";events.get("scene-board:contextmenu:true")(rightClick);assert.equal(rightClick.stopped,true);assert.equal(menu.dataset.tokenHudActor,"enemy");
for(const observer of observers)observer.callback();assert.equal(frames.length,1,"render and network updates coalesce into one HUD refresh");frames.shift()();
assert.ok(menu.attributes.role==="dialog");hud.close();assert.equal(menu.dataset.tokenHudActor,undefined);
console.log("Token HUD: actor binding, authority, canonical HP edits, target independence, keyboard and lifecycle OK");

// Exercise the real shared numeric correction entry point used by Hero, Info
// and cockpit controls. Relative typed resource operations remain queueable.
Object.assign(context,{lwDraftEnabled:false,lwCanNarrate:()=>true,lwOwns:()=>true,toast:()=>false,currentHeroActor:()=>enemy(),
  LionwingEngine:{prepare:(scene,payload)=>({ok:true,events:[payload]})},
  commitSceneEvents:(label,submitted)=>{commands.push(submitted[0]);if(shared)queued.pending++;return {pending:Boolean(shared)};}});
context.window.DAWN_LIONWING_ENGINE={isScene:()=>true};
const heroUiSource=read("hero-ui.js");
vm.runInContext(heroUiSource.slice(heroUiSource.indexOf("function heroSheetLinkedActor("),heroUiSource.indexOf("function heroSheetTableButton(")),context);
vm.runInContext(identitySource.slice(identitySource.indexOf("function lwSubmit("),identitySource.indexOf("function lwDiceHtml(")),context);
const playEvents=read("app-play-events.js");
vm.runInContext(playEvents.slice(playEvents.indexOf("function setPlayCounter("),playEvents.indexOf('$("play-counters").addEventListener')),context);
for(const payload of [{kind:"correct",resource:"hp",amount:25},{kind:"correct",resource:"wounds",amount:1},{kind:"correct",resource:"stress",amount:1},
  {kind:"tension",amount:2},{kind:"configure-resource",id:"test",value:2},{kind:"clock",id:"test",value:2}]){
  reset();shared="table-a";context.lwSubmit("enemy",payload);assert.equal(context.lwSubmit("enemy",payload),false);assert.equal(commands.length,1,"absolute corrections cannot be based on the same pending value");
}
reset();shared="table-a";context.Scene.actors[0].team="hero";context.setPlayCounter("influence",2);context.setPlayCounter("influence",2);
assert.equal(commands.length,1,"Hero +/- shares the guard");assert.equal(commands[0].actorId,"hero","a delegated action actor cannot redirect the visible Hero counter");
queued.pending=0;context.Scene.actors[0].influence=2;context.setPlayCounter("influence",3);assert.equal(commands.length,2);
reset();shared="table-a";context.lwSubmit("enemy",{kind:"resource",resource:"focus",operation:"gain",amount:1});context.lwSubmit("enemy",{kind:"resource",resource:"focus",operation:"gain",amount:1});
assert.equal(commands.length,2,"relative engine commands can safely compose in the same tick");
console.log("Shared numeric corrections: Hero/Info/cockpit guard preserves deltas until server acknowledgement");
