# LionWing queued prompt contract — 2026-09-13

## Scope

Эта работа закрывает общий lifecycle нескольких одновременных `rule.prompt`
для LionWing. Изменены только `scene-events.js`, `scene-triggers.js`,
`scene-responses.js` и targeted test `tests/lionwing-prompt-queue.mjs`.
Конкретные правила Техник, адаптеры, engine, UI, сеть и generated maps/registry
не менялись.

Перед изменением сверены `LIONWING_LATEST_HANDOFF.md`,
`AUTOMATION-READINESS.md`, `LIONWING-AUTOMATION-MAP.md`, текущий prompt-flow и
canonical EN payload для Powerhouse Technician из
`source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/powerhouse.json`:

- I / Stretch: `After you Charge, you ‘Stretch'. After Stretching, until the end of your next Turn, completing a Combo gives you 1 AP.`
- II / Perfect Form: `After you complete a Combo, you gain [Tier/2] Armor until the start of your next Turn.`
- III / Final Blow: `[ Skirmish → Finisher ]` — `The Finisher costs 1 AP and pushes its target 3 spaces away.`

Эти строки использованы как provenance check; статусы Техник не повышались и
их конкретная семантика не переносилась в общий queue contract.

## Contract

Каждый prompt теперь несёт проверяемые `ownerActorId`, `controller`,
`participantIds`, `sourceEventId`, `sourceEventType`, `sourceSceneVersion`,
`sceneVersion`, `priority`, `tieBreak` и ограниченный `expiresAt`. Источник,
владелец, участники, target и тип исходного события сверяются с текущей Scene и
журналом; клиентский payload не может заменить авторитетное состояние.

В Scene одновременно находится один `pendingPrompt`. Остальные prompt
сохраняются как `rule.trigger` со статусом `queued` и полным deferred event.
Очередь сортируется так:

1. `priority` по убыванию;
2. явный `tieBreak` лексикографически;
3. монотонный `sequence` постановки;
4. `queueKey` как последний детерминированный tie-break.

После `accept`, `pass`, `cancel` или принятого stale/manual fallback ответа
следующий допустимый элемент получает audit `fired` и становится активным.
Недоступный или просроченный элемент получает `cancelled` с причиной; очередь
продолжает обходить его, поэтому один KO или timeout не блокирует остальные
решения.

Ответ принимается только от source/owner prompt и только для объявленного
варианта. Чужой actor, неверный owner/controller/participant set, другой source
event, конфликт `sceneVersion`, повторный response и просроченный обычный ответ
отклоняются уведомлением; для просроченного prompt допускается только явный
stale путь ручного fallback. Новые action/resource/technique/turn mutations
при активном prompt блокируются; проверенная внутренняя резолюция уже
подготовленной action/attack/technique цепочки может завершить её, после чего
очередь снова получает управление.

Persisted event ids и queue keys сохраняют idempotency при replay/reload. Повтор
уже записанного prompt или trigger audit возвращает canonical duplicate и не
добавляет новую запись или элемент очереди.

## Evidence

`tests/lionwing-prompt-queue.mjs` проверяет три одновременных prompt с разными
priority, три равных priority с tie-break, cancel первого и открытие следующего,
чужой participant, обход через resource mutation, owner/source boundary,
просроченный active и queued prompt, reload/replay/idempotency и конфликт
версии ответа.

Проверенные команды:

- `node tests/lionwing-prompt-queue.mjs`
- `node tests/scene-engine.mjs`
- `git diff --check`

Изменение engine или другого агента не потребовалось; downstream adapters/UI
получают queue через существующий `DAWN_SCENE_ENGINE` surface.
