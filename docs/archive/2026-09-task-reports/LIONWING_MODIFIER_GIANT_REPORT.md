# LionWing Giant implementation

Canonical source: LionWing PDF p. 127, `lionwing.modifier.giant`.

- Giant attaches to an ordinary enemy Host, grants Tier Armor and one Speed while active, and changes the Host footprint to 2 × 2.
- Its added Attack costs one Host AP and moves the Host one to four spaces in a straight line. It may cross opponents, pushing each crossed opponent to a vacant cell adjacent to the destination footprint and Launching them.
- The attack can be used again during the Host's turn while AP remains. Wall, removed cell and allied occupation checks still apply.
- Escape cell selection accounts for full footprints of occupied actors.

Verification: `node apps/companion/tests/lionwing-modifier-giant.mjs` checks footprint, stat bonuses, charge, push, Launch, AP cost and repeat availability.
