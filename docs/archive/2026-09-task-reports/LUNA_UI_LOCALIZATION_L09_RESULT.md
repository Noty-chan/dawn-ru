# L09 — результат локализации LionWing UI

**Статус: verified.** Это read-only каталог и display projection: настоящий
браузерный путь загружает модуль, строит RU-проекцию и показывает результат в
справочнике/билдере. Сохранение Scene, сетевой writer и replay к этому блоку не
относятся; они явно отмечены как `not-run` ниже.

## База и область

- Запрошенная база worktree: `252cf9263a2defc65381bfde2bb6932290afef5d` (`252cf92`). После создания ветки `origin/main` продвинулся до `440eaad`; rebase не выполнялся.
- Ветка: `codex/luna-l09-ui-localization`; main не изменялся, push не выполнялся.
- Прочитаны `EDITION-BOUNDARIES.md`, L09 в `LIONWING_LUNA_TASKS_2026-09-20.md`,
  обе wave review и acceptance gate `440eaad` (`LIONWING_INTEGRATION_ACCEPTANCE_GATE.md`).
- Legacy 0.9, edition data, generated maps/docs, supplements, scene/network,
  `lionwing-ui.js`, `hero-ui.js` и `app-core.js` не изменялись.

## Фактические места отображения

До изменения были проверены исполняемые места, а не только строки исходника:

1. `hero-ui.js` получает подписи фильтра и карточек Техник из RU-ключей
   `builder.techniques.status*`; поверхность `lionwing-technique-surface.js`
   получает `lionwing.technique.automation.*`.
2. `app-bootstrap.js` строит RU-проекцию `activeCoreRules()` из
   `edition-lionwing.js` и `edition-lionwing-ru.js`; `play-ui.js` затем проходит
   production path `referenceItems()` → `renderReference()` и отображает роль
   NPC как `NPC · ${npc.role}`. RU overlay раньше оставлял в `role` значения
   `DPS`, `Tank`, `Support`, `Engine`.
3. Поиск `renderReference()` включает `item.en`; это сохранённый канонический
   английский алиас, поэтому display mapping не меняет ID, enum или поиск.

## Замены

В `locale-ru.js` технические подписи заменены на пользовательские:

| Было | Стало |
| --- | --- |
| `Ручной режим` | `Вручную` |
| `Авто частично` | `Частично готово` |
| `Автоматически` | `Полностью готово` |
| `Автоматизация выключена` | `Выключено` |
| `Автоматизация` | `Готовность` |
| `Автоматизировано полностью` | `Полностью готово` |
| `Автоматизировано с выбором` | `Нужен выбор` |
| `Частично автоматизировано` | `Частично готово` |
| `Вручную / не поддерживается` | `Вручную` |

Изменены также короткие подписи и подсказки, чтобы они описывали состояние
правила и ручной шаг, а не внутреннюю автоматизацию.

Добавлен узкий `lionwing-display-mapping.js`, подключённый в `index.html` и
service-worker cache. Для RU-проекции он отображает `DPS → Дамагер`,
`Tank → Танк`, `Support → Поддержка`, `Engine → Движок`; канонические роли и
английские search aliases остаются неизменными. В тестовый loader добавлен тот
же production-модуль. Изменение старого ожидания `Авто частично` в targeted
тесте отражает новый display mapping.

## Проверка

Targeted checks:

- `node tests/lionwing-ui-localization-l09.mjs` — PASS: стабильные canonical
  NPC IDs/statistics/enums, RU/EN search, production `referenceItems()` /
  `renderReference()` path и отсутствие английских role labels в RU output.
- `node tests/lionwing-technique-surface.mjs` — PASS.
- `node tests/lionwing-technique-status-ui.mjs` — PASS.
- `node tests/qa.mjs` — PASS.
- `npm test` — PASS (полный набор) на коммите `ab70889ed96abc001f87aee486de7537a46890e7`; финальный
  коммит после обновления отчёта сообщён в handoff вместе с этим отчётом.

### Acceptance gate

- **status: verified** — production entry `apps/companion/index.html` загружает
  `localization.js`, RU/EN catalogs, LionWing editions и
  `lionwing-display-mapping.js`; затем штатные `app-bootstrap.js` и `play-ui.js`
  вызывают проверенный render path.
- **Единственный writer:** display mapping один раз заполняет производный RU
  overlay `coreRules.npcs.entries[id].role/en`; он не меняет canonical data,
  Scene, version, undo, journal или persistence.
- **Зависимости:** реальные RU/EN catalogs, canonical LionWing edition,
  `activeCoreRules`, `referenceItems`, `renderReference` и browser DOM. Unit
  test подменяет только DOM-примитивы; production contract не заменён mock-ом.
- **Save/network:** к этому read-only display projection применимы только
  загрузка каталога и locale preference; Scene save, backup/export, network
  sanitizer и stale-version writer отсутствуют, поэтому их проверка — `not-run`
  как неприменимая для L09.
- **Браузер:** Chrome через CUA на
  `http://127.0.0.1:8877/apps/companion/index.html` с RU LionWing. Проверены
  пустой справочник, заполненный поиск `DPS` (карточки `NPC · Дамагер`, без
  `NPC · DPS`), заполненный поиск `Дамагер`, RU builder с фильтром
  `Готовность` и статусами `Полностью готово / Нужен выбор / Частично готово /
  Вручную`; затем EN `DPS` сохранил карточки `NPC · DPS`. Снимки справочника и
  профиля сделаны в браузере; console errors/warnings отсутствуют.
- Regex исходника не использовался как единственное доказательство: вывод
  production DOM/AX и браузерные снимки проверены отдельно.

## Честный остаток Gifts

RU overlay содержит 58 Gift entries; 7 текстов всё ещё содержат латинский
канонический термин `NPC`: `rebel.leave-this-to-me`,
`loyalist.my-master-s-teachings`, `loyalist.secret-technique`,
`beacon.friendly-and-approachable`,
`mentor.a-power-that-must-never-be-used-again`,
`blessed.a-web-of-connections`, `blessed.beck-and-call`. Это остаток
source-reviewed очереди и каноническая аббревиатура, а не role/status display
mapping; полный EN Gifts/Techniques каталог намеренно остаётся английским в EN
preview. Произвольный массовый перевод канонического текста в L09 не выполнялся.

`not-run`: network/live-room сценарий, Scene commit/reload/replay/stale-version,
hero backup/export и legacy 0.9 — они не являются зависимостями этого
display-only блока или явно исключены границами L09. Shell Playwright не был
использован из-за отсутствия WSL2 virtualization; требуемая браузерная проверка
выполнена реальным Chrome через CUA.
