# LionWing Vortex implementation

Canonical source: LionWing PDF p. 127, `lionwing.modifier.vortex`.

- Vortex attaches to an ordinary enemy Host. The Host gains 1 + Tier Armor while the attachment is active.
- Each round end creates five Fodder Zones on the farthest edge or edges from the Host, subject to vacant cells. Their movement can only reduce distance to the Host.
- A Zone touching the Host is knocked out and adds one Armor to the Host for the rest of the Scene. The modifier counts absorptions in persisted state; the third deals 20 + 2 × Tier damage to all live PCs once.
- Spawn and absorption events check current Host, round boundary, moving Zone and source, preventing extra Zones and repeated absorption of one Zone.

Verification: `node apps/companion/tests/lionwing-modifier-vortex.mjs` exercises attachment, edge spawning, movement absorption, Armor and third absorption damage.
