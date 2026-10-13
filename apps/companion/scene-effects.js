"use strict";

let pendingCoreAction=null,pendingCoreActionPlan=false,pendingCoreActionContext=null,pendingCoreActorId=null,pendingCoreReaction=null,pendingTechniqueRule=null,pendingTechniqueAnchor=null,pendingTechniqueOptions={},pendingTechniqueCells=[],pendingTechniqueLines=[],pendingEnemyRule=null,pendingEnemyStepActorId=null,pendingZealotPlan=null,techniqueOrientation="horizontal";
function sceneFloatDescriptor(event){
  const payload=event.payload||{},resources={ap:"ОД",focus:"Фокус",influence:"Влияние",meals:"Трапеза",creationMarks:"Метка","creation-marks":"Метки",bullets:"Пули",weapons:"Оружие",heat:"Нагрев",grit:"Упорство",faith:"Вера",health:"Здоровье"},resolved=payload.resolvedResource||payload.resource,delta=Number(payload.resolvedDelta);
  if(event.type==="damage.apply"){const amount=Number(payload.dealt??payload.amount??0);return{actorId:payload.targetId,text:amount?`−${amount} ЗД`:payload.evaded?`Уворот ${payload.evaded}`:"Броня",tone:amount?"damage":"guard"}}
  if(["resource.spend","resource.gain","rule-resource.spend","rule-resource.gain"].includes(event.type)&&Number(payload.amount)>0){const signed=Number.isFinite(delta)?delta:(event.type.endsWith(".gain")?1:-1)*Number(payload.amount);if(!signed)return null;return{actorId:event.actorId,text:`${signed>0?"+":"−"}${Math.abs(signed)} ${resources[resolved]||resolved}`,tone:signed>0?"gain":"spend"}}
  if(event.type==="effect.apply"){const name=D.effects.positive.concat(D.effects.negative).find(effect=>effect.id===payload.effect)?.name||payload.effect;return{actorId:payload.targetId,text:name,tone:"effect"}}
  if(event.type==="effect.remove"&&payload.removed){const name=D.effects.positive.concat(D.effects.negative).find(effect=>effect.id===payload.effect)?.name||payload.effect;return{actorId:payload.targetId,text:`− ${name}`,tone:"guard"}}
  if(event.type==="actor.heal")return{actorId:payload.targetId,text:`+${payload.restored??payload.amount??0} ЗД`,tone:"gain"};
  if(event.type==="actor.knockout")return{actorId:payload.targetId,text:"ВНЕ БОЯ",tone:"damage"};
  if(event.type==="rule.prompt")return{actorId:event.actorId,text:"СРАБОТАЛО",tone:"turn"};
  if(event.type==="turn.start")return{actorId:event.actorId,text:"ВАШ ХОД",tone:"turn"};
  if(event.type==="turn.grant")return{actorId:event.actorId,text:"ЕЩЕ ХОД",tone:"turn"};
  if(event.type==="technique.state")return{actorId:event.actorId,text:payload.key==="study"?"+1 ПЛАН":`${Number(payload.delta||0)>0?"+":""}${payload.delta||0} ПЛАН`,tone:Number(payload.delta||1)>0?"gain":"spend"};
  if(event.type==="actor.state")return{actorId:event.actorId,text:payload.key==="growth"?"+1 РОСТ":"СОСТОЯНИЕ",tone:"effect"};
  if(event.type==="roll.public")return{actorId:event.actorId,text:`${payload.successes||0} усп.`,tone:"roll"};
  return null;
}
function spawnSceneFloat(event,lane=0){
  const item=sceneFloatDescriptor(event),wrap=$("scene-board-wrap");if(!item||!wrap)return;const token=wrap.querySelector(`[data-scene-actor="${CSS.escape(item.actorId||"")}"]`);if(!token)return;
  const tokenRect=token.getBoundingClientRect(),wrapRect=wrap.getBoundingClientRect(),node=document.createElement("span");node.className=`scene-float-text ${item.tone}`;node.textContent=item.text;node.style.left=`${tokenRect.left-wrapRect.left+wrap.scrollLeft+tokenRect.width/2}px`;node.style.top=`${tokenRect.top-wrapRect.top+wrap.scrollTop-4-Math.min(lane,3)*12}px`;wrap.append(node);setTimeout(()=>node.remove(),1350);
}
function innerWorldEvent(events=[]){
  const ensure=events.find(event=>event.type==="space.ensure"&&event.payload?.activate&&(/Внутренний мир/.test(event.payload.name||"")||event.payload?.ruleId==="disruptor.inner-world.2"));
  const marked=events.some(event=>event.payload?.sourceActionId==="disruptor.inner-world.2"||event.payload?.ruleId==="disruptor.inner-world.2");
  return ensure&&marked?ensure:null;
}
function playInnerWorldFx(events=[],context={}){
  const ensure=innerWorldEvent(events);
  if(!ensure)return;
  const wrap=$("scene-board-wrap"),caster=events.find(event=>event.type==="technique.prepare"&&event.payload?.ruleId==="disruptor.inner-world.2")?.actorId||events.find(event=>event.payload?.sourceActionId==="disruptor.inner-world.2")?.actorId;
  if(!wrap||!caster)return;
  const movers=[...new Set(events.filter(event=>event.type==="actor.move"&&event.payload?.space===ensure.payload.id).map(event=>event.actorId))],target=movers.find(id=>id!==caster);
  if(!target)return;
  const locate=id=>wrap.querySelector(`[data-scene-actor="${CSS.escape(id)}"]`)?.getBoundingClientRect();
  const wrapRect=wrap.getBoundingClientRect(),heroRect=locate(caster),enemyRect=locate(target),fallback={x:wrap.clientWidth/2,y:wrap.clientHeight/2};
  const point=(rect,id)=>context.points?.[id]||(rect?{x:rect.left-wrapRect.left+wrap.scrollLeft+rect.width/2,y:rect.top-wrapRect.top+wrap.scrollTop+rect.height/2}:fallback);
  const overlay=document.createElement("div");overlay.className="inner-world-fx";overlay.setAttribute("aria-hidden","true");
  const voidNode=document.createElement("i");voidNode.className="inner-world-fx-void";
  const beam=document.createElement("i");beam.className="inner-world-fx-beam";
  overlay.append(voidNode,beam);wrap.append(overlay);
  const hero=point(heroRect,caster),enemy=point(enemyRect,target),size=Math.max(56,Math.min(wrapRect.width,wrapRect.height)*.18);
  voidNode.style.setProperty("--iw-x",`${hero.x}px`);voidNode.style.setProperty("--iw-y",`${hero.y}px`);voidNode.style.setProperty("--iw-size",`${size}px`);voidNode.style.setProperty("--iw-enemy-x",`${enemy.x}px`);voidNode.style.setProperty("--iw-enemy-y",`${enemy.y}px`);
  beam.style.left=`${hero.x}px`;beam.style.top=`${hero.y}px`;beam.style.width=`${Math.hypot(enemy.x-hero.x,enemy.y-hero.y)}px`;beam.style.setProperty("--iw-angle",`${Math.atan2(enemy.y-hero.y,enemy.x-hero.x)}rad`);
  const casterToken=wrap.querySelector(`[data-scene-actor="${CSS.escape(caster)}"]`),targetToken=wrap.querySelector(`[data-scene-actor="${CSS.escape(target)}"]`);casterToken?.classList.add("fx-inner-world-caster");targetToken?.classList.add("fx-inner-world-target");
  wrap.classList.add("fx-inner-world");
  const cleanup=()=>{overlay.remove();wrap.classList.remove("fx-inner-world");casterToken?.classList.remove("fx-inner-world-caster");targetToken?.classList.remove("fx-inner-world-target")};
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(reduced){overlay.classList.add("reduced");setTimeout(cleanup,260)}else setTimeout(cleanup,3600);
}
function playInnerWorldExitFx(events=[],context={}){
  const exit=events.find(event=>event.type==="technique.resolve"&&event.payload?.innerWorldExit&&event.payload?.sourceActionId==="disruptor.inner-world.2");
  if(!exit)return;
  const wrap=$("scene-board-wrap"),movers=events.filter(event=>event.type==="actor.move"&&event.payload?.innerWorldExit).map(event=>event.actorId);
  if(!wrap||!movers.length)return;
  const wrapRect=wrap.getBoundingClientRect(),points=movers.map(id=>({id,rect:wrap.querySelector(`[data-scene-actor="${CSS.escape(id)}"]`)?.getBoundingClientRect()})).filter(item=>item.rect);
  if(!points.length)return;
  const overlay=document.createElement("div");overlay.className="inner-world-exit-fx";overlay.setAttribute("aria-hidden","true");wrap.append(overlay);
  const center=points.reduce((sum,item)=>({x:sum.x+item.rect.left-wrapRect.left+item.rect.width/2,y:sum.y+item.rect.top-wrapRect.top+item.rect.height/2}),{x:0,y:0});center.x/=points.length;center.y/=points.length;
  overlay.style.setProperty("--iw-exit-x",`${center.x}px`);overlay.style.setProperty("--iw-exit-y",`${center.y}px`);
  const tokens=points.map(item=>wrap.querySelector(`[data-scene-actor="${CSS.escape(item.id)}"]`)).filter(Boolean);tokens.forEach(token=>token.classList.add("fx-inner-world-exit"));
  wrap.classList.add("fx-inner-world-exit-board");
  const cleanup=()=>{overlay.remove();wrap.classList.remove("fx-inner-world-exit-board");tokens.forEach(token=>token.classList.remove("fx-inner-world-exit"))};
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;setTimeout(cleanup,reduced?260:1900);
}
function playHavenFx(events=[]){const configured=events.find(event=>event.type==="modifier.configure"&&event.payload?.profileId==="enemy.modifier.haven"),damages=events.filter(event=>event.type==="damage.apply"&&event.payload?.sourceActionId==="enemy.modifier.haven.round-end");if(!configured&&!damages.length)return;const ownerId=configured?.actorId||damages[0]?.actorId,safe=new Set(configured?.payload?.state?.cells||Scene.objects.find(item=>item.ownerActorId===ownerId&&item.metadata?.enemyModifier==="haven")?.cells||[]);requestAnimationFrame(()=>{const touched=[];for(const cell of document.querySelectorAll("#scene-board [data-scene-cell]")){const inside=safe.has(cell.dataset.sceneCell),name=configured&&inside?"fx-haven-appear":damages.length&&!inside?"fx-haven-damage":"fx-haven-witness";cell.classList.add(name);touched.push(cell)}setTimeout(()=>touched.forEach(cell=>cell.classList.remove("fx-haven-appear","fx-haven-damage","fx-haven-witness")),1900)})}
function playSceneEventFx(events=[],context={}){
  playHavenFx(events);
  const actorFx=new Map(),add=(id,name)=>{if(!id)return;const set=actorFx.get(id)||new Set();set.add(name);actorFx.set(id,set)};
  let boardFx="";
  for(const event of events){
    const payload=event.payload||{},participants=SceneEngine.eventParticipants(Scene,event);
    for(const id of participants.sourceIds){add(id,"fx-involved");add(id,"fx-involved-source")}
    for(const id of participants.targetIds){add(id,"fx-involved");add(id,"fx-involved-target")}
    if(event.type==="action.prepare"||event.type==="enemy.action.prepare"||event.type==="technique.prepare"){add(event.actorId,"fx-action");boardFx="fx-cast"}else if(event.type==="reaction.offer")add(event.actorId,"fx-reaction");else if(event.type==="reaction.respond")add(event.actorId,"fx-response");else if(event.type==="damage.apply"||event.type==="actor.knockout")add(payload.targetId,"fx-damage");else if(event.type==="actor.heal"||event.type==="effect.apply")add(payload.targetId,"fx-gain");else if(event.type==="effect.remove")add(payload.targetId,"fx-response");else if(["resource.gain","rule-mode.set","rule-resource.gain","rule-resource.set","rule-resource.reset","rule-clock.configure","rule-clock.tick","rule-clock.set","rule-clock.reset","technique.state","actor.state"].includes(event.type))add(event.actorId,Number(payload.appliedDelta||payload.delta||0)<0?"fx-spend":"fx-gain");else if(event.type==="actor.move")add(event.actorId,"fx-move");else if(event.type==="topology.cells.remove"||event.type==="topology.cells.restore")boardFx="fx-topology";else if(event.type==="turn.start"||event.type==="turn.grant")add(event.actorId,"fx-turn");else if(event.type==="roll.public")boardFx="fx-roll"
  }
  requestAnimationFrame(()=>{playInnerWorldFx(events,context);playInnerWorldExitFx(events,context);const touched=[];for(const[id,names]of actorFx){const token=document.querySelector(`[data-scene-actor="${CSS.escape(id)}"]`);if(!token)continue;for(const name of names)token.classList.add(name);touched.push(token)}const board=$("scene-board-wrap");if(boardFx&&board){board.classList.add(boardFx);touched.push(board)}const latest=$("scene-roll-feed")?.querySelector("article:last-child");if(events.some(event=>event.type==="roll.public")&&latest){latest.classList.add("fx-enter");touched.push(latest)}events.forEach(spawnSceneFloat);setTimeout(()=>touched.forEach(node=>node.classList.remove("fx-action","fx-reaction","fx-response","fx-damage","fx-gain","fx-move","fx-turn","fx-cast","fx-roll","fx-topology","fx-enter","fx-involved","fx-involved-source","fx-involved-target")),1450)})
}
function sceneFlowSteps(labels,current){
  const indices=labels.length>7?[...new Set([0,current-1,current,current+1,labels.length-1].filter(index=>index>=0&&index<labels.length))].sort((a,b)=>a-b):labels.map((_,index)=>index);
  let previous=-1;
  return `<ol class="scene-flow-steps">${indices.map(index=>{
    const gap=index>previous+1?`<li class="scene-flow-gap" title="Этапы ${previous+2}–${index}" aria-label="Пропущено этапов: ${index-previous-1}"><span>…</span></li>`:"";previous=index;
    return `${gap}<li class="${index<current?"done":index===current?"current":""}" title="${esc(labels[index])}"${index===current?' aria-current="step"':""}><i>${index<current?"✓":index+1}</i><span>${esc(labels[index])}</span></li>`;
  }).join("")}</ol>`;
}
function rulePromptChoiceLabel(prompt,choice){const names={"pure-water":"Чистая вода","rage-fumes":"Пары ярости","growth-serum":"Сыворотка роста",adrenaline:"Адреналиновый стимулятор","stone-skin":"Бальзам каменной кожи","thorn-rot":"Яд мерзошипа",attack:"Быстрая Стычка",pass:"Не использовать",accept:"Принять перенаправление",resist:"Сопротивляться (+2 Стресса)",place:"Поставить Слабую точку",study:"Изучить атакующего",stun:"Наложить Ошеломлен",transform:"Трансформироваться",rush:"Переместиться",pull:"Притянуть",stop:"Остановить",continue:"Продолжить",convert:"Преобразовать Сосульку",finale:"Использовать Финал",single:"Оставить один Дух",cancel:"Отменить",fill:"Заполнить",invoke:"Использовать",flow:"Получить ОД и переместиться",provoke:"Наложить Спровоцирован",frighten:"Наложить Испуган","hold-back":"Сдержаться",disappear:"Исчезнуть",reapply:"Применить снова"};const spirits={dreamy:"Мечтательный дух",angry:"Злой дух",insightful:"Проницательный дух",bright:"Пылкий дух",kind:"Добрый дух",fierce:"Яростный дух"};if(prompt.context?.optionLabels?.[choice])return prompt.context.optionLabels[choice];if(names[choice])return names[choice];if(spirits[choice])return spirits[choice];if(choice.startsWith("cell:")){const[x,y]=choice.slice(5).split(",").map(Number);return `Клетка ${String.fromCharCode(65+x)}${y+1}`}if(choice.startsWith("combine:"))return `Объединить: ${spirits[choice.slice(8)]||choice.slice(8)}`;if(choice.startsWith("split:"))return `Два Пламени: ${spirits[choice.slice(6)]||choice.slice(6)}`;const marker=Scene.markers.find(item=>item.id===choice);if(marker)return `${marker.label} · ${String.fromCharCode(65+Number(marker.x))}${Number(marker.y)+1}`;const actor=Scene.actors.find(item=>item.id===choice);if(actor)return actor.name;return D.effects.positive.concat(D.effects.negative).find(effect=>effect.id===choice)?.name||choice}
function cancelSceneFlow(){if(typeof lwCancelDestination==="function")lwCancelDestination();if(Scene.pendingActionPlan){const prepared=SceneEngine.cancelActionPlan(Scene,{actorId:Scene.pendingActionPlan.actorId,reason:"Отменено до оплаты и применения."});if(!prepared.ok)return toast(prepared.errors.join(" "));if(!commitSceneEvents(`Отмена: ${Scene.pendingActionPlan.actionName}`,prepared.events))return}delete Scene.__masterFinisherRequest;pendingCoreAction=null;pendingCoreActionPlan=false;pendingCoreActionContext=null;pendingCoreActorId=null;pendingCoreReaction=null;pendingTechniqueRule=null;pendingTechniqueAnchor=null;pendingTechniqueOptions={};pendingTechniqueCells=[];pendingTechniqueLines=[];pendingEnemyRule=null;pendingEnemyStepActorId=null;pendingZealotPlan=null;scenePreviewCells.clear();sceneTopologyCells.clear();clearSceneMeasurement({render:false});Scene.tool="select";persist();renderScene();toast("Подготовка действия отменена без затрат")}
function sceneEnvironmentTarget({x,y,markerId=null,wallId=null}){
  const layer=typeof document==="object"?document.getElementById("scene-erase-layer")?.value||"all":"all";
  const eligible=item=>item.space===Scene.activeSpace;
  const wall=(layer==="all"||layer==="walls")&&wallId&&Scene.walls.find(item=>eligible(item)&&item.id===wallId);
  if(wall)return {type:"wall",entity:wall};
  const marker=(layer==="all"||layer==="markers")&&markerId&&Scene.markers.find(item=>eligible(item)&&item.id===markerId);
  if(marker)return {type:"marker",entity:marker};
  const object=[...Scene.objects].reverse().find(item=>eligible(item)&&item.cells?.includes(`${x},${y}`)&&(layer==="all"||layer==="areas"||layer==="terrain"&&sceneEnvironmentIsTerrain(item)));
  return object?{type:"object",entity:object}:null;
}
function sceneEnvironmentIsTerrain(row){return row.type==="manual-area"?["terrain","difficult","high","low"].includes(row.appearance):["terrain","difficult","high","low"].includes(row.type);}
function sceneEnvironmentCopy(key,args={}){return t(`scene.cleanup.${key}`,args);}
function sceneEnvironmentBlocked({allowPending=false,notify=true}={}){
  if(activeSceneView()!=="gm"||typeof Sync==="object"&&Sync?.state?.()?.sceneId&&!Sync.state().canNarrate)return true;
  if(!allowPending&&(Scene.pendingAction||Scene.pendingPrompt||Scene.pendingActionPlan||window.DAWN_TABLE_POLICY?.pendingWork?.(Scene)||sceneHasLocalPendingSelection())){if(notify)toast(sceneEnvironmentCopy("pending"));return true;}
  return false;
}
function removeSceneEnvironment(target){
  if(sceneEnvironmentBlocked())return false;
  const {type,entity}=target,key={object:"objects",wall:"walls",marker:"markers"}[type];
  if(!key||!Scene[key]?.some(row=>row.id===entity.id&&row.space===Scene.activeSpace))return false;
  const label=sceneEnvironmentCopy("removed",{label:entity.label||sceneEnvironmentCopy(type)});
  if(Scene.rulesEdition==="lionwing")return commitLionwingDestroy({kind:"backing",backing:{type,id:entity.id}},{confirm:false,preserveActors:true,label});
  if(window.DAWN_TABLE_POLICY?.isManual?.(Scene))return commitSceneEvents(label,[{type:"table.command",actorId:null,payload:{kind:`${type}/remove`,id:entity.id}}]);
  return commitScene(label,scene=>{scene[key]=scene[key].filter(item=>item.id!==entity.id)});
}
function eraseSceneEnvironment(point){
  if(sceneEnvironmentBlocked())return false;
  const target=sceneEnvironmentTarget(point);return target?removeSceneEnvironment(target):false;
}

function sceneEnvironmentRows(layer="all",spaceId=Scene.activeSpace){
  const rows=[];
  for(const [key,type,group]of [["objects","object","areas"],["walls","wall","walls"],["markers","marker","markers"]])for(const entity of Scene[key]||[])if(entity.space===spaceId&&(layer==="all"||layer===group||layer==="terrain"&&type==="object"&&sceneEnvironmentIsTerrain(entity)))rows.push({type,entity});
  return rows;
}
function clearSceneEnvironment(layer="all",{hostId="scene-layer-clear-confirmation"}={}){
  if(!["all","terrain","areas","walls","markers"].includes(layer)||sceneEnvironmentBlocked())return false;
  const space=activeSceneSpace(),rows=sceneEnvironmentRows(layer,space.id),cuts=layer==="all"?(Scene.topology?.cuts||[]).filter(row=>row.space===space.id):[];
  if(!rows.length&&!cuts.length){toast(sceneEnvironmentCopy("empty"));return false;}
  const version=Number(Scene.version||0),epoch=Scene.tablePolicy?.epoch||0,scope=sceneEnvironmentScope();
  return sceneCleanupConfirmation(hostId,sceneEnvironmentCopy("confirmClear",{space:space.name,count:rows.length+cuts.length,layer:sceneEnvironmentCopy(`layer.${layer}`)}),()=>{
  if(scope!==sceneEnvironmentScope()||version!==Number(Scene.version||0)||sceneEnvironmentBlocked()){toast(sceneEnvironmentCopy("stale"));return false;}
  const label=sceneEnvironmentCopy("cleared",{space:space.name,layer:sceneEnvironmentCopy(`layer.${layer}`)});
  if(window.DAWN_TABLE_POLICY?.isManual?.(Scene))return commitSceneEvents(label,[{type:"table.command",actorId:null,payload:{kind:"environment/clear",space:space.id,layer,expectedVersion:version,policyEpoch:epoch}}]);
  if(Scene.rulesEdition!=="lionwing")return commitScene(label,scene=>{for(const [key,type]of [["objects","object"],["walls","wall"],["markers","marker"]]){const ids=new Set(rows.filter(row=>row.type===type).map(row=>row.entity.id));scene[key]=scene[key].filter(row=>!ids.has(row.id));}if(scene.topology)scene.topology.cuts=(scene.topology.cuts||[]).filter(row=>!cuts.some(cut=>cut.id===row.id));});
  // Compose real destroy plans on a clone, then publish the whole step once.
  // A failed dependent cleanup must leave every original layer untouched.
  try{
    const plans=window.DAWN_LIONWING_DESTROY_PLAN,entities=window.DAWN_LIONWING_ENTITIES,engine=SceneEngine;
    let candidate=JSON.parse(JSON.stringify(Scene)),firstPlan=null;
    for(const {type,entity}of rows){
      const key={object:"objects",wall:"walls",marker:"markers"}[type];if(!candidate[key]?.some(row=>row.id===entity.id))continue;
      const eventId=`destroy:environment:${uid()}`,plan=plans.prepare(candidate,{kind:"backing",backing:{type,id:entity.id}},{role:"narrator",expectedVersion:version,eventId,entities,engine,placeActorsSafely});
      const result=plans.apply(candidate,plan,{role:"narrator",eventId,expectedVersion:version,entities,engine,placeActorsSafely,validateTableEdit,plannedDestroy:true,recordHistory:false,advanceVersion:false});
      if(!result?.ok)throw new Error(sceneEnvironmentCopy("failed"));candidate=result.scene;firstPlan||=plan;
    }
    if(cuts.length)candidate=engine.dispatchMany(candidate,cuts.map(cut=>({id:`restore:environment:${uid()}`,type:"topology.cells.restore",actorId:null,payload:{cutId:cut.id}})),{expectedVersion:version}).scene;
    if(JSON.stringify(candidate.actors.map(actor=>actor.id))!==JSON.stringify(Scene.actors.map(actor=>actor.id)))throw new Error(sceneEnvironmentCopy("linkedActors"));
    candidate.version=version;
    return commitScene(label,scene=>{for(const key of Object.keys(scene))delete scene[key];Object.assign(scene,candidate);},firstPlan?{plannedDestroy:firstPlan}:{});
  }catch(error){toast(error.message||sceneEnvironmentCopy("failed"));return false;}
  });
}
function clearSceneNpcs(){
  if(sceneEnvironmentBlocked())return false;
  const removed=Scene.actors.filter(actor=>(actor.kind==="enemy"||actor.profileId||actor.kind==="crowd"||actor.kind==="token")&&!(actor.kind==="hero"||actor.heroId||actor.ownerId||actor.characterId));
  if(!removed.length){toast(sceneEnvironmentCopy("emptyNpcs"));return false;}
  const ids=removed.map(actor=>actor.id),selected=new Set(ids),preserveActorIds=Scene.actors.filter(actor=>!selected.has(actor.id)).map(actor=>actor.id);
  return sceneCleanupConfirmation("scene-field-clear-confirmation",sceneEnvironmentCopy("confirmNpcs",{count:ids.length}),()=>{
    const label=sceneEnvironmentCopy("removedNpcs",{count:ids.length});
    if(window.DAWN_TABLE_POLICY?.isManual?.(Scene))return commitSceneEvents(label,ids.map(id=>({type:"table.command",actorId:null,payload:{kind:"actor/remove",id}})));
    if(Scene.rulesEdition==="lionwing")return commitLionwingDestroy({kind:"actor",id:ids[0]},{confirm:false,actorIds:ids,preserveActorIds,label});
    return commitScene(label,scene=>{scene.actors=scene.actors.filter(actor=>!selected.has(actor.id));scene.objects=scene.objects.filter(object=>!selected.has(object.ownerActorId));scene.markers=scene.markers.filter(marker=>!selected.has(marker.ownerActorId));scene.targetIds=scene.targetIds.filter(id=>!selected.has(id));if(selected.has(scene.selectedActor))scene.selectedActor=null;if(selected.has(scene.activeActorId))scene.activeActorId=null;});
  });
}
function sceneEnvironmentScope(){
  const sync=typeof Sync==="object"?Sync?.state?.():null;
  return JSON.stringify([sync?.sceneId||Scene.sceneId||Scene.id||"local",sync?.userId,Scene.rulesEdition,Scene.tablePolicy,Scene.activeSpace,activeSceneView()]);
}
function sceneEnvironmentCoordinate(value){
  const [x,y]=String(value).split(",").map(Number);return Number.isInteger(x)&&Number.isInteger(y)?`${String.fromCharCode(65+x)}${y+1}`:"—";
}
function sceneEnvironmentRowType({type,entity}){
  if(type!=="object")return sceneEnvironmentCopy(type);
  const appearance=entity.type==="manual-area"?entity.appearance||"custom":entity.type;
  const key=`appearance.${appearance}`,label=sceneEnvironmentCopy(key);
  return label===`scene.cleanup.${key}`?(typeof sceneObjectDisplayName==="function"?sceneObjectDisplayName(entity):sceneEnvironmentCopy("object")):label;
}
function openSceneEnvironmentList({notify=true}={}){
  const list=$("scene-environment-list"),details=$("scene-environment-objects");if(!list||!details)return false;
  if(sceneEnvironmentBlocked({notify})){list.setAttribute("aria-disabled","true");for(const button of list.querySelectorAll("[data-cleanup-index]"))button.disabled=true;return false;}
  const layer=$("scene-erase-layer")?.value||"all",rows=sceneEnvironmentRows(layer),scope=sceneEnvironmentScope(),version=Number(Scene.version||0),scene=Scene;
  details.open=true;
  const markup=rows.map((target,index)=>{const {type,entity}=target,cells=type==="object"?entity.cells||[]:type==="wall"?[entity.a,entity.b]:[`${entity.x},${entity.y}`],position=cells.slice(0,5).map(sceneEnvironmentCoordinate).join(type==="wall"?" — ":", ")+(cells.length>5?` · +${cells.length-5}`:"");
    return `<article><div><strong>${esc(entity.label||sceneEnvironmentRowType(target))}</strong><small>${esc(sceneEnvironmentRowType(target))} · ${esc(position)}</small></div><button type="button" data-cleanup-index="${index}" data-cleanup-key="${esc(`${type}:${entity.id}`)}" aria-label="${esc(sceneEnvironmentCopy("removeNamed",{label:entity.label||sceneEnvironmentRowType(target)}))}">×</button></article>`;
  }).join("")||`<p>${esc(sceneEnvironmentCopy("empty"))}</p>`;
  if(list.innerHTML!==markup){
    const focused=list.contains?.(document.activeElement)?document.activeElement?.dataset:null,scroll=list.scrollTop;
    list.innerHTML=markup;list.scrollTop=scroll;
    if(focused){const retained=rows.findIndex(row=>`${row.type}:${row.entity.id}`===focused.cleanupKey),index=retained>=0?retained:Math.min(Number(focused.cleanupIndex),rows.length-1);(index>=0?list.querySelector(`[data-cleanup-index="${index}"]`):details.querySelector("summary"))?.focus({preventScroll:true});}
  }
  for(const button of list.querySelectorAll("[data-cleanup-index]"))button.disabled=false;
  list.setAttribute("aria-disabled","false");
  list.onclick=event=>{const button=event.target.closest("[data-cleanup-index]");if(!button)return;
    if(scene!==Scene||scope!==sceneEnvironmentScope()||version!==Number(Scene.version||0)||sceneEnvironmentBlocked({notify:false})){toast(sceneEnvironmentCopy("stale"));renderSceneCleanupTools();return false;}
    const target=rows[Number(button.dataset.cleanupIndex)];if(!target)return false;
    const result=removeSceneEnvironment(target);if(result)openSceneEnvironmentList();return result;
  };
  return true;
}
function cancelSceneCleanup(hostId){
  const host=$(hostId);if(!host)return;const draft=host.cleanupDraft,restoreFocus=host.contains?.(document.activeElement);delete host.cleanupDraft;host.hidden=true;host.innerHTML="";
  if(restoreFocus&&draft?.origin?.isConnected&&!draft.origin.disabled&&draft.origin.getClientRects().length)draft.origin.focus({preventScroll:true});
}
function sceneCleanupConfirmation(hostId,message,apply,{allowPending=false,confirmKey="confirm"}={}){
  if(sceneEnvironmentBlocked({allowPending}))return false;
  const host=$(hostId);if(!host)return false;
  // One active confirmation in the current controls, never a new window.
  for(const id of ["scene-layer-clear-confirmation","scene-field-clear-confirmation","scene-reset-confirmation","scene-history-confirmation"])cancelSceneCleanup(id);
  const draft={scene:Scene,scope:sceneEnvironmentScope(),version:Number(Scene.version||0),allowPending,origin:document.activeElement,busy:false};host.cleanupDraft=draft;host.hidden=false;
  const valid=()=>host.cleanupDraft===draft&&draft.scene===Scene&&draft.scope===sceneEnvironmentScope()&&draft.version===Number(Scene.version||0)&&!sceneEnvironmentBlocked({allowPending,notify:false});
  host.innerHTML=`<p>${esc(message)}</p><div class="scene-cleanup-confirm-actions"><button type="button" data-cleanup-confirm>${esc(sceneEnvironmentCopy(confirmKey))}</button><button type="button" data-cleanup-cancel>${esc(sceneEnvironmentCopy("cancel"))}</button></div>`;
  host.onclick=async event=>{
    if(event.target.closest("[data-cleanup-cancel]")){cancelSceneCleanup(hostId);return false;}
    if(!event.target.closest("[data-cleanup-confirm]")||draft.busy)return false;
    if(!valid()){cancelSceneCleanup(hostId);toast(sceneEnvironmentCopy("stale"));return false;}
    draft.busy=true;const confirm=host.querySelector("[data-cleanup-confirm]");if(confirm){confirm.disabled=true;confirm.textContent=sceneEnvironmentCopy("saving");}
    try{return await apply({valid});}finally{if(host.cleanupDraft===draft)cancelSceneCleanup(hostId);}
  };
  host.onkeydown=event=>{if(event.key!=="Escape")return;event.preventDefault();event.stopPropagation();cancelSceneCleanup(hostId);};
  host.querySelector("[data-cleanup-confirm]")?.focus();return true;
}
function renderSceneCleanupTools(){
  const scope=sceneEnvironmentScope(),version=Number(Scene.version||0);
  for(const id of ["scene-layer-clear-confirmation","scene-field-clear-confirmation","scene-reset-confirmation","scene-history-confirmation"]){const draft=$(id)?.cleanupDraft;if(draft&&(draft.scene!==Scene||draft.scope!==scope||draft.version!==version||sceneEnvironmentBlocked({allowPending:draft.allowPending,notify:false})))cancelSceneCleanup(id);}
  const details=$("scene-environment-objects"),list=$("scene-environment-list");
  if(activeSceneView()!=="gm"||typeof Sync==="object"&&Sync?.state?.()?.sceneId&&!Sync.state().canNarrate){if(details)details.open=false;if(list)list.innerHTML="";return;}
  const blocked=sceneEnvironmentBlocked({notify:false});
  if(list){list.setAttribute("aria-disabled",String(blocked));for(const button of list.querySelectorAll("[data-cleanup-index]"))button.disabled=blocked;}
  if(details?.open&&!blocked)openSceneEnvironmentList({notify:false});
}
function previewSceneWall(point){
  sceneWallPreviewPoint={...point,space:Scene.activeSpace};
  const board=$("scene-board");board.querySelectorAll(".scene-wall-preview").forEach(node=>node.remove());
  const side=$("scene-wall-direction").value,vectors={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]},[dx,dy]=vectors[side]||vectors.east,space=activeSceneSpace();
  if(point.x+dx<0||point.y+dy<0||point.x+dx>=space.width||point.y+dy>=space.height)return;
  board.querySelector(`[data-scene-cell="${point.x},${point.y}"]`)?.insertAdjacentHTML("beforeend",`<span aria-hidden="true" class="scene-wall-preview side-${side}"></span>`);
}
function previewSceneEnvironmentErase(point){
  const board=$("scene-board");board.querySelectorAll(".scene-erase-preview,.scene-erase-label").forEach(node=>{if(node.classList.contains("scene-erase-label"))node.remove();else node.classList.remove("scene-erase-preview")});
  const target=sceneEnvironmentTarget(point);if(!target)return;
  const keys=target.type==="object"?target.entity.cells:target.type==="wall"?[target.entity.a,target.entity.b]:[`${target.entity.x},${target.entity.y}`];
  for(const key of keys)board.querySelector(`[data-scene-cell="${CSS.escape(key)}"]`)?.classList.add("scene-erase-preview");
  board.querySelector(`[data-scene-cell="${point.x},${point.y}"]`)?.insertAdjacentHTML("beforeend",`<span class="scene-erase-label">${esc(sceneEnvironmentCopy("preview",{label:target.entity.label||sceneEnvironmentCopy(target.type)}))}</span>`);
}
let sceneMeasurementScope=null;
let sceneCellHighlightCache=null;
let sceneBoardRenderedScope=null;
function invalidateSceneCellHighlights(){sceneCellHighlightCache=null;}
function renderSceneCellHighlights(className,keys){
  const board=$("scene-board");if(!board)return;
  const scope=currentSceneMeasurementScope(),first=board.children?.[0];
  if(!sceneCellHighlightCache||sceneCellHighlightCache.scene!==Scene||sceneCellHighlightCache.board!==board||sceneCellHighlightCache.first!==first||sceneCellHighlightCache.scope!==scope){
    sceneCellHighlightCache={scene:Scene,board,first,scope,cells:new Map([...board.querySelectorAll("[data-scene-cell]")].map(cell=>[cell.dataset.sceneCell,cell])),classes:new Map()};
  }
  const {cells,classes}=sceneCellHighlightCache;
  if(!classes.has(className))classes.set(className,new Set([...cells].filter(([,cell])=>cell.classList.contains(className)).map(([key])=>key)));
  const previous=classes.get(className),next=new Set(keys);
  for(const key of previous)if(!next.has(key))cells.get(key)?.classList.remove(className);
  for(const key of next)if(!previous.has(key))cells.get(key)?.classList.add(className);
  classes.set(className,next);
}
function currentSceneMeasurementScope(){
  const sync=typeof Sync==="undefined"?null:Sync?.state?.(),space=Scene.spaces?.find(item=>item.id===Scene.activeSpace);
  return JSON.stringify([sync?.sceneId||Scene.sceneId||Scene.sceneIdentity||Scene.id||"local",sync?.userId||null,Scene.rulesEdition,Scene.tablePolicy?.mode,Scene.tablePolicy?.epoch||0,Scene.activeSpace,space?.width,space?.height,activeSceneView()]);
}
function reconcileSceneMeasurement(){
  if(sceneMeasurementScope!==null&&sceneMeasurementScope!==currentSceneMeasurementScope())clearSceneMeasurement({render:false});
}
function sceneMeasurementSummary(){
  if(sceneMeasureLabel)return sceneMeasureLabel;
  const view=activeSceneView(),tool=activeSceneTool(),selected=Scene.actors.find(actor=>actor.id===Scene.selectedActor&&(view==="gm"||!actor.hidden)),targets=Scene.actors.filter(actor=>(Scene.targetIds||[]).includes(actor.id)&&(view==="gm"||!actor.hidden)),promptMarker=typeof canControlScenePrompt==="function"&&canControlScenePrompt()?Scene.markers?.find(marker=>marker.id===Scene.pendingPrompt?.context?.markerId):null;
  if(promptMarker)return t("scene.selection.markerMove",{label:promptMarker.label});
  if(tool==="place")return selected?t("scene.selection.place",{name:selected.name}):t("scene.selection.placeEmpty");
  if(tool==="topology")return t("scene.selection.topology",{count:sceneTopologyCells.size});
  return targets.length?t("scene.selection.targets",{count:targets.length,names:targets.map(actor=>actor.name).join(", ")}):selected?t("scene.selection.selected",{name:selected.name}):t("scene.selection.empty");
}
function renderSceneMeasurement({tools=false}={}){
  const board=$("scene-board");
  if(board){
    renderSceneCellHighlights("measured",sceneMeasureCells);
    const host=sceneMeasureEnd&&sceneMeasureLabel?board.querySelector(`[data-scene-cell="${sceneMeasureEnd.x},${sceneMeasureEnd.y}"]`):null,outputs=[...board.querySelectorAll(".scene-measure-readout")];
    let output=outputs.shift();
    for(const extra of outputs)extra.remove();
    if(!host)output?.remove();
    else{
      if(!output){output=document.createElement("output");output.className="scene-measure-readout";output.setAttribute("aria-live","polite");}
      if(output.parentElement!==host)host.appendChild(output);
      if(output.textContent!==sceneMeasureLabel)output.textContent=sceneMeasureLabel;
    }
  }
  const summary=$("scene-selection-summary");if(summary)summary.textContent=sceneMeasurementSummary();
  if(!tools)return;
  const tool=activeSceneTool(),areaType=$("scene-area-type")?.value;
  for(const button of document.querySelectorAll("[data-scene-tool]")){
    const selected=button.dataset.sceneTool===tool&&(tool!=="area"||button.dataset.sceneAreaType===areaType);
    button.classList.toggle("on",selected);button.setAttribute("aria-pressed",String(selected));
  }
  for(const [id,kind]of [["scene-area-controls","area"],["scene-wall-controls","wall"],["scene-marker-controls","marker"],["scene-topology-controls","topology"],["scene-erase-controls","erase"]]){const controls=$(id);if(controls)controls.hidden=tool!==kind;}
}
function clearSceneMeasurement({render=true}={}){
  sceneNeutralTool=null;sceneMeasureStart=null;sceneMeasureEnd=null;sceneMeasureCells.clear();sceneMeasureLabel="";sceneMeasurementScope=null;
  if(render)renderSceneMeasurement({tools:true});
}
// Full canonical updates still use the established board renderer. Only the
// local ruler is reconciled here; its pointer path never rebuilds the board.
if(typeof renderScene==="function"){
  const renderSceneWithoutMeasurement=renderScene;
  renderScene=function(){reconcileSceneMeasurement();return renderSceneWithoutMeasurement.apply(this,arguments);};
}
if(typeof renderSceneBoard==="function"){
  const renderSceneBoardWithoutMeasurement=renderSceneBoard;
  renderSceneBoard=function(){
    const previousScope=sceneMeasurementScope;
    const board=$("scene-board"),focused=document.activeElement,focusScope=sceneBoardRenderedScope;
    const focusKeys=["sceneActor","sceneMarker","sceneWall","sceneCell"],focusKey=board?.contains?.(focused)&&focusKeys.find(key=>focused?.dataset?.[key]);
    const focusValue=focusKey&&focused.dataset[focusKey];
    reconcileSceneMeasurement();
    const result=renderSceneBoardWithoutMeasurement.apply(this,arguments);
    invalidateSceneCellHighlights();
    sceneBoardRenderedScope=currentSceneMeasurementScope();
    if(previousScope!==null)renderSceneMeasurement({tools:sceneMeasurementScope===null});
    if(focusKey&&focusScope===sceneBoardRenderedScope){
      const attribute=focusKey.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`);
      board.querySelector(`[data-${attribute}="${CSS.escape(focusValue)}"]`)?.focus({preventScroll:true});
    }
    return result;
  };
}
function updateSceneMeasurement(point,{complete=false}={}){
  const previousScope=sceneMeasurementScope;reconcileSceneMeasurement();
  if(previousScope!==null&&sceneMeasurementScope===null){renderSceneMeasurement({tools:true});return false;}
  if(activeSceneTool()!=="measure")return false;
  const space=Scene.spaces?.find(item=>item.id===Scene.activeSpace);
  if(!space||!Number.isInteger(point?.x)||!Number.isInteger(point?.y)||point.x<0||point.y<0||point.x>=space.width||point.y>=space.height)return false;
  sceneMeasurementScope=currentSceneMeasurementScope();
  if(!sceneMeasureStart){sceneMeasureStart={...point};sceneMeasureEnd={...point};sceneMeasureCells=new Set([`${point.x},${point.y}`]);sceneMeasureLabel=t("scene.measure.distance",{distance:0});}
  else{
    const distance=Math.abs(point.x-sceneMeasureStart.x)+Math.abs(point.y-sceneMeasureStart.y);
    sceneMeasureEnd={...point};sceneMeasureCells=new Set(measurementPath(sceneMeasureStart,point));sceneMeasureLabel=t("scene.measure.distance",{distance});
    if(complete)sceneMeasureStart=null;
  }
  renderSceneMeasurement();return true;
}
function changeSceneTool(requested){
  if(requested==="measure"){clearSceneMeasurement({render:false});sceneNeutralTool="measure";sceneMeasurementScope=currentSceneMeasurementScope();renderSceneMeasurement({tools:true});return;}
  clearSceneMeasurement({render:false});
  const localFlow=Boolean(typeof lwDestination!=="undefined"&&lwDestination||Scene.pendingActionPlan||pendingCoreAction||pendingCoreReaction||pendingTechniqueRule||pendingEnemyRule||pendingEnemyStepActorId||pendingZealotPlan);
  if(localFlow)cancelSceneFlow();
  const current=activeSceneTool(),toggleOff=requested===current&&requested==="target";
  if(activeSceneView()==="player")playerSceneTool=toggleOff?"select":requested;else Scene.tool=toggleOff?"select":requested;
  if(toggleOff||!["select","target","measure"].includes(requested)){Scene.targetIds=[];Scene.targetCells=[]}
  scenePreviewCells.clear();sceneTopologyCells.clear();sceneMeasureStart=null;sceneMeasureCells.clear();sceneMeasureLabel=activeSceneTool()==="measure"?"Линейка: выберите начальную клетку":"";
  persist();renderScene();
  if(!toggleOff&&requested==="target")toast("Цель: клик по жетону выбирает персонажа; Shift+клик выбирает именно клетку под жетоном");
}
function cancelCommittedAction(reason="Цепочка прервана Нарратором"){const prepared=SceneEngine.cancelPendingAction(Scene,{reason});if(!prepared.ok)return toast(prepared.errors.join(" "));if(commitSceneEvents("Цепочка Атаки прервана",prepared.events))toast("Цепочка закрыта без урона")}
function resolveCommittedAction(){const prepared=SceneEngine.resolvePendingAction(Scene,D);if(!prepared.ok)return toast(prepared.errors.join(" "));const label=prepared.cancelled?"Цепочка Атаки прервана":"Атака разрешена";if(commitSceneEvents(label,prepared.events))toast(prepared.cancelled?"Цепочка закрыта без урона":"Цепочка действия завершена: урон и Эффекты применены")}
function fodderBatchEditorHtml(prompt){
  const crowds=[...new Set(prompt.context?.eligibleCrowdIds||[])].map(id=>Scene.actors.find(actor=>actor.id===id)).filter(actor=>actor?.kind==="crowd"&&!actor.knockedOut),targetsFor=crowd=>Scene.actors.filter(target=>!target.knockedOut&&target.team!==crowd.team&&target.space===crowd.space&&Math.abs(target.x-crowd.x)+Math.abs(target.y-crowd.y)<=1),allTargets=[...new Map(crowds.flatMap(targetsFor).map(target=>[target.id,target])).values()];
  const rows=crowds.map((crowd,index)=>{const targets=targetsFor(crowd),cell=`${String.fromCharCode(65+Number(crowd.x))}${Number(crowd.y)+1}`;return`<label class="fodder-batch-row"><span><i>${index+1}</i><strong>${esc(crowd.name)}</strong><small>${cell}</small></span><select data-fodder-batch-zone="${esc(crowd.id)}" aria-label="Цель зоны ${index+1}: ${esc(crowd.name)}"><option value="">Не атакует</option>${targets.map(target=>`<option value="${esc(target.id)}">${esc(target.name)} · 2 урона</option>`).join("")}</select></label>`}).join("");
  return`<div class="fodder-batch-editor"><div class="fodder-batch-tools"><button type="button" data-fodder-batch-preset="spread">Распределить</button><label>Сосредоточить<select data-fodder-batch-focus><option value="">Выберите цель</option>${allTargets.map(target=>`<option value="${esc(target.id)}">${esc(target.name)}</option>`).join("")}</select></label><button type="button" data-fodder-batch-preset="focus">Заполнить</button><button type="button" data-fodder-batch-preset="clear">Очистить</button></div><div class="fodder-batch-rows">${rows}</div><div class="fodder-batch-footer"><output data-fodder-batch-summary>Никто не получает урон</output><button type="button" class="primary" data-fodder-batch-submit>Применить пакет</button></div></div>`;
}
function fodderMoveBatchEditorHtml(prompt){
  const crowds=[...new Set(prompt.context?.remainingTargetIds||[])].map(id=>Scene.actors.find(actor=>actor.id===id)).filter(actor=>actor?.kind==="crowd"&&!actor.knockedOut),cellName=(x,y)=>`${String.fromCharCode(65+Number(x))}${Number(y)+1}`;
  const rows=crowds.map((crowd,index)=>{const destinations=SceneEngine.fodderMoveDestinations(Scene,crowd.id),current=`${crowd.x},${crowd.y}`;return`<label class="fodder-batch-row"><span><i>${index+1}</i><strong>${esc(crowd.name)}</strong><small>${cellName(crowd.x,crowd.y)}</small></span><select data-fodder-move-zone="${esc(crowd.id)}" aria-label="Перемещение зоны ${index+1}: ${esc(crowd.name)}">${destinations.map(destination=>{const value=`${destination.x},${destination.y}`;return`<option value="${value}" ${value===current?"selected":""}>${value===current?"Оставить":`→ ${cellName(destination.x,destination.y)} · ${destination.distance}`}</option>`}).join("")}</select></label>`}).join("");
  return`<div class="fodder-batch-editor"><div class="fodder-batch-tools"><button type="button" data-fodder-move-preset="advance">К ближайшим противникам</button><button type="button" data-fodder-move-preset="hold">Оставить всех</button><small>Каждую строку можно поправить вручную перед подтверждением.</small></div><div class="fodder-batch-rows">${rows}</div><div class="fodder-batch-footer"><output>${crowds.length} зон · пути проверяются повторно</output><button type="button" class="primary" data-fodder-move-submit>Переместить пакет</button></div></div>`;
}
function renderSceneFlow(){
  if(globalThis.window?.DAWN_TABLE_POLICY?.isManual(Scene)){const root=$("scene-flow");if(root){root.hidden=true;if(root.innerHTML)root.innerHTML="";}return;}
  $("scene-flow").hidden=false;
  const root=$("scene-flow"),active=Scene.actors.find(actor=>actor.id===Scene.activeActorId),prompt=Scene.pendingPrompt,pending=Scene.pendingAction,pendingStatus=SceneEngine.pendingActionStatus(Scene,D),triggerQueue=SceneEngine.triggerQueueStatus(Scene),roundStatus=SceneEngine.roundEndStatus(Scene),roundStarted=Scene.actors.some(actor=>actor.acted),readyActors=Scene.actors.filter(actor=>!actor.knockedOut&&!actor.acted),heroes=Scene.actors.filter(actor=>actor.team==="hero"&&actor.kind!=="token"),enemies=Scene.actors.filter(actor=>actor.team==="enemy"&&actor.kind!=="token"),heroesDown=heroes.length>0&&heroes.every(actor=>actor.knockedOut),enemiesDown=enemies.length>0&&enemies.every(actor=>actor.knockedOut),battleOutcome=heroes.length&&enemies.length?(heroesDown&&enemiesDown?"draw":enemiesDown?"victory":heroesDown?"defeat":null):null,gm=activeSceneView()==="gm",compactLandscape=matchMedia("(max-width:950px) and (max-height:500px) and (orientation:landscape)").matches;let phase="turn",title="Ход не начат",hint=gm?(roundStarted?(roundStatus.available?"Все обязательные Ходы завершены — можно начать новый Раунд.":roundStatus.reason):"Выберите участника в ленте ходов."):"Нарратор ещё не начал Ход.",steps=sceneFlowSteps(["Начать Ход","Выбрать действие"],0),actions="";
  if(!Scene.actors.length){phase="setup";title="Подготовьте столкновение";hint=gm?"Добавьте героев и противников, расставьте токены и начните Ход любого участника.":"Нарратор готовит участников и поле.";steps=sceneFlowSteps(["Участники","Расстановка","Первый Ход"],0);actions=gm?`<button type="button" class="primary" data-open-scene-panel="add">Добавить участников</button>`:""}
  else if(roundStatus.available){phase="round";title=`Раунд ${Scene.round} завершён`;hint="Все обязательные Ходы сыграны. Новый Раунд повысит Напряжение и восстановит ОД.";steps=sceneFlowSteps(["Все Ходы","Конец Раунда","Новый Раунд"],1);actions=gm?`<button type="button" class="primary" data-scene-flow-round>Начать Раунд ${Scene.round+1}</button>`:""}
  else if(!active){const selfStart=sceneTurnApprovalMode()==="self",eligible=readyActors.filter(actor=>SceneEngine.turnStartStatus(Scene,actor.id).available&&(gm||selfStart&&actor.heroId===S.id));title=readyActors.length?"Кто действует следующим?":"Проверьте состояние Раунда";hint=readyActors.length?gm?`Готовы: ${readyActors.map(actor=>actor.name).join(", ")}. Выберите участника в пульте — недоступные по чередованию не предлагаются.`:selfStart?"Если сторона героев может действовать, игрок с готовым персонажем начинает его Ход здесь.":"Нарратор выберет следующего участника.":(roundStatus.reason||"Откройте пульт Нарратора для ручного решения.");actions=gm?`<button type="button" data-scene-flow-director>Выбрать в пульте</button>`:eligible.map(actor=>`<button type="button" class="primary" data-scene-flow-turn="${actor.id}">Начать Ход · ${esc(actor.name)}</button>`).join("")}
  const nativeChoice=Scene.rulesEdition==="lionwing"?Scene.lionwing?.choices?.[0]:null;
  if(nativeChoice){
    const owner=Scene.actors.find(actor=>actor.id===nativeChoice.actorId);
    phase="reaction";title=window.DAWN_I18N.t("scene.flow.native-choice.title",{actor:owner?.name||window.DAWN_I18N.t("scene.flow.native-choice.actor"),title:nativeChoice.title||window.DAWN_I18N.t("scene.flow.native-choice.fallback")});
    hint=window.DAWN_I18N.t("scene.flow.native-choice.hint");
    steps=sceneFlowSteps(["action","consequence","decision","continue"].map(key=>window.DAWN_I18N.t(`scene.flow.native-choice.${key}`)),2);
    actions=`<button type="button" data-open-scene-panel="${gm?"director":"sheet"}">${esc(window.DAWN_I18N.t("scene.flow.native-choice.open"))}</button>`;
  }
  else if(prompt){const placement=["marker-move-cell","wisp-create-cell","dim-mak-weak-point-cell","empath-rush-cell","reappear-cell","knife-pickup-step","meister-overclock-move","egomaniac-style-move","thunder-surge-cell","siren-irresistible-cell","untouchable-weave-cell","constrictor-move-cell","enemy-move-cell","enemy-crowd-move-cell","fodder-move-cell"].includes(prompt.kind),innerWorldPlacement=["inner-world-target-cell","inner-world-caster-cell"].includes(prompt.kind),broodPlacement=prompt.kind==="enemy-broodmother-fodder",controlled=canControlScenePrompt(prompt),marker=placement&&Scene.markers.find(item=>item.id===prompt.context?.markerId);phase=placement||innerWorldPlacement||broodPlacement?"destination":"reaction";title=prompt.title||"Сработало правило";hint=controlled?`${marker?`${marker.label}: `:""}${prompt.text||"Выберите, как разрешить сработавшее правило."}${placement||innerWorldPlacement||broodPlacement?" Допустимые клетки подсвечены прямо на поле.":""}${triggerQueue.count?` После ответа в очереди: ${triggerQueue.count}.`:""}`:prompt.controller==="narrator"?"Решение принимает Нарратор.":`Решение принимает ${Scene.actors.find(actor=>actor.id===prompt.sourceActorId)?.name||"другой участник"}.`;steps=sceneFlowSteps(innerWorldPlacement?["Активировать","Противник","Инициатор"]:["Триггер",placement?"Клетка":"Решение",triggerQueue.count?`Последствие · ещё ${triggerQueue.count}`:"Последствие"],innerWorldPlacement?1:1);actions=!controlled?"":broodPlacement?`<button type="button" data-rule-prompt-choice="pass">Не создавать Зону</button>`:placement||innerWorldPlacement?`<button type="button" data-rule-prompt-choice="cancel">Отменить</button>`:(prompt.options||[]).map(choice=>`<button type="button" class="${["attack","transform","rush","stop","study","stun","place","accept","pull","call-help"].includes(choice)?"primary":""}" data-rule-prompt-choice="${esc(choice)}">${esc(rulePromptChoiceLabel(prompt,choice))}</button>`).join("")}
  else if(typeof lwDestination!=="undefined"&&lwDestination){phase="destination";title=window.DAWN_I18N.t("scene.destination.title",{action:lwDestination.label,field:window.DAWN_I18N.t(`scene.destination.field.${lwDestination.field||"destination"}`)});hint=window.DAWN_I18N.t("scene.destination.hint");steps=sceneFlowSteps(["Действие","Клетка","Готово"],1);actions=`<button type="button" data-scene-flow-cancel>${esc(window.DAWN_I18N.t("scene.destination.cancel"))}</button>`}
  else if(pending){const waiting=pendingStatus.waitingIds,answered=pendingStatus.answeredIds.length,total=pendingStatus.eligibleIds.length,skipped=pendingStatus.unavailableIds.length,target=Scene.actors.find(actor=>actor.id===waiting[0]),gm=activeSceneView()==="gm";if(pendingStatus.mustCancel){phase="interrupted";title=`«${sceneActionDisplayName(pending.actionId||pending.sourceActionId,pending.name)}» прервано`;hint=pendingStatus.interruptedReason||"Все цели уже недоступны. Закройте цепочку без урона.";steps=sceneFlowSteps(["Действие","Цели","Прервано"],2);actions=gm?`<button type="button" class="primary" data-core-cancel-pending>Закрыть цепочку</button>`:""}else{phase=waiting.length?"reaction":"resolve";title=waiting.length?`Реакция: ${target?.name||"цель"}`:`«${sceneActionDisplayName(pending.actionId||pending.sourceActionId,pending.name)}» готово к разрешению`;hint=waiting.length?`Ответы ${answered}/${total}.${skipped?` Недоступных целей: ${skipped}.`:""} Выберите защиту — её эффект будет показан до урона.`:`Все доступные цели ответили.${skipped?` Будет пропущено целей: ${skipped}.`:""} Нарратор может применить бросок и урон.`;steps=sceneFlowSteps(["Действие","Цели","Бросок",`Реакции ${answered}/${total}`,"Урон"],waiting.length?3:4);actions=`<button type="button" data-open-scene-panel="sheet">${waiting.length?"Открыть Реакции":"Проверить исход"}</button>${gm?`<button type="button" ${waiting.length?`class="danger-quiet" data-core-cancel-pending`:`class="primary" data-core-resolve`}>${waiting.length?"Прервать":"Разрешить"}</button>`:""}`}}
  else if(Scene.pendingActionPlan){const plan=Scene.pendingActionPlan,actor=Scene.actors.find(item=>item.id===plan.actorId),reappear=plan.phase==="reappear",destination=plan.phase==="destination",modifierDestination=destination&&plan.context?.destinationKind==="attack-modifier",assassination=reappear&&["skirmish","spell","finish"].some(key=>SceneEngine.actionIdIs(plan.actionId,key))&&Number(actor?.techniques?.["vagabond.assassin"]||0)>=2;phase=reappear||destination?"destination":"confirm";title=reappear?`${plan.actionName}: клетка появления`:modifierDestination?"Перелом позвоночника: телепортация":destination?`${plan.actionName}: клетка назначения`:`${plan.actionName}: подтвердить`;hint=reappear?(assassination?"«Ликвидация» разрешает выбрать любую свободную клетку, в том числе смежную с персонажем. Поле и ресурсы пока не изменятся.":"Выберите свободную клетку, не смежную с персонажами. Выбор сохранится в журнале, но поле и ресурсы пока не изменятся."):modifierDestination?"Выберите незанятую клетку, смежную с единственной Подброшенной целью. Телепортация, замена Атаки и оплата произойдут только после общего подтверждения.":destination?"Выберите итоговую клетку действия. Появление, оплата и действие будут применены одним пакетом.":`Все клетки составного действия ${actor?`для ${actor.name}`:""} сохранены. Подтвердите весь план; при отмене поле останется прежним.`;steps=sceneFlowSteps(modifierDestination?["Стычка","Вбить","Телепортация","Завершение Телом"]:["Действие","Появление",destination?"Назначение":"Подтверждение","Готово"],reappear?1:destination?2:2);actions=`${!reappear&&!destination?`<button type="button" class="primary" data-action-plan-continue>Подтвердить действие</button>`:""}<button type="button" data-scene-flow-cancel>Отменить без затрат</button>`}
  else if(pendingZealotPlan){const linePhase=pendingZealotPlan.phase==="lines",index=pendingZealotPlan.destinations.length,target=Scene.actors.find(actor=>actor.id===pendingZealotPlan.targetIds[index]);phase=linePhase?"area":"destination";title=linePhase?"Так не должно было быть: две Линии":`Сдвиг: ${target?.name||"персонаж"}`;hint=linePhase?`Выберите две пересекающиеся бесконечные Линии. Выбрано ${pendingZealotPlan.lines.length}/2 · R меняет направление. Озарение и ОД ещё не расходуются.`:`Выберите подсвеченную смежную клетку вне обеих Линий. Перемещено ${index}/${pendingZealotPlan.targetIds.length}; весь план подтвердится атомарно.`;steps=sceneFlowSteps(["Завершение","Две Линии","Сдвиги","Разрыв","Реакции"],linePhase?1:2);actions=`<button type="button" data-scene-flow-cancel>Отменить без затрат</button>`}
  else if(pendingCoreReaction){const actor=Scene.actors.find(item=>item.id===pendingCoreReaction.actorId),distance=Number(actor?.techniques?.["vagabond.untouchable"]||0)>=2?3:2;phase="destination";title=`Уворот: ${actor?.name||"цель"}`;hint=`Выберите свободную клетку в пределах ${distance} клеток. Допустимый итог сразу появится в журнале.`;steps=sceneFlowSteps(["Реакция","Клетка","Подтвердить"],1);actions=`<button type="button" data-scene-flow-cancel>Отменить</button>`}
  else if(pendingCoreAction){const action=D.actions.list.find(item=>item.id===pendingCoreAction),actor=currentHeroActor(),appearance=SceneEngine.actionIsAny(action,["skirmish","spell","finish"])&&sceneActorEffects(actor).includes("positive.исчез"),continuing=SceneEngine.actionIs(action,"step")&&(actor?.usedActions||[]).includes(action.id)&&Number(actor?.stepRemaining||0)>0,baseLimit=SceneEngine.actionIs(action,"jump")?Number(actor?.attrs?.talent||0):continuing?Number(actor?.stepRemaining||0):Number(actor?.speed||0),limit=sceneActorEffects(actor).includes("positive.ускорен")?baseLimit*2:sceneActorEffects(actor).includes("negative.замедлен")?Math.floor(baseLimit/2):baseLimit;phase="destination";const masterMode=pendingCoreActionContext?.context?.masterFinisherMode;title=masterMode?`Мастер за работой · ${masterMode=== "blade"?"Клинок":masterMode=== "polearm"?"Древко":"Цепь"}`:appearance?`Ликвидация: клетка появления`:`${continuing?"Продолжить Шаг":action?.name||"Перемещение"}: клетка назначения`;hint=masterMode?masterMode==="blade"?"Выберите итоговую клетку движения до 2 клеток; путь игнорирует персонажей, а цели пересечения будут выведены из маршрута.":masterMode==="polearm"?"Выберите смежную клетку направления Линии длиной 2; обе клетки подсветятся, цели и дополнительное Преимущество проверяются автоматически.":"Выберите смежный центр зоны 1×1; после броска Критические успехи расширят проверенную область.":"";hint=masterMode?hint:appearance?"Выберите любую пустую клетку: «Ликвидация» разрешает появиться и рядом с персонажем. После выбора начнётся Атака с преимуществом Ступени и критами на 5–6.":`Подсвечены свободные клетки в пределах ${limit}${SceneEngine.actionIs(action,"jump")?" по прямой Линии":""}. ${continuing?"ОД уже потрачено; используется сохранённое движение.":"Ресурс спишется после корректного выбора."}`;steps=sceneFlowSteps(["Действие","Клетка","Готово"],1);actions=`<button type="button" data-scene-flow-cancel>Отменить</button>`}
  else if(pendingEnemyStepActorId){const actor=Scene.actors.find(item=>item.id===pendingEnemyStepActorId),step=SceneEngine.actionByKey(D,"step"),available=actor&&SceneEngine.availableActions(Scene,D,actor.id).find(item=>item.id===step?.id),limit=Number(available?.continuation?available.remaining:actor?.speed||0);phase="destination";title=`Шаг: ${actor?.name||"противник"}`;hint=`Выберите подсвеченную свободную клетку в пределах ${limit}. ОД спишется только после корректного выбора; остаток движения можно использовать позже.`;steps=sceneFlowSteps(["Шаг","Клетка","Перемещение"],1);actions=`<button type="button" data-scene-flow-cancel>Отменить без затрат</button>`}
  else if(pendingEnemyRule){const actor=Scene.actors.find(item=>item.id===pendingEnemyRule.actorId),rule=enemyProfile(actor?.profileId)?.rules?.find(item=>item.id===pendingEnemyRule.ruleId),assassin=pendingEnemyRule.phase==="assassin-reappear";phase=assassin?"destination":"area";title=assassin?`${rule?.name||"Удар"}: появление`:`${rule?.name||"Действие врага"}: область`;hint=assassin?"Выберите свободную клетку рядом с выбранной целью. Ассасин появится в ней и сразу продолжит эту же Атаку с бонусом из Исчезновения.":"Наведите на поле, проверьте подсветку и выберите центр области.";steps=sceneFlowSteps(assassin?["Цель","Появление","Удар","Реакции"]:["Действие","Область","Цели","Реакции"],1);actions=`<button type="button" data-scene-flow-cancel>Отменить</button>`}
  else if(pendingTechniqueRule){const nails=pendingTechniqueRule.form==="nails",idol=pendingTechniqueRule.form==="idol",area=pendingTechniqueRule.kind==="area";phase="area";title=`Техника: ${pendingTechniqueRule.name}`;hint=nails?`Выберите две пересекающиеся Линии длиной 3. Выбрано: ${pendingTechniqueLines.length}/2 · R меняет направление.`:idol?`Выберите 1–6 связанных клеток. Выбрано: ${pendingTechniqueCells.length}.`:`Выберите клетку${pendingTechniqueRule.shape==="line"?"; клавиша R поворачивает линию":""}. До подтверждения ресурсы не расходуются.`;steps=sceneFlowSteps(["Техника","Позиция","Эффект"],1);actions=`${(idol||area)?`<button type="button" class="primary" data-confirm-technique-cells ${idol&&!pendingTechniqueCells.length||area&&!pendingTechniqueAnchor?"disabled":""}>Подтвердить ${idol?"клетки":"центр"}</button>`:""}<button type="button" data-scene-flow-cancel>Отменить</button>`}
  else if(battleOutcome){phase="result";title=battleOutcome==="victory"?"Противники выведены из боя":battleOutcome==="defeat"?"Герои выведены из боя":"Обе стороны выведены из боя";hint=gm?"Столкновение завершено. Зафиксируйте последствия в журнале или вручную верните участника в бой, если сцена продолжается.":battleOutcome==="victory"?"Столкновение завершено победой героев.":battleOutcome==="defeat"?"Столкновение завершено поражением героев.":"Столкновение завершено без действующей стороны.";steps=sceneFlowSteps(["Столкновение","Последний исход","Последствия"],2);actions=gm?`<button type="button" class="primary" data-scene-flow-director>Открыть итоги в пульте</button>`:""}
  else if(active){const progress=SceneEngine.turnActionProgressStatus(Scene,active.id),canControl=activeSceneView()==="gm"||active.heroId===S.id,current=progress.readyToEnd?progress.total+1:progress.currentAction;phase=progress.readyToEnd?"finish":"action";title=progress.readyToEnd?`Завершите Ход: ${active.name}`:`Действие ${progress.currentAction} из ${progress.total}: ${active.name}`;hint=progress.readyToEnd?`Все ${progress.total} действия использованы. Быстрые действия не занимают деление; завершите Ход, когда больше ничего не требуется.`:active.team==="enemy"?(compactLandscape?"Откройте Пульт противника.":`Осталось действий: ${progress.remaining}. Выберите действие противника в Пульте.`):active.heroId===S.id?`Осталось действий: ${progress.remaining}. Выберите базовое действие или Технику; Быстрое не сдвигает шкалу.`:"Ожидается действие текущего участника.";steps=sceneFlowSteps(progress.labels,current);actions=progress.readyToEnd?(canControl?`<button type="button" class="primary" data-scene-flow-end-turn>Завершить Ход</button>`:""):(active.heroId===S.id?`<button type="button" data-open-scene-panel="sheet">Открыть действия</button>`:"")}
  if(prompt?.kind==="fodder-round-batch"&&canControlScenePrompt(prompt))actions=fodderBatchEditorHtml(prompt);
  if(prompt?.kind==="fodder-move-select"&&canControlScenePrompt(prompt))actions=fodderMoveBatchEditorHtml(prompt);
  root.dataset.phase=phase;root.innerHTML=`<div class="scene-flow-copy"><span>${phase==="reaction"?"ОЖИДАЕТСЯ ОТВЕТ":phase==="resolve"?"ГОТОВО К УРОНУ":phase==="interrupted"?"ЦЕПОЧКА ПРЕРВАНА":phase==="finish"?"ХОД ГОТОВ К ЗАВЕРШЕНИЮ":phase==="result"?"СТОЛКНОВЕНИЕ ЗАВЕРШЕНО":"ТЕКУЩИЙ ЭТАП"}</span><strong>${esc(title)}</strong><small>${esc(hint)}</small></div>${steps}<div class="scene-flow-actions">${actions}</div>`;
}
