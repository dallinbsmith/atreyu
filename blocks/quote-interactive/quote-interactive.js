import { generateId, rovingTabindex, activateTab } from '../../scripts/utils/a11y.js';
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { MQ_MD } from '../../scripts/utils/breakpoints.js';
import { buildPanel } from './quote-view.js';
import { initHover } from './quote-hover.js';
import { initModal } from './quote-modal.js';

// One row → one slide. Pic and icon are located by selector (author-flexible:
// they may live in any cell); the remaining cells hold `category | quote |
// attribution` positionally. Cloned once here so `slides` is the authoritative
// data source — every consumer (panel, modal-slide, hover card) clones again
// at render time and never mutates the canonical copy.
const extractSlide = (row, i) => {
  const img = row.querySelector('picture, img');
  const pic = img?.closest('picture') ?? img;
  const icon = row.querySelector('.icon');
  // Whatever cells are left, in DOM order, are the positional
  // `category | quote | attribution` triple.
  const [cat, quote, attr] = [...row.children].filter(
    (c) => !c.contains(pic) && !c.contains(icon),
  );
  const clone = (el) => el?.cloneNode(true) ?? null;
  return {
    category: cat?.textContent.trim() || `Quote ${i + 1}`,
    quote: clone(quote),
    attr: clone(attr),
    pic: clone(pic),
    icon: clone(icon),
  };
};

// Decorative-only text list of category names — the tablist is the accessible
// source of truth for those same labels, so this is aria-hidden to avoid
// double-announcing categories to screen readers.
const buildGradient = (slides) => createElement('div', {
  className: 'qi-gradient', 'aria-hidden': 'true',
}, ...slides.flatMap(({ category }, i) => (
  i ? [document.createElement('br'), category] : [category]
)));

const buildView = (slides, ariaLabel) => {
  const tablist = createElement('div', { className: 'qi-tabs', role: 'tablist', 'aria-label': ariaLabel });
  const stage = createElement('div', { className: 'qi-stage' });
  const tabs = slides.map((slide) => {
    const tabId = generateId('qi-tab');
    const panelId = generateId('qi-panel');
    const tab = createElement('button', {
      type: 'button', className: 'qi-tab', id: tabId, role: 'tab', 'aria-controls': panelId,
    }, slide.category);
    tablist.append(tab);
    stage.append(buildPanel(slide, tabId, panelId));
    return tab;
  });
  const tabWrap = createElement('div', { className: 'qi-tab-wrap' }, tablist, buildGradient(slides));
  return { tabWrap, stage, tablist, tabs };
};

// Mount the rebuilt view, then wire one click path for both widths.
// Mobile: activateTab shows the matching panel (real tablist UX).
// Desktop: panels are display:none and openModal(i) is the actual UX —
// activateTab still runs so aria-selected stays consistent at both
// widths, and screen-reader semantics are the same everywhere.
const wire = (el, { tabWrap, stage, tablist, tabs }, slides) => {
  el.replaceChildren(el.firstElementChild, tabWrap, stage);
  decorateRichText(el);
  const mql = window.matchMedia(MQ_MD);
  initHover(el, tabs, slides, mql);
  const openModal = initModal(tabs, slides);
  tabs.forEach((tab, i) => tab.addEventListener('click', () => {
    activateTab(tabs, stage.children, i);
    if (mql.matches) openModal(i);
  }));
  activateTab(tabs, stage.children, 0);
  rovingTabindex(tablist, tabs, { orientation: 'horizontal' });
};

export default (el) => {
  if (el.dataset.qi) return;
  el.dataset.qi = 'true';
  const [head, ...rows] = el.children;
  head?.classList.add('qi-head');
  if (!rows.length) return;
  const slides = rows.map(extractSlide);
  const headingText = head?.querySelector(HEADING_SELECTOR)?.textContent.trim();
  wire(el, buildView(slides, headingText || 'Customer quotes by industry'), slides);
};
