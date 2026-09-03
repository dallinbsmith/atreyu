// Pothole: vanilla port of Falkor's Pothole module — a scroll-parallax
// background image behind bottom-aligned CTA content. `--progress` (0..1,
// from trackScrollProgress) drives the background's translateY in CSS; under
// reduced motion it stays at the resting (progress: 0) frame.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';

export default (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  const bgRow = rows[0]?.querySelector('picture') ? rows.shift() : null;
  const pic = bgRow?.querySelector('picture');
  if (pic) {
    const img = pic.querySelector('img');
    if (img) img.alt = '';
  }

  // Merge every remaining row's cells into one content container — a
  // second authored row is still content, not something to discard, so
  // this never silently drops text the way assuming exactly one row would.
  const content = document.createElement('div');
  content.className = 'pothole-content';
  rows.forEach((row) => content.append(...row.children));
  el.replaceChildren(content);

  if (pic) {
    const bg = document.createElement('div');
    bg.className = 'pothole-background';
    bg.setAttribute('aria-hidden', 'true');
    bg.append(pic);
    el.prepend(bg);
  }

  // Defer to an author-set variant (e.g. from decorateButton's **bold**/*italic*
  // convention) instead of overriding it with a positional class.
  [...content.querySelectorAll('a')].forEach((a, i) => {
    if (a.classList.contains('btn')) return;
    a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
  });
  decorateRichText(el);

  // Cleanup handle intentionally discarded: `el` lives for the page's full
  // lifetime (EDS is full-page-load, no client routing) — there's no removal
  // hook to call it from today.
  trackScrollProgress(el);
};
