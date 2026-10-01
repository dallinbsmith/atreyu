# 0015. Locales go live as routing cells, fully translated

**Status:** Accepted. No locale cell is live.

## Decision

1. EDS coverage is an explicit manifest of cells (`{ cohort, locale }`) in `workers/website/routing-manifest.js`. Locales go live in waves aligned to cohorts.
2. A cell goes live only when 100% of the cohort's translatable pages in that locale are translated and published, hreflang targets are checked, and a redirect map covers previously-live URLs on the current site.
3. A locale URL with no page returns a localized 404 with a language switcher. No English fallback at a locale URL, no automatic redirect.

## Consequences

- Once a cell is live, every path in that cohort and locale goes to EDS; a missing translation becomes a 404 on a real URL. Hence the 100% gate.
- `404.html` is English-only today. A localized 404 is required before the first locale cell.
- Adding a cell is a Worker change: two engineering reviews plus owner approval.
