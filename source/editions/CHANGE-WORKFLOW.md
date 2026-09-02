# Мягкая интеграция новой редакции

`changes.json` — единая очередь изменений книги, русского перевода и компаньона.
Одна запись описывает одно минимальное смысловое изменение:

```json
{
  "id": "change-0001",
  "stableId": "powerhouse.berserker",
  "oldPages": [65],
  "newPages": [66],
  "kind": "mechanics",
  "fields": ["levels.1.text"],
  "summaryEn": "Short factual description",
  "status": {
    "sourceReviewed": true,
    "translation": "draft",
    "mechanics": "pending",
    "companion": "pending"
  },
  "notes": ""
}
```

Допустимые `kind`: `editorial`, `terminology`, `addition`, `removal`, `mechanics`,
`layout`. Статусы перевода, механики и компаньона: `not-applicable`, `pending`,
`draft`, `reviewed`, `published`.

Изменение не попадает в публичный английский билдер, пока английский текст не
сверен с новой страницей. Изменённая механика не заменяет текущую русскую механику,
пока отдельно не подтверждены перевод и адаптер компаньона.
