# Automatic table response, 14 October 2026

Base: `1368b6fe71fef0b9ee714eb42906361da3ff2167` (merged PR21).
Branch: `codex/auto-response-20261013`.

## Changes

- Rules metadata queries copy their actual state inputs instead of scene media and geometry. Mechanical journals, receipts and migration counters remain intact. Read-only aura/turn guards no longer normalize the caller's actor aliases.
- Destination queries omit only known presentation media and local UI history from their disposable input. Full prepare, dispatch, canonical validators and returned execution scenes retain their contracts and media.
- Enabled adapter candidates use a private static index with fresh learned levels and opt-ins. Registry order, inherited switches, live restored/information providers and all canonical technique levels remain covered.
- Drafts compare current scene values instead of relying only on version. Resource, equipment, geometry, receipt and ownership edits invalidate obsolete results. Proven presentation fields are excluded so measurement/tool, locale and view changes preserve exact rolls. Targets are filtered for Player visibility.
- Automatic action buttons reuse the current presentation gate. Confirm clears its private draft before a synchronous canonical write, avoiding the second full render; immediate refusal retains a retryable draft.
- Reaction, cancel and resolve controls bind to their actual Attack in the cockpit, core sheet and phase bar. Queued requests include the optional Attack ID, which the canonical core rechecks. Earlier unstamped callers retain compatibility. Transport and database code are unchanged.
- Palette observers ignore unrelated board/log/card updates while retaining late tools, relocation and locale updates. Unchanged selection/geometry avoids duplicate attribute and style writes. The hidden desktop mobile bar avoids compound queries; mobile selection and clicks filter hidden/current-space actors.

## Validation and measurements

Full `npm test` completed with `TEST_EXIT=0` on the frozen implementation. The response chain contains 13 suites; existing workspace/core/family/network fixture and alpha stress checks also passed. Generated enemy inventory was rebuilt by its generator; `git diff --check` passed.

Evidence: `../../tasks/assets/auto-response-20261013/`.

| Production CPU fixture vs base | Before | After |
| --- | ---: | ---: |
| All 144 Step destinations, 12x12 / 20 actors | 523.61 ms | 219.89 ms |
| Same workload with 100 KB art, 20 portraits at 30 KB, bounded UI history | 1454.20 ms | 212.15 ms |
| Action roster with media/history | 23.77 ms | 0.51 ms |
| Turn roster with media/history | 35.64 ms | 2.64 ms |
| 100 unrelated DOM mutation batches: global palette searches | 1800 | 0 |
| 100 unchanged category selections: attribute writes | 600 | 0 |

These are CPU/DOM fixtures, not browser FPS or network latency. Destination outputs were compared against the base across terrain, walls, topology, Immobilized/Haste, continuation and Speed Demon hooks. Every technique level 1–3, mixed rule order, dynamic providers, frozen legacy normalization and malformed diagnostic behavior have regressions.

Disposable native UI checks covered rules startup, Step highlighting/payment, NPC Attack, Hero Block/payment/forced movement, resolution and journal; no browser errors were observed. On 390x844, controls reserved 81 px for their measured 80.8 px height and the Player's foreign-actor action was disabled. Screenshot: `../../tasks/assets/auto-response-20261013/mobile-player.png`. Hidden-player source filtering and stale retained controls are additionally covered by production-handler fixtures. No live multiplayer room was changed; this pass does not claim a fresh two-client network run.

## Next measured work

Full canonical prepare still runs for every destination (~212 ms / 144 queries in this fixture). Further improvements require profiling or an isolated read-only worker/batch proof; replacing it with a geometric approximation is not accepted. Additional work will use a new checkpoint rather than changing this validated snapshot.
