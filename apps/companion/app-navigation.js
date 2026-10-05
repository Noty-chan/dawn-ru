"use strict";

// Section navigation remembers only local presentation state. Game drafts and
// pending decisions remain owned by their existing Scene/UI controllers.
window.DAWN_APP_NAVIGATION=(()=>{
  const modes=new Set(["build","play","tools","rules","reference"]),contexts=new Map();
  const scrollSelector="[id],[data-scene-panel-content],[data-navigation-scroll],div,section,aside,nav,ol,ul,pre,textarea,details";
  const maxScrollPositions=128;
  let revision=0,transition=null,scheduledRestore=null;

  const pageFor=mode=>document.querySelector(`[data-page="${mode}"]`);
  const number=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  const currentMode=()=>typeof store!=="undefined"?store.mode:null;
  const hash=()=>typeof location!=="undefined"?location.hash||"":"";
  const playerView=()=>typeof activeSceneView==="function"&&activeSceneView()==="player";
  const usable=element=>Boolean(element&&!element.hidden&&!element.closest("[hidden]")&&!(playerView()&&element.closest(".gm-only")));
  const panels=()=>[...document.querySelectorAll("[data-scene-panel-content]")];
  const panelFor=id=>panels().find(element=>element.dataset.scenePanelContent===id&&usable(element));
  const rootsFor=mode=>{
    const page=pageFor(mode),sidebar=mode!=="play"?document.querySelector(".sidebar"):null;
    return [page,sidebar].filter(element=>usable(element));
  };
  function scrollKey(element,root){
    const path=[];
    for(let node=element;node;node=node.parentElement){
      if(node.id){path.unshift(["id",node.id]);break}
      if(node.dataset?.scenePanelContent){path.unshift(["panel",node.dataset.scenePanelContent]);break}
      if(node.dataset?.navigationScroll){path.unshift(["scroll",node.dataset.navigationScroll]);break}
      if(node===root){path.unshift(["root",root.dataset?.page||"sidebar"]);break}
      const peers=[...(node.parentElement?.children||[])].filter(peer=>peer.tagName===node.tagName&&peer.className===node.className);
      path.unshift([node.tagName,node.className||"",peers.indexOf(node)]);
    }
    return JSON.stringify(path);
  }
  function scrollElements(mode){
    const entries=[];
    for(const root of rootsFor(mode))for(const element of [root,...root.querySelectorAll(scrollSelector)]){
      if(!usable(element))continue;
      const panel=element.closest("[data-scene-panel-content]");
      if(mode==="play"&&panel&&typeof isScenePanelOpen==="function"&&!isScenePanelOpen(panel.dataset.scenePanelContent))continue;
      if(!element.scrollTop&&!element.scrollLeft&&!(element.scrollHeight>element.clientHeight||element.scrollWidth>element.clientWidth))continue;
      const style=window.getComputedStyle?.(element);
      if(style&&(style.display==="none"||style.visibility==="hidden"))continue;
      if(style&&!element.scrollTop&&!element.scrollLeft&&![style.overflow,style.overflowX,style.overflowY].some(value=>["auto","scroll","overlay"].includes(value)))continue;
      entries.push({element,key:scrollKey(element,root)});
      if(entries.length>=maxScrollPositions)return entries;
    }
    return entries;
  }
  function capturePanels(){
    const open=typeof activeScenePanels!=="undefined"?{...activeScenePanels}:{left:null,right:null};
    const active=typeof activeScenePanel!=="undefined"?activeScenePanel:null;
    if(typeof usingNextSceneInterface==="function"&&!usingNextSceneInterface()){open.left=null;open.right=active;}
    return{left:open.left||null,right:open.right||null,active};
  }
  function restorePanels(saved){
    if(!saved||typeof closeAllScenePanels!=="function"||typeof setScenePanel!=="function")return;
    const ordered=[...new Set([saved.left,saved.right,saved.active].filter(Boolean))].filter(id=>panelFor(id));
    const active=ordered.includes(saved.active)?saved.active:ordered.at(-1);
    closeAllScenePanels();
    for(const id of ordered.filter(id=>id!==active))setScenePanel(id);
    if(active)setScenePanel(active);
  }
  function beforeModeChange(previousMode,nextMode){
    const awaitingRestore=scheduledRestore?.mode===previousMode&&scheduledRestore.revision===revision;
    revision+=1;transition=modes.has(nextMode)?{mode:nextMode,revision}:null;
    scheduledRestore=null;
    if(awaitingRestore||!modes.has(previousMode)||!pageFor(previousMode)?.classList.contains("active"))return;
    contexts.set(previousMode,{
      x:number(window.scrollX),y:number(window.scrollY),hash:hash(),
      scroll:scrollElements(previousMode).map(({element,key})=>({key,top:number(element.scrollTop),left:number(element.scrollLeft)})),
      panels:previousMode==="play"?capturePanels():null,
    });
  }
  function afterModeChange(mode,{restoreScroll=true,explicitHash=true}={}){
    const saved=contexts.get(mode),pending=transition;
    if(!saved||!pending||pending.mode!==mode||currentMode()!==mode||!pageFor(mode))return false;
    transition=null;
    if(mode==="play")restorePanels(saved.panels);
    // A top-navigation return restores this section's own anchor without a
    // hashchange or a scroll caused by an anchor from the section just left.
    if(!explicitHash&&saved.hash!==hash()&&typeof history!=="undefined"&&typeof history.replaceState==="function"){
      history.replaceState(history.state,"",`${location.pathname}${location.search}${saved.hash}`);
    }
    // A newly selected URL anchor wins over the remembered reading position.
    const plannedHash=hash(),restorePage=restoreScroll&&(!explicitHash||saved.hash===plannedHash);
    scheduledRestore={mode,revision:pending.revision};
    requestAnimationFrame(()=>{
      if(revision!==pending.revision||currentMode()!==mode)return;
      const positions=new Map(saved.scroll.map(position=>[position.key,position]));
      for(const{element,key}of scrollElements(mode)){
        const position=positions.get(key);if(!position)continue;
        element.scrollTop=position.top;element.scrollLeft=position.left;
      }
      if(restorePage&&plannedHash===hash())window.scrollTo({left:saved.x,top:saved.y,behavior:"instant"});
      scheduledRestore=null;
    });
    return restorePage;
  }
  return Object.freeze({beforeModeChange,afterModeChange});
})();
