import { getConfig, getMetadata } from '../../scripts/ak.js';
import { loadFragment } from '../fragment/fragment.js';
import { decorateNavSection } from './header-nav.js';
import { decorateAction, decorateActionSection } from './header-actions.js';

const { locale } = getConfig();

const HEADER_PATH = '/fragments/nav/header';
const HEADER_ACTIONS = [
  '/tools/widgets/scheme',
  '/tools/widgets/language',
  '/tools/widgets/toggle',
];

const decorateBrandSection = (section) => {
  section.classList.add('brand-section');
  const brandLink = section.querySelector('a');
  if (!brandLink) return;
  const children = [...brandLink.childNodes];
  const text = children.length > 1 ? children[1] : children[0];
  if (!text) return;
  const span = document.createElement('span');
  span.className = 'brand-text';
  span.append(text);
  brandLink.append(span);
};

const decorateHeaderContent = async (fragment) => {
  const sections = fragment.querySelectorAll(':scope > .section');
  if (sections[0]) decorateBrandSection(sections[0]);
  if (sections[1]) decorateNavSection(sections[1]);
  if (sections[2]) decorateActionSection(sections[2]);

  for (const pattern of HEADER_ACTIONS) {
    decorateAction(fragment, pattern);
  }
};

export default async (el) => {
  const headerMeta = getMetadata('header');
  const path = headerMeta || HEADER_PATH;
  const fragment = await loadFragment(`${locale.prefix}${path}`);
  fragment.classList.add('header-content');
  await decorateHeaderContent(fragment);
  el.append(fragment);
};
