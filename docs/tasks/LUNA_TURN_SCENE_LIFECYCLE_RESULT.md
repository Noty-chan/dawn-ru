# LionWing lifecycle contract result

## Gap audit

The branch reuses the existing `boundaryOperations` adapter, lifetime
descriptors, usage limits, action history, continuation queue, receipts and
`activeTurnInstanceId`. The engine remains the only state writer. No parallel
scheduler or technique ID switch was introduced.

The added automation-facing contract is `DAWN_LIONWING_ENGINE.lifecycleContext`
(`lifecycle` alias) and `DAWN_LIONWING_ADAPTERS.lifecycle`. It provides one
vocabulary for `sceneStart/sceneEnd`, `roundStart/roundEnd`,
`ownTurnStart/ownTurnEnd` and `anyTurnStart/anyTurnEnd`, stable period keys,
owner Turn serials and instance IDs, extra-Turn context, history queries and
receipt lookup. Boundary dispatch records a private, reload-safe receipt keyed
by rule, owner and lifecycle period. Duplicate dispatches therefore do not
repeat an operation. Existing `turnStart/turnEnd` adapters remain compatible.

Boundary plans can return operations or optional choices. Choices are queued
through the existing `technique-trigger` continuation, include `skip` as
cancel/pass, expose the rule label and boundary reason, and carry source
digest, coverage and provenance. Automatic activation is emitted as
`rule.activated` with the same metadata. Private boundary receipts stay out of
the public projection.

## Added evidence-backed parts

These are opt-in and marked `partial` because other text or unresolved source
semantics remain outside this change:

| Rule | Connected part | Source digest |
| --- | --- | --- |
| `powerhouse.monastic-sage.2` | Scene Balance clock; alternating Attack/non-Attack actions add Balance; optional own-Turn Strengthen/Hasten spend | `68c84fc146d316b7508a983d89e6438f07785d78ff8bb885ac25dade66f40c60` |
| `powerhouse.technician.1` | Charge opens an owner-bound Stretch window; a completed Skirmish → Finisher combo grants 1 AP | `79946bc3df6de994901a8519030345403e62c0fac627a76aaa8bc0ee45edda83` |
| `powerhouse.technician.2` | Completed Skirmish → Finisher combo grants Tier/2 Armor until the owner’s next Turn start | `87d635215f2088e683f229d48bc51b0f2bc34d6a88bc1dea707fcea12e4be250` |
| `vagabond.sniper.2` | Optional Bunker Down choice at Scene start or after an own non-Attack Turn | `e154b6164f886770be2bb7a63a6a86bd7be83a88967eecaeb1f801b631874767` |
| `vagabond.opportunist.2` | Optional Mark choice after a nearby ally’s single-target Attack, spending Focus | `4428e0016f97c612a78e62f5229be16a4b71ec6043a44d1599195d77e81ae62f` |

`powerhouse.improvisational-fighter.2` remains gated until a trusted ActionPlan
states whether Interact results in an Attack. Crusher levels, Technician III
and the remaining clauses of the listed levels remain outside this partial
set.

## Validation

- `npm run test:turn-scene-scheduler --silent` passes.
- `npm run test:families --silent` passes.
- `node tests/syntax.mjs` passes.
- `git diff --check` passes.
- Full `npm test --silent` reaches the existing generated-reference gate and
  stops because four reference documents are stale; this is the same baseline
  gate documented by the handoff and is unrelated to this branch.

