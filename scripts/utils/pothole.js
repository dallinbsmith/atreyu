import { decorateRichText } from './richtext.js';
import { trackScrollProgress } from './motion/scroll.js';
import { createElement, getCells } from './dom.js';

// Shared layout for pothole.js and pothole-v4.js: background is whichever
// cell holds a picture (cell-level, not row-level — a mixed picture+text
// row must not sweep the text into the background). Callers own the
// idempotency guard so v4 can strip a metadata row first.
//
// trackScrollProgress's cleanup handle is discarded: `el` lives for the
// page lifetime (EDS is full-page-load, no client routing).
export const decoratePothole = (el, { testidPrefix }) => {
  const cells = getCells(el);
  const bgCell = cells.find((c) => c.querySelector('picture'));
  const pic = bgCell?.querySelector('picture');
  const img = pic?.querySelector('img');
  if (img) img.alt = '';

  const content = createElement('div', { className: 'pothole-content' });
  for (const cell of cells.filter((c) => c !== bgCell)) content.append(...cell.children);
  el.replaceChildren(content);

  if (pic) {
    el.prepend(createElement('div', {
      className: 'pothole-background', 'aria-hidden': 'true',
    }, pic));
  }

  [...content.querySelectorAll('a')].forEach((a, i) => {
    a.dataset.testid ||= `${testidPrefix}-cta-${i === 0 ? 'primary' : 'secondary'}`;
    if (a.classList.contains('btn')) return;
    a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
  });
  decorateRichText(el);
  trackScrollProgress(el);
};
