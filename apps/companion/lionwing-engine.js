"use strict";

// LionWing commands are resolved on a copy. The 0.9 reducer and its Technique
// triggers are deliberately outside this boundary. Rendering/storage stay shared.
(function installLionwingEngine(global) {
  if (!global.DAWN_LIONWING_DATA?.coreRules) return;
  const legacy = { ...global.DAWN_SCENE_ENGINE };
  const core = global.DAWN_LIONWING_DATA.coreRules;
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
    const s=scene.lionwing;s.schema=1;
    if(s.started===undefined)s.started=Boolean(scene.activeActorId||Number(scene.round||1)>1||(scene.actors||[]).some(a=>a.acted&&a.kind!=="crowd"));
    if(s.lastTeam===undefined){const last=(scene.log||[]).find(e=>e.type==="turn.end");s.lastTeam=actor(scene,last?.actorId)?.team||null;}
    for(const key of ["choices","deferred","receipts"])if(!Array.isArray(s[key]))s[key]=[];
    return s;
  };
  const astate = a => {a.lionwing||={};for(const key of ["modifiers","history"])if(!Array.isArray(a.lionwing[key]))a.lionwing[key]=[];return a.lionwing;};
  const attributes = new Set(["body", "talent", "spirit", "mind"]);
  const effectIds = new Set([...core.effects.positive, ...core.effects.negative].map(e => e.id));
  const attacks = new Set([ids.spell, ids.skirmish, ids.finish, "action.атаки.дуэль"]);
  const persistent = new Set(["positive.невидим", "positive.регенерирует", "negative.порчен", "negative.помечен"]);
  const resources = new Set(["hp", "maxHp", "ap", "baseAp", "focus", "influence", "wounds", "stress", "armor", "evasion", "speed", "tier"]);
  const spendable = new Set(["ap", "focus", "influence"]);
  const resourceKey = (a,key) => ["focus","ap"].includes(key)?Object.keys(a.ruleResources||{}).find(id=>key==="focus"?a.ruleResources[id].replaces==="focus":a.ruleResources[id].replacesAp===true)||key:key;
  const balance = (a, key) => { const resolved=resourceKey(a,key);return Number(spendable.has(resolved)?a[resolved]||0:a.ruleResources?.[resolved]?.value||0); };
  const canSpend=(a,key,amount)=>{const resource=resourceKey(a,key),def=a.ruleResources?.[resource];return key==="focus"&&def?.inverted?def.maximum==null||balance(a,key)+amount<=def.maximum:balance(a,key)>=amount;};
  const lifetimes = new Set(["default", "startTurn", "endTurn", "nextTurn", "roundEnd", "scene", "persistent", "manual"]);
  const actionDef = id => core.actions.list.find(item => item.id === id);
  const nameOf = id => actionDef(id)?.name || id;
  const command = (actorId, payload) => ({ type: "lionwing.command", actorId, payload });
  const stat = (a, key) => Math.max(0, Number(a[key] || 0) + (a.lionwing?.modifiers || []).filter(m => m.stat === key).reduce((sum, m) => sum + (key==="evasion"?m.remaining??m.amount:m.amount), 0));
  const scaledMove = (a, amount) => Math.ceil(amount * (has(a, "positive.ускорен") ? 2 : 1) / (has(a, "negative.замедлен") ? 2 : 1));
  const speed = a => scaledMove(a, stat(a, "speed"));
  const sceneSpeed = (scene,a) => { const group=legacy.compoundEnemyStatus(scene,a);return group.active?scaledMove(a,group.speed+(a.lionwing?.modifiers||[]).filter(m=>m.stat==="speed").reduce((sum,m)=>sum+m.amount,0)):speed(a); };
  const targetIds = (scene,values=[]) => {const seen=new Set();return [...new Set(values)].filter(id=>{const key=actor(scene,id)?.compoundId||id;if(seen.has(key))return false;seen.add(key);return true;});};
  const unavailable = reason => ({ available: false, reason });

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
    if (has(a, "negative.подброшен") && Number(a.effectStates?.["negative.подброшен"]?.appliedTurnSerial??scene.turnSerial)>=Number(scene.turnSerial||0) && scene.actors.some(x => live(x) && x.id !== id && x.team === a.team && !x.acted && !has(x, "negative.подброшен"))) return unavailable("Сначала должен походить доступный союзник: участник Подброшен");
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
    if (!options.placement && !options.forced && (has(a, "negative.обездвижен") || has(a, "negative.подброшен") || has(a, "negative.пойман") && (a.effectStates?.["negative.пойман"]?.sources || []).some(s => live(actor(scene, s.actorId))&&!has(actor(scene,s.actorId),"positive.исчез")))) fail("Эффект запрещает добровольное движение");
    if (options.forced && has(a, "positive.устойчив")) fail("Устойчивость запрещает принудительное движение");
    const key = p => `${p.x},${p.y}`;
    const terrain = new Set([...scene.objects.filter(o => o.space === board.id && o.type === "terrain").flatMap(o => o.cells || []),...(scene.topology?.cuts||[]).filter(cut=>cut.space===board.id).flatMap(cut=>cut.cells||[])]);
    const difficult = new Set(scene.objects.filter(o => o.space === board.id && o.type === "difficult").flatMap(o => o.cells || []));
    const occupied = scene.actors.filter(x => x.id !== a.id && (!a.compoundId||x.compoundId!==a.compoundId) && x.space === board.id && live(x) && !has(x, "positive.исчез") && has(a, "positive.изгнан") === has(x, "positive.изгнан"));
    const blocked = p => !options.ignoreTerrain && terrain.has(key(p));
    if (blocked(destination) || board.mode !== "cinematic" && occupied.some(x => x.x === destination.x && x.y === destination.y)) fail("Клетка занята");
      if (options.placement || options.teleport) {if(options.teleport&&options.maximum!=null&&distance(a,{...destination,space:board.id})>options.maximum)fail("Телепортация выходит за дальность");return { cost: 0, path: [{ x: destination.x, y: destination.y }], space: board.id };}
    const maximum = integer(options.maximum ?? 99, "дальность", 999);
    const crossesWall = (from, to) => typeof wallBlocksStep === "function" && wallBlocksStep(scene, a.space, from, to);
    if (options.line) {
      const dx = destination.x - a.x, dy = destination.y - a.y;
      if (dx && dy && Math.abs(dx) !== Math.abs(dy)) fail("Нужна прямая ортогональная или диагональная Линия");
      const steps = Math.max(Math.abs(dx), Math.abs(dy)), cost = Math.abs(dx) + Math.abs(dy), path = [];
      if (!cost || cost > maximum) fail("Клетка вне дальности движения");
      let from = a;
      for (let i = 1; i <= steps; i++) {
        const point = { x: a.x + Math.sign(dx) * i, y: a.y + Math.sign(dy) * i };
        if (blocked(point) || crossesWall(from, point)) fail("Путь перекрыт препятствием");
        path.push(point); from = point;
      }
      return { cost, path, space: board.id };
    }
    const queue = [{ x: a.x, y: a.y, cost: 0, path: [] }], best = new Map([[key(a), 0]]);
    while (queue.length) {
      queue.sort((x, y) => x.cost - y.cost);
      const p = queue.shift();
      if (p.x === destination.x && p.y === destination.y) return { cost: p.cost, path: p.path, space: board.id };
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const q = { x: p.x + dx, y: p.y + dy }, foe = occupied.some(x => x.team !== a.team && x.x === q.x && x.y === q.y);
        const cost = p.cost + (!options.ignoreTerrain && difficult.has(key(q)) || foe && board.mode === "cinematic" ? 2 : 1);
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
    const critAt=options.critAt??6,explode=options.explode!==false;if(![5,6].includes(critAt))fail("Критический успех: 5+ или 6");
    integer(count, "число костей", 100);
    const rolls = [], queue = Array(count).fill(0);
    while (queue.length) {
      queue.pop();
      if (rolls.length >= 300) fail("Слишком длинная цепочка критов; повторите бросок");
      const die = 1 + Math.floor(random() * 6);
      if (die < 1 || die > 6) fail("Некорректный источник случайности");
      rolls.push(die); if (explode && die >= critAt) queue.push(0);
    }
    return { initialCount: count, rolls, successes: rolls.filter(v => v >= 4).length, crits: rolls.filter(v => v >= critAt).length, formula: `${count}D6`,...(critAt!==6||!explode?{critAt,explode}:{}) };
  }

  function validateRoll(value) {
    if (!value || !Array.isArray(value.rolls) || value.rolls.length > 300 || value.rolls.some(v => !Number.isInteger(v) || v < 1 || v > 6)) fail("Некорректный бросок");
    const critAt=value.critAt??6,explode=value.explode!==false;if(![5,6].includes(critAt))fail("Некорректный порог критов");
    const crits = value.rolls.filter(v => v >= critAt).length;
    if (value.rolls.length !== integer(value.initialCount, "исходный пул", 100) + (explode?crits:0)) fail("Бросок содержит незавершённые или лишние кости");
    return { ...copy(value), successes: value.rolls.filter(v => v >= 4).length, crits };
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
    const taunts=(a.effectStates?.["negative.спровоцирован"]?.sources||[]).map(x=>x.actorId),fears=(a.effectStates?.["negative.испуган"]?.sources||[]).map(x=>x.actorId);
    const counts=Object.fromEntries(targets.map(id=>[id,Math.max(0,base-(has(a,"negative.спровоцирован")&&!targets.some(t=>taunts.includes(t))?a.tier:0)-(has(a,"negative.испуган")&&fears.includes(id)?a.tier:0)+((p.spikeTargetIds||[]).includes(id)&&has(actor(scene,id),"negative.подброшен")?a.tier:0))]));
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
      if (payload.kind === "roll" && !payload.roll) payload.roll = roll(integer(payload.count, "число костей", 100), options.random, payload);
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
      const events = [command(a?.id||null, payload)], preview = previewEvents(scene, events);
      return preview.ok ? { ...preview, events } : preview;
    } catch (error) { return { ok: false, errors: [error.message] }; }
  }

  // Operations use typed data, stable source ids, and explicit phase lifetimes.
  // Techniques may compose these operations without registering imperative code.
  function execute(scene, event, output) {
    const s = state(scene), rootId = event.id, emitted = [];
    const emit = (type, actorId, payload = {}) => {
      const row = { id: `${rootId}:${emitted.length}`, at: event.at, type, actorId: actorId || null, payload: copy(payload), visibility: event.visibility || "public" };
      emitted.push(row); scene.log.unshift(row); scene.log = scene.log.slice(0, 200); return row;
    };
    const removeEffect = (a, effect, options={}) => {
      const wasDisappeared=effect==="positive.исчез"&&has(a,effect);
      if (!effectIds.has(effect)) fail("Неизвестный Эффект LionWing");
      const parts=a.compoundId?scene.actors.filter(x=>x.compoundId===a.compoundId):[a];
      for(const part of parts){
        if(!has(part,effect))continue;
        part.effects=part.effects.filter(e=>e!==effect);
        if(part.effectStates)delete part.effectStates[effect];
        if(part.lionwing?.effectLifetimes)delete part.lionwing.effectLifetimes[effect];
        emit("effect.remove",part.id,{targetId:part.id,effect});
      }
      if(wasDisappeared&&options.reappear!==false)choice(a,"placement","Выберите клетку появления вне соседства с персонажами",["place"],{reappear:true});
    };
    const choice = (a, kind, title, options, context = {}) => { s.choices.push({ id: `${rootId}:choice:${s.choices.length}`, actorId: a.id, kind, title, options, context }); };
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
    const knockout = a => {
      if (a.knockedOut) return;
      a.knockedOut = true; a.ap = 0; a.stepRemaining = 0; s.grantedTurns=(s.grantedTurns||[]).filter(turn=>turn.actorId!==a.id);
      if (scene.activeActorId === a.id) { scene.activeActorId = null; a.acted = true; s.lastTeam = a.team; s.lastActorId = a.id; }
      if (!s.lowTension) scene.tension = Number(scene.tension || 0) + 1;
      for (const other of scene.actors) for (const e of ["negative.испуган", "negative.спровоцирован"]) {
        const saved=other.effectStates?.[e];
        if(!saved?.sources?.some(source=>source.actorId===a.id))continue;
        saved.sources=saved.sources.filter(source=>source.actorId!==a.id);
        if(!saved.sources.length)removeEffect(other,e);
        else emit("effect.source.remove",other.id,{targetId:other.id,effect:e,sourceActorId:a.id});
      }
      emit("actor.knockout", a.id, { targetId: a.id });
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
        if (astate(a).vulnerable) knockout(a);
        else choice(a, "knockout", "Выведение из боя: Сопротивляться или принять?", ["resist", "accept"], { track });
      }
    };
    const applyEffect = (a, p, sourceId) => {
      if (!effectIds.has(p.effect)) fail("Неизвестный Эффект LionWing");
      const duration = p.duration && p.duration!=="default" ? p.duration : (persistent.has(p.effect) ? "scene" : p.effect === "positive.изгнан" ? "startTurn" : a.compoundId?"roundEnd":"default");
      if (!lifetimes.has(duration)) fail("Неизвестный срок Эффекта");
      if (p.effect === "positive.изгнан") for (const other of scene.actors) if (other.id !== a.id && (!a.compoundId||other.compoundId!==a.compoundId) && (other.effectStates?.[p.effect]?.sources || []).some(source => source.actorId === sourceId)) removeEffect(other, p.effect);
      a.effects = [...new Set([...(a.effects || []), p.effect])];
      a.effectStates ||= {};
      const previousSources=["negative.испуган","negative.спровоцирован","negative.пойман"].includes(p.effect)?(a.effectStates[p.effect]?.sources||[]).filter(item=>item.actorId!==sourceId):[];
      a.effectStates[p.effect] = { duration, removable: true, appliedTurnSerial: Number(scene.turnSerial || 0), appliedRound: scene.round, appliedEventId: rootId, sources: sourceId ? [...previousSources,{ actorId: sourceId, actionId: p.sourceActionId || "", eventId: rootId }] : previousSources };
      astate(a).effectLifetimes ||= {};
      astate(a).effectLifetimes[p.effect] = { ownerActorId: p.ownerActorId || a.id, duration, appliedSerial: Number(scene.turnSerial || 0), appliedRound: scene.round };
      emit("effect.apply", sourceId, { targetId: a.id, effect: p.effect, duration });
      if(a.compoundId&&!p.compoundCopy)for(const part of scene.actors.filter(x=>x.id!==a.id&&x.compoundId===a.compoundId))applyEffect(part,{...p,compoundCopy:true,duration},sourceId);
      if (p.effect === "negative.пойман" && !p.compoundCopy && !p.preventForcedMovement && !has(a,"positive.устойчив") && sourceId && distance(a, requiredActor(scene, sourceId)) > 1) choice(a, "placement", "Пойман: выберите клетку рядом с источником", ["place"], { adjacentTo: sourceId, forced: true });
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
        if (attack && !p.finalDamage) amount = Math.max(0, amount + (has(source, "positive.усилен") ? Math.ceil(source.tier / 2) : 0) - (has(source, "negative.ослаблен") ? Math.ceil(source.tier / 2) : 0));
        amount = Math.max(0, amount - integer(p.reduction || 0, "снижение урона"));
      }
      const armor = !p.irreducible && attack && !p.ignoreArmor && !has(a, "negative.разорван") ? (compound.active&&compound.defenseType!=="armor"?0:stat(defender, "armor")) + (has(a, "positive.укреплен") ? Number(a.tier || 1) : 0) + Number(p.temporaryArmor || 0) : 0;
      const afterArmor = amount > 0 ? Math.max(1, amount - armor) : 0;
      const evasionAllowed = !p.irreducible && !p.ignoreEvasion && !has(a, "negative.обездвижен") && !has(a, "negative.пойман");
      const evaded = evasionAllowed ? Math.min(afterArmor, compound.active&&compound.defenseType!=="evasion"?0:stat(defender, "evasion")) : 0;
      let toSpend=evaded;
      for(const m of astate(defender).modifiers.filter(m=>m.stat==="evasion"&&m.amount>0)){const used=Math.min(toSpend,m.remaining??m.amount);m.remaining=(m.remaining??m.amount)-used;toSpend-=used;}
      defender.evasion = Math.max(0, Number(defender.evasion || 0) - toSpend);
      if(compound.active&&compound.defenseType==="evasion")for(const part of compound.parts)part.evasion=Math.min(Number(part.evasion||0),defender.evasion);
      let dealt = Math.max(0, afterArmor - evaded);
      if (attack && dealt > 0 && !p.irreducible && !p.finalDamage && has(a, "negative.помечен")) { dealt += Number(a.tier || 1); removeEffect(a, "negative.помечен"); }
      if(compound.active){const nextGate=Math.max(0,(Math.ceil(compound.hp/compound.gate-1e-9)-1)*compound.gate);dealt=Math.min(dealt,Math.max(0,compound.hp-nextGate));let remaining=compound.hp-dealt;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}if(dealt>0&&compound.hp-dealt===nextGate&&nextGate>0)scene.tension++;}
      else a.hp = Math.max(0, Number(a.hp) - dealt);
      emit("damage.apply", p.sourceActorId, { ...p, raw, armor, evaded, dealt, hp: a.hp });
      if (dealt > 0 && (compound.active?compound.hp-dealt<=0:a.hp===0)) { if (isPlayer(a)) wound(a, p.sourceActorId); else {knockout(a);if(compound.active)for(const part of compound.parts){part.knockedOut=true;part.ap=0;}} }
      if (!(attack && afterArmor > 0 && evaded === afterArmor) && !a.knockedOut) for (const e of p.effects || []) applyEffect(a, {...(typeof e === "string" ? { effect: e } : e),preventForcedMovement:p.preventForcedMovement}, p.sourceActorId);
    };
    const move = (a, p) => {
      const result = movement(scene, a, p.destination || p, p), from = { x: a.x, y: a.y, space: a.space };
      a.x = (p.destination || p).x; a.y = (p.destination || p).y; a.space = result.space;
      if(a.compoundId)for(const part of scene.actors.filter(x=>x.compoundId===a.compoundId)){part.x=a.x;part.y=a.y;part.space=a.space;}
      emit("actor.move", a.id, { ...p, from, x: a.x, y: a.y, space: a.space, path: result.path, distance: result.cost });
      // A typed notification is also useful when the Technique itself is manual.
      const points=[from,...result.path.map(point=>({...point,space:result.space}))];
      if (!p.placement) for (const foe of scene.actors.filter(x => live(x) && !has(x,"positive.исчез") && x.team !== a.team)) if (points.some((point,index)=>index>0&&distance(points[index-1],foe)===1&&distance(point,foe)>1)) {
        s.opportunities ||= []; s.opportunities.push({ id: `${rootId}:punish:${foe.id}`, actorId: foe.id, targetId: a.id, turnSerial: scene.turnSerial });
        emit("reaction.offer", foe.id, { targetId: a.id, actionId: "action.защита.наказание", name: "Наказание" });
      }
      if(!p.followSnare)for(const caught of scene.actors.filter(x=>live(x)&&x.id!==a.id&&has(x,"negative.пойман")&&(x.effectStates?.["negative.пойман"]?.sources||[]).some(source=>source.actorId===a.id))){
        if(distance(caught,a)!==1&&!has(caught,"positive.устойчив"))choice(caught,"placement","Пойман: выберите клетку рядом с переместившимся источником",["place"],{adjacentTo:a.id,forced:true});
      }
      return result;
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
      emit("resource.spend", a.id, { resource, amount });
    };
    const gain = (a, requestedResource, amount) => {
      integer(amount,"получение ресурса");
      const resource=resourceKey(a,requestedResource),before=balance(a,resource);
      if(!spendable.has(resource)&&!Object.hasOwn(a.ruleResources||{},resource))fail("Сначала настройте ресурс");
      if(requestedResource==="focus"&&a.ruleResources?.[resource]?.inverted){a.ruleResources[resource].value=Math.max(0,before-amount);emit("resource.spend",a.id,{resource,amount:Math.min(before,amount),requestedAmount:amount,inverted:true});return;}
      if(spendable.has(resource))a[resource]=before+amount;
      else {const def=a.ruleResources[resource];if(def.maximum!=null&&before+amount>def.maximum)fail("Получение превышает максимум ресурса");def.value=before+amount;}
      emit("resource.gain",a.id,{resource,amount});
    };
    const applyHealing = (p,sourceId) => { const target = requiredActor(scene, p.targetId || sourceId); const amount = integer(p.amount, "лечение"),compound=legacy.compoundEnemyStatus(scene,target),before=compound.active?compound.hp:target.hp;let after;if(compound.active){after=Math.min(Math.ceil(compound.hp/compound.gate)*compound.gate,compound.hp+amount);let remaining=after;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}}else{target.hp=Math.min(target.maxHp,target.hp+amount);after=target.hp;}emit("actor.heal",sourceId,{targetId:target.id,amount,restored:after-before});};
    const counterPolicy = (p, previous, maximum) => {
      const resetAt=p.resetAt??previous?.resetAt??"manual",initial=integer(p.initial??previous?.initial??0,"значение сброса");
      if(!["manual","startTurn","endTurn","roundEnd","scene"].includes(resetAt))fail("Неизвестный срок сброса счётчика");
      if(maximum!=null&&initial>maximum)fail("Значение сброса превышает максимум");
      return {resetAt,initial};
    };
    const resetCounters = (a,boundary) => {
      for(const [collection,type] of [[a.ruleResources,"rule-resource.reset"],[a.ruleClocks,"rule-clock.reset"]])for(const [id,def] of Object.entries(collection||{})){
        if(def.resetAt!==boundary)continue;
        const before=def.value;def.value=def.initial??0;
        emit(type,a.id,{id,before,value:def.value,boundary});
      }
    };
    const phase = (boundary, owner) => {
      for (const a of scene.actors) {
        if(boundary==="roundEnd"||a.id===owner?.id)resetCounters(a,boundary);
        for (const effect of [...(a.effects || [])]) {
          const saved = a.effectStates?.[effect], life = a.lionwing?.effectLifetimes?.[effect] || { duration: saved?.duration || (persistent.has(effect) ? "scene" : "default"), ownerActorId: a.id, appliedSerial: saved?.appliedTurnSerial ?? -1, appliedRound: saved?.appliedRound ?? 0 };
          const due = boundary === "roundEnd" && life.duration === "roundEnd" || life.ownerActorId === owner?.id && (boundary === "startTurn" && ["startTurn", "nextTurn"].includes(life.duration) || boundary === "endTurn" && ["default", "endTurn"].includes(life.duration) && scene.turnSerial > life.appliedSerial);
          if (due) removeEffect(a, effect);
        }
        astate(a).modifiers = (astate(a).modifiers || []).filter(m => !(m.boundary === boundary && (boundary === "roundEnd" || m.ownerActorId === owner?.id) && (boundary === "roundEnd" || scene.turnSerial > m.appliedSerial)));
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
        if (has(target, "positive.исчез") || has(a, "positive.изгнан") !== has(target, "positive.изгнан")) fail("Цель недоступна из-за Эффекта");
      }
      scene.pendingAction = { id: rootId, lionwing: true, actorId: a.id, name: p.name || "Атака", targetIds: targets, damage: integer(p.amount, "урон"), repeat: integer(p.repeat ?? 1, "повторы", 30), effects: copy(p.effects || []), finalDamage: Boolean(p.finalDamage), ignoreArmor:p.ignoreArmor===true, ignoreEvasion:p.ignoreEvasion===true, irreducible:p.irreducible===true, responses: Object.fromEntries(targets.map(id => [id, { choice: "pending" }])), sourceActionId: p.actionId || "manual.attack" };
      if(p.targetDamage){if(typeof p.targetDamage!=="object"||Array.isArray(p.targetDamage))fail("Некорректный урон по целям");for(const[id,amount]of Object.entries(p.targetDamage)){if(!targets.includes(id))fail("Урон указан для посторонней цели");integer(amount,"урон цели");}scene.pendingAction.targetDamage=copy(p.targetDamage);}
      if (!scene.pendingAction.repeat) fail("Нужно хотя бы одно нанесение урона");
      emit("attack.pending", a.id, scene.pendingAction);
      if(has(a,"negative.порчен"))s.afterAttack=[...(s.afterAttack||[]),{kind:"damage",targetId:a.id,amount:Number(a.tier||1),sourceActorId:a.id,irreducible:true}];
    };
    const performAction = (a, p) => {
      const def = actionDef(p.actionId);
      if (!def) fail("Неизвестное базовое действие");
      const status = actionStatus(scene, a, def, p);
      if (!status.available) fail(status.reason);
      if (has(a, "positive.исчез")) {
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
      astate(a).history = [...(astate(a).history || []), { actionId: def.id, targetIds: targets.map(t => t.id), round: scene.round, turnSerial: scene.turnSerial, swift: Boolean(status.swift) }].filter((item,index,list)=>item.ruleId||index>=list.length-200);
      emit("action.resolve", a.id, { actionId: def.id, name: def.name, targetIds: targets.map(t => t.id) });
      let result;
      if ([ids.spell, ids.skirmish, ids.finish, ids.charge].includes(def.id)) {
        result = publishRoll(a, p.roll, def.name);
        const pools=attackPools(scene,a,def,p);if(result.initialCount!==pools.base)fail("Пул броска не соответствует действию");
        p.targetDamage={};for(const[id,count]of Object.entries(pools.counts)){let extra=0;if(count>pools.base){const extraRoll=publishRoll(a,p.targetRolls?.[id],`Дополнительные кости: ${actor(scene,id).name}`);if(extraRoll.initialCount!==count-pools.base)fail("Неверный дополнительный пул");extra=extraRoll.successes;}p.targetDamage[id]=result.successes+extra+(def.id===ids.finish?Number(scene.tension||0):0);}
        for(const id of p.spikeTargetIds||[])if(targets.some(t=>t.id===id)&&has(actor(scene,id),"negative.подброшен"))removeEffect(actor(scene,id),"negative.подброшен");
      }
      if ([ids.spell, ids.skirmish, ids.finish].includes(def.id)) beginAttack(a, { ...p, name: def.name, amount: result.successes + (def.id === ids.finish ? Number(scene.tension || 0) : 0) });
      else if (def.id === ids.charge || def.id === ids.breathe) { const amount = def.id === ids.charge ? Math.max(2, result.successes) : 1; gain(a,"focus",amount); }
      else if (def.id === ids.step) { if (!status.continuation) a.stepRemaining = sceneSpeed(scene,a); if (p.destination) a.stepRemaining -= move(a, { destination: p.destination, maximum: a.stepRemaining }).cost; }
      else if (def.id === ids.jump) move(a, { destination: p.destination, maximum: scaledMove(a, Number(a.attrs.talent || 0)), line: true, ignoreOpponents: true });
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
      if (def.id==="action.атаки.дуэль" && has(a, "negative.порчен")) {
        const damage={kind:"damage",targetId:a.id,amount:Number(a.tier||1),sourceActorId:a.id,irreducible:true};
        if(scene.pendingAction)s.afterAttack=[damage];else queue.unshift({p:damage,sourceId:a.id});
      }
    };

    function op(p, sourceId) {
      const a = sourceId ? requiredActor(scene, sourceId, false) : null;
      switch (p.kind) {
        case "action": performAction(requiredActor(scene, sourceId), p); break;
        case "attack": if (p.cost) spend(requiredActor(scene, sourceId), p.cost.resource || "ap", integer(p.cost.amount, "стоимость")); beginAttack(requiredActor(scene, sourceId), p); break;
        case "damage": applyDamage({ ...p, sourceActorId: Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId }); break;
        case "record-action": {
          const def=actionDef(p.actionId);if(!def||def.type!=="action")fail("Выберите базовое действие");
          if(scene.activeActorId!==sourceId&&!p.reaction)fail("Сейчас не Ход исполнителя");
          const swift=p.swift===true||p.reaction===true,used=isPlayer(a)?a.usedActions||[]:astate(a).turnActions||[];
          if(!swift&&used.includes(def.id))fail("Действие уже использовано");
          spend(a,p.resource||"ap",integer(p.amount??0,"стоимость"));
          if(!swift){a.usedActions=[...new Set([...(a.usedActions||[]),def.id])];astate(a).turnActions=[...new Set([...(astate(a).turnActions||[]),def.id])];}
          astate(a).history.push({actionId:def.id,round:scene.round,turnSerial:scene.turnSerial,swift,manual:true});
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
          else if (p.resource === "knockedOut") { for(const part of compound.active?compound.parts:[target]){part.knockedOut=Boolean(amount);if(part.knockedOut){part.ap=0;part.stepRemaining=0;if(scene.activeActorId===part.id){scene.activeActorId=null;s.lastTeam=part.team;}s.grantedTurns=(s.grantedTurns||[]).filter(item=>item.actorId!==part.id);}} }
          else if(p.resource==="hp"&&compound.active){let remaining=amount;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}}
          else {target[p.resource] = amount;if(p.resource==="maxHp")target.hp=Math.min(target.hp,amount);}
          emit("actor.runtime.set", target.id, { resource: p.resource, value: amount, before, correction: true, note: p.note || "Ручное исправление" }); break;
        }
        case "effect": { const target = requiredActor(scene, p.targetId || sourceId, false); if (p.remove) removeEffect(target, p.effect); else applyEffect(target, p, sourceId); break; }
        case "move": move(requiredActor(scene, p.targetId || sourceId), p); break;
        case "modifier": {
          const target = requiredActor(scene, p.targetId || sourceId, false);
          if(p.remove){if(!["armor","evasion","speed"].includes(p.stat))fail("Неизвестный показатель");astate(target).modifiers=astate(target).modifiers.filter(m=>m.stat!==p.stat||(p.id&&m.id!==p.id));emit("modifier.remove",sourceId,p);break;}
          if (!["armor", "evasion", "speed"].includes(p.stat) || !Number.isInteger(p.amount) || Math.abs(p.amount) > 9999 || !["startTurn","endTurn","roundEnd","scene","manual"].includes(p.duration || "endTurn")) fail("Некорректный модификатор");
          astate(target).modifiers.push({ id: p.id || `${rootId}:modifier:${astate(target).modifiers.length}`, sourceActorId: sourceId, ownerActorId: p.ownerActorId || target.id, stat: p.stat, amount: p.amount, boundary: p.duration || "endTurn", appliedSerial: scene.turnSerial }); emit("modifier.configure", sourceId, p); break;
        }
        case "allow-action":{const target=requiredActor(scene,p.targetId||sourceId);if(!actionDef(p.actionId))fail("Неизвестное действие");astate(target).allowances||=[];astate(target).allowances.push({id:p.id||`${rootId}:allowance:${astate(target).allowances.length}`,actionId:p.actionId,swift:p.swift===true,reaction:p.reaction===true,cost:p.cost==null?undefined:integer(p.cost,"стоимость"),remaining:integer(p.uses??1,"применения",99),sourceActorId:sourceId});emit("action.allow",sourceId,p);break;}
        case "grant-turn":{const target=requiredActor(scene,p.targetId||sourceId);s.grantedTurns||=[];if(s.grantedTurns.length>=20)fail("Слишком много ожидающих Ходов");s.grantedTurns.push({actorId:target.id,sourceActorId:sourceId});emit("turn.grant",sourceId,{targetId:target.id});break;}
        case "usage":{if(typeof p.ruleId!=="string"||!p.ruleId||p.ruleId.length>180||!["turn","round","scene"].includes(p.scope))fail("Укажите правило и область лимита");const history=astate(a).history||[],used=history.filter(h=>h.ruleId===p.ruleId&&(p.scope==="scene"||p.scope==="round"&&h.round===scene.round||p.scope==="turn"&&h.turnSerial===scene.turnSerial));if(used.length>=integer(p.limit??1,"лимит",999))fail("Лимит применения правила исчерпан");if(p.oncePerTarget&&(p.targetIds||[]).some(id=>used.some(h=>h.targetIds.includes(id))))fail("Эта цель уже использована правилом");astate(a).history=[...history,{ruleId:p.ruleId,targetIds:copy(p.targetIds||[]),round:scene.round,turnSerial:scene.turnSerial}];emit("rule.used",sourceId,p);break;}
        case "punish":{const opportunity=(s.opportunities||[]).find(o=>o.id===p.id&&o.actorId===sourceId);if(!opportunity)fail("Окно Наказания уже закрыто");spend(a,"focus",2);const result=publishRoll(a,p.roll,"Наказание");if(result.initialCount!==Math.max(Number(a.attrs.body||0),Number(a.attrs.talent||0)))fail("Неверный пул Наказания");s.opportunities=s.opportunities.filter(o=>o.id!==p.id);beginAttack(a,{name:"Наказание",targetIds:[opportunity.targetId],amount:result.successes});break;}
        case "search": {const target=requiredActor(scene,p.targetId);if(scene.activeActorId!==a.id||target.team===a.team||!has(target,"positive.исчез"))fail("Поиск: на своём Ходу выберите Исчезнувшего противника");spend(a,"ap",2);removeEffect(target,"positive.исчез");break;}
        case "invisible":if(!has(a,"positive.невидим"))fail("Нет Невидимости");removeEffect(a,"positive.невидим");applyEffect(a,{effect:"positive.исчез",duration:"startTurn"},a.id);break;
        case "configure-resource": {
          if (!/^[a-zA-Z][\w.-]{0,79}$/.test(p.id || "") || ["constructor", "prototype", "__proto__"].includes(p.id)) fail("Некорректный ID ресурса");
          if(resources.has(p.id))fail("ID совпадает со встроенным показателем");
          const previousDefinition=a.ruleResources?.[p.id],value=integer(p.value??previousDefinition?.value??0,"ресурс"),rawMaximum=p.maximum===undefined?previousDefinition?.maximum:p.maximum,maximum=rawMaximum==null?null:integer(rawMaximum,"максимум");
          if(maximum!=null&&value>maximum)fail("Значение превышает максимум ресурса");
          if(p.replaces!=null&&p.replaces!=="focus")fail("Можно заменить только Фокус");
          if(p.replacesAp&&Object.entries(a.ruleResources||{}).some(([id,def])=>id!==p.id&&def.replacesAp))fail("ОД уже заменены другим ресурсом");
          if(p.replaces==="focus"&&Object.entries(a.ruleResources||{}).some(([id,def])=>id!==p.id&&def.replaces==="focus"))fail("Фокус уже заменён другим ресурсом");
          a.ruleResources ||= {}; const previous=a.ruleResources[p.id];
          a.ruleResources[p.id] = { resource: p.id, label: String(p.label || previous?.label || p.id).slice(0,100), value, maximum, replaces:p.replaces===undefined?previous?.replaces||null:p.replaces, replacesAp:p.replacesAp??previous?.replacesAp??false, inverted:p.inverted??previous?.inverted??false, ...counterPolicy(p,previous,maximum) }; emit("rule-resource.configure", sourceId, p); break;
        }
        case "counter": {
          const collection=p.type==="clock"?a.ruleClocks:p.type==="resource"?a.ruleResources:null;
          if(!collection||!Object.hasOwn(collection,p.id))fail("Счётчик не найден");
          const before=copy(collection[p.id]);
          if(p.operation==="remove")delete collection[p.id];
          else if(p.operation==="reset")collection[p.id].value=collection[p.id].initial??0;
          else fail("Неизвестная операция счётчика");
          emit(`rule-${p.type}.${p.operation}`,sourceId,{id:p.id,before,value:collection[p.id]?.value});break;
        }
        case "clock": {
          if (!/^[a-z][a-z0-9.-]{0,79}$/.test(p.id || "") || ["constructor", "prototype", "__proto__"].includes(p.id)) fail("ID часов: строчные латинские буквы, цифры, точка и дефис");
          if(!Object.hasOwn(a.ruleClocks||{},p.id)&&Object.keys(a.ruleClocks||{}).length>=30)fail("У участника уже 30 часов");
          a.ruleClocks ||= {}; const previous = a.ruleClocks[p.id], size = integer(p.size ?? previous?.size ?? 4, "размер часов", 100), value = integer(p.value ?? (Number(previous?.value || 0) + Number(p.delta || 0)), "сегменты", 100);
          if (!size || value > size) fail("Число сегментов выходит за размер часов");
          a.ruleClocks[p.id] = { clockId: p.id, label: String(p.label || previous?.label || p.id).slice(0,100), size, value, active: true, sourceActorId: sourceId, ...counterPolicy(p,previous,size) }; emit("rule-clock.set", sourceId, { ...p, size, value }); break;
        }
        case "roll": publishRoll(a, p.roll, p.label || "Бросок"); break;
        case "prompt": choice(requiredActor(scene,p.targetId||sourceId), "manual", String(p.title || "Решение правила").slice(0,240), ["record"], { ruleId: p.ruleId, text: String(p.text || "").slice(0,1200) }); break;
        case "choice": {
          const pending = s.choices[0];
          if (!pending || pending.id !== p.id || pending.actorId !== sourceId || !pending.options.includes(p.choice)) fail("Решение устарело или принадлежит другому участнику");
          s.choices.shift();
          if (pending.kind === "knockout") { if (p.choice === "resist") { a[pending.context.track] = 1; a.hp = a.maxHp; astate(a).vulnerable = true; } else knockout(a); }
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
            if (!has(a, "positive.устойчив")) {
              const d = { x: a.x + Math.sign(a.x - attacker.x), y: a.y + Math.sign(a.y - attacker.y) };
              try { movement(scene, a, d, { forced: true, maximum: 1, line: true }); move(a, { destination: d, forced: true, maximum: 1, line: true }); } catch { /* A push stops at an obstruction. */ }
            }
          }
          if (p.choice === "dodge") {
            const chosen = p.attribute || (a.attrs.talent >= a.attrs.mind ? "talent" : "mind");
            if (!["talent", "mind"].includes(chosen)) fail("Уворот использует Талант или Разум");
            const gain = Math.ceil(Number(a.attrs[chosen] || 0) / 2); a.evasion = Number(a.evasion || 0) + gain;
            if(!p.destination||distance(a,{...p.destination,space:a.space})===0)fail("Уворот требует движения");
            move(a, { destination: p.destination, maximum: scaledMove(a, 2) }); response.preventForcedMovement = true;
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
          if (!pending?.lionwing || pending.targetIds.some(id => live(actor(scene, id)) && !has(actor(scene,id),"positive.исчез") && pending.responses[id]?.choice === "pending")) fail("Сначала дождитесь всех Реакций");
          scene.pendingAction = null;
          const operations = [];
          for (let i = 0; i < pending.repeat; i++) for (const targetId of pending.targetIds) {
            if(has(actor(scene,targetId),"positive.исчез"))continue;
            const response = pending.responses[targetId] || {};
            operations.push({ kind: "damage", sourceActorId: pending.actorId, targetId, amount: pending.targetDamage?.[targetId]??pending.damage, attack: true, reduction: response.reduction || 0, temporaryArmor: response.temporaryArmor || 0, effects: pending.effects, finalDamage: pending.finalDamage, ignoreArmor:pending.ignoreArmor, ignoreEvasion:pending.ignoreEvasion, irreducible:pending.irreducible, preventForcedMovement:response.preventForcedMovement });
          }
          for(const tail of s.afterAttack||[]){
            if(tail.kind==="move"&&tail.forced&&pending.responses[tail.targetId||tail.sourceActorId]?.preventForcedMovement)emit("movement.prevented",pending.actorId,{targetId:tail.targetId||tail.sourceActorId,reason:"Уворот",attackId:pending.id});
            else operations.push(tail);
          } s.afterAttack = [];
          queue.unshift(...operations.map(p => ({ p, sourceId: pending.actorId })));
          emit("attack.clear", pending.actorId, { name: pending.name }); break;
        }
        case "amend-attack": {
          const pending=scene.pendingAction;if(!pending?.lionwing||s.choices.length)fail("Изменение Атаки доступно до разрешения и вне ожидающего решения");
          const targets=targetIds(scene,p.targetIds||pending.targetIds);if(!targets.length)fail("Выберите цели Атаки");
          for(const id of targets){const target=requiredActor(scene,id);if(has(target,"positive.исчез"))fail("Цель отсутствует на поле");}
          const targetDamage=p.targetDamage||{};for(const[id,value]of Object.entries(targetDamage)){if(!targets.includes(id))fail("Урон указан для посторонней цели");integer(value,"урон цели");}
          pending.targetIds=targets;pending.damage=integer(p.amount??pending.damage,"урон");pending.targetDamage=copy(targetDamage);
          pending.responses=Object.fromEntries(targets.map(id=>[id,pending.responses[id]||{choice:"pending"}]));
          for(const key of ["ignoreArmor","ignoreEvasion","irreducible","finalDamage"])if(p[key]!==undefined)pending[key]=p[key]===true;
          emit("attack.amend",sourceId,{targetIds:targets,amount:pending.damage,targetDamage});break;
        }
        case "pause-chain": {
          if(!scene.pendingAction&&!s.choices.length)fail("Нет ожидающей цепочки");
          s.pausedChains||=[];if(s.pausedChains.length>=8)fail("Слишком много вложенных цепочек");
          s.pausedChains.push({pendingAction:scene.pendingAction,choices:s.choices,deferred:s.deferred,afterAttack:s.afterAttack||[]});
          scene.pendingAction=null;s.choices=[];s.deferred=[];s.afterAttack=[];emit("chain.pause",sourceId,{depth:s.pausedChains.length});break;
        }
        case "resume-chain": {
          if(scene.pendingAction||s.choices.length||s.deferred.length)fail("Сначала завершите вложенное решение");
          const previous=s.pausedChains?.pop();if(!previous)fail("Нет приостановленной цепочки");
          scene.pendingAction=previous.pendingAction;s.choices=previous.choices;s.deferred=previous.deferred;s.afterAttack=previous.afterAttack;
          emit("chain.resume",sourceId,{depth:s.pausedChains.length});break;
        }
        case "cancel-attack": scene.pendingAction = null; s.afterAttack = []; emit("attack.clear", sourceId, { cancelled: true }); break;
        case "turn-start": {
          const status = turnStartStatus(scene, sourceId); if (!status.available) fail(status.reason);
          if(s.grantedTurns?.length){s.grantedTurns.shift();astate(a).grantedTurn={lastTeam:s.lastTeam,lastActorId:s.lastActorId,acted:a.acted};}
          if (!s.started) { s.started = true; for (const hero of scene.actors.filter(isPlayer)) hero.focus = 1 + Math.ceil(Number(hero.attrs.spirit || 0) / 2); for (const other of scene.actors) other.ap = 0; }
          scene.activeActorId = a.id; scene.turnSerial = Number(scene.turnSerial || 0) + 1; astate(a).turns = Number(astate(a).turns || 0) + 1; astate(a).turnActions = []; astate(a).startedDisappeared = has(a, "positive.исчез");
          a.ap = Math.max(0, Number(a.baseAp ?? 3) - (has(a, "negative.ошеломлен") ? 1 : 0)); a.stepRemaining = 0; s.breakout = null; s.opportunities = [];
          phase("startTurn", a);
          const duel=(s.duels||[]).find(item=>item.id===astate(a).duelId);
          if(duel&&scene.turnSerial>duel.startedSerial){
            scene.activeSpace=duel.returnSpaceId;
            duelOutcome(duel);
          }
          if (has(a, "negative.подброшен")) removeEffect(a, "negative.подброшен");
          if (astate(a).startedDisappeared&&!s.choices.some(c=>c.actorId===a.id&&c.kind==="placement"&&c.context.reappear)) { if (has(a, "positive.исчез")) removeEffect(a, "positive.исчез",{reappear:false}); choice(a, "placement", "Выберите клетку появления вне соседства с персонажами", ["place"], { reappear: true }); }
          emit("turn.start", a.id, { ap: a.ap }); break;
        }
        case "turn-end": {
          if (scene.activeActorId !== sourceId || scene.pendingAction || s.choices.length || s.pausedChains?.length) fail("Нельзя завершить этот Ход: есть незавершённое действие");
          if (has(a, "positive.регенерирует")) applyHealing({targetId:a.id,amount:4+Number(a.tier||1)},a.id);
          phase("endTurn", a); a.ap = 0; a.stepRemaining = 0; a.acted = true; scene.activeActorId = null; s.lastTeam = a.team; s.lastActorId = a.id; s.breakout = { actorId: a.id, turnSerial: scene.turnSerial }; s.opportunities = [];
          if(astate(a).grantedTurn){const resume=astate(a).grantedTurn;s.lastTeam=resume.lastTeam;s.lastActorId=resume.lastActorId;a.acted=resume.acted;delete astate(a).grantedTurn;}
          emit("turn.end", a.id); break;
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
            target.effects=(target.effects||[]).filter(effect=>target.effectStates?.[effect]?.duration==="persistent");
            target.effectStates=Object.fromEntries(target.effects.map(effect=>[effect,target.effectStates[effect]]));
            target.lionwing={};
          }
          scene.lionwing={schema:1,started:false,choices:[],deferred:[],receipts:s.receipts};
          scene.round=1;scene.turnSerial=0;scene.tension=0;scene.activeActorId=null;scene.targetIds=[];scene.targetCells=[];scene.results=null;
          scene.pendingAction=null;scene.pendingPrompt=null;scene.pendingActionPlan=null;scene.triggerQueue=[];scene.opposedRoll=null;scene.challengeRequest=null;scene.turnUndo=[];
          scene.objects=scene.objects.filter(item=>item.duration==="persistent");scene.markers=scene.markers.filter(item=>item.duration==="persistent");
          scene.reminders=[];
          if(p.clearTable){scene.actors=[];scene.selectedActor=null;}
          emit("scene.reset",sourceId,{clearTable:Boolean(p.clearTable)});break;
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
    const duelPreparation=s.choices[0]?.kind==="duel-outcome"&&["roll","resource"].includes(request.kind)&&(s.duels||[]).some(duel=>duel.id===s.choices[0].context.duelId&&[duel.actorId,duel.targetId].includes(request.targetId||event.actorId));
    if (s.choices.length && !duelPreparation && !["choice", "correct", "note", "tension", "pause-chain"].includes(request.kind)) fail("Сначала ответьте на ожидающее решение");
    if (scene.pendingAction && !["reaction", "resolve-attack", "cancel-attack", "correct", "note", "choice", "tension","invisible","pause-chain","amend-attack"].includes(request.kind)) fail("Сначала завершите Атаку");
    const operations = request.kind === "batch" ? request.operations : [request];
    if (!Array.isArray(operations) || !operations.length || operations.length > 192 || operations.some(p => !p || p.kind === "batch")) fail("Некорректный пакет операций");
    for(const p of operations){
      if(!api.operations.includes(p.kind))fail("Неизвестная публичная операция LionWing");
      if(p.targetId)requiredActor(scene,p.targetId,false);
      if(["damage","heal","resource","correct","tension"].includes(p.kind))integer(p.amount,"количество");
      if(p.kind==="resource"&&!["spend","gain"].includes(p.operation))fail("Неизвестная операция ресурса");
      if(p.kind==="effect"&&!effectIds.has(p.effect))fail("Неизвестный Эффект LionWing");
    }
    const queue = operations.map(p => ({ p, sourceId: p.sourceActorId ?? event.actorId }));
    if (request.kind === "choice") queue.push(...s.deferred.splice(0));
    while (queue.length) {
      const item = queue.shift(); op(item.p, item.sourceId);
      if (s.choices.length) { s.deferred.push(...queue); break; }
      if(scene.pendingAction&&["attack","action","punish"].includes(item.p.kind)&&queue.length){s.afterAttack=[...(s.afterAttack||[]),...queue.map(item=>({...item.p,sourceActorId:item.sourceId}))];break;}
    }
    output.push(...emitted);
  }

  const sharedTypes = new Set(["movement-traces.clear", "topology.cells.remove", "topology.cells.restore", "roll.public", "challenge.request", "challenge.clear", "opposed.request", "opposed.reroll", "opposed.tie.resolve", "opposed.clear", "rule.share", "session-clock.create", "session-clock.set", "session-clock.rename", "session-clock.kind", "session-clock.size", "session-clock.remove", "reminder.create", "reminder.due", "reminder.resolve", "reminder.remove", "actor.spawn", "actor.despawn", "area.create", "area.remove", "area.duration", "object.damage", "object.restore", "wall.create", "wall.damage", "wall.restore", "wall.remove", "marker.create", "marker.move", "marker.remove", "marker.duration", "targets.set", "space.ensure", "space.remove"]);
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
      } else { execute(next, event, output); next.version = Number(next.version || 0) + 1; }
      state(next).receipts.push({ id: event.id, fingerprint }); state(next).receipts = state(next).receipts.slice(-256);
    }
    return { scene: next, events: output, event: output[output.length - 1] };
  }
  function previewEvents(scene, events, options = {}) {
    try { return { ok: true, ...dispatchMany(scene, events, options), errors: [] }; }
    catch (error) { return { ok: false, errors: [error.message], code: error.code || "LIONWING_RULE_BLOCKED" }; }
  }
  const api = { schema: 1, isScene, prepare, command, dispatchMany, previewEvents, turnStartStatus, roundEndStatus, movement, roll, actionStatus, actionDef, speed, balance, canSpend, targetIds, operations: ["batch", "pause-chain", "resume-chain", "amend-attack", "recover-track", "record-action", "action", "attack", "damage", "heal", "wound", "stress", "knockout", "resource", "correct", "effect", "move", "modifier", "allow-action", "grant-turn", "usage", "punish", "invisible", "search", "configure-resource", "counter", "clock", "prompt", "choice", "roll", "reaction", "resolve-attack", "cancel-attack", "turn-start", "turn-end", "round-end", "scene-reset", "tension", "note"] };
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
    const eligibleIds = targets.filter(id => live(actor(scene, id)) && !has(actor(scene, id), "positive.исчез"));
    const waitingIds = eligibleIds.filter(id => pending.responses[id]?.choice === "pending");
    return { eligibleIds, waitingIds, answeredIds: eligibleIds.filter(id => !waitingIds.includes(id)), unavailableIds: targets.filter(id => !eligibleIds.includes(id)), mustCancel: Boolean(pending && !eligibleIds.length), interruptedReason: "Все цели недоступны" };
  });
  route("availableEnemyRules", () => []);
  route("projectScene",(scene,viewer={})=>{
    const projected=legacy.projectScene(scene,viewer);
    if(!["owner","narrator","gm"].includes(viewer.role)){
      delete projected.turnUndo;
      const hidden=new Set(scene.actors.filter(a=>a.hidden).map(a=>a.id));
      for(const duel of scene.lionwing?.duels||[])if(hidden.has(duel.actorId)||hidden.has(duel.targetId))hidden.add(duel.id);
      const refersToHidden=value=>typeof value==="string"?hidden.has(value):value&&typeof value==="object"?Object.entries(value).some(([key,item])=>hidden.has(key)||refersToHidden(item)):false;
      projected.log=(projected.log||[]).filter(row=>!refersToHidden(row));
      if(projected.lionwing){
        delete projected.lionwing.pausedChains;delete projected.lionwing.receipts;delete projected.lionwing.deferred;delete projected.lionwing.afterAttack;
        for(const key of ["choices","duels","opportunities","grantedTurns"])projected.lionwing[key]=(projected.lionwing[key]||[]).filter(item=>!refersToHidden(item));
      }
      if(projected.pendingAction?.targetDamage)projected.pendingAction.targetDamage=Object.fromEntries(Object.entries(projected.pendingAction.targetDamage).filter(([id])=>!hidden.has(id)));
    }
    return projected;
  });
})(typeof window === "object" ? window : globalThis);
