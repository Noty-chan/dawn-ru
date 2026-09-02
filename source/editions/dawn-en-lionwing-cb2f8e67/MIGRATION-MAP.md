# Карта миграции DAWN 0.9 -> LionWing

> DAWN 0.9 заморожена как рабочая игровая редакция. Ни одно изменение
> LionWing не применяется к ней без явного переключателя редакции.

## Сводка машинного сравнения

- Техники: {'added': 5, 'changed': 106, 'removed': 1}.
- Слова Способностей: {'added': 35, 'unchanged': 64, 'removed': 14, 'mechanics-changed': 5}.
- Дары: {'added': 21, 'removed': 13, 'changed': 33, 'unchanged': 6}.

## Очерёдность переноса

- **P0 · builder-shell** — Complete LionWing character creation without changing 0.9 saves or budgets.
- **P0 · techniques** — Review likely mechanical field changes and create LionWing-specific adapters.
- **P0 · outlooks-abilities** — Translate new Boons, inherent Boons, Ability words, symbols, and costs.
- **P1 · core-rules** — Port Effects, Basic Actions, combat formulas, and derived statistics into a separate LionWing rules layer.
- **P2 · narrator-table** — Upgrade enemies and table automation only after the LionWing core rules are reviewed.

## Крупные разделы

| Приоритет | Раздел | Старые страницы | LionWing | Сходство |
|---|---|---:|---:|---:|
| P0 | Character Creation | 30-32 | 22-24 | 0.331 |
| P0 | Abilities and Ability Glossary | 43-44 | 45-46 | 0.575 |
| P0 | Outlooks and Boons | 47-52 | 49-54 | 0.565 |
| P1 | Combat core, Effects, and Basic Actions | 53-63 | 55-65 | 0.771 |
| P0 | Techniques | 64-100 | 67-103 | 0.792 |
| P2 | Narrator Tools | 101-126 | 104-134 | 0.628 |

## Техники, которые переводятся заново

| Stable ID | Было -> стало | Страницы | Изменённые поля |
|---|---|---:|---|
| `altruist.alchemist` | Alchemist -> Alchemist | 86 -> 88 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `altruist.artist` | Artist -> Artist | 88 -> 90 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `altruist.bardic-savant` | Bardic Savant -> Virtuoso | 88 -> 89 | name, stars, tags, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `altruist.battle-instructor` | Battle Instructor -> Battle Instructor | 84 -> 86 | tags, levels.1.text, levels.2.text, levels.3.text |
| `altruist.chronomancer` | Chronomancer -> Temporal Sage | 86 -> 89 | name, tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `altruist.dancer` | Dancer -> Dancer | 86 -> 88 | tags, levels.1.text, levels.2.text, levels.3.text |
| `altruist.deckbuilder` | Deckbuilder -> Deckbuilder | 88 -> 90 | levels.1.text, levels.2.name, levels.2.text |
| `altruist.empath` | Empath -> Empath | 84 -> 86 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `altruist.fog-walker` | Fog Walker -> Fog Walker | 86 -> 88 | tags, levels.1.text, levels.3.text |
| `altruist.gourmand` | Gourmand -> Gourmand | 84 -> 86 | tags, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `altruist.heavenly-saint` | Heavenly Saint -> Compassionate Sage | 84 -> 86 | name, tags, levels.1.text, levels.2.text, levels.3.text |
| `altruist.last-hope` | Last Hope -> Last Hope | 87 -> 89 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `altruist.precognizant` | Precognizant -> Analyst | 84 -> 86 | name, tags, flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `altruist.replicator` | Replicator -> Replicator | 87 -> 89 | tags, levels.1.text |
| `altruist.surgeon` | Surgeon -> Surgeon | 85 -> 87 | tags, levels.1.text, levels.2.text, levels.3.text |
| `altruist.talisman-caster` | Talisman Caster -> Talisman Exorcist | 85 -> 87 | name, levels.1.text, levels.2.text, levels.3.text |
| `altruist.will-o-wisp` | Will-O-Wisp -> Will-O-Wisp | 87 -> 90 | stars, tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.absolute-bastard` | Absolute Bastard -> Absolute Bastard | 80 -> 82 | levels.1.text, levels.2.text, levels.3.text |
| `bulwark.battle-jockey` | Battle Jockey -> Battle Jockey | 80 -> 82 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.beastial-ascendant` | Beastial Ascendant -> Bestial Ascendant | 82 -> 84 | name, tags, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.crusher` | Crusher -> Crusher | 79 -> 81 | tags, flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `bulwark.giant-frame` | Giant Frame -> Giant Frame | 79 -> 81 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.grappler` | Grappler -> Grappler | 80 -> 82 | flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `bulwark.guardian-angel` | Guardian Angel -> Guard Caller | 82 -> 84 | name, flavor, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.iron-bodied` | Iron Bodied -> Iron Bodied | 79 -> 81 | flavor, levels.2.text |
| `bulwark.juggernaut` | Juggernaut -> Juggernaut | 80 -> 82 | flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `bulwark.mecha-pilot` | Mecha Pilot -> Mecha Pilot | 82 -> 84 | levels.1.text, levels.2.text, levels.3.text |
| `bulwark.mundane` | Mundane -> Mundane | 81 -> 83 | tags, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.rising-challenger` | Rising Challenger -> Rising Challenger | 81 -> 83 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.runic-retribution` | Runic Retribution -> Mollycoddler | 81 -> 82 | name, tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.shield-bearer` | Shield Bearer -> Shield Bearer | 81 -> 83 | tags, levels.1.text, levels.2.text, levels.3.text |
| `bulwark.stalwart-sentry` | Stalwart Sentry -> Stalwart Sentry | 81 -> 83 | levels.1.text, levels.2.text, levels.3.text |
| `bulwark.vanguard-defender` | Vanguard Defender -> Vanguard Defender | 79 -> 81 | tags, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.autophage` | Autophage -> Autophage | 92 -> 94 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.bloodletter` | Bloodletter -> Bloodletter | 90 -> 92 | levels.1.text, levels.3.name, levels.3.text |
| `disruptor.chemist` | Chemist -> Chemist | 90 -> 92 | levels.1.text, levels.2.text, levels.3.text |
| `disruptor.constrictor` | Constrictor -> Constrictor | 90 -> 92 | levels.1.text, levels.3.text |
| `disruptor.cutpurse` | Cutpurse -> Cutpurse | 91 -> 93 | tags, flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `disruptor.earth-speaker` | Earth Speaker -> Earth Speaker | 92 -> 94 | flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `disruptor.gale-strider` | Gale Strider -> Gale Strider | 94 -> 96 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.hunter` | Hunter -> Poacher | 94 -> 96 | name, levels.1.text, levels.3.text |
| `disruptor.inhuman-strength` | Inhuman Strength -> Strongman | 92 -> 94 | name, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.inner-world` | Inner World -> Worldsmith | 94 -> 96 | name, tags, flavor, levels.1.text, levels.2.text |
| `disruptor.mage-s-array` | Mage's Array -> Jailor | 94 -> 96 | name, flavor, levels.1.name, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.mind-breaker` | Mind Breaker -> Mind Breaker | 91 -> 95 | stars, flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `disruptor.reaper` | Reaper -> Reaper | 91 -> 93 | levels.1.text, levels.2.text, levels.3.text |
| `disruptor.siren` | Siren -> Siren | 93 -> 95 | flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `disruptor.street-fighter` | Street Fighter -> Street Fighter | 92 -> 93 | stars, flavor, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.swarm-body` | Swarm Body -> SwarmKin | 93 -> 94 | name, flavor, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.tactical-master` | Tactical Master -> Tactical Master | 91 -> 87 | archetypeId, tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `disruptor.wave-rider` | Wave Rider -> Wave Rider | 93 -> 95 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.berserker` | Berserker -> Berserker | 67 -> 69 | flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `powerhouse.braggart` | Braggart -> Braggart | 69 -> 71 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.breacher` | Breacher -> Breacher | 69 -> 71 | levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.dragonslayer` | Dragonslayer -> Dragonslayer | 67 -> 69 | flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `powerhouse.dual-wielder` | Dual Wielder -> Dual Wielder | 69 -> 71 | levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.duelist` | Duelist -> Duelist | 67 -> 69 | flavor, levels.1.name, levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.flagellant` | Flagellant -> Flagellant | 67 -> 69 | flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `powerhouse.gunslinger` | Gunslinger -> Gunslinger | 67 -> 69 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.improvisational-fighter` | Improvisational Fighter -> Improvisational Fighter | 71 -> 73 | flavor, levels.1.name, levels.1.text, levels.2.name, levels.3.text |
| `powerhouse.lancer` | Lancer -> Lancer | 70 -> 72 | levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `powerhouse.martial-artist` | Martial Artist -> Martial Artist | 69 -> 72 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.monastic-sage` | Monastic Sage -> Monastic Warrior | 70 -> 72 | name, flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `powerhouse.predator` | Predator -> Predator | 70 -> 72 | flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `powerhouse.spellsword` | SpellSword -> SpellSword | 68 -> 70 | tags, flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `powerhouse.struggler` | Struggler -> Struggler | 68 -> 70 | flavor, levels.1.text, levels.2.text |
| `powerhouse.technician` | Technician -> Technician | 68 -> 70 | flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `powerhouse.unbroken` | Unbroken -> Unbroken | 68 -> 70 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `powerhouse.warring-ascendant` | Warring Ascendant -> Warring Ascendant | 71 -> 73 | flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `ruiner.bombardier` | Bombardier -> Bombardier | 96 -> 98 | tags, levels.1.text, levels.2.text, levels.3.text |
| `ruiner.creation-ascetic` | Creation Ascetic -> Creator | 100 -> 102 | name, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `ruiner.cryomancer` | Cryomancer -> Frost Veiler | 97 -> 100 | name, levels.2.text, levels.3.text |
| `ruiner.dramaturge` | Dramaturge -> Dramaturge | 97 -> 99 | levels.1.text, levels.2.text, levels.3.text |
| `ruiner.ego-arm` | Ego Arm -> Ego Arm | 100 -> 102 | levels.1.text, levels.2.text, levels.3.text |
| `ruiner.feral-arcana` | Feral Arcana -> Feral Arcanist | 97 -> 99 | name, levels.1.text, levels.2.name, levels.2.text |
| `ruiner.flame-heart` | Flame Heart -> Flame Heart | 97 -> 99 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `ruiner.grim-ascendant` | Grim Ascendant -> Grim Ascendant | 98 -> 100 | flavor, levels.1.text, levels.2.text, levels.3.text |
| `ruiner.long-draw` | Long Draw -> Ranger | 98 -> 100 | name, flavor, levels.1.text, levels.2.text, levels.3.text |
| `ruiner.mana-blades` | Mana Blades -> Blade Smith | 98 -> 99 | name, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `ruiner.rapid-fire-sorcery` | Rapid-Fire Sorcery -> Eradicator | 96 -> 98 | name, tags, flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `ruiner.ritualist` | Ritualist -> Ritualist | 96 -> 98 | tags, levels.1.text |
| `ruiner.sellsword-s-call` | Sellsword's Call -> Sword Caller | 100 -> 100 | name, stars, flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `ruiner.spellcrafter` | Spellcrafter -> Spellcrafter | 96 -> 98 | levels.1.text, levels.2.text, levels.3.text |
| `ruiner.student-of-stars` | Student Of Stars -> Student Of Stars | 96 -> 98 | tags, levels.1.name, levels.1.text, levels.2.text, levels.3.text |
| `ruiner.thunder-blood` | Thunder Blood -> Thunder Blood | 99 -> 101 | tags, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `ruiner.void-soul` | Void Soul -> Void Soul | 98 -> 101 | levels.1.text, levels.2.text, levels.3.text |
| `ruiner.zealot` | Zealot -> Zealot | 99 -> 101 | levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `vagabond.acrobat` | Acrobat -> Acrobat | 74 -> 76 | tags, levels.1.name, levels.1.text, levels.2.text, levels.3.text |
| `vagabond.aerial-master` | Aerial Master -> Aerial Master | 73 -> 75 | tags, flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `vagabond.assassin` | Assassin -> Assassin | 73 -> 75 | tags, levels.1.text, levels.3.name, levels.3.text |
| `vagabond.blade-master` | Blade Master -> Blade Master | 74 -> 76 | tags, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `vagabond.cunning-fighter` | Cunning Fighter -> Cunning Fighter | 74 -> 76 | levels.1.text, levels.2.text, levels.3.text |
| `vagabond.dim-mak` | Dim Mak -> Detective | 77 -> 79 | name, flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `vagabond.drunkard` | Drunkard -> Drunkard | 77 -> 79 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `vagabond.egomaniac` | Egomaniac -> Egomaniac | 74 -> 76 | tags, flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.text |
| `vagabond.enchained` | Enchained -> Enchained | 75 -> 77 | levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `vagabond.knife-juggler` | Knife Juggler -> Knife Juggler | 75 -> 77 | levels.1.text, levels.2.text, levels.3.text |
| `vagabond.malicious-mimic` | Malicious Mimic -> Malicious Mimic | 75 -> 77 | levels.1.text, levels.2.text, levels.3.text |
| `vagabond.master-at-arms` | Master-At-Arms -> Master-At-Arms | 77 -> 79 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `vagabond.modified-meister` | Modified Meister -> Modified Meister | 76 -> 78 | tags, flavor, levels.1.text, levels.2.text, levels.3.text |
| `vagabond.opportunist` | Opportunist -> Opportunist | 76 -> 78 | tags, levels.1.text |
| `vagabond.reflector` | Reflector -> Reflector | 76 -> 78 | tags, levels.1.text, levels.2.text, levels.3.text |
| `vagabond.skirmisher` | Skirmisher -> Skirmisher | 73 -> 75 | levels.1.text, levels.2.text, levels.3.text |
| `vagabond.sniper` | Sniper -> Sniper | 73 -> 75 | flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |
| `vagabond.speed-demon` | Speed Demon -> Speed Demon | 73 -> 75 | flavor, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `vagabond.untouchable` | Untouchable -> Untouchable | 73 -> 75 | tags, flavor, levels.1.text, levels.2.text, levels.3.name, levels.3.text |

Полные значения до/после находятся в `edition-comparison.json`.
