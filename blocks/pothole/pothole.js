// Pothole: vanilla port of Falkor's Pothole module — a scroll-parallax
// background image behind bottom-aligned CTA content. `--progress` (0..1,
// from trackScrollProgress) drives the background's translateY in CSS; under
// reduced motion it stays at the resting (progress: 0) frame.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { createElement } from '../../scripts/utils/dom.js';

export default (el) => {
  // Idempotency guard — checked before any DOM restructuring below. A second
  // decorate() call (e.g. DA's live-preview reload path) would otherwise
  // re-find the same cells and register a second scroll-progress observer
  // that never gets cleaned up (see the discarded cleanup handle below).
  if (el.dataset.pothole) return;
  el.dataset.pothole = 'true';

  // Cell meaning is classified by content shape, never by position — the
  // background cell is whichever cell (if any) holds a picture. Classifying
  // at the CELL level (not the whole row) matters because a row can hold
  // more than one column: a row that mixes a picture cell with a sibling
  // text cell must not sweep the text cell into the background along with
  // the picture (see hero.js's identical cells/bgCell/contentCells pattern).
  const cells = [...el.querySelectorAll(':scope > div > div')];
  const bgCell = cells.find((c) => c.querySelector('picture'));
  const pic = bgCell?.querySelector('picture');
  if (pic) {
    const img = pic.querySelector('img');
    if (img) img.alt = '';
  }

  const content = createElement('div', { className: 'pothole-content' });
  cells.filter((c) => c !== bgCell).forEach((cell) => content.append(...cell.children));
  el.replaceChildren(content);

  if (pic) {
    const bg = createElement('div', { className: 'pothole-background', 'aria-hidden': 'true' });
    bg.append(pic);
    el.prepend(bg);
  }

  // Defer to an author-set variant (e.g. from decorateButton's **bold**/*italic*
  // convention) instead of overriding it with a positional class.
  [...content.querySelectorAll('a')].forEach((a, i) => {
    a.dataset.testid ||= `pothole-cta-${i === 0 ? 'primary' : 'secondary'}`;
    if (a.classList.contains('btn')) return;
    a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
  });
  decorateRichText(el);

  // Cleanup handle intentionally discarded: `el` lives for the page's full
  // lifetime (EDS is full-page-load, no client routing) — there's no removal
  // hook to call it from today.
  trackScrollProgress(el);
};
