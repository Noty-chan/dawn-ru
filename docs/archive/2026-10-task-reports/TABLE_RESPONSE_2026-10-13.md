# Table response and inline cleanup, 13 October 2026

Base: `origin/main` at `9c48a3619c2251a7389cfaf46b77bc1175d31d0e`.
Branch: `codex/table-response-20261012`. First checkpoint: `a7221e6`.

## Delivered behavior

- Scene writes retain bounded local undo history without repeatedly normalizing historical scenes. Exact replay performs no save, render or FX. Canonical LionWing receipts and mechanical journals remain intact.
- Engine, information and inventory queries avoid copying unrelated UI history, media and nested journals. Output detachment, reservations, source ownership and same-object updates remain covered.
- Board rendering indexes spatial/deployment data once. Preview updates touch changed cells and reject stale drop scopes. Canonical destination checks and player visibility are preserved.
- Manual tables skip hidden automatic Director, Utility, Flow, Tray and TurnStrip work. Switching to rules rebuilds current gates. Public dice feedback and the manual journal remain available.
- Manual journals reuse two locale formatters. Unchanged reference cards, labels and layouts avoid DOM replacement; dependencies are evaluated from current data.
- Numeric updates preserve pressed buttons through dirty HP/AP blur and change. Pending receipts settle only for matching commands. Repeated HP after Undo remains editable; token counters bind to the same visible fallback actor as Health.
- Erase removes environment beneath tokens, offers inline object/layer controls and keeps participants. Layer, field, NPC and full-table cleanup use inline confirmation, cancellation and recovery. Structural Undo also confirms inline. Cleanup expires on rights, room, policy, version or pending-work changes.
- Search/preview work coalesces per frame; passive camera rendering does not save. Asynchronous media edits check the originating hero and generation.

## Evidence and limits

Raw evidence is in `../../tasks/assets/table-response-20261012/`.

| Measured workload | Before | After |
| --- | ---: | ---: |
| Event reducer + normalization, 100 KB art and bounded history, median | 15.49 ms | 0.79 ms |
| 49 canonical Jump queries, same outputs, median | 539.38 ms | 37.90 ms |
| Info/Inventory panel + 16 item statuses, 7x7/2 actors, median vs first checkpoint | 2274.02 ms | 3.16 ms |
| Same panel workload, 12x12/24 actors | 2390.88 ms | 8.34 ms |
| 122 manual journal rows, 10 redraws, representative test run | 53.76 ms | 2.44 ms |

These are local CPU fixtures, not network latency, browser FPS or a universal interaction-speed guarantee. Native browser profiling identified hidden automatic work; instrumentation and background-frame scheduling make those samples unsuitable for a precise end-to-end before/after claim.

Native disposable-local UI checks covered overlapping-object removal, layer cleanup/cancel/reload, full reset/recovery, structural Undo, and dirty Health followed by Focus+ and dirty AP followed by AP+. No live room was edited. UI screenshot: `../../tasks/assets/table-response-20261012/inline-cleanup.png`.

Final validation: full `npm test` completed with `TEST_EXIT=0` after the receipt and fallback-actor fixes; `git diff --check` passed.

The response regression chain contains nine suites and runs before the existing test suite. It covers canonical equivalence, immutable inputs/outputs, privacy, current-state dependencies, replay, undo, async scope changes and actual production numeric handlers. The generated enemy inventory was rebuilt from its generator.

## Remaining verification scope

No Supabase, sync transport or room configuration changed. New receipt reconciliation is exercised through production workspace handlers with mocked transport; this pass does not claim a fresh two-client network or mobile-browser acceptance run. Geometry execution and reducer rollback snapshots retain their full-scene contracts. Broad board DOM reuse was deferred because overlay ownership has not been proven safe.
