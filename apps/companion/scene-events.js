"use strict";

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
  if (event.type === "marker.move") {
    const marker = markerById(scene, payload.markerId), space = (scene.spaces || []).find(item => item.id === (payload.space || marker?.space));
    if (!marker || !space || !Number.isInteger(Number(payload.x)) || !Number.isInteger(Number(payload.y)) || Number(payload.x) < 0 || Number(payload.y) < 0 || Number(payload.x) >= space.width || Number(payload.y) >= space.height) throw new Error("Некорректное перемещение маркера.");
  }
  if (event.type === "marker.remove" && !markerById(scene, payload.markerId)) throw new Error("Удаляемый маркер уже отсутствует.");
  if (event.type === "object.damage") {
    const object = (scene.objects || []).find(item => item.id === payload.objectId);
    if (!object || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999) throw new Error("Некорректное повреждение местности.");
  }
  if (event.type === "roll.public") {
    if (!Array.isArray(payload.rolls) || payload.rolls.length > 300 || payload.rolls.some(value => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 6)) throw new Error("Некорректный публичный бросок.");
  }
  if (event.type === "attack.pending") {
    if (!Array.isArray(payload.targetIds) || payload.targetIds.length > 40 || payload.targetIds.some(id => !actorById(scene, id) || actorById(scene, id).knockedOut) || !finite(payload.damage) || Number(payload.damage) < 0 || Number(payload.damage) > 9999) throw new Error("Некорректные параметры атаки.");
  }
  if (event.type === "effect.apply" && (!actorById(scene, payload.targetId) || typeof payload.effect !== "string" || !payload.effect.trim() || payload.effect.length > 80)) throw new Error("Некорректный Эффект.");
  if (event.type === "effect.remove" && (!actorById(scene, payload.targetId) || typeof payload.effect !== "string" || !payload.effect.trim() || payload.effect.length > 80)) throw new Error("Некорректное удаление Эффекта.");
  if (event.type === "actor.heal" && (!actorById(scene, payload.targetId) || !finite(payload.amount) || Number(payload.amount) < 0 || Number(payload.amount) > 9999)) throw new Error("Некорректное исцеление.");
  if (event.type === "actor.knockout" && !actorById(scene, payload.targetId)) throw new Error("Некорректное выведение из строя.");
  if (event.type === "inventory.change" && (typeof payload.item !== "string" || payload.item.length > 80 || !Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) > 99)) throw new Error("Некорректное изменение инвентаря.");
  if (event.type === "rule.prompt" && (typeof payload.id !== "string" || typeof payload.kind !== "string" || !Array.isArray(payload.options) || payload.options.length < 1 || payload.options.length > 12)) throw new Error("Некорректный запрос правила.");
  if (event.type === "rule.respond" && (!scene.pendingPrompt || payload.promptId !== scene.pendingPrompt.id || typeof payload.choice !== "string")) throw new Error("Этот запрос правила уже закрыт.");
  if (event.type === "technique.state") {
    if (!actorById(scene, event.actorId) || !["cunningPlan", "study", "spellModifiers"].includes(payload.key)) throw new Error("Некорректное состояние Техники.");
    if (payload.key === "cunningPlan" && (!Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) > 4)) throw new Error("Некорректное изменение часов Хитрого плана.");
    if (payload.key === "study" && (!actorById(scene, payload.targetId) || typeof payload.targetId !== "string")) throw new Error("Некорректная цель Хитрого плана.");
    if (payload.key === "spellModifiers" && (!Array.isArray(payload.value) || payload.value.length > 2 || payload.value.some(value => !["fierce", "focused", "wild", "outstanding"].includes(value)))) throw new Error("Некорректный выбор Модификаций.");
  }
  if (event.type === "actor.state") {
    if (!actorById(scene, event.actorId) || !ACTOR_STATE_KEYS.has(payload.key)) throw new Error("Некорректное состояние персонажа.");
    if (payload.key === "pugilistStance" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 1 || Number(payload.value) > 4)) throw new Error("Шаг стойки должен быть от 1 до 4.");
    if (payload.key === "growth" && (!Number.isInteger(Number(payload.delta)) || Math.abs(Number(payload.delta)) > 20)) throw new Error("Некорректное изменение Роста.");
    if (["martialPerfection", "imposingPresence"].includes(payload.key) && typeof payload.value !== "boolean") throw new Error("Некорректный переключатель состояния.");
    if (["grimTransformed", "grimUsed", "drainLife"].includes(payload.key) && typeof payload.value !== "boolean") throw new Error("Некорректный переключатель Техники.");
    if (payload.key === "lastCreationSpellMarks" && (!Number.isInteger(Number(payload.value)) || Number(payload.value) < 0 || Number(payload.value) > 99)) throw new Error("Некорректное число Меток творения.");
  }
  if (event.type === "turn.grant" && (!actorById(scene, event.actorId) || !Number.isInteger(Number(payload.amount)) || Number(payload.amount) < 1 || Number(payload.amount) > 4)) throw new Error("Некорректный дополнительный Ход.");
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
  if (event.type === "targets.set" && (!Array.isArray(payload.actorIds) || payload.actorIds.length > 40 || payload.actorIds.some(id => !actorById(scene, id) || actorById(scene, id).knockedOut))) throw new Error("Некорректный список целей.");
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
  if (["action.prepare", "enemy.action.prepare", "attack.pending"].includes(event.type) && scene.activeActorId !== event.actorId && !event.payload?.quickReaction) {
    throw new Error(actor ? `Сейчас не Ход «${actor.name}».` : "Исполнитель действия не найден.");
  }
  if (event.type === "area.remove" && (!(scene.objects || []).some(object => object.id === event.payload?.id))) throw new Error("Удаляемая местность уже отсутствует.");
  if (event.type === "resource.spend" && actor && Number(event.payload?.amount || 0) > Number(actor[event.payload?.resource] || 0)) {
    throw new Error("Ресурс изменился: выбранное действие больше нельзя оплатить.");
  }
  if (event.type === "rule.prompt" && scene.pendingPrompt) throw new Error("Сначала ответьте на уже открытый запрос правила.");
  if (event.type === "reaction.respond") {
    const response = scene.pendingAction?.responses?.[event.actorId];
    if (!response || response.choice !== "pending") throw new Error("Эта Реакция уже закрыта или не предлагалась.");
    if (actor?.knockedOut) throw new Error("Персонаж уже вне боя и не может Реагировать.");
    const source = actorById(scene, scene.pendingAction?.actorId);
    if (!source || source.knockedOut) throw new Error("Атакующий уже вне боя; цепочку нужно закрыть.");
  }
  if (event.type === "attack.clear") {
    if (!scene.pendingAction) throw new Error("Ожидающей Атаки уже нет.");
    if (event.payload?.pendingId && event.payload.pendingId !== scene.pendingAction.id) throw new Error("Эта цепочка Атаки уже устарела.");
  }
}

function advanceComboCooldowns(actor) {
  actor.comboCooldowns ||= {};
  Object.keys(actor.comboCooldowns).forEach(ruleId => {
    actor.comboCooldowns[ruleId] = Math.max(0, Number(actor.comboCooldowns[ruleId] || 0) - 1);
    if (!actor.comboCooldowns[ruleId]) delete actor.comboCooldowns[ruleId];
  });
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
    const gained = Math.max(0, Number(actor[key] || 0) + Math.max(0, Number(payload.amount || 0)));
    actor[key] = key === "meals" ? Math.min(Number(actor.maxMeals || gained), gained) : gained;
  } else if (event.type === "actor.move" && actor) {
    payload.from ||= { space: actor.space, x: Number(actor.x), y: Number(actor.y) };
    Object.assign(actor, { space: payload.space || actor.space, x: Number(payload.x), y: Number(payload.y) });
  } else if (event.type === "area.create") {
    scene.objects ||= [];
    scene.objects.push({ id: payload.id, space: payload.space, type: payload.areaType, label: payload.label, source: payload.source, ruleId: payload.ruleId || payload.source || "", duration: payload.duration, ownerActorId: payload.ownerActorId || event.actorId, cells: [...payload.cells], hp: Number(payload.hp ?? payload.metadata?.hp ?? 0), maxHp: Number(payload.maxHp ?? payload.metadata?.maxHp ?? payload.hp ?? 0), createdRound: Number(scene.round || 1), metadata: clone(payload.metadata || {}) });
  } else if (event.type === "area.remove") {
    const removed = (scene.objects || []).find(object => object.id === payload.id);
    payload.label = removed?.label || payload.label || "местность";
    scene.objects = (scene.objects || []).filter(object => object.id !== payload.id);
  } else if (event.type === "object.damage") {
    const object = (scene.objects || []).find(item => item.id === payload.objectId);
    if (object) {
      const fallback = Math.max(1, Number(object.cells?.length || 1) * 10), before = Number(object.hp || object.maxHp || fallback);
      object.maxHp = Math.max(before, Number(object.maxHp || before));
      object.hp = Math.max(0, before - Number(payload.amount || 0));
      payload.dealt = before - object.hp;
      payload.destroyed = object.hp === 0;
      payload.label = object.label;
      if (payload.destroyed) scene.objects = (scene.objects || []).filter(item => item.id !== object.id);
    }
  } else if (event.type === "marker.create") {
    scene.markers ||= [];
    scene.markers.push({ id: payload.id, space: payload.space, x: Number(payload.x), y: Number(payload.y), kind: payload.markerKind, label: payload.label, color: payload.color, source: payload.source, ruleId: payload.ruleId || payload.source || "", duration: payload.duration, ownerActorId: payload.ownerActorId || event.actorId, createdRound: Number(scene.round || 1), metadata: clone(payload.metadata || {}) });
  } else if (event.type === "marker.move") {
    const marker = markerById(scene, payload.markerId);
    if (marker) {
      payload.from ||= { space: marker.space, x: marker.x, y: marker.y };
      Object.assign(marker, { space: payload.space || marker.space, x: Number(payload.x), y: Number(payload.y) });
    }
  } else if (event.type === "marker.remove") {
    const marker = markerById(scene, payload.markerId);
    payload.label = marker?.label || payload.label || "маркер";
    scene.markers = (scene.markers || []).filter(item => item.id !== payload.markerId);
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
      if (target.knockedOut) {
        payload.ignored = true;
        payload.dealt = 0;
        scene.log ||= [];
        scene.log.unshift(event);
        scene.log = scene.log.slice(0, 200);
        return;
      }
      const raw = Math.max(0, Number(payload.amount || 0));
      const armor = payload.ignoreArmor ? 0 : Math.max(0, Number(target.armor || 0) + Number(payload.temporaryArmor || 0));
      const afterArmor = raw > 0 ? Math.max(1, raw - armor) : 0;
      const evasion = Math.max(0, Number(target.evasion || 0) + Number(payload.temporaryEvasion || 0));
      const evaded = Math.min(afterArmor, evasion);
      target.evasion = Math.max(0, Number(target.evasion || 0) - Math.max(0, evaded - Number(payload.temporaryEvasion || 0)));
      const dealt = Math.max(0, afterArmor - evaded);
      const grimRedirect = Boolean(target.ruleState?.grimTransformed);
      if (grimRedirect) target.focus = Math.max(0, Number(target.focus || 0) - dealt);
      else target.hp = Math.max(0, Number(target.hp || 0) - dealt);
      payload.raw = raw;
      payload.armor = armor;
      payload.evaded = evaded;
      payload.dealt = dealt;
      payload.redirectedResource = grimRedirect ? "focus" : null;
      if (!grimRedirect && target.hp === 0 && dealt > 0) {
        const guts = Math.max(0, Number(target.guts ?? (target.team === "enemy" ? 0 : 1 + Number(target.attrs?.body || 0))));
        target.wounds = Math.max(0, Number(target.wounds || 0));
        if (guts === 0) target.knockedOut = true;
        else {
          target.wounds += 1;
          payload.woundGained = true;
          if (event.actorId !== target.id) target.influence = Math.max(0, Number(target.influence || 0) + 1);
          if (target.wounds >= guts) {
            target.wounds -= 1;
            target.knockedOut = true;
          } else target.hp = guts;
        }
        if (target.knockedOut) {
          scene.tension = Number(scene.tension || 0) + 1;
          scene.targetIds = (scene.targetIds || []).filter(id => id !== target.id);
          if (scene.pendingAction?.responses?.[target.id]?.choice === "pending") scene.pendingAction.responses[target.id] = { choice: "unavailable", reason: "Цель выведена из боя" };
          if (scene.pendingAction?.actorId === target.id) scene.pendingAction.interruptedReason = "Атакующий выведен из боя";
          if (scene.activeActorId === target.id) {
            target.acted = true;
            target.stepRemaining = 0;
            target.extraTurns = 0;
            advanceComboCooldowns(target);
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
      payload.applied = !target.effects.includes(payload.effect);
      if (payload.applied) target.effects.push(payload.effect);
    }
  } else if (event.type === "effect.remove") {
    const target = actorById(scene, payload.targetId);
    if (target) {
      payload.removed = (target.effects || []).includes(payload.effect);
      target.effects = (target.effects || []).filter(effect => effect !== payload.effect);
    }
  } else if (event.type === "actor.heal") {
    const target = actorById(scene, payload.targetId);
    if (target) {
      const grimRedirect = Boolean(target.ruleState?.grimTransformed), key = grimRedirect ? "focus" : "hp", before = Number(target[key] || 0);
      target[key] = grimRedirect ? before + Number(payload.amount || 0) : Math.min(Number(target.maxHp || before + Number(payload.amount || 0)), before + Number(payload.amount || 0));
      payload.restored = target[key] - before;
      payload.redirectedResource = grimRedirect ? "focus" : null;
    }
  } else if (event.type === "actor.knockout") {
    const target = actorById(scene, payload.targetId);
    if (target && !target.knockedOut) {
      target.hp = 0;
      target.knockedOut = true;
      scene.targetIds = (scene.targetIds || []).filter(id => id !== target.id);
      if (scene.activeActorId === target.id) scene.activeActorId = null;
      payload.applied = true;
    } else payload.applied = false;
  } else if (event.type === "inventory.change" && actor) {
    actor.inventory ||= {};
    actor.inventory[payload.item] = Math.max(0, Number(actor.inventory[payload.item] || 0) + Number(payload.delta || 0));
    if (!actor.inventory[payload.item]) delete actor.inventory[payload.item];
  } else if (event.type === "rule.prompt") {
    scene.pendingPrompt = { id: payload.id, kind: payload.kind, actorId: event.actorId, sourceActorId: payload.sourceActorId || event.actorId, targetId: payload.targetId || null, markerId: payload.markerId || null, title: payload.title || "Решение правила", text: payload.text || "", options: clone(payload.options || []), context: clone(payload.context || {}) };
  } else if (event.type === "rule.respond") {
    payload.kind = scene.pendingPrompt?.kind || payload.kind;
    payload.sourceActorId = scene.pendingPrompt?.sourceActorId || null;
    payload.targetId = scene.pendingPrompt?.targetId || null;
    scene.pendingPrompt = null;
  } else if (event.type === "technique.state" && actor) {
    actor.techniqueState ||= {};
    if (payload.key === "cunningPlan") actor.techniqueState.cunningPlan = Math.max(0, Math.min(4, Number(actor.techniqueState.cunningPlan || 0) + Number(payload.delta || 0)));
    if (payload.key === "study") {
      actor.techniqueState.studiedActorIds ||= [];
      if (!actor.techniqueState.studiedActorIds.includes(payload.targetId)) {
        actor.techniqueState.studiedActorIds.push(payload.targetId);
        actor.techniqueState.cunningPlan = Math.min(4, Number(actor.techniqueState.cunningPlan || 0) + 1);
      }
    }
    if (payload.key === "spellModifiers") actor.techniqueState.spellModifiers = [...new Set(payload.value || [])].slice(0, 2);
  } else if (event.type === "actor.state" && actor) {
    actor.ruleState ||= {};
    if (payload.key === "growth") actor.ruleState.growth = Math.max(0, Number(actor.ruleState.growth || 0) + Number(payload.delta || 0));
    else {
      actor.ruleState[payload.key] = payload.value;
      if (payload.key === "grimTransformed" && payload.value) actor.hp = Math.min(Number(actor.hp || 0), 1);
      if (payload.key === "grimTransformed" && !payload.value) actor.ruleState.drainLife = false;
    }
  } else if (event.type === "turn.grant" && actor) {
    actor.extraTurns = Math.max(0, Number(actor.extraTurns || 0) + Number(payload.amount || 0));
  } else if (event.type === "enemy.action.prepare" && actor) {
    actor.usedActions ||= [];
    if (!actor.usedActions.includes(payload.ruleId)) actor.usedActions.push(payload.ruleId);
    if (payload.kind === "trump") actor.usedTrump = true;
  } else if (event.type === "action.prepare" && actor) {
    actor.usedActions ||= [];
    if (payload.actionId && !payload.quick && !payload.continuation && !actor.usedActions.includes(payload.actionId)) actor.usedActions.push(payload.actionId);
    if (payload.actionName === "Шаг" || payload.name === "Шаг") actor.stepRemaining = Math.max(0, Number(payload.stepRemaining || 0));
  } else if (event.type === "technique.prepare" && actor) {
    if (payload.cooldownTurns && payload.ruleId) {
      actor.comboCooldowns ||= {};
      actor.comboCooldowns[payload.ruleId] = Math.max(Number(actor.comboCooldowns[payload.ruleId] || 0), Number(payload.cooldownTurns || 0));
    }
  } else if (event.type === "actor.enter" && actor) {
    const cell = `${actor.x},${actor.y}`;
    const hazards = (scene.objects || []).filter(object => object.space === actor.space && object.cells?.includes(cell));
    if (!payload.ignoreDifficult && hazards.some(object => object.type === "difficult")) {
      actor.speedZeroUntilTurnEnd = true;
      actor.stepRemaining = 0;
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
    advanceComboCooldowns(actor);
    (scene.actors || []).forEach(item => { item.speedZeroUntilTurnEnd = false; });
    if (Number(actor.extraTurns || 0) > 0) {
      actor.extraTurns -= 1;
      actor.acted = false;
      actor.ap = Number(actor.baseAp || (actor.team === "enemy" ? 2 : 3));
      scene.activeActorId = actor.id;
      payload.startedExtraTurn = true;
    } else {
      if (actor.team === "enemy") actor.ap = 0;
      if (scene.activeActorId === actor.id) scene.activeActorId = null;
    }
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

function squareCells(scene, actor, center, radius = 1) {
  const space = (scene.spaces || []).find(item => item.id === actor?.space);
  const cells = [];
  if (!space) return cells;
  for (let y = center.y - radius; y <= center.y + radius; y += 1) for (let x = center.x - radius; x <= center.x + radius; x += 1) {
    if (x >= 0 && y >= 0 && x < space.width && y < space.height) cells.push(`${x},${y}`);
  }
  return cells;
}
