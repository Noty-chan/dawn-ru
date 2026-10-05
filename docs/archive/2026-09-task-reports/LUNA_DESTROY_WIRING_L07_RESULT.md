# L07 — подключение единого удаления LionWing

Дата: 2026-09-21. База: `252cf9263a2defc65381bfde2bb6932290afef5d` (`origin/main`).
Ветка: `codex/luna-l07-destroy-wiring`. Ветка создана в отдельном worktree; push не выполнялся.

Этот отчёт применяет обязательный шлюз из `LIONWING_INTEGRATION_ACCEPTANCE_GATE.md` на commit `440eaad`.
Полный `npm test` прошёл на проверенном дереве, соответствующем production/test-содержимому SHA `88926bc6d49d2a0afa896d74a4812ecc88da3fd3`.

## Статусы шлюза

| Блок | Статус | Production entry point и доказательство |
| --- | --- | --- |
| План загружен в приложение | **verified** | `index.html` подключает `lionwing-destroy-plan.js`, `sw.js` включает его в `SCRIPT_ASSETS`; браузер поднял `window.DAWN_LIONWING_DESTROY_PLAN`. |
| Удаление участника | **verified** | `data-scene-remove-actor` и board erase проходят через capture `handleLionwingDestroyClick` / erase-ветку, затем `commitLionwingDestroy` → `prepare` → confirmation → `apply` → `commitScene`. Реальный браузерный прогон выполнил отмену, применение, undo, reload и redo. |
| Массовка и массовое удаление НПС | **connected** | `#scene-remove-npcs`, `data-crowd-remove-defeated`, `data-crowd-remove-group` передают полный набор `actorIds` в единый план; production capture wiring и targeted тест проверяют реальные селекторы. Отдельный browser-run группы не выполнялся. |
| Пространство | **connected** | `[data-manage-space-remove]` и `removeManagedSceneSpace` LionWing-ветка вызывают тот же writer; переносы, Compound и заполненное поле покрыты targeted plan/placement tests. Отдельный browser-run пространства не выполнялся. |
| Backing и связь сущности | **connected** | `[data-scene-remove-object]`, marker/wall selectors, board erase и `[data-lw-entity-destroy]` перехватываются capture wiring и используют типизированные цели плана. `lionwing-ui.js` не менялся; отдельный browser-run этих кнопок не выполнялся. |
| Один writer истории | **verified** | `Plans.apply` в UI получает `recordHistory:false, advanceVersion:false`; `commitScene` один раз увеличивает `version`, добавляет один undo, пишет journal/persistence и обновляет receipt. Targeted тест использует production bodies `validateTableEdit` и `commitScene` и проверяет ровно `+1`/`1 undo`. |
| Безопасное размещение | **verified** | Передаётся существующий production `placeActorsSafely`; preview читает реально возвращённую Scene. Production fallback учитывает `occupiedWidth/occupiedHeight`, не накладывает большую фигуру на занятую клетку и создаёт отдельный резерв либо отклоняет операцию. |
| Локальное сохранение и replay/stale | **verified** | План не мутирует исходную Scene до commit; cancel, missing target, stale version, повтор receipt, protected rollback, adapter postcondition и JSON reload покрыты тестами. Браузер сохранил удаление в localStorage, пережил reload, затем восстановил undo и повторил redo. |
| Live network | **blocked** | Для локального стола путь persistence проверен, но подключённой Supabase/network комнаты и двух браузерных клиентов в этом worktree нет; server sanitizer, reconnect и online replay не доказывались. Это зависимость следующей network-приёмки. |

## Контракт и изменения

`commitLionwingDestroy` в `scene-ui.js` — production entry point для всех перечисленных UI intent. Он создаёт план с текущими `version`/fingerprint, показывает единое подтверждение и передаёт в `commitScene` только ephemeral план. Подтверждение перечисляет переносы, удаляемые backing, инвалидируемые ожидания и строку `Защищённый блок`; отмена возвращает исходный снимок без записи.

`applyDestroyPlan` работает на копии. Его контракт для UI явно допускает `plannedDestroy:true`, `recordHistory:false`, `advanceVersion:false`; единственным владельцем `version`, undo, journal и persistence остаётся `commitScene`. Реальный `validateTableEdit(before, after, { plannedDestroy: plan })` разрешает только этот явный planned-delete путь и проверяет pending owner/target отдельно от unrelated actor. В backup-нормализации удалён прежний no-op `validateTableEdit(scene, scene)`.

Transient `plan.before` не кладётся в Scene/UI attributes и удаляется из `serialize`, `reload`, `cancel` и публичного плана. Полный before/after остаётся только в краткоживущем результате apply, необходимом для внутреннего undo-контракта. Adapter space removal проверяет postcondition и отклоняет операцию, если обработчик вернул управление, но не удалил space. Placement preview строит transfers по возвращённой primitive Scene.

Таблица source-loss больше не обещает ложную политику `preserve`: используются канонические `disable`/`remove`/`detach`, а независимые последствия сохраняются отдельными записями. Старый 0.9 путь и старый UI-файл сохранены.

## Реальные зависимости и границы

Targeted wiring test загружает production `lionwing-entities.js`, извлекает production `validateTableEdit` из `app-core.js`, production `commitScene` из `scene-ui.js` и production `placeActorsSafely` из `app-scene-events.js`. Заглушены только внешние DOM/render/Sync callbacks, необходимые для изолированного вызова commit body; validator, writer, plan, entity cleanup и placement остаются production-кодом. Browser-run использовал настоящую `index.html`, loader, native confirm, DOM-кнопку и localStorage.

Проверенные команды:

- `node --test apps/companion/tests/lionwing-destroy-plan.mjs apps/companion/tests/lionwing-destroy-wiring.mjs` — passed;
- `node --check` для `app-core.js`, `app-scene-events.js`, `lionwing-destroy-plan.js`, `scene-ui.js` — passed;
- `git diff --check` — passed;
- `npm test` — passed; legacy Raasha exact-sheet fixture skipped без `DAWN_RAASHA_FIXTURE`, остальные assertions passed.

Browser URL: `http://127.0.0.1:8765/index.html?lang=ru&edition=lionwing&mode=play`. В заполненном GM столе кнопка `Убрать «Убийца» из Сцены` показала единый текст подтверждения, cancel оставил один actor и историю без нового шага, accept убрал actor, undo восстановил его, reload сохранил состояние, redo снова убрал actor. Пустое состояние также открывалось до добавления участника.

## Остаток и not-run

Не выполнялись live network/Supabase комната, два независимых клиента, browser-run bulk/group/space/backing/entity каждой отдельной кнопки, мобильный viewport и player projection. Не требовались hero export или table backup для удаления участника: операция изменяет Scene, а не лист героя; локальный Scene persistence проверен отдельно.

При browser-run остаётся один известный console error, существовавший до удаления: `SceneEngine.numericQuote is not a function` из `sceneNumericSourcesHtml` при открытии inspector. Он не блокирует кнопку удаления, confirmation, commit, undo, reload или redo; network proof его не заменяет.

Final full-test SHA: `88926bc6d49d2a0afa896d74a4812ecc88da3fd3`.
