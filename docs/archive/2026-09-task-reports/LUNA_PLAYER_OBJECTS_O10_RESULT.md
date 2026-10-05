# L02 / O10 — объекты Сцены и player projection

Дата: 2026-09-21

Статус блока: **connected / production projection verified; real player-view follow-up remains**

Commit SHA: указать после финального commit (`git rev-parse HEAD`)

## Изменения

- `apps/companion/scene-ui.js`: числовой источник для инспектора безопасно берётся из production LionWing engine/adapters, если `SceneEngine.numericQuote` не экспортирован. Это убирает production exception при открытии/обновлении заполненной Сцены.
- `apps/companion/tests/lionwing-player-objects-o10.mjs`: targeted test загружает production `lionwing-entities.js`, создаёт typed backing через `Entities.create`, проверяет полную Narrator projection, player redaction для actor/marker/object/area/wall, owner-only visibility и JSON reload. Projection mock не используется.

## Production entry point и запись

Вход проверен на реальной странице:

`/apps/companion/index.html?edition=lionwing&lang=ru&mode=play`

Сцена была сначала пустой (`Сцена ждёт героев`), затем через production UI установлен preset `Руины Мелнума · Рааша и команда`. На поле присутствовали 12 акторов, 6 объектов/местностей, 2 стены и 2 маркера; inventory показал `22 объектов` с поиском, фильтрами, полями `Вид / Владелец / Пространство / Срок / Состояние`, unbound reason и кнопкой `Показать на поле`.

Скрытый marker создан в production map editor: тип `hidden`, label `Скрытый ключ`, клетка D7; на GM-поле появился `?`. Owner fixture записан production writer через `commitScene`, а не подменой projection: actor `Сигнал теста` получил текущий `Sync.state().userId` как `ownerId`, версия Сцены стала 13.

Путь чтения: `renderLionwingEntities` → `DAWN_LIONWING_ENTITIES.projectScene` → projected actors/markers/objects/areas/walls/entities. Путь записи: map/inventory UI → `commitScene`/`commitSceneEvents`; entity registry writer — production `DAWN_LIONWING_ENTITIES.create`. Hidden/private backing в player projection редактируется до `backing: null` + `backingHidden`, а hidden backing collections удаляются из player scene.

## Проверки

- `node tests/lionwing-player-objects-o10.mjs` — pass.
- `node tests/lionwing-scene-objects-ui.mjs` — pass.
- `node tests/lionwing-entities-ui.mjs` — pass.
- `node --check scene-ui.js`, `node --check lionwing-ui.js`, `git diff --check` — pass.
- `npm test` — pass полностью, включая foundation bridge, typed targets, entities removal, production QA и alpha stress. Ожидаемый legacy `0.9 Raasha` fixture остаётся skipped без `DAWN_RAASHA_FIXTURE`.

## Mocks, dependencies, not-run

В браузере projection не подменялся: preset, marker и owner были созданы/записаны production UI/writer. Targeted test использует только минимальную JSON fixture как вход production API; mock projection отсутствует. Зависимости: `index.html` загружает `lionwing-entities.js` до его consumers, затем существующие Scene/Sync/engine/UI.

После остановки браузерного обхода по запросу родительской задачи отдельно не доведены до полного real-browser evidence: переключение на player view с повторным snapshot скрытого marker/owner-only row и фактический клик `Показать на поле` в заполненной странице. Эти сценарии покрыты production projection/UI targeted tests и остаются финальным manual follow-up. Локальный Python server также отдал один route `404` для history URL `/index.html?lang=ru&edition=lionwing&mode=build`; это mount сервера, не exception companion runtime.

Ограничения: не проверялся live Supabase/RLS с двумя сетевыми клиентами и внешний deployment host. Изменены только разрешённые `scene-ui.js`, targeted test и этот report; `app-core.js`, generated output и maps относятся к параллельной работе и не включаются.
