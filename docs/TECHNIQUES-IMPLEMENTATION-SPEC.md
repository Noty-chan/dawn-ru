# DAWN: кодовая спецификация Техник

> Сгенерировано `npm run docs:rules` из новой канонической редакции `apps/companion/edition-lionwing.js` и RU-оверлея `apps/companion/edition-lionwing-ru.js` (SHA-256 `45f7482557e5ab8bc30d8c7b846e2dd66df27278218054174b8711f84a945de6`).
> Английский текст и механика берутся из canonical EN; русские названия и тексты — из отдельного reviewed RU overlay. Legacy-редакция в этот документ не входит.

## Границы этого документа

Это спецификация текущего кода, а не новый канон. `full`, `decision` и `partial` описывают заявленную привязку к движку; только evidence определяет доказанный уровень. Для канонического текста и двуязычных названий используйте `TECHNIQUES-RU-EN-CATALOG.md`.

## Общий контракт выполнения

`edition-lionwing.js` + `edition-lionwing-ru.js` → `technique-engine.js:RULES` (если правило зарегистрировано) → `scene-engine` (валидация, events, prompt, реакции, урон, эффект, движение) → UI/intent. Отсутствие строки в `RULES` означает, что UI может показать текст и foundation-plan, но механика не вызывается: статус должен быть `manual`.

## Уже работающие семейства

| Семейство | Модуль(и) | Контракт |
| --- | --- | --- |
| `event-participants` · Участники события | `scene-engine-core.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `event-preview` · Предпросмотр цепочки | `scene-triggers.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `spatial-cells` · Персонажи в клетках и областях | `scene-query.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `spatial-range` · Персонажи в дальности | `scene-query.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `spatial-topology` · Удалённые клетки и разрывы поля | `scene-engine-core.js / scene-events.js / scene-movement.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `target-validation` · Проверка целей | `scene-query.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `resource-check` · Проверка ресурсов | `scene-query.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `effect-state` · Чтение состояния Эффекта | `scene-query.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `event-summary` · Сводка цепочки | `scene-query.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `rule-clock` · Часы правила | `scene-foundations.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `alternate-resource` · Альтернативный ресурс | `scene-foundations.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `stance` · Стойки | `scene-foundations.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `exclusive-mode` · Взаимоисключающие режимы | `scene-foundations.js / scene-events.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `owned-entities` · Принадлежащие сущности | `scene-foundations.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `action-history` · История действий | `scene-foundations.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `terrain` · Местность | `scene-foundations.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `usage-limits` · Лимиты использования | `scene-foundations.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `trigger-router` · Маршрутизация триггеров | `scene-triggers.js / scene-events.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `reaction-window` · Окна Реакций и вмешательств | `scene-responses.js / scene-events.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `turn-lifecycle` · Жизненный цикл Хода и Раунда | `lionwing-engine.js (scheduler) / lionwing-adapters.js (declarative hooks)` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `scene-lifecycle` · Начало, конец и сброс Сцены | `lionwing-engine.js (scheduler) / lionwing-adapters.js (declarative hooks)` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `movement-lifecycle` · Жизненный цикл движения | `lionwing-geometry.js / lionwing-engine.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `choice-flow` · Типизированное решение | `scene-responses.js / scene-events.js / scene-effects.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `damage-pipeline` · Конвейер урона, Здоровья и Ран | `scene-responses.js / scene-events.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `action-modifier` · Модификатор или новое действие | `scene-actions.js / scene-responses.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `composite-action` · Сохраняемое составное действие | `scene-query.js / scene-events.js / scene-responses.js / scene-effects.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `effect-lifecycle` · Механика, источник и срок Эффекта | `scene-engine-core.js / scene-query.js / scene-events.js / scene-triggers.js / scene-responses.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `entity-lifecycle` · Жизненный цикл зон, маркеров и объектов | `scene-events.js / scene-triggers.js / scene-ui.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `inventory` · Инвентарь и заряды | `lionwing-inventory.js / lionwing-engine.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `dice-hooks` · Модификаторы и повтор броска | `scene-foundations.js / scene-events.js / scene-triggers.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `duration-scheduler` · Сроки действия и отложенные эффекты | `scene-events.js / scene-triggers.js / scene-ui.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `intermission-reset` · Сброс на Интермиссии | `lionwing-inventory.js / lionwing-engine.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `derived-stats` · Производные характеристики персонажа | `lionwing-adapters.js / lionwing-engine.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `information-query` · Изучение и раскрытие информации | `lionwing-information-query.js / lionwing-engine.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `combat-meter` · Напряжение и общие счетчики боя | `lionwing-combat-meter.js / lionwing-engine.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |

## Требуемые / незавершённые семейства

| Семейство | Состояние | Что должен дать будущий контракт |
| --- | --- | --- |
| `summon-turns` · Призывы и делегированные Ходы | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `deployment-hooks` · Развертывание | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `bond-actions` · Связи и действия Связей | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `transformation` · Трансформации и заимствованные правила | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `duel-flow` · Дуэли и ставки | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `action-copy` · Заимствование Атак и Техник | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `multi-space-actor` · Размер и несколько клеток персонажа | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `manual-ruling` · Ручное решение Нарратора | fallback | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |

## Формат уровня

- **Текущий адаптер** — только реальные записи `RULES`, без вывода из текста или карты.
- **Готовые foundations** — инфраструктура, которую может переиспользовать адаптер.
- **Нужно добавить** — ближайший кодовый контракт; для статуса `manual` это как минимум регистрация собственного trigger/validator/resolver.

## Силач (Powerhouse)

### Берсерк (Berserker) `powerhouse.berserker`

#### 1. Месть (Revenge) `powerhouse.berserker.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `derived-stats`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Загнанный пёс (Cornered Dog) `powerhouse.berserker.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `damage-pipeline`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Выдержать побои (Take A Beating) `powerhouse.berserker.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Драконоборец (Dragonslayer) `powerhouse.dragonslayer`

#### 1. Скорость — это вес (Speed Is Weight) `powerhouse.dragonslayer.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.dragonslayer.1` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.dragonslayer.1","sourceDigest":"5967f1ff724e990c007796133cc60b106a15c4d303d733bda7e73e4b4eb52f7d","coverage":"full"}; Успешное Завершение Телом после общего окна Реакций накладывает Разорван на доступные цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Широкая дуга (Wide Arc) `powerhouse.dragonslayer.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Титанический замах [Передышка → Завершение Телом] (Titanic Heave [ Breathe → Body Finisher ]) `powerhouse.dragonslayer.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.dragonslayer.3` · `combo` · {"kind":"combo","sequenceKeys":["breathe","finish"],"actionKey":"finish","attribute":"body","allDiceSucceed":true,"postPush":2,"postSelfEffects":["Ослаблен"],"sourceLevelId":"powerhouse.dragonslayer.3","sourceDigest":"2ff4e5d3424564bbc5f46de9fc2a2ca411701d14a1c94fa9c7bb67e13791886b","coverage":"full"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Дуэлянт (Duelist) `powerhouse.duelist`

#### 1. Ответный выпад [Блок → Стычка] (Riposte [ Block → Skirmish ]) `powerhouse.duelist.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Парирование (Parry) `powerhouse.duelist.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.duelist.2` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"6ac5d7c737f81f4ba33f9a649d3bdfae9c2627d6420540f72f9626c53efb0827","sourceLevelId":"powerhouse.duelist.2"}; Блок получает авторитетное Напряжение дополнительной Бронёй. Незакрыто: условие смежного атакующего, Ошеломление и толчок вместо владельца..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Отбивающий удар (Deflecting Blow) `powerhouse.duelist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Самобичеватель (Flagellant) `powerhouse.flagellant`

#### 1. Азарт (Thrill) `powerhouse.flagellant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Дикий рывок (Wild Rush) `powerhouse.flagellant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Обескровлен (Bled Dry) `powerhouse.flagellant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Стрелок (Gunslinger) `powerhouse.gunslinger`

#### 1. Большой ствол (Big Iron) `powerhouse.gunslinger.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.gunslinger.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"bullets","resourceLabel":"Пули","initial":6,"replaces":["focus"],"coverage":"partial"}; Пули сохраняются и изменяются событиями ядра; Стычка проверяет минимум, дальность и явное распределение дополнительных Пуль..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** До повторного аудита Стычка ошибочно принимала пустые клетки, хотя канон требует персонажей; исправлено отдельной валидацией, статус остаётся partial до полного пользовательского пути.

#### 2. Зарядить и взвести (Lock And Load) `powerhouse.gunslinger.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.gunslinger.2` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.gunslinger.2","sourceDigest":"6559e6a6b597f579ef43c6b7b20e4a6d92659d2b41de8338239a7059df0694ea","coverage":"partial"}; Стычки получают постоянное Преимущество; Ход без Атаки предлагает выставить Пули на 6..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Жонглирование пулями (Bullet Juggle) `powerhouse.gunslinger.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.gunslinger.3` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.gunslinger.3","sourceDigest":"fd9e3d44ce0f4c8bcff8c3b316c54ed304a10be26073d9242cbbe17f141f5950","coverage":"full"}; Одиночная Стычка за 3+ Пули автоматически накладывает Подброшен после разрешения Реакций..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Борец (Struggler) `powerhouse.struggler`

#### 1. Усилие (Effort) `powerhouse.struggler.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `dice-hooks`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Адреналин (Adrenaline) `powerhouse.struggler.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Вопреки разуму (Defy Reason) `powerhouse.struggler.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Магический мечник (SpellSword) `powerhouse.spellsword`

#### 1. Два солнца [Заклинание → Стычка] (Twin Suns [ Cast → Skirmish ]) `powerhouse.spellsword.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `action-copy`.

#### 2. Зачарованное лезвие (Infused Edge) `powerhouse.spellsword.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.spellsword.2` · `teleport` · {"kind":"teleport","range":3,"timing":"beforeTargets","coverage":"partial"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Охотник на ведьм [Заклинание → Завершение Телом/Талантом] (Witch Hunter [ Cast → Body/Talent Finisher ]) `powerhouse.spellsword.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.spellsword.3.foundation` · `foundation` · {"kind":"foundation","foundation":"action-history","scope":"turn","actionKeys":["spell"],"sourceLevelId":"powerhouse.spellsword.3","sourceDigest":"ee60afad76ec4020051636adcbc32a8f8bc62e440b38b523e8e0386f73868f44","coverage":"full"}; Ядро находит непосредственно предыдущее Заклинание и его цели; комбо проверяет Завершение Телом/Талантом по тем же целям и добавляет Дух к урону.<br>`powerhouse.spellsword.3` · `combo` · {"kind":"combo","sequenceKeys":["spell","finish"],"actionKey":"finish","attributes":["body","talent"],"sameTargets":true,"bonusDamageAttribute":"spirit","sourceLevelId":"powerhouse.spellsword.3","sourceDigest":"ee60afad76ec4020051636adcbc32a8f8bc62e440b38b523e8e0386f73868f44","coverage":"full"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Техник (Technician) `powerhouse.technician`

#### 1. Разминка (Stretch) `powerhouse.technician.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.technician.1` · `passive` · {"kind":"passive","sourceDigest":"79946bc3df6de994901a8519030345403e62c0fac627a76aaa8bc0ee45edda83","sourceLevelId":"powerhouse.technician.1","coverage":"partial"}; Авторитетная Зарядка создаёт одноразовое окно до конца следующего собственного Хода; завершённое Skirmish → Finisher даёт 1 ОД. События и срок ведёт общий scheduler..
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Идеальная форма (Perfect Form) `powerhouse.technician.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.technician.2` · `passive` · {"kind":"passive","sourceDigest":"87d635215f2088e683f229d48bc51b0f2bc34d6a88bc1dea707fcea12e4be250","sourceLevelId":"powerhouse.technician.2","coverage":"partial"}; После авторитетно завершённого Skirmish → Finisher выдаётся Tier/2 Брони до начала следующего собственного Хода..
- **Готовые foundations:** `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Последний удар [Стычка → Завершение] (Final Blow [ Skirmish → Finisher ]) `powerhouse.technician.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.technician.3` · `combo` · {"kind":"combo","sourceDigest":"69e9007f8f65def64ef7640b8441616852def68765ad7a717f09587b1039ecfe","sequenceKeys":["skirmish","finish"],"actionKey":"finish","apCost":1,"postPush":3,"sourceLevelId":"powerhouse.technician.3","coverage":"partial"}.
- **Готовые foundations:** `resource-check`, `action-modifier`, `action-history`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Несломленный (Unbroken) `powerhouse.unbroken`

#### 1. Встать снова (Get Back Up) `powerhouse.unbroken.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.unbroken.1` · `knockout-choice` · {"kind":"knockout-choice","coverage":"partial","sourceLevelId":"powerhouse.unbroken.1","sourceDigest":"52ba0087d2a15fd28046b031145f0604f7ef83c4bbdfce709c77d39ea167bda1"}; Окно Сопротивления из Выведения из боя тратит 1 Влияние, действует раз за Главу и блокирует получение Влияния до конца Сцены; stale/replay/ownership проверяются перед расходом..
- **Готовые foundations:** `resource-check`, `usage-limits`, `scene-lifecycle`, `choice-flow`, `duration-scheduler`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `duel-flow`.

#### 2. Яростное возрождение (Furious Revival) `powerhouse.unbroken.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Феникс (Phoenix) `powerhouse.unbroken.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.unbroken.3` · `knockout-continuation` · {"kind":"knockout-continuation","coverage":"partial","sourceLevelId":"powerhouse.unbroken.3","sourceDigest":"599936806cba9c44b00cf5223615e5fcef9b76ddb60b32144e0d8f03952aee08"}; После подтверждённого Встать снова открывается одно продолжение, устанавливающее Раны в 1; digest, chapter/scene, ownership и stale/replay границы авторитетны, ручной skip остаётся доступен..
- **Готовые foundations:** `resource-check`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `duel-flow`.

### Хвастун (Braggart) `powerhouse.braggart`

#### 1. Гордыня (Hubris) `powerhouse.braggart.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.braggart.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"powerhouse.braggart.pride","size":6,"initial":0,"coverage":"partial"}; Гордость получает сегменты от Атак низкими Атрибутами и попаданий без защитной Реакции; полные часы дают Преимущество..
- **Готовые foundations:** `rule-clock`, `trigger-router`, `reaction-window`, `scene-lifecycle`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Докажи, чего стоишь (Prove Yourself) `powerhouse.braggart.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.braggart.2` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.braggart.2","sourceDigest":"886d7077c31b4749f8cbb789b513d61ba11e78c401e49cfafd0028bd973385c4","coverage":"partial"}; При заполнении предлагается очистить часы и уменьшить их размер на 2, минимум до 2..
- **Готовые foundations:** `rule-clock`, `usage-limits`, `trigger-router`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Достойный противник (A Worthy Opponent) `powerhouse.braggart.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.braggart.3` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.braggart.3","sourceDigest":"a7862dd909d76331b9483d45114caf8e24b60193b2969226dcf16b30b540d0fd","coverage":"partial"}; Полученная Рана предлагает заполнить сегмент Гордости..
- **Готовые foundations:** `rule-clock`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** До повторного аудита prompt открывался от любой Раны, включая союзный/собственный источник; исправлена обязательная проверка вражеской команды. Нужны UI/network/save-load и stale/duplicate evidence.

### Картечник (Breacher) `powerhouse.breacher`

#### 1. Картечь (Buck Shot) `powerhouse.breacher.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.breacher.1` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.breacher.1","sourceDigest":"9e9680211a203830a82230d86136cc85108032eaea3655fc9e991129d2826af5","coverage":"full"}; Стычка получает дальность 4; выбранная одиночная цель в пределах 2 после успешной Атаки проходит обычные Реакции и затем отталкивается на 1 через общий post-hit displacement..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** До повторного аудита толчок срабатывал при ненулевом уроне от Напряжения даже без Успеха; исправлено отдельным requiresSuccess и negative regression.

#### 2. Из обоих стволов (Both Barrels) `powerhouse.breacher.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.breacher.2` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.breacher.2","sourceDigest":"d632e668fdf4e39e44c32cc7c36973f9272fcb04d36a611ebfe7c55be96c565c","coverage":"full"}; До Стычки при отсутствии Ослаблен можно включить режим: [Тело/2] Преимущества, удвоение толчка и Ослаблен после разрешения..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Уничтожение (Annihilate) `powerhouse.breacher.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.breacher.3` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.breacher.3","sourceDigest":"ddb18671a7bf29177c52af4b26a5bc35b6408dd125d75007abd25e547f2ac6b3","coverage":"partial"}; Завершение Телом получает дальность 3; режим Из обоих стволов может выбрать проверенную зону 2×2, смежную с владельцем, по всем персонажам зоны..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Боец с парным оружием (Dual Wielder) `powerhouse.dual-wielder`

#### 1. Парный удар (Twinned blow) `powerhouse.dual-wielder.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.dual-wielder.1` · `derived-action` · {"kind":"derived-action","coverage":"partial","sourceDigest":"ab0e66e627e16c102f6cd8ec4a2cd62a4aac0a45d4bffc9e5197a3f9dd326b13"}; После одиночной Стычки предлагается Флёрри по той же цели: фиксированный урон Телом/Талантом, доверенно считается Быстрой Стычкой и проходит обычные Реакции..
- **Готовые foundations:** `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Неистовый обстрел (Frenzied Barrage) `powerhouse.dual-wielder.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Разные клинки (Varied Blades) `powerhouse.dual-wielder.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Устрашитель (Intimidator) `powerhouse.intimidator`

#### 1. Жалкое зрелище ("Pathetic") `powerhouse.intimidator.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. С дороги ("Out Of My Way") `powerhouse.intimidator.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Глупцы и мертвецы ("Fools And Dead Men") `powerhouse.intimidator.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мастер боевых искусств (Martial Artist) `powerhouse.martial-artist`

#### 1. Искусство восьми молотов (Art Of The 8 Hammers) `powerhouse.martial-artist.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.martial-artist.1` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"powerhouse.martial-artist.1","sourceDigest":"5f4610235181dbccff56d2a15b161412018f62becc35812b1e911232e4af4a36"}; После Стычки или Завершения Телом/Талантом предлагается ровно один доступный follow up по цели этого действия; четыре варианта ограничены разом за Раунд и исключают доверенные weapon-tag Техники..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Состояние потока (Flow-State) `powerhouse.martial-artist.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.martial-artist.2` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"powerhouse.martial-artist.2","sourceDigest":"ffab119dac241453faa82dab8e20523afa694f42b997a24d13fdf4b7f16e9e83"}; Первая Стычка Хода Быстрая; после Восьми молотов предлагается фиксированный урон [Тело/2] или [Талант/2] по атакованной цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Бесконечные удары (Unlimited Blows) `powerhouse.martial-artist.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.martial-artist.3` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"powerhouse.martial-artist.3","sourceDigest":"8428fb10aec3237aa82ef24d052a5610a5f9701fa3576d9be06b9219dc23176c"}; Все атаки получают +1 Преимущество; критический бросок авторитетно открывает дополнительное срабатывание Восьми молотов..
- **Готовые foundations:** `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Монастырский воин (Monastic Warrior) `powerhouse.monastic-sage`

#### 1. Разум воплощённый (Mind Made Manifest) `powerhouse.monastic-sage.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.monastic-sage.1` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.monastic-sage.1","sourceDigest":"f1ff824c2299d7184c07c4bf6a212d3a2f8c40a914d18948ed0c1987059480cc","coverage":"full"}; Усиление даёт 2 Брони, а Ускорение — 2 расходуемых Уклонения в конце собственного Хода..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Покой среди хаоса (Calm Within Chaos) `powerhouse.monastic-sage.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.monastic-sage.2` · `passive` · {"kind":"passive","coverage":"full","foundation":"clock","clockId":"powerhouse.monastic-sage.balance","size":8,"initial":0,"sourceLevelId":"powerhouse.monastic-sage.2","sourceDigest":"68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60"}; Баланс заполняется после авторитетно записанного чередования Атаки и утилитарного Действия; в начале Хода выбор владельца может потратить сегмент на Усиление или Ускорение..
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `inventory`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Возвышенная невозмутимость (Sublime Equanimity) `powerhouse.monastic-sage.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.monastic-sage.3` · `passive` · {"kind":"passive","sourceLevelId":"powerhouse.monastic-sage.3","sourceDigest":"b12c0e7f1d63dd1217d15f64aa7f2fcb7bbfa649761b476eb5e0840bc36ba994","coverage":"partial"}; После Зарядки открывается частичное решение Медитации: проверяемо получает Уклонение, очищает Баланс и при полном Балансе даёт Фокус; телепортация и бесплатное Завершение остаются ручным продолжением..
- **Готовые foundations:** `resource-check`, `trigger-router`, `turn-lifecycle`, `choice-flow`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Копейщик (Lancer) `powerhouse.lancer`

#### 1. Пронзание (Pierce) `powerhouse.lancer.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.lancer.1` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"8591643bda0a61a4165679413af42b8b60a40ca90dc47dc5a9d6ee1c32a5e701","sourceLevelId":"powerhouse.lancer.1"}; Стычка и Завершение Телом получают дальность не ниже 2; дальностное Преимущество Стычки ограничено 3. Остальные детали выбора цели остаются в общем действии..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Фаланга (Phalanx) `powerhouse.lancer.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.lancer.2` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"bbc32f09a04b64473f2a4eaacdb4686a3827af112fa7b2737d5117fcc1975c1b","sourceLevelId":"powerhouse.lancer.2"}; Стычка и Завершение Телом получают дальность не ниже 3. Поражение всех противников между владельцем и целью остаётся ручным расширением..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Рука-пушка [Передышка → Стычка] (Cannon-Arm [ Breathe → Skirmish ]) `powerhouse.lancer.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.lancer.3` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"cf89959221bf368de82bf3bc9e6c4e2d64fd30d5b33a5095e355a6aa93aab5c0","sourceLevelId":"powerhouse.lancer.3"}; После авторитетной последовательности Передышка → Стычка дальность Стычки не ниже 4 и дальностное Преимущество может достигать 4. Зона, трудная местность и точный выбор последовательности остаются ручными..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Хищник (Predator) `powerhouse.predator`

#### 1. Тоска (Yearn) `powerhouse.predator.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Одержимость (Obsess) `powerhouse.predator.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline`, `derived-stats`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Поглощение (Envelop) `powerhouse.predator.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Импровизатор (Improvisational Fighter) `powerhouse.improvisational-fighter`

#### 1. И это сгодится ("This'll Do") `powerhouse.improvisational-fighter.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.improvisational-fighter.1.foundation` · `foundation` · {"kind":"foundation","foundation":"terrain","range":5,"types":["terrain","difficult","custom"],"coverage":"partial"}; Поиск, дальность, владение и Здоровье местности готовы; выбор между созданием и удалением пока подтверждает игрок..
- **Готовые foundations:** `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. А вот это больно! ("That One Hurts!") `powerhouse.improvisational-fighter.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Последнее средство (Last Resort) `powerhouse.improvisational-fighter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `dice-hooks`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Воинственный Вознесённый (Warring Ascendant) `powerhouse.warring-ascendant`

#### 1. Небесная рука (Heavenly Arm) `powerhouse.warring-ascendant.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.warring-ascendant.1` · `passive` · {"kind":"passive","coverage":"partial"}; Зарядка при Напряжении 2+ предлагает однократную трансформацию; массовый толчок и окончание формы при 0 Здоровья автоматизированы. Выбор и временное предоставление трёх уровней оружейной Техники пока требуют отдельного профиля..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `transformation`, `action-copy`.

#### 2. Эзотерические клинки (Esoteric Blades) `powerhouse.warring-ascendant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

#### 3. Святой меч, Пронзающий Небеса (Saintly Sword, Heaven Piercer) `powerhouse.warring-ascendant.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.warring-ascendant.3` · `area` · {"kind":"area","shape":"line","areaType":"attack","duration":"instant","adjacency":true,"coverage":"partial"}; Трансформация и Линия проверяются; потеря трансформации и дополнительный урон за каждую цель ещё не разрешаются полностью..
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `transformation`.

### Героический Вознесённый (Heroic Ascendant) `powerhouse.heroic-ascendant`

#### 1. Легендарный воин (Warrior Of Legend) `powerhouse.heroic-ascendant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`.

#### 2. Подвиг героя (Hero's Feat) `powerhouse.heroic-ascendant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`.

#### 3. Укрощённая сила (Mastered Strength) `powerhouse.heroic-ascendant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `reaction-window`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`.

## Бродяга (Vagabond)

### Воздушный мастер (Aerial Master) `vagabond.aerial-master`

#### 1. Парение (Soar) `vagabond.aerial-master.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.aerial-master.1.foundation` · `foundation` · {"kind":"foundation","foundation":"stance","stanceId":"vagabond.aerial-master.flight","requiredEffects":["positive.ускорен"],"coverage":"partial"}; Условие входа в Стойку полёта и конфликт с другой Стойкой вычисляются канонически..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `stance`, `terrain`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Охота (Hunt) `vagabond.aerial-master.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Падающий удар топором (Falling Ax Strike) `vagabond.aerial-master.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.aerial-master.3` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"vagabond.aerial-master.3","sourceDigest":"af9100fcba37294038c9e66fb6fd2aed9fb592bd0468468ebcce546b087bf3ac"}; В авторитетной Flight Stance по явному выбору заменяет пул Атаки на Скорость; снятие Ускорен и Launch цели остаются ручным продолжением..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `stance`, `trigger-router`, `action-modifier`, `dice-hooks`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Ассасин (Assassin) `vagabond.assassin`

#### 1. Засада (Ambush) `vagabond.assassin.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.assassin.1` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.assassin.1","sourceDigest":"e2e8e0aa3b195f4df4e15393490e95fe151ebcf62a28e16c75afd5684b2b75ca","coverage":"full"}; Первое действие после последнего Развертывания проверяется по журналу; только Скрыться становится бесплатным и игнорирует требования..
- **Готовые foundations:** `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: quickActionSources проверяет пустой журнал действий Сцены, а не первое действие после конкретного Развертывания.

#### 2. Ликвидация (Assassinate) `vagabond.assassin.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.assassin.2` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.assassin.2","sourceDigest":"6e95fe2767088e069f995f384a6e03856f26d428161dbd57efca1c03a5eda98f","coverage":"partial"}; Сохраняемый план разрешает отменяемое смежное появление; ядро повторно проверяет источник Исчезновения, клетку, цели и авторитетный бросок с [Ступень] Преимущества и критом на 5–6..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `composite-action`, `dice-hooks`.
- **Нужно добавить:** Заявление decision понижено до partial: composite plan покрывает появление и отмену, но ядро принимает готовый roll и не добавляет/не валидирует [Ступень] Преимущества и крит на 5–6.

#### 3. Скорость тьмы [Скрыться → Шаг] (Speed of Dark [ Hide → Stride ]) `vagabond.assassin.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.assassin.3` · `combo` · {"kind":"combo","sequenceKeys":["disappear","step"],"actionKey":"step","apCost":0,"selfEffect":"Невидим","sourceLevelId":"vagabond.assassin.3","sourceDigest":"0a28c9c9cc800d859e9f2352923ece0aa23754cc12541124234b16400378c1c1","coverage":"full"}.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `action-modifier`, `action-history`.
- **Нужно добавить:** Канонический Hide → Stride теперь проверяется ядром: бесплатный Шаг, Невидим и [Скорость/2] к следующему Завершению в этот Ход; происхождение последовательности и digest обязательны.

### Снайпер (Sniper) `vagabond.sniper`

#### 1. Дальний выстрел (Long Shot) `vagabond.sniper.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.sniper.1` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"a84de0a68e37fcfc0bd9e9f2b31d19f5f09d686294b82e40138d26e0ed6ba8e8","sourceLevelId":"vagabond.sniper.1"}; Завершение Талантом получает дальность не ниже 5 через общий конвейер дальности..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Окопаться (Bunker Down) `vagabond.sniper.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.sniper.2` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"e154b6164f886770be2bb7a63a6a86bd7be83a88967eecaeb1f801b631874767","sourceLevelId":"vagabond.sniper.2"}; При авторитетной Обездвиженности Завершение Талантом получает ещё 5 дальности. Вход в Обездвиженность и крит на 5–6 остаются ручными..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`, `spatial-range`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Меткий глаз [Скрыться → Завершение Талантом] (Deadeye [ Hide → Talent Finisher ]) `vagabond.sniper.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Застрельщик (Skirmisher) `vagabond.skirmisher`

#### 1. Укол (Sting) `vagabond.skirmisher.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.skirmisher.1` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"vagabond.skirmisher.1","sourceDigest":"a14b57ddcf585e19b76a19e20b3ab1dc5190a59a5b044ed5df6d0bc2141a503e"}; После авторитетного движения Страйдом предлагается один фиксированный Тычок по смежной цели раз за собственный Ход..
- **Готовые foundations:** `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Смещающиеся удары (Shifting Blows) `vagabond.skirmisher.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.skirmisher.2` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"vagabond.skirmisher.2","sourceDigest":"ea74421d17b94486eaedb08b78d461b42ac4eaba89e27430ed74ce015285adc7"}; После Стычки предлагается проверяемое прямолинейное движение до 2 клеток; выбор и маршрут проходят общей поверхностью движения..
- **Готовые foundations:** `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Отскок (Rebound) `vagabond.skirmisher.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.skirmisher.3` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"vagabond.skirmisher.3","sourceDigest":"4933347df61d45014a553af1c97f078e20ee677081e433464ba9c96726513c61"}; Стычки получают 1 Преимущество; после движения от Стычки предлагается фиксированный Тычок по персонажу, не атакованному в этом Ходу..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Демон скорости (Speed Demon) `vagabond.speed-demon`

#### 1. Уход в тень (Fade) `vagabond.speed-demon.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Мгновенный удар (Flash Strike) `vagabond.speed-demon.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.speed-demon.2` · `combo` · {"kind":"combo","sequenceKeys":["breathe","step"],"actionKey":"step","movementMultiplier":3,"sourceLevelId":"vagabond.speed-demon.2","sourceDigest":"0365cfb5ae901e4cac9e6571651dc2a256170a13afb47a2077b1c785eb368b62","coverage":"full"}.
- **Готовые foundations:** `movement-lifecycle`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Мгновенный шаг [Передышка → Шаг] (Flash Step [ Breathe → Stride ]) `vagabond.speed-demon.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Неуловимый (Untouchable) `vagabond.untouchable`

#### 1. Нырок (Duck) `vagabond.untouchable.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.untouchable.1` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"348244d9362ed86da47559403a2fd0f22afb93a9647db589007e8ff203c8a26a","sourceLevelId":"vagabond.untouchable.1"}; Первый Уворот за Раунд получает авторитетные +Талант Уклонения. Событие первого Уворота и обычное расходование Уклонения ведёт ядро..
- **Готовые foundations:** `usage-limits`, `trigger-router`, `turn-lifecycle`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Маятник (Weave) `vagabond.untouchable.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.untouchable.2` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"abd33cfc8f9dfb48eaf90234e99044a1f3c16d2d99d527286e6dd14c52d7433e","sourceLevelId":"vagabond.untouchable.2"}; Уворот получает +1 к дальности движения. Повторное движение после снижения урона до 0 остаётся решением игрока..
- **Готовые foundations:** `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `derived-stats`.
- **Нужно добавить:** До повторного аудита повторный Dodge предлагался при любом итоговом нуле, даже если Evasion не поглотило урон; исправлено требование `evaded > 0` и добавлен zero-damage regression.

#### 3. Инстинкт бойца [Уворот → Стычка] (Fighter's Instinct [ Dodge → Skirmish ]) `vagabond.untouchable.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Акробат (Acrobat) `vagabond.acrobat`

#### 1. Летящий удар ногой [Прыжок → Стычка] (Flying Kick [ Jump → Skirmish ]) `vagabond.acrobat.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Отскок от стены (Wall Jump) `vagabond.acrobat.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Невесомое тело (Weightless Body) `vagabond.acrobat.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мастер клинка (Blade Master) `vagabond.blade-master`

#### 1. Стойка выхвата (Draw Stance) `vagabond.blade-master.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `stance`, `trigger-router`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Рассечение одним движением [Передышка → Прыжок] (Divide In One Motion [ Breathe → Jump ]) `vagabond.blade-master.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `stance`, `trigger-router`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Прыгающий карп (Leaping Koi) `vagabond.blade-master.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Хитроумный боец (Cunning Fighter) `vagabond.cunning-fighter`

#### 1. План и исполнение (Plan and Execute) `vagabond.cunning-fighter.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.cunning-fighter.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"vagabond.cunning-fighter.plan","size":4,"initial":0,"sourceLevelId":"vagabond.cunning-fighter.1","sourceDigest":"4373bc4971b0d11b0adce5ad6d070e9012c97e4acb27f45a34b8d28b89b6b421","coverage":"partial"}; Новая цель Изучения заполняет Хитрый план; интерфейс явно предлагает потратить сегмент на Быстрое действие не-Атаки..
- **Готовые foundations:** `target-validation`, `event-participants`, `rule-clock`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `action-modifier`, `information-query`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Планы внутри планов (Plans Within Plans) `vagabond.cunning-fighter.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.cunning-fighter.2` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.cunning-fighter.2","sourceDigest":"cad73b94a9ce468c18309a11ba6a7a84fe70d3ff1ed249e230d1b54b8977fcfd","coverage":"full"}; Снято ограничение одного «Плана и исполнения» за Ход..
- **Готовые foundations:** `usage-limits`, `turn-lifecycle`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. С первого взгляда (At a Glance) `vagabond.cunning-fighter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Эгоманьяк (Egomaniac) `vagabond.egomaniac`

#### 1. Пиковая форма (Peak Condition) `vagabond.egomaniac.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.egomaniac.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"vagabond.egomaniac.style","size":4,"initial":0,"sourceLevelId":"vagabond.egomaniac.1","sourceDigest":"66869802f1ffd549e82f6a842b7d5739add130943a9aafd252064abdadeb83fe","coverage":"partial"}; Четыре условия заполняют Стиль, попадание очищает сегмент, а полные часы запускают получение ОД и выбор прямого перемещения..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** До повторного аудита условие «Танец» принимало любое недавнее перемещение при текущей смежности; теперь требуется переход предыдущим действием из несмежной клетки в смежность. Добавлен отрицательный regression для adjacent→adjacent.

#### 2. Потанцуй со мной (Dance With Me) `vagabond.egomaniac.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.egomaniac.2` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.egomaniac.2","sourceDigest":"6e1526c365b7cee6ba44e603d7a09ce62ed4c4431deff0c26b1e55e9aaf02b0e","coverage":"partial"}; При заполнении Стиля можно отказаться от ОД и выбрать массовый Спровоцирован или Испуган для врагов в пределах 3..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `rule-clock`, `trigger-router`, `choice-flow`, `effect-state`, `effect-lifecycle`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Финал (Finale) `vagabond.egomaniac.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.egomaniac.3` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.egomaniac.3","sourceDigest":"9cd1b25dc6fbaab0efb398dfa3640f953ddf643cad4574b2941f91e44531c5be","coverage":"partial"}; Зарядка предлагает распределить удвоенное Напряжение через любое число заполнений Стиля, разрешает каждый итог и затем отключает Стиль до конца Сцены..
- **Готовые foundations:** `rule-clock`, `trigger-router`, `choice-flow`, `scene-lifecycle`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Скованный (Enchained) `vagabond.enchained`

#### 1. Выстрел крюком (Hook Shot) `vagabond.enchained.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.enchained.1` · `equidistant-teleport` · {"kind":"equidistant-teleport","range":5,"sourceLevelId":"vagabond.enchained.1","sourceDigest":"014b9edb50b008efb13865734553ef7cfc44c532e46c8deaef2be5858d8b654b","coverage":"full"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Притянуть (Draw In) `vagabond.enchained.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Импульс [Заклинание → Стычка] (Momentum [ Cast → Skirmish ]) `vagabond.enchained.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Жонглёр ножами (Knife Juggler) `vagabond.knife-juggler`

#### 1. Метнуть (Throw) `vagabond.knife-juggler.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.knife-juggler.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"weapons","resourceLabel":"Оружие","initial":4,"replaces":["focus"],"coverage":"partial"}; Метание тратит 1 Оружие, обнуляет стоимость Стычки и меняет выбор цели и дальность..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Пополнение (Resupply) `vagabond.knife-juggler.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.knife-juggler.2` · `passive` · {"kind":"passive","coverage":"partial"}; После Метания создаётся маркер Оружия; вход предлагает подобрать его, получить Оружие и переместиться. Незакрыто: канонический выбор свободной смежной клетки вместо клетки цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Маркер ставится только в клетку цели; канонический выбор свободной смежной клетки отсутствует.

#### 3. Преследователь (Chaser) `vagabond.knife-juggler.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.knife-juggler.3` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.knife-juggler.3","sourceDigest":"ef1b46f397efd2b243cfbef7c9f750bc764a54d80850232d0731dc2e443e7554","coverage":"partial"}; Выход врага из клетки маркера предлагает телепортацию и оплаченную Быструю Стычку без Метания..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Злобный подражатель (Malicious Mimic) `vagabond.malicious-mimic`

#### 1. «Всё, что можешь ты…» ("Anything You Can Do…") `vagabond.malicious-mimic.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `inventory`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `action-copy`.

#### 2. Отрепетированные движения (Rehearsed Movements) `vagabond.malicious-mimic.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `derived-stats`, `inventory`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. «…я могу лучше» ("…I Can Do Better") `vagabond.malicious-mimic.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `inventory`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `action-copy`.

### Оружейник (Weaponsmith) `vagabond.weaponsmith`

#### 1. Оружие с секретом (Trick Weapon) `vagabond.weaponsmith.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Адаптивное лезвие (Adaptive Edge) `vagabond.weaponsmith.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Металлургия (Metalurgy) `vagabond.weaponsmith.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Модифицированный мейстер (Modified Meister) `vagabond.modified-meister`

#### 1. На горячем ходу (Running Hot) `vagabond.modified-meister.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.modified-meister.1.foundation` · `foundation` · {"kind":"foundation","resource":"heat","resourceLabel":"Нагрев","initial":0,"replaces":["focus"],"coverage":"partial"}; Стоимость в Фокусе повышает Нагрев, получение Фокуса снижает его; порог 6, сброс до 3 и базовый взрыв разрешаются ядром..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `damage-pipeline`, `trigger-router`, `scene-lifecycle`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Перегрузка (Overload) `vagabond.modified-meister.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.modified-meister.2` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.modified-meister.2","sourceDigest":"35eb82acb41e4ebfc23b6526f3c99f1df43c4cb58fa8751c794567c218983f57","coverage":"partial"}; Явный выбор Перегрузки записывает Преимущество, Порчу целей и Нагрев за неуспешные кости после Реакций..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Разгон (Overclock) `vagabond.modified-meister.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.modified-meister.3` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.modified-meister.3","sourceDigest":"5d1b03eadd74852e075d160ea5844aa2c283616bd41f3ca58fbfbde5c5328d0a","coverage":"partial"}; Передышка при Напряжении 2+ предлагает Разгон; урон создаёт Нагрев, а взрыв предлагает альтернативное разрешение и перемещение..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Оппортунист (Opportunist) `vagabond.opportunist`

#### 1. Стайная тактика (Pack Tactics) `vagabond.opportunist.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.opportunist.1` · `derived-action` · {"kind":"derived-action","coverage":"partial","sourceDigest":"f0492855d27579faf8b5030f09909996a4248a7d2367d8b8805f3942ce0bd4e2"}; После Атаки союзника в доступной смежности предлагается одно бесплатное Быстрое производное Skirmish с фиксированной целью..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Голодные глаза (Hungry Eyes) `vagabond.opportunist.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Комбо-подброс (Launcher Combo) `vagabond.opportunist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Отражатель (Reflector) `vagabond.reflector`

#### 1. Поймать клинок (Catch The Blade) `vagabond.reflector.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `reaction-window`, `scene-lifecycle`, `damage-pipeline`, `choice-flow`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Смотреть и ждать (Watch And Wait) `vagabond.reflector.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `reaction-window`, `damage-pipeline`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Нести их ярость (To Carry Their Fury) `vagabond.reflector.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Детектив (Detective) `vagabond.dim-mak`

#### 1. Изучить слабость (Study Weakness) `vagabond.dim-mak.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.dim-mak.1` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.dim-mak.1","sourceDigest":"86bc2801b43ae4f2bd3de697124313b986e9ae1081e0dd8f3f52dfc44b097c59","coverage":"partial"}; Повторное и третье Изучение получают Быстроту по тексту уровня; после Изучения можно поставить привязанную к цели Слабую точку, а Атака с её клетки снимает маркер, становится Быстрой и использует Разум..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `information-query`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Вскрытие [Изучение × 3] (Dissect [ Investigate x 3 ]) `vagabond.dim-mak.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.dim-mak.2` · `passive` · {"kind":"passive","sourceLevelId":"vagabond.dim-mak.2","sourceDigest":"d63edd4d649fb29805706009934a7eb38427b2507f32b1d5632e881f7e24a5a2","coverage":"partial"}; Промах вражеской Атаки предлагает бесплатное Быстрое Изучение атакующего; снятие Слабой точки автоматически даёт 2 Уклонения..
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `information-query`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Казнь по четырём точкам (4-Point Execution) `vagabond.dim-mak.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Пьяница (Drunkard) `vagabond.drunkard`

#### 1. До дна (Down The Hatch) `vagabond.drunkard.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `deployment-hooks`.

#### 2. Танец дурака (Fool's Dance) `vagabond.drunkard.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.drunkard.2` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"73477795efb4e90b3c7bf8d17ed305b312f08703a0085672f72b5e0a869dde56","sourceLevelId":"vagabond.drunkard.2"}; После собственного Хода с авторитетным Замедлен Эффектом выдаётся временное Уклонение на начало следующего Хода; размер читает Ранг/2 и число отрицательных Эффектов. Обязательное движение первого уровня остаётся ручным..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Залпом (Chug) `vagabond.drunkard.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мастер оружия (Master-At-Arms) `vagabond.master-at-arms`

#### 1. Многогранность (Multi-Faceted) `vagabond.master-at-arms.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.master-at-arms.1` · `armament` · {"kind":"armament","coverage":"full","sourceDigest":"d35f468065e84fbb0c86bc60015632bdbcfe9b0ced2ed2cfa370453f64a72371","sourceLevelId":"vagabond.master-at-arms.1"}; Вооружение выбирается вместе со Стычкой; ядро проверяет дистанцию, число целей и повторное экипирование, хранит взаимоисключающий режим, затем ведёт перемещение, Эффекты и толчок. Каждое Вооружение ограничено одним разом за Ход..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `exclusive-mode`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Как вода (Like Water) `vagabond.master-at-arms.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.master-at-arms.2` · `passive` · {"kind":"passive","coverage":"full","sourceDigest":"743ae31f60f1a826d3346b6e07c7cff94983860c399cdc9484302e120fd726c4","sourceLevelId":"vagabond.master-at-arms.2"}; Второе экипирование за Ход автоматически даёт 1 ОД и Ускорен..
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `exclusive-mode`, `trigger-router`, `turn-lifecycle`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Мастер за работой (Master At Work) `vagabond.master-at-arms.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.master-at-arms.3` · `passive` · {"kind":"passive","coverage":"full","sourceDigest":"f104c7652bda2a425422af31d8d91b30515463c98f78892fe25eb204ac7508d3","sourceLevelId":"vagabond.master-at-arms.3"}; Только Завершение Талантом читает текущее авторитетное Вооружение: Клинок проверяет путь до 2 клеток, Древко строит Линию длиной 2, а Цепь строит 1×1 и расширяет её по проверенным Критам..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `terrain`, `exclusive-mode`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

## Оплот (Bulwark)

### Сокрушитель (Crusher) `bulwark.crusher`

#### 1. 30 000 тонн (30,000 Tons) `bulwark.crusher.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Молотопад (Hammerfall) `bulwark.crusher.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. «Ты похож на гвоздь» ("You Look Like A Nail") `bulwark.crusher.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Гигантская фигура (Giant Frame) `bulwark.giant-frame`

#### 1. Большие руки (Big Arms) `bulwark.giant-frame.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `bulwark.giant-frame.1` · `area` · {"kind":"area","shape":"square2","areaType":"attack","duration":"instant","adjacency":true,"optionMinimum":{"key":"focusSpent","value":1,"label":"дополнительно потрачено Фокуса"},"coverage":"partial"}; Зона, оплата и общий конвейер Атаки поддержаны; замена цели конкретного Завершения Телом ещё не связана атомарно..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Повторная сверка выявила грамматическое рассогласование «одно из этих клеток»; источник RU исправлен на «одна из этих клеток / смежна». Механическая partial-реализация по-прежнему не связана атомарно с Завершением Телом.

#### 2. Исполин (Immense) `bulwark.giant-frame.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `deployment-hooks`, `multi-space-actor`.

#### 3. Ударная волна (Shockwave) `bulwark.giant-frame.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Железное тело (Iron Bodied) `bulwark.iron-bodied`

#### 1. Твёрдый как камень (Tough As Stone) `bulwark.iron-bodied.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Стойкость (Resilience) `bulwark.iron-bodied.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `bulwark.iron-bodied.2` · `passive` · {"kind":"passive","sourceLevelId":"bulwark.iron-bodied.2","sourceDigest":"fa7b6c2676514b1bf9dfca34c58256d51ef5f80513957fd244784ba1e0b94344","coverage":"full"}; Броня автоматически включает [Тело / 2]..
- **Готовые foundations:** `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Нержавеющая поступь (Stainless Stride) `bulwark.iron-bodied.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `bulwark.iron-bodied.3` · `passive` · {"kind":"passive","coverage":"partial","sourceLevelId":"bulwark.iron-bodied.3","sourceDigest":"7726f5c94cfdfba228b739db1cad6221687af83bf183a7c16bed34afd5a6526f"}; После всех снижений итоговый урон ограничивается 4 + ceil(Ранг/2), если персонаж авторитетно Обездвижен; включение Обездвиженности и начало Хода остаются ручными..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `damage-pipeline`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Щит авангарда (Vanguard Defender) `bulwark.vanguard-defender`

#### 1. Белый рыцарь (White Knight) `bulwark.vanguard-defender.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Стальной ангел (Steel Angel) `bulwark.vanguard-defender.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Вдохновить мужество (Inspire Courage) `bulwark.vanguard-defender.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Полный ублюдок (Absolute Bastard) `bulwark.absolute-bastard`

#### 1. Легко ненавидеть (Easy To Hate) `bulwark.absolute-bastard.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Задира (Bully) `bulwark.absolute-bastard.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Сыпать соль на рану (Add Injury To Insult) `bulwark.absolute-bastard.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Боевой наездник (Battle Jockey) `bulwark.battle-jockey`

#### 1. Верный скакун (Trusty Steed) `bulwark.battle-jockey.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `deployment-hooks`.

#### 2. Цепкие челюсти (Grasping Jaws) `bulwark.battle-jockey.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`.

#### 3. Громогласное появление (Roaring Entry) `bulwark.battle-jockey.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `turn-lifecycle`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`.

### Борец-захватчик (Grappler) `bulwark.grappler`

#### 1. Удержание (Restrain) `bulwark.grappler.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Хребтолом (Spine Breaker) `bulwark.grappler.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `bulwark.grappler.2` · `passive` · {"kind":"passive","sourceLevelId":"bulwark.grappler.2","sourceDigest":"87e908315db54db355c6fa2e4c772f05a08a0fbd835cd50e6339ac034f66ff4d","coverage":"partial"}; Стычки получают 1 Преимущество. Для единственной Подброшенной цели можно выбрать составной модификатор: Вбить, телепортироваться в свободную смежную клетку и заменить Атаку на Завершение Телом по исходной Стоимости..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Завершающий приём [Завершение Телом → Прыжок] (Finishing Move [ Body Finisher → Jump ]) `bulwark.grappler.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `action-modifier`, `composite-action`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Джаггернаут (Juggernaut) `bulwark.juggernaut`

#### 1. Дикий натиск (Wild Charge) `bulwark.juggernaut.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Насилие (Violence) `bulwark.juggernaut.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. «Жри землю!» ("Eat Dirt!") `bulwark.juggernaut.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Нянька (Mollycoddler) `bulwark.runic-retribution`

#### 1. Плеть (Lash) `bulwark.runic-retribution.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `bulwark.runic-retribution.1` · `derived-action` · {"kind":"derived-action","coverage":"partial","sourceDigest":"4bf4aab119ae103e04dde891dc96daefe5cc02c06fcdd16308a24c09a07d3822"}; После попадания по союзнику за 1 Фокус предлагается бесплатное производное Заклинание по атакующему через общий roll/reaction lifecycle..
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Обряд любви (Loving Rite) `bulwark.runic-retribution.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Преданность (Devotion) `bulwark.runic-retribution.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `duration-scheduler`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Обычный (Mundane) `bulwark.mundane`

#### 1. Чего не хватает духу (For What The Spirit Lacks) `bulwark.mundane.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `bulwark.mundane.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"grit","resourceLabel":"Упорство","initialFormula":"1 + ceil(body / 2)","replaces":["focus","ap"],"coverage":"partial"}; Общий запас оплачивает Фокус и ОД, округляет [Тело / 2] вверх, сбрасывается в начале Раунда; Передышка и Зарядка не пополняют его..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `turn-lifecycle`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** До повторного аудита `[Тело / 2]` ошибочно округлялось вниз, вопреки общему правилу Always Round Up (PDF-стр. 22); исправлено на `ceil` и закреплено нечётным Body regression.

#### 2. Копай глубже, стой крепче (Dig Deep, Stand Firm) `bulwark.mundane.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `bulwark.mundane.2` · `passive` · {"kind":"passive","sourceLevelId":"bulwark.mundane.2","sourceDigest":"9f2acd96734496115e4336cfba21ae1002107d282e903cc9e9a76fa209b81410","coverage":"full"}; Получение предложения Реакции как цели Атаки даёт 1 Упорство..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `trigger-router`, `reaction-window`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Перед лицом потустороннего (In The Face Of The Beyond) `bulwark.mundane.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `bulwark.mundane.3` · `passive` · {"kind":"passive","sourceLevelId":"bulwark.mundane.3","sourceDigest":"c9c11d54ab21f1dcfcab8dd1fa3905c278a6ceab4f057c7507f5b2e152421e77","coverage":"partial"}; Передышка и Зарядка принимают явный список целей Спровоцированного в пределах 4 и ограничивают его несостоявшимся получением Фокуса..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Восходящий претендент (Rising Challenger) `bulwark.rising-challenger`

#### 1. Идеальное отражение (Perfect Deflection) `bulwark.rising-challenger.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. «Сначала пройди через меня!» ("You'll Have To Get Through Me!") `bulwark.rising-challenger.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Драма и злоба (Drama And Spite) `bulwark.rising-challenger.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `bulwark.rising-challenger.3` · `passive` · {"kind":"passive","sourceLevelId":"bulwark.rising-challenger.3","sourceDigest":"e9655fd8cbbaab4e8119a75716013a6ac3aec744c098de9d0d9e404cd7cf6d41","coverage":"full"}; В бросок Столкновения автоматически добавляются 3 кости..
- **Готовые foundations:** `dice-hooks`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Щитоносец (Shield Bearer) `bulwark.shield-bearer`

#### 1. Стена (Wall) `bulwark.shield-bearer.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Натиск щитом (Shield Charge) `bulwark.shield-bearer.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Сосредоточенная оборона (Focused Defense) `bulwark.shield-bearer.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Стойкий часовой (Stalwart Sentry) `bulwark.stalwart-sentry`

#### 1. Страж (Guardian) `bulwark.stalwart-sentry.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `trigger-router`, `turn-lifecycle`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. На страже (On Watch) `bulwark.stalwart-sentry.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `bulwark.stalwart-sentry.2.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"bulwark.stalwart-sentry.vigilance","size":4,"initial":4,"sourceLevelId":"bulwark.stalwart-sentry.2","sourceDigest":"11c89e120a37e64ba570b3bb664bf52f056ebca5ad3e83046100c00952bb8d67","coverage":"partial"}; Выход врага из смежности открывает Наказание с обычной оплатой либо очисткой Бдительности; бросок, Реакции и отмена проходят через общий конвейер..
- **Готовые foundations:** `resource-check`, `rule-clock`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Зона контроля (Zone Of Influence) `bulwark.stalwart-sentry.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Звериный Вознесённый (Bestial Ascendant) `bulwark.beastial-ascendant`

#### 1. Звериная сущность (Beastly) `bulwark.beastial-ascendant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

#### 2. Наследие (Inheritance) `bulwark.beastial-ascendant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

#### 3. Вершина (Apex) `bulwark.beastial-ascendant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

### Ангел-хранитель (Guard Caller) `bulwark.guardian-angel`

#### 1. Два тела (Two Bodies) `bulwark.guardian-angel.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `multi-space-actor`.

#### 2. Вместе при жизни (Together In Life) `bulwark.guardian-angel.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Вместе в смерти (Together In Death) `bulwark.guardian-angel.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `multi-space-actor`.

### Пилот меха (Mecha Pilot) `bulwark.mecha-pilot`

#### 1. Двигатель с руническим ядром (Rune Core Engine) `bulwark.mecha-pilot.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `multi-space-actor`.

#### 2. Автономность (Autonomous) `bulwark.mecha-pilot.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `multi-space-actor`.

#### 3. Идеальная синхронизация (Perfect Sync) `bulwark.mecha-pilot.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `multi-space-actor`.

## Альтруист (Altruist)

### Предвидящий (Analyst) `altruist.precognizant`

#### 1. Вспышка озарения (Flash Of Insight) `altruist.precognizant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `scene-lifecycle`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Использовать преимущество (Take Advantage) `altruist.precognizant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Смотреть и ждать (Watch And Wait) `altruist.precognizant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Боевой инструктор (Battle Instructor) `altruist.battle-instructor`

#### 1. Приказ атаковать (Strike Order) `altruist.battle-instructor.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Поучительный момент (Teaching Moment) `altruist.battle-instructor.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `reaction-window`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `bond-actions`.

#### 3. Помни, чему тебя учили (Remember Your Training) `altruist.battle-instructor.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `bond-actions`.

### Эмпат (Empath) `altruist.empath`

#### 1. Успокаивающая аура (Calming Aura) `altruist.empath.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.empath.1` · `passive` · {"kind":"passive","sourceLevelId":"altruist.empath.1","sourceDigest":"42f17ac72dc89e094821759adde23e71d12a63da1f41caf44424b63b49b03557","coverage":"partial"}; В начале Хода союзника стол предлагает снять один выбранный Эффект и наложить Усилен..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Защитная реакция (Protective Response) `altruist.empath.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.empath.2` · `passive` · {"kind":"passive","sourceLevelId":"altruist.empath.2","sourceDigest":"da8df2484b2ddad6fe56569848bd88938700e4ae11006dbc9bd8475512d364c7","coverage":"partial"}; После внешней Раны или Эффекта стол предлагает бесплатный Прорыв в смежную клетку..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** До повторного аудита самонанесённая Рана открывала Protective Response, хотя канон исключает source=self; добавлена проверка источника и отрицательный regression.

#### 3. «Ты в порядке?» ("Are You Ok?") `altruist.empath.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `altruist.empath.3` · `passive` · {"kind":"passive","coverage":"full","sourceLevelId":"altruist.empath.3","sourceDigest":"4473ee348631cf63dd51750aca3869aac5f3abb159e490f4b390407c8ac61f73"}; На начале Хода союзника рядом адаптер ядра автоматически даёт 3 Фокуса и восстанавливает [Ступень] Здоровья; отдельный платный Support-путь удалён, чтобы исключить двойное применение..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `action-modifier`.
- **Нужно добавить:** Каноническая passive boundary-ветка автоматически выдаёт соседнему союзнику 3 Фокуса и [Ступень] Здоровья в начале его Хода; прежний платный Support-путь удалён во избежание двойного применения.

### Небесный святой (Compassionate Sage) `altruist.heavenly-saint`

#### 1. Сила молитвы (Strength Of Prayer) `altruist.heavenly-saint.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.heavenly-saint.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"faith","resourceLabel":"Вера","initialFormula":"spirit","replaces":["focus"],"coverage":"partial"}; Вера начинается с Духа, не пополняется Передышкой/Зарядкой и растёт при выборе союзника целью..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Очищающий свет (Cleansing Light) `altruist.heavenly-saint.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.heavenly-saint.2` · `passive` · {"kind":"passive","sourceLevelId":"altruist.heavenly-saint.2","sourceDigest":"14cf0fe056a45cc38001948ffa75ea257b21e532012f2b0708f7bc9f2fdd1de1","coverage":"partial"}; Заклинание по союзникам использует лечебное разрешение и явный выбор снимаемых Эффектов..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** До повторного аудита лечение `[Успехи / 2]` ошибочно округлялось вниз; исправлено на Always Round Up и закреплено regression с 3 Успехами → 2 лечения.

#### 3. Великое восстановление (Grand Restoration) `altruist.heavenly-saint.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.heavenly-saint.3` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"5f42cdf622ce588debfafa058a85655946db0c400a1e925653fec9b6d0568e51","sourceLevelId":"altruist.heavenly-saint.3"}; Духовное Завершение получает дальность 5 через общий числовой конвейер; лечение, Регенерация и снятие Раны остаются решением Техники..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Гурман (Gourmand) `altruist.gourmand`

#### 1. Полезная еда (Healthy Meal) `altruist.gourmand.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `damage-pipeline`, `inventory`, `trigger-router`, `intermission-reset`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Фастфуд (Fast Food) `altruist.gourmand.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `altruist.gourmand.2` · `passive` · {"kind":"passive","sourceLevelId":"altruist.gourmand.2","sourceDigest":"84ec37d54af70332e7bb2f4ed402265d3514db190bc24b400016b9444b4b8ce7","coverage":"full"}; Запас Трапез автоматически равен 3 за Интермиссию..
- **Готовые foundations:** `inventory`, `intermission-reset`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Общий опыт (Shared Experiences) `altruist.gourmand.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `inventory`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `bond-actions`.

### Хирург (Surgeon) `altruist.surgeon`

#### 1. Не навреди (Do No Harm) `altruist.surgeon.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.surgeon.1` · `surgery` · {"kind":"surgery","coverage":"partial"}; Смежный союзник, стоимость и округлённое вверх лечение работают, но ядро принимает готовые successes и не доказывает обязательный бросок Разума..
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Заявление full понижено до partial: core проверяет наличие массива rolls, но доверяет присланным successes и не доказывает обязательный бросок Разума.

#### 2. Порядок операции (Operational Procedure) `altruist.surgeon.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `intermission-reset`, `choice-flow`, `damage-pipeline`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Чудотворец (Miracle Worker) `altruist.surgeon.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `inventory`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мастер тактики (Tactical Master) `disruptor.tactical-master`

#### 1. Остановись и подумай (Stop And Think) `disruptor.tactical-master.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `stance`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Изучение (Study) `disruptor.tactical-master.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Эврика! (Eureka!) `disruptor.tactical-master.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `stance`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Заклинатель талисманов (Talisman Exorcist) `altruist.talisman-caster`

#### 1. Священная печать (Sacred Seal) `altruist.talisman-caster.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Брошенный талисман (Tossed Talisman) `altruist.talisman-caster.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `spatial-range`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Изгнание (Exorcize) `altruist.talisman-caster.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мудрец ограждения (Abjuring Sage) `altruist.abjuring-sage`

#### 1. Барьер (Barrier) `altruist.abjuring-sage.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Непроницаемость (Impenetrable) `altruist.abjuring-sage.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Блокирующий луч (Block Beam) `altruist.abjuring-sage.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Алхимик (Alchemist) `altruist.alchemist`

#### 1. Быстрая смесь (Quick Mix) `altruist.alchemist.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.alchemist.1` · `inventory` · {"kind":"inventory","sourceLevelId":"altruist.alchemist.1","sourceDigest":"594587d26d665ad38373fdd84fa54af81997e642829129d8c17cd46dc5d28bb9","coverage":"partial"}; Передышка опционально создаёт один из канонических типов; Взаимодействие проверяет запас и дальность, а Чистая вода выбирает любое подмножество Эффектов до оплаты и расхода Зелья..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: Чистая вода удаляет все Эффекты без канонического выбора любого подмножества. Опциональный отказ от создания Зелья и запрет неканонических типов добавлены при повторном аудите.

#### 2. Мощная смесь (Powerful Mix) `altruist.alchemist.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.alchemist.2` · `passive` · {"kind":"passive","sourceLevelId":"altruist.alchemist.2","sourceDigest":"389ef1a54fb172ceaff075d3155b697ae17d25ad138ea4854d38d515db1333ea","coverage":"partial"}; Союзник автоматически получает ceil(Разум/2) Фокуса; для врага после фактического использования Зелья открывается перепроверяемый выбор нанести Разум урона или отказаться..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Урон зельем по врагу применяется обязательно, хотя канон требует опциональный выбор.

#### 3. Смесь высокой интенсивности (High Intensity Mix) `altruist.alchemist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Танцор (Dancer) `altruist.dancer`

#### 1. Партнёр по танцу (Dance Partner) `altruist.dancer.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Сердца в унисон (Hearts In Tandem) `altruist.dancer.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Престиж (The Prestige) `altruist.dancer.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Ходящий в тумане (Fog Walker) `altruist.fog-walker`

#### 1. Пустить дым (Blowing Smoke) `altruist.fog-walker.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `composite-action`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Мистическая дымка (Mystic Mist) `altruist.fog-walker.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `derived-stats`, `composite-action`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Жалящий пар (Stinging Steam) `altruist.fog-walker.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Последняя надежда (Last Hope) `altruist.last-hope`

#### 1. Заметное отсутствие (Notably Absent) `altruist.last-hope.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Героическое возвращение (Heroic Return) `altruist.last-hope.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Взрывное возвращение (Explosive Return) `altruist.last-hope.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `reaction-window`, `turn-lifecycle`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Репликатор (Replicator) `altruist.replicator`

#### 1. Форма эха (Echo Form) `altruist.replicator.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Симметрия (Symmetry) `altruist.replicator.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Полная синхронизация (Full Sync) `altruist.replicator.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Хрономант (Temporal Sage) `altruist.chronomancer`

#### 1. Ускорение (Accelerate) `altruist.chronomancer.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Замедление (Decelerate) `altruist.chronomancer.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.chronomancer.2` · `passive` · {"kind":"passive","sourceLevelId":"altruist.chronomancer.2","sourceDigest":"bab452f231f9a7c7c0ee1777945bb658db08a587663551cdcb857ccb1b3f5105","coverage":"partial"}; Заклинания получают 1 Преимущество; удаление Эффекта открывает перепроверяемое окно повторного применения за 1 Фокус..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Реестр заявлял manual, хотя core уже выдаёт 1 Преимущество Заклинаниям и ведёт prompt повторного применения снятого Эффекта за 1 Фокус; добавлен честный decision-adapter. Полный surface evidence отсутствует.

#### 3. Остановка времени (Time Stop) `altruist.chronomancer.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.chronomancer.3.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"altruist.chronomancer.flow","size":8,"initial":0,"sourceLevelId":"altruist.chronomancer.3","sourceDigest":"fe9f7c35921e35add383a6125039a427cb00110764b1b3f021a4e616e18f890b","coverage":"partial"}; Полный Поток в начале Хода предлагает однократное массовое Заклинание, тратит все ОД и поддерживает Ва-банк с Раной и Завершением против врагов..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `duel-flow`.

### Виртуоз (Virtuoso) `altruist.bardic-savant`

#### 1. Музыкант (Musician) `altruist.bardic-savant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `inventory`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Реверберация (Reverb) `altruist.bardic-savant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `inventory`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. На бис (Encore) `altruist.bardic-savant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `inventory`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Художник (Artist) `altruist.artist`

#### 1. Взмах кисти (Stroke Of The Brush) `altruist.artist.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Холст из плоти (Canvas Of Flesh) `altruist.artist.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Клеймо кисти (Brush-Brand) `altruist.artist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Сборщик колоды (Deckbuilder) `altruist.deckbuilder`

#### 1. Добор (Draw) `altruist.deckbuilder.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `inventory`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Захват карты (Card Capture) `altruist.deckbuilder.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `inventory`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Жадность (Greed) `altruist.deckbuilder.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `inventory`, `usage-limits`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Блуждающий огонёк (Will-O-Wisp) `altruist.will-o-wisp`

#### 1. Пламя духовного плетения (Spirit Weaving Flame) `altruist.will-o-wisp.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.will-o-wisp.1` · `passive` · {"kind":"passive","sourceLevelId":"altruist.will-o-wisp.1","sourceDigest":"718c1072bf9fb744208642697c7e52e01925efc76cb61a9e04e7a5bf85789c30","coverage":"partial"}; Изученный тип Духа сохраняется в листе и импорте; первая Зарядка создаёт Пламя, а Атака по его клетке обязательно толкает маркер на 1..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `scene-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Заявление decision понижено до partial: первая Зарядка, аура и выбранное движение есть, но Пламя не толкается на 1 клетку, когда Атака выбирает целью его клетку.

#### 2. Дружелюбные духи (Friendly Spirits) `altruist.will-o-wisp.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.will-o-wisp.2` · `passive` · {"kind":"passive","sourceLevelId":"altruist.will-o-wisp.2","sourceDigest":"fbd6b0c3eae8b30f64d4a9c59e9c15870dd290fa7590ee08968b537dba88e63f","coverage":"partial"}; Дружественный выход предлагает переместить Пламя; вражеский путь прерывается на первой клетке выхода до downstream enter-триггеров и продолжается только после перепроверяемого отказа..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`.
- **Нужно добавить:** Заявление decision понижено до partial: остановка врага происходит после полного actor.move и ретроспективно возвращает его в первую клетку выхода, поэтому downstream enter/path-триггеры уже могли сработать за канонической точкой остановки.

#### 3. Парные духи (Twinned Spirits) `altruist.will-o-wisp.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.will-o-wisp.3` · `passive` · {"kind":"passive","sourceLevelId":"altruist.will-o-wisp.3","sourceDigest":"73fc31ad0348f634cb773ccd09f4dbb3ba9f0b16eea3ced967977e838286adfb","coverage":"partial"}; Второй изученный тип сохраняется; поддерживаются одно Пламя с двумя свойствами либо два независимых Пламени с отдельными эффектами и движением..
- **Готовые foundations:** `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

## Подрывник (Disruptor)

### Кровопускатель (Bloodletter) `disruptor.bloodletter`

#### 1. Кровавая грань (Bleeding Edge) `disruptor.bloodletter.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Ищейка (Bloodhound) `disruptor.bloodletter.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Разрыв [Стычка → Передышка] (Rupture [ Skirmish → Breathe ]) `disruptor.bloodletter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Химик (Chemist) `disruptor.chemist`

#### 1. Сублимация (Sublimation) `disruptor.chemist.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.chemist.1` · `area` · {"kind":"area","shape":"square3","areaType":"gas","duration":"nextTurn","sourceLevelId":"disruptor.chemist.1","sourceDigest":"7387a31ab85448d843cc0159532db66530bf54c3b975336e1a13fbefcd624a93","coverage":"full"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Экспериментальная смесь (Experimental Mixture) `disruptor.chemist.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.chemist.2` · `passive` · {"kind":"passive","coverage":"partial"}; Незакрыто: опциональный запрос Нарратору о скрытом Здоровье; текущий автоматический KO не может заменять это решение..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `information-query`.
- **Нужно добавить:** Здоровье цели читается и KO применяется автоматически вместо вопроса Нарратору.

#### 3. Осаждение (Deposition) `disruptor.chemist.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.chemist.3` · `passive` · {"kind":"passive","sourceLevelId":"disruptor.chemist.3","sourceDigest":"4125cbbef359eaa384850fa36e8a442b992640ba73695e720264967d3fc0b300","coverage":"full"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** До повторного аудита Осаждение срабатывало только для зон с source/ruleId Сублимации, хотя канон говорит о любой создаваемой владельцем зоне Газа; trigger расширен по areaType=gas и закреплён regression с другим источником.

### Душитель (Constrictor) `disruptor.constrictor`

#### 1. Обвить (Wrap) `disruptor.constrictor.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.constrictor.1` · `passive` · {"kind":"passive","sourceLevelId":"disruptor.constrictor.1","sourceDigest":"5072860b45e77e05b30520edca36b8150d1ac7b90cddceb4c7a9f34d9fd80e2a","coverage":"partial"}; Успешная одиночная Стычка накладывает Пойман; движение источника предлагает притянуть цели, а конец Хода — по очереди переместить их на расстояние до 5 клеток..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Удушение (Choke) `disruptor.constrictor.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.constrictor.2` · `passive` · {"kind":"passive","sourceLevelId":"disruptor.constrictor.2","sourceDigest":"31497052acc5975d0710be32d338ee9b8f371577bde12aca4250b1ee967ace4f","coverage":"full"}; Завершения Телом и Талантом игнорируют дальность для собственных Пойманных целей, а любое Завершение наносит им дополнительный урон Ступени..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** До повторного аудита дополнительный урон Ступени ошибочно требовал Пойман именно от этого Душителя, хотя ограничение владельца относится только к дистанционному targeting; исправлено для любого Пойманного персонажа с отдельным regression.

#### 3. Скручивающий удар (Twisting Impact) `disruptor.constrictor.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Карманник (Cutpurse) `disruptor.cutpurse`

#### 1. Ловкие руки (Fast Hands) `disruptor.cutpurse.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Урвать (Snatch) `disruptor.cutpurse.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Обчистить до нитки (Rob Them Blind) `disruptor.cutpurse.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Искривитель света (Light Bender) `disruptor.light-bender`

#### 1. Ослепительный свет (Blendendes Licht) (Blendendes Licht) `disruptor.light-bender.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Солнечное извержение (Sonneneruption) (Sonneneruption) `disruptor.light-bender.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Ложная звезда (Falscher Stern) (Falscher Stern) `disruptor.light-bender.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `event-preview`, `event-summary`, `rule-clock`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Жнец (Reaper) `disruptor.reaper`

#### 1. Посев (Sow) `disruptor.reaper.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Уход (Tend) `disruptor.reaper.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.reaper.2` · `passive` · {"kind":"passive","coverage":"partial"}; Помечен удерживается на враге в пределах 3 клеток; уровень I, создающий каноническую Метку, не автоматизирован..
- **Готовые foundations:** `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`.
- **Нужно добавить:** Реестр заявлял manual, хотя effect lifecycle уже удерживает Помечен на враге в пределах 3 клеток. Добавлен partial-adapter; источник Метки уровнем I и surface evidence отсутствуют.

#### 3. Жатва (Reap) `disruptor.reaper.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Уличный боец (Street Fighter) `disruptor.street-fighter`

#### 1. Кровавая латунь (Bloody Brass) `disruptor.street-fighter.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Ломать и калечить (Break And Bruise) `disruptor.street-fighter.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Зверство (Brutalize) `disruptor.street-fighter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Автофаг (Autophage) `disruptor.autophage`

#### 1. Переливание (Transfusion) `disruptor.autophage.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.autophage.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"health","resourceLabel":"Здоровье","initial":0,"replaces":["focus"],"coverage":"partial"}; Замена Фокуса Здоровьем работает, но Регенерация ошибочно требует прошедшего урона вместо успешной Атаки..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: замена Фокуса работает, но Регенерация требует `expectedDamage > 0`, тогда как канон требует успешной Атаки и не отменяется полной Бронёй/Уворотом.

#### 2. Перенапряжение (Overexert) `disruptor.autophage.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.autophage.2` · `autophage-overexert` · {"kind":"autophage-overexert","coverage":"partial"}; Эффект и цена реализованы, но адаптер принимает устаревший успешный удар из журнала вместо текущего окна Атаки..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Заявление decision понижено до partial: preview ищет любой прежний успешный удар в журнале Сцены и не доказывает незавершённое окно текущей Атаки; возможна поздняя повторная активация.

#### 3. Рождённый изменчивой плотью (Born Of Mutable Flesh) `disruptor.autophage.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.autophage.3` · `autophage-overexert` · {"kind":"autophage-overexert","double":true,"coverage":"partial"}; Двойной эффект, цели и once/Scene реализованы, но запуск не связан с текущим Завершением и наследует stale-trigger уровня II..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Заявление decision понижено до partial: once/Scene и выбор всех врагов с большим HP есть, но запуск наследует stale-hit уровня II и не атомарен с текущим Завершением.

### Говорящий с землёй (Earth Speaker) `disruptor.earth-speaker`

#### 1. Каменные солдаты (Stone Soldiers) `disruptor.earth-speaker.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Тектонический сдвиг (Tectonic Shift) `disruptor.earth-speaker.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Каменные осколки (Earthen Shards) `disruptor.earth-speaker.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Здоровяк (Strongman) `disruptor.inhuman-strength`

#### 1. Сильная рука (Strong-Arm) `disruptor.inhuman-strength.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Поршневой кулак (Piston Fist) `disruptor.inhuman-strength.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Пролом (Smash Through) `disruptor.inhuman-strength.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Родич роя (SwarmKin) `disruptor.swarm-body`

#### 1. Трепещущая форма (Fluttering Form) `disruptor.swarm-body.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `turn-lifecycle`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Раствориться в мухах (Vanish Into Flies) `disruptor.swarm-body.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Пожирание (Devour) `disruptor.swarm-body.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Сирена (Siren) `disruptor.siren`

#### 1. «Ты ведь не причинишь МНЕ боль?» ("You wouldn't hurt ME, would you?") `disruptor.siren.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.siren.1` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"8d9becba6e6f63641f5dc1a8a47e965c73f0e7112ef7ef4b781b2c6ffb632979","sourceLevelId":"disruptor.siren.1"}; В начале каждой Сцены даёт 3 Фокуса без лимита применений; после авторитетного Изучения врага предлагает потратить 1 Фокус и наложить Испуган на изученную цель. Текст уровня не содержит ограничения «3 раза за Сцену»; UI/network surface-сверка остаётся ручной..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `information-query`.
- **Нужно добавить:** Старый текстовый путь ошибочно обещал ограничение «3 раза за Сцену». Английский канон требует +3 Фокуса в начале каждой Сцены без этого лимита; авторитетный Study→Fear choice-flow и digest добавлены, cross-surface certification остаётся ручной.

#### 2. «Я неотразима!» ("I'm Irresistible!") `disruptor.siren.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.siren.2` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"62f65d9d2cfad5b96f12f80b2ece81635e47b5f63083b35b4f4c6eb1db1b5ed6","sourceLevelId":"disruptor.siren.2"}; Первое за Ход наложение Испуган открывает отменяемый выбор клетки: путь цели до 3 клеток проверяется пошагово на приближение к Сирене, а после фактического входа цели в смежность отдельно предлагает наложить Ошеломлен и только тогда даёт 1 Фокус. Surface-сверка импортов и сетевых повторов остаётся ручной..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`.
- **Нужно добавить:** Сирена II требует once-per-Turn receipt после собственного Fear-события; авторитетно проверены владелец, digest, живой враг, пошаговое движение до 3 и Daze/+1 Focus только после фактической смежности. UI/network/import surface evidence остаётся ручным.

#### 3. «Не поможете?» ("A little help over here?") `disruptor.siren.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.siren.3` · `passive` · {"kind":"passive","coverage":"full","sourceDigest":"231b63c69615f78497650a97d3a5225a98f298a882d4adb2eedaebdff16c5b7e","sourceLevelId":"disruptor.siren.3"}; После разрешённого Духовного или Ментального Завершения предлагает подтянуть всех Испуганных врагов к цели Завершения на их Скорость и наносит цели урон Ступени за каждого, кто фактически оказался рядом..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Всадник волн (Wave Rider) `disruptor.wave-rider`

#### 1. Мягкие волны (Gentle Waves) `disruptor.wave-rider.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.wave-rider.1` · `marker` · {"kind":"marker","markerKind":"ritual","duration":"scene","color":"#3fa9d4","coverage":"partial"}; Печати сохраняются с лимитом 4+Ступень, а владелец разрешает их срабатывание; Быстрота и бесплатность первого подходящего Заклинания ещё не подключены..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Могучие волны (Momentous Waves) `disruptor.wave-rider.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Водяная клетка (Aqua Cage) `disruptor.wave-rider.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Морок (Mind Breaker) `disruptor.mind-breaker`

#### 1. «Где ты?» ("Where Are You?") `disruptor.mind-breaker.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. «Где я?» ("Where Am I?") `disruptor.mind-breaker.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.mind-breaker.2` · `passive` · {"kind":"passive","coverage":"partial"}; Source-aware Изгнание производит Помечен/Усилен, но канонический способ наложить Изгнание уровнем I отсутствует..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`.
- **Нужно добавить:** Реестр заявлял manual, хотя source-aware Изгнание уже производит Помечен для врага и Усилен для союзника. Добавлен partial-adapter; уровень I и полный пользовательский путь отсутствуют.

#### 3. «Кто они?» ("Who Are They?") `disruptor.mind-breaker.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.mind-breaker.3` · `passive` · {"kind":"passive","coverage":"partial"}; Единственный Изгнанный сохраняет эффект в начале Хода; перемещение двух целей и принудительная Атака отсутствуют..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Реестр заявлял manual, хотя единственная source-owned Изгнанная цель уже сохраняет эффект в начале Хода. Добавлен partial-adapter; end-Turn перемещение и принудительная Атака отсутствуют.

### Шагающий по буре (Gale Strider) `disruptor.gale-strider`

#### 1. Растущие ветра (Growing Winds) `disruptor.gale-strider.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.gale-strider.1` · `area` · {"kind":"area","shape":"square3","areaType":"danger","duration":"scene","coverage":"partial"}; Тайфун заменяет прежний и его групповое смещение разрешается владельцем; размещение после Заклинания или Прыжка пока запускается отдельно..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Восходящий поток (Updraft) `disruptor.gale-strider.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Резчик гор (Mountain Carver) `disruptor.gale-strider.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Браконьер (Poacher) `disruptor.hunter`

#### 1. Стальные челюсти (Steel Jaws) `disruptor.hunter.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.hunter.1` · `trap-placement` · {"kind":"trap-placement","markerKind":"trap","duration":"scene","color":"#c28a45","sourceLevelId":"disruptor.hunter.1","sourceDigest":"4631594ad05e136bae6833e79ee4100f05fbc6102e19050c7ef92f2b8e38f28b","coverage":"partial"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Дальняя установка (Far Setting) `disruptor.hunter.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.hunter.2` · `passive` · {"kind":"passive","sourceLevelId":"disruptor.hunter.2","sourceDigest":"9cf3c781404a8c16afe29156f0a2ebcf706b9975a00531ab53ced5298a0fea86","coverage":"full"}; Дальность пустой Стычки и Обездвиживание цели ловушки учитываются автоматически..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Яма-ловушка (Pit Trap) `disruptor.hunter.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.hunter.3` · `area` · {"kind":"area","shape":"square2","areaType":"terrain","duration":"scene","coverage":"partial"}; Геометрия ямы поддержана; объединение четырёх ловушек и Завершение Разумом ещё не автоматизированы..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Тюремщик (Jailor) `disruptor.mage-s-array`

#### 1. Возвести (Erect) `disruptor.mage-s-array.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Перестройка (Readjust) `disruptor.mage-s-array.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Тюрьма собственного устройства (Prison Of Your Own Design) `disruptor.mage-s-array.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Кузнец миров (Worldsmith) `disruptor.inner-world`

#### 1. Глубокий взгляд (Gaze Deeply) `disruptor.inner-world.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.inner-world.1` · `passive` · {"kind":"passive","coverage":"partial"}; Основная ветка работает, но trigger может подобрать старое получение Фокуса от прежней Зарядки вместо текущего события..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Заявление decision понижено до partial: после action.resolve Зарядки trigger ищет последнее подходящее получение Фокуса во всём журнале и может повторно использовать старое событие, если текущая Зарядка дала 0 или ресурс был заменён.

#### 2. Область контроля (Domain Of Control) `disruptor.inner-world.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.inner-world.2` · `space` · {"kind":"space","spaceName":"Внутренний мир","width":3,"height":3,"sourceLevelId":"disruptor.inner-world.2","sourceDigest":"390e3b65210483b8eebd3f9decc0997f2e63132a0377fd1ae63053a9210323d1","coverage":"partial"}; После наложения Эффекта предлагает перенос выбранных участников в отдельное пространство 3×3 с возвратом на край поля при Ране или нокауте..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Своя территория (Home Turf) `disruptor.inner-world.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.inner-world.3` · `passive` · {"kind":"passive","sourceDigest":"fb44b773e2eb1b59c5691f7f5f6b9a2b624f2b9d3cdcffe70ee98cd46a597dff","sourceLevelId":"disruptor.inner-world.3","coverage":"partial"}; Бонус Тир Преимущества в Дуэле сохраняется в entry/resolve snapshot только внутри собственного Внутреннего мира; составной выбор Домена остаётся решением игрока..
- **Готовые foundations:** `usage-limits`, `trigger-router`, `scene-lifecycle`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `duel-flow`.

## Разрушитель (Ruiner)

### Бомбардир (Bombardier) `ruiner.bombardier`

#### 1. Взрыв!! (Explosion!!) `ruiner.bombardier.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.bombardier.1` · `area` · {"kind":"area","shape":"adjacent","areaType":"attack","duration":"instant","range":4,"sourceLevelId":"ruiner.bombardier.1","sourceDigest":"3d9ff42ccdca001941878db3a63ef647bf904ad689d35b2c6b7e5c76e1ce59d3","coverage":"partial"}; Частично автоматизировано: Завершение Духом требует вражескую цель в центре в дальности 4 и поражает её и все доступные смежные клетки; полный surface-сверка ещё требует проверки..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: авторитетный план требует Завершение Духом, вражескую цель в центре и дальность 4, затем выводит центр и смежные клетки; полный сетевой/UI surface-контракт ещё не сертифицирован.

#### 2. Взрыв!!! (Explosion!!!) `ruiner.bombardier.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.bombardier.2` · `area` · {"kind":"area","shape":"square3","areaType":"attack","duration":"instant","range":5,"optionMinimum":{"key":"focusSpent","value":2,"label":"потрачено Фокуса"},"sourceLevelId":"ruiner.bombardier.2","sourceDigest":"46784c9f35cd64891f6ba70dc0d5a14ddf7f15aaab733ca1dbd3e6b3c60697c5","coverage":"partial"}; Частично автоматизировано: при фактической оплате 2+ Фокуса Завершение Духом перепроверяет зону 3×3 в дальности 5 и получает по 1 Преимуществу за пустую клетку с пределом [Ступень+2]; полный surface-контракт остаётся ручным..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: авторитетно проверяются Завершение Духом, Focus≥2, зона 3×3 в дальности 5, производный счёт пустых клеток и предел [Ступень+2]; полный surface-контракт остаётся ручным.

#### 3. ВЗРЫВ!!!! (EXPLOSION!!!!) `ruiner.bombardier.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.bombardier.3` · `area` · {"kind":"area","shape":"square5","areaType":"attack","duration":"instant","range":6,"optionMinimum":{"key":"focusSpent","value":4,"label":"потрачено Фокуса"},"sourceLevelId":"ruiner.bombardier.3","sourceDigest":"e9b9958348fa1bf6bf5f752ead593042fcd332ebcc8e28cd2a23054bea16a4de","coverage":"partial"}; Частично автоматизировано: при фактической оплате 4+ Фокуса Завершение Духом перепроверяет зону 5×5 в дальности 6; полный surface-контракт остаётся ручным..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: авторитетно проверяются Завершение Духом, Focus≥4 и зона 5×5 в дальности 6; полный surface-контракт остаётся ручным.

### Искоренитель (Eradicator) `ruiner.rapid-fire-sorcery`

#### 1. Распространение (Proliferate) `ruiner.rapid-fire-sorcery.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Выжженная земля (Scorched Earth) `ruiner.rapid-fire-sorcery.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.rapid-fire-sorcery.2` · `area` · {"kind":"area","shape":"cell","areaType":"difficult","duration":"scene","coverage":"partial"}; Размещение трудной местности поддержано; создание только после урона пустой клетке и входной урон ещё требуют общего конвейера..
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Бесконечный огонь [Зарядка → Заклинание] (Endless Fire [ Charge → Cast ]) `ruiner.rapid-fire-sorcery.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Ритуалист (Ritualist) `ruiner.ritualist`

#### 1. Лей-линии (Ley Lines) `ruiner.ritualist.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.ritualist.1` · `marker` · {"kind":"marker","markerKind":"ritual","duration":"scene","color":"#6fc9d8","coverage":"partial"}; Круг и бонус работают, но отдельная кнопка не требует Зарядки и не отказывается от полученного ею Фокуса..
- **Готовые foundations:** `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Заявление decision понижено до partial: круг создаётся отдельной кнопкой без обязательной Зарядки и без отказа от полученного ею Фокуса; работают лишь placement/replacement и бонус лимита Spirit Finisher.

#### 2. Магическая артиллерия (Arcane Artillery) `ruiner.ritualist.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `action-modifier`, `dice-hooks`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Фрактальная вязь (Fractal Etchings) `ruiner.ritualist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Творец заклинаний (Spellcrafter) `ruiner.spellcrafter`

#### 1. Эксперимент (Experimentation) `ruiner.spellcrafter.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.spellcrafter.1` · `modifier-choice` · {"kind":"modifier-choice","sourceLevelId":"ruiner.spellcrafter.1","sourceDigest":"cd258e50964ec7fdf255d20dfb2a710459dc94dfbb4c5c3e9ea73e8ff6f98303","coverage":"partial"}; Одна изученная Модификация сохраняется в листе, сцене и импорте; каждое применение к Заклинанию или Завершению атомарно тратит 1 Новаторство..
- **Готовые foundations:** `spatial-cells`, `spatial-range`, `inventory`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Заявление decision понижено до partial: канон фиксирует одну Модификацию при получении уровня, а текущий UI позволяет перед каждой Атакой выбрать любую из четырёх.

#### 2. Закрепление (Solidification) `ruiner.spellcrafter.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.spellcrafter.2` · `modifier-choice` · {"kind":"modifier-choice","sourceLevelId":"ruiner.spellcrafter.2","sourceDigest":"f94f640a08662ad025e0ded425aab945bdf0b4accabc6519142867e5f5cf0886","coverage":"partial"}; Новаторство отключается, стартовый Фокус увеличивается на Разум, а изученная Модификация атомарно стоит 1 Фокус за применение..
- **Готовые foundations:** `resource-check`, `inventory`, `trigger-router`, `action-modifier`, `derived-stats`.
- **Нужно добавить:** Заявление decision понижено до partial: Focus-оплата и стартовый бонус работают, но уровень наследует отсутствие постоянного набора изученных Модификаций.

#### 3. Завершение (Finalization) `ruiner.spellcrafter.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.spellcrafter.3` · `modifier-choice` · {"kind":"modifier-choice","sourceLevelId":"ruiner.spellcrafter.3","sourceDigest":"934e98cf6f004417c5ac6779976bcbec9ffae7056163a7b460560ca8641d4735","coverage":"partial"}; Второй изученный вариант сохраняется; одно действие может выбрать не более двух разных изученных Модификаций и платит за обе в одной проверяемой цепочке..
- **Готовые foundations:** `resource-check`, `inventory`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Заявление decision понижено до partial: две разные Модификации можно оплатить, однако они выбираются из полного списка, а не из канонически изученных вариантов.

### Ученик звёзд (Student Of Stars) `ruiner.student-of-stars`

#### 1. Высвобождение силы [Зарядка → Завершение] (Power Unleashed [ Charge → Finisher ]) `ruiner.student-of-stars.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.student-of-stars.1` · `action-modifier` · {"kind":"action-modifier","actionKey":"finish","sourceDigest":"64d7fc6b8ff19f2f7ab1b9b12c8021872835baf6374bb729837f7d2f2a27fa60","coverage":"partial"}; После подтверждённой Зарядки Завершение стоит 1 ОД; предел дополнительного Фокуса вычисляется Engine как 3×текущее Напряжение..
- **Готовые foundations:** `resource-check`, `usage-limits`, `action-modifier`, `action-history`, `combat-meter`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Бесформенная сила (Formless Strength) `ruiner.student-of-stars.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.student-of-stars.2-line` · `area` · {"kind":"area","shape":"line","areaType":"attack","duration":"instant","sourceDigest":"6fd4f1cf8b3ee7fbe492fd7a439792e61c568bd4c28d0b6efe80071d99482d7e","coverage":"partial"}; После Высвобожденной мощи Engine перепроверяет бесконечную линию, центр в соседней клетке и цели по общей геометрии.<br>`ruiner.student-of-stars.2-zone` · `area` · {"kind":"area","shape":"square2","areaType":"attack","duration":"instant","sourceDigest":"6fd4f1cf8b3ee7fbe492fd7a439792e61c568bd4c28d0b6efe80071d99482d7e","coverage":"partial"}; После Высвобожденной мощи Engine перепроверяет зону 2×2, центр в соседней клетке и цели по общей геометрии..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `choice-flow`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Момент истины (Moment Of Truth) `ruiner.student-of-stars.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.student-of-stars.3` · `duel-entry` · {"kind":"duel-entry","sourceDigest":"806d52c0296048d69a25b379d8dcdfa5690dbee0cef391ea6894485016393f6e","sourceLevelId":"ruiner.student-of-stars.3","coverage":"partial"}; Перед входом в Дуэль стол показывает фактический Фокус; при 6+ владелец может потратить весь снимок и получить ceil(Фокус/2) Преимущества только в этой Дуэли. Выбор, отмена и квитанция переживают reload/replay..
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `duel-flow`.

### Кузнец клинков (Blade Smith) `ruiner.mana-blades`

#### 1. К оружию (Call Arms) `ruiner.mana-blades.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `action-copy`.

#### 2. Буря клинков (Blade Storm) `ruiner.mana-blades.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Святой меч Экскалибур (Saintly Sword, Excalibur) `ruiner.mana-blades.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

### Драматург (Dramaturge) `ruiner.dramaturge`

#### 1. Все глаза на меня (All Eyes On Me) `ruiner.dramaturge.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Похитить их огонь (Snatch Their Fire) `ruiner.dramaturge.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `turn-lifecycle`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Сила представления (Power In Presentation) `ruiner.dramaturge.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Дикий арканист (Feral Arcanist) `ruiner.feral-arcana`

#### 1. Ворпальный коготь (Vorpal Claw) `ruiner.feral-arcana.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Снять цепи [Зарядка → Взаимодействие] (Unchain [ Charge → Interact]) `ruiner.feral-arcana.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.feral-arcana.2.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.feral-arcana.rage","size":6,"initial":0,"sourceLevelId":"ruiner.feral-arcana.2","sourceDigest":"d745e6fa077a45223741fbb879b15e58914fff47b700b5167c15845bfa9b34a4","coverage":"partial"}; Создание и жизненный цикл Ярости, ограничения ОД, Быстрые Прыжки и обязательное бесплатное Заклинание по всем смежным персонажам проходят через цели, Реакции, отмену и журнал..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `choice-flow`, `action-modifier`, `duration-scheduler`, `combat-meter`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Хватка (Grasp) `ruiner.feral-arcana.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.feral-arcana.3` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.feral-arcana.3","sourceDigest":"9f6cfdd94da5ecb8aae12c24b3602fc117b2890191d51dabd3eb6d89a3b83df3","coverage":"partial"}; Завершение Телом может потратить всю Ярость, получить Преимущество от Напряжения и переместиться до 3 клеток перед созданием Атаки..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `combat-meter`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Пламенное сердце (Flame Heart) `ruiner.flame-heart`

#### 1. Разогрев (Rev Up) `ruiner.flame-heart.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Проклятый удар (Damning Impact) `ruiner.flame-heart.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `combat-meter`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Пепел к пеплу (Ashes To Ashes) `ruiner.flame-heart.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.flame-heart.3` · `passive` · {"kind":"passive","coverage":"partial","sourceDigest":"4896f18d23e7ba4de201859ecfb76d46c7049c32e532747831b973b2d75c6d29","sourceLevelId":"ruiner.flame-heart.3"}; Заклинания получают +1 Преимущество, а Духовное Завершение — дальность 5 через общий числовой конвейер. Снятие Порчи и Х-образная область остаются ручными..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Криомант (Frost Veiler) `ruiner.cryomancer`

#### 1. Охлаждение (Chill) `ruiner.cryomancer.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.cryomancer.1` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.cryomancer.1","sourceDigest":"604e45fc7a8fadb9fbe5fdad4a5e8981a97d1aabc01388a92d3e94b291fdd204","coverage":"full"}; Успешное Заклинание после разрешения Реакций автоматически накладывает Замедлен на доступные цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Ледяной нимб (Icicle Halo) `ruiner.cryomancer.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.cryomancer.2.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.cryomancer.icicle","size":4,"initial":0,"sourceLevelId":"ruiner.cryomancer.2","sourceDigest":"32667d8918127c1729dc39430bde0375999651854e06e8cd599d91b7fcd14f30","coverage":"partial"}; Канон: Заклинания получают +1 Преимущество; после фактического получения Фокуса один раз за это Действие заполняется Сосулька; перед Передышкой можно заменить её эффект опустошением часов и уроном [Дух/2] за сегмент, с Ошеломлением Замедленного. Старый quick-Cast/persistent-prompt путь не является доказательством этой механики..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Заявление decision понижено до partial: старый prompt использовал любой текущий Focus; новый adapter/core требует фактический Focus gain с action provenance, ведёт 4-сегментную Сосульку и каноническую замену Breathe, но полного UI/network/save evidence ещё нет.

#### 3. Раскол (Shatter) `ruiner.cryomancer.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `information-query`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мрачный Вознесённый (Grim Ascendant) `ruiner.grim-ascendant`

#### 1. Непостоянная мощь (Impermanent Power) `ruiner.grim-ascendant.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.grim-ascendant.1` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.grim-ascendant.1","sourceDigest":"14985f7ee4c071f07156d6dd763680da6d7a9d83e19a175cd9d3d2d06b113e0f","coverage":"partial"}; После подходящей Зарядки стол предлагает трансформацию и полностью ведёт перенаправление Здоровья, Фокуса, толчок и завершение формы..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `derived-stats`, `combat-meter`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `transformation`.

#### 2. Вытянуть жизнь (Drain Life) `ruiner.grim-ascendant.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.grim-ascendant.2` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.grim-ascendant.2","sourceDigest":"f9768c5e588f5471e9e1e5b145e1b9ec0216d2fcba298f5c64364b027af2bf96","coverage":"partial"}; Канон: после Завершения Духом в форме можно начать Drain Life; источник и цель Ошеломляются до начала следующего Хода любого из них, а если до снятия эффекта оба не получают урон, источник получает [Дух] Фокуса. Старый state-toggle с половиной урона и Регенерацией исключён..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Старый state-toggle с половиной урона и Регенерацией не соответствует новому EN-канону. Реестр понижен до partial; каноническая ветка Drain Life ведётся отдельным связным trigger-путём и требует полного surface evidence.

#### 3. Умбра (Umbra) `ruiner.grim-ascendant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`.

### Рейнджер (Ranger) `ruiner.long-draw`

#### 1. Наложить стрелу (Nock The Arrow) `ruiner.long-draw.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `inventory`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Лёгкий шаг (Feather Step) `ruiner.long-draw.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `inventory`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Пробиватель владык [Подготовка × 3] (Lord Piercer [ Prepare × 3 ]) `ruiner.long-draw.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `inventory`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Призыватель меча (Sword Caller) `ruiner.sellsword-s-call`

#### 1. Реприза воина (A Warrior's Reprise) `ruiner.sellsword-s-call.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.sellsword-s-call.1` · `marker` · {"kind":"marker","markerKind":"summon","duration":"scene","color":"#6fc9d8","coverage":"partial"}; Точка призыва ставится только в пустую клетку за 1 Фокус, с выбором типа и лимитом [Ступень/2]. Незакрыто: полноценный Призыв-участник с 1 Здоровьем, профильной Атакой, половиной урона и Ходом..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Создаётся marker, а не Призыв-actor с HP, атакой, половиной урона и Ходом.

#### 2. Ярость воина (Warrior's Fury) `ruiner.sellsword-s-call.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`.

#### 3. Высший наёмник (Supreme Sellsword) `ruiner.sellsword-s-call.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `bond-actions`, `deployment-hooks`.

### Душа пустоты (Void Soul) `ruiner.void-soul`

#### 1. Возврат в ничто (Return To Nothing) `ruiner.void-soul.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `movement-lifecycle`, `effect-state`, `effect-lifecycle`, `trigger-router`, `turn-lifecycle`, `duration-scheduler`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Растворение (Fade Away) `ruiner.void-soul.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `turn-lifecycle`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Пустое сердце (Hollow Heart) `ruiner.void-soul.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.void-soul.3.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.void-soul.void","size":6,"initial":0,"sourceLevelId":"ruiner.void-soul.3","sourceDigest":"6d15c248b8a627ae99aef38582164433ed90f727ee9e8e9317428f215c33d3b8","coverage":"partial"}; Полная Пустота открывает Завершение Духом по всем врагам центральной зоны 5×5 с половинным уроном и обычными Реакциями..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Громовая кровь (Thunder Blood) `ruiner.thunder-blood`

#### 1. Райдзин (Raiden) `ruiner.thunder-blood.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.thunder-blood.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.thunder-blood.static","size":6,"initial":0,"sourceLevelId":"ruiner.thunder-blood.1","sourceDigest":"209467fbf50f3b3db2c2ab7811bdb1e5c9eb67c2031d6610935c65cacb62d2ea","coverage":"partial"}; Передышка предлагает заполнить Статику; непустая Статика автоматически снимает Ошеломлен..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Заряженное заклинание (Energized Incantation) `ruiner.thunder-blood.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.thunder-blood.2` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.thunder-blood.2","sourceDigest":"a3138ed2ae39fd300138b566bd502bfff93976c30ac428ff55666939ad3a73d2","coverage":"partial"}; После успешного Заклинания явный выбор исходной цели проводит Скачок, Разряд или Цепь через расход Статики, Ошеломление, проверку целей, новый бросок, Реакции, отмену и журнал..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Тактический разряд (Tactical Discharge) `ruiner.thunder-blood.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.thunder-blood.3` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.thunder-blood.3","sourceDigest":"a21a0082bbc4f755f1340fc4f480f9ba560c54975c97b83bbb20dfbff7de4117","coverage":"partial"}; При 3+ Статики Завершение Духом собирает зону 3×3 без владельца, добавляет Ступень урона уже Ошеломленным и после Успеха накладывает Ошеломлен..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Фанатик (Zealot) `ruiner.zealot`

#### 1. Еретическая преданность (Heretical Devotion) `ruiner.zealot.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.zealot.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.zealot.revelation","size":6,"initial":0,"sourceLevelId":"ruiner.zealot.1","sourceDigest":"c8e971ffe78514c097777e0eec812c6925aa9784440fb7d26ec563955ec36f69","coverage":"partial"}; Публичный бросок с единицей предлагает потратить Фокус и заполнить Озарение; Зарядка, Заклинание и Завершение Духом умеют потратить сегмент и инвертировать итоговые Успехи..
- **Готовые foundations:** `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Урод (Freak) `ruiner.zealot.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.zealot.2` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.zealot.2","sourceDigest":"6baef7e8dd9c06bb53b223e9a252f60b091b0363e61724b66a2afb67dcff18f7","coverage":"partial"}; Начало Хода при четырёх сегментах предлагает Усиление и записывает отдельное наложение Испуган каждым персонажем..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `turn-lifecycle`, `choice-flow`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Не должно было существовать (Never Meant To Be) `ruiner.zealot.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.zealot.3` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.zealot.3","sourceDigest":"c4ecec53d411e601f394d0f05644f3334328c1526ea54a2f87b80cd44d5a8161","coverage":"partial"}; Полное Озарение открывает Завершение Духом по двум пересекающимся Линиям; стол последовательно проверяет сдвиг каждого персонажа, атомарно очищает часы, уничтожает связанную местность, удаляет клетки и ведёт обычную цепочку Реакций..
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `terrain`, `spatial-topology`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Творец (Creator) `ruiner.creation-ascetic`

#### 1. Формирующие знаки (Forming Signs) `ruiner.creation-ascetic.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.creation-ascetic.1` · `resource-replacement` · {"kind":"resource-replacement","sourceLevelId":"ruiner.creation-ascetic.1","sourceDigest":"6f4e55f851dd43392db08bf1fb2bd639f7921d6767a899dcde23c7492b8f41a3","coverage":"full"}; Метки творения заменяют Фокус; обычная Атака с Метками направляется к подходящей форме.<br>`ruiner.creation-ascetic.1.nails` · `creation-attack` · {"kind":"creation-attack","actionKey":"spell","markBand":"low","form":"nails","sourceLevelId":"ruiner.creation-ascetic.1","sourceDigest":"6f4e55f851dd43392db08bf1fb2bd639f7921d6767a899dcde23c7492b8f41a3","coverage":"partial"}<br>`ruiner.creation-ascetic.1.mallet` · `creation-attack` · {"kind":"creation-attack","actionKey":"spell","markBand":"high","form":"mallet","sourceLevelId":"ruiner.creation-ascetic.1","sourceDigest":"6f4e55f851dd43392db08bf1fb2bd639f7921d6767a899dcde23c7492b8f41a3","coverage":"partial"}<br>`ruiner.creation-ascetic.1.pile-arm` · `creation-attack` · {"kind":"creation-attack","actionKey":"finish","markBand":"low","form":"pile-arm","advantage":2,"sourceLevelId":"ruiner.creation-ascetic.1","sourceDigest":"6f4e55f851dd43392db08bf1fb2bd639f7921d6767a899dcde23c7492b8f41a3","coverage":"partial"}<br>`ruiner.creation-ascetic.1.idol` · `creation-attack` · {"kind":"creation-attack","actionKey":"finish","markBand":"high","form":"idol","advantage":4,"sourceLevelId":"ruiner.creation-ascetic.1","sourceDigest":"6f4e55f851dd43392db08bf1fb2bd639f7921d6767a899dcde23c7492b8f41a3","coverage":"partial"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `alternate-resource`, `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `scene-lifecycle`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Единый истинный мир (One True World) `ruiner.creation-ascetic.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.creation-ascetic.2` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.creation-ascetic.2","sourceDigest":"d19e636560bcfb7c9345b9bb4779f65c6b3f25b78576a6432bd6b1bbc834cbf9","coverage":"full"}; Передышка, Зарядка и получение Меток от повреждения или уничтожения местности автоматизированы..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `terrain`, `usage-limits`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Труд верующего [Заклинание → Завершение] (Labor Of The Devout [ Cast → Finisher ]) `ruiner.creation-ascetic.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.creation-ascetic.3` · `passive` · {"kind":"passive","sourceLevelId":"ruiner.creation-ascetic.3","sourceDigest":"c7dc7bbd517cd65a2d221ae8066489b4aca652a6a2c2c0a3dadf771ea4962c82","coverage":"full"}; Форма Завершения получает число Меток непосредственно предшествовавшего Заклинания..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Эго-оружие (Ego Arm) `ruiner.ego-arm`

#### 1. Я — твой меч (I Am Your Sword) `ruiner.ego-arm.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `deployment-hooks`, `transformation`.

#### 2. Покажи цели (Show Your Targets) `ruiner.ego-arm.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** `ruiner.ego-arm.2` · `marker` · {"kind":"marker","markerKind":"damocles","duration":"scene","color":"#d04f64","coverage":"partial"}; Нужна модель носителя/трансформации: в каноне маркеры ставятся в конце Хода на клетках всех врагов, атакованных носителем; текущий произвольный выбор клетки нельзя показывать как автоматизацию..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `turn-lifecycle`, `damage-pipeline`, `action-modifier`, `action-history`, `derived-stats`.
- **Нужно добавить:** Нет модели носителя, конца его Хода и множества атакованных им врагов.

#### 3. И я стану незаменимым (And I'll Become Irreplaceable) `ruiner.ego-arm.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `derived-stats`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.
