# Ручной стол: следующий подхват 8 октября

Рабочая ветка: `codex/manual-table-continuation-20261008`. Получена с GitHub на `699a237`; продолжение: `38a7dc8`, `d595eee`, `86beb66` и `1df0f1a` (защита истории). Main не сливать как завершённый редизайн. Прочитать этот файл после [передачи предыдущего агента](MANUAL_TABLE_CONTINUATION_2026-10-08.md). Полный объём — [октябрьский backlog](COMPANION_COMPLETE_BACKLOG_2026-10-07.md).

## Сделано этим заходом

- HUD ручного стола: четыре явно расположенные кнопки вокруг жетона, отдельная полоса ЗД; выровнены размеры и обновление геометрии после fit/панелей/масштаба. Старое исполнение Приёмов убрано. Чтение открывает Reader, Ещё — компактный инспектор. Без счётчика ОД и старого признака нокаута в ручном столе.
- Один враг: четыре раздела Reader раскрыты при открытии; пользователь может свернуть их, repaint сохраняет выбор. Игрок не получает закрытые способности чужого врага. Скрытый выбранный actor не раскрывается через инспектор при смене GM→Player.
- Закрыты рекурсия старых Sheet/Director, ReferenceError `manual` в resource chips, потеря инспектора окружения, несовпадение KO-целей HUD/board.
- Space-pan сбрасывается при blur/hidden/pointercancel/lost keyup; защита от stray click сохраняется при раннем отпускании Space.
- Финальная LionWing обёртка передвижения в manual использует typed команду, а не actor.move Deployment. Линия движения берётся из manualMovementTrace; Очистить пути в группе Измерение — typed movement/clear текущего пространства.
- Snapshot guard сохраняет frozen LionWing runtime, policy epoch, боевое состояние actor, challengeRequest/opposedRoll. Frozen Entities exports также защищены от ручного вызова механики. Reload в manual — storage-only.
- История сверяется с сохранённым шагом: ресурсы, координаты, manualmarks, коллекции и backing registry. Ledger принятых команд сохраняется при Undo и не может быть очищен обычным snapshot. Metadata snapshot допускает только добавленные audit legacy.note с сохранением suffix/cap200.
- Wire scene не хранит локальную историю. Authority intent несёт anchor, предварительно признанный внутренним bounded Set при успешном локальном restore. Самодельный anchor не проходит queue. При rebase/flush проверяется тот же anchor. Это защита локальной очереди, не новая серверная RLS гарантия.
- Shared processStatuses checkbox находится в единственном меню Ведение; это readonly подсказки без автоматического изменения ресурсов.

## Доказательства и ограничения

Полный `npm test` PASS до последнего пакета истории: `output/manual-boundaries-20261008-final-test.log`, `output/manual-resume-final-20261008-test.log`. Финальный полный прогон после approved anchors: `output/manual-resume-approved-final-20261008-test.log` **PASS, exit 0**. Targeted snapshots/movement/surfaces PASS после финальных изменений. Test transport и DOM — подстановки; reviewer отдельно запускал настоящие normalizeScene/sceneCore/commit/queue/rebase в VM. Реальная сеть двух клиентов не проверена.

Browser: отдельный origin 127.0.0.1:8785, Edge headless 1440×1000, CLI session dawn-resume. Native mouse/cell eraser удаляет область; причиной универсального отказа ластика объявлять нельзя — прежний CUA отказ не воспроизвёлся. ЗД через -2 Enter: 18→16, переживает reload. NPC Reader все4 раздела открыты. Mouse move G1→D4: HP16/AP3 неизменны, SVG линия1. Очистить пути срабатывает. На pass7: D4→E4 мышью, Undo→D4, Redo→E4; HP16/18 неизменны. HUD geometry браузерно проверена после панели/fit. Снимки ignored output/manual-hud-fixed-20261008.png, manual-npc-open-20261008.png; финальный HUD manual-hud-final-20261008.png. HUD hover работает в инструменте Выбор; right-click — в том числе при Переставить.

Дополнительно native Space+mouse drag с отпусканием Space до mouseup: после жеста held=false/pan=null, actor E4/HP16/AP3 сохранён. Цепочка pan→erase и wall wheel на финальном браузере не проверены (есть executable lifecycle tests), live Realtime/RLS, планшет/телефон. Уведомление об обновлении на QA origin связано с dev cache-busters; не считать screenshot продакшен-публикацией. Подготовленный SQL `supabase/migrations/202610080001_manual_table_public_records.sql` **не применён**; чужие игровые столы не использовать для тестов.

## Следующий порядок

1. Native mouse Space-pan/early-release→erase, wall wheel preview/camera. Проверить геометрию HUD у края поля с открытыми левой/правой панелями и инициативой. Существующие тесты не заменяют этот прогон.
2. Вынести старый Tools challenge composer из manual: прежний интерфейс испытания остаётся, рабочий ручной стол должен быть проще. Инструменты перепроектировать по первому Рабочему месту + последнему согласованному черновику; старый вариант сохранить переключаемым, новый по умолчанию. Влияние/стресс связаны с листом Герой; часы не должны раздувать layout.
3. Shared informational area/handout игрокам; безопасные ручные переключатели техник; дальнейшая desktop эстетическая приёмка.
4. Явный cancellable start-rules с preview/первым участником. Сейчас намеренно TABLE_START_RULES_UNAVAILABLE; не ослаблять guard ради dropdown.
5. Изолированный реальный двухклиентный сетевой прогон и SQL deployment только в безопасном контуре. Старые функции restore/import — отдельный привилегированный backup путь, а не доказанная миграция политики.
6. Вычитка RU/EN интерфейса остаётся: в canonical Reader профилей встречается NPC в русской presentation. D6/стабильные IDs не менять, generated edition data вручную не править; ранее согласованные переводы и полный backlog сверить, не объявлять локализацию готовой.

Не трогать untracked пользовательские .codex-remote-attachments/, apps/companion/output/, site/dead-gods/maps/. Отдельный freeplay atomic WIP `codex/freeplay-atomic-wip-20261007`/stash не распаковывать в этот пакет. Полностью закрыть backlog этим заходом не удалось; ручной стол ещё не готов для объявления законченного редизайна.

## Финальная фиксация

Draft PR: https://github.com/Noty-chan/dawn-ru/pull/11, base codex/manual-table-checkpoint-20261007 (PR #10). Последний полный npm test после финальных approved anchors и пересборки S00 ссылок — PASS, exit0. S00 diff только добавил ссылки на snapshots suite в четырёх профилях; canonical тексты не изменены. Reviewer Sol6.1 low: финальная проверка fake anchor reject, shared rename/Undo/rebase PASS; новых подтверждённых существенных багов в проверенном пакете нет. Это не доказательство готовности остальных пунктов backlog. Остановка при ~5% пятичасового лимита; сервер локального QA 8785 и ignored артефакты сохранены для подхвата.


## Продолжение после восстановления лимита — Tools, видимость и поля

- Коммит `9aa65f4`: ручные Tools — typed storage-only roll, выбранные реальные источники собственного листа, исключены автоматические gift hooks, All In и старые замороженные requests/opposed UI. Явные ресурсы и Стресс пишутся тем же защищённым writer; pending/reject без оптимистических изменений. Старый интерфейс сохраняется, новая версия по умолчанию.
- Стресс по финальному уточнению пользователя: отдельная широкая строка, три красивых кликабельных ромба, без ± и 0/3. Пустой ромб задаёт значение до него; заполненный снимает его и последующие. На максимуме предупреждение, без автоматических последствий. RU/EN aria labels, readonly/pending guard, сохранение фокуса при частичном и полном render.
- Ручной инспектор: скрытие токена на поле отдельно от инициативы. Скрытый до начала ручного боя по умолчанию не показан в инициативе, скрытый после pointer/следующего раунда остаётся. Checkbox «Показывать в инициативе» может явно менять Нарратор. bool сохраняется в normalize/history metadata. Player видит только минимальную публичную сводку id/name/space в инициативе, без координат/ЗД/портрета/Reader. JS/Entities и SQL draft projection согласованы; повторные projections сохраняют сводку и pointer.
- Второе поле 7×7 либо 3×3 (custom) создаётся отдельно через manager; cap12 проверяется до записи. Компактный inspector переносит токен между полями typed move, без механических compound helpers. Перенос advisory, x/y ограничиваются границами, без принудительного освобождения занятых клеток.
- Закрыты утечки hidden имени в selection summary и hidden counts в tabs/manager; скрытое переименование/цвет логируются обезличенно. Дополнительные numeric/clock/privacy пункты backlog не считать автоматически закрытыми.

Проверка: полный `npm test` PASS exit0 — `output/manual-fields-full-final2-20261008.log`. Последний маленький focusSegment fix после начала полного прогона отдельно проверен actual render тестом Tools. Reviewer Sol6.1 low проверил actual functions, real engines/PGlite; DOM/transport подставлены, живого Supabase не было. Падения более ранних полных прогонов были из-за устаревших VM fixture window/spaces/closest, исправлены; их не считать PASS.

Browser Edge 1440×1000, отдельный localhost8785: обычные клики Stress 3→2→0→3, warning, отсутствие ±; create3×3, перенос main→3×3; hide prestart→initiative false, ручной checkboxtrue; GM→Player tokens0, initiative card остаётся disabled. Проверены реальные локальные DOM/данные; это НЕ сетевой end-to-end. ignored screenshots: `output/stress-diamonds-detail-20261008.png`, `output/manual-stress-diamonds-20261008.png`, `output/manual-hidden-initiative-20261008.png` (последний до переключения Player). QA page pass16 скрывает только dev update-banner, который возникал из-за искусственных cache-busters и мешал кликам; production banner не менялся.

SQL `202610080001_manual_table_public_records.sql` по-прежнему **не применён** к live проекту. В обновлённом draft минимальная публичная инициатива hidden известного участника исключает private stats; PGlite проверил backfill/repeat и repeated projection. Новые сетевые возможности не объявлять опубликованными до применения миграции и RLS/Realtime проверки.
