// Image cloud: pseudo-randomly positioned floating images framing a centered
// text lockup, with a gentle scroll-driven vertical parallax. Ported from
// Falkor's ImageCloud (organisms/modules/ImageCloud). Authoring is one block
// table: every cell holding a <picture> is a cloud image; every text cell forms
// the centered content lockup (heading + copy). Classification is by content
// shape, never row position -- mirrors hero-image-wall.js. The parallax lives
// entirely in CSS (per-image --icloud-drift driven by --progress from
// trackScrollProgress) and is gated on shouldAnimate(): the resting DOM is the
// fully readable, statically positioned cloud, so reduced-motion / save-data /
// low-power visitors get a valid page with zero motion and zero observers.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { createElement, getCells, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

// Nine pseudo-random anchor points (x,y as % of the cloud box) that frame the
// centered lockup, each paired with a parallax factor -- Falkor's
// parallaxFactors [0.4 0.2 0.5 0.3 0.6 0.7 0.4 0.8 1]: how far that image
// drifts as the section scrolls. Order matters: the first four anchors are the
// four corners so a light 1-4 image authoring still reads as an intentional,
// balanced spread rather than a lopsided top-left clump. This is a fixed set of
// nine designed positions (Falkor hard-required exactly nine); extra authored
// images are dropped, not wrapped -- see decorate(). No anchor sits on the
// vertical centre (50%) where the lockup text lives.
const POSITIONS = [
  { x: 16, y: 15, f: 0.4 },
  { x: 80, y: 84, f: 0.7 },
  { x: 84, y: 12, f: 0.2 },
  { x: 20, y: 80, f: 0.6 },
  { x: 9, y: 46, f: 0.5 },
  { x: 91, y: 43, f: 0.3 },
  { x: 50, y: 6, f: 0.45 },
  { x: 50, y: 94, f: 0.8 },
  { x: 95, y: 70, f: 1 },
];

// The authored <picture> is reused verbatim (EDS already emits a responsive,
// optimized <picture> carrying the author's alt) rather than rebuilt via
// createPicture -- same choice as hero-image-wall.js / hero-cards-transition.js.
// The author's alt is the accessible name; an intentionally decorative image is
// authored with an empty alt. We never invent or strip alt text.
const buildImage = (pic, i) => {
  const { x, y, f } = POSITIONS[i];
  const wrap = createElement('div', { className: 'icloud-image' }, pic);
  wrap.style.setProperty('--icloud-x', `${x}%`);
  wrap.style.setProperty('--icloud-y', `${y}%`);
  wrap.style.setProperty('--icloud-factor', `${f}`);
  return wrap;
};

const buildLockup = (textCells) => {
  const lockup = createElement('div', { className: 'icloud-lockup' }, ...textCells.flatMap((c) => [...c.childNodes]));
  lockup.querySelector(HEADING_SELECTOR)?.classList.add('icloud-heading');
  return lockup;
};

export default (el) => {
  // Idempotent under DA Quick-Edit re-decoration. trackScrollProgress returns a
  // disposer we intentionally drop. Its IntersectionObserver stays connected for
  // `el`'s lifetime -- going off-screen only removes `el` from the util's shared
  // active Set (halting scroll work), it does NOT disconnect the IO. We accept
  // that because `el` lives for the whole page (no client-side routing to unmount
  // it), the same trade-off as hero-cards-transition.js.
  if (!guardDecorate(el, 'imageCloud')) return;
  const cells = getCells(el);
  // Every authored <picture> is one floating image (a single cell may hold more
  // than one -- none silently vanish), then capped at the nine designed anchor
  // points; a 10th+ picture is dropped rather than stacked pixel-exactly on an
  // existing anchor. This module has no per-image caption, so any text sharing
  // an image cell is intentionally ignored -- lockup copy goes in a text cell.
  const images = cells
    .flatMap((c) => [...c.querySelectorAll('picture')])
    .slice(0, POSITIONS.length)
    .map(buildImage);
  const textCells = cells.filter((c) => !c.querySelector('picture') && c.textContent.trim());
  const inner = createElement(
    'div',
    { className: 'icloud-inner' },
    createElement('div', { className: 'icloud-images' }, ...images),
    buildLockup(textCells),
  );
  el.replaceChildren(inner);
  decorateRichText(el);
  // Motion is a pure enhancement over the static cloud already on the page.
  if (!images.length || !shouldAnimate()) return;
  el.classList.add('is-scrubbing');
  trackScrollProgress(el);
};
