"use strict";

(function exposeDawnSceneEngine(global) {
  const VERSION = 3;
  const EVENT_TYPES = new Set(["action.prepare", "action.resolve", "enemy.action.prepare", "enemy.action.resolve", "reaction.offer", "reaction.respond", "roll.public", "resource.spend", "resource.gain", "actor.move", "actor.enter", "turn.start", "turn.end", "round.end", "attack.pending", "attack.clear", "damage.apply", "effect.apply", "technique.prepare", "technique.resolve", "technique.manual", "area.create", "marker.create", "targets.set", "space.ensure"]);
  const RESOURCES = new Set(["ap", "focus", "influence"]);
  const clone = value => JSON.parse(JSON.stringify(value));
  const actorById = (scene, id) => (scene.actors || []).find(actor => actor.id === id) || null;
  const actionById = (data, id) => data?.actions?.list?.find(action => action.id === id) || null;
  const enemyProfileById = (data, id) => [...(data?.enemies?.common || []), ...(data?.enemies?.modifiers || [])].find(profile => profile.id === id) || null;
  const effectIdByName = (data, name) => [...(data?.effects?.positive || []), ...(data?.effects?.negative || [])].find(effect => effect.id === name || effect.name === name)?.id || name;
  const distance = (a, b) => a.space === b.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
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
      if ((scene.objects || []).length >= 240 || !space || !Array.isArray(payload.cells) || payload.cells.length > 144 || payload.cells.some(cell => {const match=String(cell).match(/^(\d{1,2}),(\d{1,2})$/);return !match||Number(match[1])>=space.width||Number(match[2])>=space.height}) || !["attack","gas","terrain","danger","portal","custom"].includes(payload.areaType)) throw new Error("Некорректная область Техники.");
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
          if (target.knockedOut) {
            scene.tension = Number(scene.tension || 0) + 1;
            if (scene.activeActorId === target.id) scene.activeActorId = null;
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
    } else if (event.type === "actor.enter" && actor) {
      const owner = id => actorById(scene, id);
      const cell = `${actor.x},${actor.y}`;
      const hazards = (scene.objects || []).filter(object => object.space === actor.space && object.cells?.includes(cell));
      if (hazards.some(object => object.type === "gas" && owner(object.ownerActorId)?.team !== actor.team)) {
        actor.effects ||= [];
        if (!actor.effects.includes("Ослаблен")) actor.effects.push("Ослаблен");
      }
    } else if (event.type === "turn.start" && actor) {
      scene.activeActorId = actor.id;
      actor.acted = false;
      actor.ap = Number(actor.baseAp || 3);
      scene.objects = (scene.objects || []).filter(object => !(object.duration === "nextTurn" && object.ownerActorId === actor.id));
      scene.markers = (scene.markers || []).filter(marker => !(marker.duration === "nextTurn" && marker.ownerActorId === actor.id));
    } else if (event.type === "turn.end" && actor) {
      actor.acted = true;
      actor.ap = 0;
      if (scene.activeActorId === actor.id) scene.activeActorId = null;
      scene.objects = (scene.objects || []).filter(object => !(object.duration === "endTurn" && object.ownerActorId === actor.id));
      scene.markers = (scene.markers || []).filter(marker => !(marker.duration === "endTurn" && marker.ownerActorId === actor.id));
    } else if (event.type === "round.end") {
      scene.round = Number(scene.round || 0) + 1;
      scene.tension = Number(scene.tension || 0) + 1;
      scene.activeActorId = null;
      scene.objects = (scene.objects || []).filter(object => !["instant", "round"].includes(object.duration));
      scene.markers = (scene.markers || []).filter(marker => marker.duration !== "round");
      (scene.actors || []).forEach(item => { item.acted = false; item.ap = Number(item.baseAp || 3); item.usedActions = []; });
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

  function availableActions(scene, data, actorId) {
    const actor = actorById(scene, actorId);
    if (!actor) return [];
    return (data?.actions?.list || []).map(action => {
      const cost = actionCost(action);
      const reaction = action.group === "Защита" || action.en === "Реакция";
      let reason = "";
      if (actor.knockedOut) reason = "Персонаж выведен из строя";
      else if (scene.pendingAction && !reaction) reason = "Сначала разрешите Реакцию";
      else if (!reaction && scene.activeActorId && scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
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

  function availableEnemyRules(scene, data, actorId) {
    const actor = actorById(scene, actorId);
    const profile = actor ? enemyProfileById(data, actor.profileId) : null;
    if (!actor || !profile) return [];
    return (profile.rules || []).map(rule => {
      let reason = "";
      if (actor.team !== "enemy") reason = "Это не противник";
      else if (actor.knockedOut) reason = "Противник выведен из строя";
      else if (scene.pendingAction) reason = "Сначала разрешите текущие Реакции";
      else if (scene.activeActorId && scene.activeActorId !== actor.id) reason = "Сейчас Ход другого участника";
      else if (actor.acted) reason = "Ход противника уже завершён";
      else if (Number(actor.ap || 0) < Number(rule.apCost || 1)) reason = `Нужно ${rule.apCost || 1} ОД`;
      else if ((actor.usedActions || []).includes(rule.id)) reason = "Это действие уже использовано в Раунде";
      else if (rule.kind === "trump" && actor.usedTrump) reason = "Козырь уже использован в этой Сцене";
      else if (rule.kind === "trump" && Number(scene.tension || 0) < Number(rule.tension || 0)) reason = `Нужно Напряжение ${rule.tension}`;
      return { ...clone(rule), available: !reason, reason };
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
    if (rule?.maxTargets && targets.length > Number(rule.maxTargets)) errors.push(`Можно выбрать не больше ${rule.maxTargets} целей.`);
    if (actor && rule?.adjacent && targets.some(target => distance(actor, target) > 1)) errors.push("Цель должна быть смежной.");
    if (actor && rule?.range && targets.some(target => distance(actor, target) > Number(rule.range))) errors.push(`Цель должна быть в пределах ${rule.range} клеток.`);
    const hasRoll = request.roll && Array.isArray(request.roll.rolls);
    const hasDirectDamage = Number.isFinite(Number(request.damage)) && Number(request.damage) >= 0;
    if (rule?.kind === "attack" && !hasRoll && !hasDirectDamage) errors.push("Для Атаки нужен бросок или прямой урон из профиля.");
    if (errors.length) return { ok: false, errors, events: [], rule: available || rule };
    const targetEffects = (rule.targetEffects || rule.effects || []).map(name => effectIdByName(data, name));
    const selfEffects = (rule.selfEffects || []).map(name => effectIdByName(data, name));
    const payload = { ruleId: rule.id, profileId: profile.id, name: rule.name, kind: rule.kind, targetIds, text: rule.text, reward: rule.reward, automation: rule.kind === "attack" ? "attack" : (targetEffects.length || selfEffects.length ? "effect" : "assisted") };
    const events = [{ type: "enemy.action.prepare", actorId: actor.id, payload }, { type: "resource.spend", actorId: actor.id, payload: { resource: "ap", amount: Number(rule.apCost || 1) } }];
    selfEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: actor.id, effect, sourceActionId: rule.id } }));
    if (affectedCells.length) events.push({ type: "area.create", actorId: actor.id, payload: { id: `area-${eventId()}`, space: actor.space, areaType: rule.kind === "attack" ? "attack" : "danger", label: rule.name, source: rule.id, duration: rule.kind === "attack" ? "instant" : "scene", ownerActorId: actor.id, cells: affectedCells } });
    if (rule.kind === "attack") {
      targets.forEach(target => events.push({ type: "reaction.offer", actorId: target.id, payload: { sourceActorId: actor.id, actionId: rule.id } }));
      const damage = hasRoll ? Number(request.roll.successes || 0) + Number(scene.tension || 0) * Number(rule.tensionMultiplier || 0) : Number(request.damage);
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: rule.id, enemyRuleId: rule.id, name: rule.name, targetIds, roll: hasRoll ? clone(request.roll) : null, damage, effects: targetEffects, reward: rule.reward || "" } });
    } else {
      targets.forEach(target => targetEffects.forEach(effect => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect, sourceActionId: rule.id } })));
      events.push({ type: "enemy.action.resolve", actorId: actor.id, payload });
    }
    return { ok: true, errors: [], events, rule: available || clone(rule) };
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
      for (const effect of pending.effects || []) events.push({ type: "effect.apply", actorId: pending.actorId, payload: { targetId, effect, sourceActionId: pending.actionId } });
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

  global.DAWN_SCENE_ENGINE = { VERSION, actionCost, availableActions, availableEnemyRules, dispatch, dispatchMany, prepareAction, prepareEnemyRule, projectScene, reactionOptions, respondReaction, resolvePendingAction, validateEvent };
})(typeof window === "object" ? window : globalThis);
