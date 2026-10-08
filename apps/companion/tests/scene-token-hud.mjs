import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");
const events=new Map(),frames=[],observers=[],commands=[],navigation=[],timers=new Map();
let role="gm",shared=null,queued={pending:0,failed:0},dialog=null,compound=null,openPanel=null;
const document={activeElement:null,querySelector:selector=>selector==="dialog[open]"?dialog:null,
  addEventListener(type,handler,capture){events.set(`document:${type}:${Boolean(capture)}`,handler);}};
class Element{
  constructor(id=""){this.id=id;this.dataset={};this.hidden=false;this.style={setProperty(name,value){this[name]=value}};this.attributes={};this.controls={};this.disabled=false;
    const classes=new Set();this.classList={add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)};}
  addEventListener(type,handler,capture){events.set(`${this.id}:${type}:${Boolean(capture)}`,handler);}
  setAttribute(name,value){this.attributes[name]=String(value);}
  removeAttribute(name){delete this.attributes[name];}
  querySelector(selector){return this.controls[selector]||null;}
  contains(node){return Object.values(this.controls).includes(node);}
  insertAdjacentHTML(position,html){this.html+=html;if(html.includes('class="token-hud-effect-picker"'))this.controls[".token-hud-effect-picker"]=new Element("picker");for(const match of html.matchAll(/data-token-hud-(effect|action)="([^"]+)"/g)){const button=new Element(match[2]);button.dataset[match[1]==="effect"?"tokenHudEffect":"tokenHudAction"]=match[2];this.controls[`[data-token-hud-${match[1]}="${match[2]}"]`]=button;}}
  matches(selector){return this.id==="input"&&selector.includes("input");}
  select(){this.selectionStart=0;this.selectionEnd=this.value.length;}
  focus(){const old=document.activeElement;document.activeElement=this;if(old&&old!==this)events.get("scene-context-menu:focusout:false")?.({target:old});events.get("scene-context-menu:focusin:false")?.({target:this});}
  blur(){if(document.activeElement===this)document.activeElement=null;events.get("scene-context-menu:focusout:false")?.({target:this});}
  getBoundingClientRect(){return {left:400,right:440,top:300,bottom:340,width:40,height:40};}
  closest(selector){return selector==="[data-scene-cell]"?{dataset:{sceneCell:"3,2"}}:null;}
  set innerHTML(html){
    const old=document.activeElement;this.html=html;this.controls={};document.activeElement=null;if(old)events.get("scene-context-menu:focusout:false")?.({target:old});
    const value=html.match(/id="token-hud-health-input"[^>]*value="([^"]*)"/);
    if(value){const input=new Element("input");input.value=value[1];this.controls.input=input;}
    const status=new Element("status");status.textContent="";this.controls[".token-hud-status"]=status;
    for(const action of ["target","cockpit","inspect","close","more"]){
      if(html.includes(`data-token-hud-action="${action}"`)){const control=new Element(action);control.dataset.tokenHudAction=action;this.controls[`[data-token-hud-action="${action}"]`]=control;}
    }
  }
  get offsetWidth(){return Number.parseFloat(this.style.width)||266;}
  get offsetHeight(){return Number.parseFloat(this.style.height)||145;}
}
const elements=new Map(["scene-board","scene-context-menu","scene-board-wrap","scene-sync-status"].map(id=>[id,new Element(id)]));
const board=elements.get("scene-board"),menu=elements.get("scene-context-menu"),wrap=elements.get("scene-board-wrap"),token=new Element("token");
token.dataset.sceneActor="enemy";
board.querySelector=selector=>selector==='[data-scene-actor="enemy"]'?token:null;
wrap.getBoundingClientRect=()=>({left:100,right:1000,top:100,bottom:800});
const context={console,document,innerWidth:1200,innerHeight:900,CSS:{escape:String},$:id=>elements.get(id),
  store:{mode:"play"},sceneContextTarget:null,S:{id:"owned"},Sync:{state:()=>({sceneId:shared})},esc:String,clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),
  isScenePanelOpen:panel=>panel===openPanel,activeSceneView:()=>role,isEnglishPreview:()=>false,usingNextSceneInterface:()=>context.interfaceVersion==="next",
  networkV2QueueStatus:()=>queued,SceneEngine:{compoundEnemyStatus:()=>compound||{active:false}},hideSceneTokenTip:()=>{},
  sceneEffectList:()=>[{id:"positive.test",name:"Test effect"}],sceneActorEffects:actor=>actor.effects||[],
  setNarratorEffect:(actor,effect,remove)=>{commands.push({route:"setNarratorEffect",actorId:actor.id,effect,remove});return true;},
  persist:()=>{},renderScene:()=>{},setScenePanel:panel=>navigation.push(panel),openSceneActorCockpit:id=>navigation.push(id),
  toggleSceneTarget:id=>{context.Scene.targetIds=context.Scene.targetIds.includes(id)?context.Scene.targetIds.filter(value=>value!==id):context.Scene.targetIds.concat(id);},
  showSceneContextMenu:(event,target)=>navigation.push({event,target}),
  lwSubmit:(id,payload)=>{commands.push({id,payload});if(shared){queued.pending++;return {pending:true};}context.Scene.actors.find(actor=>actor.id===id).hp=payload.amount;return {events:[]};},
  setNarratorActorValue:(actor,key,value)=>{commands.push({id:actor.id,key,value});actor[key]=value;return {events:[]};},
  requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},
  setTimeout:callback=>{const id=timers.size+1;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
  MutationObserver:class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}},
};
context.window={addEventListener(type,handler){events.set(`window:${type}`,handler);}};
vm.createContext(context);
const sceneUiSource=read("scene-ui.js");
vm.runInContext(sceneUiSource.slice(sceneUiSource.indexOf("function sceneNumericCorrectionReason("),sceneUiSource.indexOf("function narratorActorValue(")),context);
const identitySource=read("lionwing-ui.js");
vm.runInContext(identitySource.slice(identitySource.indexOf("function lwGeometrySceneIdentity("),identitySource.indexOf("function lwApplyGeometryPreviewCells(")),context);
vm.runInContext(read("ui-icons.js"),context);
vm.runInContext(read("scene-token-hud.js"),context,{filename:"actual token HUD"});
const hud=context.window.DAWN_SCENE_TOKEN_HUD;
const reset=()=>{
  hud.close();document.activeElement=null;role="gm";shared=null;queued={pending:0,failed:0};dialog=null;compound=null;openPanel=null;context.innerWidth=1200;context.innerHeight=900;commands.length=0;navigation.length=0;frames.length=0;
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
reset();open();input().value="-5";document.activeElement=input();hud.refresh();
assert.equal(input().value,"-5","background refresh does not discard the draft");
hud.action("target");assert.equal(enemy().hp,25,"explicit focus departure to targeting applies the edit once");assert.equal(commands.length,1);
reset();enemy().hp=15;enemy().maxHp=16;open();assert.equal(apply("+5"),true);assert.equal(commands[0].payload.amount,16,"relative healing clamps to actual maximum before canonical correction");
assert.equal(hud.healthChange("20",15,16),20,"exact typed health retains canonical validation instead of silently clamping");
assert.equal(hud.healthChange("-50",15,16),0);assert.equal(hud.healthChange("+5",15,null),20,"unknown maximum does not invent a health cap");
reset();compound={active:true,hp:59,maxHp:60};open();assert.equal(apply("+5"),true);assert.equal(commands[0].payload.amount,60,"compound relative healing uses the shared health maximum");

reset();open();input().focus();hud.refresh();assert.equal(document.activeElement,input(),"refresh preserves health editing focus");

reset();shared="table-a";open();assert.equal(apply("-5"),true);assert.equal(enemy().hp,30,"shared corrections wait for the canonical update");
assert.equal(input().attributes["aria-busy"],"true");assert.match(status(),/Сохранение/);
assert.equal(apply("-5"),false);assert.equal(commands.length,1,"a second delta cannot be derived from unconfirmed health");
enemy().hp=25;queued.pending=0;hud.refresh();assert.equal(apply("-5"),true);assert.equal(commands[1].payload.amount,20);
queued.pending=0;queued.failed=1;hud.refresh();assert.equal(apply("-5"),false);assert.equal(commands.length,2);assert.match(status(),/несохранённые/);
queued.failed=0;hud.refresh();assert.equal(input().attributes["aria-busy"],"false");

reset();open();role="player";assert.equal(apply("-5"),false);assert.equal(commands.length,0,"a role change cannot retain write access");
hud.refresh();assert.equal(input(),null);assert.ok(!menu.html.includes('data-token-hud-action="effects"')&&!menu.html.includes('data-token-hud-action="more"'),"foreign Player token has Profile and Target only");assert.ok(!menu.html.includes('data-token-hud-action="cockpit"'),"other players get Info and Target only");

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
token.getBoundingClientRect=()=>({left:950,right:990,top:300,bottom:340,width:40,height:40});hud.refresh();
assert.ok(Number.parseFloat(menu.style.left)+Number.parseFloat(menu.style["--hud-right"])+44<=950,"right-edge controls move to the free side of the token");
token.getBoundingClientRect=originalTokenRect;
token.getBoundingClientRect=()=>({left:105,right:145,top:300,bottom:340,width:40,height:40});hud.refresh();
assert.ok(Number.parseFloat(menu.style.left)+Number.parseFloat(menu.style["--hud-left"])>=145,"at the left field edge controls move to the free side instead of painting the token centre");
assert.ok(Number.parseFloat(menu.style.left)+Number.parseFloat(menu.style["--hud-right"])+44<=992);
token.getBoundingClientRect=originalTokenRect;
for(const top of [100,775]){
  token.getBoundingClientRect=()=>({left:105,right:129,top,bottom:top+24,width:24,height:24});hud.refresh();
  const cap=Number.parseFloat(menu.style.top)+Number.parseFloat(menu.style["--hud-cap"]),row=Number.parseFloat(menu.style.top)+Number.parseFloat(menu.style["--hud-row"]);
  assert.equal(row-cap,48,"edge clamping keeps cap and first-row hit areas separated by 4px");
  assert.ok(cap>=108&&row+48+44<=792,"the entire three-button stack stays inside the visible field");
}
token.getBoundingClientRect=originalTokenRect;
const originalFieldRect=wrap.getBoundingClientRect;
wrap.getBoundingClientRect=()=>({left:100,right:1000,top:870,bottom:1200});
token.getBoundingClientRect=()=>({left:400,right:440,top:875,bottom:915,width:40,height:40});
hud.refresh();assert.equal(menu.hidden,false,"a clipped field uses an external compact panel");
assert.equal(menu.dataset.placement,"external");assert.ok(Number.parseFloat(menu.style.top)>=8);
wrap.getBoundingClientRect=originalFieldRect;token.getBoundingClientRect=originalTokenRect;

for(const change of [()=>{context.Scene.id="local-b";},()=>{shared="table-b";},()=>{context.Scene.lionwing.sceneSerial++;},()=>{context.Scene.actors.pop();},()=>{context.store.mode="hero";}]){
  reset();open();change();assert.equal(hud.applyHealth(),undefined);assert.equal(menu.hidden,true);assert.equal(commands.length,0,"stale token binding cannot write to a different scene");
}

reset();context.interfaceVersion="classic";
const rightClick={target:{closest:()=>token},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
events.get("scene-board:contextmenu:true")(rightClick);assert.equal(rightClick.prevented,undefined,"the optional HUD does not replace classic control");
context.interfaceVersion="next";events.get("scene-board:contextmenu:true")(rightClick);assert.equal(rightClick.stopped,true);assert.equal(menu.dataset.tokenHudActor,"enemy");
for(const observer of observers)observer.callback();assert.equal(frames.length,1,"render and network updates coalesce into one HUD refresh");frames.shift()();
assert.ok(menu.attributes.role==="dialog");hud.close();assert.equal(menu.dataset.tokenHudActor,undefined);

reset();context.Scene.selectedActor="enemy";context.Scene.tool="select";
const selectedBefore=resources(),selectedTokenEvent={target:{closest:()=>token}};
events.get("scene-board:click:false")(selectedTokenEvent);
assert.equal(menu.hidden,false,"a normal selected-token click shows the overlay without a right-click");
assert.equal(menu.dataset.tokenHudActor,"enemy");assert.equal(resources(),selectedBefore,"opening selection overlay preserves turn, targets and resources");
assert.equal(document.activeElement,null,"pointer selection does not steal keyboard focus into the HUD");
assert.equal(menu.dataset.placement,"around","controls form a perimeter around the token rather than a side card");
assert.ok(Number.parseFloat(menu.style.left)<token.getBoundingClientRect().left);
enemy().effects=["example.effect"];hud.refresh();assert.match(menu.html,/example.effect/,"active Effects appear in the visible overlay");
hud.close();hud.refresh();assert.equal(menu.hidden,true,"dismissal survives background refresh of the same selection");
events.get("scene-board:click:false")(selectedTokenEvent);assert.equal(menu.hidden,false,"selected token can reopen a dismissed overlay by touch/click");
events.get("scene-board:click:false")({target:{closest:()=>null}});hud.refresh();assert.equal(menu.hidden,true,"blank-field click dismisses without reopening on stale selection");
context.Scene.selectedActor=null;hud.refresh();context.Scene.selectedActor="enemy";hud.refresh();assert.equal(menu.hidden,false,"selection from an existing roster route can reveal the anchored overlay");
context.Scene.tool="measure";hud.refresh();assert.equal(menu.hidden,true,"selection overlay yields to map measurement/tool interaction");
context.Scene.tool="select";events.get("scene-board:click:false")(selectedTokenEvent);context.store.mode="tools";hud.refresh();assert.equal(menu.hidden,true,"leaving Table closes the overlay");
for(const [width,height,allowed] of [[1200,900,true],[800,900,true],[390,844,false],[844,390,false],[950,500,false],[951,500,true]]){
  reset();context.innerWidth=width;context.innerHeight=height;wrap.getBoundingClientRect=()=>({left:0,right:width,top:0,bottom:height});open();assert.equal(menu.hidden,!allowed,`HUD eligibility ${width}x${height}`);
}
wrap.getBoundingClientRect=originalFieldRect;reset();open();context.innerWidth=390;hud.refresh();assert.equal(menu.hidden,true,"resize to phone closes existing HUD");
reset();open();context.innerWidth=844;context.innerHeight=390;hud.refresh();assert.equal(menu.hidden,true,"resize to narrow landscape closes existing HUD");

reset();context.interfaceVersion="classic";context.Scene.selectedActor="enemy";events.get("scene-board:click:false")(selectedTokenEvent);assert.equal(menu.hidden,true,"classic interface remains unchanged");
reset();const hoverBefore=resources();
events.get("scene-board:mouseover:false")(selectedTokenEvent);
assert.equal(menu.hidden,false,"hover reveals perimeter controls without selecting, targeting or right-clicking");assert.equal(resources(),hoverBefore);
events.get("scene-board:mouseout:false")({target:selectedTokenEvent.target,relatedTarget:null});assert.equal(timers.size,1);
events.get("scene-context-menu:mouseenter:false")();assert.equal(timers.size,0,"moving from token to its controls cancels delayed dismissal");
input().focus();events.get("scene-context-menu:mouseleave:false")();for(const callback of [...timers.values()])callback();timers.clear();assert.equal(menu.hidden,false,"typing a health delta keeps the overlay open");
hud.action("effects");assert.match(menu.html,/data-token-hud-effect="positive.test"/);
menu.querySelector('[data-token-hud-effect="positive.test"]').focus();
const effectClick={target:{closest:selector=>selector==="[data-token-hud-effect]"?{dataset:{tokenHudEffect:"positive.test"}}:null},preventDefault(){},stopImmediatePropagation(){}};
events.get("scene-context-menu:click:true")(effectClick);assert.equal(commands[0].route,"setNarratorEffect");assert.equal(commands[0].actorId,"enemy");assert.equal(commands[0].effect,"positive.test");assert.equal(commands[0].remove,false);
assert.equal(document.activeElement,menu.querySelector('[data-token-hud-effect="positive.test"]'),"applying an Effect preserves keyboard position in the picker");
enemy().effects=["positive.test"];events.get("scene-context-menu:click:true")(effectClick);assert.equal(commands[1].remove,true,"active effect delegates removal to the existing compound-aware Narrator route");
role="player";events.get("scene-context-menu:click:true")(effectClick);assert.equal(commands.length,2,"players cannot apply or remove effects via the overlay");
role="gm";effectClick.target.closest=selector=>selector==="[data-token-hud-effect]"?{dataset:{tokenHudEffect:"unknown"}}:null;events.get("scene-context-menu:click:true")(effectClick);assert.equal(commands.length,2,"unknown stable effect IDs never reach the writer");
reset();open();assert.doesNotMatch(menu.html,/type="submit"/);assert.equal((menu.html.match(/<svg /g)||[]).length,5,"all five perimeter commands use authored SVG icons");input().focus();assert.equal(input().selectionStart,0);assert.equal(input().selectionEnd,2);
const originalInput=input();events.get("scene-context-menu:beforeinput:false")({target:originalInput,inputType:"insertText",data:"8"});assert.equal(originalInput.value,"","first insertion replaces current HP");originalInput.value="8";events.get("scene-context-menu:input:false")({target:originalInput});
key("Enter",originalInput);originalInput.blur();input().blur();assert.equal(commands.length,1,"Enter and ensuing detached/live blur apply exactly once");assert.equal(enemy().hp,8);
reset();open();input().focus();input().value="-5";const deltaInput=input();deltaInput.blur();deltaInput.blur();assert.equal(commands.length,1,"duplicate blur never repeats signed correction");assert.equal(enemy().hp,25);
reset();open();input().focus();input().value="-5";const stableInput=input(),effectButton=menu.querySelector('[data-token-hud-action="effects"]');
events.get("scene-context-menu:pointerdown:true")({target:effectButton});effectButton.focus();hud.refresh();
assert.equal(input(),stableInput,"health blur and queued Scene refresh cannot remove the pressed control before click");
events.get("document:pointerup:true")({target:effectButton});events.get("scene-context-menu:click:true")({target:{closest:selector=>selector==="[data-token-hud-action]"?effectButton:null},preventDefault(){},stopImmediatePropagation(){}});
assert.match(menu.html,/aria-expanded="true"/,"one pointer sequence both commits HP and opens Effects");assert.equal(commands.length,1);
// A bounded field between two task rails must not hide perimeter controls
// underneath the Effects picker; the list moves above/below and scrolls.
const fullFieldRect=wrap.getBoundingClientRect;
for(const [tokenTop,expectedSide] of [[300,"below"],[700,"above"]]){
  reset();wrap.getBoundingClientRect=()=>({left:300,right:600,top:100,bottom:800});
  token.getBoundingClientRect=()=>({left:400,right:440,top:tokenTop,bottom:tokenTop+40,width:40,height:40});
  open();hud.action("effects");
  const picker=menu.querySelector(".token-hud-effect-picker"),top=Number.parseFloat(picker.style.top),height=Number.parseFloat(picker.style.maxHeight),left=Number.parseFloat(picker.style.left),width=Number.parseFloat(picker.style.width);
  const menuTop=Number.parseFloat(menu.style.top),cap=menuTop+Number.parseFloat(menu.style["--hud-cap"]),healthTop=menuTop+Number.parseFloat(menu.style["--hud-health-top"]);
  if(expectedSide==="below")assert.ok(top>=Math.max(cap+140,healthTop+40)+6,"picker leaves all buttons and HP above it");
  else assert.ok(top+height<=Math.min(cap,healthTop)-6,"picker leaves all buttons and HP below it");
  assert.ok(left>=308&&left+width<=592&&top>=108&&top+height<=792,"picker stays inside the field");
}
wrap.getBoundingClientRect=fullFieldRect;token.getBoundingClientRect=()=>({left:400,right:440,top:300,bottom:340,width:40,height:40});

reset();open();input().focus();input().value="-5";const cancelInput=input();key("Escape",cancelInput);cancelInput.blur();assert.equal(commands.length,0,"Escape followed by blur never writes");
reset();open();input().focus();input().value="";key("Enter",input());input().blur();assert.equal(commands.length,0,"empty Enter/blur is a no-op");
reset();shared="table-a";open();input().focus();input().value="-5";const pendingInput=input();key("Enter",pendingInput);hud.refresh();assert.equal(input().value,"25","pending network correction stays visible until canonical acknowledgement");pendingInput.blur();input().blur();assert.equal(commands.length,1,"Enter/blur cannot duplicate a pending network delta");
for(const invalidate of [()=>role="player",()=>context.Scene.id="other",()=>context.Scene.actors.pop()]){reset();open();input().focus();input().value="-5";const staleInput=input();invalidate();staleInput.blur();assert.equal(commands.length,0,"stale scene/actor/role at blur cannot write");}
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
const playUi=read("play-ui.js");
Object.assign(context,{toolsManualMode:()=>false,toolsRuntimeActor:()=>context.Scene.actors[0],toolsSyncContext:()=>({shared:Boolean(shared),canEdit:true}),refreshFreeplayResourceUi:()=>{},updateAllInAvailability:()=>{},renderStressTrackers:()=>{}});
vm.runInContext(playUi.slice(playUi.indexOf("function toolsResourceCorrectionReason("),playUi.indexOf("function toolsResourceValue(")),context);
vm.runInContext(playUi.slice(playUi.indexOf("function setToolsResource("),playUi.indexOf("function freeplayBondStatus(")),context);
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
const overlayCss=read("vtt-cockpit.css").match(/\.scene-context-menu\.is-token-overlay\{([^}]+)\}/)?.[1];
assert.ok(overlayCss);for(const property of ["backdrop-filter:none","filter:none","transform:none"])assert.ok(overlayCss.includes(property),"transparent overlay must not blur its token or create a containing block for its fixed picker: "+property);
console.log("Shared numeric corrections: Hero/Info/cockpit guard preserves deltas until server acknowledgement");

// Every perimeter hit area must be outside the token and other controls.
const overlap=(a,b,gap=0)=>!(a.right+gap<=b.left||b.right+gap<=a.left||a.bottom+gap<=b.top||b.bottom+gap<=a.top);
let placements=0,fallbacks=0;
for(const manual of [false,true])for(const fieldWidth of [250,400,900])for(const size of [40,80,150])for(const factor of [.3,.7,1,1.8])for(const fx of [0,.5,1])for(const fy of [0,.5,1]){
  const field={left:300,right:300+fieldWidth,top:100,bottom:650},width=size*factor;
  const rect={left:field.left+fx*(fieldWidth-width),top:field.top+fy*(550-width)};rect.right=rect.left+width;rect.bottom=rect.top+width;
  context.window.DAWN_TABLE_POLICY={isManual:()=>manual};
  const result=hud.perimeterLayout(rect,field);if(!result){fallbacks++;continue;}
  placements++;
  const controls=(manual?[0,48]:[0,48,96]).flatMap(dy=>[result.leftControl,result.rightControl].map(x=>({left:x,right:x+44,top:result.controlTop+dy,bottom:result.controlTop+dy+44})));
  controls.push({left:result.healthLeft,right:result.healthLeft+80,top:result.healthTop,bottom:result.healthTop+40});
  for(const control of controls){assert.ok(!overlap(control,rect,6),'control is outside token with >=6px gutter');assert.ok(control.left>=field.left&&control.right<=field.right&&control.top>=field.top&&control.bottom<=field.bottom,'control is inside the visible field');}
  for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++)assert.ok(!overlap(controls[i],controls[j]),'controls cannot intersect');
}
assert.ok(placements>0&&fallbacks>0);console.log(`HUD geometry: ${placements} safe layouts, ${fallbacks} external fallbacks, 648 manual/rules edge/size/zoom cases`);
