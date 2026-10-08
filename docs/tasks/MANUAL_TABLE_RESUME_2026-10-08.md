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

## Следующий проход ревью

См. [исправления, доказательства и текущие ограничения](MANUAL_TABLE_REVIEW_2026-10-08.md). Этот документ обновляет статус предыдущего подхвата; main ещё не слит.

## Подсветки через инструменты поля — следующий пакет 8 октября

Последнее уточнение пользователя: **не отдельный диалог с координатами**. Основной путь теперь: категория «Подсветки способностей» → выбрать способность и форму → наведение показывает клетки → клик сохраняет обозначение. Reader «Показать область» сразу включает этот инструмент и закрывается. Escape, смена категории/инструмента, смена поля, потеря прав/смена текста источника отменяют draft. После размещения не остаётся прежняя линейка/кисть: возвращаемся к обычному выбору. Поля выбора координат и modal не используются.

- Draft transient, не в Scene/targets. Пишется существующая typed `table.command area/create`, actor/source/space/epoch перепроверяются. Поддержаны cell/cross/square2/3/5/radius2/lineH/V, clipping края. Область информирует игроков; нет урона, стоимости, статусов или выбора целей.
- Собственный герой доступен игроку; чужие NPC — Нарратору. В tool flyout можно переключить способность и форму. Список ранее поставленных собственных видимых областей раскрывается отдельно и ограничен по высоте; явное удаление typed area/remove. Чужие/скрытые записи игроку не перечисляются.
- Pending повторный клик не создаёт новый запрос. «Проверить сохранение» сначала refresh canonical scene; если queue pending/failed, повторная отправка закрыта. UID draft сохраняется до подтверждения/отмены. Live transport не проверялся.
- Новая категория не GM-only: игроку нужен свой инструмент обозначения. Native category-change notification отменяет активное размещение и при программной смене категории. Classic сохраняется: параметры скрыты в idle, при размещении блок 280px; новая версия остаётся по умолчанию.
- Reader больше не перекрывается открытым chrome menu: перед чтением закрываем меню и боковые панели. Экспорт closeReader из workspace используется для возвращения на поле.
- Исправлена private clock-list утечка при focus: DOM списка сохраняется только при том же visibility fingerprint; GM→Player/смена скрытия owner перестраивает список.
- Manual board не консультирует frozen effectPresence/deployment для скрытия. Legacy wrapper compound/modifier не удаляет/не заменяет обычные токены; reconcile destination пропускается. Стены в manual — предупреждающие обозначения без HP/обещания блокировки. Marker carrier скрытого персонажа не раскрывает имя игроку. Это не означает, что все старые декоративные overlays уже проаудированы.

### Фактическая проверка этого пакета

Targeted actual-function tests: map-tools (typed create/remove, clipping, stale source/role/field guards, pending/retry, privacy, wall markup), clock-route (focus visibility), surfaces (manual presence + wrapper bypass), workspace, board-tools PASS. DOM/transport в этих harness подставлены. Sol6.1 low reviewer проверил текущие функции: нашёл смену категории со скрытым активным draft, исправление перепроверил; новых подтверждённых регрессий в проверенном пакете нет.

Полные прогоны `output/manual-highlight-full-20261008.log`, `output/manual-highlight-final-20261008.log`, `output/manual-highlight-release-20261008.log` PASS exit0 для соответствующих предыдущих состояний пакета. Последний `manual-highlight-ship-20261008.log` запущен после classic idle fix; финальное сворачивание списка областей сделано после старта и отдельно проверено map/surfaces/workspace. Не выдавать старый полный прогон за доказательство последнего CSS/layout.

Native Edge 1440×1000, localhost8785, dawn-resume, QA-only pass19–22: нет modal, Reader закрыт; hover square3=9, edge=4; клики реально создают область и сохраняют HP18/AP3, targets не заменяются. Проверены Escape, category cancel, смена трёх способностей Убийцы, измерение→highlight→select, classic idle hidden/44px trigger/280px armed, возврат next без reload. Это локальная приёмка, не сеть двух клиентов. Один клавиатурный M на сфокусированной кнопке не сработал из-за стандартного shortcut guard; не считать такой сценарий проверенной отменой через M. Скриншоты в ignored output; финальный список приёмки ниже обновить после последнего снимка/прогона.

### Приоритеты следующего агента

1. Сначала прочитать последний продуктовый договор здесь и MANUAL_TABLE_CONTINUATION, потом полный backlog. Не возвращать область в отдельный modal/координатный блок. Не возвращать механические compound/effectPresence в manual отрисовку. Палитру сохранить.
2. Native user-owned Hero area и role/space change при активном размещении, pending recovery с реальным изолированным транспортом. GM NPC/local paths уже проверены. Проверить hover при открытых левой/правой панелях, pan/zoom, клавиатурное управление полем. Mobile отложен пользователем; HUD только PC/tablet.
3. Дальше manual техника: удобные явные переключатели/счётчики и показываемые области, без авто-стоимости/эффектов. Сейчас toggles — только ручные пометки, произвольный текст не интерпретируется в механику.
4. Cancellable переход к автоматике всё ещё отдельная задача: не объявлять автоматический старт доступным. Frozen snapshots, epoch, receipts, permissions сохранить.
5. Изолированная двухклиентная сетевая приёмка и применение SQL draft остаются НЕ выполнены. Не трогать live Supabase/пользовательские комнаты без текущего контекста разрешения. Свободные Tools atomic WIP остаются в stash, не pop поверх этой ветки. Старый freeplay backlog не закрыт ручным roll.
6. Финальная RU/EN проверка (D6 не переводить), локализация динамических элементов при смене языка без reload, desktop/tablet. Весь общий backlog не считать выполненным.

GitHub: продолжение в `codex/manual-table-continuation-20261008`, draft PR #11, base checkpoint-20261007, stack #10/#9. Main не слит. Защищённые untracked .codex-remote-attachments/, apps/companion/output/, site/dead-gods/maps/ не добавлять/не удалять. QA-server localhost8785 и CLI browser сохранены; user data не менять.


Финальный receipt текущего пакета: `output/manual-highlight-ship-20261008.log` **PASS exit0**. Последнее сворачивание списка областей отдельно: map/surfaces/workspace PASS; native pass23 snapshot проверяет скрытый по умолчанию bounded список. Полный проход перед этим маленьким HTML/CSS изменением честно отделён от targeted/native результата.


Последний кодовый коммит пакета: `8c0d3be`, опубликован в origin и PR #11. Последняя native проверка pass23: список областей collapsed, панель 351.8px при четырёх областях, square3 preview9; GM→Player отменяет draft, очищает preview и собственный private-area list. English reload: категория Ability highlights, выборы Neutralize Target/Slice/Hidden Blades, все восемь форм и управляющие подписи английские. Имена ранее сохранённых RU областей остаются записанным пользовательским текстом, не переводятся задним числом. Смена locale без reload пока отдельный пункт проверки. Последний screenshot: ignored `output/manual-highlight-final-20261008.png` (RU, new desktop).


Последний checkpoint и исправление прежних native выводов: [FINAL HANDOFF](MANUAL_TABLE_FINAL_HANDOFF_2026-10-08.md).
