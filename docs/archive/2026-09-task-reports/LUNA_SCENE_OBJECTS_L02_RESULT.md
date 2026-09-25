# Luna / LionWing L02: игровые объекты Сцены

Дата: 2026-09-21. Работа выполнена в отдельном managed worktree
`lionwing-scene-objects-l02` от `40cdc51`.

## Реализация

В `apps/companion/lionwing-ui.js` панель реестра заменена на read-only инвентарь
объектов текущей Сцены. В одну строку объединяются существующие `actor`,
`marker`, `object`, `area` и `wall`; запись LionWing только присоединяется по
типизированному backing-ссылочному ключу. Здоровье, координаты, клетки,
видимость и прочее состояние остаются в исходной коллекции Сцены, поэтому
рендер не создаёт дублей и не меняет `Scene`.

Карточка показывает имя, вид, владельца, пространство, срок и состояние,
поддерживает поиск и фильтр, а действие «Показать на поле» использует текущий
выбор и инспектор Сцены. Технические ID, `kind` и source находятся только в
раскрываемых «Технических данных». Форма называется «Связать существующий
объект» и явно сообщает, что она не копирует координаты или Здоровье; API и
контракт удаления связи сохранены.

Игрокская проекция сохраняет redaction скрытых backing-объектов. Висячие записи
реестра показаны отдельным блоком «Связи без объекта» с причиной. Empty copy,
одинаковые имена и fallback для owner marker покрыты UI-проверками.

## Проверка

- `node --check apps/companion/lionwing-ui.js` — passed.
- `node apps/companion/tests/lionwing-entities-ui.mjs` — passed.
- `node apps/companion/tests/lionwing-scene-objects-ui.mjs` — passed: пустая
  Сцена, пять массовок, одинаковые имена, owner marker, hidden player
  projection, registry link, JSON reload, field navigation и read-only render.
- `npm test` из `apps/companion` — passed полностью.
- Browser smoke через реальный Playwright browser — passed: режим «Стол»,
  пустая панель объектов, добавление пяти зон массовки через UI, карточки и
  поля, поиск, фильтр «Неактивные» (0 объектов), фильтр участников и
  «Показать на поле» с открытием существующего инспектора.
- Playwright console: 0 errors, 0 warnings.
- `git diff --check` — passed.

## Границы и остаток

В рамках L02 не менялись движок, cleanup/normalize, CSS, `app-core.js`,
`scene-ui.js`, `package.json`, generated docs/maps и legacy 0.9. Визуальные
отступы и оформление новых toolbar/card controls оставлены для L03 (CSS).

Локальный коммит: один локальный коммит; его SHA зафиксирован в итоговом
отчёте агента после `git rev-parse HEAD`.
