/**
 * CSP nonce utilities for Cloudflare Workers.
 *
 * Generates a cryptographically random nonce per request and injects it into
 * <script> tags via HTMLRewriter so the Content-Security-Policy header can
 * use 'nonce-{value}' instead of 'unsafe-inline'.
 */

/* global HTMLRewriter */

/** Generate a 128-bit cryptographically random base64-encoded nonce. */
export const generateNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
};

/**
 * Use HTMLRewriter to add a `nonce` attribute to every <script> tag in the
 * response body. Returns a new transformed Response (streaming — no buffering).
 */
export const addNonceToScripts = (response, nonce) => new HTMLRewriter()
  .on('script', {
    element: (el) => {
      el.setAttribute('nonce', nonce);
    },
  })
  .transform(response);
