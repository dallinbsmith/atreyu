import { AEM_AUTHORING_HOST_PATTERN } from './security/preview-origin.js';

const VALID_TIERS = new Set(['prod', 'stage', 'dev']);
const LOOPBACK_HOST_PATTERN = /^(127\.0\.0\.1|.*localhost.*)$/i;

const hostnameOf = (host = globalThis.window?.location?.hostname ?? '') => host.split(':').at(0) ?? '';

const tierMeta = (doc = globalThis.document) => {
  const tier = doc?.head?.querySelector('meta[name="deploy-tier"]')?.content?.trim().toLowerCase();
  return VALID_TIERS.has(tier) ? tier : null;
};

// Deploy-tier classifier for this page. Adobe EDS hosts ignore authored meta
// because authors can create meta tags there; custom hosts trust Worker meta.
export const classifyEnv = (host, doc) => {
  const hostname = hostnameOf(host);
  if (LOOPBACK_HOST_PATTERN.test(hostname)) return 'dev';
  if (AEM_AUTHORING_HOST_PATTERN.test(hostname)) return 'stage';
  return tierMeta(doc) ?? 'prod';
};

export const isProdEnv = (env = classifyEnv()) => env === 'prod';

export default classifyEnv();
