import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVariantPage, isPluginFetch, fetchVariant } from '../handlers/variants.js';

const MEDIA = '/v/media_13ac7009c0e40d5527733d60267706f07177192ca.jpg';
const pluginHeaders = { 'sec-fetch-dest': 'empty', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' };
const req = (headers = {}) => new Request('https://main--atreyu--dallinbsmith.aem.live/v/c2c-headline', { headers });

test('isVariantPage matches /v pages, locale-prefixed too, but not media or look-alikes', () => {
  for (const path of ['/v/c2c-headline', '/v/', '/v', '/de-de/v/x']) assert.equal(isVariantPage(path), true, path);
  for (const path of [MEDIA, '/video', '/vx/a', '/features/v/a', '/']) assert.equal(isVariantPage(path), false, path);
});

test('isPluginFetch needs a same-origin subresource fetch', () => {
  assert.equal(isPluginFetch(new Headers(pluginHeaders)), true);
  assert.equal(isPluginFetch(new Headers({ 'sec-fetch-dest': 'document', 'sec-fetch-site': 'none' })), false);
  assert.equal(isPluginFetch(new Headers({ 'sec-fetch-dest': 'empty', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(isPluginFetch(new Headers()), false, 'crawlers and curl send no Fetch Metadata');
});

test('fetchVariant 404s navigations and crawlers without calling the origin', async (t) => {
  const origin = t.mock.method(globalThis, 'fetch', async () => new Response('page'));
  for (const headers of [{}, { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none' }]) {
    const resp = await fetchVariant({ request: req(headers), cache: true });
    assert.equal(resp.status, 404);
    assert.equal(resp.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(resp.headers.get('cache-control'), 'no-store');
  }
  assert.equal(origin.mock.callCount(), 0);
});

test('fetchVariant serves the plugin fetch, marked noindex and uncacheable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('variant', {
    headers: { 'content-type': 'text/plain', 'cache-control': 'max-age=300', 'x-robots-tag': 'all' },
  }));
  const resp = await fetchVariant({ request: req(pluginHeaders), cache: true });
  assert.equal(resp.status, 200);
  assert.equal(await resp.text(), 'variant');
  assert.equal(resp.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(resp.headers.get('cache-control'), 'no-store');
});
