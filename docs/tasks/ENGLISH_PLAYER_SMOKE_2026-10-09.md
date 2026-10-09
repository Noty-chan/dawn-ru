# English player entry and manual play — 2026-10-09

Published build: `dfea0a0a2fe601bcb5d2d7969a19f2b88ac8132c` (observed bootstrap URL).
Page: https://noty-chan.github.io/dawn-ru/companion/index.html?lang=en&edition=lionwing&mode=play

User requested an additional independent agent. Root used Chrome as Narrator; the agent used the in-app browser as a separate guest player. All writes were confined to the newly created `English Entry QA 20261009` campaign and the new `English QA Player` sheet. Existing user campaigns and personal sheets were not edited. No product code, SQL, or server configuration changes.

## Confirmed live checks

- Guest joined through the visible invitation flow without email/password and saw the Narrator's Assassin.
- New English QA Player was published and appeared on both clients with HP16/AP3/Focus2.
- Player keyboard HP `-1` gave15; AP−1 gave2; Focus+1 gave3. Narrator independently observed all three canonical values.
- Narrator changed HP to16, Focus to4 and advanced Round1→2/Tension0→1. Player observed these after reload; Narrator reload preserved HP16/AP2/Focus4.
- Later Narrator HP14/Focus5 appeared on the player's sheet. Immediate passive repaint was not independently established; the agent observed older values initially and newer values after another UI action.
- Player Stress1 appeared in the Narrator's journal.
- Narrator public4D6 result and independent player public3D6 result both reached the shared journal. Player3D6 produced5,5,6,4→4hits (extra die from explosion).
- GM English Assassin Reader showed all four sections and English rule text, personal marks, counters, and area controls.
- GM added English QA Progress clock and advanced it to1/6; player saw it read-only.
- Player could not edit the Assassin's resources; its Reader explained in English that abilities are available to the Narrator. This confirms the observed basic permission boundary.

## Problems and limits

1. **English entry is not fully localized.** Dock labels, campaign connection/account forms, invitation/publish buttons, and several status messages remain Russian while the page is EN. An English-only newcomer needs assistance to complete entry; functional join PASS does not mean English onboarding PASS.
2. **Generated invitation omits language/edition.** It contains mode and invite only. The agent's existing EN/LionWing preference survived navigation; default behavior on genuinely empty storage was not tested. Do not claim a fresh recipient necessarily opens in English.
3. **Initial sheet binding/repaint was stale.** After first publication the table showed15/AP2/Focus3, while the player's Sheet showed16/AP3/Focus2, no live-table indicator, and Saving. Reload restored linked16/AP2/Focus4. This observation is a candidate UI binding/refresh defect; no canonical resource loss was demonstrated.
4. Hero-sheet attribute roll succeeded locally but was absent from the Narrator's public journal. Table→Dice public roll was delivered. These are distinct routes; the sheet roll was not counted as public-roll PASS.
5. One Narrator typing operation immediately after a resource command was interrupted by a changed/focused target. The field held an uncommitted minus; absolute14 was then entered and verified. This is not sufficient evidence of a draft regression.
6. Player drag A1→B2 did not establish token movement; token remainedA1. No alternative move control was visible. Own movement is NOT VERIFIED, not a proven policy or movement bug.
7. The English sheet displays a literal `{limit}` placeholder in the pinned-rules explanation.

This is a desktop basic manual-play smoke with one Narrator and one independent player, not a full automation, mobile, multiple-player, reconnect-fault, or fresh-storage acceptance run. Private account data and invitation credentials are excluded from this report and screenshots.

Evidence screenshots are local ignored artifacts in `apps/companion/output/`: `english-gm-live.png`, `english-gm-enemy-reader.png`, `english-player-smoke-resources.png`, `english-player-smoke-sheet.png`, `english-player-smoke-enemy.png`, and `english-player-smoke-final.png`.

Both Narrator and player disconnected from the QA campaign after verification; campaign and test sheet are retained for follow-up. Player observed the connection lobby with no active campaign/Leave control. The final player screenshot was visually reviewed. The separate `english-player-smoke-table.png` contains a delayed paint and is excluded from value proof.

## Fixes after the smoke

- Localized the shared-table entry, account, publication, invitation, reconnect, leave, status and dock controls in EN/RU. Invitations now retain the selected language and edition.
- Incoming Scene snapshots refresh all visible Hero-sheet resources and its live-table indicator without rebuilding the sheet or disturbing focused controls.
- Added an explicit Player Move route for manual tables. Both selection and command submission enforce ownership; automatic rules tables retain their existing movement restrictions.
- Resolved the pinned-rules `{limit}` placeholder and localized default Scene/Main board display names without rewriting saved or custom names.
- Regression checks cover remote sheet refresh, manual owned movement, rejected foreign movement, transition back to rules, invitation parameters and language switching. The repository test sequence passed in resumed segments after updating locale-aware test harnesses and regenerating the inventory's test-reference list. Live verification of the fixes is recorded separately below when complete.
