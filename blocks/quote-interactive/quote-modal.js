import { getConfig } from '../../scripts/ak.js';
import { loadGsap } from '../../scripts/utils/motion/gsap-loader.js';
import { announce } from '../../scripts/utils/a11y.js';
import { createElement, parseSvg, CHEVRON_SVG, PLUS_SVG } from '../../scripts/utils/dom.js';
import {
  wireModalClose, openModal, closeModal, clampIndex,
} from '../../scripts/utils/modal/modal.js';
import { buildModalSlide } from './quote-view.js';

const arrow = (prev) => createElement('span', {
  className: `qi-modal-arrow${prev ? ' qi-modal-arrow-prev' : ''}`,
}, parseSvg(CHEVRON_SVG));

// Single controller object — `null` when closed, a fully-populated snapshot
// when open. Previously five module-scope `let`s (modal/releaseTrap/current/
// triggerTab/activeSlides) where every function enforced the "meaningful
// only while set" invariant by convention. `.slides` is also the instance-
// ownership marker: only one quote modal is open site-wide (matching video-
// modal.js), but a second block instance's click must never read/write the
// first instance's nav state — identity-check the `slides` array closed
// over per-instance by initModal's own params.
let state = null;

const updateNav = () => {
  state.modal.querySelector('.qi-modal-prev').disabled = state.current === 0;
  state.modal.querySelector('.qi-modal-next').disabled = state.current === state.slides.length - 1;
};

const goTo = (i) => {
  state.current = clampIndex(i, state.slides.length);
  state.modal.querySelector('.qi-modal-track').style.setProperty('--carousel-index', state.current);
  updateNav();
  announce(`Slide ${state.current + 1} of ${state.slides.length}`);
};

const teardown = () => {
  if (!state) return;
  closeModal(state.modal, state.releaseTrap, state.triggerTab);
  state = null;
};

// Captures `content` synchronously before awaiting GSAP: the reference stays
// valid even if `state` is replaced during the await (a rival block instance
// opening its own modal), so the tween always animates the correct element.
// If GSAP is off (shouldAnimate false) or fails to load, teardown runs
// directly — the modal must always close, otherwise the user is stuck.
const close = async () => {
  if (!state) return;
  const content = state.modal.querySelector('.qi-modal-content');
  try {
    const core = await loadGsap();
    if (!core) {
      teardown(); return;
    }
    core.gsap.to(content, {
      scale: 0.95, opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: teardown,
    });
  } catch (ex) {
    getConfig().log(ex);
    teardown();
  }
};

const navButton = (dir) => {
  const prev = dir < 0;
  const label = prev ? 'Previous' : 'Next';
  const text = createElement('span', null, label);
  const btn = createElement('button', {
    className: `qi-modal-${prev ? 'prev' : 'next'}`, 'aria-label': `${label} slide`,
  }, ...(prev ? [arrow(true), text] : [text, arrow(false)]));
  btn.addEventListener('click', () => goTo(state.current + dir));
  return btn;
};

const buildModal = (slides) => {
  const closeBtn = createElement('button', {
    className: 'qi-modal-close', 'aria-label': 'Close',
  }, parseSvg(PLUS_SVG));
  closeBtn.addEventListener('click', close);

  const track = createElement('div', { className: 'qi-modal-track' }, ...slides.map(buildModalSlide));
  const carousel = createElement('div', { className: 'qi-modal-carousel' }, track);
  const navInner = createElement('div', { className: 'qi-modal-nav-inner' }, navButton(-1), navButton(1));
  const nav = createElement('div', { className: 'qi-modal-nav' }, navInner);
  const content = createElement('div', { className: 'qi-modal-content' }, closeBtn, carousel, nav);
  const backdrop = createElement('div', { className: 'qi-modal-backdrop' });
  const el = createElement('div', {
    className: 'qi-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Customer quotes',
  }, backdrop, content);

  wireModalClose(el, backdrop, close);
  el.addEventListener('keydown', (e) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (delta == null) return;
    e.preventDefault();
    goTo(state.current + delta);
  });
  return el;
};

export const initModal = (tabs, slides) => async (index) => {
  // Same instance's modal already open — just navigate.
  if (state?.slides === slides) {
    goTo(index); return;
  }
  // A DIFFERENT instance's modal is open — instant cut before opening ours,
  // so its state can never be read/overwritten below.
  if (state) teardown();

  const modal = buildModal(slides);
  state = { modal, current: index, releaseTrap: null, triggerTab: tabs[index], slides };
  modal.querySelector('.qi-modal-track').style.setProperty('--carousel-index', index);
  state.releaseTrap = openModal(modal, '.qi-modal-close');
  updateNav();
  announce(`Quote carousel opened, slide ${index + 1} of ${slides.length}`);
  // Everything above is synchronous — the modal is fully mounted and
  // interactive before we ever await GSAP. If shouldAnimate() is false
  // (or GSAP fails to load), the modal simply appears without an entrance
  // animation via its CSS defaults.
  const core = await loadGsap().catch((ex) => {
    getConfig().log(ex);
    return null;
  });
  if (!core) return;
  const slide = modal.querySelectorAll('.qi-modal-slide')[index];
  const tl = core.gsap.timeline({ defaults: { ease: 'power2.out' } });
  tl.fromTo(modal.querySelector('.qi-modal-content'), { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 });
  tl.fromTo(modal.querySelector('.qi-modal-close svg'), { rotate: 0 }, { rotate: 45, duration: 0.5 }, '<');
  tl.fromTo(modal.querySelector('.qi-modal-backdrop'), { opacity: 0 }, { opacity: 1 }, '<+0.3');
  if (slide) tl.fromTo(slide, { '--item-progress': 0 }, { '--item-progress': 1, duration: 0.4 }, '<');
};
