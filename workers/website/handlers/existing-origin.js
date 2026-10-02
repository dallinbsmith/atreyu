/* global HTMLRewriter */

import { stripDeployTier } from '../utils/deploy-tier.js';

// Strangler fail-safe: proxies any request not yet migrated to EDS to the existing
// production origin (currently Vercel). Builds a fresh request from the original,
// unmodified url/request rather than reusing an EDS-rewritten request object.
// This high-traffic fallback must have a timeout and controlled 502, matching
// handlers/aem.js and handlers/redirects.js.
const ORIGIN_FETCH_TIMEOUT_MS = 10_000;

export const fetchFromExistingOrigin = async ({ url, env, request }) => {
  // Assign the path rather than resolving it: as a relative URL, '//evil.com/'
  // or '/\\evil.com/' would replace the host (SSRF, content served as frame.io).
  const originUrl = new URL(`https://${env.LEGACY_ORIGIN}`);
  originUrl.pathname = url.pathname;
  originUrl.search = url.search;
  const req = new Request(originUrl, request);
  // Host is a forbidden header name under Fetch's request guard, so this may no-op;
  // the actual outbound Host is determined by originUrl's hostname above.
  req.headers.set('host', env.LEGACY_ORIGIN);
  let resp;
  try {
    resp = await fetch(req, { signal: AbortSignal.timeout(ORIGIN_FETCH_TIMEOUT_MS) });
  } catch {
    return new Response('Bad Gateway', { status: 502 });
  }
  // HTML only: strip any tier attribute; nothing else on this path changes.
  if (!resp.headers.get('content-type')?.includes('text/html')) return resp;
  return stripDeployTier(new HTMLRewriter()).transform(resp);
};
