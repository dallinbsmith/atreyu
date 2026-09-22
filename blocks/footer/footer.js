import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { guardDecorate, registerRedecorator } from '../../scripts/utils/lifecycle.js';

const FOOTER_PATH = '/system/fragments/nav/footer';

// Extracted so a UC-02 chrome-scoped experiment swap (ref_nav_architecture_
// research memory) can redecorate the fresh swapped-in content the same way
// the normal load path does — see the module-scope registerRedecorator()
// call below. `wrapper` is the .footer-content div itself, never the
// <footer> block root: footer.css's layout rule is `footer { .footer-content
// { max-width: ...; margin: 0 auto; ...} }`, a descendant selector that only
// matches a separate child element, not <footer> itself. Because
// experimentation.js's target.replaceChildren() only ever replaces a target's
// *children*, registering the redecorator on '.footer-content' (the wrapper)
// rather than 'footer' (the block root) means the wrapper's own class is
// never at risk of being lost by a swap in the first place — always
// re-applying it here anyway is cheap and makes that safety explicit rather
// than implicit.
export const decorateFooterContent = (wrapper) => {
  wrapper.classList.add('footer-content');

  const sections = [...wrapper.querySelectorAll('.section')];
  if (sections.length < 2) return;

  // Classify by content shape, never position — see side-by-side.js.
  const legal = sections.find((s) => s.querySelector('ul'));
  legal?.classList.add('section-legal');

  const copyright = sections.findLast((s) => s !== legal);
  copyright?.classList.add('section-copyright');
};

registerRedecorator('.footer-content', decorateFooterContent);

export default async (el) => {
  if (!guardDecorate(el, 'footerDecorated')) return;

  const { locale } = getConfig();
  const fragment = await loadFragmentWithFallback([`${locale.prefix}${FOOTER_PATH}`, FOOTER_PATH]);
  decorateFooterContent(fragment);
  el.append(fragment);
};
