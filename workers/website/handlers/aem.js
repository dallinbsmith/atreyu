/* global HTMLRewriter */

import { generateNonce, stampNonce } from '../utils/nonce.js';
import { stampDeployTier } from '../utils/deploy-tier.js';
import { stripLocale } from '../utils/locale.js';

// Mutates the redirect response in place. It deliberately returns nothing so
// callers continue through the CSP/security-header path for redirects.
const appendSavedSearch = (resp, savedSearch) => {
  if (!(resp.status === 301 && savedSearch)) return;
  const location = resp.headers.get('location');
  if (location && !location.match(/\?.*$/)) {
    resp.headers.set('location', `${location}${savedSearch}`);
  }
};

// Open-ended schedule rows are active from `start` onward or until `end`.
// Avoid comparing Invalid Date for the missing side.
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

// Negative-cache cap. AEM may send long CDN TTLs because it expects publish
// purges to clear Cloudflare. Until purge credentials are live, never store
// 404/410/5xx responses at the edge: validators on stale 404s can turn a later
// publish into a repeated 304/404 loop. Use -1, not 0: 0 still stores the
// response and its validators. Other statuses keep AEM's own TTL.
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
// connect-src/img-src keep *.aem.live/*.aem.page for da.js fetches during
// ?dapreview, and *.hlx.page for the RUM sendBeacon; only script-src and
// frame-ancestors drop them. Not allowed on purpose: Segment device-mode
// destinations, Adobe Launch, profiles.segment.com — widening is a consent
// decision (docs/decisions/0010-consent-model.md). Hosts are observed, not
// proven complete.
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

// The edge cache stores the origin response as AEM sent it. Everything
// tier-specific (the <html> tier attribute here, non-prod x-robots-tag and
// robots.txt in index.js) is applied after the fetch, so a cached object
// never carries one Worker's tier. It does carry host-specific output: AEM
// builds canonical, og:url and og:image from x-forwarded-host (see
// docs/architecture/worker.md#edge-cache).
export const fetchFromAem = async ({
  request, env, cache, savedSearch,
}) => {
  // Convert origin failures into controlled gateway responses instead of
  // letting an exception escape the ROUTES loop.
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

    // One pass: nonce markers and the Worker's tier on <html>.
    return stampDeployTier(stampNonce(new HTMLRewriter(), nonce), env.DEPLOY_TIER).transform(resp);
  }

  return resp;
};

export const fetchSchedule = async ({
  request, env, cache, savedSearch,
}) => {
  const resp = await fetchFromAem({
    request, env, cache, savedSearch,
  });

  if (resp.status === 301 || resp.status === 304) return resp;

  return formatSchedule(resp);
};
