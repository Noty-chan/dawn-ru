# Карта миграции DAWN 0.9 -> LionWing

> DAWN 0.9 заморожена как рабочая игровая редакция. Ни одно изменение
> LionWing не применяется к ней без явного переключателя редакции.

## Сводка машинного сравнения

- Техники: {'added': 5, 'source-review-required': 101, 'likely-mechanics': 5, 'removed': 1}.
- Слова Способностей: {'translation-pair': 37, 'mechanics-review': 46, 'added': 21}.
- Дары: {'added': 21, 'removed': 13, 'source-review-required': 39}.

## Очерёдность переноса

- **P0 · builder-shell** — Complete LionWing character creation without changing 0.9 saves or budgets.
- **P0 · techniques** — Review likely mechanical field changes and create LionWing-specific adapters.
- **P0 · outlooks-abilities** — Translate new Boons, inherent Boons, Ability words, symbols, and costs.
- **P1 · core-rules** — Port Effects, Basic Actions, combat formulas, and derived statistics into a separate LionWing rules layer.
- **P2 · narrator-table** — Upgrade enemies and table automation only after the LionWing core rules are reviewed.

## Крупные разделы

| Приоритет | Раздел | Старые страницы | LionWing | Сходство |
|---|---|---:|---:|---:|
| P0 | Character Creation | 30-32 | 22-24 | 0.331 |
| P0 | Abilities and Ability Glossary | 43-44 | 45-46 | 0.575 |
| P0 | Outlooks and Boons | 47-52 | 49-54 | 0.565 |
| P1 | Combat core, Effects, and Basic Actions | 53-63 | 55-65 | 0.771 |
| P0 | Techniques | 64-100 | 67-103 | 0.792 |
| P2 | Narrator Tools | 101-126 | 104-134 | 0.628 |

## Техники с вероятным изменением механики

| Stable ID | Было -> стало | Страницы | Изменённые поля |
|---|---|---:|---|
| `altruist.bardic-savant` | Bardic Savant -> Virtuoso | None -> 89 | name, stars, tags, flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `altruist.will-o-wisp` | Will-O-Wisp -> Will-O-Wisp | None -> 90 | stars, tags, flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `disruptor.mind-breaker` | Mind Breaker -> Mind Breaker | None -> 95 | stars, tags, flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `disruptor.street-fighter` | Street Fighter -> Street Fighter | None -> 93 | stars, tags, flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |
| `ruiner.sellsword-s-call` | Sellsword's Call -> Sword Caller | None -> 100 | name, stars, tags, flavor, levels.1.name, levels.1.text, levels.2.name, levels.2.text, levels.3.name, levels.3.text |

Полные значения до/после находятся в `edition-comparison.json`.
