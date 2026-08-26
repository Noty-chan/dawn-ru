# DAWN: кодовая спецификация Техник

> Сгенерировано `npm run docs:rules` из канонического `apps/companion/data.js` (SHA-256 `f01d63a8e89afee3c0abe59fedb9e78c9d20ab741608b247d90629e7e16a0248`).
> Русский текст - канонический перевод из `source/translation/`; локальные профили Леона взяты из `source/companion/named-enemies.md`. Английские названия сверяются с `source/translation/adapted-names-index.md` и, для Черточек Антагониста, с `source/original/Dawn - A Diceless Fantasy TTRPG.pdf`.

## Границы этого документа

Это спецификация текущего кода, а не новый канон. `full`, `decision` и `partial` описывают заявленную привязку к движку; только evidence определяет доказанный уровень. Для канонического текста и двуязычных названий используйте `TECHNIQUES-RU-EN-CATALOG.md`.

## Общий контракт выполнения

`data.js` → `technique-engine.js:RULES` (если правило зарегистрировано) → `scene-engine` (валидация, events, prompt, реакции, урон, эффект, движение) → UI/intent. Отсутствие строки в `RULES` означает, что UI может показать текст и foundation-plan, но механика не вызывается: статус должен быть `manual`.

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
| `choice-flow` · Типизированное решение | `scene-responses.js / scene-events.js / scene-effects.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `damage-pipeline` · Конвейер урона, Здоровья и Ран | `scene-responses.js / scene-events.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `action-modifier` · Модификатор или новое действие | `scene-actions.js / scene-responses.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `composite-action` · Сохраняемое составное действие | `scene-query.js / scene-events.js / scene-responses.js / scene-effects.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `effect-lifecycle` · Механика, источник и срок Эффекта | `scene-engine-core.js / scene-query.js / scene-events.js / scene-triggers.js / scene-responses.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `entity-lifecycle` · Жизненный цикл зон, маркеров и объектов | `scene-events.js / scene-triggers.js / scene-ui.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `dice-hooks` · Модификаторы и повтор броска | `scene-foundations.js / scene-events.js / scene-triggers.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |
| `duration-scheduler` · Сроки действия и отложенные эффекты | `scene-events.js / scene-triggers.js / scene-ui.js` | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |

## Требуемые / незавершённые семейства

| Семейство | Состояние | Что должен дать будущий контракт |
| --- | --- | --- |
| `turn-lifecycle` · Жизненный цикл Хода и Раунда | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `scene-lifecycle` · Начало, конец и сброс Сцены | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `movement-lifecycle` · Жизненный цикл движения | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `inventory` · Инвентарь и заряды | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `summon-turns` · Призывы и делегированные Ходы | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `deployment-hooks` · Развертывание | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `intermission-reset` · Сброс на Интермиссии | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `bond-actions` · Связи и действия Связей | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `derived-stats` · Производные характеристики персонажа | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `information-query` · Изучение и раскрытие информации | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `transformation` · Трансформации и заимствованные правила | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `duel-flow` · Дуэли и ставки | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
| `combat-meter` · Напряжение и общие счетчики боя | planned | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |
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
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`, `combat-meter`.

#### 2. Выдержать побои (Take A Beating) `powerhouse.berserker.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `derived-stats`.

#### 3. Загнанный пес (Cornered Dog) `powerhouse.berserker.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Драконоборец (Dragonslayer) `powerhouse.dragonslayer`

#### 1. Скорость - это вес (Speed Is Weight) `powerhouse.dragonslayer.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.dragonslayer.1` · `passive` · {"kind":"passive"}; Успешное Завершение Телом после общего окна Реакций накладывает Разорван на доступные цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Широкая дуга (Wide Arc) `powerhouse.dragonslayer.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Титанический замах (Titanic Heave) `powerhouse.dragonslayer.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.dragonslayer.3` · `combo` · {"kind":"combo","sequenceKeys":["breathe","finish"],"actionKey":"finish","attribute":"body","allDiceSucceed":true,"postPush":2,"postSelfEffects":["Ослаблен"]}.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

### Дуэлянт (Duelist) `powerhouse.duelist`

#### 1. Ответный выпад (Riposte) `powerhouse.duelist.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. Парирование (Parry) `powerhouse.duelist.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.duelist.2` · `passive` · {"kind":"passive"}; Ответ Блоком против смежного атакующего автоматически накладывает Ошеломлен до разрешения исходной Атаки..
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

#### 2. Кровавый рывок (Blood Rush) `powerhouse.flagellant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 3. Обескровлен (Bled Dry) `powerhouse.flagellant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Стрелок (Gunslinger) `powerhouse.gunslinger`

#### 1. Большой ствол (Big Iron) `powerhouse.gunslinger.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.gunslinger.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"bullets","resourceLabel":"Пули","initial":6,"replaces":["focus"]}; Пули сохраняются и изменяются событиями ядра; Стычка проверяет минимум, дальность и явное распределение дополнительных Пуль..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** До повторного аудита Стычка ошибочно принимала пустые клетки, хотя канон требует персонажей; исправлено отдельной валидацией, статус остаётся partial до полного пользовательского пути.

#### 2. Зарядить и взвести (Lock And Load) `powerhouse.gunslinger.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.gunslinger.2` · `passive` · {"kind":"passive"}; Стычки получают постоянное Преимущество; Ход без Атаки предлагает выставить Пули на 6..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`.

#### 3. Жонглирование пулями (Bullet Juggle) `powerhouse.gunslinger.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.gunslinger.3` · `passive` · {"kind":"passive"}; Одиночная Стычка за 3+ Пули автоматически накладывает Подброшен после разрешения Реакций..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Борец (Struggler) `powerhouse.struggler`

#### 1. Усилие (Effort) `powerhouse.struggler.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `choice-flow`, `damage-pipeline`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`, `derived-stats`.

#### 2. Адреналин (Adrenaline) `powerhouse.struggler.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Вопреки разуму (Defy Reason) `powerhouse.struggler.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Магический мечник (SpellSword) `powerhouse.spellsword`

#### 1. Чародейский клинок (Spell Blade) `powerhouse.spellsword.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `action-copy`.

#### 2. Два солнца (Twin Suns) `powerhouse.spellsword.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.spellsword.2` · `teleport` · {"kind":"teleport","range":3,"timing":"beforeTargets"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `action-modifier`, `action-history`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

#### 3. Охотник на ведьм (Witch Hunter) `powerhouse.spellsword.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.spellsword.3.foundation` · `foundation` · {"kind":"foundation","foundation":"action-history","scope":"turn","actionKeys":["spell"]}; Ядро находит непосредственно предыдущее Заклинание и его цели; комбо проверяет Завершение Телом/Талантом по тем же целям и добавляет Дух к урону.<br>`powerhouse.spellsword.3` · `combo` · {"kind":"combo","sequenceKeys":["spell","finish"],"actionKey":"finish","attributes":["body","talent"],"sameTargets":true,"bonusDamageAttribute":"spirit"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Техник (Technician) `powerhouse.technician`

#### 1. Разминка (Stretch) `powerhouse.technician.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `duration-scheduler`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

#### 2. Идеальная форма (Perfect Form) `powerhouse.technician.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `duration-scheduler`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

#### 3. Последний удар (Final Blow) `powerhouse.technician.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.technician.3` · `combo` · {"kind":"combo","sequenceKeys":["skirmish","finish"],"actionKey":"finish","apCost":1}.
- **Готовые foundations:** `resource-check`, `action-modifier`, `action-history`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `derived-stats`.

### Несломленный (Unbroken) `powerhouse.unbroken`

#### 1. Встать снова (Get Back Up) `powerhouse.unbroken.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `choice-flow`, `duration-scheduler`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`, `duel-flow`.

#### 2. Яростное возрождение (Furious Revival) `powerhouse.unbroken.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Феникс (Phoenix) `powerhouse.unbroken.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `duel-flow`.

### Хвастун (Braggart) `powerhouse.braggart`

#### 1. Гордыня (Hubris) `powerhouse.braggart.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.braggart.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"powerhouse.braggart.pride","size":6,"initial":0}; Гордость получает сегменты от Атак низкими Атрибутами и попаданий без защитной Реакции; полные часы дают Преимущество..
- **Готовые foundations:** `rule-clock`, `trigger-router`, `reaction-window`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

#### 2. Докажи, чего стоишь (Prove Yourself) `powerhouse.braggart.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.braggart.2` · `passive` · {"kind":"passive"}; При заполнении предлагается очистить часы и уменьшить их размер на 2, минимум до 2..
- **Готовые foundations:** `rule-clock`, `usage-limits`, `trigger-router`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Достойный противник (A Worthy Opponent) `powerhouse.braggart.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `powerhouse.braggart.3` · `passive` · {"kind":"passive"}; Полученная Рана предлагает заполнить сегмент Гордости..
- **Готовые foundations:** `rule-clock`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** До повторного аудита prompt открывался от любой Раны, включая союзный/собственный источник; исправлена обязательная проверка вражеской команды. Нужны UI/network/save-load и stale/duplicate evidence.

### Картечник (Breacher) `powerhouse.breacher`

#### 1. Картечь (Buck Shot) `powerhouse.breacher.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `powerhouse.breacher.1` · `passive` · {"kind":"passive"}; Стычка получает дальность 4; каждая цель в пределах 2 после Успеха проходит обычные Реакции и затем отталкивается на 1 через общий post-hit displacement без добавочного урона..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** До повторного аудита толчок срабатывал при ненулевом уроне от Напряжения даже без Успеха; исправлено отдельным requiresSuccess и negative regression.

#### 2. Из обоих стволов (Both Barrels) `powerhouse.breacher.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Уничтожение (Annihilate) `powerhouse.breacher.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Боец с парным оружием (Dual Wielder) `powerhouse.dual-wielder`

#### 1. Парный удар (Twinned Blow) `powerhouse.dual-wielder.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Неистовый обстрел (Frenzied Barrage) `powerhouse.dual-wielder.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Разные клинки (Varied Blades) `powerhouse.dual-wielder.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Мастер боевых искусств (Martial Artist) `powerhouse.martial-artist`

#### 1. Искусство восьми молотов (Art Of The 8 Hammers) `powerhouse.martial-artist.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Состояние потока (Flow-State) `powerhouse.martial-artist.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `derived-stats`.

#### 3. Бесконечные удары (Unlimited Blows) `powerhouse.martial-artist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мудрец монастыря (Monastic Sage) `powerhouse.monastic-sage`

#### 1. Разум воплощенный (Mind Made Manifest) `powerhouse.monastic-sage.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

#### 2. Меж двух миров (Of Two Worlds) `powerhouse.monastic-sage.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `inventory`.

#### 3. Возвышенная невозмутимость (Sublime Equanimity) `powerhouse.monastic-sage.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

### Копейщик (Lancer) `powerhouse.lancer`

#### 1. Пронзание (Pierce) `powerhouse.lancer.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Фаланга (Phalanx) `powerhouse.lancer.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Рука-пушка (Cannon-Arm) `powerhouse.lancer.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Хищник (Predator) `powerhouse.predator`

#### 1. Тоска (Yearn) `powerhouse.predator.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `information-query`.

#### 2. Одержимость (Obsess) `powerhouse.predator.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`, `information-query`.

#### 3. Пожрать (Devour) `powerhouse.predator.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`.

### Импровизатор (Improvisational Fighter) `powerhouse.improvisational-fighter`

#### 1. Все - инструмент (Everything's A Tool) `powerhouse.improvisational-fighter.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.improvisational-fighter.1.foundation` · `foundation` · {"kind":"foundation","foundation":"terrain","range":5,"types":["terrain","difficult","custom"]}; Поиск, дальность, владение и Здоровье местности готовы; выбор между созданием и удалением пока подтверждает игрок..
- **Готовые foundations:** `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `derived-stats`.

#### 2. Ох! Вот это было больно! (Oh! That One Hurt!) `powerhouse.improvisational-fighter.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

#### 3. Последнее средство (Last Resort) `powerhouse.improvisational-fighter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`, `combat-meter`.

### Воинственный Вознесенный (Warring Ascendant) `powerhouse.warring-ascendant`

#### 1. Небесная рука (Heavenly Arm) `powerhouse.warring-ascendant.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.warring-ascendant.1` · `passive` · {"kind":"passive"}; Зарядка при Напряжении 2+ предлагает однократную трансформацию; массовый толчок и окончание формы при 0 Здоровья автоматизированы. Выбор и временное предоставление трёх уровней оружейной Техники пока требуют отдельного профиля..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `scene-lifecycle`, `transformation`, `combat-meter`, `action-copy`.

#### 2. Эзотерические клинки (Esoteric Blades) `powerhouse.warring-ascendant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

#### 3. Святой меч, Дюрандаль (Saintly Sword, Durandal) `powerhouse.warring-ascendant.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `powerhouse.warring-ascendant.3` · `area` · {"kind":"area","shape":"line","areaType":"attack","duration":"instant","adjacency":true}; Трансформация и Линия проверяются; потеря трансформации и дополнительный урон за каждую цель ещё не разрешаются полностью..
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `transformation`.

## Бродяга (Vagabond)

### Воздушный мастер (Aerial Master) `vagabond.aerial-master`

#### 1. Над и вокруг (Over And Around) `vagabond.aerial-master.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.aerial-master.1.foundation` · `foundation` · {"kind":"foundation","foundation":"stance","stanceId":"vagabond.aerial-master.flight","requiredEffects":["positive.ускорен"]}; Условие входа в Стойку полёта и конфликт с другой Стойкой вычисляются канонически..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `stance`, `terrain`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

#### 2. Парение (Soar) `vagabond.aerial-master.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Падающий удар топором (Falling Ax Strike) `vagabond.aerial-master.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `stance`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `derived-stats`.

### Ассасин (Assassin) `vagabond.assassin`

#### 1. Засада (Ambush) `vagabond.assassin.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.assassin.1` · `passive` · {"kind":"passive"}; Первое Скрыться в пустом журнале Сцены бесплатно и игнорирует требования; нет привязки к последнему Развертыванию, поэтому повторное/позднее Развертывание не покрыто..
- **Готовые foundations:** `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: quickActionSources проверяет пустой журнал действий Сцены, а не первое действие после конкретного Развертывания.

#### 2. Ликвидация (Assassinate) `vagabond.assassin.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.assassin.2` · `passive` · {"kind":"passive"}; Сохраняемый план разрешает отменяемый выбор клетки появления, включая смежную; ядро не добавляет и не валидирует [Ступень] Преимущества и критические успехи на 5–6..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `composite-action`, `dice-hooks`.
- **Нужно добавить:** Заявление decision понижено до partial: composite plan покрывает появление и отмену, но ядро принимает готовый roll и не добавляет/не валидирует [Ступень] Преимущества и крит на 5–6.

#### 3. Скорость тьмы (Speed of Dark) `vagabond.assassin.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.assassin.3` · `combo` · {"kind":"combo","sequenceKeys":["disappear","step"],"actionKey":"step","apCost":0,"selfEffect":"Невидим"}.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `action-modifier`, `action-history`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

### Снайпер (Sniper) `vagabond.sniper`

#### 1. Дальний выстрел (Long Shot) `vagabond.sniper.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Окопаться (Bunker Down) `vagabond.sniper.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`, `spatial-range`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

#### 3. Меткий глаз (Deadeye) `vagabond.sniper.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Застрельщик (Skirmisher) `vagabond.skirmisher`

#### 1. Укол (Sting) `vagabond.skirmisher.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

#### 2. Смещающиеся удары (Shifting Blows) `vagabond.skirmisher.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Отскок (Rebound) `vagabond.skirmisher.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Демон скорости (Speed Demon) `vagabond.speed-demon`

#### 1. Уход в тень (Fade) `vagabond.speed-demon.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. Мгновенный шаг (Flash Step) `vagabond.speed-demon.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.speed-demon.2` · `combo` · {"kind":"combo","sequenceKeys":["breathe","step"],"actionKey":"step","movementMultiplier":3}.
- **Готовые foundations:** `action-modifier`, `action-history`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

#### 3. Мгновенный удар (Flash Strike) `vagabond.speed-demon.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Неуловимый (Untouchable) `vagabond.untouchable`

#### 1. Нырок (Duck) `vagabond.untouchable.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.untouchable.1` · `passive` · {"kind":"passive"}; Первый Уворот за Раунд автоматически получает дополнительное [Талант / 2] Уклонение..
- **Готовые foundations:** `usage-limits`, `trigger-router`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`, `derived-stats`.

#### 2. Маятник (Weave) `vagabond.untouchable.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.untouchable.2` · `passive` · {"kind":"passive"}; Уворот перемещает до 3 клеток; если итоговое Уклонение сводит урон к 0, стол предлагает отменяемое повторное перемещение до 3 клеток и пишет его в журнал..
- **Готовые foundations:** `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** До повторного аудита повторный Dodge предлагался при любом итоговом нуле, даже если Evasion не поглотило урон; исправлено требование `evaded > 0` и добавлен zero-damage regression.

#### 3. Инстинкт бойца (Fighter's Instinct) `vagabond.untouchable.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Акробат (Acrobat) `vagabond.acrobat`

#### 1. Летящий удар ногой (Flying Kick) `vagabond.acrobat.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. Отскок от стены (Wall Jump) `vagabond.acrobat.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `usage-limits`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`, `derived-stats`.

#### 3. Невесомое тело (Weightless Body) `vagabond.acrobat.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Мастер клинка (Blade Master) `vagabond.blade-master`

#### 1. Стойка выхвата (Draw Stance) `vagabond.blade-master.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `stance`, `trigger-router`, `duration-scheduler`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Рассечение одним движением (Divide In One Motion) `vagabond.blade-master.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `stance`, `trigger-router`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Прыгающий карп (Leaping Koi) `vagabond.blade-master.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Хитроумный боец (Cunning Fighter) `vagabond.cunning-fighter`

#### 1. План и исполнение (Plan and Execute) `vagabond.cunning-fighter.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.cunning-fighter.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"vagabond.cunning-fighter.plan","size":4,"initial":0}; Новая цель Изучения заполняет Хитрый план; интерфейс явно предлагает потратить сегмент на Быстрое действие не-Атаки..
- **Готовые foundations:** `target-validation`, `event-participants`, `rule-clock`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`, `scene-lifecycle`, `information-query`.

#### 2. Планы внутри планов (Plans Within Plans) `vagabond.cunning-fighter.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.cunning-fighter.2` · `passive` · {"kind":"passive"}; Снято ограничение одного «Плана и исполнения» за Ход..
- **Готовые foundations:** `usage-limits`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`.

#### 3. С первого взгляда (At a Glance) `vagabond.cunning-fighter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `information-query`.

### Эгоманьяк (Egomaniac) `vagabond.egomaniac`

#### 1. Пиковая форма (Peak Condition) `vagabond.egomaniac.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.egomaniac.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"vagabond.egomaniac.style","size":4,"initial":0}; Четыре условия заполняют Стиль, попадание очищает сегмент, а полные часы запускают получение ОД и выбор прямого перемещения..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `rule-clock`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** До повторного аудита условие «Танец» принимало любое недавнее перемещение при текущей смежности; теперь требуется переход предыдущим действием из несмежной клетки в смежность. Добавлен отрицательный regression для adjacent→adjacent.

#### 2. Дразнить, красоваться, устрашать (Taunt, Flaunt, Daunt) `vagabond.egomaniac.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.egomaniac.2` · `passive` · {"kind":"passive"}; При заполнении Стиля можно отказаться от ОД и выбрать массовый Спровоцирован или Испуган для врагов в пределах 3..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `rule-clock`, `trigger-router`, `choice-flow`, `effect-state`, `effect-lifecycle`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `derived-stats`.

#### 3. Финал (Finale) `vagabond.egomaniac.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.egomaniac.3` · `passive` · {"kind":"passive"}; Зарядка предлагает распределить удвоенное Напряжение через любое число заполнений Стиля, разрешает каждый итог и затем отключает Стиль до конца Сцены..
- **Готовые foundations:** `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`, `combat-meter`.

### Скованный (Enchained) `vagabond.enchained`

#### 1. Выстрел крюком (Hook Shot) `vagabond.enchained.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.enchained.1` · `equidistant-teleport` · {"kind":"equidistant-teleport","range":5}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

#### 2. Притянуть (Draw In) `vagabond.enchained.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Импульс (Momentum) `vagabond.enchained.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Жонглер ножами (Knife Juggler) `vagabond.knife-juggler`

#### 1. Метнуть (Throw) `vagabond.knife-juggler.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.knife-juggler.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"weapons","resourceLabel":"Оружие","initial":4,"replaces":["focus"]}; Метание тратит 1 Оружие, обнуляет стоимость Стычки и меняет выбор цели и дальность..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Пополнение (Resupply) `vagabond.knife-juggler.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.knife-juggler.2` · `passive` · {"kind":"passive"}; После Метания создаётся маркер Оружия; вход предлагает подобрать его, получить Оружие и переместиться. Незакрыто: канонический выбор свободной смежной клетки вместо клетки цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Маркер ставится только в клетку цели; канонический выбор свободной смежной клетки отсутствует.

#### 3. Преследователь (Chaser) `vagabond.knife-juggler.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.knife-juggler.3` · `passive` · {"kind":"passive"}; Выход врага из клетки маркера предлагает телепортацию и оплаченную Быструю Стычку без Метания..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

### Злобный подражатель (Malicious Mimic) `vagabond.malicious-mimic`

#### 1. "Все, что можешь ты..." ("Anything You Can Do...") `vagabond.malicious-mimic.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`, `inventory`, `action-copy`.

#### 2. Отрепетированные движения (Rehearsed Movements) `vagabond.malicious-mimic.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `derived-stats`, `inventory`.

#### 3. "...я могу лучше" ("...I Can Do Better") `vagabond.malicious-mimic.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`, `action-copy`.

### Модифицированный мейстер (Modified Meister) `vagabond.modified-meister`

#### 1. На горячем ходу (Running Hot) `vagabond.modified-meister.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.modified-meister.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"heat","resourceLabel":"Нагрев","initial":0,"replaces":["focus"]}; Стоимость в Фокусе повышает Нагрев, получение Фокуса снижает его; порог 6, сброс до 3 и базовый взрыв разрешаются ядром..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `damage-pipeline`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

#### 2. Перегрузка (Overload) `vagabond.modified-meister.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.modified-meister.2` · `passive` · {"kind":"passive"}; Явный выбор Перегрузки записывает Преимущество, Порчу целей и Нагрев за неуспешные кости после Реакций..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Разгон (Overclock) `vagabond.modified-meister.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.modified-meister.3` · `passive` · {"kind":"passive"}; Передышка при Напряжении 2+ предлагает Разгон; урон создаёт Нагрев, а взрыв предлагает альтернативное разрешение и перемещение..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `trigger-router`, `duration-scheduler`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`, `combat-meter`.

### Оппортунист (Opportunist) `vagabond.opportunist`

#### 1. Стайная тактика (Pack Tactics) `vagabond.opportunist.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `usage-limits`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Голодные глаза (Hungry Eyes) `vagabond.opportunist.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Комбо-подброс (Launcher Combo) `vagabond.opportunist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

### Отражатель (Reflector) `vagabond.reflector`

#### 1. Поймать клинок (Catch The Blade) `vagabond.reflector.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `reaction-window`, `damage-pipeline`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`, `derived-stats`.

#### 2. Смотреть и ждать (Watch And Wait) `vagabond.reflector.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `reaction-window`, `damage-pipeline`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Нести их ярость (To Carry Their Fury) `vagabond.reflector.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`.

### Дим Мак (Dim Mak) `vagabond.dim-mak`

#### 1. Изучить слабость (Study Weakness) `vagabond.dim-mak.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.dim-mak.1` · `passive` · {"kind":"passive"}; Повторное и третье Изучение получают Быстроту по тексту уровня; после Изучения можно поставить привязанную к цели Слабую точку, а Атака с её клетки снимает маркер, становится Быстрой и использует Разум..
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`, `information-query`.

#### 2. Полевая разведка (Field Investigation) `vagabond.dim-mak.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `vagabond.dim-mak.2` · `passive` · {"kind":"passive"}; Промах вражеской Атаки предлагает бесплатное Быстрое Изучение атакующего; снятие Слабой точки автоматически даёт 2 Уклонения..
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `information-query`, `derived-stats`.

#### 3. Казнь по четырем точкам (4-Point Execution) `vagabond.dim-mak.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Пьяница (Drunkard) `vagabond.drunkard`

#### 1. До дна (Down The Hatch) `vagabond.drunkard.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`, `deployment-hooks`.

#### 2. Танец дурака (Fool's Dance) `vagabond.drunkard.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

#### 3. Залпом (Chug) `vagabond.drunkard.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Мастер оружия (Master-At-Arms) `vagabond.master-at-arms`

#### 1. Многогранность (Multi-Faceted) `vagabond.master-at-arms.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.master-at-arms.1` · `armament` · {"kind":"armament"}; Вооружение выбирается вместе со Стычкой; ядро проверяет дистанцию, число целей и повторное экипирование, хранит взаимоисключающий режим, затем ведёт перемещение, Эффекты и толчок. Каждое Вооружение ограничено одним разом за Ход..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `usage-limits`, `exclusive-mode`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Как вода (Like Water) `vagabond.master-at-arms.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `vagabond.master-at-arms.2` · `passive` · {"kind":"passive"}; Второе экипирование за Ход автоматически даёт 1 ОД и Ускорен..
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `exclusive-mode`, `trigger-router`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`, `derived-stats`.

#### 3. Мастер за работой (Master At Work) `vagabond.master-at-arms.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `vagabond.master-at-arms.3` · `passive` · {"kind":"passive"}; Экипированное Вооружение сохраняется как состояние. Сложная геометрия Завершения пока остаётся под подтверждением Нарратора..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `terrain`, `exclusive-mode`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

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
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

#### 3. Ты похож на гвоздь (You Look Like A Nail) `bulwark.crusher.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

### Гигантская фигура (Giant Frame) `bulwark.giant-frame`

#### 1. Огромные руки (Big Arms) `bulwark.giant-frame.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `bulwark.giant-frame.1` · `area` · {"kind":"area","shape":"square2","areaType":"attack","duration":"instant","adjacency":true,"optionMinimum":{"key":"focusSpent","value":1,"label":"дополнительно потрачено Фокуса"}}; Зона, оплата и общий конвейер Атаки поддержаны; замена цели конкретного Завершения Телом ещё не связана атомарно..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Повторная сверка выявила грамматическое рассогласование «одно из этих клеток»; источник RU исправлен на «одна из этих клеток / смежна». Механическая partial-реализация по-прежнему не связана атомарно с Завершением Телом.

#### 2. Исполин (Immense) `bulwark.giant-frame.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `deployment-hooks`, `derived-stats`, `multi-space-actor`.

#### 3. Ударная волна (Shockwave) `bulwark.giant-frame.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Железное тело (Iron Bodied) `bulwark.iron-bodied`

#### 1. Крепкий как камень (Tough As Stone) `bulwark.iron-bodied.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** нет.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`.

#### 2. Выносливость (Resilience) `bulwark.iron-bodied.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `bulwark.iron-bodied.2` · `passive` · {"kind":"passive"}; Броня автоматически включает [Тело / 2]..
- **Готовые foundations:** нет.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `derived-stats`.

#### 3. Нержавеющий шаг (Stainless Stride) `bulwark.iron-bodied.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

### Щит авангарда (Vanguard Defender) `bulwark.vanguard-defender`

#### 1. Белый рыцарь (White Knight) `bulwark.vanguard-defender.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. Стальной ангел (Steel Angel) `bulwark.vanguard-defender.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `duration-scheduler`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

#### 3. Вдохновить мужество (Inspire Courage) `bulwark.vanguard-defender.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Полный ублюдок (Absolute Bastard) `bulwark.absolute-bastard`

#### 1. Легко ненавидеть (Easy To Hate) `bulwark.absolute-bastard.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`, `information-query`.

#### 2. Задира (Bully) `bulwark.absolute-bastard.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`, `derived-stats`.

#### 3. Добавить травму к оскорблению (Add Injury To Insult) `bulwark.absolute-bastard.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Боевой наездник (Battle Jockey) `bulwark.battle-jockey`

#### 1. Верный скакун (Trusty Steed) `bulwark.battle-jockey.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `owned-entities`, `entity-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `summon-turns`, `deployment-hooks`.

#### 2. Хваткие челюсти (Grasping Jaws) `bulwark.battle-jockey.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`.

#### 3. Ревущий выход (Roaring Entry) `bulwark.battle-jockey.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `summon-turns`, `scene-lifecycle`, `turn-lifecycle`.

### Борец-захватчик (Grappler) `bulwark.grappler`

#### 1. Удержание (Restrain) `bulwark.grappler.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Перелом позвоночника (Spine Breaker) `bulwark.grappler.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `bulwark.grappler.2` · `passive` · {"kind":"passive"}; Стычки получают 1 Преимущество. Для единственной Подброшенной цели можно выбрать составной модификатор: Вбить, телепортироваться в свободную смежную клетку и заменить Атаку на Завершение Телом по исходной Стоимости..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

#### 3. Завершающий прием (Finishing Move) `bulwark.grappler.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `duration-scheduler`, `action-modifier`, `composite-action`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Джаггернаут (Juggernaut) `bulwark.juggernaut`

#### 1. Дикий рывок (Wild Charge) `bulwark.juggernaut.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`.

#### 2. Насилие (Violence) `bulwark.juggernaut.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 3. Резкий поворот (Hard Turn) `bulwark.juggernaut.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Обычный (Mundane) `bulwark.mundane`

#### 1. Чего не хватает Духу (For What The Spirit Lacks) `bulwark.mundane.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `bulwark.mundane.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"grit","resourceLabel":"Упорство","initialFormula":"1 + ceil(body / 2)","replaces":["focus","ap"]}; Общий запас оплачивает Фокус и ОД, округляет [Тело / 2] вверх, сбрасывается в начале Раунда; Передышка и Зарядка не пополняют его..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `action-modifier`.
- **Нужно добавить:** До повторного аудита `[Тело / 2]` ошибочно округлялось вниз, вопреки общему правилу Always Round Up (PDF-стр. 22); исправлено на `ceil` и закреплено нечётным Body regression.

#### 2. Копнуть глубже, стоять твердо (Dig Deep, Stand Firm) `bulwark.mundane.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `bulwark.mundane.2` · `passive` · {"kind":"passive"}; Получение предложения Реакции как цели Атаки даёт 1 Упорство..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `trigger-router`, `reaction-window`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Перед лицом Запредельного (In The Face Of The Beyond) `bulwark.mundane.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `bulwark.mundane.3` · `passive` · {"kind":"passive"}; Передышка и Зарядка принимают явный список целей Спровоцированного в пределах 4 и ограничивают его несостоявшимся получением Фокуса..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Восходящий претендент (Rising Challenger) `bulwark.rising-challenger`

#### 1. Идеальное отражение (Perfect Deflection) `bulwark.rising-challenger.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. "Сначала тебе придется пройти через меня!" ("You'll Have To Get Through Me!") `bulwark.rising-challenger.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Драма и злость (Drama And Spite) `bulwark.rising-challenger.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `bulwark.rising-challenger.3` · `passive` · {"kind":"passive"}; В бросок Столкновения автоматически добавляются 3 кости..
- **Готовые foundations:** `dice-hooks`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Рунное возмездие (Runic Retribution) `bulwark.runic-retribution`

#### 1. Удар плетью (Lash) `bulwark.runic-retribution.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Любящий обряд (Loving Rite) `bulwark.runic-retribution.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `information-query`.

#### 3. Преданность (Devotion) `bulwark.runic-retribution.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `duration-scheduler`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Щитоносец (Shield Bearer) `bulwark.shield-bearer`

#### 1. Стена (Wall) `bulwark.shield-bearer.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `reaction-window`, `duration-scheduler`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

#### 2. Удар щитом (Shield Charge) `bulwark.shield-bearer.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Сосредоточенная защита (Focused Defense) `bulwark.shield-bearer.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `derived-stats`.

### Стойкий часовой (Stalwart Sentry) `bulwark.stalwart-sentry`

#### 1. Страж (Guardian) `bulwark.stalwart-sentry.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. На посту (On Watch) `bulwark.stalwart-sentry.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `bulwark.stalwart-sentry.2.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"bulwark.stalwart-sentry.vigilance","size":4,"initial":4}; Выход врага из смежности открывает Наказание с обычной оплатой либо очисткой Бдительности; бросок, Реакции и отмена проходят через общий конвейер..
- **Готовые foundations:** `resource-check`, `rule-clock`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Зона контроля (Zone Of Influence) `bulwark.stalwart-sentry.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `information-query`.

### Звериный Вознесенный (Beastial Ascendant) `bulwark.beastial-ascendant`

#### 1. Звериность (Beastly) `bulwark.beastial-ascendant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `scene-lifecycle`, `transformation`, `combat-meter`, `action-copy`.

#### 2. Наследие (Inheritance) `bulwark.beastial-ascendant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

#### 3. Вершина (Apex) `bulwark.beastial-ascendant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`, `transformation`, `action-copy`.

### Ангел-хранитель (Guardian Angel) `bulwark.guardian-angel`

#### 1. Два тела (Two Bodies) `bulwark.guardian-angel.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `multi-space-actor`.

#### 2. Вместе в жизни (Together In Life) `bulwark.guardian-angel.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Вместе в смерти (Together In Death) `bulwark.guardian-angel.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`, `multi-space-actor`.

### Зов слуги (Servant's Call) `bulwark.servant-s-call`

#### 1. Честь подчиненного (A Subordinate's Honor) `bulwark.servant-s-call.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `bulwark.servant-s-call.1.foundation` · `foundation` · {"kind":"foundation","foundation":"owned-entities","rulePrefix":"bulwark.servant-s-call","kinds":["summon"]}; Призывы собираются по владельцу и источнику правила; создание полноценного участника вместо маркера остаётся следующим этапом.<br>`bulwark.servant-s-call.1` · `marker` · {"kind":"marker","markerKind":"summon","duration":"scene","color":"#6fc9d8"}; Точка призыва ставится в пустую клетку за 1 Фокус с выбором типа и лимитом [Ступень]; полноценный Призыв слуги остаётся следующим этапом ядра сущностей..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `summon-turns`.

#### 2. Гимн героя (Hero's Hymn) `bulwark.servant-s-call.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `duration-scheduler`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `summon-turns`, `turn-lifecycle`.

#### 3. Верховный слуга (Supreme Servant) `bulwark.servant-s-call.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `scene-lifecycle`, `bond-actions`.

### Пилот меха (Mecha Pilot) `bulwark.mecha-pilot`

#### 1. Двигатель рунного ядра (Rune Core Engine) `bulwark.mecha-pilot.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`, `multi-space-actor`.

#### 2. Автономный (Autonomous) `bulwark.mecha-pilot.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `derived-stats`, `multi-space-actor`.

#### 3. Идеальная синхронизация (Perfect Sync) `bulwark.mecha-pilot.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `derived-stats`, `multi-space-actor`.

## Альтруист (Altruist)

### Боевой инструктор (Battle Instructor) `altruist.battle-instructor`

#### 1. Приказ к удару (Strike Order) `altruist.battle-instructor.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `information-query`.

#### 2. Обучающий момент (Teaching Moment) `altruist.battle-instructor.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `reaction-window`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `bond-actions`.

#### 3. Вспомни обучение (Remember Your Training) `altruist.battle-instructor.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `bond-actions`, `scene-lifecycle`.

### Эмпат (Empath) `altruist.empath`

#### 1. Успокаивающая аура (Calming Aura) `altruist.empath.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.empath.1` · `passive` · {"kind":"passive"}; В начале Хода союзника стол предлагает снять один выбранный Эффект и наложить Усилен..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`.

#### 2. Защитный отклик (Protective Response) `altruist.empath.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.empath.2` · `passive` · {"kind":"passive"}; После внешней Раны или Эффекта стол предлагает бесплатный Прорыв в смежную клетку..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `reaction-window`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** До повторного аудита самонанесённая Рана открывала Protective Response, хотя канон исключает source=self; добавлена проверка источника и отрицательный regression.

#### 3. "Ты в порядке?" ("Are You Ok?") `altruist.empath.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.empath.3` · `bond-support` · {"kind":"bond-support"}; В бою оплачивает Поддержку 3 Фокусом и 1 ОД; следующая проверка выбранного союзника игнорирует Помеху или получает Преимущество Ступени..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `bond-actions`.

### Гурман (Gourmand) `altruist.gourmand`

#### 1. Здоровая трапеза (Healthy Meal) `altruist.gourmand.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `damage-pipeline`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`, `intermission-reset`.

#### 2. Бездонная кладовая (Bottomless Pantry) `altruist.gourmand.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `altruist.gourmand.2` · `passive` · {"kind":"passive"}; Запас Трапез автоматически равен 3 за Интермиссию..
- **Готовые foundations:** нет.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `inventory`, `intermission-reset`.

#### 3. Общий опыт (Shared Experiences) `altruist.gourmand.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `bond-actions`, `inventory`.

### Небесный святой (Heavenly Saint) `altruist.heavenly-saint`

#### 1. Сила молитвы (Strength Of Prayer) `altruist.heavenly-saint.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.heavenly-saint.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"faith","resourceLabel":"Вера","initialFormula":"spirit","replaces":["focus"]}; Вера начинается с Духа, не пополняется Передышкой/Зарядкой и растёт при выборе союзника целью..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

#### 2. Очищающий свет (Cleansing Light) `altruist.heavenly-saint.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.heavenly-saint.2` · `passive` · {"kind":"passive"}; Заклинание по союзникам использует лечебное разрешение и явный выбор снимаемых Эффектов..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** До повторного аудита лечение `[Успехи / 2]` ошибочно округлялось вниз; исправлено на Always Round Up и закреплено regression с 3 Успехами → 2 лечения.

#### 3. Великое восстановление (Grand Restoration) `altruist.heavenly-saint.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.heavenly-saint.3` · `passive` · {"kind":"passive"}; Завершение Духом наследует лечение, даёт Регенерацию и один раз за Сцену снимает Рану цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

### Предвидящий (Precognizant) `altruist.precognizant`

#### 1. Вспышка озарения (Flash Of Insight) `altruist.precognizant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `reaction-window`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`.

#### 2. Воспользоваться (Take Advantage) `altruist.precognizant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `derived-stats`.

#### 3. Швырнуть в бесконечность (Hurl Into The Infinite) `altruist.precognizant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Хирург (Surgeon) `altruist.surgeon`

#### 1. Не навреди (Do No Harm) `altruist.surgeon.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.surgeon.1` · `surgery` · {"kind":"surgery"}; Смежный союзник, стоимость и округлённое вверх лечение работают, но ядро принимает готовые successes и не доказывает обязательный бросок Разума..
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Заявление full понижено до partial: core проверяет наличие массива rolls, но доверяет присланным successes и не доказывает обязательный бросок Разума.

#### 2. Операционная процедура (Operational Procedure) `altruist.surgeon.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`, `intermission-reset`.

#### 3. Чудотворец (Miracle Worker) `altruist.surgeon.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`.

### Заклинатель талисманов (Talisman Caster) `altruist.talisman-caster`

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

#### 3. Экзорцизм (Exorcize) `altruist.talisman-caster.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Алхимик (Alchemist) `altruist.alchemist`

#### 1. Быстрая смесь (Quick Mix) `altruist.alchemist.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.alchemist.1` · `inventory` · {"kind":"inventory"}; Создание, запас, дальность и пять одноэффектных Зелий работают; Чистая вода удаляет все Эффекты без канонического выбора подмножества..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Заявление full понижено до partial: Чистая вода удаляет все Эффекты без канонического выбора любого подмножества. Опциональный отказ от создания Зелья и запрет неканонических типов добавлены при повторном аудите.

#### 2. Мощная смесь (Powerful Mix) `altruist.alchemist.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.alchemist.2` · `passive` · {"kind":"passive"}; Фокус союзнику работает; для врага нужен отсутствующий канонический выбор, наносить ли урон..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Урон зельем по врагу применяется обязательно, хотя канон требует опциональный выбор.

#### 3. Высокоинтенсивная смесь (High Intensity Mix) `altruist.alchemist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`.

### Хрономант (Chronomancer) `altruist.chronomancer`

#### 1. Ускорение (Accelerate) `altruist.chronomancer.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. Замедление (Decelerate) `altruist.chronomancer.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.chronomancer.2` · `passive` · {"kind":"passive"}; Заклинания получают 1 Преимущество; удаление Эффекта открывает перепроверяемое окно повторного применения за 1 Фокус..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Реестр заявлял manual, хотя core уже выдаёт 1 Преимущество Заклинаниям и ведёт prompt повторного применения снятого Эффекта за 1 Фокус; добавлен честный decision-adapter. Полный surface evidence отсутствует.

#### 3. Остановка времени (Time Stop) `altruist.chronomancer.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.chronomancer.3.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"altruist.chronomancer.flow","size":8,"initial":0}; Полный Поток в начале Хода предлагает однократное массовое Заклинание, тратит все ОД и поддерживает Ва-банк с Раной и Завершением против врагов..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`, `scene-lifecycle`, `duel-flow`.

### Танцор (Dancer) `altruist.dancer`

#### 1. Партнер по танцу (Dance Partner) `altruist.dancer.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

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
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `composite-action`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Мистическая дымка (Mystic Mist) `altruist.fog-walker.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `owned-entities`, `entity-lifecycle`, `trigger-router`, `composite-action`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`.

#### 3. Жалящий пар (Stinging Steam) `altruist.fog-walker.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Последняя надежда (Last Hope) `altruist.last-hope`

#### 1. Примечательно отсутствует (Notably Absent) `altruist.last-hope.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Героическое возвращение (Heroic Return) `altruist.last-hope.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `duration-scheduler`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`, `combat-meter`.

#### 3. Взрывное возвращение (Explosive Return) `altruist.last-hope.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`, `reaction-window`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

### Репликатор (Replicator) `altruist.replicator`

#### 1. Форма эха (Echo Form) `altruist.replicator.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Симметрия (Symmetry) `altruist.replicator.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `owned-entities`, `entity-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Полная синхронизация (Full Sync) `altruist.replicator.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

### Блуждающий огонек (Will-O-Wisp) `altruist.will-o-wisp`

#### 1. Пламя духовного плетения (Spirit Weaving Flame) `altruist.will-o-wisp.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.will-o-wisp.1` · `passive` · {"kind":"passive"}; Первая Зарядка, выбранная аура и ручное движение Пламени работают; обязательный толчок маркера при атаке его клетки отсутствует..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Заявление decision понижено до partial: первая Зарядка, аура и выбранное движение есть, но Пламя не толкается на 1 клетку, когда Атака выбирает целью его клетку.

#### 2. Дружелюбные духи (Friendly Spirits) `altruist.will-o-wisp.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `altruist.will-o-wisp.2` · `passive` · {"kind":"passive"}; Выход из Пламени вызывает выбор, но enemy movement уже разрешён целиком и затем откатывается: путь не обрывается до downstream enter-триггеров..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`.
- **Нужно добавить:** Заявление decision понижено до partial: остановка врага происходит после полного actor.move и ретроспективно возвращает его в первую клетку выхода, поэтому downstream enter/path-триггеры уже могли сработать за канонической точкой остановки.

#### 3. Парные духи (Twinned Spirits) `altruist.will-o-wisp.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `altruist.will-o-wisp.3` · `passive` · {"kind":"passive"}; Поддерживаются одно Пламя с двумя свойствами либо два независимых Пламени..
- **Готовые foundations:** `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Художник (Artist) `altruist.artist`

#### 1. Взмах кисти (Stroke Of The Brush) `altruist.artist.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Холст из плоти (Canvas Of Flesh) `altruist.artist.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Клеймо кисти (Brush-Brand) `altruist.artist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

### Ученый бард (Bardic Savant) `altruist.bardic-savant`

#### 1. Музыкант (Musician) `altruist.bardic-savant.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `inventory`.

#### 2. Быстрая композиция (Quick Composition) `altruist.bardic-savant.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`, `turn-lifecycle`.

#### 3. На бис (Encore) `altruist.bardic-savant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`.

### Сборщик колоды (Deckbuilder) `altruist.deckbuilder`

#### 1. Добор (Draw) `altruist.deckbuilder.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `inventory`, `scene-lifecycle`.

#### 2. Карточная ловушка (Card Trap) `altruist.deckbuilder.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`.

#### 3. Жадность (Greed) `altruist.deckbuilder.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `usage-limits`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`.

## Подрывник (Disruptor)

### Кровопускатель (Bloodletter) `disruptor.bloodletter`

#### 1. Кровоточащее лезвие (Bleeding Edge) `disruptor.bloodletter.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Ищейка (Bloodhound) `disruptor.bloodletter.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Разрыв (Rupture) `disruptor.bloodletter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Химик (Chemist) `disruptor.chemist`

#### 1. Сублимация (Sublimation) `disruptor.chemist.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.chemist.1` · `area` · {"kind":"area","shape":"square3","areaType":"gas","duration":"nextTurn"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `duration-scheduler`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`, `derived-stats`.

#### 2. Экспериментальная смесь (Experimental Mixture) `disruptor.chemist.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.chemist.2` · `passive` · {"kind":"passive"}; Незакрыто: опциональный запрос Нарратору о скрытом Здоровье; текущий автоматический KO не может заменять это решение..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Здоровье цели читается и KO применяется автоматически вместо вопроса Нарратору.

#### 3. Осаждение (Deposition) `disruptor.chemist.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.chemist.3` · `passive` · {"kind":"passive"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Душитель (Constrictor) `disruptor.constrictor`

#### 1. Обвить (Wrap) `disruptor.constrictor.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.constrictor.1` · `passive` · {"kind":"passive"}; Успешная одиночная Стычка накладывает Пойман; движение источника предлагает притянуть цели, а конец Хода — по очереди переместить их на расстояние до 5 клеток..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Удушение (Choke) `disruptor.constrictor.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.constrictor.2` · `passive` · {"kind":"passive"}; Завершения Телом и Талантом игнорируют дальность для собственных Пойманных целей, а любое Завершение наносит им дополнительный урон Ступени..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Скручивающий удар (Twisting Impact) `disruptor.constrictor.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Карманник (Cutpurse) `disruptor.cutpurse`

#### 1. Ловкие руки (Fast Hands) `disruptor.cutpurse.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Урвать (Snatch) `disruptor.cutpurse.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Вор в ночи (Thief In The Night) `disruptor.cutpurse.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `usage-limits`, `trigger-router`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Морок (Mind Breaker) `disruptor.mind-breaker`

#### 1. "Где вы?" ("Where Are You?") `disruptor.mind-breaker.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. "Что вы делаете?" ("What Do You Do?") `disruptor.mind-breaker.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. "Кто они?" ("Who Are They?") `disruptor.mind-breaker.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Жнец (Reaper) `disruptor.reaper`

#### 1. Посев (Sow) `disruptor.reaper.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Уход (Tend) `disruptor.reaper.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `duration-scheduler`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

#### 3. Жатва (Reap) `disruptor.reaper.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

### Мастер тактики (Tactical Master) `disruptor.tactical-master`

#### 1. Остановиться и подумать (Stop And Think) `disruptor.tactical-master.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `stance`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`.

#### 2. Анализ (Study) `disruptor.tactical-master.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Эврика! (Eureka!) `disruptor.tactical-master.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `stance`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `derived-stats`.

### Автофаг (Autophage) `disruptor.autophage`

#### 1. Переливание (Transfusion) `disruptor.autophage.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.autophage.1.foundation` · `foundation` · {"kind":"foundation","foundation":"alternate-resource","resource":"health","resourceLabel":"Здоровье","initial":0,"replaces":["focus"]}; Трата Фокуса создаёт оплату уроном 2:1 через конвейер урона; получение Фокуса создаёт лечение 1:1, а успешная Атака цели с двумя Эффектами запускает Регенерацию..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Перенапряжение (Overexert) `disruptor.autophage.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.autophage.2` · `autophage-overexert` · {"kind":"autophage-overexert"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Рожденный изменчивой плотью (Born Of Mutable Flesh) `disruptor.autophage.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.autophage.3` · `autophage-overexert` · {"kind":"autophage-overexert","double":true}.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

### Говорящий с землей (Earth Speaker) `disruptor.earth-speaker`

#### 1. Тектонический сдвиг (Tectonic Shift) `disruptor.earth-speaker.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. Земляные осколки (Earthen Shards) `disruptor.earth-speaker.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 3. Каменные солдаты (Stone Soldiers) `disruptor.earth-speaker.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Нечеловеческая сила (Inhuman Strength) `disruptor.inhuman-strength`

#### 1. Сильная рука (Strong-Arm) `disruptor.inhuman-strength.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 2. Поршневой кулак (Piston Fist) `disruptor.inhuman-strength.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `derived-stats`.

#### 3. Проломить насквозь (Smash Through) `disruptor.inhuman-strength.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Уличный боец (Street Fighter) `disruptor.street-fighter`

#### 1. Кровавые кастеты (Bloody Brass) `disruptor.street-fighter.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Ломать и калечить (Break And Bruise) `disruptor.street-fighter.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 3. Зверствовать (Brutalize) `disruptor.street-fighter.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Тело-рой (Swarm Body) `disruptor.swarm-body`

#### 1. Порхающая форма (Fluttering Form) `disruptor.swarm-body.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Исчезнуть в мухах (Vanish Into Flies) `disruptor.swarm-body.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Пожрать (Devour) `disruptor.swarm-body.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Сирена (Siren) `disruptor.siren`

#### 1. Ты ведь не причинишь МНЕ боль? (You wouldn't hurt ME, would you?) `disruptor.siren.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.siren.1` · `passive` · {"kind":"passive"}; После Изучения врага стол предлагает наложить Испуган, повторно проверяет цель и общий лимит 3 раза за Сцену и фиксирует применение отдельным событием..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`, `information-query`.

#### 2. Неотразимая (Irresistible) `disruptor.siren.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.siren.2` · `passive` · {"kind":"passive"}; Первое за Ход наложение Испуган открывает отменяемый выбор клетки: путь цели до 3 клеток проверяется пошагово на приближение к Сирене, а смежный итог отдельно предлагает наложить Ошеломлен..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`.

#### 3. Помогите-ка сюда (A little help over here?) `disruptor.siren.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Всадник волн (Wave Rider) `disruptor.wave-rider`

#### 1. Мягкие волны (Gentle Waves) `disruptor.wave-rider.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.wave-rider.1` · `marker` · {"kind":"marker","markerKind":"ritual","duration":"scene","color":"#3fa9d4"}; Печати сохраняются с лимитом 4+Ступень, а владелец разрешает их срабатывание; Быстрота и бесплатность первого подходящего Заклинания ещё не подключены..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Мощные волны (Momentous Waves) `disruptor.wave-rider.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 3. Водяная клетка (Aqua Cage) `disruptor.wave-rider.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`.

### Шагающий по буре (Gale Strider) `disruptor.gale-strider`

#### 1. Растущие ветра (Growing Winds) `disruptor.gale-strider.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.gale-strider.1` · `area` · {"kind":"area","shape":"square3","areaType":"danger","duration":"scene"}; Тайфун заменяет прежний и его групповое смещение разрешается владельцем; размещение после Заклинания или Прыжка пока запускается отдельно..
- **Готовые foundations:** `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `action-history`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Восходящий поток (Updraft) `disruptor.gale-strider.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 3. Рассекатель гор (Mountain Carver) `disruptor.gale-strider.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

### Охотник (Hunter) `disruptor.hunter`

#### 1. Стальные челюсти (Steel Jaws) `disruptor.hunter.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.hunter.1` · `trap-placement` · {"kind":"trap-placement","markerKind":"trap","duration":"scene","color":"#c28a45"}.
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `reaction-window`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

#### 2. Дальняя установка (Far Setting) `disruptor.hunter.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `disruptor.hunter.2` · `passive` · {"kind":"passive"}; Дальность пустой Стычки и Обездвиживание цели ловушки учитываются автоматически..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Яма-ловушка (Pit Trap) `disruptor.hunter.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.hunter.3` · `area` · {"kind":"area","shape":"square2","areaType":"terrain","duration":"scene"}; Геометрия ямы поддержана; объединение четырёх ловушек и Завершение Разумом ещё не автоматизированы..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Внутренний мир (Inner World) `disruptor.inner-world`

#### 1. Глубокий взгляд (Gaze Deeply) `disruptor.inner-world.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.inner-world.1` · `passive` · {"kind":"passive"}; После Зарядки предлагает отказаться от фактически полученного Фокуса и наложить Обездвижен на врагов в соответствующей дальности..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Домен контроля (Domain Of Control) `disruptor.inner-world.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `disruptor.inner-world.2` · `space` · {"kind":"space","spaceName":"Внутренний мир","width":3,"height":3}; После наложения Эффекта предлагает перенос выбранных участников в отдельное пространство 3×3 с возвратом на край поля при Ране или нокауте..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `scene-lifecycle`.

#### 3. Родная территория (Home Turf) `disruptor.inner-world.3`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `disruptor.inner-world.3` · `passive` · {"kind":"passive"}; Бонус Атак и Дуэлей и увеличенный лимит Домена применяются автоматически; составной выбор Домена остаётся решением игрока..
- **Готовые foundations:** `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`, `duel-flow`.

### Магическая схема (Mage's Array) `disruptor.mage-s-array`

#### 1. Начертание (Inscribe) `disruptor.mage-s-array.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Корректировка (Readjust) `disruptor.mage-s-array.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Тюрьма собственного замысла (Prison Of Your Own Design) `disruptor.mage-s-array.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

## Разрушитель (Ruiner)

### Бомбардир (Bombardier) `ruiner.bombardier`

#### 1. Взрыв!! (Explosion!!) `ruiner.bombardier.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.bombardier.1` · `area` · {"kind":"area","shape":"adjacent","areaType":"attack","duration":"instant","range":4}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Взрыв!!! (Explosion!!!) `ruiner.bombardier.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.bombardier.2` · `area` · {"kind":"area","shape":"square3","areaType":"attack","duration":"instant","range":5,"optionMinimum":{"key":"focusSpent","value":2,"label":"потрачено Фокуса"}}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. ВЗРЫВ!!!! (EXPLOSION!!!!) `ruiner.bombardier.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.bombardier.3` · `area` · {"kind":"area","shape":"square5","areaType":"attack","duration":"instant","range":6,"optionMinimum":{"key":"focusSpent","value":4,"label":"потрачено Фокуса"}}; Зона, цели, трата Фокуса, Реакции и урон разрешаются общим конвейером зональной Атаки..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Револьверное колдовство (Rapid-Fire Sorcery) `ruiner.rapid-fire-sorcery`

#### 1. Размножение (Proliferate) `ruiner.rapid-fire-sorcery.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Выжженная земля (Scorched Earth) `ruiner.rapid-fire-sorcery.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.rapid-fire-sorcery.2` · `area` · {"kind":"area","shape":"cell","areaType":"difficult","duration":"scene"}; Размещение трудной местности поддержано; создание только после урона пустой клетке и входной урон ещё требуют общего конвейера..
- **Готовые foundations:** `target-validation`, `event-participants`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`.

#### 3. Бесконечный огонь (Endless Fire) `ruiner.rapid-fire-sorcery.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `combat-meter`.

### Ритуалист (Ritualist) `ruiner.ritualist`

#### 1. Лей-линии (Ley Lines) `ruiner.ritualist.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.ritualist.1` · `marker` · {"kind":"marker","markerKind":"ritual","duration":"scene","color":"#6fc9d8"}; Заклинательный круг ставится только в текущую клетку героя, заменяет его прежний круг и повышает предел Фокуса Завершения Духом; решение после Зарядки остаётся явным..
- **Готовые foundations:** `resource-check`, `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `combat-meter`.

#### 2. Магическая артиллерия (Arcane Artillery) `ruiner.ritualist.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `spatial-range`, `terrain`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `combat-meter`.

#### 3. Фрактальные начертания (Fractal Etchings) `ruiner.ritualist.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `terrain`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `scene-lifecycle`.

### Творец заклинаний (Spellcrafter) `ruiner.spellcrafter`

#### 1. Эксперимент (Experimentation) `ruiner.spellcrafter.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.spellcrafter.1` · `modifier-choice` · {"kind":"modifier-choice"}; Игрок выбирает Модификацию; ядро не угадывает выбранный вариант..
- **Готовые foundations:** `spatial-cells`, `spatial-range`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `inventory`, `scene-lifecycle`, `derived-stats`.

#### 2. Закрепление (Solidification) `ruiner.spellcrafter.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.spellcrafter.2` · `modifier-choice` · {"kind":"modifier-choice"}; Оплата Новаторства Фокусом требует выбора игрока..
- **Готовые foundations:** `resource-check`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `inventory`, `derived-stats`.

#### 3. Финализация (Finalization) `ruiner.spellcrafter.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.spellcrafter.3` · `modifier-choice` · {"kind":"modifier-choice"}; Можно выбрать две разные Модификации и оплатить обе..
- **Готовые foundations:** `resource-check`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `inventory`.

### Ученик звезд (Student Of Stars) `ruiner.student-of-stars`

#### 1. Высвобожденная мощь (Power Unleashed) `ruiner.student-of-stars.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `combat-meter`.

#### 2. Бесформенная сила (Formless Strength) `ruiner.student-of-stars.2`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.student-of-stars.2-line` · `area` · {"kind":"area","shape":"line","areaType":"attack","duration":"instant"}; Геометрия зональной Атаки поддержана, но она ещё не связана строго с «Высвобожденной мощью».<br>`ruiner.student-of-stars.2-zone` · `area` · {"kind":"area","shape":"square2","areaType":"attack","duration":"instant"}; Геометрия зональной Атаки поддержана, но она ещё не связана строго с «Высвобожденной мощью»..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `choice-flow`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 3. Момент истины (Moment Of Truth) `ruiner.student-of-stars.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `duel-flow`.

### Криомант (Cryomancer) `ruiner.cryomancer`

#### 1. Охлаждение (Chill) `ruiner.cryomancer.1`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.cryomancer.1` · `passive` · {"kind":"passive"}; Успешное Заклинание после разрешения Реакций автоматически накладывает Замедлен на доступные цели..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `action-modifier`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

#### 2. Ледяной нимб (Icicle Halo) `ruiner.cryomancer.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.cryomancer.2.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.cryomancer.icicle","size":4,"initial":0}; Передышка предлагает отказаться от Фокуса, очистить Сосульку и провести ограниченную серию Быстрых Заклинаний с половинным уроном, Реакциями и превращением Замедлен в Обездвижен..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

#### 3. Раскол (Shatter) `ruiner.cryomancer.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `information-query`.

### Драматург (Dramaturge) `ruiner.dramaturge`

#### 1. Все смотрят на меня (All Eyes On Me) `ruiner.dramaturge.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `combat-meter`.

#### 2. Украсть их огонь (Snatch Their Fire) `ruiner.dramaturge.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `turn-lifecycle`, `combat-meter`.

#### 3. Сила подачи (Power In Presentation) `ruiner.dramaturge.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `combat-meter`.

### Дикая магия (Feral Arcana) `ruiner.feral-arcana`

#### 1. Ворпальный коготь (Vorpal Claw) `ruiner.feral-arcana.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Сорваться с цепи (Unchain) `ruiner.feral-arcana.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.feral-arcana.2.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.feral-arcana.rage","size":6,"initial":0}; Создание и жизненный цикл Ярости, ограничения ОД, Быстрые Прыжки и обязательное бесплатное Заклинание по всем смежным персонажам проходят через цели, Реакции, отмену и журнал..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`, `duration-scheduler`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `turn-lifecycle`, `combat-meter`.

#### 3. Хватка (Grasp) `ruiner.feral-arcana.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.feral-arcana.3` · `passive` · {"kind":"passive"}; Завершение Телом может потратить всю Ярость, получить Преимущество от Напряжения и переместиться до 3 клеток перед созданием Атаки..
- **Готовые foundations:** `target-validation`, `event-participants`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `combat-meter`.

### Пламенное сердце (Flame Heart) `ruiner.flame-heart`

#### 1. Разогрев (Rev Up) `ruiner.flame-heart.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

#### 2. Проклятый удар (Damning Impact) `ruiner.flame-heart.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `combat-meter`.

#### 3. Прах к праху (Ashes To Ashes) `ruiner.flame-heart.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.

### Мрачный Вознесенный (Grim Ascendant) `ruiner.grim-ascendant`

#### 1. Непостоянная мощь (Impermanent Power) `ruiner.grim-ascendant.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.grim-ascendant.1` · `passive` · {"kind":"passive"}; После подходящей Зарядки стол предлагает трансформацию и полностью ведёт перенаправление Здоровья, Фокуса, толчок и завершение формы..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `effect-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `scene-lifecycle`, `derived-stats`, `transformation`, `combat-meter`.

#### 2. Вытянуть жизнь (Drain Life) `ruiner.grim-ascendant.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.grim-ascendant.2` · `state-toggle` · {"kind":"state-toggle","stateKey":"drainLife"}; Включите перед Завершением Духом: урон будет округлён вверх пополам, а Успех даст Регенерацию..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `transformation`.

#### 3. Умбра (Umbra) `ruiner.grim-ascendant.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`.

### Сильное натяжение (Long Draw) `ruiner.long-draw`

#### 1. Наложить стрелу (Nock The Arrow) `ruiner.long-draw.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`.

#### 2. Перьевой шаг (Feather Step) `ruiner.long-draw.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `inventory`.

#### 3. Пронзитель владык (Lord Piercer) `ruiner.long-draw.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `inventory`, `scene-lifecycle`.

### Клинки маны (Mana Blades) `ruiner.mana-blades`

#### 1. К оружию (Call Arms) `ruiner.mana-blades.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `action-copy`.

#### 2. Орудия павших (Tools Of The Fallen) `ruiner.mana-blades.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`.

#### 3. Святой меч, Экскалибур (Saintly Sword, Excalibur) `ruiner.mana-blades.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `transformation`, `action-copy`.

### Душа пустоты (Void Soul) `ruiner.void-soul`

#### 1. Возвращение в ничто (Return To Nothing) `ruiner.void-soul.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `trigger-router`, `duration-scheduler`, `choice-flow`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 2. Раствориться (Fade Away) `ruiner.void-soul.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `usage-limits`, `trigger-router`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `turn-lifecycle`.

#### 3. Полое сердце (Hollow Heart) `ruiner.void-soul.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.void-soul.3.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.void-soul.void","size":6,"initial":0}; Полная Пустота открывает Завершение Духом по всем врагам центральной зоны 5×5 с половинным уроном и обычными Реакциями..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `scene-lifecycle`.

### Громовая кровь (Thunder Blood) `ruiner.thunder-blood`

#### 1. Райден (Raiden) `ruiner.thunder-blood.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.thunder-blood.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.thunder-blood.static","size":6,"initial":0}; Передышка предлагает заполнить Статику; непустая Статика автоматически снимает Ошеломлен..
- **Готовые foundations:** `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

#### 2. Заряженное заклинание (Energized Incantation) `ruiner.thunder-blood.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.thunder-blood.2` · `passive` · {"kind":"passive"}; После успешного Заклинания явный выбор исходной цели проводит Скачок, Разряд или Цепь через расход Статики, Ошеломление, проверку целей, новый бросок, Реакции, отмену и журнал..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

#### 3. Разрядка (Discharge) `ruiner.thunder-blood.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.thunder-blood.3` · `passive` · {"kind":"passive"}; При 3+ Статики Завершение Духом собирает зону 3×3 без владельца, добавляет Ступень урона уже Ошеломленным и после Успеха накладывает Ошеломлен..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Фанатик (Zealot) `ruiner.zealot`

#### 1. Еретическая преданность (Heretical Devotion) `ruiner.zealot.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.zealot.1.foundation` · `foundation` · {"kind":"foundation","foundation":"clock","clockId":"ruiner.zealot.revelation","size":6,"initial":0}; Публичный бросок с единицей предлагает потратить Фокус и заполнить Озарение; Зарядка, Заклинание и Завершение Духом умеют потратить сегмент и инвертировать итоговые Успехи..
- **Готовые foundations:** `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `scene-lifecycle`.

#### 2. Всегда под взглядом, утоплен в слезах (Always Watched, Drowned In Tears) `ruiner.zealot.2`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.zealot.2` · `passive` · {"kind":"passive"}; Начало Хода при четырёх сегментах предлагает Усиление и записывает отдельное наложение Испуган каждым персонажем..
- **Готовые foundations:** `target-validation`, `event-participants`, `effect-state`, `effect-lifecycle`, `rule-clock`, `trigger-router`, `choice-flow`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`.

#### 3. Так не должно было быть (Never Meant To Be) `ruiner.zealot.3`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.zealot.3` · `passive` · {"kind":"passive"}; Полное Озарение открывает Завершение Духом по двум пересекающимся Линиям; стол последовательно проверяет сдвиг каждого персонажа, атомарно очищает часы, уничтожает связанную местность, удаляет клетки и ведёт обычную цепочку Реакций..
- **Готовые foundations:** `target-validation`, `event-participants`, `rule-clock`, `terrain`, `spatial-topology`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`.

### Аскет творения (Creation Ascetic) `ruiner.creation-ascetic`

#### 1. Формирование знаков (Forming Signs) `ruiner.creation-ascetic.1`

- **Заявленный статус:** `decision` (решение).
- **Текущий адаптер:** `ruiner.creation-ascetic.1` · `resource-replacement` · {"kind":"resource-replacement"}; Метки творения заменяют Фокус; обычная Атака с Метками направляется к подходящей форме.<br>`ruiner.creation-ascetic.1.nails` · `creation-attack` · {"kind":"creation-attack","actionKey":"spell","markBand":"low","form":"nails"}<br>`ruiner.creation-ascetic.1.mallet` · `creation-attack` · {"kind":"creation-attack","actionKey":"spell","markBand":"high","form":"mallet"}<br>`ruiner.creation-ascetic.1.pile-arm` · `creation-attack` · {"kind":"creation-attack","actionKey":"finish","markBand":"low","form":"pile-arm","advantage":2}<br>`ruiner.creation-ascetic.1.idol` · `creation-attack` · {"kind":"creation-attack","actionKey":"finish","markBand":"high","form":"idol","advantage":4}.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `spatial-range`, `resource-check`, `alternate-resource`, `terrain`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `movement-lifecycle`, `scene-lifecycle`.

#### 2. Один истинный мир (One True World) `ruiner.creation-ascetic.2`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.creation-ascetic.2` · `passive` · {"kind":"passive"}; Передышка, Зарядка и получение Меток от повреждения или уничтожения местности автоматизированы..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `terrain`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Сохранить существующий adapter и добавить недостающий контракт: `turn-lifecycle`.

#### 3. Труд благочестивых (Labor Of The Devout) `ruiner.creation-ascetic.3`

- **Заявленный статус:** `full` (полная).
- **Текущий адаптер:** `ruiner.creation-ascetic.3` · `passive` · {"kind":"passive"}; Форма Завершения получает число Меток непосредственно предшествовавшего Заклинания..
- **Готовые foundations:** `resource-check`, `alternate-resource`, `action-modifier`, `action-history`.
- **Нужно добавить:** Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.

### Эго-оружие (Ego Arm) `ruiner.ego-arm`

#### 1. Я - твой меч (I Am Your Sword) `ruiner.ego-arm.1`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `deployment-hooks`, `transformation`.

#### 2. Покажи свои цели (Show Your Targets) `ruiner.ego-arm.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** `ruiner.ego-arm.2` · `marker` · {"kind":"marker","markerKind":"damocles","duration":"scene","color":"#d04f64"}; Нужна модель носителя/трансформации: в каноне маркеры ставятся в конце Хода на клетках всех врагов, атакованных носителем; текущий произвольный выбор клетки нельзя показывать как автоматизацию..
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`.
- **Нужно добавить:** Нет модели носителя, конца его Хода и множества атакованных им врагов.

#### 3. И я стану незаменимым (And I'll Become Irreplaceable) `ruiner.ego-arm.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `derived-stats`.

### Зов наемника (Sellsword's Call) `ruiner.sellsword-s-call`

#### 1. Реприза воина (A Warrior's Reprise) `ruiner.sellsword-s-call.1`

- **Заявленный статус:** `partial` (частичная).
- **Текущий адаптер:** `ruiner.sellsword-s-call.1` · `marker` · {"kind":"marker","markerKind":"summon","duration":"scene","color":"#6fc9d8"}; Точка призыва ставится только в пустую клетку за 1 Фокус, с выбором типа и лимитом [Ступень/2]. Незакрыто: полноценный Призыв-участник с 1 Здоровьем, профильной Атакой, половиной урона и Ходом..
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`.
- **Нужно добавить:** Создаётся marker, а не Призыв-actor с HP, атакой, половиной урона и Ходом.

#### 2. Боевой гимн (Battle Hymn) `ruiner.sellsword-s-call.2`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `resource-check`, `effect-state`, `effect-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `movement-lifecycle`, `summon-turns`.

#### 3. Верховный наемник (Supreme Sellsword) `ruiner.sellsword-s-call.3`

- **Заявленный статус:** `manual` (ручная).
- **Текущий адаптер:** нет записи в `RULES`.
- **Готовые foundations:** `target-validation`, `event-participants`, `spatial-cells`, `resource-check`, `owned-entities`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`.
- **Нужно добавить:** Зарегистрировать отдельный адаптер и закрыть зависимости: `summon-turns`, `scene-lifecycle`, `bond-actions`, `deployment-hooks`.
