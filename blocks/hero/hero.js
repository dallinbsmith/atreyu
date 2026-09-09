import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import { createElement, getCells } from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

const decorateForeground = (fg) => {
  const children = [...fg.children];
  let textIdx = -1;
  children.forEach((child, idx) => {
    const heading = child.querySelector('h1, h2, h3, h4, h5, h6');
    const text = heading || child.querySelector('p, a, ul');
    // Eyebrow/detail line is classified by content shape — the `.rt-eyebrow`
    // span decorateRichText() produces for authored `[[eyebrow|text]]`
    // syntax — never by "whatever happens to sit before the heading".
    // Matches side-by-side.js's `.rt-eyebrow` → `closest('p')` convention.
    child.querySelector('.rt-eyebrow')?.closest('p')?.classList.add('hero-detail');
    if (heading) heading.classList.add('hero-heading');
    if (text) {
      child.classList.add('fg-text');
      if (textIdx === -1) textIdx = idx;
    }
  });
  // Decide start/end exactly once, based on the first text-bearing cell's
  // position — never per-iteration, which could add both classes to the
  // same element when more than one cell carries text.
  if (textIdx !== -1) {
    const hero = fg.closest('.hero');
    hero.classList.remove('hero-text-start', 'hero-text-end');
    hero.classList.add(textIdx === 0 ? 'hero-text-start' : 'hero-text-end');
  }
};

export default (el) => {
  // Idempotency guard — checked before any DOM restructuring below. A second
  // decorate() call would otherwise re-find the same cells (the foreground's
  // children sit at the same `:scope > div > div` depth as the originally
  // authored rows/cells) and re-wire a second click listener onto the same
  // still-present video link.
  if (el.dataset.heroDecorated) return;
  el.dataset.heroDecorated = 'true';

  // Background is classified by CELL, not by whole row: a row can hold more
  // than one column (children of rows are columns), so a row that mixes a
  // picture cell with a text/heading cell must not sweep the heading into
  // the background along with the picture.
  const cells = getCells(el);
  const bgCell = cells.find((c) => c.querySelector('picture'));
  const contentCells = cells.filter((c) => c !== bgCell);

  const fg = createElement('div', { className: 'hero-foreground' });
  fg.append(...contentCells);
  el.replaceChildren(fg);
  decorateRichText(fg); // must run before decorateForeground so .rt-eyebrow exists
  decorateForeground(fg);
  wireVideoModalLinks(fg);

  if (bgCell) {
    const bg = createElement('div', { className: 'hero-background' });
    bg.append(bgCell);
    decorateVideoMedia(bg);
    el.prepend(bg);
  }
};
