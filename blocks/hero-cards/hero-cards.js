// Back-compat shim: pages authored before the rename use the table header
// `Hero Cards` (→ class `hero-cards`), which makes the framework load this
// file. Delegate to the canonical `hero-cards-transition` block — renaming the
// element class first so the new block's CSS selectors and `decorateRichText`
// scope all match. Once every page's table header is updated to
// `Hero Cards Transition` in DA, delete this directory.
import { loadStyle, getConfig } from '../../scripts/ak.js';
import init from '../hero-cards-transition/hero-cards-transition.js';

export default async (el) => {
  el.classList.remove('hero-cards');
  el.classList.add('hero-cards-transition');
  // The framework only auto-loads THIS block's own hero-cards.css for an
  // element authored as `Hero Cards` — hero-cards-transition.css is never
  // requested on its own. A nested `@import` inside `@layer blocks {}` can't
  // fill that gap (silently dropped by browsers — see hero-cards.css), so
  // load the real stylesheet explicitly instead, same pattern
  // scripts/utils/error.js uses for its own second stylesheet.
  const { codeBase } = getConfig();
  const [result] = await Promise.all([
    init(el),
    loadStyle(`${codeBase}/blocks/hero-cards-transition/hero-cards-transition.css`),
  ]);
  return result;
};
