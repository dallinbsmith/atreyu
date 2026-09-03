// Pothole V4: richer sibling of pothole.js — same scroll-parallax background
// (`--progress` from trackScrollProgress), plus V4-only extras: an
// author-set glow-color variant, a numeric media-scale row, and layout/
// alignment variants (see blocks.md variant convention).
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';

const GLOW_COLORS = ['purple', 'blue', 'pink', 'green'];
const SCALE_RE = /^\d+(\.\d+)?$/;

// A trailing single-cell row is metadata, not content: a bare number sets the
// background media's zoom, a bare glow-color name sets the glow tint.
const extractMetaRow = (rows) => {
  const last = rows.at(-1);
  const cells = last ? [...last.children] : [];
  if (cells.length !== 1) return null;
  const text = cells[0].textContent.trim().toLowerCase();
  if (SCALE_RE.test(text) || GLOW_COLORS.includes(text)) {
    rows.pop().remove();
    return text;
  }
  return null;
};

export default (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  const meta = extractMetaRow(rows);
  if (meta && SCALE_RE.test(meta)) el.style.setProperty('--media-scale', meta);
  else if (meta) el.classList.add(`glow-${meta}`);

  const content = rows.pop();
  content.classList.add('pothole-content');

  const pic = rows[0]?.querySelector('picture, video');
  if (pic) {
    const bg = document.createElement('div');
    bg.className = 'pothole-background';
    bg.setAttribute('aria-hidden', 'true');
    const img = pic.querySelector?.('img');
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
