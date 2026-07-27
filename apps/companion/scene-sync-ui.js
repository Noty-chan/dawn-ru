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
    if(actor?.ownerId&&actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет исполнителем действия");
    const result=SceneEngine.prepareAction(Scene,D,{actorId:prepared.actorId,actionId:prepared.payload?.actionId,targetIds:prepared.payload?.targetIds||[],destination:move?{x:Number(move.payload?.x),y:Number(move.payload?.y)}:undefined,roll});
    if(!result.ok)throw new Error(result.errors.join(" "));
    return result.events;
  }
  const reaction=raw.find(event=>event.type==="reaction.respond");
  if(reaction){
    const actor=Scene.actors.find(item=>item.id===reaction.actorId),move=raw.find(event=>event.type==="actor.move"&&event.actorId===reaction.actorId);
    if(actor?.ownerId&&actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет отвечающим персонажем");
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
async function acceptRemoteHero(command){
  const characterId=command.payload?.characterId;if(typeof characterId!=="string")throw new Error("В команде нет ссылки на лист героя");
  const record=await Sync.loadCharacter(characterId);if(record.owner_id!==command.actor_id)throw new Error("Лист не принадлежит отправившему его игроку");
  const hero=normalizeHero(record.state),existing=Scene.actors.find(actor=>actor.characterId===record.id||actor.ownerId===record.owner_id),position=existing?{x:existing.x,y:existing.y}:firstEmptyCell(Scene.activeSpace);
  commitScene(`${existing?"Обновлён":"Добавлен"} герой игрока «${hero.name||record.name}»`,scene=>{const actor=heroActorState(hero,{...(existing||{}),id:existing?.id||uid(),ownerId:record.owner_id,characterId:record.id,space:existing?.space||scene.activeSpace,...position,armor:existing?.armor||0,evasion:existing?.evasion||0});if(existing)Object.assign(existing,actor);else scene.actors.push(actor);scene.activeSpace=actor.space;scene.selectedActor=actor.id});
}
function acceptRuntimeCommand(command){const {actorId,key,value}=command.payload||{},actor=Scene.actors.find(item=>item.id===actorId),allowed=new Set(["hp","wounds","focus","influence","ap"]);if(!actor||actor.ownerId!==command.actor_id)throw new Error("Игрок не владеет этим героем");if(!allowed.has(key)||!Number.isFinite(Number(value)))throw new Error("Некорректное изменение ресурса");commitScene(`${actor.name}: изменён ресурс ${key}`,()=>{actor[key]=key==="focus"?Math.max(0,Number(value)):clamp(value,0,key==="hp"?9999:key==="wounds"?99:999)})}
