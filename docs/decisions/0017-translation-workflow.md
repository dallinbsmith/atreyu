# 0017. Translation workflow

**Status:** Accepted. Not yet run end to end.

## Decision

1. Flow: English content → `/langstore/en` → DA's translation integration → `/langstore/<locale>` → reviewed merge into `/<locale>`.
2. Every content type uses the human-reviewed **merge** workflow for now. Automatic transcreation is deferred until a canary locale proves quality and legal/pricing text is marked do-not-translate.
3. Existing translated content on the current site is migrated from Sanity into DA (`tools/locale-extractor`), not re-translated.

## Consequences

- `/langstore/**` is staging. It is never published; the Worker returns 404 for it.
- Placeholder sheets have a `Key` column that must not be translated; check the translation configuration before the first batch.
