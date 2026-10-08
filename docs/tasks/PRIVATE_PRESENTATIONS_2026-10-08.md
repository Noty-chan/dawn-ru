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
