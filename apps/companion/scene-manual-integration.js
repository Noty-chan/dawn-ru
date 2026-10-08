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
function manualAreaDraftActor(draft){
  if(!draft||!manualTableActive()||draft.scope!==manualClockScope())return null;
  const actor=Scene.actors.find(a=>a.id===draft.actorId),space=Scene.spaces.find(s=>s.id===draft.space);
  if(!actor||!space||actor.space!==space.id||Scene.activeSpace!==space.id||!canControlSceneActor(actor)||activeSceneView()!=="gm"&&actor.hidden)return null;
  const entry=manualTableAbilities(actor).find(row=>row.id===draft.entryId);
  return entry?.area&&entry.text===draft.text?actor:null;
}
function manualAreaDraftPayload(draft,values){
  const actor=manualAreaDraftActor(draft),space=Scene.spaces.find(s=>s.id===draft?.space);
  if(!actor||!["cell","adjacent","square2","square3","square5","radius2","lineH","lineV"].includes(values.shape))return null;
  const x=Number(values.x),y=Number(values.y);
  if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||x<0||y<0||x>=space.width||y>=space.height)return null;
  const cells=Logic.areaCells({shape:values.shape,x,y,width:space.width,height:space.height});
  return {kind:"area/create",area:{id:draft.id,space:space.id,cells,label:draft.name.slice(0,200),color:"#65c8d0",appearance:"custom",hidden:false}};
}
// Transient placement lives in the tool palette, never in Scene/targets.
function clearManualAreaPreview(){
  document.querySelectorAll('.manual-area-preview').forEach(node=>node.classList.remove('manual-area-preview'));
}
function renderManualAreaDraft(){
  const panel=$("manual-table-area-tools");if(!panel)return;
  const draft=panel.areaDraft,actor=manualAreaDraftActor(draft);
  if(draft&&(!actor||Scene.objects.some(row=>row.id===draft.id))){panel.areaDraft=null;clearManualAreaPreview();}
  const current=panel.areaDraft;
  panel.dataset.placement=current?'armed':'idle';
  for(const [selector,ru,en] of [
    ['[data-area-source]','Способность','Ability'],['[data-area-shape]','Форма','Shape'],
    ['[data-area-note]','Наведите на поле → кликните для размещения. Escape — отмена. Это только обозначение.','Hover over the board → click to place. Escape cancels. Annotation only.'],
    ['[data-area-cancel]','Отмена размещения','Cancel placement'],['[data-area-recheck]','Проверить сохранение','Check save']
  ]){const node=panel.querySelector(selector);if(node)node.textContent=manualTableCopy(ru,en);}
  const shapeNames={cell:['Клетка','Cell'],adjacent:['Крест','Cross'],square2:['Квадрат 2×2','Square 2×2'],square3:['Квадрат 3×3','Square 3×3'],square5:['Квадрат 5×5','Square 5×5'],radius2:['Радиус 2','Radius 2'],lineH:['Горизонталь','Horizontal line'],lineV:['Вертикаль','Vertical line']};
  for(const option of panel.querySelector('[name="shape"]').options||[]){const names=shapeNames[option.value];if(names)option.textContent=manualTableCopy(...names);}
  panel.querySelector('[data-area-name]').textContent=current?.name||manualTableCopy("Выберите способность в описании участника","Choose an ability in the actor reader");
  panel.querySelector('[name="shape"]').disabled=!current||Boolean(current.pending);
  const source=panel.querySelector('[name="source"]');if(source){
    source.disabled=!current||Boolean(current.pending);
    if(!current){source.replaceChildren();source.value='';panel.querySelector('output').textContent='';}
  }
  panel.querySelector('[data-area-cancel]').disabled=!current;
  panel.querySelector('[data-area-recheck]').hidden=!current?.pending;
  panel.querySelector('[data-area-existing]').innerHTML=(Scene.objects||[]).filter(row=>row.space===Scene.activeSpace&&row.type==='manual-area'&&sceneEnvironmentVisible(row)&&Scene.actors.some(a=>a.id===row.ownerActorId&&canControlSceneActor(a))).map(row=>`<div><span>${esc(row.label)}</span><button type="button" data-manual-area-remove="${esc(row.id)}">${manualTableCopy("Убрать","Remove")}</button></div>`).join('');
  const list=panel.querySelector('[data-area-list]');if(list){const count=panel.querySelector('[data-area-existing]').children.length;list.hidden=!count;list.querySelector('summary').textContent=manualTableCopy(`Поставленные области: ${count}`,`Placed areas: ${count}`);}
  const trigger=$("manual-table-area-tool");if(trigger){trigger.hidden=!manualTableActive();trigger.title=manualTableCopy('Подсветка способности','Ability highlight');trigger.setAttribute('aria-label',trigger.title);trigger.setAttribute('aria-pressed',String(Boolean(current)));}
  panel.hidden=!manualTableActive()||!usingNextSceneInterface()&&!current;
  const category=$('scene-board-category-highlights');if(category)category.hidden=!manualTableActive();
}
async function recheckManualAreaDraft(panel){
  const current=panel.areaDraft,output=panel.querySelector('output');if(!current?.pending||!manualAreaDraftActor(current))return;
  try{
    if(Sync?.state?.()?.sceneId)await Sync.refreshScene();
    renderManualAreaDraft();
    if(panel.areaDraft!==current||!manualAreaDraftActor(current))return;
    const queued=typeof networkV2QueueStatus==='function'?networkV2QueueStatus():{pending:0,failed:0};
    if(queued.pending||queued.failed){output.textContent=manualTableCopy("Сначала завершите сохранение в разделе «Сеть».","Finish saving in Network first.");return;}
    // Absence from a refreshed snapshot is not a rejection: the player's
    // command may still be waiting for authority after the outbox has drained.
    output.textContent=manualTableCopy("Стол обновлён. Ожидаем принятия или отказа; повторная отправка закрыта.","Table refreshed. Waiting for acceptance or rejection; resend is blocked.");
  }catch(error){output.textContent=manualTableCopy("Не удалось обновить стол. Повторите после восстановления связи.","Could not refresh the table. Retry after reconnecting.");}
}
function reconcileManualAreaDraft(command){
  const panel=$("manual-table-area-tools"),draft=panel?.areaDraft;
  if(!draft?.pending)return;
  renderManualAreaDraft();if(panel.areaDraft!==draft)return;
  const intentId=command?.payload?.clientIntentId||command?.clientIntentId;
  if(command?.status!=="rejected"||!draft.clientIntentId||intentId!==draft.clientIntentId)return;
  draft.pending=false;
  panel.querySelector('output').textContent=manualTableCopy("Область не принята. Проверьте условия и повторите размещение.","Area rejected. Check the conditions and place it again.");
  renderManualAreaDraft();
}
function submitManualAreaDraft(panel,values){
  const current=panel.areaDraft,payload=manualAreaDraftPayload(current,values);
  if(current?.pending||!payload)return null;
  const result=commitSceneEvents(manualTableCopy("Показана область способности","Ability area shown"),[{type:'table.command',actorId:current.actorId,payload}]);
  if(result?.pending){current.pending=true;current.clientIntentId=result.clientIntentId||null;}
  return result;
}
function ensureManualAreaTools(){
  let panel=$("manual-table-area-tools");if(panel)return panel;
  const toolbar=document.querySelector('.scene-toolbar');if(!toolbar)return null;
  const trigger=document.createElement('button');trigger.type='button';trigger.id='manual-table-area-tool';
  trigger.className='manual-area-tool';trigger.innerHTML=window.DAWN_UI_ICONS?.html('areas')||'✦';trigger.title=manualTableCopy('Подсветка способности','Ability highlight');trigger.setAttribute('aria-label',trigger.title);
  trigger.addEventListener('click',()=>{
    const actor=Scene.actors.find(a=>a.id===Scene.selectedActor),entry=actor&&manualTableAbilities(actor).find(row=>row.area);
    if(actor&&entry)openManualTableArea(actor,entry);
    else toast(manualTableCopy('Выберите участника и способность в его описании.','Select an actor and an ability in its reader.'));
  });
  panel=document.createElement('section');panel.id='manual-table-area-tools';panel.className='scene-area-controls manual-area-tools';
  panel.innerHTML='<strong data-area-name></strong><label><span data-area-source></span><select name="source"></select></label><label><span data-area-shape></span><select name="shape"></select></label><p data-area-note></p><details data-area-list><summary></summary><div data-area-existing></div></details><button type="button" data-area-cancel></button><button type="button" data-area-recheck hidden></button><output aria-live="polite"></output>';
  panel.querySelector('[data-area-source]').textContent=manualTableCopy('Способность','Ability');
  panel.querySelector('[data-area-shape]').textContent=manualTableCopy('Форма','Shape');
  panel.querySelector('[data-area-note]').textContent=manualTableCopy('Наведите на поле → кликните для размещения. Escape — отмена. Это только обозначение.','Hover over the board → click to place. Escape cancels. Annotation only.');
  panel.querySelector('[data-area-cancel]').textContent=manualTableCopy('Отмена размещения','Cancel placement');
  panel.querySelector('[data-area-recheck]').textContent=manualTableCopy('Проверить сохранение','Check save');
  const shapes=[['cell','Клетка','Cell'],['adjacent','Крест','Cross'],['square2','Квадрат 2×2','Square 2×2'],['square3','Квадрат 3×3','Square 3×3'],['square5','Квадрат 5×5','Square 5×5'],['radius2','Радиус 2','Radius 2'],['lineH','Горизонталь','Horizontal line'],['lineV','Вертикаль','Vertical line']];
  panel.querySelector('[name="shape"]').innerHTML=shapes.map(([value,ru,en])=>`<option value="${value}">${manualTableCopy(ru,en)}</option>`).join('');
  panel.addEventListener('change',event=>{
    clearManualAreaPreview();if(event.target.name!=='source')return;
    const actor=manualAreaDraftActor(panel.areaDraft),entry=actor&&manualTableAbilities(actor).find(row=>row.id===event.target.value);
    if(actor&&entry?.area&&!panel.areaDraft.pending)openManualTableArea(actor,entry);
  });
  panel.addEventListener('click',event=>{
    if(event.target.closest('[data-area-cancel]')){panel.areaDraft=null;clearManualAreaPreview();renderManualAreaDraft();return;}
    if(event.target.closest('[data-area-recheck]')){recheckManualAreaDraft(panel);return;}
    const button=event.target.closest('[data-manual-area-remove]');if(!button)return;
    const area=Scene.objects.find(row=>row.id===button.dataset.manualAreaRemove&&row.type==='manual-area'),actor=Scene.actors.find(a=>a.id===area?.ownerActorId);
    if(!manualTableActive()||!actor||!canControlSceneActor(actor)||!sceneEnvironmentVisible(area))return;
    commitSceneEvents(manualTableCopy('Убрана область способности','Ability area removed'),[{type:'table.command',actorId:actor.id,payload:{kind:'area/remove',id:area.id}}]);renderManualAreaDraft();
  });
  toolbar.append(trigger,panel);window.DAWN_SCENE_BOARD_TOOLS?.enhance();
  const board=$("scene-board");
  const preview=event=>{
    const draft=panel.areaDraft;if(!draft)return;
    event.stopImmediatePropagation();clearManualAreaPreview();
    if(draft.pending)return;
    const cell=event.target.closest('[data-scene-cell]');if(!cell)return;
    const [x,y]=cell.dataset.sceneCell.split(',').map(Number),payload=manualAreaDraftPayload(draft,{shape:panel.querySelector('[name="shape"]').value,x,y});
    for(const key of payload?.area.cells||[])board.querySelector(`[data-scene-cell="${CSS.escape(key)}"]`)?.classList.add('manual-area-preview');
  };
  board.addEventListener('mouseover',preview,true);
  board.addEventListener('mouseleave',clearManualAreaPreview);
  board.addEventListener('click',event=>{
    if(!panel.areaDraft)return;
    event.preventDefault();event.stopImmediatePropagation();
    const cell=event.target.closest('[data-scene-cell]');if(!cell)return;
    const [x,y]=cell.dataset.sceneCell.split(',').map(Number),draft=panel.areaDraft;
    const result=submitManualAreaDraft(panel,{shape:panel.querySelector('[name="shape"]').value,x,y});
    if(result?.pending){panel.querySelector('output').textContent=manualTableCopy('Отправлено; ожидаем принятия.','Sent; waiting for acceptance.');}
    else if(result){panel.areaDraft=null;clearManualAreaPreview();}
    else if(!manualAreaDraftActor(draft)){panel.areaDraft=null;clearManualAreaPreview();}
    renderManualAreaDraft();
  },true);
  // Do not drag a token while placing an informational area.
  for(const type of ['pointerdown','dragstart','contextmenu'])board.addEventListener(type,event=>{if(panel.areaDraft){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!panel.areaDraft)return;
    event.preventDefault();event.stopImmediatePropagation();panel.areaDraft=null;clearManualAreaPreview();renderManualAreaDraft();
  },true);
  toolbar.addEventListener('scene-board-category-change',event=>{
    if(event.detail.id==='highlights')return;panel.areaDraft=null;clearManualAreaPreview();renderManualAreaDraft();
  });
  document.querySelector('.scene-toolbar')?.addEventListener('click',event=>{
    const category=event.target.closest('.scene-board-tool-category');
    if(!event.target.closest('[data-scene-tool]')&&(!category||category.id==='scene-board-category-highlights'))return;
    panel.areaDraft=null;clearManualAreaPreview();renderManualAreaDraft();
  },true);
  return panel;
}
function openManualTableArea(actor,entry){
  const draft={id:uid(),actorId:actor.id,entryId:entry.id,text:entry.text,name:entry.name,space:actor.space,scope:manualClockScope()};
  if(!manualAreaDraftActor(draft))return false;
  const panel=ensureManualAreaTools();if(!panel||panel.areaDraft?.pending)return false;
  // Leave the previous brush before arming: a finished highlight must not
  // silently fall back to painting terrain or targeting a token.
  if(activeSceneTool()!=='select'){changeSceneTool('select');window.DAWN_SCENE_BOARD_TOOLS?.enhance();}
  panel.areaDraft=draft;panel.querySelector('output').textContent='';
  const source=panel.querySelector('[name="source"]');source.innerHTML=manualTableAbilities(actor).filter(row=>row.area).map(row=>`<option value="${esc(row.id)}">${esc(row.name)}</option>`).join('');source.value=entry.id;
  window.DAWN_MANUAL_WORKSPACE?.closeReader?.();closeAllScenePanels();
  window.DAWN_SCENE_BOARD_TOOLS?.enhance();window.DAWN_SCENE_BOARD_TOOLS?.select('highlights');
  renderManualAreaDraft();return true;
}
function manualClockOwner(clock){
  if(!manualTableActive())return undefined;
  if(activeSceneView()==="gm")return null;
  const actor=Scene.actors.find(a=>a.id===(clock?clock.ownerActorId:Scene.selectedActor));
  return actor&&!actor.hidden&&canControlSceneActor(actor)?actor.id:undefined;
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
function manualClockVisibilityScope(){
  return JSON.stringify([activeSceneView(),(Scene.sessionClocks||[]).filter(c=>c.manual).map(c=>{const owner=Scene.actors.find(a=>a.id===c.ownerActorId);return[c.id,c.ownerActorId,Boolean(owner?.hidden),Boolean(owner&&canControlSceneActor(owner))]})]);
}
function renderManualClocks(){
  const dialog=$("manual-table-clocks");if(!dialog?.open)return;
  if(!manualTableActive()||dialog.dataset.scope!==manualClockScope()){dialog.close();return}
  const visibility=manualClockVisibilityScope(),focused=document.activeElement,editing=focused?.dataset?.manualClockId;
  if(editing&&dialog.dataset.visibility===visibility){
    const current=Scene.sessionClocks?.find(c=>c.id===editing&&c.manual);
    if(current&&manualClockOwner(current)!==undefined){focused.max=String(current.size);return}
  }
  dialog.dataset.visibility=visibility;
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
  root.innerHTML=`<section class="manual-actor-settings"><h3>${esc(actor.name)}</h3><p>${manualTableCopy("Значения записываются вручную. Последствия определяет Нарратор.","Values are recorded manually. The Narrator decides the consequences.")}</p><div class="scene-stat-grid">${fields.map(([key,ru,en])=>`<label>${manualTableCopy(ru,en)}<input type="number" min="0" max="${window.DAWN_TABLE_POLICY?.resourceMaximum?.(actor,key)??9999}" step="1" data-manual-resource="${key}" data-manual-actor="${esc(actor.id)}" value="${Number(actor[key])||0}" ${allowed?"":"disabled"}></label>`).join("")}</div>${allowed&&Scene.spaces.length>1?`<label>${manualTableCopy("Поле участника","Participant board")}<select data-manual-actor-space="${esc(actor.id)}">${Scene.spaces.map(space=>`<option value="${esc(space.id)}" ${space.id===actor.space?"selected":""}>${esc(space.name)} · ${space.width}×${space.height}</option>`).join("")}</select></label>`:""}${activeSceneView()==="gm"?`<label>${manualTableCopy("Имя","Name")}<input data-scene-actor-name="${esc(actor.id)}" value="${esc(actor.name)}"></label><label>${manualTableCopy("Цвет токена","Token color")}<input type="color" data-scene-token-color="${esc(actor.id)}" value="${esc(actor.tokenColor)}"></label><label class="switch"><input type="checkbox" data-manual-actor-hidden="${esc(actor.id)}" ${actor.hidden?"checked":""}><span>${manualTableCopy("Скрыть токен на поле","Hide token on board")}</span></label><label class="switch"><input type="checkbox" data-manual-initiative-visible="${esc(actor.id)}" ${actor.manualInitiativeVisible??!actor.hidden?"checked":""}><span>${manualTableCopy("Показывать в инициативе","Show in initiative")}</span></label><button type="button" class="danger-quiet" data-scene-remove-actor="${esc(actor.id)}">${manualTableCopy("Убрать участника со стола","Remove participant from table")}</button>`:""}</section>`;
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
  if(manualTableActive())ensureManualAreaTools();
  renderManualAreaDraft();
  renderManualClocks();
  renderManualMapTools();
  const manual=manualTableActive(),crowdAdd=$("scene-add-crowd-auto"),crowdBrush=$("scene-add-crowd-brush"),trait=$("scene-enemy-trait");
  if(crowdAdd){crowdAdd.textContent=manual?manualTableCopy("Добавить на свободные клетки","Add to empty cells"):manualTableCopy("Добавить автоматически","Add automatically");}
  if(crowdBrush)crowdBrush.hidden=manual;
  if(trait?.closest("label"))trait.closest("label").hidden=manual;

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
    beforeRead:()=>{for(const menu of document.querySelectorAll(".scene-chrome-menu[open]"))menu.open=false;closeAllScenePanels();},
    selectActor:actor=>{Scene.selectedActor=actor.id;persist();renderScene()},
    roll:openManualTableDice,
    openClocks:openManualTableClocks,
    showArea:openManualTableArea,
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
