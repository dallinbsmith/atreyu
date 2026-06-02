// Camera-to-Cloud style hero: a centered eyebrow + large two-tone title set over
// a montage wall of creator clips. Frame.io's heroCardsTransition scrubs this
// wall through a GSAP scroll-pinned transition; EDS has no scroll-scrub primitive,
// so we present a static montage (the transition is the documented shortcoming).
import { decorateRichText } from '../../scripts/utils/richtext.js';

export default (el) => {
  el.classList.add('hero-cards');
  const pics = [...el.querySelectorAll('picture, img')].map((p) => p.closest('picture') ?? p);

  const text = document.createElement('div');
  text.className = 'hc-text';
  [...el.querySelectorAll('h1, h2, p')].forEach((node) => {
    if (!node.querySelector('picture, img')) text.append(node);
  });
  text.querySelector('h1, h2')?.classList.add('hc-title');

  const wall = document.createElement('div');
  wall.className = 'hc-wall';
  wall.setAttribute('aria-hidden', 'true');
  const count = Math.max(pics.length, 12);
  Array.from({ length: count }, (_, i) => {
    const tile = document.createElement('div');
    tile.className = 'hc-tile';
    tile.style.setProperty('--i', i % 6);
    if (pics[i]) tile.append(pics[i]);
    wall.append(tile);
    return tile;
  });

  el.replaceChildren(wall, text);
  decorateRichText(el);
};
