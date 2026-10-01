# 0012. Section personalization uses Personalize tables only

**Status:** Accepted.

## Decision

Sections are personalized by putting a **Personalize** table in them. Section Metadata keys that the plugin reads (`experiment`, `variant`, `audience`, `audiences`, `campaign` and prefixed forms) are reserved and must not be authored.

## Consequences

- The server writes Section Metadata as `data-*` attributes before any JS runs, so code can't guard those keys. The rule is enforced by authoring docs and an experiments panel warning ([authoring/section-metadata.md](../authoring/section-metadata.md#keys-you-must-not-use)).
- In Quick Edit and DA preview, the loader strips reserved keys before the plugin runs.
- `carryOverSectionMeta` (`scripts/utils/experiments/guard.js`) re-adds style and anchor rows after a swap; it stays.
