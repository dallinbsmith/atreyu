// Stand-in for handlers/reveal.js when no real Clearbit key exists yet (this
// project has no Cloudflare account or live Clearbit key provisioned — see
// P0-0). Returns a Reveal-shaped payload so it exercises the same
// deriveSegment() path a real response would, rather than short-circuiting
// straight to a segment string. Only reachable when the caller (index.js)
// has already gated on env.MOCK_CLEARBIT === 'true' AND at least one mock
// query param — this file has no opinion on when it's safe to use, it just
// simulates latency/error/segment on request.
//
// Query params (see README.md):
//   mockSegment=enterprise|default  (default: 'default')
//   mockLatency=<ms>                (default: 0) — for the 50/150/300/600/
//                                    1200ms client-runtime sweep this spike
//                                    exists to support
//   mockError=true                  — reject instead of resolving, to test
//                                    the fail-open path independent of timeout

const MOCK_REVEAL_ENTERPRISE = {
  company: { name: 'Mock Enterprise Co', metrics: { employees: 5000 } },
};
const MOCK_REVEAL_DEFAULT = {
  company: { name: 'Mock Default Co', metrics: { employees: 12 } },
};

export const fetchMockReveal = ({ params, signal }) => new Promise((resolve, reject) => {
  if (signal.aborted) {
    reject(new DOMException('aborted', 'AbortError'));
    return;
  }

  const latencyMs = Number(params.get('mockLatency') ?? 0);
  const forceError = params.get('mockError') === 'true';
  const enterprise = params.get('mockSegment') === 'enterprise';

  const timer = setTimeout(() => {
    if (forceError) {
      reject(new Error('mock-clearbit-error'));
      return;
    }
    resolve(enterprise ? MOCK_REVEAL_ENTERPRISE : MOCK_REVEAL_DEFAULT);
  }, Number.isFinite(latencyMs) && latencyMs > 0 ? latencyMs : 0);

  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(new DOMException('aborted', 'AbortError'));
  });
});
