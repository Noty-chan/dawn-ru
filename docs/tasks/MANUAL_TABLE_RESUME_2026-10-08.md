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
