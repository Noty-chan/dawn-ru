# Ручной стол: счётчики и компоновка · 08.10.2026

Ветка `codex/manual-table-continuation-20261008`, draft PR #11. Получено и fast-forward интегрировано продолжение `origin/codex/manual-table-review-20261008` до `5cfa318`. Текущий пакет продолжает этот договор, не объявляет весь backlog завершённым.

## Новое

- Приватность полного пресета определяется по исходному template до remap владельцев. Область/стена/метка скрытого или удалённого владельца не становится публичной после исключения его листа из импорта. Отдельный regression с настоящим producer/reducer/player projection.
- Reader: явная личная отметка и необязательный счётчик у техник, включённых Способностей и действий/козырей профиля. Добавить, ±1, точное целое значение, убрать. Это блокнот, без оплаты/лимита по тексту, границ Хода, сброса, автоматической трактовки или последствий.
- Typed `table.command` kind `technique-counter`: create/set/adjust/remove. Adjustment использует authoritative текущее значение, повтор create не сбрасывает запись; eventId каждой UI-команды отдельный. Технический предел 120 записей × 0–999, safe keys. normalize выбрасывает некорректные импортированные записи; raw snapshot restore и layout также валидируют.
- `manualTechniqueCounters` проходят нормализацию/сохранение/историю/полные пресеты. Собственный player/GM видит записи, чужой player не получает ключи или значения. Логи marks/counters owner-only; hidden actor gm-only. SQL projection draft дополнен, **на живой Supabase не применялся**.
- Reader сохраняет фокус по actor/entry/action и ещё не подтверждённый числовой ввод при внешнем repaint. Смена scope/epoch/прав не удерживает прежнюю форму. Invalid set возвращает подтверждённое число.
- Desktop manual: независимые места для инициативы и включаемой левой панели; Reader занимает правую колонку. Открытие обычной панели закрывает Reader. Новое оформление действует только manual+next; classic и режим правил сохраняются.
- Палитра в idle плавающая, прозрачные промежутки пропускают мышь: постоянной полосы 108px нет (U10). Только открытые параметры занимают временную полосу рядом с картой. После выбора другого участника placement отменяется и открываются инструменты жетонов.
- Верхняя строка показывает поле/участника; manual menu не считает готовых автоматических Ходов, показывает ручной Раунд.

## Проверка

Полные прогоны `output/manual-counters-r2-20261008-test.log` и `output/manual-counters-layout-r2-20261008-test.log` PASS exit0 для соответствующих состояний. Последние небольшие CSS/подписи после второго запуска проверяются отдельно targeted/native; финальный full receipt записать ниже после завершения итогового прогона.

Actual engine/adapter suites: network counter ownership/epoch, concurrent adjustments, replay, invalid/prototype/bounds, foreign projection, frozen resources; persistence malformed import; PGlite private snapshot; reader data/workspace/surfaces/layout. DOM/transport у модульных harness подставлены, это не live Realtime.

Native Edge, отдельный origin `localhost:18814`, CLI session `dawn-r2`, 1440×1000, только QA fixture:

- Full preset: две карты 7×7/3×3, герой во второй с HP11/AP3, NPC скрыт HP18/AP3, owned area. Preview/cancel сохраняет исходные IDs и version. Confirm remap NPC/area, герой и замороженные ресурсы сохранены; reload сохраняет данные.
- После двух resource edits full layout добавляет третий Undo; Undo возвращает прежний NPC ID и HP13/owned area одним шагом. Undo/redo намеренно не сохраняются после reload; это не потеря живой истории.
- Counter: reload сохранённого9; RU/EN тексты настоящих правил; два Enter дают +2 и сохраняют focus. Dirty27 выдерживает настоящий renderScene(), Tab подтверждает27.
- Reader.right = board.right (не перекрывает карту); highlight options.right426 < board.left435, hover квадрат3 у края4 клетки. Две боковые панели: инициатива x7..63, левая63..351, карта после палитры, правая1098..1386. После возврата к плавающей палитре board использует освобождённые112px.

Снимки QA без пользовательских персонажей: [Reader](assets/manual-table-20261008/reader.png), [подсветка](assets/manual-table-20261008/highlight.png), [две панели](assets/manual-table-20261008/two-panels.png). Их наличие/последний кадр проверить перед публикацией.

Sol6.1 low reviewer нашёл malformed-counter import и потерю focus; оба исправлены и targeted перепроверены. В последнем readonly проходе новых подтверждённых регрессий не нашёл. Геометрию проверял root в настоящем браузере.

## Дальше / ограничения

1. Закончить desktop matrix: HUD у края/zoom, собственная player Ability highlight, role/space change, обе панели, old/new toggle, live locale без reload. Mobile отложен пользователем.
2. Нейтральные показы/пинг U03 и защищённый транспорт N остаются. Постоянные информативные области уже доступны, но не закрывают ephemeral жесты без изменения Scene/history.
3. Start-rules ещё не подключён; существующий guard не ослаблять. Frozen runtime нельзя запускать простой сменой selector.
4. SQL draft и двухклиентный RLS/Realtime требуют изолированного контура, живые пользовательские столы не использовать. Main не объявлять готовым MVP.
5. Freeplay atomic WIP остаётся в stash, не pop поверх ручного пакета. Прочесть полный backlog, не объявлять старые P1 freeplay закрытыми ручным roll.

Защищённые untracked `.codex-remote-attachments/`, `apps/companion/output/`, `site/dead-gods/maps/` не добавлять и не удалять. QA runner `output/manual-resume-r2-20261008.html` и тестовые логи ignored; в production его debug-config и скрытие update-banner не переносить.


Финальный core/layout receipt: `output/manual-counters-desktop-final-20261008-test.log` PASS exit0, после normalization/focus/плавающей палитры/ручного контекста. После него отдельный пакет журнала: настоящий formatter переводит ручные изменения RU/EN (HP0 и Stress3 сохраняются явными значениями, без механических последствий), временные метки выводятся HH:MM; local Player view получает только projected journal. Native GM→Player: записи скрытого NPC/counters исчезают, собственный hero HP остаётся. Прогон `freeplay-tools.mjs` и native журнал записать в receipt после завершения.

Следующий пакет: [локальные нейтральные показы и точная граница shared транспорта](MANUAL_TABLE_PRESENTATIONS_2026-10-08.md). Финальный targeted журнала — `output/manual-journal-targeted-20261008-test.log` PASS; объединённый full после локального U03 также PASS, см. новый журнал.


Последний checkpoint и исправление прежних native выводов: [FINAL HANDOFF](MANUAL_TABLE_FINAL_HANDOFF_2026-10-08.md).
