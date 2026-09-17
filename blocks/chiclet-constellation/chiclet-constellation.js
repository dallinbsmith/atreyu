// Vanilla port of Falkor's ChicletConstellation (organisms/modules/
// ChicletConstellation). Authoring: each document-table ROW is one chiclet;
// cells are classified by content shape, not position — the cell holding an
// icon/picture is the mark, a text cell is the accessible name, any link
// becomes the chiclet's href. Falkor rendered each chiclet as an UNLABELED
// decorative <div> (CSS-mask SVG, no alt/text); this migration EXCEEDS that by
// giving every chiclet a VISIBLE text label as its accessible name and marking
// the icon decorative (aria-hidden). A chiclet with no derivable name is
// dropped rather than shipped unlabeled. Motion is a faithful mapping of
// Falkor's useScrollProgress + gsap.quickSetter('--constellation-progress'):
// the shared trackScrollProgress(el) sets --progress (0..1) on the block and
// CSS floats/scatters/fades each chiclet off it (compositor-only transform +
// opacity, per-item stagger via --i). No-op under reduced motion / save-data /
// low power — CSS's var(--progress, 0) fallback leaves a static, readable,
// fully-labeled constellation grid.
import { createElement } from '../../scripts/utils/dom.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import ENV from '../../scripts/utils/env.js';

const ICON = 'span.icon, picture, img';

const buildChiclet = (row, i) => {
  const cells = [...row.children];
  const iconCell = cells.find((c) => c.querySelector(ICON));
  const iconNode = iconCell?.querySelector(ICON);
  const href = row.querySelector('a[href]')?.getAttribute('href') || undefined;
  const img = iconNode?.tagName === 'IMG' ? iconNode : iconNode?.querySelector?.('img');
  // Accessible name = the first cell that actually carries text; an icon-only
  // cell contributes none, so a two-cell "| :icon: | Label |" prefers the
  // separate label cell while single-cell "| :icon: Label |" and a whole-row
  // link fall back to that same cell's own text. Alt is the last resort.
  const name = cells.find((c) => c.textContent.trim())?.textContent.trim()
    || img?.getAttribute('alt')?.trim() || '';
  if (!name) {
    // Never ship an unlabeled chiclet (the a11y win over the live site), but
    // make the drop diagnosable off prod (mirrors logo-tile-wall's silent drop).
    // eslint-disable-next-line no-console
    if (ENV !== 'prod') console.warn('chiclet-constellation: dropped a chiclet with no accessible name', row);
    return null;
  }

  img?.setAttribute('alt', ''); // visible label owns the name; keep the mark decorative
  const mark = createElement('span', { className: 'cc-icon', 'aria-hidden': 'true' }, ...(iconNode ? [iconNode] : []));
  const label = createElement('span', { className: 'cc-label' }, name);
  const chiclet = createElement(href ? 'a' : 'span', { className: 'cc-chiclet', href }, mark, label);
  const item = createElement('li', { className: 'cc-item' }, chiclet);
  item.style.setProperty('--i', i);
  return item;
};

export default (el) => {
  // Idempotent under DA Quick-Edit re-decoration. Below, trackScrollProgress's
  // disposer is intentionally discarded: its IntersectionObserver lives in the
  // scroll.js module (not this element's subtree) and does NOT self-disconnect
  // when off screen -- but el lives for the page lifetime here, so there is
  // nothing to tear down. Same page-lifetime drop as pothole.js / speedbump.js.
  if (!guardDecorate(el, 'chicletConstellation')) return;
  const items = [...el.children].map(buildChiclet).filter(Boolean);
  // Replace the raw authored rows even when nothing survives, so a malformed
  // constellation never leaves unstyled <div>s behind (see logo-wall.js).
  el.replaceChildren(createElement('ul', { className: 'cc-list' }, ...items));
  if (!items.length || !shouldAnimate()) return; // resting DOM is the static, labeled grid
  el.classList.add('is-animating');
  // Sets --progress (0..1) on el as the section scrolls; CSS drifts/fades each
  // chiclet off it. Progress stops when scrolling stops, so no WCAG 2.2.2 pause
  // control is required (contrast the looping logo-tile-wall marquee).
  trackScrollProgress(el);
};
