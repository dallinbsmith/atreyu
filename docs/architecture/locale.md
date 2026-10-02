# Locale model

The site supports English plus nine locales, addressed by URL prefix. As of this writing **no locale is live on EDS**: every locale-prefixed URL is still served by the existing site (see [worker.md](worker.md#routing-manifest-cohorts--cells) and [status.md](../status.md#locale)). The code below is built and tested so a locale can be switched on per cohort.

## Locales

`scripts/locales.js` (browser) and `workers/website/utils/locale.js` (Worker) must list the same prefixes; `npm run test:config-sync` fails if they drift, and the `config-drift/no-duplicate-locale-list` lint rule blocks a third copy.

| Prefix | `lang` | | Prefix | `lang` |
|---|---|---|---|---|
| `''` (none) | `en` | | `/ja-jp` | `ja` |
| `/de-de` | `de` | | `/ko-kr` | `ko` |
| `/es-es` | `es` | | `/pt-br` | `pt` |
| `/fr-fr` | `fr` | | `/ru-ru` | `ru` |
| `/it-it` | `it` | | `/zh-cn` | `zh` |

English has no prefix; there is no `/en-us` path.

## How a page finds its locale

`getLocale()` in `scripts/ak.js` runs inside `setConfig()`:

1. If the page has `locale` metadata, that value is used (it must be a prefix such as `/ja-jp`; an unknown value means English).
2. Otherwise the longest known prefix that the path starts with followed by `/` (`/ja-jp/…`).
3. Otherwise `''` (English). An unknown prefix such as `/xx-yy/…` is treated as an English path.

It sets `<html lang>` and stores `{ prefix, lang }` as `getConfig().locale`. Code reads the locale only from there.

## Content layout in DA

Each locale is a top-level folder mirroring the English tree: `/ja-jp/blog/…`, `/ja-jp/system/fragments/nav/header`, `/ja-jp/system/placeholders/…`. Full layout: [authoring/da-content-structure.md](../authoring/da-content-structure.md).

## Fragment fallback

Header, footer, the header language menu, the `fragment` block and the `schedule` block load fragments through `loadFragmentWithFallback(path)` in `scripts/utils/fragment.js`. It tries each path from `localeCandidates(path)` in order and returns the first that loads. The `schedule` block keeps only the pathname of a fragment URL, so an absolute URL to another host loads that path from the current site.

| Page locale | Requested path | Candidates tried |
|---|---|---|
| `''` | `/system/fragments/nav/header` | `/system/fragments/nav/header` |
| `/ja-jp` | `/system/fragments/nav/header` | `/ja-jp/system/fragments/nav/header`, `/system/fragments/nav/header` |
| `/ja-jp` | `/ja-jp/system/fragments/nav/header` | `/ja-jp/system/fragments/nav/header`, `/system/fragments/nav/header` |
| `/ja-jp` | `/de-de/system/fragments/x` (another locale) | `/de-de/system/fragments/x` only |
| any | `https://…` or `//…` | that URL only |

- If every candidate fails it throws an `AggregateError` listing each failure; the caller decides what to render.
- Pass the unprefixed (English) path. The function adds the page's prefix itself.
- Calling `loadFragment()` directly skips the fallback. Use it only for a path that must not fall back.

## Placeholders (UI strings)

- Strings live in DA sheets at `<locale prefix>/system/placeholders/<namespace>.json` (for example `/ja-jp/system/placeholders/controls.json`).
- Code calls `getPlaceholder('controls.pause', 'Pause')`. The namespace selects the sheet; the second argument is the English fallback.
- There is **no fallback to the English sheet**. If a locale sheet or row is missing, the code fallback (English) is shown.
- Key and namespace naming rules: [conventions/blocks.md](../conventions/blocks.md#content-and-copy).

## Dates

`formatDate()` in `scripts/utils/i18n.js` formats with `getConfig().locale.lang`, never the browser locale.

## hreflang

`scripts/utils/seo/hreflang.js` (run from `lazy.js`) adds `<link rel="alternate" hreflang>` tags:

- always one for the current page (`en` for English, otherwise the prefix without the slash, such as `ja-jp`);
- one for each locale listed in the page's **`Translations`** metadata (comma-separated, for example `ja-jp, de-de`; `en-us` means the English page), ignoring values that aren't known locales;
- always `x-default` pointing at the English path.

So a page only links to translations an author has declared. Whether hreflang should instead come from the sitemap or a central sheet is undecided ([decisions](../decisions/README.md#open-questions)).

## Sitemap and query index

- `helix-query.yaml` indexes all pages except `/system/**`, `/tools/**`, `/v/**`, `/*/v/**` and `/library/**`. It does not yet exclude locale folders or split indexes per locale.
- `helix-sitemap.yaml` builds `/sitemap.xml` from that index with origin `https://main--atreyu--dallinbsmith.aem.live`. It switches to `https://frame.io` at production cutover. It has no `languages` section yet.

## Translation workflow

Decided ([ADR-0017](../decisions/0017-translation-workflow.md)): English content in DA is copied to `/langstore/en`, translated through DA's translation integration (Adobe GLaaS) into `/langstore/<locale>`, human-reviewed, and merged into `/<locale>`. `/langstore/**` is staging only; the Worker returns 404 for it. Existing translated content on the current site is migrated from Sanity with `tools/locale-extractor` rather than re-translated.

Known risk: the placeholder sheets have a `Key` column that must not be translated. Confirm the translation configuration leaves it alone before the first batch.

## Before a locale goes live

A locale goes live by adding a `{ cohort, locale }` cell to `workers/website/routing-manifest.js` ([ADR-0015](../decisions/0015-locale-cutover-cells.md)). Once a cell is live, *every* path in that cohort for that locale is served by EDS, and an untranslated page returns 404. So, per cell:

- 100% of the cohort's translatable pages are translated and published in that locale.
- A localized 404 page exists for the locale (today `404.html` is English only).
- hreflang targets are checked to exist.
- Old locale URLs on the existing site have redirects where paths changed.
- The query index and sitemap handle the locale.
- The locale's header, footer and placeholder sheets exist in DA.

### Legal and reachability gates

Two locales have an extra hard gate before any cell for them is added:

| Locale | Gate |
|---|---|
| `ru-ru` | Review against Russia's data-localization law (242-FZ) |
| `zh-cn` | Review of reachability from mainland China (Great Firewall) |

`workers/website/test/routing-manifest.test.js` fails if `CELLS` contains either locale. Remove a locale from that test only once its review is recorded as passed.
