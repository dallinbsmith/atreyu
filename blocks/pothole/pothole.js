// Pothole: vanilla port of Falkor's Pothole module — a scroll-parallax
// background image behind bottom-aligned CTA content. `--progress` (0..1,
// from trackScrollProgress) drives the background's translateY in CSS; under
// reduced motion it stays at the resting (progress: 0) frame.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { createElement } from '../../scripts/utils/dom.js';

export default (el) => {
  // Row meaning is classified by content shape, never by position — the
  // background row is whichever row (if any) holds a picture, and every
  // other row is content, merged in rather than assumed-single.
  const rows = [...el.querySelectorAll(':scope > div')];
  const bgRow = rows.find((r) => r.querySelector('picture'));
  const pic = bgRow?.querySelector('picture');
  if (pic) {
    const img = pic.querySelector('img');
    if (img) img.alt = '';
  }

  const content = createElement('div', { className: 'pothole-content' });
  rows.filter((r) => r !== bgRow).forEach((row) => content.append(...row.children));
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
