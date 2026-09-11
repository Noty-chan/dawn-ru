# LionWing canonical re-certification audit

Дата аудита: 2026-09-11. Источник механик: canonical EN `dawn-en-lionwing-cb2f8e67`; RU используется только как overlay.

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

### Master at Arms и преемник Dim Mak (`vagabond.master-at-arms.1–3`)

Каноническое имя старого `Dim Mak` в LionWing — `Detective` (`vagabond.dim-mak`),
стр. 79. `Master-At-Arms` сохраняет это имя и также находится на стр. 79;
источник — `dawn-en-lionwing-cb2f8e67`, полный digest книги
`cb2f8e675dc90152b5d70780262622a42be679853bf289b4c6e80d1ed0ea747d`.
Полные digest уровней Master: I
`d35f468065e84fbb0c86bc60015632bdbcfe9b0ced2ed2cfa370453f64a72371`, II
`743ae31f60f1a826d3346b6e07c7cff94983860c399cdc9484302e120fd726c4`, III
`f104c7652bda2a425422af31d8d91b30515463c98f78892fe25eb204ac7508d3`.
Эти записи соответствуют `vagabond.master-at-arms.1`,
`vagabond.master-at-arms.2` и `vagabond.master-at-arms.3`.

- I (`Multi-Faceted`) — `full` в ядре: авторитетная смена Blade / Pole / Chain
  через `rule-mode.set`, геометрические условия, Swift, перемещение, push и
  Strengthen / Launch / Shred; каждый Armament ограничен одним Equip за Turn.
- II (`Like Water`) — `full` в ядре: только второе Equip за Turn выдаёт 1 AP и
  Hasten, повторная доставка не дублирует награду.
- III (`Master At Work`) — `full` в ядре: Talent Finisher читает сохранённый
  Armament; Blade использует проверенный ортогональный путь до 2 клеток, Pole —
  линию из 2 клеток и создаёт Difficult Terrain после успешного Spike, Chain —
  смежный центр и расширяет квадрат по фактическим Critical. Dispatch повторно
  сверяет source digest, геометрию и производные цели.

Точечные тесты покрывают условия трёх Armament, вторую награду, 0 Critical для
успешного Pole Spike, stale source, подмену области и недопустимый диагональный
путь. UI читает экипированное состояние из `actor.ruleModes`, а выбор геометрии
Master III не блокируется общим запросом цели: после клика область и цели снова
строятся движком.

Повторная визуальная проверка именно стр. 79 в этой чистой копии невозможна:
канонический PDF указан как `local-only-not-committed` и отсутствует в worktree;
официальная страница автора [публикует файл LionWing с закладками](https://joel-happyhil.itch.io/dawn/devlog/1551759/bookmarks),
но выдаёт скачивание после покупки. Поэтому provenance, extraction и digest
зафиксированы, а прямой render/read страницы 79 остаётся `manual`; это не
повышает certification. Сложные browser / network / persistence E2E также
остаются `partial/manual`.

Оставшиеся partial/manual записи намеренно не повышались: они требуют дополнительных surface/evidence или ещё не доказывают полный канонический пользовательский путь.
