// Organic Mosaic uses one authored media set; CSS reshapes it by breakpoint
// and motion enhances the already-readable static mosaic.
import { createElement, getCells } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { MQ_MD } from '../../scripts/utils/breakpoints.js';

// Falkor renders 5 desktop / 3 mobile columns from two separately-sorted
// arrays. We build ONE deterministic round-robin distribution and let CSS
// choose how many columns are visible per breakpoint; four columns divides
// cleanly into the mobile 2-up arrangement and reads as a balanced desktop
// mosaic. columnCount is clamped to the tile count so a light (<4) authoring
// never leaves an empty, gap-producing column.
const COLUMNS = 4;

// The authored media node is reused verbatim (EDS already emits a responsive,
// optimized <picture> carrying the author's alt -- an intentionally decorative
// tile is authored with alt=""; we never invent or strip alt text), so
// createPicture is intentionally not used here. A picture wrapped in an .mp4
// link keeps that link so decorateVideoMedia can upgrade it to a background
// video; a bare picture is left untouched by the very same call.
const buildTile = (pic) => {
  const media = pic.closest('a[href*=".mp4"]') ?? pic;
  const tile = createElement('div', { className: 'organic-mosaic-tile' }, media);
  decorateVideoMedia(tile);
  return tile;
};

export default (el, { signal } = {}) => {
  if (signal?.aborted || !guardDecorate(el, 'organicMosaic')) return;
  // Every authored <picture> is one tile (a cell may hold more than one -- none
  // silently vanish). Document order is preserved so the round-robin below is
  // deterministic and the layout is stable across re-renders.
  const tiles = getCells(el)
    .flatMap((c) => [...c.querySelectorAll('picture')])
    .map(buildTile);
  // No media -> leave the authored DOM untouched (don't emit an empty grid that
  // would still reserve contain-intrinsic-size height).
  if (!tiles.length) return;
  const columnCount = Math.min(COLUMNS, tiles.length);
  const columns = [...Array(columnCount)].map(() => createElement('div', { className: 'organic-mosaic-column' }));
  tiles.forEach((tile, i) => columns[i % columnCount].append(tile));
  el.replaceChildren(createElement('div', { className: 'organic-mosaic-grid' }, ...columns));
  // Motion is a pure enhancement over the static mosaic already on the page,
  // and a DESKTOP-only one: below md nothing consumes --progress, so wiring the
  // scroll engine there would burn a per-rAF getBoundingClientRect for zero
  // visual payoff. Gate the JS to the same breakpoint as the CSS transform.
  // (Trade-off: a mobile->desktop resize without reload gets no parallax --
  // negligible, and consistent with this block's static-first posture.)
  if (!shouldAnimate() || !window.matchMedia(MQ_MD).matches) return;
  // The block signal disconnects the shared scroll observer on re-decoration.
  el.classList.add('is-scrubbing');
  trackScrollProgress(el, undefined, { signal });
};
