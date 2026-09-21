# LionWing: приёмка третьей волны и повторный аудит фундамента

Дата: 2026-09-21. База до сведения: `440eaad`. Этот отчёт применяет
`LIONWING_INTEGRATION_ACCEPTANCE_GATE.md`; зелёный тест агента сам по себе не
считался доказательством production-пути.

## Результат L07–L09

### L07 — единое удаление: verified локально, blocked для живой сети

- Production entry points: кнопки участника, массовки, пространства, backing и
  режим ластика вызывают `commitLionwingDestroy`.
- Единственный writer: `commitScene`. План запускается с
  `recordHistory:false` и `advanceVersion:false`; итог получает ровно одну
  запись undo и `version + 1`.
- Тест `lionwing-destroy-wiring.mjs` извлекает настоящий `validateTableEdit` и
  настоящий `commitScene`. Он не заменяет их always-success mock.
- Проверены cancel, stale, отсутствующая цель, защищённые связи, Compound,
  заполненное поле, большая footprint, postcondition адаптера, reload/replay и
  отсутствие transient `before` в сериализованном плане.
- Агент провёл браузерный сценарий confirm/cancel/undo/reload/redo и проверил
  localStorage. Повторный интеграторский браузерный smoke подтвердил загрузку
  Стола без console errors.
- Не доказаны Supabase и два настоящих клиента. До такой проверки сетевой статус
  удаления остаётся **blocked**; локальный путь считается **verified**.

### L08 — игровой лист и ручное разрешение: connected

- Лист показывает предупреждение незавершённой сборки, Дары, Связи, базовые
  действия, полный текст изученных Уровней, понятный ручной остаток и переход на
  Стол. Просмотр сам ничего не списывает.
- Read-only история последствий берётся из связанного участника Стола или из
  bounded export bridge; боевые очереди в экспорт не попадают.
- Интегратор добавил production-normalizer `normalizeHeroLionwingBridge`.
  Consequences и legacy notes теперь переживают hero save/reload и export/import,
  неизвестные поля и очереди отбрасываются. Новый тест делает реальный
  persist/reload normalization round trip.
- Браузерный прогон агента был на заполненном листе; повторный smoke интегратора
  подтвердил незавершённый лист и переход на Стол без ошибок.
- Автоматическое слияние импортированной истории в уже существующего участника
  Стола не реализовано: оно требует явной UX-политики конфликтов по `id`.
  Поэтому весь L08 пока **connected**, а bounded storage/export subpath —
  **verified**.

### L09 — пользовательские подписи: verified

- Канонические IDs, английские role enum и EN preview не меняются. Русская
  проекция получает только display labels и сохраняет английский alias для
  поиска.
- Модуль реально загружается `index.html` и включён в service worker assets.
- Интегратор обнаружил старый dev cache key: первая браузерная проверка продолжала
  показывать старые подписи. Cache revision повышена, а тест обновлён. Новый
  чистый браузерный прогон показал `Готовность` и `Полностью готово` вместо старых
  технических формулировок.
- Production `referenceItems`/`renderReference`, RU/EN поиск, браузер и полный
  набор тестов пройдены. Статус: **verified**.

## Повторная проверка L01–L06

| Блок | Статус | Повторно подтверждено | Честный остаток |
|---|---|---|---|
| L01 последствия Уязвимости | verified | настоящий LionWing reducer, typed loss target, replay/reload, отдельное исправление Нарратора | фактическое изменение Дара/Навыка/Техники остаётся ручным по замыслу |
| L02 объекты Сцены | connected | production projection, persistence, backing inventory, скрытие player projection, UI loading | заполненный player browser и живая сеть не повторялись |
| L03 мобильная компоновка | connected | исходные responsive assertions и прежний smoke пустой Сцены | финальный заполненный 390×844 прогон остаётся обязательным |
| L04 UI последствий | connected | настоящий reducer, конкретные цели, network sanitizer `lossTarget`, reload и коррекция | живой двухклиентный сценарий и конфликт import→actor не проверены |
| L05/L07 destroy plan | verified локально / blocked network | production validator/writer, одна версия/undo, rollback, большие тела, browser local persistence | Supabase и два клиента |
| L06 recovery stress | verified как harness | 280 событий, журнал 200, undo 20, настоящий normalizer/writer, localStorage, fake IndexedDB, backup import/export, failed write | browser IndexedDB quota/crash на опубликованном сайте |

## Фундаментальные границы

1. **Writers/version/undo.** Engine events принадлежат reducer/`commitSceneEvents`;
   структурное единое удаление принадлежит `commitScene`. Destroy-plan больше не
   пишет version/undo при production-вызове. Ошибка оставляет исходную Scene
   неизменной.
2. **`validateTableEdit`.** Обычные прямые игровые изменения LionWing по-прежнему
   отклоняются. Planned destroy разрешён только из подготовленного production
   пути и валидируется парой before/after.
3. **Network sanitizer.** Typed `choice.lossTarget` сохраняется и проходит к
   authoritative prepare. Это подтверждено production sanitizer test, но не
   заменяет живую проверку двух браузеров.
4. **Storage/export.** Table backup, Scene reload, bounded hero bridge и recovery
   harness пройдены отдельно. Экспорт героя не содержит choices, paused chains и
   прочее боевое runtime-состояние.
5. **Projection.** Entity projection fail-closed и скрытые backing проверены
   production API. Нужен повторный заполненный player browser.
6. **Browser entry points.** На текущем `main` реально открыты Builder, Sheet и
   Table; console errors/warnings отсутствуют. Во время проверки найден и
   исправлен stale service-worker cache key.

## Что делать следующей волне

Приоритетом остаётся не расширение числа адаптеров, а закрытие пользовательских
швов:

1. живой Narrator + player сценарий через Supabase: Атака → Реакция → урон →
   Рана/Сопротивление → consequence target → reload;
2. то же для удаления участника, пространства и backing с cancel/undo/reload;
3. заполненный мобильный прогон 390×844 для Стола и игрового листа;
4. реальный browser IndexedDB recovery и table backup restore;
5. политика merge импортированных hero consequences в связанного table actor;
6. после этого — адаптеры семейств поверх уже проверенных ActionPlan, dice,
   effects, counters, geometry, entities и lifecycle contracts.

Не повышать blocked/connected до verified по regex, innerHTML snapshot или mock
writer. Для сетевого блока обязательны два клиента и наблюдаемое сохранение после
перезагрузки.

## Выполненные проверки

- targeted: consequences, consequence UI, scene objects, entity persistence,
  entity removal, destroy plan/wiring, recovery stress, network v2, hero sheet,
  hero bridge и UI localization;
- полный `npm test` после сведения L07–L09 — PASS;
- реальный Playwright smoke: Builder → Sheet → Table, 0 console errors/warnings;
- чистый браузер после cache revision показывает новые русские display labels;
- `git diff --check` — PASS.

