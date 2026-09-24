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

// Phase 1 cohort only (master-plan/implementation-plan.md, "Migration Cohort Phases").
// Grows as each phase ships: Phase 2 adds /customers/ + /resources/, Phase 3 adds
// / + /enterprise + /demo, Phase 4 adds /pricing. Do not pre-populate ahead of ship.
export const EDS_PATHS = Object.freeze(['/blog/', '/glossary/', '/integrations/']);

// Which locales actually have confirmed, live, translated content on the EDS origin
// right now — a second axis from EDS_PATHS (cohort), not a duplicate of it. Phase 1
// is English-only: the GLAAS -> DA translation pipeline doesn't exist yet, so a
// locale-prefixed path (e.g. /de-de/blog/x) strips to a real EDS_PATHS match but
// there is no /de-de/blog/x page on the EDS origin — it must keep falling through to
// the existing origin. This is a subset of LOCALE_PREFIXES by construction (every
// entry here must also appear there); it never gets ahead of what's actually shipped.
const EDS_LOCALES = [];

// EDS code and shared-content prefixes (F-76). An EDS page served through this
// Worker loads its code from its own origin: head.html's /scripts/ and /styles/,
// ak.js's /blocks/ and /templates/ (codeBase), /plugins/experimentation/, icons.js's
// /icons/, CSS masks and favicons under /img/, and /system/ (placeholders.json,
// nav/footer fragments). Without these the strangler sent them to the existing
// origin, which 404s every one. Decision record:
// - Not cohort-gated: these are site-wide, not pages, so they don't grow per phase.
// - Prefix-only (no bare '/scripts' match, unlike EDS_PATHS): they are folders.
// - Same EDS_LOCALES gate as pages, so /de-de/system/placeholders.json follows
//   /de-de pages once that locale ships and stays on the existing origin until then.
// - Collision check (2026-09-24): Falkor (origin/develop) serves /_next/, /api/,
//   favicon.*, icon-*.png, manifest.json, robots.txt, sitemap.xml, and CMS slugs via
//   [lang]/[[...slug]]. frame.io's sitemap has no page under any prefix below, and
//   live frame.io 404s each of them. Re-check before adding a prefix here.
// - No /fonts/: fonts live under /styles/fonts/. No /tools/, /widgets/ or
//   /experiments-panel/: marker hrefs and authoring-only code, never fetched here.
export const EDS_ASSET_PATHS = Object.freeze([
  '/blocks/', '/icons/', '/img/', '/plugins/', '/scripts/', '/styles/', '/system/', '/templates/',
]);

// Encoded slashes/backslashes: the URL parser resolves `..` and `%2e%2e`
// segments before this runs, but it leaves `%2F`/`%5C` encoded, so a path
// like /scripts/..%2Fdrafts%2Fx would match a prefix here while an origin
// that decodes it could see a different path. No real EDS asset or page
// needs one, so these stay on the existing origin rather than reach EDS.
const ENCODED_SEPARATOR = /%2f|%5c/i;

export const isEdsPath = (pathname) => {
  if (ENCODED_SEPARATOR.test(pathname)) return false;
  const localePrefix = matchLocalePrefix(pathname);
  if (localePrefix && !EDS_LOCALES.includes(localePrefix)) return false;

  const path = stripLocale(pathname);
  return EDS_PATHS.some((p) => path.startsWith(p))
    || EDS_PATHS.map((p) => p.slice(0, -1)).includes(path)
    || EDS_ASSET_PATHS.some((p) => path.startsWith(p));
};

// `global: true` marks a ROUTES entry as Worker-owned regardless of cohort status
// (drafts denial, langstore denial, schedules, dasc) — the strangler below must
// never intercept these. isGlobalRoute is derived directly from ROUTES' own match
// functions so the exemption can never drift out of sync with what these routes
// actually match.
const ROUTES = [
  // Bug-squash fix, 2026-08-28: these `global: true` routes must run
  // before fetchRedirect, not after. redirects.json is DA-managed content —
  // a redirect entry whose Source normalizes to a path one of these
  // would otherwise match (most seriously /drafts/*) returns a 301 and the
  // loop below returns immediately, so drafts-deny (or the schedules/dasc
  // handlers) never gets reached at all. `global: true` already documents
  // the intent that these are Worker-owned regardless of cohort status; the
  // array order previously didn't actually honor that for the redirect
  // route specifically. fetchRedirect now only runs once none of these
  // match, so a content author can never author their way past them.
  // langstore denial added 2026-09-01 (localization-game-plan-2026-09.md §6):
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
const isRUMRequest = (url) => /\/\.(rum|optel)\/.*/.test(url.pathname);

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
  // No If-Modified-Since to AEM (checked with curl, 2026-09-24). AEM's 404 for
  // a not-yet-published page carries the same Last-Modified that the page's
  // 200 has once published. After publish, aem.live answers that date with a
  // 304 (while the path still 404s, it answers 404). A browser holding the old
  // 404 would get the 304 and keep showing it, and a 304 skips
  // capErrorCaching (handlers/aem.js). The cost is that browser revalidation
  // of a stale page is a full 200 instead of a 304.
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
      && (env.EDS_DISABLED === 'true' || !isEdsPath(url.pathname))) {
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
