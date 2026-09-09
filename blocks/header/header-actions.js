import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { setColorScheme } from '../section-metadata/section-metadata.js';
import { trapFocus } from '../../scripts/utils/a11y.js';
import { createElement } from '../../scripts/utils/dom.js';
import {
  toggleMenu, handleEscape, closeMobileNav, setReleaseFocusTrap,
} from './header-nav.js';

const { locale } = getConfig();

const HEADER_PATH = '/system/fragments/nav/header';

// Shares one in-flight fetch across rapid clicks (Fix 3) instead of starting
// a new one per click, and re-checks for the menu after the await in case a
// concurrent click already built it while this one was pending.
const decorateLanguage = (btn) => {
  const section = btn.closest('.section');
  btn.setAttribute('aria-expanded', 'false');
  let pending = null;
  btn.addEventListener('click', async () => {
    let menu = section.querySelector('.language.menu');
    if (!menu) {
      const paths = [`${locale.prefix}${HEADER_PATH}/languages`, `${HEADER_PATH}/languages`];
      pending ??= loadFragmentWithFallback(paths);
      let fragment;
      try { fragment = await pending; } catch (ex) {
        pending = null;
        getConfig().log(ex, section);
        return;
      }
      pending = null;
      menu = section.querySelector('.language.menu');
      if (!menu) {
        menu = createElement('div', { className: 'language menu' }, fragment);
        section.append(createElement('div', { className: 'block-content' }, menu));
      }
    }
    toggleMenu(section);
    btn.setAttribute('aria-expanded', String(section.classList.contains('is-open')));
  });
};

const decorateScheme = (btn) => {
  btn.addEventListener('click', async () => {
    const { body } = document;

    let currPref;
    try { currPref = localStorage.getItem('color-scheme'); } catch { /* private browsing / quota */ }
    currPref ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-scheme' : 'light-scheme';

    const theme = currPref === 'dark-scheme' ? { add: 'light-scheme', remove: 'dark-scheme' } : { add: 'dark-scheme', remove: 'light-scheme' };

    body.classList.remove(theme.remove);
    body.classList.add(theme.add);
    try { localStorage.setItem('color-scheme', theme.add); } catch { /* private browsing / quota */ }
    const sections = document.querySelectorAll('.section');
    for (const section of sections) {
      setColorScheme(section);
    }
  });
};

const decorateNavToggle = (btn) => {
  btn.setAttribute('aria-label', 'Toggle navigation menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const header = document.body.querySelector('header');
    if (!header) return;
    const opening = !header.classList.contains('is-mobile-open');
    if (opening) {
      header.classList.add('is-mobile-open');
      btn.setAttribute('aria-expanded', 'true');
      setReleaseFocusTrap(trapFocus(header));
      document.addEventListener('keydown', handleEscape);
    } else {
      closeMobileNav();
    }
  });
};

const decorateAction = (header, pattern) => {
  const link = header.querySelector(`[href*="${pattern}"]`);
  if (!link) return;

  const icon = link.querySelector('.icon');
  const text = link.textContent;
  const btn = document.createElement('button');
  if (icon) btn.append(icon);
  if (text) {
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = text;
    btn.append(textSpan);
  }
  const wrapper = document.createElement('div');
  const iconClass = icon?.classList[1];
  wrapper.className = `action-wrapper ${iconClass ? iconClass.replace('icon-', '') : 'unknown'}`;
  wrapper.append(btn);
  link.parentElement.parentElement.replaceChild(wrapper, link.parentElement);

  const ariaLabels = {
    '/tools/widgets/language': 'Select language',
    '/tools/widgets/scheme': 'Toggle color scheme',
  };
  if (ariaLabels[pattern]) btn.setAttribute('aria-label', ariaLabels[pattern]);

  if (pattern === '/tools/widgets/language') decorateLanguage(btn);
  if (pattern === '/tools/widgets/scheme') decorateScheme(btn);
  if (pattern === '/tools/widgets/toggle') decorateNavToggle(btn);
};

export { decorateAction };

export const decorateActionSection = (section) => {
  section.classList.add('actions-section');
};
