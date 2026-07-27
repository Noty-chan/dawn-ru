"use strict";

(function exposeDawnTechniqueEngine(global) {
  const VERSION = 6;

  const RULES = [
    { id: "powerhouse.braggart.1.foundation", techniqueId: "powerhouse.braggart", level: 1, name: "Гордыня", kind: "foundation", foundation: "clock", automation: "partial", clockId: "powerhouse.braggart.pride", size: 6, initial: 0, note: "Ядро знает размер, заполнение и границы часов Гордости; автоматические источники сегментов подключаются следующим этапом." },
    { id: "powerhouse.gunslinger.1.foundation", techniqueId: "powerhouse.gunslinger", level: 1, name: "Большой ствол", kind: "foundation", foundation: "alternate-resource", automation: "partial", resource: "bullets", resourceLabel: "Пули", initial: 6, replaces: ["focus"], note: "Стоимость Пулями уже проверяется отдельно от Фокуса; сохранение и перезарядка будут подключены событиями ресурса." },
    { id: "vagabond.aerial-master.1.foundation", techniqueId: "vagabond.aerial-master", level: 1, name: "Над и вокруг", kind: "foundation", foundation: "stance", automation: "partial", stanceId: "vagabond.aerial-master.flight", requiredEffects: ["positive.ускорен"], note: "Условие входа в Стойку полёта и конфликт с другой Стойкой вычисляются канонически." },
    { id: "bulwark.servant-s-call.1.foundation", techniqueId: "bulwark.servant-s-call", level: 1, name: "Честь подчинённого", kind: "foundation", foundation: "owned-entities", automation: "partial", rulePrefix: "bulwark.servant-s-call", kinds: ["summon"], note: "Призывы собираются по владельцу и источнику правила; создание полноценного участника вместо маркера остаётся следующим этапом." },
    { id: "powerhouse.spellsword.3.foundation", techniqueId: "powerhouse.spellsword", level: 3, name: "Охотник на ведьм", kind: "foundation", foundation: "action-history", automation: "partial", scope: "turn", actionNames: ["Заклинание"], note: "Ядро находит предыдущее Заклинание и его цели для проверки цели последующего Завершения." },
    { id: "powerhouse.improvisational-fighter.1.foundation", techniqueId: "powerhouse.improvisational-fighter", level: 1, name: "Всё — инструмент", kind: "foundation", foundation: "terrain", automation: "partial", range: 5, types: ["terrain", "difficult", "custom"], note: "Поиск, дальность, владение и Здоровье местности готовы; выбор между созданием и удалением пока подтверждает игрок." },
    { id: "vagabond.cunning-fighter.2", techniqueId: "vagabond.cunning-fighter", level: 2, name: "Планы внутри планов", kind: "passive", automation: "full", note: "Снято ограничение одного «Плана и исполнения» за Ход." },
    { id: "bulwark.iron-bodied.2", techniqueId: "bulwark.iron-bodied", level: 2, name: "Выносливость", kind: "passive", automation: "full", note: "Броня автоматически включает [Тело / 2]." },
    { id: "bulwark.rising-challenger.3", techniqueId: "bulwark.rising-challenger", level: 3, name: "Драма и злость", kind: "passive", automation: "full", note: "В бросок Столкновения автоматически добавляются 3 кости." },
    { id: "altruist.gourmand.2", techniqueId: "altruist.gourmand", level: 2, name: "Бездонная кладовая", kind: "passive", automation: "full", note: "Запас Трапез автоматически равен 3 за Интермиссию." },
    { id: "powerhouse.technician.3", techniqueId: "powerhouse.technician", level: 3, name: "Последний удар", kind: "combo", automation: "full", sequence: ["Стычка", "Завершение"], action: "Завершение", apCost: 1 },
    { id: "vagabond.assassin.1", techniqueId: "vagabond.assassin", level: 1, name: "Засада", kind: "passive", automation: "full", note: "Первое Скрыться после Развертывания автоматически бесплатно и игнорирует требования." },
    { id: "vagabond.assassin.2", techniqueId: "vagabond.assassin", level: 2, name: "Ликвидация", kind: "passive", automation: "decision", note: "При Атаке из Исчезновения стол запросит клетку появления, добавит кости Ступени и критические успехи на 5–6." },
    { id: "vagabond.assassin.3", techniqueId: "vagabond.assassin", level: 3, name: "Скорость тьмы", kind: "combo", automation: "full", sequence: ["Скрыться", "Шаг"], action: "Шаг", apCost: 0, selfEffect: "Невидим" },
    { id: "vagabond.enchained.1", techniqueId: "vagabond.enchained", level: 1, name: "Выстрел крюком", kind: "equidistant-teleport", automation: "full", range: 5 },
    { id: "vagabond.untouchable.1", techniqueId: "vagabond.untouchable", level: 1, name: "Нырок", kind: "passive", automation: "full", note: "Первый Уворот за Раунд автоматически получает дополнительное [Талант / 2] Уклонение." },
    { id: "altruist.surgeon.1", techniqueId: "altruist.surgeon", level: 1, name: "Не навреди", kind: "surgery", automation: "full" },
    { id: "altruist.alchemist.1", techniqueId: "altruist.alchemist", level: 1, name: "Быстрая смесь", kind: "inventory", automation: "full" },
    { id: "altruist.alchemist.2", techniqueId: "altruist.alchemist", level: 2, name: "Мощная смесь", kind: "passive", automation: "full" },
    { id: "ruiner.creation-ascetic.1", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Формирование знаков", kind: "resource-replacement", automation: "full", note: "Метки творения заменяют Фокус; обычная Атака с Метками направляется к подходящей форме." },
    { id: "ruiner.creation-ascetic.1.nails", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Скрещенные гвозди", kind: "creation-attack", automation: "decision", action: "Заклинание", markBand: "low", form: "nails" },
    { id: "ruiner.creation-ascetic.1.mallet", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Невозможный молот", kind: "creation-attack", automation: "decision", action: "Заклинание", markBand: "high", form: "mallet" },
    { id: "ruiner.creation-ascetic.1.pile-arm", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Небесный сваебой", kind: "creation-attack", automation: "decision", action: "Завершение", markBand: "low", form: "pile-arm", advantage: 2 },
    { id: "ruiner.creation-ascetic.1.idol", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Живой идол", kind: "creation-attack", automation: "decision", action: "Завершение", markBand: "high", form: "idol", advantage: 4 },
    { id: "ruiner.creation-ascetic.2", techniqueId: "ruiner.creation-ascetic", level: 2, name: "Один истинный мир", kind: "passive", automation: "full", note: "Передышка, Зарядка и получение Меток от повреждения или уничтожения местности автоматизированы." },
    { id: "ruiner.creation-ascetic.3", techniqueId: "ruiner.creation-ascetic", level: 3, name: "Труд благочестивых", kind: "passive", automation: "full", note: "Форма Завершения получает число Меток непосредственно предшествовавшего Заклинания." },
    { id: "ruiner.spellcrafter.1", techniqueId: "ruiner.spellcrafter", level: 1, name: "Эксперимент", kind: "modifier-choice", automation: "decision", note: "Игрок выбирает Модификацию; ядро не угадывает выбранный вариант." },
    { id: "ruiner.spellcrafter.2", techniqueId: "ruiner.spellcrafter", level: 2, name: "Закрепление", kind: "modifier-choice", automation: "decision", note: "Оплата Новаторства Фокусом требует выбора игрока." },
    { id: "ruiner.spellcrafter.3", techniqueId: "ruiner.spellcrafter", level: 3, name: "Финализация", kind: "modifier-choice", automation: "decision", note: "Можно выбрать две разные Модификации и оплатить обе." },
    { id: "ruiner.bombardier.1", techniqueId: "ruiner.bombardier", level: 1, name: "Взрыв!!", kind: "area", automation: "full", shape: "square3", areaType: "attack", duration: "instant", range: 4 },
    { id: "ruiner.bombardier.2", techniqueId: "ruiner.bombardier", level: 2, name: "Взрыв!!!", kind: "area", automation: "full", shape: "square3", areaType: "attack", duration: "instant", range: 5, optionMinimum: { key: "focusSpent", value: 2, label: "потрачено Фокуса" } },
    { id: "ruiner.bombardier.3", techniqueId: "ruiner.bombardier", level: 3, name: "ВЗРЫВ!!!!", kind: "area", shape: "square5", areaType: "attack", duration: "instant", range: 6, optionMinimum: { key: "focusSpent", value: 4, label: "потрачено Фокуса" }, note: "Урон и бросок разрешаются базовым действием." },
    { id: "ruiner.rapid-fire-sorcery.2", techniqueId: "ruiner.rapid-fire-sorcery", level: 2, name: "Выжженная земля", kind: "area", shape: "cell", areaType: "difficult", duration: "scene" },
    { id: "ruiner.ritualist.1", techniqueId: "ruiner.ritualist", level: 1, name: "Лей-линии", kind: "marker", markerKind: "ritual", duration: "scene", color: "#6fc9d8" },
    { id: "ruiner.student-of-stars.2-line", techniqueId: "ruiner.student-of-stars", level: 2, name: "Бесформенная сила · линия", kind: "area", shape: "line", areaType: "attack", duration: "instant" },
    { id: "ruiner.student-of-stars.2-zone", techniqueId: "ruiner.student-of-stars", level: 2, name: "Бесформенная сила · зона 2×2", kind: "area", shape: "square2", areaType: "attack", duration: "instant" },
    { id: "ruiner.ego-arm.2", techniqueId: "ruiner.ego-arm", level: 2, name: "Покажи свои цели", kind: "marker", markerKind: "damocles", duration: "scene", color: "#d04f64" },
    { id: "ruiner.sellsword-s-call.1", techniqueId: "ruiner.sellsword-s-call", level: 1, name: "Реприза воина", kind: "marker", markerKind: "summon", duration: "scene", color: "#6fc9d8" },
    { id: "bulwark.servant-s-call.1", techniqueId: "bulwark.servant-s-call", level: 1, name: "Честь подчинённого", kind: "marker", markerKind: "summon", duration: "scene", color: "#6fc9d8" },
    { id: "disruptor.wave-rider.1", techniqueId: "disruptor.wave-rider", level: 1, name: "Мягкие волны", kind: "marker", markerKind: "ritual", duration: "scene", color: "#3fa9d4" },
    { id: "disruptor.hunter.1", techniqueId: "disruptor.hunter", level: 1, name: "Стальные челюсти", kind: "trap-placement", automation: "decision", markerKind: "trap", duration: "scene", color: "#c28a45" },
    { id: "disruptor.hunter.2", techniqueId: "disruptor.hunter", level: 2, name: "Дальняя установка", kind: "passive", automation: "full", note: "Дальность пустой Стычки и Обездвиживание цели ловушки учитываются автоматически." },
    { id: "disruptor.hunter.3", techniqueId: "disruptor.hunter", level: 3, name: "Яма-ловушка", kind: "area", shape: "square2", areaType: "terrain", duration: "scene" },
    { id: "disruptor.gale-strider.1", techniqueId: "disruptor.gale-strider", level: 1, name: "Растущие ветра", kind: "area", shape: "square3", areaType: "danger", duration: "scene" },
    { id: "disruptor.chemist.1", techniqueId: "disruptor.chemist", level: 1, name: "Сублимация", kind: "area", automation: "full", shape: "square3", areaType: "gas", duration: "nextTurn" },
    { id: "disruptor.chemist.2", techniqueId: "disruptor.chemist", level: 2, name: "Экспериментальная смесь", kind: "passive", automation: "full" },
    { id: "disruptor.chemist.3", techniqueId: "disruptor.chemist", level: 3, name: "Осаждение", kind: "passive", automation: "full" },
    { id: "disruptor.inner-world.2", techniqueId: "disruptor.inner-world", level: 2, name: "Домен контроля", kind: "space", spaceName: "Внутренний мир", width: 3, height: 3 },
    { id: "bulwark.giant-frame.1", techniqueId: "bulwark.giant-frame", level: 1, name: "Огромные руки", kind: "area", shape: "square2", areaType: "attack", duration: "instant", adjacency: true, optionMinimum: { key: "focusSpent", value: 1, label: "дополнительно потрачено Фокуса" } },
    { id: "powerhouse.warring-ascendant.3", techniqueId: "powerhouse.warring-ascendant", level: 3, name: "Святой меч, Дюрандаль", kind: "area", shape: "line", areaType: "attack", duration: "instant", adjacency: true },
    { id: "powerhouse.spellsword.2", techniqueId: "powerhouse.spellsword", level: 2, name: "Два солнца", kind: "teleport", range: 3, timing: "beforeTargets" },
    { id: "ruiner.grim-ascendant.1", techniqueId: "ruiner.grim-ascendant", level: 1, name: "Непостоянная мощь", kind: "passive", automation: "decision", note: "После подходящей Зарядки стол предлагает трансформацию и полностью ведёт перенаправление Здоровья, Фокуса, толчок и завершение формы." },
    { id: "ruiner.grim-ascendant.2", techniqueId: "ruiner.grim-ascendant", level: 2, name: "Вытянуть жизнь", kind: "state-toggle", stateKey: "drainLife", automation: "decision", note: "Включите перед Завершением Духом: урон будет округлён вверх пополам, а Успех даст Регенерацию." },
    { id: "altruist.empath.1", techniqueId: "altruist.empath", level: 1, name: "Успокаивающая аура", kind: "passive", automation: "decision", note: "В начале Хода союзника стол предлагает снять один выбранный Эффект и наложить Усилен." },
    { id: "altruist.empath.2", techniqueId: "altruist.empath", level: 2, name: "Защитный отклик", kind: "passive", automation: "decision", note: "После внешней Раны или Эффекта стол предлагает бесплатный Прорыв в смежную клетку." },
    { id: "altruist.will-o-wisp.1", techniqueId: "altruist.will-o-wisp", level: 1, name: "Пламя духовного плетения", kind: "passive", automation: "decision", note: "Первая Зарядка создаёт выбранное Пламя; его аура рассчитывается непосредственно по положению маркера." },
    { id: "altruist.will-o-wisp.2", techniqueId: "altruist.will-o-wisp", level: 2, name: "Дружелюбные духи", kind: "passive", automation: "decision", note: "Выход из Пламени вызывает выбор перемещения или остановки с проверкой Фокуса." },
    { id: "altruist.will-o-wisp.3", techniqueId: "altruist.will-o-wisp", level: 3, name: "Парные духи", kind: "passive", automation: "decision", note: "Поддерживаются одно Пламя с двумя свойствами либо два независимых Пламени." },
  ];

  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = value => Number.isInteger(Number(value)) ? Number(value) : null;
  const pointKey = point => `${point.x},${point.y}`;
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const unique = values => [...new Set(values)];
  const idFactory = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const publicRule = rule => ({ ...clone(rule), automation: rule.automation || "partial" });

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
  function segmentLineCells({ anchor, width, height, orientation = "horizontal", length = 7 }) {
    const cells = [], before = Math.floor((length - 1) / 2), after = length - before - 1, vectors = { horizontal: [1, 0], vertical: [0, 1], "diagonal-down": [1, 1], "diagonal-up": [1, -1] }, [dx, dy] = vectors[orientation] || vectors.horizontal;
    for (let offset = -before; offset <= after; offset += 1) {
      const x = anchor.x + dx * offset, y = anchor.y + dy * offset;
      if (x >= 0 && y >= 0 && x < width && y < height) cells.push(`${x},${y}`);
    }
    return unique(cells);
  }
  function shortLineCells({ anchor, width, height, orientation = "horizontal", length = 3 }) {
    const vectors = { horizontal: [1, 0], vertical: [0, 1], "diagonal-down": [1, 1], "diagonal-up": [1, -1] }, [dx, dy] = vectors[orientation] || vectors.horizontal, cells = [];
    for (let offset = 0; offset < length; offset += 1) {
      const x = Number(anchor?.x) + dx * offset, y = Number(anchor?.y) + dy * offset;
      if (x < 0 || y < 0 || x >= width || y >= height) return [];
      cells.push(`${x},${y}`);
    }
    return cells;
  }
  function connectedCells(cells = []) {
    if (!cells.length) return false;
    const set = new Set(cells), seen = new Set([cells[0]]), queue = [cells[0]];
    while (queue.length) {
      const [x, y] = queue.shift().split(",").map(Number);
      for (const next of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) if (set.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
    return seen.size === set.size;
  }
  const actionNamed = name => (global.DAWN_DATA?.actions?.list || []).find(action => action.name === name);
  const effectiveEffects = (scene, actor) => global.DAWN_SCENE_ENGINE?.effectiveEffects?.(scene, actor.id) || actor.effects || [];

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
        const statuses = rules.map(rule => rule.automation);
        const automation = rules.length ? (statuses.every(status => status === "full") ? "full" : statuses.includes("decision") ? "decision" : "partial") : (semanticSignals ? "partial" : "manual");
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

  function foundationPreview(scene, actor, rule, request = {}) {
    const core = global.DAWN_SCENE_ENGINE;
    let foundation;
    if (rule.foundation === "clock") foundation = core.clockStatus(scene, actor.id, rule.clockId, { size: rule.size, initial: rule.initial, delta: Number(request.options?.delta || 0) });
    else if (rule.foundation === "alternate-resource") foundation = core.alternateResourceStatus(scene, actor.id, { resource: rule.resource, label: rule.resourceLabel, initial: rule.initial, amount: Number(request.options?.amount ?? 1), replaces: rule.replaces });
    else if (rule.foundation === "stance") foundation = core.stanceStatus(scene, actor.id, rule.stanceId, { requiredEffects: rule.requiredEffects });
    else if (rule.foundation === "owned-entities") foundation = core.ownedEntities(scene, actor.id, { rulePrefix: rule.rulePrefix, kinds: rule.kinds });
    else if (rule.foundation === "action-history") foundation = core.actionHistoryStatus(scene, actor.id, { scope: rule.scope, actionNames: rule.actionNames, targetIds: request.targetIds });
    else if (rule.foundation === "terrain") foundation = core.terrainStatus(scene, { actorId: actor.id, objectId: request.options?.objectId, cell: request.anchor, range: rule.range, types: rule.types, ownerOnly: Boolean(request.options?.ownerOnly) });
    else foundation = { available: false, reason: "Неизвестная заготовка ядра." };
    const warning = foundation.available ? "Каноническая проверка готова; полный механический итог пока подтверждает Нарратор." : `Текущее условие не выполнено: ${foundation.reason}`;
    return {
      ok: true,
      engineVersion: VERSION,
      actorId: actor.id,
      rule: publicRule(rule),
      request: { anchor: request.anchor || null, targetIds: clone(request.targetIds || []), options: clone(request.options || {}) },
      errors: [],
      warnings: [warning],
      commands: [{ type: "manual_rule", actorId: actor.id, ruleId: rule.id, label: rule.name, note: warning }],
      summary: `«${rule.name}»: подготовка ядра выполнена`,
      affectedCells: request.anchor ? [pointKey(request.anchor)] : [],
      affectedActorIds: clone(request.targetIds || []),
      foundation,
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
    if (rule.kind === "foundation") return foundationPreview(scene, actor, rule, request);
    if (rule.kind === "combo") {
      const prepared = global.DAWN_SCENE_ENGINE?.prepareTechniqueCombo(scene, global.DAWN_DATA, { actorId: actor.id, ruleId: rule.id, targetIds: request.targetIds || [], destination: request.destination || null, roll: request.roll || null });
      if (!prepared?.ok) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: prepared?.errors || ["Ядро комбо недоступно."], warnings: [], commands: [], events: [], affectedCells: [], affectedActorIds: [] };
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events: prepared.events, summary: `«${rule.name}»: комбо готово`, affectedCells: request.destination ? [pointKey(request.destination)] : [], affectedActorIds: clone(request.targetIds || []) };
    }
    if (rule.kind === "passive") return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: ["Пассивное правило уже учтено автоматически."], warnings: [], commands: [], affectedCells: [], affectedActorIds: [] };
    if (rule.kind === "state-toggle") {
      if (!actor.ruleState?.grimTransformed) errors.push("«Вытянуть жизнь» доступно только в Трансформации.");
      if (errors.length) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors, warnings: [], commands: [], events: [], affectedCells: [], affectedActorIds: [] };
      const enabled = !Boolean(actor.ruleState?.[rule.stateKey]);
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events: [
        { type: "technique.prepare", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, participantIds: [actor.id] } },
        { type: "actor.state", actorId: actor.id, payload: { key: rule.stateKey, value: enabled, sourceActionId: rule.id } },
        { type: "technique.resolve", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, enabled, affectedActorIds: [actor.id] } },
      ], summary: `${rule.name}: ${enabled ? "подготовлено" : "отменено"}`, affectedCells: [], affectedActorIds: [actor.id] };
    }
    if (rule.kind === "surgery") {
      const targetId = unique(request.targetIds || [])[0] || null;
      const prepared = global.DAWN_SCENE_ENGINE?.prepareSurgery(scene, global.DAWN_DATA, { actorId: actor.id, targetId, roll: request.roll || null });
      if (!prepared?.ok) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: prepared?.errors || ["Ядро операции недоступно."], warnings: [], commands: [], events: [], affectedCells: [], affectedActorIds: [] };
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events: prepared.events, summary: "«Не навреди»: операция готова", affectedCells: [], affectedActorIds: [targetId] };
    }

    const sourceSpace = activeSpace(scene, actor.space);
    const anchor = request.anchor && { x: integer(request.anchor.x), y: integer(request.anchor.y) };
    const commands = [];
    let affectedCells = [];
    let affectedActorIds = [];

    if (rule.kind === "trap-placement") {
      const actionMode = request.options?.actionMode === "finish" ? "finish" : "skirmish", action = actionNamed(actionMode === "finish" ? "Завершение" : "Стычка"), available = global.DAWN_SCENE_ENGINE?.availableActions(scene, global.DAWN_DATA, actor.id).find(item => item.id === action?.id);
      if (!inBounds(sourceSpace, anchor)) errors.push("Выберите пустую клетку для Малой ловушки.");
      if (anchor && (scene.actors || []).some(item => !item.knockedOut && item.space === actor.space && item.x === anchor.x && item.y === anchor.y)) errors.push("Малая ловушка ставится только в пустую клетку.");
      const range = actionMode === "skirmish" ? 1 + (Number(actor.techniques?.["disruptor.hunter"] || 0) >= 2 ? 3 : 0) : 1;
      if (anchor && manhattan(actor, anchor) > range) errors.push(`Для этого способа установки клетка должна быть в пределах ${range}.`);
      if (available && !available.available && !/Это действие уже использовано/.test(available.reason || "")) errors.push(available.reason);
      if (errors.length) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors, warnings: [], commands: [], events: [], affectedCells: [], affectedActorIds: [] };
      const cost = global.DAWN_SCENE_ENGINE?.actionCost(action) || { resource: "ap", amount: actionMode === "finish" ? 2 : 1 }, events = [
        { type: "technique.prepare", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, affectedCells: [pointKey(anchor)], participantIds: [actor.id] } },
        { type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, actionName: action.name, name: rule.name, targetIds: [], quick: actionMode === "skirmish", quickSource: actionMode === "skirmish" ? { techniqueId: "disruptor.hunter", level: 1, name: "Стальные челюсти" } : null } },
      ];
      if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });
      events.push({ type: "marker.create", actorId: actor.id, payload: { id: idFactory("trap"), space: actor.space, x: anchor.x, y: anchor.y, markerKind: "trap", label: "Малая ловушка", color: rule.color, source: rule.id, ruleId: rule.id, duration: "scene", ownerActorId: actor.id, metadata: { actionMode } } });
      events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: action.id, name: action.name, targetIds: [] } });
      events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, affectedCells: [pointKey(anchor)] } });
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events, summary: "Малая ловушка подготовлена", affectedCells: [pointKey(anchor)], affectedActorIds: [] };
    }

    if (rule.kind === "creation-attack") {
      const action = actionNamed(rule.action), available = global.DAWN_SCENE_ENGINE?.availableActions(scene, global.DAWN_DATA, actor.id).find(item => item.id === action?.id), lastAction = (scene.log || []).find(event => event.type === "action.prepare" && event.actorId === actor.id), inherited = rule.action === "Завершение" && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 3 && lastAction?.payload?.actionName === "Заклинание" ? Number(actor.ruleState?.lastCreationSpellMarks || 0) : 0, marks = Number(actor.creationMarks || 0), effectiveMarks = marks || inherited;
      if (!action || !available) errors.push("Базовая Атака для формы не найдена.");
      if (available && !available.available) errors.push(available.reason);
      if (rule.markBand === "low" && (effectiveMarks < 1 || effectiveMarks > 2)) errors.push("Эта форма требует 1–2 Метки творения.");
      if (rule.markBand === "high" && effectiveMarks < 3) errors.push("Эта форма требует 3 или больше Меток творения.");
      if (!request.roll || !Array.isArray(request.roll.rolls)) errors.push("Для формы нужен бросок соответствующей Атаки.");
      const targetIds = [], targetCells = [];
      if (rule.form === "nails") {
        const lines = Array.isArray(request.options?.lines) ? request.options.lines.slice(0, 2) : [];
        const built = lines.map(line => shortLineCells({ anchor: line.anchor, width: sourceSpace.width, height: sourceSpace.height, orientation: line.orientation, length: 3 }));
        if (built.length !== 2 || built.some(line => line.length !== 3) || !built[0].some(cell => built[1].includes(cell))) errors.push("Выберите две Линии длиной 3 клетки, пересекающиеся хотя бы в одной клетке.");
        else targetCells.push(...unique(built.flat()));
      } else if (rule.form === "mallet") {
        const chosenDistance = Number(request.options?.distance || 0);
        if (!Number.isInteger(chosenDistance) || chosenDistance < 1 || chosenDistance > 5) errors.push("Выберите точное расстояние от 1 до 5.");
        else targetIds.push(...(scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && distance(actor, target) === chosenDistance).map(target => target.id));
      } else if (rule.form === "pile-arm") {
        const selected = unique(request.targetIds || []);
        if (selected.length !== 1 || !actorById(scene, selected[0]) || actorById(scene, selected[0]).team === actor.team || distance(actor, actorById(scene, selected[0])) !== 1) errors.push("Небесный сваебой выбирает одного смежного врага.");
        else targetIds.push(selected[0]);
      } else if (rule.form === "idol") {
        const selectedCells = unique(request.cells || []);
        if (!selectedCells.length || selectedCells.length > 6 || !connectedCells(selectedCells)) errors.push("Выберите от 1 до 6 связанных по сторонам клеток.");
        else if (!selectedCells.some(cell => { const [x, y] = cell.split(",").map(Number); return manhattan(actor, { x, y }) === 1; })) errors.push("Хотя бы одна клетка Живого идола должна быть смежна с вами.");
        else if (selectedCells.some(cell => { const [x, y] = cell.split(",").map(Number); return !inBounds(sourceSpace, { x, y }); })) errors.push("Одна из клеток Живого идола находится вне поля.");
        else targetCells.push(...selectedCells);
      }
      if (targetCells.length) targetIds.push(...(scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && target.space === actor.space && targetCells.includes(pointKey(target))).map(target => target.id));
      if (!targetIds.length && ["mallet", "pile-arm"].includes(rule.form)) errors.push("В выбранной форме нет доступной цели.");
      if (errors.length) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors, warnings: [], commands: [], events: [], affectedCells: targetCells, affectedActorIds: targetIds };
      const cost = global.DAWN_SCENE_ENGINE?.actionCost(action) || { resource: "ap", amount: rule.action === "Завершение" ? 2 : 1 }, baseDamage = Number(request.roll.successes || 0) + (rule.action === "Завершение" ? Number(scene.tension || 0) : 0), effectDamage = (effectiveEffects(scene, actor).includes("positive.усилен") ? Number(actor.tier || 1) : 0) - (effectiveEffects(scene, actor).includes("negative.ослаблен") ? Number(actor.tier || 1) : 0), chosenDistance = Number(request.options?.distance || 0), damageByTarget = Object.fromEntries(targetIds.map(id => [id, Math.max(0, baseDamage + effectDamage + (rule.form === "mallet" ? chosenDistance : 0) + (effectiveEffects(scene, actorById(scene, id)).includes("negative.помечен") ? Number(actor.tier || 1) : 0))])), events = [
        { type: "technique.prepare", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, affectedCells: targetCells, targetIds, participantIds: [actor.id, ...targetIds], creationMarksSpent: effectiveMarks } },
        { type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, actionName: action.name, name: rule.name, targetIds, quick: false, creationMarksSpent: effectiveMarks } },
      ];
      if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });
      if (marks) events.push({ type: "resource.spend", actorId: actor.id, payload: { resource: "creationMarks", amount: marks, sourceActionId: rule.id } });
      if (rule.action === "Заклинание" && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 3) events.push({ type: "actor.state", actorId: actor.id, payload: { key: "lastCreationSpellMarks", value: effectiveMarks, sourceActionId: "ruiner.creation-ascetic.3" } });
      if (rule.action === "Завершение" && inherited) events.push({ type: "actor.state", actorId: actor.id, payload: { key: "lastCreationSpellMarks", value: 0, sourceActionId: "ruiner.creation-ascetic.3" } });
      targetIds.forEach(id => events.push({ type: "reaction.offer", actorId: id, payload: { sourceActorId: actor.id, actionId: rule.id, participantIds: [actor.id, id] } }));
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, techniqueRuleId: rule.id, techniqueName: rule.name, name: rule.name, targetIds, targetCells, allowEmptyTargets: ["nails", "idol"].includes(rule.form), roll: clone(request.roll), damage: Math.max(0, baseDamage + effectDamage), damageByTarget, creationMarksSpent: effectiveMarks, postPush: rule.form === "pile-arm" ? { targetId: targetIds[0], maximum: 99, name: rule.name, ruleId: rule.id } : null, createTerrain: rule.form === "idol" ? { cells: targetCells, label: "Живой идол · высокая местность", ruleId: rule.id, hp: 10 } : null, participantIds: [actor.id, ...targetIds] } });
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events, summary: `${rule.name}: Атака подготовлена`, affectedCells: targetCells, affectedActorIds: targetIds };
    }

    if (rule.kind === "equidistant-teleport") {
      const destination = request.destination && { x: integer(request.destination.x), y: integer(request.destination.y) };
      if (!inBounds(sourceSpace, anchor)) errors.push("Сначала выберите несмежную пустую клетку Заклинания.");
      if (anchor && manhattan(actor, anchor) <= 1) errors.push("Клетка Заклинания должна быть несмежной.");
      if (anchor && manhattan(actor, anchor) > Number(rule.range || 5)) errors.push(`Клетка Заклинания должна быть в пределах ${rule.range || 5} клеток.`);
      if (anchor && (scene.actors || []).some(item => item.space === actor.space && item.x === anchor.x && item.y === anchor.y)) errors.push("Целью должна быть пустая клетка.");
      if (!inBounds(sourceSpace, destination)) errors.push("Теперь выберите клетку приземления.");
      if (destination && (scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка приземления занята.");
      if (anchor && destination && manhattan(anchor, destination) !== manhattan(actor, anchor)) errors.push(`Приземление должно быть ровно в ${manhattan(actor, anchor)} клетках от цели Заклинания.`);
      const spell = (global.DAWN_DATA?.actions?.list || []).find(action => action.name === "Заклинание");
      const available = global.DAWN_SCENE_ENGINE?.availableActions(scene, global.DAWN_DATA, actor.id).find(action => action.id === spell?.id);
      if (available && !available.available) errors.push(available.reason);
      if (errors.length) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors, warnings: [], commands: [], events: [], affectedCells: [], affectedActorIds: [] };
      const events = [
        { type: "technique.prepare", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, affectedCells: [pointKey(anchor), pointKey(destination)], participantIds: [actor.id] } },
        { type: "action.prepare", actorId: actor.id, payload: { actionId: spell.id, actionName: spell.name, name: rule.name, targetIds: [], quick: Boolean(available?.quick), quickSource: available?.quickSource || null } },
      ];
      const cost = available?.costModel || global.DAWN_SCENE_ENGINE.actionCost(spell);
      if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });
      events.push({ type: "actor.move", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Выстрел крюком", participantIds: [actor.id] } });
      events.push({ type: "actor.enter", actorId: actor.id, payload: { space: actor.space, x: destination.x, y: destination.y, movement: "Выстрел крюком" } });
      events.push({ type: "action.resolve", actorId: actor.id, payload: { actionId: spell.id, name: rule.name, targetIds: [] } });
      events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, affectedCells: [pointKey(anchor), pointKey(destination)], affectedActorIds: [actor.id] } });
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events, summary: `«${rule.name}»: телепортация готова`, affectedCells: [pointKey(anchor), pointKey(destination)], affectedActorIds: [actor.id] };
    }

    if (rule.optionMinimum) {
      const actual = Number(request.options?.[rule.optionMinimum.key] || 0);
      if (actual < rule.optionMinimum.value) errors.push(`Нужно: ${rule.optionMinimum.label} — не меньше ${rule.optionMinimum.value}.`);
    }
    if (rule.areaType === "attack") {
      const finish = (global.DAWN_DATA?.actions?.list || []).find(action => action.name === "Завершение"), available = global.DAWN_SCENE_ENGINE?.availableActions(scene, global.DAWN_DATA, actor.id).find(action => action.id === finish?.id), spent = Number(request.options?.focusSpent || 0);
      if (available && !available.available) errors.push(available.reason);
      if (spent < 0 || spent > Number(actor.focus || 0) || spent > Number(scene.tension || 0)) errors.push("На Завершение нельзя потратить больше Фокуса, чем есть у героя или текущего Напряжения.");
      const modifiers = [...new Set(actor.techniqueState?.spellModifiers || [])], level = Number(actor.techniques?.["ruiner.spellcrafter"] || 0), resource = level >= 2 ? "focus" : "innovationCharges";
      if (modifiers.length > (level >= 3 ? 2 : 1)) errors.push("Выбрано слишком много Модификаций.");
      if (modifiers.length && Number(actor[resource] || 0) < modifiers.length + (resource === "focus" ? spent : 0)) errors.push("Недостаточно ресурса для выбранных Модификаций.");
    }

    if (["area", "marker"].includes(rule.kind)) {
      if (!inBounds(sourceSpace, anchor)) errors.push("Укажите клетку на текущем поле.");
      if (rule.range && anchor) {
        const rangeBonus = rule.areaType === "attack" && (actor.techniqueState?.spellModifiers || []).includes("outstanding") ? Number(actor.attrs?.mind || 0) : 0;
        if (manhattan(actor, anchor) > rule.range + rangeBonus) errors.push(`Клетка находится дальше ${rule.range + rangeBonus} клеток.`);
      }
      if (rule.adjacency && anchor && manhattan(actor, anchor) !== 1) errors.push("Зона должна быть смежна с персонажем.");
    }

    if (rule.kind === "area" && !errors.length) {
      const modifiers = rule.areaType === "attack" ? [...new Set(actor.techniqueState?.spellModifiers || [])] : [], focused = modifiers.includes("focused"), wild = modifiers.includes("wild"), outstanding = modifiers.includes("outstanding");
      const effectiveShape = wild && rule.shape === "line" ? "square2" : rule.shape;
      affectedCells = focused && rule.shape !== "line" ? segmentLineCells({ anchor, width: sourceSpace.width, height: sourceSpace.height, orientation: request.orientation, length: 7 + (outstanding ? Number(actor.attrs?.mind || 0) : 0) }) : areaCells({ shape: effectiveShape, anchor, width: sourceSpace.width, height: sourceSpace.height, orientation: request.orientation });
      affectedActorIds = (scene.actors || []).filter(item => !item.knockedOut && item.space === actor.space && affectedCells.includes(pointKey(item)) && (rule.areaType !== "attack" || item.team !== actor.team)).map(item => item.id);
      if (rule.id === "disruptor.chemist.1") {
        const terrain = [...(scene.objects || [])].reverse().find(object => object.space === actor.space && ["terrain", "difficult", "custom"].includes(object.type) && (object.cells || []).includes(pointKey(anchor)));
        if (!terrain) errors.push("«Сублимация» должна выбирать существующий элемент местности.");
        else commands.push({ type: "remove_area", id: terrain.id, label: terrain.label });
      }
      commands.push({ type: "create_area", space: actor.space, areaType: rule.areaType, label: rule.name, source: rule.id, ruleId: rule.id, duration: rule.duration, ownerActorId: actor.id, cells: affectedCells, metadata: modifiers.length ? { spellModifiers: modifiers } : {} });
      commands.push({ type: "set_targets", actorIds: affectedActorIds });
      if (rule.areaType === "attack" && !request.roll) errors.push("Для зональной Атаки нужен бросок Завершения.");
    }

    if (rule.kind === "marker" && !errors.length) {
      affectedCells = [pointKey(anchor)];
      commands.push({ type: "create_marker", space: actor.space, x: anchor.x, y: anchor.y, markerKind: rule.markerKind, label: rule.name, color: rule.color, source: rule.id, ruleId: rule.id, duration: rule.duration, ownerActorId: actor.id });
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
    return { ok: errors.length === 0, engineVersion: VERSION, actorId: actor?.id || null, rule: publicRule(rule), request: { anchor: request.anchor || null, destination: request.destination || null, targetIds: clone(request.targetIds || []), orientation: request.orientation || "horizontal", options: clone(request.options || {}), roll: clone(request.roll || null) }, errors, warnings, summary, commands, affectedCells, affectedActorIds };
  }

  function toEvents(scene, prepared, options = {}) {
    if (!prepared?.ok) throw new Error("Нельзя создать события Техники с ошибками предпросмотра.");
    if (Array.isArray(prepared.events)) return clone(prepared.events);
    const makeId = typeof options.makeId === "function" ? options.makeId : idFactory;
    const actorId = prepared.actorId || prepared.commands.find(command => command.actorId)?.actorId || prepared.commands.find(command => command.ownerActorId)?.ownerActorId || null;
    const events = [{ type: "technique.prepare", actorId, payload: { ruleId: prepared.rule.id, name: prepared.rule.name, request: clone(prepared.request || {}) } }];
    const references = {};
    if (prepared.rule.areaType === "attack") {
      const actor = actorById(scene, actorId), finish = (global.DAWN_DATA?.actions?.list || []).find(action => action.name === "Завершение"), targetIds = clone(prepared.affectedActorIds || []), roll = clone(prepared.request?.roll || null), focusSpent = Number(prepared.request?.options?.focusSpent || 0), modifiers = [...new Set(actor?.techniqueState?.spellModifiers || [])], modifierResource = Number(actor?.techniques?.["ruiner.spellcrafter"] || 0) >= 2 ? "focus" : "innovationCharges";
      events.push({ type: "action.prepare", actorId, payload: { actionId: finish.id, actionName: finish.name, name: prepared.rule.name, targetIds, quick: false } });
      events.push({ type: "resource.spend", actorId, payload: { resource: "ap", amount: 2 } });
      if (focusSpent) events.push({ type: "resource.spend", actorId, payload: { resource: "focus", amount: focusSpent } });
      if (modifiers.length) {
        events.push({ type: "resource.spend", actorId, payload: { resource: modifierResource, amount: modifiers.length, sourceActionId: "ruiner.spellcrafter" } });
        events.push({ type: "technique.state", actorId, payload: { key: "spellModifiers", value: [], ruleId: "ruiner.spellcrafter", name: "Модификации применены" } });
      }
      for (const command of prepared.commands) {
        if (command.type === "create_area") events.push({ type: "area.create", actorId, payload: { ...clone(command), id: makeId("area") } });
        else if (command.type === "set_targets") events.push({ type: "targets.set", actorId, payload: { actorIds: clone(command.actorIds) } });
      }
      targetIds.forEach(targetId => events.push({ type: "reaction.offer", actorId: targetId, payload: { sourceActorId: actorId, actionId: prepared.rule.id, participantIds: [actorId, targetId] } }));
      events.push({ type: "attack.pending", actorId, payload: { actionId: finish.id, techniqueRuleId: prepared.rule.id, techniqueName: prepared.rule.name, name: prepared.rule.name, targetIds, roll, damage: Number(roll?.successes || 0) + Number(scene.tension || 0) + (modifiers.includes("fierce") ? Number(actor?.attrs?.mind || 0) : 0), spellModifiers: modifiers, participantIds: [actorId, ...targetIds] } });
      return events;
    }
    if (prepared.rule.optionMinimum?.key === "focusSpent") events.push({ type: "resource.spend", actorId, payload: { resource: "focus", amount: Number(prepared.request?.options?.focusSpent || 0) } });
    for (const command of prepared.commands) {
      if (command.type === "create_area") events.push({ type: "area.create", actorId, payload: { ...clone(command), id: makeId("area") } });
      else if (command.type === "create_marker") events.push({ type: "marker.create", actorId, payload: { ...clone(command), id: makeId("marker") } });
      else if (command.type === "remove_area") events.push({ type: "area.remove", actorId, payload: { id: command.id, label: command.label, sourceActionId: prepared.rule.id } });
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
    } else if (command.type === "remove_area") {
      scene.objects = (scene.objects || []).filter(object => object.id !== command.id);
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
