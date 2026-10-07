# Ручной стол: контрольная точка 7 октября

## Приоритет и договор

Последний запрос пользователя важнее старых аудитов. Нужен практически отдельный компактный ручной стол, а не старый боевой пульт с выключенными кнопками. Ручное ведение важнее автоматического. Старые задачи брать только по пути. Палитру сохранять. Новые экспериментальные интерфейсы должны быть включены по умолчанию, старый вариант сохранить переключаемым. При 4–8% остатка пятичасового лимита сохранять отдельную ветку и инструкции.

Рабочая ветка: `codex/manual-table-checkpoint-20261007`, основана на `aaa37e0` ветки `codex/table-tools-continuation-20261007` (draft PR #9). **Не сливать эту контрольную точку как завершённый редизайн.**

Требования: один переключатель режима в верхнем меню «Ведение»; предупреждения стен/местности без блокировки; инициатива без ОД; выключаемая обработка статусов (выключено — подписи/иконки; включено пока только объяснения без скрытых списаний); кубы, часы, личные ручные переключатели Техник и показ областей игрокам; удобное чтение своих способностей и всех противников для Нарратора. Интерфейс существенно сократить. HUD вокруг токена — ПК/планшеты; телефон без него. HP: ввод заменяет число либо применяет +/-; Enter/blur, без галочки.

## Что уже сделано

- `scene-table-policy.js`: общая policy manual/rules, эпоха, storage-only table.command, общий контракт version/receipts/replay. Автоматические dispatch/prepare блокируются в manual. Нет боевых entry/auras/AP/KO/passives при ручном перемещении/ресурсах/инициативе. Ручные статусы отдельно от исполняемых effects.
- Новая пустая Scene manual; старые сохранения без policy остаются rules. app-core сохраняет ручные поля; отключены вывод KO/склейка compound/Brace/entities при нормализации manual. Повторное чтение листа не перетирает ручные значения.
- `scene-manual-workspace.js/css`: компактный footer, ручная инициатива, панель чтения, команды через host adapter. `scene-manual-integration.js` подключает к существующему writer. index/SW/loaders обновлены.
- network-v2 новый table intent с проверками владельца/эпохи; старые автоматические намерения в manual отвергаются. Переход policy через v2 snapshot запрещён; повторный join не должен удалять ручные HP/maxHP/focus.
- Верхнее меню: grid label/select, outline внутрь, stacking/мобильный viewport; убрана кнопка массового включения автоматики. HUD HP/status направлены в ручные команды.

## Обязательная следующая работа — интеграция НЕ закончена

1. **Сначала воспроизвести приложение и проверить реальные маршруты.** Footer Кубы/Часы пока открывает старый utility. Подключить все действия к новым table commands, не оставлять видимые кнопки, которые отправляют автоматические события и получают отказ. Связать ручные ресурсы с Hero/Tools без двойных записей. `roll`, `clock/create/set/remove`, `technique`, `area/create/remove` есть в core, проверить окончательный контракт прямо в файле.
2. `manualTableAbilities` сейчас читает LionWing техники, поля ability и notes. Нужен полный NPC ability reader (канонические профили/действия) и полноценные формулы Способностей героя, а не пустые desc. Подключить показ области и общий read-only handout игрокам. Статусы включаются через HUD; добавить переключатель обработки статусов в единственное меню режима и честные read-only подсказки.
3. **Переход manual → rules сейчас намеренно заблокирован**: явная команда start-rules не подключена. Реализовать отменяемый preview с выбором первого участника, сохранить HP/карту/ручные данные, инициализировать боевой runtime через безопасную явную границу. Не использовать старый scene reset. Pending chains запрещают смену режима.
4. Закрыть все snapshot/legacy/undo обходы. Сейчас snapshot guard проверяет лишь policy, не защищает runtime от произвольного старого mutator; старые ручные кнопки могут исполнять destroy/passives до snapshot. Нужен защищённый transaction boundary, отдельное безопасное ручное undo, stale queue tests. Проверить legacy acceptPreparedRemoteCommand, prepareUndoCommand, actor creation/deployment, old hotkeys, lwSubmit и рендеры. Авторитетный writer остаётся flushNetworkV2Authority/commitNetworkV2Tick; не создавать второй.
5. Геометрия: fresh browser 1440×900 и 390×844 загрузился без pageerror (Edge, изолированная страница, Supabase route aborted). **390px screenshot плохой**: footer тесный, подписи налезают, пустая Scene на карте уходит за край. Исправить layout целиком; проверить реальные токены/reader/оба окна/инициативу/HUD и popover рядом с краями. Скрины в assets показывают состояние, а не утверждённый результат. Никакой проверки общей живой сети не было.
6. Локальная двухклиентная сеть/Realtime/RLS ещё not-run. Не тестировать на чужом рабочем столе. Проверить owner permissions, ручные команды, старые клиенты, policy epoch, retry/duplicate, отвергнутые intent, HP/undo reload.

## Проверки

Targeted PASS: `table-manual-policy.mjs`, `table-manual-workspace.mjs`, `table-manual-persistence.mjs`, `scene-workspace-next.mjs`, `lionwing-engine.mjs`, `lionwing-counters.mjs`, `lionwing-auras.mjs`, `lionwing-destroy-wiring.mjs`, `qa.mjs`. Core тесты используют настоящее ядро, включая Gas/aura/wall/occupied, HP0 без KO, pending/atomic/replay guards. Network unit test нужно проверить в итоговом журнале.

Полный `npm test` запускался; первый запуск упал в destroy-wiring из-за window в VM, это исправлено. Повторный итог записать ниже после завершения. Логи в root ignored `output/`; итоговые необходимые доказательства сохранены в GitHub assets. Browser загрузка — smoke, не user acceptance.

## Предыдущие задачи / отдельная незавершённая работа

Полный список: `COMPANION_COMPLETE_BACKLOG_2026-10-07.md`; исторический договор `TABLE_TOOLS_PLAN_2026-10-06.md`; прежняя передача `TABLE_TOOLS_CONTINUATION_2026-10-07.md`. Последний ручной договор из этого файла имеет приоритет.

Предыдущие переводы/история/герой: commits 5202d8d,1402519,e691526,aaa37e0. Нельзя говорить, что весь языковой аудит и все U/M/N закрыты.

Парковка атомарной оплаты/All Out/Risk: **отдельная GitHub ветка `codex/freeplay-atomic-wip-20261007`**, основана на aaa37e0. Это unverified WIP четырёх файлов play-ui.js/network-v2.js/app-sync-events.js/scene-sync-ui.js. Локальная копия также stash `WIP freeplay atomic resolution parked for manual-table priority`. **Не применять stash поверх ручной интеграции.** Сначала изучить diff, затем переносить осмысленно. Причина парковки — приоритет рабочего ручного стола. Canonical LionWing PDF локально в source/original; All Out/Risk проверять по нему, пользовательские тексты не переводить автоматически.

## Подхват

Получить ветку с GitHub, прочитать этот файл и последний diff. Не трогать пользовательские `.codex-remote-attachments/`, `apps/companion/output/`, `site/dead-gods/maps/`. Не публиковать draft в main. Проверки запускать из apps/companion; root `output/` — временные логи/браузерные инструменты. Следующий шаг — закрыть manual utility и snapshot boundary, затем новая проверка геометрии, после этого safe start-rules.

## Итог контрольной точки

Остаток при начале сохранения: 8% пятичасового окна. Network targeted `table-manual-network.mjs` PASS. Повторный полный npm test **FAIL**: `tests/lionwing-enemy-inventory.mjs:182` — S00 inventory stale (после изменения production source нужно заново сформировать inventory через его --write и проверить diff). Не обходить проверку, затем повторить полный npm test. Зафиксированные изображения — свежие screenshots из изолированного локального браузера, показывают известные недостатки.

Следующий агент должен отдельно проверить bridge `scene-manual-integration.js`: он подключён, но для utility/abilities/status hints не завершён. Формулировка «рабочий стол готов» пока неверна. Все изменения checkpoint сохраняются как draft; отдельный WIP оплаты уже отправлен на GitHub. Никакой активной публикации сайта из этой ветки не было.
