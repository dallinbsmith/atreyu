import {
  AEM_AUTHORING_HOST_PATTERN,
  LOOPBACK_HOST_PATTERN,
  hostnameOf,
} from './security/preview-origin.js';

// Deploy-tier classifier for this page. Until the Worker owns a signal authors
// cannot create, custom hosts fail closed to production.
export const classifyEnv = (host = globalThis.window?.location?.host ?? '') => {
  const hostname = hostnameOf(host);
  if (LOOPBACK_HOST_PATTERN.test(hostname)) return 'dev';
  if (AEM_AUTHORING_HOST_PATTERN.test(hostname)) return 'stage';
  return 'prod';
};

export const isProdEnv = (env = classifyEnv()) => env === 'prod';

export default classifyEnv();
