import { createElement } from '../../scripts/utils/dom.js';
import { loadPartnerLogo } from '../../scripts/utils/media/partner-logo.js';
import { addPauseToggle, onReveal } from '../../scripts/utils/motion/motion.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

// Ported from Falkor's LogoTileWall (organisms/modules/LogoTileWall). Authoring:
// each document-table ROW is one horizontal logo strip; each CELL is one tile,
// classified by content shape — an authored <picture>/<img> is the logo mark,
// plain text is a brand name (fetched from /img/partners/ like logo-wall.js and
// tile-table.js). Every tile carries a VISIBLE text label as its accessible
// name: plain-text cells use the typed name, image-only cells derive it from the
// <img> alt; a cell with neither is dropped rather than shipped as an unlabeled
// logo. The logo mark itself is always decorative (aria-hidden).
const LOGO_HEIGHT = 32;

const buildTile = (cell) => {
  const pic = cell.querySelector('picture, img');
  const img = pic?.tagName === 'IMG' ? pic : pic?.querySelector('img');
  const name = cell.textContent.trim() || img?.getAttribute('alt')?.trim() || '';
  if (!name) return null; // no derivable accessible name → don't ship an unlabeled tile
  const mark = createElement('span', { className: 'ltw-logo', 'aria-hidden': 'true' });
  let load = Promise.resolve();
  if (pic) {
    img?.setAttribute('alt', ''); // visible label owns the name; avoid double announcement
    mark.append(pic);
  } else {
    load = loadPartnerLogo(mark, name, LOGO_HEIGHT);
  }
  const label = createElement('span', { className: 'ltw-label' }, name);
  return { tile: createElement('div', { className: 'ltw-tile' }, mark, label), load };
};

const buildRow = (row) => {
  const built = [...row.children].map(buildTile).filter(Boolean);
  const track = createElement('div', { className: 'ltw-track' }, ...built.map((b) => b.tile));
  // Two-element structure so the marquee seams correctly: .ltw-row is the fixed-
  // width, overflow-clipped, edge-masked VIEWPORT (no transform); .ltw-scroller
  // is the width:max-content element that actually animates. translateX(-50%) on
  // the scroller (holding track + its clone) resolves against the doubled content
  // width, so it advances exactly one track. Putting max-content + the transform
  // on the viewport row — and clamping it with max-width — was the seam bug.
  const scroller = createElement('div', { className: 'ltw-scroller' }, track);
  return { row: createElement('div', { className: 'ltw-row' }, scroller), scroller, track, loads: built.map((b) => b.load) };
};

// Falkor gated row motion with a raw IntersectionObserver (rootMargin '50% 0%',
// threshold 0) toggling an isVisible flag. Mapped onto the shared onReveal()
// primitive with the same 50% rootMargin: it fires once when the wall nears the
// viewport then self-unobserves (no leaked observer to tear down), and
// short-circuits to a static, wrapped, fully-labeled resting wall under reduced
// motion / save-data / low-power via shouldAnimate() (immediate === true).
// Clones each track only after its logos settle (never empty spans) and appends
// the clone INTO the scroller, so both copies sit inside the animated element.
const animate = async (el, built) => {
  const [pause, play] = await Promise.all([
    getPlaceholder('logoTileWallPause', 'Pause'),
    getPlaceholder('logoTileWallPlay', 'Play'),
    Promise.all(built.flatMap(({ loads }) => loads)),
  ]);
  for (const { scroller, track } of built) {
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    scroller.append(clone);
  }
  el.classList.add('is-animating');
  // WCAG 2.2.2 (Pause, Stop, Hide): continuous motion needs a user-operable
  // pause. One toggle flips is-paused on the block; CSS pauses every row's
  // scroller animation from it.
  addPauseToggle(el, el, { className: 'ltw-toggle', labels: { pause, play } });
};

export default (el) => {
  // Idempotent under DA Quick-Edit re-decoration. onReveal's observer
  // self-unobserves after firing, so there is no out-of-subtree handle to tear
  // down via a module-scope AbortController here (contrast quote-hover.js).
  if (!guardDecorate(el, 'logoTileWall')) return;
  const built = [...el.children].map(buildRow).filter(({ track }) => track.children.length);
  // Clear the raw authored rows even when nothing survives the filter, so an
  // all-empty wall doesn't leave unstyled <div>s on the page (see logo-wall.js).
  el.replaceChildren(...built.map(({ row }) => row));
  if (!built.length) return;
  onReveal(el, ({ immediate }) => {
    if (!immediate) animate(el, built);
  }, { rootMargin: '50% 0px' });
};
