# Atreyu — Frame.io Marketing Site on AEM Edge Delivery Services

This repo is the in-progress migration of Frame.io's marketing site off Next.js + Sanity + Vercel and onto Adobe Edge Delivery Services (EDS), authored via DA (da.live), fronted by a Cloudflare Worker.

**Status: active proof-of-concept, not yet production.** Content today lives in a personal DA sandbox (`dallinbsmith/atreyu`), not a real Frame.io-owned org — see `artifacts/ARCHITECTURE-DECISIONS.md` for why, and what's blocking the move. Most pages on the live site are still served from the existing Next.js origin; this repo's job is to progressively take over one URL cohort at a time.

## What's real vs. placeholder right now

Only a handful of pages are fully built and content-complete:
- `/integrations/davinci-resolve`
- `/customers/sundance-film-festival`
- `/features/c2c` (with a real `/ja-jp/features/c2c` translation pair)

`/blog`, `/glossary`, `/integrations`, and `/customers` exist as landing-page placeholders, not full sections yet. Don't assume a page exists just because its route is wired in the Worker — check `artifacts/master-plan/DA-CONTENT-STRUCTURE.md` for the current real content map before building against a page.

`scripts/utils/analytics/segment.js` ships with a placeholder write key (`REPLACE_WITH_REAL_SEGMENT_WRITE_KEY`) — analytics events fire but silently no-op until a real key is dropped in.

## Localization

Falkor/Sanity's real locale model — what this migration needs to match, not a hypothetical feature list:
- **10 region-qualified locales, no bare-language codes**: `en-us` (default, unprefixed), `de-de`, `es-es`, `fr-fr`, `it-it`, `ja-jp`, `ko-kr`, `pt-br`, `ru-ru`, `zh-cn`.
- **One independent document per locale**, not a shared doc with field overrides — required to ever support genuine per-locale content divergence, not just translation.
- **Localized header & footer — real, implemented**: `blocks/header/header.js` and `blocks/footer/footer.js` both resolve their nav fragment via `loadFragmentWithFallback([`${locale.prefix}${path}`, path])`, trying the locale-prefixed fragment first and falling back to the `en-us` default.
- **Localized 404 — not yet built.** `404.html` is a single hardcoded English-only static page today. Falkor's real equivalent renders a fully-authored, per-locale `404-content` page through its normal page pipeline; matching that is a real, scoped gap, not done yet.
- **Do-not-translate (`#_dnt`)** is an EDS-native convention (`scripts/ak.js`), not something Falkor/Sanity has any equivalent of — kept here because it's real and implemented, not because it matches the source system.

## Section authoring

Real, verified capabilities of `section-metadata` — atreyu-native, no Falkor equivalent:
- **Style**: free-text, comma-separated raw CSS class names (`center`, `peek-background`, `glow`, etc.), applied as-is.
- **Grid**: 2, 4, 6 fully supported at all breakpoints. 3 and 5 are settable but only become a real multi-column grid at ≥1200px — a known, unfixed gap below that width.
- **Container**: 2, 4, 6 — controls max content width, not column count.
- **Gap / Spacing**: xs, s, m, l, xl, xxl.
- **Background**: color token, plain color, or image. Video URLs are silently ignored; gradients aren't supported.
- **Color scheme**: computed automatically from background luminance, not an author-facing toggle.
- **Layout**: one preset, `bento` (3-column asymmetric grid, ≥900px, up to 6 children).

## Base content

- **Buttons**: `accent`, `primary`/`white`, `secondary`/`ghost`, `glass`, `negative`, `link` — each with an outline variant.
- **Responsive images**: two-breakpoint WebP generation (750px mobile / 2000px desktop) with format-matched fallback, via a query-param image service — not literally retina/2x.
- **Color scheme**: persisted site-wide light/dark toggle, independent from `section-metadata`'s auto-computed per-section scheme.
- **Favicon**: real, author-overridable via metadata.
- **New window** (`#_blank`) and **do-not-translate** (`#_dnt`): real hash-link conventions.
- **Deep link support**: real — compensates for lazy-loaded sections so a `#anchor` link scrolls correctly once its target actually exists.
- **Modal support**: real, but three separate block-specific implementations, not a shared component.

## Header and footer content

- **Brand**: the header fragment's first section, decorating its first link.
- **Main menu**: the first `<ul>` in the second section.
- **Actions**: the third section, plus three built-in widgets always appended — color-scheme toggle, language selector, mobile-menu toggle.
- **Mega menu support**: real, via nested fragment content per menu item.
- **Disable header/footer**: `header: off` / `footer: off` metadata.

## Scheduled content

Schedule content using a spreadsheet (`start`/`end`/`fragment` columns) — filtered server-side by the Cloudflare Worker so inactive rows never reach the client.

## Sidekick & pre-production

- **Quick Edit**, real.
- **Extensible plugin system** — plugins register via `sk.addEventListener('custom:X', handler)`.
- **Schedule simulator** — a real date/time simulator for previewing scheduled content, disabled in prod.
- **Convert production links to relative** — real, now correctly pointed at `frame.io` (was the original template's placeholder domain until fixed 2026-09-01).

## Performance

No literal LCP measurement — a structural proxy instead. Once the first section's blocks finish loading, `ak.js` treats that as near-LCP and fires `postlcp.js` (a dedicated, extensible hook point), then triggers `lazy.js` once every section is done.

## Developer tools

- **Environment detection**: real, via hostname substring matching (`scripts/utils/env.js`) — a known fragile pattern, not a hardened one.
- **Extensible logging** (console/coralogix/splunk/etc.): not implemented.
- **Lit support**: real, one live consumer (`scripts/scheduler/scheduler.js`).
- **Hash utils** (`#_blank`, `#_dnt`, others): real.
- **Modern CSS**: native nesting and `@layer` are real and used throughout; `@scope` is not used anywhere.
- **AEM Operational Telemetry**: not custom — just Adobe's standard `rum.js` sampling.

## Patterns

- **Page**: styled via a `template` metadata property that loads `${template}.css`. Real mechanism, not yet used by any page in this repo.
- **Section**: a page subdivision, styleable via `section-metadata` (see above).
- **Block**: a child of a section, adds visual/functional context.
- **Auto Block**: real, link-pattern-based. Current patterns: `fragment` (`/system/fragments/`), `schedule` (`/schedules/`), `youtube`.
- **Default content**: content outside any block.

## Design System

- **Spacing & Gap**: xs, s, m, l, xl, xxl (see Section authoring).
- **Emphasis**: not a universal system — `.quiet` is a per-block modifier on `card` and `hero` only.
- **Buttons**: see Base content for the real full list.
- **Columns**: no independent column system exists.
- **Grid**: 2, 4, 6 fully supported; 3 and 5 only become a real grid at ≥1200px (see Section authoring).
- **Color tokens**: blue, gray, green, magenta, orange, purple, red, teal, yellow — each with a 100-900 scale.
- **Color schemes**: light, dark (see Section authoring / Base content).

## Architecture, in brief

- **No build step, no bundler.** Vanilla ES2025 JS and native CSS, served directly over HTTP/2. See `CLAUDE.md` for the full engineering conventions (arrow-only JS, three-layer CSS cascade, loading-phase rules) — that file is the authoritative style guide for this repo, written for both humans and AI agents working in it.
- **Cloudflare Worker strangler** (`workers/website/`) is the real production routing backbone, not a reference example. Per request, it decides which backend (the new EDS site or the legacy Next.js origin) serves a given path, and also handles CSP enforcement, redirects, and locale-prefix routing — this is how the migration moves one URL cohort at a time instead of a big-bang cutover. Confirm before modifying `index.js` routes or `wrangler.toml`.
- **Content lives in DA**, not in this repo. Pages, the block/template library, the sitewide dictionary (`placeholders.json`), and personalization variants are all DA documents/sheets, edited by authors directly, independent of code deploys.
- **Blocks** (`blocks/{name}/`) are the unit of author-facing functionality — each pairs a `.js` and `.css` file, auto-loaded by `scripts/ak.js` when present on a page.

Full architecture rationale, decision history, and open questions live in `artifacts/` — start with `artifacts/ARCHITECTURE-DECISIONS.md` and `artifacts/master-plan/`.

## Local development

```sh
npm install
sudo npm install -g @adobe/aem-cli   # once, globally
aem up                               # serves against the real DA content source
```

## Commands

```sh
npm run lint          # ESLint + Stylelint — must pass before any PR
npm run lint:js       # ESLint only
npm run lint:css      # Stylelint only
npm run test          # Web Test Runner — full suite, with coverage
npm run test:watch    # Watch mode
npm run test:file     # Run a single test file (pass a path)
npm run lighthouse    # Lighthouse CI, local run
```

## Contributing

Read `CLAUDE.md` and `.claude/rules/*.md` before making changes — they encode real, previously-learned lessons (loading-phase discipline, block JS size limits, event-tracking governance) that aren't obvious from reading the code alone. Run `npm run lint` and `npm run test` before opening a PR.
