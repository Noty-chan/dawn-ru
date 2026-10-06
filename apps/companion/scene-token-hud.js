"use strict";

// The token HUD is a local shortcut surface. Commands still use the existing
// actor-bound cockpit, targeting and Narrator correction routes.
(() => {
  const board=$("scene-board"),menu=$("scene-context-menu"),wrap=$("scene-board-wrap");
  if(!board||!menu||!wrap)return;
  let state=null,frame=null;
  const copy=(ru,en)=>typeof isEnglishPreview==="function"&&isEnglishPreview()?en:ru;
  const identity=()=>JSON.stringify([Sync?.state?.()?.sceneId||null,lwGeometrySceneIdentity(),Scene.lionwing?.sceneSerial??1]);
  const liveActor=()=>state&&store.mode==="play"&&state.identity===identity()&&Scene.actors.find(actor=>actor.id===state.actorId&&actor.space===Scene.activeSpace);
  const health=actor=>{
    const compound=SceneEngine.compoundEnemyStatus(Scene,actor.id);
    return {value:compound.active?compound.hp:Number(actor.hp||0),maximum:compound.active?compound.maxHp:Number(actor.maxHp||0)};
  };
  function healthChange(value,current){
    const text=String(value??"").trim();
    if(!/^[+-]?\d+$/.test(text))return null;
    const number=Number(text),next=/^[+-]/.test(text)?current+number:number;
    return Number.isSafeInteger(next)&&next<=9999?Math.max(0,next):null;
  }
  function close(){
    state=null;menu.hidden=true;menu.style.maxHeight="";menu.classList.remove("is-token-hud");menu.setAttribute("role","menu");menu.removeAttribute("aria-label");delete menu.dataset.tokenHudActor;sceneContextTarget=null;
  }
  function healthBusy(){
    return sceneNumericCorrectionReason();
  }
  function updateHealthControls(){
    const busy=healthBusy(),form=menu.querySelector("form"),status=menu.querySelector(".token-hud-status");
    if(form){form.setAttribute("aria-busy",String(Boolean(busy)));form.querySelector('button[type="submit"]').disabled=Boolean(busy);}
    if(status)status.textContent=busy||state?.message||"";
  }
  function position(){
    const actor=liveActor(),token=actor&&board.querySelector(`[data-scene-actor="${CSS.escape(actor.id)}"]`);
    if(!actor||!token||menu.hidden)return close();
    const rect=token.getBoundingClientRect(),field=wrap.getBoundingClientRect();
    if(rect.bottom<field.top||rect.top>field.bottom||rect.right<field.left||rect.left>field.right)return close();
    const visibleHeight=Math.min(innerHeight-8,field.bottom-8)-Math.max(8,field.top+8);
    if(visibleHeight<44)return close();
    menu.style.maxHeight=`${visibleHeight}px`;
    const width=menu.offsetWidth,height=menu.offsetHeight,minLeft=Math.max(8,field.left+8),maxLeft=Math.max(minLeft,Math.min(innerWidth-8,field.right-8)-width);
    const minTop=Math.max(8,field.top+8),maxTop=Math.max(minTop,Math.min(innerHeight-8,field.bottom-8)-height);
    const above=rect.top-height-12,top=above>=minTop?above:rect.bottom+12;
    menu.style.left=`${clamp(rect.left+rect.width/2-width/2,minLeft,maxLeft)}px`;
    menu.style.top=`${clamp(top,minTop,maxTop)}px`;
    menu.dataset.placement=above>=minTop?"above":"below";
  }
  function draw({resetHealth=false}={}){
    const actor=liveActor();if(!actor)return close();
    const focusedAction=document.activeElement?.dataset?.tokenHudAction;
    const focusedHealth=document.activeElement&&(document.activeElement===menu.querySelector("input")?"input":document.activeElement===menu.querySelector('button[type="submit"]')?"submit":null);
    const hp=health(actor),gm=activeSceneView()==="gm",owns=gm||actor.heroId===S.id,targeted=Scene.targetIds.includes(actor.id);
    const input=menu.querySelector("input"),draft=gm&&!resetHealth&&input&&input.value!==String(state.health)?input.value:null;
    if(draft===null)state.health=hp.value;
    menu.classList.add("is-token-hud");menu.dataset.tokenHudActor=actor.id;menu.setAttribute("role","dialog");menu.setAttribute("aria-label",copy(`Управление токеном: ${actor.name}`,`Token controls: ${actor.name}`));
    menu.innerHTML=`<header class="token-hud-head"><strong>${esc(actor.name)}</strong><button type="button" data-token-hud-action="close" aria-label="${copy("Закрыть меню токена","Close token controls")}">×</button></header>
      ${gm?`<form class="token-hud-health"><label for="token-hud-health-input">${copy("ЗД","HP")}</label><input id="token-hud-health-input" type="text" inputmode="numeric" maxlength="6" value="${esc(draft??hp.value)}" aria-label="${copy("Здоровье токена","Token health")}" aria-describedby="token-hud-health-help" title="${copy("Число — точное значение; +5 или -5 — изменение. Enter применяет.","A number sets health; +5 or -5 changes it. Enter applies.")}"><span>/ ${hp.maximum||"—"}</span><button type="submit" title="${copy("Применить Здоровье · Enter","Apply health · Enter")}" aria-label="${copy("Применить Здоровье","Apply health")}">${copy("Применить","Apply")}</button></form><p id="token-hud-health-help" class="token-hud-help">${copy("Число — задать ЗД; -5 / +5 — изменить. Enter или «Применить».","A number sets HP; -5 / +5 changes it. Enter or Apply.")}</p>`:`<div class="token-hud-health-read">${copy("ЗД","HP")} <b>${hp.value} / ${hp.maximum||"—"}</b></div>`}
      <div class="token-hud-actions">${owns?`<button type="button" data-token-hud-action="cockpit" title="${copy("Действия и Техники в Пульте","Actions and Techniques in the cockpit")}"><i aria-hidden="true">⌘</i>${copy("Действия","Actions")}</button>`:""}<button type="button" data-token-hud-action="inspect"><i aria-hidden="true">ⓘ</i>${copy("Профиль","Profile")}</button><button type="button" data-token-hud-action="target" aria-pressed="${targeted}" ${actor.knockedOut?"disabled":""} title="${copy("Отметить или снять цель · T","Toggle target · T")}"><i aria-hidden="true">◎</i>${copy(targeted?"Снять цель":"Цель",targeted?"Untarget":"Target")}</button><button type="button" class="token-hud-more" data-token-hud-action="more" aria-label="${copy("Другие команды токена","More token commands")}" title="${copy("Другие команды токена","More token commands")}"><i aria-hidden="true">•••</i>${copy("Ещё","More")}</button></div>
      <p class="token-hud-status" role="status" aria-live="polite"></p>`;
    menu.hidden=false;updateHealthControls();position();
    if(menu.hidden)return;
    if(focusedAction)menu.querySelector(`[data-token-hud-action="${focusedAction}"]`)?.focus({preventScroll:true});
    else if(focusedHealth){const control=menu.querySelector(focusedHealth==="input"?"input":'button[type="submit"]');(control?.disabled?menu.querySelector("input"):control)?.focus({preventScroll:true});}
  }
  function show(actor){
    state={actorId:actor.id,identity:identity(),health:health(actor).value};
    sceneContextTarget={actorId:actor.id,cell:`${actor.x},${actor.y}`,markerId:null};
    hideSceneTokenTip(0);draw({resetHealth:true});if(!menu.hidden)menu.querySelector('[data-token-hud-action="target"]')?.focus({preventScroll:true});
  }
  function refresh(){
    if(!state||menu.hidden)return;
    const actor=liveActor();if(!actor)return close();
    // A background render must not discard an unfinished health edit.
    const input=menu.querySelector("input");
    if(activeSceneView()!=="gm"||!input)draw({resetHealth:true});
    else if(document.activeElement!==input&&input.value===String(state.health))draw();else{
      if(input.value===String(state.health)){state.health=health(actor).value;input.value=String(state.health);}
      updateHealthControls();position();
    }
  }
  function schedule(){if(!state||menu.hidden||frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;refresh()});}
  function applyHealth(){
    const actor=liveActor(),input=menu.querySelector("input");
    if(!actor||!input)return close();
    if(activeSceneView()!=="gm")return false;
    // A delta is translated to a canonical absolute correction. Wait for prior
    // writes before deriving it, so repeated edits cannot overwrite each other.
    if(healthBusy()){updateHealthControls();return false;}
    const current=health(actor).value,value=healthChange(input.value,current);
    if(value===null){state.message=copy("Введите число, +5 или -5.","Enter a number, +5 or -5.");updateHealthControls();return false;}
    if(!/^[+-]/.test(input.value.trim())&&current!==state.health){state.health=current;input.value=String(current);state.message=copy("Здоровье уже изменилось. Проверьте новое значение.","Health has changed. Check the new value.");updateHealthControls();return false;}
    if(value===current){state.message="";draw({resetHealth:true});return true;}
    const label=copy(`${actor.name}: Здоровье → ${value}`,`${actor.name}: Health → ${value}`);
    const result=Scene.rulesEdition==="lionwing"?lwSubmit(actor.id,{kind:"correct",resource:"hp",amount:value},label):setNarratorActorValue(actor,"hp",value,label);
    if(result){state.message="";draw({resetHealth:true});const nextInput=menu.querySelector("input");nextInput?.focus({preventScroll:true});nextInput?.select?.();}
    return Boolean(result);
  }
  function action(name){
    const actor=liveActor();if(!actor)return close();
    if(name==="target"){if(!actor.knockedOut)toggleSceneTarget(actor.id);draw();menu.querySelector('[data-token-hud-action="target"]')?.focus({preventScroll:true});return;}
    if(name==="more"){
      const token=board.querySelector(`[data-scene-actor="${CSS.escape(actor.id)}"]`),cell=token?.closest("[data-scene-cell]"),rect=menu.getBoundingClientRect();
      close();showSceneContextMenu({clientX:rect.left,clientY:rect.top},{actor,cell});return;
    }
    close();
    if(name==="cockpit")openSceneActorCockpit(actor.id);
    else if(name==="inspect"){Scene.selectedActor=actor.id;Scene.activeSpace=actor.space;persist();renderScene();setScenePanel("inspector");}
  }
  board.addEventListener("contextmenu",event=>{
    if(!usingNextSceneInterface())return;
    const token=event.target.closest("[data-scene-actor]"),actor=token&&Scene.actors.find(item=>item.id===token.dataset.sceneActor);
    if(!actor){close();return;}
    event.preventDefault();event.stopImmediatePropagation();show(actor);
  },true);
  menu.addEventListener("click",event=>{const button=event.target.closest("[data-token-hud-action]");if(!button||!state)return;event.preventDefault();event.stopImmediatePropagation();action(button.dataset.tokenHudAction);},true);
  menu.addEventListener("submit",event=>{if(!event.target.matches(".token-hud-health"))return;event.preventDefault();event.stopPropagation();applyHealth();});
  document.addEventListener("keydown",event=>{
    if(!state||menu.hidden||store.mode!=="play"||event.defaultPrevented||document.querySelector("dialog[open]"))return;
    if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();const actor=liveActor();close();if(actor)board.querySelector(`[data-scene-actor="${CSS.escape(actor.id)}"]`)?.focus?.({preventScroll:true});return;}
    if(event.ctrlKey||event.metaKey||event.altKey||event.target.matches("input,textarea,select,[contenteditable]"))return;
    if(event.key.toLowerCase()==="t"){event.preventDefault();event.stopImmediatePropagation();action("target");}
  },true);
  document.addEventListener("scroll",schedule,true);window.addEventListener("resize",schedule);
  window.addEventListener("dawn-network-v2-settled",schedule);
  new MutationObserver(schedule).observe(board,{childList:true,subtree:true});
  if($("scene-sync-status"))new MutationObserver(schedule).observe($("scene-sync-status"),{childList:true,attributes:true});
  window.DAWN_SCENE_TOKEN_HUD=Object.freeze({healthChange,show,close,refresh,applyHealth,action});
})();
