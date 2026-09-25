# S00 — воспроизводимая инвентаризация обычных NPC LionWing

Статус результата: **foundation baseline**. Это карта канона и существующих production-маршрутов, а не повышение готовности всех игровых правил. Числа и таблица профилей ниже сохраняют срез S00; последующие runtime-изменения уточняются в приложениях и повторно генерируемом `S00-INVENTORY.json`.

## Итог и знаменатели

Тест загружает `edition-lionwing.js`, `lionwing-table-data.js` и полный production engine через `tests/load-scene-engine.mjs`; список профилей и правил не переписан вручную. Снимок фиксирует:

- 41 обычный профиль NPC;
- 122 Action/Attack/Ace с уникальными canonical stable ID;
- 41 отдельную audit-запись пассива: 38 непустых и 3 `not-applicable` (Behemoth, Captor, Enchanter);
- 163 записи полного аудита, если считать 122 правила и 41 пассив, без смешения знаменателей;
- 12 модификаторов и 18 записей контура Антагонистов отдельно, вне 122.

На базовом срезе S00 фактический `enemyRuleAutomation` возвращал `34 attack`, `11 full`, `2 state`, `75 assisted`. После текущего пакета `S00-INVENTORY.json` заново сгенерирован и отражает `35 attack`, `31 full`, `2 state`, `54 assisted`. Эти значения обозначают лишь выбранную production-ветку. `full`, `state` и `attack` не означают полного покрытия текста, а `assisted` не означает отсутствия уже существующего вспомогательного кода. Все 41 пассива остаются вне этой классификации и требуют отдельного доказательства маршрута trigger → writer → persistence.

Полные данные находятся в `S00-INVENTORY.json`: exact EN, SHA-256 от exact UTF-8 текста, canonical path, PDF page из extraction, неизвестная печатная страница, declared status, фактический route, UI entry point, найденные тесты, not-run, зависимости, неоднозначности, остаток и волна.

## Источники и предел проверки

Приоритетным структурированным источником был `source/editions/dawn-en-lionwing-cb2f8e67/canonical/core-rules.json`; браузерный exact EN взят из `apps/companion/edition-lionwing.js`, а адаптированные профили — из `apps/companion/lionwing-table-data.js`. Runtime проверен через production-набор файлов `apps/companion/tests/load-scene-engine.mjs`.

Указанного планом файла `source/original/DAWN_ The RPG (LionWing Edition) w Bookmarks.pdf` в worktree нет. Поэтому визуальная сверка PDF и печатные номера страниц честно отмечены `not-run`; `pdfPage` сохранён из canonical extraction и не выдан за визуально подтверждённую страницу. Никакие значения не переносились из legacy `data.js` или старого PDF.

Production UI-маршрут для выбираемых правил: `scene-actions-ui.js useEnemyRule` → `DAWN_SCENE_ENGINE.availableEnemyRules` / `prepareEnemyRule` → `commitSceneEvents`. Общий entry point существует и для `assisted`, но в этом случае автоматический rule handler не выбран. Пассивы не имеют общего UI entry point и требуют отдельной трассировки lifecycle/attack/movement hooks.

## Ошибки прежнего учёта

1. Знаменатель 122 исключал пассивы. Из-за этого профиль мог выглядеть близким к полному при полностью неаудированном пассиве.
2. Старое «34 атаки и 10 козырей» не совпадает с реальной классификацией текущего runtime: кроме 34 `attack` здесь 11 `full` и 2 `state`, причём среди `full` есть Nest, Load и Neutralize Them, а не только Ace. Считать эти числа взаимозаменяемыми нельзя.
3. `assisted` использовался как суррогат `missing`. Это неверно: UI и общий prepare route могут существовать, а специальные подсемейства могут быть частично написаны.
4. Наличие handler иногда принималось за завершённость всего текста. Например, базовая Attack-ветка не доказывает пассив, повторные damage instances, delayed follow-up, source lifetime или правильную сторону союзного NPC.
5. Имена engine alias (`enemy.common.*`) и canonical stable ID (`lionwing.npc.*`) смешивались. В инвентаре canonical ID хранится отдельно; alias — только диагностическое поле.
6. Tests-by-name завышают доказательство: список тестов означает лишь найденное текстовое упоминание. Он не превращён в `verified`, а browser/network/PDF помечены `not-run`.
7. Default AP в table adapter выводится как 1, если exact action text не содержит явного `costs N AP`; Ace принудительно получает 2. Это производный runtime-контракт, который следующим пакетам нужно сверять с общим правилом книги, а не считать частью текста карточки.

## Карта 41 профиля

`A/F/S` ниже — количество текущих маршрутов `attack/full/state`; остаток до числа правил имеет `assisted`. Колонка «узел» показывает блокирующую механику, а не полный список (полный находится в JSON).

| Профиль | Волна | Passive | A/F/S | Главный узел и неоднозначность |
| --- | ---: | --- | --- | --- |
| Assassin | 4 | yes | 1/0/0 | Mark, Disappear на Deployment/после Attack, reappear geometry; собственные Attacks не снимают Mark |
| Bruiser | 4 | yes | 1/0/0 | неполный push → Dazed; Beatdown — отдельные damage instances; Decimate — конец следующего Turn |
| Behemoth | 4 | N/A | 1/0/0 | Disappear/reappear с Dodge-as-Attack; obstacle spawn; Meteor line-of-sight и 2 Wounds |
| Captor | 4 | N/A | 1/0/0 | уникальная ловушка, first entrant, attacked-this-Round fact; Sticky Bomb меняет pull/snare source |
| Executioner | 2 | yes | 1/0/0 | иммунитет Speed/movement prevention; charge-before-Cleave; Bifurcate path snapshot и delayed targets |
| Javelin | 3 | yes | 1/0/0 | уничтожение Fodder за range; diminishing Call; Shockwave delayed zone |
| Pugilist | 5 | yes | 1/0/1 | строгая 4-step последовательность, follow movement, double passive per Attack без схлопывания |
| Ranger | 2 | yes | 1/2/0 | Attacked, не damaged; Aim теряется только при движении в свой Turn; next hit указанной цели |
| Ronin | 2 | yes | 1/0/0 | +1 AP; одна и та же цель один раз за Turn; Sheath movement produces ordered Dissects |
| Viper | 5 | yes | 0/0/0 | после Attack movement, visited opponents, Filet alternate range disables Passive; multi-player teleport chain |
| Witch | 4 | yes | 1/0/0 | delayed zone anchored at attacked space; replace-only Runes; Explosion at global next-Turn end |
| Bodyguards | 3 | yes | 1/1/0 | profile represented by Fodder Zones; two KO conditions; mixed ally/opponent Behind Me |
| Broodmother | 3 | yes | 1/1/0 | damage trigger with live global Fodder count; coordinated one-space move; Fodder adjacency bonus |
| Cocoon | 5 | yes | 1/1/0 | Docile/Growth lifecycle; heal on waking; Rampage fresh-target loop with independent attacks |
| Duelist | 6 | yes | 1/0/0 | forced Challenge and adjacency; duel/compound interactions; target replacement |
| Glutton | 3 | yes | 1/0/0 | consume/remove Fodder as stored count; multi-target Slobber; Regurgitate exact recreation |
| Guardian | 6 | yes | 1/0/1 | adjacency redirection, Armor window and source; Imposing Presence state; next-Turn timing |
| Mount | 7 | yes | 1/0/0 | rider ownership, shared movement/targeting and KO detach; extra Attack sequencing |
| Oni | 6 | yes | 0/0/0 | effect-driven mode, Polaris is not generic damage+effect, shield/forced movement ordering |
| Paladin | 2 | yes | 1/0/0 | Regenerating relation for Gospel; healing/defense lifecycle; ally side must be relative |
| Revenant | 5 | yes | 1/1/0 | KO return next Round, placement failure, full heal; Hollowed Eyes source/state persistence |
| Spright | 2 | yes | 1/0/0 | Discombobulate three branches; equal positive Armor/Evasion has no stated result, 0/0 means neither |
| Bannerman | 7 | yes | 1/0/0 | banner ownership/aura, source loss, delegated choices and next-Turn effects |
| Builder | 6 | yes | 1/0/0 | destructible terrain creation/replacement, occupancy and field capacity; destroy-plan consumers |
| Coordinator | 7 | yes | 0/1/0 | chooses/delegates NPC action, actor/target ownership, nested reactions and serial completion |
| Doppelgänger | 7 | yes | 0/0/0 | only 2 canonical rules; copy snapshot vs live profile, ownership and cleanup; no invented third rule |
| Healer | 6 | yes | 1/0/0 | target filtering, capped heal, area/support source and lifetime |
| Illusionist | 6 | yes | 1/0/0 | two-NPC swap at Turn start; Flux lets player target enter passive; Shattered Skies own-next-Turn wording |
| Matriarch | 7 | yes | 0/0/0 | round-designated protected space, targetability exception for Matriarch, Banish plus movement |
| Martyr | 6 | yes | 1/0/0 | round-end heal; self-damage then armor aura; half missing Health snapshot; automatic Sacrifice trigger |
| Baron | 7 | yes | 1/0/0 | rotating named Action, once/Round interception and target replacement; Prescript deadline choices |
| Berserker | 2 | yes | 1/1/0 | one damage instance ≥4, once/Turn reaction; Seethe cap; Last Stand replaces Health/state |
| Cannoneer | 4 | yes | 0/1/0 | Preparation deployment/reset, Load movement fact; Fire is 3 damage instances and repeatable Ace |
| Cultist | 7 | yes | 1/0/0 | Tension increase provenance → Doom; player-Turn effective Tension; replace self with Giant host |
| Daredevil | 5 | yes | 1/0/0 | Tension-triggered straight movement, at most one adjacent damage per movement; range doubled after Ace |
| Enchanter | 7 | N/A | 1/0/0 | choice Effect then forced move; Attack conditional on existing source; commanded hostile Turn or Wound |
| Hound Master | 3 | yes | 1/1/0 | Fodder end-Turn speed; Seeker target ownership/path/explosion; Wild Hunt creates three distinct entities |
| Necromancer | 7 | yes | 1/0/0 | KO provenance creates Corpse; Fodder also counts as Corpse; revive consumes exact Corpses and clamps Tier |
| Privateer | 5 | yes | 1/1/0 | once/Round ally-Attack reaction within current attack range; escort follow distance; end-every-Turn move |
| Rifter | 5 | yes | 1/0/0 | every movement creates two Rifts including involuntary; once/Turn entrant choice; Implode shared-cell targeting |
| Swarm | 3 | yes | 0/0/0 | profile-as-Fodder Zones and two KO conditions; Tear movement before target selection; exact Daze-one choice |

## Обязательная модель механик и следующие семейные пакеты

Ниже «источник» — буквальный EN карточек и общие термины canonical; «вывод» — необходимое следствие общих правил/событий; «UI» — решение взаимодействия, которое не меняет механику.

### P1. Простые self/selected effects и лечение

Профили: Executioner Focus, Cannoneer Aim, Berserker Seethe, Assassin Neutralize Target, Paladin Gospel, Spright Discombobulate.

- **Причина и выбор.** Источник: выбранное Action; выбор делает Нарратор, Neutralize/Discombobulate требуют цель, остальные self или отфильтрованное множество союзников. Вывод: разрешать и вне собственного Turn по narrator override, сохраняя AP. UI: одна форма с явным self/one/all-filtered режимом.
- **Условия.** Источник: Gospel только Regenerating allies; Discombobulate только adjacent и сравнивает фактические Armor/Evasion. Равные положительные значения не подпадают ни под одну фразу; 0/0 — `neither`, значит Mark. Вывод: сторона определяется отношением actor/target. UI не предлагает недопустимых целей.
- **Цена и доступность.** Exact карточки не задают особую цену; table adapter применяет общий default 1 AP. Это нужно подтвердить общим PDF-правилом после появления PDF. Недостаток AP, KO, missing/stale actor блокируют до writer.
- **Порядок и состояние.** Effects и heal записываются отдельными canonical events после повторной проверки. Seethe вычисляет `2 + Tier × 2` в ядре и capped by max Health. Neutralize хранит source; собственные Attacks Assassin не удаляют Mark.
- **Взаимодействия.** Existing effect должен идемпотентно следовать общему контракту effects; heal не обходит Wounds/maxHp; allied NPC работает так же. Reload/export сохраняют effect provenance.
- **Примеры.** Tier 3 Berserker на 7/20 восстанавливает 8 до 15; на 18/20 — до 20. Spright против Armor 2/Evasion 4 замедляет. Контрпример: Armor 3/Evasion 3 не получает Mark только потому, что значения равны; при 0/0 получает Mark из `neither`.

### P2. Attack facts, числовые и реактивные пассивы

Профили: Ranger, Executioner, Paladin, Berserker, Spright, Ronin; затем Assassin/Bruiser как проверочные потребители.

- **Причина и окно.** Различать declared, targeted, Attacked, hit и damage instance. Ranger реагирует после `Attacked`, даже при Evasion/нулевом damage; Berserker — только после одного instance ≥4 и once per Turn; Bruiser — после фактического неполного push.
- **Условия/цена.** Пассив обычно не Action и не списывает AP, но выбор владельца сохраняется. Ronin получает +1 AP в начале каждого собственного Turn и блокирует повторную цель на весь Turn, включая follow-up Attacks.
- **Порядок.** Реакции открываются в указанном окне и не сворачиваются с damage. Ranger Headshot привязан к выбранной цели и следующему hit; Aim добавляет damage всем successful Attacks и сбрасывается только при движении Ranger на его Turn.
- **Состояние.** Once-per-Turn/Round ключуется boundary serial; target/source IDs переживают reload, отмена Attack не расходует next-hit marker. Source death/removal закрывает необязательные prompts по общему lifecycle.
- **Взаимодействия.** Armor/Evasion, Wounds, compound parts и allied NPC проверяются через относительные стороны; zero damage всё ещё может быть Attacked/hit в зависимости от факта.
- **Примеры.** Ranger атакован, полностью поглотил damage Evasion — prompt move 1 всё равно возможен. Berserker получает два damage по 2 — пассив не срабатывает. Контрпример: сбросить Aim от forced move в чужой Turn — правдоподобно, но против literal `moves on its Turn`.

### P3. Fodder, сущности и профили-массовки

Профили: Javelin, Broodmother, Glutton, Swarm, Bodyguards, Hound Master, Necromancer.

- **Причина/цели.** Calls создают source-owned entities; counts зависят от Tier и числа использований в текущем Round. Swarm/Bodyguards при Deployment заменяют тело профиля набором уникальных Zones.
- **Геометрия.** Range/edge проверяется на каждую выбранную клетку; Fodder может иметь canonical occupancy exceptions. Поле без места не должно silent-skip или падать в 0,0. Seeker хранит конкретную цель.
- **Цена/повтор.** Action AP списывается один раз после валидного полного набора клеток; diminishing count не превращает отменённую попытку в use. Ace threshold/reuse и extra Turn — отдельные условия.
- **Порядок.** Movement всех Zones завершается до выбора целей Tear/Behind Me. Seeker explosion, Broodmother damage reaction и Corpse creation — отдельные triggers. Нельзя объединять три Seekers в одну сущность.
- **Состояние.** Entity owner/source, round-use count, consumed/corpse flags и brace state сохраняются; source removal следует буквальному правилу, а не универсальному удалению всех созданных объектов.
- **Примеры.** Tier 2 Javelin первый Call создаёт 3, второй в том же Round 2; отменённый второй выбор не уменьшает следующий. Swarm сначала двигает Zones, затем выбирает до трёх adjacent opponents и ровно одну Daze-цель. Контрпример: запрет Fodder на занятой клетке через общий character occupancy без текста правила.

### P4. Delayed intent, ловушки и prepared attacks

Профили: Captor, Witch, Bruiser, Executioner, Behemoth, Cannoneer, Assassin Hidden Blades.

- **Причина/граница.** Сохранять `end of the next Turn` как следующий глобальный Turn boundary, а `start of its next Turn` как собственный boundary. Deployment/Disappear/entry triggers имеют отдельные факты.
- **Условия.** Intent хранит anchor/shape/target/source и необходимые snapshot values; live-состав области определяется только там, где текст говорит атаковать находящихся там позже. Line of sight/obstacle и trap entry пересчитываются авторитетно.
- **Цена.** Подготовка оплачивается ровно при commit; delayed Attack не требует второй скрытой оплаты, если текст её не задаёт. Cannoneer Fire использует threshold full Preparation, очищает Clock и допускает повтор Ace по literal exception.
- **Порядок.** Fire наносит damage три раза с отдельными реакциями/KO; Beatdown также отдельные instances. Hidden Blade срабатывает на entry, наносит damage, затем удаляется. Executioner сначала charge или разрешает Cleave, не обе ветки одновременно.
- **Состояние.** Persisted intent переживает reload; stale target, source KO/removal и cancel имеют явную очистку. Private information/indicated zone не должна утекать, если канон делает её скрытой.
- **Примеры.** Witch ставит Explosion, следующий Turn принадлежит герою: resolve на его end, не на следующем Turn Witch. Fire при Preparation 4 создаёт три damage instances и затем Clock 0. Контрпример: `3 × damage` одним `damage.apply` пропускает реакции между ударами.

### P5. Movement chains и последовательные атаки

Профили: Pugilist, Viper, Ronin, Rifter, Cocoon, Revenant, Privateer, Daredevil.

- **Причина/маршрут.** Использовать authoritative movement facts с path/visited adjacency, включая forced movement и teleport только там, где текст считает их movement. Каждая follow-up Attack заново открывает legal reaction chain.
- **Условия.** Viper атакует только ещё не Attacked им в этот Turn; Ronin не повторяет цель; Cocoon выбирает свежую adjacent цель; Privateer проверяет attack range в момент союзной Attack.
- **Цена.** Swift, extra Turn, movement AP и follow-up at no cost — разные признаки. Sheath делает следующее movement стоимостью 3 AP; это не цена каждого Dissect.
- **Порядок.** Сохранять ordered visited targets и останавливаться при KO/source loss/decline. Rifter создаёт origin и destination Rift на начале любого движения; entrant teleport choice once per Turn.
- **Состояние.** Sequence cursor, used-target set, passive step, Rift ownership и return scheduling переживают reload; отмена не оставляет половину chain без предусмотренного эффекта.
- **Примеры.** Viper после Attack проходит через двух новых opponents: предлагает Filet по порядку, второй не существует, если первый KO/source removal прервал chain. Ronin Sheath проходит adjacency героя входом и выходом — одна и та же цель всё равно только один раз за Turn. Контрпример: собрать обе атаки в multi-target roll.

### P6. Ауры, области, поддержка и перестройка поля

Профили: Guardian, Builder, Healer, Illusionist, Martyr, Oni, Duelist.

- **Причина/область.** Aura/zone пересчитывается на movement, source suppression/removal и boundary; swap считается Teleport для обоих. Destroy/create terrain идёт через единый destroy plan и geometry writer.
- **Условия.** Relative ally/opponent, same space/domain, distance metric и крупное тело проверяются ядром. Guardian replacement и Duelist challenge не могут обойти target legality/reactions.
- **Цена/порядок.** Self-damage Martyr происходит до выдачи armor aura; healing считается после фактического missing Health. Oni Polaris остаётся особой Attack, не generic damage+effect.
- **Состояние.** Aura owner, target replacement, Flux, terrain HP/ownership и delayed own-Turn markers сохраняются и чистятся по literal lifetime.
- **Примеры.** Illusionist меняет двух NPC местами и оба генерируют teleport facts. Martyr сначала получает self-damage, затем союзники в live range получают armor до конца следующего его Turn. Контрпример: snapshot списка союзников при создании ауры, если текст задаёт `all allies within` как live область.

### P7. Делегирование, копии и управление

Профили: Coordinator, Bannerman, Mount, Doppelgänger, Matriarch, Baron, Cultist, Enchanter, Necromancer.

- **Причина/владелец выбора.** Записывать controller отдельно от acting actor и source. Delegated Attack использует AP/cost/once limits того участника, которого называет правило; player choices остаются в prompt queue.
- **Условия.** Copy определяет snapshot/live границу только по exact text. Matriarch targetability — исключение для Matriarch, а не неуязвимость клетки. Enchanter принуждает отдельный Turn/Attack либо Wound.
- **Цена/порядок.** Nested reaction chains разрешаются последовательно одним writer. Cultist KO и spawn Giant — атомарный план с валидным местом; Necromancer сначала consumes Corpses, затем создаёт профили с Tier clamp.
- **Состояние.** Ownership, copied source digest/profile revision, rider/host link, named-action history, Doom, designated spaces и prompt controller переживают reload и не утекают в player projection.
- **Примеры.** Coordinator делегирует Attack союзному NPC: реакция цели видит союзника как attacker, Coordinator остаётся source правила. Baron перехватывает named Action один раз за Round и становится целью до damage. Контрпример: копировать будущие изменения профиля Doppelgänger без literal live-copy указания.

### P8. Модификаторы, Compound и Антагонисты — отдельные контуры

12 modifiers и 18 antagonist records перечислены в JSON, но не входят в 122. Их нельзя использовать для повышения ordinary NPC coverage.

- **Модификаторы.** Нужны attach/detach, Host/Part ownership, stat conflict rule, large footprint, board expansion, stored scene modifier, targetability и source loss. Gargantuan/Giant требуют отдельной геометрической приёмки.
- **Compound.** Общие Health/body/Parts, KO, range drawing и профильные пассивы должны композиционно работать без проверки `kind === enemy`.
- **Антагонисты.** Edge содержит три способности с общими 3 free uses/Scene, затем Antagonism; Phase Change, Antagonist Actions и bond actions имеют собственные ресурсы и privacy. Это волна 9, не «ещё один NPC Action».
- **Пример.** Cultist Grand Calling создаёт обычного NPC и прикрепляет Giant: сначала принимается spawn обычного профиля, затем attach modifier отдельным атомарным планом. Контрпример: добавить Giant в ordinary profile denominator или автоматически тратить Tension вместо проверки threshold.

## Рекомендуемый порядок содержательных пакетов

1. P1 как малый вертикальный срез: доказывает payment/effects/heal/relative side и закрывает шесть Action без нового интерпретатора.
2. P2 сразу после P1: формализует факты Attack/hit/damage/movement, без которых нельзя честно принять даже существующие base attacks.
3. P3 выделяет source-owned entities и full-field cancellation; после него можно отдельно принимать Swarm/Bodyguards и creators.
4. P4 вводит один persistable delayed-intent контракт на Captor/Witch/Bruiser, затем расширяет Executioner/Behemoth; Fire остаётся serial-damage consumer.
5. P5 использует уже принятые movement facts и serial attacks.
6. P6 принимает aura/destroy/target-replacement seams до сложного управления.
7. P7 запускать по одному профилю: Coordinator → Mount/Bannerman → Matriarch/Baron → Cultist/Necromancer → Doppelgänger.
8. P8 только после полного ordinary-profile контура; Антагонисты остаются отдельной очередью.

## Проверки

- `node apps/companion/tests/lionwing-enemy-inventory.mjs --write` — генерация и самопроверка снимка;
- `node apps/companion/tests/lionwing-enemy-inventory.mjs` — passed;
- `git diff --check` — выполнить перед коммитом;
- browser — not-run;
- two-client network/reconnect — not-run;
- визуальная сверка LionWing PDF — not-run, файл отсутствует;
- полный `npm test` — не нужен для read-only runtime inventory и будет отмечен отдельно, если не запускался.

## Остаток

Инвентарь не утверждает ни одного полностью готового профиля: даже Ranger имеет непроверенный здесь passive route и browser/network acceptance. Следующая работа должна обновлять evidence по canonical stable ID и отдельному passive audit key, сохраняя три независимых процента: покрытие правил, полностью закрытые профили, browser/network accepted профили.

### Обновление после W3.5

Builder `Army Of Stone` теперь имеет production-маршрут `full`: 2 ОД, порог 2 Напряжения, преобразование Terrain во всех пространствах, сохранение/переиспользование союзных Зон и дополнительный Ход. Обновлённые тесты и маршрут записаны для `lionwing.npc.builder.army-of-stone` в JSON inventory. Javelin `Crushing Impact` по-прежнему имеет автоматизированный Attack-маршрут, но его пассив расхода Fodder ради дальности остаётся частичным: удалённый выбор не подменяет каноническую self-anchored область 2×2. `Shockwave` пока assisted. Эти статусы не заменяют браузерную и сетевую приёмку.
