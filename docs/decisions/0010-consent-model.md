# 0010. Consent model: match the current frame.io site

**Status:** Accepted, not implemented. The code still gates on consent.

## Decision

1. Tests and personalization are **not** consent-gated, matching how frame.io behaves today. The `hasConsent` check stays behind one switch so gating can return in one change.
2. Load OneTrust the same way frame.io does, then Segment after it. Every Segment event carries the visitor's consent categories; filtering happens downstream in Segment.
3. Preview parameters (`?experiment=`, `?audience=`) work on every host, including production, and previews are never tracked.

## Consequences

- Today `scripts/experiment-loader.js` stops unless `hasConsent('personalization')` is true or the URL is a preview, and nothing grants that consent in production. Production reach is zero until the consent work ships.
- `scripts/utils/analytics/segment.js` has a placeholder write key; events don't send until a real key is set.
- Open: a written legal ruling (instead of parity with the current site); which Segment device-mode destinations load on EDS pages (never add `unsafe-eval` to CSP for them); verifying the OneTrust callback names and hosts.
- A visitor whose variant fetch times out is currently counted as control. Fix before reading results.
