// Back-compat shim: pages authored before the rename use the table header
// `Hero Cards` (→ class `hero-cards`), which makes the framework load this
// file. Delegate to the canonical `hero-cards-transition` block — renaming the
// element class first so the new block's CSS selectors and `decorateRichText`
// scope all match. Once every page's table header is updated to
// `Hero Cards Transition` in DA, delete this directory.
import init from '../hero-cards-transition/hero-cards-transition.js';

export default (el) => {
  el.classList.remove('hero-cards');
  el.classList.add('hero-cards-transition');
  return init(el);
};
