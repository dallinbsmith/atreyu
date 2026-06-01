# Redirect Map: Frame.io (Next.js/Vercel) → AEM EDS

This file documents the redirect spreadsheet that must be authored in DA.live
at the path `/redirects`. AEM EDS reads this natively and returns 301s.

## Spreadsheet Format

Create a document at `/redirects` in DA.live with two columns:

| Source | Destination |
|--------|-------------|
| /product | /products/frame-io |
| /features | /products/frame-io/features |
| /features/video-review | /products/frame-io/features/video-review |
| /features/approval-workflows | /products/frame-io/features/approval-workflows |
| /features/camera-to-cloud | /products/frame-io/features/camera-to-cloud |
| /features/integrations | /products/frame-io/features/integrations |
| /pricing | /products/frame-io/pricing |
| /enterprise | /products/frame-io/enterprise |
| /customers | /products/frame-io/customers |
| /customers/:slug | /products/frame-io/customers/:slug |
| /blog | /resources/blog |
| /blog/:slug | /resources/blog/:slug |
| /security | /trust/security |
| /privacy | /legal/privacy |
| /terms | /legal/terms |
| /about | /about |
| /careers | /careers |
| /contact | /contact |
| /login | https://app.frame.io |
| /signup | https://app.frame.io/signup |
| /api | https://developer.frame.io |
| /docs | https://developer.frame.io/docs |

## Rules

- Source paths are the OLD Next.js/Vercel URLs
- Destination paths are the NEW EDS URLs
- All redirects are 301 (permanent) by default
- AEM EDS handles trailing slashes and case normalization
- External destinations (app.frame.io, developer.frame.io) are supported
- Wildcards are NOT supported — each path needs an explicit row

## How to Build the Complete Map

1. Export all URLs from the current frame.io sitemap (or crawl with Screaming Frog)
2. Pull top pages from Google Search Console (sorted by clicks) to prioritize
3. Map each source URL to its new EDS destination
4. For pages not being migrated, redirect to the nearest parent
5. Test with `curl -I https://production-domain/old-path` after publishing

## Priority Pages (by organic traffic risk)

These pages likely carry the most SEO equity — map these first:

1. Homepage (`/`)
2. Product/features pages (`/features/*`)
3. Pricing (`/pricing`)
4. Blog posts with backlinks (`/blog/*`)
5. Integration pages (`/features/integrations/*`)
6. Customer stories (`/customers/*`)
7. API/developer docs (external redirect)
