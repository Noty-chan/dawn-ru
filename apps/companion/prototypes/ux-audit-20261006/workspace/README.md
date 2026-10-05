# Workspace draft

Local-only buildless HTML/CSS/JS. Открыть `http://127.0.0.1:8772/apps/companion/prototypes/ux-audit-20261006/workspace/` при запущенном из checkout `python -m http.server 8772 --bind 127.0.0.1`.

Skills: Sites local-only (прочитан SKILL.md и local preview reference), computer-use (прочитан SKILL.md; UI API через CUA). Никакой регистрации/публикации.

Моки: два героя, роли, ресурсы, поле, правила, пул и результат броска. Нет production scripts, network, localStorage, sync или настоящего ядра. Подтверждение не тратит ресурсы. Import читает только name из выбранного JSON, не сохраняет файл/героя. Настройки меняют только DOM-тему; print использует демонстрационный лист. Правила — условные пересказы, не канон. Редактирование имени и задача сохраняются в памяти до перезагрузки; остальные editor inputs — визуальные моки.

Сценарий QA: Стол → выбрать Реакция → справка → вернуться → то же действие. Справка → полные Правила → поиск → к исходному действию. Герой → редактировать → имя → играть → Инструменты → Стол: герой и роль сохраняются. Справочник → «стресс» → результат/очистка → категории. Настройки → тема, импорт JSON {"name":"Тест"}, предпросмотр печати. Повторить на 1440×900 и 390×844; keyboard Tab/Enter/Escape, отсутствие horizontal overflow, возврат фокуса из диалога.

Browser tests этого агента: not-run из-за CUA hidden-tab ограничения subagent; parent QA ожидается. JS syntax проверен отдельно. Production npm tests не нужны для standalone mock. Сервер session 66731 оставить до root QA, затем остановить. Ни commit, ни push не выполнялись.
