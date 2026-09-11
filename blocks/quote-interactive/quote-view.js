import { createElement } from '../../scripts/utils/dom.js';

// Panel + modal-slide are two different visual designs of the SAME slide
// data — the panel is the mobile-visible tab-panel (has an icon logo, no
// eyebrow, scrim via CSS ::after); the modal-slide is the desktop click-
// through view (has an eyebrow, no icon, explicit scrim element). Kept in
// one file because they share one data shape and the divergence is the
// entire point — inlining a shared "buildCard" helper past the ~3 shared
// lines here would obscure how they differ.

// Every consumer of `slide` clones the cell wrappers again at render time;
// `slide.quote`/`slide.attr` are the authoritative source of truth and must
// never be mutated.
const cellChildren = (cell) => (cell ? [...cell.cloneNode(true).childNodes] : []);

export const buildPanel = (slide, tabId, panelId) => {
  const panel = createElement('figure', {
    className: 'qi-panel', id: panelId, role: 'tabpanel', 'aria-labelledby': tabId, tabindex: '0',
  });
  if (slide.pic) panel.append(createElement('div', { className: 'qi-bg', 'aria-hidden': 'true' }, slide.pic.cloneNode(true)));
  if (slide.quote) panel.append(createElement('blockquote', null, ...cellChildren(slide.quote)));
  if (slide.attr) panel.append(createElement('figcaption', null, ...cellChildren(slide.attr)));
  if (slide.icon) panel.append(createElement('div', { className: 'qi-logo', 'aria-hidden': 'true' }, slide.icon.cloneNode(true)));
  return panel;
};

export const buildModalSlide = (slide) => {
  const bg = createElement(
    'div',
    { className: 'qi-modal-slide-bg' },
    slide.pic?.cloneNode(true),
    createElement('div', { className: 'qi-modal-scrim' }),
  );
  const bq = createElement('blockquote', { className: 'qi-modal-quote' }, ...cellChildren(slide.quote));
  const fc = createElement('figcaption', { className: 'qi-modal-attr' }, ...cellChildren(slide.attr));
  const body = createElement('div', { className: 'qi-modal-slide-body' }, bq, fc);
  const eye = createElement('span', { className: 'qi-modal-eyebrow' }, slide.category);
  return createElement('div', { className: 'qi-modal-slide' }, bg, eye, body);
};
