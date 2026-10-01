import { stripLocale, matchLocalePrefix } from '../utils/locale.js';

let redirectMap = null;
// Derived with redirectMap on the same TTL refresh cadence, so wildcard
// matching does not rescan every redirect entry on every unmatched request.
let wildcardEntries = [];
let lastFetch = 0;
let lastFetchOk = true;
const TTL = 5 * 60 * 1000;
// This runs on the catch-all route ahead of fetchFromAem — a hang here (not
// just an error) previously had no bound at all and would have blocked
// every single page load, not just redirect lookups. AbortError from the
// timeout falls into the same catch block as any other fetch failure below,
// so the existing fail-open (empty Map, page proceeds normally) already
// covers it with no extra branching needed.
const FETCH_TIMEOUT_MS = 3000;
// Shorter backoff than TTL after a failed/errored fetch, so an outage on
// /redirects.json doesn't turn into a thundering-herd retry on every single
// request — but we still retry sooner than a full healthy-TTL cycle.
const ERROR_TTL = 30 * 1000;

// Strip a locale prefix before matching, the same way index.js's isEdsPath does —
// a redirect authored for /old-page must also fire for /de-de/old-page. Sourced
// from the same utils/locale.js list so this can't drift into its own wrong copy.
const normalize = (path) => stripLocale(path.replace(/\/+$/, '') || '/');

const loadRedirects = async (request) => {
  const ttl = lastFetchOk ? TTL : ERROR_TTL;
  if (redirectMap && Date.now() - lastFetch < ttl) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/redirects.json';
    const req = new Request(redirectUrl, { headers: request.headers });
    const resp = await fetch(req, { signal: controller.signal });
    lastFetch = Date.now();

    if (!resp.ok) {
      lastFetchOk = false;
      redirectMap ??= new Map();
      return;
    }

    const { data = [] } = await resp.json();
    const entries = data.map(({ Source, Destination }) => [normalize(Source), Destination]);
    redirectMap = new Map(entries);
    wildcardEntries = entries.filter(([src]) => src.endsWith('/*'));
    lastFetchOk = true;
  } catch {
    // Network failure reaching /redirects.json is the same outage class as a
    // non-2xx response — record the attempt so we back off, don't retry every request.
    lastFetch = Date.now();
    lastFetchOk = false;
    redirectMap ??= new Map();
  } finally {
    clearTimeout(timer);
  }
};

const matchWildcard = (path) => {
  const entry = wildcardEntries.find(([src]) => path.startsWith(src.slice(0, -1)));
  if (!entry) return null;
  const [src, dest] = entry;
  // Replace only the wildcard, preserving the slash the destination carries
  // immediately before it.
  return dest.replace('*', path.slice(src.length - 1));
};

// Single source of truth for "is this a same-site relative path" — used by both
// the open-redirect guard below and the locale-reprefixing logic in the default
// export. Normalize backslashes before checking: browsers treat '\' like '/'
// during URL parsing, so '/\evil.com' must be rejected like '//evil.com'.
const isRelativePath = (path) => {
  const normalized = path.replace(/\\/g, '/');
  return normalized.startsWith('/') && !normalized.startsWith('//');
};

// Same-origin guard: redirects.json is content-author-controlled, and a wildcard
// destination splices a user-controlled path segment into `dest`, so an unvalidated
// Location header is an open redirect. No cross-domain destinations were found in
// this repo (redirects.json is DA-managed content, not checked into git, so this is
// unverified against the live authored data) — default to same-origin-only and
// revisit if a legitimate external-redirect use case is confirmed.
const isSafeRedirectDest = (dest, requestUrl) => {
  if (isRelativePath(dest)) return true;
  try {
    return new URL(dest, requestUrl).hostname === requestUrl.hostname;
  } catch {
    return false;
  }
};

export default async ({ request }) => {
  await loadRedirects(request);

  const requestUrl = new URL(request.url);
  const locale = matchLocalePrefix(requestUrl.pathname);
  const path = normalize(requestUrl.pathname);
  const dest = redirectMap.get(path) ?? matchWildcard(path);

  if (!dest || !isSafeRedirectDest(dest, requestUrl)) return null;

  // Re-apply the stripped locale only to same-site relative destinations, and
  // only when the authored destination does not already include a locale.
  const localizedDest = locale && isRelativePath(dest) && !matchLocalePrefix(dest)
    ? `${locale}${dest}`
    : dest;

  return new Response('', { status: 301, headers: { location: localizedDest } });
};
