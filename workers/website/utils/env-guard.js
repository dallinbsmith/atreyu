// Every route below depends on these being set — a missing one doesn't fail
// loudly on its own. AEM_ORG/AEM_SITE missing silently builds
// "main--undefined--undefined.aem.live" (handlers/aem.js); LEGACY_ORIGIN
// missing silently proxies to "https://undefined" (handlers/existing-origin.js,
// the strangler fallback hit by every request outside the current tiny
// EDS_PATHS cohort) — both fail confusingly downstream instead of here.
const REQUIRED_ENV_VARS = ['AEM_ORG', 'AEM_SITE', 'LEGACY_ORIGIN'];

// Returns a 500 Response if a required var is missing, otherwise null — call
// this first, before any route runs. Logs a request ID so a report of "the
// site is broken" can be matched back to this exact failure in Cloudflare's
// logs without exposing which vars are configured to the client.
export const checkRequiredEnv = (env) => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]);
  if (!missing.length) return null;
  const requestId = crypto.randomUUID();
  // eslint-disable-next-line no-console -- Workers logs go to Cloudflare's dashboard, not stdout
  console.error(`[${requestId}] Worker misconfigured — missing required env var(s): ${missing.join(', ')}`);
  return new Response(`Server misconfigured (request ${requestId})`, { status: 500 });
};
