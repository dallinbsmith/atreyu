// Standout mosaic: a scroll-parallax showcase — a title lockup, a device/app-UI
// mockup overlaid on a staggered mosaic of square card images (4 columns of 2).
// A vanilla port of Falkor's GSAP `StandoutMosaic`: here the animation lives in
// CSS off `--progress` (from trackScrollProgress), driven by per-column/per-card
// custom properties so one scroll number fans out to the whole mosaic. Motion is
// desktop-only (CSS-gated to >= md); mobile and reduced-motion rest at a valid
// static frame (progress defaults 0). No GSAP, no framework, no build step.
//
// REQUIRED AUTHORING CONTRACT (how device vs cards is classified by shape, not
// position): author the device media ALONE in its own row, and author the card
// images GROUPED 2+ per row. That contrast is what lets a lone-media row be read
// as the device while the multi-picture rows are the mosaic cards. A video
// device (an `<a href="*.mp4">`) is always detected regardless of grouping. See
// findDeviceCell for the exact rule and its dev-time warning.
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { createElement, getCells, HEADING_SELECTOR } from '../../scripts/utils/dom.js';

// Falkor: 2 cards per column, COLUMN_OFFSETS drives each column's parallax drift.
const CARDS_PER_COLUMN = 2;
const COLUMN_OFFSETS = [0, -0.1, -0.15, -0.05];

// Pictures in the same authored row as `cell` — the card group is authored as a
// multi-picture row, so a row-picture count distinguishes it from a lone device.
const rowPictureCount = (cell) => [...cell.parentElement.children]
  .filter((c) => c.querySelector('picture')).length;

// Device-vs-cards content-shape rule (position-independent, tolerant of a
// missing device): the device is (a) a media cell that is a video (an authored
// `<a href="*.mp4">`, the EDS looping-video convention), else (b) a media cell
// alone in its row while some other row holds 2+ card pictures. If neither
// distinguishes one (e.g. no video and every picture is one-per-row), there is
// no separate device and every picture is a card — documented limitation, never
// a crash.
const findDeviceCell = (pictureCells) => {
  const grouped = pictureCells.some((c) => rowPictureCount(c) >= 2);
  return pictureCells.find((c) => c.querySelector('a[href*=".mp4"]'))
    ?? (grouped ? pictureCells.find((c) => rowPictureCount(c) === 1) : undefined);
};

// Dev-time authoring-contract feedback: if there are pictures but no device was
// found AND the card count isn't a clean multiple of the column size, the
// author almost certainly violated the grouping contract (e.g. a one-per-row
// device silently absorbed as a 9th card → a mangled 5-column grid). Warn
// instead of rendering the mistake silently. Cheap, dev-only signal.
const warnIfLikelyMisauthored = (pictureCells, deviceCell, cardCount) => {
  if (pictureCells.length && !deviceCell && cardCount % CARDS_PER_COLUMN !== 0) {
    // eslint-disable-next-line no-console
    console.warn('standout-mosaic: no device media detected and card count is not a '
      + 'clean multiple of 2 — author the device alone in its row and cards grouped 2+ per row.');
  }
};

const buildCards = (cardCells) => {
  const wrap = createElement('div', { className: 'standout-mosaic-cards' });
  let column = null;
  cardCells.forEach((cell, i) => {
    if (i % CARDS_PER_COLUMN === 0) {
      const index = Math.floor(i / CARDS_PER_COLUMN);
      const offset = COLUMN_OFFSETS[index % COLUMN_OFFSETS.length];
      column = createElement('div', {
        className: 'standout-mosaic-column',
        style: `--col-offset:${offset}`,
      });
      wrap.append(column);
    }
    // FLAT continuous testid across ALL cards (never reset per column) — a
    // per-column counter is the known duplicate-testid bug class (see bentos).
    const picture = cell.querySelector('picture');
    // Cards are decorative showcase fill behind the overlaid device — mark them
    // decorative so AT doesn't announce 8 unlabelled images (pothole precedent).
    picture.querySelector('img')?.setAttribute('alt', '');
    column.append(createElement('div', {
      className: 'standout-mosaic-card',
      'data-testid': `standout-mosaic-card-${i}`,
      style: `--card-index:${i % CARDS_PER_COLUMN}`,
    }, picture));
  });
  return wrap;
};

export default (el) => {
  if (!guardDecorate(el, 'standoutMosaic')) return;
  const cells = getCells(el);
  const titleCell = cells.find((c) => c.querySelector(HEADING_SELECTOR));
  const pictureCells = cells.filter((c) => c !== titleCell && c.querySelector('picture'));
  const deviceCell = findDeviceCell(pictureCells);
  const cardCells = pictureCells.filter((c) => c !== deviceCell);
  warnIfLikelyMisauthored(pictureCells, deviceCell, cardCells.length);

  const stage = createElement('div', { className: 'standout-mosaic-stage' });
  if (deviceCell) {
    const device = createElement('div', { className: 'standout-mosaic-device' }, ...deviceCell.children);
    // Faithful-default divergence from Falkor (willAutoplay=false): the shared
    // util plays muted-autoplay-loop and attaches a WCAG 2.2.2 pause control —
    // browsers block programmatic non-muted play, so muted-autoplay is the
    // pragmatic faithful path. No-op on an image device (no .mp4 link).
    // NB: unlike the decorative cards, an image device keeps its AUTHORED alt on
    // purpose — the device IS meaningful app-UI content, not showcase fill.
    decorateVideoMedia(device);
    stage.append(device);
  }
  stage.append(buildCards(cardCells));

  el.replaceChildren();
  if (titleCell) el.append(createElement('div', { className: 'standout-mosaic-title' }, ...titleCell.children));
  el.append(stage);
  decorateRichText(el);

  // Gate the tracker to >= md: every --progress consumer is desktop-only CSS, so
  // below md a per-rAF --progress write would be pure INP cost for zero visual
  // effect. Tradeoff: no reaction to a cross-breakpoint resize (fine for a
  // scroll module — a resize past md is a rare, reload-adjacent event).
  // trackScrollProgress itself also self-gates (no-op + no observer under
  // reduced motion / save-data). Disposer discarded deliberately: `el` lives for
  // the page lifetime (EDS full-page load, no client routing) — matches pothole.
  if (window.matchMedia('(min-width: 768px)').matches) trackScrollProgress(el);
};
