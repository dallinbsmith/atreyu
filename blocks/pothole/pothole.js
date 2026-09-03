// Pothole: vanilla port of Falkor's Pothole module — a scroll-parallax
// background image behind bottom-aligned CTA content. `--progress` (0..1,
// from trackScrollProgress) drives the background's translateY in CSS; under
// reduced motion it stays at the resting (progress: 0) frame.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';

export default (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  const content = rows.pop();
  content.classList.add('pothole-content');

  const pic = rows[0]?.querySelector('picture');
  if (pic) {
    const bg = document.createElement('div');
    bg.className = 'pothole-background';
    bg.setAttribute('aria-hidden', 'true');
    const img = pic.querySelector('img');
    if (img) img.alt = '';
    bg.append(pic);
    el.prepend(bg);
  }
  rows.forEach((row) => row.remove());

  [...content.querySelectorAll('a')].forEach((a, i) => {
    a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
  });
  decorateRichText(el);

  // Cleanup handle intentionally discarded: `el` lives for the page's full
  // lifetime (EDS is full-page-load, no client routing) — there's no removal
  // hook to call it from today.
  trackScrollProgress(el);
};
