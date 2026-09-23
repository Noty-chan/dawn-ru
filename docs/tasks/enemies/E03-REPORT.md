# E03 — Martyr and Ronin turn passives

Base: `4ed5bc2` (working tree was clean before this task). This report covers a partial slice; neither NPC profile is marked complete.

## Mechanics brief

| Rule | Written in the LionWing source | Inferred from shared rules | Interface decision |
| --- | --- | --- | --- |
| Martyr Passive | At the end of each Round, restore 5 + Tier Health to this NPC. Canonical NPC: `lionwing.npc.martyr`; canonical source says PDF p. 121. | The existing heal reducer caps HP at `maxHp`. Recovery is round-scoped, not turn-scoped. The passive text does not define KO recovery; the implementation should not infer that healing revives a Knocked Out character. | No choice is named. Display the result at the round boundary; do not prompt. |
| Ronin Passive | Start each Turn with 1 additional AP, but this NPC can target the same character only once each Turn. Canonical NPC: `lionwing.npc.ronin`; PDF p. 116. | Reuse is keyed to the current Turn boundary, not the Round or Scene. A target list containing a previously targeted character is invalid even if it also names another character. Fodder Zones are not characters. | Do not block selecting a different character. Use the ordinary action/attack target picker. |

Examples: a Tier 1 Martyr with 6 missing HP would restore 6 at Round end; a Tier 3 Martyr with 3 missing HP could restore at most those 3 HP due to the cap. A Ronin can target Character A once, then Character B during the same Turn; it may target A again in a later Turn. Counterexample: applying Martyr recovery at every Turn end is wrong, and treating Ronin's restriction as one target per Round is wrong.

PDF text was checked from the available LionWing book at `D:\Dropzone\Downloads\DAWN_ The RPG (LionWing Edition) w Bookmarks.pdf`: physical PDF pages 116 and 121 (printed pages 115 and 120). Martyr's exact wording omits “to this NPC” in the PDF, while the canonical extraction includes it; both specify self-recovery. No visual/layout claim is made.

## Implemented and blocked

Implemented Ronin's per-Turn target guard in the existing event validator. It checks both `enemy.action.prepare` and `attack.pending` target IDs against this Ronin's logged character targets since its newest `turn.start`; the same target guard is independent of team, so an allied Ronin is covered. A mixed/multiple-target attack is rejected if any selected character repeats. The runtime already rejects multiple uses of the same Ronin action in a Round, so a direct second Dissect is not a valid player path; the regression exercises a successful real Dissect flow, then tries a fresh event ID through the real dispatcher with the previous target. It also verifies that another target passes the validator and the same target passes after a fresh Turn boundary.

The event path is UI selection in `scene-actions-ui.js` → `SceneEngine.prepareEnemyRule` → `commitSceneEvents` in `scene-ui.js` → `DAWN_SCENE_ENGINE.dispatchMany`. LionWing `dispatchMany` routes `enemy.action.prepare`/`attack.pending` through the existing event validator in `scene-events.js`. The new test reaches this path through the real loaded LionWing engine and dependencies.

Martyr recovery and Ronin's +1 AP at Turn start remain blocked at the shared writer seam. The LionWing wrapper handles `turn.start` and `round.end` itself; those event types do not enter the legacy `scene-triggers.js` dispatcher. Its legacy turn-start reducer is likewise not called by the LionWing command writer. The Ronin target restriction is connected, but AP-at-start and extra Turns have not been implemented. These runtime boundaries belong to `lionwing-engine.js`, currently owned by E02; do not merge a dead legacy trigger as completion. Required next seam: dispatchable LionWing Turn/Round boundary hook that derives and commits passive events/stats through the one writer. The integrator has been notified.

## Evidence and limits

- Targeted: `node apps/companion/tests/lionwing-enemy-turn-passives.mjs` — passed.
- The test loads `data.js`, canonical `edition-lionwing.js`, `lionwing-table-data.js`, the real scene engine modules and LionWing wrapper. It does not replace the writer, action preparer, reducer, or target validator with mocks.
- Covered in code/test: actual Turn start, successful Dissect dispatch and resolution, repeated single/mixed target rejection, alternate target acceptance, same target after a fresh boundary, stale version, reused old event ID, restored JSON state, allied Ronin, and a source-owned target choice.
- Not run: `npm test`, browser UI click-through, storage reload/import/export via app persistence, network/two-client verification, Martyr HP-cap/KO scenarios, Martyr boundary event, +1 AP including an extra Turn, and source removal during an active Turn. These depend on complete boundary integration; this report does not claim verified status.
- No code change was made to `lionwing-engine.js`, `scene-actions.js`, UI, package/index/service-worker files, generated files, or network code.
