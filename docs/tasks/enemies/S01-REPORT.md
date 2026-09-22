# S01 — simple LionWing enemy Actions

## Mechanics brief

Source basis: the canonical English LionWing rule records in `edition-lionwing.js` / `lionwing-table-data.js`, with their stored source digests. The task's referenced PDF was not present in this worktree or the surrounding workspace, so PDF page images and print pagination were not independently verified. The canonical metadata points to profile pages 114, 115, 119 and 122.

General rule used by all six actions: every unique NPC Action costs 1 AP. Allies exclude the acting character. Adjacency is orthogonal and never includes the acting character.

| Profile / Action | Canonical result | Edge cases implemented |
| --- | --- | --- |
| Executioner / Focus | Apply Strengthen and Reinforce to self. | Existing effects remain a set; no duplicate entries. |
| Cannoneer / Aim | Apply Strengthen and Steady to self. | Existing effects remain a set; no duplicate entries. |
| Berserker / Seethe | Restore `2 + Tier × 2` Health. | Healing is capped at max Health; at max Health the action still costs 1 AP and records zero effective healing. |
| Assassin / Neutralize Target | Apply Mark to one chosen character. | Any living character except the Assassin is legal, including an allied NPC. The Assassin gets the Mark damage bonus on its attacks without consuming Mark; other attackers retain the existing consume behavior. |
| Paladin / Gospel | Reinforce every Regenerating ally. | Recomputed from live scene state; excludes self, opponents, and knocked-out allies. |
| Spright / Discombobulate | Choose one adjacent character: Evasion greater than Armor → Slow; Armor greater than Evasion → Shred; neither → Mark. | Uses effective defenses. `0/0` has neither and receives Mark. Equal positive defenses are not covered by the canonical alternatives, so the action produces no effect but still spends AP and resolves. |

Counterexamples guarded by the implementation: Seethe cannot forge a larger heal; Gospel cannot include a non-Regenerating character; Discombobulate cannot target at range or apply the wrong comparison result; Neutralize Target cannot select zero or multiple targets; an event batch cannot change the canonical digest or AP cost.

## Production path and state ownership

The real UI button is rendered from `SceneEngine.availableEnemyRules`. A click reaches `useEnemyRule`, then `SceneEngine.prepareEnemyRule`; `commitSceneEvents` sends the complete event batch through the LionWing `dispatchMany` validator and the shared reducer. The shared commit path owns optimistic scene versioning, undo/redo, journal entries, persistence and network forwarding. The feature does not mutate DOM state or scene objects directly.

The six actions are declared fully automated. Their prepare event is marked as a quick reaction so the existing event contract permits narrator use during another participant's Turn. The availability query preserves AP, knockout, pending-chain and once-per-round guards while removing only the own-Turn guard for this family. Ordinary enemy movement and attacks keep their current Turn restrictions.

The LionWing reducer validates the profile/action pairing, individual canonical digest, exactly one 1 AP spend, target set, effects and healing before any event reaches the legacy writer. This makes replay deterministic and rejects forged or stale batches. JSON export/import preserves the resulting scene state and journal events.

## Verification

Connected status: all six actions have the production prepare/commit/reducer path, full automation status and individual source digests. They are not marked PDF-verified because the PDF asset was unavailable.

Automated integration coverage in `apps/companion/tests/lionwing-enemy-simple-actions.mjs` includes all six effects, Tier 1 and Tier 3 healing, max-Health cap, allied NPC targeting, Gospel filtering, all four Discombobulate comparisons, off-Turn use, AP/KO/missing-actor guards, prepare cancellation without payment, replay/idempotency, stale scene version, JSON reload, Assassin Mark retention, normal Mark consumption, forged heal and forged AP rejection.

Commands run:

- `node tests/lionwing-enemy-simple-actions.mjs` — passed.
- `node tests/lionwing-enemy-base-attacks.mjs` — passed.
- `npm test` from `apps/companion` — all pretest suites passed, including the enemy regression; the main sequence then stopped at `build_automation_readiness.mjs --check` because the shared generated `AUTOMATION-READINESS.md` does not yet include S01. Regenerating it is outside this slice's ownership.
- Browser smoke test used the real Russian companion UI and confirmed the fully automated Russian card and 1 AP metadata. The persisted browser fixtures predate LionWing scene identity, so they correctly continued to use legacy Turn gating and were not treated as proof of the LionWing off-Turn route.

No mocked reducer or mocked persistence was used. The Node harness loads the production data, shared reducer, scene-actions adapter and LionWing engine in browser-compatible VM globals.

Not run: PDF visual comparison (asset absent), a two-client network session, and an English UI smoke test. Canonical English names/text and Russian localized cards were both inspected in source, but only the Russian app surface was exercised.

## Integration outside S01 ownership

The shared package/test registry must add `node apps/companion/tests/lionwing-enemy-simple-actions.mjs` to its normal test command. Any generated automation inventory/readiness artifact must be regenerated so these six rule IDs move from `assisted` to `full`. Those files are outside S01 ownership and were intentionally not edited.
