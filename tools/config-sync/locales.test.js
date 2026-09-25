/**
 * Cross-runtime parity for the locale list and the variant-path rules.
 *
 * The browser (scripts/) and the website Worker (workers/website/) each keep
 * their own copy, because they can't share a module: one ships as static
 * client JS with no build step, the other runs in a Cloudflare isolate. Each
 * pair is two designated files that must agree with each other, which
 * `config-drift/no-duplicate-locale-list` can't check (see
 * segment-cookie.test.js and .claude/rules/scripts.md). Unlike that test, these
 * modules are pure, so this one imports them rather than regex-reading source.
 * Nothing here writes a locale list out: both sides are imported, so this file
 * can't become a third copy.
 *
 * Checks:
 *  1. scripts/locales.js keys (minus the '' default) equal the Worker's
 *     LOCALE_PREFIXES, as sorted sets.
 *     The config-drift rule's ALLOWED_LOCALE_CODES matches them too.
 *  2. VARIANT_ROOT is the same in experiments/config.js and handlers/variants.js.
 *  3. A path table run through the browser's guard.js shouldGuard and the
 *     Worker's isVariantPage. They must agree, except for real media-bus paths
 *     under /v/ (asserted explicitly below).
 *
 * Node-only. Run from the `site/` package root:
 *   node tools/config-sync/locales.test.js
 * A thrown assertion means drift; no output means everything matches.
 */

import assert from 'node:assert/strict';
import locales from '../../scripts/locales.js';
import { VARIANT_ROOT as BROWSER_VARIANT_ROOT } from '../../scripts/utils/experiments/config.js';
import { shouldGuard } from '../../scripts/utils/experiments/guard.js';
import { ALLOWED_LOCALE_CODES } from '../eslint-rules/config-drift.js';
// Crossing into the Worker package is sanctioned for this parity test by
// foundation-hardening-plan B6 (import, don't restate). The modules are pure,
// and the Worker's own `node --test` loads them in Node, unlike
// segment-cookie.test.js, which regex-reads its source.
// eslint-disable-next-line import/no-relative-packages -- cross-runtime parity check, read-only
import { LOCALE_PREFIXES } from '../../workers/website/utils/locale.js';
// eslint-disable-next-line import/no-relative-packages -- cross-runtime parity check, read-only
import { VARIANT_ROOT as WORKER_VARIANT_ROOT, isVariantPage } from '../../workers/website/handlers/variants.js';

// 1. Locale list.
const browserLocales = Object.keys(locales).filter(Boolean).sort();
const workerLocales = [...LOCALE_PREFIXES].sort();
assert.equal(new Set(workerLocales).size, workerLocales.length, 'workers/website/utils/locale.js LOCALE_PREFIXES has a duplicate entry.');
assert.deepEqual(
  browserLocales,
  workerLocales,
  'Locale lists drifted between scripts/locales.js and workers/website/utils/locale.js (LOCALE_PREFIXES). '
  + 'Both must hold the same prefixes; the Worker routes and redirects by its list, the browser localizes by its own.',
);

// 1b. The config-drift ESLint rule's own hand-typed copy (bare codes, plus
// 'en-us' for the unprefixed default).
assert.deepEqual(
  [...ALLOWED_LOCALE_CODES].sort(),
  ['en-us', ...browserLocales.map((p) => p.slice(1))].sort(),
  'tools/eslint-rules/config-drift.js ALLOWED_LOCALE_CODES drifted from scripts/locales.js. '
  + "It must hold each locale prefix without the slash, plus 'en-us'.",
);

// 2. Variant root.
assert.equal(
  BROWSER_VARIANT_ROOT,
  WORKER_VARIANT_ROOT,
  `VARIANT_ROOT drifted: scripts/utils/experiments/config.js has '${BROWSER_VARIANT_ROOT}', `
  + `workers/website/handlers/variants.js has '${WORKER_VARIANT_ROOT}'. Align them by value.`,
);

// 3. Variant-path table. shouldGuard reads window.location at call time only
// (guard.js touches no browser global at module load), so a minimal location
// shim is enough to call the real function. Paths are same-origin GETs with no
// signal, so only the path rule decides.
const ORIGIN = 'https://www.frame.io';
globalThis.window = { location: { href: `${ORIGIN}/`, origin: ORIGIN } };
const guarded = (path) => shouldGuard(`${ORIGIN}${path}`);

// A real media-bus asset name (workers/website/utils/media.js isMediaPath needs
// media_ + 40 or more hex digits + an extension).
const MEDIA = 'media_13ac7009c0e40d5527733d60267706f07177192ca.jpg';

// [path, browser shouldGuard, Worker isVariantPage]
const TABLE = [
  ['/v/x', true, true],
  ['/de-de/v/x', true, true],
  ['/v', true, true],
  ['/v/', true, true],
  ['/de-de/v', true, true],
  ['/de-de/v/', true, true],
  ['/de-dev/v/', false, false], // not a locale: no prefix is stripped
  ['/de-de', false, false],
  ['/vx', false, false],
  ['/vv/', false, false],
  ['/', false, false],
  ['/pricing', false, false],
  // Not a real media-bus name (no hash, no extension), so the Worker treats it
  // as an ordinary variant page too.
  ['/v/media_x', true, true],
  ['/de-de/v/media_x', true, true],
  // The documented difference. The Worker leaves real media under /v/ out of
  // the variant gate, so the variant page's own <img>/<video> requests
  // (Sec-Fetch-Dest image/video, not "empty") aren't 404ed. Its isMediaPath
  // isn't anchored at the start and allows a tail after the hash, so a media
  // name at any depth counts (/v/sub/media_...). The browser guard
  // matches the path anyway. That's harmless: the guard only wraps
  // window.fetch, which media elements never go through, and for a fetch() it
  // only applies the shared guard deadline (1 s by default) to a same-origin
  // GET that had no signal.
  [`/v/${MEDIA}`, true, false],
  [`/de-de/v/${MEDIA}`, true, false],
  [`/v/sub/${MEDIA}`, true, false],
];
const KNOWN_DIFFERENCE = new Set([`/v/${MEDIA}`, `/de-de/v/${MEDIA}`, `/v/sub/${MEDIA}`]);

for (const [path, browser, worker] of TABLE) {
  const got = { browser: guarded(path), worker: isVariantPage(path) };
  assert.equal(got.browser, browser, `guard.js shouldGuard('${path}') is ${got.browser}, expected ${browser}.`);
  assert.equal(got.worker, worker, `handlers/variants.js isVariantPage('${path}') is ${got.worker}, expected ${worker}.`);
  if (KNOWN_DIFFERENCE.has(path)) {
    assert.notEqual(got.browser, got.worker, `'${path}' is listed as a known difference but both sides now agree; update the table.`);
  } else {
    assert.equal(got.browser, got.worker, `Browser and Worker disagree on '${path}': guard ${got.browser}, Worker ${got.worker}.`);
  }
}

delete globalThis.window;
