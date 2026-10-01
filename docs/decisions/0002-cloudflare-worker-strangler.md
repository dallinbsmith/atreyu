# 0002. Cloudflare Worker as the migration router and CDN

**Status:** Accepted.

## Context

The migration moves frame.io from the existing site to EDS one URL group at a time. Something in front of both has to decide, per request, which one answers. Running that router inside the app being replaced would tie the migration to it.

## Decision

A Cloudflare Worker (`workers/website/`, based on Adobe's reference BYO-CDN Worker) sits in front of frame.io. It routes each request to EDS or to the existing site, and stays as the permanent CDN after the migration.

## Consequences

- Routing is code: `workers/website/routing-manifest.js` ([architecture/worker.md](../architecture/worker.md)).
- The Worker also owns CSP nonces, redirects, `/drafts` and `/langstore` denial, and `/v/` gating.
- Worker changes are high-risk and need the owner's approval ([CONTRIBUTING.md](../../CONTRIBUTING.md#review)).
- Until frame.io DNS points at the Worker, nothing in this repo serves production traffic.
