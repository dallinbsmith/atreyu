import {
  loadFragmentWithFallback, getReplaceEl, replaceElWithFragment,
} from '../../scripts/utils/fragment.js';
import { isPlatformHost } from '../../scripts/utils/platform-host.js';
import { getConfig } from '../../scripts/ak.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

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
  if (!guardDecorate(a, 'fragmentDecorated')) return;

  const path = getRequestPath(a);
  const { locale: { prefix }, locales = {}, log } = getConfig();
  // ak.js decorateLink has usually localized the href already; strip the current
  // locale so it isn't prefixed twice. Locale fragment first, root fallback. A
  // path already under another locale (authored on purpose) is used as-is,
  // matching localizeUrl.
  const bare = prefix && path.startsWith(`${prefix}/`) ? path.slice(prefix.length) : path;
  const otherLocale = Object.keys(locales).some((key) => key && bare.startsWith(`${key}/`));
  const paths = bare.startsWith('/') && !otherLocale ? [...new Set([`${prefix}${bare}`, bare])] : [bare];

  try {
    const fragment = await loadFragmentWithFallback(paths);
    const elToReplace = getReplaceEl(a);
    if (!elToReplace) {
      log(`Fragment anchor detached: ${path}`);
      return;
    }
    replaceElWithFragment(elToReplace, fragment, path);
  } catch (ex) {
    log(ex, a);
    a.remove();
  }
};
