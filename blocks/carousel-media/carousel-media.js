import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { announce } from '../../scripts/utils/a11y.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';

// Migration of Falkor's CarouselMedia (React/keen-slider/GSAP) to vanilla EDS.
// One slide = one media element (image or video), classified by CONTENT SHAPE:
// any authored cell that holds a picture/img/video (or DA's only way to embed
// a video, an .mp4 link) is a slide. Empty/blank rows are ignored. Reuses the
// finite scroll-snap approach of blocks/carousel — no JS infinite loop.
const MEDIA_SELECTOR = 'picture, img, video, a[href*=".mp4"]';

// Unwrap a non-autoplay video slide's authored .mp4 link down to its poster
// picture, so it isn't a tab-stop that navigates the browser to the raw file.
const posterize = (slide) => {
  const link = slide.querySelector('a[href*=".mp4"]');
  link?.replaceWith(...link.childNodes);
};

const buildSlide = (media, idx, total, slideLabel) => createElement('div', {
  className: 'carousel-media-slide',
  role: 'group',
  'aria-roledescription': 'slide',
  'aria-label': slideLabel.replace('{current}', idx + 1).replace('{total}', total),
  // Flat, continuous index across the whole block (never reset per row) —
  // a repeated-list block's known off-by-index bug class.
  'data-testid': `carousel-media-slide-${idx}`,
}, media);

const makeNavButton = (label, dir, viewport) => {
  const btn = createElement('button', {
    type: 'button',
    className: `carousel-media-nav carousel-media-nav-${dir}`,
    'aria-label': label,
    'data-testid': `carousel-media-nav-${dir}`,
  });
  btn.addEventListener('click', () => {
    const amount = viewport.clientWidth * 0.8 * (dir === 'prev' ? -1 : 1);
    viewport.scrollBy({ left: amount, behavior: shouldAnimate() ? 'smooth' : 'auto' });
  });
  return btn;
};

// Nearest-to-centre slide. carousel.js's scrollLeft / clientWidth maths can't
// be reused: neighbours peek, so several slides share the viewport width. Live
// getBoundingClientRect reflects the real scroll position (and any layout).
const currentIndex = (viewport, slides) => {
  const vp = viewport.getBoundingClientRect();
  const centre = vp.left + vp.width / 2;
  return slides.reduce((best, slide, i) => {
    const r = slide.getBoundingClientRect();
    const dist = Math.abs(r.left + r.width / 2 - centre);
    return dist < best.dist ? { i, dist } : best;
  }, { i: 0, dist: Infinity }).i;
};

// Desaturate/dim the peeking neighbours, ramping the centred slide back to full
// clarity. Gated on shouldAnimate(): CSS owns the filter/opacity, JS only
// toggles is-active/is-inactive by intersection ratio (root = viewport). When
// motion is off this is never called, so no observer exists and every slide
// keeps its default full-clarity resting state. Page-lifetime observer,
// matching carousel.js / image-sequence.js — the block lives until navigation.
const wireActiveState = (viewport, slides) => {
  // Seed the first slide active and the rest dimmed, so there's no dim->clear
  // flash of the centre slide on load before the observer's first callback.
  slides.forEach((s, i) => s.classList.add(i === 0 ? 'is-active' : 'is-inactive'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const active = e.intersectionRatio >= 0.6;
      e.target.classList.toggle('is-active', active);
      e.target.classList.toggle('is-inactive', !active);
    });
  }, { root: viewport, threshold: [0, 0.6, 1] });
  slides.forEach((s) => io.observe(s));
};

export default async (el) => {
  if (!guardDecorate(el, 'carouselMedia')) return;

  const heading = el.querySelector(HEADING_SELECTOR);
  // Only the heading's OWN row is treated as the header/lockup; any other
  // text-only row (no media) is ignored, and media co-located in the heading
  // row is intentionally NOT promoted to a slide. Deliberate: this is a media
  // carousel with an optional centred title, not a rich multi-row lockup.
  const headingRow = heading && [...el.children].find((r) => r.contains(heading));
  const headerCell = headingRow && [...headingRow.children].find((c) => c.contains(heading));

  const mediaCells = [...el.children]
    .filter((row) => row !== headingRow)
    .flatMap((row) => [...row.children])
    .filter((cell) => cell.querySelector(MEDIA_SELECTOR));
  if (!mediaCells.length) return;

  const [regionLabel, prevLabel, nextLabel, slideLabel] = await Promise.all([
    getPlaceholder('carouselLabel', 'Carousel'),
    getPlaceholder('carouselPrev', 'Previous slide'),
    getPlaceholder('carouselNext', 'Next slide'),
    getPlaceholder('carouselSlidePosition', '{current} of {total}'),
  ]);

  const slides = mediaCells.map((cell, idx) => {
    const media = createElement('div', { className: 'carousel-media-slide-media' }, ...cell.childNodes);
    return buildSlide(media, idx, mediaCells.length, slideLabel);
  });

  // Uniform aspect ratio comes from the authored media, not a fixed value:
  // Sanity only WARNS that slides match each other, and Falkor renders each
  // asset's real ratio. Read the first slide's intrinsic w/h and expose it as
  // a custom property; a 0/NaN/absent dimension falls through to the CSS
  // 16 / 9 fallback rather than setting an invalid "w / 0" that collapses it.
  const ratioImg = slides[0].querySelector('img');
  const [rw, rh] = [Number(ratioImg?.getAttribute('width')), Number(ratioImg?.getAttribute('height'))];
  if (rw > 0 && rh > 0) el.style.setProperty('--carousel-media-ratio', `${rw} / ${rh}`);

  // Falkor autoplays only the FIRST video (muted): decorateVideoMedia gates on
  // shouldAnimate(), unwraps to the static poster when motion is off, and adds
  // the WCAG 2.2.2 pause control. Every OTHER video slide is posterised so no
  // raw .mp4 link is left in the tab order — poster-only is the safe default.
  const videoSlides = slides.filter((s) => s.querySelector('a[href*=".mp4"]'));
  videoSlides.forEach((s, i) => (i === 0 ? decorateVideoMedia(s.firstElementChild) : posterize(s)));

  const track = createElement('div', { className: 'carousel-media-track' }, ...slides);
  const viewport = createElement('div', { className: 'carousel-media-viewport' }, track);
  const nav = [makeNavButton(prevLabel, 'prev', viewport), makeNavButton(nextLabel, 'next', viewport)];
  const stage = createElement('div', { className: 'carousel-media-stage' }, viewport, ...nav);

  heading?.classList.add('carousel-media-title');
  const header = headerCell && createElement('div', { className: 'carousel-media-header' }, ...headerCell.childNodes);

  el.setAttribute('role', 'region');
  el.setAttribute('aria-roledescription', 'carousel');
  el.setAttribute('aria-label', regionLabel);
  el.replaceChildren(...(header ? [header] : []), stage);

  if (shouldAnimate()) wireActiveState(viewport, slides);

  let scrollTimer;
  viewport.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const idx = currentIndex(viewport, slides);
      announce(slideLabel.replace('{current}', idx + 1).replace('{total}', slides.length));
    }, 150);
  });
};
