# Project status

Snapshot as of 2026-10-01. Update this page in the same PR that changes the status of an item.

Legend: **Built** = merged to `main` and tested. **In progress** = partly built. **Blocked** = waiting on something outside the code. **Planned** = decided, not started.

## Summary

| Area | State |
|---|---|
| Foundation (code base, conventions, CI) | Built; a short hardening list remains |
| Locale | Code built and paused; no locale is live |
| Personalization and experimentation | Built; zero production reach until consent and the Worker are in place |
| Worker and routing | Built and tested; deployed to `workers.dev` only, not in front of frame.io |
| Content migration | A handful of real pages; most landing pages are placeholders |

Nothing on frame.io is served by EDS yet.

## Foundation

**Built**
- Author-kit page engine with every local change recorded in `scripts/AK-PATCHES.md`, enforced by CI.
- 53 blocks with a signed-off naming catalog ([block catalog](authoring/block-catalog.md)).
- Lint (ESLint, Stylelint, custom config-drift, z-index and CSS-layer checks), browser unit tests, Worker tests, all required on every PR.
- Block teardown signal (`{ signal }`) in `ak.js`, `guardDecorate` for re-entrancy.
- Translatable UI strings via namespaced placeholder sheets.
- Single shared utilities layer (`scripts/utils/`) with lint-enforced import direction.

**In progress / planned**
- Migrate the remaining blocks that hold global listeners or timers to the teardown signal.
- Load experimentation code only on pages that have tests.
- Move remaining project-specific hooks out of `ak.js` into `scripts.js`.
- Fix flaky scroll-timing tests.
- Reduce the header's CSS size.

## Locale

**Built**
- Ten locales defined (English unprefixed plus nine prefixes), kept identical between browser and Worker by tests.
- Header, footer, language menu, fragments and schedules try the locale copy and fall back to English (`localeCandidates`).
- Japanese header, footer and UI strings exist in DA.
- Cohort × locale routing manifest in the Worker, so a locale can be switched on per section of the site.
- Unknown locale prefixes are treated as English paths.
- `tools/locale-extractor` converts existing translated Sanity content into DA documents.

**Paused.** No locale cell is live. Before the first locale goes live (see [architecture/locale.md](architecture/locale.md#before-a-locale-goes-live)):
- a localized 404 page;
- checks that hreflang targets exist, and a decision on the hreflang source (sitemap vs page metadata);
- locale handling in the query index and sitemap;
- redirects for locale URLs whose paths change;
- Japanese translations of every page in the cohort (100% coverage per cell);
- confirmation that the translation service won't translate placeholder `Key` columns.

Before the third locale: generate the locale lists from one manifest and write an add-a-locale runbook.

## Personalization and experimentation

**Built**
- One engine: the vendored aem-experimentation plugin plus `scripts/experiment-loader.js`. The previous custom engine has been removed.
- Experiment table (whole-page A/B) and Personalize table (section personalization) compilers.
- Audiences: mobile, desktop, UTM campaign.
- Experiments panel with page and sitewide views, checks, and Experiment/Personalize table builders.
- Worker gate for `/v/` variant pages; CSP allows the planned consent manager (OneTrust) and analytics (Segment).
- 1-second timeout on variant fetches.

**Blocked**
- Production Cloudflare account (the Worker can't front frame.io without it).
- Loading the consent manager and analytics in production. `segment.js` still has a placeholder write key.
- Removing the consent gate from the loader (decided, waiting on the consent manager).
- Choosing the first production page to personalize.

**Planned**
- Measurement and reporting for tests.
- Server-supplied audience facts (country, logged-in, company) via the Worker.
- First production pilot on `/pricing`.

## Worker and routing

**Built**
- Strangler Worker routing by cohort × locale manifest, with `EDS_DISABLED` kill switch.
- Redirects, trailing-slash normalization, variant gate, nonce-based CSP.
- Tests for routing, manifest validation, redirects, CSP and the existing-site proxy.

**Blocked**
- Cloudflare account and zone for frame.io. Every environment deploys to `workers.dev`; `PUSH_INVALIDATION` stays `disabled` until a zone and purge credentials exist.

**Planned, in order**
1. Deploy to a staging zone.
2. Run with `EDS_DISABLED=true` (all traffic to the existing site) to prove the proxy.
3. Enable the phase 1 English cohort (`/blog`, `/glossary`, `/integrations`).
4. Later cohorts: `/customers` and `/resources`; then `/`, `/enterprise`, `/demo` (needs exact-path matching); then `/pricing`.

## Content migration

**Built**
- Real pages: `/integrations/davinci-resolve`, `/customers/sundance-film-festival`, `/features/c2c`, and its Japanese pair `/ja-jp/c2c` (preview only).
- Landing placeholders for `/blog`, `/glossary`, `/integrations`, `/customers`, `/resources`.
- DA Library entries for blocks.

**Not yet**
- Most pages, page templates, shared data sheets.
- `/features/*` isn't in any routing cohort, and `/customers/*` isn't live (phase 2).
- The 404 page is English only.
