# L05: typed destroy plan

Дата: 2026-09-21. База: `d7e24a1565806e074189a640fce9c2229b05cf94` (`origin/main`).
Ветка: `codex/luna-l05-destroy-plan`. Один содержательный локальный commit;
финальный SHA этой ветки передан интегратору после проверки командой `git rev-parse HEAD`.

## Результат

Добавлен самостоятельный модуль [`apps/companion/lionwing-destroy-plan.js`](../../apps/companion/lionwing-destroy-plan.js), который устанавливает read-only API `DAWN_LIONWING_DESTROY_PLAN`. Он не подключает обработчики, не меняет живую `Scene` во время подготовки и не редактирует `lionwing-entities.js`.

В модуле зафиксирована явная таблица actor / registry row / backing / space. `planDestroy` принимает типизированную цель (`actor`, `space`, `entity`/`registry-row` или `backing`) и возвращает снимок, операции, переносы, инвалидируемые ссылки, registry/source-loss результат и конкретные cleanup descriptors. Сканируются только перечисленные поля и пути; похожая строка в неизвестном поле не считается ссылкой.

Применение работает на копии Сцены и проверяет `expectedVersion` и fingerprint исходного снимка. Защищённая или неразрешимая зависимость отклоняет весь план до выдачи результата. `cancel` не применяет план. `apply` повторно вызывает публичные `Entities.prepareDestroy/destroy/sourceLoss` на изолированной копии registry, сохраняет source-loss policy `disable`/`remove`/`detach`, инвалидирует только затронутые pending-пути, удаляет typed backing, переносит Compound целиком и добавляет полный undo snapshot. При наличии адаптеров используются `validateTableEdit`, `placeActorsSafely`, `removeManagedSceneSpace` и `DAWN_LIONWING_ENGINE` (`space.remove`/допустимый `actor.despawn`); иначе применяются копии тех же структурных действий без UI writer.

Собственный тест [`apps/companion/tests/lionwing-destroy-plan.mjs`](../../apps/companion/tests/lionwing-destroy-plan.mjs) покрывает owner/target во время pending, unrelated actor, заполненное поле, несколько пространств, Compound, cancel/no mutation, typed lookalike field, source-loss policies, actor runtime, protected rollback, stale plan, JSON reload, replay/idempotency, undo и engine operation.

## Проверки

- `node tests/lionwing-destroy-plan.mjs` — passed.
- `node --check lionwing-destroy-plan.js` и `node --check tests/lionwing-destroy-plan.mjs` — passed.
- `git diff --check` — passed.
- `npm test` — passed. Legacy Raasha exact-sheet fixture ожидаемо skipped без `DAWN_RAASHA_FIXTURE`; shared assertions passed.

## Остаток

L05 оставляет модуль вне браузерного loader/UI по условиям задачи. Подключение единого writer в `app-core.js`, `app-scene-events.js` и `scene-ui.js`, а также обновление loader/service worker относятся к последовательному L07. Для этого подключения нужно передать в модуль безопасные pure adapters уже существующих `placeActorsSafely` и `removeManagedSceneSpace`; L05 не вызывает UI-функцию с живым глобальным `Scene`.
