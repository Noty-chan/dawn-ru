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
