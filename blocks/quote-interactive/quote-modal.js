import { withGsap } from '../../scripts/utils/motion/gsap-loader.js';
import { announce } from '../../scripts/utils/a11y.js';
import { wireModalClose, openModal, closeModal } from '../../scripts/utils/modal/modal.js';

const plusIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const arrow = (prev) => `<span class="qi-modal-arrow${prev ? ' qi-modal-arrow-prev' : ''}"><svg viewBox="0 0 32.2 54.4" fill="currentColor"><path d="M30.8,23.6c2,2,2,5.1,0,7.1L8.6,52.9c-1.9,2-5.1,2-7.1,0c-2-1.9-2-5.1,0-7.1l18.7-18.7L1.5,8.5c-1.9-2-1.8-5.2,.1-7.1c1.9-1.9,5-1.9,6.9,0Z"/></svg></span>`;

let modal = null;
let releaseTrap = null;
let current = 0;
let triggerTab = null;
let count = 0;

const updateNav = () => {
  const prev = modal?.querySelector('.qi-modal-prev');
  const next = modal?.querySelector('.qi-modal-next');
  if (prev) prev.disabled = current === 0;
  if (next) next.disabled = current === count - 1;
};

const goTo = (i) => {
  current = Math.max(0, Math.min(i, count - 1));
  modal.querySelector('.qi-modal-track').style.setProperty('--carousel-index', current);
  updateNav();
  announce(`Slide ${current + 1} of ${count}`);
};

const close = () => {
  if (!modal) return;
  const content = modal.querySelector('.qi-modal-content');
  const finish = () => {
    closeModal(modal, releaseTrap, triggerTab);
    modal = null;
  };
  const animated = withGsap(({ gsap }) => {
    gsap.to(content, {
      scale: 0.95, opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: finish,
    });
  });
  if (!animated) finish();
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
    const btn = Object.assign(document.createElement('button'), {
      className: `qi-modal-${cls}`,
      innerHTML: isPrev ? `${arrow(true)}<span>${label}</span>` : `<span>${label}</span>${arrow(false)}`,
    });
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

export const initModal = (blockEl, tabs, slides) => {
  count = slides.length;
  return (index) => {
    if (modal) {
      goTo(index);
      return;
    }
    modal = buildModal(slides);
    current = index;
    modal.querySelector('.qi-modal-track').style.setProperty('--carousel-index', index);
    releaseTrap = openModal(modal, '.qi-modal-close');
    triggerTab = tabs[index];
    updateNav();
    announce(`Quote carousel opened, slide ${index + 1} of ${count}`);
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
};
