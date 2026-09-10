# LionWing combat meter: gap audit

Дата: 2026-09-10. Объём: общий боевой счётчик Напряжения и повторно используемый контракт для typed counters.

## Что уже было

- `actor.ruleResources` и `actor.ruleClocks` уже хранят `ownerActorId`, `sourceActorId`/`sourceEntityId`, `ruleId`, `scope`, `lifetime`, `min`, `max`, `initial` и `current`.
- Engine валидирует bounds атомарно, записывает `rule-*` events, threshold crossings и общие event receipts; reload сохраняет эти записи.
- `sessionClocks` дают отдельный scene-owned путь для ручных часов.

## Разрыв

- Напряжение жило в `scene.tension` как число. Его меняли команды, конец Раунда, KO и составные Health Gates разными прямыми присваиваниями.
- У этих изменений не было единого owner/source/scope/lifetime/min/max описания и отдельного receipt на typed meter; consumers читали scalar projection.
- Поэтому Техники могли читать Напряжение, но не имели одного проверяемого контракта для quote, атомарного изменения и реактивного event.

## Реализация

`lionwing-combat-meter.js` вводит versioned `scene.lionwing.meters.tension` с обязательными owner/source, `scope: scene`, `lifetime: scene`, `min: 0`, `max: 999`, `initial/current`, revision и bounded receipts. `scene.tension` остаётся compatibility projection из typed meter.

Только `lionwing-engine.js` вызывает `apply`: `tension`, KO, round end, compound gate и scene reset используют один writer. Он сначала валидирует итог, затем изменяет meter атомарно, добавляет receipt и публикует `combat-meter.change`; crossing threshold публикуется как существующий `counter.threshold`. Повторный receipt не меняет состояние. `read` и `quote` работают по копии и не пишут в Scene.

Потребители получают `LionwingEngine.combatMeter.read/quote` и typed change rows. Общие actor resources/clocks остаются действующими; новый слой не создаёт второй формат для них.

## Границы и ручной остаток

Семантика конкретной Техники (когда повышать/понижать Напряжение, какие пороги и выборы открывать) остаётся в её adapter/ручном решении. Derived UI values не являются доказательством. E2E и сетевую авторизацию этим фундаментом не заявляем; проверяются reducer contract tests и существующие targeted/full npm tests.
