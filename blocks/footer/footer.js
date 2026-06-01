import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../../scripts/utils/fragment.js';

const FOOTER_PATH = '/fragments/nav/footer';

export default async (el) => {
  const { locale } = getConfig();
  const footerMeta = getMetadata('footer');
  const path = footerMeta || FOOTER_PATH;
  const fragment = await loadFragment(`${locale.prefix}${path}`);
  fragment.classList.add('footer-content');

  const sections = [...fragment.querySelectorAll('.section')];
  if (sections.length < 2) {
    el.append(fragment);
    return;
  }

  const copyright = sections.pop();
  copyright.classList.add('section-copyright');

  const legal = sections.pop();
  legal.classList.add('section-legal');

  el.append(fragment);
};
