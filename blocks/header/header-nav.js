let releaseFocusTrap;
// docClose/handleEscape and closeAllMenus/closeMobileNav each reference the
// other (close* tears down the listeners docClose/handleEscape were added
// as; docClose/handleEscape call close* to actually close things). docClose
// is never exported, so a plain forward-declared `let` (assigned further
// down, same shape as releaseFocusTrap above) is enough. handleEscape IS
// exported and must keep one stable identity for add/removeEventListener,
// so the mutable implementation stays private (handleEscapeImpl) behind a
// const wrapper — exporting the `let` directly would trip
// import/no-mutable-exports.
let docClose;
let handleEscapeImpl;

export const setReleaseFocusTrap = (fn) => { releaseFocusTrap = fn; };

export const handleEscape = (e) => handleEscapeImpl(e);

// Every path that closes a menu/mega-menu (closeAllMenus, called by
// toggleMenu/docClose/handleEscape) and every path that closes the mobile
// nav (closeMobileNav, called by docClose/handleEscape/the mobile toggle
// button in header-actions.js) tears down the same two document-level
// listeners here, centrally — removeEventListener is a no-op if the
// listener isn't currently attached, so calling it from both places when
// both run back-to-back (docClose/handleEscape call both) is harmless.
export const closeAllMenus = () => {
  const openMenus = document.body.querySelectorAll('header .is-open');
  for (const openMenu of openMenus) {
    openMenu.classList.remove('is-open');
    const trigger = openMenu.querySelector('[aria-expanded]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  document.removeEventListener('click', docClose);
  document.removeEventListener('keydown', handleEscape);
};

export const closeMobileNav = () => {
  const header = document.body.querySelector('header');
  if (!header) return;
  const wasOpen = header.classList.contains('is-mobile-open');
  header.classList.remove('is-mobile-open');
  if (wasOpen) {
    releaseFocusTrap?.();
    releaseFocusTrap = null;
    const toggle = header.querySelector('.action-wrapper.toggle button');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', docClose);
    document.removeEventListener('keydown', handleEscape);
  }
};

docClose = (e) => {
  if (e.target.closest('header')) return;
  closeAllMenus();
  closeMobileNav();
};

handleEscapeImpl = (e) => {
  if (e.key !== 'Escape') return;
  closeAllMenus();
  closeMobileNav();
};

export const toggleMenu = (menu) => {
  const isOpen = menu.classList.contains('is-open');
  closeAllMenus();
  if (isOpen) return;

  document.addEventListener('click', docClose);
  document.addEventListener('keydown', handleEscape);
  menu.classList.add('is-open');
};

const decorateMegaMenu = (li) => {
  const menu = li.querySelector('.fragment-content');
  if (!menu) return null;
  const wrapper = document.createElement('div');
  wrapper.className = 'mega-menu';
  wrapper.append(menu);
  li.append(wrapper);
  return wrapper;
};

const decorateNavItem = (li) => {
  li.classList.add('main-nav-item');
  const link = li.querySelector(':scope > p > a');
  if (link) link.classList.add('main-nav-link');
  const menu = decorateMegaMenu(li);
  if (!menu || !link) return;
  link.setAttribute('aria-expanded', 'false');
  link.addEventListener('click', (e) => {
    const wasOpen = li.classList.contains('is-open');
    if (!wasOpen) e.preventDefault();
    toggleMenu(li);
    link.setAttribute('aria-expanded', String(li.classList.contains('is-open')));
  });
};

export const decorateNavSection = (section) => {
  section.classList.add('main-nav-section');
  const navContent = section.querySelector('.default-content');
  const navList = section.querySelector('ul');
  if (!navList) return;
  navList.classList.add('main-nav-list');

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main');
  nav.append(navList);
  navContent.append(nav);

  const mainNavItems = section.querySelectorAll('nav > ul > li');
  for (const navItem of mainNavItems) {
    decorateNavItem(navItem);
  }
};
