# D00 — Ranger adversarial audit

Baseline: `5648d66867108fdc021ec435f85211726c36d907` (runtime lineage requested as `7b496f5`).  Audit date: 2026-09-22.  Scope: LionWing `lionwing.npc.ranger` Nest, Take The Shot, Headshot, and Passive.  Runtime was read-only.

## Decision

Status: **connected, acceptance blocked**.  The production UI loads the canonical LionWing profile bridge and routes rule buttons through `prepareEnemyRule` to the single `commitSceneEvents` writer, but six relevant rule failures prevent `verified` and prevent calling the Ranger profile complete.  Network evidence is not present.

Production trace: roster/inspector buttons are rendered in `apps/companion/scene-ui.js:359,507,539`; `apps/companion/scene-actions-ui.js:286-287` calls `SceneEngine.prepareEnemyRule` and `commitSceneEvents`; `apps/companion/scene-ui.js:155` owns expected-version dispatch, version/result normalization, undo, persistence, rendering, and effects; LionWing routes through `apps/companion/lionwing-engine.js:4037,4219-4221`; `apps/companion/app-core.js:215,323,344-345` owns reload and table backup normalization.

## Mechanics brief

| Rule | Written in source | Derived from general runtime rule | UI decision |
| --- | --- | --- | --- |
| Passive | After this NPC is Attacked, it may move 1 space. Trigger is the completed Attack, not positive damage. Choice belongs to the Ranger controller. | An Attack reduced to zero by Evasion is still an Attack. Every attacked Ranger is an independent passive owner. A Compound is one target, but its Ranger part still contributes its profile rule. | Offer move/pass after `attack.clear`; placement is chosen on the board and limited to one space. |
| Nest | Become Steady and gain 1 Aim. Aim is lost when this NPC moves **on its Turn**. Aim adds 1 damage to all successful Attacks. | Off-turn, passive, forced, and reaction movement do not satisfy “on its Turn”. The attack must already be successful before Aim can add damage. State belongs to the Ranger and survives save/load. | One action button; preview remains pure; commit pays exactly 1 AP, applies Steady, and stores Aim. |
| Take The Shot | Character within 8; roll `5 + Tier`; add `Tier + 2` at distance at least 4 if enemies have not Attacked target this Round; reward `Hits + Tension`. | Typed target and current geometry are rechecked before commit. Evasion may reduce final damage to zero. Aim and Headshot are conditional post-hit additions, not a way to manufacture a hit. | Target picker, roll, reaction, and resolve use the shared attack pipeline. Cancel/rejection must not pay. |
| Headshot | At Tension threshold 2, choose any target. Next time this NPC's Attack hits that target, add Hits damage. | Threshold is availability, not a Tension spend. State is target-specific, one-shot only after a qualifying hit, and must not be consumed on a miss. Missing/removed target must not leave an actionable dangling reference. | Target choice is mandatory; commit pays exactly 2 AP and stores the target id. |

Examples: (1) Ranger uses Nest during its Turn, later moves during its own Turn: Aim clears. If the Ranger is moved by its Passive during another actor's Turn, Aim remains. (2) Headshot marks A; Ranger misses A after Evasion, then hits A on a later Attack: only the later hit gains and consumes the bonus. Counterexample: adding Headshot Hits before Evasion and letting that extra damage turn a miss into a hit is circular and violates “next time ... hits them”.

Source evidence: canonical EN is `source/editions/dawn-en-lionwing-cb2f8e67/canonical/core-rules.json:838-878`, with `pdfPage: 115`; the shipped browser data matches it at `apps/companion/edition-lionwing.js:7081-7100`. The named primary PDF `source/original/DAWN_ The RPG (LionWing Edition) w Bookmarks.pdf` is absent from this checkout and was not found under `C:\Users\AK-A-13\Documents`, so visual PDF-page verification is **not-run** rather than inferred from the legacy PDF.

## Findings

### P1 — LionWing Aim never adds damage

- Location: `apps/companion/scene-actions.js:36,1229`. The canonical family omits `aimDamage`; only the legacy Ranger family declares it.
- Repro: Nest or seed `enemyAim: 1`; prepare Take The Shot with one Hit, zero Tension, adjacent target. Pending damage is 1, expected 2.
- Expected/actual: a successful Attack receives +1 / canonical LionWing Take The Shot receives no Aim damage.
- Violated invariant: canonical edition adapter must connect every stored rule state to its stated consumer; legacy similarity is not a substitute.
- Regression evidence: `apps/companion/tests/lionwing-enemy-ranger-adversarial.mjs:115-121`, marked `KNOWN FAILING REPRODUCER` and deliberately not registered in `npm test`.

### P1 — Aim clears on movement outside the Ranger's Turn

- Location: `apps/companion/scene-triggers.js:1120`.
- Repro: gain Aim, set another actor active, move Ranger through its Passive/forced/off-turn move. Aim becomes 0.
- Expected/actual: Aim survives because the move is not on the Ranger's Turn / unconditional move trigger clears it.
- Violated invariant: source-qualified lifecycle boundary must use authoritative Turn ownership, not the mere presence of a movement event.
- Regression evidence: adversarial test `:109-114`.

### P1 — Headshot bonus can create the hit that qualifies it

- Location: `apps/companion/scene-actions.js:1230`; success is determined later in `apps/companion/scene-responses.js:1282-1292`.
- Repro: Headshot target has 3 Evasion; Take The Shot rolls 2 Hits at zero Tension. Base attack should miss, but preparation adds 2 Headshot damage before defense, final damage becomes 1, and the state is then consumed.
- Expected/actual: bonus applies only after the base Attack hits / bonus participates in deciding whether it hits.
- Violated invariant: a post-hit conditional cannot make its own predicate true.
- Regression evidence: adversarial test `:140-147`.

### P1 — one area Attack triggers only one Ranger Passive

- Location: `apps/companion/scene-triggers.js:1062-1063` uses `.find(...)` and emits one prompt.
- Repro: one Attack targets two independent Rangers, resolve it, inspect pending prompt/queue. Only the first Ranger gets a choice.
- Expected/actual: both attacked NPCs independently may move / only one passive owner is represented.
- Violated invariant: per-owner reactions must enumerate all affected owners and preserve their ordered choices.
- Regression evidence: adversarial test `:157-166`.

### P1 — Ranger Passive disappears when a Compound representative is another part

- Location: `apps/companion/scene-triggers.js:1062`; shared attack normalization canonicalizes a Compound to one representative before the trigger checks `profileId`.
- Repro: Compound has Bruiser first and Ranger second; Attack the Ranger part and resolve. No Ranger retreat prompt appears.
- Expected/actual: the Compound's Ranger part contributes its Passive when the Compound is Attacked / only representative profile is inspected.
- Violated invariant: Compound target normalization must not discard rules owned by constituent parts.
- Regression evidence: adversarial test `:168-177`.

### P2 — removed Headshot target leaves a persisted dangling id

- Location: `apps/companion/app-core.js:256` preserves any truthy `rangerHeadshotTargetId`; only a successful hit clears it at `apps/companion/scene-responses.js:1391`.
- Repro: designate a target, remove that actor, JSON reload/export-shaped round trip. Ranger still stores the removed id indefinitely.
- Expected/actual: target removal clears or safely expires the one-shot target / stale id persists with no lifecycle cleanup.
- Violated invariant: persistent source/target state must have an explicit source-loss/target-loss policy.
- Regression evidence: adversarial test `:179-184`.

## Passing evidence and mutation pack

The targeted harness uses the shipped `edition-lionwing.js`, `lionwing-table-data.js`, production engine modules, real validators/reducers, and real app-core normalizer/table-backup functions. It proves Nest pays once and applies Steady/state; Headshot pays 2 AP without spending Tension; selected target survives reload and table export/import; missing forged state is rejected; replayed event ids are idempotent; stale expected version is rejected; KO source cannot act; Passive still fires after Evasion reduces damage to zero; and an allied Ranger profile reaches the same adapter.

In-memory VM mutations left no checkout changes. Caught: Nest writer omission, Headshot writer duplication, and Headshot `targetId` loss. Version mutation is covered by stale expected-version rejection; repeated event mutation by idempotent replay; missing target by authoritative rejection; persistence loss by reload and table backup assertions. A private-projection mutation is N/A: Aim and Headshot target are ordinary public combat state in the current scene projection, not a secret choice. Network writer duplication/reconnect mutation is not-run because no two-client environment was used.

Command: `node apps/companion/tests/lionwing-enemy-ranger-adversarial.mjs` — pass, with six explicit known-failing reproducers quarantined inside the audit harness. These failures are evidence and the file is not added to the package test list.

## UI evidence

Actual local page `http://127.0.0.1:8765/?lang=ru&edition=lionwing&mode=play` loaded in the in-app browser. The production enemy roster visibly rendered automation badges, complete rule text affordances, AP/status metadata, and disabled actions while a real pending Reaction chain existed. This proves script loading and the production roster surface. The persisted fixture contained no Ranger and resetting/importing a Scene would alter user state, so a Ranger button click and RU/EN comparison are **not-run**. Browser UI status is therefore connected, not verified.

## Mocks and not-run

- Mocks/substitutes: none for writer, validator, reducer, canonical data, normalizer, or export/import. UI browser used existing local persisted scene. Test stubs inside the app-core extraction cover unrelated media/library helpers only; they never approve events or replace validation.
- Not-run: primary PDF visual page (file absent); real Ranger UI click in RU and EN; undo click through browser (engine/app-core state and production writer ownership traced, but destructive UI history action not performed); service-worker/offline refresh; two-client network/reconnect/private projection; `npm test` result recorded separately below.

## Verification

- `node apps/companion/tests/lionwing-enemy-ranger-adversarial.mjs` — pass; six known failures reproduced and quarantined; three source mutations caught.
- `npm test` from `apps/companion` — pass, including enemy-base-attacks, scene-engine, network-v2, alpha-stress, generated-map checks, and 391 unique rule ids.
- Initial `npm test` from repository root — not a product failure; no root `package.json`. The authoritative package command above passed.
- `git diff --check` — pass before commit.
