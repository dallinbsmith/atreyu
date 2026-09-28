// Pothole: scroll-parallax background behind CTA content. `--progress`
// (from trackScrollProgress) drives translateY in CSS; reduced motion
// stays at the resting frame. Variants are CSS-only: top, bottom (default),
// overflow, right-aligned, glow-{purple|blue|pink|green}. An optional
// trailing single-cell `scale: n` row (n a plain decimal number) sets
// --media-scale when finite and > 0.
//
// trackScrollProgress's cleanup handle is discarded: `el` lives for the
// page lifetime (EDS is full-page-load, no client routing).
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { createElement, getCells } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

// Unsigned-or-plus decimal only: no sign, hex, `1.`, `Infinity` or words,
// so prose like "Scale: from one editor to a thousand" stays content.
const META_RE = /^scale\s*:\s*\+?(\d*\.?\d+(?:e[+-]?\d+)?)$/i;

// Trailing single-cell `scale: n` only — never a bare "1.2". Needs a
// background + content row left after removal, so a 1- or 2-row block is
// never treated as meta. A syntactically numeric row that is not usable
// (`scale: 0`, `scale: 1e999`) is still removed but not applied: it is
// unambiguously an authoring directive, and publishing it as visible CTA
// copy would be worse than ignoring it. Only String(n) is written, never
// the raw text.
const applyMeta = (el) => {
  const last = el.lastElementChild;
  if (el.childElementCount < 3 || last.children.length !== 1) return;
  const [, raw] = last.textContent.trim().match(META_RE) ?? [];
  if (!raw) return;
  last.remove();
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) el.style.setProperty('--media-scale', String(n));
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

  for (const [i, a] of [...content.querySelectorAll('a')].entries()) {
    a.dataset.testid ||= `pothole-cta-${i === 0 ? 'primary' : 'secondary'}`;
    if (!a.classList.contains('btn')) a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
  }
  decorateRichText(el);
  trackScrollProgress(el);
};
