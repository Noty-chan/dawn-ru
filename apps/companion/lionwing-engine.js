"use strict";

// LionWing commands are resolved on a copy. The 0.9 reducer and its Technique
// triggers are deliberately outside this boundary. Rendering/storage stay shared.
(function installLionwingEngine(global) {
  if (!global.DAWN_LIONWING_DATA?.coreRules) return;
  const legacy = { ...global.DAWN_SCENE_ENGINE };
  const core = global.DAWN_LIONWING_DATA.coreRules;
  const foundations = global.DAWN_LIONWING_EXECUTION;
  const copy = value => JSON.parse(JSON.stringify(value));
  const ids = legacy.ACTION_IDS;
  const actor = (scene, id) => (scene.actors || []).find(item => item.id === id);
  const has = (a, id) => (a?.effects || []).includes(id);
  const isPlayer = a => a?.kind === "hero" || Boolean(a?.heroId);
  const live = a => a && !a.knockedOut;
  const distance = (a, b) => a.space === b.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
  const fail = message => { throw new Error(message); };
  const integer = (value, label, max = 9999) => {
    if (!Number.isSafeInteger(value) || value < 0 || value > max) fail(`Некорректное значение: ${label}`);
    return value;
  };
  const requiredActor = (scene, id, alive = true) => {
    const result = actor(scene, id);
    if (!result || alive && result.knockedOut) fail("Участник отсутствует или выведен из боя");
    return result;
  };
  const isScene = scene => scene?.rulesEdition === "lionwing" || !scene?.rulesEdition && (scene?.actors || []).some(a => a.rulesEdition === "lionwing" || a.profileId?.startsWith("lionwing."));
  const state = scene => {
    scene.lionwing ||= {};
    const s=scene.lionwing;s.schema=2;
    // Auras are declarative scene state. They stay outside actor.effects so a
    // render/query never materializes one copy on every target.
    if(!Array.isArray(s.auras)&&Array.isArray(scene.auras))s.auras=copy(scene.auras);
    if(!Array.isArray(s.auras))s.auras=[];
    if(s.started===undefined)s.started=Boolean(scene.activeActorId||Number(scene.round||1)>1||(scene.actors||[]).some(a=>a.acted&&a.kind!=="crowd"));
    if(s.lastTeam===undefined){const last=(scene.log||[]).find(e=>e.type==="turn.end");s.lastTeam=actor(scene,last?.actorId)?.team||null;}
    const migrateHistory=!Array.isArray(s.history);
    for(const key of ["choices","deferred","receipts","history"])if(!Array.isArray(s[key]))s[key]=[];
    s.sceneSerial=Number.isSafeInteger(s.sceneSerial)&&s.sceneSerial>0?s.sceneSerial:1;
    s.chapterSerial=Number.isSafeInteger(s.chapterSerial)&&s.chapterSerial>0?s.chapterSerial:1;
    for (const participant of scene.actors || []) normalizeTurnCounters(participant, scene);
    if(s.executionCursor!==undefined){
      if(!s.executionCursor||typeof s.executionCursor!=="object"||Array.isArray(s.executionCursor))fail("Сохранённый курсор исполнения имеет неподдерживаемый формат");
      try{s.executionCursor=foundations.openCursor(s.executionCursor)}catch{fail("Сохранённый курсор исполнения повреждён или имеет неподдерживаемый формат")}
    }
    if(scene.activeActorId&&!s.activeTurnInstanceId)s.activeTurnInstanceId=s.activeTurn?.turnInstanceId||`legacy-turn:${Number(scene.turnSerial||0)}`;
    if (scene.activeActorId) {
      const active = actor(scene, scene.activeActorId), ownerTurnSerial = active ? ownTurnSerial(active) : 0;
      if (active) {
        active.lionwing ||= {};
        active.lionwing.turnInstanceId ||= s.activeTurnInstanceId || null;
        active.lionwing.lastTurnInstanceId ||= s.activeTurnInstanceId || null;
        active.lionwing.ownerTurnInstanceId ||= s.activeTurnInstanceId || null;
        active.lionwing.ownerTurnKey ||= ownerTurnKey(s.sceneSerial, active, ownerTurnSerial);
      }
      s.activeTurn = {
        schema: 1,
        turnInstanceId: s.activeTurnInstanceId || `legacy-turn:${Number(scene.turnSerial || 0)}`,
        actorId: scene.activeActorId,
        sceneTurnSerial: Number.isSafeInteger(Number(scene.turnSerial)) ? Number(scene.turnSerial) : 0,
        ownerTurnSerial,
        ownerTurnKey: active ? ownerTurnKey(s.sceneSerial, active, ownerTurnSerial) : null,
        kind: s.activeTurn?.kind === "extra" ? "extra" : "normal",
      };
    } else if (s.activeTurn) {
      s.lastTurn = copy(s.activeTurn);
      delete s.activeTurn;
    }
    if(migrateHistory)for(const a of scene.actors||[])for(const h of a.lionwing?.history||[]){
      if(!h.ruleId)continue;
      const legacyId=`legacy:history:${s.history.length}`;
      const ownerTurnSerial=Number.isSafeInteger(Number(h.ownerTurnSerial))&&Number(h.ownerTurnSerial)>=0?Number(h.ownerTurnSerial):Number.isSafeInteger(Number(h.ownTurnSerial))&&Number(h.ownTurnSerial)>=0?Number(h.ownTurnSerial):Number.isSafeInteger(Number(h.turnSerial))&&Number(h.turnSerial)>=0?Number(h.turnSerial):null;
      s.history.push({schema:1,id:legacyId,type:"apply",rootActionId:legacyId,actionId:null,ownerActorId:a.id,actorId:a.id,ruleId:h.ruleId,targetIds:copy(h.targetIds||[]),round:h.round,turnSerial:h.turnSerial,ownerTurnActorId:a.id,ownerTurnSerial,ownerTurnInstanceId:h.ownerTurnInstanceId||null,ownerTurnKey:ownerTurnSerial==null?null:`${s.sceneSerial}:${a.id}:${ownerTurnSerial}`,sceneSerial:s.sceneSerial,chapterSerial:s.chapterSerial,details:{legacy:true}});
    }
    return s;
  };
  const astate = a => {a.lionwing||={};for(const key of ["modifiers","history"])if(!Array.isArray(a.lionwing[key]))a.lionwing[key]=[];return a.lionwing;};
  function normalizeTurnCounters(a, scene = null) {
    if (!a || typeof a !== "object") return 0;
    a.lionwing ||= {};
    const rawValues = [a.lionwing.ownerTurnSerial, a.lionwing.ownTurnSerial, a.lionwing.turnCount, a.lionwing.turnsStarted, a.lionwing.turns]
      .map(value => Number(value)).filter(value => Number.isSafeInteger(value) && value >= 0);
    let count = rawValues.length ? Math.max(...rawValues) : 0;
    if (scene) {
      const started = (scene.log || []).filter(row => row?.type === "turn.start" && row.actorId === a.id).length;
      // Old saves may have kept a stale zero in `turns` while the compact
      // event log already records completed own Turns. Never lower a serial
      // during normalization.
      count = Math.max(count, started);
    }
    if (scene?.activeActorId === a.id && count === 0 && Number(scene.turnSerial || 0) > 0) count = 1;
    // Keep the old `turns` field readable while exposing names that make the
    // ownership of this serial unambiguous.  All are scalar JSON values.
    a.lionwing.turns = count;
    a.lionwing.turnCount = count;
    a.lionwing.turnsStarted = count;
    a.lionwing.ownTurnSerial = count;
    a.lionwing.ownerTurnSerial = count;
    a.lionwing.turnSerial = count;
    return count;
  }
  const ownTurnSerial = a => normalizeTurnCounters(a);
  const ownerTurnKey = (sceneSerial, a, serialValue = ownTurnSerial(a)) => a?.id && Number.isSafeInteger(serialValue) ? `${sceneSerial}:${a.id}:${serialValue}` : null;
  const attributes = new Set(["body", "talent", "spirit", "mind"]);
  const effectIds = new Set([...core.effects.positive, ...core.effects.negative].map(e => e.id));
  const attacks = new Set([ids.spell, ids.skirmish, ids.finish, "action.атаки.дуэль"]);
  const persistent = new Set(["positive.невидим", "positive.регенерирует", "negative.порчен", "negative.помечен"]);
  const resources = new Set(["hp", "maxHp", "ap", "baseAp", "focus", "influence", "wounds", "stress", "armor", "evasion", "speed", "tier"]);
  const spendable = new Set(["ap", "focus", "influence"]);
  const resourceKey = (a,key) => ["focus","ap"].includes(key)?Object.keys(a.ruleResources||{}).find(id=>key==="focus"?a.ruleResources[id].replaces==="focus":a.ruleResources[id].replacesAp===true)||key:key;
  const balance = (a, key) => { const resolved=resourceKey(a,key);return Number(spendable.has(resolved)?a[resolved]||0:a.ruleResources?.[resolved]?.value||0); };
  const canSpend=(a,key,amount)=>{const resource=resourceKey(a,key),def=a.ruleResources?.[resource];return key==="focus"&&def?.inverted?def.maximum==null||balance(a,key)+amount<=def.maximum:balance(a,key)>=amount;};
  const lifetimes = new Set(["default", "startTurn", "endTurn", "nextTurn", "startNextOwnerTurn", "endNextOwnerTurn", "roundEnd", "scene", "persistent", "manual"]);
  const counterIdPattern = /^[a-z][a-z0-9._:-]{0,119}$/i;
  const counterRuleIdPattern = /^[a-z0-9][a-z0-9._:-]{0,179}$/i;
  const counterScopes = new Set(["manual", "startTurn", "endTurn", "roundEnd", "scene", "turn", "round", "chapter", "session"]);
  const counterLifetimes = new Set([...lifetimes, "turn", "round", "chapter", "session"]);
  const strictCounterInteger = (value, label, minimum = 0, maximum = 9999) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) fail(`Некорректное значение: ${label}`);
    return value;
  };
  const counterString = (value, label, maximum = 180) => {
    if (typeof value !== "string" || !value.trim() || value.length > maximum) fail(`Некорректное значение: ${label}`);
    return value.trim();
  };
  const counterEntityExists = (scene, id) => Boolean(actor(scene, id) || (scene.objects || []).some(item => item.id === id) || (scene.walls || []).some(item => item.id === id) || (scene.markers || []).some(item => item.id === id) || (scene.spaces || []).some(item => item.id === id));
  const counterDefinition = (scene, a, type, id, payload = {}, previous = null, sourceId = null) => {
    if (!a || !["clock", "resource"].includes(type) || !counterIdPattern.test(String(id || "")) || ["constructor", "prototype", "__proto__"].includes(id)) fail("Некорректный ID счётчика");
    if (type === "clock" && !/^[a-z][a-z0-9.-]{0,79}$/.test(String(id))) fail("ID часов: строчные латинские буквы, цифры, точка и дефис");
    if (type === "resource" && !/^[a-zA-Z][\w.-]{0,79}$/.test(String(id))) fail("Некорректный ID ресурса");
    const old = previous && typeof previous === "object" ? previous : {};
    const oldValue = previous && typeof previous !== "object" ? previous : old.current ?? old.value;
    const oldMaximum = type === "clock" ? old.max ?? old.maximum ?? old.size : old.max ?? old.maximum;
    const rawMaximum = payload.max !== undefined ? payload.max : payload.maximum !== undefined ? payload.maximum : payload.size !== undefined && type === "clock" ? payload.size : oldMaximum;
    const maximum = rawMaximum == null ? null : strictCounterInteger(rawMaximum, type === "clock" ? "размер часов" : "максимум", type === "clock" ? 1 : 0, type === "clock" ? 100 : 9999);
    if (type === "clock" && maximum == null) fail("Часам нужен конечный размер");
    const minimum = strictCounterInteger(payload.min !== undefined ? payload.min : payload.minimum !== undefined ? payload.minimum : old.min ?? old.minimum ?? 0, "минимум", 0, maximum ?? 9999);
    if (maximum != null && minimum > maximum) fail("Минимум превышает максимум");
    const initial = strictCounterInteger(payload.initial !== undefined ? payload.initial : old.initial ?? minimum, "значение сброса", minimum, maximum ?? 9999);
    let current = payload.current !== undefined ? payload.current : payload.value !== undefined ? payload.value : oldValue ?? initial;
    current = strictCounterInteger(current, "текущее значение (максимум)", minimum, maximum ?? 9999);
    const thresholdRaw = payload.threshold !== undefined ? payload.threshold : old.threshold !== undefined ? old.threshold : maximum;
    const threshold = thresholdRaw == null ? null : strictCounterInteger(thresholdRaw, "порог", minimum, maximum ?? 9999);
    const ownerActorId = old.ownerActorId ?? payload.ownerActorId ?? a.id;
    if (ownerActorId !== a.id) fail("Счётчик принадлежит другому участнику");
    const sourceActorId = payload.sourceActorId !== undefined ? payload.sourceActorId : old.sourceActorId ?? sourceId ?? a.id;
    if (sourceActorId != null && (!counterIdPattern.test(String(sourceActorId)) || !actor(scene, sourceActorId))) fail("Источник счётчика отсутствует на Сцене");
    const sourceEntityId = payload.sourceEntityId !== undefined ? payload.sourceEntityId : old.sourceEntityId ?? null;
    if (sourceEntityId != null && (typeof sourceEntityId !== "string" || !sourceEntityId || !counterEntityExists(scene, sourceEntityId))) fail("Сущность-источник счётчика отсутствует на Сцене");
    const ruleId = payload.ruleId !== undefined ? payload.ruleId : old.ruleId ?? null;
    if (ruleId != null && (typeof ruleId !== "string" || !counterRuleIdPattern.test(ruleId))) fail("Некорректный ID правила счётчика");
    const scope = payload.scope !== undefined ? payload.scope : old.scope ?? payload.resetAt ?? old.resetAt ?? "manual";
    if (typeof scope !== "string" || !counterScopes.has(scope)) fail("Неизвестный срок/область сброса счётчика");
    const rawLifetime = payload.lifetime !== undefined ? payload.lifetime : old.lifetime ?? scope;
    let lifetime;
    if (rawLifetime && typeof rawLifetime === "object") {
      lifetime = foundations.normalizeLifetime(rawLifetime, { ownerActorId: a.id, ownerTurnSerial: ownTurnSerial(a), ownerTurnInstanceId: scene.activeActorId === a.id ? scene.lionwing?.activeTurnInstanceId || null : null, sceneSerial: scene.lionwing?.sceneSerial || 1 });
    } else {
      if (typeof rawLifetime !== "string" || !counterLifetimes.has(rawLifetime)) fail("Неизвестный срок жизни счётчика");
      lifetime = rawLifetime;
    }
    const label = counterString(payload.label !== undefined ? payload.label : payload.name !== undefined ? payload.name : old.label ?? old.name ?? id, "название счётчика", 120);
    const result = {
      id, kind: type, label, name: label, ownerActorId: a.id, sourceActorId: sourceActorId ?? null, sourceEntityId: sourceEntityId ?? null, ruleId: ruleId ?? null,
      scope, lifetime, resetAt: ["manual", "startTurn", "endTurn", "roundEnd", "scene"].includes(scope) ? scope : old.resetAt ?? "manual",
      min: minimum, minimum, max: maximum, maximum, current, value: current, initial, threshold,
      active: old.active !== false,
    };
    if (type === "clock") { result.clockId = id; result.size = maximum; }
    else { result.resource = id; result.replaces = payload.replaces !== undefined ? payload.replaces : old.replaces ?? null; result.replacesAp = payload.replacesAp !== undefined ? payload.replacesAp : old.replacesAp ?? false; result.inverted = payload.inverted !== undefined ? payload.inverted : old.inverted ?? false; }
    return result;
  };
  const actionDef = id => core.actions.list.find(item => item.id === id);
  const nameOf = id => actionDef(id)?.name || id;
  const command = (actorId, payload) => ({ type: "lionwing.command", actorId, payload });
  const stat = (a, key) => Math.max(0, Number(a[key] || 0) + (a.lionwing?.modifiers || []).filter(m => m.stat === key).reduce((sum, m) => sum + (key==="evasion"?m.remaining??m.amount:m.amount), 0));
  const scaledMove = (a, amount, scene=null) => Math.ceil(amount * ((scene?effectActive(scene,a,"positive.ускорен"):has(a,"positive.ускорен")) ? 2 : 1) / ((scene?effectActive(scene,a,"negative.замедлен"):has(a,"negative.замедлен")) ? 2 : 1));
  const speed = (a,scene=null) => scaledMove(a, stat(a, "speed"), scene);
  const sceneSpeed = (scene,a) => scene.activeActorId && Number(a.lionwing?.difficultTerrainStopSerial) === Number(scene.turnSerial) ? 0 : (() => { const group=legacy.compoundEnemyStatus(scene,a);return group.active?scaledMove(a,group.speed+(a.lionwing?.modifiers||[]).filter(m=>m.stat==="speed").reduce((sum,m)=>sum+m.amount,0),scene):speed(a,scene); })();
  const targetIds = (scene,values=[]) => {const seen=new Set();return [...new Set(values)].filter(id=>{const key=actor(scene,id)?.compoundId||id;if(seen.has(key))return false;seen.add(key);return true;});};
  const unavailable = reason => ({ available: false, reason });
  const auraIdPattern = /^[^\u0000-\u001f\s]{1,180}$/u;
  const auraLifetimes = new Set([...lifetimes, "actionOrStartTurn", "round", "chapter", "session"]);
  const auraRelations = new Set(["ally", "enemy", "any"]);
  const auraSourceLossPolicies = new Set(["disable", "remove"]);
  const auraString = (value,label,max=180) => {
    if(typeof value!=="string"||!value.trim()||value.length>max||/[\u0000-\u001f]/u.test(value))fail(`Некорректное значение: ${label}`);
    return value.trim();
  };
  const auraInteger = (value,label,min=0,max=99) => {
    if(!Number.isSafeInteger(value)||value<min||value>max)fail(`Некорректное значение: ${label}`);
    return value;
  };
  const auraSourceEntity = (scene,id) => {
    if(typeof id!=="string"||!id)return null;
    const sourceActor=actor(scene,id);
    if(sourceActor)return { kind:"actor", entity:sourceActor };
    const sourceMarker=(scene.markers||[]).find(item=>item.id===id);
    return sourceMarker ? { kind:"marker", entity:sourceMarker } : null;
  };
  const auraCollection = scene => Array.isArray(scene?.lionwing?.auras) ? scene.lionwing.auras : Array.isArray(scene?.auras) ? scene.auras : [];
  const removeAurasForLostSource = (scene, sourceEntityId) => {
    if(typeof sourceEntityId!=="string"||!sourceEntityId)return [];
    const collection=auraCollection(scene);
    const removed=collection.filter(aura=>aura?.sourceLossPolicy==="remove"&&(aura.sourceEntityId===sourceEntityId||aura.ownerActorId===sourceEntityId));
    if(!removed.length)return [];
    const retained=collection.filter(aura=>!removed.includes(aura));
    if(Array.isArray(scene?.lionwing?.auras))scene.lionwing.auras=retained;
    else if(Array.isArray(scene?.auras))scene.auras=retained;
    return removed;
  };
  const auraRecord = (scene,input,previous=null) => {
    if(!input||typeof input!=="object"||Array.isArray(input))fail("Описание ауры должно быть объектом JSON");
    const old=previous&&typeof previous==="object"?previous:{};
    const id=auraString(input.id??old.id,"ID ауры");
    if(!auraIdPattern.test(id)||["constructor","prototype","__proto__"].includes(id))fail("Некорректный ID ауры");
    const ownerActorId=auraString(input.ownerActorId??old.ownerActorId,"владелец ауры");
    if(!actor(scene,ownerActorId))fail("Владелец ауры отсутствует на Сцене");
    const sourceEntityId=auraString(input.sourceEntityId??old.sourceEntityId,"сущность-источник ауры");
    if(!auraSourceEntity(scene,sourceEntityId))fail("Сущность-источник ауры отсутствует на Сцене");
    const ruleId=auraString(input.ruleId??old.ruleId,"правило ауры");
    const effectId=auraString(input.effectId??old.effectId,"Эффект ауры");
    if(!effectIds.has(effectId))fail("Неизвестный Эффект ауры LionWing");
    const shapeInput=input.shape??old.shape;
    if(!shapeInput||typeof shapeInput!=="object"||Array.isArray(shapeInput)||shapeInput.kind!=="radius")fail("Аура поддерживает только shape.kind=radius");
    const distanceValue=shapeInput.distance??input.distance??old.distance;
    const radius=auraInteger(distanceValue,"радиус ауры",0,99);
    const filterInput=input.filter??old.filter??{relation:input.relation??old.relation??"any"};
    if(!filterInput||typeof filterInput!=="object"||Array.isArray(filterInput))fail("Фильтр ауры должен быть объектом");
    const relation=filterInput.relation??input.relation??old.relation??"any";
    if(typeof relation!=="string"||!auraRelations.has(relation))fail("Фильтр ауры: ally, enemy или any");
    const rawLifetime=input.lifetime??old.lifetime??"scene";
    let lifetime;
    if(typeof rawLifetime==="string"){
      if(!auraLifetimes.has(rawLifetime))fail("Неизвестный срок ауры");
      lifetime=rawLifetime;
    }else if(rawLifetime&&typeof rawLifetime==="object"&&!Array.isArray(rawLifetime)){
      const boundary=rawLifetime.boundary??rawLifetime.kind??rawLifetime.phase;
      if(typeof boundary!=="string"||!auraLifetimes.has(boundary))fail("Неизвестная граница срока ауры");
      lifetime=["startNextOwnerTurn","endNextOwnerTurn"].includes(boundary)
        ? foundations.normalizeLifetime(rawLifetime,{ownerActorId,ownerTurnSerial:ownTurnSerial(actor(scene,ownerActorId)),sceneSerial:scene.lionwing?.sceneSerial||1})
        : boundary;
    }else fail("Неизвестный срок ауры");
    if(lifetime&&typeof lifetime==="object"&&lifetime.ownerActorId!==ownerActorId)fail("Владелец срока ауры должен совпадать с владельцем ауры");
    const sourceLossPolicy=input.sourceLossPolicy??input.onSourceLoss??old.sourceLossPolicy??old.onSourceLoss??"disable";
    if(typeof sourceLossPolicy!=="string"||!auraSourceLossPolicies.has(sourceLossPolicy))fail("Неизвестная политика потери источника ауры");
    const removable=input.removable!==undefined?input.removable:old.removable;
    if(removable!==undefined&&typeof removable!=="boolean")fail("Флаг removable ауры должен быть логическим");
    const rawSuppressions=input.suppressedBy??old.suppressedBy??[];
    if(!Array.isArray(rawSuppressions)||rawSuppressions.length>12||rawSuppressions.some(value=>typeof value!=="string"||!value.trim()||value.length>180||/[\u0000-\u001f]/u.test(value)))fail("Некорректный список подавления ауры");
    const appliedSerial=input.appliedSerial??old.appliedSerial??scene.turnSerial??0,appliedRound=input.appliedRound??old.appliedRound??scene.round??1;
    const result={
      id,ownerActorId,sourceEntityId,ruleId,effectId,
      shape:{kind:"radius",distance:radius},distance:radius,
      filter:{relation},lifetime,removable:removable===true,
      sourceLossPolicy,suppressedBy:[...new Set(rawSuppressions.map(value=>value.trim().slice(0,180)))].slice(0,12),
      appliedSerial:auraInteger(appliedSerial,"момент создания ауры",0,999999999),appliedRound:auraInteger(appliedRound,"Раунд создания ауры",0,999999999),appliedChapterSerial:auraInteger(input.appliedChapterSerial??old.appliedChapterSerial??scene.lionwing?.chapterSerial??1,"Глава создания ауры",0,999999999),
    };
    if(input.createdEventId??old.createdEventId)result.createdEventId=auraString(input.createdEventId??old.createdEventId,"событие создания ауры",180);
    return result;
  };
  const auraLifetimeExpired = (scene,aura) => {
    const life=aura?.lifetime||"scene",serial=Number(aura?.appliedSerial??0),round=Number(aura?.appliedRound??0),owner=aura?.ownerActorId;
    if(life&&typeof life==="object"){
      const ownerActor=actor(scene,life.ownerActorId),currentSerial=ownerActor?ownTurnSerial(ownerActor):Number(life.ownerTurnSerial??0);
      if(life.boundary==="startNextOwnerTurn")return scene.activeActorId===life.ownerActorId&&currentSerial>=Number(life.ownerTurnSerial||0)+1;
      if(life.boundary==="endNextOwnerTurn")return scene.activeActorId!==life.ownerActorId&&currentSerial>=Number(life.ownerTurnSerial||0)+1;
      return false;
    }
    if(life==="round"||life==="roundEnd")return Number(scene.round||0)>round;
    if(life==="chapter")return Number(scene.lionwing?.chapterSerial||0)>Number(aura?.appliedChapterSerial ?? (scene.lionwing?.chapterSerial || 0));
    if(["startTurn","nextTurn","startNextOwnerTurn","actionOrStartTurn"].includes(life))return scene.activeActorId===owner&&Number(scene.turnSerial||0)>serial;
    if(["default","endTurn","endNextOwnerTurn"].includes(life))return scene.activeActorId!==owner&&Number(scene.turnSerial||0)>serial;
    return false;
  };
  const auraStatus = (scene,aura,target) => {
    const owner=actor(scene,aura?.ownerActorId),source=auraSourceEntity(scene,aura?.sourceEntityId),targetActor=typeof target==="string"?actor(scene,target):target;
    if(!targetActor)return { active:false,reason:"Цель отсутствует на Сцене" };
    if(aura?.suppressedBy?.length)return { active:false,reason:`Аура подавлена: ${aura.suppressedBy.join(", ")}` };
    if(!owner)return { active:false,reason:"Владелец ауры отсутствует на Сцене" };
    if(owner.knockedOut)return { active:false,reason:"Владелец ауры выведен из боя" };
    if(!source)return { active:false,reason:"Источник ауры отсутствует на Сцене" };
    if(source.kind==="actor"&&source.entity.knockedOut)return { active:false,reason:"Источник ауры выведен из боя" };
    if(auraLifetimeExpired(scene,aura))return { active:false,reason:"Срок ауры истёк" };
    if(targetActor.knockedOut)return { active:false,reason:"Цель выведена из боя" };
    if(source.entity.space!==targetActor.space)return { active:false,reason:"Цель в другом пространстве" };
    const distanceValue=Math.abs(Number(source.entity.x||0)-Number(targetActor.x||0))+Math.abs(Number(source.entity.y||0)-Number(targetActor.y||0));
    const radius=Number(aura.shape?.distance??aura.distance);
    if(!Number.isSafeInteger(radius)||distanceValue>radius)return { active:false,reason:`За пределами радиуса ${radius}` };
    const relation=aura.filter?.relation||"any";
    if(relation==="ally"&&owner.team!==targetActor.team)return {active:false,reason:"Цель не союзник источника"};
    if(relation==="enemy"&&owner.team===targetActor.team)return {active:false,reason:"Цель не противник источника"};
    return { active:true,reason:"Аура действует" };
  };
  const directEffectSources = (scene,target,effect) => {
    const saved=target?.effectStates?.[effect],sources=(saved?.sources||[]).map((source,index)=>({
      sourceId:source.sourceId||source.actorId||`${effect}:legacy:${index}`,
      actorId:source.actorId||null, actionId:source.actionId||null, actionInstanceId:source.actionInstanceId||null, eventId:source.eventId||saved?.appliedEventId||null,
      appliedSerial:Number(source.appliedSerial??saved?.appliedTurnSerial??0), duration:source.duration||saved?.duration||"default", lifetime:source.lifetime||saved?.lifetime||null,
      boundaryOwnerId:source.ownerActorId||source.boundaryOwnerId||target?.id||null, ownerTurnSerial:source.ownerTurnSerial==null?null:Number(source.ownerTurnSerial), removable:source.removable!==false, sourceBound:source.sourceBound!==false,
      suppressedBy:[...(source.suppressedBy||[])], sourceType:"effect", active:!(source.suppressedBy||[]).length,
      reason:(source.suppressedBy||[]).length?`Источник подавлен: ${(source.suppressedBy||[]).join(", ")}`:"Эффект наложен"
    }));
    // Older saves may contain actor.effects without a source list. Preserve
    // their meaning in the query without writing a synthetic source back.
    if(!sources.length&&target?.effects?.includes(effect))sources.push({sourceId:`${effect}:legacy`,actorId:null,actionId:null,actionInstanceId:null,eventId:saved?.appliedEventId||null,appliedSerial:Number(saved?.appliedTurnSerial??0),duration:saved?.duration||"default",lifetime:saved?.lifetime||null,boundaryOwnerId:target.id,ownerTurnSerial:null,removable:saved?.removable!==false,sourceBound:saved?.sourceBound!==false,suppressedBy:[],sourceType:"effect",active:true,reason:"Эффект наложен (старое сохранение)"});
    return sources;
  };
  function activeState(scene, actorId, effect) {
    const target=actor(scene,actorId);
    if(effect===undefined){
      const ids=new Set([...(target?.effects||[]),...Object.keys(target?.effectStates||{}),...auraCollection(scene).filter(aura=>target&&aura.effectId).map(aura=>aura.effectId)]);
      const byEffect=Object.fromEntries([...ids].map(id=>[id,activeState(scene,actorId,id)]));
      return { actorId, effects:Object.values(byEffect).filter(item=>item.present), byEffect };
    }
    const direct=directEffectSources(scene,target,effect),ambient=auraCollection(scene).filter(aura=>aura?.effectId===effect).map(aura=>{const status=auraStatus(scene,aura,target);return {sourceId:aura.id,auraId:aura.id,aura:true,sourceType:"aura",actorId:aura.ownerActorId||null,ownerActorId:aura.ownerActorId||null,sourceEntityId:aura.sourceEntityId,ruleId:aura.ruleId,effectId:aura.effectId,actionId:null,actionInstanceId:null,eventId:aura.createdEventId||null,appliedSerial:Number(aura.appliedSerial??0),duration:aura.lifetime||"scene",lifetime:aura.lifetime||"scene",boundaryOwnerId:aura.ownerActorId||null,ownerTurnSerial:null,removable:aura.removable===true,sourceBound:true,suppressedBy:[...(aura.suppressedBy||[])],active:status.active,reason:status.reason};});
    const sources=[...direct,...ambient],activeSources=sources.filter(source=>source.active!==false&&!source.suppressedBy?.length);
    return { actorId,effect,present:activeSources.length>0,sources,activeSources,suppressedBy:[...new Set(sources.flatMap(source=>source.suppressedBy||[]))],directSources:direct,auraSources:ambient,reasons:sources.map(source=>({sourceId:source.sourceId,active:source.active!==false&&!source.suppressedBy?.length,reason:source.reason})) };
  }
  const effectActive = (scene,a,effect) => Boolean(activeState(scene,a?.id,effect).activeSources.length);
  const activeEffectSources = (a,effect,scene=null) => scene ? activeState(scene,a?.id,effect).activeSources : (a?.effectStates?.[effect]?.sources||[]).filter(source=>!(source.suppressedBy||[]).length);
  function effectInstanceStatus(scene, actorId, effect) { return activeState(scene,actorId,effect); }

  function turnStartStatus(scene, id) {
    const a = actor(scene, id), s = state(copy(scene));
    if (!live(a) || a.kind === "crowd" || String(a.profileId || "").includes(".modifier.")) return unavailable("Этот участник не может совершать Ход");
    if (scene.pendingAction || s.choices?.length || s.pausedChains?.length) return unavailable("Сначала завершите действие и ожидающие решения");
    if (scene.activeActorId) return unavailable("Сначала завершите текущий Ход");
    if(s.grantedTurns?.length)return s.grantedTurns[0].actorId===id?{available:true,reason:""}:unavailable("Сначала должен пройти предоставленный дополнительный Ход");
    const heroes = scene.actors.filter(x => live(x) && isPlayer(x)), enemies = scene.actors.filter(x => live(x) && x.team === "enemy" && x.kind !== "crowd" && !String(x.profileId || "").includes(".modifier."));
    const expected = s.lastTeam === "hero" && enemies.length ? "enemy" : heroes.length ? "hero" : "enemy";
    if (a.team !== expected) return unavailable(`Сейчас Ход ${expected === "hero" ? "героев" : "противников"}`);
    if (isPlayer(a) && a.acted || a.team === "enemy" && a.acted && enemies.some(x => !x.acted)) return unavailable("Этот участник уже ходил; выберите ещё не ходившего");
    if (effectActive(scene,a,"negative.подброшен") && Number(a.effectStates?.["negative.подброшен"]?.appliedTurnSerial??scene.turnSerial)>=Number(scene.turnSerial||0) && scene.actors.some(x => live(x) && x.id !== id && x.team === a.team && !x.acted && !effectActive(scene,x,"negative.подброшен"))) return unavailable("Сначала должен походить доступный союзник: участник Подброшен");
    return { available: true, reason: "" };
  }

  function roundEndStatus(scene) {
    const s = state(copy(scene));
    if (scene.activeActorId || scene.pendingAction || s.choices?.length || s.grantedTurns?.length || s.pausedChains?.length) return unavailable("Сначала завершите Ход и ожидающие решения");
    const heroes = scene.actors.filter(a => live(a) && isPlayer(a));
    if (heroes.some(a => !a.acted)) return unavailable("Не все герои совершили Ход");
    if (heroes.length && scene.actors.some(a => live(a) && a.team === "enemy" && a.kind !== "crowd") && s.lastTeam !== "enemy") return unavailable("После последнего героя должен походить противник");
    return s.started ? { available: true, reason: "" } : unavailable("Бой ещё не начат");
  }

  function movement(scene, a, destination, options = {}) {
    const board = scene.spaces.find(s => s.id === (destination?.space || a.space));
    if (!board || !Number.isInteger(destination?.x) || !Number.isInteger(destination?.y) || destination.x < 0 || destination.y < 0 || destination.x >= board.width || destination.y >= board.height) fail("Выберите клетку внутри поля");
    if (!options.placement && board.id !== a.space && !options.teleport) fail("Это движение не меняет пространство");
    if (!options.placement && !options.forced && (effectActive(scene,a,"negative.обездвижен") || effectActive(scene,a,"negative.подброшен") || effectActive(scene,a,"negative.пойман") && activeEffectSources(a,"negative.пойман",scene).some(s => live(actor(scene, s.actorId))&&!effectActive(scene,actor(scene,s.actorId),"positive.исчез")))) fail("Эффект запрещает добровольное движение");
    if (options.forced && effectActive(scene,a,"positive.устойчив")) fail("Устойчивость запрещает принудительное движение");
    const key = p => `${p.x},${p.y}`;
    const terrain = new Set([...scene.objects.filter(o => o.space === board.id && o.type === "terrain").flatMap(o => o.cells || []),...(scene.topology?.cuts||[]).filter(cut=>cut.space===board.id).flatMap(cut=>cut.cells||[])]);
    const difficult = new Set(scene.objects.filter(o => o.space === board.id && o.type === "difficult").flatMap(o => o.cells || []));
    const occupied = scene.actors.filter(x => x.id !== a.id && (!a.compoundId||x.compoundId!==a.compoundId) && x.space === board.id && live(x) && !effectActive(scene,x, "positive.исчез") && effectActive(scene,a,"positive.изгнан") === effectActive(scene,x,"positive.изгнан"));
    const blocked = p => !options.ignoreTerrain && terrain.has(key(p));
    const footprint = p => {
      const cells=[];
      for(let y=0;y<Number(options.height??a.occupiedHeight??1);y++)for(let x=0;x<Number(options.width??a.occupiedWidth??1);x++)cells.push({x:p.x+x,y:p.y+y});
      return cells;
    };
    const ignoredDifficult = new Set(scene.activeActorId && Number(a.lionwing?.difficultTerrainIgnoreSerial) === Number(scene.turnSerial) && a.lionwing?.difficultTerrainIgnoreSpace === board.id ? a.lionwing.difficultTerrainIgnoreCells || [] : []);
    const entersDifficult = p => !options.ignoreTerrain && !options.ignoreDifficultTerrain && footprint(p).some(cell => difficult.has(key(cell)) && !ignoredDifficult.has(key(cell)));
    const entersEnemySpace = p => !options.ignoreOpponents && board.mode === "cinematic" && footprint(p).some(cell => occupied.some(x => x.team !== a.team && x.x === cell.x && x.y === cell.y));
    const endsMovement = p => entersDifficult(p) || entersEnemySpace(p);
    if (blocked(destination) || board.mode !== "cinematic" && occupied.some(x => x.x === destination.x && x.y === destination.y)) fail("Клетка занята");
      if (options.placement || options.teleport) {if(options.teleport&&options.maximum!=null&&distance(a,{...destination,space:board.id})>options.maximum)fail("Телепортация выходит за дальность");return { cost: 0, path: [{ x: destination.x, y: destination.y }], space: board.id };}
    const maximum = integer(options.maximum ?? 99, "дальность", 999);
    const crossesWall = (from, to) => typeof wallBlocksStep === "function" && wallBlocksStep(scene, a.space, from, to);
    if (options.line) {
      const dx = destination.x - a.x, dy = destination.y - a.y;
      if (dx && dy && Math.abs(dx) !== Math.abs(dy)) fail("Нужна прямая ортогональная или диагональная Линия");
      const steps = Math.max(Math.abs(dx), Math.abs(dy)), cost = Math.abs(dx) + Math.abs(dy), path = [];
      if (!cost || cost > maximum) fail("Клетка вне дальности движения");
      let from = a, spent = 0;
      for (let i = 1; i <= steps; i++) {
        const point = { x: a.x + Math.sign(dx) * i, y: a.y + Math.sign(dy) * i };
        if (blocked(point) || crossesWall(from, point)) fail("Путь перекрыт препятствием");
        spent += Math.abs(point.x-from.x)+Math.abs(point.y-from.y);
        if(spent>maximum)fail("Клетка вне дальности движения");
        path.push(point); from = point;
        if(endsMovement(point))return { cost:spent,path,space:board.id,endedByDifficultTerrain:true };
      }
      return { cost, path, space: board.id };
    }
    const queue = [{ x: a.x, y: a.y, cost: 0, path: [] }], best = new Map([[key(a), 0]]);
    while (queue.length) {
      queue.sort((x, y) => x.cost - y.cost);
      const p = queue.shift();
      if (p.x === destination.x && p.y === destination.y) return { cost: p.cost, path: p.path, space: board.id, endedByDifficultTerrain: p.path.length > 0 && endsMovement(p) };
      if (p.path.length && endsMovement(p)) continue;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const q = { x: p.x + dx, y: p.y + dy }, foe = occupied.some(x => x.team !== a.team && x.x === q.x && x.y === q.y);
        const cost = p.cost + 1;
        if (q.x < 0 || q.y < 0 || q.x >= board.width || q.y >= board.height || blocked(q) || crossesWall(p, q) || foe && board.mode !== "cinematic" && !options.ignoreOpponents || cost > maximum || (best.get(key(q)) ?? Infinity) <= cost) continue;
        best.set(key(q), cost); queue.push({ ...q, cost, path: [...p.path, q] });
      }
    }
    fail("Нет доступного пути в пределах движения");
  }

  function actionStatus(scene, a, def, request = {}) {
    if (!live(a)) return unavailable("Участник выведен из боя");
    if (scene.pendingAction || state(copy(scene)).choices?.length) return unavailable("Сначала завершите текущую цепочку");
    if (def.type === "reaction") return unavailable("Реакция доступна при соответствующем событии");
    const allowance=(a.lionwing?.allowances||[]).find(item=>item.actionId===def.id&&item.remaining>0);
    const breakout = request.breakout === true;
    if (breakout) {
      if (!scene.lionwing?.breakout || scene.lionwing.breakout.actorId === a.id || attacks.has(def.id)) return unavailable("Прорыв: только не-Атака после чужого Хода");
      if (Number(a.influence || 0) < 1) return unavailable("Для Прорыва нужно 1 Влияние");
    } else if (scene.activeActorId !== a.id && !allowance?.reaction) return unavailable("Сейчас не Ход этого участника");
    const swift = breakout || Boolean(allowance?.swift||allowance?.reaction) || !isPlayer(a) && def.id === ids.step;
    const continuation = def.id === ids.step && Number(a.stepRemaining || 0) > 0 && !breakout;
    if (continuation) return { available: true, reason: "", cost: 0, resource: "ap", continuation: true };
    const used = isPlayer(a) ? (a.usedActions || []) : (a.lionwing?.turnActions || []);
    if (!swift && used.includes(def.id)) return unavailable("Действие уже использовано");
    const cost = breakout ? 0 : allowance?.cost??(def.id === "action.атаки.дуэль" ? Math.max(1, 4 - Number(scene.tension || 0)) : def.id===ids.improvise&&request.removeObstacleId?1:def.cost.amount);
    if (!canSpend(a,def.cost.resource,cost)) return unavailable(`Недостаточно ${def.cost.resource === "ap" ? "ОД" : "ресурса"}: нужно ${cost}`);
    if (def.id === ids.disappear) {
      const board = scene.spaces.find(b => b.id === a.space);
      if (!board || ![0, board.width - 1].includes(a.x) && ![0, board.height - 1].includes(a.y) || a.lionwing?.startedDisappeared) return unavailable("Скрыться можно на краю поля, если Ход начат без Исчезновения");
    }
    return { available: true, reason: "", cost, resource: def.cost.resource, swift,allowanceId:allowance?.id };
  }

  function roll(count, random = Math.random, options = {}) {
    const critAt=options.critAt??6,explode=options.kind==="raw-d6"?false:options.explode!==false;if(![5,6].includes(critAt))fail("Критический успех: 5+ или 6");
    integer(count, "число костей", 100);
    const rolls = [], queue = Array(count).fill(0);
    while (queue.length) {
      queue.pop();
      if (rolls.length >= 300) fail("Слишком длинная цепочка критов; повторите бросок");
      const die = 1 + Math.floor(random() * 6);
      if (die < 1 || die > 6) fail("Некорректный источник случайности");
      rolls.push(die); if (explode && die >= critAt) queue.push(0);
    }
    return foundations.normalizeRoll({ initialCount: count, sourceFaces: rolls }, { kind: options.kind || "check", criticalAt: critAt, successAt: options.successAt ?? 4, explode });
  }

  function validateRoll(value) {
    return foundations.normalizeRoll(value, { kind: value?.kind || "check", criticalAt: value?.rules?.criticalAt ?? value?.critAt ?? 6, successAt: value?.rules?.successAt ?? 4, explode: value?.rules?.explode ?? value?.explode !== false, modifications: value?.modifications || [] });
  }

  function costQuote(scene, actorId, costs, targets = []) {
    const a = requiredActor(scene, actorId, false);
    const reservation = foundations.reserveCost(Number(scene.version || 0), a.id, targetIds(scene, targets), costs);
    const resolved = reservation.costs.map(part => {
      if (part.kind === "health") {
        if (Number(a.hp || 0) < part.amount) fail(`Недостаточно Здоровья: нужно ${part.amount}, доступно ${Number(a.hp || 0)}`);
        return { ...part, requestedResource: "hp", resource: "hp" };
      }
      const resource = resourceKey(a, part.resource), inverted = part.resource === "focus" && a.ruleResources?.[resource]?.inverted === true;
      return { ...part, requestedResource: part.resource, resource, direction: inverted ? "increase" : "decrease" };
    });
    const totals = new Map();
    for (const part of resolved) {
      const key = JSON.stringify(part.kind === "health" ? ["decrease", "hp"] : [part.direction, part.resource]);
      totals.set(key, (totals.get(key) || 0) + part.amount);
    }
    for (const [key, total] of totals) {
      const [direction, resource] = JSON.parse(key);
      if (resource === "hp") { if (Number(a.hp || 0) < total) fail(`Недостаточно Здоровья: нужно ${total}, доступно ${Number(a.hp || 0)}`); continue; }
      const current = balance(a, resource), definition = a.ruleResources?.[resource];
      if (direction === "decrease" && current < total) fail(`Недостаточно ${resource}: нужно ${total}, доступно ${current}`);
      if (direction === "increase" && definition?.maximum != null && current + total > definition.maximum) fail(`Цена превышает максимум ${resource}`);
    }
    return { ...reservation, costs: resolved };
  }

  function historyStatus(scene, query) {
    const history = state(copy(scene)).history;
    return { count: foundations.historyCount(history, query), facts: copy(history.filter(item => foundations.inScope(item, query))) };
  }

  function turnIdentity(scene, actorId) {
    const snapshot = copy(scene), s = state(snapshot), target = actor(snapshot, actorId);
    if (!target) return null;
    const serialValue = ownTurnSerial(target);
    const active = snapshot.activeActorId === target.id;
    return {
      actorId: target.id,
      ownerTurnSerial: serialValue,
      turnCount: serialValue,
      turnsStarted: serialValue,
      ownerTurnKey: ownerTurnKey(s.sceneSerial, target, serialValue),
      active,
      // Keep the latest own instance available after the Turn has ended; the
      // active ID is the same value while this participant is currently up.
      turnInstanceId: active ? s.activeTurnInstanceId || target.lionwing?.turnInstanceId || null : target.lionwing?.turnInstanceId || target.lionwing?.lastTurnInstanceId || null,
      sceneTurnSerial: active ? Number(snapshot.turnSerial || 0) : null,
      kind: active ? s.activeTurn?.kind || "normal" : null,
    };
  }

  function lifetimeExpired(scene, lifetime, query = {}) {
    const snapshot = copy(scene), s = state(snapshot), owner = actor(snapshot, query.ownerActorId || query.actorId || lifetime?.ownerActorId);
    const current = {
      ...query,
      sceneSerial: query.sceneSerial ?? s.sceneSerial,
      ownerActorId: query.ownerActorId ?? query.actorId ?? owner?.id ?? null,
      ownerTurnSerial: query.ownerTurnSerial ?? (owner ? ownTurnSerial(owner) : null),
      ownerTurnInstanceId: query.ownerTurnInstanceId ?? (snapshot.activeActorId === owner?.id ? s.activeTurnInstanceId || null : null),
    };
    return foundations.lifetimeExpired(lifetime, current);
  }

  function diceCount(scene, a, def, request) {
    let attribute = request.attribute || (def.id === ids.skirmish ? (Number(a.attrs.body) >= Number(a.attrs.talent) ? "body" : "talent") : "spirit");
    if (!attributes.has(attribute) || def.id === ids.skirmish && !["body", "talent"].includes(attribute) || [ids.charge, ids.spell].includes(def.id) && attribute !== "spirit") fail("Недопустимый Атрибут для действия");
    const bonus = def.id === ids.charge ? Number(scene.tension || 0) : def.id === ids.finish ? Number(request.focusSpent || 0) : 0;
    const advantage=integer(request.advantage||0,"Преимущество",100),disadvantage=integer(request.disadvantage||0,"Помеха",100);
    return Math.max(0, Number(a.attrs[attribute] || 0) + bonus + advantage - disadvantage);
  }

  function attackPools(scene,a,def,p){
    const base=diceCount(scene,a,def,p),targets=p.targetIds||[];
    if(!attacks.has(def.id)||!targets.length)return{base,counts:{}};
    const taunts=activeEffectSources(a,"negative.спровоцирован",scene).map(x=>x.actorId),fears=activeEffectSources(a,"negative.испуган",scene).map(x=>x.actorId);
    const counts=Object.fromEntries(targets.map(id=>[id,Math.max(0,base-(effectActive(scene,a,"negative.спровоцирован")&&!targets.some(t=>taunts.includes(t))?a.tier:0)-(effectActive(scene,a,"negative.испуган")&&fears.includes(id)?a.tier:0)+((p.spikeTargetIds||[]).includes(id)&&effectActive(scene,actor(scene,id),"negative.подброшен")?a.tier:0))]));
    return{base:Math.min(...Object.values(counts)),counts};
  }

  function prepare(scene, request, options = {}) {
    try {
      const payload = copy(request), a = ["scene-reset","round-end","tension","note"].includes(payload.kind)&&!payload.actorId?null:requiredActor(scene, payload.actorId, !["choice", "correct", "resolve-attack", "cancel-attack", "batch"].includes(payload.kind));
      delete payload.actorId;
      if (payload.kind === "action") {
        const def = actionDef(payload.actionId);
        if (!def) fail("Базовое действие не найдено");
        const status = actionStatus(scene, a, def, payload);
        if (!status.available) fail(status.reason);
        if ([ids.charge, ids.spell, ids.skirmish, ids.finish].includes(def.id) && !payload.roll){const pools=attackPools(scene,a,def,payload);payload.roll=roll(pools.base,options.random);payload.targetRolls={};for(const[id,count]of Object.entries(pools.counts))if(count>pools.base)payload.targetRolls[id]=roll(count-pools.base,options.random);}
      }
      const preparedOperations=["plan","batch"].includes(payload.kind)?payload.operations:[payload];
      if(Array.isArray(preparedOperations))for(const operation of preparedOperations.filter(item=>item?.kind==="geometry-move"&&!item.geometryPlan)){
        const targetId=operation.targetId||a?.id,geometry=global.DAWN_LIONWING_GEOMETRY;
        if(!geometry?.routePlan)fail("Планировщик геометрии недоступен");
        const sourceActorId=operation.sourceActorId||a?.id;
        const planned=geometry.routePlan(scene,{sourceActorId,actorId:targetId,anchor:operation.anchor||{kind:"actor",actorId:sourceActorId},destination:operation.destination,maximum:operation.maximum,mode:operation.mode||"move",straight:operation.straight===true,allowPartial:operation.allowPartial===true,ignoreTerrain:operation.ignoreTerrain===true,ignoreEnemies:operation.ignoreEnemies===true,width:operation.width,height:operation.height});
        if(!planned.available)fail(planned.reason);operation.geometryPlan=planned.plan;
      }
      if (payload.kind === "plan" && !payload.reservation) payload.reservation = costQuote(scene, a.id, payload.costs, payload.targetIds || []);
      if (payload.kind === "roll" && !payload.roll) payload.roll = roll(integer(payload.count, "число костей", 100), options.random, { ...payload, kind: payload.rollKind || "check" });
      if (payload.kind === "reaction" && payload.choice === "clash" && !payload.roll) {
        const source = requiredActor(scene, scene.pendingAction?.actorId);
        payload.roll = roll(3 + Number(a.tier || 1), options.random);
        payload.opponentRoll = roll(3 + Number(source.tier || 1), options.random);
      }
      if(payload.kind==="choice"&&payload.choice==="reroll"&&scene.lionwing?.choices?.[0]?.kind==="clash-loss"){
        const source=requiredActor(scene,scene.pendingAction?.actorId);
        payload.roll=roll(3+Number(a.tier||1),options.random);payload.opponentRoll=roll(3+Number(source.tier||1),options.random);
      }
      if(payload.kind==="punish"&&!payload.roll)payload.roll=roll(Math.max(Number(a.attrs.body||0),Number(a.attrs.talent||0)),options.random);
      const events = [{ ...command(a?.id||null, payload), id: global.crypto?.randomUUID?.() || `lw-${Date.now()}-${Math.random().toString(36).slice(2)}` }], preview = previewEvents(scene, events);
      return preview.ok ? { ...preview, events } : preview;
    } catch (error) { return { ok: false, errors: [error.message] }; }
  }

  // Operations use typed data, stable source ids, and explicit phase lifetimes.
  // Techniques may compose these operations without registering imperative code.
  function execute(scene, event, output) {
    const s = state(scene), rootId = event.id, emitted = [];
    const scheduled = [];
    let frameSerial = 0, choiceSerial = 0, historySerial = 0, provenance = null;
    let executionCursor = s.executionCursor ? foundations.openCursor(s.executionCursor) : null, completedSteps = 0, completedResults = [];
    const cursorSource = items => {
      const item = (items || []).find(entry => entry?.provenance?.rootActionId || entry?.__execution?.rootActionId || entry?.p?.__execution?.rootActionId || entry?.sourceId || entry?.p?.sourceActorId);
      const source = item?.provenance || item?.__execution || item?.p?.__execution || {};
      const ownerActorId = source.ownerActorId || item?.sourceId || item?.p?.sourceActorId || event.actorId || "scene";
      if (typeof ownerActorId !== "string" || !ownerActorId) return null;
      return { source, ownerActorId };
    };
    const setCursor = (items, processed, waitingChoiceId = null) => {
      const pending = Array.isArray(items) ? items.length : 0;
      const source = cursorSource(items) || cursorSource([{ provenance }]) || (executionCursor ? { source: executionCursor, ownerActorId: executionCursor.ownerActorId } : null);
      if (!pending && executionCursor && waitingChoiceId == null) {
        executionCursor = null;
        delete s.executionCursor;
        return;
      }
      if (!source && !executionCursor) fail("Невозможно сохранить продолжение без владельца");
      const meta = {
        id: `${source.source.rootActionId || rootId}:cursor`,
        rootActionId: source.source.rootActionId || rootId,
        actionId: source.source.actionId || null,
        actionInstanceId: source.source.actionInstanceId || source.source.rootActionId || rootId,
        ownerActorId: source.ownerActorId,
        responderActorId: waitingChoiceId ? s.choices.find(choice => choice.id === waitingChoiceId)?.actorId || source.ownerActorId : source.ownerActorId,
        cursor: processed,
        total: processed + pending,
        results: completedResults,
        status: waitingChoiceId ? "waiting" : processed + pending ? "running" : "completed",
        ...(waitingChoiceId ? { waitingChoiceId } : {}),
      };
      executionCursor = executionCursor
        ? foundations.resizeCursor(executionCursor, Math.max(executionCursor.total, executionCursor.cursor + pending))
        : foundations.openCursor(meta);
      if (waitingChoiceId && executionCursor.status === "running") executionCursor = foundations.waitCursor(executionCursor, waitingChoiceId, meta.responderActorId);
      else if (waitingChoiceId && executionCursor.status === "waiting" && executionCursor.waitingChoiceId === waitingChoiceId) executionCursor = foundations.openCursor({ ...executionCursor, responderActorId: meta.responderActorId });
      s.executionCursor = executionCursor;
    };
    const completeStep = (item, status = "completed") => {
      if (!executionCursor) { completedResults.push({ index: completedSteps, status, stepId: item?.stepId || null }); completedSteps++; return; }
      executionCursor = foundations.resizeCursor(executionCursor, Math.max(executionCursor.total, executionCursor.cursor + 1));
      executionCursor = foundations.advanceCursor(executionCursor, { status, stepId: item?.stepId || null });
      s.executionCursor = executionCursor;
    };
    const saveFact = (type, actorId, targetIds, details = {}, context = provenance) => {
      if (!context?.rootActionId) return;
      const activeTurnOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null;
      const activeOwnerSerial = activeTurnOwner ? ownTurnSerial(activeTurnOwner) : null;
      const fact = foundations.fact(type, {
        id: `${rootId}:history:${historySerial++}`,
        ...context,
        ownerActorId: context.ownerActorId || actorId,
        actorId:actorId??null,
        targetIds,
        round: Number(scene.round || 0),
        turnSerial: Number(scene.turnSerial || 0),
        turnInstanceId:s.activeTurnInstanceId||null,
        ownerTurnActorId: scene.activeActorId || null,
        ownerTurnSerial: activeOwnerSerial,
        ownerTurnInstanceId: s.activeTurnInstanceId || null,
        ownerTurnKey: activeTurnOwner ? ownerTurnKey(s.sceneSerial, activeTurnOwner, activeOwnerSerial) : null,
        sceneSerial: s.sceneSerial,
        chapterSerial: s.chapterSerial,
      }, details);
      s.history.push(fact);
    };
    const emit = (type, actorId, payload = {}) => {
      const row = { id: `${rootId}:${emitted.length}`, at: event.at, type, actorId: actorId || null, payload: copy(payload), visibility: event.visibility || "public" };
      if (provenance) row.execution = copy(provenance);
      emitted.push(row); scene.log.unshift(row); scene.log = scene.log.slice(0, 200);
      const targets = payload.targetIds || (payload.targetId ? [payload.targetId] : []);
      if (type === "action.resolve") saveFact("apply", actorId, targets, { actionId: payload.actionId, manual: payload.manual === true }, { ...provenance, actionId: payload.actionId || provenance?.actionId, ownerActorId: actorId });
      else if (type === "damage.apply") {
        if (payload.attack && payload.hit !== false) saveFact("hit", actorId, targets, { planned: payload.raw, zeroDamage: payload.dealt === 0 });
        saveFact("damage", actorId, targets, { planned: payload.raw, actual: payload.dealt, hit: payload.hit !== false, ignored: payload.ignored === true });
        if (payload.healthLost > 0) saveFact("healthLoss", actorId, targets, { requested: payload.raw, actual: payload.healthLost, mode: "damage" });
      } else if (type === "health.spend" || type === "health.lose") saveFact("healthLoss", actorId, targets, { requested: payload.requested, actual: payload.lost, mode: type.endsWith("spend") ? "spend" : "lose" });
      else if (type === "actor.heal") saveFact(payload.prevented ? "preventedGain" : "heal", actorId, targets, { requested: payload.amount, actual: payload.restored });
      else if (type === "actor.wound") saveFact("wound", actorId, targets, { track: "wounds", total: payload.total });
      else if (type === "actor.knockout") saveFact("knockout", actorId, targets, { cause: payload.cause || null });
      else if (type === "resource.spend") saveFact("spend", actorId, targets, { requestedResource: payload.requestedResource || payload.resource, resource: payload.resource, requested: payload.requestedAmount ?? payload.amount, actual: payload.amount });
      else if (type === "resource.gain") saveFact(payload.prevented ? "preventedGain" : "gain", actorId, targets, { requestedResource: payload.requestedResource || payload.resource, resource: payload.resource, requested: payload.requestedAmount ?? payload.amount, actual: payload.amount });
      else if (type === "roll.public") saveFact("roll", actorId, targets, { kind: payload.kind, pool: payload.pool, hits: payload.hits, criticals: payload.criticals });
      else if (type === "rule.used") saveFact("apply", actorId, targets, { scope: payload.scope }, { ...provenance, ruleId: payload.ruleId, ownerActorId: actorId });
      else if (type === "counter.threshold") saveFact("counter.threshold", actorId, targets, { counterId: payload.counterId || payload.id, kind: payload.kind || payload.type, before: payload.before, value: payload.value, threshold: payload.threshold });
      else if (type === "attack.clear" && payload.cancelled) saveFact("cancel", actorId, targets, { reason: payload.reason || "cancelled" });
      return row;
    };
    const mutateCounter = (p, sourceId, forcedType = null, forcedOperation = null) => {
      const a = sourceId ? requiredActor(scene, sourceId, false) : null;
      if (!a) fail("Счётчику нужен владелец-участник");
      const type = forcedType || p.type;
      if (!["clock", "resource"].includes(type)) fail("Укажите тип счётчика: clock или resource");
      const collection = type === "clock" ? (a.ruleClocks ||= {}) : (a.ruleResources ||= {});
      const id = String(p.id || "");
      if (!counterIdPattern.test(id) || ["constructor", "prototype", "__proto__"].includes(id)) fail("Некорректный ID счётчика");
      const previousRaw = Object.hasOwn(collection, id) ? collection[id] : null;
      const exists = previousRaw !== null;
      let operation = forcedOperation || p.operation;
      if (!operation && forcedType === "clock") operation = p.delta !== undefined ? "add" : (exists ? "set" : "create");
      if (!operation && forcedType === "resource") operation = exists ? "configure" : "create";
      if (!["create", "configure", "set", "add", "reset", "rename", "remove", "size"].includes(operation)) fail("Неизвестная операция счётчика");
      if (operation === "remove") {
        if (!exists) fail("Счётчик не найден");
        const before = copy(previousRaw);
        delete collection[id];
        emit(`rule-${type}.remove`, sourceId, { id, kind: type, ownerActorId: a.id, before });
        return;
      }
      if (operation === "rename") {
        if (!exists) fail("Счётчик не найден");
        const label = counterString(p.label !== undefined ? p.label : p.name, "название счётчика", 120), before = previousRaw.label ?? previousRaw.name ?? id;
        previousRaw.label = label; previousRaw.name = label;
        emit(`rule-${type}.rename`, sourceId, { id, kind: type, ownerActorId: a.id, before, name: label });
        return;
      }
      if (operation === "size" && type !== "clock") fail("Размер применим только к часам");
      if (operation === "size" && p.size === undefined) fail("Укажите размер часов");
      if (operation === "size" && p.size !== undefined) strictCounterInteger(p.size, "размер часов", 1, 100);
      if (operation === "set" && p.current === undefined && p.value === undefined) fail("Укажите текущее значение счётчика");
      if (operation === "add" && (typeof p.delta !== "number" || !Number.isSafeInteger(p.delta) || Math.abs(p.delta) > 9999)) fail("Некорректное изменение счётчика");
      if (["set", "add", "reset", "size"].includes(operation) && !exists) fail("Счётчик не найден");
      if (operation === "create" && exists) fail("Счётчик с таким ID уже существует");
      if ((operation === "create" || operation === "configure") && type === "resource" && p.replaces !== undefined && p.replaces !== null && p.replaces !== "focus") fail("Можно заменить только Фокус");
      if ((operation === "create" || operation === "configure") && type === "resource" && p.replacesAp !== undefined && typeof p.replacesAp !== "boolean" || (operation === "create" || operation === "configure") && type === "resource" && p.inverted !== undefined && typeof p.inverted !== "boolean") fail("Некорректный флаг ресурса");
      const source = previousRaw;
      const payload = operation === "add" ? { ...p, current: (source?.current ?? source?.value ?? 0) + p.delta } : operation === "reset" ? { ...p, current: source?.initial ?? 0 } : operation === "size" ? { ...p, max: p.size } : operation === "create" && p.delta !== undefined && p.current === undefined && p.value === undefined ? { ...p, current: (p.initial ?? 0) + p.delta } : p;
      if (operation === "add" && (!Number.isSafeInteger(payload.current))) fail("Некорректное текущее значение счётчика");
      if (operation === "size" && source && Number(source.current ?? source.value ?? 0) > p.size) fail("Новый размер меньше текущего значения");
      const next = counterDefinition(scene, a, type, id, payload, previousRaw, sourceId);
      const before = exists ? Number(previousRaw.current ?? previousRaw.value ?? 0) : null;
      if (operation === "create") {
        if (Object.keys(collection).length >= 30) fail(`У участника уже 30 ${type === "clock" ? "часов" : "ресурсов"}`);
      }
      if (type === "resource" && (operation === "create" || operation === "configure")) {
        if (next.replacesAp && Object.entries(collection).some(([otherId, def]) => otherId !== id && def?.replacesAp)) fail("ОД уже заменены другим ресурсом");
        if (next.replaces === "focus" && Object.entries(collection).some(([otherId, def]) => otherId !== id && def?.replaces === "focus")) fail("Фокус уже заменён другим ресурсом");
      }
      collection[id] = next;
      const eventOperation = operation === "configure" ? "configure" : operation;
      emit(`rule-${type}.${eventOperation}`, sourceId, { id, kind: type, ownerActorId: next.ownerActorId, sourceActorId: next.sourceActorId, sourceEntityId: next.sourceEntityId, ruleId: next.ruleId, before, value: next.current, current: next.current, initial: next.initial, min: next.min, max: next.max, scope: next.scope, lifetime: next.lifetime, ...(operation === "rename" ? { name: next.name } : {}) });
      if (["set", "add"].includes(operation) && before != null && next.threshold != null && before < next.threshold && next.current >= next.threshold) emit("counter.threshold", sourceId, { counterId: id, id, kind: type, ownerActorId: next.ownerActorId, sourceActorId: next.sourceActorId, sourceEntityId: next.sourceEntityId, ruleId: next.ruleId, before, value: next.current, threshold: next.threshold });
    };
    const removeEffect = (a, effect, options={}) => {
      const wasDisappeared=effect==="positive.исчез"&&has(a,effect);
      if (!effectIds.has(effect)) fail("Неизвестный Эффект LionWing");
      const parts=a.compoundId?scene.actors.filter(x=>x.compoundId===a.compoundId):[a];
      for(const part of parts){
        const saved=part.effectStates?.[effect], sources=saved?.sources||[];
        if(!has(part,effect)&&!sources.length)continue;
        const selected=options.sourceId?sources.filter(source=>(source.sourceId||source.actorId)===options.sourceId):sources;
        if(options.manual===true&&selected.some(source=>source.removable===false))fail("Этот источник Эффекта нельзя снять вручную");
        const remaining=options.sourceId?sources.filter(source=>(source.sourceId||source.actorId)!==options.sourceId):[];
        if(options.sourceId&&!selected.length)fail("Источник Эффекта не найден");
        if(remaining.length){saved.sources=remaining;if(remaining.some(source=>!(source.suppressedBy||[]).length))part.effects=[...new Set([...(part.effects||[]),effect])];else part.effects=(part.effects||[]).filter(item=>item!==effect);emit("effect.source.remove",part.id,{targetId:part.id,effect,sourceId:options.sourceId});continue;}
        part.effects=part.effects.filter(e=>e!==effect);
        if(part.effectStates)delete part.effectStates[effect];
        if(part.lionwing?.effectLifetimes)delete part.lionwing.effectLifetimes[effect];
        emit("effect.remove",part.id,{targetId:part.id,effect,sourceId:options.sourceId||null});
      }
      if(wasDisappeared&&!has(a,effect)&&options.reappear!==false)choice(a,"placement","Выберите клетку появления вне соседства с персонажами",["place"],{reappear:true});
    };
    const choice = (a, kind, title, options, context = {}) => { s.choices.push({ id: `${rootId}:choice:${choiceSerial++}`, actorId: a.id, kind, title, options, context }); };
    const duelOutcome = duel => choice(requiredActor(scene,duel.actorId,false),"duel-outcome","Дуэль: разыграйте встречную Проверку. NPC бросает [Напряжение Дуэли + Ступень]; бросок игрока согласуйте с Нарратором. Подходы и Напряжение определяет Нарратор.",["win","lose"],{duelId:duel.id});
    const duelReturn = duel => {
      scene.activeSpace=duel.returnSpaceId;
      for(const targetId of [duel.actorId,duel.targetId]){
        const participant=requiredActor(scene,targetId,false);
        choice(requiredActor(scene,duel.actorId,false),"placement","Дуэль: выберите клетку края для "+participant.name,["place"],{targetId,returnSpaceId:duel.returnSpaceId,duelId:duel.id,edge:true});
      }
    };
    const duelStake = (duel,loserId) => {
      const loser=requiredActor(scene,loserId,false);duel.loserId=loserId;
      if(isPlayer(loser))queue.unshift({p:{kind:"wound",targetId:loserId,sourceActorId:loserId===duel.actorId?duel.targetId:duel.actorId},sourceId:duel.actorId},{p:{kind:"duel-return",duelId:duel.id},sourceId:duel.actorId});
      else queue.unshift({p:{kind:"damage",targetId:loser.id,amount:duel.tension*2+loser.tier*5,sourceActorId:loserId===duel.actorId?duel.targetId:duel.actorId},sourceId:duel.actorId},{p:{kind:"duel-return",duelId:duel.id},sourceId:duel.actorId});
    };
    const knockout = (a, cause = null) => {
      if (a.knockedOut) return;
      a.knockedOut = true; a.ap = 0; a.stepRemaining = 0; s.grantedTurns=(s.grantedTurns||[]).filter(turn=>turn.actorId!==a.id);
      if (scene.activeActorId === a.id) { scene.activeActorId = null; a.acted = true; s.lastTeam = a.team; s.lastActorId = a.id; }
      if (!s.lowTension) scene.tension = Number(scene.tension || 0) + 1;
      // Source loss is policy driven. The default `disable` keeps the aura in
      // saved state; only an explicitly configured `remove` policy deletes it.
      for(const aura of [...s.auras])if(aura.sourceLossPolicy==="remove"&&(aura.sourceEntityId===a.id||aura.ownerActorId===a.id))removeAuraRecord(aura,"removed",a.id);
      for (const other of scene.actors) for (const e of ["negative.испуган", "negative.спровоцирован"]) {
        const saved=other.effectStates?.[e];
        if(!saved?.sources?.some(source=>source.actorId===a.id))continue;
        for(const source of [...saved.sources].filter(source=>source.actorId===a.id))
          removeEffect(other,e,{sourceId:source.sourceId||source.actorId,manual:false});
      }
      const knockoutSource=cause&&Object.hasOwn(cause,"sourceActorId")?cause.sourceActorId:a.id;
      emit("actor.knockout", knockoutSource, { targetId: a.id, cause: cause ? { kind: cause.kind || "rule", sourceActorId: cause.sourceActorId ?? null, eventId: cause.eventId || rootId } : null });
      if (isPlayer(a) && astate(a).vulnerable) {
        for (const hero of scene.actors.filter(isPlayer)) hero.influence = Number(hero.influence || 0) + 3;
        choice(a, "consequence", "Выберите длительное последствие по правилу Уязвимости", ["record"], {});
      }
    };
    const wound = (a, sourceId, track = "wounds") => {
      if (!isPlayer(a)) { applyDamage({ targetId: a.id, amount: 10, irreducible: true, sourceActorId: sourceId }); return; }
      a[track] = Number(a[track] || 0) + 1;
      if (track === "wounds") a.hp = a.maxHp;
      if (sourceId !== a.id && !astate(a).vulnerable) a.influence = Number(a.influence || 0) + 1;
      emit(track === "wounds" ? "actor.wound" : "actor.stress", sourceId, { targetId: a.id, delta: 1, total: a[track], hp: a.hp });
      if (a[track] >= 3) {
        a[track] = 2;
         if (astate(a).vulnerable) knockout(a, { kind: track, sourceActorId: sourceId });
        else choice(a, "knockout", "Выведение из боя: Сопротивляться или принять?", ["resist", "accept"], { track });
      }
    };
    const applyEffect = (a, p, sourceId) => {
      if (!effectIds.has(p.effect)) fail("Неизвестный Эффект LionWing");
      if (p.duration && typeof p.duration === "string" && p.duration !== "default" && !lifetimes.has(p.duration)) fail("Неизвестный срок Эффекта");
      if (p.duration && typeof p.duration === "object") foundations.normalizeLifetime(p.duration, { ownerActorId: p.ownerActorId || p.boundaryOwnerId || a.id, ownerTurnSerial: ownTurnSerial(actor(scene, p.ownerActorId || p.boundaryOwnerId) || a), sceneSerial: s.sceneSerial });
      if (p.lifetime != null) foundations.normalizeLifetime(p.lifetime, { ownerActorId: p.ownerActorId || p.boundaryOwnerId || a.id, ownerTurnSerial: ownTurnSerial(actor(scene, p.ownerActorId || p.boundaryOwnerId) || a), sceneSerial: s.sceneSerial });
      const original = { ...copy(p), kind: "effect", targetId: a.id, sourceActorId: sourceId };
      const consequenceId = `${rootId}:consequence:${frameSerial++}`;
      const identity = { id: consequenceId, rootActionId: provenance?.rootActionId || rootId, actionId: provenance?.actionId || p.sourceActionId || null, actionDefinitionId:provenance?.actionDefinitionId||provenance?.actionId||p.sourceActionId||null, actionInstanceId:provenance?.actionInstanceId||provenance?.rootActionId||rootId, effectInstanceId: p.effectInstanceId || `${consequenceId}:effect`, causeEventId: provenance?.causeEventId || rootId, ownerActorId: a.id };
      // Gather eligibility when the frame reaches the head, after earlier choices.
      scheduled.push({ p: { kind: "execution-frame", frame: global.DAWN_LIONWING_EXECUTION.open(original, identity) }, sourceId });
    };
    const commitEffect = (a, p, sourceId) => {
      if (!effectIds.has(p.effect)) fail("Неизвестный Эффект LionWing");
      const duration = p.duration && typeof p.duration === "string" && p.duration!=="default" ? p.duration : (persistent.has(p.effect) ? "scene" : p.effect === "positive.изгнан" ? "startTurn" : a.compoundId?"roundEnd":"default");
      if (!lifetimes.has(duration)) fail("Неизвестный срок Эффекта");
      const boundaryOwnerId = p.ownerActorId || p.boundaryOwnerId || a.id;
      const boundaryOwner = actor(scene, boundaryOwnerId) || a;
      const boundaryOwnerTurnInstanceId = scene.activeActorId === boundaryOwner.id ? s.activeTurnInstanceId || null : null;
      const explicitLifetime = p.lifetime ?? (p.duration && typeof p.duration === "object" ? p.duration : null);
      const lifetimeName = typeof explicitLifetime === "string" ? explicitLifetime : duration;
      const boundaryName = lifetimeName === "startTurn" || lifetimeName === "nextTurn" || lifetimeName === "startNextOwnerTurn"
        ? "startNextOwnerTurn"
        : lifetimeName === "endTurn" || lifetimeName === "default" || lifetimeName === "endNextOwnerTurn" ? "endNextOwnerTurn" : null;
      const lifetime = explicitLifetime && typeof explicitLifetime === "object"
        ? foundations.normalizeLifetime(explicitLifetime, { ownerActorId: boundaryOwnerId, ownerTurnSerial: ownTurnSerial(boundaryOwner), ownerTurnInstanceId: boundaryOwnerTurnInstanceId, sceneSerial: s.sceneSerial })
        : boundaryName ? foundations.lifetimeBoundary(boundaryName, { ownerActorId: boundaryOwnerId, ownerTurnSerial: ownTurnSerial(boundaryOwner), ownerTurnInstanceId: boundaryOwnerTurnInstanceId, sceneSerial: s.sceneSerial }) : null;
      if (p.effect === "positive.изгнан") for (const other of scene.actors) if (other.id !== a.id && (!a.compoundId||other.compoundId!==a.compoundId) && (other.effectStates?.[p.effect]?.sources || []).some(source => source.actorId === sourceId)) removeEffect(other, p.effect);
      a.effects = [...new Set([...(a.effects || []), p.effect])];
      a.effectStates ||= {};
      const sourceKey=p.sourceId||sourceId||`${rootId}:source`;
      const previousSources=(a.effectStates[p.effect]?.sources||[]).filter(item=>(item.sourceId||item.actorId)!==sourceKey);
      const source={sourceId:sourceKey,actorId:sourceId||null,actionId:p.sourceActionId||provenance?.actionId||null,actionInstanceId:provenance?.actionInstanceId||null,eventId:rootId,appliedSerial:Number(scene.turnSerial||0),appliedRound:Number(scene.round||0),duration,lifetime,ownerActorId:boundaryOwnerId,ownerTurnSerial:ownTurnSerial(boundaryOwner),removable:p.removable!==false,sourceBound:p.sourceBound!==false,suppressedBy:[]};
      a.effectStates[p.effect] = { duration, lifetime, removable: previousSources.concat(source).every(item=>item.removable!==false), appliedTurnSerial: Number(scene.turnSerial || 0), appliedRound: scene.round, appliedEventId: rootId, sources: [...previousSources,source] };
      astate(a).effectLifetimes ||= {};
      astate(a).effectLifetimes[p.effect] = { ownerActorId: boundaryOwnerId, duration, lifetime, appliedSerial: Number(scene.turnSerial || 0), ownerTurnSerial: ownTurnSerial(boundaryOwner), appliedRound: scene.round };
      emit("effect.apply", sourceId, { targetId: a.id, effect: p.effect, duration, sourceId:sourceKey,removable:source.removable });
      if(a.compoundId&&!p.compoundCopy)for(const part of scene.actors.filter(x=>x.id!==a.id&&x.compoundId===a.compoundId))commitEffect(part,{...p,compoundCopy:true,duration},sourceId);
      if (p.effect === "negative.пойман" && !p.compoundCopy && !p.preventForcedMovement && !effectActive(scene,a,"positive.устойчив") && sourceId && distance(a, requiredActor(scene, sourceId)) > 1) choice(a, "placement", "Пойман: выберите клетку рядом с источником", ["place"], { adjacentTo: sourceId, forced: true });
    };
    const auraOperatorAllowed = (aura, p, sourceId, authorityId=sourceId) => {
      // The event actor is the authority boundary.  A payload's sourceActorId
      // or narrator-looking flag cannot turn a player request into a narrator
      // operation; a null event actor is the established narrator channel.
      if(authorityId==null)return true;
      if(authorityId!==aura.ownerActorId)fail("Операция с аурой доступна только её владельцу или Нарратору");
      return true;
    };
    const removeAuraRecord = (aura, reason="removed", sourceId=null) => {
      const index=s.auras.findIndex(item=>item.id===aura.id);
      if(index<0)return false;
      s.auras.splice(index,1);
      emit(reason==="expired"?"aura.expire":"aura.remove",sourceId||aura.ownerActorId,{auraId:aura.id,id:aura.id,ownerActorId:aura.ownerActorId,sourceEntityId:aura.sourceEntityId,effectId:aura.effectId,ruleId:aura.ruleId,reason});
      return true;
    };
    const mutateAura = (p, sourceId, authorityId=sourceId) => {
      const operation=p.operation||"create",collection=s.auras||(s.auras=[]),nested=p.aura&&typeof p.aura==="object"&&!Array.isArray(p.aura)?p.aura:null;
      const input=nested?{...nested,...p,id:nested.id??p.id}:p,id=String(input.id||"");
      if(!["create","update","suppress","restore","remove","expire"].includes(operation))fail("Неизвестная операция ауры");
      if(operation==="create"){
        if(collection.length>=120)fail("На Сцене уже 120 аур");
        if(!id||collection.some(item=>item.id===id))fail("Аура с таким ID уже существует");
        const ownerActorId=input.ownerActorId??authorityId??sourceId;
        const definition=auraRecord(scene,{...input,ownerActorId,createdEventId:input.createdEventId??rootId});
        auraOperatorAllowed(definition,p,sourceId,authorityId);
        collection.push(definition);
        emit("aura.create",sourceId||definition.ownerActorId,{aura:definition,auraId:definition.id,id:definition.id,ownerActorId:definition.ownerActorId,sourceEntityId:definition.sourceEntityId,effectId:definition.effectId,ruleId:definition.ruleId});
        return definition;
      }
      const current=collection.find(item=>item.id===id);
      if(!current)fail("Аура не найдена");
      auraOperatorAllowed(current,p,sourceId,authorityId);
      if(operation==="expire"&&authorityId!=null)fail("Истечение ауры выполняет только ядро или Нарратор");
      if(operation==="update"){
        const definition=auraRecord(scene,{...current,...input,id:current.id},current);
        if(definition.ownerActorId!==current.ownerActorId)fail("Владелец ауры не изменяется этой операцией");
        const index=collection.indexOf(current),before=copy(current);collection[index]=definition;
        emit("aura.update",sourceId||definition.ownerActorId,{aura:definition,auraId:definition.id,id:definition.id,before,ownerActorId:definition.ownerActorId,sourceEntityId:definition.sourceEntityId,effectId:definition.effectId,ruleId:definition.ruleId});
        return definition;
      }
      if(operation==="suppress"||operation==="restore"){
        const suppressionId=auraString(p.suppressionId,"источник подавления ауры");
        const before=[...(current.suppressedBy||[])];
        current.suppressedBy=operation==="suppress"?[...new Set([...before,suppressionId])]:before.filter(value=>value!==suppressionId);
        emit(operation==="suppress"?"aura.suppress":"aura.restore",sourceId||current.ownerActorId,{auraId:current.id,id:current.id,suppressionId,ownerActorId:current.ownerActorId,sourceEntityId:current.sourceEntityId,effectId:current.effectId,suppressedBy:[...current.suppressedBy]});
        return current;
      }
      if(operation==="remove"&&current.removable!==true&&authorityId!=null)fail("Эту ауру нельзя снять вручную");
      removeAuraRecord(current,operation==="expire"?"expired":"removed",sourceId);
      return null;
    };
    const applyDamage = p => {
      const a = requiredActor(scene, p.targetId, false);
      if (a.knockedOut) { emit("damage.apply", p.sourceActorId, { ...p, dealt: 0, ignored: true }); return; }
      const source = actor(scene, p.sourceActorId), raw = integer(p.amount, "урон"), attack = p.attack === true;
      const compound=legacy.compoundEnemyStatus(scene,a);
      if(compound.active){s.compounds||={};const saved=s.compounds[compound.id]||={defenseType:compound.defenseType};compound.defenseType=compound.parts.find(part=>part.compoundDefense)?.compoundDefense||saved.defenseType;}
      const defender=compound.active?compound.parts.reduce((best,x)=>stat(x,compound.defenseType)>stat(best,compound.defenseType)?x:best,compound.parts[0]):a;
      let amount = raw;
      if (!p.irreducible) {
        if (attack && !p.finalDamage) amount = Math.max(0, amount + (effectActive(scene,source,"positive.усилен") ? Math.ceil(source.tier / 2) : 0) - (effectActive(scene,source,"negative.ослаблен") ? Math.ceil(source.tier / 2) : 0));
        amount = Math.max(0, amount - integer(p.reduction || 0, "снижение урона"));
      }
      const armor = !p.irreducible && attack && !p.ignoreArmor && !effectActive(scene,a,"negative.разорван") ? (compound.active&&compound.defenseType!=="armor"?0:stat(defender, "armor")) + (effectActive(scene,a,"positive.укреплен") ? Number(a.tier || 1) : 0) + Number(p.temporaryArmor || 0) : 0;
      const afterArmor = amount > 0 ? Math.max(1, amount - armor) : 0;
      const evasionAllowed = !p.irreducible && !p.ignoreEvasion && !effectActive(scene,a,"negative.обездвижен") && !effectActive(scene,a,"negative.пойман");
      const evaded = evasionAllowed ? Math.min(afterArmor, compound.active&&compound.defenseType!=="evasion"?0:stat(defender, "evasion")) : 0;
      let toSpend=evaded;
      for(const m of astate(defender).modifiers.filter(m=>m.stat==="evasion"&&m.amount>0)){const used=Math.min(toSpend,m.remaining??m.amount);m.remaining=(m.remaining??m.amount)-used;toSpend-=used;}
      defender.evasion = Math.max(0, Number(defender.evasion || 0) - toSpend);
      if(compound.active&&compound.defenseType==="evasion")for(const part of compound.parts)part.evasion=Math.min(Number(part.evasion||0),defender.evasion);
      const hpBefore = compound.active ? compound.hp : Number(a.hp);
      let dealt = Math.max(0, afterArmor - evaded);
      if (attack && dealt > 0 && !p.irreducible && !p.finalDamage && effectActive(scene,a,"negative.помечен")) { dealt += Number(a.tier || 1); removeEffect(a, "negative.помечен"); }
      if(compound.active){const nextGate=Math.max(0,(Math.ceil(compound.hp/compound.gate-1e-9)-1)*compound.gate);dealt=Math.min(dealt,Math.max(0,compound.hp-nextGate));let remaining=compound.hp-dealt;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}if(dealt>0&&compound.hp-dealt===nextGate&&nextGate>0)scene.tension++;}
      else a.hp = Math.max(0, Number(a.hp) - dealt);
      const hit = p.hit !== false;
      emit("damage.apply", p.sourceActorId, { ...p, raw, armor, evaded, dealt, healthLost: Math.min(hpBefore, dealt), hp: a.hp, hit });
      if (dealt > 0 && (compound.active?compound.hp-dealt<=0:a.hp===0)) { if (isPlayer(a)) wound(a, p.sourceActorId); else {knockout(a,{kind:"damage",sourceActorId:p.sourceActorId});if(compound.active)for(const part of compound.parts){part.knockedOut=true;part.ap=0;}} }
      if (hit && !(attack && afterArmor > 0 && evaded === afterArmor) && !a.knockedOut) for (const e of p.effects || []) applyEffect(a, {...(typeof e === "string" ? { effect: e } : e),preventForcedMovement:p.preventForcedMovement}, p.sourceActorId);
    };
    const move = (a, p) => {
      const result = p.__verifiedRoute ? {cost:p.__verifiedRoute.spent,path:p.__verifiedRoute.path.map(point=>({x:point.x,y:point.y})),space:p.__verifiedRoute.stoppedAt.space,endedByDifficultTerrain:p.__verifiedRoute.terminal&&p.__verifiedRoute.stopReason==="difficult-terrain"} : movement(scene, a, p.destination || p, p), from = { x: a.x, y: a.y, space: a.space };
      const endpoint=result.path[result.path.length-1]||p.destination||p;
      a.x = endpoint.x; a.y = endpoint.y; a.space = result.space;
      if(result.endedByDifficultTerrain){astate(a).difficultTerrainStopSerial=scene.turnSerial;a.stepRemaining=0;}
      if(a.compoundId)for(const part of scene.actors.filter(x=>x.compoundId===a.compoundId)){part.x=a.x;part.y=a.y;part.space=a.space;}
      emit("actor.move", a.id, { ...p, from, x: a.x, y: a.y, space: a.space, path: result.path, distance: result.cost });
      // A typed notification is also useful when the Technique itself is manual.
      const points=[from,...result.path.map(point=>({...point,space:result.space}))];
      if (!p.placement) for (const foe of scene.actors.filter(x => live(x) && !effectActive(scene,x,"positive.исчез") && x.team !== a.team)) if (points.some((point,index)=>index>0&&distance(points[index-1],foe)===1&&distance(point,foe)>1)) {
        s.opportunities ||= []; s.opportunities.push({ id: `${rootId}:punish:${foe.id}`, actorId: foe.id, targetId: a.id, turnSerial: scene.turnSerial });
        emit("reaction.offer", foe.id, { targetId: a.id, actionId: "action.защита.наказание", name: "Наказание" });
      }
      if(!p.followSnare)for(const caught of scene.actors.filter(x=>live(x)&&x.id!==a.id&&effectActive(scene,x,"negative.пойман")&&activeEffectSources(x,"negative.пойман",scene).some(source=>source.actorId===a.id))){
        if(distance(caught,a)!==1&&!effectActive(scene,caught,"positive.устойчив"))choice(caught,"placement","Пойман: выберите клетку рядом с переместившимся источником",["place"],{adjacentTo:a.id,forced:true});
      }
      return result;
    };
    const geometryRouteId = route => `${route?.sourceActorId || "scene"}:${route?.actorId || "movement"}:${route?.sceneVersion || 0}:${route?.geometryStamp || ""}`;
    const geometryTriggerList = (plan, operation) => {
      const values = operation.segmentChoices ?? operation.enterChoices ?? operation.segmentTriggers ?? operation.boundaryChoices ?? operation.onEnter ?? plan?.request?.segmentChoices ?? plan?.request?.enterChoices ?? plan?.request?.segmentTriggers ?? plan?.request?.boundaryChoices ?? plan?.request?.onEnter ?? plan?.route?.segmentChoices ?? plan?.route?.enterChoices ?? plan?.route?.segmentTriggers ?? plan?.route?.boundaryChoices ?? plan?.route?.onEnter ?? [];
      if (Array.isArray(values)) return values;
      if (values && typeof values === "object") return Object.entries(values).map(([key, value]) => ({ ...(value && typeof value === "object" ? value : {}), at: value && typeof value === "object" ? value.at || key : key }));
      return [];
    };
    const geometryTriggerFor = (plan, operation, segment, index) => [
      ...geometryTriggerList(plan, operation),
      ...(segment?.enterChoice ? [{ ...segment.enterChoice, boundary: "enter", segmentIndex: index }] : []),
      ...(segment?.enterDecision ? [{ ...segment.enterDecision, boundary: "enter", segmentIndex: index }] : []),
    ].find(trigger => {
      if (!trigger || typeof trigger !== "object") return false;
      if (trigger.boundary && trigger.boundary !== "enter") return false;
      const triggerIndex = trigger.segmentIndex ?? trigger.index;
      if (triggerIndex != null && Number(triggerIndex) !== Number(index)) return false;
      const point = trigger.at || trigger.cell || trigger.destination;
      return !point || Number(point.x) === Number(segment.to.x) && Number(point.y) === Number(segment.to.y) && (!point.space || point.space === segment.to.space);
    }) || null;
    const geometryCommit = (route, target, operation, cursor, terminal = false, stopReason = null) => {
      const stoppedAt = { space: target.space, x: Number(target.x), y: Number(target.y) };
      // Keep the legacy actor.move projection available to old journal/UI
      // consumers. The actual state transition has already happened one
      // segment at a time; this row is only the completed-route summary.
      emit("actor.move", target.id, {
        movement: operation.label || "Движение по плану",
        from: route.origin ? { ...route.origin } : null,
        x: stoppedAt.x,
        y: stoppedAt.y,
        space: stoppedAt.space,
        path: (route.path || []).map(point => ({ x: Number(point.x), y: Number(point.y) })),
        distance: Number(cursor.spent || 0),
        geometrySummary: true,
      });
      emit("geometry.route.commit", operation.sourceActorId || route.sourceActorId, {
        targetId: route.actorId,
        requestedDestination: route.destination,
        stoppedAt,
        spent: Number(cursor.spent || 0),
        remaining: terminal ? 0 : Math.max(0, Number(route.maximum || 0) - Number(cursor.spent || 0)),
        terminal: Boolean(terminal),
        stopReason: stopReason || null,
        segments: route.segments || [],
        cursor: { ...cursor, status: "completed", phase: terminal ? "terminal" : "completed" },
      });
    };
    const queueGeometrySegment = (plan, operation, cursor, sourceId, segmentIndex, spent) => {
      const route = plan.route;
      const nextVersion = Number(scene.version || 0) + 1;
      const expectedScene = { ...scene, version: nextVersion };
      const nextCursor = global.DAWN_LIONWING_GEOMETRY.geometryCursor(route, segmentIndex, expectedScene, {
        id: cursor.id,
        expectedSceneVersion: nextVersion,
        expectedGeometryStamp: global.DAWN_LIONWING_GEOMETRY.geometryStamp(expectedScene),
        spent,
        phase: "before-leave",
        status: "running",
      });
      s.geometryCursor = nextCursor;
      queue.unshift({
        p: { kind: "geometry-segment", targetId: route.actorId, geometryPlan: plan, geometryCursor: nextCursor, label: operation.label, sourceActorId: operation.sourceActorId, segmentChoices: operation.segmentChoices ?? operation.enterChoices },
        sourceId,
        provenance: copy(provenance),
      });
      return nextCursor;
    };
    const spend = (a, requestedResource, amount) => {
      const resource=resourceKey(a,requestedResource);
      if(!spendable.has(resource)&&!Object.hasOwn(a.ruleResources||{},resource))fail("Для этого значения используйте игровую операцию или исправление Нарратора");
      integer(amount, "расход");
      if(requestedResource==="focus"&&a.ruleResources?.[resource]?.inverted){gain(a,resource,amount);return;}
      const balance = resources.has(resource) ? Number(a[resource] || 0) : Number(a.ruleResources?.[resource]?.value || 0);
      if (balance < amount) fail(`Недостаточно ${resource}: нужно ${amount}, доступно ${balance}`);
      if (resources.has(resource)) a[resource] = balance - amount;
      else if (a.ruleResources?.[resource]) a.ruleResources[resource].value = balance - amount;
      else fail("Ресурс не настроен");
      emit("resource.spend", a.id, { requestedResource, resource, amount });
    };
    const gain = (a, requestedResource, amount) => {
      integer(amount,"получение ресурса");
      const resource=resourceKey(a,requestedResource),before=balance(a,resource);
      if(!spendable.has(resource)&&!Object.hasOwn(a.ruleResources||{},resource))fail("Сначала настройте ресурс");
      if(requestedResource==="focus"&&a.ruleResources?.[resource]?.inverted){a.ruleResources[resource].value=Math.max(0,before-amount);emit("resource.spend",a.id,{resource,amount:Math.min(before,amount),requestedAmount:amount,inverted:true});return;}
      if(spendable.has(resource))a[resource]=before+amount;
      else {const def=a.ruleResources[resource];if(def.maximum!=null&&before+amount>def.maximum)fail("Получение превышает максимум ресурса");def.value=before+amount;}
      emit("resource.gain",a.id,{requestedResource,resource,amount});
    };
    const applyHealing = (p,sourceId) => { const target = requiredActor(scene, p.targetId || sourceId); const amount = integer(p.amount, "лечение"),compound=legacy.compoundEnemyStatus(scene,target),before=compound.active?compound.hp:target.hp;let after;if(compound.active){after=Math.min(Math.ceil(compound.hp/compound.gate)*compound.gate,compound.hp+amount);let remaining=after;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}}else{target.hp=Math.min(target.maxHp,target.hp+amount);after=target.hp;}emit("actor.heal",sourceId,{targetId:target.id,amount,restored:after-before,prevented:amount>0&&after===before});};
    const applyHealthLoss = (a, p, sourceId) => {
      const requested = integer(p.amount, "потеря Здоровья"), before = Number(a.hp || 0), lost = Math.min(before, requested);
      if(p.mode!=="lose"&&requested>before)fail("Недостаточно Здоровья для оплаты");
      if(a.compoundId)fail("Потеря Здоровья составного тела требует отдельного решения Нарратора");
      a.hp = before - lost;
      emit(p.mode === "lose" ? "health.lose" : "health.spend", sourceId, { targetId: a.id, requested, lost, hp: a.hp });
      if (lost > 0 && a.hp === 0) { if (isPlayer(a)) wound(a, sourceId); else knockout(a, { kind: p.mode === "lose" ? "health-loss" : "health-spend", sourceActorId: sourceId }); }
    };
    const payReservation = (a, reservation) => {
      for (const part of reservation.costs) {
        if (part.kind === "health") applyHealthLoss(a, part, a.id);
        else spend(a, part.requestedResource, part.amount);
      }
    };
    const counterPolicy = (p, previous, maximum) => {
      const resetAt=p.resetAt??previous?.resetAt??"manual",initial=integer(p.initial??previous?.initial??0,"значение сброса");
      if(!["manual","startTurn","endTurn","roundEnd","scene"].includes(resetAt))fail("Неизвестный срок сброса счётчика");
      if(maximum!=null&&initial>maximum)fail("Значение сброса превышает максимум");
      return {resetAt,initial};
    };
    const resetCounters = (a,boundary) => {
      for(const [collection,type] of [[a.ruleResources,"rule-resource.reset"],[a.ruleClocks,"rule-clock.reset"]])for(const [id,def] of Object.entries(collection||{})){
        const phase = boundary === "startTurn" ? "start" : boundary === "endTurn" ? "end" : null;
        const descriptorDue = phase && def.lifetime && typeof def.lifetime === "object" && foundations.lifetimeExpired(def.lifetime, { phase, ownerActorId: a.id, ownerTurnSerial: ownTurnSerial(a), ownerTurnInstanceId: s.activeTurnInstanceId || null, sceneSerial: s.sceneSerial });
        if(def.resetAt!==boundary&&!descriptorDue)continue;
        const before=def.current ?? def.value ?? 0, next=def.initial ?? def.min ?? 0;
        def.current=next;def.value=next;
        if(descriptorDue) def.lifetime=foundations.lifetimeBoundary(def.lifetime.boundary,{ownerActorId:a.id,ownerTurnSerial:ownTurnSerial(a),ownerTurnInstanceId:s.activeTurnInstanceId||null,sceneSerial:s.sceneSerial});
        emit(type,a.id,{id,kind:type.endsWith("clock.reset")?"clock":"resource",before,value:next,current:next,initial:def.initial??0,boundary,ownerActorId:def.ownerActorId??a.id,sourceActorId:def.sourceActorId??a.id,sourceEntityId:def.sourceEntityId??null,ruleId:def.ruleId??null,lifetime:def.lifetime??null});
      }
    };
    const lifetimeDue = (source, saved, effect, target, owner, boundary) => {
      const lifetime=source ? source.lifetime ?? null : saved?.lifetime || null;
      if (lifetime) return foundations.lifetimeExpired(lifetime, {
        phase: boundary === "startTurn" ? "start" : "end",
        ownerActorId: owner?.id || null,
        ownerTurnSerial: owner ? ownTurnSerial(owner) : null,
        ownerTurnInstanceId: s.activeTurnInstanceId || null,
        sceneSerial: s.sceneSerial,
      });
      const old=target?.lionwing?.effectLifetimes?.[effect]||{};
      const ownerId=source?.ownerActorId||source?.boundaryOwnerId||old.ownerActorId||target?.id;
      const applied=source?.appliedSerial??old.appliedSerial??saved?.appliedTurnSerial??-1;
      return boundary === "roundEnd" && (source?.duration||saved?.duration) === "roundEnd" || owner?.id === ownerId && owner && (
        boundary === "startTurn" && ["startTurn","nextTurn"].includes(source?.duration||saved?.duration) ||
        boundary === "endTurn" && ["default","endTurn"].includes(source?.duration||saved?.duration) && scene.turnSerial > Number(applied)
      );
    };
    const phase = (boundary, owner) => {
      for (const a of scene.actors) {
        if(boundary==="roundEnd"||a.id===owner?.id)resetCounters(a,boundary);
        for (const effect of new Set([...(a.effects||[]),...Object.keys(a.effectStates||{})])) {
          const saved=a.effectStates?.[effect], sources=saved?.sources||[];
          if(sources.length)for(const source of [...sources]){
            const legacyLife=a.lionwing?.effectLifetimes?.[effect];
            source.duration??=legacyLife?.duration||saved?.duration||(persistent.has(effect)?"scene":"default");
            source.ownerActorId??=legacyLife?.ownerActorId||a.id;
            source.appliedSerial??=legacyLife?.appliedSerial??saved?.appliedTurnSerial??-1;
            const due=lifetimeDue(source,saved,effect,a,owner,boundary);
            if(due)removeEffect(a,effect,{sourceId:source.sourceId||source.actorId,manual:false});
          } else {
            const life=a.lionwing?.effectLifetimes?.[effect]||{duration:saved?.duration||(persistent.has(effect)?"scene":"default"),ownerActorId:a.id,appliedSerial:saved?.appliedTurnSerial??-1};
            const due=lifetimeDue(life,saved,effect,a,owner,boundary);
            if(due)removeEffect(a,effect,{manual:false});
          }
        }
        astate(a).modifiers = (astate(a).modifiers || []).filter(m => !(m.boundary === boundary && (boundary === "roundEnd" || m.ownerActorId === owner?.id) && (boundary === "roundEnd" || scene.turnSerial > m.appliedSerial)));
      }
      for(const aura of [...s.auras]){
        const life=aura.lifetime,ownerMatches=!owner||aura.ownerActorId===owner.id,serial=Number(aura.appliedSerial??0),boundaryName=life&&typeof life==="object"?life.boundary:null;
        const due=boundary==="roundEnd"&&((life==="round"||life==="roundEnd")&&Number(scene.round||0)>=Number(aura.appliedRound??scene.round??0))||ownerMatches&&((boundary==="startTurn"&&(["startTurn","nextTurn","startNextOwnerTurn","actionOrStartTurn"].includes(life)||boundaryName==="startNextOwnerTurn"))||(boundary==="endTurn"&&(["default","endTurn","endNextOwnerTurn"].includes(life)||boundaryName==="endNextOwnerTurn")))&&Number(scene.turnSerial||0)>serial;
        if(due)removeAuraRecord(aura,"expired",owner?.id||null);
      }
      for (const reminder of scene.reminders || []) if (!reminder.resolved && reminder.boundary === boundary && (!reminder.ownerActorId || reminder.ownerActorId === owner?.id)) reminder.due = true;
    };
    const publishRoll = (a, value, label) => {
      const result = validateRoll(value);
      const row = emit("roll.public", a.id, { ...result, name: label, actorName: a.name });
      scene.rollFeed ||= []; scene.rollFeed.unshift({ id: row.id, actorId: a.id, actor: a.name, ...result, outcome: label, visibility: event.visibility || "public" }); scene.rollFeed = scene.rollFeed.slice(0, 40);
      return result;
    };
    const beginAttack = (a, p) => {
      if (scene.pendingAction) fail("Атака уже ожидает разрешения");
      const seen=new Set(),targets=[...new Set(p.targetIds||[])].filter(id=>{const a=actor(scene,id),key=a?.compoundId||id;if(seen.has(key))return false;seen.add(key);return true;});
      if (!targets.length) fail("Выберите цели");
      for (const id of targets) {
        const target = requiredActor(scene, id);
        if (effectActive(scene,target,"positive.исчез") || effectActive(scene,a,"positive.изгнан") !== effectActive(scene,target,"positive.изгнан")) fail("Цель недоступна из-за Эффекта");
      }
      scene.pendingAction = { id: rootId, actionInstanceId:provenance?.actionInstanceId||rootId, lionwing: true, actorId: a.id, name: p.name || "Атака", targetIds: targets, damage: integer(p.amount, "урон"), repeat: integer(p.repeat ?? 1, "повторы", 30), effects: copy(p.effects || []), finalDamage: Boolean(p.finalDamage), ignoreArmor:p.ignoreArmor===true, ignoreEvasion:p.ignoreEvasion===true, irreducible:p.irreducible===true, responses: Object.fromEntries(targets.map(id => [id, { choice: "pending" }])), sourceActionId: p.actionId || "manual.attack" };
      if(p.targetDamage){if(typeof p.targetDamage!=="object"||Array.isArray(p.targetDamage))fail("Некорректный урон по целям");for(const[id,amount]of Object.entries(p.targetDamage)){if(!targets.includes(id))fail("Урон указан для посторонней цели");integer(amount,"урон цели");}scene.pendingAction.targetDamage=copy(p.targetDamage);}
      if (!scene.pendingAction.repeat) fail("Нужно хотя бы одно нанесение урона");
      emit("attack.pending", a.id, scene.pendingAction);
      if(effectActive(scene,a,"negative.порчен"))s.afterAttack=[...(s.afterAttack||[]),{kind:"damage",targetId:a.id,amount:Number(a.tier||1),sourceActorId:a.id,irreducible:true}];
    };
    const performAction = (a, p) => {
      const def = actionDef(p.actionId);
      if (!def) fail("Неизвестное базовое действие");
      const status = actionStatus(scene, a, def, p);
      if (!status.available) fail(status.reason);
      if (effectActive(scene,a,"positive.исчез")) {
        if (!p.reappearance) fail("Сначала выберите клетку появления");
        if (scene.actors.some(x => live(x) && x.id !== a.id && distance({ ...p.reappearance, space: a.space }, x) <= 1)) fail("Появление запрещено рядом с персонажем");
        removeEffect(a, "positive.исчез",{reappear:false}); move(a, { destination: p.reappearance, placement: true });
      }
      const targets = targetIds(scene,p.targetIds).map(id => requiredActor(scene, id));
      if ([ids.spell, ids.finish, ids.study, ids.shove, "action.атаки.дуэль"].includes(def.id) && targets.length !== 1 || def.id === ids.skirmish && (!targets.length || targets.length > 2)) fail("Неверное число целей");
      const range = def.id === ids.spell ? 5 : def.id === ids.study ? Number(a.attrs.mind || 0) : 1;
      if ([ids.spell, ids.skirmish, ids.finish, ids.study, ids.shove, "action.атаки.дуэль"].includes(def.id) && targets.some(t => t.id === a.id || distance(a, t) > range)) fail("Цель вне дальности действия");
      if (def.id === ids.study && isPlayer(targets[0])) fail("Изучение требует NPC");
      const focusSpent = integer(p.focusSpent || 0, "Фокус");
      if (def.id === ids.finish && focusSpent > Number(scene.tension || 0)) fail("Расход Фокуса превышает Напряжение");
      if (p.breakout) spend(a, "influence", 1);
      if (status.cost) spend(a, status.resource, status.cost);
      if (def.id === ids.finish && focusSpent) spend(a, "focus", focusSpent);
      if(status.allowanceId)astate(a).allowances.find(x=>x.id===status.allowanceId).remaining--;
      if(def.id===ids.improvise&&p.removeObstacleId){const index=scene.objects.findIndex(o=>o.id===p.removeObstacleId&&o.type==="terrain"&&o.space===a.space&&(o.cells||[]).some(cell=>{const[x,y]=cell.split(',').map(Number);return distance(a,{x,y,space:a.space})===1;}));if(index<0)fail("Соседнее препятствие не найдено");scene.objects.splice(index,1);}
      if (!status.continuation && !status.swift) { a.usedActions = [...new Set([...(a.usedActions || []), def.id])]; astate(a).turnActions = [...new Set([...(astate(a).turnActions || []), def.id])]; }
      const activeTurnOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null, activeOwnerSerial = activeTurnOwner ? ownTurnSerial(activeTurnOwner) : null;
      astate(a).history = [...(astate(a).history || []), { actionId: def.id, actionDefinitionId: def.id, actionInstanceId: provenance?.actionInstanceId || null, targetIds: targets.map(t => t.id), round: scene.round, turnSerial: scene.turnSerial, ownerTurnActorId: activeTurnOwner?.id || null, ownerTurnSerial: activeOwnerSerial, ownerTurnInstanceId: s.activeTurnInstanceId || null, ownerTurnKey: activeTurnOwner ? ownerTurnKey(s.sceneSerial, activeTurnOwner, activeOwnerSerial) : null, swift: Boolean(status.swift) }].filter((item,index,list)=>item.ruleId||index>=list.length-200);
      emit("action.resolve", a.id, { actionId: def.id, name: def.name, targetIds: targets.map(t => t.id) });
      let result;
      if ([ids.spell, ids.skirmish, ids.finish, ids.charge].includes(def.id)) {
        result = publishRoll(a, p.roll, def.name);
        const pools=attackPools(scene,a,def,p);if(result.initialCount!==pools.base)fail("Пул броска не соответствует действию");
        p.targetDamage={};for(const[id,count]of Object.entries(pools.counts)){let extra=0;if(count>pools.base){const extraRoll=publishRoll(a,p.targetRolls?.[id],`Дополнительные кости: ${actor(scene,id).name}`);if(extraRoll.initialCount!==count-pools.base)fail("Неверный дополнительный пул");extra=extraRoll.successes;}p.targetDamage[id]=result.successes+extra+(def.id===ids.finish?Number(scene.tension||0):0);}
        for(const id of p.spikeTargetIds||[])if(targets.some(t=>t.id===id)&&effectActive(scene,actor(scene,id),"negative.подброшен"))removeEffect(actor(scene,id),"negative.подброшен");
      }
      if ([ids.spell, ids.skirmish, ids.finish].includes(def.id)) beginAttack(a, { ...p, name: def.name, amount: result.successes + (def.id === ids.finish ? Number(scene.tension || 0) : 0) });
      else if (def.id === ids.charge || def.id === ids.breathe) { const amount = def.id === ids.charge ? Math.max(2, result.successes) : 1; gain(a,"focus",amount); }
      else if (def.id === ids.step) { if (!status.continuation) a.stepRemaining = sceneSpeed(scene,a); if (p.destination) {const moved=move(a, { destination: p.destination, maximum: a.stepRemaining });if(Number(astate(a).difficultTerrainStopSerial)!==Number(scene.turnSerial))a.stepRemaining-=moved.cost;} }
      else if (def.id === ids.jump) move(a, { destination: p.destination, maximum: scaledMove(a, Number(a.attrs.talent || 0),scene), line: true, ignoreOpponents: true, ignoreDifficultTerrain:true });
      else if (def.id === ids.shove) move(targets[0], { destination: p.destination, maximum: 1, forced: true });
      else if (def.id === ids.disappear) applyEffect(a, { effect: "positive.исчез", duration: "startTurn" }, a.id);
      else if (def.id === ids.study) { applyEffect(targets[0], { effect: "negative.помечен" }, a.id); emit("rule.prompt", a.id, { targetId: targets[0].id, title: "Нарратор раскрывает выбранный параметр NPC", category: p.category || "health" }); }
      else if (def.id === ids.improvise && !p.removeObstacleId) {
        if (p.effect) { if (targets.length !== 1 || distance(a, targets[0]) > 1 || p.effect === "positive.изгнан") fail("Импровизация: соседняя цель и Эффект кроме Изгнания"); applyEffect(targets[0], { effect: p.effect }, a.id); }
        else { const d = p.destination; if (!d || distance(a, { ...d, space: a.space }) !== 1) fail("Выберите соседнюю клетку препятствия"); movement(scene, a, d, { placement: true }); scene.objects.push({ id: `${rootId}:obstacle`, type: "terrain", label: "Препятствие", space: a.space, cells: [`${d.x},${d.y}`], hp: 10, maxHp: 10, duration: "scene", ownerActorId: a.id }); }
      } else if (def.id === "action.атаки.дуэль") {
        const opponent=targets[0];
        if(opponent.team===a.team)fail("Дуэль требует противника");
        if(astate(a).duelId||astate(opponent).duelId)fail("Участник уже находится в Дуэли");
        const duelId=`${rootId}:duel`,spaceId=`duel-${rootId}`,participants=[a,opponent];
        s.duels||=[];const duel={id:duelId,spaceId,actorId:a.id,targetId:opponent.id,returnSpaceId:a.space,startedSerial:scene.turnSerial,tension:Number(scene.tension||0),influenceSpent:status.cost};s.duels.push(duel);
        scene.spaces.push({id:spaceId,name:"Дуэль",width:7,height:7,returnSpaceId:a.space,ownerActorId:a.id});
        for(const [index,participant]of participants.entries()){
          const parts=participant.compoundId?scene.actors.filter(x=>x.compoundId===participant.compoundId):[participant];
          for(const part of parts){astate(part).duelId=duelId;part.space=spaceId;part.x=index?5:1;part.y=3;}
        }
        emit("duel.start",a.id,{targetId:opponent.id,spaceId,duelId});
        const remaining=scene.actors.filter(item=>live(item)&&item.space===duel.returnSpaceId);
        if(!remaining.some(item=>item.team===a.team)||!remaining.some(item=>item.team!==a.team))duelOutcome(duel);
      }
      if (def.id==="action.атаки.дуэль" && effectActive(scene,a,"negative.порчен")) {
        const damage={kind:"damage",targetId:a.id,amount:Number(a.tier||1),sourceActorId:a.id,irreducible:true};
        if(scene.pendingAction)s.afterAttack=[damage];else queue.unshift({p:damage,sourceId:a.id});
      }
    };

    function op(p, sourceId) {
      const a = sourceId ? requiredActor(scene, sourceId, false) : null;
      switch (p.kind) {
        case "plan": {
          if (!Array.isArray(p.operations) || !p.operations.length || p.operations.length > 192 || p.operations.some(operation => !operation || !api.operations.includes(operation.kind) || ["plan","batch","execution-frame"].includes(operation.kind))) fail("Некорректный план действия");
          if (!p.reservation || p.reservation.sceneVersion !== Number(scene.version || 0) || p.reservation.actorId !== sourceId) fail("Резерв цены устарел: подготовьте действие заново");
          const quoted = costQuote(scene, sourceId, p.costs, p.targetIds || []);
          if (JSON.stringify(quoted) !== JSON.stringify(p.reservation)) fail("Составная цена или цели изменены после подтверждения");
          payReservation(a, quoted);
          queue.unshift(...p.operations.map(operation => ({ p: operation, sourceId: operation.sourceActorId ?? sourceId, provenance: { ...provenance, actionId: p.actionId || provenance?.actionId } })));
          emit("cost.commit", sourceId, { costs: quoted.costs, targetIds: quoted.targetIds });
          break;
        }
        case "action": performAction(requiredActor(scene, sourceId), p); break;
        case "attack": if (p.cost) spend(requiredActor(scene, sourceId), p.cost.resource || "ap", integer(p.cost.amount, "стоимость")); beginAttack(requiredActor(scene, sourceId), p); break;
        case "damage": applyDamage({ ...p, sourceActorId: Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId }); break;
        case "spend-health": applyHealthLoss(requiredActor(scene, p.targetId || sourceId, false), { ...p, mode: "spend" }, sourceId); break;
        case "lose-health": applyHealthLoss(requiredActor(scene, p.targetId || sourceId, false), { ...p, mode: "lose" }, sourceId); break;
        case "record-action": {
          const def=actionDef(p.actionId);if(!def||def.type!=="action")fail("Выберите базовое действие");
          if(scene.activeActorId!==sourceId&&!p.reaction)fail("Сейчас не Ход исполнителя");
          const swift=p.swift===true||p.reaction===true,used=isPlayer(a)?a.usedActions||[]:astate(a).turnActions||[];
          if(!swift&&used.includes(def.id))fail("Действие уже использовано");
          spend(a,p.resource||"ap",integer(p.amount??0,"стоимость"));
          if(!swift){a.usedActions=[...new Set([...(a.usedActions||[]),def.id])];astate(a).turnActions=[...new Set([...(astate(a).turnActions||[]),def.id])];}
          const activeTurnOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null, activeOwnerSerial = activeTurnOwner ? ownTurnSerial(activeTurnOwner) : null;
          astate(a).history.push({actionId:def.id,actionDefinitionId:def.id,actionInstanceId:provenance?.actionInstanceId||null,round:scene.round,turnSerial:scene.turnSerial,ownerTurnActorId:activeTurnOwner?.id||null,ownerTurnSerial:activeOwnerSerial,ownerTurnInstanceId:s.activeTurnInstanceId||null,ownerTurnKey:activeTurnOwner?ownerTurnKey(s.sceneSerial,activeTurnOwner,activeOwnerSerial):null,swift,manual:true});
          emit("action.resolve",sourceId,{actionId:def.id,name:def.name,manual:true});break;
        }
        case "recover-track": {const target=requiredActor(scene,p.targetId||sourceId,false);if(!["wounds","stress"].includes(p.track))fail("Выберите Раны или Стресс");const amount=integer(p.amount,"восстановление",3),before=Number(target[p.track]||0);target[p.track]=Math.max(0,before-amount);emit("actor.track.recover",sourceId,{targetId:target.id,track:p.track,amount:before-target[p.track],value:target[p.track]});break;}
        case "heal": applyHealing(p,sourceId);break;
        case "wound": wound(requiredActor(scene, p.targetId || sourceId), Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId); break;
        case "stress": wound(requiredActor(scene, p.targetId || sourceId), Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId, "stress"); break;
        case "knockout": knockout(requiredActor(scene, p.targetId || sourceId)); break;
        case "resource": {
          const target = requiredActor(scene, p.targetId || sourceId, false), amount = integer(p.amount, "ресурс");
          if (p.operation === "spend") spend(target, p.resource, amount);
          else if(p.operation === "gain")gain(target,p.resource,amount);
          else fail("Неизвестная операция ресурса");
          break;
        }
        case "correct": {
          const target = requiredActor(scene, p.targetId || sourceId, false);
          if (!resources.has(p.resource) && !attributes.has(p.resource) && !["knockedOut","vulnerable"].includes(p.resource)) fail("Это поле нельзя исправить");
          const amount = integer(p.amount, "новое значение",p.resource==="knockedOut"?1:["wounds","stress"].includes(p.resource)?2:attributes.has(p.resource)||["baseAp","armor","speed","tier"].includes(p.resource)?99:9999), before = attributes.has(p.resource) ? target.attrs[p.resource] : target[p.resource];
          if(["maxHp","tier"].includes(p.resource)&&amount===0)fail("Значение должно быть положительным");
          const compound=legacy.compoundEnemyStatus(scene,target);
          if(p.resource==="hp"&&amount>(compound.active?compound.maxHp:target.maxHp))fail("Здоровье превышает максимум");
          if (attributes.has(p.resource)) target.attrs[p.resource] = amount;
          else if(p.resource==="vulnerable"){if(amount>1)fail("Уязвимость: 0 или 1");astate(target).vulnerable=Boolean(amount);}
          else if (p.resource === "knockedOut") { for(const part of compound.active?compound.parts:[target]){part.knockedOut=Boolean(amount);if(part.knockedOut){part.ap=0;part.stepRemaining=0;if(scene.activeActorId===part.id){scene.activeActorId=null;s.lastTeam=part.team;}s.grantedTurns=(s.grantedTurns||[]).filter(item=>item.actorId!==part.id);for(const aura of [...s.auras])if(aura.sourceLossPolicy==="remove"&&(aura.sourceEntityId===part.id||aura.ownerActorId===part.id))removeAuraRecord(aura,"removed",part.id);}} }
          else if(p.resource==="hp"&&compound.active){let remaining=amount;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}}
          else {target[p.resource] = amount;if(p.resource==="maxHp")target.hp=Math.min(target.hp,amount);}
          emit("actor.runtime.set", target.id, { resource: p.resource, value: amount, before, correction: true, note: p.note || "Ручное исправление" }); break;
        }
        case "automation": {
          const rule = global.DAWN_LIONWING_ADAPTERS.list(a).find(rule => rule.id === p.ruleId);
          if (!rule || typeof p.enabled !== "boolean") fail("Автоматизация недоступна этому участнику");
          astate(a).automation ||= {}; a.lionwing.automation[p.ruleId] = p.enabled;
          emit("automation.configure", a.id, { ruleId: p.ruleId, enabled: p.enabled }); break;
        }
        case "aura": mutateAura(p,sourceId,event.actorId); break;
        case "aura-create": mutateAura({...p,kind:"aura",operation:"create"},sourceId,event.actorId); break;
        case "aura-update": mutateAura({...p,kind:"aura",operation:"update"},sourceId,event.actorId); break;
        case "aura-suppress": mutateAura({...p,kind:"aura",operation:"suppress"},sourceId,event.actorId); break;
        case "aura-restore": mutateAura({...p,kind:"aura",operation:"restore"},sourceId,event.actorId); break;
        case "aura-remove": mutateAura({...p,kind:"aura",operation:"remove"},sourceId,event.actorId); break;
        case "effect": { const target = requiredActor(scene, p.targetId || sourceId, false); if (p.remove) removeEffect(target, p.effect,{sourceId:p.sourceId,manual:true}); else applyEffect(target, p, sourceId); break; }
        case "effect-source": {
          const target=requiredActor(scene,p.targetId||sourceId,false), saved=target.effectStates?.[p.effect], source=(saved?.sources||[]).find(item=>(item.sourceId||item.actorId)===p.sourceId);
          if(!source)fail("Источник Эффекта не найден");
          if(p.operation==="remove")removeEffect(target,p.effect,{sourceId:p.sourceId,manual:true});
          else if(p.operation==="expire")removeEffect(target,p.effect,{sourceId:p.sourceId,manual:false,reappear:true});
          else if(p.operation==="suppress"){
            if(target.compoundId||["positive.исчез","positive.изгнан"].includes(p.effect))fail("Подавление этого Эффекта пока не поддерживается");
            if(!p.suppressionId)fail("Укажите источник подавления");source.suppressedBy=[...new Set([...(source.suppressedBy||[]),p.suppressionId])];
            if(!(saved.sources||[]).some(item=>!(item.suppressedBy||[]).length))target.effects=(target.effects||[]).filter(item=>item!==p.effect);
            emit("effect.suppress",sourceId,{targetId:target.id,effect:p.effect,sourceId:p.sourceId,suppressionId:p.suppressionId});
          } else if(p.operation==="restore"){
            if(!p.suppressionId)fail("Укажите источник подавления");source.suppressedBy=(source.suppressedBy||[]).filter(id=>id!==p.suppressionId);
            if(!(source.suppressedBy||[]).length)target.effects=[...new Set([...(target.effects||[]),p.effect])];
            emit("effect.restore",sourceId,{targetId:target.id,effect:p.effect,sourceId:p.sourceId,suppressionId:p.suppressionId});
          } else fail("Неизвестная операция источника Эффекта");
          break;
        }
        case "move": move(requiredActor(scene, p.targetId || sourceId), p); break;
        case "geometry-move":{
          const geometry=global.DAWN_LIONWING_GEOMETRY;if(!geometry?.revalidatePlan)fail("Планировщик геометрии недоступен");
          const checked=geometry.revalidatePlan(scene,p.geometryPlan);if(!checked.available)fail(checked.reason);
          if(checked.route.sourceActorId!==sourceId||checked.route.actorId!==(p.targetId||sourceId))fail("Геометрический план принадлежит другой операции");
          const target=requiredActor(scene,checked.route.actorId),route=checked.route,segments=geometry.routeSegments(route);
          if(!segments.length){
            const cursor=geometry.geometryCursor(route,0,scene,{id:`${rootId}:geometry`,status:"completed",phase:"completed",spent:0});
            delete s.geometryCursor;
            geometryCommit(route,target,p,cursor,Boolean(route.terminal),route.stopReason||null);
            break;
          }
          const cursor=geometry.geometryCursor(route,0,scene,{id:`${rootId}:geometry`,expectedSceneVersion:Number(scene.version||0),expectedGeometryStamp:geometry.geometryStamp(scene),spent:0});
          s.geometryCursor=cursor;
          queue.unshift({p:{kind:"geometry-segment",targetId:route.actorId,geometryPlan:{...checked.plan,route},geometryCursor:cursor,label:p.label||"Движение по плану",sourceActorId:sourceId,segmentChoices:p.segmentChoices??p.enterChoices},sourceId,provenance:copy(provenance)});
          break;
        }
        case "geometry-segment": {
          const geometry=global.DAWN_LIONWING_GEOMETRY;if(!geometry?.segmentStatus)fail("Планировщик сегментов недоступен");
          const plan=p.geometryPlan, route=plan?.route, cursor=p.geometryCursor || route?.cursor || {};
          const segmentIndex=Number(cursor.segmentIndex||0), checked=geometry.segmentStatus(scene,plan,cursor,{allowVersionChange:segmentIndex>0});
          if(!checked.available)fail(checked.reason);
          if(checked.completed){delete s.geometryCursor;geometryCommit(route,requiredActor(scene,route.actorId),p,cursor,false,null);break;}
          const target=requiredActor(scene,route.actorId),segment=checked.segment;
          const phasePayload={routeId:geometryRouteId(route),targetId:target.id,segmentIndex,from:segment.from,to:segment.to,cost:segment.cost,cursor:{...cursor,phase:"before-leave"}};
          emit("geometry.segment.before-leave",target.id,phasePayload);
          emit("geometry.segment.leave",target.id,{...phasePayload,cursor:{...cursor,phase:"leave"}});
          emit("geometry.segment.before-enter",target.id,{...phasePayload,cursor:{...cursor,phase:"before-enter"}});
          const result=move(target,{destination:segment.to,forced:route.mode==="forced",maximum:segment.cost,width:route.width,height:route.height,ignoreTerrain:plan.request?.ignoreTerrain===true,ignoreOpponents:plan.request?.ignoreEnemies===true,straight:plan.request?.straight===true,__verifiedRoute:{spent:segment.cost,path:[{x:segment.to.x,y:segment.to.y}],space:segment.to.space,stoppedAt:segment.to,terminal:Boolean(segment.terminal),stopReason:segment.stopReason||null},movement:p.label||"Движение по плану"});
          emit("geometry.segment.enter",target.id,{...phasePayload,cursor:{...cursor,phase:"enter"},position:{space:target.space,x:Number(target.x),y:Number(target.y)}});
          const spent=Number(cursor.spent||0)+Number(segment.cost||result.cost||0),nextIndex=segmentIndex+1,terminal=Boolean(segment.terminal||nextIndex>=geometry.routeSegments(route).length&&route.terminal),trigger=geometryTriggerFor(plan,p,segment,segmentIndex),nextCursor=nextIndex<geometry.routeSegments(route).length&&!terminal?queueGeometrySegment(plan,p,cursor,sourceId,nextIndex,spent):{...geometry.geometryCursor(route,nextIndex,{...scene,version:Number(scene.version||0)+1},{id:cursor.id,spent,phase:terminal?"terminal":"completed",status:"completed",expectedSceneVersion:Number(scene.version||0)+1,expectedGeometryStamp:geometry.geometryStamp({...scene,version:Number(scene.version||0)+1})}),status:"completed",phase:terminal?"terminal":"completed"};
          if(terminal||nextIndex>=geometry.routeSegments(route).length){delete s.geometryCursor;geometryCommit(route,target,p,nextCursor,terminal,terminal?segment.stopReason||route.stopReason||null:null);break;}
          if(!s.choices.length&&trigger){
            const options=Array.isArray(trigger.options)&&trigger.options.length?trigger.options.map(String):["continue","stop"];
            const responderId=trigger.responderActorId||trigger.actorId||sourceId,targetResponder=requiredActor(scene,responderId,false);
            choice(targetResponder,"geometry-boundary",String(trigger.title||trigger.label||"Решение на границе движения").slice(0,240),options,{routeId:geometryRouteId(route),route:clone(route),cursorId:cursor.id,targetId:target.id,segmentIndex,cursorSegmentIndex:nextCursor.segmentIndex,boundary:"enter",triggerId:trigger.id||null,stopChoices:Array.isArray(trigger.stopChoices)?trigger.stopChoices.map(String):["stop"]});
          }
          break;
        }
        case "modifier": {
          const target = requiredActor(scene, p.targetId || sourceId, false);
          if(p.remove){if(!["armor","evasion","speed"].includes(p.stat))fail("Неизвестный показатель");astate(target).modifiers=astate(target).modifiers.filter(m=>m.stat!==p.stat||(p.id&&m.id!==p.id));emit("modifier.remove",sourceId,p);break;}
          if (!["armor", "evasion", "speed"].includes(p.stat) || !Number.isInteger(p.amount) || Math.abs(p.amount) > 9999 || !["startTurn","endTurn","roundEnd","scene","manual"].includes(p.duration || "endTurn")) fail("Некорректный модификатор");
          astate(target).modifiers.push({ id: p.id || `${rootId}:modifier:${astate(target).modifiers.length}`, sourceActorId: sourceId, ownerActorId: p.ownerActorId || target.id, stat: p.stat, amount: p.amount, boundary: p.duration || "endTurn", appliedSerial: scene.turnSerial }); emit("modifier.configure", sourceId, p); break;
        }
        case "allow-action":{const target=requiredActor(scene,p.targetId||sourceId);if(!actionDef(p.actionId))fail("Неизвестное действие");astate(target).allowances||=[];astate(target).allowances.push({id:p.id||`${rootId}:allowance:${astate(target).allowances.length}`,actionId:p.actionId,swift:p.swift===true,reaction:p.reaction===true,cost:p.cost==null?undefined:integer(p.cost,"стоимость"),remaining:integer(p.uses??1,"применения",99),sourceActorId:sourceId});emit("action.allow",sourceId,p);break;}
        case "grant-turn":{
          const target=requiredActor(scene,p.targetId||sourceId), amount=integer(p.amount??1,"число дополнительных Ходов",4);
          if (amount < 1) fail("Дополнительный Ход должен быть положительным");
          s.grantedTurns||=[];if(s.grantedTurns.length+amount>20)fail("Слишком много ожидающих Ходов");
          for(let index=0;index<amount;index++)s.grantedTurns.push({id:`${rootId}:grant:${index}`,actorId:target.id,sourceActorId:sourceId,kind:"extra"});
          emit("turn.grant",sourceId,{targetId:target.id,amount});break;
        }
        case "usage":{
          const scopeAliases={turn:"anyTurn",round:"round",scene:"scene"},scope=scopeAliases[p.scope]||p.scope;
          if(typeof p.ruleId!=="string"||!p.ruleId||p.ruleId.length>180||!["rootAction","action","ownerTurn","anyTurn","round","scene","chapter"].includes(scope))fail("Укажите правило и область лимита");
          if(scope==="ownerTurn"&&scene.activeActorId!==sourceId)fail("Этот лимит доступен только на собственном Ходу владельца");
          if(scope==="anyTurn"&&!s.activeTurnInstanceId)fail("Область любого Хода доступна только внутри текущего Хода");
          const activeOwner = scene.activeActorId ? actor(scene,scene.activeActorId) : null;
          const query={scope,actorId:sourceId,ruleId:p.ruleId,rootActionId:provenance.rootActionId,actionId:p.actionId||provenance.actionId,actionInstanceId:provenance.actionInstanceId,ownerActorId:sourceId,turnSerial:scene.turnSerial,turnInstanceId:s.activeTurnInstanceId||null,ownerTurnSerial:activeOwner?ownTurnSerial(activeOwner):null,ownerTurnInstanceId:s.activeTurnInstanceId||null,round:scene.round,sceneSerial:s.sceneSerial,chapterSerial:s.chapterSerial};
          const used=(s.history||[]).filter(item=>foundations.inScope(item,query));
          if(used.length>=integer(p.limit??1,"лимит",999))fail("Лимит применения правила исчерпан");
          if(p.oncePerTarget&&(p.targetIds||[]).some(id=>used.some(item=>item.targetIds.includes(id))))fail("Эта цель уже использована правилом");
          const ownerTurnKeyValue = activeOwner ? ownerTurnKey(s.sceneSerial, activeOwner, ownTurnSerial(activeOwner)) : null;
          astate(a).history=[...(astate(a).history||[]),{ruleId:p.ruleId,targetIds:copy(p.targetIds||[]),round:scene.round,turnSerial:scene.turnSerial,actionId:p.actionId||null,actionInstanceId:provenance.actionInstanceId||null,ownerTurnActorId:activeOwner?.id||null,ownerTurnSerial:activeOwner?ownTurnSerial(activeOwner):null,ownerTurnInstanceId:s.activeTurnInstanceId||null,ownerTurnKey:ownerTurnKeyValue}];
          emit("rule.used",sourceId,{...p,scope});break;
        }
        case "punish":{const opportunity=(s.opportunities||[]).find(o=>o.id===p.id&&o.actorId===sourceId);if(!opportunity)fail("Окно Наказания уже закрыто");spend(a,"focus",2);const result=publishRoll(a,p.roll,"Наказание");if(result.initialCount!==Math.max(Number(a.attrs.body||0),Number(a.attrs.talent||0)))fail("Неверный пул Наказания");s.opportunities=s.opportunities.filter(o=>o.id!==p.id);beginAttack(a,{name:"Наказание",targetIds:[opportunity.targetId],amount:result.successes});break;}
        case "search": {const target=requiredActor(scene,p.targetId);if(scene.activeActorId!==a.id||target.team===a.team||!effectActive(scene,target,"positive.исчез"))fail("Поиск: на своём Ходу выберите Исчезнувшего противника");spend(a,"ap",2);removeEffect(target,"positive.исчез");break;}
        case "invisible":if(!effectActive(scene,a,"positive.невидим"))fail("Нет Невидимости");removeEffect(a,"positive.невидим");applyEffect(a,{effect:"positive.исчез",duration:"startTurn"},a.id);break;
        case "configure-resource": {
          if (resources.has(p.id)) fail("ID совпадает со встроенным показателем");
          mutateCounter(p, sourceId, "resource", Object.hasOwn(a.ruleResources || {}, p.id) ? "configure" : "create");
          break;
        }
        case "counter": {
          if (p.type === "resource" && resources.has(p.id)) fail("ID совпадает со встроенным показателем");
          mutateCounter(p, sourceId);
          break;
        }
        case "clock": {
          mutateCounter(p, sourceId, "clock");
          break;
        }
        case "roll": publishRoll(a, p.roll, p.label || "Бросок"); break;
        case "prompt": choice(requiredActor(scene,p.targetId||sourceId), "manual", String(p.title || "Решение правила").slice(0,240), ["record"], { ruleId: p.ruleId, text: String(p.text || "").slice(0,1200) }); break;
        case "choice": {
          const pending = s.choices[0];
          if (!pending || pending.id !== p.id || pending.actorId !== sourceId || !pending.options.includes(p.choice)) fail("Решение устарело или принадлежит другому участнику");
          if (executionCursor?.status === "waiting") {
            executionCursor = foundations.resumeCursor(executionCursor, pending.id, sourceId);
            s.executionCursor = executionCursor;
          }
          s.choices.shift();
          if (pending.kind === "replacement" || pending.kind === "rule-trigger") {
            const item = queue.find(item => item.p.kind === "execution-frame" && item.p.frame.id === pending.context.frameId);
            if (!item || item.p.frame.ownerActorId !== sourceId) fail("Продолжение последствия отсутствует");
            item.p.frame = global.DAWN_LIONWING_EXECUTION.choose(item.p.frame, p.choice);
          }
          else if (pending.kind === "geometry-boundary") {
            const context = pending.context || {}, cursor = s.geometryCursor;
            const expectedCursorSegment = context.cursorSegmentIndex ?? Number(context.segmentIndex) + 1;
            if (!cursor || cursor.id !== context.cursorId || Number(cursor.segmentIndex) !== Number(expectedCursorSegment) || context.boundary !== "enter") fail("Продолжение сегмента движения отсутствует");
            const stopChoices = new Set(Array.isArray(context.stopChoices) ? context.stopChoices : ["stop"]);
            if (stopChoices.has(p.choice)) {
              queue.length = 0;
              s.deferred = [];
              s.afterAttack = [];
              delete s.executionCursor;
              delete s.geometryCursor;
              const target = requiredActor(scene, context.targetId || sourceId, false), route = context.route || null;
              if (route) geometryCommit({ ...route, path: (route.path || []).slice(0, Number(context.segmentIndex) + 1) }, target, { sourceActorId: route.sourceActorId, label: "Движение остановлено решением" }, { ...cursor, status: "completed", phase: "terminal" }, true, "decision");
              else emit("geometry.route.stop", sourceId, { targetId: target.id, routeId: context.routeId || null, segmentIndex: context.segmentIndex, reason: "decision", terminal: true, stoppedAt: { space: target.space, x: Number(target.x), y: Number(target.y) } });
            }
          }
          else if (pending.kind === "knockout") { if (p.choice === "resist") { a[pending.context.track] = 1; a.hp = a.maxHp; astate(a).vulnerable = true; } else knockout(a); }
          else if(pending.kind==="clash-loss"||pending.kind==="clash-tie"){
            if(!scene.pendingAction||scene.pendingAction.id!==pending.context.attackId)fail("Атака больше не ожидает Столкновения");
            if(p.choice==="reroll")queue.unshift({p:{kind:"damage",targetId:a.id,amount:5,sourceActorId:a.id},sourceId:a.id},{p:{kind:"clash-roll",roll:p.roll,opponentRoll:p.opponentRoll},sourceId:a.id});
            else if(p.choice==="win")queue.unshift({p:{kind:"clash-win"},sourceId:a.id});
            else scene.pendingAction.responses[a.id]={choice:"clash",reduction:0};
          }
          else if(pending.kind==="duel-outcome"){
            const duel=(s.duels||[]).find(item=>item.id===pending.context.duelId);if(!duel)fail("Дуэль уже завершена");
            if(p.choice==="win")duelStake(duel,duel.targetId);
            else if(duel.doubledDown){gain(a,"influence",duel.influenceSpent);duelStake(duel,duel.actorId);}
            else choice(a,"duel-failure","Инициатор проиграл Дуэль: Отступить отменяет ставку для обоих; Принять удар возвращает Влияние; Удвоить ставку повышает Напряжение Дуэли на 2 и требует нового броска.",["bail","take-it","double-down"],{duelId:duel.id});
          }
          else if(pending.kind==="duel-failure"){
            const duel=s.duels.find(item=>item.id===pending.context.duelId);if(!duel)fail("Дуэль уже завершена");
            if(p.choice==="bail")duelReturn(duel);
            else if(p.choice==="take-it"){gain(a,"influence",duel.influenceSpent);duelStake(duel,duel.actorId);}
            else {duel.doubledDown=true;duel.tension+=2;duelOutcome(duel);}
          }
          else if(pending.kind==="duel-wounds"){
            const duel=s.duels.find(item=>item.id===pending.context.duelId);if(!duel)fail("Дуэль уже завершена");
            const sourceId=duel.loserId===duel.actorId?duel.targetId:duel.actorId;
            // Resume pre-clarification saves using the author's final ruling.
            queue.unshift({p:{kind:"wound",targetId:duel.loserId,sourceActorId:sourceId},sourceId},{p:{kind:"duel-return",duelId:duel.id},sourceId:duel.actorId});
          }
          else if (pending.kind === "placement") {
            if(pending.context.edge){
              const target=requiredActor(scene,pending.context.targetId,false),board=scene.spaces.find(item=>item.id===pending.context.returnSpaceId),d=p.destination;
              if(!board||!d||![0,board.width-1].includes(d.x)&&![0,board.height-1].includes(d.y))fail("Выберите клетку на краю исходного поля");
              move(target,{destination:{...d,space:board.id},placement:true});
              for(const part of scene.actors.filter(item=>item.id===target.id||target.compoundId&&item.compoundId===target.compoundId))delete astate(part).duelId;
              if(!scene.actors.some(item=>item.lionwing?.duelId===pending.context.duelId)){
                const duel=s.duels.find(item=>item.id===pending.context.duelId);scene.spaces=scene.spaces.filter(item=>item.id!==duel.spaceId);s.duels=s.duels.filter(item=>item.id!==duel.id);scene.activeSpace=board.id;emit("duel.end",duel.actorId,{targetId:duel.targetId});
              }
              emit("rule.respond",sourceId,{...p,title:pending.title});break;
            }
            const destination = { ...p.destination, space: a.space }, source = actor(scene, pending.context.adjacentTo);
            if (source && distance(destination, source) !== 1 || pending.context.reappear && scene.actors.some(x => live(x) && x.id !== a.id && distance(destination, x) <= 1)) fail("Клетка не соответствует условию появления");
            move(a, { destination:{...destination,space:source?.space||a.space}, placement: true, followSnare:true });
          } else if (!String(p.note || "").trim()) fail("Запишите принятое решение");
          emit("rule.respond", sourceId, { ...p, title: pending.title });
          break;
        }
        case "reaction": {
          const pending = scene.pendingAction;
          if (!pending?.lionwing || !pending.targetIds.includes(sourceId) || pending.responses[sourceId]?.choice !== "pending") fail("Эта Реакция уже недоступна");
          if (!["take", "block", "dodge", "clash"].includes(p.choice)) fail("Неизвестная Реакция");
          requiredActor(scene, sourceId);
          const response = { choice: p.choice, temporaryArmor: 0, reduction: 0 };
          if (p.choice !== "take") spend(a, "focus", 2);
          const attacker = requiredActor(scene, pending.actorId, false);
          if (p.choice === "block") {
            response.temporaryArmor = Number(a.attrs.body || 0);
            if (!effectActive(scene,a,"positive.устойчив")) {
              const d = { x: a.x + Math.sign(a.x - attacker.x), y: a.y + Math.sign(a.y - attacker.y) };
              try { movement(scene, a, d, { forced: true, maximum: 1, line: true }); move(a, { destination: d, forced: true, maximum: 1, line: true }); } catch { /* A push stops at an obstruction. */ }
            }
          }
          if (p.choice === "dodge") {
            const chosen = p.attribute || (a.attrs.talent >= a.attrs.mind ? "talent" : "mind");
            if (!["talent", "mind"].includes(chosen)) fail("Уворот использует Талант или Разум");
            const gain = Math.ceil(Number(a.attrs[chosen] || 0) / 2); a.evasion = Number(a.evasion || 0) + gain;
            if(!p.destination||distance(a,{...p.destination,space:a.space})===0)fail("Уворот требует движения");
            move(a, { destination: p.destination, maximum: scaledMove(a, 2,scene) }); response.preventForcedMovement = true;
          }
          if (p.choice === "clash") {pending.responses[sourceId]={choice:"pending"};queue.unshift({p:{kind:"clash-roll",roll:p.roll,opponentRoll:p.opponentRoll},sourceId});}
          else pending.responses[sourceId] = response;
          emit("reaction.respond", sourceId, { ...response, attackId: pending.id }); break;
        }
        case "clash-roll":{
          const pending=scene.pendingAction;if(!pending||!live(a)){if(pending)pending.responses[sourceId]={choice:"unavailable"};break;}
          const attacker=requiredActor(scene,pending.actorId,false),own=publishRoll(a,p.roll,"Столкновение"),other=publishRoll(attacker,p.opponentRoll,"Столкновение");
          if(own.initialCount!==3+Number(a.tier||1)||other.initialCount!==3+Number(attacker.tier||1))fail("Неверный пул Столкновения");
          if(own.successes>other.successes)queue.unshift({p:{kind:"clash-win"},sourceId});
          else if(own.successes<other.successes)choice(a,"clash-loss","Столкновение проиграно: принять Атаку или получить 5 урона и перебросить?",["accept","reroll"],{attackId:pending.id});
          else choice(a,"clash-tie","Ничья Столкновения: Нарратор определяет победителя",["win","lose"],{attackId:pending.id});
          break;
        }
        case "clash-win":{const pending=scene.pendingAction;if(!pending)fail("Атака завершена");const reduction=Number(a.attrs.spirit||0);pending.responses[a.id]={choice:"clash",reduction};applyDamage({targetId:pending.actorId,sourceActorId:a.id,amount:reduction});break;}
        case "duel-return":{const duel=s.duels.find(item=>item.id===p.duelId);if(duel)duelReturn(duel);break;}
        case "resolve-attack": {
          const pending = scene.pendingAction;
          if (!pending?.lionwing || pending.targetIds.some(id => live(actor(scene, id)) && !effectActive(scene,actor(scene,id),"positive.исчез") && pending.responses[id]?.choice === "pending")) fail("Сначала дождитесь всех Реакций");
          scene.pendingAction = null;
          const operations = [];
          for (let i = 0; i < pending.repeat; i++) for (const targetId of pending.targetIds) {
            if(effectActive(scene,actor(scene,targetId),"positive.исчез"))continue;
            const response = pending.responses[targetId] || {};
            operations.push({ kind: "damage", sourceActorId: pending.actorId, targetId, amount: pending.targetDamage?.[targetId]??pending.damage, attack: true, reduction: response.reduction || 0, temporaryArmor: response.temporaryArmor || 0, effects: pending.effects, finalDamage: pending.finalDamage, ignoreArmor:pending.ignoreArmor, ignoreEvasion:pending.ignoreEvasion, irreducible:pending.irreducible, preventForcedMovement:response.preventForcedMovement });
          }
          for(const tail of s.afterAttack||[]){
            if(tail.kind==="move"&&tail.forced&&pending.responses[tail.targetId||tail.sourceActorId]?.preventForcedMovement)emit("movement.prevented",pending.actorId,{targetId:tail.targetId||tail.sourceActorId,reason:"Уворот",attackId:pending.id});
            else operations.push(tail);
          } s.afterAttack = [];
          queue.unshift(...operations.map(p => { const saved=p.__execution;const operation={...p};delete operation.__execution;return { p: operation, sourceId: p.sourceActorId ?? pending.actorId, provenance: saved || { rootActionId: pending.id, actionId: pending.sourceActionId, actionDefinitionId:pending.sourceActionId, actionInstanceId:pending.actionInstanceId||pending.id, causeEventId: rootId, ownerActorId: pending.actorId } }; }));
          emit("attack.clear", pending.actorId, { name: pending.name }); break;
        }
        case "amend-attack": {
          const pending=scene.pendingAction;if(!pending?.lionwing||s.choices.length)fail("Изменение Атаки доступно до разрешения и вне ожидающего решения");
          const targets=targetIds(scene,p.targetIds||pending.targetIds);if(!targets.length)fail("Выберите цели Атаки");
          for(const id of targets){const target=requiredActor(scene,id);if(effectActive(scene,target,"positive.исчез"))fail("Цель отсутствует на поле");}
          const targetDamage=p.targetDamage||{};for(const[id,value]of Object.entries(targetDamage)){if(!targets.includes(id))fail("Урон указан для посторонней цели");integer(value,"урон цели");}
          pending.targetIds=targets;pending.damage=integer(p.amount??pending.damage,"урон");pending.targetDamage=copy(targetDamage);
          pending.responses=Object.fromEntries(targets.map(id=>[id,pending.responses[id]||{choice:"pending"}]));
          for(const key of ["ignoreArmor","ignoreEvasion","irreducible","finalDamage"])if(p[key]!==undefined)pending[key]=p[key]===true;
          emit("attack.amend",sourceId,{targetIds:targets,amount:pending.damage,targetDamage});break;
        }
        case "pause-chain": {
          if(!scene.pendingAction&&!s.choices.length)fail("Нет ожидающей цепочки");
          s.pausedChains||=[];if(s.pausedChains.length>=8)fail("Слишком много вложенных цепочек");
          const pausedOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null;
          s.pausedChains.push({
            pendingAction:scene.pendingAction,
            choices:s.choices,
            deferred:s.deferred,
            afterAttack:s.afterAttack||[],
            executionCursor:s.executionCursor||null,
            turnFrame: pausedOwner ? {
              schema: 1,
              actorId: pausedOwner.id,
              turnInstanceId: s.activeTurnInstanceId || null,
              ownerTurnSerial: ownTurnSerial(pausedOwner),
              sceneTurnSerial: Number(scene.turnSerial || 0),
            } : null,
          });
          scene.pendingAction=null;s.choices=[];s.deferred=[];s.afterAttack=[];delete s.executionCursor;executionCursor=null;emit("chain.pause",sourceId,{depth:s.pausedChains.length});break;
        }
        case "resume-chain": {
          if(scene.pendingAction||s.choices.length||s.deferred.length)fail("Сначала завершите вложенное решение");
          const previous=s.pausedChains?.pop();if(!previous)fail("Нет приостановленной цепочки");
          if (previous.turnFrame) {
            const frame = previous.turnFrame, resumed = actor(scene, frame.actorId);
            if (!resumed) fail("Владелец приостановленного Хода отсутствует");
            if (resumed.knockedOut) fail("Владелец приостановленного Хода выведен из боя");
            if (scene.activeActorId && scene.activeActorId !== frame.actorId) fail("Приостановленный Ход принадлежит другому участнику");
            if (ownTurnSerial(resumed) !== Number(frame.ownerTurnSerial)) fail("Сериал приостановленного Хода изменился");
            scene.activeActorId = frame.actorId;
            scene.turnSerial = Number(frame.sceneTurnSerial ?? scene.turnSerial ?? 0);
            s.activeTurnInstanceId = frame.turnInstanceId || s.activeTurnInstanceId || `legacy-turn:${scene.turnSerial}`;
            resumed.lionwing ||= {};
            resumed.lionwing.turnInstanceId = s.activeTurnInstanceId;
            resumed.lionwing.lastTurnInstanceId = s.activeTurnInstanceId;
            resumed.lionwing.ownerTurnInstanceId = s.activeTurnInstanceId;
            s.activeTurn = { schema: 1, turnInstanceId: s.activeTurnInstanceId, actorId: frame.actorId, sceneTurnSerial: scene.turnSerial, ownerTurnSerial: frame.ownerTurnSerial, ownerTurnKey: ownerTurnKey(s.sceneSerial, resumed, frame.ownerTurnSerial), kind: s.activeTurn?.kind === "extra" ? "extra" : "normal" };
          }
          scene.pendingAction=previous.pendingAction;s.choices=previous.choices;s.deferred=previous.deferred;s.afterAttack=previous.afterAttack;
          if(previous.executionCursor){executionCursor=foundations.openCursor(previous.executionCursor);s.executionCursor=executionCursor;}else{executionCursor=null;delete s.executionCursor;}
          emit("chain.resume",sourceId,{depth:s.pausedChains.length});break;
        }
        case "cancel-attack": scene.pendingAction = null; s.afterAttack = []; emit("attack.clear", sourceId, { cancelled: true }); break;
        case "turn-start": {
          const status = turnStartStatus(scene, sourceId); if (!status.available) fail(status.reason);
          const extraTurn = Boolean(s.grantedTurns?.length && s.grantedTurns[0].actorId === a.id);
          if(s.grantedTurns?.length){s.grantedTurns.shift();astate(a).grantedTurn={lastTeam:s.lastTeam,lastActorId:s.lastActorId,acted:a.acted};}
          if (!s.started) { s.started = true; for (const hero of scene.actors.filter(isPlayer)) hero.focus = 1 + Math.ceil(Number(hero.attrs.spirit || 0) / 2); for (const other of scene.actors) other.ap = 0; }
          scene.activeActorId = a.id;
          scene.turnSerial = Number(scene.turnSerial || 0) + 1;
          s.activeTurnInstanceId=rootId;
          const nextOwnerTurnSerial = ownTurnSerial(a) + 1;
          normalizeTurnCounters(a);
          a.lionwing.turns = nextOwnerTurnSerial;
          a.lionwing.turnCount = nextOwnerTurnSerial;
          a.lionwing.turnsStarted = nextOwnerTurnSerial;
          a.lionwing.ownTurnSerial = nextOwnerTurnSerial;
          a.lionwing.ownerTurnSerial = nextOwnerTurnSerial;
          a.lionwing.turnSerial = nextOwnerTurnSerial;
          a.lionwing.turnInstanceId = s.activeTurnInstanceId;
          a.lionwing.lastTurnInstanceId = s.activeTurnInstanceId;
          a.lionwing.ownerTurnInstanceId = s.activeTurnInstanceId;
          a.lionwing.ownerTurnKey = ownerTurnKey(s.sceneSerial, a, nextOwnerTurnSerial);
          s.activeTurn = { schema: 1, turnInstanceId: s.activeTurnInstanceId, actorId: a.id, sceneTurnSerial: scene.turnSerial, ownerTurnSerial: nextOwnerTurnSerial, ownerTurnKey: ownerTurnKey(s.sceneSerial, a, nextOwnerTurnSerial), kind: extraTurn ? "extra" : "normal" };
          astate(a).turnActions = []; astate(a).startedDisappeared = effectActive(scene,a,"positive.исчез");
          const difficult=new Set(scene.objects.filter(o=>o.space===a.space&&o.type==="difficult").flatMap(o=>o.cells||[]));
          const start=[];for(let y=0;y<Number(a.occupiedHeight||1);y++)for(let x=0;x<Number(a.occupiedWidth||1);x++){const cell=`${a.x+x},${a.y+y}`;if(difficult.has(cell))start.push(cell);}
          if(start.length){const connected=new Set(start),queue=[...start];while(queue.length){const [x,y]=queue.shift().split(",").map(Number);for(const cell of [`${x+1},${y}`,`${x-1},${y}`,`${x},${y+1}`,`${x},${y-1}`])if(difficult.has(cell)&&!connected.has(cell)){connected.add(cell);queue.push(cell);}}astate(a).difficultTerrainIgnoreSerial=scene.turnSerial;astate(a).difficultTerrainIgnoreSpace=a.space;astate(a).difficultTerrainIgnoreCells=[...connected];}
          a.ap = Math.max(0, Number(a.baseAp ?? 3) - (effectActive(scene,a,"negative.ошеломлен") ? 1 : 0)); a.stepRemaining = 0; s.breakout = null; s.opportunities = [];
          phase("startTurn", a);
          const duel=(s.duels||[]).find(item=>item.id===astate(a).duelId);
          if(duel&&scene.turnSerial>duel.startedSerial){
            scene.activeSpace=duel.returnSpaceId;
            duelOutcome(duel);
          }
          if (effectActive(scene,a,"negative.подброшен")) removeEffect(a, "negative.подброшен");
          if (astate(a).startedDisappeared&&!s.choices.some(c=>c.actorId===a.id&&c.kind==="placement"&&c.context.reappear)) { if (effectActive(scene,a,"positive.исчез")) removeEffect(a, "positive.исчез",{reappear:false}); choice(a, "placement", "Выберите клетку появления вне соседства с персонажами", ["place"], { reappear: true }); }
          emit("turn.start", a.id, { ap: a.ap }); break;
        }
        case "turn-end": {
          if (scene.activeActorId !== sourceId || scene.pendingAction || s.choices.length || s.pausedChains?.length) fail("Нельзя завершить этот Ход: есть незавершённое действие");
          if (effectActive(scene,a,"positive.регенерирует")) applyHealing({targetId:a.id,amount:4+Number(a.tier||1)},a.id);
          phase("endTurn", a); a.ap = 0; a.stepRemaining = 0; a.acted = true; scene.activeActorId = null; s.lastTeam = a.team; s.lastActorId = a.id; s.breakout = { actorId: a.id, turnSerial: scene.turnSerial }; s.opportunities = [];
          for(const other of scene.actors)if(Number(other.lionwing?.difficultTerrainStopSerial)===Number(scene.turnSerial))delete other.lionwing.difficultTerrainStopSerial;
          if(astate(a).grantedTurn){const resume=astate(a).grantedTurn;s.lastTeam=resume.lastTeam;s.lastActorId=resume.lastActorId;a.acted=resume.acted;delete astate(a).grantedTurn;}
          s.lastTurn = copy(s.activeTurn || { schema: 1, turnInstanceId: s.activeTurnInstanceId || null, actorId: a.id, sceneTurnSerial: scene.turnSerial, ownerTurnSerial: ownTurnSerial(a), ownerTurnKey: ownerTurnKey(s.sceneSerial, a) });
          emit("turn.end", a.id);delete s.activeTurn;delete s.activeTurnInstanceId; break;
        }
        case "round-end": {
          const status = roundEndStatus(scene); if (!status.available) fail(status.reason);
          phase("roundEnd", null); scene.round++; scene.tension++; s.lastTeam = null; s.breakout = null;
          for (const other of scene.actors) { other.acted = other.kind === "crowd"; other.usedActions = []; other.ap = 0; other.stepRemaining = 0; }
          emit("round.end", null); break;
        }
        case "scene-reset": {
          if(scene.pendingAction||s.choices.length||s.deferred.length||s.duels?.length||s.pausedChains?.length)fail("Сначала завершите ожидающие решения и Дуэли");
          for(const target of scene.actors){
            resetCounters(target,"scene");
            target.hp=target.maxHp;target.knockedOut=false;target.evasion=0;target.ap=0;target.acted=target.kind==="crowd";target.usedActions=[];target.stepRemaining=0;
            const persistentStates={};
            for(const [effect,saved] of Object.entries(target.effectStates||{})){
              const sources=Array.isArray(saved?.sources)?saved.sources:[];
              if(sources.length){
                const retained=sources.filter(source=>(source.duration||saved.duration)==="persistent"||source.lifetime==="persistent");
                if(retained.length)persistentStates[effect]={...saved,duration:"persistent",lifetime:"persistent",removable:retained.every(source=>source.removable!==false),sources:retained};
              }else if(saved?.duration==="persistent"||saved?.lifetime==="persistent")persistentStates[effect]=saved;
            }
            target.effectStates=persistentStates;target.effects=Object.keys(persistentStates);
            target.lionwing={};
          }
          scene.lionwing={schema:2,started:false,choices:[],deferred:[],receipts:s.receipts,history:s.history,auras:s.auras.filter(aura=>aura.lifetime==="persistent"),sceneSerial:s.sceneSerial+1,chapterSerial:s.chapterSerial};
          scene.round=1;scene.turnSerial=0;scene.tension=0;scene.activeActorId=null;scene.targetIds=[];scene.targetCells=[];scene.results=null;
          scene.pendingAction=null;scene.pendingPrompt=null;scene.pendingActionPlan=null;scene.triggerQueue=[];scene.opposedRoll=null;scene.challengeRequest=null;scene.turnUndo=[];delete scene.lionwing.executionCursor;
          scene.objects=scene.objects.filter(item=>item.duration==="persistent");scene.markers=scene.markers.filter(item=>item.duration==="persistent");
          scene.reminders=[];
          if(p.clearTable){scene.actors=[];scene.selectedActor=null;}
          for(const target of scene.actors)for(const collection of [target.ruleResources,target.ruleClocks])for(const definition of Object.values(collection||{}))if(definition?.lifetime&&typeof definition.lifetime==="object")definition.lifetime=foundations.lifetimeBoundary(definition.lifetime.boundary,{ownerActorId:definition.lifetime.ownerActorId||target.id,ownerTurnSerial:0,ownerTurnInstanceId:null,sceneSerial:scene.lionwing.sceneSerial});
          const orphanedAuras=scene.lionwing.auras.filter(aura=>aura.sourceLossPolicy==="remove"&&!auraSourceEntity(scene,aura.sourceEntityId));
          scene.lionwing.auras=scene.lionwing.auras.filter(aura=>!orphanedAuras.includes(aura));
          for(const aura of orphanedAuras)emit("aura.remove",sourceId,{auraId:aura.id,id:aura.id,ownerActorId:aura.ownerActorId,sourceEntityId:aura.sourceEntityId,effectId:aura.effectId,ruleId:aura.ruleId,reason:"source-lost-on-scene-reset"});
          emit("scene.reset",sourceId,{clearTable:Boolean(p.clearTable)});break;
        }
        case "chapter-start": {
          if(scene.pendingAction||s.choices.length||s.deferred.length||s.pausedChains?.length)fail("Сначала завершите ожидающие решения");
          s.chapterSerial++;s.sceneSerial++;
          for(const target of scene.actors){
            for(const saved of Object.values(target.effectStates||{}))for(const source of saved?.sources||[])if(source.lifetime&&typeof source.lifetime==="object")source.lifetime=foundations.lifetimeBoundary(source.lifetime.boundary,{ownerActorId:source.lifetime.ownerActorId||source.ownerActorId||target.id,ownerTurnSerial:source.lifetime.ownerTurnSerial,ownerTurnInstanceId:source.lifetime.ownerTurnInstanceId||null,sceneSerial:s.sceneSerial});
            for(const collection of [target.ruleResources,target.ruleClocks])for(const definition of Object.values(collection||{}))if(definition?.lifetime&&typeof definition.lifetime==="object")definition.lifetime=foundations.lifetimeBoundary(definition.lifetime.boundary,{ownerActorId:definition.lifetime.ownerActorId||target.id,ownerTurnSerial:definition.lifetime.ownerTurnSerial,ownerTurnInstanceId:definition.lifetime.ownerTurnInstanceId||null,sceneSerial:s.sceneSerial});
          }
          for(const aura of [...s.auras]){if(aura.lifetime==="chapter")removeAuraRecord(aura,"expired",sourceId);else if(aura.lifetime&&typeof aura.lifetime==="object")aura.lifetime=foundations.lifetimeBoundary(aura.lifetime.boundary,{ownerActorId:aura.lifetime.ownerActorId||aura.ownerActorId,ownerTurnSerial:aura.lifetime.ownerTurnSerial,ownerTurnInstanceId:aura.lifetime.ownerTurnInstanceId||null,sceneSerial:s.sceneSerial});}
          emit("chapter.start",sourceId,{chapterSerial:s.chapterSerial,sceneSerial:s.sceneSerial});break;
        }
        case "tension": {
          const amount=integer(p.amount,"Напряжение",999);
          if(p.duelId){const duel=(s.duels||[]).find(item=>item.id===p.duelId);if(!duel)fail("Дуэль уже завершена");duel.tension=amount;emit("duel.tension",sourceId,{duelId:duel.id,amount});}
          else {scene.tension=amount;emit("scene.tension",sourceId,{amount});}break;
        }
        case "note": emit("rule.respond", sourceId, { note: String(p.note || "").slice(0,1200) }); break;
        default: fail(`Операция LionWing пока не поддерживается: ${p.kind}`);
      }
    }

    let request = event.payload;
    if (event.type !== "lionwing.command") {
      const p = event.payload || {}, mapped = {
        "turn.start": { kind: "turn-start" }, "turn.end": { kind: "turn-end" }, "round.end": { kind: "round-end" },
        "damage.apply": { kind: "damage", ...p, sourceActorId: event.actorId, attack: p.attack === true || Boolean(p.sourceActionId && p.sourceActionId !== "manual.adjudication") },
        "actor.heal": { kind: "heal", ...p }, "actor.wound": { kind: "wound", ...p }, "actor.knockout": { kind: "knockout", ...p },
        "resource.gain": { kind: "resource", operation: "gain", ...p }, "resource.spend": { kind: "resource", operation: "spend", ...p },
        "effect.apply": { kind: "effect", ...p }, "effect.remove": { kind: "effect", ...p, remove: true },
        "actor.move": { kind: "move", ...p, maximum: p.maximum ?? 99 }, "actor.enter": { kind: "note", note: "Вход в клетку" }
      };
      request = mapped[event.type];
      if (!request) fail(`Событие ${event.type} не перенесено в LionWing`);
    }
    const pendingActionId = scene.pendingAction?.sourceActionId || null;
    provenance = foundations.identity({ rootActionId: rootId, actionId: request.actionId || pendingActionId || `operation.${request.kind}`, actionDefinitionId:request.actionId||pendingActionId||`operation.${request.kind}`, actionInstanceId:rootId, causeEventId: rootId, ownerActorId: event.actorId || "scene" });
    saveFact("attempt", event.actorId??null, request.targetIds || (request.targetId ? [request.targetId] : []), { kind: request.kind });
    const duelPreparation=s.choices[0]?.kind==="duel-outcome"&&["roll","resource"].includes(request.kind)&&(s.duels||[]).some(duel=>duel.id===s.choices[0].context.duelId&&[duel.actorId,duel.targetId].includes(request.targetId||event.actorId));
    if (s.choices.length && !duelPreparation && !["choice", "correct", "note", "tension", "pause-chain"].includes(request.kind)) fail("Сначала ответьте на ожидающее решение");
    if (scene.pendingAction && !["reaction", "resolve-attack", "cancel-attack", "correct", "note", "choice", "tension","invisible","pause-chain","amend-attack"].includes(request.kind)) fail("Сначала завершите Атаку");
    const operations = request.kind === "batch" ? request.operations : [request];
    if (!Array.isArray(operations) || !operations.length || operations.length > 192 || operations.some(p => !p || p.kind === "batch")) fail("Некорректный пакет операций");
    for(const p of operations){
      if(!api.operations.includes(p.kind))fail("Неизвестная публичная операция LionWing");
      if(p.kind==="geometry-segment")fail("Сегмент движения создаётся только подтверждённым geometry-move");
      if(p.targetId)requiredActor(scene,p.targetId,false);
      if(["damage","heal","resource","correct","tension","spend-health","lose-health"].includes(p.kind))integer(p.amount,"количество");
      if(p.kind==="resource"&&!["spend","gain"].includes(p.operation))fail("Неизвестная операция ресурса");
      if(["effect","effect-source"].includes(p.kind)&&!effectIds.has(p.effect))fail("Неизвестный Эффект LionWing");
      if(p.kind==="effect-source"&&!['remove','expire','suppress','restore'].includes(p.operation))fail("Неизвестная операция источника Эффекта");
      if(p.kind==="aura"&&!['create','update','suppress','restore','remove','expire'].includes(p.operation||"create"))fail("Неизвестная операция ауры");
      if(["aura-create","aura-update","aura-suppress","aura-restore","aura-remove"].includes(p.kind)&&(!(p.id||p.aura?.id)||p.kind==="aura-create"&&!((p.sourceEntityId||p.aura?.sourceEntityId))))fail("Некорректное описание ауры");
    }
    if (request.kind === "choice" && s.deferred.length && !executionCursor) setCursor(s.deferred, 0, s.choices[0]?.id);
    const actionLike = new Set(["action", "record-action", "attack"]);
    const queue = operations.map((p, index) => {
      const operationProvenance = copy(provenance);
      if (actionLike.has(p.kind)) operationProvenance.actionInstanceId = p.actionInstanceId || (operations.length > 1 ? `${rootId}:action:${index}` : operationProvenance.actionInstanceId);
      return { p, sourceId: p.sourceActorId ?? event.actorId, provenance: operationProvenance };
    });
    if (request.kind === "choice") queue.push(...s.deferred.splice(0));
    let steps = 0;
    while (queue.length) {
      if (++steps > 2048) fail("Цепочка слишком длинная: требуется решение Нарратора");
      const item = queue.shift(); provenance = item.provenance || null;
      let waitingFrame = false;
      if (item.p.kind === "execution-frame") {
        let frame = item.p.frame;
        const target = requiredActor(scene, frame.ownerActorId, false);
        provenance = { rootActionId: frame.rootActionId, actionId: frame.actionId || null, actionDefinitionId:frame.actionDefinitionId||frame.actionId||null, actionInstanceId:frame.actionInstanceId||frame.rootActionId, effectInstanceId: frame.effectInstanceId || null, causeEventId: frame.causeEventId, consequenceId: frame.id, ownerActorId: frame.ownerActorId };
        if (frame.phase === "before") {
          if (frame.purpose !== "trigger") frame.replacements = global.DAWN_LIONWING_ADAPTERS.replacements(target, frame.original);
          if (frame.replacements.length) {
            const isTrigger = frame.purpose === "trigger";
            choice(target, isTrigger ? "rule-trigger" : "replacement", isTrigger ? "Эффект получен: применить доступное правило?" : "Получение Эффекта: применить его или заменить?", ["keep", ...frame.replacements.map(rule => rule.id)], { frameId: frame.id, effect: frame.original.effect, labels: { keep: isTrigger ? "Пропустить" : "Применить Эффект", ...Object.fromEntries(frame.replacements.map(rule => [rule.id, rule.label])) } });
            queue.unshift(item);
            waitingFrame = true;
          } else frame = global.DAWN_LIONWING_EXECUTION.choose(frame, "keep");
        }
        if (frame.phase === "apply" || frame.phase === "replace") {
          const plan = global.DAWN_LIONWING_EXECUTION.plan(frame);
          const after = { p: { kind: "execution-frame", frame: { ...frame, phase: "after", outcome: plan.outcome } }, sourceId: item.sourceId };
          if (plan.outcome === "applied") {
            if (frame.original.kind !== "noop") commitEffect(target, frame.original, frame.original.sourceActorId);
            queue.unshift(after);
          } else {
            emit(frame.purpose === "trigger" ? "rule.activated" : "consequence.replaced", target.id, { effect: frame.original.effect, ruleId: plan.ruleId, targetId: target.id });
            queue.unshift(...plan.operations.map(p => ({ p, sourceId: p.sourceActorId ?? target.id, provenance: { ...provenance, ruleId: plan.ruleId, causeEventId: frame.id } })), after);
          }
        } else if (frame.phase === "after") {
          emit(frame.purpose === "trigger" ? "rule.completed" : "consequence.completed", target.id, { targetId: target.id, outcome: frame.purpose === "trigger" ? (frame.selected === "keep" ? "skipped" : "applied") : frame.outcome, effect: frame.original.effect });
          if (frame.purpose !== "trigger" && frame.outcome === "applied") {
            const triggers = global.DAWN_LIONWING_ADAPTERS.afterEffect(target, frame.original);
            queue.unshift(...triggers.map(rule => ({ p: { kind: "execution-frame", frame: global.DAWN_LIONWING_EXECUTION.open({ kind: "noop", effect: frame.original.effect }, { id: `${rootId}:consequence:${frameSerial++}`, rootActionId: frame.rootActionId, actionId: frame.actionId || null, actionDefinitionId:frame.actionDefinitionId||frame.actionId||null, actionInstanceId:frame.actionInstanceId||frame.rootActionId, effectInstanceId: frame.effectInstanceId || null, causeEventId: frame.id, ownerActorId: target.id, purpose: "trigger" }, [rule]) }, sourceId: target.id, provenance: copy(provenance) })));
          }
        }
      } else op(item.p, item.sourceId);
      if (scheduled.length) queue.unshift(...scheduled.splice(0));
      if (!waitingFrame && !["choice", "pause-chain", "resume-chain"].includes(item.p.kind)) completeStep(item);
      if (s.choices.length) break;
      if(scene.pendingAction&&["attack","action","punish"].includes(item.p.kind)&&queue.length){s.afterAttack=[...(s.afterAttack||[]),...queue.map(queued=>({...queued.p,sourceActorId:queued.sourceId,__execution:queued.provenance||provenance}))];if(executionCursor)executionCursor=foundations.resizeCursor(executionCursor,executionCursor.cursor+s.afterAttack.length),s.executionCursor=executionCursor;break;}
    }
    if (s.choices.length) {
      const hasContinuation = queue.length || s.deferred.length || s.afterAttack?.length;
      if (hasContinuation) {
        const continuationItems = queue.length ? queue : s.deferred.length ? s.deferred : s.afterAttack;
        setCursor(continuationItems, completedSteps, s.choices[0].id);
        if (queue.length) s.deferred.push(...queue);
      } else {
        executionCursor = null;
        delete s.executionCursor;
      }
    } else if (!s.deferred.length && !s.afterAttack?.length) {
      delete s.executionCursor;
    }
    output.push(...emitted);
  }

  const sharedTypes = new Set(["movement-traces.clear", "topology.cells.remove", "topology.cells.restore", "roll.public", "challenge.request", "challenge.clear", "opposed.request", "opposed.reroll", "opposed.tie.resolve", "opposed.clear", "rule.share", "session-clock.create", "session-clock.set", "session-clock.add", "session-clock.reset", "session-clock.rename", "session-clock.kind", "session-clock.size", "session-clock.remove", "reminder.create", "reminder.due", "reminder.resolve", "reminder.remove", "actor.spawn", "actor.despawn", "area.create", "area.remove", "area.duration", "object.damage", "object.restore", "wall.create", "wall.damage", "wall.restore", "wall.remove", "marker.create", "marker.move", "marker.remove", "marker.duration", "targets.set", "space.ensure", "space.remove"]);
  function dispatchMany(scene, events, options = {}) {
    if (!Array.isArray(events) || !events.length || events.length > 192) fail("Некорректный пакет событий");
    if (options.expectedVersion !== undefined && Number(options.expectedVersion) !== Number(scene.version || 0)) {
      if(events.every(event=>event?.id&&(scene.lionwing?.receipts||[]).some(receipt=>receipt.id===event.id&&receipt.fingerprint===JSON.stringify([event.type,event.actorId||null,event.payload||{}]))))return {scene:copy(scene),events:[],event:null};
      fail("Конфликт версии Сцены: обновите состояние");
    }
    let next = copy(scene); next.rulesEdition = "lionwing"; next.log ||= []; state(next);
    const output = [];
    for (const raw of events) {
      const event = { ...copy(raw), id: raw.id || global.crypto?.randomUUID?.() || `lw-${Date.now()}-${Math.random().toString(36).slice(2)}`, at: raw.at || new Date().toISOString(), payload: copy(raw.payload || {}) };
      if(!event.visibility&&actor(next,event.actorId)?.hidden)event.visibility="gm";
      const fingerprint = JSON.stringify([event.type, event.actorId || null, event.payload]);
      const receipt = state(next).receipts.find(r => r.id === event.id);
      if (receipt) { if (receipt.fingerprint !== fingerprint) fail("Конфликт ID события"); continue; }
      if (sharedTypes.has(event.type)) {
        // Only structural tools use the old single-event reducer, never its triggers.
        if(event.type==="actor.spawn"){
          const spawned=event.payload.actor,edition=spawned?.rulesEdition||(spawned?.profileId?.startsWith("lionwing.")?"lionwing":"ru-v0.9");
          if(!["token","crowd"].includes(spawned?.kind)&&edition!=="lionwing")fail("Нельзя добавить участника другой редакции");
        }
        if(["actor.despawn","space.remove"].includes(event.type)&&(next.pendingAction||state(next).choices.length||state(next).duels?.length||state(next).pausedChains?.length))fail("Сначала завершите ожидающее действие");
        const result = legacy.dispatch(next, event); next = result.scene; output.push(result.event);
        const lostSourceId=event.type==="marker.remove"?event.payload?.markerId:event.type==="actor.despawn"?event.actorId||event.payload?.actorId:null;
        removeAurasForLostSource(next,lostSourceId);
      } else { execute(next, event, output); next.version = Number(next.version || 0) + 1; }
      state(next).receipts.push({ id: event.id, fingerprint }); state(next).receipts = state(next).receipts.slice(-256);
    }
    return { scene: next, events: output, event: output[output.length - 1] };
  }
  function previewEvents(scene, events, options = {}) {
    try { return { ok: true, ...dispatchMany(scene, events, options), errors: [] }; }
    catch (error) { return { ok: false, errors: [error.message], code: error.code || "LIONWING_RULE_BLOCKED" }; }
  }
  const api = {
    schema: 2, isScene, prepare, command, dispatchMany, previewEvents,
    turnStartStatus, roundEndStatus, turnIdentity,
    movement, roll, actionStatus, actionDef, speed, balance, canSpend, targetIds, costQuote,
    historyStatus, effectInstanceStatus, activeState, auraRecord, auraStatus, lifetimeExpired,
    lifetimeBoundary: foundations.lifetimeBoundary,
    normalizeLifetime: foundations.normalizeLifetime,
    isLifetimeExpired: foundations.lifetimeExpired,
    operations: ["automation", "plan", "batch", "pause-chain", "resume-chain", "amend-attack", "recover-track", "record-action", "action", "attack", "damage", "spend-health", "lose-health", "heal", "wound", "stress", "knockout", "resource", "correct", "effect", "effect-source", "aura", "aura-create", "aura-update", "aura-suppress", "aura-restore", "aura-remove", "move", "geometry-move", "geometry-segment", "modifier", "allow-action", "grant-turn", "usage", "punish", "invisible", "search", "configure-resource", "counter", "clock", "prompt", "choice", "roll", "reaction", "resolve-attack", "cancel-attack", "turn-start", "turn-end", "round-end", "scene-reset", "chapter-start", "tension", "note"]
  };
  global.DAWN_LIONWING_ENGINE = api;
  const routed = global.DAWN_SCENE_ENGINE;
  const route = (name, handler) => { const previous = legacy[name]; routed[name] = (scene, ...args) => isScene(scene) ? handler(scene, ...args) : previous(scene, ...args); };
  route("dispatchMany", dispatchMany); route("dispatch", (scene, event, options) => dispatchMany(scene, [event], options)); route("previewEvents", previewEvents);
  route("turnStartStatus", turnStartStatus); route("roundEndStatus", roundEndStatus);
  route("prepareAction", (scene, data, request) => prepare(scene, { kind: "action", ...request }));
  route("availableActions", (scene, data, id) => core.actions.list.filter(d => d.type === "action").map(d => { const status = actionStatus(scene, actor(scene, id), d); return { ...d, ...status, cost: `${status.cost ?? d.cost.amount} ${d.cost.resource === "ap" ? "ОД" : d.cost.resource}`, automation: ["action.атаки.дуэль",ids.interact,ids.study].includes(d.id)?"decision":"full" }; }));
  route("effectiveActorSpeed", (scene, id) => sceneSpeed(scene,requiredActor(scene, id, false)));
  route("pendingActionStatus", scene => {
    const pending = scene.pendingAction, targets = pending?.targetIds || [];
    const eligibleIds = targets.filter(id => live(actor(scene, id)) && !effectActive(scene,actor(scene,id), "positive.исчез"));
    const waitingIds = eligibleIds.filter(id => pending.responses[id]?.choice === "pending");
    return { eligibleIds, waitingIds, answeredIds: eligibleIds.filter(id => !waitingIds.includes(id)), unavailableIds: targets.filter(id => !eligibleIds.includes(id)), mustCancel: Boolean(pending && !eligibleIds.length), interruptedReason: "Все цели недоступны" };
  });
  route("availableEnemyRules", () => []);
  const sceneWithActiveEffects = scene => ({
    ...scene,
    actors: (scene.actors || []).map(participant => ({
      ...participant,
      effects: [...new Set([...(participant.effects || []), ...activeState(scene, participant.id).effects.filter(status => status.present).map(status => status.effect)])],
    })),
  });
  route("effectiveEffects", (scene, actorId) => sceneWithActiveEffects(scene).actors.find(participant => participant.id === actorId)?.effects || []);
  for(const name of ["effectStatus","effectExpiryStatus","effectPresenceStatus","effectTargetingStatus","effectMovementStatus","effectCellOccupancyStatus","effectAttackStatus","effectDefenseStatus","attackModifierStatus","attackModifierDestinationStatus","displacementStatus","movementPath","pendingTargetOutcome","reactionOptions","spatialShapeStatus","targetStatus","terrainStatus","topologyStatus","topologyStepDestination"]){
    if(typeof legacy[name]==="function")route(name,(scene,...args)=>legacy[name](sceneWithActiveEffects(scene),...args));
  }
  route("projectScene",(scene,viewer={})=>{
    const projected=legacy.projectScene(scene,viewer);
    if(!["owner","narrator","gm"].includes(viewer.role)){
      delete projected.turnUndo;
      const hidden=new Set(scene.actors.filter(a=>a.hidden).map(a=>a.id));
      for(const marker of scene.markers||[])if(marker.hidden||marker.kind==="hidden")hidden.add(marker.id);
      for(const duel of scene.lionwing?.duels||[])if(hidden.has(duel.actorId)||hidden.has(duel.targetId))hidden.add(duel.id);
      const refersToHidden=value=>typeof value==="string"?hidden.has(value):value&&typeof value==="object"?Object.entries(value).some(([key,item])=>hidden.has(key)||refersToHidden(item)):false;
      projected.log=(projected.log||[]).filter(row=>!refersToHidden(row));
      if(projected.lionwing){
        delete projected.lionwing.history;delete projected.lionwing.pausedChains;delete projected.lionwing.receipts;delete projected.lionwing.deferred;delete projected.lionwing.afterAttack;delete projected.lionwing.executionCursor;
        for(const key of ["choices","duels","opportunities","grantedTurns"])projected.lionwing[key]=(projected.lionwing[key]||[]).filter(item=>!refersToHidden(item));
        projected.lionwing.auras=(projected.lionwing.auras||[]).filter(aura=>!hidden.has(aura.ownerActorId)&&!hidden.has(aura.sourceEntityId));
      }
      if(projected.pendingAction?.targetDamage)projected.pendingAction.targetDamage=Object.fromEntries(Object.entries(projected.pendingAction.targetDamage).filter(([id])=>!hidden.has(id)));
    }
    return projected;
  });
})(typeof window === "object" ? window : globalThis);
