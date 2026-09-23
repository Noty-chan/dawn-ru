# LionWing Gargantuan implementation

Canonical source: LionWing PDF p. 126, `lionwing.modifier.gargantuan`.

- Attachment grants Tier Armor and 5 + 5 × Tier Evasion, makes the Host and connected Parts immobile, and expands a standard 7 × 7 board by one edge. The added body cells redirect targeting to the Host.
- The added Attack costs one Host AP, accepts one or two 2 × 2 Zones, rolls 4 + Tier dice, destroys terrain in those Zones, moves affected characters to vacant cells outside them, deals Hits + Tension damage only to moved characters, removes its previous terrain and creates new terrain. The new terrain redirects targeting to the Host and can provide range.
- Repeated attacks are available while the Host has AP. The attack rejects a selected area if it cannot make room for every affected character.

Verification: `node apps/companion/tests/lionwing-modifier-gargantuan.mjs` covers expansion, defenses, Host redirect, terrain replacement, displacement, damage and AP.
