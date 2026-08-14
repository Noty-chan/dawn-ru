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
      :SceneEngine.respondRulePrompt(Scene,D,{choice:ruleResponse.payload?.choice,roll:raw.find(event=>event.type==="roll.public")?.payload||raw.find(event=>event.type==="attack.pending")?.payload?.roll||null});
    if(!result.ok)throw new Error(result.errors.join(" "));
    return result.events;
  }
  const prepared=raw.find(event=>event.type==="action.prepare");
  if(prepared){
    const actor=Scene.actors.find(item=>item.id===prepared.actorId),move=raw.find(event=>event.type==="actor.move"&&event.actorId===prepared.actorId),pending=raw.find(event=>event.type==="attack.pending"),roll=raw.find(event=>event.type==="roll.public")?.payload||pending?.payload?.roll||null,request=prepared.payload?.request||{};
    if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет исполнителем действия");
    const destination=move?{x:Number(move.payload?.x),y:Number(move.payload?.y)}:undefined,result=SceneEngine.prepareAction(Scene,D,{actorId:prepared.actorId,actionId:prepared.payload?.actionId,targetIds:prepared.payload?.targetIds||[],destination,armamentMode:request.armamentMode||null,armamentDestination:request.armamentMode==="blade"?(request.armamentDestination||destination):null,roll,attribute:request.attribute||roll?.attribute||null,useCunningPlan:Boolean(request.useCunningPlan),useRevelation:Boolean(request.useRevelation),useThunderDischarge:Boolean(request.useThunderDischarge),useEclipseStars:Boolean(request.useEclipseStars),useGrasp:Boolean(request.useGrasp),startRage:Boolean(request.startRage),bulletsSpent:request.bulletsSpent,bulletAdvantage:request.bulletAdvantage,throwWeapon:Boolean(request.throwWeapon),overload:Boolean(request.overload),provokeTargetIds:Array.isArray(request.provokeTargetIds)?request.provokeTargetIds:[],removeEffectIdsByTarget:request.removeEffectIdsByTarget&&typeof request.removeEffectIdsByTarget==="object"?request.removeEffectIdsByTarget:{},attackModifierIds:Array.isArray(request.attackModifierIds)?request.attackModifierIds:[]});
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
  const before=sceneSnapshot(),candidate=normalizeScene(before);mutator(candidate);candidate.version=Number(before.version||0)+1;candidate.undo.unshift({id:uid(),label,state:before});candidate.undo=candidate.undo.slice(0,20);candidate.log.unshift({id:event.id,at:event.at,text:label,type:event.type,actorId:null,payload:event.payload,visibility:"public"});candidate.log=candidate.log.slice(0,200);return{candidate,events:[event],label};
}
async function prepareRemoteHeroCommand(command){
  const characterId=command.payload?.characterId;if(typeof characterId!=="string")throw new Error("В команде нет ссылки на лист героя");
  const record=await Sync.loadCharacter(characterId);if(record.owner_id!==command.actor_id)throw new Error("Лист не принадлежит отправившему его игроку");
  const hero=normalizeHero(record.state),existing=Scene.actors.find(actor=>actor.characterId===record.id||actor.ownerId===record.owner_id),position=existing?{x:existing.x,y:existing.y}:firstEmptyCell(Scene.activeSpace);
  const label=`${existing?"Обновлён":"Добавлен"} герой игрока «${hero.name||record.name}»`,event=remoteCommandEvent("command.join-hero",command,{characterId:record.id,heroId:hero.id,name:hero.name||record.name});
  return snapshotCommandCandidate(label,event,scene=>{const current=scene.actors.find(actor=>actor.characterId===record.id||actor.ownerId===record.owner_id),base={...(current||{})};if(!sceneCombatStarted(scene)){delete base.focus;delete base.hp;delete base.maxHp}const actor=heroActorState(hero,{...base,id:current?.id||uid(),ownerId:record.owner_id,characterId:record.id,space:current?.space||scene.activeSpace,...position,armor:current?.armor||0,evasion:current?.evasion||0});if(current)Object.assign(current,actor);else scene.actors.push(actor);scene.activeSpace=actor.space;scene.selectedActor=actor.id});
}
function prepareRuntimeCommand(command){const {actorId,key,value}=command.payload||{},actor=Scene.actors.find(item=>item.id===actorId),allowed=new Set(["hp","wounds","stress","focus","influence","ap"]);if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет этим героем");if(!allowed.has(key)||!Number.isFinite(Number(value)))throw new Error("Некорректное изменение ресурса");const label=`${actor.name}: изменён ресурс ${key}`,event=remoteCommandEvent("command.update-runtime",command,{actorId,key,value:Number(value)});return snapshotCommandCandidate(label,event,scene=>{const target=scene.actors.find(item=>item.id===actorId),maximum={hp:9999,wounds:99,stress:3,focus:9999,influence:999,ap:99}[key];target[key]=clamp(value,0,maximum)})}
function prepareTargetsCommand(command){const ids=Array.isArray(command.payload?.targetIds)?command.payload.targetIds:[],allowed=new Set(Scene.actors.filter(actor=>!actor.knockedOut).map(actor=>actor.id)),targetIds=ids.filter(id=>typeof id==="string"&&allowed.has(id)).slice(0,40),event=remoteCommandEvent("command.set-targets",command,{targetIds});return snapshotCommandCandidate("Нарратор принял цели игрока",event,scene=>{scene.targetIds=targetIds})}
function applyTransientTargetsCommand(command){const ids=Array.isArray(command.payload?.targetIds)?command.payload.targetIds:[],allowed=new Set(Scene.actors.filter(actor=>!actor.knockedOut).map(actor=>actor.id));Scene.targetIds=[...new Set(ids.filter(id=>typeof id==="string"&&allowed.has(id)))].slice(0,40);persist();if(store.mode==="play")renderScene();return Scene.targetIds}
function prepareUndoCommand(command){const step=Scene.undo?.[0];if(!step)throw new Error("В журнале нет обратимого действия");const before=sceneSnapshot(),event=remoteCommandEvent("command.undo",command,{stepId:step.id,label:step.label}),candidate=normalizeScene(step.state);candidate.version=Number(before.version||0)+1;candidate.undo=(Scene.undo||[]).slice(1);candidate.log.unshift({id:event.id,at:event.at,text:`По запросу игрока отменено: ${step.label}`,type:event.type,actorId:null,payload:event.payload,visibility:"public"});candidate.log=candidate.log.slice(0,200);return{candidate,events:[event],label:`scene.undo:${step.label}`}}
function prepareEventCommand(command){const events=canonicalPlayerEvents(command),before=sceneSnapshot(),expectedVersion=Number(Scene.version||0),result=SceneEngine.dispatchMany(Scene,events,{expectedVersion}),candidate=normalizeScene(result.scene);candidate.undo.unshift({id:uid(),label:commandSummary(command),state:before});candidate.undo=candidate.undo.slice(0,20);return{candidate,events:result.events,label:commandSummary(command),effects:result.events}}
async function acceptPreparedRemoteCommand(command,prepared){
  const acceptedVersion=await Sync.acceptCommand(command.id,prepared.events,sceneCore(prepared.candidate),prepared.label);if(acceptedVersion!==Number(prepared.candidate.version))return{...prepared,reconciled:true};Scene=normalizeScene(prepared.candidate);NetworkV2?.setConfirmedScene?.(Scene);syncHeroFromScene();persist();if(store.mode==="play")renderPlay();else renderScene();if(prepared.effects)playSceneEventFx(prepared.effects);return prepared;
}

let networkV2Authority=null,networkV2Outbox=null,networkV2Reconciling=false;
function mergeNetworkV2Scene(remote,current=Scene){
  const canonical=NetworkV2.mergeRemoteScene(remote,current),sync=Sync?.state?.(),snapshot=networkV2Reconciling?networkV2Authority?.latestQueuedSnapshot?.():networkV2Authority?.latestSnapshot?.();
  if(!sync?.canNarrate||!snapshot)return canonical;
  const overlay=NetworkV2.rebaseSceneSnapshot(snapshot.baseScene||canonical,snapshot.scene,canonical);
  return NetworkV2.restoreLocalUi(overlay,canonical);
}
function renderNetworkScene(events=[]){
  syncHeroFromScene();store.scene=Scene;persist();
  if(store.mode==="play")renderPlay();
  else if(store.mode==="tools")renderToolsWorkspace();
  else renderScene();
  renderChallengeRequestDock();
  if(events.length)playSceneEventFx(events);
  const requestedRoll=[...events].reverse().find(event=>event.type==="roll.public"&&event.payload?.challengeRequestId);
  if(requestedRoll&&Sync?.state?.().canNarrate){const actor=Scene.actors.find(item=>item.id===requestedRoll.actorId);toast(`Получен бросок: ${actor?.name||"герой"} · ${requestedRoll.payload.successes} Успехов`)}
}
function ensureNetworkV2Runtime(){
  if(!NetworkV2||!Sync)return null;
  if(!networkV2Outbox)networkV2Outbox=new NetworkV2.PlayerOutbox({
    send:payload=>Sync.submitCommand("intent_v2",payload),
    onError:error=>toast(`Команда ждёт отправки: ${friendlySyncError(error,"нет соединения")}`),
  });
  if(!networkV2Authority)networkV2Authority=new NetworkV2.AuthorityQueue({
    tickMs:NetworkV2.TICK_MS,
    flush:flushNetworkV2Authority,
    onError:error=>toast(friendlySyncError(error,"Сетевой такт будет повторён")),
  });
  return{authority:networkV2Authority,outbox:networkV2Outbox};
}
function resetNetworkV2Runtime(){networkV2Authority?.clear();networkV2Outbox?.clear();NetworkV2?.clearConfirmedScene?.();networkV2Authority=null;networkV2Outbox=null}
function queueNetworkV2Snapshot(scene,label){
  const runtime=ensureNetworkV2Runtime(),sync=Sync?.state?.();
  if(!runtime||!sync?.sceneId||!sync.canNarrate)return false;
  runtime.authority.enqueue({kind:"snapshot",baseScene:NetworkV2.getConfirmedScene(scene),scene:NetworkV2.networkSceneState(scene),label});
  return true;
}
function submitNetworkV2Events(label,events){
  const runtime=ensureNetworkV2Runtime(),sync=Sync?.state?.();
  if(!runtime||!sync?.sceneId)return null;
  if(sync.canNarrate){
    runtime.authority.enqueue({kind:"events",events, label});
    return{queued:true,pending:true,authority:true,events:[]};
  }
  const intent=NetworkV2.intentFromEvents(Scene,events,label);
  runtime.outbox.enqueue(intent,NetworkV2.getConfirmedScene(Scene).version);
  toast("Действие отправлено за общий стол");
  return{queued:true,pending:true,events:[]};
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
  const sync=Sync.state();
  if(!sync.sceneId||!sync.canNarrate)throw new Error("Авторитетный стол Нарратора сейчас недоступен");
  const expectedVersion=Number(sync.version||0),confirmed=NetworkV2.getConfirmedScene(Scene);
  confirmed.version=expectedVersion;
  const snapshots=items.filter(item=>item.kind==="snapshot"),latestSnapshot=snapshots.at(-1);
  let candidate=latestSnapshot?normalizeScene(NetworkV2.rebaseSceneSnapshot(latestSnapshot.baseScene||confirmed,latestSnapshot.scene,confirmed)):normalizeScene(confirmed);
  candidate.version=expectedVersion;
  const allEvents=[],commandIds=[],rejectedCommandIds=[],deferred=[];
  let localUndoState=null,undoableEventCount=0;
  if(latestSnapshot){
    const audit={id:uid(),type:"scene.snapshot",actorId:null,payload:{label:String(latestSnapshot.label||"Изменение Нарратора").slice(0,160)},at:new Date().toISOString()};
    candidate.version++;
    allEvents.push(audit);
  }
  for(const item of items.filter(item=>item.kind!=="snapshot")){
    try{
      const command=item.command;
      const envelope=item.kind==="command"?NetworkV2.validateIntentEnvelope(command.payload):null;
      const prepared=item.kind==="command"
        ?NetworkV2.materializeIntent(candidate,D,envelope.intent,command.actor_id,{sceneEngine:SceneEngine,techniqueEngine:TechniqueEngine,safeTechniqueEffects:safeTechniqueEffectIds})
        :item.events;
      if(!Array.isArray(prepared)||!prepared.length)throw new Error("Изменение не создало событий");
      if(prepared.length>NetworkV2.MAX_BATCH_EVENTS)throw new Error("Одно действие создало слишком много событий для безопасного сетевого такта");
      if(allEvents.length+prepared.length>NetworkV2.MAX_BATCH_EVENTS){deferred.push(item);continue}
      const beforeItem=sceneCore(candidate),result=SceneEngine.dispatchMany(candidate,prepared,{expectedVersion:Number(candidate.version||0)});
      if(!localUndoState)localUndoState=beforeItem;
      undoableEventCount+=result.events.length;
      candidate=normalizeScene(result.scene);allEvents.push(...result.events);
      if(command)commandIds.push(String(command.id));
    }catch(error){
      if(item.command){rejectedCommandIds.push(String(item.command.id));toast(`Действие игрока отклонено: ${friendlySyncError(error,"ошибка проверки правил")}`)}
      else toast(`Изменение Нарратора отклонено: ${error?.message||"ошибка правил"}`);
    }
  }
  const localUndoEntry=localUndoState
    ?{id:uid(),label:`Сетевой такт · ${undoableEventCount} событий`,state:localUndoState,...(allEvents.some(event=>event.type==="turn.start")?{checkpoint:"turn-start"}:{})}
    :null;
  if(!allEvents.length&&!rejectedCommandIds.length){deferred.forEach(item=>networkV2Authority.enqueue(item));return}
  const networkState=NetworkV2.networkSceneState(candidate);
  const acceptedVersion=await Sync.settleIntentBatch({commandIds,rejectedCommandIds,events:allEvents,scene:networkState,expectedVersion,label:"network.v2.tick"});
  if(acceptedVersion!==Number(candidate.version)){
    networkV2Reconciling=true;
    try{await Sync.refreshScene()}finally{networkV2Reconciling=false}
    deferred.forEach(item=>networkV2Authority.enqueue(item));
    return;
  }
  Scene=mergeNetworkV2Scene(candidate,Scene);
  // Undo/redo are Narrator-local UI state and are deliberately stripped from
  // the canonical network snapshot. Add the accepted player tick only after
  // restoring that local state, otherwise mergeRemoteScene discards it.
  if(localUndoEntry){
    Scene.undo=trimSceneHistory([localUndoEntry,...(Scene.undo||[])]);
    Scene.redo=[];
  }
  renderNetworkScene(allEvents);
  globalThis.dispatchEvent(new CustomEvent("dawn-network-v2-settled",{detail:{commandIds,rejectedCommandIds,version:acceptedVersion}}));
  deferred.forEach(item=>networkV2Authority.enqueue(item));
}
