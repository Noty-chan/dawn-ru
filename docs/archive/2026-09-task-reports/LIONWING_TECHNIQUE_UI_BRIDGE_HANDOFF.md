# LionWing technique action bridge handoff

The companion now exposes a single review surface for supported Technique
actions. It derives action offers from authoritative `technique-trigger`
choices, prepares and previews their exact event batch with the LionWing
engine, and only then commits through `commitSceneEvents`. The surface shows
the level, availability reason, target or cell requirement, costs, canonical
source and adapter digest, with explicit preview, execute and cancel controls.
Narrator manual recording remains available for levels without an executable
offer.

## API request

`DAWN_LIONWING_ADAPTERS.list(actor)` currently exposes adapter metadata only
(`id`, level, label, coverage and digest). It does not expose a stable
operation offer factory for a standalone adapter action. The bridge therefore
uses operation descriptors already issued by the engine in a pending choice,
or accepts an explicit descriptor through `render(..., { actions })`. Please
consider adding a read-only, authoritative adapter offer projection (with
operation descriptors, target/cell requirements and availability reason) to a
future engine API. The UI must not reconstruct those operations from adapter
internals or client supplied flags.

## Validation

Targeted `node tests/lionwing-technique-surface.mjs` and `node tests/syntax.mjs`
pass. The full `npm test` reaches the suite but currently stops at the
pre-existing `build_rule_reference_docs.mjs --check` failure: four generated
reference documents are stale on `origin/main`.
