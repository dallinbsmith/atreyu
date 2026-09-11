// Full-bleed hero: picture cell → background (optional looping mp4),
// remaining cells → foreground. Cell-level, not row-level (F-66).
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { createElement, getCells, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

const isText = (cell) => cell.querySelector(`${HEADING_SELECTOR}, p, a, ul`);

const decorateForeground = (fg, hero) => {
  const cells = [...fg.children];
  for (const cell of cells) {
    cell.querySelector('.rt-eyebrow')?.closest('p')?.classList.add('hero-detail');
    cell.querySelector(HEADING_SELECTOR)?.classList.add('hero-heading');
    if (isText(cell)) cell.classList.add('fg-text');
  }
  const textIdx = cells.findIndex(isText);
  if (textIdx === -1) return;
  hero.classList.toggle('hero-text-start', textIdx === 0);
  hero.classList.toggle('hero-text-end', textIdx !== 0);
};

export default (el) => {
  if (el.dataset.heroDecorated) return;
  el.dataset.heroDecorated = 'true';

  const cells = getCells(el);
  const bgCell = cells.find((c) => c.querySelector('picture'));
  const extra = cells.filter((c) => c !== bgCell);

  const fg = createElement('div', { className: 'hero-foreground' }, ...extra);
  decorateRichText(fg); // before decorateForeground so .rt-eyebrow exists
  decorateForeground(fg, el);
  wireVideoModalLinks(fg);

  const bg = bgCell && createElement('div', { className: 'hero-background' }, ...bgCell.children);
  if (bg) decorateVideoMedia(bg);
  el.replaceChildren(...(bg ? [bg] : []), fg);
};
