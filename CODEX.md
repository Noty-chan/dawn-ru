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
- Пакет 2 Техник: позиции 17–32 (`powerhouse.struggler.2` … `powerhouse.breacher.2`) — содержательно проверен; перед коммитом требуется полный тестовый прогон.
- Всего предстоит 472 записи: 321 уровень Техник + 151 активируемое правило врагов, то есть 30 пакетов (29 полных по 16 и последний из 8).
