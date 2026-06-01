import { getConfig } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';
import { setColorScheme } from '../section-metadata/section-metadata.js';
import { trapFocus } from '../../scripts/utils/a11y.js';
import {
  toggleMenu, handleEscape, closeMobileNav, setReleaseFocusTrap,
} from './header-nav.js';

const { locale } = getConfig();

const HEADER_PATH = '/fragments/nav/header';

const decorateLanguage = (btn) => {
  const section = btn.closest('.section');
  btn.addEventListener('click', async () => {
    let menu = section.querySelector('.language.menu');
    if (!menu) {
      const content = document.createElement('div');
      content.classList.add('block-content');
      const fragment = await loadFragment(`${locale.prefix}${HEADER_PATH}/languages`);
      menu = document.createElement('div');
      menu.className = 'language menu';
      menu.append(fragment);
      content.append(menu);
      section.append(content);
    }
    toggleMenu(section);
  });
};

const decorateScheme = (btn) => {
  btn.addEventListener('click', async () => {
    const { body } = document;

    let currPref = localStorage.getItem('color-scheme');
    currPref ??= matchMedia('(prefers-color-scheme: dark)')
      .matches ? 'dark-scheme' : 'light-scheme';

    const theme = currPref === 'dark-scheme'
      ? { add: 'light-scheme', remove: 'dark-scheme' }
      : { add: 'dark-scheme', remove: 'light-scheme' };

    body.classList.remove(theme.remove);
    body.classList.add(theme.add);
    localStorage.setItem('color-scheme', theme.add);
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

const decorateAction = async (header, pattern) => {
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

export const decorateActionSection = async (section) => {
  section.classList.add('actions-section');
};
