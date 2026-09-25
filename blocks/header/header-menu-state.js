import { trapFocus } from '../../scripts/utils/a11y.js';
import { listenGroup } from '../../scripts/utils/listen.js';

// Split out of header-nav.js (2026-09-21) by concern: header-nav.js
// decorates authored nav content, this file owns the self-contained
// mega-menu/mobile-nav open/close state machine. It has no dependency on
// decorateNavItem/decorateNavSection (which stayed in header-nav.js), so the
// two files only ever depend one direction —
// header-nav.js imports toggleMenu from here, this file imports nothing back.
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
