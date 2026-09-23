# LionWing scenes with old modifier profiles

Old `enemy.modifier.*` profiles used different rules and save state from the canonical LionWing `lionwing.modifier.*` profiles. A generic conversion would change a battle's meaning; some information, such as the Host for old Vortex, is absent from the saved scene.

LionWing scenes containing an old modifier remain viewable and exportable, including their history. Scene edits and event dispatch are blocked with a message to create a new LionWing scene. Scenes from the Russian 0.9 edition retain their old profiles and mechanics.

The gate is enforced in the shared scene engine, table edit validation, and local/shared UI submission paths. The scene view also shows the block message. Verification: `node apps/companion/tests/lionwing-modifier-legacy-scene.mjs`.
