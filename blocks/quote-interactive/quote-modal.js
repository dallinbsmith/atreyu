import { withGsap } from '../../scripts/utils/gsap-loader.js';
import { trapFocus, announce } from '../../scripts/utils/a11y.js';

const svg = (d, attrs = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${attrs}><path d="${d}"/></svg>`;
const plusIcon = svg('M12 5v14M5 12h14');

let modal = null;
let releaseTrap = null;
let current = 0;
let triggerTab = null;
let count = 0;

const goTo = (i) => {
  current = ((i % count) + count) % count;
  modal.querySelector('.qi-modal-track').style.setProperty('--carousel-index', current);
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
  [['prev', 'M15 6l-6 6 6 6', -1], ['next', 'M9 6l6 6-6 6', 1]].forEach(([cls, d, dir]) => {
    const btn = Object.assign(document.createElement('button'), {
      className: `qi-modal-${cls}`, innerHTML: svg(d),
    });
    btn.setAttribute('aria-label', `${cls === 'prev' ? 'Previous' : 'Next'} slide`);
    btn.addEventListener('click', () => goTo(current + dir));
    nav.append(btn);
  });

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
