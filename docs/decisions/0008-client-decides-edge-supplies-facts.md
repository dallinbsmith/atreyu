# 0008. The browser decides; the edge only supplies facts

**Status:** Accepted. The edge part is not built.

## Decision

1. If the browser can resolve an audience itself (URL, UTM, referrer, storage, `matchMedia`), it does. No network round-trip.
2. For facts the browser can't get (IP-derived country/city, reverse-IP company size), the website Worker adds a coarse fact to a `Server-Timing` header on the page response, for example `seg;desc=enterprise`. The client maps it to an audience.
3. The Worker never picks a variant and never returns variant HTML. There is one cached HTML per URL.
4. Variants swap in before first paint. An above-the-fold swap costs one same-origin `/v/` fetch, bounded by a 1 s timeout (`withVariantTimeout` in `scripts/utils/experiments/guard.js`) and a budget of +200 ms p75 LCP on throttled mobile.

## Consequences

- `workers/website` has no `Server-Timing` code yet; firmographic audiences don't exist yet.
- `Server-Timing` is added after the cache lookup, so it doesn't vary the cache key. Exposure of `desc` in Safari and Firefox is unverified.
- A separate decision API (`/api/decision`) is rejected: it adds a blocking request.
- Reopen edge HTML injection only if a measured hero swap exceeds the LCP budget.
