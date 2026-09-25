# Breacher I–III handoff

Дата: 2026-09-10
Ветка: `codex/luna-breacher-testers`
Канон: LionWing EN, `extracted-companion.json`, стр. 71 (printed 70).

В этой порции реализованы:

- `powerhouse.breacher.1` — опциональная одиночная Стычка до 4; после успешной Стычки цель, которая была в пределах 2 при выборе, проходит стандартные Реакции и получает проверяемый толчок на 1.
- `powerhouse.breacher.2` — режим одной Стычки (и Body Finisher через III): `[Body/2]` Преимущество с округлением вверх, последовательное удвоение толчка и Ослаблен после разрешения. Нельзя включить при активном Ослаблен.
- `powerhouse.breacher.3` — Body Finisher до 3; режим II со Стычкой или Body Finisher строит и перепроверяет смежную 2×2 зону через общий geometry runtime, выбирая всех живых персонажей в зоне кроме владельца.

Все изменения проходят через существующие `prepare`/`dispatchMany`, сохранённые pending action, persisted geometry plan и trigger receipts. Повторная отправка, stale area plan, неверный владелец, неразрешённый уровень и включение при Ослаблен отклоняются общей проверкой Engine.

Проверка: `node apps/companion/tests/lionwing-breacher.mjs` и полный `npm test` проходят. Реестр и readiness/map документы обновлены генераторами из `technique-engine.js`.

Остатки: UI использует выбранную цель как центр 2×2; отдельный выбор центра по клетке и автоматическая замена собственного Ослаблен через Берсерка II остаются ручным сценарием. `coverage` для III оставлен `partial`; другие priority families не затронуты.
