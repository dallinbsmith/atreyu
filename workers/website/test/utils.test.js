// Plain node:test coverage for this Worker's pure-function, non-Cloudflare-
// runtime-dependent modules. Run with `npm test` (from this directory) or
// `node --test test/` — no build step, no new devDependency, and no need to
// go through Web Test Runner since none of this touches the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCALE_PREFIXES, matchLocalePrefix, stripLocale } from '../utils/locale.js';
import { checkRequiredEnv, REQUIRED_ENV_VARS } from '../utils/env-guard.js';
import { DEPLOY_TIERS } from '../utils/deploy-tier.js';

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

const VALID = Object.freeze({
  AEM_ORG: 'org',
  AEM_SITE: 'site',
  DA_ORG: 'da-org',
  DA_SITE: 'da-site',
  LEGACY_ORIGIN: 'legacy.example',
  DEPLOY_TIER: 'prod',
});

const quietly = (t) => t.mock.method(console, 'error', () => {});

test('REQUIRED_ENV_VARS is the reviewed list', () => {
  assert.deepEqual(REQUIRED_ENV_VARS, ['AEM_ORG', 'AEM_SITE', 'DA_ORG', 'DA_SITE', 'LEGACY_ORIGIN', 'DEPLOY_TIER']);
});

test('checkRequiredEnv returns null when all required vars are present', () => {
  for (const tier of DEPLOY_TIERS) {
    assert.equal(checkRequiredEnv({ ...VALID, DEPLOY_TIER: tier }), null, tier);
  }
});

test('checkRequiredEnv returns a 500 Response when any required var is missing', (t) => {
  quietly(t);
  for (const key of REQUIRED_ENV_VARS) {
    const { [key]: _, ...env } = VALID;
    const result = checkRequiredEnv(env);
    assert.ok(result instanceof Response, key);
    assert.equal(result.status, 500, key);
  }
});

test('checkRequiredEnv treats an empty string as missing, not just undefined', (t) => {
  quietly(t);
  for (const key of REQUIRED_ENV_VARS) {
    assert.ok(checkRequiredEnv({ ...VALID, [key]: '' }) instanceof Response, key);
  }
});

test('checkRequiredEnv rejects a DEPLOY_TIER outside dev|stage|prod and names it in the log', (t) => {
  const log = quietly(t);
  for (const bad of ['production', 'staging', 'Prod', 'PROD', ' prod', 'qa', 'true', '1']) {
    const result = checkRequiredEnv({ ...VALID, DEPLOY_TIER: bad });
    assert.equal(result?.status, 500, bad);
  }
  assert.match(log.mock.calls.at(-1).arguments[0], /DEPLOY_TIER must be one of dev\|stage\|prod/);
});

test('checkRequiredEnv response body includes a request id but never the configured var values', async (t) => {
  quietly(t);
  const result = checkRequiredEnv({});
  const body = await result.text();
  assert.match(body, /Server misconfigured \(request [0-9a-f-]+\)/);
  assert.doesNotMatch(body, /AEM_ORG|AEM_SITE|DA_ORG|DA_SITE|LEGACY_ORIGIN|DEPLOY_TIER/);
});

// Every wrangler.toml environment must pass checkRequiredEnv once
// LEGACY_ORIGIN (dashboard/.dev.vars) is added, or its next deploy 500s.
// Vars aren't inherited by [env.*], so each block is checked on its own.
test('wrangler.toml sets every required var, with the expected DEPLOY_TIER, in each environment', () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const blocks = {};
  let section = 'top-level';
  toml.split('\n').forEach((line) => {
    const header = line.match(/^\[env\.([a-z]+)\]/);
    if (header) [, section] = header;
    const vars = line.match(/^vars = \{(.*)\}$/);
    if (vars) {
      blocks[section] = Object.fromEntries([...vars[1].matchAll(/([A-Z_]+) = "([^"]*)"/g)].map(([, k, v]) => [k, v]));
    }
  });
  assert.deepEqual(Object.keys(blocks), ['top-level', 'staging', 'production']);
  const expectedTier = { 'top-level': 'dev', staging: 'stage', production: 'prod' };
  for (const [name, vars] of Object.entries(blocks)) {
    assert.equal(vars.DEPLOY_TIER, expectedTier[name], name);
    assert.equal(checkRequiredEnv({ ...vars, LEGACY_ORIGIN: 'legacy.example' }), null, name);
  }
});

// A plain `wrangler deploy` (no --env) publishes the top-level config, which
// is DEPLOY_TIER dev. Zone routes must therefore live only under
// [env.production], and every deploy script must name an environment.
test('zone routes appear only under [env.production]', () => {
  const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  let section = 'top-level';
  toml.split('\n').forEach((line) => {
    const header = line.match(/^\[\[?([^\]]+)\]\]?/);
    if (header) {
      const [, name] = header;
      if (/(^|\.)routes$/.test(name)) assert.match(name, /^env\.production\.routes$/, line);
      section = name;
    }
    if (/^\s*routes?\s*=/.test(line)) {
      assert.equal(section, 'env.production', `route outside [env.production]: ${line}`);
    }
  });
});

test('every npm deploy script passes --env', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const deploys = Object.entries(scripts).filter(([name, cmd]) => name.startsWith('deploy') || /wrangler\s+(deploy|publish)/.test(cmd));
  assert.ok(deploys.length > 0);
  for (const [name, cmd] of deploys) assert.match(cmd, /\s--env[\s=]\S+/, name);
});
