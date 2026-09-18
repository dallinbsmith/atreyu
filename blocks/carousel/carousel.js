import { decorateTout, extractRowMedia } from '../../scripts/utils/touts.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { announce } from '../../scripts/utils/a11y.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

// One row = one slide. Classified by image shape (extractRowMedia), not
// column position: the large photo becomes the full-bleed background, a
// small logo/graphic is hoisted above the heading — same shape distinction
// bentos.js uses for its cards, since a carousel slide is the same "photo +
// logo + heading + link" tile, just inside a scrollable track instead of a
// grid. Real source content (Falkor's module.carousel) requires 3+ slides.
// No autoplay exists (nav is click-only), so WCAG 2.2.2's pause-control
// requirement for continuous motion doesn't apply here.
const buildSlide = (row, idx, total, slideLabel) => {
  row.setAttribute('role', 'group');
  row.setAttribute('aria-roledescription', 'slide');
  row.setAttribute('aria-label', slideLabel.replace('{current}', idx + 1).replace('{total}', total));

  // Authored columns (media cell, content cell) are an authoring convenience,
  // not meaningful structure — capture them now, before any extraction, so
  // they can be unwrapped into flat slide children below. Unwrapping matters:
  // without it, decorateTout's title/cta output would land nested inside the
  // orphaned content-column div instead of directly on the slide, breaking
  // the flat "media + title + cta" shape the CSS (and bentos' identical
  // pattern) expects.
  const originalCols = [...row.children];
  const { media, logo } = extractRowMedia(row);

  originalCols.forEach((col) => {
    row.append(...col.childNodes);
    col.remove();
  });

  decorateTout(row, 'carousel-slide', `carousel-slide-${idx}`);

  if (logo) {
    logo.classList.add('carousel-slide-logo');
    row.prepend(logo);
  }

  if (media) {
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'carousel-slide-media';
    mediaWrap.append(media);
    row.prepend(mediaWrap);
  }
};

// Announces the now-current slide once scroll has settled — not mid-scroll,
// which would fire before the new slide is actually in view and could
// double-fire on fast repeat clicks.
const announceCurrentSlide = (viewport, total, slideLabel) => {
  const raw = Math.round(viewport.scrollLeft / viewport.clientWidth);
  const idx = Math.min(Math.max(raw, 0), total - 1);
  announce(slideLabel.replace('{current}', idx + 1).replace('{total}', total));
};

const makeNavButton = (label, dir, viewport) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `carousel-nav carousel-nav-${dir}`;
  btn.setAttribute('aria-label', label);
  btn.dataset.testid = `carousel-nav-${dir}`;
  btn.addEventListener('click', () => {
    const amount = viewport.clientWidth * 0.8 * (dir === 'prev' ? -1 : 1);
    viewport.scrollBy({ left: amount, behavior: shouldAnimate() ? 'smooth' : 'auto' });
  });
  return btn;
};

// Never placed in the Eager/first-section path today (Falkor's module.carousel
// is customer-story content, never hero content) — if that ever changes,
// this await-before-render shape (matching pricing.js's identical pattern)
// would need revisiting per scripts.md's eager-phase network-call rule.
export default async (el) => {
  if (!guardDecorate(el, 'carousel')) return;

  const rows = [...el.children].filter((r) => r.textContent.trim() || r.querySelector('picture, img'));
  if (rows.length < 3) return;

  const [regionLabel, prevLabel, nextLabel, slideLabel] = await Promise.all([
    getPlaceholder('carouselLabel', 'Carousel'),
    getPlaceholder('carouselPrev', 'Previous slide'),
    getPlaceholder('carouselNext', 'Next slide'),
    getPlaceholder('carouselSlidePosition', '{current} of {total}'),
  ]);

  rows.forEach((row, idx) => buildSlide(row, idx, rows.length, slideLabel));

  const track = document.createElement('div');
  track.className = 'carousel-track';
  track.append(...rows);

  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  viewport.append(track);

  el.setAttribute('role', 'region');
  el.setAttribute('aria-roledescription', 'carousel');
  el.setAttribute('aria-label', regionLabel);

  el.replaceChildren(
    viewport,
    makeNavButton(prevLabel, 'prev', viewport),
    makeNavButton(nextLabel, 'next', viewport),
  );

  let scrollTimer;
  viewport.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => announceCurrentSlide(viewport, rows.length, slideLabel), 150);
  });
};
