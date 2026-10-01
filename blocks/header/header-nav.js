import { createElement } from '../../scripts/utils/dom.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { decorateSubcategories } from './header-subcategories.js';
import { toggleMenu } from './header-menu-state.js';

// Not re-entrant: assumes fresh undecorated markup; header.js's
// guardDecorate keeps decoration to one call.
const decorateNavItem = (li) => {
  li.classList.add('main-nav-item');
  const link = li.querySelector(':scope > p > a');
  link?.classList.add('main-nav-link');
  // Classify the mega-menu by content shape, not `.fragment-content`:
  // fragment.js unwraps single-section fragments and drops that class.
  const linkPara = link?.parentElement;
  const resolved = [...li.children].find((child) => child !== linkPara);
  // Never toggle display on the `.section` element: `@layer sections`
  // loads after `@layer blocks`, so its `display: block` wins. Wrap it.
  const menu = resolved && createElement('div', { className: 'mega-menu' });
  if (menu) {
    // Heading mirrors the trigger label to match production; it inherits h2
    // base styles, so no overrides are needed.
    const heading = createElement('h2', { className: 'mega-menu-heading' }, link?.textContent.trim());
    // Grid goes on an inner wrapper: the panel background is full-bleed,
    // only its content is gutter-inset.
    const links = createElement('div', { className: 'mega-menu-links' });
    resolved.replaceWith(menu);
    links.append(resolved);
    menu.append(heading, links);
    decorateSubcategories(links);
  }
  if (!menu || !link) return;
  link.setAttribute('aria-expanded', 'false');
  // The chevron is decorative; aria-expanded on the trigger is the AT
  // open/close signal, and links without a menu get no chevron.
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
    'aria-label': await getPlaceholder('nav.main', 'Main'),
  }, navList);
  navContent.append(nav);

  for (const navItem of section.querySelectorAll('nav > ul > li')) {
    decorateNavItem(navItem);
  }
};
