# Automatic table: input, decisions and asynchronous media

Base: main `42dd14b`, after the automatic-query performance pass. Pages checkout history was separately repaired in PR #23; deployment of `9f6f67b` succeeded.

## Changes

- Accepted native commands with no visual consequence events now install their new canonical state. The previous `events.length === 0` shortcut dropped manual decision prompts. Exact replays retain the version and still perform no save, render or history write.
- Decision and Duel fields, caret and disclosure keys include the pending-window identity. Same-window drafts survive refreshes, unrelated drafts survive new decisions, and expired decision drafts are pruned.
- Local Player views suppress hidden owners, private decision content and hidden participants in continuation summaries.
- Scene art/token/portrait uploads bind their initial file and form, actor identity, authority, room and lifecycle generation. New uploads supersede older ones; explicit clears invalidate them. Room roundtrips, accepted history restoration, backup restoration and role loss cancel late jobs. Ordinary same-room HP refreshes remain valid.
- Artwork count and media byte limits are checked after every awaited stage and immediately before commit. Writer refusal and edited/newer forms preserve inputs.
- Only the damage amount input runs the damage preview. Note, dice label and unrelated input preserve their bookkeeping without re-running this reducer; Focus still refreshes action quotes.
- The read-only owner-turn counter reader avoids temporary arrays while retaining raw property-read order, Number conversion order, exceptions, malformed-value behavior and signed zero. Reducer normalization is unchanged.

## Evidence and limits

New production fixtures cover metadata-only writes/replay, sequential same-owner decisions and Duels, hidden participant privacy, asynchronous decode/storage races, room and role roundtrips, exact same-identity restoration, capacities and writer rejection. The counter oracle includes 1,687 cases plus accessor/coercion traces, errors, frozen values, arrays, Symbols, BigInts and signed zero.

Input fixture: 32 unrelated preview calls became zero; eight-character batches previously took about 64–74 ms and now 0.06–0.16 ms in the VM workload. This measures handler CPU, not browser paint.

Counter benchmarks are noisy: a repeated paired full Step workload measured 257→212 ms, another 222→211 ms, and the first run regressed 244→270 ms. The isolated million-read comparison measured 1,150→992 ms. No FPS claim is made.

Native browser QA on an isolated localhost table reproduced the discarded decision before the writer repair, then verified creation and answering of the first decision, preservation of its note through target clearing, and an empty note on a subsequent independent decision. Same-owner/Duel caret isolation is additionally checked by the actual-core fixture. No live user table was changed.

Chunked destination calculation and worker prototypes remain local QA experiments; production still uses complete synchronous validators. A stale artwork job can leave an orphan local media-storage key after a completed storage write, but cannot modify the current scene or clear its form.

Isolated native browser prototype: synchronous 144-cell calculation completed in 149 ms with a 159 ms timer gap; 6 ms chunks completed in 289 ms with a 23 ms timer gap and 7.7 ms largest chunk. Both matched all 144 canonical answers. This demonstrates an input-scheduling tradeoff; the slower completion is why the prototype is not shipped in this pass.

Final verification status is recorded in the commit/PR after the full suite completes.
