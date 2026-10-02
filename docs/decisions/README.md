# Decisions

Short records of decisions that are made. Each has a status: **Accepted**, **On hold**, or **Superseded** (with what replaced it). To change one, add a new record that supersedes it; don't rewrite history in place.

| # | Decision | Status |
|---|---|---|
| [0001](0001-one-runtime-eds.md) | One customer-facing runtime: EDS | Accepted; edge-injected personalization superseded by 0008 |
| [0002](0002-cloudflare-worker-strangler.md) | Cloudflare Worker as the migration router and CDN | Accepted |
| [0003](0003-da-live-content-source.md) | DA is the content source | Accepted |
| [0004](0004-author-kit-with-recorded-patches.md) | Author-kit base; record every core patch | Accepted |
| [0005](0005-canonical-host.md) | Canonical host is `https://frame.io` | Accepted |
| [0006](0006-one-personalization-engine.md) | One personalization and testing engine | Accepted |
| [0007](0007-personalization-precedence.md) | A test and a personalization never target the same content | Accepted |
| [0008](0008-client-decides-edge-supplies-facts.md) | The browser decides; the edge supplies facts | Accepted, edge part not built |
| [0009](0009-cro-surface-on-hold.md) | Dedicated CRO tools | On hold |
| [0010](0010-consent-model.md) | Consent model: match the current site | Accepted, not implemented |
| [0011](0011-english-only-personalization.md) | Personalization is English-only for now | Accepted |
| [0012](0012-section-personalization-tables-only.md) | Section personalization uses Personalize tables only | Accepted |
| [0013](0013-no-chrome-personalization.md) | No experiments on site chrome | Accepted |
| [0014](0014-locale-model.md) | Locale model: path prefix, one document per locale | Accepted |
| [0015](0015-locale-cutover-cells.md) | Locales go live as fully translated routing cells | Accepted |
| [0016](0016-block-names-are-a-contract.md) | Block names and tokens are a content contract | Accepted |
| [0017](0017-translation-workflow.md) | Translation workflow | Accepted |
| [0018](0018-single-writer-during-dual-run.md) | One writable source per page and locale during migration | Accepted, not enforced |
| [0019](0019-environments.md) | Environment model: one EDS site, three tiers | Accepted, partly implemented |

## Open questions

Not decided. Don't build against an assumed answer.

- **hreflang source.** Either the EDS sitemap's `languages` configuration (not set in `helix-sitemap.yaml` today) or a central translations sheet with hreflang injected by the Worker. The sitemap option is preferred if a staging test confirms it works. Today `scripts/utils/seo/hreflang.js` writes tags only from a page's `translations` metadata ([architecture/locale.md](../architecture/locale.md#hreflang)).
- **Lit for reactive surfaces.** Allowed in principle ([0001](0001-one-runtime-eds.md)); no customer-facing block uses it.
- **Firmographic data source** for [0008](0008-client-decides-edge-supplies-facts.md): which provider, and whether it is cleared for use.

## Legacy IDs

Code comments and older notes may cite these IDs. Map them here.

| Old ID | Now |
|---|---|
| D1, ADR-001 | [0001](0001-one-runtime-eds.md) |
| ADR-002 | [0002](0002-cloudflare-worker-strangler.md) |
| D19, A5 | [0003](0003-da-live-content-source.md) |
| D17 | [0005](0005-canonical-host.md) |
| D5a, D-2 | [0006](0006-one-personalization-engine.md) |
| ADR-003 | [0007](0007-personalization-precedence.md) |
| ADR-004, D-1, D-14 | [0008](0008-client-decides-edge-supplies-facts.md) |
| ADR-005, D-8 | [0009](0009-cro-surface-on-hold.md) |
| ADR-006, D-4, D-5, D-13 | [0010](0010-consent-model.md) |
| D-15, D-L6 | [0011](0011-english-only-personalization.md) |
| pz-section-meta | [0012](0012-section-personalization-tables-only.md) |
| A2 | [0013](0013-no-chrome-personalization.md) |
| A7 | [0016](0016-block-names-are-a-contract.md) |
| D-L2, D-L5 | [0015](0015-locale-cutover-cells.md) |
| D-L1, D-L7, D-L8 | [0017](0017-translation-workflow.md) |
| D-L3 | [Open questions](#open-questions) |
| D-L4 | [0018](0018-single-writer-during-dual-run.md) |
| D5 (Adobe Target) | Rejected: it decides before paint and causes flicker. Superseded by 0006 |
| D18 (GrowthBook) | Superseded: not used |
