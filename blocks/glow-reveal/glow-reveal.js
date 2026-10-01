// One image with an optional glow, revealed once via onReveal. Not
// trackScrollProgress: the section is short and in normal flow, not pinned.
import { onReveal } from '../../scripts/utils/motion/motion.js';
import { createElement, getCells } from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  // Guard re-decoration: DA live preview can call decorate again on the same
  // element, and duplicate media layers would stack visibly.
  if (!guardDecorate(el, 'glowRevealDecorated')) return;

  // Row meaning is classified by CELL, not by whole row: a row can hold more
  // than one column (children of rows are cells), so a row that pairs the
  // picture cell with a sibling text cell must not sweep that sibling cell
  // away along with the picture. Mirrors hero.js's cells/bgCell/contentCells
  // pattern (see docs/conventions/blocks.md Row Classification).
  const cells = getCells(el);
  const picCell = cells.find((c) => c.querySelector('picture'));
  const pic = picCell?.querySelector('picture');
  if (!pic) return;

  const img = pic.querySelector('img');
  if (img) {
    img.setAttribute('loading', img.getAttribute('loading') ?? 'lazy');
    img.setAttribute('decoding', 'async');
  }

  const media = createElement('div', { className: 'glow-reveal-media' }, pic);
  const extra = cells.filter((c) => c !== picCell);
  el.replaceChildren(media, ...extra);

  onReveal(el, () => el.classList.add('is-in'));
};
