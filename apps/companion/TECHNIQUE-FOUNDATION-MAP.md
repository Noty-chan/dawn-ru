# Карта заготовок автоматизации Техник

> Генерируется командой `npm run map`. Не редактируйте таблицы вручную:
> правила классификации находятся в `technique-foundation-map.js`.

Покрыто Уровней: **321**. Начата проверенная интеграция: **6**. Остальные строки — кандидаты для ручной сверки, а не утверждение о полной автоматизации.

## Легенда возможностей

| id | Назначение | Состояние | Модуль | Уровней-кандидатов |
| --- | --- | --- | --- | ---: |
| `event-participants` | Участники события | готово | `scene-engine-core.js` | 217 |
| `event-preview` | Предпросмотр цепочки | готово | `scene-triggers.js` | 321 |
| `spatial-cells` | Персонажи в клетках | готово | `scene-query.js` | 20 |
| `spatial-range` | Персонажи в дальности | готово | `scene-query.js` | 24 |
| `target-validation` | Проверка целей | готово | `scene-query.js` | 217 |
| `resource-check` | Проверка ресурсов | готово | `scene-query.js` | 104 |
| `effect-state` | Состояние Эффекта | готово | `scene-query.js` | 115 |
| `event-summary` | Сводка цепочки | готово | `scene-query.js` | 321 |
| `rule-clock` | Часы правила | готово | `scene-foundations.js` | 19 |
| `alternate-resource` | Альтернативный ресурс | готово | `scene-foundations.js` | 6 |
| `stance` | Стойки | готово | `scene-foundations.js` | 12 |
| `owned-entities` | Принадлежащие сущности | готово | `scene-foundations.js` | 35 |
| `action-history` | История действий | готово | `scene-foundations.js` | 17 |
| `terrain` | Местность | готово | `scene-foundations.js` | 29 |
| `usage-limits` | Раз за Ход/Раунд/Сцену | планируется | — | 46 |
| `trigger-router` | Маршрутизация триггеров | планируется | — | 302 |
| `movement-lifecycle` | Жизненный цикл движения | планируется | — | 125 |
| `choice-flow` | Типизированное решение | планируется | — | 43 |
| `damage-pipeline` | Конвейер урона и исцеления | планируется | — | 100 |
| `action-modifier` | Модификатор базового действия | планируется | — | 206 |
| `entity-lifecycle` | Жизненный цикл зон и маркеров | планируется | — | 38 |
| `inventory` | Инвентарь и заряды | планируется | — | 39 |
| `summon-turns` | Призывы и делегированные Ходы | планируется | — | 12 |
| `dice-hooks` | Модификаторы броска | планируется | — | 90 |
| `duration-scheduler` | Сроки действия и отложенные эффекты | планируется | — | 19 |
| `deployment-hooks` | Развертывание | планируется | — | 8 |
| `intermission-reset` | Сброс на Интермиссии | планируется | — | 3 |
| `bond-actions` | Действия Связей | планируется | — | 5 |
| `manual-ruling` | Ручное решение Нарратора | ручное | — | 0 |

## Как читать карту

- `проверено` означает, что для Уровня уже существует первый foundation-адаптер.
- `кандидат` означает автоматическую первичную классификацию по индексу механик и тексту; её обязан проверить разработчик.
- Колонка `Адаптер` показывает текущую честную степень автоматизации движка.
- Несколько возможностей у одного Уровня — нормальный случай: тонкий адаптер должен компоновать общее ядро.

## Все Техники

## Силач

### Берсерк (`powerhouse.berserker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Месть (Revenge) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Выдержать побои (Take A Beating) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `stance`, `trigger-router`, `damage-pipeline`, `dice-hooks` |
| 3 | Загнанный пес (Cornered Dog) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline` |

### Драконоборец (`powerhouse.dragonslayer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Скорость - это вес (Speed Is Weight) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Широкая дуга (Wide Arc) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `resource-check`, `owned-entities`, `trigger-router`, `action-modifier` |
| 3 | Титанический замах (Titanic Heave) [Передышка -> Завершение Телом] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Дуэлянт (`powerhouse.duelist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ответный выпад (Riposte) [Блок -> Стычка] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `action-modifier`, `dice-hooks` |
| 2 | Парирование (Parry) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `action-modifier` |
| 3 | Отбивающий удар (Deflecting Blow) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `action-modifier` |

### Самобичеватель (`powerhouse.flagellant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Азарт (Thrill) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router` |
| 2 | Кровавый рывок (Blood Rush) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Обескровлен (Bled Dry) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router` |

### Стрелок (`powerhouse.gunslinger`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Большой ствол (Big Iron) | проверено | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `alternate-resource`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `inventory` |
| 2 | Зарядить и взвести (Lock And Load) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `action-modifier`, `dice-hooks`, `inventory` |
| 3 | Жонглирование пулями (Bullet Juggle) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier` |

### Борец (`powerhouse.struggler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Усилие (Effort) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline`, `dice-hooks` |
| 2 | Адреналин (Adrenaline) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `choice-flow`, `damage-pipeline` |
| 3 | Вопреки разуму (Defy Reason) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Магический мечник (`powerhouse.spellsword`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Чародейский клинок (Spell Blade) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Два солнца (Twin Suns) [Заклинание -> Стычка] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Охотник на ведьм (Witch Hunter) [Заклинание -> Завершение Телом/Талантом] | проверено | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history` |

### Техник (`powerhouse.technician`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Разминка (Stretch) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier`, `duration-scheduler`, `inventory` |
| 2 | Идеальная форма (Perfect Form) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `duration-scheduler` |
| 3 | Последний удар (Final Blow) [Стычка -> Завершение] | кандидат | полная | `event-preview`, `event-summary`, `resource-check`, `action-modifier` |

### Несломленный (`powerhouse.unbroken`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Встать снова (Get Back Up) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `usage-limits`, `trigger-router`, `action-modifier`, `duration-scheduler` |
| 2 | Яростное возрождение (Furious Revival) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier` |
| 3 | Феникс (Phoenix) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `damage-pipeline` |

### Хвастун (`powerhouse.braggart`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Гордыня (Hubris) | проверено | частичная | `event-preview`, `event-summary`, `rule-clock`, `trigger-router`, `action-modifier`, `dice-hooks`, `duration-scheduler` |
| 2 | Докажи, чего стоишь (Prove Yourself) | кандидат | ручная | `event-preview`, `event-summary`, `rule-clock`, `trigger-router`, `dice-hooks` |
| 3 | Достойный противник (A Worthy Opponent) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `rule-clock`, `trigger-router`, `damage-pipeline` |

### Картечник (`powerhouse.breacher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Картечь (Buck Shot) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Из обоих стволов (Both Barrels) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Уничтожение (Annihilate) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `owned-entities`, `trigger-router`, `action-modifier` |

### Боец с парным оружием (`powerhouse.dual-wielder`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Парный удар (Twinned Blow) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Неистовый обстрел (Frenzied Barrage) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks` |
| 3 | Разные клинки (Varied Blades) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Мастер боевых искусств (`powerhouse.martial-artist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Искусство восьми молотов (Art Of The 8 Hammers) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `usage-limits`, `trigger-router`, `action-modifier` |
| 2 | Состояние потока (Flow-State) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `damage-pipeline`, `action-modifier` |
| 3 | Бесконечные удары (Unlimited Blows) | кандидат | ручная | `event-preview`, `event-summary`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Мудрец монастыря (`powerhouse.monastic-sage`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Разум воплощенный (Mind Made Manifest) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router` |
| 2 | Меж двух миров (Of Two Worlds) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier`, `inventory` |
| 3 | Возвышенная невозмутимость (Sublime Equanimity) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router` |

### Копейщик (`powerhouse.lancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пронзание (Pierce) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Фаланга (Phalanx) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | Рука-пушка (Cannon-Arm) [Передышка -> Стычка] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Хищник (`powerhouse.predator`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Тоска (Yearn) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Одержимость (Obsess) | кандидат | ручная | `event-preview`, `event-summary`, `terrain`, `trigger-router`, `damage-pipeline` |
| 3 | Пожрать (Devour) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `effect-state`, `usage-limits`, `trigger-router`, `damage-pipeline`, `inventory` |

### Импровизатор (`powerhouse.improvisational-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Все - инструмент (Everything's A Tool) | проверено | частичная | `event-preview`, `event-summary`, `spatial-range`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Ох! Вот это было больно! (Oh! That One Hurt!) | кандидат | частичная | `event-preview`, `event-summary`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Последнее средство (Last Resort) | кандидат | ручная | `event-preview`, `event-summary`, `terrain`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Воинственный Вознесенный (`powerhouse.warring-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Небесная рука (Heavenly Arm) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `resource-check`, `effect-state`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `inventory` |
| 2 | Эзотерические клинки (Esoteric Blades) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `choice-flow` |
| 3 | Святой меч, Дюрандаль (Saintly Sword, Durandal) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `inventory` |

## Бродяга

### Воздушный мастер (`vagabond.aerial-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Над и вокруг (Over And Around) | проверено | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `stance`, `terrain`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Парение (Soar) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router`, `action-modifier` |
| 3 | Падающий удар топором (Falling Ax Strike) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `stance`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Ассасин (`vagabond.assassin`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Засада (Ambush) | кандидат | полная | `event-preview`, `event-summary`, `trigger-router`, `deployment-hooks` |
| 2 | Ликвидация (Assassinate) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Скорость тьмы (Speed of Dark) [Скрыться -> Шаг] | кандидат | полная | `event-preview`, `event-summary`, `effect-state`, `action-modifier` |

### Снайпер (`vagabond.sniper`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Дальний выстрел (Long Shot) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `action-modifier` |
| 2 | Окопаться (Bunker Down) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Меткий глаз (Deadeye) [Скрыться -> Завершение Талантом] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Застрельщик (`vagabond.skirmisher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Укол (Sting) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Смещающиеся удары (Shifting Blows) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Отскок (Rebound) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Демон скорости (`vagabond.speed-demon`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Уход в тень (Fade) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router` |
| 2 | Мгновенный шаг (Flash Step) [Передышка -> Шаг] | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Мгновенный удар (Flash Strike) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier` |

### Неуловимый (`vagabond.untouchable`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Нырок (Duck) | кандидат | полная | `event-preview`, `event-summary`, `usage-limits`, `trigger-router` |
| 2 | Маятник (Weave) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `damage-pipeline` |
| 3 | Инстинкт бойца (Fighter's Instinct) [Уворот -> Стычка] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier`, `dice-hooks` |

### Акробат (`vagabond.acrobat`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Летящий удар ногой (Flying Kick) [Прыжок -> Стычка] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Отскок от стены (Wall Jump) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router` |
| 3 | Невесомое тело (Weightless Body) | кандидат | частичная | `event-preview`, `event-summary`, `terrain`, `trigger-router`, `action-modifier` |

### Мастер клинка (`vagabond.blade-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стойка выхвата (Draw Stance) | кандидат | частичная | `event-preview`, `event-summary`, `stance`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`, `inventory` |
| 2 | Рассечение одним движением (Divide In One Motion) [Передышка -> Прыжок] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `stance`, `trigger-router`, `action-modifier`, `action-history` |
| 3 | Прыгающий карп (Leaping Koi) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Хитроумный боец (`vagabond.cunning-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | План и исполнение (Plan and Execute) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `rule-clock`, `usage-limits`, `trigger-router`, `action-modifier` |
| 2 | Планы внутри планов (Plans Within Plans) | кандидат | полная | `event-preview`, `event-summary` |
| 3 | С первого взгляда (At a Glance) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `resource-check`, `owned-entities`, `usage-limits`, `trigger-router` |

### Эгоманьяк (`vagabond.egomaniac`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пиковая форма (Peak Condition) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `rule-clock`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Дразнить, красоваться, устрашать (Taunt, Flaunt, Daunt) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `rule-clock`, `trigger-router`, `choice-flow` |
| 3 | Финал (Finale) | кандидат | ручная | `event-preview`, `event-summary`, `rule-clock`, `trigger-router`, `duration-scheduler`, `inventory` |

### Скованный (`vagabond.enchained`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Выстрел крюком (Hook Shot) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Притянуть (Draw In) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 3 | Импульс (Momentum) [Заклинание -> Стычка] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Жонглер ножами (`vagabond.knife-juggler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Метнуть (Throw) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Пополнение (Resupply) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Преследователь (Chaser) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier` |

### Злобный подражатель (`vagabond.malicious-mimic`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "Все, что можешь ты..." ("Anything You Can Do...") | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Отрепетированные движения (Rehearsed Movements) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router` |
| 3 | "...я могу лучше" ("...I Can Do Better") | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier` |

### Модифицированный мейстер (`vagabond.modified-meister`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | На горячем ходу (Running Hot) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `alternate-resource`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Перегрузка (Overload) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Разгон (Overclock) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `resource-check`, `trigger-router`, `damage-pipeline`, `duration-scheduler` |

### Оппортунист (`vagabond.opportunist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стайная тактика (Pack Tactics) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `usage-limits`, `trigger-router`, `action-modifier` |
| 2 | Голодные глаза (Hungry Eyes) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `trigger-router`, `action-modifier` |
| 3 | Комбо-подброс (Launcher Combo) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `usage-limits`, `trigger-router` |

### Отражатель (`vagabond.reflector`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Поймать клинок (Catch The Blade) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline`, `duration-scheduler` |
| 2 | Смотреть и ждать (Watch And Wait) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Нести их ярость (To Carry Their Fury) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |

### Дим Мак (`vagabond.dim-mak`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Изучить слабость (Study Weakness) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Полевая разведка (Field Investigation) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `action-modifier` |
| 3 | Казнь по четырем точкам (4-Point Execution) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |

### Пьяница (`vagabond.drunkard`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | До дна (Down The Hatch) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `dice-hooks`, `deployment-hooks` |
| 2 | Танец дурака (Fool's Dance) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router` |
| 3 | Залпом (Chug) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router`, `action-modifier` |

### Мастер оружия (`vagabond.master-at-arms`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Многогранность (Multi-Faceted) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Как вода (Like Water) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `effect-state`, `trigger-router` |
| 3 | Мастер за работой (Master At Work) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `effect-state`, `terrain`, `owned-entities`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

## Оплот

### Сокрушитель (`bulwark.crusher`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | 30 000 тонн (30,000 Tons) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | Молотопад (Hammerfall) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `damage-pipeline` |
| 3 | Ты похож на гвоздь (You Look Like A Nail) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline` |

### Гигантская фигура (`bulwark.giant-frame`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Огромные руки (Big Arms) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `resource-check`, `owned-entities`, `trigger-router`, `action-modifier` |
| 2 | Исполин (Immense) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `stance`, `terrain`, `trigger-router`, `choice-flow`, `dice-hooks`, `deployment-hooks` |
| 3 | Ударная волна (Shockwave) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier` |

### Железное тело (`bulwark.iron-bodied`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Крепкий как камень (Tough As Stone) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router` |
| 2 | Выносливость (Resilience) | кандидат | полная | `event-preview`, `event-summary` |
| 3 | Нержавеющий шаг (Stainless Stride) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router`, `damage-pipeline` |

### Щит авангарда (`bulwark.vanguard-defender`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Белый рыцарь (White Knight) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Стальной ангел (Steel Angel) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `duration-scheduler` |
| 3 | Вдохновить мужество (Inspire Courage) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router` |

### Полный ублюдок (`bulwark.absolute-bastard`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Легко ненавидеть (Easy To Hate) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router` |
| 2 | Задира (Bully) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `usage-limits`, `trigger-router` |
| 3 | Добавить травму к оскорблению (Add Injury To Insult) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `action-modifier`, `dice-hooks` |

### Боевой наездник (`bulwark.battle-jockey`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Верный скакун (Trusty Steed) | кандидат | ручная | `event-preview`, `event-summary`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `deployment-hooks` |
| 2 | Хваткие челюсти (Grasping Jaws) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `action-modifier` |
| 3 | Ревущий выход (Roaring Entry) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `effect-state`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router` |

### Борец-захватчик (`bulwark.grappler`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Удержание (Restrain) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier` |
| 2 | Перелом позвоночника (Spine Breaker) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Завершающий прием (Finishing Move) [Завершение Телом -> Прыжок] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `effect-state`, `trigger-router`, `action-modifier`, `duration-scheduler` |

### Джаггернаут (`bulwark.juggernaut`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Дикий рывок (Wild Charge) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Насилие (Violence) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `usage-limits`, `trigger-router`, `damage-pipeline` |
| 3 | Резкий поворот (Hard Turn) | кандидат | частичная | `event-preview`, `event-summary`, `trigger-router`, `action-modifier` |

### Обычный (`bulwark.mundane`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Чего не хватает Духу (For What The Spirit Lacks) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `alternate-resource`, `trigger-router`, `action-modifier`, `inventory` |
| 2 | Копнуть глубже, стоять твердо (Dig Deep, Stand Firm) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `action-modifier` |
| 3 | Перед лицом Запредельного (In The Face Of The Beyond) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `trigger-router`, `dice-hooks`, `inventory` |

### Восходящий претендент (`bulwark.rising-challenger`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Идеальное отражение (Perfect Deflection) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `resource-check`, `trigger-router` |
| 2 | "Сначала тебе придется пройти через меня!" ("You'll Have To Get Through Me!") | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Драма и злость (Drama And Spite) | кандидат | полная | `event-preview`, `event-summary`, `movement-lifecycle`, `dice-hooks` |

### Рунное возмездие (`bulwark.runic-retribution`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Удар плетью (Lash) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `action-modifier` |
| 2 | Любящий обряд (Loving Rite) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | Преданность (Devotion) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `duration-scheduler` |

### Щитоносец (`bulwark.shield-bearer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стена (Wall) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router` |
| 2 | Удар щитом (Shield Charge) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline` |
| 3 | Сосредоточенная защита (Focused Defense) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `owned-entities`, `trigger-router`, `action-modifier` |

### Стойкий часовой (`bulwark.stalwart-sentry`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Страж (Guardian) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router` |
| 2 | На посту (On Watch) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `rule-clock`, `trigger-router`, `inventory` |
| 3 | Зона контроля (Zone Of Influence) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router` |

### Звериный Вознесенный (`bulwark.beastial-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Звериность (Beastly) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `resource-check`, `effect-state`, `stance`, `usage-limits`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `inventory` |
| 2 | Наследие (Inheritance) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `choice-flow` |
| 3 | Вершина (Apex) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router` |

### Ангел-хранитель (`bulwark.guardian-angel`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Два тела (Two Bodies) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `stance`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `deployment-hooks` |
| 2 | Вместе в жизни (Together In Life) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier` |
| 3 | Вместе в смерти (Together In Death) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `resource-check`, `stance`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Зов слуги (`bulwark.servant-s-call`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Честь подчиненного (A Subordinate's Honor) | проверено | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Гимн героя (Hero's Hymn) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `action-modifier`, `duration-scheduler`, `inventory` |
| 3 | Верховный слуга (Supreme Servant) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `action-modifier`, `bond-actions` |

### Пилот меха (`bulwark.mecha-pilot`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Двигатель рунного ядра (Rune Core Engine) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `terrain`, `owned-entities`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Автономный (Autonomous) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `resource-check`, `terrain`, `owned-entities`, `summon-turns`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Идеальная синхронизация (Perfect Sync) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `effect-state`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `dice-hooks`, `deployment-hooks` |

## Альтруист

### Боевой инструктор (`altruist.battle-instructor`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Приказ к удару (Strike Order) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Обучающий момент (Teaching Moment) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `dice-hooks`, `bond-actions` |
| 3 | Вспомни обучение (Remember Your Training) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `action-modifier`, `bond-actions` |

### Эмпат (`altruist.empath`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Успокаивающая аура (Calming Aura) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state` |
| 2 | Защитный отклик (Protective Response) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline` |
| 3 | "Ты в порядке?" ("Are You Ok?") | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `bond-actions` |

### Гурман (`altruist.gourmand`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Здоровая трапеза (Healthy Meal) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `intermission-reset`, `inventory` |
| 2 | Бездонная кладовая (Bottomless Pantry) | кандидат | полная | `event-preview`, `event-summary`, `intermission-reset`, `inventory` |
| 3 | Общий опыт (Shared Experiences) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `inventory` |

### Небесный святой (`altruist.heavenly-saint`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Сила молитвы (Strength Of Prayer) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `alternate-resource`, `trigger-router`, `inventory` |
| 2 | Очищающий свет (Cleansing Light) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Великое восстановление (Grand Restoration) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier` |

### Предвидящий (`altruist.precognizant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Вспышка озарения (Flash Of Insight) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `dice-hooks` |
| 2 | Воспользоваться (Take Advantage) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `action-modifier` |
| 3 | Швырнуть в бесконечность (Hurl Into The Infinite) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `trigger-router`, `action-modifier` |

### Хирург (`altruist.surgeon`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Не навреди (Do No Harm) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 2 | Операционная процедура (Operational Procedure) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `damage-pipeline`, `dice-hooks`, `intermission-reset`, `inventory` |
| 3 | Чудотворец (Miracle Worker) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Заклинатель талисманов (`altruist.talisman-caster`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Священная печать (Sacred Seal) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Брошенный талисман (Tossed Talisman) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `inventory` |
| 3 | Экзорцизм (Exorcize) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `action-modifier` |

### Алхимик (`altruist.alchemist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Быстрая смесь (Quick Mix) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `trigger-router`, `action-modifier` |
| 2 | Мощная смесь (Powerful Mix) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `damage-pipeline`, `inventory` |
| 3 | Высокоинтенсивная смесь (High Intensity Mix) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `dice-hooks`, `inventory` |

### Хрономант (`altruist.chronomancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ускорение (Accelerate) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Замедление (Decelerate) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Остановка времени (Time Stop) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |

### Танцор (`altruist.dancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Партнер по танцу (Dance Partner) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier` |
| 2 | Сердца в унисон (Hearts In Tandem) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `dice-hooks` |
| 3 | Престиж (The Prestige) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Ходящий в тумане (`altruist.fog-walker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пустить дым (Blowing Smoke) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `trigger-router`, `choice-flow` |
| 2 | Мистическая дымка (Mystic Mist) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router` |
| 3 | Жалящий пар (Stinging Steam) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |

### Последняя надежда (`altruist.last-hope`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Примечательно отсутствует (Notably Absent) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier`, `action-history` |
| 2 | Героическое возвращение (Heroic Return) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `trigger-router`, `duration-scheduler` |
| 3 | Взрывное возвращение (Explosive Return) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router` |

### Репликатор (`altruist.replicator`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Форма эха (Echo Form) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Симметрия (Symmetry) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router` |
| 3 | Полная синхронизация (Full Sync) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Блуждающий огонек (`altruist.will-o-wisp`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Пламя духовного плетения (Spirit Weaving Flame) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `choice-flow`, `action-modifier`, `inventory` |
| 2 | Дружелюбные духи (Friendly Spirits) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `trigger-router` |
| 3 | Парные духи (Twinned Spirits) | кандидат | с выбором | `event-preview`, `event-summary`, `trigger-router`, `choice-flow` |

### Художник (`altruist.artist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Взмах кисти (Stroke Of The Brush) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `resource-check`, `effect-state`, `trigger-router`, `choice-flow`, `action-modifier` |
| 2 | Холст из плоти (Canvas Of Flesh) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `action-modifier` |
| 3 | Клеймо кисти (Brush-Brand) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `choice-flow`, `action-modifier`, `duration-scheduler` |

### Ученый бард (`altruist.bardic-savant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Музыкант (Musician) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `inventory` |
| 2 | Быстрая композиция (Quick Composition) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier` |
| 3 | На бис (Encore) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `choice-flow`, `action-modifier`, `inventory` |

### Сборщик колоды (`altruist.deckbuilder`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Добор (Draw) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `duration-scheduler`, `deployment-hooks` |
| 2 | Карточная ловушка (Card Trap) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Жадность (Greed) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `dice-hooks` |

## Подрывник

### Кровопускатель (`disruptor.bloodletter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Кровоточащее лезвие (Bleeding Edge) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `action-modifier` |
| 2 | Ищейка (Bloodhound) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Разрыв (Rupture) [Стычка -> Передышка] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Химик (`disruptor.chemist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Сублимация (Sublimation) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `effect-state`, `terrain`, `owned-entities`, `trigger-router`, `action-modifier`, `duration-scheduler` |
| 2 | Экспериментальная смесь (Experimental Mixture) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `trigger-router`, `damage-pipeline` |
| 3 | Осаждение (Deposition) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `effect-state`, `owned-entities`, `trigger-router`, `damage-pipeline` |

### Душитель (`disruptor.constrictor`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Обвить (Wrap) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier` |
| 2 | Удушение (Choke) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `damage-pipeline`, `action-modifier` |
| 3 | Скручивающий удар (Twisting Impact) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Карманник (`disruptor.cutpurse`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ловкие руки (Fast Hands) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `usage-limits`, `trigger-router` |
| 2 | Урвать (Snatch) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router` |
| 3 | Вор в ночи (Thief In The Night) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `duration-scheduler` |

### Морок (`disruptor.mind-breaker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | "Где вы?" ("Where Are You?") | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier` |
| 2 | "Что вы делаете?" ("What Do You Do?") | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router` |
| 3 | "Кто они?" ("Who Are They?") | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier` |

### Жнец (`disruptor.reaper`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Посев (Sow) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `usage-limits`, `trigger-router`, `action-modifier` |
| 2 | Уход (Tend) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `trigger-router` |
| 3 | Жатва (Reap) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `resource-check`, `effect-state`, `trigger-router`, `action-modifier` |

### Мастер тактики (`disruptor.tactical-master`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Остановиться и подумать (Stop And Think) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `effect-state`, `stance`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Анализ (Study) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `effect-state`, `trigger-router` |
| 3 | Эврика! (Eureka!) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `stance`, `trigger-router`, `action-modifier` |

### Автофаг (`disruptor.autophage`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Переливание (Transfusion) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Перенапряжение (Overexert) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `stance`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Рожденный изменчивой плотью (Born Of Mutable Flesh) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier` |

### Говорящий с землей (`disruptor.earth-speaker`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Тектонический сдвиг (Tectonic Shift) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline` |
| 2 | Земляные осколки (Earthen Shards) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `terrain`, `usage-limits`, `trigger-router`, `damage-pipeline` |
| 3 | Каменные солдаты (Stone Soldiers) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks` |

### Нечеловеческая сила (`disruptor.inhuman-strength`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Сильная рука (Strong-Arm) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `terrain`, `trigger-router` |
| 2 | Поршневой кулак (Piston Fist) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 3 | Проломить насквозь (Smash Through) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `usage-limits`, `trigger-router`, `damage-pipeline` |

### Уличный боец (`disruptor.street-fighter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Кровавые кастеты (Bloody Brass) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router` |
| 2 | Ломать и калечить (Break And Bruise) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Зверствовать (Brutalize) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Тело-рой (`disruptor.swarm-body`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Порхающая форма (Fluttering Form) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Исчезнуть в мухах (Vanish Into Flies) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `spatial-range`, `effect-state`, `trigger-router`, `duration-scheduler` |
| 3 | Пожрать (Devour) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `trigger-router`, `damage-pipeline` |

### Сирена (`disruptor.siren`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ты ведь не причинишь МНЕ боль? (You wouldn't hurt ME, would you?) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router` |
| 2 | Неотразимая (Irresistible) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `usage-limits`, `trigger-router` |
| 3 | Помогите-ка сюда (A little help over here?) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier` |

### Всадник волн (`disruptor.wave-rider`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Мягкие волны (Gentle Waves) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier` |
| 2 | Мощные волны (Momentous Waves) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | Водяная клетка (Aqua Cage) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `usage-limits`, `trigger-router` |

### Шагающий по буре (`disruptor.gale-strider`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Растущие ветра (Growing Winds) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `action-history` |
| 2 | Восходящий поток (Updraft) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router` |
| 3 | Рассекатель гор (Mountain Carver) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `terrain`, `trigger-router`, `damage-pipeline` |

### Охотник (`disruptor.hunter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Стальные челюсти (Steel Jaws) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Дальняя установка (Far Setting) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `action-modifier` |
| 3 | Яма-ловушка (Pit Trap) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `terrain`, `trigger-router`, `action-modifier` |

### Внутренний мир (`disruptor.inner-world`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Глубокий взгляд (Gaze Deeply) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `trigger-router`, `choice-flow`, `inventory` |
| 2 | Домен контроля (Domain Of Control) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `usage-limits`, `trigger-router`, `damage-pipeline` |
| 3 | Родная территория (Home Turf) | кандидат | частичная | `event-preview`, `event-summary`, `usage-limits`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Магическая схема (`disruptor.mage-s-array`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Начертание (Inscribe) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier`, `inventory` |
| 2 | Корректировка (Readjust) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `trigger-router` |
| 3 | Тюрьма собственного замысла (Prison Of Your Own Design) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `terrain`, `trigger-router`, `choice-flow`, `inventory` |

## Разрушитель

### Бомбардир (`ruiner.bombardier`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Взрыв!! (Explosion!!) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `action-modifier` |
| 2 | Взрыв!!! (Explosion!!!) | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `spatial-range`, `resource-check`, `owned-entities`, `trigger-router`, `action-modifier` |
| 3 | ВЗРЫВ!!!! (EXPLOSION!!!!) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `spatial-range`, `resource-check`, `owned-entities`, `trigger-router`, `action-modifier` |

### Револьверное колдовство (`ruiner.rapid-fire-sorcery`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Размножение (Proliferate) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |
| 2 | Выжженная земля (Scorched Earth) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `terrain`, `trigger-router`, `damage-pipeline` |
| 3 | Бесконечный огонь (Endless Fire) [Зарядка -> Заклинание] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `action-modifier`, `dice-hooks` |

### Ритуалист (`ruiner.ritualist`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Лей-линии (Ley Lines) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `resource-check`, `trigger-router`, `action-modifier`, `inventory` |
| 2 | Магическая артиллерия (Arcane Artillery) | кандидат | частичная | `event-preview`, `event-summary`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Фрактальные начертания (Fractal Etchings) | кандидат | ручная | `event-preview`, `event-summary`, `trigger-router`, `inventory` |

### Творец заклинаний (`ruiner.spellcrafter`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Эксперимент (Experimentation) | кандидат | с выбором | `event-preview`, `event-summary`, `spatial-cells`, `entity-lifecycle`, `owned-entities`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `inventory` |
| 2 | Закрепление (Solidification) | кандидат | с выбором | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `inventory` |
| 3 | Финализация (Finalization) | кандидат | с выбором | `event-preview`, `event-summary`, `trigger-router`, `action-modifier` |

### Ученик звезд (`ruiner.student-of-stars`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Высвобожденная мощь (Power Unleashed) [Зарядка -> Завершение] | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier` |
| 2 | Бесформенная сила (Formless Strength) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `owned-entities`, `trigger-router` |
| 3 | Момент истины (Moment Of Truth) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Криомант (`ruiner.cryomancer`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Охлаждение (Chill) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `action-modifier` |
| 2 | Ледяной нимб (Icicle Halo) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `rule-clock`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Раскол (Shatter) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `resource-check`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier` |

### Драматург (`ruiner.dramaturge`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Все смотрят на меня (All Eyes On Me) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `usage-limits`, `trigger-router`, `dice-hooks` |
| 2 | Украсть их огонь (Snatch Their Fire) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `trigger-router` |
| 3 | Сила подачи (Power In Presentation) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `action-history`, `inventory` |

### Дикая магия (`ruiner.feral-arcana`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Ворпальный коготь (Vorpal Claw) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-range`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 2 | Сорваться с цепи (Unchain) [Зарядка -> Взаимодействие] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `effect-state`, `rule-clock`, `trigger-router`, `choice-flow`, `action-modifier`, `duration-scheduler` |
| 3 | Хватка (Grasp) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Пламенное сердце (`ruiner.flame-heart`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Разогрев (Rev Up) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `effect-state`, `trigger-router`, `damage-pipeline` |
| 2 | Проклятый удар (Damning Impact) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history`, `dice-hooks` |
| 3 | Прах к праху (Ashes To Ashes) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Мрачный Вознесенный (`ruiner.grim-ascendant`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Непостоянная мощь (Impermanent Power) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `resource-check`, `effect-state`, `usage-limits`, `trigger-router`, `damage-pipeline`, `action-modifier`, `inventory` |
| 2 | Вытянуть жизнь (Drain Life) | кандидат | с выбором | `event-preview`, `event-summary`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks` |
| 3 | Умбра (Umbra) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `owned-entities`, `trigger-router`, `action-modifier` |

### Сильное натяжение (`ruiner.long-draw`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Наложить стрелу (Nock The Arrow) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier`, `dice-hooks`, `inventory` |
| 2 | Перьевой шаг (Feather Step) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router` |
| 3 | Пронзитель владык (Lord Piercer) [Подготовка x 3] | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `trigger-router`, `damage-pipeline`, `action-modifier`, `action-history` |

### Клинки маны (`ruiner.mana-blades`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | К оружию (Call Arms) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `trigger-router`, `action-modifier`, `action-history` |
| 2 | Орудия павших (Tools Of The Fallen) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `effect-state`, `trigger-router`, `action-modifier`, `dice-hooks` |
| 3 | Святой меч, Экскалибур (Saintly Sword, Excalibur) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `trigger-router`, `choice-flow`, `action-modifier` |

### Душа пустоты (`ruiner.void-soul`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Возвращение в ничто (Return To Nothing) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `effect-state`, `trigger-router`, `duration-scheduler` |
| 2 | Раствориться (Fade Away) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `resource-check`, `usage-limits`, `trigger-router` |
| 3 | Полое сердце (Hollow Heart) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-cells`, `entity-lifecycle`, `effect-state`, `rule-clock`, `owned-entities`, `trigger-router`, `damage-pipeline`, `action-modifier` |

### Громовая кровь (`ruiner.thunder-blood`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Райден (Raiden) | кандидат | частичная | `event-preview`, `event-summary`, `effect-state`, `rule-clock`, `trigger-router` |
| 2 | Заряженное заклинание (Energized Incantation) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `spatial-range`, `effect-state`, `rule-clock`, `trigger-router`, `action-modifier` |
| 3 | Разрядка (Discharge) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `spatial-cells`, `entity-lifecycle`, `effect-state`, `rule-clock`, `owned-entities`, `trigger-router`, `damage-pipeline`, `action-modifier`, `dice-hooks` |

### Фанатик (`ruiner.zealot`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Еретическая преданность (Heretical Devotion) | кандидат | частичная | `event-preview`, `event-summary`, `resource-check`, `rule-clock`, `usage-limits`, `trigger-router`, `action-modifier`, `action-history`, `dice-hooks`, `inventory` |
| 2 | Всегда под взглядом, утоплен в слезах (Always Watched, Drowned In Tears) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `effect-state`, `rule-clock`, `trigger-router` |
| 3 | Так не должно было быть (Never Meant To Be) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `rule-clock`, `terrain`, `trigger-router`, `choice-flow`, `action-modifier` |

### Аскет творения (`ruiner.creation-ascetic`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Формирование знаков (Forming Signs) | кандидат | с выбором | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `alternate-resource`, `terrain`, `trigger-router`, `choice-flow`, `damage-pipeline`, `action-modifier`, `dice-hooks`, `inventory` |
| 2 | Один истинный мир (One True World) | кандидат | полная | `event-preview`, `event-summary`, `terrain`, `trigger-router`, `damage-pipeline`, `action-modifier`, `inventory` |
| 3 | Труд благочестивых (Labor Of The Devout) [Заклинание -> Завершение] | кандидат | полная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `action-modifier`, `action-history` |

### Эго-оружие (`ruiner.ego-arm`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Я - твой меч (I Am Your Sword) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `trigger-router`, `damage-pipeline`, `deployment-hooks` |
| 2 | Покажи свои цели (Show Your Targets) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 3 | И я стану незаменимым (And I'll Become Irreplaceable) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `resource-check`, `owned-entities`, `entity-lifecycle`, `trigger-router`, `action-modifier`, `dice-hooks` |

### Зов наемника (`ruiner.sellsword-s-call`)

| Ур. | Название | Разметка | Адаптер | Возможности |
| ---: | --- | --- | --- | --- |
| 1 | Реприза воина (A Warrior's Reprise) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `damage-pipeline`, `action-modifier` |
| 2 | Боевой гимн (Battle Hymn) | кандидат | частичная | `event-preview`, `event-summary`, `movement-lifecycle`, `resource-check`, `effect-state`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `trigger-router`, `choice-flow`, `inventory` |
| 3 | Верховный наемник (Supreme Sellsword) | кандидат | частичная | `event-preview`, `event-summary`, `target-validation`, `event-participants`, `movement-lifecycle`, `resource-check`, `owned-entities`, `entity-lifecycle`, `summon-turns`, `usage-limits`, `trigger-router`, `choice-flow`, `action-modifier`, `bond-actions` |

## Обязательная ручная сверка

При обработке строки откройте полный текст Уровня в `source/translation/`, проверьте каждый тег и внесите точное исключение в `REVIEWED` либо правила классификации. Не повышайте автоматизацию только на основании этой карты.
