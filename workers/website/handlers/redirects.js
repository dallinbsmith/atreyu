let redirectMap = null;
let lastFetch = 0;
const TTL = 5 * 60 * 1000;

const normalize = (path) => path.replace(/\/+$/, '') || '/';

const loadRedirects = async (request) => {
  if (redirectMap && Date.now() - lastFetch < TTL) return;

  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = '/redirects.json';
  const resp = await fetch(new Request(redirectUrl, { headers: request.headers }));
  if (!resp.ok) {
    redirectMap ??= new Map();
    return;
  }

  const { data = [] } = await resp.json();
  redirectMap = new Map(data.map(({ Source, Destination }) => [normalize(Source), Destination]));
  lastFetch = Date.now();
};

const matchWildcard = (path) => {
  const entry = [...redirectMap].find(([src]) => src.endsWith('/*') && path.startsWith(src.slice(0, -1)));
  if (!entry) return null;
  const [src, dest] = entry;
  return dest.replace('/*', path.slice(src.length - 1));
};

export default async ({ request }) => {
  await loadRedirects(request);

  const path = normalize(new URL(request.url).pathname);
  const dest = redirectMap.get(path) ?? matchWildcard(path);

  return dest
    ? new Response('', { status: 301, headers: { location: dest } })
    : null;
};
