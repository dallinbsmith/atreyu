// Pins route order (authored redirect before the trailing-slash 308); it
// passes on the pre-308 code too, since redirects.js already ignored slashes.
// Own file: handlers/redirects.js caches redirects.json per module instance,
// and node --test runs each file in a fresh process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';

const ENV = {
  AEM_ORG: 'dallinbsmith', AEM_SITE: 'atreyu', DA_ORG: 'dallinbsmith', DA_SITE: 'atreyu', LEGACY_ORIGIN: 'legacy.example', DEPLOY_TIER: 'prod',
};

test('a redirects.json entry wins over the trailing-slash 308 (one hop, not two)', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    data: [{ Source: '/blog/old-post', Destination: '/blog/new-post' }],
  })));
  const resp = await worker.fetch(new Request('https://frame.io/blog/old-post/'), ENV);
  assert.equal(resp.status, 301);
  assert.equal(resp.headers.get('location'), '/blog/new-post');
});
