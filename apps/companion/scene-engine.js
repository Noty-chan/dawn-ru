"use strict";

(function exposeDawnSceneEngine(global) {
  const VERSION = 2;
  const clone = value => JSON.parse(JSON.stringify(value));
  const actorById = (scene, id) => (scene.actors || []).find(actor => actor.id === id) || null;
  const actionById = (data, id) => data?.actions?.list?.find(action => action.id === id) || null;
  const distance = (a, b) => a.space === b.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
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
    } else if (event.type === "roll.public") {
      scene.rollFeed ||= [];
      scene.rollFeed.unshift({ id: event.id, actor: actor?.name || payload.actor || "Система", formula: payload.formula, rolls: payload.rolls || [], successes: Number(payload.successes || 0), crits: Number(payload.crits || 0) });
      scene.rollFeed = scene.rollFeed.slice(0, 20);
    } else if (event.type === "attack.pending") {
      scene.pendingAction = { id: event.id, actorId: event.actorId, ...clone(payload), responses: Object.fromEntries((payload.targetIds || []).map(id => [id, { choice: "pending" }])) };
    } else if (event.type === "reaction.respond" && scene.pendingAction) {
      scene.pendingAction.responses[event.actorId] = { choice: payload.choice, destination: payload.destination || null };
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
          if (target.knockedOut) scene.tension = Number(scene.tension || 0) + 1;
        }
      }
    } else if (event.type === "actor.enter" && actor) {
      const owner = id => actorById(scene, id);
      const cell = `${actor.x},${actor.y}`;
      const hazards = (scene.objects || []).filter(object => object.space === actor.space && object.cells?.includes(cell));
      if (hazards.some(object => object.type === "gas" && owner(object.ownerActorId)?.team !== actor.team)) {
        actor.effects ||= [];
        if (!actor.effects.includes("Ослаблен")) actor.effects.push("Ослаблен");
      }
    } else if (event.type === "turn.start" && actor) {
      actor.acted = false;
      actor.ap = Number(actor.baseAp || 3);
      scene.objects = (scene.objects || []).filter(object => !(object.duration === "nextTurn" && object.ownerActorId === actor.id));
      scene.markers = (scene.markers || []).filter(marker => !(marker.duration === "nextTurn" && marker.ownerActorId === actor.id));
    } else if (event.type === "turn.end" && actor) {
      actor.acted = true;
      actor.ap = 0;
    } else if (event.type === "round.end") {
      scene.round = Number(scene.round || 0) + 1;
      scene.tension = Number(scene.tension || 0) + 1;
      scene.objects = (scene.objects || []).filter(object => object.duration !== "round");
      scene.markers = (scene.markers || []).filter(marker => marker.duration !== "round");
      (scene.actors || []).forEach(item => { item.acted = false; item.ap = Number(item.baseAp || 3); });
    }
    scene.log ||= [];
    scene.log.unshift(event);
    scene.log = scene.log.slice(0, 200);
  }

  function dispatch(scene, event, options = {}) {
    const next = clone(scene);
    const normalized = normalizeEvent(event, options);
    reduceEvent(next, normalized);
    next.version = Number(next.version || 0) + 1;
    return { scene: next, event: normalized };
  }

  function dispatchMany(scene, events, options = {}) {
    let next = clone(scene);
    const committed = [];
    for (const event of events || []) {
      const result = dispatch(next, event, options);
      next = result.scene;
      committed.push(result.event);
    }
    return { scene: next, events: committed };
  }

  function availableActions(scene, data, actorId) {
    const actor = actorById(scene, actorId);
    if (!actor) return [];
    return (data?.actions?.list || []).map(action => {
      const cost = actionCost(action);
      const reaction = action.group === "Защита" || action.en === "Реакция";
      let reason = "";
      if (actor.knockedOut) reason = "Персонаж выведен из строя";
      else if (scene.pendingAction && !reaction) reason = "Сначала разрешите Реакцию";
      else if (!reaction && actor.acted) reason = "Ход уже завершён";
      else if (cost.resource && Number(actor[cost.resource] || 0) < cost.amount) reason = `Недостаточно: ${action.cost}`;
      return { ...clone(action), costModel: cost, reaction, available: !reason, reason };
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
    const events = [{ type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, name: action.name, targetIds } }];
    const cost = actionCost(action);
    if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });

    if (["Шаг", "Прыжок"].includes(action.name)) {
      const destination = request.destination;
      const space = (scene.spaces || []).find(item => item.id === actor.space);
      if (!destination || !space || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Выберите свободную клетку назначения.");
      else if ((scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка назначения занята.");
      else {
        events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: action.name } });
        events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y } });
      }
    } else if (["Стычка", "Заклинание", "Завершение"].includes(action.name)) {
      const limit = action.name === "Заклинание" ? 5 : 1;
      if (!targets.length) errors.push("Выберите цель атаки.");
      if (targets.some(target => distance(actor, target) > limit)) errors.push(`Цель должна быть в пределах ${limit} клеток.`);
      targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: action.id } }));
      const bonus = action.name === "Завершение" ? Number(scene.tension || 0) : 0;
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, name: action.name, targetIds, roll: clone(request.roll || null), damage: Number(request.roll?.successes || 0) + bonus } });
    } else if (action.name === "Передышка") {
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: 1 } });
    } else if (action.name === "Зарядка" && request.roll) {
      events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: Math.max(2, Number(request.roll.successes || 0)) } });
    }
    if (!["Стычка", "Заклинание", "Завершение"].includes(action.name)) events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: action.id, name: action.name, text: action.text } });
    return { ok: errors.length === 0, errors, action: available, events: errors.length ? [] : events };
  }

  function reactionOptions(scene, data, actorId) {
    const actor = actorById(scene, actorId);
    if (!actor || !scene.pendingAction?.responses?.[actorId]) return [];
    const defenses = availableActions(scene, data, actorId).filter(action => action.reaction);
    return [{ id: "pass", name: "Без Реакции", available: true, costModel: { amount: 0, resource: null } }, ...defenses.map(action => ({ ...action, available: action.name !== "Столкновение" && action.available, reason: action.name === "Столкновение" ? "Встречный бросок пока разрешается вручную" : action.reason }))];
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
      const moveDistance = destination && actor ? Math.abs(actor.x - destination.x) + Math.abs(actor.y - destination.y) : 0;
      if (!destination || !space || moveDistance < 1 || moveDistance > 2 || destination.x < 0 || destination.y < 0 || destination.x >= space.width || destination.y >= space.height) errors.push("Для Уворота выберите свободную клетку в пределах 2 клеток.");
      else if ((scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка Уворота занята.");
    }
    if (errors.length) return { ok: false, errors, events: [] };
    const events = [];
    if (option.costModel?.resource && option.costModel.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: option.costModel });
    if (option.name === "Уворот") {
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y, movement: "Уворот" } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: request.destination.x, y: request.destination.y } });
    }
    events.push({ type: "reaction.respond", actorId: actor.id, payload: { choice: option.id === "pass" ? "pass" : option.name, destination: request.destination || null } });
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
      const response = pending.responses[targetId]?.choice;
      const body = Number(target?.attrs?.body || 0);
      const dodge = Math.ceil(Math.max(Number(target?.attrs?.talent || 0), Number(target?.attrs?.mind || 0)) / 2);
      events.push({ type: "damage.apply", actorId: pending.actorId, payload: { targetId, amount: pending.damage, temporaryArmor: response === "Блок" ? body : 0, temporaryEvasion: response === "Уворот" ? dodge : 0, sourceActionId: pending.actionId } });
    }
    events.push({ type: "action.resolve", actorId: pending.actorId, payload: { actionId: pending.actionId, name: pending.name, targetIds: pending.targetIds } });
    events.push({ type: "attack.clear", actorId: source?.id || pending.actorId, payload: { pendingId: pending.id } });
    return { ok: true, errors: [], events };
  }

  global.DAWN_SCENE_ENGINE = { VERSION, actionCost, availableActions, dispatch, dispatchMany, prepareAction, reactionOptions, respondReaction, resolvePendingAction };
})(typeof window === "object" ? window : globalThis);
