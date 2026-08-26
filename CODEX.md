# DAWN: карта репозитория и памятка аудита

Этот репозиторий содержит русский перевод DAWN, веб-приложение игрового стола, публикационные материалы и инструменты сборки.

- `source/translation/` — источник истины для текста русского перевода.
- `apps/companion/` — интерактивный стол и автоматизация правил.
- `tools/layout/` — сборка и проверка книжной верстки.
- `site/` и `media/` — отдельные веб-материалы.
- `supabase/` — сетевой слой и миграции; не менять без отдельной задачи.
- `build/`, `output/`, `release/` — результаты сборок, а не место для исходных правок.

Перед изменениями прочитайте ближайший `CODEX.md`: вложенный файл уточняет эти правила. Сохраняйте чужие незавершенные изменения, не редактируйте генерируемые файлы вручную и проверяйте `git status` до коммита.

Для работы со столом начните с `apps/companion/CODEX.md`, `ARCHITECTURE.md`, `TECHNIQUE-AUTOMATION.md` и `TECHNIQUE-FOUNDATION-MAP.md`.

## Репозиторий и безопасность

- Каноническая исходная точка: `main` на `0a7429c72a1b23abdf58bf6df7722b2c3eb070bd`.
- Рабочая ветка: `codex/dawn-automation-audit`. `main` не изменять и не отправлять.
- Перед новым проходом: `git status --short`, `git branch --show-current`, `git log -1 --oneline`.

## Где находится истина

- Английский оригинал: `source/original/Dawn - A Diceless Fantasy TTRPG.pdf`.
- Русский перевод по страницам: `source/translation/pages-*.md`; индекс пар названий: `source/translation/adapted-names-index.md`.
- Runtime-данные companion: `apps/companion/data.js`.
- Реальные адаптеры Техник: `apps/companion/technique-engine.js`, исполнение — `scene-actions.js`, `scene-triggers.js`, `scene-responses.js` и `scene-events.js`.
- Автоматизация врагов задаётся реестрами `ENEMY_AUTO_ATTACK_RULES`, `ENEMY_ATTACK_FAMILY_RULES`, `ENEMY_AUTO_EFFECT_RULES`, `ENEMY_FULL_RULES` в `scene-actions.js`.
- Карта кандидатов: `apps/companion/AUTOMATION-READINESS.md`; это заявление, не доказательство.
- Evidence: `apps/companion/automation-evidence.json`; `certified` допустим только при полном core/UI/network/save-load пути.
- Главная таблица аудита: `docs/AUTOMATION-INDEPENDENT-AUDIT-2026-08-25.md`.
- Генератор четырёх справочников: `apps/companion/build_rule_reference_docs.mjs`.

## Правила повторного аудита

- Идти пакетами ровно по 16 записей; каждый уровень Техники и каждое активируемое правило врага — отдельная строка.
- Для каждой строки проверить: timing, cost, target type, range/geometry, choice, effect, duration, cancellation/interruption.
- Не считать наличие `RULES`, реестра или happy-path теста доказательством полного правила.
- Отдельно искать stale prompt, KO между prompt/ответом, duplicate response/idempotency, cancel-before-payment, occupied/empty/noncanonical cells, controller change, reconnect/import во время цепочки.
- Уровни доверия не смешивать: `confirmed-manual`, `core-reviewed`, `core-tested`, `certified`. `core-reviewed` не доказывает UI/сеть/persistence.
- После каждого пакета обновлять секцию «Повторный сквозной аудит пакетами по 16» и добавлять конкретные defect entries в `AUDIT_FINDINGS` генератора.

## Уже обнаруженные ловушки

- PDF-стр. 65 содержит старый пояснительный пример Берсерка; для актуального правила использовать полный блок Техник на PDF-стр. 67.
- `enemy.common.viper.trump.knife-in-the-dark`: русский текст проекта механически расходится с EN PDF-стр. 112.
- `enemy.common.privateer.action.escort`: generic Effect применял только Hasten, но не follow movement; статус понижен до `assisted`.
- `powerhouse.gunslinger.1`: API целей-клеток использует строковые ключи вроде `"4,2"`; канон Big Iron допускает только персонажей, поэтому пустые клетки должны отклоняться.
- `powerhouse.braggart.3`: источник Раны обязан быть врагом; одного `woundGained` недостаточно.
- `powerhouse.breacher.1`: ненулевой урон от Tension не равен Success; post-displacement должен отдельно требовать Success.
- У `powerhouse.dual-wielder.3` каждый из двух выбранных эффектов имеет собственную семантику, а A/B чередование сбрасывается в начале Turn; generic choice/effect недостаточен.
- `powerhouse.predator.2` требует knowledge-state, а не прямого чтения HP: ограничение движения зависит от того, что персонажу известно.
- `vagabond.assassin.1`: «первое действие после Deploy» нельзя заменять проверкой пустого Scene action log; нужен deployment serial/anchor.
- `vagabond.assassin.2`: пользовательский roll не является доказательством `[Tier]` Advantage и crit5–6; core обязан вывести/проверить эти параметры.
- `vagabond.untouchable.2`: условие «Evasion reduces damage to 0» требует одновременно `dealt === 0` и `evaded > 0`; одного итогового нуля недостаточно.
- Канон на PDF-стр. 22 требует Always Round Up для дробей в квадратных скобках. Ищите `Math.floor`/`floor(...)` во всех адаптерах `[Attribute/2]`, `[Hits/2]` и подобных формул: Mundane I и Heavenly Saint II уже были ошибочны.
- `automation-evidence.json` привязывает evidence к SHA-256 всего `data.js`: даже несвязанная правка перевода делает запись stale. Обновлять digest можно только после проверки точечного diff; claims/confidence/auditedAtCommit при этом не переписывать.
- `prepareSurgery` принимает готовые `roll.successes`: наличие массива `rolls` не доказывает обязательный Mind roll. Для статуса выше partial нужен authoritative dice derivation/validation.
- Pure Water Алхимика по канону позволяет удалить любой Effect или Effects, то есть требует выбора подмножества; автоматическое удаление всего списка не эквивалентно канону.
- Не полагайтесь только на `TechniqueEngine.RULES`: у Chronomancer II core-автоматика жила напрямую в dice hooks/triggers при заявлении `manual`. Ищите level id и technique family во всех `scene-*` файлах.
- Will-O-Wisp II нельзя реализовывать как полный `actor.move` с последующим возвратом: остановка должна усечь путь до выполнения enter/path-триггеров за первой клеткой выхода.
- Для marker-правил проверяйте не только ручное движение и aura: Spirit Flame I отдельно требует push маркера, когда Attack targeting включает его клетку.
- В Choke ограничение «you've Snared» относится к дистанционному Body/Talent targeting; отдельное предложение о `[Tier]` damage говорит о любом Snared character. Не переносите ownership между claims.
- Триггеры вида «when you create a Gas Zone» должны проверять тип созданной зоны и владельца, а не хардкодить единственный известный source id.
- Удаление/добавление строки в `scene-actions.js` меняет сгенерированные line references во всём `ENEMIES-IMPLEMENTATION-SPEC.md`; большой механический diff ожидаем.

## Команды проверки

Из `apps/companion`:

```text
npm run readiness
npm run docs:rules
npm test
```

`npm test` обязан подтвердить свежесть foundation/readiness/reference docs и весь QA. Тест Raasha может быть явно пропущен без внешнего `DAWN_RAASHA_FIXTURE`; это нужно честно указать в отчёте.

## Текущий прогресс повторного прохода

- Пакет 1 Техник: позиции 1–16 (`powerhouse.berserker.1` … `powerhouse.struggler.1`) — завершён; полный `npm test` прошёл, коммит `480dd263a7e153bcc90feeb74e4964c272763f05`.
- Пакет 2 Техник: позиции 17–32 (`powerhouse.struggler.2` … `powerhouse.breacher.2`) — завершён; полный `npm test` прошёл, коммит `1e1849c0611f345e0b8ef8fb5e005e96cdcbf464`.
- Пакет 3 Техник: позиции 33–48 (`powerhouse.breacher.3` … `powerhouse.predator.3`) — завершён; полный `npm test` прошёл, коммит `62d146b02bd79a8252bdf31f8c0a8ca8f66b42db`.
- Пакет 4 Техник: позиции 49–64 (`powerhouse.improvisational-fighter.1` … `vagabond.skirmisher.1`) — завершён; Assassin I–II понижены до partial, полный `npm test` прошёл, коммит `85e56d2ee6b33489410ed922a61489d61010ad9f`.
- Пакет 5 Техник: позиции 65–80 (`vagabond.skirmisher.2` … `vagabond.cunning-fighter.2`) — завершён; Untouchable II исправлен, полный `npm test` прошёл, коммит `03242bf92406f32df0223940c5dbb55649253ad7`.
- Пакет 6 Техник: позиции 81–96 (`vagabond.cunning-fighter.3` … `vagabond.modified-meister.3`) — содержательно проверен; исправлена причинность условия «Танец» у Egomaniac I, полный `npm test` прошёл.
- Пакет 7 Техник: позиции 97–112 (`vagabond.opportunist.1` … `bulwark.crusher.1`) — завершён; RU/EN совпадают, новых малых исправлений нет, полный `npm test` прошёл.
- Пакет 8 Техник: позиции 113–128 (`bulwark.crusher.2` … `bulwark.battle-jockey.2`) — завершён; исправлено согласование в RU Giant Frame I, данные/карты/каталоги пересобраны, полный `npm test` прошёл.
- Пакет 9 Техник: позиции 129–144 (`bulwark.battle-jockey.3` … `bulwark.runic-retribution.3`) — завершён; RU/EN совпадают, новых малых исправлений нет, полный `npm test` прошёл.
- Пакет 10 Техник: позиции 145–160 (`bulwark.shield-bearer.1` … `bulwark.mecha-pilot.1`) — завершён; RU/EN совпадают, marker Servant I подтверждён только как partial, полный `npm test` прошёл.
- Пакет 11 Техник: позиции 161–176 (`bulwark.mecha-pilot.2` … `altruist.precognizant.2`) — завершён; исправлены два round-up дефекта и self-Wound Empath II, полный `npm test` прошёл.
- Пакет 12 Техник: позиции 177–192 (`altruist.precognizant.3` … `altruist.dancer.3`) — завершён; Surgeon I и Alchemist I понижены до partial, Chronomancer II поднят из ошибочного manual в decision, Quick Mix получил отказ и проверку canonical potion id; полный `npm test` прошёл.
- Пакет 13 Техник: позиции 193–208 (`altruist.fog-walker.1` … `altruist.bardic-savant.1`) — завершён; Will-O-Wisp I–II понижены до partial, исправлены Intense Spirit и согласование Yellow; карты пересобраны, полный `npm test` прошёл.
- Пакет 14 Техник: позиции 209–224 (`altruist.bardic-savant.2` … `disruptor.cutpurse.2`) — завершён; исправлены ownership bonus Choke II и generic Gas trigger Deposition III; карты пересобраны, полный `npm test` прошёл.
- Всего предстоит 472 записи: 321 уровень Техник + 151 активируемое правило врагов, то есть 30 пакетов (29 полных по 16 и последний из 8).
## Повторный аудит: пакет 15 (уровни 225–240)

- После пакета 15 проверено 240/472 записей: 240/321 уровней Техник и 0/151 врагов в текущем полном повторном проходе; остаётся 81 уровень Техник и 151 правило врагов (232 всего).
- Не считать отсутствие записи в `TechniqueEngine.RULES` доказательством полной ручности: искать скрытые passive hooks в `scene-responses.js`, `scene-triggers.js`, `scene-engine-core.js` и `scene-query.js`. Так обнаружены Mind Breaker II–III и Reaper II.
- Autophage I: regeneration в `scene-responses.js` сейчас использует `expectedDamage > 0`, но канон говорит successful Attack; полное поглощение урона не должно отменять trigger.
- Autophage II–III: `TechniqueEngine.preview` ищет старый `damage.apply` во всём scene log (`find`, без pending trigger token). Это stale/replay уязвимость: адаптер надо привязать к конкретному незавершённому successful Attack/Finisher и его исходной цели.
- Финальный этап цели после всех 30 пакетов обязателен: сквозная проверка 4 reference-файлов, evidence digest/claims, UI/network/save-load, freshness map и полный npm test. Пакетная отметка не означает завершение всей цели.

## Повторный аудит: пакет 16 (уровни 241–256)

- После пакета 16 проверено 256/472: 256/321 уровней Техник; остаётся 65 уровней Техник + 151 правило врагов = 216.
- Siren I–II — хорошие примеры реального decision core: trigger queue, повторная валидация и размещение есть, но это всё ещё не evidence полного UI/network/save-load пути.
- Wave Rider I и Gale Strider I нельзя повышать выше partial: entity/trigger lifecycle работает, однако создание запускается отдельной кнопкой и не связано атомарно с каноническим Spell/Finisher/Jump.
- При RU↔EN сверке проверять не только смысл, но согласование: в пакете исправлены Inhuman Strength I и Swarm Body II одновременно в `source/translation` и `data.js`.

## Повторный аудит: пакет 17 (уровни 257–272)

- После пакета 17 проверено 272/472: остаётся 49 уровней Техник + 151 правило врагов = 200.
- Generic `areaType: "attack"` не доказывает конкретное каноническое Завершение/атрибут. Bombardier I–III строят AP/Focus/reaction/damage events, но принимают готовые `roll.successes` без проверки Spirit; их `full` понижен до partial.
- Inner World I ищет последнее Charge `resource.gain` по всему журналу. До исправления нужен event id/token конкретной Charge; иначе нулевая/заменённая текущая Charge может повторно использовать старое получение Фокуса.
- Inner World II — редкий уровень с core evidence, но даже он не certified: не доказаны UI/network/reconnect/import и полная отрицательная матрица.
