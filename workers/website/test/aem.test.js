import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchFromAem, CACHE_TTL_BY_STATUS, CONSENT_ANALYTICS_CSP, buildCsp,
} from '../handlers/aem.js';

const EDS = 'https://main--atreyu--dallinbsmith.aem.live';
const req = (path = '/blog/x') => new Request(`${EDS}${path}`);
// What AEM sends with x-push-invalidation: enabled (curl, 2026-09-24).
const AEM_HEADERS = {
  'content-type': 'text/plain',
  'cache-control': 'max-age=7200, must-revalidate',
  'cdn-cache-control': 'max-age=172800, must-revalidate',
  'x-robots-tag': 'noindex, nofollow',
  // AEM sends the document's Last-Modified even on a not-yet-published 404.
  'last-modified': 'Wed, 23 Sep 2026 19:13:41 GMT',
  etag: '"abc123"',
};

const capture = (t, status = 200) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    calls.push(init);
    return new Response('body', { status, headers: AEM_HEADERS });
  });
  return calls;
};

test('CACHE_TTL_BY_STATUS never edge-caches 404, 410 or 5xx and lists nothing else', () => {
  // 404/410 must be negative, not a short TTL: a stored 404 revalidates via
  // If-Modified-Since into a 304 and never clears (see handlers/aem.js).
  // Pinned to a literal so any added status (e.g. a 2xx override) fails here.
  assert.deepEqual({ ...CACHE_TTL_BY_STATUS }, { 404: -1, 410: -1, '500-599': -1 });
  assert.ok(Object.isFrozen(CACHE_TTL_BY_STATUS));
});

test('cached routes send cacheEverything with the negative-cache cap', async (t) => {
  const calls = capture(t, 404);
  const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
  assert.equal(resp.status, 404);
  assert.deepEqual(calls[0].cf, { cacheEverything: true, cacheTtlByStatus: { 404: -1, 410: -1, '500-599': -1 } });
});

test('uncached routes (schedules) send neither cacheEverything nor a status TTL', async (t) => {
  const calls = capture(t);
  await fetchFromAem({ request: req(), cache: undefined, savedSearch: '' });
  assert.deepEqual(calls[0].cf, { cacheEverything: false });
});

test('does not strip origin cdn-cache-control on 2xx', async (t) => {
  capture(t, 200);
  const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
  assert.equal(resp.headers.get('cdn-cache-control'), 'max-age=172800, must-revalidate');
  assert.equal(resp.headers.get('cache-control'), 'max-age=7200, must-revalidate');
  assert.equal(resp.headers.get('last-modified'), 'Wed, 23 Sep 2026 19:13:41 GMT');
  assert.equal(resp.headers.get('etag'), '"abc123"');
});

test('404 and 410 cap browser/downstream caching at 60 s and drop cdn-cache-control and validators', async (t) => {
  for (const status of [404, 410]) {
    capture(t, status);
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
    assert.equal(resp.headers.get('cache-control'), 'max-age=60', String(status));
    assert.equal(resp.headers.has('cdn-cache-control'), false, String(status));
    // No validator means a browser can't revalidate the 404 into a 304.
    assert.equal(resp.headers.has('last-modified'), false, String(status));
    assert.equal(resp.headers.has('etag'), false, String(status));
    t.mock.restoreAll();
  }
});

test('other 4xx keep origin cache headers and validators', async (t) => {
  for (const status of [400, 401, 403]) {
    capture(t, status);
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
    assert.equal(resp.headers.get('cache-control'), 'max-age=7200, must-revalidate', String(status));
    assert.equal(resp.headers.get('last-modified'), 'Wed, 23 Sep 2026 19:13:41 GMT', String(status));
    t.mock.restoreAll();
  }
});

test('5xx is no-store and drops cdn-cache-control and validators', async (t) => {
  for (const status of [500, 502, 503, 599]) {
    capture(t, status);
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
    assert.equal(resp.headers.get('cache-control'), 'no-store', String(status));
    assert.equal(resp.headers.has('cdn-cache-control'), false, String(status));
    assert.equal(resp.headers.has('last-modified'), false, String(status));
    assert.equal(resp.headers.has('etag'), false, String(status));
    t.mock.restoreAll();
  }
});

test('/system/ responses are noindex; other paths have AEM x-robots-tag stripped', async (t) => {
  const cases = [
    ['/system/fragments/nav/header.plain.html', 'noindex'],
    ['/system/placeholders.json', 'noindex'],
    ['/de-de/system/placeholders.json', 'noindex'],
    ['/blog/x', null],
    ['/scripts/system/x.js', null],
    ['/systems/x', null],
  ];
  for (const [path, expected] of cases) {
    capture(t, 200);
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetchFromAem({ request: req(path), cache: true, savedSearch: '' });
    assert.equal(resp.headers.get('x-robots-tag'), expected, path);
    t.mock.restoreAll();
  }
});

test('3xx and 304 responses keep their validators and origin cache headers', async (t) => {
  for (const status of [301, 302, 304]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(null, { status, headers: AEM_HEADERS }));
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
    assert.equal(resp.status, status);
    assert.equal(resp.headers.get('last-modified'), 'Wed, 23 Sep 2026 19:13:41 GMT', String(status));
    assert.equal(resp.headers.get('etag'), '"abc123"', String(status));
    assert.equal(resp.headers.get('cdn-cache-control'), 'max-age=172800, must-revalidate', String(status));
    t.mock.restoreAll();
  }
});

// CSP (P3.2). Hosts pinned as literals, from the frame.io + EDS network capture.
const directives = (csp) => Object.fromEntries(csp.split('; ').map((d) => {
  const [name, ...values] = d.split(' ');
  return [name, values];
}));

test('CSP allows the captured OneTrust and Segment hosts in connect-src and img-src only', () => {
  const d = directives(buildCsp('abc'));
  assert.deepEqual(d['connect-src'], [
    "'self'", 'https://*.aem.live', 'https://*.aem.page', 'https://*.hlx.live', 'https://*.hlx.page',
    'https://cdn.cookielaw.org', 'https://geolocation.onetrust.com', 'https://privacyportal.onetrust.com',
    'https://cdn.segment.com', 'https://api.segment.io',
  ]);
  assert.deepEqual(d['img-src'], [
    "'self'", 'data:', 'https://*.aem.live', 'https://*.aem.page', 'https://*.hlx.live', 'https://*.hlx.page',
    'https://cdn.cookielaw.org',
  ]);
  // Unchanged by P3.2: OneTrust's CSS arrives via fetch and is injected inline.
  assert.deepEqual(d['style-src'], ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(d['font-src'], ["'self'"]);
  assert.deepEqual(d['frame-src'], ["'self'", 'https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://calendly.com']);
  assert.deepEqual(d['default-src'], ["'self'"]);
});

test('CSP script-src keeps nonce + strict-dynamic with no vendor hosts or unsafe keywords', () => {
  const d = directives(buildCsp('abc'));
  assert.deepEqual(d['script-src'], ["'nonce-abc'", "'strict-dynamic'", 'https://assets.calendly.com']);
});

test('CSP adds no vendor wildcards and none of the out-of-scope destination hosts', () => {
  const csp = buildCsp('abc');
  assert.doesNotMatch(csp, /\*\.(cookielaw|onetrust|segment)\./);
  assert.doesNotMatch(csp, /googletagmanager|doubleclick|google-analytics|analytics\.google|facebook|adobedtm|marketingtech|profiles\.segment/);
  assert.ok(Object.isFrozen(CONSENT_ANALYTICS_CSP));
  assert.ok(Object.isFrozen(CONSENT_ANALYTICS_CSP.connect));
  assert.ok(Object.isFrozen(CONSENT_ANALYTICS_CSP.img));
});

test('HTML responses get buildCsp with a fresh per-request nonce; non-HTML get no CSP', async (t) => {
  // HTMLRewriter only exists in workerd; a pass-through stub is enough here.
  globalThis.HTMLRewriter = class {
    on = () => this;

    transform = (r) => r;
  };
  t.after(() => { delete globalThis.HTMLRewriter; });
  t.mock.method(globalThis, 'fetch', async () => new Response('<html></html>', {
    status: 200, headers: { 'content-type': 'text/html; charset=utf-8' },
  }));
  const a = (await fetchFromAem({ request: req(), cache: true, savedSearch: '' })).headers.get('content-security-policy');
  const b = (await fetchFromAem({ request: req(), cache: true, savedSearch: '' })).headers.get('content-security-policy');
  const nonceOf = (csp) => csp.match(/'nonce-([^']+)'/)[1];
  assert.equal(a, buildCsp(nonceOf(a)));
  assert.notEqual(nonceOf(a), nonceOf(b));
  t.mock.restoreAll();

  capture(t, 200);
  const plain = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
  assert.equal(plain.headers.has('content-security-policy'), false);
});
