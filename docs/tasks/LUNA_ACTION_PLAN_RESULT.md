# Luna: фундамент ActionPlan

Дата: 2026-09-08. Изменены только `apps/companion/lionwing-action-plan.js` и
`apps/companion/tests/lionwing-action-plan-foundation.mjs`. Файл не подключён к
`lionwing-engine.js`, HTML или сборке: это изолированный контракт для следующего
ревью и подключения к reducer.

## Что реализовано

`global.DAWN_LIONWING_ACTION_PLAN` — замороженный read-only объект с чистыми
функциями. Все записи и результаты состоят из обычных JSON-массивов и объектов;
входные запросы, планы и снимки не изменяются.

- `open(request)` создаёт план со стабильными `rootActionId`, `definitionId` и
  `actionInstanceId`. `actionDefinitionId` оставлен как явный совместимый alias,
  но instance ID никогда не выводится из имени определения случайным образом.
  `openMany({rootActionId, actions})` создаёт несколько использований одного
  определения в одном root с разными instance ID.
- В плане отдельно зафиксированы `source`/`sourceId` и `owner`/`ownerActorId`,
  `snapshots.base`, `snapshots.targets`, `snapshots.costs`, `dicePolicy` и
  `geometry.anchor`. Снимок якоря может принадлежать актору, маркеру, сущности или
  клетке и не обязан совпадать с владельцем действия.
- `phases.before`, `phases.replace`, `phases.apply`, `phases.after` содержат
  только типизированные сериализуемые операции. `phase` и `status` показывают
  курсор подготовки: `draft/targeting/modifiers/previewed/committed` либо
  `cancelled/invalid`.
- `modifiers` нормализуются по типам `add`, `multiply`, `cap`, `replace` и
  `grant-exception`. У каждого есть `id`, источник, `ruleId`, `lifetime`,
  `order`, `stackingPolicy`, `consume`, `consumeBoundary`, `targetIds` и
  `consumedByActionId`. Порядок стабилен (`order`, затем ID); поддерживаются
  `stack`, `exclusive`, `replace`, `highest`, `lowest`, `unique`.
- `checkConflicts` явно обнаруживает конкурирующие `replace`/`exclusive`, в том
  числе две замены одной формы. `resolveConflict` сохраняет выбор новой ревизией;
  последний зарегистрированный обработчик сам конфликт не выигрывает.
- `quote(plan)` каждый раз пересчитывает `effectiveValues`, `totals`,
  `outcomes[targetId]`, порядок применённых модификаторов и
  `consumedModifierIds`. `preview` сохраняет цитату без оплаты. `commit` повторно
  вычисляет цитату, переводит план в `after` и отмечает потребляемый модификатор
  ровно один раз на `actionInstanceId`.
- `amend` принимает только цели, якорь/геометрию, модификаторы, фазы и сохранённые
  choices. Идентичность, владелец, базовые значения, цена, политика броска и
  вычисленные `quote/result/outcomes` неизменяемы. После предпросмотра retarget и
  recalculate требуют именованного окна; каждое изменение получает новую ревизию.
- `reload`/`fromJSON` проверяют сохранённую производную цитату после JSON round
  trip. Поданные `totals`, `result` или готовые значения цели сравниваются с
  повторным расчётом и отклоняются при расхождении. Повторный `commit` уже
  подтверждённого плана возвращает тот же результат (`replay: true`), не создавая
  второй расход; `eventId` сохраняется в `receipts`.
- `explain` возвращает JSON-проекцию источника, владельца, фаз, модификаторов,
  целей и итогов с коротким текстом для журнала. `validate` и `quoteStatus`
  позволяют UI получить ошибки без исключения.

При наличии `DAWN_LIONWING_EXECUTION` нормализатор переиспользует его текущий
контракт составной цены; самостоятельный fallback принимает тот же ограниченный
набор `resource/health`. Объектные сроки собственного Хода сохраняются в форме
совместимого `turn-boundary`. Готовые грани и Hits сюда не принимаются: dice
foundation остаётся владельцем случайности и результатов броска.

## Ограничения

Модуль не вызывает reducer и не списывает цену, не изменяет координаты, не
накладывает Эффекты, не создаёт `pendingAction` и не автоматизирует Техники.
`quote` — декларативный расчёт числовых полей из снимка; предметная трактовка
правила, валидность цены в живой Сцене и применение операций остаются у
execution/costs/dice/geometry и будущего адаптера. Проверка `scene` в
`preview/commit` только повторяет наличие источника и целей, версию Сцены и
доступный геометрический план, если соответствующий foundation загружен.

Потребление пока фиксируется на границе подтверждения как один расход на
модификатор и ActionPlan; фактический ресурсный ledger и undo должны принять
`consumedModifierIds` атомарно. Циклы между ActionPlan и execution не строятся.

## Точки будущего подключения

Reducer может принять `preview.plan` как декларативное `action.plan.preview`,
передать `costs` в `DAWN_LIONWING_EXECUTION.reserveCost`, dice policy — в dice
foundation, а geometry plan — в `DAWN_LIONWING_GEOMETRY.revalidatePlan`. После
повторной проверки он применяет `phases.before → replace → apply → after`, пишет
существующие `action.resolve`/`attack.pending` и журналирует `rootActionId`,
`actionInstanceId`, `causeEventId`, расходы и `consumedModifierIds`.

UI может использовать `checkConflicts` для выбора замены, `quoteStatus` для
предпросмотра по каждой цели, `amend` для явных окон выбора и `explain` для
карточки/журнала. События `action.plan.open`, `targets`, `modifiers`, `preview`,
`commit`, `cancel`, `invalidate` должны стать тонкими оболочками этого API после
отдельного ревью прав и сетевой идемпотентности.

## Проверка

Автономный тест запускается напрямую:

```text
cd apps/companion
node tests/lionwing-action-plan-foundation.mjs
```

Проверены два одноимённых действия в одном root, независимые definition/instance
ID, снимки и четыре фазы, две конфликтующие замены формы, расходуемый модификатор,
forged totals, запрет позднего retarget без окна, отмена до commit, исчезновение
цели, JSON reload, explain и повтор подтверждения.
