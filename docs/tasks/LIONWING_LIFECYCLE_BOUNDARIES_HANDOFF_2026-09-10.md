# LionWing lifecycle boundaries handoff — 2026-09-10

## Canonical scope

The source of truth is `source/editions/dawn-en-lionwing-cb2f8e67/canonical`.
The scheduler uses one vocabulary for `sceneStart`, `sceneEnd`, `roundStart`,
`roundEnd`, `ownTurnStart`, `ownTurnEnd`, `anyTurnStart`, and `anyTurnEnd`.
Canonical starting resources and automatic resets remain engine operations;
adapters only declare opt-in operations.

## What was already present

The LionWing Engine already owned `turnSerial`, per-participant
`ownerTurnSerial`/`ownerTurnKey`, serializable `activeTurnInstanceId`, extra
Turn frames, private `boundaryReceipts`, reload-safe lifetime descriptors, and
scene/round/turn reset calls. The neutral lifecycle test covered the basic
receipt, optional-choice, reload, projection, and duplicate-event path.

## Shared defects fixed

`turnStart` and `turnEnd` callbacks are offered to every adapter owner so an
ally can react to the active participant. Their receipts now use
`anyTurnStart`/`anyTurnEnd` and the active `activeTurnInstanceId` when the owner
is not the active participant. This keeps an ally callback eligible on each
extra Turn instead of incorrectly deduplicating it by the ally's own serial.
The adapter lifecycle read API no longer applies the active global instance to
an inactive owner's `ownerTurn` query, and round queries include `sceneSerial`.
Scene reset records the closing boundary without carrying optional choices into
the new Scene.

## Consumers exercised

`tests/lionwing-lifecycle-consumers.mjs` runs real Engine transitions for
Absolute Bastard I (Scene-start Focus), Gunslinger I (starting Bullets),
Gourmand I (Scene-start inventory), Mundane I (Round reset), and Empath III
(any-Turn ally reward on consecutive extra Turns). The registry remains at 333
canonical levels, six explicit reviews, and zero certified E2E evidence.

## Validation

The focused lifecycle tests and the existing family suite pass. Full `npm
test` also requires regenerated rule-reference documents when the checkout
contains stale generated files; no browser or multi-client E2E claim is made.
