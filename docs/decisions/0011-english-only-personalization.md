# 0011. Personalization and tests are English-only for now

**Status:** Accepted.

## Decision

Until localization ships: no localized `/v/` variant pages, no Experiment or Personalize content on locale-prefixed pages, and pricing pages stay out of scope.

## Consequences

- The Personalize compiler drops variant paths that start with a locale prefix (`/de-de/v/…`).
- Localized personalization (locale-aware variant paths, translation of variant pages) is planned work, designed when this decision is lifted.
