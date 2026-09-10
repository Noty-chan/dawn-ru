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
- `vagabond.opportunist.1–3`: добавлен частичный event/choice/action boundary с полными canonical digest; безопасная реакция требует авторитетного события, живого союзника/врага, точной Talent range, persisted choice и повторной проверки до расхода или действия.

Оставшиеся partial/manual записи намеренно не повышались: они требуют дополнительных surface/evidence или ещё не доказывают полный канонический пользовательский путь.
