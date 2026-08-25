# Карта заявленной готовности и доказательств автоматизации

> Генерируется командой `npm run readiness`. Таблицы не редактируются вручную.
> **Важно:** статусы `full`, `decision`, `attack`, `effect` и `state` — заявления реализации, а не независимая сертификация корректности.
> Источник заявлений по Уровням Техник — `technique-foundation-map.js`; по врагам — контракт `enemyRuleAutomation`. Независимые доказательства хранятся только в `automation-evidence.json`.

## Сводка

| Контур | Всего | Заявлено исполнимым | Формально E2E-сертифицировано | Неполный путь |
| --- | ---: | ---: | ---: | --- |
| Уровни Техник | 321 | 83 (25.9%) | 0 | 24 частичных; 214 ручных |
| Правила обычных врагов | 122 | 61 (50.0%) | 0 | 61 assisted |
| Атаки врагов | 40 | 33 | 0 | не установлено независимым аудитом |

Формально сертифицировано сейчас: **0** записей. Это не означает, что остальные сломаны: до появления доказательной записи их корректность считается **неизвестной**, даже если адаптер существует и happy-path тест проходит. Проценты выше измеряют охват кодом, а не верность правилам игры.

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

Для повышения до `certified` в `automation-evidence.json` нужны: стабильный id правила, `sourceDigest`, заявленный статус, уровень доверия, проверяемые claims, точные тестовые файлы, применимые поверхности `core/ui/network/persistence`, граничные случаи и commit аудита. CI отклоняет неполную запись и пропавший тестовый файл. Изменение исходника должно менять digest и тем самым отзывать прежнюю сертификацию.

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
| Силач | 54 | 7 | 3 | 6 | 38 |
| Бродяга | 57 | 8 | 11 | 5 | 33 |
| Оплот | 51 | 3 | 3 | 3 | 42 |
| Альтруист | 51 | 3 | 9 | 2 | 37 |
| Подрывник | 54 | 5 | 8 | 5 | 36 |
| Разрушитель | 54 | 6 | 17 | 3 | 28 |

Полная построчная карта всех 321 Уровней находится в `TECHNIQUE-FOUNDATION-MAP.md`. Её статусы также заявленные: таблица удобна для планирования аудита, но не заменяет evidence-записи. Ниже перечислены самые дорогие известные пробелы.

### Ручные Уровни

| Техника | Ур. | Правило | Чего не хватает |
| --- | ---: | --- | --- |
| Берсерк (`powerhouse.berserker`) | 1 | Месть (Revenge) | `turn-lifecycle`, `derived-stats`, `combat-meter` |
| Берсерк (`powerhouse.berserker`) | 2 | Выдержать побои (Take A Beating) | `derived-stats` |
| Берсерк (`powerhouse.berserker`) | 3 | Загнанный пес (Cornered Dog) | тонкий адаптер уникального условия поверх уже готового ядра |
| Драконоборец (`powerhouse.dragonslayer`) | 2 | Широкая дуга (Wide Arc) | тонкий адаптер уникального условия поверх уже готового ядра |
| Дуэлянт (`powerhouse.duelist`) | 1 | Ответный выпад (Riposte) [Блок -> Стычка] | `movement-lifecycle` |
| Дуэлянт (`powerhouse.duelist`) | 3 | Отбивающий удар (Deflecting Blow) | тонкий адаптер уникального условия поверх уже готового ядра |
| Самобичеватель (`powerhouse.flagellant`) | 1 | Азарт (Thrill) | тонкий адаптер уникального условия поверх уже готового ядра |
| Самобичеватель (`powerhouse.flagellant`) | 2 | Кровавый рывок (Blood Rush) | `movement-lifecycle`, `turn-lifecycle` |
| Самобичеватель (`powerhouse.flagellant`) | 3 | Обескровлен (Bled Dry) | тонкий адаптер уникального условия поверх уже готового ядра |
| Борец (`powerhouse.struggler`) | 1 | Усилие (Effort) | `scene-lifecycle`, `derived-stats` |
| Борец (`powerhouse.struggler`) | 2 | Адреналин (Adrenaline) | `movement-lifecycle` |
| Борец (`powerhouse.struggler`) | 3 | Вопреки разуму (Defy Reason) | тонкий адаптер уникального условия поверх уже готового ядра |
| Магический мечник (`powerhouse.spellsword`) | 1 | Чародейский клинок (Spell Blade) | `action-copy` |
| Техник (`powerhouse.technician`) | 1 | Разминка (Stretch) | `turn-lifecycle`, `derived-stats` |
| Техник (`powerhouse.technician`) | 2 | Идеальная форма (Perfect Form) | `turn-lifecycle`, `derived-stats` |
| Несломленный (`powerhouse.unbroken`) | 1 | Встать снова (Get Back Up) | `scene-lifecycle`, `duel-flow` |
| Несломленный (`powerhouse.unbroken`) | 2 | Яростное возрождение (Furious Revival) | тонкий адаптер уникального условия поверх уже готового ядра |
| Несломленный (`powerhouse.unbroken`) | 3 | Феникс (Phoenix) | `duel-flow` |
| Картечник (`powerhouse.breacher`) | 2 | Из обоих стволов (Both Barrels) | тонкий адаптер уникального условия поверх уже готового ядра |
| Картечник (`powerhouse.breacher`) | 3 | Уничтожение (Annihilate) | тонкий адаптер уникального условия поверх уже готового ядра |
| Боец с парным оружием (`powerhouse.dual-wielder`) | 1 | Парный удар (Twinned Blow) | тонкий адаптер уникального условия поверх уже готового ядра |
| Боец с парным оружием (`powerhouse.dual-wielder`) | 2 | Неистовый обстрел (Frenzied Barrage) | тонкий адаптер уникального условия поверх уже готового ядра |
| Боец с парным оружием (`powerhouse.dual-wielder`) | 3 | Разные клинки (Varied Blades) | `movement-lifecycle`, `turn-lifecycle` |
| Мастер боевых искусств (`powerhouse.martial-artist`) | 1 | Искусство восьми молотов (Art Of The 8 Hammers) | `movement-lifecycle`, `turn-lifecycle` |
| Мастер боевых искусств (`powerhouse.martial-artist`) | 2 | Состояние потока (Flow-State) | `derived-stats` |
| Мастер боевых искусств (`powerhouse.martial-artist`) | 3 | Бесконечные удары (Unlimited Blows) | тонкий адаптер уникального условия поверх уже готового ядра |
| Мудрец монастыря (`powerhouse.monastic-sage`) | 1 | Разум воплощенный (Mind Made Manifest) | `turn-lifecycle`, `derived-stats` |
| Мудрец монастыря (`powerhouse.monastic-sage`) | 2 | Меж двух миров (Of Two Worlds) | `turn-lifecycle`, `inventory` |
| Мудрец монастыря (`powerhouse.monastic-sage`) | 3 | Возвышенная невозмутимость (Sublime Equanimity) | `turn-lifecycle` |
| Копейщик (`powerhouse.lancer`) | 1 | Пронзание (Pierce) | тонкий адаптер уникального условия поверх уже готового ядра |
| Копейщик (`powerhouse.lancer`) | 2 | Фаланга (Phalanx) | тонкий адаптер уникального условия поверх уже готового ядра |
| Копейщик (`powerhouse.lancer`) | 3 | Рука-пушка (Cannon-Arm) [Передышка -> Стычка] | тонкий адаптер уникального условия поверх уже готового ядра |
| Хищник (`powerhouse.predator`) | 1 | Тоска (Yearn) | `turn-lifecycle`, `information-query` |
| Хищник (`powerhouse.predator`) | 2 | Одержимость (Obsess) | `movement-lifecycle`, `derived-stats`, `information-query` |
| Хищник (`powerhouse.predator`) | 3 | Пожрать (Devour) | `scene-lifecycle` |
| Импровизатор (`powerhouse.improvisational-fighter`) | 2 | Ох! Вот это было больно! (Oh! That One Hurt!) | `turn-lifecycle` |
| Импровизатор (`powerhouse.improvisational-fighter`) | 3 | Последнее средство (Last Resort) | `scene-lifecycle`, `combat-meter` |
| Воинственный Вознесенный (`powerhouse.warring-ascendant`) | 2 | Эзотерические клинки (Esoteric Blades) | `transformation`, `action-copy` |
| Воздушный мастер (`vagabond.aerial-master`) | 2 | Парение (Soar) | `movement-lifecycle` |
| Воздушный мастер (`vagabond.aerial-master`) | 3 | Падающий удар топором (Falling Ax Strike) | `derived-stats` |
| Снайпер (`vagabond.sniper`) | 1 | Дальний выстрел (Long Shot) | тонкий адаптер уникального условия поверх уже готового ядра |
| Снайпер (`vagabond.sniper`) | 2 | Окопаться (Bunker Down) | `turn-lifecycle` |
| Снайпер (`vagabond.sniper`) | 3 | Меткий глаз (Deadeye) [Скрыться -> Завершение Талантом] | `movement-lifecycle` |
| Застрельщик (`vagabond.skirmisher`) | 1 | Укол (Sting) | `turn-lifecycle`, `derived-stats` |
| Застрельщик (`vagabond.skirmisher`) | 2 | Смещающиеся удары (Shifting Blows) | `movement-lifecycle` |
| Застрельщик (`vagabond.skirmisher`) | 3 | Отскок (Rebound) | `movement-lifecycle` |
| Демон скорости (`vagabond.speed-demon`) | 1 | Уход в тень (Fade) | `movement-lifecycle` |
| Демон скорости (`vagabond.speed-demon`) | 3 | Мгновенный удар (Flash Strike) | `movement-lifecycle`, `turn-lifecycle` |
| Неуловимый (`vagabond.untouchable`) | 3 | Инстинкт бойца (Fighter's Instinct) [Уворот -> Стычка] | `movement-lifecycle` |
| Акробат (`vagabond.acrobat`) | 1 | Летящий удар ногой (Flying Kick) [Прыжок -> Стычка] | `movement-lifecycle` |
| Акробат (`vagabond.acrobat`) | 2 | Отскок от стены (Wall Jump) | `movement-lifecycle`, `turn-lifecycle`, `derived-stats` |
| Акробат (`vagabond.acrobat`) | 3 | Невесомое тело (Weightless Body) | `movement-lifecycle` |
| Мастер клинка (`vagabond.blade-master`) | 1 | Стойка выхвата (Draw Stance) | тонкий адаптер уникального условия поверх уже готового ядра |
| Мастер клинка (`vagabond.blade-master`) | 2 | Рассечение одним движением (Divide In One Motion) [Передышка -> Прыжок] | `movement-lifecycle` |
| Мастер клинка (`vagabond.blade-master`) | 3 | Прыгающий карп (Leaping Koi) | `movement-lifecycle` |
| Хитроумный боец (`vagabond.cunning-fighter`) | 3 | С первого взгляда (At a Glance) | `turn-lifecycle`, `information-query` |
| Скованный (`vagabond.enchained`) | 2 | Притянуть (Draw In) | `movement-lifecycle` |
| Скованный (`vagabond.enchained`) | 3 | Импульс (Momentum) [Заклинание -> Стычка] | `movement-lifecycle` |
| Злобный подражатель (`vagabond.malicious-mimic`) | 1 | "Все, что можешь ты..." ("Anything You Can Do...") | `scene-lifecycle`, `inventory`, `action-copy` |
| Злобный подражатель (`vagabond.malicious-mimic`) | 2 | Отрепетированные движения (Rehearsed Movements) | `derived-stats`, `inventory` |
| Злобный подражатель (`vagabond.malicious-mimic`) | 3 | "...я могу лучше" ("...I Can Do Better") | `inventory`, `action-copy` |
| Оппортунист (`vagabond.opportunist`) | 1 | Стайная тактика (Pack Tactics) | `movement-lifecycle`, `turn-lifecycle` |
| Оппортунист (`vagabond.opportunist`) | 2 | Голодные глаза (Hungry Eyes) | тонкий адаптер уникального условия поверх уже готового ядра |
| Оппортунист (`vagabond.opportunist`) | 3 | Комбо-подброс (Launcher Combo) | `turn-lifecycle` |
| Отражатель (`vagabond.reflector`) | 1 | Поймать клинок (Catch The Blade) | `scene-lifecycle`, `derived-stats` |
| Отражатель (`vagabond.reflector`) | 2 | Смотреть и ждать (Watch And Wait) | тонкий адаптер уникального условия поверх уже готового ядра |
| Отражатель (`vagabond.reflector`) | 3 | Нести их ярость (To Carry Their Fury) | `movement-lifecycle`, `derived-stats` |
| Дим Мак (`vagabond.dim-mak`) | 3 | Казнь по четырем точкам (4-Point Execution) | `movement-lifecycle`, `turn-lifecycle` |
| Пьяница (`vagabond.drunkard`) | 1 | До дна (Down The Hatch) | `movement-lifecycle`, `turn-lifecycle`, `deployment-hooks` |
| Пьяница (`vagabond.drunkard`) | 2 | Танец дурака (Fool's Dance) | `turn-lifecycle`, `derived-stats` |
| Пьяница (`vagabond.drunkard`) | 3 | Залпом (Chug) | `movement-lifecycle`, `turn-lifecycle` |
| Сокрушитель (`bulwark.crusher`) | 1 | 30 000 тонн (30,000 Tons) | тонкий адаптер уникального условия поверх уже готового ядра |
| Сокрушитель (`bulwark.crusher`) | 2 | Молотопад (Hammerfall) | `turn-lifecycle` |
| Сокрушитель (`bulwark.crusher`) | 3 | Ты похож на гвоздь (You Look Like A Nail) | `turn-lifecycle` |
| Гигантская фигура (`bulwark.giant-frame`) | 2 | Исполин (Immense) | `movement-lifecycle`, `deployment-hooks`, `derived-stats`, `multi-space-actor` |
| Гигантская фигура (`bulwark.giant-frame`) | 3 | Ударная волна (Shockwave) | тонкий адаптер уникального условия поверх уже готового ядра |
| Железное тело (`bulwark.iron-bodied`) | 1 | Крепкий как камень (Tough As Stone) | `movement-lifecycle`, `derived-stats` |
| Железное тело (`bulwark.iron-bodied`) | 3 | Нержавеющий шаг (Stainless Stride) | `turn-lifecycle`, `derived-stats` |
| Щит авангарда (`bulwark.vanguard-defender`) | 1 | Белый рыцарь (White Knight) | `movement-lifecycle` |
| Щит авангарда (`bulwark.vanguard-defender`) | 2 | Стальной ангел (Steel Angel) | `turn-lifecycle`, `derived-stats` |
| Щит авангарда (`bulwark.vanguard-defender`) | 3 | Вдохновить мужество (Inspire Courage) | `movement-lifecycle` |
| Полный ублюдок (`bulwark.absolute-bastard`) | 1 | Легко ненавидеть (Easy To Hate) | `scene-lifecycle`, `information-query` |
| Полный ублюдок (`bulwark.absolute-bastard`) | 2 | Задира (Bully) | `movement-lifecycle`, `turn-lifecycle`, `derived-stats` |
| Полный ублюдок (`bulwark.absolute-bastard`) | 3 | Добавить травму к оскорблению (Add Injury To Insult) | тонкий адаптер уникального условия поверх уже готового ядра |
| Боевой наездник (`bulwark.battle-jockey`) | 1 | Верный скакун (Trusty Steed) | `movement-lifecycle`, `summon-turns`, `deployment-hooks` |
| Боевой наездник (`bulwark.battle-jockey`) | 2 | Хваткие челюсти (Grasping Jaws) | `summon-turns` |
| Боевой наездник (`bulwark.battle-jockey`) | 3 | Ревущий выход (Roaring Entry) | `movement-lifecycle`, `summon-turns`, `scene-lifecycle`, `turn-lifecycle` |
| Борец-захватчик (`bulwark.grappler`) | 1 | Удержание (Restrain) | тонкий адаптер уникального условия поверх уже готового ядра |
| Борец-захватчик (`bulwark.grappler`) | 3 | Завершающий прием (Finishing Move) [Завершение Телом -> Прыжок] | `movement-lifecycle`, `turn-lifecycle` |
| Джаггернаут (`bulwark.juggernaut`) | 1 | Дикий рывок (Wild Charge) | `movement-lifecycle`, `derived-stats` |
| Джаггернаут (`bulwark.juggernaut`) | 2 | Насилие (Violence) | `movement-lifecycle`, `turn-lifecycle` |
| Джаггернаут (`bulwark.juggernaut`) | 3 | Резкий поворот (Hard Turn) | `movement-lifecycle` |
| Восходящий претендент (`bulwark.rising-challenger`) | 1 | Идеальное отражение (Perfect Deflection) | `movement-lifecycle` |
| Восходящий претендент (`bulwark.rising-challenger`) | 2 | "Сначала тебе придется пройти через меня!" ("You'll Have To Get Through Me!") | `movement-lifecycle` |
| Рунное возмездие (`bulwark.runic-retribution`) | 1 | Удар плетью (Lash) | тонкий адаптер уникального условия поверх уже готового ядра |
| Рунное возмездие (`bulwark.runic-retribution`) | 2 | Любящий обряд (Loving Rite) | `information-query` |
| Рунное возмездие (`bulwark.runic-retribution`) | 3 | Преданность (Devotion) | `movement-lifecycle` |
| Щитоносец (`bulwark.shield-bearer`) | 1 | Стена (Wall) | `turn-lifecycle`, `derived-stats` |
| Щитоносец (`bulwark.shield-bearer`) | 2 | Удар щитом (Shield Charge) | `movement-lifecycle` |
| Щитоносец (`bulwark.shield-bearer`) | 3 | Сосредоточенная защита (Focused Defense) | `derived-stats` |
| Стойкий часовой (`bulwark.stalwart-sentry`) | 1 | Страж (Guardian) | `movement-lifecycle`, `turn-lifecycle` |
| Стойкий часовой (`bulwark.stalwart-sentry`) | 3 | Зона контроля (Zone Of Influence) | `movement-lifecycle`, `information-query` |
| Звериный Вознесенный (`bulwark.beastial-ascendant`) | 1 | Звериность (Beastly) | `movement-lifecycle`, `scene-lifecycle`, `transformation`, `combat-meter`, `action-copy` |
| Звериный Вознесенный (`bulwark.beastial-ascendant`) | 2 | Наследие (Inheritance) | `transformation`, `action-copy` |
| Звериный Вознесенный (`bulwark.beastial-ascendant`) | 3 | Вершина (Apex) | `scene-lifecycle`, `transformation`, `action-copy` |
| Ангел-хранитель (`bulwark.guardian-angel`) | 1 | Два тела (Two Bodies) | `movement-lifecycle`, `multi-space-actor` |
| Ангел-хранитель (`bulwark.guardian-angel`) | 2 | Вместе в жизни (Together In Life) | тонкий адаптер уникального условия поверх уже готового ядра |
| Ангел-хранитель (`bulwark.guardian-angel`) | 3 | Вместе в смерти (Together In Death) | `movement-lifecycle`, `derived-stats`, `multi-space-actor` |
| Зов слуги (`bulwark.servant-s-call`) | 2 | Гимн героя (Hero's Hymn) | `movement-lifecycle`, `summon-turns`, `turn-lifecycle` |
| Зов слуги (`bulwark.servant-s-call`) | 3 | Верховный слуга (Supreme Servant) | `summon-turns`, `scene-lifecycle`, `bond-actions` |
| Пилот меха (`bulwark.mecha-pilot`) | 1 | Двигатель рунного ядра (Rune Core Engine) | `movement-lifecycle`, `derived-stats`, `multi-space-actor` |
| Пилот меха (`bulwark.mecha-pilot`) | 2 | Автономный (Autonomous) | `summon-turns`, `derived-stats`, `multi-space-actor` |
| Пилот меха (`bulwark.mecha-pilot`) | 3 | Идеальная синхронизация (Perfect Sync) | `summon-turns`, `derived-stats`, `multi-space-actor` |
| Боевой инструктор (`altruist.battle-instructor`) | 1 | Приказ к удару (Strike Order) | `movement-lifecycle`, `information-query` |
| Боевой инструктор (`altruist.battle-instructor`) | 2 | Обучающий момент (Teaching Moment) | `bond-actions` |
| Боевой инструктор (`altruist.battle-instructor`) | 3 | Вспомни обучение (Remember Your Training) | `bond-actions`, `scene-lifecycle` |
| Гурман (`altruist.gourmand`) | 1 | Здоровая трапеза (Healthy Meal) | `inventory`, `intermission-reset` |
| Гурман (`altruist.gourmand`) | 3 | Общий опыт (Shared Experiences) | `bond-actions`, `inventory` |
| Предвидящий (`altruist.precognizant`) | 1 | Вспышка озарения (Flash Of Insight) | `scene-lifecycle` |
| Предвидящий (`altruist.precognizant`) | 2 | Воспользоваться (Take Advantage) | `derived-stats` |
| Предвидящий (`altruist.precognizant`) | 3 | Швырнуть в бесконечность (Hurl Into The Infinite) | тонкий адаптер уникального условия поверх уже готового ядра |
| Хирург (`altruist.surgeon`) | 2 | Операционная процедура (Operational Procedure) | `inventory`, `intermission-reset` |
| Хирург (`altruist.surgeon`) | 3 | Чудотворец (Miracle Worker) | `inventory` |
| Заклинатель талисманов (`altruist.talisman-caster`) | 1 | Священная печать (Sacred Seal) | тонкий адаптер уникального условия поверх уже готового ядра |
| Заклинатель талисманов (`altruist.talisman-caster`) | 2 | Брошенный талисман (Tossed Talisman) | тонкий адаптер уникального условия поверх уже готового ядра |
| Заклинатель талисманов (`altruist.talisman-caster`) | 3 | Экзорцизм (Exorcize) | тонкий адаптер уникального условия поверх уже готового ядра |
| Алхимик (`altruist.alchemist`) | 3 | Высокоинтенсивная смесь (High Intensity Mix) | `inventory` |
| Хрономант (`altruist.chronomancer`) | 1 | Ускорение (Accelerate) | `movement-lifecycle` |
| Хрономант (`altruist.chronomancer`) | 2 | Замедление (Decelerate) | тонкий адаптер уникального условия поверх уже готового ядра |
| Танцор (`altruist.dancer`) | 1 | Партнер по танцу (Dance Partner) | `movement-lifecycle`, `turn-lifecycle` |
| Танцор (`altruist.dancer`) | 2 | Сердца в унисон (Hearts In Tandem) | тонкий адаптер уникального условия поверх уже готового ядра |
| Танцор (`altruist.dancer`) | 3 | Престиж (The Prestige) | тонкий адаптер уникального условия поверх уже готового ядра |
| Ходящий в тумане (`altruist.fog-walker`) | 1 | Пустить дым (Blowing Smoke) | `movement-lifecycle`, `turn-lifecycle` |
| Ходящий в тумане (`altruist.fog-walker`) | 2 | Мистическая дымка (Mystic Mist) | `movement-lifecycle`, `derived-stats` |
| Ходящий в тумане (`altruist.fog-walker`) | 3 | Жалящий пар (Stinging Steam) | `movement-lifecycle` |
| Последняя надежда (`altruist.last-hope`) | 1 | Примечательно отсутствует (Notably Absent) | тонкий адаптер уникального условия поверх уже готового ядра |
| Последняя надежда (`altruist.last-hope`) | 2 | Героическое возвращение (Heroic Return) | `movement-lifecycle`, `turn-lifecycle`, `combat-meter` |
| Последняя надежда (`altruist.last-hope`) | 3 | Взрывное возвращение (Explosive Return) | `turn-lifecycle` |
| Репликатор (`altruist.replicator`) | 1 | Форма эха (Echo Form) | тонкий адаптер уникального условия поверх уже готового ядра |
| Репликатор (`altruist.replicator`) | 2 | Симметрия (Symmetry) | `movement-lifecycle` |
| Репликатор (`altruist.replicator`) | 3 | Полная синхронизация (Full Sync) | `turn-lifecycle`, `derived-stats` |
| Художник (`altruist.artist`) | 1 | Взмах кисти (Stroke Of The Brush) | `movement-lifecycle`, `turn-lifecycle` |
| Художник (`altruist.artist`) | 2 | Холст из плоти (Canvas Of Flesh) | тонкий адаптер уникального условия поверх уже готового ядра |
| Художник (`altruist.artist`) | 3 | Клеймо кисти (Brush-Brand) | `turn-lifecycle` |
| Ученый бард (`altruist.bardic-savant`) | 1 | Музыкант (Musician) | `movement-lifecycle`, `inventory` |
| Ученый бард (`altruist.bardic-savant`) | 2 | Быстрая композиция (Quick Composition) | `inventory`, `turn-lifecycle` |
| Ученый бард (`altruist.bardic-savant`) | 3 | На бис (Encore) | `inventory` |
| Сборщик колоды (`altruist.deckbuilder`) | 1 | Добор (Draw) | `movement-lifecycle`, `inventory`, `scene-lifecycle` |
| Сборщик колоды (`altruist.deckbuilder`) | 2 | Карточная ловушка (Card Trap) | `inventory` |
| Сборщик колоды (`altruist.deckbuilder`) | 3 | Жадность (Greed) | `inventory` |
| Кровопускатель (`disruptor.bloodletter`) | 1 | Кровоточащее лезвие (Bleeding Edge) | тонкий адаптер уникального условия поверх уже готового ядра |
| Кровопускатель (`disruptor.bloodletter`) | 2 | Ищейка (Bloodhound) | `movement-lifecycle` |
| Кровопускатель (`disruptor.bloodletter`) | 3 | Разрыв (Rupture) [Стычка -> Передышка] | тонкий адаптер уникального условия поверх уже готового ядра |
| Душитель (`disruptor.constrictor`) | 3 | Скручивающий удар (Twisting Impact) | `movement-lifecycle` |
| Карманник (`disruptor.cutpurse`) | 1 | Ловкие руки (Fast Hands) | `movement-lifecycle`, `turn-lifecycle` |
| Карманник (`disruptor.cutpurse`) | 2 | Урвать (Snatch) | тонкий адаптер уникального условия поверх уже готового ядра |
| Карманник (`disruptor.cutpurse`) | 3 | Вор в ночи (Thief In The Night) | `movement-lifecycle`, `turn-lifecycle` |
| Морок (`disruptor.mind-breaker`) | 1 | "Где вы?" ("Where Are You?") | тонкий адаптер уникального условия поверх уже готового ядра |
| Морок (`disruptor.mind-breaker`) | 2 | "Что вы делаете?" ("What Do You Do?") | тонкий адаптер уникального условия поверх уже готового ядра |
| Морок (`disruptor.mind-breaker`) | 3 | "Кто они?" ("Who Are They?") | `movement-lifecycle`, `turn-lifecycle` |
| Жнец (`disruptor.reaper`) | 1 | Посев (Sow) | `movement-lifecycle`, `turn-lifecycle` |
| Жнец (`disruptor.reaper`) | 2 | Уход (Tend) | `turn-lifecycle` |
| Жнец (`disruptor.reaper`) | 3 | Жатва (Reap) | `movement-lifecycle`, `turn-lifecycle` |
| Мастер тактики (`disruptor.tactical-master`) | 1 | Остановиться и подумать (Stop And Think) | `turn-lifecycle` |
| Мастер тактики (`disruptor.tactical-master`) | 2 | Анализ (Study) | тонкий адаптер уникального условия поверх уже готового ядра |
| Мастер тактики (`disruptor.tactical-master`) | 3 | Эврика! (Eureka!) | `turn-lifecycle`, `derived-stats` |
| Говорящий с землей (`disruptor.earth-speaker`) | 1 | Тектонический сдвиг (Tectonic Shift) | `movement-lifecycle` |
| Говорящий с землей (`disruptor.earth-speaker`) | 2 | Земляные осколки (Earthen Shards) | `movement-lifecycle`, `turn-lifecycle` |
| Говорящий с землей (`disruptor.earth-speaker`) | 3 | Каменные солдаты (Stone Soldiers) | `movement-lifecycle` |
| Нечеловеческая сила (`disruptor.inhuman-strength`) | 1 | Сильная рука (Strong-Arm) | `movement-lifecycle` |
| Нечеловеческая сила (`disruptor.inhuman-strength`) | 2 | Поршневой кулак (Piston Fist) | `movement-lifecycle`, `derived-stats` |
| Нечеловеческая сила (`disruptor.inhuman-strength`) | 3 | Проломить насквозь (Smash Through) | `movement-lifecycle` |
| Уличный боец (`disruptor.street-fighter`) | 1 | Кровавые кастеты (Bloody Brass) | тонкий адаптер уникального условия поверх уже готового ядра |
| Уличный боец (`disruptor.street-fighter`) | 2 | Ломать и калечить (Break And Bruise) | тонкий адаптер уникального условия поверх уже готового ядра |
| Уличный боец (`disruptor.street-fighter`) | 3 | Зверствовать (Brutalize) | тонкий адаптер уникального условия поверх уже готового ядра |
| Тело-рой (`disruptor.swarm-body`) | 1 | Порхающая форма (Fluttering Form) | `movement-lifecycle`, `turn-lifecycle` |
| Тело-рой (`disruptor.swarm-body`) | 2 | Исчезнуть в мухах (Vanish Into Flies) | `movement-lifecycle` |
| Тело-рой (`disruptor.swarm-body`) | 3 | Пожрать (Devour) | тонкий адаптер уникального условия поверх уже готового ядра |
| Сирена (`disruptor.siren`) | 3 | Помогите-ка сюда (A little help over here?) | `movement-lifecycle` |
| Всадник волн (`disruptor.wave-rider`) | 2 | Мощные волны (Momentous Waves) | `movement-lifecycle`, `turn-lifecycle` |
| Всадник волн (`disruptor.wave-rider`) | 3 | Водяная клетка (Aqua Cage) | `scene-lifecycle` |
| Шагающий по буре (`disruptor.gale-strider`) | 2 | Восходящий поток (Updraft) | `movement-lifecycle`, `turn-lifecycle` |
| Шагающий по буре (`disruptor.gale-strider`) | 3 | Рассекатель гор (Mountain Carver) | `movement-lifecycle` |
| Магическая схема (`disruptor.mage-s-array`) | 1 | Начертание (Inscribe) | тонкий адаптер уникального условия поверх уже готового ядра |
| Магическая схема (`disruptor.mage-s-array`) | 2 | Корректировка (Readjust) | `movement-lifecycle` |
| Магическая схема (`disruptor.mage-s-array`) | 3 | Тюрьма собственного замысла (Prison Of Your Own Design) | тонкий адаптер уникального условия поверх уже готового ядра |
| Револьверное колдовство (`ruiner.rapid-fire-sorcery`) | 1 | Размножение (Proliferate) | тонкий адаптер уникального условия поверх уже готового ядра |
| Револьверное колдовство (`ruiner.rapid-fire-sorcery`) | 3 | Бесконечный огонь (Endless Fire) [Зарядка -> Заклинание] | `combat-meter` |
| Ритуалист (`ruiner.ritualist`) | 2 | Магическая артиллерия (Arcane Artillery) | `turn-lifecycle`, `combat-meter` |
| Ритуалист (`ruiner.ritualist`) | 3 | Фрактальные начертания (Fractal Etchings) | `scene-lifecycle` |
| Ученик звезд (`ruiner.student-of-stars`) | 1 | Высвобожденная мощь (Power Unleashed) [Зарядка -> Завершение] | `combat-meter` |
| Ученик звезд (`ruiner.student-of-stars`) | 3 | Момент истины (Moment Of Truth) | `duel-flow` |
| Криомант (`ruiner.cryomancer`) | 3 | Раскол (Shatter) | `information-query` |
| Драматург (`ruiner.dramaturge`) | 1 | Все смотрят на меня (All Eyes On Me) | `combat-meter` |
| Драматург (`ruiner.dramaturge`) | 2 | Украсть их огонь (Snatch Their Fire) | `turn-lifecycle`, `combat-meter` |
| Драматург (`ruiner.dramaturge`) | 3 | Сила подачи (Power In Presentation) | `combat-meter` |
| Дикая магия (`ruiner.feral-arcana`) | 1 | Ворпальный коготь (Vorpal Claw) | тонкий адаптер уникального условия поверх уже готового ядра |
| Пламенное сердце (`ruiner.flame-heart`) | 1 | Разогрев (Rev Up) | тонкий адаптер уникального условия поверх уже готового ядра |
| Пламенное сердце (`ruiner.flame-heart`) | 2 | Проклятый удар (Damning Impact) | `combat-meter` |
| Пламенное сердце (`ruiner.flame-heart`) | 3 | Прах к праху (Ashes To Ashes) | тонкий адаптер уникального условия поверх уже готового ядра |
| Мрачный Вознесенный (`ruiner.grim-ascendant`) | 3 | Умбра (Umbra) | `transformation` |
| Сильное натяжение (`ruiner.long-draw`) | 1 | Наложить стрелу (Nock The Arrow) | `inventory` |
| Сильное натяжение (`ruiner.long-draw`) | 2 | Перьевой шаг (Feather Step) | `movement-lifecycle`, `inventory` |
| Сильное натяжение (`ruiner.long-draw`) | 3 | Пронзитель владык (Lord Piercer) [Подготовка x 3] | `inventory`, `scene-lifecycle` |
| Клинки маны (`ruiner.mana-blades`) | 1 | К оружию (Call Arms) | `action-copy` |
| Клинки маны (`ruiner.mana-blades`) | 2 | Орудия павших (Tools Of The Fallen) | `movement-lifecycle` |
| Клинки маны (`ruiner.mana-blades`) | 3 | Святой меч, Экскалибур (Saintly Sword, Excalibur) | `transformation`, `action-copy` |
| Душа пустоты (`ruiner.void-soul`) | 1 | Возвращение в ничто (Return To Nothing) | `movement-lifecycle`, `turn-lifecycle` |
| Душа пустоты (`ruiner.void-soul`) | 2 | Раствориться (Fade Away) | `movement-lifecycle`, `turn-lifecycle` |
| Эго-оружие (`ruiner.ego-arm`) | 1 | Я - твой меч (I Am Your Sword) | `movement-lifecycle`, `deployment-hooks`, `transformation` |
| Эго-оружие (`ruiner.ego-arm`) | 2 | Покажи свои цели (Show Your Targets) | `turn-lifecycle`, `derived-stats` |
| Эго-оружие (`ruiner.ego-arm`) | 3 | И я стану незаменимым (And I'll Become Irreplaceable) | `derived-stats` |
| Зов наемника (`ruiner.sellsword-s-call`) | 2 | Боевой гимн (Battle Hymn) | `movement-lifecycle`, `summon-turns` |
| Зов наемника (`ruiner.sellsword-s-call`) | 3 | Верховный наемник (Supreme Sellsword) | `summon-turns`, `scene-lifecycle`, `bond-actions`, `deployment-hooks` |

### Общие блокеры частичных и ручных Техник

| Возможность | Затронуто Уровней | Почему это выгодная следующая инвестиция |
| --- | ---: | --- |
| `movement-lifecycle` · Жизненный цикл движения | 91 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `turn-lifecycle` · Жизненный цикл Хода и Раунда | 62 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `derived-stats` · Производные характеристики персонажа | 36 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `scene-lifecycle` · Начало, конец и сброс Сцены | 24 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `inventory` · Инвентарь и заряды | 19 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `combat-meter` · Напряжение и общие счетчики боя | 12 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `summon-turns` · Призывы и делегированные Ходы | 11 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `action-copy` · Заимствование Атак и Техник | 10 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `information-query` · Изучение и раскрытие информации | 9 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `transformation` · Трансформации и заимствованные правила | 9 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `multi-space-actor` · Размер и несколько клеток персонажа | 6 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `deployment-hooks` · Развертывание | 5 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `bond-actions` · Связи и действия Связей | 5 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `duel-flow` · Дуэли и ставки | 4 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |
| `intermission-reset` · Сброс на Интермиссии | 2 | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |

## Враги

`attack`, `full`, `effect` и `state` заявляют исполнимый контракт, но без evidence-записи не доказывают соответствие исходному правилу. `assisted` означает: Нарратор видит правило и фиксирует использование, но уникальные цели, сущности, перемещения или последствия ещё обязан разыграть вручную.

| Профиль | Правил | Заявлено исполнимым | Assisted | Непокрытые правила |
| --- | ---: | ---: | ---: | --- |
| Ассасин (`enemy.common.assassin`) | 3 | 3 | 0 | — |
| Громила (`enemy.common.bruiser`) | 3 | 0 | 3 | Избиение; Грязный прием; Разгром |
| Бехемот (`enemy.common.behemoth`) | 3 | 1 | 2 | Скачок; Метеор |
| Ловец (`enemy.common.captor`) | 3 | 1 | 2 | Наблюдать и ждать; Липкая бомба |
| Палач (`enemy.common.executioner`) | 3 | 3 | 0 | — |
| Джавелин (`enemy.common.javelin`) | 3 | 1 | 2 | Призыв; Ударная волна |
| Кулачный боец (`enemy.common.pugilist`) | 3 | 3 | 0 | — |
| Рейнджер (`enemy.common.ranger`) | 3 | 3 | 0 | — |
| Ронин (`enemy.common.ronin`) | 3 | 2 | 1 | В ножны |
| Гадюка (`enemy.common.viper`) | 3 | 2 | 1 | Нож во тьме |
| Ведьма (`enemy.common.witch`) | 3 | 1 | 2 | Начертать руны; ВЗРЫВ |
| Телохранители (`enemy.common.bodyguards`) | 3 | 0 | 3 | Укрепиться; За мной; Подкрепления |
| Матка (`enemy.common.broodmother`) | 3 | 2 | 1 | Призыв |
| Кокон (`enemy.common.cocoon`) | 3 | 3 | 0 | — |
| Дуэлянт (`enemy.common.duelist`) | 3 | 2 | 1 | Разборка |
| Обжора (`enemy.common.glutton`) | 3 | 1 | 2 | Призыв; Отрыгнуть |
| Страж (`enemy.common.guardian`) | 3 | 3 | 0 | — |
| Скакун (`enemy.common.mount`) | 3 | 1 | 2 | Синергия; "В АТАКУ!" |
| Они (`enemy.common.oni`) | 3 | 1 | 2 | Полярис; Яркий ужас |
| Паладин (`enemy.common.paladin`) | 3 | 1 | 2 | Дар от Бога; Благо и горе |
| Ревенант (`enemy.common.revenant`) | 3 | 3 | 0 | — |
| Слизь (`enemy.common.slime`) | 3 | 1 | 2 | Ил; Поглотить |
| Знаменосец (`enemy.common.bannerman`) | 3 | 2 | 1 | Водрузить знамя |
| Строитель (`enemy.common.builder`) | 3 | 0 | 3 | Ландшафт; Буйное строительство; Каменная армия |
| Координатор (`enemy.common.coordinator`) | 3 | 1 | 2 | Фанатизировать; Скоординированный рывок |
| Доппельгангер (`enemy.common.doppelg-nger`) | 2 | 0 | 2 | Имитировать; Диплопия |
| Целитель (`enemy.common.healer`) | 3 | 3 | 0 | — |
| Иллюзионист (`enemy.common.illusionist`) | 3 | 1 | 2 | Пространственный разлом; Разбитые небеса |
| Тень (`enemy.common.shade`) | 3 | 1 | 2 | Ласка; Мать пустоты |
| Мученик (`enemy.common.martyr`) | 3 | 1 | 2 | Насыться моей плотью; Жертва |
| Барон (`enemy.common.baron`) | 3 | 1 | 2 | Предписание; Абсолютный суверенитет |
| Берсерк (`enemy.common.berserker`) | 3 | 3 | 0 | — |
| Канонир (`enemy.common.cannoneer`) | 3 | 2 | 1 | Огонь |
| Культист (`enemy.common.cultist`) | 3 | 1 | 2 | Ритуальные чертежи; Великий зов |
| Сорвиголова (`enemy.common.daredevil`) | 3 | 1 | 2 | Хвастовство; Адреналиновый кайф |
| Манипулятор (`enemy.common.enchanter`) | 3 | 1 | 2 | Очарование; По моему приказу |
| Псарь (`enemy.common.hound-master`) | 3 | 1 | 2 | Запустить ищейку; Дикая охота |
| Некромант (`enemy.common.necromancer`) | 3 | 1 | 2 | Восстаньте снова; Пляска смерти |
| Капер (`enemy.common.privateer`) | 3 | 2 | 1 | Смена снаряжения |
| Разломщик (`enemy.common.rifter`) | 3 | 1 | 2 | Дикое смещение; Имплозия |
| Рой (`enemy.common.swarm`) | 3 | 0 | 3 | Призыв; Рвать; Подкрепления |

### Кластеры следующей автоматизации врагов

1. **Призыв и подкрепления:** Джавелин, Телохранители, Матка, Обжора, Строитель, Псарь, Некромант и Рой. Сначала нужен общий `summon/deploy` контракт; иначе восемь профилей получат восемь несовместимых реализаций.
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
