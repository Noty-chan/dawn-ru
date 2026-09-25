# DAWN: кодовая спецификация способностей врагов

> Сгенерировано `npm run docs:rules` из новой канонической редакции `apps/companion/edition-lionwing.js` и RU-оверлея `apps/companion/edition-lionwing-ru.js` (SHA-256 `0d33233035d2cfa60687be701b1d10b4ebbbc1367c7c12e39abea1dec8049e6f`).
> Английский текст и механика берутся из canonical EN; русские названия и тексты — из отдельного reviewed RU overlay. Legacy-редакция в этот документ не входит.

## Границы и правило честности

Код не интерпретирует прозу врага на лету. Он использует типизированные реестры `scene-actions.js`; всё, что не вошло в них целиком, имеет статус `assisted` и остаётся решением Нарратора. Для канона смотрите `ENEMIES-RU-EN-CATALOG.md`.

## Работающие семейства

| Семейство | Вход → результат | Реестр / модуль |
| --- | --- | --- |
| Обычная автоматическая атака | `prepareEnemyRule` валидирует actor/AP/цели/roll → `attack.pending` → реакции → damage/effects/reward | `ENEMY_AUTO_ATTACK_RULES`, `scene-actions.js` |
| Семейная атака | Базовая атака дополняется явной конфигурацией range/area/effects/push/teleport/target cap | `ENEMY_ATTACK_FAMILY_RULES` |
| Эффектное правило | Валидирует цель и публикует typed effect/state event без броска атаки | `ENEMY_AUTO_EFFECT_RULES` |
| Специальное полное правило | Диспетчер выбирает named resolver: state, delayed prompt, heal, turn grant, summon | `ENEMY_FULL_RULES`, `prepareEnemyRule`, `respondRulePrompt` |
| Общие гарантии | event versioning, cancellation before payment, target revalidation, реакции, журнал, persistence normalization | `scene-engine-core.js`, `scene-events.js`, `scene-responses.js` |

## Нужные семейства

| Семейство | Почему нужно |
| --- | --- |
| Typed crowd movement | Нужен для всех последствий, которые сдвигают зоны массовки атомарно и без наложений. |
| Полноценные summons | Нужны HP, профиль, controller, половина урона и делегированный Ход, а не marker. |
| Связанные delayed/chained actions | Нужны для follow-up союзника, отложенных path и реакций Черточек Антагониста. |
| Formula-only direct damage | Нужен для правил, где UI не должен передавать произвольное число урона. |
| Нарраторский information query | Нужен, когда канон запрашивает скрытую информацию, а не разрешает прочитать state напрямую. |

## Формат каждого правила

`request = { actorId, ruleId, targetIds, anchor, roll, options }`; затем `prepareEnemyRule` обязан валидировать живого владельца, AP/Напряжение, тип и геометрию цели. Атаки создают pending-цепочку, эффекты — typed events, специальные правила вызывают named resolver. Статус `assisted` запрещает считать частичную конфигурацию заменой канонической ветки.

## Обычные враги

### Убийца (Assassin) `lionwing.npc.assassin`

#### Устранить цель `lionwing.npc.assassin.neutralize-target`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:180`, `scene-actions.js:200`, `scene-actions.js:374`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Рассечение `lionwing.npc.assassin.slice`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:29`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Hidden Blades `lionwing.npc.assassin.hidden-blades`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Громила (Bruiser) `lionwing.npc.bruiser`

#### Избиение `lionwing.npc.bruiser.beatdown`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Грязный прием `lionwing.npc.bruiser.skulduggery`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:30`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Decimate `lionwing.npc.bruiser.decimate`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Бегемот (Behemoth) `lionwing.npc.behemoth`

#### Прыжок `lionwing.npc.behemoth.leap`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Вырвать из земли `lionwing.npc.behemoth.tore-from-earth`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:31`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Meteor `lionwing.npc.behemoth.meteor`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":5,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Ловец (Captor) `lionwing.npc.captor`

#### Ждать и наблюдать `lionwing.npc.captor.watch-and-wait`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Поймать и отпустить `lionwing.npc.captor.catch-and-release`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:32`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Sticky Bomb `lionwing.npc.captor.sticky-bomb`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Палач (Executioner) `lionwing.npc.executioner`

#### Собраться `lionwing.npc.executioner.focus`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:181`, `scene-actions.js:201`, `scene-actions.js:371`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Разруб `lionwing.npc.executioner.cleave`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:33`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Bifurcate `lionwing.npc.executioner.bifurcate`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Джавелин (Javelin) `lionwing.npc.javelin`

#### Призыв `lionwing.npc.javelin.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:253`, `scene-actions.js:383`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Сокрушительный удар `lionwing.npc.javelin.crushing-impact`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:34`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Shockwave `lionwing.npc.javelin.shockwave`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Кулачный боец (Pugilist) `lionwing.npc.pugilist`

#### Принять стойку `lionwing.npc.pugilist.take-stance`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Град ударов `lionwing.npc.pugilist.flurry-of-strikes`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:35`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Martial Perfection `lionwing.npc.pugilist.martial-perfection`

- **Заявленный кодовый статус:** `state` (состояние).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `state`; реестр: `scene-actions.js:214`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Рейнджер (Ranger) `lionwing.npc.ranger`

#### Гнездо `lionwing.npc.ranger.nest`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:225`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Выстрел `lionwing.npc.ranger.take-the-shot`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:36`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Headshot `lionwing.npc.ranger.headshot`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:227`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Ронин (Ronin) `lionwing.npc.ronin`

#### Вложить в ножны `lionwing.npc.ronin.sheath`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Рассечение `lionwing.npc.ronin.dissect`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:37`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Thunderclap And Flash `lionwing.npc.ronin.thunderclap-and-flash`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Гадюка (Viper) `lionwing.npc.viper`

#### Облизать нож `lionwing.npc.viper.lick-the-knife`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:233`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Филе `lionwing.npc.viper.filet`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Knife In The Dark `lionwing.npc.viper.knife-in-the-dark`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Ведьма (Witch) `lionwing.npc.witch`

#### Начертание рун `lionwing.npc.witch.drawing-runes`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Изгоняющая сила `lionwing.npc.witch.expelling-force`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:38`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### EXPLOSION `lionwing.npc.witch.explosion`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Телохранители (Bodyguards) `lionwing.npc.bodyguards`

#### Укрепиться `lionwing.npc.bodyguards.brace`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:199`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### За мной `lionwing.npc.bodyguards.behind-me`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:45`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Reinforcements `lionwing.npc.bodyguards.reinforcements`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:265`, `scene-actions.js:387`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Матка (Broodmother) `lionwing.npc.broodmother`

#### Призыв `lionwing.npc.broodmother.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:255`, `scene-actions.js:384`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Роящаяся погоня `lionwing.npc.broodmother.swarming-chase`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:47`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Roar `lionwing.npc.broodmother.roar`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:243`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Кокон (Cocoon) `lionwing.npc.cocoon`

#### Устрашение `lionwing.npc.cocoon.menace`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Буйство `lionwing.npc.cocoon.rampage`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:48`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Quick Growth `lionwing.npc.cocoon.quick-growth`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:217`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Дуэлянт (Duelist) `lionwing.npc.duelist`

#### Поддразнить `lionwing.npc.duelist.goad`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Стремительный выпад `lionwing.npc.duelist.fleche`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:56`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Disassemble `lionwing.npc.duelist.disassemble`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Обжора (Glutton) `lionwing.npc.glutton`

#### Призыв `lionwing.npc.glutton.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:259`, `scene-actions.js:385`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Слюни `lionwing.npc.glutton.slobber`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:39`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Regurgitate `lionwing.npc.glutton.regurgitate`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":4,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:261`, `scene-actions.js:382`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Страж (Guardian) `lionwing.npc.guardian`

#### Щит стража `lionwing.npc.guardian.guardian-shield`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Толчок `lionwing.npc.guardian.shove`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:40`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Imposing Presence `lionwing.npc.guardian.imposing-presence`

- **Заявленный кодовый статус:** `state` (состояние).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `state`; реестр: `scene-actions.js:219`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Скакун (Mount) `lionwing.npc.mount`

#### Синергия `lionwing.npc.mount.synergy`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Молотить `lionwing.npc.mount.thrash`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:41`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### CHARGE! `lionwing.npc.mount.charge`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Они (Oni) `lionwing.npc.oni`

#### Стабилизация `lionwing.npc.oni.stabilize`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:234`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Полярис `lionwing.npc.oni.polaris`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Vibrant Terror `lionwing.npc.oni.vibrant-terror`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":4,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Паладин (Paladin) `lionwing.npc.paladin`

#### Евангелие `lionwing.npc.paladin.gospel`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:183`, `scene-actions.js:204`, `scene-actions.js:375`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Дар от Бога `lionwing.npc.paladin.gift-from-god`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:42`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Weal And Woe `lionwing.npc.paladin.weal-and-woe`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Ревенант (Revenant) `lionwing.npc.revenant`

#### Таиться `lionwing.npc.revenant.lurk`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Вырвать из души `lionwing.npc.revenant.tear-from-the-soul`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:43`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Hollowed Eyes `lionwing.npc.revenant.hollowed-eyes`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:241`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Спрайт (Spright) `lionwing.npc.spright`

#### Сбить с толку `lionwing.npc.spright.discombobulate`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:184`, `scene-actions.js:205`, `scene-actions.js:376`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Надрез `lionwing.npc.spright.incision`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:57`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Thunderous Ascension `lionwing.npc.spright.thunderous-ascension`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Знаменосец (Bannerman) `lionwing.npc.bannerman`

#### На позиции `lionwing.npc.bannerman.in-position`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Взмах `lionwing.npc.bannerman.swing`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:44`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Plant The Flag `lionwing.npc.bannerman.plant-the-flag`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Строитель (Builder) `lionwing.npc.builder`

#### Ландшафт `lionwing.npc.builder.landscape`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Буйное строительство `lionwing.npc.builder.violent-construction`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:49`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Army Of Stone `lionwing.npc.builder.army-of-stone`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:250`, `scene-actions.js:389`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Координатор (Coordinator) `lionwing.npc.coordinator`

#### Нейтрализуйте их `lionwing.npc.coordinator.neutralize-them`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:228`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Фанатизировать `lionwing.npc.coordinator.fanaticize`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Coordinated Charge `lionwing.npc.coordinator.coordinated-charge`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Доппельгангер (Doppelgänger) `lionwing.npc.doppelganger`

#### Имитировать `lionwing.npc.doppelganger.imitate`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Diplopia `lionwing.npc.doppelganger.diplopia`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Целитель (Healer) `lionwing.npc.healer`

#### Лечение `lionwing.npc.healer.heal`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:231`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Обескровить `lionwing.npc.healer.exsanguinate`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:50`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Savior `lionwing.npc.healer.savior`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Иллюзионист (Illusionist) `lionwing.npc.illusionist`

#### Пространственный разлом `lionwing.npc.illusionist.spatial-rift`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Исказить реальность `lionwing.npc.illusionist.distort-reality`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:51`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Shattered Skies `lionwing.npc.illusionist.shattered-skies`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Матриарх (Matriarch) `lionwing.npc.matriarch`

#### Ласка `lionwing.npc.matriarch.caress`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Уничтожить чужака `lionwing.npc.matriarch.destroy-the-interloper`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Mother Of The Void `lionwing.npc.matriarch.mother-of-the-void`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Мученик (Martyr) `lionwing.npc.martyr`

#### Насыться моей плотью `lionwing.npc.martyr.gorge-on-my-flesh`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Вкусите моей крови `lionwing.npc.martyr.savor-my-blood`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:52`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Sacrifice `lionwing.npc.martyr.sacrifice`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Барон (Baron) `lionwing.npc.baron`

#### Предписание `lionwing.npc.baron.prescript`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Подавить `lionwing.npc.baron.suppress`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:53`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Absolute Sovereignty `lionwing.npc.baron.absolute-sovereignty`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Берсерк (Berserker) `lionwing.npc.berserker`

#### Кипеть `lionwing.npc.berserker.seethe`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:203`, `scene-actions.js:373`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Молотить `lionwing.npc.berserker.thrash`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:54`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Last Stand `lionwing.npc.berserker.last-stand`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:223`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Канонир (Cannoneer) `lionwing.npc.cannoneer`

#### Прицелиться `lionwing.npc.cannoneer.aim`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:182`, `scene-actions.js:202`, `scene-actions.js:372`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Зарядить `lionwing.npc.cannoneer.load`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:237`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Fire `lionwing.npc.cannoneer.fire`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Культист (Cultist) `lionwing.npc.cultist`

#### Ритуальные чертежи `lionwing.npc.cultist.ritual-drawings`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Удар наотмашь `lionwing.npc.cultist.swipe`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:55`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Grand Calling `lionwing.npc.cultist.grand-calling`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":8,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Сорвиголова (Daredevil) `lionwing.npc.daredevil`

#### Хвастовство `lionwing.npc.daredevil.gloat`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:232`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Танец `lionwing.npc.daredevil.dance`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:59`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Adrenaline High `lionwing.npc.daredevil.adrenaline-high`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":4,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Манипулятор (Enchanter) `lionwing.npc.enchanter`

#### Очарование `lionwing.npc.enchanter.charm`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Сердцеед `lionwing.npc.enchanter.heartbreaker`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:60`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### By My Command `lionwing.npc.enchanter.by-my-command`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Псарь (Hound Master) `lionwing.npc.hound-master`

#### Запустить ищейку `lionwing.npc.hound-master.fire-seeker`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:245`, `scene-actions.js:380`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Толчок `lionwing.npc.hound-master.shove`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:61`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Wild Hunt `lionwing.npc.hound-master.wild-hunt`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:247`, `scene-actions.js:381`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Некромант (Necromancer) `lionwing.npc.necromancer`

#### Призвать мертвых `lionwing.npc.necromancer.call-the-dead`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:256`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Ужасающий выстрел `lionwing.npc.necromancer.terrifying-shot`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:62`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### The Danse Macabre `lionwing.npc.necromancer.the-danse-macabre`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:177`, `scene-actions.js:257`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Капер (Privateer) `lionwing.npc.privateer`

#### Эскорт `lionwing.npc.privateer.escort`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Стрельба наугад `lionwing.npc.privateer.spray-and-pray`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:63`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Gear Change `lionwing.npc.privateer.gear-change`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:249`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Разломщик (Rifter) `lionwing.npc.rifter`

#### Дикое смещение `lionwing.npc.rifter.wild-shifting`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Появление `lionwing.npc.rifter.emerge`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:58`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Implode `lionwing.npc.rifter.implode`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Рой (Swarm) `lionwing.npc.swarm`

#### Призыв `lionwing.npc.swarm.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:263`, `scene-actions.js:386`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Рвать `lionwing.npc.swarm.tear`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:46`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Reinforcements `lionwing.npc.swarm.reinforcements`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:267`, `scene-actions.js:388`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

## Враги-модификаторы

## Именованные враги

## Черты Антагониста
