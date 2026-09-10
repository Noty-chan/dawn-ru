# LionWing canonical re-certification audit

Дата аудита: 2026-09-10. Источник механик: canonical EN `dawn-en-lionwing-cb2f8e67`; RU используется только как overlay.

| Метрика | Результат |
| --- | ---: |
| Проверено канонических уровней | 333 |
| Проверено digest-записей (68 адаптеров + 84 executable registry levels) | 152 |
| Digest совпали с полным SHA-256 payload | 152 |
| Исправлено известных конфликтов | 4 |
| Исправлено усечённых digest Детектива I–II | 2 |
| Понижено устаревших executable claims | 2 |
| Осталось partial в registry | 35 |
| Осталось manual в registry | 1 |
| Адаптеров с coverage `full` / `partial` | 11 / 57 |

## Исправленные границы

- `vagabond.dim-mak.1–2`: заменены короткие digest на canonical SHA-256.
- `ruiner.cryomancer.2`: создана четырёхсегментная Сосулька; сегмент заполняется после фактического Focus gain один раз за Action; Breathe replacement наносит `[Spirit/2]` за сегмент и Immobilize’ит Slow-цель.
- `ruiner.grim-ascendant.2`: удалён старый half-damage/Regeneration state-toggle; добавлен opt-in Drain Life с двумя связанными Immobilize-источниками и условным Focus reward.
- `altruist.empath.3`: registry переведён в passive/full и оставлен только boundary-адаптер `3 Focus + [Tier] Health`; платный Support-путь больше не является executable path.
- `vagabond.assassin.3`: ядро проверяет Hide→Stride, бесплатный Шаг, Invisible и `[Speed/2]` к следующему Finisher в том же Turn.

## Числовой проход 2026-09-10

Полный canonical EN payload прочитан для всех уровней `vagabond.aerial-master`,
`vagabond.skirmisher`, `vagabond.drunkard`, `bulwark.iron-bodied` и
`bulwark.vanguard-defender`; для каждого рассчитан полный SHA-256 по формату
`{id, archetypeId, techniqueId, name, text, notes, source}`.

- `bulwark.iron-bodied.3` добавлен как partial: neutral composer ограничивает
  итоговый урон до `4 + ceil(Tier/2)` только при авторитетной
  `negative.обездвижен` и после всех снижений.
- `vagabond.aerial-master.3` добавлен как partial: neutral composer заменяет
  пул Атаки на эффективную Скорость только по явному выбору в авторитетной
  Flight Stance; снятие Ускорен и Launch остаются ручным продолжением.
- `vagabond.skirmisher.3` уже имел действующий adapter `+1 Advantage`; его
  registry запись теперь явно отражает этот partial numeric scope.
- `bulwark.iron-bodied.1–2` уже действовали; `vagabond.aerial-master.1`,
  `vagabond.skirmisher.1–2`, `vagabond.drunkard.1–3` и
  `bulwark.vanguard-defender.1–3` намеренно не закрыты числовым adapter’ом:
  их числа связаны с выбором реакции, перемещением, состояниями или отсутствующим
  lifecycle seam и не должны приниматься из клиентского boolean/context.

Оставшиеся partial/manual записи намеренно не повышались: они требуют дополнительных surface/evidence или ещё не доказывают полный канонический пользовательский путь.
