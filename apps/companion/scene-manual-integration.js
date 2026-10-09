"use strict";

// Connects the shared manual policy to the existing single Scene writer.
function manualTableActive(){return Boolean(window.DAWN_TABLE_POLICY?.isManual(Scene))}
function manualTableCopy(ru,en){return isEnglishPreview()?en:ru}
function placeManualMapObject(tool,{x,y,cells:paintedCells,settings}){
  if(!manualTableActive()||activeSceneView()!=="gm")return null;
  if(window.DAWN_TABLE_POLICY.pendingWork(Scene)||sceneHasLocalPendingSelection())return toast(manualTableCopy("Сначала завершите ожидающее действие.","Finish the pending workflow first."));
  const space=activeSceneSpace();let payload;
  if(tool==="area"){
    const appearance=settings?.appearance??$("scene-area-type").value;if(!["terrain","difficult","high","low","custom"].includes(appearance))return null;
    const cells=paintedCells??Logic.areaCells({shape:$("scene-area-shape").value,x,y,width:space.width,height:space.height});
    payload={kind:"area/create",area:{id:uid(),space:space.id,cells,appearance,label:(settings?.label??$("scene-area-label").value).trim()||sceneObjectDisplayName({type:"manual-area",appearance}),color:settings?.color??$("scene-manual-area-color").value,hidden:settings?.hidden??$("scene-manual-area-hidden").checked}};
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
// One brush gesture is one typed area, one server command and one Undo step.
function installManualTerrainBrush(){
  const board=$('scene-board');if(!board)return;if(board.manualBrushInstalled){board.manualBrushRefresh?.();return;}
  board.manualBrushInstalled=true;let draft=null,suppressUntil=0;
  const signature=()=>`${manualClockScope()}:${Scene.version}:${Scene.activeSpace}:${activeSceneSpace()?.width}:${activeSceneSpace()?.height}:${activeSceneView()}:${activeSceneTool()}`;
  const reset=()=>{draft=null;clearManualAreaPreview();};
  const cancel=()=>{if(draft)suppressUntil=performance.now()+250;reset();};
  const usable=()=>manualTableActive()&&activeSceneView()==='gm'&&usingNextSceneInterface()&&activeSceneTool()==='area'&&!$('manual-table-area-tools')?.areaDraft&&!window.DAWN_TABLE_POLICY.pendingWork(Scene)&&!sceneHasLocalPendingSelection()&&!window.DAWN_SCENE_PRESENTATIONS?.isActive?.();
  const point=event=>{const cell=event.target.closest?.('[data-scene-cell]');if(!cell||!board.contains(cell))return null;const[x,y]=cell.dataset.sceneCell.split(',').map(Number);return{x,y};};
  const valid=()=>draft&&draft.signature===signature()&&usable();
  board.manualBrushRefresh=()=>{if(draft&&!valid())cancel();};
  const extend=p=>{
    let anchors;try{anchors=window.DAWN_PRESENTATION_MODEL.geometry('line',draft.last,p,draft.space);}catch{cancel();return false;}
    const cells=new Set(draft.cells);
    for(const key of anchors){const[x,y]=key.split(',').map(Number);for(const cell of Logic.areaCells({shape:draft.shape,x,y,width:draft.space.width,height:draft.space.height}))cells.add(cell);}
    if(cells.size>128){cancel();toast(manualTableCopy('Один мазок — не больше 128 клеток.','A brush stroke may contain up to 128 cells.'));return false;}
    draft.cells=cells;draft.last=p;clearManualAreaPreview();
    for(const key of cells)board.querySelector(`[data-scene-cell="${CSS.escape(key)}"]`)?.classList.add('manual-area-preview');return true;
  };
  board.addEventListener('pointerdown',event=>{
    if(event.button!==0||manualAreaCameraGesture(event)||!usable())return;
    const p=point(event);if(!p)return;
    event.preventDefault();event.stopImmediatePropagation();
    const space=activeSceneSpace();draft={signature:signature(),pointerId:event.pointerId,space:{...space},last:p,cells:new Set(),shape:$('scene-area-shape').value,settings:{appearance:$('scene-area-type').value,label:$('scene-area-label').value,color:$('scene-manual-area-color').value,hidden:$('scene-manual-area-hidden').checked}};
    extend(p);
  },true);
  board.addEventListener('pointermove',event=>{
    if(!draft)return;if(!valid()||manualAreaCameraGesture(event)){cancel();return;}
    if(event.pointerId!==draft.pointerId)return;
    event.stopImmediatePropagation();const p=point(event);if(p)extend(p);
  },true);
  board.addEventListener('mouseover',event=>{if(draft)event.stopImmediatePropagation();},true);
  board.addEventListener('pointerup',event=>{
    if(!draft)return;event.preventDefault();event.stopImmediatePropagation();
    if(event.pointerId!==draft.pointerId||!valid()||manualAreaCameraGesture(event)||!point(event)){cancel();return;}
    if(!extend(point(event)))return;
    const finished=draft;reset();suppressUntil=performance.now()+250;
    placeManualMapObject('area',{...finished.last,cells:[...finished.cells],settings:finished.settings});
  },true);
  board.addEventListener('click',event=>{if(performance.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('pointerup',event=>{if(draft&&!board.contains(event.target))cancel();},true);
  document.addEventListener('pointercancel',cancel,true);
  document.addEventListener('keydown',event=>{if(draft&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  window.addEventListener('blur',cancel);
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
function manualAreaCameraGesture(event){
  return event?.button===1||(typeof sceneSpaceHeld!=='undefined'&&sceneSpaceHeld)||(typeof scenePanState!=='undefined'&&Boolean(scenePanState));
}
function manualAreaCameraClickSuppressed(){return typeof sceneSuppressBoardClickUntil!=='undefined'&&performance.now()<sceneSuppressBoardClickUntil;}
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
    if(manualAreaCameraGesture(event)){clearManualAreaPreview();return;}
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
    if(manualAreaCameraGesture(event)||manualAreaCameraClickSuppressed()){event.preventDefault();event.stopImmediatePropagation();clearManualAreaPreview();return;}
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
  for(const type of ['pointerdown','dragstart','contextmenu'])board.addEventListener(type,event=>{if(panel.areaDraft){if(type==='pointerdown'&&manualAreaCameraGesture(event)){clearManualAreaPreview();return;}event.preventDefault();event.stopImmediatePropagation();}},true);
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
  const event={id:uid(),type:"table.command",actorId,payload};
  const result=commitSceneEvents(manualTableCopy("Ручные часы","Manual clock"),[event]);
  return result?{...result,manualEventIds:[event.id]}:null;
}
function manualClockScope(){return `${Sync?.state?.()?.sceneId||"local"}:${Scene.tablePolicy?.epoch||0}`}
function reconcileManualClockNumbers(command,events=[]){
  const dialog=$("manual-table-clocks"),root=$("scene-inspector"),scope=manualClockScope();
  const inputs=[...(dialog?.open&&dialog.dataset.scope===scope?dialog.querySelectorAll('[data-manual-clock-id]'):[]),...(root?.manualActorScope===scope?root.querySelectorAll('[data-manual-resource]'):[])];
  const intentId=command?.payload?.clientIntentId||command?.clientIntentId,ids=new Set(events.map(event=>event.id));
  for(const input of inputs){
    const receipt=input.manualSubmission;
    if(receipt&&((command?.status==='rejected'&&intentId&&receipt.clientIntentId===intentId)||(receipt.manualEventIds||[]).some(id=>ids.has(id)))){delete input.manualSubmitted;delete input.manualSubmission;}
  }
}
function manualClockVisibilityScope(){
  return JSON.stringify([activeSceneView(),(Scene.sessionClocks||[]).filter(c=>c.manual).map(c=>{const owner=Scene.actors.find(a=>a.id===c.ownerActorId);return[c.id,c.ownerActorId,Boolean(owner?.hidden),Boolean(owner&&canControlSceneActor(owner))]})]);
}
let paintingManualClocks=false;
function renderManualClocks(){
  const dialog=$("manual-table-clocks");if(!dialog?.open)return;
  const active=document.activeElement,clock=Scene.sessionClocks?.find(row=>row.id===active?.dataset?.manualClockId&&row.manual);
  const keep=dialog.dataset.scope===manualClockScope()&&dialog.manualClockRole===activeSceneView()&&clock&&dialog.contains(active)&&manualClockOwner(clock)!==undefined;
  const draft=keep?{id:clock.id,value:active.value,submitted:active.manualSubmitted,receipt:active.manualSubmission}:null;
  dialog.manualClockRole=activeSceneView();paintingManualClocks=true;
  try{drawManualClocks();}finally{paintingManualClocks=false;}
  if(draft&&dialog.open){const input=Array.from(dialog.querySelectorAll('[data-manual-clock-id]')).find(node=>node.dataset.manualClockId===draft.id);if(input&&!input.disabled){input.value=draft.value;if(draft.submitted===draft.value){input.manualSubmitted=draft.submitted;input.manualSubmission=draft.receipt;}input.focus({preventScroll:true});}}
}
function drawManualClocks(){
  const dialog=$("manual-table-clocks");if(!dialog?.open)return;
  if(!manualTableActive()||dialog.dataset.scope!==manualClockScope()){dialog.close();return}
  const visibility=manualClockVisibilityScope(),focused=document.activeElement,editing=focused?.dataset?.manualClockId;
  if(editing&&dialog.dataset.visibility===visibility){
    const current=Scene.sessionClocks?.find(c=>c.id===editing&&c.manual);
    if(current&&manualClockOwner(current)!==undefined){focused.max=String(current.size);return}
  }
  dialog.dataset.visibility=visibility;
  const list=dialog.querySelector("[data-clock-list]");list.replaceChildren();
  const groups=new Map();
  for(const clock of (Scene.sessionClocks||[]).filter(c=>c.manual)){
    // A hidden participant's personal records must not leak through this reader.
    const owner=Scene.actors.find(a=>a.id===clock.ownerActorId);
    if(activeSceneView()!=="gm"&&clock.ownerActorId&&(!owner||owner.hidden))continue;
    const kind=["progress","danger","counter"].includes(clock.kind)?clock.kind:"counter";
    if(!groups.has(kind)){
      const section=document.createElement("section"),heading=document.createElement("h3");section.className=`manual-clock-section ${kind}`;
      heading.textContent=kind==="progress"?manualTableCopy("Прогресс","Progress"):kind==="danger"?manualTableCopy("Опасность","Danger"):manualTableCopy("Счётчики","Counters");
      section.append(heading);groups.set(kind,section);list.append(section);
    }
    const row=document.createElement("div");row.className="manual-clock-row";
    const label=document.createElement("label"),name=document.createElement("span"),input=document.createElement("input"),maximum=document.createElement("small");
    name.textContent=clock.name;input.type="number";input.min="0";input.max=String(clock.size);input.value=String(clock.value);input.required=true;
    input.dataset.manualClockId=clock.id;
    input.setAttribute("aria-label",`${clock.name}: ${manualTableCopy("значение","value")}`);input.disabled=manualClockOwner(clock)===undefined;
    maximum.textContent=`/ ${clock.size}`;label.append(name,input,maximum);
    const save=()=>{
      if(paintingManualClocks||!dialog.contains(input)||dialog.dataset.scope!==manualClockScope()||dialog.dataset.visibility!==manualClockVisibilityScope()||manualClockOwner(clock)===undefined)return;
      const value=Number(input.value),current=Scene.sessionClocks?.find(c=>c.id===clock.id);
      if(input.value.trim()&&input.checkValidity()&&current&&value!==current.value&&input.manualSubmitted!==input.value){
        const draft=input.value;input.manualSubmitted=draft;
        const result=manualClockCommand({kind:"clock/set",id:clock.id,value});
        if(result)input.manualSubmission=result;else{delete input.manualSubmitted;delete input.manualSubmission;}
      }
      // The canonical writer/render updates the dialog when it settles. A
      // blur must not rebuild the controls and steal the next Tab target.
    };
    input.addEventListener("change",save);
    input.addEventListener("blur",save);
    input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();save()}});
    const remove=document.createElement("button");remove.type="button";remove.textContent=manualTableCopy("Удалить","Remove");remove.disabled=input.disabled;
    remove.addEventListener("click",()=>{manualClockCommand({kind:"clock/remove",id:clock.id});renderManualClocks()});
    const meter=document.createElement("div");meter.className="manual-clock-meter";meter.setAttribute("aria-hidden","true");
    const segments=Math.min(12,clock.size);
    for(let index=0;index<segments;index++){const segment=document.createElement("i");segment.className=clock.value/clock.size>index/segments?"filled":"";meter.append(segment);}
    const controls=document.createElement("div");controls.className="manual-clock-controls";
    for(const delta of [-1,1]){const button=document.createElement("button");button.type="button";button.textContent=delta<0?"−":"+";button.disabled=input.disabled;button.setAttribute("aria-label",`${clock.name}: ${delta<0?manualTableCopy("убавить","decrease"):manualTableCopy("добавить","increase")}`);button.addEventListener("click",()=>{if(dialog.dataset.scope!==manualClockScope()||manualClockOwner(clock)===undefined)return;const current=Scene.sessionClocks?.find(c=>c.id===clock.id);if(!current)return;const value=Math.max(0,Math.min(current.size,current.value+delta));if(value!==current.value)manualClockCommand({kind:"clock/set",id:clock.id,value});});controls.append(button);}
    controls.append(remove);row.append(label,meter,controls);groups.get(kind).append(row);
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
    dialog.innerHTML='<form method="dialog"><h2></h2><p data-dice-source></p><div class="manual-dice-attributes"></div><label><span></span><input type="number" min="1" max="30" value="4" required></label><footer><button value="cancel"></button><button type="submit" value="roll" class="primary"></button></footer></form>';
    document.body.append(dialog);
    dialog.addEventListener("click",event=>{const button=event.target.closest("[data-dice-attribute]");if(!button)return;dialog.querySelector("input").value=button.dataset.diceAttribute;dialog.querySelector("input").focus();dialog.querySelector("input").select();});
    dialog.querySelector("form").addEventListener("submit",event=>{if(event.submitter?.value!=="roll")return;event.preventDefault();if(manualTableRoll(Number(dialog.querySelector("input").value)))dialog.close()});
  }
  dialog.querySelector("h2").textContent=manualTableCopy("Ручной бросок","Manual roll");
  dialog.querySelector("label span").textContent=manualTableCopy("Количество D6","Number of D6");
  dialog.querySelector('[value="cancel"]').textContent=manualTableCopy("Отмена","Cancel");
  dialog.querySelector('[value="roll"]').textContent=manualTableCopy("Бросить","Roll");
  const actor=Scene.actors.find(a=>a.id===Scene.selectedActor),hero=actor?store.heroes.find(h=>h.id===actor.heroId):S;
  const attrs=hero?Object.fromEntries(["body","talent","spirit","mind"].map(key=>[key,attrValueFor(hero,key)])):actor?.attrs;
  dialog.querySelector('[data-dice-source]').textContent=hero?.name||actor?.name||manualTableCopy("Ручной пул","Manual pool");
  dialog.querySelector('.manual-dice-attributes').innerHTML=[["body","Тело","Body"],["talent","Талант","Talent"],["spirit","Дух","Spirit"],["mind","Разум","Mind"]].filter(([key])=>Number.isFinite(attrs?.[key])&&attrs[key]>=1&&attrs[key]<=30).map(([key,ru,en])=>`<button type="button" data-dice-attribute="${attrs[key]}"><span>${manualTableCopy(ru,en)}</span><b>${attrs[key]}D6</b></button>`).join("");
  dialog.showModal();dialog.querySelector("input").select();
}
function manualTableAbilities(actor){
  if(activeSceneView()!=="gm"&&!canControlSceneActor(actor))return [{id:"access",name:manualTableCopy("Профиль участника","Participant profile"),text:manualTableCopy("Способности этого участника доступны Нарратору.","This participant's abilities are available to the Narrator.")}];
  return window.DAWN_MANUAL_READER_DATA.entries(actor,{english:isEnglishPreview(),enemyProfile,defense:antagonistDefense,techniqueEntries:a=>window.DAWN_LIONWING_TECHNIQUE_SURFACE?.entries?.(a)||[],wordById,t});
}
let paintingManualInspector=false;
function renderManualActorInspector(actor){
  const root=$("scene-inspector");if(!root)return;
  const active=document.activeElement,scope=manualClockScope();
  const editable=actor&&canControlSceneActor(actor),same=root.manualActorScope===scope&&root.manualActorId===actor?.id;
  const draft=same&&editable&&root.contains(active)&&active?.matches?.('[data-manual-resource]')?{key:active.dataset.manualResource,value:active.value,submitted:active.manualSubmitted,receipt:active.manualSubmission}:null;
  root.manualActorScope=scope;root.manualActorId=actor?.id;
  paintingManualInspector=true;
  try{drawManualActorInspector(actor);}finally{paintingManualInspector=false;}
  if(draft){const input=root.querySelector(`[data-manual-resource="${draft.key}"]`);if(input&&!input.disabled){input.value=draft.value;if(draft.submitted===draft.value){input.manualSubmitted=draft.submitted;input.manualSubmission=draft.receipt;}input.focus({preventScroll:true});}}
}
function drawManualActorInspector(actor){
  const root=$("scene-inspector");if(!root)return;
  if(actor?.hidden&&activeSceneView()!=="gm")actor=null;
  if(!actor){root.innerHTML=`<p>${manualTableCopy("Выберите участника на поле.","Select a participant on the board.")}</p>`;return;}
  const allowed=canControlSceneActor(actor),fields=[["hp","Здоровье","Health"],["maxHp","Максимум ЗД","Maximum HP"],["focus","Фокус","Focus"],["influence","Влияние","Influence"],["stress","Стресс","Stress"]];
  root.innerHTML=`<section class="manual-actor-settings"><h3>${esc(actor.name)}</h3><p>${manualTableCopy("Значения записываются вручную. Последствия определяет Нарратор.","Values are recorded manually. The Narrator decides the consequences.")}</p><div class="scene-stat-grid">${fields.map(([key,ru,en])=>`<label>${manualTableCopy(ru,en)}<input type="number" min="0" max="${window.DAWN_TABLE_POLICY?.resourceMaximum?.(actor,key)??9999}" step="1" data-manual-resource="${key}" data-manual-value="${Number(actor[key])||0}" data-manual-actor="${esc(actor.id)}" value="${Number(actor[key])||0}" ${allowed?"":"disabled"}></label>`).join("")}</div>${allowed&&Scene.spaces.length>1?`<label>${manualTableCopy("Поле участника","Participant board")}<select data-manual-actor-space="${esc(actor.id)}">${Scene.spaces.map(space=>`<option value="${esc(space.id)}" ${space.id===actor.space?"selected":""}>${esc(space.name)} · ${space.width}×${space.height}</option>`).join("")}</select></label>`:""}${activeSceneView()==="gm"?`<label>${manualTableCopy("Имя","Name")}<input data-scene-actor-name="${esc(actor.id)}" value="${esc(actor.name)}"></label><label>${manualTableCopy("Цвет токена","Token color")}<input type="color" data-scene-token-color="${esc(actor.id)}" value="${esc(actor.tokenColor)}"></label><label class="switch"><input type="checkbox" data-manual-actor-hidden="${esc(actor.id)}" ${actor.hidden?"checked":""}><span>${manualTableCopy("Скрыть токен на поле","Hide token on board")}</span></label><label class="switch"><input type="checkbox" data-manual-initiative-visible="${esc(actor.id)}" ${actor.manualInitiativeVisible??!actor.hidden?"checked":""}><span>${manualTableCopy("Показывать в инициативе","Show in initiative")}</span></label><button type="button" class="danger-quiet" data-scene-remove-actor="${esc(actor.id)}">${manualTableCopy("Убрать участника со стола","Remove participant from table")}</button>`:""}</section>`;
}
document.addEventListener("change",event=>{
  if(paintingManualInspector&&$("scene-inspector")?.contains(event.target))return;
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
  const input=event.target.closest?.("[data-manual-resource][data-manual-actor]");if(input)submitManualInspectorResource(input);
});
function submitManualInspectorResource(input){
  const root=$("scene-inspector");
  if(paintingManualInspector||!manualTableActive()||!root?.contains(input)||root.manualActorScope!==manualClockScope())return;
  const actor=Scene.actors.find(a=>a.id===input.dataset.manualActor),key=input.dataset.manualResource,value=Number(input.value);
  if(!actor||actor.id!==root.manualActorId||!canControlSceneActor(actor)||!['hp','maxHp','focus','influence','stress'].includes(key)||!input.value.trim()||!Number.isSafeInteger(value)||value<0||value>(window.DAWN_TABLE_POLICY?.resourceMaximum?.(actor,key)??9999)){renderScene();return;}
  if(input.value===input.manualSubmitted||value===actor[key])return;
  const draft=input.value,writeScope=manualClockScope();input.manualSubmitted=draft;
  const result=submitManualNumber(actor,{kind:'resource',values:{[key]:value}},manualTableCopy('Ручная правка ресурса','Manual resource edit'));
  const replacement=root.manualActorScope===writeScope&&root.manualActorId===actor.id?root.querySelector(`[data-manual-resource="${key}"]`):null;
  for(const node of new Set([input,replacement].filter(Boolean))){if(node.value!==draft)continue;if(result){node.manualSubmitted=draft;node.manualSubmission=result;}else{delete node.manualSubmitted;delete node.manualSubmission;}}
}
document.addEventListener('focusout',event=>{const input=event.target.closest?.('[data-manual-resource][data-manual-actor]');if(input)submitManualInspectorResource(input);});
function openManualActorReader(actorId){
  if(!manualTableActive())return false;
  const actor=Scene.actors.find(a=>a.id===actorId);if(!actor||activeSceneView()!=="gm"&&actor.hidden)return false;
  Scene.selectedActor=actor.id;Scene.activeSpace=actor.space;persist();renderScene();
  return window.DAWN_MANUAL_WORKSPACE.open(actor.id);
}
function renderManualToolLabels(){
  const manual=manualTableActive();
  const labels={
    select:manual?["Выбрать участника; передвижение записывается вручную без расхода ресурсов","Select a participant; movement is recorded manually without spending resources"]:["Выбирать токены; движение текущего участника выполняет Шаг","Select tokens; moving the current participant performs Step"],
    place:manual?["Переставить участника и записать перемещение в журнал","Reposition a participant and record the movement in the journal"]:["Переставить любого участника без затрат и записать это в журнал","Reposition any participant without costs and record it in the journal"],
    target:manual?["Отметить участников как цели; действия не выполняются","Mark participants as targets; no actions are performed"]:["Отметить цели следующего действия","Mark targets for the next action"],
    marker:manual?["Поставить обозначение на карту","Place a map annotation"]:["Поставить маркер правила","Place a rule marker"]
  };
  for(const [tool,text] of Object.entries(labels))for(const button of document.querySelectorAll(`[data-scene-tool="${tool}"]`)){
    const label=manualTableCopy(...text);button.dataset.toolHelp=label;button.title=label;button.setAttribute("aria-label",label);
  }
}
function renderManualTable(){
  installManualTerrainBrush();
  renderManualToolLabels();
  window.DAWN_SCENE_PRESENTATIONS?.refresh?.();
  if(manualTableActive())ensureManualAreaTools();
  renderManualAreaDraft();
  renderManualClocks();
  renderManualMapTools();
  renderManualJournal();
  const manual=manualTableActive(),crowdAdd=$("scene-add-crowd-auto"),crowdBrush=$("scene-add-crowd-brush"),trait=$("scene-enemy-trait");
  if(crowdAdd){crowdAdd.textContent=manual?manualTableCopy("Добавить на свободные клетки","Add to empty cells"):manualTableCopy("Добавить автоматически","Add automatically");}
  if(crowdBrush)crowdBrush.hidden=manual;
  if(trait?.closest("label"))trait.closest("label").hidden=manual;

  document.body.dataset.tablePolicy=manualTableActive()?"manual":"rules";
  const stageHead=document.querySelector('#scene-workbench .scene-stage-head');
  let status=$("scene-manual-context");
  if(stageHead&&!status){status=document.createElement("div");status.id="scene-manual-context";stageHead.prepend(status);}
  if(status){
    status.hidden=!manual;
    if(manual){const space=activeSceneSpace(),current=Scene.actors.find(a=>a.id===Scene.manualTable?.actorId&&(activeSceneView()==="gm"||!a.hidden));
      window.DAWN_MANUAL_SURFACE_PAINTING=true;try{status.innerHTML=`<strong>${esc(Scene.name||manualTableCopy("Стол","Table"))}</strong><span>${esc(space?.name||manualTableCopy("Поле","Board"))} · ${esc(current?manualTableCopy("Сейчас: ","Now: ")+current.name:manualTableCopy("Вручную","Manual"))}</span><label class="manual-tension">${manualTableCopy("Напряжение","Tension")} <input type="number" min="0" max="999" data-manual-tension value="${Number(Scene.tension)||0}" ${activeSceneView()!=="gm"?"disabled":""}></label>`;}finally{window.DAWN_MANUAL_SURFACE_PAINTING=false;}
    }
  }
  const sizeLabel=$("scene-space-size-label");if(sizeLabel?.firstChild)sizeLabel.firstChild.textContent=manualTableCopy("Размер нового поля","New board size");
  if(manual){
    const current=Scene.actors.find(a=>a.id===Scene.manualTable?.actorId&&(activeSceneView()==="gm"||!a.hidden));
    if($("scene-active-turn"))$("scene-active-turn").textContent=current?manualTableCopy("Сейчас: ","Now: ")+current.name:manualTableCopy("Участник не назначен","No current participant");
    if($("scene-encounter-status"))$("scene-encounter-status").textContent=manualTableCopy("Раунд ","Round ")+Math.max(1,Number(Scene.manualTable?.round)||1);
  }
  const selector=$("scene-control-mode");if(selector)selector.value=manualTableActive()?"manual":"rules";
  const hints=$("scene-manual-status-processing");if(hints){hints.checked=Boolean(Scene.tablePolicy?.processStatuses);hints.closest("label").hidden=!manualTableActive();}
  for(const button of document.querySelectorAll('#scene-dock [data-scene-panel="director"],#scene-dock [data-scene-panel="sheet"],#scene-dock [data-scene-panel="utility"],#scene-dock [data-scene-panel="entities"]'))button.hidden=manualTableActive();
  if(manualTableActive()&&["director","sheet","utility","entities"].includes(activeScenePanel))closeAllScenePanels();
  window.DAWN_MANUAL_WORKSPACE?.render({scene:Scene,canNarrate:activeSceneView()==="gm",canControl:canControlSceneActor,
    scopeId:Sync?.state?.()?.sceneId||"local",
    canRead:actor=>activeSceneView()==="gm"||!actor.hidden,
    commit:commitSceneEvents,readAbilities:manualTableAbilities,
    beforeRead:()=>{for(const menu of document.querySelectorAll(".scene-chrome-menu[open]"))menu.open=false;closeAllScenePanels();},
    selectActor:actor=>{
      const areaTools=$("manual-table-area-tools");if(areaTools)areaTools.areaDraft=null;
      clearManualAreaPreview();window.DAWN_SCENE_BOARD_TOOLS?.select?.("tokens");
      Scene.selectedActor=actor.id;persist();renderScene();
    },
    roll:openManualTableDice,
    openClocks:openManualTableClocks,
    showArea:openManualTableArea,
    statuses:actor=>(actor.manualStatuses||[]).map(id=>{const effect=sceneEffectList().find(e=>e.id===id);return{id,name:effect?.name||id,icon:"effects",hint:effect?.text||""}}),
    statusHints:Boolean(Scene.tablePolicy?.processStatuses),
    editResource:(actor,change)=>submitManualNumber(actor,{kind:"resource",values:{[change.field]:change.value}},manualTableCopy("Записать здоровье","Set Health")),
    editCounter:(actor,entry,change)=>submitManualNumber(actor,{kind:"technique-counter",key:entry.id,...change},manualTableCopy("Ручной счётчик приёма","Manual ability counter")),
    toggleTechnique:(actor,entry,on)=>commitSceneEvents(manualTableCopy("Пометка Техники","Technique note"),[{type:"table.command",actorId:actor.id,payload:{kind:"technique",key:entry.id,enabled:on}}]),
    afterFooterRender:renderManualTokenCounters
  });
  renderManualTokenCounters();
}
function renderManualTokenCounters(){
  const footer=$("scene-manual-footer"),actor=Scene.actors.find(a=>a.id===Scene.selectedActor);
  if(!footer||!manualTableActive()||!actor)return;
  const fields=[["ap","ОД","AP"],["focus","Фокус","Focus"],["wounds","Раны","Wounds"]],visible=store.sceneUi?.tokenCounters?.[actor.id]||fields.map(([key])=>key),allowed=canControlSceneActor(actor);
  const panel=document.createElement("div");panel.className="manual-token-counters";
  panel.innerHTML=fields.filter(([key])=>visible.includes(key)).map(([key,ru,en])=>`<label><span>${manualTableCopy(ru,en)}</span><div><button type="button" data-token-count="${key}" data-token-delta="-1" aria-label="${manualTableCopy(ru,en)} −1" ${!allowed?"disabled":""}>−</button><input type="number" min="0" max="${window.DAWN_TABLE_POLICY.resourceMaximum(actor,key)}" data-token-count-input="${key}" aria-label="${manualTableCopy(ru,en)}" value="${Number(actor[key])||0}" ${!allowed?"disabled":""}><button type="button" data-token-count="${key}" data-token-delta="1" aria-label="${manualTableCopy(ru,en)} +1" ${!allowed?"disabled":""}>+</button></div></label>`).join("")+`<details><summary title="${manualTableCopy("Настроить счётчики токена","Configure token counters")}">⚙</summary><div>${fields.map(([key,ru,en])=>`<label><input type="checkbox" data-token-count-visible="${key}" ${visible.includes(key)?"checked":""}>${manualTableCopy(ru,en)}</label>`).join("")}</div></details>`;
  const previous=footer.querySelector('.manual-token-counters');if(previous?.dataset.actorId===actor.id&&previous.manualCountersMarkup===panel.innerHTML)return;panel.manualCountersMarkup=panel.innerHTML;panel.dataset.actorId=actor.id;if(previous?.dataset.actorId===actor.id&&previous.querySelector('details')?.open)panel.querySelector('details').open=true;
  const write=(key,value)=>{const current=Scene.actors.find(a=>a.id===actor.id);if(!current||!canControlSceneActor(current)||!Number.isSafeInteger(value)||value<0||value>window.DAWN_TABLE_POLICY.resourceMaximum(current,key))return;if(value!==Number(current[key]||0))commitSceneEvents(manualTableCopy("Счётчик участника","Participant counter"),[{type:"table.command",actorId:current.id,payload:{kind:"resource",values:{[key]:value}}}]);};
  panel.addEventListener("click",event=>{const button=event.target.closest('[data-token-count]'),current=Scene.actors.find(a=>a.id===actor.id);if(button&&current)write(button.dataset.tokenCount,Number(current[button.dataset.tokenCount]||0)+Number(button.dataset.tokenDelta));});
  panel.addEventListener("change",event=>{if(window.DAWN_MANUAL_SURFACE_PAINTING)return;const key=event.target.dataset.tokenCountInput;if(key&&event.target.value.trim())write(key,Number(event.target.value));const visibility=event.target.dataset.tokenCountVisible;if(visibility){store.sceneUi||={};store.sceneUi.tokenCounters||={};store.sceneUi.tokenCounters[actor.id]=Array.from(panel.querySelectorAll('[data-token-count-visible]:checked'),node=>node.dataset.tokenCountVisible);persist();renderScene();}});
  window.DAWN_MANUAL_SURFACE_PAINTING=true;try{footer.querySelector('.manual-token-counters')?.remove();footer.append(panel);}finally{window.DAWN_MANUAL_SURFACE_PAINTING=false;}
}
document.addEventListener("change",event=>{if(window.DAWN_MANUAL_SURFACE_PAINTING||!event.target.matches?.('[data-manual-tension]')||!manualTableActive()||activeSceneView()!=="gm")return;const value=Number(event.target.value);if(event.target.value.trim()&&Number.isSafeInteger(value)&&value>=0&&value<=999)commitSceneEvents(manualTableCopy("Напряжение","Tension"),[{type:"table.command",actorId:null,payload:{kind:"tension",value}}]);});
function submitManualNumber(actor,payload,label){
  const event={id:uid(),type:"table.command",actorId:actor.id,payload};
  const result=commitSceneEvents(label,[event]);
  return result?{...result,manualEventIds:[event.id]}:null;
}
window.DAWN_TABLE_POLICY?.install();
document.addEventListener("keydown",event=>{
  if(event.key!=="Escape"||!manualTableActive()||!document.body.classList.contains("scene-mode")||!["area","wall","marker","erase"].includes(activeSceneTool())||event.target.closest?.("input,select,textarea,dialog,[contenteditable]")||window.DAWN_TABLE_POLICY.pendingWork(Scene)||sceneHasLocalPendingSelection())return;
  event.preventDefault();event.stopImmediatePropagation();scenePreviewCells.clear();sceneWallPreviewPoint=null;
  document.querySelectorAll(".scene-cell.preview,.scene-erase-preview").forEach(node=>node.classList.remove("preview","scene-erase-preview"));
  document.querySelectorAll(".scene-wall-preview,.scene-erase-label").forEach(node=>node.remove());
},true);
function manualEventText(scene,event,{english=false,entries=()=>[],effects=[]}={}){
  const copy=(ru,en)=>english?en:ru,p=event.payload||{},actor=scene.actors.find(a=>a.id===event.actorId),name=actor?.name||copy("Стол","Table");
  const entry=actor&&entries(actor).find(row=>row.id===p.key),ability=entry?.name||copy("Приём","Ability");
  const resourceNames={hp:copy("ЗД","HP"),maxHp:copy("Макс. ЗД","Max HP"),focus:copy("Фокус","Focus"),influence:copy("Влияние","Influence"),stress:copy("Стресс","Stress"),wounds:copy("Раны","Wounds"),ap:copy("ОД","AP"),baseAp:copy("Базовые ОД","Base AP"),armor:copy("Броня","Armor"),evasion:copy("Уклонение","Evasion"),speed:copy("Скорость","Speed")};
  if(p.kind==="resource")return `${name}: ${Object.entries(p.values||{}).map(([key,value])=>`${resourceNames[key]||copy("Ресурс","Resource")} → ${value}`).join(" · ")}`;
  if(p.kind==="move")return `${name}: ${copy("перемещение","moved")} → ${String.fromCharCode(65+p.x)}${p.y+1}`;
  if(p.kind==="tension")return `${copy("Напряжение","Tension")} → ${p.value}`;
  if(p.kind==="status")return `${name}: ${effects.find(row=>row.id===p.effectId)?.name||copy("Статус","Status")} · ${p.enabled?copy("добавлен","added"):copy("убран","removed")}`;
  if(p.kind==="technique")return `${name}: ${ability} · ${p.enabled?copy("отмечено","marked"):copy("отметка снята","mark cleared")}`;
  if(p.kind==="technique-counter"){
    const action=p.operation==="create"?copy("счётчик добавлен","counter added"):p.operation==="remove"?copy("счётчик убран","counter removed"):p.operation==="adjust"?`${copy("счётчик","counter")} ${p.delta>0?"+":""}${p.delta}`:`${copy("счётчик","counter")} → ${p.value}`;
    return `${name}: ${ability} · ${action}`;
  }
  if(p.kind==="pointer")return `${copy("Сейчас играет","Playing now")}: ${scene.actors.find(a=>a.id===p.actorId)?.name||scene.manualInitiative?.find(a=>a.id===p.actorId)?.name||copy("никто","nobody")}`;
  if(p.kind==="round")return p.delta!==undefined?`${copy("Ручной Раунд","Manual Round")} ${p.delta>0?"+":""}${p.delta}`:`${copy("Ручной Раунд","Manual Round")} → ${p.value}`;
  if(p.kind==="roll"){const roll=p.roll||{};return `${name}: ${roll.formula||copy("бросок","roll")} · ${(roll.rolls||[]).join(", ")} → ${roll.successes??0} ${copy("успехов","hits")}`;}
  const label=(ru,en)=>`${name}: ${copy(ru,en)}`;
  const labels={"area/create":label("показана область","area shown"),"area/remove":label("область убрана","area removed"),"wall/create":label("добавлена стена","wall added"),"wall/remove":label("стена убрана","wall removed"),"marker/create":label("поставлена метка","marker placed"),"marker/remove":label("метка убрана","marker removed"),"marker/move":label("метка перемещена","marker moved"),"marker/clock-set":label("изменены часы метки","marker clock changed"),"object/remove":label("обозначение убрано","annotation removed"),"actor/remove":label("участник убран","participant removed"),"clock/create":label("добавлены часы","clock added"),"clock/remove":label("часы убраны","clock removed"),"clock/set":label("часы изменены","clock changed"),"movement/clear":label("линии передвижения очищены","movement traces cleared"),"layout/replace":label("расстановка заменена","layout replaced"),"policy":label("изменён режим стола","table mode changed")};
  const detail=p.area?.label||p.wall?.label||p.marker?.label||p.clock?.name;
  return (labels[p.kind]||label("изменение ручного стола","manual table change"))+(detail?` · ${detail}`:"");
}
function renderManualJournal(){
  const log=$("scene-log");if(!log||!manualTableActive())return;
  const scene=activeSceneView()==="gm"?Scene:SceneEngine.projectScene(Scene,{role:"player",actorIds:Scene.actors.filter(canControlSceneActor).map(a=>a.id)});
  log.innerHTML=(scene.log||[]).map(row=>{const date=new Date(row.at),at=Number.isNaN(date.getTime())?row.at||"":date.toLocaleTimeString(isEnglishPreview()?"en-GB":"ru-RU",{hour:"2-digit",minute:"2-digit"});return `<li><time>${esc(at)}</time>${esc(row.text||eventText(row))}</li>`;}).join("")||`<li class="autosave">${manualTableCopy("Здесь появятся ручные изменения стола.","Manual table changes will appear here.")}</li>`;
}
const sceneEventTextWithRules=eventText;
eventText=function(event){
  if(event.type==="table.command")return manualEventText(Scene,event,{english:isEnglishPreview(),entries:manualTableAbilities,effects:sceneEffectList()});
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
