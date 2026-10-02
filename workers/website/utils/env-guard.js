import { DEPLOY_TIERS, isDeployTier } from './deploy-tier.js';

// Every route below depends on these being set — a missing one doesn't fail
// loudly on its own. AEM_ORG/AEM_SITE missing silently builds
// "main--undefined--undefined.aem.live" (handlers/aem.js); DA_ORG/DA_SITE
// missing builds an "undefined" DA content path (handlers/dasc.js);
// LEGACY_ORIGIN missing silently proxies to "https://undefined"
// (handlers/existing-origin.js, the strangler fallback hit by every request
// outside the current tiny EDS_PATHS cohort) — all fail confusingly
// downstream instead of here. DA_* has no fallback to AEM_* on purpose: the
// EDS origin org and the DA content org can differ, and a silent fallback
// would read the wrong content. Every environment in wrangler.toml sets both.
export const REQUIRED_ENV_VARS = ['AEM_ORG', 'AEM_SITE', 'DA_ORG', 'DA_SITE', 'LEGACY_ORIGIN', 'DEPLOY_TIER'];

// DEPLOY_TIER must also be one of DEPLOY_TIERS. An unknown value fails the
// same way as a missing one rather than defaulting, so a typo can never
// serve a non-prod Worker as indexable or a prod Worker as noindex.
const isInvalid = (key, value) => !value || (key === 'DEPLOY_TIER' && !isDeployTier(value));

// Returns a 500 Response if a required var is missing or invalid, otherwise
// null — call this first, before any route runs. Logs a request ID so a
// report of "the site is broken" can be matched back to this exact failure in
// Cloudflare's logs without exposing which vars are configured to the client.
export const checkRequiredEnv = (env) => {
  const bad = REQUIRED_ENV_VARS.filter((key) => isInvalid(key, env[key]));
  if (!bad.length) return null;
  const requestId = crypto.randomUUID();
  const hint = bad.includes('DEPLOY_TIER') ? ` (DEPLOY_TIER must be one of ${DEPLOY_TIERS.join('|')})` : '';
  // eslint-disable-next-line no-console -- Workers logs go to Cloudflare's dashboard, not stdout
  console.error(`[${requestId}] Worker misconfigured — missing or invalid env var(s): ${bad.join(', ')}${hint}`);
  return new Response(`Server misconfigured (request ${requestId})`, { status: 500 });
};
