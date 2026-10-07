# Ручной стол: продолжение 2026-10-08

База: `dadc66b`, рабочая ветка `codex/manual-table-continuation-20261008`. Продолжение checkpoint, а не завершённый редизайн. Main не изменён. Приоритет — отдельный компактный ручной стол на ПК; атомарный freeplay WIP остаётся отдельной веткой.

## Сделано

- Footer «Часы» открывает отдельный RU/EN диалог: создать progress/danger/counter, точное значение Enter/blur, удалить. Все записи проходят `table.command`; владение проверяется заново. Максимум до миллиона отображается числом, без миллиона сегментов DOM.
- Вкладка «Инструменты» читает ручные часы без legacy migration и открывает тот же редактор. Прежний read helper мог стереть часы из Scene, подставив пустой runtime героя.
- Незавершённый ввод значения сохраняется при render Scene. Смена policy/стола закрывает диалог; потеря прав или удаление записи сбрасывает редактор. Название при queued create сохраняется до подтверждённого локального результата; повтор одного черновика использует тот же ID.
- Ластик и удаления в старом инспекторе в manual обходят механический DestroyPlan и отправляют storage-only удаления backing/actor. Технические связи очищаются без исполнения потери источника. Pending workflow и роль ведущего проверяются. Удаление пространства/абстрактной сущности пока безопасно отказано.
- Удалённый владелец manual clock/area остаётся записан как ID, чтобы reload не превращал личную запись в общую. JS public projection скрывает часы недоступных владельцев; журнал наследует закрытость удаляемой записи/скрытого участника.
- Reader теперь содержит формулу способности именно выбранного героя, техники, пассивку/защиту/действия/козыри/награды НПС. Нет зависимости от текущего S и нет кнопок запуска механики внутри этих описаний.
- Добавление профиля НПС в manual больше не вызывает prepareEnemyDeployment: ранее отказ ручного ядра откатывал создание участника.

## Серверная граница — обязательное незавершённое действие

Подготовлена новая миграция `supabase/migrations/202610080001_manual_table_public_records.sql`. Она фильтрует manual clocks по видимому владельцу, скрывает manual pointer и eventReceipts, удаляет ссылки на закрытые часы из старого публичного журнала и пересобирает существующие `scene_public_snapshots` из authoritative scenes.

Миграция **НЕ применена к живому Supabase**. До её применения скрытие в UI/JS не устраняет доступ игрока к сырому старому серверному JSON. Офлайн PGlite-тест воспроизводит исходную утечку, проверяет новую проекцию, backfill, неизменность authoritative Scene и повторное применение. Не выдавать это за проверку live RLS/Realtime.

## Проверки

- Actual UI-function tests: clock create/set/remove, ownership loss, invalid bounds, no resource mutation, draft preservation and policy epoch close.
- Actual deletion UI route + engine: mechanical planner не вызывается, скрытость журналов, технический actor backing cleanup, pending/role checks.
- Actual persistence: два normalize/reload, orphan ownership, ручная зона/часы и safe deployment bypass.
- Reader tests на настоящих профилях LionWing: все passive/actions/aces/reward, actor-only формулы, отсутствие мутаций.
- Browser local: часы create/edit/delete/reload, сохранение после «Инструментов», большой counter, ручной бросок; профиль «Убийца» добавлен, пассивка и действия открыты в Reader. Скриншоты ignored: `output/manual-clocks-20261008.jpg`, `output/manual-reader-20261008.jpg`.
- Для browser QA использовать отдельный origin или HTML с версионированными ресурсами: dev SW иначе показывает прежний JS/CSS. Последний QA HTML ignored `output/manual-table-qa.html`, обычные исходные скрипты, только base/cache-buster.
- Первоначальный npm test остановился на stale S00 inventory; inventory пересобран и просмотрен — только ссылки на тесты, канонические тексты не изменены. Следующий прогон нашёл отсутствие window в VM deployment test; исправлен доступ через globalThis.window. **Итоговый полный npm test: PASS, exit 0**, лог `output/manual-table-continuation-20261008-final-test.log`. После него изменено только оформление диалогов и оно перепроверено в браузере.

## Следующий порядок

1. Подключить mouse/hotkey области, стены и маркеры к typed manual create, вместо старых area.create/wall.create/marker.create, которые manual engine отвергает. Маркерные часы всё ещё snapshot edit. Проверить инсектор и клавиатурную активацию клетки.
2. Снять старые автоматические surfaces из manual: HUD «Приёмы»/«Ещё», «Лист», director dock, token AP badge/tooltip, старый Tools challenge composer. Reader сам уже read-only, но «Лист» открывает старую панель. Аналогичный desc-only находится в scene-ui abilityCard.
3. Защитить весь snapshot/undo boundary от legacy runtime mutation; frozen Entities API, imported snapshots и stale intents остаются рисками из прежнего handoff.
4. Явный cancellable start-rules preview/первый участник; сейчас переход намеренно запрещён.
5. Показать область/handout игрокам, status mode selector. Затем desktop HUD/popovers/панели; mobile геометрия отложена решением пользователя.
6. Применение SQL и изолированный реальный двухклиентный прогон требуют отдельного безопасного контура. Действующие игровые столы и live Supabase для тестов не использовать.

Агентский поиск аналогов выполнен. Не заявлять, что ручной стол полностью готов, только на основании PASS unit suite.

## Второй пакет 8 октября — ручные инструменты карты

После `eed54a1` подключены UI mouse/Enter create routes областей, стен и меток через `table.command`. В области есть только визуальный appearance (terrain/difficult/high/low/custom), цвет, форма, имя и скрытость; storage type остаётся manual-area и не выполняет механику. Стена — ребро/имя/скрытость. Метка — нейтральный вид/цвет/имя/скрытость, опциональные ручные часы через marker/clock-set. Источники/автоматические сроки/ЗД Стен скрыты из этих форм. Карточки окружения read-only + GM delete; legacy append срока отключён для manual.

Закрыты найденные агентом дефекты: crash renderer на manual-area, потеря manual/hidden/ownership маркеров и стен, публичность локального player preview, snapshot-delete из контекстного меню маркера, snapshot edit часов метки, silent loss 241-го объекта, неканонические координаты 01,1. Добавлены cap240 и atomic validation/replay; same wall edge повторно не создаётся. Нормализация сохраняет typed metadata после reload. SQL **ещё не применён**; подготовленный файл расширен фильтрацией скрытых стен и owned markers. Старую применённую миграцию не меняли.

`table-manual-map-tools.mjs` PASS: настоящий UI helper + ядро + normalization, роли, capacity/canonical cells, сохранение private metadata, no target/resource changes, replay. PGlite projection test расширен walls/markers. Полный `npm test` PASS (exit0), `output/manual-map-20261008-test.log`; после него только удалена временная диагностика и добавлен manual guard к legacy duration append. Финальные syntax/map targeted PASS.

Browser PASS: area2x2 placed, wall placed/duplicate rejected, marker placed Enter, marker clock+1; reload; GM→Player hides wall/marker while publicarea remains; A shortcut and Escape; inspector-delete and Enter erase. **Mouse erase NOT ACCEPTED:** CUA Playwright gridcell.click в erase дважды не вызвал основной click listener, но Enter на той же клетке вызвал и удалил объект. Временные QA.click/QA.erase logs удалены. Перед следующим пакетом воспроизвести настоящей мышью/координатным кликом: выяснить, виноват browser locator/pointer preview или UI. Не объявлять mouse eraser исправленным только по unit tests. Также проверить wall wheel camera/ghost в реальном браузере; старый wheel suite проходит, новый browser прогон не выполнен.

Остаток порядка: завершить browser mouse erase/wall wheel; затем убрать старые автоматические surfaces (HUD/Sheet/dock/tokenAP/Tools), typed clear manual traces и snapshot/undo границу; start-rules; shared area/handout/status selector. Карта в manual еще требует итоговой эстетической проверки; полное переключение механики/интерфейса не готово. Main не сливать как завершённый редизайн.

### Мини-передача: диагностика клика ластика

На базе `ae92f35` код не менялся, выполнено только чтение. Новая **неподтверждённая гипотеза**: `sceneSpaceHeld` снимается только обработчиком keyup Space (`app-scene-events.js:164–165`). Потерянный keyup при смене фокуса может оставить панорамирование активным: mousedown на строке160 при этом вызывает preventDefault для левой кнопки. Enter не вызывает mousedown и в воспроизведении успешно удалял область. Проверить сброс флага при blur/visibility change и аппаратный координатный клик против CUA locator click.

Первый диагностический лог поставить в начале основного click handler (`app-scene-events.js:170`), **до** проверки `performance.now() < sceneSuppressBoardClickUntil`: время, deadline, event.target, ближайшая cell. Дополнить capture pointerdown/up для фактической цели. Suppression задаётся на600ms в dragstart/drop (строки249/251). Capture handlers техник в конце файла — второй кандидат, но успешный Enter снижает его вероятность.

Preview ластика не вызывает renderScene: меняет классы и подпись. Подпись имеет pointer-events:none (`scene-workspace-next.css:118`), preview стены тоже (:120). Прямая причина отсутствия mouse click пока не доказана. Начать с раннего подавления → панорамирования → цели указателя/перекрывающего элемента. Живой Supabase для воспроизведения не использовать.
