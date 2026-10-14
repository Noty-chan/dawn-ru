# Automatic table smoothness, second pass

Base main: `2501c8d`, PR24 deployment confirmed successful. Branch: `codex/automatic-smoothness-20261014`.

Changes:

- A detached destination query shares its source and initial metadata while retaining full canonical prepare/commit for every cell. Mutable normalization providers use fresh copies. Provider identity, methods, Set membership, accessors and mid-request changes have regressions; disposal releases the captured scene.
- Board destination highlights run in approximately 6 ms presentation tasks via MessageChannel, with a timer fallback. Current scene values, room, authority, selection and private draft identity cancel stale jobs. Reentrant provider creation/disposal cannot erase a replacement. Every click still uses current canonical validation and pays once.
- Closed Director, sheet, utility, reference, add and entity panels skip heavy render work. Opening paints current values; open panels refresh once. Role/room changes clear private content and pending jobs. Geometry reconciliation remains independent of the Director.
- Sheet retention follows dirty fields and stable roll/die/window/actor identities. Untouched canonical die faces update, and locked/file/read-only controls never inherit stale drafts.
- Space activates a focused gridcell without entering camera pan; Escape clears private native previews with one render.
- Import/recovery jobs bind room, authority, lifecycle and canonical values across awaits. Obsolete jobs preserve the file and cannot overwrite another table. Recovery chooses the newest valid checkpoint across IndexedDB/localStorage; successful-backend metadata resolves equal timestamps.

Evidence:

- 2,926 destination availability/reason oracles against released code, plus mutable-provider/error-priority scenarios. Complete validators remain authoritative.
- Actual isolated native UI, 7x7/two actors: eight selections took 409.6→189.6 ms inside scene handlers; closed heavy panels rendered eight times before and zero afterwards. This includes a QA profiler and is not a general FPS claim.
- Native Step produced seven valid cells; Space moved the NPC F1→F2, continuation distance 2→1, AP remained 1, no browser errors.
- Isolated 144-cell yield prototype: sync 96 ms/timer gap99 ms; MessageChannel 111 ms/gap21 ms. A full-app cold Step also showed a 104 ms timer gap, so these isolated scheduling results must not be advertised as a universal frame guarantee.
- Batch CPU before the final mid-request dependency recheck: 167→134 ms. That last guard was tested but not benchmarked again.
- Production fixtures cover asynchronous cancellation/replacement/privacy, lazy panels, fresh dice/dirty drafts, keyboard routing and 30 backup/storage scenarios.

At the 4% remaining-limit checkpoint all agents froze their files. Full `npm test` was started; final status is recorded separately in this report/PR after completion. Local log: `%TEMP%/dawn-smoothness-20261014.log`. Native/prototype evidence remains under `apps/companion/output/`. No live table, Supabase or transport implementation was changed. Reminder is paused; shutdown is cancelled.
