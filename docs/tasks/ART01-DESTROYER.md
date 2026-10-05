# ART01 scene artwork destroyer report

Base `4ed5bc2`; original target `23b03aac7c4a7ee9851da9f9ed747328246222aa`.
Recheck commit `2c1d344d2ac510d05170a920331cc97861eedd12`.
Status: **connected**. The production normalizer and upload/persistence path are
wired. This recheck did not reach a real browser or real IndexedDB; do not mark
verified.

## Recheck of duplicate-ID finding

The earlier P2 counterexample is closed at the identity boundary. `sceneCore`
now tracks seen artwork IDs and regenerates duplicates before deriving media
keys. `normalizeGmLibrary` also runs each encounter's `templateScene` through
`sceneCore`, so duplicate IDs within one preset are handled the same way. The
new recovery stress assertion checks that both artworks survive normalization
with distinct IDs. This closes the earlier two-valid-image counterexample, but
does not prove the browser persistence path.

## Checks

- `node tests/lionwing-recovery-stress.mjs` — passed, including the new duplicate
  ID assertion, scene/preset IDB writes, reload hydration and backup export.
- `node tests/lionwing-recovery-r10.mjs` — passed.
- `npm test` — stopped in `pretest` at `lionwing-enemy-inventory.mjs`; generated
  S00 inventory remains stale relative to concurrent enemy changes. Recovery
  tests were run directly and passed.
- Browser attempt — CUA reported no connected browser and rejected `iab` as
  unavailable. A local static server on `127.0.0.1:8765` was started and stopped
  after that failure. No existing user tab was opened or changed.
- Not run: real-browser upload/save/reload/delete/replace/undo, preset
  export/import round trip, real IndexedDB quota/unavailable behavior,
  missing-key recovery UI, two-client synchronization and player projection.

No runtime or other agent files were changed.
