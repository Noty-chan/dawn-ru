# LionWing Blaze implementation

Canonical source: LionWing PDF p. 126, `lionwing.modifier.blaze`.

- Blaze attaches to an ordinary enemy Host, grants two Speed while active, and saves one selected effect: Burn, Freeze, Accelerate, or Toughen.
- A Host primary NPC Attack triggers the selected effect when its recorded roll has at least ceil(Tier / 2) Critical Hits.
- Burn adds Tier damage through the existing attack and reaction pipeline and adds one space of push to the attack's displacement. Freeze Slows its targets, or Immobilizes a target already Slowed. Accelerate Hastens and Strengthens the Host. Toughen Reinforces and Strengthens the Host.
- An attached modifier does not count as a character when the Assassin checks whether its target has adjacent characters. Host Knock Out deactivates the attachment.

Verification: `node apps/companion/tests/lionwing-modifier-blaze.mjs` tests all four modes, Speed, the Critical threshold, and Freeze escalation.
