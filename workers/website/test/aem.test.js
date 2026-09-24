import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFromAem, CACHE_TTL_BY_STATUS } from '../handlers/aem.js';

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

test('CACHE_TTL_BY_STATUS never edge-caches 404 or 5xx and leaves 2xx/3xx to the origin', () => {
  // 404 must be negative, not a short TTL: a stored 404 revalidates via
  // If-Modified-Since into a 304 and never clears (see handlers/aem.js).
  assert.deepEqual({ ...CACHE_TTL_BY_STATUS }, { 404: -1, '500-599': -1 });
  for (const k of Object.keys(CACHE_TTL_BY_STATUS)) {
    const [from] = k.split('-').map(Number);
    assert.ok(from >= 400, `${k} must not override a success or redirect status`);
  }
  assert.ok(Object.isFrozen(CACHE_TTL_BY_STATUS));
});

test('cached routes send cacheEverything with the negative-cache cap', async (t) => {
  const calls = capture(t, 404);
  const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
  assert.equal(resp.status, 404);
  assert.deepEqual(calls[0].cf, { cacheEverything: true, cacheTtlByStatus: { 404: -1, '500-599': -1 } });
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

test('404 caps browser/downstream caching at 60 s and drops cdn-cache-control and validators', async (t) => {
  capture(t, 404);
  const resp = await fetchFromAem({ request: req(), cache: true, savedSearch: '' });
  assert.equal(resp.headers.get('cache-control'), 'max-age=60');
  assert.equal(resp.headers.has('cdn-cache-control'), false);
  // No validator means a browser can't revalidate the 404 into a 304.
  assert.equal(resp.headers.has('last-modified'), false);
  assert.equal(resp.headers.has('etag'), false);
});

test('5xx is no-store with no cdn-cache-control', async (t) => {
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
