// Hero - Cards Transition: pinned vapor-card wall behind a title lockup.
// `--progress` + `--card-entry-progress` live in CSS; RM stays on the resting grid.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { shouldAnimate, onReveal } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { createElement, classifyCtaParagraphs, parseSvg, HEADING_SELECTOR, MORE_SVG } from '../../scripts/utils/dom.js';
import { POSTERS, posterUrl } from './posters/catalog.js';

// Also hardcoded as CSS `:nth-child(1)`–`(12)` and mobile `nth-child(n + 7)`.
const MAX_CARDS = 12;

const fmtDate = (s) => {
  const d = s && new Date(s);
  return !d || Number.isNaN(d.getTime()) ? (s ?? '')
    : d.toLocaleDateString(document.documentElement.lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// Shape every row once, then split: no pics → lockup text; first lone image
// with no chin text → background; every other pictured row → cards.
const collect = (el) => {
  const shaped = [...el.children].map((row) => ({
    row,
    cells: [...row.children],
    pics: [...row.querySelectorAll('picture, img')].filter((n) => n.matches('picture') || !n.closest('picture')),
  }));
  const { text = [], pictured = [] } = Object.groupBy(shaped, ({ pics }) => (pics.length ? 'pictured' : 'text'));
  const bgRow = pictured.find(({ cells, pics }) => pics.length === 1
    && !cells.some((c) => c.textContent.trim()));
  return {
    bg: bgRow?.pics[0] ?? null,
    text: text.map(({ row }) => row),
    cards: pictured.filter((r) => r !== bgRow).flatMap(({ cells, pics }) => pics.map((pic) => ({
      pic,
      chin: pics.length === 1 ? cells.filter((c) => !c.contains(pic)) : [],
    }))),
  };
};

const buildTile = (i, card) => {
  const fallback = POSTERS[i % POSTERS.length];
  const [aTitle, aAuthor, aDate] = (card?.chin ?? []).map((c) => c.textContent.trim());
  const more = parseSvg(MORE_SVG);
  more.setAttribute('class', 'hc-more'); more.setAttribute('aria-hidden', 'true');
  const pic = card?.pic ?? createElement('img', {
    src: posterUrl(fallback.slug), alt: '', loading: 'lazy', decoding: 'async',
  });
  const sub = createElement(
    'span',
    { className: 'hc-chin-sub' },
    createElement('span', { className: 'hc-chin-author' }, aAuthor || fallback.author),
    createElement('span', { className: 'hc-chin-date' }, fmtDate(aDate || fallback.date)),
  );
  const chin = createElement(
    'div',
    { className: 'hc-chin' },
    createElement('span', { className: 'hc-chin-title' }, aTitle || fallback.title),
    createElement('div', { className: 'hc-chin-row' }, sub, more),
  );
  const tile = createElement(
    'div',
    { className: 'hc-tile' },
    createElement(
      'div',
      { className: 'hc-media' },
      createElement('div', { className: 'hc-media-inner' }, pic),
    ),
    chin,
  );
  tile.style.setProperty('--from-center', Math.abs(i - (MAX_CARDS - 1) / 2));
  return tile;
};

const buildText = (textRows) => {
  const text = createElement('div', { className: 'hc-text' }, ...textRows.flatMap((row) => [...row.querySelectorAll(`${HEADING_SELECTOR}, p`)]));
  text.querySelector(HEADING_SELECTOR)?.classList.add('hc-title');
  classifyCtaParagraphs(text, 'hc-cta');
  [...text.querySelectorAll('.hc-cta a')].forEach((a, i) => {
    if (!a.classList.contains('btn')) a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
  });
  return text;
};

// Cards past MAX_CARDS: scrub CSS hides nth-child(n+7), resting grid shows
// all — product call, not a code-only fix.
const buildWall = (cards) => {
  const wall = createElement('div', { className: 'hc-wall', 'aria-hidden': 'true' });
  for (const i of [...Array(Math.max(cards.length, MAX_CARDS)).keys()]) {
    wall.append(buildTile(i, cards[i]));
  }
  return wall;
};

export default (el) => {
  if (el.dataset.hct) return;
  el.dataset.hct = 'true';
  el.classList.add('hero-cards-transition');
  const { bg, text: textRows, cards } = collect(el);
  el.replaceChildren(createElement(
    'div',
    { className: 'hc-stage' },
    bg && createElement('div', { className: 'hc-bg', 'aria-hidden': 'true' }, bg),
    buildWall(cards),
    buildText(textRows),
  ));
  decorateRichText(el);
  if (!shouldAnimate()) return;
  el.classList.add('hc-scrub');
  // Cleanup discarded: no client routing, so `el` lives for the page lifetime.
  trackScrollProgress(el);
  onReveal(el, () => el.classList.add('hc-in'), { threshold: 0 });
};
