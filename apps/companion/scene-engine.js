"use strict";

(function exposeDawnSceneEngine(global) {
  const VERSION = 1;
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
    } else if (event.type === "damage.apply") {
      const target = actorById(scene, payload.targetId);
      if (target) {
        const armor = payload.ignoreArmor ? 0 : Math.max(0, Number(target.armor || 0));
        const dealt = Math.max(0, Number(payload.amount || 0) - armor);
        target.hp = Math.max(0, Number(target.hp || 0) - dealt);
        payload.dealt = dealt;
      }
    } else if (event.type === "turn.end" && actor) {
      actor.acted = true;
      actor.ap = 0;
    } else if (event.type === "round.end") {
      scene.round = Number(scene.round || 0) + 1;
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
      if (!reaction && actor.acted) reason = "Ход уже завершён";
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
      else events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: action.name } });
    } else if (["Стычка", "Заклинание", "Завершение"].includes(action.name)) {
      const limit = action.name === "Заклинание" ? 5 : 1;
      if (!targets.length) errors.push("Выберите цель атаки.");
      if (targets.some(target => distance(actor, target) > limit)) errors.push(`Цель должна быть в пределах ${limit} клеток.`);
      targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: action.id } }));
      if (request.roll) {
        events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
        const bonus = action.name === "Завершение" ? Number(scene.tension || 0) : 0;
        targets.forEach(target => events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount: Number(request.roll.successes || 0) + bonus } }));
      }
    } else if (action.name === "Передышка") {
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: 1 } });
    } else if (action.name === "Зарядка" && request.roll) {
      events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: Math.max(2, Number(request.roll.successes || 0)) } });
    }
    events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: action.id, name: action.name, text: action.text } });
    return { ok: errors.length === 0, errors, action: available, events: errors.length ? [] : events };
  }

  global.DAWN_SCENE_ENGINE = { VERSION, actionCost, availableActions, dispatch, dispatchMany, prepareAction };
})(typeof window === "object" ? window : globalThis);
