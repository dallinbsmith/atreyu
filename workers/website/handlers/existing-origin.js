// Strangler fail-safe: proxies any request not yet migrated to EDS to the existing
// production origin (currently Vercel). Builds a fresh request from the original,
// unmodified url/request rather than reusing an EDS-rewritten request object.
//
// Bug-squash fix: this is the fallback for every path outside the current EDS_PATHS
// cohort — the highest-traffic fetch in the Worker — but had no timeout or error
// handling, unlike handlers/aem.js and handlers/redirects.js. A hung legacy origin
// had no bound beyond Cloudflare's platform-level kill, surfacing as a generic
// error page instead of a controlled 502. Matches those files' timeout pattern.
const ORIGIN_FETCH_TIMEOUT_MS = 10_000;

export const fetchFromExistingOrigin = async ({ url, env, request }) => {
  const originUrl = new URL(`${url.pathname}${url.search}`, `https://${env.LEGACY_ORIGIN}`);
  const req = new Request(originUrl, request);
  // Host is a forbidden header name under Fetch's request guard, so this may no-op;
  // the actual outbound Host is determined by originUrl's hostname above.
  req.headers.set('host', env.LEGACY_ORIGIN);
  try {
    return await fetch(req, { signal: AbortSignal.timeout(ORIGIN_FETCH_TIMEOUT_MS) });
  } catch {
    return new Response('Bad Gateway', { status: 502 });
  }
};
