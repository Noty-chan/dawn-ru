# Карта требований автоматизации Техник

> Генерируется командой `npm run map`. Не редактируйте таблицы вручную:
> классификация, реестр ручной сверки и точные исключения находятся в `technique-foundation-map.js`.

Покрыто Уровней: **321**. Ручная сверка текста завершена: **321**. Непроверенные строки остаются кандидатами и не являются утверждением о полной автоматизации.

Ревизия источника ручной сверки: `d41acc9`.
SHA-256 проверенных файлов: `c849b19c102e1f517dca9ada21931e74b5c791645703790dcea998fa7871485b`.

## Легенда возможностей

| id | Назначение | Состояние | Модуль | Проверенных Уровней |
| --- | --- | --- | --- | ---: |
| `event-participants` | Участники события | готово | `scene-engine-core.js` | 202 |
| `event-preview` | Предпросмотр цепочки | готово | `scene-triggers.js` | 0 |
| `spatial-cells` | Персонажи в клетках и областях | готово | `scene-query.js` | 29 |
| `spatial-range` | Персонажи в дальности | готово | `scene-query.js` | 44 |
| `spatial-topology` | Удалённые клетки и разрывы поля | готово | `scene-engine-core.js / scene-events.js / scene-movement.js` | 1 |
| `target-validation` | Проверка целей | готово | `scene-query.js` | 202 |
| `resource-check` | Проверка ресурсов | готово | `scene-query.js` | 108 |
| `effect-state` | Чтение состояния Эффекта | готово | `scene-query.js` | 129 |
| `event-summary` | Сводка цепочки | готово | `scene-query.js` | 0 |
| `rule-clock` | Часы правила | готово | `scene-foundations.js` | 19 |
| `alternate-resource` | Альтернативный ресурс | готово | `scene-foundations.js` | 17 |
| `stance` | Стойки | готово | `scene-foundations.js` | 6 |
| `owned-entities` | Принадлежащие сущности | готово | `scene-foundations.js` | 63 |
| `action-history` | История действий | готово | `scene-foundations.js` | 36 |
| `terrain` | Местность | готово | `scene-foundations.js` | 33 |
| `usage-limits` | Лимиты использования | готово | `scene-foundations.js` | 77 |
| `trigger-router` | Маршрутизация триггеров | готово | `scene-triggers.js / scene-events.js` | 293 |
| `reaction-window` | Окна Реакций и вмешательств | готово | `scene-responses.js / scene-events.js` | 40 |
| `turn-lifecycle` | Жизненный цикл Хода и Раунда | планируется | — | 80 |
| `scene-lifecycle` | Начало, конец и сброс Сцены | планируется | — | 40 |
| `movement-lifecycle` | Жизненный цикл движения | планируется | — | 118 |
| `choice-flow` | Типизированное решение | готово | `scene-responses.js / scene-events.js / scene-effects.js` | 144 |
| `damage-pipeline` | Конвейер урона, Здоровья и Ран | готово | `scene-responses.js / scene-events.js` | 106 |
| `action-modifier` | Модификатор или новое действие | готово | `scene-actions.js / scene-responses.js` | 244 |
| `effect-lifecycle` | Наложение, снятие и срок Эффекта | планируется | — | 129 |
| `entity-lifecycle` | Жизненный цикл зон, маркеров и объектов | планируется | — | 63 |
| `inventory` | Инвентарь и заряды | планируется | — | 24 |
| `summon-turns` | Призывы и делегированные Ходы | планируется | — | 11 |
| `dice-hooks` | Модификаторы и повтор броска | планируется | — | 73 |
| `duration-scheduler` | Сроки действия и отложенные эффекты | планируется | — | 16 |
| `deployment-hooks` | Развертывание | планируется | — | 6 |
| `intermission-reset` | Сброс на Интермиссии | планируется | — | 3 |
| `bond-actions` | Связи и действия Связей | планируется | — | 6 |
| `derived-stats` | Производные характеристики персонажа | планируется | — | 47 |
| `information-query` | Изучение и раскрытие информации | планируется | — | 13 |
| `transformation` | Трансформации и заимствованные правила | планируется | — | 11 |
| `duel-flow` | Дуэли и ставки | планируется | — | 5 |
| `combat-meter` | Напряжение и общие счетчики боя | планируется | — | 18 |
| `action-copy` | Заимствование Атак и Техник | планируется | — | 10 |
| `multi-space-actor` | Размер и несколько клеток персонажа | планируется | — | 6 |
| `manual-ruling` | Ручное решение Нарратора | ручное | — | 0 |

## Как читать карту

- `проверено` означает, что полный текст Уровня вручную сверен и перечисленные семейства возможностей подтверждены.
- `кандидат` означает автоматическую первичную классификацию по индексу механик и тексту; её обязан проверить разработчик.
- Колонка `Адаптер` показывает текущую честную степень автоматизации движка.
- Проверенная разметка не повышает степень автоматизации: она описывает требования к будущему адаптеру.
- Несколько возможностей у одного Уровня — нормальный случай: тонкий адаптер должен компоновать общее ядро.

## Все Техники

## Силач

### Берсерк (`powerhouse.berserker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Месть (Revenge) | проверено | частичная | `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `derived-stats`, `combat-meter` |
| 2 | Выдержать побои (Take A Beating) | проверено | частичная | `trigger-router`, `damage-pipeline`, `derived-stats` |
| 3 | Загнанный пес (Cornered Dog) | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |

### Драконоборец (`powerhouse.dragonslayer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Скорость - это вес (Speed Is Weight) | проверено | полная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Широкая дуга (Wide Arc) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Титанический замах (Titanic Heave) [Передышка -> Завершение Телом] | проверено | полная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |

### Дуэлянт (`powerhouse.duelist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ответный выпад (Riposte) [Блок -> Стычка] | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Парирование (Parry) | проверено | полная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 3 | Отбивающий удар (Deflecting Blow) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `reaction-window`, `action-modifier` |

### Самобичеватель (`powerhouse.flagellant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Азарт (Thrill) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow` |
| 2 | Кровавый рывок (Blood Rush) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks` |
| 3 | Обескровлен (Bled Dry) | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline` |

### Стрелок (`powerhouse.gunslinger`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Большой ствол (Big Iron) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 2 | Зарядить и взвести (Lock And Load) | проверено | с выбором | `resource-check`, `alternate-resource`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks` |
| 3 | Жонглирование пулями (Bullet Juggle) | проверено | полная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |

### Борец (`powerhouse.struggler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Усилие (Effort) | проверено | ручная | `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `dice-hooks`, `derived-stats` |
| 2 | Адреналин (Adrenaline) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |
| 3 | Вопреки разуму (Defy Reason) | проверено | ручная | `trigger-router`, `action-modifier`, `dice-hooks` |

### Магический мечник (`powerhouse.spellsword`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Чародейский клинок (Spell Blade) | проверено | частичная | `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `action-copy` |
| 2 | Два солнца (Twin Suns) [Заклинание -> Стычка] | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier`, `action-history` |
| 3 | Охотник на ведьм (Witch Hunter) [Заклинание -> Завершение Телом/Талантом] | проверено | полная | `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history` |

### Техник (`powerhouse.technician`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Разминка (Stretch) | проверено | частичная | `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `derived-stats` |
| 2 | Идеальная форма (Perfect Form) | проверено | ручная | `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `derived-stats` |
| 3 | Последний удар (Final Blow) [Стычка -> Завершение] | проверено | полная | `resource-check`, `action-modifier`, `action-history`, `derived-stats` |

### Несломленный (`powerhouse.unbroken`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Встать снова (Get Back Up) | проверено | частичная | `resource-check`, `usage-limits`, `scene-lifecycle`, `choice-flow`, `duration-scheduler`, `duel-flow` |
| 2 | Яростное возрождение (Furious Revival) | проверено | частичная | `resource-check`, `trigger-router`, `action-modifier` |
| 3 | Феникс (Phoenix) | проверено | частичная | `resource-check`, `trigger-router`, `damage-pipeline`, `duel-flow` |

### Хвастун (`powerhouse.braggart`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Гордыня (Hubris) | проверено | частичная | `rule-clock`, `trigger-router`, `reaction-window`, `scene-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Докажи, чего стоишь (Prove Yourself) | проверено | с выбором | `rule-clock`, `usage-limits`, `trigger-router`, `choice-flow`, `dice-hooks` |
| 3 | Достойный противник (A Worthy Opponent) | проверено | с выбором | `rule-clock`, `trigger-router`, `damage-pipeline` |

### Картечник (`powerhouse.breacher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Картечь (Buck Shot) | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Из обоих стволов (Both Barrels) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Уничтожение (Annihilate) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `action-modifier` |

### Боец с парным оружием (`powerhouse.dual-wielder`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Парный удар (Twinned Blow) | проверено | частичная | `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Неистовый обстрел (Frenzied Barrage) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Разные клинки (Varied Blades) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `action-history` |

### Мастер боевых искусств (`powerhouse.martial-artist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Искусство восьми молотов (Art Of The 8 Hammers) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Состояние потока (Flow-State) | проверено | частичная | `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `derived-stats` |
| 3 | Бесконечные удары (Unlimited Blows) | проверено | ручная | `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Мудрец монастыря (`powerhouse.monastic-sage`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Разум воплощенный (Mind Made Manifest) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 2 | Меж двух миров (Of Two Worlds) | проверено | частичная | `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `inventory` |
| 3 | Возвышенная невозмутимость (Sublime Equanimity) | проверено | ручная | `resource-check`, `trigger-router`, `turn-lifecycle`, `choice-flow` |

### Копейщик (`powerhouse.lancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пронзание (Pierce) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `action-modifier`, `dice-hooks` |
| 2 | Фаланга (Phalanx) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `damage-pipeline`, `action-modifier` |
| 3 | Рука-пушка (Cannon-Arm) [Передышка -> Стычка] | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Хищник (`powerhouse.predator`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Тоска (Yearn) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `information-query` |
| 2 | Одержимость (Obsess) | проверено | ручная | `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline`, `derived-stats`, `information-query` |
| 3 | Пожрать (Devour) | проверено | частичная | `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier` |

### Импровизатор (`powerhouse.improvisational-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Все - инструмент (Everything's A Tool) | проверено | частичная | `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `derived-stats` |
| 2 | Ох! Вот это было больно! (Oh! That One Hurt!) | проверено | частичная | `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks` |
| 3 | Последнее средство (Last Resort) | проверено | ручная | `terrain`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `dice-hooks`, `combat-meter` |

### Воинственный Вознесенный (`powerhouse.warring-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Небесная рука (Heavenly Arm) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation`, `combat-meter`, `action-copy` |
| 2 | Эзотерические клинки (Esoteric Blades) | проверено | ручная | `trigger-router`, `choice-flow`, `transformation`, `action-copy` |
| 3 | Святой меч, Дюрандаль (Saintly Sword, Durandal) | проверено | частичная | `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation` |

## Бродяга

### Воздушный мастер (`vagabond.aerial-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Над и вокруг (Over And Around) | проверено | частичная | `effect-state`, `effect-lifecycle`, `stance`, `terrain`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Парение (Soar) | проверено | частичная | `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Падающий удар топором (Falling Ax Strike) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `stance`, `trigger-router`, `action-modifier`, `dice-hooks`, `derived-stats` |

### Ассасин (`vagabond.assassin`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Засада (Ambush) | проверено | полная | `usage-limits`, `trigger-router`, `action-modifier`, `deployment-hooks` |
| 2 | Ликвидация (Assassinate) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Скорость тьмы (Speed of Dark) [Скрыться -> Шаг] | проверено | полная | `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `action-modifier`, `action-history` |

### Снайпер (`vagabond.sniper`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Дальний выстрел (Long Shot) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `action-modifier` |
| 2 | Окопаться (Bunker Down) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`, `spatial-range` |
| 3 | Меткий глаз (Deadeye) [Скрыться -> Завершение Талантом] | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |

### Застрельщик (`vagabond.skirmisher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Укол (Sting) | проверено | частичная | `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Смещающиеся удары (Shifting Blows) | проверено | частичная | `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Отскок (Rebound) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Демон скорости (`vagabond.speed-demon`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Уход в тень (Fade) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle` |
| 2 | Мгновенный шаг (Flash Step) [Передышка -> Шаг] | проверено | полная | `movement-lifecycle`, `action-modifier`, `action-history` |
| 3 | Мгновенный удар (Flash Strike) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |

### Неуловимый (`vagabond.untouchable`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Нырок (Duck) | проверено | полная | `usage-limits`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 2 | Маятник (Weave) | проверено | с выбором | `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `derived-stats` |
| 3 | Инстинкт бойца (Fighter's Instinct) [Уворот -> Стычка] | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |

### Акробат (`vagabond.acrobat`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Летящий удар ногой (Flying Kick) [Прыжок -> Стычка] | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Отскок от стены (Wall Jump) | проверено | частичная | `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 3 | Невесомое тело (Weightless Body) | проверено | частичная | `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `action-modifier` |

### Мастер клинка (`vagabond.blade-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стойка выхвата (Draw Stance) | проверено | частичная | `stance`, `trigger-router`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Рассечение одним движением (Divide In One Motion) [Передышка -> Прыжок] | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `stance`, `trigger-router`, `action-modifier`, `action-history` |
| 3 | Прыгающий карп (Leaping Koi) | проверено | частичная | `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |

### Хитроумный боец (`vagabond.cunning-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | План и исполнение (Plan and Execute) | проверено | с выбором | `target-validation`, `event-participants`, `rule-clock`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `action-modifier`, `information-query` |
| 2 | Планы внутри планов (Plans Within Plans) | проверено | полная | `usage-limits`, `turn-lifecycle`, `action-modifier` |
| 3 | С первого взгляда (At a Glance) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `information-query` |

### Эгоманьяк (`vagabond.egomaniac`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пиковая форма (Peak Condition) | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Дразнить, красоваться, устрашать (Taunt, Flaunt, Daunt) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `rule-clock`, `trigger-router`, `choice-flow`, `effect-state`, `effect-lifecycle`, `derived-stats` |
| 3 | Финал (Finale) | проверено | с выбором | `rule-clock`, `trigger-router`, `choice-flow`, `scene-lifecycle`, `action-modifier`, `combat-meter` |

### Скованный (`vagabond.enchained`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Выстрел крюком (Hook Shot) | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Притянуть (Draw In) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 3 | Импульс (Momentum) [Заклинание -> Стычка] | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |

### Жонглер ножами (`vagabond.knife-juggler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Метнуть (Throw) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Пополнение (Resupply) | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Преследователь (Chaser) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |

### Злобный подражатель (`vagabond.malicious-mimic`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "Все, что можешь ты..." ("Anything You Can Do...") | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `inventory`, `action-copy` |
| 2 | Отрепетированные движения (Rehearsed Movements) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `derived-stats`, `inventory` |
| 3 | "...я могу лучше" ("...I Can Do Better") | проверено | частичная | `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `inventory`, `action-copy` |

### Модифицированный мейстер (`vagabond.modified-meister`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | На горячем ходу (Running Hot) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `damage-pipeline`, `trigger-router`, `scene-lifecycle`, `action-modifier` |
| 2 | Перегрузка (Overload) | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Разгон (Overclock) | проверено | с выбором | `resource-check`, `alternate-resource`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter` |

### Оппортунист (`vagabond.opportunist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стайная тактика (Pack Tactics) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `action-modifier` |
| 2 | Голодные глаза (Hungry Eyes) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window` |
| 3 | Комбо-подброс (Launcher Combo) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `action-modifier` |

### Отражатель (`vagabond.reflector`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Поймать клинок (Catch The Blade) | проверено | ручная | `trigger-router`, `reaction-window`, `scene-lifecycle`, `damage-pipeline`, `choice-flow`, `derived-stats` |
| 2 | Смотреть и ждать (Watch And Wait) | проверено | частичная | `trigger-router`, `reaction-window`, `damage-pipeline`, `dice-hooks` |
| 3 | Нести их ярость (To Carry Their Fury) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats` |

### Дим Мак (`vagabond.dim-mak`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Изучить слабость (Study Weakness) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `information-query` |
| 2 | Полевая разведка (Field Investigation) | проверено | ручная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `information-query`, `derived-stats` |
| 3 | Казнь по четырем точкам (4-Point Execution) | проверено | частичная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `action-history` |

### Пьяница (`vagabond.drunkard`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | До дна (Down The Hatch) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `deployment-hooks`, `dice-hooks` |
| 2 | Танец дурака (Fool's Dance) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 3 | Залпом (Chug) | проверено | частичная | `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier` |

### Мастер оружия (`vagabond.master-at-arms`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Многогранность (Multi-Faceted) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Как вода (Like Water) | проверено | частичная | `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 3 | Мастер за работой (Master At Work) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

## Оплот

### Сокрушитель (`bulwark.crusher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | 30 000 тонн (30,000 Tons) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Молотопад (Hammerfall) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history` |
| 3 | Ты похож на гвоздь (You Look Like A Nail) | проверено | ручная | `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history` |

### Гигантская фигура (`bulwark.giant-frame`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Огромные руки (Big Arms) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Исполин (Immense) | проверено | частичная | `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `deployment-hooks`, `derived-stats`, `multi-space-actor` |
| 3 | Ударная волна (Shockwave) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Железное тело (`bulwark.iron-bodied`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Крепкий как камень (Tough As Stone) | проверено | ручная | `movement-lifecycle`, `derived-stats` |
| 2 | Выносливость (Resilience) | проверено | полная | `derived-stats` |
| 3 | Нержавеющий шаг (Stainless Stride) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `derived-stats` |

### Щит авангарда (`bulwark.vanguard-defender`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Белый рыцарь (White Knight) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier` |
| 2 | Стальной ангел (Steel Angel) | проверено | частичная | `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `derived-stats` |
| 3 | Вдохновить мужество (Inspire Courage) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow` |

### Полный ублюдок (`bulwark.absolute-bastard`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Легко ненавидеть (Easy To Hate) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `information-query` |
| 2 | Задира (Bully) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `derived-stats` |
| 3 | Добавить травму к оскорблению (Add Injury To Insult) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Боевой наездник (`bulwark.battle-jockey`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Верный скакун (Trusty Steed) | проверено | ручная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `deployment-hooks` |
| 2 | Хваткие челюсти (Grasping Jaws) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `summon-turns` |
| 3 | Ревущий выход (Roaring Entry) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `turn-lifecycle` |

### Борец-захватчик (`bulwark.grappler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Удержание (Restrain) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Перелом позвоночника (Spine Breaker) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Завершающий прием (Finishing Move) [Завершение Телом -> Прыжок] | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history` |

### Джаггернаут (`bulwark.juggernaut`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Дикий рывок (Wild Charge) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Насилие (Violence) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline` |
| 3 | Резкий поворот (Hard Turn) | проверено | частичная | `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |

### Обычный (`bulwark.mundane`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Чего не хватает Духу (For What The Spirit Lacks) | проверено | частичная | `resource-check`, `alternate-resource`, `turn-lifecycle`, `action-modifier`, `derived-stats` |
| 2 | Копнуть глубже, стоять твердо (Dig Deep, Stand Firm) | проверено | полная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `trigger-router`, `reaction-window` |
| 3 | Перед лицом Запредельного (In The Face Of The Beyond) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Восходящий претендент (`bulwark.rising-challenger`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Идеальное отражение (Perfect Deflection) | проверено | частичная | `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 2 | "Сначала тебе придется пройти через меня!" ("You'll Have To Get Through Me!") | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 3 | Драма и злость (Drama And Spite) | проверено | полная | `dice-hooks`, `action-modifier` |

### Рунное возмездие (`bulwark.runic-retribution`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Удар плетью (Lash) | проверено | частичная | `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier` |
| 2 | Любящий обряд (Loving Rite) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `information-query` |
| 3 | Преданность (Devotion) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `duration-scheduler`, `choice-flow`, `action-modifier` |

### Щитоносец (`bulwark.shield-bearer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стена (Wall) | проверено | частичная | `resource-check`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `derived-stats` |
| 2 | Удар щитом (Shield Charge) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | Сосредоточенная защита (Focused Defense) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `derived-stats` |

### Стойкий часовой (`bulwark.stalwart-sentry`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Страж (Guardian) | проверено | ручная | `movement-lifecycle`, `trigger-router`, `turn-lifecycle` |
| 2 | На посту (On Watch) | проверено | с выбором | `resource-check`, `rule-clock`, `trigger-router`, `action-modifier` |
| 3 | Зона контроля (Zone Of Influence) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `information-query` |

### Звериный Вознесенный (`bulwark.beastial-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Звериность (Beastly) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation`, `combat-meter`, `action-copy` |
| 2 | Наследие (Inheritance) | проверено | частичная | `trigger-router`, `choice-flow`, `damage-pipeline`, `transformation`, `action-copy` |
| 3 | Вершина (Apex) | проверено | частичная | `resource-check`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `transformation`, `action-copy` |

### Ангел-хранитель (`bulwark.guardian-angel`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Два тела (Two Bodies) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `damage-pipeline`, `action-modifier`, `multi-space-actor` |
| 2 | Вместе в жизни (Together In Life) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `action-history` |
| 3 | Вместе в смерти (Together In Death) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier`, `derived-stats`, `multi-space-actor` |

### Зов слуги (`bulwark.servant-s-call`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Честь подчиненного (A Subordinate's Honor) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Гимн героя (Hero's Hymn) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `action-modifier` |
| 3 | Верховный слуга (Supreme Servant) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `bond-actions` |

### Пилот меха (`bulwark.mecha-pilot`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Двигатель рунного ядра (Rune Core Engine) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`, `multi-space-actor` |
| 2 | Автономный (Autonomous) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`, `multi-space-actor` |
| 3 | Идеальная синхронизация (Perfect Sync) | проверено | частичная | `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `choice-flow`, `action-modifier`, `derived-stats`, `multi-space-actor` |

## Альтруист

### Боевой инструктор (`altruist.battle-instructor`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Приказ к удару (Strike Order) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `information-query` |
| 2 | Обучающий момент (Teaching Moment) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `trigger-router`, `reaction-window`, `choice-flow`, `dice-hooks` |
| 3 | Вспомни обучение (Remember Your Training) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier` |

### Эмпат (`altruist.empath`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Успокаивающая аура (Calming Aura) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow` |
| 2 | Защитный отклик (Protective Response) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier` |
| 3 | "Ты в порядке?" ("Are You Ok?") | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `action-modifier` |

### Гурман (`altruist.gourmand`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Здоровая трапеза (Healthy Meal) | проверено | частичная | `target-validation`, `event-participants`, `damage-pipeline`, `inventory`, `trigger-router`, `intermission-reset`, `choice-flow`, `action-modifier` |
| 2 | Бездонная кладовая (Bottomless Pantry) | проверено | полная | `inventory`, `intermission-reset` |
| 3 | Общий опыт (Shared Experiences) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `inventory`, `trigger-router` |

### Небесный святой (`altruist.heavenly-saint`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Сила молитвы (Strength Of Prayer) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier` |
| 2 | Очищающий свет (Cleansing Light) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Великое восстановление (Grand Restoration) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier` |

### Предвидящий (`altruist.precognizant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Вспышка озарения (Flash Of Insight) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `scene-lifecycle`, `choice-flow`, `dice-hooks` |
| 2 | Воспользоваться (Take Advantage) | проверено | частичная | `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier`, `derived-stats` |
| 3 | Швырнуть в бесконечность (Hurl Into The Infinite) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |

### Хирург (`altruist.surgeon`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Не навреди (Do No Harm) | проверено | полная | `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Операционная процедура (Operational Procedure) | проверено | ручная | `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `intermission-reset`, `choice-flow`, `damage-pipeline`, `dice-hooks` |
| 3 | Чудотворец (Miracle Worker) | проверено | частичная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `inventory`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Заклинатель талисманов (`altruist.talisman-caster`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Священная печать (Sacred Seal) | проверено | частичная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Брошенный талисман (Tossed Talisman) | проверено | ручная | `spatial-range`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Экзорцизм (Exorcize) | проверено | частичная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `action-modifier` |

### Алхимик (`altruist.alchemist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Быстрая смесь (Quick Mix) | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Мощная смесь (Powerful Mix) | проверено | полная | `target-validation`, `event-participants`, `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `damage-pipeline` |
| 3 | Высокоинтенсивная смесь (High Intensity Mix) | проверено | частичная | `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |

### Хрономант (`altruist.chronomancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ускорение (Accelerate) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Замедление (Decelerate) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `dice-hooks` |
| 3 | Остановка времени (Time Stop) | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `duel-flow`, `dice-hooks` |

### Танцор (`altruist.dancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Партнер по танцу (Dance Partner) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Сердца в унисон (Hearts In Tandem) | проверено | частичная | `resource-check`, `trigger-router`, `action-modifier`, `action-history` |
| 3 | Престиж (The Prestige) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `action-history` |

### Ходящий в тумане (`altruist.fog-walker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пустить дым (Blowing Smoke) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Мистическая дымка (Mystic Mist) | проверено | частичная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `derived-stats` |
| 3 | Жалящий пар (Stinging Steam) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Последняя надежда (`altruist.last-hope`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Примечательно отсутствует (Notably Absent) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 2 | Героическое возвращение (Heroic Return) | проверено | частичная | `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `combat-meter` |
| 3 | Взрывное возвращение (Explosive Return) | проверено | частичная | `trigger-router`, `reaction-window`, `turn-lifecycle` |

### Репликатор (`altruist.replicator`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Форма эха (Echo Form) | проверено | частичная | `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Симметрия (Symmetry) | проверено | частичная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router` |
| 3 | Полная синхронизация (Full Sync) | проверено | частичная | `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `derived-stats` |

### Блуждающий огонек (`altruist.will-o-wisp`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пламя духовного плетения (Spirit Weaving Flame) | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Дружелюбные духи (Friendly Spirits) | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow` |
| 3 | Парные духи (Twinned Spirits) | проверено | с выбором | `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow` |

### Художник (`altruist.artist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Взмах кисти (Stroke Of The Brush) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Холст из плоти (Canvas Of Flesh) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Клеймо кисти (Brush-Brand) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |

### Ученый бард (`altruist.bardic-savant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Музыкант (Musician) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Быстрая композиция (Quick Composition) | проверено | частичная | `resource-check`, `inventory`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 3 | На бис (Encore) | проверено | частичная | `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier` |

### Сборщик колоды (`altruist.deckbuilder`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Добор (Draw) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `inventory`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Карточная ловушка (Card Trap) | проверено | частичная | `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `inventory`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Жадность (Greed) | проверено | ручная | `inventory`, `usage-limits`, `action-modifier` |

## Подрывник

### Кровопускатель (`disruptor.bloodletter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Кровоточащее лезвие (Bleeding Edge) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Ищейка (Bloodhound) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 3 | Разрыв (Rupture) [Стычка -> Передышка] | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |

### Химик (`disruptor.chemist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Сублимация (Sublimation) | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Экспериментальная смесь (Experimental Mixture) | проверено | полная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `information-query` |
| 3 | Осаждение (Deposition) | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline` |

### Душитель (`disruptor.constrictor`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Обвить (Wrap) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Удушение (Choke) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | Скручивающий удар (Twisting Impact) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Карманник (`disruptor.cutpurse`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ловкие руки (Fast Hands) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow` |
| 2 | Урвать (Snatch) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow` |
| 3 | Вор в ночи (Thief In The Night) | проверено | частичная | `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `action-history` |

### Морок (`disruptor.mind-breaker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "Где вы?" ("Where Are You?") | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | "Что вы делаете?" ("What Do You Do?") | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router` |
| 3 | "Кто они?" ("Who Are They?") | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |

### Жнец (`disruptor.reaper`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Посев (Sow) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier` |
| 2 | Уход (Tend) | проверено | частичная | `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler` |
| 3 | Жатва (Reap) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier` |

### Мастер тактики (`disruptor.tactical-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Остановиться и подумать (Stop And Think) | проверено | частичная | `resource-check`, `effect-state`, `effect-lifecycle`, `stance`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |
| 2 | Анализ (Study) | проверено | частичная | `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Эврика! (Eureka!) | проверено | частичная | `resource-check`, `stance`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `derived-stats` |

### Автофаг (`disruptor.autophage`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Переливание (Transfusion) | проверено | частичная | `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Перенапряжение (Overexert) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Рожденный изменчивой плотью (Born Of Mutable Flesh) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Говорящий с землей (`disruptor.earth-speaker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Тектонический сдвиг (Tectonic Shift) | проверено | частичная | `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline` |
| 2 | Земляные осколки (Earthen Shards) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline` |
| 3 | Каменные солдаты (Stone Soldiers) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Нечеловеческая сила (`disruptor.inhuman-strength`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Сильная рука (Strong-Arm) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Поршневой кулак (Piston Fist) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `derived-stats` |
| 3 | Проломить насквозь (Smash Through) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline` |

### Уличный боец (`disruptor.street-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Кровавые кастеты (Bloody Brass) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Ломать и калечить (Break And Bruise) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Зверствовать (Brutalize) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Тело-рой (`disruptor.swarm-body`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Порхающая форма (Fluttering Form) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `damage-pipeline` |
| 2 | Исчезнуть в мухах (Vanish Into Flies) | проверено | частичная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Пожрать (Devour) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |

### Сирена (`disruptor.siren`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ты ведь не причинишь МНЕ боль? (You wouldn't hurt ME, would you?) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `information-query` |
| 2 | Неотразимая (Irresistible) | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle` |
| 3 | Помогите-ка сюда (A little help over here?) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |

### Всадник волн (`disruptor.wave-rider`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Мягкие волны (Gentle Waves) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Мощные волны (Momentous Waves) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |
| 3 | Водяная клетка (Aqua Cage) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle` |

### Шагающий по буре (`disruptor.gale-strider`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Растущие ветра (Growing Winds) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `action-history` |
| 2 | Восходящий поток (Updraft) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle` |
| 3 | Рассекатель гор (Mountain Carver) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |

### Охотник (`disruptor.hunter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стальные челюсти (Steel Jaws) | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier` |
| 2 | Дальняя установка (Far Setting) | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Яма-ловушка (Pit Trap) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier` |

### Внутренний мир (`disruptor.inner-world`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Глубокий взгляд (Gaze Deeply) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Домен контроля (Domain Of Control) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline` |
| 3 | Родная территория (Home Turf) | проверено | частичная | `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `duel-flow`, `dice-hooks` |

### Магическая схема (`disruptor.mage-s-array`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Начертание (Inscribe) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Корректировка (Readjust) | проверено | частичная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow` |
| 3 | Тюрьма собственного замысла (Prison Of Your Own Design) | проверено | ручная | `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |

## Разрушитель

### Бомбардир (`ruiner.bombardier`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Взрыв!! (Explosion!!) | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `action-modifier` |
| 2 | Взрыв!!! (Explosion!!!) | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | ВЗРЫВ!!!! (EXPLOSION!!!!) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |

### Револьверное колдовство (`ruiner.rapid-fire-sorcery`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Размножение (Proliferate) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Выжженная земля (Scorched Earth) | проверено | частичная | `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline` |
| 3 | Бесконечный огонь (Endless Fire) [Зарядка -> Заклинание] | проверено | частичная | `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`, `combat-meter` |

### Ритуалист (`ruiner.ritualist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Лей-линии (Ley Lines) | проверено | частичная | `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `combat-meter` |
| 2 | Магическая артиллерия (Arcane Artillery) | проверено | частичная | `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`, `combat-meter` |
| 3 | Фрактальные начертания (Fractal Etchings) | проверено | ручная | `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier` |

### Творец заклинаний (`ruiner.spellcrafter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Эксперимент (Experimentation) | проверено | с выбором | `spatial-cells`, `spatial-range`, `inventory`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Закрепление (Solidification) | проверено | с выбором | `resource-check`, `inventory`, `trigger-router`, `action-modifier`, `derived-stats` |
| 3 | Финализация (Finalization) | проверено | с выбором | `resource-check`, `inventory`, `trigger-router`, `action-modifier` |

### Ученик звезд (`ruiner.student-of-stars`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Высвобожденная мощь (Power Unleashed) [Зарядка -> Завершение] | проверено | частичная | `resource-check`, `usage-limits`, `action-modifier`, `action-history`, `combat-meter` |
| 2 | Бесформенная сила (Formless Strength) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `choice-flow`, `action-modifier`, `action-history` |
| 3 | Момент истины (Moment Of Truth) | проверено | частичная | `resource-check`, `trigger-router`, `choice-flow`, `duel-flow`, `dice-hooks` |

### Криомант (`ruiner.cryomancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Охлаждение (Chill) | проверено | полная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Ледяной нимб (Icicle Halo) | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Раскол (Shatter) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `information-query` |

### Драматург (`ruiner.dramaturge`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Все смотрят на меня (All Eyes On Me) | проверено | частичная | `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `combat-meter` |
| 2 | Украсть их огонь (Snatch Their Fire) | проверено | частичная | `trigger-router`, `turn-lifecycle`, `combat-meter` |
| 3 | Сила подачи (Power In Presentation) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter` |

### Дикая магия (`ruiner.feral-arcana`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ворпальный коготь (Vorpal Claw) | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `action-modifier`, `dice-hooks` |
| 2 | Сорваться с цепи (Unchain) [Зарядка -> Взаимодействие] | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `duration-scheduler`, `combat-meter` |
| 3 | Хватка (Grasp) | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `combat-meter` |

### Пламенное сердце (`ruiner.flame-heart`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Разогрев (Rev Up) | проверено | частичная | `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Проклятый удар (Damning Impact) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `combat-meter` |
| 3 | Прах к праху (Ashes To Ashes) | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |

### Мрачный Вознесенный (`ruiner.grim-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Непостоянная мощь (Impermanent Power) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`, `transformation`, `combat-meter` |
| 2 | Вытянуть жизнь (Drain Life) | проверено | с выбором | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation` |
| 3 | Умбра (Umbra) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation` |

### Сильное натяжение (`ruiner.long-draw`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Наложить стрелу (Nock The Arrow) | проверено | частичная | `resource-check`, `inventory`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Перьевой шаг (Feather Step) | проверено | частичная | `movement-lifecycle`, `inventory`, `trigger-router` |
| 3 | Пронзитель владык (Lord Piercer) [Подготовка x 3] | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `inventory`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history` |

### Клинки маны (`ruiner.mana-blades`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | К оружию (Call Arms) | проверено | частичная | `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `action-copy` |
| 2 | Орудия павших (Tools Of The Fallen) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Святой меч, Экскалибур (Saintly Sword, Excalibur) | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `transformation`, `action-copy` |

### Душа пустоты (`ruiner.void-soul`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Возвращение в ничто (Return To Nothing) | проверено | частичная | `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `choice-flow` |
| 2 | Раствориться (Fade Away) | проверено | частичная | `resource-check`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle` |
| 3 | Полое сердце (Hollow Heart) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier` |

### Громовая кровь (`ruiner.thunder-blood`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Райден (Raiden) | проверено | с выбором | `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Заряженное заклинание (Energized Incantation) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Разрядка (Discharge) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Фанатик (`ruiner.zealot`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Еретическая преданность (Heretical Devotion) | проверено | с выбором | `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 2 | Всегда под взглядом, утоплен в слезах (Always Watched, Drowned In Tears) | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `choice-flow` |
| 3 | Так не должно было быть (Never Meant To Be) | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `terrain`, `spatial-topology`, `trigger-router`, `choice-flow`, `action-modifier` |

### Аскет творения (`ruiner.creation-ascetic`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Формирование знаков (Forming Signs) | проверено | с выбором | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `alternate-resource`, `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Один истинный мир (One True World) | проверено | полная | `resource-check`, `alternate-resource`, `terrain`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |
| 3 | Труд благочестивых (Labor Of The Devout) [Заклинание -> Завершение] | проверено | полная | `resource-check`, `alternate-resource`, `action-modifier`, `action-history` |

### Эго-оружие (`ruiner.ego-arm`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Я - твой меч (I Am Your Sword) | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `deployment-hooks`, `transformation` |
| 2 | Покажи свои цели (Show Your Targets) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history`, `derived-stats` |
| 3 | И я стану незаменимым (And I'll Become Irreplaceable) | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `derived-stats` |

### Зов наемника (`ruiner.sellsword-s-call`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Реприза воина (A Warrior's Reprise) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Боевой гимн (Battle Hymn) | проверено | частичная | `resource-check`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Верховный наемник (Supreme Sellsword) | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `bond-actions`, `deployment-hooks` |

## Поддержание ручной сверки

При появлении или изменении Уровня откройте его полный текст в `source/translation/`, проверьте каждый тег и обновите `REVIEWED` вместе с точными дополнениями или исключениями. Не повышайте автоматизацию только на основании этой карты.
