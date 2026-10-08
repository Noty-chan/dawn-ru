# Подхват ручного стола — 8 октября 2026

Ветка `codex/manual-table-continuation-20261008`, draft [PR #11](https://github.com/Noty-chan/dawn-ru/pull/11), base `codex/manual-table-checkpoint-20261007`. Это продолжение стека #10/#9; не считать готовым к merge main или опубликованным сайтом.

## Что читать сначала

Полный актуальный договор: [TABLE_TOOLS_PLAN_2026-10-07](TABLE_TOOLS_PLAN_2026-10-07.md). Этот файл уточняет последний checkpoint, не заменяет backlog. Также [RESUME](MANUAL_TABLE_RESUME_2026-10-08.md), [счётчики/layout](MANUAL_TABLE_COUNTERS_LAYOUT_2026-10-08.md), [показы](MANUAL_TABLE_PRESENTATIONS_2026-10-08.md), CODEX/ARCHITECTURE/LOCALIZATION в companion и CODEX в tests/supabase.

Приоритет пользователя — удобный ручной desktop стол; мобильный проход отложен. Новая версия default, classic переключаемый, исходная палитра. Ни ручные отметки, ни показ областей не должны выполнять механику. При остатке около5% пятичасового лимита — сохранить отдельную ветку с подробным handoff и остановиться.

## Сохранённая реализация

- `7d69308`: preset privacy до remap владельцев, исключённый скрытый owner не раскрывает принадлежащую ему область/стену/метку.
- `a909488`: typed счётчики отдельных способностей, normalization/snapshot bounds, owner privacy; читаемый RU/EN журнал; плавающая палитра без постоянной полосы108px, временные options резервируют место только при открытии, Reader справа и независимая инициатива.
- `ff80e21`: локальные пинг/линия/прямоугольник/кисть. Preview и TTL без изменений Scene/version/Undo/resources. Ping1,2с, drawing6с, независимые lanes;128клеток,3жеста/с burst4. Shared отключён; sync.js не изменён, новая SQL миграция не добавлена.
- Финальный пакет этой ветки: actual HUD height42 и отступы; hover не масштабирует токен после вычисления геометрии; live RU/EN aria-labels; dirty HP/counter не записывается от browser-generated change при замене DOM; draft/focus сохраняются только для прежнего actor/scope/прав. Focusout подтверждает восстановленный draft, Escape отменяет counter; per-control submitted draft предотвращает change→focusout duplicate при pending writer. Canonical attr не выдаётся за серверный ack.

## Исправление прежнего отчёта

Ранее в COUNTERS_LAYOUT сказано, что dirty27 переживает repaint и Tab подтверждает27. Проверка тогда не контролировала canonical state во время repaint: браузер уже мог записать27. Этот вывод заменён новым: repaint сохраняет draft и canonical/version; Tab записывает один раз; Escape не записывает. Native окончательный пример:25/version42 → repaint25/42 → Tab26/43 → repaint26/43 → Escape26/43. После последней защиты pending повторов targeted handler tests PASS; это mock pending writer, не live сеть.

## Доказательства / честные границы

- Full `npm test`: `output/manual-counters-desktop-final-20261008-test.log`, `output/manual-presentations-local-final-20261008-test.log` PASS. `output/manual-inputs-hud-final2-20261008-test.log` PASS exit0 до последнего focusout/submitted пакета. Последний полный receipt уточнён ниже после завершения.
- Targeted workspace/board tools/HUD PASS; HUD model648case,630safe/18external. После submitted фикса actual delegated tests PASS: reentrant change, restored focusout, duplicate suppression, Escape.
- Native Edge1440×1000, isolated origin18814, CLI dawn-r2:15 HUD corner/centre/zoom30/100/180 cases без пересечения; actual rect, не только model. Собственная Ability игрока создаёт owned area без HP/AP/Focus/Stress/targets изменений; смена поля отменяет armed draft.
- Локальный показ: mouse line4/rectangle12/cells4/ping1, keyboard Enter/Space; Scene JSON неизменен. Ping исчезает через1,3с, drawing остаётся. Room mock очищает показ и отключает controls; field change отменяет preview. Это mock Sync.state identity, не настоящая комната.
- HP draft5/canonical7 удерживает focus после repaint; epoch отменяет draft без записи. Live EN labels категорий/инициативы/Reader переключаются без reload; D6 не тронут.
- Readonly Sol6.1 low reviewer нашёл pending double-send; исправлен и targeted перепроверен. Его browser/live network проверки не заявлять.
- S00 inventory штатно regenerated `node tests/lionwing-enemy-inventory.mjs --write`: только ссылки на existing workspace suite для двух профилей; canonical правила и статусы автоматизации не повышены. Первый final-input full FAIL именно stale inventory, не скрывать.

Ignored scripts/logs в корневом output — локальные receipts, на GitHub не обещать их наличие. Скриншоты уже tracked в `assets/manual-table-20261008/`. QA HTML debug-config/cache-busters/banner hiding не переносить в production.

## Следующий порядок

1. Перепроверить pending reject/retry новых числовых controls в изолированном shared harness и native explicit focusout; старый классический UI сохранить. Не выдавать mock за реальные два клиента.
2. Desktop acceptance оставшихся палитр/панелей: Space-pan→erase, wall wheel/camera, old/new toggle, реальные данные нескольких героев. Считать актуальным полный TABLE_TOOLS_PLAN, не короткий старый список.
3. Start-rules атомарный initializer с preview/cancel, первым участником и сохранением ручных ресурсов/позиций. Сейчас TABLE_START_RULES_UNAVAILABLE намеренно; selector guard не обходить.
4. N01–N03 private ephemeral transport: пять комнат/пять клиентов/fake clock и изолированный Postgres/Realtime. Никаких gesture DB rows, public broadcast или Action outbox. Authenticated author topics и server-assigned colors. Локальный U03 не закрывает сеть. SQL001 draft не применён; live Supabase и пользовательские столы не трогать.
5. Tools P1 и atomic freeplay WIP остаются; не объявлять их закрытыми manual roll. Stash не pop поверх этого пакета. RU/EN полный backlog также не закрыт малым aria проходом.

Не добавлять/удалять `.codex-remote-attachments/`, `apps/companion/output/`, `site/dead-gods/maps/`. Main не менялся. Использовать ветку/stack PR, не reset или stash pop.
