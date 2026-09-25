import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

const FOOTER_PATH = '/system/fragments/nav/footer';

// `wrapper` is the .footer-content div itself, never the <footer> block
// root: footer.css's layout rule is `footer { .footer-content { ... } }`, a
// descendant selector that only matches a separate child element.
const decorateFooterContent = (wrapper) => {
  wrapper.classList.add('footer-content');

  const sections = [...wrapper.querySelectorAll('.section')];
  if (sections.length < 2) return;

  // Classify by content shape, never position — see side-by-side.js.
  const legal = sections.find((s) => s.querySelector('ul'));
  legal?.classList.add('section-legal');

  const copyright = sections.findLast((s) => s !== legal);
  copyright?.classList.add('section-copyright');
};

export default async (el) => {
  if (!guardDecorate(el, 'footerDecorated')) return;

  const { locale } = getConfig();
  const fragment = await loadFragmentWithFallback([`${locale.prefix}${FOOTER_PATH}`, FOOTER_PATH]);
  decorateFooterContent(fragment);
  el.append(fragment);
};
