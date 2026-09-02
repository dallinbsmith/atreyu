# decision-endpoint (P0-44)

Thin personalization decision endpoint: reverse-IP firmographic lookup via
Clearbit Reveal -> coarse segment (`enterprise` / `default`) -> `{ segment }`
JSON + a segment cookie. Fails open on any Clearbit failure/timeout. See the
spec comment at the top of `index.js` for lifecycle/error-semantics/rationale.

**Status:** pending, not deployed. This project has no Cloudflare account and
no real Clearbit key provisioned yet (implementation-plan.md P0-0) - blocked
on that external dependency, not on anything technical. This package is
structurally ready to deploy once both exist, and is fully exercisable
locally today via a mock mode — no real credentials needed.

## Run it locally

```sh
cd site/workers/decision-endpoint
npm install
npm run dev          # wrangler dev, listens on http://localhost:8787
```

### Mock mode (no Clearbit key needed)

`wrangler.toml` sets `MOCK_CLEARBIT = "true"` for local dev. With that set,
any request carrying `mockSegment`, `mockLatency`, or `mockError` takes the
mock branch instead of calling the real Clearbit API:

```sh
# default segment, no artificial latency
curl -si "http://localhost:8787/?mockSegment=default"

# enterprise segment, 300ms simulated Clearbit latency
curl -si "http://localhost:8787/?mockSegment=enterprise&mockLatency=300"

# latency sweep the client-runtime harness needs (all comfortably under the
# 2000ms REVEAL_TIMEOUT_MS in index.js, so none of these trip fail-open)
for ms in 50 150 300 600 1200; do
  curl -s -o /dev/null -w "mockLatency=$ms -> %{time_total}s\n" \
    "http://localhost:8787/?mockSegment=enterprise&mockLatency=$ms"
done

# force the fail-open path directly (no need to wait out a real timeout)
curl -si "http://localhost:8787/?mockError=true"
# -> 200 { "segment": "default" }, x-pzn-failed-open: true, cookie still set

# exceed REVEAL_TIMEOUT_MS to test the *timeout* fail-open path specifically
curl -si "http://localhost:8787/?mockSegment=enterprise&mockLatency=2500"
# -> still 200 { "segment": "default" } (fails open before mock resolves),
#    NOT "enterprise" — this is the case worth checking by hand once, since
#    it's the one place a race condition would show up if REVEAL_TIMEOUT_MS
#    and the mock timer were wired together incorrectly
```

Check the `set-cookie` response header on any of the above —
`frameio-pzn-segment=<segment>; Path=/; SameSite=Lax` (no `Secure` over plain
`http://localhost`, present once served over `https://`).

### Real-Clearbit mode

Copy `.dev.vars.example` to `.dev.vars` and set `CLEARBIT_API_KEY` — only
possible once a real key exists (P0-0). Requests with none of
`mockSegment`/`mockLatency`/`mockError` set take the real branch and call
`https://reveal.clearbit.com/v1/companies/find` with the visitor's
`cf-connecting-ip`. Under plain `wrangler dev` (no `--remote`), `cf-connecting-ip`
isn't set by anything, so the IP will be empty — this path is really only
meaningful against a deployed Worker or `wrangler dev --remote`.

## What's decided vs. what's this file's own assumption

- **Decided by the plan:** thin endpoint, holds the Clearbit key, reverse-IP
  -> coarse segment, `{ segment }` response, sets a segment cookie, fails
  open on a tight timeout, consent is the caller's job not this endpoint's.
- **This file's own proposal, not specified by the plan — flag before
  treating as final:**
  - Cookie name/shape: `frameio-pzn-segment`, session-lifetime (no
    Max-Age), `Path=/; SameSite=Lax`, `Secure` only over https, deliberately
    **not** `HttpOnly` (the client runtime must read it directly). See the
    comment in `handlers/cookie.js`.
  - Exact timeout value: 2000ms, reused from the already-validated
    `spike/edge/reveal.js` race cap (P0-36), not a fresh number invented for
    this file.
  - Fail-open still sets the cookie (to `default`) rather than leaving it
    unset — trades "a transient Clearbit blip pins a session to `default`"
    against "every page load retries Clearbit for the rest of a failing
    session." Revisit if this trade turns out wrong in practice.
  - CORS/`ALLOWED_ORIGIN` handling exists only for testing; the intended
    deploy shape (co-located with the delivery worker on frame.io's own
    zone) needs none of it. See the comment above `corsHeaders` in
    `index.js` for the sharper cross-origin-cookie problem this doesn't
    solve.

## Needs a security review pass

Flagging explicitly, per this project's review conventions — **do not treat
this file's own judgment on secret handling as sufficient sign-off**:

- Secret handling: `CLEARBIT_API_KEY` is read only from `env` (`wrangler
  secret put` in a real deployment, `.dev.vars` locally), never hardcoded,
  never logged, never echoed into a response header. Worth an
  `aem-security-engineer` pass specifically on whether that's sufficient —
  e.g. whether the key could leak via an uncaught error message, a future
  debug header, or Wrangler tail logs.
- The segment cookie is deliberately non-`HttpOnly` and readable/writable by
  any same-origin script (see above) — worth confirming that's an acceptable
  tradeoff given it only ever carries a coarse, non-secret segment label.
- `MOCK_CLEARBIT`/mock query params are designed to be inert unless the var
  is explicitly `"true"` in `wrangler.toml` — worth confirming this can't be
  flipped on accidentally in a real deploy config derived from this one.
