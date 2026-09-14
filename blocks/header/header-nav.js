import { trapFocus } from '../../scripts/utils/a11y.js';
import { createElement } from '../../scripts/utils/dom.js';
import { listenGroup } from '../../scripts/utils/listen.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';

const traps = new WeakMap();
let docGroup;
let syncDoc;

export const closeAllMenus = (header) => {
  const root = header ?? document.querySelector('header');
  if (!root) return;
  for (const menu of root.querySelectorAll('.is-open')) {
    menu.classList.remove('is-open');
    menu.querySelector('[aria-expanded="true"]')?.setAttribute('aria-expanded', 'false');
  }
  syncDoc(root);
};

export const closeMobileNav = (header = document.querySelector('header')) => {
  if (!header?.classList.contains('is-mobile-open')) return;
  header.classList.remove('is-mobile-open');
  traps.get(header)?.();
  traps.delete(header);
  header.querySelector('.action-wrapper.toggle button')?.setAttribute('aria-expanded', 'false');
  syncDoc(header);
};

export const openMobileNav = (header) => {
  header.classList.add('is-mobile-open');
  header.querySelector('.action-wrapper.toggle button')?.setAttribute('aria-expanded', 'true');
  traps.set(header, trapFocus(header));
  syncDoc(header);
};

export const toggleMenu = (menu) => {
  const header = menu.closest('header');
  const isOpen = menu.classList.contains('is-open');
  closeAllMenus(header);
  if (isOpen) return;
  menu.classList.add('is-open');
  menu.querySelector('[aria-expanded]')?.setAttribute('aria-expanded', 'true');
  syncDoc(header);
};

// Click-outside is only for dropdowns; Escape is for dropdowns *or* mobile
// nav. Closing one must not drop the listener the other still needs — sync
// from current DOM rather than pairing add/remove in each close path.
syncDoc = (header) => {
  docGroup?.end();
  docGroup = null;
  const menuOpen = header?.querySelector('.is-open');
  const mobileOpen = header?.classList.contains('is-mobile-open');
  if (!menuOpen && !mobileOpen) return;
  docGroup = listenGroup();
  if (menuOpen) {
    docGroup.listen(document, 'click', (e) => {
      if (header.contains(e.target)) return;
      closeAllMenus(header);
      closeMobileNav(header);
    });
  }
  docGroup.listen(document, 'keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (header.querySelector('.is-open')) closeAllMenus(header);
    else closeMobileNav(header);
  });
};

const decorateNavItem = (li) => {
  li.classList.add('main-nav-item');
  const link = li.querySelector(':scope > p > a');
  link?.classList.add('main-nav-link');
  const menu = li.querySelector('.fragment-content');
  menu?.classList.add('mega-menu');
  if (!menu || !link) return;
  link.setAttribute('aria-expanded', 'false');
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
