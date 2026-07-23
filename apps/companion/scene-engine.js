"use strict";

(function exposeDawnSceneEngine(global) {
  const VERSION = 4;
  const EVENT_TYPES = new Set(["action.prepare", "action.resolve", "enemy.action.prepare", "enemy.action.resolve", "reaction.offer", "reaction.respond", "roll.public", "resource.spend", "resource.gain", "actor.move", "actor.enter", "turn.start", "turn.end", "round.end", "attack.pending", "attack.clear", "damage.apply", "effect.apply", "technique.prepare", "technique.resolve", "technique.manual", "area.create", "marker.create", "targets.set", "space.ensure"]);
  const RESOURCES = new Set(["ap", "focus", "influence"]);
  const clone = value => JSON.parse(JSON.stringify(value));
  const actorById = (scene, id) => (scene.actors || []).find(actor => actor.id === id) || null;
  const actionById = (data, id) => data?.actions?.list?.find(action => action.id === id) || null;
  const enemyProfileById = (data, id) => [...(data?.enemies?.common || []), ...(data?.enemies?.modifiers || [])].find(profile => profile.id === id) || null;
  const effectIdByName = (data, name) => [...(data?.effects?.positive || []), ...(data?.effects?.negative || [])].find(effect => effect.id === name || effect.name === name)?.id || name;
  const distance = (a, b) => a.space === b.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
  const cellKey = point => `${point.x},${point.y}`;
  const currentRoundEvents = scene => {
    const events = [];
    for (const event of scene.log || []) {
      if (event.type === "round.end") break;
      events.push(event);
    }
    return events;
  };
  const closedTurnActorId = event => event?.type === "turn.end" ? event.actorId : event?.payload?.endedTurnActorId || null;
  const currentTurnEvents = (scene, actorId) => {
    const events = [];
    for (const event of scene.log || []) {
      if (event.type === "turn.start" && event.actorId === actorId) break;
      events.push(event);
    }
    return events;
  };
  function movementPath(scene, actorId, destination, options = {}) {
    const actor = actorById(scene, actorId), space = (scene.spaces || []).find(item => item.id === actor?.space);
    if (!actor || !space || !destination || !Number.isInteger(Number(destination.x)) || !Number.isInteger(Number(destination.y))) return [];
    const end = { x: Number(destination.x), y: Number(destination.y) }, limit = Number.isFinite(Number(options.maxDistance)) ? Number(options.maxDistance) : Infinity;
    if (end.x < 0 || end.y < 0 || end.x >= space.width || end.y >= space.height) return [];
    const terrain = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "terrain").flatMap(object => object.cells || []));
    const difficult = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "difficult").flatMap(object => object.cells || []));
    const opponents = new Set((scene.actors || []).filter(item => item.id !== actor.id && item.space === actor.space && item.team !== actor.team).map(item => `${item.x},${item.y}`));
    const blocked = point => (!options.ignoreTerrain && terrain.has(cellKey(point))) || (!options.ignoreEnemies && opponents.has(cellKey(point)));
    if (options.straight) {
      const dx = end.x - actor.x, dy = end.y - actor.y, ax = Math.abs(dx), ay = Math.abs(dy);
      if (!(dx === 0 || dy === 0 || ax === ay)) return [];
      const steps = Math.max(ax, ay);
      if (steps < 1 || steps > limit) return [];
      const path = [];
      for (let step = 1; step <= steps; step += 1) {
        const point = { x: actor.x + Math.sign(dx) * step, y: actor.y + Math.sign(dy) * step };
        if (blocked(point)) return [];
        path.push(point);
      }
      return path;
    }
    const start = { x: actor.x, y: actor.y }, queue = [{ point: start, path: [] }], seen = new Set([cellKey(start)]), directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    while (queue.length) {
      const current = queue.shift();
      if (current.point.x === end.x && current.point.y === end.y) return current.path;
      if (current.path.length >= limit) continue;
      if (!options.ignoreDifficult && current.path.length && difficult.has(cellKey(current.point))) continue;
      for (const direction of directions) {
        const point = { x: current.point.x + direction.x, y: current.point.y + direction.y }, key = cellKey(point);
        if (point.x < 0 || point.y < 0 || point.x >= space.width || point.y >= space.height || seen.has(key) || blocked(point)) continue;
        seen.add(key);
        queue.push({ point, path: current.path.concat(point) });
      }
    }
    return [];
  }
  function turnStartStatus(scene, actorId) {
    const actor = actorById(scene, actorId), heroes = (scene.actors || []).filter(item => item.kind === "hero" && item.team === "hero" && !item.knockedOut), enemies = (scene.actors || []).filter(item => item.team === "enemy" && !item.knockedOut);
    if (!actor) return { available: false, reason: "Участник не найден." };
    if (scene.pendingAction) return { available: false, reason: "Сначала завершите текущую цепочку Реакций." };
    if (scene.activeActorId) return { available: false, reason: "Сначала завершите текущий Ход." };
    if (actor.knockedOut) return { available: false, reason: "Выведенный из строя участник не может начать Ход." };
    if (actor.team !== "enemy" && actor.acted) return { available: false, reason: "Этот участник уже действовал в текущем Раунде." };
    if (actor.team === "enemy" && actor.acted && enemies.some(item => !item.acted)) return { available: false, reason: "Сначала должен действовать ещё не ходивший враг." };
    const lastEnd = currentRoundEvents(scene).find(event => closedTurnActorId(event)), lastActor = actorById(scene, closedTurnActorId(lastEnd));
    if (heroes.length && enemies.length) {
      if (!lastEnd && actor.team !== "hero") return { available: false, reason: "Раунд начинает персонаж игрока." };
      if (lastActor?.team === "hero" && actor.team !== "enemy") return { available: false, reason: "После игрока должен действовать враг." };
      if (lastActor?.team === "enemy" && actor.team === "enemy") return { available: false, reason: "После врага должен действовать игрок." };
    }
    return { available: true, reason: "" };
  }
  function roundEndStatus(scene) {
    if (scene.pendingAction) return { available: false, reason: "Сначала завершите текущую цепочку Реакций." };
    if (scene.activeActorId) return { available: false, reason: "Сначала завершите текущий Ход." };
    const completedTurns = currentRoundEvents(scene).filter(event => closedTurnActorId(event));
    if (!completedTurns.length) return { available: false, reason: "Раунд ещё не начат." };
    const heroes = (scene.actors || []).filter(item => item.kind === "hero" && item.team === "hero" && !item.knockedOut), enemyTurns = completedTurns.filter(event => actorById(scene, closedTurnActorId(event))?.team === "enemy").length;
    if (heroes.some(actor => !actor.acted)) return { available: false, reason: "Не все персонажи игроков завершили Ход." };
    if (heroes.length && enemyTurns < heroes.length) return { available: false, reason: `Нужно ещё Ходов врагов: ${heroes.length - enemyTurns}.` };
    return { available: true, reason: "" };
  }
  const areaCells = (space, anchor, area) => {
    const width = Number(area?.[0] || 0), height = Number(area?.[1] || 0), cells = [];
    const startX = Number(anchor?.x) - (width % 2 ? Math.floor(width / 2) : 0), startY = Number(anchor?.y) - (height % 2 ? Math.floor(height / 2) : 0);
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) {
      const x = startX + dx, y = startY + dy;
      if (x >= 0 && y >= 0 && x < Number(space?.width || 0) && y < Number(space?.height || 0)) cells.push(`${x},${y}`);
    }
    return cells;
  };
  const eventId = () => `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const actionCost = action => {
    const match = String(action?.cost || "").match(/(\d+)\s*(ОД|Фокус)/i);
    return match ? { amount: Number(match[1]), resource: match[2].toLowerCase() === "од" ? "ap" : "focus" } : { amount: 0, resource: null };
  };

  function normalizeEvent(event, options = {}) {
    if (!event?.type) throw new Error("Событию Сцены нужен type.");
    return {
      id: event.id || (options.makeId || eventId)(),
      at: event.at || new Date().toISOString(),
      type: event.type,
      actorId: event.actorId || null,
      payload: clone(event.payload || {}),
    };
  }

  function validateEvent(scene, event) {
    if (!EVENT_TYPES.has(event.type)) throw new Error(`Неизвестный тип события: ${event.type}.`);
    if (typeof event.id !== "string" || !event.id || event.id.length > 120) throw new Error("Некорректный id события.");
    if (event.actorId && !actorById(scene, event.actorId)) throw new Error("Исполнитель события отсутствует на Сцене.");
    const payload = event.payload || {};
    const finite = value => Number.isFinite(Number(value));
    if (["resource.spend", "resource.gain"].includes(event.type)) {
      if (!RESOURCES.has(payload.resource) || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999) throw new Error("Некорректное изменение ресурса.");
    }
    if (event.type === "actor.move") {
      const space = (scene.spaces || []).find(item => item.id === payload.space);
      if (!space || !Number.isInteger(Number(payload.x)) || !Number.isInteger(Number(payload.y)) || Number(payload.x) < 0 || Number(payload.y) < 0 || Number(payload.x) >= space.width || Number(payload.y) >= space.height) throw new Error("Некорректная клетка перемещения.");
    }
    if (event.type === "roll.public") {
      if (!Array.isArray(payload.rolls) || payload.rolls.length > 300 || payload.rolls.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 6)) throw new Error("Некорректный публичный бросок.");
    }
    if (event.type === "attack.pending") {
      if (!Array.isArray(payload.targetIds) || payload.targetIds.length > 40 || payload.targetIds.some(id => !actorById(scene, id)) || !finite(payload.damage) || Number(payload.damage) < 0 || Number(payload.damage) > 9999) throw new Error("Некорректные параметры атаки.");
    }
    if (event.type === "effect.apply" && (!actorById(scene, payload.targetId) || typeof payload.effect !== "string" || !payload.effect.trim() || payload.effect.length > 80)) throw new Error("Некорректный Эффект.");
    if (["enemy.action.prepare", "enemy.action.resolve"].includes(event.type) && (typeof payload.ruleId !== "string" || typeof payload.name !== "string" || payload.ruleId.length > 180 || payload.name.length > 120)) throw new Error("Некорректное действие врага.");
    if (event.type === "damage.apply") {
      if (!actorById(scene, payload.targetId) || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999) throw new Error("Некорректный урон.");
    }
    if (event.type === "area.create") {
      const space = (scene.spaces || []).find(item => item.id === payload.space);
      if ((scene.objects || []).length >= 240 || !space || !Array.isArray(payload.cells) || payload.cells.length > 144 || payload.cells.some(cell => {const match=String(cell).match(/^(\d{1,2}),(\d{1,2})$/);return !match||Number(match[1])>=space.width||Number(match[2])>=space.height}) || !["attack","gas","terrain","difficult","danger","portal","custom"].includes(payload.areaType)) throw new Error("Некорректная область Техники.");
    }
    if (event.type === "marker.create") {
      const space = (scene.spaces || []).find(item => item.id === payload.space);
      if ((scene.markers || []).length >= 240 || !space || !Number.isInteger(Number(payload.x)) || !Number.isInteger(Number(payload.y)) || Number(payload.x) < 0 || Number(payload.y) < 0 || Number(payload.x) >= space.width || Number(payload.y) >= space.height) throw new Error("Некорректный маркер Техники.");
    }
    if (event.type === "targets.set" && (!Array.isArray(payload.actorIds) || payload.actorIds.length > 40 || payload.actorIds.some(id => !actorById(scene, id)))) throw new Error("Некорректный список целей.");
    if (event.type === "space.ensure" && (typeof payload.id !== "string" || !payload.id || (!((scene.spaces || []).some(space => space.id === payload.id || space.name === payload.name)) && (scene.spaces || []).length >= 12) || !finite(payload.width) || !finite(payload.height) || Number(payload.width) < 1 || Number(payload.height) < 1 || Number(payload.width) > 12 || Number(payload.height) > 12)) throw new Error("Некорректное отдельное пространство.");
    if (["technique.prepare", "technique.resolve", "technique.manual"].includes(event.type) && JSON.stringify(payload).length > 8192) throw new Error("Событие Техники слишком велико.");
    if (event.type === "reaction.respond" && !["pass", "Блок", "Уворот", "Столкновение"].includes(payload.choice)) throw new Error("Некорректный ответ на Реакцию.");
    return event;
  }

  function validateTransition(scene, event) {
    const actor = event.actorId ? actorById(scene, event.actorId) : null;
    if (scene.pendingAction && ["turn.start", "turn.end", "round.end"].includes(event.type)) {
      throw new Error("Сначала завершите текущую цепочку Реакций.");
    }
    if (event.type === "turn.start") {
      const status = turnStartStatus(scene, event.actorId);
      if (!status.available) throw new Error(status.reason);
    }
    if (event.type === "turn.end" && scene.activeActorId !== event.actorId) {
      throw new Error("Завершить можно только текущий Ход.");
    }
    if (event.type === "round.end") {
      const status = roundEndStatus(scene);
      if (!status.available) throw new Error(status.reason);
    }
    if (["action.prepare", "enemy.action.prepare", "attack.pending"].includes(event.type) && scene.activeActorId !== event.actorId) {
      throw new Error(actor ? `Сейчас не Ход «${actor.name}».` : "Исполнитель действия не найден.");
    }
    if (event.type === "reaction.respond") {
      const response = scene.pendingAction?.responses?.[event.actorId];
      if (!response || response.choice !== "pending") throw new Error("Эта Реакция уже закрыта или не предлагалась.");
    }
  }

  function reduceEvent(scene, event) {
    const actor = event.actorId ? actorById(scene, event.actorId) : null;
    const payload = event.payload;
    if (event.type === "resource.spend" && actor) {
      const key = payload.resource;
      actor[key] = Math.max(0, Number(actor[key] || 0) - Math.max(0, Number(payload.amount || 0)));
    } else if (event.type === "resource.gain" && actor) {
      const key = payload.resource;
      // Focus deliberately has no upper clamp. Starting Focus is not a maximum.
      actor[key] = Math.max(0, Number(actor[key] || 0) + Math.max(0, Number(payload.amount || 0)));
    } else if (event.type === "actor.move" && actor) {
      Object.assign(actor, { space: payload.space || actor.space, x: Number(payload.x), y: Number(payload.y) });
    } else if (event.type === "area.create") {
      scene.objects ||= [];
      scene.objects.push({ id: payload.id, space: payload.space, type: payload.areaType, label: payload.label, source: payload.source, duration: payload.duration, ownerActorId: payload.ownerActorId || event.actorId, cells: [...payload.cells], createdRound: Number(scene.round || 1) });
    } else if (event.type === "marker.create") {
      scene.markers ||= [];
      scene.markers.push({ id: payload.id, space: payload.space, x: Number(payload.x), y: Number(payload.y), kind: payload.markerKind, label: payload.label, color: payload.color, source: payload.source, duration: payload.duration, ownerActorId: payload.ownerActorId || event.actorId, createdRound: Number(scene.round || 1) });
    } else if (event.type === "targets.set") {
      scene.targetIds = [...payload.actorIds];
    } else if (event.type === "space.ensure") {
      scene.spaces ||= [];
      if (!scene.spaces.some(space => space.id === payload.id || space.name === payload.name)) scene.spaces.push({ id: payload.id, name: payload.name, width: Number(payload.width), height: Number(payload.height) });
      if (payload.activate) scene.activeSpace = (scene.spaces.find(space => space.id === payload.id || space.name === payload.name) || {}).id || scene.activeSpace;
    } else if (event.type === "roll.public") {
      scene.rollFeed ||= [];
      scene.rollFeed.unshift({ id: event.id, actor: actor?.name || payload.actor || "Система", formula: payload.formula, rolls: payload.rolls || [], successes: Number(payload.successes || 0), crits: Number(payload.crits || 0), outcome: typeof payload.outcome === "string" ? payload.outcome.slice(0, 80) : "", payment: typeof payload.payment === "string" ? payload.payment.slice(0, 80) : "" });
      scene.rollFeed = scene.rollFeed.slice(0, 20);
    } else if (event.type === "attack.pending") {
      scene.pendingAction = { id: event.id, actorId: event.actorId, ...clone(payload), responses: Object.fromEntries((payload.targetIds || []).map(id => [id, { choice: "pending" }])) };
    } else if (event.type === "reaction.respond" && scene.pendingAction) {
      scene.pendingAction.responses[event.actorId] = { choice: payload.choice, destination: payload.destination || null, clash: payload.clash || null };
    } else if (event.type === "attack.clear") {
      scene.pendingAction = null;
    } else if (event.type === "damage.apply") {
      const target = actorById(scene, payload.targetId);
      if (target) {
        const raw = Math.max(0, Number(payload.amount || 0));
        const armor = payload.ignoreArmor ? 0 : Math.max(0, Number(target.armor || 0) + Number(payload.temporaryArmor || 0));
        const afterArmor = raw > 0 ? Math.max(1, raw - armor) : 0;
        const evasion = Math.max(0, Number(target.evasion || 0) + Number(payload.temporaryEvasion || 0));
        const evaded = Math.min(afterArmor, evasion);
        target.evasion = Math.max(0, Number(target.evasion || 0) - Math.max(0, evaded - Number(payload.temporaryEvasion || 0)));
        const dealt = Math.max(0, afterArmor - evaded);
        target.hp = Math.max(0, Number(target.hp || 0) - dealt);
        payload.raw = raw;
        payload.armor = armor;
        payload.evaded = evaded;
        payload.dealt = dealt;
        if (target.hp === 0 && dealt > 0) {
          const guts = Math.max(0, Number(target.guts ?? (target.team === "enemy" ? 0 : 1 + Number(target.attrs?.body || 0))));
          target.wounds = Math.max(0, Number(target.wounds || 0));
          if (guts === 0) target.knockedOut = true;
          else {
            target.wounds += 1;
            if (event.actorId !== target.id) target.influence = Math.max(0, Number(target.influence || 0) + 1);
            if (target.wounds >= guts) {
              target.wounds -= 1;
              target.knockedOut = true;
            } else target.hp = guts;
          }
          if (target.knockedOut) {
            scene.tension = Number(scene.tension || 0) + 1;
            if (scene.activeActorId === target.id) {
              target.acted = true;
              target.stepRemaining = 0;
              payload.endedTurnActorId = target.id;
              scene.activeActorId = null;
            }
          }
        }
      }
    } else if (event.type === "effect.apply") {
      const target = actorById(scene, payload.targetId);
      if (target) {
        target.effects ||= [];
        if (!target.effects.includes(payload.effect)) target.effects.push(payload.effect);
      }
    } else if (event.type === "enemy.action.prepare" && actor) {
      actor.usedActions ||= [];
      if (!actor.usedActions.includes(payload.ruleId)) actor.usedActions.push(payload.ruleId);
      if (payload.kind === "trump") actor.usedTrump = true;
    } else if (event.type === "action.prepare" && actor) {
      actor.usedActions ||= [];
      if (payload.actionId && !payload.quick && !payload.continuation && !actor.usedActions.includes(payload.actionId)) actor.usedActions.push(payload.actionId);
      if (payload.actionName === "Шаг" || payload.name === "Шаг") actor.stepRemaining = Math.max(0, Number(payload.stepRemaining || 0));
    } else if (event.type === "actor.enter" && actor) {
      const owner = id => actorById(scene, id);
      const cell = `${actor.x},${actor.y}`;
      const hazards = (scene.objects || []).filter(object => object.space === actor.space && object.cells?.includes(cell));
      if (!payload.ignoreDifficult && hazards.some(object => object.type === "difficult")) {
        actor.speedZeroUntilTurnEnd = true;
        actor.stepRemaining = 0;
      }
      if (hazards.some(object => object.type === "gas" && owner(object.ownerActorId)?.team !== actor.team)) {
        actor.effects ||= [];
        if (!actor.effects.includes("Ослаблен")) actor.effects.push("Ослаблен");
      }
    } else if (event.type === "turn.start" && actor) {
      scene.activeActorId = actor.id;
      actor.acted = false;
      actor.stepRemaining = 0;
      if (actor.team === "enemy") actor.ap = Number(actor.baseAp || 2);
      scene.objects = (scene.objects || []).filter(object => !(object.duration === "nextTurn" && object.ownerActorId === actor.id));
      scene.markers = (scene.markers || []).filter(marker => !(marker.duration === "nextTurn" && marker.ownerActorId === actor.id));
    } else if (event.type === "turn.end" && actor) {
      actor.acted = true;
      actor.stepRemaining = 0;
      (scene.actors || []).forEach(item => { item.speedZeroUntilTurnEnd = false; });
      if (actor.team === "enemy") actor.ap = 0;
      if (scene.activeActorId === actor.id) scene.activeActorId = null;
      scene.objects = (scene.objects || []).filter(object => !(object.duration === "endTurn" && object.ownerActorId === actor.id));
      scene.markers = (scene.markers || []).filter(marker => !(marker.duration === "endTurn" && marker.ownerActorId === actor.id));
    } else if (event.type === "round.end") {
      scene.round = Number(scene.round || 0) + 1;
      scene.tension = Number(scene.tension || 0) + 1;
      scene.activeActorId = null;
      scene.objects = (scene.objects || []).filter(object => !["instant", "round"].includes(object.duration));
      scene.markers = (scene.markers || []).filter(marker => marker.duration !== "round");
      (scene.actors || []).forEach(item => { item.acted = false; item.ap = Number(item.baseAp || 3); item.usedActions = []; item.stepRemaining = 0; item.speedZeroUntilTurnEnd = false; });
    }
    scene.log ||= [];
    scene.log.unshift(event);
    scene.log = scene.log.slice(0, 200);
  }

  function dispatch(scene, event, options = {}) {
    if (options.expectedVersion !== undefined && Number(scene?.version || 0) !== Number(options.expectedVersion)) {
      const error = new Error(`Конфликт версии Сцены: ожидалась ${options.expectedVersion}, получена ${Number(scene?.version || 0)}.`);
      error.code = "SCENE_VERSION_CONFLICT";
      throw error;
    }
    if (event?.id && (scene?.log || []).some(item => item.id === event.id)) return { scene: clone(scene), event: clone(event), duplicate: true };
    const normalized = normalizeEvent(event, options);
    validateEvent(scene, normalized);
    validateTransition(scene, normalized);
    const next = clone(scene);
    reduceEvent(next, normalized);
    next.version = Number(next.version || 0) + 1;
    return { scene: next, event: normalized };
  }

  function dispatchMany(scene, events, options = {}) {
    let next = clone(scene);
    const committed = [];
    let first = true;
    for (const event of events || []) {
      const result = dispatch(next, event, first ? options : { ...options, expectedVersion: undefined });
      next = result.scene;
      committed.push(result.event);
      first = false;
    }
    return { scene: next, events: committed };
  }

  // Only deterministic base-action modifiers belong here. Conditional follow-ups,
  // named sub-actions (such as Flurry/Sting), clocks and target-shape clauses stay
  // in the Technique assistant instead of being guessed from localized prose.
  const QUICK_ACTION_RULES = [
    { id: "vagabond.drunkard.3.rest", techniqueId: "vagabond.drunkard", level: 3, action: "Передышка", condition: "firstTurn" },
    { id: "altruist.battle-instructor.1.study", techniqueId: "altruist.battle-instructor", level: 1, action: "Изучение", condition: "always" },
    { id: "altruist.fog-walker.3.rest", techniqueId: "altruist.fog-walker", level: 3, action: "Передышка", condition: "always" },
    { id: "altruist.bardic-savant.2.rest", techniqueId: "altruist.bardic-savant", level: 2, action: "Передышка", condition: "always" },
    { id: "ruiner.creation-ascetic.2.rest", techniqueId: "ruiner.creation-ascetic", level: 2, action: "Передышка", condition: "firstTurn" },
  ];
  function quickActionSources(scene, data, actor, action) {
    if (!action?.name || !actor?.techniques || !data?.archetypes) return [];
    const usesThisTurn = currentTurnEvents(scene, actor.id).filter(event => event.type === "action.prepare" && event.payload?.actionId === action.id).length;
    const sources = [];
    for (const rule of QUICK_ACTION_RULES.filter(item => item.action === action.name && Number(actor.techniques?.[item.techniqueId] || 0) >= item.level)) {
      if (rule.condition === "firstTurn" && usesThisTurn > 0) continue;
      const technique = (data.archetypes || []).flatMap(archetype => archetype.techniques || []).find(item => item.id === rule.techniqueId);
      const level = technique?.levels?.find(item => Number(item.n) === rule.level);
      if (technique && level) sources.push({ id: rule.id, techniqueId: technique.id, level: rule.level, name: level.name, condition: rule.condition, needsConfirmation: false, text: level.text });
    }
    return sources;
  }

  function availableActions(scene, data, actorId) {
    const actor = actorById(scene, actorId);
    if (!actor) return [];
    return (data?.actions?.list || []).map(action => {
      const cost = actionCost(action);
      const reaction = action.group === "Защита" || action.en === "Реакция";
      const quickSource = quickActionSources(scene, data, actor, action)[0] || null;
      const continuation = action.name === "Шаг" && (actor.usedActions || []).includes(action.id) && Number(actor.stepRemaining || 0) > 0;
      const quick = !continuation && Boolean(quickSource);
      const effectiveCost = continuation ? { amount: 0, resource: null } : cost;
      const automation = quickSource?.needsConfirmation ? "assist" : new Set(["Прыжок", "Шаг", "Заклинание", "Блок", "Уворот", "Передышка", "Зарядка"]).has(action.name) ? "full" : "assist";
      const offeredReaction = scene.pendingAction?.responses?.[actor.id]?.choice === "pending";
      let reason = "";
      if (actor.knockedOut) reason = "Персонаж выведен из строя";
      else if (reaction && !offeredReaction) reason = "Доступно только в ответ на Атаку";
      else if (scene.pendingAction && !reaction) reason = "Сначала разрешите Реакцию";
      else if (!reaction && !scene.activeActorId) reason = "Сначала начните Ход";
      else if (!reaction && scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
      else if (!reaction && actor.acted) reason = "Ход уже завершён";
      else if (!reaction && action.name === "Шаг" && actor.speedZeroUntilTurnEnd) reason = "Скорость равна 0 до конца текущего Хода";
      else if (!reaction && (actor.usedActions || []).includes(action.id) && !continuation && !quick) reason = "Это действие уже использовано в Раунде";
      else if (effectiveCost.resource && Number(actor[effectiveCost.resource] || 0) < effectiveCost.amount) reason = `Недостаточно: ${action.cost}`;
      return { ...clone(action), costModel: effectiveCost, reaction, automation, quick, quickSource, continuation, remaining: continuation ? Number(actor.stepRemaining || 0) : null, available: !reason, reason };
    });
  }

  function prepareAction(scene, data, request = {}) {
    const actor = actorById(scene, request.actorId);
    const action = actionById(data, request.actionId);
    const errors = [];
    if (!actor) errors.push("Не выбран исполнитель действия.");
    if (!action) errors.push("Неизвестное базовое действие.");
    const available = actor && action ? availableActions(scene, data, actor.id).find(item => item.id === action.id) : null;
    if (available && !available.available) errors.push(available.reason);
    if (errors.length) return { ok: false, errors, events: [] };

    const targetIds = [...new Set(request.targetIds || [])];
    const targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
    const events = [{ type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, actionName: action.name, name: action.name, targetIds, quick: Boolean(available?.quick), quickSource: available?.quickSource ? { techniqueId: available.quickSource.techniqueId, level: available.quickSource.level, name: available.quickSource.name, needsConfirmation: available.quickSource.needsConfirmation } : null, continuation: Boolean(available?.continuation) } }];
    const cost = available?.costModel || actionCost(action);
    if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });

    if (["Шаг", "Прыжок"].includes(action.name)) {
      const destination = request.destination;
      const space = (scene.spaces || []).find(item => item.id === actor.space);
      const moveLimit = action.name === "Прыжок" ? Number(actor.attrs?.talent || 0) : actor.speedZeroUntilTurnEnd ? 0 : available?.continuation ? Number(actor.stepRemaining || 0) : Number(actor.speed || 0);
      if (!destination || !space || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Выберите свободную клетку назначения.");
      else if ((scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка назначения занята.");
      else {
        const path = movementPath(scene, actor.id, destination, { maxDistance: moveLimit, straight: action.name === "Прыжок", ignoreEnemies: action.name === "Прыжок", ignoreDifficult: action.name === "Прыжок" });
        if (!path.length) errors.push(action.name === "Прыжок" ? `Прыжок должен идти по свободной прямой Линии длиной до ${moveLimit}.` : `До этой клетки нет свободного пути в пределах Скорости ${moveLimit}.`);
        else {
          if (action.name === "Шаг") {
            const difficult = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "difficult").flatMap(object => object.cells || []));
            events[0].payload.stepRemaining = difficult.has(cellKey(destination)) ? 0 : Math.max(0, moveLimit - path.length);
          }
          events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: action.name, path: path.map(cellKey) } });
          events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: action.name, ignoreDifficult: action.name === "Прыжок" } });
        }
      }
    } else if (["Стычка", "Заклинание", "Завершение"].includes(action.name)) {
      const limit = action.name === "Заклинание" ? 5 : 1;
      if (!targets.length) errors.push("Выберите цель атаки.");
      if (targets.some(target => target.team === actor.team)) errors.push("Базовая Атака может выбирать целью только противника.");
      if (action.name === "Стычка" && targets.length > 2) errors.push("Стычка выбирает не больше 2 целей.");
      if (action.name !== "Стычка" && targets.length > 1) errors.push(`${action.name} выбирает только одну цель.`);
      if (targets.some(target => distance(actor, target) > limit)) errors.push(`Цель должна быть в пределах ${limit} клеток.`);
      targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: action.id } }));
      const bonus = action.name === "Завершение" ? Number(scene.tension || 0) : 0;
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, name: action.name, targetIds, roll: clone(request.roll || null), damage: Number(request.roll?.successes || 0) + bonus } });
    } else if (action.name === "Передышка") {
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: 1 } });
    } else if (action.name === "Зарядка" && request.roll) {
      events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: Math.max(2, Number(request.roll.successes || 0)) } });
    } else if (action.name === "Скрыться") {
      const atEdge = actor.x === 0 || actor.y === 0 || actor.x === Number((scene.spaces || []).find(item => item.id === actor.space)?.width || 0) - 1 || actor.y === Number((scene.spaces || []).find(item => item.id === actor.space)?.height || 0) - 1;
      const currentTurnEvents = [];
      for (const event of scene.log || []) {
        if (event.type === "turn.start" && event.actorId === actor.id) break;
        currentTurnEvents.push(event);
      }
      const attacked = currentTurnEvents.some(event => event.actorId === actor.id && (event.type === "attack.pending" || (event.type === "action.prepare" && ["Стычка", "Заклинание", "Завершение"].includes(event.payload?.name))));
      if (!atEdge) errors.push("Скрыться можно только на краю поля.");
      if (attacked) errors.push("Нельзя Скрыться после Атаки в этом Ходу.");
    } else if (action.name === "Изучение") {
      if (targets.length !== 1) errors.push("Изучение выбирает одного врага.");
      if (targets.some(target => target.team === actor.team)) errors.push("Изучение выбирает врага.");
      if (targets.some(target => distance(actor, target) > Number(actor.attrs?.mind || 0))) errors.push(`Цель Изучения должна быть в пределах ${Number(actor.attrs?.mind || 0)} клеток.`);
      targets.forEach(target => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: effectIdByName(data, "Помечен"), sourceActionId: action.id } }));
    }
    if (!["Стычка", "Заклинание", "Завершение"].includes(action.name)) events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: action.id, name: action.name, text: action.text } });
    return { ok: errors.length === 0, errors, action: available, events: errors.length ? [] : events };
  }

  function availableEnemyRules(scene, data, actorId) {
    const actor = actorById(scene, actorId);
    const profile = actor ? enemyProfileById(data, actor.profileId) : null;
    if (!actor || !profile) return [];
    return (profile.rules || []).map(rule => {
      const automaticEffects = [...(rule.targetEffects || rule.effects || []), ...(rule.selfEffects || [])].length > 0;
      const wording = `${rule.text || ""} ${rule.reward || ""}`;
      const mixedTargets = /союзник|союзников|союзного/i.test(wording);
      const normalizedWording = wording.replace(/\*|`/g, "").toLowerCase();
      const wordNumber = { двух: 2, двоих: 2, трех: 3, трёх: 3, троих: 3, четырех: 4, четырёх: 4, четверых: 4 };
      const targetCounts = [...normalizedWording.matchAll(/до\s+(\d+|двух|двоих|трех|трёх|троих|четырех|четырёх|четверых)([^.!?]{0,56})/g)]
        .filter(match => /персонаж|цел|союзник|враг/.test(match[2]))
        .map(match => Number(match[1]) || wordNumber[match[1]] || 0);
      const inferredMaxTargets = /любое число|все цели|всех персонаж/.test(normalizedWording) ? 40 : Math.max(0, ...targetCounts);
      const maxTargets = Math.max(Number(rule.maxTargets || 0), inferredMaxTargets);
      const complexAttack = !rule.requiresTarget || maxTargets !== 1 || Boolean(rule.area?.length)
        || /зон|лини|клетк|любое число|все цели|всех персонаж|до\s*(?:[2-9]|двух|двоих|тр[её]х|троих|четыр[её]х|четверых)|перемещ|телепорт|если|ран[уы]|толк|размест|восстанов|теряет|трижды|позвольте|повтор|снова|час[ыа]?|подготов/i.test(wording);
      const automation = rule.kind === "attack" ? (!mixedTargets && !complexAttack ? "attack" : "assisted") : automaticEffects ? "effect" : "assisted";
      let reason = "";
      if (actor.team !== "enemy") reason = "Это не противник";
      else if (actor.knockedOut) reason = "Противник выведен из строя";
      else if (scene.pendingAction) reason = "Сначала разрешите текущие Реакции";
      else if (!scene.activeActorId) reason = "Сначала начните Ход противника";
      else if (scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
      else if (actor.acted) reason = "Ход противника уже завершён";
      else if (Number(actor.ap || 0) < Number(rule.apCost || 1)) reason = `Нужно ${rule.apCost || 1} ОД`;
      else if ((actor.usedActions || []).includes(rule.id)) reason = "Это действие уже использовано в Раунде";
      else if (rule.kind === "trump" && actor.usedTrump) reason = "Козырь уже использован в этой Сцене";
      else if (rule.kind === "trump" && Number(scene.tension || 0) < Number(rule.tension || 0)) reason = `Нужно Напряжение ${rule.tension}`;
      return { ...clone(rule), maxTargets, automation, available: !reason, reason };
    });
  }

  function prepareEnemyRule(scene, data, request = {}) {
    const actor = actorById(scene, request.actorId);
    const profile = actor ? enemyProfileById(data, actor.profileId) : null;
    const rule = profile?.rules?.find(item => item.id === request.ruleId);
    const available = actor && rule ? availableEnemyRules(scene, data, actor.id).find(item => item.id === rule.id) : null;
    const errors = [];
    if (!actor || !profile) errors.push("Не выбран профиль противника.");
    if (!rule) errors.push("Неизвестное действие противника.");
    if (available && !available.available) errors.push(available.reason);
    const targetIds = [...new Set(request.targetIds || [])];
    const targets = targetIds.map(id => actorById(scene, id)).filter(Boolean);
    const space = actor && (scene.spaces || []).find(item => item.id === actor.space);
    const anchor = rule?.area?.length ? (rule.areaAnchor === "self" ? { x: actor?.x, y: actor?.y } : request.anchor) : null;
    const affectedCells = rule?.area?.length && space && Number.isInteger(Number(anchor?.x)) && Number.isInteger(Number(anchor?.y)) ? areaCells(space, anchor, rule.area) : [];
    if (rule?.area?.length && !affectedCells.length) errors.push("Укажите область действия на поле.");
    if (actor && rule?.areaAnchor !== "self" && rule?.range && anchor && Math.abs(actor.x - Number(anchor.x)) + Math.abs(actor.y - Number(anchor.y)) > Number(rule.range)) errors.push(`Область должна быть в пределах ${rule.range} клеток.`);
    if (affectedCells.length && targets.some(target => target.space !== actor.space || !affectedCells.includes(`${target.x},${target.y}`))) errors.push("Все выбранные цели должны находиться в области.");
    if (rule?.requiresTarget && !targets.length) errors.push(rule.kind === "attack" ? "Выберите хотя бы одну цель Атаки." : "Выберите цель действия.");
    if (actor && rule?.kind === "attack" && available?.automation === "attack" && targets.some(target => target.team === actor.team)) errors.push("Эта автоматизированная Атака может выбирать целью только другую сторону.");
    const maxTargets = Number(available?.maxTargets ?? rule?.maxTargets ?? 0);
    if (maxTargets && targets.length > maxTargets) errors.push(`Можно выбрать не больше ${maxTargets} целей.`);
    if (actor && rule?.adjacent && targets.some(target => distance(actor, target) > 1)) errors.push("Цель должна быть смежной.");
    if (actor && rule?.range && targets.some(target => distance(actor, target) > Number(rule.range))) errors.push(`Цель должна быть в пределах ${rule.range} клеток.`);
    const hasRoll = request.roll && Array.isArray(request.roll.rolls);
    const hasDirectDamage = Number.isFinite(Number(request.damage)) && Number(request.damage) >= 0;
    if (rule?.kind === "attack" && !hasRoll && !hasDirectDamage) errors.push("Для Атаки нужен бросок или прямой урон из профиля.");
    if (errors.length) return { ok: false, errors, events: [], rule: available || rule };
    const targetEffects = (rule.targetEffects || rule.effects || []).map(name => effectIdByName(data, name));
    const selfEffects = (rule.selfEffects || []).map(name => effectIdByName(data, name));
    const payload = { ruleId: rule.id, profileId: profile.id, name: rule.name, kind: rule.kind, targetIds, text: rule.text, reward: rule.reward, automation: available?.automation || (targetEffects.length || selfEffects.length ? "effect" : "assisted") };
    const events = [{ type: "enemy.action.prepare", actorId: actor.id, payload }, { type: "resource.spend", actorId: actor.id, payload: { resource: "ap", amount: Number(rule.apCost || 1) } }];
    selfEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect, sourceActionId: rule.id } }));
    if (affectedCells.length) events.push({ type: "area.create", actorId: actor.id, payload: { id: `area-${eventId()}`, space: actor.space, areaType: rule.kind === "attack" ? "attack" : "danger", label: rule.name, source: rule.id, duration: rule.kind === "attack" ? "instant" : "scene", ownerActorId: actor.id, cells: affectedCells } });
    if (rule.kind === "attack" && payload.automation === "attack") {
      targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: rule.id } }));
      const tensionMultiplier = Number(rule.tensionMultiplier || (/\[Напряжение\]/i.test(rule.reward || "") ? 1 : 0));
      const damage = hasRoll ? Number(request.roll.successes || 0) + Number(scene.tension || 0) * tensionMultiplier : Number(request.damage);
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: rule.id, enemyRuleId: rule.id, name: rule.name, targetIds, roll: hasRoll ? clone(request.roll) : null, damage, effects: targetEffects, reward: rule.reward || "" } });
    } else {
      if (rule.kind !== "attack") targets.forEach(target => targetEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: rule.id } })));
      if (rule.kind === "attack" && hasRoll) events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
      events.push({ type: "enemy.action.resolve", actorId: actor.id, payload });
    }
    return { ok: true, errors: [], events, rule: available || clone(rule) };
  }

  function reactionOptions(scene, data, actorId) {
    const actor = actorById(scene, actorId);
    if (!actor || !scene.pendingAction?.responses?.[actorId]) return [];
    const defenses = actor.team === "enemy" ? [] : availableActions(scene, data, actorId).filter(action => action.reaction);
    return [{ id: "pass", name: "Без Реакции", available: true, reason: "Принять исходную Атаку без защиты", costModel: { amount: 0, resource: null } }, ...defenses];
  }

  function respondReaction(scene, data, request = {}) {
    const pending = scene.pendingAction;
    const actor = actorById(scene, request.actorId);
    const option = reactionOptions(scene, data, request.actorId).find(item => item.id === request.choice || item.name === request.choice);
    const errors = [];
    if (!pending || !actor) errors.push("Нет ожидающей Реакции для персонажа.");
    if (!option) errors.push("Неизвестный ответ на Реакцию.");
    if (option && !option.available) errors.push(option.reason || "Реакция недоступна.");
    if (option?.name === "Уворот") {
      const destination = request.destination;
      const space = (scene.spaces || []).find(item => item.id === actor?.space);
      const path = actor && destination ? movementPath(scene, actor.id, destination, { maxDistance: 2 }) : [];
      if (!destination || !space || !path.length || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Для Уворота выберите достижимую свободную клетку в пределах 2 клеток.");
      else if ((scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка Уворота занята.");
    }
    if (option?.name === "Столкновение") {
      const source = actorById(scene, pending?.actorId);
      const clash = request.clash;
      if (!source) errors.push("Атакующий для Столкновения не найден.");
      else if (distance(actor, source) > 5) errors.push("Атакующий вне дальности Стычки или Заклинания для Столкновения.");
      if (!clash?.defenderRoll || !clash?.attackerRoll || !Array.isArray(clash.defenderRoll.rolls) || !Array.isArray(clash.attackerRoll.rolls)) errors.push("Для Столкновения нужны оба встречных броска.");
    }
    if (errors.length) return { ok: false, errors, events: [] };
    const events = [];
    if (option.costModel?.resource && option.costModel.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: option.costModel });
    if (option.name === "Уворот") {
      const path = movementPath(scene, actor.id, request.destination, { maxDistance: 2 });
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y, movement: "Уворот", path: path.map(cellKey) } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y } });
    }
    let responseDestination = request.destination || null;
    if (option.name === "Блок") {
      const source = actorById(scene, pending.actorId), space = (scene.spaces || []).find(item => item.id === actor.space);
      const dx = actor.x - Number(source?.x), dy = actor.y - Number(source?.y), ax = Math.abs(dx), ay = Math.abs(dy), diagonal = ax && ay && Math.min(ax, ay) / Math.max(ax, ay) >= Math.SQRT2 - 1, directions = [];
      if (diagonal) directions.push({ x: Math.sign(dx), y: Math.sign(dy) });
      else if (ax >= ay && dx) directions.push({ x: Math.sign(dx), y: 0 });
      else if (dy) directions.push({ x: 0, y: Math.sign(dy) });
      const terrain = new Set((scene.objects || []).filter(object => object.space === actor.space && object.type === "terrain").flatMap(object => object.cells || []));
      const destination = directions.map(direction => ({ x: actor.x + direction.x, y: actor.y + direction.y })).find(point => point.x >= 0 && point.y >= 0 && point.x < Number(space?.width || 0) && point.y < Number(space?.height || 0) && !(scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === point.x && item.y === point.y));
      if (destination && !terrain.has(cellKey(destination))) {
        responseDestination = destination;
        events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Блок · отталкивание" } });
        events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y } });
      }
    }
    let clash = null;
    if (option.name === "Столкновение") {
      const defenderRoll = clone(request.clash.defenderRoll), attackerRoll = clone(request.clash.attackerRoll);
      const defenderWins = Number(defenderRoll.successes || 0) > Number(attackerRoll.successes || 0);
      clash = { defenderRoll, attackerRoll, defenderWins };
      events.push({ type: "roll.public", actorId: actor.id, payload: { ...defenderRoll, outcome: defenderWins ? "Столкновение выиграно: исходная Атака отменена" : "Столкновение проиграно" } });
      events.push({ type: "roll.public", actorId: pending.actorId, payload: { ...attackerRoll, outcome: defenderWins ? "Столкновение проиграно" : "Столкновение выиграно" } });
    }
    events.push({ type: "reaction.respond", actorId: actor.id, payload: { choice: option.id === "pass" ? "pass" : option.name, destination: responseDestination, clash } });
    return { ok: true, errors: [], events };
  }

  function resolvePendingAction(scene, data) {
    const pending = scene.pendingAction;
    const errors = [];
    if (!pending) errors.push("Нет ожидающего действия.");
    if (pending && Object.values(pending.responses || {}).some(response => response.choice === "pending")) errors.push("Не все цели ответили на Реакцию.");
    if (errors.length) return { ok: false, errors, events: [] };
    const source = actorById(scene, pending.actorId);
    const events = [];
    if (pending.roll) events.push({ type: "roll.public", actorId: pending.actorId, payload: pending.roll });
    for (const targetId of pending.targetIds || []) {
      const target = actorById(scene, targetId);
      const reaction = pending.responses[targetId] || {}, response = reaction.choice;
      const body = Number(target?.attrs?.body || 0);
      const dodge = Math.ceil(Math.max(Number(target?.attrs?.talent || 0), Number(target?.attrs?.mind || 0)) / 2);
      if (!(response === "Столкновение" && reaction.clash?.defenderWins)) {
        const temporaryArmor = response === "Блок" ? body : 0, temporaryEvasion = response === "Уворот" ? dodge : 0;
        const raw = Math.max(0, Number(pending.damage || 0)), armor = Math.max(0, Number(target?.armor || 0) + temporaryArmor), afterArmor = raw > 0 ? Math.max(1, raw - armor) : 0, evasion = Math.max(0, Number(target?.evasion || 0) + temporaryEvasion), expectedDamage = Math.max(0, afterArmor - Math.min(afterArmor, evasion));
        events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId, amount: pending.damage, temporaryArmor, temporaryEvasion, sourceActionId: pending.actionId } });
        if (expectedDamage > 0) for (const effect of pending.effects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect, sourceActionId: pending.actionId } });
      }
    }
    events.push({ type: pending.enemyRuleId ? "enemy.action.resolve" : "action.resolve", actorId: pending.actorId, payload: pending.enemyRuleId ? { ruleId: pending.enemyRuleId, name: pending.name, kind: "attack", targetIds: pending.targetIds, reward: pending.reward || "" } : { actionId: pending.actionId, name: pending.name, targetIds: pending.targetIds } });
    events.push({ type: "attack.clear", actorId: source?.id || pending.actorId, payload: { pendingId: pending.id } });
    return { ok: true, errors: [], events };
  }

  function projectScene(scene, viewer = {}) {
    const projected = clone(scene);
    const narrator = ["owner", "narrator", "gm"].includes(viewer.role);
    const ownActorIds = new Set(Array.isArray(viewer.actorIds) ? viewer.actorIds : []);
    if (!narrator) {
      projected.actors = (projected.actors || []).filter(actor => !actor.hidden).map(actor => {
        if (ownActorIds.has(actor.id)) return actor;
        const { notes, privateNotes, ownerId, ...publicActor } = actor;
        return publicActor;
      });
      const visibleActorIds = new Set(projected.actors.map(actor => actor.id));
      projected.objects = (projected.objects || []).filter(object => !object.hidden && (!object.ownerActorId || visibleActorIds.has(object.ownerActorId)));
      projected.markers = (projected.markers || []).filter(marker => marker.kind !== "hidden" && !marker.hidden);
      projected.artworks = (projected.artworks || []).filter(art => !art.hidden);
      projected.log = (projected.log || []).filter(event => event.visibility !== "gm" && event.payload?.visibility !== "gm");
      delete projected.undo;
    }
    return projected;
  }

  global.DAWN_SCENE_ENGINE = { VERSION, actionCost, availableActions, availableEnemyRules, dispatch, dispatchMany, movementPath, prepareAction, prepareEnemyRule, projectScene, reactionOptions, respondReaction, resolvePendingAction, roundEndStatus, turnStartStatus, validateEvent };
})(typeof window === "object" ? window : globalThis);
