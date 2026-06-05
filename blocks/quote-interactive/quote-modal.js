import { withGsap } from '../../scripts/utils/gsap-loader.js';
import { trapFocus, announce } from '../../scripts/utils/a11y.js';

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
    releaseTrap?.();
    modal.remove();
    document.body.style.overflow = '';
    triggerTab?.focus();
    modal = null;
  };
  const animated = withGsap(({ gsap }) => {
    gsap.to(content, {
      scale: 0.95, opacity: 0, duration: 0.35, ease: 'power2.out', onComplete: finish,
    });
  });
  if (!animated) finish();
};

const makeSlide = ({ pic, category, quoteHTML, attrHTML }) => {
  const el = document.createElement('div');
  el.className = 'qi-modal-slide';
  const bg = document.createElement('div');
  bg.className = 'qi-modal-slide-bg';
  if (pic) bg.append(pic.cloneNode(true));
  bg.append(Object.assign(document.createElement('div'), { className: 'qi-modal-scrim' }));
  const body = document.createElement('div');
  body.className = 'qi-modal-slide-body';
  const eye = Object.assign(document.createElement('span'), { className: 'qi-modal-eyebrow', textContent: category });
  const bq = Object.assign(document.createElement('blockquote'), { className: 'qi-modal-quote', innerHTML: quoteHTML });
  const fc = Object.assign(document.createElement('figcaption'), { className: 'qi-modal-attr', innerHTML: attrHTML });
  body.append(eye, bq, fc);
  el.append(bg, body);
  return el;
};

const buildModal = (slides) => {
  const el = document.createElement('div');
  el.className = 'qi-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Customer quotes');

  const backdrop = Object.assign(document.createElement('div'), { className: 'qi-modal-backdrop' });
  backdrop.addEventListener('click', close);

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

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') {
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
    document.body.append(modal);
    document.body.style.overflow = 'hidden';
    releaseTrap = trapFocus(modal);
    modal.querySelector('.qi-modal-close').focus();
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
