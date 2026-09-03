// Pothole V4: richer sibling of pothole.js — same scroll-parallax background
// (`--progress` from trackScrollProgress), plus V4-only extras: an
// author-set glow-color variant, a numeric media-scale row, and layout/
// alignment variants (see blocks.md variant convention).
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';

const GLOW_COLORS = ['purple', 'blue', 'pink', 'green'];
const META_RE = /^(scale|glow)\s*:\s*(.+)$/i;

// A trailing single-cell "key: value" row is metadata, not content — explicit
// key prefixes (rather than sniffing bare text against a number/color-name
// pattern) so real heading/body copy is never misread as a scale or glow row.
// Requires a background + content row to remain even after removal, so a
// 1- or 2-row block is never mistaken for having a metadata row at all.
const extractMetaRow = (rows) => {
  if (rows.length < 3) return null;
  const last = rows.at(-1);
  const cells = [...last.children];
  if (cells.length !== 1) return null;
  const match = cells[0].textContent.trim().match(META_RE);
  if (!match) return null;
  rows.pop().remove();
  const [, key, value] = match;
  return { key: key.toLowerCase(), value: value.trim().toLowerCase() };
};

export default (el) => {
  const rows = [...el.querySelectorAll(':scope > div')];
  const meta = extractMetaRow(rows);
  if (meta?.key === 'scale') el.style.setProperty('--media-scale', meta.value);
  else if (meta?.key === 'glow' && GLOW_COLORS.includes(meta.value)) el.classList.add(`glow-${meta.value}`);

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
