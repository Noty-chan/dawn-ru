# Карта требований автоматизации Техник

> Генерируется командой `npm run map`. Не редактируйте таблицы вручную:
> классификация, реестр ручной сверки и точные исключения находятся в `technique-foundation-map.js`.

Покрыто Уровней: **333**. Ручная сверка текста завершена: **318**. Непроверенные строки остаются кандидатами и не являются утверждением о полной автоматизации.

Ревизия источника ручной сверки: `d41acc9`.
SHA-256 проверенных файлов: `6049f3ff6b79b8204c45cb8b830b2653696d0469f42f58fb4fedf07b0880dd76`.

## Легенда возможностей

| id | Назначение | Состояние | Модуль | Проверенных Уровней |
| --- | --- | --- | --- | ---: |
| `event-participants` | Участники события | готово | `scene-engine-core.js` | 199 |
| `event-preview` | Предпросмотр цепочки | готово | `scene-triggers.js` | 0 |
| `spatial-cells` | Персонажи в клетках и областях | готово | `scene-query.js` | 27 |
| `spatial-range` | Персонажи в дальности | готово | `scene-query.js` | 44 |
| `spatial-topology` | Удалённые клетки и разрывы поля | готово | `scene-engine-core.js / scene-events.js / scene-movement.js` | 1 |
| `target-validation` | Проверка целей | готово | `scene-query.js` | 199 |
| `resource-check` | Проверка ресурсов | готово | `scene-query.js` | 106 |
| `effect-state` | Чтение состояния Эффекта | готово | `scene-query.js` | 129 |
| `event-summary` | Сводка цепочки | готово | `scene-query.js` | 0 |
| `rule-clock` | Часы правила | готово | `scene-foundations.js` | 19 |
| `alternate-resource` | Альтернативный ресурс | готово | `scene-foundations.js` | 17 |
| `stance` | Стойки | готово | `scene-foundations.js` | 6 |
| `exclusive-mode` | Взаимоисключающие режимы | готово | `scene-foundations.js / scene-events.js` | 3 |
| `owned-entities` | Принадлежащие сущности | готово | `scene-foundations.js` | 60 |
| `action-history` | История действий | готово | `scene-foundations.js` | 36 |
| `terrain` | Местность | готово | `scene-foundations.js` | 33 |
| `usage-limits` | Лимиты использования | готово | `scene-foundations.js` | 75 |
| `trigger-router` | Маршрутизация триггеров | готово | `scene-triggers.js / scene-events.js` | 290 |
| `reaction-window` | Окна Реакций и вмешательств | готово | `scene-responses.js / scene-events.js` | 39 |
| `turn-lifecycle` | Жизненный цикл Хода и Раунда | готово | `lionwing-adapters.js / lionwing-engine.js` | 79 |
| `scene-lifecycle` | Начало, конец и сброс Сцены | готово | `lionwing-adapters.js / lionwing-engine.js` | 39 |
| `movement-lifecycle` | Жизненный цикл движения | готово | `lionwing-geometry.js / lionwing-engine.js` | 117 |
| `choice-flow` | Типизированное решение | готово | `scene-responses.js / scene-events.js / scene-effects.js` | 141 |
| `damage-pipeline` | Конвейер урона, Здоровья и Ран | готово | `scene-responses.js / scene-events.js` | 104 |
| `action-modifier` | Модификатор или новое действие | готово | `scene-actions.js / scene-responses.js` | 241 |
| `composite-action` | Сохраняемое составное действие | готово | `scene-query.js / scene-events.js / scene-responses.js / scene-effects.js` | 4 |
| `effect-lifecycle` | Механика, источник и срок Эффекта | готово | `scene-engine-core.js / scene-query.js / scene-events.js / scene-triggers.js / scene-responses.js` | 129 |
| `entity-lifecycle` | Жизненный цикл зон, маркеров и объектов | готово | `scene-events.js / scene-triggers.js / scene-ui.js` | 60 |
| `inventory` | Инвентарь и заряды | готово | `lionwing-inventory.js / lionwing-engine.js` | 24 |
| `summon-turns` | Призывы и делегированные Ходы | планируется | — | 8 |
| `dice-hooks` | Модификаторы и повтор броска | готово | `scene-foundations.js / scene-events.js / scene-triggers.js` | 73 |
| `duration-scheduler` | Сроки действия и отложенные эффекты | готово | `scene-events.js / scene-triggers.js / scene-ui.js` | 15 |
| `deployment-hooks` | Развертывание | планируется | — | 6 |
| `intermission-reset` | Сброс на Интермиссии | готово | `lionwing-inventory.js / lionwing-engine.js` | 3 |
| `bond-actions` | Связи и действия Связей | планируется | — | 5 |
| `derived-stats` | Производные характеристики персонажа | готово | `lionwing-adapters.js / lionwing-engine.js` | 47 |
| `information-query` | Изучение и раскрытие информации | готово | `lionwing-information-query.js / lionwing-engine.js` | 13 |
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

## Powerhouse

### Berserker (`powerhouse.berserker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Revenge | проверено | ручная | `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `derived-stats`, `combat-meter` |
| 2 | Cornered Dog | проверено | ручная | `trigger-router`, `damage-pipeline`, `derived-stats` |
| 3 | Take A Beating | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |

### Dragonslayer (`powerhouse.dragonslayer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Speed Is Weight | проверено | полная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Wide Arc | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Titanic Heave [ Breathe → Body Finisher ] | проверено | полная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |

### Duelist (`powerhouse.duelist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Riposte [ Block → Skirmish ] | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Parry | проверено | полная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 3 | Deflecting Blow | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `reaction-window`, `action-modifier` |

### Flagellant (`powerhouse.flagellant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Thrill | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow` |
| 2 | Wild Rush | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks` |
| 3 | Bled Dry | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline` |

### Gunslinger (`powerhouse.gunslinger`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Big Iron | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 2 | Lock And Load | проверено | с выбором | `resource-check`, `alternate-resource`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks` |
| 3 | Bullet Juggle | проверено | полная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |

### Struggler (`powerhouse.struggler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Effort | проверено | ручная | `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `dice-hooks`, `derived-stats` |
| 2 | Adrenaline | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |
| 3 | Defy Reason | проверено | ручная | `trigger-router`, `action-modifier`, `dice-hooks` |

### SpellSword (`powerhouse.spellsword`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Twin Suns [ Cast → Skirmish ] | проверено | ручная | `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `action-copy` |
| 2 | Infused Edge | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier`, `action-history` |
| 3 | Witch Hunter [ Cast → Body/Talent Finisher ] | проверено | полная | `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history` |

### Technician (`powerhouse.technician`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Stretch | проверено | ручная | `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `derived-stats` |
| 2 | Perfect Form | проверено | ручная | `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `derived-stats` |
| 3 | Final Blow [ Skirmish → Finisher ] | проверено | полная | `resource-check`, `action-modifier`, `action-history`, `derived-stats` |

### Unbroken (`powerhouse.unbroken`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Get Back Up | проверено | ручная | `resource-check`, `usage-limits`, `scene-lifecycle`, `choice-flow`, `duration-scheduler`, `duel-flow` |
| 2 | Furious Revival | проверено | ручная | `resource-check`, `trigger-router`, `action-modifier` |
| 3 | Phoenix | проверено | ручная | `resource-check`, `trigger-router`, `damage-pipeline`, `duel-flow` |

### Braggart (`powerhouse.braggart`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Hubris | проверено | частичная | `rule-clock`, `trigger-router`, `reaction-window`, `scene-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Prove Yourself | проверено | с выбором | `rule-clock`, `usage-limits`, `trigger-router`, `choice-flow`, `dice-hooks` |
| 3 | A Worthy Opponent | проверено | с выбором | `rule-clock`, `trigger-router`, `damage-pipeline` |

### Breacher (`powerhouse.breacher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Buck Shot | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Both Barrels | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Annihilate | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `action-modifier` |

### Dual Wielder (`powerhouse.dual-wielder`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Twinned blow | проверено | ручная | `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Frenzied Barrage | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Varied Blades | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `action-history` |

### Intimidator (`powerhouse.intimidator`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "Pathetic" | кандидат | ручная | `event-preview`, `event-summary` |
| 2 | "Out Of My Way" | кандидат | ручная | `event-preview`, `event-summary` |
| 3 | "Fools And Dead Men" | кандидат | ручная | `event-preview`, `event-summary` |

### Martial Artist (`powerhouse.martial-artist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Art Of The 8 Hammers | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Flow-State | проверено | ручная | `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `derived-stats` |
| 3 | Unlimited Blows | проверено | ручная | `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Monastic Warrior (`powerhouse.monastic-sage`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Mind Made Manifest | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 2 | Calm Within Chaos | проверено | ручная | `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `inventory` |
| 3 | Sublime Equanimity | проверено | ручная | `resource-check`, `trigger-router`, `turn-lifecycle`, `choice-flow` |

### Lancer (`powerhouse.lancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Pierce | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `action-modifier`, `dice-hooks` |
| 2 | Phalanx | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `damage-pipeline`, `action-modifier` |
| 3 | Cannon-Arm [ Breathe → Skirmish ] | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Predator (`powerhouse.predator`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Yearn | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `information-query` |
| 2 | Obsess | проверено | ручная | `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline`, `derived-stats`, `information-query` |
| 3 | Envelop | проверено | ручная | `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier` |

### Improvisational Fighter (`powerhouse.improvisational-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "This'll Do" | проверено | частичная | `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `derived-stats` |
| 2 | "That One Hurts!" | проверено | ручная | `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks` |
| 3 | Last Resort | проверено | ручная | `terrain`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `dice-hooks`, `combat-meter` |

### Warring Ascendant (`powerhouse.warring-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Heavenly Arm | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation`, `combat-meter`, `action-copy` |
| 2 | Esoteric Blades | проверено | ручная | `trigger-router`, `choice-flow`, `transformation`, `action-copy` |
| 3 | Saintly Sword, Heaven Piercer | проверено | частичная | `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation` |

### Heroic Ascendant (`powerhouse.heroic-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Warrior Of Legend | кандидат | ручная | `event-preview`, `event-summary` |
| 2 | Hero's Feat | кандидат | ручная | `event-preview`, `event-summary` |
| 3 | Mastered Strength | кандидат | ручная | `event-preview`, `event-summary` |

## Vagabond

### Aerial Master (`vagabond.aerial-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Soar | проверено | частичная | `effect-state`, `effect-lifecycle`, `stance`, `terrain`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Hunt | проверено | ручная | `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Falling Ax Strike | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `stance`, `trigger-router`, `action-modifier`, `dice-hooks`, `derived-stats` |

### Assassin (`vagabond.assassin`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ambush | проверено | полная | `usage-limits`, `trigger-router`, `action-modifier`, `deployment-hooks` |
| 2 | Assassinate | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `composite-action`, `dice-hooks` |
| 3 | Speed of Dark [ Hide → Stride ] | проверено | полная | `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `action-modifier`, `action-history` |

### Sniper (`vagabond.sniper`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Long Shot | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `action-modifier` |
| 2 | Bunker Down | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`, `spatial-range` |
| 3 | Deadeye [ Hide → Talent Finisher ] | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |

### Skirmisher (`vagabond.skirmisher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Sting | проверено | ручная | `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Shifting Blows | проверено | ручная | `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Rebound | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Speed Demon (`vagabond.speed-demon`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Fade | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle` |
| 2 | Flash Strike | проверено | полная | `movement-lifecycle`, `action-modifier`, `action-history` |
| 3 | Flash Step [ Breathe → Stride ] | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |

### Untouchable (`vagabond.untouchable`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Duck | проверено | полная | `usage-limits`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 2 | Weave | проверено | с выбором | `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `derived-stats` |
| 3 | Fighter's Instinct [ Dodge → Skirmish ] | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |

### Acrobat (`vagabond.acrobat`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Flying Kick [ Jump → Skirmish ] | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Wall Jump | проверено | ручная | `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 3 | Weightless Body | проверено | ручная | `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `action-modifier` |

### Blade Master (`vagabond.blade-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Draw Stance | проверено | ручная | `stance`, `trigger-router`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Divide In One Motion [ Breathe → Jump ] | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `stance`, `trigger-router`, `action-modifier`, `action-history` |
| 3 | Leaping Koi | проверено | ручная | `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |

### Cunning Fighter (`vagabond.cunning-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Plan and Execute | проверено | с выбором | `target-validation`, `event-participants`, `rule-clock`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `action-modifier`, `information-query` |
| 2 | Plans Within Plans | проверено | полная | `usage-limits`, `turn-lifecycle`, `action-modifier` |
| 3 | At a Glance | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `information-query` |

### Egomaniac (`vagabond.egomaniac`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Peak Condition | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Dance With Me | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `rule-clock`, `trigger-router`, `choice-flow`, `effect-state`, `effect-lifecycle`, `derived-stats` |
| 3 | Finale | проверено | с выбором | `rule-clock`, `trigger-router`, `choice-flow`, `scene-lifecycle`, `action-modifier`, `combat-meter` |

### Enchained (`vagabond.enchained`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Hook Shot | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Draw In | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 3 | Momentum [ Cast → Skirmish ] | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |

### Knife Juggler (`vagabond.knife-juggler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Throw | проверено | частичная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Resupply | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Chaser | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |

### Malicious Mimic (`vagabond.malicious-mimic`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "Anything You Can Do…" | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `inventory`, `action-copy` |
| 2 | Rehearsed Movements | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `derived-stats`, `inventory` |
| 3 | "…I Can Do Better" | проверено | ручная | `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `inventory`, `action-copy` |

### Weaponsmith (`vagabond.weaponsmith`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Trick Weapon | кандидат | ручная | `event-preview`, `event-summary` |
| 2 | Adaptive Edge | кандидат | ручная | `event-preview`, `event-summary` |
| 3 | Metalurgy | кандидат | ручная | `event-preview`, `event-summary` |

### Modified Meister (`vagabond.modified-meister`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Running Hot | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `damage-pipeline`, `trigger-router`, `scene-lifecycle`, `action-modifier` |
| 2 | Overload | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Overclock | проверено | с выбором | `resource-check`, `alternate-resource`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter` |

### Opportunist (`vagabond.opportunist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Pack Tactics | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `action-modifier` |
| 2 | Hungry Eyes | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window` |
| 3 | Launcher Combo | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `action-modifier` |

### Reflector (`vagabond.reflector`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Catch The Blade | проверено | ручная | `trigger-router`, `reaction-window`, `scene-lifecycle`, `damage-pipeline`, `choice-flow`, `derived-stats` |
| 2 | Watch And Wait | проверено | ручная | `trigger-router`, `reaction-window`, `damage-pipeline`, `dice-hooks` |
| 3 | To Carry Their Fury | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats` |

### Detective (`vagabond.dim-mak`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Study Weakness | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `information-query` |
| 2 | Dissect [ Investigate x 3 ] | проверено | с выбором | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `information-query`, `derived-stats` |
| 3 | 4-Point Execution | проверено | ручная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `action-history` |

### Drunkard (`vagabond.drunkard`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Down The Hatch | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `deployment-hooks`, `dice-hooks` |
| 2 | Fool's Dance | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 3 | Chug | проверено | ручная | `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier` |

### Master-At-Arms (`vagabond.master-at-arms`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Multi-Faceted | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `exclusive-mode`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Like Water | проверено | полная | `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `exclusive-mode`, `trigger-router`, `turn-lifecycle`, `derived-stats` |
| 3 | Master At Work | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `terrain`, `exclusive-mode`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

## Bulwark

### Crusher (`bulwark.crusher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | 30,000 Tons | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Hammerfall | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history` |
| 3 | "You Look Like A Nail" | проверено | ручная | `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history` |

### Giant Frame (`bulwark.giant-frame`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Big Arms | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Immense | проверено | ручная | `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `deployment-hooks`, `derived-stats`, `multi-space-actor` |
| 3 | Shockwave | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Iron Bodied (`bulwark.iron-bodied`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Tough As Stone | проверено | ручная | `movement-lifecycle`, `derived-stats` |
| 2 | Resilience | проверено | полная | `derived-stats` |
| 3 | Stainless Stride | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `derived-stats` |

### Vanguard Defender (`bulwark.vanguard-defender`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | White Knight | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier` |
| 2 | Steel Angel | проверено | ручная | `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `derived-stats` |
| 3 | Inspire Courage | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow` |

### Absolute Bastard (`bulwark.absolute-bastard`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Easy To Hate | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `information-query` |
| 2 | Bully | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `derived-stats` |
| 3 | Add Injury To Insult | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Battle Jockey (`bulwark.battle-jockey`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Trusty Steed | проверено | ручная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `deployment-hooks` |
| 2 | Grasping Jaws | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `summon-turns` |
| 3 | Roaring Entry | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `turn-lifecycle` |

### Grappler (`bulwark.grappler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Restrain | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Spine Breaker | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Finishing Move [ Body Finisher → Jump ] | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `composite-action`, `action-history` |

### Juggernaut (`bulwark.juggernaut`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Wild Charge | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Violence | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline` |
| 3 | "Eat Dirt!" | проверено | ручная | `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |

### Mollycoddler (`bulwark.runic-retribution`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Lash | проверено | ручная | `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier` |
| 2 | Loving Rite | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `information-query` |
| 3 | Devotion | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `duration-scheduler`, `choice-flow`, `action-modifier` |

### Mundane (`bulwark.mundane`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | For What The Spirit Lacks | проверено | частичная | `resource-check`, `alternate-resource`, `turn-lifecycle`, `action-modifier`, `derived-stats` |
| 2 | Dig Deep, Stand Firm | проверено | полная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `trigger-router`, `reaction-window` |
| 3 | In The Face Of The Beyond | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Rising Challenger (`bulwark.rising-challenger`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Perfect Deflection | проверено | ручная | `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 2 | "You'll Have To Get Through Me!" | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 3 | Drama And Spite | проверено | полная | `dice-hooks`, `action-modifier` |

### Shield Bearer (`bulwark.shield-bearer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Wall | проверено | ручная | `resource-check`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `derived-stats` |
| 2 | Shield Charge | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | Focused Defense | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `derived-stats` |

### Stalwart Sentry (`bulwark.stalwart-sentry`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Guardian | проверено | ручная | `movement-lifecycle`, `trigger-router`, `turn-lifecycle` |
| 2 | On Watch | проверено | с выбором | `resource-check`, `rule-clock`, `trigger-router`, `action-modifier` |
| 3 | Zone Of Influence | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `information-query` |

### Bestial Ascendant (`bulwark.beastial-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Beastly | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation`, `combat-meter`, `action-copy` |
| 2 | Inheritance | проверено | ручная | `trigger-router`, `choice-flow`, `damage-pipeline`, `transformation`, `action-copy` |
| 3 | Apex | проверено | ручная | `resource-check`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `transformation`, `action-copy` |

### Guard Caller (`bulwark.guardian-angel`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Two Bodies | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `damage-pipeline`, `action-modifier`, `multi-space-actor` |
| 2 | Together In Life | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `action-history` |
| 3 | Together In Death | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier`, `derived-stats`, `multi-space-actor` |

### Mecha Pilot (`bulwark.mecha-pilot`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Rune Core Engine | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`, `multi-space-actor` |
| 2 | Autonomous | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`, `multi-space-actor` |
| 3 | Perfect Sync | проверено | ручная | `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `choice-flow`, `action-modifier`, `derived-stats`, `multi-space-actor` |

## Altruist

### Analyst (`altruist.precognizant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Flash Of Insight | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `scene-lifecycle`, `choice-flow`, `dice-hooks` |
| 2 | Take Advantage | проверено | ручная | `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier`, `derived-stats` |
| 3 | Watch And Wait | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |

### Battle Instructor (`altruist.battle-instructor`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Strike Order | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `information-query` |
| 2 | Teaching Moment | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `trigger-router`, `reaction-window`, `choice-flow`, `dice-hooks` |
| 3 | Remember Your Training | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier` |

### Empath (`altruist.empath`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Calming Aura | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow` |
| 2 | Protective Response | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier` |
| 3 | "Are You Ok?" | проверено | полная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `action-modifier` |

### Compassionate Sage (`altruist.heavenly-saint`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Strength Of Prayer | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier` |
| 2 | Cleansing Light | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Grand Restoration | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier` |

### Gourmand (`altruist.gourmand`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Healthy Meal | проверено | ручная | `target-validation`, `event-participants`, `damage-pipeline`, `inventory`, `trigger-router`, `intermission-reset`, `choice-flow`, `action-modifier` |
| 2 | Fast Food | проверено | полная | `inventory`, `intermission-reset` |
| 3 | Shared Experiences | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `bond-actions`, `inventory`, `trigger-router` |

### Surgeon (`altruist.surgeon`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Do No Harm | проверено | частичная | `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Operational Procedure | проверено | ручная | `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `intermission-reset`, `choice-flow`, `damage-pipeline`, `dice-hooks` |
| 3 | Miracle Worker | проверено | ручная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `inventory`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Tactical Master (`disruptor.tactical-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Stop And Think | проверено | ручная | `resource-check`, `effect-state`, `effect-lifecycle`, `stance`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |
| 2 | Study | проверено | ручная | `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Eureka! | проверено | ручная | `resource-check`, `stance`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `derived-stats` |

### Talisman Exorcist (`altruist.talisman-caster`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Sacred Seal | проверено | ручная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Tossed Talisman | проверено | ручная | `spatial-range`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Exorcize | проверено | ручная | `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `action-modifier` |

### Abjuring Sage (`altruist.abjuring-sage`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Barrier | кандидат | ручная | `event-preview`, `event-summary` |
| 2 | Impenetrable | кандидат | ручная | `event-preview`, `event-summary` |
| 3 | Block Beam | кандидат | ручная | `event-preview`, `event-summary` |

### Alchemist (`altruist.alchemist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Quick Mix | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Powerful Mix | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `damage-pipeline` |
| 3 | High Intensity Mix | проверено | ручная | `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |

### Dancer (`altruist.dancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Dance Partner | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Hearts In Tandem | проверено | ручная | `resource-check`, `trigger-router`, `action-modifier`, `action-history` |
| 3 | The Prestige | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `action-history` |

### Fog Walker (`altruist.fog-walker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Blowing Smoke | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `composite-action` |
| 2 | Mystic Mist | проверено | ручная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `derived-stats`, `composite-action` |
| 3 | Stinging Steam | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Last Hope (`altruist.last-hope`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Notably Absent | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier` |
| 2 | Heroic Return | проверено | ручная | `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `combat-meter` |
| 3 | Explosive Return | проверено | ручная | `trigger-router`, `reaction-window`, `turn-lifecycle` |

### Replicator (`altruist.replicator`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Echo Form | проверено | ручная | `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Symmetry | проверено | ручная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router` |
| 3 | Full Sync | проверено | ручная | `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `derived-stats` |

### Temporal Sage (`altruist.chronomancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Accelerate | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Decelerate | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `dice-hooks` |
| 3 | Time Stop | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `duel-flow`, `dice-hooks` |

### Virtuoso (`altruist.bardic-savant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Musician | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Reverb | проверено | ручная | `resource-check`, `inventory`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 3 | Encore | проверено | ручная | `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier` |

### Artist (`altruist.artist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Stroke Of The Brush | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Canvas Of Flesh | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Brush-Brand | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |

### Deckbuilder (`altruist.deckbuilder`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Draw | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `inventory`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Card Capture | проверено | ручная | `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `inventory`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Greed | проверено | ручная | `inventory`, `usage-limits`, `action-modifier` |

### Will-O-Wisp (`altruist.will-o-wisp`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Spirit Weaving Flame | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Friendly Spirits | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow` |
| 3 | Twinned Spirits | проверено | с выбором | `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow` |

## Disruptor

### Bloodletter (`disruptor.bloodletter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Bleeding Edge | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Bloodhound | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 3 | Rupture [ Skirmish → Breathe ] | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |

### Chemist (`disruptor.chemist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Sublimation | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Experimental Mixture | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `information-query` |
| 3 | Deposition | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline` |

### Constrictor (`disruptor.constrictor`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Wrap | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Choke | проверено | полная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | Twisting Impact | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Cutpurse (`disruptor.cutpurse`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Fast Hands | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow` |
| 2 | Snatch | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow` |
| 3 | Rob Them Blind | проверено | ручная | `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `action-history` |

### Light Bender (`disruptor.light-bender`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Blendendes Licht | кандидат | ручная | `event-preview`, `event-summary` |
| 2 | Sonneneruption | кандидат | ручная | `event-preview`, `event-summary` |
| 3 | Falscher Stern | кандидат | ручная | `event-preview`, `event-summary` |

### Reaper (`disruptor.reaper`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Sow | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier` |
| 2 | Tend | проверено | частичная | `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler` |
| 3 | Reap | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier` |

### Street Fighter (`disruptor.street-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Bloody Brass | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Break And Bruise | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Brutalize | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Autophage (`disruptor.autophage`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Transfusion | проверено | частичная | `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Overexert | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Born Of Mutable Flesh | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Earth Speaker (`disruptor.earth-speaker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Stone Soldiers | проверено | ручная | `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline` |
| 2 | Tectonic Shift | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline` |
| 3 | Earthen Shards | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Strongman (`disruptor.inhuman-strength`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Strong-Arm | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Piston Fist | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `derived-stats` |
| 3 | Smash Through | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline` |

### SwarmKin (`disruptor.swarm-body`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Fluttering Form | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `damage-pipeline` |
| 2 | Vanish Into Flies | проверено | ручная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Devour | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |

### Siren (`disruptor.siren`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "You wouldn't hurt ME, would you?" | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `information-query` |
| 2 | "I'm Irresistible!" | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle` |
| 3 | "A little help over here?" | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |

### Wave Rider (`disruptor.wave-rider`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Gentle Waves | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Momentous Waves | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |
| 3 | Aqua Cage | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle` |

### Mind Breaker (`disruptor.mind-breaker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "Where Are You?" | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | "Where Am I?" | проверено | частичная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router` |
| 3 | "Who Are They?" | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier` |

### Gale Strider (`disruptor.gale-strider`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Growing Winds | проверено | частичная | `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `action-history` |
| 2 | Updraft | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle` |
| 3 | Mountain Carver | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline` |

### Poacher (`disruptor.hunter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Steel Jaws | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier` |
| 2 | Far Setting | проверено | полная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Pit Trap | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier` |

### Jailor (`disruptor.mage-s-array`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Erect | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Readjust | проверено | ручная | `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow` |
| 3 | Prison Of Your Own Design | проверено | ручная | `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |

### Worldsmith (`disruptor.inner-world`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Gaze Deeply | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Domain Of Control | проверено | с выбором | `target-validation`, `event-participants`, `spatial-cells`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline` |
| 3 | Home Turf | проверено | частичная | `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `duel-flow`, `dice-hooks` |

## Ruiner

### Bombardier (`ruiner.bombardier`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Explosion!! | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `action-modifier` |
| 2 | Explosion!!! | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | EXPLOSION!!!! | проверено | полная | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier` |

### Eradicator (`ruiner.rapid-fire-sorcery`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Proliferate | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Scorched Earth | проверено | частичная | `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline` |
| 3 | Endless Fire [ Charge → Cast ] | проверено | ручная | `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`, `combat-meter` |

### Ritualist (`ruiner.ritualist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ley Lines | проверено | частичная | `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `combat-meter` |
| 2 | Arcane Artillery | проверено | ручная | `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`, `combat-meter` |
| 3 | Fractal Etchings | проверено | ручная | `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier` |

### Spellcrafter (`ruiner.spellcrafter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Experimentation | проверено | с выбором | `spatial-cells`, `spatial-range`, `inventory`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats` |
| 2 | Solidification | проверено | с выбором | `resource-check`, `inventory`, `trigger-router`, `action-modifier`, `derived-stats` |
| 3 | Finalization | проверено | с выбором | `resource-check`, `inventory`, `trigger-router`, `action-modifier` |

### Student Of Stars (`ruiner.student-of-stars`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Power Unleashed [ Charge → Finisher ] | проверено | ручная | `resource-check`, `usage-limits`, `action-modifier`, `action-history`, `combat-meter` |
| 2 | Formless Strength | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `choice-flow`, `action-modifier`, `action-history` |
| 3 | Moment Of Truth | проверено | ручная | `resource-check`, `trigger-router`, `choice-flow`, `duel-flow`, `dice-hooks` |

### Blade Smith (`ruiner.mana-blades`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Call Arms | проверено | ручная | `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `action-copy` |
| 2 | Blade Storm | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Saintly Sword, Excalibur | проверено | ручная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `transformation`, `action-copy` |

### Dramaturge (`ruiner.dramaturge`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | All Eyes On Me | проверено | ручная | `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `combat-meter` |
| 2 | Snatch Their Fire | проверено | ручная | `trigger-router`, `turn-lifecycle`, `combat-meter` |
| 3 | Power In Presentation | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter` |

### Feral Arcanist (`ruiner.feral-arcana`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Vorpal Claw | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `action-modifier`, `dice-hooks` |
| 2 | Unchain [ Charge → Interact] | проверено | с выбором | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `duration-scheduler`, `combat-meter` |
| 3 | Grasp | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `combat-meter` |

### Flame Heart (`ruiner.flame-heart`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Rev Up | проверено | ручная | `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Damning Impact | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `combat-meter` |
| 3 | Ashes To Ashes | проверено | ручная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |

### Frost Veiler (`ruiner.cryomancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Chill | проверено | полная | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Icicle Halo | проверено | частичная | `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Shatter | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `information-query` |

### Grim Ascendant (`ruiner.grim-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Impermanent Power | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`, `transformation`, `combat-meter` |
| 2 | Drain Life | проверено | частичная | `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation` |
| 3 | Umbra | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `transformation` |

### Ranger (`ruiner.long-draw`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Nock The Arrow | проверено | ручная | `resource-check`, `inventory`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Feather Step | проверено | ручная | `movement-lifecycle`, `inventory`, `trigger-router` |
| 3 | Lord Piercer [ Prepare × 3 ] | проверено | ручная | `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `inventory`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history` |

### Sword Caller (`ruiner.sellsword-s-call`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | A Warrior's Reprise | проверено | частичная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Warrior's Fury | проверено | ручная | `resource-check`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Supreme Sellsword | проверено | ручная | `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `bond-actions`, `deployment-hooks` |

### Void Soul (`ruiner.void-soul`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Return To Nothing | проверено | ручная | `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `choice-flow` |
| 2 | Fade Away | проверено | ручная | `resource-check`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle` |
| 3 | Hollow Heart | проверено | с выбором | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier` |

### Thunder Blood (`ruiner.thunder-blood`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Raiden | проверено | с выбором | `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier` |
| 2 | Energized Incantation | проверено | с выбором | `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | Tactical Discharge | проверено | с выбором | `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Zealot (`ruiner.zealot`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Heretical Devotion | проверено | с выбором | `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 2 | Freak | проверено | с выбором | `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `choice-flow` |
| 3 | Never Meant To Be | проверено | с выбором | `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `terrain`, `spatial-topology`, `trigger-router`, `choice-flow`, `action-modifier` |

### Creator (`ruiner.creation-ascetic`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Forming Signs | проверено | с выбором | `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `alternate-resource`, `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | One True World | проверено | полная | `resource-check`, `alternate-resource`, `terrain`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier` |
| 3 | Labor Of The Devout [ Cast → Finisher ] | проверено | полная | `resource-check`, `alternate-resource`, `action-modifier`, `action-history` |

### Ego Arm (`ruiner.ego-arm`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | I Am Your Sword | проверено | ручная | `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `deployment-hooks`, `transformation` |
| 2 | Show Your Targets | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history`, `derived-stats` |
| 3 | And I'll Become Irreplaceable | проверено | ручная | `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `derived-stats` |

## Поддержание ручной сверки

При появлении или изменении Уровня откройте его полный текст в `source/translation/`, проверьте каждый тег и обновите `REVIEWED` вместе с точными дополнениями или исключениями. Не повышайте автоматизацию только на основании этой карты.
