# Large implementation program: Ruiner automation

## Objective

Implement the missing canonical automation for the entire Ruiner archetype as a long-running, test-driven program. This covers all 54 Ruiner Technique levels, not merely the 33 levels still awaiting the audit's second pass. Existing handlers are claims to verify during implementation, not permission to skip missing branches.

This is deliberately separate from the independent audit. Do not continue audit packs, rewrite audit conclusions, add `certified` evidence or declare broad completion from passing happy paths. Implement behavior and leave a precise verification trail for a later independent reviewer.

## Starting point and branch

```bash
git fetch origin
git switch codex/dawn-automation-audit
git pull --ff-only origin codex/dawn-automation-audit
git switch -c codex/ruiner-automation-program
```

Never alter or push `main`. Read completely before editing:

- `CODEX.md`;
- `docs/HANDOFF-AFTER-AUDIT-PACK-18.md`;
- `docs/TECHNIQUES-RU-EN-CATALOG.md`;
- `docs/TECHNIQUES-IMPLEMENTATION-SPEC.md`;
- every Ruiner row already present in `docs/AUTOMATION-INDEPENDENT-AUDIT-2026-08-25.md`;
- `docs/TASK-SPELLCRAFTER-LEARNED-MODIFIERS.md` for the first workstream.

Verify every implementation claim against the English PDF. The generated implementation spec is a map, not authority.

## Scope: all Ruiner families

Work through these families in canonical order:

1. Bombardier
2. Rapid-Fire Sorcery
3. Ritualist
4. Spellcrafter
5. Student of Stars
6. Cryomancer
7. Dramaturge
8. Feral Arcana
9. Flame Heart
10. Grim Ascendant
11. Long Draw
12. Mana Blades
13. Void Soul
14. Thunder Blood
15. Zealot
16. Creation Ascetic
17. Ego Arm
18. Sellsword's Call

For every level, implement or explicitly leave a machine-readable defect note for all applicable claims: trigger moment, action/attribute, cost, target, range/topology, choice, effect/damage, duration, cancellation/interruption, usage limit and reset.

## Required architecture, not shortcuts

- Use stable ids, never Russian display strings, for runtime branching.
- Optional rules use authoritative prompt/intention tokens bound to the exact triggering event.
- Revalidate actor, controlled hero, targets, cells, resources, source entities and usage limits at response/commit time.
- Payment happens only after all validation and never on cancellation.
- Duplicate/replayed responses are idempotent or rejected.
- Composite actions survive reconnect/import or are safely cancelled without payment.
- Owned effects, markers, terrain, summons and pocket spaces preserve provenance.
- Random rolls are public/authoritative and cannot be supplied with forged successes.
- UI filtering is never the only validation; network/import payloads must pass core checks.
- Do not create one-off parallel mechanics when an existing family foundation can be extended safely.

## Workstream plan

### Phase 0 — inventory and executable roadmap

Before implementation, generate `docs/RUINER-AUTOMATION-IMPLEMENTATION-STATUS.md` with one row per 54 levels:

- canonical claims;
- existing adapters/hooks/tests;
- exact missing core/UI/network/persistence behavior;
- dependency family;
- estimated size S/M/L/XL;
- implementation batch and current state.

This is an implementation tracker, not an audit confidence table. Do not copy statuses blindly; cite code locations.

### Phase 1 — persistent build/runtime contracts

- Complete Spellcrafter learned modifiers using its dedicated task file.
- Normalize alternative clocks/resources and learned Technique configuration across hero build, scene sync and import.
- Add migrations and schema validation before feature-specific UI.

### Phase 2 — attack-shape and roll authority families

- Bombardier, Rapid-Fire Sorcery, Ritualist, Student of Stars and Long Draw.
- Bind every geometry adapter to its exact canonical action/attribute/preceding combo.
- Replace trusted `roll.successes` entry points with authoritative dice payload validation where missing.
- Cover empty cells, terrain, clipped borders, infinite lines, polygons, split damage and reaction ordering.

### Phase 3 — effect/clock/transformation families

- Cryomancer, Dramaturge, Feral Arcana, Flame Heart, Grim Ascendant, Void Soul, Thunder Blood and Zealot.
- Use event-bound choices and exact clock/scene/turn reset semantics.
- Cover alternate-resource interactions, KO during prompts, transformation exit and multi-effect provenance.

### Phase 4 — creation/entity families

- Mana Blades, Creation Ascetic, Ego Arm and Sellsword's Call.
- Implement real owned entities where canon requires actors rather than decorative markers.
- Cover HP, turns, attacks, movement, ownership transfer, carrier state, KO/removal and save/load.

### Phase 5 — complete surface hardening

- Player and Narrator UI for every implemented decision.
- Structured network intents with ownership checks and retry behavior.
- Export/import, reconnect mid-chain and schema migration.
- Accessibility/visible rule text for all choices.
- Full regression suite and generated-doc freshness.

## Batch and commit discipline

Use small reviewable batches of 3–6 related levels, not one giant final commit. Suggested prefixes:

- `feat(ruiner): ...`
- `fix(ruiner): ...`
- `test(ruiner): ...`
- `docs(ruiner): ...`

After every batch:

1. update the implementation tracker;
2. run directly affected tests;
3. run generators and full `npm test`;
4. commit with a clean worktree;
5. record SHA, tests and remaining known gaps in the tracker.

Do not change audit confidence/evidence in these implementation commits. A later reviewer can promote statuses after independent surface testing.

## Mandatory scenario matrix

Every nontrivial choice chain needs at least:

- positive, negative and exact boundary cases;
- stale prompt after state/version/resource/target change;
- actor or target KO between prompt and response;
- controlled-character change and wrong responder;
- cancel before payment;
- duplicate response/network retry;
- occupied, empty, removed and noncanonical cells where spatial;
- reconnect and export/import during the unfinished chain;
- first/last/over-limit use and turn/round/scene reset;
- multiple owners/sources and foreign entity/effect rejection.

Tests must assert behavior, not merely search for strings or handler names.

## Definition of implementation-program completion

Completion requires all of the following, while still leaving independent certification to another reviewer:

- 54/54 tracker rows resolved as implemented or explicitly blocked by a concrete engine dependency;
- no claimed implemented row lacks core, UI, network and persistence tests unless the tracker gives a defensible not-applicable reason;
- all canonical costs, timing, targets, effects and limits have positive/negative/boundary coverage;
- no open stale/idempotency/cancel-before-pay defect for an implemented chain;
- full generators and `npm test` pass;
- branch is clean, pushed, and final report lists every commit SHA and unresolved gap.

## Ready-to-use master prompt

> Work on the Dawn repository using the large Ruiner implementation program. Fetch `origin/codex/dawn-automation-audit`, create `codex/ruiner-automation-program`, and never modify or push main. Read `CODEX.md`, `docs/HANDOFF-AFTER-AUDIT-PACK-18.md`, `docs/TASK-RUINER-AUTOMATION-PROGRAM.md`, the Spellcrafter subtask, both Technique reference documents and all existing Ruiner audit rows completely before editing. Your job is implementation, not continuation of the audit: build the missing canonical automation for all 54 Ruiner levels across core, UI, network and persistence in the phases and small batches specified. First create the 54-row executable implementation tracker with code citations; then implement continuously, starting with persistent Spellcrafter learned modifiers. Never infer correctness from a handler or happy path, never self-certify or edit audit evidence, and never trust UI filtering as validation. For every chain cover positive/negative/boundary, stale prompt, KO/control change, cancellation before payment, duplicate response, invalid cells, reconnect and import. Run affected tests and full `npm test` after each batch, commit cleanly, maintain SHA/progress in the tracker, and continue until the program definition of completion is satisfied or a concrete engine dependency is documented.

## Review checkpoints for the stronger model later

- Review the tracker before accepting Phase 1 scope.
- Sample at least one event-bound prompt, one area Attack, one clock/transformation and one owned entity per phase.
- Re-run forged network/import inputs, not only browser flows.
- Independently compare final behavior with PDF before changing any audit status or evidence.

