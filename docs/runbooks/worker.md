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

   `AEM_ORG`, `AEM_SITE` and `PUSH_INVALIDATION` come from `wrangler.toml`.

3. Run it:

   ```sh
   cd workers/website
   npm run dev          # wrangler dev, usually http://localhost:8787
   ```

4. Check routing:

   | Request | Expect |
   |---|---|
   | `/blog`, `/glossary/...`, `/integrations/...` | Served from EDS (`main--atreyu--dallinbsmith.aem.live`); HTML has a `Content-Security-Policy` header with a nonce |
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
2. Make sure the target environment has `LEGACY_ORIGIN` set in the Cloudflare dashboard (Worker → Settings → Variables). `keep_vars = true` in `wrangler.toml` keeps dashboard variables across deploys.
3. Deploy from an up-to-date `main`:

   ```sh
   cd workers/website
   npm run deploy:staging       # wrangler deploy --env staging
   npm run deploy:production    # wrangler deploy --env production, only after staging is checked
   ```

4. Smoke-check the deployed URL with the table in step 4 above.

### Rules

- `PUSH_INVALIDATION` stays `disabled` until that environment has a zone route and AEM's purge credentials are configured and verified. Enabling it earlier makes EDS send 2-day edge-cache headers that nothing purges, so edits stay stale for up to two days.
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
