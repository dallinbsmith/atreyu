// Camera-to-Cloud hero: a centered eyebrow + large two-tone title over a montage
// wall of creator clips. Faithful port of Falkor's heroCardsTransition WITHOUT
// GSAP or scroll-pinning libraries: a tall section with a pinned stage, where a
// single 0..1 `--progress` (set by the shared scroll engine) drives CSS-only,
// compositor-friendly transforms — per-column parallax (--ratio), wall dim, and
// text fade-out — plus a one-time staggered entry reveal on the tiles. The title
// renders immediately (LCP-safe); the animation is lazy + motion-gated, falling
// back to a static montage. `--progress` is a typed @property, so it can later be
// driven natively by `animation-timeline: view()` with zero JS where supported.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { shouldAnimate, onReveal } from '../../scripts/utils/motion.js';
import { trackScrollProgress } from '../../scripts/utils/scroll.js';

const COLS = 6;
// per-column parallax speed — outer columns drift faster (mirrors Falkor)
const RATIOS = [0.85, 0.4, 0.2, 0.2, 0.4, 0.85];

// Self-hosted creator-clip stills (pulled from Sanity, optimized to webp and
// colocated so they serve same-origin/CSP-safe via the code bus). Used to fill
// the montage wall when the author hasn't supplied imagery.
const POSTERS = [
  'hud-trapped', 'turmoil', 'night-silhouettes', 'hazy-recollections', 'lonely-highway',
  'wanderer', 'midnight-journey', 'cryogenic-battles', 'shadowy-figure', 'delivery',
];
const posterUrl = (name) => new URL(`./img/${name}.webp`, import.meta.url).href;

export default (el) => {
  el.classList.add('hero-cards');
  const pics = [...el.querySelectorAll('picture, img')].map((p) => p.closest('picture') ?? p);

  const text = document.createElement('div');
  text.className = 'hc-text';
  [...el.querySelectorAll('h1, h2, h3, p')].forEach((node) => {
    if (!node.querySelector('picture, img')) text.append(node);
  });
  text.querySelector('h1, h2')?.classList.add('hc-title');

  // subcopy paragraph(s): non-link, non-marker text under the title
  [...text.querySelectorAll('p')].forEach((p) => {
    if (!p.querySelector('a') && !p.textContent.trim().startsWith('[[')) p.classList.add('hc-body');
  });

  // CTA row: the paragraph holding link(s) → filled primary + ghost secondary
  const cta = [...text.querySelectorAll('p')].find((p) => p.querySelector('a'));
  if (cta) {
    cta.classList.add('hc-cta');
    [...cta.querySelectorAll('a')].forEach((a, i) => a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-secondary'));
  }

  const wall = document.createElement('div');
  wall.className = 'hc-wall';
  wall.setAttribute('aria-hidden', 'true');
  const count = Math.max(pics.length, 12);
  Array.from({ length: count }, (_, i) => i).forEach((i) => {
    const col = i % COLS;
    const tile = document.createElement('div');
    tile.className = 'hc-tile';
    tile.style.setProperty('--col', col);
    tile.style.setProperty('--ratio', RATIOS[col]);
    tile.style.setProperty('--i', i);
    if (pics[i]) {
      tile.append(pics[i]);
    } else {
      const img = new Image();
      img.src = posterUrl(POSTERS[i % POSTERS.length]);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      tile.append(img);
    }
    wall.append(tile);
  });

  const stage = document.createElement('div');
  stage.className = 'hc-stage';
  stage.append(wall, text);
  el.replaceChildren(stage);
  decorateRichText(el);

  if (!shouldAnimate()) return; // reduced motion / save-data → static montage

  el.classList.add('hc-scrub'); // opts into the tall pinned-scrub layout
  trackScrollProgress(el); // maintains --progress (0..1) on el while in view
  onReveal(el, () => el.classList.add('hc-in'), { threshold: 0 }); // one-time entry
};
