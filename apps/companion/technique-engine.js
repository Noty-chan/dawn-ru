"use strict";

(function exposeDawnTechniqueEngine(global) {
  const VERSION = 15;
  const CHEMIST_TERRAIN_TYPES = new Set(["terrain", "difficult", "high", "low", "custom"]);

  const RULES = [
    { id: "powerhouse.braggart.1.foundation", techniqueId: "powerhouse.braggart", level: 1, name: "Гордыня", kind: "foundation", foundation: "clock", automation: "partial", clockId: "powerhouse.braggart.pride", size: 6, initial: 0, note: "Гордость получает сегменты от Атак низкими Атрибутами и попаданий без защитной Реакции; полные часы дают Преимущество." },
    { id: "powerhouse.braggart.2", techniqueId: "powerhouse.braggart", level: 2, name: "Докажи, чего стоишь", kind: "passive", automation: "decision", note: "При заполнении предлагается очистить часы и уменьшить их размер на 2, минимум до 2." },
    { id: "powerhouse.braggart.3", techniqueId: "powerhouse.braggart", level: 3, name: "Достойный противник", kind: "passive", automation: "decision", note: "Полученная Рана предлагает заполнить сегмент Гордости." },
    { id: "vagabond.cunning-fighter.1.foundation", techniqueId: "vagabond.cunning-fighter", level: 1, name: "План и исполнение", kind: "foundation", foundation: "clock", automation: "decision", clockId: "vagabond.cunning-fighter.plan", size: 4, initial: 0, note: "Новая цель Изучения заполняет Хитрый план; интерфейс явно предлагает потратить сегмент на Быстрое действие не-Атаки." },
    { id: "vagabond.egomaniac.1.foundation", techniqueId: "vagabond.egomaniac", level: 1, name: "Пиковая форма", kind: "foundation", foundation: "clock", automation: "decision", clockId: "vagabond.egomaniac.style", size: 4, initial: 0, note: "Четыре условия заполняют Стиль, попадание очищает сегмент, а полные часы запускают получение ОД и выбор прямого перемещения." },
    { id: "vagabond.egomaniac.2", techniqueId: "vagabond.egomaniac", level: 2, name: "Дразнить, красоваться, устрашать", kind: "passive", automation: "decision", note: "При заполнении Стиля можно отказаться от ОД и выбрать массовый Спровоцирован или Испуган для врагов в пределах 3." },
    { id: "vagabond.egomaniac.3", techniqueId: "vagabond.egomaniac", level: 3, name: "Финал", kind: "passive", automation: "decision", note: "Зарядка предлагает распределить удвоенное Напряжение через любое число заполнений Стиля, разрешает каждый итог и затем отключает Стиль до конца Сцены." },
    { id: "bulwark.stalwart-sentry.2.foundation", techniqueId: "bulwark.stalwart-sentry", level: 2, name: "На посту", kind: "foundation", foundation: "clock", automation: "decision", clockId: "bulwark.stalwart-sentry.vigilance", size: 4, initial: 4, note: "Выход врага из смежности открывает Наказание с обычной оплатой либо очисткой Бдительности; бросок, Реакции и отмена проходят через общий конвейер." },
    { id: "altruist.chronomancer.3.foundation", techniqueId: "altruist.chronomancer", level: 3, name: "Остановка времени", kind: "foundation", foundation: "clock", automation: "decision", clockId: "altruist.chronomancer.flow", size: 8, initial: 0, note: "Полный Поток в начале Хода предлагает однократное массовое Заклинание, тратит все ОД и поддерживает Ва-банк с Раной и Завершением против врагов." },
    { id: "ruiner.cryomancer.1", techniqueId: "ruiner.cryomancer", level: 1, name: "Охлаждение", kind: "passive", automation: "full", note: "Успешное Заклинание после разрешения Реакций автоматически накладывает Замедлен на доступные цели." },
    { id: "ruiner.cryomancer.2.foundation", techniqueId: "ruiner.cryomancer", level: 2, name: "Ледяной нимб", kind: "foundation", foundation: "clock", automation: "decision", clockId: "ruiner.cryomancer.icicle", size: 4, initial: 0, note: "Передышка предлагает отказаться от Фокуса, очистить Сосульку и провести ограниченную серию Быстрых Заклинаний с половинным уроном, Реакциями и превращением Замедлен в Обездвижен." },
    { id: "ruiner.feral-arcana.2.foundation", techniqueId: "ruiner.feral-arcana", level: 2, name: "Сорваться с цепи", kind: "foundation", foundation: "clock", automation: "decision", clockId: "ruiner.feral-arcana.rage", size: 6, initial: 0, note: "Создание и жизненный цикл Ярости, ограничения ОД, Быстрые Прыжки и обязательное бесплатное Заклинание по всем смежным персонажам проходят через цели, Реакции, отмену и журнал." },
    { id: "ruiner.feral-arcana.3", techniqueId: "ruiner.feral-arcana", level: 3, name: "Хватка", kind: "passive", automation: "decision", note: "Завершение Телом может потратить всю Ярость, получить Преимущество от Напряжения и переместиться до 3 клеток перед созданием Атаки." },
    { id: "ruiner.void-soul.3.foundation", techniqueId: "ruiner.void-soul", level: 3, name: "Полое сердце", kind: "foundation", foundation: "clock", automation: "decision", clockId: "ruiner.void-soul.void", size: 6, initial: 0, note: "Полная Пустота открывает Завершение Духом по всем врагам центральной зоны 5×5 с половинным уроном и обычными Реакциями." },
    { id: "ruiner.thunder-blood.1.foundation", techniqueId: "ruiner.thunder-blood", level: 1, name: "Райден", kind: "foundation", foundation: "clock", automation: "decision", clockId: "ruiner.thunder-blood.static", size: 6, initial: 0, note: "Передышка предлагает заполнить Статику; непустая Статика автоматически снимает Ошеломлен." },
    { id: "ruiner.thunder-blood.2", techniqueId: "ruiner.thunder-blood", level: 2, name: "Заряженное заклинание", kind: "passive", automation: "decision", note: "После успешного Заклинания явный выбор исходной цели проводит Скачок, Разряд или Цепь через расход Статики, Ошеломление, проверку целей, новый бросок, Реакции, отмену и журнал." },
    { id: "ruiner.thunder-blood.3", techniqueId: "ruiner.thunder-blood", level: 3, name: "Разрядка", kind: "passive", automation: "decision", note: "При 3+ Статики Завершение Духом собирает зону 3×3 без владельца, добавляет Ступень урона уже Ошеломленным и после Успеха накладывает Ошеломлен." },
    { id: "ruiner.zealot.1.foundation", techniqueId: "ruiner.zealot", level: 1, name: "Еретическая преданность", kind: "foundation", foundation: "clock", automation: "decision", clockId: "ruiner.zealot.revelation", size: 6, initial: 0, note: "Публичный бросок с единицей предлагает потратить Фокус и заполнить Озарение; Зарядка, Заклинание и Завершение Духом умеют потратить сегмент и инвертировать итоговые Успехи." },
    { id: "ruiner.zealot.2", techniqueId: "ruiner.zealot", level: 2, name: "Всегда под взглядом, утоплен в слезах", kind: "passive", automation: "decision", note: "Начало Хода при четырёх сегментах предлагает Усиление и записывает отдельное наложение Испуган каждым персонажем." },
    { id: "ruiner.zealot.3", techniqueId: "ruiner.zealot", level: 3, name: "Так не должно было быть", kind: "passive", automation: "decision", note: "Полное Озарение открывает Завершение Духом по двум пересекающимся Линиям; стол последовательно проверяет сдвиг каждого персонажа, атомарно очищает часы, уничтожает связанную местность, удаляет клетки и ведёт обычную цепочку Реакций." },
    { id: "powerhouse.gunslinger.1.foundation", techniqueId: "powerhouse.gunslinger", level: 1, name: "Большой ствол", kind: "foundation", foundation: "alternate-resource", automation: "partial", resource: "bullets", resourceLabel: "Пули", initial: 6, replaces: ["focus"], note: "Пули сохраняются и изменяются событиями ядра; Стычка проверяет минимум, дальность и явное распределение дополнительных Пуль." },
    { id: "vagabond.modified-meister.1.foundation", techniqueId: "vagabond.modified-meister", level: 1, name: "На горячем ходу", kind: "foundation", foundation: "alternate-resource", automation: "partial", resource: "heat", resourceLabel: "Нагрев", initial: 0, replaces: ["focus"], note: "Стоимость в Фокусе повышает Нагрев, получение Фокуса снижает его; порог 6, сброс до 3 и базовый взрыв разрешаются ядром." },
    { id: "bulwark.mundane.1.foundation", techniqueId: "bulwark.mundane", level: 1, name: "Чего не хватает Духу", kind: "foundation", foundation: "alternate-resource", automation: "partial", resource: "grit", resourceLabel: "Упорство", initialFormula: "1 + floor(body / 2)", replaces: ["focus", "ap"], note: "Общий запас оплачивает Фокус и ОД, сбрасывается в начале Раунда; Передышка и Зарядка не пополняют его." },
    { id: "powerhouse.gunslinger.2", techniqueId: "powerhouse.gunslinger", level: 2, name: "Зарядить и взвести", kind: "passive", automation: "decision", note: "Стычки получают постоянное Преимущество; Ход без Атаки предлагает выставить Пули на 6." },
    { id: "powerhouse.gunslinger.3", techniqueId: "powerhouse.gunslinger", level: 3, name: "Жонглирование пулями", kind: "passive", automation: "full", note: "Одиночная Стычка за 3+ Пули автоматически накладывает Подброшен после разрешения Реакций." },
    { id: "vagabond.knife-juggler.1.foundation", techniqueId: "vagabond.knife-juggler", level: 1, name: "Метнуть", kind: "foundation", foundation: "alternate-resource", automation: "partial", resource: "weapons", resourceLabel: "Оружие", initial: 4, replaces: ["focus"], note: "Метание тратит 1 Оружие, обнуляет стоимость Стычки и меняет выбор цели и дальность." },
    { id: "vagabond.knife-juggler.2", techniqueId: "vagabond.knife-juggler", level: 2, name: "Пополнение", kind: "passive", automation: "decision", note: "После Метания создаётся маркер Оружия; вход предлагает подобрать его, получить Оружие и переместиться." },
    { id: "vagabond.knife-juggler.3", techniqueId: "vagabond.knife-juggler", level: 3, name: "Преследователь", kind: "passive", automation: "decision", note: "Выход врага из клетки маркера предлагает телепортацию и оплаченную Быструю Стычку без Метания." },
    { id: "vagabond.modified-meister.2", techniqueId: "vagabond.modified-meister", level: 2, name: "Перегрузка", kind: "passive", automation: "decision", note: "Явный выбор Перегрузки записывает Преимущество, Порчу целей и Нагрев за неуспешные кости после Реакций." },
    { id: "vagabond.modified-meister.3", techniqueId: "vagabond.modified-meister", level: 3, name: "Разгон", kind: "passive", automation: "decision", note: "Передышка при Напряжении 2+ предлагает Разгон; урон создаёт Нагрев, а взрыв предлагает альтернативное разрешение и перемещение." },
    { id: "bulwark.mundane.2", techniqueId: "bulwark.mundane", level: 2, name: "Копнуть глубже, стоять твердо", kind: "passive", automation: "full", note: "Получение предложения Реакции как цели Атаки даёт 1 Упорство." },
    { id: "bulwark.mundane.3", techniqueId: "bulwark.mundane", level: 3, name: "Перед лицом Запредельного", kind: "passive", automation: "decision", note: "Передышка и Зарядка принимают явный список целей Спровоцированного в пределах 4 и ограничивают его несостоявшимся получением Фокуса." },
    { id: "altruist.heavenly-saint.1.foundation", techniqueId: "altruist.heavenly-saint", level: 1, name: "Сила молитвы", kind: "foundation", foundation: "alternate-resource", automation: "partial", resource: "faith", resourceLabel: "Вера", initialFormula: "spirit", replaces: ["focus"], note: "Вера начинается с Духа, не пополняется Передышкой/Зарядкой и растёт при выборе союзника целью." },
    { id: "altruist.heavenly-saint.2", techniqueId: "altruist.heavenly-saint", level: 2, name: "Очищающий свет", kind: "passive", automation: "decision", note: "Заклинание по союзникам использует лечебное разрешение и явный выбор снимаемых Эффектов." },
    { id: "altruist.heavenly-saint.3", techniqueId: "altruist.heavenly-saint", level: 3, name: "Великое восстановление", kind: "passive", automation: "decision", note: "Завершение Духом наследует лечение, даёт Регенерацию и один раз за Сцену снимает Рану цели." },
    { id: "disruptor.autophage.1.foundation", techniqueId: "disruptor.autophage", level: 1, name: "Переливание", kind: "foundation", foundation: "alternate-resource", automation: "full", resource: "health", resourceLabel: "Здоровье", initial: 0, replaces: ["focus"], note: "Трата Фокуса создаёт оплату уроном 2:1 через конвейер урона; получение Фокуса создаёт лечение 1:1, а успешная Атака цели с двумя Эффектами запускает Регенерацию." },
    { id: "disruptor.autophage.2", techniqueId: "disruptor.autophage", level: 2, name: "Перенапряжение", kind: "autophage-overexert", automation: "decision" },
    { id: "disruptor.autophage.3", techniqueId: "disruptor.autophage", level: 3, name: "Рожденный изменчивой плотью", kind: "autophage-overexert", automation: "decision", double: true },
    { id: "disruptor.constrictor.1", techniqueId: "disruptor.constrictor", level: 1, name: "Обвить", kind: "passive", automation: "decision", note: "Успешная одиночная Стычка накладывает Пойман; движение источника предлагает притянуть цели, а конец Хода — по очереди переместить их на расстояние до 5 клеток." },
    { id: "disruptor.constrictor.2", techniqueId: "disruptor.constrictor", level: 2, name: "Удушение", kind: "passive", automation: "full", note: "Завершения Телом и Талантом игнорируют дальность для собственных Пойманных целей, а любое Завершение наносит им дополнительный урон Ступени." },
    { id: "vagabond.aerial-master.1.foundation", techniqueId: "vagabond.aerial-master", level: 1, name: "Над и вокруг", kind: "foundation", foundation: "stance", automation: "partial", stanceId: "vagabond.aerial-master.flight", requiredEffects: ["positive.ускорен"], note: "Условие входа в Стойку полёта и конфликт с другой Стойкой вычисляются канонически." },
    { id: "bulwark.servant-s-call.1.foundation", techniqueId: "bulwark.servant-s-call", level: 1, name: "Честь подчинённого", kind: "foundation", foundation: "owned-entities", automation: "partial", rulePrefix: "bulwark.servant-s-call", kinds: ["summon"], note: "Призывы собираются по владельцу и источнику правила; создание полноценного участника вместо маркера остаётся следующим этапом." },
    { id: "powerhouse.spellsword.3.foundation", techniqueId: "powerhouse.spellsword", level: 3, name: "Охотник на ведьм", kind: "foundation", foundation: "action-history", automation: "full", scope: "turn", actionKeys: ["spell"], note: "Ядро находит непосредственно предыдущее Заклинание и его цели; комбо проверяет Завершение Телом/Талантом по тем же целям и добавляет Дух к урону." },
    { id: "powerhouse.improvisational-fighter.1.foundation", techniqueId: "powerhouse.improvisational-fighter", level: 1, name: "Всё — инструмент", kind: "foundation", foundation: "terrain", automation: "partial", range: 5, types: ["terrain", "difficult", "custom"], note: "Поиск, дальность, владение и Здоровье местности готовы; выбор между созданием и удалением пока подтверждает игрок." },
    { id: "vagabond.cunning-fighter.2", techniqueId: "vagabond.cunning-fighter", level: 2, name: "Планы внутри планов", kind: "passive", automation: "full", note: "Снято ограничение одного «Плана и исполнения» за Ход." },
    { id: "bulwark.iron-bodied.2", techniqueId: "bulwark.iron-bodied", level: 2, name: "Выносливость", kind: "passive", automation: "full", note: "Броня автоматически включает [Тело / 2]." },
    { id: "bulwark.rising-challenger.3", techniqueId: "bulwark.rising-challenger", level: 3, name: "Драма и злость", kind: "passive", automation: "full", note: "В бросок Столкновения автоматически добавляются 3 кости." },
    { id: "altruist.gourmand.2", techniqueId: "altruist.gourmand", level: 2, name: "Бездонная кладовая", kind: "passive", automation: "full", note: "Запас Трапез автоматически равен 3 за Интермиссию." },
    { id: "powerhouse.technician.3", techniqueId: "powerhouse.technician", level: 3, name: "Последний удар", kind: "combo", automation: "full", sequenceKeys: ["skirmish", "finish"], actionKey: "finish", apCost: 1 },
    { id: "powerhouse.dragonslayer.1", techniqueId: "powerhouse.dragonslayer", level: 1, name: "Скорость — это вес", kind: "passive", automation: "full", note: "Успешное Завершение Телом после общего окна Реакций накладывает Разорван на доступные цели." },
    { id: "powerhouse.dragonslayer.3", techniqueId: "powerhouse.dragonslayer", level: 3, name: "Титанический замах", kind: "combo", automation: "full", sequenceKeys: ["breathe", "finish"], actionKey: "finish", attribute: "body", allDiceSucceed: true, postPush: 2, postSelfEffects: ["Ослаблен"] },
    { id: "powerhouse.spellsword.3", techniqueId: "powerhouse.spellsword", level: 3, name: "Охотник на ведьм", kind: "combo", automation: "full", sequenceKeys: ["spell", "finish"], actionKey: "finish", attributes: ["body", "talent"], sameTargets: true, bonusDamageAttribute: "spirit" },
    { id: "powerhouse.duelist.2", techniqueId: "powerhouse.duelist", level: 2, name: "Парирование", kind: "passive", automation: "full", note: "Ответ Блоком против смежного атакующего автоматически накладывает Ошеломлен до разрешения исходной Атаки." },
    { id: "bulwark.grappler.2", techniqueId: "bulwark.grappler", level: 2, name: "Перелом позвоночника", kind: "passive", automation: "decision", note: "Стычки получают 1 Преимущество. Для единственной Подброшенной цели можно выбрать составной модификатор: Вбить, телепортироваться в свободную смежную клетку и заменить Атаку на Завершение Телом по исходной Стоимости." },
    { id: "vagabond.assassin.1", techniqueId: "vagabond.assassin", level: 1, name: "Засада", kind: "passive", automation: "full", note: "Первое Скрыться после Развертывания автоматически бесплатно и игнорирует требования." },
    { id: "vagabond.assassin.2", techniqueId: "vagabond.assassin", level: 2, name: "Ликвидация", kind: "passive", automation: "decision", note: "При Атаке из Исчезновения сохраняемый план запросит клетку появления, в том числе смежную, добавит кости Ступени и критические успехи на 5–6; отмена не расходует действие." },
    { id: "vagabond.assassin.3", techniqueId: "vagabond.assassin", level: 3, name: "Скорость тьмы", kind: "combo", automation: "full", sequenceKeys: ["disappear", "step"], actionKey: "step", apCost: 0, selfEffect: "Невидим" },
    { id: "vagabond.speed-demon.2", techniqueId: "vagabond.speed-demon", level: 2, name: "Мгновенный шаг", kind: "combo", automation: "full", sequenceKeys: ["breathe", "step"], actionKey: "step", movementMultiplier: 3 },
    { id: "vagabond.enchained.1", techniqueId: "vagabond.enchained", level: 1, name: "Выстрел крюком", kind: "equidistant-teleport", automation: "full", range: 5 },
    { id: "vagabond.untouchable.1", techniqueId: "vagabond.untouchable", level: 1, name: "Нырок", kind: "passive", automation: "full", note: "Первый Уворот за Раунд автоматически получает дополнительное [Талант / 2] Уклонение." },
    { id: "vagabond.untouchable.2", techniqueId: "vagabond.untouchable", level: 2, name: "Маятник", kind: "passive", automation: "decision", note: "Уворот перемещает до 3 клеток; если итоговое Уклонение сводит урон к 0, стол предлагает отменяемое повторное перемещение до 3 клеток и пишет его в журнал." },
    { id: "vagabond.dim-mak.1", techniqueId: "vagabond.dim-mak", level: 1, name: "Изучить слабость", kind: "passive", automation: "decision", note: "Повторное и третье Изучение получают Быстроту по тексту уровня; после Изучения можно поставить привязанную к цели Слабую точку, а Атака с её клетки снимает маркер, становится Быстрой и использует Разум." },
    { id: "vagabond.dim-mak.2", techniqueId: "vagabond.dim-mak", level: 2, name: "Полевая разведка", kind: "passive", automation: "decision", note: "Промах вражеской Атаки предлагает бесплатное Быстрое Изучение атакующего; снятие Слабой точки автоматически даёт 2 Уклонения." },
    { id: "vagabond.master-at-arms.1", techniqueId: "vagabond.master-at-arms", level: 1, name: "Многогранность", kind: "armament", automation: "full", note: "Вооружение выбирается вместе со Стычкой; ядро проверяет дистанцию, число целей и повторное экипирование, хранит взаимоисключающий режим, затем ведёт перемещение, Эффекты и толчок. Каждое Вооружение ограничено одним разом за Ход." },
    { id: "vagabond.master-at-arms.2", techniqueId: "vagabond.master-at-arms", level: 2, name: "Как вода", kind: "passive", automation: "full", note: "Второе экипирование за Ход автоматически даёт 1 ОД и Ускорен." },
    { id: "vagabond.master-at-arms.3", techniqueId: "vagabond.master-at-arms", level: 3, name: "Мастер за работой", kind: "passive", automation: "partial", note: "Экипированное Вооружение сохраняется как состояние. Сложная геометрия Завершения пока остаётся под подтверждением Нарратора." },
    { id: "altruist.surgeon.1", techniqueId: "altruist.surgeon", level: 1, name: "Не навреди", kind: "surgery", automation: "full" },
    { id: "altruist.alchemist.1", techniqueId: "altruist.alchemist", level: 1, name: "Быстрая смесь", kind: "inventory", automation: "full" },
    { id: "altruist.alchemist.2", techniqueId: "altruist.alchemist", level: 2, name: "Мощная смесь", kind: "passive", automation: "full" },
    { id: "ruiner.creation-ascetic.1", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Формирование знаков", kind: "resource-replacement", automation: "full", note: "Метки творения заменяют Фокус; обычная Атака с Метками направляется к подходящей форме." },
    { id: "ruiner.creation-ascetic.1.nails", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Скрещенные гвозди", kind: "creation-attack", automation: "decision", actionKey: "spell", markBand: "low", form: "nails" },
    { id: "ruiner.creation-ascetic.1.mallet", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Невозможный молот", kind: "creation-attack", automation: "decision", actionKey: "spell", markBand: "high", form: "mallet" },
    { id: "ruiner.creation-ascetic.1.pile-arm", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Небесный копер", kind: "creation-attack", automation: "decision", actionKey: "finish", markBand: "low", form: "pile-arm", advantage: 2 },
    { id: "ruiner.creation-ascetic.1.idol", techniqueId: "ruiner.creation-ascetic", level: 1, name: "Живой идол", kind: "creation-attack", automation: "decision", actionKey: "finish", markBand: "high", form: "idol", advantage: 4 },
    { id: "ruiner.creation-ascetic.2", techniqueId: "ruiner.creation-ascetic", level: 2, name: "Один истинный мир", kind: "passive", automation: "full", note: "Передышка, Зарядка и получение Меток от повреждения или уничтожения местности автоматизированы." },
    { id: "ruiner.creation-ascetic.3", techniqueId: "ruiner.creation-ascetic", level: 3, name: "Труд благочестивых", kind: "passive", automation: "full", note: "Форма Завершения получает число Меток непосредственно предшествовавшего Заклинания." },
    { id: "ruiner.spellcrafter.1", techniqueId: "ruiner.spellcrafter", level: 1, name: "Эксперимент", kind: "modifier-choice", automation: "decision", note: "Игрок выбирает Модификацию; ядро не угадывает выбранный вариант." },
    { id: "ruiner.spellcrafter.2", techniqueId: "ruiner.spellcrafter", level: 2, name: "Закрепление", kind: "modifier-choice", automation: "decision", note: "Оплата Новаторства Фокусом требует выбора игрока." },
    { id: "ruiner.spellcrafter.3", techniqueId: "ruiner.spellcrafter", level: 3, name: "Финализация", kind: "modifier-choice", automation: "decision", note: "Можно выбрать две разные Модификации и оплатить обе." },
    { id: "ruiner.bombardier.1", techniqueId: "ruiner.bombardier", level: 1, name: "Взрыв!!", kind: "area", automation: "full", shape: "adjacent", areaType: "attack", duration: "instant", range: 4 },
    { id: "ruiner.bombardier.2", techniqueId: "ruiner.bombardier", level: 2, name: "Взрыв!!!", kind: "area", automation: "full", shape: "square3", areaType: "attack", duration: "instant", range: 5, optionMinimum: { key: "focusSpent", value: 2, label: "потрачено Фокуса" } },
    { id: "ruiner.bombardier.3", techniqueId: "ruiner.bombardier", level: 3, name: "ВЗРЫВ!!!!", kind: "area", automation: "full", shape: "square5", areaType: "attack", duration: "instant", range: 6, optionMinimum: { key: "focusSpent", value: 4, label: "потрачено Фокуса" }, note: "Зона, цели, трата Фокуса, Реакции и урон разрешаются общим конвейером зональной Атаки." },
    { id: "ruiner.rapid-fire-sorcery.2", techniqueId: "ruiner.rapid-fire-sorcery", level: 2, name: "Выжженная земля", kind: "area", automation: "full", shape: "cell", areaType: "difficult", duration: "scene", note: "Область трудной местности ставится выбором клетки и записывается в журнал." },
    { id: "ruiner.ritualist.1", techniqueId: "ruiner.ritualist", level: 1, name: "Лей-линии", kind: "marker", automation: "full", markerKind: "ritual", duration: "scene", color: "#6fc9d8", note: "Заклинательный круг ставится только в текущую клетку героя, убирая его прежние круги; применение идёт через общий конвейер маркеров." },
    { id: "ruiner.student-of-stars.2-line", techniqueId: "ruiner.student-of-stars", level: 2, name: "Бесформенная сила · линия", kind: "area", automation: "full", shape: "line", areaType: "attack", duration: "instant", note: "Зональная Атака по линии с общими Реакциями и уроном." },
    { id: "ruiner.student-of-stars.2-zone", techniqueId: "ruiner.student-of-stars", level: 2, name: "Бесформенная сила · зона 2×2", kind: "area", automation: "full", shape: "square2", areaType: "attack", duration: "instant", note: "Зональная Атака по зоне 2×2 с общими Реакциями и уроном." },
    { id: "ruiner.ego-arm.2", techniqueId: "ruiner.ego-arm", level: 2, name: "Покажи свои цели", kind: "marker", automation: "decision", markerKind: "damocles", duration: "scene", color: "#d04f64", note: "Маркер Дамокла ставится выбором цели за 2 ОД; выбор целей по врагам, атакованным носителем в его Ход, требует модели Трансформации Эго-оружия, которую ядро ещё не ведёт, поэтому цель подтверждает герой." },
    { id: "ruiner.sellsword-s-call.1", techniqueId: "ruiner.sellsword-s-call", level: 1, name: "Реприза воина", kind: "marker", automation: "decision", markerKind: "summon", duration: "scene", color: "#6fc9d8", note: "Точка призыва ставится только в пустую клетку за 1 Фокус, с выбором типа (Рейнджер/Палач/Гадюка) и лимитом [Ступень/2]; полноценный Призыв-участник остаётся следующим этапом ядра сущностей." },
    { id: "bulwark.servant-s-call.1", techniqueId: "bulwark.servant-s-call", level: 1, name: "Честь подчинённого", kind: "marker", automation: "partial", markerKind: "summon", duration: "scene", color: "#6fc9d8", note: "Точка призыва ставится в пустую клетку за 1 Фокус с выбором типа и лимитом [Ступень]; полноценный Призыв слуги остаётся следующим этапом ядра сущностей." },
    { id: "disruptor.wave-rider.1", techniqueId: "disruptor.wave-rider", level: 1, name: "Мягкие волны", kind: "marker", automation: "full", markerKind: "ritual", duration: "scene", color: "#3fa9d4", note: "Печать волны ставится только в пустую клетку с лимитом 4+Ступень своих печатей и записывается в журнал." },
    { id: "disruptor.hunter.1", techniqueId: "disruptor.hunter", level: 1, name: "Стальные челюсти", kind: "trap-placement", automation: "decision", markerKind: "trap", duration: "scene", color: "#c28a45" },
    { id: "disruptor.hunter.2", techniqueId: "disruptor.hunter", level: 2, name: "Дальняя установка", kind: "passive", automation: "full", note: "Дальность пустой Стычки и Обездвиживание цели ловушки учитываются автоматически." },
    { id: "disruptor.hunter.3", techniqueId: "disruptor.hunter", level: 3, name: "Яма-ловушка", kind: "area", automation: "full", shape: "square2", areaType: "terrain", duration: "scene", note: "Область ямы ставится выбором клетки и записывается в журнал." },
    { id: "disruptor.siren.1", techniqueId: "disruptor.siren", level: 1, name: "Ты ведь не причинишь МНЕ боль?", kind: "passive", automation: "decision", note: "После Изучения врага стол предлагает наложить Испуган, повторно проверяет цель и общий лимит 3 раза за Сцену и фиксирует применение отдельным событием." },
    { id: "disruptor.gale-strider.1", techniqueId: "disruptor.gale-strider", level: 1, name: "Растущие ветра", kind: "area", automation: "full", shape: "square3", areaType: "danger", duration: "scene", note: "Зона тайфуна ставится выбором клетки и записывается в журнал." },
    { id: "disruptor.chemist.1", techniqueId: "disruptor.chemist", level: 1, name: "Сублимация", kind: "area", automation: "full", shape: "square3", areaType: "gas", duration: "nextTurn" },
    { id: "disruptor.chemist.2", techniqueId: "disruptor.chemist", level: 2, name: "Экспериментальная смесь", kind: "passive", automation: "full" },
    { id: "disruptor.chemist.3", techniqueId: "disruptor.chemist", level: 3, name: "Осаждение", kind: "passive", automation: "full" },
    { id: "disruptor.inner-world.2", techniqueId: "disruptor.inner-world", level: 2, name: "Домен контроля", kind: "space", automation: "full", spaceName: "Внутренний мир", width: 3, height: 3, note: "Перенос выбранных участников в отдельное пространство 3×3 с возвратом на край поля при Ране или нокауте." },
    { id: "bulwark.giant-frame.1", techniqueId: "bulwark.giant-frame", level: 1, name: "Огромные руки", kind: "area", automation: "full", shape: "square2", areaType: "attack", duration: "instant", adjacency: true, optionMinimum: { key: "focusSpent", value: 1, label: "дополнительно потрачено Фокуса" }, note: "Зональная Атака 2×2 смежно с героем с общими Реакциями и уроном." },
    { id: "powerhouse.warring-ascendant.3", techniqueId: "powerhouse.warring-ascendant", level: 3, name: "Святой меч, Дюрандаль", kind: "area", automation: "full", shape: "line", areaType: "attack", duration: "instant", adjacency: true, note: "Зональная Атака бесконечной Линией с общими Реакциями и уроном." },
    { id: "powerhouse.breacher.1", techniqueId: "powerhouse.breacher", level: 1, name: "Картечь", kind: "passive", automation: "full", note: "Стычка получает дальность 4; каждая цель в пределах 2 после Успеха проходит обычные Реакции и затем отталкивается на 1 через общий post-hit displacement без добавочного урона." },
    { id: "powerhouse.warring-ascendant.1", techniqueId: "powerhouse.warring-ascendant", level: 1, name: "Небесная рука", kind: "passive", automation: "partial", note: "Зарядка при Напряжении 2+ предлагает однократную трансформацию; массовый толчок и окончание формы при 0 Здоровья автоматизированы. Выбор и временное предоставление трёх уровней оружейной Техники пока требуют отдельного профиля." },
    { id: "disruptor.siren.2", techniqueId: "disruptor.siren", level: 2, name: "Неотразимая", kind: "passive", automation: "decision", note: "Первое за Ход наложение Испуган открывает отменяемый выбор клетки: путь цели до 3 клеток проверяется пошагово на приближение к Сирене, а смежный итог отдельно предлагает наложить Ошеломлен." },
    { id: "powerhouse.spellsword.2", techniqueId: "powerhouse.spellsword", level: 2, name: "Два солнца", kind: "teleport", range: 3, timing: "beforeTargets" },
    { id: "ruiner.grim-ascendant.1", techniqueId: "ruiner.grim-ascendant", level: 1, name: "Непостоянная мощь", kind: "passive", automation: "decision", note: "После подходящей Зарядки стол предлагает трансформацию и полностью ведёт перенаправление Здоровья, Фокуса, толчок и завершение формы." },
    { id: "ruiner.grim-ascendant.2", techniqueId: "ruiner.grim-ascendant", level: 2, name: "Вытянуть жизнь", kind: "state-toggle", stateKey: "drainLife", automation: "decision", note: "Включите перед Завершением Духом: урон будет округлён вверх пополам, а Успех даст Регенерацию." },
    { id: "altruist.empath.1", techniqueId: "altruist.empath", level: 1, name: "Успокаивающая аура", kind: "passive", automation: "decision", note: "В начале Хода союзника стол предлагает снять один выбранный Эффект и наложить Усилен." },
    { id: "altruist.empath.2", techniqueId: "altruist.empath", level: 2, name: "Защитный отклик", kind: "passive", automation: "decision", note: "После внешней Раны или Эффекта стол предлагает бесплатный Прорыв в смежную клетку." },
    { id: "altruist.empath.3", techniqueId: "altruist.empath", level: 3, name: "Ты в порядке?", kind: "bond-support", automation: "decision", note: "В бою оплачивает Поддержку 3 Фокусом и 1 ОД; следующая проверка выбранного союзника игнорирует Помеху или получает Преимущество Ступени." },
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
    if (shape === "adjacent") return unique([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].flatMap(([dx, dy]) => {
      const point = { x: anchor.x + dx, y: anchor.y + dy };
      return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height ? [pointKey(point)] : [];
    }));
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
  const actionByKey = key => global.DAWN_SCENE_ENGINE?.actionByKey(global.DAWN_DATA, key) || null;
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
        const foundationPlan = global.DAWN_TECHNIQUE_FOUNDATION_MAP?.planForLevel?.({ id: `${technique.id}.${level.n}`, techniqueId: technique.id, level: Number(level.n), text: level.text, mechanics }) || { version: 0, status: "unmapped", reviewed: [], capabilities: [] };
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
          foundationPlan,
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
    else if (rule.foundation === "action-history") foundation = core.actionHistoryStatus(scene, actor.id, { scope: rule.scope, actionKeys: rule.actionKeys, targetIds: request.targetIds });
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
    if (rule.kind === "autophage-overexert") {
      const lastHit = (scene.log || []).find(event => event.type === "damage.apply" && event.actorId === actor.id && Number(event.payload?.dealt || 0) > 0 && event.payload?.targetId !== actor.id);
      const triggeringAction = lastHit && (scene.log || []).find(event => event.type === "action.resolve" && event.actorId === actor.id && event.payload?.actionId === lastHit.payload?.sourceActionId);
      const usedMutableFlesh = (scene.log || []).some(event => event.type === "technique.resolve" && event.actorId === actor.id && event.payload?.ruleId === "disruptor.autophage.3");
      const rolls = (Array.isArray(request.rolls) ? request.rolls : [request.roll]).map(Number).filter(Number.isInteger);
      const targetIds = rule.double ? (scene.actors || []).filter(target => !target.knockedOut && target.team !== actor.team && Number(target.hp || 0) > Number(actor.hp || 0)).map(target => target.id) : [...new Set(request.targetIds || (lastHit?.payload?.targetId ? [lastHit.payload.targetId] : []))];
      if (!lastHit) errors.push("«Перенапряжение» доступно только после успешной Атаки.");
      if (rule.double && (!triggeringAction || triggeringAction.payload?.name !== "Завершение" || !["body", "spirit"].includes(triggeringAction.payload?.attribute))) errors.push("«Рожденный изменчивой плотью» срабатывает только после успешного Завершения Телом или Духом.");
      if (rule.double && usedMutableFlesh) errors.push("«Рожденный изменчивой плотью» уже использован в этой Сцене.");
      if (rolls.length !== (rule.double ? 2 : 1) || rolls.some(value => value < 1 || value > 6)) errors.push(`Нужен ${rule.double ? "два результата d6" : "результат d6"} от 1 до 6.`);
      if (!targetIds.length) errors.push("Нет доступных целей «Перенапряжения».");
      if (errors.length) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors, warnings: [], commands: [], events: [], affectedCells: [], affectedActorIds: targetIds };
      const effectFor = value => value <= 2 ? "negative.порчен" : value <= 4 ? "negative.ошеломлен" : "negative.обездвижен";
      const events = [{ type: "technique.prepare", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, targetIds, participantIds: [actor.id, ...targetIds] } }];
      const overexertUses = rule.double ? 2 : 1;
      let projectedHealth = Number(actor.hp || 0);
      for (let use = 0; use < overexertUses; use += 1) if (projectedHealth > Number(actor.guts || 0)) {
        events.push({ type: "damage.apply", actorId: actor.id, payload: { targetId: actor.id, amount: 5, ignoreArmor: true, ignoreEvasion: true, sourceActionId: rule.id, overexertUse: use + 1, participantIds: [actor.id] } });
        projectedHealth = Math.max(0, projectedHealth - 5);
      }
      if (rule.double) targetIds.forEach(targetId => rolls.forEach(value => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId, effect: effectFor(value), sourceActionId: rule.id, participantIds: [actor.id, targetId] } })));
      else targetIds.forEach(targetId => events.push({ type: "effect.apply", actorId: actor.id, payload: { targetId, effect: effectFor(rolls[0]), sourceActionId: rule.id, participantIds: [actor.id, targetId] } }));
      events.push({ type: "technique.resolve", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, affectedActorIds: targetIds, participantIds: [actor.id, ...targetIds] } });
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events, summary: `${rule.name}: последствия подготовлены`, affectedCells: [], affectedActorIds: targetIds };
    }
    if (rule.kind === "combo") {
      const prepared = global.DAWN_SCENE_ENGINE?.prepareTechniqueCombo(scene, global.DAWN_DATA, { actorId: actor.id, ruleId: rule.id, targetIds: request.targetIds || [], destination: request.destination || null, roll: request.roll || null, attribute: request.attribute || request.roll?.attribute || null, attackModifierIds: request.attackModifierIds || [] });
      if (!prepared?.ok) return { ok: false, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: prepared?.errors || ["Ядро комбо недоступно."], warnings: [], commands: [], events: [], affectedCells: [], affectedActorIds: [] };
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events: prepared.events, summary: `«${rule.name}»: комбо готово`, affectedCells: request.destination ? [pointKey(request.destination)] : [], affectedActorIds: clone(request.targetIds || []) };
    }
    if (rule.kind === "bond-support") {
      const targetId=unique(request.targetIds||[])[0]||null,target=actorById(scene,targetId);
      if((request.targetIds||[]).length!==1||!target||target.id===actor.id||target.team!==actor.team)errors.push("Поддержка выбирает ровно одного союзника, но не самого Эмпата.");
      if(Number(actor.focus||0)<3)errors.push("Для Поддержки нужно 3 Фокуса.");
      if(Number(actor.ap||0)<1)errors.push("Для Поддержки нужен 1 ОД.");
      if(errors.length)return{ok:false,engineVersion:VERSION,actorId:actor.id,rule:publicRule(rule),request:clone(request),errors,warnings:[],commands:[],events:[],affectedCells:[],affectedActorIds:target?[target.id]:[]};
      const advantage=Number(target.tier||1),events=[{type:"technique.prepare",actorId:actor.id,payload:{ruleId:rule.id,name:rule.name,targetIds:[target.id],participantIds:[actor.id,target.id]}},{type:"resource.spend",actorId:actor.id,payload:{resource:"focus",amount:3,sourceActionId:rule.id,participantIds:[actor.id,target.id]}},{type:"resource.spend",actorId:actor.id,payload:{resource:"ap",amount:1,sourceActionId:rule.id,participantIds:[actor.id,target.id]}},{type:"actor.state",actorId:target.id,payload:{key:"empathSupport",value:advantage,sourceActionId:rule.id,participantIds:[actor.id,target.id]}},{type:"technique.resolve",actorId:actor.id,payload:{ruleId:rule.id,name:rule.name,affectedActorIds:[target.id],participantIds:[actor.id,target.id]}}];
      return{ok:true,engineVersion:VERSION,actorId:actor.id,rule:publicRule(rule),request:clone(request),errors:[],warnings:[],commands:[],events,summary:`${target.name} получает Поддержку на следующий бросок`,affectedCells:[],affectedActorIds:[target.id]};
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
      const actionMode = request.options?.actionMode === "finish" ? "finish" : "skirmish", action = actionByKey(actionMode), available = global.DAWN_SCENE_ENGINE?.availableActions(scene, global.DAWN_DATA, actor.id).find(item => item.id === action?.id);
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
      const action = actionByKey(rule.actionKey), available = global.DAWN_SCENE_ENGINE?.availableActions(scene, global.DAWN_DATA, actor.id).find(item => item.id === action?.id), lastAction = (scene.log || []).find(event => event.type === "action.prepare" && event.actorId === actor.id), inherited = rule.actionKey === "finish" && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 3 && global.DAWN_SCENE_ENGINE?.actionIdIs(lastAction?.payload?.actionId, "spell") ? Number(actor.ruleState?.lastCreationSpellMarks || 0) : 0, marks = Number(global.DAWN_SCENE_ENGINE?.ruleResourceStatus(scene, actor.id, { resource: "creation-marks" }).balance || 0), effectiveMarks = marks || inherited;
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
        if (selected.length !== 1 || !actorById(scene, selected[0]) || actorById(scene, selected[0]).team === actor.team || distance(actor, actorById(scene, selected[0])) !== 1) errors.push("Небесный копер выбирает одного смежного врага.");
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
      const cost = global.DAWN_SCENE_ENGINE?.actionCost(action) || { resource: "ap", amount: rule.actionKey === "finish" ? 2 : 1 }, baseDamage = Number(request.roll.successes || 0) + (rule.actionKey === "finish" ? Number(scene.tension || 0) : 0), chosenDistance = Number(request.options?.distance || 0), damageByTarget = Object.fromEntries(targetIds.map(id => [id, Math.max(0, baseDamage + (rule.form === "mallet" ? chosenDistance : 0))])), events = [
        { type: "technique.prepare", actorId: actor.id, payload: { ruleId: rule.id, name: rule.name, affectedCells: targetCells, targetIds, participantIds: [actor.id, ...targetIds], creationMarksSpent: effectiveMarks } },
        { type: "action.prepare", actorId: actor.id, payload: { actionId: action.id, actionName: action.name, name: rule.name, targetIds, quick: false, creationMarksSpent: effectiveMarks } },
      ];
      if (cost.resource && cost.amount) events.push({ type: "resource.spend", actorId: actor.id, payload: cost });
      if (marks) events.push({ type: "rule-resource.spend", actorId: actor.id, payload: { resource: "creation-marks", amount: marks, sourceActionId: rule.id } });
      if (rule.actionKey === "spell" && Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 3) events.push({ type: "actor.state", actorId: actor.id, payload: { key: "lastCreationSpellMarks", value: effectiveMarks, sourceActionId: "ruiner.creation-ascetic.3" } });
      if (rule.actionKey === "finish" && inherited) events.push({ type: "actor.state", actorId: actor.id, payload: { key: "lastCreationSpellMarks", value: 0, sourceActionId: "ruiner.creation-ascetic.3" } });
      targetIds.forEach(id => events.push({ type: "reaction.offer", actorId: id, payload: { sourceActorId: actor.id, actionId: rule.id, participantIds: [actor.id, id] } }));
      events.push({ type: "attack.pending", actorId: actor.id, payload: { actionId: action.id, techniqueRuleId: rule.id, techniqueName: rule.name, name: rule.name, targetIds, targetCells, allowEmptyTargets: ["nails", "idol"].includes(rule.form), roll: clone(request.roll), damage: Math.max(0, baseDamage), damageByTarget, attackModifierIds: clone(request.attackModifierIds || []), creationMarksSpent: effectiveMarks, postPush: rule.form === "pile-arm" ? { targetId: targetIds[0], maximum: 99, name: rule.name, ruleId: rule.id } : null, createTerrain: rule.form === "idol" ? { cells: targetCells, label: "Живой идол · высокая местность", ruleId: rule.id, hp: 10 } : null, participantIds: [actor.id, ...targetIds] } });
      if (request.roll?.rolls) events.push({ type: "roll.public", actorId: actor.id, payload: clone(request.roll) });
      return { ok: true, engineVersion: VERSION, actorId: actor.id, rule: publicRule(rule), request: clone(request), errors: [], warnings: [], commands: [], events, summary: `${rule.name}: Атака подготовлена`, affectedCells: targetCells, affectedActorIds: targetIds };
    }

    if (rule.kind === "equidistant-teleport") {
      const destination = request.destination && { x: integer(request.destination.x), y: integer(request.destination.y) };
      const creationMarks = Number(global.DAWN_SCENE_ENGINE?.ruleResourceStatus(scene, actor.id, { resource: "creation-marks" }).balance || 0);
      if (Number(actor.techniques?.["ruiner.creation-ascetic"] || 0) >= 1 && creationMarks > 0) errors.push("С Метками творения Заклинание должно использовать форму Аскета творения и потратить все Метки.");
      if (!inBounds(sourceSpace, anchor)) errors.push("Сначала выберите несмежную пустую клетку Заклинания.");
      if (anchor && manhattan(actor, anchor) <= 1) errors.push("Клетка Заклинания должна быть несмежной.");
      if (anchor && manhattan(actor, anchor) > Number(rule.range || 5)) errors.push(`Клетка Заклинания должна быть в пределах ${rule.range || 5} клеток.`);
      if (anchor && (scene.actors || []).some(item => item.space === actor.space && item.x === anchor.x && item.y === anchor.y)) errors.push("Целью должна быть пустая клетка.");
      if (!inBounds(sourceSpace, destination)) errors.push("Теперь выберите клетку приземления.");
      if (destination && (scene.actors || []).some(item => item.id !== actor.id && item.space === actor.space && item.x === destination.x && item.y === destination.y)) errors.push("Клетка приземления занята.");
      if (anchor && destination && manhattan(anchor, destination) !== manhattan(actor, anchor)) errors.push(`Приземление должно быть ровно в ${manhattan(actor, anchor)} клетках от цели Заклинания.`);
      const spell = actionByKey("spell");
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
    if (rule.id === "powerhouse.warring-ascendant.3" && !actor.ruleState?.warringTransformed) errors.push("«Святой меч, Дюрандаль» требует активной Трансформации Небесной руки.");
    if (rule.areaType === "attack") {
      const finish = actionByKey("finish"), available = global.DAWN_SCENE_ENGINE?.availableActions(scene, global.DAWN_DATA, actor.id).find(action => action.id === finish?.id), spent = Number(request.options?.focusSpent || 0);
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
      if (rule.kind === "marker") {
        const ownedOfKind = count => (scene.markers || []).filter(item => item.ownerActorId === actor.id && item.kind === count && item.duration === "scene").length;
        if (rule.id === "ruiner.ritualist.1" && anchor && (anchor.x !== Number(actor.x) || anchor.y !== Number(actor.y))) errors.push("Заклинательный круг ставится только в текущую клетку героя.");
        if (["ruiner.sellsword-s-call", "bulwark.servant-s-call"].some(key => rule.id.startsWith(key)) && anchor && (scene.actors || []).some(item => !item.knockedOut && item.space === actor.space && item.x === anchor.x && item.y === anchor.y)) errors.push("Точка призыва ставится только в пустую клетку.");
        if (rule.id === "ruiner.sellsword-s-call.1" && !["ranger", "hangman", "viper"].includes(request.options?.summonType)) errors.push("Выберите тип Призыва: Рейнджер, Палач или Гадюка.");
        if (rule.id === "bulwark.servant-s-call.1" && !["warden", "slime", "paladin"].includes(request.options?.summonType)) errors.push("Выберите тип Призыва: Страж, Слизень или Паладин.");
        const step = Number(actor.tier || 1);
        const ownOfRule = (kind, ruleId) => (scene.markers || []).filter(item => item.ownerActorId === actor.id && item.kind === kind && item.duration === "scene" && String(item.ruleId || item.source || "").startsWith(ruleId)).length;
        const summonLimit = rule.id === "ruiner.sellsword-s-call.1" ? Math.floor(step / 2) : rule.id === "bulwark.servant-s-call.1" ? step : Infinity;
        if (rule.id.endsWith("-call.1") && ownOfRule("summon", rule.id) >= summonLimit) errors.push(`Призывов уже максимально: ${summonLimit}.`);
        if (rule.id.endsWith("-call.1") && Number(actor.focus || 0) < 1) errors.push("Для точки призыва нужен 1 Фокус.");
        if (rule.id === "disruptor.wave-rider.1" && anchor && (scene.actors || []).some(item => item.space === actor.space && item.x === anchor.x && item.y === anchor.y)) errors.push("Печать волны ставится только в пустую клетку.");
        if (rule.id === "disruptor.wave-rider.1" && ownOfRule("ritual", "disruptor.wave-rider") >= 4 + step) errors.push(`Печатей волны уже максимально: ${4 + step}.`);
        if (rule.id === "ruiner.ego-arm.2" && Number(actor.ap || 0) < 2) errors.push("«Покажи свои цели» стоит 2 ОД.");
      }
    }

    if (rule.kind === "area" && !errors.length) {
      const modifiers = rule.areaType === "attack" ? [...new Set(actor.techniqueState?.spellModifiers || [])] : [], focused = modifiers.includes("focused"), wild = modifiers.includes("wild"), outstanding = modifiers.includes("outstanding");
      const effectiveShape = wild && rule.shape === "line" ? "square2" : rule.shape;
      affectedCells = focused && rule.shape !== "line" ? segmentLineCells({ anchor, width: sourceSpace.width, height: sourceSpace.height, orientation: request.orientation, length: 7 + (outstanding ? Number(actor.attrs?.mind || 0) : 0) }) : areaCells({ shape: effectiveShape, anchor, width: sourceSpace.width, height: sourceSpace.height, orientation: request.orientation });
      affectedActorIds = (scene.actors || []).filter(item => !item.knockedOut && item.space === actor.space && affectedCells.includes(pointKey(item)) && (rule.areaType !== "attack" || item.team !== actor.team)).map(item => item.id);
      if (rule.id === "disruptor.chemist.1") {
        const terrain = [...(scene.objects || [])].reverse().find(object => object.space === actor.space && CHEMIST_TERRAIN_TYPES.has(object.type) && (object.cells || []).includes(pointKey(anchor)));
        if (!terrain) errors.push("«Сублимация» должна выбирать существующий элемент местности.");
        else commands.push({ type: "remove_area", id: terrain.id, label: terrain.label });
      }
      if (rule.id === "disruptor.gale-strider.1") {
        (scene.objects || []).filter(object => object.space === actor.space && object.type === "danger" && object.ownerActorId === actor.id && /Тайфун|gale-strider/.test(`${object.label || ""} ${object.ruleId || object.source || ""}`)).forEach(object => commands.push({ type: "remove_area", id: object.id, label: object.label }));
      }
      const markerMetaFor = (rule.id === "disruptor.gale-strider.1" && affectedCells.length) ? { replaceOthers: true, shape: rule.shape, areaType: rule.areaType } : {};
      commands.push({ type: "create_area", space: actor.space, areaType: rule.areaType, label: rule.name, source: rule.id, ruleId: rule.id, duration: rule.duration, ownerActorId: actor.id, cells: affectedCells, metadata: { ...(rule.areaType === "attack" && modifiers.length ? { spellModifiers: modifiers } : {}), ...markerMetaFor } });
      commands.push({ type: "set_targets", actorIds: affectedActorIds });
      if (rule.areaType === "attack" && !request.roll) errors.push("Для зональной Атаки нужен бросок Завершения.");
    }

    if (rule.kind === "marker" && !errors.length) {
      affectedCells = [pointKey(anchor)];
      (scene.markers || []).filter(item => String(item.ruleId || item.source || "").startsWith(rule.id) && item.ownerActorId === actor.id && item.duration === "scene").forEach(item => commands.push({ type: "remove_marker", markerId: item.id, label: item.label }));
      if (rule.id.endsWith("-call.1")) {
        commands.push({ type: "create_marker", space: actor.space, x: anchor.x, y: anchor.y, markerKind: rule.markerKind, label: `${rule.name} · ${request.options?.summonType || ""}`, color: rule.color, source: rule.id, ruleId: rule.id, duration: rule.duration, ownerActorId: actor.id, metadata: { summonType: request.options?.summonType } });
        commands.push({ type: "spend_focus", actorId: actor.id, amount: 1 });
      } else if (rule.id === "ruiner.ego-arm.2") {
        commands.push({ type: "create_marker", space: actor.space, x: anchor.x, y: anchor.y, markerKind: rule.markerKind, label: rule.name, color: rule.color, source: rule.id, ruleId: rule.id, duration: rule.duration, ownerActorId: actor.id, metadata: { targetActorId: Array.isArray(request.targetIds) ? request.targetIds[0] : null } });
        commands.push({ type: "spend_ap", actorId: actor.id, amount: 2 });
      } else {
        commands.push({ type: "create_marker", space: actor.space, x: anchor.x, y: anchor.y, markerKind: rule.markerKind, label: rule.name, color: rule.color, source: rule.id, ruleId: rule.id, duration: rule.duration, ownerActorId: actor.id });
      }
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
      const selectedTargetIds = unique(Array.isArray(request.targetIds) ? request.targetIds : []).filter(id => actorById(scene, id) && id !== actor.id);
      const targetIds = [actor.id, ...selectedTargetIds];
      const maximumUses = Number(actor.techniques?.["disruptor.inner-world"] || 0) >= 3 ? Math.max(1, Number(actor.attrs?.spirit || 1)) : 1;
      const limit = global.DAWN_SCENE_ENGINE?.usageLimitStatus?.(scene, actor.id, { ruleId: rule.id, scope: "scene", maximum: maximumUses });
      if (limit && !limit.available) errors.push(limit.reason);
      if (selectedTargetIds.length > 1) errors.push("Домен контроля переносит только одного выбранного персонажа за применение.");
      if (!selectedTargetIds.length) errors.push("Выберите хотя бы одного персонажа, которого нужно перенести во Внутренний мир.");
      if (!errors.length) {
        commands.push({ type: "ensure_space", ref: rule.id, name: rule.spaceName, width: rule.width, height: rule.height });
        commands.push({ type: "move_to_space", actorIds: targetIds, spaceRef: rule.id });
        commands.push({ type: "set_targets", actorIds: targetIds.filter(id => id !== actor.id) });
        affectedActorIds = targetIds;
      }
    }

    const summary = errors.length ? `«${rule.name}»: требуется уточнение` : `«${rule.name}»: ${commands.length} команд готово к применению`;
    return { ok: errors.length === 0, engineVersion: VERSION, actorId: actor?.id || null, rule: publicRule(rule), request: { anchor: request.anchor || null, destination: request.destination || null, targetIds: clone(request.targetIds || []), attackModifierIds: clone(request.attackModifierIds || []), orientation: request.orientation || "horizontal", options: clone(request.options || {}), roll: clone(request.roll || null) }, errors, warnings, summary, commands, affectedCells, affectedActorIds };
  }

  function toEvents(scene, prepared, options = {}) {
    if (!prepared?.ok) throw new Error("Нельзя создать события Техники с ошибками предпросмотра.");
    if (Array.isArray(prepared.events)) return clone(prepared.events);
    const makeId = typeof options.makeId === "function" ? options.makeId : idFactory;
    const actorId = prepared.actorId || prepared.commands.find(command => command.actorId)?.actorId || prepared.commands.find(command => command.ownerActorId)?.ownerActorId || null;
    const events = [{ type: "technique.prepare", actorId, payload: { ruleId: prepared.rule.id, name: prepared.rule.name, request: clone(prepared.request || {}) } }];
    const references = {};
    if (prepared.rule.areaType === "attack") {
      const actor = actorById(scene, actorId), finish = actionByKey("finish"), targetIds = clone(prepared.affectedActorIds || []), roll = clone(prepared.request?.roll || null), focusSpent = Number(prepared.request?.options?.focusSpent || 0), modifiers = [...new Set(actor?.techniqueState?.spellModifiers || [])], modifierResource = Number(actor?.techniques?.["ruiner.spellcrafter"] || 0) >= 2 ? "focus" : "innovationCharges";
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
      const terrainAnchor = prepared.request?.anchor && [...(scene.objects || [])].reverse().find(object => object.space === actor?.space && CHEMIST_TERRAIN_TYPES.has(object.type) && (object.cells || []).includes(pointKey(prepared.request.anchor)));
      events.push({ type: "attack.pending", actorId, payload: { actionId: finish.id, techniqueRuleId: prepared.rule.id, techniqueName: prepared.rule.name, name: prepared.rule.name, targetIds, roll, damage: Number(roll?.successes || 0) + Number(scene.tension || 0) + (modifiers.includes("fierce") ? Number(actor?.attrs?.mind || 0) : 0), spellModifiers: modifiers, attackModifierIds: clone(prepared.request?.attackModifierIds || []), techniqueAnchor: clone(prepared.request?.anchor || null), targetsTerrainCell: Boolean(prepared.request?.anchor), targetedTerrainId: terrainAnchor?.id || null, participantIds: [actorId, ...targetIds] } });
      if (roll?.rolls) events.push({ type: "roll.public", actorId, payload: clone(roll) });
      return events;
    }
    if (prepared.rule.optionMinimum?.key === "focusSpent") events.push({ type: "resource.spend", actorId, payload: { resource: "focus", amount: Number(prepared.request?.options?.focusSpent || 0) } });
    for (const command of prepared.commands) {
      if (command.type === "create_area") events.push({ type: "area.create", actorId, payload: { ...clone(command), id: makeId("area") } });
      else if (command.type === "create_marker") events.push({ type: "marker.create", actorId, payload: { ...clone(command), id: makeId("marker") } });
      else if (command.type === "remove_marker") events.push({ type: "marker.remove", actorId, payload: { markerId: command.markerId, label: command.label, sourceActionId: prepared.rule.id } });
      else if (command.type === "remove_area") events.push({ type: "area.remove", actorId, payload: { id: command.id, label: command.label, sourceActionId: prepared.rule.id } });
      else if (command.type === "spend_focus") events.push({ type: "resource.spend", actorId, payload: { resource: "focus", amount: command.amount, sourceActionId: prepared.rule.id } });
      else if (command.type === "spend_ap") events.push({ type: "resource.spend", actorId, payload: { resource: "ap", amount: command.amount, sourceActionId: prepared.rule.id } });
      else if (command.type === "set_targets") events.push({ type: "targets.set", actorId, payload: { actorIds: clone(command.actorIds) } });
      else if (command.type === "move_actor") {
        events.push({ type: "actor.move", actorId: command.actorId, payload: { space: command.space, x: command.x, y: command.y, movement: command.movement } });
        events.push({ type: "actor.enter", actorId: command.actorId, payload: { space: command.space, x: command.x, y: command.y } });
      } else if (command.type === "ensure_space") {
        const existing = (scene.spaces || []).find(space => space.name === command.name);
        references[command.ref] = existing?.id || makeId("space");
        events.push({ type: "space.ensure", actorId, payload: { id: references[command.ref], name: command.name, width: command.width, height: command.height, activate: true, sourceActionId: prepared.rule.id, ruleId: prepared.rule.id } });
      } else if (command.type === "move_to_space") {
        const spaceId = references[command.spaceRef],spaceEvent=events.find(event => event.type === "space.ensure" && event.payload.id === spaceId),space=(scene.spaces || []).find(item => item.id === spaceId) || spaceEvent?.payload;
        command.actorIds.forEach((movingId,index) => {events.push({ type: "actor.move", actorId: movingId, payload: { space: spaceId, x: index % space.width, y: Math.floor(index / space.width) % space.height, movement: "technique", sourceActionId: prepared.rule.id, ruleId: prepared.rule.id } });events.push({ type: "actor.enter", actorId: movingId, payload: { space: spaceId, x: index % space.width, y: Math.floor(index / space.width) % space.height, sourceActionId: prepared.rule.id, ruleId: prepared.rule.id } })});
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
    } else if (command.type === "remove_marker") {
      scene.markers = (scene.markers || []).filter(item => item.id !== command.markerId);
    } else if (command.type === "spend_focus") {
      const actor = actorById(scene, command.actorId);
      if (actor) actor.focus = Math.max(0, Number(actor.focus || 0) - Number(command.amount || 0));
    } else if (command.type === "spend_ap") {
      const actor = actorById(scene, command.actorId);
      if (actor) actor.ap = Math.max(0, Number(actor.ap || 0) - Number(command.amount || 0));
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
