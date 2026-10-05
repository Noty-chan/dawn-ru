# LionWing Martial Artist / Skirmisher handoff — 2026-09-10

Branch: `codex/luna-martial-skirmisher`  
Canonical source: `source/editions/dawn-en-lionwing-cb2f8e67/extracted-companion.json` (English LionWing)

Implemented through the shared action, numeric, movement, damage, usage, and lifecycle seams:

- Martial Artist I: four optional Art Of The 8 Hammers follow ups, each once per Round; trusted catalogue tags enforce the weapon restriction.
- Martial Artist II: first Skirmish each Turn is Swift; Flow State offers Body/Talent fixed damage after a selected Hammer.
- Martial Artist III: +1 Advantage on attacks; a critical Skirmish/Finisher queues an additional Hammers trigger.
- Skirmisher I: Stride movement offers one free Swift Jab each Turn for fixed ceil(Talent/2) damage.
- Skirmisher II: a post-Skirmish straight movement choice up to two spaces uses the common movement planner.
- Skirmisher III: +1 Skirmish Advantage and an optional Rebound Jab after that movement against a target not attacked this Turn.

The registry and foundation maps mark Martial Artist I–II and Skirmisher I / III as decision coverage, Martial Artist III and Skirmisher II as partial coverage. The remaining manual surface is route placement UX for optional Quick Step / Shifting Blows destinations and deeper table handling for edge cases such as multiple targets and chained criticals; the command engine validates ownership, provenance, enabled level, geometry, usage scope, replay, and duplicate event IDs.

Contract coverage is in `apps/companion/tests/lionwing-martial-skirmisher.mjs`; run it with the existing family suite. Canonical source digests are enforced by the LionWing provenance test.
