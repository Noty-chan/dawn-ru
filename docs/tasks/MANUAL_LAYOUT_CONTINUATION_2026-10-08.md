# Ручные расстановки и приватность · продолжение 8 октября

Работа продолжена в том же чате по просьбе пользователя до 4% остатка пятичасового лимита. Ветка `codex/manual-table-review-20261008`, база `fd99180`. Main не менялся. Постоянный reviewer на низких размышлениях; прежнюю одноразовую глубокую проверку не повторяли.

## Реализовано

- `table.command layout/replace`: одна атомарная замена текущего поля или всех полей полного пресета. Отдельные payload version/epoch проверяют именно состояние предпросмотра, а не только текущую версию authority flush. Player намерения её не допускают.
- Импорт ограничен полями, участниками без чужих sheet/owner identity, обозначениями и артами. Preset LionWing не принимает legacy enemy profiles. Не импортируются runtime LionWing, receipts, журналы, policy, pending или история пресета. Поле/карта ограничены caps и уникальными ID; отказ не оставляет частичного удаления.
- Существующие герои сохраняются. Ресурсы, эффекты, флаги и прочие значения не пересчитываются; координаты ограничиваются новым полем. Удалённые typed технические ссылки отделяются. Исторические inventory journals/receipts не переписываются при detachment. Старые combat round/tension/turnSerial/pointer заморожены; manual pointer сбрасывается лишь если его участник удалён.
- HTML-предпросмотр с явными числом участников/областей/Стен/меток, подтверждением и отменой. Роль, комната, версия и epoch проверяются повторно. На общем столе сообщение говорит об ожидании сохранения. Размер preview проверяется перед отправкой. Native `window.confirm` заменён доступным dialog после блокировки локального IAB при браузерной проверке.
- Сохранение ручного полного пресета больше не сбрасывает AP/флаги использования и combat bookkeeping его копии.
- Manual normalize сохраняет старый frozen activeActorId даже после удаления его токена: автоматическая очистка делала Undo несовместимым с запретом изменения combat state. Rules cleanup сохранён.

## Найденные и исправленные аналоги приватности

Reviewer воспроизвёл настоящими producers утечки скрытого/удалённого владельца ауры, публичного inventory с закрытым source, effect provenance на видимом герое и public Entities с закрытым owner/backing/source. Компонент мог исчезать из проекции, но его identity оставалась в actor metadata или журнале.

- Общая read-only классификация hidden/orphan typed references. BFS распространяет приватность на зависимости сущностей; проверена цепь из трёх.
- Inventory projection использует один вычисленный predicate, без повторного обхода всей Scene для каждой записи.
- Видимый Эффект остаётся в `actor.effects`; закрытые sources и связанная root event provenance убираются из projected effectStates. Frozen authority не меняется.
- Последний слой LionWing повторно фильтрует entities, информацию, audit/feed и вложенное actor metadata по исходному authoritative Scene: промежуточное маскирование owner больше не теряет приватность.
- Аналогичная фильтрация и recursive redaction добавлены в **НЕПРИМЕНЁННУЮ** миграцию `202610080001_manual_table_public_records.sql`. Живой Supabase/действующие столы не использовались.

## Доказательства и ограничения

- `table-manual-layout.mjs`: настоящие reducers/producers, space/table replacement, caps, version/epoch/replay, отказ игроку, frozen values и historical journals, preview/cancel/confirm с подставленным DOM/transport.
- PGlite: private/orphan runtime, nested effect source/root provenance, snapshot backfill и повторное применение миграции. JS projection previews/inventory/deletion/snapshots/policy targeted PASS.
- Native local browser 1440×1000, origin18813: предпросмотр basic preset4/5/2/2, отмена сохраняет те же четыре token IDs; подтверждение даёт новые IDs; Undo восстанавливает исходные четыре одним шагом. Screenshot ignored `output/manual-layout-preview-20261008.png`. Full template и network transport в браузере в этом проходе не проверены.
- Полный `npm test` до последней tiny pointer поправки: PASS, `output/manual-layout-core-20261008-test.log`. Финальный receipt после неё: `output/manual-layout-ship-20261008-test.log`; статус записать после завершения процесса. Не заменять этим live RLS/Realtime gate.
- S00 пересобран штатным генератором: добавлены только ссылки на новую layout suite, канон не менялся.

## Дальше

1. Сначала прочитать текущий diff/receipt и проверить full template preview/confirm/reload/Undo в браузере, включая героя на другом поле и карты с private owned records. Проверить сохранённый manual preset с точными текущими HP/AP.
2. Явные ручные счётчики/переключатели техник и более ясный пульт: остаются следующей реализацией, в этот пакет не включены. Никакой авто-стоимости/эффектов из произвольного текста.
3. Безопасный start-rules preview и первый участник остаются отдельной задачей; guard не ослаблен.
4. Изолированный двухклиентный RLS/Realtime и применение SQL требуют безопасного контура; не тестировать на live Supabase/пользовательских комнатах. Main не объявлять готовым MVP до этих gates.
5. Полная desktop/RU/EN приёмка и atomic freeplay WIP остаются. Чужой stash/untracked не трогать.

Финальный receipt: полный npm test PASS exit0 — output/manual-layout-ship-20261008-test.log, после всех кодовых правок. Последний low reviewer: persistence/layout/snapshots/syntax PASS, новых существенных дефектов в проверенных путях нет. Остановка при 3% остатка пятичасового лимита.
