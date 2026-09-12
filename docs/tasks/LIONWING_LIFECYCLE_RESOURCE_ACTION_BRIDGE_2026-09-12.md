# LionWing lifecycle/resource/action bridge

## Contract matrix

| Shared contract | Existing authoritative support | Connected level | Remaining condition |
| --- | --- | --- | --- |
| Scene and round boundaries | `turn-start`, `turn-end`, `round-end`, `scene-reset`; persisted receipts | `partial` | A Technique still needs an exact canonical EN quote and an opt-in adapter declaration. |
| Own and any Turn boundaries | owner turn serial, turn instance and stable boundary keys | `partial` | Foreign-turn behavior remains Technique-specific and must be declared by the adapter. |
| Starting resource/clock | `resource`, `configure-resource`, `counter`, `clock`; actor-owned counters | `partial` | The core cannot infer a resource identity or amount without a canonical declaration. |
| Usage once per Turn/Round/Scene/Chapter | authoritative LionWing history and `usage` scopes | `partial` | Target identity and exact limit must come from the Technique declaration. |
| Action permission/denial | authoritative `actionStatus`, resource balance and turn ownership | `partial` | An adapter must provide the exact condition; missing or malformed data falls back to the Narrator. |
| Preview to commit | atomic `prepare`/`previewEvents` and idempotent receipts | `partial` | A client payload never confirms an operation; only the committed writer state does. |

The foundation bridge validates boundary declarations before the writer schedules them. It rejects copied actor state, client flags, malformed operations and ownership mismatches, and records a `rule.manual-fallback` notification so the Narrator can resolve the edge case. The engine now also exposes authoritative `resourceQuote` and `actionGate` queries and the generic `allow-action`/`deny-action` operations. Scoped action guards expire at the stored Turn, Round or Scene boundary and survive reload/replay through the normal scene state.

This bridge is generic. It does not register Techniques or import UI code; adapters only return declarative operations and quotes, while the LionWing engine validates and writes state.
