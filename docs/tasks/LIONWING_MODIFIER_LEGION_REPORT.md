# LionWing Legion implementation

Canonical source: LionWing PDF p. 127, `lionwing.modifier.legion`.

- Deployment creates a persistent scene clock with one segment per deployed PC plus the modifier Tier. It cannot be redeployed to reset progress.
- A knocked out, ordinary non-Fodder, non-Compound enemy fills one segment. A full clock knocks out the remaining ordinary enemies. Restore events do not fill the clock.
- At round start, up to the new Tension in knocked out ordinary enemies return at half maximum Health on vacant board-edge cells. If fewer can return, vacant edge cells receive Fodder Zones for the difference.
- A full clock prevents future returns. Active enemy presence is required for the round-start return.

The scene currently has no first-class combat outcome event. The clock collapse knocks out ordinary enemies, leaving combat resolution to the existing scene flow. A board with fewer vacant edge cells than required cannot place every replacement zone.

Verification: `node apps/companion/tests/lionwing-modifier-legion.mjs` and `npm test` in `apps/companion`.
