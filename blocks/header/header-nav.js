import { createElement } from '../../scripts/utils/dom.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { decorateSubcategories } from './header-subcategories.js';
import { toggleMenu } from './header-menu-state.js';

// Code-review nit (2026-09-21 parity pass): assumes it runs once on fresh,
// undecorated markup — not idempotent/re-entrant-safe (calling it a second
// time on already-decorated markup would duplicate the mega-menu heading
// below). Not currently reachable as a bug: the one real redecorator caller,
// experimentation.js's applyChallenger, always replaces children with fresh
// markup before calling redecorate(). Documented here so a future caller
// that violates that assumption doesn't hit this silently.
const decorateNavItem = (li) => {
  li.classList.add('main-nav-item');
  const link = li.querySelector(':scope > p > a');
  link?.classList.add('main-nav-link');
  // Real bug found authoring actual nav content, 2026-09-21: `.fragment-content`
  // is not a reliable marker for "this is the resolved mega-menu" — every
  // mega-menu authored so far renders as an unstyled, permanently-open block,
  // because scripts/utils/fragment.js's replaceElWithFragment() strips that
  // wrapper class whenever the referenced fragment resolves to exactly one
  // top-level section (the common case — it unwraps to the section itself),
  // only preserving `.fragment-content` for a 2+-section fragment, a shape
  // nothing has ever actually authored. Classify by content shape instead
  // (blocks.md's Row Classification rule): the mega-menu is whichever direct
  // child of `li` isn't the trigger link's own paragraph — present regardless
  // of which of fragment.js's two unwrap shapes resolved.
  const linkPara = link?.parentElement;
  const resolved = [...li.children].find((child) => child !== linkPara);
  // Second real bug, found empirically (headless Chrome + real styles.css,
  // not just reasoning) once the fix above actually let `.mega-menu` reach a
  // real element: the resolved content IS the platform's own `.section` div
  // (decorateSections() classes every top-level fragment row `.section`
  // before this ever runs). `@layer sections { .section { display: block } }`
  // (styles.css) is declared AFTER `@layer blocks` (this file's own layer,
  // enforced by tools/lint-css-layers.mjs) in the project's `@layer reset,
  // base, tokens, blocks, sections, utilities` order — so it wins over this
  // file's `.mega-menu { display: none }` on the SAME element regardless of
  // selector specificity, and the menu rendered permanently visible
  // (confirmed: all 3 panels are `position: absolute; inset: 0`, so they
  // stack and only the last-painted one, Resources, was visible — "one menu
  // locked open, the others unresponsive" was this, not a JS state bug; the
  // real `.is-open` toggle was already working correctly). Fix: never toggle
  // `display` on an element that also carries `.section` — wrap it in a new
  // element that carries `.mega-menu` alone, same "give the toggled/measured
  // element an uncontested wrapper" pattern pzn.js's `getOrCreateSlot`
  // already uses for the identical class of problem.
  const menu = resolved && createElement('div', { className: 'mega-menu' });
  if (menu) {
    // Real-browser measurement gap (2026-09-21): production repeats the
    // trigger's own label as a real heading at the panel's top ("Features"),
    // never new authored content — mirror `link`'s own text, the same text
    // already used for aria-expanded below. No font-size/weight/letter-
    // spacing override needed in header.css: a bare <h2> already inherits
    // exactly the measured values (48px/600/-0.04em at >=1240px) from this
    // project's own base h1-h6/h2 rules in styles.css.
    const heading = createElement('h2', { className: 'mega-menu-heading' }, link?.textContent.trim());
    // The grid/centering must land on a container that is NOT also the
    // panel's own background box (measured: production's panel background
    // is full-bleed, only its content is gutter-inset) — give the flattened
    // content its own wrapper instead of making the heading fight the
    // content for a grid column too.
    const links = createElement('div', { className: 'mega-menu-links' });
    resolved.replaceWith(menu);
    links.append(resolved);
    menu.append(heading, links);
    decorateSubcategories(links);
  }
  if (!menu || !link) return;
  link.setAttribute('aria-expanded', 'false');
  // Real-browser measurement gap (2026-09-21 parity pass): production
  // pairs every trigger that actually opens a mega-menu with a small
  // rotating chevron. "Pricing" has no .mega-menu, so it never reaches this
  // line and correctly gets no chevron. Decorative only — aria-expanded on
  // `link` itself (above) is the real open/close signal for AT, so this is
  // aria-hidden rather than given its own label.
  link.append(createElement('span', { className: 'nav-chevron', 'aria-hidden': 'true' }));
  link.addEventListener('click', (e) => {
    if (!li.classList.contains('is-open')) e.preventDefault();
    toggleMenu(li);
  });
};

export const decorateNavSection = async (section) => {
  section.classList.add('main-nav-section');
  const navContent = section.querySelector('.default-content');
  const navList = section.querySelector('ul');
  if (!navList) return;
  navList.classList.add('main-nav-list');

  const nav = createElement('nav', {
    'aria-label': await getPlaceholder('headerNav', 'Main'),
  }, navList);
  navContent.append(nav);

  for (const navItem of section.querySelectorAll('nav > ul > li')) {
    decorateNavItem(navItem);
  }
};
