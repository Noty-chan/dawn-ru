## Приоритетные Техники LionWing — точка передачи, 2026-09-10

Срез проверен от `origin/main` на ветке `codex/luna-priority-techniques-v2`.
Каноном служит полный payload английского LionWing
`source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/*.json`;
реестр и старый перевод использовались только для навигации. Реестр считает
SHA-256 полного payload уровня (`id`, `archetypeId`, `techniqueId`, `name`,
`text`, `notes`, `source`).

Точные canonical identity: `vagabond.assassin` — Assassin;
`altruist.empath` — Empath; `altruist.will-o-wisp` — Will-O-Wisp;
`disruptor.hunter` — Poacher (ID исторический, новое canonical name именно
Poacher); `ruiner.cryomancer` — Frost Veiler (ID исторический);
`ruiner.grim-ascendant` — Grim Ascendant; `ruiner.spellcrafter` — Spellcrafter;
`disruptor.siren` — Siren; `vagabond.master-at-arms` — Master at Arms;
`vagabond.dim-mak` — Dim Mak; `ruiner.bombardier` — Bombardier.

В этом срезе реально изменены общие runtime-границы Cryomancer/Frost Veiler II
и Grim Ascendant I, а также targeted guards в scene tests. Frost Veiler II теперь
заполняет 4-сегментную Сосульку максимум один раз за конкретный
`actionInstanceId`, просит отдельный выбор цели перед оплатой, отменяет именно
полученный Фокус Передышки, очищает часы, наносит `ceil(Spirit/2) × segments`
через `damage.apply` и обездвиживает Slow-цель. Удалён старый скрытый quota
«быстрых Заклинаний/половины урона» и его `icicleHalo` payload. Grim Ascendant I
исправлен на канонический выигрыш 1 AP; старый `drainLife` half-damage/
Regenerating toggle больше не влияет на подготовку и разрешение действий.

Переиспользованы существующие engine-only lifecycle/resource guards,
`rule-clock`, action provenance, generic persisted choice, target validation,
damage/effect pipeline и duplicate/replay rejection. Клиентские booleans не
являются доказательством исполнения; adapters остаются declarative opt-in.

Аудит текущего состояния: Assassin I–III, Empath III, Will-O-Wisp I–III,
Poacher I–II, Spellcrafter I–III, Siren I–III, Master at Arms I–III и
Bombardier I–III имеют существующие slices разной полноты; Dim Mak I–III
имеет существующий отдельный integration path. Grim Ascendant II остаётся
`partial`: choice/linked Immobilized lifecycle уже есть в adapter, но полного
surface/network/persistence evidence нет. Frost Veiler II также `partial`, а
Frost Veiler I и III, Grim Ascendant III и не закрытые ветви Poacher III,
Empath I–II, Will-O-Wisp choice branches остаются manual/partial по registry.
Siren, Master at Arms, Dim Mak и Bombardier не объявляются E2E-certified:
части работают на core runtime, оставшиеся UI/save/network и сложные
Narrator choices требуют ручного участия.

Проверка: `node --test tests/scene-engine.mjs` и targeted family tests проходят;
полный `npm --prefix apps/companion test` требует обычного обновления четырёх
generated rule docs (`npm run docs:rules`) перед финальным commit/push.
