# 0005. Canonical host is https://frame.io

**Status:** Accepted. The `www` redirect is not implemented in this repo.

## Decision

`https://frame.io` is canonical. `www.frame.io` returns a permanent redirect to it, keeping path and query. Canonical links, sitemap, `robots.txt`, structured data, CSP, analytics and redirect tests all use `frame.io`.

## Consequences

- Hard-code `https://frame.io` where an absolute production URL is needed (`helix-sitemap.yaml`, `scripts/utils/seo/jsonld.js`), never `www`.
- The `www` → apex redirect belongs at the edge (zone rule or Worker) once frame.io is behind Cloudflare.
