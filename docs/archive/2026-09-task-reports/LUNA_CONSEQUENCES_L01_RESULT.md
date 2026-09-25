# L01 — постоянная запись последствий Уязвимости

Дата: 2026-09-21
Редакция: LionWing (`rulesEdition: "lionwing"`)
Источник: новый LionWing PDF, печатная стр. 37 (PDF 38), правило `lionwing.core.knockouts.consequences`.

## Сделано

`apps/companion/lionwing-engine.js` теперь создаёт выбор пяти канонических категорий с постоянными ID:

- `skill-ranks` — Ранги Навыка с Рангом 2+;
- `ability-part` — часть Способности;
- `boon` — Дар;
- `technique-levels` — два Уровня Техник;
- `death` — смерть и создание нового героя.

Выбор сохраняется в `actor.lionwing.consequences`, а использованные категории индексируются в `usedConsequenceCategories`. Запись содержит `id`, `category`, `lossTarget`/`target`, `choiceId`, `reason`, `status`, `applied`, сцену и событие создания. Состояния `pending-manual` и `applied` разделены: движок только фиксирует решение и не удаляет Навыки, Дары, Способности или Техники.

Повторная категория блокируется до тех пор, пока Нарратор явно не пометит запись `void`. Исправление доступно через существующую операцию `correct` с `resource: "consequence"`; оно может изменить цель потери и статус, но сохраняет запись и журналирует `consequence.corrected`. `scene-reset` сбрасывает Уязвимость и состояние боя, сохраняя последствия героя.

Старое сохранённое окно `choice.kind === "consequence"` с единственным `record` по-прежнему принимается. Его заметка хранится отдельно в `actor.lionwing.legacyNotes` как `type: "legacy-note"`; по заметке категория не угадывается.

Публичные read-only точки для следующего UI: `DAWN_LIONWING_ENGINE.consequenceCategories()` и `consequenceStatus(scene, actorId)`.

## Проверено

Новый сценарий `apps/companion/tests/lionwing-consequences.mjs` покрывает:

- обычный и Уязвимый KO;
- двух героев и отсутствие Влияния у союзника;
- одну категорию на героя и повторную попытку;
- постоянную запись после JSON reload;
- повтор исходного KO-события без повторной награды;
- Scene reset с сохранением записи;
- исправление Нарратора (`pending-manual` → `applied`);
- отсутствие автоматического удаления Дара;
- старое `record`-окно и отдельную `legacy-note`.

Целевые команды:

```powershell
node apps/companion/tests/lionwing-consequences.mjs
node apps/companion/tests/lionwing-engine.mjs
```

Обе завершились с exit 0. `git diff --check` также пройден.

Дополнительно `npm test` в `apps/companion` завершился с exit 0. Встроенный
опциональный exact-sheet legacy-тест Рааши был пропущен самим набором без
`DAWN_RAASHA_FIXTURE`; это не относится к LionWing L01.

## Мост экспорта героя

Постоянство Сцены и резервной копии уже сохраняет `actor.lionwing` через `sceneCore()` в `apps/companion/app-core.js`. Самостоятельный экспорт героя пока не переносит это поле: `apps/companion/app-builder-events.js:78` сериализует `hero: S`, а `normalizeHero()` в `apps/companion/app-core.js:360-382` не читает `raw.lionwing`. Поэтому L01 не объявляет мост экспорта завершённым и не меняет чужие файлы.

Точный patch для интегратора L04: перед `JSON.stringify` на строке экспорта найти связанного актёра LionWing по `Scene.actors[].heroId === S.id`, добавить в экспортируемый снимок `hero.lionwing.consequences` и `hero.lionwing.legacyNotes` (с копированием JSON), затем расширить `normalizeHero(raw)` теми же двумя массивами с лимитом и проверкой ID/категорий. При импорте/привязке героя эти записи нужно вернуть в runtime-актора; нельзя считать сохранение только в `S.runtime` достаточным.

До этого моста запись проверена для Сцены, JSON reload/replay и table backup пути, но не для отдельного файла героя.
