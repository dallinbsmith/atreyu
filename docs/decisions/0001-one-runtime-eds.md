# 0001. One customer-facing runtime: Edge Delivery Services

**Status:** Accepted. Parts superseded (see below).

## Context

An earlier plan split the site between a Next.js renderer (conversion pages) and EDS (long-tail content). The main reason to keep a second renderer was personalization without flicker. A spike showed that coarse, cacheable personalization works on a static edge setup, and no page was found that needs signed-in or entitlement-aware rendering.

## Decision

Every migrated page is served by AEM Edge Delivery Services. There is no standing second renderer. A future exception must be a single named page with a removal date, never a second stack.

## Consequences

- All front-end work is vanilla JS and CSS in this repo ([conventions/javascript.md](../conventions/javascript.md)).
- **Superseded:** the original wording included *edge-injected* personalization. Personalization is decided in the browser ([0006](0006-one-personalization-engine.md), [0008](0008-client-decides-edge-supplies-facts.md)).
- **Open:** Lit for the few reactive surfaces. Lit is vendored and used by the content scheduler tool only; no customer-facing block uses it.
