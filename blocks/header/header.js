import { getConfig } from '../../scripts/ak.js';
import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { decorateNavSection } from './header-nav.js';
import { decorateAction, decorateActionSection } from './header-actions.js';

const { locale } = getConfig();

const HEADER_PATH = '/system/fragments/nav/header';
const HEADER_ACTIONS = [
  '/tools/widgets/scheme',
  '/tools/widgets/language',
  '/tools/widgets/toggle',
];

const decorateBrandSection = (section) => {
  section.classList.add('brand-section');
  const brandLink = section.querySelector('a');
  if (!brandLink) return;
  const text = [...brandLink.childNodes]
    .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (!text) return;
  const span = document.createElement('span');
  span.className = 'brand-text';
  span.append(text);
  brandLink.append(span);
};

// Classify by content shape, never position — see side-by-side.js/footer.js.
// nav = the section with the main nav <ul>; brand = the remaining section
// with exactly one link (the logo); actions = whatever's left.
const decorateHeaderContent = async (fragment) => {
  const sections = [...fragment.querySelectorAll(':scope > .section')];
  const navSection = sections.find((s) => s.querySelector('ul'));
  const brandSection = sections
    .find((s) => s !== navSection && s.querySelectorAll('a').length === 1);
  const actionsSection = sections.find((s) => s !== navSection && s !== brandSection);

  if (brandSection) decorateBrandSection(brandSection);
  if (navSection) decorateNavSection(navSection);
  if (actionsSection) {
    decorateActionSection(actionsSection);
    // Classify once here rather than let CSS re-derive "which link is the
    // primary CTA" via a positional p:last-child selector — see scripts.md's
    // "Identifying Elements" rule.
    actionsSection.querySelector(':scope > .default-content > p:last-child a')
      ?.classList.add('action-primary');
  }

  for (const pattern of HEADER_ACTIONS) {
    decorateAction(fragment, pattern);
  }
};

export default async (el) => {
  if (el.dataset.headerDecorated) return;
  el.dataset.headerDecorated = 'true';

  const fragment = await loadFragmentWithFallback([`${locale.prefix}${HEADER_PATH}`, HEADER_PATH]);
  fragment.classList.add('header-content');
  await decorateHeaderContent(fragment);
  el.append(fragment);
};
