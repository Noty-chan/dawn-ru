"use strict";

// Connects the shared manual policy to the existing single Scene writer.
function manualTableActive(){return Boolean(window.DAWN_TABLE_POLICY?.isManual(Scene))}
function manualTableCopy(ru,en){return isEnglishPreview()?en:ru}
function placeManualMapObject(tool,{x,y}){
  if(!manualTableActive()||activeSceneView()!=="gm")return null;
  if(window.DAWN_TABLE_POLICY.pendingWork(Scene)||sceneHasLocalPendingSelection())return toast(manualTableCopy("Сначала завершите ожидающее действие.","Finish the pending workflow first."));
  const space=activeSceneSpace();let payload;
  if(tool==="area"){
    const appearance=$("scene-area-type").value;if(!["terrain","difficult","high","low","custom"].includes(appearance))return null;
    const cells=Logic.areaCells({shape:$("scene-area-shape").value,x,y,width:space.width,height:space.height});
    payload={kind:"area/create",area:{id:uid(),space:space.id,cells,appearance,label:$("scene-area-label").value.trim()||sceneObjectDisplayName({type:"manual-area",appearance}),color:$("scene-manual-area-color").value,hidden:$("scene-manual-area-hidden").checked}};
  }else if(tool==="wall"){
    const [dx,dy]=({north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]})[$("scene-wall-direction").value]||[1,0],a=`${x},${y}`,b=`${x+dx},${y+dy}`;
    if(x+dx<0||y+dy<0||x+dx>=space.width||y+dy>=space.height)return toast(manualTableCopy("Стена проводится между клетками поля.","Place the wall between board cells."));
    if(Scene.walls.some(w=>w.space===space.id&&[w.a,w.b].sort().join("|")===[a,b].sort().join("|")))return toast(manualTableCopy("На этом ребре уже есть Стена.","There is already a wall on this edge."));
    payload={kind:"wall/create",wall:{id:uid(),space:space.id,a,b,label:$("scene-wall-label").value.trim()||manualTableCopy("Стена","Wall"),hidden:$("scene-manual-wall-hidden").checked}};
  }else if(tool==="marker"){
    const kind=$("scene-marker-kind").value;if(!["mark","custom","objective","countdown"].includes(kind))return null;
    const size=Number($("scene-marker-clock-size")?.value||0);
    payload={kind:"marker/create",marker:{id:uid(),space:space.id,x,y,kind,label:$("scene-marker-label").value.trim()||manualTableCopy("Метка","Marker"),color:safeColor($("scene-marker-color").value,"#e2b54a"),hidden:$("scene-manual-marker-hidden").checked,...(size?{clock:{size,value:0}}:{})}};
  }else return null;
  return commitSceneEvents(manualTableCopy("Добавлено обозначение на карту","Added a map annotation"),[{type:"table.command",actorId:null,payload}]);
}
function renderManualMapTools(){
  const manual=manualTableActive();
  for(const id of ["scene-area-source","scene-area-duration","scene-wall-hp","scene-wall-source","scene-marker-source","scene-marker-duration"]){const label=$(id)?.closest("label");if(label)label.hidden=manual}
  for(const [id,allowed] of [["scene-area-type",["terrain","difficult","high","low","custom"]],["scene-marker-kind",["mark","custom","objective","countdown"]]]){
    const select=$(id);if(!select)continue;
    for(const option of select.options){option.disabled=manual&&!allowed.includes(option.value);option.hidden=option.disabled}
    if(manual&&!allowed.includes(select.value))select.value=allowed[0];
  }
  const terrain=$("scene-area-type")?.querySelector('option[value="terrain"]');if(terrain)terrain.textContent=manual?manualTableCopy("Местность · обозначение","Terrain · annotation"):manualTableCopy("Местность (блокирует)","Terrain (blocking)");
  for(const kind of ["area","wall","marker"]){
    const controls=$(`scene-${kind}-controls`);if(!controls)continue;
    if(kind==="area"&&!$("scene-manual-area-color")){const label=document.createElement("label");label.className="manual-map-setting";label.innerHTML='<span></span><input id="scene-manual-area-color" type="color" value="#65c8d0">';controls.append(label)}
    const id=`scene-manual-${kind}-hidden`;
    if(!$(id)){const label=document.createElement("label");label.className="manual-map-setting";label.innerHTML=`<input id="${id}" type="checkbox"><span></span>`;controls.append(label)}
    for(const label of controls.querySelectorAll(".manual-map-setting")){label.hidden=!manual;label.querySelector("span").textContent=label.querySelector('[type="color"]')?manualTableCopy("Цвет","Color"):manualTableCopy("Только ведущему","Narrator only")}
  }
}
function renderManualEnvironmentInspector(){
  const gm=activeSceneView()==="gm",copy=manualTableCopy;
  const rows=[...Scene.objects.map(o=>({record:o,kind:"object",meta:`${sceneObjectDisplayName(o)} · ${o.cells.length} ${copy("клеток","cells")}`})),...Scene.walls.map(w=>({record:w,kind:"wall",meta:`${copy("Стена","Wall")} · ${w.a} ↔ ${w.b}`})),...Scene.markers.map(m=>({record:m,kind:"marker",meta:`${copy("Метка","Marker")} · ${String.fromCharCode(65+m.x)}${m.y+1}`}))].filter(({record:r})=>r.space===Scene.activeSpace&&sceneEnvironmentVisible(r));
  $("scene-inspector").innerHTML=`<p>${copy("Обозначения карты. Их последствия определяет ведущий.","Map annotations. The narrator resolves their consequences.")}</p>${rows.map(({record:r,kind,meta})=>`<article class="scene-rule-card"><strong>${esc(r.label||meta)}</strong><small>${esc(meta)} · ${r.hidden?copy("Только ведущему","Narrator only"):copy("Видно игрокам","Visible to players")}</small>${gm?`<button type="button" data-scene-remove-${kind}="${esc(r.id)}">${copy("Удалить","Remove")}</button>`:""}</article>`).join("")}`;
}
function manualClockOwner(clock){
  if(!manualTableActive())return undefined;
  if(activeSceneView()==="gm")return null;
  const actor=Scene.actors.find(a=>a.id===(clock?clock.ownerActorId:Scene.selectedActor));
  return actor&&canControlSceneActor(actor)?actor.id:undefined;
}
function manualClockCommand(payload){
  if(!manualTableActive())return null;
  const clock=payload.kind==="clock/create"?null:(Scene.sessionClocks||[]).find(c=>c.id===payload.id&&c.manual);
  if(payload.kind!=="clock/create"&&!clock)return null;
  const actorId=manualClockOwner(clock);
  if(actorId===undefined)return null;
  return commitSceneEvents(manualTableCopy("Ручные часы","Manual clock"),[{type:"table.command",actorId,payload}]);
}
function manualClockScope(){return `${Sync?.state?.()?.sceneId||"local"}:${Scene.tablePolicy?.epoch||0}`}
function renderManualClocks(){
  const dialog=$("manual-table-clocks");if(!dialog?.open)return;
  if(!manualTableActive()||dialog.dataset.scope!==manualClockScope()){dialog.close();return}
  const focused=document.activeElement,editing=focused?.dataset?.manualClockId;
  if(editing){
    const current=Scene.sessionClocks?.find(c=>c.id===editing&&c.manual);
    if(current&&manualClockOwner(current)!==undefined){focused.max=String(current.size);return}
  }
  const list=dialog.querySelector("[data-clock-list]");list.replaceChildren();
  for(const clock of (Scene.sessionClocks||[]).filter(c=>c.manual)){
    // A hidden participant's personal records must not leak through this reader.
    const owner=Scene.actors.find(a=>a.id===clock.ownerActorId);
    if(activeSceneView()!=="gm"&&clock.ownerActorId&&(!owner||owner.hidden))continue;
    const row=document.createElement("div");row.className="manual-clock-row";
    const label=document.createElement("label"),name=document.createElement("span"),input=document.createElement("input"),maximum=document.createElement("small");
    name.textContent=clock.name;input.type="number";input.min="0";input.max=String(clock.size);input.value=String(clock.value);input.required=true;
    input.dataset.manualClockId=clock.id;
    input.setAttribute("aria-label",`${clock.name}: ${manualTableCopy("значение","value")}`);input.disabled=manualClockOwner(clock)===undefined;
    maximum.textContent=`/ ${clock.size}`;label.append(name,input,maximum);
    const save=()=>{const value=Number(input.value),current=Scene.sessionClocks?.find(c=>c.id===clock.id);if(input.checkValidity()&&current&&value!==current.value)manualClockCommand({kind:"clock/set",id:clock.id,value});renderManualClocks()};
    input.addEventListener("change",save);
    input.addEventListener("blur",save);
    input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();save()}});
    const remove=document.createElement("button");remove.type="button";remove.textContent=manualTableCopy("Удалить","Remove");remove.disabled=input.disabled;
    remove.addEventListener("click",()=>{manualClockCommand({kind:"clock/remove",id:clock.id});renderManualClocks()});
    row.append(label,remove);list.append(row);
  }
  if(!list.childElementCount){const empty=document.createElement("p");empty.textContent=manualTableCopy("Ручных часов пока нет.","No manual clocks yet.");list.append(empty)}
  dialog.querySelector('[value="create"]').disabled=manualClockOwner(null)===undefined;
}
function openManualTableClocks(){
  if(!manualTableActive())return;
  let dialog=$("manual-table-clocks");
  if(!dialog){
    dialog=document.createElement("dialog");dialog.id="manual-table-clocks";
    dialog.innerHTML='<h2></h2><div data-clock-list></div><form method="dialog"><label><span data-clock-name></span><input name="name" maxlength="160" required></label><label><span data-clock-kind></span><select name="kind"><option value="progress"></option><option value="danger"></option><option value="counter"></option></select></label><label><span data-clock-size></span><input name="size" type="number" min="1" max="1000000" value="6" required></label><footer><button value="cancel" formnovalidate></button><button type="submit" value="create" class="primary"></button></footer><output aria-live="polite"></output></form>';
    document.body.append(dialog);
    dialog.querySelector("form").addEventListener("submit",event=>{
      if(event.submitter?.value!=="create")return;event.preventDefault();
      if(dialog.dataset.scope!==manualClockScope()){dialog.close();return}
      const form=event.currentTarget,name=form.elements.name.value.trim(),size=Number(form.elements.size.value);
      if(!name||!Number.isSafeInteger(size)||size<1||size>1000000)return;
      const signature=JSON.stringify([dialog.dataset.scope,name,form.elements.kind.value,size]);
      if(form.clockDraft?.signature!==signature)form.clockDraft={signature,id:uid()};
      const id=form.clockDraft.id;
      if(Scene.sessionClocks?.some(c=>c.id===id)){form.elements.name.value="";form.clockDraft=null;renderManualClocks();return}
      const result=manualClockCommand({kind:"clock/create",clock:{id,name,kind:form.elements.kind.value,size,value:0}});
      form.querySelector("output").textContent=result?manualTableCopy("Команда передана. Итог появится после сохранения.","Command submitted. The result appears after saving."):manualTableCopy("Не удалось создать часы.","Could not create the clock.");
      if(result&&Scene.sessionClocks?.some(c=>c.id===id)){form.elements.name.value="";form.clockDraft=null}renderManualClocks();
    });
  }
  dialog.querySelector("h2").textContent=manualTableCopy("Ручные часы","Manual clocks");
  for(const [selector,ru,en] of [['[data-clock-name]',"Название","Name"],['[data-clock-kind]',"Тип","Type"],['[data-clock-size]',"Предел","Limit"],['[value="cancel"]',"Закрыть","Close"],['[value="create"]',"Добавить","Add"],['option[value="progress"]',"Прогресс","Progress"],['option[value="danger"]',"Опасность","Danger"],['option[value="counter"]',"Счётчик","Counter"]])dialog.querySelector(selector).textContent=manualTableCopy(ru,en);
  dialog.dataset.scope=manualClockScope();dialog.showModal();renderManualClocks();
}
function manualTableRoll(count){
  if(!manualTableActive()||!Number.isSafeInteger(count)||count<1||count>30)return null;
  const actor=Scene.actors.find(a=>a.id===Scene.selectedActor);
  if(activeSceneView()!=="gm"&&(!actor||!canControlSceneActor(actor)))return null;
  const result=Logic.rollXd6({count});
  return commitSceneEvents(manualTableCopy("Ручной бросок","Manual roll"),[{type:"table.command",actorId:actor?.id||null,payload:{kind:"roll",roll:{formula:`${count}D6`,rolls:result.rolls,successes:result.successes,crits:result.crits,count}}}]);
}
function openManualTableDice(){
  let dialog=$("manual-table-dice");
  if(!dialog){
    dialog=document.createElement("dialog");dialog.id="manual-table-dice";
    dialog.innerHTML='<form method="dialog"><h2></h2><label><span></span><input type="number" min="1" max="30" value="4" required></label><footer><button value="cancel"></button><button type="submit" value="roll" class="primary"></button></footer></form>';
    document.body.append(dialog);
    dialog.querySelector("form").addEventListener("submit",event=>{if(event.submitter?.value!=="roll")return;event.preventDefault();if(manualTableRoll(Number(dialog.querySelector("input").value)))dialog.close()});
  }
  dialog.querySelector("h2").textContent=manualTableCopy("Ручной бросок","Manual roll");
  dialog.querySelector("label span").textContent=manualTableCopy("Количество D6","Number of D6");
  dialog.querySelector('[value="cancel"]').textContent=manualTableCopy("Отмена","Cancel");
  dialog.querySelector('[value="roll"]').textContent=manualTableCopy("Бросить","Roll");
  dialog.showModal();dialog.querySelector("input").select();
}
function manualTableAbilities(actor){
  if(activeSceneView()!=="gm"&&!canControlSceneActor(actor))return [{id:"access",name:manualTableCopy("Профиль участника","Participant profile"),text:manualTableCopy("Способности этого участника доступны Нарратору.","This participant's abilities are available to the Narrator.")}];
  return window.DAWN_MANUAL_READER_DATA.entries(actor,{english:isEnglishPreview(),enemyProfile,defense:antagonistDefense,techniqueEntries:a=>window.DAWN_LIONWING_TECHNIQUE_SURFACE?.entries?.(a)||[],wordById,t});
}
function renderManualActorInspector(actor){
  const root=$("scene-inspector");if(!root)return;
  if(actor?.hidden&&activeSceneView()!=="gm")actor=null;
  if(!actor){root.innerHTML=`<p>${manualTableCopy("Выберите участника на поле.","Select a participant on the board.")}</p>`;return;}
  const allowed=canControlSceneActor(actor),fields=[["hp","Здоровье","Health"],["maxHp","Максимум ЗД","Maximum HP"],["focus","Фокус","Focus"],["influence","Влияние","Influence"],["stress","Стресс","Stress"]];
  root.innerHTML=`<section class="manual-actor-settings"><h3>${esc(actor.name)}</h3><p>${manualTableCopy("Значения записываются вручную. Последствия определяет Нарратор.","Values are recorded manually. The Narrator decides the consequences.")}</p><div class="scene-stat-grid">${fields.map(([key,ru,en])=>`<label>${manualTableCopy(ru,en)}<input type="number" min="0" max="9999" step="1" data-manual-resource="${key}" data-manual-actor="${esc(actor.id)}" value="${Number(actor[key])||0}" ${allowed?"":"disabled"}></label>`).join("")}</div>${allowed&&Scene.spaces.length>1?`<label>${manualTableCopy("Поле участника","Participant board")}<select data-manual-actor-space="${esc(actor.id)}">${Scene.spaces.map(space=>`<option value="${esc(space.id)}" ${space.id===actor.space?"selected":""}>${esc(space.name)} · ${space.width}×${space.height}</option>`).join("")}</select></label>`:""}${activeSceneView()==="gm"?`<label>${manualTableCopy("Имя","Name")}<input data-scene-actor-name="${esc(actor.id)}" value="${esc(actor.name)}"></label><label>${manualTableCopy("Цвет токена","Token color")}<input type="color" data-scene-token-color="${esc(actor.id)}" value="${esc(actor.tokenColor)}"></label><label class="switch"><input type="checkbox" data-manual-actor-hidden="${esc(actor.id)}" ${actor.hidden?"checked":""}><span>${manualTableCopy("Скрыть токен на поле","Hide token on board")}</span></label><label class="switch"><input type="checkbox" data-manual-initiative-visible="${esc(actor.id)}" ${actor.manualInitiativeVisible??!actor.hidden?"checked":""}><span>${manualTableCopy("Показывать в инициативе","Show in initiative")}</span></label><button type="button" class="danger-quiet" data-scene-remove-actor="${esc(actor.id)}">${manualTableCopy("Убрать участника со стола","Remove participant from table")}</button>`:""}</section>`;
}
document.addEventListener("change",event=>{
  const destination=event.target.closest?.("[data-manual-actor-space]");
  if(destination&&manualTableActive()){
    const actor=Scene.actors.find(a=>a.id===destination.dataset.manualActorSpace),space=Scene.spaces.find(s=>s.id===destination.value);
    if(!actor||!space||!canControlSceneActor(actor)){renderScene();return;}
    const x=clamp(actor.x,0,space.width-1),y=clamp(actor.y,0,space.height-1);
    const result=commitSceneEvents(manualTableCopy("Участник перенесён на другое поле","Participant moved to another board"),[{type:"table.command",actorId:actor.id,payload:{kind:"move",space:space.id,x,y}}]);
    if(result&&!result.pending){Scene.activeSpace=space.id;persist();renderScene();}return;
  }
  const initiativeToggle=event.target.closest?.("[data-manual-initiative-visible]");
  if(initiativeToggle&&manualTableActive()){
    const actor=Scene.actors.find(a=>a.id===initiativeToggle.dataset.manualInitiativeVisible);
    if(!actor||activeSceneView()!=="gm"){renderScene();return;}
    const visible=Boolean(initiativeToggle.checked);
    commitScene(manualTableCopy("Изменена видимость участника в инициативе","Participant initiative visibility changed"),scene=>{const current=scene.actors.find(a=>a.id===actor.id);if(current)current.manualInitiativeVisible=visible});return;
  }
  const visibility=event.target.closest?.("[data-manual-actor-hidden]");
  if(visibility&&manualTableActive()){
    const actor=Scene.actors.find(a=>a.id===visibility.dataset.manualActorHidden);
    if(!actor||activeSceneView()!=="gm"){renderScene();return;}
    const hidden=Boolean(visibility.checked);
    commitScene(manualTableCopy(hidden?"Токен скрыт от игроков":"Токен показан игрокам",hidden?"Token hidden from players":"Token shown to players"),scene=>{const current=scene.actors.find(a=>a.id===actor.id);if(current){if(current.manualInitiativeVisible===undefined)current.manualInitiativeVisible=hidden?Boolean(scene.manualTable?.actorId||scene.manualTable?.round>1):true;current.hidden=hidden}});return;
  }
  if(event.target.id==="scene-manual-status-processing"){
    if(!manualTableActive()||activeSceneView()!=="gm"){renderScene();return;}
    commitSceneEvents(manualTableCopy("Подсказки статусов","Status hints"),[{type:"table.command",actorId:null,payload:{kind:"policy",mode:"manual",processStatuses:Boolean(event.target.checked)}}]);return;
  }
  const input=event.target.closest?.("[data-manual-resource][data-manual-actor]");if(!input||!manualTableActive())return;
  const actor=Scene.actors.find(a=>a.id===input.dataset.manualActor),value=Number(input.value);
  if(!actor||!canControlSceneActor(actor)||!input.value.trim()||!Number.isSafeInteger(value)||value<0||value>9999){renderScene();return;}
  setNarratorActorValue(actor,input.dataset.manualResource,value);
});
function openManualActorReader(actorId){
  if(!manualTableActive())return false;
  const actor=Scene.actors.find(a=>a.id===actorId);if(!actor||activeSceneView()!=="gm"&&actor.hidden)return false;
  Scene.selectedActor=actor.id;Scene.activeSpace=actor.space;persist();renderScene();
  return window.DAWN_MANUAL_WORKSPACE.open(actor.id);
}
function renderManualTable(){
  renderManualClocks();
  renderManualMapTools();
  document.body.dataset.tablePolicy=manualTableActive()?"manual":"rules";
  const sizeLabel=$("scene-space-size-label");if(sizeLabel?.firstChild)sizeLabel.firstChild.textContent=manualTableCopy("Размер нового поля","New board size");
  const selector=$("scene-control-mode");if(selector)selector.value=manualTableActive()?"manual":"rules";
  const hints=$("scene-manual-status-processing");if(hints){hints.checked=Boolean(Scene.tablePolicy?.processStatuses);hints.closest("label").hidden=!manualTableActive();}
  for(const button of document.querySelectorAll('#scene-dock [data-scene-panel="director"],#scene-dock [data-scene-panel="sheet"],#scene-dock [data-scene-panel="utility"],#scene-dock [data-scene-panel="entities"]'))button.hidden=manualTableActive();
  if(manualTableActive()&&["director","sheet","utility","entities"].includes(activeScenePanel))closeAllScenePanels();
  window.DAWN_MANUAL_WORKSPACE?.render({scene:Scene,canNarrate:activeSceneView()==="gm",canControl:canControlSceneActor,
    scopeId:Sync?.state?.()?.sceneId||"local",
    canRead:actor=>activeSceneView()==="gm"||!actor.hidden,
    commit:commitSceneEvents,readAbilities:manualTableAbilities,
    selectActor:actor=>{Scene.selectedActor=actor.id;persist();renderScene()},
    roll:openManualTableDice,
    openClocks:openManualTableClocks,
    statuses:actor=>(actor.manualStatuses||[]).map(id=>{const effect=sceneEffectList().find(e=>e.id===id);return{id,name:effect?.name||id,icon:"effects",hint:effect?.text||""}}),
    statusHints:Boolean(Scene.tablePolicy?.processStatuses),
    toggleTechnique:(actor,entry,on)=>commitSceneEvents(manualTableCopy("Пометка Техники","Technique note"),[{type:"table.command",actorId:actor.id,payload:{kind:"technique",key:entry.id,enabled:on}}])
  });
}
window.DAWN_TABLE_POLICY?.install();
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape"||!manualTableActive()||!document.body.classList.contains("scene-mode")||!["area","wall","marker","erase"].includes(activeSceneTool())||event.target.closest?.("input,select,textarea,dialog,[contenteditable]")||window.DAWN_TABLE_POLICY.pendingWork(Scene)||sceneHasLocalPendingSelection())return;
  event.preventDefault();event.stopImmediatePropagation();scenePreviewCells.clear();sceneWallPreviewPoint=null;
  document.querySelectorAll(".scene-cell.preview,.scene-erase-preview").forEach(node=>node.classList.remove("preview","scene-erase-preview"));
  document.querySelectorAll(".scene-wall-preview,.scene-erase-label").forEach(node=>node.remove());
},true);
const sceneEventTextWithRules=eventText;
eventText=function(event){
  if(event.type==="table.command"&&event.payload?.kind==="roll"){
    const roll=event.payload.roll,actor=Scene.actors.find(a=>a.id===event.actorId);
    return `${actor?.name||manualTableCopy("Стол","Table")}: ${roll.formula} · ${roll.rolls.join(", ")} → ${roll.successes} ${manualTableCopy("успехов","hits")}`;
  }
  return sceneEventTextWithRules(event);
};
const renderSceneWithRules=renderScene;
renderScene=function(){if(manualTableActive()&&["director","sheet","utility","entities"].includes(activeScenePanel))closeAllScenePanels();const result=renderSceneWithRules.apply(this,arguments);renderManualTable();return result};
const numericCorrectionWithRules=setNarratorActorValue;
setNarratorActorValue=function(actor,key,value,label=""){
  if(!manualTableActive())return numericCorrectionWithRules.apply(this,arguments);
  if(!canControlSceneActor(actor))return null;
  return commitSceneEvents(label||`${actor.name}: ${key} = ${value}`,[{type:"table.command",actorId:actor.id,payload:{kind:"resource",values:{[key]:Number(value)}}}]);
};
const narratorEffectsWithRules=setNarratorEffect;
setNarratorEffect=function(actor,effectId,remove){
  if(!manualTableActive())return narratorEffectsWithRules.apply(this,arguments);
  if(!canControlSceneActor(actor))return null;
  return commitSceneEvents(manualTableCopy("Пометка статуса","Status note"),[{type:"table.command",actorId:actor.id,payload:{kind:"status",effectId,enabled:!remove}}]);
};
