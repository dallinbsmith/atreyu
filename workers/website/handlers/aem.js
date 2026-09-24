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
// - 410: treated exactly like 404. AEM doesn't send it today, but a Gone page
//   can be republished and would hit the same Last-Modified/304 trap.
// - 5xx: never cached. Cloudflare's `cacheTtlByStatus` docs say a negative
//   value means "do not cache"; 0 would store and immediately expire, which
//   still keeps validators to revalidate against.
// - Statuses not listed (2xx, 3xx) keep AEM's own cdn-cache-control. Per the
//   docs, the override applies only when the status matches.
// Only applies when the route caches (cache: true); GET/HEAD only per the docs.
// capErrorCaching below handles downstream CDNs and browsers.
export const CACHE_TTL_BY_STATUS = Object.freeze({ 404: -1, 410: -1, '500-599': -1 });

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
// Other 4xx (400, 401, 403, 405...) aren't listed: they describe the request
// or its credentials, not whether a document exists, so publishing can't flip
// them to 200. They keep AEM's headers.
const MISSING_STATUSES = [404, 410];
const ERROR_VALIDATORS = ['last-modified', 'etag'];
const capErrorCaching = (resp) => {
  const missing = MISSING_STATUSES.includes(resp.status);
  if (!missing && resp.status < 500) return;
  resp.headers.set('cache-control', missing ? 'max-age=60' : 'no-store');
  resp.headers.delete('cdn-cache-control');
  ERROR_VALIDATORS.forEach((h) => resp.headers.delete(h));
};

// /system/ holds site plumbing (nav/footer fragments, placeholders.json), not
// pages. AEM marks it noindex, but the x-robots-tag delete below strips that
// for every response, so re-add it here to keep fragments out of search on
// frame.io. Locale-stripped, the same way isEdsPath matches /de-de/system/.
const SYSTEM_ROOT = '/system/';
const isSystemPath = (pathname) => stripLocale(pathname).startsWith(SYSTEM_ROOT);

// Content-Security-Policy for EDS HTML responses.
//
// Bug-squash fixes, 2026-08-28, verified against this codebase's real
// dependencies (not assumed) before narrowing anything:
// - script-src/frame-ancestors previously trusted Adobe's SHARED,
//   multi-tenant *.aem.live/*.aem.page hosting domains — any other
//   Adobe EDS customer's site lives under those wildcards, so in a
//   browser without strict-dynamic support the host list becomes the
//   effective policy, and frame-ancestors let any other EDS tenant
//   iframe this site. Checked directly: scripts here are always
//   same-origin (this Worker proxies to the AEM origin server-side,
//   `formatRequest` in index.js — the browser never loads a <script> straight
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
// - frame-src's calendly.com entry (2026-09-17): the hero-calendly block
//   embeds a live, inline Calendly scheduling widget, a real third-party
//   script + iframe rather than a static library (unlike gsap, it can't
//   be vendored locally; it talks to Calendly's own backend). Single host,
//   no wildcard subdomains.
// - script-src has no Calendly host (Q-E F3, 2026-09-24). Under
//   'strict-dynamic', CSP3 browsers ignore host-source entries in
//   script-src. widget.js is loaded by the block through
//   scripts/utils/script.js, i.e. created by already-trusted code, so
//   'strict-dynamic' is what allows it. The host entry granted nothing and
//   read like an allowlist that wasn't in force. Verified in headless
//   Chrome: the widget loads and renders its calendly.com iframe with zero
//   violations after removal.
// - OneTrust + Segment (P3.2, 2026-09-24): hosts come from network captures
//   plus a read of the vendor code, not guesses. Falkor's chain (origin/
//   develop, web/src/components/atoms/Analytics/scripts/Segment.tsx) was
//   captured on frame.io in headless Chrome (EU accept, EU reject, US), and
//   the same chain was re-run on a Worker-served EDS page with every
//   securitypolicyviolation recorded. The first capture was NOT complete:
//   it opened the preference center with OneTrust.ToggleInfoDisplay() and
//   clicked OneTrust's buttons, bypassing privacy-standalone's own entry
//   points, so it never saw privacy-standalone's consent telemetry (below).
//   Re-captured through adobePrivacy.showPreferenceCenter() with real
//   clicks on frame.io and on EDS (EU accept and EU reject). Treat this
//   list as "every host seen for this chain so far, plus every host
//   literal in privacy-standalone.js (only cdn.cookielaw.org, geo2 and
//   sstats.adobe.com)", not as proven complete; OneTrust and Segment
//   builds were not source-audited. Re-capture when vendor scripts change.
//   * Scripts need NO host entries: privacy-standalone.js (www.adobe.com),
//     its geo2.adobe.com JSONP, otSDKStub/otBannerSdk (cdn.cookielaw.org)
//     and Segment's analytics.js + integrations (cdn.segment.com) are all
//     inserted by an already-trusted script, which 'strict-dynamic'
//     propagates to. That trusted loader is the nonce'd EDS script that
//     P4.1 adds; until it lands nothing on EDS loads this chain. Listing
//     the hosts would only widen the policy for CSP2-only browsers.
//   * connect-src: OneTrust fetches its consent config and fetches its CSS
//     as text (cdn.cookielaw.org), looks up geo (geolocation.onetrust.com)
//     and POSTs a consent receipt on every accept/reject
//     (privacyportal.onetrust.com). privacy-standalone.js XHR-POSTs each
//     consent interaction to sstats.adobe.com/ee/v1/interact: per its
//     source showBanner, show/close modal and choice enable/disable/custom;
//     observed showModal, choice/enable and choice/disable. Segment fetches
//     settings (cdn.segment.com) and sends events and metrics
//     (api.segment.io). profiles.segment.com is left out on purpose: it
//     only appeared when the settings fetch was CSP-blocked and the snippet
//     fell back to analytics.classic.js; with settings reachable it runs
//     analytics-next (same as Falkor) and never calls it.
//   * img-src: only cdn.cookielaw.org (preference-center logos).
//   * style-src/font-src/frame-src: nothing. OneTrust injects the CSS it
//     fetched as an inline <style>, already allowed by 'unsafe-inline'.
//   * NOT allowed here, deliberately: the Segment device-mode destinations
//     (gtag/GA4, Google Ads, Facebook Pixel, the GTM container and what it
//     loads: LinkedIn, Clearbit, 6sense, MNTN, Contentsquare) and Adobe
//     Launch (www.adobe.com/marketingtech -> assets.adobedtm.com and its
//     own sstats.adobe.com calls, which the connect-src entry above now
//     also permits). Their scripts still load via 'strict-dynamic' but
//     their other beacons are blocked. Whether EDS should run those at all
//     is a consent/marketing decision (PLAN.md P4.1), not something to
//     widen the CSP for silently.
// - object-src 'none': no plugin content is used; default-src 'self' would
//   otherwise allow same-origin <object>/<embed>.
export const CONSENT_ANALYTICS_CSP = Object.freeze({
  connect: Object.freeze([
    'https://cdn.cookielaw.org',
    'https://geolocation.onetrust.com',
    'https://privacyportal.onetrust.com',
    'https://cdn.segment.com',
    'https://api.segment.io',
    'https://sstats.adobe.com',
  ]),
  img: Object.freeze(['https://cdn.cookielaw.org']),
});

// Pure: the nonce is generated per request by the caller; nothing here is
// per-request state held at module scope. The nonce is interpolated into a
// header, so anything outside the base64 alphabet (a quote, ';', space)
// would let a caller rewrite the policy; reject it instead.
const NONCE_PATTERN = /^[A-Za-z0-9+/=]+$/;
export const buildCsp = (nonce) => {
  if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) {
    throw new TypeError('buildCsp: nonce must be a non-empty base64 string');
  }
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data: https://*.aem.live https://*.aem.page https://*.hlx.live https://*.hlx.page", ...CONSENT_ANALYTICS_CSP.img].join(' '),
    "font-src 'self'",
    ["connect-src 'self' https://*.aem.live https://*.aem.page https://*.hlx.live https://*.hlx.page", ...CONSENT_ANALYTICS_CSP.connect].join(' '),
    "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://calendly.com",
    "media-src 'self' https://*.youtube.com https://*.ytimg.com",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
};

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

    resp.headers.set('Content-Security-Policy', buildCsp(nonce));
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
