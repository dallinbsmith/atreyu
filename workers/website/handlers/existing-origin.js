// Strangler fail-safe: proxies any request not yet migrated to EDS to the existing
// production origin (currently Vercel). Builds a fresh request from the original,
// unmodified url/request rather than reusing an EDS-rewritten request object.
export const fetchFromExistingOrigin = async ({ url, env, request }) => {
  const originUrl = new URL(`${url.pathname}${url.search}`, `https://${env.LEGACY_ORIGIN}`);
  const req = new Request(originUrl, request);
  // Host is a forbidden header name under Fetch's request guard, so this may no-op;
  // the actual outbound Host is determined by originUrl's hostname above.
  req.headers.set('host', env.LEGACY_ORIGIN);
  return fetch(req);
};
