import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8").replaceAll("\r\n","\n");
const frames=[],scrollCalls=[],focusCalls=[],historyCalls=[];
let view="gm",viewport="desktop";
class Element {
  constructor(tagName="div",{id="",className="",dataset={}}={}){
    this.tagName=tagName.toUpperCase();this.id=id;this.className=className;this.dataset=dataset;
    this.children=[];this.parentElement=null;this.hidden=false;this.open=false;
    this.scrollTop=0;this.scrollLeft=0;this.scrollHeight=200;this.clientHeight=200;this.scrollWidth=200;this.clientWidth=200;
    this.computed={display:"block",visibility:"visible",overflow:"visible",overflowX:"visible",overflowY:"visible"};
    this.style={setProperty(){},removeProperty(){}};
    this.classList={
      contains:name=>this.className.split(" ").includes(name),
      add:(...names)=>{this.className=[...new Set([...this.className.split(" ").filter(Boolean),...names])].join(" ");},
      remove:(...names)=>{this.className=this.className.split(" ").filter(name=>name&&!names.includes(name)).join(" ");},
      toggle:(name,force)=>{const enabled=force??!this.classList.contains(name);enabled?this.classList.add(name):this.classList.remove(name);return enabled;},
    };
  }
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  matches(selector){
    if(selector==="*")return true;
    if(selector.startsWith("."))return this.classList.contains(selector.slice(1));
    const attribute=selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if(attribute){
      const name=attribute[1],expected=attribute[2];
      const value=name==="id"?(this.id||undefined):name==="hidden"?(this.hidden?"":undefined):name.startsWith("data-")?this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]:undefined;
      return expected===undefined?value!==undefined:String(value)===expected;
    }
    return this.tagName===selector.toUpperCase();
  }
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  querySelectorAll(selector){
    const selectors=selector.split(",").map(value=>value.trim());
    const descendants=this.children.flatMap(child=>[child,...child.querySelectorAll("*")]);
    return descendants.filter(element=>selectors.some(item=>{
      const parts=item.split(" ");
      return parts.length===1?element.matches(item):element.matches(parts.at(-1))&&element.parentElement?.closest(parts[0]);
    }));
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  setAttribute(){}
  focus(){focusCalls.push(this.id||this.dataset.closeScenePanel);document.activeElement=this;}
  get isConnected(){return Boolean(this.closest("body"));}
}
class Details extends Element {constructor(options){super("details",options);}}
const body=new Element("body"),pages=new Map(),panels=new Map();
const document={body,activeElement:null,querySelector:selector=>body.querySelector(selector),querySelectorAll:selector=>body.querySelectorAll(selector),getElementById:id=>body.querySelectorAll("[id]").find(element=>element.id===id)||null};
for(const mode of ["build","play","tools","rules","reference"]){const page=new Element("section",{className:mode==="build"?"mode-page active":"mode-page",dataset:{page:mode}});body.append(page);pages.set(mode,page);}
const sidebar=new Element("aside",{className:"sidebar"});body.append(sidebar);
const workbench=new Element("div",{id:"scene-workbench"}),left=new Element("aside",{id:"scene-rail-left"}),right=new Element("aside",{id:"scene-rail-right"}),board=new Element("div",{id:"scene-board-wrap"});
pages.get("play").append(workbench);workbench.append(left,board,right);
for(const [id,restricted] of [["director",true],["inspector",false],["sheet",false],["map",true],["network",false]]){
  const panel=id==="network"?new Details({id:`panel-${id}`,dataset:{scenePanelContent:id}}):new Element("section",{id:`panel-${id}`,className:restricted?"panel gm-only":"panel",dataset:{scenePanelContent:id}});
  panel.append(new Element("button",{id:`close-${id}`,dataset:{closeScenePanel:""}}));right.append(panel);panels.set(id,panel);
}
function scroller(element,{top=0,left=0}={}){element.scrollHeight=1100;element.scrollWidth=1400;element.scrollTop=top;element.scrollLeft=left;element.computed.overflow="auto";return element;}
scroller(left);scroller(right);scroller(board);
for(const panel of panels.values())scroller(panel);
const director=new Element("div",{id:"scene-director"});panels.get("director").append(director);
let actionList=scroller(new Element("div",{className:"core-action-list"}));director.append(actionList);
const rulesIndex=scroller(new Element("nav",{id:"rules-index"}));pages.get("rules").append(rulesIndex);
scroller(sidebar);
const location={hash:"",pathname:"/companion/index.html",search:"?lang=ru&edition=lionwing&mode=tools"};
const history={state:{localRoute:"same"},replaceState(state,title,url){
  const target=new URL(url,"https://example.test");
  location.pathname=target.pathname;location.search=target.search;location.hash=target.hash;
  historyCalls.push({state,title,url});
}};
const window={scrollX:0,scrollY:0,
  scrollTo(position){this.scrollX=position.left??this.scrollX;this.scrollY=position.top??this.scrollY;scrollCalls.push(position);},
  getComputedStyle(element){return{...element.computed,display:element.closest("[hidden]")||view==="player"&&element.closest(".gm-only")?"none":element.computed.display};},
};
const state={id:"table-a",view:"gm",pendingAction:{id:"attack",actorId:"enemy",reactions:[]},pendingPrompt:{id:"rule"},lionwing:{choices:[{id:"choose",options:["one","two"]}]},targetIds:["enemy"]};
const frozen=object=>{for(const value of Object.values(object))if(value&&typeof value==="object")frozen(value);return Object.freeze(object);};
frozen(state);
const context={window,document,location,history,HTMLElement:Element,HTMLDetailsElement:Details,
  requestAnimationFrame:callback=>frames.push(callback),activeSceneView:()=>view,sceneViewportProfile:()=>viewport,
  $:id=>document.getElementById(id),$$:selector=>document.querySelectorAll(selector),state,
  localStorage:{getItem(){throw Error("Navigation must not read persistence");},setItem(){throw Error("Navigation must not write persistence");}},
};
vm.createContext(context);
vm.runInContext("let store={mode:'build'},Scene=state,activeScenePanel=null,activeScenePanels={left:null,right:null},scenePanelTrigger=null;let sceneInterfaceVersion='next',sceneLeftPanelsEnabled=true,scenePanelLayoutMode='split',sceneInterfaceDensity='compact';const scenePanelWidths={left:'medium',right:'medium'},SCENE_PANEL_WIDTHS={medium:340},DEFAULT_SCENE_PANEL_SIDES={director:'left',inspector:'right',sheet:'right',map:'right',network:'right'},scenePanelSides={...DEFAULT_SCENE_PANEL_SIDES};let lwTechniqueDraft={actorId:'hero',payload:{targetIds:['enemy']}},pendingCoreAction={id:'spell'};",context);
const sceneUi=read("scene-ui.js"),panelStart=sceneUi.indexOf("function usingNextSceneInterface()"),panelEnd=sceneUi.indexOf("function sceneTurnApprovalMode()",panelStart);
assert.ok(panelStart>=0&&panelEnd>panelStart,"the test exercises the actual Scene panel controller");
vm.runInContext(sceneUi.slice(panelStart,panelEnd),context);
vm.runInContext(read("app-navigation.js"),context);
const nav=window.DAWN_APP_NAVIGATION,run=script=>vm.runInContext(script,context),plain=value=>JSON.parse(JSON.stringify(value));
const immutable=run("JSON.stringify({Scene,lwTechniqueDraft,pendingCoreAction})");
const flush=()=>{while(frames.length){const callbacks=frames.splice(0);for(const callback of callbacks)callback();}};
const activate=mode=>{run(`store.mode=${JSON.stringify(mode)}`);for(const [id,page]of pages)page.classList.toggle("active",id===mode);};
const modeChange=(mode,{render=()=>{},restoreScroll=true,explicitHash=true,routeHash}={})=>{
  nav.beforeModeChange(run("store.mode"),mode);activate(mode);
  if(routeHash!==undefined)location.hash=routeHash;
  if(mode!=="play")run("setScenePanel(null)");
  render();const restored=nav.afterModeChange(mode,{restoreScroll,explicitHash});
  if(!restored)window.scrollTo({top:0,left:0,behavior:"auto"});
  return restored;
};

assert.equal(nav.afterModeChange("rules"),false,"restoration needs a real matching mode transition");
assert.equal(modeChange("play"),false,"an unseen section retains its normal first-entry position");flush();
run("setScenePanel('director');setScenePanel('inspector')");flush();
window.scrollTo({left:8,top:360});left.scrollTop=115;right.scrollTop=240;board.scrollTop=88;board.scrollLeft=470;actionList.scrollTop=72;panels.get("director").scrollTop=61;
assert.equal(modeChange("rules"),false);flush();
window.scrollTo({top:1530});rulesIndex.scrollLeft=124;sidebar.scrollTop=95;
assert.equal(modeChange("play",{render:()=>{
  left.scrollTop=0;right.scrollTop=0;board.scrollTop=0;board.scrollLeft=0;
  actionList.remove();actionList=scroller(new Element("div",{className:"core-action-list"}));director.append(actionList);
}}),true);
flush();
assert.deepEqual(plain(run("activeScenePanels")),{left:"director",right:"inspector"},"both sides reopen after leaving the Table");
assert.equal(run("activeScenePanel"),"inspector","the previously active side remains active");
assert.equal(window.scrollY,360);assert.equal(window.scrollX,8);
assert.equal(left.scrollTop,115);assert.equal(right.scrollTop,240);assert.equal(board.scrollTop,88);assert.equal(board.scrollLeft,470);
assert.equal(actionList.scrollTop,72,"a rendered replacement retains its anonymous inner scroll position");
assert.equal(panels.get("director").scrollTop,61,"panel scroll is restored after the real controller resets it");
assert.equal(modeChange("rules"),true);flush();
assert.equal(window.scrollY,1530);assert.equal(rulesIndex.scrollLeft,124);assert.equal(sidebar.scrollTop,95,"the shared sidebar has a separate position in each section");

// A delayed frame from the section just left must never move the next section.
window.scrollTo({top:1750});modeChange("play");
assert.equal(modeChange("reference"),false);window.scrollTo({top:625});flush();
assert.equal(window.scrollY,625,"an obsolete restoration is cancelled on rapid navigation");
modeChange("play");flush();assert.equal(window.scrollY,360,"a skipped restore cannot overwrite the saved Table position");
modeChange("tools");flush();window.scrollTo({top:910});modeChange("build");flush();window.scrollTo({top:280});
modeChange("tools");flush();assert.equal(window.scrollY,910);modeChange("build");flush();assert.equal(window.scrollY,280);

// Exercise the actual panel controller across adjustable viewport profiles.
modeChange("play");flush();
viewport="desktop";
run("closeAllScenePanels();setScenePanel('director');setScenePanel('inspector')");flush();
assert.deepEqual(plain(run("activeScenePanels")),{left:"director",right:"inspector"},"desktop preserves both configured sides");
for(const profile of ["phone","phone-landscape"]){
  viewport=profile;
  run("closeAllScenePanels();setScenePanel('director')");flush();
  assert.deepEqual(plain(run("activeScenePanels")),{left:"director",right:null},`${profile} opens the left task alone`);
  run("setScenePanel('inspector')");flush();
  assert.deepEqual(plain(run("activeScenePanels")),{left:null,right:"inspector"},`${profile} replaces the left task with the right task`);
  assert.equal(panels.get("director").classList.contains("rail-active"),false);
  for(const active of ["director","inspector"]){
    viewport="desktop";
    run(`closeAllScenePanels();setScenePanel('director');setScenePanel('inspector');setScenePanel('${active}')`);flush();
    assert.deepEqual(plain(run("activeScenePanels")),{left:"director",right:"inspector"});
    viewport=profile;run("syncScenePanels()");flush();
    assert.deepEqual(plain(run("activeScenePanels")),active==="director"?{left:"director",right:null}:{left:null,right:"inspector"},`${profile} resize retains the active task only`);
    assert.equal(run("activeScenePanel"),active);
  }
}
run("sceneInterfaceVersion='classic'");
for(const profile of ["desktop","phone","phone-landscape"]){
  viewport=profile;
  run("closeAllScenePanels();setScenePanel('director');setScenePanel('inspector');syncScenePanels()");flush();
  assert.deepEqual(plain(run("activeScenePanels")),{left:null,right:"inspector"},`classic stays single-sided on ${profile}`);
  assert.equal(run("activeScenePanel"),"inspector");
}
viewport="desktop";
run("sceneInterfaceVersion='next';closeAllScenePanels();setScenePanel('director');setScenePanel('inspector')");flush();

modeChange("play");flush();modeChange("rules");flush();view="player";
modeChange("play");flush();
assert.deepEqual(plain(run("activeScenePanels")),{left:null,right:"inspector"},"a Narrator panel cannot be restored after a role downgrade");
assert.equal(panels.get("director").classList.contains("rail-active"),false);
view="gm";run("setScenePanel('director');setScenePanel('inspector')");flush();
modeChange("rules");flush();run("scenePanelLayoutMode='right'");modeChange("play");flush();
assert.deepEqual(plain(run("activeScenePanels")),{left:null,right:"inspector"},"the active panel wins when a changed layout has only one side");
run("scenePanelLayoutMode='split';setScenePanel('director');setScenePanel('inspector')");flush();
modeChange("rules");flush();run("sceneInterfaceVersion='classic'");modeChange("play");flush();
assert.equal(run("activeScenePanel"),"inspector","classic layout restores a single currently legal panel");
run("sceneInterfaceVersion='next';setScenePanel('director');setScenePanel('inspector')");flush();
modeChange("rules");flush();panels.get("inspector").remove();modeChange("play");flush();
assert.equal(run("activeScenePanel"),"director","a removed panel is skipped instead of opening a phantom side");
assert.equal(run("activeScenePanels.right"),null);
run("closeAllScenePanels()");modeChange("rules");flush();modeChange("play");flush();
assert.equal(run("activeScenePanel"),null,"intentionally closed panels stay closed");

// Explicit anchors keep the normal deep-link behavior without abandoning inner scroll.
modeChange("rules");flush();window.scrollTo({top:2200});rulesIndex.scrollLeft=180;modeChange("tools");flush();
location.hash="#rules-damage";
const callCount=scrollCalls.length;
nav.beforeModeChange("tools","rules");activate("rules");rulesIndex.scrollLeft=0;
assert.equal(nav.afterModeChange("rules"),false,"a changed URL anchor has priority over the remembered reading position");
flush();assert.equal(scrollCalls.length,callCount,"the caller remains responsible for scrolling to the requested anchor");assert.equal(rulesIndex.scrollLeft,180);
window.scrollTo({top:2300});modeChange("tools");flush();nav.beforeModeChange("tools","rules");activate("rules");
const explicitCalls=scrollCalls.length;
assert.equal(nav.afterModeChange("rules",{restoreScroll:false}),false);flush();assert.equal(scrollCalls.length,explicitCalls,"explicit navigation can opt out of page restoration");
modeChange("tools");flush();nav.beforeModeChange("tools","rules");activate("rules");
assert.equal(nav.afterModeChange("rules"),true);
location.hash="#rules-later";const changedBeforeFrame=scrollCalls.length;flush();
assert.equal(scrollCalls.length,changedBeforeFrame,"a URL anchor selected before the restore frame cannot be overwritten");

// Top navigation does not supply a new anchor. Each section retains its own.
modeChange("tools",{routeHash:""});flush();window.scrollTo({top:1020});sidebar.scrollTop=80;
modeChange("rules",{routeHash:"#rules-another-chapter"});flush();window.scrollTo({top:2400});sidebar.scrollTop=45;
const previousHistory=historyCalls.length,queryBeforeReturn=location.search;
assert.equal(modeChange("tools",{explicitHash:false}),true,"returning through top navigation restores Tools even while the URL still names a Rule chapter");
assert.equal(location.hash,"","the Rule chapter anchor is removed when Tools had no anchor");
assert.equal(location.search,queryBeforeReturn,"restoring an anchor preserves the current mode/edition/locale query");
assert.equal(historyCalls.length,previousHistory+1);assert.equal(historyCalls.at(-1).state,history.state,"local history state is preserved");
flush();assert.equal(window.scrollY,1020);assert.equal(sidebar.scrollTop,80);
modeChange("rules",{explicitHash:false});flush();assert.equal(location.hash,"#rules-another-chapter");assert.equal(window.scrollY,2400);

// On boot, store.mode can already name a URL destination while build is still visible.
const initialContext={...context,window:{...window},document,location:{hash:"#rules-start"}};
vm.createContext(initialContext);
for(const [id,page]of pages)page.classList.toggle("active",id==="build");
vm.runInContext("let store={mode:'rules'}",initialContext);vm.runInContext(read("app-navigation.js"),initialContext);
const initialNav=initialContext.window.DAWN_APP_NAVIGATION;initialNav.beforeModeChange("rules","rules");
pages.get("rules").classList.add("active");
assert.equal(initialNav.afterModeChange("rules"),false,"a hidden initial page cannot create a false bookmark that suppresses a launch anchor");
assert.equal(run("JSON.stringify({Scene,lwTechniqueDraft,pendingCoreAction})"),immutable,"navigation leaves pending choices, actions, targets and drafts untouched");
console.log("Local section navigation: page/inner scroll, split panels, role/layout changes, rapid transitions, and anchor precedence passed.");

run("sceneLeftPanelsEnabled=false;scenePanelLayoutMode='split'");assert.equal(run("scenePanelSide('director')"),'right','old split preference is inactive until explicitly allowed');
run("sceneLeftPanelsEnabled=true");assert.equal(run("scenePanelSide('director')"),'left','explicit consent restores configured layout');
console.log('Left work panels: default/old split require explicit opt-in');
