"use strict";

// LionWing commands are resolved on a copy. The 0.9 reducer and its Technique
// triggers are deliberately outside this boundary. Rendering/storage stay shared.
(function installLionwingEngine(global) {
  if (!global.DAWN_LIONWING_DATA?.coreRules) return;
  const legacy = { ...global.DAWN_SCENE_ENGINE };
  const core = global.DAWN_LIONWING_DATA.coreRules;
  const foundations = global.DAWN_LIONWING_EXECUTION;
  const entities = global.DAWN_LIONWING_ENTITIES || null;
  const inventory = global.DAWN_LIONWING_INVENTORY || null;
  const combatMeter = global.DAWN_LIONWING_COMBAT_METER || null;
  const tensionValue = scene => Number(combatMeter?.read?.(scene)?.current ?? scene?.tension ?? 0);
  // The dice foundation is optional so the old single-event reducer remains
  // byte-for-byte compatible in pages that have not loaded the new module yet.
  const dice = global.DAWN_LIONWING_DICE || null;
  const DICE_SCENE_ROLL_LIMIT = 128;
  const DICE_SCENE_JOURNAL_LIMIT = 256;
  let preparedSerial = 0;
  const copy = value => JSON.parse(JSON.stringify(value));
  const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const ids = legacy.ACTION_IDS;
  const actor = (scene, id) => (scene.actors || []).find(item => item.id === id);
  const has = (a, id) => (a?.effects || []).includes(id);
  const isPlayer = a => a?.kind === "hero" || Boolean(a?.heroId);
  const live = a => a && !a.knockedOut;
  const distance = (a, b) => a.space === b.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
  const footprintCells = a => {
    const width = Math.max(1, Number(a?.occupiedWidth || 1)), height = Math.max(1, Number(a?.occupiedHeight || 1));
    const cells = [];
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) cells.push({ space: a.space, x: Number(a.x) + x, y: Number(a.y) + y });
    return cells;
  };
  const footprintDistance = (a, b) => {
    if (!a || !b || a.space !== b.space) return Infinity;
    let result = Infinity;
    for (const left of footprintCells(a)) for (const right of footprintCells(b)) result = Math.min(result, Math.abs(left.x - right.x) + Math.abs(left.y - right.y));
    return result;
  };
  const fail = message => { throw new Error(message); };
  const plain = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const diceAvailable = () => {
    if (!dice || typeof dice.roll !== "function" || typeof dice.reload !== "function" || typeof dice.apply !== "function") fail("Модуль бросков LionWing недоступен");
    return dice;
  };
  const diceSourcePresent = value => plain(value) && ["sourceFaces", "rawFaces", "rolls", "faces"].some(key => value[key] != null);
  const diceRollId = (value, fallback = null) => {
    if (!plain(value)) return fallback;
    return value.rollId ?? value.id ?? value.rollEventId ?? fallback;
  };
  const diceRequest = (value, fallbackId, ownerActorId = null, kind = null) => {
    if (!plain(value)) return value;
    const request = { ...value };
    if (Object.hasOwn(request, "random")) fail("Авторитетная случайность передаётся только сервером");
    if (kind && request.kind == null && request.rollKind == null) request.kind = kind;
    if (request.id == null && request.rollId == null && request.rollEventId == null && fallbackId != null) request.id = fallbackId;
    if (ownerActorId != null && request.ownerActorId == null) request.ownerActorId = ownerActorId;
    return request;
  };
  const diceRulesFromPayload = value => {
    if (!plain(value) || !plain(value.dice)) return value;
    const metadata = value.dice;
    const result = { ...value };
    if (result.kind == null && metadata.kind != null) result.kind = metadata.kind;
    if (result.rollKind == null && metadata.rollKind != null) result.rollKind = metadata.rollKind;
    if (result.successAt == null && (metadata.successAt != null || metadata.threshold != null)) result.successAt = metadata.successAt ?? metadata.threshold;
    if (result.criticalAt == null && (metadata.criticalAt != null || metadata.critAt != null)) result.criticalAt = metadata.criticalAt ?? metadata.critAt;
    if (result.explode == null && metadata.explode != null) result.explode = metadata.explode;
    return result;
  };
  const inferDicePool = value => {
    value = diceRulesFromPayload(value);
    if (!plain(value) || value.pool != null || value.initialCount != null) return value;
    const match = typeof value.formula === "string" ? value.formula.match(/^\s*(\d+)\s*D6\b/i) : null;
    return match ? { ...value, pool: Number(match[1]), initialCount: Number(match[1]) } : value;
  };
  function createDiceRoll(value = {}, options = {}) {
    const api = diceAvailable();
    const input = inferDicePool(diceRequest(value, options.rollId ?? options.id ?? "roll:anonymous", options.ownerActorId ?? null));
    if (diceSourcePresent(input)) return api.create(input);
    const request = { ...input };
    delete request.random;
    return api.roll(request, { random: options.random });
  }
  function applyDiceRoll(value, operation, context = null) {
    return diceAvailable().apply(value, operation, context);
  }
  function reloadDiceRoll(value) {
    return diceAvailable().reload(value);
  }
  function opposedDiceRoll(value = {}, options = {}) {
    const api = diceAvailable();
    const input = diceRequest(value, options.opposedId ?? options.rollId ?? options.id ?? "opposed:anonymous", options.ownerActorId ?? null);
    return api.opposed(input, { random: options.random });
  }
  function validateDiceSceneState(s) {
    if (!dice) return;
    if (s.diceRolls == null) s.diceRolls = {};
    if (!plain(s.diceRolls)) fail("Реестр бросков LionWing имеет неподдерживаемый формат");
    const rollEntries = Object.entries(s.diceRolls);
    if (rollEntries.length > DICE_SCENE_ROLL_LIMIT) fail("Сцена содержит слишком много сохранённых бросков");
    for (const [rollId, saved] of rollEntries) {
      const normalized = reloadDiceRoll(saved);
      if (normalized.id !== rollId) fail("ID сохранённого броска не совпадает с ключом реестра");
      s.diceRolls[rollId] = normalized;
    }
    if (s.diceOpposed == null) s.diceOpposed = {};
    if (!plain(s.diceOpposed)) fail("Реестр встречных бросков LionWing имеет неподдерживаемый формат");
    const opposedEntries = Object.entries(s.diceOpposed);
    if (opposedEntries.length > DICE_SCENE_ROLL_LIMIT) fail("Сцена содержит слишком много встречных бросков");
    for (const [opposedId, saved] of opposedEntries) {
      const normalized = reloadDiceRoll(saved);
      if (normalized.id !== opposedId || normalized.kind !== "opposed") fail("ID сохранённой встречной проверки не совпадает с ключом реестра");
      s.diceOpposed[opposedId] = normalized;
    }
    if (s.diceJournal == null) s.diceJournal = [];
    if (!Array.isArray(s.diceJournal) || s.diceJournal.length > DICE_SCENE_JOURNAL_LIMIT) fail("Журнал бросков LionWing имеет неподдерживаемый размер");
  }
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
    if (global.DAWN_LIONWING_INFORMATION_QUERY?.ensureState) global.DAWN_LIONWING_INFORMATION_QUERY.ensureState(scene);
    const s=scene.lionwing;s.schema=2;
    if (inventory?.normalizeScene) inventory.normalizeScene(scene);
    if (combatMeter?.ensureScene) combatMeter.ensureScene(scene);
    // Auras are declarative scene state. They stay outside actor.effects so a
    // render/query never materializes one copy on every target.
    if(!Array.isArray(s.auras)&&Array.isArray(scene.auras))s.auras=copy(scene.auras);
    if(!Array.isArray(s.auras))s.auras=[];
    if(s.started===undefined)s.started=Boolean(scene.activeActorId||Number(scene.round||1)>1||(scene.actors||[]).some(a=>a.acted&&a.kind!=="crowd"));
    if(s.lastTeam===undefined){const last=(scene.log||[]).find(e=>e.type==="turn.end");s.lastTeam=actor(scene,last?.actorId)?.team||null;}
    const migrateHistory=!Array.isArray(s.history);
    for(const key of ["choices","deferred","receipts","history","specialJournal","afterEventReceipts","boundaryReceipts"])if(!Array.isArray(s[key]))s[key]=[];
    if(!Array.isArray(s.movementGroups))s.movementGroups=[];
    if(s.compounds===undefined)s.compounds={};
    if(!s.compounds||typeof s.compounds!=="object"||Array.isArray(s.compounds))fail("Реестр Составных LionWing имеет неподдерживаемый формат");
    validateDiceSceneState(s);
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
  // Special shared operations keep a small, scoped before/after projection in
  // their typed journal row.  It is deliberately limited to the affected
  // actors and pending decisions so replay/undo can reject a stale scene
  // without copying an entire table into every ordinary event.
  const specialActorIds = (scene, actorIds = [], compoundId = null) => {
    const ids = new Set((actorIds || []).filter(id => typeof id === "string" && id));
    if (compoundId) for (const participant of scene.actors || []) if (participant.compoundId === compoundId) ids.add(participant.id);
    return [...ids].sort();
  };
  function specialSnapshot(scene, kind, actorIds = [], compoundId = null) {
    const ids = specialActorIds(scene, actorIds, compoundId);
    const selected = ids.map(id => actor(scene, id)).filter(Boolean).map(copy);
    const l = scene.lionwing || {};
    return {
      schema: 1,
      kind,
      actorIds: ids,
      compoundId: compoundId || null,
      actors: selected,
      compounds: copy(l.compounds || {}),
      choices: copy(l.choices || []),
      deferred: copy(l.deferred || []),
      boundaryReceipts: copy(l.boundaryReceipts || []),
      afterAttack: copy(l.afterAttack || []),
      pendingAction: copy(scene.pendingAction || null),
      pendingPrompt: copy(scene.pendingPrompt || null),
      executionCursor: copy(l.executionCursor || null),
      activeActorId: scene.activeActorId || null,
      turnSerial: Number(scene.turnSerial || 0),
      round: Number(scene.round || 0),
      tension: tensionValue(scene),
    };
  }
  function restoreSpecialSnapshot(scene, snapshot) {
    if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.actors)) fail("Событие специальной операции не содержит снимок состояния");
    const next = copy(scene), byId = new Map((snapshot.actors || []).map(item => [item.id, item]));
    for (const [id, saved] of byId) {
      const current = actor(next, id);
      if (!current) fail("Откат специальной операции невозможен: участник отсутствует");
      const index = next.actors.findIndex(item => item.id === id);
      next.actors[index] = copy(saved);
    }
    next.lionwing ||= {};
    next.lionwing.compounds = copy(snapshot.compounds || {});
    next.lionwing.choices = copy(snapshot.choices || []);
    next.lionwing.deferred = copy(snapshot.deferred || []);
    next.lionwing.boundaryReceipts = copy(snapshot.boundaryReceipts || []);
    next.lionwing.afterAttack = copy(snapshot.afterAttack || []);
    if (snapshot.executionCursor == null) delete next.lionwing.executionCursor;
    else next.lionwing.executionCursor = copy(snapshot.executionCursor);
    next.pendingAction = copy(snapshot.pendingAction || null);
    next.pendingPrompt = copy(snapshot.pendingPrompt || null);
    next.activeActorId = snapshot.activeActorId || null;
    next.turnSerial = Number(snapshot.turnSerial || 0);
    next.round = Number(snapshot.round || 0);
    next.tension = Number(snapshot.tension || 0);
    return next;
  }
  const validateSpecialSnapshotPair = (before, after) => {
    if (!before || !after || before.kind !== after.kind || before.compoundId !== after.compoundId || !sameJson(before.actorIds || [], after.actorIds || []) || !sameJson((before.actors || []).map(item => item.id).sort(), (after.actors || []).map(item => item.id).sort())) fail("Снимки специальной операции относятся к разным участникам");
  };
  function compoundStatus(scene, ref) {
    const snapshot = copy(scene), s = state(snapshot);
    const requested = typeof ref === "string" ? ref : ref?.id || ref?.compoundId;
    const target = actor(snapshot, requested) || snapshot.actors.find(item => item.compoundId === requested);
    const id = target?.compoundId || (requested && s.compounds?.[requested] ? requested : null);
    if (!id) return { active: false, id: null, parts: [], partIds: [], hp: 0, maxHp: 0, gate: 0, defenseType: null, speed: 0 };
    const parts = snapshot.actors.filter(item => item.compoundId === id || s.compounds?.[id]?.partIds?.includes(item.id));
    if (parts.length < 2) return { active: false, id, parts, partIds: parts.map(item => item.id), hp: parts.reduce((sum, item) => sum + Number(item.hp || 0), 0), maxHp: parts.reduce((sum, item) => sum + Number(item.maxHp ?? maxHealth(item)), 0), gate: 0, defenseType: null, speed: 0, record: copy(s.compounds?.[id] || null) };
    const status = legacy.compoundEnemyStatus(snapshot, parts[0]);
    return { ...status, id, partIds: parts.map(item => item.id), record: copy(s.compounds?.[id] || null) };
  }
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
  const lifetimes = new Set(["default", "startTurn", "endTurn", "actionOrStartTurn", "nextTurn", "startNextOwnerTurn", "endNextOwnerTurn", "roundEnd", "scene", "persistent", "manual"]);
  const compoundIdPattern = /^[a-z][a-z0-9._:-]{0,119}$/i;
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
  const adapterNumber = (method, a, ...args) => {
    const value = Number(global.DAWN_LIONWING_ADAPTERS?.[method]?.(a, ...args) || 0);
    return Number.isFinite(value) ? value : 0;
  };
  const stat = (a, key, context = {}) => {
    const rawBase = attributes.has(key) ? Number(a.attrs?.[key] || 0) : Number(a[key] || 0);
    const temporary = (a.lionwing?.modifiers || []).filter(m => m.stat === key).reduce((sum, m) => sum + (key === "evasion" ? m.remaining ?? m.amount : m.amount), 0);
    const quote = global.DAWN_LIONWING_ADAPTERS?.statQuote?.(a, key, { ...context, baseValue: rawBase + temporary });
    if (quote?.ok !== false && Number.isFinite(Number(quote?.value))) return Math.max(0, Number(quote.value));
    return Math.max(0, adapterNumber("statMinimum", a, key, context), rawBase + temporary + adapterNumber("statBonus", a, key, context));
  };
  const currentTurnInstance = scene => state(copy(scene)).activeTurnInstanceId || null;
  const spellCircleActive = (scene, a) => (scene.markers || []).some(marker =>
    marker?.ownerActorId === a.id && (marker.kind === "ritual" || marker.kind === "spell-circle") && marker.space === a.space && Number(marker.x) === Number(a.x) && Number(marker.y) === Number(a.y));
  const firstSpiritFinisherThisTurn = (scene, a, currentActionInstanceId = null) => {
    const turnInstanceId = currentTurnInstance(scene);
    return !(scene.log || []).some(row => row?.type === "action.resolve" && row.actorId === a.id && row.payload?.actionId === ids.finish && row.payload?.attribute === "spirit" && row.payload?.actionInstanceId !== currentActionInstanceId && (turnInstanceId == null || row.payload?.ownerTurnInstanceId === turnInstanceId));
  };
  const latestJumpDistance = (scene, a) => {
    const turnInstanceId = currentTurnInstance(scene);
    const row = (scene.log || []).find(item => item?.type === "movement.end" && item.actorId === a.id && item.payload?.movement?.sourceActionId === ids.jump && (turnInstanceId == null || item.payload?.movement?.ownerTurnInstanceId === turnInstanceId));
    return row?.payload?.movement?.distance == null ? null : Number(row.payload.movement.distance);
  };
  const maxHealth = a => stat(a, "maxHp");
  const scaledMove = (a, amount, scene=null) => Math.ceil(amount * ((scene?effectActive(scene,a,"positive.ускорен"):has(a,"positive.ускорен")) ? 2 : 1) / ((scene?effectActive(scene,a,"negative.замедлен"):has(a,"negative.замедлен")) ? 2 : 1));
  const speed = (a,scene=null) => scaledMove(a, stat(a, "speed"), scene);
  const sceneSpeed = (scene,a) => scene.activeActorId && Number(a.lionwing?.difficultTerrainStopSerial) === Number(scene.turnSerial) ? 0 : (() => { const group=legacy.compoundEnemyStatus(scene,a);return group.active?scaledMove(a,group.speed+(a.lionwing?.modifiers||[]).filter(m=>m.stat==="speed").reduce((sum,m)=>sum+m.amount,0),scene):speed(a,scene); })();
  const detectiveRuleId = "vagabond.dim-mak.3";
  const detectiveWeakPointRuleId = "vagabond.dim-mak.1";
  const detectiveDigest = "8a5ddc5d808d41166abd99dd0c207a6070ebeacf382fe4b0f3275304d7f532dd";
  const detectiveEnabled = a => Boolean(a?.rulesEdition === "lionwing" && Number((a.knownTechniques ?? a.techniques)?.["vagabond.dim-mak"] || 0) >= 3 && a.lionwing?.automation?.[detectiveRuleId] === true);
  const detectiveTurnId = scene => scene?.lionwing?.activeTurnInstanceId || null;
  const detectiveRemovals = (scene, sourceId, targetId, turnId = detectiveTurnId(scene)) => (scene?.log || []).filter(row => row?.type === "marker.remove" && row.actorId === sourceId && row.payload?.ruleId === detectiveWeakPointRuleId && (row.payload?.carrierActorId || row.payload?.targetId) === targetId && (turnId ? (row.execution?.ownerTurnInstanceId || row.payload?.ownerTurnInstanceId) === turnId : Number(row.payload?.turnSerial ?? row.execution?.turnSerial) === Number(scene.turnSerial || 0)));
  function detectiveMovementStatus(scene, actorId) {
    const a = actor(scene, actorId);
    if (!detectiveEnabled(a)) return { available: false, reason: "Детектив III отключён или не изучен", allowance: 0, markers: [] };
    if (!live(a)) return { available: false, reason: "Участник выведен из боя", allowance: 0, markers: [] };
    if (scene.activeActorId !== a.id) return { available: false, reason: "Телепортация доступна только в собственный Ход", allowance: 0, markers: [] };
    const step = actionDef(ids.step), status = actionStatus(scene, a, step, {});
    if (!status.available) return { available: false, reason: status.reason, allowance: 0, markers: [] };
    const allowance = Number(status.continuation ? a.stepRemaining : sceneSpeed(scene, a));
    if (!Number.isSafeInteger(allowance) || allowance < 1) return { available: false, reason: "Нет оставшейся дальности Движения", allowance: Math.max(0, allowance || 0), markers: [] };
    const markers = (scene.markers || []).filter(marker => {
      if (marker.ruleId !== detectiveWeakPointRuleId || marker.ownerActorId !== a.id) return false;
      const hostId = marker.hostActorId || marker.metadata?.hostActorId || marker.metadata?.carrierActorId, host = actor(scene, hostId), offset = marker.offset || marker.metadata?.offset;
      if (!host || !live(host) || host.team === a.team || !offset || marker.space !== host.space || Number(marker.x) !== Number(host.x) + Number(offset.dx) || Number(marker.y) !== Number(host.y) + Number(offset.dy)) return false;
      if (marker.space !== a.space || Number(marker.x) === Number(a.x) && Number(marker.y) === Number(a.y)) return false;
      const distanceAway = Math.abs(Number(marker.x) - Number(a.x)) + Math.abs(Number(marker.y) - Number(a.y));
      return distanceAway <= allowance;
    }).map(marker => ({ markerId: marker.id, targetId: marker.hostActorId || marker.metadata?.hostActorId || marker.metadata?.carrierActorId, destination: { space: marker.space, x: Number(marker.x), y: Number(marker.y) }, distance: Math.abs(Number(marker.x) - Number(a.x)) + Math.abs(Number(marker.y) - Number(a.y)) }));
    return { available: markers.length > 0, reason: markers.length ? "" : "Нет доступной принадлежащей Слабой точки в пределах Движения", allowance, markers, ruleId: detectiveRuleId, sourceDigest: detectiveDigest };
  }
  function prepareDetectiveTeleport(scene, request = {}) {
    try {
      const status = detectiveMovementStatus(scene, request.actorId);
      if (!status.available) fail(status.reason);
      const marker = status.markers.find(item => item.markerId === request.markerId);
      if (!marker) fail("Слабая точка недоступна для этой телепортации");
      const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
      if (!runtime?.prepare) fail("Планировщик пространства недоступен");
      const planned = runtime.prepare(scene, { operation: "teleport", sourceActorId: request.actorId, targetId: request.actorId, destination: marker.destination, maximum: status.allowance, ruleId: detectiveRuleId, label: "Детектив III: телепортация к Слабой точке", operationId: request.operationId });
      if (!planned.ok) fail(planned.errors?.join(" ") || "Телепортация недоступна");
      const eventId = request.eventId || `detective-teleport:${request.actorId}:${marker.markerId}:${Number(scene.version || 0)}`;
      return prepare(scene, { kind: "teleport", actorId: request.actorId, targetId: request.actorId, sourceActorId: request.actorId, destination: marker.destination, maximum: status.allowance, ruleId: detectiveRuleId, label: "Детектив III: телепортация к Слабой точке", geometryRuntime: planned.plan, teleportEnter: true, operationId: planned.plan.id, eventId });
    } catch (error) { return { ok: false, errors: [error.message], code: error.code || "LIONWING_DETECTIVE_BLOCKED" }; }
  }
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
    const spatial=global.DAWN_LIONWING_AURA_TRANSITIONS?.coverage?.(scene,aura,targetActor);
    if(spatial&&!spatial.active)return { active:false,reason:spatial.reason };
    if(!spatial){
      if(source.entity.space!==targetActor.space)return { active:false,reason:"Цель в другом пространстве" };
      const distanceValue=Math.abs(Number(source.entity.x||0)-Number(targetActor.x||0))+Math.abs(Number(source.entity.y||0)-Number(targetActor.y||0));
      const radius=Number(aura.shape?.distance??aura.distance);
      if(!Number.isSafeInteger(radius)||distanceValue>radius)return { active:false,reason:`За пределами радиуса ${radius}` };
    }
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
    const baseSwift = breakout || Boolean(allowance?.swift||allowance?.reaction) || !isPlayer(a) && def.id === ids.step;
    const continuation = def.id === ids.step && Number(a.stepRemaining || 0) > 0 && !breakout;
    if (continuation) return { available: true, reason: "", cost: 0, resource: "ap", continuation: true };
    const requestedAttribute=request.attribute||(def.id===ids.finish?"spirit":null);
    const adapterStatus=global.DAWN_LIONWING_ADAPTERS?.actionStatus?.(a,{scene,actionId:def.id,attribute:requestedAttribute,techniqueId:request.techniqueId || null,techniqueRuleId:request.techniqueRuleId || null,techniqueIds:Array.isArray(request.techniqueIds) ? request.techniqueIds : [],techniqueTags:(request.techniqueTags||[]).map(tag=>String(tag).toLowerCase())})||{allowed:true};
    if(adapterStatus.allowed===false)return unavailable(adapterStatus.reason||"Действие запрещено Техникой");
    const baseCost = breakout ? 0 : allowance?.cost??(def.id === "action.атаки.дуэль" ? Math.max(1, 4 - tensionValue(scene)) : def.id===ids.improvise&&request.removeObstacleId?1:def.cost.amount);
    const actionHistory = Array.isArray(a.lionwing?.history) ? a.lionwing.history : [];
    const deploymentRows = (scene.log || []).map((event, index) => ({ event, index })).filter(({ event }) => event?.actorId === a.id && ["actor.move", "actor.place"].includes(event.type) && event.payload?.placement === true && /развер|deploy/i.test(String(event.payload?.movement || event.payload?.reason || "")));
    const latestDeployment = deploymentRows.length ? deploymentRows[deploymentRows.length - 1] : null;
    const actionsAfterDeployment = latestDeployment ? (scene.log || []).slice(latestDeployment.index + 1).some(event => event?.actorId === a.id && ["action.prepare", "action.resolve"].includes(event.type)) || actionHistory.some(item => Number(item.turnSerial) === Number(scene.turnSerial) && (!scene.lionwing?.activeTurnInstanceId || !item.ownerTurnInstanceId || item.ownerTurnInstanceId === scene.lionwing.activeTurnInstanceId)) : false;
    const firstActionAfterDeploy = Boolean(latestDeployment && !actionsAfterDeployment);
    const modifierQuote = global.DAWN_LIONWING_ADAPTERS?.actionQuote?.(a, { scene, actionId: def.id, targetIds: request.targetIds || [], attribute: requestedAttribute, techniqueId: request.techniqueId || null, techniqueRuleId: request.techniqueRuleId || null, techniqueIds: Array.isArray(request.techniqueIds) ? request.techniqueIds : [], techniqueTags: (request.techniqueTags || []).map(tag => String(tag).toLowerCase()), baseCost, baseResource: def.cost.resource, baseSwift, continuation, firstActionAfterDeploy, request: { breakout: Boolean(request.breakout), breacherBothBarrels: request.breacherBothBarrels === true } }) || { ok: true, cost: baseCost, resource: def.cost.resource, swift: baseSwift, ignoreRequirements: [], modifiers: [], modifierIds: [] };
    if (request.breacherBothBarrels === true) {
      const level = Number((a.knownTechniques ?? a.techniques)?.["powerhouse.breacher"] || 0);
      const bodyFinisher = def.id === ids.finish && requestedAttribute === "body" && level >= 3;
      if (!(def.id === ids.skirmish || bodyFinisher) || level < 2 || !a.lionwing?.automation?.["powerhouse.breacher.2"] || (bodyFinisher && !a.lionwing?.automation?.["powerhouse.breacher.3"])) return unavailable("Из обоих стволов недоступно для этого действия");
      if (effectActive(scene, a, "negative.ослаблен")) return unavailable("Ослаблен запрещает Из обоих стволов");
    }
    if (modifierQuote.ok === false) return unavailable(modifierQuote.reason || "Модификаторы действия конфликтуют");
    const cost = Number(modifierQuote.cost ?? baseCost), swift = Boolean(modifierQuote.swift), used = isPlayer(a) ? (a.usedActions || []) : (a.lionwing?.turnActions || []);
    if (!swift && used.includes(def.id)) return unavailable("Действие уже использовано");
    if (!canSpend(a,def.cost.resource,cost)) return unavailable(`Недостаточно ${def.cost.resource === "ap" ? "ОД" : "ресурса"}: нужно ${cost}`);
    if (def.id === ids.disappear) {
      const board = scene.spaces.find(b => b.id === a.space);
      const ignored = new Set(modifierQuote.ignoreRequirements || []);
      if (!ignored.has("boardEdge") && (!board || ![0, board.width - 1].includes(a.x) && ![0, board.height - 1].includes(a.y)) || !ignored.has("startedDisappeared") && a.lionwing?.startedDisappeared) return unavailable("Скрыться можно на краю поля, если Ход начат без Исчезновения");
    }
    return { available: true, reason: modifierQuote.reason || "", cost, resource: def.cost.resource, swift, actionQuote: modifierQuote, actionModifierIds: modifierQuote.modifierIds || [], allowanceId:allowance?.id };
  }

  function roll(count, random = Math.random, options = {}) {
    if (dice) {
      const kind = options.kind || options.rollKind || "check";
      const rollId = options.rollId ?? options.id ?? options.rollEventId ?? "roll:anonymous";
      const request = { id: rollId, kind, pool: count, successAt: options.successAt ?? 4, criticalAt: options.criticalAt ?? options.critAt ?? 6, explode: kind === "raw-d6" ? false : options.explode !== false };
      for (const key of ["formula", "rootActionId", "actionId", "actionDefinitionId", "actionInstanceId", "causeEventId", "ownerActorId", "provenance"]) {
        if (options[key] != null) request[key] = copy(options[key]);
      }
      return dice.roll(request, { random });
    }
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

  function validateRoll(value, options = {}) {
    if (dice) {
      const fallbackId = options.rollId ?? options.id ?? null;
      const input = inferDicePool(diceRequest(value, fallbackId, options.ownerActorId ?? null));
      return reloadDiceRoll(input);
    }
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

  // Read-only lifecycle context shared by adapters, UI previews and tests.
  // Boundary execution still goes through the existing boundaryOperations
  // hook above; this helper only gives callers one stable vocabulary for
  // Turn/Round/Scene windows and receipt keys.
  function lifecycleContext(scene, query = {}) {
    const snapshot = copy(scene), s = state(snapshot), owner = actor(snapshot, query.ownerActorId || query.actorId || snapshot.activeActorId), boundaryAliases = { sceneStart: "sceneStart", sceneEnd: "sceneEnd", roundStart: "roundStart", roundEnd: "roundEnd", turnStart: "ownTurnStart", turnEnd: "ownTurnEnd", ownTurnStart: "ownTurnStart", ownTurnEnd: "ownTurnEnd", anyTurnStart: "anyTurnStart", anyTurnEnd: "anyTurnEnd" }, boundary = boundaryAliases[query.boundary] || query.boundary || "ownTurnStart", ownerSerial = owner ? ownTurnSerial(owner) : Number(query.ownerTurnSerial || 0), ownerKey = owner ? ownerTurnKey(s.sceneSerial, owner, ownerSerial) : null, turnInstanceId = query.turnInstanceId || (snapshot.activeActorId === owner?.id ? s.activeTurnInstanceId || null : owner?.lionwing?.turnInstanceId || owner?.lionwing?.lastTurnInstanceId || null);
    if (!["sceneStart", "sceneEnd", "roundStart", "roundEnd", "ownTurnStart", "ownTurnEnd", "anyTurnStart", "anyTurnEnd"].includes(boundary)) fail("Неизвестная граница жизненного цикла");
    const periodKey = ["sceneStart", "sceneEnd"].includes(boundary) ? `${s.sceneSerial}:${boundary}` : ["roundStart", "roundEnd"].includes(boundary) ? `${s.sceneSerial}:${snapshot.round}:${boundary}` : ["ownTurnStart", "ownTurnEnd"].includes(boundary) ? `${ownerKey}:${boundary}` : `${s.sceneSerial}:${s.activeTurnInstanceId || `scene-turn:${snapshot.turnSerial}`}:${boundary}`;
    const historyQuery = query.history && typeof query.history === "object" ? { ...query.history, sceneSerial: query.history.sceneSerial ?? s.sceneSerial, ownerActorId: query.history.ownerActorId ?? owner?.id, ownerTurnSerial: query.history.ownerTurnSerial ?? ownerSerial, ownerTurnInstanceId: query.history.ownerTurnInstanceId ?? turnInstanceId } : null;
    return { schema: 1, boundary, sceneSerial: s.sceneSerial, chapterSerial: s.chapterSerial, round: Number(snapshot.round || 0), turnSerial: Number(snapshot.turnSerial || 0), ownerActorId: owner?.id || null, ownerTurnSerial: ownerSerial, ownerTurnInstanceId: turnInstanceId, ownerTurnKey: ownerKey, activeActorId: snapshot.activeActorId || null, activeTurnInstanceId: s.activeTurnInstanceId || null, extraTurn: s.activeTurn?.kind === "extra", periodKey, receipt: query.ruleId ? (s.boundaryReceipts || []).find(item => item.ruleId === query.ruleId && item.ownerActorId === owner?.id && item.boundaryKey === periodKey) || null : null, history: historyQuery ? { count: foundations.historyCount(s.history, { ...historyQuery, scope: historyQuery.scope || "ownerTurn" }), facts: s.history.filter(item => foundations.inScope(item, { ...historyQuery, scope: historyQuery.scope || "ownerTurn" })).map(copy) } : null };
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
    const bonus = def.id === ids.charge ? tensionValue(scene) : def.id === ids.finish ? Number(request.focusSpent || 0) : 0;
    const advantage=integer(request.advantage||0,"Преимущество",100),disadvantage=integer(request.disadvantage||0,"Помеха",100);
    return Math.max(0, Number(a.attrs[attribute] || 0) + bonus + advantage - disadvantage);
  }

  function attackPools(scene,a,def,p){
    const baseDice=diceCount(scene,a,def,p),targets=p.targetIds||[];
    const actionModifierQuote = global.DAWN_LIONWING_ADAPTERS?.actionQuote?.(a, {
      scene, actionId: def.id, targetIds: targets, attribute: p.attribute || (def.id === ids.finish ? "spirit" : null),
      baseCost: 0, baseResource: def.cost.resource, baseSwift: false,
      request: { breacherBuckShot: p.breacherBuckShot === true, breacherBothBarrels: p.breacherBothBarrels === true },
    }) || { ok: true, attackBonus: 0 };
    if (actionModifierQuote.ok === false) fail(actionModifierQuote.reason || "Модификаторы действия конфликтуют");
    const base=baseDice+Number(actionModifierQuote.attackBonus||0);
    if(!attacks.has(def.id)||!targets.length)return{base,counts:{}};
    const taunts=activeEffectSources(a,"negative.спровоцирован",scene).map(x=>x.actorId),fears=activeEffectSources(a,"negative.испуган",scene).map(x=>x.actorId);
    const sourceEffectIds=activeState(scene,a.id).effects.map(status=>status.effect),techniqueTags=[...(global.DAWN_LIONWING_ADAPTERS?.trustedTechniqueTags?.(a, p) || [])];
    // A caller may decline the chain explicitly, but cannot inflate its
    // distance: every positive value comes from the completed Jump journal.
    const jumpDistance = Number(p.jumpDistance) === 0 ? null : latestJumpDistance(scene, a);
    const attackAttribute = p.attribute || (def.id === ids.finish ? "spirit" : def.id === ids.skirmish ? (Number(a.attrs.body) >= Number(a.attrs.talent) ? "body" : "talent") : "spirit");
    const differentEnemiesWithinFive = p.differentEnemiesWithinFive ?? (p.rapidFire === true ? new Set(scene.actors.filter(target => live(target) && target.team !== a.team && target.space === a.space && distance(a, target) <= 5).map(target => target.compoundId || target.id)).size : null);
    const targetContext = {
      scene, kind: "attack", actionId: def.id, targetIds: targets, sourceEffectIds,
      techniqueTags, techniqueId: p.techniqueId || null, techniqueIds: Array.isArray(p.techniqueIds) ? p.techniqueIds : [], attribute: attackAttribute, tension: tensionValue(scene),
      techniqueRuleId: p.techniqueRuleId || null, finisherMode: p.finisherMode || null,
      focusSpent: Number(p.focusSpent || 0), emptyTargetCount: p.emptyTargetCount,
      areaPlan: p.areaPlan ? copy(p.areaPlan) : null,
      rapidFire: p.rapidFire === true,
      differentEnemiesWithinFive,
      jumpDistance, jumpActionInstanceId: p.jumpActionInstanceId || null,
      spellCircleActive: p.spellCircleActive === true || spellCircleActive(scene, a),
      firstSpiritFinisherThisTurn: p.firstSpiritFinisherThisTurn === true || (def.id === ids.finish && attackAttribute === "spirit" && firstSpiritFinisherThisTurn(scene, a, p.actionInstanceId || null)),
      enchainedCastMoveAdjacent: p.enchainedCastMoveAdjacent === true,
      speedValue: stat(a, "speed"), breacherBuckShot: p.breacherBuckShot === true,
    };
    const counts=Object.fromEntries(targets.map(id=>{const target=actor(scene,id),targetEffectIds=activeState(scene,id).effects.map(status=>status.effect),tauntedByActor=activeEffectSources(target,"negative.спровоцирован",scene).some(source=>source.actorId===a.id),context={...targetContext,targetId:id,targetDistance:distance(a,target),targetEffectIds,tauntedByActor,flightStance:effectActive(scene,a,"positive.полёт")||a.lionwing?.stance==="flight",useSpeedAttribute:p.useSpeedAttribute===true};const quoted=global.DAWN_LIONWING_ADAPTERS?.attackQuote?.(a,{...context,baseValue:base,roundUp:true})||{ok:true,value:base};if(quoted.ok===false)fail(quoted.reason||"Числовые модификаторы Атаки конфликтуют");return[id,Math.max(0,Number(quoted.value)-(effectActive(scene,a,"negative.спровоцирован")&&!targets.some(t=>taunts.includes(t))?a.tier:0)-(effectActive(scene,a,"negative.испуган")&&fears.includes(id)?a.tier:0)+((p.spikeTargetIds||[]).includes(id)&&effectActive(scene,target,"negative.подброшен")?a.tier:0))]}));
    return{base:Math.min(...Object.values(counts)),counts};
  }

  const bombardierAreaRules = Object.freeze({
    "ruiner.bombardier.1": { shape: "adjacent", range: 4, minimumFocus: 0 },
    "ruiner.bombardier.2": { shape: "square3", range: 5, minimumFocus: 2 },
    "ruiner.bombardier.3": { shape: "square5", range: 6, minimumFocus: 4 },
  });
  const studentAreaRules = Object.freeze({
    "ruiner.student-of-stars.2-line": { shape: "line", range: 1 },
    "ruiner.student-of-stars.2-zone": { shape: "square2", range: 1 },
  });
  function studentPowerStatus(scene, actorValue, payload) {
    if (payload?.actionId !== ids.finish) return null;
    const quote = global.DAWN_LIONWING_ADAPTERS?.actionQuote?.(actorValue, {
      scene, actionId: ids.finish, targetIds: payload.targetIds || [], attribute: payload.attribute || "spirit",
      baseCost: 2, baseResource: "ap", request: {},
    });
    return quote?.studentPowerUnleashed === true ? quote : null;
  }
  function studentAreaStatus(scene, actorValue, payload) {
    const ruleId = payload?.techniqueRuleId || payload?.studentArea?.ruleId;
    const rule = studentAreaRules[ruleId];
    if (!rule) return null;
    if (Number((actorValue.knownTechniques ?? actorValue.techniques)?.["ruiner.student-of-stars"] || 0) < 2) fail("Бесформенная сила требует изученный II уровень Техники");
    if (actorValue.lionwing?.automation?.[ruleId] !== true) fail("Автоматизация Бесформенной силы для этого уровня выключена");
    if (!studentPowerStatus(scene, actorValue, payload)) fail("Бесформенная сила доступна только Завершению после Зарядки");
    const requested = payload.studentArea || payload;
    const center = payload.areaCenter || requested.center || requested.anchor || null;
    if (!center) fail("Бесформенная сила требует выбранный центр области");
    return { ...rule, ruleId, center, orientation: requested.orientation || "horizontal" };
  }
  function prepareStudentArea(scene, actorValue, payload, eventId) {
    const status = studentAreaStatus(scene, actorValue, payload);
    if (!status) return null;
    const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
    if (!runtime?.areaPrepare) fail("Планировщик областей недоступен");
    const prepared = runtime.areaPrepare(scene, {
      id: `${eventId}:student-area`, sourceActorId: actorValue.id, center: status.center,
      shape: status.shape, range: status.range, orientation: status.orientation,
      ruleId: status.ruleId, label: `Ученик звёзд II: ${status.shape}`,
    });
    if (!prepared.ok) fail(prepared.errors?.join(" ") || "Область Бесформенной силы недоступна");
    payload.areaPlan = prepared.plan;
    payload.targetIds = [...prepared.preview.targetIds];
    payload.emptyTargetCount = Number(prepared.preview.emptyTargetCount || 0);
    payload.areaCenter = copy(prepared.preview.center);
    payload.techniqueRuleId = status.ruleId;
    payload.studentArea = { shape: status.shape, orientation: status.orientation, center: copy(prepared.preview.center), ruleId: status.ruleId };
    return prepared.preview;
  }
  function revalidateStudentArea(scene, actorValue, payload) {
    if (!payload?.areaPlan) return null;
    const status = studentAreaStatus(scene, actorValue, payload);
    if (!status || status.ruleId !== payload.areaPlan.request?.ruleId || payload.areaPlan.request?.sourceActorId !== actorValue.id) fail("План области Бесформенной силы повреждён");
    if (payload.areaPlan.request?.shape !== status.shape || Number(payload.areaPlan.request?.range) !== Number(status.range) || (status.shape === "line" && payload.areaPlan.request?.orientation !== status.orientation)) fail("План области Бесформенной силы не соответствует уровню Техники");
    const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
    if (!runtime?.revalidateArea) fail("Планировщик областей недоступен");
    let checked;
    try { checked = runtime.revalidateArea(scene, payload.areaPlan); } catch (error) { fail(error.message); }
    payload.targetIds = [...checked.result.targetIds];
    payload.emptyTargetCount = Number(checked.result.emptyTargetCount || 0);
    payload.areaCenter = copy(checked.result.center);
    return checked.result;
  }
  function bombardierAreaStatus(scene, actorValue, payload) {
    if (payload?.actionId !== ids.finish || !payload?.techniqueRuleId) return null;
    const rule = bombardierAreaRules[payload.techniqueRuleId];
    if (!rule) return null;
    const techniqueId = "ruiner.bombardier", level = Number(payload.techniqueRuleId.split(".").at(-1));
    if (Number((actorValue.knownTechniques ?? actorValue.techniques)?.[techniqueId] || 0) < level) fail("Бомбардир требует изученный уровень Техники");
    if (actorValue.lionwing?.automation?.[payload.techniqueRuleId] !== true) fail("Автоматизация Бомбардира для этого уровня выключена");
    const focusSpent = integer(payload.focusSpent || 0, "Фокус");
    if (focusSpent < rule.minimumFocus) fail(`Для ${payload.techniqueRuleId} нужно потратить хотя бы ${rule.minimumFocus} Фокуса`);
    const fallbackTarget = Array.isArray(payload.targetIds) && payload.targetIds.length ? actor(scene, payload.targetIds[0]) : null;
    const center = payload.areaCenter || payload.techniqueAnchor || payload.anchor || payload.center || (fallbackTarget ? { space: fallbackTarget.space, x: fallbackTarget.x, y: fallbackTarget.y } : null);
    if (!center) fail("Бомбардир требует выбранный центр области");
    return { ...rule, ruleId: payload.techniqueRuleId, center, focusSpent };
  }
  function prepareBombardierArea(scene, actorValue, payload, eventId) {
    const status = bombardierAreaStatus(scene, actorValue, payload);
    if (!status) return null;
    const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
    if (!runtime?.areaPrepare) fail("Планировщик областей недоступен");
    const prepared = runtime.areaPrepare(scene, {
      id: `${eventId}:area`, sourceActorId: actorValue.id, center: status.center,
      shape: status.shape, range: status.range, ruleId: status.ruleId,
      label: `Бомбардир: ${status.shape}`,
    });
    if (!prepared.ok) fail(prepared.errors?.join(" ") || "Область Бомбардира недоступна");
    payload.areaPlan = prepared.plan;
    payload.targetIds = [...prepared.preview.targetIds];
    payload.emptyTargetCount = Number(prepared.preview.emptyTargetCount || 0);
    payload.areaCenter = copy(prepared.preview.center);
    return prepared.preview;
  }
  function revalidateBombardierArea(scene, actorValue, payload) {
    if (!payload?.areaPlan) return null;
    const status = bombardierAreaStatus(scene, actorValue, payload);
    if (!status || status.ruleId !== payload.areaPlan.request?.ruleId || payload.areaPlan.request?.sourceActorId !== actorValue.id) fail("План области Бомбардира повреждён");
    if (payload.areaPlan.request?.shape !== status.shape || Number(payload.areaPlan.request?.range) !== Number(status.range)) fail("План области Бомбардира не соответствует уровню Техники");
    const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
    if (!runtime?.revalidateArea) fail("Планировщик областей недоступен");
    let checked;
    try { checked = runtime.revalidateArea(scene, payload.areaPlan); }
    catch (error) { fail(error.message); }
    payload.targetIds = [...checked.result.targetIds];
    payload.emptyTargetCount = Number(checked.result.emptyTargetCount || 0);
    payload.areaCenter = copy(checked.result.center);
    return checked.result;
  }
  function prepareBreacherArea(scene, actorValue, payload, eventId) {
    if (![ids.skirmish, ids.finish].includes(payload?.actionId) || payload?.breacherBothBarrels !== true) return null;
    const level = Number((actorValue.knownTechniques ?? actorValue.techniques)?.["powerhouse.breacher"] || 0);
    if (level < 3) return null;
    if (actorValue.lionwing?.automation?.["powerhouse.breacher.3"] !== true) fail("Картечь III недоступна для этого действия");
    const center = payload.areaCenter || (Array.isArray(payload.targetIds) && payload.targetIds.length ? (() => { const target = actor(scene, payload.targetIds[0]); return target ? { space: target.space, x: Number(target.x), y: Number(target.y) } : null; })() : null);
    if (!center) fail("Картечь III требует выбранного центра зоны 2×2");
    const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
    if (!runtime?.areaPrepare) fail("Планировщик областей недоступен");
    const prepared = runtime.areaPrepare(scene, { id: `${eventId}:breacher-area`, sourceActorId: actorValue.id, center, shape: "square2", range: 1, targetAudience: "all", ruleId: "powerhouse.breacher.3", label: "Картечь III: зона 2×2" });
    if (!prepared.ok) fail(prepared.errors?.join(" ") || "Зона Картечи III недоступна");
    payload.areaPlan = prepared.plan;
    payload.targetIds = [...prepared.preview.targetIds];
    payload.areaCenter = { ...prepared.preview.center };
    return prepared.preview;
  }
  function revalidateBreacherArea(scene, actorValue, payload) {
    if (!payload?.areaPlan) return null;
    const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
    if (!runtime?.revalidateArea) fail("Планировщик областей недоступен");
    const request = payload.areaPlan.request || {};
    if (request.ruleId !== "powerhouse.breacher.3" || request.sourceActorId !== actorValue.id || request.shape !== "square2" || request.targetAudience !== "all") fail("План зоны Картечи III повреждён");
    const checked = runtime.revalidateArea(scene, payload.areaPlan);
    payload.targetIds = [...checked.result.targetIds];
    payload.areaCenter = { ...checked.result.center };
    return checked.result;
  }

  function prepare(scene, request, options = {}) {
    try {
      const eventId = request?.eventId ?? request?.commandId ?? request?.id ?? global.crypto?.randomUUID?.() ?? `lw-prepared-${Date.now()}-${preparedSerial++}`;
      const payload = copy(request), actorlessKinds = ["scene-reset","round-end","intermission","tension","note","banish","vanish","compound","information-reveal","information-cancel","information-handout"], optionalActorKinds = ["choice","correct","resolve-attack","cancel-attack","batch","banish","vanish","compound","information-reveal","information-cancel","information-handout"], actorlessInventoryReset = payload.kind === "inventory" && payload.operation === "reset" && !payload.actorId, a = (actorlessKinds.includes(payload.kind) && !payload.actorId || actorlessInventoryReset) ? null : requiredActor(scene, payload.actorId, !optionalActorKinds.includes(payload.kind));
      const rollMeta = (extra = {}) => ({ rootActionId: eventId, actionInstanceId: eventId, causeEventId: eventId, ownerActorId: a?.id || null, ...extra });
      delete payload.actorId;
      if (payload.kind === "action") {
        const def = actionDef(payload.actionId);
        if (!def) fail("Базовое действие не найдено");
        const status = actionStatus(scene, a, def, payload);
        if (!status.available) fail(status.reason);
        if (def.id === ids.finish) {
          if (payload.studentArea && !payload.techniqueRuleId) payload.techniqueRuleId = payload.studentArea.shape === "square2" ? "ruiner.student-of-stars.2-zone" : payload.studentArea.shape === "line" ? "ruiner.student-of-stars.2-line" : null;
          if (payload.techniqueRuleId && studentAreaRules[payload.techniqueRuleId]) prepareStudentArea(scene, a, payload, eventId);
          else prepareBombardierArea(scene, a, payload, eventId);
        }
        if ([ids.skirmish, ids.finish].includes(def.id)) prepareBreacherArea(scene, a, payload, eventId);
        if ([ids.charge, ids.spell, ids.skirmish, ids.finish].includes(def.id) && !payload.roll){const pools=attackPools(scene,a,def,payload);payload.roll=roll(pools.base,options.random,rollMeta({rollId:`${eventId}:roll`,kind:"check",actionId:def.id,actionDefinitionId:def.id}));payload.targetRolls={};let targetRollSerial=0;for(const[id,count]of Object.entries(pools.counts))if(count>pools.base)payload.targetRolls[id]=roll(count-pools.base,options.random,rollMeta({rollId:`${eventId}:target:${targetRollSerial++}`,kind:"check",actionId:def.id,actionDefinitionId:def.id}));}
      }
      const preparedOperations=["plan","batch"].includes(payload.kind)?payload.operations:[payload];
      if(Array.isArray(preparedOperations))for(const operation of preparedOperations.filter(item=>item?.kind==="geometry-move"&&!item.geometryPlan)){
        const targetId=operation.targetId||a?.id,geometry=global.DAWN_LIONWING_GEOMETRY;
        if(!geometry?.routePlan)fail("Планировщик геометрии недоступен");
        const sourceActorId=operation.sourceActorId||a?.id;
        const planned=geometry.routePlan(scene,{sourceActorId,actorId:targetId,anchor:operation.anchor||{kind:"actor",actorId:sourceActorId},destination:operation.destination,maximum:operation.maximum,mode:operation.mode||"move",straight:operation.straight===true,allowPartial:operation.allowPartial===true,ignoreTerrain:operation.ignoreTerrain===true,ignoreEnemies:operation.ignoreEnemies===true,width:operation.width,height:operation.height});
        if(!planned.available)fail(planned.reason);operation.geometryPlan=planned.plan;
      }
      if(Array.isArray(preparedOperations))for(const [spatialIndex,operation] of preparedOperations.entries())if(["placement","teleport","displacement"].includes(operation?.kind)&&!operation.geometryRuntime){
        const runtime=global.DAWN_LIONWING_GEOMETRY_RUNTIME;if(!runtime?.prepare)fail("Планировщик пространственных операций недоступен");
        const sourceActorId=operation.sourceActorId||a?.id,targetId=operation.targetId||a?.id;
        const planned=runtime.prepare(scene,{...operation,operation:operation.kind,sourceActorId,targetId},{operationId:operation.operationId||(preparedOperations.length===1?eventId:`${eventId}:spatial:${spatialIndex}`)});
        if(!planned.ok)fail(planned.errors?.join(" ")||"Пространственная операция недоступна");
        operation.geometryRuntime=planned.plan;
      }
      // Manual attacks enter the same declarative ActionPlan boundary as
      // every other composed LionWing operation. Keep the existing `plan`
      // event vocabulary so old saves and reducers remain compatible, while
      // attaching the previewed plan and pure execution descriptor for the
      // strict recheck at dispatch time.
      if (payload.kind === "plan") {
        const actionPlanApi = global.DAWN_LIONWING_ACTION_PLAN;
        if (typeof actionPlanApi?.open === "function" && typeof actionPlanApi.preview === "function" && typeof actionPlanApi.prepareExecution === "function") {
          const planInput = payload.actionPlan || actionPlanApi.open({
          id: payload.planId || eventId,
          rootActionId: payload.rootActionId || eventId,
          definitionId: payload.actionId || "manual.attack",
          actionInstanceId: payload.actionInstanceId || eventId,
          source: { id: a.id, kind: "actor", actorId: a.id, causeEventId: eventId },
          owner: { id: a.id, kind: "actor", actorId: a.id },
          sceneVersion: Number(scene.version || 0),
          targets: (payload.targetIds || []).map(targetId => {
            const target = requiredActor(scene, targetId, false);
            return { targetId, snapshot: { space: target.space, x: target.x, y: target.y, knockedOut: Boolean(target.knockedOut) } };
          }),
          baseValues: { amount: payload.operations?.[0]?.amount ?? 0, operationCount: payload.operations?.length || 0 },
          ...(payload.costs?.length ? { costs: payload.costs } : {}),
          phases: { before: [], replace: [], apply: payload.operations || [], after: [] },
          });
          const normalizedInput = actionPlanApi.normalizePlan(planInput);
          if (normalizedInput.ownerActorId !== a.id || normalizedInput.source.actorId !== a.id) fail("ActionPlan принадлежит другому участнику");
          const previewed = actionPlanApi.preview(planInput, { scene, expectedRevision: planInput.revision });
          const execution = actionPlanApi.prepareExecution(previewed.plan, { scene, expectedRevision: previewed.plan.revision });
          payload.actionPlan = previewed.plan;
          payload.execution = execution.execution;
          payload.operations = execution.execution.operations.map(operation => ({ ...operation }));
          payload.targetIds = previewed.plan.targetIds;
        }
      }
      if (payload.kind === "plan" && !payload.reservation) payload.reservation = costQuote(scene, a.id, payload.costs, payload.targetIds || []);
      if (payload.kind === "roll" && !payload.roll) payload.roll = roll(integer(payload.count, "число костей", 100), options.random, { ...payload, ...rollMeta({ rollId: payload.rollId || payload.id || `${eventId}:roll`, kind: payload.rollKind || "check" }), kind: payload.rollKind || "check" });
      if (payload.kind === "reaction" && payload.choice === "clash" && !payload.roll) {
        const source = requiredActor(scene, scene.pendingAction?.actorId);
        payload.roll = roll(3 + Number(a.tier || 1) + adapterNumber("rollBonus", a, { scene, kind: "clash", opponentId: source.id }), options.random, rollMeta({ rollId: `${eventId}:reaction`, kind: "check" }));
        payload.opponentRoll = roll(3 + Number(source.tier || 1) + adapterNumber("rollBonus", source, { scene, kind: "clash", opponentId: a.id }), options.random, { ...rollMeta({ rollId: `${eventId}:reaction-opponent`, kind: "check", ownerActorId: source.id }), ownerActorId: source.id });
      }
      if(payload.kind==="choice"&&payload.choice==="reroll"&&scene.lionwing?.choices?.[0]?.kind==="clash-loss"){
        const source=requiredActor(scene,scene.pendingAction?.actorId);
        payload.roll=roll(3+Number(a.tier||1)+adapterNumber("rollBonus",a,{scene,kind:"clash",opponentId:source.id}),options.random,rollMeta({rollId:`${eventId}:reroll`,kind:"check"}));payload.opponentRoll=roll(3+Number(source.tier||1)+adapterNumber("rollBonus",source,{scene,kind:"clash",opponentId:a.id}),options.random,{...rollMeta({rollId:`${eventId}:reroll-opponent`,kind:"check",ownerActorId:source.id}),ownerActorId:source.id});
      }
      if(payload.kind==="punish"&&!payload.roll)payload.roll=roll(Math.max(Number(a.attrs.body||0),Number(a.attrs.talent||0)),options.random,rollMeta({rollId:`${eventId}:punish`,kind:"check"}));
      const events = [{ ...command(a?.id||null, payload), id: eventId }], preview = previewEvents(scene, events);
      // A preview rolls once. Commit and replay must use that exact snapshot.
      if (preview.ok && payload.kind === "dice-create") {
        const created = preview.events?.find(item => item.type === "dice.create")?.payload?.roll;
        if (created) events[0].payload = { ...payload, roll: copy(created), rollId: created.id };
      }
      return preview.ok ? { ...preview, events } : preview;
    } catch (error) { return { ok: false, errors: [error.message] }; }
  }

  // Operations use typed data, stable source ids, and explicit phase lifetimes.
  // Techniques may compose these operations without registering imperative code.
  function execute(scene, event, output, executionOptions = {}) {
    const s = state(scene), rootId = event.id, emitted = [];
    const scheduled = [];
    let frameSerial = 0, choiceSerial = 0, historySerial = 0, rollSerial = 0, provenance = null;
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
    let scheduleAfterEvent = null;
    const emit = (type, actorId, payload = {}) => {
      // Every resolved Action carries its engine provenance in the public
      // receipt as well as in execution metadata.  Manual record-action used
      // to omit this field, which made downstream combo adapters depend on a
      // client supplied payload flag instead of the authoritative history.
      const receiptPayload = type === "action.resolve" ? {
        ...payload,
        ...(payload.actionInstanceId || !provenance?.actionInstanceId ? {} : { actionInstanceId: provenance.actionInstanceId }),
        ...(payload.ownerTurnInstanceId || !provenance?.ownerTurnInstanceId ? {} : { ownerTurnInstanceId: provenance.ownerTurnInstanceId }),
      } : payload;
      const row = { id: `${rootId}:${emitted.length}`, at: event.at, type, actorId: actorId || null, payload: copy(receiptPayload), visibility: receiptPayload.visibility === "gm" ? "gm" : event.visibility || "public" };
      if (provenance) row.execution = copy(provenance);
      emitted.push(row); scene.log.unshift(row); scene.log = scene.log.slice(0, 200);
      const targets = receiptPayload.targetIds || (receiptPayload.targetId ? [receiptPayload.targetId] : []);
      if (type === "action.resolve") saveFact("apply", actorId, targets, { actionId: receiptPayload.actionId, manual: receiptPayload.manual === true }, { ...provenance, actionId: receiptPayload.actionId || provenance?.actionId, ownerActorId: actorId });
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
      else if (type === "aura.enter" || type === "aura.exit") saveFact(type, actorId, [actorId], { auraId:payload.auraId, effectId:payload.effectId, ruleId:payload.ruleId, ownerActorId:payload.ownerActorId, sourceEntityId:payload.sourceEntityId, movementTargetId:payload.movementTargetId||null, segmentIndex:payload.segmentIndex??null });
      else if (type === "attack.clear" && payload.cancelled) saveFact("cancel", actorId, targets, { reason: payload.reason || "cancelled" });
      if (scheduleAfterEvent && ["clash.success", "combat-meter.change", "damage.apply", "actor.knockout", "effect.apply", "actor.enter", "actor.move", "action.resolve", "attack.clear", "marker.remove", "reaction.respond", "resource.gain", "rule.used", "movement.prepare", "movement.start", "movement.segment", "movement.enter", "movement.leave", "movement.cross", "movement.end", "movement.stop"].includes(type)) scheduleAfterEvent(row);
      return row;
    };
    const mutateCombatMeter = (change = {}, sourceId = null, receiptId = `${rootId}:meter`) => {
      if (!combatMeter?.apply) fail("Фундамент боевого счётчика LionWing недоступен");
      const result = combatMeter.apply(scene, combatMeter.ids.tension, change, { receiptId });
      if (!result.changed) return result;
      const meter = result.meter;
      emit("combat-meter.change", sourceId, { id: meter.id, kind: meter.kind, before: result.before, value: result.value, current: result.value, delta: result.value - result.before, min: meter.min, max: meter.max, threshold: meter.threshold, owner: copy(meter.owner), source: copy(meter.source), scope: meter.scope, lifetime: meter.lifetime, receiptId });
      if (result.thresholdCrossed) emit("counter.threshold", sourceId, { counterId: meter.id, id: meter.id, kind: meter.kind, before: result.before, value: result.value, threshold: meter.threshold, owner: copy(meter.owner), source: copy(meter.source), scope: meter.scope, lifetime: meter.lifetime, receiptId });
      return result;
    };
    const emitSpecial = (type, actorId, operation, payload, before, after) => {
      const row = emit(type, actorId, { ...payload, special: true, specialOperation: operation });
      row.schema = 1;
      row.operation = operation;
      row.rootEventId = rootId;
      row.before = copy(before);
      row.after = copy(after);
      s.specialJournal.push(copy(row));
      s.specialJournal = s.specialJournal.slice(-128);
      saveFact("apply", actorId, payload.targetId ? [payload.targetId] : payload.partIds || [], { operation, eventType: type, special: true });
      return row;
    };
    const scheduleBoundary = (boundary, activeActor = null, options = {}) => {
      if (typeof global.DAWN_LIONWING_ADAPTERS?.boundaryOperations !== "function") return;
      const canonicalBoundary = ({ sceneStart: "sceneStart", sceneEnd: "sceneEnd", roundStart: "roundStart", roundEnd: "roundEnd", turnStart: "ownTurnStart", turnEnd: "ownTurnEnd", ownTurnStart: "ownTurnStart", ownTurnEnd: "ownTurnEnd", anyTurnStart: "anyTurnStart", anyTurnEnd: "anyTurnEnd" }[boundary] || boundary);
      const ownerTurnKey = owner => owner ? `${s.sceneSerial}:${owner.id}:${ownTurnSerial(owner)}` : null;
      // `turnStart`/`turnEnd` are offered to every registered consumer so an
      // ally can react to somebody else's Turn. Such a callback belongs to
      // the current global Turn, while a callback for the active owner keeps
      // its own-turn identity. This distinction prevents an ally's receipt
      // from suppressing the next extra Turn of the active actor.
      const boundaryForOwner = owner => {
        if (canonicalBoundary === "ownTurnStart" && boundary === "turnStart" && activeActor && owner.id !== activeActor.id) return "anyTurnStart";
        if (canonicalBoundary === "ownTurnEnd" && boundary === "turnEnd" && activeActor && owner.id !== activeActor.id) return "anyTurnEnd";
        return canonicalBoundary;
      };
      const boundaryKey = (owner, resolvedBoundary = boundaryForOwner(owner)) => {
        if (["sceneStart", "sceneEnd"].includes(resolvedBoundary)) return `${s.sceneSerial}:${resolvedBoundary}`;
        if (["roundStart", "roundEnd"].includes(resolvedBoundary)) return `${s.sceneSerial}:${scene.round}:${resolvedBoundary}`;
        if (["ownTurnStart", "ownTurnEnd"].includes(resolvedBoundary)) return `${ownerTurnKey(owner)}:${resolvedBoundary}`;
        return `${s.sceneSerial}:${s.activeTurnInstanceId || `scene-turn:${scene.turnSerial}`}:${resolvedBoundary}`;
      };
      const context = owner => {
        const resolvedBoundary = boundaryForOwner(owner);
        return { scene, boundary: ["ownTurnStart", "ownTurnEnd"].includes(canonicalBoundary) ? "turn" + (canonicalBoundary === "ownTurnStart" ? "Start" : "End") : boundary, canonicalBoundary: resolvedBoundary, activeActor, activeEffectIds: activeState(scene, owner.id).effects.filter(status => status.present).map(status => status.effect), distanceToActive: activeActor ? distance(owner, activeActor) : Infinity, ownerTurnSerial: ownTurnSerial(owner), ownerTurnInstanceId: activeActor ? s.activeTurnInstanceId || null : owner.lionwing?.turnInstanceId || null, ownerTurnKey: ownerTurnKey(owner), boundaryKey: boundaryKey(owner, resolvedBoundary) };
      };
      for (const owner of scene.actors || []) for (const rule of global.DAWN_LIONWING_ADAPTERS.boundaryOperations(owner, context(owner))) {
        const resolvedBoundary = context(owner).canonicalBoundary, resolvedBoundaryKey = boundaryKey(owner, resolvedBoundary), key = `${rule.id}:${owner.id}:${resolvedBoundaryKey}`;
        if (s.boundaryReceipts.some(receipt => receipt.key === key)) continue;
        s.boundaryReceipts.push({ schema: 1, key, ruleId: rule.id, ownerActorId: owner.id, boundary: resolvedBoundary, boundaryKey: resolvedBoundaryKey, sceneSerial: s.sceneSerial, round: Number(scene.round || 0), turnInstanceId: s.activeTurnInstanceId || null, sourceDigest: rule.sourceDigest || null, eventId: rootId });
        s.boundaryReceipts = s.boundaryReceipts.slice(-512);
        const choices = Array.isArray(rule.choices) ? rule.choices : [];
        emit("rule.activated", owner.id, { ruleId: rule.id, sourceDigest: rule.sourceDigest || null, coverage: rule.coverage || "full", boundary: resolvedBoundary, targetId: activeActor?.id || owner.id, automatic: true, optional: choices.length > 0, reason: rule.label || null });
        if (!options.discardOperations) scheduled.push(...(rule.operations || []).map(p => ({ p: { ...copy(p), sourceDigest: p.sourceDigest ?? rule.sourceDigest ?? null }, sourceId: owner.id, provenance: { rootActionId: rootId, actionId: null, actionDefinitionId: null, actionInstanceId: rootId, causeEventId: rootId, ownerActorId: owner.id, ruleId: rule.id, sourceDigest: rule.sourceDigest || null, coverage: rule.coverage || "full" } })));
        for (const option of choices) {
          if (!option?.id || !Array.isArray(option.operations)) continue;
          const optionsList = choices.map(item => item.id).filter(Boolean);
          if (!options.discardChoices) scheduled.push({ p: { kind: "technique-choice", ruleId: rule.id, triggerKey: key, title: `${rule.label || rule.id}: ${resolvedBoundary}`, options: ["skip", ...optionsList], optionLabels: { skip: "Не использовать", ...Object.fromEntries(choices.map(item => [item.id, item.label || item.id])) }, choices: Object.fromEntries(choices.map(item => [item.id, item.operations])), context: { boundary: resolvedBoundary, boundaryKey: resolvedBoundaryKey, ownerActorId: owner.id, optional: true, sourceDigest: rule.sourceDigest || null, coverage: rule.coverage || "full" } }, sourceId: owner.id, provenance: { rootActionId: rootId, actionId: null, actionDefinitionId: null, actionInstanceId: rootId, causeEventId: rootId, ownerActorId: owner.id, ruleId: rule.id, sourceDigest: rule.sourceDigest || null, coverage: rule.coverage || "full" } });
          break;
        }
      }
    };
    scheduleAfterEvent = eventRow => {
      const eventPayload = eventRow.payload || {};
      // Completed events may trigger a rule owned by a nearby ally (for
      // example Opportunist II), so candidate ownership is not limited to the
      // event subject and target. Adapters perform the authoritative relation
      // and range checks; this only widens the read-only query set.
      const candidateIds = [...new Set([eventRow.actorId, eventPayload.targetId, ...(scene.actors || []).map(item => item.id)].filter(id => typeof id === "string" && id))];
      const activeOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null;
      const ownerTurnKeyValue = activeOwner ? ownerTurnKey(s.sceneSerial, activeOwner, ownTurnSerial(activeOwner)) : null;
      for (const candidateId of candidateIds) {
        const candidate = actor(scene, candidateId);
        if (!candidate || candidate.knockedOut && eventRow.type !== "actor.knockout") continue;
        const used = (s.afterEventReceipts || []).some(receipt => receipt.ruleId === "powerhouse.berserker.3" && receipt.ownerActorId === candidate.id && receipt.turnKey === ownerTurnKeyValue);
        const triggers = global.DAWN_LIONWING_ADAPTERS?.afterEvent?.(candidate, eventRow, { scene, ownerTurnKey: ownerTurnKeyValue, ownerTurnSerial: activeOwner ? ownTurnSerial(activeOwner) : null, ownerTurnInstanceId: s.activeTurnInstanceId || null, used }) || [];
        const extraHammers = triggers.filter(trigger => trigger.id === "powerhouse.martial-artist.1" && Number((candidate.knownTechniques ?? candidate.techniques)?.["powerhouse.martial-artist"] || 0) >= 3 && candidate.lionwing?.automation?.["powerhouse.martial-artist.3"] === true && Number(eventPayload.criticals || 0) > 0).map(trigger => ({ ...trigger, triggerKey: `${trigger.triggerKey}:unlimited-blows` }));
        for (const trigger of [...triggers, ...extraHammers]) {
          if (!trigger.triggerKey || (s.afterEventReceipts || []).some(receipt => receipt.key === trigger.triggerKey)) continue;
          s.afterEventReceipts.push({ schema: 1, key: trigger.triggerKey, ruleId: trigger.id, ownerActorId: candidate.id, eventId: eventRow.id, turnKey: ownerTurnKeyValue, sourceDigest: trigger.sourceDigest || null, coverage: trigger.coverage || "full" });
          s.afterEventReceipts = s.afterEventReceipts.slice(-256);
          emit("rule.activated", candidate.id, { ruleId: trigger.id, sourceDigest: trigger.sourceDigest, triggerKey: trigger.triggerKey, causeEventId: eventRow.id, targetId: eventPayload.targetId || candidate.id, automatic: true, coverage: trigger.coverage });
          scheduled.push(...(trigger.operations || []).map(operation => ({ p: { ...copy(operation), sourceActorId: operation.sourceActorId ?? candidate.id, sourceDigest: operation.sourceDigest ?? trigger.sourceDigest ?? null }, sourceId: operation.sourceActorId ?? candidate.id, provenance: { rootActionId: eventRow.execution?.rootActionId || rootId, actionId: eventRow.execution?.actionId || null, actionDefinitionId: eventRow.execution?.actionDefinitionId || eventRow.execution?.actionId || null, actionInstanceId: eventRow.execution?.actionInstanceId || rootId, causeEventId: eventRow.id, ownerActorId: candidate.id, ruleId: trigger.id, sourceDigest: trigger.sourceDigest || null, coverage: trigger.coverage || "full" } })));
          if (trigger.choiceSet && trigger.choices?.length) {
            const options = trigger.choices.filter(option => option?.id && Array.isArray(option.operations));
            scheduled.push({ p: { kind: "technique-choice", ruleId: trigger.id, triggerKey: trigger.triggerKey, title: trigger.label, options: ["skip", ...options.map(option => option.id)], optionLabels: { skip: "Не использовать", ...Object.fromEntries(options.map(option => [option.id, option.label])) }, choices: Object.fromEntries(options.map(option => [option.id, copy(option.operations)])), context: { ...(options[0]?.context || {}), choiceSet: true, causeEventId: eventRow.id, ownerActorId: candidate.id, sourceDigest: trigger.sourceDigest || null, coverage: trigger.coverage || "full" } }, sourceId: candidate.id, provenance: { rootActionId: eventRow.execution?.rootActionId || rootId, actionId: eventRow.execution?.actionId || null, actionDefinitionId: eventRow.execution?.actionDefinitionId || eventRow.execution?.actionId || null, actionInstanceId: eventRow.execution?.actionInstanceId || rootId, causeEventId: eventRow.id, ownerActorId: candidate.id, ruleId: trigger.id, sourceDigest: trigger.sourceDigest || null, coverage: trigger.coverage || "full" } });
          } else for (const option of trigger.choices || []) scheduled.push({ p: { kind: "technique-choice", ruleId: trigger.id, triggerKey: trigger.triggerKey, title: trigger.label, options: ["skip", option.id], optionLabels: { skip: "Не использовать", [option.id]: option.label }, choices: { [option.id]: copy(option.operations || []) }, context: { ...(option.context || {}), causeEventId: eventRow.id, ownerActorId: candidate.id, sourceDigest: trigger.sourceDigest || null, coverage: trigger.coverage || "full" } }, sourceId: candidate.id, provenance: { rootActionId: eventRow.execution?.rootActionId || rootId, actionId: eventRow.execution?.actionId || null, actionDefinitionId: eventRow.execution?.actionDefinitionId || eventRow.execution?.actionId || null, actionInstanceId: eventRow.execution?.actionInstanceId || rootId, causeEventId: eventRow.id, ownerActorId: candidate.id, ruleId: trigger.id, sourceDigest: trigger.sourceDigest || null, coverage: trigger.coverage || "full" } });
        }
      }
    };
    const diceRequestFromPayload = (p, fallbackId, kind, ownerActorId = null) => {
      let input;
      if (p.request !== undefined) input = p.request;
      else if (p.roll !== undefined) input = p.roll;
      else if (p.opposed !== undefined) input = p.opposed;
      else {
        input = {};
        const reserved = new Set(["kind", "request", "roll", "opposed", "operation", "modification", "rollId", "baseRollId", "opposedId", "operationId", "sourceActorId"]);
        for (const [key, value] of Object.entries(p || {})) if (!reserved.has(key)) input[key] = copy(value);
        input.kind = p.diceKind || p.rollKind || kind;
      }
      if (!plain(input)) return input;
      const request = copy(input);
      if (request.id == null && request.rollId == null && request.rollEventId == null) request.id = fallbackId;
      if (request.kind == null && request.rollKind == null) request.kind = kind;
      if (ownerActorId != null && request.ownerActorId == null) request.ownerActorId = ownerActorId;
      if (request.rootActionId == null) request.rootActionId = provenance?.rootActionId || rootId;
      if (request.actionInstanceId == null) request.actionInstanceId = provenance?.actionInstanceId || rootId;
      if (request.causeEventId == null) request.causeEventId = rootId;
      return request;
    };
    const diceOwnerCheck = (result, sourceId, label = "Бросок", allowDelegated = false) => {
      const owner = result?.ownerActorId ?? result?.provenance?.ownerActorId;
      if (owner && sourceId && owner !== sourceId) fail(`${label} принадлежит другому участнику`);
      if (!allowDelegated && owner && event.actorId && owner !== event.actorId) fail(`${label} принадлежит другому участнику`);
      if (!owner && (event.actorId || sourceId) && event.actorId !== "scene" && sourceId !== "scene") fail(`${label} не имеет владельца-участника`);
    };
    const diceJournal = (kind, result, operationId = null) => {
      if (!Array.isArray(s.diceJournal)) s.diceJournal = [];
      const duplicate = s.diceJournal.find(entry => entry.rollId === result.id && entry.kind === kind && entry.revision === result.revision && (operationId == null ? entry.operationId == null : entry.operationId === operationId));
      if (duplicate) return duplicate;
      if (s.diceJournal.length >= DICE_SCENE_JOURNAL_LIMIT) fail("Журнал бросков LionWing достиг лимита");
      const entry = { id: `${rootId}:dice:${s.diceJournal.length}`, eventId: rootId, kind, rollId: result.id, operationId, revision: result.revision, at: event.at };
      s.diceJournal.push(entry);
      return entry;
    };
    const storeDiceRoll = (result, allowRestore = false) => {
      const current = s.diceRolls[result.id];
      if (current) {
        const normalized = reloadDiceRoll(current);
        if (JSON.stringify(normalized) !== JSON.stringify(result)) {
          if (!allowRestore) fail(`Конфликт ID броска: ${result.id}`);
          s.diceRolls[result.id] = copy(result);
          return result;
        }
        return normalized;
      }
      if (Object.keys(s.diceRolls).length >= DICE_SCENE_ROLL_LIMIT) fail("Реестр бросков LionWing достиг лимита");
      s.diceRolls[result.id] = copy(result);
      return result;
    };
    const storeOpposed = (result, allowRestore = false) => {
      const current = s.diceOpposed[result.id];
      if (current) {
        const normalized = reloadDiceRoll(current);
        if (JSON.stringify(normalized) !== JSON.stringify(result)) {
          if (!allowRestore) fail(`Конфликт ID встречной проверки: ${result.id}`);
          s.diceOpposed[result.id] = copy(result);
          return result;
        }
        return normalized;
      }
      if (Object.keys(s.diceOpposed).length >= DICE_SCENE_ROLL_LIMIT) fail("Реестр встречных бросков LionWing достиг лимита");
      s.diceOpposed[result.id] = copy(result);
      return result;
    };
    const diceOperationFromPayload = p => {
      if (p.operation && plain(p.operation)) return copy(p.operation);
      if (p.modification && plain(p.modification)) return copy(p.modification);
      const reserved = new Set(["kind", "rollId", "baseRollId", "roll", "request", "sourceActorId"]);
      const operation = {};
      for (const [key, value] of Object.entries(p || {})) if (!reserved.has(key)) operation[key] = copy(value);
      if (operation.kind == null) operation.kind = p.operationKind;
      return operation;
    };
    const diceParticipantRequest = (p, fallbackId) => {
      const input = diceRequestFromPayload(p, fallbackId, "opposed", null);
      if (plain(input) && Array.isArray(input.participants) && event.actorId) {
        input.participants = input.participants.map((participant, index) => {
          const side = copy(participant);
          if (side.ownerActorId == null && (index === 0 || side.participantId === event.actorId || side.actorId === event.actorId)) side.ownerActorId = event.actorId;
          return side;
        });
      }
      return input;
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
      if (!s.lowTension) mutateCombatMeter({ operation: "add", delta: 1 }, a.id, `${rootId}:ko-tension:${a.id}`);
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
    const wound = (a, sourceId, track = "wounds", actionPlanId = null) => {
      if (!isPlayer(a)) { applyDamage({ targetId: a.id, amount: 10, irreducible: true, sourceActorId: sourceId }); return; }
      a[track] = Number(a[track] || 0) + 1;
      if (track === "wounds") a.hp = maxHealth(a);
      if (sourceId !== a.id && !astate(a).vulnerable) a.influence = Number(a.influence || 0) + 1;
      emit(track === "wounds" ? "actor.wound" : "actor.stress", sourceId, { targetId: a.id, delta: 1, total: a[track], hp: a.hp });
      if (a[track] >= 3) {
        a[track] = 2;
         if (astate(a).vulnerable) knockout(a, { kind: track, sourceActorId: sourceId });
        else choice(a, "knockout", "Выведение из боя: Сопротивляться или принять?", ["resist", "accept"], { track, ...(actionPlanId ? { actionPlanId } : {}) });
      }
    };
    const applyEffect = (a, p, sourceId) => {
      if (!effectIds.has(p.effect)) fail("Неизвестный Эффект LionWing");
      if (p.duration && typeof p.duration === "string" && p.duration !== "default" && !lifetimes.has(p.duration)) fail("Неизвестный срок Эффекта");
      if (p.duration && typeof p.duration === "object") foundations.normalizeLifetime(p.duration, { ownerActorId: p.ownerActorId || p.boundaryOwnerId || a.id, ownerTurnSerial: ownTurnSerial(actor(scene, p.ownerActorId || p.boundaryOwnerId) || a), sceneSerial: s.sceneSerial });
      if (p.lifetime != null && p.lifetime !== "actionOrStartTurn") foundations.normalizeLifetime(p.lifetime, { ownerActorId: p.ownerActorId || p.boundaryOwnerId || a.id, ownerTurnSerial: ownTurnSerial(actor(scene, p.ownerActorId || p.boundaryOwnerId) || a), sceneSerial: s.sceneSerial });
      const original = { ...copy(p), kind: "effect", targetId: a.id, sourceActorId: sourceId };
      const consequenceId = `${rootId}:consequence:${frameSerial++}`;
      const identity = { id: consequenceId, rootActionId: provenance?.rootActionId || rootId, actionId: provenance?.actionId || p.sourceActionId || null, actionDefinitionId:provenance?.actionDefinitionId||provenance?.actionId||p.sourceActionId||null, actionInstanceId:provenance?.actionInstanceId||provenance?.rootActionId||rootId, effectInstanceId: p.effectInstanceId || `${consequenceId}:effect`, causeEventId: provenance?.causeEventId || rootId, ownerActorId: a.id };
      // Gather eligibility when the frame reaches the head, after earlier choices.
      scheduled.push({ p: { kind: "execution-frame", frame: global.DAWN_LIONWING_EXECUTION.open(original, identity) }, sourceId });
    };
    const commitEffect = (a, p, sourceId) => {
      if (!effectIds.has(p.effect)) fail("Неизвестный Эффект LionWing");
      const duration = p.duration && typeof p.duration === "string" && p.duration!=="default" ? p.duration : (persistent.has(p.effect) ? "scene" : p.effect === "positive.изгнан" ? "startTurn" : p.effect === "positive.исчез" ? "actionOrStartTurn" : a.compoundId?"roundEnd":"default");
      if (!lifetimes.has(duration)) fail("Неизвестный срок Эффекта");
      const sourceKey=p.sourceId||sourceId||`${rootId}:source`;
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
      if (p.effect === "positive.изгнан" && sourceId) for (const other of scene.actors) if (other.id !== a.id && (!a.compoundId||other.compoundId!==a.compoundId)) {
        const previous = (other.effectStates?.[p.effect]?.sources || []).filter(source => source.actorId === sourceId || (source.sourceId || source.actorId) === sourceKey);
        for (const source of previous) removeEffect(other, p.effect, { sourceId: source.sourceId || source.actorId, manual: false });
      }
      a.effects = [...new Set([...(a.effects || []), p.effect])];
      a.effectStates ||= {};
      const previousSources=(a.effectStates[p.effect]?.sources||[]).filter(item=>(item.sourceId||item.actorId)!==sourceKey);
      const source={sourceId:sourceKey,actorId:sourceId||null,ruleId:p.ruleId||provenance?.ruleId||null,actionId:p.sourceActionId||provenance?.actionId||null,actionInstanceId:provenance?.actionInstanceId||null,eventId:rootId,appliedSerial:Number(scene.turnSerial||0),appliedRound:Number(scene.round||0),duration,lifetime,ownerActorId:boundaryOwnerId,ownerTurnSerial:ownTurnSerial(boundaryOwner),removable:p.removable!==false,sourceBound:p.sourceBound!==false,suppressedBy:[],sourceType:"effect",active:true};
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
      const defenseContext = target => ({ scene, activeEffectIds: activeState(scene, target.id).effects.filter(status => status.present).map(status => status.effect) });
      const defender=compound.active?compound.parts.reduce((best,x)=>stat(x,compound.defenseType,defenseContext(x))>stat(best,compound.defenseType,defenseContext(best))?x:best,compound.parts[0]):a;
      let amount = raw;
      if (!p.irreducible) {
        if (attack && !p.finalDamage) amount = Math.max(0, amount + (effectActive(scene,source,"positive.усилен") ? Math.ceil(source.tier / 2) : 0) - (effectActive(scene,source,"negative.ослаблен") ? Math.ceil(source.tier / 2) : 0));
        amount = Math.max(0, amount - integer(p.reduction || 0, "снижение урона"));
      }
      if (attack && !p.finalDamage && source && p.fixedDamage !== true) {
        const damageQuote = global.DAWN_LIONWING_ADAPTERS?.damageQuote?.(source, { scene, kind: "attack", actionId: p.sourceActionId || null, techniqueRuleId: p.techniqueRuleId || null, targetId: a.id, targetIds: [a.id], baseValue: amount, fixedDamage: p.fixedDamage === true, jab: p.jab === true, hammersFollowUpTriggered: p.hammersFollowUpTriggered === true, followUpAttribute: p.followUpAttribute || null, tier: Number(source.tier || 1), roundUp: true });
        if (damageQuote?.ok === false) fail(damageQuote.reason || "Числовые модификаторы урона конфликтуют");
        if (damageQuote?.ok && Number.isFinite(Number(damageQuote.value))) amount = Math.max(0, Number(damageQuote.value));
      }
      const armor = !p.irreducible && attack && !p.ignoreArmor && !effectActive(scene,a,"negative.разорван") ? (compound.active&&compound.defenseType!=="armor"?0:stat(defender, "armor", defenseContext(defender))) + (effectActive(scene,a,"positive.укреплен") ? Number(a.tier || 1) : 0) + Number(p.temporaryArmor || 0) : 0;
      const afterArmor = amount > 0 ? Math.max(1, amount - armor) : 0;
      const evasionAllowed = !p.irreducible && !p.ignoreEvasion && !effectActive(scene,a,"negative.обездвижен") && !effectActive(scene,a,"negative.пойман");
      const evaded = evasionAllowed ? Math.min(afterArmor, compound.active&&compound.defenseType!=="evasion"?0:stat(defender, "evasion", defenseContext(defender))) : 0;
      let toSpend=evaded;
      for(const m of astate(defender).modifiers.filter(m=>m.stat==="evasion"&&m.amount>0)){const used=Math.min(toSpend,m.remaining??m.amount);m.remaining=(m.remaining??m.amount)-used;toSpend-=used;}
      defender.evasion = Math.max(0, Number(defender.evasion || 0) - toSpend);
      if(compound.active&&compound.defenseType==="evasion")for(const part of compound.parts)part.evasion=Math.min(Number(part.evasion||0),defender.evasion);
      const hpBefore = compound.active ? compound.hp : Number(a.hp);
      let dealt = Math.max(0, afterArmor - evaded);
      if (attack && dealt > 0 && !p.irreducible && !p.finalDamage && effectActive(scene,a,"negative.помечен")) { dealt += Number(a.tier || 1); removeEffect(a, "negative.помечен"); }
      const finalDamageQuote = global.DAWN_LIONWING_ADAPTERS?.damageQuote?.(a, { scene, key: "finalDamage", kind: "damage", actionId: p.sourceActionId || null, sourceActorId: source?.id || null, targetId: a.id, baseValue: dealt, immobilized: effectActive(scene, a, "negative.обездвижен"), tier: Number(a.tier || 1), roundUp: true });
      if (finalDamageQuote?.ok === false) fail(finalDamageQuote.reason || "Числовые модификаторы итогового урона конфликтуют");
      if (finalDamageQuote?.ok && Number.isFinite(Number(finalDamageQuote.value))) dealt = Math.max(0, Number(finalDamageQuote.value));
      if(compound.active){const nextGate=Math.max(0,(Math.ceil(compound.hp/compound.gate-1e-9)-1)*compound.gate),beforeGateDealt=dealt,gateCapacity=Math.max(0,compound.hp-nextGate);dealt=Math.min(dealt,gateCapacity);let remaining=compound.hp-dealt;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}if(beforeGateDealt>gateCapacity&&nextGate>0)mutateCombatMeter({operation:"add",delta:1},a.id,`${rootId}:compound-gate`);}
      else a.hp = Math.max(0, Number(a.hp) - dealt);
      const hit = p.hit !== false;
      emit("damage.apply", p.sourceActorId, { ...p, raw, armor, evaded, dealt, healthLost: Math.min(hpBefore, dealt), hp: a.hp, hit, wouldWound: Boolean(dealt > 0 && !compound.active && a.hp === 0) });
      if (dealt > 0 && (compound.active?compound.hp-dealt<=0:a.hp===0)) { if (isPlayer(a)) wound(a, p.sourceActorId, "wounds", p.actionPlanId || null); else {knockout(a,{kind:"damage",sourceActorId:p.sourceActorId});if(compound.active)for(const part of compound.parts){part.knockedOut=true;part.ap=0;}} }
      if (hit && !(attack && afterArmor > 0 && evaded === afterArmor) && !a.knockedOut) for (const e of p.effects || []) applyEffect(a, {...(typeof e === "string" ? { effect: e } : e),preventForcedMovement:p.preventForcedMovement}, p.sourceActorId);
    };
    const auraTransitionApi=global.DAWN_LIONWING_AURA_TRANSITIONS;
    const auraSnapshot=()=>auraTransitionApi?.capture?.(scene,auraStatus)||null;
    const auraChanges=before=>before&&auraTransitionApi?.diff?auraTransitionApi.diff(before,auraTransitionApi.capture(scene,auraStatus)):[];
    const emitAuraChanges=(changes,context={})=>{
      for(const change of changes||[])emit(`aura.${change.operation}`,change.targetId,{...change,...context,targetId:change.targetId});
    };
    const syncAttachedMarkers = (host, sourceActionId) => {
      const space = (scene.spaces || []).find(item => item.id === host.space);
      if (!space) return;
      for (const marker of scene.markers || []) {
        const hostId = marker.hostActorId || marker.metadata?.hostActorId || marker.metadata?.carrierActorId;
        if (hostId !== host.id) continue;
        const offset = marker.offset || marker.metadata?.offset || { dx: 0, dy: 0 };
        const candidates = [{ x: Number(host.x) + Number(offset.dx || 0), y: Number(host.y) + Number(offset.dy || 0) }, { x: Number(host.x) + 1, y: Number(host.y) }, { x: Number(host.x) - 1, y: Number(host.y) }, { x: Number(host.x), y: Number(host.y) + 1 }, { x: Number(host.x), y: Number(host.y) - 1 }];
        const destination = candidates.find(point => point.x >= 0 && point.y >= 0 && point.x < Number(space.width) && point.y < Number(space.height) && !removedCellKeys(scene, host.space).has(`${point.x},${point.y}`));
        if (!destination) continue;
        const nextOffset = { dx: destination.x - Number(host.x), dy: destination.y - Number(host.y) };
        if (marker.space === host.space && Number(marker.x) === destination.x && Number(marker.y) === destination.y) continue;
        Object.assign(marker, { space: host.space, x: destination.x, y: destination.y, offset: nextOffset });
        marker.metadata ||= {}; marker.metadata.hostActorId ||= host.id; marker.metadata.carrierActorId ||= host.id; marker.metadata.offset = nextOffset;
        emit("marker.move", host.id, { markerId: marker.id, carrierActorId: host.id, hostActorId: host.id, space: host.space, x: destination.x, y: destination.y, offset: nextOffset, sourceActionId, participantIds: [marker.ownerActorId, host.id].filter(Boolean) });
      }
    };
    const move = (a, p) => {
      const auraBefore=auraSnapshot();
      const firstMovementThisTurn=!(scene.log||[]).some(row=>row.type==="movement.start"&&row.actorId===a.id&&Number(row.execution?.turnSerial)===Number(scene.turnSerial));
      const result = p.__verifiedRoute ? {cost:p.__verifiedRoute.spent,path:p.__verifiedRoute.path.map(point=>({x:point.x,y:point.y})),space:p.__verifiedRoute.stoppedAt.space,endedByDifficultTerrain:p.__verifiedRoute.terminal&&p.__verifiedRoute.stopReason==="difficult-terrain"} : movement(scene, a, p.destination || p, p), from = { x: a.x, y: a.y, space: a.space };
      const endpoint=result.path[result.path.length-1]||p.destination||p;
      a.x = endpoint.x; a.y = endpoint.y; a.space = result.space;
      if(result.endedByDifficultTerrain){astate(a).difficultTerrainStopSerial=scene.turnSerial;a.stepRemaining=0;}
      if(a.compoundId)for(const part of scene.actors.filter(x=>x.compoundId===a.compoundId)){part.x=a.x;part.y=a.y;part.space=a.space;}
      const publicPayload={...p};delete publicPayload.__deferAuraTransitions;
      const moveRow=emit("actor.move", a.id, { ...publicPayload, from, x: a.x, y: a.y, space: a.space, path: result.path, distance: result.cost });
      syncAttachedMarkers(a, p.sourceActionId || p.movement || "movement");
      // Every supported move has a stable endpoint entry receipt.  The
      // segment id is derived from the authoritative execution root, so a
      // replay with a new client event id cannot fire an attached marker twice.
      emit("actor.enter", a.id, { x: a.x, y: a.y, space: a.space, segmentId: `${rootId}:endpoint`, movement: p.movement || "Перемещение", teleport: Boolean(p.teleport) });
      const auraTransitions=auraChanges(auraBefore);
      if(!p.__deferAuraTransitions)emitAuraChanges(auraTransitions,{movementTargetId:a.id,from,to:{space:a.space,x:a.x,y:a.y}});
      // Core actions such as Jump use the same journal facts as a planned
      // route. A segmented route emits its own windows below, so avoid a
      // duplicate lifecycle for its one-cell reducer moves.
      if(!p.__verifiedRoute&&!p.placement){
        const lifecycle={id:`${rootId}:move:${a.id}:${moveRow.id}`,actorId:a.id,sourceActorId:p.sourceActorId||a.id,sourceActionId:p.sourceActionId||null,actionInstanceId:p.actionInstanceId||provenance?.actionInstanceId||null,ownerTurnInstanceId:p.ownerTurnInstanceId||null,techniqueRuleId:p.techniqueRuleId||p.ruleId||null,sourceDigest:p.sourceDigest||null,mode:p.teleport?"teleport":p.forced?"forced":p.mode||"move",forced:Boolean(p.forced),from:copy(from),path:result.path.map(point=>({space:result.space,x:Number(point.x),y:Number(point.y)})),distance:Number(result.cost||0),totalDistanceThisTurn:Number(result.cost||0),firstMovementThisTurn,stoppedAt:{space:a.space,x:Number(a.x),y:Number(a.y)},stopReason:result.endedByDifficultTerrain?"difficult-terrain":null};
        emit("movement.prepare",a.id,{routeId:lifecycle.id,targetId:a.id,requestedDestination:copy(p.destination||p),maximum:Number(p.maximum??result.cost??0),movement:lifecycle});
        emit("movement.start",a.id,{routeId:lifecycle.id,targetId:a.id,movement:lifecycle});
        for(const [index,to] of lifecycle.path.entries()){
          const segment={index,from:index?lifecycle.path[index-1]:copy(from),to:copy(to),cost:1,terminal:Boolean(lifecycle.stopReason&&index===lifecycle.path.length-1),stopReason:lifecycle.stopReason};
          emit("movement.leave",a.id,{routeId:lifecycle.id,targetId:a.id,from:copy(segment.from),to:copy(to),segment,movement:{...lifecycle,path:lifecycle.path.slice(0,index)}});
          emit("movement.segment",a.id,{routeId:lifecycle.id,targetId:a.id,to:copy(to),segment,movement:{...lifecycle,path:lifecycle.path.slice(0,index+1),distance:index+1,totalDistanceThisTurn:index+1,stoppedAt:copy(to)}});
          emit("movement.enter",a.id,{routeId:lifecycle.id,targetId:a.id,to:copy(to),segment,movement:{...lifecycle,path:lifecycle.path.slice(0,index+1),distance:index+1,totalDistanceThisTurn:index+1,stoppedAt:copy(to)}});
          emit("movement.cross",a.id,{routeId:lifecycle.id,targetId:a.id,from:copy(segment.from),to:copy(to),segment,movement:{...lifecycle,path:lifecycle.path.slice(0,index+1),distance:index+1,totalDistanceThisTurn:index+1,stoppedAt:copy(to)}});
        }
        emit("movement.end",a.id,{routeId:lifecycle.id,targetId:a.id,stoppedAt:copy(lifecycle.stoppedAt),terminal:Boolean(lifecycle.stopReason),stopReason:lifecycle.stopReason,movement:lifecycle});
        if(lifecycle.stopReason)emit("movement.stop",a.id,{routeId:lifecycle.id,targetId:a.id,stoppedAt:copy(lifecycle.stoppedAt),terminal:true,stopReason:lifecycle.stopReason,movement:lifecycle});
      }
      // A typed notification is also useful when the Technique itself is manual.
      const points=[from,...result.path.map(point=>({...point,space:result.space}))];
      if (!p.placement) for (const foe of scene.actors.filter(x => live(x) && !effectActive(scene,x,"positive.исчез") && x.team !== a.team)) if (points.some((point,index)=>index>0&&distance(points[index-1],foe)===1&&distance(point,foe)>1)) {
        s.opportunities ||= []; s.opportunities.push({ id: `${rootId}:punish:${foe.id}`, actorId: foe.id, targetId: a.id, turnSerial: scene.turnSerial });
        emit("reaction.offer", foe.id, { targetId: a.id, actionId: "action.защита.наказание", name: "Наказание" });
      }
      if(!p.followSnare)for(const caught of scene.actors.filter(x=>live(x)&&x.id!==a.id&&effectActive(scene,x,"negative.пойман")&&activeEffectSources(x,"negative.пойман",scene).some(source=>source.actorId===a.id))){
        if(distance(caught,a)!==1&&!effectActive(scene,caught,"positive.устойчив"))choice(caught,"placement","Пойман: выберите клетку рядом с переместившимся источником",["place"],{adjacentTo:a.id,forced:true});
      }
      return {...result,auraTransitions};
    };
    const placeActor = (a, destination, options = {}) => {
      const auraBefore = auraSnapshot();
      const target = { ...destination, space: destination?.space || a.space };
      const result = movement(scene, a, target, { placement: true, ignoreTerrain: true, ignoreOpponents: true, width: options.width, height: options.height });
      const from = { x: a.x, y: a.y, space: a.space };
      a.x = target.x; a.y = target.y; a.space = result.space;
      if (a.compoundId) for (const part of scene.actors.filter(x => x.compoundId === a.compoundId)) { part.x = a.x; part.y = a.y; part.space = a.space; }
      emit("actor.place", a.id, { reason: options.reason || "placement", from, x: a.x, y: a.y, space: a.space, distance: 0 });
      syncAttachedMarkers(a, options.sourceActionId || options.reason || "placement");
      emitAuraChanges(auraChanges(auraBefore), { placementTargetId: a.id, from, to: { space: a.space, x: a.x, y: a.y } });
      return { ...result, distance: 0 };
    };
    const geometryRouteId = route => `${route?.sourceActorId || "scene"}:${route?.actorId || "movement"}:${route?.sceneVersion || 0}:${route?.geometryStamp || ""}`;
    // One compact, public-safe snapshot accompanies every lifecycle row. The
    // route itself was checked by DAWN_LIONWING_GEOMETRY; adapters only ever
    // receive these derived facts, never a client-supplied path or distance.
    const movementLifecycle = (route, operation, cursor = {}, extra = {}) => {
      const id = geometryRouteId(route), prior = (scene.log || []).filter(row => row.type === "movement.start" && row.actorId === route.actorId && Number(row.execution?.turnSerial) === Number(scene.turnSerial)).length;
      const completed = (route.segments || []).slice(0, Number(cursor.segmentIndex || 0));
      const distance = Number(cursor.spent || 0);
      return { id, actorId: route.actorId, sourceActorId: operation.sourceActorId || route.sourceActorId, sourceActionId: operation.sourceActionId || route.request?.sourceActionId || null, actionInstanceId: provenance?.actionInstanceId || operation.actionInstanceId || null, techniqueRuleId: operation.techniqueRuleId || operation.ruleId || route.request?.techniqueRuleId || null, sourceDigest: operation.sourceDigest || route.request?.sourceDigest || null, mode: route.mode || "move", forced: route.mode === "forced" || Boolean(operation.forced), from: route.origin ? copy(route.origin) : null, path: completed.map(segment => copy(segment.to)), distance, totalDistanceThisTurn: distance, firstMovementThisTurn: prior === 0, stoppedAt: extra.stoppedAt ? copy(extra.stoppedAt) : null, stopReason: extra.stopReason || null };
    };
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
      const lifecycle = movementLifecycle(route, operation, cursor, { stoppedAt, stopReason });
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
        movement: lifecycle,
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
        movement: lifecycle,
      });
      emit("movement.end", target.id, { routeId: lifecycle.id, targetId: target.id, stoppedAt, terminal: Boolean(terminal), stopReason: stopReason || null, movement: lifecycle });
      if (terminal) emit("movement.stop", target.id, { routeId: lifecycle.id, targetId: target.id, stoppedAt, terminal: true, stopReason: stopReason || "terminal", movement: lifecycle });
      if(operation.spatialCommit){
        const saved=copy(operation.spatialCommit),summary={...(saved.summary||{})},completedSegments=(route.segments||[]).slice(0,Number(cursor.segmentIndex||route.segments?.length||0));
        summary.stoppedAt=stoppedAt;summary.path=completedSegments.map(segment=>copy(segment.to));summary.segments=copy(completedSegments);summary.spent=Number(cursor.spent||0);summary.remaining=terminal?0:Math.max(0,Number(route.maximum||0)-Number(cursor.spent||0));summary.terminal=Boolean(terminal);summary.stopReason=stopReason||null;
        if(summary.after){summary.after.sceneVersion=Number(scene.version||0)+1;summary.after.geometryStamp=global.DAWN_LIONWING_GEOMETRY.geometryStamp({...scene,version:Number(scene.version||0)+1});for(const part of summary.after.actors||[]){part.space=target.space;part.x=Number(target.x);part.y=Number(target.y);}}
        emit(`geometry.${saved.operation}.commit`,operation.sourceActorId||route.sourceActorId,{...summary,targetId:route.actorId,operation:saved.operation});
      }
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
        p: { kind: "geometry-segment", targetId: route.actorId, geometryPlan: plan, geometryCursor: nextCursor, label: operation.label, sourceActorId: operation.sourceActorId, segmentChoices: operation.segmentChoices ?? operation.enterChoices, spatialCommit:operation.spatialCommit, ...(operation.groupId ? { groupId: operation.groupId, groupMoverId: operation.groupMoverId } : {}) },
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
    const gain = (a, requestedResource, amount, gainContext = {}) => {
      integer(amount,"получение ресурса");
      const gainStatus=global.DAWN_LIONWING_ADAPTERS?.resourceGainStatus?.(a,{scene,requestedResource,amount,actionId:gainContext.actionId||provenance?.actionId||null})||{allowed:true};
      if(gainStatus.allowed===false){emit("resource.gain.prevented",a.id,{requestedResource,amount,reason:gainStatus.reason||"Получение запрещено Техникой"});return;}
      const resource=resourceKey(a,requestedResource),before=balance(a,resource);
      if(!spendable.has(resource)&&!Object.hasOwn(a.ruleResources||{},resource))fail("Сначала настройте ресурс");
      if(requestedResource==="focus"&&a.ruleResources?.[resource]?.inverted){a.ruleResources[resource].value=Math.max(0,before-amount);emit("resource.spend",a.id,{resource,amount:Math.min(before,amount),requestedAmount:amount,inverted:true});return;}
      if(spendable.has(resource))a[resource]=before+amount;
      else {const def=a.ruleResources[resource];if(def.maximum!=null&&before+amount>def.maximum)fail("Получение превышает максимум ресурса");def.value=before+amount;}
      emit("resource.gain",a.id,{requestedResource,resource,amount,actionId:gainContext.actionId || null,actionInstanceId:gainContext.actionInstanceId || provenance?.actionInstanceId || null});
    };
    const specialString = (value, label, max = 180) => {
      if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\s]/u.test(value)) fail(`Некорректное значение: ${label}`);
      return value.trim();
    };
    const specialSourceId = (p, sourceId) => {
      const declared = p.sourceActorId ?? p.ownerActorId ?? sourceId ?? null;
      if (declared != null && (!actor(scene, declared) || actor(scene, declared).knockedOut)) fail("Источник специальной операции отсутствует или выведен из боя");
      if (p.sourceActorId != null && sourceId != null && p.sourceActorId !== sourceId) fail("Источник операции не совпадает с исполнителем");
      return declared;
    };
    const specialTarget = (p, sourceId, alive = false) => requiredActor(scene, p.targetId || p.targetActorId || sourceId, alive);
    const reappearanceChoice = (target, context = {}) => choice(target, "placement", "Выберите клетку появления вне соседства с персонажами", ["place"], { reappear: true, ...context });
    const reappear = (target, p = {}, reason = "reappear") => {
      const destination = p.destination || p.reappearance || null;
      removeEffect(target, "positive.исчез", { sourceId: p.sourceId || p.effectSourceId || undefined, manual: p.operation === "remove", reappear: false });
      if (!destination) { reappearanceChoice(target, { special: true, reason }); return null; }
      if (!Number.isInteger(destination.x) || !Number.isInteger(destination.y)) fail("Появление требует координаты клетки");
      const point = { ...destination, space: destination.space || target.space };
      if (scene.actors.some(other => live(other) && other.id !== target.id && distance(point, other) <= 1)) fail("Появление запрещено рядом с персонажем");
      return placeActor(target, point, { reason });
    };
    const banishOperation = (p, sourceId) => {
      const operation = p.operation || "apply";
      if (!["apply", "remove", "expire"].includes(operation)) fail("Неизвестная операция Изгнания");
      if (p.effect != null && p.effect !== "positive.изгнан") fail("Изгнание работает только с Эффектом positive.изгнан");
      const target = specialTarget(p, sourceId, false), sourceActorId = specialSourceId(p, sourceId), compoundId = target.compoundId || null;
      const before = specialSnapshot(scene, "banish", [target.id], compoundId);
      const sourceKey = p.sourceId ?? sourceActorId ?? `${rootId}:banish`;
      if (typeof sourceKey !== "string" || !sourceKey || sourceKey.length > 180) fail("Некорректный источник Изгнания");
      if (operation === "apply") {
        commitEffect(target, { effect: "positive.изгнан", duration: "startTurn", sourceId: sourceKey, removable: p.removable !== false, sourceBound: true }, sourceActorId);
      } else {
        const sources = target.effectStates?.["positive.изгнан"]?.sources || [];
        const selected = p.sourceId || p.sourceActorId || sourceActorId ? sources.filter(item => (item.sourceId || item.actorId) === (p.sourceId || p.sourceActorId || sourceActorId)) : sources;
        if (!selected.length) fail("Источник Изгнания не найден");
        if (!p.sourceId && !p.sourceActorId && !sourceActorId && new Set(sources.map(item => item.sourceId || item.actorId)).size > 1) fail("Снятие Изгнания требует ID источника");
        removeEffect(target, "positive.изгнан", { sourceId: selected.length === 1 ? selected[0].sourceId || selected[0].actorId : undefined, manual: operation === "remove", reappear: false });
      }
      const after = specialSnapshot(scene, "banish", [target.id], compoundId);
      emitSpecial("effect.banish", sourceActorId || sourceId, "banish", { operation, targetId: target.id, sourceActorId, sourceId: operation === "apply" ? sourceKey : p.sourceId || sourceActorId || null, duration: operation === "apply" ? "startTurn" : null }, before, after);
      return target;
    };
    const vanishOperation = (p, sourceId) => {
      const operation = p.operation || "apply";
      if (!["apply", "remove", "expire", "reappear", "search"].includes(operation)) fail("Неизвестная операция Исчезновения");
      if (p.effect != null && p.effect !== "positive.исчез") fail("Исчезновение работает только с Эффектом positive.исчез");
      if (operation === "search") {
        const seeker = requiredActor(scene, sourceId, true), target = requiredActor(scene, p.targetId, true);
        if (scene.activeActorId !== seeker.id || target.team === seeker.team || !effectActive(scene, target, "positive.исчез")) fail("Поиск: на своём Ходу выберите Исчезнувшего противника");
        const before = specialSnapshot(scene, "vanish", [target.id], target.compoundId || null);
        spend(seeker, "ap", 2);
        reappear(target, { operation: "search", sourceId: p.sourceId || undefined, destination: p.destination }, "reappear-search");
        const after = specialSnapshot(scene, "vanish", [target.id], target.compoundId || null);
        emitSpecial("effect.vanish", seeker.id, "vanish", { operation, targetId: target.id, sourceActorId: seeker.id, destination: p.destination || null }, before, after);
        return target;
      }
      const target = specialTarget(p, sourceId, false), sourceActorId = specialSourceId(p, sourceId), compoundId = target.compoundId || null;
      const before = specialSnapshot(scene, "vanish", [target.id], compoundId);
      if (operation === "apply") {
        if (effectActive(scene, target, "positive.исчез")) fail("Участник уже Исчез");
        const sourceKey = p.sourceId ?? sourceActorId ?? `${rootId}:vanish`;
        if (typeof sourceKey !== "string" || !sourceKey || sourceKey.length > 180) fail("Некорректный источник Исчезновения");
        commitEffect(target, { effect: "positive.исчез", duration: "actionOrStartTurn", sourceId: sourceKey, removable: p.removable !== false, sourceBound: false }, sourceActorId);
      } else {
        if (!effectActive(scene, target, "positive.исчез")) fail("Участник не Исчез");
        reappear(target, { ...p, operation }, operation === "expire" ? "reappear-expire" : operation === "remove" ? "reappear-remove" : "reappear");
      }
      const after = specialSnapshot(scene, "vanish", [target.id], compoundId);
      emitSpecial("effect.vanish", sourceActorId || sourceId, "vanish", { operation, targetId: target.id, sourceActorId, destination: p.destination || p.reappearance || null, duration: operation === "apply" ? "actionOrStartTurn" : null }, before, after);
      return target;
    };
    const compoundInputIds = p => {
      const raw = p.partIds ?? p.actorIds ?? p.parts;
      if (!Array.isArray(raw) || !raw.length) fail("Compound требует список Parts");
      if (raw.length > 12 || raw.some(id => typeof id !== "string" || !id.trim())) fail("Некорректный список Parts Compound");
      const ids = raw.map(id => id.trim());
      if (new Set(ids).size !== ids.length) fail("Part нельзя указать дважды");
      return ids;
    };
    const compoundParts = ids => ids.map(id => requiredActor(scene, id, false));
    const validateCompoundParts = (parts, id, existing = null) => {
      if (parts.length < 2 || parts.length > 12) fail("Compound должен содержать от 2 до 12 Parts");
      const teams = new Set(parts.map(part => part.team));
      if (teams.size !== 1) fail("Все Parts Compound должны быть одной стороны");
      const first = parts[0];
      if (parts.some(part => isPlayer(part) || part.kind === "crowd" || String(part.profileId || "").includes(".modifier.") || part.modifier === "collateral" || part.knockedOut)) fail("Compound состоит только из активных NPC Parts");
      if (parts.some(part => part.compoundId && part.compoundId !== id && (!existing || !existing.partIds?.includes(part.id)))) fail("Part уже принадлежит другому Compound");
      if (parts.some(part => part.space !== first.space || Number(part.x) !== Number(first.x) || Number(part.y) !== Number(first.y))) fail("Все Parts Compound должны занимать одно пространство и клетку");
      return parts;
    };
    const compoundStats = (parts, p, existing = null) => {
      const tier = p.tier ?? existing?.tier ?? parts.reduce((max, part) => Math.max(max, Number(part.tier || 0)), 0);
      if (!Number.isSafeInteger(tier) || tier < 0 || tier > 99) fail("Некорректная Ступень Compound");
      const speeds = parts.map(part => Number(part.compoundBaseSpeed ?? part.speed ?? 0));
      const counts = new Map(); for (const value of speeds) counts.set(value, (counts.get(value) || 0) + 1);
      const speed = [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0] ?? 0;
      const armor = Math.max(...parts.map(part => stat(part, "armor"))), evasion = Math.max(...parts.map(part => stat(part, "evasion")));
      const defenseType = p.defenseType ?? existing?.defenseType ?? (armor >= evasion ? "armor" : "evasion");
      if (!["armor", "evasion"].includes(defenseType)) fail("Compound выбирает Armor или Evasion");
      return { tier, speed, defenseType };
    };
    const mergeCompoundEffects = parts => {
      const effects = new Set(parts.flatMap(part => part.effects || []));
      const states = {};
      for (const effect of effects) {
        const sourceList = [];
        for (const part of parts) for (const source of part.effectStates?.[effect]?.sources || []) if (!sourceList.some(item => (item.sourceId || item.actorId) === (source.sourceId || source.actorId))) sourceList.push(copy(source));
        const first = parts.map(part => part.effectStates?.[effect]).find(Boolean) || { duration: effect === "positive.изгнан" ? "startTurn" : effect === "positive.исчез" ? "actionOrStartTurn" : "roundEnd" };
        states[effect] = { ...copy(first), sources: sourceList };
      }
      for (const part of parts) { part.effects = [...effects]; part.effectStates = copy(states); }
    };
    const mergeCompoundTraits = parts => {
      const techniques = {};
      for (const part of parts) for (const [id, level] of Object.entries(part.techniques || {})) techniques[id] = Math.max(Number(techniques[id] || 0), Number(level || 0));
      const passives = [...new Set(parts.flatMap(part => Array.isArray(part.passives) ? part.passives : Object.keys(part.passives || {})))];
      for (const part of parts) { if (Object.keys(techniques).length) part.techniques = copy(techniques); if (passives.length) part.passives = [...passives]; }
    };
    const compoundRecord = (id, parts, stats, existing = null) => ({
      schema: 1, id, partIds: parts.map(part => part.id), team: parts[0].team, space: parts[0].space, x: Number(parts[0].x), y: Number(parts[0].y), tier: stats.tier, speed: stats.speed, defenseType: stats.defenseType,
      maxHp: parts.reduce((sum, part) => sum + Number(part.maxHp ?? maxHealth(part)), 0), hp: parts.reduce((sum, part) => sum + Number(part.hp || 0), 0), gate: parts.reduce((sum, part) => sum + Number(part.maxHp ?? maxHealth(part)), 0) / parts.length,
      originals: existing?.originals || Object.fromEntries(parts.map(part => [part.id, { tier: part.tier, compoundBaseSpeed: part.compoundBaseSpeed ?? null, compoundDefense: part.compoundDefense ?? null }]))
    });
    const applyCompoundStats = (parts, id, stats) => {
      for (const part of parts) { part.compoundId = id; part.compoundBaseSpeed = stats.speed; part.compoundDefense = stats.defenseType; part.tier = stats.tier; }
      mergeCompoundEffects(parts); mergeCompoundTraits(parts);
    };
    const dissolveParts = (parts, record) => {
      for (const part of parts) {
        const original = record?.originals?.[part.id] || {};
        delete part.compoundId;
        if (original.compoundBaseSpeed == null) delete part.compoundBaseSpeed; else part.compoundBaseSpeed = original.compoundBaseSpeed;
        if (original.compoundDefense == null) delete part.compoundDefense; else part.compoundDefense = original.compoundDefense;
        if (original.tier != null) part.tier = original.tier;
        if (original.techniques != null) part.techniques = copy(original.techniques); else delete part.techniques;
        if (original.passives != null) part.passives = copy(original.passives); else delete part.passives;
      }
    };
    const compoundOperation = (p, sourceId) => {
      const operation = p.operation || "create";
      if (!["create", "update", "add", "remove", "dissolve", "disband"].includes(operation)) fail("Неизвестная операция Compound");
      const id = specialString(p.compoundId ?? p.id, "ID Compound", 120);
      if (!compoundIdPattern.test(id) || ["constructor", "prototype", "__proto__"].includes(id)) fail("Некорректный ID Compound");
      const current = s.compounds[id] || null;
      const currentIds = current?.partIds || scene.actors.filter(part => part.compoundId === id).map(part => part.id);
      if (operation === "create") {
        if (current || currentIds.length) fail("Compound с таким ID уже существует");
        const parts = validateCompoundParts(compoundParts(compoundInputIds(p)), id), before = specialSnapshot(scene, "compound", parts.map(part => part.id), id), stats = compoundStats(parts, p), originals = Object.fromEntries(parts.map(part => [part.id, { tier: part.tier, compoundBaseSpeed: part.compoundBaseSpeed ?? null, compoundDefense: part.compoundDefense ?? null, techniques: copy(part.techniques || null), passives: copy(part.passives || null) }]));
        applyCompoundStats(parts, id, stats); s.compounds[id] = compoundRecord(id, parts, stats, { originals });
        const after = specialSnapshot(scene, "compound", parts.map(part => part.id), id);
        emitSpecial("compound.create", sourceId, "compound", { operation, compoundId: id, partIds: parts.map(part => part.id), tier: stats.tier, speed: stats.speed, defenseType: stats.defenseType }, before, after); return;
      }
      if (!current && currentIds.length < 2) fail("Compound не найден");
      if (!current) { const members = compoundParts(currentIds), stats = compoundStats(members, {}, null); s.compounds[id] = compoundRecord(id, members, stats); }
      const record = s.compounds[id], members = compoundParts(record.partIds || currentIds);
      if (operation === "add") {
        const additions = compoundParts(compoundInputIds(p));
        if (additions.some(part => members.some(member => member.id === part.id))) fail("Part уже входит в этот Compound");
        const all = validateCompoundParts([...members, ...additions], id, record), before = specialSnapshot(scene, "compound", all.map(part => part.id), id), stats = compoundStats(all, p, record);
        const originals = { ...(record.originals || {}), ...Object.fromEntries(additions.map(part => [part.id, { tier: part.tier, compoundBaseSpeed: part.compoundBaseSpeed ?? null, compoundDefense: part.compoundDefense ?? null, techniques: copy(part.techniques || null), passives: copy(part.passives || null) }])) };
        applyCompoundStats(all, id, stats); s.compounds[id] = compoundRecord(id, all, stats, { ...record, originals }); const after = specialSnapshot(scene, "compound", all.map(part => part.id), id);
        emitSpecial("compound.add", sourceId, "compound", { operation, compoundId: id, partIds: additions.map(part => part.id), allPartIds: all.map(part => part.id) }, before, after); return;
      }
      if (operation === "update") {
        const before = specialSnapshot(scene, "compound", members.map(part => part.id), id), stats = compoundStats(members, p, record); applyCompoundStats(members, id, stats); s.compounds[id] = compoundRecord(id, members, stats, record); const after = specialSnapshot(scene, "compound", members.map(part => part.id), id);
        emitSpecial("compound.update", sourceId, "compound", { operation, compoundId: id, partIds: members.map(part => part.id), tier: stats.tier, speed: stats.speed, defenseType: stats.defenseType }, before, after); return;
      }
      const removeIds = operation === "remove" && (p.partIds || p.actorIds || p.parts) ? compoundInputIds(p) : members.map(part => part.id);
      if (removeIds.some(partId => !members.some(member => member.id === partId))) fail("Part не входит в этот Compound");
      const removed = compoundParts(removeIds), remaining = members.filter(part => !removeIds.includes(part.id)), before = specialSnapshot(scene, members.map(part => part.id), id);
      if (remaining.length && remaining.length < 2) fail("Compound нельзя оставить с одним Part");
      dissolveParts(removed, record);
      if (remaining.length) { const stats = compoundStats(remaining, {}, record); applyCompoundStats(remaining, id, stats); s.compounds[id] = compoundRecord(id, remaining, stats); }
      else delete s.compounds[id];
      const after = specialSnapshot(scene, members.map(part => part.id), id);
      emitSpecial(operation === "remove" ? "compound.remove" : "compound.dissolve", sourceId, "compound", { operation, compoundId: id, removedPartIds: removed.map(part => part.id), partIds: remaining.map(part => part.id) }, before, after);
    };
    const applyHealing = (p,sourceId) => { const target = requiredActor(scene, p.targetId || sourceId); const amount = integer(p.amount, "лечение"),compound=legacy.compoundEnemyStatus(scene,target),before=compound.active?compound.hp:target.hp;let after;if(compound.active){after=Math.min(Math.ceil(compound.hp/compound.gate)*compound.gate,compound.hp+amount);let remaining=after;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}}else{target.hp=Math.min(maxHealth(target),target.hp+amount);after=target.hp;}emit("actor.heal",sourceId,{targetId:target.id,amount,restored:after-before,prevented:amount>0&&after===before});};
    const applyHealthLoss = (a, p, sourceId) => {
      const requested = integer(p.amount, "потеря Здоровья"), compound = legacy.compoundEnemyStatus(scene, a), before = compound.active ? compound.hp : Number(a.hp || 0), lost = Math.min(before, requested);
      if(p.mode!=="lose"&&requested>before)fail("Недостаточно Здоровья для оплаты");
      const after = before - lost;
      if (compound.active) {
        let remaining = after;
        for (const part of compound.parts) { const capacity = Number(part.maxHp ?? maxHealth(part)); part.hp = Math.min(capacity, remaining); remaining = Math.max(0, remaining - part.hp); }
      } else a.hp = after;
      emit(p.mode === "lose" ? "health.lose" : "health.spend", sourceId, { targetId: a.id, requested, lost, hp: compound.active ? after : a.hp, compoundId: compound.active ? compound.id : null });
      if (lost > 0 && after === 0) {
        if (compound.active) { const representative = compound.parts.find(part => !part.knockedOut) || compound.parts[0]; knockout(representative, { kind: p.mode === "lose" ? "health-loss" : "health-spend", sourceActorId: sourceId }); for (const part of compound.parts) { part.knockedOut = true; part.ap = 0; } }
        else if (isPlayer(a)) wound(a, sourceId, "wounds", p.actionPlanId || null);
        else knockout(a, { kind: p.mode === "lose" ? "health-loss" : "health-spend", sourceActorId: sourceId });
      }
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
      if (inventory?.resetActor) {
        const changes = inventory.resetActor(a, boundary === "roundEnd" ? "round" : boundary === "startTurn" || boundary === "endTurn" ? "turn" : boundary, { scene });
        for (const change of changes) emit("inventory.reset", a.id, change);
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
        boundary === "startTurn" && ["startTurn","nextTurn","actionOrStartTurn"].includes(source?.duration||saved?.duration) ||
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
      const fallbackId = `${rootId}:roll:${rollSerial++}`;
      const result = validateRoll(value, { rollId: fallbackId, ownerActorId: a?.id ?? null });
      if (dice && a?.id) diceOwnerCheck(result, a.id, "Бросок", true);
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
      scene.pendingAction = { id: rootId, actionInstanceId:p.actionInstanceId || provenance?.actionInstanceId||rootId, lionwing: true, actorId: a.id, name: p.name || "Атака", targetIds: targets, damage: integer(p.amount, "урон"), repeat: integer(p.repeat ?? 1, "повторы", 30), criticals: Number(p.criticals || 0), effects: copy(p.effects || []), finalDamage: Boolean(p.finalDamage), ignoreArmor:p.ignoreArmor===true, ignoreEvasion:p.ignoreEvasion===true, irreducible:p.irreducible===true, responses: Object.fromEntries(targets.map(id => [id, { choice: "pending" }])), sourceActionId: p.actionId || "manual.attack", techniqueRuleId: p.techniqueRuleId || null, techniqueId: p.techniqueId || null, techniqueIds: Array.isArray(p.techniqueIds) ? copy(p.techniqueIds) : null, ...(p.breacherPush ? { breacherPush: true, breacherPushMultiplier: Number(p.breacherPushMultiplier || 1), breacherAttackSuccess: p.breacherAttackSuccess === true, breacherInitialDistances: copy(p.breacherInitialDistances || {}) } : {}), ...(p.breacherWeaken ? { breacherWeaken: true } : {}), ...(p.areaPlan ? { areaPlan: copy(p.areaPlan), areaCells: copy(p.areaPlan.result?.cells || []), areaCenter: copy(p.areaPlan.result?.center), emptyTargetCount: Number(p.emptyTargetCount || 0) } : {}), ...(p.__actionPlan ? { actionPlan: copy(p.__actionPlan), actionPlanId: p.__actionPlan.id } : {}), ...(p.__execution ? { execution: copy(p.__execution) } : {}) };
      if(p.targetDamage){if(typeof p.targetDamage!=="object"||Array.isArray(p.targetDamage))fail("Некорректный урон по целям");for(const[id,amount]of Object.entries(p.targetDamage)){if(!targets.includes(id))fail("Урон указан для посторонней цели");integer(amount,"урон цели");}scene.pendingAction.targetDamage=copy(p.targetDamage);}
      if (!scene.pendingAction.repeat) fail("Нужно хотя бы одно нанесение урона");
      emit("attack.pending", a.id, scene.pendingAction);
      if(effectActive(scene,a,"negative.порчен"))s.afterAttack=[...(s.afterAttack||[]),{kind:"damage",targetId:a.id,amount:Number(a.tier||1),sourceActorId:a.id,irreducible:true}];
    };
    const detectiveFinisherOpen = (p, sourceId) => {
      const source = requiredActor(scene, sourceId, false), target = requiredActor(scene, p.targetId, false);
      if (!detectiveEnabled(source) || source.lionwing?.automation?.[detectiveRuleId] !== true || target.team === source.team) fail("Завершение Детектива недоступно");
      const turnId = s.activeTurnInstanceId || null;
      if (detectiveRemovals(scene, source.id, target.id, turnId).length !== 3) fail("Требуются ровно три удаления Слабых точек этой цели за текущий Ход");
      const cells = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ space: target.space, x: Number(target.x) + dx, y: Number(target.y) + dy }));
      const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
      if (!runtime?.prepare) fail("Планировщик пространства недоступен");
      const choices = {}, labels = {};
      for (const destination of cells) {
        const planned = runtime.prepare(scene, { operation: "teleport", sourceActorId: source.id, targetId: source.id, destination, ruleId: detectiveRuleId, label: "Детектив III: телепортация рядом с целью" });
        if (!planned.ok) continue;
        const id = `cell:${destination.space}:${destination.x},${destination.y}`;
        choices[id] = [{ kind: "detective-finisher", sourceActorId: source.id, targetId: target.id, destination, triggerKey: p.triggerKey, ruleId: detectiveRuleId, geometryRuntime: planned.plan }];
        labels[id] = `Телепортировать в (${destination.x}, ${destination.y}) и выполнить Завершение Разумом`;
      }
      const options = ["skip", ...Object.keys(choices)];
      if (options.length === 1) return;
      choice(source, "technique-trigger", `Детектив III: телепорт рядом с ${target.name} и бесплатно выполнить Завершение Разумом`, options, { ruleId: detectiveRuleId, triggerKey: p.triggerKey, targetId: target.id, causeEventId: p.causeEventId || rootId, ownerActorId: source.id, optionLabels: { skip: "Не использовать", ...labels }, choices });
    };
    const detectiveFreeFinisher = (p, sourceId) => {
      const source = requiredActor(scene, sourceId, false), target = requiredActor(scene, p.targetId, false);
      if (!detectiveEnabled(source) || source.lionwing?.automation?.[detectiveRuleId] !== true || target.team === source.team || !p.triggerKey) fail("Завершение Детектива недоступно");
      if (detectiveRemovals(scene, source.id, target.id, s.activeTurnInstanceId || null).length !== 3) fail("Завершение Детектива требует три удаления за текущий Ход");
      if (!p.destination || p.destination.space !== target.space || Math.abs(Number(p.destination.x) - Number(target.x)) + Math.abs(Number(p.destination.y) - Number(target.y)) !== 1) fail("Телепортация Завершения должна быть в соседнюю клетку цели");
      const runtime = global.DAWN_LIONWING_GEOMETRY_RUNTIME;
      if (!runtime?.prepare) fail("Планировщик пространства недоступен");
      const planned = runtime.prepare(scene, { operation: "teleport", sourceActorId: source.id, targetId: source.id, destination: p.destination, ruleId: detectiveRuleId, label: "Детектив III: телепортация к цели" });
      if (!planned.ok) fail(planned.errors?.join(" ") || "Клетка телепортации недоступна");
      const checked = runtime.commit(scene, planned.plan);
      for (const saved of checked.after.actors || []) { const current = requiredActor(scene, saved.id, false); current.space = saved.space; current.x = Number(saved.x); current.y = Number(saved.y); }
      emit("geometry.teleport.commit", source.id, { ...checked.event.payload.summary, operation: "teleport", targetId: source.id, ruleId: detectiveRuleId, free: true });
      const def = actionDef(ids.finish), rollValue = roll(diceCount(scene, source, def, { attribute: "mind" }), executionOptions.random, { ...provenance, rollId: `${rootId}:detective-finisher:roll`, kind: "check", actionId: ids.finish, actionDefinitionId: ids.finish, ownerActorId: source.id });
      emit("action.resolve", source.id, { actionId: ids.finish, name: "Завершение Разумом", targetIds: [target.id], actionInstanceId: `${rootId}:detective-finisher`, ownerTurnInstanceId: s.activeTurnInstanceId || null, attribute: "mind", techniqueRuleId: detectiveRuleId, finisherMode: "mind", free: true, fixedTargetId: target.id, triggerKey: p.triggerKey });
      const result = publishRoll(source, rollValue, "Завершение Разумом (Детектив III)");
      astate(source).history.push({ actionId: ids.finish, actionDefinitionId: ids.finish, actionInstanceId: `${rootId}:detective-finisher`, targetIds: [target.id], round: scene.round, turnSerial: scene.turnSerial, ownerTurnActorId: source.id, ownerTurnSerial: ownTurnSerial(source), ownerTurnInstanceId: s.activeTurnInstanceId || null, ownerTurnKey: ownerTurnKey(s.sceneSerial, source, ownTurnSerial(source)), swift: false, free: true, ruleId: detectiveRuleId, triggerKey: p.triggerKey });
      beginAttack(source, { actionId: ids.finish, actionInstanceId: `${rootId}:detective-finisher`, name: "Завершение Разумом", targetIds: [target.id], amount: result.successes + tensionValue(scene), targetDamage: { [target.id]: result.successes + tensionValue(scene) }, attribute: "mind", finisherMode: "mind", techniqueRuleId: detectiveRuleId, finalDamage: false });
    };
    const performAction = (a, p) => {
      const def = actionDef(p.actionId);
      if (!def) fail("Неизвестное базовое действие");
      const status = actionStatus(scene, a, def, p);
      if (!status.available) fail(status.reason);
      const assassinStride = def.id === ids.step && status.actionQuote?.modifierIds?.includes("vagabond.assassin.3");
      const icicleRequested = def.id === ids.breathe && (p.icicle === true || p.useIcicle === true || p.cryomancerIcicle === true || p.icicleChoice === "empty");
      const icicleClock = a.ruleClocks?.["ruiner.cryomancer.icicle"];
      if (icicleRequested) {
        if (a.lionwing?.automation?.["ruiner.cryomancer.2"] !== true || !icicleClock) fail("Сосулька Ледяного покрова недоступна");
        const segments = Number(icicleClock.current ?? icicleClock.value ?? 0);
        if (!Number.isSafeInteger(segments) || segments < 1) fail("Сосулька пуста");
        const targetId = p.icicleTargetId || p.targetId || (Array.isArray(p.targetIds) && p.targetIds.length === 1 ? p.targetIds[0] : null);
        const target = targetId && requiredActor(scene, targetId, true);
        if (!target || target.id === a.id || distance(a, target) > 5) fail("Сосулька требует вражескую цель в пределах 5 клеток");
        p.icicleReplacement = { segments, targetId: target.id, immobilize: effectActive(scene, target, "negative.замедлен") };
      }
      if (effectActive(scene,a,"positive.исчез") && !assassinStride) {
        if (!p.reappearance) fail("Сначала выберите клетку появления");
        if (scene.actors.some(x => live(x) && x.id !== a.id && distance({ ...p.reappearance, space: p.reappearance.space || a.space }, x) <= 1)) fail("Появление запрещено рядом с персонажем");
        removeEffect(a, "positive.исчез",{reappear:false}); placeActor(a, p.reappearance, { reason: "reappear-action" });
      }
      if ([ids.skirmish, ids.finish].includes(def.id) && p.areaPlan) {
        if (p.breacherBothBarrels === true) revalidateBreacherArea(scene, a, p);
        else if (p.areaPlan.request?.ruleId && studentAreaRules[p.areaPlan.request.ruleId]) revalidateStudentArea(scene, a, p);
        else revalidateBombardierArea(scene, a, p);
      }
      const targets = targetIds(scene,p.targetIds).map(id => requiredActor(scene, id));
      if ([ids.spell, ids.study, ids.shove, "action.атаки.дуэль"].includes(def.id) && targets.length !== 1 || def.id === ids.finish && !p.areaPlan && targets.length !== 1 || def.id === ids.skirmish && (!targets.length || !p.areaPlan && targets.length > 2)) fail("Неверное число целей");
      const finishContext = { scene, kind: "attack", actionId: def.id, attribute: p.attribute || (def.id === ids.finish ? "spirit" : null), techniqueRuleId: p.techniqueRuleId || null, breacherBuckShot: p.breacherBuckShot === true, tension: tensionValue(scene), spellCircleActive: p.spellCircleActive === true || spellCircleActive(scene, a), firstSpiritFinisherThisTurn: def.id === ids.finish && (p.firstSpiritFinisherThisTurn === true || firstSpiritFinisherThisTurn(scene, a, p.actionInstanceId || provenance?.actionInstanceId || rootId)) };
      const range = def.id === ids.spell ? 5 : def.id === ids.finish ? Math.max(Number(status.actionQuote?.range || 0), 1 + adapterNumber("rangeBonus", a, finishContext)) : def.id === ids.skirmish ? 1 + adapterNumber("rangeBonus", a, finishContext) : def.id === ids.study ? Number(status.actionQuote?.range ?? a.attrs.mind ?? 0) : 1;
      if ([ids.spell, ids.skirmish, ids.study, ids.shove, "action.атаки.дуэль"].includes(def.id) && !p.areaPlan && targets.some(t => t.id === a.id || distance(a, t) > range) || def.id === ids.finish && !p.areaPlan && targets.some(t => t.id === a.id || distance(a, t) > range)) fail("Цель вне дальности действия");
      if (def.id === ids.study && isPlayer(targets[0])) fail("Изучение требует NPC");
      const focusSpent = integer(p.focusSpent || 0, "Фокус");
      const studentPower = def.id === ids.finish && status.actionQuote?.studentPowerUnleashed === true;
      const focusCap = studentPower ? Number(status.actionQuote?.focusCap ?? 0) : tensionValue(scene);
      if (def.id === ids.finish && focusSpent > focusCap) fail(`Расход Фокуса превышает допустимый предел ${focusCap}`);
      if (studentPower) {
        p.techniqueRuleId ||= "ruiner.student-of-stars.1";
        p.techniqueSourceDigest ||= "64d7fc6b8ff19f2f7ab1b9b12c8021872835baf6374bb729837f7d2f2a27fa60";
        p.studentPowerUnleashed = true;
        p.studentFocusCap = focusCap;
      }
      if (p.breakout) spend(a, "influence", 1);
      if (status.cost) spend(a, status.resource, status.cost);
      if (def.id === ids.finish && focusSpent) spend(a, "focus", focusSpent);
      if(status.allowanceId)astate(a).allowances.find(x=>x.id===status.allowanceId).remaining--;
      if(def.id===ids.improvise&&p.removeObstacleId){const index=scene.objects.findIndex(o=>o.id===p.removeObstacleId&&o.type==="terrain"&&o.space===a.space&&(o.cells||[]).some(cell=>{const[x,y]=cell.split(',').map(Number);return distance(a,{x,y,space:a.space})===1;}));if(index<0)fail("Соседнее препятствие не найдено");scene.objects.splice(index,1);}
      if (!status.continuation && !status.swift) { a.usedActions = [...new Set([...(a.usedActions || []), def.id])]; astate(a).turnActions = [...new Set([...(astate(a).turnActions || []), def.id])]; }
      const activeTurnOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null, activeOwnerSerial = activeTurnOwner ? ownTurnSerial(activeTurnOwner) : null;
      astate(a).history = [...(astate(a).history || []), { actionId: def.id, actionDefinitionId: def.id, actionInstanceId: provenance?.actionInstanceId || null, targetIds: targets.map(t => t.id), round: scene.round, turnSerial: scene.turnSerial, ownerTurnActorId: activeTurnOwner?.id || null, ownerTurnSerial: activeOwnerSerial, ownerTurnInstanceId: s.activeTurnInstanceId || null, ownerTurnKey: activeTurnOwner ? ownerTurnKey(s.sceneSerial, activeTurnOwner, activeOwnerSerial) : null, swift: Boolean(status.swift), ...(p.techniqueRuleId ? { techniqueRuleId: p.techniqueRuleId } : {}), ...(p.studentPowerUnleashed ? { studentPowerUnleashed: true, studentFocusCap: focusCap } : {}), ...(assassinStride ? { ruleId: "vagabond.assassin.3" } : {}) }].filter((item,index,list)=>item.ruleId||item.techniqueRuleId||index>=list.length-200);
      p.actionInstanceId ||= provenance?.actionInstanceId || rootId;
      p.ownerTurnInstanceId ||= s.activeTurnInstanceId || null;
      emit("action.resolve", a.id, { actionId: def.id, name: def.name, targetIds: targets.map(t => t.id), actionInstanceId: p.actionInstanceId, ownerTurnInstanceId: p.ownerTurnInstanceId, attribute: finishContext.attribute, techniqueRuleId: p.techniqueRuleId || null, techniqueId: p.techniqueId || null, techniqueIds: Array.isArray(p.techniqueIds) ? p.techniqueIds : null, studentPowerRuleId: p.studentPowerUnleashed ? "ruiner.student-of-stars.1" : null, studentFocusCap: p.studentPowerUnleashed ? focusCap : null, finisherMode: p.finisherMode || null });
      if (def.id === ids.study && global.DAWN_LIONWING_INFORMATION_QUERY?.recordStudy) {
        const studyResult = global.DAWN_LIONWING_INFORMATION_QUERY.recordStudy(scene, { actorId: a.id, targetId: targets[0].id, actionInstanceId: p.actionInstanceId, actionEventId: scene.log[0]?.id, rootActionId: provenance?.rootActionId || rootId, categories: status.actionQuote?.informationCategories || null });
        if (!studyResult.ok) fail(studyResult.errors?.join(" ") || "Изучение не подтверждено квитанцией");
        emit("information.study", a.id, { studyId: studyResult.study?.id, targetId: targets[0].id, categories: global.DAWN_LIONWING_INFORMATION_QUERY.availableCategories(scene, studyResult.study).map(item => item.id), actionInstanceId: p.actionInstanceId });
      }
      let result;
      if ([ids.spell, ids.skirmish, ids.finish, ids.charge].includes(def.id)) {
        result = publishRoll(a, p.roll, def.name);
        const pools=attackPools(scene,a,def,p);if(result.initialCount!==pools.base)fail("Пул броска не соответствует действию");
      p.targetDamage={};for(const[id,count]of Object.entries(pools.counts)){let extra=0;if(count>pools.base){const extraRoll=publishRoll(a,p.targetRolls?.[id],`Дополнительные кости: ${actor(scene,id).name}`);if(extraRoll.initialCount!==count-pools.base)fail("Неверный дополнительный пул");extra=extraRoll.successes;}p.targetDamage[id]=result.successes+extra+(def.id===ids.finish?tensionValue(scene):0);}
        for(const id of p.spikeTargetIds||[])if(targets.some(t=>t.id===id)&&effectActive(scene,actor(scene,id),"negative.подброшен"))removeEffect(actor(scene,id),"negative.подброшен");
      }
      if ([ids.spell, ids.skirmish, ids.finish].includes(def.id)) {
        const initialDistances = Object.fromEntries(targets.map(target => [target.id, distance(a, target)]));
        const breacherLevel = Number((a.knownTechniques ?? a.techniques)?.["powerhouse.breacher"] || 0);
        const breacherPush = def.id === ids.skirmish && breacherLevel >= 1 && a.lionwing?.automation?.["powerhouse.breacher.1"] === true;
        beginAttack(a, { ...p, name: def.name, amount: result.successes + (def.id === ids.finish ? tensionValue(scene) : 0), breacherPush, breacherPushMultiplier: p.breacherBothBarrels === true ? 2 : 1, breacherAttackSuccess: result.successes > 0, breacherInitialDistances: initialDistances, breacherWeaken: p.breacherBothBarrels === true, criticals: result.crits, actionInstanceId: p.actionInstanceId, sourceActionId: def.id });
      }
      else if (def.id === ids.charge || def.id === ids.breathe) {
        if (p.icicleReplacement) {
          mutateCounter({ id: "ruiner.cryomancer.icicle", operation: "reset" }, a.id, "clock");
          const replacement = p.icicleReplacement;
          applyDamage({ targetId: replacement.targetId, sourceActorId: a.id, amount: replacement.segments * Math.ceil(Number(a.attrs?.spirit || 0) / 2), sourceActionId: "ruiner.cryomancer.2.icicle", attack: false });
          if (replacement.immobilize && !actor(scene, replacement.targetId).knockedOut) applyEffect(actor(scene, replacement.targetId), { effect: "negative.обездвижен", sourceActionId: "ruiner.cryomancer.2.icicle", ruleId: "ruiner.cryomancer.2" }, a.id);
        } else {
          const amount = def.id === ids.charge ? Math.max(2, result.successes) : 1;
          gain(a,"focus",amount,{actionId:def.id,actionInstanceId:p.actionInstanceId});
        }
      }
      else if (def.id === ids.step) { if (assassinStride) { removeEffect(a, "positive.исчез", { reappear: false }); applyEffect(a, { effect: "positive.невидим", duration: "scene", sourceActionId: "vagabond.assassin.3" }, a.id); } if (!status.continuation) a.stepRemaining = sceneSpeed(scene,a); if (p.destination) {const moved=move(a, { destination: p.destination, maximum: a.stepRemaining, sourceActionId: def.id, actionInstanceId: p.actionInstanceId, ownerTurnInstanceId: p.ownerTurnInstanceId, turnSerial: scene.turnSerial });if(Number(astate(a).difficultTerrainStopSerial)!==Number(scene.turnSerial))a.stepRemaining-=moved.cost;} }
      else if (def.id === ids.jump) move(a, { destination: p.destination, maximum: scaledMove(a, Number(a.attrs.talent || 0),scene), line: true, ignoreOpponents: true, ignoreDifficultTerrain:true, sourceActionId: def.id, actionInstanceId: p.actionInstanceId, ownerTurnInstanceId: p.ownerTurnInstanceId, turnSerial: scene.turnSerial });
      else if (def.id === ids.shove) move(targets[0], { destination: p.destination, maximum: 1, forced: true });
      else if (def.id === ids.disappear) applyEffect(a, { effect: "positive.исчез", duration: "actionOrStartTurn" }, a.id);
      else if (def.id === ids.study) { applyEffect(targets[0], { effect: "negative.помечен" }, a.id); const study = global.DAWN_LIONWING_INFORMATION_QUERY?.studyStatus?.(scene, "information:study:" + p.actionInstanceId); emit("rule.prompt", a.id, { targetId: targets[0].id, title: "Нарратор раскрывает выбранный параметр NPC", informationStudyId: study?.id || null, informationCategories: global.DAWN_LIONWING_INFORMATION_QUERY?.availableCategories?.(scene, study).map(item => ({ id: item.id, label: item.label })) || [] }); }
      else if (def.id === ids.improvise && !p.removeObstacleId) {
        if (p.effect) { if (targets.length !== 1 || distance(a, targets[0]) > 1 || p.effect === "positive.изгнан") fail("Импровизация: соседняя цель и Эффект кроме Изгнания"); applyEffect(targets[0], { effect: p.effect }, a.id); }
        else { const d = p.destination; if (!d || distance(a, { ...d, space: a.space }) !== 1) fail("Выберите соседнюю клетку препятствия"); movement(scene, a, d, { placement: true }); scene.objects.push({ id: `${rootId}:obstacle`, type: "terrain", label: "Препятствие", space: a.space, cells: [`${d.x},${d.y}`], hp: 10, maxHp: 10, duration: "scene", ownerActorId: a.id }); }
      } else if (def.id === "action.атаки.дуэль") {
        const opponent=targets[0];
        if(opponent.team===a.team)fail("Дуэль требует противника");
        if(astate(a).duelId||astate(opponent).duelId)fail("Участник уже находится в Дуэли");
        const duelId=`${rootId}:duel`,spaceId=`duel-${rootId}`,participants=[a,opponent];
        s.duels||=[];const duel={id:duelId,spaceId,actorId:a.id,targetId:opponent.id,returnSpaceId:a.space,startedSerial:scene.turnSerial,tension:tensionValue(scene),influenceSpent:status.cost};s.duels.push(duel);
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
      const actorlessInformation = new Set(["information-reveal", "information-cancel", "information-handout"]);
      const a = sourceId && !actorlessInformation.has(p.kind) ? requiredActor(scene, sourceId, false) : null;
      switch (p.kind) {
        case "detective-finisher-open": detectiveFinisherOpen(p, sourceId); break;
        case "detective-finisher": detectiveFreeFinisher(p, sourceId); break;
        case "banish": banishOperation(p, sourceId); break;
        case "vanish": vanishOperation(p, sourceId); break;
        case "compound": compoundOperation(p, sourceId); break;
        case "plan": {
          if (!Array.isArray(p.operations) || !p.operations.length || p.operations.length > 192 || p.operations.some(operation => !operation || !api.operations.includes(operation.kind) || ["plan","batch","execution-frame"].includes(operation.kind))) fail("Некорректный план действия");
          if (!p.reservation || p.reservation.sceneVersion !== Number(scene.version || 0) || p.reservation.actorId !== sourceId) fail("Резерв цены устарел: подготовьте действие заново");
          const quoted = costQuote(scene, sourceId, p.costs, p.targetIds || []);
          if (JSON.stringify(quoted) !== JSON.stringify(p.reservation)) fail("Составная цена или цели изменены после подтверждения");
          let actionPlan = null, execution = null;
          if (p.actionPlan != null || p.execution != null) {
            const actionPlanApi = global.DAWN_LIONWING_ACTION_PLAN;
            if (typeof actionPlanApi?.commitExecution !== "function" || typeof actionPlanApi?.prepareExecution !== "function") fail("ActionPlan LionWing недоступен");
            if (!p.actionPlan || !p.execution) fail("План действия требует ActionPlan и execution descriptor");
            const preparedDescriptor = actionPlanApi.prepareExecution(p.actionPlan, { scene, expectedRevision: p.actionPlan.revision });
            if (!sameJson(preparedDescriptor.execution, p.execution)) fail("Execution descriptor ActionPlan изменён после подготовки");
            const committedDescriptor = actionPlanApi.commitExecution(p.actionPlan, { scene, expectedRevision: p.actionPlan.revision, eventId: rootId });
            actionPlan = committedDescriptor.plan;
            execution = committedDescriptor.execution;
            if (!sameJson(execution.costs, p.costs?.length ? foundations.normalizeCosts(p.costs) : []) || !sameJson(execution.targetIds, p.targetIds || [])) fail("Цена или цели не совпадают с ActionPlan");
            if (!sameJson(execution.operations, p.operations)) fail("Операции не совпадают с execution descriptor ActionPlan");
          }
          payReservation(a, quoted);
          queue.unshift(...p.operations.map(operation => ({ p: { ...operation, ...(actionPlan ? { __actionPlan: actionPlan, __execution: execution } : {}) }, sourceId: operation.sourceActorId ?? sourceId, provenance: { ...provenance, actionId: p.actionId || provenance?.actionId } })));
          emit("cost.commit", sourceId, { costs: quoted.costs, targetIds: quoted.targetIds });
          break;
        }
        case "action": performAction(requiredActor(scene, sourceId), p); break;
        case "information-study": {
          const information = global.DAWN_LIONWING_INFORMATION_QUERY;
          if (!information?.recordStudy) fail("Контракт Изучения LionWing недоступен");
          const studyResult = information.recordStudy(scene, { ...p, actorId: p.actorId || sourceId });
          if (!studyResult.ok) fail(studyResult.errors?.join(" ") || "Изучение не подтверждено квитанцией");
          emit("information.study", sourceId, { studyId: studyResult.study?.id, targetId: studyResult.study?.targetId, actionInstanceId: studyResult.study?.actionInstanceId });
          break;
        }
        case "information-reveal": {
          const information = global.DAWN_LIONWING_INFORMATION_QUERY;
          const reveal = information?.confirmReveal?.(scene, p, { role: executionOptions.role || "narrator", actorId: sourceId });
          if (!reveal?.ok) fail(reveal?.errors?.join(" ") || "Раскрытие информации отклонено");
          emit("information.reveal", sourceId || "narrator", { studyId: p.studyId, factId: reveal.fact?.id || null, targetId: reveal.fact?.targetId || p.targetId || null, category: reveal.fact?.category || p.category, visibility: reveal.fact?.visibility || p.visibility || "public" });
          break;
        }
        case "information-cancel": {
          const information = global.DAWN_LIONWING_INFORMATION_QUERY;
          const cancelled = information?.cancelReveal?.(scene, p, { role: executionOptions.role || "narrator", actorId: sourceId });
          if (!cancelled?.ok) fail(cancelled?.errors?.join(" ") || "Отмена Изучения отклонена");
          emit("information.cancel", sourceId || "narrator", { studyId: p.studyId, targetId: information.studyStatus?.(scene, p.studyId)?.targetId || null });
          break;
        }
        case "information-handout": {
          const information = global.DAWN_LIONWING_INFORMATION_QUERY;
          const handed = information?.handout?.(scene, p, { role: executionOptions.role || "narrator" });
          if (!handed?.ok) fail(handed?.errors?.join(" ") || "Ручная выдача отклонена");
          emit("information.handout", sourceId || "narrator", { factId: handed.fact?.id || null, targetId: p.targetId || null, visibility: handed.fact?.visibility || p.visibility || "public" });
          break;
        }
        case "attack": if (p.cost) spend(requiredActor(scene, sourceId), p.cost.resource || "ap", integer(p.cost.amount, "стоимость")); beginAttack(requiredActor(scene, sourceId), p); break;
        case "marker-remove": {
          const marker = (scene.markers || []).find(item => item.id === p.markerId), hostId = marker && (marker.hostActorId || marker.metadata?.hostActorId || marker.metadata?.carrierActorId);
          if (!marker || marker.ruleId !== p.ruleId || marker.ownerActorId !== sourceId || hostId !== p.targetId) fail("Слабая точка уже отсутствует или принадлежит другой цели");
          scene.markers = (scene.markers || []).filter(item => item.id !== marker.id);
          emit("marker.remove", sourceId, { markerId: marker.id, ruleId: marker.ruleId, ownerActorId: marker.ownerActorId, carrierActorId: hostId, sourceActionId: p.sourceActionId || "vagabond.dim-mak.1.jab", turnSerial: Number(scene.turnSerial || 0), ownerTurnInstanceId: s.activeTurnInstanceId || null });
          break;
        }
        case "damage": applyDamage({ ...p, sourceActorId: Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId }); break;
        case "breacher-push": {
          const source = requiredActor(scene, p.sourceActorId || sourceId, false), target = requiredActor(scene, p.targetId, false);
          const sourceRule = global.DAWN_LIONWING_ADAPTERS?.list?.(source)?.find(rule => rule.id === p.ruleId && rule.sourceDigest === p.sourceDigest);
          if (source.id === target.id || p.ruleId !== "powerhouse.breacher.1" || !sourceRule || source.lionwing?.automation?.[p.ruleId] !== true || p.sourceActorId !== source.id || Number(p.initialDistance) > 2 || Number(p.initialDistance) < 0) fail("Толчок Картечи связан с некорректной целью");
          if (target.knockedOut || effectActive(scene, target, "positive.исчез")) break;
          const maximum = integer(p.maximum ?? 1, "сила толчка", 8);
          for (let step = 0; step < maximum; step += 1) {
            const dx = Math.sign(Number(target.x) - Number(source.x)), dy = Math.sign(Number(target.y) - Number(source.y));
            const destination = { space: target.space, x: Number(target.x) + (Math.abs(dx) >= Math.abs(dy) ? dx : 0), y: Number(target.y) + (Math.abs(dy) > Math.abs(dx) ? dy : 0) };
            if (destination.x === target.x && destination.y === target.y) break;
            try { move(target, { destination, maximum: 1, forced: true, sourceActorId: source.id, ruleId: p.ruleId, sourceDigest: p.sourceDigest, sourceActionId: p.sourceActionId || "action.атаки.стычка", actionInstanceId: p.actionInstanceId || provenance?.actionInstanceId || rootId }); }
            catch { break; }
          }
          emit("rule.resolve", source.id, { ruleId: p.ruleId, sourceDigest: p.sourceDigest, targetId: target.id, operation: "push", distance: maximum, initialDistance: Number(p.initialDistance) });
          break;
        }
        case "spend-health": applyHealthLoss(requiredActor(scene, p.targetId || sourceId, false), { ...p, mode: "spend" }, sourceId); break;
        case "lose-health": applyHealthLoss(requiredActor(scene, p.targetId || sourceId, false), { ...p, mode: "lose" }, sourceId); break;
        case "record-action": {
          const def=actionDef(p.actionId);if(!def||def.type!=="action")fail("Выберите базовое действие");
          if(scene.activeActorId!==sourceId&&!p.reaction)fail("Сейчас не Ход исполнителя");
          const swift=p.swift===true||p.reaction===true,used=isPlayer(a)?a.usedActions||[]:astate(a).turnActions||[];
          if(!swift&&used.includes(def.id))fail("Действие уже использовано");
          spend(a,p.resource||"ap",integer(p.amount??0,"стоимость"));
          if(!swift){a.usedActions=[...new Set([...(a.usedActions||[]),def.id])];astate(a).turnActions=[...new Set([...(astate(a).turnActions||[]),def.id])];}
          p.actionInstanceId ||= provenance?.actionInstanceId || rootId;
          p.ownerTurnInstanceId ||= s.activeTurnInstanceId || null;
          const activeTurnOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null, activeOwnerSerial = activeTurnOwner ? ownTurnSerial(activeTurnOwner) : null;
          astate(a).history.push({actionId:def.id,actionDefinitionId:def.id,actionInstanceId:p.actionInstanceId,round:scene.round,turnSerial:scene.turnSerial,ownerTurnActorId:activeTurnOwner?.id||null,ownerTurnSerial:activeOwnerSerial,ownerTurnInstanceId:p.ownerTurnInstanceId,ownerTurnKey:activeTurnOwner?ownerTurnKey(s.sceneSerial,activeTurnOwner,activeOwnerSerial):null,swift,manual:true});
          emit("action.resolve",sourceId,{actionId:def.id,name:def.name,manual:true,actionInstanceId:p.actionInstanceId,ownerTurnInstanceId:p.ownerTurnInstanceId});break;
        }
        case "recover-track": {const target=requiredActor(scene,p.targetId||sourceId,false);if(!["wounds","stress"].includes(p.track))fail("Выберите Раны или Стресс");const amount=integer(p.amount,"восстановление",3),before=Number(target[p.track]||0);target[p.track]=Math.max(0,before-amount);emit("actor.track.recover",sourceId,{targetId:target.id,track:p.track,amount:before-target[p.track],value:target[p.track]});break;}
        case "heal": applyHealing(p,sourceId);break;
        case "wound": wound(requiredActor(scene, p.targetId || sourceId), Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId); break;
        case "stress": wound(requiredActor(scene, p.targetId || sourceId), Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId, "stress"); break;
        case "knockout": knockout(requiredActor(scene, p.targetId || sourceId)); break;
        case "resource": {
          const target = requiredActor(scene, p.targetId || sourceId, false), amount = integer(p.amount, "ресурс");
          if (p.operation === "spend") spend(target, p.resource, amount);
          else if(p.operation === "gain")gain(target,p.resource,amount,{actionId:p.actionId});
          else fail("Неизвестная операция ресурса");
          break;
        }
        case "inventory": {
          if (!inventory?.applyOperation) fail("Модуль типизированного инвентаря LionWing недоступен");
          const targetId = p.operation === "transfer" ? (p.fromActorId || sourceId) : (p.targetId || p.ownerActorId || sourceId);
          if (!targetId) fail("Операция инвентаря требует владельца");
          const authorityRole = executionOptions.role || (sourceId === "narrator" || sourceId === "gm" ? sourceId : null);
          if (sourceId && sourceId !== targetId && !["narrator", "gm"].includes(authorityRole)) fail("Операция инвентаря принадлежит другому участнику", "LIONWING_INVENTORY_OWNER");
          const context = { scene, actorId: sourceId || targetId, sourceActorId: sourceId || targetId, role: executionOptions.role || null, eventId: rootId, operationId: p.operationId || `${rootId}:inventory:${emitted.length}:${p.operation || "operation"}:${targetId}`, at: event.at, emit };
          if (p.operation === "reserve") inventory.reserve(scene, targetId, p.costs, context);
          else if (p.operation === "commit") inventory.commitReservation(scene, targetId, p.reservationId, context);
          else if (p.operation === "cancel") inventory.cancelReservation(scene, targetId, p.reservationId, context);
          else if (p.operation === "reset" && !p.id && !p.itemId && !p.definitionId) {
            for (const change of inventory.resetActor(requiredActor(scene, targetId, false), p.boundary || p.resetAt || "manual", { scene })) emit("inventory.reset", targetId, change);
          } else {
            const inventoryPayload = { ...p, targetId };
            if (p.inventoryKind || p.itemKind || p.recordKind) inventoryPayload.kind = p.inventoryKind || p.itemKind || p.recordKind;
            inventory.applyOperation(scene, inventoryPayload, context);
          }
          break;
        }
        case "intermission": {
          for (const target of scene.actors || []) {
            if (inventory?.resetActor) for (const change of inventory.resetActor(target, "intermission", { scene })) emit("inventory.reset", target.id, change);
          }
          emit("intermission", sourceId, {});
          break;
        }
        case "correct": {
          const target = requiredActor(scene, p.targetId || sourceId, false);
          if (!resources.has(p.resource) && !attributes.has(p.resource) && !["knockedOut","vulnerable"].includes(p.resource)) fail("Это поле нельзя исправить");
          const amount = integer(p.amount, "новое значение",p.resource==="knockedOut"?1:["wounds","stress"].includes(p.resource)?2:attributes.has(p.resource)||["baseAp","armor","speed","tier"].includes(p.resource)?99:9999), before = attributes.has(p.resource) ? target.attrs[p.resource] : target[p.resource];
          if(["maxHp","tier"].includes(p.resource)&&amount===0)fail("Значение должно быть положительным");
          const compound=legacy.compoundEnemyStatus(scene,target);
          if(p.resource==="hp"&&amount>(compound.active?compound.maxHp:maxHealth(target)))fail("Здоровье превышает максимум");
          if (attributes.has(p.resource)) target.attrs[p.resource] = amount;
          else if(p.resource==="vulnerable"){if(amount>1)fail("Уязвимость: 0 или 1");astate(target).vulnerable=Boolean(amount);}
          else if (p.resource === "knockedOut") { for(const part of compound.active?compound.parts:[target]){part.knockedOut=Boolean(amount);if(part.knockedOut){part.ap=0;part.stepRemaining=0;if(scene.activeActorId===part.id){scene.activeActorId=null;s.lastTeam=part.team;}s.grantedTurns=(s.grantedTurns||[]).filter(item=>item.actorId!==part.id);for(const aura of [...s.auras])if(aura.sourceLossPolicy==="remove"&&(aura.sourceEntityId===part.id||aura.ownerActorId===part.id))removeAuraRecord(aura,"removed",part.id);}} }
          else if(p.resource==="hp"&&compound.active){let remaining=amount;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}}
          else {target[p.resource] = amount;if(p.resource==="maxHp")target.hp=Math.min(target.hp,maxHealth(target));}
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
          const target=requiredActor(scene,p.targetId||sourceId,false), parts=target.compoundId?scene.actors.filter(item=>item.compoundId===target.compoundId):[target], sourceEntries=parts.map(part=>({part,saved:part.effectStates?.[p.effect],source:(part.effectStates?.[p.effect]?.sources||[]).find(item=>(item.sourceId||item.actorId)===p.sourceId)})).filter(item=>item.source);
          if(!sourceEntries.length)fail("Источник Эффекта не найден");
          if(p.operation==="remove")removeEffect(target,p.effect,{sourceId:p.sourceId,manual:true});
          else if(p.operation==="expire")removeEffect(target,p.effect,{sourceId:p.sourceId,manual:false,reappear:true});
          else if(p.operation==="suppress"||p.operation==="restore"){
            if(!p.suppressionId)fail("Укажите источник подавления");
            for(const {part,source} of sourceEntries){
              source.suppressedBy=p.operation==="suppress"?[...new Set([...(source.suppressedBy||[]),p.suppressionId])]:[...(source.suppressedBy||[])].filter(id=>id!==p.suppressionId);
              const active=(part.effectStates?.[p.effect]?.sources||[]).some(item=>!(item.suppressedBy||[]).length);
              if(active)part.effects=[...new Set([...(part.effects||[]),p.effect])]; else part.effects=(part.effects||[]).filter(item=>item!==p.effect);
            }
            emit(p.operation==="suppress"?"effect.suppress":"effect.restore",sourceId,{targetId:target.id,effect:p.effect,sourceId:p.sourceId,suppressionId:p.suppressionId,compoundId:target.compoundId||null});
          } else fail("Неизвестная операция источника Эффекта");
          break;
        }
        case "placement":
        case "teleport":
        case "displacement": {
          const runtime=global.DAWN_LIONWING_GEOMETRY_RUNTIME,geometry=global.DAWN_LIONWING_GEOMETRY;
          if(!runtime?.commit||!p.geometryRuntime)fail("Пространственная операция не подготовлена");
          const checked=runtime.commit(scene,p.geometryRuntime);
          if(checked.plan.operation!==p.kind||checked.plan.sourceActorId!==sourceId||checked.plan.targetId!==(p.targetId||checked.plan.targetId))fail("Пространственный план принадлежит другой операции");
          const target=requiredActor(scene,checked.plan.targetId,false);
          if(p.kind!=="displacement"){
            if (p.kind === "teleport" && p.ruleId === detectiveRuleId && p.teleportEnter === true) {
              const stepDef = actionDef(ids.step), stepStatus = actionStatus(scene, target, stepDef, {}), fromPoint = checked.result.from, toPoint = checked.result.stoppedAt;
              if (!stepStatus.available) fail(stepStatus.reason || "Движение уже недоступно");
              const travelled = Math.abs(Number(toPoint.x) - Number(fromPoint.x)) + Math.abs(Number(toPoint.y) - Number(fromPoint.y));
              const available = Number(stepStatus.continuation ? target.stepRemaining : sceneSpeed(scene, target));
              if (travelled < 1 || travelled > available) fail("Телепортация должна заменить допустимое Движение в его пределах");
              if (!stepStatus.continuation) {
                if (stepStatus.cost) spend(target, stepStatus.resource, stepStatus.cost);
                target.usedActions = [...new Set([...(target.usedActions || []), ids.step])];
                astate(target).turnActions = [...new Set([...(astate(target).turnActions || []), ids.step])];
                target.stepRemaining = available;
                const activeOwner = scene.activeActorId ? actor(scene, scene.activeActorId) : null;
                astate(target).history.push({ actionId: ids.step, actionDefinitionId: ids.step, actionInstanceId: provenance?.actionInstanceId || rootId, targetIds: [target.id], round: scene.round, turnSerial: scene.turnSerial, ownerTurnActorId: activeOwner?.id || target.id, ownerTurnSerial: activeOwner ? ownTurnSerial(activeOwner) : ownTurnSerial(target), ownerTurnInstanceId: s.activeTurnInstanceId || null, ownerTurnKey: activeOwner ? ownerTurnKey(s.sceneSerial, activeOwner, ownTurnSerial(activeOwner)) : null, swift: Boolean(stepStatus.swift), teleportReplacement: true, ruleId: detectiveRuleId });
                emit("action.resolve", target.id, { actionId: ids.step, name: stepDef.name, targetIds: [target.id], actionInstanceId: provenance?.actionInstanceId || rootId, ownerTurnInstanceId: s.activeTurnInstanceId || null, teleportReplacement: true, techniqueRuleId: detectiveRuleId });
              }
              target.stepRemaining = Math.max(0, available - travelled);
            }
            const auraBefore=auraSnapshot();
            for(const saved of checked.after.actors||[]){const current=requiredActor(scene,saved.id,false);current.space=saved.space;current.x=Number(saved.x);current.y=Number(saved.y);}
            emit(`geometry.${p.kind}.commit`,sourceId,{...checked.event.payload.summary,operation:p.kind,targetId:target.id});
            if (p.kind === "teleport" && p.teleportEnter === true) emit("actor.enter", target.id, { x: target.x, y: target.y, space: target.space, segmentId: `${rootId}:teleport-endpoint`, movement: p.label || "Телепортация", teleport: true });
            emitAuraChanges(auraChanges(auraBefore),{spatialOperation:p.kind,movementTargetId:target.id,from:checked.result.from,to:checked.result.stoppedAt});
            break;
          }
          if(!geometry?.geometryCursor||!Array.isArray(checked.result.segments)||!checked.result.segments.length)fail("Принудительное перемещение не содержит проверяемых сегментов");
          const route={schema:1,sourceActorId:sourceId,actorId:target.id,anchor:{kind:"cell",...checked.result.from},destination:checked.result.requestedDestination||checked.result.stoppedAt,origin:checked.result.from,mode:"forced",maximum:Number(checked.result.spent||0)+Number(checked.result.remaining||0),width:checked.result.width,height:checked.result.height,path:copy(checked.result.path||[]),spent:Number(checked.result.spent||0),stoppedAt:copy(checked.result.stoppedAt),remaining:Number(checked.result.remaining||0),terminal:Boolean(checked.result.terminal),stopReason:checked.result.stopReason||null,partial:Boolean(checked.result.terminal),sceneVersion:Number(scene.version||0),geometryStamp:geometry.geometryStamp(scene),segments:copy(checked.result.segments)};
          const plan={schema:1,kind:"lionwing.geometry.route",request:{sourceActorId:sourceId,actorId:target.id,anchor:{kind:"cell",...checked.result.from},destination:checked.result.stoppedAt,maximum:route.maximum,mode:"forced",straight:true,allowPartial:false,ignoreTerrain:p.ignoreTerrain===true,ignoreEnemies:p.ignoreActors===true,width:route.width,height:route.height},route};
          const cursor=geometry.geometryCursor(route,0,scene,{id:`${rootId}:spatial`,expectedSceneVersion:Number(scene.version||0),expectedGeometryStamp:route.geometryStamp,spent:0});
          s.geometryCursor=cursor;
          queue.unshift({p:{kind:"geometry-segment",targetId:target.id,geometryPlan:plan,geometryCursor:cursor,label:p.label||`Принудительное перемещение`,sourceActorId:sourceId,segmentChoices:p.segmentChoices??p.enterChoices,spatialCommit:{operation:p.kind,summary:copy(checked.event.payload.summary)}},sourceId,provenance:copy(provenance)});
          break;
        }
        case "move": move(requiredActor(scene, p.targetId || sourceId), p); break;
        case "forced-towards-group": {
          const source = requiredActor(scene, p.sourceActorId || sourceId, false), target = requiredActor(scene, p.targetId, false), geometry = global.DAWN_LIONWING_GEOMETRY;
          if (!p.ruleId || typeof p.ruleId !== "string" || !p.actionInstanceId || typeof p.actionInstanceId !== "string" || !plain(p.filter) || p.filter.effect !== "negative.испуган" || p.filter.team !== "opposing") fail("Некорректное групповое принудительное перемещение");
          if (p.sourceActorId && p.sourceActorId !== sourceId) fail("Источник группового перемещения не совпадает с исполнителем");
          const sourceRule = global.DAWN_LIONWING_ADAPTERS?.list?.(source)?.find(rule => rule.id === p.ruleId && rule.sourceDigest === p.sourceDigest);
          if (!sourceRule || source.lionwing?.automation?.[p.ruleId] !== true) fail("Групповое перемещение не разрешено включённой Техникой");
          const actionEvent = (scene.log || []).find(row => row.type === "action.resolve" && row.actorId === source.id && row.payload?.actionId === ids.finish && row.payload?.actionInstanceId === p.actionInstanceId && Array.isArray(row.payload?.targetIds) && row.payload.targetIds.length === 1 && row.payload.targetIds[0] === target.id && ["mind", "spirit"].includes(String(row.payload?.attribute || "spirit").toLowerCase()));
          if (!actionEvent) fail("Групповое перемещение не связано с разрешённым Завершением");
          const groupId = `${p.actionInstanceId}:siren3:${source.id}`;
          const frightened = scene.actors.filter(item => item.id !== source.id && item.id !== target.id && item.team !== source.team && live(item) && has(item, p.filter.effect)).map(item => item.id);
          s.movementGroups = (s.movementGroups || []).filter(group => group.id !== groupId);
          s.movementGroups.push({ schema: 1, id: groupId, sourceActorId: source.id, targetId: target.id, actionInstanceId: p.actionInstanceId, ruleId: p.ruleId, sourceDigest: p.sourceDigest, actorIds: frightened, index: 0, damage: Number(source.tier || 1) });
          const groupProvenance = { ...provenance, actionId: ids.finish, actionDefinitionId: ids.finish, actionInstanceId: p.actionInstanceId, causeEventId: actionEvent.id, ownerActorId: source.id, ruleId: p.ruleId };
          queue.unshift({ p: { kind: "forced-towards-group-step", groupId }, sourceId: source.id, provenance: groupProvenance });
          break;
        }
        case "forced-towards-group-step": {
          const group = (s.movementGroups || []).find(item => item.id === p.groupId), geometry = global.DAWN_LIONWING_GEOMETRY;
          if (!group) break;
          const source = actor(scene, group.sourceActorId), target = actor(scene, group.targetId);
          if (!live(source) || !live(target)) { s.movementGroups = s.movementGroups.filter(item => item.id !== group.id); break; }
          while (group.index < group.actorIds.length) {
            const mover = actor(scene, group.actorIds[group.index]);
            if (live(mover) && has(mover, "negative.испуган")) break;
            group.index += 1;
          }
          if (group.index >= group.actorIds.length) { s.movementGroups = s.movementGroups.filter(item => item.id !== group.id); break; }
          const mover = actor(scene, group.actorIds[group.index]);
          if (!geometry?.routePlan) fail("Планировщик геометрии недоступен");
          const targetCells = footprintCells(target), destinations = [];
          for (const cell of targetCells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) destinations.push({ space: target.space, x: Number(cell.x) + dx, y: Number(cell.y) + dy });
          const uniqueDestinations = [...new Map(destinations.map(point => [`${point.space}:${point.x},${point.y}`, point])).values()];
          const plans = uniqueDestinations.map(destination => geometry.routePlan(scene, { sourceActorId: source.id, actorId: mover.id, anchor: { kind: "actor", actorId: mover.id }, destination, maximum: Math.max(0, Number(mover.speed || 0)), mode: "forced", allowPartial: true, width: mover.occupiedWidth, height: mover.occupiedHeight })).filter(result => result?.available);
          const endpointDistance = result => footprintDistance({ ...mover, space: result.route.stoppedAt.space, x: result.route.stoppedAt.x, y: result.route.stoppedAt.y }, target);
          plans.sort((left, right) => endpointDistance(left) - endpointDistance(right) || Number(left.route.spent || 0) - Number(right.route.spent || 0));
          const selected = plans[0] || null;
          const groupProvenance = { ...provenance, actionId: ids.finish, actionDefinitionId: ids.finish, actionInstanceId: group.actionInstanceId, causeEventId: group.actionInstanceId, ownerActorId: source.id, ruleId: group.ruleId };
          if (!selected || !Array.isArray(selected.route?.segments) || !selected.route.segments.length) {
            queue.unshift({ p: { kind: "forced-towards-group-after-route", groupId: group.id, moverId: mover.id }, sourceId: source.id, provenance: groupProvenance });
            break;
          }
          const route = selected.route, cursor = geometry.geometryCursor(route, 0, scene, { id: `${group.id}:${mover.id}`, expectedSceneVersion: Number(scene.version || 0), expectedGeometryStamp: geometry.geometryStamp(scene), spent: 0 });
          s.geometryCursor = cursor;
          queue.unshift({ p: { kind: "geometry-segment", targetId: mover.id, geometryPlan: selected.plan, geometryCursor: cursor, sourceActorId: source.id, label: "Сирена III: движение Испуганного", groupId: group.id, groupMoverId: mover.id }, sourceId: source.id, provenance: groupProvenance });
          break;
        }
        case "forced-towards-group-after-route": {
          const group = (s.movementGroups || []).find(item => item.id === p.groupId), source = group && actor(scene, group.sourceActorId), target = group && actor(scene, group.targetId), mover = group && actor(scene, p.moverId);
          if (!group) break;
          group.index += 1;
          if (source && target && mover && live(source) && live(target) && live(mover) && has(mover, "negative.испуган") && footprintDistance(mover, target) === 1) queue.unshift({ p: { kind: "damage", targetId: target.id, sourceActorId: mover.id, amount: group.damage, attack: true, sourceActionId: group.ruleId, sourceDigest: group.sourceDigest, sirenGroupId: group.id, actionInstanceId: group.actionInstanceId }, sourceId: mover.id, provenance: { ...provenance, actionId: ids.finish, actionDefinitionId: ids.finish, actionInstanceId: group.actionInstanceId, causeEventId: group.actionInstanceId, ownerActorId: source.id, ruleId: group.ruleId, sourceDigest: group.sourceDigest } });
          queue.unshift({ p: { kind: "forced-towards-group-step", groupId: group.id }, sourceId: source?.id || sourceId, provenance: { ...provenance, actionId: ids.finish, actionDefinitionId: ids.finish, actionInstanceId: group.actionInstanceId, causeEventId: group.actionInstanceId, ownerActorId: source?.id || sourceId, ruleId: group.ruleId } });
          break;
        }
        case "forced-towards": {
          const target = requiredActor(scene, p.targetId, false), toward = requiredActor(scene, p.sourceActorId || sourceId, false), maximum = integer(p.maximum ?? 3, "принудительное перемещение");
          let destination = { space: target.space, x: Number(target.x), y: Number(target.y) };
          for (let step = 0; step < maximum && distance(destination, toward) > 1; step++) {
            const dx = Math.sign(Number(toward.x) - Number(destination.x)), dy = Math.sign(Number(toward.y) - Number(destination.y));
            if (Math.abs(Number(toward.x) - Number(destination.x)) >= Math.abs(Number(toward.y) - Number(destination.y))) destination.x += dx || 0;
            else destination.y += dy || 0;
          }
          if (distance(target, toward) > 1) move(target, { destination, maximum, forced: true, followSnare: true });
          if (distance(target, toward) === 1) choice(requiredActor(scene, p.sourceActorId || sourceId, false), "technique-trigger", "Сирена II: выбрать последствие сближения", ["skip", "daze"], { ruleId: "disruptor.siren.2", optionLabels: { skip: "Не использовать", daze: "Ошеломить и получить 1 Фокус" }, choices: { daze: [{ kind: "effect", targetId: target.id, sourceActorId: p.sourceActorId || sourceId, effect: "negative.ошеломлен" }, { kind: "resource", targetId: p.sourceActorId || sourceId, resource: "focus", operation: "gain", amount: 1 }] }, targetId: target.id, causeEventId: rootId });
          break;
        }
        case "forced-away": {
          const source = requiredActor(scene, p.sourceActorId || sourceId, false), target = requiredActor(scene, p.targetId, false), maximum = integer(p.maximum ?? 3, "принудительное перемещение");
          if (source.id === target.id || source.space !== target.space) fail("Отталкивание требует отдельную цель в том же пространстве");
          let destination = { space: target.space, x: Number(target.x), y: Number(target.y) };
          for (let step = 0; step < maximum; step++) {
            const dx = Math.sign(Number(destination.x) - Number(source.x)), dy = Math.sign(Number(destination.y) - Number(source.y));
            if (!dx && !dy) break;
            if (Math.abs(Number(destination.x) - Number(source.x)) >= Math.abs(Number(destination.y) - Number(source.y))) destination.x += dx || 0;
            else destination.y += dy || 0;
          }
          move(target, { destination, maximum, forced: true, sourceActionId: p.ruleId || "forced-away" });
          break;
        }
        case "martial-quick-step": {
          const owner = requiredActor(scene, p.targetId || sourceId, false), maximum = integer(p.maximum ?? 3, "Быстрый шаг"), evasion = integer(p.evasion ?? owner.tier ?? 1, "Уклонение");
          if (!global.DAWN_LIONWING_ADAPTERS?.list?.(owner)?.some(rule => rule.id === "powerhouse.martial-artist.1" && owner.lionwing?.automation?.[rule.id] === true)) fail("Быстрый шаг Восьми молотов недоступен");
          if (!p.destination) { choice(owner, "placement", "Выберите клетку для Быстрого шага", ["place"], { martialQuickStep: true, targetId: owner.id, maximum, evasion, ruleId: p.ruleId, sourceDigest: p.sourceDigest, causeEventId: rootId }); break; }
          if (p.destination.space && p.destination.space !== owner.space) fail("Быстрый шаг не меняет пространство");
          move(owner, { destination: { ...p.destination, space: owner.space }, maximum, sourceActionId: p.ruleId || "powerhouse.martial-artist.1", movement: "Быстрый шаг" });
          queue.unshift({ p: { kind: "modifier", targetId: owner.id, stat: "evasion", amount: evasion, duration: "endTurn", ruleId: p.ruleId, sourceDigest: p.sourceDigest }, sourceId: owner.id, provenance: { ...provenance, ownerActorId: owner.id, ruleId: p.ruleId, sourceDigest: p.sourceDigest } });
          break;
        }
        case "skirmisher-shift": {
          const owner = requiredActor(scene, p.targetId || sourceId, false), maximum = integer(p.maximum ?? 2, "Смещающиеся удары");
          if (Number((owner.knownTechniques ?? owner.techniques)?.["vagabond.skirmisher"] || 0) < 2 || owner.lionwing?.automation?.["vagabond.skirmisher.2"] !== true) fail("Смещение Застрельщика недоступно");
          if (!p.destination) { choice(owner, "placement", "Выберите клетку для Смещающихся ударов", ["place"], { skirmisherShift: true, targetId: owner.id, maximum, ruleId: "vagabond.skirmisher.2", sourceDigest: p.sourceDigest, causeEventId: rootId }); break; }
          if (p.destination.space && p.destination.space !== owner.space) fail("Смещение не меняет пространство");
          if (Math.abs(Number(p.destination.x) - Number(owner.x)) !== 0 && Math.abs(Number(p.destination.y) - Number(owner.y)) !== 0) fail("Смещение должно идти по прямой");
          move(owner, { destination: { ...p.destination, space: owner.space }, maximum, straight: true, ignoreOpponents: true, sourceActionId: "vagabond.skirmisher.2", movement: "Смещающиеся удары" });
          break;
        }
        case "jab": {
          const owner = requiredActor(scene, p.sourceActorId || sourceId, false), target = requiredActor(scene, p.targetId, false), ruleId = p.ruleId === "vagabond.skirmisher.3" ? "vagabond.skirmisher.3" : "vagabond.skirmisher.1", sourceDigest = ruleId === "vagabond.skirmisher.3" ? "4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61" : "a14b57ddcf585e19b76a19e20b3ab1dc5190a59a5b044ed5df6d0bc2141a503e";
          if (owner.team === target.team || owner.space !== target.space || distance(owner, target) !== 1) fail("Тычок требует вражескую смежную цель");
          if (Number((owner.knownTechniques ?? owner.techniques)?.["vagabond.skirmisher"] || 0) < 1 || owner.lionwing?.automation?.[ruleId] !== true) fail("Тычок Застрельщика недоступен");
          const amount = Math.ceil(Number(owner.attrs?.talent || 0) / 2);
          applyDamage({ targetId: target.id, sourceActorId: owner.id, amount, attack: true, fixedDamage: true, finalDamage: true, ignoreEvasion: false, sourceActionId: `${ruleId}.jab`, techniqueRuleId: ruleId, actionInstanceId: provenance?.actionInstanceId || rootId });
          emit("technique.resolve", owner.id, { ruleId, name: "Jab", fixedDamage: amount, fixedTargetId: target.id, affectedActorIds: [target.id], participantIds: [owner.id, target.id] });
          break;
        }
        case "chemist-health-check": {
          const target = requiredActor(scene, p.targetId, false), source = requiredActor(scene, p.sourceActorId || sourceId, false), health = Number(target.hp || 0), threshold = Number(source.attrs?.mind || 0);
          emit("rule.health-check", source.id, { targetId: target.id, health, threshold, ruleId: p.ruleId, private: true });
          if (!target.knockedOut && health <= threshold) { knockout(target, { kind: "chemist-weaken-threshold", sourceActorId: source.id }); gain(source, "focus", 2, { actionId: p.ruleId }); }
          break;
        }
        case "geometry-move":{
          const geometry=global.DAWN_LIONWING_GEOMETRY;if(!geometry?.revalidatePlan)fail("Планировщик геометрии недоступен");
          const checked=geometry.revalidatePlan(scene,p.geometryPlan);if(!checked.available)fail(checked.reason);
          if(checked.route.sourceActorId!==sourceId||checked.route.actorId!==(p.targetId||sourceId))fail("Геометрический план принадлежит другой операции");
          const target=requiredActor(scene,checked.route.actorId),route=checked.route,segments=geometry.routeSegments(route);
          emit("movement.prepare", target.id, { routeId: geometryRouteId(route), targetId: target.id, requestedDestination: copy(route.destination), maximum: Number(route.maximum || 0), movement: movementLifecycle(route, p, { segmentIndex: 0, spent: 0 }) });
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
          if(checked.completed){delete s.geometryCursor;geometryCommit(route,requiredActor(scene,route.actorId),p,cursor,false,null);if(p.groupId)queue.unshift({p:{kind:"forced-towards-group-after-route",groupId:p.groupId,moverId:p.groupMoverId||route.actorId},sourceId:p.sourceActorId||sourceId,provenance:copy(provenance)});break;}
          const target=requiredActor(scene,route.actorId),segment=checked.segment;
          const lifecycle=movementLifecycle(route,p,cursor), segmentPayload={index:segmentIndex,from:copy(segment.from),to:copy(segment.to),cost:Number(segment.cost||0),terminal:Boolean(segment.terminal),stopReason:segment.stopReason||null};
          if(segmentIndex===0)emit("movement.start",target.id,{routeId:lifecycle.id,targetId:target.id,movement:lifecycle});
          const phasePayload={routeId:geometryRouteId(route),targetId:target.id,segmentIndex,from:segment.from,to:segment.to,cost:segment.cost,cursor:{...cursor,phase:"before-leave"},movement:lifecycle,segment:segmentPayload};
          emit("geometry.segment.before-leave",target.id,phasePayload);
          emit("movement.leave",target.id,phasePayload);
          emit("geometry.segment.leave",target.id,{...phasePayload,cursor:{...cursor,phase:"leave"}});
          emit("geometry.segment.before-enter",target.id,{...phasePayload,cursor:{...cursor,phase:"before-enter"}});
          const result=move(target,{destination:segment.to,forced:route.mode==="forced",maximum:segment.cost,width:route.width,height:route.height,ignoreTerrain:plan.request?.ignoreTerrain===true,ignoreOpponents:plan.request?.ignoreEnemies===true,straight:plan.request?.straight===true,__verifiedRoute:{spent:segment.cost,path:[{x:segment.to.x,y:segment.to.y}],space:segment.to.space,stoppedAt:segment.to,terminal:Boolean(segment.terminal),stopReason:segment.stopReason||null},__deferAuraTransitions:true,movement:p.label||"Движение по плану"});
          emit("geometry.segment.enter",target.id,{...phasePayload,cursor:{...cursor,phase:"enter"},position:{space:target.space,x:Number(target.x),y:Number(target.y)}});
          emitAuraChanges(result.auraTransitions,{movementTargetId:target.id,routeId:geometryRouteId(route),segmentIndex,boundary:"enter",from:segment.from,to:segment.to});
          const enteredMovement={...lifecycle,path:[...lifecycle.path,copy(segment.to)],distance:Number(cursor.spent||0)+Number(segment.cost||0),totalDistanceThisTurn:Number(cursor.spent||0)+Number(segment.cost||0),stoppedAt:copy(segment.to)};
          emit("movement.segment",target.id,{...phasePayload,to:copy(segment.to),movement:enteredMovement,segment:segmentPayload});
          emit("movement.enter",target.id,{...phasePayload,to:copy(segment.to),movement:enteredMovement,segment:segmentPayload});
          emit("movement.cross",target.id,{...phasePayload,from:copy(segment.from),to:copy(segment.to),movement:enteredMovement,segment:segmentPayload});
          const spent=Number(cursor.spent||0)+Number(segment.cost||result.cost||0),nextIndex=segmentIndex+1,terminal=Boolean(segment.terminal||nextIndex>=geometry.routeSegments(route).length&&route.terminal),trigger=geometryTriggerFor(plan,p,segment,segmentIndex),nextCursor=nextIndex<geometry.routeSegments(route).length&&!terminal?queueGeometrySegment(plan,p,cursor,sourceId,nextIndex,spent):{...geometry.geometryCursor(route,nextIndex,{...scene,version:Number(scene.version||0)+1},{id:cursor.id,spent,phase:terminal?"terminal":"completed",status:"completed",expectedSceneVersion:Number(scene.version||0)+1,expectedGeometryStamp:geometry.geometryStamp({...scene,version:Number(scene.version||0)+1})}),status:"completed",phase:terminal?"terminal":"completed"};
          if(terminal||nextIndex>=geometry.routeSegments(route).length){delete s.geometryCursor;geometryCommit(route,target,p,nextCursor,terminal,terminal?segment.stopReason||route.stopReason||null:null);if(p.groupId)queue.unshift({p:{kind:"forced-towards-group-after-route",groupId:p.groupId,moverId:p.groupMoverId||target.id},sourceId:p.sourceActorId||sourceId,provenance:copy(provenance)});break;}
          if(!s.choices.length&&trigger){
            const options=Array.isArray(trigger.options)&&trigger.options.length?trigger.options.map(String):["continue","stop"];
            const responderId=trigger.responderActorId||trigger.actorId||sourceId,targetResponder=requiredActor(scene,responderId,false);
            choice(targetResponder,"geometry-boundary",String(trigger.title||trigger.label||"Решение на границе движения").slice(0,240),options,{routeId:geometryRouteId(route),route:clone(route),cursorId:cursor.id,targetId:target.id,segmentIndex,cursorSegmentIndex:nextCursor.segmentIndex,boundary:"enter",triggerId:trigger.id||null,stopChoices:Array.isArray(trigger.stopChoices)?trigger.stopChoices.map(String):["stop"],spatialCommit:p.spatialCommit||null});
          }
          break;
        }
        case "modifier": {
          const target = requiredActor(scene, p.targetId || sourceId, false);
          if(p.remove){if(!["armor","evasion","speed"].includes(p.stat))fail("Неизвестный показатель");astate(target).modifiers=astate(target).modifiers.filter(m=>m.stat!==p.stat||(p.id&&m.id!==p.id));emit("modifier.remove",sourceId,p);break;}
          if (!["armor", "evasion", "speed"].includes(p.stat) || !Number.isInteger(p.amount) || Math.abs(p.amount) > 9999 || !["startTurn","endTurn","roundEnd","scene","manual"].includes(p.duration || "endTurn")) fail("Некорректный модификатор");
          astate(target).modifiers.push({ id: p.id || `${rootId}:modifier:${astate(target).modifiers.length}`, sourceActorId: sourceId, ownerActorId: p.ownerActorId || target.id, stat: p.stat, amount: p.amount, boundary: p.duration || "endTurn", appliedSerial: scene.turnSerial, ruleId: p.ruleId || provenance?.ruleId || null, sourceDigest: p.sourceDigest || provenance?.sourceDigest || null }); emit("modifier.configure", sourceId, p); break;
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
        case "search": vanishOperation({ ...p, operation: "search" }, sourceId); break;
        case "invisible":if(!effectActive(scene,a,"positive.невидим"))fail("Нет Невидимости");removeEffect(a,"positive.невидим");applyEffect(a,{effect:"positive.исчез",duration:"actionOrStartTurn"},a.id);break;
        case "configure-resource": {
          if (resources.has(p.id)) fail("ID совпадает со встроенным показателем");
          mutateCounter(p, sourceId, "resource", Object.hasOwn(a.ruleResources || {}, p.id) ? "configure" : "create");
          break;
        }
        case "dice-create": {
          if (!dice) fail("Модуль бросков LionWing недоступен");
          const request = diceRequestFromPayload(p, p.rollId || `${rootId}:roll`, p.rollKind || p.diceKind || "check", sourceId);
          const result = storeDiceRoll(createDiceRoll(request, { random: executionOptions.random }));
          diceOwnerCheck(result, sourceId, "Создание броска");
          diceJournal("create", result);
          emit("dice.create", sourceId, { rollId: result.id, roll: result });
          break;
        }
        case "dice-apply": {
          if (!dice) fail("Модуль бросков LionWing недоступен");
          const rollId = p.rollId || p.baseRollId || p.roll?.id;
          if (typeof rollId !== "string" || !rollId) fail("Изменение броска требует ID сохранённого броска");
          const base = s.diceRolls[rollId];
          if (!base) fail("Сохранённый бросок не найден");
          diceOwnerCheck(base, sourceId, "Изменение броска");
          const operation = diceOperationFromPayload(p);
          const suppliedProvenance = plain(operation.provenance) ? operation.provenance : {};
          const suppliedRoot = operation.rootActionId ?? suppliedProvenance.rootActionId;
          const suppliedInstance = operation.actionInstanceId ?? suppliedProvenance.actionInstanceId;
          if (suppliedRoot != null && suppliedRoot !== base.provenance?.rootActionId) fail("Операция относится к другому rootAction");
          if (suppliedInstance != null && suppliedInstance !== base.provenance?.actionInstanceId) fail("Операция относится к другому экземпляру действия");
          const previousOperation = (base.operations || []).find(item => item.id === operation.id);
          const result = applyDiceRoll(base, operation, {
            rootActionId: suppliedRoot ?? base.provenance?.rootActionId,
            actionInstanceId: suppliedInstance ?? base.provenance?.actionInstanceId,
            causeEventId: operation.causeEventId ?? suppliedProvenance.causeEventId ?? previousOperation?.provenance?.causeEventId ?? rootId,
            ownerActorId: operation.ownerActorId ?? suppliedProvenance.ownerActorId ?? base.ownerActorId ?? sourceId ?? null,
          });
          storeDiceRoll(result, true);
          diceJournal("apply", result, result.operations.at(-1)?.id || operation.id || null);
          emit("dice.apply", sourceId, { rollId: result.id, operation: result.operations.at(-1), roll: result });
          break;
        }
        case "dice-reload": {
          if (!dice) fail("Модуль бросков LionWing недоступен");
          const rollId = p.rollId || p.baseRollId || p.roll?.id || p.snapshot?.id;
          const saved = p.snapshot ?? p.roll ?? (rollId && s.diceRolls[rollId] ? s.diceRolls[rollId] : null);
          if (!saved) fail("Перезагрузка броска требует JSON-снимок");
          const result = reloadDiceRoll(saved);
          if (result.kind === "opposed") {
            diceOwnerCheck(result.leftRoll, sourceId, "Перезагрузка встречной проверки");
            storeOpposed(result, true);
          } else {
            diceOwnerCheck(result, sourceId, "Перезагрузка броска");
            storeDiceRoll(result, true);
          }
          diceJournal("reload", result);
          emit("dice.reload", sourceId, { rollId: result.id, kind: result.kind, roll: result });
          break;
        }
        case "dice-opposed": {
          if (!dice) fail("Модуль бросков LionWing недоступен");
          const request = diceParticipantRequest(p, p.opposedId || `${rootId}:opposed`);
          const result = storeOpposed(opposedDiceRoll(request, { random: executionOptions.random }));
          const owners = (result.participants || []).map(participant => participant.ownerActorId).filter(Boolean);
          if (sourceId && owners.length && !owners.includes(sourceId)) fail("Встречная проверка принадлежит другому участнику");
          diceJournal("opposed", result);
          emit("dice.opposed", sourceId, { opposedId: result.id, opposed: result });
          break;
        }
        case "dice-resolve-tie": {
          if (!dice) fail("Модуль бросков LionWing недоступен");
          if (sourceId) fail("Ничью встречной проверки разрешает только Нарратор");
          const opposedId = p.opposedId || p.id;
          if (typeof opposedId !== "string" || !opposedId) fail("Разрешение ничьей требует ID встречной проверки");
          const current = s.diceOpposed[opposedId];
          if (!current) fail("Встречная проверка не найдена");
          const result = storeOpposed(dice.resolveTie(current, p.resolution ?? p.choice), true);
          diceJournal("tie", result, p.operationId || null);
          emit("dice.tie.resolve", null, { opposedId: result.id, resolution: result.resolution, opposed: result });
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
        case "technique-choice": {
          const target = requiredActor(scene, sourceId, false), options = Array.isArray(p.options) ? p.options : [];
          if (!p.ruleId || !p.triggerKey || options.length < 2 || !plain(p.choices)) fail("Некорректный выбор Техники");
          choice(target, "technique-trigger", String(p.title || "Сработала Техника").slice(0, 240), options, { ruleId: p.ruleId, triggerKey: p.triggerKey, optionLabels: copy(p.optionLabels || {}), choices: copy(p.choices), ...(p.context || {}) });
          break;
        }
        case "choice": {
          const pending = s.choices[0];
          if (!pending || pending.id !== p.id || pending.actorId !== sourceId || !pending.options.includes(p.choice)) fail("Решение устарело или принадлежит другому участнику");
          if (p.planId != null && p.planId !== pending.context?.actionPlanId) fail("Решение относится к другому ActionPlan");
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
          else if (pending.kind === "technique-trigger") {
            const operations = pending.context?.choices?.[p.choice] || [];
            if (!Array.isArray(operations)) fail("Продолжение Техники повреждено");
            for (const operation of operations) {
              const nextOperation = { ...operation, sourceActorId: operation.sourceActorId ?? sourceId };
              if (pending.context?.destinationRequired && p.choice === "move" && p.destination) nextOperation.destination = p.destination;
              queue.unshift({ p: nextOperation, sourceId: nextOperation.sourceActorId ?? sourceId, provenance: { ...provenance, causeEventId: pending.context?.causeEventId || rootId, ownerActorId: pending.context?.ownerActorId || sourceId, ruleId: pending.context?.ruleId } });
            }
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
              if (route) geometryCommit({ ...route, path: (route.path || []).slice(0, Number(context.segmentIndex) + 1) }, target, { sourceActorId: route.sourceActorId, label: "Движение остановлено решением", spatialCommit:context.spatialCommit||null }, { ...cursor, status: "completed", phase: "terminal" }, true, "decision");
              else emit("geometry.route.stop", sourceId, { targetId: target.id, routeId: context.routeId || null, segmentIndex: context.segmentIndex, reason: "decision", terminal: true, stoppedAt: { space: target.space, x: Number(target.x), y: Number(target.y) } });
            }
          }
          else if (pending.kind === "knockout") { if (p.choice === "resist") { a[pending.context.track] = 1; a.hp = maxHealth(a); astate(a).vulnerable = true; } else knockout(a); }
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
            if (pending.context.martialQuickStep) {
              const owner = requiredActor(scene, pending.context.targetId || sourceId, false), destination = p.destination && { ...p.destination, space: p.destination.space || owner.space };
              if (!destination || destination.space !== owner.space || distance(owner, destination) < 1 || distance(owner, destination) > Number(pending.context.maximum || 3)) fail("Клетка Быстрого шага не соответствует дальности");
              move(owner, { destination, maximum: Number(pending.context.maximum || 3), sourceActionId: pending.context.ruleId || "powerhouse.martial-artist.1", movement: "Быстрый шаг" });
              queue.unshift({ p: { kind: "modifier", targetId: owner.id, stat: "evasion", amount: Number(pending.context.evasion || owner.tier || 1), duration: "endTurn", ruleId: pending.context.ruleId, sourceDigest: pending.context.sourceDigest }, sourceId: owner.id, provenance: { ...provenance, ownerActorId: owner.id, ruleId: pending.context.ruleId, sourceDigest: pending.context.sourceDigest } });
              emit("rule.respond", sourceId, { ...p, title: pending.title }); break;
            }
            if (pending.context.skirmisherShift) {
              const owner = requiredActor(scene, pending.context.targetId || sourceId, false), destination = p.destination && { ...p.destination, space: p.destination.space || owner.space };
              if (!destination || destination.space !== owner.space || (Number(destination.x) !== Number(owner.x) && Number(destination.y) !== Number(owner.y)) || distance(owner, destination) > Number(pending.context.maximum || 2)) fail("Клетка Смещающихся ударов должна быть прямолинейной и находиться в пределах 2 клеток");
              move(owner, { destination, maximum: Number(pending.context.maximum || 2), straight: true, ignoreOpponents: true, sourceActionId: "vagabond.skirmisher.2", movement: "Смещающиеся удары" });
              emit("rule.respond", sourceId, { ...p, title: pending.title }); break;
            }
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
            const source = actor(scene, pending.context.adjacentTo), destination = { ...p.destination, space: p.destination?.space || (pending.context.reappear ? a.space : source?.space || a.space) };
            if (source && distance(destination, source) !== 1 || pending.context.reappear && scene.actors.some(x => live(x) && x.id !== a.id && distance(destination, x) <= 1)) fail("Клетка не соответствует условию появления");
            if (pending.context.reappear) placeActor(a, { ...destination, space: source?.space || a.space }, { reason: "reappear-choice" });
            else move(a, { destination:{...destination,space:source?.space||a.space}, placement: true, followSnare:true });
          } else if (!String(p.note || "").trim()) fail("Запишите принятое решение");
          emit("rule.respond", sourceId, { ...p, title: pending.title });
          break;
        }
        case "reaction": {
          const pending = scene.pendingAction;
          if (!pending?.lionwing || !pending.targetIds.includes(sourceId) || pending.responses[sourceId]?.choice !== "pending") fail("Эта Реакция уже недоступна");
          if (p.planId != null && p.planId !== pending.actionPlanId) fail("Реакция относится к другому ActionPlan");
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
          const ownPool=3+Number(a.tier||1)+adapterNumber("rollBonus",a,{scene,kind:"clash",opponentId:attacker.id}),otherPool=3+Number(attacker.tier||1)+adapterNumber("rollBonus",attacker,{scene,kind:"clash",opponentId:a.id});
          if(own.initialCount!==ownPool||other.initialCount!==otherPool)fail("Неверный пул Столкновения");
          if(own.successes>other.successes)queue.unshift({p:{kind:"clash-win"},sourceId});
          else if(own.successes<other.successes)choice(a,"clash-loss","Столкновение проиграно: принять Атаку или получить 5 урона и перебросить?",["accept","reroll"],{attackId:pending.id});
          else choice(a,"clash-tie","Ничья Столкновения: Нарратор определяет победителя",["win","lose"],{attackId:pending.id});
          break;
        }
        case "clash-win":{const pending=scene.pendingAction;if(!pending)fail("Атака завершена");const context={scene,kind:"clash",opponentId:pending.actorId},reduction=Math.max(0,Number(a.attrs.spirit||0)+adapterNumber("statBonus",a,"spirit",context));pending.responses[a.id]={choice:"clash",reduction};emit("clash.success",a.id,{targetId:pending.actorId,opponentId:pending.actorId,attackId:pending.id,reduction});applyDamage({targetId:pending.actorId,sourceActorId:a.id,amount:reduction});break;}
        case "duel-return":{const duel=s.duels.find(item=>item.id===p.duelId);if(duel)duelReturn(duel);break;}
        case "resolve-attack": {
          const pending = scene.pendingAction;
          if (p.planId != null && p.planId !== pending?.actionPlanId) fail("Разрешение относится к другому ActionPlan");
          if (!pending?.lionwing || pending.targetIds.some(id => live(actor(scene, id)) && !effectActive(scene,actor(scene,id),"positive.исчез") && pending.responses[id]?.choice === "pending")) fail("Сначала дождитесь всех Реакций");
          scene.pendingAction = null;
          const operations = [];
          for (let i = 0; i < pending.repeat; i++) for (const targetId of pending.targetIds) {
            if(effectActive(scene,actor(scene,targetId),"positive.исчез"))continue;
            const response = pending.responses[targetId] || {};
            operations.push({ kind: "damage", sourceActorId: pending.actorId, targetId, amount: pending.targetDamage?.[targetId]??pending.damage, attack: true, sourceActionId: pending.sourceActionId, actionInstanceId: pending.actionInstanceId, techniqueRuleId: pending.techniqueRuleId, techniqueId: pending.techniqueId, techniqueIds: pending.techniqueIds, criticals: pending.criticals, reduction: response.reduction || 0, temporaryArmor: response.temporaryArmor || 0, effects: pending.effects, finalDamage: pending.finalDamage, ignoreArmor:pending.ignoreArmor, ignoreEvasion:pending.ignoreEvasion, irreducible:pending.irreducible, preventForcedMovement:response.preventForcedMovement, ...(pending.breacherPush ? { breacherPush: true, breacherPushMultiplier: pending.breacherPushMultiplier, breacherAttackSuccess: pending.breacherAttackSuccess, breacherInitialDistance: pending.breacherInitialDistances?.[targetId] } : {}), ...(pending.actionPlanId ? { actionPlanId: pending.actionPlanId } : {}) });
          }
          if (pending.breacherWeaken) operations.push({ kind: "effect", targetId: pending.actorId, sourceActorId: pending.actorId, effect: "negative.ослаблен", ruleId: "powerhouse.breacher.2", sourceActionId: pending.sourceActionId, duration: "default" });
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
          const sceneStarting = !s.started;
          if(s.grantedTurns?.length){s.grantedTurns.shift();astate(a).grantedTurn={lastTeam:s.lastTeam,lastActorId:s.lastActorId,acted:a.acted};}
          if (sceneStarting) { s.started = true; for (const hero of scene.actors.filter(isPlayer)) hero.focus = 1 + Math.ceil(Number(hero.attrs.spirit || 0) / 2); for (const other of scene.actors) other.ap = 0; scheduleBoundary("sceneStart", a); }
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
          scheduleBoundary("anyTurnStart", a);
          scheduleBoundary("turnStart", a);
          emit("turn.start", a.id, { ap: a.ap }); break;
        }
        case "turn-end": {
          if (scene.activeActorId !== sourceId || scene.pendingAction || s.choices.length || s.pausedChains?.length) fail("Нельзя завершить этот Ход: есть незавершённое действие");
          if (effectActive(scene,a,"positive.регенерирует")) applyHealing({targetId:a.id,amount:4+Number(a.tier||1)},a.id);
          scheduleBoundary("anyTurnEnd", a);
          scheduleBoundary("turnEnd", a);
          phase("endTurn", a); a.ap = 0; a.stepRemaining = 0; a.acted = true; scene.activeActorId = null; s.lastTeam = a.team; s.lastActorId = a.id; s.breakout = { actorId: a.id, turnSerial: scene.turnSerial }; s.opportunities = [];
          for(const other of scene.actors)if(Number(other.lionwing?.difficultTerrainStopSerial)===Number(scene.turnSerial))delete other.lionwing.difficultTerrainStopSerial;
          if(astate(a).grantedTurn){const resume=astate(a).grantedTurn;s.lastTeam=resume.lastTeam;s.lastActorId=resume.lastActorId;a.acted=resume.acted;delete astate(a).grantedTurn;}
          s.lastTurn = copy(s.activeTurn || { schema: 1, turnInstanceId: s.activeTurnInstanceId || null, actorId: a.id, sceneTurnSerial: scene.turnSerial, ownerTurnSerial: ownTurnSerial(a), ownerTurnKey: ownerTurnKey(s.sceneSerial, a) });
          emit("turn.end", a.id);delete s.activeTurn;delete s.activeTurnInstanceId; break;
        }
        case "round-end": {
          const status = roundEndStatus(scene); if (!status.available) fail(status.reason);
          scheduleBoundary("roundEnd", null);
          phase("roundEnd", null); scene.round++; mutateCombatMeter({ operation: "add", delta: 1 }, sourceId, `${rootId}:round-tension`); s.lastTeam = null; s.breakout = null;
          for (const other of scene.actors) { other.acted = other.kind === "crowd"; other.usedActions = []; other.ap = 0; other.stepRemaining = 0; }
          scheduleBoundary("roundStart", null);
          emit("round.end", null); break;
        }
        case "scene-reset": {
          if(scene.pendingAction||s.choices.length||s.deferred.length||s.duels?.length||s.pausedChains?.length)fail("Сначала завершите ожидающие решения и Дуэли");
          // Scene-end callbacks are observed for diagnostics/receipts, but
          // their optional choices belong to the scene that is being closed.
          // Never leave a stale prompt attached to the freshly reset Scene.
          scheduleBoundary("sceneEnd", null, { discardOperations: true, discardChoices: true });
          for(const target of scene.actors){
            resetCounters(target,"scene");
            target.hp=maxHealth(target);target.knockedOut=false;target.evasion=0;target.ap=0;target.acted=target.kind==="crowd";target.usedActions=[];target.stepRemaining=0;
            const automation=copy(target.lionwing?.automation||{});
            const previousInventoryIds=Object.keys(target.lionwing?.inventory?.definitions||{});
            const persistentInventory=inventory?.persistentState ? inventory.persistentState(target) : null;
            const persistentStates={};
            for(const [effect,saved] of Object.entries(target.effectStates||{})){
              const sources=Array.isArray(saved?.sources)?saved.sources:[];
              if(sources.length){
                const retained=sources.filter(source=>(source.duration||saved.duration)==="persistent"||source.lifetime==="persistent");
                if(retained.length)persistentStates[effect]={...saved,duration:"persistent",lifetime:"persistent",removable:retained.every(source=>source.removable!==false),sources:retained};
              }else if(saved?.duration==="persistent"||saved?.lifetime==="persistent")persistentStates[effect]=saved;
            }
            target.effectStates=persistentStates;target.effects=Object.keys(persistentStates);
            target.lionwing=Object.keys(automation).length?{automation}:{};
            if (persistentInventory && (Object.keys(persistentInventory.definitions || {}).length || Object.keys(persistentInventory.records || {}).length)) target.lionwing.inventory=persistentInventory;
            target.inventory ||= {};
            for (const id of previousInventoryIds) delete target.inventory[id];
            if (inventory?.syncLegacy) inventory.syncLegacy(target);
          }
          const resetMeter = mutateCombatMeter({ operation: "set", value: 0 }, sourceId, `${rootId}:scene-reset-tension`);
          scene.lionwing={schema:2,started:false,choices:[],deferred:[],receipts:s.receipts,history:s.history,specialJournal:s.specialJournal,compounds:s.compounds,auras:s.auras.filter(aura=>aura.lifetime==="persistent"),meters:{ tension: resetMeter.meter },sceneSerial:s.sceneSerial+1,chapterSerial:s.chapterSerial};
          if (global.DAWN_LIONWING_INFORMATION_QUERY?.reset) global.DAWN_LIONWING_INFORMATION_QUERY.reset(scene);
          scene.round=1;scene.turnSerial=0;scene.activeActorId=null;scene.targetIds=[];scene.targetCells=[];scene.results=null;
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
          else {const result=mutateCombatMeter({operation:"set",value:amount},sourceId,`${rootId}:tension`);emit("scene.tension",sourceId,{amount:result.value,before:result.before,owner:copy(result.meter.owner),source:copy(result.meter.source),scope:result.meter.scope,lifetime:result.meter.lifetime,receiptId:result.receiptId});}break;
        }
        case "combat-meter": {
          if (p.id !== combatMeter?.ids?.tension) fail("Поддерживается только общий счётчик Напряжения");
          const operation = p.operation || (p.delta !== undefined ? "add" : "set");
          const change = operation === "add" ? { operation, delta: p.delta } : operation === "reset" ? { operation } : { operation, value: p.value ?? p.current };
          const result = mutateCombatMeter(change, sourceId, `${rootId}:combat-meter`);
          emit("scene.tension", sourceId, { amount: result.value, before: result.before, owner: copy(result.meter.owner), source: copy(result.meter.source), scope: result.meter.scope, lifetime: result.meter.lifetime, receiptId: result.receiptId });
          break;
        }
        case "note": emit("rule.respond", sourceId, { note: String(p.note || "").slice(0,1200) }); break;
        default: fail(`Операция LionWing пока не поддерживается: ${p.kind}`);
      }
    }

    let request = event.payload;
    if (event.type !== "lionwing.command") {
      const p = event.payload || {}, mapped = {
        "turn.start": { kind: "turn-start" }, "turn.end": { kind: "turn-end" }, "round.end": { kind: "round-end" }, "intermission": { kind: "intermission" },
        "damage.apply": { kind: "damage", ...p, sourceActorId: event.actorId, attack: p.attack === true || Boolean(p.sourceActionId && p.sourceActionId !== "manual.adjudication") },
        "actor.heal": { kind: "heal", ...p }, "actor.wound": { kind: "wound", ...p }, "actor.knockout": { kind: "knockout", ...p },
        "resource.gain": { kind: "resource", operation: "gain", ...p }, "resource.spend": { kind: "resource", operation: "spend", ...p },
        "effect.apply": { kind: "effect", ...p }, "effect.remove": { kind: "effect", ...p, remove: true },
        "effect.banish": { kind: "banish", ...p }, "effect.vanish": { kind: "vanish", ...p },
        "compound.create": { kind: "compound", operation: "create", ...p }, "compound.add": { kind: "compound", operation: "add", ...p },
        "compound.update": { kind: "compound", operation: "update", ...p }, "compound.remove": { kind: "compound", operation: "remove", ...p }, "compound.dissolve": { kind: "compound", operation: "dissolve", ...p },
        "actor.move": { kind: "move", ...p, maximum: p.maximum ?? 99 }, "actor.enter": { kind: "note", note: "Вход в клетку" },
        "roll.public": { kind: "roll", roll: p, label: p.label || p.outcome || "Бросок" },
        "inventory.change": { kind: "inventory", ...p, operation: p.operation || (Number(p.delta || 0) >= 0 ? "gain" : "spend"), id: p.itemId || p.item, amount: Math.abs(Number(p.amount ?? p.delta ?? 0)) }
      };
      request = mapped[event.type];
      if (!request) fail(`Событие ${event.type} не перенесено в LionWing`);
    }
    const pendingActionId = scene.pendingAction?.sourceActionId || null;
    provenance = foundations.identity({ rootActionId: rootId, actionId: request.actionId || pendingActionId || `operation.${request.kind}`, actionDefinitionId:request.actionId||pendingActionId||`operation.${request.kind}`, actionInstanceId:rootId, causeEventId: rootId, ownerActorId: event.actorId || "scene" });
    saveFact("attempt", event.actorId??null, request.targetIds || (request.targetId ? [request.targetId] : []), { kind: request.kind });
    const duelPreparation=s.choices[0]?.kind==="duel-outcome"&&["roll","resource"].includes(request.kind)&&(s.duels||[]).some(duel=>duel.id===s.choices[0].context.duelId&&[duel.actorId,duel.targetId].includes(request.targetId||event.actorId));
    if (s.choices.length && !duelPreparation && !["choice", "correct", "note", "tension", "pause-chain", "information-reveal", "information-cancel", "information-handout"].includes(request.kind)) fail("Сначала ответьте на ожидающее решение");
    if (scene.pendingAction && !["reaction", "resolve-attack", "cancel-attack", "correct", "note", "choice", "tension","invisible","pause-chain","amend-attack", "information-reveal", "information-cancel", "information-handout"].includes(request.kind)) fail("Сначала завершите Атаку");
    const operations = request.kind === "batch" ? request.operations : [request];
    if (!Array.isArray(operations) || !operations.length || operations.length > 192 || operations.some(p => !p || p.kind === "batch")) fail("Некорректный пакет операций");
    for(const p of operations){
      if(!api.operations.includes(p.kind))fail("Неизвестная публичная операция LionWing");
      if(p.kind==="geometry-segment")fail("Сегмент движения создаётся только подтверждённым geometry-move");
      if(p.targetId)requiredActor(scene,p.targetId,false);
      if(["damage","heal","resource","correct","tension","spend-health","lose-health"].includes(p.kind))integer(p.amount,"количество");
      if(p.kind==="combat-meter" && p.operation === "add" && (typeof p.delta !== "number" || !Number.isSafeInteger(p.delta) || Math.abs(p.delta) > 9999)) fail("Некорректное значение: изменение");
      if(p.kind==="combat-meter" && ["set"].includes(p.operation)) integer(p.value ?? p.current,"новое значение");
      if(p.kind==="resource"&&!["spend","gain"].includes(p.operation))fail("Неизвестная операция ресурса");
      if(["effect","effect-source"].includes(p.kind)&&!effectIds.has(p.effect))fail("Неизвестный Эффект LionWing");
      if(p.kind==="effect-source"&&!['remove','expire','suppress','restore'].includes(p.operation))fail("Неизвестная операция источника Эффекта");
      if(p.kind==="banish"){
        if(!["apply","remove","expire"].includes(p.operation||"apply"))fail("Неизвестная операция Изгнания");
        if(typeof p.targetId!=="string"||!p.targetId)fail("Изгнание требует цель");
        if(p.duration!==undefined&&p.duration!=="startTurn"&&p.duration!=="default")fail("Изгнание истекает только в начале Хода");
      }
      if(p.kind==="vanish"){
        if(!["apply","remove","expire","reappear","search"].includes(p.operation||"apply"))fail("Неизвестная операция Исчезновения");
        if(typeof p.targetId!=="string"||!p.targetId)fail("Исчезновение требует цель");
        if(p.duration!==undefined&&p.duration!=="actionOrStartTurn"&&p.duration!=="default")fail("Исчезновение истекает при Действии или в начале Хода");
        if(p.destination!==undefined&&(!p.destination||typeof p.destination!=="object"||Array.isArray(p.destination)||!Number.isInteger(p.destination.x)||!Number.isInteger(p.destination.y)))fail("Появление требует координаты клетки");
      }
      if(p.kind==="compound"){
        if(!["create","update","add","remove","dissolve","disband"].includes(p.operation||"create"))fail("Неизвестная операция Compound");
        if(typeof (p.compoundId??p.id)!=="string"||!(p.compoundId??p.id).trim())fail("Compound требует ID");
        if((p.operation||"create")==="create"&&(p.partIds??p.actorIds??p.parts)===undefined)fail("Compound требует список Parts");
      }
      if(["placement","teleport","displacement"].includes(p.kind)){
        if(!p.geometryRuntime||p.geometryRuntime.operation!==p.kind)fail("Пространственная операция требует проверенный план");
        if(typeof p.targetId!=="string"||!p.targetId)fail("Пространственная операция требует цель");
      }
      if(p.kind === "forced-towards-group") {
        if(typeof p.sourceActorId !== "string" || typeof p.targetId !== "string" || typeof p.actionInstanceId !== "string" || typeof p.ruleId !== "string" || typeof p.sourceDigest !== "string") fail("Групповое принудительное перемещение требует источник, цель и происхождение");
        if(!plain(p.filter) || p.filter.team !== "opposing" || p.filter.effect !== "negative.испуган") fail("Групповое перемещение использует неподдерживаемый фильтр");
        if(p.actorIds !== undefined || p.fearedActorIds !== undefined || p.remainingActorIds !== undefined) fail("Список участников группового перемещения вычисляется ядром");
      }
      if(p.kind === "forced-towards-group-step" || p.kind === "forced-towards-group-after-route") {
        if(typeof p.groupId !== "string") fail("Продолжение группового перемещения повреждено");
      }
      if(p.kind==="aura"&&!['create','update','suppress','restore','remove','expire'].includes(p.operation||"create"))fail("Неизвестная операция ауры");
      if(["aura-create","aura-update","aura-suppress","aura-restore","aura-remove"].includes(p.kind)&&(!(p.id||p.aura?.id)||p.kind==="aura-create"&&!((p.sourceEntityId||p.aura?.sourceEntityId))))fail("Некорректное описание ауры");
      if(["information-study","information-reveal","information-cancel","information-handout"].includes(p.kind)) {
        if (p.role !== undefined) fail("Роль информации передаётся только доверенным контекстом");
        if (p.kind === "information-study" && (!p.targetId || !p.actionInstanceId)) fail("Изучение требует цель и actionInstanceId");
        if (["information-reveal", "information-cancel"].includes(p.kind) && !p.studyId) fail("Операция информации требует Изучение");
        if (p.kind === "information-reveal" && !p.category) fail("Раскрытие информации требует категорию");
      }
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
  const prepareEntityRemoval = (scene, ref, options = {}) => {
    if (!entities?.prepareDestroy) fail("Реестр сущностей LionWing недоступен");
    return entities.prepareDestroy(scene, ref, options);
  };
  const cancelEntityRemoval = (scene, ref, options = {}) => {
    if (!entities?.cancelDestroy) fail("Реестр сущностей LionWing недоступен");
    return entities.cancelDestroy(scene, ref, options);
  };
  const removeEntity = (scene, ref, options = {}) => {
    if (!entities?.destroy) fail("Реестр сущностей LionWing недоступен");
    return entities.destroy(scene, ref, { ...options, purge: true });
  };
  function dispatchMany(scene, events, options = {}) {
    if (!isScene(scene)) return legacy.dispatchMany(scene, events, options);
    if (!Array.isArray(events) || !events.length || events.length > 192) fail("Некорректный пакет событий");
    if (options.expectedVersion !== undefined && Number(options.expectedVersion) !== Number(scene.version || 0)) {
      if(events.every(event=>event?.id&&(scene.lionwing?.receipts||[]).some(receipt=>receipt.id===event.id&&receipt.fingerprint===JSON.stringify([event.type,event.actorId||null,event.payload||{}]))))return {scene:copy(scene),events:[],event:null};
      fail("Конфликт версии Сцены: обновите состояние");
    }
    let next = copy(scene); next.rulesEdition = "lionwing"; next.log ||= []; state(next);
    const output = [];
    for (const raw of events) {
      let event = { ...copy(raw), id: raw.id || global.crypto?.randomUUID?.() || `lw-${Date.now()}-${Math.random().toString(36).slice(2)}`, at: raw.at || new Date().toISOString(), payload: copy(raw.payload || {}) };
      const fingerprint = JSON.stringify([event.type, event.actorId || null, event.payload]);
      if(!event.visibility&&actor(next,event.actorId)?.hidden)event.visibility="gm";
      // Keep the legacy public-roll reducer as the source of challenge and
      // opposed-roll state transitions, while validating the dice projection
      // through the authoritative foundation first. Derived counters sent by
      // a client are replaced by values recomputed from the source faces.
      if (dice && event.type === "roll.public") {
        const normalized = validateRoll(event.payload, { rollId: event.id, ownerActorId: event.actorId ?? null });
        const owner = normalized.ownerActorId ?? normalized.provenance?.ownerActorId;
        if (event.actorId && owner && owner !== event.actorId) fail("Публичный бросок принадлежит другому участнику");
        if (normalized.successes == null || normalized.crits == null) fail("Публичный бросок должен иметь Успехи и Криты");
        event = { ...event, payload: { ...event.payload, formula: event.payload.formula ?? normalized.formula, rolls: copy(normalized.rolls), successes: normalized.successes, crits: normalized.crits } };
      }
      const receipt = state(next).receipts.find(r => r.id === event.id);
      if (receipt) { if (receipt.fingerprint !== fingerprint) fail("Конфликт ID события"); continue; }
      if (["entity.remove", "entity.destroy"].includes(event.type)) {
        if (!entities?.transition) fail("Реестр сущностей LionWing недоступен");
        // Authority is supplied by the trusted dispatcher context. A role
        // embedded in an untrusted event payload must never elevate a player.
        const role = options.role || (event.actorId === "narrator" || event.actorId === "gm" ? event.actorId : null);
        if (!["narrator", "gm"].includes(role)) fail("Удаление сущности доступно только Нарратору.");
        const result = entities.transition(next, { type: event.type, operation: event.type.slice("entity.".length), payload: event.payload }, { ...options, role, eventId: event.id, actorId: event.actorId, expectedVersion: options.expectedVersion ?? next.version });
        next = result.scene;
        next.version = Number(next.version || 0) + 1;
        output.push(result.event);
        state(next).receipts.push({ id: event.id, fingerprint });
        state(next).receipts = state(next).receipts.slice(-256);
        continue;
      }
      if (sharedTypes.has(event.type)) {
        const structuralMarker = event.type === "marker.remove" ? (next.markers || []).find(item => item.id === event.payload?.markerId) : null;
        if (event.type === "marker.remove" && structuralMarker?.ownerActorId === event.actorId && structuralMarker.ruleId === event.payload?.ruleId) {
          const hostId = structuralMarker.hostActorId || structuralMarker.metadata?.hostActorId || structuralMarker.metadata?.carrierActorId;
          execute(next, { ...event, type: "lionwing.command", payload: { ...event.payload, kind: "marker-remove", sourceActorId: event.actorId, targetId: hostId } }, output, options);
          next.version = Number(next.version || 0) + 1;
          state(next).receipts.push({ id: event.id, fingerprint });
          state(next).receipts = state(next).receipts.slice(-256);
          continue;
        }
        // Only structural tools use the old single-event reducer, never its triggers.
        if(event.type==="actor.spawn"){
          const spawned=event.payload.actor,edition=spawned?.rulesEdition||(spawned?.profileId?.startsWith("lionwing.")?"lionwing":"ru-v0.9");
          if(!["token","crowd"].includes(spawned?.kind)&&edition!=="lionwing")fail("Нельзя добавить участника другой редакции");
        }
        if(["actor.despawn","space.remove"].includes(event.type)&&(next.pendingAction||state(next).choices.length||state(next).duels?.length||state(next).pausedChains?.length))fail("Сначала завершите ожидающее действие");
        const result = legacy.dispatch(next, event); next = result.scene; output.push(result.event);
        const lostSourceId=event.type==="marker.remove"?event.payload?.markerId:event.type==="actor.despawn"?event.actorId||event.payload?.actorId:null;
        removeAurasForLostSource(next,lostSourceId);
        if (inventory?.removeSource && lostSourceId) inventory.removeSource(next, lostSourceId);
      } else { execute(next, event, output, options); next.version = Number(next.version || 0) + 1; }
      state(next).receipts.push({ id: event.id, fingerprint }); state(next).receipts = state(next).receipts.slice(-256);
    }
    return { scene: next, events: output, event: output[output.length - 1] };
  }
  function replay(scene, rawEvent, options = {}) {
    const event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : copy(rawEvent);
    if (!event || typeof event !== "object" || typeof event.operation !== "string") fail("Событие специальной операции имеет неподдерживаемый формат");
    if (!event.before || !event.after) fail("Событие специальной операции не содержит снимки для replay");
    validateSpecialSnapshotPair(event.before, event.after);
    const snapshot = specialSnapshot(scene, event.before.kind, event.before.actorIds || [], event.before.compoundId || null);
    const rootId = event.rootEventId || event.id;
    const saved = (state(copy(scene)).specialJournal || []).find(item => item.rootEventId === rootId || item.id === event.id);
    if (sameJson(snapshot, event.after)) return { ok: true, scene: copy(scene), event: copy(saved || event), replayed: true, idempotent: true };
    if (!sameJson(snapshot, event.before)) fail("Повтор специальной операции применён не к тому снимку");
    const payload = { ...(event.payload || {}), kind: event.operation };
    delete payload.special; delete payload.specialOperation;
    const result = dispatchMany(scene, [{ id: rootId, type: "lionwing.command", actorId: event.actorId || null, payload }], options);
    return { ...result, replayed: false, idempotent: false, event: result.event || event };
  }
  function undo(scene, rawEvent, options = {}) {
    const event = typeof rawEvent === "string" ? JSON.parse(rawEvent) : copy(rawEvent);
    if (!event || typeof event !== "object" || !event.before || !event.after || typeof event.operation !== "string") fail("Событие специальной операции не содержит снимки для отката");
    validateSpecialSnapshotPair(event.before, event.after);
    const current = specialSnapshot(scene, event.after.kind, event.after.actorIds || [], event.after.compoundId || null);
    if (!sameJson(current, event.after)) fail("Откат специальной операции устарел: состояние уже изменилось");
    const next = restoreSpecialSnapshot(scene, event.before), rootId = event.rootEventId || event.id;
    state(next).receipts = state(next).receipts.filter(receipt => receipt.id !== rootId && receipt.id !== event.id);
    next.version = Number(scene.version || 0) + 1;
    const undoEvent = { schema: 1, id: `undo:${event.id || rootId || "special"}`, type: `${event.type || `lionwing.${event.operation}`}.undo`, operation: "undo", actorId: options.actorId || null, rootEventId: rootId || null, payload: { eventId: event.id || null }, before: copy(event.after), after: copy(event.before) };
    next.log = Array.isArray(next.log) ? next.log : [];
    next.log.unshift({ id: `${undoEvent.id}:journal`, at: new Date().toISOString(), type: undoEvent.type, actorId: undoEvent.actorId, payload: copy(undoEvent.payload), visibility: "public" });
    next.log = next.log.slice(0, 200);
    state(next).specialJournal.push(copy(undoEvent)); state(next).specialJournal = state(next).specialJournal.slice(-128);
    return { ok: true, scene: next, event: undoEvent, undone: true };
  }
  function reload(scene) {
    const next = typeof scene === "string" ? JSON.parse(scene) : copy(scene);
    if (!next || typeof next !== "object") fail("Сохранение Сцены не является JSON-объектом");
    state(next);
    return next;
  }
  function previewEvents(scene, events, options = {}) {
    try { return { ok: true, ...dispatchMany(scene, events, options), errors: [] }; }
    catch (error) { return { ok: false, errors: [error.message], code: error.code || "LIONWING_RULE_BLOCKED" }; }
  }
  const api = {
    schema: 2, isScene, prepare, command, dispatchMany, replay, undo, reload, previewEvents, prepareEntityRemoval, cancelEntityRemoval, removeEntity, destroyEntity: removeEntity,
    combatMeter: combatMeter ? { read: (scene, id) => combatMeter.read(scene, id), quote: (scene, id, change) => combatMeter.quote(scene, id, change) } : null,
    turnStartStatus, roundEndStatus, turnIdentity,
    movement, roll, actionStatus, actionDef, speed, maxHealth, balance, canSpend, targetIds, costQuote, detectiveMovementStatus, prepareDetectiveTeleport,
    createDiceRoll, createRoll: createDiceRoll, diceCreate: createDiceRoll,
    applyDiceRoll, applyRoll: applyDiceRoll, diceApply: applyDiceRoll,
    reloadDiceRoll, reloadRoll: reloadDiceRoll, diceReload: reloadDiceRoll,
    opposedDiceRoll, opposedRoll: opposedDiceRoll, diceOpposed: opposedDiceRoll,
    resolveDiceTie: (value, resolution) => diceAvailable().resolveTie(value, resolution),
    historyStatus, effectInstanceStatus, activeState, auraRecord, auraStatus, lifetimeExpired, compoundStatus, lifecycleContext,
    lifecycle: lifecycleContext,
    composeNumeric: (base, operations, context = {}) => global.DAWN_LIONWING_ADAPTERS?.composeNumeric?.(base, operations, context) || { ok: false, reason: "Числовой конвейер недоступен." },
    numericQuote: (owner, context = {}) => global.DAWN_LIONWING_ADAPTERS?.numericQuote?.(owner, context) || { ok: false, reason: "Числовой конвейер недоступен." },
    informationQuery: global.DAWN_LIONWING_INFORMATION_QUERY || null,
    lifetimeBoundary: foundations.lifetimeBoundary,
    normalizeLifetime: foundations.normalizeLifetime,
    isLifetimeExpired: foundations.lifetimeExpired,
    operations: ["automation", "plan", "batch", "pause-chain", "resume-chain", "amend-attack", "recover-track", "record-action", "action", "attack", "information-study", "information-reveal", "information-cancel", "information-handout", "damage", "breacher-push", "spend-health", "lose-health", "heal", "wound", "stress", "knockout", "resource", "inventory", "intermission", "correct", "effect", "effect-source", "banish", "vanish", "compound", "aura", "aura-create", "aura-update", "aura-suppress", "aura-restore", "aura-remove", "placement", "teleport", "displacement", "move", "forced-towards-group", "forced-towards-group-step", "forced-towards-group-after-route", "forced-towards", "forced-away", "martial-quick-step", "jab", "skirmisher-shift", "geometry-move", "geometry-segment", "modifier", "allow-action", "grant-turn", "usage", "punish", "invisible", "search", "configure-resource", "dice-create", "dice-apply", "dice-reload", "dice-opposed", "dice-resolve-tie", "counter", "clock", "prompt", "technique-choice", "choice", "roll", "reaction", "resolve-attack", "cancel-attack", "turn-start", "turn-end", "round-end", "scene-reset", "chapter-start", "tension", "combat-meter", "note", "marker-remove"]
  };
  global.DAWN_LIONWING_ENGINE = api;
  const routed = global.DAWN_SCENE_ENGINE;
  const route = (name, handler) => { const previous = legacy[name]; routed[name] = (scene, ...args) => isScene(scene) ? handler(scene, ...args) : previous(scene, ...args); };
  route("dispatchMany", dispatchMany); route("dispatch", (scene, event, options) => dispatchMany(scene, [event], options)); route("previewEvents", previewEvents);
  route("turnStartStatus", turnStartStatus); route("roundEndStatus", roundEndStatus);
  route("prepareAction", (scene, data, request) => prepare(scene, { kind: "action", ...request }));
  route("availableActions", (scene, data, id) => core.actions.list.filter(d => d.type === "action").map(d => { const status = actionStatus(scene, actor(scene, id), d); return { ...d, ...status, cost: `${status.cost ?? d.cost.amount} ${d.cost.resource === "ap" ? "ОД" : d.cost.resource}`, automation: ["action.атаки.дуэль",ids.interact,ids.study].includes(d.id)?"decision":"full" }; }));
  route("effectiveActorSpeed", (scene, id) => sceneSpeed(scene,requiredActor(scene, id, false)));
  route("effectiveActorMaxHealth", (scene, id) => maxHealth(requiredActor(scene, id, false)));
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
    if (inventory?.project && projected?.actors) {
      const inventoryProjection = inventory.project(scene, viewer);
      for (const projectedActor of projected.actors) {
        projectedActor.lionwing ||= {};
        if (inventoryProjection[projectedActor.id]) projectedActor.lionwing.inventory = inventoryProjection[projectedActor.id];
        else delete projectedActor.lionwing.inventory;
      }
    }
    if(!["owner","narrator","gm"].includes(viewer.role)){
      delete projected.turnUndo;
      const hidden=new Set(scene.actors.filter(a=>a.hidden).map(a=>a.id));
      for(const marker of scene.markers||[])if(marker.hidden||marker.kind==="hidden")hidden.add(marker.id);
      for(const duel of scene.lionwing?.duels||[])if(hidden.has(duel.actorId)||hidden.has(duel.targetId))hidden.add(duel.id);
      const refersToHidden=value=>typeof value==="string"?hidden.has(value):value&&typeof value==="object"?Object.entries(value).some(([key,item])=>hidden.has(key)||refersToHidden(item)):false;
      projected.log=(projected.log||[]).filter(row=>!refersToHidden(row));
      if(projected.lionwing){
        delete projected.lionwing.history;delete projected.lionwing.pausedChains;delete projected.lionwing.receipts;delete projected.lionwing.boundaryReceipts;delete projected.lionwing.deferred;delete projected.lionwing.afterAttack;delete projected.lionwing.executionCursor;delete projected.lionwing.afterEventReceipts;
        for(const key of ["choices","duels","opportunities","grantedTurns"])projected.lionwing[key]=(projected.lionwing[key]||[]).filter(item=>!refersToHidden(item));
        projected.lionwing.auras=(projected.lionwing.auras||[]).filter(aura=>!hidden.has(aura.ownerActorId)&&!hidden.has(aura.sourceEntityId));
      }
      if(projected.pendingAction?.targetDamage)projected.pendingAction.targetDamage=Object.fromEntries(Object.entries(projected.pendingAction.targetDamage).filter(([id])=>!hidden.has(id)));
    }
    if (projected.lionwing && global.DAWN_LIONWING_INFORMATION_QUERY?.project) projected.lionwing.information = global.DAWN_LIONWING_INFORMATION_QUERY.project(scene, viewer);
    return projected;
  });
})(typeof window === "object" ? window : globalThis);
