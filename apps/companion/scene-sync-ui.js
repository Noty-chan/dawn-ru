"use strict";

function commandSummary(command){
  if(command.command_type==="set_targets")return "Предложены цели";
  if(command.command_type==="request_undo")return "Запрошен откат";
  if(command.command_type==="join_hero")return "Герой готов войти в Сцену";
  if(command.command_type==="update_runtime")return "Изменение ресурса героя";
  if(command.command_type==="intent_v2"){const intent=command.payload?.intent||{},actor=Scene.actors.find(item=>item.id===intent.actorId),names={action:"действие",reaction:"Реакция",technique:"Техника","rule-response":"решение правила","public-roll":"бросок"};return`${actor?.name||"Игрок"}: ${intent.label||names[intent.kind]||"действие"}`}
  if(command.command_type!=="dispatch_events")return command.command_type;
  const events=Array.isArray(command.payload?.events)?command.payload.events:[],prepared=events.find(event=>event.type==="action.prepare"),reaction=events.find(event=>event.type==="reaction.respond"),technique=events.find(event=>event.type==="technique.prepare"),ruleResponse=events.find(event=>event.type==="rule.respond"),actor=Scene.actors.find(item=>item.id===(prepared?.actorId||reaction?.actorId||technique?.actorId||ruleResponse?.actorId));
  if(prepared)return `${actor?.name||"Игрок"}: ${prepared.payload?.name||"действие"}`;
  if(reaction)return `${actor?.name||"Игрок"}: Реакция — ${reaction.payload?.choice||"ответ"}`;
  if(technique)return `${actor?.name||"Игрок"}: ${technique.payload?.name||"Техника"}`;
  if(ruleResponse)return `${actor?.name||"Игрок"}: ${Scene.pendingPrompt?.title||"решение правила"}`;
  return "Пакет событий игрока";
}
function canonicalPlayerEvents(command){
  if(window.DAWN_LIONWING_ENGINE?.isScene(Scene))throw new Error("LionWing принимает игровые намерения через новый сетевой протокол");
  const raw=Array.isArray(command.payload?.events)?command.payload.events:[];
  if(!raw.length||raw.length>16)throw new Error("Команда содержит некорректный пакет событий");
  const ruleResponse=raw.find(event=>event.type==="rule.respond");
  if(ruleResponse){
    const actor=Scene.actors.find(item=>item.id===ruleResponse.actorId),prompt=Scene.pendingPrompt;
    if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет героем, отвечающим на правило");
    if(prompt?.controller==="narrator")throw new Error("Это решение принимает Нарратор");
    if(!prompt||prompt.id!==ruleResponse.payload?.promptId||prompt.sourceActorId!==actor.id)throw new Error("Это решение относится к уже завершённому вопросу");
    const markerMove=raw.find(event=>event.type==="marker.move"),actorMove=raw.find(event=>event.type==="actor.move"),destination=ruleResponse.payload?.destination||(markerMove||actorMove)?.payload;
    const result=ruleResponse.payload?.choice==="cell"&&destination
      ?SceneEngine.preparePromptPlacement(Scene,{destination:{x:Number(destination.x),y:Number(destination.y)}})
      :SceneEngine.respondRulePrompt(Scene,D,{choice:ruleResponse.payload?.choice,assignments:ruleResponse.payload?.assignments||{},roll:raw.find(event=>event.type==="roll.public")?.payload||raw.find(event=>event.type==="attack.pending")?.payload?.roll||null});
    if(!result.ok)throw new Error(result.errors.join(" "));
    return result.events;
  }
  const prepared=raw.find(event=>event.type==="action.prepare");
  if(prepared){
    const actor=Scene.actors.find(item=>item.id===prepared.actorId),move=raw.find(event=>event.type==="actor.move"&&event.actorId===prepared.actorId),pending=raw.find(event=>event.type==="attack.pending"),roll=raw.find(event=>event.type==="roll.public")?.payload||pending?.payload?.roll||null,request=prepared.payload?.request||{};
    if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет исполнителем действия");
    const destination=move?{x:Number(move.payload?.x),y:Number(move.payload?.y)}:undefined,result=SceneEngine.prepareAction(Scene,D,{actorId:prepared.actorId,actionId:prepared.payload?.actionId,targetIds:prepared.payload?.targetIds||[],targetCells:prepared.payload?.targetCells||request.targetCells||[],destination,armamentMode:request.armamentMode||null,armamentDestination:request.armamentMode==="blade"?(request.armamentDestination||destination):null,roll,attribute:request.attribute||roll?.attribute||null,useCunningPlan:Boolean(request.useCunningPlan),useRevelation:Boolean(request.useRevelation),useThunderDischarge:Boolean(request.useThunderDischarge),useEclipseStars:Boolean(request.useEclipseStars),useGrasp:Boolean(request.useGrasp),startRage:Boolean(request.startRage),bulletsSpent:request.bulletsSpent,bulletAdvantage:request.bulletAdvantage,throwWeapon:Boolean(request.throwWeapon),overload:Boolean(request.overload),provokeTargetIds:Array.isArray(request.provokeTargetIds)?request.provokeTargetIds:[],removeEffectIdsByTarget:request.removeEffectIdsByTarget&&typeof request.removeEffectIdsByTarget==="object"?request.removeEffectIdsByTarget:{},attackModifierIds:Array.isArray(request.attackModifierIds)?request.attackModifierIds:[]});
    if(!result.ok)throw new Error(result.errors.join(" "));
    return result.events;
  }
  const reaction=raw.find(event=>event.type==="reaction.respond");
  if(reaction){
    const actor=Scene.actors.find(item=>item.id===reaction.actorId),move=raw.find(event=>event.type==="actor.move"&&event.actorId===reaction.actorId);
    if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет отвечающим персонажем");
    const result=SceneEngine.respondReaction(Scene,D,{actorId:reaction.actorId,choice:reaction.payload?.choice,destination:move?{x:Number(move.payload?.x),y:Number(move.payload?.y)}:reaction.payload?.destination});
    if(!result.ok)throw new Error(result.errors.join(" "));
    return result.events;
  }
  const technique=raw.find(event=>event.type==="technique.prepare");
  if(technique){const actor=Scene.actors.find(item=>item.id===technique.actorId);if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет исполнителем Техники");const request=technique.payload?.request||{},rule=TechniqueEngine.RULES.find(item=>item.id===technique.payload?.ruleId);let prepared;if(rule)prepared=TechniqueEngine.preview(Scene,{...request,actorId:actor.id,ruleId:rule.id});else{const entry=TechniqueEngine.techniqueCoverage(D,actor.techniques||{}).find(item=>item.id===request.entryId),effectIds=safeTechniqueEffectIds(entry);prepared=request.mode==="assist"?TechniqueEngine.assistedPreview(Scene,{actorId:actor.id,entry,targetIds:request.targetIds,effectIds,note:request.note}):TechniqueEngine.manualPreview(Scene,{actorId:actor.id,entry,targetIds:request.targetIds,note:request.note})}if(!prepared?.ok)throw new Error(prepared?.errors?.join(" ")||"Техника больше недоступна");return TechniqueEngine.toEvents(Scene,prepared)}
  const publicRoll=raw.find(event=>event.type==="roll.public");
  if(publicRoll&&raw.length===1){const actor=Scene.actors.find(item=>item.id===publicRoll.actorId);if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет автором броска");SceneEngine.validateEvent(Scene,{...publicRoll,id:publicRoll.id||uid(),payload:publicRoll.payload||{}});return [{type:"roll.public",actorId:actor.id,payload:publicRoll.payload}]}
  throw new Error("Этот пакет нельзя безопасно восстановить как действие, Технику или решение правила");
}
function remoteCommandEvent(type,command,payload={}){
  return{id:uid(),type,actorId:null,payload:{commandId:command.id,commandActorId:command.actor_id,...payload},at:new Date().toISOString()};
}
function snapshotCommandCandidate(label,event,mutator){
  const before=sceneSnapshot(),candidate=normalizeScene(before);mutator(candidate);validateTableEdit(before,candidate);if(window.DAWN_TABLE_POLICY?.isManual(before)){if((before.actors||[]).some(actor=>actor.hidden&&actor.characterId===event.payload?.characterId))label="Обновлён герой игрока";event={id:event.id,at:event.at,type:"legacy.note",actorId:null,visibility:"public",text:label,payload:{label}};}candidate.version=Number(before.version||0)+1;candidate.undo.unshift({id:uid(),label,state:before});candidate.undo=candidate.undo.slice(0,20);candidate.log.unshift({id:event.id,at:event.at,text:label,type:event.type,actorId:null,payload:event.payload,visibility:"public"});candidate.log=candidate.log.slice(0,200);return{candidate,events:[event],label};
}
async function prepareRemoteHeroCommand(command){
  const characterId=command.payload?.characterId;if(typeof characterId!=="string")throw new Error("В команде нет ссылки на лист героя");
  const record=await Sync.loadCharacter(characterId);if(record.owner_id!==command.actor_id)throw new Error("Лист не принадлежит отправившему его игроку");
  const hero=normalizeHero(record.state),existing=Scene.actors.find(actor=>actor.characterId===record.id||actor.ownerId===record.owner_id),position=existing?{x:existing.x,y:existing.y}:firstEmptyCell(Scene.activeSpace);
  const label=`${existing?"Обновлён":"Добавлен"} герой игрока «${hero.name||record.name}»`,event=remoteCommandEvent("command.join-hero",command,{characterId:record.id,heroId:hero.id,name:hero.name||record.name});
  return snapshotCommandCandidate(label,event,scene=>{const current=scene.actors.find(actor=>actor.characterId===record.id||actor.ownerId===record.owner_id),base={...(current||{})};if(!window.DAWN_TABLE_POLICY?.isManual(scene)&&!sceneCombatStarted(scene)){delete base.focus;delete base.hp;delete base.maxHp}const actor=heroActorState(hero,{...base,id:current?.id||uid(),ownerId:record.owner_id,characterId:record.id,space:current?.space||scene.activeSpace,...position,armor:current?.armor||0,evasion:current?.evasion||0});if(current)Object.assign(current,actor);else{scene.actors.push(actor);placeActorsSafely(scene,[actor],scene.spaces.find(space=>space.id===scene.activeSpace),"Резерв подключившихся героев")}scene.activeSpace=actor.space;scene.selectedActor=actor.id});
}
function prepareRuntimeCommand(command){if(window.DAWN_LIONWING_ENGINE?.isScene(Scene))throw new Error("Точные исправления LionWing доступны Нарратору");const {actorId,key,value}=command.payload||{},actor=Scene.actors.find(item=>item.id===actorId),allowed=new Set(["hp","wounds","stress","focus","influence","ap"]);if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет этим героем");if(!allowed.has(key)||!Number.isFinite(Number(value)))throw new Error("Некорректное изменение ресурса");const label=`${actor.name}: изменён ресурс ${key}`,event=remoteCommandEvent("command.update-runtime",command,{actorId,key,value:Number(value)});return snapshotCommandCandidate(label,event,scene=>{const target=scene.actors.find(item=>item.id===actorId),maximum={hp:9999,wounds:99,stress:stressMaximumFor(target),focus:9999,influence:999,ap:99}[key];target[key]=clamp(value,0,maximum)})}
function prepareTargetsCommand(command){const ids=Array.isArray(command.payload?.targetIds)?command.payload.targetIds:[],allowed=new Set(Scene.actors.filter(actor=>!actor.knockedOut).map(actor=>actor.id)),targetIds=ids.filter(id=>typeof id==="string"&&allowed.has(id)).slice(0,40),event=remoteCommandEvent("command.set-targets",command,{targetIds});return snapshotCommandCandidate("Нарратор принял цели игрока",event,scene=>{scene.targetIds=targetIds})}
function applyTransientTargetsCommand(command){const ids=Array.isArray(command.payload?.targetIds)?command.payload.targetIds:[],allowed=new Set(Scene.actors.filter(actor=>!actor.knockedOut).map(actor=>actor.id));Scene.targetIds=[...new Set(ids.filter(id=>typeof id==="string"&&allowed.has(id)))].slice(0,40);persist();if(store.mode==="play")renderScene();return Scene.targetIds}
function prepareUndoCommand(command){const step=Scene.undo?.[0];if(!step)throw new Error("В журнале нет обратимого действия");const before=sceneSnapshot(),event=remoteCommandEvent("command.undo",command,{stepId:step.id,label:step.label}),candidate=normalizeScene(step.state);if(window.DAWN_TABLE_POLICY?.isManual(before)){if(before.lionwing?.receipts){candidate.lionwing||={};candidate.lionwing.receipts=JSON.parse(JSON.stringify(before.lionwing.receipts));}if(before.eventReceipts)candidate.eventReceipts=JSON.parse(JSON.stringify(before.eventReceipts));}candidate.version=Number(before.version||0)+1;candidate.undo=(Scene.undo||[]).slice(1);candidate.redo=[{id:uid(),label:step.label,state:before},...(Scene.redo||[])].slice(0,20);candidate.log.unshift({id:event.id,at:event.at,text:`По запросу игрока отменено: ${step.label}`,type:event.type,actorId:null,payload:event.payload,visibility:"public"});candidate.log=candidate.log.slice(0,200);return{candidate,events:[event],label:`scene.undo:${step.label}`}}
function prepareEventCommand(command){const events=canonicalPlayerEvents(command),before=sceneSnapshot(),expectedVersion=Number(Scene.version||0),result=SceneEngine.dispatchMany(Scene,events,{expectedVersion}),candidate=normalizeScene(result.scene);candidate.undo.unshift({id:uid(),label:commandSummary(command),state:before});candidate.undo=candidate.undo.slice(0,20);return{candidate,events:result.events,label:commandSummary(command),effects:result.events}}
async function acceptPreparedRemoteCommand(command,prepared){
  if(window.DAWN_TABLE_POLICY?.isManual(Scene)){if(!Sync.state()?.canNarrate)throw new Error("Сцену изменяет Нарратор");window.DAWN_TABLE_POLICY.validateSnapshot(Scene,prepared.candidate,{history:command.command_type==="request_undo"});}
  const acceptedVersion=await Sync.acceptCommand(command.id,prepared.events,sceneCore(prepared.candidate),prepared.label);if(acceptedVersion!==Number(prepared.candidate.version))return{...prepared,reconciled:true};const fxContext=captureSceneFxContext(prepared.effects);Scene=normalizeScene(prepared.candidate);NetworkV2?.setConfirmedScene?.(Scene);syncHeroFromScene();persist();if(store.mode==="play")renderPlay();else renderScene();if(prepared.effects)playSceneEventFx(prepared.effects,fxContext);return prepared;
}

let networkV2Authority=null,networkV2Outbox=null,networkV2Reconciling=false,networkV2PlayerError="";
const pendingNetworkPlacements=new Map();
const pendingManualUiIntents=new Map();
function projectPendingManualScene(canonical){
  if(!globalThis.window?.DAWN_TABLE_POLICY?.isManual(canonical))return canonical;
  for(const [id,row] of pendingManualUiIntents){try{if(SceneEngine.eventPacketContract?.replayStatus(canonical,row.events).complete)pendingManualUiIntents.delete(id);}catch{/* A conflicting receipt will be reconciled by the command update. */}}
  const authority=[...(networkV2Authority?.retryBatch||networkV2Authority?.inFlight||[]),...(networkV2Authority?.queue||[])].filter(item=>item.kind==="events").map(item=>item.events);
  let projected=canonical;
  for(const events of [...authority,...Array.from(pendingManualUiIntents.values(),row=>row.events)]){
    if(!events?.length||events.some(event=>event.type!=="table.command"))continue;
    try{projected=SceneEngine.dispatchMany(projected,events).scene;}catch{/* The server remains responsible for accepting or rejecting the command. */}
  }
  projected.version=canonical.version;
  return projected;
}
function refreshPendingManualUi(){
  if(!Sync?.state?.().sceneId||!globalThis.window?.DAWN_TABLE_POLICY?.isManual(Scene))return;
  Scene=mergeNetworkV2Scene(NetworkV2.getConfirmedScene(Scene),Scene);
  syncHeroFromScene();
  renderScene();
  if(typeof renderManualClocks==="function")renderManualClocks();
}
function paintPendingNetworkPlacements(){
  for(const [actorId,pending] of pendingNetworkPlacements){
    const actor=Scene.actors.find(item=>item.id===actorId);
    if(!actor||actor.space!==pending.space||actor.x===pending.x&&actor.y===pending.y){pendingNetworkPlacements.delete(actorId);continue}
    if(Scene.activeSpace!==pending.space)continue;
    const token=document.querySelector(`[data-scene-actor="${CSS.escape(actorId)}"]`);
    const destination=document.querySelector(`[data-scene-cell="${pending.x},${pending.y}"] .scene-tokens`);
    if(token&&destination){destination.appendChild(token);token.classList.add("pending-network");token.setAttribute("aria-label",`${actor.name}: позиция ожидает подтверждения стола`)}
  }
}
const renderSceneBoardWithoutNetworkPreview=renderSceneBoard;
renderSceneBoard=function(){renderSceneBoardWithoutNetworkPreview();paintPendingNetworkPlacements()};
function clearPendingNetworkPlacement(row){
  let changed=false;
  for(const [id,pending] of pendingManualUiIntents)if(id===String(row?.clientIntentId||row?.client_intent_id||row?.payload?.clientIntentId)||pending.commandId&&pending.commandId===String(row?.id)){pendingManualUiIntents.delete(id);changed=true;}
  for(const [actorId,pending] of pendingNetworkPlacements)if(String(pending.intentId)===String(row?.clientIntentId||row?.client_intent_id)||String(pending.commandId)===String(row?.id)&&pending.commandId){pendingNetworkPlacements.delete(actorId);changed=true}
  if(changed&&row?.status==="rejected")networkV2PlayerError=row.result?.error||row.result?.message||"Команда отклонена";
  if(changed&&Sync?.state?.().sceneId){refreshPendingManualUi();renderSceneBoard();if(typeof renderSync==="function")renderSync();}
}
function previewNetworkPlacement(row,events,actorId){
  const move=[...events].reverse().find(event=>event.actorId===actorId&&(event.type==="actor.move"||event.type==="table.command"&&event.payload?.kind==="move"));
  const actor=move&&Scene.actors.find(item=>item.id===move.actorId),x=Number(move?.payload?.x),y=Number(move?.payload?.y),space=move?.payload?.space||actor?.space;
  if(!actor||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!Scene.spaces.some(item=>item.id===space&&x>=0&&y>=0&&x<item.width&&y<item.height))return;
  pendingNetworkPlacements.set(actor.id,{intentId:row.clientIntentId,authorityItem:row.authorityItem||null,commandId:null,x,y,space});
  paintPendingNetworkPlacements();
}
function mergeNetworkV2Scene(remote,current=Scene){
  const canonical=NetworkV2.mergeRemoteScene(remote,current),sync=Sync?.state?.(),snapshot=networkV2Authority?.latestSnapshot?.();
  if(!sync?.canNarrate||!snapshot)return NetworkV2.restoreLocalUi(projectPendingManualScene(canonical),canonical);
  const overlay=NetworkV2.rebaseSceneSnapshot(snapshot.baseScene||canonical,snapshot.scene,canonical);
  try{window.DAWN_TABLE_POLICY?.validateSnapshot(canonical,overlay,snapshot.manualSnapshotOptions||{});}catch{return canonical;}
  return NetworkV2.restoreLocalUi(projectPendingManualScene(overlay),canonical);
}
function renderNetworkScene(events=[]){
  const fxContext=captureSceneFxContext(events);
  syncHeroFromScene();store.scene=Scene;persist();
  if(store.mode==="play")renderPlay();
  else if(store.mode==="tools")renderToolsWorkspace();
  else renderScene();
  renderChallengeRequestDock();
  if(events.length)playSceneEventFx(events,fxContext);
  const requestedRoll=[...events].reverse().find(event=>event.type==="roll.public"&&event.payload?.challengeRequestId);
  if(requestedRoll&&Sync?.state?.().canNarrate){const actor=Scene.actors.find(item=>item.id===requestedRoll.actorId);toast(`Получен бросок: ${actor?.name||"герой"} · ${requestedRoll.payload.successes} Успехов`)}
}
function ensureNetworkV2Runtime(){
  if(!NetworkV2||!Sync)return null;
  if(!networkV2Outbox)networkV2Outbox=new NetworkV2.PlayerOutbox({
    onSettled:()=>{if(typeof renderSync==="function")renderSync();if(typeof refreshHeroSheetResourceControls==="function")refreshHeroSheetResourceControls();},
    send:async payload=>{const command=await Sync.submitCommand("intent_v2",payload);for(const pending of pendingNetworkPlacements.values())if(pending.intentId===payload.clientIntentId)pending.commandId=String(command.id);const pending=pendingManualUiIntents.get(String(payload.clientIntentId));if(pending)pending.commandId=String(command.id);return command},
    onError:(error,row,{retrying=true}={})=>{if(!retrying){networkV2PlayerError=friendlySyncError(error,"Команда отклонена");clearPendingNetworkPlacement(row);if(typeof rejectManualToolsRollIntent==="function")rejectManualToolsRollIntent(row);if(typeof reconcileManualAreaDraft==="function")reconcileManualAreaDraft({...row,status:"rejected"});window.DAWN_MANUAL_WORKSPACE?.reconcileNumber({...row,status:"rejected"});if(typeof reconcileManualClockNumbers==="function")reconcileManualClockNumbers({...row,status:"rejected"});}toast(retrying?`Команда ждёт отправки: ${friendlySyncError(error,"нет соединения")}`:`Команда не отправлена: ${friendlySyncError(error,"ошибка проверки")}. Проверьте действие и повторите его.`)},
  });
  if(!networkV2Authority)networkV2Authority=new NetworkV2.AuthorityQueue({
    tickMs:NetworkV2.TICK_MS,
    flush:flushNetworkV2Authority,
    onSettled:()=>{
      let changed=false;
      for(const [id,pending] of pendingNetworkPlacements)if(pending.authorityItem&&![...(networkV2Authority?.queue||[]),...(networkV2Authority?.inFlight||[]),...(networkV2Authority?.retryBatch||[])].includes(pending.authorityItem)){pendingNetworkPlacements.delete(id);changed=true;}
      if(changed)renderSceneBoard();
      refreshPendingManualUi();
      if(typeof renderSync==="function")renderSync();
    },
    onError:async(error,{retrying=true}={})=>{
      const message=friendlySyncError(error,error?.message||"неизвестная ошибка синхронизации");
      toast(retrying?`Сетевой такт не сохранён, будет повторён: ${message}`:`Сетевой такт не сохранён: ${message}. Исправьте причину и повторите действие.`);
      if(!retrying)try{await NetworkV2.withTimeout(Sync.refreshScene(),"обновления Сцены",5000)}catch(refreshError){console.warn("DAWN canonical Scene refresh after rejected tick failed",refreshError)}
      if(typeof renderSync==="function")renderSync();
      if(typeof reconcileManualToolsRoll==="function")reconcileManualToolsRoll();
    },
  });
  return{authority:networkV2Authority,outbox:networkV2Outbox};
}
function networkV2QueueStatus(){return{pending:(networkV2Authority?.pending?.()||0)+(networkV2Outbox?.pending?.()||0)+pendingManualUiIntents.size,failed:networkV2Authority?.failed?.length||0,...(networkV2PlayerError?{error:networkV2PlayerError}:{})}}
function retryNetworkV2Failed(){
  if(networkV2PlayerError){networkV2PlayerError="";if(typeof renderSync==="function")renderSync();}
  const runtime=ensureNetworkV2Runtime(),count=runtime?.authority?.retryFailed?.()||0;
  if(count){toast(`Повторяем сохранение: ${count} сетевых изменений`);if(typeof renderSync==="function")renderSync()}
  return count;
}
function resetNetworkV2Runtime(){networkV2PlayerError="";networkV2Authority?.clear();networkV2Outbox?.clear();pendingNetworkPlacements.clear();pendingManualUiIntents.clear();NetworkV2?.clearConfirmedScene?.();networkV2Authority=null;networkV2Outbox=null}
function queueNetworkV2Snapshot(scene,label,options={}){
  const runtime=ensureNetworkV2Runtime(),sync=Sync?.state?.();
  if(!runtime||!sync?.sceneId||!sync.canNarrate)return false;
  const baseScene=NetworkV2.getConfirmedScene(scene),manualSnapshotOptions={history:options.history===true,restore:options.restore===true};
  // Confirmed wire state intentionally omits local undo stacks. Carry the
  // already validated saved step with this authority intent, never as scene data.
  if(manualSnapshotOptions.history&&options.historyAnchor)manualSnapshotOptions.historyAnchor=JSON.parse(JSON.stringify(options.historyAnchor));
  window.DAWN_TABLE_POLICY?.validateSnapshot(baseScene,scene,manualSnapshotOptions);
  runtime.authority.enqueue({kind:"snapshot",baseScene,scene:NetworkV2.networkSceneState(scene),label,manualSnapshotOptions});
  return true;
}
function submitNetworkV2Events(label,events){
  const runtime=ensureNetworkV2Runtime(),sync=Sync?.state?.();
  if(!runtime||!sync?.sceneId)return null;
  const manual=window.DAWN_TABLE_POLICY?.isManual(Scene)&&events.every(event=>event.type==="table.command");
  if(manual){NetworkV2.setConfirmedScene(NetworkV2.getConfirmedScene(Scene));events=events.map(event=>({...event,id:event.id||uid()}));}
  if(sync.canNarrate){
    const item=runtime.authority.enqueue({kind:"events",events, label});
    const move=events.find(event=>event.type==="table.command"&&event.payload?.kind==="move");
    if(move)previewNetworkPlacement({authorityItem:item},events,move.actorId);
    if(manual){refreshPendingManualUi();void runtime.authority.flush();}
    return{queued:true,pending:true,authority:true,events:[]};
  }
  const intent=NetworkV2.intentFromEvents(Scene,events,label);
  networkV2PlayerError="";const row=runtime.outbox.enqueue(intent,NetworkV2.getConfirmedScene(Scene).version);
  if(manual){pendingManualUiIntents.set(String(row.clientIntentId),{events,commandId:null});refreshPendingManualUi();}
  previewNetworkPlacement(row,events,intent.actorId);
  if(manual)void runtime.outbox.flush();
  if(!pendingNetworkPlacements.has(intent.actorId))toast("Действие отправлено за общий стол");
  return{queued:true,pending:true,clientIntentId:row.clientIntentId,events:[]};
}
function submitNetworkV2Intent(intent){
  const runtime=ensureNetworkV2Runtime(),sync=Sync?.state?.();
  if(!runtime||!sync?.sceneId||sync.canNarrate)return false;
  runtime.outbox.enqueue(intent,NetworkV2.getConfirmedScene(Scene).version);
  return true;
}
function enqueueNetworkV2Command(command){
  const runtime=ensureNetworkV2Runtime(),sync=Sync?.state?.();
  if(!runtime||!sync?.canNarrate||command?.command_type!=="intent_v2")return false;
  runtime.authority.enqueue({kind:"command",command});
  return true;
}
function retainPendingNetworkV2Commands(commandIds=[]){
  const pending=new Set(commandIds.map(String));
  networkV2Authority?.discard?.(item=>item.kind==="command"&&!pending.has(String(item.command?.id)));
}
function discardNetworkV2Commands(commandIds=[]){
  const settled=new Set(commandIds.map(String));
  if(settled.size)networkV2Authority?.discard?.(item=>item.kind==="command"&&settled.has(String(item.command?.id)));
}
async function flushNetworkV2Authority(items){
  const cached=items[0]?._networkTick;
  if(cached&&cached.items.length===items.length&&cached.items.every((item,index)=>item===items[index]))return commitNetworkV2Tick(cached);
  const sync=Sync.state();
  if(!sync.sceneId||!sync.canNarrate)throw new Error("Авторитетный стол Нарратора сейчас недоступен");
  const expectedVersion=Number(sync.version||0),confirmed=NetworkV2.getConfirmedScene(Scene);
  confirmed.version=expectedVersion;
  const snapshots=items.filter(item=>item.kind==="snapshot"),latestSnapshot=snapshots.at(-1);
  if(latestSnapshot&&JSON.stringify(latestSnapshot.scene?.tablePolicy)!==JSON.stringify(confirmed.tablePolicy))throw new Error("Снимок не может менять политику стола: используйте команду Ведение.");
  let candidate=latestSnapshot?normalizeScene(NetworkV2.rebaseSceneSnapshot(latestSnapshot.baseScene||confirmed,latestSnapshot.scene,confirmed)):normalizeScene(confirmed);
  if(latestSnapshot)window.DAWN_TABLE_POLICY?.validateSnapshot(confirmed,candidate,latestSnapshot.manualSnapshotOptions||{});
  candidate.version=expectedVersion;
  const allEvents=[],commandIds=[],rejectedCommandIds=[],deferred=[];
  let localUndoState=null,undoableEventCount=0;
  if(latestSnapshot){
    const audit={id:uid(),type:"scene.snapshot",actorId:null,payload:{label:String(latestSnapshot.label||"Изменение Нарратора").slice(0,160)},at:new Date().toISOString()};
    candidate.version++;
    allEvents.push(audit);
  }
  let deferRemainder=false;
  for(const item of items.filter(item=>item.kind!=="snapshot")){
    if(deferRemainder){deferred.push(item);continue}
    try{
      const command=item.command;
      const envelope=item.kind==="command"?NetworkV2.validateIntentEnvelope(command.payload):null;
      const prepared=item.kind==="command"
        ?NetworkV2.materializeIntent(candidate,D,envelope.intent,command.actor_id,{sceneEngine:SceneEngine,techniqueEngine:TechniqueEngine,safeTechniqueEffects:safeTechniqueEffectIds})
        :item.events;
      if(!Array.isArray(prepared)||!prepared.length)throw new Error("Изменение не создало событий");
      if(prepared.length>NetworkV2.MAX_BATCH_EVENTS)throw new Error("Одно действие создало слишком много событий для безопасного сетевого такта");
      if(allEvents.length+prepared.length>NetworkV2.MAX_BATCH_EVENTS){deferRemainder=true;deferred.push(item);continue}
      const beforeItem=sceneCore(candidate),result=SceneEngine.dispatchMany(candidate,prepared,{expectedVersion:Number(candidate.version||0)});
      if(!localUndoState)localUndoState=beforeItem;
      undoableEventCount+=result.events.length;
      candidate=normalizeScene(result.scene);allEvents.push(...result.events);
      if(command)commandIds.push(String(command.id));
    }catch(error){
      if(item.command){rejectedCommandIds.push(String(item.command.id));toast(`Действие игрока отклонено: ${friendlySyncError(error,"ошибка проверки правил")}`)}
      else {if(typeof rejectManualToolsRollEvents==="function")rejectManualToolsRollEvents(item.events);window.DAWN_MANUAL_WORKSPACE?.reconcileNumber(null,item.events);if(typeof reconcileManualClockNumbers==="function")reconcileManualClockNumbers(null,item.events);toast(`Изменение Нарратора отклонено: ${error?.message||"ошибка правил"}`);}
    }
  }
  const localUndoEntry=localUndoState
    ?{id:uid(),label:`Сетевой такт · ${undoableEventCount} событий`,state:localUndoState}
    :null;
  const startsTurn=allEvents.some(event=>event.type==="turn.start"),endsRound=allEvents.some(event=>event.type==="round.end"),turnCheckpoint=startsTurn&&localUndoState?{id:uid(),label:"До начала Хода",state:localUndoState,checkpoint:"turn-start"}:null;
  if(!allEvents.length&&!rejectedCommandIds.length){if(deferred.length)networkV2Authority.defer(deferred);return}
  // The database version is derived from the number of persisted events, not
  // from any transient reducer bookkeeping in the local candidate.
  const committedVersion=expectedVersion+allEvents.length;
  candidate.version=committedVersion;
  const networkState=NetworkV2.networkSceneState(candidate);
  networkState.version=committedVersion;
  assertNetworkSceneFits(networkState);
  const tick={items:[...items],args:{commandIds,rejectedCommandIds,events:allEvents,scene:networkState,expectedVersion,label:"network.v2.tick"},candidate,allEvents,commandIds,rejectedCommandIds,deferred,localUndoEntry,turnCheckpoint,endsRound};
  for(const item of items)item._networkTick=tick;
  return commitNetworkV2Tick(tick);
}
async function commitNetworkV2Tick(tick){
  const {items,args,candidate,allEvents,commandIds,rejectedCommandIds,deferred,localUndoEntry,turnCheckpoint,endsRound}=tick;
  let acceptedVersion;
  tick.attempts=(tick.attempts||0)+1;
  networkV2Reconciling=true;
  try{acceptedVersion=await Sync.settleIntentBatch(args)}
  catch(error){if(NetworkV2.isSceneVersionConflict(error)){for(const item of items)delete item._networkTick;retainPendingNetworkV2Commands(pendingSceneCommands.map(command=>command.id))}throw error}
  finally{networkV2Reconciling=false}
  if(tick.attempts>1){
    // A lost reply may have hidden later canonical ticks. Read the server
    // snapshot even when its exact receipt reports our original version.
    networkV2Reconciling=true;
    try{await Sync.refreshScene()}finally{networkV2Reconciling=false}
    for(const item of items)delete item._networkTick;
    globalThis.dispatchEvent(new CustomEvent("dawn-network-v2-settled",{detail:{commandIds,rejectedCommandIds,version:acceptedVersion}}));
    if(deferred.length)networkV2Authority.defer(deferred);
    return;
  }
  for(const item of items)delete item._networkTick;
  if(acceptedVersion!==Number(candidate.version)||Number(Sync.state().version)>acceptedVersion){
    networkV2Reconciling=true;
    try{await Sync.refreshScene()}finally{networkV2Reconciling=false}
    if(deferred.length)networkV2Authority.defer(deferred);
    return;
  }
  Scene=mergeNetworkV2Scene(candidate,Scene);
  if(endsRound)Scene.turnUndo=[];
  if(turnCheckpoint)Scene.turnUndo=[turnCheckpoint,...(Scene.turnUndo||[])].slice(0,120);
  // Undo/redo are Narrator-local UI state and are deliberately stripped from
  // the canonical network snapshot. Add the accepted player tick only after
  // restoring that local state, otherwise mergeRemoteScene discards it.
  if(localUndoEntry){
    Scene.undo=trimSceneHistory([localUndoEntry,...(Scene.undo||[])]);
    Scene.redo=[];
  }
  renderNetworkScene(allEvents);
  globalThis.dispatchEvent(new CustomEvent("dawn-network-v2-settled",{detail:{commandIds,rejectedCommandIds,version:acceptedVersion}}));
  if(deferred.length)networkV2Authority.defer(deferred);
}
