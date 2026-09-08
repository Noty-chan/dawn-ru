# LionWing — результат блока Luna: Ходы и сроки

Дата: 2026-09-08

## Что добавлено

- Для каждого участника нормализуются `turns`, `turnCount`, `turnsStarted`,
  `ownTurnSerial`, `ownerTurnSerial` и `turnSerial`. Номер увеличивается только
  при настоящем `turn-start`; старые сохранения получают значение из прежнего
  поля и доступного журнала.
- Открытый Ход хранит сериализуемый кадр с `activeTurnInstanceId`,
  `turnInstanceId`, участником, его собственным сериалом, ключом
  `ownerTurnKey` и видом `normal`/`extra`. Пауза и возобновление сохраняют тот же
  кадр и не запускают повторный сброс. Дополнительный Ход получает новый ID и
  увеличивает только собственный сериал участника.
- Факты получили `actionDefinitionId`, `actionInstanceId`,
  `ownerTurnActorId`, `ownerTurnSerial`, `ownerTurnInstanceId` и
  `ownerTurnKey`. `ownerTurn` выбирает собственный ключ участника, а `anyTurn`
  — конкретный глобальный экземпляр текущего Хода. Старые факты используют
  прежние поля как fallback.
- В execution добавлены JSON-дескрипторы `startNextOwnerTurn` и
  `endNextOwnerTurn`, нормализация алиасов и строгий общий запрос
  `lifetimeExpired`. Чужой Ход не поглощает такой интервал; поздний запрос после
  пересечения границы остаётся истинным.
- Эффекты и счётчики сохраняют дескриптор срока. Источник Эффекта истекает на
  нужной границе собственного Хода; descriptor-backed счётчик сбрасывается там
  же и перевооружается для следующего собственного Хода.
- События, автором которых является Сцена, сохраняют `actorId: null`,
  `subjectKind: "scene"` и остаются доступными в истории по цели.
- Нормализация `sceneCore` сохраняет новые поля акторов, источников Эффектов,
  дескрипторов сроков и счётчиков при JSON reload/undo.

## Изменённые файлы

- `apps/companion/lionwing-execution.js`
- `apps/companion/lionwing-engine.js`
- `apps/companion/app-core.js`
- `apps/companion/tests/lionwing-turn-lifetimes.mjs`
- `apps/companion/package.json`

Изменения в `app-core.js` нужны для миграции/нормализации сохранений. В
`lionwing-engine.js`, `lionwing-geometry.js`, `lionwing-ui.js`, тестах geometry и
тестах aura есть параллельная работа других агентов; geometry/UI/aura код этого
блока не переписывался.

## Проверка

Пройдены:

- `node --check lionwing-execution.js`
- `node --check lionwing-engine.js`
- `node --check app-core.js`
- `node tests/lionwing-turn-lifetimes.mjs`
- `node tests/lionwing-foundations.mjs`
- `node tests/lionwing-engine.mjs`
- `node tests/lionwing-replacements.mjs`
- `node tests/lionwing-effects-persistence.mjs`
- `node tests/lionwing-counters.mjs`
- `npm test`

Коммит и push для этого блока не выполнялись.
