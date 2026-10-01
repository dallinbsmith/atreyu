// This route is `global: true` (see index.js ROUTES) — it must respond regardless of
// cohort status, so a slow or unreachable da-sc.adobeaem.workers.dev must never hang
// or 500 the whole request. Time out and fail safe with an empty list instead.
const TIMEOUT_MS = 5000;
const FALLBACK_BODY = '{"data":[]}';

export default async ({ url, env, request }) => {
  const href = `https://da-sc.adobeaem.workers.dev/live/${env.AEM_ORG}/${env.AEM_SITE}${url.pathname}`;

  try {
    // Build a minimal request so AEM-only headers (Authorization,
    // x-forwarded-host, x-push-invalidation) are not forwarded to this
    // unrelated third-party host. Keep if-none-match for the 304 branch.
    const ifNoneMatch = request.headers.get('if-none-match');
    const listReq = new Request(href, {
      method: request.method,
      headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {},
    });
    const resp = await fetch(listReq, { signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (resp.status === 304) {
      return new Response(null, { status: 304, headers: resp.headers });
    }

    const text = await resp.text();

    const headers = new Headers(resp.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');

    return new Response(text, { status: resp.status, headers });
  } catch {
    return new Response(FALLBACK_BODY, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};
