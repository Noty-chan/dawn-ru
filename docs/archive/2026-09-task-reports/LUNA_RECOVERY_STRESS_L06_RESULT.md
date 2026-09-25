# L06 — стресс восстановления LionWing

Дата: 2026-09-21. База и проверяемый срез: `d7e24a1565806e074189a640fce9c2229b05cf94` (`origin/main`). Ветка: `codex/luna-l06-recovery-stress`.

Это read-only аудит существующего хранения. Runtime, UI, БД, supplements, generated maps и пользовательские сохранения не менялись. Добавлены только [тест](../../../apps/companion/tests/lionwing-recovery-stress.mjs) и этот отчёт.

Fixture нейтральная и полностью синтетическая: три пространства (`main`, `vault`, `balcony`), два героя и два врага, источник Эффекта от актора и источник от местности/маркера, обычный Фокус и ресурс `momentum`, часы актора и часы Сцены, Стена/область, ручная Атака с ожидающей Реакцией и pending Resistance. События проходят через LionWing dispatcher и Scene event path.

Проверенный сценарий дал 280 событий. После разрешения ручной Атаки и Resistance добавлены 270 нейтральных событий журнала. Факты подтверждают лимит журнала: остаются последние 200 строк, первая нейтральная строка удалена. Отдельная механическая история сохранила факт траты ресурса/счётчика. В fixture выполнены 25 undoable изменений; реально доступны последние 20 снимков, затем проверены undo и redo.

Слои восстановления проверены раздельно:

- **localStorage** — вызван существующий `persist`, затем JSON reload и нормализация. При отказе записи `STORAGE_KEY` (`QuotaExceededError`) исходная корректная строка осталась неизменной.
- **IndexedDB recovery** — вызваны существующие `saveTableRecovery`/`readTableRecovery` через детерминированный IndexedDB harness с `open`, `transaction`, `put` и `get`. Pending Resistance переживает checkpoint и reload. При отказе транзакции IndexedDB и переполнении recovery-ключа localStorage предыдущая корректная IndexedDB-точка сохранилась.
- **Экспорт** — `tableBackupPayload` → JSON → `normalizedTableBackup`; pending Resistance, ресурсы, часы, источники Эффектов и пространства восстановлены.
- **Undo** — использованы существующие `commitScene`, `undoScene` и `redoScene`; проверены предел 20, удаление только пяти самых старых записей и возврат последнего имени.

Сравнение делается по семантическому состоянию: рекурсивно сортируются ключи объектов, а `at`, `exportedAt`, `openedAt` и `updatedAt` исключаются. Сравнение не проверяет строки исходников и не зависит от порядка JSON-ключей.

Запущено и прошло:

- `node tests/lionwing-recovery-stress.mjs` — `280 events`, 3 пространства, journal 200, undo 20, localStorage/IndexedDB/export/import/reload/failure preservation.
- `node tests/lionwing-entities-persistence.mjs`.
- `node tests/lionwing-counters.mjs`.
- `node tests/lionwing-engine.mjs`.
- `npm test` — завершён без ошибок; в штатном прогоне exact-sheet legacy Raasha пропущен без `DAWN_RAASHA_FIXTURE`, shared UI assertions прошли.
- `git diff --check` — прошёл.

Не запускалось и не выдаётся за доказанное: настоящий Chromium/Firefox reload с реальным IndexedDB, реальная квота браузера, UI скачивания/выбора файла в браузере, Supabase/два live-клиента, опубликованный URL, старый exact-sheet Raasha с личным fixture. Эти поверхности относятся к R08/R11/R12 и не нужны для read-only L06 unit/integration stress. Пользовательские данные не использовались.

Малой ошибки в runtime по этому сценарию не обнаружено; предлагаемый patch отсутствует. Итоговый commit SHA сообщён в handoff после локального коммита; базовый SHA результата — `d7e24a1`.
