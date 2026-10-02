import {
  AEM_AUTHORING_HOST_PATTERN,
  LOOPBACK_HOST_PATTERN,
  hostnameOf,
} from './security/preview-origin.js';

// Keep in sync with workers/website/utils/deploy-tier.js.
const TIERS = ['dev', 'stage', 'prod'];

// Deploy-tier classifier for this page. Loopback and EDS hosts are classified
// by hostname alone. Any other host is served by the Worker, which sets
// <html data-deploy-tier> from its DEPLOY_TIER and strips any upstream value;
// authors cannot create that attribute, so it is the only signal read here
// (never a <meta>, which page or bulk metadata can create). A missing or
// unknown value fails closed to prod.
export const classifyEnv = (
  host = globalThis.window?.location?.host ?? '',
  root = globalThis.document?.documentElement,
) => {
  const hostname = hostnameOf(host);
  if (LOOPBACK_HOST_PATTERN.test(hostname)) return 'dev';
  if (AEM_AUTHORING_HOST_PATTERN.test(hostname)) return 'stage';
  const tier = root?.dataset?.deployTier;
  return TIERS.includes(tier) ? tier : 'prod';
};

export const isProdEnv = (env = classifyEnv()) => env === 'prod';

export default classifyEnv();
