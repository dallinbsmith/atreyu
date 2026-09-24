// Routing table for the strangler (backlog P0-17, F-76): which paths the Worker
// serves from EDS and which fall through to the existing (Falkor) origin.
// The expected lists are written out by hand on purpose, so any change to
// EDS_PATHS or EDS_ASSET_PATHS has to be made here too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { isEdsPath, EDS_PATHS, EDS_ASSET_PATHS } from '../index.js';

const COHORT = ['/blog/', '/glossary/', '/integrations/'];
const ASSETS = ['/blocks/', '/icons/', '/img/', '/plugins/', '/scripts/', '/styles/', '/system/', '/templates/'];

const ENV = { AEM_ORG: 'dallinbsmith', AEM_SITE: 'atreyu', LEGACY_ORIGIN: 'legacy.example' };
const EDS_HOST = 'main--atreyu--dallinbsmith.aem.live';

test('EDS_PATHS and EDS_ASSET_PATHS match the reviewed lists', () => {
  assert.deepEqual(EDS_PATHS, COHORT);
  assert.deepEqual(EDS_ASSET_PATHS, ASSETS);
});

test('isEdsPath: cohort pages, with and without a trailing slash', () => {
  for (const p of COHORT) {
    assert.equal(isEdsPath(p), true, p);
    assert.equal(isEdsPath(p.slice(0, -1)), true, p.slice(0, -1));
    assert.equal(isEdsPath(`${p}some-page`), true, `${p}some-page`);
  }
});

test('isEdsPath: EDS code and shared-content assets', () => {
  const real = [
    '/scripts/scripts.js', '/scripts/ak.js', '/scripts/vendor/rum.js',
    '/styles/styles.css', '/styles/fonts/montserrat.woff2',
    '/blocks/header/header.js', '/blocks/header/header.css',
    '/plugins/experimentation/src/index.js',
    '/icons/more.svg', '/img/glyphs/chevron.svg', '/img/favicons/favicon.svg',
    '/system/placeholders.json', '/system/fragments/nav/header.plain.html',
    '/templates/landing/landing.css',
  ];
  for (const p of real) assert.equal(isEdsPath(p), true, p);
});

test('isEdsPath: asset prefixes match folders only, not look-alikes or bare names', () => {
  const lookAlikes = ['/scripts', '/styles', '/system', '/scriptsx/a.js', '/my/scripts/a.js', '/img-gallery', '/stylesheet'];
  for (const p of lookAlikes) assert.equal(isEdsPath(p), false, p);
});

test('isEdsPath: locale-prefixed paths stay on the existing origin while EDS_LOCALES is empty', () => {
  for (const p of ['/de-de/blog/x', '/de-de/scripts/scripts.js', '/ja-jp/system/placeholders.json', '/fr-fr']) {
    assert.equal(isEdsPath(p), false, p);
  }
});

test('isEdsPath: Falkor pages and assets fall through', () => {
  const falkor = [
    '/', '/pricing', '/enterprise', '/features/review-and-approval', '/case-studies/x', '/live/x',
    '/_next/static/chunks/main.js', '/_next/image', '/api/forms', '/api/rss',
    '/favicon.ico', '/favicon.svg', '/icon-192x192.png', '/manifest.json', '/robots.txt', '/sitemap.xml',
    '/fonts/x.woff2', '/tools/widgets/language', '/widgets/consent',
    '/blogger', '/integrationsx',
  ];
  for (const p of falkor) assert.equal(isEdsPath(p), false, p);
});

// End-to-end through the default export: records where fetch() went.
const route = async (t, path, init = {}, env = ENV) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url);
    if (url.pathname.endsWith('.json')) return new Response('{"data":[]}', { headers: { 'content-type': 'application/json' } });
    return new Response('ok', { headers: { 'content-type': 'text/plain' } });
  });
  const resp = await worker.fetch(new Request(`https://frame.io${path}`, init), env);
  const target = calls.findLast((u) => u.pathname !== '/redirects.json');
  return { resp, target };
};

test('code assets go to EDS with the query string dropped from the outbound request', async (t) => {
  const { target } = await route(t, '/scripts/scripts.js?v=123&utm_source=x');
  assert.equal(target.hostname, EDS_HOST);
  assert.equal(target.pathname, '/scripts/scripts.js');
  assert.equal(target.search, '');
});

test('placeholders.json keeps only the JSON allowlist (limit, offset, sheet), sorted', async (t) => {
  const { target } = await route(t, '/system/placeholders.json?sheet=a&x=1&limit=5');
  assert.equal(target.hostname, EDS_HOST);
  assert.equal(target.search, '?limit=5&sheet=a');
});

test('Falkor assets go to the existing origin with the query string intact', async (t) => {
  for (const path of ['/_next/static/chunks/app.js?dpl=abc', '/_next/image?url=%2Fa.png&w=750&q=75', '/favicon.ico']) {
    // eslint-disable-next-line no-await-in-loop
    const { target } = await route(t, path);
    assert.equal(target.hostname, 'legacy.example', path);
    assert.equal(`${target.pathname}${target.search}`, path);
    t.mock.restoreAll();
  }
});

test('EDS_DISABLED sends code assets to the existing origin too', async (t) => {
  const { target } = await route(t, '/scripts/scripts.js', {}, { ...ENV, EDS_DISABLED: 'true' });
  assert.equal(target.hostname, 'legacy.example');
});

test('global routes never reach the existing origin, whatever the cohort', async (t) => {
  const cases = [
    ['/drafts/x', 404],
    ['/langstore/de-de/x', 404],
    ['/v/c2c-headline', 404], // navigation without Fetch Metadata
  ];
  for (const [path, status] of cases) {
    // eslint-disable-next-line no-await-in-loop
    const { resp, target } = await route(t, path);
    assert.equal(resp.status, status, path);
    assert.equal(target, undefined, `${path} must not be proxied`);
    t.mock.restoreAll();
  }
  const upstreams = [
    ['/pricing/schedules/a.json', EDS_HOST, '/pricing/schedules/a.json'],
    ['/features/dasc/a.json', 'da-sc.adobeaem.workers.dev', '/live/dallinbsmith/atreyu/features/dasc/a.json'],
  ];
  for (const [path, host, pathname] of upstreams) {
    // eslint-disable-next-line no-await-in-loop
    const { target } = await route(t, path);
    assert.equal(target.hostname, host, path);
    assert.equal(target.pathname, pathname, path);
    t.mock.restoreAll();
  }
});

test('encoded separators and case variants never reach EDS', async (t) => {
  for (const p of ['/scripts/..%2Fdrafts%2Fx', '/scripts/..%2fdrafts', '/system/..%5Cdrafts', '/blog/a%2Fb']) {
    assert.equal(isEdsPath(p), false, p);
  }
  const cases = [
    // Encoded slashes stay encoded after URL parsing, so this falls through.
    ['/scripts/..%2Fdrafts%2Fx', 'legacy'],
    // %2e%2e is a dot segment: the URL parser resolves it to /drafts/x first.
    ['/scripts/%2e%2e/drafts/x', 'drafts-deny'],
    // Prefixes are case-sensitive, like the EDS origin.
    ['/Scripts/a.js', 'legacy'],
  ];
  for (const [path, expected] of cases) {
    // eslint-disable-next-line no-await-in-loop
    const { resp, target } = await route(t, path);
    if (expected === 'legacy') {
      assert.equal(target.hostname, 'legacy.example', path);
    } else {
      assert.equal(resp.status, 404, path);
      // eslint-disable-next-line no-await-in-loop
      assert.match(await resp.text(), /drafts are denied/, path);
      assert.equal(target, undefined, path);
    }
    t.mock.restoreAll();
  }
});

test('exported path lists are frozen', () => {
  assert.ok(Object.isFrozen(EDS_PATHS));
  assert.ok(Object.isFrozen(EDS_ASSET_PATHS));
});

test('RUM beacons go to EDS, not the existing origin', async (t) => {
  const { target } = await route(t, '/.rum/1', { method: 'POST', body: '{}' });
  assert.equal(target.hostname, EDS_HOST);
});

test('page and asset requests reach fetchFromAem with the negative-cache cap', async (t) => {
  for (const path of ['/blog/x', '/scripts/scripts.js']) {
    const inits = [];
    t.mock.method(globalThis, 'fetch', async (input, init) => {
      if (new URL(input.url ?? input).pathname !== '/redirects.json') inits.push(init);
      return new Response('{"data":[]}', { headers: { 'content-type': 'application/json' } });
    });
    // eslint-disable-next-line no-await-in-loop
    await worker.fetch(new Request(`https://frame.io${path}`), ENV);
    const expected = { cacheEverything: true, cacheTtlByStatus: { 404: -1, '500-599': -1 } };
    assert.deepEqual(inits.at(-1).cf, expected, path);
    t.mock.restoreAll();
  }
});

// Records the full outbound Request for each non-redirects.json fetch.
const outbound = async (t, path, headers, respond) => {
  const reqs = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    if (new URL(input.url).pathname === '/redirects.json') return new Response('{"data":[]}');
    reqs.push(input);
    return respond(input);
  });
  const resp = await worker.fetch(new Request(`https://frame.io${path}`, { headers }), ENV);
  return { resp, sent: reqs.at(-1) };
};

test('the AEM origin request drops if-modified-since but keeps if-none-match', async (t) => {
  const headers = {
    'if-modified-since': 'Wed, 23 Sep 2026 19:13:41 GMT',
    'if-none-match': '"d3d08eb418623136dee54ebfc9e90c79"',
  };
  for (const path of ['/blog/x', '/scripts/scripts.js', '/system/placeholders.json']) {
    // eslint-disable-next-line no-await-in-loop
    const { sent } = await outbound(t, path, headers, () => new Response('ok'));
    assert.equal(sent.headers.has('if-modified-since'), false, path);
    assert.equal(sent.headers.get('if-none-match'), '"d3d08eb418623136dee54ebfc9e90c79"', path);
    t.mock.restoreAll();
  }
});

test('dasc still forwards if-none-match and passes a 304 through with its validators', async (t) => {
  const headers = { 'if-none-match': '"list-v1"', 'if-modified-since': 'Wed, 23 Sep 2026 19:13:41 GMT' };
  const { resp, sent } = await outbound(t, '/features/dasc/a.json', headers, () => new Response(null, {
    status: 304,
    headers: { etag: '"list-v1"', 'last-modified': 'Wed, 23 Sep 2026 19:13:41 GMT' },
  }));
  assert.equal(new URL(sent.url).hostname, 'da-sc.adobeaem.workers.dev');
  assert.equal(sent.headers.get('if-none-match'), '"list-v1"');
  assert.equal(sent.headers.has('if-modified-since'), false);
  assert.equal(resp.status, 304);
  assert.equal(resp.headers.get('etag'), '"list-v1"');
});
