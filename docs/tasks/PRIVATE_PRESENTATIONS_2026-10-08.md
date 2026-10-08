# Сетевые показы: пакет под бюджет15пп, 8 октября2026

Ветка `codex/manual-table-review-20261008`, база `7bac879`. Пользователь разрешил15 процентных пунктов пятичасового лимита: начало81%used, остановка не позже96%used. Live Supabase и игровые столы не использованы. Этот пакет **не является опубликованной сетевой альфой**.

## Реализация

- `scene-presentation-transport.js`: PRIVATE per-author topics `dawn-present:<scene UUID>:<auth UUID>`. Клиент связывает автора с подписанным каналом, игнорирует имя/цвет/author из payload, получает roster из RPC. Максимум12 участников, по2 lanes (ping/drawing),128 клеток, отправка и приём3/с burst4, одна отправка in-flight, без очереди повторов и записей Scene/DB.
- `sync.js`: запуск после основного SUBSCRIBED, teardown всех lanes при unsubscribe/смене комнаты; generation защищает late bootstrap/callbacks и delayed remove. Roster проверяется каждые30с; изменение участников пересобирает каналы.
- `scene-presentations.js`: shared controls доступны только при online+presentationReady, входящие frames проходят текущие room/space/epoch/TTL проверки. Потеря готовности отменяет жест и очищает overlays. Локальный режим сохранён.
- `202610080002_private_presentations.sql`: RPC выдаёт DB имена и устойчивые уникальные слоты; departed slots освобождаются под advisory lock. RLS private broadcast: читать может участник кампании, писать только author auth.uid; restrictive guards защищают от будущих broad permissive policies. Durable только цвета, жесты не сохраняются.
- index/sw/test registration синхронны.

Архитектура по первичным [Supabase authorization](https://supabase.com/docs/guides/realtime/authorization), [concepts](https://supabase.com/docs/guides/realtime/concepts): public/private topics изолированы; legacy public channel оставлен как был. Presence никогда не используется для доверенного author/color.

## Проверки

- Production transport VM:5 комнат×5 клиентов×300 fake секунд,1 жест/с/клиент,7500 отправок; room isolation, spoof fields, bounds/epoch/rate, неизменность Scene, delayed teardown race — PASS exit0. Это mock private bus **без jitter и реального WebSocket**, не полный N03.
- `node tests/scene-presentation-sql.mjs`: PGlite реального SQL; RPC auth denial, чужая комната/author, стабильные цвета/reuse departed slots, restrictive RLS при broad policy — PASS exit0. Тест требует локальный `output/qa-pg/node_modules/@electric-sql/pglite`, как существующие SQL tests.
- Presentation model/actual listeners и network-load-race — PASS. Low reviewer воспроизвёл start/teardown race; обе исправлены. Первая версия load fixture зависала на нескольких teardown promises; исправлена, повтор exit0.
- Full npm final2 PASS exit0: `output/private-presentations-final2-20261008-test.log`. Первый full FAIL stale generated S00; штатная регенерация добавила3 ссылки на новый test suite, правила/статусы не менялись. Поздняя обёртка roster RPC через существующий withNetworkTimeout добавлена во время final2; её transport targeted повторно PASS, поэтому это НЕ immutable exact-HEAD full receipt. Перед выпуском повторить полный прогон на frozen HEAD.

## Перед реальной сетевой проверкой

Миграции001 (manual public privacy) и002 **не применены**. Применить в изолированном Supabase после ревью, затем настоящий JWT/private Realtime: два клиента, send-own/deny-other, foreign campaign deny, reconnect/room/epoch/role, новые/вышедшие участники, revoke membership. Только затем публиковать main и проверять опубликованный SHA.

Realtime authorization кэшируется на соединении: немедленный отзыв membership на живом socket этим локальным SQL тестом не доказан. Client roster обновляется30с, но клиентский фильтр не заменяет серверный revoke gate. N02 остаётся открытым; N03 добавить100±50ms jitter, disconnect/loss и настоящую связку UI→Sync→socket.

При bootstrap RPC ошибке transport fail-closed; после применения миграции нужно переподключение/перезагрузка. Roster RPC подключён к существующему withNetworkTimeout с AbortSignal; отдельный новый механизм таймаутов не добавлялся. Повтор канала после ошибки при сохранённой room происходит на roster poll; после RPC denial нужна новая основная подписка. Не скрывать эти ограничения и не считать весь сетевой backlog закрытым.

## План следующего агента — выполнять по порядку

Стартовый коммит `4b85b41`, ветка `codex/manual-table-review-20261008`. Сначала fetch, git status, CODEX и ревью этого коммита; чужие изменения сохранить. При найденной ошибке поручить low reviewer поиск аналогичных ошибок. Одноразовый high review уже проведён ранее; повторять его постоянно пользователь не просил.

1. **Зафиксировать проверяемую версию.** Повторить полный `npm test` на неизменном executable HEAD, отдельно `node tests/scene-presentation-sql.mjs`. Записать SHA, команды, exit codes и путь логов. Критерий: оба exit0, без правок кода во время полного прогона; generated S00 менять только штатным генератором. При ошибках сначала исправления и повтор нужных gates.
2. **Закрыть восстановление транспорта.** Проверить actual Sync→transport при RPC timeout/denial, CHANNEL_ERROR, позднем ack и параллельных reconnect/leave. Доработать восстановление после временной ошибки roster: bounded retry только при прежних auth/room/generation; отказ доступа не повторять бесконечно. Критерий: один актуальный transport, bounded запросы, старые callbacks не оживляют канал, нет outbox/Scene writes и вспышек старых жестов после reconnect.
3. **Подготовить изолированный сервер.** Создать отдельный тестовый Supabase/Postgres+Realtime, аккаунты ведущего/игрока/чужой кампании. Применить миграции001 и002 по порядку; проверить старый клиент, privacy projection и доступ к RPC. Критерий: скрытые clocks/counters/owner metadata отсутствуют в доступных игроку records; roster выдаёт только разрешённую кампанию. Live Supabase и действующие столы не использовать без нового прямого поручения пользователя.
4. **N02: два настоящих браузерных клиента.** На свежем тестовом столе провести ping/line/rectangle/cells через UI, проверить автора/цвет и expiry на обоих клиентах. Попытаться отправить в чужой author topic, чужую комнату, подменить payload author/color, epoch, oversized cells; проверить public/private topic isolation. Критерий: допустимые жесты видны обоим; запрещённые не принимаются сервером/не рисуются, ресурсы/version/Undo и action queues неизменны. Сохранить browser screenshots и серверные результаты, не выдавать VM за этот gate.
5. **N02: жизненный цикл и отзыв доступа.** Disconnect/reconnect, leave→другая room, sign out→другой user, смена epoch/поля/роли; join/leave участников и reuse слота без перекраски оставшихся. Отдельно проверить revoked membership на уже открытом socket. Если сервер продолжает разрешать отправку/чтение после отзыва, решить server invalidation или иной авторизованный транспорт; клиентское скрытие недостаточно. Критерий: отсутствуют утечки между комнатами/аккаунтами, старые жесты не возвращаются, удалённый участник теряет серверный доступ.
6. **N03: нагрузка и потери.** Дополнить production harness задержкой100±50ms, reorder/duplicates/loss, offline burst и зависшим ack/RPC. Прогнать5 комнат×5 клиентов300с,1 жест/с/клиент; отдельно flood. Критерий: ограниченные channels/maps/in-flight, нет растущей очереди и записей жестов в БД, комнаты изолированы, TTL соблюдается, после восстановления старые жесты не воспроизводятся. Зафиксировать измеренные задержки и объём памяти; не назначать успешный статус без результатов.
7. **Приёмка и выпуск.** Low reviewer проверяет конечный diff и соседние маршруты; реальный desktop smoke и frozen full test. Обновить [ALPHA_READINESS](MANUAL_TABLE_ALPHA_READINESS_2026-10-08.md) фактами, сохранив открытые start-rules/U04 и прочие backlog пункты. Только после gates слить связанную работу в main, push, дождаться deployment и сверить опубликованные файлы с фактическим SHA. Критерий: сохранены receipts конкретной версии и подтверждена публикация; остальные ветки не сливать.

Если лимит закончился между этапами: коммит/push этой ветки, записать последний выполненный шаг, SHA, непройденный gate и следующий конкретный сценарий. Не обозначать shared alpha готовой, пока этапы3–6 не подтверждены.
