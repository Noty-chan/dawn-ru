"use strict";

// Connects the shared manual policy to the existing single Scene writer.
function manualTableActive(){return Boolean(window.DAWN_TABLE_POLICY?.isManual(Scene))}
function manualTableCopy(ru,en){return isEnglishPreview()?en:ru}
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
  return window.DAWN_MANUAL_READER_DATA.entries(actor,{english:isEnglishPreview(),enemyProfile,defense:antagonistDefense,techniqueEntries:a=>window.DAWN_LIONWING_TECHNIQUE_SURFACE?.entries?.(a)||[],wordById,t});
}
function renderManualTable(){
  renderManualClocks();
  document.body.dataset.tablePolicy=manualTableActive()?"manual":"rules";
  const selector=$("scene-control-mode");if(selector)selector.value=manualTableActive()?"manual":"rules";
  window.DAWN_MANUAL_WORKSPACE?.render({scene:Scene,canNarrate:activeSceneView()==="gm",canControl:canControlSceneActor,
    scopeId:Sync?.state?.()?.sceneId||"local",
    canRead:actor=>activeSceneView()==="gm"||!actor.hidden,
    commit:commitSceneEvents,readAbilities:manualTableAbilities,
    selectActor:actor=>{Scene.selectedActor=actor.id;persist();renderScene()},
    openSheet:actor=>{Scene.selectedActor=actor.id;renderScene();setScenePanel(actor.heroId?"sheet":"inspector")},
    roll:openManualTableDice,
    openClocks:openManualTableClocks,
    statuses:actor=>(actor.manualStatuses||[]).map(id=>{const effect=sceneEffectList().find(e=>e.id===id);return{id,name:effect?.name||id,icon:"effects",hint:effect?.text||""}}),
    statusHints:Boolean(Scene.tablePolicy?.processStatuses),
    toggleTechnique:(actor,entry,on)=>commitSceneEvents(manualTableCopy("Пометка Техники","Technique note"),[{type:"table.command",actorId:actor.id,payload:{kind:"technique",key:entry.id,enabled:on}}])
  });
}
window.DAWN_TABLE_POLICY?.install();
const sceneEventTextWithRules=eventText;
eventText=function(event){
  if(event.type==="table.command"&&event.payload?.kind==="roll"){
    const roll=event.payload.roll,actor=Scene.actors.find(a=>a.id===event.actorId);
    return `${actor?.name||manualTableCopy("Стол","Table")}: ${roll.formula} · ${roll.rolls.join(", ")} → ${roll.successes} ${manualTableCopy("успехов","hits")}`;
  }
  return sceneEventTextWithRules(event);
};
const renderSceneWithRules=renderScene;
renderScene=function(){const result=renderSceneWithRules.apply(this,arguments);renderManualTable();return result};
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
