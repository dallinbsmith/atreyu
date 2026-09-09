// Vanilla port of Falkor's HeroTransitionV4 module — a single glowing image
// used as a repeated mid-page "reveal" section, not a page-level hero. Real
// content (checked directly against the live Sanity dataset, 2026-09-04) is
// always a single image; 6 of 7 real instances add a glow behind it, one
// omits it (opt out via the `no-glow` variant). This uses a one-shot
// reveal-on-scroll, not the continuous trackScrollProgress() engine
// pothole/pothole-v4 use — that engine assumes a tall, pinned section
// (`scroll.js`'s own doc comment), and this content is a short, normal-flow
// element. Matches hero-cards-transition.js's own onReveal()-for-entrance
// pattern instead.
import { onReveal } from '../../scripts/utils/motion/motion.js';
import { createElement, getCells } from '../../scripts/utils/dom.js';

export default (el) => {
  // Idempotency guard — a second decorate() call (e.g. DA's live-preview
  // reload path re-running loadBlock unconditionally) must not re-classify
  // already-restructured DOM: doing so would strip a level of wrapping off
  // any merged extra content on every subsequent call.
  if (el.dataset.heroTransitionV4Decorated) return;
  el.dataset.heroTransitionV4Decorated = 'true';

  // Row meaning is classified by CELL, not by whole row: a row can hold more
  // than one column (children of rows are cells), so a row that pairs the
  // picture cell with a sibling text cell must not sweep that sibling cell
  // away along with the picture. Mirrors hero.js's cells/bgCell/contentCells
  // pattern (see F-66 in eds-poc-findings.md).
  const cells = getCells(el);
  const picCell = cells.find((c) => c.querySelector('picture'));
  const pic = picCell?.querySelector('picture');
  if (!pic) return;

  const img = pic.querySelector('img');
  if (img) {
    img.setAttribute('loading', img.getAttribute('loading') ?? 'lazy');
    img.setAttribute('decoding', 'async');
  }

  const media = createElement('div', { className: 'hero-transition-v4-media' }, pic);
  const extra = cells.filter((c) => c !== picCell);
  el.replaceChildren(media, ...extra);

  onReveal(el, () => el.classList.add('is-in'));
};
