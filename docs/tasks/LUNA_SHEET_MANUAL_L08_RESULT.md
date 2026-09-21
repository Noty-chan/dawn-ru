# L08 — удобный лист LionWing для ручной игры

Дата: 2026-09-21  
Ветка: `codex/luna-l08-sheet-manual`  
База: `origin/main` / `252cf9263a2defc65381bfde2bb6932290afef5d`  
Статус реализации: лист — `verified`; мост последствий — `connected`; сохранение моста через нормализатор героя — `blocked` до минимального контракта в `app-core.js`.

## Что стало доступно в UI

Точка входа — просмотр героя в `renderHeroView()` → `renderHeroPlaySheet()` в `apps/companion/hero-ui.js`. Заполненный лист теперь показывает:

- предупреждение о незавершённой сборке и остаётся пригодным для игры;
- отдельную памятку «Как играть за столом» с явным указанием, что просмотр ничего не тратит;
- выбранные Дары с полным текстом и Связи с рангом, тегами и направлением к действию;
- базовые действия, ресурсы и существующие броски;
- Уровни Техник с полным текстом правила и фильтрами `all/full/decision/partial/manual`;
- для каждого `partial` и `manual` Уровня — «Что сделать», «Когда», «Ресурс», «Цель», «Куда перейти» и кнопку «Открыть стол»;
- read-only историю последствий Уязвимости, если есть связанный участник Сцены или импортированный мост.

Кнопки ручного шага и Дара/Связи только ведут к существующему переходу `setMode("play")`. Они не запускают отдельную Технику и не списывают ресурс. Запись состояния по-прежнему выполняется существующими обработчиками Стола.

Старый лист не переиспользует LionWing-проекцию: фильтрация и карточка находятся внутри LionWing-представления, а edition metadata сохраняется при export/import. Проверка `tests/edition-isolation.mjs` прошла.

## Acceptance gate

| Поверхность | Статус | Доказательство и граница проверки |
|---|---|---|
| Заполненный/незаполненный лист | `verified` | Реальный браузерный путь `?edition=lionwing&lang=ru&mode=build`: заполненный лист отобразился, а сборка с оставшимися незаполненными рангами показала предупреждение и оставалась интерактивной. |
| Дары, Связи, базовые действия | `verified` | Реальный DOM показал выбранные Дары с текстом, Связи и переход `Открыть стол`; просмотр оставался read-only. |
| Фильтры `manual` и `partial` | `verified` | В браузере нажаты `Вручную / не поддерживается` и `Частично автоматизировано`; каждая выборка показала соответствующие Уровни, полный `ruleTextMarkup(level.text)` и ручной guide. |
| Полный текст уровня | `verified` | В обоих реальных фильтрах текст уровня присутствовал рядом с guide; не заменён пересказом. |
| Переход на Стол | `verified` | Нажат реальный `Открыть стол`; приложение перешло в `mode=play` и показало `Сцена DAWN` и `Участники`. |
| История последствий в листе | `connected` | Production renderer читает связанного actor через `globalThis.Scene` и экспортный bridge без записи. Поведение whitelist/очереди покрыто тестом; populated actor с последствиями в браузере не был доступен. |
| Hero export/import bridge | `connected` | Export добавляет отдельный `content.lionwing` и `hero.lionwing`, import принимает эти формы и переносит только bridge records. Реальный download→reload/import путь с заполненным actor bridge — `not-run`. |
| Table backup | `connected` | Существующий `sceneCore` сохраняет `actor.lionwing` в table backup; новый hero bridge не смешивает этот канал с combat queue. Backup/reload/replay/stale/network sanitizer для нового bridge — `not-run`. |
| Persistence после hero import | `blocked` | `normalizeHero()` и `persistableHeroes()` в locked `app-core.js` отбрасывают произвольное `hero.lionwing`; до интеграции контракта ниже мост живёт в импортированном runtime-объекте, но не гарантирован после reload. |

## Реальный браузерный прогон

Локальный сервер был поднят из `apps/companion`, затем открыт LionWing build page в Playwright. В тестовом герое были выбраны имя, концепция, Outlook, два Дара, навыки и уровни Техник так, чтобы одновременно присутствовали `manual` и `partial`, но оставалось незаполненное требование сборки. Проверены предупреждение, Gifts/Bonds card, оба фильтра, полный текст и переход на Стол. Консоль: 0 ошибок, 0 предупреждений.

Не запускались: настоящий populated linked-actor export/import через браузер, reload после import, table backup/reload/replay/stale payload и network/privacy path. Поэтому bridge не повышен до `verified` только по VM/DOM проверкам.

## Раздельные каналы данных

Hero export теперь сериализует только bounded bridge:

```json
{
  "schema": 1,
  "consequences": [
    "schema", "id", "category", "lossTarget", "target", "choiceId",
    "reason", "status", "applied", "sceneSerial", "createdEventId",
    "manualNote", "correctedEventId", "correctionNote"
  ],
  "legacyNotes": [
    "schema", "id", "type", "note", "choiceId", "reason",
    "createdEventId", "sceneSerial"
  ]
}
```

В export сначала удаляется возможный старый `snapshot.lionwing`, затем в snapshot добавляется только этот bridge; `choices`, `pausedChains`, `deferred`, `afterAttack`, execution cursor и другие очереди не переносятся. Для совместимости bridge также лежит в `content.lionwing`. `Scene.lionwing` в hero export не используется.

Table backup и hero export остаются разными каналами: table сохраняет состояние участника Сцены вместе с его actor state, а hero export передаёт только ручную историю/заметки. Боевой порядок и очереди не должны попадать в hero file.

## Точный остаток для интегратора в locked `app-core.js`

Нужен минимальный контракт, без изменения канона и без записи боевой очереди:

1. В `normalizeHero(raw)` добавить `normalizeLionwingBridge(raw.lionwing)`. Разрешить только `schema: 1`, максимум 128 `consequences` и 128 `legacyNotes`, с whitelist полей, перечисленным выше; неизвестные поля и очереди удалять.
2. В `persistableHeroes()` сохранять результат этого нормализатора, чтобы import → local storage → reload не терял bridge.
3. В `heroActorState(hero)`/существующем binding path при связывании героя со Scene actor объединять bridge-массивы по стабильному `id`, не затирая независимые записи actor. Это merge только `consequences`/`legacyNotes`; не переносить `choices`, `pausedChains`, `deferred`, `afterAttack`, execution cursor или `Scene.lionwing`.
4. Не удалять автоматически Дары, Техники, Навыки или другие части сборки: записи с `pending-manual` остаются ясными ручными задачами. Авторитетная запись actor state остаётся существующему Scene reducer/commit path.
5. Добавить интеграционные проверки на normalize/persist/reload и actor merge, включая негативы для очередей и cross-edition import.

До этого контракта текущий код намеренно даёт `connected`: UI и файл умеют безопасно показать/перенести bounded bridge, но persistent writer находится в locked модуле.

## Проверки

- `node apps/companion/tests/lionwing-sheet-manual.mjs` — passed.
- `node apps/companion/tests/lionwing-hero-sheet-view.mjs` — passed.
- `node tests/edition-isolation.mjs` — passed.
- `npm test` — passed после единственного локального коммита (полный прогон завершился с exit code 0; итоговый SHA возвращён вместе с отчётом).
- `git diff --check` — passed.

Изменены только разрешённые файлы: `hero-ui.js`, `app-builder-events.js`, два собственных behavior/source tests и этот отчёт. `app-core.js`, `scene/ui`, `lionwing-ui`, network, locale/data/generated maps не изменялись. Push не выполнялся.
