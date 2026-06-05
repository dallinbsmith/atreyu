import { trapFocus, announce } from '../../scripts/utils/a11y.js';

const CLOSE_SVG = '<svg viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const ARROW_SVG = '<svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const makeEl = (tag, cls, attrs = {}) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  return e;
};

export const initTileModal = (items) => {
  let modal;
  let nameEl;
  let detailEl;
  let linkEl;
  let counterEl;
  let prevBtn;
  let nextBtn;
  let current = 0;
  let releaseFocus;
  let triggerEl;

  const setSlide = (i) => {
    current = Math.max(0, Math.min(i, items.length - 1));
    const item = items[current];
    nameEl.textContent = item.name;
    detailEl.textContent = item.detail;
    linkEl.href = item.href;
    linkEl.textContent = item.linkText || `Visit ${item.name}`;
    linkEl.hidden = !item.href;
    counterEl.textContent = `${current + 1} of ${items.length}`;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === items.length - 1;
  };

  const close = () => {
    modal.remove();
    document.body.style.overflow = '';
    releaseFocus?.();
    triggerEl?.focus();
    announce('Partner details closed');
  };

  const build = () => {
    modal = makeEl('div', 'tt-modal');
    const backdrop = makeEl('div', 'tt-modal-backdrop');
    const card = makeEl('div', 'tt-modal-card');
    const closeBtn = makeEl('button', 'tt-modal-close', { 'aria-label': 'Close' });
    closeBtn.innerHTML = CLOSE_SVG;
    const body = makeEl('div', 'tt-modal-body');
    nameEl = makeEl('h3', 'tt-modal-name');
    detailEl = makeEl('p', 'tt-modal-detail');
    linkEl = makeEl('a', 'btn btn-secondary', { target: '_blank', rel: 'noopener noreferrer' });
    const nav = makeEl('div', 'tt-modal-nav');
    prevBtn = makeEl('button', 'tt-modal-prev', { 'aria-label': 'Previous' });
    prevBtn.innerHTML = ARROW_SVG;
    counterEl = makeEl('span', 'tt-modal-counter');
    nextBtn = makeEl('button', 'tt-modal-next', { 'aria-label': 'Next' });
    nextBtn.innerHTML = ARROW_SVG;

    body.append(nameEl, detailEl, linkEl);
    nav.append(prevBtn, counterEl, nextBtn);
    card.append(closeBtn, body, nav);
    modal.append(backdrop, card);

    prevBtn.addEventListener('click', () => setSlide(current - 1));
    nextBtn.addEventListener('click', () => setSlide(current + 1));
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && current > 0) setSlide(current - 1);
      else if (e.key === 'ArrowRight' && current < items.length - 1) setSlide(current + 1);
    });
  };

  return (index, trigger) => {
    if (!modal) build();
    triggerEl = trigger;
    setSlide(index);
    document.body.append(modal);
    document.body.style.overflow = 'hidden';
    releaseFocus = trapFocus(modal);
    modal.querySelector('.tt-modal-close').focus();
    announce(`${items[index].name}, partner ${index + 1} of ${items.length}`);
  };
};
