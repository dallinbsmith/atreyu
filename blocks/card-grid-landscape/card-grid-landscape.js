// Card grid: a horizontally-scrolling slider below 768px, a static wrapping
// grid at 768px+ — the inverse of carousel.js's always-a-slider behavior.
// Ported from Falkor's real CardGridLandscapeSquare (keen-slider, disabled
// above its own md breakpoint) — same responsive intent, CSS scroll-snap +
// vanilla JS instead of keen-slider. Per-card shape (media/logo/title/body)
// and column-unwrap both mirror carousel.js's identical pattern; `square`
// variant just hides the logo/group-title markup in CSS.
import { decorateTout, extractRowMedia } from '../../scripts/utils/touts.js';
import { getPlaceholder } from '../../scripts/utils/placeholders.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { announce } from '../../scripts/utils/a11y.js';
import { createElement, HEADING_SELECTOR } from '../../scripts/utils/dom.js';

// Group title: a lone-heading row with no media. Only ever checked at
// position 0, never scanned across every row — a shape-only check risks
// misclassifying a real, content-light card (blocks.md's F-66 family);
// restricting to the first row keeps that risk off every card past it.
// Known, accepted tradeoff pending real content (no Library example yet).
const isTitleRow = (row) => !row.querySelector('img, picture') && row.querySelector(HEADING_SELECTOR);

const buildCard = (row, idx) => {
  const originalCols = [...row.children];
  const { media, logo } = extractRowMedia(row);

  originalCols.forEach((col) => {
    row.append(...col.childNodes);
    col.remove();
  });

  decorateTout(row, 'card-grid-landscape-card', `card-grid-landscape-card-${idx}`);
  if (logo) {
    logo.classList.add('card-grid-landscape-logo');
    row.prepend(logo);
  }
  if (media) row.prepend(createElement('div', { className: 'card-grid-landscape-media' }, media));
};

// Tracks the snapped card by its own offsetLeft, not scrollLeft/clientWidth
// division — that formula only holds at full-viewport-width (carousel.js),
// not at 78%-width here. Also floors at 0, so iOS overscroll's negative
// scrollLeft can't push the index negative.
const activeIndex = (viewport, cards) => {
  const scrollLeft = Math.max(viewport.scrollLeft, 0);
  const start = cards[0].offsetLeft;
  let idx = 0;
  cards.forEach((card, i) => {
    if (card.offsetLeft - start <= scrollLeft + 1) idx = i;
  });
  return idx;
};

const buildDots = (viewport, cards, label) => {
  const dots = cards.map((card, i) => {
    const dot = createElement('button', { className: 'card-grid-landscape-dot', type: 'button' });
    dot.setAttribute('aria-label', label.replace('{current}', i + 1).replace('{total}', cards.length));
    dot.dataset.testid = `card-grid-landscape-dot-${i}`;
    dot.addEventListener('click', () => {
      card.scrollIntoView({ behavior: shouldAnimate() ? 'smooth' : 'auto', inline: 'start', block: 'nearest' });
    });
    return dot;
  });
  dots[0]?.classList.add('is-active');

  let timer;
  viewport.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const idx = activeIndex(viewport, cards);
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      announce(label.replace('{current}', idx + 1).replace('{total}', cards.length));
    }, 150);
  });

  return createElement('div', { className: 'card-grid-landscape-dots' }, ...dots);
};

export default async (el) => {
  if (!guardDecorate(el, 'cardGridLandscape')) return;

  const rows = [...el.children].filter((r) => r.textContent.trim() || r.querySelector('picture, img'));
  const titleRow = rows[0] && isTitleRow(rows[0]) ? rows[0] : null;
  const cardRows = rows.filter((r) => r !== titleRow);
  if (!cardRows.length) return;

  titleRow?.classList.add('card-grid-landscape-title');

  const dotLabel = await getPlaceholder('cardGridPosition', 'Go to card {current} of {total}');
  cardRows.forEach(buildCard);

  const track = createElement('div', { className: 'card-grid-landscape-track' }, ...cardRows);
  const viewport = createElement('div', { className: 'card-grid-landscape-viewport' }, track);
  const dots = buildDots(viewport, cardRows, dotLabel);

  el.replaceChildren(...(titleRow ? [titleRow] : []), viewport, dots);
};
