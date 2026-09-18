// Organic Mosaic: a media-only, multi-column photo/video mosaic with a gentle
// scroll-driven per-column parallax. Ported from Falkor's OrganicMosaic
// (organisms/modules/OrganicMosaic): an array of >=5 media assets laid into
// staggered columns that drift at different rates as the section scrolls.
// Authoring is one block table -- every cell holding a <picture> is one media
// tile (a picture wrapped in an <a href*=".mp4"> becomes a looping background
// video via decorateVideoMedia, which brings its own WCAG pause control and
// reduced-motion poster). Classification is by content shape, never row
// position. Media distribute round-robin into columns for a stable layout.
// The parallax lives entirely in CSS (per-column --om-speed driven by
// --progress from trackScrollProgress) and is gated on shouldAnimate(): the
// resting DOM is a valid static mosaic grid, so reduced-motion / save-data /
// low-power visitors get a good page with zero motion and zero observers.
// Mobile keeps the static grid only -- the parallax is a >=768px enhancement,
// gated in BOTH the CSS (the transform lives inside @media >=768px) AND the JS
// (is-scrubbing + trackScrollProgress are skipped below md), matching Falkor
// (its onProgress no-ops below the md breakpoint) and keeping the mobile scroll
// path -- the most INP-sensitive one -- free of per-rAF layout reads it can't
// use. A bare <picture> renders as-is; a picture wrapped in an .mp4 link becomes
// a background video; a picture inside any OTHER anchor keeps the picture and
// drops the link (correct for a media-only module -- there is no CTA here).
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

export default (el) => {
  if (!guardDecorate(el, 'organicMosaic')) return;
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
  // Cleanup discarded: no client routing, so `el` lives for the page lifetime.
  // Same convention as hero-cards-transition.js / image-sequence.js -- going
  // off-screen only halts scroll work, it does not disconnect the IO.
  el.classList.add('is-scrubbing');
  trackScrollProgress(el);
};
