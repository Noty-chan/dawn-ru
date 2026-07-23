"use strict";

(function exposeDawnTechniqueEngine(global) {
  const VERSION = 2;

  const RULES = [
    { id: "ruiner.bombardier.1", techniqueId: "ruiner.bombardier", level: 1, name: "Взрыв!!", kind: "area", shape: "square3", areaType: "attack", duration: "instant", range: 4, note: "Урон и бросок разрешаются базовым действием." },
    { id: "ruiner.bombardier.2", techniqueId: "ruiner.bombardier", level: 2, name: "Взрыв!!!", kind: "area", shape: "square3", areaType: "attack", duration: "instant", range: 5, optionMinimum: { key: "focusSpent", value: 2, label: "потрачено Фокуса" }, note: "Урон и бросок разрешаются базовым действием." },
    { id: "ruiner.bombardier.3", techniqueId: "ruiner.bombardier", level: 3, name: "ВЗРЫВ!!!!", kind: "area", shape: "square5", areaType: "attack", duration: "instant", range: 6, optionMinimum: { key: "focusSpent", value: 4, label: "потрачено Фокуса" }, note: "Урон и бросок разрешаются базовым действием." },
    { id: "ruiner.rapid-fire-sorcery.2", techniqueId: "ruiner.rapid-fire-sorcery", level: 2, name: "Выжженная земля", kind: "area", shape: "cell", areaType: "difficult", duration: "scene" },
    { id: "ruiner.ritualist.1", techniqueId: "ruiner.ritualist", level: 1, name: "Лей-линии", kind: "marker", markerKind: "ritual", duration: "scene", color: "#6fc9d8" },
    { id: "ruiner.student-of-stars.2-line", techniqueId: "ruiner.student-of-stars", level: 2, name: "Бесформенная сила · линия", kind: "area", shape: "line", areaType: "attack", duration: "instant" },
    { id: "ruiner.student-of-stars.2-zone", techniqueId: "ruiner.student-of-stars", level: 2, name: "Бесформенная сила · зона 2×2", kind: "area", shape: "square2", areaType: "attack", duration: "instant" },
    { id: "ruiner.ego-arm.2", techniqueId: "ruiner.ego-arm", level: 2, name: "Покажи свои цели", kind: "marker", markerKind: "damocles", duration: "scene", color: "#d04f64" },
    { id: "ruiner.sellsword-s-call.1", techniqueId: "ruiner.sellsword-s-call", level: 1, name: "Реприза воина", kind: "marker", markerKind: "summon", duration: "scene", color: "#6fc9d8" },
    { id: "bulwark.servant-s-call.1", techniqueId: "bulwark.servant-s-call", level: 1, name: "Честь подчинённого", kind: "marker", markerKind: "summon", duration: "scene", color: "#6fc9d8" },
    { id: "disruptor.wave-rider.1", techniqueId: "disruptor.wave-rider", level: 1, name: "Мягкие волны", kind: "marker", markerKind: "ritual", duration: "scene", color: "#3fa9d4" },
    { id: "disruptor.hunter.1", techniqueId: "disruptor.hunter", level: 1, name: "Стальные челюсти", kind: "marker", markerKind: "trap", duration: "scene", color: "#c28a45" },
    { id: "disruptor.hunter.3", techniqueId: "disruptor.hunter", level: 3, name: "Яма-ловушка", kind: "area", shape: "square2", areaType: "terrain", duration: "scene" },
    { id: "disruptor.gale-strider.1", techniqueId: "disruptor.gale-strider", level: 1, name: "Растущие ветра", kind: "area", shape: "square3", areaType: "danger", duration: "scene" },
    { id: "disruptor.chemist.1", techniqueId: "disruptor.chemist", level: 1, name: "Сублимация", kind: "area", shape: "square3", areaType: "gas", duration: "nextTurn" },
    { id: "disruptor.inner-world.2", techniqueId: "disruptor.inner-world", level: 2, name: "Домен контроля", kind: "space", spaceName: "Внутренний мир", width: 3, height: 3 },
    { id: "bulwark.giant-frame.1", techniqueId: "bulwark.giant-frame", level: 1, name: "Огромные руки", kind: "area", shape: "square2", areaType: "attack", duration: "instant", adjacency: true, optionMinimum: { key: "focusSpent", value: 1, label: "дополнительно потрачено Фокуса" } },
    { id: "powerhouse.warring-ascendant.3", techniqueId: "powerhouse.warring-ascendant", level: 3, name: "Святой меч, Дюрандаль", kind: "area", shape: "line", areaType: "attack", duration: "instant", adjacency: true },
    { id: "powerhouse.spellsword.2", techniqueId: "powerhouse.spellsword", level: 2, name: "Два солнца", kind: "teleport", range: 3, timing: "beforeTargets" },
  ];

  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = value => Number.isInteger(Number(value)) ? Number(value) : null;
  const pointKey = point => `${point.x},${point.y}`;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const unique = values => [...new Set(values)];
  const idFactory = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const publicRule = rule => ({ ...clone(rule), automation: rule.automation || (rule.areaType === "attack" ? "assist" : "full") });

  function activeSpace(scene, id) {
    return (scene.spaces || []).find(space => space.id === id) || null;
  }

  function actorById(scene, id) {
    return (scene.actors || []).find(actor => actor.id === id) || null;
  }

  function inBounds(space, point) {
    return Boolean(space && point && point.x >= 0 && point.y >= 0 && point.x < space.width && point.y < space.height);
  }

  function lineCells({ x, y, width, height, orientation = "horizontal" }) {
    const cells = [];
    const add = (cellX, cellY) => {
      if (cellX >= 0 && cellY >= 0 && cellX < width && cellY < height) cells.push(`${cellX},${cellY}`);
    };
    if (orientation === "vertical") for (let cellY = 0; cellY < height; cellY += 1) add(x, cellY);
    else if (orientation === "diagonal-down") for (let offset = -Math.max(width, height); offset <= Math.max(width, height); offset += 1) add(x + offset, y + offset);
    else if (orientation === "diagonal-up") for (let offset = -Math.max(width, height); offset <= Math.max(width, height); offset += 1) add(x + offset, y - offset);
    else for (let cellX = 0; cellX < width; cellX += 1) add(cellX, y);
    return cells;
  }

  function areaCells({ shape, anchor, width, height, orientation }) {
    if (shape === "line") return lineCells({ ...anchor, width, height, orientation });
    const radius = shape === "square5" ? 2 : shape === "square3" ? 1 : 0;
    const cells = [];
    if (shape === "square2") {
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
        const point = { x: anchor.x + dx, y: anchor.y + dy };
        if (point.x >= 0 && point.y >= 0 && point.x < width && point.y < height) cells.push(pointKey(point));
      }
    } else {
      for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
        const point = { x: anchor.x + dx, y: anchor.y + dy };
        if (point.x >= 0 && point.y >= 0 && point.x < width && point.y < height) cells.push(pointKey(point));
      }
    }
    return unique(cells);
  }

  function rulesFor(techniques = {}) {
    return RULES.filter(rule => Number(techniques[rule.techniqueId] || 0) >= rule.level).map(publicRule);
  }

  function techniqueCoverage(data, techniques = null) {
    const archetypes = Array.isArray(data?.archetypes) ? data.archetypes : [];
    const selected = techniques && typeof techniques === "object" ? techniques : null;
    return archetypes.flatMap(archetype => (archetype.techniques || []).flatMap(technique => {
      const knownLevel = selected ? Number(selected[technique.id] || 0) : Number.POSITIVE_INFINITY;
      return (technique.levels || []).filter(level => Number(level.n) <= knownLevel).map(level => {
        const rules = RULES.filter(rule => rule.techniqueId === technique.id && rule.level === Number(level.n)).map(publicRule);
        const mechanics = clone(level.mechanics || {});
        const semanticSignals = [mechanics.actions, mechanics.effects, mechanics.areas, mechanics.ranges, mechanics.clocks, mechanics.resources].some(values => Array.isArray(values) && values.length) || mechanics.movement || mechanics.targets;
        const automation = rules.length ? (rules.every(rule => rule.automation === "full") ? "full" : "assist") : (semanticSignals ? "assist" : "manual");
        return {
          id: `${technique.id}.${level.n}`,
          techniqueId: technique.id,
          techniqueName: technique.name,
          archetypeId: archetype.id,
          archetypeName: archetype.name,
          level: Number(level.n),
          name: level.name,
          text: level.text,
          mechanics,
          automation,
          rules,
        };
      });
    }));
  }

  function manualPreview(scene, request = {}) {
    const actor = actorById(scene, request.actorId);
    const entry = request.entry;
    const errors = [];
    if (!actor) errors.push("Не выбран персонаж, использующий правило.");
    if (!entry?.techniqueId || !entry?.level) errors.push("Не указано правило Техники.");
    const name = entry?.name || entry?.techniqueName || "Ручное правило";
    return {
      ok: errors.length === 0,
      engineVersion: VERSION,
      actorId: actor?.id || null,
      rule: { id: entry?.id || "manual", techniqueId: entry?.techniqueId, level: entry?.level, name, automation: "manual" },
      errors,
      warnings: errors.length ? [] : ["Движок сохранил источник правила, исполнителя и решение, но механический итог подтверждается вручную."],
      summary: errors.length ? `«${name}»: требуется уточнение` : `«${name}»: подготовлено ручное разрешение`,
      request: { targetIds: clone(request.targetIds || []), note: String(request.note || "").slice(0,500), entryId: entry?.id || null },
      commands: errors.length ? [] : [{ type: "manual_rule", actorId: actor.id, ruleId: entry.id, label: name, note: String(request.note || "").slice(0, 500) }],
      affectedCells: [],
      affectedActorIds: Array.isArray(request.targetIds) ? unique(request.targetIds).filter(id => actorById(scene, id)) : [],
    };
  }

  function assistedPreview(scene, request = {}) {
    const actor = actorById(scene, request.actorId);
    const entry = request.entry;
    const errors = [];
    if (!actor) errors.push("Не выбран персонаж, использующий правило.");
    if (!entry?.techniqueId || !entry?.level) errors.push("Не указано правило Техники.");
    const targetIds = unique(Array.isArray(request.targetIds) ? request.targetIds : []).filter(id => actorById(scene, id));
    const effectIds = unique(Array.isArray(request.effectIds) ? request.effectIds : []).filter(value => typeof value === "string" && value.length <= 80);
    if (effectIds.length && !targetIds.length) errors.push("Выберите цели для автоматического наложения Эффекта.");
    const name = entry?.name || entry?.techniqueName || "Техника";
    const commands = [];
    if (!errors.length) {
      targetIds.forEach(targetId => effectIds.forEach(effect => commands.push({ type: "apply_effect", actorId: actor.id, targetId, effect, ruleId: entry.id })));
      commands.push({ type: "manual_rule", actorId: actor.id, ruleId: entry.id, label: name, note: String(request.note || "Сложные условия подтверждает Нарратор").slice(0, 500) });
    }
    const mechanics = clone(entry?.mechanics || {});
    const warnings = errors.length ? [] : [
      mechanics.conditional ? "У правила есть условия или замена базового действия — движок применил только выбранные безопасные последствия." : "Движок применил простые последствия; проверьте полный текст правила.",
      mechanics.clocks?.length ? `Нужно вести часы: ${mechanics.clocks.join(" / ")} сегм.` : "",
      mechanics.areas?.length ? `В тексте есть геометрия: ${mechanics.areas.map(area => area.join("×")).join(" / ")}.` : "",
    ].filter(Boolean);
    return {
      ok: errors.length === 0,
      engineVersion: VERSION,
      actorId: actor?.id || null,
      rule: { id: entry?.id || "assist", techniqueId: entry?.techniqueId, level: entry?.level, name, automation: "assist" },
      errors,
      warnings,
      summary: errors.length ? `«${name}»: требуется уточнение` : `«${name}»: простые последствия подготовлены`,
      request: { targetIds, effectIds, entryId: entry?.id || null, mode: "assist", note: String(request.note || "").slice(0, 500) },
      commands: errors.length ? [] : commands,
      affectedCells: [],
      affectedActorIds: targetIds,
      mechanics,
    };
  }

  function preview(scene, request = {}) {
    const errors = [];
    const warnings = [];
    const rule = RULES.find(item => item.id === request.ruleId);
    const actor = actorById(scene, request.actorId);
    if (!rule) errors.push("Неизвестное правило Техники.");
    if (!actor) errors.push("Не выбран персонаж, использующий Технику.");
    if (rule && actor) {
      const knownLevel = Number(request.knownLevel ?? actor.techniques?.[rule.techniqueId] ?? 0);
      if (knownLevel < rule.level) errors.push(`Для «${rule.name}» нужен ${rule.level}-й Уровень Техники.`);
    }
    if (errors.length) return { ok: false, errors, warnings, commands: [], affectedCells: [], affectedActorIds: [] };

    const sourceSpace = activeSpace(scene, actor.space);
    const anchor = request.anchor && { x: integer(request.anchor.x), y: integer(request.anchor.y) };
    const commands = [];
    let affectedCells = [];
    let affectedActorIds = [];

    if (rule.optionMinimum) {
      const actual = Number(request.options?.[rule.optionMinimum.key] || 0);
      if (actual < rule.optionMinimum.value) errors.push(`Нужно: ${rule.optionMinimum.label} — не меньше ${rule.optionMinimum.value}.`);
    }

    if (["area", "marker"].includes(rule.kind)) {
      if (!inBounds(sourceSpace, anchor)) errors.push("Укажите клетку на текущем поле.");
      if (rule.range && anchor && manhattan(actor, anchor) > rule.range) errors.push(`Клетка находится дальше ${rule.range} клеток.`);
      if (rule.adjacency && anchor && manhattan(actor, anchor) !== 1) errors.push("Зона должна быть смежна с персонажем.");
    }

    if (rule.kind === "area" && !errors.length) {
      affectedCells = areaCells({ shape: rule.shape, anchor, width: sourceSpace.width, height: sourceSpace.height, orientation: request.orientation });
      affectedActorIds = (scene.actors || []).filter(item => item.space === actor.space && affectedCells.includes(pointKey(item))).map(item => item.id);
      commands.push({ type: "create_area", space: actor.space, areaType: rule.areaType, label: rule.name, source: rule.id, duration: rule.duration, ownerActorId: actor.id, cells: affectedCells });
      commands.push({ type: "set_targets", actorIds: affectedActorIds });
      if (rule.areaType === "attack") warnings.push(rule.note || "Движок выбрал цели и геометрию; бросок и итоговый урон пока подтверждаются вручную.");
    }

    if (rule.kind === "marker" && !errors.length) {
      affectedCells = [pointKey(anchor)];
      commands.push({ type: "create_marker", space: actor.space, x: anchor.x, y: anchor.y, markerKind: rule.markerKind, label: rule.name, color: rule.color, source: rule.id, duration: rule.duration, ownerActorId: actor.id });
    }

    if (rule.kind === "teleport") {
      const destination = request.destination && { x: integer(request.destination.x), y: integer(request.destination.y) };
      if (!inBounds(sourceSpace, destination)) errors.push("Укажите клетку назначения.");
      if (destination && manhattan(actor, destination) > rule.range) errors.push(`Телепортация ограничена ${rule.range} клетками.`);
      if (destination && (scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка назначения занята.");
      if (!errors.length) {
        affectedCells = [pointKey(destination)];
        affectedActorIds = [actor.id];
        commands.push({ type: "move_actor", actorId: actor.id, space: actor.space, x: destination.x, y: destination.y, movement: "teleport", timing: rule.timing });
      }
    }

    if (rule.kind === "space") {
      const targetIds = unique([actor.id, ...(Array.isArray(request.targetIds) ? request.targetIds : [])]).filter(id => actorById(scene, id));
      if (!targetIds.length) errors.push("Выберите участников переноса.");
      if (!errors.length) {
        commands.push({ type: "ensure_space", ref: rule.id, name: rule.spaceName, width: rule.width, height: rule.height });
        commands.push({ type: "move_to_space", actorIds: targetIds, spaceRef: rule.id });
        commands.push({ type: "set_targets", actorIds: targetIds.filter(id => id !== actor.id) });
        affectedActorIds = targetIds;
      }
    }

    const summary = errors.length ? `«${rule.name}»: требуется уточнение` : `«${rule.name}»: ${commands.length} команд готово к применению`;
    return { ok: errors.length === 0, engineVersion: VERSION, actorId: actor?.id || null, rule: publicRule(rule), request: { anchor: request.anchor || null, destination: request.destination || null, targetIds: clone(request.targetIds || []), orientation: request.orientation || "horizontal", options: clone(request.options || {}) }, errors, warnings, summary, commands, affectedCells, affectedActorIds };
  }

  function toEvents(scene, prepared, options = {}) {
    if (!prepared?.ok) throw new Error("Нельзя создать события Техники с ошибками предпросмотра.");
    const makeId = typeof options.makeId === "function" ? options.makeId : idFactory;
    const actorId = prepared.actorId || prepared.commands.find(command => command.actorId)?.actorId || prepared.commands.find(command => command.ownerActorId)?.ownerActorId || null;
    const events = [{ type: "technique.prepare", actorId, payload: { ruleId: prepared.rule.id, name: prepared.rule.name, request: clone(prepared.request || {}) } }];
    const references = {};
    if (prepared.rule.optionMinimum?.key === "focusSpent") events.push({ type: "resource.spend", actorId, payload: { resource: "focus", amount: Number(prepared.request?.options?.focusSpent || 0) } });
    for (const command of prepared.commands) {
      if (command.type === "create_area") events.push({ type: "area.create", actorId, payload: { ...clone(command), id: makeId("area") } });
      else if (command.type === "create_marker") events.push({ type: "marker.create", actorId, payload: { ...clone(command), id: makeId("marker") } });
      else if (command.type === "set_targets") events.push({ type: "targets.set", actorId, payload: { actorIds: clone(command.actorIds) } });
      else if (command.type === "move_actor") {
        events.push({ type: "actor.move", actorId: command.actorId, payload: { space: command.space, x: command.x, y: command.y, movement: command.movement } });
        events.push({ type: "actor.enter", actorId: command.actorId, payload: { space: command.space, x: command.x, y: command.y } });
      } else if (command.type === "ensure_space") {
        const existing = (scene.spaces || []).find(space => space.name === command.name);
        references[command.ref] = existing?.id || makeId("space");
        events.push({ type: "space.ensure", actorId, payload: { id: references[command.ref], name: command.name, width: command.width, height: command.height, activate: true } });
      } else if (command.type === "move_to_space") {
        const spaceId = references[command.spaceRef],spaceEvent=events.find(event => event.type === "space.ensure" && event.payload.id === spaceId),space=(scene.spaces || []).find(item => item.id === spaceId) || spaceEvent?.payload;
        command.actorIds.forEach((movingId,index) => {events.push({ type: "actor.move", actorId: movingId, payload: { space: spaceId, x: index % space.width, y: Math.floor(index / space.width) % space.height, movement: "technique" } });events.push({ type: "actor.enter", actorId: movingId, payload: { space: spaceId, x: index % space.width, y: Math.floor(index / space.width) % space.height } })});
      } else if (command.type === "apply_effect") events.push({ type: "effect.apply", actorId: command.actorId, payload: { targetId: command.targetId, effect: command.effect, sourceActionId: command.ruleId } });
      else if (command.type === "manual_rule") events.push({ type: "technique.manual", actorId: command.actorId, payload: { ruleId: command.ruleId, name: command.label, note: command.note } });
    }
    events.push({ type: "technique.resolve", actorId, payload: { ruleId: prepared.rule.id, name: prepared.rule.name, affectedCells: clone(prepared.affectedCells || []), affectedActorIds: clone(prepared.affectedActorIds || []), warnings: clone(prepared.warnings || []) } });
    return events;
  }

  function applyCommand(scene, command, references, makeId) {
    if (command.type === "create_area") {
      scene.objects ||= [];
      scene.objects.push({ id: makeId("area"), space: command.space, type: command.areaType, label: command.label, source: command.source, duration: command.duration, ownerActorId: command.ownerActorId, cells: [...command.cells] });
    } else if (command.type === "create_marker") {
      scene.markers ||= [];
      scene.markers.push({ id: makeId("marker"), space: command.space, x: command.x, y: command.y, kind: command.markerKind, label: command.label, color: command.color, source: command.source, duration: command.duration, ownerActorId: command.ownerActorId });
    } else if (command.type === "set_targets") {
      scene.targetIds = [...command.actorIds];
    } else if (command.type === "move_actor") {
      const actor = actorById(scene, command.actorId);
      if (actor) Object.assign(actor, { space: command.space, x: command.x, y: command.y });
    } else if (command.type === "ensure_space") {
      scene.spaces ||= [];
      let space = scene.spaces.find(item => item.name === command.name);
      if (!space) {
        space = { id: makeId("space"), name: command.name, width: command.width, height: command.height };
        scene.spaces.push(space);
      }
      references[command.ref] = space.id;
    } else if (command.type === "move_to_space") {
      const spaceId = references[command.spaceRef];
      command.actorIds.forEach((actorId, index) => {
        const actor = actorById(scene, actorId);
        const space = activeSpace(scene, spaceId);
        if (actor && space) Object.assign(actor, { space: spaceId, x: index % space.width, y: Math.floor(index / space.width) % space.height });
      });
      scene.activeSpace = spaceId;
    } else if (command.type === "apply_effect") {
      const target = actorById(scene, command.targetId);
      if (target) {
        target.effects ||= [];
        if (!target.effects.includes(command.effect)) target.effects.push(command.effect);
      }
    } else if (command.type === "manual_rule") {
      scene.log ||= [];
      scene.log.unshift({ id: makeId("event"), type: "technique.manual", actorId: command.actorId, ruleId: command.ruleId, label: command.label, note: command.note });
    }
  }

  function commit(scene, prepared, options = {}) {
    if (!prepared?.ok) throw new Error("Нельзя применить Технику с ошибками предпросмотра.");
    const before = clone(scene);
    const next = clone(scene);
    const references = {};
    const makeId = typeof options.makeId === "function" ? options.makeId : idFactory;
    prepared.commands.forEach(command => applyCommand(next, command, references, makeId));
    const transaction = {
      id: makeId("technique"),
      engineVersion: VERSION,
      label: prepared.summary,
      ruleId: prepared.rule.id,
      commands: clone(prepared.commands),
      before,
      after: clone(next),
    };
    return { scene: next, transaction };
  }

  function undo(transaction) {
    if (!transaction?.before) throw new Error("У транзакции нет состояния для отката.");
    return clone(transaction.before);
  }

  global.DAWN_TECHNIQUE_ENGINE = {
    VERSION,
    RULES: RULES.map(publicRule),
    assistedPreview,
    areaCells,
    commit,
    manualPreview,
    preview,
    rulesFor,
    techniqueCoverage,
    toEvents,
    undo,
  };
})(typeof window === "object" ? window : globalThis);
