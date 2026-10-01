import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFromExistingOrigin } from '../handlers/existing-origin.js';

const ENV = { LEGACY_ORIGIN: 'legacy.example' };

const proxied = async (t, path) => {
  let target;
  t.mock.method(globalThis, 'fetch', async (input) => {
    target = new URL(input.url);
    return new Response('ok');
  });
  const url = new URL(`https://frame.io${path}`);
  await fetchFromExistingOrigin({ url, env: ENV, request: new Request(url) });
  return target;
};

test('proxies to the legacy origin with path and query', async (t) => {
  const target = await proxied(t, '/pricing?utm_source=x');
  assert.equal(target.href, 'https://legacy.example/pricing?utm_source=x');
});

test('a path starting with // or /\\ cannot change the upstream host', async (t) => {
  const hostile = [
    '//evil.com/', '//evil.com/x?q=1', '/\\evil.com/', '///evil.com', '/a/../..//evil.com',
    '/%2e%2e//evil.com', '/\t/evil.com', '//user:pw@evil.com/', '//evil.com:8080/', '//127.0.0.1/',
  ];
  for (const path of hostile) {
    // eslint-disable-next-line no-await-in-loop
    const target = await proxied(t, path);
    assert.equal(target.host, 'legacy.example', path);
    t.mock.restoreAll();
  }
});

test('the path reaches the legacy origin unchanged and cookies are forwarded', async (t) => {
  let seen;
  t.mock.method(globalThis, 'fetch', async (input) => {
    seen = input;
    return new Response('ok');
  });
  const url = new URL('https://frame.io/a%20b/caf%C3%A9;x=1?q=a+b');
  await fetchFromExistingOrigin({
    url, env: ENV, request: new Request(url, { headers: { cookie: 'c=1' } }),
  });
  assert.equal(new URL(seen.url).pathname, url.pathname);
  assert.equal(new URL(seen.url).search, url.search);
  assert.equal(seen.headers.get('cookie'), 'c=1');
});
