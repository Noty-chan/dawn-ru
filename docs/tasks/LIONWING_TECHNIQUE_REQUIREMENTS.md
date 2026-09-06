# LionWing: реестр требований и семейства

> Генерируется `node tools/content/build_lionwing_requirements.mjs`. Проверка: та же команда с `--check`.
> Черновик требований не означает сверку всех неоднозначностей, реализацию контракта или автоматизацию Техники.

Всего: 333 Уровня. Подробный ручной черновик: 44. Ещё не разобраны в этом реестре: 289.

Источники: `lionwing-technique-requirements.review.json` и `lionwing-rule-families.json` рядом с этим файлом. SHA-256 каждой разобранной строки фиксирует исходный текст, примечания и источник. Генератор не классифицирует Техники по ключевым словам.

## Семейства — предварительный план

Число потребителей ниже относится только к разобранным строкам, не ко всем 333 Уровням. Зависимости — порядок разработки контрактов; событийные связи между ними могут быть двусторонними.

| ID | Контракт | Зависимости | Разобранных потребителей |
| --- | --- | --- | ---: |
| execution | Сохранённая машина исполнения: before/replace/apply/after, выборы, вложенная цепочка и точное продолжение. | — | 21 |
| history | История, лимиты и накопление Уровней. | execution | 18 |
| costs | Расход, получение, замена и резервирование цены. | execution, history | 20 |
| health | Урон, потеря Здоровья, лечение, Раны и выбивание. | execution | 15 |
| dice | Бросок и ограниченные изменения результата. | execution | 11 |
| geometry | Общая геометрия целей, движения и тел. | execution | 18 |
| effects | Наложенные, вычисляемые, подавленные и неснимаемые Эффекты. | execution, history | 27 |
| actions | Составной план действия и композиция модификаторов. | execution, history, costs, dice, geometry | 27 |
| turns | Дополнительные действия, Реакции и прерывание Хода. | execution, history | 8 |
| entities | Принадлежащие сущности, ауры, Призывы и пилотирование. | execution, geometry, effects, turns | 7 |

## Все Уровни

| Уровень | Название | PDF | Разбор требований | Семейства |
| --- | --- | ---: | --- | --- |
| powerhouse.berserker.1 | Revenge | 69 | черновик | execution, turns, costs |
| powerhouse.berserker.2 | Cornered Dog | 69 | черновик | execution, effects, health |
| powerhouse.berserker.3 | Take A Beating | 69 | черновик | execution, history, costs, health |
| powerhouse.dragonslayer.1 | Speed Is Weight | 69 | черновик | history, actions, costs, effects, health |
| powerhouse.dragonslayer.2 | Wide Arc | 69 | черновик | actions, costs, geometry |
| powerhouse.dragonslayer.3 | Titanic Heave [ Breathe → Body Finisher ] | 69 | черновик | history, actions, dice, geometry, effects |
| powerhouse.duelist.1 | Riposte [ Block → Skirmish ] | 69 | черновик | history, actions, geometry, effects |
| powerhouse.duelist.2 | Parry | 69 | черновик | actions, health, geometry, effects |
| powerhouse.duelist.3 | Deflecting Blow | 69 | черновик | execution, actions, health, costs, effects |
| powerhouse.flagellant.1 | Thrill | 69 | черновик | execution, effects |
| powerhouse.flagellant.2 | Wild Rush | 69 | черновик | history, actions, effects, geometry, dice |
| powerhouse.flagellant.3 | Bled Dry | 69 | черновик | history, actions, effects, dice |
| powerhouse.gunslinger.1 | Big Iron | 69 | черновик | execution, history, costs, health, actions, geometry |
| powerhouse.gunslinger.2 | Lock And Load | 69 | черновик | history, costs, actions, dice |
| powerhouse.gunslinger.3 | Bullet Juggle | 69 | черновик | actions, dice, effects, health |
| powerhouse.struggler.1 | Effort | 70 | черновик | execution, dice, costs, health, effects |
| powerhouse.struggler.2 | Adrenaline | 70 | черновик | execution, history, health, geometry, effects |
| powerhouse.struggler.3 | Defy Reason | 70 | ожидает разбора | — |
| powerhouse.spellsword.1 | Twin Suns [ Cast → Skirmish ] | 70 | ожидает разбора | — |
| powerhouse.spellsword.2 | Infused Edge | 70 | ожидает разбора | — |
| powerhouse.spellsword.3 | Witch Hunter [ Cast → Body/Talent Finisher ] | 70 | ожидает разбора | — |
| powerhouse.technician.1 | Stretch | 70 | ожидает разбора | — |
| powerhouse.technician.2 | Perfect Form | 70 | ожидает разбора | — |
| powerhouse.technician.3 | Final Blow [ Skirmish → Finisher ] | 70 | ожидает разбора | — |
| powerhouse.unbroken.1 | Get Back Up | 70 | ожидает разбора | — |
| powerhouse.unbroken.2 | Furious Revival | 70 | ожидает разбора | — |
| powerhouse.unbroken.3 | Phoenix | 70 | ожидает разбора | — |
| powerhouse.braggart.1 | Hubris | 71 | ожидает разбора | — |
| powerhouse.braggart.2 | Prove Yourself | 71 | ожидает разбора | — |
| powerhouse.braggart.3 | A Worthy Opponent | 71 | ожидает разбора | — |
| powerhouse.breacher.1 | Buck Shot | 71 | ожидает разбора | — |
| powerhouse.breacher.2 | Both Barrels | 71 | ожидает разбора | — |
| powerhouse.breacher.3 | Annihilate | 71 | ожидает разбора | — |
| powerhouse.dual-wielder.1 | Twinned blow | 71 | ожидает разбора | — |
| powerhouse.dual-wielder.2 | Frenzied Barrage | 71 | ожидает разбора | — |
| powerhouse.dual-wielder.3 | Varied Blades | 71 | ожидает разбора | — |
| powerhouse.intimidator.1 | "Pathetic" | 71 | ожидает разбора | — |
| powerhouse.intimidator.2 | "Out Of My Way" | 71 | ожидает разбора | — |
| powerhouse.intimidator.3 | "Fools And Dead Men" | 71 | ожидает разбора | — |
| powerhouse.martial-artist.1 | Art Of The 8 Hammers | 72 | ожидает разбора | — |
| powerhouse.martial-artist.2 | Flow-State | 72 | ожидает разбора | — |
| powerhouse.martial-artist.3 | Unlimited Blows | 72 | ожидает разбора | — |
| powerhouse.monastic-sage.1 | Mind Made Manifest | 72 | ожидает разбора | — |
| powerhouse.monastic-sage.2 | Calm Within Chaos | 72 | ожидает разбора | — |
| powerhouse.monastic-sage.3 | Sublime Equanimity | 72 | ожидает разбора | — |
| powerhouse.lancer.1 | Pierce | 72 | ожидает разбора | — |
| powerhouse.lancer.2 | Phalanx | 72 | ожидает разбора | — |
| powerhouse.lancer.3 | Cannon-Arm [ Breathe → Skirmish ] | 72 | ожидает разбора | — |
| powerhouse.predator.1 | Yearn | 72 | ожидает разбора | — |
| powerhouse.predator.2 | Obsess | 72 | ожидает разбора | — |
| powerhouse.predator.3 | Envelop | 72 | ожидает разбора | — |
| powerhouse.improvisational-fighter.1 | "This'll Do" | 73 | ожидает разбора | — |
| powerhouse.improvisational-fighter.2 | "That One Hurts!" | 73 | ожидает разбора | — |
| powerhouse.improvisational-fighter.3 | Last Resort | 73 | ожидает разбора | — |
| powerhouse.warring-ascendant.1 | Heavenly Arm | 73 | ожидает разбора | — |
| powerhouse.warring-ascendant.2 | Esoteric Blades | 73 | ожидает разбора | — |
| powerhouse.warring-ascendant.3 | Saintly Sword, Heaven Piercer | 73 | ожидает разбора | — |
| powerhouse.heroic-ascendant.1 | Warrior Of Legend | 73 | ожидает разбора | — |
| powerhouse.heroic-ascendant.2 | Hero's Feat | 73 | ожидает разбора | — |
| powerhouse.heroic-ascendant.3 | Mastered Strength | 73 | ожидает разбора | — |
| vagabond.aerial-master.1 | Soar | 75 | ожидает разбора | — |
| vagabond.aerial-master.2 | Hunt | 75 | ожидает разбора | — |
| vagabond.aerial-master.3 | Falling Ax Strike | 75 | ожидает разбора | — |
| vagabond.assassin.1 | Ambush | 75 | черновик | history, costs, actions |
| vagabond.assassin.2 | Assassinate | 75 | черновик | actions, dice, effects, geometry |
| vagabond.assassin.3 | Speed of Dark [ Hide → Stride ] | 75 | черновик | history, actions, effects, costs |
| vagabond.sniper.1 | Long Shot | 75 | ожидает разбора | — |
| vagabond.sniper.2 | Bunker Down | 75 | ожидает разбора | — |
| vagabond.sniper.3 | Deadeye [ Hide → Talent Finisher ] | 75 | ожидает разбора | — |
| vagabond.skirmisher.1 | Sting | 75 | ожидает разбора | — |
| vagabond.skirmisher.2 | Shifting Blows | 75 | ожидает разбора | — |
| vagabond.skirmisher.3 | Rebound | 75 | ожидает разбора | — |
| vagabond.speed-demon.1 | Fade | 75 | ожидает разбора | — |
| vagabond.speed-demon.2 | Flash Strike | 75 | ожидает разбора | — |
| vagabond.speed-demon.3 | Flash Step [ Breathe → Stride ] | 75 | ожидает разбора | — |
| vagabond.untouchable.1 | Duck | 75 | ожидает разбора | — |
| vagabond.untouchable.2 | Weave | 75 | ожидает разбора | — |
| vagabond.untouchable.3 | Fighter's Instinct [ Dodge → Skirmish ] | 75 | ожидает разбора | — |
| vagabond.acrobat.1 | Flying Kick [ Jump → Skirmish ] | 76 | ожидает разбора | — |
| vagabond.acrobat.2 | Wall Jump | 76 | ожидает разбора | — |
| vagabond.acrobat.3 | Weightless Body | 76 | ожидает разбора | — |
| vagabond.blade-master.1 | Draw Stance | 76 | ожидает разбора | — |
| vagabond.blade-master.2 | Divide In One Motion [ Breathe → Jump ] | 76 | ожидает разбора | — |
| vagabond.blade-master.3 | Leaping Koi | 76 | ожидает разбора | — |
| vagabond.cunning-fighter.1 | Plan and Execute | 76 | ожидает разбора | — |
| vagabond.cunning-fighter.2 | Plans Within Plans | 76 | ожидает разбора | — |
| vagabond.cunning-fighter.3 | At a Glance | 76 | ожидает разбора | — |
| vagabond.egomaniac.1 | Peak Condition | 76 | ожидает разбора | — |
| vagabond.egomaniac.2 | Dance With Me | 76 | ожидает разбора | — |
| vagabond.egomaniac.3 | Finale | 76 | ожидает разбора | — |
| vagabond.enchained.1 | Hook Shot | 77 | ожидает разбора | — |
| vagabond.enchained.2 | Draw In | 77 | ожидает разбора | — |
| vagabond.enchained.3 | Momentum [ Cast → Skirmish ] | 77 | ожидает разбора | — |
| vagabond.knife-juggler.1 | Throw | 77 | ожидает разбора | — |
| vagabond.knife-juggler.2 | Resupply | 77 | ожидает разбора | — |
| vagabond.knife-juggler.3 | Chaser | 77 | ожидает разбора | — |
| vagabond.malicious-mimic.1 | "Anything You Can Do…" | 77 | ожидает разбора | — |
| vagabond.malicious-mimic.2 | Rehearsed Movements | 77 | ожидает разбора | — |
| vagabond.malicious-mimic.3 | "…I Can Do Better" | 77 | ожидает разбора | — |
| vagabond.weaponsmith.1 | Trick Weapon | 78 | ожидает разбора | — |
| vagabond.weaponsmith.2 | Adaptive Edge | 78 | ожидает разбора | — |
| vagabond.weaponsmith.3 | Metalurgy | 78 | ожидает разбора | — |
| vagabond.modified-meister.1 | Running Hot | 78 | ожидает разбора | — |
| vagabond.modified-meister.2 | Overload | 78 | ожидает разбора | — |
| vagabond.modified-meister.3 | Overclock | 78 | ожидает разбора | — |
| vagabond.opportunist.1 | Pack Tactics | 78 | ожидает разбора | — |
| vagabond.opportunist.2 | Hungry Eyes | 78 | ожидает разбора | — |
| vagabond.opportunist.3 | Launcher Combo | 78 | ожидает разбора | — |
| vagabond.reflector.1 | Catch The Blade | 78 | ожидает разбора | — |
| vagabond.reflector.2 | Watch And Wait | 78 | ожидает разбора | — |
| vagabond.reflector.3 | To Carry Their Fury | 78 | ожидает разбора | — |
| vagabond.dim-mak.1 | Study Weakness | 79 | ожидает разбора | — |
| vagabond.dim-mak.2 | Dissect [ Investigate x 3 ] | 79 | ожидает разбора | — |
| vagabond.dim-mak.3 | 4-Point Execution | 79 | ожидает разбора | — |
| vagabond.drunkard.1 | Down The Hatch | 79 | ожидает разбора | — |
| vagabond.drunkard.2 | Fool's Dance | 79 | ожидает разбора | — |
| vagabond.drunkard.3 | Chug | 79 | ожидает разбора | — |
| vagabond.master-at-arms.1 | Multi-Faceted | 79 | ожидает разбора | — |
| vagabond.master-at-arms.2 | Like Water | 79 | ожидает разбора | — |
| vagabond.master-at-arms.3 | Master At Work | 79 | ожидает разбора | — |
| bulwark.crusher.1 | 30,000 Tons | 81 | ожидает разбора | — |
| bulwark.crusher.2 | Hammerfall | 81 | ожидает разбора | — |
| bulwark.crusher.3 | "You Look Like A Nail" | 81 | ожидает разбора | — |
| bulwark.giant-frame.1 | Big Arms | 81 | ожидает разбора | — |
| bulwark.giant-frame.2 | Immense | 81 | ожидает разбора | — |
| bulwark.giant-frame.3 | Shockwave | 81 | ожидает разбора | — |
| bulwark.iron-bodied.1 | Tough As Stone | 81 | ожидает разбора | — |
| bulwark.iron-bodied.2 | Resilience | 81 | ожидает разбора | — |
| bulwark.iron-bodied.3 | Stainless Stride | 81 | ожидает разбора | — |
| bulwark.vanguard-defender.1 | White Knight | 81 | ожидает разбора | — |
| bulwark.vanguard-defender.2 | Steel Angel | 81 | ожидает разбора | — |
| bulwark.vanguard-defender.3 | Inspire Courage | 81 | ожидает разбора | — |
| bulwark.absolute-bastard.1 | Easy To Hate | 82 | ожидает разбора | — |
| bulwark.absolute-bastard.2 | Bully | 82 | ожидает разбора | — |
| bulwark.absolute-bastard.3 | Add Injury To Insult | 82 | ожидает разбора | — |
| bulwark.battle-jockey.1 | Trusty Steed | 82 | ожидает разбора | — |
| bulwark.battle-jockey.2 | Grasping Jaws | 82 | ожидает разбора | — |
| bulwark.battle-jockey.3 | Roaring Entry | 82 | ожидает разбора | — |
| bulwark.grappler.1 | Restrain | 82 | ожидает разбора | — |
| bulwark.grappler.2 | Spine Breaker | 82 | ожидает разбора | — |
| bulwark.grappler.3 | Finishing Move [ Body Finisher → Jump ] | 82 | ожидает разбора | — |
| bulwark.juggernaut.1 | Wild Charge | 82 | ожидает разбора | — |
| bulwark.juggernaut.2 | Violence | 82 | ожидает разбора | — |
| bulwark.juggernaut.3 | "Eat Dirt!" | 82 | ожидает разбора | — |
| bulwark.runic-retribution.1 | Lash | 82 | ожидает разбора | — |
| bulwark.runic-retribution.2 | Loving Rite | 82 | ожидает разбора | — |
| bulwark.runic-retribution.3 | Devotion | 82 | ожидает разбора | — |
| bulwark.mundane.1 | For What The Spirit Lacks | 83 | ожидает разбора | — |
| bulwark.mundane.2 | Dig Deep, Stand Firm | 83 | ожидает разбора | — |
| bulwark.mundane.3 | In The Face Of The Beyond | 83 | ожидает разбора | — |
| bulwark.rising-challenger.1 | Perfect Deflection | 83 | ожидает разбора | — |
| bulwark.rising-challenger.2 | "You'll Have To Get Through Me!" | 83 | ожидает разбора | — |
| bulwark.rising-challenger.3 | Drama And Spite | 83 | ожидает разбора | — |
| bulwark.shield-bearer.1 | Wall | 83 | ожидает разбора | — |
| bulwark.shield-bearer.2 | Shield Charge | 83 | ожидает разбора | — |
| bulwark.shield-bearer.3 | Focused Defense | 83 | ожидает разбора | — |
| bulwark.stalwart-sentry.1 | Guardian | 83 | ожидает разбора | — |
| bulwark.stalwart-sentry.2 | On Watch | 83 | ожидает разбора | — |
| bulwark.stalwart-sentry.3 | Zone Of Influence | 83 | ожидает разбора | — |
| bulwark.beastial-ascendant.1 | Beastly | 84 | ожидает разбора | — |
| bulwark.beastial-ascendant.2 | Inheritance | 84 | ожидает разбора | — |
| bulwark.beastial-ascendant.3 | Apex | 84 | ожидает разбора | — |
| bulwark.guardian-angel.1 | Two Bodies | 84 | ожидает разбора | — |
| bulwark.guardian-angel.2 | Together In Life | 84 | ожидает разбора | — |
| bulwark.guardian-angel.3 | Together In Death | 84 | ожидает разбора | — |
| bulwark.mecha-pilot.1 | Rune Core Engine | 84 | черновик | entities, geometry, actions, execution, history |
| bulwark.mecha-pilot.2 | Autonomous | 84 | черновик | entities, turns, actions, execution |
| bulwark.mecha-pilot.3 | Perfect Sync | 84 | черновик | entities, turns, effects, geometry |
| altruist.precognizant.1 | Flash Of Insight | 86 | ожидает разбора | — |
| altruist.precognizant.2 | Take Advantage | 86 | ожидает разбора | — |
| altruist.precognizant.3 | Watch And Wait | 86 | ожидает разбора | — |
| altruist.battle-instructor.1 | Strike Order | 86 | ожидает разбора | — |
| altruist.battle-instructor.2 | Teaching Moment | 86 | ожидает разбора | — |
| altruist.battle-instructor.3 | Remember Your Training | 86 | ожидает разбора | — |
| altruist.empath.1 | Calming Aura | 86 | ожидает разбора | — |
| altruist.empath.2 | Protective Response | 86 | ожидает разбора | — |
| altruist.empath.3 | "Are You Ok?" | 86 | ожидает разбора | — |
| altruist.heavenly-saint.1 | Strength Of Prayer | 86 | ожидает разбора | — |
| altruist.heavenly-saint.2 | Cleansing Light | 86 | ожидает разбора | — |
| altruist.heavenly-saint.3 | Grand Restoration | 86 | ожидает разбора | — |
| altruist.gourmand.1 | Healthy Meal | 86 | ожидает разбора | — |
| altruist.gourmand.2 | Fast Food | 86 | ожидает разбора | — |
| altruist.gourmand.3 | Shared Experiences | 86 | ожидает разбора | — |
| altruist.surgeon.1 | Do No Harm | 87 | ожидает разбора | — |
| altruist.surgeon.2 | Operational Procedure | 87 | ожидает разбора | — |
| altruist.surgeon.3 | Miracle Worker | 87 | ожидает разбора | — |
| disruptor.tactical-master.1 | Stop And Think | 87 | ожидает разбора | — |
| disruptor.tactical-master.2 | Study | 87 | ожидает разбора | — |
| disruptor.tactical-master.3 | Eureka! | 87 | ожидает разбора | — |
| altruist.talisman-caster.1 | Sacred Seal | 87 | ожидает разбора | — |
| altruist.talisman-caster.2 | Tossed Talisman | 87 | ожидает разбора | — |
| altruist.talisman-caster.3 | Exorcize | 87 | ожидает разбора | — |
| altruist.abjuring-sage.1 | Barrier | 88 | ожидает разбора | — |
| altruist.abjuring-sage.2 | Impenetrable | 88 | ожидает разбора | — |
| altruist.abjuring-sage.3 | Block Beam | 88 | ожидает разбора | — |
| altruist.alchemist.1 | Quick Mix | 88 | ожидает разбора | — |
| altruist.alchemist.2 | Powerful Mix | 88 | ожидает разбора | — |
| altruist.alchemist.3 | High Intensity Mix | 88 | ожидает разбора | — |
| altruist.dancer.1 | Dance Partner | 88 | ожидает разбора | — |
| altruist.dancer.2 | Hearts In Tandem | 88 | ожидает разбора | — |
| altruist.dancer.3 | The Prestige | 88 | ожидает разбора | — |
| altruist.fog-walker.1 | Blowing Smoke | 88 | ожидает разбора | — |
| altruist.fog-walker.2 | Mystic Mist | 88 | ожидает разбора | — |
| altruist.fog-walker.3 | Stinging Steam | 88 | ожидает разбора | — |
| altruist.last-hope.1 | Notably Absent | 89 | черновик | turns, actions, effects |
| altruist.last-hope.2 | Heroic Return | 89 | черновик | turns, geometry, effects |
| altruist.last-hope.3 | Explosive Return | 89 | черновик | execution, turns |
| altruist.replicator.1 | Echo Form | 89 | ожидает разбора | — |
| altruist.replicator.2 | Symmetry | 89 | ожидает разбора | — |
| altruist.replicator.3 | Full Sync | 89 | ожидает разбора | — |
| altruist.chronomancer.1 | Accelerate | 89 | черновик | execution, actions, health, geometry, effects |
| altruist.chronomancer.2 | Decelerate | 89 | черновик | effects, execution, costs, dice |
| altruist.chronomancer.3 | Time Stop | 89 | черновик | history, costs, execution, turns, actions, health |
| altruist.bardic-savant.1 | Musician | 89 | ожидает разбора | — |
| altruist.bardic-savant.2 | Reverb | 89 | ожидает разбора | — |
| altruist.bardic-savant.3 | Encore | 89 | ожидает разбора | — |
| altruist.artist.1 | Stroke Of The Brush | 90 | ожидает разбора | — |
| altruist.artist.2 | Canvas Of Flesh | 90 | ожидает разбора | — |
| altruist.artist.3 | Brush-Brand | 90 | ожидает разбора | — |
| altruist.deckbuilder.1 | Draw | 90 | ожидает разбора | — |
| altruist.deckbuilder.2 | Card Capture | 90 | ожидает разбора | — |
| altruist.deckbuilder.3 | Greed | 90 | ожидает разбора | — |
| altruist.will-o-wisp.1 | Spirit Weaving Flame | 90 | черновик | entities, effects, geometry, execution, history |
| altruist.will-o-wisp.2 | Friendly Spirits | 90 | черновик | entities, execution, geometry, costs |
| altruist.will-o-wisp.3 | Twinned Spirits | 90 | черновик | entities, effects |
| disruptor.bloodletter.1 | Bleeding Edge | 92 | ожидает разбора | — |
| disruptor.bloodletter.2 | Bloodhound | 92 | ожидает разбора | — |
| disruptor.bloodletter.3 | Rupture [ Skirmish → Breathe ] | 92 | ожидает разбора | — |
| disruptor.chemist.1 | Sublimation | 92 | ожидает разбора | — |
| disruptor.chemist.2 | Experimental Mixture | 92 | ожидает разбора | — |
| disruptor.chemist.3 | Deposition | 92 | ожидает разбора | — |
| disruptor.constrictor.1 | Wrap | 92 | ожидает разбора | — |
| disruptor.constrictor.2 | Choke | 92 | ожидает разбора | — |
| disruptor.constrictor.3 | Twisting Impact | 92 | ожидает разбора | — |
| disruptor.cutpurse.1 | Fast Hands | 93 | ожидает разбора | — |
| disruptor.cutpurse.2 | Snatch | 93 | ожидает разбора | — |
| disruptor.cutpurse.3 | Rob Them Blind | 93 | ожидает разбора | — |
| disruptor.light-bender.1 | Blendendes Licht | 93 | ожидает разбора | — |
| disruptor.light-bender.2 | Sonneneruption | 93 | ожидает разбора | — |
| disruptor.light-bender.3 | Falscher Stern | 93 | ожидает разбора | — |
| disruptor.reaper.1 | Sow | 93 | ожидает разбора | — |
| disruptor.reaper.2 | Tend | 93 | ожидает разбора | — |
| disruptor.reaper.3 | Reap | 93 | ожидает разбора | — |
| disruptor.street-fighter.1 | Bloody Brass | 93 | ожидает разбора | — |
| disruptor.street-fighter.2 | Break And Bruise | 93 | ожидает разбора | — |
| disruptor.street-fighter.3 | Brutalize | 93 | ожидает разбора | — |
| disruptor.autophage.1 | Transfusion | 94 | черновик | costs, health, effects, history |
| disruptor.autophage.2 | Overexert | 94 | черновик | health, dice, effects, execution |
| disruptor.autophage.3 | Born Of Mutable Flesh | 94 | черновик | actions, execution, history |
| disruptor.earth-speaker.1 | Stone Soldiers | 94 | ожидает разбора | — |
| disruptor.earth-speaker.2 | Tectonic Shift | 94 | ожидает разбора | — |
| disruptor.earth-speaker.3 | Earthen Shards | 94 | ожидает разбора | — |
| disruptor.inhuman-strength.1 | Strong-Arm | 94 | ожидает разбора | — |
| disruptor.inhuman-strength.2 | Piston Fist | 94 | ожидает разбора | — |
| disruptor.inhuman-strength.3 | Smash Through | 94 | ожидает разбора | — |
| disruptor.swarm-body.1 | Fluttering Form | 94 | ожидает разбора | — |
| disruptor.swarm-body.2 | Vanish Into Flies | 94 | ожидает разбора | — |
| disruptor.swarm-body.3 | Devour | 94 | ожидает разбора | — |
| disruptor.siren.1 | "You wouldn't hurt ME, would you?" | 95 | ожидает разбора | — |
| disruptor.siren.2 | "I'm Irresistible!" | 95 | ожидает разбора | — |
| disruptor.siren.3 | "A little help over here?" | 95 | ожидает разбора | — |
| disruptor.wave-rider.1 | Gentle Waves | 95 | ожидает разбора | — |
| disruptor.wave-rider.2 | Momentous Waves | 95 | ожидает разбора | — |
| disruptor.wave-rider.3 | Aqua Cage | 95 | ожидает разбора | — |
| disruptor.mind-breaker.1 | "Where Are You?" | 95 | ожидает разбора | — |
| disruptor.mind-breaker.2 | "Where Am I?" | 95 | ожидает разбора | — |
| disruptor.mind-breaker.3 | "Who Are They?" | 95 | ожидает разбора | — |
| disruptor.gale-strider.1 | Growing Winds | 96 | ожидает разбора | — |
| disruptor.gale-strider.2 | Updraft | 96 | ожидает разбора | — |
| disruptor.gale-strider.3 | Mountain Carver | 96 | ожидает разбора | — |
| disruptor.hunter.1 | Steel Jaws | 96 | ожидает разбора | — |
| disruptor.hunter.2 | Far Setting | 96 | ожидает разбора | — |
| disruptor.hunter.3 | Pit Trap | 96 | ожидает разбора | — |
| disruptor.mage-s-array.1 | Erect | 96 | ожидает разбора | — |
| disruptor.mage-s-array.2 | Readjust | 96 | ожидает разбора | — |
| disruptor.mage-s-array.3 | Prison Of Your Own Design | 96 | ожидает разбора | — |
| disruptor.inner-world.1 | Gaze Deeply | 96 | ожидает разбора | — |
| disruptor.inner-world.2 | Domain Of Control | 96 | ожидает разбора | — |
| disruptor.inner-world.3 | Home Turf | 96 | ожидает разбора | — |
| ruiner.bombardier.1 | Explosion!! | 98 | ожидает разбора | — |
| ruiner.bombardier.2 | Explosion!!! | 98 | ожидает разбора | — |
| ruiner.bombardier.3 | EXPLOSION!!!! | 98 | ожидает разбора | — |
| ruiner.rapid-fire-sorcery.1 | Proliferate | 98 | ожидает разбора | — |
| ruiner.rapid-fire-sorcery.2 | Scorched Earth | 98 | ожидает разбора | — |
| ruiner.rapid-fire-sorcery.3 | Endless Fire [ Charge → Cast ] | 98 | ожидает разбора | — |
| ruiner.ritualist.1 | Ley Lines | 98 | ожидает разбора | — |
| ruiner.ritualist.2 | Arcane Artillery | 98 | ожидает разбора | — |
| ruiner.ritualist.3 | Fractal Etchings | 98 | ожидает разбора | — |
| ruiner.spellcrafter.1 | Experimentation | 98 | черновик | actions, geometry, costs |
| ruiner.spellcrafter.2 | Solidification | 98 | черновик | costs, actions |
| ruiner.spellcrafter.3 | Finalization | 98 | черновик | actions, costs, geometry |
| ruiner.student-of-stars.1 | Power Unleashed [ Charge → Finisher ] | 98 | ожидает разбора | — |
| ruiner.student-of-stars.2 | Formless Strength | 98 | ожидает разбора | — |
| ruiner.student-of-stars.3 | Moment Of Truth | 98 | ожидает разбора | — |
| ruiner.mana-blades.1 | Call Arms | 99 | ожидает разбора | — |
| ruiner.mana-blades.2 | Blade Storm | 99 | ожидает разбора | — |
| ruiner.mana-blades.3 | Saintly Sword, Excalibur | 99 | ожидает разбора | — |
| ruiner.dramaturge.1 | All Eyes On Me | 99 | ожидает разбора | — |
| ruiner.dramaturge.2 | Snatch Their Fire | 99 | ожидает разбора | — |
| ruiner.dramaturge.3 | Power In Presentation | 99 | ожидает разбора | — |
| ruiner.feral-arcana.1 | Vorpal Claw | 99 | ожидает разбора | — |
| ruiner.feral-arcana.2 | Unchain [ Charge → Interact] | 99 | ожидает разбора | — |
| ruiner.feral-arcana.3 | Grasp | 99 | ожидает разбора | — |
| ruiner.flame-heart.1 | Rev Up | 99 | ожидает разбора | — |
| ruiner.flame-heart.2 | Damning Impact | 99 | ожидает разбора | — |
| ruiner.flame-heart.3 | Ashes To Ashes | 99 | ожидает разбора | — |
| ruiner.cryomancer.1 | Chill | 100 | черновик | actions, effects |
| ruiner.cryomancer.2 | Icicle Halo | 100 | черновик | dice, costs, history, execution, health, effects |
| ruiner.cryomancer.3 | Shatter | 100 | черновик | actions, health, effects, geometry, execution |
| ruiner.grim-ascendant.1 | Impermanent Power | 100 | ожидает разбора | — |
| ruiner.grim-ascendant.2 | Drain Life | 100 | ожидает разбора | — |
| ruiner.grim-ascendant.3 | Umbra | 100 | ожидает разбора | — |
| ruiner.long-draw.1 | Nock The Arrow | 100 | ожидает разбора | — |
| ruiner.long-draw.2 | Feather Step | 100 | ожидает разбора | — |
| ruiner.long-draw.3 | Lord Piercer [ Prepare × 3 ] | 100 | ожидает разбора | — |
| ruiner.sellsword-s-call.1 | A Warrior's Reprise | 100 | ожидает разбора | — |
| ruiner.sellsword-s-call.2 | Warrior's Fury | 100 | ожидает разбора | — |
| ruiner.sellsword-s-call.3 | Supreme Sellsword | 100 | ожидает разбора | — |
| ruiner.void-soul.1 | Return To Nothing | 101 | ожидает разбора | — |
| ruiner.void-soul.2 | Fade Away | 101 | ожидает разбора | — |
| ruiner.void-soul.3 | Hollow Heart | 101 | ожидает разбора | — |
| ruiner.thunder-blood.1 | Raiden | 101 | ожидает разбора | — |
| ruiner.thunder-blood.2 | Energized Incantation | 101 | ожидает разбора | — |
| ruiner.thunder-blood.3 | Tactical Discharge | 101 | ожидает разбора | — |
| ruiner.zealot.1 | Heretical Devotion | 101 | черновик | dice, history, costs, actions |
| ruiner.zealot.2 | Freak | 101 | черновик | turns, effects |
| ruiner.zealot.3 | Never Meant To Be | 101 | черновик | geometry, entities, execution, actions, costs |
| ruiner.creation-ascetic.1 | Forming Signs | 102 | ожидает разбора | — |
| ruiner.creation-ascetic.2 | One True World | 102 | ожидает разбора | — |
| ruiner.creation-ascetic.3 | Labor Of The Devout [ Cast → Finisher ] | 102 | ожидает разбора | — |
| ruiner.ego-arm.1 | I Am Your Sword | 102 | ожидает разбора | — |
| ruiner.ego-arm.2 | Show Your Targets | 102 | ожидает разбора | — |
| ruiner.ego-arm.3 | And I'll Become Irreplaceable | 102 | ожидает разбора | — |

## Неразрешённые вопросы черновика

- **powerhouse.berserker.1**: Это лимит расхода существующих ОД или отдельный бюджет? Требуется сверка общего правила действий вне Хода.
- **powerhouse.berserker.2**: Порядок нескольких доступных замен одного последствия должен быть явным.
- **powerhouse.berserker.3**: Точная очередность Зарядки, получения Фокуса и Раны должна быть сверена
- **powerhouse.berserker.3**: не фиксировать по порядку JS-обработчиков.
- **vagabond.assassin.3**: Когда фиксируется Speed для отложенного бонуса?
- **altruist.last-hope.1**: Уточнить получателей множественного allies и интерфейс выбора.
- **altruist.last-hope.2**: Поведение специальных Изгнания/Исчезновения при неснимаемости требует явной трактовки.
- **altruist.will-o-wisp.1**: Когда выбирается свойство и когда исчезает маркер: сверить общие правила Призывов/маркеров.
- **disruptor.autophage.1**: Когда фиксируется число Эффектов цели: начало или завершение Атаки?
- **disruptor.autophage.1**: Поведение цены Здоровьем на пороге Раны требует канонического контракта.
- **disruptor.autophage.2**: При нескольких целях Атаки что означает your target?
- **disruptor.autophage.2**: Сырой D6 не считать обычной Проверкой без сверки.
- **disruptor.autophage.3**: Текст меняет цели after use: нужно явно определить окно до последствий, не ретроактивно менять уже нанесённый урон.
- **ruiner.spellcrafter.3**: Правило совмещения Line и Zone не задано явно: нужен выбор Нарратора, не случайный порядок.
- **ruiner.cryomancer.1**: Зафиксировать значение successful относительно попадания и нулевого урона.
- **ruiner.cryomancer.2**: Нужно определить область action для получения вне действия, не выдумывая лимит на весь Ход.
- **bulwark.mecha-pilot.1**: NPC при входе и Obstacle при выходе: сохранить тип как неоднозначность
- **bulwark.mecha-pilot.1**: размещение as close as possible требует алгоритма и разрешения равенства.
- **bulwark.mecha-pilot.2**: Как сохраняются размер и Здоровье I после смены профиля?
- **bulwark.mecha-pilot.2**: Кто платит за заменяющую Стычку?
- **altruist.chronomancer.1**: Would-deal до или после защиты? Должно быть явно определено.
- **altruist.chronomancer.2**: Источник и срок восстановленного Эффекта должны быть определены
- **altruist.chronomancer.2**: триггер на вычисляемую ауру требует отдельной трактовки.
- **altruist.chronomancer.3**: Все ОД при 0 ОД: допустимость не решать автоматически без трактовки.
- **ruiner.zealot.1**: Отрицательный результат формулы: сверить общее правило минимума
- **ruiner.zealot.1**: область лимита для броска вне Действия.
- **ruiner.zealot.3**: Порядок урона Finisher и сдвига/удаления надо сверить
- **ruiner.zealot.3**: порядок конкуренции с расходом одного сегмента из I.
- **powerhouse.flagellant.2**: Если другой механизм заменяет обязательное получение Эффекта, сохраняется ли право на движение? Не решать молча.
- **powerhouse.flagellant.3**: Когда фиксировать число Эффектов, если оно меняется во время Реакций?
- **powerhouse.flagellant.3**: При разных бросках по целям какие Криты задают предел снятия?
- **powerhouse.dragonslayer.1**: При нескольких целях применяется ли Разорван ко всем?
- **powerhouse.dragonslayer.1**: Можно ли потратить получаемые 2 Фокуса на это же Завершение или оплата уже завершена?
- **powerhouse.dragonslayer.2**: Как правило взаимодействует с заменой Фокуса альтернативным ресурсом? Не подменять число оплаченных единиц автоматически.
- **powerhouse.dragonslayer.3**: Сохраняются ли обычные Криты и дополнительные кости при подсчёте всех костей Успехами? Проверить общий раздел бросков.
- **powerhouse.dragonslayer.3**: Точный порядок толчка относительно отдельных нанесений по цели требует общей нормы.
- **powerhouse.duelist.1**: Текст не уточняет момент Провокации относительно урона и зависимость от попадания; сверить общее правило Эффектов Атаки.
- **powerhouse.duelist.1**: Фраза move 3 spaces задаёт максимум или обязательную длину?
- **powerhouse.duelist.2**: Когда фиксировать смежность и Напряжение при вложенных Реакциях?
- **powerhouse.duelist.2**: Кто выбирает клетку перенаправленного толчка?
- **powerhouse.duelist.3**: Стычка включена в цену 1 Фокус или оплачивается отдельно?
- **powerhouse.duelist.3**: Порог проверяется после Блока или после всех защит, включая Уклонение?
- **powerhouse.duelist.3**: При повторном уроне одной Атаки окно одно или на каждое нанесение?
- **powerhouse.gunslinger.1**: Можно ли направить несколько Пуль в одну цель?
- **powerhouse.gunslinger.1**: Что делать со Стычкой, если Пули потрачены, но никто не получил фактический урон?
- **powerhouse.gunslinger.1**: В каком порядке выбрать цели Пуль и подтвердить оплату Стычки?
- **powerhouse.gunslinger.2**: Установка Пуль в 6 считается получением ресурса для сторонних срабатываний или отдельной установкой?
- **powerhouse.gunslinger.3**: Цель Подброса обязательно из целей Атаки или любой персонаж?
- **powerhouse.gunslinger.3**: Момент Подброса относительно урона Атаки не указан.
- **powerhouse.gunslinger.3**: Как считать порог при отдельных пулах разных целей?
- **powerhouse.struggler.1**: Можно ли применять к нескольким костям одного броска?
- **powerhouse.struggler.1**: Даёт ли созданный заменой Крит дополнительную кость?
- **powerhouse.struggler.1**: Включает ли Challenge roll атакующие и встречные броски по общей терминологии?
- **powerhouse.struggler.2**: Должен ли каждый сегмент пути приближать к выбранному врагу или достаточно конечной клетки?
- **powerhouse.struggler.2**: Можно ли при исходной смежности не двигаться и всё же наложить Помечен?

Статусы автоматизации в `apps/companion/LIONWING-AUTOMATION-MAP.md` этот реестр не меняет.
