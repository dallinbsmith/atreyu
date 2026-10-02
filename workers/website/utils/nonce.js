/**
 * CSP nonce utilities for Cloudflare Workers.
 *
 * Generates a cryptographically random nonce per request and swaps it in for
 * the `nonce="aem"` marker via HTMLRewriter, so the Content-Security-Policy
 * header can use 'nonce-{value}' 'strict-dynamic' instead of 'unsafe-inline'.
 *
 * Only elements that carry the marker are trusted. This is Adobe's EDS CSP
 * model (https://www.aem.live/docs/csp): trusted scripts are marked
 * `nonce="aem"` in head.html / 404.html, and the policy enforcer replaces the
 * marker with a random nonce. Do not stamp every script in origin HTML, because
 * authored content must not become trusted code.
 * - Marked `<script>` and `<link>` (modulepreload/preload) get the nonce;
 *   the marker value is replaced, never appended to.
 * - Everything else is left exactly as the origin sent it, including a
 *   script that carries some other nonce value: it won't match the policy,
 *   so it doesn't run. Scripts that trusted code inserts at runtime are
 *   covered by 'strict-dynamic', not by this rewrite.
 * - The marker is public, not a secret. The protection comes from the
 *   EDS/html2md pipeline, which never renders authored scripts or nonce
 *   attributes, so only this repo's head.html / 404.html can carry it.
 * - Without the Worker (aem.page/aem.live with no CSP configured, `aem up`)
 *   the marker is left literal and, with no policy, has no effect.
 * - If the AEM origin is ever given its own nonce CSP (headers.json), AEM
 *   will replace the marker itself and this rewrite will find nothing to
 *   stamp, so every script is blocked. Don't configure CSP in two places.
 */

/* global HTMLRewriter */

export const NONCE_MARKER = 'aem';
const MARKED = [`script[nonce="${NONCE_MARKER}"]`, `link[nonce="${NONCE_MARKER}"]`];

/** Generate a 128-bit cryptographically random base64-encoded nonce. */
export const generateNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
};

/**
 * Register the marker-replacing handlers on an existing HTMLRewriter, so
 * callers can combine them with other element handlers in one pass.
 */
export const stampNonce = (rewriter, nonce) => {
  const stamp = { element: (el) => { el.setAttribute('nonce', nonce); } };
  return MARKED.reduce((r, selector) => r.on(selector, stamp), rewriter);
};

/**
 * Replace the `nonce="aem"` marker with the per-request nonce on marked
 * <script>/<link> elements only. Returns a new transformed Response
 * (streaming — no buffering).
 */
export const addNonceToScripts = (response, nonce) => stampNonce(new HTMLRewriter(), nonce)
  .transform(response);
