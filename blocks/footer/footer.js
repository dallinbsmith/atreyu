import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';

const FOOTER_PATH = '/system/fragments/nav/footer';

export default async (el) => {
  if (el.dataset.footerDecorated) return;
  el.dataset.footerDecorated = 'true';

  const { locale } = getConfig();
  const fragment = await loadFragmentWithFallback([`${locale.prefix}${FOOTER_PATH}`, FOOTER_PATH]);
  fragment.classList.add('footer-content');

  const sections = [...fragment.querySelectorAll('.section')];
  if (sections.length < 2) {
    el.append(fragment);
    return;
  }

  // Classify by content shape, never position — see side-by-side.js.
  const legal = sections.find((s) => s.querySelector('ul'));
  legal?.classList.add('section-legal');

  const copyright = sections.findLast((s) => s !== legal);
  copyright?.classList.add('section-copyright');

  el.append(fragment);
};
