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
  for (const path of ['/pricing/schedules/a.json', '/features/dasc/a.json']) {
    // eslint-disable-next-line no-await-in-loop
    const { target } = await route(t, path);
    assert.notEqual(target?.hostname, 'legacy.example', path);
    t.mock.restoreAll();
  }
});

test('RUM beacons go to EDS, not the existing origin', async (t) => {
  const { target } = await route(t, '/.rum/1', { method: 'POST', body: '{}' });
  assert.equal(target.hostname, EDS_HOST);
});
