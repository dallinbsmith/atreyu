# Runbook: the Cloudflare Worker

For `workers/website/` (Worker name `ak-website`). How it routes: [architecture/worker.md](../architecture/worker.md). Rules for changing it: [conventions/workers.md](../conventions/workers.md).

**Any change or deploy needs the repository owner's approval.** Today every environment deploys to `workers.dev`; nothing serves frame.io traffic yet.

## Local development

1. Install the pinned toolchain:

   ```sh
   npm ci --prefix workers/website
   ```

2. Create `workers/website/.dev.vars` (gitignored; never commit it). `LEGACY_ORIGIN` is required: without it every request returns 500 "Server misconfigured".

   ```sh
   # workers/website/.dev.vars
   LEGACY_ORIGIN=<hostname of the existing site, no https://>
   # Optional:
   # EDS_DISABLED=true
   # ORIGIN_AUTHENTICATION=<token, only if the EDS origin is protected>
   ```

   `DEPLOY_TIER` (`dev` locally), `AEM_ORG`, `AEM_SITE`, `DA_ORG`, `DA_SITE` and `PUSH_INVALIDATION` come from `wrangler.toml`.

3. Run it:

   ```sh
   cd workers/website
   npm run dev          # wrangler dev, usually http://localhost:8787
   ```

4. Check routing:

   | Request | Expect |
   |---|---|
   | `/blog`, `/glossary/...`, `/integrations/...` | Served from EDS (`main--atreyu--dallinbsmith.aem.live`); HTML has a `Content-Security-Policy` header with a nonce and `<html data-deploy-tier="dev">` |
   | Any path | `x-robots-tag: noindex, nofollow` (not on production) |
   | `/robots.txt` | `User-agent: *` / `Disallow: /` (not on production) |
   | `/blog/` | 308 to `/blog` |
   | `/pricing`, `/features/c2c`, `/ja-jp/blog` | Proxied to `LEGACY_ORIGIN` (no cell) |
   | `/v/anything` from the address bar | 404 |
   | `/drafts/x`, `/langstore/x` | 404 |

   ```sh
   curl -sI http://localhost:8787/blog | grep -i -E '^(HTTP|content-security-policy)'
   curl -sI http://localhost:8787/blog/ | grep -i -E '^(HTTP|location)'
   ```

5. Run the tests before pushing:

   ```sh
   node --test workers/website/test/*.test.js      # from the repo root
   ```

## Deploy

Prerequisites: Cloudflare access to the account that owns the Worker (`npx wrangler login`, or a `CLOUDFLARE_API_TOKEN` in the environment), and owner approval. There is no CI deploy; deploys are manual.

1. Merge the change to `main` (CI green).
2. Check the required variables. `DEPLOY_TIER`, `DA_ORG` and `DA_SITE` are required and are set in `wrangler.toml` for every environment (`[env.staging]` `stage`, `[env.production]` `prod`), alongside `AEM_ORG` and `AEM_SITE`. `LEGACY_ORIGIN` must be set in the Cloudflare dashboard (Worker → Settings → Variables); `keep_vars = true` keeps dashboard variables across deploys. A missing variable, or a `DEPLOY_TIER` other than `dev`, `stage` or `prod`, fails closed: every request returns 500 "Server misconfigured" until it is fixed. Don't override `DEPLOY_TIER` in the dashboard.
3. Deploy from an up-to-date `main`:

   ```sh
   cd workers/website
   npm run deploy:staging       # wrangler deploy --env staging
   npm run deploy:production    # wrangler deploy --env production, only after staging is checked
   ```

   If the upload fails with `Invalid routing manifest`, `routing-manifest.js` failed validation at module load; the listed errors name the bad entries. The previous version keeps serving. `cd workers/website && npm test` reproduces it locally.
4. Smoke-check the deployed URL with the table in step 4 above. On staging, `<html>` must say `data-deploy-tier="stage"` and every response must carry `x-robots-tag: noindex, nofollow`. On production, `data-deploy-tier="prod"`, no Worker `x-robots-tag` on pages, and `/robots.txt` comes from the existing site.

### Rules

- `PUSH_INVALIDATION` stays `disabled` until that environment has a zone route and AEM's purge credentials are configured and verified. Enabling it earlier makes EDS send 2-day edge-cache headers that nothing purges, so edits stay stale for up to two days.
- Don't route staging and production through the same Cloudflare zone until the edge cache key includes the forwarded host; EDS canonical and `og:url` depend on it ([worker.md → Edge cache](../architecture/worker.md#edge-cache)).
- Never configure a CSP on the EDS origin as well (`headers.json`): with two policies, every script is blocked.
- To bump `wrangler`, also bump `miniflare` to the exact version that wrangler release depends on; `node tools/check-miniflare-pin.mjs workers/website` (also in CI) checks it.

## Rollback

From fastest and broadest to most targeted:

| Situation | Action | Effect |
|---|---|---|
| Anything EDS serves is broken | Set `EDS_DISABLED` = `true` on the environment (dashboard variable) | Every non-global, non-RUM request goes to the existing site. No deploy needed |
| One cohort or locale is broken | Remove its entry from `CELLS` in `routing-manifest.js`, merge, deploy | Only that cell returns to the existing site |
| A Worker code change is broken | Roll back to the previous Worker version (`npx wrangler rollback --env <env>` or the dashboard's Deployments tab) | Previous code; variables are unaffected |
| A redirect is wrong | Fix the row in the DA `redirects` sheet, preview and publish | Picked up within 5 minutes (per-isolate cache) |

After any rollback, run the smoke checks again.

## Add a routing cell

See [architecture/worker.md → Adding a cell](../architecture/worker.md#adding-a-cell). Needs two engineering reviews and the owner's approval.
