# Implementation task: canonical learned Spellcrafter modifiers

## Why this task exists

Spellcrafter I says the hero chooses one Modification when gaining the Technique level. The current companion exposes all four before every eligible Attack. Spellcrafter III may apply two different Modifications only if both are actually known and paid for. The audit therefore downgraded levels I–III to `partial`.

Canonical source: `source/translation/pages-094-099-ruiner-techniques.md`, Spellcrafter / Experimentation, Solidification and Finalization; verify against the English PDF before coding.

## Required result

Implement a persistent, canonical learned-modifier model across character build, scene state, UI, network intent validation, export/import and reconnect.

### Character/build contract

- Level I stores exactly one learned modifier from `fierce`, `focused`, `wild`, `outstanding`.
- Define and document how level III learns/permits a second modifier. Do not invent this silently: first re-read the English text and existing character-advancement conventions, then encode the smallest canonical model.
- Level removal/downgrade normalizes impossible selections predictably without deleting unrelated hero state.
- Legacy heroes receive an explicit deterministic migration or a required-choice state; never silently grant all four.

### Runtime contract

- Keep learned modifiers separate from the transient modifiers selected for the next Spell/Spirit Finisher.
- Core event validation rejects modifier ids not learned by that hero, even if supplied by imported JSON, a forged browser event or network intent.
- Level I/II permits at most one selected learned modifier; level III permits at most two distinct learned modifiers and charges each.
- Existing Fierce, Focused, Wild and Outstanding effects continue to work through the shared attack pipeline.
- Selection cancellation occurs before payment; committed attacks pay exactly once; duplicate/replayed intents are idempotent or rejected.

### Surfaces

- Character editor makes learned choices visible and editable only where rules allow.
- Tactical UI only renders learned choices.
- Hero-to-scene synchronization preserves learned choices and transient selection correctly.
- Export/import round-trips them; legacy imports follow the documented migration.
- Network player/narrator paths cannot bypass learned-choice validation.

## Tests required

At minimum add positive, negative and boundary tests for:

- each of four learned choices at level I;
- forged selection of an unlearned modifier;
- zero/one/two/duplicate selections at levels I, II and III;
- Innovation vs Focus payment and insufficient resource;
- cancellation before payment and replay after commit;
- downgrade III→II/I and removal of the Technique;
- legacy import, current export/import, reconnect/resync and player network intent;
- existing modifier geometry/damage behavior after the schema change.

Run generators and full `npm test`. Do not mark levels `full`, add evidence or certify them; leave that to a later independent audit.

## Suggested file map

- Canon/data: `apps/companion/data.js`, `source/translation/pages-094-099-ruiner-techniques.md` (read-only unless a proven translation issue exists).
- Hero schema/editor/import: search `hero.techniques`, `mods`, export/import and validation code under `apps/companion`.
- Scene sync/UI: `scene-actions-ui.js`, `app-scene-events.js`.
- Core validation/events: `scene-events.js`, `scene-actions.js`, `technique-engine.js`.
- Network: `network-*.js`, tests `network-mvp.mjs`, `network-v2.mjs`.
- Existing integration tests: `tests/hero-builds.mjs`, `tests/scene-engine.mjs`, `tests/technique-engine.mjs`.

## Ready-to-use prompt for Terra/Soul or a weaker substitute

> Work in `https://github.com/Noty-chan/dawn-ru.git`. Fetch and branch from `origin/codex/dawn-automation-audit`, never from or onto main. Create `codex/spellcrafter-learned-modifiers`. Read `CODEX.md`, `docs/HANDOFF-AFTER-AUDIT-PACK-18.md` and this entire task file before editing. Implement the complete canonical learned-modifier contract for Spellcrafter I–III across character build, scene sync, core validation, UI, network, export/import and reconnect. Do not continue the automation audit, change audit conclusions, add evidence/certification or push main. Use small commits by layer. Treat browser/UI filtering as insufficient: forged imported/network events selecting unlearned modifiers must fail in authoritative core validation. Add the full positive/negative/boundary/persistence/network matrix listed here, regenerate maps/reference docs if affected, run full `npm test`, and finish with a clean branch, exact SHA, changed-file list, test output summary, unresolved assumptions and a reviewer checklist.

## Reviewer checklist

- Learned and transient selections are distinct fields.
- No path defaults to all four known modifiers.
- Core rejects forged/unlearned ids.
- Level and payment limits are enforced at commit time.
- Migration is deterministic and documented.
- Network/import/reconnect tests are behavioral, not string-presence checks.
- Full suite passes and worktree is clean.
- Audit confidence remains `partial` pending independent review.

