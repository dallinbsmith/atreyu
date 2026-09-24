import { generateNonce, addNonceToScripts } from '../utils/nonce.js';
import { stripLocale } from '../utils/locale.js';

// Bug-squash fix, 2026-08-28: never returned a value on its success path —
// its job is the header mutation below, done in place on the same `resp`
// object the caller keeps using, not producing a value to check. The old
// call site (`const redirectResp = getRedirect(...); if (redirectResp)
// return redirectResp;`) was dead code that looked like a short-circuit but
// could never fire, since `redirectResp` was always undefined — a real trap
// for the next person who "fixed" it into an early return, which would have
// skipped the CSP/security-header block below for every redirect response.
const appendSavedSearch = (resp, savedSearch) => {
  if (!(resp.status === 301 && savedSearch)) return;
  const location = resp.headers.get('location');
  if (location && !location.match(/\?.*$/)) {
    resp.headers.set('location', `${location}${savedSearch}`);
  }
};

// Bug-squash fix, 2026-08-28: comparing through `new Date(undefined)` (which
// is Invalid Date, and any comparison against it is always false) silently
// excluded an open-ended schedule entry — one with only `start` set ("active
// from then on, no expiry") or only `end` set ("active until then, no
// defined start") — instead of treating it as active. Only the both-blank
// case was ever handled as "always active."
const isScheduleActive = (start, end, now) => {
  if (!start && !end) return true;
  if (start && !end) return new Date(start) < now;
  if (!start && end) return new Date(end) > now;
  return new Date(start) < now && new Date(end) > now;
};

const formatSchedule = async (response) => {
  const schedule2Response = (json) => new Response(JSON.stringify(json), response);

  const json = await response.json();
  if (!json.data?.at(0)?.fragment) return schedule2Response(json);

  const now = Date.now();
  const data = json.data.filter(({ start, end }) => isScheduleActive(start, end, now));

  return schedule2Response({ ...json, data });
};

// This proxies a real page render, not a small API call, so the bound is
// generous — but an origin that hangs indefinitely (never errors, never
// responds) previously had no bound at all beyond Cloudflare's own
// platform-level CPU/wall-clock limit, which kills the whole invocation with
// a generic platform error instead of a controlled 504. Matches Vitamix's
// own proxy-Worker precedent (AbortController timeout with a fallback).
const ORIGIN_FETCH_TIMEOUT_MS = 10_000;

// Negative-cache cap. AEM's CDN TTL depends on the request headers
// formatRequest (index.js) sends (checked 2026-09-24 with curl against
// aem.live). With `x-byo-cdn-type` alone, AEM sends
// `cdn-cache-control: max-age=300`. With `x-push-invalidation: enabled`, which
// the Worker sends unless PUSH_INVALIDATION is 'disabled', it sends
// `max-age=172800` on every status, 200s and 404s alike, because it expects to
// purge the CDN itself on publish. That purge needs a Cloudflare zone and
// working purge credentials. Without them, a cached 404 for a page that is
// later published would stay for 2 days (and a stale 200 too, which is why
// wrangler.toml keeps PUSH_INVALIDATION disabled until the zone purge works).
// Decision for error statuses, whatever the TTL source:
// - 404: never cached at the edge (-1). An earlier 60 s cap (PR #105) didn't
//   work, because of a revalidation trap (reproduced on the POC 2026-09-24).
//   AEM's 404 for a not-yet-published page carries a `Last-Modified` (the same
//   value the published 200 later has). When the cached 404 goes stale,
//   Cloudflare revalidates with If-Modified-Since, aem.live answers
//   304 Not Modified, and the edge keeps serving the stored 404 indefinitely
//   (HIT, REVALIDATED, HIT...). The edge stores the raw origin response and
//   its validators, so rewriting headers in the Worker can't break the loop.
//   The only fix is not to store 404s.
// - 5xx: never cached. Cloudflare's `cacheTtlByStatus` docs say a negative
//   value means "do not cache"; 0 would store and immediately expire, which
//   still keeps validators to revalidate against.
// - Statuses not listed (2xx, 3xx) keep AEM's own cdn-cache-control. Per the
//   docs, the override applies only when the status matches.
// Only applies when the route caches (cache: true); GET/HEAD only per the docs.
// capErrorCaching below handles downstream CDNs and browsers.
export const CACHE_TTL_BY_STATUS = Object.freeze({ 404: -1, '500-599': -1 });

// Downstream/browser half of the cap above: cf.cacheTtlByStatus only governs
// Cloudflare's own edge cache, so without this a browser or any cache in front
// of the Worker would keep AEM's error headers (cache-control max-age=7200,
// cdn-cache-control up to 172800).
// 404 keeps a short `max-age=60`, which saves a refetch when a page requests the
// same missing asset repeatedly. `last-modified` and `etag` are dropped from
// 404 and 5xx responses, so a browser or downstream cache that stores one from
// now on holds no validator and does a full refetch once it goes stale.
// Browsers that stored a 404 *with* a validator before this shipped are
// covered separately: formatRequest (index.js) doesn't forward
// If-Modified-Since, so once the page is published AEM can't turn their
// revalidation into a 304. 3xx responses, including 304, are left untouched
// and keep their validators.
const ERROR_VALIDATORS = ['last-modified', 'etag'];
const capErrorCaching = (resp) => {
  if (resp.status !== 404 && resp.status < 500) return;
  resp.headers.set('cache-control', resp.status === 404 ? 'max-age=60' : 'no-store');
  resp.headers.delete('cdn-cache-control');
  ERROR_VALIDATORS.forEach((h) => resp.headers.delete(h));
};

// /system/ holds site plumbing (nav/footer fragments, placeholders.json), not
// pages. AEM marks it noindex, but the x-robots-tag delete below strips that
// for every response, so re-add it here to keep fragments out of search on
// frame.io. Locale-stripped, the same way isEdsPath matches /de-de/system/.
const SYSTEM_ROOT = '/system/';
const isSystemPath = (pathname) => stripLocale(pathname).startsWith(SYSTEM_ROOT);

export const fetchFromAem = async ({ request, cache, savedSearch }) => {
  // Bug-squash fix, 2026-08-28: no try/catch existed around this fetch — an
  // origin DNS/network failure propagated as an unhandled exception through
  // the ROUTES loop instead of a controlled response, unlike the newer
  // workers/decision-endpoint Worker's own fail-open pattern. A 502 here is a
  // real, correct signal (upstream fetch failed) rather than Cloudflare's
  // generic default error page for an uncaught exception.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORIGIN_FETCH_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(request, {
      method: request.method,
      cf: cache
        ? { cacheEverything: true, cacheTtlByStatus: CACHE_TTL_BY_STATUS }
        : { cacheEverything: false },
      signal: controller.signal,
    });
  } catch {
    return new Response(
      controller.signal.aborted ? 'Gateway Timeout' : 'Bad Gateway',
      { status: controller.signal.aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }

  resp = new Response(resp.body, resp);

  appendSavedSearch(resp, savedSearch);

  resp.headers.delete('age');
  resp.headers.delete('x-robots-tag');
  capErrorCaching(resp);
  if (isSystemPath(new URL(request.url).pathname)) resp.headers.set('x-robots-tag', 'noindex');

  if (resp.headers.get('content-type')?.includes('text/html')) {
    const nonce = generateNonce();

    // Bug-squash fixes, 2026-08-28, verified against this codebase's real
    // dependencies (not assumed) before narrowing anything:
    // - script-src/frame-ancestors previously trusted Adobe's SHARED,
    //   multi-tenant *.aem.live/*.aem.page hosting domains — any other
    //   Adobe EDS customer's site lives under those wildcards, so in a
    //   browser without strict-dynamic support the host list becomes the
    //   effective policy, and frame-ancestors let any other EDS tenant
    //   iframe this site. Checked directly: scripts here are always
    //   same-origin (this Worker proxies to the AEM origin server-side,
    //   `formatRequest` above — the browser never loads a <script> straight
    //   from *.aem.live), and da.js/quick-edit.js (the only real dependency
    //   on that domain) are authoring-only, loaded via a same-origin
    //   relative import behind ?dapreview, never via a cross-origin script
    //   tag. No legitimate need found for either wildcard — dropped both.
    // - connect-src was missing *.hlx.page entirely (only had hlx.live) —
    //   scripts/vendor/rum.js's real beacon call is
    //   `navigator.sendBeacon(url, ...)` to rum.hlx.page, which CSP governs
    //   via connect-src, not img-src (where hlx.page WAS already present).
    //   RUM was likely being silently blocked by this CSP in any
    //   CSP-enforcing browser — a second, independent way RUM delivery
    //   could break, on top of the earlier F-61 .hlxignore bug. Added.
    // - connect-src/img-src's *.aem.live/*.aem.page wildcard is kept as-is:
    //   da.js's real fetch() calls during ?dapreview authoring are a
    //   genuine, narrow dependency here, unlike script-src/frame-ancestors.
    // - script-src/frame-src's calendly.com entries (2026-09-17): the
    //   hero-calendly block embeds a live, inline Calendly scheduling
    //   widget — a real third-party script + iframe, not a static library
    //   (unlike gsap, this can't be vendored locally; it talks to
    //   Calendly's own backend). Single-host, no wildcard subdomains.
    resp.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'nonce-${nonce}' 'strict-dynamic' https://assets.calendly.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.aem.live https://*.aem.page https://*.hlx.live https://*.hlx.page",
      "font-src 'self'",
      "connect-src 'self' https://*.aem.live https://*.aem.page https://*.hlx.live https://*.hlx.page",
      "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://calendly.com",
      "media-src 'self' https://*.youtube.com https://*.ytimg.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
    resp.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    resp.headers.set('X-Content-Type-Options', 'nosniff');
    resp.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    resp.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return addNonceToScripts(resp, nonce);
  }

  return resp;
};

export const fetchSchedule = async ({ request, cache, savedSearch }) => {
  const resp = await fetchFromAem({ request, cache, savedSearch });

  if (resp.status === 301 || resp.status === 304) return resp;

  return formatSchedule(resp);
};
