# Concepts from iterative LionWing enemy review

These are reusable failure patterns to check before calling a new adapter fully automated. Each came from a concrete review finding; the examples are brief so they can guide later reviews without becoming a second implementation spec.

## Standing review directive

When a check or fix reveals a defect, repair the shared cause where possible, test at least one sibling use, and record the general failure pattern here. Delegate the wider search across other consumers to Luna reviewers; they return concrete, reproducible cases and do not edit production code. The integrator accepts or rejects those findings, fixes confirmed cases, and records what remains unverified. This keeps broad checking continuous without making every local fix wait for a full manual audit.

1. **One rule, one calculation owner.** Marked damage was added in the Attack preview and again in a proposed resolution patch. A modifier belongs at the phase named by its trigger. Check the actual committed result with different attacker/defender Tiers and with Armor/Evasion, not just the preview number.
2. **A prepared event is a request, not proof.** S01 originally validated a valid-looking Prepare while allowing unrelated events in the same batch. Validate the exact event sequence, count, actor, payload and current scene before the shared writer mutates state.
3. **Replay has two identities.** Reusing old event IDs should be idempotent; regenerating IDs for the same once-per-Round Action must still be rejected by game state. Test both cases.
4. **Availability and commit must agree.** UI availability and target selection can be stale after a reaction, knockout, suppression, disappearance, or pending chain. Recompute targets and effective effects at commit; never rely on raw `actor.effects` when suppression or auras matter.
5. **Check the exact source wording and every target category.** “Any character” includes allies and self. A convenient enemy-only or non-self filter silently changes the rule. Verify unusual targets explicitly.
6. **Movement type matters.** Ranger Aim is lost on ordinary movement in its own Turn, not on forced movement, teleportation, or placement. Record the cause of movement and test each route.
7. **Damage bonuses cannot create their own trigger.** Marked requires an Attack that already deals damage; Evasion reducing damage to zero must preserve Mark. Apply the bonus after defenses and only once per Attack.
8. **A prompt must reach its real writer.** Ranger had a valid-looking prompt, but `rule.respond` did not route through the enemy continuation path. Exercise the UI action through response and final commit, not only prompt creation.
9. **Saving must preserve every accepted source.** The effect writer could accept 13 independent sources while save normalization kept 12; the legacy writer kept a different 12. Preserve accepted sources and reject overflow atomically at the writer rather than silently changing game state on reload.
10. **Deferred work must survive persistence.** The prompt reducer accepted 29 queued decisions while save normalization kept 24, leaving audit entries for prompts that would never appear. Queue limits belong at the producer; save normalization must retain accepted work.

For future slices, pair one normal scenario with a forged event, a stale scene, a replay with fresh IDs, and a boundary case that changes the outcome. Record unresolved cases before raising automation coverage.
