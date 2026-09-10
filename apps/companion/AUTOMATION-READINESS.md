# Карта заявленной готовности и доказательств автоматизации

> Генерируется командой `npm run readiness`. Таблицы не редактируются вручную.
> **Важно:** статусы `full`, `decision`, `attack`, `effect` и `state` — заявления реализации, а не независимая сертификация корректности.
> Источник заявлений по Уровням Техник — `technique-foundation-map.js`; по врагам — контракт `enemyRuleAutomation`. Независимые доказательства хранятся только в `automation-evidence.json`.

## Сводка

| Контур | Всего | Заявлено исполнимым | Формально E2E-сертифицировано | Неполный путь |
| --- | ---: | ---: | ---: | --- |
| Уровни Техник | 333 | 78 shared/inherited (23.4%) | 0 | 35 частичных; 220 ручных |
| Правила обычных врагов | 122 | 0 (0.0%) | 0 | 122 assisted |
| Атаки врагов | 40 | 0 | 0 | не установлено независимым аудитом |

Формально сертифицировано сейчас: **0** записей. Исполнимые уровни без evidence считаются **shared/inherited**, даже при совпавшем canonical digest: digest подтверждает текстовый источник, но не полноту поведения. Проценты выше измеряют охват кодом, а не верность правилам игры.

Автоматически отозвано из-за изменившегося исходника: **0** записей. Они перечислены ниже и не учитываются ни в одном сертифицированном счётчике.

### Автоматически отозванные evidence-записи

| Evidence id | Исходник | Зафиксированный digest | Текущий digest |
| --- | --- | --- | --- |
| — | — | — | — |

## Модель доверия

| Уровень | Что действительно доказано | Можно показывать как готовое |
| --- | --- | --- |
| `declared` | В реестре или адаптере стоит исполнимый статус | нет; это гипотеза для аудита |
| `core-tested` | Исходный текст сверен, есть прямые позитивный, негативный и граничный тесты ядра | только как проверенное ядро |
| `surface-tested` | Дополнительно проверены применимые UI, сеть и сохранение/загрузка | как кандидат на сертификацию |
| `certified` | Evidence-запись привязана к версии исходника и покрывает весь пользовательский путь | да, для указанной версии |

Генератор этой карты умеет доказать согласованность реестров, существование указанных тестовых файлов и полноту evidence-записи. Он намеренно **не выводит смысловую корректность из названия статуса, наличия обработчика или grep по тестам**.

### Как ложный `full` проходит незамеченным

- адаптер создаёт событие, но неверно трактует дальность, цель, стоимость или момент срабатывания;
- happy path работает, но отмена, KO, повторный ответ или устаревший prompt оставляют состояние;
- ядро верно, а UI, сеть или импорт теряют часть контекста;
- исходный текст изменился после реализации, а статус остался прежним;
- уникальная оговорка правила молча пропущена универсальным обработчиком.

### Обязательная evidence-запись

Для повышения до `certified` в `automation-evidence.json` нужны: стабильный id правила, `sourceDigest`, заявленный статус, уровень доверия, проверяемые claims, точные тестовые файлы с конкретным `case` или командой запуска, применимые поверхности `core/ui/network/persistence`, граничные случаи и commit аудита. CI отклоняет неполную запись и пропавший тестовый файл. Изменение исходника меняет digest: генератор автоматически отзывает и явно перечисляет прежнее evidence, не принимая его за действующую сертификацию.

До независимого прохода системные оценки ниже означают зрелость инфраструктуры и объём найденных тестов, а не процент буквально верных игровых правил.

## Готовность системных слоёв

| Слой | Готовность | Уже есть | Следующий обязательный шаг | Где работать |
| --- | --- | --- | --- | --- |
| Событийное ядро | высокая | атомарные пачки, idempotency, preview, участники, версия Сцены | property/fuzz-проверки конфликтующих пачек и миграций старых сохранений | `scene-engine-core.js`, `scene-events.js`, `tests/scene-engine.mjs` |
| Цели и геометрия | высокая | персонажи, пустые клетки, зоны, линии, стены, удалённые клетки | единый typed target для клеток/стен/местности/сущностей вместо отдельных полей | `scene-query.js`, `scene-actions.js`, `technique-engine.js` |
| Реакции и prompt-цепочки | средне-высокая | очередь, контроллер, повторная валидация, отмена, optional participants | очередь нескольких одновременных prompt одного триггера и явная политика приоритета | `scene-triggers.js`, `scene-responses.js`, `scene-events.js` |
| Эффекты и урон | высокая | источники, сроки, Раны, лечение, снятие по источнику | формализовать редкие замены урона и несколько конкурирующих prevent/redirect | `scene-engine-core.js`, `scene-query.js`, `scene-responses.js` |
| Движение и пространства | средне-высокая | пути, displacement, топология, Внутренние миры, массовый сдвиг | общий контракт крупных/многоклеточных персонажей и движения связанных групп | `scene-movement.js`, `scene-triggers.js`, `scene-responses.js` |
| Сущности и призывы | средняя | зоны, маркеры, владелец, сроки, некоторые Призывы | универсальный spawn/deploy, лист призыва, владелец управления и делегированный Ход | `scene-foundations.js`, `scene-events.js`, `scene-actions-ui.js` |
| Сеть | средне-высокая | intent v2, авторитет Нарратора, локальный UI, атомарные ticks | многоклиентные гонки prompt/turn/undo и reconnect во время незавершённой цепочки | `network-v2.js`, `sync.js`, `tests/network-v2.mjs` |
| Сохранения | средне-высокая | нормализация, отсечение stale lifecycle, канонические клетки | versioned migrations и corpus реальных старых экспортов | `app-core.js`, `tests/qa.mjs` |
| Интерфейс и доступность | средняя | поле-first UI, подсветка, панели, мобильная база | browser E2E для выбора клеток, prompt-цепочек, клавиатуры и 320 px | `scene-ui.js`, `app-scene-events.js`, `vtt-cockpit.css` |
| Наблюдаемость | низко-средняя | журнал событий и тестовые сводки | диагностический экспорт цепочки: событие → триггер → prompt → результат | новый read-only debug adapter рядом с `scene-query.js` |

## Техники по архетипам

| Архетип | Уровней | Заявлено full | Заявлено decision | Заявлено partial | Заявлено manual |
| --- | ---: | ---: | ---: | ---: | ---: |
| Powerhouse | 60 | 6 | 3 | 9 | 42 |
| Vagabond | 60 | 9 | 11 | 4 | 36 |
| Bulwark | 48 | 3 | 3 | 2 | 40 |
| Altruist | 57 | 2 | 11 | 2 | 42 |
| Disruptor | 54 | 4 | 6 | 12 | 32 |
| Ruiner | 54 | 6 | 14 | 6 | 28 |

Полная построчная карта всех 333 Уровней canonical EN находится в `TECHNIQUE-FOUNDATION-MAP.md`. Её статусы также заявленные: таблица удобна для планирования аудита, но не заменяет evidence-записи. Ниже перечислены самые дорогие известные пробелы.

### Ручные Уровни

| Техника | Ур. | Правило | Чего не хватает |
| --- | ---: | --- | --- |
| Berserker (`powerhouse.berserker`) | 1 | Revenge | `combat-meter` |
| Berserker (`powerhouse.berserker`) | 2 | Cornered Dog | тонкий адаптер уникального условия поверх уже готового ядра |
| Berserker (`powerhouse.berserker`) | 3 | Take A Beating | тонкий адаптер уникального условия поверх уже готового ядра |
| Dragonslayer (`powerhouse.dragonslayer`) | 2 | Wide Arc | тонкий адаптер уникального условия поверх уже готового ядра |
| Duelist (`powerhouse.duelist`) | 1 | Riposte [ Block → Skirmish ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Duelist (`powerhouse.duelist`) | 3 | Deflecting Blow | тонкий адаптер уникального условия поверх уже готового ядра |
| Flagellant (`powerhouse.flagellant`) | 1 | Thrill | тонкий адаптер уникального условия поверх уже готового ядра |
| Flagellant (`powerhouse.flagellant`) | 2 | Wild Rush | тонкий адаптер уникального условия поверх уже готового ядра |
| Flagellant (`powerhouse.flagellant`) | 3 | Bled Dry | тонкий адаптер уникального условия поверх уже готового ядра |
| Struggler (`powerhouse.struggler`) | 1 | Effort | тонкий адаптер уникального условия поверх уже готового ядра |
| Struggler (`powerhouse.struggler`) | 2 | Adrenaline | тонкий адаптер уникального условия поверх уже готового ядра |
| Struggler (`powerhouse.struggler`) | 3 | Defy Reason | тонкий адаптер уникального условия поверх уже готового ядра |
| SpellSword (`powerhouse.spellsword`) | 1 | Twin Suns [ Cast → Skirmish ] | `action-copy` |
| Unbroken (`powerhouse.unbroken`) | 1 | Get Back Up | `duel-flow` |
| Unbroken (`powerhouse.unbroken`) | 2 | Furious Revival | тонкий адаптер уникального условия поверх уже готового ядра |
| Unbroken (`powerhouse.unbroken`) | 3 | Phoenix | `duel-flow` |
| Breacher (`powerhouse.breacher`) | 2 | Both Barrels | тонкий адаптер уникального условия поверх уже готового ядра |
| Breacher (`powerhouse.breacher`) | 3 | Annihilate | тонкий адаптер уникального условия поверх уже готового ядра |
| Dual Wielder (`powerhouse.dual-wielder`) | 1 | Twinned blow | тонкий адаптер уникального условия поверх уже готового ядра |
| Dual Wielder (`powerhouse.dual-wielder`) | 2 | Frenzied Barrage | тонкий адаптер уникального условия поверх уже готового ядра |
| Dual Wielder (`powerhouse.dual-wielder`) | 3 | Varied Blades | тонкий адаптер уникального условия поверх уже готового ядра |
| Intimidator (`powerhouse.intimidator`) | 1 | "Pathetic" | тонкий адаптер уникального условия поверх уже готового ядра |
| Intimidator (`powerhouse.intimidator`) | 2 | "Out Of My Way" | тонкий адаптер уникального условия поверх уже готового ядра |
| Intimidator (`powerhouse.intimidator`) | 3 | "Fools And Dead Men" | тонкий адаптер уникального условия поверх уже готового ядра |
| Martial Artist (`powerhouse.martial-artist`) | 1 | Art Of The 8 Hammers | тонкий адаптер уникального условия поверх уже готового ядра |
| Martial Artist (`powerhouse.martial-artist`) | 2 | Flow-State | тонкий адаптер уникального условия поверх уже готового ядра |
| Martial Artist (`powerhouse.martial-artist`) | 3 | Unlimited Blows | тонкий адаптер уникального условия поверх уже готового ядра |
| Monastic Warrior (`powerhouse.monastic-sage`) | 1 | Mind Made Manifest | тонкий адаптер уникального условия поверх уже готового ядра |
| Monastic Warrior (`powerhouse.monastic-sage`) | 2 | Calm Within Chaos | тонкий адаптер уникального условия поверх уже готового ядра |
| Monastic Warrior (`powerhouse.monastic-sage`) | 3 | Sublime Equanimity | тонкий адаптер уникального условия поверх уже готового ядра |
| Lancer (`powerhouse.lancer`) | 1 | Pierce | тонкий адаптер уникального условия поверх уже готового ядра |
| Lancer (`powerhouse.lancer`) | 2 | Phalanx | тонкий адаптер уникального условия поверх уже готового ядра |
| Lancer (`powerhouse.lancer`) | 3 | Cannon-Arm [ Breathe → Skirmish ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Predator (`powerhouse.predator`) | 1 | Yearn | тонкий адаптер уникального условия поверх уже готового ядра |
| Predator (`powerhouse.predator`) | 2 | Obsess | тонкий адаптер уникального условия поверх уже готового ядра |
| Predator (`powerhouse.predator`) | 3 | Envelop | тонкий адаптер уникального условия поверх уже готового ядра |
| Improvisational Fighter (`powerhouse.improvisational-fighter`) | 2 | "That One Hurts!" | тонкий адаптер уникального условия поверх уже готового ядра |
| Improvisational Fighter (`powerhouse.improvisational-fighter`) | 3 | Last Resort | `combat-meter` |
| Warring Ascendant (`powerhouse.warring-ascendant`) | 2 | Esoteric Blades | `transformation`, `action-copy` |
| Heroic Ascendant (`powerhouse.heroic-ascendant`) | 1 | Warrior Of Legend | тонкий адаптер уникального условия поверх уже готового ядра |
| Heroic Ascendant (`powerhouse.heroic-ascendant`) | 2 | Hero's Feat | тонкий адаптер уникального условия поверх уже готового ядра |
| Heroic Ascendant (`powerhouse.heroic-ascendant`) | 3 | Mastered Strength | тонкий адаптер уникального условия поверх уже готового ядра |
| Aerial Master (`vagabond.aerial-master`) | 2 | Hunt | тонкий адаптер уникального условия поверх уже готового ядра |
| Aerial Master (`vagabond.aerial-master`) | 3 | Falling Ax Strike | тонкий адаптер уникального условия поверх уже готового ядра |
| Sniper (`vagabond.sniper`) | 1 | Long Shot | тонкий адаптер уникального условия поверх уже готового ядра |
| Sniper (`vagabond.sniper`) | 2 | Bunker Down | тонкий адаптер уникального условия поверх уже готового ядра |
| Sniper (`vagabond.sniper`) | 3 | Deadeye [ Hide → Talent Finisher ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Skirmisher (`vagabond.skirmisher`) | 1 | Sting | тонкий адаптер уникального условия поверх уже готового ядра |
| Skirmisher (`vagabond.skirmisher`) | 2 | Shifting Blows | тонкий адаптер уникального условия поверх уже готового ядра |
| Skirmisher (`vagabond.skirmisher`) | 3 | Rebound | тонкий адаптер уникального условия поверх уже готового ядра |
| Speed Demon (`vagabond.speed-demon`) | 1 | Fade | тонкий адаптер уникального условия поверх уже готового ядра |
| Speed Demon (`vagabond.speed-demon`) | 3 | Flash Step [ Breathe → Stride ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Untouchable (`vagabond.untouchable`) | 3 | Fighter's Instinct [ Dodge → Skirmish ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Acrobat (`vagabond.acrobat`) | 1 | Flying Kick [ Jump → Skirmish ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Acrobat (`vagabond.acrobat`) | 2 | Wall Jump | тонкий адаптер уникального условия поверх уже готового ядра |
| Acrobat (`vagabond.acrobat`) | 3 | Weightless Body | тонкий адаптер уникального условия поверх уже готового ядра |
| Blade Master (`vagabond.blade-master`) | 1 | Draw Stance | тонкий адаптер уникального условия поверх уже готового ядра |
| Blade Master (`vagabond.blade-master`) | 2 | Divide In One Motion [ Breathe → Jump ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Blade Master (`vagabond.blade-master`) | 3 | Leaping Koi | тонкий адаптер уникального условия поверх уже готового ядра |
| Cunning Fighter (`vagabond.cunning-fighter`) | 3 | At a Glance | тонкий адаптер уникального условия поверх уже готового ядра |
| Enchained (`vagabond.enchained`) | 2 | Draw In | тонкий адаптер уникального условия поверх уже готового ядра |
| Enchained (`vagabond.enchained`) | 3 | Momentum [ Cast → Skirmish ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Malicious Mimic (`vagabond.malicious-mimic`) | 1 | "Anything You Can Do…" | `action-copy` |
| Malicious Mimic (`vagabond.malicious-mimic`) | 2 | Rehearsed Movements | тонкий адаптер уникального условия поверх уже готового ядра |
| Malicious Mimic (`vagabond.malicious-mimic`) | 3 | "…I Can Do Better" | `action-copy` |
| Weaponsmith (`vagabond.weaponsmith`) | 1 | Trick Weapon | тонкий адаптер уникального условия поверх уже готового ядра |
| Weaponsmith (`vagabond.weaponsmith`) | 2 | Adaptive Edge | тонкий адаптер уникального условия поверх уже готового ядра |
| Weaponsmith (`vagabond.weaponsmith`) | 3 | Metalurgy | тонкий адаптер уникального условия поверх уже готового ядра |
| Opportunist (`vagabond.opportunist`) | 1 | Pack Tactics | тонкий адаптер уникального условия поверх уже готового ядра |
| Opportunist (`vagabond.opportunist`) | 2 | Hungry Eyes | тонкий адаптер уникального условия поверх уже готового ядра |
| Opportunist (`vagabond.opportunist`) | 3 | Launcher Combo | тонкий адаптер уникального условия поверх уже готового ядра |
| Reflector (`vagabond.reflector`) | 1 | Catch The Blade | тонкий адаптер уникального условия поверх уже готового ядра |
| Reflector (`vagabond.reflector`) | 2 | Watch And Wait | тонкий адаптер уникального условия поверх уже готового ядра |
| Reflector (`vagabond.reflector`) | 3 | To Carry Their Fury | тонкий адаптер уникального условия поверх уже готового ядра |
| Detective (`vagabond.dim-mak`) | 3 | 4-Point Execution | тонкий адаптер уникального условия поверх уже готового ядра |
| Drunkard (`vagabond.drunkard`) | 1 | Down The Hatch | `deployment-hooks` |
| Drunkard (`vagabond.drunkard`) | 2 | Fool's Dance | тонкий адаптер уникального условия поверх уже готового ядра |
| Drunkard (`vagabond.drunkard`) | 3 | Chug | тонкий адаптер уникального условия поверх уже готового ядра |
| Crusher (`bulwark.crusher`) | 1 | 30,000 Tons | тонкий адаптер уникального условия поверх уже готового ядра |
| Crusher (`bulwark.crusher`) | 2 | Hammerfall | тонкий адаптер уникального условия поверх уже готового ядра |
| Crusher (`bulwark.crusher`) | 3 | "You Look Like A Nail" | тонкий адаптер уникального условия поверх уже готового ядра |
| Giant Frame (`bulwark.giant-frame`) | 2 | Immense | `deployment-hooks`, `multi-space-actor` |
| Giant Frame (`bulwark.giant-frame`) | 3 | Shockwave | тонкий адаптер уникального условия поверх уже готового ядра |
| Iron Bodied (`bulwark.iron-bodied`) | 1 | Tough As Stone | тонкий адаптер уникального условия поверх уже готового ядра |
| Iron Bodied (`bulwark.iron-bodied`) | 3 | Stainless Stride | тонкий адаптер уникального условия поверх уже готового ядра |
| Vanguard Defender (`bulwark.vanguard-defender`) | 1 | White Knight | тонкий адаптер уникального условия поверх уже готового ядра |
| Vanguard Defender (`bulwark.vanguard-defender`) | 2 | Steel Angel | тонкий адаптер уникального условия поверх уже готового ядра |
| Vanguard Defender (`bulwark.vanguard-defender`) | 3 | Inspire Courage | тонкий адаптер уникального условия поверх уже готового ядра |
| Absolute Bastard (`bulwark.absolute-bastard`) | 1 | Easy To Hate | тонкий адаптер уникального условия поверх уже готового ядра |
| Absolute Bastard (`bulwark.absolute-bastard`) | 2 | Bully | тонкий адаптер уникального условия поверх уже готового ядра |
| Absolute Bastard (`bulwark.absolute-bastard`) | 3 | Add Injury To Insult | тонкий адаптер уникального условия поверх уже готового ядра |
| Battle Jockey (`bulwark.battle-jockey`) | 1 | Trusty Steed | `summon-turns`, `deployment-hooks` |
| Battle Jockey (`bulwark.battle-jockey`) | 2 | Grasping Jaws | `summon-turns` |
| Battle Jockey (`bulwark.battle-jockey`) | 3 | Roaring Entry | `summon-turns` |
| Grappler (`bulwark.grappler`) | 1 | Restrain | тонкий адаптер уникального условия поверх уже готового ядра |
| Grappler (`bulwark.grappler`) | 3 | Finishing Move [ Body Finisher → Jump ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Juggernaut (`bulwark.juggernaut`) | 1 | Wild Charge | тонкий адаптер уникального условия поверх уже готового ядра |
| Juggernaut (`bulwark.juggernaut`) | 2 | Violence | тонкий адаптер уникального условия поверх уже готового ядра |
| Juggernaut (`bulwark.juggernaut`) | 3 | "Eat Dirt!" | тонкий адаптер уникального условия поверх уже готового ядра |
| Mollycoddler (`bulwark.runic-retribution`) | 1 | Lash | тонкий адаптер уникального условия поверх уже готового ядра |
| Mollycoddler (`bulwark.runic-retribution`) | 2 | Loving Rite | тонкий адаптер уникального условия поверх уже готового ядра |
| Mollycoddler (`bulwark.runic-retribution`) | 3 | Devotion | тонкий адаптер уникального условия поверх уже готового ядра |
| Rising Challenger (`bulwark.rising-challenger`) | 1 | Perfect Deflection | тонкий адаптер уникального условия поверх уже готового ядра |
| Rising Challenger (`bulwark.rising-challenger`) | 2 | "You'll Have To Get Through Me!" | тонкий адаптер уникального условия поверх уже готового ядра |
| Shield Bearer (`bulwark.shield-bearer`) | 1 | Wall | тонкий адаптер уникального условия поверх уже готового ядра |
| Shield Bearer (`bulwark.shield-bearer`) | 2 | Shield Charge | тонкий адаптер уникального условия поверх уже готового ядра |
| Shield Bearer (`bulwark.shield-bearer`) | 3 | Focused Defense | тонкий адаптер уникального условия поверх уже готового ядра |
| Stalwart Sentry (`bulwark.stalwart-sentry`) | 1 | Guardian | тонкий адаптер уникального условия поверх уже готового ядра |
| Stalwart Sentry (`bulwark.stalwart-sentry`) | 3 | Zone Of Influence | тонкий адаптер уникального условия поверх уже готового ядра |
| Bestial Ascendant (`bulwark.beastial-ascendant`) | 1 | Beastly | `transformation`, `combat-meter`, `action-copy` |
| Bestial Ascendant (`bulwark.beastial-ascendant`) | 2 | Inheritance | `transformation`, `action-copy` |
| Bestial Ascendant (`bulwark.beastial-ascendant`) | 3 | Apex | `transformation`, `action-copy` |
| Guard Caller (`bulwark.guardian-angel`) | 1 | Two Bodies | `multi-space-actor` |
| Guard Caller (`bulwark.guardian-angel`) | 2 | Together In Life | тонкий адаптер уникального условия поверх уже готового ядра |
| Guard Caller (`bulwark.guardian-angel`) | 3 | Together In Death | `multi-space-actor` |
| Mecha Pilot (`bulwark.mecha-pilot`) | 1 | Rune Core Engine | `multi-space-actor` |
| Mecha Pilot (`bulwark.mecha-pilot`) | 2 | Autonomous | `summon-turns`, `multi-space-actor` |
| Mecha Pilot (`bulwark.mecha-pilot`) | 3 | Perfect Sync | `summon-turns`, `multi-space-actor` |
| Analyst (`altruist.precognizant`) | 1 | Flash Of Insight | тонкий адаптер уникального условия поверх уже готового ядра |
| Analyst (`altruist.precognizant`) | 2 | Take Advantage | тонкий адаптер уникального условия поверх уже готового ядра |
| Analyst (`altruist.precognizant`) | 3 | Watch And Wait | тонкий адаптер уникального условия поверх уже готового ядра |
| Battle Instructor (`altruist.battle-instructor`) | 1 | Strike Order | тонкий адаптер уникального условия поверх уже готового ядра |
| Battle Instructor (`altruist.battle-instructor`) | 2 | Teaching Moment | `bond-actions` |
| Battle Instructor (`altruist.battle-instructor`) | 3 | Remember Your Training | `bond-actions` |
| Gourmand (`altruist.gourmand`) | 1 | Healthy Meal | тонкий адаптер уникального условия поверх уже готового ядра |
| Gourmand (`altruist.gourmand`) | 3 | Shared Experiences | `bond-actions` |
| Surgeon (`altruist.surgeon`) | 2 | Operational Procedure | тонкий адаптер уникального условия поверх уже готового ядра |
| Surgeon (`altruist.surgeon`) | 3 | Miracle Worker | тонкий адаптер уникального условия поверх уже готового ядра |
| Tactical Master (`disruptor.tactical-master`) | 1 | Stop And Think | тонкий адаптер уникального условия поверх уже готового ядра |
| Tactical Master (`disruptor.tactical-master`) | 2 | Study | тонкий адаптер уникального условия поверх уже готового ядра |
| Tactical Master (`disruptor.tactical-master`) | 3 | Eureka! | тонкий адаптер уникального условия поверх уже готового ядра |
| Talisman Exorcist (`altruist.talisman-caster`) | 1 | Sacred Seal | тонкий адаптер уникального условия поверх уже готового ядра |
| Talisman Exorcist (`altruist.talisman-caster`) | 2 | Tossed Talisman | тонкий адаптер уникального условия поверх уже готового ядра |
| Talisman Exorcist (`altruist.talisman-caster`) | 3 | Exorcize | тонкий адаптер уникального условия поверх уже готового ядра |
| Abjuring Sage (`altruist.abjuring-sage`) | 1 | Barrier | тонкий адаптер уникального условия поверх уже готового ядра |
| Abjuring Sage (`altruist.abjuring-sage`) | 2 | Impenetrable | тонкий адаптер уникального условия поверх уже готового ядра |
| Abjuring Sage (`altruist.abjuring-sage`) | 3 | Block Beam | тонкий адаптер уникального условия поверх уже готового ядра |
| Alchemist (`altruist.alchemist`) | 3 | High Intensity Mix | тонкий адаптер уникального условия поверх уже готового ядра |
| Dancer (`altruist.dancer`) | 1 | Dance Partner | тонкий адаптер уникального условия поверх уже готового ядра |
| Dancer (`altruist.dancer`) | 2 | Hearts In Tandem | тонкий адаптер уникального условия поверх уже готового ядра |
| Dancer (`altruist.dancer`) | 3 | The Prestige | тонкий адаптер уникального условия поверх уже готового ядра |
| Fog Walker (`altruist.fog-walker`) | 1 | Blowing Smoke | тонкий адаптер уникального условия поверх уже готового ядра |
| Fog Walker (`altruist.fog-walker`) | 2 | Mystic Mist | тонкий адаптер уникального условия поверх уже готового ядра |
| Fog Walker (`altruist.fog-walker`) | 3 | Stinging Steam | тонкий адаптер уникального условия поверх уже готового ядра |
| Last Hope (`altruist.last-hope`) | 1 | Notably Absent | тонкий адаптер уникального условия поверх уже готового ядра |
| Last Hope (`altruist.last-hope`) | 2 | Heroic Return | `combat-meter` |
| Last Hope (`altruist.last-hope`) | 3 | Explosive Return | тонкий адаптер уникального условия поверх уже готового ядра |
| Replicator (`altruist.replicator`) | 1 | Echo Form | тонкий адаптер уникального условия поверх уже готового ядра |
| Replicator (`altruist.replicator`) | 2 | Symmetry | тонкий адаптер уникального условия поверх уже готового ядра |
| Replicator (`altruist.replicator`) | 3 | Full Sync | тонкий адаптер уникального условия поверх уже готового ядра |
| Temporal Sage (`altruist.chronomancer`) | 1 | Accelerate | тонкий адаптер уникального условия поверх уже готового ядра |
| Virtuoso (`altruist.bardic-savant`) | 1 | Musician | тонкий адаптер уникального условия поверх уже готового ядра |
| Virtuoso (`altruist.bardic-savant`) | 2 | Reverb | тонкий адаптер уникального условия поверх уже готового ядра |
| Virtuoso (`altruist.bardic-savant`) | 3 | Encore | тонкий адаптер уникального условия поверх уже готового ядра |
| Artist (`altruist.artist`) | 1 | Stroke Of The Brush | тонкий адаптер уникального условия поверх уже готового ядра |
| Artist (`altruist.artist`) | 2 | Canvas Of Flesh | тонкий адаптер уникального условия поверх уже готового ядра |
| Artist (`altruist.artist`) | 3 | Brush-Brand | тонкий адаптер уникального условия поверх уже готового ядра |
| Deckbuilder (`altruist.deckbuilder`) | 1 | Draw | тонкий адаптер уникального условия поверх уже готового ядра |
| Deckbuilder (`altruist.deckbuilder`) | 2 | Card Capture | тонкий адаптер уникального условия поверх уже готового ядра |
| Deckbuilder (`altruist.deckbuilder`) | 3 | Greed | тонкий адаптер уникального условия поверх уже готового ядра |
| Bloodletter (`disruptor.bloodletter`) | 1 | Bleeding Edge | тонкий адаптер уникального условия поверх уже готового ядра |
| Bloodletter (`disruptor.bloodletter`) | 2 | Bloodhound | тонкий адаптер уникального условия поверх уже готового ядра |
| Bloodletter (`disruptor.bloodletter`) | 3 | Rupture [ Skirmish → Breathe ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Constrictor (`disruptor.constrictor`) | 3 | Twisting Impact | тонкий адаптер уникального условия поверх уже готового ядра |
| Cutpurse (`disruptor.cutpurse`) | 1 | Fast Hands | тонкий адаптер уникального условия поверх уже готового ядра |
| Cutpurse (`disruptor.cutpurse`) | 2 | Snatch | тонкий адаптер уникального условия поверх уже готового ядра |
| Cutpurse (`disruptor.cutpurse`) | 3 | Rob Them Blind | тонкий адаптер уникального условия поверх уже готового ядра |
| Light Bender (`disruptor.light-bender`) | 1 | Blendendes Licht | тонкий адаптер уникального условия поверх уже готового ядра |
| Light Bender (`disruptor.light-bender`) | 2 | Sonneneruption | тонкий адаптер уникального условия поверх уже готового ядра |
| Light Bender (`disruptor.light-bender`) | 3 | Falscher Stern | тонкий адаптер уникального условия поверх уже готового ядра |
| Reaper (`disruptor.reaper`) | 1 | Sow | тонкий адаптер уникального условия поверх уже готового ядра |
| Reaper (`disruptor.reaper`) | 3 | Reap | тонкий адаптер уникального условия поверх уже готового ядра |
| Street Fighter (`disruptor.street-fighter`) | 1 | Bloody Brass | тонкий адаптер уникального условия поверх уже готового ядра |
| Street Fighter (`disruptor.street-fighter`) | 2 | Break And Bruise | тонкий адаптер уникального условия поверх уже готового ядра |
| Street Fighter (`disruptor.street-fighter`) | 3 | Brutalize | тонкий адаптер уникального условия поверх уже готового ядра |
| Earth Speaker (`disruptor.earth-speaker`) | 1 | Stone Soldiers | тонкий адаптер уникального условия поверх уже готового ядра |
| Earth Speaker (`disruptor.earth-speaker`) | 2 | Tectonic Shift | тонкий адаптер уникального условия поверх уже готового ядра |
| Earth Speaker (`disruptor.earth-speaker`) | 3 | Earthen Shards | тонкий адаптер уникального условия поверх уже готового ядра |
| Strongman (`disruptor.inhuman-strength`) | 1 | Strong-Arm | тонкий адаптер уникального условия поверх уже готового ядра |
| Strongman (`disruptor.inhuman-strength`) | 2 | Piston Fist | тонкий адаптер уникального условия поверх уже готового ядра |
| Strongman (`disruptor.inhuman-strength`) | 3 | Smash Through | тонкий адаптер уникального условия поверх уже готового ядра |
| SwarmKin (`disruptor.swarm-body`) | 1 | Fluttering Form | тонкий адаптер уникального условия поверх уже готового ядра |
| SwarmKin (`disruptor.swarm-body`) | 2 | Vanish Into Flies | тонкий адаптер уникального условия поверх уже готового ядра |
| SwarmKin (`disruptor.swarm-body`) | 3 | Devour | тонкий адаптер уникального условия поверх уже готового ядра |
| Wave Rider (`disruptor.wave-rider`) | 2 | Momentous Waves | тонкий адаптер уникального условия поверх уже готового ядра |
| Wave Rider (`disruptor.wave-rider`) | 3 | Aqua Cage | тонкий адаптер уникального условия поверх уже готового ядра |
| Mind Breaker (`disruptor.mind-breaker`) | 1 | "Where Are You?" | тонкий адаптер уникального условия поверх уже готового ядра |
| Gale Strider (`disruptor.gale-strider`) | 2 | Updraft | тонкий адаптер уникального условия поверх уже готового ядра |
| Gale Strider (`disruptor.gale-strider`) | 3 | Mountain Carver | тонкий адаптер уникального условия поверх уже готового ядра |
| Jailor (`disruptor.mage-s-array`) | 1 | Erect | тонкий адаптер уникального условия поверх уже готового ядра |
| Jailor (`disruptor.mage-s-array`) | 2 | Readjust | тонкий адаптер уникального условия поверх уже готового ядра |
| Jailor (`disruptor.mage-s-array`) | 3 | Prison Of Your Own Design | тонкий адаптер уникального условия поверх уже готового ядра |
| Eradicator (`ruiner.rapid-fire-sorcery`) | 1 | Proliferate | тонкий адаптер уникального условия поверх уже готового ядра |
| Eradicator (`ruiner.rapid-fire-sorcery`) | 3 | Endless Fire [ Charge → Cast ] | `combat-meter` |
| Ritualist (`ruiner.ritualist`) | 2 | Arcane Artillery | `combat-meter` |
| Ritualist (`ruiner.ritualist`) | 3 | Fractal Etchings | тонкий адаптер уникального условия поверх уже готового ядра |
| Student Of Stars (`ruiner.student-of-stars`) | 1 | Power Unleashed [ Charge → Finisher ] | `combat-meter` |
| Student Of Stars (`ruiner.student-of-stars`) | 3 | Moment Of Truth | `duel-flow` |
| Blade Smith (`ruiner.mana-blades`) | 1 | Call Arms | `action-copy` |
| Blade Smith (`ruiner.mana-blades`) | 2 | Blade Storm | тонкий адаптер уникального условия поверх уже готового ядра |
| Blade Smith (`ruiner.mana-blades`) | 3 | Saintly Sword, Excalibur | `transformation`, `action-copy` |
| Dramaturge (`ruiner.dramaturge`) | 1 | All Eyes On Me | `combat-meter` |
| Dramaturge (`ruiner.dramaturge`) | 2 | Snatch Their Fire | `combat-meter` |
| Dramaturge (`ruiner.dramaturge`) | 3 | Power In Presentation | `combat-meter` |
| Feral Arcanist (`ruiner.feral-arcana`) | 1 | Vorpal Claw | тонкий адаптер уникального условия поверх уже готового ядра |
| Flame Heart (`ruiner.flame-heart`) | 1 | Rev Up | тонкий адаптер уникального условия поверх уже готового ядра |
| Flame Heart (`ruiner.flame-heart`) | 2 | Damning Impact | `combat-meter` |
| Flame Heart (`ruiner.flame-heart`) | 3 | Ashes To Ashes | тонкий адаптер уникального условия поверх уже готового ядра |
| Frost Veiler (`ruiner.cryomancer`) | 3 | Shatter | тонкий адаптер уникального условия поверх уже готового ядра |
| Grim Ascendant (`ruiner.grim-ascendant`) | 3 | Umbra | `transformation` |
| Ranger (`ruiner.long-draw`) | 1 | Nock The Arrow | тонкий адаптер уникального условия поверх уже готового ядра |
| Ranger (`ruiner.long-draw`) | 2 | Feather Step | тонкий адаптер уникального условия поверх уже готового ядра |
| Ranger (`ruiner.long-draw`) | 3 | Lord Piercer [ Prepare × 3 ] | тонкий адаптер уникального условия поверх уже готового ядра |
| Sword Caller (`ruiner.sellsword-s-call`) | 2 | Warrior's Fury | `summon-turns` |
| Sword Caller (`ruiner.sellsword-s-call`) | 3 | Supreme Sellsword | `summon-turns`, `bond-actions`, `deployment-hooks` |
| Void Soul (`ruiner.void-soul`) | 1 | Return To Nothing | тонкий адаптер уникального условия поверх уже готового ядра |
| Void Soul (`ruiner.void-soul`) | 2 | Fade Away | тонкий адаптер уникального условия поверх уже готового ядра |
| Ego Arm (`ruiner.ego-arm`) | 1 | I Am Your Sword | `deployment-hooks`, `transformation` |
| Ego Arm (`ruiner.ego-arm`) | 2 | Show Your Targets | тонкий адаптер уникального условия поверх уже готового ядра |
| Ego Arm (`ruiner.ego-arm`) | 3 | And I'll Become Irreplaceable | тонкий адаптер уникального условия поверх уже готового ядра |

### Общие блокеры частичных и ручных Техник

| Возможность | Затронуто Уровней | Почему это выгодная следующая инвестиция |
| --- | ---: | --- |
| `combat-meter` · Напряжение и общие счетчики боя | 13 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `action-copy` · Заимствование Атак и Техник | 10 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `transformation` · Трансформации и заимствованные правила | 10 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `summon-turns` · Призывы и делегированные Ходы | 8 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `multi-space-actor` · Размер и несколько клеток персонажа | 6 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `deployment-hooks` · Развертывание | 5 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `duel-flow` · Дуэли и ставки | 4 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `bond-actions` · Связи и действия Связей | 4 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |

## Враги

`attack`, `full`, `effect` и `state` заявляют исполнимый контракт, но без evidence-записи не доказывают соответствие исходному правилу. `assisted` означает: Нарратор видит правило и фиксирует использование, но уникальные цели, сущности, перемещения или последствия ещё обязан разыграть вручную.

| Профиль | Правил | Заявлено исполнимым | Assisted | Непокрытые правила |
| --- | ---: | ---: | ---: | --- |
| Assassin (`lionwing.npc.assassin`) | 3 | 0 | 3 | Neutralize Target; Slice; Hidden Blades |
| Bruiser (`lionwing.npc.bruiser`) | 3 | 0 | 3 | Beatdown; Skulduggery; Decimate |
| Behemoth (`lionwing.npc.behemoth`) | 3 | 0 | 3 | Leap; Tore From Earth; Meteor |
| Captor (`lionwing.npc.captor`) | 3 | 0 | 3 | Watch And Wait; Catch And Release; Sticky Bomb |
| Executioner (`lionwing.npc.executioner`) | 3 | 0 | 3 | Focus; Cleave; Bifurcate |
| Javelin (`lionwing.npc.javelin`) | 3 | 0 | 3 | Call; Crushing Impact; Shockwave |
| Pugilist (`lionwing.npc.pugilist`) | 3 | 0 | 3 | Take Stance; Flurry Of Strikes; Martial Perfection |
| Ranger (`lionwing.npc.ranger`) | 3 | 0 | 3 | Nest; Take The Shot; Headshot |
| Ronin (`lionwing.npc.ronin`) | 3 | 0 | 3 | Sheath; Dissect; Thunderclap And Flash |
| Viper (`lionwing.npc.viper`) | 3 | 0 | 3 | Lick The Knife; Filet; Knife In The Dark |
| Witch (`lionwing.npc.witch`) | 3 | 0 | 3 | Drawing Runes; Expelling Force; EXPLOSION |
| Bodyguards (`lionwing.npc.bodyguards`) | 3 | 0 | 3 | Brace; Behind Me; Reinforcements |
| Broodmother (`lionwing.npc.broodmother`) | 3 | 0 | 3 | Call; Swarming Chase; Roar |
| Cocoon (`lionwing.npc.cocoon`) | 3 | 0 | 3 | Menace; Rampage; Quick Growth |
| Duelist (`lionwing.npc.duelist`) | 3 | 0 | 3 | Goad; Flèche; Disassemble |
| Glutton (`lionwing.npc.glutton`) | 3 | 0 | 3 | Call; Slobber; Regurgitate |
| Guardian (`lionwing.npc.guardian`) | 3 | 0 | 3 | Guardian Shield; Shove; Imposing Presence |
| Mount (`lionwing.npc.mount`) | 3 | 0 | 3 | Synergy; Thrash; CHARGE! |
| Oni (`lionwing.npc.oni`) | 3 | 0 | 3 | Stabilize; Polaris; Vibrant Terror |
| Paladin (`lionwing.npc.paladin`) | 3 | 0 | 3 | Gospel; Gift From God; Weal And Woe |
| Revenant (`lionwing.npc.revenant`) | 3 | 0 | 3 | Lurk; Tear From The Soul; Hollowed Eyes |
| Spright (`lionwing.npc.spright`) | 3 | 0 | 3 | Discombobulate; Incision; Thunderous Ascension |
| Bannerman (`lionwing.npc.bannerman`) | 3 | 0 | 3 | In Position; Swing; Plant The Flag |
| Builder (`lionwing.npc.builder`) | 3 | 0 | 3 | Landscape; Violent Construction; Army Of Stone |
| Coordinator (`lionwing.npc.coordinator`) | 3 | 0 | 3 | Neutralize Them; Fanaticize; Coordinated Charge |
| Doppelgänger (`lionwing.npc.doppelganger`) | 2 | 0 | 2 | Imitate; Diplopia |
| Healer (`lionwing.npc.healer`) | 3 | 0 | 3 | Heal; Exsanguinate; Savior |
| Illusionist (`lionwing.npc.illusionist`) | 3 | 0 | 3 | Spatial Rift; Distort Reality; Shattered Skies |
| Matriarch (`lionwing.npc.matriarch`) | 3 | 0 | 3 | Caress; Destroy The Interloper; Mother Of The Void |
| Martyr (`lionwing.npc.martyr`) | 3 | 0 | 3 | Gorge On My Flesh; Savor My Blood; Sacrifice |
| Baron (`lionwing.npc.baron`) | 3 | 0 | 3 | Prescript; Suppress; Absolute Sovereignty |
| Berserker (`lionwing.npc.berserker`) | 3 | 0 | 3 | Seethe; Thrash; Last Stand |
| Cannoneer (`lionwing.npc.cannoneer`) | 3 | 0 | 3 | Aim; Load; Fire |
| Cultist (`lionwing.npc.cultist`) | 3 | 0 | 3 | Ritual Drawings; Swipe; Grand Calling |
| Daredevil (`lionwing.npc.daredevil`) | 3 | 0 | 3 | Gloat; Dance; Adrenaline High |
| Enchanter (`lionwing.npc.enchanter`) | 3 | 0 | 3 | Charm; Heartbreaker; By My Command |
| Hound Master (`lionwing.npc.hound-master`) | 3 | 0 | 3 | Fire Seeker; Shove; Wild Hunt |
| Necromancer (`lionwing.npc.necromancer`) | 3 | 0 | 3 | Call The Dead; Terrifying Shot; The Danse Macabre |
| Privateer (`lionwing.npc.privateer`) | 3 | 0 | 3 | Escort; Spray And Pray; Gear Change |
| Rifter (`lionwing.npc.rifter`) | 3 | 0 | 3 | Wild Shifting; Emerge; Implode |
| Swarm (`lionwing.npc.swarm`) | 3 | 0 | 3 | Call; Tear; Reinforcements |

### Кластеры следующей автоматизации врагов

1. **Особые создаваемые сущности:** общий авторитетный `summon/deploy` контракт уже обслуживает обычную массовку, Ищеек Псаря и профильные призывы. Остались уникальные Трупы Некроманта и Каменная армия Строителя со своими lifecycle-правилами.
2. **Местность и пространственные решения:** Бехемот, Ведьма, Слизь, Строитель, Иллюзионист, Культист и Разломщик. Следующий слой — typed target для клетки/зоны/портала и атомарный preview размещения.
3. **Команды нескольким участникам:** Скакун, Координатор, Барон, Манипулятор и Мученик. Нужны очередь выборов, consent/controller и последовательная симуляция нескольких исполнителей.
4. **Копирование и смена набора правил:** Доппельгангер, Капер, часть Скакуна. Нужен безопасный `action-copy` с замороженным снимком правила и сроком действия.
5. **Уникальные trump-переходы:** Громила, Ловец, Гадюка, Дуэлянт, Они, Паладин, Знаменосец и Сорвиголова. Их следует брать после общих кластеров: они дают меньше повторного использования ядра.

## Рекомендуемый путь развития

### Этап 0 — аудит доверия

1. Зафиксировать digest канонического текста каждого проверяемого правила.
2. Начать с текущих `full/decision` высокого влияния: Внутренние миры, Охотник, Ассасин, Криомант, Вестник Бури, Покоритель Волн и Ритуалист. Их считать кандидатами `core-tested`, но не E2E-сертифицированными.
3. Для атак врагов проверять не 40 одинаковых happy path, а семейства механик и каждое уникальное исключение: цель, реакция, урон, сроки, KO, отмена и повтор.
4. Любое смысловое расхождение немедленно понижать в заявленном реестре; сертифицировать только после полного evidence-прохода.

### Этап 1 — надёжность релиза

- corpus старых сохранений и миграции по `schema`;
- browser E2E: пустая клетка, Внутренний мир, Тайфун, сетевой prompt и мобильные 320 px;
- property-тесты атомарности: конфликт версий, повтор event id, KO между prompt и ответом, заполненное поле возврата;
- диагностический экспорт одной цепочки для баг-репортов.

### Этап 2 — мультипликаторы автоматизации

1. `summon-turns` + `deployment-hooks`;
2. `action-copy` + `transformation` + `derived-stats`;
3. typed spatial targets для местности, порталов и сущностей;
4. очередь нескольких решений одного триггера;
5. `information-query`, Интермиссия и действия Связей.

### Этап 3 — вертикальные срезы

После каждого общего контракта выбирать 2–3 максимально разные Техники и 2 профиля врагов. Повышать статус только после UI, отмены, сети, сохранения и регрессионного теста. Так прогресс остаётся измеримым и не создаёт ложных `full`-меток.

## Definition of Done для одного правила

- буквальный текст сверен с `source/translation`;
- выборы типизированы и доступны с поля;
- недоступные цели объясняются до оплаты;
- перед ответом выполняется повторная валидация;
- отмена и прерывание не оставляют ресурсы или сущности;
- события атомарны, журналируемы и идемпотентны;
- сохранение/загрузка и сеть сохраняют цепочку;
- есть позитивный, негативный и хотя бы один граничный тест;
- создана evidence-запись с digest исходника, поверхностями и commit аудита;
- статус в карте повышен только после полного пользовательского пути.

## Поддержание карты

После изменения `technique-foundation-map.js`, каталога врагов, адаптеров или `automation-evidence.json` выполните `npm run readiness`. `npm test` проверяет, что карта не устарела и evidence-реестр структурно допустим.
