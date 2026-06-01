import { loadFragment, getReplaceEl } from '../../scripts/utils/fragment.js';

export { loadFragment };

const getRequestPath = (a) => {
  const { hostname, pathname } = a;
  const href = a.getAttribute('href');
  if (href.startsWith('/')) return pathname;
  if (hostname === window.location.hostname) return pathname;
  const isAem = ['.da.', '.aem.', 'local'].some((host) => hostname.includes(host));
  if (isAem) {
    const [aemOrg, aemSite] = hostname.split('.')[0].split('--').reverse();
    const [winOrg, winSite] = window.location.hostname.split('.')[0].split('--').reverse();
    if ((aemOrg === winOrg) && (aemSite === winSite)) return pathname;
  }
  return a.href;
};

export default async (a) => {
  const path = getRequestPath(a);

  const fragment = await loadFragment(path);
  if (fragment) {
    const elToReplace = getReplaceEl(a);
    const sections = fragment.querySelectorAll(':scope > .section');
    const children = sections.length === 1
      ? fragment.querySelectorAll(':scope > *')
      : [fragment];
    for (const [idx, child] of children.entries()) {
      if (path.startsWith('/')) child.id = btoa(encodeURIComponent(`${path}/${idx + 1}`));
      elToReplace.insertAdjacentElement('afterend', child);
    }
    elToReplace.remove();
  }
};
