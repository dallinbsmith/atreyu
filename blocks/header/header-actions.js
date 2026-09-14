import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { setColorScheme } from '../section-metadata/section-metadata.js';
import { createElement } from '../../scripts/utils/dom.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { toggleMenu, openMobileNav, closeMobileNav } from './header-nav.js';

export const HEADER_PATH = '/system/fragments/nav/header';

const WIDGETS = [
  { href: '/tools/widgets/language', key: 'headerLanguage', label: 'Select language' },
  { href: '/tools/widgets/scheme', key: 'headerScheme', label: 'Toggle color scheme' },
  { href: '/tools/widgets/toggle', key: 'headerNavToggle', label: 'Toggle navigation menu' },
];

export const isWidgetLink = (a) => WIDGETS.some(({ href }) => a.getAttribute('href')?.includes(href));

const decorateLanguage = (btn) => {
  btn.setAttribute('aria-expanded', 'false');
  let pending = null;
  btn.addEventListener('click', async () => {
    const section = btn.closest('.section');
    if (!section) return;
    let menu = section.querySelector('.language.menu');
    if (!menu) {
      const { locale } = getConfig();
      pending ??= loadFragmentWithFallback([
        `${locale.prefix}${HEADER_PATH}/languages`,
        `${HEADER_PATH}/languages`,
      ]);
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
  });
};

const decorateScheme = (btn) => {
  btn.addEventListener('click', () => {
    const { body } = document;
    let currPref;
    try { currPref = localStorage.getItem('color-scheme'); } catch { /* private browsing / quota */ }
    currPref ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-scheme' : 'light-scheme';
    const theme = currPref === 'dark-scheme'
      ? { add: 'light-scheme', remove: 'dark-scheme' }
      : { add: 'dark-scheme', remove: 'light-scheme' };
    body.classList.remove(theme.remove);
    body.classList.add(theme.add);
    try { localStorage.setItem('color-scheme', theme.add); } catch { /* private browsing / quota */ }
    for (const section of document.querySelectorAll('.section')) setColorScheme(section);
  });
};

const decorateNavToggle = (btn) => {
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const header = btn.closest('header');
    if (!header) return;
    const close = header.classList.contains('is-mobile-open');
    (close ? closeMobileNav : openMobileNav)(header);
  });
};

const DECORATE = {
  '/tools/widgets/language': decorateLanguage,
  '/tools/widgets/scheme': decorateScheme,
  '/tools/widgets/toggle': decorateNavToggle,
};

export const decorateWidgets = async (root) => {
  const found = WIDGETS
    .map((spec) => ({ spec, link: root.querySelector(`[href*="${spec.href}"]`) }))
    .filter(({ link }) => link);
  for (const { spec, link } of found) {
    const kind = spec.href.slice(spec.href.lastIndexOf('/') + 1);
    const text = link.textContent.trim();
    const btn = createElement(
      'button',
      { 'aria-label': await getPlaceholder(spec.key, spec.label) },
      link.querySelector('.icon'),
      text && createElement('span', { className: 'text' }, text),
    );
    link.parentElement.replaceWith(createElement('div', { className: `action-wrapper ${kind}` }, btn));
    DECORATE[spec.href](btn);
  }
};
