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
import { matchLocalePrefix, stripLocale } from './utils/locale.js';

// Phase 1 cohort only (master-plan/implementation-plan.md, "Migration Cohort Phases").
// Grows as each phase ships: Phase 2 adds /customers/ + /resources/, Phase 3 adds
// / + /enterprise + /demo, Phase 4 adds /pricing. Do not pre-populate ahead of ship.
const EDS_PATHS = ['/blog/', '/glossary/', '/integrations/'];

// Which locales actually have confirmed, live, translated content on the EDS origin
// right now — a second axis from EDS_PATHS (cohort), not a duplicate of it. Phase 1
// is English-only: the GLAAS -> DA translation pipeline doesn't exist yet, so a
// locale-prefixed path (e.g. /de-de/blog/x) strips to a real EDS_PATHS match but
// there is no /de-de/blog/x page on the EDS origin — it must keep falling through to
// the existing origin. This is a subset of LOCALE_PREFIXES by construction (every
// entry here must also appear there); it never gets ahead of what's actually shipped.
const EDS_LOCALES = [];
export const isEdsPath = (pathname) => {
  const localePrefix = matchLocalePrefix(pathname);
  if (localePrefix && !EDS_LOCALES.includes(localePrefix)) return false;

  const path = stripLocale(pathname);
  return EDS_PATHS.some((p) => path.startsWith(p))
    || EDS_PATHS.map((p) => p.slice(0, -1)).includes(path);
};

// `global: true` marks a ROUTES entry as Worker-owned regardless of cohort status
// (drafts denial, schedules, dasc) — the strangler below must never intercept these.
// isGlobalRoute is derived directly from ROUTES' own match functions so the
// exemption can never drift out of sync with what these routes actually match.
const ROUTES = [
  {
    match: () => true,
    handler: fetchRedirect,
  },
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

const isMediaRequest = (url) => /\/media_[0-9a-f]{40,}[/a-zA-Z0-9_-]*\.[0-9a-z]+$/.test(url.pathname);
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
