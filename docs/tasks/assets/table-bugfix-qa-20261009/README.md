# Свежие доказательства обычного сайта · 09.10.2026

Все PNG получены с опубликованного `noty-chan.github.io/dawn-ru/companion/index.html`, без QA HTML, подмены store и скрытия элементов. Основной отчёт: [TABLE_BUGFIX_QA_REPORT](../../TABLE_BUGFIX_QA_REPORT_2026-10-09.md).

G: Chrome 1920×919, Нарратор. P: отдельный гостевой IAB 1280×720; файл29 —1152×700. PNG не содержат приглашений, credentials или email аккаунта. Наблюдения DOM и измерения также относятся к этой новой кампании; JSON не является VM/fixture.

Некоторые screenshot calls возвращали кадр до последнего paint. Имена файлов обозначают момент запроса, **не гарантию**, что новый DOM уже попал в пиксели. Ограничения ниже обязательны при чтении отчёта.

| Файл | Что он доказывает / ограничение |
|---|---|
| 01-first-npc.png | Новый отдельный manual стол, первый NPC, обычная палитра. |
| 02-reader-four-sections.png | Все четыре блока Reader открыты для G. |
| 03-hp-relative-not-committed.png | Footer содержит -1, токен сохраняет12/18. |
| 04-hp-plus-five-absolute.png | После ввода +5 видны5/18 и footer5. |
| 05-hud-edge.png | HUD у NPC на краю, Reader справа. |
| 06-crowd-manual-actions.png | Старые границы Хода/Раунда и кнопка «2 урона» в manual. |
| 07-hud-zoom30.png | Запрос кадра при проверке30%; наличие открытого HUD следует сверять с DOM, не выводить из имени. |
| 08-hud-zoom180.png | Финальный повторный кадр открытого HUD при180%, ЗД отдельно под токеном. |
| 09-clock-first-click.png | Кадр первой пробы часов; время получения ≤519мс от начала команды инструмента. |
| 10-clock-groups.png | Диалог трёх компактных групп ручных часов. |
| 11-tension-draft-before.png | **Capture lag:** показывает999, а не новый draft17. Не является визуальным доказательством draft17. До-update value17/focus=true подтверждены read-only DOM receipt. |
| 12-tension-draft-after.png | После external repaint показано999; отсутствие focus подтверждено DOM. |
| 13-technique-personal-counter.png | Личная отметка и счётчик способности NPC. |
| 14-square3-center.png | Сохранённая геометрия square3; точные9cells подтверждены DOM labels/classes. |
| 15-interior-transfer.png | UI инспектора переноса; появление токена внутри3×3 и A2 подтверждены последующим DOM. Не считать кадр единственным доказательством смены active space. |
| 16-player-hidden-summary.png | P-проекция: скрытый NPC отсутствует на поле; закрытые abilities не показаны. |
| 17-shared-line-player.png | Линия B3→E3 доставлена P с подписью QA Нарратор. |
| 18-shared-ping-player.png | Ping C4 доставлен P, подпись QA Нарратор. |
| 19-brush-four-cells.png | Местность после drag; ровно4cells и исчезновение одним Undo подтверждены DOM. |
| 20-classic-smoke.png | Обычный classic UI на тех же данных. |
| 21-en-mixed-labels.png | EN topbar/footer при RU служебной строке сцены; полный список непереведённых aria/settings в DOM receipt. Сохранённые пользовательские имена не считаются дефектом. |
| 22-panels-reader.png | Reader справа и инициатива слева; левая рабочая панель при этом отсутствует. |
| 23-left-panel.png | **Capture lag:** кадр ещё показывает Reader. Не доказывает успешный paint контекста слева. Последующий DOM подтвердил left-context и закрытый Reader. |
| 24-counters-all-hidden-reload.png | Все три token counters скрыты после reload. |
| 25-stress-three.png | **Capture lag:** кадр ещё показывает пустые ромбы. 3/disabled и предупреждение подтверждены DOM, не этим PNG. |
| 26-roll-journal.png | Публичный ручной бросок в обычном журнале. |
| 27-player-optimistic-pending.png | Optimistic Раны3, панель уже сообщает «Синхронизировано». Первая проба не измерила ack. |
| 28-counter-pending-status.png | Вторая проба: Раны3 и «Синхронизировано» до наблюдаемого изменения подтверждённой версии. |
| 29-tablet-hud-player.png | P HUD помещается при1152×700. |
| 30-token-hover.png | Только кадр после middle-pointer пробы; **не доказательство чистого tooltip hover**. |

`ui-observations.json` — честная транскрипция возвращённых DOM/AX результатов, не автоматически снятый полный trace. `timing-observation.json` — времена браузерных операций/наблюдений, не аппаратные timestamps клика и не внутренние RPC traces. `rapid-click-observation.json` — пять Focus clicks2→7; проба Ран на потолке3 исключена из приёмки. `footer-geometry.json` — реальные DOM rect/SVG и проверки `:hover` четырёх footer buttons. `SHA256SUMS.txt` фиксирует содержимое артефактов этого аудита.
