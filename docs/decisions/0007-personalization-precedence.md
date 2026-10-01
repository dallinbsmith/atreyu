# 0007. A test and a personalization never target the same content

**Status:** Accepted. Simplified by [0006](0006-one-personalization-engine.md).

## Decision

1. An A/B test and a personalization must not change the same content. Overlap is an authoring error, not something the runtime reconciles.
2. There is no runtime priority arbiter between them.
3. If a deterministic audience match and a random A/B assignment ever compete, the audience match wins.

## Consequences

- With one engine, the rule is mostly structural: an **Experiment** swaps the whole page; **Personalize** tables swap sections.
- Don't put a Personalize table on a page that is also a variant of a running test unless the overlap is intended and reviewed.
- A layered precedence ladder (identified vs anonymous, most-conditions-wins) was proposed and not adopted. Revisit only with a named consumer.
