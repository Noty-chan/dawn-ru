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
  const lifetimes = new Set(["default", "startTurn", "endTurn", "nextTurn", "roundEnd", "scene", "persistent", "manual"]);
  const actionDef = id => core.actions.list.find(item => item.id === id);
  const nameOf = id => actionDef(id)?.name || id;
  const command = (actorId, payload) => ({ type: "lionwing.command", actorId, payload });
  const stat = (a, key) => Math.max(0, Number(a[key] || 0) + (a.lionwing?.modifiers || []).filter(m => m.stat === key).reduce((sum, m) => sum + (key==="evasion"?m.remaining??m.amount:m.amount), 0));
  const scaledMove = (a, amount) => Math.ceil(amount * (has(a, "positive.ускорен") ? 2 : 1) / (has(a, "negative.замедлен") ? 2 : 1));
  const speed = a => scaledMove(a, stat(a, "speed"));
  const unavailable = reason => ({ available: false, reason });

  function turnStartStatus(scene, id) {
    const a = actor(scene, id), s = state(copy(scene));
    if (!live(a) || a.kind === "crowd" || String(a.profileId || "").includes(".modifier.")) return unavailable("Этот участник не может совершать Ход");
    if (scene.pendingAction || s.choices?.length) return unavailable("Сначала завершите действие и ожидающие решения");
    if (scene.activeActorId) return unavailable("Сначала завершите текущий Ход");
    if(s.grantedTurns?.length)return s.grantedTurns[0].actorId===id?{available:true,reason:""}:unavailable("Сначала должен пройти предоставленный дополнительный Ход");
    const heroes = scene.actors.filter(x => live(x) && isPlayer(x)), enemies = scene.actors.filter(x => live(x) && x.team === "enemy" && x.kind !== "crowd" && !String(x.profileId || "").includes(".modifier."));
    const expected = s.lastTeam === "hero" && enemies.length ? "enemy" : heroes.length ? "hero" : "enemy";
    if (a.team !== expected) return unavailable(`Сейчас Ход ${expected === "hero" ? "героев" : "противников"}`);
    if (isPlayer(a) && a.acted || a.team === "enemy" && a.acted && enemies.some(x => !x.acted)) return unavailable("Этот участник уже ходил; выберите ещё не ходившего");
    if (has(a, "negative.подброшен") && scene.actors.some(x => live(x) && x.id !== id && x.team === a.team && !x.acted && !has(x, "negative.подброшен"))) return unavailable("Сначала должен походить доступный союзник: участник Подброшен");
    return { available: true, reason: "" };
  }

  function roundEndStatus(scene) {
    const s = state(copy(scene));
    if (scene.activeActorId || scene.pendingAction || s.choices?.length) return unavailable("Сначала завершите Ход и ожидающие решения");
    const heroes = scene.actors.filter(a => live(a) && isPlayer(a));
    if (heroes.some(a => !a.acted)) return unavailable("Не все герои совершили Ход");
    if (heroes.length && scene.actors.some(a => live(a) && a.team === "enemy" && a.kind !== "crowd") && s.lastTeam !== "enemy") return unavailable("После последнего героя должен походить противник");
    return s.started ? { available: true, reason: "" } : unavailable("Бой ещё не начат");
  }

  function movement(scene, a, destination, options = {}) {
    const board = scene.spaces.find(s => s.id === (destination?.space || a.space));
    if (!board || !Number.isInteger(destination?.x) || !Number.isInteger(destination?.y) || destination.x < 0 || destination.y < 0 || destination.x >= board.width || destination.y >= board.height) fail("Выберите клетку внутри поля");
    if (!options.placement && board.id !== a.space && !options.teleport) fail("Это движение не меняет пространство");
    if (!options.placement && !options.forced && (has(a, "negative.обездвижен") || has(a, "negative.подброшен") || has(a, "negative.пойман") && (a.effectStates?.["negative.пойман"]?.sources || []).some(s => live(actor(scene, s.actorId))))) fail("Эффект запрещает добровольное движение");
    if (options.forced && has(a, "positive.устойчив")) fail("Устойчивость запрещает принудительное движение");
    const key = p => `${p.x},${p.y}`;
    const terrain = new Set(scene.objects.filter(o => o.space === board.id && o.type === "terrain").flatMap(o => o.cells || []));
    const difficult = new Set(scene.objects.filter(o => o.space === board.id && o.type === "difficult").flatMap(o => o.cells || []));
    const occupied = scene.actors.filter(x => x.id !== a.id && (!a.compoundId||x.compoundId!==a.compoundId) && x.space === board.id && live(x) && !has(x, "positive.исчез") && has(a, "positive.изгнан") === has(x, "positive.изгнан"));
    const blocked = p => terrain.has(key(p));
    if (blocked(destination) || board.mode !== "cinematic" && occupied.some(x => x.x === destination.x && x.y === destination.y)) fail("Клетка занята");
      if (options.placement || options.teleport) {if(options.teleport&&options.maximum!=null&&distance(a,{...destination,space:board.id})>options.maximum)fail("Телепортация выходит за дальность");return { cost: 0, path: [{ x: destination.x, y: destination.y }], space: board.id };}
    const maximum = integer(options.maximum ?? 99, "дальность", 999);
    const crossesWall = (from, to) => typeof wallBlocksStep === "function" && wallBlocksStep(scene, a.space, from, to);
    if (options.line) {
      const dx = destination.x - a.x, dy = destination.y - a.y;
      if (dx && dy && Math.abs(dx) !== Math.abs(dy)) fail("Нужна прямая ортогональная или диагональная Линия");
      const cost = Math.max(Math.abs(dx), Math.abs(dy)), path = [];
      if (!cost || cost > maximum) fail("Клетка вне дальности движения");
      let from = a;
      for (let i = 1; i <= cost; i++) {
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
        const cost = p.cost + (difficult.has(key(q)) || foe && board.mode === "cinematic" ? 2 : 1);
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
    const breakout = request.breakout === true;
    if (breakout) {
      if (!scene.lionwing?.breakout || scene.lionwing.breakout.actorId === a.id || attacks.has(def.id)) return unavailable("Прорыв: только не-Атака после чужого Хода");
      if (Number(a.influence || 0) < 1) return unavailable("Для Прорыва нужно 1 Влияние");
    } else if (scene.activeActorId !== a.id) return unavailable("Сейчас не Ход этого участника");
    const allowance=(a.lionwing?.allowances||[]).find(item=>item.actionId===def.id&&item.remaining>0);
    const swift = breakout || Boolean(allowance?.swift) || !isPlayer(a) && def.id === ids.step;
    const continuation = def.id === ids.step && Number(a.stepRemaining || 0) > 0 && !breakout;
    if (continuation) return { available: true, reason: "", cost: 0, resource: "ap", continuation: true };
    const used = isPlayer(a) ? (a.usedActions || []) : (a.lionwing?.turnActions || []);
    if (!swift && used.includes(def.id)) return unavailable("Действие уже использовано");
    const cost = breakout ? 0 : allowance?.cost??(def.id === "action.атаки.дуэль" ? Math.max(1, 4 - Number(scene.tension || 0)) : def.id===ids.improvise&&request.removeObstacleId?1:def.cost.amount);
    if (Number(a[def.cost.resource] || 0) < cost) return unavailable(`Недостаточно ${def.cost.resource === "ap" ? "ОД" : "ресурса"}: нужно ${cost}`);
    if (def.id === ids.disappear) {
      const board = scene.spaces.find(b => b.id === a.space);
      if (!board || ![0, board.width - 1].includes(a.x) && ![0, board.height - 1].includes(a.y) || a.lionwing?.startedDisappeared) return unavailable("Скрыться можно на краю поля, если Ход начат без Исчезновения");
    }
    return { available: true, reason: "", cost, resource: def.cost.resource, swift,allowanceId:allowance?.id };
  }

  function roll(count, random = Math.random) {
    integer(count, "число костей", 100);
    const rolls = [], queue = Array(count).fill(0);
    while (queue.length) {
      queue.pop();
      if (rolls.length >= 300) fail("Слишком длинная цепочка критов; повторите бросок");
      const die = 1 + Math.floor(random() * 6);
      if (die < 1 || die > 6) fail("Некорректный источник случайности");
      rolls.push(die); if (die === 6) queue.push(0);
    }
    return { initialCount: count, rolls, successes: rolls.filter(v => v >= 4).length, crits: rolls.filter(v => v === 6).length, formula: `${count}D6` };
  }

  function validateRoll(value) {
    if (!value || !Array.isArray(value.rolls) || value.rolls.length > 300 || value.rolls.some(v => !Number.isInteger(v) || v < 1 || v > 6)) fail("Некорректный бросок");
    const crits = value.rolls.filter(v => v === 6).length;
    if (value.rolls.length !== integer(value.initialCount, "исходный пул", 100) + crits) fail("Бросок содержит незавершённые или лишние кости");
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
      const payload = copy(request), a = requiredActor(scene, payload.actorId, !["choice", "correct", "resolve-attack", "cancel-attack", "batch"].includes(payload.kind));
      delete payload.actorId;
      if (payload.kind === "action") {
        const def = actionDef(payload.actionId);
        if (!def) fail("Базовое действие не найдено");
        const status = actionStatus(scene, a, def, payload);
        if (!status.available) fail(status.reason);
        if ([ids.charge, ids.spell, ids.skirmish, ids.finish].includes(def.id) && !payload.roll){const pools=attackPools(scene,a,def,payload);payload.roll=roll(pools.base,options.random);payload.targetRolls={};for(const[id,count]of Object.entries(pools.counts))if(count>pools.base)payload.targetRolls[id]=roll(count-pools.base,options.random);}
      }
      if (payload.kind === "roll" && !payload.roll) payload.roll = roll(integer(payload.count, "число костей", 100), options.random);
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
      const events = [command(a.id, payload)], preview = previewEvents(scene, events);
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
    const removeEffect = (a, effect) => { a.effects = (a.effects || []).filter(e => e !== effect); if (a.effectStates) delete a.effectStates[effect]; emit("effect.remove", a.id, { targetId: a.id, effect }); };
    const choice = (a, kind, title, options, context = {}) => { s.choices.push({ id: `${rootId}:choice:${s.choices.length}`, actorId: a.id, kind, title, options, context }); };
    const knockout = a => {
      if (a.knockedOut) return;
      a.knockedOut = true; a.ap = 0; a.stepRemaining = 0;
      if (scene.activeActorId === a.id) { scene.activeActorId = null; a.acted = true; s.lastTeam = a.team; s.lastActorId = a.id; }
      if (!s.lowTension) scene.tension = Number(scene.tension || 0) + 1;
      for (const other of scene.actors) for (const e of ["negative.испуган", "negative.спровоцирован"]) if ((other.effectStates?.[e]?.sources || []).some(source => source.actorId === a.id)) removeEffect(other, e);
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
      const duration = p.duration || (persistent.has(p.effect) ? "scene" : p.effect === "positive.изгнан" ? "startTurn" : a.compoundId?"roundEnd":"default");
      if (!lifetimes.has(duration)) fail("Неизвестный срок Эффекта");
      if (p.effect === "positive.изгнан") for (const other of scene.actors) if (other.id !== a.id && (other.effectStates?.[p.effect]?.sources || []).some(source => source.actorId === sourceId)) removeEffect(other, p.effect);
      a.effects = [...new Set([...(a.effects || []), p.effect])];
      a.effectStates ||= {};
      a.effectStates[p.effect] = { duration, removable: true, appliedTurnSerial: Number(scene.turnSerial || 0), appliedRound: scene.round, appliedEventId: rootId, sources: sourceId ? [{ actorId: sourceId, actionId: p.sourceActionId || "", eventId: rootId }] : [] };
      astate(a).effectLifetimes ||= {};
      astate(a).effectLifetimes[p.effect] = { ownerActorId: p.ownerActorId || a.id, duration, appliedSerial: Number(scene.turnSerial || 0), appliedRound: scene.round };
      emit("effect.apply", sourceId, { targetId: a.id, effect: p.effect, duration });
      if(a.compoundId&&!p.compoundCopy)for(const part of scene.actors.filter(x=>x.id!==a.id&&x.compoundId===a.compoundId))applyEffect(part,{...p,compoundCopy:true,duration},sourceId);
      if (p.effect === "negative.пойман" && sourceId && distance(a, requiredActor(scene, sourceId)) > 1) choice(a, "placement", "Пойман: выберите клетку рядом с источником", ["place"], { adjacentTo: sourceId, forced: true });
    };
    const applyDamage = p => {
      const a = requiredActor(scene, p.targetId, false);
      if (a.knockedOut) { emit("damage.apply", p.sourceActorId, { ...p, dealt: 0, ignored: true }); return; }
      const source = actor(scene, p.sourceActorId), raw = integer(p.amount, "урон"), attack = p.attack === true;
      const compound=legacy.compoundEnemyStatus(scene,a),defender=compound.active?compound.parts.reduce((best,x)=>stat(x,compound.defenseType)>stat(best,compound.defenseType)?x:best,compound.parts[0]):a;
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
      let dealt = Math.max(0, afterArmor - evaded);
      if (attack && dealt > 0 && !p.irreducible && !p.finalDamage && has(a, "negative.помечен")) { dealt += Number(a.tier || 1); removeEffect(a, "negative.помечен"); }
      if(compound.active){const nextGate=Math.max(0,(Math.ceil(compound.hp/compound.gate-1e-9)-1)*compound.gate);dealt=Math.min(dealt,Math.max(0,compound.hp-nextGate));let remaining=compound.hp-dealt;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}if(dealt>0&&compound.hp-dealt===nextGate&&nextGate>0)scene.tension++;}
      else a.hp = Math.max(0, Number(a.hp) - dealt);
      emit("damage.apply", p.sourceActorId, { ...p, raw, armor, evaded, dealt, hp: a.hp });
      if (dealt > 0 && (compound.active?compound.hp-dealt<=0:a.hp===0)) { if (isPlayer(a)) wound(a, p.sourceActorId); else {knockout(a);if(compound.active)for(const part of compound.parts){part.knockedOut=true;part.ap=0;}} }
      if (!(attack && afterArmor > 0 && evaded === afterArmor) && !a.knockedOut) for (const e of p.effects || []) applyEffect(a, typeof e === "string" ? { effect: e } : e, p.sourceActorId);
    };
    const move = (a, p) => {
      const result = movement(scene, a, p.destination || p, p), from = { x: a.x, y: a.y, space: a.space };
      a.x = (p.destination || p).x; a.y = (p.destination || p).y; a.space = result.space;
      if(a.compoundId)for(const part of scene.actors.filter(x=>x.compoundId===a.compoundId)){part.x=a.x;part.y=a.y;part.space=a.space;}
      emit("actor.move", a.id, { ...p, from, x: a.x, y: a.y, space: a.space, path: result.path, distance: result.cost });
      // A typed notification is also useful when the Technique itself is manual.
      if (!p.placement && !p.forced) for (const foe of scene.actors.filter(x => live(x) && x.team !== a.team)) if (distance({ ...a, ...from }, foe) <= 1 && distance(a, foe) > 1) {
        s.opportunities ||= []; s.opportunities.push({ id: `${rootId}:punish:${foe.id}`, actorId: foe.id, targetId: a.id, turnSerial: scene.turnSerial });
        emit("reaction.offer", foe.id, { targetId: a.id, actionId: "action.защита.наказание", name: "Наказание" });
      }
      return result;
    };
    const spend = (a, resource, amount) => {
      integer(amount, "расход");
      const balance = resources.has(resource) ? Number(a[resource] || 0) : Number(a.ruleResources?.[resource]?.value || 0);
      if (balance < amount) fail(`Недостаточно ${resource}: нужно ${amount}, доступно ${balance}`);
      if (resources.has(resource)) a[resource] = balance - amount;
      else if (a.ruleResources?.[resource]) a.ruleResources[resource].value = balance - amount;
      else fail("Ресурс не настроен");
      emit("resource.spend", a.id, { resource, amount });
    };
    const phase = (boundary, owner) => {
      for (const a of scene.actors) {
        for (const effect of [...(a.effects || [])]) {
          const saved = a.effectStates?.[effect], life = a.lionwing?.effectLifetimes?.[effect] || { duration: saved?.duration || (persistent.has(effect) ? "scene" : "default"), ownerActorId: a.id, appliedSerial: saved?.appliedTurnSerial ?? -1, appliedRound: saved?.appliedRound ?? 0 };
          const due = boundary === "roundEnd" && life.duration === "roundEnd" || life.ownerActorId === owner?.id && (boundary === "startTurn" && ["startTurn", "nextTurn"].includes(life.duration) || boundary === "endTurn" && ["default", "endTurn"].includes(life.duration) && scene.turnSerial > life.appliedSerial);
          if (due) removeEffect(a, effect);
        }
        astate(a).modifiers = (astate(a).modifiers || []).filter(m => !(m.boundary === boundary && (boundary === "roundEnd" || m.ownerActorId === owner?.id) && scene.turnSerial > m.appliedSerial));
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
      scene.pendingAction = { id: rootId, lionwing: true, actorId: a.id, name: p.name || "Атака", targetIds: targets, damage: integer(p.amount, "урон"), repeat: integer(p.repeat ?? 1, "повторы", 30), effects: copy(p.effects || []), finalDamage: Boolean(p.finalDamage), responses: Object.fromEntries(targets.map(id => [id, { choice: "pending" }])), sourceActionId: p.actionId || "manual.attack" };
      if(p.targetDamage)scene.pendingAction.targetDamage=copy(p.targetDamage);
      if (!scene.pendingAction.repeat) fail("Нужно хотя бы одно нанесение урона");
      emit("attack.pending", a.id, scene.pendingAction);
    };
    const performAction = (a, p) => {
      const def = actionDef(p.actionId);
      if (!def) fail("Неизвестное базовое действие");
      const status = actionStatus(scene, a, def, p);
      if (!status.available) fail(status.reason);
      if (has(a, "positive.исчез")) {
        if (!p.reappearance) fail("Сначала выберите клетку появления");
        if (scene.actors.some(x => live(x) && x.id !== a.id && distance({ ...p.reappearance, space: a.space }, x) <= 1)) fail("Появление запрещено рядом с персонажем");
        removeEffect(a, "positive.исчез"); move(a, { destination: p.reappearance, placement: true });
      }
      const targets = [...new Set(p.targetIds || [])].map(id => requiredActor(scene, id));
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
      astate(a).history = [...(astate(a).history || []), { actionId: def.id, targetIds: targets.map(t => t.id), round: scene.round, turnSerial: scene.turnSerial, swift: Boolean(status.swift) }].slice(-200);
      emit("action.resolve", a.id, { actionId: def.id, name: def.name, targetIds: targets.map(t => t.id) });
      let result;
      if ([ids.spell, ids.skirmish, ids.finish, ids.charge].includes(def.id)) {
        result = publishRoll(a, p.roll, def.name);
        const pools=attackPools(scene,a,def,p);if(result.initialCount!==pools.base)fail("Пул броска не соответствует действию");
        p.targetDamage={};for(const[id,count]of Object.entries(pools.counts)){let extra=0;if(count>pools.base){const extraRoll=publishRoll(a,p.targetRolls?.[id],`Дополнительные кости: ${actor(scene,id).name}`);if(extraRoll.initialCount!==count-pools.base)fail("Неверный дополнительный пул");extra=extraRoll.successes;}p.targetDamage[id]=result.successes+extra+(def.id===ids.finish?Number(scene.tension||0):0);}
        for(const id of p.spikeTargetIds||[])if(targets.some(t=>t.id===id)&&has(actor(scene,id),"negative.подброшен"))removeEffect(actor(scene,id),"negative.подброшен");
      }
      if ([ids.spell, ids.skirmish, ids.finish].includes(def.id)) beginAttack(a, { ...p, name: def.name, amount: result.successes + (def.id === ids.finish ? Number(scene.tension || 0) : 0) });
      else if (def.id === ids.charge || def.id === ids.breathe) { const amount = def.id === ids.charge ? Math.max(2, result.successes) : 1; a.focus = Number(a.focus || 0) + amount; emit("resource.gain", a.id, { resource: "focus", amount }); }
      else if (def.id === ids.step) { if (!status.continuation) a.stepRemaining = speed(a); if (p.destination) a.stepRemaining -= move(a, { destination: p.destination, maximum: a.stepRemaining }).cost; }
      else if (def.id === ids.jump) move(a, { destination: p.destination, maximum: scaledMove(a, Number(a.attrs.talent || 0)), line: true, ignoreOpponents: true });
      else if (def.id === ids.shove) move(targets[0], { destination: p.destination, maximum: 1, forced: true });
      else if (def.id === ids.disappear) applyEffect(a, { effect: "positive.исчез", duration: "startTurn" }, a.id);
      else if (def.id === ids.study) { applyEffect(targets[0], { effect: "negative.помечен" }, a.id); emit("rule.prompt", a.id, { targetId: targets[0].id, title: "Нарратор раскрывает выбранный параметр NPC", category: p.category || "health" }); }
      else if (def.id === ids.improvise) {
        if (p.effect) { if (targets.length !== 1 || distance(a, targets[0]) > 1 || p.effect === "positive.изгнан") fail("Импровизация: соседняя цель и Эффект кроме Изгнания"); applyEffect(targets[0], { effect: p.effect }, a.id); }
        else { const d = p.destination; if (!d || distance(a, { ...d, space: a.space }) !== 1) fail("Выберите соседнюю клетку препятствия"); movement(scene, a, d, { placement: true }); scene.objects.push({ id: `${rootId}:obstacle`, type: "terrain", label: "Препятствие", space: a.space, cells: [`${d.x},${d.y}`], hp: 10, maxHp: 10, duration: "scene", ownerActorId: a.id }); }
      } else if (def.id === "action.атаки.дуэль") choice(a, "manual", "Дуэль: разрешите исход по карточке и внесите последствия общими операциями", ["record"], { targetIds: p.targetIds, ruleId: def.id });
      if (attacks.has(def.id) && has(a, "negative.порчен")) s.afterAttack = [{ kind: "damage", targetId: a.id, amount: Number(a.tier || 1), sourceActorId: a.id, irreducible: true }];
    };

    function op(p, sourceId) {
      const a = sourceId ? requiredActor(scene, sourceId, false) : null;
      switch (p.kind) {
        case "action": performAction(requiredActor(scene, sourceId), p); break;
        case "attack": if (p.cost) spend(requiredActor(scene, sourceId), p.cost.resource || "ap", integer(p.cost.amount, "стоимость")); beginAttack(requiredActor(scene, sourceId), p); break;
        case "damage": applyDamage({ ...p, sourceActorId: Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId }); break;
        case "heal": { const target = requiredActor(scene, p.targetId || sourceId); const amount = integer(p.amount, "лечение"),compound=legacy.compoundEnemyStatus(scene,target),before=compound.active?compound.hp:target.hp;let after;if(compound.active){after=Math.min(Math.ceil(compound.hp/compound.gate)*compound.gate,compound.hp+amount);let remaining=after;for(const part of compound.parts){part.hp=Math.min(part.maxHp,remaining);remaining-=part.hp;}}else{target.hp=Math.min(target.maxHp,target.hp+amount);after=target.hp;}emit("actor.heal",sourceId,{targetId:target.id,amount,restored:after-before});break; }
        case "wound": wound(requiredActor(scene, p.targetId || sourceId), Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId); break;
        case "stress": wound(requiredActor(scene, p.targetId || sourceId), Object.hasOwn(p,"sourceActorId")?p.sourceActorId:sourceId, "stress"); break;
        case "knockout": knockout(requiredActor(scene, p.targetId || sourceId)); break;
        case "resource": {
          const target = requiredActor(scene, p.targetId || sourceId, false), amount = integer(p.amount, "ресурс");
          if (p.operation === "spend") spend(target, p.resource, amount);
          else { if (!resources.has(p.resource) && !target.ruleResources?.[p.resource]) fail("Сначала настройте ресурс"); if (resources.has(p.resource)) target[p.resource] = Number(target[p.resource] || 0) + amount; else target.ruleResources[p.resource].value += amount; emit("resource.gain", target.id, p); }
          break;
        }
        case "correct": {
          const target = requiredActor(scene, p.targetId || sourceId, false);
          if (!resources.has(p.resource) && !attributes.has(p.resource) && p.resource !== "knockedOut") fail("Это поле нельзя исправить");
          const amount = integer(p.amount, "новое значение"), before = attributes.has(p.resource) ? target.attrs[p.resource] : target[p.resource];
          if (attributes.has(p.resource)) target.attrs[p.resource] = amount;
          else if (p.resource === "knockedOut") { target.knockedOut = Boolean(amount); if (target.knockedOut && scene.activeActorId === target.id) scene.activeActorId = null; }
          else target[p.resource] = amount;
          emit("actor.runtime.set", target.id, { resource: p.resource, value: amount, before, correction: true, note: p.note || "Ручное исправление" }); break;
        }
        case "effect": { const target = requiredActor(scene, p.targetId || sourceId, false); if (p.remove) removeEffect(target, p.effect); else applyEffect(target, p, sourceId); break; }
        case "move": move(requiredActor(scene, p.targetId || sourceId), p); break;
        case "modifier": {
          const target = requiredActor(scene, p.targetId || sourceId, false);
          if (!["armor", "evasion", "speed", "ap", "focus"].includes(p.stat) || !Number.isInteger(p.amount) || Math.abs(p.amount) > 9999 || !lifetimes.has(p.duration || "endTurn")) fail("Некорректный модификатор");
          astate(target).modifiers.push({ id: p.id || rootId, sourceActorId: sourceId, ownerActorId: p.ownerActorId || target.id, stat: p.stat, amount: p.amount, boundary: p.duration || "endTurn", appliedSerial: scene.turnSerial }); emit("modifier.configure", sourceId, p); break;
        }
        case "allow-action":{const target=requiredActor(scene,p.targetId||sourceId);if(!actionDef(p.actionId))fail("Неизвестное действие");astate(target).allowances||=[];astate(target).allowances.push({id:p.id||rootId,actionId:p.actionId,swift:p.swift===true,cost:p.cost==null?undefined:integer(p.cost,"стоимость"),remaining:integer(p.uses??1,"применения",99),sourceActorId:sourceId});emit("action.allow",sourceId,p);break;}
        case "grant-turn":{const target=requiredActor(scene,p.targetId||sourceId);s.grantedTurns||=[];if(s.grantedTurns.length>=20)fail("Слишком много ожидающих Ходов");s.grantedTurns.push({actorId:target.id,sourceActorId:sourceId});emit("turn.grant",sourceId,{targetId:target.id});break;}
        case "usage":{if(typeof p.ruleId!=="string"||!p.ruleId||p.ruleId.length>180||!["turn","round","scene"].includes(p.scope))fail("Укажите правило и область лимита");const history=astate(a).history||[],used=history.filter(h=>h.ruleId===p.ruleId&&(p.scope==="scene"||p.scope==="round"&&h.round===scene.round||p.scope==="turn"&&h.turnSerial===scene.turnSerial));if(used.length>=integer(p.limit??1,"лимит",999))fail("Лимит применения правила исчерпан");if(p.oncePerTarget&&(p.targetIds||[]).some(id=>used.some(h=>h.targetIds.includes(id))))fail("Эта цель уже использована правилом");astate(a).history=[...history,{ruleId:p.ruleId,targetIds:copy(p.targetIds||[]),round:scene.round,turnSerial:scene.turnSerial}].slice(-200);emit("rule.used",sourceId,p);break;}
        case "punish":{const opportunity=(s.opportunities||[]).find(o=>o.id===p.id&&o.actorId===sourceId);if(!opportunity)fail("Окно Наказания уже закрыто");const result=publishRoll(a,p.roll,"Наказание");if(result.initialCount!==Math.max(Number(a.attrs.body||0),Number(a.attrs.talent||0)))fail("Неверный пул Наказания");s.opportunities=s.opportunities.filter(o=>o.id!==p.id);beginAttack(a,{name:"Наказание",targetIds:[opportunity.targetId],amount:result.successes});break;}
        case "invisible":if(!has(a,"positive.невидим"))fail("Нет Невидимости");removeEffect(a,"positive.невидим");applyEffect(a,{effect:"positive.исчез",duration:"startTurn"},a.id);break;
        case "configure-resource": {
          if (!/^[a-zA-Z][\w.-]{0,79}$/.test(p.id || "") || ["constructor", "prototype", "__proto__"].includes(p.id)) fail("Некорректный ID ресурса");
          a.ruleResources ||= {}; a.ruleResources[p.id] = { resource: p.id, label: String(p.label || p.id).slice(0,100), value: integer(p.value || 0, "ресурс"), maximum: integer(p.maximum || 9999, "максимум") }; emit("rule-resource.configure", sourceId, p); break;
        }
        case "clock": {
          if (!/^[a-zA-Z][\w.-]{0,79}$/.test(p.id || "") || ["constructor", "prototype", "__proto__"].includes(p.id)) fail("Некорректный ID часов");
          a.ruleClocks ||= {}; const previous = a.ruleClocks[p.id], size = integer(p.size ?? previous?.size ?? 4, "размер часов", 100), value = integer(p.value ?? (Number(previous?.value || 0) + Number(p.delta || 0)), "сегменты", 100);
          if (!size || value > size) fail("Число сегментов выходит за размер часов");
          a.ruleClocks[p.id] = { clockId: p.id, label: String(p.label || previous?.label || p.id).slice(0,100), size, value, active: true, sourceActorId: sourceId }; emit("rule-clock.set", sourceId, { ...p, size, value }); break;
        }
        case "roll": publishRoll(a, p.roll, p.label || "Бросок"); break;
        case "prompt": choice(a, "manual", String(p.title || "Решение правила").slice(0,240), ["record"], { ruleId: p.ruleId, text: String(p.text || "").slice(0,1200) }); break;
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
          else if (pending.kind === "placement") {
            const destination = { ...p.destination, space: a.space }, source = actor(scene, pending.context.adjacentTo);
            if (source && distance(destination, source) !== 1 || pending.context.reappear && scene.actors.some(x => live(x) && x.id !== a.id && distance(destination, x) <= 1)) fail("Клетка не соответствует условию появления");
            move(a, { destination, placement: true });
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
        case "resolve-attack": {
          const pending = scene.pendingAction;
          if (!pending?.lionwing || pending.targetIds.some(id => live(actor(scene, id)) && pending.responses[id]?.choice === "pending")) fail("Сначала дождитесь всех Реакций");
          scene.pendingAction = null;
          const operations = [];
          for (let i = 0; i < pending.repeat; i++) for (const targetId of pending.targetIds) {
            const response = pending.responses[targetId] || {};
            operations.push({ kind: "damage", sourceActorId: pending.actorId, targetId, amount: pending.targetDamage?.[targetId]??pending.damage, attack: true, reduction: response.reduction || 0, temporaryArmor: response.temporaryArmor || 0, effects: pending.effects, finalDamage: pending.finalDamage });
          }
          operations.push(...(s.afterAttack || [])); s.afterAttack = [];
          queue.unshift(...operations.map(p => ({ p, sourceId: pending.actorId })));
          emit("attack.clear", pending.actorId, { name: pending.name }); break;
        }
        case "cancel-attack": scene.pendingAction = null; s.afterAttack = []; emit("attack.clear", sourceId, { cancelled: true }); break;
        case "turn-start": {
          const status = turnStartStatus(scene, sourceId); if (!status.available) fail(status.reason);
          if(s.grantedTurns?.length){s.grantedTurns.shift();astate(a).grantedTurn={lastTeam:s.lastTeam,lastActorId:s.lastActorId,acted:a.acted};}
          if (!s.started) { s.started = true; for (const hero of scene.actors.filter(isPlayer)) hero.focus = 1 + Math.ceil(Number(hero.attrs.spirit || 0) / 2); for (const other of scene.actors) other.ap = 0; }
          scene.activeActorId = a.id; scene.turnSerial = Number(scene.turnSerial || 0) + 1; astate(a).turns = Number(astate(a).turns || 0) + 1; astate(a).turnActions = []; astate(a).startedDisappeared = has(a, "positive.исчез");
          a.ap = Math.max(0, Number(a.baseAp ?? 3) - (has(a, "negative.ошеломлен") ? 1 : 0)); a.stepRemaining = 0; s.breakout = null; s.opportunities = [];
          phase("startTurn", a);
          if (has(a, "negative.подброшен")) removeEffect(a, "negative.подброшен");
          if (astate(a).startedDisappeared) { if (has(a, "positive.исчез")) removeEffect(a, "positive.исчез"); choice(a, "placement", "Выберите клетку появления вне соседства с персонажами", ["place"], { reappear: true }); }
          emit("turn.start", a.id, { ap: a.ap }); break;
        }
        case "turn-end": {
          if (scene.activeActorId !== sourceId || scene.pendingAction || s.choices.length) fail("Нельзя завершить этот Ход: есть незавершённое действие");
          if (has(a, "positive.регенерирует")) { const before = a.hp; a.hp = Math.min(a.maxHp, a.hp + 4 + Number(a.tier || 1)); emit("actor.heal", a.id, { targetId: a.id, restored: a.hp - before, amount: 4 + a.tier }); }
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
        case "tension": scene.tension = integer(p.amount, "Напряжение", 999); emit("scene.tension", sourceId, { amount: scene.tension }); break;
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
    if (s.choices.length && !["choice", "correct", "note", "tension"].includes(request.kind)) fail("Сначала ответьте на ожидающее решение");
    if (scene.pendingAction && !["reaction", "resolve-attack", "cancel-attack", "correct", "note", "choice", "tension","invisible"].includes(request.kind)) fail("Сначала завершите Атаку");
    const operations = request.kind === "batch" ? request.operations : [request];
    if (!Array.isArray(operations) || !operations.length || operations.length > 192 || operations.some(p => !p || p.kind === "batch")) fail("Некорректный пакет операций");
    const queue = operations.map(p => ({ p, sourceId: p.sourceActorId ?? event.actorId }));
    if (request.kind === "choice") queue.push(...s.deferred.splice(0));
    while (queue.length) {
      const item = queue.shift(); op(item.p, item.sourceId);
      if (s.choices.length) { s.deferred.push(...queue); break; }
    }
    output.push(...emitted);
  }

  const sharedTypes = new Set(["roll.public", "challenge.request", "challenge.clear", "opposed.request", "opposed.reroll", "opposed.tie.resolve", "opposed.clear", "rule.share", "session-clock.create", "session-clock.set", "session-clock.rename", "session-clock.kind", "session-clock.size", "session-clock.remove", "reminder.create", "reminder.due", "reminder.resolve", "reminder.remove", "actor.spawn", "actor.despawn", "area.create", "area.remove", "area.duration", "object.damage", "object.restore", "wall.create", "wall.damage", "wall.restore", "wall.remove", "marker.create", "marker.move", "marker.remove", "marker.duration", "targets.set", "space.ensure", "space.remove"]);
  function dispatchMany(scene, events, options = {}) {
    if (options.expectedVersion !== undefined && Number(options.expectedVersion) !== Number(scene.version || 0)) fail("Конфликт версии Сцены: обновите состояние");
    if (!Array.isArray(events) || !events.length || events.length > 192) fail("Некорректный пакет событий");
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
  const api = { schema: 1, isScene, prepare, command, dispatchMany, previewEvents, turnStartStatus, roundEndStatus, movement, roll, actionStatus, actionDef, speed, operations: ["action", "attack", "damage", "heal", "wound", "stress", "resource", "correct", "effect", "move", "modifier", "configure-resource", "clock", "prompt", "choice", "roll", "reaction", "resolve-attack", "turn-start", "turn-end", "round-end"] };
  global.DAWN_LIONWING_ENGINE = api;
  const routed = global.DAWN_SCENE_ENGINE;
  const route = (name, handler) => { const previous = legacy[name]; routed[name] = (scene, ...args) => isScene(scene) ? handler(scene, ...args) : previous(scene, ...args); };
  route("dispatchMany", dispatchMany); route("dispatch", (scene, event, options) => dispatchMany(scene, [event], options)); route("previewEvents", previewEvents);
  route("turnStartStatus", turnStartStatus); route("roundEndStatus", roundEndStatus);
  route("prepareAction", (scene, data, request) => prepare(scene, { kind: "action", ...request }));
  route("availableActions", (scene, data, id) => core.actions.list.filter(d => d.type === "action").map(d => { const status = actionStatus(scene, actor(scene, id), d); return { ...d, ...status, cost: `${status.cost ?? d.cost.amount} ${d.cost.resource === "ap" ? "ОД" : d.cost.resource}`, automation: "full" }; }));
  route("effectiveActorSpeed", (scene, id) => speed(requiredActor(scene, id, false)));
  route("pendingActionStatus", scene => ({ waitingIds: (scene.pendingAction?.targetIds || []).filter(id => live(actor(scene,id)) && scene.pendingAction.responses[id]?.choice === "pending"), unavailableIds: [], mustCancel: false }));
  route("availableEnemyRules", () => []);
  route("projectScene",(scene,viewer={})=>{const projected=legacy.projectScene(scene,viewer);if(!["owner","narrator","gm"].includes(viewer.role)&&projected.lionwing){delete projected.lionwing.receipts;delete projected.lionwing.deferred;delete projected.lionwing.afterAttack;const visible=new Set(projected.actors.map(a=>a.id));projected.lionwing.choices=(projected.lionwing.choices||[]).filter(c=>visible.has(c.actorId));}return projected;});
})(typeof window === "object" ? window : globalThis);
