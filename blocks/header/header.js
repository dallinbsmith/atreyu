import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { createElement } from '../../scripts/utils/dom.js';
import { decorateNavSection } from './header-nav.js';
import { HEADER_PATH, decorateWidgets, isWidgetLink } from './header-actions.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

const contentLinks = (section) => [...section.querySelectorAll('a')].filter((a) => !isWidgetLink(a));

const decorateBrandSection = (section) => {
  section.classList.add('brand-section');
  const brandLink = contentLinks(section)[0];
  if (!brandLink) return;
  const text = [...brandLink.childNodes]
    .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (!text) return;
  brandLink.append(createElement('span', { className: 'brand-text' }, text));
};

// Classify by content shape, never position — see side-by-side.js/footer.js.
// Widget-marker links (`/tools/widgets/{scheme,language,toggle}`) don't count
// as content: nav = the section with the main nav <ul>; brand = the remaining
// section with exactly one real link (the logo, even if a hamburger marker
// sits next to it); actions = whatever's left. The last real actions link is
// the primary CTA — widgets after that CTA must not steal the stamp.
const decorateHeaderContent = async (fragment) => {
  const sections = [...fragment.querySelectorAll(':scope > .section')];
  const navSection = sections.find((s) => s.querySelector('ul'));
  const brandSection = sections.find((s) => s !== navSection && contentLinks(s).length === 1);
  const actionsSection = sections.find((s) => s !== navSection && s !== brandSection);

  if (brandSection) decorateBrandSection(brandSection);
  if (navSection) await decorateNavSection(navSection);
  if (actionsSection) {
    actionsSection.classList.add('actions-section');
    contentLinks(actionsSection).at(-1)?.classList.add('action-primary');
  }

  await decorateWidgets(fragment);
  const toggle = fragment.querySelector('.action-wrapper.toggle');
  if (toggle) brandSection?.querySelector('.default-content')?.append(toggle);
};

export default async (el) => {
  if (!guardDecorate(el, 'headerDecorated')) return;

  const { locale } = getConfig();
  const fragment = await loadFragmentWithFallback([`${locale.prefix}${HEADER_PATH}`, HEADER_PATH]);
  fragment.classList.add('header-content');
  await decorateHeaderContent(fragment);
  el.append(fragment);
};
