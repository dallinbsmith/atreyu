/**
 * CSP nonce utilities for Cloudflare Workers.
 *
 * Generates a cryptographically random nonce per request and swaps it in for
 * the `nonce="aem"` marker via HTMLRewriter, so the Content-Security-Policy
 * header can use 'nonce-{value}' 'strict-dynamic' instead of 'unsafe-inline'.
 *
 * Decision (2026-09-24, security review of #108, Medium #1): only elements
 * that carry the marker are trusted. This is Adobe's own EDS model
 * (https://www.aem.live/docs/csp): trusted scripts are marked
 * `nonce="aem"` in head.html / 404.html, and whoever enforces the policy
 * replaces the marker value with a random nonce. Previously every <script>
 * in the origin HTML was stamped, which also trusted any script that came
 * from content rather than from this repo's code.
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
 * Replace the `nonce="aem"` marker with the per-request nonce on marked
 * <script>/<link> elements only. Returns a new transformed Response
 * (streaming — no buffering).
 */
export const addNonceToScripts = (response, nonce) => {
  const stamp = { element: (el) => { el.setAttribute('nonce', nonce); } };
  return MARKED
    .reduce((rewriter, selector) => rewriter.on(selector, stamp), new HTMLRewriter())
    .transform(response);
};
