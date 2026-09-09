# LionWing integration audit — 2026-09-10

## Accepted into the audit branch

- canonical re-certification and SHA-256 provenance gate;
- generic Technique controls and canonical EN/RU presentation;
- Will-O-Wisp placement slice;
- information-query foundation;
- typed inventory/resources foundation;
- authoritative movement lifecycle.

The combined tree passes `npm --prefix apps/companion test`: 391 unique rule
ids, 333 canonical Technique Levels, 66 adapter records and 84 executable
registry levels accepted by the provenance gate.

## Fixed during integration

1. Player inventory intents could call `gain/add/remove/select` on owned
   records. The network boundary now accepts only `spend` and `transfer`;
   inventory itself rejects the other operations for role `player`, and the
   gain button is Narrator-only.
2. Narrator Study reveal/cancel mutated information-query state directly from
   UI. Both operations now use `LionWingEngine.prepare` and
   `commitSceneEvents`, preserving journal, replay, undo and network flow.
3. Retired `bulwark.servant-s-call` rows remain available to old saves, but a
   LionWing Scene now rejects their execution because the Technique is absent
   from the canonical LionWing catalogue.
4. Readiness output now labels executable claims without independent evidence
   as `shared/inherited`. A matching canonical digest proves source identity,
   not complete semantics or an end-to-end user path.

## Branches not accepted yet

### Derived numeric combat

The generic `replace -> multiply -> add -> floor -> cap` concept is useful.
The branch also declares several Technique slices whose conditions are passed
as context booleans. Some flags are not produced by an authoritative lifecycle
or are not carried by the player network/UI at all. Direct adapter tests pass,
but that does not prove that the feature can be used at the table or cannot be
forged. Extract and test the numeric composer first; add consumers only when
their trigger is derived from engine state or a verified receipt.

### Turn/Scene lifecycle scheduler

The boundary vocabulary and private receipts are useful, but the branch mixes
the foundation with Monastic Sage, Technician, Opportunist and Sniper
consumers. Its tests directly construct history and mutate a clock, so they do
not cover the complete UI/network/persistence path. Split the neutral lifecycle
contract from Technique adapters, then recertify each consumer against
canonical EN before integration.

## Honest status

The current 84 executable registry levels are code coverage, not 84 newly
verified LionWing implementations. The earlier direct comparison found that
all 79 levels present at that audit point matched the inherited old-registry ID
set. Additional recent adapters raise the current count, but do not change the
evidence rule. Independent E2E certification remains zero until
`automation-evidence.json` contains versioned core/UI/network/persistence
evidence.

## Remaining release checks

1. Run a real two-client Narrator/player smoke test for inventory spend,
   rejected gain, Study reveal and movement continuation.
2. Verify service-worker cache refresh and reload while a Technique choice is
   pending.
3. Split and integrate neutral Turn/Scene lifecycle.
4. Extract the numeric composition contract without unproven Technique claims.
5. Add evidence entries only after canonical semantics and all applicable
   surfaces have been exercised.
