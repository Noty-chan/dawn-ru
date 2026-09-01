# DAWN: кодовая спецификация способностей врагов

> Сгенерировано `npm run docs:rules` из канонического `apps/companion/data.js` (SHA-256 `73ba9392e5278649ae74f01b58e721cc17a156fc694c570544f6c44eb27de24d`).
> Русский текст - канонический перевод из `source/translation/`; локальные профили Леона взяты из `source/companion/named-enemies.md`. Английские названия сверяются с `source/translation/adapted-names-index.md` и, для Черточек Антагониста, с `source/original/Dawn - A Diceless Fantasy TTRPG.pdf`.

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

### Ассасин (Assassin) `enemy.common.assassin`

#### Нейтрализовать цель `enemy.common.assassin.action.neutralize-target`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1","targetEffects":["Помечен"]}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:113`, `scene-actions.js:128`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Разрез `enemy.common.assassin.attack.slice`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":2,"target":"targetIds: 1..1, adjacent"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:22`, `scene-actions.js:69`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Исчезнуть `enemy.common.assassin.trump.disappear`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0","selfEffects":["Исчез"]}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:114`, `scene-actions.js:127`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Громила (Bruiser) `enemy.common.bruiser`

#### Избиение `enemy.common.bruiser.action.beatdown`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 1..1`.

#### Грязный прием `enemy.common.bruiser.attack.skulduggery`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":2,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:21`, `scene-actions.js:70`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Разгром `enemy.common.bruiser.trump.decimate`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0, area:3×3@point"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, area:3×3@point`.

### Бехемот (Behemoth) `enemy.common.behemoth`

#### Скачок `enemy.common.behemoth.action.leap`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤2","selfEffects":["Исчез","Подброшен"]}`.
- **Текущий адаптер:** частичная конфигурация есть в `scene-actions.js:168`, но исполнимого статуса нет.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤2`.

#### Вырвано из земли `enemy.common.behemoth.attack.tore-from-earth`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":2,"target":"targetIds: 1..2, range≤6"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:23`, `scene-actions.js:71`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Метеор `enemy.common.behemoth.trump.meteor`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":5,"target":"targetIds: 0"}`.
- **Текущий адаптер:** частичная конфигурация есть в `scene-actions.js:169`, но исполнимого статуса нет.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Ловец (Captor) `enemy.common.captor`

#### Наблюдать и ждать `enemy.common.captor.action.watch-and-wait`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤4`.

#### Поймать и отпустить `enemy.common.captor.attack.catch-and-release`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":2,"target":"targetIds: 1..1, range≤4","targetEffects":["Пойман"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:24`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Липкая бомба `enemy.common.captor.trump.sticky-bomb`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0, range≤5"}`.
- **Текущий адаптер:** частичная конфигурация есть в `scene-actions.js:170`, но исполнимого статуса нет.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤5`.

### Палач (Executioner) `enemy.common.executioner`

#### Собраться `enemy.common.executioner.action.focus-up`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0","selfEffects":["Укреплен","Усилен"]}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:115`, `scene-actions.js:129`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Разруб `enemy.common.executioner.attack.cleave`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"8(+2)","tensionMultiplier":2,"target":"targetIds: 1..1","targetEffects":["Разорван"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:25`, `scene-actions.js:73`, `scene-actions.js:811`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Рассечение `enemy.common.executioner.trump.bifurcate`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:130`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Джавелин (Javelin) `enemy.common.javelin`

#### Призыв `enemy.common.javelin.action.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:155`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Сокрушительный удар `enemy.common.javelin.attack.crushing-impact`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":2,"target":"targetIds: 1..1, area:2×2@self","targetEffects":["Подброшен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:26`, `scene-actions.js:74`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Ударная волна `enemy.common.javelin.trump.shockwave`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0, area:5×5@self"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, area:5×5@self`.

### Кулачный боец (Pugilist) `enemy.common.pugilist`

#### Принять стойку `enemy.common.pugilist.action.take-stance`

- **Заявленный кодовый статус:** `state` (состояние).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `state`; реестр: `scene-actions.js:133`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Град ударов `enemy.common.pugilist.attack.flurry-of-strikes`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":2,"target":"targetIds: 1..1, adjacent"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:27`, `scene-actions.js:75`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Боевое совершенство `enemy.common.pugilist.trump.martial-perfection`

- **Заявленный кодовый статус:** `state` (состояние).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `state`; реестр: `scene-actions.js:134`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Рейнджер (Ranger) `enemy.common.ranger`

#### Гнездо `enemy.common.ranger.action.nest`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0","selfEffects":["Устойчив"]}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:116`, `scene-actions.js:141`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Выстрел `enemy.common.ranger.attack.take-the-shot`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤8"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:28`, `scene-actions.js:76`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Выстрел в голову `enemy.common.ranger.trump.headshot`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:142`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Ронин (Ronin) `enemy.common.ronin`

#### В ножны `enemy.common.ronin.action.sheath`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:154`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Вскрытие `enemy.common.ronin.attack.dissect`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:29`, `scene-actions.js:77`, `scene-actions.js:700`, `scene-actions.js:718`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Удар грома и вспышка `enemy.common.ronin.trump.thunderclap-and-flash`

- **Заявленный кодовый статус:** `effect` (эффект).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0","selfEffects":["Устойчив"]}`.
- **Текущий адаптер:** статус `effect`; реестр: `scene-actions.js:117`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Гадюка (Viper) `enemy.common.viper`

#### Облизать нож `enemy.common.viper.action.lick-the-knife`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:135`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Разделать `enemy.common.viper.attack.filet`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent","targetEffects":["Порчен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:30`, `scene-actions.js:78`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Нож во тьме `enemy.common.viper.trump.knife-in-the-dark`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Ведьма (Witch) `enemy.common.witch`

#### Начертать руны `enemy.common.witch.action.drawing-runes`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":2,"tension":0,"target":"targetIds: 0, area:3×3@self"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, area:3×3@self`.

#### Изгоняющая сила `enemy.common.witch.attack.expelling-force`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":2,"target":"targetIds: 0, range≤5, maxTargets:1"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:31`, `scene-actions.js:79`, `scene-actions.js:171`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### ВЗРЫВ `enemy.common.witch.trump.explosion`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0, area:4×4@point"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, area:4×4@point`.

### Телохранители (Bodyguards) `enemy.common.bodyguards`

#### Укрепиться `enemy.common.bodyguards.action.brace`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### За мной `enemy.common.bodyguards.attack.behind-me`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..3","targetEffects":["Укреплен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:38`, `scene-actions.js:80`, `scene-actions.js:172`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Подкрепления `enemy.common.bodyguards.trump.reinforcements`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:160`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Матка (Broodmother) `enemy.common.broodmother`

#### Призыв `enemy.common.broodmother.action.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:156`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Роящаяся погоня `enemy.common.broodmother.attack.swarming-chase`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:32`, `scene-actions.js:81`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Рев `enemy.common.broodmother.trump.roar`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:150`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Кокон (Cocoon) `enemy.common.cocoon`

#### Устрашение `enemy.common.cocoon.action.menace`

- **Заявленный кодовый статус:** `effect` (эффект).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1, range≤3","targetEffects":["Испуган"]}`.
- **Текущий адаптер:** статус `effect`; реестр: `scene-actions.js:118`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Буйство `enemy.common.cocoon.attack.rampage`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":2,"target":"targetIds: 1..1, adjacent"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:33`, `scene-actions.js:82`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Быстрый рост `enemy.common.cocoon.trump.quick-growth`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:136`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Дуэлянт (Duelist) `enemy.common.duelist`

#### Поддразнить `enemy.common.duelist.action.goad`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1","targetEffects":["Спровоцирован"]}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:119`, `scene-actions.js:143`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Стремительный выпад `enemy.common.duelist.attack.fl-che`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤2"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:34`, `scene-actions.js:83`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Разборка `enemy.common.duelist.trump.disassemble`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Обжора (Glutton) `enemy.common.glutton`

#### Призыв `enemy.common.glutton.action.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:157`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Слюни `enemy.common.glutton.attack.slobber`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1","targetEffects":["Замедлен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:36`, `scene-actions.js:72`, `scene-actions.js:173`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Отрыгнуть `enemy.common.glutton.trump.regurgitate`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":4,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:158`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Страж (Guardian) `enemy.common.guardian`

#### Щит стража `enemy.common.guardian.action.guardian-shield`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:138`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Толчок `enemy.common.guardian.attack.shove`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent","targetEffects":["Подброшен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:42`, `scene-actions.js:84`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Внушительное присутствие `enemy.common.guardian.trump.imposing-presence`

- **Заявленный кодовый статус:** `state` (состояние).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `state`; реестр: `scene-actions.js:137`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Скакун (Mount) `enemy.common.mount`

#### Синергия `enemy.common.mount.action.synergy`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Молотить `enemy.common.mount.attack.thrash`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:37`, `scene-actions.js:85`, `scene-actions.js:174`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### "В АТАКУ!" `enemy.common.mount.trump.charge`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Они (Oni) `enemy.common.oni`

#### Стабилизация `enemy.common.oni.action.stabilize`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:147`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Полярис `enemy.common.oni.attack.polaris`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1","targetEffects":["Ускорен","Укреплен","Усилен","Подброшен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:39`, `scene-actions.js:86`, `scene-actions.js:175`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Яркий ужас `enemy.common.oni.trump.vibrant-terror`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":4,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Паладин (Paladin) `enemy.common.paladin`

#### Евангелие `enemy.common.paladin.action.gospel`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1","targetEffects":["Укреплен"]}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:120`, `scene-actions.js:131`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Дар от Бога `enemy.common.paladin.attack.gift-from-god`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1","targetEffects":["Регенерирует","Ошеломлен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:40`, `scene-actions.js:87`, `scene-actions.js:176`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Благо и горе `enemy.common.paladin.trump.weal-and-woe`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0, range≤2"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:61`, `scene-actions.js:88`, `scene-actions.js:734`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Ревенант (Revenant) `enemy.common.revenant`

#### Таиться `enemy.common.revenant.action.lurk`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤2"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:148`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Вырвать из души `enemy.common.revenant.attack.tear-from-the-soul`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤3"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:54`, `scene-actions.js:97`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Пустые глаза `enemy.common.revenant.trump.hollowed-eyes`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:149`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Слизь (Slime) `enemy.common.slime`

#### Ил `enemy.common.slime.action.sludge`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Жижа `enemy.common.slime.attack.goop`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent","targetEffects":["Ослаблен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:35`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Поглотить `enemy.common.slime.trump.consume`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0, adjacent"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, adjacent`.

### Знаменосец (Bannerman) `enemy.common.bannerman`

#### На позиции `enemy.common.bannerman.action.in-position`

- **Заявленный кодовый статус:** `effect` (эффект).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1, range≤6","targetEffects":["Укреплен","Усилен"]}`.
- **Текущий адаптер:** статус `effect`; реестр: `scene-actions.js:121`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Взмах `enemy.common.bannerman.attack.swing`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent","targetEffects":["Ослаблен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:47`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Водрузить знамя `enemy.common.bannerman.trump.plant-the-flag`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Строитель (Builder) `enemy.common.builder`

#### Ландшафт `enemy.common.builder.action.landscape`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1, range≤4"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 1..1, range≤4`.

#### Буйное строительство `enemy.common.builder.attack.violent-construction`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"directDamage":"3(+1)","target":"targetIds: 1..1, range≤6"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:45`, `scene-actions.js:92`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Каменная армия `enemy.common.builder.trump.army-of-stone`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Координатор (Coordinator) `enemy.common.coordinator`

#### "Нейтрализуйте их" `enemy.common.coordinator.action.neutralize-them`

- **Заявленный кодовый статус:** `effect` (эффект).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1, range≤4","targetEffects":["Помечен"]}`.
- **Текущий адаптер:** статус `effect`; реестр: `scene-actions.js:122`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Фанатизировать `enemy.common.coordinator.attack.fanaticize`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:46`, `scene-actions.js:93`.
- **Нужно добавить / проверить:** Обязательная союзная follow-up ветка отсутствует.

#### Скоординированный рывок `enemy.common.coordinator.trump.coordinated-charge`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0, range≤5"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤5`.

### Доппельгангер (Doppelgänger) `enemy.common.doppelg-nger`

#### Имитировать `enemy.common.doppelg-nger.action.imitate`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤6"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤6`.

#### Диплопия `enemy.common.doppelg-nger.trump.diplopia`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Целитель (Healer) `enemy.common.healer`

#### Лечение `enemy.common.healer.action.heal`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤3"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:144`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Обескровить `enemy.common.healer.attack.exsanguinate`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤5","targetEffects":["Помечен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:50`, `scene-actions.js:94`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Спаситель `enemy.common.healer.trump.savior`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:145`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Иллюзионист (Illusionist) `enemy.common.illusionist`

#### Пространственный разлом `enemy.common.illusionist.action.spatial-rift`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Исказить реальность `enemy.common.illusionist.attack.distort-reality`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:51`, `scene-actions.js:95`, `scene-actions.js:177`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Разбитые небеса `enemy.common.illusionist.trump.shattered-skies`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":1,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Тень (Shade) `enemy.common.shade`

#### Ласка `enemy.common.shade.action.caress`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 1..1`.

#### Уничтожить чужака `enemy.common.shade.attack.destroy-the-interloper`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1","targetEffects":["Изгнан"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:52`, `scene-actions.js:96`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Мать пустоты `enemy.common.shade.trump.mother-of-the-void`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Мученик (Martyr) `enemy.common.martyr`

#### Насыться моей плотью `enemy.common.martyr.action.gorge-on-my-flesh`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤4`.

#### Вкусите моей крови `enemy.common.martyr.attack.savor-my-blood`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 0, range≤5, maxTargets:1"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:55`, `scene-actions.js:98`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Жертва `enemy.common.martyr.trump.sacrifice`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Барон (Baron) `enemy.common.baron`

#### Предписание `enemy.common.baron.action.prescript`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, maxTargets:3"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, maxTargets:3`.

#### Подавить `enemy.common.baron.attack.suppress`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent","targetEffects":["Ослаблен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:48`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Абсолютный суверенитет `enemy.common.baron.trump.absolute-sovereignty`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Берсерк (Berserker) `enemy.common.berserker`

#### Кипеть `enemy.common.berserker.action.seeth`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:139`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Молотить `enemy.common.berserker.attack.thrash`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:43`, `scene-actions.js:90`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Последний рубеж `enemy.common.berserker.trump.last-stand`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:140`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Канонир (Cannoneer) `enemy.common.cannoneer`

#### Прицелиться `enemy.common.cannoneer.action.aim`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0","selfEffects":["Устойчив","Усилен"]}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:124`, `scene-actions.js:132`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Зарядить `enemy.common.cannoneer.attack.load`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"target":"targetIds: 1..1"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:146`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Огонь `enemy.common.cannoneer.trump.fire`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤10"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:60`, `scene-actions.js:99`, `scene-actions.js:699`, `scene-actions.js:1019`.
- **Нужно добавить / проверить:** Конфигурация повторяет канонический урон три раза вместо одного броска 6(+1)D6.

### Культист (Cultist) `enemy.common.cultist`

#### Ритуальные чертежи `enemy.common.cultist.action.ritual-drawings`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Удар наотмашь `enemy.common.cultist.attack.swipe`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, adjacent"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:49`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Великий зов `enemy.common.cultist.trump.grand-calling`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":8,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Сорвиголова (Daredevil) `enemy.common.daredevil`

#### Хвастовство `enemy.common.daredevil.action.gloat`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Танец `enemy.common.daredevil.attack.dance`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":1,"target":"targetIds: 1..1","targetEffects":["Подброшен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:41`, `scene-actions.js:89`, `scene-actions.js:178`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Адреналиновый кайф `enemy.common.daredevil.trump.adrenaline-high`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":4,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Манипулятор (Enchanter) `enemy.common.enchanter`

#### Очарование `enemy.common.enchanter.action.charm`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1, range≤5","targetEffects":["Испуган","Спровоцирован"]}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 1..1, range≤5`.

#### Сердцеед `enemy.common.enchanter.attack.heartbreaker`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤5","targetEffects":["Замедлен","Ослаблен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:56`, `scene-actions.js:100`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### По моему приказу `enemy.common.enchanter.trump.by-my-command`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Псарь (Hound Master) `enemy.common.hound-master`

#### Запустить ищейку `enemy.common.hound-master.action.fire-seeker`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:151`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Толчок `enemy.common.hound-master.attack.shove`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤3"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:44`, `scene-actions.js:91`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Дикая охота `enemy.common.hound-master.trump.wild-hunt`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:152`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Некромант (Necromancer) `enemy.common.necromancer`

#### Восстаньте снова `enemy.common.necromancer.action.rise-again`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤4`.

#### Ужасающий выстрел `enemy.common.necromancer.attack.terrifying-shot`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":2,"target":"targetIds: 1..1, range≤5","targetEffects":["Испуган"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:53`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Пляска смерти `enemy.common.necromancer.trump.the-danse-macabre`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Капер (Privateer) `enemy.common.privateer`

#### Эскорт `enemy.common.privateer.action.escort`

- **Заявленный кодовый статус:** `effect` (эффект).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 1..1","targetEffects":["Ускорен"]}`.
- **Текущий адаптер:** статус `effect`; реестр: `scene-actions.js:123`.
- **Нужно добавить / проверить:** Исполнялась только выдача эффекта «Ускорен»; обязательное окно выбора и равное движение вслед за союзником отсутствуют.

#### Стрельба наугад `enemy.common.privateer.attack.spray-and-pray`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"5(+1)","tensionMultiplier":2,"target":"targetIds: 0, range≤3"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:57`, `scene-actions.js:101`, `scene-actions.js:179`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Смена снаряжения `enemy.common.privateer.trump.gear-change`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:153`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Разломщик (Rifter) `enemy.common.rifter`

#### Дикое смещение `enemy.common.rifter.action.wild-shifting`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤3"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤3`.

#### Появление `enemy.common.rifter.attack.emerge`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..1, range≤5"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:58`, `scene-actions.js:102`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Имплозия `enemy.common.rifter.trump.implode`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Рой (Swarm) `enemy.common.swarm`

#### Призыв `enemy.common.swarm.action.call`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤4"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:159`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Рвать `enemy.common.swarm.attack.tear`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6(+1)","tensionMultiplier":1,"target":"targetIds: 1..3","targetEffects":["Ошеломлен"]}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:59`, `scene-actions.js:103`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Подкрепления `enemy.common.swarm.trump.reinforcements`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":2,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:161`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

## Враги-модификаторы

### Артиллерия (Artillery) `enemy.modifier.artillery`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Случайные жертвы (Collateral) `enemy.modifier.collateral`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Заражение (Contagion) `enemy.modifier.contagion`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Землетрясение (Earthquake) `enemy.modifier.earthquake`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Громадина (Gargantuan) `enemy.modifier.gargantuan`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Гигант (Giant) `enemy.modifier.giant`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Убежище (Haven) `enemy.modifier.haven`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Изоляция (Isolation) `enemy.modifier.isolation`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Легион (Legion) `enemy.modifier.legion`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### VIP (VIP) `enemy.modifier.vip`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

### Вихрь (Vortex) `enemy.modifier.vortex`

- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.
- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.

## Именованные враги

### Леон, маг пространственной академии (Leon, Academy Spatial Mage) `enemy.named.leon-academy-spatial-mage`

#### Дикое смещение `enemy.named.leon-academy-spatial-mage.action.wild-shifting`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"action","apCost":1,"tension":0,"target":"targetIds: 0, range≤3"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0, range≤3`.

#### Появление `enemy.named.leon-academy-spatial-mage.attack.emerge`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"6","tensionMultiplier":1,"target":"targetIds: 1..1, range≤5"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:62`, `scene-actions.js:105`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

#### Элементальный разрыв `enemy.named.leon-academy-spatial-mage.trump.elemental-breach`

- **Заявленный кодовый статус:** `full` (полная).
- **Входная конфигурация:** `{"kind":"trump","apCost":2,"tension":3,"target":"targetIds: 0"}`.
- **Текущий адаптер:** статус `full`; реестр: `scene-actions.js:162`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Дух Вайю Леона (Leon's Vayu Spirit) `enemy.named.leon-s-vayu-spirit`

#### Воздушный толчок `enemy.named.leon-s-vayu-spirit.attack.air-shove`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"3","target":"targetIds: 1..1, range≤3"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:63`, `scene-actions.js:104`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

### Дух Агни Леона (Leon's Agni Spirit) `enemy.named.leon-s-agni-spirit`

#### Огненная искра `enemy.named.leon-s-agni-spirit.attack.fire-spark`

- **Заявленный кодовый статус:** `attack` (атака).
- **Входная конфигурация:** `{"kind":"attack","apCost":1,"tension":0,"dice":"3","target":"targetIds: 1..1, range≤4"}`.
- **Текущий адаптер:** статус `attack`; реестр: `scene-actions.js:64`.
- **Нужно добавить / проверить:** Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.

## Черты Антагониста

### Всевидящий (All-Seeing) `enemy.antagonist-trait.all-seeing`

#### Предсказуемо `enemy.antagonist-trait.all-seeing.defense-reaction.предсказуемо`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Пронзающий взгляд `enemy.antagonist-trait.all-seeing.reaction.пронзающий-взгляд`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### ...Вы вынудили меня `enemy.antagonist-trait.all-seeing.phase-change.вы-вынудили-меня`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Жестокосердный (Cruel-Hearted) `enemy.antagonist-trait.cruel-hearted`

#### Тело шипов `enemy.antagonist-trait.cruel-hearted.defense-reaction.тело-шипов`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Садист `enemy.antagonist-trait.cruel-hearted.turn-start.садист`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"turn-start","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Вдохните это! `enemy.antagonist-trait.cruel-hearted.phase-change.вдохните-это`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Богоподобный (God-Like) `enemy.antagonist-trait.god-like`

#### СЛОМАЙСЯ `enemy.antagonist-trait.god-like.defense-reaction.сломайся`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### УЗРИ `enemy.antagonist-trait.god-like.turn-start.узри`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"turn-start","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### СКЛОНИСЬ ПЕРЕДО МНОЙ `enemy.antagonist-trait.god-like.phase-change.склонись-передо-мной`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Одичавший (Wild-Eyed) `enemy.antagonist-trait.wild-eyed`

#### Жестокий перехват `enemy.antagonist-trait.wild-eyed.defense-reaction.жестокий-перехват`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Звериный рев `enemy.antagonist-trait.wild-eyed.turn-start.звериный-рев`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"turn-start","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Сокрушите их всех! `enemy.antagonist-trait.wild-eyed.phase-change.сокрушите-их-всех`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Железная воля (Iron-Willed) `enemy.antagonist-trait.iron-willed`

#### Защитник `enemy.antagonist-trait.iron-willed.defense-reaction.защитник`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Колючие оскорбления `enemy.antagonist-trait.iron-willed.turn-start.колючие-оскорбления`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"turn-start","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Давите линию! `enemy.antagonist-trait.iron-willed.phase-change.давите-линию`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Быстрый шаг (Swift-Stepping) `enemy.antagonist-trait.swift-stepping`

#### Уйти в тень `enemy.antagonist-trait.swift-stepping.defense-reaction.уйти-в-тень`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Подчинить `enemy.antagonist-trait.swift-stepping.turn-start.подчинить`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"turn-start","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Спи... `enemy.antagonist-trait.swift-stepping.phase-change.спи`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Всемирно известный (World-Renowned) `enemy.antagonist-trait.world-renowned`

#### Героический перехват `enemy.antagonist-trait.world-renowned.defense-reaction.героический-перехват`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Вдохновляющее присутствие `enemy.antagonist-trait.world-renowned.ally-turn-start.вдохновляющее-присутствие`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"ally-turn-start","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Ко мне лицом! `enemy.antagonist-trait.world-renowned.phase-change.ко-мне-лицом`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

### Удар в спину (Back-Stabbling) `enemy.antagonist-trait.back-stabbling`

#### Почетная" жертва `enemy.antagonist-trait.back-stabbling.defense-reaction.почетная-жертва`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"defense-reaction","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Переложить вину `enemy.antagonist-trait.back-stabbling.turn-start.переложить-вину`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"turn-start","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.

#### Схватить их! `enemy.antagonist-trait.back-stabbling.phase-change.схватить-их`

- **Заявленный кодовый статус:** `assisted` (помощь Нарратора).
- **Входная конфигурация:** `{"kind":"phase-change","target":"targetIds: 0"}`.
- **Текущий адаптер:** нет зарегистрированного исполняемого адаптера.
- **Нужно добавить / проверить:** Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: `targetIds: 0`.
