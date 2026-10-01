import { loadFragmentWithFallback } from '../../scripts/utils/fragment.js';
import { createElement } from '../../scripts/utils/dom.js';
import { decorateNavSection } from './header-nav.js';
import { HEADER_PATH, decorateWidgets, isWidgetLink } from './header-actions.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

const contentLinks = (section) => [...section.querySelectorAll('a')].filter((a) => !isWidgetLink(a));

// CTA selection is order-independent: authors may prefix any action link
// with `cta:`; without that prefix the existing last-link fallback remains.
// Match only direct text nodes, mirroring form.js's `submit:` convention.
const CTA_PREFIX = /^\s*cta:\s*/i;

const findCtaTextNode = (links) => links
  .flatMap((link) => [...link.childNodes].map((node) => ({ link, node })))
  .find(({ node }) => node.nodeType === Node.TEXT_NODE && CTA_PREFIX.test(node.textContent));

const decorateActionsSection = (section) => {
  section.classList.add('actions-section');
  const links = contentLinks(section);
  const match = findCtaTextNode(links);

  if (match) {
    match.node.textContent = match.node.textContent.replace(CTA_PREFIX, '');
    match.link.classList.add('action-primary');
    return;
  }

  links.at(-1)?.classList.add('action-primary');
};

const decorateBrandSection = (section) => {
  section.classList.add('brand-section');
  const brandLink = contentLinks(section)[0];
  if (!brandLink) return;
  const text = [...brandLink.childNodes]
    .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (!text) return;
  brandLink.append(createElement('span', { className: 'brand-text' }, text));
};

// Classify sections by content shape, never position. Widget-marker links
// do not count as content, so language/theme/toggle controls cannot steal
// brand/nav/action roles.
const decorateHeaderContent = async (fragment) => {
  const sections = [...fragment.querySelectorAll(':scope > .section')];
  const navSection = sections.find((s) => s.querySelector('ul'));
  const brandSection = sections.find((s) => s !== navSection && contentLinks(s).length === 1);
  const actionsSection = sections.find((s) => s !== navSection && s !== brandSection);

  if (brandSection) decorateBrandSection(brandSection);
  if (navSection) await decorateNavSection(navSection);
  if (actionsSection) decorateActionsSection(actionsSection);

  await decorateWidgets(fragment);
  const toggle = fragment.querySelector('.action-wrapper.toggle');
  if (toggle) brandSection?.querySelector('.default-content')?.append(toggle);
};

export default async (el) => {
  if (!guardDecorate(el, 'headerDecorated')) return;

  const fragment = await loadFragmentWithFallback(HEADER_PATH);
  fragment.classList.add('header-content');
  await decorateHeaderContent(fragment);
  el.append(fragment);
};
