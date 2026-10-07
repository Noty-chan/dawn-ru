"use strict";

// Connects the shared manual policy to the existing single Scene writer.
function manualTableActive(){return Boolean(window.DAWN_TABLE_POLICY?.isManual(Scene))}
function manualTableCopy(ru,en){return isEnglishPreview()?en:ru}
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
    roll:()=>{activeUtilityActorId=Scene.selectedActor;renderSceneUtility();setScenePanel("utility")},
    openClocks:()=>{renderSceneUtility();setScenePanel("utility")},
    statuses:actor=>(actor.manualStatuses||[]).map(id=>{const effect=sceneEffectList().find(e=>e.id===id);return{id,name:effect?.name||id,icon:"effects",hint:effect?.text||""}}),
    statusHints:Boolean(Scene.tablePolicy?.processStatuses),
    toggleTechnique:(actor,entry,on)=>commitSceneEvents(manualTableCopy("Пометка Техники","Technique note"),[{type:"table.command",actorId:actor.id,payload:{kind:"technique",key:entry.id,enabled:on}}])
  });
}
window.DAWN_TABLE_POLICY?.install();
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
