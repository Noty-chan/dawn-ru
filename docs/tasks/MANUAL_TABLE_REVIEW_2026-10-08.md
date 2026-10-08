# Ручной стол: ревью и передача 8 октября

Ветка исправлений `codex/manual-table-review-20261008`, база этого прохода `b5c4fef` исходной `codex/manual-table-continuation-20261008`. Проверенный кодовый коммит — `b02f5cc`. Работа начата после согласованного ожидания. Сначала ревью и исправления; разовая глубокая проверка выполнена при остатке 59% пятичасового лимита, затем ревью снова на низких размышлениях. Main не изменён.

## Исправлено

- Новый пустой стол: ledger согласован с normalize, ручная нормализация не создаёт/пересчитывает замороженные ауры. Добавление первого НПС работает.
- Стресс: одинаковая семантика заполненных ромбов в обоих разделах; ручные подсказки не обещают автоматический вывод из строя. Верхние границы typed ресурсов согласованы с сохранением, NPC Focus сохраняется.
- Подтверждение ручного броска: стабильный ID через player intent, точный public rollFeed, scope стола/героя/policy epoch. Обработаны чужой/поздний reject, terminal outbox error, local authority rejection и failed RPC. Старый intent без ID совместим; коллизии и replay проверены. Живой транспорт не проверен.
- Shared join больше не проходит как Undo: metadata проверяется отдельно, audit — bounded legacy.note, скрытое имя не публикуется. Remote Undo не создаёт пустой kernel ledger, если его не было.
- Manual clock ID/name до 160 сохраняются без потери manual/владельца. Закрыт риск превращения private clock в public после normalize.
- Подготовка: manual массовка создаётся storage-only; недоступные compound/brush/trait controls скрыты, автоматические значки профилей сняты. Metadata добавление отклоняется целиком при превышении 120 участников или дубле ID.
- Приватность: в НЕПРИМЕНЁННОЙ SQL миграции удалены entityReceipts/boundaryReceipts, инвентарь ограничен active public definitions/records без journal/reservations и private mirror. Скрытые map/entity IDs фильтруются из журналов и runtime metadata. JS projection дополнена фильтрацией скрытых ссылок.

## Доказательства

- Targeted actual tests: policy, persistence (включая реальный crowd onclick), snapshots/remote join audit/Undo, network intent→materialize→dispatch→projection/replay, Tools pending/reject/Stress, surfaces, map, syntax.
- Высокий reviewer отдельно проверил реальные Entities.create и Inventory.applyOperation → PGlite SQL, повтор projection/migration; реальные prepareRemoteHeroCommand→acceptPreparedRemoteCommand и remote Undo с normalize. Только UI/transport/derived fixtures подставлены.
- Браузер локально, отдельный origin 127.0.0.1:18812, обычные исходники с cache-buster: первый НПС; manual crowd5; отсутствие compound и automation badge; native mouse area2×2 E4→erase; wall wheel east→south при неизменных zoom0.72/scroll0,0. Locator C3 попал под плавающую форму: это не доказательство отказа ластика.
- ПК 1440×1000: четыре HUD кнопки у G1 не пересекают bounding box токена; открытие инспектора закрывает HUD. Checkbox скрытости 18×18. Снимок ignored `output/manual-review-map-20261008.png`. QA HTML скрывает только dev update banner; production banner не изменён.
- Полный `npm test`: PASS, exit 0, `output/manual-review-final-pass-20261008-test.log`. Первый финальный запуск остановился на stale S00; генератор добавил только четыре ссылки на SQL test, canonical текст не менялся.

## Следующий порядок

1. Сверить этот пакет и последний SHA; не распаковывать unrelated freeplay WIP. Перепроверить конец итогового лога и повторять тесты только для конкретного риска.
2. Manual preset/modifier UI: replace preset пока вызывает запрещённые механические маршруты, местами показывает успех после отказа; modifier добавление обещает активное правило. Убрать ложные действия/сообщения или подключить явный storage-only путь. Базовые НПС и массовка уже работают.
3. Завершить shared informational area/handout и безопасные technique markers; явный cancellable start-rules с preview/первым участником всё ещё недоступен. Нельзя ослаблять policy guard ради dropdown.
4. Desktop приёмка обеих панелей/инициативы/Reader/нижнего блока. Полная цепочка native Space-pan с ранним отпусканием→erase в этом проходе не проверена; lifecycle unit tests есть. Пустая верхняя полоса manual и перекрытие части поля формой инструментов требуют отдельного решения.
5. SQL `202610080001_manual_table_public_records.sql` НЕ применён. Нужен отдельный безопасный контур deployment + изолированный двухклиентный RLS/Realtime тест. Чужие действующие столы и live Supabase для тестов запрещены. Офлайн PASS не означает устранение утечки на опубликованном сервере.

Вердикт высокого ревью: пакет исправлений пригоден после полного npm test; объявлять сетевой MVP законченным и сливать main пока нельзя из-за migration/двухклиентного гейта. Пользователь разрешил main после высокого ревью, когда MVP будет действительно готов.

## Пришедшее параллельное обновление — сначала интегрировать

Во время push обнаружено, что origin/codex/manual-table-continuation-20261008 обновилась до `5a67d9b`: код `8c0d3be` добавляет manual Ability highlights через инструменты поля, `5a67d9b` — финальные native checks/договор. Push в общую ветку был отклонён, поэтому проверенный пакет сохранён в отдельную review ветку. Новые файлы НЕ смешаны с результатом указанного полного теста.

Первый следующий шаг: fetch обе ветки, прочитать добавленный раздел последнего MANUAL_TABLE_RESUME из исходной ветки, ревью `8c0d3be` и объединить с этим пакетом. Пересечения: scene-manual-integration, scene-ui, manual CSS, tests/surfaces, документ подхвата. Сохранить новый продуктовый договор: области НЕ в отдельном modal/координатном блоке; mobile map позже, HUD PC/tablet; ручной подсветке не исполнять механические compound/effectPresence. Проверить объединённую сборку и обновить handoff. Не считать PASS базового `b02f5cc` проверкой ещё не объединённых highlights.
