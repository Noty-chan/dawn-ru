# LionWing Siren / Bombardier audit — 2026-09-10

## Каноническая база

Источником является английское извлечение LionWing из `source/editions/dawn-en-lionwing-cb2f8e67/canonical/archetypes/` и PDF, стр. 95 (Siren) и 98 (Bombardier). Русский overlay используется только как перевод. Старый compatibility snapshot `apps/companion/data.js` не является источником канона.

Новый LionWing PDF отсутствует в этом checkout: `source/original/Dawn - A Diceless Fantasy TTRPG.pdf` помечен pipeline как старый 0.9 и не используется для канонических утверждений. Его страницы были просмотрены только для проверки расхождения нумерации/содержания; они не подтверждают LionWing Siren/Bombardier. Поэтому здесь зафиксированы JSON extraction и digest-проверки, а визуальная подпись именно нового PDF остаётся внешней ручной проверкой.

Канонические формулировки уровней:

- **Siren I — “You wouldn't hurt ME, would you?”**: “Gain 3 Focus at the start of each Scene. After you Investigate an enemy, you may spend 1 Focus to Fear them.” Ограничения “3 раза за Сцену” в английском уровне нет.
- **Siren II — “I'm Irresistible!”**: “Once per Turn, after you Fear a character, you may force them to move up to 3 spaces towards you. If they move into adjacency with you, you may Daze them and gain 1 Focus.”
- **Siren III — “A little help over here?”**: “After you Spirit or Mind Finisher a character, you may have all enemies affected by Fear move their Speed towards your target and deal [Tier] damage to them if they're adjacent.”
- **Bombardier I — “Explosion!!”**: “Your Spirit Finisher can now choose a target in 4 Range and all targets adjacent to it instead of its normal targeting.”
- **Bombardier II — “Explosion!!!”**: “If you spend 2 or more Focus on a Spirit Finisher, you may have it choose all targets in a 3x3 Zone centered on a space within 5 range. Your Spirit Finishers gain 1 advantage per empty space it targets (to a maximum of [Tier +2] Advantage).”
- **Bombardier III — “EXPLOSION!!!!”**: “If you spend 4 or more Focus on a Spirit Finisher, you may have it affect all targets in a 5x5 Zone centered on a space within 6 range.”

Source digests are bound to the full canonical payload (`id`, archetype/technique identity, name, text, notes, source): Siren I `8d9becba6e6f63641f5dc1a8a47e965c73f0e7112ef7ef4b781b2c6ffb632979`, II `62f65d9d2cfad5b96f12f80b2ece81635e47b5f63083b35b4f4c6eb1db1b5ed6`, III `231b63c69615f78497650a97d3a5225a98f298a882d4adb2eedaebdff16c5b7e`; Bombardier I `3d9ff42ccdca001941878db3a63ef647bf904ad689d35b2c6b7e5c76e1ce59d3`, II `46784c9f35cd64891f6ba70dc0d5a14ddf7f15aaab733ca1dbd3e6b3c60697c5`, III `e9b9958348fa1bf6bf5f752ead593042fcd332ebcc8e28cd2a23054bea16a4de`.

## Реализованный срез

- **Siren I — partial**: every Scene start grants three Focus; the authoritative `action.resolve` Study of a live enemy in the same space opens an optional Fear choice. The choice spends exactly one Focus and applies Fear to that studied target. There is no artificial three-per-Scene cap. Legacy compatibility trigger uses the learned-technique source consistently.
- **Siren II — partial**: the first qualifying Fear trigger per owner Turn is receipt-bound. The engine requires the owner’s active Turn, canonical digest, linked Fear event, live target and same space. Movement is attempted one step at a time toward the Siren, at most three spaces, and the Daze/+1 Focus choice appears only when movement actually entered adjacency. Blocked movement, starting adjacency and self-targeting do not create a false Daze window.
- **Siren III — full core / manual surface certification**: existing typed group movement derives the frightened opposing actors from current Scene state, routes each actor toward the Finisher target, and applies Tier damage only after actual adjacency. Spirit/Mind, active owner Turn, one live non-self target, action instance and digest are checked.
- **Bombardier I — partial**: Spirit Finisher, canonical range 4 and an enemy occupying the selected center cell are required. The shared area runtime derives the center plus adjacent cells and target IDs.
- **Bombardier II — partial**: Spirit Finisher, Focus ≥2, 3×3 center within range 5 and derived empty-cell count are checked. The shared numeric adapter adds one Advantage per empty cell, capped at `[Tier + 2]`; the area plan is revalidated before resolution.
- **Bombardier III — partial**: Spirit Finisher, Focus ≥4 and a revalidated 5×5 center within range 6 are checked. The runtime clips at field boundaries and derives targets from the current Scene.

The player panel exposes Bombardier I–III level and center selection when the corresponding automation toggle is enabled. The engine still owns target derivation, resource payment, roll validation, reaction flow and replay receipts.

## Остаток ручной работы

The registry deliberately remains partial for all Bombardier levels and Siren I–II until a complete network/import/reconnect matrix and production UI flow are certified. Narrator can resolve unsupported edge cases manually with the existing manual rule path. No unfinished contracts from `derived-actions-v3`, `followup-lifecycle-v3` or `duel-entry-v3` were imported.

## Проверки

Run from `apps/companion`:

```text
npm run map
npm run readiness
npm run lionwing:map
npm run build:lionwing-registry
npm run docs:rules
npm test
```

The dedicated audit test covers canonical digests, Study→Fear, active-Turn/target ownership, blocked and actual Siren II adjacency, Bombardier Spirit/center/Focus/digest guards, derived empty cells, reload and forged payload rejection.

## Review follow-up — 2026-09-11

The Siren II contract now follows the canonical “after you Fear a character” wording: both the LionWing adapter path and the legacy compatibility trigger accept a live allied character. The real general guards remain active (owner’s Turn, same space, live/non-self target, linked applied Fear, canonical digest and once-per-Turn receipt); an already-adjacent or blocked target produces no movement and no invented Daze choice.

Siren I–III mutation operations now require the saved authoritative technique continuation to carry the exact rule ID, canonical source digest, owner actor and cause event. A public `effect`, `resource`, `forced-towards` or `forced-towards-group` command is rejected even when it repeats a valid old cause and digest. The choice queue carries the pending digest into nested operations, so legal choices remain valid after JSON reload. Regressions cover Siren II on an ally, the second same-Turn window, direct replay rejection for Siren I and II, Siren III replay rejection, adjacent no-op movement, and reload-before-choice paths.

Bombardier I’s enemy-in-center interpretation remains **partial/manual** pending visual confirmation against the new English LionWing PDF. No Bombardier rule or center policy was changed in this follow-up.

Follow-up checks from `apps/companion`: targeted Siren/Bombardier audit, Siren III, Scene engine, and after-event tests; `git diff --check`; full `npm test -- --runInBand` (all pretest and test suites passed).
