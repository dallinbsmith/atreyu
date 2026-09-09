import {
  loadFragmentWithFallback, getReplaceEl, replaceElWithFragment,
} from '../../scripts/utils/fragment.js';
import { isPlatformHost } from '../../scripts/utils/platform-host.js';
import { getConfig } from '../../scripts/ak.js';

const getRequestPath = (a) => {
  const { hostname, pathname } = a;
  const href = a.getAttribute('href');
  if (href.startsWith('/')) return pathname;
  if (hostname === window.location.hostname) return pathname;
  if (isPlatformHost(hostname)) {
    const [aemOrg, aemSite] = hostname.split('.')[0].split('--').reverse();
    const [winOrg, winSite] = window.location.hostname.split('.')[0].split('--').reverse();
    if ((aemOrg === winOrg) && (aemSite === winSite)) return pathname;
  }
  return a.href;
};

export default async (a) => {
  if (a.dataset.fragmentDecorated) return;
  a.dataset.fragmentDecorated = 'true';

  const path = getRequestPath(a);
  const { locale, log } = getConfig();

  try {
    const fragment = await loadFragmentWithFallback([`${locale.prefix}${path}`, path]);
    const elToReplace = getReplaceEl(a);
    replaceElWithFragment(elToReplace, fragment, path);
  } catch (ex) {
    log(ex, a);
    a.remove();
  }
};
