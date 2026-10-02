// DEPLOY_TIER end to end: the whole Worker runs in real workerd (lol-html)
// through the pinned Miniflare, with every upstream fetch answered by
// `upstream` below. Covers the <html> tier attribute, non-prod noindex and
// robots.txt, and that prod responses are unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['index.js', 'routing-manifest.js', ...['handlers', 'utils']
  .flatMap((dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`))];

const EDS_HOST = 'main--atreyu--dallinbsmith.aem.live';
const EDS_HTML = [
  '<!DOCTYPE html><html lang="en" data-deploy-tier="prod" DATA-DEPLOY-TIER="dev"><head>',
  '<script nonce="aem" src="/scripts/ak.js" type="module"></script>',
  '</head><body><main>page</main></body></html>',
].join('');
const LEGACY_HTML = '<!DOCTYPE html><html lang="en" data-deploy-tier="dev"><head></head><body>legacy</body></html>';
const JS = 'document.documentElement.outerHTML = \'<html data-deploy-tier="dev">\';';

const upstream = (req) => {
  const { host, pathname } = new URL(req.url);
  if (host === 'legacy.example') {
    if (pathname === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /\nSitemap: https://frame.io/sitemap.xml', { headers: { 'content-type': 'text/plain' } });
    }
    return new Response(LEGACY_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'all' } });
  }
  if (host === EDS_HOST) {
    if (pathname === '/redirects.json') return new Response('{"data":[]}', { headers: { 'content-type': 'application/json' } });
    if (pathname.endsWith('.js')) return new Response(JS, { headers: { 'content-type': 'text/javascript' } });
    if (pathname.endsWith('.json')) return new Response('{"data":[]}', { headers: { 'content-type': 'application/json', 'x-robots-tag': 'noindex' } });
    return new Response(EDS_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' } });
  }
  return new Response('unexpected upstream', { status: 599 });
};

const withWorker = async (tier, run) => {
  const calls = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    compatibilityDate: '2025-02-14',
    modulesRoot: ROOT,
    modules: SOURCES.map((p) => ({ type: 'ESModule', path: join(ROOT, p), contents: readFileSync(join(ROOT, p), 'utf8') })),
    bindings: {
      AEM_ORG: 'dallinbsmith',
      AEM_SITE: 'atreyu',
      DA_ORG: 'dallinbsmith',
      DA_SITE: 'atreyu',
      LEGACY_ORIGIN: 'legacy.example',
      ...(tier === undefined ? {} : { DEPLOY_TIER: tier }),
    },
    outboundService: async (req) => {
      calls.push(new URL(req.url));
      return upstream(req);
    },
  }));
  try {
    const get = (path) => mf.dispatchFetch(`https://frame.io${path}`, { redirect: 'manual' });
    await run(get, calls);
  } finally {
    await mf.dispose();
  }
};

const tiersOf = (html) => [...html.matchAll(/data-deploy-tier="([^"]*)"/gi)].map(([, v]) => v);

test('workerd: stage Worker', { timeout: 120_000 }, async (t) => {
  await withWorker('stage', async (get, calls) => {
    await t.test('EDS HTML gets the Worker tier; upstream values are removed', async () => {
      const resp = await get('/blog/x');
      const html = await resp.text();
      assert.deepEqual(tiersOf(html), ['stage']);
      assert.match(html, /^<!DOCTYPE html><html lang="en" data-deploy-tier="stage">/);
      // Same pass as the nonce: the marker is replaced and CSP is set.
      const nonce = resp.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1];
      assert.ok(html.includes(`<script nonce="${nonce}" src="/scripts/ak.js"`), html);
    });

    await t.test('legacy-origin HTML is passed through untouched', async () => {
      const html = await (await get('/pricing')).text();
      assert.equal(html, LEGACY_HTML);
    });

    await t.test('non-HTML EDS responses are not rewritten', async () => {
      assert.equal(await (await get('/scripts/x.js')).text(), JS);
    });

    await t.test('every response is noindex, nofollow, whichever origin or route', async () => {
      for (const path of ['/blog/x', '/pricing', '/scripts/x.js', '/system/placeholders.json', '/blog/', '/drafts/x', '/v/x', '/robots.txt']) {
        // eslint-disable-next-line no-await-in-loop
        const resp = await get(path);
        assert.equal(resp.headers.get('x-robots-tag'), 'noindex, nofollow', path);
        // eslint-disable-next-line no-await-in-loop
        await resp.arrayBuffer();
      }
    });

    await t.test('robots.txt disallows everything without reaching an origin', async () => {
      calls.length = 0;
      const resp = await get('/robots.txt');
      assert.equal(resp.status, 200);
      assert.match(resp.headers.get('content-type'), /^text\/plain/);
      assert.equal(await resp.text(), 'User-agent: *\nDisallow: /');
      assert.deepEqual(calls, []);
    });
  });
});

test('workerd: dev Worker is noindex with a dev tier attribute', { timeout: 120_000 }, async () => {
  await withWorker('dev', async (get) => {
    const page = await get('/blog/x');
    assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.deepEqual(tiersOf(await page.text()), ['dev']);
    assert.equal(await (await get('/robots.txt')).text(), 'User-agent: *\nDisallow: /');
  });
});

test('workerd: prod Worker is unchanged apart from the tier attribute', { timeout: 120_000 }, async () => {
  await withWorker('prod', async (get) => {
    const page = await get('/blog/x');
    assert.equal(page.headers.has('x-robots-tag'), false, "AEM's x-robots-tag is still stripped");
    assert.deepEqual(tiersOf(await page.text()), ['prod']);

    const system = await get('/system/placeholders.json');
    assert.equal(system.headers.get('x-robots-tag'), 'noindex');
    await system.arrayBuffer();

    const legacy = await get('/pricing');
    assert.equal(legacy.headers.get('x-robots-tag'), 'all');
    assert.equal(await legacy.text(), LEGACY_HTML);

    const robots = await get('/robots.txt');
    assert.equal(await robots.text(), 'User-agent: *\nAllow: /\nSitemap: https://frame.io/sitemap.xml');
    assert.equal(robots.headers.has('x-robots-tag'), false);
  });
});

test('workerd: a missing or invalid DEPLOY_TIER fails every request closed', { timeout: 120_000 }, async () => {
  for (const tier of [undefined, 'production']) {
    // eslint-disable-next-line no-await-in-loop
    await withWorker(tier, async (get, calls) => {
      for (const path of ['/blog/x', '/pricing', '/robots.txt']) {
        // eslint-disable-next-line no-await-in-loop
        const resp = await get(path);
        assert.equal(resp.status, 500, `${tier} ${path}`);
        // eslint-disable-next-line no-await-in-loop
        assert.match(await resp.text(), /^Server misconfigured/);
      }
      assert.deepEqual(calls, []);
    });
  }
});
