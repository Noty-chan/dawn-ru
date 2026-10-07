"use strict";

// Connects the shared manual policy to the existing single Scene writer.
function manualTableActive(){return Boolean(window.DAWN_TABLE_POLICY?.isManual(Scene))}
function manualTableCopy(ru,en){return isEnglishPreview()?en:ru}
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
  const entries=window.DAWN_LIONWING_TECHNIQUE_SURFACE?.entries?.(actor)||[];
  const rows=entries.map(e=>({id:e.id,name:`${e.displayTechniqueName} · ${e.displayLevelName}`,text:e.displayText,toggle:true}));
  for(const key of ["ability","taintedAbility"]){const a=actor[key];if(a?.enabled)rows.unshift({id:key,name:a.name||manualTableCopy("Способность","Ability"),text:a.desc||""})}
  if(actor.notes)rows.push({id:"notes",name:manualTableCopy("Заметки","Notes"),text:actor.notes});
  return rows;
}
function renderManualTable(){
  document.body.dataset.tablePolicy=manualTableActive()?"manual":"rules";
  const selector=$("scene-control-mode");if(selector)selector.value=manualTableActive()?"manual":"rules";
  window.DAWN_MANUAL_WORKSPACE?.render({scene:Scene,canNarrate:activeSceneView()==="gm",canControl:canControlSceneActor,
    scopeId:Sync?.state?.()?.sceneId||"local",
    canRead:actor=>activeSceneView()==="gm"||!actor.hidden,
    commit:commitSceneEvents,readAbilities:manualTableAbilities,
    selectActor:actor=>{Scene.selectedActor=actor.id;persist();renderScene()},
    openSheet:actor=>{Scene.selectedActor=actor.id;renderScene();setScenePanel(actor.heroId?"sheet":"inspector")},
    roll:openManualTableDice,
    openClocks:()=>{renderSceneUtility();setScenePanel("utility")},
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
