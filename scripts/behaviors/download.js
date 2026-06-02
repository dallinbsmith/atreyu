import { track } from '../utils/analytics.js';

// Download widget: resolve the correct asset for the visitor's platform/architecture.
// Link carries candidate URLs as query params, e.g. ?mac=…&win=…&mac-arm=…
const detectPlatform = async () => {
  const uaData = navigator.userAgentData;
  const ua = navigator.userAgent;
  const isMac = uaData ? uaData.platform === 'macOS' : /Mac/i.test(ua);
  if (!isMac) return { os: 'win', arm: false };
  const arch = await uaData?.getHighEntropyValues?.(['architecture'])
    .then((v) => v.architecture)
    .catch(() => null);
  const arm = arch ? arch === 'arm' : /arm|aarch64/i.test(ua);
  return { os: 'mac', arm };
};

export default async (a) => {
  if (a.dataset.behaviorBound) return;
  a.dataset.behaviorBound = '';
  const params = new URL(a.href, window.location.href).searchParams;
  if (![...params.keys()].length) return; // no candidates — leave href as-is
  const { os, arm } = await detectPlatform();
  const target = (os === 'mac' && arm && params.get('mac-arm'))
    || params.get(os)
    || params.get('default');
  if (!target) return;
  a.href = target;
  a.addEventListener('click', () => track('download', { os, arm, href: target }));
};
