"use strict";

(function exposeTechniqueFoundationMap(global) {
  const VERSION = 1;
  const CAPABILITIES = {
    "event-participants": { label: "Участники события", state: "ready", module: "scene-engine-core.js" },
    "event-preview": { label: "Предпросмотр цепочки", state: "ready", module: "scene-triggers.js" },
    "spatial-cells": { label: "Персонажи в клетках", state: "ready", module: "scene-query.js" },
    "spatial-range": { label: "Персонажи в дальности", state: "ready", module: "scene-query.js" },
    "target-validation": { label: "Проверка целей", state: "ready", module: "scene-query.js" },
    "resource-check": { label: "Проверка ресурсов", state: "ready", module: "scene-query.js" },
    "effect-state": { label: "Состояние Эффекта", state: "ready", module: "scene-query.js" },
    "event-summary": { label: "Сводка цепочки", state: "ready", module: "scene-query.js" },
    "rule-clock": { label: "Часы правила", state: "ready", module: "scene-foundations.js" },
    "alternate-resource": { label: "Альтернативный ресурс", state: "ready", module: "scene-foundations.js" },
    stance: { label: "Стойки", state: "ready", module: "scene-foundations.js" },
    "owned-entities": { label: "Принадлежащие сущности", state: "ready", module: "scene-foundations.js" },
    "action-history": { label: "История действий", state: "ready", module: "scene-foundations.js" },
    terrain: { label: "Местность", state: "ready", module: "scene-foundations.js" },
    "usage-limits": { label: "Раз за Ход/Раунд/Сцену", state: "planned" },
    "trigger-router": { label: "Маршрутизация триггеров", state: "planned" },
    "movement-lifecycle": { label: "Жизненный цикл движения", state: "planned" },
    "choice-flow": { label: "Типизированное решение", state: "planned" },
    "damage-pipeline": { label: "Конвейер урона и исцеления", state: "planned" },
    "action-modifier": { label: "Модификатор базового действия", state: "planned" },
    "entity-lifecycle": { label: "Жизненный цикл зон и маркеров", state: "planned" },
    inventory: { label: "Инвентарь и заряды", state: "planned" },
    "summon-turns": { label: "Призывы и делегированные Ходы", state: "planned" },
    "dice-hooks": { label: "Модификаторы броска", state: "planned" },
    "duration-scheduler": { label: "Сроки действия и отложенные эффекты", state: "planned" },
    "deployment-hooks": { label: "Развертывание", state: "planned" },
    "intermission-reset": { label: "Сброс на Интермиссии", state: "planned" },
    "bond-actions": { label: "Действия Связей", state: "planned" },
    "manual-ruling": { label: "Ручное решение Нарратора", state: "fallback" },
  };

  const REVIEWED = {
    "powerhouse.braggart.1": ["rule-clock"],
    "powerhouse.gunslinger.1": ["alternate-resource"],
    "vagabond.aerial-master.1": ["stance"],
    "bulwark.servant-s-call.1": ["owned-entities"],
    "powerhouse.spellsword.3": ["action-history"],
    "powerhouse.improvisational-fighter.1": ["terrain"],
  };

  function planForLevel(level = {}) {
    const mechanics = level.mechanics || {}, text = String(level.text || ""), id = String(level.id || ""), evidence = new Map();
    const add = (capability, reason) => {
      if (!CAPABILITIES[capability]) return;
      const reasons = evidence.get(capability) || [];
      if (reason && !reasons.includes(reason)) reasons.push(reason);
      evidence.set(capability, reasons);
    };
    add("event-preview", "любая автоматизация проходит предварительную проверку цепочки");
    add("event-summary", "интерфейс должен объяснять подготовленные последствия");
    if (mechanics.targets) { add("target-validation", "индекс механик: есть цели"); add("event-participants", "цели должны быть видимы в цепочке"); }
    if (mechanics.movement || /перемест|телепорт|толк|притян|клетк/i.test(text)) add("movement-lifecycle", mechanics.movement ? "индекс механик: есть перемещение" : "текст упоминает перемещение или клетки");
    if ((mechanics.areas || []).length) { add("spatial-cells", "индекс механик: есть область"); add("entity-lifecycle", "область требует создания или разрешения"); }
    if ((mechanics.ranges || []).length) add("spatial-range", `индекс механик: дальность ${mechanics.ranges.join("/")}`);
    if ((mechanics.resources || []).length) add("resource-check", `индекс механик: ресурсы ${mechanics.resources.join(", ")}`);
    if ((mechanics.effects || []).length || (mechanics.directEffects || []).length) add("effect-state", "индекс механик: есть Эффекты");
    if ((mechanics.clocks || []).length || /часы|сегмент/i.test(text)) add("rule-clock", "правило использует часы или сегменты");
    if (/вместо\s+\*\*(?:Фокуса|ОД)\*\*|теперь вместо|используете \*\*[^*]+\*\* вместо/i.test(text)) add("alternate-resource", "правило заменяет базовый ресурс");
    if (/Стойк/i.test(text)) add("stance", "текст использует Стойку");
    if (/местност|объект|элемент местности/i.test(text)) add("terrain", "текст взаимодействует с местностью");
    if (/маркер|зон[ауеы]|Призыв|Скакун|Костюм/i.test(text)) { add("owned-entities", "правило создаёт или использует сущность"); add("entity-lifecycle", "сущности нужен срок жизни"); }
    if (/Призыв|Скакун|Костюм.*Ход/i.test(text)) add("summon-turns", "сущность действует как участник");
    if (/перв(?:ый|ая|ое) раз|один раз|раз за \*\*(?:Ход|Раунд|Сцену)|не больше одного раза/i.test(text)) add("usage-limits", "правило ограничено периодом");
    if (mechanics.conditional || /когда |всякий раз|после |в начале|в конце|пока /i.test(text)) add("trigger-router", mechanics.conditional ? "индекс механик: условное правило" : "текст содержит временной триггер");
    if (/можете выбрать|выберите |по вашему выбору|если вы это делаете|отказаться/i.test(text)) add("choice-flow", "правило требует решения игрока");
    if (/урон|Здоров|Ран[ауые]|исцел|восстанавлив/i.test(text)) add("damage-pipeline", "правило меняет урон, Здоровье, Рану или исцеление");
    if ((mechanics.actions || []).length || /Стоимость|Быстр|бесплат|Атак|Стычк|Заклинан|Завершен/i.test(text)) add("action-modifier", "правило изменяет или вызывает действие");
    if ((mechanics.actions || []).length > 1 || /\[[^\]]+\s*->\s*[^\]]+\]/.test(text) || /предыдущ|ранее в этот \*\*Ход|того же персонажа/i.test(text)) add("action-history", "правило зависит от последовательности действий");
    if (/брос|кост|Успех|Преимуществ|Помех|Критичес/i.test(text)) add("dice-hooks", "правило изменяет или читает бросок");
    if (/до конца|до начала|следующего \*\*Ход|следующего \*\*Раунд|исчезает/i.test(text)) add("duration-scheduler", "последствие имеет срок");
    if (/Развертыван/i.test(text)) add("deployment-hooks", "правило срабатывает при Развертывании");
    if (/Интермисси/i.test(text)) add("intermission-reset", "правило связано с Интермиссией");
    if (/Связ[ьи]|действие Связи/i.test(text)) add("bond-actions", "правило использует Связи");
    if (/запас|Зель|Бинт|Антисептик|заряд|Пул[ия]|Трапез/i.test(text)) add("inventory", "правило хранит предметы или заряды");
    const reviewed = [...new Set(REVIEWED[id] || [])];
    reviewed.forEach(capability => add(capability, "проверено первым foundation-адаптером"));
    if (!evidence.size) add("manual-ruling", "автоматизируемый паттерн ещё не выделен");
    return {
      version: VERSION,
      status: reviewed.length ? "started" : "candidate",
      reviewed,
      capabilities: [...evidence].map(([capability, reasons]) => ({ id: capability, state: CAPABILITIES[capability].state, reasons })),
    };
  }

  global.DAWN_TECHNIQUE_FOUNDATION_MAP = { VERSION, CAPABILITIES, REVIEWED, planForLevel };
})(typeof window === "object" ? window : globalThis);
