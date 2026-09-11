# LionWing numeric passives handoff

Дата среза: 11 сентября 2026. Источник механик: canonical EN edition
`dawn-en-lionwing-cb2f8e67` в
`source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/*.json` и
собранный из него `extracted-companion.json`. Русский слой используется только
для отображения и не меняет каноническое решение.

## Общий контракт

Числовые правила включаются явным `actor.lionwing.automation[ruleId] === true`
и доступны только если уровень Техники есть у персонажа. Адаптеры читают
авторитетного владельца из `Scene.actors`; состояние из копии actor, request
payload и косметических context-флагов не доказывает условие. Ядро является
единственным writer: boundary, reaction и action receipts проходят через
`lionwing-engine.js`, сохраняются в Scene и повторно безопасно читаются после
JSON save/load и replay.

Каждый вклад источника несёт `id`, `label`, `amount`, `operation`, полный
`sourceDigest`, `coverage`, `sourceType` и `reason`. `sourceType` равен
`canonical` для Техники и `temporary` для выданного на срок модификатора.
Типизированные операции проходят один порядок:

```text
replace → multiply → add → min (floor) → max (cap) → round
```

`min` поднимает значение до floor, `max` ограничивает значение cap. Поэтому,
например, базовая дальность 1 с `+5` Sniper II и floor 5 Sniper I даёт 6:
сначала складывается 6, затем применяется floor. Несовместимые `replace`
возвращают конфликт Нарратору вместо молчаливого выбора.

## Автоматизированные числовые потребители

| Контур | Canonical consumers | Что проходит через общий quote |
| --- | --- | --- |
| Максимум Здоровья | Giant Frame II | `[Body]` добавляется к `maxHp`; источник виден в stats quote. |
| Скорость | Iron Bodied I; обычные Hasten/Slow | floor 3 остаётся числовым источником, а Hasten/Slow применяется как контекстный множитель движения. |
| Броня | Iron Bodied II; Monastic Sage I; Duelist II | постоянные stat-вклады и текущая Tension для Block; Tension хранится только в pending response как временная Armor. |
| Уклонение | Untouchable I–II; Drunkard II | первый фактический Dodge в Round получает `+Talent`; Dodge получает `+1` движение; Drunkard выдаёт bounded modifier на начало следующего собственного Turn. |
| Дальность | Lancer I–III; Sniper I–II; Flame Heart III; Heavenly Saint III | typed `range` quote для Skirmish, Body/Talent Finisher и Spirit Finisher; уровни Lancer I–II складываются как floors 2 и 3. |
| Преимущество | Braggart I; Lancer I/III; существующие attack/cast adapters | фактические Attack/Clash pools получают источники; Braggart требует полный авторитетный Pride Clock, Lancer III — непосредственную Breathe → Skirmish запись. |
| Стоимость | существующий `actionQuote` (Alchemist, Artist, Creator, Weaponsmith, Assassin и другие foundation paths) | cost modifiers остаются в typed action quote; этот проход не выдаёт общий статус готовности для новых сложных условных цен. |

Атаки используют per-target `attackQuote`, поэтому числовые Advantage и
дистанционные источники участвуют в авторитетном pool, а не только в панели.
Произвольные броски вне этого пути и уникальные последствия Техник всё ещё
требуют ручного решения.

## Отображение на столе

Панель «Источники числовых характеристик» добавлена в карточку своего героя
игрока и в инспектор выбранного обычного персонажа у Нарратора. Для каждого
max Health, Speed, Armor, Evasion и диапазона показываются:

- базовое значение листа;
- canonical Technique rows с операцией, величиной, коротким digest и пометкой
  `partial`, если путь неполный;
- временные rows с отдельным типом источника и объяснением срока;
- контекстный пример Advantage для Skirmish на дистанции 1.

Скрытые карточки других игроков и crowd-инспектор не раскрываются. Панель
читает `SceneEngine.effectiveActorStats`, поэтому отображаемое значение и
значение, которое проверяет action/reaction engine, используют один contract.

## Что осталось partial или manual

- Duelist II: автоматизированы Tension Armor в Block; adjacency, Daze и push
  вместо владельца требуют отдельной реакции.
- Lancer II–III: автоматизированы range/Advantage floors и cap; половинный
  урон промежуточным целям, дополнительная зона, Difficult Terrain и выбор
  полной последовательности остаются manual.
- Sniper II: range при авторитетной Immobilized state; вход в Bunker Down и
  Crit 5–6 остаются manual.
- Untouchable II: базовый `+1` к движению Dodge; опциональный повторный Move
  после нулевого урона остаётся decision.
- Drunkard II: размер и срок bounded modifier автоматизированы. Срок выбран
  консервативно до следующего собственного начала Turn, чтобы не превратить
  lifecycle-эффект в постоянный stat; столу нужно ручное решение, если
  используется другая трактовка расходования.
- Flame Heart III: spell Advantage и Spirit Finisher range 5 автоматизированы;
  снятие Blight и X-area остаются manual.
- Heavenly Saint III: Spirit Finisher range 5 автоматизирован; heal,
  Regeneration, wound и снятие эффектов остаются manual.
- Braggart I: clock creation/fill ведёт существующий foundation; этот adapter
  только читает полный clock. Braggart II Hold Back и дополнительное
  Advantage по размеру clock остаются decision/manual.
- Новые кандидаты с условными cost/area/resource правилами (например Vanguard
  Defender II, Shield Bearer I, Chemist I и Long Draw I) перечислены аудитом,
  но не объявлены автоматизированными без отдельного канонического пути.

Семейства derived-actions, followup-lifecycle, duel-entry, Siren/Bombardier,
Master at Arms/Field Investigation, Skirmisher/Detective/Jab и Grim/Frost/
Student в этом проходе не изменялись.

## Проверки и границы доказательств

Добавлены meaningful tests для stacking, removal, JSON reload/replay,
authoritative-vs-forged state и реальных потребителей Braggart, Duelist,
Lancer, Sniper, Untouchable, Drunkard и Heavenly Saint. Отдельный UI test
проверяет раздельные base/canonical/temporary rows, partial labels,
контекстный Advantage и escaping пользовательских названий.

Генераторы `map`, `readiness`, `lionwing:map` и registry обновляют свои
производные файлы; статусы остаются честными `partial` и не создают
`automation-evidence` certification. Browser/network E2E evidence для этого
прохода не заявляется.
