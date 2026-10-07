"use strict";

// The token HUD is a local shortcut surface. Commands still use the existing
// actor-bound cockpit, targeting and Narrator correction routes.
(() => {
  const board=$("scene-board"),menu=$("scene-context-menu"),wrap=$("scene-board-wrap");
  if(!board||!menu||!wrap)return;
  let state=null,frame=null,selectionKey=null,leaveTimer=null,drawing=false;
  const icon=name=>window.DAWN_UI_ICONS?.html(name)||"";
  const supportedViewport=()=>innerWidth>720&&!(innerWidth<=950&&innerHeight<=500);
  const copy=(ru,en)=>typeof isEnglishPreview==="function"&&isEnglishPreview()?en:ru;
  const hudText=(key,ru,en)=>window.DAWN_I18N?.t(`scene.tokenHud.${key}`,{}, {fallback:copy(ru,en)})||copy(ru,en);
  const identity=()=>JSON.stringify([Sync?.state?.()?.sceneId||null,lwGeometrySceneIdentity(),Scene.lionwing?.sceneSerial??1]);
  const liveActor=()=>state&&supportedViewport()&&store.mode==="play"&&state.identity===identity()&&Scene.actors.find(actor=>actor.id===state.actorId&&actor.space===Scene.activeSpace);
  const health=actor=>{
    const compound=SceneEngine.compoundEnemyStatus(Scene,actor.id);
    return {value:compound.active?compound.hp:Number(actor.hp||0),maximum:compound.active?compound.maxHp:Number(actor.maxHp||0)};
  };
  function healthChange(value,current,maximum=null){
    const text=String(value??"").trim();
    if(!/^[+-]?\d+$/.test(text))return null;
    const number=Number(text),next=/^[+-]/.test(text)?current+number:number;
    return Number.isSafeInteger(next)&&next<=9999?Math.max(0,/^[+-]/.test(text)&&Number.isFinite(maximum)&&maximum>0?Math.min(maximum,next):next):null;
  }
  function close(){
    cancelLeave();menu.style.width="";menu.style.height="";
    state=null;pointerHeld=false;menu.hidden=true;menu.style.maxHeight="";menu.style.maxWidth="";menu.classList.remove("is-token-hud");menu.classList.remove("is-token-overlay");menu.setAttribute("role","menu");menu.removeAttribute("aria-label");delete menu.dataset.tokenHudActor;sceneContextTarget=null;
  }

  function followSelection(){
    if(!usingNextSceneInterface()||store.mode!=="play"||!supportedViewport()){if(state)close();return;}
    const key=JSON.stringify([identity(),Scene.activeSpace,Scene.selectedActor||null]);
    if(state?.selection&&Scene.tool&&Scene.tool!=="select")close();
    if(key===selectionKey)return;
    selectionKey=key;
    const actor=Scene.actors.find(item=>item.id===Scene.selectedActor&&item.space===Scene.activeSpace);
    if(!actor){if(state)close();return;}
    if(Scene.tool&&Scene.tool!=="select")return;
    show(actor,{focus:false,selection:true});
  }
  function healthBusy(){
    return sceneNumericCorrectionReason();
  }
  function updateHealthControls(){
    const busy=healthBusy(),input=menu.querySelector("input"),status=menu.querySelector(".token-hud-status");
    if(input)input.setAttribute("aria-busy",String(Boolean(busy)));
    if(status)status.textContent=busy||state?.message||"";
  }
  function position(){
    const actor=liveActor(),token=actor&&board.querySelector(`[data-scene-actor="${CSS.escape(actor.id)}"]`);
    if(!actor||!token||menu.hidden)return close();
    const rect=token.getBoundingClientRect(),field=wrap.getBoundingClientRect();
    if(rect.bottom<field.top||rect.top>field.bottom||rect.right<field.left||rect.left>field.right)return close();
    const visibleHeight=Math.min(innerHeight-8,field.bottom-8)-Math.max(8,field.top+8),visibleWidth=Math.min(innerWidth-8,field.right-8)-Math.max(8,field.left+8);
    if(visibleHeight<140||visibleWidth<160)return close();
    menu.style.maxHeight=`${visibleHeight}px`;
    menu.style.maxWidth=`${visibleWidth}px`;
    const width=Math.min(visibleWidth,Math.max(160,rect.width+112)),height=Math.min(visibleHeight,Math.max(140,rect.height+104));
    menu.style.width=`${width}px`;menu.style.height=`${height}px`;
    menu.style.setProperty?.("--hud-token-height",`${rect.height}px`);
    menu.style.left=`${clamp(rect.left+rect.width/2-width/2,Math.max(8,field.left+8),Math.max(8,Math.min(innerWidth-8,field.right-8)-width))}px`;
    menu.style.top=`${clamp(rect.top-24,Math.max(8,field.top+8),Math.max(8,Math.min(innerHeight-8,field.bottom-8)-height))}px`;
    menu.dataset.placement="around";
    // Keep the transparent hole tied to the token when viewport edges clamp
    // the outer box: place each perimeter control from the actual token rect.
    const menuLeft=Number.parseFloat(menu.style.left),menuTop=Number.parseFloat(menu.style.top),minX=Math.max(8,field.left+8),maxX=Math.min(innerWidth-8,field.right-8),minY=Math.max(8,field.top+8),maxY=Math.min(innerHeight-8,field.bottom-8);
    const set=(name,value)=>menu.style.setProperty?.(name,`${value}px`);
    let leftControl=rect.left-50,rightControl=rect.right+6;
    if(leftControl<minX&&rightControl+92<=maxX){leftControl=rightControl;rightControl+=48;}
    else if(rightControl+44>maxX&&leftControl-48>=minX){rightControl=leftControl;leftControl-=48;}
    set("--hud-left",clamp(leftControl,minX,maxX-44)-menuLeft);set("--hud-right",clamp(rightControl,minX,maxX-44)-menuLeft);
    // Clamp all three button rows together; independent clamping can overlap
    // the cap and first row at the top or bottom of a clipped mobile field.
    const controlTop=clamp(rect.top-48,minY,maxY-140);
    set("--hud-row",controlTop+48-menuTop);set("--hud-cap",controlTop-menuTop);
    const healthLeft=clamp(rect.left+rect.width/2-40,minX,maxX-80),controlXs=[clamp(leftControl,minX,maxX-44),clamp(rightControl,minX,maxX-44)];
    let healthTop=clamp(rect.bottom+8,minY,maxY-40);
    if(controlXs.some(x=>healthLeft<x+44&&healthLeft+80>x)&&healthTop<controlTop+140&&healthTop+40>controlTop){
      if(controlTop+184<=maxY)healthTop=controlTop+144;
      else if(controlTop-44>=minY)healthTop=controlTop-44;
      else return close();
    }
    set("--hud-health-left",healthLeft-menuLeft);set("--hud-health-top",healthTop-menuTop);
    const picker=menu.querySelector(".token-hud-effect-picker");
    if(picker&&state.effectsOpen){
      const pickerWidth=Math.min(300,visibleWidth),controlsLeft=Math.min(...controlXs,healthLeft),controlsRight=Math.max(...controlXs.map(x=>x+44),healthLeft+80),controlsTop=Math.min(controlTop,healthTop),controlsBottom=Math.max(controlTop+140,healthTop+40);
      let pickerLeft,pickerTop,pickerHeight=Math.min(240,visibleHeight);
      if(controlsRight+6+pickerWidth<=maxX){pickerLeft=controlsRight+6;pickerTop=clamp(controlsTop,minY,maxY-pickerHeight);}
      else if(controlsLeft-6-pickerWidth>=minX){pickerLeft=controlsLeft-6-pickerWidth;pickerTop=clamp(controlsTop,minY,maxY-pickerHeight);}
      else {
        // With both task rails open the field can be too narrow for a side
        // popup. Use the larger vertical gap and scroll the list there.
        const below=maxY-controlsBottom-6,above=controlsTop-minY-6;
        pickerHeight=Math.min(pickerHeight,Math.max(below,above));
        if(pickerHeight<80){state.effectsOpen=false;picker.hidden=true;menu.querySelector('[data-token-hud-action="effects"]')?.setAttribute('aria-expanded','false');return;}
        pickerLeft=clamp(rect.left+rect.width/2-pickerWidth/2,minX,maxX-pickerWidth);
        pickerTop=below>=above?controlsBottom+6:controlsTop-6-pickerHeight;
      }
      picker.style.position="fixed";picker.style.width=`${pickerWidth}px`;picker.style.left=`${pickerLeft}px`;picker.style.top=`${pickerTop}px`;picker.style.maxHeight=`${pickerHeight}px`;
    }
  }
  function draw({resetHealth=false}={}){
    const actor=liveActor();if(!actor)return close();
    const focusedAction=state.preserveFocus!==false?document.activeElement?.dataset?.tokenHudAction:null;
    const focusedEffect=state.preserveFocus!==false?document.activeElement?.dataset?.tokenHudEffect:null;
    const focusedHealth=state.preserveFocus!==false&&document.activeElement===menu.querySelector("input");
    const hp=health(actor),gm=activeSceneView()==="gm",owns=gm||actor.heroId===S.id,targeted=Scene.targetIds.includes(actor.id);
    const input=menu.querySelector("input"),draft=gm&&!resetHealth&&input&&input.value!==String(state.health)?input.value:null;
    if(draft===null)state.health=hp.value;
    menu.classList.add("is-token-hud");menu.classList.add("is-token-overlay");menu.dataset.tokenHudActor=actor.id;menu.setAttribute("role","dialog");menu.setAttribute("aria-label",copy(`Управление токеном: ${actor.name}`,`Token controls: ${actor.name}`));
    const effectIds=typeof sceneActorEffects==="function"?sceneActorEffects(actor):actor.effects||[],effectCatalog=typeof sceneEffectList==="function"?sceneEffectList():[];
    const effects=effectIds.map(id=>effectCatalog.find(effect=>effect.id===id)?.name||id);
    drawing=true;menu.innerHTML=`<header class="token-hud-head"><strong>${esc(actor.name)}</strong><button type="button" data-token-hud-action="close" aria-label="${copy("Закрыть меню токена","Close token controls")}">${icon("close")}</button></header>
      ${gm?`<div class="token-hud-health"><label for="token-hud-health-input">${copy("ЗД","HP")}</label><input id="token-hud-health-input" type="text" inputmode="text" maxlength="6" value="${esc(draft??hp.value)}" aria-label="${copy("Здоровье токена","Token health")}" aria-describedby="token-hud-health-help" title="${copy("Число — точное значение; +5 или -5 — изменение. Enter или выход из поля применяет.","A number sets health; +5 or -5 changes it. Enter or leaving the field applies.")}"><span>/ ${hp.maximum||"—"}</span></div><p id="token-hud-health-help" class="token-hud-help">${copy("Число — задать ЗД; -5 / +5 — изменить. Escape отменяет.","A number sets HP; -5 / +5 changes it. Escape cancels.")}</p>`:`<div class="token-hud-health-read">${copy("ЗД","HP")} <b>${hp.value} / ${hp.maximum||"—"}</b></div>`}
      <div class="token-hud-actions">${owns?`<button type="button" data-token-hud-action="cockpit" title="${copy("Действия и Техники в Пульте","Actions and Techniques in the cockpit")}">${icon("actions")}${copy("Действия","Actions")}</button>`:""}<button type="button" data-token-hud-action="inspect">${icon("sheet")}${copy("Профиль","Profile")}</button><button type="button" data-token-hud-action="target" aria-pressed="${targeted}" ${actor.knockedOut?"disabled":""} title="${copy("Отметить или снять цель · T","Toggle target · T")}">${icon("target")}${copy(targeted?"Снять цель":"Цель",targeted?"Untarget":"Target")}</button><button type="button" class="token-hud-more" data-token-hud-action="more" aria-label="${copy("Другие команды токена","More token commands")}" title="${copy("Другие команды токена","More token commands")}">${icon("more")}${copy("Ещё","More")}</button></div>
      <div class="token-hud-effects"><span>${hudText("effectsLabel","Эффекты","Effects")}</span><span>${effects.length?effects.map(name=>esc(name)).join(" · "):hudText("noEffects","Нет активных Эффектов","No active Effects")}</span></div>
      <p class="token-hud-status" role="status" aria-live="polite"></p>`;
    const statusPicker=`<button type="button" data-token-hud-action="effects" aria-expanded="${Boolean(state.effectsOpen)}" aria-label="${hudText("effectsAria","Эффекты токена","Token Effects")}" title="${hudText("effectsLabel","Эффекты","Effects")}">${icon("effects")}</button><div class="token-hud-effect-picker" ${state.effectsOpen?"":"hidden"}><strong>${hudText("effectsLabel","Эффекты","Effects")}</strong>${effectCatalog.map(effect=>`<button type="button" data-token-hud-effect="${esc(effect.id)}" aria-pressed="${effectIds.includes(effect.id)}" ${gm?"":"disabled"}>${esc(effect.name)}</button>`).join("")||esc(hudText("noEffects","Активных Эффектов нет","No active Effects"))}${!gm?`<p>${hudText("readonlyEffects","Изменяет Нарратор","Edited by the Narrator")}</p>`:""}</div>`;
    menu.insertAdjacentHTML("beforeend",statusPicker);
    drawing=false;menu.hidden=false;updateHealthControls();position();
    if(menu.hidden)return;
    if(focusedEffect)menu.querySelector(`[data-token-hud-effect="${CSS.escape(focusedEffect)}"]`)?.focus({preventScroll:true});
    else if(focusedAction)menu.querySelector(`[data-token-hud-action="${focusedAction}"]`)?.focus({preventScroll:true});
    else if(focusedHealth)menu.querySelector("input")?.focus({preventScroll:true});
  }
  function show(actor,{focus=true,selection=false}={}){
    if(!supportedViewport())return close();
    cancelLeave();
    selectionKey=JSON.stringify([identity(),Scene.activeSpace,Scene.selectedActor||null]);
    state={actorId:actor.id,identity:identity(),health:health(actor).value,selection,preserveFocus:focus};
    sceneContextTarget={actorId:actor.id,cell:`${actor.x},${actor.y}`,markerId:null};
    hideSceneTokenTip(0);draw({resetHealth:true});if(state)state.preserveFocus=true;if(focus&&!menu.hidden)menu.querySelector('[data-token-hud-action="target"]')?.focus({preventScroll:true});
  }
  let pointerHeld=false;
  function refresh(){
    followSelection();
    if(!state||menu.hidden)return;
    const actor=liveActor();if(!actor)return close();
    // A health blur may synchronously render the Scene between pointer-down
    // and click. Keep the live perimeter controls until that click arrives.
    if(pointerHeld&&activeSceneView()==="gm"){updateHealthControls();position();return;}
    if(state.pendingHealth!=null&&activeSceneView()==="gm"){
      if(health(actor).value===state.pendingHealth)state.pendingHealth=null;
      else if(healthBusy()){updateHealthControls();position();return;}
      else state.pendingHealth=null;
    }
    // A background render must not discard an unfinished health edit.
    const input=menu.querySelector("input");
    if(activeSceneView()!=="gm"||!input)draw({resetHealth:true});
    else if(document.activeElement!==input&&input.value===String(state.health))draw();else{
      if(input.value===String(state.health)){state.health=health(actor).value;input.value=String(state.health);}
      updateHealthControls();position();
    }
  }
  function schedule(){if(frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;refresh()});}
  function applyHealth(){
    const actor=liveActor(),input=menu.querySelector("input");
    if(!actor||!input)return close();
    if(activeSceneView()!=="gm")return false;
    // A delta is translated to a canonical absolute correction. Wait for prior
    // writes before deriving it, so repeated edits cannot overwrite each other.
    if(healthBusy()){updateHealthControls();return false;}
    const hp=health(actor),current=hp.value,value=healthChange(input.value,current,hp.maximum);
    if(!input.value.trim())return false;
    if(value===null){state.message=copy("Введите число, +5 или -5.","Enter a number, +5 or -5.");updateHealthControls();return false;}
    if(!/^[+-]/.test(input.value.trim())&&current!==state.health){state.health=current;input.value=String(current);state.message=copy("Здоровье уже изменилось. Проверьте новое значение.","Health has changed. Check the new value.");updateHealthControls();return false;}
    if(value===current){state.message="";state.health=current;input.value=String(current);input.dataset.hudReplace="true";updateHealthControls();return true;}
    const label=copy(`${actor.name}: Здоровье → ${value}`,`${actor.name}: Health → ${value}`);
    const result=Scene.rulesEdition==="lionwing"?lwSubmit(actor.id,{kind:"correct",resource:"hp",amount:value},label):setNarratorActorValue(actor,"hp",value,label);
    if(result){state.message="";state.health=value;state.pendingHealth=health(actor).value===value?null:value;input.value=String(value);input.dataset.hudReplace="true";if(document.activeElement===input)input.select?.();updateHealthControls();}
    return Boolean(result);
  }
  function action(name){
    const actor=liveActor();if(!actor)return close();
    if(name==="effects"){state.effectsOpen=!state.effectsOpen;draw();return;}
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
    if(!usingNextSceneInterface()||!supportedViewport())return;
    const token=event.target.closest("[data-scene-actor]"),actor=token&&Scene.actors.find(item=>item.id===token.dataset.sceneActor);
    if(!actor){close();return;}
    event.preventDefault();event.stopImmediatePropagation();show(actor);
  },true);
  board.addEventListener("click",event=>{
    if(!usingNextSceneInterface()||store.mode!=="play"||!supportedViewport())return;
    const token=event.target.closest("[data-scene-actor]");
    if(!token){close();selectionKey=JSON.stringify([identity(),Scene.activeSpace,Scene.selectedActor||null]);return;}
    const actor=Scene.actors.find(item=>item.id===token.dataset.sceneActor&&item.space===Scene.activeSpace);
    if(actor&&(!Scene.tool||Scene.tool==="select"))show(actor,{focus:false,selection:true});
  });
  menu.addEventListener("click",event=>{const effect=event.target.closest("[data-token-hud-effect]");if(effect&&state){event.preventDefault();event.stopImmediatePropagation();const actor=liveActor(),effectId=effect.dataset.tokenHudEffect,catalog=typeof sceneEffectList==="function"?sceneEffectList():[];if(!actor||activeSceneView()!=="gm"||!catalog.some(item=>item.id===effectId))return;const effects=typeof sceneActorEffects==="function"?sceneActorEffects(actor):actor.effects||[],remove=effects.includes(effectId);setNarratorEffect(actor,effectId,remove);draw();return;}const button=event.target.closest("[data-token-hud-action]");if(!button||!state)return;event.preventDefault();event.stopImmediatePropagation();action(button.dataset.tokenHudAction);},true);
  function cancelLeave(){if(leaveTimer!==null){clearTimeout(leaveTimer);leaveTimer=null;}}
  function delayLeave(){cancelLeave();leaveTimer=setTimeout(()=>{leaveTimer=null;if(menu.contains?.(document.activeElement)||state?.effectsOpen)return;close();},260);}
  board.addEventListener("mouseover",event=>{
    if(!usingNextSceneInterface()||store.mode!=="play"||!supportedViewport()||Scene.tool&&Scene.tool!=="select")return;
    const token=event.target.closest("[data-scene-actor]"),actor=token&&Scene.actors.find(item=>item.id===token.dataset.sceneActor&&item.space===Scene.activeSpace);
    if(!actor)return;cancelLeave();if(state?.actorId===actor.id&&!menu.hidden)return;if(menu.contains?.(document.activeElement)||state?.effectsOpen)return;show(actor,{focus:false,selection:true});
  });
  board.addEventListener("mouseout",event=>{if(event.target.closest("[data-scene-actor]")&&!event.relatedTarget?.closest?.("#scene-context-menu"))delayLeave();});
  menu.addEventListener("mouseenter",cancelLeave);menu.addEventListener("mouseleave",delayLeave);
  menu.addEventListener("pointerdown",()=>{pointerHeld=true;},true);
  document.addEventListener("pointerup",()=>{if(pointerHeld){pointerHeld=false;schedule();}},true);
  menu.addEventListener("focusin",event=>{if(event.target!==menu.querySelector("input"))return;event.target.select?.();event.target.dataset.hudReplace="true";});
  menu.addEventListener("beforeinput",event=>{const input=menu.querySelector("input");if(event.target!==input)return;if(input.dataset.hudReplace==="true"&&event.inputType?.startsWith("insert")){input.value="";input.dataset.hudReplace="false";}});
  menu.addEventListener("input",event=>{if(event.target===menu.querySelector("input"))event.target.dataset.hudReplace="false";});
  menu.addEventListener("focusout",event=>{if(drawing||!state||event.target!==menu.querySelector("input"))return;if(event.target.value!==String(state.health)&&event.target.value.trim())applyHealth();});
  document.addEventListener("keydown",event=>{
    if(!state||menu.hidden||store.mode!=="play"||event.defaultPrevented||document.querySelector("dialog[open]"))return;
    if(event.key==="Enter"&&event.target===menu.querySelector("input")){event.preventDefault();event.stopImmediatePropagation();applyHealth();return;}
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
