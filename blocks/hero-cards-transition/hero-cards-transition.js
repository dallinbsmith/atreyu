// Hero - Cards Transition: vanilla port of Falkor's heroCardsTransition. A
// 150vh-tall section pins a wall of vapor-styled creator-clip cards (image +
// chin: title · author · date) behind a centered title lockup. Cards stagger in
// via a clip-path circle reveal then parallax upward as the reader scrolls.
// `--progress` (scroll engine) and `--card-entry-progress` (typed @property
// tweened by a CSS transition staggered from `--from-center`) drive every
// animation in CSS — GSAP-style sequencing without GSAP. RM → static.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { shouldAnimate, onReveal } from '../../scripts/utils/motion.js';
import { trackScrollProgress } from '../../scripts/utils/scroll.js';

const MAX_CARDS = 12;
const CENTER = (MAX_CARDS - 1) / 2;

// Self-hosted creator-clip stills, colocated for same-origin/CSP-safe delivery.
const POSTERS = [
  'hud-trapped', 'turmoil', 'night-silhouettes', 'hazy-recollections', 'lonely-highway',
  'wanderer', 'midnight-journey', 'cryogenic-battles', 'shadowy-figure', 'delivery',
];
const posterUrl = (n) => new URL(`./img/${n}.webp`, import.meta.url).href;

// "2025-03-14" → "March 14, 2025"; non-dates pass through so plain chin text survives.
const fmtDate = (s) => {
  const d = s && new Date(s);
  return !d || Number.isNaN(d.getTime()) ? (s ?? '')
    : d.toLocaleDateString(document.documentElement.lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// Parsed once; cloned per tile. Author-provided chin text lands via textContent
// so no innerHTML round-trip ever touches author input (no XSS surface).
const TILE_TPL = document.createElement('template');
TILE_TPL.innerHTML = '<div class="hc-tile"><div class="hc-media"><div class="hc-media-inner"></div></div><div class="hc-chin" hidden><span class="hc-chin-title"></span><div class="hc-chin-row"><span class="hc-chin-sub"><span class="hc-chin-author"></span><span class="hc-chin-date"></span></span><span class="icon icon-more hc-more"></span></div></div></div>';

// Text-only rows fold into the title lockup; rows with a picture yield cards.
// A card row's sibling cells become the chin (title | author | date) — mirrors
// Falkor's heroCardsTransition card schema.
const collect = (el) => {
  const text = [];
  const cards = [];
  [...el.children].forEach((row) => {
    const cells = [...row.children];
    const pics = [...row.querySelectorAll('picture, img')].map((p) => p.closest('picture') ?? p);
    if (!pics.length) text.push(row);
    else if (pics.length === 1) {
      const picCell = cells.find((c) => c.contains(pics[0]));
      cards.push({ pic: pics[0], chin: cells.filter((c) => c !== picCell) });
    } else pics.forEach((p) => cards.push({ pic: p, chin: [] }));
  });
  return { text, cards };
};

const buildTile = (i, card) => {
  const tile = TILE_TPL.content.firstElementChild.cloneNode(true);
  tile.style.cssText = `--i:${i};--from-center:${Math.abs(i - CENTER)};--from-edge:${CENTER - Math.abs(i - CENTER)}`;
  const [title = '', author = '', date = ''] = (card?.chin ?? []).map((c) => c.textContent.trim());
  tile.querySelector('.hc-media-inner').append(card?.pic ?? Object.assign(new Image(), {
    src: posterUrl(POSTERS[i % POSTERS.length]), alt: '', loading: 'lazy', decoding: 'async',
  }));
  if (title || author || date) {
    const chin = tile.querySelector('.hc-chin');
    chin.hidden = false;
    chin.querySelector('.hc-chin-title').textContent = title;
    chin.querySelector('.hc-chin-author').textContent = author;
    chin.querySelector('.hc-chin-date').textContent = fmtDate(date);
  }
  return tile;
};

export default (el) => {
  el.classList.add('hero-cards-transition');
  const { text: textRows, cards } = collect(el);

  const text = document.createElement('div');
  text.className = 'hc-text';
  textRows.forEach((t) => [...t.querySelectorAll('h1, h2, h3, p')].forEach((n) => text.append(n)));
  text.querySelector('h1, h2')?.classList.add('hc-title');
  [...text.querySelectorAll('p')].forEach((p) => {
    if (!p.querySelector('a') && !p.textContent.trim().startsWith('[[')) p.classList.add('hc-body');
  });
  const cta = [...text.querySelectorAll('p')].find((p) => p.querySelector('a'));
  if (cta) {
    cta.classList.add('hc-cta');
    [...cta.querySelectorAll('a')].forEach((a, i) => {
      a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
    });
  }

  const wall = document.createElement('div');
  wall.className = 'hc-wall';
  wall.setAttribute('aria-hidden', 'true');
  const n = Math.max(cards.length, MAX_CARDS);
  Array.from({ length: n }, (_, i) => wall.append(buildTile(i, cards[i])));

  const stage = document.createElement('div');
  stage.className = 'hc-stage';
  stage.append(wall, text);
  el.replaceChildren(stage);
  decorateRichText(el);

  if (!shouldAnimate()) return;
  el.classList.add('hc-scrub');
  trackScrollProgress(el);
  onReveal(el, () => el.classList.add('hc-in'), { threshold: 0 });
};
