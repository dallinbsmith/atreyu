// Pothole: scroll-parallax background behind CTA content. `--progress`
// (from trackScrollProgress) drives translateY in CSS; reduced motion
// stays at the resting frame. Layout variants (top, bottom, overflow,
// right-aligned, glow-{color}) are CSS-only; an optional trailing
// `key: value` row sets `scale: n` / `glow: color` without a variant.
//
// trackScrollProgress's cleanup handle is discarded: `el` lives for the
// page lifetime (EDS is full-page-load, no client routing).
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { createElement, getCells } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

const GLOW_COLORS = new Set(['purple', 'blue', 'pink', 'green']);
const META_RE = /^(scale|glow)\s*:\s*(.+)$/i;

const apply = {
  scale: (el, value) => el.style.setProperty('--media-scale', value),
  glow: (el, value) => GLOW_COLORS.has(value) && el.classList.add(`glow-${value}`),
};

// Trailing single-cell `key: value` only — never a bare "1.2"/"purple", so
// real copy is not misread as metadata. Needs a background + content row
// left after removal, so a 1- or 2-row block is never treated as meta.
const applyMeta = (el) => {
  const last = el.lastElementChild;
  if (el.childElementCount < 3 || last.children.length !== 1) return;
  const [, key, value] = last.textContent.trim().match(META_RE) ?? [];
  if (!key) return;
  last.remove();
  apply[key.toLowerCase()]?.(el, value.trim().toLowerCase());
};

export default (el) => {
  if (!guardDecorate(el, 'pothole')) return;
  applyMeta(el);

  // Background is whichever cell holds a picture (cell-level, not
  // row-level — a mixed picture+text row must not sweep the text away).
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
    a.dataset.testid ||= `pothole-cta-${i === 0 ? 'primary' : 'secondary'}`;
    if (a.classList.contains('btn')) return;
    a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
  });
  decorateRichText(el);
  trackScrollProgress(el);
};
