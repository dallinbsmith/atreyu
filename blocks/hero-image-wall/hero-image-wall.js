// Hero variant: a tiled wall of images behind foreground text content.
// Cell-level classification (F-66): any cell containing a <picture> is a
// wall tile; everything else is foreground text, mirroring hero.js.
// No wireVideoModalLinks here (unlike hero.js's foreground) — this variant's
// tiles are static images, not a video-modal trigger surface.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { createElement, getCells, HEADING_SELECTOR } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

const decorateForeground = (fg) => {
  for (const cell of fg.children) {
    cell.querySelector(HEADING_SELECTOR)?.classList.add('hero-image-wall-heading');
  }
};

export default (el) => {
  if (!guardDecorate(el, 'heroImageWallDecorated')) return;

  const cells = getCells(el);
  const tileCells = cells.filter((c) => c.querySelector('picture'));
  const textCells = cells.filter((c) => !c.querySelector('picture'));

  const tiles = createElement(
    'div',
    { className: 'hero-image-wall-tiles' },
    ...tileCells.map((c) => createElement('div', { className: 'hero-image-wall-tile' }, ...c.children)),
  );

  const fg = createElement('div', { className: 'hero-image-wall-foreground' }, ...textCells);
  decorateRichText(fg);
  decorateForeground(fg);

  el.replaceChildren(tiles, fg);
};
