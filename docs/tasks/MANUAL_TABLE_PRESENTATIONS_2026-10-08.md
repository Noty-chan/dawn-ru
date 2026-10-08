# Нейтральный локальный показ · 08.10.2026

Ветка `codex/manual-table-continuation-20261008`, draft PR #11. Продолжение счётчиков/компоновки из [предыдущего журнала](MANUAL_TABLE_COUNTERS_LAYOUT_2026-10-08.md). Main не слит.

## Реализовано

- Категория «Показ» в палитре поля: пинг, линия, прямоугольник, кисть клеток. Pointermove — только локальный preview; завершение жеста показывает рисунок. Escape, смена категории/поля/комнаты/epoch отменяют режим. Можно выбрать начальную и конечную клетку клавиатурой через Enter/Space.
- Показ не меняет `Scene.tool`, цели, pending, ресурсы, журнал, version, Undo или сохранение. Незавершённое действие и чужой Ход не используются как запрет нейтрального показа.
- Пинг 1,2с, рисунок 6с; независимые места для них. Не более128 клеток, локальное ограничение3 жеста/с с burst4. Маркеры не перехватывают мышь. Названия/цвета и coordinate validation отделены в pure model; координаты с лишними нулями отклоняются.
- Заглушка пустого поля скрыта только на время показа: раньше она перекрывала центральные клетки и обрывала жест. Подсказка нового инструмента доступна через tooltip и aria-live, без обрезанного длинного текста в колонке44px.
- Classic сохраняется; новая версия по умолчанию. RU/EN управляющие подписи, D6 без изменений.

## Важная граница сети

**Shared показ не включён.** Полный договор [TABLE_TOOLS_PLAN](TABLE_TOOLS_PLAN_2026-10-07.md) запрещает записи жестов в DB. Прототип таблицы frames/RPC прошёл изолированные проверки SQL, но расходился с этим договором и удалён до публикации. `sync.js` в этом пакете не изменён; новая миграция не добавлена и ничего на live Supabase не применялось.

В общей комнате кнопки показывают недоступность временного канала. Нельзя подключать их к обычному public broadcast или Action outbox, нельзя называть текущий локальный показ завершением N01–N03.

Следующий transport: private topic на автора, sender разрешён только auth.uid(), reader — участникам комнаты; цвет/имя назначаются отдельно при вступлении. Личность из доверенной подписки, а не payload. Официальные опоры: [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization), [Broadcast](https://supabase.com/docs/guides/realtime/broadcast). В документации авторизация при join не сохраняет messages; реальные policies/public-private separation и revocation всё равно требуют N02. Глобальную настройку публичных каналов проекта не менять.

## Доказательства

- Pure model: line/rectangle/cells/ping, bounds/canonical cells, epoch/room/expiry, лимит128 и специальный TTL пинга.
- Native Edge 1440×1000, отдельный origin18814, session dawn-r2: line4 / rectangle12 / кисть4 / ping1; JSON Scene точно прежний после каждого жеста. Escape и очистка TTL. Synthetic frozen pending в rules: линия4, тот же JSON (это локальный UI guard scenario, не настоящий полный боевой сценарий).
- Native клавиатура: Enter начало/конец line4; ping1 одновременно с line4, после1,3с ping0/line4; JSON Scene прежний. Снимок `output/presentation-keyboard-20261008.png`, runner/script ignored.
- `node tests/freeplay-tools.mjs` PASS после удаления прототипа транспорта, `output/manual-presentations-local-targeted.log`. DOM/transport старых suites подставлены; этот результат не доказывает live Realtime.
- Первый полный прогон `output/manual-presentations-20261008-test.log` FAIL: S00 inventory stale после удаления прототипа в ходе прогона. Исправлен штатный `--write`: diff только добавляет ссылку на existing table-manual-workspace suite, canonical rules не менялись. Финальный полный receipt записать после завершения.

## Следующий подхват

1. Проверить HUD actual rect на кромках/zoom и Hero-owned area; не возвращать permanent108px rail.
2. Не обходить start-rules guard; переход должен атомарно начать новый бой с первым участником, preview/cancel и сохранением ручных HP/Stress/Influence/позиций. Пока не реализовано.
3. Private ephemeral transport + пять комнат/пять клиентов/fake clock и изолированный Postgres/Realtime RLS, никакой live комнаты. N01–N03 остаются открыты.
4. Старый freeplay atomic WIP/stash и P1 Tools не закрыты ручным roll. Полный backlog не завершён. Mobile отложен пользователем.

Не добавлять/удалять пользовательские `.codex-remote-attachments/`, `apps/companion/output/`, `site/dead-gods/maps/`; stash не pop. При остатке~5% сохранить подробный handoff и push этой ветки.

Финальный полный receipt: `output/manual-presentations-local-final-20261008-test.log` PASS exit0. Финальный Sol6.1 low reviewer: новых actionable дефектов локального U03 не нашёл; подтвердил пустой diff sync/migrations и отсутствие Scene writers.
