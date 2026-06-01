import { generateNonce, addNonceToScripts } from '../utils/nonce.js';

const getRedirect = (resp, savedSearch) => {
  if (!(resp.status === 301 && savedSearch)) return;
  const location = resp.headers.get('location');
  if (location && !location.match(/\?.*$/)) {
    resp.headers.set('location', `${location}${savedSearch}`);
  }
};

const formatSchedule = async (response) => {
  const schedule2Response = (json) => new Response(JSON.stringify(json), response);

  const json = await response.json();
  if (!json.data?.at(0)?.fragment) return schedule2Response(json);

  const now = Date.now();
  const data = json.data.filter(({ start, end }) => {
    if (!start && !end) return true;
    return new Date(start) < now && new Date(end) > now;
  });

  return schedule2Response({ ...json, data });
};

export const fetchFromAem = async ({ request, cache, savedSearch }) => {
  let resp = await fetch(request, { method: request.method, cf: { cacheEverything: cache } });

  resp = new Response(resp.body, resp);

  const redirectResp = getRedirect(resp, savedSearch);
  if (redirectResp) return redirectResp;

  resp.headers.delete('age');
  resp.headers.delete('x-robots-tag');

  if (resp.headers.get('content-type')?.includes('text/html')) {
    const nonce = generateNonce();

    resp.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'nonce-${nonce}' 'strict-dynamic' https://*.aem.live https://*.aem.page`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.aem.live https://*.aem.page https://*.hlx.live https://*.hlx.page",
      "font-src 'self'",
      "connect-src 'self' https://*.aem.live https://*.aem.page https://*.hlx.live",
      "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
      "media-src 'self' https://*.youtube.com https://*.ytimg.com",
      "frame-ancestors 'self' https://*.aem.live https://*.aem.page",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
    resp.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    resp.headers.set('X-Content-Type-Options', 'nosniff');
    resp.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    resp.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return addNonceToScripts(resp, nonce);
  }

  return resp;
};

export const fetchSchedule = async ({ request, cache, savedSearch }) => {
  const resp = await fetchFromAem({ request, cache, savedSearch });

  if (resp.status === 301 || resp.status === 304) return resp;

  return formatSchedule(resp);
};
