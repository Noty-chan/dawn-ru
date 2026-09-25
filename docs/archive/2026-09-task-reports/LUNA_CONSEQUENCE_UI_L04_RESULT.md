# L04 · UI последствий Уязвимости

Ветка `codex/luna-l04-consequence-ui` создана от `origin/main` SHA `d7e24a1`. Изменения ограничены `apps/companion/lionwing-ui.js`, `apps/companion/locale-ru.js` и поведенческим тестом `apps/companion/tests/lionwing-consequence-ui.mjs`.

## Что сделано

- Окно последствия теперь читает стабильные категории из `LionwingEngine` и показывает все пять категорий: Ранги Навыка, часть Способности, Дар, два Уровня Техник, смерть и создание нового героя.
- Для каждой доступной категории строится выбор конкретной цели из заполненного actor-листа. Ранги и Уровни Техник показываются как ручной preview; UI не меняет builder-элементы автоматически. Выбор игрока отправляет typed `lossTarget`, а произвольная запись без цели для нового окна недоступна.
- Уже использованные категории помечаются и блокируются. Для удалённой Сцены окно доступно только владельцу героя; клиент Нарратора видит ожидание решения и не получает кнопок выбора игрока.
- После выбора в истории сохраняются категория, конкретная цель и `pending-manual`. История показывает ясный ручной остаток. Отдельные кнопки Нарратора отправляют `correct` с `resource: "consequence"`, `consequenceId` и `operation: apply|reopen|void`; engine остаётся единственной границей изменения состояния, а лист героя UI автоматически не меняет.
- Тест проверяет реальный engine-flow: Vulnerable KO → пять категорий → concrete target payload → запись `pending-manual` → JSON reload → история → отдельная narrator correction → `applied`, включая отсутствие автоматического удаления Дара из листа.

## Проверки

Успешно:

- `node --check apps/companion/lionwing-ui.js`
- `node apps/companion/tests/lionwing-consequence-ui.mjs`
- `node apps/companion/tests/lionwing-consequences.mjs`
- `npm test` из `apps/companion` (полный набор companion QA)

Браузерный прогон через штатный Playwright wrapper не запустился на этом хосте: WSL2 сообщает, что виртуализация отключена. Поведенческий тест отрендерил тот же UI-адаптер в VM с реальным `LionwingEngine`.

## Границы для интегратора

1. `apps/companion/network-v2.js` находится вне lock L04. В `materializeIntent` поле `choice` сейчас пропускает `id`, `choice`, `destination`, `note`, `planId`, но отбрасывает `lossTarget`. Минимальный patch интегратора — добавить `"lossTarget"` в whitelist `fields.choice`; существующий `clone` уже применит безопасную копию. UI использует только это поле, поэтому `target`/`consequenceTarget` добавлять не требуется.
2. Мост hero export/import также находится вне lock. Export в `app-builder-events.js` сериализует builder `S`, import прогоняет данные через `normalizeHero` из `app-core.js`, а `normalizeHero` не сохраняет поле `lionwing`. Typed records сейчас корректно живут в scene actor и проходят `sceneCore`/`normalizeScene`, но отдельный hero JSON их не переносит. Если продукту нужен перенос истории последствий вместе с героем, минимальный patch должен добавить ограниченное поле `lionwing.consequences`/`legacyNotes` в нормализацию и export/import, затем объединять записи по `id` в `heroActorState` без удаления scene-записей. Эти файлы в L04 не редактировались.

Итоговый SHA этого единственного локального коммита указан в ответе агента и должен быть перенесён интегратором без push из этой ветки.
