# Карта переноса и будущей автоматизации LionWing

> Генерируется командой `npm run lionwing:map`. Карта 0.9 не является доказательством совместимости.
> Любой Уровень LionWing остается `manual-review-required`, пока для нового текста нет отдельного адаптера и evidence.

## Сводка стратегий

| Стратегия | Количество | Назначение |
| --- | ---: | --- |
| `parameterize-old-core` | 4 | Существующий общий контракт подходит после явного выбора редакции и новых параметров. |
| `extend-shared-core` | 5 | Нужен новый общий контракт, который не меняет поведение 0.9. |
| `new-lionwing-foundation` | 7 | Простой патч старой автоматики недостаточен; нужен отдельный типизированный фундамент LionWing. |
| `narrator-ruling` | 1 | Механика по природе требует решения Нарратора и не должна автоматически угадываться по тексту. |
| `source-review` | 1 | Автоматизацию нельзя начинать до разрешения противоречия или редакторского вопроса в каноне. |

## Нельзя закрыть простым патчем автоматики 0.9

| Возможность | Состояние | Что требуется |
| --- | --- | --- |
| Помощь через управление согласным союзником (`lionwing.foundation.assisting-proxy`) | `planned` | согласие контроллера; временный proxy-controller; замена всех показателей самым высоким Атрибутом; лимит трех бесплатных Прорывов |
| Дополнительные кости для отдельных целей общего броска (`lionwing.foundation.per-target-roll-branches`) | `planned` | общая база броска; ветви костей по цели; раздельные Успехи; единое журналируемое событие |
| Совместное занятие клетки в кинематографичном бою (`lionwing.foundation.cinematic-occupancy`) | `planned` | несколько персонажей в клетке; проход сквозь противников; выбор одной или всех целей по форме атаки |
| Параллельная Сцена Дуэли (`lionwing.foundation.detached-duel-scenes`) | `planned` | дочерняя Сцена; синхронное продолжение основной Сцены; ставка; возврат участников; перенос текущего Напряжения |
| Сопротивление Выведению и Уязвимость (`lionwing.foundation.resisting-vulnerable`) | `data-ready` | состояние Уязвимости до конца Сцены; запрет повторного Сопротивления; запрет Влияния; одноразовые необратимые последствия |
| Согласие на необратимые и межперсонажные последствия (`lionwing.foundation.consent-checkpoints`) | `planned` | явное подтверждение игрока; аудит необратимого изменения героя; одноразовость последствия; согласие второго игрока для Trip Up |
| Отдельная карта автоматизации 333 Уровней LionWing (`lionwing.techniques.separate-review-map`) | `map-ready` | ручная классификация нового текста; тонкие адаптеры поверх общего ядра; evidence для каждого повышенного статуса; никаких статусов из карты 0.9 по умолчанию |

## Полная карта системных возможностей

| ID | Возможность | Стратегия | Состояние | Страницы |
| --- | --- | --- | --- | --- |
| `lionwing.rules.bilingual-source` | Двуязычный источник Правил и Справочника | расширить общее ядро | `data-ready` | 34–65 |
| `lionwing.core.effects` | Жизненный цикл Эффектов | параметризовать общее ядро | `data-ready` | 61 |
| `lionwing.core.actions` | Базовые Действия и защитные Реакции | параметризовать общее ядро | `data-ready` | 62–65 |
| `lionwing.core.turn-scheduling` | Чередование Ходов и выбор следующего игрока | расширить общее ядро | `data-ready` | 56 |
| `lionwing.foundation.assisting-proxy` | Помощь через управление согласным союзником | новый фундамент LionWing | `planned` | 56 |
| `lionwing.foundation.per-target-roll-branches` | Дополнительные кости для отдельных целей общего броска | новый фундамент LionWing | `planned` | 59 |
| `lionwing.foundation.cinematic-occupancy` | Совместное занятие клетки в кинематографичном бою | новый фундамент LionWing | `planned` | 60 |
| `lionwing.foundation.detached-duel-scenes` | Параллельная Сцена Дуэли | новый фундамент LionWing | `planned` | 39–63 |
| `lionwing.foundation.resisting-vulnerable` | Сопротивление Выведению и Уязвимость | новый фундамент LionWing | `data-ready` | 38 |
| `lionwing.core.quick-roll` | Быстрый бросок | параметризовать общее ядро | `data-ready` | 36 |
| `lionwing.narrator.threats-and-risks` | Угрозы и альтернативные Риски | ручное решение Нарратора | `manual-by-design` | 42–43 |
| `lionwing.review.duel-wounds` | Число Ран при проигрыше боевой Дуэли | сначала сверить канон | `blocked-review` | 39–63 |
| `lionwing.builder.fixed-skills` | Канонический список Навыков и произвольные Навыки | расширить общее ядро | `data-ready` | 44 |
| `lionwing.core.unstructured-thresholds` | Пороги Проверок по Ступеням | параметризовать общее ядро | `data-ready` | 41 |
| `lionwing.foundation.consent-checkpoints` | Согласие на необратимые и межперсонажные последствия | новый фундамент LionWing | `planned` | 38–42 |
| `lionwing.builder.progression-awakening` | Опыт, повышение Ступени и отложенное Пробуждение | расширить общее ядро | `data-ready` | 32 |
| `lionwing.narrator.manual-ledger` | Ручное применение изменений Нарратором | расширить общее ядро | `planned-outside-current-scope` | 34–65 |
| `lionwing.techniques.separate-review-map` | Отдельная карта автоматизации 333 Уровней LionWing | новый фундамент LionWing | `map-ready` | 69–103 |

## Карта 333 Уровней Техник LionWing

| Архетип | Техника | Ур. | Правило | Изменение | Статус | Digest |
| --- | --- | ---: | --- | --- | --- | --- |
| Powerhouse | Berserker (`powerhouse.berserker`) | 1 | Revenge | `retranslate` | `manual-review-required` | `81511933e1464ba1` |
| Powerhouse | Berserker (`powerhouse.berserker`) | 2 | Cornered Dog | `retranslate` | `manual-review-required` | `345a28b15b6743d3` |
| Powerhouse | Berserker (`powerhouse.berserker`) | 3 | Take A Beating | `retranslate` | `manual-review-required` | `ad7cc7635e7c3f68` |
| Powerhouse | Dragonslayer (`powerhouse.dragonslayer`) | 1 | Speed Is Weight | `retranslate` | `manual-review-required` | `f59b57ae57d81722` |
| Powerhouse | Dragonslayer (`powerhouse.dragonslayer`) | 2 | Wide Arc | `retranslate` | `manual-review-required` | `e984e397a66d168b` |
| Powerhouse | Dragonslayer (`powerhouse.dragonslayer`) | 3 | Titanic Heave [ Breathe → Body Finisher ] | `retranslate` | `manual-review-required` | `eb90c2d37d58151e` |
| Powerhouse | Duelist (`powerhouse.duelist`) | 1 | Riposte [ Block → Skirmish ] | `retranslate` | `manual-review-required` | `c7a8e2648f2934ec` |
| Powerhouse | Duelist (`powerhouse.duelist`) | 2 | Parry | `retranslate` | `manual-review-required` | `737405e83b8d55c5` |
| Powerhouse | Duelist (`powerhouse.duelist`) | 3 | Deflecting Blow | `retranslate` | `manual-review-required` | `ea0a39d592d6d39b` |
| Powerhouse | Flagellant (`powerhouse.flagellant`) | 1 | Thrill | `retranslate` | `manual-review-required` | `2704953c53c8c6e9` |
| Powerhouse | Flagellant (`powerhouse.flagellant`) | 2 | Wild Rush | `retranslate` | `manual-review-required` | `440df2a8d9f9ffcc` |
| Powerhouse | Flagellant (`powerhouse.flagellant`) | 3 | Bled Dry | `retranslate` | `manual-review-required` | `340dfc8d41d7be6c` |
| Powerhouse | Gunslinger (`powerhouse.gunslinger`) | 1 | Big Iron | `retranslate` | `manual-review-required` | `82398f37eff383ff` |
| Powerhouse | Gunslinger (`powerhouse.gunslinger`) | 2 | Lock And Load | `retranslate` | `manual-review-required` | `dc44863731f0ffb2` |
| Powerhouse | Gunslinger (`powerhouse.gunslinger`) | 3 | Bullet Juggle | `retranslate` | `manual-review-required` | `976a1f4224efc917` |
| Powerhouse | Struggler (`powerhouse.struggler`) | 1 | Effort | `retranslate` | `manual-review-required` | `6342be72555c14de` |
| Powerhouse | Struggler (`powerhouse.struggler`) | 2 | Adrenaline | `retranslate` | `manual-review-required` | `f81b1b014103e336` |
| Powerhouse | Struggler (`powerhouse.struggler`) | 3 | Defy Reason | `retranslate` | `manual-review-required` | `0e073ee5f8118075` |
| Powerhouse | SpellSword (`powerhouse.spellsword`) | 1 | Twin Suns [ Cast → Skirmish ] | `retranslate` | `manual-review-required` | `5d78cb03e03424f7` |
| Powerhouse | SpellSword (`powerhouse.spellsword`) | 2 | Infused Edge | `retranslate` | `manual-review-required` | `1e545b612f67d323` |
| Powerhouse | SpellSword (`powerhouse.spellsword`) | 3 | Witch Hunter [ Cast → Body/Talent Finisher ] | `retranslate` | `manual-review-required` | `eda4ebe61c07c64e` |
| Powerhouse | Technician (`powerhouse.technician`) | 1 | Stretch | `retranslate` | `manual-review-required` | `79572f225f0492a3` |
| Powerhouse | Technician (`powerhouse.technician`) | 2 | Perfect Form | `retranslate` | `manual-review-required` | `ce6827c18d51fb6c` |
| Powerhouse | Technician (`powerhouse.technician`) | 3 | Final Blow [ Skirmish → Finisher ] | `retranslate` | `manual-review-required` | `b956af193443e2cb` |
| Powerhouse | Unbroken (`powerhouse.unbroken`) | 1 | Get Back Up | `retranslate` | `manual-review-required` | `59ff2f83e6583a67` |
| Powerhouse | Unbroken (`powerhouse.unbroken`) | 2 | Furious Revival | `retranslate` | `manual-review-required` | `415bef2cfb819804` |
| Powerhouse | Unbroken (`powerhouse.unbroken`) | 3 | Phoenix | `retranslate` | `manual-review-required` | `a2be4537149b4bf0` |
| Powerhouse | Braggart (`powerhouse.braggart`) | 1 | Hubris | `retranslate` | `manual-review-required` | `f730a0d19790a34d` |
| Powerhouse | Braggart (`powerhouse.braggart`) | 2 | Prove Yourself | `retranslate` | `manual-review-required` | `32aacdadaaea72f0` |
| Powerhouse | Braggart (`powerhouse.braggart`) | 3 | A Worthy Opponent | `retranslate` | `manual-review-required` | `895a9722a43fac78` |
| Powerhouse | Breacher (`powerhouse.breacher`) | 1 | Buck Shot | `retranslate` | `manual-review-required` | `100e8fe08a5367f1` |
| Powerhouse | Breacher (`powerhouse.breacher`) | 2 | Both Barrels | `retranslate` | `manual-review-required` | `6d7e855962636244` |
| Powerhouse | Breacher (`powerhouse.breacher`) | 3 | Annihilate | `retranslate` | `manual-review-required` | `2c20f67369376fd9` |
| Powerhouse | Dual Wielder (`powerhouse.dual-wielder`) | 1 | Twinned blow | `retranslate` | `manual-review-required` | `89b607d1a9861185` |
| Powerhouse | Dual Wielder (`powerhouse.dual-wielder`) | 2 | Frenzied Barrage | `retranslate` | `manual-review-required` | `832567133bd41698` |
| Powerhouse | Dual Wielder (`powerhouse.dual-wielder`) | 3 | Varied Blades | `retranslate` | `manual-review-required` | `723459358441ba45` |
| Powerhouse | Intimidator (`powerhouse.intimidator`) | 1 | "Pathetic" | `translate-new` | `manual-review-required` | `4b854f891de1df5e` |
| Powerhouse | Intimidator (`powerhouse.intimidator`) | 2 | "Out Of My Way" | `translate-new` | `manual-review-required` | `4a029e4f0c8ea648` |
| Powerhouse | Intimidator (`powerhouse.intimidator`) | 3 | "Fools And Dead Men" | `translate-new` | `manual-review-required` | `6100666f3c899591` |
| Powerhouse | Martial Artist (`powerhouse.martial-artist`) | 1 | Art Of The 8 Hammers | `retranslate` | `manual-review-required` | `4ea45ed8d292eb0c` |
| Powerhouse | Martial Artist (`powerhouse.martial-artist`) | 2 | Flow-State | `retranslate` | `manual-review-required` | `6ceea76d69259a77` |
| Powerhouse | Martial Artist (`powerhouse.martial-artist`) | 3 | Unlimited Blows | `retranslate` | `manual-review-required` | `bfe61da35abe2754` |
| Powerhouse | Monastic Warrior (`powerhouse.monastic-sage`) | 1 | Mind Made Manifest | `retranslate` | `manual-review-required` | `6e01c05fd7bcb306` |
| Powerhouse | Monastic Warrior (`powerhouse.monastic-sage`) | 2 | Calm Within Chaos | `retranslate` | `manual-review-required` | `1af925e0dff2f2a0` |
| Powerhouse | Monastic Warrior (`powerhouse.monastic-sage`) | 3 | Sublime Equanimity | `retranslate` | `manual-review-required` | `5c8c7b4b95142ef3` |
| Powerhouse | Lancer (`powerhouse.lancer`) | 1 | Pierce | `retranslate` | `manual-review-required` | `5809410552a366ba` |
| Powerhouse | Lancer (`powerhouse.lancer`) | 2 | Phalanx | `retranslate` | `manual-review-required` | `22efcb4eafb34bf5` |
| Powerhouse | Lancer (`powerhouse.lancer`) | 3 | Cannon-Arm [ Breathe → Skirmish ] | `retranslate` | `manual-review-required` | `c3932debc46443e4` |
| Powerhouse | Predator (`powerhouse.predator`) | 1 | Yearn | `retranslate` | `manual-review-required` | `2a3ebbd1b1da08b1` |
| Powerhouse | Predator (`powerhouse.predator`) | 2 | Obsess | `retranslate` | `manual-review-required` | `7e5a0be7ab4e34b3` |
| Powerhouse | Predator (`powerhouse.predator`) | 3 | Envelop | `retranslate` | `manual-review-required` | `5d4980de70d0520e` |
| Powerhouse | Improvisational Fighter (`powerhouse.improvisational-fighter`) | 1 | "This'll Do" | `retranslate` | `manual-review-required` | `632e499117e2b754` |
| Powerhouse | Improvisational Fighter (`powerhouse.improvisational-fighter`) | 2 | "That One Hurts!" | `retranslate` | `manual-review-required` | `c356561a8f9a8045` |
| Powerhouse | Improvisational Fighter (`powerhouse.improvisational-fighter`) | 3 | Last Resort | `retranslate` | `manual-review-required` | `736e87e2173b861e` |
| Powerhouse | Warring Ascendant (`powerhouse.warring-ascendant`) | 1 | Heavenly Arm | `retranslate` | `manual-review-required` | `81c4cc643d32a301` |
| Powerhouse | Warring Ascendant (`powerhouse.warring-ascendant`) | 2 | Esoteric Blades | `retranslate` | `manual-review-required` | `943b964c1f2b6604` |
| Powerhouse | Warring Ascendant (`powerhouse.warring-ascendant`) | 3 | Saintly Sword, Heaven Piercer | `retranslate` | `manual-review-required` | `198d0c654b2e8d87` |
| Powerhouse | Heroic Ascendant (`powerhouse.heroic-ascendant`) | 1 | Warrior Of Legend | `translate-new` | `manual-review-required` | `6c35555b4450c506` |
| Powerhouse | Heroic Ascendant (`powerhouse.heroic-ascendant`) | 2 | Hero's Feat | `translate-new` | `manual-review-required` | `efaf220213e531a1` |
| Powerhouse | Heroic Ascendant (`powerhouse.heroic-ascendant`) | 3 | Mastered Strength | `translate-new` | `manual-review-required` | `96c430fd029a1b51` |
| Vagabond | Aerial Master (`vagabond.aerial-master`) | 1 | Soar | `retranslate` | `manual-review-required` | `572a0ee794857e15` |
| Vagabond | Aerial Master (`vagabond.aerial-master`) | 2 | Hunt | `retranslate` | `manual-review-required` | `26eef31adf8b9360` |
| Vagabond | Aerial Master (`vagabond.aerial-master`) | 3 | Falling Ax Strike | `retranslate` | `manual-review-required` | `24a53444194ff403` |
| Vagabond | Assassin (`vagabond.assassin`) | 1 | Ambush | `retranslate` | `manual-review-required` | `28bc5c383b4978f3` |
| Vagabond | Assassin (`vagabond.assassin`) | 2 | Assassinate | `retranslate` | `manual-review-required` | `c539f835c3a9d316` |
| Vagabond | Assassin (`vagabond.assassin`) | 3 | Speed of Dark [ Hide → Stride ] | `retranslate` | `manual-review-required` | `554e9163e23ffafc` |
| Vagabond | Sniper (`vagabond.sniper`) | 1 | Long Shot | `retranslate` | `manual-review-required` | `8390a46521c670cc` |
| Vagabond | Sniper (`vagabond.sniper`) | 2 | Bunker Down | `retranslate` | `manual-review-required` | `6462e331f674a518` |
| Vagabond | Sniper (`vagabond.sniper`) | 3 | Deadeye [ Hide → Talent Finisher ] | `retranslate` | `manual-review-required` | `21aeb41333c7f657` |
| Vagabond | Skirmisher (`vagabond.skirmisher`) | 1 | Sting | `retranslate` | `manual-review-required` | `8348658d6399dac2` |
| Vagabond | Skirmisher (`vagabond.skirmisher`) | 2 | Shifting Blows | `retranslate` | `manual-review-required` | `16b0d3e5939c2198` |
| Vagabond | Skirmisher (`vagabond.skirmisher`) | 3 | Rebound | `retranslate` | `manual-review-required` | `f645f869f1d9c50d` |
| Vagabond | Speed Demon (`vagabond.speed-demon`) | 1 | Fade | `retranslate` | `manual-review-required` | `dd5cc79f3f503acc` |
| Vagabond | Speed Demon (`vagabond.speed-demon`) | 2 | Flash Strike | `retranslate` | `manual-review-required` | `badd0968bb8cd039` |
| Vagabond | Speed Demon (`vagabond.speed-demon`) | 3 | Flash Step [ Breathe → Stride ] | `retranslate` | `manual-review-required` | `356a6e1bf1f354a4` |
| Vagabond | Untouchable (`vagabond.untouchable`) | 1 | Duck | `retranslate` | `manual-review-required` | `34f4b067290bae1a` |
| Vagabond | Untouchable (`vagabond.untouchable`) | 2 | Weave | `retranslate` | `manual-review-required` | `51d403f1b7f3090b` |
| Vagabond | Untouchable (`vagabond.untouchable`) | 3 | Fighter's Instinct [ Dodge → Skirmish ] | `retranslate` | `manual-review-required` | `3a54f218d90b2a8e` |
| Vagabond | Acrobat (`vagabond.acrobat`) | 1 | Flying Kick [ Jump → Skirmish ] | `retranslate` | `manual-review-required` | `6dbbffb2aecc63c7` |
| Vagabond | Acrobat (`vagabond.acrobat`) | 2 | Wall Jump | `retranslate` | `manual-review-required` | `686db2022b514dcb` |
| Vagabond | Acrobat (`vagabond.acrobat`) | 3 | Weightless Body | `retranslate` | `manual-review-required` | `d3baf0fc3e98f6ec` |
| Vagabond | Blade Master (`vagabond.blade-master`) | 1 | Draw Stance | `retranslate` | `manual-review-required` | `08e805a67249822c` |
| Vagabond | Blade Master (`vagabond.blade-master`) | 2 | Divide In One Motion [ Breathe → Jump ] | `retranslate` | `manual-review-required` | `f1a21059fec2879b` |
| Vagabond | Blade Master (`vagabond.blade-master`) | 3 | Leaping Koi | `retranslate` | `manual-review-required` | `bea35375e9df5b87` |
| Vagabond | Cunning Fighter (`vagabond.cunning-fighter`) | 1 | Plan and Execute | `retranslate` | `manual-review-required` | `2a0b8f313d602aa5` |
| Vagabond | Cunning Fighter (`vagabond.cunning-fighter`) | 2 | Plans Within Plans | `retranslate` | `manual-review-required` | `163bf80d7d2fe167` |
| Vagabond | Cunning Fighter (`vagabond.cunning-fighter`) | 3 | At a Glance | `retranslate` | `manual-review-required` | `2a897f12427e435c` |
| Vagabond | Egomaniac (`vagabond.egomaniac`) | 1 | Peak Condition | `retranslate` | `manual-review-required` | `bab1adc920edb632` |
| Vagabond | Egomaniac (`vagabond.egomaniac`) | 2 | Dance With Me | `retranslate` | `manual-review-required` | `ffa2aaa11a0137ec` |
| Vagabond | Egomaniac (`vagabond.egomaniac`) | 3 | Finale | `retranslate` | `manual-review-required` | `4e9778a24e46d3c2` |
| Vagabond | Enchained (`vagabond.enchained`) | 1 | Hook Shot | `retranslate` | `manual-review-required` | `055141150f119780` |
| Vagabond | Enchained (`vagabond.enchained`) | 2 | Draw In | `retranslate` | `manual-review-required` | `f68cae1e1bc03bf4` |
| Vagabond | Enchained (`vagabond.enchained`) | 3 | Momentum [ Cast → Skirmish ] | `retranslate` | `manual-review-required` | `7675addd0d247549` |
| Vagabond | Knife Juggler (`vagabond.knife-juggler`) | 1 | Throw | `retranslate` | `manual-review-required` | `65f000e981ba565f` |
| Vagabond | Knife Juggler (`vagabond.knife-juggler`) | 2 | Resupply | `retranslate` | `manual-review-required` | `4e52583d92435d03` |
| Vagabond | Knife Juggler (`vagabond.knife-juggler`) | 3 | Chaser | `retranslate` | `manual-review-required` | `95da4681c5186dee` |
| Vagabond | Malicious Mimic (`vagabond.malicious-mimic`) | 1 | "Anything You Can Do…" | `retranslate` | `manual-review-required` | `e51d98ac96778b9e` |
| Vagabond | Malicious Mimic (`vagabond.malicious-mimic`) | 2 | Rehearsed Movements | `retranslate` | `manual-review-required` | `cae4879b7d155524` |
| Vagabond | Malicious Mimic (`vagabond.malicious-mimic`) | 3 | "…I Can Do Better" | `retranslate` | `manual-review-required` | `f8db1edcc855a194` |
| Vagabond | Weaponsmith (`vagabond.weaponsmith`) | 1 | Trick Weapon | `translate-new` | `manual-review-required` | `2c8b381099a2ce09` |
| Vagabond | Weaponsmith (`vagabond.weaponsmith`) | 2 | Adaptive Edge | `translate-new` | `manual-review-required` | `49122a48cffe5b06` |
| Vagabond | Weaponsmith (`vagabond.weaponsmith`) | 3 | Metalurgy | `translate-new` | `manual-review-required` | `03d7ea3e17389290` |
| Vagabond | Modified Meister (`vagabond.modified-meister`) | 1 | Running Hot | `retranslate` | `manual-review-required` | `42cced8cbae8324c` |
| Vagabond | Modified Meister (`vagabond.modified-meister`) | 2 | Overload | `retranslate` | `manual-review-required` | `9d72975943ef5527` |
| Vagabond | Modified Meister (`vagabond.modified-meister`) | 3 | Overclock | `retranslate` | `manual-review-required` | `22e70dd0c2dd89cf` |
| Vagabond | Opportunist (`vagabond.opportunist`) | 1 | Pack Tactics | `retranslate` | `manual-review-required` | `f18872de419f545d` |
| Vagabond | Opportunist (`vagabond.opportunist`) | 2 | Hungry Eyes | `retranslate` | `manual-review-required` | `a16584fc8970fc8f` |
| Vagabond | Opportunist (`vagabond.opportunist`) | 3 | Launcher Combo | `retranslate` | `manual-review-required` | `4e0c6b6ad4e95a36` |
| Vagabond | Reflector (`vagabond.reflector`) | 1 | Catch The Blade | `retranslate` | `manual-review-required` | `a4afd84dfacf7d64` |
| Vagabond | Reflector (`vagabond.reflector`) | 2 | Watch And Wait | `retranslate` | `manual-review-required` | `e4586b2f5746b320` |
| Vagabond | Reflector (`vagabond.reflector`) | 3 | To Carry Their Fury | `retranslate` | `manual-review-required` | `39473b617e6ea663` |
| Vagabond | Detective (`vagabond.dim-mak`) | 1 | Study Weakness | `retranslate` | `manual-review-required` | `57c2d10021b83b34` |
| Vagabond | Detective (`vagabond.dim-mak`) | 2 | Dissect [ Investigate x 3 ] | `retranslate` | `manual-review-required` | `8f245e4e776b3358` |
| Vagabond | Detective (`vagabond.dim-mak`) | 3 | 4-Point Execution | `retranslate` | `manual-review-required` | `b2851de1a5c1ef27` |
| Vagabond | Drunkard (`vagabond.drunkard`) | 1 | Down The Hatch | `retranslate` | `manual-review-required` | `49868f8e82de5b4f` |
| Vagabond | Drunkard (`vagabond.drunkard`) | 2 | Fool's Dance | `retranslate` | `manual-review-required` | `cf13463e69c83834` |
| Vagabond | Drunkard (`vagabond.drunkard`) | 3 | Chug | `retranslate` | `manual-review-required` | `473d8f641cfae94b` |
| Vagabond | Master-At-Arms (`vagabond.master-at-arms`) | 1 | Multi-Faceted | `retranslate` | `manual-review-required` | `34c5c1a7fd438617` |
| Vagabond | Master-At-Arms (`vagabond.master-at-arms`) | 2 | Like Water | `retranslate` | `manual-review-required` | `6b0e835d3651db2f` |
| Vagabond | Master-At-Arms (`vagabond.master-at-arms`) | 3 | Master At Work | `retranslate` | `manual-review-required` | `732f26a431498496` |
| Bulwark | Crusher (`bulwark.crusher`) | 1 | 30,000 Tons | `retranslate` | `manual-review-required` | `3b4b5e0e73e01b65` |
| Bulwark | Crusher (`bulwark.crusher`) | 2 | Hammerfall | `retranslate` | `manual-review-required` | `00585a1da1b0f4f0` |
| Bulwark | Crusher (`bulwark.crusher`) | 3 | "You Look Like A Nail" | `retranslate` | `manual-review-required` | `59324adcb47c53cc` |
| Bulwark | Giant Frame (`bulwark.giant-frame`) | 1 | Big Arms | `retranslate` | `manual-review-required` | `f628ff1dbbb105ef` |
| Bulwark | Giant Frame (`bulwark.giant-frame`) | 2 | Immense | `retranslate` | `manual-review-required` | `42403da96ba99772` |
| Bulwark | Giant Frame (`bulwark.giant-frame`) | 3 | Shockwave | `retranslate` | `manual-review-required` | `3f44188707f16112` |
| Bulwark | Iron Bodied (`bulwark.iron-bodied`) | 1 | Tough As Stone | `retranslate` | `manual-review-required` | `0c523408fb28183f` |
| Bulwark | Iron Bodied (`bulwark.iron-bodied`) | 2 | Resilience | `retranslate` | `manual-review-required` | `1e813a4756e2cff3` |
| Bulwark | Iron Bodied (`bulwark.iron-bodied`) | 3 | Stainless Stride | `retranslate` | `manual-review-required` | `7f52212acce30dbb` |
| Bulwark | Vanguard Defender (`bulwark.vanguard-defender`) | 1 | White Knight | `retranslate` | `manual-review-required` | `5eb30be3a6d12738` |
| Bulwark | Vanguard Defender (`bulwark.vanguard-defender`) | 2 | Steel Angel | `retranslate` | `manual-review-required` | `a54832890e85275f` |
| Bulwark | Vanguard Defender (`bulwark.vanguard-defender`) | 3 | Inspire Courage | `retranslate` | `manual-review-required` | `c454648159c285a4` |
| Bulwark | Absolute Bastard (`bulwark.absolute-bastard`) | 1 | Easy To Hate | `retranslate` | `manual-review-required` | `4644ccc49ebbd2e2` |
| Bulwark | Absolute Bastard (`bulwark.absolute-bastard`) | 2 | Bully | `retranslate` | `manual-review-required` | `1e3d5fa35b2fb9f4` |
| Bulwark | Absolute Bastard (`bulwark.absolute-bastard`) | 3 | Add Injury To Insult | `retranslate` | `manual-review-required` | `b5a837d77ad87458` |
| Bulwark | Battle Jockey (`bulwark.battle-jockey`) | 1 | Trusty Steed | `retranslate` | `manual-review-required` | `b3c3296935ce4da3` |
| Bulwark | Battle Jockey (`bulwark.battle-jockey`) | 2 | Grasping Jaws | `retranslate` | `manual-review-required` | `1e32792217b8f9ed` |
| Bulwark | Battle Jockey (`bulwark.battle-jockey`) | 3 | Roaring Entry | `retranslate` | `manual-review-required` | `bdd37dabb9ab7f85` |
| Bulwark | Grappler (`bulwark.grappler`) | 1 | Restrain | `retranslate` | `manual-review-required` | `d82d827235c6b7d0` |
| Bulwark | Grappler (`bulwark.grappler`) | 2 | Spine Breaker | `retranslate` | `manual-review-required` | `7f2bf0a4de8a41f9` |
| Bulwark | Grappler (`bulwark.grappler`) | 3 | Finishing Move [ Body Finisher → Jump ] | `retranslate` | `manual-review-required` | `eab5b97c24d6ad1d` |
| Bulwark | Juggernaut (`bulwark.juggernaut`) | 1 | Wild Charge | `retranslate` | `manual-review-required` | `af271c9cfa3c926d` |
| Bulwark | Juggernaut (`bulwark.juggernaut`) | 2 | Violence | `retranslate` | `manual-review-required` | `136350396e80dda3` |
| Bulwark | Juggernaut (`bulwark.juggernaut`) | 3 | "Eat Dirt!" | `retranslate` | `manual-review-required` | `03446af30ec4f3e1` |
| Bulwark | Mollycoddler (`bulwark.runic-retribution`) | 1 | Lash | `retranslate` | `manual-review-required` | `008621716a894ee0` |
| Bulwark | Mollycoddler (`bulwark.runic-retribution`) | 2 | Loving Rite | `retranslate` | `manual-review-required` | `6c57a305c4b33a94` |
| Bulwark | Mollycoddler (`bulwark.runic-retribution`) | 3 | Devotion | `retranslate` | `manual-review-required` | `7c68cb53f546028e` |
| Bulwark | Mundane (`bulwark.mundane`) | 1 | For What The Spirit Lacks | `retranslate` | `manual-review-required` | `2b651f94970e8e3f` |
| Bulwark | Mundane (`bulwark.mundane`) | 2 | Dig Deep, Stand Firm | `retranslate` | `manual-review-required` | `0f24dc02e9b7b63d` |
| Bulwark | Mundane (`bulwark.mundane`) | 3 | In The Face Of The Beyond | `retranslate` | `manual-review-required` | `1487c3e6c3fecfcc` |
| Bulwark | Rising Challenger (`bulwark.rising-challenger`) | 1 | Perfect Deflection | `retranslate` | `manual-review-required` | `336d9e4890841a86` |
| Bulwark | Rising Challenger (`bulwark.rising-challenger`) | 2 | "You'll Have To Get Through Me!" | `retranslate` | `manual-review-required` | `96fa5a807e762ce7` |
| Bulwark | Rising Challenger (`bulwark.rising-challenger`) | 3 | Drama And Spite | `retranslate` | `manual-review-required` | `637ab1845d8775cc` |
| Bulwark | Shield Bearer (`bulwark.shield-bearer`) | 1 | Wall | `retranslate` | `manual-review-required` | `8c5c7f81071b9651` |
| Bulwark | Shield Bearer (`bulwark.shield-bearer`) | 2 | Shield Charge | `retranslate` | `manual-review-required` | `957c862f29223a20` |
| Bulwark | Shield Bearer (`bulwark.shield-bearer`) | 3 | Focused Defense | `retranslate` | `manual-review-required` | `7c586ee8f58f212c` |
| Bulwark | Stalwart Sentry (`bulwark.stalwart-sentry`) | 1 | Guardian | `retranslate` | `manual-review-required` | `d79687b3b9ee08d3` |
| Bulwark | Stalwart Sentry (`bulwark.stalwart-sentry`) | 2 | On Watch | `retranslate` | `manual-review-required` | `ad8860275f401a7d` |
| Bulwark | Stalwart Sentry (`bulwark.stalwart-sentry`) | 3 | Zone Of Influence | `retranslate` | `manual-review-required` | `26bfbd7a943dbe14` |
| Bulwark | Bestial Ascendant (`bulwark.beastial-ascendant`) | 1 | Beastly | `retranslate` | `manual-review-required` | `a562ed34893dc5bc` |
| Bulwark | Bestial Ascendant (`bulwark.beastial-ascendant`) | 2 | Inheritance | `retranslate` | `manual-review-required` | `805e9dcf122c5901` |
| Bulwark | Bestial Ascendant (`bulwark.beastial-ascendant`) | 3 | Apex | `retranslate` | `manual-review-required` | `a794f6509734fc0f` |
| Bulwark | Guard Caller (`bulwark.guardian-angel`) | 1 | Two Bodies | `retranslate` | `manual-review-required` | `fe0b0043bcbb55ed` |
| Bulwark | Guard Caller (`bulwark.guardian-angel`) | 2 | Together In Life | `retranslate` | `manual-review-required` | `74932daaba73656d` |
| Bulwark | Guard Caller (`bulwark.guardian-angel`) | 3 | Together In Death | `retranslate` | `manual-review-required` | `b6d4a4a8116ecdc8` |
| Bulwark | Mecha Pilot (`bulwark.mecha-pilot`) | 1 | Rune Core Engine | `retranslate` | `manual-review-required` | `f520cc1bc1496e3f` |
| Bulwark | Mecha Pilot (`bulwark.mecha-pilot`) | 2 | Autonomous | `retranslate` | `manual-review-required` | `94b57ffbb1bdcb0d` |
| Bulwark | Mecha Pilot (`bulwark.mecha-pilot`) | 3 | Perfect Sync | `retranslate` | `manual-review-required` | `290300b9d6ac0a56` |
| Altruist | Analyst (`altruist.precognizant`) | 1 | Flash Of Insight | `retranslate` | `manual-review-required` | `a9087c963c745cac` |
| Altruist | Analyst (`altruist.precognizant`) | 2 | Take Advantage | `retranslate` | `manual-review-required` | `71fec91d04fefaa9` |
| Altruist | Analyst (`altruist.precognizant`) | 3 | Watch And Wait | `retranslate` | `manual-review-required` | `bbd356b8d75e9eb7` |
| Altruist | Battle Instructor (`altruist.battle-instructor`) | 1 | Strike Order | `retranslate` | `manual-review-required` | `26d2d8d806992cd6` |
| Altruist | Battle Instructor (`altruist.battle-instructor`) | 2 | Teaching Moment | `retranslate` | `manual-review-required` | `d8da821f7094e0fd` |
| Altruist | Battle Instructor (`altruist.battle-instructor`) | 3 | Remember Your Training | `retranslate` | `manual-review-required` | `bd118b398395a3a4` |
| Altruist | Empath (`altruist.empath`) | 1 | Calming Aura | `retranslate` | `manual-review-required` | `5073193871000289` |
| Altruist | Empath (`altruist.empath`) | 2 | Protective Response | `retranslate` | `manual-review-required` | `772047b9fccd0d11` |
| Altruist | Empath (`altruist.empath`) | 3 | "Are You Ok?" | `retranslate` | `manual-review-required` | `2aa2256aa75ebc52` |
| Altruist | Compassionate Sage (`altruist.heavenly-saint`) | 1 | Strength Of Prayer | `retranslate` | `manual-review-required` | `f488cdd074cf5e85` |
| Altruist | Compassionate Sage (`altruist.heavenly-saint`) | 2 | Cleansing Light | `retranslate` | `manual-review-required` | `01c6c91b0b548568` |
| Altruist | Compassionate Sage (`altruist.heavenly-saint`) | 3 | Grand Restoration | `retranslate` | `manual-review-required` | `8204866e3b871f9a` |
| Altruist | Gourmand (`altruist.gourmand`) | 1 | Healthy Meal | `retranslate` | `manual-review-required` | `c895c7564ab525d7` |
| Altruist | Gourmand (`altruist.gourmand`) | 2 | Fast Food | `retranslate` | `manual-review-required` | `cc093be853ebf1a0` |
| Altruist | Gourmand (`altruist.gourmand`) | 3 | Shared Experiences | `retranslate` | `manual-review-required` | `501d1df119ed1705` |
| Altruist | Surgeon (`altruist.surgeon`) | 1 | Do No Harm | `retranslate` | `manual-review-required` | `708ed20a012b56fb` |
| Altruist | Surgeon (`altruist.surgeon`) | 2 | Operational Procedure | `retranslate` | `manual-review-required` | `f49e2979a121bf28` |
| Altruist | Surgeon (`altruist.surgeon`) | 3 | Miracle Worker | `retranslate` | `manual-review-required` | `f9c53cd4b85dba81` |
| Altruist | Tactical Master (`disruptor.tactical-master`) | 1 | Stop And Think | `retranslate` | `manual-review-required` | `ddd05597f4d74006` |
| Altruist | Tactical Master (`disruptor.tactical-master`) | 2 | Study | `retranslate` | `manual-review-required` | `67781c6212b8055f` |
| Altruist | Tactical Master (`disruptor.tactical-master`) | 3 | Eureka! | `retranslate` | `manual-review-required` | `4be27c83df1d8098` |
| Altruist | Talisman Exorcist (`altruist.talisman-caster`) | 1 | Sacred Seal | `retranslate` | `manual-review-required` | `729358353f7df9e0` |
| Altruist | Talisman Exorcist (`altruist.talisman-caster`) | 2 | Tossed Talisman | `retranslate` | `manual-review-required` | `d6927a618c191c68` |
| Altruist | Talisman Exorcist (`altruist.talisman-caster`) | 3 | Exorcize | `retranslate` | `manual-review-required` | `aa086b1274444b87` |
| Altruist | Abjuring Sage (`altruist.abjuring-sage`) | 1 | Barrier | `translate-new` | `manual-review-required` | `d63f167541afc240` |
| Altruist | Abjuring Sage (`altruist.abjuring-sage`) | 2 | Impenetrable | `translate-new` | `manual-review-required` | `9b042f4c1903883c` |
| Altruist | Abjuring Sage (`altruist.abjuring-sage`) | 3 | Block Beam | `translate-new` | `manual-review-required` | `215d9ea8397ee622` |
| Altruist | Alchemist (`altruist.alchemist`) | 1 | Quick Mix | `retranslate` | `manual-review-required` | `b251af0a99bab6b0` |
| Altruist | Alchemist (`altruist.alchemist`) | 2 | Powerful Mix | `retranslate` | `manual-review-required` | `e696ecb47ddfe608` |
| Altruist | Alchemist (`altruist.alchemist`) | 3 | High Intensity Mix | `retranslate` | `manual-review-required` | `38d1ae904ceafae9` |
| Altruist | Dancer (`altruist.dancer`) | 1 | Dance Partner | `retranslate` | `manual-review-required` | `5e1ff0d9c133ba73` |
| Altruist | Dancer (`altruist.dancer`) | 2 | Hearts In Tandem | `retranslate` | `manual-review-required` | `b1f638fa2012c16e` |
| Altruist | Dancer (`altruist.dancer`) | 3 | The Prestige | `retranslate` | `manual-review-required` | `9906ad6fbf5c9607` |
| Altruist | Fog Walker (`altruist.fog-walker`) | 1 | Blowing Smoke | `retranslate` | `manual-review-required` | `0bb814b4f34273e9` |
| Altruist | Fog Walker (`altruist.fog-walker`) | 2 | Mystic Mist | `retranslate` | `manual-review-required` | `a7c35a9a9c816e5b` |
| Altruist | Fog Walker (`altruist.fog-walker`) | 3 | Stinging Steam | `retranslate` | `manual-review-required` | `b33b92caac0a9779` |
| Altruist | Last Hope (`altruist.last-hope`) | 1 | Notably Absent | `retranslate` | `manual-review-required` | `c6df6194aaf13e69` |
| Altruist | Last Hope (`altruist.last-hope`) | 2 | Heroic Return | `retranslate` | `manual-review-required` | `6d82e32cfbeb63a5` |
| Altruist | Last Hope (`altruist.last-hope`) | 3 | Explosive Return | `retranslate` | `manual-review-required` | `922f5e2ec3fa08ed` |
| Altruist | Replicator (`altruist.replicator`) | 1 | Echo Form | `retranslate` | `manual-review-required` | `6c8a61611efb899c` |
| Altruist | Replicator (`altruist.replicator`) | 2 | Symmetry | `retranslate` | `manual-review-required` | `7ec2bc31297d234d` |
| Altruist | Replicator (`altruist.replicator`) | 3 | Full Sync | `retranslate` | `manual-review-required` | `57e4c628db4c199f` |
| Altruist | Temporal Sage (`altruist.chronomancer`) | 1 | Accelerate | `retranslate` | `manual-review-required` | `d30638f8613ff874` |
| Altruist | Temporal Sage (`altruist.chronomancer`) | 2 | Decelerate | `retranslate` | `manual-review-required` | `77e9a141179e9ce3` |
| Altruist | Temporal Sage (`altruist.chronomancer`) | 3 | Time Stop | `retranslate` | `manual-review-required` | `16faf1bb3dd4f3c8` |
| Altruist | Virtuoso (`altruist.bardic-savant`) | 1 | Musician | `retranslate` | `manual-review-required` | `ff6c0c4521a6b27e` |
| Altruist | Virtuoso (`altruist.bardic-savant`) | 2 | Reverb | `retranslate` | `manual-review-required` | `4499a505ec14b151` |
| Altruist | Virtuoso (`altruist.bardic-savant`) | 3 | Encore | `retranslate` | `manual-review-required` | `673717f77f073947` |
| Altruist | Artist (`altruist.artist`) | 1 | Stroke Of The Brush | `retranslate` | `manual-review-required` | `c7d906467c9bce2c` |
| Altruist | Artist (`altruist.artist`) | 2 | Canvas Of Flesh | `retranslate` | `manual-review-required` | `f4a25a5111ddde57` |
| Altruist | Artist (`altruist.artist`) | 3 | Brush-Brand | `retranslate` | `manual-review-required` | `67dba12692d5ced4` |
| Altruist | Deckbuilder (`altruist.deckbuilder`) | 1 | Draw | `retranslate` | `manual-review-required` | `6873829dc3a33c0f` |
| Altruist | Deckbuilder (`altruist.deckbuilder`) | 2 | Card Capture | `retranslate` | `manual-review-required` | `ab0eca46c883ee75` |
| Altruist | Deckbuilder (`altruist.deckbuilder`) | 3 | Greed | `retranslate` | `manual-review-required` | `c3cacad29b8b8e70` |
| Altruist | Will-O-Wisp (`altruist.will-o-wisp`) | 1 | Spirit Weaving Flame | `retranslate` | `manual-review-required` | `834790fb014fbaf0` |
| Altruist | Will-O-Wisp (`altruist.will-o-wisp`) | 2 | Friendly Spirits | `retranslate` | `manual-review-required` | `57cbc39d58c8fe7b` |
| Altruist | Will-O-Wisp (`altruist.will-o-wisp`) | 3 | Twinned Spirits | `retranslate` | `manual-review-required` | `7004477f5d6a90db` |
| Disruptor | Bloodletter (`disruptor.bloodletter`) | 1 | Bleeding Edge | `retranslate` | `manual-review-required` | `e6c6cfe187253145` |
| Disruptor | Bloodletter (`disruptor.bloodletter`) | 2 | Bloodhound | `retranslate` | `manual-review-required` | `ee714aec6d7ecb76` |
| Disruptor | Bloodletter (`disruptor.bloodletter`) | 3 | Rupture [ Skirmish → Breathe ] | `retranslate` | `manual-review-required` | `232ed61794bae68e` |
| Disruptor | Chemist (`disruptor.chemist`) | 1 | Sublimation | `retranslate` | `manual-review-required` | `e98fa07e8110afd8` |
| Disruptor | Chemist (`disruptor.chemist`) | 2 | Experimental Mixture | `retranslate` | `manual-review-required` | `7a0faa3e66538f53` |
| Disruptor | Chemist (`disruptor.chemist`) | 3 | Deposition | `retranslate` | `manual-review-required` | `7c5e779067118745` |
| Disruptor | Constrictor (`disruptor.constrictor`) | 1 | Wrap | `retranslate` | `manual-review-required` | `121e4b3b6dee7678` |
| Disruptor | Constrictor (`disruptor.constrictor`) | 2 | Choke | `retranslate` | `manual-review-required` | `100951f375a95e95` |
| Disruptor | Constrictor (`disruptor.constrictor`) | 3 | Twisting Impact | `retranslate` | `manual-review-required` | `2223364d1dca9e9c` |
| Disruptor | Cutpurse (`disruptor.cutpurse`) | 1 | Fast Hands | `retranslate` | `manual-review-required` | `82272271c41c59d0` |
| Disruptor | Cutpurse (`disruptor.cutpurse`) | 2 | Snatch | `retranslate` | `manual-review-required` | `eae4c43ef7a1e858` |
| Disruptor | Cutpurse (`disruptor.cutpurse`) | 3 | Rob Them Blind | `retranslate` | `manual-review-required` | `dc9b9a36eba10f67` |
| Disruptor | Light Bender (`disruptor.light-bender`) | 1 | Blendendes Licht | `translate-new` | `manual-review-required` | `db277412d690233f` |
| Disruptor | Light Bender (`disruptor.light-bender`) | 2 | Sonneneruption | `translate-new` | `manual-review-required` | `ddb6f722f81e260c` |
| Disruptor | Light Bender (`disruptor.light-bender`) | 3 | Falscher Stern | `translate-new` | `manual-review-required` | `e177441672fe0f9d` |
| Disruptor | Reaper (`disruptor.reaper`) | 1 | Sow | `retranslate` | `manual-review-required` | `70b4a5828340b370` |
| Disruptor | Reaper (`disruptor.reaper`) | 2 | Tend | `retranslate` | `manual-review-required` | `35c434766280f29e` |
| Disruptor | Reaper (`disruptor.reaper`) | 3 | Reap | `retranslate` | `manual-review-required` | `f450b839d5da63e9` |
| Disruptor | Street Fighter (`disruptor.street-fighter`) | 1 | Bloody Brass | `retranslate` | `manual-review-required` | `5c53bc32995f94e8` |
| Disruptor | Street Fighter (`disruptor.street-fighter`) | 2 | Break And Bruise | `retranslate` | `manual-review-required` | `c6f53b3955039bf0` |
| Disruptor | Street Fighter (`disruptor.street-fighter`) | 3 | Brutalize | `retranslate` | `manual-review-required` | `44586413669b5128` |
| Disruptor | Autophage (`disruptor.autophage`) | 1 | Transfusion | `retranslate` | `manual-review-required` | `8fb0813f48d3126e` |
| Disruptor | Autophage (`disruptor.autophage`) | 2 | Overexert | `retranslate` | `manual-review-required` | `af16ce3bd18d75bf` |
| Disruptor | Autophage (`disruptor.autophage`) | 3 | Born Of Mutable Flesh | `retranslate` | `manual-review-required` | `cac8d56d81f9e5cb` |
| Disruptor | Earth Speaker (`disruptor.earth-speaker`) | 1 | Stone Soldiers | `retranslate` | `manual-review-required` | `572bbbfc12e140b7` |
| Disruptor | Earth Speaker (`disruptor.earth-speaker`) | 2 | Tectonic Shift | `retranslate` | `manual-review-required` | `d0f80be4556d6d9e` |
| Disruptor | Earth Speaker (`disruptor.earth-speaker`) | 3 | Earthen Shards | `retranslate` | `manual-review-required` | `d4c6f7416c43d636` |
| Disruptor | Strongman (`disruptor.inhuman-strength`) | 1 | Strong-Arm | `retranslate` | `manual-review-required` | `e0556a9a593bbe67` |
| Disruptor | Strongman (`disruptor.inhuman-strength`) | 2 | Piston Fist | `retranslate` | `manual-review-required` | `5b131383739b45ce` |
| Disruptor | Strongman (`disruptor.inhuman-strength`) | 3 | Smash Through | `retranslate` | `manual-review-required` | `f1812266f10afac6` |
| Disruptor | SwarmKin (`disruptor.swarm-body`) | 1 | Fluttering Form | `retranslate` | `manual-review-required` | `109aaba5b81e81df` |
| Disruptor | SwarmKin (`disruptor.swarm-body`) | 2 | Vanish Into Flies | `retranslate` | `manual-review-required` | `b8d34044312d05b9` |
| Disruptor | SwarmKin (`disruptor.swarm-body`) | 3 | Devour | `retranslate` | `manual-review-required` | `7f9eff66cafa5ca8` |
| Disruptor | Siren (`disruptor.siren`) | 1 | "You wouldn't hurt ME, would you?" | `retranslate` | `manual-review-required` | `42987a33c0f120e5` |
| Disruptor | Siren (`disruptor.siren`) | 2 | "I'm Irresistible!" | `retranslate` | `manual-review-required` | `ec50072d8d9d9b2e` |
| Disruptor | Siren (`disruptor.siren`) | 3 | "A little help over here?" | `retranslate` | `manual-review-required` | `e2160711fd975390` |
| Disruptor | Wave Rider (`disruptor.wave-rider`) | 1 | Gentle Waves | `retranslate` | `manual-review-required` | `611f59d35dc7563d` |
| Disruptor | Wave Rider (`disruptor.wave-rider`) | 2 | Momentous Waves | `retranslate` | `manual-review-required` | `b264c987f1ada50d` |
| Disruptor | Wave Rider (`disruptor.wave-rider`) | 3 | Aqua Cage | `retranslate` | `manual-review-required` | `3c2815026a9237e3` |
| Disruptor | Mind Breaker (`disruptor.mind-breaker`) | 1 | "Where Are You?" | `retranslate` | `manual-review-required` | `35785fd63e1681be` |
| Disruptor | Mind Breaker (`disruptor.mind-breaker`) | 2 | "Where Am I?" | `retranslate` | `manual-review-required` | `a03caf1e07f6071c` |
| Disruptor | Mind Breaker (`disruptor.mind-breaker`) | 3 | "Who Are They?" | `retranslate` | `manual-review-required` | `48191b6a164273d8` |
| Disruptor | Gale Strider (`disruptor.gale-strider`) | 1 | Growing Winds | `retranslate` | `manual-review-required` | `aa85715300668dd3` |
| Disruptor | Gale Strider (`disruptor.gale-strider`) | 2 | Updraft | `retranslate` | `manual-review-required` | `292812a2d50d3c80` |
| Disruptor | Gale Strider (`disruptor.gale-strider`) | 3 | Mountain Carver | `retranslate` | `manual-review-required` | `9370cb4e5ec069ec` |
| Disruptor | Poacher (`disruptor.hunter`) | 1 | Steel Jaws | `retranslate` | `manual-review-required` | `d9b30b014acb1d15` |
| Disruptor | Poacher (`disruptor.hunter`) | 2 | Far Setting | `retranslate` | `manual-review-required` | `70b5cc112d86e966` |
| Disruptor | Poacher (`disruptor.hunter`) | 3 | Pit Trap | `retranslate` | `manual-review-required` | `6a4111853a8af8ff` |
| Disruptor | Jailor (`disruptor.mage-s-array`) | 1 | Erect | `retranslate` | `manual-review-required` | `e101f1005cf4714e` |
| Disruptor | Jailor (`disruptor.mage-s-array`) | 2 | Readjust | `retranslate` | `manual-review-required` | `824ebda4426fe464` |
| Disruptor | Jailor (`disruptor.mage-s-array`) | 3 | Prison Of Your Own Design | `retranslate` | `manual-review-required` | `62f7aad5d716f5c8` |
| Disruptor | Worldsmith (`disruptor.inner-world`) | 1 | Gaze Deeply | `retranslate` | `manual-review-required` | `426b660399f6dd83` |
| Disruptor | Worldsmith (`disruptor.inner-world`) | 2 | Domain Of Control | `retranslate` | `manual-review-required` | `f3ded6d08cf5b632` |
| Disruptor | Worldsmith (`disruptor.inner-world`) | 3 | Home Turf | `retranslate` | `manual-review-required` | `fc3daa811ef682f5` |
| Ruiner | Bombardier (`ruiner.bombardier`) | 1 | Explosion!! | `retranslate` | `manual-review-required` | `88278af13d57051c` |
| Ruiner | Bombardier (`ruiner.bombardier`) | 2 | Explosion!!! | `retranslate` | `manual-review-required` | `8ead71dd4f6f8741` |
| Ruiner | Bombardier (`ruiner.bombardier`) | 3 | EXPLOSION!!!! | `retranslate` | `manual-review-required` | `c66bb7c95f3d4c8b` |
| Ruiner | Eradicator (`ruiner.rapid-fire-sorcery`) | 1 | Proliferate | `retranslate` | `manual-review-required` | `8b0946831aa381e5` |
| Ruiner | Eradicator (`ruiner.rapid-fire-sorcery`) | 2 | Scorched Earth | `retranslate` | `manual-review-required` | `43c7580c6de94ab9` |
| Ruiner | Eradicator (`ruiner.rapid-fire-sorcery`) | 3 | Endless Fire [ Charge → Cast ] | `retranslate` | `manual-review-required` | `c13597f5d2eb2f89` |
| Ruiner | Ritualist (`ruiner.ritualist`) | 1 | Ley Lines | `retranslate` | `manual-review-required` | `251fe0306bebb95d` |
| Ruiner | Ritualist (`ruiner.ritualist`) | 2 | Arcane Artillery | `retranslate` | `manual-review-required` | `fa0e6c00ad02cd1b` |
| Ruiner | Ritualist (`ruiner.ritualist`) | 3 | Fractal Etchings | `retranslate` | `manual-review-required` | `c8a5c063891ee1dc` |
| Ruiner | Spellcrafter (`ruiner.spellcrafter`) | 1 | Experimentation | `retranslate` | `manual-review-required` | `2e8f54a9f9241414` |
| Ruiner | Spellcrafter (`ruiner.spellcrafter`) | 2 | Solidification | `retranslate` | `manual-review-required` | `7ef8b39f8066c4fc` |
| Ruiner | Spellcrafter (`ruiner.spellcrafter`) | 3 | Finalization | `retranslate` | `manual-review-required` | `550c57e8205ce41e` |
| Ruiner | Student Of Stars (`ruiner.student-of-stars`) | 1 | Power Unleashed [ Charge → Finisher ] | `retranslate` | `manual-review-required` | `b320b86bb7849687` |
| Ruiner | Student Of Stars (`ruiner.student-of-stars`) | 2 | Formless Strength | `retranslate` | `manual-review-required` | `370d340f9a2e1ab6` |
| Ruiner | Student Of Stars (`ruiner.student-of-stars`) | 3 | Moment Of Truth | `retranslate` | `manual-review-required` | `08ad2b41bfbaa373` |
| Ruiner | Blade Smith (`ruiner.mana-blades`) | 1 | Call Arms | `retranslate` | `manual-review-required` | `78105512ddfc1baa` |
| Ruiner | Blade Smith (`ruiner.mana-blades`) | 2 | Blade Storm | `retranslate` | `manual-review-required` | `9ab71d76bd9d43ba` |
| Ruiner | Blade Smith (`ruiner.mana-blades`) | 3 | Saintly Sword, Excalibur | `retranslate` | `manual-review-required` | `f8672ca0fed6437f` |
| Ruiner | Dramaturge (`ruiner.dramaturge`) | 1 | All Eyes On Me | `retranslate` | `manual-review-required` | `ebc21db807888482` |
| Ruiner | Dramaturge (`ruiner.dramaturge`) | 2 | Snatch Their Fire | `retranslate` | `manual-review-required` | `329a288357d14078` |
| Ruiner | Dramaturge (`ruiner.dramaturge`) | 3 | Power In Presentation | `retranslate` | `manual-review-required` | `320e58b3755b3b5f` |
| Ruiner | Feral Arcanist (`ruiner.feral-arcana`) | 1 | Vorpal Claw | `retranslate` | `manual-review-required` | `ed33464baa6d9c54` |
| Ruiner | Feral Arcanist (`ruiner.feral-arcana`) | 2 | Unchain [ Charge → Interact] | `retranslate` | `manual-review-required` | `4c695701ebb7a673` |
| Ruiner | Feral Arcanist (`ruiner.feral-arcana`) | 3 | Grasp | `retranslate` | `manual-review-required` | `185c61f90b0f8c99` |
| Ruiner | Flame Heart (`ruiner.flame-heart`) | 1 | Rev Up | `retranslate` | `manual-review-required` | `1d4afd73ba231277` |
| Ruiner | Flame Heart (`ruiner.flame-heart`) | 2 | Damning Impact | `retranslate` | `manual-review-required` | `d6baa1dfa802e765` |
| Ruiner | Flame Heart (`ruiner.flame-heart`) | 3 | Ashes To Ashes | `retranslate` | `manual-review-required` | `90e70e9a76679a3e` |
| Ruiner | Frost Veiler (`ruiner.cryomancer`) | 1 | Chill | `retranslate` | `manual-review-required` | `9ed5e1cd9df980d0` |
| Ruiner | Frost Veiler (`ruiner.cryomancer`) | 2 | Icicle Halo | `retranslate` | `manual-review-required` | `4014763b472ea2c8` |
| Ruiner | Frost Veiler (`ruiner.cryomancer`) | 3 | Shatter | `retranslate` | `manual-review-required` | `bd644ced32b50232` |
| Ruiner | Grim Ascendant (`ruiner.grim-ascendant`) | 1 | Impermanent Power | `retranslate` | `manual-review-required` | `b53ae8daf50a061b` |
| Ruiner | Grim Ascendant (`ruiner.grim-ascendant`) | 2 | Drain Life | `retranslate` | `manual-review-required` | `e28956139215c6fc` |
| Ruiner | Grim Ascendant (`ruiner.grim-ascendant`) | 3 | Umbra | `retranslate` | `manual-review-required` | `0ffe196140b245ea` |
| Ruiner | Ranger (`ruiner.long-draw`) | 1 | Nock The Arrow | `retranslate` | `manual-review-required` | `79ec35484fe0aab5` |
| Ruiner | Ranger (`ruiner.long-draw`) | 2 | Feather Step | `retranslate` | `manual-review-required` | `b5102328866908e9` |
| Ruiner | Ranger (`ruiner.long-draw`) | 3 | Lord Piercer [ Prepare × 3 ] | `retranslate` | `manual-review-required` | `84f710b7114793be` |
| Ruiner | Sword Caller (`ruiner.sellsword-s-call`) | 1 | A Warrior's Reprise | `retranslate` | `manual-review-required` | `9fb8d06998eb6ee7` |
| Ruiner | Sword Caller (`ruiner.sellsword-s-call`) | 2 | Warrior's Fury | `retranslate` | `manual-review-required` | `30fcd9c21142719a` |
| Ruiner | Sword Caller (`ruiner.sellsword-s-call`) | 3 | Supreme Sellsword | `retranslate` | `manual-review-required` | `290d46251f71061b` |
| Ruiner | Void Soul (`ruiner.void-soul`) | 1 | Return To Nothing | `retranslate` | `manual-review-required` | `c438c00437ca03b8` |
| Ruiner | Void Soul (`ruiner.void-soul`) | 2 | Fade Away | `retranslate` | `manual-review-required` | `69f88065cabb693d` |
| Ruiner | Void Soul (`ruiner.void-soul`) | 3 | Hollow Heart | `retranslate` | `manual-review-required` | `c2dfa862dc4c392e` |
| Ruiner | Thunder Blood (`ruiner.thunder-blood`) | 1 | Raiden | `retranslate` | `manual-review-required` | `9d0d3cf524036534` |
| Ruiner | Thunder Blood (`ruiner.thunder-blood`) | 2 | Energized Incantation | `retranslate` | `manual-review-required` | `a410d47daa6395ef` |
| Ruiner | Thunder Blood (`ruiner.thunder-blood`) | 3 | Tactical Discharge | `retranslate` | `manual-review-required` | `19f8e914e8578bfa` |
| Ruiner | Zealot (`ruiner.zealot`) | 1 | Heretical Devotion | `retranslate` | `manual-review-required` | `f94b7af40930067f` |
| Ruiner | Zealot (`ruiner.zealot`) | 2 | Freak | `retranslate` | `manual-review-required` | `f2391e7f514f4853` |
| Ruiner | Zealot (`ruiner.zealot`) | 3 | Never Meant To Be | `retranslate` | `manual-review-required` | `2a62e5f82da0f1ef` |
| Ruiner | Creator (`ruiner.creation-ascetic`) | 1 | Forming Signs | `retranslate` | `manual-review-required` | `c870835756b49cd8` |
| Ruiner | Creator (`ruiner.creation-ascetic`) | 2 | One True World | `retranslate` | `manual-review-required` | `0f74b099cefe92f2` |
| Ruiner | Creator (`ruiner.creation-ascetic`) | 3 | Labor Of The Devout [ Cast → Finisher ] | `retranslate` | `manual-review-required` | `f5d55e989a88b3ee` |
| Ruiner | Ego Arm (`ruiner.ego-arm`) | 1 | I Am Your Sword | `retranslate` | `manual-review-required` | `26a8c0c287edf904` |
| Ruiner | Ego Arm (`ruiner.ego-arm`) | 2 | Show Your Targets | `retranslate` | `manual-review-required` | `075a8dada75b7fcc` |
| Ruiner | Ego Arm (`ruiner.ego-arm`) | 3 | And I'll Become Irreplaceable | `retranslate` | `manual-review-required` | `2ad30f26699ac430` |

Всего Уровней: **333**. Автоматически перенесено из 0.9: **0**.
