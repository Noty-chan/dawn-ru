# LionWing canonical re-certification audit

Дата аудита: 2026-09-10. Источник механик: canonical EN `dawn-en-lionwing-cb2f8e67`; RU используется только как overlay.

| Метрика | Результат |
| --- | ---: |
| Проверено канонических уровней | 333 |
| Проверено digest-записей (52 адаптера + 84 executable registry levels) | 136 |
| Digest совпали с полным SHA-256 payload | 136 |
| Исправлено известных конфликтов | 4 |
| Исправлено усечённых digest Детектива I–II | 2 |
| Понижено устаревших executable claims | 2 |
| Осталось partial в registry | 35 |
| Осталось manual в registry | 1 |
| Адаптеров с coverage `full` / `partial` | 11 / 41 |

## Исправленные границы

- `vagabond.dim-mak.1–2`: заменены короткие digest на canonical SHA-256.
- `ruiner.cryomancer.2`: создана четырёхсегментная Сосулька; сегмент заполняется после фактического Focus gain один раз за Action; Breathe replacement наносит `[Spirit/2]` за сегмент и Immobilize’ит Slow-цель.
- `ruiner.grim-ascendant.2`: удалён старый half-damage/Regeneration state-toggle; добавлен opt-in Drain Life с двумя связанными Immobilize-источниками и условным Focus reward.
- `altruist.empath.3`: registry переведён в passive/full и оставлен только boundary-адаптер `3 Focus + [Tier] Health`; платный Support-путь больше не является executable path.
- `vagabond.assassin.3`: ядро проверяет Hide→Stride, бесплатный Шаг, Invisible и `[Speed/2]` к следующему Finisher в том же Turn.

## Общие границы жизненного цикла

- Канонические `Scene`, `Round` и `Turn` теперь проходят через один scheduler
  LionWing Engine. Сериал собственного Хода (`ownerTurnSerial`/`ownerTurnKey`)
  используется для own-turn правил, а `activeTurnInstanceId` — для any-turn
  правил, включая дополнительные Ходы.
- Boundary receipts сохраняются приватно и дедуплицируются по правилу,
  владельцу, Сцене и нужной границе. Повторная доставка, JSON reload и replay
  не создают второй активации; Scene reset очищает receipts и stale optional
  choices.
- Проверены через общий путь несколько уже зарегистрированных consumers:
  Absolute Bastard I, Gunslinger I, Gourmand I, Mundane I и Empath III.
  Это доказывает повторное использование scheduler, но не поднимает их
  registry certification и не является E2E evidence.

Оставшиеся partial/manual записи намеренно не повышались: они требуют дополнительных surface/evidence или ещё не доказывают полный канонический пользовательский путь.
