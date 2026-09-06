# LionWing: контракты оставшихся семейств

Снимок для `codex/lionwing-rules-kernel`, HEAD `cbab4ea`, 2026-09-06. Охват —
только `geometry/effects/actions/turns/entities` из `lionwing-rule-families.json`.
66 вручную разобранных Уровней — источник проверочных потребителей, не основание
классифицировать остальные 267. Общие требования к реализации, UI, сети и приёмке
не повторяются здесь: [LIONWING_FAMILY_AGENT_PLAYBOOK.md](LIONWING_FAMILY_AGENT_PLAYBOOK.md).

Другой исполнитель сейчас владеет runtime для execution/history/costs/health/dice.
Этот следующий блок ожидает его контрактов и не меняет runtime до передачи.
План и выбор всегда JSON; авторитетная сторона повторно проверяет версию и намерение.

## Что реально есть на текущем HEAD

| Нужда | Владелец и пригодные API/данные | Точная граница |
| --- | --- | --- |
| Команда LionWing | `DAWN_LIONWING_ENGINE`: `command`, `prepare`, `dispatchMany`, `previewEvents`, `movement`, `actionStatus`, `turnStartStatus`, `roundEndStatus`, `roll`, `canSpend`, `targetIds` | `command` принадлежит только этому объекту. После установки LionWing общий `DAWN_SCENE_ENGINE.dispatch/dispatchMany/previewEvents` маршрутизируются в эти же LionWing-функции. |
| Общие read-only запросы | `DAWN_SCENE_ENGINE`: `actorIdsInCells`, `actorIdsInRange`, `targetStatus`, `spatialShapeStatus`, `effectCellOccupancyStatus`, `movementPath`, `displacementStatus`, `topologyStatus`, `effect*Status`, `attackModifierStatus` | Это старые общие запросы, а не новые LionWing-команды; применять после проверки изоляции редакции. |
| Выбор последствия | `DAWN_LIONWING_EXECUTION.open/choose/plan`; `scene.lionwing.choices`, `deferred`, `pausedChains` | `pausedChains` сохраняет только цепочку последствий, не активный Ход. |
| Поле/топология | `actor.move`, `actor.spawn/despawn`, `area.*`, `marker.*`, `wall.*`, `topology.cells.*`; `removedCellKeys(scene, spaceId)` — канонический query | Не проектировать собственное `removedCells`: сейчас cuts материализуются в `scene.topology.cuts`, но новый код обращается через query и типизированные события. |
| Маркеры/области | Общий редьюсер уже хранит `id`, `ownerActorId`, `source`, `ruleId`, `duration`, `metadata`; `marker.remove` возвращает owner/связь carrier в payload | Недостаёт не базовое владение маркером, а единая связь между backing-объектами, пилотом и lifecycle. |

Текущий `LionwingEngine.movement` уже строит полный сегментный `path`, учитывает
стены/местность и `move` предлагает Наказание по пройденным сегментам. Шаг хранит
`stepRemaining`. Пробел — нет сохраняемого намерения частичного пути/остановки,
геометрического якоря и общей пакетной проверки многоклеточного тела.

`actor.effects/effectStates` и `effectLifetimes` уже хранят срок. Для Испуган,
Спровоцирован и Пойман LionWing сохраняет несколько источников; для остальных
повторное наложение заменяет state. Нет обобщённых source-instance, suppression,
ambient aura и публичной команды `removable:false`.

`lionwing-ui.js` уже даёт `lwSubmit` (`prepare` → `commitSceneEvents`), выбор
одной клетки, сохранённые choices, preview и ручной пакет. Это каркас, а не
полный UI нижеследующих семейств.

## Geometry

**Потребители из реестра:** Dragonslayer II (2×2), Intimidator II (сегменты и
вытеснение), Assassin II (появление), Will-o-Wisp I–II (клетка маркера), Mecha
Pilot I (2×2), Zealot III (линии/topology).

**Переиспользовать:** `LionwingEngine.movement` для готового пути; общие
`spatialShapeStatus`, `actorIdsInCells`, `effectCellOccupancyStatus`,
`displacementStatus`, `topologyStatus`, `removedCellKeys` для формы, целей и
занятости. Последний уже учитывает `occupiedWidth/occupiedHeight`.

**Пробел и минимальный контракт:** добавить чистый `geometryStatus(scene, request)`
и сериализуемый `geometry.plan` внутри action context: `anchor` (`actor|marker|
entity|cell`, снимок space/x/y), `route` (segments, spent, `stoppedAt`, `remaining`,
reason, `move|forced|placement|teleport`), `footprint` и детерминированный список
равных клеток. События `geometry.plan`, `geometry.route.commit`,
`geometry.displace.commit`, `geometry.topology.change` переводят итог в имеющиеся
`actor.move`/`topology.cells.*` и несут `rootActionId/causeEventId`. Placement не
создаёт маршрут и не запускает триггеры движения.

**Граница:** положение остаётся в actors, маркер/область — в общих коллекциях,
топология — за `removedCellKeys`; geometry не списывает ресурс и не решает Эффекты.
KO якоря, conflict version или смена topology инвалидируют незафиксированный план.

**UI:** выбрать якорь → подсветить форму/допустимые клетки и маршрут → явно выбрать
равный вариант → preview/confirm/cancel. После commit маршрут доступен и в журнале;
placement помечен отдельно без следа.

**Приёмка:** `mid-path-stop` (план Intimidator II сохраняет законную остановку и
остаток); `anchor-not-actor` (атака Will-o-Wisp от маркера при герое-инициаторе);
`two-by-two-occupancy` (мех не фиксируется частично); `topology-reload` (Zealot III
после reload использует те же удалённые клетки).

## Effects

**Потребители:** Reaper II (Помечен от источника), Mindbreaker I–III (Изгнание),
Chronomancer II (повтор), Last Hope I/Zealot II (срок), Will-o-Wisp I/III (аура).
Cornered Dog и Flagellant I остаются только текущими проверками execution.

**Переиспользовать:** `kind:"effect"`, `effect.apply/remove`, `effectStates`,
`effectLifetimes`; общий `effectStatus`, `effectPresence/Targeting/Movement/
Attack/DefenseStatus`. Не заменять существующие source-списки трёх базовых Эффектов.

**Пробел и минимальный контракт:** `effectInstanceStatus(scene, actorId, effect)`
с расширяемым `sources[]`: `sourceId`, actor/entity ID, origin action/event,
applied serial, duration, boundary owner, `removable`, `sourceBound`; плюс
`suppressedBy[]` и derived `activeSources`. Ambient вычисляется по источнику и
geometry, не копируется в `actor.effects`. Добавить `effect.source.apply/remove`,
`effect.suppress/restore/expire`; старые apply/remove остаются фасадом одного
источника. Прямой ID удаляется только когда активных источников не осталось.

**Граница:** execution решает before/replace/after; history — лимит; effects
только фиксирует источник/срок. KO или уничтожение entity посылает source.remove,
не правит чужие effects напрямую. Неснимаемость — свойство источника с причиной
отказа, а не бесконечное повторное наложение.

**UI:** в строке Эффекта показать источники, срок, suppression и конкретную
доступную операцию снятия; aura на поле рисуется отдельно от прямого Эффекта.

**Приёмка:** `aura-enter-exit`; `source-ko` (второй источник Страха остаётся);
`suppression-vs-removal`; `unremovable-effect` (ручное снятие отказано, expiry
разрешён).

## Actions

**Потребители:** Assassin II (появление/крит), Dragonslayer II–III, Spellsword
I–III, Dual-Wielder I–III, Spellcrafter I–III, Cryomancer III.

**Переиспользовать:** `actionStatus`, `actionDef`, `prepare({kind:"action"})`,
`scene.pendingAction`, `attack.pending`, `reaction`, `resolve-attack`,
`amend-attack`, `allow-action`, `usage`, `record-action`; общий
`attackModifierStatus` уже выводит options, `exclusiveGroup`, transform и
destination для имеющихся правил.

**Пробел и минимальный контракт:** нынешний `prepare` бросает/платит в одном
пути, а `pendingAction` существует только после Атаки. Нужен один `actionPlan`:
`draft → targeting → modifiers → previewed → committed|cancelled|invalid`, с
root/action ID, снимком цены/атрибута/dice policy, geometry anchor/targets,
модификаторами (`sourceId`, `exclusiveGroup`, `consumedByActionId`) и
`outcomes[targetId]`. События `action.plan.open/targets/modifiers/preview/commit/
cancel/invalidate`; commit повторно валидирует и атомарно создаёт существующие
`action.resolve`/`attack.pending`. Конфликт replacements — сохранённый choice,
не регистрационный порядок; cancel до commit не платит.

**Граница/UI:** costs и dice владеют платой/гранями, geometry — клетками,
execution — choices; actions связывает их. Экран: форма → цели/клетка →
цена/пул/per-target preview → confirm; поздняя смена цели открывает отдельное
окно и инвалидирует preview.

**Приёмка:** `two-shape-modifiers`; `cancel-before-payment`; `per-target-outcome`;
`late-retargeting-ruling`.

## Turns

**Потребители:** Last Hope I–III, Mecha Pilot II–III, Zealot II, Chronomancer III;
реестр также требует окно действий после Раны, но его бюджет неоднозначен и не
является первым адаптером.

**Переиспользовать:** `turnStartStatus/roundEndStatus`, `turn-start/end/round-end`,
`turnSerial`, `activeActorId`, `ap`, `stepRemaining`, `grantedTurns`,
`allow-action`, `pause-chain`. `grant-turn` — лишь очередь `{actorId,sourceActorId}`.

**Пробел и минимальный контракт:** различить `reaction`, `outside-turn action` и
`full additional turn`. `turnWindowStatus` и `turn.interrupt` хранят allowance
(mode/action/cost/limit/source/scope) и LIFO `turnFrame` (active actor, serial,
AP, step remainder, turn actions/history, order/queued IDs). `full-turn` один
раз запускает start/end; `resume` восстанавливает frame без startTurn/reset.
События: `turn.allow`, `turn.interrupt.open/action/resume/cancel`,
`turn.grant.full`; KO/устаревшее состояние отменяют окно с причиной.

**Граница/UI:** turns владеет временем и frame, не копирует pendingAction или
платёж. Карточка окна показывает тип, сторону, бюджет и отказ; поле показывает
стек возврата, а KO — журнальную отмену.

**Приёмка:** `interrupt-enemy`; `wait-for-ally`; `resume-without-reset`;
`ko-during-interrupt`. Первый тонкий тест — обезличенное окно вне Хода с
ограниченным бюджетом ОД, пока канон конкретного уровня не уточнён.

## Entities

**Потребители:** Will-o-Wisp I–III (два Пламени), Mecha Pilot I–III (мех/пилот),
Intimidator III (Массовка), Zealot III (поле).

**Переиспользовать:** backing-события `actor.spawn/despawn`, `marker.*`, `area.*`,
`wall.*`, а также уже сохранённые owner/source/rule/duration/metadata. LionWing
`projectScene` уже скрывает ссылки на hidden actors; расширять его тем же правилом.

**Пробел и минимальный контракт:** не создавать второй объект маркера. Добавить
индекс `scene.lionwing.entities[id]` для кросс-связей:
`{id, kind, backing, ownerActorId, sourceActionId, createdEventId, visibility,
lifecycle, links}`. `backing` ссылается на существующий actor/marker/area/wall;
`links` явно выражают pilot/carrier/anchor/movement и не объединяют ЗД, ОД или
Ходы. События `entity.create/transform/link/unlink/owner.change/destroy/cleanup`
в одном пакете вызывают backing-событие. `entityStatus` проверяет владельца,
живость backing и visibility; проекция фильтрует entity до её ссылок.

**Граница/UI:** geometry даёт место, effects — aura, turns — самостоятельный Ход;
entities координирует связь/lifecycle. Карточка показывает owner, backing, срок и
links; создание использует preview клетки, enter/exit пилота показывает, чьи
ресурсы и чей Ход; скрытый entity не виден игроку.

**Приёмка:** `two-independent-markers`; `pilot-enter-exit`; `linked-movement`;
`hidden-entity-projection`.

## Порядок

1. Принять базовый блок execution/history/costs/health/dice и его provenance.
2. Geometry + Effects (блок 2 playbook); один route- и один aura-потребитель.
3. Actions + Turns (блок 3); один action plan и обезличенное внеходовое окно.
4. Entities (блок 4); два независимых маркера, затем пилотирование.
5. На каждом блоке — сценарии выше плюс requirements playbook; наличие API не
   повышает автоматизацию Уровня без отдельной проверки его текста.
