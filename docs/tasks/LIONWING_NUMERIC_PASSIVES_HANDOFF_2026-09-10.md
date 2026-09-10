# LionWing numeric passives handoff

Дата среза: 10 сентября 2026. Canonical edition: `dawn-en-lionwing-cb2f8e67`.

В baseline уже действовали read-only numeric adapters для Iron Bodied I–II,
Giant Frame II, Rising Challenger III, Skirmisher III и других близких частей.
Этот проход добавил:

- `bulwark.iron-bodied.3` — partial cap итогового урона
  `4 + ceil(Tier/2)` в авторитетной Immobilized state;
- `vagabond.aerial-master.3` — partial replacement Attack pool на effective
  Speed по явному выбору в авторитетной Flight Stance;
- явную registry запись `vagabond.skirmisher.3` для уже существующего `+1`
  Advantage adapter.

Все новые правила opt-in: enabled состояние читается только из actor automation,
ядро остаётся единственным writer. Условные значения выводятся из actor/scene
state; forged `immobilized` и `flightStance` context flags не принимаются.

Полный canonical payload всех 15 уровней пяти проверенных техник сверён и
идентифицирован SHA-256 в принятом registry формате. Остаток по Aerial Master,
Skirmisher, Drunkard, Iron Bodied и Vanguard Defender перечислен в
`LIONWING_CANONICAL_RECERTIFICATION_AUDIT.md`; сложные lifecycle/reaction части
оставлены partial/manual.

Проверки:

```powershell
node apps/companion/tests/lionwing-passive-adapters.mjs
node apps/companion/tests/lionwing-numeric-composer.mjs
node apps/companion/tests/lionwing-provenance.mjs
npm test --prefix apps/companion
```

E2E evidence для этого numeric прохода не заявляется.
