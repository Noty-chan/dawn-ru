"use strict";
// Local presentation only. All commands stay on existing actor-bound routes.
window.DAWN_SCENE_WORKSPACE=(()=>{
  let palettePanel,bar,more,toolbarHome,turnHome,ready=false,turnLayout=null,turnActorId=null;
  const dockHomes=new Map(),dockIcons={director:'actions',inspector:'tokens',sheet:'sheet',utility:'dice',reference:'sheet',media:'art',map:'map',entities:'effects',add:'add',table:'settings',network:'network',log:'log'};
  const copy=(ru,en)=>typeof isEnglishPreview==='function'&&isEnglishPreview()?en:ru;
  const narrow=()=>typeof sceneViewportProfile==='function'&&sceneViewportProfile()!=='desktop';
  function init(){
    if(ready)return true;const workbench=$("scene-workbench"),toolbar=document.querySelector('.scene-toolbar');if(!workbench||!toolbar)return false;
    ready=true;toolbarHome=document.createComment('field tools');toolbar.before(toolbarHome);turnHome=document.createComment('initiative');$("scene-turn-strip").before(turnHome);
    palettePanel=document.createElement('section');palettePanel.className='panel scene-field-palette';palettePanel.dataset.scenePanelContent='fieldtools';palettePanel.innerHTML=`<header class="scene-panel-head"><div><h2>${copy('Инструменты поля','Field tools')}</h2></div><button type="button" data-close-scene-panel aria-label="${copy('Закрыть панель','Close panel')}">×</button></header>`;$("scene-rail-right").append(palettePanel);
    bar=document.createElement('section');bar.id='scene-mobile-controls';bar.className='scene-mobile-controls';bar.setAttribute('aria-label',copy('Выбранный участник и команды','Selected participant and commands'));
    bar.innerHTML=`<div class="scene-mobile-selection" aria-live="polite"></div><div class="scene-mobile-actions"><button type="button" data-mobile-actor-action>${copy('Действие','Action')}</button><button type="button" data-mobile-actor-info>${copy('Подробнее','Details')}</button><button type="button" data-open-scene-panel="fieldtools">${copy('Поле','Field')}</button><details><summary aria-label="${copy('Другие панели Стола','Other Table panels')}">•••</summary><nav></nav></details></div>`;workbench.append(bar);more=bar.querySelector('nav');
    for(const button of $("scene-dock").querySelectorAll('[data-scene-panel]')){dockHomes.set(button,button.innerHTML);const item=document.createElement('button');item.type='button';item.textContent=button.textContent;item.dataset.openScenePanel=button.dataset.scenePanel;if(button.classList.contains('gm-only'))item.classList.add('gm-only');more.append(item)}
    bar.addEventListener('click',event=>{const actor=Scene.actors.find(item=>item.id===Scene.selectedActor&&item.space===Scene.activeSpace);if(event.target.closest('[data-mobile-actor-action]')&&actor){openSceneActorCockpit(actor.id);return}if(event.target.closest('[data-mobile-actor-info]'))setScenePanel(actor?'inspector':'media');if(event.target.closest('[data-open-scene-panel]'))bar.querySelector('details').open=false});
    if(typeof ResizeObserver==='function')new ResizeObserver(measureMobileControls).observe(bar);
    window.addEventListener('resize',refresh);return true;
  }
  function revealCurrentTurn(turns,next,phone){
    const hidden=document.body.classList.contains('scene-turn-strip-hidden')||document.body.classList.contains('focus-mode')||document.body.classList.contains('scene-panel-open-both');
    const layout=!next||phone||hidden?'hidden':document.body.classList.contains('scene-panel-open-left')?'compact':'rail';
    if(layout!=='hidden'&&(layout!==turnLayout||Scene.activeActorId!==turnActorId)){
      const current=turns.querySelector('[aria-current="step"]');
      // refresh also runs before the roster renderer; wait for its current actor.
      if(Scene.activeActorId&&current?.dataset.sceneTurnActor!==Scene.activeActorId)return;
      if(current){const box=turns.getBoundingClientRect();if(box.height<=0)return;const item=current.getBoundingClientRect();if(item.top<box.top+6)turns.scrollTop-=box.top+6-item.top;else if(item.bottom>box.bottom-6)turns.scrollTop+=item.bottom-box.bottom+6}
    }
    turnLayout=layout;turnActorId=Scene.activeActorId;
  }
  function measureMobileControls(){
    if(!bar)return;const height=narrow()&&usingNextSceneInterface()?Math.ceil(bar.getBoundingClientRect().height):0;
    $("scene-workbench").style.setProperty("--scene-mobile-controls-height",`${height}px`);
  }
  function refresh(){
    if(!init())return;
    const next=usingNextSceneInterface(),phone=next&&narrow(),toolbar=document.querySelector('.scene-toolbar'),turns=$("scene-turn-strip"),left=$("scene-rail-left");
    document.body.classList.toggle('scene-next-narrow',phone);
    if(phone&&(activeScenePanels.left&&activeScenePanels.right)){const keep=activeScenePanel||activeScenePanels.right;activeScenePanels.left=null;activeScenePanels.right=null;activeScenePanels[scenePanelSide(keep)]=keep;syncScenePanels()}
    for(const[button,html]of dockHomes){if(next)button.setAttribute("aria-label",button.title||button.textContent.trim());else button.removeAttribute("aria-label");const wanted=next?`${window.DAWN_UI_ICONS?.html(dockIcons[button.dataset.scenePanel]||'more')||''}<span class="scene-dock-label">${html}</span>`:html;if(button.innerHTML!==wanted)button.innerHTML=wanted}
    if(phone){if(toolbar.parentElement!==palettePanel)palettePanel.append(toolbar)}else if(toolbar.previousSibling!==toolbarHome)toolbarHome.after(toolbar);
    if(next&&!phone){if(turns.parentElement!==left)left.prepend(turns)}else if(turns.previousSibling!==turnHome)turnHome.after(turns);
    revealCurrentTurn(turns,next,phone);
    palettePanel.classList.toggle('rail-active',phone&&isScenePanelOpen('fieldtools'));
    const paletteClose=palettePanel.querySelector('[data-close-scene-panel]'),paletteTitle=palettePanel.querySelector('h2');
    if(paletteClose)paletteClose.setAttribute('aria-label',copy('Закрыть панель','Close panel'));
    if(paletteTitle)paletteTitle.textContent=copy('Инструменты поля','Field tools');
    const actor=Scene.actors.find(item=>item.id===Scene.selectedActor&&item.space===Scene.activeSpace),compound=actor&&SceneEngine.compoundEnemyStatus(Scene,actor.id),hp=compound?.active?compound.hp:actor?.hp,maximum=compound?.active?compound.maxHp:actor?.maxHp;
    bar.querySelector('.scene-mobile-selection').textContent=actor?`${actor.name} · ${copy('ЗД','HP')} ${hp} / ${maximum||'—'}`:copy('Выберите участника на поле','Select a participant on the field');
    bar.querySelector('[data-mobile-actor-action]').disabled=!actor||(activeSceneView()!=='gm'&&actor.heroId!==S.id);
    for(const button of more.querySelectorAll('[data-open-scene-panel]'))button.setAttribute('aria-pressed',String(isScenePanelOpen(button.dataset.openScenePanel)));
    measureMobileControls();
  }
  function setVersion(version){
    window.DAWN_SCENE_TOKEN_HUD?.close();if(version==="classic"&&activeScenePanel==="fieldtools")closeAllScenePanels();sceneInterfaceVersion=version==='classic'?'classic':'next';document.body.classList.toggle('scene-interface-next',usingNextSceneInterface());document.documentElement.classList.toggle('scene-interface-next',usingNextSceneInterface());
    $("scene-interface-classic-styles").disabled=usingNextSceneInterface();$("scene-interface-next-styles").disabled=!usingNextSceneInterface();window.DAWN_SCENE_BOARD_TOOLS?.setEnabled?.(usingNextSceneInterface());
    refresh();persist();renderScene();refresh();window.DAWN_MOBILE_HEADER?.refresh();
  }
  return Object.freeze({init,refresh,setVersion,narrow});
})();
