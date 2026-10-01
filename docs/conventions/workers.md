# Worker conventions

Applies to `workers/website/**`, the Cloudflare Worker in front of the site. How it routes is described in [architecture/worker.md](../architecture/worker.md); how to run and deploy it is in [runbooks/worker.md](../runbooks/worker.md).

**Every change under `workers/` needs the repository owner's approval** (see [CONTRIBUTING.md](../../CONTRIBUTING.md#review)). Changes to `index.js` routes, `wrangler.toml` or `routing-manifest.js` `CELLS` affect which origin serves real traffic.

## Rules

- **No visitor-specific state at module scope, and never mutate `env`.** Cloudflare reuses an isolate across requests from different visitors, so a module-level `let` or an `env.X = ...` leaks one visitor's data into the next request. `formatRequest` builds a fresh `Request` and never writes `env`; keep it that way. Module-scope caching of global site config is fine (`handlers/redirects.js` caches `/redirects.json` with a TTL and an error backoff).
- Cloudflare's runtime, not Node: no `fs`, `path` or other Node built-ins.
- The Content-Security-Policy is built in one place, `buildCsp()` in `handlers/aem.js`, and applied to HTML responses with a per-request nonce. Add a new embed host to `frame-src` there; never set CSP per route.
- **Which paths EDS serves is decided only by `routing-manifest.js`** (`COHORTS` × `CELLS`). Never derive `CELLS` from another list.
  - Adding a cell needs two engineering reviews, passing tests and the owner's go-ahead.
  - A runtime switch is an `isCellLive(cell, env)` predicate passed to `createIsEdsPath`. It may only remove cells, must never throw (a throw counts as "not live"), and reads `env` per request.
- Every new upstream `fetch()` has a timeout and a defined failure response (see `handlers/existing-origin.js`: 10 s, then 502).
- Sanitize anything user-supplied before it goes into a response.
- Constants shared with browser code (the locale list in `utils/locale.js`) must match their browser counterpart; `npm run test:config-sync` checks this.

## Dependencies

- `wrangler` and `miniflare` are pinned to exact versions in `workers/website/package.json`. CI's `tools/check-miniflare-pin.mjs` fails if miniflare isn't pinned to the version wrangler expects. Bump both together and run the Worker tests.
- `workers/website` has its own `package-lock.json`; install with `npm ci --prefix workers/website`.

## Tests

- `node --test workers/website/test/*.test.js` from the repo root (or `npm test` inside `workers/website`). CI runs it on every PR.
- Test route changes locally with `wrangler dev` before deploying ([runbook](../runbooks/worker.md#local-development)).
