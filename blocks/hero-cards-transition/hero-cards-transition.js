// Hero - Cards Transition: vanilla port of Falkor's heroCardsTransition. A pinned
// 150vh wall of vapor cards (image + chin: title · author · date) behind a title
// lockup. Cards stagger in via clip-path reveal then parallax on scroll; CSS
// `--progress` + typed `--card-entry-progress` drive everything. RM → static.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { shouldAnimate, onReveal } from '../../scripts/utils/motion.js';
import { trackScrollProgress } from '../../scripts/utils/scroll.js';

const MAX_CARDS = 12;
const CENTER = (MAX_CARDS - 1) / 2;

// Creator-clip stills + decorative chin defaults — cycled when the authored card
// list runs out. Mirrors Falkor's frame.io vapor-card aesthetic so the wall
// always reads as a "creator workspace" even with zero authored chin metadata.
const POSTERS = [
  { slug: 'hud-trapped', title: 'HUD: Trapped', author: 'Lily Snow', date: '2024-03-26' },
  { slug: 'turmoil', title: 'Turmoil', author: 'Marcus Vega', date: '2024-04-12' },
  { slug: 'night-silhouettes', title: 'Night Silhouettes', author: 'Aria Chen', date: '2024-02-18' },
  { slug: 'hazy-recollections', title: 'Hazy Recollections', author: 'James Wright', date: '2024-05-04' },
  { slug: 'lonely-highway', title: 'Lonely Highway', author: 'Sofia Reyes', date: '2024-01-22' },
  { slug: 'wanderer', title: 'Wanderer', author: 'Theo Park', date: '2024-06-09' },
  { slug: 'midnight-journey', title: 'Midnight Journey', author: 'Nora Vance', date: '2024-03-15' },
  { slug: 'cryogenic-battles', title: 'Cryogenic Battles', author: 'Kai Mori', date: '2024-04-28' },
  { slug: 'shadowy-figure', title: 'Shadowy Figure', author: 'Eva Lin', date: '2024-05-19' },
  { slug: 'delivery', title: 'Delivery', author: 'Owen Hart', date: '2024-02-07' },
];
const posterUrl = (slug) => new URL(`./img/${slug}.webp`, import.meta.url).href;
const fmtDate = (s) => {
  const d = s && new Date(s);
  return !d || Number.isNaN(d.getTime()) ? (s ?? '')
    : d.toLocaleDateString(document.documentElement.lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// Parsed once; cloned per tile. Author-provided chin text lands via textContent
// so no innerHTML round-trip ever touches author input (no XSS surface).
const TILE_TPL = document.createElement('template');
TILE_TPL.innerHTML = '<div class="hc-tile"><div class="hc-media"><div class="hc-media-inner"></div></div><div class="hc-chin"><span class="hc-chin-title"></span><div class="hc-chin-row"><span class="hc-chin-sub"><span class="hc-chin-author"></span><span class="hc-chin-date"></span></span><span class="icon icon-more hc-more"></span></div></div></div>';

// Text-only rows fold into the title lockup; rows with a picture yield cards.
// A card row's sibling cells become the chin (title | author | date).
const collect = (el) => {
  const text = [];
  const cards = [];
  let bg = null;
  [...el.children].forEach((row) => {
    const cells = [...row.children];
    // dedupe: querySelectorAll matches both <picture> and its inner <img>, which
    // closest('picture') collapses to the same node — Set keeps each picture once
    const pics = [...new Set([...row.querySelectorAll('picture, img')].map((p) => p.closest('picture') ?? p))];
    if (!pics.length) text.push(row);
    // a lone image with no sibling chin text is the section background (Falkor's
    // `background` field), not a card — the first such row wins
    else if (pics.length === 1 && !bg && !cells.some((c) => c.textContent.trim())) [bg] = pics;
    else if (pics.length === 1) {
      const picCell = cells.find((c) => c.contains(pics[0]));
      cards.push({ pic: pics[0], chin: cells.filter((c) => c !== picCell) });
    } else pics.forEach((p) => cards.push({ pic: p, chin: [] }));
  });
  return { bg, text, cards };
};

const buildTile = (i, card) => {
  const tile = TILE_TPL.content.firstElementChild.cloneNode(true);
  tile.style.cssText = `--i:${i};--from-center:${Math.abs(i - CENTER)};--from-edge:${CENTER - Math.abs(i - CENTER)}`;
  const fallback = POSTERS[i % POSTERS.length];
  const [aTitle, aAuthor, aDate] = (card?.chin ?? []).map((c) => c.textContent.trim());
  tile.querySelector('.hc-media-inner').append(card?.pic ?? Object.assign(new Image(), {
    src: posterUrl(fallback.slug), alt: '', loading: 'lazy', decoding: 'async',
  }));
  const chin = tile.querySelector('.hc-chin');
  chin.querySelector('.hc-chin-title').textContent = aTitle || fallback.title;
  chin.querySelector('.hc-chin-author').textContent = aAuthor || fallback.author;
  chin.querySelector('.hc-chin-date').textContent = fmtDate(aDate || fallback.date);
  return tile;
};

export default (el) => {
  el.classList.add('hero-cards-transition');
  const { bg, text: textRows, cards } = collect(el);

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
  if (bg) {
    const bgEl = document.createElement('div');
    bgEl.className = 'hc-bg';
    bgEl.setAttribute('aria-hidden', 'true');
    bgEl.append(bg);
    stage.append(bgEl);
  }
  stage.append(wall, text);
  el.replaceChildren(stage);
  decorateRichText(el);

  if (!shouldAnimate()) return;
  el.classList.add('hc-scrub');
  trackScrollProgress(el);
  onReveal(el, () => el.classList.add('hc-in'), { threshold: 0 });
};
