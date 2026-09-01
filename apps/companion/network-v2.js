"use strict";

(function exposeDawnNetworkV2(global){
  const PROTOCOL=2;
  const TICK_MS=200;
  const MAX_BATCH_EVENTS=192;
  const MAX_AUTHORITY_ITEMS=200;
  const MAX_OUTBOX_ITEMS=40;
  const LOCAL_UI_KEYS=["view","tool","activeSpace","selectedActor","targetIds","targetCells","undo","redo","turnUndo"];
  const AUTOMATIC_COMMANDS=new Set(["intent_v2","dispatch_events","join_hero","update_runtime","set_targets"]);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const makeId=()=>{
    if(global.crypto?.randomUUID)return global.crypto.randomUUID();
    const bytes=new Uint8Array(16);
    if(global.crypto?.getRandomValues)global.crypto.getRandomValues(bytes);
    else for(let index=0;index<bytes.length;index++)bytes[index]=Math.floor(Math.random()*256);
    bytes[6]=bytes[6]&15|64;
    bytes[8]=bytes[8]&63|128;
    const hex=[...bytes].map(value=>value.toString(16).padStart(2,"0")).join("");
    return`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const safeIds=value=>Array.isArray(value)?value.filter(id=>typeof id==="string").slice(0,40):[];
  const safeCells=value=>Array.isArray(value)?[...new Set(value.filter(cell=>typeof cell==="string"&&/^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/.test(cell)))].slice(0,40):[];
  const safeObject=value=>value&&typeof value==="object"&&!Array.isArray(value)?clone(value):{};
  let confirmedScene=null;

  function captureLocalUi(scene){
    const ui={};
    for(const key of LOCAL_UI_KEYS)ui[key]=clone(scene?.[key]);
    return ui;
  }

  function networkSceneState(scene){
    const state=typeof global.normalizeScene==="function"?global.normalizeScene(scene):typeof global.sceneCore==="function"?global.sceneCore(scene):clone(scene||{});
    state.view="gm";
    state.tool="select";
    state.activeSpace=state.spaces?.[0]?.id||"main";
    state.selectedActor=null;
    state.targetIds=[];
    state.targetCells=[];
    delete state.undo;
    delete state.redo;
    delete state.turnUndo;
    return state;
  }

  function restoreLocalUi(remote,current){
    const ui=captureLocalUi(current||{});
    const scene=typeof global.normalizeScene==="function"?global.normalizeScene(remote):clone(remote||{});
    const spaceIds=new Set((scene.spaces||[]).map(space=>space.id));
    const actorIds=new Set((scene.actors||[]).map(actor=>actor.id));
    scene.view=ui.view==="player"?"player":"gm";
    scene.tool=typeof ui.tool==="string"?ui.tool:scene.tool;
    scene.activeSpace=spaceIds.has(ui.activeSpace)?ui.activeSpace:(scene.spaces?.[0]?.id||"main");
    scene.selectedActor=actorIds.has(ui.selectedActor)?ui.selectedActor:null;
    scene.targetIds=safeIds(ui.targetIds).filter(id=>actorIds.has(id));
    scene.targetCells=safeCells(ui.targetCells);
    scene.undo=Array.isArray(ui.undo)?ui.undo.slice(0,20):[];
    scene.redo=Array.isArray(ui.redo)?ui.redo.slice(0,20):[];
    scene.turnUndo=Array.isArray(ui.turnUndo)?ui.turnUndo.slice(0,120):[];
    return scene;
  }

  function mergeRemoteScene(remote,current){
    const scene=restoreLocalUi(remote,current);
    confirmedScene=networkSceneState(scene);
    return scene;
  }

  function setConfirmedScene(scene){
    confirmedScene=networkSceneState(scene);
    return clone(confirmedScene);
  }

  function getConfirmedScene(fallback){
    return clone(confirmedScene||networkSceneState(fallback));
  }

  function clearConfirmedScene(){confirmedScene=null}

  const sameValue=(left,right)=>{
    if(left===right)return true;
    try{return JSON.stringify(left)===JSON.stringify(right)}catch{return false}
  };
  const plainObject=value=>Boolean(value&&typeof value==="object"&&!Array.isArray(value));
  const identifiedArray=value=>Array.isArray(value)&&value.length>0&&value.every(item=>plainObject(item)&&typeof item.id==="string");
  function rebaseValue(base,desired,current,depth=0){
    if(sameValue(desired,base))return clone(current);
    if(depth>16)return clone(desired);
    if(Array.isArray(desired)&&Array.isArray(base)&&Array.isArray(current)){
      if(identifiedArray([...base,...desired,...current])){
        const baseById=new Map(base.map(item=>[item.id,item])),desiredById=new Map(desired.map(item=>[item.id,item])),currentById=new Map(current.map(item=>[item.id,item])),result=[];
        for(const item of desired){
          const previous=baseById.get(item.id),canonical=currentById.get(item.id);
          if(!canonical&&previous&&sameValue(item,previous))continue;
          result.push(previous&&canonical?rebaseValue(previous,item,canonical,depth+1):clone(item));
        }
        for(const item of current)if(!desiredById.has(item.id)&&!baseById.has(item.id))result.push(clone(item));
        return result;
      }
      return clone(desired);
    }
    if(plainObject(desired)&&plainObject(base)&&plainObject(current)){
      const result=clone(current);
      for(const key of new Set([...Object.keys(base),...Object.keys(desired)])){
        if(!Object.hasOwn(desired,key)){delete result[key];continue}
        if(!Object.hasOwn(base,key)){result[key]=clone(desired[key]);continue}
        result[key]=rebaseValue(base[key],desired[key],current[key],depth+1);
      }
      return result;
    }
    return clone(desired);
  }
  function rebaseSceneSnapshot(base,desired,current){
    return networkSceneState(rebaseValue(networkSceneState(base),networkSceneState(desired),networkSceneState(current)));
  }

  function validateIntentEnvelope(payload){
    if(Number(payload?.protocol)!==PROTOCOL)throw new Error("Версия сетевого протокола не поддерживается");
    if(!UUID.test(String(payload?.clientIntentId||"")))throw new Error("У сетевой команды нет корректного id");
    const baseVersion=Number(payload?.baseVersion);
    if(!Number.isSafeInteger(baseVersion)||baseVersion<0)throw new Error("Некорректная базовая версия Сцены");
    if(!payload?.intent||typeof payload.intent!=="object"||Array.isArray(payload.intent))throw new Error("Пустое намерение игрока");
    return{protocol:PROTOCOL,clientIntentId:String(payload.clientIntentId),baseVersion,intent:clone(payload.intent)};
  }

  function actionOptions(request={}){
    const armamentMode=["blade","polearm","chain"].includes(request.armamentMode)?request.armamentMode:null;
    const armamentDestination=request.armamentDestination&&Number.isFinite(Number(request.armamentDestination.x))&&Number.isFinite(Number(request.armamentDestination.y))?{x:Number(request.armamentDestination.x),y:Number(request.armamentDestination.y)}:null;
    return {
      attribute:typeof request.attribute==="string"?request.attribute:null,
      useCunningPlan:Boolean(request.useCunningPlan),
      useRevelation:Boolean(request.useRevelation),
      useThunderDischarge:Boolean(request.useThunderDischarge),
      useEclipseStars:Boolean(request.useEclipseStars),
      useGrasp:Boolean(request.useGrasp),
      startRage:Boolean(request.startRage),
      bulletsSpent:Number.isFinite(Number(request.bulletsSpent))?Number(request.bulletsSpent):undefined,
      bulletAdvantage:Number.isFinite(Number(request.bulletAdvantage))?Number(request.bulletAdvantage):undefined,
      throwWeapon:Boolean(request.throwWeapon),
      overload:Boolean(request.overload),
      provokeTargetIds:safeIds(request.provokeTargetIds),
      removeEffectIdsByTarget:safeObject(request.removeEffectIdsByTarget),
      attackModifierIds:safeIds(request.attackModifierIds),
      armamentMode,
      armamentDestination,
    };
  }

  function intentFromEvents(scene,events,label="Действие игрока"){
    const raw=Array.isArray(events)?events:[];
    if(!raw.length||raw.length>192)throw new Error("Некорректный пакет событий");
    const deploymentMove=raw.find(event=>event.type==="actor.move"&&event.payload?.placement&&event.payload?.movement==="Развертывание");
    if(deploymentMove)return{kind:"deployment",label:String(label).slice(0,160),actorId:deploymentMove.actorId,destination:{space:String(deploymentMove.payload.space||""),x:Number(deploymentMove.payload.x),y:Number(deploymentMove.payload.y)}};
    const invisibleRemove=raw.find(event=>event.type==="effect.remove"&&event.payload?.effect==="positive.невидим");
    const invisibleApply=raw.find(event=>event.type==="effect.apply"&&event.payload?.effect==="positive.исчез");
    if(invisibleRemove&&invisibleApply&&invisibleRemove.actorId===invisibleApply.actorId)return{kind:"invisible-disappear",label:String(label).slice(0,160),actorId:invisibleRemove.actorId};
    const meal=raw.length===1&&["resource.gain","resource.spend"].includes(raw[0].type)&&raw[0].payload?.resource==="meals"?raw[0]:null;
    if(meal)return{kind:"meal",label:String(label).slice(0,160),actorId:meal.actorId,delta:meal.type==="resource.gain"?1:-1};
    const modifiers=raw.length===1&&raw[0].type==="technique.state"&&raw[0].payload?.key==="spellModifiers"?raw[0]:null;
    if(modifiers)return{kind:"spell-modifiers",label:String(label).slice(0,160),actorId:modifiers.actorId,value:safeIds(modifiers.payload?.value)};
    const wound=raw.length===1&&raw[0].type==="damage.apply"&&raw[0].payload?.targetId?raw[0]:null;
    if(wound)return{kind:"take-wound",label:String(label).slice(0,160),actorId:wound.payload.targetId,external:!wound.actorId};
    const turnStart=raw.length===1&&raw[0].type==="turn.start"?raw[0]:null;
    if(turnStart)return{kind:"turn-start",label:String(label).slice(0,160),actorId:turnStart.actorId};
    const turnEnd=raw.length===1&&raw[0].type==="turn.end"?raw[0]:null;
    if(turnEnd)return{kind:"turn-end",label:String(label).slice(0,160),actorId:turnEnd.actorId};
    const planStart=raw.find(event=>event.type==="action.plan");
    if(planStart)return{kind:"action-plan-start",label:String(label).slice(0,160),actorId:planStart.actorId,actionId:planStart.payload?.actionId,phase:planStart.payload?.phase,context:safeObject(planStart.payload?.context)};
    const planCancel=raw.find(event=>event.type==="action.plan.cancel");
    if(planCancel)return{kind:"action-plan-cancel",label:String(label).slice(0,160),actorId:planCancel.actorId,planId:planCancel.payload?.planId,reason:String(planCancel.payload?.reason||"Отменено до оплаты.").slice(0,240)};
    const planUpdate=raw.find(event=>event.type==="action.plan.update");
    if(planUpdate){
      const context=safeObject(planUpdate.payload?.context);
      const destination=context.reappearance||context.modifierDestination||null;
      return{kind:context.reappearance&&scene?.pendingActionPlan?.phase==="reappear"?"action-plan-reappearance":"action-plan-modifier",label:String(label).slice(0,160),actorId:planUpdate.actorId,planId:planUpdate.payload?.planId,destination:clone(destination)};
    }
    // A rule response may legitimately open an Attack in the same atomic batch
    // (for example Punishment). Classify the answer before its derived action.
    const response=raw.find(event=>event.type==="rule.respond");
    if(response){
      const move=raw.find(event=>event.type==="marker.move")||raw.find(event=>event.type==="actor.move");
      return {kind:"rule-response",label:String(label).slice(0,160),actorId:response.actorId,promptId:response.payload?.promptId,choice:response.payload?.choice,destination:clone(response.payload?.destination||move?.payload||null),roll:clone(raw.find(event=>event.type==="roll.public")?.payload||raw.find(event=>event.type==="attack.pending")?.payload?.roll||null)};
    }
    const technique=raw.find(event=>event.type==="technique.prepare");
    if(technique?.payload?.ruleId==="altruist.alchemist.1"){
      const potionAction=raw.find(event=>event.type==="action.prepare"&&event.actorId===technique.actorId);
      const potion=String(potionAction?.payload?.name||"").replace(/^Зелье:\s*/u,"");
      return{kind:"potion",label:String(label).slice(0,160),actorId:technique.actorId,targetId:safeIds(technique.payload?.targetIds)[0]||null,potion};
    }
    if(technique)return {kind:"technique",label:String(label).slice(0,160),actorId:technique.actorId,ruleId:technique.payload?.ruleId||null,request:safeObject(technique.payload?.request)};
    const prepared=raw.find(event=>event.type==="action.prepare");
    if(prepared){
      const move=raw.find(event=>event.type==="actor.move"&&event.actorId===prepared.actorId&&!event.payload?.placement)||raw.find(event=>event.type==="actor.move"&&event.actorId===prepared.actorId);
      const pending=raw.find(event=>event.type==="attack.pending");
      const roll=raw.find(event=>event.type==="roll.public")?.payload||pending?.payload?.roll||null;
      if(prepared.payload?.planId){
        return{kind:"action-plan-continue",label:String(label).slice(0,160),actorId:prepared.actorId,planId:prepared.payload.planId,destination:move?{x:Number(move.payload?.x),y:Number(move.payload?.y)}:null,context:{...safeObject(scene?.pendingActionPlan?.context),targetIds:safeIds(prepared.payload?.targetIds),targetCells:safeCells(prepared.payload?.targetCells),roll:roll?clone(roll):null,...actionOptions(prepared.payload?.request)}};
      }
      return {
        kind:"action",label:String(label).slice(0,160),actorId:prepared.actorId,
        actionId:prepared.payload?.actionId,targetIds:safeIds(prepared.payload?.targetIds),targetCells:safeCells(prepared.payload?.targetCells),
        destination:move?{x:Number(move.payload?.x),y:Number(move.payload?.y)}:null,
        roll:roll?clone(roll):null,options:actionOptions(prepared.payload?.request),
      };
    }
    const reaction=raw.find(event=>event.type==="reaction.respond");
    if(reaction){
      const move=raw.find(event=>event.type==="actor.move"&&event.actorId===reaction.actorId);
      return {kind:"reaction",label:String(label).slice(0,160),actorId:reaction.payload?.giftReaction?.reactionActorId||reaction.actorId,targetActorId:reaction.actorId,choice:reaction.payload?.choice,destination:clone(move?.payload||reaction.payload?.destination||null),clash:clone(reaction.payload?.clash||null)};
    }
    const sacrifice=raw.length===1&&raw[0].type==="gift.sacrifice"?raw[0]:null;
    if(sacrifice)return{kind:"gift-sacrifice",label:String(label).slice(0,160),actorId:sacrifice.actorId,rollId:String(sacrifice.payload?.rollId||"").slice(0,120),sacrifice:String(sacrifice.payload?.sacrifice||"")};
    const publicRoll=raw.find(event=>event.type==="roll.public");
    if(publicRoll&&raw.length===1)return {kind:"public-roll",label:String(label).slice(0,160),actorId:publicRoll.actorId,payload:safeObject(publicRoll.payload)};
    throw new Error("Это изменение пока нельзя отправить как безопасное намерение игрока");
  }

  function ownedActor(scene,actorId,ownerId){
    const actor=(scene.actors||[]).find(item=>item.id===actorId);
    if(!actor)throw new Error("Исполнитель больше не находится в Сцене");
    if(ownerId&&actor.ownerId!==ownerId)throw new Error("Игрок не владеет этим героем");
    return actor;
  }

  function materializeIntent(scene,data,intent,ownerId,{sceneEngine,techniqueEngine,safeTechniqueEffects}={}){
    const Engine=sceneEngine||global.DAWN_SCENE_ENGINE,Techniques=techniqueEngine||global.DAWN_TECHNIQUE_ENGINE;
    if(!Engine)throw new Error("Ядро Сцены не загружено");
    if(!intent||typeof intent!=="object")throw new Error("Пустое намерение игрока");
    const actor=ownedActor(scene,intent.actorId,ownerId);
    if(intent.kind==="deployment"){
      const destination=intent.destination||{},space=(scene.spaces||[]).find(item=>item.id===destination.space),combatStarted=Boolean(scene.activeActorId||Number(scene.round||1)>1||(scene.actors||[]).some(item=>item.kind!=="crowd"&&item.acted));
      if(combatStarted)throw new Error("Развертывание уже завершено");
      if(!space||actor.space!==space.id||!Number.isInteger(Number(destination.x))||!Number.isInteger(Number(destination.y))||Number(destination.x)<0||Number(destination.y)<0||Number(destination.x)>=Number(space.width)||Number(destination.y)>=Number(space.height))throw new Error("Некорректная клетка развертывания");
      const team=actor.team==="enemy"?"enemy":"hero",explicit=[...new Set((scene.objects||[]).filter(object=>object.space===space.id&&object.type===`deploy-${team}`).flatMap(object=>object.cells||[]))],fallback=space.mode==="cinematic"?(team==="hero"?["0,0","1,0"]:["5,0","6,0"]):Array.from({length:Number(space.height)},(_,y)=>`${team==="hero"?0:Number(space.width)-1},${y}`),allowed=explicit.length?explicit:fallback,key=`${Number(destination.x)},${Number(destination.y)}`;
      if(!allowed.includes(key))throw new Error(`Развертывание ${team==="enemy"?"врага":"героя"} разрешено только в зоне его стороны`);
      return[{type:"actor.move",actorId:actor.id,payload:{space:space.id,x:Number(destination.x),y:Number(destination.y),movement:"Развертывание",placement:true}},{type:"actor.enter",actorId:actor.id,payload:{space:space.id,x:Number(destination.x),y:Number(destination.y),movement:"Развертывание",placement:true}}];
    }
    if(intent.kind==="action-plan-start"){
      const result=Engine.prepareActionPlan(scene,data,{actorId:actor.id,actionId:intent.actionId,phase:intent.phase,context:safeObject(intent.context)});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="action-plan-reappearance"){
      const result=Engine.prepareActionPlanReappearance(scene,{actorId:actor.id,destination:intent.destination});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="action-plan-modifier"){
      const result=Engine.prepareActionPlanModifierDestination(scene,{actorId:actor.id,destination:intent.destination});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="action-plan-continue"){
      const result=Engine.prepareActionPlanContinuation(scene,data,{actorId:actor.id,destination:intent.destination||undefined,context:safeObject(intent.context)});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="action-plan-cancel"){
      const result=Engine.cancelActionPlan(scene,{actorId:actor.id,reason:intent.reason});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="runtime"){
      const limits={hp:9999,wounds:99,stress:3,focus:9999,influence:999,ap:99},key=intent.key,value=Number(intent.value);
      if(!Object.hasOwn(limits,key)||!Number.isFinite(value)||value<0||value>limits[key])throw new Error("Некорректное изменение ресурса");
      return[{type:"actor.runtime.set",actorId:actor.id,payload:{key,value}}];
    }
    if(intent.kind==="potion"){
      const result=Engine.preparePotionUse(scene,data,{actorId:actor.id,targetId:intent.targetId,potion:intent.potion});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="invisible-disappear"){
      const result=Engine.prepareInvisibleDisappear(scene,actor.id);
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="meal"){
      const delta=Number(intent.delta);
      if(![-1,1].includes(delta))throw new Error("Некорректное изменение Трапез");
      return[{type:delta>0?"resource.gain":"resource.spend",actorId:actor.id,payload:{resource:"meals",amount:1}}];
    }
    if(intent.kind==="spell-modifiers"){
      const level=Number(actor.techniques?.["ruiner.spellcrafter"]||0),allowed=new Set(["fierce","focused","wild","outstanding"]),value=[...new Set(safeIds(intent.value))],limit=level>=3?2:1;
      if(level<1||value.length>limit||value.some(id=>!allowed.has(id)))throw new Error("Некорректный выбор Модификаций");
      return[{type:"technique.state",actorId:actor.id,payload:{key:"spellModifiers",value,ruleId:"ruiner.spellcrafter",name:"Творец заклинаний"}}];
    }
    if(intent.kind==="take-wound"){
      return[{type:"damage.apply",actorId:intent.external?null:actor.id,payload:{targetId:actor.id,amount:Math.max(1,Number(actor.hp)||0),ignoreArmor:true}}];
    }
    if(intent.kind==="turn-start"){
      if(scene.turnApprovalMode==="narrator")throw new Error("Ходы героев сейчас подтверждает Нарратор");
      if(actor.team!=="hero"||!actor.heroId)throw new Error("Игрок может начать только Ход своего героя");
      if(scene.activeActorId)throw new Error("Сначала должен завершиться текущий Ход");
      const status=Engine.turnStartStatus(scene,actor.id);if(!status.available)throw new Error(status.reason||"Этот Ход сейчас недоступен");
      return[{type:"turn.start",actorId:actor.id,payload:{}}];
    }
    if(intent.kind==="turn-end"){
      if(scene.activeActorId!==actor.id)throw new Error("Завершить можно только текущий Ход");
      return[{type:"turn.end",actorId:actor.id,payload:{}}];
    }
    if(intent.kind==="action"){
      const options=actionOptions(intent.options);
      const result=Engine.prepareAction(scene,data,{actorId:actor.id,actionId:intent.actionId,targetIds:safeIds(intent.targetIds),targetCells:safeCells(intent.targetCells),destination:intent.destination||undefined,roll:intent.roll||null,...options});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="reaction"){
      const targetActorId=intent.targetActorId||actor.id,option=targetActorId!==actor.id&&typeof Engine.reactionOptions==="function"?Engine.reactionOptions(scene,data,targetActorId).find(item=>item.id===intent.choice):null;
      if(targetActorId!==actor.id&&(!option||option.giftReaction?.reactionActorId!==actor.id))throw new Error("Игрок не управляет этой Реакцией");
      const result=Engine.respondReaction(scene,data,{actorId:targetActorId,choice:intent.choice,destination:intent.destination||undefined,clash:intent.clash||undefined});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="gift-sacrifice")return Engine.prepareSacrifice(scene,{actorId:actor.id,rollId:intent.rollId,sacrifice:intent.sacrifice}).events;
    if(intent.kind==="technique"){
      if(!Techniques)throw new Error("Ядро Техник не загружено");
      const request={...safeObject(intent.request),actorId:actor.id};
      const rule=Techniques.RULES.find(item=>item.id===intent.ruleId);
      let prepared;
      if(rule)prepared=Techniques.preview(scene,{...request,ruleId:rule.id});
      else{
        const entry=Techniques.techniqueCoverage(data,actor.techniques||{}).find(item=>item.id===request.entryId);
        const effectIds=typeof safeTechniqueEffects==="function"?safeTechniqueEffects(entry):[];
        prepared=request.mode==="assist"
          ?Techniques.assistedPreview(scene,{actorId:actor.id,entry,targetIds:safeIds(request.targetIds),effectIds,note:request.note})
          :Techniques.manualPreview(scene,{actorId:actor.id,entry,targetIds:safeIds(request.targetIds),note:request.note});
      }
      if(!prepared?.ok)throw new Error(prepared?.errors?.join(" ")||"Техника больше недоступна");
      return Techniques.toEvents(scene,prepared);
    }
    if(intent.kind==="rule-response"){
      const prompt=scene.pendingPrompt;
      if(!prompt||prompt.id!==intent.promptId||prompt.sourceActorId!==actor.id)throw new Error("Этот вопрос правила уже завершён");
      const result=intent.choice==="cell"&&intent.destination
        ?Engine.preparePromptPlacement(scene,{destination:{x:Number(intent.destination.x),y:Number(intent.destination.y)}})
        :Engine.respondRulePrompt(scene,data,{choice:intent.choice,roll:intent.roll||null});
      if(!result.ok)throw new Error(result.errors.join(" "));
      return result.events;
    }
    if(intent.kind==="public-roll"){
      const event={id:makeId(),type:"roll.public",actorId:actor.id,payload:safeObject(intent.payload)};
      Engine.validateEvent(scene,event);
      return [event];
    }
    throw new Error("Неизвестный тип намерения игрока");
  }

  function coalesceKey(item){
    if(item.kind!=="events"||item.events?.length!==1)return"";
    const event=item.events[0],id=event.payload?.id;
    if(["session-clock.set","session-clock.rename","session-clock.kind","session-clock.size"].includes(event.type)&&id)return`${event.type}:${id}`;
    return"";
  }

  class AuthorityQueue{
    constructor(options={}){
      this.options=options;
      this.tickMs=Math.max(TICK_MS,Number(options.tickMs)||TICK_MS);
      this.maxItems=Number(options.maxItems)||MAX_AUTHORITY_ITEMS;
      this.queue=[];
      this.timer=null;
      this.flushing=false;
      this.inFlight=null;
      this.failures=0;
      this.generation=0;
      this.discarded=new WeakSet();
    }
    enqueue(item){
      const normalized={...item,queuedAt:Date.now()};
      const key=coalesceKey(normalized);
      if(key){
        const index=this.queue.findIndex(entry=>coalesceKey(entry)===key);
        if(index>=0)this.queue[index]=normalized;
        else{
          if(this.queue.length>=this.maxItems)throw new Error("Сетевая очередь Нарратора переполнена; дождитесь синхронизации");
          this.queue.push(normalized);
        }
      }else if(normalized.kind==="snapshot"){
        const index=this.queue.findIndex(entry=>entry.kind==="snapshot");
        if(index>=0)this.queue[index]=normalized;
        else{
          if(this.queue.length>=this.maxItems)throw new Error("Сетевая очередь Нарратора переполнена; дождитесь синхронизации");
          this.queue.push(normalized);
        }
      }else{
        if(this.queue.length>=this.maxItems)throw new Error("Сетевая очередь Нарратора переполнена; дождитесь синхронизации");
        this.queue.push(normalized);
      }
      this.schedule();
      return normalized;
    }
    schedule(){
      if(this.timer||this.flushing)return;
      this.timer=setTimeout(()=>{this.timer=null;void this.flush()},Math.min(this.tickMs*2**this.failures,5000));
    }
    async flush(){
      if(this.flushing||!this.queue.length)return;
      this.flushing=true;
      const generation=this.generation;
      const source=this.queue.splice(0,20);
      this.inFlight=source;
      try{await this.options.flush(source);this.failures=0}
      catch(error){
        if(generation===this.generation){
          this.failures=Math.min(this.failures+1,5);
          this.queue.unshift(...source.filter(item=>!this.discarded.has(item)));
          this.options.onError?.(error);
        }
      }finally{
        source.forEach(item=>this.discarded.delete(item));
        if(this.inFlight===source)this.inFlight=null;
        this.flushing=false;
        if(generation===this.generation&&this.queue.length)this.schedule();
      }
    }
    discard(predicate){
      if(typeof predicate!=="function")return 0;
      let removed=0;
      this.queue=this.queue.filter(item=>{if(!predicate(item))return true;removed++;return false});
      for(const item of this.inFlight||[])if(predicate(item)){this.discarded.add(item);removed++}
      return removed;
    }
    clear(){this.generation++;clearTimeout(this.timer);this.timer=null;this.queue=[];this.inFlight=null;this.failures=0;this.discarded=new WeakSet()}
    latestQueuedSnapshot(){return[...this.queue].reverse().find(item=>item.kind==="snapshot")||null}
    latestSnapshot(){return[...(this.inFlight||[]),...this.queue].reverse().find(item=>item.kind==="snapshot")||null}
    pending(){return this.queue.length+(this.flushing?1:0)}
  }

  class PlayerOutbox{
    constructor({send,onError,tickMs=TICK_MS,maxItems=MAX_OUTBOX_ITEMS}={}){
      this.send=send;
      this.onError=onError;
      this.tickMs=Math.max(TICK_MS,Number(tickMs)||TICK_MS);
      this.maxItems=maxItems;
      this.queue=[];
      this.timer=null;
      this.sending=false;
      this.inFlight=null;
      this.failures=0;
      this.generation=0;
    }
    enqueue(intent,baseVersion){
      const row={protocol:PROTOCOL,clientIntentId:makeId(),baseVersion:Number(baseVersion)||0,intent:clone(intent)};
      const key=intent?.kind==="runtime"?`runtime:${intent.actorId}:${intent.key}`:intent?.kind==="targets"?`targets:${intent.actorId}`:"";
      const index=key?this.queue.findIndex(item=>(item.intent?.kind==="runtime"?`runtime:${item.intent.actorId}:${item.intent.key}`:item.intent?.kind==="targets"?`targets:${item.intent.actorId}`:"")===key):-1;
      if(index>=0)this.queue[index]=row;
      else{
        if(this.queue.length>=this.maxItems)throw new Error("Очередь действий заполнена; дождитесь связи со столом");
        this.queue.push(row);
      }
      this.schedule();
      return row;
    }
    schedule(){if(!this.timer&&!this.sending)this.timer=setTimeout(()=>{this.timer=null;void this.flush()},Math.min(this.tickMs*2**this.failures,5000))}
    async flush(){
      if(this.sending||!this.queue.length)return;
      this.sending=true;
      const generation=this.generation,row=this.queue.shift();
      this.inFlight=row;
      try{await this.send(row);if(generation===this.generation)this.failures=0}
      catch(error){
        if(generation===this.generation){
          this.failures=Math.min(this.failures+1,5);
          this.queue.unshift(row);
          this.onError?.(error,row);
        }
      }
      finally{
        this.inFlight=null;
        this.sending=false;
        if(generation===this.generation&&this.queue.length)this.schedule();
      }
    }
    clear(){this.generation++;clearTimeout(this.timer);this.timer=null;this.queue=[];this.failures=0}
    pending(){return this.queue.length+(this.inFlight?1:0)}
  }

  global.DAWN_NETWORK_V2={
    AUTOMATIC_COMMANDS,AuthorityQueue,MAX_AUTHORITY_ITEMS,MAX_BATCH_EVENTS,MAX_OUTBOX_ITEMS,PROTOCOL,PlayerOutbox,TICK_MS,
    captureLocalUi,clearConfirmedScene,getConfirmedScene,intentFromEvents,materializeIntent,mergeRemoteScene,
    networkSceneState,rebaseSceneSnapshot,restoreLocalUi,setConfirmedScene,validateIntentEnvelope,
  };
})(typeof window==="object"?window:globalThis);
