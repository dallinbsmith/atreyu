/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { fetchSchedule, fetchFromAem } from './handlers/aem.js';
import fetchDaSc from './handlers/dasc.js';
import fetchRedirect from './handlers/redirects.js';
import { fetchFromExistingOrigin } from './handlers/existing-origin.js';
import { isVariantPage, fetchVariant } from './handlers/variants.js';
import { matchLocalePrefix, stripLocale } from './utils/locale.js';
import { checkRequiredEnv } from './utils/env-guard.js';
import { isMediaPath } from './utils/media.js';
import { ROUTING_MANIFEST, assertValidManifest, matchCohort } from './routing-manifest.js';

// EDS code and shared-content prefixes. An EDS page served through this
// Worker loads its code from its own origin: head.html's /scripts/ and /styles/,
// ak.js's /blocks/ and /templates/ (codeBase), /plugins/experimentation/, icons.js's
// /icons/, CSS masks and favicons under /img/, and /system/ (placeholders.json,
// nav/footer fragments). Without these the strangler sent them to the existing
// origin, which 404s every one. Decision record:
// - Not cohort-gated: these are site-wide, not pages, so they don't grow per phase.
// - Prefix-only (no bare '/scripts' match, unlike EDS_PATHS): they are folders.
// - Locale-gated like pages: /de-de/system/placeholders.json reaches EDS once
//   /de-de has any live cell (routing-manifest.js) and stays on the existing
//   origin until then.
// - Re-check existing-origin collisions before adding a prefix here.
// - No /fonts/: fonts live under /styles/fonts/. No /tools/, /widgets/ or
//   /experiments-panel/: marker hrefs and authoring-only code, never fetched here.
export const EDS_ASSET_PATHS = Object.freeze([
  '/blocks/', '/icons/', '/img/', '/plugins/', '/scripts/', '/styles/', '/system/', '/templates/',
]);

// Takes a locale-stripped path.
const isEdsAssetPath = (path) => EDS_ASSET_PATHS.some((p) => path.startsWith(p));

const isRUMRequest = (url) => /\/\.(rum|optel)\/.*/.test(url.pathname);

// Encoded slashes/backslashes: the URL parser resolves `..` and `%2e%2e`
// segments before this runs, but it leaves `%2F`/`%5C` encoded, so a path
// like /scripts/..%2Fdrafts%2Fx would match a prefix here while an origin
// that decodes it could see a different path. No real EDS asset or page
// needs one, so these stay on the existing origin rather than reach EDS.
const ENCODED_SEPARATOR = /%2f|%5c/i;

// Builds isEdsPath for a manifest (tests inject their own). `isCellLive(cell,
// env)` is the per-request seam for a runtime kill switch: it can only
// filter the manifest's cells, so env may remove cells but never add one; the
// manifest is the ceiling. English code assets are not cohort-gated.
// A throwing predicate (e.g. a malformed env var) counts as "not live", so the
// request falls back to the existing origin instead of a 500.
export const createIsEdsPath = (manifest, isCellLive = () => true) => {
  const { cohorts, cells } = assertValidManifest(manifest, undefined, EDS_ASSET_PATHS);
  const live = (cell, env) => {
    try {
      return isCellLive(cell, env);
    } catch {
      return false;
    }
  };
  return (pathname, env = {}) => {
    if (ENCODED_SEPARATOR.test(pathname)) return false;
    const locale = matchLocalePrefix(pathname) ?? '';
    const path = stripLocale(pathname);
    const localeCells = cells.filter((cell) => cell.locale === locale && live(cell, env));
    if (isEdsAssetPath(path)) return locale === '' || localeCells.length > 0;
    const cohort = matchCohort(cohorts, path);
    return cohort !== undefined && localeCells.some((cell) => cell.cohort === cohort);
  };
};

// Runtime kill switches belong in the predicate passed as the second argument
// (e.g. cell.locale not in env.EDS_LOCALES_DISABLED). Don't read env elsewhere.
export const isEdsPath = createIsEdsPath(ROUTING_MANIFEST);

// Which pages EDS serves is decided per (cohort × locale) cell in
// routing-manifest.js. EDS_PATHS is derived from it (after validation above):
// the prefixes of every cohort with a live English cell (read-only view, kept
// for tests and docs).
export const EDS_PATHS = Object.freeze(ROUTING_MANIFEST.cells
  .filter(({ locale }) => locale === '')
  .flatMap(({ cohort }) => ROUTING_MANIFEST.cohorts[cohort]));

// Pages are authored without trailing slash (/blog, not /blog/index). Match the
// existing origin's slashless redirect for routed EDS pages. Asset
// folders are never redirected. All trailing slashes go in one hop. Collapsing
// leading slashes is defense in depth: Location can never start with '//'.
export const isTrailingSlashPage = (pathname) => pathname.length > 1 && pathname.endsWith('/')
  && !isRUMRequest({ pathname }) && !isEdsAssetPath(stripLocale(pathname));

const redirectTrailingSlash = ({ url, savedSearch }) => new Response(null, {
  status: 308,
  headers: { location: `/${url.pathname.replace(/^\/+|\/+$/g, '')}${savedSearch}` },
});

// `global: true` marks a ROUTES entry as Worker-owned regardless of cohort status
// (drafts denial, langstore denial, schedules, dasc) — the strangler below must
// never intercept these. isGlobalRoute is derived directly from ROUTES' own match
// functions so the exemption can never drift out of sync with what these routes
// actually match.
const ROUTES = [
  // Global routes must run before content-authored redirects so authors cannot
  // bypass Worker-owned handlers such as drafts, schedules, dasc or variants.
  // DA's Loc app stages translation-in-progress content under /langstore/{locale}/
  // — this path must never fall through to the legacy origin undefined, and must
  // never be treated as real page content once the EDS_PATHS cohort grows.
  {
    match: (path) => path.includes('/schedules/') && path.endsWith('json'),
    handler: fetchSchedule,
    global: true,
  },
  {
    match: (path) => path.includes('/dasc/') && path.endsWith('json'),
    handler: fetchDaSc,
    global: true,
  },
  {
    match: (path) => path.startsWith('/drafts'),
    handler: () => new Response('Not found - drafts are denied on production.', { status: 404 }),
    global: true,
  },
  // A/B variant pages (/v/): only the experimentation plugin's same-origin
  // fetch gets them; direct visits and crawlers get a 404 (handlers/variants.js).
  {
    match: isVariantPage,
    handler: fetchVariant,
    cache: true,
    global: true,
  },
  {
    match: (path) => path.startsWith('/langstore'),
    handler: () => new Response('Not found - langstore staging is denied on production.', { status: 404 }),
    global: true,
  },
  {
    match: () => true,
    handler: fetchRedirect,
  },
  // After fetchRedirect, whose lookup ignores trailing slashes: one hop, not two.
  {
    match: isTrailingSlashPage,
    handler: redirectTrailingSlash,
  },
  {
    match: () => true,
    handler: fetchFromAem,
    cache: true,
  },
];

const isGlobalRoute = (pathname) => ROUTES.some(({ match, global }) => global && match(pathname));

const getExtension = (path) => {
  const basename = path.split('/').pop();
  const pos = basename.lastIndexOf('.');
  return (basename === '' || pos < 1) ? '' : basename.slice(pos + 1);
};

const isMediaRequest = (url) => isMediaPath(url.pathname);

const getPortRedirect = (request, url) => {
  if (url.port && url.hostname !== 'localhost') {
    const redirectTo = new URL(request.url);
    redirectTo.port = '';
    return new Response(`Moved permanently to ${redirectTo.href}`, {
      status: 301,
      headers: { location: redirectTo.href },
    });
  }
  return null;
};

const getRUMRequest = (request, url) => {
  if (isRUMRequest(url)) {
    if (!['GET', 'POST', 'OPTIONS'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405 });
    }
  }
  return null;
};

const keepOnly = (searchParams, allowed) => {
  [...searchParams.keys()]
    .filter((k) => !allowed.includes(k))
    .forEach((k) => searchParams.delete(k));
};

const formatSearchParams = (url) => {
  const { search, searchParams } = url;

  if (isMediaRequest(url)) {
    keepOnly(searchParams, ['format', 'height', 'optimize', 'width']);
  } else if (getExtension(url.pathname) === 'json') {
    keepOnly(searchParams, ['limit', 'offset', 'sheet']);
  } else {
    url.search = '';
  }
  searchParams.sort();

  return search;
};

const formatRequest = (env, request, url) => {
  const aemUrl = new URL(url.href);
  aemUrl.hostname = `main--${env.AEM_SITE}--${env.AEM_ORG}.aem.live`;
  aemUrl.port = '';
  aemUrl.protocol = 'https:';
  const req = new Request(aemUrl, request);
  // Do not send If-Modified-Since to AEM. A browser holding an old unpublished
  // 404 could revalidate it into a 304 and keep showing the cached 404 after
  // the page is published; a 304 also skips capErrorCaching (handlers/aem.js).
  // Trade-off: aem.live HTML and JSON carry Last-Modified but no ETag, and
  // aem.live ignores If-None-Match even for code assets, whose 200s do carry
  // an ETag. So after this, the origin never answers a browser with a 304:
  // once max-age=7200 runs out, a stale page or asset is refetched in full.
  // For small HTML and code that's acceptable, and better than a stuck 404.
  // If-None-Match stays: AEM sends no ETag on 404s (only code-bus 200s carry
  // one), so it can't renew a 404, and handlers/dasc.js forwards it for its
  // 304 path.
  req.headers.delete('if-modified-since');
  req.headers.set('x-forwarded-host', req.headers.get('host'));
  req.headers.set('x-byo-cdn-type', 'cloudflare');
  if (env.PUSH_INVALIDATION !== 'disabled') {
    req.headers.set('x-push-invalidation', 'enabled');
  }
  if (env.ORIGIN_AUTHENTICATION) {
    req.headers.set('authorization', `token ${env.ORIGIN_AUTHENTICATION}`);
  }
  return req;
};

export default {
  fetch: async (req, env) => {
    const envResp = checkRequiredEnv(env);
    if (envResp) return envResp;

    const url = new URL(req.url);

    const portResp = getPortRedirect(req, url);
    if (portResp) return portResp;

    if (url.hostname === 'blog.frame.io') {
      return new Response(null, {
        status: 301,
        headers: { location: `https://frame.io/blog${url.pathname}${url.search}` },
      });
    }

    const rumResp = getRUMRequest(req, url);
    if (rumResp) return rumResp;

    // Strangler check: RUM/telemetry beacons and Worker-owned global routes
    // (drafts denial, schedules, dasc — see ROUTES' `global: true` entries) always
    // fall through to the EDS pipeline instead of the legacy origin, regardless of
    // cohort status. Everything else not yet migrated (or the kill switch is set)
    // falls back to the existing origin, using the original request — not one
    // already rewritten to the EDS hostname by formatRequest below.
    if (!isRUMRequest(url) && !isGlobalRoute(url.pathname)
      && (env.EDS_DISABLED === 'true' || !isEdsPath(url.pathname, env))) {
      return fetchFromExistingOrigin({ url, env, request: req });
    }

    // formatSearchParams normalizes/filters url.search (and mutates `url` in place) —
    // it must run before formatRequest builds the outbound/cached request from `url`,
    // otherwise the cache key snapshots the raw, unfiltered query string and every
    // distinct query permutation fragments the CDN cache.
    const savedSearch = formatSearchParams(url);

    const request = formatRequest(env, req, url);

    for (const { match, handler, cache } of ROUTES) {
      if (match(url.pathname)) {
        // eslint-disable-next-line no-await-in-loop
        const resp = await handler({ url, env, request, cache, savedSearch });
        if (resp) return resp;
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
