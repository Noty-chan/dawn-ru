"use strict";

const WISP_TYPES = {
  dreamy: { label: "Мечтательный дух", effect: "negative.замедлен", audience: "enemies" },
  angry: { label: "Злой дух", effect: "negative.порчен", audience: "enemies" },
  insightful: { label: "Проницательный дух", effect: "negative.помечен", audience: "enemies" },
  bright: { label: "Яркий дух", effect: "positive.ускорен", audience: "allies" },
  kind: { label: "Добрый дух", effect: "positive.регенерирует", audience: "allies" },
  fierce: { label: "Яростный дух", effect: "positive.усилен", audience: "allies" },
};
const wispMarkers = (scene, ownerId) => (scene.markers || []).filter(marker => marker.ownerActorId === ownerId && /altruist\.will-o-wisp\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`));

function triggeredEvents(scene, event) {
  const payload = event.payload || {}, actor = event.actorId ? actorById(scene, event.actorId) : null, events = [], promptQueued = () => events.some(item => item.type === "rule.prompt");
  if (event.type === "action.prepare" && actor && hasEffect(scene, actor, "positive.исчез")) {
    events.push({ type: "effect.remove", actorId: actor.id, payload: { targetId: actor.id, effect: "positive.исчез", sourceActionId: payload.actionId, participantIds: [actor.id] } });
  }
  if (event.type === "action.prepare" && actor && ["Стычка", "Заклинание", "Завершение"].includes(payload.actionName || payload.name) && hasEffect(scene, actor, "negative.порчен")) {
    events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: actor.id, amount: Number(actor.tier || 1), ignoreArmor: true, sourceActionId: "negative.порчен", participantIds: [actor.id] } });
  }
  if (event.type === "turn.start" && actor && hasEffect(scene, actor, "positive.исчез") && !scene.pendingPrompt) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-reappear`, kind: "reappear-cell", sourceActorId: actor.id, title: "Возвращение на поле", text: "Выберите свободную клетку, не смежную с персонажами.", options: ["cancel"], context: { actorId: actor.id } } });
  }
  if (event.type === "turn.start" && actor && !scene.pendingPrompt && !promptQueued()) {
    const empath = (scene.actors || []).find(owner => !owner.knockedOut && owner.team === actor.team && owner.id !== actor.id && Number(owner.techniques?.["altruist.empath"] || 0) >= 1 && distance(owner, actor) <= 1);
    if (empath && (actor.effects || []).length) events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-empath`, kind: "empath-calm", sourceActorId: empath.id, targetId: actor.id, title: "Успокаивающая аура", text: "Можно потерять один Эффект и стать Усиленным.", options: [...actor.effects.slice(0, 11), "pass"], participantIds: [empath.id, actor.id] } });
  }
  if (event.type === "action.resolve" && actor && payload.name === "Передышка" && Number(actor.techniques?.["altruist.alchemist"] || 0) >= 1 && !scene.pendingPrompt) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}`, kind: "alchemist-mix", sourceActorId: actor.id, title: "Быстрая смесь", text: "Передышка позволяет создать одно Зелье.", options: ["pure-water", "rage-fumes", "growth-serum", "adrenaline", "stone-skin", "thorn-rot"] } });
  }
  if (event.type === "action.resolve" && actor && payload.name === "Зарядка" && Number(actor.techniques?.["ruiner.grim-ascendant"] || 0) >= 1 && Number(scene.tension || 0) >= 2 && !actor.ruleState?.grimUsed && !scene.pendingPrompt && !promptQueued()) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-grim`, kind: "grim-transform", sourceActorId: actor.id, title: "Непостоянная мощь", text: "Трансформироваться: получить 2 ОД, обратить потерянное Здоровье в удвоенный Фокус и оттолкнуть ближайших врагов?", options: ["transform", "pass"], participantIds: [actor.id] } });
  }
  if (event.type === "action.resolve" && actor && payload.name === "Зарядка" && Number(actor.techniques?.["altruist.will-o-wisp"] || 0) >= 1 && !wispMarkers(scene, actor.id).length && !scene.pendingPrompt && !promptQueued()) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-wisp`, kind: "wisp-primary", sourceActorId: actor.id, title: "Пламя духовного плетения", text: "Выберите первый Дух для Духовного пламени.", options: [...Object.keys(WISP_TYPES), "pass"], participantIds: [actor.id] } });
  }
  if ((event.type === "action.resolve" && payload.name === "Шаг" && !payload.continuation || event.type === "turn.end") && actor && Number(actor.techniques?.["altruist.will-o-wisp"] || 0) >= 1 && wispMarkers(scene, actor.id).length && !scene.pendingPrompt && !promptQueued()) {
    events.push({ type: "rule.prompt", actorId: actor.id, payload: { id: `prompt-${event.id}-wisp-move`, kind: "wisp-move-select", sourceActorId: actor.id, title: "Духовное пламя", text: "Можно переместить одно Духовное пламя на расстояние до 4 клеток.", options: [...wispMarkers(scene, actor.id).map(marker => marker.id), "pass"], participantIds: [actor.id] } });
  }
  if (event.type === "turn.end" && actor && hasEffect(scene, actor, "positive.регенерирует")) events.push({ type: "actor.heal", actorId: actor.id, payload: { targetId: actor.id, amount: Number(actor.tier || 1), sourceActionId: "positive.регенерирует", participantIds: [actor.id] } });
  if (event.type === "damage.apply" && actorById(scene, payload.targetId)?.ruleState?.grimTransformed && Number(actorById(scene, payload.targetId)?.focus || 0) === 0) {
    const target = actorById(scene, payload.targetId);
    events.push({ type: "actor.state", actorId: target.id, payload: { key: "grimTransformed", value: false, sourceActionId: "ruiner.grim-ascendant.1" } });
    events.push({ type: "effect.apply", actorId: target.id, payload: { targetId: target.id, effect: "negative.ошеломлен", sourceActionId: "ruiner.grim-ascendant.1", participantIds: [target.id] } });
  }
  if ((event.type === "effect.apply" && payload.applied && event.actorId !== payload.targetId || event.type === "damage.apply" && payload.woundGained) && !scene.pendingPrompt && !promptQueued()) {
    const target = actorById(scene, payload.targetId);
    const empath = (scene.actors || []).find(owner => target && !owner.knockedOut && owner.team === target.team && owner.id !== target.id && Number(owner.techniques?.["altruist.empath"] || 0) >= 2 && distance(owner, target) <= Number(owner.attrs?.talent || 0));
    if (empath) events.push({ type: "rule.prompt", actorId: empath.id, payload: { id: `prompt-${event.id}-empath-rush`, kind: "empath-rush", sourceActorId: empath.id, targetId: target.id, title: "Защитный отклик", text: `Переместиться смежно с ${target.name} бесплатным Прорывом?`, options: ["rush", "pass"], context: { targetId: target.id }, participantIds: [empath.id, target.id] } });
  }
  if (event.type === "actor.move" && actor && payload.from && !scene.pendingPrompt) {
    for (const owner of (scene.actors || []).filter(item => !item.knockedOut && Number(item.techniques?.["altruist.will-o-wisp"] || 0) >= 2)) {
      const flames = wispMarkers(scene, owner.id);
      const exited = flames.filter(marker => marker.space === actor.space && marker.x === Number(payload.from.x) && marker.y === Number(payload.from.y) && (marker.x !== actor.x || marker.y !== actor.y));
      if (!exited.length) continue;
      if (owner.team === actor.team) events.push({ type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${event.id}-wisp-follow`, kind: "wisp-follow", sourceActorId: owner.id, targetId: actor.id, title: "Дружелюбные духи", text: `Переместить Пламя вслед за ${actor.name}?`, options: [...exited.map(marker => marker.id), "pass"], context: { targetId: actor.id }, participantIds: [owner.id, actor.id] } });
      else if (Number(owner.focus || 0) >= 1) {
        const path = (payload.path || []).map(value => { const [x, y] = String(value).split(",").map(Number); return { x, y }; });
        const firstExit = path.find(point => exited.some(marker => marker.x !== point.x || marker.y !== point.y)) || { x: actor.x, y: actor.y };
        events.push({ type: "rule.prompt", actorId: owner.id, payload: { id: `prompt-${event.id}-wisp-stop`, kind: "wisp-stop", sourceActorId: owner.id, targetId: actor.id, title: "Дружелюбные духи", text: `Потратить 1 Фокус и остановить ${actor.name} рядом с Пламенем?`, options: ["stop", "pass"], context: { stopCell: firstExit }, participantIds: [owner.id, actor.id] } });
      }
      break;
    }
  }
  if (event.type === "actor.enter" && actor && !actor.knockedOut) {
    const cell = `${actor.x},${actor.y}`;
    const hostileGas = (scene.objects || []).find(object => object.type === "gas" && object.space === actor.space && object.cells?.includes(cell) && actorById(scene, object.ownerActorId)?.team !== actor.team);
    if (hostileGas && !(actor.effects || []).includes("negative.ослаблен")) events.push({ type: "effect.apply", actorId: hostileGas.ownerActorId, payload: { targetId: actor.id, effect: "negative.ослаблен", sourceActionId: hostileGas.ruleId || hostileGas.source, triggerOwnerId: hostileGas.ownerActorId, participantIds: [hostileGas.ownerActorId, actor.id] } });
    const trap = (scene.markers || []).find(marker => marker.kind === "trap" && /disruptor\.hunter\.1/.test(`${marker.ruleId || ""} ${marker.source || ""}`) && marker.space === actor.space && marker.x === actor.x && marker.y === actor.y && Number(actorById(scene, marker.ownerActorId)?.techniques?.["disruptor.hunter"] || 0) >= 1 && actorById(scene, marker.ownerActorId)?.team !== actor.team);
    if (trap && !scene.pendingPrompt && !scene.pendingAction) {
      actor.stepRemaining = 0;
      events.push({ type: "rule.prompt", actorId: trap.ownerActorId, payload: { id: `prompt-${event.id}-${trap.id}`, kind: "hunter-trap", sourceActorId: trap.ownerActorId, targetId: actor.id, markerId: trap.id, title: "Стальные челюсти", text: `${actor.name} проходит через Малую ловушку: движение остановлено. Использовать бесплатную Быструю Стычку?`, options: ["attack", "pass"], triggerOwnerId: trap.ownerActorId, participantIds: [trap.ownerActorId, actor.id] } });
    }
  }
  if (event.type === "area.create" && actor && (payload.ruleId === "disruptor.chemist.1" || payload.source === "disruptor.chemist.1") && Number(actor.techniques?.["disruptor.chemist"] || 0) >= 3) {
    const targets = (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && target.space === payload.space && (payload.cells || []).includes(`${target.x},${target.y}`));
    for (const target of targets) {
      events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId: target.id, effect: "negative.ослаблен", sourceActionId: "disruptor.chemist.3", participantIds: [actor.id, target.id] } });
      events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: target.id, amount: Number(actor.attrs?.mind || 0), sourceActionId: "disruptor.chemist.3", participantIds: [actor.id, target.id] } });
    }
  }
  if (event.type === "effect.apply" && payload.applied && payload.effect === "negative.ослаблен" && actor && Number(actor.techniques?.["disruptor.chemist"] || 0) >= 2) {
    const target = actorById(scene, payload.targetId);
    if (target && !target.knockedOut && Number(target.hp || 0) <= Number(actor.attrs?.mind || 0)) {
      events.push({ type: "actor.knockout", actorId: actor.id, payload: { targetId: target.id, sourceActionId: "disruptor.chemist.2", participantIds: [actor.id, target.id] } });
      events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "focus", amount: 2, sourceActionId: "disruptor.chemist.2", participantIds: [actor.id, target.id] } });
      if (Number(actor.techniques?.["disruptor.chemist"] || 0) >= 3) events.push({ type: "area.create", actorId: actor.id, payload: { id: `gas-${event.id}-${target.id}`, space: target.space, areaType: "gas", label: "Сублимация", source: "disruptor.chemist.1", ruleId: "disruptor.chemist.1", duration: "nextTurn", ownerActorId: actor.id, cells: squareCells(scene, target, target, 1), participantIds: [actor.id, target.id] } });
    }
  }
  if ((event.type === "area.remove" || event.type === "object.damage" && Number(payload.dealt || 0) > 0) && actor && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 2) events.push({ type: "resource.gain", actorId: actor.id, payload: { resource: "creationMarks", amount: 1, sourceActionId: "ruiner.creation-ascetic.2" } });
  return events;
}

function dispatchMany(scene, events, options = {}) {
  let next = clone(scene);
  const committed = [];
  const queue = [...(events || [])];
  let first = true;
  let handled = 0;
  while (queue.length) {
    if (handled++ > 240) throw new Error("Слишком длинная цепочка автоматических правил.");
    const event = queue.shift();
    const result = dispatch(next, event, first ? options : { ...options, expectedVersion: undefined });
    next = result.scene;
    committed.push(result.event);
    const derived = triggeredEvents(next, result.event);
    if (derived.length) queue.unshift(...derived);
    first = false;
  }
  return { scene: next, events: committed };
}

function previewEvents(scene, events, options = {}) {
  try {
    const result = dispatchMany(scene, events, options);
    return { ok: true, ...result, errors: [], code: null };
  } catch (error) {
    return {
      ok: false,
      scene: clone(scene),
      events: [],
      errors: [error?.message || "Цепочку событий нельзя применить."],
      code: error?.code || "SCENE_EVENT_INVALID",
    };
  }
}

// Only deterministic base-action modifiers belong here. Conditional follow-ups,
// named sub-actions (such as Flurry/Sting), clocks and target-shape clauses stay
// in the Technique assistant instead of being guessed from localized prose.
