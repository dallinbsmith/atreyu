import { stripLocale, matchLocalePrefix } from '../utils/locale.js';

let redirectMap = null;
let lastFetch = 0;
let lastFetchOk = true;
const TTL = 5 * 60 * 1000;
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

  try {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = '/redirects.json';
    const resp = await fetch(new Request(redirectUrl, { headers: request.headers }));
    lastFetch = Date.now();

    if (!resp.ok) {
      lastFetchOk = false;
      redirectMap ??= new Map();
      return;
    }

    const { data = [] } = await resp.json();
    redirectMap = new Map(data.map(({ Source, Destination }) => [normalize(Source), Destination]));
    lastFetchOk = true;
  } catch {
    // Network failure reaching /redirects.json is the same outage class as a
    // non-2xx response — record the attempt so we back off, don't retry every request.
    lastFetch = Date.now();
    lastFetchOk = false;
    redirectMap ??= new Map();
  }
};

const matchWildcard = (path) => {
  const entry = [...redirectMap].find(([src]) => src.endsWith('/*') && path.startsWith(src.slice(0, -1)));
  if (!entry) return null;
  const [src, dest] = entry;
  // Bug found and fixed 2026-08-28, separately from the locale-reprefixing
  // fix in the default export below: replacing the literal 2-char '/*'
  // dropped dest's own slash — '/legacy/*' -> '/modern/*' on '/legacy/foo'
  // produced '/modernfoo' instead of '/modern/foo'. Replacing just the '*'
  // preserves the slash dest already has immediately before the wildcard.
  return dest.replace('*', path.slice(src.length - 1));
};

// Same-origin guard: redirects.json is content-author-controlled, and a wildcard
// destination splices a user-controlled path segment into `dest`, so an unvalidated
// Location header is an open redirect. No cross-domain destinations were found in
// this repo (redirects.json is DA-managed content, not checked into git, so this is
// unverified against the live authored data) — default to same-origin-only and
// revisit if a legitimate external-redirect use case is confirmed.
const isSafeRedirectDest = (dest, requestUrl) => {
  if (dest.startsWith('/') && !dest.startsWith('//')) return true;
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

  // Bug-squash fix, 2026-08-28: normalize() strips the locale prefix so the
  // request path matches redirects.json's Source keys (authored without
  // locale prefixes), but `dest` was returned exactly as authored, with the
  // stripped prefix never re-applied — a /de-de/old-page visitor landed on
  // the unprefixed English /new-page instead of /de-de/new-page, for every
  // redirect entry, across all 9 non-default locales. Re-apply the same
  // prefix that was stripped — only for same-site relative destinations
  // (isSafeRedirectDest's `//`/cross-host branch isn't a page path to
  // re-prefix) and only if the author didn't already hardcode a locale
  // prefix into the destination themselves.
  const isRelativePath = dest.startsWith('/') && !dest.startsWith('//');
  const localizedDest = locale && isRelativePath && !matchLocalePrefix(dest)
    ? `${locale}${dest}`
    : dest;

  return new Response('', { status: 301, headers: { location: localizedDest } });
};
