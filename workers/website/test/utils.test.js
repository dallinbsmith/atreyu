// Plain node:test coverage for this Worker's pure-function, non-Cloudflare-
// runtime-dependent modules. Run with `npm test` (from this directory) or
// `node --test test/` — no build step, no new devDependency, and no need to
// go through Web Test Runner since none of this touches the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALE_PREFIXES, matchLocalePrefix, stripLocale } from '../utils/locale.js';
import { checkRequiredEnv } from '../utils/env-guard.js';

test('LOCALE_PREFIXES holds the 9 real prefixed locales (en-us is the unprefixed default)', () => {
  assert.equal(LOCALE_PREFIXES.length, 9);
  assert.ok(LOCALE_PREFIXES.every((prefix) => prefix.startsWith('/')));
});

test('matchLocalePrefix matches an exact locale root', () => {
  assert.equal(matchLocalePrefix('/de-de'), '/de-de');
});

test('matchLocalePrefix matches a locale-prefixed subpath', () => {
  assert.equal(matchLocalePrefix('/de-de/pricing'), '/de-de');
});

test('matchLocalePrefix returns null for a non-locale path', () => {
  assert.equal(matchLocalePrefix('/pricing'), null);
});

test('matchLocalePrefix returns null for en-us (unprefixed default, not in the list)', () => {
  assert.equal(matchLocalePrefix('/en-us'), null);
});

test('matchLocalePrefix does not false-positive on a path that merely starts with a locale code as a substring', () => {
  assert.equal(matchLocalePrefix('/de-designsomething'), null);
});

test('stripLocale strips a locale prefix and keeps the leading slash', () => {
  assert.equal(stripLocale('/de-de/pricing'), '/pricing');
});

test('stripLocale collapses a bare locale root to "/"', () => {
  assert.equal(stripLocale('/de-de'), '/');
});

test('stripLocale returns the path unchanged when there is no locale prefix', () => {
  assert.equal(stripLocale('/pricing'), '/pricing');
});

test('checkRequiredEnv returns null when all required vars are present', () => {
  const env = { AEM_ORG: 'org', AEM_SITE: 'site', LEGACY_ORIGIN: 'https://legacy.example' };
  assert.equal(checkRequiredEnv(env), null);
});

test('checkRequiredEnv returns a 500 Response when a required var is missing', () => {
  const env = { AEM_ORG: 'org', AEM_SITE: 'site' }; // LEGACY_ORIGIN missing
  const result = checkRequiredEnv(env);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 500);
});

test('checkRequiredEnv treats an empty string as missing, not just undefined', () => {
  const env = { AEM_ORG: '', AEM_SITE: 'site', LEGACY_ORIGIN: 'https://legacy.example' };
  assert.ok(checkRequiredEnv(env) instanceof Response);
});

test('checkRequiredEnv response body includes a request id but never the configured var values', async () => {
  const result = checkRequiredEnv({});
  const body = await result.text();
  assert.match(body, /Server misconfigured \(request [0-9a-f-]+\)/);
  assert.doesNotMatch(body, /AEM_ORG|AEM_SITE|LEGACY_ORIGIN/);
});
