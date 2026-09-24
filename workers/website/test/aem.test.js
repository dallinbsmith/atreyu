import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFromAem, CACHE_TTL_BY_STATUS } from '../handlers/aem.js';

const request = new Request('https://main--atreyu--dallinbsmith.aem.live/blog/x');

const capture = (t, status = 200) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    calls.push(init);
    return new Response('body', { status, headers: { 'content-type': 'text/plain', 'cdn-cache-control': 'max-age=172800' } });
  });
  return calls;
};

test('CACHE_TTL_BY_STATUS caps 404 at 60 s, never caches 5xx, and leaves 2xx/3xx to the origin', () => {
  assert.deepEqual({ ...CACHE_TTL_BY_STATUS }, { 404: 60, '500-599': -1 });
  assert.ok(CACHE_TTL_BY_STATUS['404'] > 0 && CACHE_TTL_BY_STATUS['404'] <= 60);
  const keys = Object.keys(CACHE_TTL_BY_STATUS);
  for (const k of keys) {
    const [from] = k.split('-').map(Number);
    assert.ok(from >= 400, `${k} must not override a success or redirect status`);
  }
  assert.ok(Object.isFrozen(CACHE_TTL_BY_STATUS));
});

test('cached routes send cacheEverything with the negative-cache cap', async (t) => {
  const calls = capture(t, 404);
  const resp = await fetchFromAem({ request, cache: true, savedSearch: '' });
  assert.equal(resp.status, 404);
  assert.deepEqual(calls[0].cf, { cacheEverything: true, cacheTtlByStatus: CACHE_TTL_BY_STATUS });
});

test('uncached routes (schedules) send neither cacheEverything nor a status TTL', async (t) => {
  const calls = capture(t);
  await fetchFromAem({ request, cache: undefined, savedSearch: '' });
  assert.deepEqual(calls[0].cf, { cacheEverything: false });
});

test('the origin cdn-cache-control on a 2xx is passed through untouched', async (t) => {
  capture(t, 200);
  const resp = await fetchFromAem({ request, cache: true, savedSearch: '' });
  assert.equal(resp.headers.get('cdn-cache-control'), 'max-age=172800');
});
