"use strict";

function commandSummary(command){
  if(command.command_type==="set_targets")return "Предложены цели";
  if(command.command_type==="request_undo")return "Запрошен откат";
  if(command.command_type==="join_hero")return "Герой готов войти в Сцену";
  if(command.command_type==="update_runtime")return "Изменение ресурса героя";
  if(command.command_type!=="dispatch_events")return command.command_type;
  const events=Array.isArray(command.payload?.events)?command.payload.events:[],prepared=events.find(event=>event.type==="action.prepare"),reaction=events.find(event=>event.type==="reaction.respond"),actor=Scene.actors.find(item=>item.id===(prepared?.actorId||reaction?.actorId));
  if(prepared)return `${actor?.name||"Игрок"}: ${prepared.payload?.name||"действие"}`;
  if(reaction)return `${actor?.name||"Игрок"}: Реакция — ${reaction.payload?.choice||"ответ"}`;
  return "Пакет событий игрока";
}
function canonicalPlayerEvents(command){
  const raw=Array.isArray(command.payload?.events)?command.payload.events:[];
  if(!raw.length||raw.length>16)throw new Error("Команда содержит некорректный пакет событий");
  const prepared=raw.find(event=>event.type==="action.prepare");
  if(prepared){
    const actor=Scene.actors.find(item=>item.id===prepared.actorId),move=raw.find(event=>event.type==="actor.move"&&event.actorId===prepared.actorId),pending=raw.find(event=>event.type==="attack.pending"),roll=raw.find(event=>event.type==="roll.public")?.payload||pending?.payload?.roll||null;
    if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет исполнителем действия");
    const result=SceneEngine.prepareAction(Scene,D,{actorId:prepared.actorId,actionId:prepared.payload?.actionId,targetIds:prepared.payload?.targetIds||[],destination:move?{x:Number(move.payload?.x),y:Number(move.payload?.y)}:undefined,roll});
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
  throw new Error("Этот пакет нельзя безопасно восстановить как действие или Реакцию");
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
  return snapshotCommandCandidate(label,event,scene=>{const current=scene.actors.find(actor=>actor.characterId===record.id||actor.ownerId===record.owner_id),base={...(current||{})};if(!sceneCombatStarted(scene))delete base.focus;const actor=heroActorState(hero,{...base,id:current?.id||uid(),ownerId:record.owner_id,characterId:record.id,space:current?.space||scene.activeSpace,...position,armor:current?.armor||0,evasion:current?.evasion||0});if(current)Object.assign(current,actor);else scene.actors.push(actor);scene.activeSpace=actor.space;scene.selectedActor=actor.id});
}
function prepareRuntimeCommand(command){const {actorId,key,value}=command.payload||{},actor=Scene.actors.find(item=>item.id===actorId),allowed=new Set(["hp","wounds","focus","influence","ap"]);if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет этим героем");if(!allowed.has(key)||!Number.isFinite(Number(value)))throw new Error("Некорректное изменение ресурса");const label=`${actor.name}: изменён ресурс ${key}`,event=remoteCommandEvent("command.update-runtime",command,{actorId,key,value:Number(value)});return snapshotCommandCandidate(label,event,scene=>{const target=scene.actors.find(item=>item.id===actorId);target[key]=key==="focus"?Math.max(0,Number(value)):clamp(value,0,key==="hp"?9999:key==="wounds"?99:999)})}
function prepareTargetsCommand(command){const ids=Array.isArray(command.payload?.targetIds)?command.payload.targetIds:[],allowed=new Set(Scene.actors.filter(actor=>!actor.knockedOut).map(actor=>actor.id)),targetIds=ids.filter(id=>typeof id==="string"&&allowed.has(id)).slice(0,40),event=remoteCommandEvent("command.set-targets",command,{targetIds});return snapshotCommandCandidate("Нарратор принял цели игрока",event,scene=>{scene.targetIds=targetIds})}
function prepareUndoCommand(command){const step=Scene.undo?.[0];if(!step)throw new Error("В журнале нет обратимого действия");const before=sceneSnapshot(),event=remoteCommandEvent("command.undo",command,{stepId:step.id,label:step.label}),candidate=normalizeScene(step.state);candidate.version=Number(before.version||0)+1;candidate.undo=(Scene.undo||[]).slice(1);candidate.log.unshift({id:event.id,at:event.at,text:`По запросу игрока отменено: ${step.label}`,type:event.type,actorId:null,payload:event.payload,visibility:"public"});candidate.log=candidate.log.slice(0,200);return{candidate,events:[event],label:`scene.undo:${step.label}`}}
function prepareEventCommand(command){const events=canonicalPlayerEvents(command),before=sceneSnapshot(),expectedVersion=Number(Scene.version||0),result=SceneEngine.dispatchMany(Scene,events,{expectedVersion}),candidate=normalizeScene(result.scene);candidate.undo.unshift({id:uid(),label:commandSummary(command),state:before});candidate.undo=candidate.undo.slice(0,20);return{candidate,events:result.events,label:commandSummary(command),effects:result.events}}
async function acceptPreparedRemoteCommand(command,prepared){
  const acceptedVersion=await Sync.acceptCommand(command.id,prepared.events,sceneCore(prepared.candidate),prepared.label);if(acceptedVersion!==Number(prepared.candidate.version))return{...prepared,reconciled:true};Scene=normalizeScene(prepared.candidate);syncHeroFromScene();persist();if(store.mode==="play")renderPlay();else renderScene();if(prepared.effects)playSceneEventFx(prepared.effects);return prepared;
}
