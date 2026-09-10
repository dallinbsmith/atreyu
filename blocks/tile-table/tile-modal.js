import { announce } from '../../scripts/utils/a11y.js';
import {
  parseSvg, createElement, CLOSE_SVG, CHEVRON_LINE_SVG,
} from '../../scripts/utils/dom.js';
import {
  wireModalClose, openModal, closeModal, clampIndex,
} from '../../scripts/utils/modal/modal.js';

const iconButton = (cls, label, glyph) => {
  const btn = createElement('button', { className: cls, 'aria-label': label });
  btn.append(parseSvg(glyph));
  return btn;
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
    current = clampIndex(i, items.length);
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
    closeModal(modal, releaseFocus, triggerEl);
    announce('Partner details closed');
  };

  const build = () => {
    nameEl = createElement('h3', { className: 'tt-modal-name' });
    detailEl = createElement('p', { className: 'tt-modal-detail' });
    linkEl = createElement('a', {
      className: 'btn btn-secondary', target: '_blank', rel: 'noopener noreferrer',
    });
    counterEl = createElement('span', { className: 'tt-modal-counter' });
    prevBtn = iconButton('tt-modal-prev', 'Previous', CHEVRON_LINE_SVG);
    nextBtn = iconButton('tt-modal-next', 'Next', CHEVRON_LINE_SVG);
    const closeBtn = iconButton('tt-modal-close', 'Close', CLOSE_SVG);

    const body = createElement('div', { className: 'tt-modal-body' }, nameEl, detailEl, linkEl);
    const nav = createElement('div', { className: 'tt-modal-nav' }, prevBtn, counterEl, nextBtn);
    const card = createElement('div', { className: 'tt-modal-card' }, closeBtn, body, nav);
    const backdrop = createElement('div', { className: 'tt-modal-backdrop' });
    modal = createElement('div', { className: 'tt-modal' }, backdrop, card);

    prevBtn.addEventListener('click', () => setSlide(current - 1));
    nextBtn.addEventListener('click', () => setSlide(current + 1));
    closeBtn.addEventListener('click', close);
    wireModalClose(modal, backdrop, close);
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && current > 0) setSlide(current - 1);
      else if (e.key === 'ArrowRight' && current < items.length - 1) setSlide(current + 1);
    });
  };

  return (index, trigger) => {
    if (!modal) build();
    triggerEl = trigger;
    setSlide(index);
    releaseFocus = openModal(modal, '.tt-modal-close');
    announce(`${items[index].name}, partner ${index + 1} of ${items.length}`);
  };
};
