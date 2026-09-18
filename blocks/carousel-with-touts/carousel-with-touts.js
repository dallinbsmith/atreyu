import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { announce } from '../../scripts/utils/a11y.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { decorateTout } from '../../scripts/utils/touts.js';
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';

// Vanilla EDS migration of Falkor's CarouselWithTouts (React + keen-slider +
// GSAP). Falkor is STRUCTURALLY different per breakpoint, so this is too:
// - desktop (>= 768): a scroll-snap carousel of MEDIA inside a device frame,
//   driven by prev/next arrows and a LABEL-PAGINATION row of the touts below;
//   the active tout is opaque, the rest dimmed, kept in sync as you scroll.
// - mobile (< 768): NOT a carousel. Slides stack vertically, each media
//   followed by its tout caption, media alternating alignment left/right.
// SINGLE responsive DOM, no media duplication: each slide holds {media, tout};
// the touts double as the mobile captions AND are cheaply cloned to TEXT-only
// pagination buttons for desktop (buildPage) - text is cheap to duplicate, the
// media is not. The desktop<->mobile switch is owned by CSS (@media); JS only
// mirrors it for ARIA (a plain stack must not announce carousel/slide
// semantics) via matchMedia at the same 768 threshold.
const MEDIA_SELECTOR = 'picture, img, video, a[href*=".mp4"]';
const DESKTOP = '(width >= 768px)';

// Responsive-ARIA registry. This block CAN repeat on a page AND can be
// re-decorated onto a FRESH el by a DA Quick Edit, so a per-instance window
// listener would leak one per Quick Edit (each closure retains its detached el
// forever). Instead every instance registers its applyMode in a shared Set
// behind ONE shared MediaQueryList + ONE shared `change` listener (runAria - a
// stable reference, so addEventListener dedups after the first). This bounds the
// listener count to one, but eviction is LAZY: a stale instance only removes
// itself on the NEXT breakpoint crossing (when its el.isConnected is false), so
// a Quick Edit without a resize across 768 leaves one bounded stale entry (its
// detached el/slides) in the Set until then - authoring-only, never on the
// published page. Only mutable module state: the Set and the MediaQueryList.
const ariaBlocks = new Set();
let ariaMq;
const runAria = () => { for (const apply of ariaBlocks) apply(); };

const attr = (node, name, value) => (value == null
  ? node.removeAttribute(name) : node.setAttribute(name, value));

// Unwrap a non-autoplay video slide's .mp4 link down to its poster picture, so
// it is not a tab-stop that navigates the browser to the raw file.
const posterize = (slide) => {
  const link = slide.querySelector('a[href*=".mp4"]');
  link?.replaceWith(...link.childNodes);
};

// Classify each authored row by CONTENT SHAPE, not column order: the cell that
// holds media is the media, a different non-empty cell is the tout. A row may
// legitimately carry only one of the two (or reorder them) - render what exists.
const parseSlides = (el) => [...el.children].map((row) => {
  const cells = [...row.children];
  const media = cells.find((c) => c.querySelector(MEDIA_SELECTOR)) ?? null;
  const tout = cells.find((c) => c !== media
    && (c.querySelector(HEADING_SELECTOR) || c.textContent.trim())) ?? null;
  return media || tout ? { media, tout } : null;
}).filter(Boolean);

const buildSlide = ({ media, tout }, idx) => {
  if (media) media.className = 'cwt-media';
  // Pass a per-slide testid id so each tout's CTA link gets a UNIQUE testid
  // (the default reuses the prefix, colliding across all three touts).
  if (tout) decorateTout(tout, 'cwt-tout', `cwt-tout-${idx}`);
  return createElement('div', { className: 'cwt-slide', 'data-testid': `cwt-slide-${idx}` }, media, tout);
};

// Label-pagination button carrying the tout TITLE (title6) as its accessible
// text - the salient tout label. Missing tout -> the 1-based position, so a
// media-only slide still has a labelled control. Its supporting body copy is
// NOT repeated here (it shows in the mobile caption); desktop pagination stays
// scannable. Active one is set programmatically via aria-current, not opacity.
const buildPage = (tout, idx) => createElement('button', {
  type: 'button',
  className: 'cwt-page',
  'data-testid': `cwt-page-${idx}`,
}, tout?.querySelector(HEADING_SELECTOR)?.textContent || `${idx + 1}`);

const makeNav = (label, dir, viewport) => {
  const btn = createElement('button', {
    type: 'button',
    className: `cwt-nav cwt-nav-${dir}`,
    'aria-label': label,
    'data-testid': `cwt-nav-${dir}`,
  });
  btn.addEventListener('click', () => viewport.scrollBy({
    left: viewport.clientWidth * (dir === 'prev' ? -1 : 1),
    behavior: shouldAnimate() ? 'smooth' : 'auto',
  }));
  return btn;
};

export default async (el) => {
  if (!guardDecorate(el, 'carouselWithTouts')) return;
  const data = parseSlides(el);
  if (!data.length) return;

  const [regionLabel, prevLabel, nextLabel, slideLabel] = await Promise.all([
    getPlaceholder('carouselLabel', 'Carousel'),
    getPlaceholder('carouselPrev', 'Previous slide'),
    getPlaceholder('carouselNext', 'Next slide'),
    getPlaceholder('carouselSlidePosition', '{current} of {total}'),
  ]);

  const slides = data.map((d, i) => buildSlide(d, i));
  const label = (i) => slideLabel.replace('{current}', i + 1).replace('{total}', slides.length);
  // Falkor autoplays only the first video (muted); every other video slide is
  // posterised so no raw .mp4 link is left as a tab-stop.
  slides.filter((s) => s.querySelector('a[href*=".mp4"]'))
    .forEach((s, i) => (i === 0 ? decorateVideoMedia(s.querySelector('.cwt-media')) : posterize(s)));

  const track = createElement('div', { className: 'cwt-track' }, ...slides);
  const viewport = createElement('div', { className: 'cwt-viewport' }, track);
  const frame = createElement('div', { className: 'cwt-frame' }, viewport, makeNav(prevLabel, 'prev', viewport), makeNav(nextLabel, 'next', viewport));
  const pages = data.map((d, i) => buildPage(d.tout, i));
  const pagination = createElement('div', { className: 'cwt-pagination' }, ...pages);

  // Programmatic active state (not just opacity): current tout gets aria-current;
  // slides + pages are index-aligned, so one loop keeps both in sync.
  const syncActive = (idx) => slides.forEach((s, i) => {
    s.classList.toggle('is-active', i === idx);
    pages[i].classList.toggle('is-active', i === idx);
    attr(pages[i], 'aria-current', i === idx ? 'true' : null);
  });
  const goTo = (idx) => {
    const left = slides[idx].getBoundingClientRect().left - viewport.getBoundingClientRect().left;
    viewport.scrollBy({ left, behavior: shouldAnimate() ? 'smooth' : 'auto' });
    syncActive(idx);
  };
  pages.forEach((p, i) => p.addEventListener('click', () => goTo(i)));

  el.replaceChildren(frame, pagination);
  syncActive(0);

  // ARIA follows the CSS breakpoint: a wide container is a real carousel; a
  // narrow one is a plain stacked read, so the carousel semantics are removed.
  // Registered in the shared registry (see top) so re-decorate / multi-instance
  // do not stack window listeners; a detached instance evicts itself here.
  const setAria = (node, on, ...vals) => ['role', 'aria-roledescription', 'aria-label'].forEach((name, i) => attr(node, name, on ? vals[i] : null));
  const applyMode = () => {
    if (!el.isConnected && ariaBlocks.delete(applyMode)) return;
    setAria(el, ariaMq.matches, 'region', 'carousel', regionLabel);
    slides.forEach((s, i) => setAria(s, ariaMq.matches, 'group', 'slide', label(i)));
  };
  (ariaMq ??= window.matchMedia(DESKTOP)).addEventListener('change', runAria);
  ariaBlocks.add(applyMode);
  applyMode();

  // One media slide fills the viewport at a time (snap start), so the settled
  // index is a plain round of scrollLeft, clamped BOTH ends: a left-edge rubber-
  // band overscroll gives a negative scrollLeft (real on macOS/iOS) that would
  // otherwise round to -1 and de-highlight everything. This scroll-settle is the
  // SINGLE active-sync path for both motion branches (no IntersectionObserver):
  // arrows, trackpad and pagination-click scrolls all funnel through it, so
  // reduced-motion / save-data users still get highlight + aria-current + announce.
  let scrollTimer;
  viewport.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const w = viewport.clientWidth;
      const idx = Math.min(Math.max(Math.round(viewport.scrollLeft / w), 0), slides.length - 1);
      syncActive(idx);
      announce(label(idx));
    }, 150);
  });
};
