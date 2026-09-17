import { createElement } from '../../scripts/utils/dom.js';
import { decorateTout } from '../../scripts/utils/touts.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

// Ported from Falkor's StickyBackground (organisms/modules/StickyBackground).
// Authoring: the FIRST row is the pinned media (an image, or a picture wrapped
// in a link to an .mp4 -> looping muted background video). Every remaining row
// is a section that scrolls past the pinned media. A section row is classified
// by content SHAPE, not index: a multi-cell row is a touts group (one tout per
// cell); a single-cell row is a text lockup (heading + body + CTA). Both go
// through the shared decorateTout(), so the real semantic heading and the real
// anchor CTA survive in BOTH the animating and the resting branch. The pin
// itself is pure CSS position:sticky (see .css) — JS only emits an enter/leave
// fade var. Falkor's WebGL Glow is approximated with a CSS radial gradient, and
// its per-frame first/last-section height measurement is replaced by CSS
// centering (place-items) to avoid layout-thrashing JS reads.
const THRESHOLD = 0.3;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

// Faithful vanilla port of Falkor's gsap pipe(normalize, clamp) enter/leave
// transform: 1 while the block is entering (progress 0..THRESHOLD) or leaving
// (1-THRESHOLD..1), 0 while it is centered. Drives the media fade in CSS.
const edgeProgress = (p) => Math.max(
  1 - clamp01(p / THRESHOLD),
  clamp01((p - (1 - THRESHOLD)) / THRESHOLD),
);

const buildMedia = (row) => {
  const pic = row.querySelector('picture');
  if (!pic) return null;
  const img = pic.querySelector('img');
  if (img) img.alt = ''; // pinned media is decorative; the heading + CTA carry the meaning
  const frame = createElement('div', { className: 'sbg-media-frame' }, pic.closest('a') ?? pic);
  const glow = createElement('div', { className: 'sbg-glow', 'aria-hidden': 'true' });
  // WCAG 2.2.2 pause control and the reduced-motion static-poster fallback both
  // live inside decorateVideoMedia; no per-block visibility observer is hand-rolled.
  decorateVideoMedia(frame);
  return createElement('div', { className: 'sbg-media' }, glow, frame);
};

const buildSection = (row, s) => {
  const cells = [...row.children];
  if (!cells.length) return null; // empty authored row: no blank 100vh section
  const section = createElement('div', { className: 'sbg-section' });
  if (cells.length > 1) {
    // Multi-cell row = touts group (one tout per cell). The testid carries BOTH
    // the section index and the cell index so every CTA data-testid is globally
    // unique across every section (per-index-only resets per row) — data-testid
    // is the project's analytics + test-automation key. Mirrors bentos.js.
    section.classList.add('sbg-section-touts');
    cells.forEach((cell, i) => decorateTout(cell, 'sbg-tout', `sbg-tout-${s}-${i}`));
    section.append(...cells);
  } else {
    // Single-cell row = text lockup. Multiple scrolling lockups over the pinned
    // media is the primary shape, so the section index disambiguates them too.
    section.classList.add('sbg-section-text');
    decorateTout(cells[0], 'sbg-lockup', `sbg-lockup-${s}`);
    section.append(cells[0]);
  }
  return section;
};

export default (el) => {
  const [mediaRow, ...sectionRows] = [...el.children];
  // Check content BEFORE marking decorated, so a media-only block a later
  // Quick-Edit fills in with sections can still re-decorate.
  if (!mediaRow || !sectionRows.length) return;
  if (!guardDecorate(el, 'stickyBackground')) return;
  // createElement drops the null children that buildSection returns for empty rows.
  const sections = createElement('div', { className: 'sbg-sections' }, ...sectionRows.map((row, s) => buildSection(row, s)));
  const inner = createElement('div', { className: 'sbg-inner' }, buildMedia(mediaRow), sections);
  el.replaceChildren(inner);
  // trackScrollProgress is a no-op under !shouldAnimate() (reduced motion /
  // save-data / low-power): no progress-driven JS motion runs, --sbg-edge stays
  // unset (0), and CSS renders the fully-visible resting state. The cleanup
  // handle is intentionally discarded — el lives for the page lifetime (EDS is
  // full-page-load, no client routing), matching pothole/decorate.js.
  trackScrollProgress(el, (p) => el.style.setProperty('--sbg-edge', edgeProgress(p).toFixed(4)));
};
