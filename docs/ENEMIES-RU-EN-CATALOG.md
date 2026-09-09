# DAWN: каталог способностей врагов RU/EN

> Сгенерировано `npm run docs:rules` из новой канонической редакции `apps/companion/edition-lionwing.js` и RU-оверлея `apps/companion/edition-lionwing-ru.js` (SHA-256 `45f7482557e5ab8bc30d8c7b846e2dd66df27278218054174b8711f84a945de6`).
> Английский текст и механика берутся из canonical EN; русские названия и тексты — из отдельного reviewed RU overlay. Legacy-редакция в этот документ не входит.

## Область каталога

Включены 41 canonical EN NPC-профилей и 122 их правил. Для новой редакции все такие правила пока имеют статус assisted; старые профили, модификаторы и Черточки Антагониста сюда не переносятся.

## Базовые термины врагов

| Русский | English | Базовый смысл |
| --- | --- | --- |
| Обычный враг | common enemy | Профиль противника со статами, пассивом и правилами; формулы масштабируются по Ступени. |
| Враг-модификатор | enemy modifier | Дополнение к профилю/боевой сцене; в текущих данных не содержит отдельных `rules`. |
| Именованный враг | named enemy | Конкретный профиль с собственными правилами и иногда призывами. |
| Черта Антагониста | Antagonist Edge | Набор реакций/триггеров для важного врага; лимитируется Антагонизмом по базовым правилам. |
| Действие / Атака / Козырь | Action / Attack / Trump | Тип активации; Козырь дополнительно требует порог Напряжения и обычно стоит 2 ОД. |
| Награда | Reward | Последствие успешной атаки после броска и реакций. |
| `X(+Y)` | tier formula | Значение X на Ступени 1, плюс Y за каждую следующую Ступень. |
| Развертывание | Deploy | Появление профиля на поле; может включать пассивный стартовый эффект. |
| Массовка | crowd | Группа токенов, не равная отдельному actor; требует особого group-movement контракта. |

## Сверка перевода

- Обычные и именованные активируемые правила с явным EN: 122/122 пар подтверждены индексом, каноническим Markdown или локальным источником именованных врагов.
- Индекс не содержит 0 уже подтверждённых пар: нет.
- Локальные (не из английского PDF) пары Леона подтверждены `source/companion/named-enemies.md`: нет.
- Черты Антагониста: 0/0 английских названий извлечены из оригинального PDF (стр. 106–107).
- Непроверенные пары: нет.
- Подтверждённые смысловые расхождения RU/EN: нет. Проверка пар названий сама по себе этого не выявляет.

## Обычные враги

### Убийца (Assassin) `lionwing.npc.assassin`

**Теги:** DPS. **Параметры:** Health: 13 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

**Пассив / Passive:** Исчезает после Развертывания. Атаковав Помеченного персонажа, Исчезает после Атаки, если не был Исчезнувшим до ее начала.

#### Устранить цель (Neutralize Target) `lionwing.npc.assassin.neutralize-target`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите целью любого персонажа и Пометьте его. Атаки этого NPC не снимают Метку.

#### Рассечение (Slice) `lionwing.npc.assassin.slice`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `3 + [Ступень]` по смежной цели. Если NPC Исчез, он может появиться в смежной с целью клетке и получить `2 + [Ступень]` Преимущества. Награда: нанесите `[Успехи] + [Напряжение]` урона; если у цели нет смежных персонажей, добавьте `[Ступень]` урона.

#### Hidden Blades (Hidden Blades) `lionwing.npc.assassin.hidden-blades`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** For the rest of the Scene, whenever this NPC Disappears, leave a Hidden Blade in the space it left. It is Difficult Terrain that deals [Tier] damage to a character entering it, then removes itself.

### Громила (Bruiser) `lionwing.npc.bruiser`

**Теги:** DPS. **Параметры:** Health: 15 + [Tier × 5]; Speed: 3; Armor: [Tier]; Evasion: 0.

**Пассив / Passive:** Если Атака NPC не может оттолкнуть цель на полное расстояние, цель становится Ошеломлена.

#### Избиение (Beatdown) `lionwing.npc.bruiser.beatdown`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите смежную Ошеломленную цель. Нанесите ей 2 урона `1 + [Ступень]` раз.

#### Грязный прием (Skulduggery) `lionwing.npc.bruiser.skulduggery`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите все остальные цели в Зоне 2 × 2, размещенной на NPC. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и оттолкните каждую цель на `[Ступень × 2]` клеток.

#### Decimate (Decimate) `lionwing.npc.bruiser.decimate`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Indicate a 3 × 3 Zone centered on a space 2 spaces away and become Steady. At the end of the next Turn, use Skulduggery against every opponent in that Zone with 2 + [Tier] Advantage.

### Бегемот (Behemoth) `lionwing.npc.behemoth`

**Теги:** DPS. **Параметры:** Health: 13 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

#### Прыжок (Leap) `lionwing.npc.behemoth.leap`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Исчезните, если NPC не Атаковал в этот Ход. Когда он появится, Подбросьте и оттолкните на 2 клетки всех персонажей в пределах 2 клеток, если только они не применят Уворот, как против Атаки.

#### Вырвать из земли (Tore From Earth) `lionwing.npc.behemoth.tore-from-earth`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите до 2 целей в пределах 6 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и поместите смежное с ними Препятствие с `15 + [Ступень × 5]` Здоровья и 0 Брони.

#### Meteor (Meteor) `lionwing.npc.behemoth.meteor`

**Тип / type:** Козырь · 2 ОД · Н5.

**RU — канон.** Teleport to the middle of the board and become Steady. At the start of the next Turn, Attack every character without an Obstacle between them and this NPC, instantly dealing 2 Wounds.

### Ловец (Captor) `lionwing.npc.captor`

**Теги:** DPS. **Параметры:** Health: 13 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

#### Ждать и наблюдать (Watch And Wait) `lionwing.npc.captor.watch-and-wait`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Поместите особую Трудную местность в свободную клетку в пределах 4 клеток. Когда персонаж входит в нее, удалите ее, и NPC может применить к нему «Поймать и отпустить».

#### Поймать и отпустить (Catch And Release) `lionwing.npc.captor.catch-and-release`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 4 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона; если враги еще не Атаковали цель в этом Раунде, Ослабьте и Поймайте ее.

#### Sticky Bomb (Sticky Bomb) `lionwing.npc.captor.sticky-bomb`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Indicate an opponent within 5 spaces. At the end of the next Turn, use Catch And Release against every character within 3 spaces of them. Hit characters are pulled adjacent to and Snared by the indicated character instead of this NPC.

### Палач (Executioner) `lionwing.npc.executioner`

**Теги:** DPS. **Параметры:** Health: 15 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

**Пассив / Passive:** На этого NPC не действуют Эффекты, которые снижают его Скорость или препятствуют движению.

#### Собраться (Focus) `lionwing.npc.executioner.focus`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Усильте и Укрепите этого NPC.

#### Разруб (Cleave) `lionwing.npc.executioner.cleave`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Когда NPC Атакует, не будучи Заряжен, вместо этого он становится Заряжен. Пока он Заряжен, его Скорость равна 1, и он получает `1 + [Ступень]` Брони. Выберите все цели на смежной Линии длиной 2 клетки. Бросьте `6 + [Ступень × 2]`, затем снимите Заряд. Награда: нанесите `[Успехи] + [Напряжение × 2]` урона; Разорвите цель, если враги не Атаковали ее в этом Раунде.

#### Bifurcate (Bifurcate) `lionwing.npc.executioner.bifurcate`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Indicate an opponent, become Charged, and become Steady. At the end of the next Turn, move adjacent to that opponent or as close as possible through as few spaces as possible, then use Cleave against opponents moved through or adjacent to.

### Джавелин (Javelin) `lionwing.npc.javelin`

**Теги:** DPS. **Параметры:** Health: 15 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** Когда NPC Атакует, он может уничтожить Зону Приспешников в своей клетке или смежной с ней, чтобы увеличить дальность Атаки до 5 клеток.

#### Призыв (Call) `lionwing.npc.javelin.call`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Создайте `1 + [Ступень]` Приспешников в пределах 4 клеток. Их количество уменьшается на 1 при каждом повторном применении в том же Раунде.

#### Сокрушительный удар (Crushing Impact) `lionwing.npc.javelin.crushing-impact`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите остальные цели в Зоне 2 × 2, размещенной на NPC. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и Подбросьте, если цель только одна.

#### Shockwave (Shockwave) `lionwing.npc.javelin.shockwave`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Indicate a 5 × 5 Zone centered on this NPC and become Steady. At the end of the next Turn, use Crushing Impact against opposing targets in that Zone with [Tier] Advantage.

### Кулачный боец (Pugilist) `lionwing.npc.pugilist`

**Теги:** DPS. **Параметры:** Health: 15 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** При каждой Атаке применяйте следующий шаг, после шага 4 начните снова: 1 — оттолкните цель на 3 клетки и следуйте за ней; 2 — Поймайте цель; 3 — Подбросьте цель; 4 — если цель Подброшена, получите удвоенное Преимущество за Добивание.

#### Принять стойку (Take Stance) `lionwing.npc.pugilist.take-stance`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Установите Пассив этого NPC на любой шаг, затем Усильте его.

#### Град ударов (Flurry Of Strikes) `lionwing.npc.pugilist.flurry-of-strikes`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `5 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона; Замедлите цель, если враги не Атаковали ее в этом Раунде.

#### Martial Perfection (Martial Perfection) `lionwing.npc.pugilist.martial-perfection`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** For the rest of combat, trigger this NPC's Passive twice on each Attack. This NPC immediately takes another Turn.

### Рейнджер (Ranger) `lionwing.npc.ranger`

**Теги:** DPS. **Параметры:** Health: 13 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** После того как NPC Атаковали, он может сдвинуться на 1 клетку.

#### Гнездо (Nest) `lionwing.npc.ranger.nest`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Станьте Устойчивы и получите 1 Прицел. Прицел теряется, когда NPC движется в свой Ход, и добавляет 1 урон ко всем его успешным Атакам.

#### Выстрел (Take The Shot) `lionwing.npc.ranger.take-the-shot`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите персонажа в пределах 8 клеток. Бросьте `5 + [Ступень]`. Нанесите `[Ступень + 2]` дополнительного урона, если цель хотя бы в 4 клетках и враги не Атаковали ее в этом Раунде. Награда: нанесите `[Успехи] + [Напряжение]` урона.

#### Headshot (Headshot) `lionwing.npc.ranger.headshot`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Choose any target. The next time this NPC's Attack hits them, they receive an additional [Hits] damage.

### Ронин (Ronin) `lionwing.npc.ronin`

**Теги:** DPS. **Параметры:** Health: 13 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** Начинайте каждый Ход с 1 дополнительным ОД, но NPC может выбрать одного и того же персонажа целью лишь один раз за Ход.

#### Вложить в ножны (Sheath) `lionwing.npc.ronin.sheath`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** В следующий раз при движении NPC обязан потратить 3 ОД, но может также применить Рассечение ко всем персонажам, с которыми входит в смежность или выходит из нее.

#### Рассечение (Dissect) `lionwing.npc.ronin.dissect`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Эта Атака Быстрая. Выберите смежную цель и бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона. Если выпало хотя бы 2 Крита, Разорвите и Замедлите цель.

#### Thunderclap And Flash (Thunderclap And Flash) `lionwing.npc.ronin.thunderclap-and-flash`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Become Steady and indicate 4 Lines of any length connected end to end, with one connected to this NPC. At the end of the next Turn, move across every Line to the final end, ignoring characters and Terrain, then use Dissect against each opponent moved over or entered adjacency with. This Attack Crits on 5s.

### Гадюка (Viper) `lionwing.npc.viper`

**Теги:** DPS. **Параметры:** Health: 15 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** После Атаки сдвиньтесь на расстояние до 3 клеток, игнорируя противников. Пройдя сквозь противника, которого NPC еще не Атаковал в этот Ход, можете применить к нему Филе.

#### Облизать нож (Lick The Knife) `lionwing.npc.viper.lick-the-knife`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Нанесите каждому Порченому игроку урон, равный числу Порченых игроков + `[Ступень]`.

#### Филе (Filet) `lionwing.npc.viper.filet`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите смежную цель либо не активируйте Пассив и выберите цель в пределах 5 клеток. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и наложите Порчу. Если цель уже была Порчена, Пометьте ее.

#### Knife In The Dark (Knife In The Dark) `lionwing.npc.viper.knife-in-the-dark`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Disappear. At the end of the next Turn, use Filet to Teleport adjacent to and Attack every player without an adjacent ally, then reappear in any space.

### Ведьма (Witch) `lionwing.npc.witch`

**Теги:** DPS. **Параметры:** Health: 13 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** После Атаки укажите Зону 3 × 3 с центром в атакованной клетке. В конце следующего Хода каждый игрок в этой Зоне получает `[Ступень]` урона.

#### Начертание рун (Drawing Runes) `lionwing.npc.witch.drawing-runes`

**Тип / type:** Действие · 2 ОД.

**RU — канон.** Это Действие стоит 2 ОД. Создайте Зону 3 × 3 с центром на NPC, заменив прежнюю такую Зону. Пока NPC находится в ней, каждая брошенная им кость считается Успехом.

#### Изгоняющая сила (Expelling Force) `lionwing.npc.witch.expelling-force`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 5 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и оттолкните цель на 2 клетки.

#### EXPLOSION (EXPLOSION) `lionwing.npc.witch.explosion`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Indicate a 4 × 4 Zone anywhere on the board and become Steady. At the end of the next Turn, this NPC may use Expelling Force against all opponents in the Zone with 1 + [Tier] Advantage, then remove the Zone.

### Телохранители (Bodyguards) `lionwing.npc.bodyguards`

**Теги:** Tank. **Параметры:** Health: 1*; Speed: 0*; Armor: 0; Evasion: 0.

**Пассив / Passive:** Когда этот NPC должен Развернуться, вместо него Разверните `4 + [Ступень]` особых Зон Приспешников. NPC нельзя Вывести из строя, пока не Выведены все его Зоны либо все персонажи, кроме Приспешников; когда происходит одно из двух, NPC получает 1 урон.

#### Укрепиться (Brace) `lionwing.npc.bodyguards.brace`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Если хотя бы 3 Зоны Приспешников стоят на одной Линии, все они становятся непроходимыми, пока Линия не будет разорвана.

#### За мной (Behind Me) `lionwing.npc.bodyguards.behind-me`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Сдвиньте каждую Зону Приспешников на расстояние до 1 клетки. Выберите до 3 персонажей, смежных с такой Зоной. Союзников Укрепите. Против врагов бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и Ошеломите цели, которых враги не Атаковали в этом Раунде.

#### Reinforcements (Reinforcements) `lionwing.npc.bodyguards.reinforcements`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Create 3 + [Tier] Fodder Zones in spaces on the edge of the board. This NPC immediately takes another Turn.

### Матка (Broodmother) `lionwing.npc.broodmother`

**Теги:** Tank. **Параметры:** Health: 15 + [Tier × 5]; Speed: 3; Armor: [Tier]; Evasion: 0.

**Пассив / Passive:** Когда NPC получает урон, а на поле не больше `5 + [Ступень × 2]` Зон Приспешников, он может поместить такую Зону в пределах 2 клеток.

#### Призыв (Call) `lionwing.npc.broodmother.call`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Создайте `1 + [Ступень]` Приспешников в пределах 4 клеток. Их количество уменьшается на 1 при каждом повторном применении в том же Раунде.

#### Роящаяся погоня (Swarming Chase) `lionwing.npc.broodmother.swarming-chase`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Сдвиньте NPC и всех смежных союзников на 1 клетку. Бросьте `4 + [Ступень]` против тех врагов, с которыми NPC стал смежен. Награда: нанесите `[Успехи] + [Напряжение]` урона и еще 1 за каждую смежную с Маткой Зону Приспешников.

#### Roar (Roar) `lionwing.npc.broodmother.roar`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Taunt all opponents in a 5 × 5 Zone centered on this NPC. It immediately takes another Turn.

### Кокон (Cocoon) `lionwing.npc.cocoon`

**Теги:** Tank. **Параметры:** Health: 18 + [Tier × 5]; Speed: 4; Armor: [Tier]; Evasion: 0.

**Пассив / Passive:** Начинайте боевую Сцену Покорным. Пока NPC Покорен, он не может двигаться или Атаковать и получает 1 Рост в конце своего Хода. Начав Ход хотя бы с 3 Ростом, снимите Покорность и восстановите `10 + [Ступень × 2]` Здоровья, если оно потеряно.

#### Устрашение (Menace) `lionwing.npc.cocoon.menace`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Испугайте всех противников в пределах 3 клеток. Если NPC Покорен, союзник может сдвинуться или Атаковать.

#### Буйство (Rampage) `lionwing.npc.cocoon.rampage`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Двиньтесь на расстояние до 3 клеток по прямой Линии, игнорируя любые ограничения. Бросьте `4 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона и повторите эту Атаку, выбирая только персонажей, которых не Атаковали в этот Ход.

#### Quick Growth (Quick Growth) `lionwing.npc.cocoon.quick-growth`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** Gain 1 Growth. This NPC immediately takes another Turn.

### Дуэлянт (Duelist) `lionwing.npc.duelist`

**Теги:** Tank. **Параметры:** Health: 13 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** Персонажи, которые Атакуют этого NPC или которых Атакует он, становятся Спровоцированы им.

#### Поддразнить (Goad) `lionwing.npc.duelist.goad`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Спровоцируйте персонажа. Если он уже Спровоцирован этим NPC, заставьте его потратить 2 Фокуса или двинуться на 3 клетки прямо к NPC; если он стал смежным, Ошеломите его.

#### Стремительный выпад (Flèche) `lionwing.npc.duelist.fleche`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 2 клеток. Бросьте `5 + [Ступень]`. Если цель Спровоцирована, нанесите `[Ступень]` дополнительного урона. Награда: нанесите `[Успехи] + [Напряжение]` урона и сдвиньтесь на 1 клетку.

#### Disassemble (Disassemble) `lionwing.npc.duelist.disassemble`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Place a weak point in an unoccupied space adjacent to a character; it follows its host's movement. When this NPC Attacks the host while standing in the weak point, deal [Tension] additional damage, consume the weak point, and this Ace may be used again immediately.

### Обжора (Glutton) `lionwing.npc.glutton`

**Теги:** Tank. **Параметры:** Health: 20 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** Когда NPC Выводит из строя Зону Приспешников, восстановите `3 + [Ступень]` Здоровья и отметьте, сколько раз сработало это исцеление.

#### Призыв (Call) `lionwing.npc.glutton.call`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Создайте `1 + [Ступень]` Приспешников в пределах 4 клеток. Их количество уменьшается на 1 при каждом повторном применении в том же Раунде.

#### Слюни (Slobber) `lionwing.npc.glutton.slobber`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите до 2 смежных целей. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и Замедлите цели, которых враги не Атаковали в этом Раунде.

#### Regurgitate (Regurgitate) `lionwing.npc.glutton.regurgitate`

**Тип / type:** Козырь · 2 ОД · Н4.

**RU — канон.** Place as many Fodder Zones as this NPC destroyed with its Passive in spaces of your choice. Characters under placed Zones are Launched.

### Страж (Guardian) `lionwing.npc.guardian`

**Теги:** Tank. **Параметры:** Health: 20 + [Tier × 5]; Speed: 3; Armor: [Tier]; Evasion: 0.

**Пассив / Passive:** Смежные с NPC клетки считаются Трудной местностью для его противников.

#### Щит стража (Guardian Shield) `lionwing.npc.guardian.guardian-shield`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Замедлите NPC и поместите смежный щит — Зону 2 × 3 — до начала его следующего Хода; Зона движется вместе с ним. Противники, Атакующие в этой области, считают, что у их целей на `1 + [Ступень]` больше Брони.

#### Толчок (Shove) `lionwing.npc.guardian.shove`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `4 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона, оттолкните цель на 2 клетки и Подбросьте ее.

#### Imposing Presence (Imposing Presence) `lionwing.npc.guardian.imposing-presence`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** For the rest of the Scene, characters adjacent to this NPC or within its shield are Taunted.

### Скакун (Mount) `lionwing.npc.mount`

**Теги:** Tank. **Параметры:** Health: 15 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** При Развертывании или своим Действием NPC может позволить согласному смежному персонажу Оседлать его, заменив прежнего всадника. Всадник и Скакун остаются в одной клетке, когда один из них движется. Атаки, нацеленные только на всадника-NPC, вместо него выбирают целью Скакуна.

#### Синергия (Synergy) `lionwing.npc.mount.synergy`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Примените Действие всадника либо любое Утилитарное действие ценой 1, если всадник — игрок.

#### Молотить (Thrash) `lionwing.npc.mount.thrash`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите до 2 смежных целей. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона.

#### CHARGE! (CHARGE!) `lionwing.npc.mount.charge`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Move up to this NPC's Speed in a straight Line. When the movement ends, its rider may use their Attack or Skirmish with [Tier] Advantage. This NPC immediately takes another Turn.

### Они (Oni) `lionwing.npc.oni`

**Теги:** Tank. **Параметры:** Health: 15 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

**Пассив / Passive:** Развертывается Усиленным. Когда NPC Атакуют, он теряет все положительные Эффекты. Потеряв Усиление, он становится Укреплен; потеряв Укрепление — Усилен.

#### Стабилизация (Stabilize) `lionwing.npc.oni.stabilize`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Снимите с NPC его Эффекты и Ускорьте его.

#### Полярис (Polaris) `lionwing.npc.oni.polaris`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Если NPC Усилен, сдвиньте его на расстояние до 2 клеток по прямой Линии и выберите целями всех персонажей, с которыми он вошел в смежность. Если Укреплен, затроньте всех союзников в Зоне 3 × 3 с центром на NPC, кроме него самого. Бросьте `5 + [Ступень]`; если действуют оба Эффекта, выберите один режим. Награда: при Усилении нанесите `[Успехи] + [Напряжение]` урона и Подбросьте; при Укреплении восстановите `[Успехи]` Здоровья и Ускорьте.

#### Vibrant Terror (Vibrant Terror) `lionwing.npc.oni.vibrant-terror`

**Тип / type:** Козырь · 2 ОД · Н4.

**RU — канон.** For the rest of the Scene, this NPC gains double the benefits from positive Effects. It immediately takes another Turn.

### Паладин (Paladin) `lionwing.npc.paladin`

**Теги:** Tank. **Параметры:** Health: 18 + [Tier × 5]; Speed: 3; Armor: [Tier]; Evasion: 0.

**Пассив / Passive:** Когда NPC Атакует союзников, он не наносит урон, а вместо этого восстанавливает столько же Здоровья.

#### Евангелие (Gospel) `lionwing.npc.paladin.gospel`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Укрепите Регенерирующих союзников.

#### Дар от Бога (Gift From God) `lionwing.npc.paladin.gift-from-god`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите до 2 смежных целей. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и Ошеломите противника, которого враги не Атаковали в этом Раунде, либо дайте союзнику Регенерацию.

#### Weal And Woe (Weal And Woe) `lionwing.npc.paladin.weal-and-woe`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Use Gift From God against all characters within 2 spaces.

### Ревенант (Revenant) `lionwing.npc.revenant`

**Теги:** Tank. **Параметры:** Health: 10 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

**Пассив / Passive:** NPC не дает Напряжение, когда его Выводят из строя. Если в начале Раунда он Выведен из строя, верните его на поле с полным Здоровьем в выбранную свободную клетку.

#### Таиться (Lurk) `lionwing.npc.revenant.lurk`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Все противники с 1 Фокусом или меньше Испуганы персонажами, не являющимися Ревенантами, в пределах 2 клеток.

#### Вырвать из души (Tear From The Soul) `lionwing.npc.revenant.tear-from-the-soul`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 3 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона, а цель теряет `1 + [Ступень]` Фокуса.

#### Hollowed Eyes (Hollowed Eyes) `lionwing.npc.revenant.hollowed-eyes`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Indicate the player with the least Focus. At the end of the next Turn, use Tear From The Soul, Teleport adjacent to that player, and gain 6 + [Tier] Advantage minus the target's current Focus.

### Спрайт (Spright) `lionwing.npc.spright`

**Теги:** Tank. **Параметры:** Health: 13 + [Tier × 5]; Speed: 5; Armor: 0; Evasion: 0.

**Пассив / Passive:** Завершив движение, NPC получает Уклонение, равное расстоянию от исходной позиции.

#### Сбить с толку (Discombobulate) `lionwing.npc.spright.discombobulate`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите смежную цель. Если у нее больше Уклонения, чем Брони, Замедлите ее; если больше Брони, чем Уклонения, Разорвите; если нет ни того ни другого, Пометьте.

#### Надрез (Incision) `lionwing.npc.spright.incision`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `5 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона и Телепортируйтесь в самую дальнюю от текущей позиции NPC клетку, смежную с целью.

#### Thunderous Ascension (Thunderous Ascension) `lionwing.npc.spright.thunderous-ascension`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Increase this NPC's Speed by [Tier × 2]. For the rest of the Scene, once per Turn, when it moves into every space adjacent to an opponent, Slow and Daze that opponent. This NPC immediately takes another Turn.

### Знаменосец (Bannerman) `lionwing.npc.bannerman`

**Теги:** Support. **Параметры:** Health: 18 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** Когда NPC движется, любой союзник в Зоне 3 × 3 с центром на нем может переместиться в смежность с его новой позицией.

#### На позиции (In Position) `lionwing.npc.bannerman.in-position`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите союзника в пределах 6 клеток и направление. Усильте и Укрепите его, затем сдвиньте на 1 клетку в выбранном направлении, отталкивая мешающих персонажей. Повторяйте это на смежных союзниках, включая повтор, не более одного раза для каждой цели.

#### Взмах (Swing) `lionwing.npc.bannerman.swing`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `4 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона и Ослабьте цель, если враги не Атаковали ее в этом Раунде.

#### Plant The Flag (Plant The Flag) `lionwing.npc.bannerman.plant-the-flag`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** Place 15 + [Tier × 5] Health Terrain adjacent to this NPC. While it exists, use In Position at the start of each Round, and replace this NPC's Attack with another NPC's Attack from the board until the Terrain is destroyed.

### Строитель (Builder) `lionwing.npc.builder`

**Теги:** Support. **Параметры:** Health: 15 + [Tier × 5]; Speed: 3; Armor: [Tier]; Evasion: 0.

**Пассив / Passive:** NPC может двигаться сквозь Препятствия.

#### Ландшафт (Landscape) `lionwing.npc.builder.landscape`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите до 3 свободных клеток в пределах 4 клеток и сделайте их Высокой или Низкой местностью.

#### Буйное строительство (Violent Construction) `lionwing.npc.builder.violent-construction`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 6 клеток. Нанесите ей `2 + [Ступень]` урона и поместите смежное с ней Препятствие с `15 + [Ступень × 5]` Здоровья.

#### Army Of Stone (Army Of Stone) `lionwing.npc.builder.army-of-stone`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Turn every piece of Terrain on the board into an allied Fodder Zone. This NPC immediately takes another Turn.

### Координатор (Coordinator) `lionwing.npc.coordinator`

**Теги:** Support. **Параметры:** Health: 13 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

**Пассив / Passive:** Союзники в пределах 4 клеток считаются Усиленными во время Хода этого NPC.

#### Нейтрализуйте их (Neutralize Them) `lionwing.npc.coordinator.neutralize-them`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите и Пометьте цель в пределах 4 клеток.

#### Фанатизировать (Fanaticize) `lionwing.npc.coordinator.fanaticize`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Сдвиньтесь на расстояние до 1 клетки и бросьте `5 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона и позвольте союзнику сдвинуться на расстояние до Скорости либо применить основную Атаку к персонажу, которого не Атаковали в этот Ход. Союзник-игрок может применить Заклинание или Стычку.

#### Coordinated Charge (Coordinated Charge) `lionwing.npc.coordinator.coordinated-charge`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Every other enemy within 5 spaces may move up to its Speed or use Fanaticize against a character not Attacked this Turn.

### Доппельгангер (Doppelgänger) `lionwing.npc.doppelganger`

**Теги:** Support. **Параметры:** Health: 15 + [Tier × 5]; Speed: 5; Armor: 0; Evasion: 0.

**Пассив / Passive:** Если NPC не начал Ход, Имитируя другого NPC, он может Атаковать дважды в этот Ход.

#### Имитировать (Imitate) `lionwing.npc.doppelganger.imitate`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Имитируйте союзного NPC, заменив параметры, кроме Здоровья, а также Пассив, Действие и Атаку соответствующими данными союзника. Имитация длится до получения урона; тогда NPC может Телепортироваться в клетку в пределах 6 клеток. Нельзя Имитировать одного NPC два Хода подряд.

#### Diplopia (Diplopia) `lionwing.npc.doppelganger.diplopia`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** Create 2 copies of this NPC in unoccupied adjacent spaces with the same Tier and current Health. This NPC immediately takes another Turn.

### Целитель (Healer) `lionwing.npc.healer`

**Теги:** Support. **Параметры:** Health: 13 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** В начале Хода NPC может выбрать союзника своим Стражем. Пока NPC смежен со Стражем, он не считается целью, если при выборе целей Страж находится ближе к Атаке.

#### Лечение (Heal) `lionwing.npc.healer.heal`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Восстановите `2 + [Ступень]` Здоровья союзнику в пределах 3 клеток. Удвойте это исцеление для Стража NPC.

#### Обескровить (Exsanguinate) `lionwing.npc.healer.exsanguinate`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 5 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и Пометьте цель. Каждый раз, когда Атакуют любого Помеченного противника, атакующий восстанавливает `5 + [Ступень]` Здоровья.

#### Savior (Savior) `lionwing.npc.healer.savior`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Remove all Effects from this NPC's Guardian; the Guardian begins Regenerating.

### Иллюзионист (Illusionist) `lionwing.npc.illusionist`

**Теги:** Support. **Параметры:** Health: 15 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** В начале Хода NPC может поменять местами любых 2 NPC. Для обоих это считается Телепортацией.

#### Пространственный разлом (Spatial Rift) `lionwing.npc.illusionist.spatial-rift`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Создайте 3 Стены с `10 + [Ступень × 3]` Здоровья в любых местах поля.

#### Исказить реальность (Distort Reality) `lionwing.npc.illusionist.distort-reality`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите любое число смежных целей. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и поместите каждую цель в Поток. Когда персонаж в Потоке начинает Ход, NPC может применить к нему свой Пассив, как если бы тот был NPC, снимая Поток.

#### Shattered Skies (Shattered Skies) `lionwing.npc.illusionist.shattered-skies`

**Тип / type:** Козырь · 2 ОД · Н1.

**RU — канон.** Immobilize this NPC. At the start of its next Turn, use Distort Reality against all opponents.

### Матриарх (Matriarch) `lionwing.npc.matriarch`

**Теги:** Support. **Параметры:** Health: 15 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

**Пассив / Passive:** В начале каждого Раунда назначьте клетку. До конца Раунда враги в ней, не являющиеся Матриархами, не считаются целями, если только их не пытается выбрать целью Матриарх.

#### Ласка (Caress) `lionwing.npc.matriarch.caress`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите любого персонажа и Телепортируйте его в назначенную клетку либо Телепортируйте персонажа из назначенной клетки в другую.

#### Уничтожить чужака (Destroy The Interloper) `lionwing.npc.matriarch.destroy-the-interloper`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в назначенной клетке. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона, Изгоните цель и сдвиньте ее на расстояние до 4 клеток.

#### Mother Of The Void (Mother Of The Void) `lionwing.npc.matriarch.mother-of-the-void`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** For the rest of the Scene, this NPC may designate 2 spaces with its Passive. It immediately takes another Turn.

### Мученик (Martyr) `lionwing.npc.martyr`

**Теги:** Support. **Параметры:** Health: 13 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** В конце каждого Раунда NPC восстанавливает `5 + [Ступень]` Здоровья.

#### Насыться моей плотью (Gorge On My Flesh) `lionwing.npc.martyr.gorge-on-my-flesh`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Нанесите NPC `1 + [Ступень]` урона. До конца его следующего Хода все союзники в пределах 4 клеток получают `2 + [Ступень]` Брони.

#### Вкусите моей крови (Savor My Blood) `lionwing.npc.martyr.savor-my-blood`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 5 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и восстановите NPC Здоровье, равное половине недостающего.

#### Sacrifice (Sacrifice) `lionwing.npc.martyr.sacrifice`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** Knock Out this NPC and restore Health to all allies equal to twice each ally's Armor. Trigger this automatically if this NPC is Knocked Out while Tension is at least 4.

### Барон (Baron) `lionwing.npc.baron`

**Теги:** Engine. **Параметры:** Health: 15 + [Tier × 5]; Speed: 2; Armor: [Tier]; Evasion: 0.

**Пассив / Passive:** В начале Хода назовите Стычку, Заклинание или Завершение, не повторяя прошлый выбор. Один раз за Раунд, когда игрок начинает названное Действие, NPC может Телепортироваться в свободную смежную клетку, стать целью и нанести игроку `[Ступень + 2]` урона.

#### Предписание (Prescript) `lionwing.npc.baron.prescript`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите до 3 противников. Каждый указывает клетку; если он не закончит в ней свой следующий Ход, то получает Рану.

#### Подавить (Suppress) `lionwing.npc.baron.suppress`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `4 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона и Ослабьте цель, если враги не Атаковали ее в этом Раунде.

#### Absolute Sovereignty (Absolute Sovereignty) `lionwing.npc.baron.absolute-sovereignty`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** For the rest of the Scene, name 2 Actions with the Passive, remove the restriction against repeating the same Action, and deal the Passive's damage once per named word.

### Берсерк (Berserker) `lionwing.npc.berserker`

**Теги:** Engine. **Параметры:** Health: 18 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

**Пассив / Passive:** Один раз за Ход, получив хотя бы 4 урона одним случаем, NPC может сдвинуться на расстояние до 1 клетки в любом направлении и нанести смежному противнику `[Ступень + 1]` урона.

#### Кипеть (Seethe) `lionwing.npc.berserker.seethe`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Восстановите NPC `2 + [Ступень × 2]` Здоровья.

#### Молотить (Thrash) `lionwing.npc.berserker.thrash`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `5 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона и оттолкните цель на 1 клетку.

#### Last Stand (Last Stand) `lionwing.npc.berserker.last-stand`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** Set this NPC's Health to 13 + [Tier × 5]. For the rest of the Scene, its Passive moves it 2 spaces. This NPC immediately takes another Turn.

### Канонир (Cannoneer) `lionwing.npc.cannoneer`

**Теги:** Engine. **Параметры:** Health: 13 + [Tier × 5]; Speed: 1; Armor: 0; Evasion: 0.

**Пассив / Passive:** При Развертывании начните отслеживать Подготовку — Часы из 4 Сегментов, которые опустошаются в начале каждой Сцены.

#### Прицелиться (Aim) `lionwing.npc.cannoneer.aim`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Усильте NPC и сделайте его Устойчивым.

#### Зарядить (Load) `lionwing.npc.cannoneer.load`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Заполните Подготовку на 1 Сегмент или на 2, если NPC не двигался в этот Ход.

#### Fire (Fire) `lionwing.npc.cannoneer.fire`

**Тип / type:** Козырь · 2 ОД.

**RU — канон.** Use only when this NPC starts its Turn with full Preparation. Empty the Clock, choose a target within 10 spaces, and roll 5 + [Tier]. This Ace may be used more than once per Scene. Reward: Deal [Hits] + [Tension] damage 3 times.

### Культист (Cultist) `lionwing.npc.cultist`

**Теги:** Engine. **Параметры:** Health: 13 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** Каждый раз, когда NPC повышает Напряжение, добавьте в Сцену 1 счетчик Рока. Во время Ходов игроков они считают Напряжение на 1 ниже за каждый счетчик Рока.

#### Ритуальные чертежи (Ritual Drawings) `lionwing.npc.cultist.ritual-drawings`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Повысьте Напряжение на 1 и поместите жетоны Ритуала в 3 свободные клетки. Когда противник входит в такую клетку, удалите жетон, нанесите `[Напряжение]` урона и Ошеломите его.

#### Удар наотмашь (Swipe) `lionwing.npc.cultist.swipe`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Бросьте `4 + [Ступень]` по смежной цели. Награда: нанесите `[Успехи] + [Напряжение]` урона.

#### Grand Calling (Grand Calling) `lionwing.npc.cultist.grand-calling`

**Тип / type:** Козырь · 2 ОД · Н8.

**RU — канон.** Knock Out this NPC and create a non-Cultist NPC of a chosen type in its former space. Apply the Giant NPC Modifier to it and set its Tier to twice the Cultist's Tier.

### Сорвиголова (Daredevil) `lionwing.npc.daredevil`

**Теги:** Engine. **Параметры:** Health: 15 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** Когда Напряжение повышается, сдвиньтесь на расстояние до 3 клеток по прямой Линии. Если движение заканчивается в смежности с персонажем, нанесите ему `2 + [Ступень]` урона, не более одного персонажа за движение.

#### Хвастовство (Gloat) `lionwing.npc.daredevil.gloat`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Повысьте Напряжение на 1.

#### Танец (Dance) `lionwing.npc.daredevil.dance`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите до 2 смежных целей. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и Подбросьте цели.

#### Adrenaline High (Adrenaline High) `lionwing.npc.daredevil.adrenaline-high`

**Тип / type:** Козырь · 2 ОД · Н4.

**RU — канон.** For the rest of the Scene, this NPC's primary Attack deals [Tier] additional damage and its Passive movement may move up to 6 spaces. This NPC immediately takes another Turn.

### Манипулятор (Enchanter) `lionwing.npc.enchanter`

**Теги:** Engine. **Параметры:** Health: 13 + [Tier × 5]; Speed: 3; Armor: 0; Evasion: 0.

#### Очарование (Charm) `lionwing.npc.enchanter.charm`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите цель в пределах 5 клеток. Испугайте или Спровоцируйте ее, затем сдвиньте на 3 клетки.

#### Сердцеед (Heartbreaker) `lionwing.npc.enchanter.heartbreaker`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 5 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона; если цель была Испугана или Спровоцирована, Ослабьте и Замедлите ее.

#### By My Command (By My Command) `lionwing.npc.enchanter.by-my-command`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Choose a Taunted or Feared character. They gain 2 AP and must take a Turn in which they Attack an ally, or receive 1 Wound.

### Псарь (Hound Master) `lionwing.npc.hound-master`

**Теги:** Engine. **Параметры:** Health: 15 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** В конце Хода этого NPC Зоны Приспешников могут двигаться на 3 клетки вместо 2.

#### Запустить ищейку (Fire Seeker) `lionwing.npc.hound-master.fire-seeker`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Выберите цель хотя бы в 4 клетках и создайте Ищейку рядом с NPC. Ищейка — особый Приспешник: оказавшись рядом со своей целью, она исчезает и наносит всем смежным противникам `6 + [Ступень]` урона.

#### Толчок (Shove) `lionwing.npc.hound-master.shove`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 3 клеток. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и оттолкните цель на 2 клетки.

#### Wild Hunt (Wild Hunt) `lionwing.npc.hound-master.wild-hunt`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Create 3 Seekers targeting the same character.

### Некромант (Necromancer) `lionwing.npc.necromancer`

**Теги:** Engine. **Параметры:** Health: 13 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** Враги, Выведенные из строя, пока этот NPC Развернут, оставляют Труп в клетке, где были Выведены из строя.

#### Призвать мертвых (Call The Dead) `lionwing.npc.necromancer.call-the-dead`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Создайте `1 + [Ступень]` Приспешников в пределах 4 клеток. Пока они активны, они считаются Трупами. Каждый раз, когда это Действие применяется повторно в том же Раунде, создавайте на 1 меньше.

#### Ужасающий выстрел (Terrifying Shot) `lionwing.npc.necromancer.terrifying-shot`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Выберите цель в пределах 5 клеток. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение × 2]` урона и Испугайте цель.

#### The Danse Macabre (The Danse Macabre) `lionwing.npc.necromancer.the-danse-macabre`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Revive 2 Corpses as Bruisers, Vipers, or Rangers with Tier equal to this NPC's Tier minus 1, minimum 1.

### Капер (Privateer) `lionwing.npc.privateer`

**Теги:** Engine. **Параметры:** Health: 13 + [Tier × 5]; Speed: 4; Armor: 0; Evasion: 0.

**Пассив / Passive:** Один раз за Раунд, когда союзник Атакует противника в пределах дальности Атаки этого NPC, нанесите этому противнику `[Ступень + 2]` урона.

#### Эскорт (Escort) `lionwing.npc.privateer.escort`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Ускорьте союзника. Когда тот движется, NPC может переместиться на столько же клеток, если в результате не окажется дальше от него.

#### Стрельба наугад (Spray And Pray) `lionwing.npc.privateer.spray-and-pray`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Воздействуйте на все цели на смежной с NPC Линии длиной 2 клетки. Бросьте `4 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение × 2]` урона.

#### Gear Change (Gear Change) `lionwing.npc.privateer.gear-change`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** For the rest of the Scene, this NPC may move 1 space at the end of every character's Turn. This NPC immediately takes another Turn.

### Разломщик (Rifter) `lionwing.npc.rifter`

**Теги:** Engine. **Параметры:** Health: 13 + [Tier × 5]; Speed: 2; Armor: 0; Evasion: 0.

**Пассив / Passive:** Когда NPC начинает любое движение, включая принудительное, создайте Разлом в покинутой клетке и в клетке назначения. Один раз за Ход, когда другой персонаж входит в клетку с Разломом, он может удалить этот Разлом и Телепортироваться к другому Разлому.

#### Дикое смещение (Wild Shifting) `lionwing.npc.rifter.wild-shifting`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** 3 раза Телепортируйтесь в клетку в пределах 3 клеток.

#### Появление (Emerge) `lionwing.npc.rifter.emerge`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Телепортируйтесь в клетку в пределах 5 клеток и выберите целями всех смежных персонажей. Бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона.

#### Implode (Implode) `lionwing.npc.rifter.implode`

**Тип / type:** Козырь · 2 ОД · Н3.

**RU — канон.** Every Rift explodes, applying the damaging portion of this NPC's primary Attack to all characters adjacent to or within a Rift.

### Рой (Swarm) `lionwing.npc.swarm`

**Теги:** Engine. **Параметры:** Health: 1*; Speed: 0*; Armor: 0; Evasion: 0.

**Пассив / Passive:** Когда этот NPC должен быть Развернут, вместо него разместите `4 + [Ступень]` уникальных Зон Приспешников. NPC нельзя Вывести из строя, пока не Выведены из строя все его Зоны или все враги, не являющиеся Приспешниками; когда происходит одно из двух, NPC получает 1 урон.

#### Призыв (Call) `lionwing.npc.swarm.call`

**Тип / type:** Действие · 1 ОД.

**RU — канон.** Создайте `1 + [Ступень]` Зон Приспешников в клетках на краю поля. Каждый раз, когда это Действие применяется повторно в том же Раунде, создавайте на 1 меньше.

#### Рвать (Tear) `lionwing.npc.swarm.tear`

**Тип / type:** Атака · 1 ОД.

**RU — канон.** Переместите все Зоны Приспешников на расстояние до 1 клетки. Выберите до 3 противников, смежных с Зоной Приспешников, и бросьте `5 + [Ступень]`. Награда: нанесите `[Успехи] + [Напряжение]` урона и Ошеломите одну цель.

#### Reinforcements (Reinforcements) `lionwing.npc.swarm.reinforcements`

**Тип / type:** Козырь · 2 ОД · Н2.

**RU — канон.** Create 4 + [Tier] Fodder Zones in spaces on the edge of the board. This NPC immediately takes another Turn.

## Враги-модификаторы

## Именованные враги

## Черты Антагониста
