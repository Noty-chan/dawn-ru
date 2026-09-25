# Luna: бросок участника Сцены для Нарратора

## Объём

Изменены только разрешённые точки интерфейса и отдельный поведенческий тест:

- `apps/companion/scene-ui.js`
- `apps/companion/app-play-events.js`
- `apps/companion/tests/lionwing-narrator-roll-ui.mjs`

`SceneEngine`, `execution`, `lionwing-ui`, `app-core`, `package/index/sw` и
сетевой протокол не изменялись этим блоком. Коммит и push не выполнялись.

## Воспроизведение и исправление

До исправления в player view вызов `sceneUtilityActor()` сначала доверял
`activeUtilityActorId`. Поэтому устаревший ID врага, оставшийся от предыдущего
выбора Narrator’а, обходил `currentHeroActor()`. На фикстуре с локальным героем
`hero-local`, выбранным `enemy-1` и `activeUtilityActorId="enemy-1"` результат был
`resolvedActorId="enemy-1"` при `localActorId="hero-local"`. Кнопка также передавала
ID из DOM напрямую в `rollSceneDice`, а запрос искал участника по DOM ID.

Теперь разрешение участника выполняется одним helper перед отображением, расчётом
и commit. В режиме player это живой герой с `heroId===S.id`, команда `hero`; stale
или чужой ID отклоняется. В режиме Narrator выбор содержит всех живых участников
Сцены, включая скрытых от игрока, и показывает подпись «Кто бросает». Пул,
модификаторы, цель и выбранные Навык/Способность читаются из листа выбранного
участника. `rollSceneDice` повторно сверяет выбранного участника с устаревшим ID
кнопки и записывает `roll.public` через существующий `commitSceneEvents` с его
`actorId` и именем в подписи журнала.

Поля формы сохраняются в `activeUtilityPreset.form` для того же участника при
перерисовке utility-панели: Атрибут, Навык, Способность, ручной пул, цель,
Преимущество, Помеха и Тёмный порыв. Смена участника сбрасывает это состояние,
чтобы параметры одного листа не перетекали в другой. Ручной пул по-прежнему
заменяет сумму параметров листа, а итог считается существующим
`SceneEngine.diceHookStatus`/`diceRollPayload` path.

«Запросить у игрока» остаётся отдельной веткой обработчика: она доступна только
сетевому Narrator’у для текущего hero-участника и создаёт только
`challenge.request`; «Бросить сейчас» создаёт только `roll.public`.

## Проверка

Прошли:

```text
node apps/companion/tests/lionwing-narrator-roll-ui.mjs
node --check apps/companion/scene-ui.js
node --check apps/companion/app-play-events.js
node apps/companion/tests/syntax.mjs
npm test                         (из apps/companion)
git diff --check
```

Поведенческий тест покрывает смену участника Narrator’ом, пул с его листа,
ручной пул, сохранённые поля формы, Narrator без локального героя, скрытие
участников в player view, подмену actor ID игроком и раздельность сетевого
запроса/немедленного броска.

## Точки подключения

Новых browser-root файлов нет, поэтому `index.html`, service worker и package
менять не требуется. Новый тест запускается отдельной командой выше; координатор
может добавить его в `test:families`, если понадобится автоматический запуск в
будущем. Авторитетное исполнение и журнал остаются в существующем
`SceneEngine`/`commitSceneEvents` path; этот срез не объявляет семейство бросков
завершённым и не меняет raw-dice или другие типы бросков.
