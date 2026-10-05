# LionWing enemy automation — iterative review, 22 September 2026

## Accepted integration

- S00 inventory is generated from 41 ordinary NPC profiles: 122 Actions, Attacks and Aces, plus 38 applicable passives and 3 N/A passives. Modifiers (12) and antagonists (18) are separate. The inventory records handler presence and open acceptance work; it does not certify a whole profile.
- Ranger's three named rules and its passive interaction received an adversarial review. Aim now adds damage only after a successful hit, resets only on ordinary movement in the Ranger's own Turn, and cannot be used to turn a miss into a hit. Headshot requires exactly one live target and clears the target when it leaves the scene. The response prompt reaches the shared enemy continuation writer.
- S01 connects six simple Actions through the real Narrator panel and shared event writer: Executioner Focus, Cannoneer Aim, Berserker Seethe, Assassin Neutralize Target, Paladin Gospel and Spright Discombobulate. The commit validator rejects extra or foreign events, missing Prepare/Resolve pairs, stale targets, incomplete prior chains and fresh-ID once-per-Round replays. Gospel uses effective Regenerating state, including aura and suppression.
- The shared Marked rule was corrected for hero and NPC Attacks. It uses the defender's Tier, adds damage only when the Attack already deals damage after defenses, and triggers once. A completely Evaded Attack keeps Marked; the Assassin's Attack preserves it by its explicit exception.
- A separate Luna review found that save normalization could silently drop an accepted effect source after 12 sources, or deferred prompts after 24 queue entries. Save now retains accepted items. Writers reject new overflow explicitly at 256 effect sources or 128 queued prompts; both the LionWing and shared enemy effect writers are covered.
- A second Luna review found that a bare `attack.pending` could start an ordinary hero Attack with zero AP and an already-used Action. LionWing now requires that Attack to reference a prepared action instance and rejects a second Attack using the same instance. Explicit Narrator events and triggered reaction Attacks retain their own paths. The ordinary player network intent path already rejected bare events; this closes a separate reducer API gap.

## Verification and claim level

- `npm test` passes after the combined integration, including the new S00, Ranger and S01 regression scripts in the ordinary `pretest` gate.
- Focused adversarial tests cover stale targets, forged event batches, replay with old and fresh IDs, Armor and Evasion boundaries, suppression/aura filtering, effect-source retention, deferred queue retention and overflow rejection.
- The Ranger adversarial fixture now checks the bare hero Attack rejection and uses an explicit Narrator override for its scripted incoming Attacks.
- The generated implementation inventory now reports 53/122 executable enemy rules (43.4%): 34 Attack, 17 full, 2 state; 69 remain assisted. These are code-coverage claims. Nine reviewed rule IDs have independent `core-tested` evidence. Formal browser/network E2E certification remains zero.
- The source comparison used the canonical English LionWing extraction and recorded individual rule digests. The source PDF was unavailable here, so page-image comparison was not claimed. A live two-client session and final browser playthrough were not performed in this review.

## Follow-up boundary

The standing directive and concrete failure concepts are in `ITERATIVE-ERROR-CONCEPTS.md`. Luna reviewers scan nearby consumers for the same class of defect and return reproducible examples; the integrator fixes shared causes, checks one sibling path and records any remaining uncertainty. Triggered `quickReaction` Attacks are still authorized through their individual response flows rather than a general-purpose reducer provenance check; that wider authorization review is a later slice. Future automation should keep action/attack/passive completeness separate from handler counts and browser acceptance.
