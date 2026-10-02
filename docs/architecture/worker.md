# The Cloudflare Worker (strangler)

`workers/website/` is the Worker that will sit in front of frame.io. For each request it decides whether the **existing site** (`LEGACY_ORIGIN`) or **EDS** answers. Migration happens by adding routing cells, not by moving DNS. Rules for changing it are in [conventions/workers.md](../conventions/workers.md); running and deploying it is in [runbooks/worker.md](../runbooks/worker.md).

Current state: deployed to `workers.dev` only, not in front of frame.io. See [status.md](../status.md#worker-and-routing).

## Request flow

`index.js` default export, in order:

1. **Env check.** If `AEM_ORG`, `AEM_SITE`, `DA_ORG`, `DA_SITE`, `LEGACY_ORIGIN` or `DEPLOY_TIER` is missing, or `DEPLOY_TIER` isn't `dev`, `stage` or `prod`, every request gets a 500 with a request id (`utils/env-guard.js`).
2. **Non-prod tier.** When `DEPLOY_TIER` isn't `prod`, `/robots.txt` is answered by the Worker and every response leaving the Worker gets `x-robots-tag: noindex, nofollow` ([Deploy tier](#deploy-tier)).
3. **Port redirect.** A request with a port, on a host other than `localhost`, gets a 301 to the same URL without the port.
4. **`blog.frame.io`** → 301 to `https://frame.io/blog{path}{query}`.
5. **RUM** (`/.rum/…`, `/.optel/…`): methods other than GET, POST, OPTIONS get 405.
6. **Strangler decision.** The request goes to the existing site (`handlers/existing-origin.js`) unless it is RUM, matches a *global* route (below), or is an EDS path. With `EDS_DISABLED=true`, nothing except RUM and global routes is treated as an EDS path. The existing-site fetch copies path and query, sets `host` to `LEGACY_ORIGIN`, times out after 10 s and returns 502 on failure.
7. **Query cleanup** for the EDS request: media keeps `format`, `height`, `optimize`, `width`; `.json` keeps `limit`, `offset`, `sheet`; HTML drops the query. Parameters are sorted. The original query is kept for redirects.
8. **Rewrite to the EDS origin**: host becomes `main--{AEM_SITE}--{AEM_ORG}.aem.live`; headers `x-forwarded-host`, `x-byo-cdn-type: cloudflare`, `x-push-invalidation: enabled` (only when `PUSH_INVALIDATION` isn't `disabled`) and `authorization: token {ORIGIN_AUTHENTICATION}` (only when set).
9. **Routes**, first non-null response wins:

| # | Matches | Handler | Global |
|---|---|---|---|
| 1 | path contains `/schedules/` and ends in `json` | `fetchSchedule` (content scheduler data) | yes |
| 2 | path contains `/dasc/` and ends in `json` | `handlers/dasc.js`: proxies DA structured-content JSON from `da-sc.adobeaem.workers.dev/live/{DA_ORG}/{DA_SITE}{path}` (5 s timeout, empty `data` on failure) | yes |
| 3 | starts with `/drafts` | 404 | yes |
| 4 | `/v/…` or `/{locale}/v/…` (not media) | `handlers/variants.js`: personalization variant pages. Served only to a same-origin `fetch()` (`sec-fetch-dest: empty`, `sec-fetch-site: same-origin`), with `x-robots-tag: noindex, nofollow` and `cache-control: no-store`. Anything else gets 404 | yes |
| 5 | starts with `/langstore` | 404 | yes |
| 6 | everything | `handlers/redirects.js` (below); returns null when no redirect applies | no |
| 7 | page path ending in `/` (not `/`, not RUM, not an asset folder) | 308 to the path without trailing slashes, query kept | no |
| 8 | everything | `fetchFromAem` in `handlers/aem.js`: fetch from EDS with edge caching; on HTML adds a nonce-based Content-Security-Policy (`buildCsp`), and in one HTMLRewriter pass stamps the nonce on marked scripts and sets `data-deploy-tier` on `<html>`. Upstream timeout (10 s) → 504, network failure → 502 | no |

"Global" routes run on every request, even for paths not in a live cell. Redirects and trailing-slash handling only apply to paths routed to EDS.

## Routing manifest: cohorts × cells

`routing-manifest.js` is the only place that decides which pages EDS serves.

- A **cohort** is a named list of folder prefixes. `'/blog/'` matches `/blog` and `/blog/…`. Prefixes must be lowercase, look like `/folder/`, contain no locale, not overlap each other, and not overlap an asset prefix.
- A **cell** `{ cohort, locale }` is live. `locale: ''` is English (unprefixed); otherwise it is one of the locale prefixes in `utils/locale.js` (for example `'/ja-jp'`). No cell means the existing site serves it.
- An invalid manifest throws when the module loads, so tests and the deploy fail instead of routing on a typo.

As built:

```js
export const COHORTS = Object.freeze({
  phase1: Object.freeze(['/blog/', '/glossary/', '/integrations/']),
});

export const CELLS = Object.freeze([
  Object.freeze({ cohort: 'phase1', locale: '' }),
]);
```

So today EDS serves English `/blog`, `/glossary` and `/integrations` pages. Everything else, including all locale-prefixed pages, goes to the existing site. Planned cohorts (from the code comments; not yet in the manifest): `/customers/` and `/resources/`, then `/`, `/enterprise` and `/demo` (which needs exact-match support the manifest doesn't have), then `/pricing`.

### Assets

`EDS_ASSET_PATHS` are `/blocks/`, `/icons/`, `/img/`, `/plugins/`, `/scripts/`, `/styles/`, `/system/`, `/templates/`. Unprefixed (English) asset paths always go to EDS. A locale's assets (`/ja-jp/system/…`) go to EDS only once that locale has a live cell. A path containing an encoded separator (`%2f`, `%5c`) never goes to EDS.

### Runtime switches

`createIsEdsPath(manifest, isCellLive)` accepts a predicate that can turn individual cells off per request (for example, from an env var). It may only remove cells; a throwing predicate counts as "not live". The production `isEdsPath` uses no predicate today, so the only runtime switch is the global `EDS_DISABLED`.

### Adding a cell

1. Add the prefixes to a cohort (or a new cohort) and the `{ cohort, locale }` entry to `CELLS`.
2. Run `node --test workers/website/test/*.test.js`; `routing-manifest.test.js` validates the manifest.
3. For a locale cell, meet the locale gates first ([architecture/locale.md](locale.md#before-a-locale-goes-live)). `ru-ru` and `zh-cn` also need a legal or reachability review; a test blocks them until then ([gates](locale.md#legal-and-reachability-gates)).
4. Needs two engineering reviews and the repository owner's approval ([CONTRIBUTING.md](../../CONTRIBUTING.md#review)).

## Redirects

`handlers/redirects.js` reads `/redirects.json` from EDS (the `redirects` sheet authored in DA), caches it per isolate for 5 minutes (30 seconds after a failed fetch, 3 s fetch timeout) and returns a 301.

- Sources are matched after stripping the locale prefix and trailing slashes. A source ending in `/*` is a prefix wildcard; `*` in the destination receives the rest of the path.
- A relative destination on a locale-prefixed request gets that locale prefix unless it already has one.
- Destinations must be relative paths. An absolute destination is ignored unless its host equals the request's host; because the request has already been rewritten to the `aem.live` origin, absolute `https://frame.io/...` destinations are currently ignored.
- Redirects only run for EDS-routed paths. Redirects for pages still on the existing site must live there.

## Content-Security-Policy

`buildCsp(nonce)` in `handlers/aem.js` is the single CSP builder: `script-src 'nonce-…' 'strict-dynamic'`, `frame-src` YouTube and Calendly, `connect-src`/`img-src` allow the EDS hosts plus OneTrust and Segment hosts (`CONSENT_ANALYTICS_CSP`). `head.html` scripts carry `nonce="aem"`, which the Worker replaces with the per-request nonce. To allow a new embed, edit `buildCsp` and its test. Only `nonce="aem"`-marked elements get the nonce, so a script from content never runs. Don't also configure a CSP on the EDS origin (`headers.json`): AEM would replace the marker first and every script would be blocked. Without the Worker (`aem up`, `aem.page`, `aem.live`) there is no CSP.

## Deploy tier

`DEPLOY_TIER` (`dev`, `stage` or `prod`) is set per environment in `wrangler.toml`: top level (`wrangler dev`) `dev`, `[env.staging]` `stage`, `[env.production]` `prod`. There is no default in code; a missing or unknown value fails every request with a 500.

- **Tier attribute.** EDS HTML responses (route 8, and variant pages through it) get `<html data-deploy-tier="{DEPLOY_TIER}">`. Any upstream `data-deploy-tier` is removed first. Existing-site responses and non-HTML responses are not rewritten. `scripts/utils/env.js` reads the attribute only on hosts that are neither loopback nor an EDS host (`*--*--*.aem.page|live`); a missing or invalid value means `prod`. Authors can create `<meta>` tags through page or bulk metadata, so the tier is never read from one. See [environments.md](environments.md#host-classification).
- **Robots.** On `dev` and `stage`, every response gets `x-robots-tag: noindex, nofollow` (replacing any other value, including `/system/`'s `noindex`), and `/robots.txt` returns `User-agent: *` / `Disallow: /` as `text/plain` without reaching either origin. On `prod`, nothing changes: EDS responses have AEM's `x-robots-tag` removed (except `/system/`, which gets `noindex`), and `/robots.txt` goes to the existing site.

## Edge cache

Routes with `cache: true` fetch EDS with `cf.cacheEverything`, so Cloudflare's cache key is the rewritten `main--{AEM_SITE}--{AEM_ORG}.aem.live` URL (with the cleaned query). Every Worker in the same zone that fetches that URL shares the entry.

- **Tier: neutral.** The cached object is the origin response before the Worker touches it. The tier attribute, the non-prod `x-robots-tag` and the non-prod `robots.txt` are all applied after the fetch, per request, so a staging and a production Worker can't hand each other their tier. No tier is added to the cache key.
- **Host: not neutral.** EDS builds `canonical`, `og:url`, `og:image` and `twitter:image` from `x-forwarded-host`, which the Worker sets to the visitor's host. Checked against `main--atreyu--dallinbsmith.aem.live/blog`: `x-forwarded-host: stage.frame.io` returns `https://stage.frame.io/...` in all four. The host is not in the cache key, so a staging Worker and a production Worker routed in the same zone could serve each other's canonical URLs, and production pages could point at the staging host. Today every environment is on `workers.dev` and this can't happen. Before staging and production share a zone, either put staging in its own zone or add the forwarded host to the cache key.

## Environment variables

| Variable | Required | Set in | Effect |
|---|---|---|---|
| `DEPLOY_TIER` | yes | `wrangler.toml`, per environment (`dev`, `stage`, `prod`) | Must be `dev`, `stage` or `prod`. See [Deploy tier](#deploy-tier) |
| `AEM_ORG` | yes | `wrangler.toml` (`dallinbsmith`) | EDS code origin org (`main--{AEM_SITE}--{AEM_ORG}.aem.live`) |
| `AEM_SITE` | yes | `wrangler.toml` (`atreyu`) | EDS code origin site |
| `DA_ORG` | yes | `wrangler.toml` (`dallinbsmith`) | DA content org for `/dasc/` JSON. No fallback to `AEM_ORG`: the code org and the content org can differ |
| `DA_SITE` | yes | `wrangler.toml` (`atreyu`) | DA content site for `/dasc/` JSON. No fallback to `AEM_SITE` |
| `LEGACY_ORIGIN` | yes | `.dev.vars` locally; Cloudflare dashboard per environment | Hostname only (no scheme) of the existing site, used as `https://{LEGACY_ORIGIN}` |
| `PUSH_INVALIDATION` | no | `wrangler.toml` (`disabled` in all environments) | Must stay `disabled` until the environment has a zone route and AEM purge credentials; otherwise EDS sends 2-day edge cache headers that nothing purges |
| `EDS_DISABLED` | no | Dashboard | `'true'` sends every non-global, non-RUM request to the existing site. The kill switch |
| `ORIGIN_AUTHENTICATION` | no | Secret | Token for a protected EDS origin |

`wrangler.toml` sets `keep_vars = true`, so variables set in the dashboard survive a deploy. Variables in `wrangler.toml` aren't inherited by `[env.*]` blocks, so each environment lists all of them.
