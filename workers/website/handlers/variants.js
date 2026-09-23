import { stripLocale } from '../utils/locale.js';
import { isMediaPath } from '../utils/media.js';
import { fetchFromAem } from './aem.js';

// A/B test variant pages live under /v/ (experiments-panel/README.md). They are
// never pages in their own right: the experimentation plugin fetch()es a variant
// into the control page's URL. So only that same-origin subresource fetch
// (Fetch Metadata: Sec-Fetch-Dest "empty") gets the page. Navigations, crawlers
// and clients without Fetch Metadata get a 404, and the plugin then falls back to
// control. Media under /v/ is served normally: variant images load as <img>.
export const VARIANT_ROOT = '/v/';

export const isVariantPage = (pathname) => {
  const path = stripLocale(pathname);
  return (path.startsWith(VARIANT_ROOT) || path === '/v') && !isMediaPath(path);
};

export const isPluginFetch = (headers) => headers.get('sec-fetch-dest') === 'empty'
  && headers.get('sec-fetch-site') === 'same-origin';

const NOINDEX = 'noindex, nofollow';

// no-store: the browser HTTP cache doesn't key on Sec-Fetch-Dest, so a cached
// copy from the plugin's fetch would otherwise satisfy a later navigation.
export const fetchVariant = async (ctx) => {
  if (!isPluginFetch(ctx.request.headers)) {
    return new Response('Not found', { status: 404, headers: { 'x-robots-tag': NOINDEX, 'cache-control': 'no-store' } });
  }
  const upstream = await fetchFromAem(ctx);
  const resp = new Response(upstream.body, upstream);
  resp.headers.set('x-robots-tag', NOINDEX);
  resp.headers.set('cache-control', 'no-store');
  return resp;
};
