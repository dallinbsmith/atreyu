/*
 * spike/decision-endpoint — thin personalization decision endpoint (P0-44).
 * Spike only: not wired into workers/website/ and not deployed anywhere.
 *
 * Spec (kept next to the code it governs, per this project's spec-first rule):
 * - Lifecycle: one-shot per request, no session/decision state carried
 *   between requests. Cloudflare keeps a Worker instance warm across many
 *   requests from different visitors, so nothing about *this* visitor (IP,
 *   resolved segment, mock params) may be read from or written to a
 *   module-level binding — everything below lives inside `fetch()`.
 * - Input: visitor IP via the CF-trusted `cf-connecting-ip` header (the
 *   signal Clearbit Reveal's reverse-IP lookup needs); `x-forwarded-for` is
 *   a local-dev-only fallback since `cf-connecting-ip` isn't present under
 *   plain `wrangler dev`.
 * - Output: always `200 { segment }` — Clearbit being down is never this
 *   endpoint's caller's problem to handle as an error status.
 * - Error semantics: ANY failure resolving a real segment (missing key,
 *   non-2xx, network error, or exceeding REVEAL_TIMEOUT_MS) fails open to
 *   DEFAULT_SEGMENT. The cookie is still set on fail-open (see handlers/
 *   cookie.js) so a single bad Clearbit round-trip doesn't retry on every
 *   page load for the rest of the session — a deliberate choice, not a given.
 * - Consent is explicitly NOT this endpoint's job: the client-side runtime
 *   (the sibling fork's work, spike/decision-endpoint/../<client-runtime>)
 *   must not call this endpoint at all when analytics/personalization
 *   consent is denied. This file has no visibility into consent state and
 *   must never be treated as a consent backstop.
 */

import { deriveSegment, DEFAULT_SEGMENT } from './handlers/segment.js';
import { fetchReveal } from './handlers/reveal.js';
import { fetchMockReveal } from './handlers/mock-reveal.js';
import { buildSegmentCookieHeader } from './handlers/cookie.js';

// Ported from spike/edge/reveal.js's own effective race cap (~2000ms, already
// validated against the real API in P0-36) — not a fresh guess at "tight."
const REVEAL_TIMEOUT_MS = 2000;
const MOCK_PARAMS = ['mockSegment', 'mockLatency', 'mockError'];

const getClientIp = (request) => request.headers.get('cf-connecting-ip')
  ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? '';

// env.MOCK_CLEARBIT must be explicitly 'true' (set only in this spike's own
// wrangler.toml [vars], never inherited from workers/website/) for mock query
// params to have any effect — otherwise a stray `?mockSegment=enterprise` on
// a real deployment could spoof the decision for anyone who appends it.
const resolveSegment = async ({ env, url, ip }) => {
  const signal = AbortSignal.timeout(REVEAL_TIMEOUT_MS);
  const mockRequested = env.MOCK_CLEARBIT === 'true'
    && MOCK_PARAMS.some((param) => url.searchParams.has(param));

  if (mockRequested) {
    const reveal = await fetchMockReveal({ params: url.searchParams, signal });
    return deriveSegment(reveal);
  }

  if (!env.CLEARBIT_API_KEY) throw new Error('CLEARBIT_API_KEY is not configured');
  const reveal = await fetchReveal({ ip, apiKey: env.CLEARBIT_API_KEY, signal });
  return deriveSegment(reveal);
};

// CORS only matters if this endpoint ends up on a different origin than the
// EDS delivery worker — the plan's named fallback is a Vercel Edge Function
// (P0-0), not the intended shape (co-located with the delivery worker on
// frame.io's own zone, which needs none of this). Flagging a sharper problem
// than CORS, not solved here: a Set-Cookie from a genuinely cross-origin
// response is not readable via document.cookie on frame.io at all, so the
// warm/synchronous-cookie-read half of P0-44 only works if this endpoint
// shares frame.io's registrable domain. If the Vercel fallback is ever used
// for real, that constraint needs its own decision, not just a CORS header.
const corsHeaders = (env, request) => {
  const origin = request.headers.get('origin');
  if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    vary: 'origin',
  };
};

export default {
  fetch: async (request, env) => {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(env, request), 'access-control-allow-methods': 'GET, OPTIONS' },
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, OPTIONS' } });
    }

    let segment = DEFAULT_SEGMENT;
    let failedOpen = false;

    try {
      segment = await resolveSegment({ env, url, ip: getClientIp(request) });
    } catch {
      failedOpen = true;
      segment = DEFAULT_SEGMENT;
    }

    const headers = new Headers({
      'content-type': 'application/json; charset=utf-8',
      // Per-visitor decision — must never sit in a shared/browser cache.
      'cache-control': 'no-store',
      'set-cookie': buildSegmentCookieHeader({ segment, secure: url.protocol === 'https:' }),
      ...corsHeaders(env, request),
    });
    // Debug-only signal for local verification of the fail-open path. Never
    // carries any Clearbit data, but drop it before treating this as
    // production-hardened rather than a spike.
    if (failedOpen) headers.set('x-pzn-failed-open', 'true');

    return new Response(JSON.stringify({ segment }), { status: 200, headers });
  },
};
