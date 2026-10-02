// DEPLOY_TIER (wrangler.toml, one per environment) is the only source of the
// Worker's tier. utils/env-guard.js rejects any other value, so every request
// that reaches a handler has a valid tier.
// Must equal DEPLOY_TIERS in scripts/utils/env.js
// (tools/config-sync/locales.test.js checks it).
export const DEPLOY_TIERS = Object.freeze(['dev', 'stage', 'prod']);

export const isDeployTier = (value) => DEPLOY_TIERS.includes(value);

export const isProdTier = (env) => env.DEPLOY_TIER === 'prod';

// The client reads this attribute on hosts that aren't loopback or an EDS
// host (scripts/utils/env.js). Authors can create <meta> tags through page or
// bulk metadata but not attributes on <html>, and any upstream value is
// removed before the Worker's own is set.
export const TIER_ATTRIBUTE = 'data-deploy-tier';

// Registers the <html> handler on an existing HTMLRewriter so it runs in the
// same pass as the nonce rewrite.
export const stampDeployTier = (rewriter, tier) => rewriter.on('html', {
  element: (el) => {
    el.removeAttribute(TIER_ATTRIBUTE);
    if (isDeployTier(tier)) el.setAttribute(TIER_ATTRIBUTE, tier);
  },
});

// Existing-site HTML: remove only, set nothing, so that origin can never
// supply a tier even if it later loads the shared client scripts.
export const stripDeployTier = (rewriter) => rewriter.on('html', {
  element: (el) => { el.removeAttribute(TIER_ATTRIBUTE); },
});

// Non-prod Workers must never be indexed, whichever origin answered.
export const NOINDEX = 'noindex, nofollow';

export const DISALLOW_ALL_ROBOTS = 'User-agent: *\nDisallow: /';

export const robotsDisallowAll = () => new Response(DISALLOW_ALL_ROBOTS, {
  status: 200,
  headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
});

// Returns a response with a mutable header list: fetch() responses (the
// existing origin) have immutable headers.
export const withNoindex = (resp) => {
  const out = new Response(resp.body, resp);
  out.headers.set('x-robots-tag', NOINDEX);
  return out;
};
