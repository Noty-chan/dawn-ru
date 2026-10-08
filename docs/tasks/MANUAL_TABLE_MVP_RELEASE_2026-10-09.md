# Кандидат ручного MVP — интеграция и выпуск

Ветка `codex/manual-table-mvp-20261009` содержит весь связанный стек прежних PR9–11 и полученное продолжение `de56d58` из `codex/manual-table-review-20261008`. База main `5f79131` уже является предком ветки. Остальные независимые ветки не добавлялись. **Merge и deployment ещё не выполнены.**

## Новые завершённые исправления

Код `36eb7e2`, test-adapter `0eb8fd1`:

- Временная ошибка roster больше не отключает показ навсегда. Desired room/auth отделены от действующих каналов. Poll retries с backoff ограничены четырьмя попытками; access denial прекращает попытки. CHANNEL_ERROR/TIMED_OUT/CLOSED используют тот же бюджет и инвалидируют старые callback/subscribe loops. Leave не оживляет прежнюю комнату.
- U04: рисование местности протягиванием, с интерполяцией клеток и предпросмотром. Один мазок — один объект, одна typed команда и один Undo. Предел128 клеток; pointercancel/blur/Escape/outside/чужой pointer/смена scope/версии/размеров отменяют без записи. Space pan проходит к камере. Мазок не изменяет ресурсы/цели и работает только в manual/GM/new interface.
- Изолированный surface harness получает новый terrain adapter; это исправление загрузчика теста, не обход production guard.

Targeted transport/map/surfaces PASS; readonly low reviewer проверил окончательный код36eb7e2 и не нашёл новых подтверждённых дефектов. Pure bus5×5×300с остаётся симуляцией, не настоящим Realtime.

## Native desktop receipts

Edge через Playwright CLI, isolated QA origin18816,1280×720, production executable scripts. HTML clone в ignored output меняет только base/cache version; не production deployment.

- Drag B3→E3: preview4, objects0 во время жеста; после отпускания один объект с4 клетками, Undo0→1; один Undo возвращает objects0.
- Через видимые формы добавлены герой и Убийца. Все4 NPC details открыты. HP18→15 через footer/Tab; ОД3 и Фокус0 врага, ОД3/Фокус2 героя неизменны. Reload сохраняет те же IDs/HP/AP/Focus.
- Local scripts `output/mvp-brush-native.cjs`, `output/mvp-manual-smoke.cjs`; screenshot `output/mvp-manual-npc-20261009.png`. Они ignored и не обещаются как GitHub attachments.

Первый полный `output/mvp-final-20261009.log` FAIL: isolated surfaces не загружал новый installer. Исправлен в0eb8fd1. Повтор `output/mvp-final2-20261009.log` запущен на неизменном executable0eb8fd1; окончательный exit code записывается ниже после завершения.

## Supabase: конкретная проверенная зависимость

Пользователь прямо разрешил использовать существующий подключённый проект вместо отдельного сервера. Проверка публичного API проекта `ejxzsunagpxsiwpmuovp` с отдельной anonymous QA session: обе RPC `presentation_roster` и `presentation_topic_allowed` возвращают **PGRST202 (не установлены)**. Session signOut выполнен. Существующие кампании не открывались, миграции не применялись.

Config содержит только browser publishable key. Admin/management credentials в доступном окружении отсутствуют; GitHub secrets не настроены. Docker binary отсутствует, WSL docker-desktop не стартует из-за выключенной виртуализации. Browser inventory CUA дважды timeout, native Chrome activation failed. Это не результат проверки Realtime/RLS.

Для следующего шага нужен SQL Editor/administrative connection. Подготовленные файлы применяются по порядку:

1. `supabase/migrations/202610080001_manual_table_public_records.sql` — privacy projection и public snapshot rebuild.
2. `supabase/migrations/202610080002_private_presentations.sql` — roster/colors и authenticated private policies.

Не пытаться выполнить SQL публичным ключом, не создавать permissive обход. После применения повторить RPC preflight, создать отдельные disposable QA campaigns в этом же проекте и выполнить N02/N03; пользовательские игровые кампании не использовать. Честные gates и сценарии: [PRIVATE_PRESENTATIONS](PRIVATE_PRESENTATIONS_2026-10-08.md).

## До merge main

- Получить доступ/подтверждение применения миграций и провести настоящие auth/topic/public-private/revocation проверки. Cached Realtime authorization нельзя объявлять отозванной по одному клиентскому скрытию.
- Проверить реальные shared команды, rejected writes, reload и показ через два браузерных клиента; потом5×5 load/loss. Не объявлять VM/PGlite сетевой приёмкой.
- Start-rules initializer всё ещё защищён TABLE_START_RULES_UNAVAILABLE; он не реализован этим пакетом. Полный [TABLE_TOOLS_PLAN](TABLE_TOOLS_PLAN_2026-10-07.md), [объединённый backlog](COMPANION_COMPLETE_BACKLOG_2026-10-07.md) и Tools/freeplay WIP остаются актуальны. Нельзя утверждать, что вся автоматизация завершена.
- После gate merge только этой связанной ветки, push main, дождаться Pages и сверить опубликованный build. Старые draft PR закрыть как superseded после подтверждённого merge.

Защищённые `.codex-remote-attachments/`, `apps/companion/output/`, `site/dead-gods/maps/` сохранены; stash не pop. SQL и main пока без изменений в live среде.


Финальный immutable executable пакет 0eb8fd1: npm test завершился PASS exit0, output/mvp-final2-20261009.log. После старта прогона исполняемые файлы и тесты не менялись; последующий коммит добавляет только документацию. Targeted SQL PGlite также PASS; это не live Realtime. Единый draft PR к main: https://github.com/Noty-chan/dawn-ru/pull/12.

## Supabase update — 2026-10-09

User approved applying both migration files to existing Dawn project ejxzsunagpxsiwpmuovp. Applied 202610080001_manual_table_public_records.sql followed by 202610080002_private_presentations.sql through dashboard SQL Editor. Result: Success. No rows returned.

Post-application public API probe (disposable anonymous QA identity, signed out afterward) passed: presentation_roster(fake scene UUID) returns 42501; presentation_topic_allowed(invalid topic) completes without error. Previous PGRST202 blocker is resolved. Screenshot receipt: ignored output/supabase-migrations-applied-20261009.png.

Do not rerun migration002 unchanged: its table/functions/policies now exist. Next: actual multi-client private Realtime acceptance, including topic forgery, isolation, membership revocation on an already-open socket, and presentation latency. Availability is verified; these network gates remain open. Main merge/deployment not performed.

Stop point: weekly usage reached 100%; five-hour remaining 52%. No reset redeemed. SQL dashboard tab is retained for continuation.

## Приёмка после сброса лимитов — текущий статус

Эта секция заменяет прежние сообщения об отсутствующих RPC/серверном блокере. Пользователь явно согласовал выпуск MVP с ограничением cached revocation: «проблема не так велика, можем пока жить и с ней». N02 revocation остаётся FAIL, а не искусственно закрытым gate.

- SDK сайта и live QA теперь одинаковый: supabase-js2.117.3. Подписка ожидает фактической готовности Postgres Changes (wait:true,timeout15000). Прежний SDK сайта2.110.3 этот параметр не поддерживал.
- Core live rules:5 кампаний×5 игроков,50 команд,10 тактов,25 подписок; публичная проекция, exact retries, altered retry PT409, race1 commit/4 conflicts, восстановление5 сессий — PASS. Первый cold-start прогон потерял часть уведомлений; warm повтор PASS. После readiness wait повтор PASS.
- Core live manual: тот же5×5 сценарий, но реальные table/move intents, Policy materialize/dispatch. PASS;50 команд,10 тактов; Realtime median1037ms/max1077ms от начала settle RPC, не время от клика. Кампании всех прогонов удалены. Receipt: ignored output/live-network-20261009.json; повторяемый скрипт сохранён в tools/qa.
- Private Broadcast: trusted own send PASS; forged author send=error; foreign RPC42501 и subscribe CHANNEL_ERROR; независимый public observer не получает private сообщения, private receiver получает. Revoked member на старом socket send=ok и доставка подтверждена: FAIL, принятый известный дефект.
- Презентационный live test сначала имел ошибки проверки (self:false на одном socket, повторный topic): low reviewer обнаружил, исправлено до получения окончательных результатов. Не использовать первый receipt как gate.
- Browser smoke через CUA: видимая форма добавления Убийцы, HUD -3/Enter меняет18→15, reader открывает все4 блока. Снимок ignored output/mvp-release-reader-20261009.png. Только локальная UI проверка, не два сетевых браузера.
- Настоящий UI→Sync→socket двух браузеров и длительный jitter/loss прогон показов остаются непроверенными. Короткий SDK core test и VM7500 кадров не заменяют их. Start-rules initializer и полный UI backlog тоже не объявляются завершёнными.

Полный npm test на неизменных executable sync/index и прежних production модулях запущен; receipt output/mvp-release-final-20261009.log. Итог будет записан перед merge.

Окончательный независимый socket test подтверждает оба направления cached revocation: удалённый участник всё ещё отправляет и получает Broadcast на старом соединении. Fresh positive controls выполнены до отзыва; owner отправлял в собственный topic. Обе проверки false. Тестовая кампания удалена, все сессии signOut; Auth-записи остаются (public key не admin). Ограничение принято пользователем; не обозначать его исправленным.

## Готовый пакет к merge

Повторный полный `npm test` завершился **PASS exit0**: output/mvp-release-final2-20261009.log. Первый release-final остановился только на старом проверочном pin SDK2.110.3 в qa.mjs; ожидаемый pin обновлён до2.117.3, затем полный прогон повторён на неизменном исполняемом коде и тестах.

Настоящие два браузерных клиента через CUA, origin127.0.0.1 и localhost (раздельные гостевые сессии), production HTML clone/cache QA: ведущий создал Disposable UI MVP QA20261009, второй вошёл по видимому приглашению; добавленный Убийца и HP18→15 через HUD появились у игрока. Линия B3→E3 и пинг C4 через инструменты видны игроку с автором QA ведущий; подтверждены скриншотами output/mvp-shared-line-player-20261009.png и output/mvp-shared-ping-player-20261009.png. Это закрывает короткий UI→Sync→socket smoke пинга/линии; остальные lifecycle и длительный loss/jitter показов остаются отдельной проверкой. Кампания браузерного прогона ожидает отдельного подтверждения UI удаления.

Readonly low reviewer не обнаружил блокеров в sync/index/QA diff. Зафиксированное ограничение revocation остаётся принято пользователем. Ручной MVP готов к публикации; это не обещание завершённого start-rules initializer, всего UI backlog или всей автоматизации LionWing.

## Финальная проверка перед слиянием

Последняя правка обновляет индикатор синхронизации после очистки in-flight очереди: надпись «Сохранение…» больше не остаётся после завершённого RPC. Регрессия проверяет успешную запись и окончательный отказ.

Полный npm test с этой правкой завершился PASS, FINAL_EXIT=0: output/mvp-release-final4-20261009.log. Прогон final3 был прерван при восстановлении окружения и не считается завершённым.
