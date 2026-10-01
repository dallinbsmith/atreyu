# 0006. One personalization and testing engine

**Status:** Accepted. The previous engine is deleted (restorable from git tag `pzn-legacy-final`).

## Context

The repo used to have two engines that could both change the page after load: a custom firmographic engine (`pzn.js`, a variants sheet and a separate decision Worker) and a custom A/B script. Two engines on one page can produce conflicting swaps, and the custom one had no DA authoring path.

## Decision

All A/B tests and personalization use Adobe's `aem-experimentation` plugin, vendored at `plugins/experimentation/` and wrapped by `scripts/experiment-loader.js`. Authors use the **Experiment** page metadata and the **Personalize** table. The custom engine, its audit, its CSS hooks and `workers/decision-endpoint/` are removed.

## Consequences

- There is no second engine, so there is no runtime precedence between engines ([0007](0007-personalization-precedence.md)).
- `plugins/experimentation/` is vendored: don't edit it; upgrade it as a unit.
- How it works: [architecture/personalization.md](../architecture/personalization.md). Authoring: [authoring/personalization.md](../authoring/personalization.md).
