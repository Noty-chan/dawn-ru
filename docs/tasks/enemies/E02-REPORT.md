# E02 — LionWing simple enemy actions

Base: `4ed5bc205855236daf2fd923b567a9eb63fd92ea`  
Working status: **connected** for Heal, Gloat, Lick The Knife, and the unprotected Stabilize case. The complete Healer, Daredevil, Viper, and Oni profiles are not verified; browser and network acceptance remain open.

## Mechanics brief

Sources reviewed: canonical English `source/editions/dawn-en-lionwing-cb2f8e67/canonical/core-rules.json` and the visually inspected LionWing PDF. The canonical extracted rules identify physical PDF pages; printed page numbers are one lower in the reviewed pages.

| Rule | Written in the source | Derived from shared rules/runtime | Interface decision |
| --- | --- | --- | --- |
| Healer — Heal (`lionwing.npc.healer.heal`) | Restore 2 + Tier Health to an ally within 3 spaces; double the healing for this NPC’s Guardian. PDF physical 121 / printed 120. | The ally definition excludes the user. A standard Action costs 1 AP and is tracked once per Round; healing is capped at effective maximum Health by the authoritative heal operation. | One selected ally is required. The Guardian multiplier is recalculated at preparation and rechecked by the writer. |
| Daredevil — Gloat (`lionwing.npc.daredevil.gloat`) | Increase Tension by 1. PDF physical 123 / printed 122. | Tension is the shared scene meter. The action costs 1 AP under the existing enemy action contract. | No target picker. The action changes the meter through the LionWing command dispatcher inside the scene commit path. |
| Viper — Lick The Knife (`lionwing.npc.viper.lick-the-knife`) | Deal damage to each Blighted player equal to the number of Blighted players + Tier. PDF physical 116 / printed 115. | “Players” resolves to player characters (`kind: hero` or `heroId`), not Blighted NPCs. Only living, currently Blighted player characters are counted and hit. This is damage, not an Attack: it does not use Attack Armor, while ordinary damage still depletes Evasion. | Targets are derived from the current scene; the UI does not ask the Narrator to select a subset. One damage event is resolved per target with the same count-based amount. |
| Oni — Stabilize (`lionwing.npc.oni.stabilize`) | Lose this NPC’s Effects and Hasten it. PDF physical 119 / printed 118. | Effect removal uses the existing protected-source rules. The action costs 1 AP. No code here treats `removable: false` as permission to bypass protection. | All removable effects are removed, then Haste is applied. If any source is protected, preparation refuses before payment. This is deliberately partial pending a canonical resolution of that edge case. |

Two play examples: a Tier 2 Healer restores 4 Health to its Guardian for 8 total before the target’s max-Health cap; if there are two living Blighted player characters, a Tier 2 Viper deals 4 damage to each of those two characters. A counterexample: an NPC ally with Blight does not increase Lick The Knife’s count and is not hit; likewise, a Healer cannot target itself merely because it shares the Healer’s team.

The PDF and canonical text agree on these four action descriptions. Viper’s “players” scope follows the canonical core distinction between player characters and NPCs. Evasion remains in the regular damage path. Armor applies only when the incoming damage is an Attack; the engine now preserves an explicit `attack: false` flag even when `sourceActionId` is present.

## Runtime and evidence

Production selection is in `scene-actions-ui.js` (`handleEnemyRule`): NPC card → `SceneEngine.availableEnemyRules` → `prepareEnemyRule` → `commitSceneEvents`. The sole UI commit writer is `scene-ui.js` `commitSceneEvents`, which calls `SceneEngine.dispatchMany` with `expectedVersion`, then normalizes, journals undo state, persists, and renders. `lionwing-engine.js` validates these four canonical action payloads before the batch reaches the shared reducer. Gloat’s meter mutation and Lick’s non-Attack damage are executed in that same LionWing dispatcher; no second UI writer or direct scene mutation was added.

The full-runtime test loads `data.js`, `edition-lionwing.js`, `lionwing-table-data.js`, `logic.js`, and `load-scene-engine.mjs`. It covers Guardian healing and cap behavior, self-target refusal, allied NPC targeting, AP use, cancel-before-commit, forged Heal amount/cost, missing and KO Heal targets, Gloat meter change plus stale/replay, Lick target derivation/count/formula, NPC and unblighted exclusions, normal Attack Armor versus non-Attack damage, Evasion depletion, forged Lick payload, KO after preview, JSON save/reload and export/import, Stabilize effect removal, and protected-source refusal/forgery.

Validation run:

- `node --check lionwing-engine.js` — pass.
- `node tests/lionwing-enemy-simple-wave.mjs` — pass.
- `git diff --check -- apps/companion/scene-actions.js apps/companion/lionwing-engine.js apps/companion/scene-actions-ui.js` — pass.

Not run here: full `npm test` (integration owner will regenerate the registry and run it); browser clicks in RU/EN; two-client network synchronization; visual undo controls. No mocks replace the engine, source data, event reducer, or persistence object model in the targeted integration test. JSON serialization checks exercise reload/export shape, not a browser reload or download/import UI.

Remaining boundaries: the Daredevil’s separate Passive movement/damage on any Tension increase is not implemented or verified in this slice; Gloat’s +1 Tension is connected. Oni Stabilize is partial for protected Effect sources. None of the four profiles is marked fully automated. The PDF source is external to the repository at `D:/Dropzone/Downloads/DAWN_ The RPG (LionWing Edition) w Bookmarks.pdf`; reviewed pages were rendered read-only to a temp directory.
