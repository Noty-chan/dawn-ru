# Rules table responsiveness and reliability — 12 October 2026

## Scope and build

Base: `2092c39bad834572fbaf1e9fe0d43eb3a8bbec3e` (`origin/main`).
Branch: `codex/rules-table-polish-20261011`.
The [research and action plan](RULES_TABLE_POLISH_PLAN_2026-10-11.md) preceded
implementation. Three agents researched separate areas, implemented changes with
one owner per file, and reviewed each other's commits. Root performed browser QA.

Status: implemented and verified within the scope below. The final full test run
passed on `5130c4a085f3f10cab3a0987b162272af7e11462`; subsequent changes only
finalize this report and its documentation links.

This iteration applies the manual table's responsiveness and draft retention
work to the rules table. It does not expand Technique automation coverage.
SQL, RLS, Supabase configuration and existing user campaigns are unchanged.

## Changes

- The ruler updates its own cells and distance display without rebuilding the
  board, rerunning destination highlights or replacing the cockpit.
- The narrator cockpit retains dirty inputs, focus, open sections and scroll
  within the same actor, scene, room, policy epoch and access context. Untouched
  fields receive fresh canonical values; repaint does not submit an input change.
- Pending decisions, previews and basic actions precede collapsed parameters,
  inventory, saved dice and history. New copy is available in Russian and English.
- Player commands remain pending after INSERT. They unlock on rejection, or after
  application plus a fresh canonical read. Same-actor controls explain the wait
  and block another submission. Recovery reuses the exact envelope with bounded
  probes and preserves transport backoff; resources are not spent optimistically.
- Item/clock identity no longer becomes event identity. Independent intentional
  uses are distinct, while exact delivery retries remain idempotent.
- New rules intentions carry the confirmed policy epoch. Stale or invalid epochs
  are rejected before mechanical preparation. Manual intentions retain their
  existing contract. Backup/reset refusal also clears the local ruler display.
- Space on a cockpit section header retains native disclosure behavior instead
  of activating camera pan; Space on the board still pans normally.

## Native browser evidence

Chrome, separate fresh narrator/player profiles, local repository assets served
at `127.0.0.1:8893` for the baseline and `127.0.0.1:8894` for final QA. The final
source server used service worker bypass and disabled browser cache via CDP.
Interactions used native Playwright clicks, pointer movement and keyboard input;
canonical Scene/store objects were not injected to manufacture outcomes.

### Ruler before and after

Matched recreated 7×7 table, one Hero and one Assassin, prepared Stride,
1280×720 viewport, 24 native cell hovers. Temporary counters observed production
render functions and were removed after measurement.

| Local measurement | Base | Changed code |
| --- | ---: | ---: |
| Hover handler p50 | 222.8 ms | 1.7 ms |
| Hover handler p95 | 236.3 ms | 3.2 ms |
| Full scene renders | 24 | 0 |
| Board renders | 24 | 0 |
| Destination highlight passes | 24 | 0 |
| Original cell/cockpit input retained | No | Yes |

Both runs kept canonical resources/version unchanged, retained the prepared
Stride and displayed the same distance (8 spaces). These are local handler
measurements, not network latency, exact paint time or a fleet-wide performance
guarantee. Two-animation-frame upper bounds were 252.9 ms versus 18.0 ms at p95.

### Basic play and two independent clients

- Local UI: add Hero/Assassin, cancel the start preview, start rules combat,
  Breathe, end Hero/NPC turns, start Round 2, perform Stride, cancel a new
  destination selection before commitment, and reload. Stride committed once
  with its normal segmented movement semantics; cancellation spent nothing.
- A new isolated campaign, `Rules Polish QA 20261012`, was created through the
  interface. The independent player joined by invitation and published the
  English Hero sheet. Both clients reached `online` with their distinct roles.
- A start preview invalidated by a concurrent scene update disabled confirmation
  and requested a fresh preview. Reopening allowed the actual rules start;
  the player received policy epoch 1 and the same active Hero.
- The player's real `scene_commands` POST was held for 3 seconds, then forwarded
  to Supabase. During the hold, version 4 / AP 3 / Focus 2 / HP 16 stayed unchanged,
  the pending count was 1, all basic action controls were disabled, and the English
  explanation was visible. A native repeat click was blocked. There was one
  submitted intent, carrying base version 4 and policy epoch 1.
- After authority application and canonical refresh, both clients had version 7,
  AP 2 / Focus 3 / HP 16 and no pending command. The narrator's focused draft input
  still contained `1` with its section open, while the canonical Hero Focus was 3.
  Both clients restored that battle and those resources after reload. The
  disposable campaign was deleted through its owner UI after QA; the deletion
  notice and its removal from the owner's saved tables were verified.
- At 390×844, the player selected the Hero and opened the mobile Action panel.
  Basic cards fit within the viewport (document width 390 px); saved dice stayed
  collapsed. The new English labels were visible with reduced motion enabled.
  Native Space now opens and closes the Parameters section after correcting the
  camera shortcut interception; Enter also works. The Russian Parameters and
  Basic actions labels were verified at the same width without resource changes.

## Automated and independent review evidence

Production helpers execute inside DOM/VM fixtures for the fault matrix; this is
separate from the real two-client evidence above. Covered paths include held and
accepted INSERTs, snapshot/ack ordering, unrelated/stale snapshots, rejection,
lost notifications, exact retries, bounded probes/timeouts, reconnect and late
responses after scope loss. Inventory/reaction locks preserve their original
costs. Two uses of a stack give 3→2→1; replay does not spend again. Policy changes
from epoch 4→5→6 reject an old intention before prepare and preserve AP/Focus.

Independent reviews passed for ruler/pointer routing, cockpit retention and
pending controls, command identity, policy epoch validation and the adapted
persistence/reconnect test fixtures. The latter changes supply existing production
dependencies or preserve contract assertions; they do not change game behavior.

Final full `npm test`: PASS (exit 0), Windows / Node 22.18.0, revision
`5130c4a085f3f10cab3a0987b162272af7e11462`. This includes manual table regressions
and the final GM AP contract / alpha stress checks. Branch `git diff --check`:
PASS. Generated enemy inventory evidence was refreshed with its normal generator;
the final refresh produced no further changes.
Windows cannot run the file-symlink regression without symlink permission; the
existing suite reports that limit and Linux CI executes that case.
The optional legacy Raasha exact-sheet fixture was not supplied; its case reports
a skip while the shared UI assertions execute.

## Limits

This is a scoped first iteration, not complete rules automation or a deployment
claim. The live network check covers entry, sheet publication, rules start and one
delayed basic action, not every Technique, reaction or network failure permutation.
The failure matrix and role/context changes use controlled fixtures. Numeric
input focus was checked natively; text caret ranges were checked in the DOM fixture.
The changed copy was checked separately from legacy untranslated UI strings.

Legacy rules intentions without an epoch are accepted only at canonical epoch 0.
Players running older frontend code must reload after a policy change. Resuming a
frozen rules battle through manual mode retains its existing guard. No new fallback
was added for a hypothesized stale post-application SQL snapshot without real
transport evidence.

Temporary scripts, screenshots, metric JSON and logs are in ignored
`apps/companion/output/playwright`; private QA invitation material is excluded
from commits and the report. The private invitation script was removed, and both
task-owned browser sessions and local source servers were closed after QA.
