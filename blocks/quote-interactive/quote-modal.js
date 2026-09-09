/* eslint-disable max-lines -- Pre-existing overage (132 lines), audited 2026-09-02.
   This is dense DOM-builder code (buildModal, makeSlide) that's already logically
   cohesive and not reused elsewhere in the codebase — forcibly moving pieces to
   scripts/utils/ for line-count compliance alone was judged premature abstraction,
   not a real readability win. */
import { getConfig } from '../../scripts/ak.js';
import { withGsap } from '../../scripts/utils/motion/gsap-loader.js';
import { announce } from '../../scripts/utils/a11y.js';
import { parseSvg, CHEVRON_SVG } from '../../scripts/utils/dom.js';
import {
  wireModalClose, openModal, closeModal, clampIndex,
} from '../../scripts/utils/modal/modal.js';

const plusIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const arrow = (prev) => {
  const span = document.createElement('span');
  span.className = `qi-modal-arrow${prev ? ' qi-modal-arrow-prev' : ''}`;
  span.append(parseSvg(CHEVRON_SVG));
  return span;
};

// modal/releaseTrap/current/triggerTab are shared module state (only one quote
// modal can ever be open site-wide, matching the video-modal.js singleton
// pattern) — but `activeSlides` additionally records WHICH block instance's
// slides that open modal belongs to. Without it, a second quote-interactive
// instance on the same page would read/overwrite the first instance's nav
// state, or a click on the second instance would silently hijack the first
// instance's already-open modal instead of opening its own.
let modal = null;
let releaseTrap = null;
let current = 0;
let triggerTab = null;
let activeSlides = null;

const updateNav = () => {
  const prev = modal?.querySelector('.qi-modal-prev');
  const next = modal?.querySelector('.qi-modal-next');
  if (prev) prev.disabled = current === 0;
  if (next) next.disabled = current === activeSlides.length - 1;
};

const goTo = (i) => {
  current = clampIndex(i, activeSlides.length);
  modal.querySelector('.qi-modal-track').style.setProperty('--carousel-index', current);
  updateNav();
  announce(`Slide ${current + 1} of ${activeSlides.length}`);
};

const close = () => {
  if (!modal) return;
  const content = modal.querySelector('.qi-modal-content');
  const finish = () => {
    closeModal(modal, releaseTrap, triggerTab);
    modal = null;
    activeSlides = null;
  };
  // withGsap() is async and therefore always returns a truthy Promise
  // synchronously — branching on that return value directly (the prior bug)
  // can never see the shouldAnimate()-false case, where the callback (and its
  // onComplete: finish) never runs at all. Awaiting the resolved value (null
  // when shouldAnimate() is false, see gsap-loader.js) is the only way to
  // reach the fallback branch.
  withGsap(({ gsap }) => {
    gsap.to(content, {
      scale: 0.95, opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: finish,
    });
  }).then((animated) => !animated && finish()).catch((ex) => getConfig().log(ex));
};

// Used only when a second block instance's modal needs to open while a first
// instance's modal is already open — an instant cut rather than close()'s
// animated exit, since this is a state-correctness fix (don't show instance
// A's content under instance B's trigger), not a polish moment.
const forceClose = () => {
  if (!modal) return;
  closeModal(modal, releaseTrap, triggerTab);
  modal = null;
  activeSlides = null;
};

const makeSlide = ({ pic, category, quoteNodes, attrNodes }) => {
  const el = document.createElement('div');
  el.className = 'qi-modal-slide';
  const bg = document.createElement('div');
  bg.className = 'qi-modal-slide-bg';
  if (pic) bg.append(pic.cloneNode(true));
  bg.append(Object.assign(document.createElement('div'), { className: 'qi-modal-scrim' }));
  const eye = Object.assign(document.createElement('span'), { className: 'qi-modal-eyebrow', textContent: category });
  const body = document.createElement('div');
  body.className = 'qi-modal-slide-body';
  const bq = document.createElement('blockquote');
  bq.className = 'qi-modal-quote';
  bq.append(...quoteNodes.map((n) => n.cloneNode(true)));
  const fc = document.createElement('figcaption');
  fc.className = 'qi-modal-attr';
  fc.append(...attrNodes.map((n) => n.cloneNode(true)));
  body.append(bq, fc);
  el.append(bg, eye, body);
  return el;
};

const buildModal = (slides) => {
  const el = document.createElement('div');
  el.className = 'qi-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Customer quotes');

  const backdrop = Object.assign(document.createElement('div'), { className: 'qi-modal-backdrop' });

  const closeBtn = Object.assign(document.createElement('button'), {
    className: 'qi-modal-close', innerHTML: plusIcon,
  });
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.addEventListener('click', close);

  const track = document.createElement('div');
  track.className = 'qi-modal-track';
  for (const s of slides) track.append(makeSlide(s));
  const carousel = Object.assign(document.createElement('div'), { className: 'qi-modal-carousel' });
  carousel.append(track);

  const nav = document.createElement('div');
  nav.className = 'qi-modal-nav';
  const navInner = document.createElement('div');
  navInner.className = 'qi-modal-nav-inner';
  [['prev', -1], ['next', 1]].forEach(([cls, dir]) => {
    const isPrev = cls === 'prev';
    const label = isPrev ? 'Previous' : 'Next';
    const btn = document.createElement('button');
    btn.className = `qi-modal-${cls}`;
    const text = Object.assign(document.createElement('span'), { textContent: label });
    btn.append(...(isPrev ? [arrow(true), text] : [text, arrow(false)]));
    btn.setAttribute('aria-label', `${label} slide`);
    btn.addEventListener('click', () => goTo(current + dir));
    navInner.append(btn);
  });
  nav.append(navInner);

  const content = document.createElement('div');
  content.className = 'qi-modal-content';
  content.append(closeBtn, carousel, nav);
  el.append(backdrop, content);

  wireModalClose(el, backdrop, close);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(current - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(current + 1);
    }
  });

  return el;
};

export const initModal = (blockEl, tabs, slides) => (index) => {
  // Same instance's modal is already open — just navigate, don't rebuild.
  if (modal && activeSlides === slides) {
    goTo(index);
    return;
  }
  // A DIFFERENT instance's modal is open (identity check via the `slides`
  // array closed over per-instance by initModal's own params) — close it
  // first so its state can never be read/overwritten by this instance below.
  if (modal) forceClose();

  modal = buildModal(slides);
  activeSlides = slides;
  current = index;
  modal.querySelector('.qi-modal-track').style.setProperty('--carousel-index', index);
  releaseTrap = openModal(modal, '.qi-modal-close');
  triggerTab = tabs[index];
  updateNav();
  announce(`Quote carousel opened, slide ${index + 1} of ${slides.length}`);
  const content = modal.querySelector('.qi-modal-content');
  const slide = content.querySelectorAll('.qi-modal-slide')[index];
  withGsap(({ gsap }) => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.fromTo(content, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 });
    tl.fromTo(modal.querySelector('.qi-modal-close svg'), { rotate: 0 }, { rotate: 45, duration: 0.5 }, '<');
    tl.fromTo(modal.querySelector('.qi-modal-backdrop'), { opacity: 0 }, { opacity: 1 }, '<+0.3');
    if (slide) tl.fromTo(slide, { '--item-progress': 0 }, { '--item-progress': 1, duration: 0.4 }, '<');
  });
};
