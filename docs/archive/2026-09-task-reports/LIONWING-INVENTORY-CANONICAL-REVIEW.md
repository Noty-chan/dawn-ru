# LionWing inventory canonical review

Дата проверки: 2026-09-09. Источник механики для этого среза — новый EN LionWing в `apps/companion/edition-lionwing.js` (edition `dawn-en-lionwing-cb2f8e67`) и его canonical JSON. `apps/companion/edition-lionwing-ru.js` используется только как интерфейсный RU overlay. Notes из `technique-engine`, registry и старых выпусков не являются источником механики.

Каждый подключённый адаптер ниже opt-in, проверяет изученный уровень, передаёт полный `sourceDigest` и помечен `coverage: partial`: инвентарь, границы сброса, ownership, cost и receipt принадлежат ядру, а броски, цели, эффект действия и часть выбора остаются в ручном окне Narrator до отдельного подтверждённого среза.

## Подключённые consumers

### `altruist.gourmand.1` — Healthy Meal

**EN canonical:** “You have [Mind / 2] ‘Meals' that refresh each Intermission. You may Interact to hand an adjacent ally a Meal, and Reinforce or Hasten them. When this Effect expires, the character finishes their meal, and restores 4 + [Mind] Health.”

**RU overlay:** “У вас есть `[Разум / 2]` **порций**, восстанавливающихся в каждый Антракт. Можете Взаимодействовать, чтобы передать порцию смежному союзнику и Укрепить или Ускорить его. Когда этот Эффект заканчивается, персонаж доедает порцию и восстанавливает `4 + [Разум]` Здоровья.”

**Digest:** `d7dabbe3ac7be7d0ded9c75f214be072cd634c54e318455cbd28f6e02d401d73`.

**Semantic diff:** EN says `[Mind / 2]`; the existing project convention evaluates this as a rounded-up integer for a count. The adapter creates `altruist.gourmand.meals` with that count, maximum equal to the count, `lifetime: scene`, and `resetAt: intermission`. Giving a Meal, adjacency, Reinforce/Hasten and expiry healing remain manual; level II’s no-Interact delivery reuses this same record and creates no duplicate resource.

### `vagabond.malicious-mimic.1` — “Anything You Can Do…”

**EN canonical:** “Once per Round, after you Dodge or Clash, you gain an ‘Impression' with the same name as the attacker. As an Action with no Cost, you may spend any of your Impressions to use the indicated NPC's Attack as if you were an NPC. All Impressions are lost at the end of a Scene.”

**RU overlay:** “Один раз за Раунд после Уворота или Столкновения получите **Впечатление**, названное как атакующий. Действием без Стоимости можете потратить любое Впечатление, чтобы применить Атаку указанного NPC так, словно сами являетесь NPC. В конце Сцены все Впечатления теряются.”

**Digest:** `869edd09e775c11dce1b8a01408870c2841d5970e28544d2380ddcb6752718dd`.

**Semantic diff:** the name of the attacker becomes a `multiple` count instance under `impression`; the once-per-Round receipt key is enforced by the trigger router and all instances reset at Scene end. Selecting and spending an NPC Attack is not inferred from a client payload and remains a manual/Narrator action.

### `altruist.surgeon.2` — Operational Procedure

**EN canonical:** “After you take this feature or after you take an Intermission, lose any ‘Bandages' or ‘Disinfectant', then roll [Mind / 2]. For every odd number rolled, gain one Bandage. For every even number rolled, gain one Disinfectant. After you Operate you may expend a Bandage to heal a Wound, and/or a Disinfectant to remove any number of Effects.”

**RU overlay:** “После получения этой особенности и после каждого Антракта потеряйте все **Бинты** и **Антисептики**, затем бросьте `[Разум / 2]`. За каждый нечётный результат получите Бинт, за каждый чётный — Антисептик. После Операции можете потратить Бинт, чтобы исцелить Рану, и/или Антисептик, чтобы снять любое число Эффектов.”

**Digest:** `701325c8c91817a0ec796973befba9c45e3230ac5670fbb3271dbc3ff54ea40a`.

**Semantic diff:** the adapter owns two scene-lifetime stacks, both reset to zero at Intermission. The Mind roll, odd/even allocation, Operate validation, Wound healing and Effect removal are intentionally partial and require an explicit trusted operation.

### `altruist.bardic-savant.1` — Musician

**EN canonical:** “After you Breathe, gain a ‘Verse' of your choice from the list below. You can hold up to 4 Verses at a time (Including repeated verses). After you use Charge, you may expend all the Verses you are holding and grant the effects listed on them to characters in a 3x3 Zone placed adjacent to you. ‣ Harsh: Allies Strengthen and may move 1 space. ‣ Soothing: Allies gain [Mind / 2] Health. ‣ Inspiring: Hasten and give 1 Focus to allies. ‣ Raucous: Shred and deal 1 damage to enemies. ‣ Frantic: Allies may use a 1 Cost Utility action for free.”

**RU overlay:** “После Передышки получите выбранный **Куплет** из списка ниже. Можно хранить до 4 Куплетов, включая повторяющиеся. После Зарядки можете потратить все Куплеты и дать их эффекты персонажам в смежной с вами зоне 3×3. • **Резкий:** союзники становятся Усилены и могут переместиться на 1 клетку. • **Успокаивающий:** союзники восстанавливают `[Разум / 2]` Здоровья. • **Вдохновляющий:** Ускорьте союзников и дайте им 1 Фокус. • **Шумный:** Разорвите врагов и нанесите им 1 урон. • **Неистовый:** союзники могут бесплатно применить утилитарное действие со Стоимостью 1.”

**Digest:** `896edba28e9a933577bd1956f94da01f4f6beadc1452a5d4c52ac3e4038a5486`.

**Semantic diff:** the selected-item record `altruist.bardic-savant.verses` allows up to four entries and preserves repeated values. After a Breathe the adapter offers only the five canonical choices (the EN list has five choices); applying the area effects, spending all entries after Charge and the `[Mind / 2]` heal remain partial.

### `altruist.deckbuilder.1` — Draw

**EN canonical:** “After deploying, roll a die and set it aside. These dice are your ‘Cards'. After you Breathe with three or fewer Cards, roll a new Card. Before you Cast, you may spend any of your Cards to roll [Mind] instead of [Spirit], have it deal no damage to allies, and gain the Card's bonus. The bonuses for each are as follows: 1: Illness: Blights and permanently Slows the Target. 2: Star: Restore Focus equal to the damage dealt. 3: Night: The target Disappears and becomes Invisible. 4: Protection: Permanently Reinforces the target. 5: Union: Snare the target, Teleport adjacent to them. 6: Folly: Dazes, Immobilizes, and Launches the target.”

**RU overlay:** “После Развёртывания бросьте кость и отложите её: такие кости — ваши **Карты**. После Передышки с тремя или менее Картами бросьте новую. Перед Заклинанием можете потратить любую Карту, чтобы бросать `[Разум]` вместо `[Дух]`, не наносить союзникам урон и получить бонус Карты. 1: **Болезнь:** Портит и навсегда Замедляет цель. 2: **Звезда:** восстановите Фокус, равный нанесённому урону. 3: **Ночь:** цель Исчезает и становится Невидима. 4: **Защита:** навсегда Укрепляет цель. 5: **Союз:** Поймайте цель и Телепортируйтесь к ней. 6: **Безумие:** Ошеломляет, Обездвиживает и Подбрасывает цель.”

**Digest:** `4cc9dcace6206469b673302c5793c819f54edd9bbc31090aea4b22a016ef6b0b`.

**Semantic diff:** Cards are stored as `recorded-value` entries bounded to values 1–6 and reset at Scene. The die roll, Breathe threshold, Cast replacement, ally safety and six bonus effects remain partial; the record cannot be edited by a player outside a validated record operation.

### `altruist.deckbuilder.2` — Card Capture

**EN canonical:** “Once per Scene, after you Investigate an NPC's Attack, you can roll a Card with all of that attack's non-damage effects. At the end of the scene, you can replace a Card in your deck with that Card. You can only replace up to 3 of your Cards like this at a time, and can return your default Cards at any time.”

**RU overlay:** “Один раз за Сцену после Изучения Атаки NPC можете бросить Карту со всеми не наносящими урон эффектами этой Атаки. В конце Сцены можете заменить ею Карту своей колоды. Одновременно так можно заменить не более 3 Карт; стандартные Карты можно вернуть в любое время.”

**Digest:** `e6c003921a7f4ac2390ae9b65fe104c443f63dedf9df50505bce49285e2b0d6a`.

**Semantic diff:** `altruist.deckbuilder.captured-card` records one canonical die value with Scene lifetime. The once-per-Scene Investigate gate and the replacement limit/default-card restoration are not guessed by the inventory adapter and remain manual.

### `ruiner.mana-blades.1` — Call Arms

**EN canonical:** “Choose a Technique with the \"Weapon\" Tag that you don't have, it's added to your ‘Arsenal'. After you Breathe or Charge, you may ‘Forge' a number of Techniques from your ‘Arsenal' equal to the focus gained. Before you Cast, you may spend a Forge to gain the 1st level of its Technique during the Cast, and make the Cast count as a Skirmish as well.”

**RU overlay:** “Выберите отсутствующую у вас Технику с тегом оружия и добавьте её в **Арсенал**. После Передышки или Зарядки можете **выковать** число Техник Арсенала, равное полученному Фокусу. Перед Заклинанием потратьте одну ковку, чтобы на время Заклинания получить 1-й уровень её Техники и считать Заклинание также Стычкой.”

**Digest:** `eacb55ca05c443bfe0782ea2a16415a37749691da1166a9298433934ae40257a`.

**Semantic diff:** the typed contract exposes a private `multiple selected-item` Arsenal and a scene-lifetime Forge stack. Weapon-tag validation, Focus-derived Forge count, temporary level gain and Cast-as-Skirmish are partial and require trusted technique/action adapters; no technique-id switch is added to the engine.

### `ruiner.long-draw.1` — Nock The Arrow

**EN canonical:** “Gain a new Action, ‘Prepare'. Prepare costs 1 AP, is Swift, and gives you one ‘Prep'. Once per Turn, Before you Skirmish or Talent Finisher, spend your Prep to gain 2 additional range & Advantage for each Prep spent, up to a maximum of 6 Prep.”

**RU overlay:** “Получите новое Действие **Подготовка**: оно стоит 1 ОД, является Быстрым и даёт одну единицу **Подготовки**. Один раз за Ход перед Стычкой или Завершением Талантом потратьте любое число Подготовки, получив по 2 дополнительной дальности и Преимущества за каждую, но потратить можно не больше 6.”

**Digest:** `16797d24282b090cf8d8967f8c6b48cdb67d5e95fc30f3c456a0a786954da4d9`.

**Semantic diff:** the typed `charges` record has maximum 6 and Scene lifetime; its spend is available only through the validated inventory operation. The new Prepare action, once-per-Turn timing, range/Advantage calculation and attack modifier remain partial.

## Audited but intentionally not duplicated

Will-O-Wisp I (`718c1072bf9fb744208642697c7e52e01925efc76cb61a9e04e7a5bf85789c30`) already has a canonical marker, selected spirit options, movement and attack push pipeline in `scene-triggers.js`/`scene-responses.js`; a second typed flame record would create two authorities. Spellcrafter I’s Innovation is already the existing alternate `ruleResource` (`cd258e50964ec7fdf255d20dfb2a710459dc94dfbb4c5c3e9ea73e8ff6f98303`). Grim Ascendant’s Corruption is the existing alternate resource/transformation slice, so it is not reclassified as ordinary inventory. Assassin, Poacher and Empath have no independent item/charge slice in this batch.

Frost Veiler II (`32667d8918127c1729dc39430bde0375999651854e06e8cd599d91b7fcd14f30`), Grim Ascendant II (`f9768c5e588f5471e9e1e5b145e1b9ec0216d2fcba298f5c64364b027af2bf96`), and Empath III (`4473ee348631cf63dd51750aca3869aac5f3abb159e490f4b390407c8ac61f73`) were flagged as stale and are not consumers of this contract. Their registry notes are not copied into the typed adapter.
