# R10 · восстановление LionWing в браузере и копия стола

Дата: 2026-09-21. База: `3eb87c69adbb785c1fbee95c2cfc8366db99e73f`.
Статус: **connected**. Storage, normalizer и production writer проверены; точный
браузерный сценарий «точка → изменение → восстановление → reload» ещё не даёт
оснований повысить весь блок до verified.

## Что проверено и исправлено

До исправления запись новой точки в IndexedDB могла завершиться ошибкой и
перейти в `localStorage`, но последующее чтение сначала успешно читало старую
точку из IndexedDB. Поэтому новый checkpoint скрывался старым. В
`apps/companion/app-core.js` `readHeroMedia` теперь для ключа восстановления
сравнивает `exportedAt` и выбирает более новую запись из IndexedDB или
`localStorage`. Кандидаты сначала проходят production `normalizedTableBackup`,
повреждённая более новая запись отбрасывается, а при равной дате предпочтение
получает fallback. Если обе записи не читаются и новая запись не была принята,
предыдущая рабочая точка сохраняется.

Там же `blankScene` теперь безопасно нормализует текущую
`contentPreferences.edition`: свежая Сцена LionWing получает
`rulesEdition: "lionwing"`, а явный `blankScene("ru-v0.9")` по-прежнему создаёт
legacy-сцену. Изменение не затрагивает UI и сохраняет старые сохранения через
`sceneCore`/`normalizeScene`.

После Destroyer-ревью `migrateLegacy` явно создаёт героя и Сцену `ru-v0.9`:
активная вкладка LionWing больше не перекрашивает старый `dawn-heroes` при
миграции. Fallback также обновляет metadata даты точки восстановления.

Новый focused test
`apps/companion/tests/lionwing-recovery-r10.mjs` сначала воспроизводит старую
ошибку с устаревшей IndexedDB-записью, затем проверяет production writer и
reader, включая:

- свежую LionWing-Сцену и явную legacy-Сцену;
- IndexedDB checkpoint, отказ IndexedDB с переходом в `localStorage` и выбор
  нового fallback;
- отказ обеих записей без потери предыдущего checkpoint;
- экспорт/импорт pending Resistance (`lionwing.choices`, `kind: "knockout"`);
- ограничение журнала 200 строк и `undo` 20 снимками в существующем stress
  harness;
- отказ повреждённого JSON и ограничение oversized input до 12 пространств и
  120 участников.

## Production entry points

- [`apps/companion/app-core.js`](../../apps/companion/app-core.js):
  `blankScene` (стр. 47), `sceneCore`/`normalizeScene`,
  `tableBackupPayload` (стр. 344), `normalizedTableBackup` (стр. 345),
  `writeHeroMedia`, `readHeroMedia` (стр. 454) и `persist`.
- `apps/companion/app-scene-events.js` использует
  `saveTableRecovery`, `readTableRecovery` и `applyTableBackup` (стр. 276–280);
  в R10 исправлены fallback metadata, валидация чтения и статус свежей точки.
- `apps/companion/scene-ui.js` содержит существующий общий writer
  `commitScene` и границы журнала/undo; в R10 не изменялся.

## Browser evidence

Проверен настоящий Chrome на локальном `http://127.0.0.1:8765` во свежей
вкладке LionWing с реальными IndexedDB и `localStorage` production path:

- после загрузки `dev.logs({levels: ["error", "warn"]})` вернул `[]`;
- «Запомнить точку восстановления» показал статус с новой датой точки;
- UI-экспорт показал статус «Резервная копия стола скачана»;
- reload сохранил заполненное поле и ожидающую цепочку действия;
- после восстановления в exploratory-сцене состояние checkpoint оказалось уже
  заполнено теми же токенами, поэтому точный UI-сценарий «изменить после точки →
  восстановить и удалить изменение» не засчитан как отдельное browser proof.

Обычный browser save/reload и UI-экспорт выполнены через настоящие storage
helpers. Искусственные отказы quota/transaction проверены только в focused
тесте, чтобы детерминированно покрыть невозможный обычным UI сценарий.

## Проверки

Успешно:

```text
node apps/companion/tests/lionwing-recovery-r10.mjs
node apps/companion/tests/lionwing-recovery-stress.mjs
node apps/companion/tests/lionwing-entities-persistence.mjs
node apps/companion/tests/lionwing-counters.mjs
node apps/companion/tests/lionwing-engine.mjs
node apps/companion/tests/lionwing-auras.mjs
node apps/companion/tests/qa.mjs
node --check apps/companion/app-core.js
node --check apps/companion/tests/lionwing-recovery-r10.mjs
npm test                         (из apps/companion)
git diff --check
```

R10 и существующий L06 stress test завершились успешно. `npm test` завершился
с кодом 0; карты, syntax QA, LionWing engine, network, localization, scene,
technique, hero и catalog QA также прошли.

## Mocks и остаток

`MemoryStorage` и `FakeIndexedDB` находятся только в focused test и нужны для
искусственных quota/transaction failures. Они не подменяют production
normalizer, backup serializer или storage helpers. Реальный browser evidence
получен отдельно на Chrome с настоящими IndexedDB и `localStorage`.

Не запускались: искусственное исчерпание quota в браузере, точный UI file
chooser import, точная browser-сцена с pending Resistance (она покрыта
production focused test), Firefox и network/two-client flow. Свежая вкладка для
evidence была чистой; старые exploratory console messages не использовались.

Остаток для следующей волны — точный UI restore после наблюдаемого изменения,
file import и, при необходимости, отдельная browser harness для quota failure.
До этого R10 остаётся connected.
