// Hero - Cards Transition: vanilla port of Falkor's heroCardsTransition. A pinned
// wall of vapor cards (image + chin: title · author · date), height set by the
// shared --hero-scrub-stage-height token (styles.css), behind a title lockup.
// Cards stagger in via clip-path reveal then parallax on scroll; CSS
// `--progress` + typed `--card-entry-progress` drive everything. RM → static.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { shouldAnimate, onReveal } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';
import { parseSvg } from '../../scripts/utils/dom.js';

// Fixed, code-owned "more" glyph for the chin — not an author-typed `:iconname:`
// icon (see .claude/rules/assets.md category 2), so it's a local SVG constant
// parsed via parseSvg() (carousel.js's CHEVRON_SVG pattern), not a `span.icon`
// upgraded by scripts/utils/icons.js. That generic mechanism only upgrades icons
// present in the DOM when ak.js's loadIcons() runs, which is BEFORE this block's
// own decorate() (and therefore buildTile()) ever executes — a span.icon created
// here would stay a permanently-empty box. Content mirrors icons/more.svg (the
// dot this glyph represents has no other :iconname: consumer in this codebase).
const MORE_SVG = '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M128,148c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M128,72c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M128,224c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M52,148c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M52,224c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M52,72c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M204,148c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M204,224c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/><path d="M204,72c-11.03,0-20-8.97-20-20s8.97-20,20-20,20,8.97,20,20-8.97,20-20,20Z"/></svg>';

// 12 (MAX_CARDS) is also hardcoded as the CSS's literal `:nth-child(1)` through
// `:nth-child(12)` column-position selectors, and its scrub-mode `nth-child(n + 7)`
// mobile cutoff — two independent sources of truth for the same "12 tiles" fact.
// Changing this value alone does not change how many columns the CSS lays out.
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
const posterUrl = (slug) => new URL(`./${slug}.webp`, import.meta.url).href;
const fmtDate = (s) => {
  const d = s && new Date(s);
  return !d || Number.isNaN(d.getTime()) ? (s ?? '')
    : d.toLocaleDateString(document.documentElement.lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// Parsed once; cloned per tile. Author-provided chin text lands via textContent
// so no innerHTML round-trip ever touches author input (no XSS surface).
const TILE_TPL = document.createElement('template');
TILE_TPL.innerHTML = '<div class="hc-tile"><div class="hc-media"><div class="hc-media-inner"></div></div><div class="hc-chin"><span class="hc-chin-title"></span><div class="hc-chin-row"><span class="hc-chin-sub"><span class="hc-chin-author"></span><span class="hc-chin-date"></span></span></div></div></div>';

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
  tile.style.cssText = `--from-center:${Math.abs(i - CENTER)}`;
  const fallback = POSTERS[i % POSTERS.length];
  const [aTitle, aAuthor, aDate] = (card?.chin ?? []).map((c) => c.textContent.trim());
  tile.querySelector('.hc-media-inner').append(card?.pic ?? Object.assign(new Image(), {
    src: posterUrl(fallback.slug), alt: '', loading: 'lazy', decoding: 'async',
  }));
  const chin = tile.querySelector('.hc-chin');
  chin.querySelector('.hc-chin-title').textContent = aTitle || fallback.title;
  chin.querySelector('.hc-chin-author').textContent = aAuthor || fallback.author;
  chin.querySelector('.hc-chin-date').textContent = fmtDate(aDate || fallback.date);
  const more = parseSvg(MORE_SVG);
  more.setAttribute('class', 'hc-more'); more.setAttribute('aria-hidden', 'true');
  chin.querySelector('.hc-chin-row').append(more);
  return tile;
};

export default (el) => {
  // Idempotency guard: a second decorate(el) call would run collect() against
  // this block's own already-rendered `.hc-stage` output (querySelectorAll
  // isn't scoped past "descendant of this row", so it re-matches every
  // rendered tile <img>) instead of the original authored rows, misclassifying
  // the wall as multi-picture and silently discarding the real title/CTA. It
  // would also register a second scroll-tracking entry and IntersectionObserver
  // with no cleanup. Matches side-by-side.js's `dataset.sbs` guard pattern.
  if (el.dataset.hct) return; el.dataset.hct = 'true';

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
      if (!a.classList.contains('btn')) a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary');
    });
  }

  const wall = document.createElement('div');
  wall.className = 'hc-wall';
  wall.setAttribute('aria-hidden', 'true');
  // NOTE: cards beyond MAX_CARDS behave inconsistently today — scrub mode
  // silently hides them (CSS `nth-child(n + 7)`) while resting mode shows all
  // of them in an unbounded grid. Deliberately left as-is: which behavior is
  // "correct" needs a product decision informed by real authored content, not
  // a code-only fix.
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
  // Cleanup handle intentionally discarded: `el` lives for the page's full
  // lifetime (EDS is full-page-load, no client routing) — there's no removal
  // hook to call it from today.
  trackScrollProgress(el);
  onReveal(el, () => el.classList.add('hc-in'), { threshold: 0 });
};
