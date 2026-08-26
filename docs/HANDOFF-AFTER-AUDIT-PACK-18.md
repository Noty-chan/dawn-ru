# Dawn automation audit — handoff after pack 18

## Repository state

- Canonical repository: `https://github.com/Noty-chan/dawn-ru.git`.
- Immutable audit base: `main` at `0a7429c72a1b23abdf58bf6df7722b2c3eb070bd`.
- Audit branch: `codex/dawn-automation-audit`.
- Pack 18 head before this handoff document: `3fd75d62937879f28917016070d5d063d9b0d12e`.
- Completed second-pass ledger: 288/321 Technique levels (packs 1–18).
- Remaining audit scope: 33 Technique levels and 151 activatable enemy rules, then the mandatory cross-surface/evidence completion audit.
- Do not modify or force-push `main`. Do not certify a rule merely because its core handler or happy-path test exists.

After cloning on another device:

```bash
git fetch origin
git switch codex/dawn-automation-audit
git status --short --branch
git rev-parse HEAD
```

The expected HEAD is the latest remote SHA printed in the GitHub branch after the handoff commit, not the pack-18 SHA above.

## What is authoritative

1. English rules PDF: `source/original/Dawn - A Diceless Fantasy TTRPG.pdf`.
2. Reviewed RU source: `source/translation/pages-*.md`.
3. Runtime: `apps/companion/scene-*.js`, `technique-engine.js`, UI/network/persistence code.
4. Independent ledger: `docs/AUTOMATION-INDEPENDENT-AUDIT-2026-08-25.md`.
5. `AUTOMATION-READINESS.md` is a generated candidate map, not proof.
6. `automation-evidence.json` is formal evidence; only add claims actually covered on every stated surface.
7. `CODEX.md` contains accumulated repository traps and should be read before any change.

## Commands and invariants

Run from `apps/companion`:

```bash
npm run map
npm run readiness
npm run docs:rules
npm test
```

`npm test` must report current foundation/readiness/reference documents and pass all suites. `Raasha exact-sheet QA skipped` is expected without the external fixture; do not describe the skipped fixture as a pass.

If `data.js` or reviewed translation text changes:

- update the reviewed translation corpus digest in `technique-foundation-map.js` using `reviewed-source-digest.mjs`;
- update the exact SHA-256 source digest in every affected `automation-evidence.json` entry;
- regenerate all four reference documents;
- never change evidence claims merely to satisfy the digest validator.

## Remaining Technique packs

- Pack 19 (289–304): Feral Arcana I–III, Flame Heart I–III, Grim Ascendant I–III, Long Draw I–III, Mana Blades I–III, Void Soul I.
- Pack 20 (305–320): Void Soul II–III, Thunder Blood I–III, Zealot I–III, Creation Ascetic I–III, Ego Arm I–III, Sellsword's Call I–II.
- Pack 21 (321): Sellsword's Call III. Do not pad this pack; then move to enemy rules in canonical order, batches of 16.

For each level/rule independently record RU↔EN, declared status, proven confidence, exact mismatch, and missing positive/negative/boundary/surface tests. Always inspect stale prompts, KO/control change, duplicate response/idempotency, cancel-before-pay, occupied/removed/noncanonical cells, reconnect and import.

## Work deliberately delegated away from the audit

The separate implementation task is `docs/TASK-SPELLCRAFTER-LEARNED-MODIFIERS.md`. It is intentionally not another audit package. Create a new branch from the remote audit branch:

```bash
git switch codex/dawn-automation-audit
git pull --ff-only origin codex/dawn-automation-audit
git switch -c codex/spellcrafter-learned-modifiers
```

That task may implement and test the known defect, but must not resume package 19, rewrite the audit ledger, add certification, or push to `main`.

## Review strategy for a weaker model

Accept small commits by layer: character schema/migration, scene synchronization, authoritative validation, UI, tests/docs. Reject a solution if it merely hides buttons: imported/network-supplied unknown modifiers must be rejected by core validation. Reject transient-only state: learned modifiers belong to the character build and must survive save/load, reconnect and scene resync. Keep the audit statuses `partial` until a later independent audit verifies every surface.

