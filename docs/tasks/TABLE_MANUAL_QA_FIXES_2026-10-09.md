# Исправления ручного стола по аудиту 09.10.2026

Запрос: `2a3bde19880e465c51be3147352262fcd1207895`, ветка `codex/table-bugfix-qa-20261009`.
Реализация: `codex/table-qa-fixes-20261009`, база включает актуальный на начало работы `origin/main` (`6dd57c1`).
По уточнению пользователя этот пакет проверяет **ручной стол**. Режим «По правилам» проверяется независимо в отдельном чате `01a12091-315e-7271-a078-252e9f829d01`.
Исторический [отчёт аудита](TABLE_BUGFIX_QA_REPORT_2026-10-09.md) сохранён без переоценки его 28 BLOCKED.

## Что исправлено и чем подтверждено

| ID | Причина и исправление | Доказательство на текущем коде | Остаток приёмки |
|---|---|---|---|
| F1 | Footer использовал native number и абсолютный Number; HUD — signed text. Оба используют общий `healthInput` в policy. Footer текстовый, Enter/blur защищены от повтора, принятая дельта отображается абсолютным значением. Абсолютная коррекция не обрезается молча; сервер сохраняет свою валидацию. | Native Chromium: footer из12 `-1`→11 (Enter+Tab), отдельно из12 `+5`→17 (Tab); HUD из12 `-1`→11, token/footer совпали. Reload сохранил значение. Общий parser и реальные reentrant handlers покрыты `table-manual-workspace`/`scene-token-hud`. | Полная paired network проверка и полный native invalid/Escape/reject matrix не выдаются за выполненные. |
| F2 | Контекст пересоздавал input Напряжения при любой перерисовке. Теперь при том же scope сохраняется DOM; поле, draft и focus не теряются. Ввод имеет Enter/change/blur dedup, Escape, точные rejection receipts. Смена комнаты/epoch/поля/роли сбрасывает редактор; импорт/полная очистка увеличивают локальную generation. Изменение состава участников не считается сменой сцены. | Настоящая страница с явно обозначенным QA-драйвером отложенной **локальной** записи Ран: canonical999, набрано17; после записи Ран draft17/focus=true/canonical999; Tab→canonical17. Это проверка repaint, не Realtime. `manual-token-counters`: тот же input, отсутствие ранней записи, Enter/change/blur ровно1, Escape/потеря роли. Часы/ЗД/counters отдельно прошли. | Независимый сетевой клиент не подключался. |
| F3 | После базового manual renderer внешний inspector decorator продолжал добавлять crowd/automation controls. Manual теперь завершается на собственном информационном/числовом inspector. Автоматические декораторы остаются в rules. | Native NPC и массовка: ручные ресурсы, имя/цвет/видимость/инициатива/удаление; нет Пульта, сдвига после Хода, авто-урона/оплаты. Reader содержит полные тексты и личные пометки/счётчики. `table-manual-surfaces` защищает stale routes и typed writes. | Полный rules-проход относится к отдельному чату. |
| F4 | `beforeRead` закрывал обе рабочие панели. Desktop Reader освобождает только правую сторону, сохраняет разрешённую левую панель/инициативу. Правый рабочий panel закрывает конфликтующий Reader; all-left работает независимо. Narrow сохраняет договор одной панели. | Native «Все панели слева»: initiative56px, left301.39px, board393.19px, reader347.75px, границы не пересекаются. Закрытие/открытие Reader сохраняет левую панель, zoom61 и scroll0/0. [Снимок](assets/manual-qa-fixes-20261009/reader-left-panel.png). | Полная геометрическая матрица при разных zoom/width и narrow не повторялась. |
| F6 | Индикатор учитывал лишь очередь Нарратора. Теперь включает PlayerOutbox/in-flight и manual intents до canonical receipt; старый snapshot не снимает pending. Terminal reject очищает intent и показывает отказ без блокировки новых команд. Outbox сообщает settled после освобождения in-flight. | Production helper + настоящий `renderSync` в VM: player pending, вставка команды без ack, старый snapshot, exact receipt, reject, held send, settled. `manual-optimistic-snapshot` и `network-flow` PASS. | Настоящие socket/latency/reconnect браузерные сценарии не выполнялись. Исправление ожидания canonical receipt заявляется для manual, не для всех rules intents. |
| F7 | Статические role/close labels и динамические layout/grid/token aria не обновлялись целиком. Добавлены RU/EN catalog keys и live HUD/palette refresh. | Native RU→EN→RU без reload: settings/layout/role options, grid/cells, token HP, footer; все13 close-panel labels переведены. D6/координаты/пользовательские имена сохранены. `localization`, `scene-token-hud`, workspace tests PASS. | Не заявляется полная локализация всех legacy форм/всего приложения. |

## Соседние ошибки

- Кандидат `QA As`: ручной inspector теперь сохраняет сфокусированное имя и caret при repaint того же actor/scope. Общий inspector change-handler игнорирует native change, вызванный заменой DOM при paint. При потере прав имя не восстанавливается. Проверка общего renderer/guard в тестах и ревью; отдельный парный native rename сценарий не завершён.
- O1: после ack до освобождения authority/outbox Tools могли оставаться отрисованными с disabled Стрессом. Settled/status теперь обновляет только resource UI и stress trackers, без ухода из Tools/перерисовки посторонних форм. Callback проверен тестом. Нативное время server ack не измерялось; исторический O1 не переименован в production PASS.
- Ревьюер проверял изменённые обработчики и аналогичные пути. Подтверждённых блокеров финального manual diff не осталось.

## Итоговые проверки

- `npm test` — **exit0** на замороженном итоговом коде. Локальный журнал `output/table-qa-fixes-final-20261009.log`.
- Все15 `tests/table-manual-*.mjs` — **exit0**, журнал `output/table-qa-manual-final-20261009.log`.
- Целевые `manual-token-counters`, `manual-optimistic-snapshot`, `network-flow`, `scene-token-hud`, `localization`, `syntax` — PASS.
- `git diff --check` — PASS.
- S00 обновлён штатным генератором: только5 новых ссылок на тестовые доказательства; числа/статусы автоматизации не повышались.
- Native проверка — localhost, новая изолированная origin18819, стандартная HTML-разметка/JS/CSS с dev version и пустым QA network config. Production элементы не скрывались стилями. Воспроизведение F2 использует отдельную явно помеченную QA-страницу, не подменяет сетевой тест.

## Продолжение и выпуск

1. PR этого пакета можно ревьюить/сливать после проверки diff. Сервер/SQL не менялись, SQL002 повторно не запускать.
2. После слияния дождаться фактического Pages deployment, сверить SHA и повторить UI smoke на опубликованной странице. **Сейчас publication PASS не заявлен.**
3. В изолированной QA campaign проверить G+P: signed HP и сохранение, tension draft во время чужого ресурса, pending→ack/reject, быстрые команды/старый snapshot/reconnect; проверить O1 не покидая Tools. Пользовательские и активные игровые столы не использовать.
4. Остатки исторической матрицы закрывать отдельными доказанными сценариями. Этот пакет не означает37 PASS.
5. Отдельная проверка rules сообщила штатный `TABLE_START_RULES_UNAVAILABLE` при попытке начать новый автоматический стол. Не обходить этот guard; запуск/полный rules цикл остаются отдельной задачей.
