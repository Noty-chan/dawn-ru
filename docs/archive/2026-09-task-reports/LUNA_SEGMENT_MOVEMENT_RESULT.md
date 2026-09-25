# Luna: сегментное движение LionWing

Дата: 2026-09-08

Реализован runtime-блок обычного `geometry-move`. Подтверждённый маршрут теперь
содержит `origin`, `segments` и сериализуемый `cursor`. Каждый сегмент описывает
`from`, `to`, стоимость, terminal-признак, курсор сегмента и четыре границы:
`before-leave`, `leave`, `before-enter`, `enter`.

Исполнение проходит по одному ребру. Для каждого ребра записываются типизированные
строки `geometry.segment.*`, а состояние участника меняется только на текущий
сегмент. После сегмента в deferred-операции сохраняются `segmentIndex`, потраченная
дальность, ожидаемая версия и geometry stamp следующего шага. Собственная смена
версии учитывается как ожидаемая; при продолжении актуальный следующий edge
проверяется заново. Новая Стена, занятая клетка, исчезнувший участник или другой
сдвиг начала сегмента отклоняют продолжение до перемещения.
Проверка продолжения атомарна: отказ не переносит участника и не расходует
часть оставшегося маршрута в исходной Сцене.

Для ручного проверочного сценария поддержаны сериализуемые решения на входе клетки
через `segmentChoices` (также `enterChoices`, `segmentTriggers`, `boundaryChoices`
и `onEnter`). Решение имеет обычный ID выбора и продолжает deferred-хвост ровно
один раз после JSON reload. Ответ `stop` завершает маршрут с `stopReason: decision`;
дубликат уже принятого события обслуживается существующей receipt-идемпотентностью.
Трудная местность сохраняет terminal-причину и обнуляет остаток. Старые планы без
`segments`/`origin` принимаются и нормализуются при revalidate.

Изменённые файлы:

- `apps/companion/lionwing-geometry.js` — сегменты, курсоры, `segmentStatus`,
  совместимая нормализация старых планов.
- `apps/companion/lionwing-engine.js` — очередь `geometry-segment`, граничные
  события, пауза/ответ, повторная проверка и legacy summary `actor.move`.
- `apps/companion/tests/lionwing-segment-movement.mjs` — focused coverage.
- `apps/companion/package.json` — focused тест подключён в `test:families`.

Проверки:

- `node --check lionwing-geometry.js`
- `node --check lionwing-engine.js`
- `node --check lionwing-execution.js`
- `node tests/lionwing-segment-movement.mjs`
- `npm test` в `apps/companion` — пройден полностью.

Ограничения блока: placement и teleport не изменялись; конкретные Техники и UI
решений не добавлялись. `segmentChoices` — общий сериализуемый хук для будущих
адаптеров, а не автоматизация конкретной Техники. `actor.move` summary оставлен
для старых проекций журнала, при этом фактические переходы выполняются отдельными
сегментами и сопровождаются `geometry.segment.*`.
