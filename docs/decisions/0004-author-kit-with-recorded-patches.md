# 0004. Start from author-kit; record every change to its core files

**Status:** Accepted.

## Context

The site started from Adobe's author-kit boilerplate. Its core loader (`scripts/ak.js`) and phase files (`scripts/lazy.js`, `scripts/postlcp.js`) get upstream fixes we want to keep taking.

## Decision

Keep author-kit as the base. Every local change to `scripts/ak.js`, `scripts/lazy.js` or `scripts/postlcp.js` gets a row in `scripts/AK-PATCHES.md` with what changed, why, and a classification. Upstream commits we deliberately don't take are recorded there too.

## Consequences

- A PR that edits those files without updating `AK-PATCHES.md` is incomplete (PR template checklist).
- Before pulling an upstream change, check `AK-PATCHES.md` for conflicts with our patches.
- Project code goes in `scripts/utils/`, `blocks/` and `scripts/scripts.js`, not in `ak.js`, unless it has to change core behaviour.
