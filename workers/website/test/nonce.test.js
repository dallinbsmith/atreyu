import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { addNonceToScripts, NONCE_MARKER } from '../utils/nonce.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Real lol-html (workerd) through the Miniflare that wrangler installs in
// workers/website/node_modules (CI runs npm ci there; locally run it once).
// The selector semantics are the whole security property here, so they are
// checked in the real engine rather than only against a hand-written fake.

const ENTRY = `import { addNonceToScripts } from './utils/nonce.js';
export default {
  fetch: async (req) => addNonceToScripts(
    new Response(await req.text(), { headers: { 'content-type': 'text/html' } }),
    req.headers.get('x-nonce'),
  ),
};`;

const withWorkerd = async (run) => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    compatibilityDate: '2025-02-14',
    modulesRoot: ROOT,
    modules: [
      { type: 'ESModule', path: join(ROOT, 'entry.js'), contents: ENTRY },
      { type: 'ESModule', path: join(ROOT, 'utils/nonce.js'), contents: readFileSync(join(ROOT, 'utils/nonce.js'), 'utf8') },
    ],
  }));
  try {
    const rewrite = async (html, nonce = 'R4nd0m+/nonce==') => (await mf.dispatchFetch('http://x/', {
      method: 'POST', body: html, headers: { 'x-nonce': nonce },
    })).text();
    await run(rewrite);
  } finally {
    await mf.dispose();
  }
};

test('marker is "aem", matching Adobe EDS (aem.live/docs/csp)', () => {
  assert.equal(NONCE_MARKER, 'aem');
});

test('HTMLRewriter is registered for marked script and link only, and replaces the value', () => {
  const calls = [];
  globalThis.HTMLRewriter = class {
    on = (selector, handler) => { calls.push([selector, handler]); return this; };

    transform = (r) => r;
  };
  try {
    addNonceToScripts(new Response(''), 'N');
  } finally {
    delete globalThis.HTMLRewriter;
  }
  assert.deepEqual(calls.map(([s]) => s), ['script[nonce="aem"]', 'link[nonce="aem"]']);
  const attrs = { nonce: 'aem' };
  calls[0][1].element({ setAttribute: (k, v) => { attrs[k] = v; } });
  assert.deepEqual(attrs, { nonce: 'N' });
});

test('workerd: marked scripts get the nonce; the marker is replaced, not appended', { timeout: 60_000 }, async () => {
  await withWorkerd(async (rewrite) => {
    const out = await rewrite([
      '<script nonce="aem" src="/scripts/ak.js" type="module"></script>',
      '<script nonce="aem" type="module">import x from "/scripts/vendor/rum.js";</script>',
      '<link nonce="aem" rel="modulepreload" href="/scripts/aem.js">',
    ].join(''));
    assert.equal(out, [
      '<script nonce="R4nd0m+/nonce==" src="/scripts/ak.js" type="module"></script>',
      '<script nonce="R4nd0m+/nonce==" type="module">import x from "/scripts/vendor/rum.js";</script>',
      '<link nonce="R4nd0m+/nonce==" rel="modulepreload" href="/scripts/aem.js">',
    ].join(''));
    assert.doesNotMatch(out, /aem"|aem R4nd|R4nd0m\+\/nonce== aem/);
  });
});

test('workerd: unmarked scripts are left byte-for-byte as the origin sent them', { timeout: 60_000 }, async () => {
  await withWorkerd(async (rewrite) => {
    const unmarked = [
      // Inline script as it would arrive from content.
      '<script>alert(1)</script>',
      '<script src="https://evil.example/x.js"></script>',
      // Already carries some other nonce (e.g. a stale or guessed value).
      '<script nonce="0ld-n0nce">alert(2)</script>',
      '<script nonce="">alert(3)</script>',
      '<script nonce="AEM">alert(4)</script>',
      '<script nonce="aem2">alert(5)</script>',
      '<script data-nonce="aem">alert(6)</script>',
      '<script type="application/ld+json">{"@type":"Organization"}</script>',
      '<link rel="modulepreload" href="/x.js">',
      '<div nonce="aem"></div>',
    ].join('');
    assert.equal(await rewrite(unmarked), unmarked);
  });
});

test('workerd: every script in head.html and 404.html is marked and gets the nonce', { timeout: 60_000 }, async () => {
  await withWorkerd(async (rewrite) => {
    for (const file of ['head.html', '404.html']) {
      const html = readFileSync(join(ROOT, '../..', file), 'utf8');
      const scripts = html.match(/<script\b[^>]*>/g);
      assert.ok(scripts.length >= 3, file);
      // eslint-disable-next-line no-await-in-loop
      const out = await rewrite(html);
      const stamped = out.match(/<script\b[^>]*>/g);
      assert.equal(stamped.length, scripts.length, file);
      stamped.forEach((tag) => assert.match(tag, /nonce="R4nd0m\+\/nonce=="/, `${file}: ${tag}`));
    }
  });
});
