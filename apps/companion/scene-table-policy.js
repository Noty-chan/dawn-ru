"use strict";

// Shared policy and storage-only commands. UI preferences are deliberately not
// consulted here. Authorization belongs to the authoritative commit boundary.
(function (global) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const RESOURCE_FIELDS = Object.freeze(["hp", "maxHp", "ap", "baseAp", "focus", "influence", "wounds", "stress", "armor", "evasion", "speed"]);
  const installed = new WeakSet();
  const approvedHistoryAnchors = new Set();
  let serial = 0;
  function fail(message, code = "TABLE_COMMAND_INVALID") {
    const error = new Error(message); error.code = code; throw error;
  }
  function normalizePolicy(raw) {
    return { mode: raw?.mode === "manual" ? "manual" : "rules", processStatuses: raw?.processStatuses === true,
      epoch: Number.isSafeInteger(raw?.epoch) && raw.epoch >= 0 ? raw.epoch : 0 };
  }
  const isManual = scene => normalizePolicy(scene?.tablePolicy).mode === "manual";
  // Shared text-input contract: a sign denotes a delta, unsigned digits a set.
  // Exact corrections are validated by the command boundary, not silently capped.
  function healthInput(value,current,maximum=null){
    const text=String(value??"").trim();
    if(!/^[+-]?\d+$/.test(text))return null;
    const number=Number(text),relative=/^[+-]/.test(text),next=relative?current+number:number;
    return Number.isSafeInteger(next)&&next<=9999?Math.max(0,relative&&Number.isFinite(maximum)&&maximum>0?Math.min(maximum,next):next):null;
  }
  function resourceMaximum(target,key){
    if(key==="stress")return 3+Number(Array.isArray(target?.gifts)&&target.gifts.includes("rebel.supernatural-deafness"));
    if(key==="wounds")return target?.rulesEdition==="lionwing"||String(target?.profileId||"").startsWith("lionwing.")?3:99;
    return key==="influence"?999:key==="armor"?99:9999;
  }
  const AREA_APPEARANCES = ["custom","terrain","difficult","high","low"];
  function capacity(scene, key) { if ((scene[key] || []).length >= 240) fail("На поле уже 240 объектов этого вида. Удалите лишние перед созданием новых.","TABLE_CAPACITY"); }
  function uniqueObjectId(scene,id) {safeId(id);if([...(scene.actors||[]),...(scene.objects||[]),...(scene.markers||[]),...(scene.walls||[])].some(row=>row.id===id))fail("ID объекта уже занят.");}
  function annotation(value) {
    if(value.label!==undefined&&(typeof value.label!=="string"||value.label.length>80))fail("Некорректное название объекта.");
    if(value.color!==undefined&&(typeof value.color!=="string"||!/^#[0-9a-f]{6}$/iu.test(value.color)))fail("Некорректный цвет.");
    if(value.hidden!==undefined&&typeof value.hidden!=="boolean")fail("Некорректная видимость объекта.");
  }
  function clockValue(clock) {exactKeys(clock,["size","value"]);if(!Number.isSafeInteger(clock.size)||clock.size<1||clock.size>1000000||!Number.isSafeInteger(clock.value??0)||(clock.value??0)<0||(clock.value??0)>clock.size)fail("Некорректные часы метки.");}
  const actor = (scene, id) => (scene.actors || []).find(row => row.id === id);
  function requiredActor(scene, id) {
    const row = actor(scene, id); if (!row) fail("Участник отсутствует на столе."); return row;
  }
  function exactKeys(value, keys) {
    if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).some(key => !keys.includes(key))) fail("Неизвестные поля ручной команды.");
  }
  function safeId(value) {
    if (typeof value !== "string" || !value.trim() || value.length > 160 || /[\u0000-\u001f]/u.test(value) || ["__proto__", "constructor", "prototype"].includes(value)) fail("Некорректный ID.");
    return value;
  }
  function validCounters(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 120) fail("Некорректные ручные счётчики.");
    for (const [key, count] of Object.entries(value)) {
      safeId(key);
      if (!Number.isSafeInteger(count) || count < 0 || count > 999) fail("Некорректное значение ручного счётчика.");
    }
  }
  function cell(scene, spaceId, x, y) {
    const space = (scene.spaces || []).find(row => row.id === spaceId);
    if (!space || !Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= space.width || y >= space.height) fail("Клетка находится вне поля.");
    // Walls, terrain, occupancy and status mechanics are advisory in manual.
    return { space: spaceId, x, y };
  }
  function pendingWork(scene) {
    return Boolean(scene.pendingAction || scene.pendingPrompt || scene.pendingActionPlan || scene.triggerQueue?.length
      || scene.lionwing?.pendingActionPlan || scene.lionwing?.choices?.length || scene.lionwing?.deferred?.length
      || scene.lionwing?.pausedChains?.length || scene.lionwing?.afterAttack?.length || scene.lionwing?.executionCursor);
  }
  // Only typed technical references are detached. Actor values, consequences,
  // durations, effect arrays and the historical journal are never executed.
  const REF_KEYS = new Set(["actorId", "objectId", "markerId", "areaId", "wallId", "entityId", "sourceEntityId", "ownerEntityId", "linkedEntityId", "backingId"]);
  const REF_ARRAY_KEYS = new Set(["objectIds", "markerIds", "areaIds", "wallIds", "entityIds", "sourceEntityIds"]);
  function detachReferences(value, ids) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if(["receipts","history","journal","entityReceipts","boundaryReceipts","afterEventReceipts","specialJournal"].includes(key))continue;
      if (REF_KEYS.has(key) && ids.has(item)) value[key] = null;
      else if (REF_ARRAY_KEYS.has(key) && Array.isArray(item)) value[key] = item.filter(id => !ids.has(id));
      else if (key === "links" && Array.isArray(item)) value[key] = item.filter(link => !ids.has(link?.from) && !ids.has(link?.to));
      else detachReferences(item, ids);
    }
  }
  function removeStoredObject(scene, collection, id) {
    if (!(scene[collection] || []).some(row => row.id === id)) fail("Удаляемый объект отсутствует.");
    if (pendingWork(scene)) fail("Сначала завершите ожидающее действие.", "TABLE_PENDING_WORK");
    const ids = new Set([id]);
    const registry = scene.lionwing?.entities;
    const rows = Array.isArray(registry) ? registry.map((row, index) => [index, row]) : Object.entries(registry || {});
    for (const [key, row] of rows) {
      if (Object.entries(row?.backing || {}).some(([ref, value]) => REF_KEYS.has(ref) && value === id)) {
        ids.add(row.id || key);
        if (!Array.isArray(registry)) delete registry[key];
      }
    }
    if (Array.isArray(registry)) scene.lionwing.entities = registry.filter(row => !ids.has(row.id));
    scene[collection] = scene[collection].filter(row => row.id !== id);
    // Do not rewrite receipts or historical records: their original payload is
    // essential for duplicate detection and undo handled by the caller.
    for (const key of ["actors", "objects", "markers", "walls", "reminders", "sessionClocks"]) detachReferences(scene[key], ids);
    if (scene.lionwing) for (const [key, value] of Object.entries(scene.lionwing)) {
      if (!["receipts", "history", "journal", "entityReceipts", "specialJournal", "boundaryReceipts", "afterEventReceipts"].includes(key)) detachReferences(value, ids);
    }
  }
  const LAYOUT_ACTOR_FIELDS = ["id","kind","team","profileId","rulesEdition","name","tier","space","x","y","gmRole","notes","tokenSymbol","tokenColor","tokenImage","portraitImage","hidden","manualInitiativeVisible",...RESOURCE_FIELDS,"attrs","skills","gifts","techniques","knownTechniques","ability","taintedAbility","manualStatuses","manualTechniqueState","manualTechniqueCounters"];
  function replaceLayout(scene,event){
    const p=event.payload;exactKeys(p,["kind","layout","expectedVersion","policyEpoch"]);
    if(event.actorId)fail("Расстановку меняет Нарратор.");
    if(!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion!==Number(scene.version||0))fail("Стол изменился после предпросмотра. Откройте расстановку заново.","SCENE_VERSION_CONFLICT");
    if(!Number.isSafeInteger(p.policyEpoch)||p.policyEpoch!==normalizePolicy(scene.tablePolicy).epoch)fail("Ведение стола изменилось.","TABLE_POLICY_CONFLICT");
    if(pendingWork(scene))fail("Сначала завершите ожидающее действие.","TABLE_PENDING_WORK");
    const layout=p.layout;exactKeys(layout,["scope","name","spaces","activeSpace","actors","objects","walls","markers","artworks","backgroundArt","featuredArt","backgroundView"]);
    if(!["space","table"].includes(layout.scope)||typeof layout.name!=="string"||layout.name.length>120)fail("Некорректная расстановка.");
    if(JSON.stringify(layout).length>1800000)fail("Расстановка слишком большая.","TABLE_CAPACITY");
    if(!Array.isArray(layout.spaces)||!layout.spaces.length||layout.spaces.length>12)fail("Расстановка содержит от 1 до 12 полей.","TABLE_CAPACITY");
    const spaceIds=new Set();
    for(const row of layout.spaces){
      exactKeys(row,["id","name","mode","width","height"]);safeId(row.id);
      if(spaceIds.has(row.id)||typeof row.name!=="string"||row.name.length>60||!["standard","cinematic","custom"].includes(row.mode)||![row.width,row.height].every(value=>Number.isSafeInteger(value)&&value>=1&&value<=12)||row.mode==="standard"&&(row.width!==7||row.height!==7)||row.mode==="cinematic"&&(row.width!==7||row.height!==1))fail("Некорректное поле расстановки.");
      spaceIds.add(row.id);
    }
    if(!spaceIds.has(layout.activeSpace))fail("Активное поле расстановки отсутствует.");
    if(layout.scope==="space"&&(layout.spaces.length!==1||layout.activeSpace!==scene.activeSpace))fail("Расстановка поля должна относиться к текущему полю.");
    const affected=row=>layout.scope==="table"||row.space===scene.activeSpace;
    const retainedHero=row=>row.team==="hero"&&(row.kind==="hero"||row.heroId)||Boolean(row.ownerId||row.characterId||row.heroId);
    const removedActors=(scene.actors||[]).filter(row=>affected(row)&&!retainedHero(row)).map(row=>row.id);
    for(const id of removedActors)removeStoredObject(scene,"actors",id);
    for(const key of ["objects","walls","markers"])for(const row of [...(scene[key]||[])])if(affected(row))removeStoredObject(scene,key,row.id);
    if(layout.scope==="table")scene.spaces=copy(layout.spaces);
    else scene.spaces=scene.spaces.map(row=>row.id===layout.activeSpace?copy(layout.spaces[0]):row);
    scene.activeSpace=layout.activeSpace;
    const allSpaces=new Map(scene.spaces.map(row=>[row.id,row]));
    // Preserve heroes and their frozen records. Only map coordinates may change.
    for(const row of scene.actors||[]){
      const space=allSpaces.get(row.space)||allSpaces.get(layout.activeSpace);
      if(!allSpaces.has(row.space))row.space=space.id;
      if(affected(row)||!Number.isInteger(row.x)||!Number.isInteger(row.y)){row.x=Math.max(0,Math.min(space.width-1,Number(row.x)||0));row.y=Math.max(0,Math.min(space.height-1,Number(row.y)||0));}
    }
    if(!Array.isArray(layout.actors)||(scene.actors||[]).length+layout.actors.length>120)fail("Лимит участников — 120.","TABLE_CAPACITY");
    for(const row of layout.actors){
      exactKeys(row,LAYOUT_ACTOR_FIELDS);uniqueObjectId(scene,row.id);
      if(!["enemy","hero","crowd","token"].includes(row.kind)||!["enemy","hero"].includes(row.team)||!spaceIds.has(row.space)||typeof row.name!=="string"||row.name.length>120||row.rulesEdition!==scene.rulesEdition||!Number.isSafeInteger(row.tier)||row.tier<0||row.tier>99)fail("Некорректный участник расстановки.");
      if(scene.rulesEdition==='lionwing'&&String(row.profileId||'').startsWith('enemy.'))fail("Профиль старой редакции нельзя импортировать в LionWing.");
      if(row.kind==='hero'&&!row.profileId)fail("Листы героев сохраняются на столе и не импортируются из расстановки.");
      cell(scene,row.space,row.x,row.y);
      for(const key of RESOURCE_FIELDS)if(!Number.isSafeInteger(row[key])||row[key]<0||row[key]>resourceMaximum(row,key))fail("Некорректный ресурс участника расстановки.");
      if(row.hp>row.maxHp)fail("Здоровье превышает максимум.");
      for(const key of ["hidden","manualInitiativeVisible"])if(row[key]!==undefined&&typeof row[key]!=="boolean")fail("Некорректная видимость участника.");
      for(const key of ["profileId","gmRole","notes","tokenSymbol","tokenColor","tokenImage","portraitImage"])if(row[key]!==undefined&&row[key]!==null&&typeof row[key]!=="string")fail("Некорректное описание участника.");
      for(const key of ["attrs","skills","gifts","techniques","knownTechniques","ability","taintedAbility","manualStatuses","manualTechniqueState","manualTechniqueCounters"])if(row[key]!==undefined&&JSON.stringify(row[key]).length>16000)fail("Описание участника слишком большое.");
      if(row.manualTechniqueCounters!==undefined)validCounters(row.manualTechniqueCounters);
      scene.actors.push({...copy(row),heroId:null,ownerId:null,characterId:null,effects:[],usedActions:[],usedTrump:false,acted:row.kind==="crowd",knockedOut:false});
    }
    for(const [key,kind] of [["objects","area/create"],["walls","wall/create"],["markers","marker/create"]]){
      if(!Array.isArray(layout[key])||(scene[key]||[]).length+layout[key].length>240)fail("Лимит объектов каждого вида — 240.","TABLE_CAPACITY");
      for(const stored of layout[key]){
        const {ownerActorId,...row}=stored;
        if(!spaceIds.has(row.space)||ownerActorId!==null&&!layout.actors.some(actor=>actor.id===ownerActorId))fail("Некорректный владелец или поле обозначения.");
        reduce(scene,{...event,actorId:ownerActorId,payload:{kind,[kind==="area/create"?"area":kind==="wall/create"?"wall":"marker"]:row}});
      }
    }
    if(layout.scope==="table"){
      if(!Array.isArray(layout.artworks)||layout.artworks.length>12)fail("Лимит артов — 12.","TABLE_CAPACITY");
      const artIds=new Set();
      for(const art of layout.artworks){exactKeys(art,["id","name","kind","image","imageStored","hidden"]);safeId(art.id);if(artIds.has(art.id)||typeof art.name!=="string"||art.name.length>120||!["art","background"].includes(art.kind)||typeof art.image!=="string"||typeof art.hidden!=="boolean"||typeof art.imageStored!=="boolean")fail("Некорректный арт расстановки.");artIds.add(art.id);}
      for(const key of ["backgroundArt","featuredArt"])if(layout[key]!==null&&!artIds.has(layout[key]))fail("Арт расстановки отсутствует.");
      exactKeys(layout.backgroundView,["fit","position","dim","gridOpacity"]);
      if(!["contain","cover"].includes(layout.backgroundView.fit)||!["center","top","bottom","left","right"].includes(layout.backgroundView.position)||!Number.isSafeInteger(layout.backgroundView.dim)||layout.backgroundView.dim<0||layout.backgroundView.dim>85||!Number.isSafeInteger(layout.backgroundView.gridOpacity)||layout.backgroundView.gridOpacity<12||layout.backgroundView.gridOpacity>96)fail("Некорректное отображение фона.");
      scene.artworks=copy(layout.artworks);scene.backgroundArt=layout.backgroundArt;scene.featuredArt=layout.featuredArt;scene.backgroundView=copy(layout.backgroundView);
    }else if(["artworks","backgroundArt","featuredArt","backgroundView"].some(key=>layout[key]!==undefined))fail("Фон меняется только с полной расстановкой.");
    if(!actor(scene,scene.manualTable?.actorId)&&scene.manualTable)scene.manualTable.actorId=null;
    if(!actor(scene,scene.selectedActor))scene.selectedActor=null;
    scene.targetIds=(scene.targetIds||[]).filter(id=>actor(scene,id));scene.targetCells=[];
  }
  function reduce(scene, event) {
    const p = event.payload;
    if (p.kind === "policy") {
      exactKeys(p, ["kind", "mode", "processStatuses"]);
      if (p.processStatuses !== undefined && typeof p.processStatuses !== "boolean") fail("Некорректная настройка пометок.");
      if (!["manual", "rules"].includes(p.mode)) fail("Неизвестная политика стола.");
      const current = normalizePolicy(scene.tablePolicy);
      if (p.mode === "rules" && current.mode === "manual") fail("Начало боя требует явной команды start-rules и выбора первого участника.", "TABLE_START_RULES_REQUIRED");
      const changed = p.mode !== current.mode || p.processStatuses !== undefined && p.processStatuses !== current.processStatuses;
      if (changed && pendingWork(scene)) fail("Сначала завершите ожидающее действие.", "TABLE_PENDING_WORK");
      scene.tablePolicy = { ...current, mode: p.mode, processStatuses: p.processStatuses ?? current.processStatuses, epoch: current.epoch + Number(changed) };
      if (p.mode === "manual") scene.manualTable ||= { actorId: null, round: 1 };
      return;
    }
    if (!isManual(scene)) fail("Ручная команда требует ручной политики стола.", "TABLE_MANUAL_REQUIRED");
    if (p.kind === "start-rules") {
      exactKeys(p, ["kind", "firstActorId", "expectedVersion", "policyEpoch"]);
      if (event.actorId) fail("Бой начинает Нарратор.");
      safeId(p.firstActorId);
      if (p.expectedVersion !== Number(scene.version || 0)) fail("Стол изменился после предпросмотра. Откройте запуск заново.", "SCENE_VERSION_CONFLICT");
      if (p.policyEpoch !== normalizePolicy(scene.tablePolicy).epoch) fail("Ведение стола изменилось.", "TABLE_POLICY_CONFLICT");
      if (pendingWork(scene)) fail("Сначала завершите ожидающее действие.", "TABLE_PENDING_WORK");
      const kernel = global.DAWN_LIONWING_ENGINE;
      if (!kernel?.initializeRulesBattle) fail("Ядро запуска LionWing недоступно.", "TABLE_ENGINE_UNAVAILABLE");
      const started = kernel.initializeRulesBattle(scene, p.firstActorId, event.id, event.at).scene;
      // The enclosing command advances the public version exactly once.
      started.version = scene.version;
      Object.assign(scene, started);
      return;
    }
    if(p.kind === "tension"){exactKeys(p,["kind","value"]);if(!Number.isSafeInteger(p.value)||p.value<0||p.value>999)fail("Некорректное Напряжение.");scene.tension=p.value;}
    else if(p.kind === "layout/replace")replaceLayout(scene,event);
    else if (p.kind === "move") {
      exactKeys(p, ["kind", "space", "x", "y"]);
      const target = requiredActor(scene, event.actorId), to = cell(scene, p.space, p.x, p.y);
      target.manualMovementTrace = { eventId: event.id, from: { space: target.space, x: target.x, y: target.y }, to: copy(to) };
      Object.assign(target, to);
    } else if (p.kind === "movement/clear") {
      exactKeys(p,["kind","space"]);safeId(p.space);
      if(!(scene.spaces||[]).some(row=>row.id===p.space))fail("Пространство отсутствует.");
      for(const target of scene.actors||[])if(target.manualMovementTrace?.from?.space===p.space||target.manualMovementTrace?.to?.space===p.space)delete target.manualMovementTrace;
    } else if (p.kind === "resource") {
      exactKeys(p, ["kind", "values"]); exactKeys(p.values, RESOURCE_FIELDS);
      if (!Object.keys(p.values).length) fail("Не указаны ресурсы.");
      for (const value of Object.values(p.values)) if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) fail("Ресурс должен быть конечным неотрицательным целым числом.");
      const target = requiredActor(scene, event.actorId), result = { ...target, ...p.values };
      for(const [key,value] of Object.entries(p.values))if(value>resourceMaximum(target,key))fail("Значение ресурса превышает допустимый максимум.");
      if (Number(result.hp || 0) > Number(result.maxHp || 0)) fail("Здоровье превышает максимум: явно исправьте оба поля.");
      Object.assign(target, p.values);
    } else if (p.kind === "status") {
      exactKeys(p, ["kind", "effectId", "enabled"]); safeId(p.effectId);
      if (typeof p.enabled !== "boolean") fail("Пометка требует явного enabled.");
      const target = requiredActor(scene, event.actorId), statuses = new Set(target.manualStatuses || []);
      if (p.enabled) statuses.add(p.effectId); else statuses.delete(p.effectId);
      target.manualStatuses = [...statuses];
    } else if (p.kind === "technique") {
      exactKeys(p, ["kind", "key", "enabled"]); safeId(p.key);
      if (typeof p.enabled !== "boolean") fail("Пометка приёма требует enabled.");
      const target = requiredActor(scene, event.actorId); target.manualTechniqueState ||= {};
      target.manualTechniqueState[p.key] = p.enabled;
    } else if (p.kind === "technique-counter") {
      exactKeys(p, ["kind", "key", "operation", "value", "delta"]); safeId(p.key);
      const target = requiredActor(scene, event.actorId);
      const counters = target.manualTechniqueCounters || {};
      validCounters(counters);
      const present = Object.hasOwn(counters, p.key);
      if (p.operation === "remove") {
        if (p.value !== undefined || p.delta !== undefined) fail("Удаление счётчика не принимает значение.");
        delete counters[p.key];
      } else if (p.operation === "create") {
        if (p.value !== undefined || p.delta !== undefined) fail("Новый счётчик начинается с нуля.");
        if (!present && Object.keys(counters).length >= 120) fail("Удалите лишние ручные счётчики.", "TABLE_CAPACITY");
        if (!present) counters[p.key] = 0;
      } else if (["set", "adjust"].includes(p.operation)) {
        if (!present) fail("Сначала добавьте счётчик.");
        if (p.operation === "adjust" && (p.value !== undefined || ![-1, 1].includes(p.delta))) fail("Шаг счётчика должен быть +1 или −1.");
        if (p.operation === "set" && p.delta !== undefined) fail("Укажите только новое значение.");
        const value = p.operation === "adjust" ? counters[p.key] + p.delta : p.value;
        if (!Number.isSafeInteger(value) || value < 0 || value > 999) fail("Счётчик принимает целое число от 0 до 999.");
        counters[p.key] = value;
      } else fail("Неизвестная операция счётчика.");
      target.manualTechniqueCounters = counters;
    } else if (p.kind === "roll") {
      exactKeys(p, ["kind", "roll"]);
      exactKeys(p.roll, ["formula", "rolls", "successes", "crits", "outcome", "payment", "target", "dice", "targetIds", "label", "count", "rollKind", "scope", "attribute", "advantage", "hindrance", "criticalAt", "criticalValue", "baseCount", "kept", "dropped", "total"]);
      const roll = p.roll;
      if (!Array.isArray(roll.rolls) || roll.rolls.length > 200 || roll.rolls.some(value => !Number.isSafeInteger(value) || value < 1 || value > 1000)) fail("Некорректные результаты броска.");
      for (const key of ["successes", "crits", "count", "total"]) if (roll[key] !== undefined && (!Number.isSafeInteger(roll[key]) || roll[key] < 0 || roll[key] > 1000000)) fail("Некорректный итог броска.");
      for (const key of ["formula", "label", "outcome", "payment"]) if (roll[key] !== undefined && (typeof roll[key] !== "string" || roll[key].length > 240)) fail("Некорректная подпись броска.");
      if (JSON.stringify(roll).length > 8192) fail("Бросок слишком большой.");
      const owner = event.actorId ? requiredActor(scene, event.actorId) : null;
      scene.rollFeed ||= []; scene.rollFeed.unshift({ ...copy(roll), id: event.id, at: event.at, actorId: event.actorId, actor: owner?.name || "Стол", manual: true, visibility: event.visibility }); scene.rollFeed = scene.rollFeed.slice(0, 20);
    } else if (p.kind === "clock/create") {
      exactKeys(p, ["kind", "clock"]); exactKeys(p.clock, ["id", "name", "kind", "size", "value"]);
      const clock = p.clock; safeId(clock.id);
      if (typeof clock.name !== "string" || !clock.name.trim() || clock.name.length > 160 || !["progress", "danger", "counter"].includes(clock.kind) || !Number.isSafeInteger(clock.size) || clock.size < 1 || clock.size > 1000000 || !Number.isSafeInteger(clock.value ?? 0) || (clock.value ?? 0) < 0 || (clock.value ?? 0) > clock.size) fail("Некорректные ручные часы.");
      if ((scene.sessionClocks || []).some(row => row.id === clock.id)) fail("ID часов уже занят.");
      if (event.actorId) requiredActor(scene, event.actorId);
      scene.sessionClocks ||= []; scene.sessionClocks.push({ ...copy(clock), value: clock.value ?? 0, current: clock.value ?? 0, min: 0, max: clock.size, initial: clock.value ?? 0, ownerActorId: event.actorId, manual: true });
    } else if (["clock/set", "clock/remove"].includes(p.kind)) {
      exactKeys(p, p.kind === "clock/set" ? ["kind", "id", "value"] : ["kind", "id"]); safeId(p.id);
      const clock = (scene.sessionClocks || []).find(row => row.id === p.id);
      if (!clock || !clock.manual) fail("Ручные часы отсутствуют.");
      if (p.kind === "clock/remove") scene.sessionClocks = scene.sessionClocks.filter(row => row.id !== p.id);
      else { if (!Number.isSafeInteger(p.value) || p.value < 0 || p.value > clock.size) fail("Некорректное значение часов."); clock.value = clock.current = p.value; }
    } else if (p.kind === "area/create") {
      exactKeys(p, ["kind", "area"]); exactKeys(p.area, ["id", "space", "cells", "label", "color", "hidden","appearance"]);
      const area = p.area; capacity(scene,"objects");uniqueObjectId(scene,area.id);annotation(area);
      if(area.appearance!==undefined&&!AREA_APPEARANCES.includes(area.appearance))fail("Неизвестное обозначение местности.");
      if (!Array.isArray(area.cells) || !area.cells.length || area.cells.length > 128 || new Set(area.cells).size !== area.cells.length) fail("Некорректная область.");
      for (const value of area.cells) { if (typeof value !== "string" || !/^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/u.test(value)) fail("Некорректная клетка области."); const [x,y] = value.split(",").map(Number); cell(scene, area.space, x, y); }
      for (const key of ["label", "color"]) if (area[key] !== undefined && (typeof area[key] !== "string" || area[key].length > 200)) fail("Некорректная подпись области.");
      if (area.hidden !== undefined && typeof area.hidden !== "boolean") fail("Некорректная видимость области.");
      if ([...(scene.objects || []), ...(scene.markers || []), ...(scene.walls || []), ...(scene.actors || [])].some(row => row.id === area.id)) fail("ID объекта уже занят.");
      if (event.actorId) requiredActor(scene, event.actorId);
      scene.objects ||= []; scene.objects.push({ ...copy(area), appearance:area.appearance||"custom", type: "manual-area", manual: true, ownerActorId: event.actorId,source:"",duration:"persistent" });
    } else if (p.kind === "area/remove") {
      exactKeys(p, ["kind", "id"]); safeId(p.id);
      const area = (scene.objects || []).find(row => row.id === p.id);
      if (!area || area.type !== "manual-area") fail("Ручная область отсутствует."); removeStoredObject(scene, "objects", p.id);
    } else if (p.kind === "pointer") {
      exactKeys(p, ["kind", "actorId"]);
      if (p.actorId !== null) requiredActor(scene, p.actorId);
      scene.manualTable ||= { actorId: null, round: 1 }; scene.manualTable.actorId = p.actorId;
    } else if (p.kind === "round") {
      exactKeys(p, ["kind", "delta"]);
      if (!Number.isSafeInteger(p.delta) || Math.abs(p.delta) > 1000) fail("Некорректное изменение ручного раунда.");
      scene.manualTable ||= { actorId: null, round: 1 };
      const value = scene.manualTable.round + p.delta;
      if (!Number.isSafeInteger(value) || value < 1) fail("Ручной раунд начинается с 1.");
      scene.manualTable.round = value;
      if(p.delta>0)scene.tension=Math.min(999,Math.max(0,Number(scene.tension)||0)+p.delta);
    } else if(p.kind === "wall/create"){
      exactKeys(p,["kind","wall"]);exactKeys(p.wall,["id","space","a","b","label","hidden"]);
      const wall=p.wall;capacity(scene,"walls");uniqueObjectId(scene,wall.id);annotation(wall);
      if(event.actorId)requiredActor(scene,event.actorId);
      const points=[wall.a,wall.b].map(value=>{if(typeof value!=="string"||!/^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/u.test(value))fail("Некорректное ребро Стены.");const[x,y]=value.split(",").map(Number);return cell(scene,wall.space,x,y)});
      if(Math.abs(points[0].x-points[1].x)+Math.abs(points[0].y-points[1].y)!==1)fail("Стена проводится между соседними клетками.");
      if((scene.walls||[]).some(row=>row.space===wall.space&&[row.a,row.b].sort().join("|")===[wall.a,wall.b].sort().join("|")))fail("На этом ребре уже есть Стена.");
      scene.walls||=[];scene.walls.push({...copy(wall),manual:true,ownerActorId:event.actorId,source:"",hp:10,maxHp:10});
    } else if (p.kind === "marker/create") {
      exactKeys(p, ["kind", "marker"]);
      exactKeys(p.marker, ["id", "space", "x", "y", "kind", "label", "color", "hidden","clock"]);
      const marker = p.marker; capacity(scene,"markers");uniqueObjectId(scene,marker.id);annotation(marker);cell(scene, marker.space, marker.x, marker.y);
      if(marker.kind!==undefined&&!["note","mark","damocles","bomb","ritual","trap","summon","weapon","objective","countdown","hidden","custom","corpse"].includes(marker.kind))fail("Неизвестный вид метки.");
      if(event.actorId)requiredActor(scene,event.actorId);
      if(marker.clock!==undefined)clockValue(marker.clock);
      if ([...(scene.actors || []), ...(scene.objects || []), ...(scene.markers || []), ...(scene.walls || [])].some(row => row.id === marker.id)) fail("ID объекта уже занят.");
      for (const key of ["kind", "label", "color"]) if (marker[key] !== undefined && (typeof marker[key] !== "string" || marker[key].length > 200)) fail("Некорректная подпись метки.");
      if (marker.hidden !== undefined && typeof marker.hidden !== "boolean") fail("Некорректная видимость метки.");
      scene.markers ||= [];const {clock,...record}=copy(marker);scene.markers.push({ ...record,ownerActorId:event.actorId, manual: true,source:"",duration:"persistent",metadata:clock?{clock:{size:clock.size,value:clock.value??0}}:{} });
    } else if(p.kind === "marker/clock-set"){
      exactKeys(p,["kind","id","value"]);safeId(p.id);
      const marker=(scene.markers||[]).find(row=>row.id===p.id&&row.manual),clock=marker?.metadata?.clock;
      if(!clock)fail("Ручные часы метки отсутствуют.");if(!Number.isSafeInteger(p.value))fail("Не указано значение часов.");clockValue({size:clock.size,value:p.value});clock.value=p.value;
    } else if (p.kind === "marker/move") {
      exactKeys(p, ["kind", "id", "space", "x", "y"]); safeId(p.id);
      const marker = (scene.markers || []).find(row => row.id === p.id);
      if (!marker) fail("Метка отсутствует."); Object.assign(marker, cell(scene, p.space, p.x, p.y));
    } else if (p.kind === "actor/remove") {
      exactKeys(p, ["kind", "id"]);safeId(p.id);
      removeStoredObject(scene,"actors",p.id);
      if(scene.selectedActor===p.id)scene.selectedActor=null;
      if(scene.manualTable?.actorId===p.id)scene.manualTable.actorId=null;
      scene.targetIds=(scene.targetIds||[]).filter(id=>id!==p.id);
    } else if (["marker/remove", "object/remove", "wall/remove"].includes(p.kind)) {
      exactKeys(p, ["kind", "id"]); safeId(p.id);
      removeStoredObject(scene, { "marker/remove": "markers", "object/remove": "objects", "wall/remove": "walls" }[p.kind], p.id);
    } else fail("Неизвестная ручная команда.");
  }
  function dispatchMany(scene, events, options = {}) {
    const contract = global.DAWN_SCENE_ENGINE?.eventPacketContract;
    if (!contract) fail("Общий контракт событий недоступен.", "TABLE_ENGINE_UNAVAILABLE");
    contract.validate(events);
    if (events.some(row => row.type !== "table.command")) fail("Автоматические события выключены в ручном столе.", "TABLE_AUTOMATION_BLOCKED");
    const replay = contract.replayStatus(scene, events);
    if (replay.complete) return { ok: true, scene: copy(scene), events: [], event: null, duplicates: copy(events) };
    if (options.expectedVersion !== undefined && Number(scene.version || 0) !== Number(options.expectedVersion)) fail("Конфликт версии Сцены: обновите состояние.", "SCENE_VERSION_CONFLICT");
    if (options.expectedPolicyEpoch !== undefined && normalizePolicy(scene.tablePolicy).epoch !== options.expectedPolicyEpoch) fail("Политика стола изменилась.", "TABLE_POLICY_CONFLICT");
    const next = copy(scene), output = [], accepted = new Set(replay.matchedIds);
    const reserved = contract.reserveIds(scene, events, options);
    for (const request of events) {
      if (request.id && accepted.has(request.id)) continue;
      if (request.id) accepted.add(request.id);
      const event = { ...copy(request), id: request.id || contract.generatedId(next, `table-${Date.now()}-${++serial}`, reserved),
        at: request.at || new Date().toISOString(), actorId: request.actorId || null, payload: copy(request.payload || {}), visibility: request.visibility || "public" };
      if (!["public", "gm", "owner"].includes(event.visibility)) fail("Некорректная видимость события.");
      const collection={"clock/set":"sessionClocks","clock/remove":"sessionClocks","actor/remove":"actors","object/remove":"objects","area/remove":"objects","marker/remove":"markers","marker/clock-set":"markers","marker/move":"markers","wall/remove":"walls"}[event.payload.kind];
      const target=collection?(next[collection]||[]).find(row=>row.id===event.payload.id):null;
      const privateTarget=target?.hidden||target?.kind==="hidden"||target?.manual&&target.ownerActorId&&(!actor(next,target.ownerActorId)||actor(next,target.ownerActorId).hidden);
      if(["technique","technique-counter"].includes(event.payload.kind))event.visibility="owner";
      if(privateTarget)event.visibility="gm";
      if (actor(next, event.actorId)?.hidden || event.payload?.kind === "marker/create" && (event.payload.marker?.hidden||event.payload.marker?.kind==="hidden") || event.payload?.kind === "area/create" && event.payload.area?.hidden || event.payload.kind==="wall/create"&&event.payload.wall?.hidden) event.visibility = "gm";
      if(event.payload.kind==="layout/replace")event.visibility="gm";
      reduce(next, event);
      next.version = Number(next.version || 0) + 1;
      next.log ||= []; next.log.unshift(event); next.log = next.log.slice(0, 200);
      output.push(event);
    }
    contract.record(next, events);
    return { ok: true, scene: next, events: output, event: output.at(-1) || null,
      duplicates: copy(events.filter(row => replay.matchedIds.includes(row.id))) };
  }
  function blocked() { fail("Автоматические действия выключены в ручном столе.", "TABLE_AUTOMATION_BLOCKED"); }
  function validateSnapshot(before,after,options={}){
    if(!isManual(before)&&!isManual(after))return true;
    if(!isManual(before)||!isManual(after)||JSON.stringify(normalizePolicy(before.tablePolicy))!==JSON.stringify(normalizePolicy(after.tablePolicy)))fail("Снимок и отмена не могут менять Ведение стола.","TABLE_SNAPSHOT_POLICY");
    for(const row of after.actors||[])if(row.manualTechniqueCounters!==undefined)validCounters(row.manualTechniqueCounters);
    if(options.restore===true){if(pendingWork(before)||pendingWork(after))fail("Сначала завершите ожидающее действие.","TABLE_PENDING_WORK");return true;}
    if((after.actors||[]).length>120)fail("На столе уже слишком много участников. Лимит — 120; освободите место перед добавлением.","TABLE_CAPACITY");
    if(new Set((after.actors||[]).map(row=>row.id)).size!==(after.actors||[]).length)fail("ID участника уже занят.","TABLE_COMMAND_INVALID");
    const history=options.history===true,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    for(const key of ["eventReceipts"])if(!same(before[key],after[key]))fail("Снимок не может сбрасывать журнал принятых команд.","TABLE_SNAPSHOT_RUNTIME");
    if(!same(before.lionwing?.receipts,after.lionwing?.receipts))fail("Снимок не может сбрасывать журнал принятых команд.","TABLE_SNAPSHOT_RUNTIME");
    const auditBefore=before.log||[],auditAfter=after.log||[];
    const auditAppend=Array.from({length:20},(_,i)=>i+1).some(count=>auditAfter.length===Math.min(200,auditBefore.length+count)&&auditAfter.slice(0,count).length===count&&auditAfter.slice(0,count).every(row=>row.type==="legacy.note"&&row.actorId===null&&row.visibility==="public"&&typeof row.text==="string"&&row.payload?.label===row.text)&&same(auditAfter.slice(count),auditBefore.slice(0,200-count)));
    if(!history&&!same(before.log,after.log)&&!auditAppend)fail("Снимок не может менять журнал событий.","TABLE_SNAPSHOT_RUNTIME");
    const runtime=scene=>{const value=copy(scene.lionwing||{});delete value.receipts;return value;};
    if(!history&&!same(runtime(before),runtime(after)))fail("Снимок не может менять замороженную механику LionWing.","TABLE_SNAPSHOT_RUNTIME");
    for(const key of ["round","turnSerial","tension","activeActorId","pendingAction","pendingPrompt","pendingActionPlan","triggerQueue","results","topology","movementTraces","challengeRequest","opposedRoll"]){if(!same(before[key],after[key]))fail("Снимок не может выполнять боевые изменения.","TABLE_SNAPSHOT_RUNTIME");}
    if(!history)for(const key of ["manualTable","sessionClocks","objects","walls","markers","rollFeed","reminders"]){if(!same(before[key],after[key]))fail("Используйте явные команды ручного стола.","TABLE_SNAPSHOT_RUNTIME");}
    const editable=new Set(["name","tokenSymbol","tokenColor","tokenImage","portraitImage","portraitUrl","hidden","manualInitiativeVisible","ownerId"]);
    if(history)for(const key of [...RESOURCE_FIELDS,"space","x","y","manualMovementTrace","manualStatuses","manualTechniqueState","manualTechniqueCounters"])editable.add(key);
    const stored=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!editable.has(key)));
    if(history){
      // History is a restoration of a saved step, not a second mutation API.
      // In particular, backing entities and detached references must come from
      // that step; comparing deletion projections would erase their contents.
      const keys=["manualTable","sessionClocks","objects","walls","markers","rollFeed","reminders"];
      const historyActor=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!["name","tokenSymbol","tokenColor","tokenImage","portraitImage","portraitUrl","hidden","manualInitiativeVisible","ownerId"].includes(key)));
      const anchor=[...(options.historyAnchor&&approvedHistoryAnchors.has(JSON.stringify(options.historyAnchor))?[{state:options.historyAnchor}]:[]),...(before.undo||[]),...(before.redo||[]),...(before.turnUndo||[])].map(step=>step.state).find(state=>state&&same(normalizePolicy(state.tablePolicy),normalizePolicy(after.tablePolicy))&&same(runtime(state),runtime(after))&&keys.every(key=>same(state[key],after[key]))&&same((state.actors||[]).map(historyActor),(after.actors||[]).map(historyActor)));
      if(!anchor)fail("Отмена должна восстанавливать сохранённый шаг истории.","TABLE_SNAPSHOT_HISTORY");
      approvedHistoryAnchors.add(JSON.stringify(anchor));
      if(approvedHistoryAnchors.size>100)approvedHistoryAnchors.delete(approvedHistoryAnchors.values().next().value);
      return true;
    }
    for(const old of before.actors||[]){const next=(after.actors||[]).find(row=>row.id===old.id);if(!next){if(!history)fail("Удаление участника требует ручной команды.","TABLE_SNAPSHOT_RUNTIME");continue;}if(!same(stored(old),stored(next)))fail("Снимок не может менять боевое состояние участника.","TABLE_SNAPSHOT_RUNTIME");}
    return true;
  }
  function install(sceneEngine = global.DAWN_SCENE_ENGINE, lionwingEngine = global.DAWN_LIONWING_ENGINE) {
    for (const engine of [sceneEngine, lionwingEngine]) {
      if (!engine || installed.has(engine)) continue;
      for (const name of ["dispatch", "dispatchMany", "previewEvents"]) {
        const original = engine[name]; if (typeof original !== "function") continue;
        engine[name] = function (scene, input, options = {}) {
          const events = name === "dispatch" ? [input] : input;
          if ((events || []).some(row => row?.type === "table.command") || isManual(scene)) {
            if (name === "previewEvents") {
              try { return dispatchMany(scene, events, options); }
              catch (error) { return { ok: false, scene: copy(scene), events: [], errors: [error.message], code: error.code }; }
            }
            return dispatchMany(scene, events, options);
          }
          return original.apply(this, arguments);
        };
      }
      for (const name of Object.keys(engine).filter(key => /^prepare/.test(key) || /^(respond|resolve|cancel)/.test(key) || /^(createEntity|destroyEntity|removeEntity|changeEntityOwner|replayEntityEvent|undoEntityEvent|replay|undo|consumeEvasion)$/.test(key))) {
        const original = engine[name]; if (typeof original !== "function") continue;
        engine[name] = function (scene) {
          if (isManual(scene)) return { ok: false, events: [], errors: ["Автоматические действия выключены в ручном столе."], code: "TABLE_AUTOMATION_BLOCKED" };
          return original.apply(this, arguments);
        };
      }
      if (typeof engine.reload === "function") {
        const original = engine.reload;
        engine.reload = function (scene) {
          const parsed = typeof scene === "string" ? JSON.parse(scene) : scene;
          if (isManual(parsed)) return copy(parsed);
          return original.apply(this, arguments);
        };
      }
      // Internal continuation is an exported mutation entry point too.
      if (engine.eventPacketContract?.dispatchContinuation) {
        const original = engine.eventPacketContract.dispatchContinuation;
        engine.eventPacketContract.dispatchContinuation = function (scene) { if (isManual(scene)) blocked(); return original.apply(this, arguments); };
      }
      installed.add(engine);
    }
    return global.DAWN_TABLE_POLICY;
  }
  global.DAWN_TABLE_POLICY = { isManual, normalizePolicy, dispatchMany, install, pendingWork, validateSnapshot, resourceMaximum, healthInput, resourceFields: RESOURCE_FIELDS, layoutActorFields:LAYOUT_ACTOR_FIELDS };
})(typeof window === "object" ? window : globalThis);
