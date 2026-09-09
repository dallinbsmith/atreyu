import { decorateTout, inferMediaLayout } from '../../scripts/utils/touts.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { parseSvg, CHEVRON_SVG } from '../../scripts/utils/dom.js';
import { announce } from '../../scripts/utils/a11y.js';

// Detaches an image from wherever it's authored, then removes its wrapping
// `<p>` too — but only once genuinely emptied (checked AFTER detaching; an
// authored image is always its `<p>`'s only content, so checking before
// detaching would find the image itself and never consider the wrapper
// empty). Mirrors bentos.js's identical `placeMedia` cleanup, for the same
// reason: an emptied authoring wrapper left behind reads as a real content
// gap to decorateTout (an empty `.carousel-slide-body` paragraph), not a
// harmless leftover.
const detach = (node) => {
  const wrapP = node.closest('p');
  node.remove();
  if (wrapP && !wrapP.textContent.trim() && !wrapP.querySelector('img, picture')) wrapP.remove();
};

// One row = one slide. Classified by image shape (inferMediaLayout), not
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

  // Real content is always exactly one background photo + zero-or-one logo,
  // but classify defensively: if a slide is ever authored with more than
  // one of either, keep the first of each and remove the rest outright
  // rather than leaving unstyled stray images behind.
  let media = null;
  const logos = [];
  [...row.querySelectorAll('img')].forEach((img) => {
    const host = img.closest('picture') ?? img;
    if (inferMediaLayout(img) === 'background') {
      if (media) detach(host);
      else media = host;
    } else {
      logos.push(host);
    }
  });
  logos.slice(1).forEach(detach);
  const [logo] = logos;

  if (media) detach(media);
  if (logo) detach(logo);

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
  btn.append(parseSvg(CHEVRON_SVG));
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
  if (el.dataset.carousel) return;
  el.dataset.carousel = 'true';

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
